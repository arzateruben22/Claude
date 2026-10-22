import { describe, expect, it } from "vitest";
import { computeStreak, isActiveDay, isScheduledWorkday, weeklyGraceDays, type StreakDay } from "@/lib/game/streak";
import { dateFromKey, dateKeyInTz } from "@/lib/dates";

// 2026-10-19 is a Monday.
const MON = "2026-10-19";
const TUE = "2026-10-20";
const WED = "2026-10-21";
const THU = "2026-10-22";
const FRI = "2026-10-23";
const SAT = "2026-10-24";
const SUN = "2026-10-25";
const NEXT_MON = "2026-10-26";
const NEXT_TUE = "2026-10-27";

const active = (...keys: string[]): StreakDay[] => keys.map((key) => ({ key, active: true }));

describe("isScheduledWorkday", () => {
  it("treats Saturday and Sunday as non-workdays at ≤ 5 workdays per week", () => {
    expect(isScheduledWorkday(dateFromKey(MON), 5)).toBe(true);
    expect(isScheduledWorkday(dateFromKey(FRI), 5)).toBe(true);
    expect(isScheduledWorkday(dateFromKey(SAT), 5)).toBe(false);
    expect(isScheduledWorkday(dateFromKey(SUN), 3)).toBe(false);
  });
  it("adds Saturday at 6 and every day at 7", () => {
    expect(isScheduledWorkday(dateFromKey(SAT), 6)).toBe(true);
    expect(isScheduledWorkday(dateFromKey(SUN), 6)).toBe(false);
    expect(isScheduledWorkday(dateFromKey(SUN), 7)).toBe(true);
  });
  it("clamps nonsense values to the 5-day default range", () => {
    expect(isScheduledWorkday(dateFromKey(SAT), Number.NaN)).toBe(false);
    expect(isScheduledWorkday(dateFromKey(SUN), 99)).toBe(true);
    expect(weeklyGraceDays(3)).toBe(2);
    expect(weeklyGraceDays(5)).toBe(0);
    expect(weeklyGraceDays(7)).toBe(0);
  });
});

describe("computeStreak", () => {
  it("returns zeros without history", () => {
    expect(computeStreak([], { workdaysPerWeek: 5, todayKey: WED })).toEqual({ current: 0, longest: 0, lastActiveKey: null });
  });

  it("counts consecutive active workdays", () => {
    expect(computeStreak(active(MON, TUE, WED), { workdaysPerWeek: 5, todayKey: WED })).toMatchObject({ current: 3, longest: 3, lastActiveKey: WED });
  });

  it("does not break on today before the day is over", () => {
    expect(computeStreak(active(MON, TUE), { workdaysPerWeek: 5, todayKey: WED }).current).toBe(2);
  });

  it("breaks on a missed workday (not today)", () => {
    const r = computeStreak(active(MON, WED), { workdaysPerWeek: 5, todayKey: THU });
    expect(r.current).toBe(1);
    expect(r.longest).toBe(1);
  });

  it("weekends neither break nor extend the streak at 5 workdays", () => {
    const r = computeStreak(active(THU, FRI, SAT, NEXT_MON), { workdaysPerWeek: 5, todayKey: NEXT_MON });
    expect(r.current).toBe(3); // Thu, Fri, Mon — Saturday's activity is not a streak day
    expect(r.lastActiveKey).toBe(NEXT_MON);
    // An idle weekend between Friday and Monday doesn't break it either.
    expect(computeStreak(active(FRI, NEXT_MON), { workdaysPerWeek: 5, todayKey: NEXT_TUE }).current).toBe(2);
  });

  it("weekend-only activity is not a streak at 5 workdays, but is at 7", () => {
    expect(computeStreak(active(SAT, SUN), { workdaysPerWeek: 5, todayKey: SUN }).current).toBe(0);
    expect(computeStreak(active(SAT, SUN), { workdaysPerWeek: 7, todayKey: SUN }).current).toBe(2);
  });

  it("at 7 workdays an idle Saturday breaks the streak", () => {
    expect(computeStreak(active(THU, FRI, SUN), { workdaysPerWeek: 7, todayKey: SUN }).current).toBe(1);
  });

  it("at 6 workdays Sunday is the day off", () => {
    expect(computeStreak(active(FRI, SAT, NEXT_MON), { workdaysPerWeek: 6, todayKey: NEXT_MON }).current).toBe(3);
  });

  it("rest days neither break nor extend the streak", () => {
    const days: StreakDay[] = [...active(MON), { key: TUE, active: false, restDay: true }, ...active(WED)];
    expect(computeStreak(days, { workdaysPerWeek: 5, todayKey: WED }).current).toBe(2);
    // Activity on a rest day does not extend it either.
    const busyRest: StreakDay[] = [...active(MON), { key: TUE, active: true, restDay: true }, ...active(WED)];
    expect(computeStreak(busyRest, { workdaysPerWeek: 5, todayKey: WED }).current).toBe(2);
  });

  it("forgives 5 − workdaysPerWeek idle weekdays per week", () => {
    // 3 planned workdays: two idle weekdays per week are fine, the third breaks.
    expect(computeStreak(active(MON, WED, FRI), { workdaysPerWeek: 3, todayKey: FRI }).current).toBe(3);
    expect(computeStreak(active(MON, THU), { workdaysPerWeek: 3, todayKey: THU }).current).toBe(2);
    // Three idle weekdays in one week exceed the two forgiven ones.
    expect(computeStreak(active(MON, FRI), { workdaysPerWeek: 3, todayKey: FRI }).current).toBe(1);
    expect(computeStreak(active(MON), { workdaysPerWeek: 3, todayKey: FRI }).current).toBe(0);
    // Grace resets each Monday-based week.
    expect(computeStreak(active(THU, FRI, NEXT_TUE), { workdaysPerWeek: 4, todayKey: NEXT_TUE }).current).toBe(3);
  });

  it("tracks the longest run separately from the current one", () => {
    const r = computeStreak(active(MON, TUE, WED, FRI, NEXT_MON), { workdaysPerWeek: 5, todayKey: NEXT_MON });
    expect(r.longest).toBe(3);
    expect(r.current).toBe(2);
  });

  it("ignores future days and malformed keys", () => {
    const r = computeStreak([...active(MON, TUE), { key: FRI, active: true }, { key: "not-a-date", active: true }], { workdaysPerWeek: 5, todayKey: WED });
    expect(r).toMatchObject({ current: 2, lastActiveKey: TUE });
  });

  it("defaults today to the latest day given", () => {
    expect(computeStreak(active(MON, TUE), { workdaysPerWeek: 5 }).current).toBe(2);
  });

  it("uses timezone date keys: late-evening Pacific activity counts for that Pacific day", () => {
    const tz = "America/Los_Angeles";
    // 2026-10-20T04:30Z is Monday 21:30 in Los Angeles; 2026-10-21T02:00Z is Tuesday 19:00.
    const keys = [new Date("2026-10-20T04:30:00Z"), new Date("2026-10-21T02:00:00Z")].map((d) => dateKeyInTz(d, tz));
    expect(keys).toEqual([MON, TUE]);
    expect(computeStreak(active(...keys), { workdaysPerWeek: 5, todayKey: WED }).current).toBe(2);
    // The same instants in UTC fall on Tuesday and Wednesday.
    const utc = [new Date("2026-10-20T04:30:00Z"), new Date("2026-10-21T02:00:00Z")].map((d) => dateKeyInTz(d, "UTC"));
    expect(utc).toEqual([TUE, WED]);
  });
});

describe("isActiveDay", () => {
  it("counts any real activity, including Decimal-like training hours", () => {
    expect(isActiveDay({ xpEarned: 0, applicationsSubmitted: 0 })).toBe(false);
    expect(isActiveDay({ xpEarned: 5 })).toBe(true);
    expect(isActiveDay({ followUps: 1 })).toBe(true);
    expect(isActiveDay({ trainingHours: { toString: () => "1.50" } })).toBe(true);
    expect(isActiveDay({ trainingHours: "0.00" })).toBe(false);
  });
});
