"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatRelative } from "@/lib/format";
import type { ContactListItem } from "@/lib/data/contacts";
import { contactsCsvAction, listContactsAction } from "@/app/(app)/actions";

export function ContactsClient({ initial }: { initial: ContactListItem[] }) {
  const t = useTranslations("contacts");
  const tInbox = useTranslations("inbox");
  const terr = useTranslations("errors");
  const locale = useLocale();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactListItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await listContactsAction(query.trim() || undefined);
        setContacts(rows);
      } catch {
        toast(terr("generic"), "error");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, terr, toast]);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await contactsCsvAction();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contacts.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast(terr("generic"), "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Spinner /> : <Download className="h-4 w-4" />}
            {t("exportCsv")}
          </Button>
        </header>

        <div className="relative mt-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Spinner />
            </span>
          )}
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface">
          {contacts.length === 0 ? (
            <EmptyState icon={Users} title={t("empty")} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t("name")}</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">{t("whatsapp")}</th>
                  <th className="px-4 py-3 font-medium">{t("stage")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("value")}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">{t("tags")}</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">
                    {t("lastContact")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="flex items-center gap-2.5 font-medium text-foreground hover:text-brand"
                      >
                        <Avatar name={c.name} size="sm" />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.waId}</td>
                    <td className="px-4 py-3">
                      {c.stageName ? (
                        <Badge>{c.stageName}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{tInbox("noStage")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatMoney(c.valueCents, locale)}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {c.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("none")}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
                      {formatRelative(c.lastContactAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
