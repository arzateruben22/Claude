/**
 * Pure tests for the ingestion matcher's scoring and decision rules (no database).
 */
import { describe, expect, it } from "vitest";
import {
  COMPANY_MIN_SIMILARITY,
  MATCH_MARGIN,
  companySimilarity,
  decideMatch,
  locationAgreement,
  locationKey,
  normalizeRequisition,
  scoreMatch,
  subjectFromApplication,
  subjectFromPartial,
  titleSimilarity,
  type ApplicationLike,
  type PartialFields,
} from "@/lib/ingest/match-score";
import { INGEST_THRESHOLDS } from "@/lib/ingest/types";
import {
  normalizeCompany,
  normalizeTitle,
  normalizeUrl,
} from "@/lib/applications/normalize";

const { MATCH_SURE, MATCH_POSSIBLE } = INGEST_THRESHOLDS;

function app(
  over: Partial<ApplicationLike> & {
    company?: string;
    title?: string;
    url?: string | null;
  } = {},
): ApplicationLike {
  const company = over.company ?? "Acme Electric";
  const title = over.title ?? "Apprentice Electrician";
  return {
    normalizedCompany: over.normalizedCompany ?? normalizeCompany(company),
    normalizedTitle: over.normalizedTitle ?? normalizeTitle(title),
    location: over.location ?? null,
    requisitionNumber: over.requisitionNumber ?? null,
    normalizedUrl: over.normalizedUrl ?? normalizeUrl(over.url ?? null),
    source: over.source ?? "OTHER",
    appliedAt: over.appliedAt ?? null,
    createdAt: over.createdAt ?? new Date("2026-01-12T17:00:00Z"),
  };
}

const score = (p: PartialFields, a: ApplicationLike, ctx = {}) =>
  scoreMatch(subjectFromPartial(p), subjectFromApplication(a), ctx);

describe("field comparisons", () => {
  it("treats legal-suffix and case variants as the same company", () => {
    expect(normalizeCompany("Acme Electric Inc")).toBe(
      normalizeCompany("ACME Electric"),
    );
    expect(
      companySimilarity(
        normalizeCompany("Acme Electric Inc"),
        normalizeCompany("ACME Electric"),
      ),
    ).toBe(1);
    expect(
      companySimilarity(
        normalizeCompany("Harbor Line Elevator Co."),
        normalizeCompany("Harbor Line Elevator"),
      ),
    ).toBe(1);
  });

  it("raises a leading multi-word company prefix to at least 0.88, but a shared first word is not enough", () => {
    const prefix = companySimilarity(
      "southland electrical",
      "southland electrical jatc",
    );
    expect(prefix).toBeGreaterThanOrEqual(0.88);
    expect(prefix).toBeLessThan(1);
    expect(
      companySimilarity("pacific coast", "pacific coast mechanical services"),
    ).toBeGreaterThanOrEqual(0.88);
    expect(
      companySimilarity(
        "southland realty partners",
        "southland electrical jatc",
      ),
    ).toBeLessThan(COMPANY_MIN_SIMILARITY);
    expect(
      companySimilarity("tradeforce staffing", "sunrise aerospace components"),
    ).toBeLessThan(0.5);
    expect(companySimilarity(null, "acme")).toBe(0);
  });

  it("compares titles regardless of word order and separates explicit levels", () => {
    expect(
      titleSimilarity("apprentice electrician", "apprentice electrician"),
    ).toBe(1);
    expect(
      titleSimilarity("apprentice electrician", "electrician apprentice"),
    ).toBeGreaterThanOrEqual(0.97);
    expect(
      titleSimilarity("electrician i", "electrician ii"),
    ).toBeLessThanOrEqual(0.6);
    expect(
      titleSimilarity(
        "construction project coordinator",
        "assistant project manager",
      ),
    ).toBeLessThan(0.5);
  });

  it("reduces locations to a city key", () => {
    expect(locationKey("Anaheim, CA 92801")).toBe("anaheim");
    expect(locationKey("Anaheim CA")).toBe("anaheim");
    expect(locationKey("Hybrid - Irvine, CA")).toBe("irvine");
    expect(locationKey("Remote")).toBeNull();
    expect(locationKey(null)).toBeNull();
    expect(
      locationAgreement("Long Beach, CA", "Long Beach, California 90802"),
    ).toBe("same");
    expect(locationAgreement("Anaheim, CA", "Long Beach, CA")).toBe(
      "different",
    );
    expect(locationAgreement("Anaheim, CA", "Remote")).toBe("unknown");
  });

  it("compares requisitions without punctuation or case", () => {
    expect(normalizeRequisition("R-2026-01844")).toBe(
      normalizeRequisition("r202601844"),
    );
    expect(normalizeRequisition("  ")).toBeNull();
    expect(normalizeRequisition("12")).toBeNull();
  });
});

describe("scoreMatch scenarios", () => {
  it("matches an Indeed posting to the Workday confirmation for the same job (sure)", () => {
    const indeed = app({
      company: "Harbor Line Elevator Co.",
      title: "Elevator Mechanic Helper",
      location: "Long Beach, CA",
      url: "https://www.indeed.com/viewjob?jk=7c1e5a9b2d4f6a08&from=serp",
      source: "INDEED",
      createdAt: new Date("2026-01-18T17:00:00Z"),
    });
    const s = score(
      {
        company: "Harbor Line Elevator Co.",
        title: "Elevator Mechanic Helper (Long Beach)",
        location: "Long Beach, CA 90802",
        requisitionId: "R-2026-01844",
        postingUrl:
          "https://harborline.wd5.myworkdayjobs.com/en-US/careers/job/Long-Beach/Elevator-Mechanic-Helper_R-2026-01844",
        platform: "WORKDAY",
        observedAt: new Date("2026-01-20T22:05:51Z"),
      },
      indeed,
    );
    expect(s.score).toBeGreaterThanOrEqual(MATCH_SURE);
    expect(s.deterministic).toBe(false);
    expect(s.signals.map((x) => x.key)).toEqual(
      expect.arrayContaining(["company", "title", "location", "date"]),
    );
    expect(s.signals.find((x) => x.key === "url_conflict")).toBeUndefined();
    expect(
      decideMatch([{ applicationId: "indeed", score: s.score }]),
    ).toMatchObject({ outcome: "match", applicationId: "indeed" });
  });

  it("does not match the same company with a different title", () => {
    const s = score(
      { company: "Golden State Builders", title: "Assistant Project Manager" },
      app({
        company: "Golden State Builders",
        title: "Construction Project Coordinator",
        location: "Irvine, CA",
      }),
    );
    expect(s.score).toBeLessThan(MATCH_POSSIBLE);
    expect(s.signals.find((x) => x.key === "title")?.effect).toBe("negative");
  });

  it("asks for review when the same title is at a different location", () => {
    const s = score(
      {
        company: "Acme Electric",
        title: "Apprentice Electrician",
        location: "Long Beach, CA",
      },
      app({ location: "Anaheim, CA" }),
    );
    expect(s.score).toBeGreaterThanOrEqual(MATCH_POSSIBLE);
    expect(s.score).toBeLessThan(MATCH_SURE);
    expect(s.signals.find((x) => x.key === "location")).toMatchObject({
      effect: "negative",
    });
  });

  it("never fuzzy-matches a staffing agency to the client company, but a shared posting link still matches", () => {
    const client = app({
      company: "Sunrise Aerospace Components",
      title: "Industrial Maintenance Technician",
      url: "https://www.indeed.com/viewjob?jk=abc123def456",
    });
    const fuzzy = score(
      {
        company: "TradeForce Staffing",
        title: "Industrial Maintenance Technician",
      },
      client,
    );
    expect(fuzzy.score).toBeLessThan(MATCH_POSSIBLE);
    expect(fuzzy.signals.find((x) => x.key === "company")?.effect).toBe(
      "negative",
    );

    const viaUrl = score(
      {
        company: "TradeForce Staffing",
        title: "Industrial Maintenance Technician",
        postingUrl:
          "https://indeed.com/viewjob?jk=ABC123DEF456&utm_source=email",
      },
      client,
    );
    expect(viaUrl.score).toBe(0.98);
    expect(viaUrl.deterministic).toBe(true);
  });

  it('matches "Acme Electric Inc" to "ACME Electric" for the same title', () => {
    const s = score(
      { company: "Acme Electric Inc", title: "Apprentice Electrician" },
      app({ company: "ACME Electric" }),
    );
    expect(s.score).toBeGreaterThanOrEqual(MATCH_SURE);
    expect(s.signals.find((x) => x.key === "company")?.label).toBe(
      "Same company",
    );
  });

  it("treats the same requisition at the same company as certain, even with a reworded title", () => {
    const s = score(
      {
        company: "Harbor Line Elevator Co.",
        title: "Elevator Helper",
        requisitionId: "r-2026-01844",
      },
      app({
        company: "Harbor Line Elevator Co.",
        title: "Elevator Mechanic Helper",
        requisitionNumber: "R-2026-01844",
      }),
    );
    expect(s.score).toBe(1);
    expect(s.deterministic).toBe(true);
    expect(s.signals[0]).toMatchObject({
      key: "requisition",
      effect: "strong",
    });
  });

  it("separates postings with different requisitions at the same company", () => {
    const s = score(
      {
        company: "Harbor Line Elevator Co.",
        title: "Elevator Mechanic Helper",
        requisitionId: "R-2026-02210",
      },
      app({
        company: "Harbor Line Elevator Co.",
        title: "Elevator Mechanic Helper",
        requisitionNumber: "R-2026-01844",
      }),
    );
    expect(s.score).toBeLessThan(MATCH_POSSIBLE);
    expect(s.signals.map((x) => x.key)).toContain("requisition_conflict");
  });

  it("keeps a company-only observation (no title) in the review band", () => {
    const s = score({ company: "Acme Electric" }, app());
    expect(s.score).toBeGreaterThanOrEqual(MATCH_POSSIBLE);
    expect(s.score).toBeLessThan(MATCH_SURE);
  });

  it("does not treat Electrician I and Electrician II as the same job", () => {
    const s = score(
      { company: "Acme Electric", title: "Electrician II" },
      app({ title: "Electrician I" }),
    );
    expect(s.score).toBeLessThan(MATCH_SURE);
  });

  it("penalises different postings on the same board and very old records", () => {
    const base = app({ url: "https://www.indeed.com/viewjob?jk=aaaa1111" });
    const other = score(
      {
        company: "Acme Electric",
        title: "Apprentice Electrician",
        postingUrl: "https://www.indeed.com/viewjob?jk=bbbb2222",
      },
      base,
    );
    const same = score(
      { company: "Acme Electric", title: "Apprentice Electrician" },
      base,
    );
    expect(other.score).toBeLessThan(same.score);
    expect(other.signals.map((x) => x.key)).toContain("url_conflict");

    const old = score(
      {
        company: "Acme Electric",
        title: "Apprentice Electrician",
        observedAt: new Date("2027-03-01T00:00:00Z"),
      },
      app({ appliedAt: new Date("2026-01-12T00:00:00Z") }),
    );
    expect(old.score).toBeLessThan(MATCH_SURE);
  });

  it("scores explicit choices, linked threads and saved source links deterministically", () => {
    const unrelated = app({ company: "Someone Else", title: "Plumber" });
    expect(
      score({ company: "Acme Electric" }, unrelated, { explicit: true }).score,
    ).toBe(1);
    expect(
      score({ company: "Acme Electric" }, unrelated, { threadLinked: true })
        .score,
    ).toBe(0.97);
    expect(
      score({ company: "Acme Electric" }, unrelated, { sourceLinkMatch: true })
        .score,
    ).toBe(0.97);
  });

  it("never lets a fuzzy score reach the deterministic band", () => {
    const s = score(
      {
        company: "Acme Electric",
        title: "Apprentice Electrician",
        location: "Anaheim, CA",
        observedAt: new Date("2026-01-12T18:00:00Z"),
      },
      app({
        location: "Anaheim, CA 92801",
        appliedAt: new Date("2026-01-12T17:00:00Z"),
      }),
    );
    expect(s.score).toBe(0.96);
  });
});

describe("decideMatch", () => {
  it("requires a margin over the runner-up for a sure match", () => {
    expect(
      decideMatch([
        { applicationId: "a", score: 0.95 },
        { applicationId: "b", score: 0.94 },
      ]),
    ).toMatchObject({
      outcome: "review",
      candidateIds: ["a", "b"],
    });
    expect(
      decideMatch([
        { applicationId: "a", score: 0.95 },
        { applicationId: "b", score: 0.95 - MATCH_MARGIN },
      ]),
    ).toMatchObject({
      outcome: "match",
      applicationId: "a",
    });
    expect(
      decideMatch([
        { applicationId: "b", score: 0.72 },
        { applicationId: "a", score: 0.96 },
      ]),
    ).toMatchObject({
      outcome: "match",
      applicationId: "a",
    });
  });

  it("routes the possible band to review and ignores weak candidates", () => {
    expect(
      decideMatch([
        { applicationId: "a", score: 0.7 },
        { applicationId: "b", score: 0.4 },
      ]),
    ).toEqual({
      outcome: "review",
      candidateIds: ["a"],
      topScore: 0.7,
    });
    expect(decideMatch([{ applicationId: "a", score: 0.6 }])).toEqual({
      outcome: "none",
      candidateIds: [],
    });
    expect(decideMatch([])).toEqual({ outcome: "none", candidateIds: [] });
  });
});
