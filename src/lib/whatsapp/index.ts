import { SERVER_ENV } from "@/lib/server-env";
import { cloudProvider } from "./cloud";
import { simulatorProvider } from "./simulator";
import type { WhatsAppProvider } from "./types";

export function getWhatsApp(): WhatsAppProvider {
  return SERVER_ENV.whatsappProvider === "cloud" ? cloudProvider() : simulatorProvider();
}

export type { WhatsAppProvider, InboundMessage } from "./types";
