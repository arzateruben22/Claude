import "server-only";
import { prisma } from "@/lib/db";
import type { Tx } from "@/lib/game/xp";
import { lockPlayer } from "@/lib/game/facts";
import { ensureWithContext, evaluateMissionsTx, loadGameContext, type CompletedMission } from "@/lib/game/missions";
import { recomputeStreak } from "@/lib/game/streak-store";
import { refreshPlayerStats } from "@/lib/game/player-stats";
import { evaluateAchievements, type UnlockedAchievement } from "@/lib/game/achievements";

export type SyncOptions = {
  now?: Date;
  /** Recompute the derived 0–100 stats (default true). */
  stats?: boolean;
  /** Evaluate achievements (default true). */
  achievements?: boolean;
};

export type SyncResult = { completed: CompletedMission[]; unlocked: UnlockedAchievement[] };

/**
 * Bring the game state up to date for a user: create the current period's missions, recompute
 * every active mission from persisted data (completing/expiring as needed), refresh the streak,
 * derived stats and achievements. Idempotent; runs in one transaction that first locks the
 * user's PlayerStats row so concurrent game writes for the same user serialize.
 */
export async function syncGameStateTx(tx: Tx, userId: string, opts: SyncOptions = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  await lockPlayer(tx, userId);
  const ctx = await loadGameContext(tx, userId, now);
  await ensureWithContext(tx, ctx);
  const completed = await evaluateMissionsTx(tx, userId, { ctx });
  await recomputeStreak(tx, userId, now);
  if (opts.stats !== false) await refreshPlayerStats(tx, userId);
  const unlocked = opts.achievements === false ? [] : await evaluateAchievements(tx, userId);
  return { completed, unlocked };
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : "";
  return code === "P2034" || code === "40P01" || code === "40001" || /deadlock|could not serialize|write conflict/i.test(msg);
}

/** Run a game transaction, retrying a couple of times on deadlocks / write conflicts. */
export async function runGameTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, { timeout: 20_000, maxWait: 10_000 });
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
    }
  }
  throw lastError;
}

export async function syncGameState(userId: string, opts: SyncOptions = {}): Promise<SyncResult> {
  return runGameTransaction((tx) => syncGameStateTx(tx, userId, opts));
}
