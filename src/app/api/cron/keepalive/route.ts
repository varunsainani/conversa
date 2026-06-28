import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SERVER_ENV } from "@/lib/server-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily Vercel Cron hits this so the free Supabase project never pauses.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!SERVER_ENV.cronSecret || auth !== `Bearer ${SERVER_ENV.cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  await db.execute(sql`select 1`);
  return Response.json({ ok: true, at: new Date().toISOString() });
}
