import { ApplicationSource, ApplicationStatus } from "@/generated/prisma/enums";
import { dateFromKey } from "@/lib/dates";

/** Pure parsing/serialising of the tracker list's URL state (searchParams ⇄ filters). */

export const LIST_SORTS = [
  "updated",
  "created",
  "applied",
  "company",
  "status",
  "followUp",
] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export const LIST_SORT_LABELS: Record<ListSort, string> = {
  updated: "Recently updated",
  created: "Recently added",
  applied: "Applied date",
  company: "Company A–Z",
  status: "Pipeline stage",
  followUp: "Follow-up due",
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type ListFilters = {
  q?: string;
  status?: ApplicationStatus[];
  source?: ApplicationSource;
  category?: string;
  /** Inclusive calendar day keys (YYYY-MM-DD) */
  from?: string;
  to?: string;
  includeArchived?: boolean;
  sort: ListSort;
  page: number;
  pageSize: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined ? undefined : s;
}

function isStatus(v: string): v is ApplicationStatus {
  return Object.prototype.hasOwnProperty.call(ApplicationStatus, v);
}

function isSource(v: string): v is ApplicationSource {
  return Object.prototype.hasOwnProperty.call(ApplicationSource, v);
}

export function parseListFilters(sp: SearchParams): ListFilters {
  const q = first(sp.q)?.trim().slice(0, 200) || undefined;
  const rawStatus = Array.isArray(sp.status)
    ? sp.status
    : (first(sp.status)?.split(",") ?? []);
  const status = rawStatus.map((s) => s.trim().toUpperCase()).filter(isStatus);
  const sourceRaw = first(sp.source)?.toUpperCase();
  const source = sourceRaw && isSource(sourceRaw) ? sourceRaw : undefined;
  const category = first(sp.category)?.trim().slice(0, 80) || undefined;
  const from = first(sp.from);
  const to = first(sp.to);
  const sortRaw = first(sp.sort);
  const sort = (LIST_SORTS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as ListSort)
    : "updated";
  const pageRaw = Number(first(sp.page));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const sizeRaw = Number(first(sp.pageSize));
  const pageSize =
    Number.isInteger(sizeRaw) && sizeRaw >= 1
      ? Math.min(sizeRaw, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const archivedRaw = first(sp.archived);
  return {
    q,
    status: status.length ? Array.from(new Set(status)) : undefined,
    source,
    category,
    from: from && DAY_KEY.test(from) ? from : undefined,
    to: to && DAY_KEY.test(to) ? to : undefined,
    includeArchived: archivedRaw === "1" || archivedRaw === "true",
    sort,
    page,
    pageSize,
  };
}

/** Build `/applications?...` for a filter state; `overrides` replace fields, `null` clears one. */
export function listHref(
  filters: ListFilters,
  overrides: Partial<{ [K in keyof ListFilters]: ListFilters[K] | null }> = {},
): string {
  const f: ListFilters = { ...filters };
  for (const [k, v] of Object.entries(overrides)) {
    const key = k as keyof ListFilters;
    if (v === null) delete f[key];
    else (f as Record<string, unknown>)[key] = v;
  }
  // Any change other than the page itself resets pagination.
  if (!("page" in overrides)) f.page = 1;
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status?.length) p.set("status", f.status.join(","));
  if (f.source) p.set("source", f.source);
  if (f.category) p.set("category", f.category);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.includeArchived) p.set("archived", "1");
  if (f.sort && f.sort !== "updated") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  if (f.pageSize !== DEFAULT_PAGE_SIZE) p.set("pageSize", String(f.pageSize));
  const qs = p.toString();
  return qs ? `/applications?${qs}` : "/applications";
}

/** Date range (UTC instants) for a from/to day-key pair: [start of from, start of day after to). */
export function dayRange(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } {
  const out: { gte?: Date; lt?: Date } = {};
  if (from) out.gte = dateFromKey(from);
  if (to) {
    const d = dateFromKey(to);
    out.lt = new Date(d.getTime() + 86400000);
  }
  return out;
}

export function hasActiveFilters(f: ListFilters): boolean {
  return Boolean(
    f.q ||
    f.status?.length ||
    f.source ||
    f.category ||
    f.from ||
    f.to ||
    f.includeArchived,
  );
}
