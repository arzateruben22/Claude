import type { Circuit, ToleranceType, Workshop } from "./schema";
import { parseChoiceIndex, withinTolerance } from "./grading";
import { QUANTITY_UNITS, parseQuantity, quantityLabel, quantityValue, solveCircuit, type CircuitSolution } from "./solver";

/**
 * Simulated-bench helpers shared by the bench UI (client) and the server action that records an
 * attempt. Numeric answers are derived from the published circuit, so they are not secret; the
 * fault-finding multiple-choice keys are, and only the server sees them (`toPublicWorkshop`).
 */

export const SIMULATION_NOTICE = "Simulation — not qualifying field experience";

export type PublicWorkshopTask =
  | {
      id: string;
      type: "numeric";
      question: string;
      quantity: string;
      unit: string;
      label: string;
      tolerance: number;
      toleranceType: ToleranceType;
    }
  | { id: string; type: "multiple_choice"; question: string; choices: string[] };

export type PublicWorkshop = {
  key: string;
  title: string;
  description: string;
  difficulty: number;
  estimatedMinutes: number;
  relatedLessons: string[];
  circuit: Circuit;
  tasks: PublicWorkshopTask[];
  hints: string[];
  learningGoals: string[];
  disclaimer: string;
};

export function toPublicWorkshop(w: Workshop): PublicWorkshop {
  return {
    key: w.key,
    title: w.title,
    description: w.description,
    difficulty: w.difficulty,
    estimatedMinutes: w.estimatedMinutes,
    relatedLessons: w.relatedLessons,
    circuit: w.circuit,
    hints: w.hints,
    learningGoals: w.learningGoals,
    disclaimer: w.disclaimer,
    tasks: w.tasks.map((t) => {
      if (t.type === "multiple_choice") return { id: t.id, type: t.type, question: t.question, choices: t.choices };
      const q = parseQuantity(t.quantity);
      return {
        id: t.id,
        type: t.type,
        question: t.question,
        quantity: t.quantity,
        unit: q ? QUANTITY_UNITS[q.kind] : "",
        label: quantityLabel(t.quantity),
        tolerance: t.tolerance,
        toleranceType: t.toleranceType ?? "absolute",
      };
    }),
  };
}

/** Grade a numeric bench answer (already converted to base units) against the solver. */
export function checkNumericTask(
  solution: CircuitSolution,
  task: { quantity: string; tolerance: number; toleranceType?: ToleranceType },
  value: number | null,
): { correct: boolean; expected: number | null } {
  const expected = quantityValue(solution, task.quantity);
  if (expected === null || value === null || !Number.isFinite(expected)) return { correct: false, expected };
  return { correct: withinTolerance(value, expected, task.tolerance, task.toleranceType ?? "absolute"), expected };
}

export type WorkshopAnswer = { value: string | null; measuredFirst: boolean };

export type WorkshopTaskResult = {
  id: string;
  type: "numeric" | "multiple_choice";
  correct: boolean;
  answered: boolean;
  measuredFirst: boolean;
  given: string | null;
  expected: string;
  /** Revealed only after grading (multiple-choice explanations stay on the server until then). */
  explanation: string | null;
};

export type WorkshopGrade = {
  score: number;
  maxScore: number;
  allCorrect: boolean;
  /** All correct and every numeric answer predicted before measuring. */
  cleanRun: boolean;
  results: WorkshopTaskResult[];
};

/** Server-side grading of a full bench report. `answers[taskId].value` is base-unit text or a choice index. */
export function gradeWorkshop(w: Workshop, answers: Record<string, WorkshopAnswer | undefined>): WorkshopGrade {
  const solution = solveCircuit(w.circuit);
  const results: WorkshopTaskResult[] = w.tasks.map((t) => {
    const a = answers[t.id];
    const measuredFirst = Boolean(a?.measuredFirst);
    if (t.type === "multiple_choice") {
      const idx = parseChoiceIndex(a?.value ?? null, t.choices.length);
      return {
        id: t.id,
        type: t.type,
        correct: idx !== null && idx === t.correctIndex,
        answered: idx !== null,
        measuredFirst: false,
        given: idx !== null ? t.choices[idx]! : null,
        expected: t.choices[t.correctIndex] ?? "",
        explanation: t.explanation ?? null,
      };
    }
    const raw = a?.value;
    const value = raw !== null && raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
    const { correct, expected } = checkNumericTask(solution, t, value);
    const unit = QUANTITY_UNITS[parseQuantity(t.quantity)?.kind ?? "V"];
    return {
      id: t.id,
      type: t.type,
      correct,
      answered: value !== null,
      measuredFirst,
      given: value !== null ? formatMeasurement(value, unit) : null,
      expected: expected === null ? "—" : formatMeasurement(expected, unit),
      explanation: null,
    };
  });
  const score = results.filter((r) => r.correct).length;
  const allCorrect = score === results.length;
  return {
    score,
    maxScore: results.length,
    allCorrect,
    cleanRun: allCorrect && results.every((r) => !r.measuredFirst),
    results,
  };
}

const PREFIXES: { factor: number; symbol: string }[] = [
  { factor: 1e6, symbol: "M" },
  { factor: 1e3, symbol: "k" },
  { factor: 1, symbol: "" },
  { factor: 1e-3, symbol: "m" },
  { factor: 1e-6, symbol: "µ" },
];

/**
 * Engineering-notation display used by the meter and the results: 0.06 A → "60 mA",
 * 4700 Ω → "4.7 kΩ", Infinity Ω → "OL" (over limit, what a real meter shows for an open).
 */
export function formatMeasurement(value: number, unit: string): string {
  if (Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return unit === "Ω" ? "OL" : "∞";
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  const prefix = PREFIXES.find((p) => abs >= p.factor * 0.9995) ?? PREFIXES[PREFIXES.length - 1]!;
  const scaled = value / prefix.factor;
  const text = Number(scaled.toPrecision(4)).toString();
  return `${text} ${prefix.symbol}${unit}`;
}

/** Unit prefixes a student may answer in, per base unit. */
export const ANSWER_PREFIXES: Record<string, { symbol: string; factor: number }[]> = {
  A: [
    { symbol: "A", factor: 1 },
    { symbol: "mA", factor: 1e-3 },
  ],
  V: [
    { symbol: "V", factor: 1 },
    { symbol: "mV", factor: 1e-3 },
    { symbol: "kV", factor: 1e3 },
  ],
  "Ω": [
    { symbol: "Ω", factor: 1 },
    { symbol: "kΩ", factor: 1e3 },
    { symbol: "MΩ", factor: 1e6 },
  ],
  W: [
    { symbol: "W", factor: 1 },
    { symbol: "mW", factor: 1e-3 },
    { symbol: "kW", factor: 1e3 },
  ],
};

export function toBaseUnits(value: number, unit: string, prefixSymbol: string): number {
  const factor = ANSWER_PREFIXES[unit]?.find((p) => p.symbol === prefixSymbol)?.factor ?? 1;
  return value * factor;
}
