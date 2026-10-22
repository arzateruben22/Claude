/** Apprenticeship directory labels, badges and filters. Pure (safe for client components). */
import type { ProgramInterestStatus, RecruitmentStatus } from "@/generated/prisma/enums";
import type { Tone } from "@/components/ui/badge";

export const INTEREST_STATUS_ORDER: readonly ProgramInterestStatus[] = [
  "INTERESTED",
  "APPLIED",
  "TESTING",
  "INTERVIEWING",
  "WAITLISTED",
  "ACCEPTED",
  "DECLINED",
];

export const INTEREST_STATUS_LABELS: Record<ProgramInterestStatus, string> = {
  INTERESTED: "Interested",
  APPLIED: "Applied",
  TESTING: "Testing",
  INTERVIEWING: "Interviewing",
  WAITLISTED: "Waitlisted / ranked",
  ACCEPTED: "Accepted",
  DECLINED: "Declined / not accepted",
};

export const INTEREST_STATUS_HINTS: Record<ProgramInterestStatus, string> = {
  INTERESTED: "Saved to compare; nothing submitted yet.",
  APPLIED: "You submitted the program's application.",
  TESTING: "Scheduled for or taking the aptitude test.",
  INTERVIEWING: "Oral interview or ranking stage.",
  WAITLISTED: "On the ranked eligibility list or waitlist.",
  ACCEPTED: "The program accepted you (self-reported).",
  DECLINED: "Not accepted, or you withdrew.",
};

export const INTEREST_STATUS_TONES: Record<ProgramInterestStatus, Tone> = {
  INTERESTED: "neutral",
  APPLIED: "info",
  TESTING: "accent",
  INTERVIEWING: "accent",
  WAITLISTED: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
};

/** Statuses that mean an application was submitted. */
export const SUBMITTED_STATUSES: readonly ProgramInterestStatus[] = ["APPLIED", "TESTING", "INTERVIEWING", "WAITLISTED", "ACCEPTED", "DECLINED"];

export type RecruitmentBadge = { label: string; tone: Tone; description: string };

/**
 * OPEN is shown only when the seeded record says OPEN (the seed refuses OPEN without a date and a
 * source). UNVERIFIED never reads as open.
 */
export function recruitmentBadge(status: RecruitmentStatus): RecruitmentBadge {
  switch (status) {
    case "OPEN":
      return { label: "Open", tone: "success", description: "An official program page stated an application window that included the verification date." };
    case "CLOSED":
      return { label: "Closed", tone: "neutral", description: "The last application window stated on an official page has passed." };
    default:
      return {
        label: "Unverified — check the program site",
        tone: "warning",
        description: "No dated application window was found on an official page. Confirm with the program before planning around it.",
      };
  }
}

export type UnionFilter = "union" | "non-union";

export const UNION_FILTERS: readonly { value: UnionFilter; label: string }[] = [
  { value: "union", label: "Union (JATC / JAC)" },
  { value: "non-union", label: "Non-union / merit shop" },
];

export type ProgramFilters = { region: string | null; union: UnionFilter | null };

export function parseProgramFilters(sp: Record<string, string | string[] | undefined>, regions: readonly string[]): ProgramFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const region = first(sp.region);
  const union = first(sp.union);
  return {
    region: regions.includes(region) ? region : null,
    union: union === "union" || union === "non-union" ? union : null,
  };
}

export function matchesProgramFilters(p: { region: string; isUnion: boolean }, f: ProgramFilters): boolean {
  return (!f.region || p.region === f.region) && (!f.union || (f.union === "union" ? p.isUnion : !p.isUnion));
}

export function formatDuration(years: number | null): string | null {
  if (years === null || !Number.isFinite(years) || years <= 0) return null;
  const months = Math.round(years * 12);
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? "" : "s"}`;
  return `${(Math.round(years * 10) / 10).toString()} years (${months} months)`;
}
