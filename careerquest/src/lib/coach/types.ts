/**
 * Shared types for the CareerQuest Advisor. Pure (no server imports) so client components, the
 * rules engine and tests can use them.
 *
 * Every number the advisor shows is a `Metric` with a stable `id`. Recommendations and chat replies
 * cite metric ids, and the UI turns each citation into a chip that reveals the underlying value,
 * sample size and interval, so no claim is ever detached from the data it came from.
 */

/** Where a number comes from. The UI shows this as a visible label, never only as a color. */
export type MetricBasis = "observed" | "self_reported" | "verified" | "estimate" | "target" | "reference";

export const BASIS_LABELS: Record<MetricBasis, string> = {
  observed: "Observed",
  self_reported: "Self-reported",
  verified: "Verified",
  estimate: "Estimate",
  target: "Your target",
  reference: "Reference data",
};

export type Interval = { low: number; high: number };

export type Metric = {
  /** Stable id used in citations, e.g. `funnel.response_rate`. Lowercase, dots/underscores/hyphens. */
  id: string;
  label: string;
  /** Primary numeric value (rates as 0..1), a short text value, or null when unknown. */
  value: number | string | null;
  /** Human-readable value, e.g. "8.0% (6 of 75)". */
  display: string;
  basis: MetricBasis;
  /** Sample size behind a rate. */
  n?: number;
  successes?: number;
  /** 95% Wilson interval for rates. */
  interval?: Interval | null;
  lowSample?: boolean;
  /** One-line explanation of how the number is defined. */
  detail?: string;
  /** Where in the app the user can see the underlying records. */
  href?: string;
};

/** The subset of a metric stored with a message or report, frozen at the time it was cited. */
export type CitedMetric = Pick<Metric, "id" | "label" | "display" | "basis" | "detail" | "n" | "interval" | "lowSample" | "href">;

export type RecommendationAction = { label: string; href: string };

export type Recommendation = {
  id: string;
  /** 0–100; higher is more urgent. */
  priority: number;
  title: string;
  /** Plain text that may contain `[metric.id]` citation tokens. */
  body: string;
  /** Metric ids this recommendation is based on (every one exists in the snapshot). */
  citations: string[];
  action: RecommendationAction;
  /** Recommendations in the same group compete for one weekly-priority slot. */
  group?: string;
};

// ---------------------------------------------------------------------------
// Facts: the typed, JSON-serializable input to the snapshot and the rules engine.
// Loaded from the database by `metrics.ts`; built by hand in tests.
// ---------------------------------------------------------------------------

export type ConversionFact = {
  /** Raw dimension value (category text, source enum, résumé version id). */
  key: string;
  label: string;
  applied: number;
  responded: number;
  interviews: number;
  offers: number;
};

export type TrackFact = { key: string; label: string; completed: number; total: number };

export type QuizFact = { quizKey: string; label: string; percent: number; passed: boolean; at: string; href: string };

export type InterviewFact = {
  id: string;
  applicationId: string;
  company: string;
  title: string;
  type: string;
  scheduledAt: string;
  hoursUntil: number;
  prepDone: boolean;
};

export type OfferFact = {
  applicationId: string;
  company: string;
  title: string;
  status: string;
  baseAmount: number;
  period: "HOURLY" | "ANNUAL";
  annualized: number | null;
  decisionDue: string | null;
  daysToDecision: number | null;
};

export type ProgramFact = {
  slug: string;
  name: string;
  sponsor: string;
  region: string;
  isUnion: boolean;
  recruitmentStatus: "OPEN" | "CLOSED" | "UNVERIFIED";
  /** YYYY-MM-DD the recruitment status was last checked, or null. */
  verifiedOn: string | null;
  recruitmentNote: string | null;
  website: string | null;
  applyUrl: string | null;
  startingWage: string | null;
  startingWageVerified: boolean;
  durationYears: number | null;
  classroomHours: string | null;
  /** The user's own tracking status for this program, or null when not saved. */
  interestStatus: string | null;
};

export type StaleApplicationFact = { id: string; company: string; title: string; daysSinceActivity: number };

export type CoachFacts = {
  /** ISO instant the facts were read. */
  generatedAt: string;
  timezone: string;
  todayKey: string;
  weekStartKey: string;
  profile: {
    name: string;
    onboardingComplete: boolean;
    dailyTarget: number;
    weeklyTarget: number;
    workdaysPerWeek: number;
    immediateSalaryTarget: number;
    longTermSalaryTarget: number;
    openToApprenticeships: boolean;
    primaryTrade: string;
  };
  campaign: {
    started: boolean;
    beyond: boolean;
    day: number;
    lengthDays: number;
    phase: 1 | 2 | 3 | null;
    phaseName: string | null;
    daysRemaining: number;
  };
  funnel: { total: number; applied: number; responded: number; screened: number; interviewed: number; offers: number; hired: number };
  conversions: { category: ConversionFact[]; source: ConversionFact[]; resume: ConversionFact[] };
  week: {
    applied: number;
    target: number;
    dailyTarget: number;
    /** Daily target × planned workdays elapsed before today (capped at the weekly target). */
    expectedByYesterday: number;
    activeDays: number;
    todayApplied: number;
    todayIsWorkday: boolean;
  };
  followUps: { overdue: number; dueToday: number; firstOverdueId: string | null };
  stale: { count: number; items: StaleApplicationFact[] };
  streak: { current: number; longest: number; consecutiveActiveDays: number };
  academy: {
    tracks: TrackFact[];
    lessonsCompleted: number;
    lessonsTotal: number;
    inProgress: number;
    next: { key: string; title: string } | null;
    daysSinceActivity: number | null;
    recentQuizzes: QuizFact[];
  };
  hours: { selfReported: number; verified: number; entries: number; daysSinceLast: number | null };
  interviews: { upcoming7d: number; attended: number; next: InterviewFact | null };
  offers: { open: OfferFact[] };
  resumes: { count: number; latestName: string | null; latestId: string | null; defaultId: string | null };
  programs: ProgramFact[];
  xp: { total: number };
};

export type CoachSnapshot = {
  facts: CoachFacts;
  /** Metric list in display order. */
  metrics: Metric[];
  /** Same metrics keyed by id. */
  byId: Record<string, Metric>;
};
