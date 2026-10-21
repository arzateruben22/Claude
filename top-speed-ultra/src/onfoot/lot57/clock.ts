// The simulated clock, Lot 57's fictional hours and its simulated crowd level. Nothing here is live: the hours are
// ours, and the crowd comes from the time of day and the day of the week (PROJECT_OC_ON_FOOT.md, "Simulated
// crowds"). The clock runs from the device's clock, or from a day and hour the page (or a test) sets.

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const CAPACITY = 220;            // fictional

export interface ClockState { day: number; hour: number }

/** our fictional hours: Mon-Thu 11-23, Fri-Sat 11-01, Sun 10-21 */
export function isOpen(day: number, hour: number): boolean {
  const d = ((day % 7) + 7) % 7;
  if (hour < 1) { const prev = (d + 6) % 7; return prev === 5 || prev === 6; }
  if (d === 0) return hour >= 10 && hour < 21;
  if (d === 5 || d === 6) return hour >= 11;
  return hour >= 11 && hour < 23;
}
export function closesAt(day: number, hour: number): string {
  const d = ((day % 7) + 7) % 7;
  if (hour < 1 || d === 5 || d === 6) return '01:00';
  return d === 0 ? '21:00' : '23:00';
}
export function opensAt(day: number, hour: number): string {
  // the next opening after (day, hour)
  for (let k = 1; k <= 48; k++) {
    const h = hour + k * 0.5, dd = (day + Math.floor(h / 24)) % 7, hh = h % 24;
    if (isOpen(dd, hh)) { const ho = Math.floor(hh); return `${String(ho).padStart(2, '0')}:00`; }
  }
  return '11:00';
}

// the share of capacity by hour band and day (the plan's table); null = closed
function curve(day: number, hour: number): number {
  const d = ((day % 7) + 7) % 7;
  if (!isOpen(d, hour)) return 0;
  const col = d === 0 ? 3 : d === 5 ? 1 : d === 6 ? 2 : 0;      // Mon-Thu, Fri, Sat, Sun
  if (hour < 1) return [0, 0.5, 0.55, 0][(d + 6) % 7 === 5 ? 1 : 2];
  const bands: [number, number, number[]][] = [
    [10, 11, [0, 0, 0, 0.2]], [11, 14, [0.15, 0.2, 0.35, 0.45]], [14, 17, [0.15, 0.25, 0.55, 0.7]],
    [17, 20, [0.45, 0.7, 0.85, 0.55]], [20, 23, [0.55, 0.9, 0.95, 0.2]], [23, 24, [0, 0.5, 0.55, 0]],
  ];
  for (const [a, b, v] of bands) if (hour >= a && hour < b) return v[col];
  return 0;
}
/** seeded noise of +-10%, from the day and the hour, so a test can reproduce it */
function noise(day: number, hour: number) {
  let h = (day * 73856093) ^ (Math.floor(hour) * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15;
  return 1 + (((h >>> 0) % 2001) / 1000 - 1) * 0.1;
}
/** the simulated crowd as a share of the fictional capacity (0..1), with our fictional event night */
export function crowdShare(day: number, hour: number): number {
  let s = curve(day, hour);
  if (day === 2 && hour >= 19 && hour < 21) s *= 1.15;          // a fictional Tuesday trivia night
  return Math.min(1, s * noise(day, hour));
}
export type CrowdLevel = 'Closed' | 'Quiet' | 'Easy' | 'Lively' | 'Packed';
export function crowdLevel(day: number, hour: number): CrowdLevel {
  if (!isOpen(day, hour)) return 'Closed';
  const s = crowdShare(day, hour);
  return s < 0.25 ? 'Quiet' : s < 0.5 ? 'Easy' : s < 0.8 ? 'Lively' : 'Packed';
}

/**
 * The instant for a day and hour in Anaheim (Pacific time), for the sun's position. Uses the device's current week,
 * so the sun matches today's season. October to early November is daylight time (UTC-7); the rest of the year is
 * worked out from the second Sunday of March and the first Sunday of November.
 */
export function anaheimDate(day: number, hour: number, now = new Date()): Date {
  // the most recent Sunday (Pacific) at 00:00 local
  const nowPT = new Date(now.getTime() - pacificOffset(now) * 3600e3);
  const sunday = Date.UTC(nowPT.getUTCFullYear(), nowPT.getUTCMonth(), nowPT.getUTCDate() - nowPT.getUTCDay());
  const localMs = sunday + (day * 24 + hour) * 3600e3;
  const guess = new Date(localMs + 8 * 3600e3);
  return new Date(localMs + pacificOffset(guess) * 3600e3);
}
/** hours to add to Pacific local time to get UTC: 7 in daylight time, 8 otherwise */
export function pacificOffset(d: Date): number {
  const y = d.getUTCFullYear();
  const nthSunday = (month: number, n: number) => { const first = new Date(Date.UTC(y, month, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + (n - 1) * 7; };
  const start = Date.UTC(y, 2, nthSunday(2, 2), 10), end = Date.UTC(y, 10, nthSunday(10, 1), 9);
  const t = d.getTime();
  return t >= start && t < end ? 7 : 8;
}
/** the device's clock as Anaheim day and hour */
export function liveClock(now = new Date()): ClockState {
  const pt = new Date(now.getTime() - pacificOffset(now) * 3600e3);
  return { day: pt.getUTCDay(), hour: pt.getUTCHours() + pt.getUTCMinutes() / 60 + pt.getUTCSeconds() / 3600 };
}
export function fmtClock(c: ClockState) {
  const h = Math.floor(c.hour) % 24, m = Math.floor((c.hour % 1) * 60);
  return `${DAYS[((c.day % 7) + 7) % 7]} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function parseDay(d: number | string): number {
  if (typeof d === 'number') return ((Math.round(d) % 7) + 7) % 7;
  const i = DAYS.findIndex((n) => d.toLowerCase().startsWith(n.toLowerCase()));
  return i >= 0 ? i : 0;
}
