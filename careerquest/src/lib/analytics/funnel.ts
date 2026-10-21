/**
 * Funnel + conversion math for analytics. Pure functions; no database access.
 *
 * An application "reached" a stage when its current status is at/after that stage, its status
 * history shows it was ever at/after that stage, or an event of that stage's type was recorded.
 * Later stages imply earlier ones, so counts are nested (hired ⊆ offers ⊆ interviewed ⊆ ...).
 * Every stage after "applied" is counted among applied applications only, so each rate is a true
 * proportion of the applications you actually submitted.
 */
import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/enums";
import { isSubmittedStatus } from "@/lib/applications/status";
import { LOW_SAMPLE_N, mean, median, rateEstimate, wilsonInterval } from "@/lib/analytics/stats";
import { DAY_MS, addDaysKey, dayLabel, diffDaysKey, weekStartKey } from "@/lib/analytics/time";
import type {
  ActivityRow,
  ConversionDimension,
  ConversionRow,
  DailyPoint,
  FunnelApplication,
  FunnelCounts,
  FunnelResult,
  ResponseTiming,
  StageFlags,
  WeeklyPoint,
} from "@/lib/analytics/types";

const RESPONSE_STATUSES = new Set<ApplicationStatus>(["SCREENING", "INTERVIEWING", "OFFER", "ACCEPTED", "HIRED", "REJECTED"]);
const SCREEN_STATUSES = new Set<ApplicationStatus>(["SCREENING", "INTERVIEWING", "OFFER", "ACCEPTED", "HIRED"]);
const INTERVIEW_STATUSES = new Set<ApplicationStatus>(["INTERVIEWING", "OFFER", "ACCEPTED", "HIRED"]);
const OFFER_STATUSES = new Set<ApplicationStatus>(["OFFER", "ACCEPTED", "HIRED"]);
const HIRED_STATUSES = new Set<ApplicationStatus>(["ACCEPTED", "HIRED"]);

/** Events that prove a human on the employer side reacted (auto-confirmations do not count). */
const RESPONSE_EVENTS = new Set<ApplicationEventType>([
  "RECRUITER_RESPONSE",
  "SCREENING_SCHEDULED",
  "ASSESSMENT_INVITED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "ONBOARDING_RECEIVED",
]);
const SCREEN_EVENTS = new Set<ApplicationEventType>([
  "SCREENING_SCHEDULED",
  "ASSESSMENT_INVITED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "ONBOARDING_RECEIVED",
]);
const INTERVIEW_EVENTS = new Set<ApplicationEventType>([
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "ONBOARDING_RECEIVED",
]);
const OFFER_EVENTS = new Set<ApplicationEventType>(["OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "ONBOARDING_RECEIVED"]);
const HIRED_EVENTS = new Set<ApplicationEventType>(["OFFER_ACCEPTED", "ONBOARDING_RECEIVED"]);
const APPLIED_HISTORY = new Set<ApplicationStatus>(["SUBMITTED", "CONFIRMED"]);

function earliest(dates: Date[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (!Number.isNaN(d.getTime()) && (!best || d.getTime() < best.getTime())) best = d;
  return best;
}

/** Classify one application: which stages it ever reached and the timestamps the timing stats need. */
export function classifyApplication(app: FunnelApplication): StageFlags {
  const statuses = [app.status, ...app.statusHistory.map((h) => h.toStatus)];
  const everStatus = (set: Set<ApplicationStatus>) => statuses.some((s) => set.has(s));
  const everEvent = (set: Set<ApplicationEventType>) => app.events.some((e) => set.has(e.type));

  const applied = statuses.some(isSubmittedStatus) || app.events.some((e) => e.type === "APPLIED");
  const hired = everStatus(HIRED_STATUSES) || everEvent(HIRED_EVENTS);
  const offers = hired || everStatus(OFFER_STATUSES) || everEvent(OFFER_EVENTS) || app.hasOffers === true;
  const interviewed = offers || everStatus(INTERVIEW_STATUSES) || everEvent(INTERVIEW_EVENTS) || app.hasInterviews === true;
  const screened = interviewed || everStatus(SCREEN_STATUSES) || everEvent(SCREEN_EVENTS);
  const responded = screened || everStatus(RESPONSE_STATUSES) || everEvent(RESPONSE_EVENTS);

  const appliedAt =
    app.appliedAt ??
    earliest([
      ...app.events.filter((e) => e.type === "APPLIED").map((e) => e.occurredAt),
      ...app.statusHistory.filter((h) => APPLIED_HISTORY.has(h.toStatus)).map((h) => h.occurredAt),
    ]);

  let firstResponseAt = earliest([
    ...app.statusHistory.filter((h) => RESPONSE_STATUSES.has(h.toStatus)).map((h) => h.occurredAt),
    ...app.events.filter((e) => RESPONSE_EVENTS.has(e.type)).map((e) => e.occurredAt),
  ]);
  if (!firstResponseAt && responded && RESPONSE_STATUSES.has(app.status) && app.statusUpdatedAt) firstResponseAt = app.statusUpdatedAt;

  // Only applied applications feed the later stages (rates are "per applied").
  return {
    applied,
    responded: applied && responded,
    screened: applied && screened,
    interviewed: applied && interviewed,
    offers: applied && offers,
    hired: applied && hired,
    appliedAt,
    firstResponseAt: applied ? firstResponseAt : null,
  };
}

export function computeFunnel(applications: FunnelApplication[]): FunnelResult {
  const counts: FunnelCounts = { total: applications.length, applied: 0, responded: 0, screened: 0, interviewed: 0, offers: 0, hired: 0 };
  for (const app of applications) {
    const f = classifyApplication(app);
    if (f.applied) counts.applied++;
    if (f.responded) counts.responded++;
    if (f.screened) counts.screened++;
    if (f.interviewed) counts.interviewed++;
    if (f.offers) counts.offers++;
    if (f.hired) counts.hired++;
  }
  return {
    counts,
    rates: {
      responseRate: rateEstimate(counts.responded, counts.applied),
      interviewRate: rateEstimate(counts.interviewed, counts.applied),
      offerRate: rateEstimate(counts.offers, counts.applied),
    },
    lowSample: counts.applied < LOW_SAMPLE_N,
  };
}

/**
 * Days from the application date to the first employer response. Applications without both
 * timestamps are excluded (n tells the reader how many were usable). A response recorded slightly
 * before a date-only application date (same calendar day) counts as 0 days; earlier is a data
 * error and is skipped.
 */
export function averageDaysToResponse(applications: FunnelApplication[]): ResponseTiming {
  const days: number[] = [];
  for (const app of applications) {
    const f = classifyApplication(app);
    if (!f.appliedAt || !f.firstResponseAt) continue;
    const d = (f.firstResponseAt.getTime() - f.appliedAt.getTime()) / DAY_MS;
    if (d < -1) continue;
    days.push(Math.max(0, d));
  }
  return { averageDays: mean(days), medianDays: median(days), n: days.length };
}

function dimensionKey(app: FunnelApplication, dimension: ConversionDimension): string | null {
  switch (dimension) {
    case "source":
      return app.source;
    case "jobCategory": {
      const v = app.jobCategory?.trim();
      return v ? v : null;
    }
    case "resumeVersionId":
      return app.resumeVersionId || null;
  }
}

/** Conversion rows per distinct value of a dimension, most-applied first. */
export function conversionBy(applications: FunnelApplication[], dimension: ConversionDimension): ConversionRow[] {
  const groups = new Map<string | null, { total: number; applied: number; responded: number; interviews: number; offers: number }>();
  for (const app of applications) {
    const key = dimensionKey(app, dimension);
    const g = groups.get(key) ?? { total: 0, applied: 0, responded: 0, interviews: 0, offers: 0 };
    const f = classifyApplication(app);
    g.total++;
    if (f.applied) g.applied++;
    if (f.responded) g.responded++;
    if (f.interviewed) g.interviews++;
    if (f.offers) g.offers++;
    groups.set(key, g);
  }
  const rows: ConversionRow[] = [];
  for (const [key, g] of groups) {
    rows.push({
      key,
      ...g,
      interviewRate: g.applied > 0 ? g.interviews / g.applied : null,
      interval: wilsonInterval(g.interviews, g.applied),
      lowSample: g.applied < LOW_SAMPLE_N,
    });
  }
  // Most applied first; real values before the "none" bucket; then by volume, then alphabetically.
  rows.sort(
    (a, b) =>
      b.applied - a.applied || Number(a.key === null) - Number(b.key === null) || b.total - a.total || (a.key ?? "").localeCompare(b.key ?? ""),
  );
  return rows;
}

export type DailySeriesInput = {
  /** Inclusive day-key window. */
  fromKey: string;
  toKey: string;
  /** Day keys (user calendar) of APPLIED events in the filtered set, one entry per event. */
  appliedKeys: string[];
  /** DailyActivity rows (unfiltered activity log). */
  activity: ActivityRow[];
};

/** Hard cap so a bad range can't build a huge array. */
export const MAX_SERIES_DAYS = 400;

/** One point per day in [fromKey, toKey]; missing days are zero. Empty when the window is invalid. */
export function dailySeries(input: DailySeriesInput): DailyPoint[] {
  const span = diffDaysKey(input.fromKey, input.toKey);
  if (!Number.isFinite(span) || span < 0) return [];
  const applied = new Map<string, number>();
  for (const k of input.appliedKeys) applied.set(k, (applied.get(k) ?? 0) + 1);
  const activity = new Map(input.activity.map((a) => [a.key, a]));
  const out: DailyPoint[] = [];
  const days = Math.min(span + 1, MAX_SERIES_DAYS);
  // Keep the most recent days when the window exceeds the cap.
  const startKey = addDaysKey(input.toKey, -(days - 1));
  for (let i = 0; i < days; i++) {
    const key = addDaysKey(startKey, i);
    const a = activity.get(key);
    out.push({ key, label: dayLabel(key), applied: applied.get(key) ?? 0, followUps: a?.followUps ?? 0, logged: a?.applicationsSubmitted ?? 0 });
  }
  return out;
}

/** Aggregate daily points into Monday-based weeks (oldest first). */
export function weeklySeries(daily: DailyPoint[]): WeeklyPoint[] {
  const weeks = new Map<string, WeeklyPoint>();
  for (const p of daily) {
    const key = weekStartKey(p.key);
    const w = weeks.get(key) ?? {
      key,
      label: dayLabel(key),
      rangeLabel: `${dayLabel(key)} – ${dayLabel(addDaysKey(key, 6))}`,
      applied: 0,
      followUps: 0,
      logged: 0,
      days: 0,
    };
    w.applied += p.applied;
    w.followUps += p.followUps;
    w.logged += p.logged;
    w.days += 1;
    weeks.set(key, w);
  }
  return [...weeks.values()].sort((a, b) => a.key.localeCompare(b.key));
}
