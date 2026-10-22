import "server-only";
import { prisma } from "@/lib/db";
import type { Mission } from "@/generated/prisma/client";
import type { ApplicationEventType, CampaignStatus } from "@/generated/prisma/enums";
import { awardXp, type Tx } from "@/lib/game/xp";
import { addUtcDays, dateKey, startOfWeekUtc, todayInTz } from "@/lib/dates";
import { followUpDateKey, followUpDueBound } from "@/lib/dashboard/time";
import { ACTIVE_STATUSES } from "@/lib/dashboard/funnel";
import {
  HOURS_MILESTONES,
  buildMissionPlan,
  missionMetaJson,
  missionXpReason,
  readMissionMeta,
  type MissionMetric,
  type MissionSpec,
  type PlanInput,
  type SkipReason,
} from "@/lib/game/mission-catalog";
import { lookbackStart, measureMission, type MetricContext } from "@/lib/game/mission-metrics";
import { lockPlayer, safeTimezone, verifiedHoursTotal } from "@/lib/game/facts";
import { allLessonKeys, fundamentalsLessonKeys } from "@/lib/game/lessons-index";
import { clampWorkdaysPerWeek, isScheduledWorkday } from "@/lib/game/streak";
import { refreshPlayerStats } from "@/lib/game/player-stats";

export type MissionEventContext = {
  userId: string;
  type:
    | ApplicationEventType
    | "LESSON_COMPLETED"
    | "QUIZ_PASSED"
    | "WORK_HOURS_LOGGED"
    | "PROFILE_UPDATED"
    | "RESUME_UPDATED"
    /** Interview prep marked complete (Interview.prepCompletedAt). */
    | "INTERVIEW_PREPARED";
  occurredAt: Date;
  /** Calendar date (UTC midnight) in the user's timezone. */
  activityDate: Date;
  sourceId?: string;
};

/**
 * @deprecated Missions are implemented directly in this module; registering a handler has no
 * effect. Kept so older imports keep compiling.
 */
export function registerMissionHandler(fn: (tx: Tx, ctx: MissionEventContext) => Promise<void>): void {
  void fn;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type GameContext = {
  userId: string;
  now: Date;
  timezone: string;
  today: Date;
  todayKey: string;
  weekStart: Date;
  profile: {
    dailyApplicationTarget: number;
    weeklyApplicationTarget: number;
    workdaysPerWeek: number;
    campaignLengthDays: number;
  };
  userCreatedAt: Date;
};

const PROFILE_DEFAULTS = { timezone: "America/Los_Angeles", dailyApplicationTarget: 5, weeklyApplicationTarget: 25, workdaysPerWeek: 5, campaignLengthDays: 90 };

export async function loadGameContext(tx: Tx, userId: string, now = new Date()): Promise<GameContext> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      profile: { select: { timezone: true, dailyApplicationTarget: true, weeklyApplicationTarget: true, workdaysPerWeek: true, campaignLengthDays: true } },
    },
  });
  if (!user) throw new Error("User not found");
  const p = user.profile ?? PROFILE_DEFAULTS;
  const timezone = safeTimezone(p.timezone);
  const today = todayInTz(timezone, now);
  return {
    userId,
    now,
    timezone,
    today,
    todayKey: dateKey(today),
    weekStart: startOfWeekUtc(today),
    profile: {
      dailyApplicationTarget: Math.max(0, p.dailyApplicationTarget),
      weeklyApplicationTarget: Math.max(0, p.weeklyApplicationTarget),
      workdaysPerWeek: clampWorkdaysPerWeek(p.workdaysPerWeek),
      campaignLengthDays: Math.max(3, p.campaignLengthDays || 90),
    },
    userCreatedAt: user.createdAt,
  };
}

export type CampaignRows = {
  getHired: { startedAt: Date; status: CampaignStatus };
  electrician: { startedAt: Date; status: CampaignStatus };
};

/**
 * Both campaign rows, created when missing. Operation Get Hired falls back to the signup day (the
 * same fallback the dashboard shows); the $150K Electrician Path starts alongside it and is never
 * ended by getting a job.
 */
export async function ensureCampaignRows(tx: Tx, ctx: GameContext): Promise<CampaignRows> {
  const read = () =>
    tx.campaignState.findMany({ where: { userId: ctx.userId }, select: { campaign: true, startedAt: true, status: true } });
  let rows = await read();
  let gh = rows.find((r) => r.campaign === "GET_HIRED");
  let el = rows.find((r) => r.campaign === "ELECTRICIAN_150K");
  if (!gh || !el) {
    const ghStart = gh?.startedAt ?? todayInTz(ctx.timezone, ctx.userCreatedAt);
    await tx.campaignState.createMany({
      data: [
        ...(gh ? [] : [{ userId: ctx.userId, campaign: "GET_HIRED" as const, startedAt: ghStart, targetEndAt: addUtcDays(ghStart, ctx.profile.campaignLengthDays) }]),
        ...(el ? [] : [{ userId: ctx.userId, campaign: "ELECTRICIAN_150K" as const, startedAt: ghStart }]),
      ],
      skipDuplicates: true,
    });
    rows = await read();
    gh = rows.find((r) => r.campaign === "GET_HIRED");
    el = rows.find((r) => r.campaign === "ELECTRICIAN_150K");
  }
  return {
    getHired: { startedAt: gh!.startedAt, status: gh!.status },
    electrician: { startedAt: el!.startedAt, status: el!.status },
  };
}

// ---------------------------------------------------------------------------
// Ensure (create the current period's missions)
// ---------------------------------------------------------------------------

async function loadPlanInput(tx: Tx, ctx: GameContext, campaigns: CampaignRows): Promise<PlanInput> {
  const { userId, today, weekStart, timezone, now } = ctx;
  const restRows = await tx.dailyActivity.findMany({
    where: { userId, restDay: true, date: { gte: weekStart, lte: addUtcDays(weekStart, 6) } },
    select: { date: true },
  });
  const restDayToday = restRows.some((r) => dateKey(r.date) === ctx.todayKey);
  const restWorkdaysThisWeek = restRows.filter((r) => isScheduledWorkday(r.date, ctx.profile.workdaysPerWeek)).length;

  const dueRows = await tx.application.findMany({
    where: {
      userId,
      archivedAt: null,
      mergedIntoId: null,
      status: { in: ACTIVE_STATUSES },
      followUpAt: { lte: followUpDueBound(ctx.todayKey, timezone) },
    },
    orderBy: { followUpAt: "asc" },
    take: 200,
    select: { id: true, followUpAt: true },
  });
  const followUpsDue = dueRows.filter((r) => r.followUpAt && followUpDateKey(r.followUpAt, timezone) <= ctx.todayKey).map((r) => r.id);

  const recentHours = await tx.workHourEntry.findFirst({
    where: { userId, OR: [{ createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }, { dateWorked: { gte: lookbackStart(today, 14), lte: today } }] },
    select: { id: true },
  });
  const interviewSoon = await tx.interview.findFirst({
    where: { userId, outcome: "PENDING", scheduledAt: { gte: now, lte: new Date(now.getTime() + 14 * 86_400_000) }, application: { mergedIntoId: null } },
    select: { id: true },
  });
  const lessonKeys = allLessonKeys();
  const lessonsCompleted = lessonKeys.length
    ? await tx.lessonProgress.count({ where: { userId, status: "COMPLETED", lessonKey: { in: lessonKeys } } })
    : 0;
  const verifiedHours = await verifiedHoursTotal(tx, userId);
  const examRow =
    verifiedHours >= HOURS_MILESTONES[HOURS_MILESTONES.length - 1]!.hours
      ? { id: "hours" }
      : await tx.certificationStatus.findFirst({
          where: { userId, OR: [{ examEligibleAt: { not: null } }, { examApplicationAt: { not: null } }, { examPassedAt: { not: null } }] },
          select: { id: true },
        });

  return {
    today,
    dailyApplicationTarget: ctx.profile.dailyApplicationTarget,
    weeklyApplicationTarget: ctx.profile.weeklyApplicationTarget,
    workdaysPerWeek: ctx.profile.workdaysPerWeek,
    campaignLengthDays: ctx.profile.campaignLengthDays,
    getHired: { startedAt: campaigns.getHired.startedAt, completed: campaigns.getHired.status === "COMPLETED" },
    electricianStartedAt: campaigns.electrician.startedAt,
    restDayToday,
    restWorkdaysThisWeek,
    followUpsDue,
    loggedHoursRecently: Boolean(recentHours),
    interviewWithin14Days: Boolean(interviewSoon),
    lessonsRemaining: Math.max(0, lessonKeys.length - lessonsCompleted),
    fundamentalsTotal: fundamentalsLessonKeys().length,
    verifiedHours,
    examStageUnlocked: Boolean(examRow),
  };
}

function toRow(userId: string, s: MissionSpec) {
  return {
    userId,
    key: s.key,
    title: s.title,
    description: s.description,
    type: s.type,
    campaign: s.campaign,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    target: s.target,
    xpReward: s.xpReward,
    metadata: missionMetaJson(s.meta),
  };
}

async function setMissionState(tx: Tx, userId: string, m: Pick<Mission, "id" | "metadata">, status: "ACTIVE" | "SKIPPED", skipReason: SkipReason | null) {
  // Merge onto the stored JSON so keys the parser does not know about survive.
  const raw = m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata) ? { ...(m.metadata as Record<string, unknown>) } : {};
  if (skipReason) raw.skipReason = skipReason;
  else delete raw.skipReason;
  await tx.mission.updateMany({ where: { id: m.id, userId }, data: { status, metadata: raw as object } });
}

/**
 * Pause/restore missions whose expectations changed: a rest day removes today's daily missions,
 * reporting a job pauses job-search missions. Restoring only touches missions this function paused.
 */
async function reconcileSkips(tx: Tx, ctx: GameContext, input: PlanInput): Promise<void> {
  const { userId, today } = ctx;
  const current = await tx.mission.findMany({
    where: { userId, periodEnd: { gte: today }, status: { in: ["ACTIVE", "SKIPPED"] } },
    select: { id: true, type: true, periodStart: true, status: true, metadata: true },
  });
  const hired = input.getHired.completed;
  for (const m of current) {
    const meta = readMissionMeta(m.metadata);
    const isTodayDaily = m.type === "DAILY" && m.periodStart.getTime() === today.getTime();
    let want: { status: "ACTIVE" | "SKIPPED"; reason: SkipReason | null } | null = null;
    if (m.status === "ACTIVE") {
      if (hired && meta.jobHunt) want = { status: "SKIPPED", reason: "HIRED" };
      else if (input.restDayToday && isTodayDaily) want = { status: "SKIPPED", reason: "REST_DAY" };
    } else if (meta.skipReason === "HIRED" && !hired) {
      want = input.restDayToday && isTodayDaily ? { status: "SKIPPED", reason: "REST_DAY" } : { status: "ACTIVE", reason: null };
    } else if (meta.skipReason === "REST_DAY" && !input.restDayToday) {
      want = hired && meta.jobHunt ? { status: "SKIPPED", reason: "HIRED" } : { status: "ACTIVE", reason: null };
    }
    if (want && (want.status !== m.status || want.reason !== (meta.skipReason ?? null))) {
      await setMissionState(tx, userId, m, want.status, want.reason);
    }
  }
}

/**
 * Campaign missions measured by cumulative state (or a one-off self-report) are earned once ever:
 * restarting Operation Get Hired must not recreate them and pay their XP again.
 */
const ONCE_EVER_METRICS: ReadonlySet<MissionMetric> = new Set<MissionMetric>([
  "ONBOARDING",
  "RESUME_VERSIONS",
  "TRACKING_CONNECTED",
  "TARGET_COMPANIES",
  "APPLICATIONS_TOTAL",
  "PROGRAMS_RESEARCHED",
  "FUNDAMENTALS_LESSONS",
  "OFFERS_RECORDED",
  "SALARY_PREP",
  "SELF_CHECK",
]);

const specId = (s: { key: string; periodStart: Date }) => `${s.key}|${s.periodStart.getTime()}`;

export async function ensureWithContext(tx: Tx, ctx: GameContext): Promise<MissionSpec[]> {
  const { userId } = ctx;
  const campaigns = await ensureCampaignRows(tx, ctx);
  const input = await loadPlanInput(tx, ctx, campaigns);
  let plan = buildMissionPlan(input);

  const onceKeys = plan.filter((s) => s.type === "CAMPAIGN" && ONCE_EVER_METRICS.has(s.meta.metric)).map((s) => s.key);
  if (onceKeys.length) {
    const earned = await tx.mission.findMany({ where: { userId, status: "COMPLETED", key: { in: onceKeys } }, select: { key: true, periodStart: true } });
    const earnedElsewhere = new Set(earned.filter((e) => !plan.some((s) => specId(s) === specId(e))).map((e) => e.key));
    plan = plan.filter((s) => !(s.type === "CAMPAIGN" && earnedElsewhere.has(s.key)));
  }

  if (plan.length) {
    await tx.mission.createMany({ data: plan.map((s) => toRow(userId, s)), skipDuplicates: true });
    const live = plan.filter((s) => s.meta.syncTarget || s.meta.metric === "FOLLOW_UPS_DUE_CLEARED");
    if (live.length) {
      const rows = await tx.mission.findMany({
        where: { userId, status: { in: ["ACTIVE", "SKIPPED"] }, OR: live.map((s) => ({ key: s.key, periodStart: s.periodStart })) },
        select: { id: true, key: true, periodStart: true, status: true, target: true, title: true, description: true, metadata: true },
      });
      for (const s of live) {
        const row = rows.find((r) => specId(r) === specId(s));
        if (!row) continue;
        if (s.meta.syncTarget && row.status === "ACTIVE" && (row.target !== s.target || row.title !== s.title || row.description !== s.description)) {
          await tx.mission.updateMany({ where: { id: row.id, userId, status: "ACTIVE" }, data: { target: s.target, title: s.title, description: s.description } });
        }
        if (s.meta.metric === "FOLLOW_UPS_DUE_CLEARED") {
          // Follow-ups that became due later today join today's list (a mission skipped because
          // nothing was left comes back when something new is due).
          const meta = readMissionMeta(row.metadata);
          const known = new Set(meta.applicationIds ?? []);
          const added = (s.meta.applicationIds ?? []).filter((id) => !known.has(id));
          const revive = row.status === "SKIPPED" && meta.skipReason === "NOTHING_DUE" && added.length > 0;
          if (added.length && (row.status === "ACTIVE" || revive)) {
            const raw = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? { ...(row.metadata as Record<string, unknown>) } : {};
            raw.applicationIds = [...known, ...added].slice(0, 200);
            if (revive) delete raw.skipReason;
            await tx.mission.updateMany({ where: { id: row.id, userId }, data: { metadata: raw as object, ...(revive ? { status: "ACTIVE" as const } : {}) } });
          }
        }
      }
    }
  }

  // Missions of a superseded Get Hired window (e.g. after a campaign restart) stop counting.
  if (!input.getHired.completed) {
    const current = new Set(plan.filter((s) => s.campaign === "GET_HIRED" && s.type === "CAMPAIGN").map(specId));
    const open = await tx.mission.findMany({
      where: { userId, campaign: "GET_HIRED", type: "CAMPAIGN", status: "ACTIVE" },
      select: { id: true, key: true, periodStart: true },
    });
    const stale = open.filter((m) => !current.has(specId(m))).map((m) => m.id);
    if (stale.length) await tx.mission.updateMany({ where: { userId, id: { in: stale }, status: "ACTIVE" }, data: { status: "EXPIRED" } });
  }

  await reconcileSkips(tx, ctx, input);
  return plan;
}

/** Create the current period's missions inside a transaction (idempotent). */
export async function ensureMissionsTx(tx: Tx, userId: string, now = new Date()): Promise<MissionSpec[]> {
  return ensureWithContext(tx, await loadGameContext(tx, userId, now));
}

/**
 * Create the current day's, week's and campaign windows' missions idempotently: rows are unique on
 * (userId, key, periodStart) and inserted with ON CONFLICT DO NOTHING. `today` is an instant; the
 * calendar day is taken in the user's timezone.
 */
export async function ensureMissions(userId: string, today: Date = new Date()): Promise<MissionSpec[]> {
  return prisma.$transaction(
    async (tx) => {
      await lockPlayer(tx, userId);
      return ensureMissionsTx(tx, userId, today);
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

export type CompletedMission = { id: string; key: string; title: string; xpReward: number };

type EvaluateOptions = {
  now?: Date;
  /** Only evaluate missions measured by these metrics (event mode). */
  metrics?: ReadonlySet<MissionMetric>;
  ctx?: GameContext;
};

async function completeMission(tx: Tx, ctx: GameContext, m: Mission, target: number): Promise<boolean> {
  const res = await tx.mission.updateMany({
    where: { id: m.id, userId: ctx.userId, status: "ACTIVE" },
    data: { status: "COMPLETED", completedAt: ctx.now, progress: target, target },
  });
  if (res.count !== 1) return false;
  if (m.xpReward > 0) {
    await awardXp(tx, {
      userId: ctx.userId,
      reason: missionXpReason(m.type),
      amount: m.xpReward,
      dedupeKey: `xp:mission:${m.id}`,
      sourceType: "Mission",
      sourceId: m.id,
      activityDate: ctx.today,
    });
  }
  await tx.playerStats.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, missionsCompleted: 1 },
    update: { missionsCompleted: { increment: 1 } },
  });
  await tx.dailyActivity.upsert({
    where: { userId_date: { userId: ctx.userId, date: ctx.today } },
    create: { userId: ctx.userId, date: ctx.today, missionsCompleted: 1 },
    update: { missionsCompleted: { increment: 1 } },
  });
  return true;
}

/**
 * Recompute progress for active missions from persisted data, complete the ones that reached their
 * target (XP once via `xp:mission:<id>`, PlayerStats.missionsCompleted once) and, in full mode,
 * expire missions whose period ended. Completed missions are final: deleting the underlying
 * records later never takes mission XP back (missions never cost XP).
 */
export async function evaluateMissionsTx(tx: Tx, userId: string, opts: EvaluateOptions = {}): Promise<CompletedMission[]> {
  const ctx = opts.ctx ?? (await loadGameContext(tx, userId, opts.now));
  const missions = await tx.mission.findMany({
    where: { userId, status: "ACTIVE", periodStart: { lte: ctx.today } },
    orderBy: [{ periodStart: "asc" }, { createdAt: "asc" }],
  });
  const mctx: MetricContext = {
    tx,
    userId,
    timezone: ctx.timezone,
    today: ctx.today,
    todayKey: ctx.todayKey,
    workdaysPerWeek: ctx.profile.workdaysPerWeek,
    memo: new Map(),
  };
  const completed: CompletedMission[] = [];
  for (const m of missions) {
    const meta = readMissionMeta(m.metadata);
    if (opts.metrics && !opts.metrics.has(meta.metric)) continue;
    const r = await measureMission(mctx, m, meta);
    const target = Math.max(0, Math.floor(r.target ?? m.target));
    if (target === 0) {
      if (meta.metric === "FOLLOW_UPS_DUE_CLEARED") await setMissionState(tx, userId, m, "SKIPPED", "NOTHING_DUE");
      continue;
    }
    const progress = Math.max(0, Math.min(target, Math.floor(r.progress)));
    if (progress >= target) {
      if (await completeMission(tx, ctx, m, target)) completed.push({ id: m.id, key: m.key, title: m.title, xpReward: m.xpReward });
    } else if (progress !== m.progress || target !== m.target) {
      await tx.mission.updateMany({ where: { id: m.id, userId, status: "ACTIVE" }, data: { progress, target } });
    }
  }
  if (!opts.metrics) {
    await tx.mission.updateMany({ where: { userId, status: "ACTIVE", periodEnd: { lt: ctx.today } }, data: { status: "EXPIRED" } });
  }
  return completed;
}

// ---------------------------------------------------------------------------
// Event hook
// ---------------------------------------------------------------------------

const APPLY: MissionMetric[] = ["APPLICATIONS_DAY", "APPLICATIONS_WEEK", "APPLICATIONS_TOTAL", "APPLICATION_DAYS"];
const FOLLOW: MissionMetric[] = ["FOLLOW_UPS_DUE_CLEARED", "FOLLOW_UPS"];
const INTERVIEW: MissionMetric[] = ["INTERVIEW_PREP", "INTERVIEW_PREPS_PERIOD", "INTERVIEWS_PERIOD"];
const STATE: MissionMetric[] = [
  "ONBOARDING",
  "TRACKING_CONNECTED",
  "TARGET_COMPANIES",
  "PROGRAMS_RESEARCHED",
  "PROGRAM_APPLICATIONS",
  "SCHOOL_ENROLLED",
  "TRAINEE_REGISTERED",
  "EXAM_APPLIED",
  "EXAM_PASSED",
  "SALARY_PREP",
  "OFFERS_RECORDED",
];

/** Which missions an event can move. Event types not listed here cannot change any mission. */
export const EVENT_METRICS: Record<MissionEventContext["type"], MissionMetric[]> = {
  APPLIED: APPLY,
  MERGED: [...APPLY, ...FOLLOW, ...INTERVIEW, "OFFERS_RECORDED"],
  FOLLOW_UP_SENT: FOLLOW,
  REJECTED: ["FOLLOW_UPS_DUE_CLEARED"],
  WITHDRAWN: ["FOLLOW_UPS_DUE_CLEARED"],
  OFFER_RECEIVED: ["FOLLOW_UPS_DUE_CLEARED", "OFFERS_RECORDED"],
  OFFER_ACCEPTED: ["FOLLOW_UPS_DUE_CLEARED", "OFFERS_RECORDED"],
  OFFER_DECLINED: ["FOLLOW_UPS_DUE_CLEARED", "OFFERS_RECORDED"],
  INTERVIEW_SCHEDULED: INTERVIEW,
  INTERVIEW_COMPLETED: INTERVIEW,
  INTERVIEW_PREPARED: ["INTERVIEW_PREP", "INTERVIEW_PREPS_PERIOD"],
  SAVED: [],
  CONFIRMATION_RECEIVED: [],
  RECRUITER_RESPONSE: [],
  SCREENING_SCHEDULED: [],
  ASSESSMENT_INVITED: [],
  NOTE_ADDED: [],
  STATUS_CHANGED: [],
  ONBOARDING_RECEIVED: [],
  LESSON_COMPLETED: ["LESSONS", "FUNDAMENTALS_LESSONS", "TRAINING_MILESTONE"],
  QUIZ_PASSED: ["QUIZ_PASSED", "TRAINING_MILESTONE"],
  WORK_HOURS_LOGGED: ["TRAINING_HOURS_LOGGED", "HOURS_ENTRIES", "VERIFIED_HOURS", "TRAINING_MILESTONE"],
  PROFILE_UPDATED: STATE,
  RESUME_UPDATED: ["RESUME_VERSIONS", "RESUME_IMPROVED"],
};

/** Missions for today / this week are missing (the user has not opened the app today). */
async function needsEnsure(tx: Tx, ctx: GameContext): Promise<boolean> {
  const weekly = await tx.mission.count({ where: { userId: ctx.userId, type: "WEEKLY", periodStart: ctx.weekStart } });
  if (weekly === 0) return true;
  if (!isScheduledWorkday(ctx.today, ctx.profile.workdaysPerWeek)) return false;
  const daily = await tx.mission.count({ where: { userId: ctx.userId, type: "DAILY", periodStart: ctx.today } });
  return daily === 0;
}

/**
 * Advance missions for an event inside the caller's transaction. Progress is recomputed from
 * persisted data (never incremented), so calling this any number of times for the same event is
 * safe: a mission completes once and its XP is awarded once.
 */
export async function applyEventToMissions(tx: Tx, ctx: MissionEventContext): Promise<void> {
  const metrics = EVENT_METRICS[ctx.type];
  if (!metrics || metrics.length === 0) return;
  await lockPlayer(tx, ctx.userId);
  const game = await loadGameContext(tx, ctx.userId);
  if (await needsEnsure(tx, game)) await ensureWithContext(tx, game);
  await evaluateMissionsTx(tx, ctx.userId, { metrics: new Set(metrics), ctx: game });
  if (STAT_EVENTS.has(ctx.type)) await refreshPlayerStats(tx, ctx.userId);
}

/** Events that change an input of the derived player stats. */
const STAT_EVENTS: ReadonlySet<MissionEventContext["type"]> = new Set<MissionEventContext["type"]>([
  "FOLLOW_UP_SENT",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "INTERVIEW_PREPARED",
  "MERGED",
  "LESSON_COMPLETED",
  "QUIZ_PASSED",
  "WORK_HOURS_LOGGED",
  "RESUME_UPDATED",
]);
