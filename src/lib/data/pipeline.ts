import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contact, pipelineStage } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";
import type { AppCtx } from "@/lib/auth";

export type PipelineContact = {
  id: string;
  name: string;
  waId: string;
  valueCents: number;
  tags: string[];
  lastContactAt: string;
};

export type PipelineStageDTO = {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
  sort: number;
  valueCents: number;
  contacts: PipelineContact[];
};

export async function listPipeline(
  ctx: AppCtx,
): Promise<{ stages: PipelineStageDTO[]; totalValueCents: number }> {
  const stages = await db
    .select()
    .from(pipelineStage)
    .where(eq(pipelineStage.orgId, ctx.orgId))
    .orderBy(asc(pipelineStage.sort));

  const contacts = await db
    .select({
      id: contact.id,
      name: contact.name,
      waId: contact.waId,
      valueCents: contact.valueCents,
      tags: contact.tags,
      lastContactAt: contact.lastContactAt,
      stageId: contact.stageId,
    })
    .from(contact)
    .where(eq(contact.orgId, ctx.orgId))
    .orderBy(desc(contact.lastContactAt));

  const firstStageId = stages[0]?.id;
  const byStage = new Map<string, PipelineContact[]>();
  for (const s of stages) byStage.set(s.id, []);
  for (const c of contacts) {
    const sid = c.stageId && byStage.has(c.stageId) ? c.stageId : firstStageId;
    if (!sid) continue;
    byStage.get(sid)!.push({
      id: c.id,
      name: c.name,
      waId: c.waId,
      valueCents: c.valueCents,
      tags: c.tags,
      lastContactAt: c.lastContactAt.toISOString(),
    });
  }

  const stageDTOs: PipelineStageDTO[] = stages.map((s) => {
    const cs = byStage.get(s.id) ?? [];
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      isWon: s.isWon,
      isLost: s.isLost,
      sort: s.sort,
      contacts: cs,
      valueCents: cs.reduce((a, c) => a + c.valueCents, 0),
    };
  });

  return {
    stages: stageDTOs,
    totalValueCents: contacts.reduce((a, c) => a + c.valueCents, 0),
  };
}

export async function moveContactStage(ctx: AppCtx, contactId: string, stageId: string) {
  const [s] = await db
    .select()
    .from(pipelineStage)
    .where(and(eq(pipelineStage.id, stageId), eq(pipelineStage.orgId, ctx.orgId)));
  if (!s) throw new ActionError("not_found");

  const res = await db
    .update(contact)
    .set({ stageId })
    .where(and(eq(contact.id, contactId), eq(contact.orgId, ctx.orgId)))
    .returning({ id: contact.id });
  if (res.length === 0) throw new ActionError("not_found");
  return { ok: true };
}
