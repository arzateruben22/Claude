import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLesson, listLessons } from "@/lib/academy/content";
import { buildLessonViews, buildTrackViews } from "@/lib/academy/progress";
import { toPublicQuiz } from "@/lib/academy/quiz";
import type { LessonQuizOutcome } from "@/lib/academy/service";
import { LessonSections } from "@/components/academy/lesson-sections";
import { PracticePanel } from "@/components/academy/practice-panel";
import { QuizForm, QuizResults } from "@/components/academy/quiz-form";
import { ExampleStepper } from "@/components/academy/example-stepper";
import { LessonCard, TrackSection, AcademyStats } from "@/components/academy/overview";
import { LockedLessonPanel } from "@/components/academy/lesson-parts";

const render = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

describe("lesson components render", () => {
  it("renders every section type of every lesson without scripts or handlers", () => {
    for (const summary of listLessons()) {
      const lesson = getLesson(summary.key)!;
      const html = render(createElement(LessonSections, { lessonKey: lesson.key, sections: lesson.sections }));
      expect(html.length).toBeGreaterThan(500);
      expect(html).not.toMatch(/<script|\son[a-z]+=|javascript:/i);
    }
  });

  it("renders formula cards, sanitized themed diagrams, tables and toned callouts", () => {
    const lesson = getLesson("ohms-law")!;
    const html = render(createElement(LessonSections, { lessonKey: lesson.key, sections: lesson.sections }));
    expect(html).toContain("V = I × R");
    expect(html).toContain(`role="img" aria-label="The Ohm's law triangle"`);
    expect(html).toContain("fill:var(--accent)");
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain('data-tone="simulation"');
    expect(html).toContain("Worked example");
    expect(html).toContain("Show the first step");
  });

  it("worked example starts hidden and shows the step count", () => {
    const html = render(createElement(ExampleStepper, { id: "x", problem: "What is **2 + 2**?", steps: ["Add", "Check"], answer: "4" }));
    expect(html).toContain("<strong");
    expect(html).toContain("0 / 2 steps");
    expect(html).not.toContain("Answer: ");
  });

  it("practice panel renders numeric and multiple-choice items with labels", () => {
    const lesson = getLesson("ohms-law")!;
    const html = render(createElement(PracticePanel, { lessonKey: lesson.key, items: lesson.practice }));
    expect(html).toContain("Practice problems");
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('type="radio"');
    expect(html).toMatch(/<label[^>]*class="sr-only"[^>]*>Your answer in A<\/label>/);
    expect(html).toContain("Check answer");
  });

  it("quiz form renders prompts without leaking the answer key", () => {
    const lesson = getLesson("ohms-law")!;
    const quiz = toPublicQuiz(lesson.quiz);
    const serialized = JSON.stringify(quiz);
    expect(serialized).not.toMatch(/correctIndex|"answer"|explanation|tolerance/);
    const html = render(createElement(QuizForm, { lessonKey: lesson.key, lessonTitle: lesson.title, quiz }));
    expect(html).toContain('name="lessonKey"');
    expect(html).toContain(`name="answer.${lesson.quiz.questions[0]!.id}"`);
    expect(html).toContain("Submit answers");
    expect(html).toContain(`0 of ${lesson.quiz.questions.length} answered`);
    for (const q of lesson.quiz.questions) if (q.explanation) expect(html).not.toContain(q.explanation.slice(0, 40));
  });

  it("quiz results show per-question explanations, XP and completion", () => {
    const lesson = getLesson("ohms-law")!;
    const quiz = toPublicQuiz(lesson.quiz);
    const outcome: LessonQuizOutcome = {
      attemptId: "a1",
      score: 8,
      maxScore: 9,
      percent: 89,
      passed: true,
      passingScore: 80,
      xpAwarded: 20,
      completedNow: true,
      lessonCompleted: true,
      bestScore: 89,
      attempts: 2,
      achievements: [],
      results: lesson.quiz.questions.map((q, i) => ({
        id: q.id,
        correct: i > 0,
        answered: true,
        given: "x",
        expected: "7.5 A",
        explanation: `Explanation ${i}`,
      })),
    };
    const html = render(createElement(QuizResults, { outcome, quiz, lessonKey: lesson.key, lessonTitle: lesson.title }));
    expect(html).toContain("Passed");
    expect(html).toContain("+20 Electrician XP");
    expect(html).toContain("is now completed");
    expect(html).toContain("Explanation 0");
    expect(html).toContain("Correct answer");
    expect(html).toContain('href="/academy/lessons/ohms-law"');
  });

  it("overview cards show state, lock reasons and progress", () => {
    const views = buildLessonViews(listLessons(), [{ lessonKey: "electrical-basics", status: "COMPLETED", bestScore: 90, attempts: 1 }]);
    const ohm = views.find((v) => v.key === "ohms-law")!;
    expect(ohm.state).toBe("NOT_STARTED");
    const series = views.find((v) => v.key === "series-circuits")!;
    expect(series.state).toBe("LOCKED");
    const card = render(createElement(LessonCard, { lesson: series }));
    expect(card).toContain("Locked");
    expect(card).toContain("Complete Ohm&#x27;s Law first");
    const track = render(createElement(TrackSection, { track: buildTrackViews(views)[0]! }));
    expect(track).toContain("1 of");
    expect(track).toContain('href="/academy/lessons/electrical-basics"');
    const stats = render(
      createElement(AcademyStats, {
        stats: {
          electricianXp: 20,
          level: 1,
          levelProgress: 0.13,
          xpIntoLevel: 20,
          xpForNextLevel: 150,
          lessonsCompleted: 1,
          lessonsTotal: views.length,
          lessonsInProgress: 0,
          examAttempts: 0,
          examsPassed: 0,
          bestExamPercent: null,
          workshopsCleared: 0,
          workshopsTotal: 9,
        },
      }),
    );
    expect(stats).toContain("Lv 1");
    expect(stats).toContain("No practice exam taken yet");
    const locked = render(createElement(LockedLessonPanel, { lessonKey: "series-circuits", missing: series.missing }));
    expect(locked).toContain('href="/academy/lessons/ohms-law"');
    expect(locked).toContain("?preview=1");
  });
});
