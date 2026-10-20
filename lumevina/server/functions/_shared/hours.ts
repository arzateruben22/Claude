// Lumevina — Evelyn's hours on the server: the same rules as js/hours.js, so
// a booking can't land outside them even if someone skips the website.
// The value lives in site_settings (key "hours"), written by the dashboard
// through functions/studio (hours_set); with none saved, her usual week.

// deno-lint-ignore-file no-explicit-any
export type Day = { open: number; close: number; lunch: number | null; lunchEnd: number | null };
export type Hours = { week: (Day | null)[]; off: Record<string, boolean>; extra: Record<string, Day>; blocks: Record<string, [number, number][]> };

const H = (open: number, close: number): Day => ({ open, close, lunch: null, lunchEnd: null });
// Evelyn, Oct 19, 2026: Tue 12–7, Wed and Thu 11–7, Fri 10–5, Sat 9:30–6; closed Sun and Mon
export const DEFAULT_WEEK: (Day | null)[] = [null, null, H(720, 1140), H(660, 1140), H(660, 1140), H(600, 1020), H(570, 1080)];
export const CLEAN = 30;   // her cleaning time after every appointment

const valid = (h: any): h is Day => !!h && h.open >= 0 && h.close <= 1440 && h.close > h.open &&
  (h.lunch == null || (h.lunchEnd > h.lunch && h.lunch >= h.open && h.lunchEnd <= h.close));

export function cleanHours(v: any): Hours {
  const s = v && typeof v === "object" ? v : {};
  const week = Array.isArray(s.week) && s.week.length === 7 ? s.week.map((h: any) => (valid(h) ? h : null)) : DEFAULT_WEEK;
  const extra: Record<string, Day> = {}, off: Record<string, boolean> = {}, blocks: Record<string, [number, number][]> = {};
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  for (const [k, h] of Object.entries(s.extra ?? {})) if (DAY.test(k) && valid(h)) extra[k] = h as Day;
  for (const k of Object.keys(s.off ?? {})) if (DAY.test(k) && s.off[k]) off[k] = true;
  for (const [k, list] of Object.entries(s.blocks ?? {})) {
    if (!DAY.test(k) || !Array.isArray(list)) continue;
    const ok = (list as any[]).filter((b) => Array.isArray(b) && Number(b[1]) > Number(b[0])).map((b) => [Number(b[0]), Number(b[1])] as [number, number]);
    if (ok.length) blocks[k] = ok.slice(0, 20);
  }
  return { week, off, extra, blocks };
}

export async function loadHours(db: any): Promise<Hours> {
  const { data } = await db.from("site_settings").select("value").eq("key", "hours").maybeSingle();
  return cleanHours(data?.value);
}

/** The hours for a date ("2026-10-28"), or null when she's closed. */
export function hoursFor(h: Hours, date: string): Day | null {
  if (h.off[date]) return null;
  if (h.extra[date]) return h.extra[date];
  const [y, m, d] = date.split("-").map(Number);
  return h.week[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? null;
}

/** Does a visit from start for dur minutes fit inside her day (not over lunch or a block)? */
export function fitsHours(h: Hours, date: string, start: number, dur: number): boolean {
  const day = hoursFor(h, date);
  if (!day || start < day.open || start + dur > day.close) return false;
  const over = (a: number, z: number) => start < z && start + dur > a;
  if (day.lunch != null && day.lunchEnd != null && over(day.lunch, day.lunchEnd)) return false;
  return !(h.blocks[date] ?? []).some(([a, z]) => over(a, z));
}
