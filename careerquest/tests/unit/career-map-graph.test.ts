import { describe, expect, it } from "vitest";
import { loadCareerSeed } from "@/lib/career-map/load-seed";
import { parseCareerSeed, parseExperienceYears } from "@/lib/career-map/seed";
import {
  CAREER_NODE_KEYS,
  MAIN_PATH,
  allFacts,
  buildCareerGraph,
  containsFigure,
  topologicalOrder,
  validateCareerGraph,
} from "@/lib/career-map/graph";
import { matchesJob } from "@/lib/career-map/jobs";
import type { CareerNodeDef } from "@/lib/career-map/types";

const seed = loadCareerSeed();
const graph = buildCareerGraph(seed);
const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
const get = (k: string): CareerNodeDef => {
  const n = byKey.get(k);
  if (!n) throw new Error(`missing node ${k}`);
  return n;
};

describe("career map seed", () => {
  it("loads the real seed files without errors", () => {
    expect(seed.errors).toEqual([]);
    expect(seed.verifiedOn).toBe("2026-10-21");
    expect(seed.classifications.find((c) => c.code === "GENERAL")?.hours?.value).toBe(8000);
    expect(seed.fees.traineeRegistrationFee?.value).toBe(25);
    expect(seed.programs.length).toBeGreaterThan(0);
  });

  it("parses the C-10 experience requirement from the seed text", () => {
    expect(seed.contractor.experienceYears?.value).toBe(4);
    expect(seed.contractor.experienceYears?.sources.length).toBeGreaterThan(0);
    expect(parseExperienceYears("At least four years of experience within the last 10 years")).toBe(4);
    expect(parseExperienceYears("3 years of journey-level experience")).toBe(3);
    expect(parseExperienceYears("no figure here")).toBeNull();
  });
});

describe("career map graph integrity", () => {
  it("passes every structural and honesty check", () => {
    expect(validateCareerGraph(graph)).toEqual([]);
  });

  it("has exactly the declared nodes and every prerequisite exists", () => {
    expect(graph.nodes.map((n) => n.key).sort()).toEqual([...CAREER_NODE_KEYS].sort());
    for (const n of graph.nodes) for (const p of n.prerequisites) expect(byKey.has(p.from), `${n.key} → ${p.from}`).toBe(true);
  });

  it("is acyclic, and the main path is in prerequisite order", () => {
    const order = topologicalOrder(graph.nodes);
    expect(order).not.toBeNull();
    const pos = new Map(order!.map((k, i) => [k, i]));
    for (let i = 1; i < MAIN_PATH.length; i++) expect(pos.get(MAIN_PATH[i - 1]!)!).toBeLessThan(pos.get(MAIN_PATH[i]!)!);
  });

  it("detects cycles, unknown prerequisites, overlaps and unsourced figures", () => {
    const a = { ...get("beginner"), prerequisites: [{ from: "entry-prep", kind: "required" as const, satisfiedBy: "completed" as const }] };
    const cyclic = graph.nodes.map((n) => (n.key === "beginner" ? a : n));
    expect(validateCareerGraph({ nodes: cyclic }).join(" ")).toMatch(/cycle/);

    const unknown = graph.nodes.map((n) => (n.key === "foreman" ? { ...n, prerequisites: [{ from: "nope", kind: "required" as const, satisfiedBy: "completed" as const }] } : n));
    expect(validateCareerGraph({ nodes: unknown }).join(" ")).toMatch(/unknown prerequisite "nope"/);

    const overlap = graph.nodes.map((n) => (n.key === "foreman" ? { ...n, col: 0, row: 3 } : n));
    expect(validateCareerGraph({ nodes: overlap }).join(" ")).toMatch(/overlaps/);

    const unsourced = graph.nodes.map((n) =>
      n.key === "foreman"
        ? { ...n, requirements: [{ label: "Pay", value: "$40/hr", basis: "guidance" as const, sources: [], verifiedOn: null, flag: null }] }
        : n,
    );
    const issues = validateCareerGraph({ nodes: unsourced }).join(" ");
    expect(issues).toMatch(/guidance text contains a figure/);
    expect(issues).toMatch(/figure without a source URL/);
  });

  it("every numeric fact on the electrician path carries a source URL and a check date", () => {
    const electrician = graph.nodes.filter((n) => n.branch === "electrician");
    let numeric = 0;
    for (const n of electrician) {
      for (const f of allFacts(n)) {
        if (!containsFigure(f.value)) continue;
        numeric++;
        expect(f.basis, `${n.key} › ${f.label}`).not.toBe("guidance");
        expect(f.sources.length, `${n.key} › ${f.label}`).toBeGreaterThan(0);
        expect(f.verifiedOn, `${n.key} › ${f.label}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const s of f.sources) expect(s).toMatch(/^https?:\/\//);
      }
    }
    expect(numeric).toBeGreaterThan(15);
  });

  it("side branches are descriptions only and say so", () => {
    const side = graph.nodes.filter((n) => n.branch !== "electrician");
    expect(side.length).toBeGreaterThanOrEqual(12);
    for (const n of side) {
      expect(n.sourcedFigures).toBe(false);
      for (const f of allFacts(n)) expect(containsFigure(f.value), `${n.key} › ${f.label}`).toBe(false);
      expect(containsFigure(n.summary)).toBe(false);
      expect(allFacts(n).some((f) => /no researched figures/i.test(f.value))).toBe(true);
    }
    for (const k of ["elevator-entry", "hvac-entry", "industrial-entry", "building-entry", "construction-entry", "plumbing-entry"]) {
      expect(get(k).kind).toBe("entry");
      expect(get(k).entryRoutes.length).toBeGreaterThan(0);
    }
    // Construction project coordinator → Estimator → Assistant project manager.
    expect(get("estimator").prerequisites.map((p) => p.from)).toEqual(["project-coordinator"]);
    expect(get("assistant-pm").prerequisites.map((p) => p.from)).toEqual(["estimator"]);
  });

  it("keeps apprenticeship completion, DIR certification and the C-10 license distinct", () => {
    const appr = get("apprenticeship-completion");
    const cert = get("ca-certification");
    const c10 = get("c10-license");
    for (const n of [appr, cert, c10]) {
      expect(n.kind).toBe("credential");
      expect(n.credentialFacts.length).toBeGreaterThan(0);
    }
    expect(appr.summary).toMatch(/does not make you a DIR-certified electrician or a licensed contractor/);
    expect(c10.summary).toMatch(/separate from DIR certification/);
    // Apprenticeship completion is an alternative route to eligibility, not certification itself.
    expect(get("cert-eligibility").prereqMode).toBe("any");
    expect(get("cert-eligibility").prerequisites.map((p) => p.from).sort()).toEqual(["apprenticeship-completion", "supervised-experience"]);
    expect(c10.prerequisites.map((p) => p.from)).toEqual(["experienced-electrician"]);
    expect(graph.c10ExperienceYears).toBe(4);
    expect(c10.duration?.value).toMatch(/at least 4 years/);
    expect(graph.distinction).toHaveLength(3);
  });

  it("durations are labelled estimates", () => {
    for (const n of graph.nodes) if (n.duration) expect(n.duration.label, n.key).toBe("Estimate");
  });

  it("builds a valid graph with no invented figures when the seed is missing", () => {
    const empty = buildCareerGraph(parseCareerSeed({ facts: null, requirements: null, programs: null, research: null }, ["missing"]));
    expect(validateCareerGraph(empty)).toEqual([]);
    for (const n of empty.nodes) for (const f of allFacts(n)) expect(containsFigure(f.value), `${n.key} › ${f.label}`).toBe(false);
    expect(empty.c10ExperienceYears).toBeNull();
    expect(empty.seed.errors).toEqual(["missing"]);
  });
});

describe("job matching", () => {
  const trainee = get("trainee-or-apprentice").relevantJobs.match;
  const experienced = get("experienced-electrician").relevantJobs.match;
  const elevator = get("elevator-mechanic").relevantJobs.match;
  const elevatorEntry = get("elevator-entry").relevantJobs.match;

  it("matches apprentice/trainee titles to the trainee stop only", () => {
    expect(matchesJob("Apprentice Electrician", trainee)).toBe(true);
    expect(matchesJob("Electrical Trainee", trainee)).toBe(true);
    expect(matchesJob("Inside Wireman Apprentice", trainee)).toBe(true);
    expect(matchesJob("Pre-Apprentice Electrical Helper", trainee)).toBe(false);
    expect(matchesJob("Journeyman Electrician", trainee)).toBe(false);
  });

  it("matches journey-level titles but not entry-level or supervisory ones", () => {
    expect(matchesJob("Journeyman Electrician", experienced)).toBe(true);
    expect(matchesJob("Commercial Electrician", experienced)).toBe(true);
    expect(matchesJob("Electrician Apprentice", experienced)).toBe(false);
    expect(matchesJob("Electrical Foreman", experienced)).toBe(false);
  });

  it("splits entry-level and role titles in side branches", () => {
    expect(matchesJob("Elevator Mechanic", elevator)).toBe(true);
    expect(matchesJob("Elevator Apprentice", elevator)).toBe(false);
    expect(matchesJob("Elevator Apprentice", elevatorEntry)).toBe(true);
    expect(matchesJob("Electrician", elevator)).toBe(false);
  });
});
