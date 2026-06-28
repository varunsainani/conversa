"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { ContactDetail } from "@/lib/data/contacts";
import { updateContactAction } from "@/app/(app)/actions";

type Stage = { id: string; name: string; color: string };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ContactDetailClient({
  contact,
  stages,
}: {
  contact: ContactDetail;
  stages: Stage[];
}) {
  const t = useTranslations("contacts");
  const tInbox = useTranslations("inbox");
  const terr = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(contact.name);
  const [value, setValue] = useState(String(contact.valueCents / 100));
  const [stageId, setStageId] = useState(contact.stageId ?? "");
  const [tags, setTags] = useState(contact.tags.join(", "));
  const [memory, setMemory] = useState(contact.memory);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateContactAction(contact.id, {
        name: name.trim(),
        valueCents: Math.round((parseFloat(value) || 0) * 100),
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        stageId: stageId || null,
        memory,
      });
      toast(t("saved"));
      router.refresh();
    } catch {
      toast(terr("generic"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl p-6 lg:p-8">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={contact.name} size="lg" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{contact.name}</h1>
              <p className="text-sm text-muted-foreground">{contact.waId}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("addedOn", { date: formatDate(contact.createdAt, locale) })}
              </p>
            </div>
          </div>

          {contact.conversationId ? (
            <Button variant="secondary" size="sm" onClick={() => router.push("/inbox")}>
              <MessageSquare className="h-4 w-4" />
              {t("openConversation")}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t("noConversation")}</span>
          )}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("profile")}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label={t("name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("value")}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t("valuePlaceholder")}
                />
              </Field>

              <Field label={t("stage")}>
                <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  <option value="">{tInbox("noStage")}</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t("tags")}>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("tagsPlaceholder")}
              />
            </Field>

            <Field label={t("memory")} hint={t("memoryHint")}>
              <Textarea rows={4} value={memory} onChange={(e) => setMemory(e.target.value)} />
            </Field>

            <Field label={t("language")}>
              <p className="text-sm text-foreground">{contact.locale || t("none")}</p>
            </Field>

            <div className="flex justify-end pt-1">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Spinner />}
                {t("save")}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
