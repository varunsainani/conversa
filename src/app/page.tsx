import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Bot,
  Columns3,
  MessageCircle,
  PlugZap,
  Sparkles,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const features = [
    { icon: Sparkles, title: t("feature1Title"), body: t("feature1Body") },
    { icon: Columns3, title: t("feature2Title"), body: t("feature2Body") },
    { icon: Users, title: t("feature3Title"), body: t("feature3Body") },
    { icon: MessageCircle, title: t("feature4Title"), body: t("feature4Body") },
  ];

  const steps = [
    { icon: PlugZap, title: t("step1Title"), body: t("step1Body") },
    { icon: Bot, title: t("step2Title"), body: t("step2Body") },
    { icon: ArrowRight, title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              {t("navFeatures")}
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              {t("navHowItWorks")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            <Link href="/login">
              <Button variant="primary" size="sm">
                {t("ctaPrimary")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              {t("badge")}
            </span>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  {t("ctaPrimary")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  {t("ctaSecondary")}
                </Button>
              </a>
            </div>
          </div>

          {/* Before / After */}
          <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                {t("beforeTitle")}
              </div>
              <div className="mt-4 max-w-[88%] rounded-2xl rounded-tl-sm bg-surface-2 px-4 py-3 text-sm text-foreground">
                {t("beforeBody")}
              </div>
            </div>
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand">
                <Sparkles className="h-4 w-4" />
                {t("afterTitle")}
              </div>
              <div className="mt-4 ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-brand px-4 py-3 text-sm text-brand-foreground">
                {t("afterBody")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("featuresTitle")}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("howTitle")}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-xl border border-border bg-surface p-6">
                <span className="absolute right-5 top-5 font-mono text-sm text-muted-foreground">
                  0{i + 1}
                </span>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-brand">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("ctaBody")}</p>
          <div className="mt-7 flex justify-center">
            <Link href="/login">
              <Button size="lg">
                {t("ctaPrimary")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-sm text-muted-foreground">{t("footerRights")}</p>
        </div>
      </footer>
    </div>
  );
}
