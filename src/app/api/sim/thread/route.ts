import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel, contact, conversation, message } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public read for the /sim customer widget: the customer's own conversation
// thread (their messages + the business replies), simulator channels only.
export async function GET(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[sim/thread]", e);
    return Response.json({ messages: [] });
  }
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId");
  const waId = url.searchParams.get("waId");
  if (!channelId || !waId || !UUID.test(channelId)) return Response.json({ messages: [] });

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
