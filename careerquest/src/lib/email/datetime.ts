/**
 * Explicit date + time extraction from email text ("Tuesday, March 10, 2026 … 10:00 AM (Pacific)",
 * "Thu 4/16 2:30 PM PT", "INTERVIEW DATE: Saturday, February 21, 2026 REPORT TIME: 8:00 AM").
 *
 * Only a date paired with a clock time becomes a candidate — a bare date is never turned into an
 * appointment. Without a zone the time is read as America/Los_Angeles wall-clock time. A missing year
 * is resolved from the weekday when one is given, otherwise from the reference date (the email's Date
 * header).
 */
import { zonedToUtc } from "@/lib/applications/time";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4,
  thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

/** Zone words → IANA zone. Abbreviations map to the region's wall clock (people write "PST" in July). */
const ZONES: Array<[RegExp, string]> = [
  [/^(pt|pst|pdt|pacific( (standard|daylight))?( time)?)$/i, "America/Los_Angeles"],
  [/^(et|est|edt|eastern( (standard|daylight))?( time)?)$/i, "America/New_York"],
  [/^(ct|cst|cdt|central( (standard|daylight))?( time)?)$/i, "America/Chicago"],
  [/^(mt|mst|mdt|mountain( (standard|daylight))?( time)?)$/i, "America/Denver"],
  [/^(utc|gmt|z)$/i, "UTC"],
];

const WD = "(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)";
const MON =
  "(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)";

// "Tuesday, March 10, 2026" · "Mar. 10th" · "March 10 2026"
const DATE_MONTH_FIRST = new RegExp(
  `\\b(?:(${WD})\\.?,?\\s+)?(${MON})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`,
  "gi",
);
// "10 March 2026" · "Tuesday 10 March"
const DATE_DAY_FIRST = new RegExp(
  `\\b(?:(${WD})\\.?,?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON})\\.?\\b(?:,?\\s+(\\d{4})\\b)?`,
  "gi",
);
// "Thu 4/16" · "4/16/2026" · "04/16/26"
const DATE_NUMERIC = new RegExp(`\\b(?:(${WD})\\.?,?\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?\\b`, "gi");
// "2026-04-16"
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

const TIME =
  /\b(?:(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?\s?m\b\.?|([01]?\d|2[0-3]):([0-5]\d)(?!\s*[ap]\.?\s?m)\b|(noon))/gi;
const ZONE_AFTER =
  /^\s*(?:[-–—to]+\s*\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*)?\(?\s*(pt|pst|pdt|pacific(?: (?:standard|daylight))?(?: time)?|et|est|edt|eastern(?: (?:standard|daylight))?(?: time)?|ct|cst|cdt|central(?: (?:standard|daylight))?(?: time)?|mt|mst|mdt|mountain(?: (?:standard|daylight))?(?: time)?|utc|gmt)\b/i;

type DateMention = {
  index: number;
  end: number;
  year: number | null;
  month: number;
  day: number;
  weekday: number | null;
};
type TimeMention = { index: number; end: number; hour: number; minute: number; zone: string | null };

export type DateTimeCandidate = {
  at: Date;
  /** Offset of the date mention in the searched text. */
  index: number;
  /** ~120 characters before the date mention, lower-cased (for context checks). */
  before: string;
  explicitYear: boolean;
};

function validDay(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function findDates(text: string): DateMention[] {
  const out: DateMention[] = [];
  const push = (index: number, end: number, y: string | undefined, m: number, d: number, wd: string | undefined) => {
    if (!validDay(m, d)) return;
    let year: number | null = y ? Number(y) : null;
    if (year !== null && year < 100) year += 2000;
    out.push({ index, end, year, month: m, day: d, weekday: wd ? (WEEKDAYS[wd.toLowerCase()] ?? null) : null });
  };
  for (const m of text.matchAll(DATE_MONTH_FIRST)) {
    push(m.index!, m.index! + m[0].length, m[4], MONTHS[m[2]!.toLowerCase()]!, Number(m[3]), m[1]);
  }
  for (const m of text.matchAll(DATE_DAY_FIRST)) {
    push(m.index!, m.index! + m[0].length, m[4], MONTHS[m[3]!.toLowerCase()]!, Number(m[2]), m[1]);
  }
  for (const m of text.matchAll(DATE_NUMERIC)) {
    // Skip fractions/ratios inside larger numbers ("24/7", "1/2"), which have no weekday or year.
    if (!m[1] && !m[4]) continue;
    push(m.index!, m.index! + m[0].length, m[4], Number(m[2]), Number(m[3]), m[1]);
  }
  for (const m of text.matchAll(DATE_ISO)) {
    push(m.index!, m.index! + m[0].length, m[1], Number(m[2]), Number(m[3]), undefined);
  }
  // Keep the longest mention when patterns overlap.
  out.sort((a, b) => a.index - b.index || b.end - a.end);
  const merged: DateMention[] = [];
  for (const d of out) {
    const last = merged[merged.length - 1];
    if (last && d.index < last.end) continue;
    merged.push(d);
  }
  return merged;
}

function findTimes(text: string): TimeMention[] {
  const out: TimeMention[] = [];
  for (const m of text.matchAll(TIME)) {
    let hour: number;
    let minute = 0;
    if (m[6]) {
      hour = 12;
    } else if (m[3]) {
      hour = Number(m[1]);
      minute = m[2] ? Number(m[2]) : 0;
      if (hour < 1 || hour > 12) continue;
      const pm = m[3].toLowerCase() === "p";
      if (pm && hour !== 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    } else {
      hour = Number(m[4]);
      minute = Number(m[5]);
    }
    const end = m.index! + m[0].length;
    const zoneMatch = ZONE_AFTER.exec(text.slice(end, end + 40));
    let zone: string | null = null;
    if (zoneMatch) {
      const word = zoneMatch[1]!.toLowerCase();
      zone = ZONES.find(([re]) => re.test(word))?.[1] ?? null;
    }
    out.push({ index: m.index!, end, hour, minute, zone });
  }
  return out;
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Resolve a missing year: weekday match first, otherwise the occurrence nearest the reference date. */
function resolveYear(d: DateMention, reference: Date): number {
  if (d.year !== null) return d.year;
  const refYear = reference.getUTCFullYear();
  const years = [refYear, refYear + 1, refYear - 1];
  if (d.weekday !== null) {
    const hit = years.find((y) => weekdayOf(y, d.month, d.day) === d.weekday);
    if (hit !== undefined) return hit;
  }
  // Dates more than ~2 months before the reference are read as next year's.
  const candidate = Date.UTC(refYear, d.month - 1, d.day);
  return candidate < reference.getTime() - 60 * 86_400_000 ? refYear + 1 : refYear;
}

/**
 * Every explicit date paired with a clock time (time after the date within ~60 characters, or just
 * before it as in "at 2:30 PM on Thursday, April 16").
 */
export function findDateTimes(text: string, reference: Date | null): DateTimeCandidate[] {
  const flat = text.replace(/\s+/g, " ");
  const dates = findDates(flat);
  if (!dates.length) return [];
  const times = findTimes(flat);
  const ref = reference ?? new Date();
  const out: DateTimeCandidate[] = [];
  const used = new Set<number>();

  for (const d of dates) {
    let t = times.find((tm) => !used.has(tm.index) && tm.index >= d.end && tm.index - d.end <= 60);
    if (t) {
      // A second date between this date and the time belongs to that date instead.
      const between = dates.find((o) => o !== d && o.index >= d.end && o.index < t!.index);
      if (between) t = undefined;
    }
    if (!t) {
      t = times.find((tm) => !used.has(tm.index) && tm.end <= d.index && d.index - tm.end <= 12 && /\bon\s*$|,\s*$/.test(flat.slice(tm.end, d.index)));
    }
    if (!t) continue;
    used.add(t.index);
    const year = resolveYear(d, ref);
    const at = zonedToUtc(t.zone ?? DEFAULT_TIMEZONE, year, d.month, d.day, t.hour, t.minute);
    if (Number.isNaN(at.getTime())) continue;
    out.push({
      at,
      index: d.index,
      before: flat.slice(Math.max(0, d.index - 120), d.index).toLowerCase(),
      explicitYear: d.year !== null,
    });
  }
  return out;
}

/** Context words that make a date/time a deadline, start date or log entry rather than an appointment. */
const NOT_APPOINTMENT =
  /(deadline|due( date)?|no later than|\bby|until|expires?( on)?|close[sd]?( on)?|closing|start date|first day|start(s|ing)?( on)?|applied( on)?|received( on)?|submitted( on)?|posted( on)?|sent( on)?|wrote|date (submitted|received|applied))\s*:?\s*$/;
const APPOINTMENT_CONTEXT =
  /\b(interview|when|date|time|scheduled|schedule|meet|meeting|call|report|join|appointment|confirm|confirmation|see you|arrive|check-in|on-?site|in-person|video|phone)\b/;

/**
 * The interview appointment, if the text states a fixed date and time for it.
 * Picks the first date+time whose preceding context is appointment-like and not a deadline.
 */
export function extractAppointment(texts: string[], reference: Date | null): Date | null {
  for (const text of texts) {
    if (!text) continue;
    for (const c of findDateTimes(text, reference)) {
      const near = c.before.slice(-30);
      if (NOT_APPOINTMENT.test(near)) continue;
      if (!APPOINTMENT_CONTEXT.test(c.before)) continue;
      return c.at;
    }
  }
  return null;
}
