import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { SERVER_ENV } from "@/lib/server-env";
import { ActionError } from "@/lib/errors";
import { getLLM, type LLMMessage } from "./providers";

export type HistoryMsg = {
  direction: "inbound" | "outbound" | "internal";
  body: string;
};

const FALLBACK: Record<string, string> = {
  en: "Thanks for your message! A member of our team will get back to you shortly.",
  es: "¡Gracias por tu mensaje! Un miembro de nuestro equipo te responderá en breve.",
  pt: "Obrigado pela sua mensagem! Um membro da nossa equipe responderá em breve.",
};

function toLLMHistory(history: HistoryMsg[]): LLMMessage[] {
  return history
    .filter((m) => m.direction !== "internal" && m.body.trim().length > 0)
    .slice(-12)
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));
}

export async function suggestReply(input: {
  persona: string;
  contactName: string;
  contactLocale: string;
  contactMemory: string;
  history: HistoryMsg[];
}): Promise<{ text: string }> {
  const locale = input.contactLocale || "en";
  const system =
    `${input.persona}\n\n` +
    `You are replying on WhatsApp as the business. Write ONE concise reply (max 60 words) ` +
    `to the most recent customer message, using the conversation so far. ` +
    `Do not invent prices, discounts or commitments. Be warm and human. ` +
    `Reply in the customer's language (${locale}).` +
    (input.contactMemory ? `\n\nWhat we know about ${input.contactName}: ${input.contactMemory}` : "");

  const messages: LLMMessage[] = [{ role: "system", content: system }, ...toLLMHistory(input.history)];

  try {
    const out = (await getLLM().complete(messages, { temperature: 0.6, maxTokens: 220 })).trim();
    if (out) return { text: out.slice(0, 1200) };
  } catch (e) {
    console.error("[ai] suggestReply failed:", e);
  }
  return { text: FALLBACK[locale] ?? FALLBACK.en };
}

const enrichSchema = z.object({
  summary: z.string().max(600).default(""),
  suggestedTags: z.array(z.string().max(40)).max(6).default([]),
  suggestedStage: z.string().max(60).nullable().default(null),
  memory: z.string().max(600).default(""),
});
export type EnrichResult = z.infer<typeof enrichSchema>;

export async function summarizeAndEnrich(input: {
  contactName: string;
  stageNames: string[];
  history: HistoryMsg[];
}): Promise<EnrichResult> {
  const system =
    `You analyze a WhatsApp sales conversation and return STRICT JSON only. ` +
    `Schema: {"summary": string (1-2 sentences), "suggestedTags": string[] (0-4 short tags), ` +
    `"suggestedStage": one of [${input.stageNames.map((s) => `"${s}"`).join(", ")}] or null, ` +
    `"memory": string (a short note to remember about this contact for future replies)}. ` +
    `No prose, no code fences.`;
  const convo = input.history
    .filter((m) => m.direction !== "internal")
    .slice(-16)
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Us"}: ${m.body}`)
    .join("\n");

  try {
    const raw = await getLLM().complete(
      [
        { role: "system", content: system },
        { role: "user", content: `Contact: ${input.contactName}\n\nConversation:\n${convo}` },
      ],
      { temperature: 0.2, maxTokens: 400, json: true },
    );
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = enrichSchema.safeParse(JSON.parse(cleaned));
    if (parsed.success) {
      // Only allow a suggested stage that actually exists.
      if (parsed.data.suggestedStage && !input.stageNames.includes(parsed.data.suggestedStage)) {
        parsed.data.suggestedStage = null;
      }
      return parsed.data;
    }
  } catch (e) {
    console.error("[ai] summarizeAndEnrich failed:", e);
  }

  const lastInbound = [...input.history].reverse().find((m) => m.direction === "inbound");
  return {
    summary: lastInbound ? lastInbound.body.slice(0, 200) : "",
    suggestedTags: [],
    suggestedStage: null,
    memory: "",
  };
}

/** Increments today's AI usage for the org and enforces the daily cap. */
export async function enforceDailyCap(orgId: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db
    .insert(aiUsage)
    .values({ orgId, day, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.orgId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
    })
    .returning({ count: aiUsage.count });
  const count = rows[0]?.count ?? 1;
  if (count > SERVER_ENV.aiDailyCap) throw new ActionError("ai_cap_reached");
}
