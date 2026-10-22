import "server-only";
/** .xlsx reading with read-excel-file's Node entry (first worksheet), converted to plain string cells. */
import { readSheet } from "read-excel-file/node";

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel stores wall-clock dates; read-excel-file returns them as UTC instants. Keep the calendar day (and time if any). */
function dateCell(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = d.getUTCHours() || d.getUTCMinutes();
  return hasTime ? `${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}

export function xlsxCellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateCell(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

export type XlsxRead = { ok: true; rows: string[][] } | { ok: false; error: string };

export async function readXlsxRows(bytes: Buffer): Promise<XlsxRead> {
  try {
    const data = await readSheet(bytes);
    return { ok: true, rows: data.map((row) => row.map(xlsxCellToString)) };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "XLS_FILE_NOT_SUPPORTED") return { ok: false, error: "Old .xls files are not supported. Save it as .xlsx or .csv and try again." };
    if (code === "NO_DATA") return { ok: false, error: "The workbook's first sheet is empty." };
    return { ok: false, error: "This .xlsx file could not be read. Re-save it from your spreadsheet app, or export it as .csv." };
  }
}
