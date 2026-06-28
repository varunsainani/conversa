import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const org = pgTable("org", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  persona: text("persona").notNull().default(""),
  autopilotDefault: boolean("autopilot_default").notNull().default(false),
  createdAt: createdAt(),
});

export const profile = pgTable(
  "profile",
  {
    id: uuid("id").primaryKey(), // == auth.users.id
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    role: text("role").$type<"ADMIN" | "AGENT">().notNull().default("AGENT"),
    fullName: text("full_name").notNull().default(""),
    email: text("email").notNull().default(""),
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("profile_org_idx").on(t.orgId),
  }),
);

export const channel = pgTable(
  "channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"simulator" | "cloud">().notNull().default("simulator"),
    name: text("name").notNull(),
    phoneDisplay: text("phone_display").notNull().default(""),
    status: text("status").$type<"connected" | "disconnected">().notNull().default("connected"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({ orgIdx: index("channel_org_idx").on(t.orgId) }),
);

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sort: integer("sort").notNull().default(0),
    color: text("color").notNull().default("#0b9c6e"),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => ({ orgIdx: index("pipeline_stage_org_idx").on(t.orgId) }),
);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#586567"),
    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("tag_org_idx").on(t.orgId),
    orgNameUq: unique("tag_org_name_uq").on(t.orgId, t.name),
  }),
);

export const contact = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    waId: text("wa_id").notNull(),
    name: text("name").notNull().default(""),
    avatarUrl: text("avatar_url"),
    locale: text("locale").notNull().default("en"),
    stageId: uuid("stage_id").references(() => pipelineStage.id, { onDelete: "set null" }),
    valueCents: bigint("value_cents", { mode: "number" }).notNull().default(0),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().notNull().default({}),
    memory: text("memory").notNull().default(""),
    createdAt: createdAt(),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("contact_org_idx").on(t.orgId),
    orgWaUq: unique("contact_org_wa_uq").on(t.orgId, t.waId),
    stageIdx: index("contact_stage_idx").on(t.stageId),
  }),
);

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channel.id, { onDelete: "set null" }),
    status: text("status").$type<"open" | "pending" | "closed">().notNull().default("open"),
    assigneeId: uuid("assignee_id").references(() => profile.id, { onDelete: "set null" }),
    aiAutopilot: boolean("ai_autopilot").notNull().default(false),
    lastMessagePreview: text("last_message_preview").notNull().default(""),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    unreadCount: integer("unread_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("conversation_org_idx").on(t.orgId),
    contactIdx: index("conversation_contact_idx").on(t.contactId),
    assigneeIdx: index("conversation_assignee_idx").on(t.assigneeId),
    lastMsgIdx: index("conversation_last_msg_idx").on(t.lastMessageAt),
  }),
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    direction: text("direction").$type<"inbound" | "outbound" | "internal">().notNull(),
    via: text("via").$type<"customer" | "agent" | "ai" | "system" | "note">().notNull(),
    type: text("type").notNull().default("text"),
    body: text("body").notNull().default(""),
    mediaUrl: text("media_url"),
    waMessageId: text("wa_message_id"),
    status: text("status")
      .$type<"received" | "sent" | "delivered" | "read" | "failed">()
      .notNull()
      .default("sent"),
    authorId: uuid("author_id").references(() => profile.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => ({
    convIdx: index("message_conversation_idx").on(t.conversationId, t.createdAt),
    orgIdx: index("message_org_idx").on(t.orgId),
  }),
);

export const template = pgTable(
  "template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ orgIdx: index("template_org_idx").on(t.orgId) }),
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => org.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({ orgDayUq: unique("ai_usage_org_day_uq").on(t.orgId, t.day) }),
);

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    orgId: uuid("org_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({
    providerExtUq: unique("webhook_event_provider_ext_uq").on(t.provider, t.externalId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    target: text("target").notNull().default(""),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => ({ orgIdx: index("audit_log_org_idx").on(t.orgId) }),
);

export type Org = typeof org.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Channel = typeof channel.$inferSelect;
export type PipelineStage = typeof pipelineStage.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type Contact = typeof contact.$inferSelect;
export type Conversation = typeof conversation.$inferSelect;
export type Message = typeof message.$inferSelect;
export type Template = typeof template.$inferSelect;
