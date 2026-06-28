import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel, contact, conversation, message } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public read for the /sim customer widget: the customer's own conversation
// thread (their messages + the business replies), simulator channels only.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId");
  const waId = url.searchParams.get("waId");
  if (!channelId || !waId) return Response.json({ messages: [] });

  const [ch] = await db.select().from(channel).where(eq(channel.id, channelId));
  if (!ch || ch.kind !== "simulator") return Response.json({ messages: [] });

  const [c] = await db
    .select()
    .from(contact)
    .where(and(eq(contact.orgId, ch.orgId), eq(contact.waId, waId)));
  if (!c) return Response.json({ messages: [] });

  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.orgId, ch.orgId), eq(conversation.contactId, c.id)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(1);
  if (!conv) return Response.json({ messages: [] });

  const msgs = await db
    .select({
      id: message.id,
      direction: message.direction,
      via: message.via,
      body: message.body,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(and(eq(message.conversationId, conv.id), ne(message.direction, "internal")))
    .orderBy(asc(message.createdAt));

  return Response.json({ messages: msgs });
}
