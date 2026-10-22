import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { SKILLS, computeSkills, emptySkillMetrics, type SkillMetrics } from "@/lib/skills/catalog";
import { SkillTreeExplorer } from "@/components/skills/skill-tree";
import { SkillDetail } from "@/components/skills/skill-detail";
import { SkillBranchTree } from "@/components/skills/skill-branch";

const GOAL = { hours: 8000, name: "General Electrician", sources: ["https://dir.ca.gov/DLSE/ECU/1a.html"], verifiedOn: "2026-10-21" };

function metrics(): SkillMetrics {
  const m = emptySkillMetrics();
  m.tracks.FUNDAMENTALS = { completed: 3, total: 8, avgBestScore: 91 };
  m.tracks.SAFETY = { completed: 4, total: 4, avgBestScore: 95 };
  m.tracks.INSTALLATION = { completed: 0, total: 5, avgBestScore: null };
  m.tracks.SYSTEMS = { completed: 0, total: 5, avgBestScore: null };
  m.tracks.CODE = { completed: 0, total: 0, avgBestScore: null };
  m.tracks.EXAM_PREP = { completed: 0, total: 4, avgBestScore: null };
  return { ...m, fieldHoursGoal: GOAL, verifiedFieldHours: 1240, selfReportedFieldHours: 300, appliedPositions: 12, followUps: 4 };
}

const skills = computeSkills(metrics());
const byKey = new Map(skills.map((s) => [s.key, s]));

describe("skill tree renders", () => {
  it("renders every branch, skill and connector, with the detail panel", () => {
    const html = renderToStaticMarkup(createElement(SkillTreeExplorer, { skills, unlockedAt: { "electrical.safety": "2026-10-01T17:00:00.000Z" }, fieldGoal: GOAL }));
    for (const b of ["Electrical", "Field", "Job search"]) expect(html).toContain(b);
    expect((html.match(/data-skill-key=/g) ?? []).length).toBe(SKILLS.length);
    expect(html).toContain("How to level up");
    expect(html).toContain("Levels reflect your activity in CareerQuest. They are not a credential, license or certification.");
    expect(html).toContain("Level 5 <span");
    expect(html).toContain("Builds on Safety");
    // The default selection is the started skill closest to its next level.
    expect(html).toContain('aria-pressed="true"');
  });

  it("opens a requested skill from ?skill=", () => {
    const html = renderToStaticMarkup(createElement(SkillTreeExplorer, { skills, unlockedAt: {}, fieldGoal: GOAL, initialKey: "field.supervised-hours" }));
    expect(html).toContain("Supervised field hours</h2>");
    expect(html).toContain("2,000 verified field hours");
    expect(html).toContain("1,240 / 2,000");
    expect(html).toContain("8,000 hours DIR lists for General Electrician (last checked Oct 21, 2026");
  });

  it("renders the detail for every skill, including unavailable and maxed ones", () => {
    for (const s of skills) {
      const html = renderToStaticMarkup(createElement(SkillDetail, { skill: s, unlockedAt: null, fieldGoal: GOAL, onSelect: () => undefined }));
      expect(html, s.key).toContain("All levels");
      expect(html, s.key).toContain("What earns progress:");
      expect(html, s.key).toContain("Where to work on it");
      expect(html, s.key).toContain(`Level ${s.level} of 5`);
    }
    const code = renderToStaticMarkup(createElement(SkillDetail, { skill: byKey.get("electrical.code")!, unlockedAt: null, fieldGoal: GOAL, onSelect: () => undefined }));
    expect(code).toContain("No lessons are available in this track right now.");
    const safety = renderToStaticMarkup(createElement(SkillDetail, { skill: byKey.get("electrical.safety")!, unlockedAt: "2026-10-01T17:00:00.000Z", fieldGoal: GOAL, onSelect: () => undefined }));
    expect(safety).toContain("You reached the top level");
    expect(safety).toContain("First reached level 1 on Oct 1, 2026");
  });

  it("draws one connector per in-branch prerequisite", () => {
    const electrical = skills.filter((s) => s.branch === "electrical");
    const html = renderToStaticMarkup(createElement(SkillBranchTree, { skills: electrical, selectedKey: "electrical.safety", onSelect: () => undefined, external: new Map() }));
    const edges = electrical.reduce((a, s) => a + s.prerequisites.filter((p) => p.key.startsWith("electrical.")).length, 0);
    expect((html.match(/vector-effect="non-scaling-stroke"/g) ?? []).length).toBe(edges);
    expect(html).toContain("Start with Installation");
  });
});
