/** Client-safe result types shared by the import actions and the import UI. */
import type { ImportKind, SyncStatus } from "@/generated/prisma/enums";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";
import type { ColumnMapping } from "./mapping";
import type { ImportTotals } from "./outcome";
import type { PresetId } from "./presets";
import type { TableRow } from "./table";

export type RowIssueType = "error" | "needs_review" | "ignored" | "warning";

export type RowIssue = {
  /** Spreadsheet row, URL line, or message number (1-based). */
  row: number;
  type: RowIssueType;
  message: string;
};

export type ImportSummaryData = {
  batchId: string;
  kind: ImportKind;
  fileName: string | null;
  status: SyncStatus;
  totals: ImportTotals;
  issues: RowIssue[];
  /** More issues existed than are listed. */
  issuesTruncated: boolean;
  /** One-line summary for toasts. */
  message: string;
  /** Items from this import can land in /applications/review (email imports only). */
  reviewQueue: boolean;
  /** What the row/line numbers in `issues` refer to. */
  unit: "row" | "line" | "message";
};

export type SpreadsheetFormat = "csv" | "tsv" | "xlsx";

export type AnalyzeData = {
  fileName: string;
  format: SpreadsheetFormat;
  preset: PresetId;
  headers: string[];
  headerRowNumber: number;
  /** First 20 data rows (only kept columns). */
  previewRows: TableRow[];
  rowCount: number;
  blankRows: number;
  /** Columns removed because they hold personal data (never shown or stored). */
  droppedHeaders: string[];
  suggested: ColumnMapping;
  /** Today in the user's timezone (for the future-date check in the preview). */
  todayKey: string;
  warnings: string[];
  message: string;
};

export const MAX_LISTED_ISSUES = 200;

/** The ingestion engine's signature (the real one is ingestObservation; tests inject fakes). */
export type IngestFn = (userId: string, observation: ApplicationObservation) => Promise<IngestResult>;
