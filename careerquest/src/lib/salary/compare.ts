/**
 * "Higher-paying job now" vs "paid apprenticeship with long-term growth": year-by-year and
 * cumulative gross earnings for two user-described paths. Pure. Every number is an estimate built
 * from the user's assumptions (plus cited wage data where the UI pre-fills it); raises and overtime
 * are assumptions, never guarantees.
 */
import {
  MONTHS_PER_YEAR,
  OT_TIER_1,
  WEEKS_PER_YEAR,
  annualToHourly,
  apprenticePercentAt,
  linearSchedule,
  type ApprenticeSchedule,
} from "./pay";

export const MIN_COMPARE_YEARS = 5;
export const MAX_COMPARE_YEARS = 10;

/** (A) A job available now. */
export type JobPathInput = {
  basis: "HOURLY" | "ANNUAL";
  /** Hourly rate or annual salary, by basis. */
  amount: number;
  hoursPerWeek: number;
  /** Expected raise per year (%), an assumption. */
  raisePct: number;
  /** Optional overtime hours per week at 1.5× (an assumption, never guaranteed). */
  overtimeHours: number;
};

/** (B) A paid apprenticeship. */
export type ApprenticePathInput = {
  journeymanRate: number;
  startPct: number;
  /** Percentage points added each period. */
  stepPct: number;
  periodMonths: number;
  /** Length of the apprenticeship; journeyman rate (100 %) applies afterwards. */
  programMonths: number;
  hoursPerWeek: number;
  /** Weeks per year without pay (e.g. school weeks, if your program does not pay them). */
  unpaidWeeks: number;
  /** Expected yearly increase of the journeyman scale (%), an assumption. */
  raisePct: number;
  overtimeHours: number;
  /** Training costs you pay per year while in the program (books, tools, dues, tuition). */
  trainingCostPerYear: number;
};

export type CompareRow = {
  year: number;
  /** Gross pay in the year for path A. */
  a: number;
  /** Gross pay in the year for path B, minus that year's training costs. */
  b: number;
  bGross: number;
  bTraining: number;
  /** B's % of the journeyman rate in the first month of the year. */
  bPct: number;
  cumA: number;
  cumB: number;
  /** cumB − cumA (positive = B ahead). */
  diff: number;
};

export type CompareResult = {
  years: number;
  rows: CompareRow[];
  schedule: ApprenticeSchedule;
  /** First year B's yearly pay (after training costs) is at least A's, if ever. */
  annualCrossoverYear: number | null;
  /** First year B's cumulative earnings catch up with A's after having been behind, if ever. */
  cumulativeCrossoverYear: number | null;
  /** True when B is at least level with A cumulatively from year 1. */
  bAheadFromStart: boolean;
  /** cumB − cumA at the end of the horizon. */
  finalDiff: number;
  /** Month (1-based) the apprenticeship ends and the journeyman rate starts, if within the horizon. */
  completionMonth: number;
};

const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const nonNeg = (n: number) => Math.max(0, finite(n));
const growth = (pct: number, y: number) => (1 + finite(pct) / 100) ** y;

/** Path A gross pay for year index y (0-based). */
export function jobYearPay(a: JobPathInput, y: number): number {
  const g = growth(a.raisePct, y);
  const hours = nonNeg(a.hoursPerWeek);
  const base = a.basis === "ANNUAL" ? nonNeg(a.amount) * g : nonNeg(a.amount) * g * hours * WEEKS_PER_YEAR;
  const rate = a.basis === "ANNUAL" ? annualToHourly(base, hours) : nonNeg(a.amount) * g;
  return base + rate * OT_TIER_1 * nonNeg(a.overtimeHours) * WEEKS_PER_YEAR;
}

/**
 * Path B gross pay (before training costs) for year index y, month by month: the schedule's % of the
 * journeyman rate until `programMonths`, then 100 %. Unpaid weeks reduce both regular and overtime pay.
 */
export function apprenticeYearPay(b: ApprenticePathInput, schedule: ApprenticeSchedule, programMonths: number, y: number): { gross: number; firstPct: number } {
  const paidWeeks = Math.max(0, WEEKS_PER_YEAR - Math.min(WEEKS_PER_YEAR, nonNeg(b.unpaidWeeks)));
  const weeklyHours = nonNeg(b.hoursPerWeek) + OT_TIER_1 * nonNeg(b.overtimeHours);
  const journeyman = nonNeg(b.journeymanRate) * growth(b.raisePct, y);
  let gross = 0;
  let firstPct = 100;
  for (let i = 0; i < MONTHS_PER_YEAR; i++) {
    const t = y * MONTHS_PER_YEAR + i;
    const pct = t >= programMonths ? 100 : apprenticePercentAt(schedule, t);
    if (i === 0) firstPct = pct;
    gross += (((journeyman * pct) / 100) * weeklyHours * paidWeeks) / MONTHS_PER_YEAR;
  }
  return { gross, firstPct };
}

export function comparePaths(a: JobPathInput, b: ApprenticePathInput, yearsIn: number): CompareResult {
  const years = Math.min(MAX_COMPARE_YEARS, Math.max(MIN_COMPARE_YEARS, Math.floor(finite(yearsIn)) || MAX_COMPARE_YEARS));
  const schedule = linearSchedule(b.startPct, b.stepPct, b.periodMonths, b.programMonths);
  const programMonths = Math.max(1, Math.floor(nonNeg(b.programMonths)));
  const rows: CompareRow[] = [];
  let cumA = 0;
  let cumB = 0;
  let annualCrossoverYear: number | null = null;
  let cumulativeCrossoverYear: number | null = null;
  let wasBehind = false;
  for (let y = 0; y < years; y++) {
    const payA = jobYearPay(a, y);
    const { gross, firstPct } = apprenticeYearPay(b, schedule, programMonths, y);
    const inProgram = y * MONTHS_PER_YEAR < programMonths;
    const training = inProgram ? nonNeg(b.trainingCostPerYear) : 0;
    const payB = gross - training;
    cumA += payA;
    cumB += payB;
    if (annualCrossoverYear === null && payB >= payA) annualCrossoverYear = y + 1;
    if (cumB < cumA) wasBehind = true;
    else if (wasBehind && cumulativeCrossoverYear === null) cumulativeCrossoverYear = y + 1;
    rows.push({ year: y + 1, a: payA, b: payB, bGross: gross, bTraining: training, bPct: firstPct, cumA, cumB, diff: cumB - cumA });
  }
  return {
    years,
    rows,
    schedule,
    annualCrossoverYear,
    cumulativeCrossoverYear,
    bAheadFromStart: rows.length > 0 && rows[0]!.cumB >= rows[0]!.cumA,
    finalDiff: rows.length ? rows[rows.length - 1]!.diff : 0,
    completionMonth: programMonths + 1,
  };
}
