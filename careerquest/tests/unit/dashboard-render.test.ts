/**
 * Render-level smoke test: every dashboard component must render with both empty and populated
 * data without throwing (we cannot boot Next here, so this is the closest stand-in).
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { StatTiles } from "@/components/dashboard/stat-tiles";
import { NextActionCard } from "@/components/dashboard/next-action-card";
import { CampaignTimelineCard } from "@/components/dashboard/campaign-timeline";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { FunnelStrip } from "@/components/dashboard/funnel-strip";
import { FollowUpsCard } from "@/components/dashboard/follow-ups-card";
import { InterviewsCard } from "@/components/dashboard/interviews-card";
import { XpStreakCard } from "@/components/dashboard/xp-streak-card";
import { MissionsCard } from "@/components/dashboard/missions-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { MilestoneLadder } from "@/components/dashboard/milestone-ladder";
import { SuggestionsCard } from "@/components/dashboard/suggestions-card";
import { GoalsCalculator } from "@/components/dashboard/goals-calculator";
import { campaignTimeline } from "@/lib/dashboard/campaign";
import { recommendNextAction } from "@/lib/dashboard/next-action";
import { buildDailySeries } from "@/lib/dashboard/time";
import type { DashboardData } from "@/lib/dashboard/types";
import { computePace, recommendAdjustments } from "@/lib/goals/calculator";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const now = new Date("2026-10-12T18:00:00.000Z");
const campaign = campaignTimeline({ startDate: d("2026-10-01"), today: d("2026-10-12"), lengthDays: 90 });

const empty: DashboardData = {
  userName: "Ada Lovelace",
  timezone: "America/Los_Angeles",
  todayKey: "2026-10-12",
  profile: { timezone: "America/Los_Angeles", dailyApplicationTarget: 5, workdaysPerWeek: 5, weeklyApplicationTarget: 25, campaignLengthDays: 90, onboardingComplete: false, immediateSalaryTarget: 80000, longTermSalaryTarget: 150000 },
  campaign,
  today: { submitted: 0, target: 5 },
  week: { submitted: 0, target: 25, activeDays: 0, weekStartKey: "2026-10-12" },
  series: buildDailySeries({}, "2026-10-12", 14),
  funnel: { submitted: 0, responses: 0, screenings: 0, interviews: 0, offers: 0, hires: 0 },
  rates: { interview: null, response: null, n: 0 },
  totals: { applications: 0, submitted: 0 },
  followUps: { overdue: [], dueToday: [], capped: false },
  interviews: [],
  xp: { totalXp: 0, level: 1, current: 0, next: 150, progress: 0 },
  streak: { current: 0, longest: 0, lastActiveKey: null },
  recent: [],
  missions: [],
  nextAction: recommendNextAction({ overdueFollowUps: 0, firstOverdueApplicationId: null, todaySubmitted: 0, dailyTarget: 5, totalApplications: 0, totalSubmitted: 0, nextInterview: null, onboardingComplete: false, now }),
};

const populated: DashboardData = {
  ...empty,
  today: { submitted: 3, target: 5 },
  week: { submitted: 12, target: 25, activeDays: 3, weekStartKey: "2026-10-12" },
  series: buildDailySeries({ "2026-10-10": 4, "2026-10-12": 3 }, "2026-10-12", 14),
  funnel: { submitted: 40, responses: 8, screenings: 5, interviews: 3, offers: 1, hires: 0 },
  rates: { interview: 3 / 40, response: 8 / 40, n: 40 },
  totals: { applications: 45, submitted: 40 },
  followUps: {
    overdue: [{ id: "a1", companyName: "Acme", positionTitle: "Apprentice", status: "SUBMITTED", followUpAt: d("2026-10-10"), dueKey: "2026-10-10", overdue: true }],
    dueToday: [{ id: "a2", companyName: "Bolt", positionTitle: "Helper", status: "CONFIRMED", followUpAt: d("2026-10-12"), dueKey: "2026-10-12", overdue: false }],
    capped: false,
  },
  interviews: [{ id: "i1", applicationId: "a3", companyName: "Volt", positionTitle: "Journeyman", type: "PHONE_SCREEN", scheduledAt: new Date("2026-10-13T17:00:00Z"), location: "Zoom" }],
  xp: { totalXp: 1075, level: 4, current: 669, next: 1000, progress: 0.5 },
  streak: { current: 4, longest: 9, lastActiveKey: "2026-10-12" },
  recent: [{ id: "e1", type: "APPLIED", label: "Applied", occurredAt: now, source: "EMAIL", verified: true, applicationId: "a1", companyName: "Acme", positionTitle: "Apprentice" }],
  missions: [{ id: "m1", title: "Submit 5 applications", description: "Hit today's target", type: "DAILY", target: 5, progress: 3, xpReward: 20 }],
  nextAction: recommendNextAction({ overdueFollowUps: 1, firstOverdueApplicationId: "a1", todaySubmitted: 3, dailyTarget: 5, totalApplications: 45, totalSubmitted: 40, nextInterview: null, onboardingComplete: true, now }),
};

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("dashboard components render", () => {
  it("with empty data (honest empty states)", () => {
    expect(render(createElement(StatTiles, { data: empty }))).toContain("No submitted applications yet");
    expect(render(createElement(NextActionCard, { action: empty.nextAction }))).toContain("Log your first application");
    expect(render(createElement(CampaignTimelineCard, { campaign }))).toContain("Day 12 of 90");
    expect(render(createElement(ActivityChart, { series: empty.series, dailyTarget: 5 }))).toContain("No applications were submitted in the last 14 days");
    expect(render(createElement(FunnelStrip, { funnel: empty.funnel }))).toContain("No submitted applications yet");
    expect(render(createElement(FollowUpsCard, { overdue: [], dueToday: [], capped: false }))).toContain("No follow-ups are due today");
    expect(render(createElement(InterviewsCard, { interviews: [], timezone: "America/Los_Angeles" }))).toContain("No interviews scheduled");
    expect(render(createElement(XpStreakCard, { xp: empty.xp, streak: empty.streak }))).toContain("No active streak");
    expect(render(createElement(MissionsCard, { missions: [] }))).toContain("Daily missions arrive in a later phase");
    expect(render(createElement(RecentActivity, { events: [] }))).toContain("No activity recorded yet");
    expect(render(createElement(WelcomeCard, { name: "Ada Lovelace", onboardingComplete: false }))).toContain("Welcome to CareerQuest, Ada");
  });

  it("with populated data", () => {
    const tiles = render(createElement(StatTiles, { data: populated }));
    expect(tiles).toContain("n = 40 submitted");
    expect(tiles).toContain("8%"); // interview rate 3/40 → 8%
    expect(render(createElement(NextActionCard, { action: populated.nextAction }))).toContain("/applications/a1");
    const chart = render(createElement(ActivityChart, { series: populated.series, dailyTarget: 5 }));
    expect(chart).toContain("7 applications in the last 14 days across 2 active days; best day Oct 10 with 4.");
    const funnel = render(createElement(FunnelStrip, { funnel: populated.funnel }));
    expect(funnel).toContain("20% of submitted");
    const fu = render(createElement(FollowUpsCard, { overdue: populated.followUps.overdue, dueToday: populated.followUps.dueToday, capped: false }));
    expect(fu).toContain("1 overdue · 1 today");
    expect(fu).toContain("/applications/a2");
    const iv = render(createElement(InterviewsCard, { interviews: populated.interviews, timezone: "America/Los_Angeles" }));
    expect(iv).toContain("Tue, Oct 13, 10:00 AM");
    expect(render(createElement(XpStreakCard, { xp: populated.xp, streak: populated.streak }))).toContain("4-day streak");
    expect(render(createElement(MissionsCard, { missions: populated.missions }))).toContain("+20 XP");
    const recent = render(createElement(RecentActivity, { events: populated.recent }));
    expect(recent).toContain("Applied");
    expect(recent).toContain("verified");
  });
});

describe("goals components render", () => {
  const pace = computePace({ dailyTarget: 5, workdaysPerWeek: 5, campaignLengthDays: 90, campaignStartDate: d("2026-10-01"), today: d("2026-10-12"), completedApplications: 40, historicalResponseRate: 0.2, activityByDate: { "2026-10-12": 3 } });

  it("milestone ladder highlights achieved and next", () => {
    const html = render(createElement(MilestoneLadder, { projections: pace.projectedMilestoneDates, completed: 40, nextMilestone: pace.nextMilestone }));
    expect(html).toContain("10 to the next rung");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("not a guarantee");
  });

  it("suggestions card shows thresholds when empty and alerts when present", () => {
    expect(render(createElement(SuggestionsCard, { suggestions: [], dataRequirements: "Pace suggestions need 14 campaign days (currently 12)." }))).toContain("currently 12");
    const s = recommendAdjustments({ dailyTarget: 5, workdaysPerWeek: 5, campaignDay: 20, completedApplications: 40, responses: 1, observedDailyPace: 2, requiredDailyPace: 5, consistency: 0.3 });
    const html = render(createElement(SuggestionsCard, { suggestions: s, dataRequirements: "" }));
    expect(html).toContain("Based on your observed response rate");
    expect(html).toContain("lowering your daily target");
  });

  it("calculator renders labelled inputs and live outputs from the defaults", () => {
    const html = render(
      createElement(GoalsCalculator, {
        defaults: { dailyTarget: 5, workdaysPerWeek: 5, campaignLengthDays: 90, completed: 40, responseRatePct: 20 },
        todayKey: "2026-10-12",
        campaignStartKey: "2026-10-01",
      }),
    );
    expect(html).toContain("Daily target");
    expect(html).toContain("Save as my targets");
    expect(html).toContain('name="weeklyApplicationTarget" value="25"');
    expect(html).toMatch(/Campaign goal[\s\S]*321/);
    expect(html).toContain("Expected responses (estimate)");
  });
});
