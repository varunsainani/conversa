"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireCtx } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import * as inbox from "@/lib/data/inbox";
import * as pipeline from "@/lib/data/pipeline";
import * as contacts from "@/lib/data/contacts";
import * as settings from "@/lib/data/settings";
import { analyticsOverview } from "@/lib/data/analytics";

// ---- Session ----

export async function getMe() {
  const ctx = await requireCtx();
  const org = await settings.getOrgSettings(ctx);
  return {
    id: ctx.userId,
    fullName: ctx.profile.fullName,
    email: ctx.profile.email,
    role: ctx.role,
    orgName: org.name,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---- Inbox ----

export async function listConversationsAction(filter: inbox.InboxFilter) {
  const ctx = await requireCtx();
  return inbox.listConversations(ctx, filter);
}
export async function inboxCountsAction() {
  return inbox.inboxCounts(await requireCtx());
}
export async function getConversationAction(id: string) {
  return inbox.getConversation(await requireCtx(), id);
}
export async function getMessagesAction(id: string) {
  return inbox.getMessages(await requireCtx(), id);
}
export async function sendMessageAction(id: string, body: string) {
  const r = await inbox.sendMessage(await requireCtx(), id, body);
  revalidatePath("/inbox");
  return r;
}
export async function addNoteAction(id: string, body: string) {
  return inbox.addNote(await requireCtx(), id, body);
}
export async function assignConversationAction(id: string, assigneeId: string | null) {
  const r = await inbox.assignConversation(await requireCtx(), id, assigneeId);
  revalidatePath("/inbox");
  return r;
}
export async function setConversationStatusAction(
  id: string,
  status: "open" | "pending" | "closed",
) {
  const r = await inbox.setConversationStatus(await requireCtx(), id, status);
  revalidatePath("/inbox");
  return r;
}
export async function toggleAutopilotAction(id: string, on: boolean) {
  return inbox.toggleAutopilot(await requireCtx(), id, on);
}
export async function markReadAction(id: string) {
  return inbox.markRead(await requireCtx(), id);
}
export async function aiSuggestAction(id: string) {
  return inbox.aiSuggest(await requireCtx(), id);
}
export async function aiSummarizeAction(id: string) {
  const r = await inbox.aiSummarize(await requireCtx(), id);
  revalidatePath("/inbox");
  return r;
}

// ---- Pipeline ----

export async function listPipelineAction() {
  return pipeline.listPipeline(await requireCtx());
}
export async function moveContactStageAction(contactId: string, stageId: string) {
  const r = await pipeline.moveContactStage(await requireCtx(), contactId, stageId);
  revalidatePath("/pipeline");
  return r;
}

// ---- Contacts ----

export async function listContactsAction(q?: string) {
  return contacts.listContacts(await requireCtx(), q);
}
export async function getContactAction(id: string) {
  return contacts.getContact(await requireCtx(), id);
}
export async function updateContactAction(id: string, patch: contacts.ContactPatch) {
  const r = await contacts.updateContact(await requireCtx(), id, patch);
  revalidatePath("/contacts");
  revalidatePath("/pipeline");
  return r;
}
export async function contactsCsvAction() {
  return contacts.contactsCsv(await requireCtx());
}

// ---- Settings (reads allow any member; writes require admin) ----

export async function listTeamAction() {
  return settings.listTeam(await requireCtx());
}
export async function inviteMemberAction(email: string, role: "ADMIN" | "AGENT", fullName?: string) {
  const r = await settings.inviteMember(await requireAdmin(), email, role, fullName);
  revalidatePath("/settings/team");
  return r;
}
export async function updateMemberAction(
  id: string,
  patch: { role?: "ADMIN" | "AGENT"; fullName?: string },
) {
  const r = await settings.updateMember(await requireAdmin(), id, patch);
  revalidatePath("/settings/team");
  return r;
}
export async function removeMemberAction(id: string) {
  const r = await settings.removeMember(await requireAdmin(), id);
  revalidatePath("/settings/team");
  return r;
}

export async function listChannelsAction() {
  return settings.listChannels(await requireCtx());
}
export async function updateChannelAction(
  id: string,
  patch: { name?: string; phoneDisplay?: string; status?: "connected" | "disconnected" },
) {
  return settings.updateChannel(await requireAdmin(), id, patch);
}

export async function listTagsAction() {
  return settings.listTags(await requireCtx());
}
export async function createTagAction(name: string, color: string) {
  return settings.createTag(await requireAdmin(), name, color);
}
export async function deleteTagAction(id: string) {
  return settings.deleteTag(await requireAdmin(), id);
}

export async function listStagesAction() {
  return settings.listStages(await requireCtx());
}
export async function createStageAction(name: string, color: string) {
  const r = await settings.createStage(await requireAdmin(), name, color);
  revalidatePath("/pipeline");
  return r;
}
export async function updateStageAction(id: string, patch: { name?: string; color?: string }) {
  const r = await settings.updateStage(await requireAdmin(), id, patch);
  revalidatePath("/pipeline");
  return r;
}
export async function deleteStageAction(id: string) {
  const r = await settings.deleteStage(await requireAdmin(), id);
  revalidatePath("/pipeline");
  return r;
}

export async function listTemplatesAction() {
  return settings.listTemplates(await requireCtx());
}
export async function createTemplateAction(title: string, body: string) {
  return settings.createTemplate(await requireAdmin(), title, body);
}
export async function updateTemplateAction(id: string, patch: { title?: string; body?: string }) {
  return settings.updateTemplate(await requireAdmin(), id, patch);
}
export async function deleteTemplateAction(id: string) {
  return settings.deleteTemplate(await requireAdmin(), id);
}

export async function getOrgSettingsAction() {
  return settings.getOrgSettings(await requireCtx());
}
export async function updateAiSettingsAction(patch: {
  persona?: string;
  autopilotDefault?: boolean;
  name?: string;
}) {
  return settings.updateAiSettings(await requireAdmin(), patch);
}

// ---- Analytics ----

export async function analyticsOverviewAction() {
  return analyticsOverview(await requireCtx());
}
