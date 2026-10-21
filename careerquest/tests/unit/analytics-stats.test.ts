import { describe, expect, it } from "vitest";
import { LOW_SAMPLE_N, mean, median, rateEstimate, wilsonInterval } from "@/lib/analytics/stats";

describe("wilsonInterval", () => {
  it("returns null without trials", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(3, -1)).toBeNull();
    expect(wilsonInterval(Number.NaN, 5)).toBeNull();
  });

  it("matches the textbook value for 5/10 at 95%", () => {
    const iv = wilsonInterval(5, 10)!;
    expect(iv.low).toBeCloseTo(0.2366, 3);
    expect(iv.high).toBeCloseTo(0.7634, 3);
  });

  it("stays inside [0, 1] at the extremes", () => {
    const none = wilsonInterval(0, 10)!;
    expect(none.low).toBe(0);
    expect(none.high).toBeCloseTo(0.2775, 3);
    const all = wilsonInterval(10, 10)!;
    expect(all.low).toBeCloseTo(0.7225, 3);
    expect(all.high).toBe(1);
  });

  it("narrows as n grows and always contains the point estimate", () => {
    const small = wilsonInterval(3, 10)!;
    const large = wilsonInterval(300, 1000)!;
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
    expect(small.low).toBeLessThanOrEqual(0.3);
    expect(small.high).toBeGreaterThanOrEqual(0.3);
    expect(large.low).toBeLessThanOrEqual(0.3);
    expect(large.high).toBeGreaterThanOrEqual(0.3);
  });

  it("clamps successes to n", () => {
    expect(wilsonInterval(12, 10)).toEqual(wilsonInterval(10, 10));
  });

  it("widens with a larger z", () => {
    const z95 = wilsonInterval(5, 20)!;
    const z99 = wilsonInterval(5, 20, 2.576)!;
    expect(z99.high - z99.low).toBeGreaterThan(z95.high - z95.low);
  });
});

describe("rateEstimate", () => {
  it("flags low samples below the threshold", () => {
    expect(rateEstimate(2, LOW_SAMPLE_N - 1).lowSample).toBe(true);
    expect(rateEstimate(2, LOW_SAMPLE_N).lowSample).toBe(false);
  });

  it("reports null value and interval when n = 0", () => {
    expect(rateEstimate(0, 0)).toEqual({ value: null, successes: 0, n: 0, interval: null, lowSample: true });
  });

  it("computes the observed proportion", () => {
    const r = rateEstimate(3, 12);
    expect(r.value).toBeCloseTo(0.25, 5);
    expect(r.successes).toBe(3);
    expect(r.n).toBe(12);
    expect(r.interval).not.toBeNull();
  });
});

describe("mean / median", () => {
  it("handle empty input", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });

  it("compute standard values", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("ignore non-finite entries", () => {
    expect(mean([1, Number.NaN, 3])).toBe(2);
  });
});
