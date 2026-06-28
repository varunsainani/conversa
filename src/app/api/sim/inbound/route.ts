import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel } from "@/lib/db/schema";
import { ingestInbound } from "@/lib/whatsapp/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Best-effort, per-instance rate limit (serverless instances are not shared,
// so this is a soft guard against spam, not a hard global limit).
const RL = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = RL.get(ip);
  if (!e || e.resetAt < now) {
    RL.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  e.count += 1;
  return e.count > 30;
}

// Public endpoint: the /sim customer widget posts an inbound message here,
// driving the exact same ingest pipeline a real WhatsApp webhook would.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(ip)) return Response.json({ error: "rate_limited" }, { status: 429 });

  let body: { channelId?: string; waId?: string; name?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const waId = body.waId?.trim();
  const text = body.text?.trim();
  if (!channelId || !waId || !text || !UUID.test(channelId)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const [ch] = await db.select().from(channel).where(eq(channel.id, channelId));
    if (!ch || ch.kind !== "simulator") {
      return Response.json({ error: "invalid_channel" }, { status: 404 });
    }

    const providerMessageId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const result = await ingestInbound({
      provider: "simulator",
      channelId,
      waId: waId.slice(0, 40),
      name: body.name?.trim() || undefined,
      text: text.slice(0, 2000),
      providerMessageId,
    });

    return Response.json({ ok: true, conversationId: result.conversationId });
  } catch (e) {
    console.error("[sim/inbound]", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
