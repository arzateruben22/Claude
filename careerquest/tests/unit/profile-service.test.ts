import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server environment; the service modules are plain TS.
vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import {
  appendRestart,
  completeOnboarding,
  getCampaign,
  getProfile,
  restartCampaign,
  setReducedMotion,
  setTheme,
  updateCampaignTargets,
  updateProfile,
} from "@/lib/profile/service";
import { isValidTimeZone, onboardingSchema, profileGoalsSchema, suggestedWeeklyTarget } from "@/lib/profile/schema";
import { XP } from "@/lib/game/xp-config";
import { dateFromKey, todayInTz } from "@/lib/dates";
import { addDaysUtc } from "@/lib/goals/days";

const TZ = "America/Los_Angeles";
const START = dateFromKey("2026-10-01");
let userId = "";
let otherUserId = "";

const campaignRow = (id = userId) =>
  prisma.campaignState.findUniqueOrThrow({ where: { userId_campaign: { userId: id, campaign: "GET_HIRED" } } });

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `profile-test+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Profile Test",
      stats: { create: {} },
      campaigns: { create: [{ campaign: "GET_HIRED", startedAt: START, targetEndAt: addDaysUtc(START, 90) }] },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: {
      email: `profile-other+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Other",
      profile: { create: { immediateSalaryTarget: 70000 } },
    },
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("getProfile", () => {
  it("creates the default profile row when the user has none", async () => {
    expect(await prisma.userProfile.findUnique({ where: { userId } })).toBeNull();
    const p = await getProfile(userId);
    expect(p.userId).toBe(userId);
    expect(p.name).toBe("Profile Test");
    expect(p.regions).toEqual(["Los Angeles County, CA", "Orange County, CA"]);
    expect(p.timezone).toBe(TZ);
    expect(p.immediateSalaryTarget).toBe(80000);
    expect(p.longTermSalaryTarget).toBe(150000);
    expect(p.primaryTrade).toBe("ELECTRICIAN");
    expect(p.campaignLengthDays).toBe(90);
    expect(p.dailyApplicationTarget).toBe(5);
    expect(p.weeklyApplicationTarget).toBe(25);
    expect(p.theme).toBe("CYBER");
    expect(p.apprenticeshipMinHourly).toBeNull();
    expect(p.onboardingCompletedAt).toBeNull();
    expect(await prisma.userProfile.count({ where: { userId } })).toBe(1);
  });
});

describe("updateProfile", () => {
  it("updates salary targets, the user's name and the apprenticeship minimum (Decimal → number)", async () => {
    const p = await updateProfile(userId, {
      name: "Renamed Tester",
      immediateSalaryTarget: 95000,
      longTermSalaryTarget: 160000,
      apprenticeshipMinHourly: 28.5,
      regions: ["Orange County, CA"],
      careerInterests: ["Electrician", "Commercial HVAC"],
    });
    expect(p.name).toBe("Renamed Tester");
    expect(p.immediateSalaryTarget).toBe(95000);
    expect(p.longTermSalaryTarget).toBe(160000);
    expect(p.apprenticeshipMinHourly).toBe(28.5);
    expect(typeof p.apprenticeshipMinHourly).toBe("number");
    expect(p.regions).toEqual(["Orange County, CA"]);
    expect(p.careerInterests).toEqual(["Electrician", "Commercial HVAC"]);
    // untouched fields keep their values
    expect(p.campaignLengthDays).toBe(90);
    expect(p.theme).toBe("CYBER");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    expect(user.name).toBe("Renamed Tester");
    // campaign length did not change, so the campaign end date is untouched
    expect((await campaignRow()).targetEndAt?.toISOString()).toBe(addDaysUtc(START, 90).toISOString());
  });

  it("recomputes CampaignState(GET_HIRED).targetEndAt when the campaign length changes", async () => {
    await updateProfile(userId, { campaignLengthDays: 60 });
    const row = await campaignRow();
    expect(row.startedAt.toISOString()).toBe(START.toISOString());
    expect(row.targetEndAt?.toISOString()).toBe(dateFromKey("2026-11-30").toISOString());
  });

  it("updateCampaignTargets saves all four targets and moves the end date", async () => {
    const p = await updateCampaignTargets(userId, {
      campaignLengthDays: 30,
      dailyApplicationTarget: 6,
      workdaysPerWeek: 4,
      weeklyApplicationTarget: 24,
    });
    expect(p).toMatchObject({ campaignLengthDays: 30, dailyApplicationTarget: 6, workdaysPerWeek: 4, weeklyApplicationTarget: 24 });
    expect((await campaignRow()).targetEndAt?.toISOString()).toBe(dateFromKey("2026-10-31").toISOString());
  });

  it("clears the apprenticeship minimum with null and leaves other users alone", async () => {
    const p = await updateProfile(userId, { apprenticeshipMinHourly: null });
    expect(p.apprenticeshipMinHourly).toBeNull();
    const other = await getProfile(otherUserId);
    expect(other.name).toBe("Other");
    expect(other.immediateSalaryTarget).toBe(70000);
    expect(other.campaignLengthDays).toBe(90);
  });
});

describe("completeOnboarding", () => {
  it("awards PROFILE_COMPLETED XP exactly once even when called twice", async () => {
    const first = await completeOnboarding(userId);
    expect(first.alreadyCompleted).toBe(false);
    expect(first.xpAwarded).toBe(XP.PROFILE_COMPLETED);
    expect(first.completedAt).toBeInstanceOf(Date);

    const second = await completeOnboarding(userId);
    expect(second.alreadyCompleted).toBe(true);
    expect(second.xpAwarded).toBe(0);
    expect(second.completedAt.toISOString()).toBe(first.completedAt.toISOString());

    const ledger = await prisma.xpLedger.findMany({ where: { userId, reason: "PROFILE_COMPLETED" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.dedupeKey).toBe(`xp:profile:${userId}:completed`);
    expect(ledger[0]!.amount).toBe(XP.PROFILE_COMPLETED);

    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.totalXp).toBe(XP.PROFILE_COMPLETED);

    const day = await prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: todayInTz(TZ) } } });
    expect(day?.xpEarned).toBe(XP.PROFILE_COMPLETED);

    const profile = await getProfile(userId);
    expect(profile.onboardingCompletedAt?.toISOString()).toBe(first.completedAt.toISOString());
  });
});

describe("campaign", () => {
  it("getCampaign reports the start, last day and day index from the stored row", async () => {
    const c = await getCampaign(userId);
    expect(c.startedAt.toISOString()).toBe(START.toISOString());
    expect(c.lengthDays).toBe(30);
    expect(c.lastDay.toISOString()).toBe(dateFromKey("2026-10-30").toISOString());
    expect(c.targetEndAt?.toISOString()).toBe(dateFromKey("2026-10-31").toISOString());
    expect(c.dayIndex).toBeGreaterThanOrEqual(1);
  });

  it("restartCampaign moves day 1 to today without touching applications or XP", async () => {
    const app = await prisma.application.create({
      data: {
        userId,
        companyName: "Keep Me Electric",
        normalizedCompany: "keep me electric",
        positionTitle: "Apprentice",
        normalizedTitle: "apprentice",
        status: "SUBMITTED",
      },
      select: { id: true },
    });
    const appsBefore = await prisma.application.count({ where: { userId } });
    const xpBefore = await prisma.xpLedger.count({ where: { userId } });
    const statsBefore = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });

    const c = await restartCampaign(userId);
    const today = todayInTz(TZ);
    expect(c.startedAt.toISOString()).toBe(today.toISOString());
    expect(c.status).toBe("ACTIVE");
    expect(c.dayIndex).toBe(1);
    expect(c.targetEndAt?.toISOString()).toBe(addDaysUtc(today, 30).toISOString());
    expect(c.lastDay.toISOString()).toBe(addDaysUtc(today, 29).toISOString());

    const row = await campaignRow();
    expect(row.completedAt).toBeNull();
    const restarts = (row.metadata as { restarts: { previousStartedAt: string | null }[] }).restarts;
    expect(restarts).toHaveLength(1);
    expect(restarts[0]!.previousStartedAt).toBe(START.toISOString());

    expect(await prisma.application.count({ where: { userId } })).toBe(appsBefore);
    expect(await prisma.application.findUnique({ where: { id: app.id }, select: { status: true } })).toEqual({ status: "SUBMITTED" });
    expect(await prisma.xpLedger.count({ where: { userId } })).toBe(xpBefore);
    const statsAfter = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(statsAfter.totalXp).toBe(statsBefore.totalXp);
  });
});

describe("appearance", () => {
  it("setTheme and setReducedMotion persist", async () => {
    expect((await setTheme(userId, "ULTRA")).theme).toBe("ULTRA");
    expect((await setReducedMotion(userId, true)).reducedMotion).toBe(true);
    const row = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    expect(row.theme).toBe("ULTRA");
    expect(row.reducedMotion).toBe(true);
  });
});

describe("pure helpers", () => {
  it("suggestedWeeklyTarget multiplies daily by workdays and clamps garbage", () => {
    expect(suggestedWeeklyTarget(5, 5)).toBe(25);
    expect(suggestedWeeklyTarget(3, 7)).toBe(21);
    expect(suggestedWeeklyTarget(0, 7)).toBe(0);
    expect(suggestedWeeklyTarget(Number.NaN, 5)).toBe(0);
    expect(suggestedWeeklyTarget(4, 12)).toBe(28);
  });

  it("isValidTimeZone accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Pacific/Honolulu")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });

  it("profileGoalsSchema requires a region and a valid timezone; onboardingSchema coerces form strings", () => {
    const bad = profileGoalsSchema.safeParse({
      name: "A",
      regions: [],
      timezone: "Nowhere/Land",
      immediateSalaryTarget: "80000",
      longTermSalaryTarget: "150000",
      openToApprenticeships: true,
      apprenticeshipMinHourly: null,
      careerInterests: [],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const paths = bad.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("regions");
      expect(paths).toContain("timezone");
    }
    const ok = onboardingSchema.safeParse({
      campaignLengthDays: "90",
      immediateSalaryTarget: "80000",
      longTermSalaryTarget: "150000",
      primaryTrade: "ELECTRICIAN",
      careerInterests: ["Electrician"],
      openToApprenticeships: true,
      apprenticeshipMinHourly: "22.5",
      dailyApplicationTarget: "5",
      workdaysPerWeek: "5",
      weeklyApplicationTarget: "25",
      excludeCompanyVehicleJobs: false,
      excludeDrivingRecordJobs: true,
      excludeCdlJobs: false,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.campaignLengthDays).toBe(90);
      expect(ok.data.apprenticeshipMinHourly).toBe(22.5);
      expect(ok.data.excludeDrivingRecordJobs).toBe(true);
    }
    expect(onboardingSchema.safeParse({ campaignLengthDays: "3", immediateSalaryTarget: "1", longTermSalaryTarget: "1" }).success).toBe(false);
  });

  it("appendRestart keeps a bounded history and tolerates malformed metadata", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const first = appendRestart(null, dateFromKey("2026-10-01"), now);
    expect(first.restarts).toEqual([{ at: now.toISOString(), previousStartedAt: "2026-10-01T00:00:00.000Z" }]);
    const second = appendRestart(first, dateFromKey("2026-10-21"), now);
    expect(Array.isArray(second.restarts) && second.restarts).toHaveLength(2);
    expect(appendRestart("garbage", null, now).restarts).toEqual([{ at: now.toISOString(), previousStartedAt: null }]);
    let meta: unknown = {};
    for (let i = 0; i < 25; i++) meta = appendRestart(meta, null, now);
    expect((meta as { restarts: unknown[] }).restarts).toHaveLength(20);
  });
});
