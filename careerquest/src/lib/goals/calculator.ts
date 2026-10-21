/**
 * "Numbers game" pace calculator. Pure functions only (no database, no server-only imports) so
 * they run identically in unit tests, Server Components and the client-side calculator.
 *
 * Vocabulary:
 * - campaignDay: 1-based index of today inside the campaign (0 when the campaign has not started).
 * - workday: a day the user plans to apply on. `workdaysPerWeek / 7` converts calendar days to
 *   workdays; we never assume which weekdays those are.
 * - Every "projected" date is an extrapolation of the observed pace, never a guarantee.
 */
import { addDaysUtc as addUtcDays, diffDaysUtc as daysBetween, utcDateKey as dateKey } from "@/lib/goals/days";
import { APPLICATION_MILESTONES } from "@/lib/game/xp-config";

export const DEFAULT_MILESTONES: readonly number[] = APPLICATION_MILESTONES;

export type PaceInput = {
  dailyTarget: number;
  workdaysPerWeek: number;
  campaignLengthDays: number;
  /** UTC-midnight date the campaign started. */
  campaignStartDate: Date;
  /** UTC-midnight date for "today" in the user's timezone. */
  today: Date;
  completedApplications: number;
  milestoneTargets?: readonly number[];
  /** Number of qualifying postings the user believes are available to them (optional). */
  availableOpportunities?: number | null;
  /** Observed employer response rate as a fraction 0..1 (optional). */
  historicalResponseRate?: number | null;
  /** YYYY-MM-DD → applications submitted that day; enables the consistency metric. */
  activityByDate?: Record<string, number> | null;
};

export type MilestoneProjection = {
  milestone: number;
  achieved: boolean;
  remaining: number;
  /** Date the milestone would be reached at the observed pace; null when achieved or pace is 0. */
  projectedDate: Date | null;
  /** Whether the projection lands on or before the campaign end date (null when no projection). */
  withinCampaign: boolean | null;
};

export type OpportunityOutlook = {
  available: number;
  remainingAvailable: number;
  goalExceedsAvailable: boolean;
  reachableGoal: number;
  /** Calendar days the remaining opportunities would last at the daily target (null when target is 0). */
  runwayDays: number | null;
};

export type PaceResult = {
  campaignDay: number;
  campaignLengthDays: number;
  campaignEndDate: Date;
  /** Full days completed before today, clamped to the campaign length. */
  daysElapsed: number;
  /** Days left including today, clamped to [0, campaignLengthDays]. */
  daysRemaining: number;
  beyondCampaign: boolean;
  elapsedWorkdays: number;
  remainingWorkdays: number;
  campaignGoalApplications: number;
  remainingToGoal: number;
  progressRatio: number;
  /** Applications expected by the start of today at the configured target. */
  expectedByToday: number;
  onTrack: boolean;
  /** Per workday / per week needed from today to hit the campaign goal; null when the campaign is over and the goal is unmet. */
  requiredDailyPace: number | null;
  requiredWeeklyPace: number | null;
  observedDailyPace: number;
  observedWeeklyPace: number;
  nextMilestone: number | null;
  remainingToNextMilestone: number;
  projectedMilestoneDates: MilestoneProjection[];
  projectedGoalDate: Date | null;
  /** Fraction of elapsed workdays with at least one application; null without activity data. */
  consistency: number | null;
  /** completed × historical response rate — an estimate, not a forecast of outcomes. */
  expectedResponses: number | null;
  expectedResponsesAtGoal: number | null;
  opportunity: OpportunityOutlook | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeInt(n: number, fallback = 0) {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

/** Calendar days needed to cover `workdays` at `workdaysPerWeek` (rounded up). */
export function workdaysToCalendarDays(workdays: number, workdaysPerWeek: number): number {
  if (workdays <= 0) return 0;
  const wpw = clamp(workdaysPerWeek, 1, 7);
  return Math.ceil((workdays * 7) / wpw);
}

/** Workdays contained in `calendarDays` at `workdaysPerWeek` (continuous, not rounded). */
export function calendarDaysToWorkdays(calendarDays: number, workdaysPerWeek: number): number {
  if (calendarDays <= 0) return 0;
  return (calendarDays * clamp(workdaysPerWeek, 1, 7)) / 7;
}

export function campaignGoal(dailyTarget: number, workdaysPerWeek: number, campaignLengthDays: number): number {
  const weeks = Math.max(0, campaignLengthDays) / 7;
  return Math.round(Math.max(0, dailyTarget) * clamp(workdaysPerWeek, 1, 7) * weeks);
}

export function computePace(input: PaceInput): PaceResult {
  const dailyTarget = Math.max(0, input.dailyTarget || 0);
  const wpw = clamp(input.workdaysPerWeek || 5, 1, 7);
  const length = Math.max(1, safeInt(input.campaignLengthDays, 90));
  const completed = safeInt(input.completedApplications);
  const milestones = [...(input.milestoneTargets ?? DEFAULT_MILESTONES)].filter((m) => m > 0).sort((a, b) => a - b);

  const campaignDay = Math.max(0, daysBetween(input.campaignStartDate, input.today) + 1);
  const campaignEndDate = addUtcDays(input.campaignStartDate, length - 1);
  const daysElapsed = clamp(campaignDay - 1, 0, length);
  const daysRemaining = clamp(length - daysElapsed, 0, length);
  const beyondCampaign = campaignDay > length;

  // Observed pace counts today (so the first day never divides by zero) and keeps counting past
  // the campaign end so late applications are not attributed to a shorter window.
  const elapsedWorkdays = campaignDay <= 0 ? 0 : Math.max(1, calendarDaysToWorkdays(campaignDay, wpw));
  const remainingWorkdays = calendarDaysToWorkdays(daysRemaining, wpw);

  const goal = campaignGoal(dailyTarget, wpw, length);
  const remainingToGoal = Math.max(0, goal - completed);
  const progressRatio = goal > 0 ? clamp(completed / goal, 0, 1) : 0;
  const expectedByToday = Math.floor(dailyTarget * calendarDaysToWorkdays(daysElapsed, wpw));
  const onTrack = beyondCampaign ? remainingToGoal === 0 : completed >= expectedByToday;

  let requiredDailyPace: number | null;
  if (remainingToGoal === 0) requiredDailyPace = 0;
  else if (remainingWorkdays <= 0) requiredDailyPace = null;
  else requiredDailyPace = remainingToGoal / remainingWorkdays;
  const requiredWeeklyPace = requiredDailyPace === null ? null : requiredDailyPace * wpw;

  const observedDailyPace = elapsedWorkdays > 0 ? completed / elapsedWorkdays : 0;
  const observedWeeklyPace = observedDailyPace * wpw;

  const projectAt = (remaining: number): Date | null => {
    if (remaining <= 0 || observedDailyPace <= 0) return null;
    return addUtcDays(input.today, workdaysToCalendarDays(remaining / observedDailyPace, wpw));
  };

  const projectedMilestoneDates: MilestoneProjection[] = milestones.map((milestone) => {
    const achieved = completed >= milestone;
    const remaining = Math.max(0, milestone - completed);
    const projectedDate = achieved ? null : projectAt(remaining);
    return {
      milestone,
      achieved,
      remaining,
      projectedDate,
      withinCampaign: projectedDate ? projectedDate.getTime() <= campaignEndDate.getTime() : null,
    };
  });
  const next = projectedMilestoneDates.find((m) => !m.achieved) ?? null;

  const consistency = computeConsistency(input.activityByDate ?? null, input.campaignStartDate, input.today, campaignDay, wpw);

  const rate = normalizeRate(input.historicalResponseRate);
  const expectedResponses = rate === null ? null : completed * rate;
  const expectedResponsesAtGoal = rate === null ? null : goal * rate;

  const opportunity = buildOpportunityOutlook(input.availableOpportunities, completed, goal, dailyTarget, wpw);

  return {
    campaignDay,
    campaignLengthDays: length,
    campaignEndDate,
    daysElapsed,
    daysRemaining,
    beyondCampaign,
    elapsedWorkdays,
    remainingWorkdays,
    campaignGoalApplications: goal,
    remainingToGoal,
    progressRatio,
    expectedByToday,
    onTrack,
    requiredDailyPace,
    requiredWeeklyPace,
    observedDailyPace,
    observedWeeklyPace,
    nextMilestone: next?.milestone ?? null,
    remainingToNextMilestone: next?.remaining ?? 0,
    projectedMilestoneDates,
    projectedGoalDate: projectAt(remainingToGoal),
    consistency,
    expectedResponses,
    expectedResponsesAtGoal,
    opportunity,
  };
}

function normalizeRate(rate: number | null | undefined): number | null {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return null;
  return clamp(rate, 0, 1);
}

function computeConsistency(
  activityByDate: Record<string, number> | null,
  start: Date,
  today: Date,
  campaignDay: number,
  wpw: number,
): number | null {
  if (!activityByDate || campaignDay <= 0) return null;
  const startKey = dateKey(start);
  const todayKey = dateKey(today);
  let activeDays = 0;
  for (const [key, count] of Object.entries(activityByDate)) {
    if (key >= startKey && key <= todayKey && count >= 1) activeDays++;
  }
  const elapsedWorkdaysRounded = Math.max(1, Math.round(calendarDaysToWorkdays(campaignDay, wpw)));
  return clamp(activeDays / elapsedWorkdaysRounded, 0, 1);
}

function buildOpportunityOutlook(
  available: number | null | undefined,
  completed: number,
  goal: number,
  dailyTarget: number,
  wpw: number,
): OpportunityOutlook | null {
  if (available === null || available === undefined || !Number.isFinite(available)) return null;
  const avail = Math.max(0, Math.floor(available));
  const remainingAvailable = Math.max(0, avail - completed);
  return {
    available: avail,
    remainingAvailable,
    goalExceedsAvailable: goal > avail,
    reachableGoal: Math.min(goal, avail),
    runwayDays: dailyTarget > 0 ? workdaysToCalendarDays(remainingAvailable / dailyTarget, wpw) : null,
  };
}

// ---------------------------------------------------------------------------
// Weekly targets / progress
// ---------------------------------------------------------------------------

export type WeekTargetProfile = {
  dailyApplicationTarget: number;
  workdaysPerWeek: number;
  weeklyApplicationTarget: number;
};

export type WeekTargets = {
  dailyTarget: number;
  workdaysPerWeek: number;
  /** The weekly target to measure against: the explicit profile value, or daily × workdays when unset. */
  weeklyTarget: number;
  /** daily × workdays, for showing when the explicit weekly target disagrees with it. */
  impliedWeeklyTarget: number;
  mismatch: boolean;
};

export function weekTargets(profile: WeekTargetProfile): WeekTargets {
  const dailyTarget = Math.max(0, profile.dailyApplicationTarget || 0);
  const workdaysPerWeek = clamp(profile.workdaysPerWeek || 5, 1, 7);
  const impliedWeeklyTarget = dailyTarget * workdaysPerWeek;
  const explicit = Math.max(0, profile.weeklyApplicationTarget || 0);
  const weeklyTarget = explicit > 0 ? explicit : impliedWeeklyTarget;
  return { dailyTarget, workdaysPerWeek, weeklyTarget, impliedWeeklyTarget, mismatch: explicit > 0 && explicit !== impliedWeeklyTarget };
}

export type WeekProgress = {
  weekStart: Date;
  weekEnd: Date;
  days: { key: string; count: number }[];
  submitted: number;
  activeDays: number;
};

/** Sum of applications per day for the 7 days starting at `weekStart` (UTC-midnight Monday). */
export function weekProgress(activityByDate: Record<string, number>, weekStart: Date): WeekProgress {
  const days: { key: string; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = dateKey(addUtcDays(weekStart, i));
    days.push({ key, count: Math.max(0, activityByDate[key] ?? 0) });
  }
  return {
    weekStart,
    weekEnd: addUtcDays(weekStart, 6),
    days,
    submitted: days.reduce((a, d) => a + d.count, 0),
    activeDays: days.filter((d) => d.count > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Adjustment recommendations (observed results → plain-language suggestions)
// ---------------------------------------------------------------------------

export type AdjustmentInput = {
  dailyTarget: number;
  workdaysPerWeek: number;
  campaignDay: number;
  completedApplications: number;
  /** Applications that received any employer response. */
  responses: number;
  observedDailyPace: number;
  requiredDailyPace: number | null;
  consistency: number | null;
};

export type Suggestion = {
  id: "pace-behind" | "pace-ahead" | "response-low" | "response-healthy" | "consistency-low";
  tone: "info" | "warning" | "success";
  /** The observed metric the suggestion is based on. */
  metric: string;
  text: string;
};

const MIN_DAYS_FOR_PACE_ADVICE = 14;
const MIN_APPLICATIONS_FOR_RESPONSE_ADVICE = 30;

const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;
const perDay = (n: number) => n.toFixed(1);

/**
 * Rule-based, deliberately cautious. Each suggestion cites the metric it is based on and uses
 * probabilistic wording; nothing here claims an employment outcome.
 */
export function recommendAdjustments(input: AdjustmentInput): Suggestion[] {
  const out: Suggestion[] = [];
  const { campaignDay, completedApplications: completed, responses, observedDailyPace: observed, requiredDailyPace: required } = input;
  const enoughDays = campaignDay >= MIN_DAYS_FOR_PACE_ADVICE;

  if (enoughDays && required !== null && required > 0 && observed < required * 0.9) {
    const lowered = Math.max(1, Math.round(observed));
    out.push({
      id: "pace-behind",
      tone: "warning",
      metric: `Observed ${perDay(observed)}/workday vs ${perDay(required)}/workday now required (${campaignDay} days observed)`,
      text:
        `Over the first ${campaignDay} days you have averaged about ${perDay(observed)} applications per workday, below the ` +
        `${perDay(required)} per workday now needed to reach your campaign goal. Based on that observed pace, consider either ` +
        `lowering your daily target to about ${lowered} so the goal reflects what you can sustain, or widening the job categories ` +
        `and sources you draw from so more qualifying postings are available each day.`,
    });
  }

  if (enoughDays && input.dailyTarget > 0 && observed >= input.dailyTarget * 1.5) {
    const raised = Math.round(observed);
    out.push({
      id: "pace-ahead",
      tone: "success",
      metric: `Observed ${perDay(observed)}/workday vs a target of ${input.dailyTarget}/workday`,
      text:
        `You are averaging about ${perDay(observed)} applications per workday, well above your target of ${input.dailyTarget}. ` +
        `If the quality of each application is holding up, consider raising the target to about ${raised} so the campaign goal ` +
        `reflects your actual pace.`,
    });
  }

  if (completed >= MIN_APPLICATIONS_FOR_RESPONSE_ADVICE) {
    const rate = responses / completed;
    if (rate < 0.05) {
      out.push({
        id: "response-low",
        tone: "warning",
        metric: `${responses} responses from ${completed} applications (${pct(rate)})`,
        text:
          `Based on your observed response rate of ${pct(rate)} across ${completed} applications, your résumé or targeting may not ` +
          `be matching what employers screen for. Consider reviewing your résumé against the postings you apply to and narrowing to ` +
          `roles that closely match your experience. Response rates vary widely by market and role; treat this as a signal to ` +
          `investigate, not a verdict.`,
      });
    } else if (rate >= 0.15) {
      out.push({
        id: "response-healthy",
        tone: "success",
        metric: `${responses} responses from ${completed} applications (${pct(rate)})`,
        text:
          `Your observed response rate of ${pct(rate)} over ${completed} applications is comparatively strong, which suggests the ` +
          `categories and sources you are using are a reasonable fit. Based on that, keeping the same targeting while maintaining ` +
          `volume and follow-ups seems sensible.`,
      });
    }
  }

  if (enoughDays && input.consistency !== null && input.consistency < 0.5) {
    out.push({
      id: "consistency-low",
      tone: "info",
      metric: `Applied on ${pct(input.consistency)} of workdays so far`,
      text:
        `You have applied on about ${pct(input.consistency)} of your planned workdays. Smaller daily batches are usually easier to ` +
        `sustain than occasional bursts; based on the days you actually apply, a lower daily target spread across more days may be ` +
        `easier to keep up with.`,
    });
  }

  return out;
}

/** Why no suggestions are available yet, for honest empty states. */
export function adjustmentDataRequirements(input: Pick<AdjustmentInput, "campaignDay" | "completedApplications">): string {
  const parts: string[] = [];
  if (input.campaignDay < MIN_DAYS_FOR_PACE_ADVICE) {
    parts.push(`${MIN_DAYS_FOR_PACE_ADVICE} campaign days (currently ${Math.max(0, input.campaignDay)})`);
  }
  if (input.completedApplications < MIN_APPLICATIONS_FOR_RESPONSE_ADVICE) {
    parts.push(`${MIN_APPLICATIONS_FOR_RESPONSE_ADVICE} submitted applications (currently ${input.completedApplications})`);
  }
  return parts.length ? `Pace suggestions need ${parts.join(" and response suggestions need ")}.` : "";
}
