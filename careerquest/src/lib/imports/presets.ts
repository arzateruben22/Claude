/**
 * Spreadsheet import presets. Pure (client-safe).
 *
 * Columns that hold personal data (phone numbers, email addresses, home addresses, screening answers,
 * identity numbers) are dropped right after parsing for every preset: they are never shown in the
 * preview, never mappable and never stored. The LinkedIn preset additionally drops the export's
 * résumé-name column, keeping only date / company / title / URL.
 */
import type { ApplicationSource, ImportKind } from "@/generated/prisma/enums";
import { normalizeHeader, type ImportField, IMPORT_FIELDS } from "./mapping";

export type PresetId = "generic" | "linkedin" | "ats";

export type ImportPreset = {
  id: PresetId;
  name: string;
  description: string;
  batchKind: Extract<ImportKind, "CSV" | "PLATFORM_EXPORT">;
  defaultPlatform: ApplicationSource | null;
  /** Fields offered in the mapping UI. */
  allowedFields: readonly ImportField[];
  /** Exact header names (case/punctuation-insensitive) to map first. */
  headerHints: Partial<Record<ImportField, readonly string[]>>;
  /** Header names dropped for this preset in addition to the personal-data rule. */
  excludeHeaders: readonly string[];
};

/** Headers whose columns are always dropped (personal data the tracker never needs). */
const SENSITIVE_HEADER =
  /\b(phone|mobile|cell|e ?mail|email address|home address|street|address line|zip code|postal code|ssn|social security|date of birth|birth ?date|dob|password|question|questions|answers?|screening answers?|resume name|cover letter text|gender|race|ethnicity|veteran|disability)\b/;

export function isSensitiveHeader(header: string): boolean {
  return SENSITIVE_HEADER.test(normalizeHeader(header));
}

export const PRESETS: Record<PresetId, ImportPreset> = {
  generic: {
    id: "generic",
    name: "Your own spreadsheet",
    description: "Any .csv, .tsv or .xlsx with one application per row. Columns are matched by their header names.",
    batchKind: "CSV",
    defaultPlatform: null,
    allowedFields: IMPORT_FIELDS,
    headerHints: {},
    excludeHeaders: [],
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn data export (Job Applications.csv)",
    description:
      "Imports only Application Date, Company Name, Job Title and Job Url. Contact email, phone number, résumé name and screening questions/answers are dropped before anything is shown or stored.",
    batchKind: "PLATFORM_EXPORT",
    defaultPlatform: "LINKEDIN",
    allowedFields: ["company", "title", "dateApplied", "url"],
    headerHints: {
      company: ["Company Name"],
      title: ["Job Title"],
      dateApplied: ["Application Date"],
      url: ["Job Url"],
    },
    excludeHeaders: ["Contact Email", "Contact Phone Number", "Resume Name", "Question And Answers"],
  },
  ats: {
    id: "ats",
    name: "Applicant-tracking system export",
    description:
      "A candidate-side export or copy from an ATS portal (Workday, iCIMS, Taleo, SmartRecruiters…) with columns like Requisition ID, Job Title, Status and Applied On.",
    batchKind: "PLATFORM_EXPORT",
    defaultPlatform: null,
    allowedFields: IMPORT_FIELDS,
    headerHints: {
      company: ["Company", "Employer", "Organization", "Hiring Company"],
      title: ["Job Title", "Requisition Title", "Job Posting Title", "Position", "Job"],
      dateApplied: ["Applied On", "Date Applied", "Application Date", "Submitted On", "Submitted Date", "Date Submitted"],
      status: ["Status", "Application Status", "Current Stage", "Stage", "Candidate Status", "Disposition"],
      requisition: ["Requisition ID", "Req ID", "Job Requisition ID", "Requisition Number", "Job ID", "Posting ID"],
      url: ["Job URL", "Posting URL", "Job Link", "Job Posting URL"],
      location: ["Location", "Job Location", "Primary Location", "Work Location"],
    },
    excludeHeaders: [],
  },
};

export function getPreset(id: string | null | undefined): ImportPreset {
  return id && Object.hasOwn(PRESETS, id) ? PRESETS[id as PresetId] : PRESETS.generic;
}

/** Indices of the columns kept for a preset (personal-data and preset-excluded columns removed). */
export function keptColumns(headers: readonly string[], preset: ImportPreset): number[] {
  const excluded = new Set(preset.excludeHeaders.map(normalizeHeader));
  const out: number[] = [];
  headers.forEach((h, i) => {
    if (excluded.has(normalizeHeader(h)) || isSensitiveHeader(h)) return;
    out.push(i);
  });
  return out;
}

/** The headers a preset expects, for detecting that a file is (probably) the right export. */
export const LINKEDIN_EXPORT_HEADERS = [
  "Application Date",
  "Contact Email",
  "Contact Phone Number",
  "Company Name",
  "Job Title",
  "Job Url",
  "Resume Name",
  "Question And Answers",
] as const;

export const LINKEDIN_EXPORT_STEPS = [
  "On LinkedIn, open Me → Settings & Privacy → Data privacy → Get a copy of your data.",
  "Choose “Want something in particular?”, tick Job Applications (or request the larger archive), and select Request archive.",
  "LinkedIn emails you when the archive is ready (often within minutes for selected data, up to 24 hours for the full archive). Download and unzip it.",
  "Upload the Jobs/Job Applications.csv file here. Large histories can be split into several files (Job Applications_1.csv, …); import each one.",
];
