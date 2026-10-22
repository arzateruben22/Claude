import "server-only";
import { prisma } from "@/lib/db";
import { FUNNEL_EVENT_TYPES } from "@/lib/analytics/funnel";
import { buildForecastInput, type ForecastRow } from "./data";
import { DEFAULT_HORIZON, type ForecastInput } from "./model";

/** Same safety cap as analytics: rows beyond it are ignored and the page says so. */
export const MAX_FORECAST_APPLICATIONS = 5000;

export type ForecastData = {
  input: ForecastInput;
  /** True when the user has more applications than were analyzed. */
  capped: boolean;
  /** The user's weekly application target, used as the "next N applications" look-ahead. */
  horizon: number;
  /** "profile" when `horizon` is the user's weekly target, "default" when none is set. */
  horizonSource: "profile" | "default";
  /** Non-archived, non-merged applications loaded (including never-applied leads). */
  loaded: number;
};

/**
 * Loads the user's own applications (scoped by userId; merged duplicates and archived records are
 * excluded, matching the analytics defaults) and reduces them to forecast counts.
 */
export async function getForecastData(userId: string, now = new Date()): Promise<ForecastData> {
  const [rows, profile] = await Promise.all([
    prisma.application.findMany({
      where: { userId, mergedIntoId: null, archivedAt: null },
      orderBy: { createdAt: "asc" },
      take: MAX_FORECAST_APPLICATIONS + 1,
      select: {
        id: true,
        employerId: true,
        normalizedCompany: true,
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
      },
    }),
    prisma.userProfile.findUnique({ where: { userId }, select: { weeklyApplicationTarget: true } }),
  ]);
  const capped = rows.length > MAX_FORECAST_APPLICATIONS;
  const used = capped ? rows.slice(0, MAX_FORECAST_APPLICATIONS) : rows;
  const forecastRows: ForecastRow[] = used.map((a) => ({
    id: a.id,
    clusterKey: a.employerId ?? `name:${a.normalizedCompany}`,
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
  const weekly = profile?.weeklyApplicationTarget;
  return {
    input: buildForecastInput(forecastRows, now),
    capped,
    horizon: weekly && weekly > 0 ? Math.min(500, weekly) : DEFAULT_HORIZON,
    horizonSource: weekly && weekly > 0 ? "profile" : "default",
    loaded: used.length,
  };
}
