/**
 * Regression tests for the Analytics review findings:
 * - F7: a custom range selects applications by the same calendar day the daily chart uses, so the
 *   filter summary, funnel, chart and CSV export agree.
 * - One "applied" definition (application date or APPLIED event), so closing a never-applied lead
 *   is not counted as applied.
 * - Merged records are excluded from analytics and the export even with archived included.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import { changeStatus, createApplication } from "@/lib/applications/service";
import { getAnalytics, iterateExportRows } from "@/lib/analytics/queries";
import { parseAnalyticsFilters } from "@/lib/analytics/filters";

const TZ = "America/Los_Angeles";
const now = new Date("2025-10-25T19:00:00Z");
let userId = "";
const ids: Record<string, string> = {};

const input = (over: Record<string, unknown>) =>
  applicationInputSchema.parse({ companyName: "Range Co", positionTitle: `Role ${Math.random().toString(36).slice(2, 8)}`, ...over });

async function exported(sp: Record<string, string>) {
  const rows = [];
  for await (const batch of iterateExportRows(userId, parseAnalyticsFilters(sp), now)) rows.push(...batch);
  return rows;
}

beforeAll(async () => {
  const u = await prisma.user.create({
    data: {
      email: `analytics-fixes+${Date.now()}${Math.floor(Math.random() * 1e6)}@careerquest.test`,
      name: "Analytics Fixes",
      passwordHash: "x",
      profile: { create: { timezone: TZ } },
      stats: { create: {} },
    },
    select: { id: true },
  });
  userId = u.id;
  // 8 PM Pacific on Oct 20 = Oct 21 03:00 UTC.
  ids.evening = (await createApplication(userId, { ...input({ status: "SUBMITTED", companyName: "Evening Co" }), appliedAt: new Date("2025-10-21T03:00:00Z") })).application.id;
  ids.morning = (await createApplication(userId, { ...input({ status: "SUBMITTED", companyName: "Morning Co" }), appliedAt: new Date("2025-10-21T16:00:00Z") })).application.id;
  const closed = await createApplication(userId, input({ status: "SAVED", companyName: "Closed Lead Co" }));
  await changeStatus(userId, closed.application.id, { status: "CLOSED" });
  ids.closed = closed.application.id;
  const dup = await createApplication(userId, { ...input({ status: "SUBMITTED", companyName: "Merged Dup Co" }), appliedAt: new Date("2025-10-21T16:30:00Z") });
  ids.dup = dup.application.id;
  await prisma.application.update({ where: { id: ids.dup }, data: { mergedIntoId: ids.morning, archivedAt: new Date() } });
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("F7: custom ranges use the user's calendar day everywhere", () => {
  it("an 8 PM Pacific application belongs to Oct 20, not Oct 21", async () => {
    const oct21 = await getAnalytics(userId, parseAnalyticsFilters({ from: "2025-10-21", to: "2025-10-21" }), now);
    expect(oct21.funnel.counts.applied).toBe(1); // morning only
    expect(oct21.daily.find((p) => p.key === "2025-10-21")?.applied).toBe(1);
    expect(oct21.daily.reduce((a, p) => a + p.applied, 0)).toBe(oct21.funnel.counts.applied);

    const oct20 = await getAnalytics(userId, parseAnalyticsFilters({ from: "2025-10-20", to: "2025-10-20" }), now);
    expect(oct20.totals).toEqual({ applications: 1, applied: 1 });
    expect(oct20.daily).toEqual([expect.objectContaining({ key: "2025-10-20", applied: 1 })]);

    expect((await exported({ from: "2025-10-21", to: "2025-10-21" })).map((r) => r.company)).toEqual(["Morning Co"]);
    expect((await exported({ from: "2025-10-20", to: "2025-10-20" })).map((r) => r.company)).toEqual(["Evening Co"]);
  });
});

describe("one applied definition and merged exclusion", () => {
  it("a closed never-applied lead is in the slice but not applied", async () => {
    const all = await getAnalytics(userId, parseAnalyticsFilters({ range: "all" }), now);
    expect(all.totals.applied).toBe(2);
    expect(all.statusDistribution.find((s) => s.status === "CLOSED")?.count).toBe(1);
    expect(all.funnel.counts.total).toBe(3);
  });

  it("merged records never appear, even with archived included", async () => {
    const withArchived = await getAnalytics(userId, parseAnalyticsFilters({ archived: "1" }), now);
    expect(withArchived.totals.applications).toBe(3);
    expect(withArchived.options.employers).not.toContain("Merged Dup Co");
    const rows = await exported({ archived: "1" });
    expect(rows.map((r) => r.id)).not.toContain(ids.dup);
    expect(rows).toHaveLength(3);
  });

  it("hasAnyApplications ignores merged records", async () => {
    const lonely = await prisma.user.create({
      data: { email: `analytics-merged-only+${Date.now()}@careerquest.test`, name: "Merged only", passwordHash: "x", profile: { create: { timezone: TZ } } },
      select: { id: true },
    });
    try {
      const a = await createApplication(lonely.id, input({ status: "SUBMITTED" }));
      const b = await createApplication(lonely.id, input({ status: "SUBMITTED" }));
      await prisma.application.updateMany({ where: { id: { in: [a.application.id, b.application.id] } }, data: { mergedIntoId: a.application.id } });
      await prisma.application.update({ where: { id: a.application.id }, data: { mergedIntoId: b.application.id } });
      expect((await getAnalytics(lonely.id, parseAnalyticsFilters({}), now)).hasAnyApplications).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: lonely.id } });
    }
  });
});
