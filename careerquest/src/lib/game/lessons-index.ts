import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type LessonMeta = { key: string; track: string; title: string; order: number };

export const FUNDAMENTALS_TRACK = "FUNDAMENTALS";

let cache: LessonMeta[] | null = null;

function lessonsDir(): string {
  return path.join(process.cwd(), "data", "academy", "lessons");
}

/**
 * Lesson metadata read once from `data/academy/lessons/*.json` and cached for the process.
 * Files that cannot be parsed are skipped; when the directory is missing the index is empty
 * (and not cached, so a later deploy with content is picked up).
 */
export function lessonIndex(): LessonMeta[] {
  if (cache) return cache;
  let files: string[];
  try {
    files = readdirSync(lessonsDir()).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: LessonMeta[] = [];
  for (const file of files.sort()) {
    try {
      const raw = JSON.parse(readFileSync(path.join(lessonsDir(), file), "utf8")) as Record<string, unknown>;
      const key = typeof raw.key === "string" && raw.key ? raw.key : file.replace(/\.json$/, "");
      const track = typeof raw.track === "string" ? raw.track : "OTHER";
      const title = typeof raw.title === "string" ? raw.title : key;
      const order = typeof raw.order === "number" ? raw.order : 0;
      out.push({ key, track, title, order });
    } catch {
      // Malformed lesson file: ignore it rather than breaking mission/achievement evaluation.
    }
  }
  out.sort((a, b) => (a.track === b.track ? a.order - b.order : a.track.localeCompare(b.track)));
  cache = out;
  return out;
}

export function allLessonKeys(): string[] {
  return lessonIndex().map((l) => l.key);
}

export function fundamentalsLessonKeys(): string[] {
  return lessonIndex()
    .filter((l) => l.track === FUNDAMENTALS_TRACK)
    .map((l) => l.key);
}
