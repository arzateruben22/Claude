import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/game/xp";
import { annualize } from "@/lib/game/achievement-catalog";
import { DEFAULT_GAME_TIMEZONE } from "@/lib/game/streak-store";

/**
 * Shared, userId-scoped fact queries used by missions, achievements and player stats. All take a
 * transaction client (a PrismaClient works too) so they can run inside the caller's transaction.
 */

export const VERIFIED_HOUR_SOURCES = ["EMPLOYER_VERIFIED", "OFFICIAL_RECORD"] as const;

/** A timezone Postgres and Intl both accept; falls back to the product default. */
export function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_GAME_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return /^[A-Za-z0-9_+\-/]+$/.test(tz) ? tz : DEFAULT_GAME_TIMEZONE;
  } catch {
    return DEFAULT_GAME_TIMEZONE;
  }
}

/**
 * Distinct positions the user has applied to: applications with an application date or an APPLIED
 * event (the tracker's "applied" definition), merged-away duplicates excluded, identical
 * company + title + location counted once (see positions.ts). Deleted records are gone.
 */
export async function countDistinctAppliedPositions(db: Tx, userId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT a."normalizedCompany", a."normalizedTitle",
             regexp_replace(lower(coalesce(a."location", '')), '[^a-z0-9]', '', 'g') AS loc
      FROM "Application" a
      WHERE a."userId" = ${userId}
        AND a."mergedIntoId" IS NULL
        AND (
          a."appliedAt" IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM "ApplicationEvent" e
            WHERE e."applicationId" = a."id" AND e."type" = 'APPLIED'
          )
        )
    ) t`;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Calendar days (YYYY-MM-DD in the user's timezone) with at least one APPLIED event on a
 * non-merged application, optionally limited to an instant range [from, to).
 */
export async function appliedDayKeys(db: Tx, userId: string, timezone: string, range?: { from: Date; to: Date }): Promise<string[]> {
  const tz = safeTimezone(timezone);
  // Columns are UTC `timestamp(3)`; parameters are cast from ISO strings so the session timezone
  // never shifts the comparison.
  const rangeSql = range
    ? Prisma.sql`AND e."occurredAt" >= (${range.from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
                 AND e."occurredAt" < (${range.to.toISOString()}::timestamptz AT TIME ZONE 'UTC')`
    : Prisma.empty;
  const rows = await db.$queryRaw<{ d: string }[]>`
    SELECT DISTINCT to_char((e."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d
    FROM "ApplicationEvent" e
    JOIN "Application" a ON a."id" = e."applicationId"
    WHERE e."userId" = ${userId}
      AND e."type" = 'APPLIED'
      AND a."mergedIntoId" IS NULL
      ${rangeSql}`;
  return rows.map((r) => r.d).sort();
}

/** Sum of employer-verified + official-record work hours. */
export async function verifiedHoursTotal(db: Tx, userId: string): Promise<number> {
  const agg = await db.workHourEntry.aggregate({
    where: { userId, verification: { in: [...VERIFIED_HOUR_SOURCES] } },
    _sum: { hours: true },
  });
  const v = agg._sum.hours;
  return v === null || v === undefined ? 0 : Number(v.toString());
}

/** Best annual pay among accepted offers (non-merged applications) and PlayerStats.currentSalary. */
export async function bestAnnualizedSalary(db: Tx, userId: string): Promise<number | null> {
  const offers = await db.offer.findMany({
    where: { userId, status: "ACCEPTED", application: { mergedIntoId: null } },
    select: { baseAmount: true, period: true, hoursPerWeek: true },
  });
  const stats = await db.playerStats.findUnique({ where: { userId }, select: { currentSalary: true } });
  const values = offers.map((o) => annualize(Number(o.baseAmount.toString()), o.period, o.hoursPerWeek));
  if (stats?.currentSalary !== null && stats?.currentSalary !== undefined) values.push(Number(stats.currentSalary.toString()));
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  return valid.length ? Math.max(...valid) : null;
}

/** Lock the user's PlayerStats row (creating it when missing) so game writes serialize per user. */
export async function lockPlayer(db: Tx, userId: string): Promise<void> {
  await db.playerStats.createMany({ data: [{ userId }], skipDuplicates: true });
  await db.$queryRaw`SELECT 1 FROM "PlayerStats" WHERE "userId" = ${userId} FOR UPDATE`;
}
