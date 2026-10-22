import { describe, expect, it } from "vitest";
import {
  betaBinomialPmf,
  betaBinomialQuantile,
  betaInterval,
  betaQuantile,
  logGamma,
  probAtLeastOne,
  probAtLeastOneFixed,
  regIncBeta,
} from "@/lib/forecast/beta";
import { DEFAULT_RHO, designEffect, parseRho } from "@/lib/forecast/clustering";
import {
  INTERVIEW_PRIOR,
  OFFER_PRIOR,
  TARGETS,
  applicationsNeeded,
  applicationsNeededFixed,
  chartSeries,
  computeForecast,
  posterior,
  predictiveRange,
  scenarioForecast,
  thresholdRows,
} from "@/lib/forecast/model";
import { quantile, summarizeTiming } from "@/lib/forecast/timing";
import { expectationSentence, formatRange, formatRate, niceRange, niceStep } from "@/lib/forecast/format";
import { buildForecastInput, type ForecastRow } from "@/lib/forecast/data";

describe("special functions", () => {
  it("logGamma matches factorials and Γ(1/2)", () => {
    expect(logGamma(1)).toBeCloseTo(0, 12);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(logGamma(11)).toBeCloseTo(Math.log(3628800), 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(logGamma(171)).toBeCloseTo(706.5730622457874, 8);
  });

  it("regularized incomplete beta matches closed forms", () => {
    // I_x(1, b) = 1 − (1 − x)^b
    expect(regIncBeta(0.2, 1, 9)).toBeCloseTo(1 - 0.8 ** 9, 12);
    // I_0.5(2, 3) = Σ_{j=2..4} C(4, j) / 16 = 11/16
    expect(regIncBeta(0.5, 2, 3)).toBeCloseTo(11 / 16, 12);
    // Symmetry I_x(a, b) = 1 − I_{1−x}(b, a)
    expect(regIncBeta(0.3, 4.5, 7.25) + regIncBeta(0.7, 7.25, 4.5)).toBeCloseTo(1, 12);
    expect(regIncBeta(0, 2, 2)).toBe(0);
    expect(regIncBeta(1, 2, 2)).toBe(1);
  });

  it("beta quantiles invert the CDF, including large parameters", () => {
    // Beta(1, 9): F(x) = 1 − (1 − x)^9 → q-quantile = 1 − (1 − q)^(1/9)
    expect(betaQuantile(0.975, 1, 9)).toBeCloseTo(1 - 0.025 ** (1 / 9), 10);
    expect(betaQuantile(0.025, 1, 9)).toBeCloseTo(1 - 0.975 ** (1 / 9), 10);
    const big = betaQuantile(0.5, 501, 4501);
    expect(regIncBeta(big, 501, 4501)).toBeCloseTo(0.5, 9);
    expect(big).toBeGreaterThan(0.099);
    expect(big).toBeLessThan(0.101);
  });

  it("posterior predictive P(≥1) has the closed form m/(β+m) when α = 1", () => {
    expect(probAtLeastOne(1, 9, 9)).toBeCloseTo(0.5, 12);
    expect(probAtLeastOne(1, 9, 36)).toBeCloseTo(0.8, 12);
    expect(probAtLeastOne(1, 109, 981)).toBeCloseTo(0.9, 12);
    expect(probAtLeastOne(3, 5, 0)).toBe(0);
    // Uncertainty about p lowers P(≥1) relative to plugging in the posterior mean (Jensen).
    expect(probAtLeastOne(9, 101, 30)).toBeLessThan(probAtLeastOneFixed(9 / 110, 30));
  });

  it("beta-binomial pmf sums to one and is uniform for Beta(1, 1)", () => {
    for (let k = 0; k <= 10; k++) expect(betaBinomialPmf(k, 10, 1, 1)).toBeCloseTo(1 / 11, 12);
    let s = 0;
    for (let k = 0; k <= 25; k++) s += betaBinomialPmf(k, 25, 9, 101);
    expect(s).toBeCloseTo(1, 10);
    expect(betaBinomialQuantile(0.5, 10, 1, 1)).toBe(5);
    expect(betaBinomialPmf(11, 10, 1, 1)).toBe(0);
  });
});

describe("Beta-Binomial posterior", () => {
  it("updates the stated prior with observed counts (8 interviews / 100 applications)", () => {
    const post = posterior(INTERVIEW_PRIOR, 8, 100);
    expect(post.alpha).toBe(9);
    expect(post.beta).toBe(101);
    expect(post.mean).toBeCloseTo(9 / 110, 12);
    expect(post.priorWeight).toBeCloseTo(10 / 110, 12);
    const iv = betaInterval(9, 101);
    expect(post.interval.low).toBeCloseTo(iv.low, 12);
    expect(post.interval.low).toBeLessThan(0.08);
    expect(post.interval.high).toBeGreaterThan(0.08);
    // Equal tails
    expect(regIncBeta(post.interval.low, 9, 101)).toBeCloseTo(0.025, 9);
    expect(regIncBeta(post.interval.high, 9, 101)).toBeCloseTo(0.975, 9);
  });

  it("states the prior intervals the methodology text quotes", () => {
    expect(betaQuantile(0.025, INTERVIEW_PRIOR.alpha, INTERVIEW_PRIOR.beta)).toBeCloseTo(0.0028, 4);
    expect(betaQuantile(0.975, INTERVIEW_PRIOR.alpha, INTERVIEW_PRIOR.beta)).toBeCloseTo(0.336, 3);
    expect(betaQuantile(0.025, OFFER_PRIOR.alpha, OFFER_PRIOR.beta)).toBeCloseTo(0.0005, 4);
    expect(betaQuantile(0.975, OFFER_PRIOR.alpha, OFFER_PRIOR.beta)).toBeCloseTo(0.0725, 3);
  });

  it("scaling to an effective sample keeps the rate but widens the interval", () => {
    const naive = posterior(INTERVIEW_PRIOR, 20, 100);
    const adjusted = posterior(INTERVIEW_PRIOR, 20, 100, 0.5);
    expect(adjusted.alpha).toBe(11);
    expect(adjusted.beta).toBe(49);
    expect(adjusted.interval.high - adjusted.interval.low).toBeGreaterThan(naive.interval.high - naive.interval.low);
    expect(adjusted.priorWeight).toBeGreaterThan(naive.priorWeight);
  });

  it("predictive range for the next N applications brackets the expectation", () => {
    const post = posterior(INTERVIEW_PRIOR, 8, 100);
    const r = predictiveRange(post, 25);
    expect(r.expected).toBeCloseTo(25 * (9 / 110), 12);
    expect(r.low).toBeLessThanOrEqual(Math.floor(r.expected));
    expect(r.high).toBeGreaterThanOrEqual(Math.ceil(r.expected));
    expect(r.probAtLeastOne).toBeCloseTo(probAtLeastOne(9, 101, 25), 12);
  });
});

describe("applications needed", () => {
  it("matches the closed form for α = 1", () => {
    // P(≥1 in m) = m / (9 + m)
    expect(applicationsNeeded(1, 9, 0.5)).toBe(9);
    expect(applicationsNeeded(1, 9, 0.8)).toBe(36);
    expect(applicationsNeeded(1, 9, 0.9)).toBe(81);
    expect(applicationsNeeded(1, 109, 0.9)).toBe(981);
  });

  it("is the smallest m reaching the target", () => {
    const m = applicationsNeeded(9, 101, 0.8)!;
    expect(probAtLeastOne(9, 101, m)).toBeGreaterThanOrEqual(0.8);
    expect(probAtLeastOne(9, 101, m - 1)).toBeLessThan(0.8);
  });

  it("returns null beyond the search limit", () => {
    expect(applicationsNeeded(1, 9, 0.9, 50)).toBeNull();
    expect(applicationsNeededFixed(0, 0.5)).toBeNull();
    expect(applicationsNeededFixed(0.1, 0.5)).toBe(7);
    expect(applicationsNeededFixed(1, 0.9)).toBe(1);
  });

  it("is monotonic in the target and in the evidence", () => {
    const cases: [number, number][] = [
      [0, 0],
      [0, 10],
      [1, 10],
      [8, 100],
      [0, 200],
      [40, 100],
    ];
    for (const [k, n] of cases) {
      for (const scale of [1, 0.4]) {
        const naive = posterior(INTERVIEW_PRIOR, k, n);
        const adjusted = posterior(INTERVIEW_PRIOR, k, n, scale);
        const rows = thresholdRows(naive, adjusted);
        expect(rows.map((r) => r.target)).toEqual([...TARGETS]);
        for (let i = 1; i < rows.length; i++) {
          expect(rows[i]!.naive!).toBeGreaterThanOrEqual(rows[i - 1]!.naive!);
          expect(rows[i]!.adjusted!).toBeGreaterThanOrEqual(rows[i - 1]!.adjusted!);
          expect(rows[i]!.range.low).toBeGreaterThanOrEqual(rows[i - 1]!.range.low);
          expect(rows[i]!.range.high!).toBeGreaterThanOrEqual(rows[i - 1]!.range.high!);
        }
        for (const r of rows) {
          expect(r.range.low).toBeLessThanOrEqual(Math.min(r.naive!, r.adjusted!));
          expect(r.range.high!).toBeGreaterThanOrEqual(Math.max(r.naive!, r.adjusted!));
        }
      }
    }
    // More interviews at the same n → fewer applications needed.
    const fewer = applicationsNeeded(1 + 20, 9 + 80, 0.8)!;
    const more = applicationsNeeded(1 + 5, 9 + 95, 0.8)!;
    expect(fewer).toBeLessThan(more);
  });
});

describe("design effect", () => {
  it("uses the size-weighted mean cluster size", () => {
    const d = designEffect([3, 1, 1, 1, 4], 0.3);
    expect(d.n).toBe(10);
    expect(d.clusters).toBe(5);
    expect(d.meanClusterSize).toBeCloseTo(2.8, 12);
    expect(d.deff).toBeCloseTo(1 + 0.3 * 1.8, 12);
    expect(d.nEff).toBeCloseTo(10 / 1.54, 12);
    expect(d.largestCluster).toBe(4);
  });

  it("equals the textbook 1 + ρ(m − 1) for equal clusters and is 1 without clustering", () => {
    expect(designEffect([5, 5], 0.3).deff).toBeCloseTo(2.2, 12);
    expect(designEffect([1, 1, 1, 1], 0.8).deff).toBe(1);
    expect(designEffect([4, 4, 4], 0).nEff).toBe(12);
    expect(designEffect([], 0.3)).toMatchObject({ n: 0, nEff: 0, deff: 1 });
  });

  it("parses ρ only from the offered options", () => {
    expect(parseRho(undefined)).toBe(DEFAULT_RHO);
    expect(parseRho("0.5")).toBe(0.5);
    expect(parseRho("0")).toBe(0);
    expect(parseRho("0.42")).toBe(DEFAULT_RHO);
    expect(parseRho(["0.8", "0.1"])).toBe(0.8);
    expect(parseRho("abc")).toBe(DEFAULT_RHO);
  });
});

describe("timing", () => {
  it("computes type-7 quartiles and hides the IQR below 4 observations", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 12);
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 12);
    expect(quantile([], 0.5)).toBeNull();
    const t = summarizeTiming([10, 2, 4, 6, 8], 3);
    expect(t).toMatchObject({ n: 5, median: 6, q1: 4, q3: 8, awaiting: 3 });
    expect(summarizeTiming([3, 5], 0)).toMatchObject({ n: 2, median: 4, q1: null, q3: null });
  });
});

describe("format", () => {
  it("rounds ranges outward and never shows a lone number", () => {
    expect(niceRange(23, 23)).toEqual({ low: 20, high: 25 });
    expect(niceRange(9, 9)).toEqual({ low: 9, high: 10 });
    expect(niceRange(81, 96)).toEqual({ low: 80, high: 100 });
    expect(niceRange(981, 1220)).toEqual({ low: 950, high: 1300 });
    expect(niceRange(null, null)).toEqual({ low: 100_000, high: null });
    expect(niceRange(5000, null)).toEqual({ low: 5000, high: null });
    expect(niceStep(49)).toBe(5);
    expect(formatRange({ low: 20, high: 25 })).toBe("20–25");
    expect(formatRange({ low: 5000, high: null })).toBe("more than 5,000");
  });

  it("formats rates without false precision", () => {
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(0.004)).toBe("<1%");
    expect(formatRate(0.0818)).toBe("8%");
    expect(formatRate(0.995)).toBe(">99%");
    expect(formatRate(null)).toBe("—");
  });

  it("phrases the headline as a conditional estimate", () => {
    const s = expectationSentence("interview", { low: 20, high: 25 });
    expect(s).toContain("If your current rates hold, roughly 20–25 more applications would be expected to produce one interview (estimate");
    expect(s).not.toMatch(/will get|guarantee|hired by|\b20\d\d-\d\d/i);
  });
});

describe("computeForecast", () => {
  it("reports observed, naive and adjusted results and never a date", () => {
    const sizes = [...Array.from({ length: 10 }, () => 5), ...Array.from({ length: 50 }, () => 1)];
    const r = computeForecast(
      { applied: 100, interviews: 8, offers: 1, clusterSizes: sizes, responseDays: [3, 5, 7, 9, 14], awaitingAgesDays: [1, 2, 30, 60] },
      { rho: 0.3, horizon: 25 },
    );
    expect(r.applied).toBe(100);
    expect(r.interview.observed).toEqual({ successes: 8, n: 100, rate: 0.08 });
    expect(r.design.meanClusterSize).toBeCloseTo((10 * 25 + 50) / 100, 12);
    expect(r.interview.adjusted.n).toBeCloseTo(r.design.nEff, 9);
    expect(r.interview.adjusted.n).toBeLessThan(100);
    expect(r.interview.naive.alpha).toBe(9);
    expect(r.offer.naive.alpha).toBe(2);
    expect(r.offer.naive.beta).toBe(49 + 99);
    expect(r.timing.median).toBe(7);
    expect(r.pendingWindowDays).toBe(9);
    expect(r.recentAwaiting).toBe(2);
    expect(r.quality).toBe("usable");
    expect(r.chart[0]).toMatchObject({ m: 0, center: 0, naive: 0, low: 0, high: 0 });
    for (const p of r.chart) {
      expect(p.low).toBeLessThanOrEqual(p.high);
      expect(p.center).toBeGreaterThanOrEqual(0);
      expect(p.center).toBeLessThanOrEqual(1);
    }
    expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("flags prior-dominated and empty histories", () => {
    expect(computeForecast({ applied: 0, interviews: 0, offers: 0, clusterSizes: [], responseDays: [], awaitingAgesDays: [] }).quality).toBe("none");
    const few = computeForecast({ applied: 4, interviews: 0, offers: 0, clusterSizes: [1, 1, 1, 1], responseDays: [], awaitingAgesDays: [] });
    expect(few.quality).toBe("prior-dominated");
    expect(few.interview.priorDominated).toBe(true);
    expect(few.pendingWindowDays).toBe(14);
  });

  it("chart series ends past the adjusted 90% threshold", () => {
    const naive = posterior(INTERVIEW_PRIOR, 8, 100);
    const adjusted = posterior(INTERVIEW_PRIOR, 8, 100, 0.6);
    const series = chartSeries(naive, adjusted);
    const m90 = applicationsNeeded(adjusted.alpha, adjusted.beta, 0.9)!;
    expect(series[series.length - 1]!.m).toBeGreaterThanOrEqual(m90);
    expect(series.length).toBeLessThanOrEqual(62);
    for (let i = 1; i < series.length; i++) expect(series[i]!.center).toBeGreaterThanOrEqual(series[i - 1]!.center);
  });
});

describe("scenario mode", () => {
  it("uses fixed hypothetical rates and independence", () => {
    const s = scenarioForecast({ interviewRate: 0.1, offerRate: 0.02, applications: 25 });
    expect(s.interview.thresholds.map((t) => t.applications)).toEqual([7, 16, 22]);
    expect(s.interview.probAtLeastOne).toBeCloseTo(1 - 0.9 ** 25, 12);
    expect(s.offer.expected).toBeCloseTo(0.5, 12);
    expect(scenarioForecast({ interviewRate: 0, offerRate: 0, applications: 10 }).interview.thresholds[0]!.applications).toBeNull();
  });
});

describe("buildForecastInput", () => {
  const base = { source: "INDEED" as const, jobCategory: null, resumeVersionId: null, statusHistory: [], events: [] };
  const now = new Date("2026-10-22T12:00:00Z");
  const rows: ForecastRow[] = [
    { ...base, id: "a", clusterKey: "e1", status: "INTERVIEWING", appliedAt: new Date("2026-10-01T12:00:00Z"), statusHistory: [{ toStatus: "INTERVIEWING", occurredAt: new Date("2026-10-06T12:00:00Z") }] },
    { ...base, id: "b", clusterKey: "e1", status: "REJECTED", appliedAt: new Date("2026-10-02T12:00:00Z"), statusHistory: [{ toStatus: "REJECTED", occurredAt: new Date("2026-10-04T12:00:00Z") }] },
    { ...base, id: "c", clusterKey: "E1 ", status: "SUBMITTED", appliedAt: new Date("2026-10-20T12:00:00Z") },
    { ...base, id: "d", clusterKey: "e2", status: "OFFER", appliedAt: new Date("2026-09-01T12:00:00Z") },
    { ...base, id: "e", clusterKey: "e3", status: "SAVED", appliedAt: null },
  ];

  it("counts applied applications per employer with funnel semantics", () => {
    const input = buildForecastInput(rows, now);
    expect(input.applied).toBe(4);
    expect(input.interviews).toBe(2);
    expect(input.offers).toBe(1);
    expect(input.clusterSizes.sort()).toEqual([1, 3]);
    expect(input.responseDays.sort((x, y) => x - y)).toEqual([2, 5]);
    expect(input.awaitingAgesDays).toEqual([2]);
  });
});
