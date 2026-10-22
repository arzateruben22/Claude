import { dateFromKey } from "@/lib/dates";

/** "Oct 21" (or "Oct 21, 2026") for a YYYY-MM-DD calendar key, without timezone drift. */
export function formatDayKey(key: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(dateFromKey(key));
}

/** "Wednesday, October 21" for a calendar key. */
export function formatLongDayKey(key: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(dateFromKey(key));
}

/** "Oct 21, 2:30 PM" for an ISO instant in the user's timezone. */
export function formatInstant(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

/** "Oct 21, 2026" for an ISO instant in the user's timezone. */
export function formatInstantDay(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(d);
}
