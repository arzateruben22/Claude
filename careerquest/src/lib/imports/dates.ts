/**
 * Calendar-date parsing for imported spreadsheets. Pure (client-safe) — returns a day key
 * ("YYYY-MM-DD"); the caller turns it into an instant in the user's timezone.
 *
 * Accepted: YYYY-MM-DD (optionally with a time), YYYY/MM/DD, MM/DD/YYYY, M/D/YY (US order; when the
 * first number cannot be a month the order is DD/MM), the same with "-" or "." separators, an
 * optional trailing time ("10/14/25, 3:41 PM"), month names ("Jan 5, 2026", "January 5 2026",
 * "5 Jan 2026", "Mon, Jan 5, 2026", "5-Jan-26"), and Excel serial day numbers.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const TIME_SUFFIX = String.raw`(?:[,\sT]+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:[ap]\.?m\.?)?(?:\s*(?:z|[+-]\d{2}:?\d{2}|[a-z]{2,5}))?)?`;

const ISO = new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${TIME_SUFFIX}$`, "i");
const NUMERIC = new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})${TIME_SUFFIX}$`, "i");
const MONTH_FIRST = new RegExp(
  String.raw`^(?:[a-z]{3,9},?\s+)?(${MONTH_NAMES})\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s-]+(\d{4}|\d{2})${TIME_SUFFIX}$`,
  "i",
);
const DAY_FIRST = new RegExp(
  String.raw`^(?:[a-z]{3,9},?\s+)?(\d{1,2})(?:st|nd|rd|th)?[\s-]+(${MONTH_NAMES})\.?,?[\s-]+(\d{4}|\d{2})${TIME_SUFFIX}$`,
  "i",
);
const EXCEL_SERIAL = /^(\d{5})(?:\.\d+)?$/;

const pad = (n: number) => String(n).padStart(2, "0");

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

function dayKey(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day key for an Excel serial number (1900 date system, as written by Excel on Windows and macOS since 2011). */
export function excelSerialToDayKey(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 32874 /* 1990-01-01 */ || serial > 73051 /* 2100-01-01 */) return null;
  const ms = Math.round((serial - 25569) * 86_400_000); // 25569 = 1970-01-01
  const d = new Date(ms);
  return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export type DateParse = { ok: true; day: string } | { ok: false };

/** Parse a spreadsheet date cell. Empty input is not a date (callers treat it as "no date"). */
export function parseImportDate(value: string | null | undefined): DateParse {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  if (!v) return { ok: false };

  let m = ISO.exec(v);
  if (m) {
    const k = dayKey(Number(m[1]), Number(m[2]), Number(m[3]));
    return k ? { ok: true, day: k } : { ok: false };
  }
  m = NUMERIC.exec(v);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(m[3]!);
    // US order (MM/DD) unless the first number cannot be a month.
    const [month, day] = a > 12 && b <= 12 ? [b, a] : [a, b];
    const k = dayKey(y, month, day);
    return k ? { ok: true, day: k } : { ok: false };
  }
  m = MONTH_FIRST.exec(v);
  if (m) {
    const k = dayKey(fullYear(m[3]!), MONTHS[m[1]!.toLowerCase()]!, Number(m[2]));
    return k ? { ok: true, day: k } : { ok: false };
  }
  m = DAY_FIRST.exec(v);
  if (m) {
    const k = dayKey(fullYear(m[3]!), MONTHS[m[2]!.toLowerCase()]!, Number(m[1]));
    return k ? { ok: true, day: k } : { ok: false };
  }
  m = EXCEL_SERIAL.exec(v);
  if (m) {
    const k = excelSerialToDayKey(Number(v));
    return k ? { ok: true, day: k } : { ok: false };
  }
  return { ok: false };
}
