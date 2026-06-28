import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { contact, conversation, pipelineStage } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";
import type { AppCtx } from "@/lib/auth";

export type ContactListItem = {
  id: string;
  name: string;
  waId: string;
  stageId: string | null;
  stageName: string | null;
  valueCents: number;
  tags: string[];
  lastContactAt: string;
};

export async function listContacts(ctx: AppCtx, q?: string): Promise<ContactListItem[]> {
  const conds = [eq(contact.orgId, ctx.orgId)];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(contact.name, like), ilike(contact.waId, like))!);
  }
  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      waId: contact.waId,
      stageId: contact.stageId,
      stageName: pipelineStage.name,
      valueCents: contact.valueCents,
      tags: contact.tags,
      lastContactAt: contact.lastContactAt,
    })
    .from(contact)
    .leftJoin(pipelineStage, eq(contact.stageId, pipelineStage.id))
    .where(and(...conds))
    .orderBy(desc(contact.lastContactAt))
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    waId: r.waId,
    stageId: r.stageId,
    stageName: r.stageName,
    valueCents: r.valueCents,
    tags: r.tags,
    lastContactAt: r.lastContactAt.toISOString(),
  }));
}

export type ContactDetail = ContactListItem & {
  memory: string;
  locale: string;
  avatarUrl: string | null;
  customFields: Record<string, unknown>;
  conversationId: string | null;
  createdAt: string;
};

export async function getContact(ctx: AppCtx, id: string): Promise<ContactDetail> {
  const [row] = await db
    .select({
      id: contact.id,
      name: contact.name,
      waId: contact.waId,
      stageId: contact.stageId,
      stageName: pipelineStage.name,
      valueCents: contact.valueCents,
      tags: contact.tags,
      memory: contact.memory,
      locale: contact.locale,
      avatarUrl: contact.avatarUrl,
      customFields: contact.customFields,
      lastContactAt: contact.lastContactAt,
      createdAt: contact.createdAt,
    })
    .from(contact)
    .leftJoin(pipelineStage, eq(contact.stageId, pipelineStage.id))
    .where(and(eq(contact.id, id), eq(contact.orgId, ctx.orgId)));
  if (!row) throw new ActionError("not_found");

  const [conv] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.contactId, id), eq(conversation.orgId, ctx.orgId)))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(1);

  return {
    id: row.id,
    name: row.name,
    waId: row.waId,
    stageId: row.stageId,
    stageName: row.stageName,
    valueCents: row.valueCents,
    tags: row.tags,
    memory: row.memory,
    locale: row.locale,
    avatarUrl: row.avatarUrl,
    customFields: row.customFields,
    conversationId: conv?.id ?? null,
    lastContactAt: row.lastContactAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export type ContactPatch = {
  name?: string;
  valueCents?: number;
  tags?: string[];
  stageId?: string | null;
  memory?: string;
};

export async function updateContact(ctx: AppCtx, id: string, patch: ContactPatch) {
  const set: Record<string, unknown> = {};
  if (typeof patch.name === "string") set.name = patch.name.slice(0, 200);
  if (typeof patch.valueCents === "number" && Number.isFinite(patch.valueCents)) {
    set.valueCents = Math.max(0, Math.min(Math.round(patch.valueCents), 9_000_000_000_000));
  }
  if (Array.isArray(patch.tags)) set.tags = patch.tags.slice(0, 12).map((t) => String(t).slice(0, 40));
  if (typeof patch.memory === "string") set.memory = patch.memory.slice(0, 1000);
  if (patch.stageId !== undefined) {
    if (patch.stageId) {
      const [s] = await db
        .select()
        .from(pipelineStage)
        .where(and(eq(pipelineStage.id, patch.stageId), eq(pipelineStage.orgId, ctx.orgId)));
      if (!s) throw new ActionError("not_found");
    }
    set.stageId = patch.stageId;
  }
  if (Object.keys(set).length === 0) return { ok: true };

  const res = await db
    .update(contact)
    .set(set)
    .where(and(eq(contact.id, id), eq(contact.orgId, ctx.orgId)))
    .returning({ id: contact.id });
  if (res.length === 0) throw new ActionError("not_found");
  return { ok: true };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function contactsCsv(ctx: AppCtx): Promise<string> {
  const rows = await listContacts(ctx);
  const header = ["Name", "WhatsApp", "Stage", "Value", "Tags", "Last contact"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.name),
        csvCell(r.waId),
        csvCell(r.stageName ?? ""),
        (r.valueCents / 100).toFixed(2),
        csvCell(r.tags.join("; ")),
        csvCell(r.lastContactAt.slice(0, 10)),
      ].join(","),
    );
  }
  return lines.join("\n");
}
