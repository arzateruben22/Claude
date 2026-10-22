import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  bankQuestionSchema,
  describeIssues,
  lessonSchema,
  questionBankShellSchema,
  workshopSchema,
  TRACK_KEYS,
  type BankQuestion,
  type Lesson,
  type QuestionBank,
  type Workshop,
} from "./schema";
import { quantityValue, solveCircuit } from "./solver";
import { trackIndex, TRACK_META } from "./tracks";
import type { LessonSummary } from "./progress";

/**
 * Academy content loader. Reads `data/academy/lessons/*.json`, `workshop/*.json` and
 * `exam/question_bank.json`, validates each file with the zod schemas and caches the result for the
 * life of the process. Outside production the cache is keyed on file names + mtimes, so edits by
 * the content team show up on the next request without a restart. Invalid files are skipped and
 * logged, never fatal. Answer keys stay on the server: pages pass clients projections built with
 * `toPublic*` helpers.
 */

export type ContentIssue = { file: string; message: string };

export type WorkshopSummary = {
  key: string;
  title: string;
  description: string;
  difficulty: number;
  estimatedMinutes: number;
  taskCount: number;
  hasFault: boolean;
  relatedLessons: string[];
};

export type AcademyContent = {
  lessons: Lesson[];
  lessonsByKey: Map<string, Lesson>;
  workshops: Workshop[];
  workshopsByKey: Map<string, Workshop>;
  bank: QuestionBank | null;
  issues: ContentIssue[];
};

export type Track = { key: (typeof TRACK_KEYS)[number]; label: string; description: string; lessons: LessonSummary[] };

type Logger = (message: string) => void;

const defaultLogger: Logger = (message) => console.warn(`[academy-content] ${message}`);

function listJson(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

function readJson(file: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Load and validate every content file under `root` (no caching; see `getContent`). */
export function loadAcademyContent(root: string, log: Logger = defaultLogger): AcademyContent {
  const issues: ContentIssue[] = [];
  const issue = (file: string, message: string) => {
    issues.push({ file, message });
    log(`${file}: ${message}`);
  };

  // Lessons
  const lessonsByKey = new Map<string, Lesson>();
  const lessonDir = path.join(root, "lessons");
  for (const name of listJson(lessonDir)) {
    const rel = `lessons/${name}`;
    const raw = readJson(path.join(lessonDir, name));
    if (!raw.ok) {
      issue(rel, `invalid JSON (${raw.message}); skipped`);
      continue;
    }
    const parsed = lessonSchema.safeParse(raw.value);
    if (!parsed.success) {
      issue(rel, `does not match the lesson format (${describeIssues(parsed.error)}); skipped`);
      continue;
    }
    if (lessonsByKey.has(parsed.data.key)) {
      issue(rel, `duplicate lesson key "${parsed.data.key}"; skipped`);
      continue;
    }
    lessonsByKey.set(parsed.data.key, parsed.data);
  }
  // Drop prerequisites that point at lessons that do not exist (they could never be completed).
  for (const lesson of lessonsByKey.values()) {
    const unknown = lesson.prerequisites.filter((k) => !lessonsByKey.has(k));
    if (unknown.length) {
      issue(`lessons/${lesson.key}`, `unknown prerequisite(s) ${unknown.join(", ")} ignored`);
      lesson.prerequisites = lesson.prerequisites.filter((k) => lessonsByKey.has(k));
    }
  }
  const lessons = [...lessonsByKey.values()].sort(
    (a, b) => trackIndex(a.track) - trackIndex(b.track) || a.order - b.order || a.title.localeCompare(b.title),
  );

  // Workshops
  const workshopsByKey = new Map<string, Workshop>();
  const workshopDir = path.join(root, "workshop");
  for (const name of listJson(workshopDir)) {
    const rel = `workshop/${name}`;
    const raw = readJson(path.join(workshopDir, name));
    if (!raw.ok) {
      issue(rel, `invalid JSON (${raw.message}); skipped`);
      continue;
    }
    const parsed = workshopSchema.safeParse(raw.value);
    if (!parsed.success) {
      issue(rel, `does not match the workshop format (${describeIssues(parsed.error)}); skipped`);
      continue;
    }
    const solution = solveCircuit(parsed.data.circuit);
    const unsolvable = parsed.data.tasks.filter((t) => t.type === "numeric" && !Number.isFinite(quantityValue(solution, t.quantity) ?? NaN));
    if (unsolvable.length) {
      issue(rel, `task(s) ${unsolvable.map((t) => t.id).join(", ")} have no finite answer; skipped`);
      continue;
    }
    if (workshopsByKey.has(parsed.data.key)) {
      issue(rel, `duplicate workshop key "${parsed.data.key}"; skipped`);
      continue;
    }
    workshopsByKey.set(parsed.data.key, parsed.data);
  }
  const workshops = [...workshopsByKey.values()].sort((a, b) => a.difficulty - b.difficulty || a.title.localeCompare(b.title));

  // Question bank: validate the wrapper, then each question (one bad question does not sink the bank).
  let bank: QuestionBank | null = null;
  const bankFile = path.join(root, "exam", "question_bank.json");
  if (fs.existsSync(bankFile)) {
    const raw = readJson(bankFile);
    const shell = raw.ok ? questionBankShellSchema.safeParse(raw.value) : null;
    if (!raw.ok) issue("exam/question_bank.json", `invalid JSON (${raw.message}); skipped`);
    else if (!shell?.success) issue("exam/question_bank.json", `does not match the bank format (${shell ? describeIssues(shell.error) : ""}); skipped`);
    else {
      const questions: BankQuestion[] = [];
      const ids = new Set<string>();
      shell.data.questions.forEach((q, i) => {
        const parsed = bankQuestionSchema.safeParse(q);
        if (!parsed.success) {
          issue("exam/question_bank.json", `question #${i + 1} skipped (${describeIssues(parsed.error, 2)})`);
          return;
        }
        if (ids.has(parsed.data.id)) {
          issue("exam/question_bank.json", `duplicate question id ${parsed.data.id} skipped`);
          return;
        }
        ids.add(parsed.data.id);
        questions.push(parsed.data);
      });
      bank = { disclaimer: shell.data.disclaimer, areas: shell.data.areas, questions };
    }
  }

  return { lessons, lessonsByKey, workshops, workshopsByKey, bank, issues };
}

// ---------------------------------------------------------------------------
// Process cache
// ---------------------------------------------------------------------------

let cache: { root: string; signature: string; content: AcademyContent } | null = null;

export function academyContentRoot(): string {
  return process.env.ACADEMY_CONTENT_DIR || path.join(process.cwd(), "data", "academy");
}

/** Cheap fingerprint of the content files (names, sizes, mtimes). */
function signatureOf(root: string): string {
  const parts: string[] = [];
  for (const sub of ["lessons", "workshop"]) {
    const dir = path.join(root, sub);
    for (const name of listJson(dir)) {
      try {
        const st = fs.statSync(path.join(dir, name));
        parts.push(`${sub}/${name}:${st.size}:${st.mtimeMs}`);
      } catch {
        parts.push(`${sub}/${name}:missing`);
      }
    }
  }
  try {
    const st = fs.statSync(path.join(root, "exam", "question_bank.json"));
    parts.push(`bank:${st.size}:${st.mtimeMs}`);
  } catch {
    parts.push("bank:missing");
  }
  return parts.join("|");
}

function getContent(): AcademyContent {
  const root = academyContentRoot();
  if (cache && cache.root === root && process.env.NODE_ENV === "production") return cache.content;
  const signature = signatureOf(root);
  if (cache && cache.root === root && cache.signature === signature) return cache.content;
  cache = { root, signature, content: loadAcademyContent(root) };
  return cache.content;
}

/** Drop the process cache (tests, or after a content deploy). */
export function resetAcademyContentCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function toLessonSummary(l: Lesson): LessonSummary {
  return {
    key: l.key,
    track: l.track,
    order: l.order,
    title: l.title,
    summary: l.summary,
    estimatedMinutes: l.estimatedMinutes,
    prerequisites: l.prerequisites,
    quizKey: l.quiz.key,
    quizQuestionCount: l.quiz.questions.length,
    passingScore: l.quiz.passingScore,
    practiceCount: l.practice.length,
    sectionCount: l.sections.length,
  };
}

export function listLessons(): LessonSummary[] {
  return getContent().lessons.map(toLessonSummary);
}

export function getLesson(key: string): Lesson | null {
  return getContent().lessonsByKey.get(key) ?? null;
}

export function getTracks(): Track[] {
  const summaries = listLessons();
  return TRACK_KEYS.map((key) => ({
    key,
    label: TRACK_META[key].label,
    description: TRACK_META[key].description,
    lessons: summaries.filter((l) => l.track === key),
  }));
}

export function toWorkshopSummary(w: Workshop): WorkshopSummary {
  return {
    key: w.key,
    title: w.title,
    description: w.description,
    difficulty: w.difficulty,
    estimatedMinutes: w.estimatedMinutes,
    taskCount: w.tasks.length,
    hasFault: w.circuit.faults.length > 0,
    relatedLessons: w.relatedLessons,
  };
}

export function listWorkshops(): WorkshopSummary[] {
  return getContent().workshops.map(toWorkshopSummary);
}

export function getWorkshop(key: string): Workshop | null {
  return getContent().workshopsByKey.get(key) ?? null;
}

export function getQuestionBank(): QuestionBank | null {
  return getContent().bank;
}

/** Validation problems found in the content files (for the notes page / diagnostics). */
export function getContentIssues(): ContentIssue[] {
  return getContent().issues;
}
