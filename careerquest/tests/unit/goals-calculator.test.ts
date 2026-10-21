import { describe, expect, it } from "vitest";
import {
  adjustmentDataRequirements,
  campaignGoal,
  computePace,
  recommendAdjustments,
  weekProgress,
  weekTargets,
  workdaysToCalendarDays,
} from "@/lib/goals/calculator";
import { addDaysUtc, utcDateKey } from "@/lib/goals/days";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const START = d("2026-10-01");

function base(overrides: Partial<Parameters<typeof computePace>[0]> = {}) {
  return computePace({
    dailyTarget: 5,
    workdaysPerWeek: 5,
    campaignLengthDays: 90,
    campaignStartDate: START,
    today: d("2026-10-12"), // day 12
    completedApplications: 40,
    ...overrides,
  });
}

describe("campaignGoal / conversions", () => {
  it("goal = daily × workdays × weeks", () => {
    expect(campaignGoal(5, 5, 90)).toBe(321); // 25 × 12.857
    expect(campaignGoal(0, 5, 90)).toBe(0);
    expect(campaignGoal(3, 7, 7)).toBe(21);
  });
  it("converts workdays to calendar days rounding up", () => {
    expect(workdaysToCalendarDays(5, 5)).toBe(7);
    expect(workdaysToCalendarDays(1, 5)).toBe(2);
    expect(workdaysToCalendarDays(0, 5)).toBe(0);
    expect(workdaysToCalendarDays(7, 7)).toBe(7);
  });
});

describe("computePace", () => {
  it("computes campaign day, elapsed/remaining days and the goal", () => {
    const r = base();
    expect(r.campaignDay).toBe(12);
    expect(r.daysElapsed).toBe(11);
    expect(r.daysRemaining).toBe(79);
    expect(r.beyondCampaign).toBe(false);
    expect(r.campaignGoalApplications).toBe(321);
    expect(r.remainingToGoal).toBe(281);
    expect(utcDateKey(r.campaignEndDate)).toBe("2026-12-29");
    expect(r.progressRatio).toBeCloseTo(40 / 321, 5);
  });

  it("required pace is remaining ÷ remaining workdays; observed pace is completed ÷ elapsed workdays", () => {
    const r = base();
    const remainingWorkdays = (79 * 5) / 7;
    expect(r.remainingWorkdays).toBeCloseTo(remainingWorkdays, 5);
    expect(r.requiredDailyPace).toBeCloseTo(281 / remainingWorkdays, 5);
    expect(r.requiredWeeklyPace).toBeCloseTo((281 / remainingWorkdays) * 5, 5);
    const elapsedWorkdays = (12 * 5) / 7;
    expect(r.elapsedWorkdays).toBeCloseTo(elapsedWorkdays, 5);
    expect(r.observedDailyPace).toBeCloseTo(40 / elapsedWorkdays, 5);
    expect(r.observedWeeklyPace).toBeCloseTo((40 / elapsedWorkdays) * 5, 5);
  });

  it("onTrack compares completed against what the target expects by the start of today", () => {
    // 11 full days × 5/7 workdays × 5/day = 39.28 → expects 39
    expect(base({ completedApplications: 39 }).expectedByToday).toBe(39);
    expect(base({ completedApplications: 39 }).onTrack).toBe(true);
    expect(base({ completedApplications: 38 }).onTrack).toBe(false);
    // Day 1: nothing expected yet.
    const day1 = base({ today: START, completedApplications: 0 });
    expect(day1.expectedByToday).toBe(0);
    expect(day1.onTrack).toBe(true);
    expect(day1.observedDailyPace).toBe(0);
  });

  it("milestones: next/remaining, projections at observed pace, achieved flags", () => {
    const r = base({ completedApplications: 40 });
    expect(r.nextMilestone).toBe(50);
    expect(r.remainingToNextMilestone).toBe(10);
    const achieved = r.projectedMilestoneDates.filter((m) => m.achieved).map((m) => m.milestone);
    expect(achieved).toEqual([10, 25]);
    const m50 = r.projectedMilestoneDates.find((m) => m.milestone === 50)!;
    // 10 remaining at 40/8.571 = 4.667/day → 2.14 workdays → ceil(2.14×7/5)=3 calendar days
    expect(utcDateKey(m50.projectedDate!)).toBe("2026-10-15");
    expect(m50.withinCampaign).toBe(true);
    const m10000 = r.projectedMilestoneDates.find((m) => m.milestone === 10000)!;
    expect(m10000.projectedDate).not.toBeNull();
    expect(m10000.withinCampaign).toBe(false);
    expect(r.projectedMilestoneDates.map((m) => m.milestone)).toEqual([10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]);
  });

  it("projections are null when observed pace is zero", () => {
    const r = base({ completedApplications: 0 });
    expect(r.nextMilestone).toBe(10);
    expect(r.projectedMilestoneDates.every((m) => m.projectedDate === null)).toBe(true);
    expect(r.projectedGoalDate).toBeNull();
  });

  it("supports custom milestone targets", () => {
    const r = base({ completedApplications: 7, milestoneTargets: [5, 20] });
    expect(r.projectedMilestoneDates.map((m) => [m.milestone, m.achieved])).toEqual([
      [5, true],
      [20, false],
    ]);
    expect(r.nextMilestone).toBe(20);
    expect(r.remainingToNextMilestone).toBe(13);
  });

  it("reports when the campaign is over", () => {
    const r = base({ today: d("2027-01-15"), completedApplications: 100 });
    expect(r.beyondCampaign).toBe(true);
    expect(r.daysElapsed).toBe(90);
    expect(r.daysRemaining).toBe(0);
    expect(r.requiredDailyPace).toBeNull();
    expect(r.requiredWeeklyPace).toBeNull();
    expect(r.onTrack).toBe(false);
    const done = base({ today: d("2027-01-15"), completedApplications: 321 });
    expect(done.requiredDailyPace).toBe(0);
    expect(done.onTrack).toBe(true);
  });

  it("handles a campaign that has not started yet", () => {
    const r = base({ today: d("2026-09-20"), completedApplications: 0, activityByDate: {} });
    expect(r.campaignDay).toBe(0);
    expect(r.daysElapsed).toBe(0);
    expect(r.daysRemaining).toBe(90);
    expect(r.consistency).toBeNull();
    expect(r.observedDailyPace).toBe(0);
  });

  it("consistency = active workdays ÷ elapsed workdays (clamped to 1)", () => {
    const activity: Record<string, number> = {};
    for (let i = 0; i < 12; i++) activity[utcDateKey(addDaysUtc(START, i))] = i % 2 === 0 ? 3 : 0; // 6 active days
    activity["2026-09-15"] = 5; // before campaign: ignored
    const r = base({ activityByDate: activity });
    // round(12 × 5/7) = round(8.57) = 9 elapsed workdays
    expect(r.consistency).toBeCloseTo(6 / 9, 5);
    const everyDay: Record<string, number> = {};
    for (let i = 0; i < 12; i++) everyDay[utcDateKey(addDaysUtc(START, i))] = 1;
    expect(base({ activityByDate: everyDay }).consistency).toBe(1);
    expect(base().consistency).toBeNull();
  });

  it("expected responses are completed × rate (and goal × rate)", () => {
    const r = base({ historicalResponseRate: 0.1 });
    expect(r.expectedResponses).toBeCloseTo(4, 5);
    expect(r.expectedResponsesAtGoal).toBeCloseTo(32.1, 5);
    expect(base().expectedResponses).toBeNull();
    expect(base({ historicalResponseRate: 1.7 }).expectedResponses).toBe(40); // clamped to 100%
  });

  it("opportunity outlook caps the goal and reports runway", () => {
    const r = base({ availableOpportunities: 100 });
    expect(r.opportunity).toEqual({
      available: 100,
      remainingAvailable: 60,
      goalExceedsAvailable: true,
      reachableGoal: 100,
      runwayDays: 17, // 60/5 = 12 workdays → ceil(12×7/5)
    });
    expect(base().opportunity).toBeNull();
    expect(base({ dailyTarget: 0, availableOpportunities: 10 }).opportunity?.runwayDays).toBeNull();
  });

  it("tolerates garbage input without throwing", () => {
    const r = computePace({
      dailyTarget: -3,
      workdaysPerWeek: 0,
      campaignLengthDays: Number.NaN,
      campaignStartDate: START,
      today: d("2026-10-12"),
      completedApplications: -1,
    });
    expect(r.campaignGoalApplications).toBe(0);
    expect(r.campaignLengthDays).toBe(90);
    expect(r.requiredDailyPace).toBe(0);
    expect(r.observedDailyPace).toBe(0);
  });
});

describe("weekTargets", () => {
  it("prefers the explicit weekly target and flags mismatches", () => {
    expect(weekTargets({ dailyApplicationTarget: 5, workdaysPerWeek: 5, weeklyApplicationTarget: 25 })).toEqual({
      dailyTarget: 5,
      workdaysPerWeek: 5,
      weeklyTarget: 25,
      impliedWeeklyTarget: 25,
      mismatch: false,
    });
    const t = weekTargets({ dailyApplicationTarget: 4, workdaysPerWeek: 5, weeklyApplicationTarget: 30 });
    expect(t.weeklyTarget).toBe(30);
    expect(t.impliedWeeklyTarget).toBe(20);
    expect(t.mismatch).toBe(true);
  });
  it("falls back to daily × workdays when weekly is unset", () => {
    expect(weekTargets({ dailyApplicationTarget: 3, workdaysPerWeek: 6, weeklyApplicationTarget: 0 }).weeklyTarget).toBe(18);
  });
});

describe("weekProgress", () => {
  it("sums the 7 days from the week start and counts active days", () => {
    const monday = d("2026-10-05");
    const p = weekProgress({ "2026-10-05": 2, "2026-10-07": 3, "2026-10-11": 1, "2026-10-12": 9 }, monday);
    expect(p.days).toHaveLength(7);
    expect(p.days[0]).toEqual({ key: "2026-10-05", count: 2 });
    expect(p.submitted).toBe(6);
    expect(p.activeDays).toBe(3);
    expect(utcDateKey(p.weekEnd)).toBe("2026-10-11");
  });
});

describe("recommendAdjustments", () => {
  const healthy = {
    dailyTarget: 5,
    workdaysPerWeek: 5,
    campaignDay: 20,
    completedApplications: 70,
    responses: 7,
    observedDailyPace: 4.9,
    requiredDailyPace: 5,
    consistency: 0.8,
  };

  it("returns nothing when the observed numbers look fine", () => {
    expect(recommendAdjustments(healthy)).toEqual([]);
  });

  it("suggests lowering the target or widening categories when pace lags for 2+ weeks", () => {
    const out = recommendAdjustments({ ...healthy, observedDailyPace: 2.1, requiredDailyPace: 5.4 });
    const s = out.find((x) => x.id === "pace-behind");
    expect(s).toBeDefined();
    expect(s!.tone).toBe("warning");
    expect(s!.metric).toContain("2.1/workday");
    expect(s!.text).toMatch(/lowering your daily target to about 2/);
    expect(s!.text).toMatch(/widening the job categories/);
    expect(s!.text).toMatch(/Based on that observed pace/);
    // Not before 14 days of data.
    expect(recommendAdjustments({ ...healthy, campaignDay: 10, observedDailyPace: 2.1 })).toEqual([]);
  });

  it("flags a low response rate only after 30+ applications", () => {
    const low = recommendAdjustments({ ...healthy, completedApplications: 40, responses: 1 });
    const s = low.find((x) => x.id === "response-low");
    expect(s).toBeDefined();
    expect(s!.metric).toBe("1 responses from 40 applications (3%)");
    expect(s!.text).toMatch(/Based on your observed response rate of 3%/);
    expect(s!.text).not.toMatch(/guarantee|will get|you'll land/i);
    expect(recommendAdjustments({ ...healthy, completedApplications: 20, responses: 0 })).toEqual([]);
  });

  it("acknowledges a healthy response rate without promising outcomes", () => {
    const out = recommendAdjustments({ ...healthy, completedApplications: 40, responses: 8 });
    const s = out.find((x) => x.id === "response-healthy");
    expect(s?.tone).toBe("success");
    expect(s!.text).toMatch(/observed response rate of 20%/);
  });

  it("notes low consistency and a pace well above target", () => {
    const out = recommendAdjustments({ ...healthy, consistency: 0.3, observedDailyPace: 8, requiredDailyPace: 4 });
    expect(out.map((s) => s.id).sort()).toEqual(["consistency-low", "pace-ahead"]);
    expect(out.find((s) => s.id === "pace-ahead")!.text).toMatch(/raising the target to about 8/);
  });

  it("explains unmet data thresholds", () => {
    expect(adjustmentDataRequirements({ campaignDay: 3, completedApplications: 4 })).toBe(
      "Pace suggestions need 14 campaign days (currently 3) and response suggestions need 30 submitted applications (currently 4).",
    );
    expect(adjustmentDataRequirements({ campaignDay: 30, completedApplications: 100 })).toBe("");
  });
});
