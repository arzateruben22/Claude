import { describe, expect, it } from "vitest";
import { analyticsHref, analyticsQueryString, exportHref, hasActiveFilters, parseAnalyticsFilters, resolveRange, searchParamsToRecord } from "@/lib/analytics/filters";
import { addDaysKey, instantDateKey, isValidDayKey, rangeBounds, startOfDayInTz, weekStartKey } from "@/lib/analytics/time";

describe("parseAnalyticsFilters", () => {
  it("defaults to all time with nothing selected", () => {
    expect(parseAnalyticsFilters({})).toEqual({
      range: "all",
      from: undefined,
      to: undefined,
      status: undefined,
      source: undefined,
      category: undefined,
      employer: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
      location: undefined,
      includeArchived: false,
    });
  });

  it("accepts presets and ignores stray dates when a preset is explicit", () => {
    const f = parseAnalyticsFilters({ range: "30d", from: "2026-01-01", to: "2026-02-01" });
    expect(f.range).toBe("30d");
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
  });

  it("switches to custom when dates are given without a preset, and orders them", () => {
    const f = parseAnalyticsFilters({ from: "2026-03-01", to: "2026-02-01" });
    expect(f).toMatchObject({ range: "custom", from: "2026-02-01", to: "2026-03-01" });
    expect(parseAnalyticsFilters({ range: "custom", from: "2026-02-01" })).toMatchObject({ range: "custom", from: "2026-02-01", to: undefined });
  });

  it("falls back to all time for custom without valid dates", () => {
    expect(parseAnalyticsFilters({ range: "custom" }).range).toBe("all");
    expect(parseAnalyticsFilters({ range: "custom", from: "nope" }).range).toBe("all");
    expect(parseAnalyticsFilters({ from: "2026-02-30" }).range).toBe("all");
  });

  it("parses multi-value status and source from arrays or comma lists, dropping unknowns", () => {
    expect(parseAnalyticsFilters({ status: ["submitted", "BOGUS", "OFFER"] }).status).toEqual(["SUBMITTED", "OFFER"]);
    expect(parseAnalyticsFilters({ status: "interviewing,offer,offer" }).status).toEqual(["INTERVIEWING", "OFFER"]);
    expect(parseAnalyticsFilters({ source: "indeed,linkedin" }).source).toEqual(["INDEED", "LINKEDIN"]);
    expect(parseAnalyticsFilters({ status: "BOGUS" }).status).toBeUndefined();
  });

  it("parses text and money filters with sane limits", () => {
    const f = parseAnalyticsFilters({ category: "  HVAC ", employer: "Acme", location: "Irvine", salaryMin: "$90,000", salaryMax: "80000", archived: "1" });
    expect(f).toMatchObject({ category: "HVAC", employer: "Acme", location: "Irvine", salaryMin: 80000, salaryMax: 90000, includeArchived: true });
    expect(parseAnalyticsFilters({ salaryMin: "-5" }).salaryMin).toBeUndefined();
    expect(parseAnalyticsFilters({ salaryMin: "abc" }).salaryMin).toBeUndefined();
    expect(parseAnalyticsFilters({ category: "" }).category).toBeUndefined();
  });

  it("reads a URLSearchParams record the same way", () => {
    const rec = searchParamsToRecord(new URLSearchParams("status=SUBMITTED&status=OFFER&range=7d"));
    expect(rec).toEqual({ status: ["SUBMITTED", "OFFER"], range: "7d" });
    expect(parseAnalyticsFilters(rec)).toMatchObject({ range: "7d", status: ["SUBMITTED", "OFFER"] });
  });
});

describe("hrefs", () => {
  it("round-trips through the query string", () => {
    const f = parseAnalyticsFilters({ range: "custom", from: "2026-01-01", to: "2026-01-31", status: "SUBMITTED,OFFER", source: "INDEED", category: "HVAC", employer: "Acme & Co", salaryMin: "1", location: "LA", archived: "1" });
    const qs = analyticsQueryString(f);
    expect(parseAnalyticsFilters(searchParamsToRecord(new URLSearchParams(qs)))).toEqual(f);
    expect(analyticsHref(f)).toBe(`/analytics?${qs}`);
    expect(exportHref(f)).toBe(`/api/export/applications?${qs}`);
  });

  it("omits defaults entirely", () => {
    const f = parseAnalyticsFilters({});
    expect(analyticsQueryString(f)).toBe("");
    expect(analyticsHref(f)).toBe("/analytics");
    expect(exportHref(f)).toBe("/api/export/applications");
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("applies overrides and clears with null", () => {
    const f = parseAnalyticsFilters({ range: "30d", source: "INDEED" });
    expect(analyticsHref(f, { range: "7d" })).toBe("/analytics?range=7d&source=INDEED");
    expect(analyticsHref(f, { source: null })).toBe("/analytics?range=30d");
    expect(hasActiveFilters(f)).toBe(true);
  });
});

describe("resolveRange", () => {
  const ctx = { todayKey: "2026-10-21", campaignStartKey: "2026-10-10" };

  it("resolves rolling presets ending today", () => {
    expect(resolveRange(parseAnalyticsFilters({ range: "7d" }), ctx)).toMatchObject({ fromKey: "2026-10-15", toKey: "2026-10-21" });
    expect(resolveRange(parseAnalyticsFilters({ range: "30d" }), ctx)).toMatchObject({ fromKey: "2026-09-22", toKey: "2026-10-21" });
    expect(resolveRange(parseAnalyticsFilters({ range: "90d" }), ctx).fromKey).toBe("2026-07-24");
    expect(resolveRange(parseAnalyticsFilters({ range: "7d" }), ctx).label).toBe("Last 7 days (Oct 15 – Oct 21)");
  });

  it("uses the campaign start and never a future date", () => {
    expect(resolveRange(parseAnalyticsFilters({ range: "campaign" }), ctx)).toMatchObject({ fromKey: "2026-10-10", toKey: "2026-10-21" });
    expect(resolveRange(parseAnalyticsFilters({ range: "campaign" }), { ...ctx, campaignStartKey: "2026-11-01" }).fromKey).toBe("2026-10-21");
    expect(resolveRange(parseAnalyticsFilters({ range: "campaign" }), { ...ctx, campaignStartKey: null })).toMatchObject({ fromKey: null, toKey: null });
  });

  it("passes custom bounds through, open-ended when one side is missing", () => {
    expect(resolveRange(parseAnalyticsFilters({ from: "2026-01-01", to: "2026-01-31" }), ctx)).toMatchObject({ fromKey: "2026-01-01", toKey: "2026-01-31", label: "Jan 1 – Jan 31" });
    expect(resolveRange(parseAnalyticsFilters({ to: "2026-01-31" }), ctx)).toMatchObject({ fromKey: null, toKey: "2026-01-31" });
    expect(resolveRange(parseAnalyticsFilters({}), ctx)).toMatchObject({ preset: "all", fromKey: null, toKey: null });
  });
});

describe("time helpers", () => {
  it("validates day keys strictly", () => {
    expect(isValidDayKey("2026-10-21")).toBe(true);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("26-10-21")).toBe(false);
    expect(isValidDayKey(undefined)).toBe(false);
  });

  it("does exact day arithmetic and Monday week starts", () => {
    expect(addDaysKey("2026-10-21", -21)).toBe("2026-09-30");
    expect(weekStartKey("2026-10-21")).toBe("2026-10-19"); // Wednesday → Monday
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12"); // Sunday → previous Monday
    expect(weekStartKey("2026-10-19")).toBe("2026-10-19");
  });

  it("interprets date-only values by UTC date and timestamps in the user's zone", () => {
    expect(instantDateKey(new Date("2026-10-21T00:00:00.000Z"), "America/Los_Angeles")).toBe("2026-10-21");
    expect(instantDateKey(new Date("2026-10-21T03:30:00.000Z"), "America/Los_Angeles")).toBe("2026-10-20");
  });

  it("builds bounds that cover both interpretations", () => {
    const tz = "America/Los_Angeles";
    const b = rangeBounds("2026-10-21", "2026-10-21", tz);
    expect(b.gte!.toISOString()).toBe("2026-10-21T00:00:00.000Z"); // the earlier of UTC midnight and local midnight
    expect(b.lt!.toISOString()).toBe("2026-10-22T07:00:00.000Z"); // the later of UTC end and local end (PDT)
    expect(startOfDayInTz("2026-10-21", tz).toISOString()).toBe("2026-10-21T07:00:00.000Z");
    expect(rangeBounds(null, null, tz)).toEqual({});
  });
});
