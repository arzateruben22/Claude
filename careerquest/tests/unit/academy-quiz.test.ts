import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getLesson } from "@/lib/academy/content";
import { gradeItem, gradeItems, isPassing, parseNumericInput, percentOf, withinTolerance } from "@/lib/academy/grading";
import { collectPrefixed, lessonQuizFormSchema } from "@/lib/academy/form";
import { getAcademyOverview, getLessonPageData, markLessonOpened, submitLessonQuiz } from "@/lib/academy/service";
import type { Lesson, LessonItem } from "@/lib/academy/schema";
import { XP } from "@/lib/game/xp-config";

describe("grading helpers", () => {
  it("parses numeric answers in common formats", () => {
    expect(parseNumericInput("7.5")).toBe(7.5);
    expect(parseNumericInput(" 1,200 ")).toBe(1200);
    expect(parseNumericInput("12,470.5")).toBe(12470.5);
    expect(parseNumericInput(".5")).toBe(0.5);
    expect(parseNumericInput("−3")).toBe(-3);
    expect(parseNumericInput("1.5e3")).toBe(1500);
    expect(parseNumericInput("7.5 A", "A")).toBe(7.5);
    expect(parseNumericInput("2.96%", "%")).toBe(2.96);
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("1,2")).toBeNull();
    expect(parseNumericInput("7.5 V", "A")).toBeNull();
    expect(parseNumericInput("Infinity")).toBeNull();
    expect(parseNumericInput(undefined)).toBeNull();
  });

  it("applies absolute and relative tolerances", () => {
    expect(withinTolerance(7.51, 7.5, 0.02)).toBe(true);
    expect(withinTolerance(7.53, 7.5, 0.02)).toBe(false);
    expect(withinTolerance(0.0612, 0.06, 0.02, "relative")).toBe(true);
    expect(withinTolerance(0.0613, 0.06, 0.02, "relative")).toBe(false);
    // relative against zero falls back to absolute
    expect(withinTolerance(0.0005, 0, 0.001, "relative")).toBe(true);
    // zero tolerance still accepts the exact answer despite float noise
    expect(withinTolerance(0.1 + 0.2, 0.3, 0)).toBe(true);
    expect(withinTolerance(100.0001, 100, 0)).toBe(false);
  });

  it("grades numeric and multiple-choice items and handles blanks", () => {
    const numeric: LessonItem = { id: "n", type: "numeric", prompt: "?", answer: 1.915, unit: "mA", tolerance: 0.02, explanation: "why" };
    const mc: LessonItem = { id: "m", type: "multiple_choice", prompt: "?", choices: ["a", "b", "c"], correctIndex: 1, explanation: "" };
    expect(gradeItem(numeric, "1.92")).toMatchObject({ correct: true, answered: true, given: "1.92 mA", expected: "1.915 mA" });
    expect(gradeItem(numeric, "1915")).toMatchObject({ correct: false, answered: true });
    expect(gradeItem(numeric, "")).toMatchObject({ correct: false, answered: false, given: null });
    expect(gradeItem(mc, "1")).toMatchObject({ correct: true, given: "b", expected: "b" });
    expect(gradeItem(mc, "0")).toMatchObject({ correct: false, given: "a" });
    expect(gradeItem(mc, "7")).toMatchObject({ correct: false, answered: false });
    expect(gradeItem(mc, "1; drop table")).toMatchObject({ answered: false });
  });

  it("passes on the exact ratio, never by rounding up", () => {
    expect(isPassing(8, 10, 80)).toBe(true);
    expect(isPassing(7, 9, 80)).toBe(false); // 77.8 %
    expect(isPassing(159, 200, 80)).toBe(false); // 79.5 % would round to 80
    expect(percentOf(159, 200)).toBe(80);
    expect(isPassing(0, 0, 80)).toBe(false);
    const g = gradeItems([{ id: "m", type: "multiple_choice", prompt: "?", choices: ["a", "b"], correctIndex: 0, explanation: "" }], { m: "0" }, 80);
    expect(g).toMatchObject({ score: 1, maxScore: 1, percent: 100, passed: true });
  });

  it("collects prefixed form fields and rejects junk ids", () => {
    const fd = new FormData();
    fd.set("lessonKey", "ohms-law");
    fd.set("answer.q1", "3");
    fd.set("answer.bad id", "x");
    fd.set("answer.q2", "x".repeat(200));
    fd.set("other", "1");
    const answers = collectPrefixed(fd, "answer.");
    expect(answers).toEqual({ q1: "3" });
    expect(lessonQuizFormSchema.safeParse({ lessonKey: "../etc", answers }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DB-backed: lesson progress, attempts and XP idempotency
// ---------------------------------------------------------------------------

function answersFor(lesson: Lesson, correct: boolean): Record<string, string> {
  return Object.fromEntries(
    lesson.quiz.questions.map((q) => {
      if (q.type === "numeric") {
        const off = Math.max(10, Math.abs(q.answer), q.tolerance * 10 + 1);
        return [q.id, String(correct ? q.answer : q.answer + off)];
      }
      return [q.id, String(correct ? q.correctIndex : (q.correctIndex + 1) % q.choices.length)];
    }),
  );
}

let userId = "";
let otherId = "";
const TZ = "America/Los_Angeles";

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `academy-quiz+${stamp}@careerquest.test`, passwordHash: "x", name: "Academy Quiz", profile: { create: { timezone: TZ } }, stats: { create: {} } },
  });
  userId = user.id;
  const other = await prisma.user.create({ data: { email: `academy-quiz-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" } });
  otherId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("lesson quiz persistence", () => {
  const basicsKey = "electrical-basics";
  const ohmKey = "ohms-law";

  it("refuses a locked lesson's quiz without recording anything", async () => {
    const ohm = getLesson(ohmKey)!;
    expect(ohm.prerequisites).toContain(basicsKey);
    const res = await submitLessonQuiz(userId, ohmKey, answersFor(ohm, true));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe("locked");
    expect(await prisma.quizAttempt.count({ where: { userId } })).toBe(0);
    expect(await prisma.lessonProgress.count({ where: { userId } })).toBe(0);
    expect((await submitLessonQuiz(userId, "no-such-lesson", {})).ok).toBe(false);
  });

  it("opening a lesson marks it IN_PROGRESS once", async () => {
    expect(await markLessonOpened(userId, basicsKey)).toBe("IN_PROGRESS");
    expect(await markLessonOpened(userId, basicsKey)).toBe("IN_PROGRESS");
    const row = await prisma.lessonProgress.findUnique({ where: { userId_lessonKey: { userId, lessonKey: basicsKey } } });
    expect(row?.status).toBe("IN_PROGRESS");
    expect(row?.startedAt).toBeInstanceOf(Date);
    expect(await markLessonOpened(userId, "no-such-lesson")).toBeNull();
  });

  it("a failing attempt is recorded but does not complete the lesson or award XP", async () => {
    const lesson = getLesson(basicsKey)!;
    const res = await submitLessonQuiz(userId, basicsKey, answersFor(lesson, false));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ passed: false, xpAwarded: 0, completedNow: false, lessonCompleted: false, attempts: 1 });
    expect(res.data.results.every((r) => !r.correct)).toBe(true);
    const row = await prisma.lessonProgress.findUnique({ where: { userId_lessonKey: { userId, lessonKey: basicsKey } } });
    expect(row).toMatchObject({ status: "IN_PROGRESS", attempts: 1, bestScore: 0, completedAt: null });
    expect(await prisma.xpLedger.count({ where: { userId, reason: "LESSON_COMPLETED" } })).toBe(0);
    const attempt = await prisma.quizAttempt.findFirst({ where: { userId, quizKey: lesson.quiz.key } });
    expect(attempt).toMatchObject({ passed: false, score: 0, maxScore: lesson.quiz.questions.length });
  });

  it("passing completes the lesson and awards LESSON_COMPLETED XP exactly once across retakes", async () => {
    const lesson = getLesson(basicsKey)!;
    const first = await submitLessonQuiz(userId, basicsKey, answersFor(lesson, true));
    expect(first.ok && first.data).toMatchObject({ passed: true, percent: 100, xpAwarded: XP.LESSON_COMPLETED, completedNow: true, lessonCompleted: true });

    const second = await submitLessonQuiz(userId, basicsKey, answersFor(lesson, true));
    expect(second.ok && second.data).toMatchObject({ passed: true, xpAwarded: 0, completedNow: false, lessonCompleted: true, attempts: 3 });

    const ledger = await prisma.xpLedger.findMany({ where: { userId, reason: "LESSON_COMPLETED" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ dedupeKey: `xp:lesson:${basicsKey}`, amount: XP.LESSON_COMPLETED, track: "ELECTRICIAN", sourceType: "Lesson", sourceId: basicsKey });
    const stats = await prisma.playerStats.findUnique({ where: { userId } });
    expect(stats?.electricianXp).toBe(XP.LESSON_COMPLETED);
    // totalXp may also include mission rewards earned by the same action (game-systems module).
    expect(stats?.totalXp).toBeGreaterThanOrEqual(XP.LESSON_COMPLETED);
    const daily = await prisma.dailyActivity.findMany({ where: { userId } });
    expect(daily.reduce((s, d) => s + d.lessonsCompleted, 0)).toBe(1);

    const row = await prisma.lessonProgress.findUnique({ where: { userId_lessonKey: { userId, lessonKey: basicsKey } } });
    expect(row).toMatchObject({ status: "COMPLETED", attempts: 3, bestScore: 100 });
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("failing after completion keeps the lesson completed and the best score", async () => {
    const lesson = getLesson(basicsKey)!;
    const res = await submitLessonQuiz(userId, basicsKey, answersFor(lesson, false));
    expect(res.ok && res.data).toMatchObject({ passed: false, lessonCompleted: true, bestScore: 100, xpAwarded: 0 });
    expect(await markLessonOpened(userId, basicsKey)).toBe("COMPLETED");
    expect(await prisma.xpLedger.count({ where: { userId, reason: "LESSON_COMPLETED" } })).toBe(1);
  });

  it("completing the prerequisite unlocks the next lesson", async () => {
    const page = await getLessonPageData(userId, ohmKey);
    expect(page?.view.state).toBe("NOT_STARTED");
    const ohm = getLesson(ohmKey)!;
    const res = await submitLessonQuiz(userId, ohmKey, answersFor(ohm, true));
    expect(res.ok && res.data.xpAwarded).toBe(XP.LESSON_COMPLETED);
    const overview = await getAcademyOverview(userId);
    expect(overview.stats.lessonsCompleted).toBe(2);
    expect(overview.stats.electricianXp).toBe(2 * XP.LESSON_COMPLETED);
    expect(overview.tracks.find((t) => t.key === "FUNDAMENTALS")?.completed).toBe(2);
  });

  it("progress is scoped per user", async () => {
    const page = await getLessonPageData(otherId, ohmKey);
    expect(page?.view.state).toBe("LOCKED");
    const overview = await getAcademyOverview(otherId);
    expect(overview.stats.lessonsCompleted).toBe(0);
    expect(overview.stats.electricianXp).toBe(0);
  });
});
