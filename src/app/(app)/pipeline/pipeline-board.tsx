"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PipelineContact, PipelineStageDTO } from "@/lib/data/pipeline";
import { moveContactStageAction } from "@/app/(app)/actions";

type PipelineData = { stages: PipelineStageDTO[]; totalValueCents: number };

function recompute(stages: PipelineStageDTO[]): PipelineStageDTO[] {
  return stages.map((s) => ({
    ...s,
    valueCents: s.contacts.reduce((a, c) => a + c.valueCents, 0),
  }));
}

export function PipelineBoard({ initial }: { initial: PipelineData }) {
  const t = useTranslations("pipeline");
  const terr = useTranslations("errors");
  const locale = useLocale();
  const { toast } = useToast();

  const [stages, setStages] = useState<PipelineStageDTO[]>(initial.stages);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  const totalValueCents = stages.reduce((a, s) => a + s.valueCents, 0);

  async function handleDrop(targetStageId: string) {
    setDragOverStage(null);
    const contactId = draggingId.current;
    draggingId.current = null;
    if (!contactId) return;

    const source = stages.find((s) => s.contacts.some((c) => c.id === contactId));
    if (!source || source.id === targetStageId) return;
    const card = source.contacts.find((c) => c.id === contactId);
    const target = stages.find((s) => s.id === targetStageId);
    if (!card || !target) return;

    const previous = stages;
    const next = recompute(
      stages.map((s) => {
        if (s.id === source.id) {
          return { ...s, contacts: s.contacts.filter((c) => c.id !== contactId) };
        }
        if (s.id === targetStageId) {
          return { ...s, contacts: [card, ...s.contacts] };
        }
        return s;
      }),
    );
    setStages(next);

    try {
      await moveContactStageAction(contactId, targetStageId);
      toast(t("movedTo", { stage: target.name }));
    } catch {
      setStages(previous);
      toast(terr("generic"), "error");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("totalValue")}
            </p>
            <p className="text-lg font-semibold text-foreground">
              {formatMoney(totalValueCents, locale)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex h-full min-h-0 flex-1 gap-4 overflow-x-auto p-6">
        {stages.map((stage) => (
          <section
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverStage !== stage.id) setDragOverStage(stage.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null);
            }}
            onDrop={() => handleDrop(stage.id)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-surface transition-colors",
              dragOverStage === stage.id ? "border-brand bg-brand-soft/30" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="truncate text-sm font-semibold text-foreground">{stage.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("leads", { count: stage.contacts.length })}
                </span>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {formatMoney(stage.valueCents, locale)}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {stage.contacts.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">{t("empty")}</p>
              ) : (
                stage.contacts.map((c) => (
                  <PipelineCard
                    key={c.id}
                    contact={c}
                    locale={locale}
                    onDragStart={() => {
                      draggingId.current = c.id;
                    }}
                    onDragEnd={() => {
                      draggingId.current = null;
                      setDragOverStage(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PipelineCard({
  contact,
  locale,
  onDragStart,
  onDragEnd,
}: {
  contact: PipelineContact;
  locale: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", contact.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-lg border border-border bg-background p-3 shadow-sm transition-colors hover:border-border-strong active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <Avatar name={contact.name} size="sm" />
        <Link
          href={`/contacts/${contact.id}`}
          draggable={false}
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-brand hover:underline"
        >
          {contact.name}
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {formatMoney(contact.valueCents, locale)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatRelative(contact.lastContactAt, locale)}
        </span>
      </div>

      {contact.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {contact.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
