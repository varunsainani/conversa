# Conversa — Build Contract (SPEC)

Source of truth for the build. Conversa is an AI WhatsApp inbox + CRM built as a
single Next.js (App Router) full-stack app on Supabase (Auth + Realtime +
Storage + RLS) with Drizzle for typed server queries. LLM active = Groq;
WhatsApp active = simulator. Trilingual EN/ES/PT. Graphite + emerald design.

## Architecture rules

- **Data writes + AI + WhatsApp** run server-side only: Next.js **server actions**
  (`"use server"`) and **route handlers**, using **Drizzle** over the Postgres
  connection (`@/lib/db`). The Postgres role bypasses RLS, so EVERY server query
  MUST scope by the caller's `orgId` explicitly (never trust a client-supplied
  orgId).
- **Client realtime + auth** use `supabase-js` (publishable key + user session),
  which IS RLS-enforced. RLS SELECT policies let a user read only their org's rows.
- Secrets (`SUPABASE_SECRET_KEY`, `GROQ_API_KEY`, WhatsApp tokens) are read only in
  server files via `@/lib/server-env`. Never import `server-env` into a client
  component.
- Money is integer cents (`bigint`). Never trust the LLM for arithmetic.
- All user-facing strings come from next-intl messages (EN/ES/PT). No hardcoded copy.

## Identity & roles

- Supabase Auth (email/password). `profile.id == auth.users.id`.
- One demo org ("Aurora Studio") with users: `admin@conversa.app` (ADMIN),
  `agent@conversa.app` (AGENT), plus a second agent `maria@conversa.app` (AGENT).
  Password `demo1234`. One-click demo buttons sign in as admin or agent.
- Roles: ADMIN (everything incl. settings/team) and AGENT (inbox, pipeline,
  contacts; no team/channel settings).

## Data model (Drizzle, `src/lib/db/schema.ts`, all in `public`)

- **org**: id uuid pk, name text, createdAt.
- **profile**: id uuid pk (=auth user), orgId fk, role text(ADMIN|AGENT),
  fullName text, avatarUrl text, createdAt.
- **channel**: id, orgId, kind text(simulator|cloud), name, phoneDisplay,
  status text(connected|disconnected), config jsonb, createdAt.
- **pipelineStage**: id, orgId, name, sort int, color text, isWon bool, isLost
  bool, createdAt.
- **tag**: id, orgId, name, color, createdAt.
- **contact** (the lead): id, orgId, waId text, name, avatarUrl, locale,
  stageId fk pipelineStage null, valueCents bigint default 0, tags text[]
  default '{}', customFields jsonb default '{}', memory text default '',
  createdAt, lastContactAt. unique(orgId, waId).
- **conversation**: id, orgId, contactId fk, channelId fk, status
  text(open|pending|closed) default open, assigneeId fk profile null,
  aiAutopilot bool default false, lastMessagePreview text, lastMessageAt,
  unreadCount int default 0, createdAt.
- **message**: id, orgId, conversationId fk, direction
  text(inbound|outbound|internal), via text(customer|agent|ai|system|note),
  type text default 'text', body text, mediaUrl text null, waMessageId text null,
  status text(received|sent|delivered|read|failed) default sent, authorId fk
  profile null, createdAt. (Internal notes = direction 'internal', via 'note'.)
- **template**: id, orgId, title, body, createdAt.
- **aiUsage**: id, orgId, day date, count int default 0. unique(orgId, day).
- **webhookEvent**: id, provider text, externalId text, orgId null, payload
  jsonb, createdAt. unique(provider, externalId) for idempotency.
- **auditLog**: id, orgId, actorId null, action text, target text, meta jsonb,
  createdAt.

## RLS (`src/lib/db/rls.sql`, applied by `npm run db:rls`)

- Helper `public.auth_org_id()` (sql, stable, security definer): returns the
  caller's `profile.orgId` for `auth.uid()`.
- Enable RLS on every table. Policy pattern for org-scoped tables:
  `using (org_id = public.auth_org_id())` for SELECT (and matching
  with-check for writes, though writes go through the server role anyway).
- `profile`: SELECT rows in same org; a user may SELECT/UPDATE their own row.
- `org`: SELECT own org.
- Add `contact`, `conversation`, `message` to publication `supabase_realtime`.

## Provider interfaces

### LLM — `src/lib/ai/`
- `LLMProvider { complete(messages, opts): Promise<string>; json<T>(schema, messages, opts): Promise<T> }`.
- Implementations: `groq` (ACTIVE, OpenAI-compatible `https://api.groq.com/openai/v1/chat/completions`, model from env), `gemini`, `anthropic`, `openai`. Selected by `LLM_PROVIDER`.
- `suggestReply(conversation, contact, persona)`: returns `{ text }` using thread
  history + contact.memory + org persona. Validate, retry once, deterministic
  fallback ("Thanks for your message, a team member will reply shortly.").
- `summarizeAndEnrich(conversation, contact)`: returns `{ summary, suggestedTags[], suggestedStage, memory }`.
- `enforceDailyCap(orgId)`: increments `aiUsage`, throws if over `AI_DAILY_CAP`.

### WhatsApp — `src/lib/whatsapp/`
- `WhatsAppProvider { send(to, text): Promise<{ id }>; verifySignature(req): boolean }`.
- `simulator` (ACTIVE): `send` just records an outbound message + (later)
  realtime; inbound arrives via `/api/sim/inbound` (signed with `SIM_SECRET`).
- `cloud` (Meta): `send` via Graph API; webhook `/api/webhooks/whatsapp` GET
  verify (hub.verify_token) + POST inbound with `X-Hub-Signature-256` HMAC.
- Shared `ingestInbound({ orgId, channelId, waId, name, text, providerMessageId })`:
  upsert contact, find/create conversation, append inbound message, bump
  unread/preview, write `webhookEvent` (idempotent), trigger AI autopilot if on.

## Server-action API (the surface the UI calls) — `src/app/(app)/**/actions.ts` + `src/lib/data/*`

All actions resolve the caller via `requireSession()` -> `{ user, profile, orgId, role }` and scope by `orgId`.

- Inbox: `listConversations(filter)`, `getConversation(id)`, `getMessages(convId)`,
  `sendMessage(convId, body)`, `addNote(convId, body)`, `assignConversation(convId, assigneeId|null)`,
  `setConversationStatus(convId, status)`, `toggleAutopilot(convId, on)`,
  `aiSuggest(convId)` -> `{ text }`, `aiSummarize(convId)` -> enrich result.
- Pipeline/CRM: `listPipeline()` -> stages with contacts, `moveContactStage(contactId, stageId)`,
  `updateContact(contactId, patch)`, `listContacts(query)`, `getContact(id)`,
  `contactsCsv()` -> string.
- Settings (ADMIN): `listTeam()`, `inviteMember(email, role)`, `updateMember(id, patch)`,
  `removeMember(id)`, channel CRUD, `listTags()/createTag/deleteTag`,
  stages CRUD, templates CRUD, `updateAiSettings({ persona, autopilotDefault })`.
- Analytics: `analyticsOverview()` -> counts, pipeline value, 14-day message
  series, AI usage, response stats.

Server actions return plain JSON-serializable objects (cast bigint -> number at
the boundary). Throw `ActionError` with a localized key on failure.

## Routes

- Public: `/` (landing), `/login`, `/sim` (customer simulator widget),
  `/api/webhooks/whatsapp`, `/api/sim/inbound`, `/api/cron/keepalive`.
- App (auth): `/inbox`, `/inbox/[conversationId]` (or query param), `/pipeline`,
  `/contacts`, `/contacts/[id]`, `/analytics`, `/settings/*`.
- App layout `src/app/(app)/layout.tsx`: left rail nav (Inbox, Pipeline,
  Contacts, Analytics, Settings), org/user menu, locale + theme, sign out.

## Design tokens (already in `globals.css`)

graphite/slate surfaces (`bg-background/surface/surface-2/surface-3`), one emerald
accent (`bg-brand`, `text-brand`, `bg-brand-soft`), warm `signal` for unread/SLA,
`danger`. Radius `--radius`. Light + dark via `.dark` class (next-themes).
Three-pane inbox is the signature layout; full-width Kanban for pipeline.

## i18n namespaces (`src/messages/{en,es,pt}.json`)

`common`, `locale`, `landing`, `login` (exist). Add: `app` (nav, user menu),
`inbox`, `pipeline`, `contacts`, `analytics`, `settings`, `sim`, `errors`.
Keep all three locales in exact key parity. Nest keys (next-intl splits on dots).

## File ownership (for parallel agents, set at task 128)

- Core/backend (orchestrator): db schema, rls, seed, server-env, supabase, ai/,
  whatsapp/, lib/data/*, lib/auth, the webhook/sim/cron routes, app shell layout.
- UI Agent A: `/inbox` (three-pane + thread + context panel + AI/assign/notes).
- UI Agent B: `/pipeline` + `/contacts` + `/contacts/[id]` + CSV.
- UI Agent C: `/settings/*` + `/analytics` + `/sim` widget.
Each UI agent only calls the server actions above and only adds its own i18n keys.

## Quality gates

tsc clean; next build clean; integration smoke (auth -> sim inbound -> AI suggest
-> send -> assign -> move stage -> CSV) green against hosted Supabase; live Groq
call; two-tab realtime; RLS verified (anon cannot read another org); EN/ES/PT
parity; no dead buttons.
