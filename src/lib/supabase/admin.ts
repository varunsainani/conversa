import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role admin client (secret key). Server-only. Bypasses RLS, so every
 * caller MUST scope queries by org explicitly. Used for auth admin (seeding
 * demo users) and for the webhook ingest path that runs without a user session.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
