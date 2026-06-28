import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversation, message } from "@/lib/db/schema";
import { getWhatsApp } from "@/lib/whatsapp";

/**
 * Persists an outbound message, updates the conversation, and delivers it via
 * the active WhatsApp provider. Shared by agent replies and AI autopilot.
 */
export async function deliverOutbound(opts: {
  orgId: string;
  conversationId: string;
  toWaId: string;
  text: string;
  via: "agent" | "ai";
  authorId?: string | null;
}) {
  const [msg] = await db
    .insert(message)
    .values({
      orgId: opts.orgId,
      conversationId: opts.conversationId,
      direction: "outbound",
      via: opts.via,
      body: opts.text,
      status: "sent",
      authorId: opts.authorId ?? null,
    })
    .returning();

  await db
    .update(conversation)
    .set({
      lastMessagePreview: opts.text.slice(0, 120),
      lastMessageAt: new Date(),
      status: sql`case when ${conversation.status} = 'closed' then 'open' else ${conversation.status} end`,
    })
    .where(eq(conversation.id, opts.conversationId));

  try {
    const { id } = await getWhatsApp().send(opts.toWaId, opts.text);
    if (id) {
      await db.update(message).set({ waMessageId: id }).where(eq(message.id, msg!.id));
    }
  } catch (e) {
    console.error("[wa] send failed:", e);
    await db.update(message).set({ status: "failed" }).where(eq(message.id, msg!.id));
  }

  return msg!;
}
