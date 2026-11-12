import { describe, expect, it } from "vitest";
import { locate, targetHourly } from "@/lib/jobfinder/geo";
import { accessFactor, dedupe, mergeRow, parseGaps, payFactor, scoreRow, select, stableId, verdictState, WEIGHTS, type RawRow, type Verdict } from "@/lib/jobfinder/score";

const verdict = (over: Partial<Verdict> = {}): Verdict => ({
  isReal: true,
  stillOpenConfidence: 0.85,
  directEmployerApply: true,
  inLaOrOc: true,
  problems: [],
  verdictReason: "found on employer site",
  independentEvidence: [{ quote: "Electrical Craft Helper, filing open", sourceUrl: "https://www.governmentjobs.com/careers/example/jobs/1" }],
  gapsForBeginner: [],
  aiExposure: { level: "low", reason: "hands-on field work" },
  coverLetter: "Dear hiring team, [your experience]",
  resumeEmphasis: [],
  doNotClaim: [],
  ...over,
});

const row = (over: Partial<RawRow> = {}): RawRow => ({
  tier: "best_fit",
  employer: "City of Example",
  title: "Electrical Craft Helper",
  field: "electrical",
  city: "Los Angeles",
  county: "Los Angeles",
  payText: "$79,657 per year",
  payMinAnnual: 79657,
  payMaxAnnual: 93584,
  postingUrl: "https://www.governmentjobs.com/careers/example/jobs/1",
  applyHost: "www.governmentjobs.com",
  minimumRequirements: ["Six months as a helper"],
  drivingRequirement: "none stated",
  whyFit: "entry level",
  evidence: [],
  openConfidence: 0.8,
  slice: "city-utilities",
  verdict: verdict(),
  ...over,
});

describe("weights", () => {
  it("sum to 1 so the score is out of 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("payFactor", () => {
  it("gives full marks when the whole range clears the target", () => {
    expect(payFactor(82000, 99000, false).value).toBe(1);
  });
  it("scales when only the top of the range reaches the target", () => {
    const f = payFactor(60000, 90000, false);
    expect(f.value).toBeCloseTo(0.75 + 0.25 * 0.75, 5);
    expect(f.note).toMatch(/Top of range/);
  });
  it("is proportional below the target and lifted for a documented progression", () => {
    expect(payFactor(40000, 56000, false).value).toBeCloseTo(0.49, 5);
    expect(payFactor(40000, 56000, true).value).toBe(0.6);
  });
  it("does not guess when pay is missing", () => {
    expect(payFactor(null, null, false)).toEqual({ value: 0.4, note: "Pay could not be confirmed as a number" });
    expect(payFactor(null, 85000, false).value).toBe(1);
  });
});

describe("parseGaps / accessFactor", () => {
  it("separates mandatory from experience gaps and treats unlabelled lines as soft", () => {
    const g = parseGaps(["HARD: California electrician certification", "soft - 2 years of experience", "Familiarity with Procore", "  "]);
    expect(g.hard).toEqual(["California electrician certification"]);
    expect(g.soft).toEqual(["2 years of experience", "Familiarity with Procore"]);
  });
  it("judges the requirement itself, not the commentary after it", () => {
    const g = parseGaps([
      "HARD: 2+ years of experience as a Maintenance Mechanic. It is an experience requirement, not a state license.",
      "HARD: High school diploma or GED PLUS one further qualification from the list (four-year STEM degree, associate's degree, or three years of refining experience)",
      "HARD: EPA Section 608 refrigerant certification. Federal rules require it.",
      "HARD: One year as a maintenance technician in a hospital, stated as required (knowledge of fire alarm systems is not a credential)",
    ]);
    expect(g.hard).toEqual(["EPA Section 608 refrigerant certification. Federal rules require it."]);
    expect(g.soft).toHaveLength(3);
    expect(g.confirm).toEqual([]);
  });
  it("drops to zero on any mandatory gap", () => {
    expect(accessFactor(0, 1).value).toBe(0);
    expect(accessFactor(0, 0).value).toBe(1);
    expect(accessFactor(2, 0).value).toBe(0.6);
    expect(accessFactor(9, 0).value).toBe(0.3);
  });
});

describe("scoreRow", () => {
  it("scores a clean entry-level trade posting highly and explains every factor", () => {
    const j = scoreRow(row());
    expect(j.list).toBe("best_fit");
    expect(j.score).toBeGreaterThanOrEqual(90);
    expect(Object.values(j.breakdown).every((f) => f.note.length > 0)).toBe(true);
    expect(Math.round(Object.values(j.breakdown).reduce((s, f) => s + f.points, 0))).toBe(j.score);
  });
  it("rules out anything not independently confirmed, off-site, outside the area, closed, or needing a mandatory credential", () => {
    const once = scoreRow(row({ verdict: null }));
    expect(once.ruledOutReason).toBeNull();
    expect(once.checked).toBe(false);
    expect(once.list).toBe(once.tier);
    expect(scoreRow(row({ verdict: verdict({ isReal: false }) })).ruledOutReason).toMatch(/could not find/);
    expect(scoreRow(row({ verdict: verdict({ directEmployerApply: false }) })).ruledOutReason).toMatch(/employer's own site/);
    expect(scoreRow(row({ verdict: verdict({ inLaOrOc: false }) })).ruledOutReason).toMatch(/outside/);
    expect(scoreRow(row({ verdict: verdict({ stillOpenConfidence: 0.2 }) })).ruledOutReason).toMatch(/closed/);
    const hard = scoreRow(row({ verdict: verdict({ gapsForBeginner: ["HARD: journey-level card"] }) }));
    expect(hard.list).toBe("ruled_out");
    expect(hard.ruledOutReason).toContain("journey-level card");
    const years = scoreRow(row({ tier: "stretch", verdict: verdict({ gapsForBeginner: ["HARD: 2+ years as a maintenance mechanic, stated as required"] }) }));
    expect(years.list).toBe("stretch");
    expect(years.gaps.soft).toHaveLength(1);
  });
  it("classifies experience gaps as stretch, never as best fit", () => {
    expect(scoreRow(row({ verdict: verdict({ gapsForBeginner: ["SOFT: 2 years", "SOFT: Procore"] }) })).list).toBe("stretch");
    expect(scoreRow(row({ tier: "stretch", verdict: verdict({ gapsForBeginner: ["SOFT: 3 years"] }) })).list).toBe("stretch");
    expect(scoreRow(row({ tier: "stretch", verdict: verdict({ gapsForBeginner: [] }) })).list).toBe("best_fit");
    // Any stated need for experience makes it a stretch, however the first reading tiered it.
    expect(scoreRow(row({ verdict: verdict({ gapsForBeginner: ["SOFT: 1 year"] }) })).list).toBe("stretch");
    expect(scoreRow(row({ verdict: verdict({ gapsForBeginner: ["SOFT: Basic knowledge of machine components"] }) })).list).toBe("best_fit");
  });
  it("keeps job conditions and preferred items out of the gap count", () => {
    const g = parseGaps([
      "SOFT: Must be able to work a variety of shifts including weekends, nights and holidays",
      "SOFT: Must provide own tools of the trade.",
      "SOFT: Hydraulic and pneumatic systems experience (preferred)",
      "SOFT: Vocational/Technical Diploma (preferred)",
      "SOFT: No trade experience is asked for, so being a beginner is not a gap here.",
      "HARD: 2+ years of experience as a Maintenance Mechanic (listed as a basic qualification)",
    ]);
    expect(g.conditions).toHaveLength(2);
    expect(g.preferred).toHaveLength(2);
    expect(g.soft).toEqual(["2+ years of experience as a Maintenance Mechanic (listed as a basic qualification)"]);
    const onlyConditions = scoreRow(row({ verdict: verdict({ gapsForBeginner: ["SOFT: Rotating 12-hour shifts", "SOFT: Pass a drug screening"] }) }));
    expect(onlyConditions.list).toBe("best_fit");
    expect(onlyConditions.gaps.soft).toEqual([]);
  });
  it("scores against the resume when the checker compared it requirement by requirement", () => {
    const fit = scoreRow(row({ verdict: verdict({ resumeFit: 0.9, resumeFitReason: "all minimums shown", gapsForApplicant: [], gapsForBeginner: undefined }) }));
    expect(fit.fitBasis).toBe("resume");
    expect(fit.list).toBe("best_fit");
    expect(fit.breakdown.interest.value).toBeCloseTo(0.9);
    expect(fit.breakdown.interest.note).toMatch(/Resume match 90%/);
    expect(fit.breakdown.access.note).toMatch(/resume shows every posted minimum/i);
    const stretch = scoreRow(row({ verdict: verdict({ resumeFit: 0.6, gapsForApplicant: ["SOFT: 5 years of construction coordination - resume shows about 3"] }) }));
    expect(stretch.list).toBe("stretch");
    const miss = scoreRow(row({ verdict: verdict({ resumeFit: 0.25, gapsForApplicant: ["SOFT: maritime operations knowledge not shown"] }) }));
    expect(miss.list).toBe("ruled_out");
    expect(miss.ruledOutReason).toMatch(/too few of the posted minimums/);
    const degree = scoreRow(row({ verdict: verdict({ resumeFit: 0.7, gapsForApplicant: ["HARD: College degree in business required with no experience alternative stated; resume shows no degree"] }) }));
    expect(degree.list).toBe("ruled_out");
    expect(degree.ruledOutReason).toMatch(/credential/);
    expect(scoreRow(row({ verdict: verdict({}) })).fitBasis).toBe("goals");
    // Preferred items alone do not demote a job whose every stated minimum the resume shows.
    const preferredOnly = scoreRow(row({ verdict: verdict({ resumeFit: 0.88, gapsForApplicant: ["SOFT: Bachelor's degree is preferred", "SOFT: 3 years of program coordination is preferred", "SOFT: health care setting experience is preferred"] }) }));
    expect(preferredOnly.list).toBe("best_fit");
    expect(preferredOnly.gaps.preferred).toHaveLength(3);
    expect(preferredOnly.breakdown.access.note).toMatch(/every posted minimum.*3 preferred items/);
    expect(preferredOnly.breakdown.access.value).toBeCloseTo(0.9);
  });
  it("treats legal eligibility as something to confirm, never as a gap or a block", () => {
    const g = parseGaps([
      "HARD: must meet export control compliance requirements (a legal eligibility condition, normally U.S. person status)",
      "HARD: U.S. person eligibility for access to Controlled Data (ITAR) - status unknown",
      "SOFT: authorized to work in the United States without sponsorship",
    ]);
    expect(g.confirm).toHaveLength(3);
    expect(g.hard).toEqual([]);
    expect(g.soft).toEqual([]);
  });
  it("merges the same posting written two ways and prefers the checked copy", () => {
    const first = scoreRow(row({ employer: "Los Angeles Department of Water and Power (LADWP)", title: "Utility Pre-Craft Trainee (UPCT)", postingUrl: "https://example.org/a", verdict: null }));
    const second = scoreRow(row({ employer: "Los Angeles Department of Water and Power", title: "Utility Pre-Craft Trainee (UPCT) - Local 18 list", postingUrl: "https://example.org/b", verdict: verdict({ stillOpenConfidence: 0.4 }) }));
    const out = dedupe([first, second]);
    expect(out).toHaveLength(1);
    expect(out[0]!.checked).toBe(true);
  });
  it("flags postings that need a quick check before applying", () => {
    expect(scoreRow(row({ verdict: verdict({ stillOpenConfidence: 0.5 }) })).needsOpenCheck).toBe(true);
    expect(scoreRow(row()).needsOpenCheck).toBe(false);
  });
  it("uses the checker's corrections over the finder's claim", () => {
    const merged = mergeRow(row({ verdict: verdict({ corrected: { payText: "$40.00/hr", payMinAnnual: 83200, closingDate: "2026-12-01", minimumRequirements: [] } }) }));
    expect(merged.payText).toBe("$40.00/hr");
    expect(merged.payMinAnnual).toBe(83200);
    expect(merged.closingDate).toBe("2026-12-01");
    expect(merged.minimumRequirements).toEqual(["Six months as a helper"]);
  });
  it("penalises driving requirements without excluding them", () => {
    const none = scoreRow(row());
    const cdl = scoreRow(row({ drivingRequirement: "CDL required" }));
    expect(cdl.list).toBe("best_fit");
    expect(cdl.score).toBeLessThan(none.score);
  });
});

describe("a second pass that could not run", () => {
  const unchecked = (over: Partial<Verdict> = {}) =>
    verdict({ isReal: false, stillOpenConfidence: 0.2, independentEvidence: [], verdictReason: "Could not verify: the web search budget for this turn was exhausted before any query ran.", ...over });

  it("is told apart from a second pass that looked and found nothing", () => {
    expect(verdictState(unchecked())).toBe("unchecked");
    expect(verdictState(verdict({ isReal: false, verdictReason: "Searched the employer site; the requisition is not listed." }))).toBe("checked");
    expect(verdictState(null)).toBe("none");
  });
  it("keeps the lead, uses the finder's confidence, and always asks for a check before applying", () => {
    const j = scoreRow(row({ openConfidence: 0.6, verdict: unchecked() }));
    expect(j.list).toBe("best_fit");
    expect(j.checked).toBe(false);
    expect(j.needsOpenCheck).toBe(true);
    expect(j.breakdown.open.value).toBe(0.6);
    expect(j.breakdown.open.note).toMatch(/not double-checked/);
  });
  it("still rules out leads the finder itself doubted, and mandatory gaps", () => {
    expect(scoreRow(row({ openConfidence: 0.2, verdict: unchecked() })).ruledOutReason).toMatch(/unlikely to still be open/);
    expect(scoreRow(row({ openConfidence: 0.7, verdict: unchecked({ gapsForBeginner: ["HARD: EPA Section 608 certification"] }) })).list).toBe("ruled_out");
  });
  it("classifies by the first pass's reading, not by a blind second pass's speculation", () => {
    const notes = ["HARD (as claimed, unverified): birth certificate must be presented", "SOFT (unknown): may prefer experience", "UNKNOWN: schedule", "SOFT: trade schooling preferred"];
    const entry = scoreRow(row({ tier: "best_fit", openConfidence: 0.5, verdict: unchecked({ gapsForBeginner: notes }) }));
    expect(entry.list).toBe("best_fit");
    expect(entry.gaps.confirm).toEqual(["birth certificate must be presented"]);
    expect(parseGaps(["UNKNOWN (check posting): driver's license requirement was not read from the posting"]).driving).toHaveLength(1);
    expect(entry.breakdown.access.value).toBe(0.9);
    const reach = scoreRow(row({ tier: "stretch", openConfidence: 0.5, verdict: unchecked({ gapsForBeginner: ["HARD: 4 years of experience"] }) }));
    expect(reach.list).toBe("stretch");
    expect(reach.breakdown.access.value).toBe(0.5);
  });
});

describe("driving and residency statements", () => {
  it("are never counted as a gap, because the applicant's licence status is not assumed", () => {
    const g = parseGaps(["HARD: Valid driver's license required", "HARD: Residency in Los Angeles County", "SOFT: willingness to drive long distances", "HARD: journey-level card"]);
    expect(g.driving).toHaveLength(2);
    expect(g.hard).toEqual(["journey-level card"]);
    expect(g.soft).toEqual([]);
    expect(g.confirm).toEqual(["Residency in Los Angeles County"]);
    const j = scoreRow(row({ drivingRequirement: "valid driver license required", verdict: verdict({ gapsForBeginner: ["HARD: Valid driver's license required"] }) }));
    expect(j.list).toBe("best_fit");
    expect(j.gaps.driving).toHaveLength(1);
  });
});

describe("distance from Canoga Park and the pay it asks for", () => {
  it("resolves places, splits LA from OC, and flags assumed locations", () => {
    expect(locate("Chatsworth", "Los Angeles")).toMatchObject({ area: "LA", estimated: false });
    expect(locate("Chatsworth").miles).toBeLessThan(6);
    expect(locate("Anaheim", "Orange")).toMatchObject({ area: "OC", estimated: false });
    expect(locate("Anaheim").miles).toBeGreaterThan(40);
    expect(locate("Carson (Wilmington listed as additional location)").place).toBe("Carson");
    expect(locate("Los Angeles")).toMatchObject({ area: "LA", estimated: true });
    expect(locate("somewhere unnamed", "Orange")).toMatchObject({ area: "OC", estimated: true, place: "Santa Ana" });
  });
  it("asks for $35 nearby and more further away", () => {
    expect(targetHourly(5)).toBe(35);
    expect(targetHourly(15)).toBe(35);
    expect(targetHourly(25)).toBe(39.5);
    expect(targetHourly(locate("Irvine").miles)).toBeGreaterThan(50);
  });
  it("moves a job that tops out below the distance target to its own list, with the numbers", () => {
    const near = scoreRow(row({ city: "Chatsworth", payMinAnnual: 33 * 2080, payMaxAnnual: 36 * 2080 }));
    expect(near.list).toBe("best_fit");
    expect(near.targetHourly).toBe(35);
    const far = scoreRow(row({ city: "Anaheim", county: "Orange", payMinAnnual: 33 * 2080, payMaxAnnual: 36 * 2080 }));
    expect(far.list).toBe("below_pay");
    expect(far.area).toBe("OC");
    expect(far.breakdown.pay.note).toMatch(/below your \$\d+\.\d\d\/hr target/);
    const around = scoreRow(row({ city: "Chatsworth", payMinAnnual: 30 * 2080, payMaxAnnual: 33.5 * 2080 }));
    expect(around.list).toBe("best_fit");
    expect(scoreRow(row({ city: "Chatsworth", payMinAnnual: 25 * 2080, payMaxAnnual: 31 * 2080 })).list).toBe("below_pay");
  });
  it("prefers the closer of two otherwise identical jobs", () => {
    const pay = { payMinAnnual: 60 * 2080, payMaxAnnual: 70 * 2080 };
    expect(scoreRow(row({ city: "Van Nuys", ...pay })).score).toBeGreaterThan(scoreRow(row({ city: "Irvine", county: "Orange", ...pay })).score);
  });
});

describe("select", () => {
  it("dedupes the same posting found twice and keeps the better copy", () => {
    const a = scoreRow(row({ slice: "a" }));
    const b = scoreRow(row({ slice: "b", postingUrl: "https://www.governmentjobs.com/careers/example/jobs/1?utm=x", verdict: verdict({ stillOpenConfidence: 0.95 }) }));
    const out = dedupe([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]!.slice).toBe("b");
  });
  it("limits roles per employer, ranks by score and keeps the overflow on the bench", () => {
    const u = (n: number) => `https://careers.example.com/jobs/${n}`;
    const jobs = [
      scoreRow(row({ title: "Role A", postingUrl: u(1), payMinAnnual: 60000, payMaxAnnual: 90000 })),
      scoreRow(row({ title: "Role B", postingUrl: u(2), payMinAnnual: 90000, payMaxAnnual: 99000 })),
      scoreRow(row({ title: "Role C", postingUrl: u(3), payMinAnnual: 50000, payMaxAnnual: 60000 })),
      scoreRow(row({ employer: "Other Co", title: "Tech", postingUrl: u(4), field: "hvac" })),
      scoreRow(row({ title: "Role D", postingUrl: u(7), payMinAnnual: 85000, payMaxAnnual: 95000 })),
      scoreRow(row({ employer: "Third Co", title: "PM", postingUrl: u(5), field: "construction_office", verdict: verdict({ gapsForBeginner: ["SOFT: 2 years of experience"] }) })),
      scoreRow(row({ employer: "Gone Co", title: "Closed", postingUrl: u(6), verdict: verdict({ stillOpenConfidence: 0.1 }) })),
    ];
    const s = select(jobs, { best: 10, stretch: 5, maxPerEmployer: 2 });
    expect(s.bestFit.map((j) => j.title)).toEqual(["Role B", "Role D", "Tech"]);
    expect(s.bench.map((j) => j.title)).toEqual(["Role A"]);
    expect(s.belowPay.map((j) => j.title)).toEqual(["Role C"]);
    expect(s.stretch.map((j) => j.title)).toEqual(["PM"]);
    expect(s.ruledOut.map((j) => j.title)).toEqual(["Closed"]);
  });
  it("gives stable ids", () => {
    expect(stableId("A", "b", "c")).toBe(stableId("a", "B", "C"));
    expect(stableId("a", "b", "c")).not.toBe(stableId("a", "b", "d"));
  });
});
