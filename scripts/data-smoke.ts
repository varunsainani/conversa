import dotenv from "dotenv";
import ws from "ws";

dotenv.config({ path: ".env.local" });
dotenv.config();
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log("  ok  " + label);
  } else {
    fail++;
    console.log("  XX  " + label);
  }
}

async function main() {
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const inbox = await import("@/lib/data/inbox");
  const pipeline = await import("@/lib/data/pipeline");
  const contacts = await import("@/lib/data/contacts");
  const analytics = await import("@/lib/data/analytics");
  const { ingestInbound } = await import("@/lib/whatsapp/ingest");

  const [admin] = await db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.email, "admin@conversa.app"));
  if (!admin) throw new Error("seed missing admin profile - run npm run db:seed");
  const ctx = { userId: admin.id, orgId: admin.orgId, role: admin.role, profile: admin };

  const convos = await inbox.listConversations(ctx, { box: "all" });
  ok(convos.length >= 8, `listConversations (${convos.length})`);
  const mine = await inbox.listConversations(ctx, { box: "unassigned" });
  ok(mine.length >= 1, `filter unassigned (${mine.length})`);
  const counts = await inbox.inboxCounts(ctx);
  ok(counts.all >= 8 && counts.unread >= 1, `inboxCounts all=${counts.all} unread=${counts.unread}`);

  const first = convos.find((c) => c.contact.name === "Daniel Brooks")!;
  const detail = await inbox.getConversation(ctx, first.id);
  ok(detail.contact.name === "Daniel Brooks", "getConversation");
  const msgs = await inbox.getMessages(ctx, first.id);
  ok(msgs.length >= 4 && msgs.some((m) => m.direction === "internal"), `getMessages (${msgs.length}, has note)`);

  await inbox.sendMessage(ctx, first.id, "Following up here, thanks!");
  const after = await inbox.getMessages(ctx, first.id);
  ok(after.length === msgs.length + 1, "sendMessage appended");

  console.log("  ... aiSuggest (live Groq) ...");
  const sug = await inbox.aiSuggest(ctx, first.id);
  ok(typeof sug.text === "string" && sug.text.length > 5, `aiSuggest -> "${sug.text.slice(0, 50)}..."`);

  const pipe = await pipeline.listPipeline(ctx);
  ok(pipe.stages.length === 6 && pipe.totalValueCents > 0, `listPipeline (${pipe.stages.length} stages, $${pipe.totalValueCents / 100})`);
  const newStage = pipe.stages.find((s) => s.name === "Contacted")!;
  await pipeline.moveContactStage(ctx, detail.contact.id, newStage.id);
  const pipe2 = await pipeline.listPipeline(ctx);
  ok(
    pipe2.stages.find((s) => s.name === "Contacted")!.contacts.some((c) => c.id === detail.contact.id),
    "moveContactStage",
  );

  const list = await contacts.listContacts(ctx, "carla");
  ok(list.length === 1 && list[0]!.name.includes("Carla"), `listContacts search (${list.length})`);
  const csv = await contacts.contactsCsv(ctx);
  ok(csv.split("\n").length >= 9 && csv.startsWith("Name,"), "contactsCsv");

  const ov = await analytics.analyticsOverview(ctx);
  ok(ov.totalContacts >= 8 && ov.messages14d.length === 14, `analytics (contacts=${ov.totalContacts}, pipeline=$${ov.pipelineValueCents / 100})`);

  console.log("  ... ingest new inbound (simulator) ...");
  const [simCh] = await db.select().from(schema.channel).where(eq(schema.channel.orgId, ctx.orgId));
  const ing = await ingestInbound({
    provider: "simulator",
    channelId: simCh!.id,
    waId: "15550199999",
    name: "Walk-in Lead",
    text: "Hi! I'd like a quote for a landing page.",
    providerMessageId: "datasmoke_" + Date.now(),
  });
  ok(!!ing.conversationId, "ingestInbound created conversation");
  const convos2 = await inbox.listConversations(ctx, { box: "all" });
  ok(convos2.length === convos.length + 1, `inbound created a new conversation (${convos2.length})`);

  console.log(`\nDATA SMOKE: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
