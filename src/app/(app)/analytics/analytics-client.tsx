"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  BarChart3,
  Bot,
  Mail,
  MessageSquare,
  TrendingUp,
  Trophy,
  Users,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import type { AnalyticsOverview } from "@/lib/data/analytics";

// Muted blue used elsewhere in the product for the secondary accent.
const OUTBOUND_COLOR = "#2f6df0";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-tight text-foreground">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

export function AnalyticsClient({ data }: { data: AnalyticsOverview }) {
  const t = useTranslations("analytics");
  const locale = useLocale();

  const stageMax = Math.max(1, ...data.leadsByStage.map((s) => s.count));
  const hasStageData = data.leadsByStage.some((s) => s.count > 0);

  const volMax = Math.max(1, ...data.messages14d.flatMap((d) => [d.inbound, d.outbound]));
  const hasVolume = data.messages14d.some((d) => d.inbound > 0 || d.outbound > 0);

  const barHeight = (v: number) => (v <= 0 ? 0 : Math.max((v / volMax) * 100, 4));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat icon={Users} label={t("totalContacts")} value={formatNumber(data.totalContacts, locale)} />
          <Stat
            icon={MessageSquare}
            label={t("openConversations")}
            value={formatNumber(data.openConversations, locale)}
          />
          <Stat
            icon={TrendingUp}
            label={t("pipelineValue")}
            value={formatMoney(data.pipelineValueCents, locale)}
          />
          <Stat
            icon={Trophy}
            label={t("won")}
            value={formatNumber(data.wonCount, locale)}
            sub={formatMoney(data.wonValueCents, locale)}
          />
          <Stat icon={Mail} label={t("unread")} value={formatNumber(data.unreadTotal, locale)} />
          <Stat icon={Bot} label={t("aiReplies")} value={formatNumber(data.aiRepliesToday, locale)} />
          <Stat icon={UserCircle2} label={t("team")} value={formatNumber(data.teamSize, locale)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("leadsByStage")}</CardTitle>
            </CardHeader>
            <CardBody>
              {hasStageData ? (
                <div className="space-y-4">
                  {data.leadsByStage.map((s) => (
                    <div key={s.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate text-foreground">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatNumber(s.count, locale)} · {formatMoney(s.valueCents, locale)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(s.count / stageMax) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={BarChart3} title={t("noData")} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{t("messageVolume")}</CardTitle>
              <span className="text-xs text-muted-foreground">{t("last14days")}</span>
            </CardHeader>
            <CardBody>
              {hasVolume ? (
                <>
                  <div className="mb-3 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
                      <span className="text-muted-foreground">{t("inbound")}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: OUTBOUND_COLOR }}
                      />
                      <span className="text-muted-foreground">{t("outbound")}</span>
                    </span>
                  </div>

                  <div className="flex h-48 items-end gap-1">
                    {data.messages14d.map((d) => (
                      <div
                        key={d.date}
                        title={`${formatDate(d.date, locale)} · ${t("inbound")}: ${d.inbound} · ${t("outbound")}: ${d.outbound}`}
                        className="flex h-full flex-1 items-end justify-center gap-0.5"
                      >
                        <div
                          className="w-2 rounded-t bg-brand"
                          style={{ height: `${barHeight(d.inbound)}%` }}
                        />
                        <div
                          className="w-2 rounded-t"
                          style={{
                            height: `${barHeight(d.outbound)}%`,
                            backgroundColor: OUTBOUND_COLOR,
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>{formatDate(data.messages14d[0]!.date, locale)}</span>
                    <span>{formatDate(data.messages14d[data.messages14d.length - 1]!.date, locale)}</span>
                  </div>
                </>
              ) : (
                <EmptyState icon={BarChart3} title={t("noData")} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
