/**
 * Timezone helpers used by the dashboard. Pure (Intl only, no date-fns-tz dependency).
 */
import { dateFromKey, dateKeyInTz } from "@/lib/dates";
import { addDaysUtc as addUtcDays, utcDateKey as dateKey } from "@/lib/goals/days";

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

/** The instant at which local midnight of `dayKey` (YYYY-MM-DD) occurs in `timeZone`. */
export function startOfDayInTz(dayKey: string, timeZone: string): Date {
  const guess = dateFromKey(dayKey).getTime();
  const first = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
  // Second pass handles DST transitions near midnight.
  const second = guess - tzOffsetMinutes(new Date(first), timeZone) * 60000;
  return new Date(second);
}

/** The instant the local day `dayKey` ends in `timeZone` (= start of the following day). */
export function endOfDayInTz(dayKey: string, timeZone: string): Date {
  return startOfDayInTz(dateKey(addUtcDays(dateFromKey(dayKey), 1)), timeZone);
}

/**
 * Date-only values (e.g. from an <input type="date">) are stored as UTC midnight; interpret them
 * by their UTC calendar date. Real timestamps are interpreted in the user's timezone.
 */
export function followUpDateKey(d: Date, timeZone: string): string {
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return dateOnly ? d.toISOString().slice(0, 10) : dateKeyInTz(d, timeZone);
}

/**
 * Upper bound for "due by end of today" that covers both interpretations above: the later of
 * end-of-today in the user's timezone and end-of-today in UTC.
 */
export function followUpDueBound(todayKey: string, timeZone: string): Date {
  const tzEnd = endOfDayInTz(todayKey, timeZone).getTime();
  const utcEnd = addUtcDays(dateFromKey(todayKey), 1).getTime();
  return new Date(Math.max(tzEnd, utcEnd));
}

export type SeriesPoint = { key: string; label: string; count: number };

/** Build an N-day series ending at `endKey` from a YYYY-MM-DD → count map (missing days are 0). */
export function buildDailySeries(activityByDate: Record<string, number>, endKey: string, days: number): SeriesPoint[] {
  const end = dateFromKey(endKey);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addUtcDays(end, -i);
    const key = dateKey(d);
    out.push({ key, label: fmt.format(d), count: Math.max(0, activityByDate[key] ?? 0) });
  }
  return out;
}
