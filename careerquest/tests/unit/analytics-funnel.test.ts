import { describe, expect, it } from "vitest";
import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/enums";
import { averageDaysToResponse, classifyApplication, computeFunnel, conversionBy, dailySeries, weeklySeries } from "@/lib/analytics/funnel";
import type { FunnelApplication } from "@/lib/analytics/types";

const d = (iso: string) => new Date(iso);

function app(overrides: Partial<FunnelApplication> & { status: ApplicationStatus }): FunnelApplication {
  return {
    appliedAt: null,
    statusHistory: [],
    events: [],
    source: "INDEED",
    jobCategory: "Electrician",
    resumeVersionId: null,
    ...overrides,
  };
}

const ev = (type: ApplicationEventType, at: string) => ({ type, occurredAt: d(at) });
const hist = (toStatus: ApplicationStatus, at: string) => ({ toStatus, occurredAt: d(at) });

describe("classifyApplication", () => {
  it("treats saved/preparing records as not applied", () => {
    expect(classifyApplication(app({ status: "SAVED" })).applied).toBe(false);
    expect(classifyApplication(app({ status: "PREPARING" })).applied).toBe(false);
  });

  it("counts submitted-or-later statuses and APPLIED events as applied", () => {
    expect(classifyApplication(app({ status: "SUBMITTED" })).applied).toBe(true);
    expect(classifyApplication(app({ status: "CONFIRMED" })).applied).toBe(true);
    expect(classifyApplication(app({ status: "NO_RESPONSE" })).applied).toBe(true);
    expect(classifyApplication(app({ status: "SAVED", events: [ev("APPLIED", "2026-10-01T10:00:00Z")] })).applied).toBe(true);
  });

  it("derives nested stages from the current status", () => {
    const cases: Array<[ApplicationStatus, Partial<ReturnType<typeof classifyApplication>>]> = [
      ["SUBMITTED", { applied: true, responded: false, screened: false, interviewed: false, offers: false, hired: false }],
      ["REJECTED", { applied: true, responded: true, screened: false, interviewed: false, offers: false, hired: false }],
      ["SCREENING", { applied: true, responded: true, screened: true, interviewed: false, offers: false, hired: false }],
      ["INTERVIEWING", { applied: true, responded: true, screened: true, interviewed: true, offers: false, hired: false }],
      ["OFFER", { applied: true, responded: true, screened: true, interviewed: true, offers: true, hired: false }],
      ["ACCEPTED", { applied: true, responded: true, screened: true, interviewed: true, offers: true, hired: true }],
      ["HIRED", { applied: true, responded: true, screened: true, interviewed: true, offers: true, hired: true }],
    ];
    for (const [status, expected] of cases) {
      expect(classifyApplication(app({ status }))).toMatchObject(expected);
    }
  });

  it("uses events when the status does not tell the story", () => {
    const responded = classifyApplication(app({ status: "SUBMITTED", events: [ev("RECRUITER_RESPONSE", "2026-10-03T10:00:00Z")] }));
    expect(responded).toMatchObject({ responded: true, screened: false });

    const interviewed = classifyApplication(app({ status: "SUBMITTED", events: [ev("INTERVIEW_SCHEDULED", "2026-10-03T10:00:00Z")] }));
    expect(interviewed).toMatchObject({ responded: true, screened: true, interviewed: true, offers: false });

    const offered = classifyApplication(app({ status: "CONFIRMED", events: [ev("OFFER_RECEIVED", "2026-10-03T10:00:00Z")] }));
    expect(offered).toMatchObject({ interviewed: true, offers: true, hired: false });

    // Auto-confirmations are not employer responses.
    expect(classifyApplication(app({ status: "SUBMITTED", events: [ev("CONFIRMATION_RECEIVED", "2026-10-03T10:00:00Z")] })).responded).toBe(false);
  });

  it("remembers stages reached in history even after the status moves on", () => {
    const f = classifyApplication(app({ status: "NO_RESPONSE", statusHistory: [hist("SUBMITTED", "2026-10-01T00:00:00Z"), hist("SCREENING", "2026-10-05T00:00:00Z")] }));
    expect(f).toMatchObject({ applied: true, responded: true, screened: true, interviewed: false });
    expect(f.firstResponseAt?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("honors interview/offer rows attached to the application", () => {
    expect(classifyApplication(app({ status: "SUBMITTED", hasInterviews: true }))).toMatchObject({ interviewed: true, screened: true, responded: true });
    expect(classifyApplication(app({ status: "SUBMITTED", hasOffers: true }))).toMatchObject({ offers: true, interviewed: true });
  });

  it("does not count later stages for records that were never applied", () => {
    const f = classifyApplication(app({ status: "SAVED", events: [ev("RECRUITER_RESPONSE", "2026-10-03T10:00:00Z")] }));
    expect(f.applied).toBe(false);
    expect(f.responded).toBe(false);
    expect(f.firstResponseAt).toBeNull();
  });

  it("resolves the application date from appliedAt, then events, then history", () => {
    expect(classifyApplication(app({ status: "SUBMITTED", appliedAt: d("2026-10-01T00:00:00Z") })).appliedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(classifyApplication(app({ status: "SUBMITTED", events: [ev("APPLIED", "2026-10-02T12:00:00Z")] })).appliedAt?.toISOString()).toBe("2026-10-02T12:00:00.000Z");
    expect(classifyApplication(app({ status: "SUBMITTED", statusHistory: [hist("SUBMITTED", "2026-10-03T12:00:00Z")] })).appliedAt?.toISOString()).toBe(
      "2026-10-03T12:00:00.000Z",
    );
  });

  it("falls back to statusUpdatedAt for the response time when nothing else carries one", () => {
    const f = classifyApplication(app({ status: "SCREENING", statusUpdatedAt: d("2026-10-06T00:00:00Z") }));
    expect(f.firstResponseAt?.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});

describe("computeFunnel", () => {
  it("returns zeros and null rates for an empty list", () => {
    const r = computeFunnel([]);
    expect(r.counts).toEqual({ total: 0, applied: 0, responded: 0, screened: 0, interviewed: 0, offers: 0, hired: 0 });
    expect(r.rates.responseRate.value).toBeNull();
    expect(r.rates.responseRate.interval).toBeNull();
    expect(r.lowSample).toBe(true);
  });

  it("counts stages and computes per-applied rates with intervals", () => {
    const apps: FunnelApplication[] = [
      app({ status: "SAVED" }),
      app({ status: "SUBMITTED" }),
      app({ status: "REJECTED" }),
      app({ status: "SCREENING" }),
      app({ status: "INTERVIEWING" }),
      app({ status: "OFFER" }),
      app({ status: "HIRED" }),
    ];
    const r = computeFunnel(apps);
    expect(r.counts).toEqual({ total: 7, applied: 6, responded: 5, screened: 4, interviewed: 3, offers: 2, hired: 1 });
    expect(r.rates.responseRate.value).toBeCloseTo(5 / 6, 5);
    expect(r.rates.responseRate.n).toBe(6);
    expect(r.rates.interviewRate.value).toBeCloseTo(0.5, 5);
    expect(r.rates.offerRate.value).toBeCloseTo(1 / 3, 5);
    expect(r.rates.interviewRate.interval!.low).toBeLessThan(0.5);
    expect(r.rates.interviewRate.interval!.high).toBeGreaterThan(0.5);
    expect(r.lowSample).toBe(true);
    expect(r.rates.responseRate.lowSample).toBe(true);
  });

  it("clears the low-sample flag at 10 applied", () => {
    const apps = Array.from({ length: 10 }, (_, i) => app({ status: i < 3 ? "INTERVIEWING" : "SUBMITTED" }));
    const r = computeFunnel(apps);
    expect(r.lowSample).toBe(false);
    expect(r.rates.interviewRate).toMatchObject({ value: 0.3, n: 10, lowSample: false });
  });
});

describe("averageDaysToResponse", () => {
  it("averages days from application to first response and reports n", () => {
    const apps: FunnelApplication[] = [
      app({ status: "SUBMITTED", appliedAt: d("2026-10-01T00:00:00Z"), events: [ev("RECRUITER_RESPONSE", "2026-10-04T00:00:00Z")] }),
      app({ status: "SCREENING", appliedAt: d("2026-10-01T00:00:00Z"), statusHistory: [hist("SCREENING", "2026-10-06T00:00:00Z")] }),
      app({ status: "SUBMITTED", appliedAt: d("2026-10-01T00:00:00Z") }), // no response → excluded
      app({ status: "SAVED", events: [ev("RECRUITER_RESPONSE", "2026-10-04T00:00:00Z")] }), // never applied → excluded
    ];
    const t = averageDaysToResponse(apps);
    expect(t.n).toBe(2);
    expect(t.averageDays).toBeCloseTo(4, 5);
    expect(t.medianDays).toBeCloseTo(4, 5);
  });

  it("uses the earliest response and clamps same-day responses to zero", () => {
    const apps: FunnelApplication[] = [
      app({
        status: "INTERVIEWING",
        appliedAt: d("2026-10-01T00:00:00Z"),
        events: [ev("INTERVIEW_SCHEDULED", "2026-10-10T00:00:00Z"), ev("RECRUITER_RESPONSE", "2026-10-03T00:00:00Z")],
      }),
      // Date-only appliedAt with a response earlier the same calendar day → 0 days, not negative.
      app({ status: "SUBMITTED", appliedAt: d("2026-10-01T00:00:00Z"), events: [ev("RECRUITER_RESPONSE", "2026-09-30T20:00:00Z")] }),
    ];
    const t = averageDaysToResponse(apps);
    expect(t.n).toBe(2);
    expect(t.averageDays).toBeCloseTo(1, 5);
  });

  it("returns nulls when nothing is measurable", () => {
    expect(averageDaysToResponse([app({ status: "SUBMITTED" })])).toEqual({ averageDays: null, medianDays: null, n: 0 });
  });
});

describe("conversionBy", () => {
  const apps: FunnelApplication[] = [
    app({ status: "INTERVIEWING", source: "INDEED", jobCategory: "Electrician", resumeVersionId: "r1" }),
    app({ status: "SUBMITTED", source: "INDEED", jobCategory: "Electrician", resumeVersionId: "r1" }),
    app({ status: "SUBMITTED", source: "LINKEDIN", jobCategory: "  ", resumeVersionId: null }),
    app({ status: "SAVED", source: "LINKEDIN", jobCategory: null, resumeVersionId: null }),
    app({ status: "OFFER", source: "REFERRAL", jobCategory: "HVAC", resumeVersionId: "r2" }),
  ];

  it("groups by source, most-applied first", () => {
    const rows = conversionBy(apps, "source");
    expect(rows.map((r) => r.key)).toEqual(["INDEED", "LINKEDIN", "REFERRAL"]);
    expect(rows[0]).toMatchObject({ applied: 2, responded: 1, interviews: 1, offers: 0, interviewRate: 0.5, lowSample: true });
    expect(rows[1]).toMatchObject({ total: 2, applied: 1, interviews: 0, interviewRate: 0 });
    expect(rows[2]).toMatchObject({ applied: 1, interviews: 1, offers: 1, interviewRate: 1 });
    expect(rows[0]!.interval).not.toBeNull();
  });

  it("treats blank categories as missing", () => {
    const rows = conversionBy(apps, "jobCategory");
    expect(rows.map((r) => r.key)).toEqual(["Electrician", "HVAC", null]);
    expect(rows[2]).toMatchObject({ total: 2, applied: 1 });
  });

  it("groups by résumé version", () => {
    const rows = conversionBy(apps, "resumeVersionId");
    expect(rows.map((r) => r.key)).toEqual(["r1", "r2", null]);
  });

  it("sorts ties by key", () => {
    const rows = conversionBy([app({ status: "SUBMITTED", source: "LEVER" }), app({ status: "SUBMITTED", source: "ADP" })], "source");
    expect(rows.map((r) => r.key)).toEqual(["ADP", "LEVER"]);
  });
});

describe("dailySeries / weeklySeries", () => {
  it("fills every day in the window and sums per day", () => {
    const series = dailySeries({
      fromKey: "2026-10-01",
      toKey: "2026-10-05",
      appliedKeys: ["2026-10-01", "2026-10-01", "2026-10-04", "2026-09-30"],
      activity: [
        { key: "2026-10-01", applicationsSubmitted: 2, followUps: 1 },
        { key: "2026-10-05", applicationsSubmitted: 0, followUps: 3 },
      ],
    });
    expect(series.map((p) => p.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(series[0]).toEqual({ key: "2026-10-01", label: "Oct 1", applied: 2, followUps: 1, logged: 2 });
    expect(series[3]).toMatchObject({ applied: 1, followUps: 0, logged: 0 });
    expect(series[4]).toMatchObject({ applied: 0, followUps: 3 });
  });

  it("returns an empty series for an inverted window", () => {
    expect(dailySeries({ fromKey: "2026-10-05", toKey: "2026-10-01", appliedKeys: [], activity: [] })).toEqual([]);
  });

  it("keeps the most recent days when the window exceeds the cap", () => {
    const series = dailySeries({ fromKey: "2020-01-01", toKey: "2026-10-21", appliedKeys: [], activity: [] });
    expect(series.length).toBe(400);
    expect(series[series.length - 1]!.key).toBe("2026-10-21");
  });

  it("aggregates into Monday-based weeks", () => {
    // 2026-10-05 is a Monday; 2026-10-11 a Sunday; 2026-10-12 the next Monday.
    const daily = dailySeries({
      fromKey: "2026-10-09",
      toKey: "2026-10-13",
      appliedKeys: ["2026-10-09", "2026-10-11", "2026-10-12"],
      activity: [{ key: "2026-10-13", applicationsSubmitted: 1, followUps: 2 }],
    });
    const weeks = weeklySeries(daily);
    expect(weeks.map((w) => w.key)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(weeks[0]).toMatchObject({ label: "Oct 5", rangeLabel: "Oct 5 – Oct 11", applied: 2, followUps: 0, days: 3 });
    expect(weeks[1]).toMatchObject({ applied: 1, followUps: 2, logged: 1, days: 2 });
  });
});
