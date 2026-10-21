import "server-only";
import type { Tx } from "@/lib/game/xp";
import type { ApplicationEventType } from "@/generated/prisma/enums";

export type MissionEventContext = {
  userId: string;
  type: ApplicationEventType | "LESSON_COMPLETED" | "QUIZ_PASSED" | "WORK_HOURS_LOGGED" | "PROFILE_UPDATED" | "RESUME_UPDATED";
  occurredAt: Date;
  /** Calendar date (UTC midnight) in the user's timezone. */
  activityDate: Date;
  sourceId?: string;
};

/**
 * Advance mission progress for an event. Implemented by the game-systems module; the default here
 * is a no-op so earlier phases compile. Must be idempotent per (userId, sourceId, type).
 */
let handler: (tx: Tx, ctx: MissionEventContext) => Promise<void> = async () => undefined;

export function registerMissionHandler(fn: typeof handler) {
  handler = fn;
}

export async function applyEventToMissions(tx: Tx, ctx: MissionEventContext): Promise<void> {
  await handler(tx, ctx);
}
