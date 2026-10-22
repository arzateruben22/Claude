import { formatCurrency } from "@/lib/format";

/** Whole dollars ("$85,000"). */
export const usd = (n: number | null | undefined) => formatCurrency(n ?? null);

/** Dollars and cents, for hourly rates ("$32.50"). */
export const usdRate = (n: number | null | undefined) => formatCurrency(n ?? null, { cents: true });

/** "$15,000 short" / "$5,000 above" / "on target" for target − amount. */
export function gapText(gap: number): string {
  if (!Number.isFinite(gap)) return "—";
  if (Math.abs(gap) < 0.5) return "on target";
  return gap > 0 ? `${usd(gap)} short` : `${usd(-gap)} above`;
}

/** "$100K" for target headings. */
export function targetLabel(n: number): string {
  return n % 1000 === 0 ? `$${(n / 1000).toLocaleString("en-US")}K` : usd(n);
}

/** "Jan 26, 2026" from an ISO day key, without timezone drift. */
export function dayKeyLabel(key: string | null | undefined): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}
