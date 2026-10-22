/**
 * Turn parsed spreadsheet rows into a table: detect the header row, drop columns that must never be
 * imported, and number the data rows like the spreadsheet does (1-based, header included). Pure.
 */
import { HEADER_SYNONYMS, IMPORT_FIELDS, normalizeHeader } from "./mapping";
import { keptColumns, type ImportPreset } from "./presets";

export const MAX_DATA_ROWS = 5000;
export const MAX_COLUMNS = 100;
export const MAX_CELL_CHARS = 5000;
const HEADER_SCAN_ROWS = 10;

export type TableRow = { rowNumber: number; cells: string[] };

export type ImportTable = {
  headers: string[];
  /** 1-based spreadsheet row number of the header row. */
  headerRowNumber: number;
  rows: TableRow[];
  blankRows: number;
  /** Header names of columns removed because they hold personal data or the preset excludes them. */
  droppedHeaders: string[];
};

const KNOWN_HEADERS = new Set(IMPORT_FIELDS.flatMap((f) => HEADER_SYNONYMS[f]));

function isBlank(row: readonly string[]): boolean {
  return row.every((c) => !c || !c.trim());
}

function looksLikeData(v: string): boolean {
  const t = v.trim();
  return /^[\d$€£.,:/\-\s%]+$/.test(t) || /^https?:\/\//i.test(t) || t.length > 60;
}

/** Index of the header row among the first rows: the one naming the most known columns. */
export function detectHeaderRow(rows: readonly (readonly string[])[]): number {
  let best = -1;
  let bestScore = 0;
  let firstNonBlank = -1;
  for (let i = 0; i < rows.length && i < HEADER_SCAN_ROWS; i++) {
    const row = rows[i]!;
    if (isBlank(row)) continue;
    if (firstNonBlank < 0) firstNonBlank = i;
    let known = 0;
    let texty = 0;
    for (const c of row) {
      const h = normalizeHeader(c ?? "");
      if (!h) continue;
      if (KNOWN_HEADERS.has(h)) known++;
      if (!looksLikeData(c)) texty++;
    }
    const score = known * 3 + (known > 0 ? texty : 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  return firstNonBlank >= 0 ? firstNonBlank : 0;
}

function cleanCell(v: unknown): string {
  const s = typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
  const t = s.replace(/\r\n?/g, "\n").trim();
  return t.length > MAX_CELL_CHARS ? t.slice(0, MAX_CELL_CHARS) : t;
}

export type BuildTableResult = { ok: true; table: ImportTable } | { ok: false; error: string };

export function buildTable(rawRows: readonly (readonly string[])[], preset: ImportPreset): BuildTableResult {
  if (!rawRows.length || rawRows.every(isBlank)) return { ok: false, error: "The file has no rows." };
  const headerIndex = detectHeaderRow(rawRows);
  const rawHeaders = (rawRows[headerIndex] ?? []).map(cleanCell);
  const width = Math.max(rawHeaders.length, ...rawRows.slice(headerIndex + 1, headerIndex + 51).map((r) => r.length));
  if (width > MAX_COLUMNS) return { ok: false, error: `The file has ${width} columns; at most ${MAX_COLUMNS} are supported.` };
  const fullHeaders = Array.from({ length: width }, (_, i) => rawHeaders[i] || `Column ${i + 1}`);

  const keep = keptColumns(fullHeaders, preset);
  const droppedHeaders = fullHeaders.filter((_, i) => !keep.includes(i));
  const headers = keep.map((i) => fullHeaders[i]!);

  const rows: TableRow[] = [];
  let blankRows = 0;
  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const raw = rawRows[r]!;
    const cells = keep.map((i) => cleanCell(raw[i]));
    if (cells.every((c) => !c)) {
      blankRows++;
      continue;
    }
    rows.push({ rowNumber: r + 1, cells });
    if (rows.length > MAX_DATA_ROWS) {
      return { ok: false, error: `The file has more than ${MAX_DATA_ROWS.toLocaleString("en-US")} data rows. Split it into smaller files and import each one.` };
    }
  }
  if (!rows.length) return { ok: false, error: "The file has a header row but no data rows." };
  return { ok: true, table: { headers, headerRowNumber: headerIndex + 1, rows, blankRows, droppedHeaders } };
}
