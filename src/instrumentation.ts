// Runs once at server startup. Node < 22 has no global WebSocket, which
// supabase-js needs when it constructs a client (even server-side, where we
// never use realtime). On Vercel/Node 22+ this is a no-op.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined"
  ) {
    const ws = (await import("ws")).default;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
  }
}
