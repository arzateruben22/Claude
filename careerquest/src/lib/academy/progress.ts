import { TRACK_KEYS, type TrackKey } from "./constants";
import { TRACK_META } from "./tracks";

/**
 * Pure derivation of what the learner sees: each lesson's state (locked until its prerequisites are
 * completed), per-track progress and the suggested next lesson.
 */

export type LessonSummary = {
  key: string;
  track: TrackKey;
  order: number;
  title: string;
  summary: string;
  estimatedMinutes: number;
  /** Prerequisite keys that exist in the content set. */
  prerequisites: string[];
  quizKey: string;
  quizQuestionCount: number;
  passingScore: number;
  practiceCount: number;
  sectionCount: number;
};

export type ProgressRow = {
  lessonKey: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  bestScore: number | null;
  attempts: number;
  completedAt?: Date | null;
};

export type LessonState = "LOCKED" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type LessonView = LessonSummary & {
  state: LessonState;
  bestScore: number | null;
  attempts: number;
  /** Prerequisites not yet completed (with titles), empty unless LOCKED. */
  missing: { key: string; title: string }[];
};

export type TrackView = {
  key: TrackKey;
  label: string;
  description: string;
  lessons: LessonView[];
  completed: number;
  total: number;
};

export function buildLessonViews(lessons: LessonSummary[], progress: ProgressRow[]): LessonView[] {
  const byKey = new Map(progress.map((p) => [p.lessonKey, p]));
  const titles = new Map(lessons.map((l) => [l.key, l.title]));
  return lessons.map((l) => {
    const row = byKey.get(l.key);
    const missing = l.prerequisites
      .filter((k) => byKey.get(k)?.status !== "COMPLETED")
      .map((k) => ({ key: k, title: titles.get(k) ?? k }));
    let state: LessonState;
    // A completed lesson stays completed even if content later adds a prerequisite.
    if (row?.status === "COMPLETED") state = "COMPLETED";
    else if (missing.length) state = "LOCKED";
    else state = row?.status ?? "NOT_STARTED";
    return {
      ...l,
      state,
      bestScore: row?.bestScore ?? null,
      attempts: row?.attempts ?? 0,
      missing: state === "LOCKED" ? missing : [],
    };
  });
}

export function buildTrackViews(views: LessonView[]): TrackView[] {
  return TRACK_KEYS.map((key) => {
    const lessons = views.filter((v) => v.track === key);
    return {
      key,
      label: TRACK_META[key].label,
      description: TRACK_META[key].description,
      lessons,
      completed: lessons.filter((l) => l.state === "COMPLETED").length,
      total: lessons.length,
    };
  });
}

/** Continue an in-progress lesson first, otherwise the first available lesson in track order. */
export function suggestNextLesson(views: LessonView[]): LessonView | null {
  return views.find((v) => v.state === "IN_PROGRESS") ?? views.find((v) => v.state === "NOT_STARTED") ?? null;
}

export const LESSON_STATE_LABELS: Record<LessonState, string> = {
  LOCKED: "Locked",
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};
