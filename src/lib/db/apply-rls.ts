import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DIRECT_URL / DATABASE_URL");
  process.exit(1);
}

const sqlText = readFileSync(join(process.cwd(), "src/lib/db/rls.sql"), "utf8");

async function main() {
  const sql = postgres(url!, { prepare: false, max: 1 });
  try {
    await sql.unsafe(sqlText);
    console.log("[rls] applied successfully");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
