import "server-only";
/**
 * Mobile capture (/share — the PWA share target and the paste box): what is already tracked for a
 * shared posting, and the three one-tap decisions:
 *   lead    → a Job Discovery lead (nothing in the tracker)
 *   track   → JOB_SEEN observation: a Saved record ("not applied yet") or a match
 *   applied → USER_CONFIRMED_SUBMISSION: the user says they applied
 * Both tracker paths go through the ingestion engine (origin MOBILE), so an existing record is
 * matched instead of duplicated; an uncertain match returns candidates for the user to pick.
 */
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { normalizeCompany, normalizeTitle, normalizeUrl, detectPlatform } from "@/lib/applications/normalize";
import { STATUS_LABELS } from "@/lib/applications/status";
import { formatInTz } from "@/lib/applications/time";
import { IngestNotFoundError, IngestValidationError, ingestObservationInTx } from "@/lib/ingest/engine";
import { findCandidateMatches } from "@/lib/ingest/match";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { createLead, ingestMessage, type CandidateChoice } from "./leads";
import { loadDiscoveryProfile } from "./profile";
import type { LeadDraft } from "./paste";
import type { ShareDecisionInput } from "./schemas";

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
export const SHARE_MATCH_MIN_SCORE = 0.65;

export type ShareMatch = {
  id: string;
  label: string;
  status: ApplicationStatus;
  statusLabel: string;
  detail: string;
};

export type ShareContext = {
  matches: ShareMatch[];
  lead: { id: string; label: string; status: string } | null;
};

/** Tracked applications (score ≥ 0.65, top 3) and an existing lead for the shared posting. */
export async function loadShareContext(userId: string, draft: LeadDraft, now: Date = new Date()): Promise<ShareContext> {
  if (!draft.url && !draft.company) return { matches: [], lead: null };
  const { timezone } = await loadDiscoveryProfile(userId);
  const [candidates, lead] = await Promise.all([
    findCandidateMatches(
      prisma,
      userId,
      {
        postingUrl: draft.url,
        company: draft.company,
        title: draft.title,
        location: draft.location,
        platform: draft.url ? draft.platform : null,
        observedAt: now,
      },
      { limit: 3, minScore: SHARE_MATCH_MIN_SCORE },
    ),
    draft.normalizedUrl
      ? prisma.jobLead.findFirst({ where: { userId, normalizedUrl: draft.normalizedUrl }, select: { id: true, company: true, title: true, status: true } })
      : Promise.resolve(null),
  ]);
  return {
    matches: candidates.map((c) => ({
      id: c.applicationId,
      label: `${c.application.companyName} – ${c.application.positionTitle}`,
      status: c.application.status,
      statusLabel: STATUS_LABELS[c.application.status],
      detail: c.application.appliedAt
        ? `Applied ${formatInTz(c.application.appliedAt, timezone, "date")}`
        : `Added ${formatInTz(c.application.createdAt, timezone, "date")}`,
    })),
    lead: lead ? { id: lead.id, label: `${lead.company} – ${lead.title}`, status: lead.status } : null,
  };
}

export type ShareResult =
  | { ok: true; message: string; href: string; applicationId: string | null }
  | { ok: false; reason: "choose"; message: string; candidates: CandidateChoice[] }
  | { ok: false; reason: "fields"; message: string; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: "invalid" | "not_found" | "duplicate"; message: string; href?: string };

function evidenceKey(input: ShareDecisionInput): string {
  const normalized = input.url ? normalizeUrl(input.url) : null;
  if (normalized) return normalized;
  if (!input.company && !input.title && input.attachTo) return `app:${input.attachTo}`;
  return `job:${sha256(`${normalizeCompany(input.company ?? "")}|${normalizeTitle(input.title ?? "")}`).slice(0, 40)}`;
}

function requireJob(input: ShareDecisionInput): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  if (!input.company) errors.company = ["Company is required"];
  if (!input.title) errors.title = ["Job title is required"];
  return Object.keys(errors).length ? errors : null;
}

export async function shareDecision(userId: string, input: ShareDecisionInput, now: Date = new Date()): Promise<ShareResult> {
  // Attaching to a record the user picked needs no company/title; everything else does.
  const missing = input.attachTo && input.decision !== "lead" ? null : requireJob(input);
  if (missing) return { ok: false, reason: "fields", message: "Add the company and job title first.", fieldErrors: missing };

  if (input.decision === "lead") {
    const res = await createLead(
      userId,
      {
        title: input.title!,
        company: input.company!,
        url: input.url,
        location: input.location,
        salaryText: input.salaryText,
        category: undefined,
        notes: undefined,
        requiresCompanyVehicle: false,
        requiresDrivingRecord: false,
        requiresCdl: false,
      },
      { postingText: input.sharedText ?? null, flagsReviewed: false },
    );
    if (res.ok) return { ok: true, message: res.message, href: "/discovery", applicationId: null };
    if (res.reason === "tracked") return { ok: false, reason: "duplicate", message: res.message, href: `/applications/${res.applicationId}` };
    if (res.reason === "duplicate_lead") return { ok: false, reason: "duplicate", message: res.message, href: "/discovery" };
    return { ok: false, reason: "invalid", message: res.message };
  }

  const applied = input.decision === "applied";
  const key = evidenceKey(input);
  const obs: ApplicationObservation = {
    kind: applied ? "USER_CONFIRMED_SUBMISSION" : "JOB_SEEN",
    source: "IMPORT",
    origin: "MOBILE",
    observedAt: now,
    company: input.company,
    title: input.title,
    location: input.location ?? null,
    postingUrl: input.url ?? null,
    platform: input.url ? detectPlatform(input.url) : null,
    salaryText: input.salaryText ?? null,
    // The user chose this button; a Saved record is never a claim of submission.
    confidence: applied ? 1 : 0.9,
    verified: applied,
    evidence: {
      kind: applied ? "MANUAL_NOTE" : "URL",
      sourceRef: `share:${applied ? "applied" : "seen"}:${key}`,
      title: applied ? "You confirmed you applied (shared from your phone)" : "Saved from your phone",
      snippet: null,
      data: { via: "share" },
    },
    applicationId: input.attachTo ?? null,
  };

  let r: IngestResult;
  try {
    r = await prisma.$transaction(async (tx) => {
      const res = await ingestObservationInTx(tx, userId, obs, { forceCreate: Boolean(input.force) && !input.attachTo });
      const normalized = input.url ? normalizeUrl(input.url) : null;
      if (res.applicationId && normalized && (res.action === "created" || res.action === "updated" || res.action === "duplicate")) {
        // A lead for the same posting is now tracked.
        await tx.jobLead.updateMany({
          where: { userId, normalizedUrl: normalized, status: { not: "CONVERTED" } },
          data: { status: "CONVERTED", convertedApplicationId: res.applicationId },
        });
      }
      return res;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof IngestNotFoundError) return { ok: false, reason: "not_found", message: "That application no longer exists." };
    if (err instanceof IngestValidationError) return { ok: false, reason: "invalid", message: err.message };
    throw err;
  }

  if (r.action === "needs_review") {
    const { timezone } = await loadDiscoveryProfile(userId);
    const apps = r.candidateIds.length
      ? await prisma.application.findMany({
          where: { userId, id: { in: r.candidateIds }, mergedIntoId: null },
          select: { id: true, companyName: true, positionTitle: true, status: true, appliedAt: true, createdAt: true, location: true },
        })
      : [];
    return {
      ok: false,
      reason: "choose",
      message: "This might already be in your tracker. Pick the same job, or create a new record.",
      candidates: apps.map((a) => ({
        id: a.id,
        label: `${a.companyName} – ${a.positionTitle}`,
        statusLabel: STATUS_LABELS[a.status],
        detail: [a.location, a.appliedAt ? `applied ${formatInTz(a.appliedAt, timezone, "date")}` : `added ${formatInTz(a.createdAt, timezone, "date")}`]
          .filter(Boolean)
          .join(" · "),
        score: null,
      })),
    };
  }
  if (!r.applicationId || r.action === "ignored") return { ok: false, reason: "invalid", message: r.reason };
  const app = await prisma.application.findFirst({ where: { id: r.applicationId, userId }, select: { companyName: true, positionTitle: true } });
  const label = app ? `${app.companyName} – ${app.positionTitle}` : "the application";
  return { ok: true, message: ingestMessage(r, label), href: `/applications/${r.applicationId}`, applicationId: r.applicationId };
}
