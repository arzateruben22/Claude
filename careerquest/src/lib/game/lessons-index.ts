import "server-only";
import { listLessons } from "@/lib/academy/content";

export type LessonMeta = { key: string; track: string; title: string; order: number };

export const FUNDAMENTALS_TRACK = "FUNDAMENTALS";

/**
 * Lesson metadata for missions, achievements and player stats. It comes from the Academy's own
 * validated content loader (`@/lib/academy/content`), so the game and the Academy always agree on
 * which lessons exist and are valid; invalid files are skipped there, never counted here.
 */
export function lessonIndex(): LessonMeta[] {
  return listLessons()
    .map((l) => ({ key: l.key, track: l.track, title: l.title, order: l.order }))
    .sort((a, b) => (a.track === b.track ? a.order - b.order : a.track.localeCompare(b.track)));
}

export function allLessonKeys(): string[] {
  return lessonIndex().map((l) => l.key);
}

export function fundamentalsLessonKeys(): string[] {
  return lessonIndex()
    .filter((l) => l.track === FUNDAMENTALS_TRACK)
    .map((l) => l.key);
}
