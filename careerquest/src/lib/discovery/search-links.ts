/**
 * Outbound job-board search links (pure, client-safe).
 *
 * CareerQuest does not scrape or query job boards. These are ordinary search-page links built from
 * each board's public search URL pattern; they open on the board's own site in a new tab, where the
 * user searches and applies. Nothing comes back into CareerQuest unless the user pastes a link.
 */
import type { PrimaryTrade } from "@/generated/prisma/enums";
import { DEFAULT_REGIONS } from "@/lib/profile/constants";
import { PRIMARY_TRADE_INTEREST, TRADE_VOCABULARY, orderedInterests } from "./trades";

export type SearchBoardKey = "indeed" | "linkedin" | "ziprecruiter" | "glassdoor" | "governmentjobs" | "usajobs" | "calcareers";

type Board = {
  key: SearchBoardKey;
  label: string;
  /** Whole-state board without a usable location parameter (one link per search phrase). */
  statewide: boolean;
  note: string;
  build: (query: string, location: string) => string;
};

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const SEARCH_BOARDS: readonly Board[] = [
  { key: "indeed", label: "Indeed", statewide: false, note: "Private employers and contractors", build: (q, l) => `https://www.indeed.com/jobs?${qs({ q, l })}` },
  {
    key: "linkedin",
    label: "LinkedIn Jobs",
    statewide: false,
    note: "Private employers; many postings use Easy Apply",
    build: (q, l) => `https://www.linkedin.com/jobs/search/?${qs({ keywords: q, location: l })}`,
  },
  {
    key: "ziprecruiter",
    label: "ZipRecruiter",
    statewide: false,
    note: "Private employers and staffing agencies",
    build: (q, l) => `https://www.ziprecruiter.com/jobs-search?${qs({ search: q, location: l })}`,
  },
  {
    key: "glassdoor",
    label: "Glassdoor",
    statewide: false,
    note: "Postings with employer reviews",
    build: (q, l) => `https://www.glassdoor.com/Job/jobs.htm?${qs({ "sc.keyword": q, locKeyword: l })}`,
  },
  {
    key: "governmentjobs",
    label: "GovernmentJobs",
    statewide: false,
    note: "City, county, school-district and utility jobs (NEOGOV)",
    build: (q, l) => `https://www.governmentjobs.com/jobs?${qs({ keyword: q, location: l })}`,
  },
  { key: "usajobs", label: "USAJOBS", statewide: false, note: "Federal jobs", build: (q, l) => `https://www.usajobs.gov/Search/Results?${qs({ k: q, l })}` },
  {
    key: "calcareers",
    label: "CalCareers",
    statewide: true,
    note: "State of California jobs; filter by county on the site",
    build: (q) => `https://www.calcareers.ca.gov/CalHrPublic/Search/JobSearchResults.aspx#kw=${encodeURIComponent(q)}`,
  },
];

export const MAX_SEARCH_REGIONS = 6;

export type SearchLink = { board: SearchBoardKey; label: string; href: string };
export type RegionSearch = { region: string; links: SearchLink[] };
export type SearchGroup = {
  /** Interest label, e.g. "Electrician" or "Electrician (apprenticeship)". */
  label: string;
  query: string;
  apprenticeship: boolean;
  regions: RegionSearch[];
  statewide: SearchLink[];
};

export type SearchPlanProfile = {
  primaryTrade: PrimaryTrade;
  careerInterests: readonly string[];
  regions: readonly string[];
  openToApprenticeships: boolean;
};

function group(label: string, query: string, apprenticeship: boolean, regions: readonly string[]): SearchGroup {
  return {
    label,
    query,
    apprenticeship,
    regions: regions.map((region) => ({
      region,
      links: SEARCH_BOARDS.filter((b) => !b.statewide).map((b) => ({ board: b.key, label: b.label, href: b.build(query, region) })),
    })),
    statewide: SEARCH_BOARDS.filter((b) => b.statewide).map((b) => ({ board: b.key, label: b.label, href: b.build(query, "") })),
  };
}

/** One group per interest (primary trade first) × the user's regions; plus an apprenticeship search. */
export function buildSearchPlan(profile: SearchPlanProfile): SearchGroup[] {
  const regions = (profile.regions.length ? profile.regions : DEFAULT_REGIONS).slice(0, MAX_SEARCH_REGIONS);
  const interests = orderedInterests(profile.primaryTrade, profile.careerInterests);
  const groups: SearchGroup[] = [];
  const primary = PRIMARY_TRADE_INTEREST[profile.primaryTrade];
  for (const interest of interests) {
    const vocab = TRADE_VOCABULARY[interest];
    groups.push(group(interest, vocab.query, false, regions));
    if (interest === primary && profile.openToApprenticeships && vocab.apprenticeQuery) {
      groups.push(group(`${interest} (apprenticeship)`, vocab.apprenticeQuery, true, regions));
    }
  }
  return groups;
}
