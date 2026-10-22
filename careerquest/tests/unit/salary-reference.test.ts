import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isExpired, parseRateKey, parseWageReferences, statusFrom } from "@/lib/salary/reference";
import { loadWageReferences } from "@/lib/salary/reference-data";

const facts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "certification_facts.json"), "utf8"));

describe("cited wage references", () => {
  it("parses the IBEW Local 11 journeyman rate with its effective dates and source from the real seed file", () => {
    const refs = parseWageReferences(facts);
    const j = refs.apprenticeship?.journeymanRate;
    expect(j).toBeTruthy();
    expect(j!.value).toBe(65);
    expect(j!.effectiveFrom).toBe("2026-01-26");
    expect(j!.effectiveTo).toBe("2026-06-30");
    expect(j!.status).toBe("partial");
    expect(j!.statusNote).toMatch(/\$65\.00 rate is verified/);
    expect(j!.source).toMatch(/IBEW Local 11/);
    expect(j!.sourceUrls.some((u) => u.includes("laneca.org"))).toBe(true);
    expect(j!.checkedOn).toBe("2026-10-21");
    expect(refs.apprenticeship!.successorNote).toMatch(/UNVERIFIED/);
  });

  it("parses the 40% first-period apprentice rate from the official notice", () => {
    const ap = parseWageReferences(facts).apprenticeship!;
    expect(ap.firstPeriodPercent!.value).toBe(40);
    expect(ap.firstPeriodPercent!.effectiveFrom).toBe("2026-01-26");
    expect(ap.firstPeriodPercent!.status).toBe("verified");
    expect(ap.firstPeriodPercent!.sourceUrls[0]).toMatch(/laett\.com.*Official%20Notice/);
    expect(ap.firstPeriodRate).toBe(26);
    // The cited percentage and the cited journeyman rate agree with the cited apprentice rate.
    expect((ap.firstPeriodPercent!.value / 100) * ap.journeymanRate!.value).toBeCloseTo(ap.firstPeriodRate!, 2);
    expect(ap.laterSteps).toMatch(/45% at 1,000 hrs/);
  });

  it("exposes market references only with source and verification status", () => {
    const { market, occupation } = parseWageReferences(facts);
    expect(occupation).toMatch(/47-2111/);
    const la = market.find((m) => m.key === "losAngeles2025")!;
    expect(la.status).toBe("unverified");
    expect(la.statusNote).toMatch(/UNVERIFIED/);
    expect(la.points.map((p) => p.label)).toEqual(["10th percentile", "25th percentile", "Median", "75th percentile", "90th percentile"]);
    expect(la.points.find((p) => p.label === "Median")).toEqual({ label: "Median", annual: 73_810, hourly: 35.49 });
    const us = market.find((m) => m.key === "national2025")!;
    expect(us.status).toBe("verified");
    for (const m of market) {
      expect(m.source.length).toBeGreaterThan(0);
      expect(m.sourceUrls.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing rather than guessing when data are missing or malformed", () => {
    expect(parseWageReferences(null)).toEqual({ occupation: "Electricians (SOC 47-2111)", apprenticeship: null, market: [] });
    expect(parseWageReferences({ wages: { ibewLocal11Journeyman: { baseHourly: 65, source: "x" } } }).apprenticeship).toBeNull();
    const noSource = parseWageReferences({ wages: { ibewLocal11Journeyman: { baseHourly_Jan26_to_Jun30_2026: 65 } } });
    expect(noSource.apprenticeship).toBeNull();
    const badPct = parseWageReferences({ wages: { apprenticeStart: { ibew11InsideWireman: "about half of journeyman" } } });
    expect(badPct.apprenticeship).toBeNull();
  });

  it("parses rate keys and verification markers", () => {
    expect(parseRateKey("baseHourly_Jan26_to_Jun30_2026")).toEqual({ from: "2026-01-26", to: "2026-06-30" });
    expect(parseRateKey("baseHourly_Jul28_2025_to_Jan25_2026")).toEqual({ from: "2025-07-28", to: "2026-01-25" });
    expect(parseRateKey("healthAndWelfareHourly")).toBeNull();
    expect(statusFrom(true).status).toBe("verified");
    expect(statusFrom(false).status).toBe("unverified");
    expect(statusFrom("partial (…)").status).toBe("partial");
    expect(statusFrom("UNVERIFIED - x").status).toBe("unverified");
    expect(isExpired({ effectiveTo: "2026-06-30" }, "2026-10-22")).toBe(true);
    expect(isExpired({ effectiveTo: null }, "2026-10-22")).toBe(false);
  });

  it("loads from disk and degrades to empty references when the file is missing", () => {
    expect(loadWageReferences().apprenticeship?.journeymanRate?.value).toBe(65);
    expect(loadWageReferences("/nonexistent-dir").apprenticeship).toBeNull();
  });
});
