"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Columns3,
  ExternalLink,
  Inbox,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/(app)/actions";

type Me = { fullName: string; email: string; role: "ADMIN" | "AGENT"; orgName: string };

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const items = [
    { href: "/inbox", icon: Inbox, label: t("inbox") },
    { href: "/pipeline", icon: Columns3, label: t("pipeline") },
    { href: "/contacts", icon: Users, label: t("contacts") },
    { href: "/analytics", icon: BarChart3, label: t("analytics") },
    { href: "/settings", icon: Settings, label: t("settings") },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-surface lg:w-60">
        <div className="flex h-16 items-center gap-2 px-3 lg:px-5">
          <LogoMark />
          <span className="hidden text-lg font-semibold tracking-tight lg:inline">{me.orgName}</span>
        </div>

        <nav className="flex-1 space-y-1 px-2 lg:px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-2 lg:p-3">
          <Link
            href="/sim"
            target="_blank"
            title={t("openSimulator")}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ExternalLink className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{t("customerSimulator")}</span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 lg:px-2">
            <Avatar name={me.fullName} size="sm" />
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-medium text-foreground">{me.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {me.role === "ADMIN" ? t("roleAdmin") : t("roleAgent")}
              </p>
            </div>
            <button
              type="button"
              title={t("signOut")}
              onClick={() => startTransition(() => signOutAction())}
              disabled={pending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
