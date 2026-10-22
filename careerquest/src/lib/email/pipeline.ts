import "server-only";
/**
 * Email processing pipeline: parse → classify → observation → store → ingest.
 *
 * The ingestion function is injected (the real one is `ingestObservation` from
 * `src/lib/ingest/engine.ts`), so sync jobs, imports and tests share exactly the same path. Only
 * AUTO_ACCEPTED rows with an observation are ingested automatically; everything else is stored for the
 * record or queued for the user's review. Rows the user already confirmed or dismissed are never
 * re-ingested.
 */
import type { EmailClassification } from "@/generated/prisma/enums";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";
import { classifyEmailWithOptionalAi, type EmailAiClassifier } from "./classify";
import { toObservation, type EmailProvider } from "./observation";
import { parseEmail, type ParsedEmail } from "./parse";
import { applyIngestOutcome, upsertClassifiedEmail } from "./store";

export type IngestFn = (userId: string, observation: ApplicationObservation) => Promise<IngestResult>;

export type EmailPipelineContext = {
  provider: EmailProvider;
  connectionId?: string | null;
  importBatchId?: string | null;
  /** Optional AI second opinion for low-confidence messages. */
  ai?: EmailAiClassifier | null;
  /** observedAt fallback for messages without a Date header. */
  now?: Date;
};

export type EmailProcessAction =
  /** Ingested: the engine created/updated/matched an application. */
  | "ingested"
  /** Already ingested earlier with the same classification; nothing re-applied. */
  | "duplicate"
  /** Stored in the review queue (low confidence, missing employer, or the engine asked for review). */
  | "needs_review"
  /** Stored for the record only (job alert, unfinished application, invitation, unrelated…). */
  | "stored"
  /** The engine (or the review floor) decided the observation is not actionable. */
  | "ignored"
  /** The user already confirmed/dismissed this message; their decision stands. */
  | "user_reviewed"
  /** The engine threw; the message was queued for review so nothing is lost. */
  | "ingest_failed";

export type EmailProcessSummary = {
  emailMessageId: string;
  externalId: string;
  classification: EmailClassification;
  confidence: number;
  action: EmailProcessAction;
  applicationId: string | null;
  reason: string;
};

const NOT_ACTIONABLE_REASON: Partial<Record<EmailClassification, string>> = {
  JOB_ALERT: "Job alert digest — not an application.",
  INCOMPLETE_APPLICATION: "Unfinished-application reminder — nothing was submitted.",
  APPLICATION_INVITATION: "Invitation to apply — no application exists yet.",
  UNRELATED: "Not related to a job application.",
  UNKNOWN: "Could not tell what this email is about.",
};

/** Process one message (raw RFC 5322 source or an already-parsed email) end to end. */
export async function processRawEmail(
  userId: string,
  input: string | Buffer | ParsedEmail,
  ctx: EmailPipelineContext,
  ingest: IngestFn,
): Promise<EmailProcessSummary> {
  const parsed = typeof input === "string" || Buffer.isBuffer(input) ? await parseEmail(input) : input;
  const classification = await classifyEmailWithOptionalAi(parsed, ctx.ai);
  const observation = toObservation(parsed, classification, { provider: ctx.provider, now: ctx.now });
  const stored = await upsertClassifiedEmail(userId, {
    parsed,
    classification,
    observation,
    provider: ctx.provider,
    connectionId: ctx.connectionId,
    importBatchId: ctx.importBatchId,
  });
  const { row, previous, decision } = stored;
  const base = {
    emailMessageId: row.id,
    externalId: row.externalId,
    classification: row.classification,
    confidence: row.confidence,
  };

  if (stored.userReviewed) {
    return { ...base, action: "user_reviewed", applicationId: row.applicationId, reason: `Already ${row.reviewStatus.toLowerCase()} by you.` };
  }
  if (!observation) {
    return { ...base, action: "stored", applicationId: row.applicationId, reason: NOT_ACTIONABLE_REASON[row.classification] ?? decision.reason };
  }
  if (!decision.actionable) {
    return { ...base, action: "ignored", applicationId: row.applicationId, reason: decision.reason };
  }
  if (row.reviewStatus === "NEEDS_REVIEW") {
    return { ...base, action: "needs_review", applicationId: row.applicationId, reason: decision.reason };
  }

  // Idempotent re-delivery: same message, same classification, already linked.
  if (
    previous &&
    previous.applicationId &&
    previous.reviewStatus === "AUTO_ACCEPTED" &&
    previous.classification === row.classification
  ) {
    return { ...base, action: "duplicate", applicationId: previous.applicationId, reason: "Already processed." };
  }

  let result: IngestResult;
  try {
    result = await ingest(userId, observation);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await applyIngestOutcome(userId, row.id, { kind: "error", message, bodyText: parsed.text });
    return { ...base, action: "ingest_failed", applicationId: null, reason: `Could not apply automatically (${message}); queued for review.` };
  }

  const updated = await applyIngestOutcome(userId, row.id, { kind: "result", result, bodyText: parsed.text });
  const applicationId = updated?.applicationId ?? null;
  switch (result.action) {
    case "needs_review":
      return { ...base, action: "needs_review", applicationId, reason: result.reason };
    case "ignored":
      return { ...base, action: "ignored", applicationId, reason: result.reason };
    case "duplicate":
      return { ...base, action: "duplicate", applicationId, reason: result.reason };
    default:
      return { ...base, action: "ingested", applicationId, reason: result.reason };
  }
}

export type BatchItemResult =
  | { ok: true; index: number; summary: EmailProcessSummary }
  | { ok: false; index: number; error: string };

/**
 * Process many messages sequentially (imports, sync pages). One failing message never stops the batch;
 * its error is reported in place.
 */
export async function processRawEmails(
  userId: string,
  inputs: Array<string | Buffer | ParsedEmail>,
  ctx: EmailPipelineContext,
  ingest: IngestFn,
): Promise<BatchItemResult[]> {
  const out: BatchItemResult[] = [];
  for (let index = 0; index < inputs.length; index++) {
    try {
      out.push({ ok: true, index, summary: await processRawEmail(userId, inputs[index]!, ctx, ingest) });
    } catch (err) {
      out.push({ ok: false, index, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
