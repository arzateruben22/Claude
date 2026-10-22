import "server-only";
import type { Tx } from "@/lib/game/xp";
import { dateFromKey, dateKey, todayInTz } from "@/lib/dates";
import { computeStreak, isActiveDay, type StreakResult } from "@/lib/game/streak";

export const DEFAULT_GAME_TIMEZONE = "America/Los_Angeles";

/**
 * Keep PlayerStats.currentStreak / longestStreak / lastActiveDate in sync with DailyActivity.
 * Called from `awardXp` whenever an award carries an activityDate. Cheap when the day was already
 * counted (the streak cannot change by doing more on an already-active day).
 */
export async function touchStreak(tx: Tx, userId: string, activityDate: Date): Promise<void> {
  const stats = await tx.playerStats.findUnique({ where: { userId }, select: { lastActiveDate: true } });
  if (stats?.lastActiveDate && dateKey(stats.lastActiveDate) === dateKey(activityDate)) return;
  await recomputeStreak(tx, userId);
}

/** Recompute the streak from the full DailyActivity history and persist it. */
export async function recomputeStreak(tx: Tx, userId: string, now = new Date()): Promise<StreakResult> {
  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: { timezone: true, workdaysPerWeek: true },
  });
  const today = todayInTz(profile?.timezone || DEFAULT_GAME_TIMEZONE, now);
  const rows = await tx.dailyActivity.findMany({
    where: { userId, date: { lte: today } },
    select: {
      date: true,
      xpEarned: true,
      applicationsSubmitted: true,
      followUps: true,
      lessonsCompleted: true,
      missionsCompleted: true,
      trainingHours: true,
      restDay: true,
    },
    orderBy: { date: "asc" },
  });
  const result = computeStreak(
    rows.map((r) => ({ key: dateKey(r.date), active: isActiveDay(r), restDay: r.restDay })),
    { workdaysPerWeek: profile?.workdaysPerWeek ?? 5, todayKey: dateKey(today) },
  );
  const existing = await tx.playerStats.findUnique({ where: { userId }, select: { longestStreak: true } });
  const longest = Math.max(existing?.longestStreak ?? 0, result.longest);
  const lastActiveDate = result.lastActiveKey ? dateFromKey(result.lastActiveKey) : null;
  await tx.playerStats.upsert({
    where: { userId },
    create: { userId, currentStreak: result.current, longestStreak: longest, lastActiveDate },
    update: { currentStreak: result.current, longestStreak: longest, lastActiveDate },
  });
  return { ...result, longest };
}
