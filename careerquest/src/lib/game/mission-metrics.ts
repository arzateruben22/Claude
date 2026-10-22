import "server-only";
import type { Mission } from "@/generated/prisma/client";
import type { Tx } from "@/lib/game/xp";
import { addUtcDays, dateKey, dateKeyInTz } from "@/lib/dates";
import { endOfDayInTz, followUpDateKey, startOfDayInTz } from "@/lib/dashboard/time";
import { ACTIVE_STATUSES } from "@/lib/dashboard/funnel";
import {
  NEXT_PHASE_PLAN_MIN_LENGTH,
  PHASE2_WORKDAY_RATIO,
  TRAINING_MILESTONE_HOURS,
  TRAINING_MILESTONE_LESSONS,
  applicationDaysTarget,
  type MissionMeta,
} from "@/lib/game/mission-catalog";
import { appliedDayKeys, countDistinctAppliedPositions, verifiedHoursTotal } from "@/lib/game/facts";
import { fundamentalsLessonKeys } from "@/lib/game/lessons-index";
import { planCountsInWindow, readGetHiredMeta } from "@/lib/game/campaign-meta";
import { positionKey } from "@/lib/game/positions";

/**
 * Mission progress, recomputed from persisted data on every evaluation. Nothing here increments a
 * counter, so replaying an event, re-running an import or evaluating twice can never double count.
 * Queries run sequentially (they share the caller's interactive transaction).
 */
export type MetricContext = {
  tx: Tx;
  userId: string;
  timezone: string;
  today: Date;
  todayKey: string;
  workdaysPerWeek: number;
  /** Per-evaluation memo for facts shared by several missions. */
  memo: Map<string, unknown>;
};

export type Measurement = { progress: number; target?: number };

export type MeasurableMission = Pick<Mission, "id" | "periodStart" | "periodEnd" | "target">;

const PROGRAM_APPLIED_STATUSES = ["APPLIED", "TESTING", "INTERVIEWING", "WAITLISTED", "ACCEPTED"] as const;

async function memo<T>(ctx: MetricContext, key: string, fn: () => Promise<T>): Promise<T> {
  if (ctx.memo.has(key)) return ctx.memo.get(key) as T;
  const v = await fn();
  ctx.memo.set(key, v);
  return v;
}

/** Instant range [from, to) covering the mission's calendar period in the user's timezone. */
export function missionWindow(m: Pick<Mission, "periodStart" | "periodEnd">, timezone: string): { from: Date; to: Date } {
  return { from: startOfDayInTz(dateKey(m.periodStart), timezone), to: endOfDayInTz(dateKey(m.periodEnd), timezone) };
}

const one = (b: boolean): Measurement => ({ progress: b ? 1 : 0 });

/**
 * Distinct qualified positions first applied inside [from, to). Merged-away duplicates are
 * excluded and a position already applied to before the window does not count again.
 */
export async function newPositionsApplied(ctx: MetricContext, from: Date, to: Date): Promise<number> {
  const { tx, userId } = ctx;
  const events = await tx.applicationEvent.findMany({
    where: { userId, type: "APPLIED", occurredAt: { gte: from, lt: to }, application: { mergedIntoId: null, isQualified: true } },
    select: { application: { select: { normalizedCompany: true, normalizedTitle: true, location: true } } },
  });
  const keys = new Set(events.map((e) => positionKey(e.application)));
  if (keys.size === 0) return 0;
  const pairs = new Map<string, { normalizedCompany: string; normalizedTitle: string }>();
  for (const e of events) {
    const { normalizedCompany, normalizedTitle } = e.application;
    pairs.set(`${normalizedCompany}|${normalizedTitle}`, { normalizedCompany, normalizedTitle });
  }
  const prior = await tx.application.findMany({
    where: {
      userId,
      mergedIntoId: null,
      OR: [...pairs.values()],
      events: { some: { type: "APPLIED", occurredAt: { lt: from } } },
    },
    select: { normalizedCompany: true, normalizedTitle: true, location: true },
  });
  for (const p of prior) keys.delete(positionKey(p));
  return keys.size;
}

async function followUpsInWindow(ctx: MetricContext, from: Date, to: Date): Promise<number> {
  const events = await ctx.tx.applicationEvent.findMany({
    where: { userId: ctx.userId, type: "FOLLOW_UP_SENT", occurredAt: { gte: from, lt: to }, application: { mergedIntoId: null } },
    select: { applicationId: true, occurredAt: true },
  });
  // One follow-up per application per day, matching the XP rule.
  return new Set(events.map((e) => `${e.applicationId}|${dateKeyInTz(e.occurredAt, ctx.timezone)}`)).size;
}

async function followUpsDueCleared(ctx: MetricContext, meta: MissionMeta, from: Date, to: Date): Promise<Measurement> {
  const ids = meta.applicationIds ?? [];
  if (ids.length === 0) return { progress: 0, target: 0 };
  const { tx, userId } = ctx;
  const followed = new Set(
    (
      await tx.applicationEvent.findMany({
        where: { userId, applicationId: { in: ids }, type: "FOLLOW_UP_SENT", occurredAt: { gte: from, lt: to } },
        select: { applicationId: true },
      })
    ).map((e) => e.applicationId),
  );
  const apps = await tx.application.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, archivedAt: true, mergedIntoId: true, status: true, followUpAt: true },
  });
  let stillDue = 0;
  for (const a of apps) {
    if (followed.has(a.id)) continue;
    const open = !a.archivedAt && !a.mergedIntoId && ACTIVE_STATUSES.includes(a.status);
    if (open && a.followUpAt && followUpDateKey(a.followUpAt, ctx.timezone) <= ctx.todayKey) stillDue += 1;
  }
  const progress = apps.filter((a) => followed.has(a.id)).length;
  return { progress, target: progress + stillDue };
}

async function restDayKeys(ctx: MetricContext, start: Date, end: Date): Promise<Set<string>> {
  const rows = await ctx.tx.dailyActivity.findMany({
    where: { userId: ctx.userId, restDay: true, date: { gte: start, lte: end } },
    select: { date: true },
  });
  return new Set(rows.map((r) => dateKey(r.date)));
}

async function getHiredPlan(ctx: MetricContext) {
  return memo(ctx, "ghMeta", async () => {
    const row = await ctx.tx.campaignState.findUnique({
      where: { userId_campaign: { userId: ctx.userId, campaign: "GET_HIRED" } },
      select: { metadata: true },
    });
    return readGetHiredMeta(row?.metadata).nextPhasePlan;
  });
}

export async function measureMission(ctx: MetricContext, m: MeasurableMission, meta: MissionMeta): Promise<Measurement> {
  const { tx, userId } = ctx;
  const { from, to } = missionWindow(m, ctx.timezone);
  switch (meta.metric) {
    case "APPLICATIONS_DAY":
    case "APPLICATIONS_WEEK":
      return { progress: await newPositionsApplied(ctx, from, to) };
    case "APPLICATIONS_TOTAL":
      return { progress: await memo(ctx, "distinctApps", () => countDistinctAppliedPositions(tx, userId)) };
    case "FOLLOW_UPS_DUE_CLEARED":
      return followUpsDueCleared(ctx, meta, from, to);
    case "FOLLOW_UPS":
      return { progress: await followUpsInWindow(ctx, from, to) };
    case "LESSONS":
      return { progress: await tx.lessonProgress.count({ where: { userId, status: "COMPLETED", completedAt: { gte: from, lt: to } } }) };
    case "TRAINING_HOURS_LOGGED":
      return {
        progress: await tx.workHourEntry.count({
          where: { userId, OR: [{ createdAt: { gte: from, lt: to } }, { dateWorked: { gte: m.periodStart, lte: m.periodEnd } }] },
        }),
      };
    case "INTERVIEW_PREP":
      return {
        progress: await tx.interview.count({
          where: {
            userId,
            prepCompletedAt: { not: null },
            application: { mergedIntoId: null },
            OR: [{ prepCompletedAt: { gte: from, lt: to } }, { scheduledAt: { gte: from } }],
          },
        }),
      };
    case "QUIZ_PASSED":
      return { progress: await tx.quizAttempt.count({ where: { userId, passed: true, createdAt: { gte: from, lt: to } } }) };
    case "ONBOARDING": {
      const p = await tx.userProfile.findUnique({ where: { userId }, select: { onboardingCompletedAt: true } });
      return one(Boolean(p?.onboardingCompletedAt));
    }
    case "RESUME_VERSIONS":
      return { progress: await tx.resumeVersion.count({ where: { userId } }) };
    case "RESUME_IMPROVED":
      return {
        progress: await tx.resumeVersion.count({
          where: { userId, OR: [{ createdAt: { gte: from, lt: to } }, { updatedAt: { gte: from, lt: to } }] },
        }),
      };
    case "TRACKING_CONNECTED": {
      const connected = await tx.integrationConnection.count({ where: { userId, status: "CONNECTED" } });
      if (connected > 0) return one(true);
      const imports = await tx.importBatch.count({ where: { userId, status: { in: ["SUCCEEDED", "PARTIAL"] } } });
      return one(imports > 0);
    }
    case "TARGET_COMPANIES":
      return { progress: await tx.targetCompany.count({ where: { userId } }) };
    case "PROGRAMS_RESEARCHED":
      return { progress: await tx.userProgramInterest.count({ where: { userId } }) };
    case "FUNDAMENTALS_LESSONS": {
      const keys = fundamentalsLessonKeys();
      if (keys.length === 0) return { progress: 0 };
      const done = await tx.lessonProgress.count({ where: { userId, status: "COMPLETED", lessonKey: { in: keys } } });
      return { progress: done, target: keys.length };
    }
    case "APPLICATION_DAYS": {
      const rest = await restDayKeys(ctx, m.periodStart, m.periodEnd);
      const target = applicationDaysTarget(m.periodStart, m.periodEnd, ctx.workdaysPerWeek, meta.ratio ?? PHASE2_WORKDAY_RATIO, rest);
      const lastDay = m.periodEnd.getTime() < ctx.today.getTime() ? m.periodEnd : ctx.today;
      const days = await appliedDayKeys(tx, userId, ctx.timezone, { from, to: endOfDayInTz(dateKey(lastDay), ctx.timezone) });
      return { progress: days.length, target };
    }
    case "INTERVIEW_PREPS_PERIOD":
      return {
        progress: await tx.interview.count({ where: { userId, prepCompletedAt: { gte: from, lt: to }, application: { mergedIntoId: null } } }),
      };
    case "SELF_CHECK":
      return one(Boolean(meta.checkedAt));
    case "TRAINING_MILESTONE": {
      const lessons = await tx.lessonProgress.count({ where: { userId, status: "COMPLETED", completedAt: { gte: from, lt: to } } });
      if (lessons >= TRAINING_MILESTONE_LESSONS) return one(true);
      const quizzes = await tx.quizAttempt.count({ where: { userId, passed: true, createdAt: { gte: from, lt: to } } });
      if (quizzes > 0) return one(true);
      const hours = await tx.workHourEntry.aggregate({
        where: { userId, dateWorked: { gte: m.periodStart, lte: m.periodEnd } },
        _sum: { hours: true },
      });
      return one(Number(hours._sum.hours?.toString() ?? 0) >= TRAINING_MILESTONE_HOURS);
    }
    case "INTERVIEWS_PERIOD":
      return {
        progress: await tx.interview.count({
          where: { userId, application: { mergedIntoId: null }, OR: [{ createdAt: { gte: from, lt: to } }, { scheduledAt: { gte: from, lt: to } }] },
        }),
      };
    case "OFFERS_RECORDED":
      return { progress: await tx.offer.count({ where: { userId, application: { mergedIntoId: null } } }) };
    case "SALARY_PREP":
      if (meta.checkedAt) return one(true);
      return one((await tx.salaryScenario.count({ where: { userId } })) > 0);
    case "NEXT_PHASE_PLAN":
      return one(planCountsInWindow(await getHiredPlan(ctx), from, to, NEXT_PHASE_PLAN_MIN_LENGTH));
    case "PROGRAM_APPLICATIONS":
      return {
        progress: await tx.userProgramInterest.count({
          where: { userId, OR: [{ appliedAt: { not: null } }, { status: { in: [...PROGRAM_APPLIED_STATUSES] } }] },
        }),
      };
    case "SCHOOL_ENROLLED":
      return one((await tx.certificationStatus.count({ where: { userId, AND: [{ schoolEnrolled: { not: null } }, { schoolEnrolled: { not: "" } }] } })) > 0);
    case "TRAINEE_REGISTERED":
      return one((await tx.certificationStatus.count({ where: { userId, traineeRegisteredAt: { not: null } } })) > 0);
    case "HOURS_ENTRIES":
      return { progress: await tx.workHourEntry.count({ where: { userId } }) };
    case "VERIFIED_HOURS":
      return { progress: Math.floor(await memo(ctx, "verifiedHours", () => verifiedHoursTotal(tx, userId))) };
    case "EXAM_APPLIED":
      return one((await tx.certificationStatus.count({ where: { userId, examApplicationAt: { not: null } } })) > 0);
    case "EXAM_PASSED":
      return one((await tx.certificationStatus.count({ where: { userId, examPassedAt: { not: null } } })) > 0);
    default:
      return unknownMetric(meta.metric);
  }
}

/** Exhaustiveness guard: a metric added to the catalog without a measurement fails to compile. */
function unknownMetric(metric: never): Measurement {
  void metric;
  return { progress: 0 };
}

/** Days from `today` back to the start of a 14-day lookback (inclusive). */
export function lookbackStart(today: Date, days = 14): Date {
  return addUtcDays(today, -(days - 1));
}
