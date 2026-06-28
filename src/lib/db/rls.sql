-- Conversa Row Level Security.
-- Server writes use the Postgres role (bypasses RLS) and scope by org in code.
-- These policies protect the client path (publishable key + user JWT) used for
-- realtime + reads, so a user can only ever see their own org's rows.

-- Helper: the caller's org id, derived from their profile.
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profile where id = auth.uid();
$$;

-- Enable RLS everywhere.
alter table public.org enable row level security;
alter table public.profile enable row level security;
alter table public.channel enable row level security;
alter table public.pipeline_stage enable row level security;
alter table public.tag enable row level security;
alter table public.contact enable row level security;
alter table public.conversation enable row level security;
alter table public.message enable row level security;
alter table public.template enable row level security;
alter table public.ai_usage enable row level security;
alter table public.webhook_event enable row level security;
alter table public.audit_log enable row level security;

-- org: read your own org.
drop policy if exists org_select on public.org;
create policy org_select on public.org for select to authenticated
  using (id = public.auth_org_id());

-- profile: read profiles in your org; update your own row.
drop policy if exists profile_select on public.profile;
create policy profile_select on public.profile for select to authenticated
  using (org_id = public.auth_org_id());
drop policy if exists profile_update_self on public.profile;
create policy profile_update_self on public.profile for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Org-scoped read policies for the client/realtime path.
drop policy if exists channel_select on public.channel;
create policy channel_select on public.channel for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists pipeline_stage_select on public.pipeline_stage;
create policy pipeline_stage_select on public.pipeline_stage for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists tag_select on public.tag;
create policy tag_select on public.tag for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists contact_select on public.contact;
create policy contact_select on public.contact for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists conversation_select on public.conversation;
create policy conversation_select on public.conversation for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists message_select on public.message;
create policy message_select on public.message for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists template_select on public.template;
create policy template_select on public.template for select to authenticated
  using (org_id = public.auth_org_id());

-- ai_usage, webhook_event, audit_log: RLS on, NO policies => not client-readable
-- (server role still has full access).

-- Realtime: publish the live tables and include full rows for filtering.
alter table public.conversation replica identity full;
alter table public.message replica identity full;
alter table public.contact replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.conversation;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.contact;
exception when duplicate_object then null; end $$;
