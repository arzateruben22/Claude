/**
 * Achievement catalog. Pure: each achievement is a condition over `AchievementFacts`, a snapshot of
 * persisted data assembled by `loadAchievementFacts` (src/lib/game/achievements.ts). The same
 * function decides unlocks and drives the locked cards' progress bars, so they can never disagree.
 *
 * Honesty: offers count only when verified, training hours only when employer-verified or from an
 * official record, certification only when self-attested *with* a certificate document, salary
 * milestones only from an accepted offer or a self-reported current salary (annualized).
 */
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

/** lucide-react icon names, resolved to components in src/components/game/icons.tsx. */
export type AchievementIcon =
  | "send"
  | "layers"
  | "rocket"
  | "trophy"
  | "crown"
  | "message"
  | "mic"
  | "badge-check"
  | "wallet"
  | "hard-hat"
  | "clock"
  | "zap"
  | "award"
  | "trending-up"
  | "gem"
  | "calendar-check"
  | "flame";

export type AchievementFacts = {
  /** Distinct positions with an APPLIED event (merged duplicates excluded). */
  distinctApplications: number;
  recruiterResponses: number;
  /** Applications with an interview scheduled or held. */
  interviews: number;
  /** OFFER_RECEIVED events that are verified (user-confirmed or evidence-backed). */
  verifiedOffers: number;
  /** PlayerStats.careerEarnings (self-reported paychecks). */
  careerEarnings: number;
  acceptedPrograms: number;
  /** EMPLOYER_VERIFIED + OFFICIAL_RECORD hours. */
  verifiedHours: number;
  fundamentalsCompleted: number;
  fundamentalsTotal: number;
  /** CertificationStatus.certifiedAt set AND a CERTIFICATE document exists. */
  certifiedWithDocument: boolean;
  /** Best of accepted offers (annualized) and PlayerStats.currentSalary; null when neither exists. */
  annualizedSalary: number | null;
  /** Most workdays with an application inside a single Monday–Sunday week. */
  bestWeekWorkdays: number;
  longestStreak: number;
};

export type FactKey = keyof AchievementFacts;

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  /** The facts this achievement needs (lets evaluation skip queries for unlocked achievements). */
  facts: FactKey[];
  /** Plain-language condition shown on locked cards. */
  condition: string;
  progress: (f: AchievementFacts) => { current: number; target: number };
  /** Optional honesty label shown on the card (e.g. "Self-reported"). */
  label?: string;
};

export const APPLICATION_COUNT_ACHIEVEMENTS: readonly { key: string; title: string; n: number; tier: AchievementTier; icon: AchievementIcon }[] = [
  { key: "first-application", title: "First Application", n: 1, tier: "bronze", icon: "send" },
  { key: "ten-applications", title: "Ten Applications", n: 10, tier: "bronze", icon: "layers" },
  { key: "fifty-applications", title: "Fifty Applications", n: 50, tier: "silver", icon: "rocket" },
  { key: "applications-100", title: "100 Applications", n: 100, tier: "silver", icon: "trophy" },
  { key: "applications-250", title: "250 Applications", n: 250, tier: "gold", icon: "trophy" },
  { key: "applications-500", title: "500 Applications", n: 500, tier: "gold", icon: "trophy" },
  { key: "applications-1000", title: "1,000 Applications", n: 1000, tier: "platinum", icon: "crown" },
  { key: "applications-2500", title: "2,500 Applications", n: 2500, tier: "platinum", icon: "crown" },
  { key: "applications-5000", title: "5,000 Applications", n: 5000, tier: "platinum", icon: "crown" },
  { key: "applications-10000", title: "10,000 Applications", n: 10000, tier: "platinum", icon: "crown" },
];

export const SIX_FIGURES = 100_000;
export const CAREER_150K = 150_000;
export const VERIFIED_HOURS_ACHIEVEMENT = 1000;
export const WEEK_WARRIOR_DAYS = 5;

const fmt = (n: number) => n.toLocaleString("en-US");
const bool = (b: boolean) => ({ current: b ? 1 : 0, target: 1 });

export const ACHIEVEMENTS: AchievementDef[] = [
  ...APPLICATION_COUNT_ACHIEVEMENTS.map(
    (a): AchievementDef => ({
      key: a.key,
      title: a.title,
      description:
        a.n === 1 ? "You applied to your first position. The campaign has begun." : `You have applied to ${fmt(a.n)} distinct positions.`,
      icon: a.icon,
      tier: a.tier,
      facts: ["distinctApplications"],
      condition: `Apply to ${fmt(a.n)} distinct ${a.n === 1 ? "position" : "positions"} (merged duplicates count once)`,
      progress: (f) => ({ current: f.distinctApplications, target: a.n }),
    }),
  ),
  {
    key: "first-recruiter-response",
    title: "First Recruiter Response",
    description: "An employer answered. Your applications are being read.",
    icon: "message",
    tier: "bronze",
    facts: ["recruiterResponses"],
    condition: "Record a recruiter or employer response on an application",
    progress: (f) => ({ current: Math.min(1, f.recruiterResponses), target: 1 }),
  },
  {
    key: "first-interview",
    title: "First Interview",
    description: "You earned a conversation. Prep, show up, learn.",
    icon: "mic",
    tier: "silver",
    facts: ["interviews"],
    condition: "Schedule or attend an interview",
    progress: (f) => ({ current: Math.min(1, f.interviews), target: 1 }),
  },
  {
    key: "first-job-offer",
    title: "First Job Offer",
    description: "A verified job offer. That is real leverage.",
    icon: "badge-check",
    tier: "gold",
    facts: ["verifiedOffers"],
    condition: "Receive a verified offer (confirmed by you or backed by evidence)",
    progress: (f) => ({ current: Math.min(1, f.verifiedOffers), target: 1 }),
    label: "Verified offers only",
  },
  {
    key: "first-paycheck",
    title: "First Paycheck",
    description: "Money in the bank from your work.",
    icon: "wallet",
    tier: "gold",
    facts: ["careerEarnings"],
    condition: "Log a paycheck on the Campaign page",
    progress: (f) => bool(f.careerEarnings > 0),
    label: "Self-reported",
  },
  {
    key: "apprenticeship-accepted",
    title: "Apprenticeship Accepted",
    description: "You were accepted into an apprenticeship program.",
    icon: "hard-hat",
    tier: "platinum",
    facts: ["acceptedPrograms"],
    condition: "Mark an apprenticeship program as Accepted",
    progress: (f) => ({ current: Math.min(1, f.acceptedPrograms), target: 1 }),
    label: "Self-reported",
  },
  {
    key: "verified-hours-1000",
    title: "1,000 Verified Training Hours",
    description: "A thousand documented hours on the path to certification.",
    icon: "clock",
    tier: "gold",
    facts: ["verifiedHours"],
    condition: "Reach 1,000 employer-verified or official-record work hours (self-reported hours do not count)",
    progress: (f) => ({ current: Math.floor(f.verifiedHours), target: VERIFIED_HOURS_ACHIEVEMENT }),
    label: "Verified hours only",
  },
  {
    key: "electrical-fundamentals",
    title: "Electrical Fundamentals Completed",
    description: "Every lesson in the Fundamentals track, done.",
    icon: "zap",
    tier: "silver",
    facts: ["fundamentalsCompleted", "fundamentalsTotal"],
    condition: "Complete every lesson in the Academy's Fundamentals track",
    progress: (f) =>
      f.fundamentalsTotal > 0 ? { current: Math.min(f.fundamentalsCompleted, f.fundamentalsTotal), target: f.fundamentalsTotal } : { current: 0, target: 1 },
  },
  {
    key: "certified-electrician",
    title: "Certified Electrician",
    description: "Certification recorded with a certificate document (self-attested with document).",
    icon: "award",
    tier: "platinum",
    facts: ["certifiedWithDocument"],
    condition: "Record a certification date on the certification tracker and upload the certificate document",
    progress: (f) => bool(f.certifiedWithDocument),
    label: "Self-attested with document",
  },
  {
    key: "six-figure-career",
    title: "Six-Figure Career",
    description: "An accepted offer or current salary of $100,000+ a year (hourly × hours/week × 52).",
    icon: "trending-up",
    tier: "platinum",
    facts: ["annualizedSalary"],
    condition: "Accept an offer or report a current salary of at least $100,000 per year",
    progress: (f) => ({ current: Math.round(f.annualizedSalary ?? 0), target: SIX_FIGURES }),
    label: "Accepted offer or self-reported salary",
  },
  {
    key: "career-150k",
    title: "$150K Career Milestone",
    description: "An accepted offer or current salary of $150,000+ a year (hourly × hours/week × 52).",
    icon: "gem",
    tier: "platinum",
    facts: ["annualizedSalary"],
    condition: "Accept an offer or report a current salary of at least $150,000 per year",
    progress: (f) => ({ current: Math.round(f.annualizedSalary ?? 0), target: CAREER_150K }),
    label: "Accepted offer or self-reported salary",
  },
  {
    key: "week-warrior",
    title: "Week Warrior",
    description: "Applications on five workdays of a single week.",
    icon: "calendar-check",
    tier: "silver",
    facts: ["bestWeekWorkdays"],
    condition: "Apply on 5 workdays within one Monday–Sunday week",
    progress: (f) => ({ current: Math.min(f.bestWeekWorkdays, WEEK_WARRIOR_DAYS), target: WEEK_WARRIOR_DAYS }),
  },
  {
    key: "streak-7",
    title: "7-Day Streak",
    description: "Seven workdays in a row with real activity. Rest days never break it.",
    icon: "flame",
    tier: "silver",
    facts: ["longestStreak"],
    condition: "Reach a 7-workday streak (rest days and weekends are skipped, not counted against you)",
    progress: (f) => ({ current: Math.min(f.longestStreak, 7), target: 7 }),
  },
  {
    key: "streak-30",
    title: "30-Day Streak",
    description: "Thirty workdays in a row with real activity.",
    icon: "flame",
    tier: "gold",
    facts: ["longestStreak"],
    condition: "Reach a 30-workday streak (rest days and weekends are skipped, not counted against you)",
    progress: (f) => ({ current: Math.min(f.longestStreak, 30), target: 30 }),
  },
];

export const ACHIEVEMENT_BY_KEY: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

export type AchievementStatus = { def: AchievementDef; current: number; target: number; unlocked: boolean; ratio: number };

export function achievementStatus(def: AchievementDef, facts: AchievementFacts): AchievementStatus {
  const { current, target } = def.progress(facts);
  const safeTarget = Math.max(1, target);
  const cur = Math.max(0, Number.isFinite(current) ? current : 0);
  return { def, current: cur, target: safeTarget, unlocked: cur >= safeTarget, ratio: Math.min(1, cur / safeTarget) };
}

/** Keys of achievements whose conditions are satisfied by the facts. */
export function satisfiedAchievementKeys(facts: AchievementFacts, defs: readonly AchievementDef[] = ACHIEVEMENTS): string[] {
  return defs.filter((d) => achievementStatus(d, facts).unlocked).map((d) => d.key);
}

/** Annualize a pay amount: hourly × hours per week × 52, or the annual amount itself. */
export function annualize(amount: number, period: "HOURLY" | "ANNUAL", hoursPerWeek = 40): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (period === "HOURLY") {
    const h = Number.isFinite(hoursPerWeek) && hoursPerWeek > 0 ? Math.min(hoursPerWeek, 100) : 40;
    return Math.round(amount * h * 52 * 100) / 100;
  }
  return Math.round(amount * 100) / 100;
}

/** Most planned workdays with an application inside one Monday–Sunday week. */
export function bestWeekWorkdays(dayKeys: readonly string[], isWorkday: (key: string) => boolean, weekOf: (key: string) => string): number {
  const weeks = new Map<string, Set<string>>();
  for (const key of dayKeys) {
    if (!isWorkday(key)) continue;
    const w = weekOf(key);
    const set = weeks.get(w) ?? new Set<string>();
    set.add(key);
    weeks.set(w, set);
  }
  let best = 0;
  for (const set of weeks.values()) best = Math.max(best, set.size);
  return best;
}

export const TIER_LABELS: Record<AchievementTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
