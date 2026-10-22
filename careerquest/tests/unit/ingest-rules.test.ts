/**
 * Pure tests for the ingestion rules: kind → status mapping, platform confirmations, salary and
 * interview-type parsing, observation validation.
 */
import { describe, expect, it } from "vitest";
import {
  IngestValidationError,
  OBSERVATION_KINDS,
  guessInterviewType,
  isPlatformConfirmation,
  kindForStatus,
  parseSalaryText,
  sanitizeObservation,
  targetStatusFor,
} from "@/lib/ingest/rules";
import { ALL_STATUSES } from "@/lib/applications/status";
import type {
  ApplicationObservation,
  ObservationKind,
} from "@/lib/ingest/types";

function obs(
  over: Partial<ApplicationObservation> = {},
): ApplicationObservation {
  return {
    kind: "SUBMITTED",
    source: "EMAIL",
    origin: "EMAIL",
    observedAt: new Date("2026-01-12T17:14:33Z"),
    company: "Acme Electric",
    title: "Apprentice Electrician",
    confidence: 0.95,
    verified: true,
    evidence: {
      kind: "EMAIL",
      sourceRef: "EML:abc@indeed.com",
      data: { senderKind: "job_board" },
    },
    ...over,
  };
}

describe("targetStatusFor", () => {
  const cases: Array<[ObservationKind, string | null]> = [
    ["JOB_SEEN", "SAVED"],
    ["APPLY_STARTED", null],
    ["USER_CONFIRMED_SUBMISSION", "SUBMITTED"],
    ["ACKNOWLEDGED", "CONFIRMED"],
    ["RECRUITER_RESPONSE", "SCREENING"],
    ["ASSESSMENT_INVITED", "SCREENING"],
    ["INTERVIEW_INVITED", "INTERVIEWING"],
    ["REJECTED", "REJECTED"],
    ["OFFER", "OFFER"],
    ["ONBOARDING", "ACCEPTED"],
  ];
  it.each(cases)("%s → %s", (kind, status) => {
    expect(targetStatusFor(obs({ kind }))).toBe(status);
  });

  it("confirms only verified platform confirmations", () => {
    expect(targetStatusFor(obs())).toBe("CONFIRMED");
    expect(targetStatusFor(obs({ verified: false }))).toBe("SUBMITTED");
    expect(
      targetStatusFor(
        obs({
          evidence: {
            kind: "EMAIL",
            sourceRef: "x",
            data: { senderKind: "employer" },
          },
        }),
      ),
    ).toBe("SUBMITTED");
    expect(
      targetStatusFor(
        obs({
          source: "EXTENSION",
          origin: "EXTENSION",
          evidence: { kind: "EXTENSION_CAPTURE", sourceRef: "capture:1" },
        }),
      ),
    ).toBe("CONFIRMED");
    expect(
      targetStatusFor(
        obs({ kind: "USER_CONFIRMED_SUBMISSION", verified: true }),
      ),
    ).toBe("SUBMITTED");
    expect(
      isPlatformConfirmation(
        obs({
          source: "PLATFORM_API",
          evidence: { kind: "CSV_ROW", sourceRef: "r" },
        }),
      ),
    ).toBe(true);
    expect(
      isPlatformConfirmation(
        obs({ evidence: { kind: "CSV_ROW", sourceRef: "r" } }),
      ),
    ).toBe(false);
  });

  it("maps every status to a kind whose own status is compatible", () => {
    for (const s of ALL_STATUSES) {
      const kind = kindForStatus(s);
      expect(OBSERVATION_KINDS).toContain(kind);
      expect(kind).not.toBe("APPLY_STARTED");
    }
    expect(kindForStatus("INTERVIEWING")).toBe("INTERVIEW_INVITED");
    expect(kindForStatus("SAVED")).toBe("JOB_SEEN");
  });
});

describe("parseSalaryText", () => {
  it("parses hourly and annual ranges", () => {
    expect(parseSalaryText("$32–$38/hr")).toEqual({
      min: 32,
      max: 38,
      period: "HOURLY",
    });
    expect(parseSalaryText("Pay: $28.50 - $34.00 per hour")).toEqual({
      min: 28.5,
      max: 34,
      period: "HOURLY",
    });
    expect(parseSalaryText("$85,000 - $95,000 a year")).toEqual({
      min: 85000,
      max: 95000,
      period: "ANNUAL",
    });
    expect(parseSalaryText("$70K–85K")).toEqual({
      min: 70000,
      max: 85000,
      period: "ANNUAL",
    });
    expect(parseSalaryText("Up to $40 an hour")).toEqual({
      min: 40,
      max: null,
      period: "HOURLY",
    });
  });

  it("refuses to guess", () => {
    expect(parseSalaryText(null)).toBeNull();
    expect(parseSalaryText("Competitive pay, 40 hours")).toBeNull();
    expect(parseSalaryText("$500 - $900")).toBeNull();
    expect(parseSalaryText("$3/hr")).toBeNull();
  });
});

describe("guessInterviewType", () => {
  it("reads the format from invitation text", () => {
    expect(guessInterviewType("Join the Zoom video interview")).toBe("VIDEO");
    expect(guessInterviewType("We will call you for a phone screen")).toBe(
      "PHONE_SCREEN",
    );
    expect(guessInterviewType("Please come on-site to our shop")).toBe(
      "ONSITE",
    );
    expect(guessInterviewType("JATC panel interview appointment")).toBe(
      "PANEL",
    );
    expect(guessInterviewType("Interview with the hiring manager")).toBe(
      "OTHER",
    );
    expect(guessInterviewType(null)).toBe("OTHER");
  });
});

describe("sanitizeObservation", () => {
  const now = new Date("2026-10-22T00:00:00Z");

  it("trims, caps and clamps fields", () => {
    const s = sanitizeObservation(
      obs({
        company: "  Acme   Electric  ",
        confidence: 1.7,
        postingUrl: "javascript:alert(1)",
        recruiterEmail: "not an email",
        observedAt: new Date("2027-01-01T00:00:00Z"),
        platform: "NOT_A_PLATFORM" as never,
        interviewType: "VIDEO",
        evidence: {
          kind: "EMAIL",
          sourceRef: " EML:1 ",
          snippet: "x".repeat(500),
        },
      }),
      now,
    );
    expect(s.company).toBe("Acme Electric");
    expect(s.confidence).toBe(1);
    expect(s.postingUrl).toBeNull();
    expect(s.recruiterEmail).toBeNull();
    expect(s.observedAt).toEqual(now);
    expect(s.platform).toBeNull();
    expect(s.interviewType).toBe("VIDEO");
    expect(s.evidence.sourceRef).toBe("EML:1");
    expect(s.evidence.snippet).toHaveLength(300);
    expect(s.verified).toBe(true);
  });

  it("rejects unusable observations", () => {
    expect(() =>
      sanitizeObservation(obs({ kind: "NOPE" as never }), now),
    ).toThrow(IngestValidationError);
    expect(() =>
      sanitizeObservation(obs({ source: "USER" as never }), now),
    ).toThrow(IngestValidationError);
    expect(() =>
      sanitizeObservation(obs({ observedAt: new Date("nope") }), now),
    ).toThrow(IngestValidationError);
    expect(() =>
      sanitizeObservation(obs({ confidence: Number.NaN }), now),
    ).toThrow(IngestValidationError);
    expect(() =>
      sanitizeObservation(
        obs({ evidence: { kind: "EMAIL", sourceRef: "  " } }),
        now,
      ),
    ).toThrow(IngestValidationError);
  });
});
