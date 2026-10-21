const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US");

export function formatCurrency(n: number | string | null | undefined, opts: { cents?: boolean } = {}) {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return opts.cents ? usdCents.format(v) : usd.format(v);
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return num.format(n);
}

export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelative(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (abs < 3600000) return rtf.format(minutes, "minute");
  const hours = Math.round(diff / 3600000);
  if (abs < 86400000) return rtf.format(hours, "hour");
  const days = Math.round(diff / 86400000);
  if (abs < 86400000 * 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  return rtf.format(months, "month");
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s_-])(\w)/g, (_, p, c) => p.replace("_", " ") + c.toUpperCase());
}

export function enumLabel(value: string) {
  return value.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}
