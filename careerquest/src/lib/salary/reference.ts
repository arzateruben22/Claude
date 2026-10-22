/**
 * Cited wage references from `data/seed/certification_facts.json` (`wages`). Pure parser: given the
 * parsed JSON, extract only values that carry a source, an effective date and a verification note.
 * Anything that cannot be parsed is returned as null (the UI then asks the user to enter their own
 * figure) rather than guessed. When the research is updated, the parsed values follow without code
 * changes; the shapes are pinned by tests against the real file.
 */

export type VerificationStatus = "verified" | "partial" | "unverified";

export type CitedValue = {
  value: number;
  /** ISO dates (YYYY-MM-DD) the value applies to; `to` null = until superseded / not stated. */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: string;
  sourceUrls: string[];
  status: VerificationStatus;
  /** Verification note quoted from the research file. */
  statusNote: string | null;
  /** Date the research was last checked (YYYY-MM-DD). */
  checkedOn: string | null;
};

export type ApprenticeshipReference = {
  classification: string;
  /** Journeyman base hourly rate (USD/hour). */
  journeymanRate: CitedValue | null;
  /** First-period apprentice percentage of journeyman (e.g. 40). */
  firstPeriodPercent: CitedValue | null;
  /** First-period apprentice hourly rate quoted with the percentage (e.g. 26.00). */
  firstPeriodRate: number | null;
  /** Further schedule steps quoted in the source (text, for the user's reference only). */
  laterSteps: string | null;
  /** Unverified note about a newer agreement / rate, when the research has one. */
  successorNote: string | null;
};

export type MarketPoint = { label: string; annual: number | null; hourly: number | null };

export type MarketReference = {
  key: string;
  label: string;
  area: string;
  /** "the Los Angeles–Long Beach–Anaheim metro area" — for sentences. */
  areaLabel: string;
  /** Survey period, e.g. "May 2025". */
  period: string;
  /** Short attribution for scripts, e.g. "BLS Occupational Employment and Wage Statistics". */
  citeAs: string;
  points: MarketPoint[];
  source: string;
  sourceUrls: string[];
  status: VerificationStatus;
  statusNote: string | null;
  checkedOn: string | null;
};

export type WageReferences = {
  /** Occupation all market references describe. */
  occupation: string;
  apprenticeship: ApprenticeshipReference | null;
  market: MarketReference[];
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const urls = (v: unknown): string[] => (Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)) : []);
const isoDate = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function ymd(year: string, monthName: string, day: string): string | null {
  const m = MONTHS[monthName.slice(0, 3).toLowerCase()];
  if (!m) return null;
  return `${year}-${m}-${day.padStart(2, "0")}`;
}

/**
 * "baseHourly_Jan26_to_Jun30_2026" → { from: 2026-01-26, to: 2026-06-30 };
 * "baseHourly_Jul28_2025_to_Jan25_2026" → { from: 2025-07-28, to: 2026-01-25 }.
 */
export function parseRateKey(key: string): { from: string; to: string } | null {
  const m = /^baseHourly_([A-Za-z]{3})(\d{1,2})(?:_(\d{4}))?_to_([A-Za-z]{3})(\d{1,2})_(\d{4})$/.exec(key);
  if (!m) return null;
  const toYear = m[6]!;
  const from = ymd(m[3] ?? toYear, m[1]!, m[2]!);
  const to = ymd(toYear, m[4]!, m[5]!);
  return from && to ? { from, to } : null;
}

export function statusFrom(v: unknown): { status: VerificationStatus; note: string | null } {
  if (v === true) return { status: "verified", note: null };
  if (v === false) return { status: "unverified", note: null };
  const s = str(v);
  if (!s) return { status: "unverified", note: null };
  if (/^partial/i.test(s)) return { status: "partial", note: s };
  if (/\bunverified\b/i.test(s)) return { status: "unverified", note: s };
  if (/\bverified\b/i.test(s)) return { status: "verified", note: s };
  return { status: "unverified", note: s };
}

function journeyman(wages: Obj, checkedOn: string | null): { rate: CitedValue | null; successor: string | null; classification: string | null } {
  const j = wages.ibewLocal11Journeyman;
  if (!isObj(j)) return { rate: null, successor: null, classification: null };
  let best: { from: string; to: string; value: number } | null = null;
  for (const [key, value] of Object.entries(j)) {
    const range = parseRateKey(key);
    const v = num(value);
    if (!range || v === null || v <= 0) continue;
    if (!best || range.to > best.to) best = { ...range, value: v };
  }
  const { status, note } = statusFrom(j.verified);
  const source = str(j.source);
  return {
    classification: str(j.classification),
    successor: str(j.successorAgreement),
    rate:
      best && source
        ? {
            value: best.value,
            effectiveFrom: best.from,
            effectiveTo: best.to,
            source,
            sourceUrls: urls(j.sourceUrls),
            status,
            statusNote: note,
            checkedOn: isoDate(j.verifiedOn) ?? checkedOn,
          }
        : null,
  };
}

const APPRENTICE_RE = /(\d{1,3}(?:\.\d+)?)% of journeyman rate at 0 hours \(\$(\d+(?:\.\d{1,2})?)\/hr effective (\d{2})\/(\d{2})\/(\d{4})\)/;

function apprentice(wages: Obj, checkedOn: string | null): { pct: CitedValue | null; rate: number | null; laterSteps: string | null } {
  const a = wages.apprenticeStart;
  if (!isObj(a)) return { pct: null, rate: null, laterSteps: null };
  const text = str(a.ibew11InsideWireman);
  const m = text ? APPRENTICE_RE.exec(text) : null;
  if (!text || !m) return { pct: null, rate: null, laterSteps: null };
  const pct = Number(m[1]);
  const rate = Number(m[2]);
  const effectiveFrom = `${m[5]}-${m[3]}-${m[4]}`;
  // The entry's own verification marker ("… VERIFIED." / "UNVERIFIED") wins over the group's.
  const own = /\bUNVERIFIED\b/.test(text) ? "unverified" : /\bVERIFIED\b/.test(text) ? "verified" : null;
  const group = statusFrom(a.verified);
  const sourceUrls = urls(a.sourceUrls);
  const notice = sourceUrls.find((u) => /laett\.com/i.test(u));
  const later = /stepping up with OJT hours \(([^)]*)\)/.exec(text);
  return {
    pct:
      pct > 0 && pct <= 100
        ? {
            value: pct,
            effectiveFrom,
            effectiveTo: null,
            source: /Official ETI notice/i.test(text) ? "Electrical Training Institute (IBEW Local 11 / LA NECA JATC) official Inside Wireman notice" : "Research file (apprentice starting percentage)",
            sourceUrls: notice ? [notice] : sourceUrls,
            status: own ?? group.status,
            statusNote: own ? null : group.note,
            checkedOn: isoDate(a.verifiedOn) ?? checkedOn,
          }
        : null,
    rate: Number.isFinite(rate) && rate > 0 ? rate : null,
    laterSteps: later ? later[1]!.trim() : null,
  };
}

const MARKET_SPECS: { key: string; label: string; areaLabel: string; period: string; citeAs: string; fields: [string, string, string | null][] }[] = [
  {
    key: "losAngeles2025",
    label: "Electricians, Los Angeles–Long Beach–Anaheim metro, May 2025",
    areaLabel: "the Los Angeles–Long Beach–Anaheim metro area",
    period: "May 2025",
    citeAs: "O*NET local wage data citing BLS OEWS",
    fields: [
      ["10th percentile", "pct10Annual", null],
      ["25th percentile", "pct25Annual", "pct25Hourly"],
      ["Median", "medianAnnual", "medianHourly"],
      ["75th percentile", "pct75Annual", "pct75Hourly"],
      ["90th percentile", "pct90Annual", "pct90Hourly"],
    ],
  },
  {
    key: "losAngeles2023Official",
    label: "Electricians, Los Angeles–Long Beach–Anaheim metro, May 2023",
    areaLabel: "the Los Angeles–Long Beach–Anaheim metro area",
    period: "May 2023",
    citeAs: "BLS Occupational Employment and Wage Statistics",
    fields: [["Mean", "meanAnnual", "meanHourly"]],
  },
  {
    key: "national2025",
    label: "Electricians, United States, May 2025",
    areaLabel: "the United States",
    period: "May 2025",
    citeAs: "BLS Occupational Employment and Wage Statistics",
    fields: [["Median", "medianAnnual", "medianHourly"]],
  },
];

function market(wages: Obj, checkedOn: string | null): MarketReference[] {
  const out: MarketReference[] = [];
  for (const spec of MARKET_SPECS) {
    const w = wages[spec.key];
    if (!isObj(w)) continue;
    const source = str(w.source);
    if (!source) continue;
    const points: MarketPoint[] = [];
    for (const [label, annualKey, hourlyKey] of spec.fields) {
      const annual = num(w[annualKey]);
      const hourly = hourlyKey ? num(w[hourlyKey]) : null;
      if (annual !== null || hourly !== null) points.push({ label, annual, hourly });
    }
    if (points.length === 0) continue;
    const { status, note } = statusFrom(w.verified);
    out.push({
      key: spec.key,
      label: spec.label,
      area: str(w.area) ?? (spec.key === "national2025" ? "United States" : ""),
      areaLabel: spec.areaLabel,
      period: spec.period,
      citeAs: spec.citeAs,
      points,
      source,
      sourceUrls: urls(w.sourceUrls),
      status,
      statusNote: str(w.verificationNote) ?? note,
      checkedOn: isoDate(w.verifiedOn) ?? checkedOn,
    });
  }
  return out;
}

/** Extract the cited wage references from the parsed certification facts JSON. */
export function parseWageReferences(facts: unknown): WageReferences {
  const empty: WageReferences = { occupation: "Electricians (SOC 47-2111)", apprenticeship: null, market: [] };
  if (!isObj(facts) || !isObj(facts.wages)) return empty;
  const wages = facts.wages;
  const checkedOn = isoDate(wages.verifiedOn) ?? isoDate(facts.verifiedOn);
  const j = journeyman(wages, checkedOn);
  const ap = apprentice(wages, checkedOn);
  const apprenticeship: ApprenticeshipReference | null =
    j.rate || ap.pct
      ? {
          classification: j.classification ?? "IBEW Local 11 Inside Wireman (Los Angeles County)",
          journeymanRate: j.rate,
          firstPeriodPercent: ap.pct,
          firstPeriodRate: ap.rate,
          laterSteps: ap.laterSteps,
          successorNote: j.successor,
        }
      : null;
  return { ...empty, apprenticeship, market: market(wages, checkedOn) };
}

/** True when the value's effective period ended before `todayKey` (YYYY-MM-DD). */
export function isExpired(v: Pick<CitedValue, "effectiveTo">, todayKey: string): boolean {
  return v.effectiveTo !== null && v.effectiveTo < todayKey;
}
