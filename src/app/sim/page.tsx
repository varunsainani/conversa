import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channel, org } from "@/lib/db/schema";
import { SimClient } from "./sim-client";

export const dynamic = "force-dynamic";

export default async function SimPage() {
  const [ch] = await db.select().from(channel).where(eq(channel.kind, "simulator")).limit(1);
  let orgName = "Aurora Studio";
  if (ch) {
    const [o] = await db.select().from(org).where(eq(org.id, ch.orgId));
    if (o) orgName = o.name;
  }
  return <SimClient channelId={ch?.id ?? ""} orgName={orgName} />;
}
