import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, UserProfile } from "@/generated/prisma/client";
import type { CampaignStatus, PrimaryTrade, UiTheme } from "@/generated/prisma/enums";
import { awardXp } from "@/lib/game/xp";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { mergeGetHiredMeta, readGetHiredMeta } from "@/lib/game/campaign-meta";
import { todayInTz } from "@/lib/dates";
import { addDaysUtc, diffDaysUtc } from "@/lib/goals/days";
import type { ProfileInput } from "@/lib/validation/profile";
import type { CampaignTargetsInput } from "./schema";

type Db = Prisma.TransactionClient | typeof prisma;

/** Serialisable profile (Decimal → number) safe to pass to client components. */
export type ProfileView = {
  userId: string;
  name: string;
  email: string;
  regions: string[];
  timezone: string;
  immediateSalaryTarget: number;
  longTermSalaryTarget: number;
  openToApprenticeships: boolean;
  apprenticeshipMinHourly: number | null;
  primaryTrade: PrimaryTrade;
  careerInterests: string[];
  campaignLengthDays: number;
  dailyApplicationTarget: number;
  workdaysPerWeek: number;
  weeklyApplicationTarget: number;
  excludeCompanyVehicleJobs: boolean;
  excludeDrivingRecordJobs: boolean;
  excludeCdlJobs: boolean;
  theme: UiTheme;
  reducedMotion: boolean;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Partial update: undefined keys are left untouched; `apprenticeshipMinHourly: null` clears it. */
export type ProfilePatch = Partial<Omit<ProfileInput, "apprenticeshipMinHourly">> & {
  apprenticeshipMinHourly?: number | null;
};

export type CampaignView = {
  campaign: "GET_HIRED";
  status: CampaignStatus;
  startedAt: Date;
  /** Stored target end: startedAt + campaignLengthDays. */
  targetEndAt: Date | null;
  /** Calendar date of the final campaign day (day N of N). */
  lastDay: Date;
  lengthDays: number;
  /** 1-based day index for today in the user's timezone (can exceed lengthDays). */
  dayIndex: number;
  completedAt: Date | null;
};

const PROFILE_COMPLETED_DEDUPE = (userId: string) => `xp:profile:${userId}:completed`;

function toView(row: UserProfile & { user: { name: string; email: string } }): ProfileView {
  return {
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    regions: row.regions,
    timezone: row.timezone,
    immediateSalaryTarget: row.immediateSalaryTarget,
    longTermSalaryTarget: row.longTermSalaryTarget,
    openToApprenticeships: row.openToApprenticeships,
    apprenticeshipMinHourly: row.apprenticeshipMinHourly === null ? null : Number(row.apprenticeshipMinHourly),
    primaryTrade: row.primaryTrade,
    careerInterests: row.careerInterests,
    campaignLengthDays: row.campaignLengthDays,
    dailyApplicationTarget: row.dailyApplicationTarget,
    workdaysPerWeek: row.workdaysPerWeek,
    weeklyApplicationTarget: row.weeklyApplicationTarget,
    excludeCompanyVehicleJobs: row.excludeCompanyVehicleJobs,
    excludeDrivingRecordJobs: row.excludeDrivingRecordJobs,
    excludeCdlJobs: row.excludeCdlJobs,
    theme: row.theme,
    reducedMotion: row.reducedMotion,
    onboardingCompletedAt: row.onboardingCompletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const withUser = { user: { select: { name: true, email: true } } } as const;

/** Load the profile, creating the default row when the user has none yet. */
async function ensureProfile(db: Db, userId: string) {
  return db.userProfile.upsert({ where: { userId }, create: { userId }, update: {}, include: withUser });
}

export async function getProfile(userId: string): Promise<ProfileView> {
  return toView(await ensureProfile(prisma, userId));
}

/** Keep CampaignState(GET_HIRED).targetEndAt = startedAt + campaignLengthDays. No-op without a campaign row. */
async function syncCampaignEnd(db: Db, userId: string, campaignLengthDays: number): Promise<void> {
  const row = await db.campaignState.findUnique({
    where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
    select: { startedAt: true },
  });
  if (!row) return;
  await db.campaignState.update({
    where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
    data: { targetEndAt: addDaysUtc(row.startedAt, campaignLengthDays) },
  });
}

/**
 * Update any subset of profile fields (and `User.name` when given). When the campaign length
 * changes, the GET_HIRED campaign's target end date is recomputed from its start date.
 */
export async function updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileView> {
  const { name, ...rest } = patch;
  const data: Prisma.UserProfileUpdateInput = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) (data as Record<string, unknown>)[key] = value;
  }
  return prisma.$transaction(async (tx) => {
    const current = await ensureProfile(tx, userId);
    const updated = await tx.userProfile.update({ where: { userId }, data, include: withUser });
    let userName = updated.user.name;
    if (name !== undefined && name !== current.user.name) {
      const u = await tx.user.update({ where: { id: userId }, data: { name }, select: { name: true } });
      userName = u.name;
    }
    if (rest.campaignLengthDays !== undefined && rest.campaignLengthDays !== current.campaignLengthDays) {
      await syncCampaignEnd(tx, userId, rest.campaignLengthDays);
    }
    return toView({ ...updated, user: { ...updated.user, name: userName } });
  });
}

export async function updateCampaignTargets(userId: string, input: CampaignTargetsInput): Promise<ProfileView> {
  return updateProfile(userId, input);
}

export async function setTheme(userId: string, theme: UiTheme): Promise<ProfileView> {
  return updateProfile(userId, { theme });
}

export async function setReducedMotion(userId: string, reducedMotion: boolean): Promise<ProfileView> {
  return updateProfile(userId, { reducedMotion });
}

export type CompleteOnboardingResult = { alreadyCompleted: boolean; xpAwarded: number; completedAt: Date };

/**
 * Mark onboarding complete and award PROFILE_COMPLETED XP exactly once per user. Safe to call
 * repeatedly: the completion timestamp is only set the first time and the XP ledger dedupes.
 */
export async function completeOnboarding(userId: string): Promise<CompleteOnboardingResult> {
  // One transaction: the completion timestamp, the XP award and the mission/achievement update
  // land together, so "Complete onboarding" completes immediately rather than on the next view.
  return prisma.$transaction(async (tx) => {
    const profile = await ensureProfile(tx, userId);
    const alreadyCompleted = profile.onboardingCompletedAt !== null;
    const now = new Date();
    let completedAt = profile.onboardingCompletedAt;
    if (!completedAt) {
      const updated = await tx.userProfile.update({
        where: { userId },
        data: { onboardingCompletedAt: now },
        select: { onboardingCompletedAt: true },
      });
      completedAt = updated.onboardingCompletedAt;
    }
    const activityDate = todayInTz(profile.timezone, now);
    const xp = await awardXp(tx, {
      userId,
      reason: "PROFILE_COMPLETED",
      dedupeKey: PROFILE_COMPLETED_DEDUPE(userId),
      sourceType: "UserProfile",
      sourceId: userId,
      activityDate,
    });
    await applyEventToMissions(tx, { userId, type: "PROFILE_UPDATED", occurredAt: now, activityDate });
    await evaluateAchievements(tx, userId);
    return { alreadyCompleted, xpAwarded: xp.awarded ? xp.amount : 0, completedAt: completedAt ?? now };
  });
}


function campaignView(
  row: { status: CampaignStatus; startedAt: Date; targetEndAt: Date | null; completedAt: Date | null },
  lengthDays: number,
  today: Date,
): CampaignView {
  return {
    campaign: "GET_HIRED",
    status: row.status,
    startedAt: row.startedAt,
    targetEndAt: row.targetEndAt,
    lastDay: addDaysUtc(row.startedAt, Math.max(1, lengthDays) - 1),
    lengthDays,
    dayIndex: diffDaysUtc(row.startedAt, today) + 1,
    completedAt: row.completedAt,
  };
}

/** The GET_HIRED campaign, created from the user's profile when it does not exist yet. */
export async function getCampaign(userId: string): Promise<CampaignView> {
  const profile = await ensureProfile(prisma, userId);
  const today = todayInTz(profile.timezone);
  const row = await prisma.campaignState.upsert({
    where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
    create: {
      userId,
      campaign: "GET_HIRED",
      startedAt: today,
      targetEndAt: addDaysUtc(today, profile.campaignLengthDays),
    },
    update: {},
    select: { status: true, startedAt: true, targetEndAt: true, completedAt: true },
  });
  return campaignView(row, profile.campaignLengthDays, today);
}

type RestartEntry = { at: string; previousStartedAt: string | null };

/** Keep a short, append-only restart history inside CampaignState.metadata. Pure. */
export function appendRestart(existing: unknown, previousStartedAt: Date | null, now = new Date()): Prisma.InputJsonObject {
  const base: Prisma.InputJsonObject =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Prisma.InputJsonObject) } : {};
  const prior = Array.isArray(base.restarts) ? (base.restarts as unknown[]) : [];
  const entries = prior.filter((e): e is RestartEntry => !!e && typeof e === "object" && typeof (e as RestartEntry).at === "string");
  const next: RestartEntry[] = [...entries, { at: now.toISOString(), previousStartedAt: previousStartedAt?.toISOString() ?? null }].slice(-20);
  return { ...base, restarts: next.map((e) => ({ at: e.at, previousStartedAt: e.previousStartedAt })) };
}

/**
 * Restart the GET_HIRED campaign from today. Applications, events, XP ledger, achievements and daily
 * activity are untouched. When the campaign had been completed by a reported job, restarting means
 * the job search is open again: the self-reported job moves to employment history and
 * `PlayerStats.currentSalary` is cleared (the same bookkeeping as "Re-open job search" on
 * /missions/campaign), so stale employment never lingers on an active campaign.
 */
export async function restartCampaign(userId: string): Promise<CampaignView> {
  const profile = await ensureProfile(prisma, userId);
  const now = new Date();
  const today = todayInTz(profile.timezone, now);
  const targetEndAt = addDaysUtc(today, profile.campaignLengthDays);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.campaignState.findUnique({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      select: { startedAt: true, metadata: true, status: true },
    });
    let metadata: Prisma.InputJsonObject = appendRestart(previous?.metadata, previous?.startedAt ?? null, now);
    if (previous?.status === "COMPLETED") {
      const meta = readGetHiredMeta(metadata);
      if (meta.employment) {
        metadata = mergeGetHiredMeta(metadata, {
          employment: null,
          pastEmployment: [...meta.pastEmployment, { ...meta.employment, endedAt: now.toISOString() }],
        }) as Prisma.InputJsonObject;
      }
      await tx.playerStats.updateMany({ where: { userId }, data: { currentSalary: null } });
    }
    const row = await tx.campaignState.upsert({
      where: { userId_campaign: { userId, campaign: "GET_HIRED" } },
      create: { userId, campaign: "GET_HIRED", startedAt: today, targetEndAt, status: "ACTIVE", metadata },
      update: { startedAt: today, targetEndAt, status: "ACTIVE", completedAt: null, metadata },
      select: { status: true, startedAt: true, targetEndAt: true, completedAt: true },
    });
    return campaignView(row, profile.campaignLengthDays, today);
  });
}
