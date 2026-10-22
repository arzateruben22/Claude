import "server-only";
import { randomUUID } from "node:crypto";
import { dateKey } from "@/lib/dates";
import type { Tx } from "@/lib/game/xp";
import { lockPlayer } from "@/lib/game/facts";
import {
  ensureCampaignRows,
  ensureWithContext,
  evaluateMissionsTx,
  loadGameContext,
  type CompletedMission,
  type GameContext,
} from "@/lib/game/missions";
import { readMissionMeta } from "@/lib/game/mission-catalog";
import { recomputeStreak } from "@/lib/game/streak-store";
import { evaluateAchievements, type UnlockedAchievement } from "@/lib/game/achievements";
import { annualize } from "@/lib/game/achievement-catalog";
import { MAX_PAYCHECKS, mergeGetHiredMeta, readGetHiredMeta, type Employment } from "@/lib/game/campaign-meta";
import { runGameTransaction } from "@/lib/game/sync";
import type { EmploymentInput, PaycheckInput } from "@/lib/game/schema";

/**
 * Game mutations behind the /missions server actions. Every function is scoped by userId, runs in
 * one transaction that locks the user's PlayerStats row first, and re-runs the affected mission /
 * achievement evaluation from persisted data afterwards.
 */

export class GameInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameInputError";
  }
}

async function begin(tx: Tx, userId: string): Promise<GameContext> {
  await lockPlayer(tx, userId);
  return loadGameContext(tx, userId);
}

async function getHiredRow(tx: Tx, ctx: GameContext) {
  await ensureCampaignRows(tx, ctx);
  const row = await tx.campaignState.findUnique({
    where: { userId_campaign: { userId: ctx.userId, campaign: "GET_HIRED" } },
    select: { status: true, completedAt: true, metadata: true },
  });
  if (!row) throw new Error("Campaign row missing after ensureCampaignRows");
  return row;
}

// ---------------------------------------------------------------------------
// Rest day
// ---------------------------------------------------------------------------

/** Mark (or unmark) today as a rest day: today's daily missions are paused, the streak is untouched. */
export async function setRestDay(userId: string, restDay: boolean): Promise<{ restDay: boolean; todayKey: string; completed: CompletedMission[] }> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    await tx.dailyActivity.upsert({
      where: { userId_date: { userId, date: ctx.today } },
      create: { userId, date: ctx.today, restDay },
      update: { restDay },
    });
    await ensureWithContext(tx, ctx);
    const completed = await evaluateMissionsTx(tx, userId, { ctx });
    await recomputeStreak(tx, userId, ctx.now);
    return { restDay, todayKey: ctx.todayKey, completed };
  });
}

// ---------------------------------------------------------------------------
// Self-check missions
// ---------------------------------------------------------------------------

export type CheckOffResult = { completed: CompletedMission[] };

/** Check off a mission the user can self-report (e.g. "Review your funnel analytics"). */
export async function checkOffMission(userId: string, missionId: string): Promise<CheckOffResult> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    const m = await tx.mission.findFirst({ where: { id: missionId, userId } });
    if (!m) throw new GameInputError("Mission not found.");
    const meta = readMissionMeta(m.metadata);
    if (!meta.selfCheck) throw new GameInputError("This mission completes from your activity, not by checking it off.");
    if (m.status !== "ACTIVE" || m.periodEnd.getTime() < ctx.today.getTime() || m.periodStart.getTime() > ctx.today.getTime()) {
      throw new GameInputError("This mission is no longer active.");
    }
    const raw = m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata) ? { ...(m.metadata as Record<string, unknown>) } : {};
    raw.checkedAt = ctx.now.toISOString();
    await tx.mission.updateMany({ where: { id: m.id, userId, status: "ACTIVE" }, data: { metadata: raw as object } });
    const completed = await evaluateMissionsTx(tx, userId, { ctx, metrics: new Set([meta.metric]) });
    return { completed };
  });
}

// ---------------------------------------------------------------------------
// Employment (self-reported)
// ---------------------------------------------------------------------------

export type EmploymentResult = { employment: Employment; unlocked: UnlockedAchievement[] };

/**
 * "I accepted a job": store the self-reported job, mark Operation Get Hired COMPLETED, write the
 * annualized salary to PlayerStats.currentSalary. Job-search missions pause; the $150K Electrician
 * Path keeps running. Re-submitting updates the current job (corrections).
 */
export async function reportEmployment(userId: string, input: EmploymentInput): Promise<EmploymentResult> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    const gh = await getHiredRow(tx, ctx);
    const annualized = annualize(input.amount, input.period, input.hoursPerWeek);
    const employment: Employment = {
      employer: input.employer,
      title: input.title,
      startDate: input.startDate,
      amount: input.amount,
      period: input.period,
      hoursPerWeek: input.hoursPerWeek,
      annualized,
      reportedAt: ctx.now.toISOString(),
    };
    const meta = readGetHiredMeta(gh.metadata);
    // A job left in metadata while the campaign is active (e.g. restarted from Settings) is history.
    const pastEmployment =
      gh.status !== "COMPLETED" && meta.employment ? [...meta.pastEmployment, { ...meta.employment, endedAt: ctx.now.toISOString() }] : undefined;
    await tx.campaignState.update({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      data: {
        status: "COMPLETED",
        completedAt: gh.status === "COMPLETED" && gh.completedAt ? gh.completedAt : ctx.now,
        metadata: mergeGetHiredMeta(gh.metadata, { employment, ...(pastEmployment ? { pastEmployment } : {}) }) as object,
      },
    });
    // Getting a job never ends the electrician campaign.
    await tx.campaignState.updateMany({
      where: { userId, campaign: "ELECTRICIAN_150K", status: { not: "ACTIVE" } },
      data: { status: "ACTIVE", completedAt: null },
    });
    await tx.playerStats.update({ where: { userId }, data: { currentSalary: annualized } });
    await ensureWithContext(tx, ctx);
    await evaluateMissionsTx(tx, userId, { ctx });
    const unlocked = await evaluateAchievements(tx, userId);
    return { employment, unlocked };
  });
}

/** Re-open Operation Get Hired (job ended or reported by mistake). The job moves to history. */
export async function reopenJobSearch(userId: string): Promise<void> {
  await runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    const gh = await getHiredRow(tx, ctx);
    if (gh.status !== "COMPLETED") throw new GameInputError("Operation Get Hired is already active.");
    const meta = readGetHiredMeta(gh.metadata);
    const pastEmployment = meta.employment ? [...meta.pastEmployment, { ...meta.employment, endedAt: ctx.now.toISOString() }] : meta.pastEmployment;
    await tx.campaignState.update({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      data: { status: "ACTIVE", completedAt: null, metadata: mergeGetHiredMeta(gh.metadata, { employment: null, pastEmployment }) as object },
    });
    await tx.playerStats.update({ where: { userId }, data: { currentSalary: null } });
    await ensureWithContext(tx, ctx);
    await evaluateMissionsTx(tx, userId, { ctx });
  });
}

// ---------------------------------------------------------------------------
// Paychecks (self-reported)
// ---------------------------------------------------------------------------

export async function logPaycheck(userId: string, input: PaycheckInput): Promise<{ careerEarnings: number; unlocked: UnlockedAchievement[] }> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    if (input.payDate > ctx.todayKey) throw new GameInputError("The pay date can't be in the future.");
    const gh = await getHiredRow(tx, ctx);
    const meta = readGetHiredMeta(gh.metadata);
    if (meta.paychecks.length >= MAX_PAYCHECKS) throw new GameInputError(`You can keep up to ${MAX_PAYCHECKS} paychecks here.`);
    const paychecks = [...meta.paychecks, { id: randomUUID(), amount: input.amount, payDate: input.payDate, loggedAt: ctx.now.toISOString() }];
    await tx.campaignState.update({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      data: { metadata: mergeGetHiredMeta(gh.metadata, { paychecks }) as object },
    });
    const stats = await tx.playerStats.update({
      where: { userId },
      data: { careerEarnings: { increment: input.amount } },
      select: { careerEarnings: true },
    });
    const unlocked = await evaluateAchievements(tx, userId);
    return { careerEarnings: Number(stats.careerEarnings.toString()), unlocked };
  });
}

/** Remove a paycheck logged by mistake; career earnings go down by its amount (never below 0). */
export async function removePaycheck(userId: string, paycheckId: string): Promise<{ careerEarnings: number }> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    const gh = await getHiredRow(tx, ctx);
    const meta = readGetHiredMeta(gh.metadata);
    const target = meta.paychecks.find((p) => p.id === paycheckId);
    if (!target) throw new GameInputError("Paycheck not found.");
    const paychecks = meta.paychecks.filter((p) => p.id !== paycheckId);
    await tx.campaignState.update({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      data: { metadata: mergeGetHiredMeta(gh.metadata, { paychecks }) as object },
    });
    const current = await tx.playerStats.findUnique({ where: { userId }, select: { careerEarnings: true } });
    const next = Math.max(0, Math.round((Number(current?.careerEarnings.toString() ?? 0) - target.amount) * 100) / 100);
    await tx.playerStats.update({ where: { userId }, data: { careerEarnings: next } });
    return { careerEarnings: next };
  });
}

// ---------------------------------------------------------------------------
// Next-phase plan
// ---------------------------------------------------------------------------

export async function saveNextPhasePlan(userId: string, text: string): Promise<{ completed: CompletedMission[]; updatedKey: string }> {
  return runGameTransaction(async (tx) => {
    const ctx = await begin(tx, userId);
    const gh = await getHiredRow(tx, ctx);
    await tx.campaignState.update({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      data: { metadata: mergeGetHiredMeta(gh.metadata, { nextPhasePlan: { text, updatedAt: ctx.now.toISOString() } }) as object },
    });
    const completed = await evaluateMissionsTx(tx, userId, { ctx, metrics: new Set(["NEXT_PHASE_PLAN"]) });
    return { completed, updatedKey: dateKey(ctx.today) };
  });
}

// ---------------------------------------------------------------------------
// Achievements seen
// ---------------------------------------------------------------------------

/** Acknowledge unlocked achievements (only the caller's own, only unseen ones). */
export async function markAchievementsSeen(userId: string, ids: string[]): Promise<number> {
  return runGameTransaction(async (tx) => {
    const r = await tx.userAchievement.updateMany({ where: { userId, id: { in: ids }, seenAt: null }, data: { seenAt: new Date() } });
    return r.count;
  });
}
