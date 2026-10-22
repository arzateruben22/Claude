import { describe, expect, it } from "vitest";
import {
  annualToHourly,
  apprenticePercentAt,
  computePay,
  firstYearReaching,
  hourlyToAnnual,
  linearSchedule,
  overtimeScenarios,
  parsePercentList,
  payLine,
  projectYears,
  targetGaps,
  type CalculatorInput,
} from "@/lib/salary/pay";
import { comparePaths, type ApprenticePathInput, type JobPathInput } from "@/lib/salary/compare";
import { DEFAULT_CALCULATOR_VALUES, DEFAULT_COMPARE_VALUES, parseCalculatorValues, parseCompareValues, parseNumber, scenarioInputsSchema } from "@/lib/salary/forms";

const base: CalculatorInput = {
  basis: "HOURLY",
  hourlyRate: 30,
  annualSalary: 0,
  journeymanRate: 0,
  schedule: { percents: [], periodMonths: 6 },
  apprenticeYear: 1,
  hoursPerWeek: 40,
  overtime15: 0,
  overtime2: 0,
  overtimeWeeks: 52,
  annualBonus: 0,
  benefitsValue: 0,
  raisePct: 0,
  trainingPerYear: 0,
  trainingYears: 0,
  years: 1,
};

describe("hourly ↔ annual on 52 weeks", () => {
  it("annualizes with rate × hours × 52 and inverts exactly", () => {
    expect(hourlyToAnnual(30, 40)).toBe(62_400);
    expect(hourlyToAnnual(25.5, 32)).toBeCloseTo(42_432, 9);
    expect(annualToHourly(62_400, 40)).toBe(30);
    expect(annualToHourly(100_000, 40)).toBeCloseTo(48.0769230769, 9);
    expect(annualToHourly(50_000, 0)).toBe(0);
    expect(payLine(52_000)).toEqual({ weekly: 1000, monthly: 52_000 / 12, annual: 52_000 });
  });
});

describe("calculator pay breakdown", () => {
  it("keeps base, 1.5× and 2× overtime, bonus and benefits separate", () => {
    const pay = computePay({ ...base, overtime15: 5, overtime2: 2, annualBonus: 1000, benefitsValue: 5000 });
    expect(pay.hourlyRate).toBe(30);
    expect(pay.base.annual).toBeCloseTo(62_400, 6);
    expect(pay.base.weekly).toBeCloseTo(1200, 6);
    expect(pay.base.monthly).toBeCloseTo(5200, 6);
    expect(pay.overtime15.annual).toBeCloseTo(30 * 1.5 * 5 * 52, 6);
    expect(pay.overtime2.annual).toBeCloseTo(30 * 2 * 2 * 52, 6);
    expect(pay.overtime.annual).toBeCloseTo(11_700 + 6_240, 6);
    expect(pay.bonus.annual).toBe(1000);
    // Gross is cash only; benefits are only added to total compensation.
    expect(pay.gross.annual).toBeCloseTo(81_340, 6);
    expect(pay.benefits.annual).toBe(5000);
    expect(pay.totalComp.annual).toBeCloseTo(86_340, 6);
    expect(pay.overtimeWeek).toEqual({ base: 1200, overtime: 345, total: 1545 });
  });

  it("uses the salary's hourly equivalent for overtime and limits overtime to the weeks entered", () => {
    const pay = computePay({ ...base, basis: "ANNUAL", annualSalary: 104_000, overtime15: 4, overtimeWeeks: 26 });
    expect(pay.hourlyRate).toBeCloseTo(50, 9);
    expect(pay.base.annual).toBeCloseTo(104_000, 6);
    expect(pay.overtime.annual).toBeCloseTo(50 * 1.5 * 4 * 26, 6);
  });

  it("subtracts training expenses only in the 'after training' line and only for the stated years", () => {
    const rows = projectYears({ ...base, trainingPerYear: 1500, trainingYears: 2, years: 3 });
    expect(rows.map((r) => r.training)).toEqual([1500, 1500, 0]);
    expect(rows[0]!.gross).toBeCloseTo(62_400, 6);
    expect(rows[0]!.grossAfterTraining).toBeCloseTo(60_900, 6);
    expect(rows[2]!.cumulativeAfterTraining).toBeCloseTo(62_400 * 3 - 3000, 6);
  });

  it("compounds raises yearly and reports the first year reaching a target", () => {
    const rows = projectYears({ ...base, raisePct: 3, years: 3 });
    expect(rows[1]!.base).toBeCloseTo(62_400 * 1.03, 6);
    expect(rows[2]!.base).toBeCloseTo(62_400 * 1.03 ** 2, 6);
    expect(rows[2]!.hourlyRate).toBeCloseTo(30 * 1.03 ** 2, 9);
    expect(firstYearReaching(rows, 65_000)).toBe(3);
    expect(firstYearReaching(rows, 100_000)).toBeNull();
  });

  it("computes gaps to $100K and $150K with the base-only hourly rate needed", () => {
    const [g100, g150] = targetGaps(81_340, 40);
    expect(g100).toMatchObject({ target: 100_000, gap: 18_660, reached: false });
    expect(g100!.hourlyNeeded).toBeCloseTo(48.0769, 4);
    expect(g150!.gap).toBe(68_660);
    expect(targetGaps(120_000, 40)[0]).toMatchObject({ reached: true, gap: -20_000 });
  });

  it("builds hypothetical overtime scenarios at 0/5/10/15 hours", () => {
    const s = overtimeScenarios({ ...base, overtime2: 3 });
    expect(s.map((x) => x.hoursAt15)).toEqual([0, 5, 10, 15]);
    expect(s[0]!.overtime).toBe(0);
    expect(s[2]!.overtime).toBeCloseTo(30 * 1.5 * 10 * 52, 6);
    expect(s[3]!.gross).toBeCloseTo(62_400 + 30 * 1.5 * 15 * 52, 6);
  });
});

describe("apprenticeship schedule", () => {
  it("pays the period's % of journeyman month by month, then 100% after the last period", () => {
    const schedule = { percents: [40, 50], periodMonths: 6 };
    expect(apprenticePercentAt(schedule, 0)).toBe(40);
    expect(apprenticePercentAt(schedule, 5)).toBe(40);
    expect(apprenticePercentAt(schedule, 6)).toBe(50);
    expect(apprenticePercentAt(schedule, 12)).toBe(100);
    const rows = projectYears({ ...base, basis: "APPRENTICE", journeymanRate: 50, schedule, years: 2 });
    // 6 months at $20 + 6 months at $25, 40 h/week, 52 weeks.
    expect(rows[0]!.base).toBeCloseTo((6 * 20 + 6 * 25) * ((40 * 52) / 12), 6);
    expect(rows[0]!.base).toBeCloseTo(46_800, 6);
    expect(rows[0]!.apprenticePct).toBe(40);
    expect(rows[1]!.base).toBeCloseTo(104_000, 6);
    expect(rows[1]!.apprenticePct).toBe(100);
    expect(firstYearReaching(rows, 100_000)).toBe(2);
  });

  it("starts at the apprenticeship year the user is in and raises the journeyman scale", () => {
    const schedule = { percents: [40, 50, 60, 70], periodMonths: 12 };
    const y3 = projectYears({ ...base, basis: "APPRENTICE", journeymanRate: 50, schedule, apprenticeYear: 3, raisePct: 2, years: 2 });
    expect(y3[0]!.apprenticePct).toBe(60);
    expect(y3[0]!.base).toBeCloseTo(50 * 0.6 * 2080, 6);
    expect(y3[1]!.apprenticePct).toBe(70);
    expect(y3[1]!.base).toBeCloseTo(50 * 1.02 * 0.7 * 2080, 6);
  });

  it("parses percent lists and builds linear schedules capped at 100%", () => {
    expect(parsePercentList("40, 45%, 50")).toEqual([40, 45, 50]);
    expect(parsePercentList("40;45 50")).toEqual([40, 45, 50]);
    expect(parsePercentList("")).toBeNull();
    expect(parsePercentList("0, 50")).toBeNull();
    expect(parsePercentList("120")).toBeNull();
    expect(linearSchedule(40, 5, 6, 60)).toEqual({ percents: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85], periodMonths: 6 });
    expect(linearSchedule(80, 15, 12, 30).percents).toEqual([80, 95, 100]);
  });
});

describe("compare paths", () => {
  const a: JobPathInput = { basis: "ANNUAL", amount: 60_000, hoursPerWeek: 40, raisePct: 0, overtimeHours: 0 };
  const b: ApprenticePathInput = {
    journeymanRate: 50,
    startPct: 40,
    stepPct: 10,
    periodMonths: 12,
    programMonths: 36,
    hoursPerWeek: 40,
    unpaidWeeks: 0,
    raisePct: 0,
    overtimeHours: 0,
    trainingCostPerYear: 1000,
  };

  it("finds the annual and cumulative crossover years and the final difference", () => {
    const r = comparePaths(a, b, 5);
    expect(r.rows.map((x) => Math.round(x.a))).toEqual([60_000, 60_000, 60_000, 60_000, 60_000]);
    expect(r.rows.map((x) => Math.round(x.b))).toEqual([40_600, 51_000, 61_400, 104_000, 104_000]);
    expect(r.rows.map((x) => x.bPct)).toEqual([40, 50, 60, 100, 100]);
    expect(r.rows.map((x) => x.bTraining)).toEqual([1000, 1000, 1000, 0, 0]);
    expect(r.annualCrossoverYear).toBe(3);
    expect(r.cumulativeCrossoverYear).toBe(4);
    expect(r.bAheadFromStart).toBe(false);
    expect(r.finalDiff).toBeCloseTo(361_000 - 300_000, 6);
    expect(r.completionMonth).toBe(37);
  });

  it("reports no crossover when the apprenticeship never catches up within the horizon", () => {
    const r = comparePaths({ ...a, amount: 90_000, raisePct: 3 }, { ...b, stepPct: 2, programMonths: 120 }, 10);
    expect(r.years).toBe(10);
    expect(r.cumulativeCrossoverYear).toBeNull();
    expect(r.finalDiff).toBeLessThan(0);
  });

  it("handles a path B that is ahead from the start, unpaid weeks, overtime, and clamps the horizon to 5–10 years", () => {
    const ahead = comparePaths({ ...a, amount: 30_000 }, b, 3);
    expect(ahead.years).toBe(5);
    expect(ahead.bAheadFromStart).toBe(true);
    expect(ahead.cumulativeCrossoverYear).toBeNull();
    expect(comparePaths(a, b, 40).years).toBe(10);
    const unpaid = comparePaths(a, { ...b, unpaidWeeks: 2, trainingCostPerYear: 0 }, 5);
    expect(unpaid.rows[0]!.b).toBeCloseTo(20 * 40 * 50, 6);
    const ot = comparePaths({ ...a, basis: "HOURLY", amount: 30, overtimeHours: 5 }, b, 5);
    expect(ot.rows[0]!.a).toBeCloseTo(30 * 40 * 52 + 30 * 1.5 * 5 * 52, 6);
  });
});

describe("form parsing", () => {
  it("parses money-like strings", () => {
    expect(parseNumber("$1,250.50")).toBe(1250.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("12%")).toBe(12);
  });

  it("requires the pay amount for the chosen basis and validates ranges", () => {
    const empty = parseCalculatorValues(DEFAULT_CALCULATOR_VALUES);
    expect(empty.input).toBeNull();
    expect(empty.errors.hourlyRate).toBeDefined();
    const ok = parseCalculatorValues({ ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "$32.50" });
    expect(ok.input?.hourlyRate).toBe(32.5);
    expect(ok.input?.overtimeWeeks).toBe(52);
    const bad = parseCalculatorValues({ ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "30", overtime15: "abc", years: "0" });
    expect(bad.input).toBeNull();
    expect(Object.keys(bad.errors).sort()).toEqual(["overtime15", "years"]);
    const appr = parseCalculatorValues({ ...DEFAULT_CALCULATOR_VALUES, basis: "APPRENTICE", journeymanRate: "65", schedule: "40, 45, x" });
    expect(appr.errors.schedule).toBeDefined();
    const training = parseCalculatorValues({ ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "30", trainingPerYear: "500" });
    expect(training.errors.trainingYears).toBeDefined();
  });

  it("leaves the comparison incomplete until the user supplies the apprenticeship assumptions", () => {
    const cited = { ...DEFAULT_COMPARE_VALUES, bJourneyman: "65.00", bStartPct: "40", aAmount: "70000" };
    const partial = parseCompareValues(cited);
    expect(partial.a).not.toBeNull();
    expect(partial.b).toBeNull();
    expect(Object.keys(partial.errors).sort()).toEqual(["bPeriodMonths", "bProgramMonths", "bStep"]);
    const full = parseCompareValues({ ...cited, bStep: "5", bPeriodMonths: "6", bProgramMonths: "60" });
    expect(full.b).toMatchObject({ journeymanRate: 65, startPct: 40, stepPct: 5, periodMonths: 6, programMonths: 60, trainingCostPerYear: 0 });
  });

  it("validates stored scenario JSON by kind", () => {
    expect(scenarioInputsSchema.safeParse({ kind: "calculator", version: 1, values: DEFAULT_CALCULATOR_VALUES }).success).toBe(true);
    expect(scenarioInputsSchema.safeParse({ kind: "compare", version: 1, values: DEFAULT_COMPARE_VALUES }).success).toBe(true);
    expect(scenarioInputsSchema.safeParse({ kind: "compare", version: 1, values: DEFAULT_CALCULATOR_VALUES }).success).toBe(false);
    expect(scenarioInputsSchema.safeParse({ kind: "calculator", version: 1, values: { ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "x".repeat(41) } }).success).toBe(false);
  });
});
