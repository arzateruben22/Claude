import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { loadCareerSeed } from "@/lib/career-map/load-seed";
import { buildCareerGraph } from "@/lib/career-map/graph";
import { deriveCareerMap, type CareerUserData } from "@/lib/career-map/status";
import { CareerMapExplorer } from "@/components/career-map/career-map-explorer";
import { MapCanvas } from "@/components/career-map/map-canvas";
import { NodePanel } from "@/components/career-map/node-panel";
import { CareerListView } from "@/components/career-map/list-view";
import { MapLegend } from "@/components/career-map/legend";
import { CredentialCompare, ResearchNote } from "@/components/career-map/credential-compare";
import { FactList } from "@/components/career-map/fact-list";

const NOW = new Date("2026-10-22T19:00:00Z");
const graph = buildCareerGraph(loadCareerSeed());

const data: CareerUserData = {
  now: NOW,
  timezone: "America/Los_Angeles",
  profile: { primaryTrade: "ELECTRICIAN", careerInterests: ["Commercial HVAC"], onboardingCompletedAt: new Date("2026-09-01T17:00:00Z") },
  programs: [{ slug: "ibew-11-eti", name: "ETI", status: "APPLIED" }],
  certifications: [
    {
      classification: "GENERAL",
      traineeRegisteredAt: new Date("2026-01-10T18:00:00Z"),
      traineeExpiresAt: new Date("2027-01-10T18:00:00Z"),
      schoolEnrolled: "Approved School",
      examApplicationAt: null,
      examEligibleAt: null,
      examScheduledAt: null,
      examPassedAt: null,
      certifiedAt: null,
      certificateExpiresAt: null,
      updatedAt: NOW,
    },
  ],
  hours: { verifiedOjt: 1240, selfReportedOjt: 300, verifiedClassroom: 0, selfReportedClassroom: 0, recentVerifiedOjt: 480, recentWindowDays: 84, entryCount: 30 },
  lessons: { catalog: [{ key: "ohms-law", track: "FUNDAMENTALS" }], progress: [{ lessonKey: "ohms-law", status: "COMPLETED", bestScore: 90 }] },
  practiceExams: { attempts: 0, passed: 0, bestPercent: null },
  applications: [{ id: "a1", title: "Apprentice Electrician", category: null, company: "Volt Co", status: "SUBMITTED", applied: true }],
  documents: { HOURS_VERIFICATION: 2 },
  overrides: [{ nodeKey: "foreman", status: "IN_PROGRESS", notes: "Leading a small crew", updatedAt: NOW }],
};
const view = deriveCareerMap(graph, data);
const byKey = new Map(view.nodes.map((n) => [n.key, n]));

describe("career map renders", () => {
  it("renders the explorer with every stop, the current position and the detail panel", () => {
    const html = renderToStaticMarkup(createElement(CareerMapExplorer, { view }));
    expect(html).toContain('aria-label="Career map"');
    expect((html.match(/data-node-key=/g) ?? []).length).toBe(view.nodes.length);
    expect(view.currentKey).toBe("supervised-experience");
    expect(html).toContain('aria-current="location"');
    expect(html).toContain("You are here");
    expect(html).toContain("In progress because: 1,240 verified hours of 8,000 (General Electrician)");
    expect(html).toContain("Next recommended action");
    expect(html).toContain("Mark this stop yourself");
    expect(html).toContain("Center on my position");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Marked by you");
  });

  it("opens a requested stop from ?node=", () => {
    const html = renderToStaticMarkup(createElement(CareerMapExplorer, { view, initialKey: "c10-license" }));
    expect(html).toContain("CSLB C-10 Contractor License</h2>");
    expect(html).toContain("What this credential is (and is not)");
  });

  it("renders every stop's panel with all fields", () => {
    for (const n of view.nodes) {
      const html = renderToStaticMarkup(
        createElement(NodePanel, { node: n, nodesByKey: byKey, isCurrent: n.key === view.currentKey, onSelect: () => undefined, onBackToMap: () => undefined }),
      );
      for (const heading of [
        "Current status and evidence",
        "Requirements",
        "Estimated duration",
        "Costs",
        "Required documents",
        "Relevant jobs",
        "Training progress",
        "Prerequisites",
        "Official resources",
      ]) {
        expect(html, `${n.key}: ${heading}`).toContain(heading);
      }
      expect(html).toContain('data-testid="node-reason"');
      expect(html).toContain(`<h2 id="cm-${n.key}-title"`);
    }
  });

  it("labels user marks, evidence, sources and documents on file", () => {
    const foreman = renderToStaticMarkup(createElement(NodePanel, { node: byKey.get("foreman")!, nodesByKey: byKey, isCurrent: false, onSelect: () => undefined }));
    expect(foreman).toContain("Marked by you: In progress");
    expect(foreman).toContain("From your data:");
    expect(foreman).toContain("Leading a small crew");
    expect(foreman).toContain("Update my mark");
    expect(foreman).toContain("Remove my mark and follow my data");

    const sup = renderToStaticMarkup(createElement(NodePanel, { node: byKey.get("supervised-experience")!, nodesByKey: byKey, isCurrent: true, onSelect: () => undefined }));
    expect(sup).toContain("Verified");
    expect(sup).toContain("Self-reported");
    expect(sup).toContain("Estimate");
    expect(sup).toContain("On file");
    expect(sup).toContain("last checked Oct 21, 2026");
    expect(sup).toContain("8,000 hours of on-the-job work (General Electrician)");

    const hvac = renderToStaticMarkup(createElement(NodePanel, { node: byKey.get("commercial-hvac")!, nodesByKey: byKey, isCurrent: false, onSelect: () => undefined }));
    expect(hvac).toContain("no researched figures");
    expect(hvac).toContain("On your interest list");
  });

  it("renders the canvas, list view, legend and credential comparison", () => {
    const canvas = renderToStaticMarkup(
      createElement(MapCanvas, { nodes: view.nodes, edges: view.edges, branches: view.branches, selectedKey: "beginner", currentKey: view.currentKey, onSelect: () => undefined }),
    );
    expect((canvas.match(/marker-end="url\(#/g) ?? []).length).toBe(view.edges.length);
    expect((canvas.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect(canvas).toContain("Construction office");

    const list = renderToStaticMarkup(createElement(CareerListView, { nodes: view.nodes, branches: view.branches, selectedKey: "beginner", currentKey: view.currentKey, onSelect: () => undefined }));
    expect(list).toContain("Plumbing &amp; pipefitting");
    expect((list.match(/<button/g) ?? []).length).toBe(view.nodes.length);

    const legend = renderToStaticMarkup(createElement(MapLegend, { counts: view.counts }));
    expect(legend).toContain("Usual order (never blocks)");
    expect(legend).toContain("Locked");

    const creds = renderToStaticMarkup(createElement(CredentialCompare, { facts: view.distinction }));
    expect(creds).toContain("None of them automatically grants the others.");
    expect((creds.match(/<li/g) ?? []).length).toBeGreaterThanOrEqual(3);

    const note = renderToStaticMarkup(createElement(ResearchNote, { seed: view.seed }));
    expect(note).toContain("last checked Oct 21, 2026");

    const facts = renderToStaticMarkup(
      createElement(FactList, { facts: [{ label: "X", value: "No source", basis: "sourced", sources: [], verifiedOn: null, flag: "unverified" }] }),
    );
    expect(facts).toContain("Unverified");
    expect(facts).toContain("No source recorded");
  });
});
