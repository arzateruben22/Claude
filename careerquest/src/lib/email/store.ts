import "server-only";
/**
 * Persistence for classified email (EmailMessage rows). Idempotent per (userId, provider, externalId).
 *
 * Data minimization: rows keep the headers needed for display, a ≤ 300-character masked snippet, the
 * extracted fields and the serialized observation. The body text (≤ 8 KB, URL query strings removed)
 * is stored ONLY while a row needs the user's review, and `purgeReviewedBodies` drops it once the user
 * has confirmed or dismissed the row. Attachments and HTML are never stored.
 */
import { prisma } from "@/lib/db";
import type { EmailMessage, Prisma } from "@/generated/prisma/client";
import type { ReviewStatus } from "@/generated/prisma/enums";
import {
  INGEST_THRESHOLDS,
  serializeObservation,
  type ApplicationObservation,
  type IngestResult,
  type SerializedObservation,
} from "@/lib/ingest/types";
import type { Classification } from "./classify";
import { buildSnippet, type EmailProvider } from "./observation";
import { truncateUtf8, type ParsedEmail } from "./parse";

export type { EmailProvider } from "./observation";

/** Maximum stored body size (UTF-8 bytes), and only for rows awaiting review. */
export const MAX_STORED_BODY_BYTES = 8 * 1024;
const USER_REVIEWED: ReviewStatus[] = ["CONFIRMED", "DISMISSED"];

export type StoreEmailInput = {
  parsed: ParsedEmail;
  classification: Classification;
  observation: ApplicationObservation | null;
  provider: EmailProvider;
  connectionId?: string | null;
  importBatchId?: string | null;
};

/** What `extracted` holds (JSON column). */
export type StoredEmailExtract = {
  version: 1;
  employer: string | null;
  positionTitle: string | null;
  requisitionNumber: string | null;
  platform: string | null;
  location: string | null;
  salaryText: string | null;
  interviewAt: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  applicationUrl: string | null;
  signals: string[];
  /** Pending/last observation for the ingestion engine (null when the email is not actionable). */
  observation: SerializedObservation | null;
  /** An observation existed but its confidence was below the review floor, so it was ignored. */
  belowReviewFloor?: boolean;
  /** Last ingestion outcome written by the pipeline. */
  ingest?: {
    action: IngestResult["action"] | "error";
    reason: string;
    candidateIds: string[];
    statusApplied: string | null;
    at: string;
  } | null;
};

export type ReviewDecision = { status: Extract<ReviewStatus, "AUTO_ACCEPTED" | "NEEDS_REVIEW">; actionable: boolean; reason: string };

/**
 * Review routing:
 * - no observation (job alert, unfinished application, invitation, unrelated, unknown) → AUTO_ACCEPTED, stored for the record;
 * - observation below the review floor (0.45) → AUTO_ACCEPTED and ignored;
 * - confidence ≥ 0.8 and an employer → AUTO_ACCEPTED (ingested automatically);
 * - otherwise → NEEDS_REVIEW.
 */
export function decideReviewStatus(classification: Classification, observation: ApplicationObservation | null): ReviewDecision {
  if (!observation) return { status: "AUTO_ACCEPTED", actionable: false, reason: "Not an application update" };
  const c = classification.confidence;
  if (c < INGEST_THRESHOLDS.REVIEW_FLOOR) {
    return { status: "AUTO_ACCEPTED", actionable: false, reason: `Confidence ${c.toFixed(2)} is below the review floor` };
  }
  if (!observation.company) return { status: "NEEDS_REVIEW", actionable: true, reason: "Employer could not be identified" };
  if (c < INGEST_THRESHOLDS.AUTO_APPLY) {
    return { status: "NEEDS_REVIEW", actionable: true, reason: `Confidence ${c.toFixed(2)} is below ${INGEST_THRESHOLDS.AUTO_APPLY}` };
  }
  return { status: "AUTO_ACCEPTED", actionable: true, reason: "High-confidence application update" };
}

/** Body text kept for review: URL query strings (tracking tokens) removed, capped at 8 KB. */
export function minimizedBody(text: string): string {
  const stripped = text.replace(/\b(https?:\/\/[^\s?#<>()"']+)[?#][^\s<>()"']*/gi, "$1");
  return truncateUtf8(stripped, MAX_STORED_BODY_BYTES);
}

/** JSON-safe copy (drops undefined, converts Dates) for a Prisma Json column. */
function toJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readExtract(value: Prisma.JsonValue | null | undefined): Partial<StoredEmailExtract> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<StoredEmailExtract>) : {};
}

function buildExtract(classification: Classification, observation: ApplicationObservation | null, decision: ReviewDecision): StoredEmailExtract {
  const x = classification.extracted;
  return {
    version: 1,
    employer: x.employer,
    positionTitle: x.positionTitle,
    requisitionNumber: x.requisitionNumber,
    platform: x.platform,
    location: x.location,
    salaryText: x.salaryText,
    interviewAt: x.interviewAt ? x.interviewAt.toISOString() : null,
    recruiterName: x.recruiterName,
    recruiterEmail: x.recruiterEmail,
    applicationUrl: x.applicationUrl,
    signals: classification.signals.slice(0, 30),
    observation: observation && decision.actionable ? serializeObservation(observation) : null,
    ...(observation && !decision.actionable ? { belowReviewFloor: true } : {}),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

// Ownership checks for connection / import batch ids (memoized positives; ids never come from the client
// directly, but rows must never be attached to another user's connection or batch).
const ownedRefs = new Set<string>();
async function assertOwnedRefs(userId: string, connectionId?: string | null, importBatchId?: string | null) {
  if (connectionId && !ownedRefs.has(`c:${userId}:${connectionId}`)) {
    const c = await prisma.integrationConnection.findFirst({ where: { id: connectionId, userId }, select: { id: true } });
    if (!c) throw new Error("Integration connection not found for this user.");
    if (ownedRefs.size > 2000) ownedRefs.clear();
    ownedRefs.add(`c:${userId}:${connectionId}`);
  }
  if (importBatchId && !ownedRefs.has(`b:${userId}:${importBatchId}`)) {
    const b = await prisma.importBatch.findFirst({ where: { id: importBatchId, userId }, select: { id: true } });
    if (!b) throw new Error("Import batch not found for this user.");
    if (ownedRefs.size > 2000) ownedRefs.clear();
    ownedRefs.add(`b:${userId}:${importBatchId}`);
  }
}

export type UpsertOutcome = {
  row: EmailMessage;
  /** The row as it was before this call (null when newly created). */
  previous: EmailMessage | null;
  /** The user had already confirmed or dismissed this row; its review state was preserved. */
  userReviewed: boolean;
  decision: ReviewDecision;
};

/** Upsert with full outcome details (used by the pipeline). */
export async function upsertClassifiedEmail(userId: string, input: StoreEmailInput): Promise<UpsertOutcome> {
  const { parsed, classification, observation, provider } = input;
  await assertOwnedRefs(userId, input.connectionId, input.importBatchId);

  const decision = decideReviewStatus(classification, observation);
  const extract = buildExtract(classification, observation, decision);
  const snippet = observation?.evidence.snippet ?? buildSnippet(parsed.text, classification.matchedPhrase);
  const body = decision.status === "NEEDS_REVIEW" ? minimizedBody(parsed.text) : null;
  const where = { userId_provider_externalId: { userId, provider, externalId: parsed.externalId } };

  const common = {
    threadId: parsed.threadId,
    fromAddress: parsed.fromAddress,
    fromName: parsed.fromName,
    toAddress: parsed.toAddress,
    subject: parsed.subject,
    receivedAt: parsed.receivedAt,
    snippet,
    classification: classification.classification,
    confidence: classification.confidence,
    ...(input.connectionId ? { connectionId: input.connectionId } : {}),
    ...(input.importBatchId ? { importBatchId: input.importBatchId } : {}),
  };

  let previous = await prisma.emailMessage.findUnique({ where });
  if (!previous) {
    try {
      const row = await prisma.emailMessage.create({
        data: {
          userId,
          provider,
          externalId: parsed.externalId,
          ...common,
          extracted: toJson(extract),
          reviewStatus: decision.status,
          bodyText: body,
        },
      });
      return { row, previous: null, userReviewed: false, decision };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // A concurrent delivery created it first: continue as an update.
      previous = await prisma.emailMessage.findUnique({ where });
      if (!previous) throw err;
    }
  }

  const prevExtract = readExtract(previous.extracted);
  const userReviewed = USER_REVIEWED.includes(previous.reviewStatus);
  if (userReviewed) {
    // Refresh classification facts, but never the user's decision, the observation they acted on,
    // the linked application, or the body (purgeReviewedBodies owns that).
    const row = await prisma.emailMessage.update({
      where: { id: previous.id },
      data: {
        ...common,
        extracted: toJson({
          ...extract,
          observation: prevExtract.observation ?? extract.observation,
          ingest: prevExtract.ingest ?? null,
        }),
      },
    });
    return { row, previous, userReviewed: true, decision };
  }

  const row = await prisma.emailMessage.update({
    where: { id: previous.id },
    data: {
      ...common,
      extracted: toJson({ ...extract, ingest: prevExtract.ingest ?? null }),
      reviewStatus: decision.status,
      bodyText: body,
    },
  });
  return { row, previous, userReviewed: false, decision };
}

/**
 * Store (or refresh) a classified email. Idempotent on (userId, provider, externalId); re-runs refresh
 * the classification but never change a review status the user set (CONFIRMED / DISMISSED).
 */
export async function storeClassifiedEmail(userId: string, input: StoreEmailInput): Promise<EmailMessage> {
  return (await upsertClassifiedEmail(userId, input)).row;
}

export type IngestOutcome =
  | { kind: "result"; result: IngestResult; bodyText: string }
  | { kind: "error"; message: string; bodyText: string };

/**
 * Record the ingestion engine's answer on the row: link the application, or move the row to the review
 * queue (keeping the minimized body) when the engine asks for review or failed. Never touches rows the
 * user already confirmed or dismissed.
 */
export async function applyIngestOutcome(userId: string, emailMessageId: string, outcome: IngestOutcome): Promise<EmailMessage | null> {
  const current = await prisma.emailMessage.findFirst({ where: { id: emailMessageId, userId } });
  if (!current) return null;
  if (USER_REVIEWED.includes(current.reviewStatus)) return current;
  const prev = readExtract(current.extracted);
  const at = new Date().toISOString();
  const ingest: NonNullable<StoredEmailExtract["ingest"]> =
    outcome.kind === "result"
      ? {
          action: outcome.result.action,
          reason: outcome.result.reason,
          candidateIds: outcome.result.candidateIds.slice(0, 20),
          statusApplied: outcome.result.statusApplied,
          at,
        }
      : { action: "error", reason: outcome.message.slice(0, 500), candidateIds: [], statusApplied: null, at };

  const toReview = outcome.kind === "error" || outcome.result.action === "needs_review";
  let applicationId = outcome.kind === "result" && outcome.result.applicationId && !toReview ? outcome.result.applicationId : null;
  // Only ever link an application that belongs to the same user.
  if (applicationId) {
    const owned = await prisma.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
    if (!owned) applicationId = null;
  }

  await prisma.emailMessage.updateMany({
    where: { id: current.id, userId, reviewStatus: { notIn: USER_REVIEWED } },
    data: {
      extracted: toJson({ ...prev, ingest }),
      ...(applicationId ? { applicationId } : {}),
      ...(toReview ? { reviewStatus: "NEEDS_REVIEW" as const, bodyText: minimizedBody(outcome.bodyText) } : {}),
    },
  });
  // Re-read: a concurrent user decision (updateMany skipped the row) must be reflected.
  return prisma.emailMessage.findFirst({ where: { id: current.id, userId } });
}

/** Drop stored bodies from rows the user already confirmed or dismissed. Returns the number purged. */
export async function purgeReviewedBodies(userId: string): Promise<number> {
  const res = await prisma.emailMessage.updateMany({
    where: { userId, reviewStatus: { in: USER_REVIEWED }, bodyText: { not: null } },
    data: { bodyText: null },
  });
  return res.count;
}
