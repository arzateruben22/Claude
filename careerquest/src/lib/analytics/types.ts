import type { ApplicationEventType, ApplicationSource, ApplicationStatus } from "@/generated/prisma/enums";
import type { Interval, RateEstimate } from "@/lib/analytics/stats";

/** The minimal shape of an application the funnel needs. Prisma rows satisfy it after a light map. */
export type FunnelApplication = {
  id?: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
  /** Used as the response timestamp of last resort when no history/event carries one. */
  statusUpdatedAt?: Date | null;
  createdAt?: Date;
  statusHistory: Array<{ toStatus: ApplicationStatus; occurredAt: Date }>;
  events: Array<{ type: ApplicationEventType; occurredAt: Date }>;
  source: ApplicationSource;
  jobCategory: string | null;
  resumeVersionId: string | null;
  /** Interview / Offer rows attached to the application (dashboard parity). */
  hasInterviews?: boolean;
  hasOffers?: boolean;
};

export type FunnelStageKey = "applied" | "responded" | "screened" | "interviewed" | "offers" | "hired";

export const FUNNEL_STAGE_KEYS: FunnelStageKey[] = ["applied", "responded", "screened", "interviewed", "offers", "hired"];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  applied: "Applied",
  responded: "Responded",
  screened: "Screened",
  interviewed: "Interviewed",
  offers: "Offers",
  hired: "Hired",
};

export type FunnelCounts = Record<FunnelStageKey, number> & {
  /** Every application considered, including saved/preparing ones that never applied. */
  total: number;
};

export type FunnelRates = {
  responseRate: RateEstimate;
  interviewRate: RateEstimate;
  offerRate: RateEstimate;
};

export type FunnelResult = {
  counts: FunnelCounts;
  rates: FunnelRates;
  /** True when fewer than LOW_SAMPLE_N applications were applied. */
  lowSample: boolean;
};

/** Per-application classification: which stages were ever reached and when the first response came. */
export type StageFlags = {
  applied: boolean;
  responded: boolean;
  screened: boolean;
  interviewed: boolean;
  offers: boolean;
  hired: boolean;
  /** Resolved application timestamp (appliedAt, else first APPLIED event / SUBMITTED history). */
  appliedAt: Date | null;
  /** Earliest timestamp at which the employer is known to have responded. */
  firstResponseAt: Date | null;
};

export type ConversionDimension = "source" | "jobCategory" | "resumeVersionId";

export type ConversionRow = {
  /** Raw dimension value; null when the application has no value for it. */
  key: string | null;
  total: number;
  applied: number;
  responded: number;
  interviews: number;
  offers: number;
  /** interviews / applied, or null when applied = 0. */
  interviewRate: number | null;
  interval: Interval | null;
  lowSample: boolean;
};

export type ResponseTiming = {
  averageDays: number | null;
  medianDays: number | null;
  /** Applications with both an application date and a response timestamp. */
  n: number;
};

export type DailyPoint = {
  /** YYYY-MM-DD in the user's calendar. */
  key: string;
  /** e.g. "Oct 21" */
  label: string;
  /** APPLIED events dated that day (filtered set). */
  applied: number;
  /** Follow-ups from the daily activity log. */
  followUps: number;
  /** Applications the activity log recorded that day (unfiltered cross-check). */
  logged: number;
};

export type WeeklyPoint = {
  /** YYYY-MM-DD of the Monday starting the week. */
  key: string;
  /** e.g. "Oct 13" */
  label: string;
  /** e.g. "Oct 13 – Oct 19" */
  rangeLabel: string;
  applied: number;
  followUps: number;
  logged: number;
  /** Number of days of the week that fall inside the series window. */
  days: number;
};

export type ActivityRow = { key: string; applicationsSubmitted: number; followUps: number };
