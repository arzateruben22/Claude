/**
 * Calendar helpers for analytics. Pure (Intl only). Day keys are YYYY-MM-DD strings in the user's
 * calendar; UTC-midnight Dates represent the same calendar days for @db.Date columns.
 */
import { dateFromKey, dateKeyInTz } from "@/lib/dates";

export const DAY_MS = 86_400_000;

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  return utcDateKey(new Date(dateFromKey(key).getTime() + days * DAY_MS));
}

/** Whole days from `a` to `b` (positive when b is later). Both day keys. */
export function diffDaysKey(a: string, b: string): number {
  return Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / DAY_MS);
}

export function isValidDayKey(key: string | undefined): key is string {
  if (!key || !DAY_KEY_RE.test(key)) return false;
  const d = dateFromKey(key);
  return !Number.isNaN(d.getTime()) && utcDateKey(d) === key;
}

/** Minutes to add to UTC to obtain wall-clock time in `timeZone` at `date`. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The instant local midnight of `dayKey` occurs in `timeZone`. */
export function startOfDayInTz(dayKey: string, timeZone: string): Date {
  const guess = dateFromKey(dayKey).getTime();
  const first = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
  const second = guess - tzOffsetMinutes(new Date(first), timeZone) * 60000; // DST near midnight
  return new Date(second);
}

/** The instant the local day `dayKey` ends in `timeZone` (= start of the next local day). */
export function endOfDayInTz(dayKey: string, timeZone: string): Date {
  return startOfDayInTz(addDaysKey(dayKey, 1), timeZone);
}

/**
 * Date-only values (from an <input type="date">) are stored as UTC midnight; interpret them by
 * their UTC calendar date. Real timestamps are interpreted in the user's timezone.
 */
export function isDateOnly(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

export function instantDateKey(d: Date, timeZone: string): string {
  return isDateOnly(d) ? utcDateKey(d) : dateKeyInTz(d, timeZone);
}

/**
 * Inclusive day-key range → instant bounds that cover BOTH interpretations above, so a date-only
 * value stored as UTC midnight and a real timestamp in the user's timezone both land in range.
 */
export function rangeBounds(fromKey: string | null, toKey: string | null, timeZone: string): { gte?: Date; lt?: Date } {
  const out: { gte?: Date; lt?: Date } = {};
  if (fromKey) {
    const tz = startOfDayInTz(fromKey, timeZone).getTime();
    const utc = dateFromKey(fromKey).getTime();
    out.gte = new Date(Math.min(tz, utc));
  }
  if (toKey) {
    const tz = endOfDayInTz(toKey, timeZone).getTime();
    const utc = dateFromKey(toKey).getTime() + DAY_MS;
    out.lt = new Date(Math.max(tz, utc));
  }
  return out;
}

/** Monday-based week start for a day key, as a day key. */
export function weekStartKey(key: string): string {
  const d = dateFromKey(key);
  const dow = d.getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7;
  return addDaysKey(key, -back);
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayYearFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Oct 21" for a day key (no timezone drift). */
export function dayLabel(key: string, withYear = false): string {
  return (withYear ? dayYearFmt : dayFmt).format(dateFromKey(key));
}
