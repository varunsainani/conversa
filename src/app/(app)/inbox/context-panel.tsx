"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bot, ExternalLink, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationDetail } from "@/lib/data/inbox";
import type { EnrichResult } from "@/lib/ai";

type Team = { id: string; name: string }[];
type Stages = { id: string; name: string; color: string }[];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3.5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function ContextPanel({
  detail,
  team,
  stages,
  summary,
  onAssign,
  onStatus,
  onAutopilot,
  onMoveStage,
  onAddTag,
}: {
  detail: ConversationDetail;
  team: Team;
  stages: Stages;
  summary: EnrichResult | null;
  onAssign: (id: string | null) => void;
  onStatus: (s: "open" | "pending" | "closed") => void;
  onAutopilot: (on: boolean) => void;
  onMoveStage: (stageId: string) => void;
  onAddTag: (tag: string) => void;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const c = detail.contact;
  const statuses = ["open", "pending", "closed"] as const;

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface xl:flex">
      <div className="flex flex-col items-center border-b border-border px-4 py-5 text-center">
        <Avatar name={c.name} size="lg" />
        <h2 className="mt-2 font-semibold text-foreground">{c.name}</h2>
        <p className="text-xs text-muted-foreground">{c.waId}</p>
        <Link
          href={`/contacts/${c.id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          {t("viewProfile")}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <Section title={t("assign")}>
        <Select
          value={detail.assignee?.id ?? ""}
          onChange={(e) => onAssign(e.target.value || null)}
        >
          <option value="">{t("unassignedOption")}</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Section>

      <Section title={t("status")}>
        <div className="flex gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                detail.status === s
                  ? "bg-brand-soft text-brand"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              {t(s === "open" ? "markOpen" : s === "pending" ? "markPending" : "markClosed")}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("autopilot")}>
        <label className="flex cursor-pointer items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-foreground">
            <Bot className="h-4 w-4 text-brand" />
            {t("autopilot")}
          </span>
          <input
            type="checkbox"
            checked={detail.aiAutopilot}
            onChange={(e) => onAutopilot(e.target.checked)}
            className="h-4 w-8 cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors checked:bg-brand relative before:absolute before:left-0.5 before:top-0.5 before:h-3 before:w-3 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
          />
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("autopilotHint")}</p>
      </Section>

      <Section title={t("stage")}>
        <Select value={c.stageId ?? ""} onChange={(e) => onMoveStage(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Section>

      <Section title={t("value")}>
        <p className="text-lg font-semibold text-foreground">{formatMoney(c.valueCents, locale)}</p>
      </Section>

      <Section title={t("tags")}>
        {c.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {c.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </Section>

      <Section title={t("memory")}>
        <p className="text-sm text-muted-foreground">{c.memory || "—"}</p>
      </Section>

      {summary && (
        <div className="border-b border-border bg-brand-soft/30 px-4 py-3.5">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            {t("summary")}
          </p>
          <p className="text-sm text-foreground">{summary.summary}</p>
          {summary.suggestedTags.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                {t("suggestedTags")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.suggestedTags.map((tag) => (
                  <button key={tag} onClick={() => onAddTag(tag)}>
                    <Badge className="cursor-pointer hover:opacity-80" color="#0b9c6e">
                      + {tag}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
          {summary.suggestedStage && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                {t("suggestedStage")}
              </p>
              <button
                onClick={() => {
                  const s = stages.find((x) => x.name === summary.suggestedStage);
                  if (s) onMoveStage(s.id);
                }}
              >
                <Badge className="cursor-pointer hover:opacity-80" color="#2f6df0">
                  {summary.suggestedStage}
                </Badge>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
