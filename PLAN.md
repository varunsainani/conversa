# Conversa — AI WhatsApp Inbox & CRM

A team inbox for WhatsApp where an AI drafts and can auto-send replies, every
contact becomes a lead in a drag-and-drop sales pipeline, and a whole team works
the same conversations together, live. Not a seeded demo: a reviewer opens the
live app, sends a message as a "customer," and watches the AI reply, the lead
appear, and the pipeline update in real time across two browser tabs.

New, more powerful product than the existing WhatsApp Automation Dashboard
(which stays as its own portfolio piece). Built on the official **WhatsApp
Business Cloud API** model (webhooks, signature verification, Graph API send).

Repo: `conversa`, remote `git@github.com:varunsainani/conversa.git`, branch `main`.

---

## Locked decisions

- **LLM:** **Groq is ACTIVE** for the live demo (free, OpenAI-compatible, runs
  Llama / DeepSeek-R1 at ~300 tok/s so replies feel instant). **Gemini,
  Anthropic/Claude, and OpenAI** are all implemented and switchable via
  `LLM_PROVIDER`. Portfolio line: "pluggable LLM layer across Groq, Gemini,
  Claude, OpenAI."
- **Stack:** **Supabase + Next.js full-stack.** No Prisma, no Express, no Neon.
  - **Supabase Auth** — team login + roles.
  - **Supabase Realtime** — live inbox updates across agents (no Socket.IO, no
    polling hack; a real upgrade over the old dashboard).
  - **Supabase Storage** — WhatsApp media.
  - **Row Level Security** — org isolation enforced in the database.
  - **Next.js (App Router)** route handlers + server actions for the secret-side
    work: AI calls, WhatsApp send, and the inbound webhook.
  - **Drizzle ORM** for typed server-side queries + schema migrations.
- **WhatsApp:** `simulator` provider ACTIVE (a built-in "customer" widget drives
  the real webhook pipeline, so the demo works live with zero Meta setup); `cloud`
  (Meta) provider coded + switchable via `WHATSAPP_PROVIDER`.
- **Keep-warm:** a daily **Vercel Cron** ping runs a 1-row query so the free
  Supabase project never pauses and the demo link is always live.

---

## What makes it "fully workable, not a demo"

1. **Real AI replies with context memory** — the LLM gets conversation history +
   a per-contact memory/summary + a configurable business persona, and returns a
   suggested reply. One click to insert, or auto-reply mode that sends it. AI also
   summarizes a conversation and suggests tags/stage. JSON validated server-side,
   retry + deterministic fallback, per-org daily AI cap, key server-side only.
2. **Real multi-agent collaboration** — assign a conversation to a teammate;
   "assigned to me / unassigned / all" views; internal notes that never reach the
   customer; open/pending/closed states; **live** updates across agents via
   Supabase Realtime.
3. **Real CRM pipeline** — a Kanban board with drag-and-drop between stages
   (New -> Contacted -> Qualified -> Won / Lost), tags, custom fields, lead value,
   activity timeline. Each WhatsApp contact is a lead.
4. **Real webhook integration** — Cloud API verify (GET) + inbound (POST) with
   `X-Hub-Signature-256` HMAC verification + status callbacks, as a Next route
   handler. The simulator posts through the same pipeline.

## Stack detail

- App: Next.js (App Router) + React + TypeScript + Tailwind v4 + next-intl +
  next-themes + lucide-react. Server actions + route handlers for server work.
- Data/Auth/Realtime/Storage: Supabase. Typed server queries + migrations:
  Drizzle. Client reads + realtime subscriptions: `supabase-js` (RLS-enforced).
  Server mutations/AI/WhatsApp: server actions with explicit org checks.
- Deploy: ONE Vercel project (Next.js app = UI + API routes) + ONE Supabase
  project. Simpler than our two-project layout.
- i18n: EN / ES / PT full parity. Fiverr screenshots in EN.

## Design (distinct from the other projects)

Professional team-inbox / helpdesk look: a calm graphite/slate shell, one emerald
accent (nods to WhatsApp without copying it), one warm signal color for
unread/SLA. Dense three-pane inbox (conversation list | thread | context/CRM
panel) plus a full-width Kanban pipeline. Visually unlike the editorial,
dev-canvas, directory, or dashboard looks of the other projects.

## Data model (Supabase tables, RLS by org)

org, profile (user, role ADMIN/AGENT, org_id), channel, contact (lead: tags[],
stage_id, value_cents, custom_fields, memory), conversation (status, assignee_id,
last_message_at), message (direction, type, body, media_url, wa_message_id,
status), note (internal), tag, pipeline_stage, template (canned reply), ai_usage
(daily cap), audit_log, webhook_event (idempotency ledger). Every table carries
org_id; RLS policies restrict rows to the caller's org.

## Routes

`/login` (one-click demo: admin + agent) | `/inbox` (three-pane, filters,
AI-suggest, assign, notes, live) | `/pipeline` (Kanban drag-drop) | `/contacts`
+ `/contacts/[id]` (searchable, CSV export) | `/analytics` | `/settings`
(channel, AI persona/auto-reply, team, tags/stages, templates) | `/sim` (public
customer widget that drives the simulator) | `/api/webhooks/whatsapp` (verify +
inbound + status) | `/api/cron/keepalive`.

## Build process

1. Scaffold the Next.js app + `SPEC.md` build contract (source of truth) +
   Drizzle schema + RLS policy SQL.
2. Parallel build agents, strict file ownership: (a) Supabase schema + RLS +
   Drizzle + seed, (b) auth/teams + server-action data layer, (c) WhatsApp
   providers (simulator + cloud) + webhook + realtime wiring, (d) AI/LLM layer
   (Groq active, others switchable) + memory, (e) inbox + pipeline + CRM UI, (f)
   foundation + i18n + settings + analytics. Reconcile against SPEC.
3. Verify: tsc clean, next build clean, integration smoke against the hosted
   Supabase project (auth -> simulate inbound -> AI suggest -> assign -> move
   stage -> CSV), live Groq call check, two-tab realtime check.
4. Deploy: 1 Vercel project + Supabase, env persisted, daily keep-warm cron.
   Live prod loop.
5. Audit (security/authz incl. RLS, i18n parity, no-dead-buttons, adversarial
   AI/webhook) + live browser pass per the full-audit skill (RAM check first).
   Fix. Reseed pristine.
6. EN screenshots (light + dark). README + memory. Then the Fiverr listing copy.

## What I'll need from you

Because we dev/verify against real Supabase + Groq (not a local embedded DB), I'll
need these **before the verification stage** (I can scaffold and write all code
first):

- A free **Supabase** project: its URL, anon key, service-role key, and the
  Postgres connection string (for Drizzle). You create it; secrets stay with you.
- A free **Groq** API key (console.groq.com, no card).
- At deploy: the **Vercel** token (team varunprojects) + confirm pushing to
  `varunsainani`.
- Nothing from Meta is needed for the live demo (the simulator covers it).
