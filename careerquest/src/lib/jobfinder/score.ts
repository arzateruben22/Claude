/**
 * Job Finder ranking engine (pure, no I/O).
 *
 * Input: postings found by a web-search sweep, each with an independent verification verdict.
 * Output: a transparent 0–100 fit score against the applicant's stated goals, a list assignment
 * (best fit / stretch / ruled out) and the reason for every exclusion. Nothing here invents data:
 * a posting that was not independently confirmed on the employer's own site is ruled out, and a
 * posting with a mandatory requirement the applicant lacks is never presented as a match.
 */

export type Tier = "best_fit" | "stretch";
export type AiLevel = "low" | "medium" | "high";
export type ListName = "best_fit" | "stretch" | "ruled_out";

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
  gapsForBeginner: string[];
  aiExposure: { level: AiLevel; reason: string };
  coverLetter: string;
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
  breakdown: Record<"access" | "pay" | "interest" | "ai" | "open" | "driving", Factor>;
  list: ListName;
  ruledOutReason: string | null;
  needsOpenCheck: boolean;
};

export const TARGET_ANNUAL = 80_000;

export const WEIGHTS = { access: 0.24, pay: 0.22, interest: 0.18, ai: 0.14, open: 0.14, driving: 0.08 } as const;

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
};

const DRIVING_RE = /driver'?s?\s+licen[cs]e|\bdriv(e|ing)\b|\bdmv\b|company vehicle|\bcdl\b/i;
const PAPERWORK_RE = /birth certificate|high school diploma|\bged\b|photo id|social security|\bresiden(t|cy|ce)\b|at least 18|in person|by appointment/i;
const CREDENTIAL_RE = /licen[cs]e|certificat|certified|\bcard\b|\bepa\b|nicet|\bdegree\b|registration|\bpermit\b|credential/i;

/**
 * Sort the second pass's gap notes. Only a mandatory CREDENTIAL blocks a job; a required number of
 * years is an experience gap, which is what a stretch application is. Driving statements and
 * paperwork are kept apart because the applicant's licence status and documents are never assumed.
 */
export function parseGaps(lines: string[] | undefined): Gaps {
  const gaps: Gaps = { hard: [], soft: [], driving: [], confirm: [] };
  for (const raw of lines ?? []) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(hard|soft|unknown|unverified|note)\b[^:]{0,40}[:\-–]\s*(.+)$/i.exec(line);
    const text = m ? m[2]!.trim() : line;
    const labelledHard = Boolean(m && m[1]!.toLowerCase() === "hard");
    // Judge by the requirement itself (the leading clause), not by the commentary that follows it.
    const lead = text.split(/[.(;]|\s[-–]\s/)[0]!;
    const isExperience = /\bplus\b|experience|\byears?\b/i.test(lead);
    if (DRIVING_RE.test(lead)) gaps.driving.push(text);
    else if (PAPERWORK_RE.test(lead) && !isExperience) gaps.confirm.push(text);
    else if (labelledHard && CREDENTIAL_RE.test(lead) && !isExperience) gaps.hard.push(text);
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

export function payFactor(min: number | null | undefined, max: number | null | undefined, hasProgression: boolean): { value: number; note: string } {
  const lo = min ?? max ?? null;
  const hi = max ?? min ?? null;
  if (lo === null || hi === null || lo <= 0 || hi <= 0) return { value: 0.4, note: "Pay could not be confirmed as a number" };
  const fmt = (n: number) => `$${Math.round(n / 1000)}K`;
  let value: number;
  let note: string;
  if (lo >= TARGET_ANNUAL) {
    value = 1;
    note = `Whole range (${fmt(lo)}–${fmt(hi)}) is at or above the $80K target`;
  } else if (hi >= TARGET_ANNUAL) {
    value = 0.75 + 0.25 * (lo / TARGET_ANNUAL);
    note = `Top of range (${fmt(hi)}) reaches the $80K target; it starts at ${fmt(lo)}`;
  } else {
    value = 0.7 * (hi / TARGET_ANNUAL);
    note = `Tops out at ${fmt(hi)}, below the $80K target`;
  }
  if (hasProgression && value < 0.6) {
    value = 0.6;
    note += "; counted higher because the posting documents a paid progression";
  }
  return { value: clamp01(value), note };
}

export function accessFactor(softGaps: number, hardGaps: number): { value: number; note: string } {
  if (hardGaps > 0) return { value: 0, note: `${hardGaps} mandatory requirement${hardGaps === 1 ? "" : "s"} a beginner is unlikely to meet` };
  const table = [1, 0.8, 0.6, 0.45];
  const value = softGaps < table.length ? table[softGaps]! : 0.3;
  const note = softGaps === 0 ? "No listed requirement appears out of reach for a beginner" : `${softGaps} experience or preference gap${softGaps === 1 ? "" : "s"} to address honestly`;
  return { value, note };
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
  const gaps = parseGaps(v?.gapsForBeginner);
  const open = clamp01(checked ? v!.stillOpenConfidence : row.openConfidence);
  const pay = payFactor(row.payMinAnnual, row.payMaxAnnual, Boolean(row.progression && row.progression.trim()));
  // A second pass that could not run only speculates about gaps, so reach is judged from the first
  // pass's reading of the posted minimums (its tier) instead of counting those unverified notes.
  const access = checked
    ? accessFactor(gaps.soft.length, gaps.hard.length)
    : gaps.hard.length > 0
      ? accessFactor(0, gaps.hard.length)
      : row.tier === "best_fit"
        ? { value: 0.9, note: "The posted minimums looked reachable for a beginner on first reading; not double-checked" }
        : { value: 0.5, note: "The posting asks for experience a beginner probably lacks; not double-checked" };
  const interestValue = FIELD_INTEREST[row.field] ?? FIELD_INTEREST.other_trade!;
  const aiLevel: AiLevel = v?.aiExposure.level ?? "medium";
  const drivingValue = DRIVING_VALUE[row.drivingRequirement] ?? DRIVING_VALUE.unknown!;

  const mk = (value: number, weight: number, note: string): Factor => ({ value: clamp01(value), weight, points: Math.round(clamp01(value) * weight * 1000) / 10, note });
  const pct = Math.round(open * 100);
  const breakdown: ScoredJob["breakdown"] = {
    access: mk(access.value, WEIGHTS.access, access.note),
    pay: mk(pay.value, WEIGHTS.pay, pay.note),
    interest: mk(interestValue, WEIGHTS.interest, `${FIELD_LABELS[row.field] ?? "Other trade"} is ${interestValue >= 0.95 ? "at the top of" : interestValue >= 0.85 ? "high on" : "lower on"} your stated list`),
    ai: mk(AI_VALUE[aiLevel], WEIGHTS.ai, v ? `${aiLevel[0]!.toUpperCase()}${aiLevel.slice(1)} AI exposure (estimate): ${v.aiExposure.reason}` : "Not assessed"),
    open: mk(open, WEIGHTS.open, checked ? `Second pass's confidence it is still open: ${pct}%` : `Found once in search results and not double-checked; the finder's own confidence it is still open: ${pct}%`),
    driving: mk(drivingValue, WEIGHTS.driving, `Posting says: ${row.drivingRequirement}`),
  };
  const score = Math.round(Object.values(breakdown).reduce((s, f) => s + f.points, 0));

  let list: ListName = "best_fit";
  let ruledOutReason: string | null = null;
  if (state === "none") ruledOutReason = "Not assessed at all, so it is not presented as a match";
  else if (checked && !v!.isReal) ruledOutReason = "The second pass could not find this posting on the employer's own site";
  else if (checked && !v!.directEmployerApply) ruledOutReason = "The application is not on the employer's own site";
  else if (checked && !v!.inLaOrOc) ruledOutReason = "The work location is outside Los Angeles and Orange counties";
  else if (open < 0.35) ruledOutReason = checked ? "It appears to have closed" : "Even the search that found it rated it unlikely to still be open";
  else if (gaps.hard.length > 0) ruledOutReason = `It requires a credential you would need first: ${gaps.hard[0]}`;

  if (ruledOutReason) list = "ruled_out";
  else if (!checked) list = row.tier;
  else if (gaps.soft.length >= 2 || (row.tier === "stretch" && gaps.soft.length >= 1)) list = "stretch";

  return {
    ...row,
    id: stableId(row.employer, row.title, row.postingUrl),
    gaps,
    checked,
    score,
    breakdown,
    list,
    ruledOutReason,
    needsOpenCheck: list !== "ruled_out" && (!checked || open < 0.6),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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
    const better = !cur || (cur.list === "ruled_out" && j.list !== "ruled_out") || (cur.list === j.list && j.score > cur.score);
    if (better) best.set(k, j);
  }
  return [...best.values()];
}

export type Selection = { bestFit: ScoredJob[]; stretch: ScoredJob[]; ruledOut: ScoredJob[]; bench: ScoredJob[] };

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
  return { bestFit: b.picked, stretch: s.picked, ruledOut: jobs.filter((j) => j.list === "ruled_out"), bench: [...b.rest, ...s.rest] };
}
