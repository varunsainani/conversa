import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      role="img"
      aria-label="Conversa"
    >
      <rect width="32" height="32" rx="9" fill="var(--color-brand)" />
      <path
        d="M9 11.5A2.5 2.5 0 0 1 11.5 9h9A2.5 2.5 0 0 1 23 11.5v5A2.5 2.5 0 0 1 20.5 19H14l-3.6 3.2A.8.8 0 0 1 9 21.6z"
        fill="var(--color-brand-foreground)"
      />
      <circle cx="13" cy="14" r="1.2" fill="var(--color-brand)" />
      <circle cx="16.5" cy="14" r="1.2" fill="var(--color-brand)" />
      <circle cx="20" cy="14" r="1.2" fill="var(--color-brand)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-foreground">Conversa</span>
    </span>
  );
}
