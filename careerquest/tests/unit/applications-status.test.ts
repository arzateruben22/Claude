import { describe, expect, it } from "vitest";
import {
  ALL_STATUSES,
  PIPELINE,
  TERMINAL,
  appliedInstant,
  canApplyInferredStatus,
  countsAsSubmission,
  hasApplied,
  impliesEmployerResponse,
  impliesSubmission,
  isActiveStatus,
  isSubmittedStatus,
  statusRank,
} from "@/lib/applications/status";

describe("status helpers", () => {
  it("ranks pipeline statuses in order and terminal statuses as -1", () => {
    for (let i = 1; i < PIPELINE.length; i++)
      expect(statusRank(PIPELINE[i]!)).toBeGreaterThan(
        statusRank(PIPELINE[i - 1]!),
      );
    for (const t of TERMINAL) expect(statusRank(t)).toBe(-1);
    expect(ALL_STATUSES).toHaveLength(13);
  });

  it("isSubmittedStatus counts SUBMITTED+ and every terminal status as a real application", () => {
    expect(isSubmittedStatus("SAVED")).toBe(false);
    expect(isSubmittedStatus("PREPARING")).toBe(false);
    expect(isSubmittedStatus("SUBMITTED")).toBe(true);
    expect(isSubmittedStatus("INTERVIEWING")).toBe(true);
    expect(isSubmittedStatus("HIRED")).toBe(true);
    for (const t of TERMINAL) expect(isSubmittedStatus(t)).toBe(true);
  });

  it("isActiveStatus excludes terminal and accepted/hired", () => {
    expect(isActiveStatus("SUBMITTED")).toBe(true);
    expect(isActiveStatus("OFFER")).toBe(true);
    expect(isActiveStatus("ACCEPTED")).toBe(false);
    expect(isActiveStatus("HIRED")).toBe(false);
    expect(isActiveStatus("REJECTED")).toBe(false);
  });

  it("impliesEmployerResponse is true from SCREENING onward and for REJECTED", () => {
    expect(impliesEmployerResponse("SUBMITTED")).toBe(false);
    expect(impliesEmployerResponse("CONFIRMED")).toBe(false);
    expect(impliesEmployerResponse("SCREENING")).toBe(true);
    expect(impliesEmployerResponse("REJECTED")).toBe(true);
    expect(impliesEmployerResponse("NO_RESPONSE")).toBe(false);
    expect(impliesEmployerResponse("WITHDRAWN")).toBe(false);
  });
});

describe("canApplyInferredStatus truth table", () => {
  const cases: Array<{
    name: string;
    current: Parameters<typeof canApplyInferredStatus>[0]["current"];
    currentVerified: boolean;
    next: Parameters<typeof canApplyInferredStatus>[0]["next"];
    nextVerified: boolean;
    expected: boolean;
  }> = [
    {
      name: "forward move on unverified record",
      current: "SUBMITTED",
      currentVerified: false,
      next: "SCREENING",
      nextVerified: false,
      expected: true,
    },
    {
      name: "same status is a no-op",
      current: "SCREENING",
      currentVerified: false,
      next: "SCREENING",
      nextVerified: false,
      expected: false,
    },
    {
      name: "same status even if verified",
      current: "SCREENING",
      currentVerified: true,
      next: "SCREENING",
      nextVerified: true,
      expected: false,
    },
    {
      name: "unverified inference cannot override a verified status",
      current: "SUBMITTED",
      currentVerified: true,
      next: "SCREENING",
      nextVerified: false,
      expected: false,
    },
    {
      name: "verified inference may advance a verified status",
      current: "SUBMITTED",
      currentVerified: true,
      next: "SCREENING",
      nextVerified: true,
      expected: true,
    },
    {
      name: "downgrade is refused (unverified)",
      current: "INTERVIEWING",
      currentVerified: false,
      next: "SUBMITTED",
      nextVerified: false,
      expected: false,
    },
    {
      name: "downgrade is refused even when verified",
      current: "INTERVIEWING",
      currentVerified: true,
      next: "SUBMITTED",
      nextVerified: true,
      expected: false,
    },
    {
      name: "unverified terminal move from active unverified record",
      current: "SUBMITTED",
      currentVerified: false,
      next: "REJECTED",
      nextVerified: false,
      expected: true,
    },
    {
      name: "unverified terminal move cannot override verified active record",
      current: "SUBMITTED",
      currentVerified: true,
      next: "REJECTED",
      nextVerified: false,
      expected: false,
    },
    {
      name: "verified terminal move overrides verified active record",
      current: "INTERVIEWING",
      currentVerified: true,
      next: "REJECTED",
      nextVerified: true,
      expected: true,
    },
    {
      name: "terminal → different terminal needs verification",
      current: "NO_RESPONSE",
      currentVerified: false,
      next: "REJECTED",
      nextVerified: false,
      expected: false,
    },
    {
      name: "terminal → different terminal allowed when verified",
      current: "NO_RESPONSE",
      currentVerified: false,
      next: "REJECTED",
      nextVerified: true,
      expected: true,
    },
    {
      name: "reopening a terminal record needs verification",
      current: "REJECTED",
      currentVerified: false,
      next: "INTERVIEWING",
      nextVerified: false,
      expected: false,
    },
    {
      name: "reopening a terminal record with verification",
      current: "REJECTED",
      currentVerified: false,
      next: "INTERVIEWING",
      nextVerified: true,
      expected: true,
    },
    {
      name: "reopening a verified terminal record with verification",
      current: "REJECTED",
      currentVerified: true,
      next: "INTERVIEWING",
      nextVerified: true,
      expected: true,
    },
    {
      name: "saved → submitted from email",
      current: "SAVED",
      currentVerified: true,
      next: "SUBMITTED",
      nextVerified: true,
      expected: true,
    },
    {
      name: "offer → accepted (verified)",
      current: "OFFER",
      currentVerified: true,
      next: "ACCEPTED",
      nextVerified: true,
      expected: true,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(
        canApplyInferredStatus({
          current: c.current,
          currentVerified: c.currentVerified,
          next: c.next,
          nextVerified: c.nextVerified,
        }),
      ).toBe(c.expected);
    });
  }
});

describe("submission semantics (F1)", () => {
  it("impliesSubmission: pipeline >= SUBMITTED plus REJECTED / NO_RESPONSE, never WITHDRAWN / CLOSED", () => {
    const yes = ALL_STATUSES.filter(impliesSubmission);
    expect(yes.sort()).toEqual(
      ["SUBMITTED", "CONFIRMED", "SCREENING", "INTERVIEWING", "OFFER", "ACCEPTED", "HIRED", "REJECTED", "NO_RESPONSE"].sort(),
    );
  });

  it("countsAsSubmission: closing a never-applied lead is not a submission", () => {
    for (const to of ["WITHDRAWN", "CLOSED"] as const) {
      expect(countsAsSubmission({ from: "SAVED", to, appliedAt: null })).toBe(false);
      expect(countsAsSubmission({ from: "PREPARING", to, appliedAt: null })).toBe(false);
      expect(countsAsSubmission({ from: null, to, appliedAt: null })).toBe(false);
      // Evidence of a real submission: an application date or a previous submitted status.
      expect(countsAsSubmission({ from: null, to, appliedAt: new Date() })).toBe(true);
      expect(countsAsSubmission({ from: "SUBMITTED", to, appliedAt: null })).toBe(true);
    }
    expect(countsAsSubmission({ from: "SAVED", to: "REJECTED", appliedAt: null })).toBe(true);
    expect(countsAsSubmission({ from: "SAVED", to: "SUBMITTED", appliedAt: null })).toBe(true);
    expect(countsAsSubmission({ from: "SAVED", to: "PREPARING", appliedAt: new Date() })).toBe(false);
  });

  it("hasApplied / appliedInstant: application date first, else the earliest APPLIED event", () => {
    const at = (iso: string) => new Date(iso);
    expect(hasApplied({ appliedAt: null, events: [] })).toBe(false);
    expect(hasApplied({ appliedAt: null, events: [{ type: "SAVED" }] })).toBe(false);
    expect(hasApplied({ appliedAt: at("2026-10-01T00:00:00Z"), events: [] })).toBe(true);
    expect(hasApplied({ appliedAt: null, events: [{ type: "APPLIED" }] })).toBe(true);
    expect(appliedInstant({ appliedAt: null, events: [] })).toBeNull();
    expect(
      appliedInstant({
        appliedAt: null,
        events: [
          { type: "APPLIED", occurredAt: at("2026-10-03T00:00:00Z") },
          { type: "APPLIED", occurredAt: at("2026-10-02T00:00:00Z") },
          { type: "SAVED", occurredAt: at("2026-09-01T00:00:00Z") },
        ],
      })?.toISOString(),
    ).toBe("2026-10-02T00:00:00.000Z");
    expect(
      appliedInstant({ appliedAt: at("2026-10-05T00:00:00Z"), events: [{ type: "APPLIED", occurredAt: at("2026-10-02T00:00:00Z") }] })?.toISOString(),
    ).toBe("2026-10-05T00:00:00.000Z");
  });
});
