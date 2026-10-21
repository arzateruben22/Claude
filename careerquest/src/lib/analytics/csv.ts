/**
 * CSV export of applications. Pure: builds rows and CSV text; the route handler streams it.
 * Quoting is left entirely to papaparse. Cells that start with a formula trigger are prefixed
 * with a single quote so a spreadsheet never executes user-entered text.
 */
import Papa from "papaparse";
import type { ApplicationSource, ApplicationStatus, EmploymentType, RecordOrigin, SalaryPeriod } from "@/generated/prisma/enums";

export const EXPORT_COLUMNS = [
  "id",
  "company",
  "title",
  "status",
  "source",
  "location",
  "appliedAt",
  "statusUpdatedAt",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "employmentType",
  "jobCategory",
  "postingUrl",
  "requisitionNumber",
  "followUpAt",
  "recruiterName",
  "createdVia",
  "createdAt",
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Record<ExportColumn, string>;

/** Decimal columns arrive as Prisma Decimal objects; anything with toString() is accepted. */
type DecimalLike = number | string | { toString(): string } | null | undefined;

export type ExportApplication = {
  id: string;
  companyName: string;
  positionTitle: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  location: string | null;
  appliedAt: Date | null;
  statusUpdatedAt: Date;
  salaryMin: DecimalLike;
  salaryMax: DecimalLike;
  salaryPeriod: SalaryPeriod | null;
  employmentType: EmploymentType;
  jobCategory: string | null;
  postingUrl: string | null;
  requisitionNumber: string | null;
  followUpAt: Date | null;
  recruiterContact: { name: string } | null;
  createdVia: RecordOrigin;
  createdAt: Date;
};

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Stringify a cell and neutralise spreadsheet formula injection. */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = Number.isNaN(value.getTime()) ? "" : value.toISOString();
  else if (typeof value === "number") s = Number.isFinite(value) ? String(value) : "";
  else if (typeof value === "string") s = value;
  else if (typeof value === "object" && typeof (value as { toString?: unknown }).toString === "function") s = String(value);
  else s = String(value);
  return FORMULA_TRIGGER.test(s) ? `'${s}` : s;
}

export function toExportRow(app: ExportApplication): ExportRow {
  return {
    id: sanitizeCsvCell(app.id),
    company: sanitizeCsvCell(app.companyName),
    title: sanitizeCsvCell(app.positionTitle),
    status: sanitizeCsvCell(app.status),
    source: sanitizeCsvCell(app.source),
    location: sanitizeCsvCell(app.location),
    appliedAt: sanitizeCsvCell(app.appliedAt),
    statusUpdatedAt: sanitizeCsvCell(app.statusUpdatedAt),
    salaryMin: sanitizeCsvCell(app.salaryMin),
    salaryMax: sanitizeCsvCell(app.salaryMax),
    salaryPeriod: sanitizeCsvCell(app.salaryPeriod),
    employmentType: sanitizeCsvCell(app.employmentType),
    jobCategory: sanitizeCsvCell(app.jobCategory),
    postingUrl: sanitizeCsvCell(app.postingUrl),
    requisitionNumber: sanitizeCsvCell(app.requisitionNumber),
    followUpAt: sanitizeCsvCell(app.followUpAt),
    recruiterName: sanitizeCsvCell(app.recruiterContact?.name ?? null),
    createdVia: sanitizeCsvCell(app.createdVia),
    createdAt: sanitizeCsvCell(app.createdAt),
  };
}

const NEWLINE = "\r\n";

/** The header line (with trailing newline). */
export function csvHeader(): string {
  return Papa.unparse({ fields: [...EXPORT_COLUMNS], data: [] }, { newline: NEWLINE }) + NEWLINE;
}

/** Rows only (no header), each line terminated. Empty string for no rows. */
export function csvChunk(rows: ExportRow[]): string {
  if (rows.length === 0) return "";
  const data = rows.map((r) => EXPORT_COLUMNS.map((c) => r[c]));
  return Papa.unparse(data, { newline: NEWLINE }) + NEWLINE;
}

/** Whole document, for small exports and tests. */
export function csvDocument(rows: ExportRow[]): string {
  return csvHeader() + csvChunk(rows);
}

export function exportFileName(dayKey: string): string {
  return `careerquest-applications-${dayKey}.csv`;
}
