import { requireCtx } from "@/lib/auth";
import { listContacts } from "@/lib/data/contacts";
import { ContactsClient } from "./contacts-client";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const ctx = await requireCtx();
  const initial = await listContacts(ctx);

  return <ContactsClient initial={initial} />;
}
