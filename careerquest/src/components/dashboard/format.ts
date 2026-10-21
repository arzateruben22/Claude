import { dateFromKey } from "@/lib/dates";

/** Format a UTC-midnight date (or YYYY-MM-DD key) as "Oct 21" without timezone drift. */
export function fmtDay(d: Date | string, withYear = false): string {
  const date = typeof d === "string" ? dateFromKey(d) : d;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(date);
}

/** Format an instant in the user's timezone, e.g. "Wed, Oct 21, 2:30 PM". */
export function fmtDateTimeTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export function fmtLongDay(key: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(dateFromKey(key));
}

export function perDay(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}/day`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
