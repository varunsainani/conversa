import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel, contact, conversation, message, org, webhookEvent } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";
import { suggestReply, enforceDailyCap, type HistoryMsg } from "@/lib/ai";
import { deliverOutbound } from "@/lib/messaging";
import type { InboundMessage } from "./types";

/**
 * Shared inbound pipeline for every WhatsApp provider: idempotency, contact
 * upsert, conversation find/create, message append, and AI autopilot.
 */
export async function ingestInbound(
  input: InboundMessage,
): Promise<{ conversationId: string; duplicate?: boolean }> {
  const [ch] = await db.select().from(channel).where(eq(channel.id, input.channelId));
  if (!ch) throw new ActionError("channel_not_found");
  const orgId = ch.orgId;

  // Idempotency ledger (provider + message id is unique).
  if (input.providerMessageId) {
    const inserted = await db
      .insert(webhookEvent)
      .values({
        provider: input.provider,
        externalId: input.providerMessageId,
        orgId,
        payload: input.payload ?? {},
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvent.id });
    if (inserted.length === 0) return { conversationId: "", duplicate: true };
  }

  // Upsert the contact (the lead).
  const [existing] = await db
    .select()
    .from(contact)
    .where(and(eq(contact.orgId, orgId), eq(contact.waId, input.waId)));
  let contactRow = existing;
  if (!contactRow) {
    [contactRow] = await db
      .insert(contact)
      .values({
        orgId,
        waId: input.waId,
        name: input.name?.trim() || input.waId,
        lastContactAt: new Date(),
      })
      .returning();
  } else {
    await db
      .update(contact)
      .set({
        lastContactAt: new Date(),
        ...(input.name && !contactRow.name ? { name: input.name } : {}),
      })
      .where(eq(contact.id, contactRow.id));
  }

  // Find the latest conversation or open a new one.
  const [found] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.orgId, orgId), eq(conversation.contactId, contactRow!.id)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(1);

  let conv = found;
  if (!conv) {
    [conv] = await db
      .insert(conversation)
      .values({
        orgId,
        contactId: contactRow!.id,
        channelId: ch.id,
        status: "open",
        lastMessagePreview: input.text.slice(0, 120),
        lastMessageAt: new Date(),
        unreadCount: 1,
      })
      .returning();
  } else {
    await db
      .update(conversation)
      .set({
        status: conv.status === "closed" ? "open" : conv.status,
        lastMessagePreview: input.text.slice(0, 120),
        lastMessageAt: new Date(),
        unreadCount: sql`${conversation.unreadCount} + 1`,
      })
      .where(eq(conversation.id, conv.id));
  }

  await db.insert(message).values({
    orgId,
    conversationId: conv!.id,
    direction: "inbound",
    via: "customer",
    body: input.text,
    status: "received",
    waMessageId: input.providerMessageId ?? null,
  });

  if (conv!.aiAutopilot) {
    await maybeAutoReply(orgId, conv!.id, contactRow!.id);
  }

  return { conversationId: conv!.id };
}

async function maybeAutoReply(orgId: string, conversationId: string, contactId: string) {
  try {
    await enforceDailyCap(orgId);
    const [orgRow] = await db.select().from(org).where(eq(org.id, orgId));
    const [c] = await db.select().from(contact).where(eq(contact.id, contactId));
    if (!orgRow || !c) return;
    const history = (await db
      .select({ direction: message.direction, body: message.body })
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(asc(message.createdAt))) as HistoryMsg[];

    const { text } = await suggestReply({
      persona: orgRow.persona,
      contactName: c.name,
      contactLocale: c.locale,
      contactMemory: c.memory,
      history,
    });

    await deliverOutbound({
      orgId,
      conversationId,
      toWaId: c.waId,
      text,
      via: "ai",
    });
  } catch (e) {
    console.error("[wa] autopilot failed:", e);
  }
}
