import "server-only";
/**
 * Spreadsheet imports (.csv, .tsv, .xlsx; own trackers, LinkedIn's Job Applications.csv, ATS exports).
 *
 * Every row is re-validated on the server with the same pure code the preview uses, turned into an
 * ApplicationObservation and handed to the ingestion engine:
 *   kind      — from a mapped status column, else SUBMITTED when a date applied exists, else JOB_SEEN
 *   source    — IMPORT, origin CSV_IMPORT, self-reported (verified: false)
 *   evidence  — CSV_ROW with sourceRef = sha256(normalized row), so re-importing the same file
 *               attaches nothing new and creates nothing new.
 */
import { createHash } from "node:crypto";
import { normalizeCompany, normalizeTitle } from "@/lib/applications/normalize";
import { parseDateInput } from "@/lib/applications/time";
import type { ApplicationObservation } from "@/lib/ingest/types";
import { parseDelimited } from "./csv";
import { mappingProblems, suggestMapping, validateRow, type ColumnMapping, type NormalizedRow } from "./mapping";
import { addOutcome, bucketForIngest, emptyTotals, importReason, type ImportTotals } from "./outcome";
import { getPreset, type PresetId } from "./presets";
import { buildTable, type ImportTable } from "./table";
import type { AnalyzeData, ImportSummaryData, IngestFn, RowIssue, SpreadsheetFormat } from "./types";
import { createBatch, finishBatch } from "./batches";
import { readXlsxRows } from "./xlsx";

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROWS = 20;
/** Imported rows are the user's own records: confident, but self-reported (never "verified"). */
export const SPREADSHEET_CONFIDENCE = 0.95;

export function spreadsheetFormat(fileName: string): SpreadsheetFormat | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === "csv" || ext === "tsv" || ext === "xlsx" ? ext : null;
}

function decodeText(bytes: Buffer): { text: string; warning: string | null } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), warning: null };
  } catch {
    // Excel on Windows often saves CSV as Windows-1252.
    return { text: new TextDecoder("windows-1252").decode(bytes), warning: "The file is not UTF-8; it was read as Windows-1252 (Excel's default)." };
  }
}

export type ReadResult = { ok: true; table: ImportTable; format: SpreadsheetFormat; warnings: string[] } | { ok: false; error: string };

/** Parse + content-check a spreadsheet file and build the (column-filtered) table for a preset. */
export async function readSpreadsheet(fileName: string, bytes: Buffer, presetId: PresetId): Promise<ReadResult> {
  const format = spreadsheetFormat(fileName);
  if (!format) return { ok: false, error: "Choose a .csv, .tsv or .xlsx file." };
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_SPREADSHEET_BYTES) return { ok: false, error: "The file is larger than 10 MB. Split it and import each part." };

  let rows: string[][];
  const warnings: string[] = [];
  if (format === "xlsx") {
    if (bytes.subarray(0, 4).toString("binary") !== "PK\u0003\u0004") {
      return { ok: false, error: "This is not an .xlsx workbook (the file content does not match the extension)." };
    }
    const read = await readXlsxRows(bytes);
    if (!read.ok) return read;
    rows = read.rows;
  } else {
    if (bytes.subarray(0, 65536).includes(0)) {
      return { ok: false, error: "This does not look like a text spreadsheet (it contains binary data)." };
    }
    if (bytes.subarray(0, 4).toString("binary") === "PK\u0003\u0004") {
      return { ok: false, error: "This looks like an .xlsx workbook saved with a .csv name. Rename it to .xlsx or export it as CSV." };
    }
    const decoded = decodeText(bytes);
    if (decoded.warning) warnings.push(decoded.warning);
    const parsed = parseDelimited(decoded.text, format === "tsv" ? { delimiter: "\t" } : {});
    warnings.push(...parsed.warnings);
    rows = parsed.rows;
  }
  const built = buildTable(rows, getPreset(presetId));
  if (!built.ok) return built;
  return { ok: true, table: built.table, format, warnings };
}

export async function analyzeSpreadsheet(
  fileName: string,
  bytes: Buffer,
  presetId: PresetId,
  todayKey: string,
): Promise<{ ok: true; data: AnalyzeData } | { ok: false; error: string }> {
  const read = await readSpreadsheet(fileName, bytes, presetId);
  if (!read.ok) return read;
  const preset = getPreset(presetId);
  const { table } = read;
  const suggested = suggestMapping(table.headers, preset.headerHints);
  for (const f of Object.keys(suggested) as (keyof ColumnMapping)[]) {
    if (!preset.allowedFields.includes(f)) delete suggested[f];
  }
  return {
    ok: true,
    data: {
      fileName,
      format: read.format,
      preset: preset.id,
      headers: table.headers,
      headerRowNumber: table.headerRowNumber,
      previewRows: table.rows.slice(0, PREVIEW_ROWS),
      rowCount: table.rows.length,
      blankRows: table.blankRows,
      droppedHeaders: table.droppedHeaders,
      suggested,
      todayKey,
      warnings: read.warnings,
      message: `Read ${table.rows.length} row${table.rows.length === 1 ? "" : "s"} from ${fileName}.`,
    },
  };
}

/** Stable identity of an imported row: the same application row always hashes the same. */
export function rowSourceRef(v: NormalizedRow): string {
  const key = JSON.stringify([
    "csv-row-v1",
    normalizeCompany(v.company),
    normalizeTitle(v.title),
    v.appliedDay ?? "",
    v.normalizedUrl ?? "",
    (v.requisitionId ?? "").toUpperCase(),
    v.kind,
    (v.location ?? "").toLowerCase(),
  ]);
  return createHash("sha256").update(key).digest("hex");
}

export function rowObservation(
  v: NormalizedRow,
  ctx: { timezone: string; now: Date; fileName: string; rowNumber: number; presetId: PresetId },
): ApplicationObservation {
  const observedAt = (v.appliedDay ? parseDateInput(v.appliedDay, ctx.timezone) : null) ?? ctx.now;
  return {
    kind: v.kind,
    source: "IMPORT",
    origin: "CSV_IMPORT",
    observedAt,
    company: v.company,
    title: v.title,
    location: v.location,
    requisitionId: v.requisitionId,
    postingUrl: v.postingUrl,
    platform: v.platform,
    salaryText: v.salaryText,
    confidence: SPREADSHEET_CONFIDENCE,
    verified: false,
    evidence: {
      kind: "CSV_ROW",
      sourceRef: rowSourceRef(v),
      title: `${v.company} — ${v.title}`.slice(0, 200),
      snippet: v.notes,
      data: {
        fileName: ctx.fileName.slice(0, 255),
        row: ctx.rowNumber,
        preset: ctx.presetId,
        appliedDay: v.appliedDay,
        status: v.statusText,
        selfReported: true,
      },
    },
  };
}

export type SpreadsheetImportInput = {
  fileName: string;
  bytes: Buffer;
  presetId: PresetId;
  mapping: ColumnMapping;
  timezone: string;
  todayKey: string;
  now?: Date;
};

export async function importSpreadsheet(
  userId: string,
  input: SpreadsheetImportInput,
  ingest: IngestFn,
): Promise<{ ok: true; data: ImportSummaryData } | { ok: false; error: string }> {
  const read = await readSpreadsheet(input.fileName, input.bytes, input.presetId);
  if (!read.ok) return read;
  const { table } = read;
  const preset = getPreset(input.presetId);
  const mapping: ColumnMapping = {};
  for (const f of preset.allowedFields) if (input.mapping[f] !== undefined) mapping[f] = input.mapping[f];
  const problems = mappingProblems(mapping, table.headers.length);
  if (problems.length) return { ok: false, error: problems[0]! };

  const now = input.now ?? new Date();
  const batch = await createBatch(userId, preset.batchKind, input.fileName);
  const totals: ImportTotals = emptyTotals();
  const issues: RowIssue[] = read.warnings.map((message) => ({ row: 0, type: "warning", message }));

  for (const row of table.rows) {
    const v = validateRow(row.cells, mapping, row.rowNumber, { todayKey: input.todayKey, defaultPlatform: preset.defaultPlatform });
    if (v.blank) continue;
    totals.total++;
    if (!v.value) {
      totals.errors++;
      issues.push({ row: row.rowNumber, type: "error", message: v.errors.join(" ") });
      continue;
    }
    for (const w of v.warnings) issues.push({ row: row.rowNumber, type: "warning", message: w });
    try {
      const result = await ingest(
        userId,
        rowObservation(v.value, { timezone: input.timezone, now, fileName: input.fileName, rowNumber: row.rowNumber, presetId: preset.id }),
      );
      const bucket = bucketForIngest(result);
      addOutcome(totals, bucket);
      if (bucket === "needs_review") {
        issues.push({
          row: row.rowNumber,
          type: "needs_review",
          message: `Not imported: ${importReason(result.reason)} Check the row against your tracker, then edit the existing record or add this one by hand.`,
        });
      } else if (bucket === "ignored") {
        issues.push({ row: row.rowNumber, type: "ignored", message: importReason(result.reason) });
      }
    } catch (err) {
      console.error("spreadsheet import row failed", err);
      totals.errors++;
      issues.push({ row: row.rowNumber, type: "error", message: "Could not be imported because of an internal error." });
    }
  }

  const data = await finishBatch(userId, { id: batch.id, kind: batch.kind, fileName: batch.fileName }, totals, issues, { unit: "row" });
  return { ok: true, data };
}
