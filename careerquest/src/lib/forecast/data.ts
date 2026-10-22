/**
 * Turns tracker rows into the counts the forecast needs. Pure (no database access) so it can be
 * tested with plain objects. Stage definitions are the analytics funnel's (`classifyApplication`),
 * so "applied", "interviewed" and "offers" mean exactly what they mean on /analytics.
 */
import { classifyApplication } from "@/lib/analytics/funnel";
import type { FunnelApplication } from "@/lib/analytics/types";
import type { ForecastInput } from "./model";

const DAY_MS = 86_400_000;

export type ForecastRow = FunnelApplication & {
  /** Employer cluster: the employer record id, else the normalized company name. */
  clusterKey: string;
};

export function buildForecastInput(rows: ForecastRow[], now: Date = new Date()): ForecastInput {
  let applied = 0;
  let interviews = 0;
  let offers = 0;
  const clusters = new Map<string, number>();
  const responseDays: number[] = [];
  const awaitingAgesDays: number[] = [];

  for (const row of rows) {
    const f = classifyApplication(row);
    if (!f.applied) continue;
    applied++;
    if (f.interviewed) interviews++;
    if (f.offers) offers++;
    const key = row.clusterKey.trim().toLowerCase() || `__single:${row.id ?? applied}`;
    clusters.set(key, (clusters.get(key) ?? 0) + 1);

    if (f.appliedAt && f.firstResponseAt) {
      const d = (f.firstResponseAt.getTime() - f.appliedAt.getTime()) / DAY_MS;
      // A response logged slightly before a date-only application date counts as same day;
      // anything earlier is a data error and is skipped (same rule as analytics).
      if (d >= -1) responseDays.push(Math.max(0, d));
    }
    if (!f.responded) {
      awaitingAgesDays.push(f.appliedAt ? Math.max(0, (now.getTime() - f.appliedAt.getTime()) / DAY_MS) : Number.POSITIVE_INFINITY);
    }
  }

  return { applied, interviews, offers, clusterSizes: [...clusters.values()], responseDays, awaitingAgesDays };
}
