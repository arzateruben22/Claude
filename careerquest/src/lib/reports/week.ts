/**
 * Week arithmetic and stage timing for weekly reports. Pure.
 *
 * Weeks run Monday–Sunday in the user's timezone. A record belongs to a day by the same rule the
 * rest of the app uses (`instantDateKey`): date-only values by their UTC date, real timestamps in
 * the user's timezone.
 */
import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/enums";
import { dateKeyInTz } from "@/lib/dates";
import { classifyApplication } from "@/lib/analytics/funnel";
import { rateEstimate } from "@/lib/analytics/stats";
import { addDaysKey, dayLabel, instantDateKey, isValidDayKey, weekStartKey } from "@/lib/analytics/time";
import { appliedInstant } from "@/lib/applications/status";
import type { FunnelApplication } from "@/lib/analytics/types";
import type { CumulativeFunnel, RateLite, ReportRow } from "./types";

export function isWeekStartKey(key: string | undefined | null): key is string {
  return typeof key === "string" && isValidDayKey(key) && weekStartKey(key) === key;
}

export function weekEndKey(weekStart: string): string {
  return addDaysKey(weekStart, 6);
}

export function currentWeekStartKey(timeZone: string, now = new Date()): string {
  return weekStartKey(dateKeyInTz(now, timeZone));
}

/** "Oct 12 – Oct 18, 2026" */
export function weekLabel(weekStart: string): string {
  const end = weekEndKey(weekStart);
  return `${dayLabel(weekStart)} – ${dayLabel(end, true)}`;
}

export function inWeek(key: string | null, weekStart: string): boolean {
  return key !== null && key >= weekStart && key <= weekEndKey(weekStart);
}

const INTERVIEW_STATUSES = new Set<ApplicationStatus>(["INTERVIEWING", "OFFER", "ACCEPTED", "HIRED"]);
const OFFER_STATUSES = new Set<ApplicationStatus>(["OFFER", "ACCEPTED", "HIRED"]);
const INTERVIEW_EVENTS = new Set<ApplicationEventType>(["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "ONBOARDING_RECEIVED"]);
const OFFER_EVENTS = new Set<ApplicationEventType>(["OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "ONBOARDING_RECEIVED"]);

export type StageApplication = FunnelApplication & {
  interviewRows: Array<{ createdAt: Date }>;
  offerRows: Array<{ createdAt: Date }>;
};

export type StageTimes = { applied: Date | null; responded: Date | null; interviewed: Date | null; offer: Date | null };

function earliest(dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && !Number.isNaN(d.getTime()) && (!best || d.getTime() < best.getTime())) best = d;
  return best;
}

/**
 * When an application first reached each stage. Stages are only counted for applied records (as in
 * the funnel); a stage known only from the current status falls back to `statusUpdatedAt`.
 */
export function stageTimes(app: StageApplication): StageTimes {
  const flags = classifyApplication(app);
  if (!flags.applied) return { applied: null, responded: null, interviewed: null, offer: null };
  const applied = appliedInstant(app) ?? flags.appliedAt;
  let interviewed = flags.interviewed
    ? earliest([
        ...app.statusHistory.filter((h) => INTERVIEW_STATUSES.has(h.toStatus)).map((h) => h.occurredAt),
        ...app.events.filter((e) => INTERVIEW_EVENTS.has(e.type)).map((e) => e.occurredAt),
        ...app.interviewRows.map((i) => i.createdAt),
        ...app.offerRows.map((o) => o.createdAt),
      ])
    : null;
  let offer = flags.offers
    ? earliest([
        ...app.statusHistory.filter((h) => OFFER_STATUSES.has(h.toStatus)).map((h) => h.occurredAt),
        ...app.events.filter((e) => OFFER_EVENTS.has(e.type)).map((e) => e.occurredAt),
        ...app.offerRows.map((o) => o.createdAt),
      ])
    : null;
  if (flags.interviewed && !interviewed) interviewed = app.statusUpdatedAt ?? null;
  if (flags.offers && !offer) offer = app.statusUpdatedAt ?? null;
  return { applied, responded: flags.firstResponseAt, interviewed, offer };
}

export type StageKeys = { applied: string | null; responded: string | null; interviewed: string | null; offer: string | null };

export function stageKeys(t: StageTimes, timeZone: string): StageKeys {
  const k = (d: Date | null) => (d ? instantDateKey(d, timeZone) : null);
  return { applied: k(t.applied), responded: k(t.responded), interviewed: k(t.interviewed), offer: k(t.offer) };
}

function lite(successes: number, n: number): RateLite {
  const r = rateEstimate(successes, n);
  return { value: r.value, successes: r.successes, n: r.n, interval: r.interval };
}

/** Funnel totals counting only what had happened by the end of `asOf` (inclusive day key). */
export function cumulativeFunnel(stages: readonly StageKeys[], asOf: string): CumulativeFunnel {
  const by = (k: string | null) => k !== null && k <= asOf;
  let applied = 0;
  let responded = 0;
  let interviewed = 0;
  let offers = 0;
  for (const s of stages) {
    if (!by(s.applied)) continue;
    applied++;
    if (by(s.responded)) responded++;
    if (by(s.interviewed)) interviewed++;
    if (by(s.offer)) offers++;
  }
  return { asOf, applied, responded, interviewed, offers, responseRate: lite(responded, applied), interviewRate: lite(interviewed, applied) };
}

export function row(r: Omit<ReportRow, "delta">): ReportRow {
  const round = (v: number) => (r.unit === "hours" ? Math.round(v * 100) / 100 : v);
  const thisWeek = round(r.thisWeek);
  const priorWeek = round(r.priorWeek);
  return { ...r, thisWeek, priorWeek, delta: round(thisWeek - priorWeek) };
}

/** "+3", "−2", "0" (hours keep up to two decimals). */
export function formatDelta(delta: number): string {
  if (delta === 0) return "0";
  const abs = Math.abs(delta);
  const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return delta > 0 ? `+${s}` : `−${s}`;
}

/** Percentage-point change between two rates, or null when either is unknown. */
export function pointChange(a: RateLite, b: RateLite): number | null {
  if (a.value === null || b.value === null) return null;
  return Math.round((a.value - b.value) * 1000) / 10;
}
