import "server-only";
/**
 * Job leads: CRUD, de-duplication (against the user's leads and tracked applications by normalized
 * URL; no network fetch), eligibility flags, fit scores, and conversion into the tracker.
 *
 * Conversion never guesses silently:
 *   - "Convert to application" creates a Saved record (origin URL_IMPORT) unless the posting is
 *     already tracked (same normalized URL, or a sure match), in which case the lead is linked;
 *   - "I already applied" goes through the ingestion engine as USER_CONFIRMED_SUBMISSION, so an
 *     existing record (e.g. one imported from email) is updated rather than duplicated;
 *   - an uncertain match returns the candidates for the user to choose ("Same job" / "Create new").
 * Every query is scoped by userId.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationSource, ApplicationStatus, LeadStatus } from "@/generated/prisma/enums";
import { detectPlatform, normalizeCompany, normalizeTitle, normalizeUrl } from "@/lib/applications/normalize";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { STATUS_LABELS } from "@/lib/applications/status";
import { createApplicationInTx } from "@/lib/applications/service";
import { formatInTz } from "@/lib/applications/time";
import { applicationInputSchema } from "@/lib/validation/application";
import { IngestNotFoundError, IngestValidationError, ingestObservationInTx, lockUserIngestion } from "@/lib/ingest/engine";
import { findCandidateMatches } from "@/lib/ingest/match";
import { decideMatch } from "@/lib/ingest/match-score";
import { parseSalaryText } from "@/lib/ingest/rules";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";
import { detectEligibility, flagsOf, hiddenByFilters, type EligibilityFlag, type EligibilityFlags } from "./eligibility";
import { loadDiscoveryProfile, type DiscoveryProfile } from "./profile";
import { scoreLead, type LeadScore } from "./score";
import type { LeadInput } from "./schemas";

export const MAX_LEADS_PER_USER = 2000;
const LIST_LIMIT = 500;
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
const POSSIBLE_MATCH = 0.65;

export type LeadListView = "active" | "dismissed" | "converted";

export const LEAD_VIEW_STATUSES: Record<LeadListView, LeadStatus[]> = {
  active: ["NEW", "SAVED"],
  dismissed: ["DISMISSED"],
  converted: ["CONVERTED"],
};

export type LinkedApplication = { id: string; label: string; status: ApplicationStatus; statusLabel: string };

export type LeadView = {
  id: string;
  title: string;
  company: string;
  url: string | null;
  source: ApplicationSource;
  sourceLabel: string;
  location: string | null;
  salaryText: string | null;
  category: string | null;
  notes: string | null;
  status: LeadStatus;
  flags: EligibilityFlags;
  flagList: EligibilityFlag[];
  hiddenBy: EligibilityFlag[];
  score: LeadScore;
  convertedApplication: LinkedApplication | null;
  addedLabel: string;
};

export type LeadList = {
  view: LeadListView;
  items: LeadView[];
  /** Active leads hidden by the user's private eligibility filters (shown only on request). */
  hidden: LeadView[];
  counts: Record<LeadListView, number>;
};

const isHttp = (u: string | null): u is string => Boolean(u && /^https?:\/\//i.test(u));

const leadSelect = {
  id: true,
  title: true,
  company: true,
  url: true,
  source: true,
  location: true,
  salaryText: true,
  category: true,
  notes: true,
  status: true,
  requiresCompanyVehicle: true,
  requiresDrivingRecord: true,
  requiresCdl: true,
  convertedApplicationId: true,
  createdAt: true,
  updatedAt: true,
  convertedApplication: { select: { id: true, companyName: true, positionTitle: true, status: true, mergedIntoId: true } },
} satisfies Prisma.JobLeadSelect;

type LeadRow = Prisma.JobLeadGetPayload<{ select: typeof leadSelect }>;

function toView(row: LeadRow, profile: DiscoveryProfile): LeadView {
  const flags: EligibilityFlags = {
    requiresCompanyVehicle: row.requiresCompanyVehicle,
    requiresDrivingRecord: row.requiresDrivingRecord,
    requiresCdl: row.requiresCdl,
  };
  const app = row.convertedApplication;
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    url: isHttp(row.url) ? row.url : null,
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source],
    location: row.location,
    salaryText: row.salaryText,
    category: row.category,
    notes: row.notes,
    status: row.status,
    flags,
    flagList: flagsOf(flags),
    hiddenBy: hiddenByFilters(flags, profile),
    score: scoreLead({ ...flags, title: row.title, category: row.category, location: row.location, salaryText: row.salaryText }, profile),
    convertedApplication: app
      ? {
          id: app.mergedIntoId ?? app.id,
          label: `${app.companyName} – ${app.positionTitle}`,
          status: app.status,
          statusLabel: STATUS_LABELS[app.status],
        }
      : null,
    addedLabel: formatInTz(row.createdAt, profile.timezone, "date"),
  };
}

export async function listLeads(userId: string, view: LeadListView, profile?: DiscoveryProfile): Promise<LeadList> {
  const p = profile ?? (await loadDiscoveryProfile(userId));
  const [rows, grouped] = await Promise.all([
    prisma.jobLead.findMany({
      where: { userId, status: { in: LEAD_VIEW_STATUSES[view] } },
      select: leadSelect,
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    }),
    prisma.jobLead.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  const counts: Record<LeadListView, number> = {
    active: (byStatus.get("NEW") ?? 0) + (byStatus.get("SAVED") ?? 0),
    dismissed: byStatus.get("DISMISSED") ?? 0,
    converted: byStatus.get("CONVERTED") ?? 0,
  };
  const views = rows.map((r) => toView(r, p));
  if (view !== "active") return { view, items: views, hidden: [], counts };
  const visible = views.filter((v) => v.hiddenBy.length === 0);
  const hidden = views.filter((v) => v.hiddenBy.length > 0);
  const byScore = (a: LeadView, b: LeadView) => b.score.score - a.score.score;
  return { view, items: visible.sort(byScore), hidden: hidden.sort(byScore), counts };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export type LeadWriteResult =
  | { ok: true; leadId: string; message: string }
  | { ok: false; reason: "duplicate_lead"; message: string; leadId: string }
  | { ok: false; reason: "tracked"; message: string; applicationId: string }
  | { ok: false; reason: "not_found" | "limit"; message: string };

export type LeadWriteOptions = {
  /** Pasted posting text: scanned for eligibility keywords, never stored. */
  postingText?: string | null;
  /**
   * The form showed the detected flags as checkboxes the user could change: trust them as given.
   * Otherwise (no JavaScript) detected flags are added to the checked ones.
   */
  flagsReviewed?: boolean;
};

function resolveFlags(input: LeadInput, opts: LeadWriteOptions): EligibilityFlags {
  const chosen: EligibilityFlags = {
    requiresCompanyVehicle: input.requiresCompanyVehicle,
    requiresDrivingRecord: input.requiresDrivingRecord,
    requiresCdl: input.requiresCdl,
  };
  if (opts.flagsReviewed) return chosen;
  const detected = detectEligibility([input.title, input.notes, opts.postingText].filter(Boolean).join("\n")).flags;
  return {
    requiresCompanyVehicle: chosen.requiresCompanyVehicle || detected.requiresCompanyVehicle,
    requiresDrivingRecord: chosen.requiresDrivingRecord || detected.requiresDrivingRecord,
    requiresCdl: chosen.requiresCdl || detected.requiresCdl,
  };
}

async function findLeadDuplicate(userId: string, input: { title: string; company: string; normalizedUrl: string | null }, excludeId?: string) {
  if (input.normalizedUrl) {
    return prisma.jobLead.findFirst({
      where: { userId, normalizedUrl: input.normalizedUrl, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, title: true, company: true, status: true },
    });
  }
  // JobLead has no normalized company column; leads are capped per user, so compare in memory.
  const withoutUrl = await prisma.jobLead.findMany({
    where: { userId, normalizedUrl: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, title: true, company: true, status: true },
    take: MAX_LEADS_PER_USER,
  });
  const nc = normalizeCompany(input.company);
  const nt = normalizeTitle(input.title);
  return withoutUrl.find((l) => normalizeCompany(l.company) === nc && normalizeTitle(l.title) === nt) ?? null;
}

async function trackedByUrl(userId: string, normalizedUrl: string | null) {
  if (!normalizedUrl) return null;
  return prisma.application.findFirst({
    where: { userId, normalizedUrl, mergedIntoId: null },
    select: { id: true, companyName: true, positionTitle: true, status: true },
    orderBy: { createdAt: "asc" },
  });
}

const LEAD_STATUS_WORD: Record<LeadStatus, string> = { NEW: "new", SAVED: "kept", DISMISSED: "dismissed", CONVERTED: "converted" };

export async function createLead(userId: string, input: LeadInput, opts: LeadWriteOptions = {}): Promise<LeadWriteResult> {
  const normalizedUrl = input.url ? normalizeUrl(input.url) : null;
  const dupLead = await findLeadDuplicate(userId, { ...input, normalizedUrl });
  if (dupLead) {
    return {
      ok: false,
      reason: "duplicate_lead",
      leadId: dupLead.id,
      message: `Already a ${LEAD_STATUS_WORD[dupLead.status]} lead: ${dupLead.company} – ${dupLead.title}.`,
    };
  }
  const tracked = await trackedByUrl(userId, normalizedUrl);
  if (tracked) {
    return {
      ok: false,
      reason: "tracked",
      applicationId: tracked.id,
      message: `Already in your tracker: ${tracked.companyName} – ${tracked.positionTitle} (${STATUS_LABELS[tracked.status]}).`,
    };
  }
  if ((await prisma.jobLead.count({ where: { userId } })) >= MAX_LEADS_PER_USER) {
    return { ok: false, reason: "limit", message: `You have ${MAX_LEADS_PER_USER} leads. Delete old ones before adding more.` };
  }
  const profile = await loadDiscoveryProfile(userId);
  const flags = resolveFlags(input, opts);
  const score = scoreLead({ ...flags, title: input.title, category: input.category, location: input.location, salaryText: input.salaryText }, profile);
  const lead = await prisma.jobLead.create({
    data: {
      userId,
      title: input.title,
      company: input.company,
      url: input.url ?? null,
      normalizedUrl,
      source: input.url ? detectPlatform(input.url) : "OTHER",
      location: input.location ?? null,
      salaryText: input.salaryText ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
      ...flags,
      matchScore: score.score,
      status: "NEW",
    },
    select: { id: true },
  });
  return { ok: true, leadId: lead.id, message: `Lead saved: ${input.company} – ${input.title} (fit ${score.score}/100).` };
}

export async function updateLead(userId: string, leadId: string, input: LeadInput, opts: LeadWriteOptions = {}): Promise<LeadWriteResult> {
  const existing = await prisma.jobLead.findFirst({ where: { id: leadId, userId }, select: { id: true } });
  if (!existing) return { ok: false, reason: "not_found", message: "That lead no longer exists." };
  const normalizedUrl = input.url ? normalizeUrl(input.url) : null;
  const dup = await findLeadDuplicate(userId, { ...input, normalizedUrl }, leadId);
  if (dup) {
    return { ok: false, reason: "duplicate_lead", leadId: dup.id, message: `Another lead already has this posting: ${dup.company} – ${dup.title}.` };
  }
  const profile = await loadDiscoveryProfile(userId);
  const flags = resolveFlags(input, { ...opts, flagsReviewed: true });
  const score = scoreLead({ ...flags, title: input.title, category: input.category, location: input.location, salaryText: input.salaryText }, profile);
  await prisma.jobLead.updateMany({
    where: { id: leadId, userId },
    data: {
      title: input.title,
      company: input.company,
      url: input.url ?? null,
      normalizedUrl,
      source: input.url ? detectPlatform(input.url) : "OTHER",
      location: input.location ?? null,
      salaryText: input.salaryText ?? null,
      category: input.category ?? null,
      notes: input.notes ?? null,
      ...flags,
      matchScore: score.score,
    },
  });
  return { ok: true, leadId, message: "Lead updated." };
}

export async function setLeadStatus(userId: string, leadId: string, status: "NEW" | "SAVED" | "DISMISSED"): Promise<{ ok: boolean; message: string }> {
  const res = await prisma.jobLead.updateMany({ where: { id: leadId, userId, status: { not: "CONVERTED" } }, data: { status } });
  if (res.count === 0) return { ok: false, message: "That lead no longer exists or was already converted." };
  return { ok: true, message: status === "DISMISSED" ? "Lead dismissed." : status === "SAVED" ? "Lead kept." : "Lead restored." };
}

export async function deleteLead(userId: string, leadId: string): Promise<{ ok: boolean; message: string }> {
  const res = await prisma.jobLead.deleteMany({ where: { id: leadId, userId } });
  return res.count ? { ok: true, message: "Lead deleted." } : { ok: false, message: "That lead no longer exists." };
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export type CandidateChoice = {
  id: string;
  label: string;
  statusLabel: string;
  detail: string;
  score: number | null;
};

export type ConvertResult =
  | { ok: true; applicationId: string; message: string; xpAwarded: number }
  | { ok: false; reason: "choose"; message: string; candidates: CandidateChoice[] }
  | { ok: false; reason: "not_found" | "invalid"; message: string };

export type ConvertOptions = { mode: "saved" | "applied"; attachTo?: string; force?: boolean; now?: Date };

async function candidateChoices(userId: string, ids: string[], scores: Map<string, number>, timezone: string): Promise<CandidateChoice[]> {
  if (!ids.length) return [];
  const apps = await prisma.application.findMany({
    where: { userId, id: { in: ids }, mergedIntoId: null },
    select: { id: true, companyName: true, positionTitle: true, status: true, appliedAt: true, location: true, createdAt: true },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return apps
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((a) => ({
      id: a.id,
      label: `${a.companyName} – ${a.positionTitle}`,
      statusLabel: STATUS_LABELS[a.status],
      detail: [a.location, a.appliedAt ? `applied ${formatInTz(a.appliedAt, timezone, "date")}` : `added ${formatInTz(a.createdAt, timezone, "date")}`]
        .filter(Boolean)
        .join(" · "),
      score: scores.get(a.id) ?? null,
    }));
}

/** Message for an ingest result that touched a record. */
export function ingestMessage(r: IngestResult, label: string): string {
  const xp = r.xpAwarded > 0 ? ` +${r.xpAwarded} XP.` : "";
  if (r.action === "created") return `Added ${label} to your tracker${r.statusApplied ? ` as ${STATUS_LABELS[r.statusApplied as ApplicationStatus] ?? r.statusApplied}` : ""}.${xp}`;
  if (r.action === "duplicate") return `${label} already has this recorded.`;
  if (r.statusApplied) return `Updated ${label}: now ${STATUS_LABELS[r.statusApplied as ApplicationStatus] ?? r.statusApplied}.${xp}`;
  return `Linked to ${label}; its stage was not changed.${xp}`;
}

async function appLabel(userId: string, id: string): Promise<string> {
  const a = await prisma.application.findFirst({ where: { id, userId }, select: { companyName: true, positionTitle: true } });
  return a ? `${a.companyName} – ${a.positionTitle}` : "the application";
}

async function ownedActiveApplication(userId: string, id: string) {
  let current: string | null = id;
  for (let hop = 0; current && hop < 6; hop++) {
    const app: { id: string; mergedIntoId: string | null; companyName: string; positionTitle: string } | null = await prisma.application.findFirst({
      where: { id: current, userId },
      select: { id: true, mergedIntoId: true, companyName: true, positionTitle: true },
    });
    if (!app) return null;
    if (!app.mergedIntoId) return app;
    current = app.mergedIntoId;
  }
  return null;
}

export async function convertLead(userId: string, leadId: string, opts: ConvertOptions): Promise<ConvertResult> {
  const lead = await prisma.jobLead.findFirst({ where: { id: leadId, userId } });
  if (!lead) return { ok: false, reason: "not_found", message: "That lead no longer exists." };
  const profile = await loadDiscoveryProfile(userId);
  const now = opts.now ?? new Date();

  if (opts.attachTo) {
    const target = await ownedActiveApplication(userId, opts.attachTo);
    if (!target) return { ok: false, reason: "not_found", message: "That application no longer exists." };
    opts = { ...opts, attachTo: target.id };
  }

  if (opts.mode === "saved") return convertToSaved(userId, lead, profile, opts);
  return convertAsApplied(userId, lead, profile, opts, now);
}

type LeadRecord = NonNullable<Awaited<ReturnType<typeof prisma.jobLead.findFirst>>>;

async function linkLead(userId: string, leadId: string, applicationId: string) {
  await prisma.jobLead.updateMany({ where: { id: leadId, userId }, data: { status: "CONVERTED", convertedApplicationId: applicationId } });
}

async function convertToSaved(userId: string, lead: LeadRecord, profile: DiscoveryProfile, opts: ConvertOptions): Promise<ConvertResult> {
  if (lead.status === "CONVERTED" && lead.convertedApplicationId) {
    const existing = await ownedActiveApplication(userId, lead.convertedApplicationId);
    if (existing) return { ok: true, applicationId: existing.id, message: `Already converted: ${existing.companyName} – ${existing.positionTitle}.`, xpAwarded: 0 };
  }
  if (opts.attachTo) {
    await linkLead(userId, lead.id, opts.attachTo);
    return { ok: true, applicationId: opts.attachTo, message: `Linked the lead to ${await appLabel(userId, opts.attachTo)}.`, xpAwarded: 0 };
  }
  const byUrl = await trackedByUrl(userId, lead.normalizedUrl);
  if (byUrl) {
    await linkLead(userId, lead.id, byUrl.id);
    return { ok: true, applicationId: byUrl.id, message: `Already in your tracker as ${byUrl.companyName} – ${byUrl.positionTitle}; the lead is now linked to it.`, xpAwarded: 0 };
  }
  if (!opts.force) {
    const candidates = await findCandidateMatches(
      prisma,
      userId,
      { company: lead.company, title: lead.title, location: lead.location, postingUrl: lead.url, platform: lead.source, observedAt: new Date() },
      { limit: 3, minScore: POSSIBLE_MATCH },
    );
    const decision = decideMatch(candidates);
    if (decision.outcome === "match") {
      await linkLead(userId, lead.id, decision.applicationId);
      return { ok: true, applicationId: decision.applicationId, message: `Already in your tracker as ${await appLabel(userId, decision.applicationId)}; the lead is now linked to it.`, xpAwarded: 0 };
    }
    if (decision.outcome === "review") {
      const scores = new Map(candidates.map((c) => [c.applicationId, c.score]));
      return {
        ok: false,
        reason: "choose",
        message: "This might already be in your tracker. Pick the same job, or create a new record.",
        candidates: await candidateChoices(userId, decision.candidateIds, scores, profile.timezone),
      };
    }
  }
  const salary = parseSalaryText(lead.salaryText);
  const parsed = applicationInputSchema.safeParse({
    companyName: lead.company,
    positionTitle: lead.title,
    postingUrl: isHttp(lead.url) ? lead.url : undefined,
    source: lead.source,
    location: lead.location ?? undefined,
    jobCategory: lead.category ?? undefined,
    salaryMin: salary?.min,
    salaryMax: salary?.max ?? undefined,
    salaryPeriod: salary?.period,
    status: "SAVED",
    requiresCompanyVehicle: lead.requiresCompanyVehicle,
    requiresDrivingRecord: lead.requiresDrivingRecord,
    requiresCdl: lead.requiresCdl,
    notes: lead.notes ?? undefined,
  });
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "The lead has invalid fields; edit it first." };
  const created = await prisma.$transaction(async (tx) => {
    await lockUserIngestion(tx, userId);
    const res = await createApplicationInTx(tx, userId, parsed.data, "URL_IMPORT");
    await tx.jobLead.updateMany({ where: { id: lead.id, userId }, data: { status: "CONVERTED", convertedApplicationId: res.application.id } });
    return res;
  }, TX_OPTIONS);
  const xp = created.xpAwarded > 0 ? ` +${created.xpAwarded} XP.` : "";
  return {
    ok: true,
    applicationId: created.application.id,
    message: `Added ${lead.company} – ${lead.title} to your tracker as Saved (not applied yet).${xp}`,
    xpAwarded: created.xpAwarded,
  };
}

async function convertAsApplied(userId: string, lead: LeadRecord, profile: DiscoveryProfile, opts: ConvertOptions, now: Date): Promise<ConvertResult> {
  let explicit = opts.attachTo ?? null;
  if (!explicit && lead.convertedApplicationId) {
    explicit = (await ownedActiveApplication(userId, lead.convertedApplicationId))?.id ?? null;
  }
  const obs: ApplicationObservation = {
    kind: "USER_CONFIRMED_SUBMISSION",
    source: "IMPORT",
    origin: "URL_IMPORT",
    observedAt: now,
    company: lead.company,
    title: lead.title,
    location: lead.location,
    postingUrl: isHttp(lead.url) ? lead.url : null,
    platform: lead.source,
    salaryText: lead.salaryText,
    confidence: 1,
    verified: true,
    evidence: {
      kind: "MANUAL_NOTE",
      sourceRef: `lead:${lead.id}:applied`,
      title: "You confirmed you applied (Job Discovery)",
      snippet: null,
      data: { leadId: lead.id, via: "discovery" },
    },
    applicationId: explicit,
  };
  let r: IngestResult;
  try {
    r = await prisma.$transaction(async (tx) => {
      const res = await ingestObservationInTx(tx, userId, obs, { forceCreate: Boolean(opts.force) && !explicit });
      if ((res.action === "created" || res.action === "updated" || res.action === "duplicate") && res.applicationId) {
        await tx.jobLead.updateMany({ where: { id: lead.id, userId }, data: { status: "CONVERTED", convertedApplicationId: res.applicationId } });
      }
      return res;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof IngestNotFoundError) return { ok: false, reason: "not_found", message: "That application no longer exists." };
    if (err instanceof IngestValidationError) return { ok: false, reason: "invalid", message: err.message };
    throw err;
  }
  if (r.action === "needs_review") {
    return {
      ok: false,
      reason: "choose",
      message: "This might already be in your tracker. Pick the same job, or create a new record.",
      candidates: await candidateChoices(userId, r.candidateIds, new Map(), profile.timezone),
    };
  }
  if (!r.applicationId || r.action === "ignored") return { ok: false, reason: "invalid", message: r.reason };
  return { ok: true, applicationId: r.applicationId, message: ingestMessage(r, await appLabel(userId, r.applicationId)), xpAwarded: r.xpAwarded };
}
