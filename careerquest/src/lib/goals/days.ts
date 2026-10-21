/**
 * Exact UTC day arithmetic for UTC-midnight dates (what `@db.Date` columns and `todayInTz` give us).
 * Pure millisecond math: unaffected by the server's local timezone or DST, unlike local-calendar helpers.
 */
export const DAY_MS = 86_400_000;

export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysUtc(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDaysUtc(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
