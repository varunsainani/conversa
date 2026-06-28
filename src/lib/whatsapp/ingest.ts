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
  const now = new Date();

  // Persist atomically: the idempotency record only commits if the whole
  // message is stored, so a provider retry after a mid-pipeline failure
  // reprocesses instead of silently dropping the message.
  const result = await db.transaction(async (tx) => {
    if (input.providerMessageId) {
      const inserted = await tx
        .insert(webhookEvent)
        .values({
          provider: input.provider,
          externalId: input.providerMessageId,
          orgId,
          payload: input.payload ?? {},
        })
        .onConflictDoNothing()
        .returning({ id: webhookEvent.id });
      if (inserted.length === 0) {
        return { duplicate: true as const, conversationId: "", autopilot: false, contactId: "" };
      }
    }

    // Atomic contact upsert on the (org, waId) unique key.
    const [contactRow] = await tx
      .insert(contact)
      .values({ orgId, waId: input.waId, name: input.name?.trim() || input.waId, lastContactAt: now })
      .onConflictDoUpdate({
        target: [contact.orgId, contact.waId],
        set: { lastContactAt: now },
      })
      .returning();

    const [found] = await tx
      .select()
      .from(conversation)
      .where(and(eq(conversation.orgId, orgId), eq(conversation.contactId, contactRow!.id)))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(1);

    let conv = found;
    if (!conv) {
      const [orgRow] = await tx
        .select({ autopilotDefault: org.autopilotDefault })
        .from(org)
        .where(eq(org.id, orgId));
      [conv] = await tx
        .insert(conversation)
        .values({
          orgId,
          contactId: contactRow!.id,
          channelId: ch.id,
          status: "open",
          aiAutopilot: orgRow?.autopilotDefault ?? false,
          lastMessagePreview: input.text.slice(0, 120),
          lastMessageAt: now,
          unreadCount: 1,
        })
        .returning();
    } else {
      await tx
        .update(conversation)
        .set({
          status: conv.status === "closed" ? "open" : conv.status,
          lastMessagePreview: input.text.slice(0, 120),
          lastMessageAt: now,
          unreadCount: sql`${conversation.unreadCount} + 1`,
        })
        .where(eq(conversation.id, conv.id));
    }

    await tx.insert(message).values({
      orgId,
      conversationId: conv!.id,
      direction: "inbound",
      via: "customer",
      body: input.text,
      status: "received",
      waMessageId: input.providerMessageId ?? null,
    });

    return {
      duplicate: false as const,
      conversationId: conv!.id,
      autopilot: conv!.aiAutopilot,
      contactId: contactRow!.id,
    };
  });

  if (result.duplicate) return { conversationId: "", duplicate: true };
  if (result.autopilot) await maybeAutoReply(orgId, result.conversationId, result.contactId);
  return { conversationId: result.conversationId };
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
