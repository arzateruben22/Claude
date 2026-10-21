/**
 * Analytics filter state: URL searchParams ⇄ typed filters, plus date-range resolution.
 * Pure; shared by the page (GET form) and the CSV export route so both honor identical filters.
 */
import { ApplicationSource, ApplicationStatus } from "@/generated/prisma/enums";
import { addDaysKey, isValidDayKey } from "@/lib/analytics/time";

export const RANGE_PRESETS = ["7d", "30d", "90d", "campaign", "all", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  campaign: "This campaign",
  all: "All time",
  custom: "Custom dates",
};

export const DEFAULT_RANGE: RangePreset = "all";

export type AnalyticsFilters = {
  range: RangePreset;
  /** Day keys (YYYY-MM-DD); only used when range = custom. */
  from?: string;
  to?: string;
  status?: ApplicationStatus[];
  source?: ApplicationSource[];
  category?: string;
  employer?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  includeArchived: boolean;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export type ResolvedRange = {
  preset: RangePreset;
  /** Inclusive day keys; null = unbounded. */
  fromKey: string | null;
  toKey: string | null;
  /** Human description, e.g. "Last 30 days (Sep 22 – Oct 21)". */
  label: string;
};

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined ? undefined : s;
}

function list(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
}

function isStatus(v: string): v is ApplicationStatus {
  return Object.prototype.hasOwnProperty.call(ApplicationStatus, v);
}

function isSource(v: string): v is ApplicationSource {
  return Object.prototype.hasOwnProperty.call(ApplicationSource, v);
}

function isPreset(v: string | undefined): v is RangePreset {
  return v !== undefined && (RANGE_PRESETS as readonly string[]).includes(v);
}

function money(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : undefined;
}

function text(v: string | undefined, max: number): string | undefined {
  const s = v?.trim().slice(0, max);
  return s ? s : undefined;
}

/** URLSearchParams → the record shape Next hands pages (repeated keys become arrays). */
export function searchParamsToRecord(sp: URLSearchParams): SearchParams {
  const out: SearchParams = {};
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export function parseAnalyticsFilters(sp: SearchParams): AnalyticsFilters {
  const rangeRaw = first(sp.range);
  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  let from = isValidDayKey(fromRaw) ? fromRaw : undefined;
  let to = isValidDayKey(toRaw) ? toRaw : undefined;
  if (from && to && from > to) [from, to] = [to, from];

  let range: RangePreset;
  if (isPreset(rangeRaw)) range = rangeRaw;
  else range = from || to ? "custom" : DEFAULT_RANGE;
  // Dates given with the default preset mean "custom"; an explicit preset wins over stray dates.
  if (range === "all" && rangeRaw === undefined && (from || to)) range = "custom";
  if (range === "custom" && !from && !to) range = DEFAULT_RANGE;
  if (range !== "custom") {
    from = undefined;
    to = undefined;
  }

  const status = Array.from(new Set(list(sp.status).map((s) => s.toUpperCase()).filter(isStatus)));
  const source = Array.from(new Set(list(sp.source).map((s) => s.toUpperCase()).filter(isSource)));
  const salaryMin = money(first(sp.salaryMin));
  const salaryMax = money(first(sp.salaryMax));
  const archivedRaw = first(sp.archived);

  return {
    range,
    from,
    to,
    status: status.length ? status : undefined,
    source: source.length ? source : undefined,
    category: text(first(sp.category), 80),
    employer: text(first(sp.employer), 200),
    salaryMin: salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax ? salaryMax : salaryMin,
    salaryMax: salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax ? salaryMin : salaryMax,
    location: text(first(sp.location), 160),
    includeArchived: archivedRaw === "1" || archivedRaw === "true" || archivedRaw === "on",
  };
}

/** Query string (without "?") for a filter state; empty when everything is at its default. */
export function analyticsQueryString(f: AnalyticsFilters): string {
  const p = new URLSearchParams();
  if (f.range !== DEFAULT_RANGE) p.set("range", f.range);
  if (f.range === "custom") {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  }
  if (f.status?.length) p.set("status", f.status.join(","));
  if (f.source?.length) p.set("source", f.source.join(","));
  if (f.category) p.set("category", f.category);
  if (f.employer) p.set("employer", f.employer);
  if (f.salaryMin !== undefined) p.set("salaryMin", String(f.salaryMin));
  if (f.salaryMax !== undefined) p.set("salaryMax", String(f.salaryMax));
  if (f.location) p.set("location", f.location);
  if (f.includeArchived) p.set("archived", "1");
  return p.toString();
}

/** `/analytics?...` for a filter state; `overrides` replace fields, `null` clears one. */
export function analyticsHref(filters: AnalyticsFilters, overrides: Partial<{ [K in keyof AnalyticsFilters]: AnalyticsFilters[K] | null }> = {}): string {
  const f: AnalyticsFilters = { ...filters };
  for (const [k, v] of Object.entries(overrides)) {
    const key = k as keyof AnalyticsFilters;
    if (v === null) delete f[key];
    else (f as Record<string, unknown>)[key] = v;
  }
  if (!f.range) f.range = DEFAULT_RANGE;
  if (f.includeArchived === undefined) f.includeArchived = false;
  const qs = analyticsQueryString(f);
  return qs ? `/analytics?${qs}` : "/analytics";
}

/** `/api/export/applications?...` carrying the same filters as the page. */
export function exportHref(filters: AnalyticsFilters): string {
  const qs = analyticsQueryString(filters);
  return qs ? `/api/export/applications?${qs}` : "/api/export/applications";
}

export function hasActiveFilters(f: AnalyticsFilters): boolean {
  return Boolean(
    f.range !== DEFAULT_RANGE ||
      f.status?.length ||
      f.source?.length ||
      f.category ||
      f.employer ||
      f.salaryMin !== undefined ||
      f.salaryMax !== undefined ||
      f.location ||
      f.includeArchived,
  );
}

const rangeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
function fmtKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return rangeFmt.format(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)));
}

/** Turn a preset into concrete day keys relative to the user's "today" and campaign start. */
export function resolveRange(filters: AnalyticsFilters, ctx: { todayKey: string; campaignStartKey: string | null }): ResolvedRange {
  const { todayKey } = ctx;
  const span = (days: number, preset: RangePreset) => {
    const fromKey = addDaysKey(todayKey, -(days - 1));
    return { preset, fromKey, toKey: todayKey, label: `${RANGE_LABELS[preset]} (${fmtKey(fromKey)} – ${fmtKey(todayKey)})` };
  };
  switch (filters.range) {
    case "7d":
      return span(7, "7d");
    case "30d":
      return span(30, "30d");
    case "90d":
      return span(90, "90d");
    case "campaign": {
      if (!ctx.campaignStartKey) return { preset: "campaign", fromKey: null, toKey: null, label: "All time (no campaign start recorded)" };
      const fromKey = ctx.campaignStartKey > todayKey ? todayKey : ctx.campaignStartKey;
      return { preset: "campaign", fromKey, toKey: todayKey, label: `This campaign (since ${fmtKey(fromKey)})` };
    }
    case "custom": {
      const fromKey = filters.from ?? null;
      const toKey = filters.to ?? null;
      const label =
        fromKey && toKey ? `${fmtKey(fromKey)} – ${fmtKey(toKey)}` : fromKey ? `From ${fmtKey(fromKey)}` : toKey ? `Through ${fmtKey(toKey)}` : "All time";
      return { preset: "custom", fromKey, toKey, label };
    }
    case "all":
    default:
      return { preset: "all", fromKey: null, toKey: null, label: "All time" };
  }
}
