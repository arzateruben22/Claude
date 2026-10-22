import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/db";
import { getQuestionBank } from "@/lib/academy/content";
import {
  allocateByWeight,
  EXAM_SIZES,
  examQuizKey,
  gradeExam,
  mulberry32,
  parseExamQuizKey,
  selectExamQuestions,
  toPublicExamQuestions,
} from "@/lib/academy/exam";
import type { QuestionBank } from "@/lib/academy/schema";
import { examFormSchema } from "@/lib/academy/form";
import { getExamReview, listExamAttempts, submitExam } from "@/lib/academy/service";
import { dateKey, todayInTz } from "@/lib/dates";
import { XP } from "@/lib/game/xp-config";
import { ExamForm } from "@/components/academy/exam/exam-form";
import { ExamResults } from "@/components/academy/exam/exam-results";

const bank = getQuestionBank()!;

describe("exam assembly", () => {
  it("allocates by weight with largest remainders and respects capacity", () => {
    const a = allocateByWeight(
      [
        { key: "a", weight: 0.5, available: 100 },
        { key: "b", weight: 0.3, available: 100 },
        { key: "c", weight: 0.2, available: 100 },
      ],
      25,
    );
    expect(a).toEqual({ a: 13, b: 7, c: 5 });
    const capped = allocateByWeight(
      [
        { key: "a", weight: 0.9, available: 3 },
        { key: "b", weight: 0.1, available: 50 },
      ],
      20,
    );
    expect(capped).toEqual({ a: 3, b: 17 });
    expect(allocateByWeight([{ key: "a", weight: 0, available: 2 }, { key: "b", weight: 0, available: 2 }], 3)).toEqual({ a: 2, b: 1 });
    expect(allocateByWeight([{ key: "a", weight: 1, available: 4 }], 25)).toEqual({ a: 4 });
    expect(allocateByWeight([], 25)).toEqual({});
  });

  it("is deterministic per seed, proportional by area and free of duplicates", () => {
    for (const size of EXAM_SIZES) {
      const a = selectExamQuestions(bank, size, 12345);
      const b = selectExamQuestions(bank, size, 12345);
      const c = selectExamQuestions(bank, size, 54321);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(a.map((q) => q.id)).not.toEqual(c.map((q) => q.id));
      expect(a).toHaveLength(size);
      expect(new Set(a.map((q) => q.id)).size).toBe(size);
      const totalWeight = bank.areas.reduce((s, x) => s + x.weight, 0);
      for (const area of bank.areas) {
        const n = a.filter((q) => q.area === area.key).length;
        expect(Math.abs(n - (size * area.weight) / totalWeight)).toBeLessThan(1.0001);
      }
    }
  });

  it("projects questions without answer keys and grades by area", () => {
    const qs = selectExamQuestions(bank, 25, 777);
    const pub = toPublicExamQuestions(bank, qs);
    expect(JSON.stringify(pub)).not.toMatch(/correctIndex|explanation|necReference/);
    expect(pub[0]!.areaLabel).not.toBe("");
    const allRight = Object.fromEntries(qs.map((q) => [q.id, String(q.correctIndex)]));
    const g = gradeExam(bank, qs, allRight);
    expect(g).toMatchObject({ score: 25, maxScore: 25, percent: 100, passed: true });
    expect(g.byArea.reduce((s, x) => s + x.total, 0)).toBe(25);
    const seventeen = Object.fromEntries(qs.map((q, i) => [q.id, String(i < 17 ? q.correctIndex : (q.correctIndex + 1) % q.choices.length)]));
    expect(gradeExam(bank, qs, seventeen)).toMatchObject({ score: 17, percent: 68, passed: false });
    const eighteen = Object.fromEntries(qs.map((q, i) => [q.id, String(i < 18 ? q.correctIndex : -1)]));
    expect(gradeExam(bank, qs, eighteen)).toMatchObject({ score: 18, percent: 72, passed: true });
  });

  it("round-trips quiz keys and uses a stable PRNG", () => {
    expect(parseExamQuizKey(examQuizKey(50, 99))).toEqual({ size: 50, seed: 99 });
    expect(parseExamQuizKey("exam:25:0")).toBeNull();
    expect(parseExamQuizKey("workshop:x")).toBeNull();
    const r = mulberry32(1);
    expect([r(), r()].every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(42)()).toBe(mulberry32(42)());
  });

  it("validates the exam form", () => {
    const ok = examFormSchema.safeParse({ size: "25", seed: "123", questionIds: "bank-001,bank-002", answers: { "bank-001": "1" } });
    expect(ok.success && ok.data.questionIds).toEqual(["bank-001", "bank-002"]);
    expect(examFormSchema.safeParse({ size: "25", seed: "x", questionIds: "a", answers: {} }).success).toBe(false);
    expect(examFormSchema.safeParse({ size: "25", seed: "1", questionIds: "", answers: {} }).success).toBe(false);
  });
});

describe("exam components render", () => {
  it("renders the exam form without answers, with a timer when timed", () => {
    const qs = selectExamQuestions(bank, 25, 4242);
    const html = renderToStaticMarkup(
      createElement(ExamForm, { size: 25, seed: 4242, timed: true, durationSeconds: 3600, questions: toPublicExamQuestions(bank, qs) }),
    );
    expect(html).toContain('name="seed" value="4242"');
    expect(html).toContain(`value="${qs.map((q) => q.id).join(",")}"`);
    expect(html).toContain('role="timer"');
    expect(html).toContain("1:00:00");
    expect(html).toContain("0 of 25 answered");
    for (const q of qs) if (q.explanation) expect(html).not.toContain(q.explanation.slice(0, 40));
  });

  it("renders results by area with NEC references", () => {
    const qs = selectExamQuestions(bank, 25, 5);
    const g = gradeExam(bank, qs, {});
    const withNec = qs.find((q) => q.necReference);
    const html = renderToStaticMarkup(
      createElement(ExamResults, {
        result: {
          ...g,
          items: g.results.map((r) => ({ ...r, areaLabel: r.area, prompt: r.prompt })),
        },
      }),
    );
    expect(html).toContain("0%");
    expect(html).toContain("Below the practice pass mark");
    expect(html).toContain("Results by area");
    expect(html).toContain("Focus next");
    if (withNec) expect(html).toContain(`NEC ${withNec.necReference}`);
  });
});

// ---------------------------------------------------------------------------
// DB-backed
// ---------------------------------------------------------------------------

let userId = "";
let otherId = "";
const TZ = "America/Los_Angeles";

function answersFor(b: QuestionBank, size: number, seed: number, correctCount: number) {
  const qs = selectExamQuestions(b, size, seed);
  return {
    size,
    seed,
    questionIds: qs.map((q) => q.id),
    answers: Object.fromEntries(qs.map((q, i) => [q.id, String(i < correctCount ? q.correctIndex : (q.correctIndex + 1) % q.choices.length)])),
  };
}

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  userId = (
    await prisma.user.create({
      data: { email: `academy-exam+${stamp}@careerquest.test`, passwordHash: "x", name: "Exam", profile: { create: { timezone: TZ } }, stats: { create: {} } },
    })
  ).id;
  otherId = (await prisma.user.create({ data: { email: `academy-exam-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("practice exam persistence", () => {
  const now = new Date("2026-10-22T18:00:00Z");
  const tomorrow = new Date("2026-10-23T18:00:00Z");

  it("awards PRACTICE_EXAM_PASSED at most once per local day", async () => {
    const first = await submitExam(userId, answersFor(bank, 25, 1001, 25), now);
    expect(first.ok && first.data).toMatchObject({ passed: true, score: 25, xpAwarded: XP.PRACTICE_EXAM_PASSED });
    const second = await submitExam(userId, answersFor(bank, 25, 1002, 20), now);
    expect(second.ok && second.data).toMatchObject({ passed: true, score: 20, percent: 80, xpAwarded: 0 });
    const third = await submitExam(userId, answersFor(bank, 50, 1003, 50), tomorrow);
    expect(third.ok && third.data).toMatchObject({ passed: true, xpAwarded: XP.PRACTICE_EXAM_PASSED });

    const ledger = await prisma.xpLedger.findMany({ where: { userId, reason: "PRACTICE_EXAM_PASSED" }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((l) => l.dedupeKey)).toEqual([
      `xp:exam-pass:${dateKey(todayInTz(TZ, now))}`,
      `xp:exam-pass:${dateKey(todayInTz(TZ, tomorrow))}`,
    ]);
    const stats = await prisma.playerStats.findUnique({ where: { userId } });
    expect(stats?.electricianXp).toBe(2 * XP.PRACTICE_EXAM_PASSED);
  });

  it("a failing exam is recorded without XP and keys encode size and seed", async () => {
    const res = await submitExam(userId, answersFor(bank, 25, 2001, 10), now);
    expect(res.ok && res.data).toMatchObject({ passed: false, score: 10, xpAwarded: 0 });
    const attempt = await prisma.quizAttempt.findFirst({ where: { userId, quizKey: "exam:25:2001" } });
    expect(attempt).toMatchObject({ passed: false, score: 10, maxScore: 25 });
    expect(Array.isArray(attempt?.answers) && (attempt!.answers as unknown[]).length).toBe(25);
  });

  it("rejects stale or tampered selections and invalid sizes without recording", async () => {
    const before = await prisma.quizAttempt.count({ where: { userId } });
    const tampered = answersFor(bank, 25, 3001, 25);
    tampered.questionIds = [...tampered.questionIds].reverse();
    expect(await submitExam(userId, tampered, now)).toMatchObject({ ok: false, reason: "stale" });
    expect(await submitExam(userId, { ...answersFor(bank, 25, 3002, 25), size: 30 }, now)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await submitExam(userId, { ...answersFor(bank, 25, 3003, 25), seed: 0 }, now)).toMatchObject({ ok: false, reason: "invalid" });
    expect(await prisma.quizAttempt.count({ where: { userId } })).toBe(before);
  });

  it("lists and reviews attempts for their owner only", async () => {
    const list = await listExamAttempts(userId, 10);
    expect(list).toHaveLength(4);
    expect(list.map((a) => a.size).sort()).toEqual([25, 25, 25, 50]);
    const failed = list.find((a) => !a.passed)!;
    const review = await getExamReview(userId, failed.id);
    expect(review).toMatchObject({ size: 25, score: 10, passed: false });
    expect(review!.items).toHaveLength(25);
    expect(review!.items.filter((i) => i.correct)).toHaveLength(10);
    expect(review!.items[0]!.question?.prompt).toBeTruthy();
    expect(review!.byArea.reduce((s, a) => s + a.total, 0)).toBe(25);
    expect(await getExamReview(otherId, failed.id)).toBeNull();
    expect(await listExamAttempts(otherId)).toEqual([]);
  });
});
