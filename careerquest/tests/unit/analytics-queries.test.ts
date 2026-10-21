import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` throws outside React Server Components; the modules under test are server modules.
vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { dateKeyInTz, todayInTz } from "@/lib/dates";
import { recordApplicationEvent } from "@/lib/events/record-event";
import { csvChunk, csvHeader, EXPORT_COLUMNS } from "@/lib/analytics/csv";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";
import { getAnalytics, getUserTimezone, iterateExportRows } from "@/lib/analytics/queries";
import { addDaysKey, utcDateKey } from "@/lib/analytics/time";
import Papa from "papaparse";

const TZ = "America/Los_Angeles";
const now = new Date();
const today = todayInTz(TZ, now);
const todayKey = utcDateKey(today);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const campaignStart = new Date(today.getTime() - 20 * 86_400_000);

let userId = "";
let resumeId = "";
const ids: Record<string, string> = {};

type Seed = {
  key: string;
  companyName: string;
  positionTitle: string;
  status: "SAVED" | "SUBMITTED" | "INTERVIEWING" | "REJECTED";
  source: "INDEED" | "LINKEDIN" | "OTHER";
  jobCategory?: string;
  appliedAt?: Date;
  followUpAt?: Date;
  archivedAt?: Date;
  resumeVersionId?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
};

async function seed(s: Seed) {
  const app = await prisma.application.create({
    data: {
      userId,
      companyName: s.companyName,
      normalizedCompany: s.companyName.toLowerCase(),
      positionTitle: s.positionTitle,
      normalizedTitle: s.positionTitle.toLowerCase(),
      status: s.status,
      source: s.source,
      jobCategory: s.jobCategory ?? null,
      appliedAt: s.appliedAt ?? null,
      followUpAt: s.followUpAt ?? null,
      archivedAt: s.archivedAt ?? null,
      resumeVersionId: s.resumeVersionId ?? null,
      salaryMin: s.salaryMin ?? null,
      salaryMax: s.salaryMax ?? null,
      location: s.location ?? null,
    },
    select: { id: true },
  });
  ids[s.key] = app.id;
  return app.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `analytics-test+${Date.now()}${Math.floor(Math.random() * 1e6)}@careerquest.test`,
      name: "Analytics Tester",
      passwordHash: "not-a-real-hash",
      profile: { create: { timezone: TZ } },
      stats: { create: {} },
      campaigns: { create: [{ campaign: "GET_HIRED", startedAt: campaignStart }] },
    },
    select: { id: true },
  });
  userId = user.id;
  const resume = await prisma.resumeVersion.create({ data: { userId, name: "Trades résumé v2", content: "..." }, select: { id: true } });
  resumeId = resume.id;

  await seed({
    key: "A",
    companyName: "Acme Electric",
    positionTitle: "Apprentice Electrician",
    status: "SUBMITTED",
    source: "INDEED",
    jobCategory: "Electrician",
    appliedAt: daysAgo(3),
    followUpAt: today, // date-only value → due today
    resumeVersionId: resumeId,
    salaryMin: 28,
    salaryMax: 35,
    location: "Irvine, CA",
  });
  await seed({
    key: "B",
    companyName: "Bolt Power",
    positionTitle: "HVAC Technician",
    status: "INTERVIEWING",
    source: "LINKEDIN",
    jobCategory: "HVAC",
    appliedAt: daysAgo(10),
    salaryMin: 70000,
    salaryMax: 90000,
    location: "Los Angeles, CA",
  });
  await seed({ key: "C", companyName: "Saved Co", positionTitle: "Maintenance Tech", status: "SAVED", source: "OTHER" });
  await seed({ key: "D", companyName: "Archived Inc", positionTitle: "Helper", status: "SUBMITTED", source: "INDEED", appliedAt: daysAgo(2), archivedAt: now });
  await seed({ key: "E", companyName: "Rejecto", positionTitle: "Electrician", status: "REJECTED", source: "INDEED", jobCategory: "Electrician", appliedAt: daysAgo(40) });

  // Lifecycle events go through the shared contract (XP + DailyActivity are side effects of it).
  await prisma.$transaction(async (tx) => {
    await recordApplicationEvent(tx, { userId, applicationId: ids.A!, type: "APPLIED", source: "USER", activityDate: today, occurredAt: daysAgo(3) });
    await recordApplicationEvent(tx, { userId, applicationId: ids.A!, type: "RECRUITER_RESPONSE", source: "USER", activityDate: today, occurredAt: daysAgo(1) });
    await recordApplicationEvent(tx, { userId, applicationId: ids.B!, type: "APPLIED", source: "USER", activityDate: today, occurredAt: daysAgo(10) });
    await recordApplicationEvent(tx, { userId, applicationId: ids.E!, type: "APPLIED", source: "USER", activityDate: today, occurredAt: daysAgo(40) });
    await recordApplicationEvent(tx, { userId, applicationId: ids.A!, type: "FOLLOW_UP_SENT", source: "USER", activityDate: today, occurredAt: now });
  });
  await prisma.applicationStatusHistory.createMany({
    data: [
      { applicationId: ids.B!, fromStatus: "SUBMITTED", toStatus: "SCREENING", occurredAt: daysAgo(7) },
      { applicationId: ids.B!, fromStatus: "SCREENING", toStatus: "INTERVIEWING", occurredAt: daysAgo(4) },
    ],
  });
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } }); // cascades to everything
  await prisma.$disconnect();
});

describe("getAnalytics", () => {
  it("computes totals, funnel, timing and distributions from real rows (all time)", async () => {
    const data = await getAnalytics(userId, parseAnalyticsFilters({}), now);

    expect(data.timezone).toBe(TZ);
    expect(data.todayKey).toBe(todayKey);
    expect(data.hasAnyApplications).toBe(true);
    expect(data.capped).toBe(false);
    expect(data.range).toMatchObject({ preset: "all", fromKey: null, toKey: null });
    expect(data.totals).toEqual({ applications: 4, applied: 3 }); // archived D excluded
    expect(data.funnel.counts).toEqual({ total: 4, applied: 3, responded: 3, screened: 1, interviewed: 1, offers: 0, hired: 0 });
    expect(data.funnel.rates.responseRate).toMatchObject({ value: 1, n: 3, lowSample: true });
    expect(data.funnel.rates.interviewRate.value).toBeCloseTo(1 / 3, 5);
    expect(data.funnel.rates.offerRate.value).toBe(0);
    expect(data.funnel.rates.offerRate.interval).not.toBeNull();

    // A: applied 3 days ago, responded 1 day ago → 2 days. B: applied 10 days ago, screening 7 days ago → 3 days.
    // E: rejected with no response timestamp other than statusUpdatedAt (now) → 40 days.
    expect(data.timing.n).toBe(3);
    expect(data.timing.averageDays).toBeCloseTo(15, 1);
    expect(data.timing.medianDays).toBeCloseTo(3, 1);

    // Pipeline order (saved → hired), then terminal statuses.
    expect(data.statusDistribution).toEqual([
      { status: "SAVED", count: 1 },
      { status: "SUBMITTED", count: 1 },
      { status: "INTERVIEWING", count: 1 },
      { status: "REJECTED", count: 1 },
    ]);
    expect(data.sourceDistribution).toEqual([
      { source: "INDEED", count: 2 },
      { source: "LINKEDIN", count: 1 },
      { source: "OTHER", count: 1 },
    ]);

    expect(data.bySource.map((r) => [r.key, r.applied, r.interviews])).toEqual([
      ["INDEED", 2, 0],
      ["LINKEDIN", 1, 1],
      ["OTHER", 0, 0],
    ]);
    expect(data.byCategory.map((r) => r.key)).toEqual(["Electrician", "HVAC", null]);
    expect(data.byResume.map((r) => [r.key, r.applied])).toEqual([
      [null, 2],
      [resumeId, 1],
    ]);
    expect(data.resumeNames[resumeId]).toBe("Trades résumé v2");

    expect(data.options.sources).toEqual(expect.arrayContaining(["INDEED", "LINKEDIN", "OTHER"]));
    expect(data.options.sources).toHaveLength(3);
    expect(data.options.categories).toEqual(["Electrician", "HVAC"]);
    expect(data.options.employers).toEqual(["Acme Electric", "Bolt Power", "Rejecto", "Saved Co"]);
  });

  it("builds daily and weekly series from APPLIED events and the activity log", async () => {
    const data = await getAnalytics(userId, parseAnalyticsFilters({}), now);
    expect(data.daily).toHaveLength(90);
    expect(data.daily[data.daily.length - 1]!.key).toBe(todayKey);
    const keyA = dateKeyInTz(daysAgo(3), TZ);
    const keyB = dateKeyInTz(daysAgo(10), TZ);
    expect(data.daily.find((p) => p.key === keyA)?.applied).toBe(1);
    expect(data.daily.find((p) => p.key === keyB)?.applied).toBe(1);
    // DailyActivity recorded all three APPLIED events (and one follow-up) under today's activity date.
    expect(data.daily.find((p) => p.key === todayKey)).toMatchObject({ logged: 3, followUps: 1 });
    expect(data.weekly.reduce((a, w) => a + w.applied, 0)).toBe(3); // A, B, E all within 52 weeks
    expect(data.weekly.reduce((a, w) => a + w.followUps, 0)).toBe(1);
    expect(data.weekly[data.weekly.length - 1]!.days).toBeGreaterThanOrEqual(1);
  });

  it("counts follow-up workload for active applications", async () => {
    const data = await getAnalytics(userId, parseAnalyticsFilters({}), now);
    expect(data.followUps).toMatchObject({ overdue: 0, dueToday: 1, laterThisWeek: 0 });
    expect(data.followUps.weekEndKey >= todayKey).toBe(true);
  });

  it("honors the date range (appliedAt, falling back to createdAt for saved leads)", async () => {
    const data = await getAnalytics(userId, parseAnalyticsFilters({ range: "7d" }), now);
    expect(data.range.fromKey).toBe(addDaysKey(todayKey, -6));
    expect(data.totals).toEqual({ applications: 2, applied: 1 }); // A (applied 3d ago) + C (saved today)
    expect(data.funnel.counts.responded).toBe(1);
    expect(data.daily).toHaveLength(7);

    const campaign = await getAnalytics(userId, parseAnalyticsFilters({ range: "campaign" }), now);
    expect(campaign.range.fromKey).toBe(utcDateKey(campaignStart));
    expect(campaign.totals.applications).toBe(3); // E (40 days ago) is before the campaign
  });

  it("honors status, source, category, employer, location and salary filters", async () => {
    expect((await getAnalytics(userId, parseAnalyticsFilters({ status: "INTERVIEWING" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ source: "INDEED" }), now)).totals).toEqual({ applications: 2, applied: 2 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ category: "hvac" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ employer: "acme electric" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ location: "irvine" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ salaryMin: "50000" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ salaryMax: "40" }), now)).totals).toEqual({ applications: 1, applied: 1 });
    expect((await getAnalytics(userId, parseAnalyticsFilters({ archived: "1" }), now)).totals).toEqual({ applications: 5, applied: 4 });
  });

  it("reports an empty-but-filtered state distinctly from a new account", async () => {
    const filtered = await getAnalytics(userId, parseAnalyticsFilters({ status: "HIRED" }), now);
    expect(filtered.hasAnyApplications).toBe(true);
    expect(filtered.totals).toEqual({ applications: 0, applied: 0 });
    expect(filtered.funnel.rates.responseRate.value).toBeNull();
    expect(filtered.timing).toEqual({ averageDays: null, medianDays: null, n: 0 });
    expect(filtered.statusDistribution).toEqual([]);
    expect(filtered.bySource).toEqual([]);
    // Filter options still come from the whole tracker so the user can change course.
    expect(filtered.options.sources).toHaveLength(3);
  });

  it("never leaks another user's data", async () => {
    const other = await prisma.user.create({
      data: { email: `analytics-other+${Date.now()}@careerquest.test`, name: "Other", passwordHash: "x", profile: { create: {} }, stats: { create: {} } },
      select: { id: true },
    });
    try {
      const data = await getAnalytics(other.id, parseAnalyticsFilters({}), now);
      expect(data.hasAnyApplications).toBe(false);
      expect(data.totals).toEqual({ applications: 0, applied: 0 });
      expect(data.options).toEqual({ sources: [], categories: [], employers: [] });
      expect(data.followUps).toMatchObject({ overdue: 0, dueToday: 0, laterThisWeek: 0 });
      expect(await getUserTimezone(other.id)).toBe("America/Los_Angeles");
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

describe("iterateExportRows", () => {
  async function collect(filters: ReturnType<typeof parseAnalyticsFilters>) {
    const rows = [];
    for await (const batch of iterateExportRows(userId, filters, now)) rows.push(...batch);
    return rows;
  }

  it("exports the same slice the page shows, with every column", async () => {
    const rows = await collect(parseAnalyticsFilters({}));
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.company)).toEqual(["Acme Electric", "Bolt Power", "Saved Co", "Rejecto"]); // createdAt order
    for (const r of rows) expect(Object.keys(r)).toEqual([...EXPORT_COLUMNS]);
    const a = rows.find((r) => r.company === "Acme Electric")!;
    expect(a).toMatchObject({ status: "SUBMITTED", source: "INDEED", salaryMin: "28", salaryMax: "35", jobCategory: "Electrician", createdVia: "MANUAL", location: "Irvine, CA" });
    expect(a.appliedAt).toBe(daysAgo(3).toISOString());
    expect(a.followUpAt).toBe(today.toISOString());

    const csv = csvHeader() + csvChunk(rows);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(4);
    expect(parsed.data[0]!.id).toBe(ids.A);
  });

  it("applies filters and yields nothing for an empty slice", async () => {
    expect((await collect(parseAnalyticsFilters({ source: "LINKEDIN" }))).map((r) => r.company)).toEqual(["Bolt Power"]);
    expect(await collect(parseAnalyticsFilters({ status: "HIRED" }))).toEqual([]);
    expect((await collect(parseAnalyticsFilters({ archived: "1" }))).length).toBe(5);
  });
});
