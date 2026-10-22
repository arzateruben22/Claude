import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRoadmap, flagFor, isHttpUrl, loadRoadmap } from "@/lib/academy/roadmap";
import { CredentialComparison, FactCard, SourceLinks, checkedOn } from "@/components/academy/roadmap";

describe("roadmap data (real seed files)", () => {
  const r = loadRoadmap();

  it("loads the verification caveat, classifications and every section", () => {
    expect(r.errors).toEqual([]);
    expect(r.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.verificationMethod).toBeTruthy();
    expect(r.mainUrl && isHttpUrl(r.mainUrl)).toBe(true);
    expect(r.classifications.length).toBeGreaterThanOrEqual(5);
    expect(r.classifications.find((c) => c.code === "GENERAL")?.hoursRequired).toBe(8000);
    for (const c of r.classifications) expect(c.sourceUrl === null || isHttpUrl(c.sourceUrl)).toBe(true);
    for (const s of [r.trainee, r.fees, r.exam, r.renewal, r.law, r.contractor]) {
      expect(s).not.toBeNull();
      expect(s!.sources.length).toBeGreaterThan(0);
      expect(s!.sources.every(isHttpUrl)).toBe(true);
    }
    expect(r.distinction?.apprenticeship).toBeTruthy();
    expect(r.distinction?.certification).toBeTruthy();
    expect(r.distinction?.license).toBeTruthy();
  });

  it("flags the stated conflicts and unverified facts from the data itself", () => {
    const exam = Object.fromEntries(r.exam!.facts.map((f) => [f.label, f]));
    expect(exam["Time limit"]!.flag).toBe("conflict");
    expect(exam["Passing score"]!.flag).toBe("partial");
    const renewal = Object.fromEntries(r.renewal!.facts.map((f) => [f.label, f]));
    expect(renewal["Timing"]!.flag).toBe("conflict");
    expect(renewal["Lapsed certification"]!.flag).toBe("conflict");
    expect(r.law!.pending?.flag).toBe("unverified");
    const fees = Object.fromEntries(r.fees!.rows.map((f) => [f.key, f]));
    expect(fees.lapsedExpiredRenewalFee!.flag).toBe("unverified");
    expect(fees.applicationFee!.flag).toBeNull();
    expect(r.classifications.find((c) => c.code === "RESIDENTIAL")?.flag).toBe("unverified");
    expect(r.unverifiedItems.length).toBeGreaterThan(5);
  });
});

describe("roadmap data (tolerance)", () => {
  it("tolerates missing, malformed and hostile input", () => {
    const empty = buildRoadmap(null, null);
    expect(empty).toMatchObject({ classifications: [], trainee: null, fees: null, exam: null, law: null, contractor: null, distinction: null, unverifiedItems: [] });
    const weird = buildRoadmap(
      {
        mainUrl: "javascript:alert(1)",
        exam: { questions: "lots", timeLimit: 4, sourceUrls: ["https://ok.example/a", "javascript:alert(1)", 5] },
        fees: { applicationFee: "75", examFee: 100, sourceUrls: "nope" },
        unverifiedItems: "not a list",
      },
      [{ name: "General", hoursRequired: "8000", sourceUrl: "data:text/html,x" }, "junk", null],
    );
    expect(weird.mainUrl).toBeNull();
    expect(weird.exam?.facts).toEqual([]);
    expect(weird.exam?.sources).toEqual(["https://ok.example/a"]);
    expect(weird.fees?.rows.map((x) => x.key)).toEqual(["examFee"]);
    expect(weird.classifications).toEqual([expect.objectContaining({ name: "General", hoursRequired: null, sourceUrl: null })]);
  });

  it("reports unreadable files instead of throwing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roadmap-"));
    try {
      fs.writeFileSync(path.join(dir, "certification_facts.json"), "{ broken");
      const r = loadRoadmap(dir);
      expect(r.errors).toHaveLength(2);
      expect(r.classifications).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("derives flags from wording and explicit verification fields", () => {
    expect(flagFor("CONFLICTING official guidance: …")).toBe("conflict");
    expect(flagFor("UNVERIFIED")).toBe("unverified");
    expect(flagFor("fine", false)).toBe("unverified");
    expect(flagFor("fine", "partial (from PSI-era bulletin)")).toBe("partial");
    expect(flagFor("fine", true)).toBeNull();
    expect(checkedOn("2026-10-21")).toBe("Oct 21, 2026");
  });
});

describe("roadmap components render", () => {
  it("renders the three-way comparison and sourced fact cards with badges", () => {
    const r = loadRoadmap();
    const cmp = renderToStaticMarkup(createElement(CredentialComparison, { distinction: r.distinction! }));
    expect(cmp).toContain("Apprenticeship completion vs DIR electrician certification vs CSLB C-10 contractor license");
    expect(cmp).toContain("none automatically grants the others");
    const exam = renderToStaticMarkup(createElement(FactCard, { id: "exam", title: "The certification exam", section: r.exam }));
    expect(exam).toContain("Conflicting sources");
    expect(exam).toContain("Partially verified");
    expect(exam).toContain('target="_blank" rel="noopener noreferrer"');
    expect(exam).toContain(`last checked ${checkedOn(r.exam!.verifiedOn)}`);
    const none = renderToStaticMarkup(createElement(SourceLinks, { urls: [], verifiedOn: "2026-10-21" }));
    expect(none).toContain("treat it as unverified");
  });
});
