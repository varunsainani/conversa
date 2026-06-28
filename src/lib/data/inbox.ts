import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contact, conversation, message, org, pipelineStage, profile } from "@/lib/db/schema";
import { ActionError } from "@/lib/errors";
import { deliverOutbound } from "@/lib/messaging";
import {
  enforceDailyCap,
  suggestReply,
  summarizeAndEnrich,
  type HistoryMsg,
  type EnrichResult,
} from "@/lib/ai";
import type { AppCtx } from "@/lib/auth";

export type InboxFilter = {
  box?: "all" | "mine" | "unassigned" | "open" | "closed";
  q?: string;
};

export type ConversationListItem = {
  id: string;
  status: "open" | "pending" | "closed";
  unreadCount: number;
  aiAutopilot: boolean;
  lastMessagePreview: string;
  lastMessageAt: string;
  assignee: { id: string; name: string } | null;
  contact: { id: string; name: string; waId: string; avatarUrl: string | null; stageId: string | null };
};

export async function listConversations(
  ctx: AppCtx,
  filter: InboxFilter = {},
): Promise<ConversationListItem[]> {
  const conds = [eq(conversation.orgId, ctx.orgId)];
  if (filter.box === "mine") conds.push(eq(conversation.assigneeId, ctx.userId));
  else if (filter.box === "unassigned") conds.push(isNull(conversation.assigneeId));
  else if (filter.box === "open") conds.push(eq(conversation.status, "open"));
  else if (filter.box === "closed") conds.push(eq(conversation.status, "closed"));
  if (filter.q && filter.q.trim()) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(ilike(contact.name, q), ilike(contact.waId, q))!);
  }

  const rows = await db
    .select({
      id: conversation.id,
      status: conversation.status,
      unreadCount: conversation.unreadCount,
      aiAutopilot: conversation.aiAutopilot,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      assigneeId: conversation.assigneeId,
      assigneeName: profile.fullName,
      contactId: contact.id,
      contactName: contact.name,
      contactWaId: contact.waId,
      contactAvatar: contact.avatarUrl,
      stageId: contact.stageId,
    })
    .from(conversation)
    .innerJoin(contact, eq(conversation.contactId, contact.id))
    .leftJoin(profile, eq(conversation.assigneeId, profile.id))
    .where(and(...conds))
    .orderBy(desc(conversation.lastMessageAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    unreadCount: r.unreadCount,
    aiAutopilot: r.aiAutopilot,
    lastMessagePreview: r.lastMessagePreview,
    lastMessageAt: r.lastMessageAt.toISOString(),
    assignee: r.assigneeId ? { id: r.assigneeId, name: r.assigneeName ?? "" } : null,
    contact: {
      id: r.contactId,
      name: r.contactName,
      waId: r.contactWaId,
      avatarUrl: r.contactAvatar,
      stageId: r.stageId,
    },
  }));
}

async function loadConversation(ctx: AppCtx, convId: string) {
  const [conv] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, convId), eq(conversation.orgId, ctx.orgId)));
  if (!conv) throw new ActionError("not_found");
  return conv;
}

export type ConversationDetail = {
  id: string;
  status: "open" | "pending" | "closed";
  aiAutopilot: boolean;
  assignee: { id: string; name: string } | null;
  contact: {
    id: string;
    name: string;
    waId: string;
    avatarUrl: string | null;
    locale: string;
    stageId: string | null;
    stageName: string | null;
    valueCents: number;
    tags: string[];
    memory: string;
  };
};

export async function getConversation(ctx: AppCtx, convId: string): Promise<ConversationDetail> {
  const [row] = await db
    .select({
      id: conversation.id,
      status: conversation.status,
      aiAutopilot: conversation.aiAutopilot,
      assigneeId: conversation.assigneeId,
      assigneeName: profile.fullName,
      cId: contact.id,
      cName: contact.name,
      cWa: contact.waId,
      cAvatar: contact.avatarUrl,
      cLocale: contact.locale,
      cStageId: contact.stageId,
      cValue: contact.valueCents,
      cTags: contact.tags,
      cMemory: contact.memory,
      stageName: pipelineStage.name,
    })
    .from(conversation)
    .innerJoin(contact, eq(conversation.contactId, contact.id))
    .leftJoin(profile, eq(conversation.assigneeId, profile.id))
    .leftJoin(pipelineStage, eq(contact.stageId, pipelineStage.id))
    .where(and(eq(conversation.id, convId), eq(conversation.orgId, ctx.orgId)));
  if (!row) throw new ActionError("not_found");

  return {
    id: row.id,
    status: row.status,
    aiAutopilot: row.aiAutopilot,
    assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName ?? "" } : null,
    contact: {
      id: row.cId,
      name: row.cName,
      waId: row.cWa,
      avatarUrl: row.cAvatar,
      locale: row.cLocale,
      stageId: row.cStageId,
      stageName: row.stageName,
      valueCents: row.cValue,
      tags: row.cTags,
      memory: row.cMemory,
    },
  };
}

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  via: string;
  body: string;
  status: string;
  authorName: string | null;
  createdAt: string;
};

export async function getMessages(ctx: AppCtx, convId: string): Promise<ThreadMessage[]> {
  await loadConversation(ctx, convId);
  const rows = await db
    .select({
      id: message.id,
      direction: message.direction,
      via: message.via,
      body: message.body,
      status: message.status,
      authorName: profile.fullName,
      createdAt: message.createdAt,
    })
    .from(message)
    .leftJoin(profile, eq(message.authorId, profile.id))
    .where(eq(message.conversationId, convId))
    .orderBy(asc(message.createdAt));

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    via: r.via,
    body: r.body,
    status: r.status,
    authorName: r.authorName,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function sendMessage(ctx: AppCtx, convId: string, body: string) {
  const text = body.trim();
  if (!text) throw new ActionError("empty_message");
  const conv = await loadConversation(ctx, convId);
  const [c] = await db.select().from(contact).where(eq(contact.id, conv.contactId));
  await deliverOutbound({
    orgId: ctx.orgId,
    conversationId: convId,
    toWaId: c!.waId,
    text: text.slice(0, 2000),
    via: "agent",
    authorId: ctx.userId,
  });
  await db.update(conversation).set({ unreadCount: 0 }).where(eq(conversation.id, convId));
  return { ok: true };
}

export async function addNote(ctx: AppCtx, convId: string, body: string) {
  const text = body.trim();
  if (!text) throw new ActionError("empty_message");
  await loadConversation(ctx, convId);
  await db.insert(message).values({
    orgId: ctx.orgId,
    conversationId: convId,
    direction: "internal",
    via: "note",
    body: text.slice(0, 2000),
    status: "sent",
    authorId: ctx.userId,
  });
  return { ok: true };
}

export async function assignConversation(ctx: AppCtx, convId: string, assigneeId: string | null) {
  await loadConversation(ctx, convId);
  if (assigneeId) {
    const [p] = await db
      .select()
      .from(profile)
      .where(and(eq(profile.id, assigneeId), eq(profile.orgId, ctx.orgId)));
    if (!p) throw new ActionError("not_found");
  }
  await db.update(conversation).set({ assigneeId }).where(eq(conversation.id, convId));
  return { ok: true };
}

export async function setConversationStatus(
  ctx: AppCtx,
  convId: string,
  status: "open" | "pending" | "closed",
) {
  await loadConversation(ctx, convId);
  await db.update(conversation).set({ status }).where(eq(conversation.id, convId));
  return { ok: true };
}

export async function toggleAutopilot(ctx: AppCtx, convId: string, on: boolean) {
  await loadConversation(ctx, convId);
  await db.update(conversation).set({ aiAutopilot: on }).where(eq(conversation.id, convId));
  return { ok: true };
}

export async function markRead(ctx: AppCtx, convId: string) {
  await loadConversation(ctx, convId);
  await db.update(conversation).set({ unreadCount: 0 }).where(eq(conversation.id, convId));
  return { ok: true };
}

async function loadHistory(convId: string): Promise<HistoryMsg[]> {
  return (await db
    .select({ direction: message.direction, body: message.body })
    .from(message)
    .where(eq(message.conversationId, convId))
    .orderBy(asc(message.createdAt))) as HistoryMsg[];
}

export async function aiSuggest(ctx: AppCtx, convId: string): Promise<{ text: string }> {
  const conv = await loadConversation(ctx, convId);
  await enforceDailyCap(ctx.orgId);
  const [orgRow] = await db.select().from(org).where(eq(org.id, ctx.orgId));
  const [c] = await db.select().from(contact).where(eq(contact.id, conv.contactId));
  const history = await loadHistory(convId);
  return suggestReply({
    persona: orgRow!.persona,
    contactName: c!.name,
    contactLocale: c!.locale,
    contactMemory: c!.memory,
    history,
  });
}

export async function aiSummarize(ctx: AppCtx, convId: string): Promise<EnrichResult> {
  const conv = await loadConversation(ctx, convId);
  await enforceDailyCap(ctx.orgId);
  const [c] = await db.select().from(contact).where(eq(contact.id, conv.contactId));
  const stages = await db
    .select({ name: pipelineStage.name })
    .from(pipelineStage)
    .where(eq(pipelineStage.orgId, ctx.orgId));
  const history = await loadHistory(convId);
  const result = await summarizeAndEnrich({
    contactName: c!.name,
    stageNames: stages.map((s) => s.name),
    history,
  });
  if (result.memory) {
    await db.update(contact).set({ memory: result.memory }).where(eq(contact.id, conv.contactId));
  }
  return result;
}

export async function inboxCounts(ctx: AppCtx) {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      mine: sql<number>`count(*) filter (where ${conversation.assigneeId} = ${ctx.userId})::int`,
      unassigned: sql<number>`count(*) filter (where ${conversation.assigneeId} is null)::int`,
      unread: sql<number>`coalesce(sum(${conversation.unreadCount}), 0)::int`,
    })
    .from(conversation)
    .where(eq(conversation.orgId, ctx.orgId));
  return row ?? { all: 0, mine: 0, unassigned: 0, unread: 0 };
}
