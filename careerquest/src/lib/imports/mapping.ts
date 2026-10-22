/**
 * Spreadsheet column mapping and per-row validation. Pure (client-safe): the mapping UI uses it for the
 * live preview and the server re-runs exactly the same code on every row before importing.
 */
import type { ApplicationSource } from "@/generated/prisma/enums";
import { detectPlatform, normalizeUrl } from "@/lib/applications/normalize";
import type { ObservationKind } from "@/lib/ingest/types";
import { parseImportDate } from "./dates";

export const IMPORT_FIELDS = [
  "company",
  "title",
  "dateApplied",
  "status",
  "url",
  "location",
  "source",
  "salary",
  "requisition",
  "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const REQUIRED_FIELDS: readonly ImportField[] = ["company", "title"];

export const FIELD_LABELS: Record<ImportField, string> = {
  company: "Company",
  title: "Job title",
  dateApplied: "Date applied",
  status: "Status",
  url: "Posting URL",
  location: "Location",
  source: "Source / platform",
  salary: "Salary",
  requisition: "Requisition / job ID",
  notes: "Notes",
};

export const FIELD_HINTS: Partial<Record<ImportField, string>> = {
  dateApplied: "Rows with a date are imported as submitted; rows without one as saved leads.",
  status: "Optional. Overrides the date rule (e.g. Interview, Rejected, Offer).",
  notes: "Stored as the row's evidence excerpt (first 300 characters).",
};

/** Column index per field (absent = not mapped). */
export type ColumnMapping = Partial<Record<ImportField, number>>;

export const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  company: ["company", "company name", "employer", "employer name", "organization", "organisation", "business", "hiring company", "agency", "contractor", "firm"],
  title: ["job title", "title", "position", "position title", "role", "job", "job name", "opening", "job role", "position name"],
  dateApplied: [
    "date applied",
    "applied",
    "applied on",
    "applied date",
    "application date",
    "date of application",
    "date submitted",
    "submitted",
    "submitted on",
    "submission date",
    "applied at",
    "date",
  ],
  status: ["status", "stage", "application status", "current status", "outcome", "result", "state"],
  url: ["url", "link", "job url", "job link", "posting url", "posting link", "job posting", "job posting url", "listing url", "application url", "job url link"],
  location: ["location", "job location", "city", "office", "work location", "where"],
  source: ["source", "platform", "site", "job board", "board", "applied via", "applied through", "website", "channel"],
  salary: ["salary", "pay", "pay rate", "compensation", "wage", "rate", "salary range", "hourly rate", "pay range"],
  requisition: ["requisition", "requisition id", "requisition number", "req", "req id", "req number", "job id", "job number", "posting id", "reference", "reference number"],
  notes: ["notes", "note", "comments", "comment", "details", "remarks"],
};

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-./#:()]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerScore(field: ImportField, header: string): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  const syns = HEADER_SYNONYMS[field];
  if (syns.includes(h)) return 3;
  // Multi-word synonyms contained in a longer header ("Company Name (legal)").
  for (const s of syns) {
    if (s.includes(" ") && (` ${h} `).includes(` ${s} `)) return 2;
  }
  return 0;
}

/** Auto-suggest a mapping from header names. Each column is used at most once; best matches win. */
export function suggestMapping(headers: readonly string[], preset?: Partial<Record<ImportField, readonly string[]>>): ColumnMapping {
  const candidates: Array<{ field: ImportField; col: number; score: number }> = [];
  headers.forEach((header, col) => {
    for (const field of IMPORT_FIELDS) {
      const presetNames = preset?.[field];
      const presetHit = presetNames?.some((n) => normalizeHeader(n) === normalizeHeader(header));
      const score = presetHit ? 10 : headerScore(field, header);
      if (score > 0) candidates.push({ field, col, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score || IMPORT_FIELDS.indexOf(a.field) - IMPORT_FIELDS.indexOf(b.field) || a.col - b.col);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const c of candidates) {
    if (mapping[c.field] !== undefined || used.has(c.col)) continue;
    mapping[c.field] = c.col;
    used.add(c.col);
  }
  return mapping;
}

export function mappingProblems(mapping: ColumnMapping, columnCount: number): string[] {
  const problems: string[] = [];
  for (const f of REQUIRED_FIELDS) {
    if (mapping[f] === undefined) problems.push(`Choose the column that holds “${FIELD_LABELS[f]}”.`);
  }
  const seen = new Map<number, ImportField>();
  for (const f of IMPORT_FIELDS) {
    const col = mapping[f];
    if (col === undefined) continue;
    if (!Number.isInteger(col) || col < 0 || col >= columnCount) problems.push(`${FIELD_LABELS[f]} points to a column that does not exist.`);
    const other = seen.get(col);
    if (other) problems.push(`${FIELD_LABELS[f]} and ${FIELD_LABELS[other]} use the same column.`);
    seen.set(col, f);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Status and source vocabularies
// ---------------------------------------------------------------------------

export type StatusMapping =
  /** A recognized stage that becomes the observation kind. */
  | { kind: ObservationKind; warning?: undefined }
  /** Recognized but not importable as a stage; the date rule decides (with an explanation). */
  | { kind: null; warning: string | null };

/** Map a free-text status cell to an observation kind (null = fall back to the date rule). */
export function mapStatus(raw: string): StatusMapping {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return { kind: null, warning: null };
  if (/\b(not (yet )?applied|to apply|haven'?t applied|wish ?list|bookmark|saved|interested|planning|plan to|draft|lead)\b/.test(s)) return { kind: "JOB_SEEN" };
  if (/\boffer\b/.test(s)) return { kind: "OFFER" };
  if (/\b(hired|onboard\w*|start date|accepted)\b/.test(s)) return { kind: "ONBOARDING" };
  if (/\b(reject\w*|declined|not selected|not moving forward|unsuccessful|no longer (under )?consider\w*|turned down|denied)\b/.test(s)) return { kind: "REJECTED" };
  if (/\b(interview\w*|on-?site|panel)\b/.test(s)) return { kind: "INTERVIEW_INVITED" };
  if (/\b(assess\w*|test(ing)?|assignment|skills? check|aptitude)\b/.test(s)) return { kind: "ASSESSMENT_INVITED" };
  if (/\b(withdr[ae]w\w*|cancel\w*)\b/.test(s)) {
    return { kind: null, warning: "“Withdrawn” is not imported as a stage — set it on the record after importing." };
  }
  if (/\b(closed|expired|filled|no longer available|position cancel\w*)\b/.test(s)) {
    return { kind: null, warning: "“Closed” is not imported as a stage — set it on the record after importing." };
  }
  if (/\b(no response|no reply|ghost\w*|waiting|awaiting|pending|in progress)\b/.test(s)) return { kind: null, warning: null };
  if (/\b(phone screen|screen\w*|recruiter|contacted|responded|reached out|call back|callback)\b/.test(s)) return { kind: "RECRUITER_RESPONSE" };
  if (/\b(acknowledg\w*|received|confirmed|under review|in review|reviewing|being reviewed)\b/.test(s)) return { kind: "ACKNOWLEDGED" };
  if (/\b(applied|submitted|sent|completed?|application sent)\b/.test(s)) return { kind: "SUBMITTED" };
  return { kind: null, warning: `Status “${raw.trim().slice(0, 40)}” was not recognized; the date-applied rule was used instead.` };
}

const SOURCE_WORDS: Array<[RegExp, ApplicationSource]> = [
  [/\bindeed\b/, "INDEED"],
  [/\bglassdoor\b/, "GLASSDOOR"],
  [/\blinked ?in\b/, "LINKEDIN"],
  [/\bzip ?recruiter\b/, "ZIPRECRUITER"],
  [/\bworkday\b/, "WORKDAY"],
  [/\bgreenhouse\b/, "GREENHOUSE"],
  [/\blever\b/, "LEVER"],
  [/\bsmart ?recruiters\b/, "SMARTRECRUITERS"],
  [/\bicims\b/, "ICIMS"],
  [/\badp\b/, "ADP"],
  [/\b(government ?jobs|neogov)\b/, "GOVERNMENTJOBS"],
  [/\busa ?jobs\b/, "USAJOBS"],
  [/\b(union|jatc|ibew|apprenticeship (office|committee|portal))\b/, "UNION_PORTAL"],
  [/\b(referr\w*|referred)\b/, "REFERRAL"],
  [/\b(company (site|website|page)|careers? (site|page)|direct|employer site|website)\b/, "COMPANY_SITE"],
];

export function mapSource(raw: string): ApplicationSource | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  for (const [re, platform] of SOURCE_WORDS) if (re.test(s)) return platform;
  return "OTHER";
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

export const LIMITS = { company: 200, title: 200, location: 200, salary: 100, requisition: 100, notes: 300, url: 2048 } as const;

export type NormalizedRow = {
  company: string;
  title: string;
  /** Calendar day (YYYY-MM-DD) the application was submitted, when given. */
  appliedDay: string | null;
  kind: ObservationKind;
  /** The status cell as written (trimmed), when mapped. */
  statusText: string | null;
  postingUrl: string | null;
  normalizedUrl: string | null;
  platform: ApplicationSource | null;
  location: string | null;
  salaryText: string | null;
  requisitionId: string | null;
  notes: string | null;
};

export type RowValidation = {
  rowNumber: number;
  /** Every mapped cell is empty — skipped silently. */
  blank: boolean;
  value: NormalizedRow | null;
  errors: string[];
  warnings: string[];
};

export type ValidateOptions = {
  /** Today's day key in the user's timezone; dates after it are rejected. */
  todayKey: string;
  /** Platform assumed when neither a source column nor the URL identifies one (presets). */
  defaultPlatform?: ApplicationSource | null;
};

function cell(cells: readonly string[], col: number | undefined): string {
  if (col === undefined) return "";
  return (cells[col] ?? "").replace(/\s+/g, " ").trim();
}

function clip(v: string, max: number): string {
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

export function validateRow(cells: readonly string[], mapping: ColumnMapping, rowNumber: number, opts: ValidateOptions): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const get = (f: ImportField) => cell(cells, mapping[f]);
  const values = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, get(f)])) as Record<ImportField, string>;
  const blank = IMPORT_FIELDS.every((f) => !values[f]);
  if (blank) return { rowNumber, blank: true, value: null, errors, warnings };

  if (!values.company) errors.push("Company is empty.");
  else if (values.company.length > LIMITS.company) errors.push(`Company is longer than ${LIMITS.company} characters.`);
  if (!values.title) errors.push("Job title is empty.");
  else if (values.title.length > LIMITS.title) errors.push(`Job title is longer than ${LIMITS.title} characters.`);

  let appliedDay: string | null = null;
  if (values.dateApplied) {
    const d = parseImportDate(values.dateApplied);
    if (!d.ok) errors.push(`Date applied “${clip(values.dateApplied, 40)}” is not a recognizable date.`);
    else if (d.day > opts.todayKey) errors.push(`Date applied ${d.day} is in the future.`);
    else appliedDay = d.day;
  }

  let kind: ObservationKind = appliedDay ? "SUBMITTED" : "JOB_SEEN";
  if (values.status) {
    const s = mapStatus(values.status);
    if (s.kind) {
      kind = s.kind;
      if (s.kind === "SUBMITTED" && !appliedDay && !values.dateApplied) {
        warnings.push("Marked as applied but no date applied: the import date is used as the application date.");
      }
    } else if (s.warning) {
      warnings.push(s.warning);
    }
  }

  let postingUrl: string | null = null;
  let normalizedUrl: string | null = null;
  if (values.url) {
    const candidate = /^https?:\/\//i.test(values.url) ? values.url : /^www\./i.test(values.url) ? `https://${values.url}` : values.url;
    const n = candidate.length <= LIMITS.url ? normalizeUrl(candidate) : null;
    if (n && /^https?:\/\//i.test(candidate)) {
      postingUrl = candidate;
      normalizedUrl = n;
    } else {
      warnings.push("The posting URL is not a valid web address and was skipped.");
    }
  }

  let platform: ApplicationSource | null = values.source ? mapSource(values.source) : null;
  if (!platform && postingUrl) platform = detectPlatform(postingUrl);
  if (!platform || platform === "OTHER") platform = opts.defaultPlatform ?? platform;

  const optional = (v: string, max: number, label: string) => {
    if (!v) return null;
    if (v.length > max) warnings.push(`${label} was shortened to ${max} characters.`);
    return clip(v, max);
  };

  if (errors.length) return { rowNumber, blank: false, value: null, errors, warnings };
  return {
    rowNumber,
    blank: false,
    errors,
    warnings,
    value: {
      company: values.company,
      title: values.title,
      appliedDay,
      kind,
      statusText: values.status || null,
      postingUrl,
      normalizedUrl,
      platform,
      location: optional(values.location, LIMITS.location, "Location"),
      salaryText: optional(values.salary, LIMITS.salary, "Salary"),
      requisitionId: optional(values.requisition, LIMITS.requisition, "Requisition"),
      notes: optional(values.notes, LIMITS.notes, "Notes"),
    },
  };
}

export const OBSERVATION_KIND_LABELS: Record<ObservationKind, string> = {
  JOB_SEEN: "Saved",
  APPLY_STARTED: "Started",
  SUBMITTED: "Applied",
  ACKNOWLEDGED: "Acknowledged",
  RECRUITER_RESPONSE: "Recruiter response",
  ASSESSMENT_INVITED: "Assessment",
  INTERVIEW_INVITED: "Interview",
  REJECTED: "Rejected",
  OFFER: "Offer",
  ONBOARDING: "Hired / onboarding",
  USER_CONFIRMED_SUBMISSION: "Applied",
};
