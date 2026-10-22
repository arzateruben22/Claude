/**
 * Pay math for the salary simulator. Pure functions, gross amounts before taxes and deductions.
 *
 * Conventions (stated in the UI):
 * - A year is 52 weeks and 12 months. Hourly ↔ annual uses rate × hours/week × 52 (2,080 hours at
 *   40 h/week). Weekly and monthly figures are averages of the annual amount (annual / 52, / 12).
 * - Overtime is paid on the regular hourly rate: tier 1 at 1.5×, tier 2 at 2×. For a salaried job
 *   the hourly equivalent (salary / (hours × 52)) is used; exempt salaried roles usually pay no
 *   overtime at all. Overtime and raises are never guaranteed, so they are always shown separately.
 * - Base, overtime, bonus and benefits stay separate. "Gross cash" = base + overtime + bonus.
 *   Benefits are only added in the explicit "total compensation" figure.
 */

export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;
export const OT_TIER_1 = 1.5;
export const OT_TIER_2 = 2;
/** The two fixed income targets the simulator compares against. */
export const INCOME_TARGETS = [100_000, 150_000] as const;
export const MAX_PROJECTION_YEARS = 40;

export type PayBasis = "HOURLY" | "ANNUAL" | "APPRENTICE";

const finite = (n: number) => (Number.isFinite(n) ? n : 0);
const nonNeg = (n: number) => Math.max(0, finite(n));

export function hourlyToAnnual(rate: number, hoursPerWeek = 40, weeks = WEEKS_PER_YEAR): number {
  return nonNeg(rate) * nonNeg(hoursPerWeek) * nonNeg(weeks);
}

/** Hourly equivalent of an annual salary; 0 when there are no hours. */
export function annualToHourly(annual: number, hoursPerWeek = 40, weeks = WEEKS_PER_YEAR): number {
  const hours = nonNeg(hoursPerWeek) * nonNeg(weeks);
  return hours > 0 ? nonNeg(annual) / hours : 0;
}

export type PayLine = { weekly: number; monthly: number; annual: number };

export function payLine(annual: number): PayLine {
  const a = finite(annual);
  return { weekly: a / WEEKS_PER_YEAR, monthly: a / MONTHS_PER_YEAR, annual: a };
}

/** Apprenticeship schedule: % of the journeyman rate for each period of `periodMonths` months. */
export type ApprenticeSchedule = { percents: number[]; periodMonths: number };

export function scheduleMonths(s: ApprenticeSchedule): number {
  return s.percents.length * Math.max(1, Math.floor(s.periodMonths));
}

/** % of journeyman paid in month `t` (0-based from the first day of the apprenticeship). */
export function apprenticePercentAt(s: ApprenticeSchedule, t: number): number {
  const period = Math.max(1, Math.floor(s.periodMonths));
  const idx = Math.floor(Math.max(0, t) / period);
  if (idx >= s.percents.length) return 100;
  return Math.min(100, nonNeg(s.percents[idx]!));
}

/** Parse "40, 45, 50" (or with % signs / semicolons / spaces) into percentages; null when invalid. */
export function parsePercentList(text: string, maxPeriods = 40): number[] | null {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.replace(/%$/, "").trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > maxPeriods) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n > 100)) return null;
  return nums;
}

/** Linear schedule: start %, +step percentage points each period, capped at 100 %. */
export function linearSchedule(startPct: number, stepPct: number, periodMonths: number, programMonths: number): ApprenticeSchedule {
  const period = Math.max(1, Math.floor(periodMonths));
  const periods = Math.max(1, Math.ceil(Math.max(1, programMonths) / period));
  const percents = Array.from({ length: periods }, (_, i) => Math.min(100, nonNeg(startPct) + i * nonNeg(stepPct)));
  return { percents, periodMonths: period };
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export type CalculatorInput = {
  basis: PayBasis;
  /** HOURLY: regular hourly rate. */
  hourlyRate: number;
  /** ANNUAL: annual base salary. */
  annualSalary: number;
  /** APPRENTICE: journeyman hourly rate and the % schedule. */
  journeymanRate: number;
  schedule: ApprenticeSchedule;
  /** APPRENTICE: the apprenticeship year you are in (1 = first year). */
  apprenticeYear: number;
  /** Regular (straight-time) hours per week. */
  hoursPerWeek: number;
  /** Hours per week paid at 1.5× in weeks with overtime. */
  overtime15: number;
  /** Hours per week paid at 2× in weeks with overtime. */
  overtime2: number;
  /** Weeks per year that include that overtime (0–52). */
  overtimeWeeks: number;
  annualBonus: number;
  /** Estimated annual value of employer-paid benefits (shown separately). */
  benefitsValue: number;
  /** Expected raise per year, in percent (an assumption, never guaranteed). */
  raisePct: number;
  /** Training expenses you pay per year (tuition, books, tools, dues). */
  trainingPerYear: number;
  /** For how many years those training expenses apply. */
  trainingYears: number;
  /** Projection length in years. */
  years: number;
};

export type YearRow = {
  year: number;
  /** Regular hourly rate in the first month of the year (hourly equivalent for salaries). */
  hourlyRate: number;
  /** APPRENTICE: % of journeyman in the first month of the year (100 after completion). */
  apprenticePct: number | null;
  base: number;
  overtime15: number;
  overtime2: number;
  overtime: number;
  bonus: number;
  /** base + overtime + bonus, before taxes. */
  gross: number;
  benefits: number;
  /** gross + benefits. */
  totalComp: number;
  training: number;
  /** gross − training expenses (still before taxes). */
  grossAfterTraining: number;
  cumulativeAfterTraining: number;
};

const growth = (pct: number, year: number) => (1 + finite(pct) / 100) ** year;

/** Earnings year by year (year 1 = the next 12 months). */
export function projectYears(input: CalculatorInput): YearRow[] {
  const years = Math.min(MAX_PROJECTION_YEARS, Math.max(1, Math.floor(input.years)));
  const hours = nonNeg(input.hoursPerWeek);
  const otWeeks = Math.min(WEEKS_PER_YEAR, nonNeg(input.overtimeWeeks));
  const startMonth = Math.max(0, Math.floor(input.apprenticeYear) - 1) * MONTHS_PER_YEAR;
  const rows: YearRow[] = [];
  let cumulative = 0;
  for (let y = 0; y < years; y++) {
    const g = growth(input.raisePct, y);
    let base = 0;
    let ot15 = 0;
    let ot2 = 0;
    let firstRate = 0;
    let firstPct: number | null = null;
    for (let i = 0; i < MONTHS_PER_YEAR; i++) {
      let rate: number;
      let monthBase: number;
      if (input.basis === "ANNUAL") {
        const salary = nonNeg(input.annualSalary) * g;
        rate = annualToHourly(salary, hours);
        monthBase = salary / MONTHS_PER_YEAR;
      } else if (input.basis === "APPRENTICE") {
        const pct = apprenticePercentAt(input.schedule, startMonth + y * MONTHS_PER_YEAR + i);
        if (i === 0) firstPct = pct;
        rate = (nonNeg(input.journeymanRate) * g * pct) / 100;
        monthBase = (rate * hours * WEEKS_PER_YEAR) / MONTHS_PER_YEAR;
      } else {
        rate = nonNeg(input.hourlyRate) * g;
        monthBase = (rate * hours * WEEKS_PER_YEAR) / MONTHS_PER_YEAR;
      }
      if (i === 0) firstRate = rate;
      base += monthBase;
      ot15 += (rate * OT_TIER_1 * nonNeg(input.overtime15) * otWeeks) / MONTHS_PER_YEAR;
      ot2 += (rate * OT_TIER_2 * nonNeg(input.overtime2) * otWeeks) / MONTHS_PER_YEAR;
    }
    const bonus = nonNeg(input.annualBonus);
    const overtime = ot15 + ot2;
    const gross = base + overtime + bonus;
    const benefits = nonNeg(input.benefitsValue);
    const training = y < Math.floor(nonNeg(input.trainingYears)) ? nonNeg(input.trainingPerYear) : 0;
    cumulative += gross - training;
    rows.push({
      year: y + 1,
      hourlyRate: firstRate,
      apprenticePct: firstPct,
      base,
      overtime15: ot15,
      overtime2: ot2,
      overtime,
      bonus,
      gross,
      benefits,
      totalComp: gross + benefits,
      training,
      grossAfterTraining: gross - training,
      cumulativeAfterTraining: cumulative,
    });
  }
  return rows;
}

export type PayBreakdown = {
  hourlyRate: number;
  base: PayLine;
  overtime15: PayLine;
  overtime2: PayLine;
  overtime: PayLine;
  bonus: PayLine;
  gross: PayLine;
  benefits: PayLine;
  totalComp: PayLine;
  training: PayLine;
  grossAfterTraining: PayLine;
  /** Pay in a single week that includes the overtime hours (rate at the start of the year). */
  overtimeWeek: { base: number; overtime: number; total: number };
};

/** Weekly / monthly / annual split for the first projected year. */
export function computePay(input: CalculatorInput): PayBreakdown {
  const y1 = projectYears({ ...input, years: 1 })[0]!;
  const hours = nonNeg(input.hoursPerWeek);
  const weekBase = input.basis === "ANNUAL" ? nonNeg(input.annualSalary) / WEEKS_PER_YEAR : y1.hourlyRate * hours;
  const weekOt = y1.hourlyRate * (OT_TIER_1 * nonNeg(input.overtime15) + OT_TIER_2 * nonNeg(input.overtime2));
  return {
    hourlyRate: y1.hourlyRate,
    base: payLine(y1.base),
    overtime15: payLine(y1.overtime15),
    overtime2: payLine(y1.overtime2),
    overtime: payLine(y1.overtime),
    bonus: payLine(y1.bonus),
    gross: payLine(y1.gross),
    benefits: payLine(y1.benefits),
    totalComp: payLine(y1.totalComp),
    training: payLine(y1.training),
    grossAfterTraining: payLine(y1.grossAfterTraining),
    overtimeWeek: { base: weekBase, overtime: weekOt, total: weekBase + weekOt },
  };
}

export type TargetGap = {
  target: number;
  /** target − amount (positive = still short, negative = above the target). */
  gap: number;
  reached: boolean;
  /** Regular hourly rate that would reach the target from base pay alone at these hours. */
  hourlyNeeded: number | null;
};

export function targetGaps(annual: number, hoursPerWeek: number, targets: readonly number[] = INCOME_TARGETS): TargetGap[] {
  return targets.map((target) => ({
    target,
    gap: target - finite(annual),
    reached: finite(annual) >= target,
    hourlyNeeded: hoursPerWeek > 0 ? annualToHourly(target, hoursPerWeek) : null,
  }));
}

/** First projected year whose value reaches the target, or null within the horizon. */
export function firstYearReaching(rows: YearRow[], target: number, field: "gross" | "base" = "gross"): number | null {
  const row = rows.find((r) => r[field] >= target);
  return row ? row.year : null;
}

export type OvertimeScenario = { hoursAt15: number; overtime: number; gross: number };

/** Year-1 gross cash with 0 / 5 / 10 / 15 hours a week at 1.5× (other inputs unchanged). */
export function overtimeScenarios(input: CalculatorInput, hoursList: number[] = [0, 5, 10, 15]): OvertimeScenario[] {
  return hoursList.map((h) => {
    const y1 = projectYears({ ...input, overtime15: h, overtime2: 0, years: 1 })[0]!;
    return { hoursAt15: h, overtime: y1.overtime, gross: y1.gross };
  });
}
