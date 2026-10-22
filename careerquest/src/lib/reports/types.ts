import type { CitedMetric, Interval, RecommendationAction } from "@/lib/coach/types";

/** Stored in WeeklyReport.data. Bump `version` if the shape changes; readers check it. */
export const WEEKLY_REPORT_VERSION = 1;

export type ReportSection = "applications" | "funnel" | "followups" | "progress" | "learning" | "hours";

export const SECTION_LABELS: Record<ReportSection, string> = {
  applications: "Applications",
  funnel: "Employer responses and interviews",
  followups: "Follow-ups",
  progress: "XP and missions",
  learning: "Academy",
  hours: "Work hours",
};

export type ReportRowBasis = "observed" | "self_reported" | "verified";

export type ReportRow = {
  /** Stable key, e.g. `applications.applied`. */
  key: string;
  section: ReportSection;
  label: string;
  thisWeek: number;
  priorWeek: number;
  delta: number;
  basis: ReportRowBasis;
  unit: "count" | "hours" | "xp";
  note?: string;
};

export type RateLite = { value: number | null; successes: number; n: number; interval: Interval | null };

export type CumulativeFunnel = {
  /** Last day included (YYYY-MM-DD). */
  asOf: string;
  applied: number;
  responded: number;
  interviewed: number;
  offers: number;
  responseRate: RateLite;
  interviewRate: RateLite;
};

export type ReportRecommendation = {
  id: string;
  title: string;
  body: string;
  citations: CitedMetric[];
  action: RecommendationAction;
};

export type WeeklyReportData = {
  version: typeof WEEKLY_REPORT_VERSION;
  weekStart: string;
  weekEnd: string;
  priorWeekStart: string;
  timezone: string;
  /** ISO instant the report was computed. */
  generatedAt: string;
  /** Generated after the week ended, so it covers all seven days. */
  complete: boolean;
  target: { weekly: number; daily: number };
  rows: ReportRow[];
  cumulative: { thisWeek: CumulativeFunnel; priorWeek: CumulativeFunnel };
  quizAverage: { thisWeek: number | null; priorWeek: number | null };
  missionsCompleted: string[];
  recommendations: ReportRecommendation[];
};

export type ReportWeekListItem = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  stored: { generatedAt: string; complete: boolean; applied: number | null } | null;
};
