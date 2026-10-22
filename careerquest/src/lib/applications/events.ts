import "server-only";
import { recordApplicationEvent, type RecordEventInput, type RecordEventResult } from "@/lib/events/record-event";
import { awardXp, type AwardInput, type AwardResult, type Tx } from "@/lib/game/xp";

/**
 * Thin aliases kept for the applications service. The shared helpers are transaction-safe
 * (ON CONFLICT DO NOTHING), so no pre-checks are needed any more.
 */
export async function recordEventOnce(tx: Tx, input: RecordEventInput): Promise<RecordEventResult> {
  return recordApplicationEvent(tx, input);
}

export async function awardXpOnce(tx: Tx, input: AwardInput): Promise<AwardResult> {
  return awardXp(tx, input);
}
