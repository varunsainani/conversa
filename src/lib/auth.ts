import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profile, type Profile } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";

export type AppCtx = {
  userId: string;
  orgId: string;
  role: "ADMIN" | "AGENT";
  profile: Profile;
};

/** Resolve the current user + their org profile, or null if not signed in. */
export const getCtx = cache(async (): Promise<AppCtx | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [p] = await db.select().from(profile).where(eq(profile.id, user.id));
  if (!p) return null;

  return { userId: user.id, orgId: p.orgId, role: p.role, profile: p };
});

export async function requireCtx(): Promise<AppCtx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireAdmin(): Promise<AppCtx> {
  const ctx = await requireCtx();
  if (ctx.role !== "ADMIN") throw new ActionError("forbidden");
  return ctx;
}
