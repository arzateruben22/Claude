/**
 * Pure ingestion rules: observation validation, kind → status mapping, salary / interview-type
 * parsing. No I/O, so the rules are unit-tested directly and can be shared with client components
 * (the review queue shows the default target status with the same function the engine uses).
 */
import {
  ApplicationSource,
  InterviewType,
  RecordOrigin,
  type ApplicationStatus,
  type SalaryPeriod,
} from "@/generated/prisma/enums";
import type { ApplicationObservation, ObservationEvidence, ObservationKind } from "./types";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** The observation named an application that does not exist for this user (or the row is gone). */
export class IngestNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = "Application not found.") {
    super(message);
    this.name = "IngestNotFoundError";
  }
}

/** The observation (or a review decision) is malformed and was rejected before any write. */
export class IngestValidationError extends Error {
  readonly code = "INVALID" as const;
  constructor(message: string) {
    super(message);
    this.name = "IngestValidationError";
  }
}

// ---------------------------------------------------------------------------
// Kinds and statuses
// ---------------------------------------------------------------------------

export const OBSERVATION_KINDS: readonly ObservationKind[] = [
  "JOB_SEEN",
  "APPLY_STARTED",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "RECRUITER_RESPONSE",
  "ASSESSMENT_INVITED",
  "INTERVIEW_INVITED",
  "REJECTED",
  "OFFER",
  "ONBOARDING",
  "USER_CONFIRMED_SUBMISSION",
];

export const OBSERVATION_KIND_LABELS: Record<ObservationKind, string> = {
  JOB_SEEN: "Job posting seen",
  APPLY_STARTED: "Application started",
  SUBMITTED: "Application submitted",
  ACKNOWLEDGED: "Employer acknowledgment",
  RECRUITER_RESPONSE: "Recruiter response",
  ASSESSMENT_INVITED: "Assessment invitation",
  INTERVIEW_INVITED: "Interview invitation",
  REJECTED: "Rejection",
  OFFER: "Offer",
  ONBOARDING: "Onboarding",
  USER_CONFIRMED_SUBMISSION: "You confirmed you applied",
};

const OBS_SOURCES = ["EMAIL", "EXTENSION", "IMPORT", "PLATFORM_API"] as const;

/**
 * True when the evidence is the platform's own confirmation that an application was received:
 * a verified SUBMITTED observation from an email sent by a job board / ATS (email-core only
 * classifies platform "received" mail as APPLICATION_SUBMITTED), from the extension's confirmation
 * page, or from a platform API. The user's own assertion (USER_CONFIRMED_SUBMISSION) is not one.
 */
export function isPlatformConfirmation(
  obs: Pick<ApplicationObservation, "kind" | "verified" | "source"> & { evidence: Pick<ObservationEvidence, "kind" | "data"> },
): boolean {
  if (obs.kind !== "SUBMITTED" || !obs.verified) return false;
  if (obs.source === "PLATFORM_API") return true;
  if (obs.evidence.kind === "EXTENSION_CAPTURE") return true;
  if (obs.evidence.kind === "EMAIL") {
    const senderKind = obs.evidence.data?.senderKind;
    return typeof senderKind !== "string" || senderKind === "job_board" || senderKind === "ats";
  }
  return false;
}

/**
 * Status an observation implies (null when it implies none). JOB_SEEN → Saved; submissions →
 * Submitted (Confirmed for a verified platform confirmation); acknowledgment → Confirmed; recruiter
 * or assessment → Screening; interview → Interviewing; rejection, offer as named; onboarding →
 * Accepted. APPLY_STARTED never implies a status.
 */
export function targetStatusFor(
  obs: Pick<ApplicationObservation, "kind" | "verified" | "source"> & { evidence: Pick<ObservationEvidence, "kind" | "data"> },
): ApplicationStatus | null {
  switch (obs.kind) {
    case "JOB_SEEN":
      return "SAVED";
    case "APPLY_STARTED":
      return null;
    case "SUBMITTED":
      return isPlatformConfirmation(obs) ? "CONFIRMED" : "SUBMITTED";
    case "USER_CONFIRMED_SUBMISSION":
      return "SUBMITTED";
    case "ACKNOWLEDGED":
      return "CONFIRMED";
    case "RECRUITER_RESPONSE":
    case "ASSESSMENT_INVITED":
      return "SCREENING";
    case "INTERVIEW_INVITED":
      return "INTERVIEWING";
    case "REJECTED":
      return "REJECTED";
    case "OFFER":
      return "OFFER";
    case "ONBOARDING":
      return "ACCEPTED";
  }
}

/**
 * Observation kind that matches a status the user picked in the review queue, used when the
 * original evidence implied no status (an APPLY_STARTED capture) or carried no observation.
 */
export function kindForStatus(status: ApplicationStatus): ObservationKind {
  switch (status) {
    case "SAVED":
    case "PREPARING":
      return "JOB_SEEN";
    case "SUBMITTED":
      return "SUBMITTED";
    case "CONFIRMED":
      return "ACKNOWLEDGED";
    case "SCREENING":
      return "RECRUITER_RESPONSE";
    case "INTERVIEWING":
      return "INTERVIEW_INVITED";
    case "OFFER":
      return "OFFER";
    case "ACCEPTED":
    case "HIRED":
      return "ONBOARDING";
    case "REJECTED":
      return "REJECTED";
    case "WITHDRAWN":
    case "NO_RESPONSE":
    case "CLOSED":
      return "SUBMITTED";
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

export type ParsedSalary = { min: number; max: number | null; period: SalaryPeriod };

const MONEY =
  /\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*(k\b)?(?:\s*(?:-|–|—|to)\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*(k\b)?)?/i;

/**
 * Parse pay text such as "$32–$38/hr", "$85,000 - $95,000 a year", "$70K–85K" or "Up to $40 per
 * hour". Returns null when no dollar amount is present, the period cannot be told, or the numbers
 * are implausible. Never guesses beyond the text.
 */
export function parseSalaryText(text: string | null | undefined): ParsedSalary | null {
  if (!text) return null;
  const m = MONEY.exec(text);
  if (!m) return null;
  const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : null);
  let lo = num(m[1]);
  let hi = num(m[3]);
  const kLo = Boolean(m[2]);
  const kHi = Boolean(m[4]);
  if (lo === null || !Number.isFinite(lo)) return null;
  if (kLo || (kHi && lo < 1000)) lo *= 1000;
  if (hi !== null && kHi) hi *= 1000;
  if (hi !== null && !Number.isFinite(hi)) hi = null;
  if (hi !== null && hi < lo) [lo, hi] = [hi, lo];
  const t = text.toLowerCase();
  let period: SalaryPeriod | null = null;
  if (/(\/\s*h(ou)?r\b|\bper\s+h(ou)?r\b|\ban?\s+hour\b|\bhourly\b|\/\s*hour\b|\bhr\b)/.test(t)) period = "HOURLY";
  else if (/(\/\s*y(ea)?r\b|\bper\s+(year|annum)\b|\ba\s+year\b|\bannual(ly)?\b|\byearly\b|\bsalary\b)/.test(t)) period = "ANNUAL";
  else if ((hi ?? lo) < 300) period = "HOURLY";
  else if (lo >= 10_000) period = "ANNUAL";
  if (!period) return null;
  const ok = (n: number) => (period === "HOURLY" ? n >= 7 && n <= 500 : n >= 10_000 && n <= 2_000_000);
  if (!ok(lo) || (hi !== null && !ok(hi))) return null;
  return { min: lo, max: hi, period };
}

/** Interview format suggested by the invitation text; OTHER when nothing is said. */
export function guessInterviewType(text: string | null | undefined): InterviewType {
  const t = (text ?? "").toLowerCase();
  if (/\bpanel\b/.test(t)) return "PANEL";
  if (/\b(apprenticeship|jatc|oral) interview\b|\bjatc\b/.test(t)) return "APPRENTICESHIP_INTERVIEW";
  if (/\b(video|zoom|microsoft teams|teams meeting|google meet|webex|virtual)\b/.test(t)) return "VIDEO";
  if (/\b(phone|call you|by phone|phone screen|phone interview)\b/.test(t)) return "PHONE_SCREEN";
  if (/\b(on-?site|in person|in-person|at our (office|shop|facility|yard)|visit our)\b/.test(t)) return "ONSITE";
  if (/\b(technical|skills test|hands-on|practical test)\b/.test(t)) return "TECHNICAL";
  return "OTHER";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EVIDENCE_KINDS: ReadonlySet<ObservationEvidence["kind"]> = new Set([
  "EMAIL",
  "EXTENSION_CAPTURE",
  "CSV_ROW",
  "URL",
  "MANUAL_NOTE",
  "DOCUMENT",
  "SCREENSHOT",
]);

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function validDate(v: unknown): Date | null {
  if (!(v instanceof Date)) return null;
  return Number.isNaN(v.getTime()) ? null : v;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FUTURE_MS = 24 * 3600 * 1000;

/**
 * Validate and normalize an observation before anything is written: enums checked, strings
 * trimmed and capped, posting URL limited to http(s), confidence clamped to 0..1 and a future
 * observedAt (clock skew) clamped to `now`. Throws IngestValidationError on unusable input.
 */
export function sanitizeObservation(raw: ApplicationObservation, now: Date = new Date()): ApplicationObservation {
  if (!raw || typeof raw !== "object") throw new IngestValidationError("Observation is missing.");
  if (!OBSERVATION_KINDS.includes(raw.kind)) throw new IngestValidationError(`Unknown observation kind: ${String(raw.kind)}`);
  if (!(OBS_SOURCES as readonly string[]).includes(raw.source)) throw new IngestValidationError(`Unknown observation source: ${String(raw.source)}`);
  if (!Object.prototype.hasOwnProperty.call(RecordOrigin, raw.origin)) throw new IngestValidationError(`Unknown record origin: ${String(raw.origin)}`);
  const observed = validDate(raw.observedAt);
  if (!observed) throw new IngestValidationError("observedAt must be a valid date.");
  if (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence)) {
    throw new IngestValidationError("confidence must be a number between 0 and 1.");
  }
  const ev = raw.evidence;
  if (!ev || !EVIDENCE_KINDS.has(ev.kind)) throw new IngestValidationError("evidence.kind is missing or unknown.");
  const sourceRef = text(ev.sourceRef, 300);
  if (!sourceRef) throw new IngestValidationError("evidence.sourceRef is required.");

  const url = text(raw.postingUrl, 2048);
  const recruiterEmail = text(raw.recruiterEmail, 254);
  const platform =
    raw.platform && Object.prototype.hasOwnProperty.call(ApplicationSource, raw.platform) ? raw.platform : null;
  const interviewType =
    raw.interviewType && Object.prototype.hasOwnProperty.call(InterviewType, raw.interviewType) ? raw.interviewType : null;
  const data = ev.data && typeof ev.data === "object" && !Array.isArray(ev.data) ? ev.data : undefined;

  return {
    kind: raw.kind,
    source: raw.source,
    origin: raw.origin,
    observedAt: observed.getTime() > now.getTime() + MAX_FUTURE_MS ? now : observed,
    company: text(raw.company, 200),
    title: text(raw.title, 200),
    location: text(raw.location, 160),
    requisitionId: text(raw.requisitionId, 80),
    postingUrl: url && /^https?:\/\//i.test(url) ? url : null,
    platform,
    salaryText: text(raw.salaryText, 200),
    recruiterName: text(raw.recruiterName, 120),
    recruiterEmail: recruiterEmail && EMAIL_SHAPE.test(recruiterEmail) ? recruiterEmail : null,
    interviewAt: validDate(raw.interviewAt),
    interviewType,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    verified: raw.verified === true,
    evidence: {
      kind: ev.kind,
      sourceRef,
      title: text(ev.title, 300),
      snippet: text(ev.snippet, 300),
      ...(data ? { data } : {}),
    },
    applicationId: text(raw.applicationId, 64),
  };
}
