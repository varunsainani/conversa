"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bot, Inbox as InboxIcon, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationListItem, InboxFilter } from "@/lib/data/inbox";

export function ConversationList({
  conversations,
  counts,
  filter,
  selectedId,
  onFilter,
  onSelect,
}: {
  conversations: ConversationListItem[];
  counts: { all: number; mine: number; unassigned: number; unread: number };
  filter: InboxFilter;
  selectedId: string | null;
  meId: string;
  onFilter: (f: InboxFilter) => void;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();

  const tabs = [
    { key: "all" as const, label: t("all"), n: counts.all },
    { key: "mine" as const, label: t("mine"), n: counts.mine },
    { key: "unassigned" as const, label: t("unassigned"), n: counts.unassigned },
  ];

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border bg-surface">
      <div className="space-y-3 border-b border-border p-3">
        <h1 className="px-1 text-lg font-semibold text-foreground">{t("title")}</h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter.q ?? ""}
            onChange={(e) => onFilter({ ...filter, q: e.target.value })}
            placeholder={t("searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilter({ ...filter, box: tab.key })}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                filter.box === tab.key
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {tab.label}
              {tab.n > 0 && <span className="ml-1 opacity-70">{tab.n}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState icon={InboxIcon} title={t("empty")} description={t("emptyHint")} />
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors",
                selectedId === c.id ? "bg-surface-2" : "hover:bg-surface-2/60",
              )}
            >
              <Avatar name={c.contact.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{c.contact.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelative(c.lastMessageAt, locale)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.aiAutopilot && <Bot className="h-3.5 w-3.5 text-brand" />}
                    {c.unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-signal px-1.5 text-[11px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                {c.assignee && (
                  <span className="mt-1 inline-block text-[11px] text-muted-foreground">
                    {c.assignee.name}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
