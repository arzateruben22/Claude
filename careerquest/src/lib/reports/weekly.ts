import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dateFromKey } from "@/lib/dates";
import { FUNNEL_EVENT_TYPES } from "@/lib/analytics/funnel";
import { addDaysKey, endOfDayInTz, instantDateKey, rangeBounds, startOfDayInTz, weekStartKey } from "@/lib/analytics/time";
import { weekTargets } from "@/lib/goals/calculator";
import { safeTimezone, VERIFIED_HOUR_SOURCES } from "@/lib/game/facts";
import { getCoachSnapshot } from "@/lib/coach/metrics";
import { evaluateRules, weeklyPriorities } from "@/lib/coach/rules";
import { citeMetrics } from "@/lib/coach/snapshot";
import { WEEKLY_REPORT_VERSION, type ReportRecommendation, type ReportWeekListItem, type WeeklyReportData } from "./types";
import { cumulativeFunnel, currentWeekStartKey, inWeek, isWeekStartKey, row, stageKeys, stageTimes, weekEndKey, weekLabel, type StageApplication } from "./week";

/**
 * Weekly reports: computed from persisted data for a Monday–Sunday week in the user's timezone and
 * stored idempotently in WeeklyReport (unique userId + weekStart).
 *
 * Freshness rule: the current week is recomputed every time it is opened; a past week is computed
 * once (the first time it is opened or generated) and then stays frozen until the user explicitly
 * regenerates it. A report generated before its week ended is marked incomplete.
 *
 * Counting rules: all non-merged applications count, archived ones included (archiving hides a
 * record; it does not undo the work). Stage counts ("responses received", "reached interview
 * stage", "offers") count applications whose *first* signal of that stage fell inside the week.
 */

export const MAX_REPORT_APPLICATIONS = 5000;
const MAX_LISTED_WEEKS = 52;

const reportAppSelect = {
  id: true,
  status: true,
  appliedAt: true,
  statusUpdatedAt: true,
  createdAt: true,
  source: true,
  jobCategory: true,
  resumeVersionId: true,
  statusHistory: { select: { toStatus: true, occurredAt: true } },
  events: { where: { type: { in: FUNNEL_EVENT_TYPES } }, select: { type: true, occurredAt: true } },
  interviews: { select: { createdAt: true } },
  offers: { select: { createdAt: true } },
} satisfies Prisma.ApplicationSelect;

async function userContext(userId: string) {
  const [profile, user] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true, dailyApplicationTarget: true, workdaysPerWeek: true, weeklyApplicationTarget: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  if (!user) throw new Error("User not found");
  const timezone = safeTimezone(profile?.timezone);
  const targets = weekTargets({
    dailyApplicationTarget: profile?.dailyApplicationTarget ?? 5,
    workdaysPerWeek: profile?.workdaysPerWeek ?? 5,
    weeklyApplicationTarget: profile?.weeklyApplicationTarget ?? 25,
  });
  return { timezone, targets, createdAt: user.createdAt };
}

function hours(v: Prisma.Decimal | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v.toString());
}

/** Compute (without storing) the report for a week. */
export async function computeWeeklyReport(userId: string, weekStart: string, now = new Date()): Promise<WeeklyReportData> {
  if (!isWeekStartKey(weekStart)) throw new Error(`Not a Monday week start: ${weekStart}`);
  const { timezone, targets } = await userContext(userId);
  const weekEnd = weekEndKey(weekStart);
  const priorStart = addDaysKey(weekStart, -7);
  const priorEnd = addDaysKey(weekStart, -1);
  // Instant bounds: [start of prior Monday, end of this Sunday) in the user's timezone, plus a wide
  // version that also covers date-only values stored as UTC midnight.
  const from = startOfDayInTz(priorStart, timezone);
  const to = endOfDayInTz(weekEnd, timezone);
  const wide = rangeBounds(priorStart, weekEnd, timezone);
  const inBoth = (key: string | null) => ({ thisWeek: inWeek(key, weekStart), priorWeek: inWeek(key, priorStart) });

  const [apps, followUps, interviewRows, xpRows, missions, lessons, quizzes, hourRows] = await Promise.all([
    prisma.application.findMany({ where: { userId, mergedIntoId: null }, orderBy: { createdAt: "desc" }, take: MAX_REPORT_APPLICATIONS, select: reportAppSelect }),
    prisma.applicationEvent.findMany({
      where: { userId, type: "FOLLOW_UP_SENT", occurredAt: { gte: wide.gte, lt: wide.lt }, application: { mergedIntoId: null } },
      select: { occurredAt: true },
    }),
    prisma.interview.findMany({
      where: {
        userId,
        application: { mergedIntoId: null },
        OR: [{ scheduledAt: { gte: wide.gte, lt: wide.lt } }, { attendedAt: { gte: wide.gte, lt: wide.lt } }],
      },
      select: { scheduledAt: true, attendedAt: true, outcome: true },
    }),
    prisma.xpLedger.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { amount: true, createdAt: true } }),
    prisma.mission.findMany({
      where: { userId, status: "COMPLETED", completedAt: { gte: from, lt: to } },
      orderBy: { completedAt: "asc" },
      select: { title: true, completedAt: true },
    }),
    prisma.lessonProgress.findMany({ where: { userId, completedAt: { gte: from, lt: to } }, select: { completedAt: true } }),
    prisma.quizAttempt.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { createdAt: true, score: true, maxScore: true, passed: true } }),
    prisma.workHourEntry.findMany({
      where: { userId, dateWorked: { gte: dateFromKey(priorStart), lte: dateFromKey(weekEnd) } },
      select: { dateWorked: true, hours: true, verification: true },
    }),
  ]);

  // Applications and stage transitions.
  const stages = apps.map((a) => {
    const stageApp: StageApplication = {
      ...a,
      hasInterviews: a.interviews.length > 0,
      hasOffers: a.offers.length > 0,
      interviewRows: a.interviews,
      offerRows: a.offers,
    };
    return stageKeys(stageTimes(stageApp), timezone);
  });
  const countStage = (pick: (s: (typeof stages)[number]) => string | null) => {
    let thisWeek = 0;
    let priorWeek = 0;
    for (const s of stages) {
      const w = inBoth(pick(s));
      if (w.thisWeek) thisWeek++;
      if (w.priorWeek) priorWeek++;
    }
    return { thisWeek, priorWeek };
  };
  const applied = countStage((s) => s.applied);
  const responded = countStage((s) => s.responded);
  const interviewed = countStage((s) => s.interviewed);
  const offers = countStage((s) => s.offer);
  const activeDays = (start: string) => new Set(stages.map((s) => s.applied).filter((k) => inWeek(k, start))).size;

  const tally = <T>(items: T[], key: (item: T) => string | null, amount: (item: T) => number = () => 1) => {
    let thisWeek = 0;
    let priorWeek = 0;
    for (const it of items) {
      const w = inBoth(key(it));
      if (w.thisWeek) thisWeek += amount(it);
      if (w.priorWeek) priorWeek += amount(it);
    }
    return { thisWeek, priorWeek };
  };
  const tzKey = (d: Date | null) => (d ? instantDateKey(d, timezone) : null);
  const followUpCounts = tally(followUps, (e) => tzKey(e.occurredAt));
  const calendar = tally(interviewRows.filter((i) => i.outcome !== "CANCELLED"), (i) => tzKey(i.scheduledAt));
  const attended = tally(interviewRows, (i) => tzKey(i.attendedAt));
  const xp = tally(xpRows, (x) => tzKey(x.createdAt), (x) => x.amount);
  const missionCounts = tally(missions, (m) => tzKey(m.completedAt));
  const lessonCounts = tally(lessons, (l) => tzKey(l.completedAt));
  const quizCounts = tally(quizzes, (q) => tzKey(q.createdAt));
  const quizPassed = tally(quizzes.filter((q) => q.passed), (q) => tzKey(q.createdAt));
  const dateKeyOf = (d: Date) => d.toISOString().slice(0, 10);
  const verifiedSet = new Set<string>(VERIFIED_HOUR_SOURCES);
  const selfHours = tally(hourRows.filter((h) => !verifiedSet.has(h.verification)), (h) => dateKeyOf(h.dateWorked), (h) => hours(h.hours));
  const verifiedHours = tally(hourRows.filter((h) => verifiedSet.has(h.verification)), (h) => dateKeyOf(h.dateWorked), (h) => hours(h.hours));

  const quizAvg = (start: string) => {
    const list = quizzes.filter((q) => inWeek(tzKey(q.createdAt), start) && q.maxScore > 0);
    return list.length ? Math.round(list.reduce((s, q) => s + (q.score / q.maxScore) * 100, 0) / list.length) : null;
  };

  const rows = [
    row({ key: "applications.applied", section: "applications", label: "Applications submitted", ...applied, basis: "observed", unit: "count", note: `Weekly target: ${targets.weeklyTarget}` }),
    row({ key: "applications.active_days", section: "applications", label: "Days with at least one application", thisWeek: activeDays(weekStart), priorWeek: activeDays(priorStart), basis: "observed", unit: "count" }),
    row({ key: "funnel.responses", section: "funnel", label: "Employer responses received", ...responded, basis: "observed", unit: "count", note: "Applications whose first employer response came this week (includes rejections)" }),
    row({ key: "funnel.interviews", section: "funnel", label: "Applications that reached the interview stage", ...interviewed, basis: "observed", unit: "count" }),
    row({ key: "interviews.scheduled", section: "funnel", label: "Interviews on the calendar", ...calendar, basis: "observed", unit: "count", note: "Interviews scheduled to take place this week (cancelled ones excluded)" }),
    row({ key: "interviews.attended", section: "funnel", label: "Interviews attended", ...attended, basis: "observed", unit: "count" }),
    row({ key: "funnel.offers", section: "funnel", label: "Offers received", ...offers, basis: "observed", unit: "count" }),
    row({ key: "followups.sent", section: "followups", label: "Follow-ups sent", ...followUpCounts, basis: "observed", unit: "count", note: "Follow-ups you recorded on applications" }),
    row({ key: "progress.xp", section: "progress", label: "Net XP earned", ...xp, basis: "observed", unit: "xp", note: "Game progress from real actions; revoked XP is subtracted" }),
    row({ key: "progress.missions", section: "progress", label: "Missions completed", ...missionCounts, basis: "observed", unit: "count" }),
    row({ key: "learning.lessons", section: "learning", label: "Lessons completed", ...lessonCounts, basis: "observed", unit: "count", note: "Study progress, not field experience or certification" }),
    row({ key: "learning.quiz_attempts", section: "learning", label: "Quiz, workshop and exam attempts", ...quizCounts, basis: "observed", unit: "count" }),
    row({ key: "learning.quizzes_passed", section: "learning", label: "Attempts passed", ...quizPassed, basis: "observed", unit: "count" }),
    row({ key: "hours.self_reported", section: "hours", label: "Work hours, self-reported", ...selfHours, basis: "self_reported", unit: "hours", note: "Not yet verified by an employer or official record" }),
    row({ key: "hours.verified", section: "hours", label: "Work hours, verified", ...verifiedHours, basis: "verified", unit: "hours", note: "Employer-verified or official records" }),
  ];

  // Top recommendations as of generation time (they reflect the user's data now, not that week).
  let recommendations: ReportRecommendation[] = [];
  try {
    const snapshot = await getCoachSnapshot(userId, now);
    recommendations = weeklyPriorities(evaluateRules(snapshot), 3).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      citations: citeMetrics(snapshot.byId, r.citations),
      action: r.action,
    }));
  } catch (err) {
    console.error("[reports] recommendations unavailable", err);
  }

  return {
    version: WEEKLY_REPORT_VERSION,
    weekStart,
    weekEnd,
    priorWeekStart: priorStart,
    timezone,
    generatedAt: now.toISOString(),
    complete: now.getTime() >= to.getTime(),
    target: { weekly: targets.weeklyTarget, daily: targets.dailyTarget },
    rows,
    cumulative: { thisWeek: cumulativeFunnel(stages, weekEnd), priorWeek: cumulativeFunnel(stages, priorEnd) },
    quizAverage: { thisWeek: quizAvg(weekStart), priorWeek: quizAvg(priorStart) },
    missionsCompleted: missions.filter((m) => inWeek(tzKey(m.completedAt), weekStart)).map((m) => m.title).slice(0, 20),
    recommendations,
  };
}

/** A stored report's data, or null when it is missing or written by an older/unknown version. */
export function readReportData(value: unknown): WeeklyReportData | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<WeeklyReportData>;
  if (d.version !== WEEKLY_REPORT_VERSION || typeof d.weekStart !== "string" || !Array.isArray(d.rows)) return null;
  return d as WeeklyReportData;
}

export type WeeklyReportResult =
  | { ok: true; report: WeeklyReportData; id: string; regenerated: boolean; isCurrentWeek: boolean }
  | { ok: false; reason: "invalid_week" | "future_week" };

async function store(userId: string, weekStart: string, data: WeeklyReportData): Promise<string> {
  const where = { userId_weekStart: { userId, weekStart: dateFromKey(weekStart) } };
  const json = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
  try {
    const row = await prisma.weeklyReport.upsert({ where, create: { userId, weekStart: dateFromKey(weekStart), data: json }, update: { data: json }, select: { id: true } });
    return row.id;
  } catch (err) {
    // Two concurrent first opens can race on the unique key; the second simply updates.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.weeklyReport.update({ where, data: { data: json }, select: { id: true } });
      return row.id;
    }
    throw err;
  }
}

/**
 * The report for a week, following the freshness rule: the current week is recomputed and stored on
 * every call; a past week is returned as stored unless `regenerate` is set (or it was never stored).
 */
export async function getWeeklyReport(userId: string, weekStart: string, opts: { now?: Date; regenerate?: boolean } = {}): Promise<WeeklyReportResult> {
  const now = opts.now ?? new Date();
  if (!isWeekStartKey(weekStart)) return { ok: false, reason: "invalid_week" };
  const { timezone } = await userContext(userId);
  const current = currentWeekStartKey(timezone, now);
  if (weekStart > current) return { ok: false, reason: "future_week" };
  const isCurrentWeek = weekStart === current;

  if (!isCurrentWeek && !opts.regenerate) {
    const existing = await prisma.weeklyReport.findUnique({ where: { userId_weekStart: { userId, weekStart: dateFromKey(weekStart) } }, select: { id: true, data: true } });
    const data = existing ? readReportData(existing.data) : null;
    if (existing && data) return { ok: true, report: data, id: existing.id, regenerated: false, isCurrentWeek };
  }
  const report = await computeWeeklyReport(userId, weekStart, now);
  const id = await store(userId, weekStart, report);
  return { ok: true, report, id, regenerated: true, isCurrentWeek };
}

/**
 * Weeks to list, newest first: from the current week back to the week of the user's first activity
 * (account creation or earliest application date), at most 52, plus any older stored reports.
 */
export async function listReportWeeks(userId: string, now = new Date()): Promise<ReportWeekListItem[]> {
  const { timezone, createdAt } = await userContext(userId);
  const current = currentWeekStartKey(timezone, now);
  const [earliestApp, stored] = await Promise.all([
    prisma.application.findFirst({ where: { userId, mergedIntoId: null, appliedAt: { not: null } }, orderBy: { appliedAt: "asc" }, select: { appliedAt: true } }),
    prisma.weeklyReport.findMany({ where: { userId }, orderBy: { weekStart: "desc" }, select: { weekStart: true, data: true } }),
  ]);
  const firstInstant = earliestApp?.appliedAt && earliestApp.appliedAt < createdAt ? earliestApp.appliedAt : createdAt;
  const firstWeek = weekStartKey(instantDateKey(firstInstant, timezone));
  const keys: string[] = [];
  for (let k = current; k >= firstWeek && keys.length < MAX_LISTED_WEEKS; k = addDaysKey(k, -7)) keys.push(k);
  const storedBy = new Map(stored.map((s) => [s.weekStart.toISOString().slice(0, 10), readReportData(s.data)]));
  for (const k of storedBy.keys()) if (!keys.includes(k) && k <= current) keys.push(k);
  keys.sort((a, b) => (a < b ? 1 : -1));
  return keys.map((k) => {
    const data = storedBy.get(k) ?? null;
    return {
      weekStart: k,
      weekEnd: weekEndKey(k),
      label: weekLabel(k),
      isCurrent: k === current,
      stored: data ? { generatedAt: data.generatedAt, complete: data.complete, applied: data.rows.find((r) => r.key === "applications.applied")?.thisWeek ?? null } : null,
    };
  });
}

export async function reportTimezone(userId: string): Promise<string> {
  return (await userContext(userId)).timezone;
}
