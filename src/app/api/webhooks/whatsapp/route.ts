import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel } from "@/lib/db/schema";
import { SERVER_ENV } from "@/lib/server-env";
import { getWhatsApp } from "@/lib/whatsapp";
import { ingestInbound } from "@/lib/whatsapp/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta webhook verification handshake.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === SERVER_ENV.whatsapp.verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// Meta inbound + status callbacks (cloud provider).
export async function POST(req: Request) {
  const raw = await req.text();
  const provider = getWhatsApp();
  const signature = req.headers.get("x-hub-signature-256");
  if (provider.name === "cloud" && !provider.verifySignature(raw, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Resolve the cloud channel for this org/number.
  const [cloudChannel] = await db.select().from(channel).where(eq(channel.kind, "cloud")).limit(1);

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contactsByWa: Record<string, string> = {};
        for (const c of value.contacts ?? []) {
          if (c.wa_id) contactsByWa[c.wa_id] = c.profile?.name ?? c.wa_id;
        }
        for (const m of value.messages ?? []) {
          if (m.type !== "text") continue;
          const channelId =
            cloudChannel?.id ??
            (
              await db
                .select()
                .from(channel)
                .where(and(eq(channel.kind, "cloud")))
                .limit(1)
            )[0]?.id;
          if (!channelId) continue;
          await ingestInbound({
            provider: "whatsapp_cloud",
            channelId,
            waId: m.from,
            name: contactsByWa[m.from],
            text: m.text?.body ?? "",
            providerMessageId: m.id,
            payload: m,
          });
        }
      }
    }
  } catch (e) {
    console.error("[webhook] processing error:", e);
  }

  // Always 200 so Meta does not retry indefinitely.
  return new Response("ok", { status: 200 });
}
