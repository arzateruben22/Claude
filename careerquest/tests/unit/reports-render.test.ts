import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/analytics/reports", redirect: vi.fn(), notFound: vi.fn() }));

import { ReportView, reportStatus } from "@/components/reports/report-view";
import { WeekList } from "@/components/reports/week-list";
import { GenerateReportForm } from "@/components/reports/generate-form";
import { ReportsTabs } from "@/components/reports/reports-tabs";
import { row } from "@/lib/reports/week";
import type { WeeklyReportData } from "@/lib/reports/types";

const data: WeeklyReportData = {
  version: 1,
  weekStart: "2026-10-05",
  weekEnd: "2026-10-11",
  priorWeekStart: "2026-09-28",
  timezone: "America/Los_Angeles",
  generatedAt: "2026-10-13T17:00:00.000Z",
  complete: true,
  target: { weekly: 20, daily: 4 },
  rows: [
    row({ key: "applications.applied", section: "applications", label: "Applications submitted", thisWeek: 12, priorWeek: 9, basis: "observed", unit: "count", note: "Weekly target: 20" }),
    row({ key: "funnel.responses", section: "funnel", label: "Employer responses received", thisWeek: 2, priorWeek: 1, basis: "observed", unit: "count" }),
    row({ key: "funnel.interviews", section: "funnel", label: "Applications that reached the interview stage", thisWeek: 1, priorWeek: 0, basis: "observed", unit: "count" }),
    row({ key: "funnel.offers", section: "funnel", label: "Offers received", thisWeek: 0, priorWeek: 0, basis: "observed", unit: "count" }),
    row({ key: "hours.self_reported", section: "hours", label: "Work hours, self-reported", thisWeek: 7.5, priorWeek: 10, basis: "self_reported", unit: "hours" }),
    row({ key: "hours.verified", section: "hours", label: "Work hours, verified", thisWeek: 8, priorWeek: 0, basis: "verified", unit: "hours" }),
  ],
  cumulative: {
    thisWeek: { asOf: "2026-10-11", applied: 40, responded: 4, interviewed: 1, offers: 0, responseRate: { value: 0.1, successes: 4, n: 40, interval: { low: 0.04, high: 0.23 } }, interviewRate: { value: 0.025, successes: 1, n: 40, interval: { low: 0.004, high: 0.13 } } },
    priorWeek: { asOf: "2026-10-04", applied: 28, responded: 2, interviewed: 0, offers: 0, responseRate: { value: 2 / 28, successes: 2, n: 28, interval: { low: 0.02, high: 0.23 } }, interviewRate: { value: 0, successes: 0, n: 28, interval: { low: 0, high: 0.12 } } },
  },
  quizAverage: { thisWeek: 75, priorWeek: null },
  missionsCompleted: ["Submit 4 qualified applications"],
  recommendations: [
    {
      id: "followups-overdue",
      title: "Send 2 overdue follow-ups",
      body: "2 applications passed their follow-up date [followups.overdue].",
      citations: [{ id: "followups.overdue", label: "Overdue follow-ups", display: "2", basis: "observed" }],
      action: { label: "Open follow-ups", href: "/applications?sort=followUp" },
    },
  ],
};

describe("weekly report components render", () => {
  it("renders tiles, the comparison table, cumulative rates and cited recommendations", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { data, isCurrentWeek: false }));
    expect(html).toContain("Applications vs target");
    expect(html).toContain("+3 vs prior week (9)");
    expect(html).toContain('data-row="hours.verified"');
    expect(html).toContain("7.5 h");
    expect(html).toContain("−2.5");
    expect(html).toContain("Self-reported");
    expect(html).toContain("Verified");
    expect(html).toContain("10.0% (4 of 40), 95% interval 4%–23%");
    expect(html).toContain("+2.9 percentage points vs prior week");
    expect(html).toContain("Submit 4 qualified applications");
    expect(html).toContain("Based on Overdue follow-ups:");
    expect(html).not.toContain("[followups.overdue]");
    expect(html).toContain("overflow-x-auto");
  });

  it("states freshness honestly", () => {
    expect(reportStatus(data, false).text).toMatch(/^Complete: frozen snapshot generated Oct 13, 2026, 10:00 AM/);
    expect(reportStatus({ ...data, complete: false }, false).text).toMatch(/Generated mid-week/);
    expect(reportStatus(data, true).text).toMatch(/^Current week: recomputed each time you open it/);
  });

  it("lists weeks with their stored state", () => {
    const html = renderToStaticMarkup(
      createElement(WeekList, {
        timeZone: "America/Los_Angeles",
        weeks: [
          { weekStart: "2026-10-19", weekEnd: "2026-10-25", label: "Oct 19 – Oct 25, 2026", isCurrent: true, stored: null },
          { weekStart: "2026-10-12", weekEnd: "2026-10-18", label: "Oct 12 – Oct 18, 2026", isCurrent: false, stored: { generatedAt: "2026-10-20T17:00:00.000Z", complete: true, applied: 7 } },
        ],
      }),
    );
    expect(html).toContain('href="/analytics/reports/2026-10-19"');
    expect(html).toContain("This week");
    expect(html).toContain("7 applications · Saved (frozen)");
  });

  it("renders the generate button and analytics tabs", () => {
    expect(renderToStaticMarkup(createElement(GenerateReportForm, { label: "Generate this week's report" }))).toContain("Generate this week&#x27;s report");
    const tabs = renderToStaticMarkup(createElement(ReportsTabs));
    expect(tabs).toContain('href="/analytics"');
    expect(tabs).toContain('href="/analytics/reports"');
  });
});
