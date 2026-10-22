/**
 * Regression tests for the dashboard / Numbers-game review findings:
 * - F1 at the metric level: a closed never-applied lead never counts as applied anywhere.
 * - F3: the Numbers game measures the campaign window, not the all-time total.
 * - F5: the dashboard funnel uses the same stage definitions as Analytics (computeFunnel), so the
 *   two pages agree, rates never exceed 100% and a low-sample flag is exposed.
 * - Merged records are excluded from every count and list; deleted records stop counting.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { todayInTz } from "@/lib/dates";
import { applicationInputSchema } from "@/lib/validation/application";
import { archiveApplication, changeStatus, createApplication, deleteApplication } from "@/lib/applications/service";
import { getDashboardData, getGoalsData } from "@/lib/dashboard/queries";
import { getAnalytics } from "@/lib/analytics/queries";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { addDaysUtc } from "@/lib/goals/days";

const TZ = "America/Los_Angeles";
const now = new Date();
const today = todayInTz(TZ, now);
const DAY = 86_400_000;

const users: string[] = [];
async function makeUser(label: string, campaignStart: Date) {
  const u = await prisma.user.create({
    data: {
      email: `${label}+${Date.now()}${Math.floor(Math.random() * 1e6)}@careerquest.test`,
      name: label,
      passwordHash: "x",
      profile: { create: { timezone: TZ, dailyApplicationTarget: 5, workdaysPerWeek: 5, weeklyApplicationTarget: 25, campaignLengthDays: 90 } },
      stats: { create: {} },
      campaigns: { create: [{ campaign: "GET_HIRED", startedAt: campaignStart }] },
    },
    select: { id: true },
  });
  users.push(u.id);
  return u.id;
}

const input = (over: Record<string, unknown>) =>
  applicationInputSchema.parse({ companyName: "Metric Co", positionTitle: `Role ${Math.random().toString(36).slice(2, 8)}`, ...over });

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("dashboard funnel and counts share one definition with Analytics", () => {
  let userId = "";
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    userId = await makeUser("dash-fixes", addDaysUtc(today, -4));
    const mk = async (key: string, status: string, over: Record<string, unknown> = {}) => {
      ids[key] = (await createApplication(userId, input({ status, companyName: `Co ${key}`, ...over }))).application.id;
    };
    await mk("A", "SUBMITTED");
    await mk("B", "SUBMITTED");
    await changeStatus(userId, ids.B!, { status: "INTERVIEWING" });
    await changeStatus(userId, ids.B!, { status: "PREPARING", note: "Logged on the wrong record" });
    await mk("C", "SUBMITTED");
    await changeStatus(userId, ids.C!, { status: "ACCEPTED" });
    await mk("D", "SAVED");
    await changeStatus(userId, ids.D!, { status: "CLOSED" }); // never applied
    await mk("E", "SUBMITTED");
    await archiveApplication(userId, ids.E!);
    await mk("G", "SUBMITTED");
    await deleteApplication(userId, ids.G!);
    // F is a duplicate merged into A; created last so its events would top "recent" if leaked.
    await mk("F", "SUBMITTED", { followUpAt: new Date(now.getTime() - 3 * DAY).toISOString() });
    await prisma.application.update({ where: { id: ids.F! }, data: { mergedIntoId: ids.A! } });
    await prisma.interview.create({ data: { userId, applicationId: ids.F!, scheduledAt: new Date(now.getTime() + DAY), type: "PHONE_SCREEN" } });
  });

  it("dashboard funnel equals Analytics' default funnel (ACCEPTED counts as hired, corrected records stay applied)", async () => {
    const dash = await getDashboardData(userId, now);
    const analytics = await getAnalytics(userId, parseAnalyticsFilters({}), now);
    const c = analytics.funnel.counts;
    expect(dash.funnel).toEqual({ submitted: c.applied, responses: c.responded, screenings: c.screened, interviews: c.interviewed, offers: c.offers, hires: c.hired });
    expect(dash.funnel).toEqual({ submitted: 3, responses: 2, screenings: 2, interviews: 2, offers: 1, hires: 1 });
    expect(dash.totals).toEqual({ applications: 4, submitted: 3 }); // A B C D (archived E, merged F excluded)
    expect(analytics.totals).toEqual({ applications: 4, applied: 3 });
  });

  it("rates come from the shared estimator and carry the low-sample flag", async () => {
    const dash = await getDashboardData(userId, now);
    expect(dash.rates.n).toBe(3);
    expect(dash.rates.interview).toBeCloseTo(2 / 3, 5);
    expect(dash.rates.response).toBeCloseTo(2 / 3, 5);
    expect(dash.rates.lowSample).toBe(true);
    expect(dash.rates.interviewInterval).not.toBeNull();
    expect(dash.rates.interview!).toBeLessThanOrEqual(1);
  });

  it("effort counts include archived records but never merged, deleted or never-applied ones", async () => {
    const dash = await getDashboardData(userId, now);
    expect(dash.today.submitted).toBe(4); // A B C E
    expect(dash.week.submitted).toBe(4);
    expect(dash.series[dash.series.length - 1]!.count).toBe(4);
    const goals = await getGoalsData(userId, now);
    expect(goals.completed).toBe(4);
    expect(goals.completedAllTime).toBe(4);
  });

  it("merged records are left out of lists on the dashboard", async () => {
    const dash = await getDashboardData(userId, now);
    expect(dash.recent.some((e) => e.applicationId === ids.F)).toBe(false);
    expect(dash.followUps.overdue.some((f) => f.id === ids.F)).toBe(false);
    expect(dash.interviews.some((i) => i.applicationId === ids.F)).toBe(false);
  });

  it("closing another never-applied lead changes nothing (F1)", async () => {
    const before = await getDashboardData(userId, now);
    const { application } = await createApplication(userId, input({ status: "SAVED", companyName: "Co H" }));
    await changeStatus(userId, application.id, { status: "WITHDRAWN" });
    const after = await getDashboardData(userId, now);
    expect(after.today.submitted).toBe(before.today.submitted);
    expect(after.funnel.submitted).toBe(before.funnel.submitted);
    expect((await getGoalsData(userId, now)).completed).toBe(4);
    expect((await getAnalytics(userId, parseAnalyticsFilters({}), now)).funnel.counts.applied).toBe(3);
  });
});

describe("Numbers game measures the campaign window (F3)", () => {
  it("a restarted campaign does not inherit earlier or backdated applications", async () => {
    const userId = await makeUser("goals-fixes", today); // campaign restarted today
    const monthAgo = new Date(now.getTime() - 30 * DAY);
    for (let i = 0; i < 3; i++) {
      const { application } = await createApplication(userId, { ...input({ status: "SUBMITTED", companyName: `Old ${i}` }), appliedAt: monthAgo });
      if (i === 0) await changeStatus(userId, application.id, { status: "REJECTED", occurredAt: monthAgo });
    }
    await createApplication(userId, input({ status: "SUBMITTED", companyName: "New today" }));

    const g = await getGoalsData(userId, now);
    expect(g.completed).toBe(1);
    expect(g.completedAllTime).toBe(4);
    expect(g.responses).toBe(0); // the rejection belongs to an application from before the campaign
    expect(g.responseRate).toBe(0);
    expect(g.pace.campaignDay).toBe(1);
    expect(g.pace.observedDailyPace).toBeCloseTo(1, 5); // 1 application over max(1, 5/7) workdays
    expect(Object.values(g.activityByDate).reduce((a, b) => a + b, 0)).toBe(1);

    const dash = await getDashboardData(userId, now);
    expect(dash.today.submitted).toBe(1);
    expect(dash.totals.submitted).toBe(4); // all-time tile stays all-time
  });
});
