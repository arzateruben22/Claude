"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { formatCurrency } from "@/lib/format";
import {
  employmentSchema,
  missionIdSchema,
  paycheckIdSchema,
  paycheckSchema,
  planSchema,
  restDaySchema,
  seenSchema,
} from "@/lib/game/schema";
import {
  GameInputError,
  checkOffMission,
  logPaycheck,
  markAchievementsSeen,
  removePaycheck,
  reopenJobSearch,
  reportEmployment,
  saveNextPhasePlan,
  setRestDay,
} from "@/lib/game/mutations";

export type GameActionData = { message: string };
export type GameActionResult = ActionResult<GameActionData>;

function field(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

function revalidateGame() {
  revalidatePath("/missions", "layout");
  revalidatePath("/dashboard");
}

function limited(userId: string, name: string): GameActionResult | null {
  const r = rateLimit(`game:${name}:${userId}`, 30, 60_000);
  return r.ok ? null : fail(`Too many requests. Try again in ${r.retryAfterSeconds} seconds.`);
}

function failure(scope: string, err: unknown): GameActionResult {
  if (err instanceof GameInputError) return fail(err.message);
  console.error(`${scope} failed`, err);
  return fail("Something went wrong saving that. Please try again.");
}

const xpNote = (xp: number) => (xp > 0 ? ` +${xp} XP.` : "");

export async function toggleRestDayAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions");
  const limit = limited(user.id, "rest");
  if (limit) return limit;
  const parsed = restDaySchema.safeParse({ restDay: field(formData, "restDay") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const r = await setRestDay(user.id, parsed.data.restDay);
    revalidateGame();
    return ok({
      message: r.restDay
        ? "Today is a rest day. Daily missions are paused and your streak is safe."
        : "Rest day removed. Today's missions are back.",
    });
  } catch (err) {
    return failure("toggleRestDay", err);
  }
}

export async function checkOffMissionAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions");
  const limit = limited(user.id, "check");
  if (limit) return limit;
  const parsed = missionIdSchema.safeParse({ missionId: field(formData, "missionId") });
  if (!parsed.success) return fail("Unknown mission.");
  try {
    const r = await checkOffMission(user.id, parsed.data.missionId);
    revalidateGame();
    const xp = r.completed.reduce((a, m) => a + m.xpReward, 0);
    return ok({ message: r.completed.length ? `Mission complete.${xpNote(xp)}` : "Checked off." });
  } catch (err) {
    return failure("checkOffMission", err);
  }
}

export async function reportEmploymentAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions/campaign");
  const limit = limited(user.id, "employment");
  if (limit) return limit;
  const parsed = employmentSchema.safeParse({
    employer: field(formData, "employer"),
    title: field(formData, "title"),
    startDate: field(formData, "startDate"),
    amount: field(formData, "amount"),
    period: field(formData, "period"),
    hoursPerWeek: field(formData, "hoursPerWeek"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const r = await reportEmployment(user.id, parsed.data);
    revalidateGame();
    return ok({
      message: `Congratulations on the job at ${r.employment.employer}! Saved as self-reported (${formatCurrency(r.employment.annualized)}/yr). Your Electrician Path keeps going.`,
    });
  } catch (err) {
    return failure("reportEmployment", err);
  }
}

export async function reopenJobSearchAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions/campaign");
  const limit = limited(user.id, "reopen");
  if (limit) return limit;
  if (field(formData, "confirm") !== "REOPEN") return fail("Confirm to re-open the job search.");
  try {
    await reopenJobSearch(user.id);
    revalidateGame();
    return ok({ message: "Operation Get Hired is active again. Job-search missions are back." });
  } catch (err) {
    return failure("reopenJobSearch", err);
  }
}

export async function logPaycheckAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions/campaign");
  const limit = limited(user.id, "paycheck");
  if (limit) return limit;
  const parsed = paycheckSchema.safeParse({ amount: field(formData, "amount"), payDate: field(formData, "payDate") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const r = await logPaycheck(user.id, parsed.data);
    revalidateGame();
    return ok({ message: `Paycheck logged. Career earnings: ${formatCurrency(r.careerEarnings, { cents: true })} (self-reported).` });
  } catch (err) {
    return failure("logPaycheck", err);
  }
}

export async function removePaycheckAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions/campaign");
  const limit = limited(user.id, "paycheck-remove");
  if (limit) return limit;
  const parsed = paycheckIdSchema.safeParse({ paycheckId: field(formData, "paycheckId") });
  if (!parsed.success) return fail("Unknown paycheck.");
  try {
    const r = await removePaycheck(user.id, parsed.data.paycheckId);
    revalidateGame();
    return ok({ message: `Paycheck removed. Career earnings: ${formatCurrency(r.careerEarnings, { cents: true })}.` });
  } catch (err) {
    return failure("removePaycheck", err);
  }
}

export async function saveNextPhasePlanAction(_prev: GameActionResult | null, formData: FormData): Promise<GameActionResult> {
  const user = await requireUser("/missions/campaign");
  const limit = limited(user.id, "plan");
  if (limit) return limit;
  const parsed = planSchema.safeParse({ text: field(formData, "text") });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const r = await saveNextPhasePlan(user.id, parsed.data.text);
    revalidateGame();
    const xp = r.completed.reduce((a, m) => a + m.xpReward, 0);
    return ok({ message: r.completed.length ? `Plan saved. Mission complete.${xpNote(xp)}` : "Plan saved." });
  } catch (err) {
    return failure("saveNextPhasePlan", err);
  }
}

/** Acknowledge achievement celebrations. Only the caller's own unseen achievements are touched. */
export async function markAchievementsSeenAction(ids: string[]): Promise<GameActionResult> {
  const user = await requireUser();
  const limit = limited(user.id, "seen");
  if (limit) return limit;
  const parsed = seenSchema.safeParse(ids);
  if (!parsed.success) return fail("Nothing to acknowledge.");
  try {
    await markAchievementsSeen(user.id, parsed.data);
    revalidatePath("/missions/achievements");
    return ok({ message: "Nice work." });
  } catch (err) {
    return failure("markAchievementsSeen", err);
  }
}
