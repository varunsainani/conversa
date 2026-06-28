const intlLocale = (locale: string) =>
  locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";

export function formatMoney(cents: number, locale = "en", currency = "USD"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

export function formatNumber(n: number, locale = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatDate(iso: string, locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale = "en"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelative(iso: string, locale = "en"): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < min) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < hour) return rtf.format(Math.round(diffMs / min), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < day * 30) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(iso, locale);
}
