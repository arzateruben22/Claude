/**
 * CSV export of the work-hour log. Pure. Quoting is left to papaparse; cells that start with a
 * spreadsheet formula trigger are prefixed with a single quote so user text never executes.
 */
import Papa from "papaparse";
import type { HourVerification, WorkType } from "@/generated/prisma/enums";
import { VERIFICATION_LABELS, WORK_TYPE_LABELS } from "./constants";

export const HOURS_CSV_COLUMNS = [
  "date",
  "hours",
  "employer",
  "supervisor",
  "work_type",
  "verification",
  "counts_as_verified",
  "document",
  "program",
  "description",
  "logged_at",
] as const;

export type HoursCsvEntry = {
  dateKey: string;
  hours: number;
  employer: string;
  supervisor: string | null;
  workType: WorkType;
  verification: HourVerification;
  documentName: string | null;
  programName: string | null;
  description: string | null;
  createdAt: Date;
};

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvSafe(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

export function hoursCsv(entries: readonly HoursCsvEntry[]): string {
  const data = entries.map((e) => [
    e.dateKey,
    e.hours.toFixed(2),
    csvSafe(e.employer),
    csvSafe(e.supervisor ?? ""),
    WORK_TYPE_LABELS[e.workType],
    VERIFICATION_LABELS[e.verification],
    e.verification === "SELF_REPORTED" ? "no" : "yes",
    csvSafe(e.documentName ?? ""),
    csvSafe(e.programName ?? ""),
    csvSafe(e.description ?? ""),
    e.createdAt.toISOString(),
  ]);
  return Papa.unparse({ fields: [...HOURS_CSV_COLUMNS], data }, { newline: "\r\n" });
}

export function hoursCsvFileName(todayKey: string): string {
  return `careerquest-work-hours-${todayKey}.csv`;
}
