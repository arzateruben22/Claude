// A venue's fictional hours and simulated crowd as data (PROJECT_OC_SPORTS_BAR.md, "A venue is data" and "The
// simulated crowd"). Nothing here is live: the hours are ours, and the crowd comes from the time of day and the day of
// the week. Hours run 0 to 26 within a business day: [11, 26] is 11:00 to 02:00 the next morning, and 00:00 to 02:00
// is counted in the column of the day whose evening it is.
import type { CrowdLevel } from './clock';

export interface Schedule {
  capacity: number;                                       // fictional
  hours: [number, number][];                              // Sun..Sat: [open, close], 0 to 26; [0, 0] closed
  bands: { from: number; to: number; share: [number, number, number, number] }[];   // Mon-Thu, Fri, Sat, Sun
  events: { day: number; from: number; to: number; factor: number; label: string }[];
  weather: { rain: number; fog: number };
  noiseSeed: number;
}

/** the business day and its hour (0 to 26) for a calendar day and hour: 00:00 to 02:00 belongs to the evening before
 *  when that day's hours run past 24 */
export function businessDay(s: Schedule, day: number, hour: number): { day: number; hour: number } {
  const d = ((day % 7) + 7) % 7, prev = (d + 6) % 7;
  if (hour < 24 && hour + 24 < s.hours[prev][1]) return { day: prev, hour: hour + 24 };
  return { day: d, hour };
}
export function isOpen(s: Schedule, day: number, hour: number): boolean {
  const b = businessDay(s, day, hour), [o, c] = s.hours[b.day];
  return c > o && b.hour >= o && b.hour < c;
}
const hh = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
export function closesAt(s: Schedule, day: number, hour: number): string { const b = businessDay(s, day, hour); return hh(s.hours[b.day][1]); }
/** the next opening after (day, hour), as a clock time */
export function opensAt(s: Schedule, day: number, hour: number): string {
  for (let k = 1; k <= 7 * 48; k++) {
    const h = hour + k * 0.5, dd = (day + Math.floor(h / 24)) % 7, hr = h % 24;
    if (isOpen(s, dd, hr)) { const b = businessDay(s, dd, hr); return hh(s.hours[b.day][0]); }
  }
  return hh(s.hours[1][0]);
}
/** the column of the bands for a business day: Mon-Thu 0, Fri 1, Sat 2, Sun 3 */
const column = (d: number) => (d === 0 ? 3 : d === 5 ? 1 : d === 6 ? 2 : 0);
/** Lot 57's seeded noise (lot57/clock.ts) of +-10% from the calendar weekday and whole hour, XORed first with
 *  noiseSeed * 83492791; seed 0 reproduces Lot 57's exactly */
export function noise(s: Schedule, day: number, hour: number) {
  let h = (day * 73856093) ^ (Math.floor(hour) * 19349663) ^ Math.imul(s.noiseSeed, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15;
  return 1 + (((h >>> 0) % 2001) / 1000 - 1) * 0.1;
}
/** the simulated crowd as a share of the fictional capacity (0 to 1); `extra` multiplies (the featured match, S2a) */
export function crowdShare(s: Schedule, day: number, hour: number, extra?: (day: number, hour: number) => number): number {
  if (!isOpen(s, day, hour)) return 0;
  const b = businessDay(s, day, hour), col = column(b.day);
  let v = 0;
  for (const band of s.bands) if (b.hour >= band.from && b.hour < band.to) { v = band.share[col]; break; }
  for (const e of s.events) if (e.day === b.day && b.hour >= e.from && b.hour < e.to) v *= e.factor;
  if (extra) v *= extra(day, hour);
  return Math.min(1, v * noise(s, ((day % 7) + 7) % 7, hour));
}
export function crowdLevel(s: Schedule, day: number, hour: number, extra?: (day: number, hour: number) => number): CrowdLevel {
  if (!isOpen(s, day, hour)) return 'Closed';
  const v = crowdShare(s, day, hour, extra);
  return v < 0.25 ? 'Quiet' : v < 0.5 ? 'Easy' : v < 0.8 ? 'Lively' : 'Packed';
}
