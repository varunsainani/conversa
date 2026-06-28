import { requireCtx } from "@/lib/auth";
import { listConversations } from "@/lib/data/inbox";
import { listStages, listTeam, listTemplates } from "@/lib/data/settings";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const ctx = await requireCtx();
  const [conversations, team, stages, templates] = await Promise.all([
    listConversations(ctx, { box: "all" }),
    listTeam(ctx),
    listStages(ctx),
    listTemplates(ctx),
  ]);

  return (
    <InboxClient
      meId={ctx.userId}
      initialConversations={conversations}
      team={team.map((t) => ({ id: t.id, name: t.fullName }))}
      stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      templates={templates.map((t) => ({ id: t.id, title: t.title, body: t.body }))}
    />
  );
}
