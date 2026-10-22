import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationSource, ApplicationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { todayInTz } from "@/lib/dates";
import { ALL_STATUSES } from "@/lib/applications/status";
import { toExportRow, type ExportRow } from "@/lib/analytics/csv";
import { resolveRange, type AnalyticsFilters, type ResolvedRange } from "@/lib/analytics/filters";
import {
  FUNNEL_EVENT_TYPES,
  applicationDayKey,
  appliedDayKey,
  averageDaysToResponse,
  computeFunnel,
  conversionBy,
  dailySeries,
  weeklySeries,
} from "@/lib/analytics/funnel";
import { addDaysKey, endOfDayInTz, instantDateKey, rangeBounds, utcDateKey, weekStartKey, DAY_MS } from "@/lib/analytics/time";
import type { ActivityRow, ConversionRow, DailyPoint, FunnelApplication, FunnelResult, ResponseTiming, WeeklyPoint } from "@/lib/analytics/types";
import { dateFromKey } from "@/lib/dates";

/** Statuses that keep an application "in play" for follow-ups. */
const ACTIVE_STATUSES: ApplicationStatus[] = ["SUBMITTED", "CONFIRMED", "SCREENING", "INTERVIEWING", "OFFER"];

/** Safety cap on rows loaded for in-memory funnel math; the page says so when it is hit. */
export const MAX_ANALYTICS_APPLICATIONS = 5000;
export const DAILY_WINDOW_DAYS = 90;
export const WEEKLY_WINDOW_WEEKS = 52;
const EXPORT_BATCH = 500;
const OPTION_LIMIT = 200;
const DEFAULT_TZ = "America/Los_Angeles";

export type AnalyticsContext = {
  timezone: string;
  todayKey: string;
  campaignStartKey: string | null;
};

export type StatusCount = { status: ApplicationStatus; count: number };
export type SourceCount = { source: ApplicationSource; count: number };

export type AnalyticsData = {
  filters: AnalyticsFilters;
  range: ResolvedRange;
  timezone: string;
  todayKey: string;
  /** True when the user has any application at all (so an empty result is a filter issue, not a new account). */
  hasAnyApplications: boolean;
  /** True when more than MAX_ANALYTICS_APPLICATIONS matched and the rest were ignored. */
  capped: boolean;
  totals: { applications: number; applied: number };
  funnel: FunnelResult;
  timing: ResponseTiming;
  daily: DailyPoint[];
  dailyWindow: { fromKey: string; toKey: string };
  weekly: WeeklyPoint[];
  weeklyWindow: { fromKey: string; toKey: string };
  bySource: ConversionRow[];
  byCategory: ConversionRow[];
  byResume: ConversionRow[];
  resumeNames: Record<string, string>;
  statusDistribution: StatusCount[];
  sourceDistribution: SourceCount[];
  followUps: { overdue: number; dueToday: number; laterThisWeek: number; weekEndKey: string };
  options: { sources: ApplicationSource[]; categories: string[]; employers: string[] };
};

async function loadContext(userId: string, now: Date): Promise<AnalyticsContext> {
  const [profile, campaign, user] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
    prisma.campaignState.findUnique({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, select: { startedAt: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  const timezone = profile?.timezone || DEFAULT_TZ;
  const today = todayInTz(timezone, now);
  // Fall back to the signup date when no campaign row exists (older accounts); never invent one.
  const campaignStart = campaign?.startedAt ?? (user ? todayInTz(timezone, user.createdAt) : null);
  return { timezone, todayKey: utcDateKey(today), campaignStartKey: campaignStart ? utcDateKey(campaignStart) : null };
}

export async function getUserTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return profile?.timezone || DEFAULT_TZ;
}

/** Applications that count by default: owned by the user, not merged into another record, not archived. */
function baseWhere(userId: string, includeArchived: boolean): Prisma.ApplicationWhereInput {
  return { userId, mergedIntoId: null, ...(includeArchived ? {} : { archivedAt: null }) };
}

/**
 * Translate filters into a Prisma where clause. The date range applies to `appliedAt`, falling
 * back to `createdAt` for records that were never applied (saved/preparing), so saved leads
 * still appear in the status distribution for the period they were added.
 *
 * The SQL date bounds are deliberately wide (they cover both the UTC-date and the user-timezone
 * reading of a timestamp); `inRange` then keeps exactly the records whose calendar day — the same
 * day the daily chart files them under — falls inside the range.
 */
export function buildApplicationWhere(userId: string, filters: AnalyticsFilters, range: ResolvedRange, timezone: string): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = baseWhere(userId, filters.includeArchived);
  const and: Prisma.ApplicationWhereInput[] = [];
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.source?.length) where.source = { in: filters.source };
  if (filters.category) where.jobCategory = { equals: filters.category, mode: "insensitive" };
  if (filters.employer) where.companyName = { equals: filters.employer, mode: "insensitive" };
  if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
  if (filters.salaryMin !== undefined) {
    and.push({ OR: [{ salaryMax: { gte: filters.salaryMin } }, { salaryMax: null, salaryMin: { gte: filters.salaryMin } }] });
  }
  if (filters.salaryMax !== undefined) {
    and.push({ OR: [{ salaryMin: { lte: filters.salaryMax } }, { salaryMin: null, salaryMax: { lte: filters.salaryMax } }] });
  }
  const bounds = rangeBounds(range.fromKey, range.toKey, timezone);
  if (bounds.gte || bounds.lt) {
    const cond: Prisma.DateTimeFilter = { ...(bounds.gte ? { gte: bounds.gte } : {}), ...(bounds.lt ? { lt: bounds.lt } : {}) };
    and.push({ OR: [{ appliedAt: cond }, { appliedAt: null, createdAt: cond }] });
  }
  if (and.length) where.AND = and;
  return where;
}

const analyticsSelect = {
  id: true,
  status: true,
  appliedAt: true,
  statusUpdatedAt: true,
  createdAt: true,
  source: true,
  jobCategory: true,
  resumeVersionId: true,
  statusHistory: { select: { toStatus: true, occurredAt: true } },
  events: { where: { type: { in: FUNNEL_EVENT_TYPES } }, select: { type: true, occurredAt: true } },
  _count: { select: { interviews: true, offers: true } },
} satisfies Prisma.ApplicationSelect;

/** Exact range check on the record's calendar day (see `applicationDayKey`). */
export function inRange(dayKey: string, range: Pick<ResolvedRange, "fromKey" | "toKey">): boolean {
  return (!range.fromKey || dayKey >= range.fromKey) && (!range.toKey || dayKey <= range.toKey);
}

/** Upper bound for "due by end of day" covering both date-only (UTC) and timezone interpretations. */
function dueBound(dayKey: string, timezone: string): Date {
  return new Date(Math.max(endOfDayInTz(dayKey, timezone).getTime(), dateFromKey(dayKey).getTime() + DAY_MS));
}

/**
 * Everything the Analytics page shows for one user and one filter state. All reads are scoped
 * by userId; the funnel is computed in memory from a single application query.
 */
export async function getAnalytics(userId: string, filters: AnalyticsFilters, now = new Date()): Promise<AnalyticsData> {
  const ctx = await loadContext(userId, now);
  const { timezone, todayKey } = ctx;
  const range = resolveRange(filters, ctx);
  const where = buildApplicationWhere(userId, filters, range, timezone);
  const optionsWhere = baseWhere(userId, filters.includeArchived);

  // Series windows end at the range end (or today) and are capped so charts stay readable.
  const seriesTo = range.toKey ?? todayKey;
  const clampFrom = (days: number) => {
    const floor = addDaysKey(seriesTo, -(days - 1));
    return range.fromKey && range.fromKey > floor ? range.fromKey : floor;
  };
  const dailyFrom = clampFrom(DAILY_WINDOW_DAYS);
  const weeklyFrom = clampFrom(WEEKLY_WINDOW_WEEKS * 7);
  const weekStart = weekStartKey(todayKey);
  const weekEndKey = addDaysKey(weekStart, 6);

  const [rows, anyCount, activityRows, sourceGroups, categoryRows, employerRows, resumeRows, followUpRows] = await Promise.all([
    prisma.application.findMany({ where, orderBy: { createdAt: "asc" }, take: MAX_ANALYTICS_APPLICATIONS + 1, select: analyticsSelect }),
    prisma.application.count({ where: { userId, mergedIntoId: null } }),
    prisma.dailyActivity.findMany({
      where: { userId, date: { gte: dateFromKey(weeklyFrom), lte: dateFromKey(seriesTo) } },
      select: { date: true, applicationsSubmitted: true, followUps: true },
    }),
    prisma.application.groupBy({ by: ["source"], where: optionsWhere, _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    prisma.application.findMany({
      where: { ...optionsWhere, jobCategory: { not: null } },
      distinct: ["jobCategory"],
      select: { jobCategory: true },
      orderBy: { jobCategory: "asc" },
      take: OPTION_LIMIT,
    }),
    prisma.application.findMany({
      where: optionsWhere,
      distinct: ["normalizedCompany"],
      select: { companyName: true },
      orderBy: { normalizedCompany: "asc" },
      take: OPTION_LIMIT,
    }),
    prisma.resumeVersion.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.application.findMany({
      where: { AND: [where, { status: { in: ACTIVE_STATUSES } }, { followUpAt: { lte: dueBound(weekEndKey, timezone) } }] },
      select: { id: true, followUpAt: true },
    }),
  ]);

  const capped = rows.length > MAX_ANALYTICS_APPLICATIONS;
  const apps = (capped ? rows.slice(0, MAX_ANALYTICS_APPLICATIONS) : rows).filter((a) => inRange(applicationDayKey(a, timezone), range));
  const appIds = new Set(apps.map((a) => a.id));

  const funnelApps: FunnelApplication[] = apps.map((a) => ({
    id: a.id,
    status: a.status,
    appliedAt: a.appliedAt,
    statusUpdatedAt: a.statusUpdatedAt,
    createdAt: a.createdAt,
    statusHistory: a.statusHistory,
    events: a.events,
    source: a.source,
    jobCategory: a.jobCategory,
    resumeVersionId: a.resumeVersionId,
    hasInterviews: a._count.interviews > 0,
    hasOffers: a._count.offers > 0,
  }));

  const funnel = computeFunnel(funnelApps);
  const timing = averageDaysToResponse(funnelApps);

  // One key per applied application (its application day), so the chart sums to the funnel's "applied".
  const appliedKeys: string[] = [];
  for (const a of apps) {
    const key = appliedDayKey(a, timezone);
    if (key) appliedKeys.push(key);
  }
  const activity: ActivityRow[] = activityRows.map((r) => ({ key: utcDateKey(r.date), applicationsSubmitted: r.applicationsSubmitted, followUps: r.followUps }));
  const daily = dailySeries({ fromKey: dailyFrom, toKey: seriesTo, appliedKeys, activity });
  const weekly = weeklySeries(dailySeries({ fromKey: weeklyFrom, toKey: seriesTo, appliedKeys, activity }));

  const statusCounts = new Map<ApplicationStatus, number>();
  const sourceCounts = new Map<ApplicationSource, number>();
  for (const a of apps) {
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    sourceCounts.set(a.source, (sourceCounts.get(a.source) ?? 0) + 1);
  }
  const statusDistribution: StatusCount[] = ALL_STATUSES.filter((s) => statusCounts.has(s)).map((status) => ({ status, count: statusCounts.get(status)! }));
  const sourceDistribution: SourceCount[] = [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  let overdue = 0;
  let dueToday = 0;
  let laterThisWeek = 0;
  for (const r of followUpRows) {
    if (!r.followUpAt || (!capped && !appIds.has(r.id))) continue;
    const key = instantDateKey(r.followUpAt, timezone);
    if (key < todayKey) overdue++;
    else if (key === todayKey) dueToday++;
    else if (key <= weekEndKey) laterThisWeek++;
  }

  const resumeNames: Record<string, string> = {};
  for (const r of resumeRows) resumeNames[r.id] = r.name;

  return {
    filters,
    range,
    timezone,
    todayKey,
    hasAnyApplications: anyCount > 0,
    capped,
    totals: { applications: apps.length, applied: funnel.counts.applied },
    funnel,
    timing,
    daily,
    dailyWindow: { fromKey: daily[0]?.key ?? dailyFrom, toKey: seriesTo },
    weekly,
    weeklyWindow: { fromKey: weekly[0]?.key ?? weeklyFrom, toKey: seriesTo },
    bySource: conversionBy(funnelApps, "source"),
    byCategory: conversionBy(funnelApps, "jobCategory"),
    byResume: conversionBy(funnelApps, "resumeVersionId"),
    resumeNames,
    statusDistribution,
    sourceDistribution,
    followUps: { overdue, dueToday, laterThisWeek, weekEndKey },
    options: {
      sources: sourceGroups.map((g) => g.source),
      categories: categoryRows.map((r) => r.jobCategory).filter((c): c is string => Boolean(c)),
      employers: employerRows.map((r) => r.companyName),
    },
  };
}

const exportSelect = {
  id: true,
  companyName: true,
  positionTitle: true,
  status: true,
  source: true,
  location: true,
  appliedAt: true,
  statusUpdatedAt: true,
  salaryMin: true,
  salaryMax: true,
  salaryPeriod: true,
  employmentType: true,
  jobCategory: true,
  postingUrl: true,
  requisitionNumber: true,
  followUpAt: true,
  recruiterContact: { select: { name: true } },
  createdVia: true,
  createdAt: true,
  events: { where: { type: "APPLIED" }, select: { type: true, occurredAt: true }, orderBy: { occurredAt: "asc" }, take: 1 },
} satisfies Prisma.ApplicationSelect;

/**
 * Yields export rows in batches (cursor-paginated) so the CSV route can stream without holding
 * the whole result set in memory. Honors exactly the filters the Analytics page uses.
 */
export async function* iterateExportRows(userId: string, filters: AnalyticsFilters, now = new Date()): AsyncGenerator<ExportRow[], void, undefined> {
  const ctx = await loadContext(userId, now);
  const range = resolveRange(filters, ctx);
  const where = buildApplicationWhere(userId, filters, range, ctx.timezone);
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.application.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: EXPORT_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: exportSelect,
    });
    if (batch.length === 0) return;
    const inSlice = batch.filter((a) => inRange(applicationDayKey(a, ctx.timezone), range));
    if (inSlice.length) yield inSlice.map(toExportRow);
    if (batch.length < EXPORT_BATCH) return;
    cursor = batch[batch.length - 1]!.id;
  }
}
