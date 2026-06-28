"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, FileText, Loader2, Send, Sparkles, StickyNote } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationDetail, ThreadMessage } from "@/lib/data/inbox";

type Templates = { id: string; title: string; body: string }[];

function MessageBubble({ m, locale, aiLabel, noteLabel }: { m: ThreadMessage; locale: string; aiLabel: string; noteLabel: string }) {
  if (m.direction === "internal") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-lg border border-signal/30 bg-signal-soft/50 px-3 py-2 text-sm text-foreground">
          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-signal">
            <StickyNote className="h-3 w-3" />
            {noteLabel}
            {m.authorName ? ` · ${m.authorName}` : ""}
          </div>
          {m.body}
          <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
            {formatTime(m.createdAt, locale)}
          </div>
        </div>
      </div>
    );
  }
  const isOut = m.direction === "outbound";
  const isAi = m.via === "ai";
  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
          isOut
            ? isAi
              ? "rounded-tr-sm bg-brand-soft text-foreground"
              : "rounded-tr-sm bg-brand text-brand-foreground"
            : "rounded-tl-sm bg-surface-2 text-foreground",
        )}
      >
        {isAi && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-brand">
            <Bot className="h-3 w-3" />
            {aiLabel}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <div
          className={cn(
            "mt-0.5 text-right text-[10px]",
            isOut && !isAi ? "text-brand-foreground/70" : "text-muted-foreground",
          )}
        >
          {m.authorName && !isAi ? `${m.authorName} · ` : ""}
          {formatTime(m.createdAt, locale)}
        </div>
      </div>
    </div>
  );
}

export function Thread({
  detail,
  messages,
  templates,
  onSend,
  onAddNote,
  onAiSuggest,
  onSummarize,
}: {
  detail: ConversationDetail;
  messages: ThreadMessage[];
  templates: Templates;
  onSend: (text: string) => Promise<void>;
  onAddNote: (text: string) => Promise<void>;
  onAiSuggest: () => Promise<string>;
  onSummarize: () => Promise<void>;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [aiBusy, setAiBusy] = useState(false);
  const [sumBusy, setSumBusy] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draft, setDraft] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, detail.id]);

  async function submit() {
    const v = text.trim();
    if (!v) return;
    setText("");
    setDraft(false);
    if (mode === "note") await onAddNote(v);
    else await onSend(v);
  }

  async function suggest() {
    setAiBusy(true);
    const s = await onAiSuggest();
    setAiBusy(false);
    if (s) {
      setMode("reply");
      setText(s);
      setDraft(true);
    }
  }

  async function summarize() {
    setSumBusy(true);
    await onSummarize();
    setSumBusy(false);
  }

  const tabCls = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2",
    );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={detail.contact.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{detail.contact.name}</p>
            <p className="truncate text-xs text-muted-foreground">{detail.contact.waId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail.aiAutopilot && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">
              <Bot className="h-3.5 w-3.5" />
              {t("autopilot")}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={summarize} disabled={sumBusy}>
            {sumBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("summarize")}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              locale={locale}
              aiLabel={t("aiLabel")}
              noteLabel={t("noteLabel")}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <button onClick={() => setMode("reply")} className={tabCls(mode === "reply")}>
            {t("send")}
          </button>
          <button onClick={() => setMode("note")} className={tabCls(mode === "note")}>
            <StickyNote className="h-3.5 w-3.5" />
            {t("notes")}
          </button>
          {templates.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowTemplates((v) => !v)} className={tabCls(false)}>
                <FileText className="h-3.5 w-3.5" />
                {t("templates")}
              </button>
              {showTemplates && (
                <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setText(tpl.body);
                        setMode("reply");
                        setShowTemplates(false);
                      }}
                      className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                    >
                      <span className="font-medium text-foreground">{tpl.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{tpl.body}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={suggest}
            disabled={aiBusy}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft/70 disabled:opacity-60"
          >
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiBusy ? t("aiSuggesting") : t("aiSuggest")}
          </button>
        </div>

        {draft && (
          <div className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-medium text-brand">
            <Sparkles className="h-3 w-3" />
            {t("aiDraftLabel")}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (draft) setDraft(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={mode === "note" ? t("notePlaceholder") : t("composerPlaceholder")}
            className={cn(
              "flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === "note" ? "border-signal/40 bg-signal-soft/30" : "border-border bg-background",
            )}
          />
          <Button onClick={submit} className="h-10 w-10 p-0" aria-label={mode === "note" ? t("addNote") : t("send")}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
