import { SERVER_ENV } from "@/lib/server-env";

export type LLMRole = "system" | "user" | "assistant";
export type LLMMessage = { role: LLMRole; content: string };
export type CompleteOpts = { temperature?: number; maxTokens?: number; json?: boolean };

export interface LLMProvider {
  name: string;
  complete(messages: LLMMessage[], opts?: CompleteOpts): Promise<string>;
}

/** OpenAI-compatible chat completions (Groq + OpenAI share this shape). */
function openAICompatible(opts: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}): LLMProvider {
  return {
    name: opts.name,
    async complete(messages, o) {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: o?.temperature ?? 0.6,
          max_tokens: o?.maxTokens ?? 600,
          ...(o?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`${opts.name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

function anthropicProvider(): LLMProvider {
  const { apiKey, model } = SERVER_ENV.anthropic;
  return {
    name: "anthropic",
    async complete(messages, o) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const msgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: o?.maxTokens ?? 600,
          temperature: o?.temperature ?? 0.6,
          system: system || undefined,
          messages: msgs,
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { content?: { text?: string }[] };
      return data.content?.[0]?.text ?? "";
    },
  };
}

function geminiProvider(): LLMProvider {
  const { apiKey, model } = SERVER_ENV.gemini;
  return {
    name: "gemini",
    async complete(messages, o) {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            contents,
            generationConfig: {
              temperature: o?.temperature ?? 0.6,
              maxOutputTokens: o?.maxTokens ?? 600,
              ...(o?.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        },
      );
      if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
  };
}

/** Resolve the active provider from LLM_PROVIDER (default groq). */
export function getLLM(): LLMProvider {
  switch (SERVER_ENV.llmProvider) {
    case "openai":
      return openAICompatible({
        name: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: SERVER_ENV.openai.apiKey,
        model: SERVER_ENV.openai.model,
      });
    case "anthropic":
      return anthropicProvider();
    case "gemini":
      return geminiProvider();
    case "groq":
    default:
      return openAICompatible({
        name: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: SERVER_ENV.groq.apiKey,
        model: SERVER_ENV.groq.model,
      });
  }
}
