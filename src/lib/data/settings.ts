import crypto from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel, org, pipelineStage, profile, tag, template } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppCtx } from "@/lib/auth";

// ---- Team ----

export async function listTeam(ctx: AppCtx) {
  const rows = await db
    .select({ id: profile.id, fullName: profile.fullName, email: profile.email, role: profile.role })
    .from(profile)
    .where(eq(profile.orgId, ctx.orgId))
    .orderBy(asc(profile.fullName));
  return rows;
}

async function adminCount(orgId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profile)
    .where(and(eq(profile.orgId, orgId), eq(profile.role, "ADMIN")));
  return r?.n ?? 0;
}

export async function inviteMember(
  ctx: AppCtx,
  email: string,
  role: "ADMIN" | "AGENT",
  fullName?: string,
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new ActionError("invalid_email");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: crypto.randomBytes(18).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: fullName ?? "" },
  });
  if (error || !data.user) throw new ActionError("invite_failed", error?.message);

  await db.insert(profile).values({
    id: data.user.id,
    orgId: ctx.orgId,
    role,
    fullName: fullName?.trim() || cleanEmail.split("@")[0]!,
    email: cleanEmail,
  });
  return { ok: true };
}

export async function updateMember(
  ctx: AppCtx,
  id: string,
  patch: { role?: "ADMIN" | "AGENT"; fullName?: string },
) {
  const [member] = await db
    .select()
    .from(profile)
    .where(and(eq(profile.id, id), eq(profile.orgId, ctx.orgId)));
  if (!member) throw new ActionError("not_found");

  if (patch.role === "AGENT" && member.role === "ADMIN" && (await adminCount(ctx.orgId)) <= 1) {
    throw new ActionError("last_admin");
  }
  const set: Record<string, unknown> = {};
  if (patch.role) set.role = patch.role;
  if (typeof patch.fullName === "string") set.fullName = patch.fullName.slice(0, 120);
  if (Object.keys(set).length) await db.update(profile).set(set).where(eq(profile.id, id));
  return { ok: true };
}

export async function removeMember(ctx: AppCtx, id: string) {
  if (id === ctx.userId) throw new ActionError("cannot_remove_self");
  const [member] = await db
    .select()
    .from(profile)
    .where(and(eq(profile.id, id), eq(profile.orgId, ctx.orgId)));
  if (!member) throw new ActionError("not_found");
  if (member.role === "ADMIN" && (await adminCount(ctx.orgId)) <= 1) throw new ActionError("last_admin");

  await db.delete(profile).where(eq(profile.id, id));
  try {
    await createAdminClient().auth.admin.deleteUser(id);
  } catch (e) {
    console.error("[settings] deleteUser failed:", e);
  }
  return { ok: true };
}

// ---- Channels ----

export async function listChannels(ctx: AppCtx) {
  return db.select().from(channel).where(eq(channel.orgId, ctx.orgId)).orderBy(asc(channel.name));
}

export async function updateChannel(
  ctx: AppCtx,
  id: string,
  patch: { name?: string; phoneDisplay?: string; status?: "connected" | "disconnected" },
) {
  const set: Record<string, unknown> = {};
  if (typeof patch.name === "string") set.name = patch.name.slice(0, 120);
  if (typeof patch.phoneDisplay === "string") set.phoneDisplay = patch.phoneDisplay.slice(0, 60);
  if (patch.status) set.status = patch.status;
  if (Object.keys(set).length === 0) return { ok: true };
  const res = await db
    .update(channel)
    .set(set)
    .where(and(eq(channel.id, id), eq(channel.orgId, ctx.orgId)))
    .returning({ id: channel.id });
  if (res.length === 0) throw new ActionError("not_found");
  return { ok: true };
}

// ---- Tags ----

export async function listTags(ctx: AppCtx) {
  return db.select().from(tag).where(eq(tag.orgId, ctx.orgId)).orderBy(asc(tag.name));
}

export async function createTag(ctx: AppCtx, name: string, color: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new ActionError("invalid_input");
  await db
    .insert(tag)
    .values({ orgId: ctx.orgId, name: clean, color: color || "#586567" })
    .onConflictDoNothing();
  return { ok: true };
}

export async function deleteTag(ctx: AppCtx, id: string) {
  await db.delete(tag).where(and(eq(tag.id, id), eq(tag.orgId, ctx.orgId)));
  return { ok: true };
}

// ---- Pipeline stages ----

export async function listStages(ctx: AppCtx) {
  return db
    .select()
    .from(pipelineStage)
    .where(eq(pipelineStage.orgId, ctx.orgId))
    .orderBy(asc(pipelineStage.sort));
}

export async function createStage(ctx: AppCtx, name: string, color: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new ActionError("invalid_input");
  const [maxRow] = await db
    .select({ m: sql<number>`coalesce(max(${pipelineStage.sort}), -1)::int` })
    .from(pipelineStage)
    .where(eq(pipelineStage.orgId, ctx.orgId));
  await db
    .insert(pipelineStage)
    .values({ orgId: ctx.orgId, name: clean, color: color || "#586567", sort: (maxRow?.m ?? -1) + 1 });
  return { ok: true };
}

export async function updateStage(
  ctx: AppCtx,
  id: string,
  patch: { name?: string; color?: string },
) {
  const set: Record<string, unknown> = {};
  if (typeof patch.name === "string") set.name = patch.name.slice(0, 60);
  if (typeof patch.color === "string") set.color = patch.color;
  if (Object.keys(set).length === 0) return { ok: true };
  await db
    .update(pipelineStage)
    .set(set)
    .where(and(eq(pipelineStage.id, id), eq(pipelineStage.orgId, ctx.orgId)));
  return { ok: true };
}

export async function deleteStage(ctx: AppCtx, id: string) {
  const count = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pipelineStage)
    .where(eq(pipelineStage.orgId, ctx.orgId));
  if ((count[0]?.n ?? 0) <= 1) throw new ActionError("need_one_stage");
  await db.delete(pipelineStage).where(and(eq(pipelineStage.id, id), eq(pipelineStage.orgId, ctx.orgId)));
  return { ok: true };
}

// ---- Templates ----

export async function listTemplates(ctx: AppCtx) {
  return db.select().from(template).where(eq(template.orgId, ctx.orgId)).orderBy(asc(template.title));
}

export async function createTemplate(ctx: AppCtx, title: string, body: string) {
  const t = title.trim().slice(0, 80);
  const b = body.trim().slice(0, 1000);
  if (!t || !b) throw new ActionError("invalid_input");
  await db.insert(template).values({ orgId: ctx.orgId, title: t, body: b });
  return { ok: true };
}

export async function updateTemplate(
  ctx: AppCtx,
  id: string,
  patch: { title?: string; body?: string },
) {
  const set: Record<string, unknown> = {};
  if (typeof patch.title === "string") set.title = patch.title.slice(0, 80);
  if (typeof patch.body === "string") set.body = patch.body.slice(0, 1000);
  if (Object.keys(set).length === 0) return { ok: true };
  await db.update(template).set(set).where(and(eq(template.id, id), eq(template.orgId, ctx.orgId)));
  return { ok: true };
}

export async function deleteTemplate(ctx: AppCtx, id: string) {
  await db.delete(template).where(and(eq(template.id, id), eq(template.orgId, ctx.orgId)));
  return { ok: true };
}

// ---- Org / AI settings ----

export async function getOrgSettings(ctx: AppCtx) {
  const [o] = await db.select().from(org).where(eq(org.id, ctx.orgId));
  if (!o) throw new ActionError("not_found");
  return { name: o.name, persona: o.persona, autopilotDefault: o.autopilotDefault };
}

export async function updateAiSettings(
  ctx: AppCtx,
  patch: { persona?: string; autopilotDefault?: boolean; name?: string },
) {
  const set: Record<string, unknown> = {};
  if (typeof patch.persona === "string") set.persona = patch.persona.slice(0, 2000);
  if (typeof patch.autopilotDefault === "boolean") set.autopilotDefault = patch.autopilotDefault;
  if (typeof patch.name === "string") set.name = patch.name.slice(0, 120);
  if (Object.keys(set).length === 0) return { ok: true };
  await db.update(org).set(set).where(eq(org.id, ctx.orgId));
  return { ok: true };
}
