export type InboundMessage = {
  provider: string;
  channelId: string;
  waId: string;
  name?: string;
  text: string;
  providerMessageId?: string;
  payload?: Record<string, unknown>;
};

export interface WhatsAppProvider {
  name: string;
  /** Deliver an outbound text. Returns the provider message id when available. */
  send(to: string, text: string): Promise<{ id: string | null }>;
  /** Verify an inbound webhook signature (cloud only; simulator trusts the channel check). */
  verifySignature(rawBody: string, signature: string | null): boolean;
}
