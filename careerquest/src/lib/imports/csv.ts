/**
 * Delimited-text parsing (.csv / .tsv) with papaparse. Pure: handles a UTF-8 BOM, quoted fields with
 * commas, quotes and line breaks, CRLF/LF/CR line endings and delimiter detection. Blank rows are kept
 * (as empty arrays) so row numbers in error messages match the file.
 */
import Papa from "papaparse";

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export type DelimitedParse = {
  rows: string[][];
  delimiter: string;
  /** Recoverable parser problems (e.g. an unclosed quote), with 1-based row numbers. */
  warnings: string[];
};

export function parseDelimited(text: string, opts: { delimiter?: "," | "\t" | ";" | "|" } = {}): DelimitedParse {
  const input = stripBom(text);
  const result = Papa.parse<string[]>(input, {
    delimiter: opts.delimiter ?? "",
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  const rows = result.data.map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === "string" ? c : String(c ?? ""))) : []));
  // papaparse yields one trailing [""] row for a final newline; drop it.
  while (rows.length && rows[rows.length - 1]!.every((c) => c.trim() === "")) rows.pop();
  const warnings = result.errors
    .filter((e) => e.type === "Quotes" || e.code === "UndetectableDelimiter")
    .slice(0, 20)
    .map((e) => (e.code === "UndetectableDelimiter" ? "Could not detect the delimiter; assumed commas." : `Row ${(e.row ?? 0) + 1}: ${e.message}`));
  return { rows, delimiter: result.meta.delimiter, warnings };
}
