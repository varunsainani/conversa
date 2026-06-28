import type { WhatsAppProvider } from "./types";

/**
 * Simulator channel. Outbound delivery is the DB itself: the /sim customer
 * widget reads the conversation thread, so a persisted outbound message is
 * "delivered" instantly. Inbound arrives via /api/sim/inbound.
 */
export function simulatorProvider(): WhatsAppProvider {
  return {
    name: "simulator",
    async send() {
      return { id: null };
    },
    verifySignature() {
      return true;
    },
  };
}
