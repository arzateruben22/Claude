import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import { createApplication, deleteApplication, markInterviewOutcome, recordFollowUp, scheduleInterview } from "@/lib/applications/service";
import { applyEventToMissions, ensureMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { syncGameState } from "@/lib/game/sync";
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
import { getAchievementsPageData, getCampaignPageData, getTodayMissionsSummary, getUnseenAchievements, getWeekPageData } from "@/lib/game/queries";
import { countDistinctAppliedPositions } from "@/lib/game/facts";
import { readMissionMeta } from "@/lib/game/mission-catalog";
import { ACHIEVEMENTS } from "@/lib/game/achievement-catalog";
import { addUtcDays, dateKey, todayInTz } from "@/lib/dates";
import { XP } from "@/lib/game/xp-config";

const TZ = "America/Los_Angeles";
const created: string[] = [];

async function makeUser(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `game-${label}+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: `Game ${label}`,
      // 7 workdays so daily missions exist whatever weekday the suite runs on.
      profile: { create: { timezone: TZ, workdaysPerWeek: 7, dailyApplicationTarget: 2, weeklyApplicationTarget: 10 } },
      stats: { create: {} },
    },
  });
  created.push(user.id);
  return user.id;
}

function input(over: Record<string, unknown> = {}) {
  return applicationInputSchema.parse({
    companyName: "Volt Co",
    positionTitle: "Apprentice Electrician",
    location: "Anaheim, CA",
    status: "SUBMITTED",
    ...over,
  });
}

const today = () => todayInTz(TZ);
const mission = (userId: string, key: string, periodStart: Date) =>
  prisma.mission.findUnique({ where: { userId_key_periodStart: { userId, key, periodStart } } });

afterAll(async () => {
  if (created.length) await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("missions: daily 'submit N' + idempotent XP", () => {
  let userId = "";
  let firstAppId = "";
  let dailyId = "";

  beforeAll(async () => {
    userId = await makeUser("missions");
  });

  it("ensureMissions creates today's missions once (unique per period)", async () => {
    await ensureMissions(userId);
    await ensureMissions(userId);
    const rows = await prisma.mission.findMany({ where: { userId, key: "daily.apply" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "ACTIVE", target: 2, progress: 0, type: "DAILY" });
    expect(dateKey(rows[0]!.periodStart)).toBe(dateKey(today()));
    dailyId = rows[0]!.id;
    const campaigns = await prisma.campaignState.findMany({ where: { userId }, select: { campaign: true, status: true } });
    expect(campaigns.map((c) => c.campaign).sort()).toEqual(["ELECTRICIAN_150K", "GET_HIRED"]);
  });

  it("an application submitted today completes 'Submit N' when N is reached; XP is awarded once even if applyEventToMissions runs 3 times", async () => {
    const a1 = await createApplication(userId, input({ companyName: "Volt Co" }));
    firstAppId = a1.application.id;
    expect((await mission(userId, "daily.apply", today()))).toMatchObject({ status: "ACTIVE", progress: 1 });

    const a2 = await createApplication(userId, input({ companyName: "Amp Inc" }));
    const done = await mission(userId, "daily.apply", today());
    expect(done).toMatchObject({ status: "COMPLETED", progress: 2, target: 2 });
    expect(done!.completedAt).toBeInstanceOf(Date);

    for (let i = 0; i < 3; i++) {
      await prisma.$transaction((tx) =>
        applyEventToMissions(tx, { userId, type: "APPLIED", occurredAt: new Date(), activityDate: today(), sourceId: a2.application.id }),
      );
    }
    const ledger = await prisma.xpLedger.findMany({ where: { userId, dedupeKey: `xp:mission:${dailyId}` } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: XP.MISSION_DAILY, reason: "MISSION_DAILY", sourceType: "Mission", sourceId: dailyId, track: "CAREER" });

    const completedCount = await prisma.mission.count({ where: { userId, status: "COMPLETED" } });
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.missionsCompleted).toBe(completedCount);
    const day = await prisma.dailyActivity.findUniqueOrThrow({ where: { userId_date: { userId, date: today() } } });
    expect(day.missionsCompleted).toBe(completedCount);
  });

  it("writes the streak fields (review finding F4)", async () => {
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.lastActiveDate && dateKey(stats.lastActiveDate)).toBe(dateKey(today()));
  });

  it("a repeated submission to the same position does not count twice", async () => {
    const weekly = await prisma.mission.findFirstOrThrow({ where: { userId, key: "weekly.apply" } });
    expect(weekly.progress).toBe(2);
    await createApplication(userId, input({ companyName: "Volt Co" })); // same company + title + location as a1
    expect((await prisma.mission.findUniqueOrThrow({ where: { id: weekly.id } })).progress).toBe(2);
  });

  it("deleting an application (XP revoked) doesn't crash evaluation and never takes mission XP back", async () => {
    await deleteApplication(userId, firstAppId);
    const revoked = await prisma.xpLedger.findMany({ where: { userId, sourceId: firstAppId, amount: { lt: 0 } } });
    expect(revoked.length).toBeGreaterThan(0);

    await expect(syncGameState(userId)).resolves.toMatchObject({ completed: expect.any(Array) });
    expect(await mission(userId, "daily.apply", today())).toMatchObject({ status: "COMPLETED" });
    expect(await prisma.xpLedger.count({ where: { userId, dedupeKey: `xp:mission:${dailyId}` } })).toBe(1);
    // Weekly progress is recomputed: Amp Inc + the re-application to Volt Co (now the only record of that position).
    const weekly = await prisma.mission.findFirstOrThrow({ where: { userId, key: "weekly.apply" } });
    expect(weekly.progress).toBe(2);
  });

  it("achievements unlock once and the celebration queue drains when seen", async () => {
    const rows = await prisma.userAchievement.findMany({ where: { userId, achievementKey: "first-application" } });
    expect(rows).toHaveLength(1);
    expect(await prisma.$transaction((tx) => evaluateAchievements(tx, userId))).toEqual([]);
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "first-application" } })).toBe(1);

    const unseen = await getUnseenAchievements(userId);
    expect(unseen.map((u) => u.key)).toContain("first-application");
    expect(await markAchievementsSeen(userId, unseen.map((u) => u.id))).toBe(unseen.length);
    expect(await getUnseenAchievements(userId)).toEqual([]);
  });

  it("'Clear today's follow-ups' appears when one is due and completes when it is logged", async () => {
    const app = await createApplication(userId, input({ companyName: "Circuit LLC", followUpAt: dateKey(today()) }));
    await syncGameState(userId);
    const m = await mission(userId, "daily.followups", today());
    expect(m).toMatchObject({ status: "ACTIVE", target: 1, progress: 0 });
    expect(readMissionMeta(m!.metadata).applicationIds).toEqual([app.application.id]);

    await recordFollowUp(userId, app.application.id, { note: "Checked in with the recruiter" });
    expect(await mission(userId, "daily.followups", today())).toMatchObject({ status: "COMPLETED", progress: 1 });
  });

  it("expires missions whose period ended, without XP", async () => {
    const yesterday = addUtcDays(today(), -1);
    const stale = await prisma.mission.create({
      data: {
        userId,
        key: "daily.apply",
        title: "Submit 99 qualified applications",
        description: "test",
        type: "DAILY",
        campaign: "GET_HIRED",
        periodStart: yesterday,
        periodEnd: yesterday,
        target: 99,
        xpReward: 20,
        metadata: { metric: "APPLICATIONS_DAY" },
      },
    });
    await syncGameState(userId);
    expect(await prisma.mission.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({ status: "EXPIRED" });
    expect(await prisma.xpLedger.count({ where: { userId, dedupeKey: `xp:mission:${stale.id}` } })).toBe(0);
  });

  it("page queries assemble without errors", async () => {
    const summary = await getTodayMissionsSummary(userId);
    expect(summary.todayKey).toBe(dateKey(today()));
    expect(summary.daily.some((m) => m.key === "daily.apply" && m.status === "COMPLETED")).toBe(true);
    expect(summary.streak.current).toBeGreaterThanOrEqual(1);
    expect(summary.todayXp).toBeGreaterThan(0);
    const week = await getWeekPageData(userId);
    expect(week.days).toHaveLength(7);
    expect(week.days.filter((d) => d.isToday)).toHaveLength(1);
    const campaign = await getCampaignPageData(userId);
    expect(campaign.phases).toHaveLength(3);
    expect(campaign.phases[0]!.state).toBe("current");
    expect(campaign.electrician.missions.length).toBeGreaterThan(0);
    const ach = await getAchievementsPageData(userId);
    expect(ach.cards).toHaveLength(ACHIEVEMENTS.length);
    expect(ach.cards.find((c) => c.key === "first-application")?.unlocked).toBe(true);
    expect(ach.cards.find((c) => c.key === "ten-applications")).toMatchObject({ unlocked: false, target: 10 });
    expect(ach.stats.networking).toBeGreaterThan(0);
  });
});

describe("achievements: merged duplicates", () => {
  let userId = "";
  beforeAll(async () => {
    userId = await makeUser("merged");
  });

  it("a merged duplicate does not count twice toward Ten Applications", async () => {
    let ninth = "";
    for (let i = 1; i <= 9; i++) {
      const r = await createApplication(userId, input({ companyName: `Company ${i} Electric` }));
      ninth = r.application.id;
    }
    // The dedup engine merges a duplicate record of the ninth application into it.
    const dup = await prisma.application.create({
      data: {
        userId,
        companyName: "Company Nine Electric Inc.",
        normalizedCompany: "company nine electric",
        positionTitle: "Apprentice Electrician (Req 99)",
        normalizedTitle: "apprentice electrician req 99",
        status: "SUBMITTED",
        appliedAt: new Date(),
        mergedIntoId: ninth,
      },
    });
    await prisma.applicationEvent.create({ data: { userId, applicationId: dup.id, type: "APPLIED", dedupeKey: `${dup.id}:APPLIED`, verified: true } });

    expect(await countDistinctAppliedPositions(prisma, userId)).toBe(9);
    const unlocked = await prisma.$transaction((tx) => evaluateAchievements(tx, userId));
    expect(unlocked.map((u) => u.key)).not.toContain("ten-applications");
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "ten-applications" } })).toBe(0);

    await createApplication(userId, input({ companyName: "Company 10 Electric" }));
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "ten-applications" } })).toBe(1);
    expect(await prisma.$transaction((tx) => evaluateAchievements(tx, userId))).toEqual([]);
  });
});

describe("rest days, employment, paychecks and campaign missions", () => {
  let userId = "";
  beforeAll(async () => {
    userId = await makeUser("campaign");
    await syncGameState(userId);
  });

  it("a rest day pauses today's daily missions and undoing it restores them", async () => {
    expect(await mission(userId, "daily.apply", today())).toMatchObject({ status: "ACTIVE" });
    await setRestDay(userId, true);
    const skipped = await mission(userId, "daily.apply", today());
    expect(skipped?.status).toBe("SKIPPED");
    expect(readMissionMeta(skipped?.metadata).skipReason).toBe("REST_DAY");
    const summary = await getTodayMissionsSummary(userId);
    expect(summary.restDay).toBe(true);
    expect(summary.dailyTotal).toBe(0);
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.currentStreak).toBe(0);

    await setRestDay(userId, false);
    const restored = await mission(userId, "daily.apply", today());
    expect(restored?.status).toBe("ACTIVE");
    expect(readMissionMeta(restored?.metadata).skipReason).toBeUndefined();
  });

  it("reporting a job completes Get Hired, keeps the Electrician Path, pauses job-search missions and unlocks Six-Figure", async () => {
    const r = await reportEmployment(userId, {
      employer: "Bright Electric",
      title: "Electrician Trainee",
      startDate: dateKey(today()),
      amount: 50,
      period: "HOURLY",
      hoursPerWeek: 40,
    });
    expect(r.employment.annualized).toBe(104_000);
    expect(r.unlocked.map((u) => u.key)).toContain("six-figure-career");
    const rows = await prisma.campaignState.findMany({ where: { userId } });
    expect(rows.find((c) => c.campaign === "GET_HIRED")).toMatchObject({ status: "COMPLETED" });
    expect(rows.find((c) => c.campaign === "ELECTRICIAN_150K")).toMatchObject({ status: "ACTIVE" });
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(Number(stats.currentSalary)).toBe(104_000);
    const apply = await mission(userId, "daily.apply", today());
    expect(apply?.status).toBe("SKIPPED");
    expect(readMissionMeta(apply?.metadata).skipReason).toBe("HIRED");
    const e150 = await prisma.mission.findFirst({ where: { userId, key: "e150.trainee" } });
    expect(e150?.status).toBe("ACTIVE");
  });

  it("paychecks add to career earnings (self-reported), unlock First Paycheck, and can be removed", async () => {
    await expect(logPaycheck(userId, { amount: 10, payDate: dateKey(addUtcDays(today(), 2)) })).rejects.toBeInstanceOf(GameInputError);
    const r = await logPaycheck(userId, { amount: 1234.56, payDate: dateKey(today()) });
    expect(r.careerEarnings).toBeCloseTo(1234.56, 2);
    expect(r.unlocked.map((u) => u.key)).toContain("first-paycheck");
    const page = await getCampaignPageData(userId);
    expect(page.paychecks).toHaveLength(1);
    expect(page.employment?.employer).toBe("Bright Electric");
    const removed = await removePaycheck(userId, page.paychecks[0]!.id);
    expect(removed.careerEarnings).toBe(0);
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "first-paycheck" } })).toBe(1);
  });

  it("re-opening the job search restores job-search missions and keeps the job in history", async () => {
    await reopenJobSearch(userId);
    const gh = await prisma.campaignState.findUniqueOrThrow({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } } });
    expect(gh.status).toBe("ACTIVE");
    expect((gh.metadata as { pastEmployment?: unknown[] }).pastEmployment).toHaveLength(1);
    expect((await prisma.playerStats.findUniqueOrThrow({ where: { userId } })).currentSalary).toBeNull();
    expect((await mission(userId, "daily.apply", today()))?.status).toBe("ACTIVE");
    await expect(reopenJobSearch(userId)).rejects.toBeInstanceOf(GameInputError);
  });

  it("Phase 2 self-check missions complete once when checked off; activity missions cannot be checked off", async () => {
    const start = addUtcDays(today(), -39); // today is campaign day 40 → Phase 2
    await prisma.campaignState.update({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, data: { startedAt: start } });
    await syncGameState(userId);
    const analytics = await mission(userId, "gh.p2.analytics", addUtcDays(start, 30));
    expect(analytics).toMatchObject({ status: "ACTIVE", type: "CAMPAIGN" });
    const consistency = await mission(userId, "gh.p2.consistency", addUtcDays(start, 30));
    expect(consistency?.target).toBeGreaterThan(1);

    const r = await checkOffMission(userId, analytics!.id);
    expect(r.completed.map((m) => m.key)).toEqual(["gh.p2.analytics"]);
    expect(await mission(userId, "gh.p2.analytics", addUtcDays(start, 30))).toMatchObject({ status: "COMPLETED" });
    const xp = await prisma.xpLedger.findMany({ where: { userId, dedupeKey: `xp:mission:${analytics!.id}` } });
    expect(xp).toHaveLength(1);
    expect(xp[0]).toMatchObject({ reason: "MISSION_WEEKLY", amount: 50 });
    await expect(checkOffMission(userId, analytics!.id)).rejects.toBeInstanceOf(GameInputError);
    await expect(checkOffMission(userId, consistency!.id)).rejects.toBeInstanceOf(GameInputError);
  });

  it("Phase 3 next-phase plan completes from the saved plan", async () => {
    const start = addUtcDays(today(), -74); // day 75 → Phase 3
    await prisma.campaignState.update({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, data: { startedAt: start } });
    await syncGameState(userId);
    const plan = await mission(userId, "gh.p3.plan", addUtcDays(start, 60));
    expect(plan?.status).toBe("ACTIVE");
    await saveNextPhasePlan(userId, "Too short");
    expect((await mission(userId, "gh.p3.plan", addUtcDays(start, 60)))?.status).toBe("ACTIVE");
    const r = await saveNextPhasePlan(userId, "Keep applying daily, add two union apprenticeship programs and follow up every Friday.");
    expect(r.completed.map((m) => m.key)).toEqual(["gh.p3.plan"]);
    const page = await getCampaignPageData(userId);
    expect(page.nextPhasePlan?.text).toContain("union apprenticeship");
    expect(page.phases.map((p) => p.state)).toEqual(["done", "done", "current"]);
  });
});

describe("campaign restarts cannot farm mission XP", () => {
  let userId = "";
  beforeAll(async () => {
    userId = await makeUser("restart");
  });

  it("state-based missions are earned once; a superseded run's open missions expire", async () => {
    const run1 = addUtcDays(today(), -5);
    await prisma.campaignState.create({ data: { userId, campaign: "GET_HIRED", startedAt: run1, targetEndAt: addUtcDays(run1, 90) } });
    await syncGameState(userId);
    expect((await mission(userId, "gh.p1.onboarding", run1))?.status).toBe("ACTIVE");

    await prisma.userProfile.update({ where: { userId }, data: { onboardingCompletedAt: new Date() } });
    await syncGameState(userId);
    const done = await mission(userId, "gh.p1.onboarding", run1);
    expect(done?.status).toBe("COMPLETED");

    // Restart from today (what Settings → Campaign → Restart does to the campaign row).
    await prisma.campaignState.update({ where: { userId_campaign: { userId, campaign: "GET_HIRED" } }, data: { startedAt: today() } });
    await syncGameState(userId);
    await syncGameState(userId);
    expect(await prisma.mission.count({ where: { userId, key: "gh.p1.onboarding" } })).toBe(1);
    expect(await prisma.xpLedger.count({ where: { userId, dedupeKey: `xp:mission:${done!.id}` } })).toBe(1);
    expect(await prisma.xpLedger.count({ where: { userId, reason: "MISSION_WEEKLY", sourceType: "Mission", amount: 50 } })).toBe(1);

    expect((await mission(userId, "gh.p1.resume", run1))?.status).toBe("EXPIRED");
    expect((await mission(userId, "gh.p1.resume", today()))?.status).toBe("ACTIVE");

    const page = await getCampaignPageData(userId);
    const phase1 = page.phases[0]!.missions;
    expect(phase1.find((m) => m.key === "gh.p1.onboarding")?.status).toBe("COMPLETED");
    expect(phase1.filter((m) => m.key === "gh.p1.resume")).toHaveLength(1);
  });
});

describe("interview prep mission", () => {
  it("appears when an interview is within 14 days and completes when prep is marked", async () => {
    const userId = await makeUser("interview");
    const app = await createApplication(userId, input({ companyName: "Grid Partners" }));
    const { interview } = await scheduleInterview(userId, app.application.id, { type: "PHONE_SCREEN", scheduledAt: new Date(Date.now() + 3 * 86_400_000) });
    await syncGameState(userId);
    const prep = await prisma.mission.findFirstOrThrow({ where: { userId, key: "weekly.interview-prep" } });
    expect(prep).toMatchObject({ status: "ACTIVE", target: 1, progress: 0 });

    await markInterviewOutcome(userId, interview.id, { outcome: "PENDING", attended: false, prepCompleted: true });
    await prisma.$transaction((tx) =>
      applyEventToMissions(tx, { userId, type: "INTERVIEW_PREPARED", occurredAt: new Date(), activityDate: today(), sourceId: interview.id }),
    );
    expect(await prisma.mission.findUniqueOrThrow({ where: { id: prep.id } })).toMatchObject({ status: "COMPLETED", progress: 1 });
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.interviewSkill).toBe(10);
  });
});
