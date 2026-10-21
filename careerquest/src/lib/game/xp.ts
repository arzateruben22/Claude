import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { XP, XP_TRACK, type XpReason } from "@/lib/game/xp-config";

export type Tx = Prisma.TransactionClient;

export type AwardInput = {
  userId: string;
  reason: XpReason;
  /** Stable key for the underlying real-world action, e.g. `application:<id>:submitted`. */
  dedupeKey: string;
  amount?: number;
  sourceType?: string;
  sourceId?: string;
  /** Calendar date (UTC-midnight) to attribute the XP to for streaks/daily activity. */
  activityDate?: Date;
};

export type AwardResult = { awarded: boolean; amount: number; reason: XpReason };

/**
 * Idempotently award XP. Safe to call repeatedly: the (userId, dedupeKey) unique constraint makes
 * the second call a no-op. Updates PlayerStats aggregates and DailyActivity.xpEarned in the same tx.
 */
export async function awardXp(tx: Tx, input: AwardInput): Promise<AwardResult> {
  const amount = input.amount ?? XP[input.reason];
  const track = XP_TRACK[input.reason];
  try {
    await tx.xpLedger.create({
      data: {
        userId: input.userId,
        amount,
        reason: input.reason,
        track,
        dedupeKey: input.dedupeKey,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { awarded: false, amount: 0, reason: input.reason };
    throw err;
  }

  await tx.playerStats.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      totalXp: amount,
      jobHunterXp: track === "JOB_HUNTER" ? amount : 0,
      electricianXp: track === "ELECTRICIAN" ? amount : 0,
    },
    update: {
      totalXp: { increment: amount },
      ...(track === "JOB_HUNTER" ? { jobHunterXp: { increment: amount } } : {}),
      ...(track === "ELECTRICIAN" ? { electricianXp: { increment: amount } } : {}),
    },
  });

  if (input.activityDate) {
    await tx.dailyActivity.upsert({
      where: { userId_date: { userId: input.userId, date: input.activityDate } },
      create: { userId: input.userId, date: input.activityDate, xpEarned: amount },
      update: { xpEarned: { increment: amount } },
    });
  }
  return { awarded: true, amount, reason: input.reason };
}

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
