import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { addDaysKey, startOfDayInTz } from "@/lib/analytics/time";
import { dateFromKey } from "@/lib/dates";
import { computeWeeklyReport, getWeeklyReport, listReportWeeks } from "@/lib/reports/weekly";
import { currentWeekStartKey, formatDelta, isWeekStartKey, weekLabel } from "@/lib/reports/week";
import { REPORT_CSV_COLUMNS, weeklyReportCsv } from "@/lib/reports/csv";
import type { WeeklyReportData } from "@/lib/reports/types";
import { GET } from "@/app/api/reports/[weekStart]/route";

const TZ = "America/Los_Angeles";
const now = new Date();
const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const current = currentWeekStartKey(TZ, now);
const W = addDaysKey(current, -14); // the seeded week (Monday)
const P = addDaysKey(W, -7); // the week before it

/** Noon (or `hour`) in Los Angeles on day `offset` of the week starting `week`. */
function at(week: string, offset: number, hour = 12): Date {
  return new Date(startOfDayInTz(addDaysKey(week, offset), TZ).getTime() + hour * 3_600_000);
}

let userId = "";
let otherId = "";

async function application(opts: {
  company: string;
  applied: Date;
  history?: Array<{ to: "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED"; at: Date }>;
  forUser?: string;
}) {
  const history = opts.history ?? [];
  const final = history.length ? history[history.length - 1]!.to : "SUBMITTED";
  const row = await prisma.application.create({
    data: {
      userId: opts.forUser ?? userId,
      companyName: opts.company,
      normalizedCompany: opts.company.toLowerCase(),
      positionTitle: "Apprentice Electrician",
      normalizedTitle: "apprentice electrician",
      status: final,
      appliedAt: opts.applied,
      statusUpdatedAt: history.length ? history[history.length - 1]!.at : opts.applied,
      statusHistory: {
        create: [{ toStatus: "SUBMITTED", occurredAt: opts.applied, verified: true }, ...history.map((h) => ({ toStatus: h.to, occurredAt: h.at, verified: true }))],
      },
    },
    select: { id: true },
  });
  return row.id;
}

function rowOf(r: WeeklyReportData, key: string) {
  const row = r.rows.find((x) => x.key === key);
  if (!row) throw new Error(`missing row ${key}`);
  return row;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `reports-test+${suffix}@careerquest.test`,
      name: "Report Tester",
      passwordHash: "x",
      createdAt: at(P, 0, 8),
      profile: { create: { timezone: TZ, weeklyApplicationTarget: 20, dailyApplicationTarget: 4, workdaysPerWeek: 5 } },
      stats: { create: {} },
    },
    select: { id: true },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `reports-test-other+${suffix}@careerquest.test`, name: "Other", passwordHash: "x", profile: { create: { timezone: TZ } } },
    select: { id: true },
  });
  otherId = other.id;

  // This week (W): 4 applications on 3 days, one response, one that reached interview then offer.
  const a1 = await application({ company: "Alpha", applied: at(W, 0), history: [{ to: "SCREENING", at: at(W, 3) }] });
  const a2 = await application({ company: "Bravo", applied: at(W, 1), history: [{ to: "INTERVIEWING", at: at(W, 4) }, { to: "OFFER", at: at(W, 5) }] });
  const a3 = await application({ company: "Charlie", applied: at(W, 2) });
  // A date-only application date (UTC midnight) counts by its calendar date, Tuesday of W.
  await application({ company: "Delta", applied: dateFromKey(addDaysKey(W, 1)) });
  await prisma.interview.create({ data: { userId, applicationId: a2, scheduledAt: at(W, 6, 10), createdAt: at(W, 4) } });
  await prisma.offer.create({ data: { userId, applicationId: a2, baseAmount: 28, period: "HOURLY", createdAt: at(W, 5) } });
  // Prior week (P): 2 applications, one rejection.
  const p1 = await application({ company: "Echo", applied: at(P, 1), history: [{ to: "REJECTED", at: at(P, 4) }] });
  await application({ company: "Foxtrot", applied: at(P, 2) });

  // Follow-ups: two this week, one prior week.
  await prisma.applicationEvent.createMany({
    data: [
      { userId, applicationId: a3, type: "FOLLOW_UP_SENT", occurredAt: at(W, 2), dedupeKey: `t:${suffix}:f1` },
      { userId, applicationId: a1, type: "FOLLOW_UP_SENT", occurredAt: at(W, 4), dedupeKey: `t:${suffix}:f2` },
      { userId, applicationId: p1, type: "FOLLOW_UP_SENT", occurredAt: at(P, 3), dedupeKey: `t:${suffix}:f3` },
    ],
  });
  // XP: +25 ×3 and a −25 revocation this week (net 50); +40 the prior week.
  await prisma.xpLedger.createMany({
    data: [
      { userId, amount: 25, reason: "APPLICATION_SUBMITTED", dedupeKey: `t:${suffix}:x1`, createdAt: at(W, 0) },
      { userId, amount: 25, reason: "APPLICATION_SUBMITTED", dedupeKey: `t:${suffix}:x2`, createdAt: at(W, 1) },
      { userId, amount: 25, reason: "APPLICATION_SUBMITTED", dedupeKey: `t:${suffix}:x3`, createdAt: at(W, 2) },
      { userId, amount: -25, reason: "REVOKED", dedupeKey: `t:${suffix}:x4`, createdAt: at(W, 3) },
      { userId, amount: 40, reason: "MISSION_DAILY", dedupeKey: `t:${suffix}:x5`, createdAt: at(P, 2) },
    ],
  });
  await prisma.mission.create({
    data: {
      userId,
      key: `test.mission.${suffix}`,
      title: "Submit 4 qualified applications",
      description: "test",
      type: "DAILY",
      campaign: "GET_HIRED",
      periodStart: dateFromKey(addDaysKey(W, 2)),
      periodEnd: dateFromKey(addDaysKey(W, 2)),
      status: "COMPLETED",
      completedAt: at(W, 2, 18),
    },
  });
  await prisma.lessonProgress.create({ data: { userId, lessonKey: "ohms-law", status: "COMPLETED", completedAt: at(W, 3), attempts: 1, bestScore: 80 } });
  await prisma.quizAttempt.createMany({
    data: [
      { userId, quizKey: "ohms-law-quiz", score: 8, maxScore: 10, passed: true, createdAt: at(W, 3) },
      { userId, quizKey: "ac-and-dc-quiz", score: 4, maxScore: 10, passed: false, createdAt: at(W, 4) },
    ],
  });
  await prisma.workHourEntry.createMany({
    data: [
      { userId, employer: "Acme", dateWorked: dateFromKey(addDaysKey(W, 1)), hours: 8, verification: "SELF_REPORTED" },
      { userId, employer: "Acme", dateWorked: dateFromKey(addDaysKey(W, 2)), hours: 6, verification: "EMPLOYER_VERIFIED" },
      { userId, employer: "Acme", dateWorked: dateFromKey(addDaysKey(P, 3)), hours: 4, verification: "SELF_REPORTED" },
    ],
  });
});

afterAll(async () => {
  const ids = [userId, otherId].filter(Boolean);
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("week helpers", () => {
  it("validates Monday week starts and labels weeks", () => {
    expect(isWeekStartKey(W)).toBe(true);
    expect(isWeekStartKey(addDaysKey(W, 1))).toBe(false);
    expect(isWeekStartKey("2026-02-30")).toBe(false);
    expect(weekLabel("2026-10-19")).toBe("Oct 19 – Oct 25, 2026");
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-1.5)).toBe("−1.5");
  });
});

describe("weekly report from a seeded week", () => {
  it("counts every section against the prior week", async () => {
    const r = await computeWeeklyReport(userId, W, now);
    expect(r.weekStart).toBe(W);
    expect(r.weekEnd).toBe(addDaysKey(W, 6));
    expect(r.complete).toBe(true);
    expect(r.target).toEqual({ weekly: 20, daily: 4 });
    expect(rowOf(r, "applications.applied")).toMatchObject({ thisWeek: 4, priorWeek: 2, delta: 2 });
    expect(rowOf(r, "applications.active_days")).toMatchObject({ thisWeek: 3, priorWeek: 2 });
    expect(rowOf(r, "funnel.responses")).toMatchObject({ thisWeek: 2, priorWeek: 1 });
    expect(rowOf(r, "funnel.interviews")).toMatchObject({ thisWeek: 1, priorWeek: 0 });
    expect(rowOf(r, "interviews.scheduled")).toMatchObject({ thisWeek: 1, priorWeek: 0 });
    expect(rowOf(r, "funnel.offers")).toMatchObject({ thisWeek: 1, priorWeek: 0 });
    expect(rowOf(r, "followups.sent")).toMatchObject({ thisWeek: 2, priorWeek: 1 });
    expect(rowOf(r, "progress.xp")).toMatchObject({ thisWeek: 50, priorWeek: 40, delta: 10 });
    expect(rowOf(r, "progress.missions")).toMatchObject({ thisWeek: 1, priorWeek: 0 });
    expect(rowOf(r, "learning.lessons")).toMatchObject({ thisWeek: 1, priorWeek: 0 });
    expect(rowOf(r, "learning.quiz_attempts")).toMatchObject({ thisWeek: 2, priorWeek: 0 });
    expect(rowOf(r, "learning.quizzes_passed")).toMatchObject({ thisWeek: 1 });
    expect(r.quizAverage.thisWeek).toBe(60);
    expect(rowOf(r, "hours.self_reported")).toMatchObject({ thisWeek: 8, priorWeek: 4, basis: "self_reported" });
    expect(rowOf(r, "hours.verified")).toMatchObject({ thisWeek: 6, priorWeek: 0, basis: "verified" });
    expect(r.missionsCompleted).toEqual(["Submit 4 qualified applications"]);
    expect(r.cumulative.thisWeek).toMatchObject({ applied: 6, responded: 3, interviewed: 1, offers: 1 });
    expect(r.cumulative.priorWeek).toMatchObject({ applied: 2, responded: 1, interviewed: 0, offers: 0 });
    expect(r.cumulative.thisWeek.responseRate.n).toBe(6);
    expect(r.recommendations.length).toBeGreaterThan(0);
    for (const rec of r.recommendations) expect(rec.citations.length).toBeGreaterThan(0);
  });

  it("stores past weeks once and keeps them frozen until regenerated", async () => {
    const first = await getWeeklyReport(userId, W, { now });
    if (!first.ok) throw new Error("expected a report");
    expect(first.regenerated).toBe(true);
    expect(first.isCurrentWeek).toBe(false);
    await application({ company: "Golf (added later)", applied: at(W, 3) });

    const again = await getWeeklyReport(userId, W, { now });
    if (!again.ok) throw new Error("expected a report");
    expect(again.regenerated).toBe(false);
    expect(again.id).toBe(first.id);
    expect(rowOf(again.report, "applications.applied").thisWeek).toBe(4);

    const regen = await getWeeklyReport(userId, W, { now, regenerate: true });
    if (!regen.ok) throw new Error("expected a report");
    expect(regen.id).toBe(first.id);
    expect(rowOf(regen.report, "applications.applied").thisWeek).toBe(5);
    expect(await prisma.weeklyReport.count({ where: { userId, weekStart: dateFromKey(W) } })).toBe(1);
  });

  it("regenerates the current week on every open", async () => {
    const a = await getWeeklyReport(userId, current, { now });
    if (!a.ok) throw new Error("expected a report");
    expect(a.isCurrentWeek).toBe(true);
    expect(a.report.complete).toBe(false);
    const before = rowOf(a.report, "applications.applied").thisWeek;
    await application({ company: "Hotel (today)", applied: new Date(now.getTime() - 60_000) });
    const b = await getWeeklyReport(userId, current, { now: new Date() });
    if (!b.ok) throw new Error("expected a report");
    expect(b.regenerated).toBe(true);
    expect(rowOf(b.report, "applications.applied").thisWeek).toBe(before + 1);
    expect(await prisma.weeklyReport.count({ where: { userId, weekStart: dateFromKey(current) } })).toBe(1);
  });

  it("rejects future and malformed weeks", async () => {
    expect(await getWeeklyReport(userId, addDaysKey(current, 7), { now })).toEqual({ ok: false, reason: "future_week" });
    expect(await getWeeklyReport(userId, addDaysKey(W, 2), { now })).toEqual({ ok: false, reason: "invalid_week" });
  });

  it("lists weeks from first activity to now with stored status", async () => {
    const weeks = await listReportWeeks(userId, now);
    expect(weeks[0]!.weekStart).toBe(current);
    expect(weeks[0]!.isCurrent).toBe(true);
    const w = weeks.find((x) => x.weekStart === W)!;
    expect(w.stored).toMatchObject({ complete: true, applied: 5 });
    expect(weeks.find((x) => x.weekStart === P)!.stored).toBeNull();
    expect(weeks[weeks.length - 1]!.weekStart).toBe(P);
  });

  it("renders CSV with sanitized cells", async () => {
    const r = await computeWeeklyReport(userId, W, now);
    r.recommendations = [{ id: "x", title: "=HYPERLINK(\"evil\")", body: "Body [funnel.applied]", citations: [], action: { label: "Go", href: "/" } }];
    const csv = weeklyReportCsv(r);
    const parsed = Papa.parse<string[]>(csv.trim());
    expect(parsed.data[0]).toEqual([...REPORT_CSV_COLUMNS]);
    const applied = parsed.data.find((row) => row[1] === "applications.applied")!;
    expect(applied.slice(2, 6)).toEqual(["Applications submitted", "5", "2", "3"]);
    const rec = parsed.data.find((row) => row[1] === "recommendation.1")!;
    expect(rec[2]!.startsWith("'=")).toBe(true);
    expect(rec[8]).not.toContain("[funnel.applied]");
  });
});

describe("GET /api/reports/:weekStart", () => {
  const req = (week: string, format = "csv") => new Request(`http://localhost/api/reports/${week}?format=${format}`);
  const ctx = (weekStart: string) => ({ params: Promise.resolve({ weekStart }) });
  const session = (id: string | null) =>
    vi.mocked(getSessionUser).mockResolvedValue(id ? ({ id, email: "x@careerquest.test", name: "X", role: "USER" } as Awaited<ReturnType<typeof getSessionUser>>) : null);

  it("requires a session", async () => {
    session(null);
    const res = await GET(req(W), ctx(W));
    expect(res.status).toBe(401);
  });

  it("validates the week and format", async () => {
    session(userId);
    expect((await GET(req(addDaysKey(W, 1)), ctx(addDaysKey(W, 1)))).status).toBe(400);
    expect((await GET(req(W, "xml"), ctx(W))).status).toBe(400);
    expect((await GET(req(addDaysKey(current, 7)), ctx(addDaysKey(current, 7)))).status).toBe(404);
  });

  it("downloads the owner's CSV and JSON", async () => {
    session(userId);
    const csv = await GET(req(W, "csv"), ctx(W));
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(csv.headers.get("content-disposition")).toBe(`attachment; filename="careerquest-weekly-report-${W}.csv"`);
    expect(await csv.text()).toContain("Applications submitted");
    const json = await GET(req(W, "json"), ctx(W));
    const data = (await json.json()) as WeeklyReportData;
    expect(data.weekStart).toBe(W);
    expect(data.rows.find((r) => r.key === "applications.applied")!.thisWeek).toBe(5);
    expect(await prisma.auditLog.count({ where: { userId, action: "export.weekly_report" } })).toBe(2);
  });

  it("only ever returns the signed-in user's own report", async () => {
    session(otherId);
    const json = await GET(req(W, "json"), ctx(W));
    expect(json.status).toBe(200);
    const data = (await json.json()) as WeeklyReportData;
    expect(data.rows.find((r) => r.key === "applications.applied")!.thisWeek).toBe(0);
    expect(JSON.stringify(data)).not.toContain("Alpha");
  });
});
