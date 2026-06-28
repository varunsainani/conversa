import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { getContact } from "@/lib/data/contacts";
import { listStages } from "@/lib/data/settings";
import { ContactDetailClient } from "./contact-detail";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();

  const contact = await getContact(ctx, id).catch(() => null);
  if (!contact) notFound();

  const stages = await listStages(ctx);

  return (
    <ContactDetailClient
      contact={contact}
      stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
    />
  );
}
