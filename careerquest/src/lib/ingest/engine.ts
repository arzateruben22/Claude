import "server-only";
/**
 * The ingestion engine: the only code that turns observations (email, extension, imports, platform
 * sync, mobile share) into application records. See `types.ts` for the contract.
 *
 * One observation = one database transaction:
 *   1. validate (rules.ts) and take a per-user advisory lock so concurrent deliveries for the same
 *      user cannot race each other into duplicate records;
 *   2. evidence first — insert-or-find on (userId, kind, sourceRef); evidence already attached to a
 *      record means this exact evidence was processed before → "duplicate", nothing else happens;
 *   3. match — an explicit applicationId (ownership-checked), otherwise `findCandidateMatches`:
 *      a sure top candidate with a clear margin is a match; the possible band goes to review;
 *   4. apply through the applications service (`*InTx`): status via changeStatusInTx (which refuses
 *      downgrades and overrides of user-confirmed data), empty fields only, source links, evidence
 *      attachment; or create a record when the evidence justifies one.
 * XP is only ever awarded by the service's event recording; the amounts are reported back.
 */
import { prisma } from "@/lib/db";
import type { EmailMessage, ExtensionCapture, Prisma } from "@/generated/prisma/client";
import type { ApplicationSource, ApplicationStatus, CaptureKind } from "@/generated/prisma/enums";
import { applicationInputSchema } from "@/lib/validation/application";
import {
  addSourceLinkInTx,
  changeStatusInTx,
  createApplicationInTx,
  fillEmptyFieldsInTx,
  type ServiceTx,
} from "@/lib/applications/service";
import { detectPlatform, normalizeUrl } from "@/lib/applications/normalize";
import {
  STATUS_LABELS,
  impliesSubmission,
  isTerminalStatus,
  statusRank,
} from "@/lib/applications/status";
import { INTERVIEW_TYPE_LABELS } from "@/lib/applications/labels";
import { formatInTz } from "@/lib/applications/time";
import { recordApplicationEvent } from "@/lib/events/record-event";
import { todayInTz } from "@/lib/dates";
import { findCandidateMatches, type CandidatePartial } from "./match";
import { decideMatch } from "./match-score";
import {
  IngestNotFoundError,
  IngestValidationError,
  guessInterviewType,
  parseSalaryText,
  sanitizeObservation,
  targetStatusFor,
} from "./rules";
import {
  CREATING_KINDS,
  INGEST_THRESHOLDS,
  NON_SUBMISSION_KINDS,
  deserializeObservation,
  type ApplicationObservation,
  type IngestOptions,
  type IngestResult,
  type ObservationKind,
  type SerializedObservation,
} from "./types";

export { IngestNotFoundError, IngestValidationError } from "./rules";

const DEFAULT_TIMEZONE = "America/Los_Angeles";
/** Missions/achievements run inside the same transaction; allow for them. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
const MAX_MERGE_HOPS = 5;

type Tx = ServiceTx;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Turn one observation into application changes, atomically. Throws IngestValidationError for a
 * malformed observation and IngestNotFoundError when `observation.applicationId` is not one of the
 * user's applications; every other outcome is reported in the result.
 */
export async function ingestObservation(
  userId: string,
  observation: ApplicationObservation,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const obs = sanitizeObservation(observation);
  return prisma.$transaction((tx) => ingestSanitized(tx, userId, obs, opts), TX_OPTIONS);
}

/** `ingestObservation` inside the caller's transaction (e.g. the review queue also updates its row). */
export async function ingestObservationInTx(
  tx: ServiceTx,
  userId: string,
  observation: ApplicationObservation,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  return ingestSanitized(tx, userId, sanitizeObservation(observation), opts);
}

/** Fields of an observation used for candidate lookup (also used by the review queue). */
export function partialFromObservation(
  obs: Pick<
    ApplicationObservation,
    "company" | "title" | "location" | "requisitionId" | "postingUrl" | "platform" | "observedAt"
  >,
  emailThreadId?: string | null,
): CandidatePartial {
  return {
    company: obs.company ?? null,
    title: obs.title ?? null,
    location: obs.location ?? null,
    requisitionId: obs.requisitionId ?? null,
    postingUrl: obs.postingUrl ?? null,
    platform: obs.platform ?? null,
    observedAt: obs.observedAt,
    emailThreadId: emailThreadId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Producers → observations
// ---------------------------------------------------------------------------

const CAPTURE_KIND_TO_OBSERVATION: Record<CaptureKind, ObservationKind> = {
  JOB_PAGE: "JOB_SEEN",
  APPLY_STARTED: "APPLY_STARTED",
  CONFIRMATION_PAGE: "SUBMITTED",
  MANUAL_CONFIRMATION: "USER_CONFIRMED_SUBMISSION",
  SHARED_URL: "JOB_SEEN",
};

/** A confirmation page counts as verified evidence only at this extension confidence. */
export const CAPTURE_VERIFY_MIN_CONFIDENCE = 0.9;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Observation for an extension capture row (`ExtensionCapture`). */
export function observationFromCapture(capture: ExtensionCapture, now: Date = new Date()): ApplicationObservation {
  const ev = asRecord(capture.evidence);
  const kind = CAPTURE_KIND_TO_OBSERVATION[capture.kind];
  const capturedAt = str(ev.capturedAt) ? new Date(str(ev.capturedAt)!) : null;
  const observedAt =
    capturedAt && !Number.isNaN(capturedAt.getTime()) && capturedAt.getTime() <= now.getTime()
      ? capturedAt
      : capture.createdAt;
  const url = /^https?:\/\//i.test(capture.url) ? capture.url : null;
  const platform: ApplicationSource = capture.platform !== "OTHER" ? capture.platform : detectPlatform(url);
  const verified =
    capture.kind === "MANUAL_CONFIRMATION" ||
    (capture.kind === "CONFIRMATION_PAGE" && capture.confidence >= CAPTURE_VERIFY_MIN_CONFIDENCE);
  const detectedBy = Array.isArray(ev.detectedBy)
    ? ev.detectedBy.filter((s): s is string => typeof s === "string").slice(0, 20)
    : [];
  return {
    kind,
    source: "EXTENSION",
    origin: "EXTENSION",
    observedAt,
    company: capture.company,
    title: capture.title,
    location: capture.location,
    requisitionId: capture.requisitionId,
    postingUrl: url,
    platform,
    salaryText: capture.salaryText,
    confidence: capture.confidence,
    verified,
    evidence: {
      kind: "EXTENSION_CAPTURE",
      sourceRef: `capture:${capture.id}`,
      title: str(ev.pageTitle),
      snippet: str(ev.confirmationText),
      data: { captureKind: capture.kind, platform, detectedBy, url: normalizeUrl(url) },
    },
    applicationId: capture.applicationId,
  };
}

/** The pending observation stored on an EmailMessage row by email-core, or null. */
export function observationFromEmailRow(row: Pick<EmailMessage, "extracted">): ApplicationObservation | null {
  const stored = asRecord(row.extracted).observation;
  const s = asRecord(stored);
  if (typeof s.kind !== "string" || typeof s.observedAt !== "string" || !s.evidence) return null;
  const obs = deserializeObservation(s as unknown as SerializedObservation);
  if (Number.isNaN(obs.observedAt.getTime())) return null;
  if (obs.interviewAt && Number.isNaN(obs.interviewAt.getTime())) obs.interviewAt = null;
  return obs;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

type EvidenceRef = { id: string; applicationId: string | null; created: boolean };

type Run = {
  tx: Tx;
  userId: string;
  obs: ApplicationObservation;
  opts: IngestOptions;
  ev: EvidenceRef;
  now: Date;
  timezone: string;
  /** The target record was named explicitly (review queue, extension "Attach"). */
  explicit: boolean;
};

function result(
  action: IngestResult["action"],
  applicationId: string | null,
  reason: string,
  extra: Partial<Pick<IngestResult, "candidateIds" | "statusApplied" | "xpAwarded">> = {},
): IngestResult {
  return {
    action,
    applicationId,
    candidateIds: extra.candidateIds ?? [],
    reason,
    statusApplied: extra.statusApplied ?? null,
    xpAwarded: extra.xpAwarded ?? 0,
  };
}

const fmt = (n: number) => n.toFixed(2);

/** Serialize ingestion (and merges) per user inside the transaction. */
export async function lockUserIngestion(tx: Tx, userId: string): Promise<void> {
  const key = `careerquest:ingest:${userId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

async function timezoneOf(tx: Tx, userId: string): Promise<string> {
  const p = await tx.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return p?.timezone || DEFAULT_TIMEZONE;
}

/** Follow merges so evidence for a merged-away record lands on the record that absorbed it. */
async function resolveOwnedApplication(tx: Tx, userId: string, id: string): Promise<string> {
  let current = id;
  for (let hop = 0; hop <= MAX_MERGE_HOPS; hop++) {
    const app = await tx.application.findFirst({ where: { id: current, userId }, select: { id: true, mergedIntoId: true } });
    if (!app) throw new IngestNotFoundError();
    if (!app.mergedIntoId) return app.id;
    current = app.mergedIntoId;
  }
  throw new IngestNotFoundError("Application not found (merge chain too long).");
}

function evidenceData(obs: ApplicationObservation): Prisma.InputJsonValue {
  const data: Record<string, unknown> = {
    ...asRecord(obs.evidence.data),
    observation: { kind: obs.kind, source: obs.source, confidence: obs.confidence, verified: obs.verified },
  };
  if (obs.platform && data.platform === undefined) data.platform = obs.platform;
  if (obs.interviewAt) data.interviewAt = obs.interviewAt.toISOString();
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

async function upsertEvidence(tx: Tx, userId: string, obs: ApplicationObservation): Promise<EvidenceRef> {
  const { kind, sourceRef } = obs.evidence;
  const inserted = await tx.evidence.createMany({
    data: [
      {
        userId,
        kind,
        sourceRef,
        title: obs.evidence.title ?? null,
        snippet: obs.evidence.snippet ?? null,
        capturedAt: obs.observedAt,
        data: evidenceData(obs),
      },
    ],
    skipDuplicates: true,
  });
  const row = await tx.evidence.findUnique({
    where: { userId_kind_sourceRef: { userId, kind, sourceRef } },
    select: { id: true, applicationId: true },
  });
  if (!row) throw new Error("Evidence row could not be read back.");
  return { ...row, created: inserted.count === 1 };
}

/** Email thread id for email evidence ("<PROVIDER>:<externalId>"), or one the producer supplied. */
async function emailThreadIdFor(tx: Tx, userId: string, obs: ApplicationObservation): Promise<string | null> {
  const supplied = str(asRecord(obs.evidence.data).threadId);
  if (supplied) return supplied;
  if (obs.evidence.kind !== "EMAIL") return null;
  const ref = obs.evidence.sourceRef;
  const sep = ref.indexOf(":");
  if (sep <= 0) return null;
  const row = await tx.emailMessage.findUnique({
    where: { userId_provider_externalId: { userId, provider: ref.slice(0, sep), externalId: ref.slice(sep + 1) } },
    select: { threadId: true },
  });
  return row?.threadId ?? null;
}

async function ingestSanitized(
  tx: Tx,
  userId: string,
  obs: ApplicationObservation,
  opts: IngestOptions,
): Promise<IngestResult> {
  const T = INGEST_THRESHOLDS;
  const autoApply = Math.min(1, Math.max(0, opts.autoApplyThreshold ?? T.AUTO_APPLY));
  await lockUserIngestion(tx, userId);
  const explicitId = obs.applicationId ? await resolveOwnedApplication(tx, userId, obs.applicationId) : null;

  // Starting an application is never a submission: report what it matches, change nothing.
  if (obs.kind === "APPLY_STARTED") {
    let matchId = explicitId;
    if (!matchId) {
      const d = decideMatch(await findCandidateMatches(tx, userId, partialFromObservation(obs), { limit: 3 }));
      if (d.outcome === "match") matchId = d.applicationId;
    }
    return result("ignored", matchId, "Starting an application is not a submission; nothing was recorded.");
  }

  const ev = await upsertEvidence(tx, userId, obs);
  if (!ev.created && ev.applicationId) {
    return result("duplicate", ev.applicationId, "This evidence was already recorded on the application.");
  }
  const run: Run = {
    tx,
    userId,
    obs,
    opts,
    ev,
    now: new Date(),
    timezone: await timezoneOf(tx, userId),
    explicit: explicitId !== null,
  };

  let targetId = explicitId;
  if (!targetId && !opts.forceCreate) {
    if (obs.confidence < T.REVIEW_FLOOR) {
      return discardAndIgnore(run, `Confidence ${fmt(obs.confidence)} is below the review floor (${T.REVIEW_FLOOR}).`);
    }
    const threadId = await emailThreadIdFor(tx, userId, obs);
    const candidates = await findCandidateMatches(tx, userId, partialFromObservation(obs, threadId), { limit: 5 });
    const decision = decideMatch(candidates);
    if (decision.outcome === "review") {
      const n = decision.candidateIds.length;
      return result(
        "needs_review",
        null,
        `Possibly the same job as ${n} tracked application${n === 1 ? "" : "s"} (best match ${fmt(decision.topScore)}); confirm in the review queue.`,
        { candidateIds: decision.candidateIds },
      );
    }
    if (decision.outcome === "match") {
      targetId = decision.applicationId;
      if (obs.confidence < autoApply) {
        return result(
          "needs_review",
          null,
          `Matched a tracked application, but confidence ${fmt(obs.confidence)} is below ${fmt(autoApply)}; confirm in the review queue.`,
          { candidateIds: decision.candidateIds },
        );
      }
    }
  }

  if (targetId) return applyToExisting(run, targetId);
  return createFromObservation(run, autoApply);
}

async function discardAndIgnore(run: Run, reason: string): Promise<IngestResult> {
  if (run.ev.created) await run.tx.evidence.delete({ where: { id: run.ev.id } });
  return result("ignored", null, reason);
}

function appliedAtFor(status: ApplicationStatus, obs: ApplicationObservation): string | undefined {
  const sent =
    impliesSubmission(status) ||
    ((status === "WITHDRAWN" || status === "CLOSED") && !NON_SUBMISSION_KINDS.has(obs.kind));
  return sent ? obs.observedAt.toISOString() : undefined;
}

function platformOf(obs: ApplicationObservation): ApplicationSource {
  if (obs.platform) return obs.platform;
  return obs.postingUrl ? detectPlatform(obs.postingUrl) : "OTHER";
}

async function createFromObservation(run: Run, autoApply: number): Promise<IngestResult> {
  const { tx, userId, obs, opts, ev } = run;
  const T = INGEST_THRESHOLDS;
  if (!CREATING_KINDS.has(obs.kind)) {
    return discardAndIgnore(run, "Nothing matched, and this kind of evidence never creates an application.");
  }
  const status = opts.statusOverride ?? targetStatusFor(obs);
  if (!status) return discardAndIgnore(run, "This evidence does not imply an application stage.");

  if (!obs.company || !obs.title) {
    if (opts.forceCreate) throw new IngestValidationError("Company and job title are required to create an application.");
    if (obs.confidence >= T.REVIEW_FLOOR) {
      return result("needs_review", null, "Company or job title is missing; add them in the review queue.");
    }
    return discardAndIgnore(run, "Company or job title is missing and confidence is low.");
  }
  if (!opts.forceCreate) {
    if (obs.confidence < autoApply) {
      return result(
        "needs_review",
        null,
        `Confidence ${fmt(obs.confidence)} is below ${fmt(autoApply)}; confirm in the review queue before a record is created.`,
      );
    }
    if (opts.allowCreate === false) {
      return result("needs_review", null, "No tracked application matches; confirm to create one.");
    }
  }

  const platform = platformOf(obs);
  const salary = parseSalaryText(obs.salaryText);
  const parsed = applicationInputSchema.safeParse({
    companyName: obs.company,
    positionTitle: obs.title,
    postingUrl: obs.postingUrl ?? undefined,
    requisitionNumber: obs.requisitionId ?? undefined,
    source: platform,
    location: obs.location ?? undefined,
    salaryMin: salary?.min,
    salaryMax: salary?.max ?? undefined,
    salaryPeriod: salary?.period,
    status,
    appliedAt: appliedAtFor(status, obs),
    recruiterName: obs.recruiterName ?? undefined,
    recruiterEmail: obs.recruiterEmail ?? undefined,
  });
  if (!parsed.success) {
    throw new IngestValidationError(parsed.error.issues[0]?.message ?? "Observation fields are invalid.");
  }
  const created = await createApplicationInTx(tx, userId, parsed.data, obs.origin, {
    source: obs.source,
    verified: obs.verified,
    evidenceId: ev.id,
  });
  const appId = created.application.id;
  await tx.application.update({
    where: { id: appId },
    data: { detectionConfidence: obs.confidence, lastSyncedAt: run.now },
  });
  if (platform !== "OTHER" || obs.postingUrl) {
    await addSourceLinkInTx(tx, userId, appId, { platform, url: obs.postingUrl, origin: obs.origin });
  }
  await tx.evidence.update({ where: { id: ev.id }, data: { applicationId: appId } });
  const interview = await recordInterviewInvite(run, appId, false);
  const label = `${created.application.companyName} – ${created.application.positionTitle}`;
  return result(
    "created",
    appId,
    `Created ${label} as ${STATUS_LABELS[status]}${obs.verified ? "" : " (unverified)"}${interview.interviewId ? "; interview added" : ""}.`,
    { statusApplied: status, xpAwarded: created.xpAwarded + interview.xp },
  );
}

/**
 * Would moving `current` → `next` be real progress (worth asking the user about when the service
 * refuses an inferred change)? Same or earlier stages are stale news; a closing status after an
 * open stage, or later-stage evidence after a closed one, is progress.
 */
export function isStatusProgress(current: ApplicationStatus, next: ApplicationStatus): boolean {
  if (current === next) return false;
  const ct = isTerminalStatus(current);
  const nt = isTerminalStatus(next);
  if (ct && nt) return false;
  if (!ct && !nt) return statusRank(next) > statusRank(current);
  if (nt) return true;
  return statusRank(next) >= statusRank("SCREENING");
}

async function eventExists(tx: Tx, userId: string, dedupeKey: string): Promise<boolean> {
  const e = await tx.applicationEvent.findUnique({ where: { userId_dedupeKey: { userId, dedupeKey } }, select: { id: true } });
  return e !== null;
}

async function applyToExisting(run: Run, applicationId: string): Promise<IngestResult> {
  const { tx, userId, obs, opts, ev } = run;
  const app = await tx.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, companyName: true, positionTitle: true, status: true, statusVerified: true, statusUpdatedAt: true },
  });
  if (!app) throw new IngestNotFoundError();
  const label = `${app.companyName} – ${app.positionTitle}`;
  const status = opts.statusOverride ?? targetStatusFor(obs);
  const hadInterviewMilestone = obs.interviewAt
    ? await eventExists(tx, userId, `${applicationId}:INTERVIEW_SCHEDULED`)
    : true;

  let xp = 0;
  let statusApplied: ApplicationStatus | null = null;
  let statusNote: string | null = null;
  const reopensWithOlderEvidence =
    status !== null &&
    isTerminalStatus(app.status) &&
    !isTerminalStatus(status) &&
    obs.observedAt.getTime() < app.statusUpdatedAt.getTime();
  if (reopensWithOlderEvidence) {
    statusNote = `stage unchanged: this evidence is older than the current ${STATUS_LABELS[app.status]} stage`;
  } else if (status && status !== "SAVED") {
    const change = await changeStatusInTx(
      tx,
      userId,
      applicationId,
      {
        status,
        occurredAt: obs.observedAt,
        evidenceId: ev.id,
        note: obs.interviewAt ? `Interview invitation for ${formatInTz(obs.interviewAt, run.timezone, "datetime")}` : null,
      },
      obs.source,
      obs.verified,
    );
    if (change.applied) {
      statusApplied = change.toStatus;
      xp += change.xpAwarded;
      statusNote = change.confirmed ? `confirmed ${STATUS_LABELS[change.toStatus]}` : `moved to ${STATUS_LABELS[change.toStatus]}`;
    } else if (change.reason === "inferred_not_allowed" && !run.explicit && isStatusProgress(app.status, status)) {
      // Unverified progress over a verified stage: nothing is applied or attached; the user decides.
      return result(
        "needs_review",
        null,
        `Would move ${label} from ${STATUS_LABELS[app.status]} to ${STATUS_LABELS[status]}, but the current stage is verified and this evidence is not; confirm in the review queue.`,
        { candidateIds: [applicationId] },
      );
    } else {
      statusNote = change.reason === "same_status" ? change.message : `stage unchanged: ${change.message}`;
    }
  }

  const salary = parseSalaryText(obs.salaryText);
  const fill = await fillEmptyFieldsInTx(tx, userId, applicationId, {
    location: obs.location,
    requisitionNumber: obs.requisitionId,
    postingUrl: obs.postingUrl,
    recruiterName: obs.recruiterName,
    recruiterEmail: obs.recruiterEmail,
    salaryMin: salary?.min ?? null,
    salaryMax: salary?.max ?? null,
    salaryPeriod: salary?.period ?? null,
  });
  const platform = platformOf(obs);
  let linked = false;
  if (platform !== "OTHER" || obs.postingUrl) {
    linked = (await addSourceLinkInTx(tx, userId, applicationId, { platform, url: obs.postingUrl, origin: obs.origin })).created;
  }
  await tx.evidence.update({ where: { id: ev.id }, data: { applicationId } });
  await tx.application.update({ where: { id: applicationId }, data: { lastSyncedAt: run.now } });
  const interview = await recordInterviewInvite(run, applicationId, hadInterviewMilestone);
  xp += interview.xp;

  const parts = [
    statusNote,
    "evidence attached",
    fill.filled.length ? `filled ${fill.filled.join(", ")}` : null,
    linked ? "source link added" : null,
    interview.interviewId ? "interview added" : null,
  ].filter(Boolean);
  return result("updated", applicationId, `Matched ${label}: ${parts.join("; ")}.`, {
    statusApplied,
    xpAwarded: xp,
  });
}

/**
 * Keep an interview invitation's time. The status change (or creation) records the stage's
 * INTERVIEW_SCHEDULED milestone; when that happened in this transaction the time is written onto
 * that milestone's payload. An Interview row is created only for verified evidence (a reviewed
 * invitation); unverified times stay on the evidence for the review queue to offer.
 */
async function recordInterviewInvite(
  run: Run,
  applicationId: string,
  hadMilestone: boolean,
): Promise<{ xp: number; interviewId: string | null }> {
  const { tx, userId, obs, ev, timezone } = run;
  const at = obs.interviewAt;
  if (!at) return { xp: 0, interviewId: null };
  const type = obs.interviewType ?? guessInterviewType([obs.evidence.title, obs.evidence.snippet].filter(Boolean).join(" "));
  const when = formatInTz(at, timezone, "datetime");
  let xp = 0;
  let interviewId: string | null = null;

  if (obs.verified) {
    const existing = await tx.interview.findFirst({
      where: { userId, applicationId, scheduledAt: at },
      select: { id: true },
    });
    if (existing) {
      interviewId = existing.id;
    } else {
      const interview = await tx.interview.create({
        data: { userId, applicationId, type, scheduledAt: at, notes: "Added from a reviewed interview invitation." },
      });
      interviewId = interview.id;
      if (hadMilestone) {
        const r = await recordApplicationEvent(tx, {
          userId,
          applicationId,
          type: "INTERVIEW_SCHEDULED",
          source: obs.source,
          verified: true,
          occurredAt: obs.observedAt,
          activityDate: todayInTz(timezone, obs.observedAt),
          dedupeKey: `${applicationId}:INTERVIEW_SCHEDULED:${interview.id}`,
          evidenceId: ev.id,
          payload: { interviewId: interview.id, scheduledAt: at.toISOString(), typeLabel: INTERVIEW_TYPE_LABELS[type], scheduledFor: when },
        });
        xp += r.xpAwarded;
      }
    }
  }

  if (!hadMilestone) {
    const milestone = await tx.applicationEvent.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: `${applicationId}:INTERVIEW_SCHEDULED` } },
      select: { id: true, payload: true },
    });
    if (milestone) {
      await tx.applicationEvent.update({
        where: { id: milestone.id },
        data: {
          payload: {
            ...(asRecord(milestone.payload) as Record<string, Prisma.InputJsonValue>),
            scheduledAt: at.toISOString(),
            scheduledFor: obs.verified ? when : `${when} (read from the invitation, not confirmed)`,
            ...(obs.verified ? { typeLabel: INTERVIEW_TYPE_LABELS[type] } : {}),
            ...(interviewId ? { interviewId } : {}),
            invitationEvidenceId: ev.id,
          },
        },
      });
    }
  }
  return { xp, interviewId };
}
