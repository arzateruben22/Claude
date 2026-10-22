import "server-only";
import { awardXp, revokeXpForSource, type Tx } from "@/lib/game/xp";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { HOURS_MILESTONE_XP_SOURCE, HOUR_MILESTONES, VERIFIED_SOURCES, milestoneXpKey } from "./constants";

/**
 * Verified ON-THE-JOB hours (EMPLOYER_VERIFIED + OFFICIAL_RECORD, work type CLASSROOM excluded —
 * classroom instruction is tracked separately and never counts toward the 8,000).
 */
export async function verifiedOjtHours(db: Tx, userId: string): Promise<number> {
  const agg = await db.workHourEntry.aggregate({
    where: { userId, verification: { in: [...VERIFIED_SOURCES] }, workType: { not: "CLASSROOM" } },
    _sum: { hours: true },
  });
  const v = agg._sum.hours;
  return v === null || v === undefined ? 0 : Number(v.toString());
}

/**
 * Training-milestone XP follows the VERIFIED on-the-job total: crossing 1,000 / 2,000 / 4,000 / 6,000 / 8,000
 * verified hours awards TRAINING_MILESTONE once (`xp:hours-milestone:<n>`); dropping back below a
 * milestone (an entry deleted or downgraded) revokes it, and re-crossing earns it once more — so the
 * net XP for a milestone is never more than one award.
 */
export async function syncHourMilestonesTx(
  tx: Tx,
  userId: string,
  activityDate: Date,
): Promise<{ verified: number; awarded: number[]; revoked: number[] }> {
  const verified = await verifiedOjtHours(tx, userId);
  const awarded: number[] = [];
  const revoked: number[] = [];
  for (const n of HOUR_MILESTONES) {
    if (verified >= n) {
      const r = await awardXp(tx, {
        userId,
        reason: "TRAINING_MILESTONE",
        dedupeKey: milestoneXpKey(n),
        sourceType: HOURS_MILESTONE_XP_SOURCE,
        sourceId: String(n),
        activityDate,
      });
      if (r.awarded) awarded.push(n);
    } else {
      const amount = await revokeXpForSource(tx, userId, HOURS_MILESTONE_XP_SOURCE, String(n));
      if (amount > 0) revoked.push(n);
    }
  }
  return { verified, awarded, revoked };
}

/** Everything that must follow a change to the hour log, inside the caller's transaction. */
export async function afterHoursChangeTx(
  tx: Tx,
  ctx: { userId: string; now: Date; activityDate: Date; sourceId?: string },
): Promise<{ awarded: number[]; revoked: number[] }> {
  const milestones = await syncHourMilestonesTx(tx, ctx.userId, ctx.activityDate);
  await applyEventToMissions(tx, {
    userId: ctx.userId,
    type: "WORK_HOURS_LOGGED",
    occurredAt: ctx.now,
    activityDate: ctx.activityDate,
    sourceId: ctx.sourceId,
  });
  await evaluateAchievements(tx, ctx.userId);
  return { awarded: milestones.awarded, revoked: milestones.revoked };
}
