import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { getOrgSettings } from "@/lib/data/settings";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  const org = await getOrgSettings(ctx);

  const me = {
    fullName: ctx.profile.fullName || ctx.profile.email,
    email: ctx.profile.email,
    role: ctx.role,
    orgName: org.name,
  };

  return (
    <ToastProvider>
      <AppShell me={me}>{children}</AppShell>
    </ToastProvider>
  );
}
