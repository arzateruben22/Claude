import "server-only";
import type { ApplicationEventType, EventSource } from "@/generated/prisma/enums";
import { isUniqueViolation, awardXp, type Tx } from "@/lib/game/xp";
import { XP, type XpReason } from "@/lib/game/xp-config";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";

export type RecordEventInput = {
  userId: string;
  applicationId: string;
  type: ApplicationEventType;
  source: EventSource;
  verified?: boolean;
  occurredAt?: Date;
  /** Calendar date (UTC midnight, user's timezone) for daily activity + streaks. */
  activityDate: Date;
  /** Stable key; defaults to `${applicationId}:${type}` (one such event per application). */
  dedupeKey?: string;
  payload?: Record<string, unknown>;
  evidenceId?: string | null;
};

export type RecordEventResult = {
  created: boolean;
  eventId: string | null;
  xpAwarded: number;
  achievements: { key: string; unlockedAt: Date }[];
};

/** Which event types award XP, and under what reason. Only one award per (application, type). */
const EVENT_XP: Partial<Record<ApplicationEventType, XpReason>> = {
  APPLIED: "APPLICATION_SUBMITTED",
  FOLLOW_UP_SENT: "FOLLOW_UP_COMPLETED",
  INTERVIEW_COMPLETED: "INTERVIEW_ATTENDED",
  OFFER_RECEIVED: "JOB_OFFER_VERIFIED",
  OFFER_ACCEPTED: "JOB_ACCEPTED",
};

const DAILY_COUNTER: Partial<Record<ApplicationEventType, "applicationsSubmitted" | "followUps">> = {
  APPLIED: "applicationsSubmitted",
  FOLLOW_UP_SENT: "followUps",
};

/**
 * Append an application event exactly once and apply its side effects (XP, daily activity,
 * missions, achievements) inside the caller's transaction. Re-running with the same dedupeKey is a
 * no-op, which is what makes email re-syncs, extension retries and CSV re-imports safe.
 */
export async function recordApplicationEvent(tx: Tx, input: RecordEventInput): Promise<RecordEventResult> {
  const dedupeKey = input.dedupeKey ?? `${input.applicationId}:${input.type}`;
  const occurredAt = input.occurredAt ?? new Date();
  let eventId: string;
  try {
    const ev = await tx.applicationEvent.create({
      data: {
        userId: input.userId,
        applicationId: input.applicationId,
        type: input.type,
        source: input.source,
        verified: input.verified ?? input.source === "USER",
        occurredAt,
        dedupeKey,
        payload: (input.payload ?? {}) as object,
        evidenceId: input.evidenceId ?? null,
      },
      select: { id: true },
    });
    eventId = ev.id;
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false, eventId: null, xpAwarded: 0, achievements: [] };
    throw err;
  }

  let xpAwarded = 0;
  const reason = EVENT_XP[input.type];
  // XP for offers requires verification (user-confirmed or evidence-backed) to prevent inflation.
  const xpEligible = reason && (input.type !== "OFFER_RECEIVED" || input.verified || input.source === "USER");
  if (reason && xpEligible) {
    const res = await awardXp(tx, {
      userId: input.userId,
      reason,
      dedupeKey: `xp:${input.applicationId}:${reason}`,
      sourceType: "ApplicationEvent",
      sourceId: eventId,
      activityDate: input.activityDate,
    });
    if (res.awarded) xpAwarded += res.amount;
  }

  const counter = DAILY_COUNTER[input.type];
  if (counter) {
    await tx.dailyActivity.upsert({
      where: { userId_date: { userId: input.userId, date: input.activityDate } },
      create: { userId: input.userId, date: input.activityDate, [counter]: 1 },
      update: { [counter]: { increment: 1 } },
    });
  }

  await applyEventToMissions(tx, {
    userId: input.userId,
    type: input.type,
    occurredAt,
    activityDate: input.activityDate,
    sourceId: input.applicationId,
  });
  const achievements = await evaluateAchievements(tx, input.userId);
  return { created: true, eventId, xpAwarded, achievements };
}

export { XP };
