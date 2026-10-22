import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { startOfWeekUtc, todayInTz } from "@/lib/dates";
import { levelFromXp } from "@/lib/game/xp-config";
import { campaignTimeline, type CampaignTimeline } from "@/lib/dashboard/campaign";
import { ACTIVE_STATUSES, EVENT_LABELS, dashboardFunnelCounts, rate } from "@/lib/dashboard/funnel";
import { recommendNextAction } from "@/lib/dashboard/next-action";
import { buildDailySeries, followUpDateKey, followUpDueBound } from "@/lib/dashboard/time";
import type { DashboardData, DashboardProfile, FollowUpItem, GoalsData, InterviewItem, MissionItem, RecentEvent } from "@/lib/dashboard/types";
import { FUNNEL_EVENT_TYPES, appliedDayKey, classifyApplication, computeFunnel } from "@/lib/analytics/funnel";
import type { FunnelApplication, FunnelResult } from "@/lib/analytics/types";
import { adjustmentDataRequirements, computePace, recommendAdjustments, weekProgress, weekTargets } from "@/lib/goals/calculator";
import { utcDateKey } from "@/lib/goals/days";

const SERIES_DAYS = 14;
const FOLLOW_UP_CAP = 50;

const PROFILE_DEFAULTS: DashboardProfile = {
  timezone: "America/Los_Angeles",
  dailyApplicationTarget: 5,
  workdaysPerWeek: 5,
  weeklyApplicationTarget: 25,
  campaignLengthDays: 90,
  onboardingComplete: false,
  immediateSalaryTarget: 80000,
  longTermSalaryTarget: 150000,
};

/** Applications that count on lists and the funnel: owned by the user, not archived, not merged into another record. */
function baseWhere(userId: string): Prisma.ApplicationWhereInput {
  return { userId, archivedAt: null, mergedIntoId: null };
}

const metricsSelect = {
  id: true,
  status: true,
  appliedAt: true,
  statusUpdatedAt: true,
  createdAt: true,
  archivedAt: true,
  source: true,
  jobCategory: true,
  resumeVersionId: true,
  statusHistory: { select: { toStatus: true, occurredAt: true } },
  events: { where: { type: { in: FUNNEL_EVENT_TYPES } }, select: { type: true, occurredAt: true } },
  _count: { select: { interviews: true, offers: true } },
} satisfies Prisma.ApplicationSelect;

type MetricsRow = Prisma.ApplicationGetPayload<{ select: typeof metricsSelect }>;

function toFunnelApplication(r: MetricsRow): FunnelApplication {
  return {
    id: r.id,
    status: r.status,
    appliedAt: r.appliedAt,
    statusUpdatedAt: r.statusUpdatedAt,
    createdAt: r.createdAt,
    statusHistory: r.statusHistory,
    events: r.events,
    source: r.source,
    jobCategory: r.jobCategory,
    resumeVersionId: r.resumeVersionId,
    hasInterviews: r._count.interviews > 0,
    hasOffers: r._count.offers > 0,
  };
}

type Metrics = {
  /** Shared Analytics funnel over non-archived records (Analytics' default slice). */
  funnel: FunnelResult;
  /** Applied applications per day of application, archived included (effort counts). */
  appliedByDay: Record<string, number>;
  /** Every non-merged record that was ever applied, with its application day. */
  applied: Array<{ key: string; app: FunnelApplication }>;
};

/**
 * One read of the user's non-merged applications feeds every count on the Command Center and the
 * Numbers game, using the shared definitions from `src/lib/analytics/funnel.ts`:
 * - "applied" = application date or APPLIED event (closing a never-applied lead never counts);
 * - effort counts (today, this week, the 14-day chart, campaign progress) count applications by the
 *   day they were applied, including archived ones — archiving hides a record, it does not undo
 *   the application; merged duplicates and deleted records never count;
 * - the funnel and rates use the non-archived slice, matching Analytics' default filters.
 */
async function loadMetrics(userId: string, timezone: string): Promise<Metrics> {
  const rows = await prisma.application.findMany({ where: { userId, mergedIntoId: null }, select: metricsSelect });
  const funnelApps: FunnelApplication[] = [];
  const appliedByDay: Record<string, number> = {};
  const applied: Metrics["applied"] = [];
  for (const r of rows) {
    const app = toFunnelApplication(r);
    if (!r.archivedAt) funnelApps.push(app);
    const key = appliedDayKey(app, timezone);
    if (key) {
      appliedByDay[key] = (appliedByDay[key] ?? 0) + 1;
      applied.push({ key, app });
    }
  }
  return { funnel: computeFunnel(funnelApps), appliedByDay, applied };
}

type Context = {
  userName: string;
  profile: DashboardProfile;
  today: Date;
  todayKey: string;
  campaignStart: Date;
  campaign: CampaignTimeline;
};

async function loadContext(userId: string, now: Date): Promise<Context> {
  const [user, profileRow, campaignRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, createdAt: true } }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        timezone: true,
        dailyApplicationTarget: true,
        workdaysPerWeek: true,
        weeklyApplicationTarget: true,
        campaignLengthDays: true,
        onboardingCompletedAt: true,
        immediateSalaryTarget: true,
        longTermSalaryTarget: true,
      },
    }),
    prisma.campaignState.findUnique({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, select: { startedAt: true } }),
  ]);
  if (!user) throw new Error("User not found");

  const profile: DashboardProfile = profileRow
    ? {
        timezone: profileRow.timezone || PROFILE_DEFAULTS.timezone,
        dailyApplicationTarget: profileRow.dailyApplicationTarget,
        workdaysPerWeek: profileRow.workdaysPerWeek,
        weeklyApplicationTarget: profileRow.weeklyApplicationTarget,
        campaignLengthDays: profileRow.campaignLengthDays,
        onboardingComplete: profileRow.onboardingCompletedAt !== null,
        immediateSalaryTarget: profileRow.immediateSalaryTarget,
        longTermSalaryTarget: profileRow.longTermSalaryTarget,
      }
    : PROFILE_DEFAULTS;

  const today = todayInTz(profile.timezone, now);
  // Fall back to the signup date when no campaign row exists (older accounts); never invent one.
  const campaignStart = campaignRow?.startedAt ?? todayInTz(profile.timezone, user.createdAt);
  const campaign = campaignTimeline({ startDate: campaignStart, today, lengthDays: profile.campaignLengthDays });
  return { userName: user.name, profile, today, todayKey: utcDateKey(today), campaignStart, campaign };
}

/**
 * Everything the Command Center shows, assembled from a fixed, small set of queries (no per-row
 * follow-up queries). All reads are scoped by userId; merged duplicates never appear.
 */
export async function getDashboardData(userId: string, now = new Date()): Promise<DashboardData> {
  const ctx = await loadContext(userId, now);
  const { profile, today, todayKey } = ctx;
  const weekStart = startOfWeekUtc(today);

  const [metrics, stats, followUpRows, interviewRows, recentRows, missionRows] = await Promise.all([
    loadMetrics(userId, profile.timezone),
    prisma.playerStats.findUnique({
      where: { userId },
      select: { totalXp: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
    }),
    prisma.application.findMany({
      where: { ...baseWhere(userId), status: { in: ACTIVE_STATUSES }, followUpAt: { lte: followUpDueBound(todayKey, profile.timezone) } },
      orderBy: { followUpAt: "asc" },
      take: FOLLOW_UP_CAP,
      select: { id: true, companyName: true, positionTitle: true, status: true, followUpAt: true },
    }),
    prisma.interview.findMany({
      where: {
        userId,
        outcome: "PENDING",
        scheduledAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) },
        application: { mergedIntoId: null },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      select: {
        id: true,
        applicationId: true,
        type: true,
        scheduledAt: true,
        location: true,
        application: { select: { companyName: true, positionTitle: true } },
      },
    }),
    prisma.applicationEvent.findMany({
      where: { userId, application: { mergedIntoId: null } },
      orderBy: { occurredAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        occurredAt: true,
        source: true,
        verified: true,
        applicationId: true,
        application: { select: { companyName: true, positionTitle: true } },
      },
    }),
    prisma.mission.findMany({
      where: { userId, status: "ACTIVE", periodStart: { lte: today }, periodEnd: { gte: today } },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { id: true, title: true, description: true, type: true, target: true, progress: true, xpReward: true },
    }),
  ]);

  const activityByDate = metrics.appliedByDay;
  const targets = weekTargets(profile);
  const week = weekProgress(activityByDate, weekStart);
  const todaySubmitted = activityByDate[todayKey] ?? 0;
  const series = buildDailySeries(activityByDate, todayKey, SERIES_DAYS);

  const followUps: FollowUpItem[] = [];
  for (const row of followUpRows) {
    if (!row.followUpAt) continue;
    const dueKey = followUpDateKey(row.followUpAt, profile.timezone);
    if (dueKey > todayKey) continue;
    followUps.push({ ...row, followUpAt: row.followUpAt, dueKey, overdue: dueKey < todayKey });
  }
  const overdue = followUps.filter((f) => f.overdue);
  const dueToday = followUps.filter((f) => !f.overdue);

  const interviews: InterviewItem[] = interviewRows.map((i) => ({
    id: i.id,
    applicationId: i.applicationId,
    companyName: i.application.companyName,
    positionTitle: i.application.positionTitle,
    type: i.type,
    scheduledAt: i.scheduledAt,
    location: i.location,
  }));

  const recent: RecentEvent[] = recentRows.map((e) => ({
    id: e.id,
    type: e.type,
    label: EVENT_LABELS[e.type],
    occurredAt: e.occurredAt,
    source: e.source,
    verified: e.verified,
    applicationId: e.applicationId,
    companyName: e.application.companyName,
    positionTitle: e.application.positionTitle,
  }));

  const missions: MissionItem[] = missionRows;
  const funnel = dashboardFunnelCounts(metrics.funnel.counts);
  const totalApplications = metrics.funnel.counts.total;
  const { interviewRate, responseRate } = metrics.funnel.rates;
  const lvl = levelFromXp(stats?.totalXp ?? 0);
  const nextInterview = interviews[0] ?? null;

  const nextAction = recommendNextAction({
    overdueFollowUps: overdue.length,
    firstOverdueApplicationId: overdue[0]?.id ?? null,
    todaySubmitted,
    dailyTarget: targets.dailyTarget,
    totalApplications,
    totalSubmitted: funnel.submitted,
    nextInterview: nextInterview
      ? { scheduledAt: nextInterview.scheduledAt, applicationId: nextInterview.applicationId, companyName: nextInterview.companyName }
      : null,
    onboardingComplete: profile.onboardingComplete,
    now,
  });

  return {
    userName: ctx.userName,
    timezone: profile.timezone,
    todayKey,
    profile,
    campaign: ctx.campaign,
    today: { submitted: todaySubmitted, target: targets.dailyTarget },
    week: { submitted: week.submitted, target: targets.weeklyTarget, activeDays: week.activeDays, weekStartKey: utcDateKey(weekStart) },
    series,
    funnel,
    rates: {
      interview: interviewRate.value,
      response: responseRate.value,
      n: interviewRate.n,
      lowSample: metrics.funnel.lowSample,
      interviewInterval: interviewRate.interval,
    },
    totals: { applications: totalApplications, submitted: funnel.submitted },
    followUps: { overdue, dueToday, capped: followUpRows.length >= FOLLOW_UP_CAP },
    interviews,
    xp: { totalXp: stats?.totalXp ?? 0, ...lvl },
    streak: {
      current: stats?.currentStreak ?? 0,
      longest: stats?.longestStreak ?? 0,
      lastActiveKey: stats?.lastActiveDate ? utcDateKey(stats.lastActiveDate) : null,
    },
    recent,
    missions,
    nextAction,
  };
}

/**
 * Data for the Numbers game page: profile targets, observed totals and the pace projection.
 * Pace, progress, milestones, consistency and the response rate all measure the campaign window
 * [campaign start, today] by application day, so a restarted campaign (or an application dated
 * before the campaign) never inflates the observed pace. The all-time total is reported apart.
 */
export async function getGoalsData(userId: string, now = new Date()): Promise<GoalsData> {
  const ctx = await loadContext(userId, now);
  const { profile, today, todayKey, campaignStart, campaign } = ctx;
  const metrics = await loadMetrics(userId, profile.timezone);
  const startKey = utcDateKey(campaignStart);
  const inCampaign = metrics.applied.filter((a) => a.key >= startKey && a.key <= todayKey);
  const completed = inCampaign.length;
  const responses = inCampaign.filter((a) => classifyApplication(a.app).responded).length;
  const responseRate = rate(responses, completed);
  const activityByDate: Record<string, number> = {};
  for (const a of inCampaign) activityByDate[a.key] = (activityByDate[a.key] ?? 0) + 1;

  const pace = computePace({
    dailyTarget: profile.dailyApplicationTarget,
    workdaysPerWeek: profile.workdaysPerWeek,
    campaignLengthDays: profile.campaignLengthDays,
    campaignStartDate: campaignStart,
    today,
    completedApplications: completed,
    historicalResponseRate: responseRate,
    activityByDate,
  });

  const adjustmentInput = {
    dailyTarget: profile.dailyApplicationTarget,
    workdaysPerWeek: profile.workdaysPerWeek,
    campaignDay: pace.campaignDay,
    completedApplications: completed,
    responses,
    observedDailyPace: pace.observedDailyPace,
    requiredDailyPace: pace.requiredDailyPace,
    consistency: pace.consistency,
  };

  return {
    timezone: profile.timezone,
    todayKey,
    campaignStartKey: startKey,
    campaign,
    profile,
    completed,
    completedAllTime: metrics.applied.length,
    responses,
    responseRate,
    activityByDate,
    pace,
    suggestions: recommendAdjustments(adjustmentInput),
    dataRequirements: adjustmentDataRequirements(adjustmentInput),
  };
}
