import "server-only";
import type { ApplicationEventType, EventSource } from "@/generated/prisma/enums";
import { awardXp, type Tx } from "@/lib/game/xp";
import { XP, type XpReason } from "@/lib/game/xp-config";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { sha256 } from "@/lib/crypto";

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
  /**
   * XP dedupe key override for repeatable actions (e.g. one follow-up award per application per
   * day: `xp:<id>:FOLLOW_UP_COMPLETED:<YYYY-MM-DD>`). Defaults are documented in `defaultXpKey`.
   */
  xpDedupeKey?: string;
  payload?: Record<string, unknown>;
  evidenceId?: string | null;
};

export type RecordEventResult = {
  created: boolean;
  eventId: string | null;
  xpAwarded: number;
  achievements: { key: string; unlockedAt: Date }[];
};

/** Which event types award XP, and under what reason. */
export const EVENT_XP: Partial<Record<ApplicationEventType, XpReason>> = {
  APPLIED: "APPLICATION_SUBMITTED",
  FOLLOW_UP_SENT: "FOLLOW_UP_COMPLETED",
  INTERVIEW_COMPLETED: "INTERVIEW_ATTENDED",
  OFFER_RECEIVED: "JOB_OFFER_VERIFIED",
  OFFER_ACCEPTED: "JOB_ACCEPTED",
};

/** Event types that can legitimately happen several times per application. */
const REPEATABLE: ReadonlySet<ApplicationEventType> = new Set(["FOLLOW_UP_SENT", "INTERVIEW_COMPLETED"]);

const DAILY_COUNTER: Partial<Record<ApplicationEventType, "applicationsSubmitted" | "followUps">> = {
  APPLIED: "applicationsSubmitted",
  FOLLOW_UP_SENT: "followUps",
};

/** Normalized identity of a position, used so the same job applied to twice (or deleted and re-created) earns submission XP once. */
export function positionFingerprint(a: { normalizedCompany: string; normalizedTitle: string; location: string | null }): string {
  const loc = (a.location ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return sha256(`${a.normalizedCompany}|${a.normalizedTitle}|${loc}`).slice(0, 32);
}

async function defaultXpKey(tx: Tx, input: RecordEventInput, reason: XpReason, eventDedupeKey: string): Promise<string> {
  if (input.xpDedupeKey) return input.xpDedupeKey;
  if (reason === "APPLICATION_SUBMITTED") {
    const app = await tx.application.findFirst({
      where: { id: input.applicationId, userId: input.userId },
      select: { normalizedCompany: true, normalizedTitle: true, location: true },
    });
    if (app) return `xp:submitted:${positionFingerprint(app)}`;
  }
  if (REPEATABLE.has(input.type)) return `xp:${eventDedupeKey}`;
  return `xp:${input.applicationId}:${reason}`;
}

/**
 * Append an application event exactly once and apply its side effects (XP, daily activity,
 * missions, achievements) inside the caller's transaction. Re-running with the same dedupeKey is a
 * no-op, which is what makes email re-syncs, extension retries and CSV re-imports safe. The insert
 * uses ON CONFLICT DO NOTHING, so a duplicate never aborts the caller's Postgres transaction.
 */
export async function recordApplicationEvent(tx: Tx, input: RecordEventInput): Promise<RecordEventResult> {
  const dedupeKey = input.dedupeKey ?? `${input.applicationId}:${input.type}`;
  const occurredAt = input.occurredAt ?? new Date();
  const verified = input.verified ?? input.source === "USER";
  const inserted = await tx.applicationEvent.createMany({
    data: [
      {
        userId: input.userId,
        applicationId: input.applicationId,
        type: input.type,
        source: input.source,
        verified,
        occurredAt,
        dedupeKey,
        payload: (input.payload ?? {}) as object,
        evidenceId: input.evidenceId ?? null,
      },
    ],
    skipDuplicates: true,
  });
  const row = await tx.applicationEvent.findUnique({
    where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
    select: { id: true },
  });
  if (inserted.count === 0) return { created: false, eventId: row?.id ?? null, xpAwarded: 0, achievements: [] };
  const eventId = row!.id;

  let xpAwarded = 0;
  const reason = EVENT_XP[input.type];
  // Offer XP requires verification (user-confirmed or evidence-backed) to prevent inflation.
  const xpEligible = reason && (input.type !== "OFFER_RECEIVED" || verified);
  if (reason && xpEligible) {
    const res = await awardXp(tx, {
      userId: input.userId,
      reason,
      dedupeKey: await defaultXpKey(tx, input, reason, dedupeKey),
      sourceType: "Application",
      sourceId: input.applicationId,
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
