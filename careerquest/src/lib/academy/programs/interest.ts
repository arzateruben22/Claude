import "server-only";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/action-result";
import type { ProgramInterestStatus } from "@/generated/prisma/enums";
import type { Tx } from "@/lib/game/xp";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { lockPlayer, safeTimezone } from "@/lib/game/facts";
import { dateKey, todayInTz } from "@/lib/dates";
import { parseDateInput } from "@/lib/applications/time";
import { buildProgramChecklist, mergeChecklist, parseChecklist, setChecklistItem } from "./checklist";
import { INTEREST_STATUS_LABELS } from "./labels";
import type { ProgramInterestInput } from "./form";

/**
 * Per-user apprenticeship tracking (UserProgramInterest). Every write runs in one transaction that
 * also advances missions (PROFILE_UPDATED: programs researched / applied) and evaluates
 * achievements — so marking a program ACCEPTED unlocks "Apprenticeship Accepted" immediately.
 * The checklist is regenerated from the program's current facts on every write, keeping ticks.
 */

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

export type InterestResult =
  | { ok: true; message: string; status: ProgramInterestStatus; unlocked: string[] }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

async function timezoneFor(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return safeTimezone(profile?.timezone);
}

async function afterInterestChange(tx: Tx, userId: string, now: Date, activityDate: Date, sourceId?: string): Promise<string[]> {
  await applyEventToMissions(tx, { userId, type: "PROFILE_UPDATED", occurredAt: now, activityDate, sourceId });
  const unlocked = await evaluateAchievements(tx, userId);
  return unlocked.map((u) => u.key);
}

/** Create or update the user's tracking row for a program. */
export async function saveProgramInterest(userId: string, input: ProgramInterestInput, now = new Date()): Promise<InterestResult> {
  const tz = await timezoneFor(userId);
  const today = todayInTz(tz, now);
  if (input.appliedAt && input.appliedAt > dateKey(today)) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { appliedAt: ["The application date cannot be in the future."] } };
  }
  const appliedAt = input.appliedAt ? parseDateInput(input.appliedAt, tz) : null;
  const result = await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const program = await tx.apprenticeshipProgram.findUnique({
      where: { id: input.programId },
      select: { id: true, name: true, eligibility: true, processSteps: true },
    });
    if (!program) return null;
    const existing = await tx.userProgramInterest.findUnique({
      where: { userId_programId: { userId, programId: program.id } },
      select: { checklist: true },
    });
    const generated = buildProgramChecklist({
      eligibility: Array.isArray(program.eligibility) ? program.eligibility.filter((x): x is string => typeof x === "string") : [],
      processSteps: Array.isArray(program.processSteps) ? program.processSteps.filter((x): x is string => typeof x === "string") : [],
    });
    const checklist = mergeChecklist(parseChecklist(existing?.checklist), generated);
    const row = await tx.userProgramInterest.upsert({
      where: { userId_programId: { userId, programId: program.id } },
      create: { userId, programId: program.id, status: input.status, appliedAt, notes: input.notes, checklist },
      update: { status: input.status, appliedAt, notes: input.notes, checklist },
      select: { id: true, status: true },
    });
    const unlocked = await afterInterestChange(tx, userId, now, today, row.id);
    return { program, status: row.status, created: !existing, unlocked };
  }, TX_OPTIONS);
  if (!result) return { ok: false, error: "That program was not found." };
  const verb = result.created ? "Saved" : "Updated";
  return {
    ok: true,
    status: result.status,
    unlocked: result.unlocked,
    message: `${verb} ${result.program.name}: ${INTEREST_STATUS_LABELS[result.status]}.`,
  };
}

/** Start tracking a program as INTERESTED; an existing row (and its status) is left alone. */
export async function trackProgram(userId: string, programId: string, now = new Date()): Promise<InterestResult> {
  const existing = await prisma.userProgramInterest.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { status: true, appliedAt: true, notes: true },
  });
  if (existing) {
    return { ok: true, status: existing.status, unlocked: [], message: "Already on your list." };
  }
  return saveProgramInterest(userId, { programId, status: "INTERESTED", appliedAt: null, notes: null }, now);
}

export async function removeProgramInterest(userId: string, programId: string, now = new Date()): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const tz = await timezoneFor(userId);
  const today = todayInTz(tz, now);
  const removed = await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const r = await tx.userProgramInterest.deleteMany({ where: { userId, programId } });
    if (r.count > 0) await applyEventToMissions(tx, { userId, type: "PROFILE_UPDATED", occurredAt: now, activityDate: today });
    return r.count;
  }, TX_OPTIONS);
  return removed > 0 ? { ok: true, message: "Removed from your list." } : { ok: false, error: "That program is not on your list." };
}

/** Tick or untick one checklist item. */
export async function toggleChecklistItem(
  userId: string,
  programId: string,
  itemId: string,
  done: boolean,
  now = new Date(),
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  return prisma.$transaction(async (tx) => {
    const interest = await tx.userProgramInterest.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { id: true, checklist: true, program: { select: { eligibility: true, processSteps: true } } },
    });
    if (!interest) return { ok: false as const, error: "Save this program to your list first." };
    const generated = buildProgramChecklist({
      eligibility: Array.isArray(interest.program.eligibility) ? interest.program.eligibility.filter((x): x is string => typeof x === "string") : [],
      processSteps: Array.isArray(interest.program.processSteps) ? interest.program.processSteps.filter((x): x is string => typeof x === "string") : [],
    });
    const merged = mergeChecklist(parseChecklist(interest.checklist), generated);
    const next = setChecklistItem(merged, itemId, done, now);
    if (!next.found) return { ok: false as const, error: "That checklist item no longer exists. Reload the page." };
    await tx.userProgramInterest.update({ where: { id: interest.id }, data: { checklist: next.items } });
    const item = next.items.find((i) => i.id === itemId)!;
    return { ok: true as const, message: `${done ? "Checked" : "Unchecked"}: ${item.label.length > 60 ? `${item.label.slice(0, 57)}…` : item.label}` };
  });
}
