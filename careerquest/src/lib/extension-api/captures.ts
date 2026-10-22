import "server-only";
/**
 * POST /api/extension/captures — the server side of the Chrome extension.
 *
 * One request = one transaction (with the per-user ingestion lock, so concurrent deliveries of the
 * same capture cannot both pass the idempotency check):
 *   1. an explicit `applicationId` must be one of the user's applications (else 404, nothing stored);
 *   2. idempotency: the same (kind, normalizedUrl, confirmationText) within 24 h — or the same
 *      `evidence.captureId` (the extension reuses it for retries) within 7 days — returns the
 *      existing capture and application with action "duplicate";
 *   3. the capture row is stored with allow-listed fields only;
 *   4. per kind:
 *        JOB_PAGE            → JOB_SEEN observation (creates or matches a Saved record)
 *        APPLY_STARTED       → capture only (PENDING_CONFIRMATION); never a submission
 *        CONFIRMATION_PAGE   → ingested when confidence ≥ 0.8, else PENDING_CONFIRMATION
 *        MANUAL_CONFIRMATION → USER_CONFIRMED_SUBMISSION (the user asserted it)
 *      An ingest result of needs_review/ignored leaves the capture PENDING_CONFIRMATION so it shows
 *      in /applications/review/captures.
 */
import { prisma } from "@/lib/db";
import type { ApplicationStatus, CaptureStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { detectPlatform, normalizeUrl } from "@/lib/applications/normalize";
import {
  IngestNotFoundError,
  IngestValidationError,
  ingestObservationInTx,
  lockUserIngestion,
  observationFromCapture,
} from "@/lib/ingest/engine";
import type { IngestResult } from "@/lib/ingest/types";
import { applicationDetailUrl } from "./cors";
import { storedEvidence, type CaptureBody, type StoredCaptureEvidence } from "./schemas";

/** A confirmation page below this confidence is never recorded without the user's confirmation. */
export const AUTO_CONFIRM_MIN_CONFIDENCE = 0.8;
/**
 * "Save to CareerQuest" is an explicit click, so a job page is saved even when the extension was
 * unsure about the extraction; a Saved record never claims a submission and stays editable.
 */
export const USER_SAVE_MIN_CONFIDENCE = 0.8;
export const DUPLICATE_WINDOW_MS = 24 * 3600 * 1000;
export const DELIVERY_ID_WINDOW_MS = 7 * 24 * 3600 * 1000;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
const MAX_MERGE_HOPS = 5;

export type ApiCaptureStatus = "PENDING_CONFIRMATION" | "ACCEPTED" | "DUPLICATE";
export type ApiCaptureAction = "created" | "updated" | "duplicate" | "pending_confirmation";

export type ApiApplicationSummary = { id: string; status: ApplicationStatus; detailUrl: string };

export type CaptureResponseBody = {
  capture: { id: string; status: ApiCaptureStatus };
  application: ApiApplicationSummary | null;
  action: ApiCaptureAction;
};

export type CaptureOutcome =
  | { ok: true; body: CaptureResponseBody; ingest: IngestResult | null }
  | { ok: false; status: 400 | 404; error: string };

type Tx = Prisma.TransactionClient;

function apiStatus(status: CaptureStatus): ApiCaptureStatus {
  if (status === "ACCEPTED" || status === "DUPLICATE") return status;
  return "PENDING_CONFIRMATION";
}

/** Summary of an application for the response, following merges to the surviving record. */
async function applicationSummary(tx: Tx, userId: string, id: string | null, appBase: string): Promise<ApiApplicationSummary | null> {
  let current = id;
  for (let hop = 0; current && hop <= MAX_MERGE_HOPS; hop++) {
    const app = await tx.application.findFirst({
      where: { id: current, userId },
      select: { id: true, status: true, mergedIntoId: true },
    });
    if (!app) return null;
    if (!app.mergedIntoId) return { id: app.id, status: app.status, detailUrl: applicationDetailUrl(appBase, app.id) };
    current = app.mergedIntoId;
  }
  return null;
}

function evidenceOf(value: Prisma.JsonValue): Partial<StoredCaptureEvidence> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<StoredCaptureEvidence>) : {};
}

type DuplicateProbe = {
  userId: string;
  kind: CaptureBody["kind"];
  url: string;
  normalizedUrl: string | null;
  confirmationText: string;
  captureId: string | null;
  applicationId: string | null;
  now: Date;
};

/** An earlier, non-dismissed capture this request repeats, or null. */
async function findDuplicate(tx: Tx, p: DuplicateProbe) {
  const recent = await tx.extensionCapture.findMany({
    where: {
      userId: p.userId,
      ...(p.normalizedUrl ? { normalizedUrl: p.normalizedUrl } : { url: p.url }),
      createdAt: { gte: new Date(p.now.getTime() - DELIVERY_ID_WINDOW_MS) },
      status: { not: "DISMISSED" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, kind: true, status: true, applicationId: true, evidence: true, createdAt: true },
  });
  const contentSince = p.now.getTime() - DUPLICATE_WINDOW_MS;
  for (const row of recent) {
    const ev = evidenceOf(row.evidence);
    if (p.captureId && ev.captureId === p.captureId) return row;
    if (
      row.kind === p.kind &&
      row.createdAt.getTime() >= contentSince &&
      (ev.confirmationText ?? "") === p.confirmationText &&
      (p.applicationId === null || row.applicationId === p.applicationId)
    ) {
      return row;
    }
  }
  return null;
}

function mapIngest(r: IngestResult): { status: CaptureStatus; action: ApiCaptureAction; applicationId: string | null } {
  switch (r.action) {
    case "created":
    case "updated":
      return { status: "ACCEPTED", action: r.action, applicationId: r.applicationId };
    case "duplicate":
      return { status: "DUPLICATE", action: "duplicate", applicationId: r.applicationId };
    default:
      // needs_review / ignored: the user decides in /applications/review/captures.
      return { status: "PENDING_CONFIRMATION", action: "pending_confirmation", applicationId: null };
  }
}

/** Should this capture be ingested right away (vs. stored for the user's confirmation)? */
export function ingestsImmediately(kind: CaptureBody["kind"], confidence: number): boolean {
  if (kind === "APPLY_STARTED") return false;
  if (kind === "CONFIRMATION_PAGE") return confidence >= AUTO_CONFIRM_MIN_CONFIDENCE;
  return true;
}

export async function processCapture(
  ctx: { userId: string; tokenId: string | null; appBase: string; now?: Date },
  body: CaptureBody,
): Promise<CaptureOutcome> {
  const now = ctx.now ?? new Date();
  const { userId } = ctx;
  const normalizedUrl = normalizeUrl(body.url);
  const platform = !body.platform || body.platform === "OTHER" ? detectPlatform(body.url) : body.platform;
  const evidence = storedEvidence(body);
  const explicitId = body.applicationId ?? null;

  try {
    return await prisma.$transaction(async (tx): Promise<CaptureOutcome> => {
      await lockUserIngestion(tx, userId);
      if (explicitId) {
        const owned = await tx.application.findFirst({ where: { id: explicitId, userId }, select: { id: true } });
        if (!owned) return { ok: false, status: 404, error: "Application not found." };
      }

      const dup = await findDuplicate(tx, {
        userId,
        kind: body.kind,
        url: body.url,
        normalizedUrl,
        confirmationText: evidence.confirmationText ?? "",
        captureId: evidence.captureId ?? null,
        applicationId: explicitId,
        now,
      });
      if (dup) {
        return {
          ok: true,
          ingest: null,
          body: {
            capture: { id: dup.id, status: apiStatus(dup.status) },
            application: await applicationSummary(tx, userId, dup.applicationId, ctx.appBase),
            action: "duplicate",
          },
        };
      }

      const capture = await tx.extensionCapture.create({
        data: {
          userId,
          tokenId: ctx.tokenId,
          applicationId: explicitId,
          kind: body.kind,
          url: body.url,
          normalizedUrl,
          platform,
          company: body.company ?? null,
          title: body.title ?? null,
          location: body.location ?? null,
          salaryText: body.salaryText ?? null,
          requisitionId: body.requisitionId ?? null,
          confidence: body.confidence,
          evidence: evidence as unknown as Prisma.InputJsonValue,
          status: "PENDING_CONFIRMATION",
          createdAt: now,
        },
      });

      if (!ingestsImmediately(body.kind, body.confidence)) {
        return {
          ok: true,
          ingest: null,
          body: { capture: { id: capture.id, status: "PENDING_CONFIRMATION" }, application: null, action: "pending_confirmation" },
        };
      }

      const obs = observationFromCapture(capture, now);
      if (body.kind === "JOB_PAGE") obs.confidence = Math.max(obs.confidence, USER_SAVE_MIN_CONFIDENCE);
      if (body.kind === "MANUAL_CONFIRMATION") obs.confidence = 1;
      const result = await ingestObservationInTx(tx, userId, obs);
      const mapped = mapIngest(result);
      await tx.extensionCapture.update({
        where: { id: capture.id },
        data: {
          status: mapped.status,
          ...(mapped.applicationId ? { applicationId: mapped.applicationId } : {}),
          resolvedAt: mapped.status === "PENDING_CONFIRMATION" ? null : now,
        },
      });
      return {
        ok: true,
        ingest: result,
        body: {
          capture: { id: capture.id, status: apiStatus(mapped.status) },
          application: await applicationSummary(tx, userId, mapped.applicationId, ctx.appBase),
          action: mapped.action,
        },
      };
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof IngestNotFoundError) return { ok: false, status: 404, error: "Application not found." };
    if (err instanceof IngestValidationError) return { ok: false, status: 400, error: err.message };
    throw err;
  }
}
