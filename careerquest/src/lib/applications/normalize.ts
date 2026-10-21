import type { ApplicationSource } from "@/generated/prisma/enums";

/** Legal-form suffixes stripped from the END of a company name only ("Acme Group Electric" keeps "group"). */
const COMPANY_SUFFIXES =
  /\s+(incorporated|inc|llc|l\s?l\s?c|ltd|limited|corp|corporation|co|company|plc|group|holdings)$/;

export function normalizeCompany(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let out = base.replace(/^the\s+/, "");
  // Strip trailing suffixes repeatedly ("Acme Electric Co Inc" → "acme electric").
  for (;;) {
    const next = out.replace(COMPANY_SUFFIXES, "");
    if (next === out) break;
    out = next;
  }
  out = out.trim();
  // Never collapse a name to nothing ("Company" stays "company") or duplicates could merge wrongly.
  return out.length ? out : base;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ") // parentheticals often hold req ids / locations
    .replace(/\b(job id|req(?:uisition)?|id)\s*[:#]?\s*[a-z0-9-]+/g, " ")
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "refid",
  "ref_id",
  "referer",
  "referrer",
  "trk",
  "trkinfo",
  "trackingid",
  "tracking_id",
  "position",
  "pagenum",
  "src",
  "source",
  "from",
  "vjs",
  "advn",
  "tk",
  "fromage",
  "sort",
  "start",
  "iss",
  "xkcb",
  "xpse",
  "xfps",
  "jsa",
  "ikw",
  "spa",
  "sjdu",
  "jk_old",
  "currentjobid",
  "eBP",
  "ebp",
  "refresh",
  "originaljobsource",
  "origin",
  "lipi",
  "licu",
  "lici",
  "ssr",
  "p",
]);

const PLATFORM_HOSTS: Array<[RegExp, ApplicationSource]> = [
  [/(^|\.)indeed\.com$/, "INDEED"],
  [/(^|\.)glassdoor\.(com|co\.uk|ca)$/, "GLASSDOOR"],
  [/(^|\.)linkedin\.com$/, "LINKEDIN"],
  [/(^|\.)ziprecruiter\.com$/, "ZIPRECRUITER"],
  [
    /(^|\.)myworkdayjobs\.com$|(^|\.)workday\.com$|(^|\.)myworkday\.com$/,
    "WORKDAY",
  ],
  [/(^|\.)greenhouse\.io$/, "GREENHOUSE"],
  [/(^|\.)lever\.co$/, "LEVER"],
  [/(^|\.)smartrecruiters\.com$/, "SMARTRECRUITERS"],
  [/(^|\.)icims\.com$/, "ICIMS"],
  [/(^|\.)adp\.com$/, "ADP"],
  [/(^|\.)governmentjobs\.com$/, "GOVERNMENTJOBS"],
  [/(^|\.)usajobs\.gov$/, "USAJOBS"],
  [
    /(^|\.)ibew\d*\.org$|(^|\.)etila\.org$|(^|\.)oceti\.org$|(^|\.)weca\.org$|(^|\.)abcsocal\.org$/,
    "UNION_PORTAL",
  ],
];

export function detectPlatform(
  url: string | null | undefined,
): ApplicationSource {
  if (!url) return "OTHER";
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [re, platform] of PLATFORM_HOSTS) {
      if (re.test(host)) return platform;
    }
    return "COMPANY_SITE";
  } catch {
    return "OTHER";
  }
}

/**
 * Canonical form of a posting URL used for duplicate detection.
 * - lower-cases the host, removes `www.`, tracking params, fragments and trailing slashes
 * - for well-known boards reduces to the stable job identifier
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  const params = u.searchParams;

  if (host.endsWith("indeed.com")) {
    const jk =
      params.get("jk") ||
      path.match(/\/viewjob\/([a-z0-9]+)/i)?.[1] ||
      path.match(/jk=([a-z0-9]+)/i)?.[1];
    if (jk) return `https://indeed.com/viewjob?jk=${jk.toLowerCase()}`;
  }
  if (host.endsWith("linkedin.com")) {
    const id =
      path.match(/\/jobs\/view\/(?:[^/]*?-)?(\d+)/)?.[1] ||
      params.get("currentJobId");
    if (id) return `https://linkedin.com/jobs/view/${id}`;
  }
  if (host.endsWith("greenhouse.io")) {
    const m = path.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (m)
      return `https://boards.greenhouse.io/${m[1]!.toLowerCase()}/jobs/${m[2]}`;
    const ghjid = params.get("gh_jid");
    if (ghjid)
      return `https://boards.greenhouse.io/${path.split("/")[1]?.toLowerCase() ?? "job"}/jobs/${ghjid}`;
  }
  if (host.endsWith("lever.co")) {
    const m = path.match(/\/([^/]+)\/([0-9a-f-]{36})/i);
    if (m)
      return `https://jobs.lever.co/${m[1]!.toLowerCase()}/${m[2]!.toLowerCase()}`;
  }
  if (host.endsWith("myworkdayjobs.com")) {
    // .../job/<location>/<Title>_<REQ-ID>  → keep host + req id
    const m = path.match(/_([A-Z0-9-]+)(?:\/|$)/i);
    if (m)
      return `https://${host}${path.split("/job/")[0]}/job/${m[1]!.toUpperCase()}`;
  }
  if (host.endsWith("ziprecruiter.com")) {
    const id =
      params.get("jid") || path.match(/\/(?:c|jobs)\/.*?-([a-f0-9]{8,})/i)?.[1];
    if (id) return `https://ziprecruiter.com/jobs/${id.toLowerCase()}`;
  }
  if (host.endsWith("glassdoor.com")) {
    const id =
      params.get("jl") ||
      path.match(/_KO.*?\.htm.*?jobListingId=(\d+)/)?.[1] ||
      path.match(/JV_[^_]*_KO\d+,\d+\.htm/)?.[0];
    const jl = params.get("jobListingId") || id;
    if (jl) return `https://glassdoor.com/job-listing/${jl}`;
  }

  // Greenhouse boards embedded on a company site expose the job id as ?gh_jid=; keep only that.
  const ghjid = params.get("gh_jid");
  if (ghjid && /^\d+$/.test(ghjid))
    return `https://${host}${path}?gh_jid=${ghjid}`;

  const kept: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (
      !TRACKING_PARAMS.has(k.toLowerCase()) &&
      !k.toLowerCase().startsWith("utm_")
    )
      kept.push([k, v]);
  }
  kept.sort((a, b) => a[0].localeCompare(b[0]));
  const qs = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  return `https://${host}${path}${qs}`;
}

const REQ_PATTERNS = [
  /\b(?:req(?:uisition)?|job)\s*(?:id|number|no\.?|#)?\s*[:#-]?\s*([A-Z]{0,4}-?\d{3,}[A-Z0-9-]*)/i,
  // Workday-style path segments: ".../Electrician_JR-2024-1234" or "..._R123456-1/apply"
  /[_/]((?:JR|R|REQ)-?\d{4,}(?:-\d{1,4})?)(?=[/?#\s]|$)/i,
  /\b(R-?\d{4,})\b/,
  /\b(JR-?\d{4,})\b/i,
  /\b(REQ-?\d{4,})\b/i,
  /\b(\d{4,}BR)\b/,
  /\b([A-Z]{2,5}\d{5,})\b/,
];

/** Best-effort requisition id extraction from free text or a URL. */
export function extractRequisitionId(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  for (const re of REQ_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

/** Simple Dice coefficient on bigrams for fuzzy title/company comparison (0..1). */
export function similarity(a: string, b: string): number {
  const x = normalizeForSim(a);
  const y = normalizeForSim(b);
  if (!x.length || !y.length) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const bx = bigrams(x);
  const by = bigrams(y);
  let inter = 0;
  for (const [g, c] of bx) inter += Math.min(c, by.get(g) ?? 0);
  const denom = x.length - 1 + (y.length - 1);
  return denom > 0 ? (2 * inter) / denom : 0;
}

function normalizeForSim(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
