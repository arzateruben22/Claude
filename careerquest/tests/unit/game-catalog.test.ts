import { describe, expect, it } from "vitest";
import {
  EXTENSION_BLOCK_DAYS,
  applicationDaysTarget,
  buildMissionPlan,
  getHiredWindow,
  missionMetaJson,
  missionXpReason,
  plannedWorkdays,
  readMissionMeta,
  weeklyApplicationTarget,
  type PlanInput,
} from "@/lib/game/mission-catalog";
import { addUtcDays, dateFromKey, dateKey } from "@/lib/dates";
import { XP } from "@/lib/game/xp-config";

const START = dateFromKey("2026-10-12"); // Monday, campaign day 1
const WED = dateFromKey("2026-10-21"); // campaign day 10 (Phase 1)

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    today: WED,
    dailyApplicationTarget: 5,
    weeklyApplicationTarget: 25,
    workdaysPerWeek: 5,
    campaignLengthDays: 90,
    getHired: { startedAt: START, completed: false },
    electricianStartedAt: START,
    restDayToday: false,
    restWorkdaysThisWeek: 0,
    followUpsDue: [],
    loggedHoursRecently: false,
    interviewWithin14Days: false,
    lessonsRemaining: 31,
    fundamentalsTotal: 8,
    verifiedHours: 0,
    examStageUnlocked: false,
    ...over,
  };
}

const keys = (i: PlanInput) => buildMissionPlan(i).map((m) => m.key);
const find = (i: PlanInput, key: string) => buildMissionPlan(i).find((m) => m.key === key);

describe("daily missions", () => {
  it("on a workday: submit N (N = daily target), an Academy lesson; periods are today", () => {
    const plan = buildMissionPlan(input());
    const apply = plan.find((m) => m.key === "daily.apply")!;
    expect(apply).toMatchObject({ type: "DAILY", target: 5, title: "Submit 5 qualified applications", xpReward: XP.MISSION_DAILY });
    expect(apply.meta).toMatchObject({ metric: "APPLICATIONS_DAY", jobHunt: true, syncTarget: true, href: "/applications/new" });
    expect(dateKey(apply.periodStart)).toBe("2026-10-21");
    expect(dateKey(apply.periodEnd)).toBe("2026-10-21");
    expect(plan.find((m) => m.key === "daily.lesson")).toMatchObject({ campaign: "ELECTRICIAN_150K", target: 1 });
    expect(keys(input())).not.toContain("daily.followups");
    expect(keys(input())).not.toContain("daily.hours");
  });

  it("uses singular wording for a target of one", () => {
    expect(find(input({ dailyApplicationTarget: 1 }), "daily.apply")?.title).toBe("Submit 1 qualified application");
  });

  it("adds 'Clear today's follow-ups' only when some are due, with the due ids as a snapshot", () => {
    const m = find(input({ followUpsDue: ["a", "b"] }), "daily.followups")!;
    expect(m.target).toBe(2);
    expect(m.meta.applicationIds).toEqual(["a", "b"]);
    expect(m.meta.metric).toBe("FOLLOW_UPS_DUE_CLEARED");
  });

  it("adds 'Log training hours' only when hours were logged in the last 14 days", () => {
    expect(keys(input({ loggedHoursRecently: true }))).toContain("daily.hours");
  });

  it("drops the lesson mission when every lesson is done and the apply mission when the target is 0", () => {
    expect(keys(input({ lessonsRemaining: 0 }))).not.toContain("daily.lesson");
    expect(keys(input({ dailyApplicationTarget: 0 }))).not.toContain("daily.apply");
  });

  it("creates no daily missions on non-workdays (weekend at 5 workdays) but does at 7", () => {
    const sat = dateFromKey("2026-10-24");
    expect(keys(input({ today: sat })).filter((k) => k.startsWith("daily."))).toEqual([]);
    expect(keys(input({ today: sat, workdaysPerWeek: 7 }))).toContain("daily.apply");
  });

  it("a rest day removes that day's daily expectations", () => {
    expect(keys(input({ restDayToday: true, followUpsDue: ["a"] })).filter((k) => k.startsWith("daily."))).toEqual([]);
  });
});

describe("weekly missions", () => {
  it("Monday–Sunday period with W = weekly target, 3 follow-ups and a quiz", () => {
    const plan = buildMissionPlan(input());
    const apply = plan.find((m) => m.key === "weekly.apply")!;
    expect(apply).toMatchObject({ type: "WEEKLY", target: 25, xpReward: XP.MISSION_WEEKLY });
    expect(dateKey(apply.periodStart)).toBe("2026-10-19");
    expect(dateKey(apply.periodEnd)).toBe("2026-10-25");
    expect(plan.find((m) => m.key === "weekly.followups")?.target).toBe(3);
    expect(plan.find((m) => m.key === "weekly.quiz")?.meta.metric).toBe("QUIZ_PASSED");
    expect(keys(input())).not.toContain("weekly.interview-prep");
  });

  it("adds interview prep only when an interview is within 14 days", () => {
    expect(find(input({ interviewWithin14Days: true }), "weekly.interview-prep")?.meta.metric).toBe("INTERVIEW_PREP");
  });

  it("rest days on workdays lower the weekly target by the daily target (never below 1)", () => {
    expect(weeklyApplicationTarget({ dailyApplicationTarget: 5, weeklyApplicationTarget: 25, workdaysPerWeek: 5, restWorkdaysThisWeek: 2 })).toEqual({ base: 25, target: 15 });
    expect(weeklyApplicationTarget({ dailyApplicationTarget: 5, weeklyApplicationTarget: 25, workdaysPerWeek: 5, restWorkdaysThisWeek: 9 }).target).toBe(1);
    expect(find(input({ restWorkdaysThisWeek: 1 }), "weekly.apply")?.title).toBe("Submit 20 applications this week");
  });

  it("falls back to daily × workdays when no explicit weekly target is set", () => {
    expect(find(input({ weeklyApplicationTarget: 0, dailyApplicationTarget: 3, workdaysPerWeek: 4 }), "weekly.apply")?.target).toBe(12);
  });
});

describe("Operation Get Hired windows", () => {
  it("maps campaign days to phases (1–30, 31–60, 61–90) and 30-day blocks after", () => {
    const at = (day: number) => getHiredWindow(START, addUtcDays(START, day - 1), 90);
    expect(at(1)).toMatchObject({ phase: 1, block: null });
    expect(dateKey(at(30)!.end)).toBe(dateKey(addUtcDays(START, 29)));
    expect(at(31)?.phase).toBe(2);
    expect(dateKey(at(31)!.start)).toBe(dateKey(addUtcDays(START, 30)));
    expect(at(60)?.phase).toBe(2);
    expect(at(61)?.phase).toBe(3);
    expect(at(90)?.phase).toBe(3);
    const b0 = at(91)!;
    expect(b0).toMatchObject({ phase: null, block: 0 });
    expect(dateKey(b0.start)).toBe(dateKey(addUtcDays(START, 90)));
    expect(dateKey(b0.end)).toBe(dateKey(addUtcDays(START, 90 + EXTENSION_BLOCK_DAYS - 1)));
    expect(at(121)?.block).toBe(1);
    expect(getHiredWindow(START, addUtcDays(START, -1), 90)).toBeNull();
  });
});

describe("campaign missions by phase", () => {
  it("Phase 1: onboarding, résumé, tracking, 10 target companies, 25 applications, 3 programs, Fundamentals", () => {
    const plan = buildMissionPlan(input()).filter((m) => m.type === "CAMPAIGN" && m.campaign === "GET_HIRED");
    expect(plan.map((m) => m.key)).toEqual([
      "gh.p1.onboarding",
      "gh.p1.resume",
      "gh.p1.tracking",
      "gh.p1.targets",
      "gh.p1.apps25",
      "gh.p1.programs",
      "gh.p1.fundamentals",
    ]);
    expect(plan.find((m) => m.key === "gh.p1.targets")?.target).toBe(10);
    expect(plan.find((m) => m.key === "gh.p1.apps25")?.target).toBe(25);
    expect(plan.find((m) => m.key === "gh.p1.fundamentals")?.target).toBe(8);
    for (const m of plan) {
      expect(dateKey(m.periodStart)).toBe("2026-10-12");
      expect(dateKey(m.periodEnd)).toBe(dateKey(addUtcDays(START, 29)));
      expect(m.meta.phase).toBe(1);
      expect(m.xpReward).toBeGreaterThan(0);
    }
    expect(missionXpReason("CAMPAIGN")).toBe("MISSION_WEEKLY");
    expect(missionXpReason("DAILY")).toBe("MISSION_DAILY");
  });

  it("skips the Fundamentals mission when the Academy has no Fundamentals lessons", () => {
    expect(keys(input({ fundamentalsTotal: 0 }))).not.toContain("gh.p1.fundamentals");
  });

  it("Phase 2: consistency (60 % of workdays), 10 follow-ups, 2 preps, analytics review, résumé, training", () => {
    const day40 = addUtcDays(START, 39);
    const plan = buildMissionPlan(input({ today: day40 })).filter((m) => m.campaign === "GET_HIRED" && m.type === "CAMPAIGN");
    expect(plan.map((m) => m.key)).toEqual(["gh.p2.consistency", "gh.p2.followups", "gh.p2.preps", "gh.p2.analytics", "gh.p2.resume", "gh.p2.training"]);
    const consistency = plan[0]!;
    const workdays = plannedWorkdays(consistency.periodStart, consistency.periodEnd, 5);
    expect(consistency.target).toBe(Math.ceil(0.6 * workdays));
    expect(consistency.meta.ratio).toBe(0.6);
    expect(plan.find((m) => m.key === "gh.p2.analytics")?.meta.selfCheck).toBe(true);
  });

  it("Phase 3: interviews, conversations, offer evaluation, salary prep, next-phase plan", () => {
    const plan = buildMissionPlan(input({ today: addUtcDays(START, 74) })).filter((m) => m.campaign === "GET_HIRED" && m.type === "CAMPAIGN");
    expect(plan.map((m) => m.key)).toEqual(["gh.p3.interviews", "gh.p3.conversations", "gh.p3.offer", "gh.p3.salary", "gh.p3.plan"]);
    expect(plan.find((m) => m.key === "gh.p3.plan")?.meta.href).toBe("/missions/campaign#next-phase");
  });

  it("past day 90 without a job: next-phase planning missions in 30-day blocks", () => {
    const plan = buildMissionPlan(input({ today: addUtcDays(START, 94) })).filter((m) => m.campaign === "GET_HIRED" && m.type === "CAMPAIGN");
    expect(plan.map((m) => m.key)).toEqual(["gh.next.plan", "gh.next.consistency"]);
    expect(dateKey(plan[0]!.periodStart)).toBe(dateKey(addUtcDays(START, 90)));
    expect(plan[0]!.meta.phase).toBeNull();
    expect(plan[1]!.meta.ratio).toBe(0.5);
  });

  it("no Get Hired campaign missions before the campaign starts", () => {
    expect(keys(input({ getHired: { startedAt: addUtcDays(WED, 3), completed: false } })).some((k) => k.startsWith("gh."))).toBe(false);
  });

  it("after a job is reported: job-search missions stop, the Electrician Path and study continue", () => {
    const k = keys(input({ getHired: { startedAt: START, completed: true }, followUpsDue: ["x"], interviewWithin14Days: true }));
    expect(k.some((x) => x.startsWith("gh."))).toBe(false);
    expect(k).not.toContain("daily.apply");
    expect(k).not.toContain("daily.followups");
    expect(k).not.toContain("weekly.apply");
    expect(k).not.toContain("weekly.interview-prep");
    expect(k).toEqual(expect.arrayContaining(["daily.lesson", "weekly.quiz", "e150.apply-program", "e150.trainee", "e150.hours-1000"]));
  });
});

describe("$150K Electrician Path missions", () => {
  it("run on a long horizon from the electrician campaign start", () => {
    const e = buildMissionPlan(input()).filter((m) => m.campaign === "ELECTRICIAN_150K" && m.type === "CAMPAIGN");
    expect(e.map((m) => m.key)).toEqual(["e150.apply-program", "e150.apply-3", "e150.school", "e150.trainee", "e150.hours-log", "e150.hours-1000"]);
    expect(dateKey(e[0]!.periodStart)).toBe("2026-10-12");
    expect(e[0]!.periodEnd.getTime() - e[0]!.periodStart.getTime()).toBeGreaterThan(365 * 86_400_000);
  });

  it("reveals hours milestones one at a time", () => {
    const k = (hours: number) => keys(input({ verifiedHours: hours })).filter((x) => x.startsWith("e150.hours-") && x !== "e150.hours-log");
    expect(k(0)).toEqual(["e150.hours-1000"]);
    expect(k(1000)).toEqual(["e150.hours-1000", "e150.hours-2000"]);
    expect(k(4500)).toEqual(["e150.hours-1000", "e150.hours-2000", "e150.hours-4000", "e150.hours-8000"]);
    expect(k(9000)).toEqual(["e150.hours-1000", "e150.hours-2000", "e150.hours-4000", "e150.hours-8000"]);
  });

  it("adds exam steps once the exam stage is unlocked", () => {
    expect(keys(input({ examStageUnlocked: true }))).toEqual(expect.arrayContaining(["e150.exam-apply", "e150.exam-pass"]));
    expect(keys(input())).not.toContain("e150.exam-apply");
  });
});

describe("helpers", () => {
  it("every plan key is unique per period", () => {
    const plan = buildMissionPlan(input({ followUpsDue: ["a"], loggedHoursRecently: true, interviewWithin14Days: true, examStageUnlocked: true }));
    const ids = plan.map((m) => `${m.key}|${dateKey(m.periodStart)}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applicationDaysTarget shrinks with rest days and never drops below 1", () => {
    const start = dateFromKey("2026-10-19");
    const end = dateFromKey("2026-10-25");
    expect(plannedWorkdays(start, end, 5)).toBe(5);
    expect(applicationDaysTarget(start, end, 5, 0.6)).toBe(3);
    expect(applicationDaysTarget(start, end, 5, 0.6, new Set(["2026-10-20", "2026-10-21"]))).toBe(2);
    expect(applicationDaysTarget(start, end, 5, 0.6, new Set(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]))).toBe(1);
  });

  it("readMissionMeta is defensive and round-trips catalog metadata", () => {
    expect(readMissionMeta(null)).toMatchObject({ metric: "SELF_CHECK", href: null, selfCheck: false });
    expect(readMissionMeta({ metric: "NOPE", href: "https://evil.example", phase: 7, applicationIds: [1, "x"] })).toMatchObject({
      metric: "SELF_CHECK",
      href: null,
      phase: null,
      applicationIds: ["x"],
    });
    const spec = find(input({ followUpsDue: ["a"] }), "daily.followups")!;
    expect(readMissionMeta(missionMetaJson(spec.meta))).toEqual(spec.meta);
    expect(readMissionMeta({ ...missionMetaJson(spec.meta), skipReason: "REST_DAY", checkedAt: "2026-10-21T10:00:00.000Z" })).toMatchObject({
      skipReason: "REST_DAY",
      checkedAt: "2026-10-21T10:00:00.000Z",
    });
  });
});
