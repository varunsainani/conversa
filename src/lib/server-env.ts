// Server-only environment. NEVER import this into a client component.
export const SERVER_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",

  llmProvider: (process.env.LLM_PROVIDER ?? "groq").toLowerCase(),
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  },

  whatsappProvider: (process.env.WHATSAPP_PROVIDER ?? "simulator").toLowerCase(),
  simSecret: process.env.SIM_SECRET ?? "",
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  },

  aiDailyCap: Number(process.env.AI_DAILY_CAP ?? "200"),
  cronSecret: process.env.CRON_SECRET ?? "",
  demo: {
    adminEmail: process.env.DEMO_ADMIN_EMAIL ?? "admin@conversa.app",
    agentEmail: process.env.DEMO_AGENT_EMAIL ?? "agent@conversa.app",
    password: process.env.DEMO_PASSWORD ?? "demo1234",
  },
};
