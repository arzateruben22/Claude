import { describe, expect, it } from "vitest";
import { loadCareerSeed } from "@/lib/career-map/load-seed";
import { buildCareerGraph, CAREER_NODE_KEYS } from "@/lib/career-map/graph";
import { currentPosition, deriveCareerMap, formatMonths, monthsBetween, type CareerUserData, type CertificationRow } from "@/lib/career-map/status";
import { canvasSize, edgePath, MAP_LAYOUT, nodeOrigin, readingOrder, spatialNeighbor } from "@/lib/career-map/navigation";
import type { CareerMapView } from "@/lib/career-map/types";

const graph = buildCareerGraph(loadCareerSeed());
const NOW = new Date("2026-10-22T19:00:00Z");
const TZ = "America/Los_Angeles";

const CATALOG: CareerUserData["lessons"]["catalog"] = [
  { key: "f1", track: "FUNDAMENTALS" },
  { key: "f2", track: "FUNDAMENTALS" },
  { key: "s1", track: "SAFETY" },
  { key: "i1", track: "INSTALLATION" },
  { key: "e1", track: "EXAM_PREP" },
];

function data(over: Partial<CareerUserData> = {}): CareerUserData {
  return {
    now: NOW,
    timezone: TZ,
    profile: null,
    programs: [],
    certifications: [],
    hours: { verifiedOjt: 0, selfReportedOjt: 0, verifiedClassroom: 0, selfReportedClassroom: 0, recentVerifiedOjt: 0, recentWindowDays: 84, entryCount: 0 },
    lessons: { catalog: CATALOG, progress: [] },
    practiceExams: { attempts: 0, passed: 0, bestPercent: null },
    applications: [],
    documents: {},
    overrides: [],
    ...over,
  };
}

function cert(over: Partial<CertificationRow> = {}): CertificationRow {
  return {
    classification: "GENERAL",
    traineeRegisteredAt: null,
    traineeExpiresAt: null,
    schoolEnrolled: null,
    examApplicationAt: null,
    examEligibleAt: null,
    examScheduledAt: null,
    examPassedAt: null,
    certifiedAt: null,
    certificateExpiresAt: null,
    updatedAt: NOW,
    ...over,
  };
}

const profile = (over: Partial<NonNullable<CareerUserData["profile"]>> = {}) => ({
  primaryTrade: "ELECTRICIAN",
  careerInterests: [] as string[],
  onboardingCompletedAt: new Date("2026-09-01T17:00:00Z"),
  ...over,
});

const app = (id: string, title: string, status: CareerUserData["applications"][number]["status"] = "SUBMITTED") => ({
  id,
  title,
  category: null,
  company: `${title} Co`,
  status,
  applied: status !== "SAVED" && status !== "PREPARING",
});

const node = (view: CareerMapView, key: string) => {
  const n = view.nodes.find((x) => x.key === key);
  if (!n) throw new Error(`no node ${key}`);
  return n.state;
};

describe("career map status derivation", () => {
  it("a brand-new user sees the start available and later stops locked", () => {
    const v = deriveCareerMap(graph, data());
    expect(v.nodes).toHaveLength(CAREER_NODE_KEYS.length);
    expect(node(v, "beginner").status).toBe("AVAILABLE");
    expect(node(v, "beginner").reason).toBe("Available: nothing blocks this step");
    expect(node(v, "entry-prep").status).toBe("AVAILABLE");
    expect(node(v, "trainee-or-apprentice").status).toBe("AVAILABLE");
    expect(node(v, "supervised-experience").status).toBe("LOCKED");
    expect(node(v, "supervised-experience").reason).toBe("Locked because: Electrician Trainee or Apprentice is not completed yet");
    expect(node(v, "supervised-experience").blockedBy.map((b) => b.key)).toEqual(["trainee-or-apprentice"]);
    expect(node(v, "cert-eligibility").reason).toMatch(/^Locked until one of these is completed: Supervised experience or Apprenticeship completion/);
    expect(node(v, "c10-license").status).toBe("LOCKED");
    expect(node(v, "elevator-entry").status).toBe("AVAILABLE");
    expect(node(v, "elevator-mechanic").status).toBe("LOCKED");
    expect(v.counts.COMPLETED).toBe(0);
    expect(v.currentKey).toBe("beginner");
    expect(v.focusBranch).toBe("electrician");
    expect(node(v, "beginner").actions[0]?.href).toBe("/settings/onboarding");
  });

  it("explains in-progress hours with verified vs self-reported evidence and a pace estimate", () => {
    const v = deriveCareerMap(
      graph,
      data({
        profile: profile(),
        certifications: [cert({ traineeRegisteredAt: new Date("2026-01-10T18:00:00Z"), traineeExpiresAt: new Date("2027-01-10T18:00:00Z"), schoolEnrolled: "Approved School" })],
        hours: { verifiedOjt: 1240, selfReportedOjt: 300, verifiedClassroom: 0, selfReportedClassroom: 40, recentVerifiedOjt: 480, recentWindowDays: 84, entryCount: 40 },
      }),
    );
    expect(node(v, "beginner").status).toBe("COMPLETED");
    expect(node(v, "entry-prep").status).toBe("COMPLETED");
    const trainee = node(v, "trainee-or-apprentice");
    expect(trainee.status).toBe("COMPLETED");
    expect(trainee.reason).toBe("Completed because: Registered as an Electrician Trainee on Jan 10, 2026 (registration runs to Jan 10, 2027)");
    const sup = node(v, "supervised-experience");
    expect(sup.status).toBe("IN_PROGRESS");
    expect(sup.reason).toBe("In progress because: 1,240 verified hours of 8,000 (General Electrician)");
    expect(sup.progress).toMatchObject({ value: 1240, max: 8000, basis: "Verified" });
    expect(sup.evidence.map((e) => e.label)).toEqual(["Verified", "Self-reported", "Self-reported"]);
    expect(sup.evidence[1]!.text).toMatch(/300 self-reported hours are logged but do not count until they are verified/);
    expect(sup.evidence[2]!.text).toMatch(/40 classroom hours/);
    expect(sup.durationEstimate?.label).toBe("Estimate");
    // 480 verified hours over 12 weeks = 40 h/week; 6,760 remaining → 169 weeks.
    expect(sup.durationEstimate?.text).toMatch(/About 169 weeks .* 40\.0 hours a week over the last 12 weeks/);
    expect(sup.actions[0]?.label).toBe("Get your self-reported hours verified");
    expect(node(v, "cert-eligibility").status).toBe("LOCKED");
    expect(v.currentKey).toBe("supervised-experience");
  });

  it("completing the hours unlocks certification eligibility with the DIR link as next action", () => {
    const v = deriveCareerMap(
      graph,
      data({
        profile: profile(),
        certifications: [cert({ traineeRegisteredAt: new Date("2022-01-10T18:00:00Z") })],
        hours: { verifiedOjt: 8010, selfReportedOjt: 0, verifiedClassroom: 720, selfReportedClassroom: 0, recentVerifiedOjt: 400, recentWindowDays: 84, entryCount: 900 },
      }),
    );
    expect(node(v, "supervised-experience").status).toBe("COMPLETED");
    expect(node(v, "supervised-experience").reason).toBe("Completed because: 8,010 verified hours of 8,000 required (General Electrician)");
    expect(node(v, "supervised-experience").durationEstimate).toBeNull();
    const elig = node(v, "cert-eligibility");
    expect(elig.status).toBe("AVAILABLE");
    expect(elig.reason).toBe("Available because: Supervised experience is completed");
    expect(elig.actions[0]?.external).toBe(true);
    expect(elig.actions[0]?.href).toMatch(/^https:\/\/www\.dir\.ca\.gov\//);
    expect(v.currentKey).toBe("cert-eligibility");
  });

  it("uses the hour requirement of the classification on the user's tracker", () => {
    const v = deriveCareerMap(graph, data({ certifications: [cert({ classification: "RESIDENTIAL", traineeRegisteredAt: new Date("2025-01-01T00:00:00Z") })], hours: { ...data().hours, verifiedOjt: 100 } }));
    expect(node(v, "supervised-experience").reason).toBe("In progress because: 100 verified hours of 4,800 (Residential Electrician)");
  });

  it("an apprenticeship acceptance shows completion in progress; a user mark wins and is labelled", () => {
    const programs = [{ slug: "ibew-11-eti", name: "ETI", status: "ACCEPTED" as const }];
    const before = deriveCareerMap(graph, data({ profile: profile(), programs }));
    expect(node(before, "trainee-or-apprentice").status).toBe("COMPLETED");
    const appr = node(before, "apprenticeship-completion");
    expect(appr.status).toBe("IN_PROGRESS");
    expect(appr.reason).toBe("In progress because: Accepted into ETI — completion is confirmed by your program");
    expect(appr.notes.join(" ")).toMatch(/no record for apprenticeship completion/);
    expect(appr.actions[0]?.href).toBe("#career-node-mark");

    const marked = deriveCareerMap(
      graph,
      data({ profile: profile(), programs, overrides: [{ nodeKey: "apprenticeship-completion", status: "COMPLETED", notes: "Completion letter received", updatedAt: NOW }] }),
    );
    const m = node(marked, "apprenticeship-completion");
    expect(m.status).toBe("COMPLETED");
    expect(m.derivedStatus).toBe("IN_PROGRESS");
    expect(m.reason).toBe("Marked by you: Completed");
    expect(m.derivedReason).toMatch(/^In progress because: Accepted into ETI/);
    expect(m.override).toMatchObject({ status: "COMPLETED", notes: "Completion letter received" });
    expect(m.evidence[0]).toMatchObject({ label: "Marked by you" });
    expect(m.evidence[0]!.text).toMatch(/not a credential/);
    // The user's mark satisfies the "any" prerequisite of certification eligibility.
    expect(node(marked, "cert-eligibility").status).toBe("AVAILABLE");
    expect(node(marked, "cert-eligibility").reason).toBe("Available because: Apprenticeship completion (journeyman) is completed");
    // …but certification itself still needs its own evidence.
    expect(node(marked, "ca-certification").status).toBe("LOCKED");
  });

  it("certification dates drive eligibility, certification and journey-level time", () => {
    const certifiedAt = new Date("2024-07-15T17:00:00Z");
    const v = deriveCareerMap(
      graph,
      data({
        profile: profile(),
        certifications: [cert({ examEligibleAt: new Date("2024-03-01T17:00:00Z"), examPassedAt: new Date("2024-06-20T17:00:00Z"), certifiedAt, certificateExpiresAt: new Date("2027-07-15T17:00:00Z") })],
        documents: { CERTIFICATE: 1 },
        practiceExams: { attempts: 3, passed: 2, bestPercent: 84 },
      }),
    );
    expect(node(v, "cert-eligibility").status).toBe("COMPLETED");
    const ca = node(v, "ca-certification");
    expect(ca.status).toBe("COMPLETED");
    expect(ca.reason).toBe("Completed because: Certified as General Electrician on Jul 15, 2024, valid to Jul 15, 2027 (certification tracker)");
    expect(ca.evidence.some((e) => /1 certificate document uploaded/.test(e.text))).toBe(true);
    expect(ca.evidence.some((e) => /best score 84% \(CareerQuest practice, not the DIR exam\)/.test(e.text))).toBe(true);
    expect(ca.documentsOnFile).toEqual([{ label: "Certification card", onFile: true }]);
    const exp = node(v, "experienced-electrician");
    expect(exp.status).toBe("IN_PROGRESS");
    expect(exp.reason).toMatch(/about 2 years 3 months at journey level \(estimated from your certification date\)/);
    expect(node(v, "foreman").status).toBe("AVAILABLE");
    expect(node(v, "foreman").reason).toBe("Available because: Experienced electrician (journey level) has started");
    const c10 = node(v, "c10-license");
    expect(c10.status).toBe("AVAILABLE");
    expect(c10.progress).toMatchObject({ value: 27, max: 48, basis: "Estimate" });
    expect(c10.progress?.label).toBe("2 years 3 months of 4 years since your certification date");
    expect(v.currentKey).toBe("experienced-electrician");
  });

  it("expired registrations and certificates are flagged for renewal, not counted as done", () => {
    const trainee = deriveCareerMap(graph, data({ certifications: [cert({ traineeRegisteredAt: new Date("2024-01-01T00:00:00Z"), traineeExpiresAt: new Date("2025-01-01T00:00:00Z") })] }));
    const t = node(trainee, "trainee-or-apprentice");
    expect(t.status).toBe("IN_PROGRESS");
    expect(t.reason).toMatch(/expired on Dec 31, 2024 — renew it/);
    expect(t.actions[0]?.external).toBe(true);
    expect(t.actions[0]?.href).toMatch(/Renew/i);

    const certified = deriveCareerMap(
      graph,
      data({
        certifications: [
          cert({ traineeRegisteredAt: new Date("2018-01-01T00:00:00Z"), traineeExpiresAt: new Date("2019-01-01T00:00:00Z"), certifiedAt: new Date("2021-01-01T00:00:00Z"), certificateExpiresAt: new Date("2024-01-01T00:00:00Z") }),
        ],
      }),
    );
    // Once certified, an old trainee card is history, not a renewal task.
    expect(node(certified, "trainee-or-apprentice").status).toBe("COMPLETED");
    expect(node(certified, "trainee-or-apprentice").reason).toBe("Completed because: Your certification tracker shows exam eligibility or a later step");
    const ca = node(certified, "ca-certification");
    expect(ca.status).toBe("IN_PROGRESS");
    expect(ca.reason).toMatch(/General Electrician certification expired on Dec 31, 2023 — renewal needed/);
    expect(ca.actions[0]?.label).toBe("Review renewal requirements");
    expect(node(certified, "experienced-electrician").status).toBe("LOCKED");
    expect(node(certified, "supervised-experience").notes.join(" ")).toMatch(/cannot tell which route you qualified through/);
  });

  it("exam application and eligibility notice move eligibility and certification forward", () => {
    const applied = deriveCareerMap(graph, data({ certifications: [cert({ examApplicationAt: new Date("2026-10-01T17:00:00Z") })] }));
    expect(node(applied, "cert-eligibility").status).toBe("IN_PROGRESS");
    expect(node(applied, "cert-eligibility").reason).toMatch(/Exam application submitted on Oct 1, 2026/);
    const eligible = deriveCareerMap(graph, data({ certifications: [cert({ examEligibleAt: new Date("2026-10-10T17:00:00Z") })] }));
    expect(node(eligible, "cert-eligibility").status).toBe("COMPLETED");
    expect(node(eligible, "ca-certification").status).toBe("IN_PROGRESS");
    expect(node(eligible, "ca-certification").reason).toMatch(/Eligibility notice received on Oct 10, 2026/);
  });

  it("applications to related roles count as activity; a locked role stays locked until it is reachable", () => {
    const v = deriveCareerMap(
      graph,
      data({
        applications: [app("a1", "Apprentice Electrician"), app("a2", "Electrical Foreman"), app("a3", "Elevator Mechanic", "HIRED"), app("a4", "Inside Wireman Apprentice", "INTERVIEWING")],
      }),
    );
    const t = node(v, "trainee-or-apprentice");
    expect(t.status).toBe("IN_PROGRESS");
    expect(t.reason).toBe("In progress because: Applied to 2 apprentice or trainee jobs (1 interviewing) in your tracker");
    expect(t.applications).toMatchObject({ applied: 2, interviewing: 1, hired: 0, href: "/applications?q=apprentice" });
    const foreman = node(v, "foreman");
    expect(foreman.status).toBe("LOCKED");
    expect(foreman.evidence.some((e) => /Applied to 1 foreman or lead role/.test(e.text))).toBe(true);
    expect(node(v, "elevator-mechanic").status).toBe("COMPLETED");
    expect(node(v, "elevator-mechanic").reason).toBe("Completed because: Hired: Elevator Mechanic at Elevator Mechanic Co (from your application tracker)");
    expect(node(v, "elevator-entry").status).toBe("COMPLETED");
  });

  it("lesson progress feeds training progress and entry preparation", () => {
    const v = deriveCareerMap(
      graph,
      data({
        lessons: {
          catalog: CATALOG,
          progress: [
            { lessonKey: "f1", status: "COMPLETED", bestScore: 90 },
            { lessonKey: "s1", status: "COMPLETED", bestScore: 85 },
            { lessonKey: "f2", status: "IN_PROGRESS", bestScore: 60 },
          ],
        },
      }),
    );
    const e = node(v, "entry-prep");
    expect(e.status).toBe("IN_PROGRESS");
    expect(e.reason).toBe("In progress because: 2 of 3 Fundamentals and Safety lessons completed");
    expect(e.training).toEqual([
      { key: "FUNDAMENTALS", label: "Electrical fundamentals", completed: 1, total: 2, href: "/academy#track-fundamentals" },
      { key: "SAFETY", label: "Safety", completed: 1, total: 1, href: "/academy#track-safety" },
    ]);
    expect(node(v, "beginner").status).toBe("IN_PROGRESS");
  });

  it("a side-branch primary trade becomes the focus branch and current position", () => {
    const v = deriveCareerMap(graph, data({ profile: profile({ primaryTrade: "COMMERCIAL_HVAC", careerInterests: ["Building engineer"] }) }));
    expect(v.focusBranch).toBe("hvac");
    const entry = node(v, "hvac-entry");
    expect(entry.status).toBe("IN_PROGRESS");
    expect(entry.reason).toBe("In progress because: Your primary trade is Commercial HVAC (Settings)");
    expect(entry.interest).toBe("primary");
    expect(node(v, "commercial-hvac").status).toBe("AVAILABLE");
    expect(node(v, "building-entry").interest).toBe("interest");
    expect(node(v, "building-entry").notes.join(" ")).toMatch(/on your interest list/);
    expect(v.currentKey).toBe("hvac-entry");
  });

  it("logged hours without a recorded registration are shown, with a prompt to record it", () => {
    const v = deriveCareerMap(graph, data({ hours: { ...data().hours, verifiedOjt: 200 } }));
    expect(node(v, "supervised-experience").status).toBe("IN_PROGRESS");
    expect(node(v, "trainee-or-apprentice").status).toBe("AVAILABLE");
    expect(node(v, "trainee-or-apprentice").notes.join(" ")).toMatch(/no trainee registration or program acceptance is recorded/);
    expect(node(v, "beginner").status).toBe("COMPLETED");
  });

  it("current position falls back to the last completed stop", () => {
    const v = deriveCareerMap(graph, data());
    const allDone = v.nodes.map((n) => ({ ...n, state: { ...n.state, status: "COMPLETED" as const } }));
    expect(currentPosition(allDone, "electrician")).toBe("experienced-electrician");
  });
});

describe("career map helpers", () => {
  it("formats months and counts whole months", () => {
    expect(formatMonths(0)).toBe("0 months");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(12)).toBe("1 year");
    expect(formatMonths(27)).toBe("2 years 3 months");
    expect(monthsBetween(new Date("2024-07-15T00:00:00Z"), new Date("2026-10-22T00:00:00Z"))).toBe(27);
    expect(monthsBetween(new Date("2024-07-25T00:00:00Z"), new Date("2024-08-24T00:00:00Z"))).toBe(0);
  });
});

describe("map navigation and geometry", () => {
  const positions = graph.nodes.map((n) => ({ key: n.key, col: n.col, row: n.row }));

  it("arrow keys move to the nearest stop in that direction", () => {
    expect(spatialNeighbor(positions, "beginner", "right")).toBe("entry-prep");
    expect(spatialNeighbor(positions, "beginner", "left")).toBeNull();
    expect(spatialNeighbor(positions, "experienced-electrician", "right")).toBe("foreman");
    expect(spatialNeighbor(positions, "foreman", "up")).toBe("specialist");
    expect(spatialNeighbor(positions, "foreman", "down")).toBe("management");
    expect(spatialNeighbor(positions, "cert-eligibility", "left")).toBe("supervised-experience");
    expect(spatialNeighbor(positions, "missing", "left")).toBeNull();
    const order = readingOrder(positions);
    expect(order[0]).toBe("beginner");
    expect(new Set(order).size).toBe(positions.length);
  });

  it("lays out stops without overlap and draws connectors between them", () => {
    const size = canvasSize(graph.nodes);
    for (const n of graph.nodes) {
      const o = nodeOrigin(n);
      expect(o.x + MAP_LAYOUT.nodeWidth).toBeLessThanOrEqual(size.width);
      expect(o.y + MAP_LAYOUT.nodeHeight).toBeLessThanOrEqual(size.height);
    }
    expect(edgePath({ col: 0, row: 3 }, { col: 1, row: 3 })).toMatch(/^M192,402 C/);
    expect(edgePath({ col: 7, row: 3 }, { col: 7, row: 4 })).toBe(`M1590,${20 + 3 * 112 + 92} L1590,${20 + 4 * 112}`);
  });
});
