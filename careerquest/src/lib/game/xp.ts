import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { XP, XP_TRACK, type XpReason, type XpTrack } from "@/lib/game/xp-config";

export type Tx = Prisma.TransactionClient;

export type AwardInput = {
  userId: string;
  reason: XpReason;
  /** Stable key for the underlying real-world action, e.g. `xp:<applicationId>:JOB_OFFER_VERIFIED`. */
  dedupeKey: string;
  amount?: number;
  /**
   * What the XP is attributed to. Application-derived XP MUST use sourceType "Application" and the
   * application id so it can be revoked when the record is deleted or merged away.
   */
  sourceType?: string;
  sourceId?: string;
  /** Calendar date (UTC-midnight) to attribute the XP to for streaks/daily activity. */
  activityDate?: Date;
};

export type AwardResult = { awarded: boolean; amount: number; reason: XpReason };

/**
 * Idempotently award XP. Safe to call repeatedly and safe inside an interactive transaction: the
 * insert uses `ON CONFLICT DO NOTHING` (createMany + skipDuplicates) on the (userId, dedupeKey)
 * unique index, so a duplicate neither awards twice nor aborts the surrounding Postgres transaction.
 */
export async function awardXp(tx: Tx, input: AwardInput): Promise<AwardResult> {
  const amount = input.amount ?? XP[input.reason];
  const track = XP_TRACK[input.reason];
  const inserted = await tx.xpLedger.createMany({
    data: [
      {
        userId: input.userId,
        amount,
        reason: input.reason,
        track,
        dedupeKey: input.dedupeKey,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return { awarded: false, amount: 0, reason: input.reason };

  await applyStatsDelta(tx, input.userId, track, amount);
  if (input.activityDate) {
    await tx.dailyActivity.upsert({
      where: { userId_date: { userId: input.userId, date: input.activityDate } },
      create: { userId: input.userId, date: input.activityDate, xpEarned: amount },
      update: { xpEarned: { increment: amount } },
    });
  }
  return { awarded: true, amount, reason: input.reason };
}

async function applyStatsDelta(tx: Tx, userId: string, track: string, amount: number) {
  await tx.playerStats.upsert({
    where: { userId },
    create: {
      userId,
      totalXp: Math.max(0, amount),
      jobHunterXp: track === "JOB_HUNTER" ? Math.max(0, amount) : 0,
      electricianXp: track === "ELECTRICIAN" ? Math.max(0, amount) : 0,
    },
    update: {
      totalXp: { increment: amount },
      ...(track === "JOB_HUNTER" ? { jobHunterXp: { increment: amount } } : {}),
      ...(track === "ELECTRICIAN" ? { electricianXp: { increment: amount } } : {}),
    },
  });
}

const REVOKED_MARK = "#revoked:";

/**
 * Reverse every still-active positive XP award attributed to a source (e.g. an application that
 * the user deleted, or a duplicate merged into another record). The ledger stays append-only in
 * spirit: the original row is kept (its dedupeKey is suffixed so the real action can be earned
 * again exactly once if it is re-recorded) and a compensating negative row is appended.
 */
export async function revokeXpForSource(
  tx: Tx,
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<number> {
  const rows = await tx.xpLedger.findMany({
    where: { userId, sourceType, sourceId, amount: { gt: 0 }, NOT: { dedupeKey: { contains: REVOKED_MARK } } },
    select: { id: true, amount: true, reason: true, track: true, dedupeKey: true },
  });
  let total = 0;
  for (const row of rows) {
    await tx.xpLedger.update({ where: { id: row.id }, data: { dedupeKey: `${row.dedupeKey}${REVOKED_MARK}${row.id}` } });
    const inserted = await tx.xpLedger.createMany({
      data: [
        {
          userId,
          amount: -row.amount,
          reason: `REVOKED_${row.reason}`,
          track: row.track,
          dedupeKey: `revoke:${row.id}`,
          sourceType,
          sourceId,
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 1) {
      await applyStatsDelta(tx, userId, row.track as XpTrack, -row.amount);
      total += row.amount;
    }
  }
  if (total > 0) {
    // Never let aggregates go negative because of historical inconsistencies.
    await tx.playerStats.updateMany({ where: { userId, totalXp: { lt: 0 } }, data: { totalXp: 0 } });
    await tx.playerStats.updateMany({ where: { userId, jobHunterXp: { lt: 0 } }, data: { jobHunterXp: 0 } });
    await tx.playerStats.updateMany({ where: { userId, electricianXp: { lt: 0 } }, data: { electricianXp: 0 } });
  }
  return total;
}

/** True when a Prisma error is a unique-constraint violation (outside transactions only). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

/** Convenience wrapper when not already inside a transaction. */
export async function awardXpStandalone(input: AwardInput): Promise<AwardResult> {
  return prisma.$transaction((tx) => awardXp(tx, input));
}

export async function getPlayerStats(userId: string) {
  return prisma.playerStats.upsert({ where: { userId }, create: { userId }, update: {} });
}
