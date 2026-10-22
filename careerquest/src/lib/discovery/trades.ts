/**
 * Trade vocabulary for Job Discovery (pure, client-safe): which job titles belong to each career
 * interest, and the search phrase used for outbound job-board links.
 */
import type { PrimaryTrade } from "@/generated/prisma/enums";
import { CAREER_INTEREST_OPTIONS } from "@/lib/validation/profile";

export type CareerInterest = (typeof CAREER_INTEREST_OPTIONS)[number];

type TradeVocabulary = {
  /** Title / category patterns that indicate this trade. */
  keywords: readonly RegExp[];
  /** Search phrase for job boards. */
  query: string;
  /** Search phrase for apprenticeship postings in this trade (null when none is typical). */
  apprenticeQuery: string | null;
};

export const TRADE_VOCABULARY: Record<CareerInterest, TradeVocabulary> = {
  Electrician: {
    keywords: [
      /\belectricians?\b/i,
      /\bwire(?:man|men)\b/i,
      /\belectrical\s+(?:apprentice|helper|technician|tech|worker|installer|foreman|mechanic|trainee|journeyman)\b/i,
      /\blow[\s-]voltage\b/i,
      /\bsolar\s+installer\b/i,
    ],
    query: "electrician",
    apprenticeQuery: "electrician apprentice",
  },
  "Elevator mechanic": {
    keywords: [/\belevators?\b/i, /\bescalators?\b/i, /\bconveyance\b/i],
    query: "elevator mechanic",
    apprenticeQuery: "elevator apprentice",
  },
  "Commercial HVAC": {
    keywords: [/\bhvac(?:[\s/-]?r)?\b/i, /\brefrigeration\b/i, /\bchillers?\b/i, /\bboilers?\b/i, /\bmechanical\s+service\b/i],
    query: "commercial HVAC technician",
    apprenticeQuery: "HVAC apprentice",
  },
  "Industrial maintenance": {
    keywords: [
      /\bmaintenance\s+(?:technician|tech|mechanic|electrician|engineer)\b/i,
      /\bindustrial\s+maintenance\b/i,
      /\bmillwrights?\b/i,
      /\bplc\b/i,
    ],
    query: "industrial maintenance technician",
    apprenticeQuery: "maintenance apprentice",
  },
  "Building engineer": {
    keywords: [
      /\bbuilding\s+(?:engineer|operator|technician)\b/i,
      /\bstationary\s+engineer\b/i,
      /\bchief\s+engineer\b/i,
      /\bfacilit(?:y|ies)\s+(?:engineer|technician|tech)\b/i,
    ],
    query: "building engineer",
    apprenticeQuery: "stationary engineer apprentice",
  },
  "Construction project coordinator": {
    keywords: [/\bproject\s+coordinator\b/i, /\bconstruction\s+coordinator\b/i],
    query: "construction project coordinator",
    apprenticeQuery: null,
  },
  "Construction estimator": {
    keywords: [/\bestimators?\b/i, /\bestimating\b/i],
    query: "construction estimator",
    apprenticeQuery: null,
  },
  "Assistant project manager": {
    keywords: [/\bassistant\s+project\s+manager\b/i, /\bapm\b/i, /\bproject\s+engineer\b/i],
    query: "assistant project manager construction",
    apprenticeQuery: null,
  },
  "Commercial plumbing & pipefitting": {
    keywords: [/\bplumbers?\b/i, /\bplumbing\b/i, /\bpipe\s?fitters?\b/i, /\bpipe\s?fitting\b/i, /\bsteam\s?fitters?\b/i],
    query: "commercial plumber pipefitter",
    apprenticeQuery: "plumber pipefitter apprentice",
  },
};

export const PRIMARY_TRADE_INTEREST: Record<PrimaryTrade, CareerInterest | null> = {
  ELECTRICIAN: "Electrician",
  ELEVATOR_MECHANIC: "Elevator mechanic",
  COMMERCIAL_HVAC: "Commercial HVAC",
  INDUSTRIAL_MAINTENANCE: "Industrial maintenance",
  BUILDING_ENGINEER: "Building engineer",
  CONSTRUCTION_PROJECT_COORDINATOR: "Construction project coordinator",
  CONSTRUCTION_ESTIMATOR: "Construction estimator",
  ASSISTANT_PROJECT_MANAGER: "Assistant project manager",
  COMMERCIAL_PLUMBING_PIPEFITTING: "Commercial plumbing & pipefitting",
  OTHER: null,
};

export function isCareerInterest(value: string): value is CareerInterest {
  return (CAREER_INTEREST_OPTIONS as readonly string[]).includes(value);
}

/** The user's interests in a stable order: primary trade first, then the canonical option order. */
export function orderedInterests(primaryTrade: PrimaryTrade, careerInterests: readonly string[]): CareerInterest[] {
  const primary = PRIMARY_TRADE_INTEREST[primaryTrade];
  const chosen = new Set(careerInterests.filter(isCareerInterest));
  const out: CareerInterest[] = [];
  if (primary) out.push(primary);
  for (const option of CAREER_INTEREST_OPTIONS) if (chosen.has(option) && option !== primary) out.push(option);
  return out;
}

/** Interests whose vocabulary appears in the text. */
export function tradesInText(text: string): CareerInterest[] {
  return CAREER_INTEREST_OPTIONS.filter((option) => TRADE_VOCABULARY[option].keywords.some((re) => re.test(text)));
}

export function isApprenticeshipText(text: string): boolean {
  return /\bapprentice(?:s|ship|ships)?\b|\bpre[\s-]?apprentice/i.test(text);
}
