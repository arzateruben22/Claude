import "server-only";
import { prisma } from "@/lib/db";
import { awardXp } from "@/lib/game/xp";
import { levelFromXp } from "@/lib/game/xp-config";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { dateKey, todayInTz } from "@/lib/dates";
import { getLesson, getQuestionBank, getWorkshop, listLessons, listWorkshops, toLessonSummary } from "./content";
import { gradeItems, type ItemResult } from "./grading";
import { buildLessonViews, buildTrackViews, suggestNextLesson, type LessonView, type ProgressRow, type TrackView } from "./progress";
import { gradeWorkshop, type WorkshopAnswer, type WorkshopTaskResult } from "./workshop";
import {
  examAreas,
  examQuizKey,
  gradeExam,
  isExamSize,
  isValidSeed,
  parseExamQuizKey,
  selectExamQuestions,
  type ExamAreaResult,
  type ExamGrade,
} from "./exam";
import type { Lesson } from "./schema";

/**
 * Academy persistence. Every query is scoped by the userId the caller authenticated; quiz, exam
 * and workshop answers are graded here against the server-side content (never trusting client
 * grading). XP is awarded only through the idempotent ledger with stable keys:
 *   - lesson quiz pass   → LESSON_COMPLETED   `xp:lesson:<lessonKey>` (once per lesson)
 *   - practice exam pass → PRACTICE_EXAM_PASSED `xp:exam-pass:<YYYY-MM-DD>` (once per local day)
 *   - workshop           → no XP (missions only), to avoid inflating XP with a repeatable simulation.
 *
 * QuizAttempt.quizKey conventions: a lesson quiz uses its content `quiz.key` (e.g. "ohms-law-quiz"),
 * a workshop uses `workshop:<key>` (passed = clean run), an exam uses `exam:<size>:<seed>`.
 */

const DEFAULT_TZ = "America/Los_Angeles";

/** The user's profile timezone (validated), for dates and daily XP keys. */
export async function timezoneOf(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const tz = profile?.timezone || DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

async function progressRows(userId: string, keys?: string[]): Promise<ProgressRow[]> {
  return prisma.lessonProgress.findMany({
    where: { userId, ...(keys ? { lessonKey: { in: keys } } : {}) },
    select: { lessonKey: true, status: true, bestScore: true, attempts: true, completedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type AcademyOverview = {
  tracks: TrackView[];
  next: LessonView | null;
  stats: {
    electricianXp: number;
    level: number;
    levelProgress: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    lessonsInProgress: number;
    examAttempts: number;
    examsPassed: number;
    bestExamPercent: number | null;
    workshopsCleared: number;
    workshopsTotal: number;
  };
};

export async function getAcademyOverview(userId: string): Promise<AcademyOverview> {
  const [rows, stats, attempts] = await Promise.all([
    progressRows(userId),
    prisma.playerStats.findUnique({ where: { userId }, select: { electricianXp: true } }),
    prisma.quizAttempt.findMany({
      where: { userId, OR: [{ quizKey: { startsWith: "exam:" } }, { quizKey: { startsWith: "workshop:" } }] },
      select: { quizKey: true, score: true, maxScore: true, passed: true },
    }),
  ]);
  const views = buildLessonViews(listLessons(), rows);
  const xp = Math.max(0, stats?.electricianXp ?? 0);
  const lvl = levelFromXp(xp);
  const exams = attempts.filter((a) => a.quizKey.startsWith("exam:"));
  const workshopKeys = new Set(listWorkshops().map((w) => w.key));
  const cleared = new Set(
    attempts.filter((a) => a.quizKey.startsWith("workshop:") && a.passed).map((a) => a.quizKey.slice("workshop:".length)),
  );
  return {
    tracks: buildTrackViews(views),
    next: suggestNextLesson(views),
    stats: {
      electricianXp: xp,
      level: lvl.level,
      levelProgress: lvl.progress,
      xpIntoLevel: xp - lvl.current,
      xpForNextLevel: lvl.next - lvl.current,
      lessonsCompleted: views.filter((v) => v.state === "COMPLETED").length,
      lessonsTotal: views.length,
      lessonsInProgress: views.filter((v) => v.state === "IN_PROGRESS").length,
      examAttempts: exams.length,
      examsPassed: exams.filter((a) => a.passed).length,
      bestExamPercent: exams.length ? Math.max(...exams.map((a) => (a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0))) : null,
      workshopsCleared: [...cleared].filter((k) => workshopKeys.has(k)).length,
      workshopsTotal: workshopKeys.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export type LessonPageData = {
  lesson: Lesson;
  view: LessonView;
  trackLessons: { key: string; title: string; state: LessonView["state"] }[];
};

export async function getLessonPageData(userId: string, key: string): Promise<LessonPageData | null> {
  const lesson = getLesson(key);
  if (!lesson) return null;
  const summaries = listLessons();
  const rows = await progressRows(userId);
  const views = buildLessonViews(summaries, rows);
  const view = views.find((v) => v.key === key);
  if (!view) return null;
  return {
    lesson,
    view,
    trackLessons: views.filter((v) => v.track === lesson.track).map((v) => ({ key: v.key, title: v.title, state: v.state })),
  };
}

/**
 * Opening an unlocked lesson marks it IN_PROGRESS (idempotent; never downgrades COMPLETED).
 * Returns the resulting status.
 */
export async function markLessonOpened(userId: string, lessonKey: string, now = new Date()): Promise<"IN_PROGRESS" | "COMPLETED" | null> {
  const lesson = getLesson(lessonKey);
  if (!lesson) return null;
  const row = await prisma.lessonProgress.upsert({
    where: { userId_lessonKey: { userId, lessonKey } },
    create: { userId, lessonKey, status: "IN_PROGRESS", startedAt: now },
    update: {},
    select: { status: true },
  });
  if (row.status === "NOT_STARTED") {
    await prisma.lessonProgress.updateMany({
      where: { userId, lessonKey, status: "NOT_STARTED" },
      data: { status: "IN_PROGRESS", startedAt: now },
    });
    return "IN_PROGRESS";
  }
  return row.status;
}

export type LessonQuizOutcome = {
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passingScore: number;
  /** XP actually credited by this attempt (0 on retakes and failures). */
  xpAwarded: number;
  /** True when this attempt completed the lesson for the first time. */
  completedNow: boolean;
  lessonCompleted: boolean;
  bestScore: number;
  attempts: number;
  results: ItemResult[];
  achievements: string[];
};

export type ServiceFailure = { ok: false; reason: "not_found" | "locked" | "unavailable" | "invalid" | "stale"; message: string };

export async function submitLessonQuiz(
  userId: string,
  lessonKey: string,
  answers: Record<string, string>,
  now = new Date(),
): Promise<{ ok: true; data: LessonQuizOutcome } | ServiceFailure> {
  const lesson = getLesson(lessonKey);
  if (!lesson) return { ok: false, reason: "not_found", message: "That lesson does not exist." };

  const rows = await progressRows(userId, [lessonKey, ...lesson.prerequisites]);
  const allSummaries = listLessons();
  const view = buildLessonViews([toLessonSummary(lesson)], rows)[0]!;
  if (view.state === "LOCKED") {
    const titles = new Map(allSummaries.map((l) => [l.key, l.title]));
    const missing = view.missing.map((m) => titles.get(m.key) ?? m.key).join(", ");
    return { ok: false, reason: "locked", message: `Complete ${missing} first to unlock this quiz.` };
  }

  const grade = gradeItems(lesson.quiz.questions, answers, lesson.quiz.passingScore);
  const tz = await timezoneOf(userId);
  const activityDate = todayInTz(tz, now);

  const data = await prisma.$transaction(async (tx) => {
    const attempt = await tx.quizAttempt.create({
      data: {
        userId,
        quizKey: lesson.quiz.key,
        score: grade.score,
        maxScore: grade.maxScore,
        passed: grade.passed,
        answers: grade.results.map((r) => ({ id: r.id, answered: r.answered, correct: r.correct, given: r.given })),
        createdAt: now,
      },
      select: { id: true },
    });

    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonKey: { userId, lessonKey } },
      select: { status: true, bestScore: true, startedAt: true },
    });
    const wasCompleted = existing?.status === "COMPLETED";
    const completedNow = grade.passed && !wasCompleted;
    const bestScore = Math.max(existing?.bestScore ?? 0, grade.percent);
    const progress = await tx.lessonProgress.upsert({
      where: { userId_lessonKey: { userId, lessonKey } },
      create: {
        userId,
        lessonKey,
        status: grade.passed ? "COMPLETED" : "IN_PROGRESS",
        bestScore,
        attempts: 1,
        startedAt: now,
        completedAt: grade.passed ? now : null,
      },
      update: {
        status: wasCompleted || grade.passed ? "COMPLETED" : "IN_PROGRESS",
        bestScore,
        attempts: { increment: 1 },
        ...(existing?.startedAt ? {} : { startedAt: now }),
        ...(completedNow ? { completedAt: now } : {}),
      },
      select: { status: true, bestScore: true, attempts: true },
    });

    let xpAwarded = 0;
    let achievements: string[] = [];
    if (grade.passed) {
      const xp = await awardXp(tx, {
        userId,
        reason: "LESSON_COMPLETED",
        dedupeKey: `xp:lesson:${lessonKey}`,
        sourceType: "Lesson",
        sourceId: lessonKey,
        activityDate,
      });
      xpAwarded = xp.awarded ? xp.amount : 0;
      // The ledger insert is the race-safe "first completion" signal (concurrent passes serialize on it).
      if (xp.awarded) {
        await tx.dailyActivity.upsert({
          where: { userId_date: { userId, date: activityDate } },
          create: { userId, date: activityDate, lessonsCompleted: 1 },
          update: { lessonsCompleted: { increment: 1 } },
        });
        await applyEventToMissions(tx, { userId, type: "LESSON_COMPLETED", occurredAt: now, activityDate, sourceId: lessonKey });
      }
      await applyEventToMissions(tx, { userId, type: "QUIZ_PASSED", occurredAt: now, activityDate, sourceId: lesson.quiz.key });
      achievements = (await evaluateAchievements(tx, userId)).map((a) => a.key);
    }

    return {
      attemptId: attempt.id,
      score: grade.score,
      maxScore: grade.maxScore,
      percent: grade.percent,
      passed: grade.passed,
      passingScore: lesson.quiz.passingScore,
      xpAwarded,
      completedNow,
      lessonCompleted: progress.status === "COMPLETED",
      bestScore: progress.bestScore ?? bestScore,
      attempts: progress.attempts,
      results: grade.results,
      achievements,
    } satisfies LessonQuizOutcome;
  });
  return { ok: true, data };
}

export type QuizHistoryItem = { id: string; score: number; maxScore: number; passed: boolean; createdAt: Date };

export async function listQuizAttempts(userId: string, quizKey: string, take = 5): Promise<QuizHistoryItem[]> {
  return prisma.quizAttempt.findMany({
    where: { userId, quizKey },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, score: true, maxScore: true, passed: true, createdAt: true },
  });
}

// ---------------------------------------------------------------------------
// Workshop
// ---------------------------------------------------------------------------

export const workshopQuizKey = (key: string) => `workshop:${key}`;

export type WorkshopOutcome = {
  attemptId: string;
  score: number;
  maxScore: number;
  allCorrect: boolean;
  cleanRun: boolean;
  results: WorkshopTaskResult[];
  firstClear: boolean;
};

export async function submitWorkshop(
  userId: string,
  key: string,
  answers: Record<string, WorkshopAnswer | undefined>,
  now = new Date(),
): Promise<{ ok: true; data: WorkshopOutcome } | ServiceFailure> {
  const workshop = getWorkshop(key);
  if (!workshop) return { ok: false, reason: "not_found", message: "That workshop exercise does not exist." };
  const grade = gradeWorkshop(workshop, answers);
  const tz = await timezoneOf(userId);
  const activityDate = todayInTz(tz, now);
  const quizKey = workshopQuizKey(key);

  const data = await prisma.$transaction(async (tx) => {
    const previousClear = await tx.quizAttempt.findFirst({ where: { userId, quizKey, passed: true }, select: { id: true } });
    const attempt = await tx.quizAttempt.create({
      data: {
        userId,
        quizKey,
        score: grade.score,
        maxScore: grade.maxScore,
        passed: grade.cleanRun,
        answers: grade.results.map((r) => ({ id: r.id, answered: r.answered, correct: r.correct, measuredFirst: r.measuredFirst, given: r.given })),
        createdAt: now,
      },
      select: { id: true },
    });
    if (grade.cleanRun) {
      // Missions only — the workshop never awards XP (it is a repeatable simulation).
      await applyEventToMissions(tx, { userId, type: "QUIZ_PASSED", occurredAt: now, activityDate, sourceId: quizKey });
      await evaluateAchievements(tx, userId);
    }
    return {
      attemptId: attempt.id,
      score: grade.score,
      maxScore: grade.maxScore,
      allCorrect: grade.allCorrect,
      cleanRun: grade.cleanRun,
      results: grade.results,
      firstClear: grade.cleanRun && !previousClear,
    } satisfies WorkshopOutcome;
  });
  return { ok: true, data };
}

export type WorkshopProgress = Record<string, { attempts: number; bestScore: number; maxScore: number; cleared: boolean; lastAttemptAt: Date }>;

export async function getWorkshopProgress(userId: string): Promise<WorkshopProgress> {
  const rows = await prisma.quizAttempt.findMany({
    where: { userId, quizKey: { startsWith: "workshop:" } },
    orderBy: { createdAt: "asc" },
    select: { quizKey: true, score: true, maxScore: true, passed: true, createdAt: true },
  });
  const out: WorkshopProgress = {};
  for (const r of rows) {
    const key = r.quizKey.slice("workshop:".length);
    const cur = out[key];
    out[key] = {
      attempts: (cur?.attempts ?? 0) + 1,
      bestScore: Math.max(cur?.bestScore ?? 0, r.score),
      maxScore: r.maxScore,
      cleared: Boolean(cur?.cleared) || r.passed,
      lastAttemptAt: r.createdAt,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Practice exam
// ---------------------------------------------------------------------------

export type ExamOutcome = ExamGrade & { attemptId: string; xpAwarded: number; size: number; seed: number };

export async function submitExam(
  userId: string,
  input: { size: number; seed: number; questionIds: string[]; answers: Record<string, string> },
  now = new Date(),
): Promise<{ ok: true; data: ExamOutcome } | ServiceFailure> {
  const bank = getQuestionBank();
  if (!bank || bank.questions.length === 0) return { ok: false, reason: "unavailable", message: "The question bank is not available right now." };
  if (!isExamSize(input.size) || !isValidSeed(input.seed)) return { ok: false, reason: "invalid", message: "That exam link is not valid. Start a new exam." };
  const questions = selectExamQuestions(bank, input.size, input.seed);
  // The client echoes the ids it was shown; a mismatch means the bank changed mid-exam.
  if (questions.map((q) => q.id).join(",") !== input.questionIds.join(",")) {
    return { ok: false, reason: "stale", message: "The question bank was updated while you were taking this exam. Start a new exam." };
  }
  const grade = gradeExam(bank, questions, input.answers);
  const tz = await timezoneOf(userId);
  const activityDate = todayInTz(tz, now);
  const quizKey = examQuizKey(input.size, input.seed);

  const data = await prisma.$transaction(async (tx) => {
    const attempt = await tx.quizAttempt.create({
      data: {
        userId,
        quizKey,
        score: grade.score,
        maxScore: grade.maxScore,
        passed: grade.passed,
        answers: grade.results.map((r) => ({ id: r.id, area: r.area, selected: r.selected, correct: r.correct })),
        createdAt: now,
      },
      select: { id: true },
    });
    let xpAwarded = 0;
    if (grade.passed) {
      const xp = await awardXp(tx, {
        userId,
        reason: "PRACTICE_EXAM_PASSED",
        dedupeKey: `xp:exam-pass:${dateKey(activityDate)}`,
        sourceType: "PracticeExam",
        sourceId: attempt.id,
        activityDate,
      });
      xpAwarded = xp.awarded ? xp.amount : 0;
      await applyEventToMissions(tx, { userId, type: "QUIZ_PASSED", occurredAt: now, activityDate, sourceId: quizKey });
      await evaluateAchievements(tx, userId);
    }
    return { ...grade, attemptId: attempt.id, xpAwarded, size: input.size, seed: input.seed } satisfies ExamOutcome;
  });
  return { ok: true, data };
}

export type ExamHistoryItem = {
  id: string;
  size: number;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  createdAt: Date;
};

export async function listExamAttempts(userId: string, take = 10): Promise<ExamHistoryItem[]> {
  const rows = await prisma.quizAttempt.findMany({
    where: { userId, quizKey: { startsWith: "exam:" } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, quizKey: true, score: true, maxScore: true, passed: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    size: parseExamQuizKey(r.quizKey)?.size ?? r.maxScore,
    score: r.score,
    maxScore: r.maxScore,
    percent: r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0,
    passed: r.passed,
    createdAt: r.createdAt,
  }));
}

export type ExamReview = {
  id: string;
  size: number;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  createdAt: Date;
  byArea: ExamAreaResult[];
  items: {
    id: string;
    area: string;
    areaLabel: string;
    selected: number | null;
    correct: boolean;
    /** Null when the question has since been removed from the bank. */
    question: { prompt: string; choices: string[]; correctIndex: number; explanation: string; necReference: string | null } | null;
  }[];
};

type StoredExamAnswer = { id: string; area?: string; selected?: number | null; correct?: boolean };

function isStoredExamAnswer(v: unknown): v is StoredExamAnswer {
  return typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string";
}

/** A past attempt, as graded at the time (`correct` flags are the stored ones). */
export async function getExamReview(userId: string, attemptId: string): Promise<ExamReview | null> {
  const row = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId, quizKey: { startsWith: "exam:" } },
    select: { id: true, quizKey: true, score: true, maxScore: true, passed: true, createdAt: true, answers: true },
  });
  if (!row) return null;
  const bank = getQuestionBank();
  const byId = new Map((bank?.questions ?? []).map((q) => [q.id, q]));
  const labels = new Map((bank ? examAreas(bank) : []).map((a) => [a.key, a.label]));
  const stored = Array.isArray(row.answers) ? row.answers.filter(isStoredExamAnswer) : [];
  const items = stored.map((a) => {
    const q = byId.get(a.id);
    const area = a.area ?? q?.area ?? "unknown";
    return {
      id: a.id,
      area,
      areaLabel: labels.get(area) ?? area.replace(/_/g, " "),
      selected: typeof a.selected === "number" ? a.selected : null,
      correct: Boolean(a.correct),
      question: q ? { prompt: q.prompt, choices: q.choices, correctIndex: q.correctIndex, explanation: q.explanation, necReference: q.necReference } : null,
    };
  });
  const areaOrder = [...labels.keys()];
  const areaKeys = [...new Set(items.map((i) => i.area))].sort((a, b) => {
    const ia = areaOrder.indexOf(a);
    const ib = areaOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  const byArea = areaKeys.map((key) => {
    const inArea = items.filter((i) => i.area === key);
    const correct = inArea.filter((i) => i.correct).length;
    return { key, label: inArea[0]!.areaLabel, correct, total: inArea.length, percent: Math.round((correct / inArea.length) * 100) };
  });
  return {
    id: row.id,
    size: parseExamQuizKey(row.quizKey)?.size ?? row.maxScore,
    score: row.score,
    maxScore: row.maxScore,
    percent: row.maxScore ? Math.round((row.score / row.maxScore) * 100) : 0,
    passed: row.passed,
    createdAt: row.createdAt,
    byArea,
    items,
  };
}
