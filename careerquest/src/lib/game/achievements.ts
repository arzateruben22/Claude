import "server-only";
import type { Tx } from "@/lib/game/xp";

export type UnlockedAchievement = { key: string; unlockedAt: Date };

/**
 * Evaluate achievement conditions against persisted data and unlock any newly satisfied ones.
 * Implemented by the game-systems module; the default is a no-op. Must rely on the
 * (userId, achievementKey) unique constraint so re-evaluation never double-unlocks.
 */
let evaluator: (tx: Tx, userId: string) => Promise<UnlockedAchievement[]> = async () => [];

export function registerAchievementEvaluator(fn: typeof evaluator) {
  evaluator = fn;
}

export async function evaluateAchievements(tx: Tx, userId: string): Promise<UnlockedAchievement[]> {
  return evaluator(tx, userId);
}
