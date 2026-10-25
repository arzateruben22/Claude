import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` throws outside React Server Components; the modules under test are server modules.
vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { todayInTz } from "@/lib/dates";
import { recordApplicationEvent } from "@/lib/events/record-event";
import { XP } from "@/lib/game/xp-config";
import { getDashboardData, getGoalsData } from "@/lib/dashboard/queries";
import { addDaysUtc, utcDateKey } from "@/lib/goals/days";

const TZ = "America/Los_Angeles";
const now = new Date();
const today = todayInTz(TZ, now);
const campaignStart = addDaysUtc(today, -11); // today is campaign day 12

let userId = "";
let submittedA = "";
let submittedB = "";

async function createApplication(data: { companyName: string; positionTitle: string; status: "SAVED" | "SUBMITTED"; appliedAt?: Date; followUpAt?: Date }) {
  const app = await prisma.application.create({
    data: {
      userId,
      companyName: data.companyName,
      normalizedCompany: data.companyName.toLowerCase(),
      positionTitle: data.positionTitle,
      normalizedTitle: data.positionTitle.toLowerCase(),
      status: data.status,
      appliedAt: data.appliedAt ?? null,
      followUpAt: data.followUpAt ?? null,
    },
    select: { id: true },
  });
  return app.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `dashboard-test+${Date.now()}${Math.floor(Math.random() * 1e6)}@careerquest.test`,
      name: "Dashboard Tester",
      passwordHash: "not-a-real-hash",
      profile: { create: { timezone: TZ, dailyApplicationTarget: 5, workdaysPerWeek: 5, weeklyApplicationTarget: 25, campaignLengthDays: 90 } },
      stats: { create: {} },
      campaigns: { create: [{ campaign: "GET_HIRED", startedAt: campaignStart, targetEndAt: addDaysUtc(campaignStart, 89) }] },
    },
    select: { id: true },
  });
  userId = user.id;

  submittedA = await createApplication({
    companyName: "Acme Electric",
    positionTitle: "Apprentice Electrician",
    status: "SUBMITTED",
    appliedAt: now,
    followUpAt: addDaysUtc(today, -2), // overdue follow-up
  });
  submittedB = await createApplication({ companyName: "Bolt Power", positionTitle: "Electrical Helper", status: "SUBMITTED", appliedAt: now });
  await createApplication({ companyName: "Saved Co", positionTitle: "Maintenance Tech", status: "SAVED" });

  // Lifecycle changes go through the shared event contract (XP + DailyActivity are side effects of it).
  await prisma.$transaction(async (tx) => {
    for (const applicationId of [submittedA, submittedB]) {
      await recordApplicationEvent(tx, { userId, applicationId, type: "APPLIED", source: "USER", activityDate: today, occurredAt: now });
    }
    await recordApplicationEvent(tx, {
      userId,
      applicationId: submittedB,
      type: "RECRUITER_RESPONSE",
      source: "USER",
      activityDate: today,
      occurredAt: now,
    });
  });
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } }); // cascades to everything
  await prisma.$disconnect();
});

describe("getDashboardData", () => {
  it("counts today's submissions, totals and the funnel from real rows", async () => {
    const data = await getDashboardData(userId, now);

    expect(data.todayKey).toBe(utcDateKey(today));
    expect(data.today).toEqual({ submitted: 2, target: 5 });
    expect(data.week.submitted).toBe(2);
    expect(data.week.target).toBe(25);
    expect(data.totals).toEqual({ applications: 3, submitted: 2 });
    expect(data.funnel).toEqual({ submitted: 2, responses: 1, screenings: 0, interviews: 0, offers: 0, hires: 0 });
    expect(data.rates.n).toBe(2);
    expect(data.rates.response).toBeCloseTo(0.5, 5);
    expect(data.rates.interview).toBe(0);

    expect(data.series).toHaveLength(14);
    expect(data.series[13]).toMatchObject({ key: utcDateKey(today), count: 2 });
    expect(data.series.slice(0, 13).every((p) => p.count === 0)).toBe(true);

    expect(data.campaign.day).toBe(12);
    expect(data.campaign.phase).toBe(1);
    expect(data.campaign.eyebrow).toBe("Day 12 of 90 · Phase 1");

    expect(data.xp.totalXp).toBe(XP.APPLICATION_SUBMITTED * 2);
    expect(data.xp.level).toBeGreaterThanOrEqual(1);
    expect(data.profile.onboardingComplete).toBe(false);
  });

  it("surfaces overdue follow-ups and recommends them as the next action", async () => {
    const data = await getDashboardData(userId, now);
    expect(data.followUps.overdue.map((f) => f.id)).toEqual([submittedA]);
    expect(data.followUps.dueToday).toEqual([]);
    expect(data.followUps.capped).toBe(false);
    expect(data.nextAction.key).toBe("follow-up");
    expect(data.nextAction.href).toBe(`/applications/${submittedA}`);
    expect(data.interviews).toEqual([]);
    // Missions are owned by the game engine; the dashboard mounts its TodayMissionsCard instead of a
    // second mission query, so DashboardData carries no mission list.
    expect("missions" in data).toBe(false);
    expect(data.recent.map((e) => e.type).sort()).toEqual(["APPLIED", "APPLIED", "RECRUITER_RESPONSE"]);
    expect(data.recent.every((e) => e.companyName.length > 0)).toBe(true);
  });

  it("is idempotent against repeated events (no double counting)", async () => {
    await prisma.$transaction((tx) =>
      recordApplicationEvent(tx, { userId, applicationId: submittedA, type: "APPLIED", source: "USER", activityDate: today, occurredAt: now }),
    );
    const data = await getDashboardData(userId, now);
    expect(data.today.submitted).toBe(2);
    expect(data.xp.totalXp).toBe(XP.APPLICATION_SUBMITTED * 2);
  });

  it("never leaks another user's data", async () => {
    const other = await prisma.user.create({
      data: { email: `dashboard-other+${Date.now()}@careerquest.test`, name: "Other", passwordHash: "x", profile: { create: {} }, stats: { create: {} } },
      select: { id: true },
    });
    try {
      const data = await getDashboardData(other.id, now);
      expect(data.totals).toEqual({ applications: 0, submitted: 0 });
      expect(data.today.submitted).toBe(0);
      expect(data.followUps.overdue).toEqual([]);
      expect(data.nextAction.key).toBe("first-application");
      expect(data.campaign.day).toBe(1); // falls back to the signup date when no campaign row exists
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

describe("getGoalsData", () => {
  it("feeds observed totals into the pace calculator", async () => {
    const g = await getGoalsData(userId, now);
    expect(g.completed).toBe(2);
    expect(g.responses).toBe(1);
    expect(g.responseRate).toBeCloseTo(0.5, 5);
    expect(g.campaignStartKey).toBe(utcDateKey(campaignStart));
    expect(g.pace.campaignDay).toBe(12);
    expect(g.pace.campaignGoalApplications).toBe(321);
    expect(g.pace.remainingToGoal).toBe(319);
    expect(g.pace.nextMilestone).toBe(10);
    expect(g.pace.remainingToNextMilestone).toBe(8);
    expect(g.pace.consistency).toBeCloseTo(1 / 9, 5); // one active day of ~9 elapsed workdays
    expect(g.pace.expectedResponses).toBeCloseTo(1, 5);
    expect(g.activityByDate[utcDateKey(today)]).toBe(2);
    expect(g.suggestions).toEqual([]); // under both data thresholds
    expect(g.dataRequirements).toContain("14 campaign days (currently 12)");
  });
});
