import { describe, expect, it } from "vitest";
import { STAT_DEFINITIONS, TRAINING_HOURS_GOAL, averageQuizRatio, computeDerivedStats, playerLevels, type StatInputs } from "@/lib/game/levels";
import { levelFromXp, xpForLevel } from "@/lib/game/xp-config";

const base: StatInputs = {
  interviewsAttended: 0,
  interviewsPrepped: 0,
  lessonsCompleted: 0,
  totalLessons: 31,
  quizBestRatios: [],
  resumeVersions: 0,
  resumeImprovementMissions: 0,
  followUps: 0,
  recruiterContacts: 0,
  verifiedHours: 0,
};

describe("level math", () => {
  it("xpForLevel / levelFromXp agree at the boundaries", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, current: 0 });
    const l2 = xpForLevel(2);
    expect(levelFromXp(l2 - 1).level).toBe(1);
    expect(levelFromXp(l2).level).toBe(2);
    expect(levelFromXp(xpForLevel(10)).level).toBe(10);
    const mid = levelFromXp(Math.round((xpForLevel(3) + xpForLevel(4)) / 2));
    expect(mid.level).toBe(3);
    expect(mid.progress).toBeGreaterThan(0.4);
    expect(mid.progress).toBeLessThan(0.6);
  });

  it("derives Career / Job Hunter / Electrician levels from the three XP totals", () => {
    const levels = playerLevels({ totalXp: xpForLevel(5), jobHunterXp: xpForLevel(3), electricianXp: 0 });
    expect(levels.map((l) => [l.key, l.level])).toEqual([
      ["CAREER", 5],
      ["JOB_HUNTER", 3],
      ["ELECTRICIAN", 1],
    ]);
    expect(levels[0]!.label).toBe("Career");
    expect(levels[2]!.progress).toBe(0);
  });

  it("never reports negative XP", () => {
    expect(playerLevels({ totalXp: -40, jobHunterXp: -1, electricianXp: 0 })[0]).toMatchObject({ xp: 0, level: 1 });
  });
});

describe("derived stats", () => {
  it("are all zero with no activity", () => {
    expect(computeDerivedStats(base)).toEqual({ interviewSkill: 0, technicalKnowledge: 0, resumeStrength: 0, networking: 0, trainingProgress: 0 });
  });

  it("follow the documented formulas", () => {
    const s = computeDerivedStats({
      ...base,
      interviewsAttended: 2,
      interviewsPrepped: 3,
      lessonsCompleted: 31,
      quizBestRatios: [0.5, 1],
      resumeVersions: 1,
      resumeImprovementMissions: 1,
      followUps: 5,
      recruiterContacts: 2,
      verifiedHours: 2000,
    });
    expect(s.interviewSkill).toBe(15 * 2 + 10 * 3);
    expect(s.technicalKnowledge).toBe(Math.round(60 + 40 * 0.75));
    expect(s.resumeStrength).toBe(20 + 20);
    expect(s.networking).toBe(4 * 5 + 10 * 2);
    expect(s.trainingProgress).toBe(25);
  });

  it("caps every stat at 100 and each component at its documented maximum", () => {
    const s = computeDerivedStats({
      ...base,
      interviewsAttended: 50,
      lessonsCompleted: 500,
      quizBestRatios: [3, 1],
      resumeVersions: 10,
      resumeImprovementMissions: 0,
      followUps: 100,
      recruiterContacts: 0,
      verifiedHours: TRAINING_HOURS_GOAL * 3,
    });
    expect(s.interviewSkill).toBe(100);
    expect(s.technicalKnowledge).toBe(100);
    expect(s.resumeStrength).toBe(60);
    expect(s.networking).toBe(60);
    expect(s.trainingProgress).toBe(100);
  });

  it("training progress floors (7,999 verified hours is 99 %, not 100 %)", () => {
    expect(computeDerivedStats({ ...base, verifiedHours: 7999 }).trainingProgress).toBe(99);
  });

  it("handles an empty Academy without dividing by zero", () => {
    expect(computeDerivedStats({ ...base, totalLessons: 0, lessonsCompleted: 3 }).technicalKnowledge).toBe(0);
    expect(averageQuizRatio([])).toBe(0);
  });

  it("documents a formula and an observed explanation for every stat", () => {
    expect(STAT_DEFINITIONS.map((d) => d.key)).toEqual(["interviewSkill", "technicalKnowledge", "resumeStrength", "networking", "trainingProgress"]);
    for (const d of STAT_DEFINITIONS) {
      expect(d.formula.length).toBeGreaterThan(10);
      expect(d.explain(base).length).toBeGreaterThan(5);
    }
    expect(STAT_DEFINITIONS[4]!.explain({ ...base, verifiedHours: 1234.5 })).toContain("1,234");
  });
});
