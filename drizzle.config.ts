import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
  // Only manage our own tables; never touch Supabase-managed schemas.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
