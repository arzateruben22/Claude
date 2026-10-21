import type { ApplicationEventType, ApplicationStatus, EventSource, InterviewType, MissionType } from "@/generated/prisma/enums";
import type { CampaignTimeline } from "@/lib/dashboard/campaign";
import type { FunnelCounts } from "@/lib/dashboard/funnel";
import type { NextAction } from "@/lib/dashboard/next-action";
import type { SeriesPoint } from "@/lib/dashboard/time";
import type { PaceResult, Suggestion } from "@/lib/goals/calculator";

export type DashboardProfile = {
  timezone: string;
  dailyApplicationTarget: number;
  workdaysPerWeek: number;
  weeklyApplicationTarget: number;
  campaignLengthDays: number;
  onboardingComplete: boolean;
  immediateSalaryTarget: number;
  longTermSalaryTarget: number;
};

export type FollowUpItem = {
  id: string;
  companyName: string;
  positionTitle: string;
  status: ApplicationStatus;
  followUpAt: Date;
  /** YYYY-MM-DD the follow-up is due (see followUpDateKey). */
  dueKey: string;
  overdue: boolean;
};

export type InterviewItem = {
  id: string;
  applicationId: string;
  companyName: string;
  positionTitle: string;
  type: InterviewType;
  scheduledAt: Date;
  location: string | null;
};

export type RecentEvent = {
  id: string;
  type: ApplicationEventType;
  label: string;
  occurredAt: Date;
  source: EventSource;
  verified: boolean;
  applicationId: string;
  companyName: string;
  positionTitle: string;
};

export type MissionItem = {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  progress: number;
  xpReward: number;
};

export type DashboardData = {
  userName: string;
  timezone: string;
  todayKey: string;
  profile: DashboardProfile;
  campaign: CampaignTimeline;
  today: { submitted: number; target: number };
  week: { submitted: number; target: number; activeDays: number; weekStartKey: string };
  /** Last 14 days of applications submitted, oldest first. */
  series: SeriesPoint[];
  funnel: FunnelCounts;
  rates: { interview: number | null; response: number | null; n: number };
  totals: { applications: number; submitted: number };
  followUps: { overdue: FollowUpItem[]; dueToday: FollowUpItem[]; capped: boolean };
  interviews: InterviewItem[];
  xp: { totalXp: number; level: number; current: number; next: number; progress: number };
  streak: { current: number; longest: number; lastActiveKey: string | null };
  recent: RecentEvent[];
  missions: MissionItem[];
  nextAction: NextAction;
};

export type GoalsData = {
  timezone: string;
  todayKey: string;
  campaignStartKey: string;
  campaign: CampaignTimeline;
  profile: DashboardProfile;
  completed: number;
  responses: number;
  responseRate: number | null;
  activityByDate: Record<string, number>;
  pace: PaceResult;
  suggestions: Suggestion[];
  /** Explains which thresholds are unmet when `suggestions` is empty. */
  dataRequirements: string;
};
