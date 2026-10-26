// Time in the studio's display timezone (default America/Los_Angeles), stored as UTC.
// All conversions go through Intl, so daylight-saving changes are handled by the platform's tz database.

/** The wall-clock parts of a UTC instant in a timezone. */
export function zonedParts(at: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** "YYYY-MM-DD" of a UTC instant, in the timezone. */
export function localDate(at: Date, tz: string): string {
  const p = zonedParts(at, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "YYYY-MM" of a UTC instant, in the timezone (the reward budget's month). */
export function localMonth(at: Date, tz: string): string {
  return localDate(at, tz).slice(0, 7);
}

/**
 * The UTC instant of a local wall-clock time ("2026-11-01", "09:30") in the timezone.
 * A time skipped by a spring-forward gap resolves to the first valid instant after it; an ambiguous time in a
 * fall-back overlap resolves to its first (earlier, daylight-time) occurrence.
 */
export function zonedTimeToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);            // the wall time, written as if it were UTC
  const wall = (t: number) => { const p = zonedParts(new Date(t), tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s); };
  const offset = (t: number) => wall(t) - t;             // local minus UTC at instant t
  const before = offset(want - 86_400_000), after = offset(want + 86_400_000);
  // the instant is want minus the offset in force; try both offsets around the date (they differ only near a change)
  const valid = [want - before, want - after].filter((t) => wall(t) === want).sort((p, q) => p - q);
  if (valid.length) return new Date(valid[0]);           // fall-back overlap: two valid instants, take the earlier
  // spring-forward gap: no instant shows this wall time; return the transition (the first valid instant after it)
  let lo = want - before - 3 * 3_600_000, hi = want - after + 3 * 3_600_000;   // offset(lo) = before, offset(hi) = after
  while (hi - lo > 60_000) { const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000; if (offset(mid) === before) lo = mid; else hi = mid; }
  return new Date(hi);
}

/** Add whole days to a "YYYY-MM-DD" date (calendar arithmetic, no timezone involved). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function formatLocal(at: Date | string | null | undefined, tz: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (!at) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(typeof at === "string" ? new Date(at) : at);
}
