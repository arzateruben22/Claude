/**
 * Eligibility keyword flags for job leads (pure, client-safe).
 *
 * Postings that mention a company vehicle, a driving record / driver's license, or a commercial
 * license are FLAGGED so the user can see why — never rejected. The user's private filters
 * (UserProfile.exclude*) only hide flagged leads behind "Show hidden (n)"; nothing is deleted.
 */

export type EligibilityFlag = "requiresCompanyVehicle" | "requiresDrivingRecord" | "requiresCdl";

export const ELIGIBILITY_FLAGS: readonly EligibilityFlag[] = ["requiresCompanyVehicle", "requiresDrivingRecord", "requiresCdl"];

export const ELIGIBILITY_FLAG_LABELS: Record<EligibilityFlag, string> = {
  requiresCompanyVehicle: "Company vehicle",
  requiresDrivingRecord: "Driver's license / driving record",
  requiresCdl: "CDL (Class A/B)",
};

export type EligibilityFlags = Record<EligibilityFlag, boolean>;

export type EligibilityHit = { flag: EligibilityFlag; phrase: string };

export type EligibilityPrefs = {
  excludeCompanyVehicleJobs: boolean;
  excludeDrivingRecordJobs: boolean;
  excludeCdlJobs: boolean;
};

const APOS = "(?:'|’)?";
const LICENSE = "licen[cs]e";

/** Keyword rules. Each flag has several phrasings; the matched text is reported back. */
const RULES: ReadonlyArray<{ flag: EligibilityFlag; re: RegExp }> = [
  { flag: "requiresCompanyVehicle", re: /\bcompany[\s-]+(?:provided\s+|owned\s+|issued\s+)?(?:vehicle|truck|van|car)s?\b/i },
  { flag: "requiresCompanyVehicle", re: /\btake[\s-]?home\s+(?:vehicle|truck|van)s?\b/i },
  { flag: "requiresCompanyVehicle", re: /\b(?:service|work)\s+(?:vehicle|truck|van)\s+(?:is\s+)?provided\b/i },
  { flag: "requiresDrivingRecord", re: /\b(?:clean|good|acceptable|satisfactory|safe|insurable)\s+(?:dmv\s+|motor\s+vehicle\s+)?driving\s+record\b/i },
  { flag: "requiresDrivingRecord", re: /\bdriving\s+record\b/i },
  { flag: "requiresDrivingRecord", re: new RegExp(`\\b(?:valid|current)\\s+(?:california\\s+|ca\\s+|state\\s+)?driver${APOS}s?\\s+${LICENSE}\\b`, "i") },
  { flag: "requiresDrivingRecord", re: new RegExp(`(?<!commercial\\s)\\bdriver${APOS}s?\\s+${LICENSE}\\b`, "i") },
  { flag: "requiresDrivingRecord", re: /\b(?:mvr|dmv\s+(?:printout|record|report|h6))\b/i },
  { flag: "requiresCdl", re: /\bcdl\b/i },
  { flag: "requiresCdl", re: new RegExp(`\\bcommercial\\s+driver${APOS}s?\\s+${LICENSE}\\b`, "i") },
  {
    flag: "requiresCdl",
    re: new RegExp(`\\bclass\\s+[ab](?:\\s*(?:/|or|and)\\s*[ab])?\\s+(?:cdl|commercial|driver${APOS}s?|${LICENSE})`, "i"),
  },
  { flag: "requiresCdl", re: /\bclass\s+a\s*\/\s*b\b/i },
];

export function emptyFlags(): EligibilityFlags {
  return { requiresCompanyVehicle: false, requiresDrivingRecord: false, requiresCdl: false };
}

/** Flags and the phrases that triggered them (one phrase per distinct wording). */
export function detectEligibility(text: string | null | undefined): { flags: EligibilityFlags; hits: EligibilityHit[] } {
  const flags = emptyFlags();
  const hits: EligibilityHit[] = [];
  const source = (text ?? "").slice(0, 50_000);
  if (!source.trim()) return { flags, hits };
  const seen = new Set<string>();
  for (const rule of RULES) {
    const m = rule.re.exec(source);
    if (!m) continue;
    flags[rule.flag] = true;
    const phrase = m[0].replace(/\s+/g, " ").trim();
    const key = `${rule.flag}:${phrase.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A phrase already reported for this flag inside a longer one ("driving record" within
    // "clean driving record") adds nothing.
    if (hits.some((h) => h.flag === rule.flag && h.phrase.toLowerCase().includes(phrase.toLowerCase()))) continue;
    hits.push({ flag: rule.flag, phrase });
  }
  return { flags, hits };
}

/** Which of the lead's flags the user's private filters exclude (empty → the lead is shown). */
export function hiddenByFilters(lead: Partial<EligibilityFlags>, prefs: EligibilityPrefs): EligibilityFlag[] {
  const out: EligibilityFlag[] = [];
  if (lead.requiresCompanyVehicle && prefs.excludeCompanyVehicleJobs) out.push("requiresCompanyVehicle");
  if (lead.requiresDrivingRecord && prefs.excludeDrivingRecordJobs) out.push("requiresDrivingRecord");
  if (lead.requiresCdl && prefs.excludeCdlJobs) out.push("requiresCdl");
  return out;
}

export function flagsOf(lead: Partial<EligibilityFlags>): EligibilityFlag[] {
  return ELIGIBILITY_FLAGS.filter((f) => Boolean(lead[f]));
}
