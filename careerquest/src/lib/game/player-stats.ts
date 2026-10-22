import "server-only";
import type { Tx } from "@/lib/game/xp";
import { computeDerivedStats, type DerivedStats, type StatInputs } from "@/lib/game/levels";
import { safeTimezone, verifiedHoursTotal } from "@/lib/game/facts";
import { allLessonKeys } from "@/lib/game/lessons-index";

/** Missions that count as résumé improvements for Résumé Strength. */
export const RESUME_IMPROVEMENT_MISSION_KEYS = ["gh.p2.resume"] as const;

/** Observed inputs for the derived stats, all from persisted, userId-scoped data. */
export async function loadStatInputs(db: Tx, userId: string): Promise<StatInputs> {
  const notMerged = { application: { mergedIntoId: null } };
  const interviewsAttended = await db.interview.count({ where: { userId, attendedAt: { not: null }, ...notMerged } });
  const interviewsPrepped = await db.interview.count({ where: { userId, prepCompletedAt: { not: null }, ...notMerged } });
  const lessonKeys = allLessonKeys();
  const lessonsCompleted = lessonKeys.length
    ? await db.lessonProgress.count({ where: { userId, status: "COMPLETED", lessonKey: { in: lessonKeys } } })
    : 0;
  const attempts = await db.quizAttempt.findMany({ where: { userId, maxScore: { gt: 0 } }, select: { quizKey: true, score: true, maxScore: true } });
  const best = new Map<string, number>();
  for (const a of attempts) {
    const ratio = Math.max(0, Math.min(1, a.score / a.maxScore));
    best.set(a.quizKey, Math.max(best.get(a.quizKey) ?? 0, ratio));
  }
  const resumeVersions = await db.resumeVersion.count({ where: { userId } });
  const resumeImprovementMissions = await db.mission.count({
    where: { userId, status: "COMPLETED", key: { in: [...RESUME_IMPROVEMENT_MISSION_KEYS] } },
  });
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const tz = safeTimezone(profile?.timezone);
  const followRows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT e."applicationId", to_char((e."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d
      FROM "ApplicationEvent" e
      JOIN "Application" a ON a."id" = e."applicationId"
      WHERE e."userId" = ${userId} AND e."type" = 'FOLLOW_UP_SENT' AND a."mergedIntoId" IS NULL
    ) t`;
  const recruiterContacts = await db.contact.count({ where: { userId } });
  const verifiedHours = await verifiedHoursTotal(db, userId);
  return {
    interviewsAttended,
    interviewsPrepped,
    lessonsCompleted,
    totalLessons: lessonKeys.length,
    quizBestRatios: [...best.values()],
    resumeVersions,
    resumeImprovementMissions,
    followUps: Number(followRows[0]?.n ?? 0),
    recruiterContacts,
    verifiedHours,
  };
}

/** Recompute the derived 0–100 stats and write them to PlayerStats. */
export async function refreshPlayerStats(db: Tx, userId: string): Promise<{ stats: DerivedStats; inputs: StatInputs }> {
  const inputs = await loadStatInputs(db, userId);
  const stats = computeDerivedStats(inputs);
  await db.playerStats.upsert({ where: { userId }, create: { userId, ...stats }, update: stats });
  return { stats, inputs };
}
