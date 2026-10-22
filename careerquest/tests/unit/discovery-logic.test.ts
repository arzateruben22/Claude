import { describe, expect, it } from "vitest";
import { detectEligibility, hiddenByFilters } from "@/lib/discovery/eligibility";
import { matchRegion } from "@/lib/discovery/regions";
import { scoreLead, type ScoreProfile } from "@/lib/discovery/score";
import { firstUrl, parseLeadPaste, parseSharePayload } from "@/lib/discovery/paste";
import { buildSearchPlan, SEARCH_BOARDS } from "@/lib/discovery/search-links";
import { orderedInterests, tradesInText } from "@/lib/discovery/trades";
import { leadFormValues } from "@/lib/discovery/form";
import { leadInputSchema, shareDecisionSchema, targetCompanySchema } from "@/lib/discovery/schemas";

const REGIONS = ["Los Angeles County, CA", "Orange County, CA"];

const profile: ScoreProfile = {
  primaryTrade: "ELECTRICIAN",
  careerInterests: ["Electrician", "Commercial HVAC"],
  regions: REGIONS,
  immediateSalaryTarget: 80000,
  openToApprenticeships: true,
  apprenticeshipMinHourly: 22,
  excludeCompanyVehicleJobs: false,
  excludeDrivingRecordJobs: false,
  excludeCdlJobs: true,
};

describe("eligibility flags", () => {
  it("flags vehicle, driving-record and CDL wording and reports the phrases", () => {
    const r = detectEligibility(
      "Must have a valid driver's license and a clean driving record. Company vehicle provided. Class A CDL a plus.",
    );
    expect(r.flags).toEqual({ requiresCompanyVehicle: true, requiresDrivingRecord: true, requiresCdl: true });
    expect(r.hits.map((h) => h.phrase)).toEqual(
      expect.arrayContaining(["Company vehicle", "clean driving record", "valid driver's license", "CDL"]),
    );
  });

  it("handles curly apostrophes, Class A/B and commercial licenses without double flagging", () => {
    expect(detectEligibility("Valid California driver’s license required").flags.requiresDrivingRecord).toBe(true);
    expect(detectEligibility("Class A/B license preferred").flags.requiresCdl).toBe(true);
    const commercial = detectEligibility("Commercial driver's license required");
    expect(commercial.flags).toEqual({ requiresCompanyVehicle: false, requiresDrivingRecord: false, requiresCdl: true });
  });

  it("does not flag unrelated text", () => {
    const r = detectEligibility("Apprentice electrician for Class A office buildings in Irvine. Company benefits included.");
    expect(r.flags).toEqual({ requiresCompanyVehicle: false, requiresDrivingRecord: false, requiresCdl: false });
    expect(r.hits).toEqual([]);
  });

  it("hides only what the private filters exclude", () => {
    const prefs = { excludeCompanyVehicleJobs: false, excludeDrivingRecordJobs: true, excludeCdlJobs: false };
    expect(hiddenByFilters({ requiresCompanyVehicle: true }, prefs)).toEqual([]);
    expect(hiddenByFilters({ requiresDrivingRecord: true, requiresCdl: true }, prefs)).toEqual(["requiresDrivingRecord"]);
  });
});

describe("regions", () => {
  it("maps cities to the user's county regions", () => {
    expect(matchRegion("Anaheim, CA", REGIONS)).toMatchObject({ kind: "region", region: "Orange County, CA" });
    expect(matchRegion("Orange, CA", REGIONS)).toMatchObject({ kind: "region", region: "Orange County, CA" });
    expect(matchRegion("Van Nuys, California", REGIONS)).toMatchObject({ kind: "region", region: "Los Angeles County, CA" });
    expect(matchRegion("La Cañada Flintridge, CA", REGIONS)).toMatchObject({ kind: "region", region: "Los Angeles County, CA" });
    expect(matchRegion("Los Angeles Metropolitan Area", REGIONS)).toMatchObject({ kind: "region" });
    expect(matchRegion("Orange County, CA", REGIONS)).toMatchObject({ kind: "region" });
  });

  it("tells California-outside-regions, other states, remote and missing apart", () => {
    expect(matchRegion("Riverside, CA", REGIONS).kind).toBe("state");
    expect(matchRegion("Orange, TX", REGIONS).kind).toBe("outside");
    expect(matchRegion("Glendale, AZ", REGIONS).kind).toBe("outside");
    expect(matchRegion("Remote", REGIONS).kind).toBe("remote");
    expect(matchRegion("", REGIONS).kind).toBe("unknown");
    expect(matchRegion("Long Beach, CA", ["Long Beach, CA"]).kind).toBe("region");
  });
});

describe("trades", () => {
  it("recognizes trade vocabulary and orders interests with the primary trade first", () => {
    expect(tradesInText("Inside Wireman / Apprentice")).toEqual(["Electrician"]);
    expect(tradesInText("HVAC-R Service Technician")).toEqual(["Commercial HVAC"]);
    expect(tradesInText("Pipe Fitter")).toEqual(["Commercial plumbing & pipefitting"]);
    expect(orderedInterests("COMMERCIAL_HVAC", ["Electrician", "Commercial HVAC", "Nonsense"])).toEqual(["Commercial HVAC", "Electrician"]);
  });
});

describe("fit score", () => {
  it("explains every point and sums to the total", () => {
    const s = scoreLead({ title: "Journeyman Electrician", location: "Anaheim, CA", salaryText: "$42 - $48 an hour" }, profile);
    expect(s.factors.map((f) => [f.key, f.points])).toEqual([
      ["trade", 40],
      ["region", 25],
      ["pay", 25],
      ["eligibility", 10],
    ]);
    expect(s.score).toBe(100);
    expect(s.factors.find((f) => f.key === "pay")!.detail).toMatch(/\$87,360–\$99,840 a year \(estimate: hourly × 2080 h\) meets your \$80,000 target/);
    for (const f of s.factors) expect(f.detail.length).toBeGreaterThan(10);
  });

  it("scores interests, distance, missing pay and filtered requirements honestly", () => {
    const s = scoreLead({ title: "HVAC Technician", location: "Riverside, CA", requiresCdl: true }, profile);
    expect(Object.fromEntries(s.factors.map((f) => [f.key, f.points]))).toEqual({ trade: 25, region: 5, pay: 0, eligibility: 0 });
    expect(s.score).toBe(30);
    expect(s.factors.find((f) => f.key === "pay")!.detail).toMatch(/No pay listed/);
    expect(s.factors.find((f) => f.key === "eligibility")!.detail).toMatch(/cdl/i);
  });

  it("compares apprenticeship pay with the apprenticeship minimum, not the salary target", () => {
    const ok = scoreLead({ title: "Electrical Apprentice", location: "Irvine, CA", salaryText: "$24/hr" }, profile);
    expect(ok.factors.find((f) => f.key === "pay")).toMatchObject({ points: 25 });
    const low = scoreLead({ title: "Electrician Apprentice", location: "Irvine, CA", salaryText: "$18 - $20 per hour" }, profile);
    expect(low.factors.find((f) => f.key === "pay")).toMatchObject({ points: 0 });
    const range = scoreLead({ title: "Electrician", location: "Irvine, CA", salaryText: "$60,000 - $85,000 a year" }, profile);
    expect(range.factors.find((f) => f.key === "pay")).toMatchObject({ points: 15 });
  });
});

describe("paste parsing", () => {
  it("reads a bare job URL with platform, normalization and URL-path hints", () => {
    const d = parseLeadPaste("https://www.linkedin.com/jobs/view/apprentice-electrician-at-acme-electric-3912345678/?trk=abc");
    expect(d).toMatchObject({
      url: "https://www.linkedin.com/jobs/view/apprentice-electrician-at-acme-electric-3912345678/?trk=abc",
      normalizedUrl: "https://linkedin.com/jobs/view/3912345678",
      platform: "LINKEDIN",
      title: "Apprentice Electrician",
      company: "Acme Electric",
      detailsFrom: "url",
    });
  });

  it("reads labelled posting text, pay, location and flags without fetching anything", () => {
    const d = parseLeadPaste(
      [
        "Job title: Maintenance Electrician",
        "Company: Pacific Plant Services",
        "Location: Santa Ana, CA",
        "Pay: $38.50 - $44 per hour",
        "Requirements: valid driver's license, clean driving record.",
        "Apply at https://pacificplant.example.com/careers/123.",
      ].join("\n"),
    );
    expect(d).toMatchObject({
      title: "Maintenance Electrician",
      company: "Pacific Plant Services",
      location: "Santa Ana, CA",
      salaryText: "$38.50 - $44 per hour",
      url: "https://pacificplant.example.com/careers/123",
      platform: "COMPANY_SITE",
      detailsFrom: "text",
    });
    expect(d.flags.requiresDrivingRecord).toBe(true);
  });

  it("reads share-sheet headlines from job boards", () => {
    const indeed = parseSharePayload({
      title: "Electrician Helper - Volt Line Electric - Anaheim, CA - Indeed.com",
      text: "https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60718&from=share",
    });
    expect(indeed).toMatchObject({
      title: "Electrician Helper",
      company: "Volt Line Electric",
      location: "Anaheim, CA",
      platform: "INDEED",
      normalizedUrl: "https://indeed.com/viewjob?jk=a1b2c3d4e5f60718",
    });
    const linkedin = parseSharePayload({ text: "Check out this job at Bright Spark Electric: Electrician Apprentice https://www.linkedin.com/jobs/view/3999999999" });
    expect(linkedin).toMatchObject({ company: "Bright Spark Electric", title: "Electrician Apprentice", platform: "LINKEDIN" });
    const lever = parseSharePayload({ url: "https://jobs.lever.co/acme/11111111-2222-4333-8444-555555555555", title: "Acme Electric - Wireman" });
    expect(lever).toMatchObject({ platform: "LEVER", company: "Acme Electric", title: "Wireman" });
    expect(parseSharePayload({ title: "Acme Electric hiring Apprentice Electrician in Anaheim, CA | LinkedIn" })).toMatchObject({
      company: "Acme Electric",
      title: "Apprentice Electrician",
      location: "Anaheim, CA",
    });
    expect(parseSharePayload({ title: "Job Application for Wireman at Acme Electric", url: "https://boards.greenhouse.io/acme/jobs/1" })).toMatchObject({
      company: "Acme Electric",
      title: "Wireman",
      platform: "GREENHOUSE",
    });
  });

  it("does not invent a company or title from casual share text", () => {
    expect(parseSharePayload({ text: "look at this https://example.com/jobs/1" })).toMatchObject({ title: null, company: null, platform: "COMPANY_SITE" });
    expect(parseLeadPaste("check this out - maybe later")).toMatchObject({ title: null, company: null });
    expect(parseLeadPaste("Inside Wireman at Sparky Co")).toMatchObject({ title: "Inside Wireman", company: "Sparky Co" });
    expect(parseLeadPaste("Apprentice Electrician\nWe are a family-owned contractor.")).toMatchObject({ title: "Apprentice Electrician", company: null });
  });

  it("finds the first http(s) link and ignores other schemes", () => {
    expect(firstUrl("see (https://example.com/job/1).")).toBe("https://example.com/job/1");
    expect(firstUrl("www.example.com/jobs/2")).toBe("https://www.example.com/jobs/2");
    expect(firstUrl("javascript:alert(1)")).toBeNull();
    expect(parseLeadPaste("").title).toBeNull();
  });

  it("fills blank form fields from the pasted text on the server", () => {
    const fd = new FormData();
    fd.set("pasted", "Inside Wireman at Sparky Co\nhttps://sparky.example.com/jobs/7\nCompany truck provided");
    fd.set("title", "");
    fd.set("notes", "Referred by Sam");
    const { values, pasted, flagsReviewed } = leadFormValues(fd);
    expect(values).toMatchObject({ title: "Inside Wireman", company: "Sparky Co", url: "https://sparky.example.com/jobs/7", notes: "Referred by Sam" });
    expect(pasted).toContain("Company truck");
    expect(flagsReviewed).toBe(false);
    expect(leadInputSchema.safeParse(values).success).toBe(true);
  });
});

describe("search links", () => {
  it("builds board links for each interest × region and a statewide CalCareers link", () => {
    const plan = buildSearchPlan({ primaryTrade: "ELECTRICIAN", careerInterests: ["Commercial HVAC"], regions: REGIONS, openToApprenticeships: true });
    expect(plan.map((g) => g.label)).toEqual(["Electrician", "Electrician (apprenticeship)", "Commercial HVAC"]);
    const first = plan[0]!;
    expect(first.regions.map((r) => r.region)).toEqual(REGIONS);
    expect(first.regions[0]!.links.map((l) => l.label)).toEqual(["Indeed", "LinkedIn Jobs", "ZipRecruiter", "Glassdoor", "GovernmentJobs", "USAJOBS"]);
    expect(first.regions[0]!.links[0]!.href).toBe("https://www.indeed.com/jobs?q=electrician&l=Los+Angeles+County%2C+CA");
    expect(first.regions[1]!.links.find((l) => l.board === "usajobs")!.href).toBe("https://www.usajobs.gov/Search/Results?k=electrician&l=Orange+County%2C+CA");
    expect(first.statewide).toEqual([
      { board: "calcareers", label: "CalCareers", href: "https://www.calcareers.ca.gov/CalHrPublic/Search/JobSearchResults.aspx#kw=electrician" },
    ]);
    for (const g of plan) for (const r of g.regions) for (const l of r.links) expect(l.href).toMatch(/^https:\/\//);
    expect(SEARCH_BOARDS).toHaveLength(7);
  });

  it("falls back to the default regions and skips the apprenticeship search when closed to it", () => {
    const plan = buildSearchPlan({ primaryTrade: "CONSTRUCTION_ESTIMATOR", careerInterests: [], regions: [], openToApprenticeships: false });
    expect(plan.map((g) => g.label)).toEqual(["Construction estimator"]);
    expect(plan[0]!.regions.map((r) => r.region)).toEqual(REGIONS);
    expect(buildSearchPlan({ primaryTrade: "OTHER", careerInterests: [], regions: REGIONS, openToApprenticeships: true })).toEqual([]);
  });
});

describe("form schemas", () => {
  it("validates leads, target companies and share decisions", () => {
    expect(leadInputSchema.safeParse({ title: " ", company: "Acme" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ title: "Wireman", company: "Acme", url: "ftp://x" }).success).toBe(false);
    const lead = leadInputSchema.parse({ title: " Wireman ", company: "Acme", url: "www.acme.com/jobs/1", requiresCdl: "on" });
    expect(lead).toMatchObject({ title: "Wireman", url: "https://www.acme.com/jobs/1", requiresCdl: true, requiresDrivingRecord: false });
    expect(targetCompanySchema.safeParse({ name: "Acme", priority: "4" }).success).toBe(false);
    expect(targetCompanySchema.parse({ name: "Acme", priority: "1", careersUrl: "" })).toMatchObject({ priority: 1, careersUrl: undefined });
    expect(shareDecisionSchema.safeParse({ decision: "delete" }).success).toBe(false);
    expect(shareDecisionSchema.safeParse({ decision: "applied", attachTo: "not-a-uuid" }).success).toBe(false);
  });
});
