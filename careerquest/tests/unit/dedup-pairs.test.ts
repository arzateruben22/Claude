/**
 * Pure tests for duplicate pairing and the merge stage rule.
 */
import { describe, expect, it } from "vitest";
import { findDuplicatePairs, orderedPair, shouldAdoptMergedStatus, suggestKeep, type DedupApp } from "@/lib/dedup/pairs";
import { normalizeCompany, normalizeTitle, normalizeUrl } from "@/lib/applications/normalize";

let n = 0;
function app(over: Partial<DedupApp> & { company?: string; title?: string; url?: string } = {}): DedupApp {
  n += 1;
  return {
    id: over.id ?? `app-${String(n).padStart(3, "0")}`,
    normalizedCompany: normalizeCompany(over.company ?? "Acme Electric"),
    normalizedTitle: normalizeTitle(over.title ?? "Apprentice Electrician"),
    location: over.location ?? null,
    requisitionNumber: over.requisitionNumber ?? null,
    normalizedUrl: over.normalizedUrl ?? normalizeUrl(over.url ?? null),
    source: over.source ?? "OTHER",
    appliedAt: over.appliedAt ?? null,
    createdAt: over.createdAt ?? new Date("2026-01-12T00:00:00Z"),
    linkUrls: over.linkUrls ?? [],
  };
}

describe("findDuplicatePairs", () => {
  it("pairs the same job across boards and orders ids", () => {
    const indeed = app({ id: "b-indeed", company: "Harbor Line Elevator Co.", title: "Elevator Mechanic Helper", source: "INDEED" });
    const workday = app({ id: "a-workday", company: "Harbor Line Elevator", title: "Elevator Mechanic Helper (Long Beach)", source: "WORKDAY" });
    const other = app({ id: "c-other", company: "Golden State Builders", title: "Estimator" });
    const pairs = findDuplicatePairs([indeed, workday, other]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ aId: "a-workday", bId: "b-indeed" });
    expect(pairs[0]!.score).toBeGreaterThanOrEqual(0.9);
  });

  it("finds pairs through a shared posting link even when the companies differ", () => {
    const url = normalizeUrl("https://www.indeed.com/viewjob?jk=abc123def456")!;
    const agency = app({ company: "TradeForce Staffing", title: "Maintenance Technician", linkUrls: [url] });
    const client = app({ company: "Sunrise Aerospace Components", title: "Industrial Maintenance Technician", normalizedUrl: url });
    const pairs = findDuplicatePairs([agency, client]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.deterministic).toBe(true);
  });

  it("uses linked email threads", () => {
    const a = app({ company: "Alpha Mechanical", title: "Pipefitter" });
    const b = app({ company: "Zeta Services", title: "Helper" });
    expect(findDuplicatePairs([a, b])).toHaveLength(0);
    const pairs = findDuplicatePairs([a, b], { threadLinkedPairs: [[b.id, a.id]] });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.score).toBe(0.97);
  });

  it("skips different jobs at the same company and compares neighbours in huge blocks", () => {
    const a = app({ company: "Golden State Builders", title: "Construction Project Coordinator" });
    const b = app({ company: "Golden State Builders", title: "Assistant Project Manager" });
    expect(findDuplicatePairs([a, b])).toHaveLength(0);

    const many = Array.from({ length: 30 }, (_, i) =>
      app({ company: "Acme Electric", title: `Role number ${i} specialist ${"x".repeat(i)}`, createdAt: new Date(2026, 0, 1 + i) }),
    );
    const twin = app({ company: "Acme Electric", title: many[29]!.normalizedTitle, createdAt: new Date(2026, 1, 15) });
    const pairs = findDuplicatePairs([...many, twin], { maxBlockSize: 10, window: 3 });
    expect(pairs.some((p) => [p.aId, p.bId].includes(twin.id))).toBe(true);
  });

  it("orders pair ids", () => {
    expect(orderedPair("b", "a")).toEqual(["a", "b"]);
  });
});

describe("shouldAdoptMergedStatus", () => {
  const at = (iso: string) => new Date(iso);
  const s = (status: Parameters<typeof shouldAdoptMergedStatus>[0]["status"], verified = false, when = "2026-02-01T00:00:00Z") => ({
    status,
    statusVerified: verified,
    statusUpdatedAt: at(when),
  });

  it("adopts later pipeline stages and verification of the same stage", () => {
    expect(shouldAdoptMergedStatus(s("SAVED"), s("SUBMITTED"))).toBe(true);
    expect(shouldAdoptMergedStatus(s("INTERVIEWING", true), s("SUBMITTED"))).toBe(false);
    expect(shouldAdoptMergedStatus(s("SUBMITTED"), s("SUBMITTED", true))).toBe(true);
    expect(shouldAdoptMergedStatus(s("SUBMITTED", true), s("SUBMITTED"))).toBe(false);
  });

  it("uses recency for closing and reopening", () => {
    expect(shouldAdoptMergedStatus(s("INTERVIEWING", false, "2026-02-01T00:00:00Z"), s("REJECTED", false, "2026-03-01T00:00:00Z"))).toBe(true);
    expect(shouldAdoptMergedStatus(s("INTERVIEWING", false, "2026-04-01T00:00:00Z"), s("REJECTED", false, "2026-03-01T00:00:00Z"))).toBe(false);
    expect(shouldAdoptMergedStatus(s("REJECTED", false, "2026-03-01T00:00:00Z"), s("OFFER", true, "2026-04-01T00:00:00Z"))).toBe(true);
    expect(shouldAdoptMergedStatus(s("REJECTED"), s("WITHDRAWN"))).toBe(false);
  });

  it("suggests keeping the record further along, else the older one", () => {
    const older = { id: "o", createdAt: at("2026-01-01T00:00:00Z"), ...s("SAVED") };
    const newer = { id: "n", createdAt: at("2026-01-05T00:00:00Z"), ...s("SUBMITTED") };
    expect(suggestKeep(older, newer).id).toBe("n");
    expect(suggestKeep({ ...older, ...s("SUBMITTED") }, newer).id).toBe("o");
  });
});
