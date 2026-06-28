import dotenv from "dotenv";
import ws from "ws";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as schema from "./schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

// Node < 22 has no global WebSocket; supabase-js constructs a realtime client eagerly.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SECRET = process.env.SUPABASE_SECRET_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "admin@conversa.app";
const AGENT_EMAIL = process.env.DEMO_AGENT_EMAIL || "agent@conversa.app";
const MARIA_EMAIL = "maria@conversa.app";

if (!DB_URL || !SB_URL || !SB_SECRET) {
  console.error("Missing DB_URL / SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(SB_URL, SB_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = postgres(DB_URL, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function resetUser(email: string, fullName: string): Promise<string> {
  const existing = await findUserId(email);
  if (existing) await admin.auth.admin.deleteUser(existing);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed: " + email);
  return data.user.id;
}

async function main() {
  console.log("[seed] wiping app tables…");
  await db.execute(sql`truncate table
    message, conversation, contact, template, tag, pipeline_stage, channel,
    ai_usage, webhook_event, audit_log, profile, org
    restart identity cascade`);

  console.log("[seed] creating auth users…");
  const adminId = await resetUser(ADMIN_EMAIL, "Alex Rivera");
  const agentId = await resetUser(AGENT_EMAIL, "Sam Carter");
  const mariaId = await resetUser(MARIA_EMAIL, "Maria Lopez");

  console.log("[seed] inserting org + team…");
  const [organization] = await db
    .insert(schema.org)
    .values({
      name: "Aurora Studio",
      persona:
        "You are a warm, concise sales assistant for Aurora Studio, a web design and development studio. Help qualify leads and answer questions about websites, e-commerce and branding. Keep replies under 60 words, friendly and professional, and suggest a clear next step.",
      autopilotDefault: false,
    })
    .returning();
  const orgId = organization!.id;

  await db.insert(schema.profile).values([
    { id: adminId, orgId, role: "ADMIN", fullName: "Alex Rivera", email: ADMIN_EMAIL },
    { id: agentId, orgId, role: "AGENT", fullName: "Sam Carter", email: AGENT_EMAIL },
    { id: mariaId, orgId, role: "AGENT", fullName: "Maria Lopez", email: MARIA_EMAIL },
  ]);

  const [chan] = await db
    .insert(schema.channel)
    .values({
      orgId,
      kind: "simulator",
      name: "Aurora WhatsApp",
      phoneDisplay: "+1 (555) 010-0100",
      status: "connected",
    })
    .returning();
  const channelId = chan!.id;

  console.log("[seed] pipeline stages, tags, templates…");
  const stageRows = await db
    .insert(schema.pipelineStage)
    .values([
      { orgId, name: "New", sort: 0, color: "#586567" },
      { orgId, name: "Contacted", sort: 1, color: "#2f6df0" },
      { orgId, name: "Qualified", sort: 2, color: "#e0850c" },
      { orgId, name: "Proposal sent", sort: 3, color: "#8b5cf6" },
      { orgId, name: "Won", sort: 4, color: "#0b9c6e", isWon: true },
      { orgId, name: "Lost", sort: 5, color: "#d6453f", isLost: true },
    ])
    .returning();
  const stage = (name: string) => stageRows.find((s) => s.name === name)!.id;

  await db.insert(schema.tag).values([
    { orgId, name: "Website", color: "#2f6df0" },
    { orgId, name: "E-commerce", color: "#0b9c6e" },
    { orgId, name: "Branding", color: "#8b5cf6" },
    { orgId, name: "Hot lead", color: "#e0850c" },
    { orgId, name: "Enterprise", color: "#586567" },
  ]);

  await db.insert(schema.template).values([
    {
      orgId,
      title: "Greeting",
      body: "Hi! Thanks for reaching out to Aurora Studio. How can we help with your project today?",
    },
    {
      orgId,
      title: "Pricing",
      body: "Our projects typically start around $3,000 and scale with scope. Want me to put together a quick estimate?",
    },
    {
      orgId,
      title: "Book a call",
      body: "Would a 20-minute call this week help? You can grab a time here: https://aurora.example/book",
    },
    {
      orgId,
      title: "Follow up",
      body: "Just following up on this. Is there anything else you'd like to know before we move ahead?",
    },
  ]);

  console.log("[seed] contacts, conversations, messages…");

  type Turn = { dir: "inbound" | "outbound" | "internal"; via: schema.Message["via"]; body: string; author?: string; min: number };
  type Lead = {
    waId: string;
    name: string;
    locale: string;
    stageName: string;
    valueCents: number;
    tags: string[];
    memory: string;
    assignee: string | null;
    status: "open" | "pending" | "closed";
    autopilot?: boolean;
    unread: number;
    turns: Turn[];
  };

  const leads: Lead[] = [
    {
      waId: "15550100111",
      name: "Daniel Brooks",
      locale: "en",
      stageName: "Qualified",
      valueCents: 600000,
      tags: ["Website", "Hot lead"],
      memory: "Wants a 5-page online store with payments. ~2 month timeline, budget around $6,000.",
      assignee: agentId,
      status: "open",
      unread: 0,
      turns: [
        { dir: "inbound", via: "customer", body: "Hi, do you build online stores? I need about 5 pages with payments, launching in 2 months, budget around $6,000.", min: 240 },
        { dir: "outbound", via: "ai", body: "Absolutely, that's right in our wheelhouse. A 5-page store with payments in ~2 months is very doable around that budget. Could you tell me which products you'll sell and if you have branding ready?", min: 238 },
        { dir: "inbound", via: "customer", body: "Handmade ceramics, about 30 products. Branding is mostly done.", min: 120 },
        { dir: "internal", via: "note", body: "Strong fit. Branding ready, clear budget. Moving to a proposal next.", author: agentId, min: 118 },
        { dir: "outbound", via: "agent", body: "Perfect. I'll prepare a short proposal with scope and timeline and send it over today. Anything specific you want included?", author: agentId, min: 116 },
      ],
    },
    {
      waId: "15550100112",
      name: "Sophie Martin",
      locale: "en",
      stageName: "Contacted",
      valueCents: 250000,
      tags: ["Branding"],
      memory: "Needs a brand refresh and a one-page site. Early stage.",
      assignee: mariaId,
      status: "open",
      unread: 1,
      turns: [
        { dir: "inbound", via: "customer", body: "Hello! Do you also do branding, not just websites?", min: 90 },
        { dir: "outbound", via: "ai", body: "Yes, we do branding and identity work alongside web. Are you looking for a full identity or a refresh of an existing one?", min: 88 },
        { dir: "inbound", via: "customer", body: "A refresh, plus a simple one-page site.", min: 20 },
      ],
    },
    {
      waId: "15550100113",
      name: "Liam O'Connor",
      locale: "en",
      stageName: "New",
      valueCents: 0,
      tags: [],
      memory: "",
      assignee: null,
      status: "open",
      unread: 1,
      turns: [
        { dir: "inbound", via: "customer", body: "Hi there, just found you. What kind of projects do you take on?", min: 12 },
      ],
    },
    {
      waId: "5215550100114",
      name: "Carla Gómez",
      locale: "es",
      stageName: "Qualified",
      valueCents: 900000,
      tags: ["E-commerce", "Hot lead"],
      memory: "Tienda online de moda, ~50 productos, quiere lanzar para temporada navideña.",
      assignee: mariaId,
      status: "open",
      unread: 0,
      turns: [
        { dir: "inbound", via: "customer", body: "Hola, ¿hacen tiendas online? Vendo ropa y quiero lanzar antes de Navidad.", min: 300 },
        { dir: "outbound", via: "ai", body: "¡Hola Carla! Sí, creamos tiendas online completas con pagos. Para llegar a Navidad nos conviene empezar pronto. ¿Cuántos productos manejas y tienes fotos listas?", min: 298 },
        { dir: "inbound", via: "customer", body: "Unos 50 productos, las fotos están casi listas.", min: 180 },
        { dir: "outbound", via: "agent", body: "Genial. Con 50 productos y fotos listas llegamos sin problema. Te preparo una propuesta con etapas y fechas. ¿Te parece?", author: mariaId, min: 176 },
      ],
    },
    {
      waId: "5511955550115",
      name: "João Silva",
      locale: "pt",
      stageName: "Proposal sent",
      valueCents: 1200000,
      tags: ["Website", "Enterprise"],
      memory: "Site institucional para construtora, várias páginas e blog. Proposta enviada.",
      assignee: agentId,
      status: "pending",
      unread: 0,
      turns: [
        { dir: "inbound", via: "customer", body: "Boa tarde, preciso de um site institucional para minha construtora, com blog.", min: 1440 },
        { dir: "outbound", via: "ai", body: "Boa tarde, João! Podemos criar um site institucional completo com blog e área de projetos. Quantas páginas você imagina e tem conteúdo pronto?", min: 1438 },
        { dir: "inbound", via: "customer", body: "Umas 8 páginas, conteúdo em parte pronto.", min: 1400 },
        { dir: "outbound", via: "agent", body: "Perfeito. Enviei uma proposta com escopo, prazo e valor no seu e-mail. Qualquer dúvida me avise por aqui.", author: agentId, min: 1380 },
      ],
    },
    {
      waId: "15550100116",
      name: "Emily Chen",
      locale: "en",
      stageName: "Won",
      valueCents: 450000,
      tags: ["Website"],
      memory: "Closed: 4-page portfolio site. Project kicked off.",
      assignee: agentId,
      status: "closed",
      unread: 0,
      turns: [
        { dir: "inbound", via: "customer", body: "We're ready to go ahead with the portfolio site. Where do we sign?", min: 5760 },
        { dir: "outbound", via: "agent", body: "Wonderful! I'll send the agreement and the kickoff details now. Welcome aboard.", author: agentId, min: 5740 },
      ],
    },
    {
      waId: "15550100117",
      name: "Marcus Webb",
      locale: "en",
      stageName: "Lost",
      valueCents: 0,
      tags: [],
      memory: "Went with a cheaper freelancer. Keep warm for future.",
      assignee: mariaId,
      status: "closed",
      unread: 0,
      turns: [
        { dir: "inbound", via: "customer", body: "Thanks, but we found someone within budget for now.", min: 10080 },
        { dir: "outbound", via: "agent", body: "Completely understand, Marcus. We're here if anything changes down the line. Best of luck!", author: mariaId, min: 10070 },
      ],
    },
    {
      waId: "15550100118",
      name: "Priya Nair",
      locale: "en",
      stageName: "New",
      valueCents: 0,
      tags: ["Enterprise"],
      memory: "",
      assignee: null,
      status: "open",
      autopilot: true,
      unread: 2,
      turns: [
        { dir: "inbound", via: "customer", body: "Hi, we're a mid-size company looking to redo our website and customer portal.", min: 8 },
        { dir: "outbound", via: "ai", body: "Hi Priya! Happy to help. A site plus a customer portal is something we do often. Roughly how many users will the portal have, and do you have a target launch date?", min: 7 },
        { dir: "inbound", via: "customer", body: "A few thousand users, and ideally live in Q1.", min: 3 },
      ],
    },
  ];

  for (const lead of leads) {
    const lastTurn = lead.turns[lead.turns.length - 1]!;
    const [c] = await db
      .insert(schema.contact)
      .values({
        orgId,
        waId: lead.waId,
        name: lead.name,
        locale: lead.locale,
        stageId: stage(lead.stageName),
        valueCents: lead.valueCents,
        tags: lead.tags,
        memory: lead.memory,
        lastContactAt: minutesAgo(lastTurn.min),
      })
      .returning();

    const [conv] = await db
      .insert(schema.conversation)
      .values({
        orgId,
        contactId: c!.id,
        channelId,
        status: lead.status,
        assigneeId: lead.assignee,
        aiAutopilot: lead.autopilot ?? false,
        lastMessagePreview: lastTurn.body.slice(0, 120),
        lastMessageAt: minutesAgo(lastTurn.min),
        unreadCount: lead.unread,
      })
      .returning();

    await db.insert(schema.message).values(
      lead.turns.map((turn) => ({
        orgId,
        conversationId: conv!.id,
        direction: turn.dir,
        via: turn.via,
        body: turn.body,
        status: (turn.dir === "inbound" ? "received" : "sent") as schema.Message["status"],
        authorId: turn.author ?? null,
        createdAt: minutesAgo(turn.min),
      })),
    );
  }

  // A little AI usage history for the analytics page.
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(schema.aiUsage).values({ orgId, day: today, count: 6 });

  console.log("[seed] done. org:", orgId);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
