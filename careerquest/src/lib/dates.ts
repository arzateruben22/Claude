/**
 * Calendar-date helpers. `@db.Date` columns hold UTC-midnight Dates that represent a calendar day
 * in the user's timezone; every helper here uses exact UTC millisecond math so results never depend
 * on the server's own timezone or DST.
 */
export const DAY_MS = 86_400_000;

/** YYYY-MM-DD for an instant, as seen in the given IANA timezone. */
export function dateKeyInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date in a timezone, as a UTC-midnight Date usable with @db.Date columns. */
export function todayInTz(timeZone: string, now = new Date()): Date {
  return dateFromKey(dateKeyInTz(now, timeZone));
}

/** Parse YYYY-MM-DD to a UTC-midnight Date (what Prisma expects for @db.Date). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

/** YYYY-MM-DD of a UTC-midnight calendar Date. */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday-based week start of a UTC-midnight calendar Date. */
export function startOfWeekUtc(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday
  const offset = (day + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** 1-based campaign day index for a campaign that started on `start` (both UTC-midnight dates). */
export function campaignDay(start: Date, today: Date): number {
  return daysBetween(start, today) + 1;
}
