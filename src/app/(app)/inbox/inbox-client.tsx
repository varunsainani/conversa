"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox as InboxIcon } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ConversationDetail,
  ConversationListItem,
  InboxFilter,
  ThreadMessage,
} from "@/lib/data/inbox";
import type { EnrichResult } from "@/lib/ai";
import * as A from "@/app/(app)/actions";
import { ConversationList } from "./conversation-list";
import { Thread } from "./thread";
import { ContextPanel } from "./context-panel";

type Team = { id: string; name: string }[];
type Stages = { id: string; name: string; color: string }[];
type Templates = { id: string; title: string; body: string }[];

export function InboxClient({
  meId,
  initialConversations,
  team,
  stages,
  templates,
}: {
  meId: string;
  initialConversations: ConversationListItem[];
  team: Team;
  stages: Stages;
  templates: Templates;
}) {
  const t = useTranslations("inbox");
  const terr = useTranslations("errors");
  const { toast } = useToast();

  const [filter, setFilter] = useState<InboxFilter>({ box: "all", q: "" });
  const [conversations, setConversations] = useState(initialConversations);
  const [counts, setCounts] = useState({ all: 0, mine: 0, unassigned: 0, unread: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [summary, setSummary] = useState<EnrichResult | null>(null);
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;

  const refreshList = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([A.listConversationsAction(filter), A.inboxCountsAction()]);
      setConversations(list);
      setCounts(c);
    } catch {
      /* ignore transient */
    }
  }, [filter]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const openConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    setSummary(null);
    try {
      const [d, m] = await Promise.all([A.getConversationAction(id), A.getMessagesAction(id)]);
      setDetail(d);
      setMessages(m);
      await A.markReadAction(id);
      refreshList();
    } catch {
      toast(terr("generic"), "error");
    }
  }, [refreshList, terr, toast]);

  // Load the initially-selected conversation once.
  useEffect(() => {
    if (selectedId) openConversation(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRealtime = useCallback(() => {
    // Coalesce bursts of realtime events (one send writes several rows) into a
    // single refresh so we don't fan out a dozen refetches per change.
    if (rtTimer.current) clearTimeout(rtTimer.current);
    rtTimer.current = setTimeout(() => {
      refreshList();
      const id = selectedRef.current;
      if (id) {
        A.getMessagesAction(id).then(setMessages).catch(() => {});
        A.getConversationAction(id).then(setDetail).catch(() => {});
      }
    }, 400);
  }, [refreshList]);
  useRealtime(["message", "conversation", "contact"], onRealtime);

  async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch {
      toast(terr("generic"), "error");
      return null;
    }
  }

  async function handleSend(text: string) {
    if (!selectedId || !text.trim()) return;
    const r = await guard(() => A.sendMessageAction(selectedId, text.trim()));
    if (r) {
      const m = await A.getMessagesAction(selectedId);
      setMessages(m);
      refreshList();
    }
  }

  async function handleNote(text: string) {
    if (!selectedId || !text.trim()) return;
    const r = await guard(() => A.addNoteAction(selectedId, text.trim()));
    if (r) {
      toast(t("noteAdded"));
      const m = await A.getMessagesAction(selectedId);
      setMessages(m);
    }
  }

  async function handleAiSuggest(): Promise<string> {
    if (!selectedId) return "";
    const r = await guard(() => A.aiSuggestAction(selectedId));
    return r?.text ?? "";
  }

  async function handleSummarize() {
    if (!selectedId) return;
    const r = await guard(() => A.aiSummarizeAction(selectedId));
    if (r) {
      setSummary(r);
      toast(t("memoryUpdated"));
      A.getConversationAction(selectedId).then(setDetail).catch(() => {});
    }
  }

  async function handleAssign(assigneeId: string | null) {
    if (!selectedId) return;
    await guard(() => A.assignConversationAction(selectedId, assigneeId));
    openConversation(selectedId);
  }

  async function handleStatus(status: "open" | "pending" | "closed") {
    if (!selectedId) return;
    await guard(() => A.setConversationStatusAction(selectedId, status));
    openConversation(selectedId);
  }

  async function handleAutopilot(on: boolean) {
    if (!selectedId) return;
    await guard(() => A.toggleAutopilotAction(selectedId, on));
    A.getConversationAction(selectedId).then(setDetail).catch(() => {});
  }

  async function handleMoveStage(stageId: string) {
    if (!detail) return;
    const r = await guard(() => A.moveContactStageAction(detail.contact.id, stageId));
    if (r && selectedId) openConversation(selectedId);
  }

  async function handleAddTag(tag: string) {
    if (!detail) return;
    const next = Array.from(new Set([...detail.contact.tags, tag]));
    await guard(() => A.updateContactAction(detail.contact.id, { tags: next }));
    if (selectedId) openConversation(selectedId);
  }

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        counts={counts}
        filter={filter}
        selectedId={selectedId}
        meId={meId}
        onFilter={setFilter}
        onSelect={openConversation}
      />

      {selectedId && detail ? (
        <Thread
          key={selectedId}
          detail={detail}
          messages={messages}
          templates={templates}
          onSend={handleSend}
          onAddNote={handleNote}
          onAiSuggest={handleAiSuggest}
          onSummarize={handleSummarize}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={InboxIcon}
            title={t("selectConversation")}
            description={t("selectConversationHint")}
          />
        </div>
      )}

      {detail && (
        <ContextPanel
          detail={detail}
          team={team}
          stages={stages}
          summary={summary}
          onAssign={handleAssign}
          onStatus={handleStatus}
          onAutopilot={handleAutopilot}
          onMoveStage={handleMoveStage}
          onAddTag={handleAddTag}
        />
      )}
    </div>
  );
}
