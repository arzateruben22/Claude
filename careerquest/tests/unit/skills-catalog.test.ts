import { describe, expect, it } from "vitest";
import {
  MAX_SKILL_LEVEL,
  SKILLS,
  computeSkills,
  emptySkillMetrics,
  evaluateSkill,
  fieldThresholds,
  trackThresholds,
  validateSkillCatalog,
  type SkillMetrics,
} from "@/lib/skills/catalog";

const GOAL = { hours: 8000, name: "General Electrician", sources: ["https://dir.ca.gov/DLSE/ECU/1a.html"], verifiedOn: "2026-10-21" };

function metrics(over: Partial<SkillMetrics> = {}, tracks: Partial<SkillMetrics["tracks"]> = {}): SkillMetrics {
  const m = emptySkillMetrics();
  m.tracks.FUNDAMENTALS = { completed: 0, total: 8, avgBestScore: null };
  m.tracks.SAFETY = { completed: 0, total: 4, avgBestScore: null };
  m.tracks.INSTALLATION = { completed: 0, total: 5, avgBestScore: null };
  m.tracks.SYSTEMS = { completed: 0, total: 5, avgBestScore: null };
  m.tracks.CODE = { completed: 0, total: 5, avgBestScore: null };
  m.tracks.EXAM_PREP = { completed: 0, total: 4, avgBestScore: null };
  Object.assign(m.tracks, tracks);
  return { ...m, fieldHoursGoal: GOAL, ...over };
}

const skill = (key: string) => {
  const d = SKILLS.find((s) => s.key === key);
  if (!d) throw new Error(`no skill ${key}`);
  return d;
};
const level = (key: string, m: SkillMetrics) => evaluateSkill(skill(key), m).level;

describe("skill catalog integrity", () => {
  it("covers the electrical, field and job-search skills with valid prerequisites", () => {
    expect(validateSkillCatalog(SKILLS, metrics())).toEqual([]);
    expect(SKILLS.map((s) => s.key)).toEqual([
      "electrical.fundamentals",
      "electrical.safety",
      "electrical.systems",
      "electrical.installation",
      "electrical.code",
      "electrical.exam-prep",
      "field.supervised-hours",
      "jobs.applications",
      "jobs.resume",
      "jobs.interviewing",
      "jobs.networking",
      "jobs.negotiation",
    ]);
    for (const s of SKILLS) {
      expect(s.links.length, s.key).toBeGreaterThan(0);
      expect(s.earns.length, s.key).toBeGreaterThan(20);
    }
  });

  it("detects cycles, unknown prerequisites and overlaps", () => {
    const cyclic = SKILLS.map((s) => (s.key === "electrical.fundamentals" ? { ...s, prerequisites: ["electrical.exam-prep"] } : s));
    expect(validateSkillCatalog(cyclic, metrics()).join(" ")).toMatch(/cycle/);
    const unknown = SKILLS.map((s) => (s.key === "jobs.resume" ? { ...s, prerequisites: ["nope"] } : s));
    expect(validateSkillCatalog(unknown, metrics()).join(" ")).toMatch(/unknown prerequisite "nope"/);
    const overlap = SKILLS.map((s) => (s.key === "jobs.resume" ? { ...s, col: 0 } : s));
    expect(validateSkillCatalog(overlap, metrics()).join(" ")).toMatch(/overlaps/);
  });

  it("level thresholds are nested: meeting level N always meets level N-1", () => {
    const samples: SkillMetrics[] = [];
    for (let i = 0; i < 200; i++) {
      const r = (max: number) => Math.floor(Math.random() * max);
      samples.push(
        metrics(
          {
            verifiedFieldHours: r(9000),
            appliedPositions: r(120),
            resumeVersions: r(7),
            applicationsWithResume: r(30),
            interviewsCompleted: r(12),
            interviewPreps: r(10),
            followUps: r(70),
            offersRecorded: r(3),
            offersAccepted: r(2),
            salaryPrep: r(2),
          },
          { FUNDAMENTALS: { completed: r(9), total: 8, avgBestScore: 70 + r(31) }, CODE: { completed: r(6), total: 5, avgBestScore: 80 + r(21) } },
        ),
      );
    }
    for (const m of samples) {
      for (const d of SKILLS) {
        const levels = evaluateSkill(d, m).levels;
        expect(levels).toHaveLength(MAX_SKILL_LEVEL);
        for (let i = 1; i < levels.length; i++) if (levels[i]!.met) expect(levels[i - 1]!.met, `${d.key} L${i + 1}`).toBe(true);
      }
    }
  });
});

describe("skill thresholds", () => {
  it("track thresholds are 1, a third, two thirds and all lessons", () => {
    expect(trackThresholds(8)).toEqual([1, 3, 6, 8]);
    expect(trackThresholds(5)).toEqual([1, 2, 4, 5]);
    expect(trackThresholds(4)).toEqual([1, 2, 3, 4]);
    expect(trackThresholds(1)).toEqual([1, 1, 1, 1]);
  });

  it("track skills level from completions, and level 5 needs a 90% average best score", () => {
    const at = (completed: number, avg: number | null) => level("electrical.fundamentals", metrics({}, { FUNDAMENTALS: { completed, total: 8, avgBestScore: avg } }));
    expect(at(0, null)).toBe(0);
    expect(at(1, 85)).toBe(1);
    expect(at(2, 85)).toBe(1);
    expect(at(3, 85)).toBe(2);
    expect(at(6, 85)).toBe(3);
    expect(at(8, 89)).toBe(4);
    expect(at(8, 90)).toBe(5);
    const v = evaluateSkill(skill("electrical.fundamentals"), metrics({}, { FUNDAMENTALS: { completed: 4, total: 8, avgBestScore: 92 } }));
    expect(v.next?.level).toBe(3);
    expect(v.next?.requirements).toEqual([expect.objectContaining({ label: "Complete 6 of 8 lessons", current: 4, target: 6, met: false })]);
    expect(v.progressToNext).toBeCloseTo(4 / 6);
    expect(v.points).toBe(266);
  });

  it("a track with no lessons is unavailable", () => {
    const v = evaluateSkill(skill("electrical.code"), metrics({}, { CODE: { completed: 0, total: 0, avgBestScore: null } }));
    expect(v.unavailable).toMatch(/No lessons/);
    expect(v.level).toBe(0);
    expect(v.next).toBeNull();
  });

  it("field brackets are fractions of the DIR hour requirement; self-reported hours never count", () => {
    expect(fieldThresholds(8000)).toEqual([1, 1000, 2000, 4000, 8000]);
    const at = (verified: number, self = 0) => level("field.supervised-hours", metrics({ verifiedFieldHours: verified, selfReportedFieldHours: self }));
    expect(at(0, 5000)).toBe(0);
    expect(at(1)).toBe(1);
    expect(at(999)).toBe(1);
    expect(at(1000)).toBe(2);
    expect(at(2000)).toBe(3);
    expect(at(4000)).toBe(4);
    expect(at(8000)).toBe(5);
    const v = evaluateSkill(skill("field.supervised-hours"), metrics({ verifiedFieldHours: 8000 }));
    expect(v.levels[4]!.requirements[0]!.label).toBe("8,000 verified field hours (the General Electrician requirement)");
    const noGoal = evaluateSkill(skill("field.supervised-hours"), metrics({ verifiedFieldHours: 9000, fieldHoursGoal: null }));
    expect(noGoal.level).toBe(0);
    expect(noGoal.unavailable).toMatch(/could not be loaded/);
  });

  it("job-search skills use their activity thresholds", () => {
    const apps = (n: number) => level("jobs.applications", metrics({ appliedPositions: n }));
    expect([0, 1, 9, 10, 25, 50, 99, 100].map(apps)).toEqual([0, 1, 1, 2, 3, 4, 4, 5]);

    const resume = (v: number, sent: number) => level("jobs.resume", metrics({ resumeVersions: v, applicationsWithResume: sent }));
    expect(resume(1, 0)).toBe(1);
    expect(resume(3, 9)).toBe(3);
    expect(resume(3, 10)).toBe(4);
    expect(resume(5, 24)).toBe(4);
    expect(resume(5, 25)).toBe(5);

    const interviewing = (preps: number, done: number) => level("jobs.interviewing", metrics({ interviewPreps: preps, interviewsCompleted: done }));
    expect(interviewing(0, 1)).toBe(1);
    expect(interviewing(1, 0)).toBe(1);
    expect(interviewing(1, 1)).toBe(2);
    expect(interviewing(3, 3)).toBe(3);
    expect(interviewing(8, 9)).toBe(4);
    expect(interviewing(8, 10)).toBe(5);

    const follow = (n: number) => level("jobs.networking", metrics({ followUps: n }));
    expect([0, 1, 5, 15, 30, 60].map(follow)).toEqual([0, 1, 2, 3, 4, 5]);

    const neg = (prep: number, offers: number, accepted = 0) => level("jobs.negotiation", metrics({ salaryPrep: prep, offersRecorded: offers, offersAccepted: accepted }));
    expect(neg(0, 0)).toBe(0);
    expect(neg(1, 0)).toBe(1);
    expect(neg(0, 1)).toBe(2);
    expect(neg(1, 1)).toBe(3);
    expect(neg(1, 2)).toBe(4);
    expect(neg(1, 2, 1)).toBe(5);
  });

  it("marks level-0 skills with an unstarted prerequisite as locked (activity still counts)", () => {
    const views = computeSkills(metrics({ interviewsCompleted: 1 }));
    const byKey = new Map(views.map((v) => [v.key, v]));
    expect(byKey.get("electrical.installation")!.locked).toBe(true);
    expect(byKey.get("electrical.fundamentals")!.locked).toBe(false);
    // Interviewing counts even though Applications is still level 0.
    expect(byKey.get("jobs.interviewing")!.level).toBe(1);
    expect(byKey.get("jobs.interviewing")!.locked).toBe(false);
    expect(byKey.get("jobs.interviewing")!.prerequisites).toEqual([
      { key: "jobs.applications", title: "Applications", level: 0 },
      { key: "jobs.resume", title: "Résumé", level: 0 },
    ]);
    const max = computeSkills(metrics({ appliedPositions: 150 })).find((v) => v.key === "jobs.applications")!;
    expect(max.level).toBe(5);
    expect(max.next).toBeNull();
    expect(max.points).toBe(500);
    expect(max.progressToNext).toBe(1);
  });
});
