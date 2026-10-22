import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_KEY,
  achievementStatus,
  annualize,
  bestWeekWorkdays,
  satisfiedAchievementKeys,
  type AchievementFacts,
} from "@/lib/game/achievement-catalog";
import { dateFromKey, dateKey, startOfWeekUtc } from "@/lib/dates";
import { isScheduledWorkday } from "@/lib/game/streak";
import { countDistinctPositions, positionKey } from "@/lib/game/positions";

const none: AchievementFacts = {
  distinctApplications: 0,
  recruiterResponses: 0,
  interviews: 0,
  verifiedOffers: 0,
  careerEarnings: 0,
  acceptedPrograms: 0,
  verifiedHours: 0,
  fundamentalsCompleted: 0,
  fundamentalsTotal: 8,
  certifiedWithDocument: false,
  annualizedSalary: null,
  bestWeekWorkdays: 0,
  longestStreak: 0,
};

const unlocked = (f: Partial<AchievementFacts>) => satisfiedAchievementKeys({ ...none, ...f });

describe("achievement catalog", () => {
  it("has unique keys and covers every required achievement", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(
      expect.arrayContaining([
        "first-application",
        "ten-applications",
        "fifty-applications",
        "applications-100",
        "applications-250",
        "applications-500",
        "applications-1000",
        "applications-2500",
        "applications-5000",
        "applications-10000",
        "first-recruiter-response",
        "first-interview",
        "first-job-offer",
        "first-paycheck",
        "apprenticeship-accepted",
        "verified-hours-1000",
        "electrical-fundamentals",
        "certified-electrician",
        "six-figure-career",
        "career-150k",
        "week-warrior",
        "streak-7",
        "streak-30",
      ]),
    );
    for (const a of ACHIEVEMENTS) {
      expect(a.title).toBeTruthy();
      expect(a.condition).toBeTruthy();
      expect(a.facts.length).toBeGreaterThan(0);
    }
  });

  it("unlocks nothing without activity", () => {
    expect(unlocked({})).toEqual([]);
  });

  it("application milestones use distinct positions", () => {
    expect(unlocked({ distinctApplications: 1 })).toEqual(["first-application"]);
    expect(unlocked({ distinctApplications: 9 })).toEqual(["first-application"]);
    expect(unlocked({ distinctApplications: 10 })).toEqual(["first-application", "ten-applications"]);
    expect(unlocked({ distinctApplications: 1000 })).toEqual(
      expect.arrayContaining(["fifty-applications", "applications-100", "applications-250", "applications-500", "applications-1000"]),
    );
    expect(unlocked({ distinctApplications: 1000 })).not.toContain("applications-2500");
  });

  it("first job offer requires a verified offer", () => {
    expect(unlocked({ verifiedOffers: 0 })).not.toContain("first-job-offer");
    expect(unlocked({ verifiedOffers: 1 })).toContain("first-job-offer");
  });

  it("training hours, certification and Fundamentals follow the honesty rules", () => {
    expect(unlocked({ verifiedHours: 999.9 })).not.toContain("verified-hours-1000");
    expect(unlocked({ verifiedHours: 1000 })).toContain("verified-hours-1000");
    expect(unlocked({ certifiedWithDocument: false })).not.toContain("certified-electrician");
    expect(unlocked({ certifiedWithDocument: true })).toContain("certified-electrician");
    expect(ACHIEVEMENT_BY_KEY.get("certified-electrician")?.label).toBe("Self-attested with document");
    expect(unlocked({ fundamentalsCompleted: 7, fundamentalsTotal: 8 })).not.toContain("electrical-fundamentals");
    expect(unlocked({ fundamentalsCompleted: 8, fundamentalsTotal: 8 })).toContain("electrical-fundamentals");
    // An Academy without Fundamentals content can never unlock it.
    expect(unlocked({ fundamentalsCompleted: 0, fundamentalsTotal: 0 })).not.toContain("electrical-fundamentals");
  });

  it("salary milestones use the annualized accepted offer or self-reported salary", () => {
    expect(annualize(50, "HOURLY", 40)).toBe(104_000);
    expect(annualize(72.12, "HOURLY", 40)).toBeCloseTo(150_009.6, 2);
    expect(annualize(95_000, "ANNUAL")).toBe(95_000);
    expect(annualize(-1, "ANNUAL")).toBe(0);
    expect(unlocked({ annualizedSalary: 99_999 })).not.toContain("six-figure-career");
    expect(unlocked({ annualizedSalary: annualize(50, "HOURLY", 40) })).toEqual(["six-figure-career"]);
    expect(unlocked({ annualizedSalary: annualize(72.12, "HOURLY", 40) })).toEqual(["six-figure-career", "career-150k"]);
  });

  it("paycheck, apprenticeship, responses, interviews and streaks", () => {
    expect(unlocked({ careerEarnings: 0.01 })).toEqual(["first-paycheck"]);
    expect(unlocked({ acceptedPrograms: 1 })).toEqual(["apprenticeship-accepted"]);
    expect(unlocked({ recruiterResponses: 3 })).toEqual(["first-recruiter-response"]);
    expect(unlocked({ interviews: 1 })).toEqual(["first-interview"]);
    expect(unlocked({ longestStreak: 6 })).toEqual([]);
    expect(unlocked({ longestStreak: 7 })).toEqual(["streak-7"]);
    expect(unlocked({ longestStreak: 30 })).toEqual(["streak-7", "streak-30"]);
    expect(unlocked({ bestWeekWorkdays: 5 })).toEqual(["week-warrior"]);
  });

  it("locked cards report progress toward the condition", () => {
    const st = achievementStatus(ACHIEVEMENT_BY_KEY.get("ten-applications")!, { ...none, distinctApplications: 4 });
    expect(st).toMatchObject({ current: 4, target: 10, unlocked: false });
    expect(st.ratio).toBeCloseTo(0.4);
    const hours = achievementStatus(ACHIEVEMENT_BY_KEY.get("verified-hours-1000")!, { ...none, verifiedHours: 250.75 });
    expect(hours).toMatchObject({ current: 250, target: 1000 });
  });
});

describe("Week Warrior", () => {
  const isWorkday = (k: string) => isScheduledWorkday(dateFromKey(k), 5);
  const weekOf = (k: string) => dateKey(startOfWeekUtc(dateFromKey(k)));

  it("needs five workdays inside one Monday–Sunday week", () => {
    expect(bestWeekWorkdays(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"], isWorkday, weekOf)).toBe(5);
  });

  it("does not combine days across weeks or count weekend days", () => {
    expect(bestWeekWorkdays(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27"], isWorkday, weekOf)).toBe(3);
    expect(bestWeekWorkdays(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-24", "2026-10-25"], isWorkday, weekOf)).toBe(3);
  });
});

describe("position identity", () => {
  it("treats the same company + title + location as one position", () => {
    const a = { normalizedCompany: "acme electric", normalizedTitle: "apprentice electrician", location: "Anaheim, CA" };
    const b = { ...a, location: "anaheim ca" };
    const c = { ...a, location: "Irvine, CA" };
    expect(positionKey(a)).toBe(positionKey(b));
    expect(countDistinctPositions([a, b, c])).toBe(2);
  });
});
