import { describe, expect, it } from "vitest";
import { campaignTimeline, phaseSegments } from "@/lib/dashboard/campaign";
import { recommendNextAction, type NextActionInput } from "@/lib/dashboard/next-action";
import { buildDailySeries, endOfDayInTz, followUpDateKey, followUpDueBound, startOfDayInTz, tzOffsetMinutes } from "@/lib/dashboard/time";
import { addDaysUtc, diffDaysUtc, utcDateKey } from "@/lib/goals/days";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe("days helpers", () => {
  it("do exact UTC arithmetic", () => {
    expect(utcDateKey(addDaysUtc(d("2026-03-07"), 2))).toBe("2026-03-09");
    expect(diffDaysUtc(d("2026-10-01"), d("2026-10-12"))).toBe(11);
    expect(diffDaysUtc(d("2026-10-12"), d("2026-10-01"))).toBe(-11);
  });
});

describe("campaignTimeline", () => {
  it("splits a 90-day campaign into 1–30 / 31–60 / 61–90", () => {
    expect(phaseSegments(90).map((p) => [p.startDay, p.endDay])).toEqual([
      [1, 30],
      [31, 60],
      [61, 90],
    ]);
    expect(phaseSegments(60).map((p) => [p.startDay, p.endDay])).toEqual([
      [1, 20],
      [21, 40],
      [41, 60],
    ]);
  });

  it("reports day, phase and eyebrow", () => {
    const t = campaignTimeline({ startDate: d("2026-10-01"), today: d("2026-10-12"), lengthDays: 90 });
    expect(t.day).toBe(12);
    expect(t.phase).toBe(1);
    expect(t.phaseName).toBe("Launch");
    expect(t.eyebrow).toBe("Day 12 of 90 · Phase 1");
    expect(t.progress).toBeCloseTo(11 / 90, 5);
    expect(utcDateKey(t.endDate)).toBe("2026-12-29");
    expect(campaignTimeline({ startDate: d("2026-10-01"), today: d("2026-10-31"), lengthDays: 90 }).phase).toBe(2);
    expect(campaignTimeline({ startDate: d("2026-10-01"), today: d("2026-12-29"), lengthDays: 90 }).phase).toBe(3);
  });

  it("says plainly when the campaign is over or has not started", () => {
    const beyond = campaignTimeline({ startDate: d("2026-10-01"), today: d("2027-01-05"), lengthDays: 90 });
    expect(beyond.beyond).toBe(true);
    expect(beyond.phase).toBeNull();
    expect(beyond.progress).toBe(1);
    expect(beyond.eyebrow).toBe("Day 97 · Beyond the 90-day campaign");
    const future = campaignTimeline({ startDate: d("2026-10-10"), today: d("2026-10-08"), lengthDays: 90 });
    expect(future.started).toBe(false);
    expect(future.eyebrow).toBe("Campaign starts in 2 days");
    expect(future.progress).toBe(0);
  });
});

describe("recommendNextAction", () => {
  const now = new Date("2026-10-12T18:00:00.000Z");
  const base: NextActionInput = {
    overdueFollowUps: 0,
    firstOverdueApplicationId: null,
    todaySubmitted: 5,
    dailyTarget: 5,
    totalApplications: 20,
    totalSubmitted: 18,
    nextInterview: null,
    onboardingComplete: true,
    now,
  };

  it("prioritises overdue follow-ups and deep-links a single one", () => {
    const one = recommendNextAction({ ...base, overdueFollowUps: 1, firstOverdueApplicationId: "app-1" });
    expect(one.key).toBe("follow-up");
    expect(one.href).toBe("/applications/app-1");
    const many = recommendNextAction({ ...base, overdueFollowUps: 3, firstOverdueApplicationId: "app-1" });
    expect(many.title).toBe("Send 3 overdue follow-ups");
    expect(many.href).toBe("/applications");
  });

  it("asks for the first application before anything about targets", () => {
    const a = recommendNextAction({ ...base, totalApplications: 0, totalSubmitted: 0, todaySubmitted: 0 });
    expect(a.key).toBe("first-application");
    expect(a.href).toBe("/applications/new");
  });

  it("asks to apply while today's target is unmet", () => {
    const a = recommendNextAction({ ...base, todaySubmitted: 2 });
    expect(a.key).toBe("apply");
    expect(a.title).toBe("Submit 3 more applications today");
    expect(recommendNextAction({ ...base, todaySubmitted: 4 }).title).toBe("Submit 1 more application today");
  });

  it("prepares for an interview within 48h once the target is met", () => {
    const soon = { scheduledAt: new Date(now.getTime() + 20 * 3600000), applicationId: "app-9", companyName: "Acme" };
    const a = recommendNextAction({ ...base, nextInterview: soon });
    expect(a.key).toBe("interview-prep");
    expect(a.href).toBe("/applications/app-9");
    expect(a.description).toContain("about 20 hours");
    const later = { ...soon, scheduledAt: new Date(now.getTime() + 72 * 3600000) };
    expect(recommendNextAction({ ...base, nextInterview: later }).key).toBe("academy");
    // Interview prep does not outrank the daily target (spec order).
    expect(recommendNextAction({ ...base, nextInterview: soon, todaySubmitted: 1 }).key).toBe("apply");
  });

  it("falls through to onboarding, then the academy", () => {
    expect(recommendNextAction({ ...base, onboardingComplete: false }).key).toBe("onboarding");
    expect(recommendNextAction({ ...base, onboardingComplete: false }).href).toBe("/settings");
    expect(recommendNextAction(base).key).toBe("academy");
    expect(recommendNextAction({ ...base, dailyTarget: 0, todaySubmitted: 0 }).key).toBe("academy");
  });
});

describe("timezone helpers", () => {
  it("computes offsets and local-midnight instants (incl. DST)", () => {
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/Los_Angeles")).toBe(-420);
    expect(tzOffsetMinutes(new Date("2026-01-01T12:00:00Z"), "America/Los_Angeles")).toBe(-480);
    expect(tzOffsetMinutes(new Date("2026-01-01T12:00:00Z"), "UTC")).toBe(0);
    expect(startOfDayInTz("2026-10-21", "America/Los_Angeles").toISOString()).toBe("2026-10-21T07:00:00.000Z");
    expect(endOfDayInTz("2026-10-21", "America/Los_Angeles").toISOString()).toBe("2026-10-22T07:00:00.000Z");
    expect(startOfDayInTz("2026-11-01", "America/Los_Angeles").toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(endOfDayInTz("2026-11-01", "America/Los_Angeles").toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(startOfDayInTz("2026-10-21", "Europe/Berlin").toISOString()).toBe("2026-10-20T22:00:00.000Z");
  });

  it("interprets date-only follow-ups by UTC date and timestamps by the user's zone", () => {
    expect(followUpDateKey(new Date("2026-10-21T00:00:00.000Z"), "America/Los_Angeles")).toBe("2026-10-21");
    expect(followUpDateKey(new Date("2026-10-22T03:30:00.000Z"), "America/Los_Angeles")).toBe("2026-10-21");
    expect(followUpDateKey(new Date("2026-10-22T03:30:00.000Z"), "Europe/Berlin")).toBe("2026-10-22");
  });

  it("due bound is the later of end-of-day in the zone and in UTC", () => {
    expect(followUpDueBound("2026-10-21", "America/Los_Angeles").toISOString()).toBe("2026-10-22T07:00:00.000Z");
    expect(followUpDueBound("2026-10-21", "Europe/Berlin").toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("builds a dense daily series ending today", () => {
    const s = buildDailySeries({ "2026-10-20": 3, "2026-10-21": 1, "2026-10-01": 99 }, "2026-10-21", 14);
    expect(s).toHaveLength(14);
    expect(s[0]).toEqual({ key: "2026-10-08", label: "Oct 8", count: 0 });
    expect(s[12]).toEqual({ key: "2026-10-20", label: "Oct 20", count: 3 });
    expect(s[13]).toEqual({ key: "2026-10-21", label: "Oct 21", count: 1 });
  });
});
