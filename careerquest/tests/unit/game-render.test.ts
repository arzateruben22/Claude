import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { MissionCard, MissionList } from "@/components/game/mission-card";
import { TodayMissionsCardView } from "@/components/game/today-missions-card";
import { TodayStatusCard } from "@/components/game/today-status-card";
import { WeekStrip } from "@/components/game/week-strip";
import { CampaignTimelineView } from "@/components/game/campaign-timeline";
import { LevelCards } from "@/components/game/level-cards";
import { StatsPanel } from "@/components/game/stats-panel";
import { ElectricianPathCard } from "@/components/game/electrician-path-card";
import { AchievementGrid } from "@/components/game/achievement-grid";
import { CelebrationOverlay } from "@/components/game/celebration-overlay";
import { EmploymentCard } from "@/components/game/employment-card";
import { PaycheckCard } from "@/components/game/paycheck-card";
import { NextPhasePlanForm } from "@/components/game/next-phase-plan";
import { campaignTimeline } from "@/lib/dashboard/campaign";
import { computeDerivedStats, playerLevels, type StatInputs } from "@/lib/game/levels";
import { PHASE_FOCUS } from "@/lib/game/mission-catalog";
import { dateFromKey } from "@/lib/dates";
import type { AchievementCardView, MissionView, PhaseView, TodayMissionsSummary, WeekDayView } from "@/lib/game/views";

const TZ = "America/Los_Angeles";

function mission(over: Partial<MissionView> = {}): MissionView {
  return {
    id: "5b0c6c1e-1111-4222-8333-444455556666",
    key: "daily.apply",
    title: "Submit 5 qualified applications",
    description: "Your daily target is 5 (Settings → Campaign).",
    type: "DAILY",
    campaign: "GET_HIRED",
    status: "ACTIVE",
    progress: 2,
    target: 5,
    xpReward: 20,
    periodStartKey: "2026-10-21",
    periodEndKey: "2026-10-21",
    completedAt: null,
    href: "/applications/new",
    cta: "Log an application",
    metric: "APPLICATIONS_DAY",
    phase: null,
    selfCheck: false,
    checkedAt: null,
    skipReason: null,
    selfReported: false,
    ...over,
  };
}

const summary = (over: Partial<TodayMissionsSummary> = {}): TodayMissionsSummary => ({
  todayKey: "2026-10-21",
  timezone: TZ,
  isWorkday: true,
  restDay: false,
  hired: false,
  daily: [mission(), mission({ id: "a2", key: "daily.lesson", title: "Complete an Academy lesson", status: "COMPLETED", progress: 1, target: 1, completedAt: "2026-10-21T17:00:00.000Z" })],
  weekly: [mission({ id: "w1", key: "weekly.apply", type: "WEEKLY", title: "Submit 25 applications this week", target: 25, xpReward: 75 })],
  streak: { current: 4, longest: 9, lastActiveKey: "2026-10-21" },
  todayXp: 95,
  dailyDone: 1,
  dailyTotal: 2,
  ...over,
});

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("mission components", () => {
  it("an active mission shows its reason, progress, XP, state and where to do it", () => {
    const out = html(createElement(MissionCard, { mission: mission(), timezone: TZ }));
    expect(out).toContain("Submit 5 qualified applications");
    expect(out).toContain("Your daily target is 5");
    expect(out).toContain("+20 XP");
    expect(out).toContain("2 / 5");
    expect(out).toContain("In progress");
    expect(out).toContain('href="/applications/new"');
    expect(out).toContain('role="progressbar"');
  });

  it("completed, rest-day and expired states are spelled out in text", () => {
    expect(html(createElement(MissionCard, { mission: mission({ status: "COMPLETED", progress: 5, completedAt: "2026-10-21T17:00:00.000Z" }), timezone: TZ }))).toMatch(
      /Completed Oct 21, 10:00\sAM/,
    );
    expect(html(createElement(MissionCard, { mission: mission({ status: "SKIPPED", skipReason: "REST_DAY" }), timezone: TZ }))).toContain("Rest day");
    expect(html(createElement(MissionCard, { mission: mission({ status: "EXPIRED" }), timezone: TZ }))).toContain("Expired — no penalty");
  });

  it("self-check missions offer an 'I did this' control and are labelled self-reported", () => {
    const out = html(
      createElement(MissionCard, {
        mission: mission({ key: "gh.p2.analytics", type: "CAMPAIGN", metric: "SELF_CHECK", selfCheck: true, selfReported: true, href: "/analytics", cta: "Open Analytics" }),
        timezone: TZ,
      }),
    );
    expect(out).toContain("I did this");
    expect(out).toContain("Self-reported");
    expect(out).toContain('name="missionId"');
  });

  it("an empty list shows the explanation instead", () => {
    expect(html(createElement(MissionList, { missions: [], timezone: TZ, empty: "No daily missions on your days off." }))).toContain("No daily missions on your days off.");
  });

  it("dashboard card: counts, streak, today's XP and mission rows", () => {
    const out = html(createElement(TodayMissionsCardView, { summary: summary() }));
    expect(out).toContain("Today&#x27;s missions");
    expect(out).toContain("1 of 2 daily done");
    expect(out).toContain("4-day streak");
    expect(out).toContain("+95 XP today");
    expect(out).toContain("Submit 25 applications this week");
    expect(out).toContain('href="/missions"');
  });

  it("dashboard card: rest day and day-off empty states", () => {
    expect(html(createElement(TodayMissionsCardView, { summary: summary({ restDay: true, daily: [], weekly: [], dailyTotal: 0, dailyDone: 0 }) }))).toContain("Rest day");
    expect(html(createElement(TodayMissionsCardView, { summary: summary({ isWorkday: false, daily: [], weekly: [], dailyTotal: 0, dailyDone: 0 }) }))).toContain("days off");
  });

  it("today status card: XP, streak and the rest-day toggle", () => {
    const out = html(createElement(TodayStatusCard, { summary: summary() }));
    expect(out).toContain("+95");
    expect(out).toContain("4 days");
    expect(out).toContain("Mark today as a rest day");
    expect(html(createElement(TodayStatusCard, { summary: summary({ restDay: true }) }))).toContain("Undo rest day");
  });
});

describe("week, campaign and stats components", () => {
  const days: WeekDayView[] = ["19", "20", "21", "22", "23", "24", "25"].map((d, i) => ({
    key: `2026-10-${d}`,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]!,
    dateLabel: `Oct ${d}`,
    isToday: i === 2,
    isFuture: i > 2,
    workday: i < 5,
    restDay: i === 1,
    applications: i === 0 ? 3 : 0,
    followUps: 0,
    lessons: 0,
    xp: i === 0 ? 95 : 0,
    missions: 0,
    active: i === 0,
  }));

  it("week strip renders 7 days with readable states", () => {
    const out = html(createElement(WeekStrip, { days }));
    expect(out.match(/data-testid="week-day"/g)).toHaveLength(7);
    expect(out).toContain("Rest day");
    expect(out).toContain("Active");
    expect(out).toContain('aria-current="date"');
  });

  it("campaign timeline: three phases, a today marker, focus lists and missions", () => {
    const start = dateFromKey("2026-10-12");
    const timeline = campaignTimeline({ startDate: start, today: dateFromKey("2026-10-21"), lengthDays: 90 });
    const phases: PhaseView[] = timeline.phases.map((p) => ({
      index: p.index,
      name: p.name,
      title: PHASE_FOCUS[p.index].title,
      startDay: p.startDay,
      endDay: p.endDay,
      startKey: "2026-10-12",
      endKey: "2026-11-10",
      state: p.index === 1 ? "current" : "upcoming",
      focus: PHASE_FOCUS[p.index].focus,
      missions: p.index === 1 ? [mission({ key: "gh.p1.onboarding", title: "Complete onboarding", status: "COMPLETED", type: "CAMPAIGN", progress: 1, target: 1, xpReward: 50 })] : [],
    }));
    const out = html(createElement(CampaignTimelineView, { timeline, phases, hired: false }));
    expect(out).toContain("Operation Get Hired");
    expect(out).toContain("Today · Day 10");
    expect(out).toContain("Phase 1 · Launch");
    expect(out).toContain("Phase 3");
    expect(out).toContain("Build a target-company list");
    expect(out).toContain("Complete onboarding");
    expect(out).toContain("(completed)");
    expect(out).toContain('aria-current="step"');
  });

  it("levels and stats show values, formulas and observed inputs", () => {
    expect(html(createElement(LevelCards, { levels: playerLevels({ totalXp: 400, jobHunterXp: 200, electricianXp: 0 }) }))).toContain("Job Hunter");
    const inputs: StatInputs = {
      interviewsAttended: 1,
      interviewsPrepped: 1,
      lessonsCompleted: 3,
      totalLessons: 31,
      quizBestRatios: [0.8],
      resumeVersions: 1,
      resumeImprovementMissions: 0,
      followUps: 4,
      recruiterContacts: 1,
      verifiedHours: 120,
    };
    const out = html(createElement(StatsPanel, { stats: computeDerivedStats(inputs), inputs }));
    expect(out).toContain("Interview Skill");
    expect(out).toContain("Formula:");
    expect(out).toContain("15 × interviews attended");
    expect(out).toContain("self-reported hours are not counted");
  });

  it("electrician path separates verified and self-reported hours and links onward", () => {
    const out = html(
      createElement(ElectricianPathCard, {
        missions: [mission({ key: "e150.trainee", title: "Register as an Electrician Trainee", campaign: "ELECTRICIAN_150K", type: "CAMPAIGN", target: 1, progress: 0, selfReported: true })],
        verifiedHours: 120,
        selfReportedHours: 40,
        longTermSalaryTarget: 150000,
        timezone: TZ,
      }),
    );
    expect(out).toContain("$150K Electrician Path");
    expect(out).toContain("120");
    expect(out).toContain("40 self-reported hours");
    expect(out).toContain('href="/career-map"');
    expect(out).toContain('href="/academy"');
    expect(out).toContain("not a promise");
  });
});

describe("achievements and campaign forms (client components)", () => {
  const cards: AchievementCardView[] = [
    { key: "first-application", title: "First Application", description: "You applied.", icon: "send", tier: "bronze", condition: "Apply to 1", label: null, unlocked: true, unlockedAt: "2026-10-21T17:00:00.000Z", fresh: true, current: 1, target: 1, ratio: 1 },
    { key: "ten-applications", title: "Ten Applications", description: "Ten.", icon: "layers", tier: "bronze", condition: "Apply to 10 distinct positions", label: null, unlocked: false, unlockedAt: null, fresh: false, current: 4, target: 10, ratio: 0.4 },
  ];

  it("grid shows unlocked (with date, New badge) and locked (with progress) cards", () => {
    const out = html(createElement(AchievementGrid, { cards, timezone: TZ }));
    expect(out).toContain("Unlocked Oct 21, 2026");
    expect(out).toContain("New");
    expect(out).toContain("Locked · 4 / 10");
    expect(out).toContain("Apply to 10 distinct positions");
  });

  it("celebration overlay renders the first unseen achievement with a dismiss control", () => {
    const out = html(
      createElement(CelebrationOverlay, {
        items: [{ id: "x1", key: "first-application", title: "First Application", description: "You applied.", icon: "send", tier: "bronze", unlockedAt: "2026-10-21T17:00:00.000Z" }],
      }),
    );
    expect(out).toContain("Achievement unlocked");
    expect(out).toContain("First Application");
    expect(out).toContain("Dismiss achievement celebration");
    expect(out).toContain('href="/missions/achievements"');
  });

  it("employment card: report a job, or show the self-reported one", () => {
    expect(html(createElement(EmploymentCard, { employment: null, hired: false, todayKey: "2026-10-21" }))).toContain("I accepted a job");
    const out = html(
      createElement(EmploymentCard, {
        employment: { employer: "Bright Electric", title: "Trainee", startDate: "2026-10-20", amount: 50, period: "HOURLY", hoursPerWeek: 40, annualized: 104000, reportedAt: "2026-10-21T17:00:00.000Z" },
        hired: true,
        todayKey: "2026-10-21",
      }),
    );
    expect(out).toContain("Trainee at Bright Electric");
    expect(out).toContain("Self-reported");
    expect(out).toContain("$104,000/yr");
  });

  it("paycheck card and next-phase plan render their forms", () => {
    const pay = html(createElement(PaycheckCard, { paychecks: [{ id: "p1", amount: 1234.5, payDate: "2026-10-17", loggedAt: "2026-10-17T20:00:00.000Z" }], paycheckCount: 1, careerEarnings: 1234.5, todayKey: "2026-10-21" }));
    expect(pay).toContain("$1,234.50");
    expect(pay).toContain("Log a paycheck");
    expect(pay).toContain("Remove paycheck");
    const plan = html(createElement(NextPhasePlanForm, { plan: null, timezone: TZ, beyond: true, daysPast: 5 }));
    expect(plan).toContain("5 days past the planned window");
    expect(plan).toContain("Save plan");
    expect(plan).toContain('id="next-phase"');
  });
});
