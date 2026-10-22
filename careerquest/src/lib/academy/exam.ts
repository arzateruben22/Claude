import type { BankArea, BankQuestion, QuestionBank } from "./schema";
import { isPassing, parseChoiceIndex, percentOf } from "./grading";

/**
 * Practice exam assembly and grading. Selection is a pure function of (bank, size, seed): the seed
 * is stored in the attempt's quizKey (`exam:<size>:<seed>`), so the server can re-derive exactly
 * which questions were asked when it grades — the client never supplies the answer key or the set.
 */

export const EXAM_SIZES = [25, 50] as const;
export type ExamSize = (typeof EXAM_SIZES)[number];
export const EXAM_PASS_PERCENT = 70;
/**
 * Optional timer pace for practice: 2.4 minutes per question (100 questions in 4 hours). The
 * official time limit is stated inconsistently by DIR (see the roadmap), so this is a study pace,
 * not a claim about the real exam.
 */
export const EXAM_SECONDS_PER_QUESTION = 144;
export const MAX_SEED = 2_147_483_647;

export function isExamSize(n: number): n is ExamSize {
  return (EXAM_SIZES as readonly number[]).includes(n);
}

export function isValidSeed(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_SEED;
}

export function examQuizKey(size: number, seed: number): string {
  return `exam:${size}:${seed}`;
}

export function parseExamQuizKey(key: string): { size: number; seed: number } | null {
  const m = /^exam:(\d{1,3}):(\d{1,10})$/.exec(key);
  if (!m) return null;
  const size = Number(m[1]);
  const seed = Number(m[2]);
  return isValidSeed(seed) ? { size, seed } : null;
}

/** Deterministic 32-bit PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Split `size` questions across areas in proportion to their weights (largest-remainder method),
 * never asking for more questions than an area has; any shortfall is redistributed to areas with
 * questions left. Areas with zero total weight share equally.
 */
export function allocateByWeight(areas: { key: string; weight: number; available: number }[], size: number): Record<string, number> {
  const usable = areas.filter((a) => a.available > 0);
  const result: Record<string, number> = Object.fromEntries(areas.map((a) => [a.key, 0]));
  const capacity = usable.reduce((s, a) => s + a.available, 0);
  let remaining = Math.min(size, capacity);
  let pool = usable;
  while (remaining > 0 && pool.length) {
    const totalWeight = pool.reduce((s, a) => s + Math.max(0, a.weight), 0);
    const shares = pool.map((a) => ({
      a,
      exact: totalWeight > 0 ? (remaining * Math.max(0, a.weight)) / totalWeight : remaining / pool.length,
    }));
    let given = 0;
    const floors = shares.map((s) => {
      const room = s.a.available - result[s.a.key]!;
      const take = Math.min(room, Math.floor(s.exact));
      given += take;
      return { ...s, take, frac: s.exact - Math.floor(s.exact), room };
    });
    for (const f of floors) result[f.a.key]! += f.take;
    let left = remaining - given;
    // Largest remainders first; ties keep bank order so the result is deterministic.
    const order = floors
      .map((f, i) => ({ ...f, i }))
      .filter((f) => f.room - f.take > 0)
      .sort((x, y) => y.frac - x.frac || y.a.weight - x.a.weight || x.i - y.i);
    for (const f of order) {
      if (left <= 0) break;
      result[f.a.key]! += 1;
      left--;
    }
    remaining = left;
    pool = pool.filter((a) => a.available - result[a.key]! > 0);
    if (given === 0 && order.length === 0) break;
  }
  return result;
}

/** Deterministically pick and order the questions for an exam. */
export function selectExamQuestions(bank: QuestionBank, size: number, seed: number): BankQuestion[] {
  const rand = mulberry32(seed);
  const byArea = new Map<string, BankQuestion[]>();
  for (const q of bank.questions) {
    const list = byArea.get(q.area) ?? [];
    list.push(q);
    byArea.set(q.area, list);
  }
  const areas = examAreas(bank).map((a) => ({ key: a.key, weight: a.weight, available: byArea.get(a.key)?.length ?? 0 }));
  const allocation = allocateByWeight(areas, size);
  const picked: BankQuestion[] = [];
  for (const a of areas) {
    const want = allocation[a.key] ?? 0;
    if (!want) continue;
    picked.push(...shuffle(byArea.get(a.key) ?? [], rand).slice(0, want));
  }
  return shuffle(picked, rand);
}

/** Areas in bank order, including any area used by a question but missing from `areas` (weight 0). */
export function examAreas(bank: QuestionBank): BankArea[] {
  const list = [...bank.areas];
  const known = new Set(list.map((a) => a.key));
  for (const q of bank.questions) {
    if (!known.has(q.area)) {
      known.add(q.area);
      list.push({ key: q.area, label: q.area.replace(/_/g, " "), weight: 0 });
    }
  }
  return list;
}

export type PublicExamQuestion = { id: string; area: string; areaLabel: string; prompt: string; choices: string[] };

export function toPublicExamQuestions(bank: QuestionBank, questions: BankQuestion[]): PublicExamQuestion[] {
  const labels = new Map(examAreas(bank).map((a) => [a.key, a.label]));
  return questions.map((q) => ({ id: q.id, area: q.area, areaLabel: labels.get(q.area) ?? q.area, prompt: q.prompt, choices: q.choices }));
}

export type ExamQuestionResult = {
  id: string;
  area: string;
  prompt: string;
  choices: string[];
  selected: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
  necReference: string | null;
};

export type ExamAreaResult = { key: string; label: string; correct: number; total: number; percent: number };

export type ExamGrade = {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  byArea: ExamAreaResult[];
  results: ExamQuestionResult[];
};

export function gradeExam(bank: QuestionBank, questions: BankQuestion[], answers: Record<string, unknown>): ExamGrade {
  const results: ExamQuestionResult[] = questions.map((q) => {
    const selected = parseChoiceIndex(answers[q.id], q.choices.length);
    return {
      id: q.id,
      area: q.area,
      prompt: q.prompt,
      choices: q.choices,
      selected,
      correctIndex: q.correctIndex,
      correct: selected !== null && selected === q.correctIndex,
      explanation: q.explanation,
      necReference: q.necReference,
    };
  });
  const score = results.filter((r) => r.correct).length;
  const maxScore = results.length;
  const byArea: ExamAreaResult[] = [];
  for (const area of examAreas(bank)) {
    const inArea = results.filter((r) => r.area === area.key);
    if (!inArea.length) continue;
    const correct = inArea.filter((r) => r.correct).length;
    byArea.push({ key: area.key, label: area.label, correct, total: inArea.length, percent: percentOf(correct, inArea.length) });
  }
  return { score, maxScore, percent: percentOf(score, maxScore), passed: isPassing(score, maxScore, EXAM_PASS_PERCENT), byArea, results };
}
