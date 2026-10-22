/**
 * Offer comparison math. Pure. Everything is gross (before taxes) and annualized on 52 weeks.
 *
 * - Base: hourly offers are rate × hours/week × 52; annual offers are the salary.
 * - Overtime: the user's *expected* weekly overtime hours at 1.5× the (equivalent) hourly rate.
 *   Never guaranteed; kept out of the guaranteed base and labeled wherever it appears.
 * - Bonuses: the annual bonus recurs; the signing bonus is one-time (first year only).
 * - Benefits: the user's own estimate of the employer-paid value; only added in total comp.
 */
import type { SalaryPeriod } from "@/generated/prisma/enums";
import { OT_TIER_1, WEEKS_PER_YEAR, annualToHourly } from "@/lib/salary/pay";

export type OfferNumbers = {
  baseAmount: number;
  period: SalaryPeriod;
  hoursPerWeek: number;
  overtimeHours: number;
  signingBonus: number | null;
  annualBonus: number | null;
  benefitsValue: number | null;
};

export type AnnualizedOffer = {
  /** Guaranteed base pay per year. */
  annualBase: number;
  /** Regular hourly rate (hourly offers) or the hourly equivalent of a salary. */
  hourlyRate: number;
  /** Expected (not guaranteed) overtime pay per year. */
  overtimeExpected: number;
  annualBonus: number;
  /** One-time; counted in the first year only. */
  signingBonus: number;
  /** User-estimated benefits value per year. */
  benefits: number;
  /** Base + expected overtime + annual bonus (recurring cash, before taxes). */
  cashRecurring: number;
  /** Recurring cash + benefits. */
  totalComp: number;
  /** Total comp + the one-time signing bonus. */
  totalCompYear1: number;
};

const nonNeg = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function annualizeOffer(o: OfferNumbers): AnnualizedOffer {
  const hours = nonNeg(o.hoursPerWeek);
  const annualBase = o.period === "HOURLY" ? nonNeg(o.baseAmount) * hours * WEEKS_PER_YEAR : nonNeg(o.baseAmount);
  const hourlyRate = o.period === "HOURLY" ? nonNeg(o.baseAmount) : annualToHourly(annualBase, hours);
  const overtimeExpected = hourlyRate * OT_TIER_1 * nonNeg(o.overtimeHours) * WEEKS_PER_YEAR;
  const annualBonus = nonNeg(o.annualBonus);
  const signingBonus = nonNeg(o.signingBonus);
  const benefits = nonNeg(o.benefitsValue);
  const cashRecurring = annualBase + overtimeExpected + annualBonus;
  const totalComp = cashRecurring + benefits;
  return { annualBase, hourlyRate, overtimeExpected, annualBonus, signingBonus, benefits, cashRecurring, totalComp, totalCompYear1: totalComp + signingBonus };
}

export type OfferGap = { target: number; label: string; baseGap: number; totalGap: number };

/** Gap from the guaranteed base and from total comp to each target (positive = short of it). */
export function offerGaps(a: AnnualizedOffer, targets: { label: string; amount: number }[]): OfferGap[] {
  return targets
    .filter((t) => Number.isFinite(t.amount) && t.amount > 0)
    .map((t) => ({ target: t.amount, label: t.label, baseGap: t.amount - a.annualBase, totalGap: t.amount - a.totalComp }));
}

/** Index of the offer with the highest value for a metric (ties → first), or -1. */
export function bestIndex(offers: AnnualizedOffer[], key: keyof AnnualizedOffer): number {
  let best = -1;
  for (let i = 0; i < offers.length; i++) if (best === -1 || offers[i]![key] > offers[best]![key]) best = i;
  return best;
}
