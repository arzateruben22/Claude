/**
 * Work-hour aggregates: the self-reported vs verified split, weekly and cumulative chart series,
 * and the completion projection. Pure; dates are "YYYY-MM-DD" calendar keys in the user's timezone.
 */
import type { HourVerification, WorkType } from "@/generated/prisma/enums";
import { DAY_MS, addUtcDays, dateFromKey, dateKey, daysBetween, startOfWeekUtc } from "@/lib/dates";
import { PROJECTION_MIN_WEEKS, PROJECTION_WINDOW_WEEKS, isVerifiedSource, roundHours } from "./constants";

export type HourPoint = { dateKey: string; hours: number; verification: HourVerification; workType: WorkType };

export type HourTotals = {
  /** SELF_REPORTED only. Never treated as accepted by California. */
  selfReported: number;
  /** EMPLOYER_VERIFIED + OFFICIAL_RECORD (each backed by an attached document). */
  verified: number;
  employerVerified: number;
  officialRecord: number;
  /** Everything logged (self-reported + verified). */
  logged: number;
  entries: number;
  verifiedEntries: number;
};

export function splitTotals(points: readonly HourPoint[]): HourTotals {
  let selfReported = 0;
  let employerVerified = 0;
  let officialRecord = 0;
  let verifiedEntries = 0;
  for (const p of points) {
    const h = Number.isFinite(p.hours) ? p.hours : 0;
    if (p.verification === "EMPLOYER_VERIFIED") employerVerified += h;
    else if (p.verification === "OFFICIAL_RECORD") officialRecord += h;
    else selfReported += h;
    if (isVerifiedSource(p.verification)) verifiedEntries++;
  }
  const verified = employerVerified + officialRecord;
  return {
    selfReported: roundHours(selfReported),
    verified: roundHours(verified),
    employerVerified: roundHours(employerVerified),
    officialRecord: roundHours(officialRecord),
    logged: roundHours(selfReported + verified),
    entries: points.length,
    verifiedEntries,
  };
}

/** Hours per work type, split by verification. */
export function hoursByWorkType(points: readonly HourPoint[], which: "verified" | "all"): Partial<Record<WorkType, number>> {
  const out: Partial<Record<WorkType, number>> = {};
  for (const p of points) {
    if (which === "verified" && !isVerifiedSource(p.verification)) continue;
    out[p.workType] = roundHours((out[p.workType] ?? 0) + p.hours);
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 20" for a key; with the year when asked. Formatting is UTC-based so keys never shift. */
export function shortDayLabel(key: string, withYear = false): string {
  const d = dateFromKey(key);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}

export type WeeklyPoint = { key: string; label: string; tooltipLabel: string; verified: number; selfReported: number };

/** Hours per Monday-based week for the last `weeks` weeks, ending with the current week. */
export function weeklySeries(points: readonly HourPoint[], todayKey: string, weeks = 12): WeeklyPoint[] {
  const currentWeek = startOfWeekUtc(dateFromKey(todayKey));
  const first = addUtcDays(currentWeek, -7 * (weeks - 1));
  const buckets = new Map<string, WeeklyPoint>();
  for (let i = 0; i < weeks; i++) {
    const start = addUtcDays(first, 7 * i);
    const key = dateKey(start);
    const end = dateKey(addUtcDays(start, 6));
    buckets.set(key, { key, label: shortDayLabel(key), tooltipLabel: `Week of ${shortDayLabel(key, true)} – ${shortDayLabel(end)}`, verified: 0, selfReported: 0 });
  }
  for (const p of points) {
    if (p.dateKey > todayKey) continue;
    const wk = dateKey(startOfWeekUtc(dateFromKey(p.dateKey)));
    const b = buckets.get(wk);
    if (!b) continue;
    if (isVerifiedSource(p.verification)) b.verified = roundHours(b.verified + p.hours);
    else b.selfReported = roundHours(b.selfReported + p.hours);
  }
  return [...buckets.values()];
}

export type CumulativePoint = { key: string; label: string; tooltipLabel: string; verified: number; selfReported: number };

/**
 * Running totals at the end of each week, from the week of the first entry to the current week.
 * Long histories are thinned to at most `maxPoints` weeks (the last week is always kept).
 */
export function cumulativeSeries(points: readonly HourPoint[], todayKey: string, maxPoints = 104): CumulativePoint[] {
  const past = points.filter((p) => p.dateKey <= todayKey);
  if (past.length === 0) return [];
  const firstKey = past.reduce((m, p) => (p.dateKey < m ? p.dateKey : m), past[0]!.dateKey);
  const firstWeek = startOfWeekUtc(dateFromKey(firstKey));
  const lastWeek = startOfWeekUtc(dateFromKey(todayKey));
  const weekCount = Math.floor((lastWeek.getTime() - firstWeek.getTime()) / (7 * DAY_MS)) + 1;
  const perWeek = new Map<string, { verified: number; selfReported: number }>();
  for (const p of past) {
    const wk = dateKey(startOfWeekUtc(dateFromKey(p.dateKey)));
    const cur = perWeek.get(wk) ?? { verified: 0, selfReported: 0 };
    if (isVerifiedSource(p.verification)) cur.verified += p.hours;
    else cur.selfReported += p.hours;
    perWeek.set(wk, cur);
  }
  const all: CumulativePoint[] = [];
  let verified = 0;
  let selfReported = 0;
  for (let i = 0; i < weekCount; i++) {
    const start = addUtcDays(firstWeek, 7 * i);
    const key = dateKey(start);
    const w = perWeek.get(key);
    if (w) {
      verified += w.verified;
      selfReported += w.selfReported;
    }
    const endKey = dateKey(addUtcDays(start, 6));
    const asOf = endKey > todayKey ? todayKey : endKey;
    all.push({ key, label: shortDayLabel(key), tooltipLabel: `Through ${shortDayLabel(asOf, true)}`, verified: roundHours(verified), selfReported: roundHours(selfReported) });
  }
  if (all.length <= maxPoints) return all;
  const step = Math.ceil(all.length / maxPoints);
  const thinned = all.filter((_, i) => (all.length - 1 - i) % step === 0);
  return thinned;
}

export type Projection =
  | { status: "complete"; verified: number; required: number }
  | { status: "insufficient"; reason: "no-verified" | "short-history"; weeksOfData: number; minWeeks: number }
  | { status: "stalled"; windowWeeks: number }
  | {
      status: "projected";
      averagePerWeek: number;
      windowWeeks: number;
      remaining: number;
      weeksRemaining: number;
      dateKey: string;
    };

/**
 * Estimated completion date from the trailing 8-week average of VERIFIED hours. Requires at least
 * 4 weeks of verified history (first verified entry to today); with 4–8 weeks the window is the
 * history itself. Self-reported hours never move the projection. Always labelled an Estimate.
 */
export function projectCompletion(points: readonly HourPoint[], todayKey: string, required: number): Projection {
  const verifiedPoints = points.filter((p) => isVerifiedSource(p.verification) && p.dateKey <= todayKey);
  const verifiedTotal = roundHours(verifiedPoints.reduce((a, p) => a + p.hours, 0));
  if (required > 0 && verifiedTotal >= required) return { status: "complete", verified: verifiedTotal, required };
  if (verifiedPoints.length === 0) return { status: "insufficient", reason: "no-verified", weeksOfData: 0, minWeeks: PROJECTION_MIN_WEEKS };
  const firstKey = verifiedPoints.reduce((m, p) => (p.dateKey < m ? p.dateKey : m), verifiedPoints[0]!.dateKey);
  const today = dateFromKey(todayKey);
  const spanDays = daysBetween(dateFromKey(firstKey), today) + 1;
  if (spanDays < PROJECTION_MIN_WEEKS * 7) {
    return { status: "insufficient", reason: "short-history", weeksOfData: Math.floor(spanDays / 7), minWeeks: PROJECTION_MIN_WEEKS };
  }
  const windowDays = Math.min(PROJECTION_WINDOW_WEEKS * 7, spanDays);
  const windowStartKey = dateKey(addUtcDays(today, -(windowDays - 1)));
  const inWindow = verifiedPoints.filter((p) => p.dateKey >= windowStartKey).reduce((a, p) => a + p.hours, 0);
  const windowWeeks = windowDays / 7;
  const averagePerWeek = inWindow / windowWeeks;
  if (!(averagePerWeek > 0)) return { status: "stalled", windowWeeks: Math.round(windowWeeks * 10) / 10 };
  const remaining = roundHours(Math.max(0, required - verifiedTotal));
  const weeksRemaining = remaining / averagePerWeek;
  const days = Math.ceil(weeksRemaining * 7);
  return {
    status: "projected",
    averagePerWeek: roundHours(averagePerWeek),
    windowWeeks: Math.round(windowWeeks * 10) / 10,
    remaining,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    dateKey: dateKey(addUtcDays(today, days)),
  };
}

/** Milestones (from a list) reached by a verified total. */
export function reachedMilestones(verified: number, milestones: readonly number[]): number[] {
  return milestones.filter((m) => verified >= m);
}
