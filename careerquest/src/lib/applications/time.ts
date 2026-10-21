import { dateKeyInTz } from "@/lib/dates";

/**
 * Timezone-aware helpers for the tracker's forms and views. Server components render in the server's
 * timezone, so every date shown to the user is formatted with the profile timezone explicitly.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockParts(instant: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Some runtimes format midnight as "24" under h23; normalise.
  const hour = get("hour") === 24 ? 0 : get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset in ms of `timeZone` relative to UTC at a given instant (positive east of UTC). */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const p = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert wall-clock components in `timeZone` to a UTC instant (two-pass so DST edges resolve). */
export function zonedToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMs(new Date(guess), timeZone);
  const off2 = tzOffsetMs(new Date(guess - off1), timeZone);
  return new Date(guess - off2);
}

/**
 * Parse a form value into an instant.
 * - "YYYY-MM-DD" (date input) → 12:00 in the user's timezone, so the calendar day survives timezone math
 * - "YYYY-MM-DDTHH:MM" (datetime-local input) → that wall-clock time in the user's timezone
 * - any other parsable string → as parsed; empty/invalid → null
 */
export function parseDateInput(
  value: string | null | undefined,
  timeZone: string,
): Date | null {
  if (!value) return null;
  const v = value.trim();
  const d = DATE_ONLY.exec(v);
  if (d)
    return zonedToUtc(
      timeZone,
      Number(d[1]),
      Number(d[2]),
      Number(d[3]),
      12,
      0,
    );
  const dt = DATE_TIME_LOCAL.exec(v);
  if (dt)
    return zonedToUtc(
      timeZone,
      Number(dt[1]),
      Number(dt[2]),
      Number(dt[3]),
      Number(dt[4]),
      Number(dt[5]),
    );
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Value for `<input type="date">` in the user's timezone. */
export function dateInputValue(
  date: Date | null | undefined,
  timeZone: string,
): string {
  if (!date) return "";
  return dateKeyInTz(date, timeZone);
}

/** Value for `<input type="datetime-local">` in the user's timezone. */
export function dateTimeInputValue(
  date: Date | null | undefined,
  timeZone: string,
): string {
  if (!date) return "";
  const p = wallClockParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const STYLES: Record<
  "date" | "datetime" | "time" | "short",
  Intl.DateTimeFormatOptions
> = {
  date: { month: "short", day: "numeric", year: "numeric" },
  short: { month: "short", day: "numeric" },
  datetime: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  time: { hour: "numeric", minute: "2-digit" },
};

/** Format an instant in the user's timezone; "—" when empty. */
export function formatInTz(
  date: Date | string | null | undefined,
  timeZone: string,
  style: keyof typeof STYLES = "date",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    ...STYLES[style],
    timeZone,
  }).format(d);
}

/** Whole calendar days from `from` to `to` in the user's timezone (negative when `to` is earlier). */
export function daysBetweenInTz(
  from: Date,
  to: Date,
  timeZone: string,
): number {
  const a = wallClockParts(from, timeZone);
  const b = wallClockParts(to, timeZone);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      86400000,
  );
}
