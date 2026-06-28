import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage, contact, conversation, message, pipelineStage, profile } from "@/lib/db/schema";
import type { AppCtx } from "@/lib/auth";

export type AnalyticsOverview = {
  totalContacts: number;
  openConversations: number;
  closedConversations: number;
  unreadTotal: number;
  teamSize: number;
  pipelineValueCents: number;
  wonCount: number;
  wonValueCents: number;
  aiRepliesToday: number;
  leadsByStage: { name: string; color: string; count: number; valueCents: number }[];
  messages14d: { date: string; inbound: number; outbound: number }[];
};

export async function analyticsOverview(ctx: AppCtx): Promise<AnalyticsOverview> {
  const [contacts] = await db
    .select({ n: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${contact.valueCents}),0)::bigint` })
    .from(contact)
    .where(eq(contact.orgId, ctx.orgId));

  const [convs] = await db
    .select({
      open: sql<number>`count(*) filter (where ${conversation.status} = 'open')::int`,
      closed: sql<number>`count(*) filter (where ${conversation.status} = 'closed')::int`,
      unread: sql<number>`coalesce(sum(${conversation.unreadCount}),0)::int`,
    })
    .from(conversation)
    .where(eq(conversation.orgId, ctx.orgId));

  const [team] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profile)
    .where(eq(profile.orgId, ctx.orgId));

  // Leads grouped by stage (+ won totals).
  const stageRows = await db
    .select({
      id: pipelineStage.id,
      name: pipelineStage.name,
      color: pipelineStage.color,
      isWon: pipelineStage.isWon,
      isLost: pipelineStage.isLost,
      sort: pipelineStage.sort,
      count: sql<number>`count(${contact.id})::int`,
      value: sql<number>`coalesce(sum(${contact.valueCents}),0)::bigint`,
    })
    .from(pipelineStage)
    .leftJoin(contact, eq(contact.stageId, pipelineStage.id))
    .where(eq(pipelineStage.orgId, ctx.orgId))
    .groupBy(
      pipelineStage.id,
      pipelineStage.name,
      pipelineStage.color,
      pipelineStage.isWon,
      pipelineStage.isLost,
      pipelineStage.sort,
    )
    .orderBy(pipelineStage.sort);

  const leadsByStage = stageRows.map((s) => ({
    name: s.name,
    color: s.color,
    count: Number(s.count),
    valueCents: Number(s.value),
  }));
  const won = stageRows.filter((s) => s.isWon);
  const wonCount = won.reduce((a, s) => a + Number(s.count), 0);
  const wonValueCents = won.reduce((a, s) => a + Number(s.value), 0);
  const pipelineValueCents = stageRows
    .filter((s) => !s.isLost)
    .reduce((a, s) => a + Number(s.value), 0);

  const [aiToday] = await db
    .select({ c: aiUsage.count })
    .from(aiUsage)
    .where(and(eq(aiUsage.orgId, ctx.orgId), eq(aiUsage.day, new Date().toISOString().slice(0, 10))));

  // 14-day message volume.
  const seriesRows = (await db.execute(sql`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      count(*) filter (where direction = 'inbound')::int as inbound,
      count(*) filter (where direction = 'outbound')::int as outbound
    from ${message}
    where org_id = ${ctx.orgId} and created_at >= now() - interval '13 days'
    group by 1
  `)) as unknown as { day: string; inbound: number; outbound: number }[];

  const byDay = new Map(seriesRows.map((r) => [r.day, r]));
  const messages14d: AnalyticsOverview["messages14d"] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    messages14d.push({
      date: d,
      inbound: Number(r?.inbound ?? 0),
      outbound: Number(r?.outbound ?? 0),
    });
  }

  return {
    totalContacts: Number(contacts?.n ?? 0),
    openConversations: Number(convs?.open ?? 0),
    closedConversations: Number(convs?.closed ?? 0),
    unreadTotal: Number(convs?.unread ?? 0),
    teamSize: Number(team?.n ?? 0),
    pipelineValueCents,
    wonCount,
    wonValueCents,
    aiRepliesToday: Number(aiToday?.c ?? 0),
    leadsByStage,
    messages14d,
  };
}
