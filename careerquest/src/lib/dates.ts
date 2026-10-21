import { addDays, differenceInCalendarDays, formatISO, startOfWeek as dfStartOfWeek } from "date-fns";

/** YYYY-MM-DD for a Date in the given IANA timezone. */
export function dateKeyInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date (as a UTC-midnight Date usable with @db.Date columns) in a timezone. */
export function todayInTz(timeZone: string, now = new Date()): Date {
  return dateFromKey(dateKeyInTz(now, timeZone));
}

/** Parse YYYY-MM-DD to a UTC-midnight Date (what Prisma expects for @db.Date). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function dateKey(date: Date): string {
  return formatISO(date, { representation: "date" });
}

/** Monday-based week start, returned as UTC-midnight Date. */
export function startOfWeekUtc(date: Date): Date {
  const local = dfStartOfWeek(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), { weekStartsOn: 1 });
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return addDays(date, days);
}

export function daysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(b, a);
}

/** 1-based campaign day index for a campaign that started on `start` (both UTC-midnight dates). */
export function campaignDay(start: Date, today: Date): number {
  return daysBetween(start, today) + 1;
}
