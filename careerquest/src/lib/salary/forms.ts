/**
 * Form values for the Calculator and Compare-paths tabs. The client keeps every field as the string
 * the user typed (so a saved scenario restores exactly what was entered); these helpers validate
 * and convert them into the numeric inputs of `pay.ts` / `compare.ts`. Pure and shared by the client
 * components, the scenario server actions and the tests.
 */
import { z } from "zod";
import { MAX_COMPARE_YEARS, MIN_COMPARE_YEARS, type ApprenticePathInput, type JobPathInput } from "./compare";
import { MAX_PROJECTION_YEARS, parsePercentList, type CalculatorInput } from "./pay";

export type FieldErrors = Record<string, string>;

const field = z.string().max(40);

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export const calculatorValuesSchema = z.object({
  basis: z.enum(["HOURLY", "ANNUAL", "APPRENTICE"]),
  hourlyRate: field,
  annualSalary: field,
  journeymanRate: field,
  schedule: z.string().max(400),
  periodMonths: field,
  apprenticeYear: field,
  hoursPerWeek: field,
  overtime15: field,
  overtime2: field,
  overtimeWeeks: field,
  annualBonus: field,
  benefitsValue: field,
  raisePct: field,
  trainingPerYear: field,
  trainingYears: field,
  years: field,
});

export type CalculatorValues = z.infer<typeof calculatorValuesSchema>;

/** Neutral starting values: no pay figures are invented; 40 h/week and no overtime/raises. */
export const DEFAULT_CALCULATOR_VALUES: CalculatorValues = {
  basis: "HOURLY",
  hourlyRate: "",
  annualSalary: "",
  journeymanRate: "",
  schedule: "",
  periodMonths: "6",
  apprenticeYear: "1",
  hoursPerWeek: "40",
  overtime15: "0",
  overtime2: "0",
  overtimeWeeks: "52",
  annualBonus: "",
  benefitsValue: "",
  raisePct: "0",
  trainingPerYear: "",
  trainingYears: "",
  years: "10",
};

/** "$1,250.50" → 1250.5; "" → null; garbage → NaN. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "").replace(/%$/, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

type NumSpec = { min: number; max: number; required?: boolean; integer?: boolean; label: string; fallback?: number };

function readNum(values: Record<string, string>, key: string, spec: NumSpec, errors: FieldErrors): number {
  const v = parseNumber(values[key] ?? "");
  if (v === null) {
    if (spec.required) errors[key] = `Enter ${spec.label}.`;
    return spec.fallback ?? 0;
  }
  if (Number.isNaN(v)) {
    errors[key] = `Enter a number for ${spec.label}.`;
    return spec.fallback ?? 0;
  }
  if (spec.integer && !Number.isInteger(v)) {
    errors[key] = `Use a whole number for ${spec.label}.`;
    return spec.fallback ?? 0;
  }
  if (v < spec.min || v > spec.max) {
    errors[key] = `${spec.label[0]!.toUpperCase()}${spec.label.slice(1)} must be between ${spec.min.toLocaleString("en-US")} and ${spec.max.toLocaleString("en-US")}.`;
    return spec.fallback ?? 0;
  }
  return v;
}

export type ParsedCalculator = { input: CalculatorInput | null; errors: FieldErrors };

export function parseCalculatorValues(values: CalculatorValues): ParsedCalculator {
  const errors: FieldErrors = {};
  const v = values as unknown as Record<string, string>;
  const basis = values.basis;
  const hourlyRate = readNum(v, "hourlyRate", { min: 0.01, max: 1000, required: basis === "HOURLY", label: "your hourly rate" }, errors);
  const annualSalary = readNum(v, "annualSalary", { min: 1, max: 10_000_000, required: basis === "ANNUAL", label: "your annual salary" }, errors);
  const journeymanRate = readNum(v, "journeymanRate", { min: 0.01, max: 1000, required: basis === "APPRENTICE", label: "the journeyman rate" }, errors);
  const periodMonths = readNum(v, "periodMonths", { min: 1, max: 24, integer: true, required: basis === "APPRENTICE", label: "the period length", fallback: 6 }, errors);
  const apprenticeYear = readNum(v, "apprenticeYear", { min: 1, max: 10, integer: true, required: basis === "APPRENTICE", label: "your apprenticeship year", fallback: 1 }, errors);
  let percents: number[] = [];
  if (basis === "APPRENTICE") {
    const parsed = parsePercentList(values.schedule);
    if (!parsed) errors.schedule = "List the % of journeyman pay for each period, e.g. 40, 45, 50 (each 1–100, up to 40 periods).";
    else percents = parsed;
  }
  const hoursPerWeek = readNum(v, "hoursPerWeek", { min: 1, max: 80, required: true, label: "regular hours per week", fallback: 40 }, errors);
  const overtime15 = readNum(v, "overtime15", { min: 0, max: 60, label: "1.5× overtime hours" }, errors);
  const overtime2 = readNum(v, "overtime2", { min: 0, max: 60, label: "2× overtime hours" }, errors);
  const overtimeWeeks = readNum(v, "overtimeWeeks", { min: 0, max: 52, label: "weeks with overtime", fallback: 52 }, errors);
  const annualBonus = readNum(v, "annualBonus", { min: 0, max: 10_000_000, label: "the annual bonus" }, errors);
  const benefitsValue = readNum(v, "benefitsValue", { min: 0, max: 10_000_000, label: "the benefits value" }, errors);
  const raisePct = readNum(v, "raisePct", { min: 0, max: 25, label: "the yearly raise" }, errors);
  const trainingPerYear = readNum(v, "trainingPerYear", { min: 0, max: 1_000_000, label: "training expenses" }, errors);
  const trainingYears = readNum(v, "trainingYears", { min: 0, max: MAX_PROJECTION_YEARS, integer: true, label: "years of training expenses" }, errors);
  const years = readNum(v, "years", { min: 1, max: MAX_PROJECTION_YEARS, integer: true, required: true, label: "years to project", fallback: 10 }, errors);
  if (trainingPerYear > 0 && trainingYears === 0 && !errors.trainingYears && (values.trainingYears ?? "").trim() === "") {
    errors.trainingYears = "Enter for how many years you pay these training expenses.";
  }
  if (overtime15 + overtime2 + hoursPerWeek > 112) errors.overtime15 = "Regular plus overtime hours cannot exceed 112 a week.";
  if (Object.keys(errors).length > 0) return { input: null, errors };
  return {
    input: {
      basis,
      hourlyRate,
      annualSalary,
      journeymanRate,
      schedule: { percents, periodMonths },
      apprenticeYear,
      hoursPerWeek,
      overtime15,
      overtime2,
      overtimeWeeks,
      annualBonus,
      benefitsValue,
      raisePct,
      trainingPerYear,
      trainingYears,
      years,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Compare paths
// ---------------------------------------------------------------------------

export const compareValuesSchema = z.object({
  years: field,
  aBasis: z.enum(["HOURLY", "ANNUAL"]),
  aAmount: field,
  aHours: field,
  aRaise: field,
  aOvertime: field,
  bJourneyman: field,
  bStartPct: field,
  bStep: field,
  bPeriodMonths: field,
  bProgramMonths: field,
  bHours: field,
  bUnpaidWeeks: field,
  bRaise: field,
  bOvertime: field,
  bTraining: field,
});

export type CompareValues = z.infer<typeof compareValuesSchema>;

/**
 * Blank comparison. The page pre-fills only `bJourneyman` and `bStartPct`, and only from cited data;
 * the step increase, period and program length are left for the user to enter.
 */
export const DEFAULT_COMPARE_VALUES: CompareValues = {
  years: "10",
  aBasis: "ANNUAL",
  aAmount: "",
  aHours: "40",
  aRaise: "0",
  aOvertime: "0",
  bJourneyman: "",
  bStartPct: "",
  bStep: "",
  bPeriodMonths: "",
  bProgramMonths: "",
  bHours: "40",
  bUnpaidWeeks: "0",
  bRaise: "0",
  bOvertime: "0",
  bTraining: "0",
};

export type ParsedCompare = { a: JobPathInput | null; b: ApprenticePathInput | null; years: number; errors: FieldErrors };

export function parseCompareValues(values: CompareValues): ParsedCompare {
  const errors: FieldErrors = {};
  const v = values as unknown as Record<string, string>;
  const years = readNum(v, "years", { min: MIN_COMPARE_YEARS, max: MAX_COMPARE_YEARS, integer: true, required: true, label: "years to compare", fallback: 10 }, errors);
  const aErrorsBefore = Object.keys(errors).length;
  const aAmount =
    values.aBasis === "ANNUAL"
      ? readNum(v, "aAmount", { min: 1, max: 10_000_000, required: true, label: "the job's annual salary" }, errors)
      : readNum(v, "aAmount", { min: 0.01, max: 1000, required: true, label: "the job's hourly rate" }, errors);
  const aHours = readNum(v, "aHours", { min: 1, max: 80, required: true, label: "the job's hours per week", fallback: 40 }, errors);
  const aRaise = readNum(v, "aRaise", { min: 0, max: 25, label: "the job's yearly raise" }, errors);
  const aOvertime = readNum(v, "aOvertime", { min: 0, max: 60, label: "the job's overtime hours" }, errors);
  const aOk = Object.keys(errors).length === aErrorsBefore;

  const bErrorsBefore = Object.keys(errors).length;
  const bJourneyman = readNum(v, "bJourneyman", { min: 0.01, max: 1000, required: true, label: "the journeyman rate" }, errors);
  const bStartPct = readNum(v, "bStartPct", { min: 1, max: 100, required: true, label: "the starting %" }, errors);
  const bStep = readNum(v, "bStep", { min: 0, max: 60, required: true, label: "the step increase per period" }, errors);
  const bPeriodMonths = readNum(v, "bPeriodMonths", { min: 1, max: 24, integer: true, required: true, label: "the period length" }, errors);
  const bProgramMonths = readNum(v, "bProgramMonths", { min: 1, max: 120, integer: true, required: true, label: "the program length" }, errors);
  const bHours = readNum(v, "bHours", { min: 1, max: 80, required: true, label: "the apprenticeship hours per week", fallback: 40 }, errors);
  const bUnpaidWeeks = readNum(v, "bUnpaidWeeks", { min: 0, max: 52, label: "unpaid weeks" }, errors);
  const bRaise = readNum(v, "bRaise", { min: 0, max: 25, label: "the journeyman scale increase" }, errors);
  const bOvertime = readNum(v, "bOvertime", { min: 0, max: 60, label: "the apprenticeship overtime hours" }, errors);
  const bTraining = readNum(v, "bTraining", { min: 0, max: 1_000_000, label: "training costs" }, errors);
  const bOk = Object.keys(errors).length === bErrorsBefore;

  return {
    years,
    errors,
    a: aOk ? { basis: values.aBasis, amount: aAmount, hoursPerWeek: aHours, raisePct: aRaise, overtimeHours: aOvertime } : null,
    b: bOk
      ? {
          journeymanRate: bJourneyman,
          startPct: bStartPct,
          stepPct: bStep,
          periodMonths: bPeriodMonths,
          programMonths: bProgramMonths,
          hoursPerWeek: bHours,
          unpaidWeeks: bUnpaidWeeks,
          raisePct: bRaise,
          overtimeHours: bOvertime,
          trainingCostPerYear: bTraining,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Saved scenarios
// ---------------------------------------------------------------------------

export const SCENARIO_KINDS = ["calculator", "compare"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

/** What is stored in `SalaryScenario.inputs`. */
export const scenarioInputsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("calculator"), version: z.literal(1), values: calculatorValuesSchema }),
  z.object({ kind: z.literal("compare"), version: z.literal(1), values: compareValuesSchema }),
]);

export type ScenarioInputs = z.infer<typeof scenarioInputsSchema>;

export const scenarioNameSchema = z.string().trim().min(1, "Give the scenario a name.").max(80, "Keep the name under 80 characters.");

/** Max saved scenarios per user (both kinds together). */
export const MAX_SCENARIOS = 50;
