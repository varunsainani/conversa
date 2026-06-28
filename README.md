# Conversa

An **AI WhatsApp inbox + CRM**: a team inbox where an AI drafts (and can
auto-send) WhatsApp replies, every contact becomes a lead in a drag-and-drop
sales pipeline, and a whole team works the same conversations together, live.

**Live demo:** https://conversa-tau-rouge.vercel.app — on the login page use a
one-click demo button (admin or agent); no signup needed.

Not a seeded mockup: open the app, then open the built-in **customer simulator**
in another tab and message the business as a customer. The message lands in the
inbox in real time, the AI can draft a reply, and the contact shows up in the
pipeline.

## What it does

- 💬 **Live team inbox** — a three-pane WhatsApp inbox (conversations · thread ·
  contact panel). New messages stream in over Supabase Realtime, across the whole
  team, with no polling.
- 🤖 **AI replies with context memory** — one click drafts a reply from the full
  conversation, a per-contact memory, and a configurable business persona. Turn on
  **autopilot** to have the AI answer new messages automatically.
- 🧭 **AI summarize & enrich** — summarize a chat, auto-suggest tags and a pipeline
  stage, and remember a note about the contact for future replies.
- 📊 **Drag-and-drop pipeline** — every WhatsApp contact is a lead. Move deals
  across stages, tag them, set a value, and watch the pipeline value update.
- 👥 **Multi-agent collaboration** — assign conversations to teammates, filter by
  "mine / unassigned / all", leave internal notes that never reach the customer,
  and set open / pending / closed status.
- 🗂️ **CRM** — searchable contacts, an editable lead profile, and one-click CSV
  export.
- 📈 **Analytics** — pipeline value, leads by stage, won deals, and a 14-day
  message-volume chart.
- 🔌 **Real WhatsApp Business Cloud API model** — webhook verification, inbound
  handling with `X-Hub-Signature-256` HMAC, and Graph API send, behind a provider
  interface. A built-in **simulator** is active so the whole thing works live with
  zero Meta setup.
- 🌍 **Trilingual EN / ES / PT**, light / dark, with a distinct graphite + emerald
  team-inbox design.

## Pluggable AI (Groq active, others switchable)

The LLM sits behind an `LLMProvider` interface. The live demo runs on **Groq**
(free, fast, OpenAI-compatible — Llama / DeepSeek class models), and **Gemini**,
**Anthropic (Claude)**, and **OpenAI** providers are implemented and selected with
one env var (`LLM_PROVIDER`). Outputs are validated server-side with a retry and a
deterministic fallback, so a bad model response never breaks a request, and a
per-org daily cap bounds usage. The model is never trusted for money.

## Tech stack

| Layer        | Technology                                                            |
| ------------ | --------------------------------------------------------------------- |
| App          | Next.js (App Router) full-stack, React, TypeScript, Tailwind v4, next-intl |
| Data / Auth  | **Supabase** — Postgres, Auth, Realtime, Storage, Row Level Security  |
| Queries      | **Drizzle ORM** (typed server queries + migrations)                   |
| AI           | `LLMProvider` interface — Groq (active), Gemini, Claude, OpenAI       |
| WhatsApp     | `WhatsAppProvider` interface — simulator (active), Cloud API (coded)  |
| Hosting      | Vercel (one project) + Supabase, with a daily cron keep-warm          |

Server writes, AI calls, and the WhatsApp webhook run in Next.js server actions /
route handlers over Drizzle (org-scoped in code); the browser uses the Supabase
publishable key for auth + realtime, enforced by RLS.

## Project structure

```
src/
  app/
    (app)/          inbox, pipeline, contacts, analytics, settings + server actions
    api/            whatsapp webhook, simulator inbound/thread, cron keepalive
    sim/            public customer simulator widget
  lib/
    db/             Drizzle schema, RLS policies, seed
    data/           org-scoped data layer (inbox, pipeline, contacts, settings, analytics)
    ai/             LLM providers + reply/enrich + daily cap
    whatsapp/       providers (simulator + cloud) + inbound ingest
    auth.ts         session -> org + role
  components/       shell, UI primitives, brand
  messages/         en / es / pt
```

## Running locally

```bash
npm install
cp .env.example .env.local   # Supabase URL + keys + DB url, GROQ_API_KEY, secrets
npm run db:push              # create tables on Supabase Postgres (Drizzle)
npm run db:rls               # apply RLS policies + realtime publication
npm run db:seed              # demo org, team, pipeline, conversations
npm run dev                  # http://localhost:3000
```

Demo accounts (seeded): `admin@conversa.app` / `agent@conversa.app`, password
`demo1234`. The active providers (`LLM_PROVIDER=groq`, `WHATSAPP_PROVIDER=simulator`)
need only a free Groq key and the Supabase project — no Meta account.

## Notes

- Switch the AI model with `LLM_PROVIDER` (+ the matching key). Switch to real
  WhatsApp with `WHATSAPP_PROVIDER=cloud` and the Meta credentials.
- The free Supabase project pauses after 7 days idle; a daily Vercel Cron
  (`/api/cron/keepalive`) keeps it warm so the demo stays live.
