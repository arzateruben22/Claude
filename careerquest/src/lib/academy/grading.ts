import type { LessonItem, ToleranceType } from "./schema";

/**
 * Pure grading helpers shared by the server (quiz, exam and workshop grading) and the client
 * (instant practice feedback). Nothing here touches answer keys that the caller did not pass in.
 */

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const THOUSANDS_RE = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;

/**
 * Parse a student's numeric answer. Accepts "1,200", "1200.5", ".5", "-3", "1.5e3", a Unicode
 * minus sign and an optional trailing unit that matches the expected one ("7.5 A", "2.96%").
 * Returns null for anything that is not a single finite number.
 */
export function parseNumericInput(raw: unknown, unit?: string): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/−/g, "-");
  if (!s || s.length > 64) return null;
  if (unit) {
    const u = unit.trim();
    if (u && s.toLowerCase().endsWith(u.toLowerCase())) s = s.slice(0, -u.length).trim();
  }
  s = s.replace(/\s+/g, "");
  if (THOUSANDS_RE.test(s)) s = s.replace(/,/g, "");
  if (!NUMBER_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * True when `value` is within tolerance of `expected`. Absolute tolerance is in the answer's unit;
 * relative tolerance is a fraction of the expected value (0.02 = ±2 %). A relative tolerance
 * against an expected value of 0 falls back to an absolute check. A tiny epsilon absorbs
 * floating-point noise so a tolerance of 0 still accepts the exact answer.
 */
export function withinTolerance(value: number, expected: number, tolerance: number, type: ToleranceType = "absolute"): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(expected)) return false;
  const tol = Math.max(0, tolerance);
  const allowed = type === "relative" && expected !== 0 ? tol * Math.abs(expected) : tol;
  const epsilon = 1e-9 * Math.max(1, Math.abs(expected));
  return Math.abs(value - expected) <= allowed + epsilon;
}

/** Round for display without trailing zeros: 1.915 → "1.915", 60 → "60", 0.0931 → "0.0931". */
export function formatAnswerNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : n < 0 ? "−∞" : "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 4 : 6;
  const fixed = Number(n.toFixed(digits));
  return fixed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function withUnit(value: string, unit?: string | null): string {
  if (!unit) return value;
  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

export type ItemResult = {
  id: string;
  correct: boolean;
  answered: boolean;
  /** What the student entered, normalized for display. */
  given: string | null;
  /** The correct answer, formatted for display (revealed only after grading). */
  expected: string;
  explanation: string;
};

/**
 * Grade one item. `raw` is the form value: the typed number for numeric items, the choice index
 * (as a string or number) for multiple choice.
 */
export function gradeItem(item: LessonItem, raw: unknown): ItemResult {
  if (item.type === "numeric") {
    const value = parseNumericInput(raw, item.unit);
    const answered = value !== null;
    const correct = answered && withinTolerance(value, item.answer, item.tolerance, item.toleranceType ?? "absolute");
    return {
      id: item.id,
      correct,
      answered,
      given: answered ? withUnit(formatAnswerNumber(value), item.unit) : null,
      expected: withUnit(formatAnswerNumber(item.answer), item.unit),
      explanation: item.explanation,
    };
  }
  const index = parseChoiceIndex(raw, item.choices.length);
  const answered = index !== null;
  return {
    id: item.id,
    correct: answered && index === item.correctIndex,
    answered,
    given: answered ? item.choices[index]! : null,
    expected: item.choices[item.correctIndex] ?? "",
    explanation: item.explanation,
  };
}

export function parseChoiceIndex(raw: unknown, choiceCount: number): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,2}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  return Number.isInteger(n) && n >= 0 && n < choiceCount ? n : null;
}

export type QuizGrade = {
  score: number;
  maxScore: number;
  /** Rounded percentage for display. */
  percent: number;
  passed: boolean;
  results: ItemResult[];
};

/** Pass when score/max ≥ passingScore % (exact ratio, so 79.5 % never rounds up to a pass at 80). */
export function isPassing(score: number, maxScore: number, passingPercent: number): boolean {
  return maxScore > 0 && score * 100 >= passingPercent * maxScore;
}

export function percentOf(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

export function gradeItems(items: LessonItem[], answers: Record<string, unknown>, passingPercent: number): QuizGrade {
  const results = items.map((item) => gradeItem(item, answers[item.id]));
  const score = results.filter((r) => r.correct).length;
  const maxScore = items.length;
  return { score, maxScore, percent: percentOf(score, maxScore), passed: isPassing(score, maxScore, passingPercent), results };
}
