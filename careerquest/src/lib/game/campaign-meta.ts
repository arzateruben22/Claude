/**
 * Operation Get Hired campaign metadata (CampaignState(GET_HIRED).metadata). Pure parse/merge
 * helpers. Keys owned by the game engine: `employment`, `pastEmployment`, `paychecks`,
 * `nextPhasePlan`. Every other key (e.g. `restarts`, written by the profile service) is preserved.
 *
 * Everything stored here is self-reported by the user and is labelled that way in the UI.
 */
import type { SalaryPeriod } from "@/generated/prisma/enums";

export type Employment = {
  employer: string;
  title: string | null;
  /** YYYY-MM-DD */
  startDate: string;
  amount: number;
  period: SalaryPeriod;
  hoursPerWeek: number;
  /** amount annualized (hourly × hours/week × 52). */
  annualized: number;
  reportedAt: string;
};

export type PastEmployment = Employment & { endedAt: string };

export type Paycheck = { id: string; amount: number; /** YYYY-MM-DD */ payDate: string; loggedAt: string };

export type NextPhasePlan = { text: string; updatedAt: string };

export type GetHiredMeta = {
  employment: Employment | null;
  pastEmployment: PastEmployment[];
  paychecks: Paycheck[];
  nextPhasePlan: NextPhasePlan | null;
};

export const MAX_PAYCHECKS = 520;
export const MAX_PAST_EMPLOYMENT = 20;
export const MAX_PLAN_LENGTH = 4000;

const KEY = /^\d{4}-\d{2}-\d{2}$/;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

function readEmployment(v: unknown): Employment | null {
  const o = obj(v);
  const employer = str(o.employer)?.trim();
  const startDate = str(o.startDate);
  const amount = num(o.amount);
  const period = o.period === "HOURLY" || o.period === "ANNUAL" ? o.period : null;
  const annualized = num(o.annualized);
  const reportedAt = iso(o.reportedAt);
  if (!employer || !startDate || !KEY.test(startDate) || amount === null || !period || annualized === null || !reportedAt) return null;
  return {
    employer,
    title: str(o.title)?.trim() || null,
    startDate,
    amount,
    period,
    hoursPerWeek: num(o.hoursPerWeek) ?? 40,
    annualized,
    reportedAt,
  };
}

export function readGetHiredMeta(value: unknown): GetHiredMeta {
  const o = obj(value);
  const past = Array.isArray(o.pastEmployment) ? o.pastEmployment : [];
  const checks = Array.isArray(o.paychecks) ? o.paychecks : [];
  const plan = obj(o.nextPhasePlan);
  const planText = str(plan.text);
  const planAt = iso(plan.updatedAt);
  return {
    employment: readEmployment(o.employment),
    pastEmployment: past
      .map((p) => {
        const e = readEmployment(p);
        const endedAt = iso(obj(p).endedAt);
        return e && endedAt ? { ...e, endedAt } : null;
      })
      .filter((p): p is PastEmployment => p !== null),
    paychecks: checks
      .map((p) => {
        const c = obj(p);
        const id = str(c.id);
        const amount = num(c.amount);
        const payDate = str(c.payDate);
        const loggedAt = iso(c.loggedAt);
        return id && amount !== null && amount > 0 && payDate && KEY.test(payDate) && loggedAt ? { id, amount, payDate, loggedAt } : null;
      })
      .filter((p): p is Paycheck => p !== null),
    nextPhasePlan: planText !== null && planAt ? { text: planText, updatedAt: planAt } : null,
  };
}

/** Merge a patch into existing metadata JSON, keeping keys this module does not own. */
export function mergeGetHiredMeta(existing: unknown, patch: Partial<GetHiredMeta>): Record<string, unknown> {
  const base = { ...obj(existing) };
  if ("employment" in patch) base.employment = patch.employment ?? null;
  if (patch.pastEmployment) base.pastEmployment = patch.pastEmployment.slice(-MAX_PAST_EMPLOYMENT);
  if (patch.paychecks) base.paychecks = patch.paychecks.slice(-MAX_PAYCHECKS);
  if ("nextPhasePlan" in patch) base.nextPhasePlan = patch.nextPhasePlan ?? null;
  return base;
}

/** Whether a saved plan counts for a window [from, to): long enough and written inside it. */
export function planCountsInWindow(plan: NextPhasePlan | null, from: Date, to: Date, minLength: number): boolean {
  if (!plan || plan.text.trim().length < minLength) return false;
  const t = Date.parse(plan.updatedAt);
  return t >= from.getTime() && t < to.getTime();
}

export function sumPaychecks(paychecks: readonly Paycheck[]): number {
  return Math.round(paychecks.reduce((a, p) => a + p.amount, 0) * 100) / 100;
}
