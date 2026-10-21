import "server-only";
import type { ApplicationEventType } from "@/generated/prisma/enums";
import {
  recordApplicationEvent,
  type RecordEventInput,
  type RecordEventResult,
} from "@/lib/events/record-event";
import {
  awardXp,
  type AwardInput,
  type AwardResult,
  type Tx,
} from "@/lib/game/xp";
import type { XpReason } from "@/lib/game/xp-config";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";

/**
 * Transaction-safe wrappers around the shared event/XP contract.
 *
 * `recordApplicationEvent` and `awardXp` rely on catching a unique violation to dedupe. Inside a
 * Prisma interactive transaction on Postgres a failed INSERT aborts the whole transaction (25P02),
 * so the catch does not help: every later statement in the transaction fails. These wrappers check
 * the dedupe keys up front so the shared helpers only ever run their happy path.
 *
 * Mirror of the XP mapping in `src/lib/events/record-event.ts` (not exported there).
 */
const EVENT_XP: Partial<Record<ApplicationEventType, XpReason>> = {
  APPLIED: "APPLICATION_SUBMITTED",
  FOLLOW_UP_SENT: "FOLLOW_UP_COMPLETED",
  INTERVIEW_COMPLETED: "INTERVIEW_ATTENDED",
  OFFER_RECEIVED: "JOB_OFFER_VERIFIED",
  OFFER_ACCEPTED: "JOB_ACCEPTED",
};

const DAILY_COUNTER: Partial<
  Record<ApplicationEventType, "applicationsSubmitted" | "followUps">
> = {
  APPLIED: "applicationsSubmitted",
  FOLLOW_UP_SENT: "followUps",
};

export async function xpKeyExists(
  tx: Tx,
  userId: string,
  dedupeKey: string,
): Promise<boolean> {
  const row = await tx.xpLedger.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    select: { id: true },
  });
  return row !== null;
}

/** Idempotent XP award that never trips the unique constraint inside the transaction. */
export async function awardXpOnce(
  tx: Tx,
  input: AwardInput,
): Promise<AwardResult> {
  if (await xpKeyExists(tx, input.userId, input.dedupeKey))
    return { awarded: false, amount: 0, reason: input.reason };
  return awardXp(tx, input);
}

/**
 * Record an application event exactly once. Returns `created: false` when the dedupe key already
 * exists. When the event is new but its per-application XP was already granted by an earlier event
 * of the same type (repeatable types such as FOLLOW_UP_SENT / INTERVIEW_COMPLETED), the event and
 * its non-XP side effects are still recorded, without XP.
 */
export async function recordEventOnce(
  tx: Tx,
  input: RecordEventInput,
): Promise<RecordEventResult> {
  const dedupeKey = input.dedupeKey ?? `${input.applicationId}:${input.type}`;
  const existing = await tx.applicationEvent.findUnique({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
    select: { id: true },
  });
  if (existing)
    return {
      created: false,
      eventId: existing.id,
      xpAwarded: 0,
      achievements: [],
    };

  const reason = EVENT_XP[input.type];
  const xpWouldCollide = reason
    ? await xpKeyExists(tx, input.userId, `xp:${input.applicationId}:${reason}`)
    : false;
  if (!xpWouldCollide)
    return recordApplicationEvent(tx, { ...input, dedupeKey });

  // Repeat of an XP-bearing type: same side effects as recordApplicationEvent minus the XP award.
  const occurredAt = input.occurredAt ?? new Date();
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
  const counter = DAILY_COUNTER[input.type];
  if (counter) {
    await tx.dailyActivity.upsert({
      where: {
        userId_date: { userId: input.userId, date: input.activityDate },
      },
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
  return { created: true, eventId: ev.id, xpAwarded: 0, achievements };
}
