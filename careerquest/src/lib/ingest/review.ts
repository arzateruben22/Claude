import "server-only";
/**
 * Review queue data and decisions (/applications/review).
 *
 * Loaders turn pending EmailMessage rows (NEEDS_REVIEW), extension captures (PENDING_CONFIRMATION)
 * and duplicate candidates (PENDING) into view models, with live candidate matches. Resolvers apply
 * the user's decision: they re-ingest the observation with the user's edits, an explicit target or
 * forceCreate, and `verified = true` (the user reviewed it) while the event source stays the
 * producer's (EMAIL / EXTENSION), and update the queue row in the same transaction.
 */
import { prisma } from "@/lib/db";
import type { EmailMessage, ExtensionCapture, Prisma } from "@/generated/prisma/client";
import { ApplicationSource, type ApplicationStatus, type InterviewType } from "@/generated/prisma/enums";
import { RECORD_ORIGIN_LABELS, SOURCE_LABELS } from "@/lib/applications/labels";
import { STATUS_LABELS } from "@/lib/applications/status";
import { dateTimeInputValue, formatInTz } from "@/lib/applications/time";
import { scheduleInterview, userTimezone } from "@/lib/applications/service";
import { observationKindFor } from "@/lib/email/observation";
import { purgeReviewedBodies, type StoredEmailExtract } from "@/lib/email/store";
import { suggestKeep } from "@/lib/dedup/pairs";
import {
  ingestObservationInTx,
  observationFromCapture,
  observationFromEmailRow,
  partialFromObservation,
} from "./engine";
import { findCandidateMatches, type CandidateMatch } from "./match";
import type { MatchSignal } from "./match-score";
import { guessInterviewType, kindForStatus, targetStatusFor } from "./rules";
import { serializeObservation, type ApplicationObservation, type IngestResult } from "./types";
import {
  CAPTURE_KIND_LABELS,
  EMAIL_CLASSIFICATION_LABELS,
  type AttachOption,
  type CaptureReviewItemView,
  type DuplicateReviewItemView,
  type DuplicateSideView,
  type EmailReviewItemView,
  type InterviewInviteView,
  type ReviewCandidateView,
  type ReviewCounts,
  type SignalView,
} from "./review-view";
import type { ParsedDecision } from "./review-schemas";

export const REVIEW_PAGE_SIZE = 25;
const CANDIDATE_LIMIT = 4;
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
/** Interview invitations older than this are not offered for a calendar entry. */
const INVITE_LOOKBACK_MS = 14 * 86_400_000;

export class ReviewError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function readExtract(v: Prisma.JsonValue): Partial<StoredEmailExtract> {
  return asRecord(v) as Partial<StoredEmailExtract>;
}

function validDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function signalViews(signals: MatchSignal[]): SignalView[] {
  return signals.map((s) => ({ label: s.label, effect: s.effect }));
}

function candidateView(c: CandidateMatch, tz: string): ReviewCandidateView {
  const a = c.application;
  return {
    applicationId: c.applicationId,
    companyName: a.companyName,
    positionTitle: a.positionTitle,
    location: a.location,
    status: a.status,
    statusVerified: a.statusVerified,
    sourceLabel: SOURCE_LABELS[a.source],
    dateLabel: a.appliedAt ? `Applied ${formatInTz(a.appliedAt, tz)}` : `Added ${formatInTz(a.createdAt, tz)}`,
    archived: a.archivedAt !== null,
    score: c.score,
    signals: signalViews(c.signals),
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function getReviewCounts(userId: string): Promise<ReviewCounts> {
  const [emails, captures, duplicates] = await Promise.all([
    prisma.emailMessage.count({ where: { userId, reviewStatus: "NEEDS_REVIEW" } }),
    prisma.extensionCapture.count({ where: { userId, status: "PENDING_CONFIRMATION" } }),
    prisma.duplicateCandidate.count({
      where: { userId, status: "PENDING", applicationA: { mergedIntoId: null }, applicationB: { mergedIntoId: null } },
    }),
  ]);
  return { emails, captures, duplicates };
}

/** Recently updated records for the "Attach to another application" picker. */
export async function loadAttachOptions(userId: string): Promise<AttachOption[]> {
  const rows = await prisma.application.findMany({
    where: { userId, mergedIntoId: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, companyName: true, positionTitle: true, status: true },
  });
  return rows.map((r) => ({ id: r.id, label: `${r.companyName} – ${r.positionTitle} (${STATUS_LABELS[r.status]})` }));
}

/** The observation a review decision starts from (stored one, or one rebuilt from the row). */
function emailObservation(row: EmailMessage, fallbackStatus: ApplicationStatus): ApplicationObservation {
  const stored = observationFromEmailRow(row);
  if (stored) return stored;
  const x = readExtract(row.extracted);
  const platform = str(x.platform);
  return {
    kind: observationKindFor(row.classification) ?? kindForStatus(fallbackStatus),
    source: "EMAIL",
    origin: "EMAIL",
    observedAt: row.receivedAt ?? row.createdAt,
    company: str(x.employer),
    title: str(x.positionTitle),
    location: str(x.location),
    requisitionId: str(x.requisitionNumber),
    postingUrl: null,
    platform: platform && Object.prototype.hasOwnProperty.call(ApplicationSource, platform) ? (platform as ApplicationSource) : null,
    salaryText: str(x.salaryText),
    recruiterName: str(x.recruiterName),
    recruiterEmail: str(x.recruiterEmail),
    interviewAt: validDate(x.interviewAt),
    confidence: row.confidence,
    verified: false,
    evidence: {
      kind: "EMAIL",
      sourceRef: `${row.provider}:${row.externalId}`,
      title: row.subject,
      snippet: row.snippet,
      data: { classification: row.classification, provider: row.provider },
    },
  };
}

function defaultStatus(obs: ApplicationObservation): ApplicationStatus {
  // The user's confirmation makes the evidence verified, so show the stage it will produce.
  return targetStatusFor({ ...obs, verified: true }) ?? "SAVED";
}

function queueReason(row: EmailMessage, obs: ApplicationObservation): string | null {
  const ingest = readExtract(row.extracted).ingest;
  if (ingest?.reason && (ingest.action === "needs_review" || ingest.action === "error")) {
    return ingest.action === "error" ? `Could not be applied automatically: ${ingest.reason}` : ingest.reason;
  }
  if (!obs.company) return "The employer could not be identified.";
  if (row.confidence < 0.8) return `Classification confidence ${Math.round(row.confidence * 100)}% is below the 80% needed to apply it automatically.`;
  return null;
}

export async function loadEmailReview(
  userId: string,
  opts: { now?: Date } = {},
): Promise<{
  items: EmailReviewItemView[];
  total: number;
  invites: InterviewInviteView[];
}> {
  const tz = await userTimezone(userId);
  const [rows, total] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { userId, reviewStatus: "NEEDS_REVIEW" },
      orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: REVIEW_PAGE_SIZE,
    }),
    prisma.emailMessage.count({ where: { userId, reviewStatus: "NEEDS_REVIEW" } }),
  ]);
  const items: EmailReviewItemView[] = [];
  for (const row of rows) {
    const obs = emailObservation(row, "SAVED");
    const candidates = await findCandidateMatches(prisma, userId, partialFromObservation(obs, row.threadId), {
      limit: CANDIDATE_LIMIT,
    });
    const isInterview = obs.kind === "INTERVIEW_INVITED" || row.classification === "INTERVIEW_INVITATION";
    items.push({
      id: row.id,
      subject: row.subject ?? "(no subject)",
      from: row.fromName ? `${row.fromName}${row.fromAddress ? ` <${row.fromAddress}>` : ""}` : (row.fromAddress ?? "Unknown sender"),
      receivedLabel: row.receivedAt ? formatInTz(row.receivedAt, tz, "datetime") : "Date unknown",
      classificationLabel: EMAIL_CLASSIFICATION_LABELS[row.classification],
      confidence: row.confidence,
      verifiedSender: obs.verified,
      reason: queueReason(row, obs),
      snippet: row.snippet,
      body: row.bodyText,
      isInterview,
      fields: {
        company: obs.company ?? "",
        title: obs.title ?? "",
        location: obs.location ?? "",
        status: defaultStatus(obs),
        interviewAt: dateTimeInputValue(obs.interviewAt ?? null, tz),
        interviewType: obs.interviewType ?? guessInterviewType(`${row.subject ?? ""} ${row.snippet ?? ""}`),
      },
      candidates: candidates.map((c) => candidateView(c, tz)),
    });
  }
  return { items, total, invites: await loadInterviewInvites(userId, tz, opts.now) };
}

/**
 * Interview invitations that were filed automatically (unverified, so no Interview row was created)
 * and whose time has no interview on the record yet.
 */
async function loadInterviewInvites(userId: string, tz: string, now = new Date()): Promise<InterviewInviteView[]> {
  const rows = await prisma.emailMessage.findMany({
    where: {
      userId,
      reviewStatus: "AUTO_ACCEPTED",
      classification: "INTERVIEW_INVITATION",
      applicationId: { not: null },
    },
    orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      subject: true,
      snippet: true,
      receivedAt: true,
      createdAt: true,
      extracted: true,
      applicationId: true,
      application: {
        select: { companyName: true, positionTitle: true, mergedIntoId: true, interviews: { select: { scheduledAt: true }, take: 50 } },
      },
    },
  });
  const out: InterviewInviteView[] = [];
  for (const r of rows) {
    const at = validDate(readExtract(r.extracted).interviewAt);
    const app = r.application;
    if (!at || !app || !r.applicationId || app.mergedIntoId) continue;
    if (at.getTime() < now.getTime() - INVITE_LOOKBACK_MS) continue;
    if (app.interviews.some((i) => Math.abs(i.scheduledAt.getTime() - at.getTime()) < 30 * 60_000)) continue;
    out.push({
      emailId: r.id,
      applicationId: r.applicationId,
      companyName: app.companyName,
      positionTitle: app.positionTitle,
      subject: r.subject ?? "(no subject)",
      receivedLabel: formatInTz(r.receivedAt ?? r.createdAt, tz, "date"),
      interviewAtLabel: formatInTz(at, tz, "datetime"),
      interviewAt: dateTimeInputValue(at, tz),
      interviewType: guessInterviewType(`${r.subject ?? ""} ${r.snippet ?? ""}`),
    });
  }
  return out;
}

function urlLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 40 ? `${u.pathname.slice(0, 39)}…` : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path === "/" ? "" : path}`;
  } catch {
    return url.slice(0, 60);
  }
}

export async function loadCaptureReview(userId: string): Promise<{ items: CaptureReviewItemView[]; total: number }> {
  const tz = await userTimezone(userId);
  const [rows, total] = await Promise.all([
    prisma.extensionCapture.findMany({
      where: { userId, status: "PENDING_CONFIRMATION" },
      orderBy: { createdAt: "desc" },
      take: REVIEW_PAGE_SIZE,
    }),
    prisma.extensionCapture.count({ where: { userId, status: "PENDING_CONFIRMATION" } }),
  ]);
  const items: CaptureReviewItemView[] = [];
  for (const row of rows) {
    const obs = observationFromCapture(row);
    const candidates = await findCandidateMatches(prisma, userId, partialFromObservation(obs), { limit: CANDIDATE_LIMIT });
    const httpUrl = /^https?:\/\//i.test(row.url) ? row.url : null;
    items.push({
      id: row.id,
      kindLabel: CAPTURE_KIND_LABELS[row.kind],
      url: httpUrl,
      urlLabel: httpUrl ? urlLabel(httpUrl) : "Link not available",
      platformLabel: SOURCE_LABELS[obs.platform ?? "OTHER"],
      capturedLabel: formatInTz(obs.observedAt, tz, "datetime"),
      confidence: row.confidence,
      pageTitle: obs.evidence.title ?? null,
      confirmationText: obs.evidence.snippet ?? null,
      salaryText: row.salaryText,
      applyStartedOnly: row.kind === "APPLY_STARTED",
      fields: {
        company: obs.company ?? "",
        title: obs.title ?? "",
        location: obs.location ?? "",
        status: row.kind === "APPLY_STARTED" ? "PREPARING" : defaultStatus(obs),
        interviewAt: "",
        interviewType: "OTHER",
      },
      candidates: candidates.map((c) => candidateView(c, tz)),
    });
  }
  return { items, total };
}

const sideSelect = {
  id: true,
  companyName: true,
  positionTitle: true,
  location: true,
  status: true,
  statusVerified: true,
  statusUpdatedAt: true,
  source: true,
  appliedAt: true,
  createdAt: true,
  createdVia: true,
  archivedAt: true,
  _count: { select: { evidence: true, interviews: true } },
} satisfies Prisma.ApplicationSelect;

type SideRow = Prisma.ApplicationGetPayload<{ select: typeof sideSelect }>;

function sideView(a: SideRow, tz: string): DuplicateSideView {
  return {
    id: a.id,
    companyName: a.companyName,
    positionTitle: a.positionTitle,
    location: a.location,
    status: a.status,
    statusVerified: a.statusVerified,
    sourceLabel: SOURCE_LABELS[a.source],
    appliedLabel: a.appliedAt ? formatInTz(a.appliedAt, tz) : null,
    createdLabel: formatInTz(a.createdAt, tz),
    createdViaLabel: RECORD_ORIGIN_LABELS[a.createdVia],
    evidenceCount: a._count.evidence,
    interviewCount: a._count.interviews,
    archived: a.archivedAt !== null,
  };
}

function storedSignals(v: Prisma.JsonValue): SignalView[] {
  const list = asRecord(v).signals;
  if (!Array.isArray(list)) return [];
  const out: SignalView[] = [];
  for (const s of list.slice(0, 12)) {
    const r = asRecord(s);
    const effect = r.effect;
    if (typeof r.label === "string" && (effect === "strong" || effect === "positive" || effect === "neutral" || effect === "negative")) {
      out.push({ label: r.label, effect });
    }
  }
  return out;
}

export async function loadDuplicateReview(userId: string): Promise<{ items: DuplicateReviewItemView[]; total: number }> {
  const tz = await userTimezone(userId);
  const where = {
    userId,
    status: "PENDING" as const,
    applicationA: { mergedIntoId: null },
    applicationB: { mergedIntoId: null },
  } satisfies Prisma.DuplicateCandidateWhereInput;
  const [rows, total] = await Promise.all([
    prisma.duplicateCandidate.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: REVIEW_PAGE_SIZE,
      include: { applicationA: { select: sideSelect }, applicationB: { select: sideSelect } },
    }),
    prisma.duplicateCandidate.count({ where }),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      score: r.score,
      signals: storedSignals(r.signals),
      a: sideView(r.applicationA, tz),
      b: sideView(r.applicationB, tz),
      suggestedKeepId: suggestKeep(r.applicationA, r.applicationB).id,
    })),
  };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type ReviewEdits = {
  company?: string;
  title?: string;
  location?: string;
  status: ApplicationStatus;
  /** undefined: not shown/unchanged; null: the user cleared it. */
  interviewAt?: Date | null;
  interviewType?: InterviewType;
};

export type ReviewOutcome = { message: string; applicationId: string | null; xpAwarded: number };

function applyEdits(base: ApplicationObservation, edits: ReviewEdits, decision: ParsedDecision): ApplicationObservation {
  return {
    ...base,
    kind: base.kind === "APPLY_STARTED" ? kindForStatus(edits.status) : base.kind,
    company: edits.company ?? base.company ?? null,
    title: edits.title ?? base.title ?? null,
    location: edits.location ?? base.location ?? null,
    interviewAt: edits.interviewAt === undefined ? (base.interviewAt ?? null) : edits.interviewAt,
    interviewType: edits.interviewType ?? base.interviewType ?? null,
    verified: true,
    applicationId: decision.kind === "attach" ? decision.applicationId : null,
  };
}

function outcomeMessage(r: IngestResult, label: string | null): string {
  const xp = r.xpAwarded > 0 ? ` +${r.xpAwarded} XP.` : "";
  switch (r.action) {
    case "created":
      return `Created ${label ?? "the application"}${r.statusApplied ? ` as ${STATUS_LABELS[r.statusApplied as ApplicationStatus] ?? r.statusApplied}` : ""}.${xp}`;
    case "updated":
      return `Attached to ${label ?? "the application"}${r.statusApplied ? `; stage now ${STATUS_LABELS[r.statusApplied as ApplicationStatus] ?? r.statusApplied}` : "; stage unchanged"}.${xp}`;
    case "duplicate":
      return `Already recorded on ${label ?? "an application"}.`;
    default:
      return r.reason;
  }
}

async function applicationLabel(userId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const a = await prisma.application.findFirst({ where: { id, userId }, select: { companyName: true, positionTitle: true } });
  return a ? `${a.companyName} – ${a.positionTitle}` : null;
}

async function assertAttachTarget(userId: string, decision: ParsedDecision): Promise<void> {
  if (decision.kind !== "attach") return;
  const a = await prisma.application.findFirst({ where: { id: decision.applicationId, userId }, select: { id: true } });
  if (!a) throw new ReviewError("NOT_FOUND", "That application no longer exists.");
}

function ensureApplied(r: IngestResult): void {
  if (r.action === "needs_review" || r.action === "ignored") throw new ReviewError("INVALID", r.reason);
}

/** Resolve a NEEDS_REVIEW email: create, attach, or "not an application". */
export async function resolveEmailReview(
  userId: string,
  emailId: string,
  decision: ParsedDecision,
  edits: ReviewEdits,
): Promise<ReviewOutcome> {
  const row = await prisma.emailMessage.findFirst({ where: { id: emailId, userId } });
  if (!row) throw new ReviewError("NOT_FOUND", "That email is no longer in your review queue.");
  if (row.reviewStatus !== "NEEDS_REVIEW") throw new ReviewError("INVALID", "That email was already reviewed.");
  const sourceRef = `${row.provider}:${row.externalId}`;

  if (decision.kind === "dismiss") {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.emailMessage.updateMany({
        where: { id: row.id, userId, reviewStatus: "NEEDS_REVIEW" },
        data: { reviewStatus: "DISMISSED" },
      });
      if (upd.count === 0) throw new ReviewError("INVALID", "That email was already reviewed.");
      // Evidence an earlier pass kept for this email (never attached) goes with it.
      await tx.evidence.deleteMany({ where: { userId, kind: "EMAIL", sourceRef, applicationId: null } });
    });
    await purgeReviewedBodies(userId);
    return { message: "Marked as not an application. Nothing was changed.", applicationId: null, xpAwarded: 0 };
  }

  await assertAttachTarget(userId, decision);
  const obs = applyEdits(emailObservation(row, edits.status), edits, decision);
  const extract = readExtract(row.extracted);
  const r = await prisma.$transaction(async (tx) => {
    const res = await ingestObservationInTx(tx, userId, obs, {
      forceCreate: decision.kind === "create",
      statusOverride: edits.status,
    });
    ensureApplied(res);
    const nextExtract = {
      ...extract,
      observation: serializeObservation(obs),
      ingest: {
        action: res.action,
        reason: res.reason,
        candidateIds: [],
        statusApplied: res.statusApplied,
        at: new Date().toISOString(),
      },
    };
    const upd = await tx.emailMessage.updateMany({
      where: { id: row.id, userId, reviewStatus: "NEEDS_REVIEW" },
      data: {
        reviewStatus: "CONFIRMED",
        applicationId: res.applicationId,
        extracted: JSON.parse(JSON.stringify(nextExtract)) as Prisma.InputJsonValue,
      },
    });
    if (upd.count === 0) throw new ReviewError("INVALID", "That email was already reviewed.");
    return res;
  }, TX_OPTIONS);
  await purgeReviewedBodies(userId);
  return { message: outcomeMessage(r, await applicationLabel(userId, r.applicationId)), applicationId: r.applicationId, xpAwarded: r.xpAwarded };
}

/** Resolve a PENDING_CONFIRMATION extension capture. */
export async function resolveCaptureReview(
  userId: string,
  captureId: string,
  decision: ParsedDecision,
  edits: ReviewEdits,
): Promise<ReviewOutcome> {
  const capture: ExtensionCapture | null = await prisma.extensionCapture.findFirst({ where: { id: captureId, userId } });
  if (!capture) throw new ReviewError("NOT_FOUND", "That capture is no longer in your review queue.");
  if (capture.status !== "PENDING_CONFIRMATION") throw new ReviewError("INVALID", "That capture was already reviewed.");
  const now = new Date();

  if (decision.kind === "dismiss") {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.extensionCapture.updateMany({
        where: { id: capture.id, userId, status: "PENDING_CONFIRMATION" },
        data: { status: "DISMISSED", resolvedAt: now },
      });
      if (upd.count === 0) throw new ReviewError("INVALID", "That capture was already reviewed.");
      await tx.evidence.deleteMany({
        where: { userId, kind: "EXTENSION_CAPTURE", sourceRef: `capture:${capture.id}`, applicationId: null },
      });
    });
    return { message: "Capture dismissed. Nothing was changed.", applicationId: null, xpAwarded: 0 };
  }

  await assertAttachTarget(userId, decision);
  const obs = applyEdits(observationFromCapture(capture, now), edits, decision);
  const r = await prisma.$transaction(async (tx) => {
    const res = await ingestObservationInTx(tx, userId, obs, {
      forceCreate: decision.kind === "create",
      statusOverride: edits.status,
    });
    ensureApplied(res);
    const upd = await tx.extensionCapture.updateMany({
      where: { id: capture.id, userId, status: "PENDING_CONFIRMATION" },
      data: { status: res.action === "duplicate" ? "DUPLICATE" : "ACCEPTED", applicationId: res.applicationId, resolvedAt: now },
    });
    if (upd.count === 0) throw new ReviewError("INVALID", "That capture was already reviewed.");
    return res;
  }, TX_OPTIONS);
  return { message: outcomeMessage(r, await applicationLabel(userId, r.applicationId)), applicationId: r.applicationId, xpAwarded: r.xpAwarded };
}

/**
 * "Add interview" for an interview invitation: schedules the interview on the email's application
 * (the user typed or confirmed the time) and marks the email reviewed. `skip` only marks it reviewed.
 */
export async function resolveInterviewInvite(
  userId: string,
  emailId: string,
  input: { decision: "add" | "skip"; scheduledAt?: Date; type: InterviewType },
): Promise<ReviewOutcome> {
  const row = await prisma.emailMessage.findFirst({
    where: { id: emailId, userId },
    select: { id: true, applicationId: true, reviewStatus: true },
  });
  if (!row) throw new ReviewError("NOT_FOUND", "That email no longer exists.");
  if (row.reviewStatus === "CONFIRMED" || row.reviewStatus === "DISMISSED") {
    throw new ReviewError("INVALID", "That invitation was already handled.");
  }
  if (!row.applicationId) throw new ReviewError("INVALID", "Attach this email to an application first.");
  let xpAwarded = 0;
  if (input.decision === "add") {
    if (!input.scheduledAt) throw new ReviewError("INVALID", "Pick the interview date and time.");
    const res = await scheduleInterview(userId, row.applicationId, {
      type: input.type,
      scheduledAt: input.scheduledAt,
      notes: "Added from an interview invitation email.",
    });
    xpAwarded = res.xpAwarded;
  }
  await prisma.emailMessage.updateMany({
    where: { id: row.id, userId, reviewStatus: { in: ["AUTO_ACCEPTED", "NEEDS_REVIEW"] } },
    data: { reviewStatus: "CONFIRMED" },
  });
  await purgeReviewedBodies(userId);
  const label = await applicationLabel(userId, row.applicationId);
  return {
    message: input.decision === "add" ? `Interview added to ${label ?? "the application"}.` : "Invitation marked as handled.",
    applicationId: row.applicationId,
    xpAwarded,
  };
}
