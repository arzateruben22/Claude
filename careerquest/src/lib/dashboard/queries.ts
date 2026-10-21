import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { startOfWeekUtc, todayInTz } from "@/lib/dates";
import { levelFromXp } from "@/lib/game/xp-config";
import { campaignTimeline, type CampaignTimeline } from "@/lib/dashboard/campaign";
import {
  ACTIVE_STATUSES,
  EVENT_LABELS,
  FUNNEL_STAGES,
  STAGE_EVENTS,
  STAGE_STATUSES,
  SUBMITTED_STATUSES,
  rate,
  type FunnelCounts,
  type FunnelStage,
} from "@/lib/dashboard/funnel";
import { recommendNextAction } from "@/lib/dashboard/next-action";
import { buildDailySeries, followUpDateKey, followUpDueBound } from "@/lib/dashboard/time";
import type { DashboardData, DashboardProfile, FollowUpItem, GoalsData, InterviewItem, MissionItem, RecentEvent } from "@/lib/dashboard/types";
import { adjustmentDataRequirements, computePace, recommendAdjustments, weekProgress, weekTargets } from "@/lib/goals/calculator";
import { addDaysUtc, utcDateKey } from "@/lib/goals/days";

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

/** Applications that count: owned by the user, not archived, not merged into another record. */
function baseWhere(userId: string): Prisma.ApplicationWhereInput {
  return { userId, archivedAt: null, mergedIntoId: null };
}

/** "Reached stage" = current status, any historical status, or any event at/after that stage. */
function reachedStageWhere(userId: string, stage: FunnelStage): Prisma.ApplicationWhereInput {
  const statuses = STAGE_STATUSES[stage];
  const or: Prisma.ApplicationWhereInput[] = [
    { status: { in: statuses } },
    { statusHistory: { some: { toStatus: { in: statuses } } } },
  ];
  if (STAGE_EVENTS[stage].length) or.push({ events: { some: { type: { in: STAGE_EVENTS[stage] } } } });
  if (stage === "interviews") or.push({ interviews: { some: {} } });
  if (stage === "offers") or.push({ offers: { some: {} } });
  return { ...baseWhere(userId), OR: or };
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

async function loadActivity(userId: string, from: Date, to: Date): Promise<Record<string, number>> {
  const rows = await prisma.dailyActivity.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: { date: true, applicationsSubmitted: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[utcDateKey(r.date)] = r.applicationsSubmitted;
  return map;
}

async function loadFunnel(userId: string): Promise<{ funnel: FunnelCounts; totalApplications: number }> {
  const [groups, ...stageCounts] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], where: baseWhere(userId), _count: { _all: true } }),
    ...FUNNEL_STAGES.map((stage) => prisma.application.count({ where: reachedStageWhere(userId, stage) })),
  ]);
  let totalApplications = 0;
  let submitted = 0;
  for (const g of groups) {
    totalApplications += g._count._all;
    if (SUBMITTED_STATUSES.includes(g.status)) submitted += g._count._all;
  }
  const [responses, screenings, interviews, offers, hires] = stageCounts as number[];
  return {
    funnel: { submitted, responses: responses!, screenings: screenings!, interviews: interviews!, offers: offers!, hires: hires! },
    totalApplications,
  };
}

/**
 * Everything the Command Center shows, assembled from a fixed, small set of aggregate queries
 * (no per-row follow-up queries). All reads are scoped by userId.
 */
export async function getDashboardData(userId: string, now = new Date()): Promise<DashboardData> {
  const ctx = await loadContext(userId, now);
  const { profile, today, todayKey } = ctx;
  const weekStart = startOfWeekUtc(today);
  const seriesStart = addDaysUtc(today, -(SERIES_DAYS - 1));
  const activityFrom = new Date(Math.min(weekStart.getTime(), seriesStart.getTime()));

  const [activityByDate, funnelResult, stats, followUpRows, interviewRows, recentRows, missionRows] = await Promise.all([
    loadActivity(userId, activityFrom, today),
    loadFunnel(userId),
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
      where: { userId, outcome: "PENDING", scheduledAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } },
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
      where: { userId },
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
  const { funnel, totalApplications } = funnelResult;
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
    rates: { interview: rate(funnel.interviews, funnel.submitted), response: rate(funnel.responses, funnel.submitted), n: funnel.submitted },
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

/** Data for the Numbers game page: profile targets, observed totals and the pace projection. */
export async function getGoalsData(userId: string, now = new Date()): Promise<GoalsData> {
  const ctx = await loadContext(userId, now);
  const { profile, today, todayKey, campaignStart, campaign } = ctx;
  const [activityByDate, funnelResult] = await Promise.all([
    loadActivity(userId, new Date(Math.min(campaignStart.getTime(), today.getTime())), today),
    loadFunnel(userId),
  ]);
  const { funnel } = funnelResult;
  const responseRate = rate(funnel.responses, funnel.submitted);

  const pace = computePace({
    dailyTarget: profile.dailyApplicationTarget,
    workdaysPerWeek: profile.workdaysPerWeek,
    campaignLengthDays: profile.campaignLengthDays,
    campaignStartDate: campaignStart,
    today,
    completedApplications: funnel.submitted,
    historicalResponseRate: responseRate,
    activityByDate,
  });

  const adjustmentInput = {
    dailyTarget: profile.dailyApplicationTarget,
    workdaysPerWeek: profile.workdaysPerWeek,
    campaignDay: pace.campaignDay,
    completedApplications: funnel.submitted,
    responses: funnel.responses,
    observedDailyPace: pace.observedDailyPace,
    requiredDailyPace: pace.requiredDailyPace,
    consistency: pace.consistency,
  };

  return {
    timezone: profile.timezone,
    todayKey,
    campaignStartKey: utcDateKey(campaignStart),
    campaign,
    profile,
    completed: funnel.submitted,
    responses: funnel.responses,
    responseRate,
    activityByDate,
    pace,
    suggestions: recommendAdjustments(adjustmentInput),
    dataRequirements: adjustmentDataRequirements(adjustmentInput),
  };
}
