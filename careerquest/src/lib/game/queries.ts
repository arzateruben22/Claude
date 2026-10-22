import "server-only";
import { prisma } from "@/lib/db";
import { addUtcDays, dateKey } from "@/lib/dates";
import { endOfDayInTz, startOfDayInTz } from "@/lib/dashboard/time";
import { campaignTimeline, type CampaignTimeline } from "@/lib/dashboard/campaign";
import { loadGameContext, type GameContext } from "@/lib/game/missions";
import { syncGameState } from "@/lib/game/sync";
import { playerLevels, type DerivedStats, type LevelTrack, type StatInputs } from "@/lib/game/levels";
import { refreshPlayerStats } from "@/lib/game/player-stats";
import { isActiveDay, isScheduledWorkday } from "@/lib/game/streak";
import { loadAchievementFacts } from "@/lib/game/achievements";
import { ACHIEVEMENTS, ACHIEVEMENT_BY_KEY, achievementStatus, type AchievementFacts } from "@/lib/game/achievement-catalog";
import { readGetHiredMeta, type Employment, type NextPhasePlan, type Paycheck } from "@/lib/game/campaign-meta";
import { PHASE_FOCUS, getHiredWindow } from "@/lib/game/mission-catalog";
import { verifiedHoursTotal } from "@/lib/game/facts";
import {
  sortMissions,
  toMissionView,
  type AchievementCardView,
  type MissionView,
  type PhaseView,
  type StreakView,
  type TodayMissionsSummary,
  type UnseenAchievement,
  type WeekDayView,
} from "@/lib/game/views";

export type { AchievementCardView, PhaseView, UnseenAchievement };

const missionSelect = {
  id: true,
  key: true,
  title: true,
  description: true,
  type: true,
  campaign: true,
  status: true,
  progress: true,
  target: true,
  xpReward: true,
  periodStart: true,
  periodEnd: true,
  completedAt: true,
  metadata: true,
} as const;

async function streakOf(userId: string): Promise<{ streak: StreakView; stats: { totalXp: number; jobHunterXp: number; electricianXp: number; missionsCompleted: number; careerEarnings: number; currentSalary: number | null } }> {
  const s = await prisma.playerStats.findUnique({ where: { userId } });
  return {
    streak: {
      current: s?.currentStreak ?? 0,
      longest: Math.max(s?.longestStreak ?? 0, s?.currentStreak ?? 0),
      lastActiveKey: s?.lastActiveDate ? dateKey(s.lastActiveDate) : null,
    },
    stats: {
      totalXp: s?.totalXp ?? 0,
      jobHunterXp: s?.jobHunterXp ?? 0,
      electricianXp: s?.electricianXp ?? 0,
      missionsCompleted: s?.missionsCompleted ?? 0,
      careerEarnings: s ? Number(s.careerEarnings.toString()) : 0,
      currentSalary: s?.currentSalary !== null && s?.currentSalary !== undefined ? Number(s.currentSalary.toString()) : null,
    },
  };
}

async function todayXp(ctx: GameContext): Promise<number> {
  const agg = await prisma.xpLedger.aggregate({
    where: { userId: ctx.userId, createdAt: { gte: startOfDayInTz(ctx.todayKey, ctx.timezone), lt: endOfDayInTz(ctx.todayKey, ctx.timezone) } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

async function summaryFor(ctx: GameContext): Promise<TodayMissionsSummary> {
  const { userId, today, weekStart } = ctx;
  const [daily, weekly, activity, gh, s, xp] = await Promise.all([
    prisma.mission.findMany({ where: { userId, type: "DAILY", periodStart: today }, select: missionSelect, orderBy: { createdAt: "asc" } }),
    prisma.mission.findMany({ where: { userId, type: "WEEKLY", periodStart: weekStart }, select: missionSelect, orderBy: { createdAt: "asc" } }),
    prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: today } }, select: { restDay: true } }),
    prisma.campaignState.findUnique({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, select: { status: true } }),
    streakOf(userId),
    todayXp(ctx),
  ]);
  const dailyViews = sortMissions(daily.map(toMissionView));
  const counted = dailyViews.filter((m) => m.status !== "SKIPPED");
  return {
    todayKey: ctx.todayKey,
    timezone: ctx.timezone,
    isWorkday: isScheduledWorkday(today, ctx.profile.workdaysPerWeek),
    restDay: activity?.restDay ?? false,
    hired: gh?.status === "COMPLETED",
    daily: dailyViews,
    weekly: sortMissions(weekly.map(toMissionView)),
    streak: s.streak,
    todayXp: xp,
    dailyDone: counted.filter((m) => m.status === "COMPLETED").length,
    dailyTotal: counted.length,
  };
}

/**
 * Today's missions for the dashboard card and the Today tab. Brings missions up to date first
 * (creates today's, recomputes progress from persisted data), so the numbers are never stale.
 */
export async function getTodayMissionsSummary(userId: string, now = new Date()): Promise<TodayMissionsSummary> {
  await syncGameState(userId, { now, stats: false });
  return summaryFor(await loadGameContext(prisma, userId, now));
}

export type TodayPageData = {
  summary: TodayMissionsSummary;
  levels: LevelTrack[];
  campaign: CampaignTimeline;
  missionsCompleted: number;
};

async function timelineFor(ctx: GameContext): Promise<{ timeline: CampaignTimeline; startedAt: Date }> {
  const gh = await prisma.campaignState.findUnique({
    where: { userId_campaign: { userId: ctx.userId, campaign: "GET_HIRED" } },
    select: { startedAt: true },
  });
  const startedAt = gh?.startedAt ?? ctx.today;
  return { timeline: campaignTimeline({ startDate: startedAt, today: ctx.today, lengthDays: ctx.profile.campaignLengthDays }), startedAt };
}

export async function getTodayPageData(userId: string, now = new Date()): Promise<TodayPageData> {
  await syncGameState(userId, { now, stats: false });
  const ctx = await loadGameContext(prisma, userId, now);
  const [summary, s, t] = await Promise.all([summaryFor(ctx), streakOf(userId), timelineFor(ctx)]);
  return { summary, levels: playerLevels(s.stats), campaign: t.timeline, missionsCompleted: s.stats.missionsCompleted };
}

// ---------------------------------------------------------------------------
// This week
// ---------------------------------------------------------------------------

export type WeekPageData = {
  timezone: string;
  weekStartKey: string;
  weekEndKey: string;
  todayKey: string;
  missions: MissionView[];
  days: WeekDayView[];
  totals: { applications: number; followUps: number; lessons: number; xp: number; activeDays: number; restDays: number };
  streak: StreakView;
  workdaysPerWeek: number;
};

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function getWeekPageData(userId: string, now = new Date()): Promise<WeekPageData> {
  await syncGameState(userId, { now, stats: false });
  const ctx = await loadGameContext(prisma, userId, now);
  const { weekStart, today } = ctx;
  const weekEnd = addUtcDays(weekStart, 6);
  const [missions, rows, s] = await Promise.all([
    prisma.mission.findMany({ where: { userId, type: "WEEKLY", periodStart: weekStart }, select: missionSelect, orderBy: { createdAt: "asc" } }),
    prisma.dailyActivity.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
    streakOf(userId),
  ]);
  const byKey = new Map(rows.map((r) => [dateKey(r.date), r]));
  const days: WeekDayView[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addUtcDays(weekStart, i);
    const key = dateKey(d);
    const r = byKey.get(key);
    days.push({
      key,
      weekday: WEEKDAY.format(d),
      dateLabel: MONTH_DAY.format(d),
      isToday: key === ctx.todayKey,
      isFuture: d.getTime() > today.getTime(),
      workday: isScheduledWorkday(d, ctx.profile.workdaysPerWeek),
      restDay: r?.restDay ?? false,
      applications: r?.applicationsSubmitted ?? 0,
      followUps: r?.followUps ?? 0,
      lessons: r?.lessonsCompleted ?? 0,
      xp: r?.xpEarned ?? 0,
      missions: r?.missionsCompleted ?? 0,
      active: r ? isActiveDay(r) : false,
    });
  }
  return {
    timezone: ctx.timezone,
    weekStartKey: dateKey(weekStart),
    weekEndKey: dateKey(weekEnd),
    todayKey: ctx.todayKey,
    missions: sortMissions(missions.map(toMissionView)),
    days,
    totals: {
      applications: days.reduce((a, d) => a + d.applications, 0),
      followUps: days.reduce((a, d) => a + d.followUps, 0),
      lessons: days.reduce((a, d) => a + d.lessons, 0),
      xp: days.reduce((a, d) => a + d.xp, 0),
      activeDays: days.filter((d) => d.active).length,
      restDays: days.filter((d) => d.restDay).length,
    },
    streak: s.streak,
    workdaysPerWeek: ctx.profile.workdaysPerWeek,
  };
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------


export type CampaignPageData = {
  todayKey: string;
  timezone: string;
  timeline: CampaignTimeline;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  completedAt: string | null;
  phases: PhaseView[];
  /** Missions of the post-campaign 30-day block (when beyond day N). */
  extension: { startKey: string; endKey: string; missions: MissionView[] } | null;
  employment: Employment | null;
  paychecks: Paycheck[];
  paycheckCount: number;
  careerEarnings: number;
  currentSalary: number | null;
  nextPhasePlan: NextPhasePlan | null;
  electrician: {
    startedKey: string;
    missions: MissionView[];
    verifiedHours: number;
    selfReportedHours: number;
    longTermSalaryTarget: number;
  };
  immediateSalaryTarget: number;
};

export async function getCampaignPageData(userId: string, now = new Date()): Promise<CampaignPageData> {
  await syncGameState(userId, { now, stats: false });
  const ctx = await loadGameContext(prisma, userId, now);
  const [rows, profile, s] = await Promise.all([
    prisma.campaignState.findMany({ where: { userId } }),
    prisma.userProfile.findUnique({ where: { userId }, select: { immediateSalaryTarget: true, longTermSalaryTarget: true } }),
    streakOf(userId),
  ]);
  const gh = rows.find((r) => r.campaign === "GET_HIRED");
  const el = rows.find((r) => r.campaign === "ELECTRICIAN_150K");
  const startedAt = gh?.startedAt ?? ctx.today;
  const timeline = campaignTimeline({ startDate: startedAt, today: ctx.today, lengthDays: ctx.profile.campaignLengthDays });

  const [ghMissions, elMissions, verifiedHours, allHours] = await Promise.all([
    prisma.mission.findMany({
      // This run's missions, plus missions completed in an earlier run (earned once, not recreated).
      where: { userId, campaign: "GET_HIRED", type: "CAMPAIGN", OR: [{ periodStart: { gte: startedAt } }, { status: "COMPLETED" }] },
      select: missionSelect,
      orderBy: [{ periodStart: "asc" }, { createdAt: "asc" }],
    }),
    prisma.mission.findMany({
      where: { userId, campaign: "ELECTRICIAN_150K", type: "CAMPAIGN", ...(el ? { periodStart: el.startedAt } : {}) },
      select: missionSelect,
      orderBy: [{ createdAt: "asc" }],
    }),
    verifiedHoursTotal(prisma, userId),
    prisma.workHourEntry.aggregate({ where: { userId }, _sum: { hours: true } }),
  ]);
  const ghAll = ghMissions.map(toMissionView);
  const startKeyOfRun = dateKey(startedAt);
  const ghViews = ghAll.filter((m) => m.periodStartKey >= startKeyOfRun);
  const earlierRuns = ghAll.filter((m) => m.periodStartKey < startKeyOfRun);

  const phaseMissions = (index: 1 | 2 | 3, startKey: string): MissionView[] => {
    const current = ghViews.filter((m) => m.phase === index && m.periodStartKey === startKey);
    const keys = new Set(current.map((m) => m.key));
    const seen = new Set<string>();
    const earlier = earlierRuns.filter((m) => {
      if (m.phase !== index || keys.has(m.key) || seen.has(m.key)) return false;
      seen.add(m.key);
      return true;
    });
    return sortMissions([...current, ...earlier]);
  };

  const phases: PhaseView[] = timeline.phases.map((p) => {
    const startKey = dateKey(addUtcDays(startedAt, p.startDay - 1));
    const endKey = dateKey(addUtcDays(startedAt, p.endDay - 1));
    const state: PhaseView["state"] =
      timeline.started && (timeline.beyond || timeline.day > p.endDay) ? "done" : timeline.phase === p.index ? "current" : "upcoming";
    return {
      index: p.index,
      name: p.name,
      title: PHASE_FOCUS[p.index].title,
      startDay: p.startDay,
      endDay: p.endDay,
      startKey,
      endKey,
      state,
      focus: PHASE_FOCUS[p.index].focus,
      missions: phaseMissions(p.index, startKey),
    };
  });

  let extension: CampaignPageData["extension"] = null;
  const w = getHiredWindow(startedAt, ctx.today, ctx.profile.campaignLengthDays);
  if (w && w.phase === null) {
    const startKey = dateKey(w.start);
    extension = { startKey, endKey: dateKey(w.end), missions: sortMissions(ghViews.filter((m) => m.phase === null && m.periodStartKey === startKey)) };
  }

  const meta = readGetHiredMeta(gh?.metadata);
  const paychecks = [...meta.paychecks].sort((a, b) => (a.payDate === b.payDate ? b.loggedAt.localeCompare(a.loggedAt) : b.payDate.localeCompare(a.payDate)));
  const selfReportedHours = Math.max(0, Number(allHours._sum.hours?.toString() ?? 0) - verifiedHours);

  return {
    todayKey: ctx.todayKey,
    timezone: ctx.timezone,
    timeline,
    status: gh?.status ?? "ACTIVE",
    completedAt: gh?.completedAt ? gh.completedAt.toISOString() : null,
    phases,
    extension,
    employment: meta.employment,
    paychecks: paychecks.slice(0, 12),
    paycheckCount: paychecks.length,
    careerEarnings: s.stats.careerEarnings,
    currentSalary: s.stats.currentSalary,
    nextPhasePlan: meta.nextPhasePlan,
    electrician: {
      startedKey: dateKey(el?.startedAt ?? startedAt),
      missions: elMissions.map(toMissionView),
      verifiedHours,
      selfReportedHours,
      longTermSalaryTarget: profile?.longTermSalaryTarget ?? 150000,
    },
    immediateSalaryTarget: profile?.immediateSalaryTarget ?? 80000,
  };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------


export type AchievementsPageData = {
  timezone: string;
  cards: AchievementCardView[];
  unlockedCount: number;
  total: number;
  levels: LevelTrack[];
  stats: DerivedStats;
  statInputs: StatInputs;
  streak: StreakView;
  missionsCompleted: number;
  facts: AchievementFacts;
};

export async function getAchievementsPageData(userId: string, now = new Date()): Promise<AchievementsPageData> {
  await syncGameState(userId, { now, stats: false });
  const ctx = await loadGameContext(prisma, userId, now);
  const { stats, inputs } = await refreshPlayerStats(prisma, userId);
  const [rows, facts, s] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementKey: true, unlockedAt: true, seenAt: true } }),
    loadAchievementFacts(prisma, userId),
    streakOf(userId),
  ]);
  const unlocked = new Map(rows.map((r) => [r.achievementKey, r]));
  const cards = ACHIEVEMENTS.map((def): AchievementCardView => {
    const st = achievementStatus(def, facts);
    const row = unlocked.get(def.key);
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: def.tier,
      condition: def.condition,
      label: def.label ?? null,
      unlocked: Boolean(row),
      unlockedAt: row ? row.unlockedAt.toISOString() : null,
      fresh: Boolean(row && !row.seenAt),
      current: row ? st.target : st.current,
      target: st.target,
      ratio: row ? 1 : st.ratio,
    };
  });
  return {
    timezone: ctx.timezone,
    cards,
    unlockedCount: cards.filter((c) => c.unlocked).length,
    total: cards.length,
    levels: playerLevels(s.stats),
    stats,
    statInputs: inputs,
    streak: s.streak,
    missionsCompleted: s.stats.missionsCompleted,
    facts,
  };
}


/** Unlocked achievements the user has not acknowledged yet (oldest first, at most 6). */
export async function getUnseenAchievements(userId: string): Promise<UnseenAchievement[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId, seenAt: null },
    orderBy: { unlockedAt: "asc" },
    take: 6,
    select: { id: true, achievementKey: true, unlockedAt: true },
  });
  return rows.flatMap((r) => {
    const def = ACHIEVEMENT_BY_KEY.get(r.achievementKey);
    if (!def) return [];
    return [{ id: r.id, key: def.key, title: def.title, description: def.description, icon: def.icon, tier: def.tier, unlockedAt: r.unlockedAt.toISOString() }];
  });
}
