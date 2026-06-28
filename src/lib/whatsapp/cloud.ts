import crypto from "node:crypto";
import { SERVER_ENV } from "@/lib/server-env";
import type { WhatsAppProvider } from "./types";

/** Official WhatsApp Business Cloud API provider (coded + switchable). */
export function cloudProvider(): WhatsAppProvider {
  const { appSecret, phoneNumberId, accessToken } = SERVER_ENV.whatsapp;
  return {
    name: "cloud",
    async send(to, text) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      });
      if (!res.ok) {
        throw new Error(`cloud send ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const data = (await res.json()) as { messages?: { id?: string }[] };
      return { id: data.messages?.[0]?.id ?? null };
    },
    verifySignature(rawBody, signature) {
      if (!appSecret || !signature) return false;
      const expected =
        "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
  };
}
