/**
 * Transparent 0–100 fit score for a job lead (pure, client-safe).
 *
 * Four factors, each with its own maximum and a one-line explanation of the points given:
 *   Trade fit     40 — the title/category matches the primary trade (40) or another interest (25)
 *   Region        25 — the location is in one of the user's regions (25); remote (10); elsewhere in CA (5)
 *   Pay           25 — compared with the immediate salary target (or the apprenticeship minimum)
 *   Eligibility   10 — no flagged requirement the user filters out
 * It is an estimate from the user's own settings and the lead's text; it says nothing about the
 * odds of being hired.
 */
import type { PrimaryTrade } from "@/generated/prisma/enums";
import { parseSalaryText } from "@/lib/ingest/rules";
import { ELIGIBILITY_FLAG_LABELS, flagsOf, hiddenByFilters, type EligibilityFlags, type EligibilityPrefs } from "./eligibility";
import { matchRegion } from "./regions";
import { PRIMARY_TRADE_INTEREST, isApprenticeshipText, orderedInterests, tradesInText } from "./trades";

export const SCORE_MAX = { trade: 40, region: 25, pay: 25, eligibility: 10 } as const;
/** Annualizing hourly pay: 40 hours × 52 weeks (an estimate; overtime and unpaid weeks ignored). */
export const HOURS_PER_YEAR = 2080;

export type ScoreFactorKey = keyof typeof SCORE_MAX;

export type ScoreFactor = {
  key: ScoreFactorKey;
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type LeadScore = { score: number; factors: ScoreFactor[] };

export type ScoreProfile = EligibilityPrefs & {
  primaryTrade: PrimaryTrade;
  careerInterests: readonly string[];
  regions: readonly string[];
  immediateSalaryTarget: number;
  openToApprenticeships: boolean;
  apprenticeshipMinHourly: number | null;
};

export type ScoreLead = Partial<EligibilityFlags> & {
  title: string;
  category?: string | null;
  location?: string | null;
  salaryText?: string | null;
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const usdHr = (n: number) => `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}/hr`;

function tradeFactor(lead: ScoreLead, profile: ScoreProfile): ScoreFactor {
  const base = { key: "trade" as const, label: "Trade fit", max: SCORE_MAX.trade };
  const text = `${lead.title} ${lead.category ?? ""}`;
  const found = tradesInText(text);
  const primary = PRIMARY_TRADE_INTEREST[profile.primaryTrade];
  if (primary && found.includes(primary)) {
    return { ...base, points: SCORE_MAX.trade, detail: `The title matches your primary trade (${primary}).` };
  }
  const interests = orderedInterests(profile.primaryTrade, profile.careerInterests);
  const other = interests.find((i) => found.includes(i));
  if (other) return { ...base, points: 25, detail: `The title matches one of your interests (${other}).` };
  if (!interests.length) return { ...base, points: 0, detail: "Set your trade and interests in Settings to score trade fit." };
  return { ...base, points: 0, detail: `The title does not mention ${interests.slice(0, 3).join(", ")}${interests.length > 3 ? "…" : ""}.` };
}

function regionFactor(lead: ScoreLead, profile: ScoreProfile): ScoreFactor {
  const base = { key: "region" as const, label: "Region", max: SCORE_MAX.region };
  const m = matchRegion(lead.location, profile.regions);
  const points = m.kind === "region" ? SCORE_MAX.region : m.kind === "remote" ? 10 : m.kind === "state" ? 5 : 0;
  return { ...base, points, detail: `${m.reason}.` };
}

function payFactor(lead: ScoreLead, profile: ScoreProfile): ScoreFactor {
  const base = { key: "pay" as const, label: "Pay", max: SCORE_MAX.pay };
  const pay = parseSalaryText(lead.salaryText);
  if (!pay) {
    return {
      ...base,
      points: 0,
      detail: lead.salaryText ? `Could not read an hourly or yearly amount from “${lead.salaryText}”.` : "No pay listed, so it cannot be compared with your target.",
    };
  }
  const low = pay.min;
  const high = pay.max ?? pay.min;
  const apprenticeship = isApprenticeshipText(`${lead.title} ${lead.category ?? ""}`);

  if (apprenticeship && profile.openToApprenticeships) {
    const lowHr = pay.period === "HOURLY" ? low : low / HOURS_PER_YEAR;
    const highHr = pay.period === "HOURLY" ? high : high / HOURS_PER_YEAR;
    const min = profile.apprenticeshipMinHourly;
    if (min === null || min <= 0) {
      return { ...base, points: 15, detail: "Apprenticeship pay listed. Set a minimum hourly rate in Settings to compare it." };
    }
    const range = lowHr === highHr ? usdHr(lowHr) : `${usdHr(lowHr)}–${usdHr(highHr)}`;
    if (lowHr >= min) return { ...base, points: 25, detail: `Apprenticeship pay ${range} meets your ${usdHr(min)} minimum.` };
    if (highHr >= min) return { ...base, points: 15, detail: `The top of ${range} reaches your ${usdHr(min)} minimum.` };
    return { ...base, points: 0, detail: `Apprenticeship pay ${range} is below your ${usdHr(min)} minimum.` };
  }

  const target = profile.immediateSalaryTarget;
  const yearLow = pay.period === "HOURLY" ? low * HOURS_PER_YEAR : low;
  const yearHigh = pay.period === "HOURLY" ? high * HOURS_PER_YEAR : high;
  const range = yearLow === yearHigh ? usd(yearLow) : `${usd(yearLow)}–${usd(yearHigh)}`;
  const shown = pay.period === "HOURLY" ? `${range} a year (estimate: hourly × ${HOURS_PER_YEAR} h)` : `${range} a year`;
  if (target <= 0) return { ...base, points: 15, detail: `${shown}. Set an immediate salary target in Settings to compare.` };
  if (yearLow >= target) return { ...base, points: 25, detail: `${shown} meets your ${usd(target)} target.` };
  if (yearHigh >= target) return { ...base, points: 15, detail: `The top of ${shown} reaches your ${usd(target)} target.` };
  if (yearHigh >= target * 0.85) return { ...base, points: 8, detail: `${shown} is within 15% of your ${usd(target)} target.` };
  return { ...base, points: 0, detail: `${shown} is below your ${usd(target)} target.` };
}

function eligibilityFactor(lead: ScoreLead, profile: ScoreProfile): ScoreFactor {
  const base = { key: "eligibility" as const, label: "Eligibility", max: SCORE_MAX.eligibility };
  const flags = flagsOf(lead);
  const hidden = hiddenByFilters(lead, profile);
  if (hidden.length) {
    return { ...base, points: 0, detail: `Mentions ${hidden.map((f) => ELIGIBILITY_FLAG_LABELS[f].toLowerCase()).join(", ")}, which your private filters exclude.` };
  }
  if (flags.length) {
    return { ...base, points: SCORE_MAX.eligibility, detail: `Mentions ${flags.map((f) => ELIGIBILITY_FLAG_LABELS[f].toLowerCase()).join(", ")}; your filters allow it.` };
  }
  return { ...base, points: SCORE_MAX.eligibility, detail: "No vehicle, driving-record or CDL requirement found in the lead." };
}

export function scoreLead(lead: ScoreLead, profile: ScoreProfile): LeadScore {
  const factors = [tradeFactor(lead, profile), regionFactor(lead, profile), payFactor(lead, profile), eligibilityFactor(lead, profile)];
  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  return { score, factors };
}

export function scoreTone(score: number): "success" | "accent" | "warning" | "neutral" {
  if (score >= 75) return "success";
  if (score >= 50) return "accent";
  if (score >= 25) return "warning";
  return "neutral";
}
