/**
 * Render-level smoke test: every analytics component (and the page, with auth + queries mocked)
 * must render with empty, filtered-empty and populated data without throwing, and must show
 * honest empty states / low-sample warnings. We cannot boot Next here; this is the stand-in.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/analytics/queries", () => ({ getAnalytics: vi.fn(), MAX_ANALYTICS_APPLICATIONS: 5000 }));

import { FilterBar } from "@/components/analytics/filter-bar";
import { AnalyticsStatTiles } from "@/components/analytics/stat-tiles";
import { ActivityCard } from "@/components/analytics/activity-card";
import { FunnelCard } from "@/components/analytics/funnel-card";
import { ConversionTable } from "@/components/analytics/conversion-table";
import { StatusDistribution } from "@/components/analytics/status-distribution";
import { SourcesCard } from "@/components/analytics/sources-card";
import { FollowUpCard } from "@/components/analytics/follow-up-card";
import { foldSlices } from "@/components/charts/donut-breakdown";
import AnalyticsPage from "@/app/(app)/analytics/page";
import { parseAnalyticsFilters, resolveRange } from "@/lib/analytics/filters";
import { averageDaysToResponse, computeFunnel, conversionBy, dailySeries, weeklySeries } from "@/lib/analytics/funnel";
import { getAnalytics, type AnalyticsData } from "@/lib/analytics/queries";
import type { FunnelApplication } from "@/lib/analytics/types";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const d = (iso: string) => new Date(iso);

const apps: FunnelApplication[] = [
  { status: "SUBMITTED", appliedAt: d("2026-10-01T00:00:00Z"), statusHistory: [], events: [{ type: "RECRUITER_RESPONSE", occurredAt: d("2026-10-04T00:00:00Z") }], source: "INDEED", jobCategory: "Electrician", resumeVersionId: "r1" },
  { status: "INTERVIEWING", appliedAt: d("2026-10-02T00:00:00Z"), statusHistory: [{ toStatus: "SCREENING", occurredAt: d("2026-10-05T00:00:00Z") }], events: [], source: "LINKEDIN", jobCategory: "HVAC", resumeVersionId: null },
  { status: "SAVED", appliedAt: null, statusHistory: [], events: [], source: "OTHER", jobCategory: null, resumeVersionId: null },
  { status: "OFFER", appliedAt: d("2026-10-03T00:00:00Z"), statusHistory: [], events: [], source: "REFERRAL", jobCategory: "Electrician", resumeVersionId: "r1" },
];

const emptyFilters = parseAnalyticsFilters({});
const ctx = { todayKey: "2026-10-21", campaignStartKey: "2026-10-01" };

function baseData(filters = emptyFilters): AnalyticsData {
  const funnel = computeFunnel([]);
  return {
    filters,
    range: resolveRange(filters, ctx),
    timezone: "America/Los_Angeles",
    todayKey: ctx.todayKey,
    hasAnyApplications: false,
    capped: false,
    totals: { applications: 0, applied: 0 },
    funnel,
    timing: averageDaysToResponse([]),
    daily: dailySeries({ fromKey: "2026-09-22", toKey: "2026-10-21", appliedKeys: [], activity: [] }),
    dailyWindow: { fromKey: "2026-09-22", toKey: "2026-10-21" },
    weekly: weeklySeries(dailySeries({ fromKey: "2026-09-22", toKey: "2026-10-21", appliedKeys: [], activity: [] })),
    weeklyWindow: { fromKey: "2026-09-21", toKey: "2026-10-21" },
    bySource: [],
    byCategory: [],
    byResume: [],
    resumeNames: {},
    statusDistribution: [],
    sourceDistribution: [],
    followUps: { overdue: 0, dueToday: 0, laterThisWeek: 0, weekEndKey: "2026-10-25" },
    options: { sources: [], categories: [], employers: [] },
  };
}

function populatedData(): AnalyticsData {
  const daily = dailySeries({
    fromKey: "2026-09-22",
    toKey: "2026-10-21",
    appliedKeys: ["2026-10-01", "2026-10-02", "2026-10-03"],
    activity: [{ key: "2026-10-04", applicationsSubmitted: 1, followUps: 2 }],
  });
  return {
    ...baseData(),
    hasAnyApplications: true,
    totals: { applications: 4, applied: 3 },
    funnel: computeFunnel(apps),
    timing: averageDaysToResponse(apps),
    daily,
    weekly: weeklySeries(daily),
    bySource: conversionBy(apps, "source"),
    byCategory: conversionBy(apps, "jobCategory"),
    byResume: conversionBy(apps, "resumeVersionId"),
    resumeNames: { r1: "Trades résumé v2" },
    statusDistribution: [
      { status: "SAVED", count: 1 },
      { status: "SUBMITTED", count: 1 },
      { status: "INTERVIEWING", count: 1 },
      { status: "OFFER", count: 1 },
    ],
    sourceDistribution: [
      { source: "INDEED", count: 1 },
      { source: "LINKEDIN", count: 1 },
      { source: "OTHER", count: 1 },
      { source: "REFERRAL", count: 1 },
    ],
    followUps: { overdue: 1, dueToday: 2, laterThisWeek: 0, weekEndKey: "2026-10-25" },
    options: { sources: ["INDEED", "LINKEDIN", "OTHER", "REFERRAL"], categories: ["Electrician", "HVAC"], employers: ["Acme Electric", "Bolt Power"] },
  };
}

describe("analytics components render", () => {
  it("filter bar is a GET form with labelled controls and preset links", () => {
    const filters = parseAnalyticsFilters({ range: "30d", status: "SUBMITTED,OFFER", source: "INDEED", location: "Irvine" });
    const html = render(createElement(FilterBar, { filters, options: populatedData().options, matched: 4, rangeLabel: "Last 30 days" }));
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/analytics"');
    expect(html).toContain('for="f-range"');
    expect(html).toContain('for="f-employer"');
    expect(html).toContain('href="/analytics?range=7d&amp;status=SUBMITTED%2COFFER&amp;source=INDEED&amp;location=Irvine"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Status (2 selected)");
    expect(html).toMatch(/name="status" checked="" value="OFFER"/);
    expect(html).toMatch(/name="status" value="SAVED"/);
    expect(html).toContain("Apply filters");
    expect(html).toContain("Reset");
    expect(html).toContain("4 applications · Last 30 days");
  });

  it("stat tiles flag low samples and explain empty rates", () => {
    const empty = render(createElement(AnalyticsStatTiles, { funnel: computeFunnel([]), timing: averageDaysToResponse([]) }));
    expect(empty).toContain("No applied applications in this range");
    expect(empty).toContain("No responses with dates yet");
    const pop = render(createElement(AnalyticsStatTiles, { funnel: computeFunnel(apps), timing: averageDaysToResponse(apps) }));
    expect(pop).toContain("Low sample");
    expect(pop).toContain("n = 3");
    expect(pop).toContain("Response rate · Observed");
    expect(pop).toContain("100%");
    expect(pop).toMatch(/Avg days to response/);
    expect(pop).toContain("3.0"); // (3 + 3) / 2 days
  });

  it("activity, funnel, sources, status and follow-up cards handle empty data honestly", () => {
    const data = baseData();
    const activity = render(createElement(ActivityCard, { daily: data.daily, dailyWindow: data.dailyWindow, weekly: data.weekly, weeklyWindow: data.weeklyWindow }));
    expect(activity).toContain("No applications or follow-ups were recorded in this window.");
    expect(activity).toContain("<caption>");
    expect(render(createElement(FunnelCard, { funnel: data.funnel }))).toContain("No applied applications in this slice");
    expect(render(createElement(SourcesCard, { rows: [] }))).toContain("No applications in this slice.");
    expect(render(createElement(StatusDistribution, { rows: [], total: 0 }))).toContain("No applications in this slice.");
    expect(render(createElement(FollowUpCard, { ...data.followUps }))).toContain("No follow-ups are due this week");
    expect(render(createElement(ConversionTable, { title: "Conversion by source", dimensionLabel: "Source", rows: [], labelFor: (k) => k ?? "Unknown", emptyText: "Nothing yet." }))).toContain("Nothing yet.");
  });

  it("activity, funnel, sources, status and follow-up cards render populated data", () => {
    const data = populatedData();
    const activity = render(createElement(ActivityCard, { daily: data.daily, dailyWindow: data.dailyWindow, weekly: data.weekly, weeklyWindow: data.weeklyWindow }));
    expect(activity).toContain("3 applications across 3 active days; best day Oct 1 with 1; 2 follow-ups logged.");
    expect(activity).toContain("Applications");
    expect(activity).toContain("Follow-ups");
    const funnel = render(createElement(FunnelCard, { funnel: data.funnel }));
    expect(funnel).toContain('data-testid="funnel-row-interviewed"');
    expect(funnel).toContain("67%"); // 2 of 3 interviewed
    expect(funnel).toContain("Fewer than 10 applied applications");
    const sources = render(createElement(SourcesCard, { rows: data.sourceDistribution }));
    expect(sources).toContain("LinkedIn");
    expect(sources).toContain("25%");
    const status = render(createElement(StatusDistribution, { rows: data.statusDistribution, total: 4 }));
    expect(status).toContain("Interviewing");
    expect(status).toContain("4 total");
    const fu = render(createElement(FollowUpCard, { ...data.followUps }));
    expect(fu).toContain("3 follow-ups to work through this week.");
    expect(fu).toContain("Open the tracker");
    const table = render(createElement(ConversionTable, { title: "Conversion by résumé version", dimensionLabel: "Résumé version", rows: data.byResume, labelFor: (k) => (k ? data.resumeNames[k] ?? "Deleted" : "No résumé version"), emptyText: "" }));
    expect(table).toContain("Trades résumé v2");
    expect(table).toContain("No résumé version");
    expect(table).toContain("low n");
  });

  it("donut folds beyond six categories into Other without cycling hues", () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ key: `s${i}`, label: `Source ${i}`, value: 8 - i }));
    const slices = foldSlices(data, 36);
    expect(slices).toHaveLength(6);
    expect(slices[5]).toMatchObject({ key: "__other", label: "Other (3)", value: 3 + 2 + 1 });
    expect(new Set(slices.map((s) => s.fill)).size).toBe(6);
    expect(foldSlices(data.slice(0, 6), 33)).toHaveLength(6);
  });
});

describe("analytics page renders", () => {
  const mocked = vi.mocked(getAnalytics);

  it("shows the no-data empty state for a new account", async () => {
    mocked.mockResolvedValueOnce(baseData());
    const html = render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No applications yet");
    expect(html).toContain("Log your first application");
    expect(html).not.toContain("Export CSV");
  });

  it("shows the filtered-empty state with a reset link", async () => {
    const filters = parseAnalyticsFilters({ status: "HIRED" });
    mocked.mockResolvedValueOnce({ ...baseData(filters), hasAnyApplications: true });
    const html = render(await AnalyticsPage({ searchParams: Promise.resolve({ status: "HIRED" }) }));
    expect(html).toContain("No applications match these filters");
    expect(html).toContain("Clear filters");
    expect(html).toContain('href="/api/export/applications?status=HIRED"');
  });

  it("renders the full dashboard with populated data", async () => {
    mocked.mockResolvedValueOnce(populatedData());
    const html = render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Observed from your tracker");
    expect(html).toContain('data-testid="export-csv"');
    expect(html).toContain('href="/api/export/applications"');
    expect(html).toContain('data-testid="tile-response-rate"');
    expect(html).toContain('data-testid="funnel-card"');
    expect(html).toContain('data-testid="conversion-source"');
    expect(html).toContain('data-testid="conversion-category"');
    expect(html).toContain('data-testid="conversion-resume"');
    expect(html).toContain('data-testid="followup-workload"');
    expect(html).toContain("Definitions:");
    expect(html).not.toContain("Large result set");
  });

  it("warns when the result set was capped", async () => {
    mocked.mockResolvedValueOnce({ ...populatedData(), capped: true });
    const html = render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Large result set");
    expect(html).toContain("5,000");
  });
});
