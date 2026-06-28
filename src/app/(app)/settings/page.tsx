import {
  getMe,
  getOrgSettingsAction,
  listChannelsAction,
  listStagesAction,
  listTagsAction,
  listTeamAction,
  listTemplatesAction,
} from "@/app/(app)/actions";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [me, org, team, channels, stages, tags, templates] = await Promise.all([
    getMe(),
    getOrgSettingsAction(),
    listTeamAction(),
    listChannelsAction(),
    listStagesAction(),
    listTagsAction(),
    listTemplatesAction(),
  ]);

  return (
    <SettingsClient
      me={{ id: me.id, role: me.role }}
      org={{ name: org.name, persona: org.persona, autopilotDefault: org.autopilotDefault }}
      team={team.map((m) => ({ id: m.id, fullName: m.fullName, email: m.email, role: m.role }))}
      channels={channels.map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        phoneDisplay: c.phoneDisplay,
        status: c.status,
      }))}
      stages={stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        sort: s.sort,
        isWon: s.isWon,
        isLost: s.isLost,
      }))}
      tags={tags.map((tg) => ({ id: tg.id, name: tg.name, color: tg.color }))}
      templates={templates.map((tpl) => ({ id: tpl.id, title: tpl.title, body: tpl.body }))}
    />
  );
}
