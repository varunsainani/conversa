import dotenv from "dotenv";
import ws from "ws";

dotenv.config({ path: ".env.local" });
dotenv.config();
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}

async function main() {
  const { suggestReply, summarizeAndEnrich } = await import("@/lib/ai");

  const history = [
    { direction: "inbound" as const, body: "Hi, do you build online stores with payments?" },
    { direction: "outbound" as const, body: "Yes! Tell me a bit about what you sell." },
    { direction: "inbound" as const, body: "Handmade ceramics, about 30 products. Budget around $6,000." },
  ];

  const reply = await suggestReply({
    persona: "You are a friendly sales assistant for Aurora Studio, a web design studio.",
    contactName: "Daniel",
    contactLocale: "en",
    contactMemory: "",
    history,
  });
  console.log("\n[suggestReply]\n" + reply.text);

  const enrich = await summarizeAndEnrich({
    contactName: "Daniel",
    stageNames: ["New", "Contacted", "Qualified", "Proposal sent", "Won", "Lost"],
    history,
  });
  console.log("\n[summarizeAndEnrich]\n" + JSON.stringify(enrich, null, 2));
  console.log("\nAI_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
