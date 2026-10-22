/**
 * Sender-domain knowledge: which job boards, applicant-tracking systems and vendors send which mail.
 * Pure data + lookups (safe for client and server).
 */
import type { ApplicationSource } from "@/generated/prisma/enums";

/**
 * - job_board / ats: automated platform mail (confirmations, alerts, status changes)
 * - assessment / scheduler: third-party vendors acting for an employer
 * - union / staffing: apprenticeship offices and agencies (their own organization is the employer)
 * - freemail: a person writing from a consumer mailbox
 * - employer: any other domain (presumed to be the employer's own)
 */
export type SenderKind =
  | "job_board"
  | "ats"
  | "assessment"
  | "scheduler"
  | "union"
  | "staffing"
  | "freemail"
  | "employer"
  | "unknown";

type DomainEntry = { re: RegExp; platform: ApplicationSource; kind: SenderKind; name: string };

const DOMAINS: DomainEntry[] = [
  { re: /(^|\.)indeed(email|mail)?\.com$/, platform: "INDEED", kind: "job_board", name: "Indeed" },
  { re: /(^|\.)glassdoor\.(com|co\.uk|ca)$/, platform: "GLASSDOOR", kind: "job_board", name: "Glassdoor" },
  { re: /(^|\.)linkedin\.com$/, platform: "LINKEDIN", kind: "job_board", name: "LinkedIn" },
  { re: /(^|\.)ziprecruiter\.com$/, platform: "ZIPRECRUITER", kind: "job_board", name: "ZipRecruiter" },
  { re: /(^|\.)(myworkday|myworkdayjobs|workday)\.com$/, platform: "WORKDAY", kind: "ats", name: "Workday" },
  { re: /(^|\.)greenhouse(-mail)?\.io$/, platform: "GREENHOUSE", kind: "ats", name: "Greenhouse" },
  { re: /(^|\.)lever\.co$/, platform: "LEVER", kind: "ats", name: "Lever" },
  { re: /(^|\.)smartrecruiters(mail)?\.com$/, platform: "SMARTRECRUITERS", kind: "ats", name: "SmartRecruiters" },
  { re: /(^|\.)icims\.com$/, platform: "ICIMS", kind: "ats", name: "iCIMS" },
  { re: /(^|\.)adp\.com$/, platform: "ADP", kind: "ats", name: "ADP" },
  { re: /(^|\.)(governmentjobs|neogov|schooljobs)\.com$/, platform: "GOVERNMENTJOBS", kind: "job_board", name: "GovernmentJobs" },
  { re: /(^|\.)usajobs\.(gov|opm\.gov)$/, platform: "USAJOBS", kind: "job_board", name: "USAJOBS" },
  // Other applicant-tracking systems used on employer career sites (no dedicated enum value).
  {
    re: /(^|\.)(taleo\.net|oraclecloud\.com|successfactors\.(com|eu)|jobvite\.com|bamboohr\.com|workable(mail)?\.com|breezy\.hr|applytojob\.com|jazzhr\.com|paylocity\.com|ultipro\.com|ukg\.com|paycomonline\.net|recruitee\.com|ashbyhq\.com|teamtailor(-mail)?\.com|pinpointhq\.com|dayforcehcm\.com|myjobs\.adp\.com|hiringthing\.com|clearcompany\.com|isolvedhire\.com|rippling(-ats)?\.com)$/,
    platform: "COMPANY_SITE",
    kind: "ats",
    name: "ATS",
  },
  // Job boards without a dedicated enum value.
  {
    re: /(^|\.)(monster\.com|careerbuilder\.com|simplyhired\.com|dice\.com|snagajob\.com|joinhandshake\.com|wellfound\.com|builtin\.com|jobcase\.com|getwork\.com|talent\.com|craigslist\.org)$/,
    platform: "OTHER",
    kind: "job_board",
    name: "Job board",
  },
  {
    re: /(^|\.)(hirevue\.com|codility\.com|hackerrank\.com|codesignal\.com|criteriacorp\.com|shl\.com|pymetrics\.(ai|com)|harver\.com|testgorilla\.com|modernhire\.com|vervoe\.com|wonderlic\.com|mettl\.com|ondemand\.hirevue\.com|plum\.io|predictiveindex\.com)$/,
    platform: "OTHER",
    kind: "assessment",
    name: "Assessment vendor",
  },
  {
    re: /(^|\.)(calendly\.com|goodtime\.io|paradox\.ai|modernloop\.io|yello\.co|gem\.com)$/,
    platform: "OTHER",
    kind: "scheduler",
    name: "Scheduling vendor",
  },
  // Known union / apprenticeship portals (mirrors src/lib/applications/normalize.ts).
  {
    re: /(^|\.)(ibew\d*\.org|etila\.org|oceti\.org|weca\.org|abcsocal\.org)$/,
    platform: "UNION_PORTAL",
    kind: "union",
    name: "Union portal",
  },
];

const FREEMAIL =
  /(^|\.)(gmail|googlemail|yahoo|ymail|rocketmail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|zoho|yandex|mail|comcast|att|sbcglobal|verizon|cox|charter|earthlink)\.(com|net|me|ch|de|co\.uk)$/;

/** Display names that are platforms, not employers or people. */
export const PLATFORM_NAMES =
  /^(indeed|indeed apply|linkedin|linkedin jobs|linkedin job alerts|ziprecruiter|glassdoor|usajobs|workday|greenhouse|lever|smartrecruiters|icims|adp|neogov|governmentjobs(\.com)?|hirevue|calendly|monster|careerbuilder|handshake|jobvite|taleo)$/i;

const UNION_HINT =
  /\b(jatc|jac|(labor|trade) union|union local|local union|ibew|joint apprenticeship|apprenticeship (committee|program|office|trust|council)|training (trust|committee)|ua local|smart local)\b|jatc|ibew/i;
const STAFFING_HINT =
  /\b(staffing|recruiting agency|recruitment agency|temp agency|talent solutions|workforce solutions|employment agency|placement agency)\b|staffing/i;

export type SenderInfo = {
  address: string | null;
  domain: string | null;
  localPart: string | null;
  kind: SenderKind;
  /** Platform this sender implies (null only when there is no sender at all). */
  platform: ApplicationSource | null;
  /** True for job boards and applicant-tracking systems: automated, recognizable platform mail. */
  recognizedPlatform: boolean;
  /** Address is an unattended mailbox (no-reply, notifications, alerts). */
  noReply: boolean;
};

export function domainOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const d = address
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[>\s].*$/, "");
  return d || null;
}

/** Classify an email sender by its address and display name. */
export function senderInfo(address: string | null | undefined, displayName?: string | null): SenderInfo {
  const addr = address ? address.trim().toLowerCase() : null;
  const domain = domainOf(addr);
  const localPart = addr && addr.includes("@") ? addr.slice(0, addr.lastIndexOf("@")) : null;
  const noReply = !!localPart && /(^|[-_.])(no-?reply|do-?not-?reply|donotreply|notifications?|alerts?|jobalerts?|mailer|bounce|automated|system)([-_.]|$)/.test(localPart);
  const base = { address: addr, domain, localPart, noReply };
  if (!domain) return { ...base, kind: "unknown", platform: null, recognizedPlatform: false };

  for (const entry of DOMAINS) {
    if (entry.re.test(domain)) {
      return {
        ...base,
        kind: entry.kind,
        platform: entry.platform,
        recognizedPlatform: entry.kind === "job_board" || entry.kind === "ats",
      };
    }
  }
  if (FREEMAIL.test(domain)) return { ...base, kind: "freemail", platform: "OTHER", recognizedPlatform: false };
  const name = displayName ?? "";
  if (UNION_HINT.test(domain) || UNION_HINT.test(name)) {
    return { ...base, kind: "union", platform: "OTHER", recognizedPlatform: false };
  }
  if (STAFFING_HINT.test(domain) || STAFFING_HINT.test(name)) {
    return { ...base, kind: "staffing", platform: "OTHER", recognizedPlatform: false };
  }
  return { ...base, kind: "employer", platform: "COMPANY_SITE", recognizedPlatform: false };
}

/** Compact lower-case alphanumerics, for comparing an employer name with a domain label. */
function compact(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Whether `domain` plausibly belongs to `employer` ("harborlineelevator.example" ↔ "Harbor Line
 * Elevator Co."). Compares the registrable label with the employer name minus legal suffixes.
 */
export function domainMatchesEmployer(domain: string | null, employer: string | null): boolean {
  if (!domain || !employer) return false;
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  const name = compact(employer.replace(/\b(inc|llc|ltd|corp|corporation|co|company|the)\b\.?/gi, " "));
  if (name.length < 4) return false;
  // Check every non-TLD label (mail.acme.com → "mail", "acme").
  for (const label of labels.slice(0, -1)) {
    const l = compact(label);
    if (l.length < 4) continue;
    if (l === name || name.startsWith(l) || l.startsWith(name)) return true;
  }
  return false;
}
