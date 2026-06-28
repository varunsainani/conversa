"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Phone, Send, Video } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type SimMessage = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  via: string;
  body: string;
  createdAt: string;
};

export function SimClient({ channelId, orgName }: { channelId: string; orgName: string }) {
  const t = useTranslations("sim");
  const locale = useLocale();
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [waId, setWaId] = useState("");
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const localId = useRef(0);

  useEffect(() => {
    const savedWa = localStorage.getItem(`sim_wa_${channelId}`);
    const savedName = localStorage.getItem(`sim_name_${channelId}`);
    if (savedWa && savedName) {
      setWaId(savedWa);
      setName(savedName);
      setStarted(true);
    }
  }, [channelId]);

  const poll = useCallback(async () => {
    if (!channelId || !waId) return;
    try {
      const res = await fetch(
        `/api/sim/thread?channelId=${encodeURIComponent(channelId)}&waId=${encodeURIComponent(waId)}`,
      );
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* ignore */
    }
  }, [channelId, waId]);

  useEffect(() => {
    if (!started) return;
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [started, poll]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function start() {
    const cleanName = name.trim() || "Guest";
    const generated = "1555" + Math.floor(1_000_000 + Math.random() * 8_999_999).toString();
    localStorage.setItem(`sim_wa_${channelId}`, generated);
    localStorage.setItem(`sim_name_${channelId}`, cleanName);
    setName(cleanName);
    setWaId(generated);
    setStarted(true);
  }

  async function send(text: string) {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setInput("");
    // Optimistic echo.
    setMessages((m) => [
      ...m,
      {
        id: `local-${localId.current++}`,
        direction: "inbound",
        via: "customer",
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      await fetch("/api/sim/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, waId, name, text: body }),
      });
      setTimeout(poll, 600);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Conversa
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="flex h-[640px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          {/* WhatsApp-style header */}
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-brand-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-semibold">
                {orgName.charAt(0)}
              </span>
              <div>
                <p className="text-sm font-semibold">{orgName}</p>
                <p className="text-xs text-brand-foreground/80">{t("online")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-brand-foreground/80">
              <Video className="h-4 w-4" />
              <Phone className="h-4 w-4" />
            </div>
          </div>

          {!started ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder={t("namePlaceholder")}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                onClick={start}
                className="h-10 w-full rounded-lg bg-brand font-medium text-brand-foreground hover:bg-brand-hover"
              >
                {t("start")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-grid px-3 py-4">
                {messages.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("intro")}</p>
                )}
                {messages
                  .filter((m) => m.direction !== "internal")
                  .map((m) => {
                    const mine = m.direction === "inbound";
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-lg px-3 py-1.5 text-sm shadow-sm",
                            mine ? "rounded-br-sm bg-brand text-brand-foreground" : "rounded-bl-sm bg-surface text-foreground",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-brand-foreground/70" : "text-muted-foreground")}>
                            {formatTime(m.createdAt, locale)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                <div ref={endRef} />
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
                  {[t("preset1"), t("preset2"), t("preset3")].map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 border-t border-border p-2.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send(input)}
                  placeholder={t("placeholder")}
                  className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  onClick={() => send(input)}
                  disabled={sending}
                  aria-label={t("send")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="pb-6 text-center">
        <Link href="/login" className="text-sm font-medium text-brand hover:underline">
          {t("openInbox")}
        </Link>
      </footer>
    </div>
  );
}
