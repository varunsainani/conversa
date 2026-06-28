"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Columns3,
  ExternalLink,
  FileText,
  Lock,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import * as A from "@/app/(app)/actions";

type Role = "ADMIN" | "AGENT";
type Member = { id: string; fullName: string; email: string; role: Role };
type Channel = {
  id: string;
  kind: "simulator" | "cloud";
  name: string;
  phoneDisplay: string;
  status: "connected" | "disconnected";
};
type Stage = { id: string; name: string; color: string; sort: number; isWon: boolean; isLost: boolean };
type Tag = { id: string; name: string; color: string };
type Template = { id: string; title: string; body: string };
type Org = { name: string; persona: string; autopilotDefault: boolean };

const WON_COLOR = "#0b9c6e";
const LOST_COLOR = "#d6453f";

// Shared error/success guard for mutating actions (writes throw for non-admins).
function useGuard() {
  const { toast } = useToast();
  const terr = useTranslations("errors");
  return async function guard(fn: () => Promise<unknown>, okMsg?: string): Promise<boolean> {
    try {
      await fn();
      if (okMsg) toast(okMsg);
      return true;
    } catch {
      toast(terr("generic"), "error");
      return false;
    }
  };
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="relative h-4 w-8 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-3 before:w-3 before:rounded-full before:bg-white before:transition-transform checked:bg-brand checked:before:translate-x-4 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function ColorInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <input
      type="color"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

// ---- General / AI ----

function GeneralPanel({ org, isAdmin }: { org: Org; isAdmin: boolean }) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [name, setName] = useState(org.name);
  const [persona, setPersona] = useState(org.persona);
  const [autopilot, setAutopilot] = useState(org.autopilotDefault);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await guard(
      () => A.updateAiSettingsAction({ name, persona, autopilotDefault: autopilot }),
      t("saved"),
    );
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tabGeneral")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{t("orgName")}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">{t("aiPersona")}</label>
          <Textarea
            rows={5}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            disabled={!isAdmin}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t("aiPersonaHint")}</p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("autopilotDefault")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("autopilotHint")}</p>
          </div>
          <Switch
            checked={autopilot}
            onChange={setAutopilot}
            disabled={!isAdmin}
            label={t("autopilotDefault")}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!isAdmin || busy}>
            {busy && <Spinner />}
            {t("save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ---- Team ----

function TeamPanel({
  me,
  initial,
  isAdmin,
}: {
  me: { id: string; role: Role };
  initial: Member[];
  isAdmin: boolean;
}) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [members, setMembers] = useState<Member[]>(initial);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("AGENT");
  const [busy, setBusy] = useState(false);

  const reload = () => A.listTeamAction().then(setMembers).catch(() => {});

  async function changeRole(id: string, next: Role) {
    const ok = await guard(() => A.updateMemberAction(id, { role: next }));
    if (ok) reload();
  }

  async function remove(id: string) {
    if (!window.confirm(t("confirmRemove"))) return;
    const ok = await guard(() => A.removeMemberAction(id), t("removed"));
    if (ok) reload();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const ok = await guard(
      () => A.inviteMemberAction(email.trim(), role, fullName.trim() || undefined),
      t("invited"),
    );
    setBusy(false);
    if (ok) {
      setEmail("");
      setFullName("");
      setRole("AGENT");
      reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("teamTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const isMe = m.id === me.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={m.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {m.fullName}
                    {isMe && <Badge color={WON_COLOR}>{t("you")}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>

                {isAdmin ? (
                  <div className="w-32">
                    <Select
                      value={m.role}
                      aria-label={t("role")}
                      onChange={(e) => changeRole(m.id, e.target.value as Role)}
                    >
                      <option value="ADMIN">{t("admin")}</option>
                      <option value="AGENT">{t("agent")}</option>
                    </Select>
                  </div>
                ) : (
                  <Badge>{m.role === "ADMIN" ? t("admin") : t("agent")}</Badge>
                )}

                {isAdmin && !isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove")}
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {isAdmin && (
          <form onSubmit={invite} className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
            <p className="text-sm font-medium text-foreground">{t("invite")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="email"
                placeholder={t("inviteEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                placeholder={t("inviteName")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Select value={role} aria-label={t("role")} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="AGENT">{t("agent")}</option>
                <option value="ADMIN">{t("admin")}</option>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
                {t("invite")}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

// ---- Channels ----

function ChannelRow({
  ch,
  isAdmin,
  onChanged,
}: {
  ch: Channel;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [name, setName] = useState(ch.name);
  const [phone, setPhone] = useState(ch.phoneDisplay);
  const [status, setStatus] = useState(ch.status);
  const [busy, setBusy] = useState(false);

  const dirty = name !== ch.name || phone !== ch.phoneDisplay || status !== ch.status;

  async function save() {
    setBusy(true);
    const ok = await guard(
      () => A.updateChannelAction(ch.id, { name, phoneDisplay: phone, status }),
      t("saved"),
    );
    setBusy(false);
    if (ok) onChanged();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge color={ch.kind === "cloud" ? "#2f6df0" : "#586567"}>
          {ch.kind === "cloud" ? t("cloud") : t("simulator")}
        </Badge>
        <Badge color={status === "connected" ? WON_COLOR : LOST_COLOR}>
          {status === "connected" ? t("connected") : t("disconnected")}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("channelName")}
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("channelNumber")}
          </label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isAdmin} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t("channelStatus")}
          </label>
          <Select
            value={status}
            aria-label={t("channelStatus")}
            disabled={!isAdmin}
            onChange={(e) => setStatus(e.target.value as Channel["status"])}
          >
            <option value="connected">{t("connected")}</option>
            <option value="disconnected">{t("disconnected")}</option>
          </Select>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty || busy}>
            {busy && <Spinner />}
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChannelsPanel({ initial, isAdmin }: { initial: Channel[]; isAdmin: boolean }) {
  const t = useTranslations("settings");
  const [channels, setChannels] = useState<Channel[]>(initial);
  const reload = () => A.listChannelsAction().then(setChannels).catch(() => {});

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>{t("channelsTitle")}</CardTitle>
        <Link
          href="/sim"
          target="_blank"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          <ExternalLink className="h-4 w-4" />
          {t("openSim")}
        </Link>
      </CardHeader>
      <CardBody className="space-y-3">
        {channels.map((ch) => (
          <ChannelRow key={ch.id} ch={ch} isAdmin={isAdmin} onChanged={reload} />
        ))}
      </CardBody>
    </Card>
  );
}

// ---- Pipeline stages ----

function StageRow({
  stage,
  isAdmin,
  onChanged,
}: {
  stage: Stage;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [busy, setBusy] = useState(false);

  const dirty = name !== stage.name || color !== stage.color;

  async function save() {
    setBusy(true);
    const ok = await guard(() => A.updateStageAction(stage.id, { name, color }), t("saved"));
    setBusy(false);
    if (ok) onChanged();
  }

  async function remove() {
    setBusy(true);
    const ok = await guard(() => A.deleteStageAction(stage.id));
    setBusy(false);
    if (ok) onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
      <ColorInput value={color} onChange={setColor} disabled={!isAdmin} label={t("color")} />
      <Input
        className="min-w-40 flex-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={!isAdmin}
        aria-label={t("stageName")}
      />
      {stage.isWon && <Badge color={WON_COLOR}>{t("won")}</Badge>}
      {stage.isLost && <Badge color={LOST_COLOR}>{t("lost")}</Badge>}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!dirty || busy}>
            {busy && <Spinner />}
            {t("save")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StagesPanel({ initial, isAdmin }: { initial: Stage[]; isAdmin: boolean }) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [stages, setStages] = useState<Stage[]>(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState(WON_COLOR);
  const [busy, setBusy] = useState(false);

  const reload = () => A.listStagesAction().then(setStages).catch(() => {});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await guard(() => A.createStageAction(name.trim(), color));
    setBusy(false);
    if (ok) {
      setName("");
      setColor(WON_COLOR);
      reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stagesTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {stages.map((s) => (
          <StageRow key={s.id} stage={s} isAdmin={isAdmin} onChanged={reload} />
        ))}

        {isAdmin && (
          <form onSubmit={add} className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <ColorInput value={color} onChange={setColor} label={t("color")} />
            <Input
              className="min-w-40 flex-1"
              placeholder={t("stageName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
              {t("addStage")}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

// ---- Tags ----

function TagsPanel({ initial, isAdmin }: { initial: Tag[]; isAdmin: boolean }) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [tags, setTags] = useState<Tag[]>(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#586567");
  const [busy, setBusy] = useState(false);

  const reload = () => A.listTagsAction().then(setTags).catch(() => {});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await guard(() => A.createTagAction(name.trim(), color));
    setBusy(false);
    if (ok) {
      setName("");
      reload();
    }
  }

  async function remove(id: string) {
    const ok = await guard(() => A.deleteTagAction(id));
    if (ok) reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tagsTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tg) => (
              <span
                key={tg.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  color: tg.color,
                  backgroundColor: `color-mix(in srgb, ${tg.color} 14%, transparent)`,
                }}
              >
                {tg.name}
                {isAdmin && (
                  <button
                    type="button"
                    aria-label={t("delete")}
                    onClick={() => remove(tg.id)}
                    className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}

        {isAdmin && (
          <form onSubmit={add} className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <ColorInput value={color} onChange={setColor} label={t("color")} />
            <Input
              className="min-w-40 flex-1"
              placeholder={t("tagName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
              {t("addTag")}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

// ---- Templates ----

function TemplateRow({
  tpl,
  isAdmin,
  onChanged,
}: {
  tpl: Template;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(tpl.title);
  const [body, setBody] = useState(tpl.body);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const ok = await guard(() => A.updateTemplateAction(tpl.id, { title, body }), t("saved"));
    setBusy(false);
    if (ok) {
      setEditing(false);
      onChanged();
    }
  }

  async function remove() {
    setBusy(true);
    const ok = await guard(() => A.deleteTemplateAction(tpl.id));
    setBusy(false);
    if (ok) onChanged();
  }

  function cancel() {
    setTitle(tpl.title);
    setBody(tpl.body);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("templateTitle")} />
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label={t("templateBody")}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Spinner />}
            {t("save")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{tpl.title}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{tpl.body}</p>
      </div>
      {isAdmin && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("edit")} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("delete")} onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      )}
    </div>
  );
}

function TemplatesPanel({ initial, isAdmin }: { initial: Template[]; isAdmin: boolean }) {
  const t = useTranslations("settings");
  const guard = useGuard();
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => A.listTemplatesAction().then(setTemplates).catch(() => {});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const ok = await guard(() => A.createTemplateAction(title.trim(), body.trim()));
    setBusy(false);
    if (ok) {
      setTitle("");
      setBody("");
      reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("templatesTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {templates.map((tpl) => (
          <TemplateRow key={tpl.id} tpl={tpl} isAdmin={isAdmin} onChanged={reload} />
        ))}

        {isAdmin && (
          <form onSubmit={add} className="space-y-3 border-t border-border pt-4">
            <Input
              placeholder={t("templateTitle")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Textarea
              rows={3}
              placeholder={t("templateBody")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
                {t("addTemplate")}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

// ---- Shell ----

type TabKey = "general" | "team" | "channels" | "stages" | "tags" | "templates";

export function SettingsClient({
  me,
  org,
  team,
  channels,
  stages,
  tags,
  templates,
}: {
  me: { id: string; role: Role };
  org: Org;
  team: Member[];
  channels: Channel[];
  stages: Stage[];
  tags: Tag[];
  templates: Template[];
}) {
  const t = useTranslations("settings");
  const isAdmin = me.role === "ADMIN";
  const [tab, setTab] = useState<TabKey>("general");

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "general", label: t("tabGeneral"), icon: Sparkles },
    { key: "team", label: t("tabTeam"), icon: Users },
    { key: "channels", label: t("tabChannels"), icon: Smartphone },
    { key: "stages", label: t("tabStages"), icon: Columns3 },
    { key: "tags", label: t("tabTags"), icon: TagIcon },
    { key: "templates", label: t("tabTemplates"), icon: FileText },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>

        {!isAdmin && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            {t("adminOnly")}
          </div>
        )}

        <div className="mt-6 flex gap-1.5 overflow-x-auto border-b border-border pb-px">
          {tabs.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <tb.icon className="h-4 w-4" />
                {tb.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {tab === "general" && <GeneralPanel org={org} isAdmin={isAdmin} />}
          {tab === "team" && <TeamPanel me={me} initial={team} isAdmin={isAdmin} />}
          {tab === "channels" && <ChannelsPanel initial={channels} isAdmin={isAdmin} />}
          {tab === "stages" && <StagesPanel initial={stages} isAdmin={isAdmin} />}
          {tab === "tags" && <TagsPanel initial={tags} isAdmin={isAdmin} />}
          {tab === "templates" && <TemplatesPanel initial={templates} isAdmin={isAdmin} />}
        </div>
      </div>
    </div>
  );
}
