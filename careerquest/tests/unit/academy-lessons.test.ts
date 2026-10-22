import { describe, expect, it } from "vitest";
import { buildLessonViews, buildTrackViews, suggestNextLesson, type LessonSummary, type ProgressRow } from "@/lib/academy/progress";
import { TRACK_KEYS } from "@/lib/academy/schema";

const lesson = (key: string, prerequisites: string[] = [], track: LessonSummary["track"] = "FUNDAMENTALS", order = 1): LessonSummary => ({
  key,
  track,
  order,
  title: key.toUpperCase(),
  summary: "",
  estimatedMinutes: 10,
  prerequisites,
  quizKey: `${key}-quiz`,
  quizQuestionCount: 5,
  passingScore: 80,
  practiceCount: 3,
  sectionCount: 4,
});

const row = (lessonKey: string, status: ProgressRow["status"], bestScore: number | null = null): ProgressRow => ({ lessonKey, status, bestScore, attempts: bestScore === null ? 0 : 1 });

describe("lesson states", () => {
  const lessons = [lesson("a"), lesson("b", ["a"], "FUNDAMENTALS", 2), lesson("c", ["a", "b"], "SAFETY", 1), lesson("d", [], "CODE", 1)];

  it("locks lessons until every prerequisite is completed and names what is missing", () => {
    const views = buildLessonViews(lessons, []);
    const by = Object.fromEntries(views.map((v) => [v.key, v]));
    expect(by.a!.state).toBe("NOT_STARTED");
    expect(by.b!.state).toBe("LOCKED");
    expect(by.b!.missing).toEqual([{ key: "a", title: "A" }]);
    expect(by.c!.missing.map((m) => m.key)).toEqual(["a", "b"]);
    expect(by.d!.state).toBe("NOT_STARTED");
  });

  it("unlocks after completion and reflects in-progress rows and best scores", () => {
    const views = buildLessonViews(lessons, [row("a", "COMPLETED", 90), row("b", "IN_PROGRESS", 60)]);
    const by = Object.fromEntries(views.map((v) => [v.key, v]));
    expect(by.a!.state).toBe("COMPLETED");
    expect(by.a!.bestScore).toBe(90);
    expect(by.b!.state).toBe("IN_PROGRESS");
    expect(by.c!.state).toBe("LOCKED");
    expect(by.c!.missing).toEqual([{ key: "b", title: "B" }]);
  });

  it("an IN_PROGRESS lesson whose prerequisite is incomplete shows as locked; a completed one stays completed", () => {
    const views = buildLessonViews(lessons, [row("b", "IN_PROGRESS"), row("c", "COMPLETED", 100)]);
    const by = Object.fromEntries(views.map((v) => [v.key, v]));
    expect(by.b!.state).toBe("LOCKED");
    expect(by.c!.state).toBe("COMPLETED");
    expect(by.c!.missing).toEqual([]);
  });

  it("builds every track with completion counts and suggests the next lesson", () => {
    const views = buildLessonViews(lessons, [row("a", "COMPLETED", 100)]);
    const tracks = buildTrackViews(views);
    expect(tracks.map((t) => t.key)).toEqual([...TRACK_KEYS]);
    const fundamentals = tracks.find((t) => t.key === "FUNDAMENTALS")!;
    expect([fundamentals.completed, fundamentals.total]).toEqual([1, 2]);
    expect(tracks.find((t) => t.key === "EXAM_PREP")!.total).toBe(0);
    expect(suggestNextLesson(views)?.key).toBe("b");
    const inProgress = buildLessonViews(lessons, [row("a", "COMPLETED"), row("d", "IN_PROGRESS")]);
    expect(suggestNextLesson(inProgress)?.key).toBe("d");
    const allDone = buildLessonViews([lesson("a")], [row("a", "COMPLETED")]);
    expect(suggestNextLesson(allDone)).toBeNull();
  });
});
