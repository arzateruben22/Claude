/**
 * Job Finder ranking engine (pure, no I/O).
 *
 * Input: postings found by a web-search sweep, each with an independent verification verdict.
 * Output: a transparent 0–100 fit score against the applicant's stated goals, a list assignment
 * (best fit / stretch / ruled out) and the reason for every exclusion. Nothing here invents data:
 * a posting that was not independently confirmed on the employer's own site is ruled out, and a
 * posting with a mandatory requirement the applicant lacks is never presented as a match.
 */

import { PAY_RULE, locate, proximityValue, targetHourly, type Area } from "./geo";

export type Tier = "best_fit" | "stretch";
export type AiLevel = "low" | "medium" | "high";
export type ListName = "best_fit" | "stretch" | "below_pay" | "ruled_out";

export type Evidence = { quote: string; sourceUrl: string };

export type Candidate = {
  tier: Tier;
  employer: string;
  title: string;
  field: string;
  city: string;
  county: string;
  payText: string;
  payMinAnnual?: number | null;
  payMaxAnnual?: number | null;
  employmentType?: string;
  postingUrl: string;
  applyHost: string;
  requisitionId?: string | null;
  postedDate?: string | null;
  closingDate?: string | null;
  minimumRequirements: string[];
  preferredQualifications?: string[];
  drivingRequirement: string;
  unionOrProgram?: string | null;
  progression?: string | null;
  whyFit: string;
  evidence: Evidence[];
  openConfidence: number;
  notes?: string;
};

export type Verdict = {
  isReal: boolean;
  stillOpenConfidence: number;
  directEmployerApply: boolean;
  inLaOrOc: boolean;
  problems: string[];
  verdictReason: string;
  corrected?: Partial<
    Pick<Candidate, "title" | "city" | "payText" | "payMinAnnual" | "payMaxAnnual" | "postingUrl" | "postedDate" | "closingDate" | "drivingRequirement" | "minimumRequirements">
  >;
  independentEvidence: Evidence[];
  /** First runs (no resume): what a beginner probably lacks. */
  gapsForBeginner?: string[];
  /** Resume runs: only the posted requirements the applicant's resume does not show. */
  gapsForApplicant?: string[];
  /** Resume runs: every posted minimum judged against the resume. */
  requirementMatch?: { requirement: string; status: "met" | "partly" | "not_shown"; resumeEvidence: string }[];
  /** Resume runs: 0..1 share of the posted minimums the resume demonstrably meets. */
  resumeFit?: number;
  resumeFitReason?: string;
  aiExposure: { level: AiLevel; reason: string };
  coverLetter?: string;
  resumeEmphasis: string[];
  doNotClaim: string[];
};

export type RawRow = Candidate & { slice: string; verdict: Verdict | null };

export type Factor = { value: number; weight: number; points: number; note: string };

export type ScoredJob = Candidate & {
  id: string;
  slice: string;
  verdict: Verdict | null;
  gaps: Gaps;
  /** True only when an independent second pass actually ran its own searches for this posting. */
  checked: boolean;
  score: number;
  breakdown: Record<"access" | "pay" | "interest" | "ai" | "open" | "distance" | "driving", Factor>;
  /** "LA" or "OC", from where the work is done. */
  area: Area;
  /** Straight-line miles from the home base (estimate), and whether the place had to be assumed. */
  milesFromHome: number;
  locationEstimated: boolean;
  placeName: string;
  /** Hourly pay the applicant's distance rule asks for here, and the posting's range in hourly terms. */
  targetHourly: number;
  payMinHourly: number | null;
  payMaxHourly: number | null;
  list: ListName;
  ruledOutReason: string | null;
  needsOpenCheck: boolean;
  /** "resume" when fit was judged against the applicant's actual resume, "goals" when it was assumed. */
  fitBasis: "resume" | "goals";
};

export const TARGET_ANNUAL = 80_000;
/** Below this share of posted minimums shown on the resume, a posting is left out rather than called a stretch. */
export const MIN_RESUME_FIT = 0.35;

export const WEIGHTS = { access: 0.22, pay: 0.2, interest: 0.16, ai: 0.12, open: 0.14, distance: 0.1, driving: 0.06 } as const;

/** Stated priority order of the applicant's fields of interest. */
export const FIELD_INTEREST: Record<string, number> = {
  electrical: 1,
  elevator: 0.95,
  hvac: 0.9,
  industrial_maintenance: 0.88,
  building_engineer: 0.88,
  utilities_operations: 0.85,
  plumbing_pipefitting: 0.82,
  construction_office: 0.75,
  other_trade: 0.7,
  // Role families used once the resume was available; a found-once lead falls back on these.
  dispatch_scheduling: 0.9,
  project_coordination: 0.9,
  safety_compliance: 0.88,
  operations_logistics: 0.82,
  executive_admin: 0.7,
};

export const FIELD_LABELS: Record<string, string> = {
  electrical: "Electrical",
  elevator: "Elevator",
  hvac: "Commercial HVAC",
  industrial_maintenance: "Industrial maintenance",
  building_engineer: "Building engineering",
  utilities_operations: "Utilities & operations",
  plumbing_pipefitting: "Plumbing & pipefitting",
  construction_office: "Construction office",
  other_trade: "Other trade",
  dispatch_scheduling: "Dispatch & field scheduling",
  project_coordination: "Project coordination",
  safety_compliance: "Safety & compliance",
  operations_logistics: "Operations & logistics",
  executive_admin: "Executive & office administration",
};

const DRIVING_VALUE: Record<string, number> = {
  "none stated": 1,
  unknown: 0.85,
  "valid driver license required": 0.8,
  "clean DMV record or company vehicle": 0.6,
  "CDL required": 0.4,
};

const AI_VALUE: Record<AiLevel, number> = { low: 1, medium: 0.6, high: 0.25 };

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Small stable hash (FNV-1a) so ids survive re-runs without a crypto dependency. */
export function stableId(...parts: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join("|").toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

export type Gaps = {
  /** A credential the law or the employer makes mandatory (licence, certification, degree). Blocks the job. */
  hard: string[];
  /** Experience or preferences the applicant may lack. Makes the job a stretch, never a block. */
  soft: string[];
  /** What the posting says about driving. Flagged, never assumed about the applicant. */
  driving: string[];
  /** Paperwork and conditions to have ready (ID, diploma, residency), not qualification gaps. */
  confirm: string[];
  /** Conditions of the job to be comfortable with (shifts, physical work, own tools, screening). Not gaps. */
  conditions: string[];
  /** Items the posting calls preferred or desired. Shown, and counted only lightly. */
  preferred: string[];
};

/** Legal eligibility (citizenship, export-control "U.S. person" status, clearance, work authorization): the
 * applicant's status is never assumed, so these are things to confirm, not qualification gaps. */
const ELIGIBILITY_RE = /export[- ]control|\bitar\b|u\.?s\.? person|citizenship|\bcitizen\b|security clearance|\bclearance\b|work authori[sz]ation|authori[sz]ed to work|sponsorship/i;
const PREFERRED_RE = /\bprefer|\bdesir|\ba plus\b|nice to have/i;
const CONDITION_RE =
  /\bshifts?\b|availab|overtime|on-call|holidays|weekends|\bnights?\b|physical|\bclimb|\blift|heights|hand tools|own tools|tools of the trade|\bdrug\b|screening|background check|medical|color vision|emergenc|re-sign|waiting list|assessment|\binterview|\bexam\b|\btests?\b|^timing|qualification training/i;
const NOT_A_GAP_RE = /not a gap|^no (trade |prior |years[- ]of[- ])?experience|^no years|^all of the above|likely met|probably met|assumed met|probably a different employer|applicant pool|below the \$/i;
/** A stated need for prior experience: what makes a posting a stretch for someone new to the field. */
export const EXPERIENCE_RE = /\bexperience\b|\byears?\b|\bproven\b/i;
const leadClause = (text: string) => text.split(/[.(;]|\s[-–]\s/)[0]!;
/** "No years attached" and "no experience minimum" are the opposite of an experience requirement. */
const stripNegated = (s: string) => s.replace(/\bno (stated |posted |set |minimum |prior |trade )?(years|experience)[^,.;]*/gi, " ");
export const needsExperience = (gaps: Gaps) =>
  gaps.soft.some((g) => EXPERIENCE_RE.test(stripNegated(g.slice(0, 160)))) || gaps.preferred.some((g) => /\byears?\b/i.test(g.slice(0, 160)));

const DRIVING_RE = /driver'?s?\s+licen[cs]e|\bdriv(e|ing)\b|\bdmv\b|company vehicle|\bcdl\b/i;
const PAPERWORK_RE = /birth certificate|high school diploma|\bged\b|photo id|social security|\bresiden(t|cy|ce)\b|at least 18|\bage 18\b|18 or older|in person|by appointment/i;
const CREDENTIAL_RE = /licen[cs]e|certificat|certified|\bcard\b|\bepa\b|nicet|\bdegree\b|registration|\bpermit\b|credential/i;

/**
 * Sort the second pass's gap notes. Only a mandatory CREDENTIAL blocks a job; a required number of
 * years is an experience gap, which is what a stretch application is. Driving statements and
 * paperwork are kept apart because the applicant's licence status and documents are never assumed.
 */
export function parseGaps(lines: string[] | undefined): Gaps {
  const gaps: Gaps = { hard: [], soft: [], driving: [], confirm: [], conditions: [], preferred: [] };
  for (const raw of lines ?? []) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(hard|soft|unknown|unverified|note)\b[^:]{0,40}[:\-–]\s*(.+)$/i.exec(line);
    const text = m ? m[2]!.trim() : line;
    const labelledHard = Boolean(m && m[1]!.toLowerCase() === "hard");
    // Judge by the requirement itself (the leading clause), not by the commentary that follows it.
    const lead = leadClause(text);
    // "No experience alternative stated" is not an experience requirement.
    const isExperience = /\bplus\b|experience|\byears?\b/i.test(stripNegated(lead));
    // "Preferred" is usually said in a bracket right after the requirement, so look a little further.
    const head = text.slice(0, 200);
    if (DRIVING_RE.test(lead)) gaps.driving.push(text);
    else if (ELIGIBILITY_RE.test(head)) gaps.confirm.push(text); // head, not lead: "U.S." ends the leading clause early
    else if (PAPERWORK_RE.test(lead) && !isExperience) gaps.confirm.push(text);
    else if (labelledHard && CREDENTIAL_RE.test(lead) && !isExperience) gaps.hard.push(text);
    else if (NOT_A_GAP_RE.test(head)) continue;
    else if (PREFERRED_RE.test(head) && !/\brequired\b[^.]{0,40}$/i.test(lead)) gaps.preferred.push(text);
    else if (CONDITION_RE.test(lead) && !isExperience) gaps.conditions.push(text);
    else gaps.soft.push(text);
  }
  return gaps;
}

/**
 * Did the independent second pass actually check anything? When its searches could not run (for
 * example the search allowance was used up) it reports that in words and returns no evidence of its
 * own. That is "not checked", which is different from "checked and not found".
 */
export function verdictState(v: Verdict | null): "checked" | "unchecked" | "none" {
  if (!v) return "none";
  const text = `${v.verdictReason} ${(v.problems ?? []).join(" ")}`;
  const couldNotRun = /budget|exhausted|allowance|tooling|could not (run|perform|do|make) (any|a single|an)|unable to (search|run|verify)|no (independent )?search(es)? (ran|could)|not reachable|blocked/i.test(text);
  return couldNotRun && (v.independentEvidence ?? []).length === 0 ? "unchecked" : "checked";
}

export function payFactor(
  min: number | null | undefined,
  max: number | null | undefined,
  hasProgression: boolean,
  targetAnnual: number = TARGET_ANNUAL,
): { value: number; note: string } {
  const lo = min ?? max ?? null;
  const hi = max ?? min ?? null;
  if (lo === null || hi === null || lo <= 0 || hi <= 0) return { value: 0.4, note: "Pay could not be confirmed as a number" };
  const hr = (n: number) => `$${(n / PAY_RULE.fullTimeHours).toFixed(2)}/hr`;
  const target = `${hr(targetAnnual)} target for this distance`;
  let value: number;
  let note: string;
  if (lo >= targetAnnual) {
    value = 1;
    note = `Whole range (${hr(lo)} to ${hr(hi)}) is at or above your ${target}`;
  } else if (hi >= targetAnnual) {
    value = 0.75 + 0.25 * (lo / targetAnnual);
    note = `Top of range (${hr(hi)}) reaches your ${target}; it starts at ${hr(lo)}`;
  } else {
    value = 0.7 * (hi / targetAnnual);
    note = `Tops out at ${hr(hi)}, below your ${target}`;
  }
  if (hasProgression && value < 0.6) {
    value = 0.6;
    note += "; counted higher because the posting documents a paid progression";
  }
  return { value: clamp01(value), note };
}

export function accessFactor(softGaps: number, hardGaps: number, basis: "resume" | "goals" = "goals"): { value: number; note: string } {
  const resume = basis === "resume";
  if (hardGaps > 0) return { value: 0, note: `${hardGaps} mandatory requirement${hardGaps === 1 ? "" : "s"} ${resume ? "your resume does not show" : "a beginner is unlikely to meet"}` };
  const table = [1, 0.8, 0.6, 0.45];
  const value = softGaps < table.length ? table[softGaps]! : 0.3;
  const none = resume ? "Your resume shows every posted minimum" : "No listed requirement appears out of reach for a beginner";
  const some = resume ? `${softGaps} posted requirement${softGaps === 1 ? "" : "s"} your resume does not show; address ${softGaps === 1 ? "it" : "them"} honestly` : `${softGaps} experience or preference gap${softGaps === 1 ? "" : "s"} to address honestly`;
  return { value, note: softGaps === 0 ? none : some };
}

/** Apply the verifier's corrections on top of the finder's claim. */
export function mergeRow(row: RawRow): RawRow {
  const c = row.verdict?.corrected;
  if (!c) return row;
  const merged: RawRow = { ...row };
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

export function scoreRow(input: RawRow): ScoredJob {
  const row = mergeRow(input);
  const v = row.verdict;
  const state = verdictState(v);
  const checked = state === "checked";
  const fitBasis: "resume" | "goals" = v && (typeof v.resumeFit === "number" || Array.isArray(v.gapsForApplicant)) ? "resume" : "goals";
  const gaps = parseGaps(v?.gapsForApplicant ?? v?.gapsForBeginner);
  const open = clamp01(checked ? v!.stillOpenConfidence : row.openConfidence);
  const loc = locate(row.city, row.county);
  const target = targetHourly(loc.miles);
  const hasProgression = Boolean(row.progression && row.progression.trim());
  const pay = payFactor(row.payMinAnnual, row.payMaxAnnual, hasProgression, target * PAY_RULE.fullTimeHours);
  const payMaxHourly = (row.payMaxAnnual ?? row.payMinAnnual) ? Math.round(((row.payMaxAnnual ?? row.payMinAnnual)! / PAY_RULE.fullTimeHours) * 100) / 100 : null;
  const payMinHourly = (row.payMinAnnual ?? row.payMaxAnnual) ? Math.round(((row.payMinAnnual ?? row.payMaxAnnual)! / PAY_RULE.fullTimeHours) * 100) / 100 : null;
  // A second pass that could not run only speculates about gaps, so reach is judged from the first
  // pass's reading of the posted minimums (its tier) instead of counting those unverified notes.
  const access = checked
    ? accessFactor(gaps.soft.length + (gaps.preferred.length >= 2 ? 1 : 0), gaps.hard.length, fitBasis)
    : gaps.hard.length > 0
      ? accessFactor(0, gaps.hard.length)
      : row.tier === "best_fit"
        ? { value: 0.9, note: "The posted minimums looked reachable for a beginner on first reading; not double-checked" }
        : { value: 0.5, note: "The posting asks for experience a beginner probably lacks; not double-checked" };
  // With a resume, "how much does this suit the applicant" is the checker's requirement-by-requirement
  // match; without one it is the stated order of fields of interest.
  const byResume = checked && typeof v!.resumeFit === "number";
  const interestValue = byResume ? clamp01(v!.resumeFit!) : (FIELD_INTEREST[row.field] ?? FIELD_INTEREST.other_trade!);
  const aiLevel: AiLevel = v?.aiExposure.level ?? "medium";
  const drivingValue = DRIVING_VALUE[row.drivingRequirement] ?? DRIVING_VALUE.unknown!;

  const mk = (value: number, weight: number, note: string): Factor => ({ value: clamp01(value), weight, points: Math.round(clamp01(value) * weight * 1000) / 10, note });
  const pct = Math.round(open * 100);
  const breakdown: ScoredJob["breakdown"] = {
    access: mk(access.value, WEIGHTS.access, access.note),
    pay: mk(pay.value, WEIGHTS.pay, pay.note),
    interest: mk(
      interestValue,
      WEIGHTS.interest,
      byResume
        ? `Resume match ${Math.round(interestValue * 100)}%: ${v!.resumeFitReason ?? "share of the posted minimums your resume shows"}`
        : `${FIELD_LABELS[row.field] ?? "Other trade"} is ${interestValue >= 0.95 ? "at the top of" : interestValue >= 0.85 ? "high on" : "lower on"} your stated list`,
    ),
    ai: mk(AI_VALUE[aiLevel], WEIGHTS.ai, v ? `${aiLevel[0]!.toUpperCase()}${aiLevel.slice(1)} AI exposure (estimate): ${v.aiExposure.reason}` : "Not assessed"),
    open: mk(open, WEIGHTS.open, checked ? `Second pass's confidence it is still open: ${pct}%` : `Found once in search results and not double-checked; the finder's own confidence it is still open: ${pct}%`),
    distance: mk(proximityValue(loc.miles), WEIGHTS.distance, `About ${loc.miles} miles from Canoga Park in a straight line${loc.estimated ? " (the exact work site is not stated, so this assumes " + loc.place + ")" : ""}`),
    driving: mk(drivingValue, WEIGHTS.driving, `Posting says: ${row.drivingRequirement}`),
  };
  const score = Math.round(Object.values(breakdown).reduce((s, f) => s + f.points, 0));

  let list: ListName = "best_fit";
  let ruledOutReason: string | null = null;
  // No second-pass verdict at all (the check was capped or never ran) is "found once", like a
  // check that could not run. It is shown with that label, never as a confirmed match.
  if (checked && !v!.isReal) ruledOutReason = "The second pass could not find this posting on the employer's own site";
  else if (checked && !v!.directEmployerApply) ruledOutReason = "The application is not on the employer's own site";
  else if (checked && !v!.inLaOrOc) ruledOutReason = "The work location is outside Los Angeles and Orange counties";
  else if (open < 0.35) ruledOutReason = checked ? "It appears to have closed" : "Even the search that found it rated it unlikely to still be open";
  else if (gaps.hard.length > 0) ruledOutReason = `It requires a credential you would need first: ${gaps.hard[0]}`;
  // With a real resume in hand, a posting whose minimums it barely touches is not a stretch, it is a miss.
  else if (byResume && v!.resumeFit! < MIN_RESUME_FIT) ruledOutReason = `Your resume shows too few of the posted minimums (about ${Math.round(v!.resumeFit! * 100)}%)`;

  // "Around" the target: the top of the range must come within 5% of it.
  const belowPay = payMaxHourly !== null && payMaxHourly < target * 0.95;
  if (ruledOutReason) list = "ruled_out";
  else if (belowPay) list = "below_pay";
  else if (!checked) list = row.tier;
  // A stretch is a posting that asks for experience the applicant has not shown: it says so in as
  // many words, lists years as preferred, or piles up three or more knowledge gaps. Once a posting
  // has been checked, that reading replaces the first pass's guess at the tier.
  else if (needsExperience(gaps) || gaps.soft.length >= 3) list = "stretch";

  return {
    ...row,
    id: stableId(row.employer, row.title, row.postingUrl),
    gaps,
    checked,
    area: loc.area,
    milesFromHome: loc.miles,
    locationEstimated: loc.estimated,
    placeName: loc.place,
    targetHourly: target,
    payMinHourly,
    payMaxHourly,
    score,
    breakdown,
    list,
    ruledOutReason,
    needsOpenCheck: list !== "ruled_out" && (!checked || open < 0.6),
    fitBasis,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Employer names vary by how much of the legal name a source prints; compare on the leading words. */
const sameEmployer = (a: string, b: string) => {
  const x = norm(a.replace(/\(.*?\)/g, " ")).split(" ").slice(0, 3).join(" ");
  const y = norm(b.replace(/\(.*?\)/g, " ")).split(" ").slice(0, 3).join(" ");
  return x === y || norm(a).startsWith(y) || norm(b).startsWith(x);
};

/** Drop the same posting found by two slices (same URL, or same employer + title + city). */
export function dedupe(jobs: ScoredJob[]): ScoredJob[] {
  const best = new Map<string, ScoredJob>();
  const keyOf = (j: ScoredJob) => `${norm(j.employer)}|${norm(j.title)}|${norm(j.city)}`;
  const urlKey = (j: ScoredJob) => j.postingUrl.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  const byUrl = new Map<string, string>();
  for (const j of jobs) {
    const k = byUrl.get(urlKey(j)) ?? keyOf(j);
    byUrl.set(urlKey(j), k);
    const cur = best.get(k);
    // A copy that went through the second check always beats one that did not.
    const better =
      !cur ||
      (j.checked && !cur.checked) ||
      (j.checked === cur.checked && ((cur.list === "ruled_out" && j.list !== "ruled_out") || (cur.list === j.list && j.score > cur.score)));
    if (better) best.set(k, j);
  }
  // The same posting written two ways: same employer and city, one title an extension of the other.
  const out: ScoredJob[] = [];
  for (const j of [...best.values()].sort((a, b) => Number(b.checked) - Number(a.checked) || b.score - a.score)) {
    const twin = out.find((o) => norm(o.city) === norm(j.city) && sameEmployer(o.employer, j.employer) && (norm(o.title).startsWith(norm(j.title)) || norm(j.title).startsWith(norm(o.title))));
    if (!twin) out.push(j);
  }
  return out;
}

export type Selection = { bestFit: ScoredJob[]; stretch: ScoredJob[]; belowPay: ScoredJob[]; ruledOut: ScoredJob[]; bench: ScoredJob[] };

/**
 * Pick the ranked lists. At most `maxPerEmployer` roles per employer per list so one large employer
 * cannot crowd out the rest; anything that qualified but did not make the cut is kept on the bench.
 */
export function select(all: ScoredJob[], opts: { best?: number; stretch?: number; maxPerEmployer?: number } = {}): Selection {
  const { best = 10, stretch = 5, maxPerEmployer = 2 } = opts;
  const jobs = dedupe(all).sort((a, b) => b.score - a.score || a.employer.localeCompare(b.employer));
  const take = (pool: ScoredJob[], n: number) => {
    const picked: ScoredJob[] = [];
    const rest: ScoredJob[] = [];
    const perEmployer = new Map<string, number>();
    for (const j of pool) {
      const e = norm(j.employer);
      const count = perEmployer.get(e) ?? 0;
      if (picked.length < n && count < maxPerEmployer) {
        picked.push(j);
        perEmployer.set(e, count + 1);
      } else rest.push(j);
    }
    return { picked, rest };
  };
  const b = take(jobs.filter((j) => j.list === "best_fit"), best);
  const s = take(jobs.filter((j) => j.list === "stretch"), stretch);
  return {
    bestFit: b.picked,
    stretch: s.picked,
    belowPay: jobs.filter((j) => j.list === "below_pay"),
    ruledOut: jobs.filter((j) => j.list === "ruled_out"),
    bench: [...b.rest, ...s.rest],
  };
}
