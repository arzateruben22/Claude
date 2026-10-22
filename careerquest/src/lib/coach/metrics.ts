import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DAY_MS, addUtcDays, dateFromKey, startOfWeekUtc, todayInTz } from "@/lib/dates";
import { FUNNEL_EVENT_TYPES, appliedDayKey, computeFunnel, conversionBy } from "@/lib/analytics/funnel";
import type { ConversionRow, FunnelApplication } from "@/lib/analytics/types";
import { utcDateKey } from "@/lib/analytics/time";
import { hasApplied } from "@/lib/applications/status";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { ACTIVE_STATUSES } from "@/lib/dashboard/funnel";
import { campaignTimeline } from "@/lib/dashboard/campaign";
import { followUpDateKey, followUpDueBound } from "@/lib/dashboard/time";
import { weekTargets } from "@/lib/goals/calculator";
import { isActiveDay, isScheduledWorkday } from "@/lib/game/streak";
import { safeTimezone, VERIFIED_HOUR_SOURCES } from "@/lib/game/facts";
import { annualize } from "@/lib/game/achievement-catalog";
import { listLessons } from "@/lib/academy/content";
import { buildLessonViews, buildTrackViews, suggestNextLesson, type LessonSummary } from "@/lib/academy/progress";
import type { ApplicationSource } from "@/generated/prisma/enums";
import { STALE_DAYS, buildSnapshot } from "./snapshot";
import type { CoachFacts, CoachSnapshot, ConversionFact, ProgramFact, QuizFact, StaleApplicationFact } from "./types";

/**
 * Loads the Advisor's facts from persisted, userId-scoped data and builds the cited metric snapshot.
 * Definitions are shared with the rest of the app:
 * - funnel and conversions: `computeFunnel` / `conversionBy` over non-archived, non-merged
 *   applications (Analytics' default slice);
 * - effort counts (today, this week): applications by the day they were applied in the user's
 *   timezone, archived included (the dashboard's rule);
 * - follow-ups: active statuses with a follow-up date due by the end of today (dashboard rule).
 */

/** Safety cap on applications read for in-memory funnel math (same as Analytics). */
export const MAX_COACH_APPLICATIONS = 5000;

const appSelect = {
  id: true,
  companyName: true,
  positionTitle: true,
  status: true,
  appliedAt: true,
  statusUpdatedAt: true,
  createdAt: true,
  archivedAt: true,
  source: true,
  jobCategory: true,
  resumeVersionId: true,
  followUpAt: true,
  statusHistory: { select: { toStatus: true, occurredAt: true } },
  events: { where: { type: { in: FUNNEL_EVENT_TYPES } }, select: { type: true, occurredAt: true } },
  _count: { select: { interviews: true, offers: true } },
} satisfies Prisma.ApplicationSelect;

type AppRow = Prisma.ApplicationGetPayload<{ select: typeof appSelect }>;

function toFunnel(r: AppRow): FunnelApplication {
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

function toConversion(rows: ConversionRow[], label: (key: string) => string): ConversionFact[] {
  return rows
    .filter((r): r is ConversionRow & { key: string } => r.key !== null)
    .map((r) => ({ key: r.key, label: label(r.key), applied: r.applied, responded: r.responded, interviews: r.interviews, offers: r.offers }));
}

function num(v: { toString(): string } | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function lessonsSafe(): LessonSummary[] {
  try {
    return listLessons();
  } catch {
    return [];
  }
}

function quizLabel(quizKey: string, lessons: LessonSummary[]): { label: string; href: string } {
  if (quizKey.startsWith("exam:")) {
    const size = quizKey.split(":")[1];
    return { label: `Practice exam${size ? ` (${size} questions)` : ""}`, href: "/academy/exam" };
  }
  if (quizKey.startsWith("workshop:")) {
    const key = quizKey.slice("workshop:".length);
    return { label: `Workshop: ${key.replace(/-/g, " ")}`, href: `/academy/workshop/${key}` };
  }
  const lesson = lessons.find((l) => l.quizKey === quizKey);
  return lesson ? { label: `${lesson.title} quiz`, href: `/academy/lessons/${lesson.key}` } : { label: quizKey.replace(/-/g, " "), href: "/academy" };
}

export async function loadCoachFacts(userId: string, now = new Date()): Promise<CoachFacts> {
  const [user, profile, campaignRow] = await Promise.all([
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
        openToApprenticeships: true,
        primaryTrade: true,
      },
    }),
    prisma.campaignState.findUnique({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, select: { startedAt: true } }),
  ]);
  if (!user) throw new Error("User not found");

  const timezone = safeTimezone(profile?.timezone);
  const today = todayInTz(timezone, now);
  const todayKey = utcDateKey(today);
  const weekStart = startOfWeekUtc(today);
  const weekStartKey = utcDateKey(weekStart);
  const targets = weekTargets({
    dailyApplicationTarget: profile?.dailyApplicationTarget ?? 5,
    workdaysPerWeek: profile?.workdaysPerWeek ?? 5,
    weeklyApplicationTarget: profile?.weeklyApplicationTarget ?? 25,
  });
  const campaignStart = campaignRow?.startedAt ?? todayInTz(timezone, user.createdAt);
  const timeline = campaignTimeline({ startDate: campaignStart, today, lengthDays: profile?.campaignLengthDays ?? 90 });

  const lessons = lessonsSafe();
  const staleBefore = new Date(now.getTime() - STALE_DAYS * DAY_MS);

  const [apps, lastEvents, resumes, stats, activity, lessonRows, quizRows, hourGroups, lastHour, interviews, attended, offers, programs, interests] =
    await Promise.all([
      prisma.application.findMany({ where: { userId, mergedIntoId: null }, orderBy: { createdAt: "desc" }, take: MAX_COACH_APPLICATIONS, select: appSelect }),
      prisma.applicationEvent.groupBy({ by: ["applicationId"], where: { userId }, _max: { occurredAt: true } }),
      prisma.resumeVersion.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, isDefault: true } }),
      prisma.playerStats.findUnique({ where: { userId }, select: { totalXp: true, currentStreak: true, longestStreak: true } }),
      prisma.dailyActivity.findMany({
        where: { userId, date: { gte: addUtcDays(today, -40), lte: today } },
        select: { date: true, xpEarned: true, applicationsSubmitted: true, followUps: true, lessonsCompleted: true, missionsCompleted: true, trainingHours: true, restDay: true },
      }),
      prisma.lessonProgress.findMany({ where: { userId }, select: { lessonKey: true, status: true, bestScore: true, attempts: true, completedAt: true, updatedAt: true } }),
      prisma.quizAttempt.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { quizKey: true, score: true, maxScore: true, passed: true, createdAt: true } }),
      prisma.workHourEntry.groupBy({ by: ["verification"], where: { userId }, _sum: { hours: true }, _count: { _all: true } }),
      prisma.workHourEntry.findFirst({ where: { userId }, orderBy: { dateWorked: "desc" }, select: { dateWorked: true } }),
      prisma.interview.findMany({
        where: { userId, outcome: "PENDING", scheduledAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) }, application: { mergedIntoId: null } },
        orderBy: { scheduledAt: "asc" },
        take: 10,
        select: { id: true, applicationId: true, type: true, scheduledAt: true, prepCompletedAt: true, application: { select: { companyName: true, positionTitle: true } } },
      }),
      prisma.interview.count({ where: { userId, attendedAt: { not: null }, application: { mergedIntoId: null } } }),
      prisma.offer.findMany({
        where: { userId, status: { in: ["RECEIVED", "NEGOTIATING"] }, application: { mergedIntoId: null } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { applicationId: true, status: true, baseAmount: true, period: true, hoursPerWeek: true, decisionDue: true, application: { select: { companyName: true, positionTitle: true } } },
      }),
      prisma.apprenticeshipProgram.findMany({ orderBy: { name: "asc" }, take: 100 }),
      prisma.userProgramInterest.findMany({ where: { userId }, select: { programId: true, status: true } }),
    ]);

  // Funnel and conversions over the non-archived slice; effort counts include archived records.
  const funnelApps: FunnelApplication[] = [];
  const appliedByDay: Record<string, number> = {};
  for (const r of apps) {
    const fa = toFunnel(r);
    if (!r.archivedAt) funnelApps.push(fa);
    const key = appliedDayKey(fa, timezone);
    if (key) appliedByDay[key] = (appliedByDay[key] ?? 0) + 1;
  }
  const funnel = computeFunnel(funnelApps);
  const resumeNames = new Map(resumes.map((r) => [r.id, r.name]));
  const conversions = {
    category: toConversion(conversionBy(funnelApps, "jobCategory"), (k) => k),
    source: toConversion(conversionBy(funnelApps, "source"), (k) => SOURCE_LABELS[k as ApplicationSource] ?? k),
    resume: toConversion(conversionBy(funnelApps, "resumeVersionId"), (k) => resumeNames.get(k) ?? "Deleted résumé"),
  };

  // This week and today.
  let weekApplied = 0;
  let activeDays = 0;
  let workdaysBeforeToday = 0;
  for (let i = 0; i < 7; i++) {
    const day = addUtcDays(weekStart, i);
    const key = utcDateKey(day);
    const c = appliedByDay[key] ?? 0;
    weekApplied += c;
    if (c > 0) activeDays++;
    if (key < todayKey && isScheduledWorkday(day, targets.workdaysPerWeek)) workdaysBeforeToday++;
  }
  const expectedByYesterday = Math.min(targets.weeklyTarget, targets.dailyTarget * workdaysBeforeToday);

  // Follow-ups (dashboard rule) and stale applications.
  const dueBound = followUpDueBound(todayKey, timezone);
  let overdue = 0;
  let dueToday = 0;
  let firstOverdueId: string | null = null;
  const lastEventAt = new Map(lastEvents.map((e) => [e.applicationId, e._max.occurredAt]));
  const stale: StaleApplicationFact[] = [];
  for (const r of apps) {
    if (r.archivedAt) continue;
    if (ACTIVE_STATUSES.includes(r.status) && r.followUpAt && r.followUpAt.getTime() <= dueBound.getTime()) {
      const key = followUpDateKey(r.followUpAt, timezone);
      if (key < todayKey) {
        overdue++;
        firstOverdueId ??= r.id;
      } else if (key === todayKey) dueToday++;
    }
    if ((r.status === "SUBMITTED" || r.status === "CONFIRMED") && hasApplied(r)) {
      if (r.followUpAt && r.followUpAt.getTime() > now.getTime()) continue; // a follow-up is already planned
      const candidates = [r.appliedAt, r.statusUpdatedAt, lastEventAt.get(r.id) ?? null, r.followUpAt].filter((d): d is Date => d instanceof Date);
      const last = Math.max(...candidates.map((d) => d.getTime()));
      if (Number.isFinite(last) && last < staleBefore.getTime()) {
        stale.push({ id: r.id, company: r.companyName, title: r.positionTitle, daysSinceActivity: Math.floor((now.getTime() - last) / DAY_MS) });
      }
    }
  }
  stale.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  // Consecutive active calendar days, ending today (if active) or yesterday.
  const activeKeys = new Set(activity.filter((a) => !a.restDay && isActiveDay(a)).map((a) => utcDateKey(a.date)));
  let consecutive = 0;
  let cursor = activeKeys.has(todayKey) ? today : addUtcDays(today, -1);
  while (activeKeys.has(utcDateKey(cursor))) {
    consecutive++;
    cursor = addUtcDays(cursor, -1);
  }

  // Academy.
  const views = buildLessonViews(lessons, lessonRows);
  const tracks = buildTrackViews(views).map((t) => ({ key: t.key, label: t.label, completed: t.completed, total: t.total }));
  const next = suggestNextLesson(views);
  const lastLessonAt = lessonRows.reduce<number | null>((m, r) => (m === null || r.updatedAt.getTime() > m ? r.updatedAt.getTime() : m), null);
  const lastQuizAt = quizRows[0]?.createdAt.getTime() ?? null;
  const lastAcademy = Math.max(lastLessonAt ?? -Infinity, lastQuizAt ?? -Infinity);
  const recentQuizzes: QuizFact[] = quizRows.map((q) => {
    const { label, href } = quizLabel(q.quizKey, lessons);
    return { quizKey: q.quizKey, label, href, percent: q.maxScore > 0 ? Math.round((q.score / q.maxScore) * 100) : 0, passed: q.passed, at: q.createdAt.toISOString() };
  });

  // Work hours.
  let selfReported = 0;
  let verified = 0;
  let entries = 0;
  for (const g of hourGroups) {
    const h = num(g._sum.hours);
    entries += g._count._all;
    if ((VERIFIED_HOUR_SOURCES as readonly string[]).includes(g.verification)) verified += h;
    else selfReported += h;
  }

  // Interviews and offers.
  const nextInterview = interviews[0];
  const offerFacts = offers.map((o) => {
    const base = num(o.baseAmount);
    const due = o.decisionDue ? utcDateKey(todayInTz(timezone, o.decisionDue)) : null;
    return {
      applicationId: o.applicationId,
      company: o.application.companyName,
      title: o.application.positionTitle,
      status: o.status,
      baseAmount: base,
      period: o.period,
      annualized: base > 0 ? Math.round(annualize(base, o.period, o.hoursPerWeek)) : null,
      decisionDue: due,
      daysToDecision: due ? Math.round((dateFromKey(due).getTime() - today.getTime()) / DAY_MS) : null,
    };
  });

  // Apprenticeship programs (global directory) with the user's own tracking status.
  const interestBy = new Map(interests.map((i) => [i.programId, i.status]));
  const programFacts: ProgramFact[] = programs.map((p) => ({
    slug: p.slug,
    name: p.name,
    sponsor: p.sponsor,
    region: p.region,
    isUnion: p.isUnion,
    recruitmentStatus: p.recruitmentStatus,
    verifiedOn: p.verifiedOn ? utcDateKey(p.verifiedOn) : null,
    recruitmentNote: p.recruitmentNote,
    website: p.website,
    applyUrl: p.applyUrl,
    startingWage: p.startingWage,
    startingWageVerified: p.startingWageVerified,
    durationYears: p.durationYears,
    classroomHours: p.classroomHours,
    interestStatus: interestBy.get(p.id) ?? null,
  }));

  return {
    generatedAt: now.toISOString(),
    timezone,
    todayKey,
    weekStartKey,
    profile: {
      name: user.name,
      onboardingComplete: Boolean(profile?.onboardingCompletedAt),
      dailyTarget: targets.dailyTarget,
      weeklyTarget: targets.weeklyTarget,
      workdaysPerWeek: targets.workdaysPerWeek,
      immediateSalaryTarget: profile?.immediateSalaryTarget ?? 80000,
      longTermSalaryTarget: profile?.longTermSalaryTarget ?? 150000,
      openToApprenticeships: profile?.openToApprenticeships ?? true,
      primaryTrade: profile?.primaryTrade ?? "ELECTRICIAN",
    },
    campaign: {
      started: timeline.started,
      beyond: timeline.beyond,
      day: timeline.day,
      lengthDays: timeline.lengthDays,
      phase: timeline.phase,
      phaseName: timeline.phaseName,
      daysRemaining: Math.max(0, timeline.lengthDays - timeline.day + 1),
    },
    funnel: {
      total: funnel.counts.total,
      applied: funnel.counts.applied,
      responded: funnel.counts.responded,
      screened: funnel.counts.screened,
      interviewed: funnel.counts.interviewed,
      offers: funnel.counts.offers,
      hired: funnel.counts.hired,
    },
    conversions,
    week: {
      applied: weekApplied,
      target: targets.weeklyTarget,
      dailyTarget: targets.dailyTarget,
      expectedByYesterday,
      activeDays,
      todayApplied: appliedByDay[todayKey] ?? 0,
      todayIsWorkday: isScheduledWorkday(today, targets.workdaysPerWeek),
    },
    followUps: { overdue, dueToday, firstOverdueId },
    stale: { count: stale.length, items: stale.slice(0, 10) },
    streak: { current: stats?.currentStreak ?? 0, longest: stats?.longestStreak ?? 0, consecutiveActiveDays: consecutive },
    academy: {
      tracks,
      lessonsCompleted: views.filter((v) => v.state === "COMPLETED").length,
      lessonsTotal: views.length,
      inProgress: views.filter((v) => v.state === "IN_PROGRESS").length,
      next: next ? { key: next.key, title: next.title } : null,
      daysSinceActivity: Number.isFinite(lastAcademy) ? Math.max(0, Math.floor((now.getTime() - lastAcademy) / DAY_MS)) : null,
      recentQuizzes,
    },
    hours: {
      selfReported: Math.round(selfReported * 100) / 100,
      verified: Math.round(verified * 100) / 100,
      entries,
      daysSinceLast: lastHour ? Math.max(0, Math.round((today.getTime() - lastHour.dateWorked.getTime()) / DAY_MS)) : null,
    },
    interviews: {
      upcoming7d: interviews.length,
      attended,
      next: nextInterview
        ? {
            id: nextInterview.id,
            applicationId: nextInterview.applicationId,
            company: nextInterview.application.companyName,
            title: nextInterview.application.positionTitle,
            type: nextInterview.type,
            scheduledAt: nextInterview.scheduledAt.toISOString(),
            hoursUntil: Math.max(0, (nextInterview.scheduledAt.getTime() - now.getTime()) / 3_600_000),
            prepDone: nextInterview.prepCompletedAt !== null,
          }
        : null,
    },
    offers: { open: offerFacts },
    resumes: {
      count: resumes.length,
      latestName: resumes[0]?.name ?? null,
      latestId: resumes[0]?.id ?? null,
      defaultId: resumes.find((r) => r.isDefault)?.id ?? null,
    },
    programs: programFacts,
    xp: { total: stats?.totalXp ?? 0 },
  };
}

/** The Advisor snapshot (facts + cited metrics) for one user. */
export async function getCoachSnapshot(userId: string, now = new Date()): Promise<CoachSnapshot> {
  return buildSnapshot(await loadCoachFacts(userId, now));
}
