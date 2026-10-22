import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/coach", redirect: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/coach/metrics", () => ({ getCoachSnapshot: vi.fn() }));
vi.mock("@/lib/coach/service", () => ({ MAX_MESSAGE_LENGTH: 4000, listCoachMessages: vi.fn(async () => []), listApplicationChoices: vi.fn(async () => []) }));
vi.mock("@/lib/coach/anthropic", () => ({ llmConfigured: vi.fn(() => false) }));
vi.mock("@/lib/coach/resumes", () => ({ RESUME_NAME_MAX: 120, RESUME_CONTENT_MIN: 20, RESUME_CONTENT_MAX: 50000, listResumes: vi.fn(async () => []) }));
vi.mock("@/lib/analytics/queries", () => ({ getUserTimezone: vi.fn(async () => "America/Los_Angeles") }));
vi.mock("@/lib/reports/weekly", () => ({ listReportWeeks: vi.fn(), reportTimezone: vi.fn(async () => "America/Los_Angeles"), getWeeklyReport: vi.fn() }));

import CoachPage from "@/app/(app)/coach/page";
import ResumesPage from "@/app/(app)/coach/resumes/page";
import WeeklyReportsPage from "@/app/(app)/analytics/reports/page";
import WeeklyReportPage from "@/app/(app)/analytics/reports/[weekStart]/page";
import { getCoachSnapshot } from "@/lib/coach/metrics";
import { getWeeklyReport, listReportWeeks } from "@/lib/reports/weekly";
import { buildSnapshot } from "@/lib/coach/snapshot";
import type { CoachFacts } from "@/lib/coach/types";
import type { WeeklyReportData } from "@/lib/reports/types";

const facts: CoachFacts = {
  generatedAt: "2026-10-22T19:00:00.000Z",
  timezone: "America/Los_Angeles",
  todayKey: "2026-10-22",
  weekStartKey: "2026-10-19",
  profile: { name: "Ada", onboardingComplete: true, dailyTarget: 5, weeklyTarget: 25, workdaysPerWeek: 5, immediateSalaryTarget: 80000, longTermSalaryTarget: 150000, openToApprenticeships: true, primaryTrade: "ELECTRICIAN" },
  campaign: { started: true, beyond: false, day: 3, lengthDays: 90, phase: 1, phaseName: "Launch", daysRemaining: 88 },
  funnel: { total: 0, applied: 0, responded: 0, screened: 0, interviewed: 0, offers: 0, hired: 0 },
  conversions: { category: [], source: [], resume: [] },
  week: { applied: 0, target: 25, dailyTarget: 5, expectedByYesterday: 10, activeDays: 0, todayApplied: 0, todayIsWorkday: true },
  followUps: { overdue: 0, dueToday: 0, firstOverdueId: null },
  stale: { count: 0, items: [] },
  streak: { current: 0, longest: 0, consecutiveActiveDays: 0 },
  academy: { tracks: [], lessonsCompleted: 0, lessonsTotal: 0, inProgress: 0, next: null, daysSinceActivity: null, recentQuizzes: [] },
  hours: { selfReported: 0, verified: 0, entries: 0, daysSinceLast: null },
  interviews: { upcoming7d: 0, attended: 0, next: null },
  offers: { open: [] },
  resumes: { count: 0, latestName: null, latestId: null, defaultId: null },
  programs: [],
  xp: { total: 0 },
};

describe("coach and report pages render", () => {
  it("a brand-new user sees honest priorities, no demo data, and a prefilled chat from ?ask=", async () => {
    vi.mocked(getCoachSnapshot).mockResolvedValueOnce(buildSnapshot(facts));
    const el = await CoachPage({ searchParams: Promise.resolve({ ask: "Tailor my résumé" }) });
    const html = renderToStaticMarkup(el);
    expect(html).toContain("Career Advisor");
    expect(html).toContain("Log your first application");
    expect(html).toContain("Add your résumé");
    expect(html).toContain("Tailor my résumé</textarea>");
    expect(html).toContain('href="/analytics/reports"');
    expect(html).not.toMatch(/Module under construction/);
  });

  it("résumés page renders the empty state", async () => {
    const html = renderToStaticMarkup(await ResumesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No résumé saved yet");
    expect(html).toContain('href="/coach/resumes"');
  });

  it("weekly reports list renders weeks and the generate button", async () => {
    vi.mocked(listReportWeeks).mockResolvedValueOnce([{ weekStart: "2026-10-19", weekEnd: "2026-10-25", label: "Oct 19 – Oct 25, 2026", isCurrent: true, stored: null }]);
    const html = renderToStaticMarkup(await WeeklyReportsPage());
    expect(html).toContain("Weekly reports");
    expect(html).toContain("Generate this week&#x27;s report");
    expect(html).toContain('href="/analytics/reports/2026-10-19"');
  });

  it("a report page shows downloads, freshness and the print stylesheet", async () => {
    const report: WeeklyReportData = {
      version: 1,
      weekStart: "2026-10-12",
      weekEnd: "2026-10-18",
      priorWeekStart: "2026-10-05",
      timezone: "America/Los_Angeles",
      generatedAt: "2026-10-20T17:00:00.000Z",
      complete: true,
      target: { weekly: 25, daily: 5 },
      rows: [],
      cumulative: {
        thisWeek: { asOf: "2026-10-18", applied: 0, responded: 0, interviewed: 0, offers: 0, responseRate: { value: null, successes: 0, n: 0, interval: null }, interviewRate: { value: null, successes: 0, n: 0, interval: null } },
        priorWeek: { asOf: "2026-10-11", applied: 0, responded: 0, interviewed: 0, offers: 0, responseRate: { value: null, successes: 0, n: 0, interval: null }, interviewRate: { value: null, successes: 0, n: 0, interval: null } },
      },
      quizAverage: { thisWeek: null, priorWeek: null },
      missionsCompleted: [],
      recommendations: [],
    };
    vi.mocked(getWeeklyReport).mockResolvedValueOnce({ ok: true, report, id: "r", regenerated: false, isCurrentWeek: false });
    const html = renderToStaticMarkup(await WeeklyReportPage({ params: Promise.resolve({ weekStart: "2026-10-12" }) }));
    expect(html).toContain('href="/api/reports/2026-10-12?format=csv"');
    expect(html).toContain('href="/api/reports/2026-10-12?format=json"');
    expect(html).toContain("Complete: frozen snapshot");
    expect(html).toContain("Regenerate from today&#x27;s data");
    expect(html).toContain("@media print");
    expect(html).toContain("No applications yet");
    await expect(WeeklyReportPage({ params: Promise.resolve({ weekStart: "2026-10-13" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
