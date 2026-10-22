/**
 * Ingestion contract shared by every automated capture path (email sync/import, the Chrome
 * extension, CSV/URL/platform imports, mobile share). Producers turn raw evidence into an
 * `ApplicationObservation`; the ingestion engine (`src/lib/ingest/engine.ts`) is the ONLY code that
 * turns observations into Application records. It is responsible for:
 *   - matching the observation to an existing application (deterministic first, fuzzy second),
 *   - creating a record only when the evidence justifies it,
 *   - applying status changes through the applications service with source attribution,
 *   - never letting inferred data overwrite user-confirmed or verified data,
 *   - queueing ambiguous cases for user review instead of guessing.
 *
 * This file is types + pure constants only, so it can be imported from client components and tests.
 */
import type { ApplicationSource, EventSource, RecordOrigin } from "@/generated/prisma/enums";

/** What the evidence says happened. Mirrors EmailClassification but is producer-neutral. */
export type ObservationKind =
  /** A posting the user looked at / saved. Never implies a submission. */
  | "JOB_SEEN"
  /** The user started an application flow. Never implies a submission. */
  | "APPLY_STARTED"
  /** Reliable evidence that an application was submitted (platform confirmation email/page). */
  | "SUBMITTED"
  /** Employer-side acknowledgment of a submitted application. */
  | "ACKNOWLEDGED"
  /** A recruiter/employer replied (not yet an interview). */
  | "RECRUITER_RESPONSE"
  | "ASSESSMENT_INVITED"
  | "INTERVIEW_INVITED"
  | "REJECTED"
  | "OFFER"
  | "ONBOARDING"
  /** The user explicitly asserted they submitted (extension "I submitted", mobile one-tap). */
  | "USER_CONFIRMED_SUBMISSION";

export type ObservationEvidence = {
  /** EvidenceKind in the schema. */
  kind: "EMAIL" | "EXTENSION_CAPTURE" | "CSV_ROW" | "URL" | "MANUAL_NOTE" | "DOCUMENT" | "SCREENSHOT";
  /** Stable external reference (Gmail message id, Graph message id, capture id, CSV row hash). */
  sourceRef: string;
  title?: string | null;
  /** Short, PII-minimised excerpt (≤ 300 chars) that supports the classification. */
  snippet?: string | null;
  data?: Record<string, unknown>;
};

export type ApplicationObservation = {
  kind: ObservationKind;
  /** Who produced it (attribution in status history and events). */
  source: Exclude<EventSource, "USER" | "SYSTEM">;
  /** RecordOrigin for records created from this observation. */
  origin: RecordOrigin;
  /** When it happened in the real world (email Date header, capture time). */
  observedAt: Date;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  requisitionId?: string | null;
  postingUrl?: string | null;
  platform?: ApplicationSource | null;
  salaryText?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  interviewAt?: Date | null;
  /** 0..1 confidence of the producer's classification + extraction. */
  confidence: number;
  /**
   * True only when the evidence itself is strong enough to treat the status as verified
   * (e.g. an authentic platform confirmation email, or the user's explicit assertion).
   */
  verified: boolean;
  evidence: ObservationEvidence;
  /** When the user explicitly chose the record to attach to (extension "Attach", review UI). */
  applicationId?: string | null;
};

export type IngestAction =
  /** A new application record was created. */
  | "created"
  /** An existing record was matched and updated (status/fields/evidence). */
  | "updated"
  /** Matched an existing record; nothing new to apply (idempotent re-delivery). */
  | "duplicate"
  /** Ambiguous: stored for the user to confirm in the review queue; nothing applied yet. */
  | "needs_review"
  /** Not actionable (job alert, unrelated, below threshold) — evidence kept only if useful. */
  | "ignored";

export type IngestResult = {
  action: IngestAction;
  applicationId: string | null;
  /** Candidate records when the match was uncertain. */
  candidateIds: string[];
  /** Human-readable explanation shown in import summaries and the review queue. */
  reason: string;
  /** Whether a status change was applied (and to what). */
  statusApplied: string | null;
  xpAwarded: number;
};

export type IngestOptions = {
  /** Minimum confidence to auto-apply without review (default 0.8). */
  autoApplyThreshold?: number;
  /** Allow creating a new record when no match exists (default true for SUBMITTED-class kinds). */
  allowCreate?: boolean;
};

/** Default thresholds. Below REVIEW_FLOOR an observation is ignored rather than queued. */
export const INGEST_THRESHOLDS = {
  AUTO_APPLY: 0.8,
  REVIEW_FLOOR: 0.45,
  /** Fuzzy match score at/above which two records are considered the same position. */
  MATCH_SURE: 0.9,
  /** Fuzzy score band that produces a DuplicateCandidate / review item instead of a merge. */
  MATCH_POSSIBLE: 0.65,
} as const;

/** Observation kinds that may create a record when nothing matches. */
export const CREATING_KINDS: ReadonlySet<ObservationKind> = new Set([
  "SUBMITTED",
  "ACKNOWLEDGED",
  "USER_CONFIRMED_SUBMISSION",
  "RECRUITER_RESPONSE",
  "ASSESSMENT_INVITED",
  "INTERVIEW_INVITED",
  "REJECTED",
  "OFFER",
  "ONBOARDING",
  "JOB_SEEN",
]);

/** Kinds that must never be treated as a completed submission. */
export const NON_SUBMISSION_KINDS: ReadonlySet<ObservationKind> = new Set(["JOB_SEEN", "APPLY_STARTED"]);

/** JSON-safe form of an observation (dates as ISO strings) for storage in EmailMessage.extracted / review items. */
export type SerializedObservation = Omit<ApplicationObservation, "observedAt" | "interviewAt"> & {
  observedAt: string;
  interviewAt?: string | null;
};

export function serializeObservation(o: ApplicationObservation): SerializedObservation {
  return { ...o, observedAt: o.observedAt.toISOString(), interviewAt: o.interviewAt ? o.interviewAt.toISOString() : null };
}

export function deserializeObservation(s: SerializedObservation): ApplicationObservation {
  return { ...s, observedAt: new Date(s.observedAt), interviewAt: s.interviewAt ? new Date(s.interviewAt) : null };
}
