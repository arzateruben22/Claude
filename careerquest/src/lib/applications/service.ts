import "server-only";
import { prisma } from "@/lib/db";
import type {
  Application,
  ApplicationSourceLink,
  Interview,
  Prisma,
} from "@/generated/prisma/client";
import {
  ApplicationStatus,
  type ApplicationSource,
  type EmploymentType,
  type EventSource,
  type InterviewOutcome,
  type InterviewType,
  type RecordOrigin,
  type SalaryPeriod,
} from "@/generated/prisma/enums";
import { dateKey, todayInTz } from "@/lib/dates";
import type { ApplicationInput } from "@/lib/validation/application";
import { evaluateAchievements } from "@/lib/game/achievements";
import {
  detectPlatform,
  extractRequisitionId,
  normalizeCompany,
  normalizeTitle,
  normalizeUrl,
} from "./normalize";
import {
  STATUS_LABELS,
  canApplyInferredStatus,
  countsAsSubmission,
  impliesEmployerResponse,
  impliesSubmission,
  statusRank,
} from "./status";
import { awardXpOnce, recordEventOnce } from "./events";
import { revokeXpForSource } from "@/lib/game/xp";
import { dayRangeInTz, type ListFilters } from "./query";
import { INTERVIEW_OUTCOME_LABELS, INTERVIEW_TYPE_LABELS } from "./labels";
import { formatInTz } from "./time";
import {
  attributionForOrigin,
  type CreateAttributionOptions,
} from "./origin";

export {
  ORIGIN_EVENT_SOURCE,
  attributionForOrigin,
  type CreateAttributionOptions,
} from "./origin";

/**
 * Application tracker service. Every function is scoped by `userId`; status changes only happen
 * through `changeStatus` / `changeStatusInTx` so that history, events, XP and daily activity stay
 * consistent. Dates passed in are instants (the action layer converts form input using the
 * profile timezone).
 *
 * The `*InTx` functions take the caller's interactive transaction (`prisma.$transaction(async (tx)
 * => …)`) so the ingestion engine can compose matching, record creation, status changes, evidence
 * and source links atomically. The non-tx functions open their own transaction and delegate.
 */

export class ApplicationNotFoundError extends Error {
  constructor(message = "Application not found.") {
    super(message);
    this.name = "ApplicationNotFoundError";
  }
}

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/** The interactive-transaction client every `*InTx` function accepts. */
export type ServiceTx = Prisma.TransactionClient;
type Tx = ServiceTx;

type Ctx = { userId: string; timezone: string };

export async function userTimezone(userId: string): Promise<string> {
  return timezoneVia(prisma, userId);
}

async function timezoneVia(
  db: Pick<Tx, "userProfile">,
  userId: string,
): Promise<string> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone || DEFAULT_TIMEZONE;
}

/** Context read through the given client, so it sees the caller's uncommitted writes. */
async function ctxVia(db: Pick<Tx, "userProfile">, userId: string): Promise<Ctx> {
  return { userId, timezone: await timezoneVia(db, userId) };
}

async function ctxFor(userId: string): Promise<Ctx> {
  return ctxVia(prisma, userId);
}

// ---------------------------------------------------------------------------
// Derived fields
// ---------------------------------------------------------------------------

function deriveFields(input: ApplicationInput) {
  const postingUrl = input.postingUrl ?? null;
  const source: ApplicationSource =
    input.source === "OTHER" && postingUrl
      ? detectPlatform(postingUrl)
      : input.source;
  return {
    normalizedCompany: normalizeCompany(input.companyName),
    normalizedTitle: normalizeTitle(input.positionTitle),
    normalizedUrl: normalizeUrl(postingUrl),
    requisitionNumber:
      input.requisitionNumber ??
      extractRequisitionId(postingUrl) ??
      extractRequisitionId(input.positionTitle) ??
      extractRequisitionId(input.jobDescription) ??
      null,
    source,
  };
}

async function upsertEmployer(
  tx: Tx,
  userId: string,
  name: string,
  normalizedName: string,
): Promise<string> {
  const employer = await tx.employer.upsert({
    where: { userId_normalizedName: { userId, normalizedName } },
    create: { userId, name: name.trim(), normalizedName },
    update: {},
    select: { id: true },
  });
  return employer.id;
}

/** Create/update/unlink the recruiter contact for an application. Contacts are never deleted here. */
async function syncRecruiter(
  tx: Tx,
  userId: string,
  existingId: string | null,
  input: Pick<ApplicationInput, "recruiterName" | "recruiterEmail" | "companyName">,
): Promise<string | null> {
  const name = input.recruiterName;
  const email = input.recruiterEmail;
  if (!name && !email) return null;
  if (existingId) {
    const existing = await tx.contact.findFirst({
      where: { id: existingId, userId },
      select: { id: true, name: true },
    });
    if (existing) {
      await tx.contact.update({
        where: { id: existing.id },
        data: {
          name: name ?? existing.name,
          email: email ?? null,
          company: input.companyName,
        },
      });
      return existing.id;
    }
  }
  const created = await tx.contact.create({
    data: {
      userId,
      name: name ?? email!,
      email: email ?? null,
      company: input.companyName,
    },
    select: { id: true },
  });
  return created.id;
}

/** Only link documents the user actually owns; anything else is silently dropped. */
async function ownedDocumentIds(
  tx: Tx,
  userId: string,
  input: ApplicationInput,
) {
  const [resume, cover] = await Promise.all([
    input.resumeVersionId
      ? tx.resumeVersion.findFirst({
          where: { id: input.resumeVersionId, userId },
          select: { id: true },
        })
      : null,
    input.coverLetterVersionId
      ? tx.coverLetterVersion.findFirst({
          where: { id: input.coverLetterVersionId, userId },
          select: { id: true },
        })
      : null,
  ]);
  return {
    resumeVersionId: resume?.id ?? null,
    coverLetterVersionId: cover?.id ?? null,
  };
}

function editableData(
  input: ApplicationInput,
  derived: ReturnType<typeof deriveFields>,
) {
  return {
    companyName: input.companyName,
    normalizedCompany: derived.normalizedCompany,
    positionTitle: input.positionTitle,
    normalizedTitle: derived.normalizedTitle,
    jobCategory: input.jobCategory ?? null,
    jobDescription: input.jobDescription ?? null,
    postingUrl: input.postingUrl ?? null,
    normalizedUrl: derived.normalizedUrl,
    requisitionNumber: derived.requisitionNumber,
    source: derived.source,
    submissionDestination: input.submissionDestination ?? null,
    location: input.location ?? null,
    remote: input.remote,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    salaryPeriod: input.salaryPeriod ?? null,
    employmentType: input.employmentType,
    followUpAt: input.followUpAt ?? null,
    isQualified: input.isQualified,
    requiresCompanyVehicle: input.requiresCompanyVehicle,
    requiresDrivingRecord: input.requiresDrivingRecord,
    requiresCdl: input.requiresCdl,
    notes: input.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Status milestones (shared by create + changeStatus)
// ---------------------------------------------------------------------------

type MilestoneArgs = {
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  status: ApplicationStatus;
  /** The status-history row this transition wrote (keys the STATUS_CHANGED event). */
  historyId: string;
  occurredAt: Date;
  activityDate: Date;
  /** Record the APPLIED milestone (see `countsAsSubmission`). */
  submission: boolean;
  /** When the application was sent; the APPLIED event is dated by it. */
  appliedAt: Date | null;
  source: EventSource;
  verified: boolean;
  note: string | null;
  evidenceId?: string | null;
  /** When an Interview row triggers the change, its own event replaces the generic milestone. */
  skipInterviewMilestone?: boolean;
  /** Extra STATUS_CHANGED payload fields. */
  payload?: Record<string, unknown>;
};

/**
 * Record the events implied by reaching `status`. Milestone keys are stable per application so
 * moving back and forth through the pipeline never records (or awards) a milestone twice; the
 * STATUS_CHANGED event is keyed by its history row, so every transition keeps its own event.
 */
async function recordStatusMilestones(
  tx: Tx,
  ctx: Ctx,
  a: MilestoneArgs,
): Promise<number> {
  const id = a.applicationId;
  let xp = 0;
  const rec = async (
    type: Parameters<typeof recordEventOnce>[1]["type"],
    dedupeKey: string,
    opts: { payload?: Record<string, unknown>; occurredAt?: Date; activityDate?: Date } = {},
  ) => {
    const r = await recordEventOnce(tx, {
      userId: ctx.userId,
      applicationId: id,
      type,
      source: a.source,
      verified: a.verified,
      occurredAt: opts.occurredAt ?? a.occurredAt,
      activityDate: opts.activityDate ?? a.activityDate,
      dedupeKey,
      payload: opts.payload,
      evidenceId: a.evidenceId ?? null,
    });
    xp += r.xpAwarded;
    return r;
  };
  const s = a.status;
  if (a.submission) {
    const appliedOn = a.appliedAt ?? a.occurredAt;
    await rec("APPLIED", `${id}:APPLIED`, {
      occurredAt: appliedOn,
      activityDate: todayInTz(ctx.timezone, appliedOn),
    });
  }
  if (s === "CONFIRMED")
    await rec("CONFIRMATION_RECEIVED", `${id}:CONFIRMATION_RECEIVED`);
  if (impliesEmployerResponse(s))
    await rec("RECRUITER_RESPONSE", `${id}:RECRUITER_RESPONSE`);
  if (s === "INTERVIEWING" && !a.skipInterviewMilestone)
    await rec("INTERVIEW_SCHEDULED", `${id}:INTERVIEW_SCHEDULED`);
  if (s === "OFFER" || s === "ACCEPTED" || s === "HIRED") {
    const key = `${id}:OFFER_RECEIVED`;
    const r = await rec("OFFER_RECEIVED", key);
    if (!r.created && a.verified) xp += await upgradeOfferMilestone(tx, ctx, a, key);
  }
  if (s === "ACCEPTED" || s === "HIRED")
    await rec("OFFER_ACCEPTED", `${id}:OFFER_ACCEPTED`);
  if (s === "REJECTED") await rec("REJECTED", `${id}:REJECTED`);
  if (s === "WITHDRAWN") await rec("WITHDRAWN", `${id}:WITHDRAWN`);
  await rec("STATUS_CHANGED", `${id}:status:${a.historyId}`, {
    payload: { from: a.fromStatus, to: s, note: a.note, ...a.payload },
  });
  return xp;
}

/**
 * An offer first seen unverified (inferred from an email/capture) is upgraded when a verified
 * source (the user, or evidence-backed data) confirms it: the existing milestone is marked
 * verified and the verified-offer XP is paid once (same key the event contract uses).
 */
async function upgradeOfferMilestone(
  tx: Tx,
  ctx: Ctx,
  a: MilestoneArgs,
  dedupeKey: string,
): Promise<number> {
  const existing = await tx.applicationEvent.findUnique({
    where: { userId_dedupeKey: { userId: ctx.userId, dedupeKey } },
    select: { id: true, verified: true, evidenceId: true },
  });
  if (!existing || existing.verified) return 0;
  await tx.applicationEvent.update({
    where: { id: existing.id },
    data: {
      verified: true,
      evidenceId: existing.evidenceId ?? a.evidenceId ?? null,
    },
  });
  const award = await awardXpOnce(tx, {
    userId: ctx.userId,
    reason: "JOB_OFFER_VERIFIED",
    dedupeKey: `xp:${a.applicationId}:JOB_OFFER_VERIFIED`,
    sourceType: "Application",
    sourceId: a.applicationId,
    activityDate: a.activityDate,
  });
  if (!award.awarded) return 0;
  await evaluateAchievements(tx, ctx.userId);
  return award.amount;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export type CreateApplicationResult = {
  application: Application;
  xpAwarded: number;
};

/** Attribution options for `createApplication(InTx)`; see `attributionForOrigin`. */
export type CreateApplicationOptions = CreateAttributionOptions;

/**
 * Create a record inside the caller's transaction.
 *
 * - Attribution comes from `origin` (EMAIL → EMAIL, EXTENSION → EXTENSION, CSV/URL import →
 *   IMPORT, PLATFORM_API → PLATFORM_API, MANUAL/MOBILE → USER, SYSTEM → SYSTEM) unless
 *   `opts.source` overrides it; `verified` defaults to `source === "USER"`. Machine-created
 *   records are therefore never stamped as user-confirmed.
 * - A submission (application date, APPLIED event, XP, daily count) is recorded only when the
 *   status implies one, or for WITHDRAWN/CLOSED when an application date is given. Records that
 *   were never applied keep `appliedAt = null`.
 */
export async function createApplicationInTx(
  tx: ServiceTx,
  userId: string,
  input: ApplicationInput,
  origin: RecordOrigin,
  opts: CreateApplicationOptions = {},
): Promise<CreateApplicationResult> {
  const ctx = await ctxVia(tx, userId);
  const { source, verified, evidenceId } = attributionForOrigin(origin, opts);
  const derived = deriveFields(input);
  const now = new Date();
  const submission = countsAsSubmission({
    from: null,
    to: input.status,
    appliedAt: input.appliedAt ?? null,
  });
  const appliedAt = submission ? (input.appliedAt ?? now) : null;
  const occurredAt = appliedAt ?? now;
  const activityDate = todayInTz(ctx.timezone, occurredAt);

  const employerId = await upsertEmployer(
    tx,
    userId,
    input.companyName,
    derived.normalizedCompany,
  );
  const recruiterContactId = await syncRecruiter(tx, userId, null, input);
  const docs = await ownedDocumentIds(tx, userId, input);
  const application = await tx.application.create({
    data: {
      userId,
      employerId,
      recruiterContactId,
      ...docs,
      ...editableData(input, derived),
      appliedAt,
      status: input.status,
      statusUpdatedAt: occurredAt,
      statusVerified: verified,
      createdVia: origin,
    },
  });
  const history = await tx.applicationStatusHistory.create({
    data: {
      applicationId: application.id,
      fromStatus: null,
      toStatus: application.status,
      occurredAt,
      source,
      verified,
      evidenceId,
    },
    select: { id: true },
  });
  const saved = await recordEventOnce(tx, {
    userId,
    applicationId: application.id,
    type: "SAVED",
    source,
    verified,
    occurredAt,
    activityDate,
    dedupeKey: `${application.id}:SAVED`,
    evidenceId,
    payload: { origin },
  });
  const xpAwarded =
    saved.xpAwarded +
    (await recordStatusMilestones(tx, ctx, {
      applicationId: application.id,
      fromStatus: null,
      status: application.status,
      historyId: history.id,
      occurredAt,
      activityDate,
      submission,
      appliedAt,
      source,
      verified,
      note: null,
      evidenceId,
    }));
  return { application, xpAwarded };
}

export async function createApplication(
  userId: string,
  input: ApplicationInput,
  origin: RecordOrigin = "MANUAL",
  opts: CreateApplicationOptions = {},
): Promise<CreateApplicationResult> {
  return prisma.$transaction((tx) =>
    createApplicationInTx(tx, userId, input, origin, opts),
  );
}

/**
 * Update editable fields (re-normalising). Never touches status: use `changeStatus`.
 * The application date is only editable on a record that was applied; a blank date keeps the
 * existing one (clearing it would silently un-count a real application), and a date typed onto
 * a never-applied record is ignored (moving it to Submitted is what records the application).
 */
export async function updateApplication(
  userId: string,
  id: string,
  input: ApplicationInput,
): Promise<Application> {
  const derived = deriveFields(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { id, userId },
      select: {
        id: true,
        recruiterContactId: true,
        status: true,
        appliedAt: true,
        events: { where: { type: "APPLIED" }, select: { id: true }, take: 1 },
      },
    });
    if (!existing) throw new ApplicationNotFoundError();
    const applied =
      existing.appliedAt !== null ||
      existing.events.length > 0 ||
      impliesSubmission(existing.status);
    const employerId = await upsertEmployer(
      tx,
      userId,
      input.companyName,
      derived.normalizedCompany,
    );
    const recruiterContactId = await syncRecruiter(
      tx,
      userId,
      existing.recruiterContactId,
      input,
    );
    const docs = await ownedDocumentIds(tx, userId, input);
    return tx.application.update({
      where: { id, userId },
      data: {
        employerId,
        recruiterContactId,
        ...docs,
        ...editableData(input, derived),
        appliedAt: applied ? (input.appliedAt ?? existing.appliedAt) : null,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Ingestion helpers (source links, filling empty fields)
// ---------------------------------------------------------------------------

export type SourceLinkInput = {
  platform: ApplicationSource;
  url?: string | null;
  externalId?: string | null;
  origin: RecordOrigin;
};

export type AddSourceLinkResult = {
  /** False when the same platform + normalized URL (or external id) was already linked. */
  created: boolean;
  link: ApplicationSourceLink;
};

/**
 * Remember that a record was seen on a platform/URL. Idempotent: an existing link for the same
 * platform with the same normalized URL (or the same external id) is reused, and only its empty
 * url / externalId are filled in. A link with neither URL nor id is a no-op when the platform is
 * already linked.
 */
export async function addSourceLinkInTx(
  tx: ServiceTx,
  userId: string,
  applicationId: string,
  input: SourceLinkInput,
): Promise<AddSourceLinkResult> {
  const app = await tx.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!app) throw new ApplicationNotFoundError();
  const url = cleanText(input.url, 2048);
  const httpUrl = url && /^https?:\/\//i.test(url) ? url : null;
  const normalized = normalizeUrl(httpUrl);
  const externalId = cleanText(input.externalId, 200);

  const existing = await tx.applicationSourceLink.findMany({
    where: { applicationId, platform: input.platform },
    orderBy: { createdAt: "asc" },
  });
  const match = existing.find((l) => {
    if (normalized && normalizeUrl(l.url) === normalized) return true;
    if (externalId && l.externalId === externalId) return true;
    return !normalized && !externalId;
  });
  if (match) {
    const fill: Prisma.ApplicationSourceLinkUpdateInput = {};
    if (!match.url && httpUrl) fill.url = httpUrl;
    if (!match.externalId && externalId) fill.externalId = externalId;
    const link = Object.keys(fill).length
      ? await tx.applicationSourceLink.update({ where: { id: match.id }, data: fill })
      : match;
    return { created: false, link };
  }
  const link = await tx.applicationSourceLink.create({
    data: {
      applicationId,
      platform: input.platform,
      url: httpUrl,
      externalId,
      origin: input.origin,
    },
  });
  return { created: true, link };
}

export type FillableFields = Partial<{
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  requisitionNumber: string | null;
  postingUrl: string | null;
  jobDescription: string | null;
  employmentType: EmploymentType | null;
  jobCategory: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
}>;

export type FillEmptyFieldsResult = {
  application: Application;
  /** Field names that were empty and are now set (includes derived `source`/`requisitionNumber`). */
  filled: string[];
};

function cleanText(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function cleanMoney(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10_000_000
    ? v
    : null;
}

const isEmpty = (v: string | null | undefined) => v === null || v === undefined || v.trim() === "";

/**
 * Fill fields that are currently empty from inferred data, never overwriting anything the user
 * (or an earlier capture) already set. Salary is filled only as a whole when the record has no
 * pay at all, so bounds from different sources/periods are never mixed. A new posting URL
 * re-derives the normalized URL, the platform (when it is still "Other") and the requisition id
 * fallback. Recruiter details go through the contact record: an unlinked record gets a contact,
 * a linked contact only gains a missing email (its name is never replaced).
 */
export async function fillEmptyFieldsInTx(
  tx: ServiceTx,
  userId: string,
  id: string,
  patch: FillableFields,
): Promise<FillEmptyFieldsResult> {
  const app = await tx.application.findFirst({ where: { id, userId } });
  if (!app) throw new ApplicationNotFoundError();
  const data: Prisma.ApplicationUpdateInput = {};
  const filled: string[] = [];
  const set = <K extends keyof Prisma.ApplicationUpdateInput>(
    key: K,
    value: Prisma.ApplicationUpdateInput[K],
  ) => {
    data[key] = value;
    filled.push(key);
  };

  const location = cleanText(patch.location, 160);
  if (location && isEmpty(app.location)) set("location", location);
  const jobCategory = cleanText(patch.jobCategory, 80);
  if (jobCategory && isEmpty(app.jobCategory)) set("jobCategory", jobCategory);
  const jobDescription = cleanText(patch.jobDescription, 20000);
  if (jobDescription && isEmpty(app.jobDescription))
    set("jobDescription", jobDescription);
  if (
    patch.employmentType &&
    patch.employmentType !== "UNKNOWN" &&
    app.employmentType === "UNKNOWN"
  )
    set("employmentType", patch.employmentType);

  const postingUrl = cleanText(patch.postingUrl, 2048);
  let effectiveUrl = app.postingUrl;
  if (postingUrl && /^https?:\/\//i.test(postingUrl) && isEmpty(app.postingUrl)) {
    set("postingUrl", postingUrl);
    data.normalizedUrl = normalizeUrl(postingUrl);
    effectiveUrl = postingUrl;
    if (app.source === "OTHER") {
      const platform = detectPlatform(postingUrl);
      if (platform !== "OTHER") set("source", platform);
    }
  }
  if (isEmpty(app.requisitionNumber)) {
    const req =
      cleanText(patch.requisitionNumber, 80) ??
      extractRequisitionId(effectiveUrl) ??
      extractRequisitionId(jobDescription ?? app.jobDescription);
    if (req) set("requisitionNumber", req);
  }

  if (app.salaryMin === null && app.salaryMax === null) {
    let min = cleanMoney(patch.salaryMin);
    let max = cleanMoney(patch.salaryMax);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    if (min !== null) set("salaryMin", min);
    if (max !== null) set("salaryMax", max);
    if ((min !== null || max !== null) && patch.salaryPeriod && app.salaryPeriod === null)
      set("salaryPeriod", patch.salaryPeriod);
  }

  const recruiterName = cleanText(patch.recruiterName, 120);
  const recruiterEmail = cleanText(patch.recruiterEmail, 254);
  if (recruiterName || recruiterEmail) {
    const contact = app.recruiterContactId
      ? await tx.contact.findFirst({
          where: { id: app.recruiterContactId, userId },
          select: { id: true, name: true, email: true },
        })
      : null;
    if (contact) {
      const contactData: Prisma.ContactUpdateInput = {};
      if (recruiterEmail && isEmpty(contact.email)) {
        contactData.email = recruiterEmail;
        filled.push("recruiterEmail");
      }
      // A contact created from an email address alone uses it as a placeholder name.
      if (recruiterName && contact.email && contact.name === contact.email) {
        contactData.name = recruiterName;
        filled.push("recruiterName");
      }
      if (Object.keys(contactData).length)
        await tx.contact.update({ where: { id: contact.id }, data: contactData });
    } else {
      const contactId = await syncRecruiter(tx, userId, null, {
        recruiterName: recruiterName ?? undefined,
        recruiterEmail: recruiterEmail ?? undefined,
        companyName: app.companyName,
      });
      if (contactId) {
        data.recruiterContact = { connect: { id: contactId } };
        if (recruiterName) filled.push("recruiterName");
        if (recruiterEmail) filled.push("recruiterEmail");
      }
    }
  }

  const application = Object.keys(data).length
    ? await tx.application.update({ where: { id, userId }, data })
    : app;
  return { application, filled };
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

export type StatusChangeInput = {
  status: ApplicationStatus;
  occurredAt?: Date;
  note?: string | null;
  evidenceId?: string | null;
  /** Internal: set by scheduleInterview so the interview's own event stands in for the milestone. */
  skipInterviewMilestone?: boolean;
};

export type ChangeStatusResult =
  | {
      applied: true;
      application: Application;
      fromStatus: ApplicationStatus;
      toStatus: ApplicationStatus;
      xpAwarded: number;
      /** True when the stage did not change but an unverified stage was confirmed. */
      confirmed?: boolean;
    }
  | {
      applied: false;
      reason: "not_found" | "same_status" | "inferred_not_allowed";
      message: string;
    };

/**
 * The only way an application's status changes. For inferred sources (anything but USER) the
 * change is checked with `canApplyInferredStatus` and refused (not thrown) when it would downgrade
 * or override user-confirmed data. Re-submitting the current stage from a verified source when the
 * stage is unverified confirms it (history row + upgraded milestones) instead of being a no-op.
 */
export async function changeStatus(
  userId: string,
  id: string,
  input: StatusChangeInput,
  source: EventSource = "USER",
  verified = true,
): Promise<ChangeStatusResult> {
  return prisma.$transaction((tx) =>
    changeStatusInTx(tx, userId, id, input, source, verified),
  );
}

/** `changeStatus` inside the caller's transaction (reads the profile timezone through `tx`). */
export async function changeStatusInTx(
  tx: ServiceTx,
  userId: string,
  id: string,
  input: StatusChangeInput,
  source: EventSource,
  verified: boolean,
): Promise<ChangeStatusResult> {
  return changeStatusWithCtx(tx, await ctxVia(tx, userId), id, input, source, verified);
}

async function changeStatusWithCtx(
  tx: Tx,
  ctx: Ctx,
  id: string,
  input: StatusChangeInput,
  source: EventSource,
  verified: boolean,
): Promise<ChangeStatusResult> {
  const app = await tx.application.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true, status: true, statusVerified: true, appliedAt: true },
  });
  if (!app)
    return {
      applied: false,
      reason: "not_found",
      message: "Application not found.",
    };
  const next = input.status;
  const confirmation = app.status === next && !app.statusVerified && verified;
  if (!confirmation) {
    if (source !== "USER") {
      const allowed = canApplyInferredStatus({
        current: app.status,
        currentVerified: app.statusVerified,
        next,
        nextVerified: verified,
      });
      if (!allowed) {
        return {
          applied: false,
          reason: "inferred_not_allowed",
          message: `Inferred change ${STATUS_LABELS[app.status]} → ${STATUS_LABELS[next]} not applied: inferred updates only move forward and never override confirmed data.`,
        };
      }
    } else if (app.status === next) {
      return {
        applied: false,
        reason: "same_status",
        message: `Already marked as ${STATUS_LABELS[next]}.`,
      };
    }
  }

  const occurredAt = input.occurredAt ?? new Date();
  const activityDate = todayInTz(ctx.timezone, occurredAt);
  const note = input.note ?? (confirmation ? "Stage confirmed" : null);
  const history = await tx.applicationStatusHistory.create({
    data: {
      applicationId: id,
      fromStatus: app.status,
      toStatus: next,
      occurredAt,
      source,
      verified,
      note,
      evidenceId: input.evidenceId ?? null,
    },
    select: { id: true },
  });
  // Only statuses that prove an application was sent back-fill the application date; closing or
  // withdrawing a lead that was never applied leaves it empty (and records no submission).
  const backfill = !app.appliedAt && impliesSubmission(next);
  const appliedAt = backfill ? occurredAt : app.appliedAt;
  const application = await tx.application.update({
    where: { id, userId: ctx.userId },
    data: {
      status: next,
      ...(confirmation ? {} : { statusUpdatedAt: occurredAt }),
      statusVerified: verified,
      ...(backfill ? { appliedAt } : {}),
    },
  });
  const xpAwarded = await recordStatusMilestones(tx, ctx, {
    applicationId: id,
    fromStatus: app.status,
    status: next,
    historyId: history.id,
    occurredAt,
    activityDate,
    submission: countsAsSubmission({
      from: app.status,
      to: next,
      appliedAt: app.appliedAt,
    }),
    appliedAt,
    source,
    verified,
    note,
    evidenceId: input.evidenceId ?? null,
    skipInterviewMilestone: input.skipInterviewMilestone,
    payload: confirmation ? { confirmation: true } : undefined,
  });
  return {
    applied: true,
    application,
    fromStatus: app.status,
    toStatus: next,
    xpAwarded,
    ...(confirmation ? { confirmed: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Follow-ups and notes
// ---------------------------------------------------------------------------

export type FollowUpInput = {
  note?: string | null;
  occurredAt?: Date;
  nextFollowUpAt?: Date | null;
};
export type FollowUpResult = {
  application: Application;
  eventCreated: boolean;
  xpAwarded: number;
};

/**
 * Log a follow-up. Events dedupe on the exact timestamp (two follow-ups on different days are two
 * real actions). XP: FOLLOW_UP_COMPLETED is keyed per application per calendar day
 * (`xpDedupeKey`), so each day's follow-up on a record counts once.
 */
export async function recordFollowUp(
  userId: string,
  id: string,
  input: FollowUpInput,
): Promise<FollowUpResult> {
  const ctx = await ctxFor(userId);
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!app) throw new ApplicationNotFoundError();
    const occurredAt = input.occurredAt ?? new Date();
    const activityDate = todayInTz(ctx.timezone, occurredAt);
    const dayKey = dateKey(activityDate);
    const sameDayCount = await tx.applicationEvent.count({
      where: {
        applicationId: id,
        type: "FOLLOW_UP_SENT",
        payload: { path: ["activityDate"], equals: dayKey },
      },
    });
    const res = await recordEventOnce(tx, {
      userId,
      applicationId: id,
      type: "FOLLOW_UP_SENT",
      source: "USER",
      verified: true,
      occurredAt,
      activityDate,
      dedupeKey: `${id}:FOLLOW_UP_SENT:${occurredAt.toISOString()}`,
      // At most one follow-up award per application per calendar day.
      xpDedupeKey: `xp:${id}:FOLLOW_UP_COMPLETED:${dayKey}`,
      payload: { note: input.note ?? null, activityDate: dayKey, sameDayIndex: sameDayCount },
    });
    const xpAwarded = res.xpAwarded;
    const application = await tx.application.update({
      where: { id, userId },
      data: { followUpAt: input.nextFollowUpAt ?? null },
    });
    return { application, eventCreated: res.created, xpAwarded };
  });
}

export async function addNote(
  userId: string,
  id: string,
  note: string,
): Promise<Application> {
  const ctx = await ctxFor(userId);
  const text = note.trim();
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, userId },
      select: { id: true, notes: true },
    });
    if (!app) throw new ApplicationNotFoundError();
    const now = new Date();
    await recordEventOnce(tx, {
      userId,
      applicationId: id,
      type: "NOTE_ADDED",
      source: "USER",
      verified: true,
      occurredAt: now,
      activityDate: todayInTz(ctx.timezone, now),
      dedupeKey: `${id}:NOTE_ADDED:${now.toISOString()}`,
      payload: { note: text },
    });
    const notes = app.notes?.trim()
      ? `${app.notes.trimEnd()}\n\n${text}`
      : text;
    return tx.application.update({ where: { id, userId }, data: { notes } });
  });
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export type ScheduleInterviewInput = {
  type: InterviewType;
  scheduledAt: Date;
  durationMinutes?: number | null;
  interviewer?: string | null;
  location?: string | null;
  notes?: string | null;
};
export type ScheduleInterviewResult = {
  interview: Interview;
  statusChange: ChangeStatusResult | null;
  xpAwarded: number;
};

export async function scheduleInterview(
  userId: string,
  id: string,
  input: ScheduleInterviewInput,
): Promise<ScheduleInterviewResult> {
  const ctx = await ctxFor(userId);
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!app) throw new ApplicationNotFoundError();
    const now = new Date();
    const interview = await tx.interview.create({
      data: {
        userId,
        applicationId: id,
        type: input.type,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes ?? null,
        interviewer: input.interviewer ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
      },
    });
    const scheduledFor = formatInTz(
      input.scheduledAt,
      ctx.timezone,
      "datetime",
    );
    const ev = await recordEventOnce(tx, {
      userId,
      applicationId: id,
      type: "INTERVIEW_SCHEDULED",
      source: "USER",
      verified: true,
      occurredAt: now,
      activityDate: todayInTz(ctx.timezone, now),
      dedupeKey: `${id}:INTERVIEW_SCHEDULED:${interview.id}`,
      payload: {
        interviewId: interview.id,
        scheduledAt: input.scheduledAt.toISOString(),
        typeLabel: INTERVIEW_TYPE_LABELS[input.type],
        scheduledFor,
      },
    });
    let statusChange: ChangeStatusResult | null = null;
    if (statusRank(app.status) < statusRank("INTERVIEWING")) {
      statusChange = await changeStatusWithCtx(
        tx,
        ctx,
        id,
        {
          status: "INTERVIEWING",
          occurredAt: now,
          note: `Interview scheduled for ${scheduledFor}`,
          skipInterviewMilestone: true,
        },
        "USER",
        true,
      );
    }
    const xpAwarded =
      ev.xpAwarded + (statusChange?.applied ? statusChange.xpAwarded : 0);
    return { interview, statusChange, xpAwarded };
  });
}

export type InterviewOutcomeInput = {
  outcome: InterviewOutcome;
  attended: boolean;
  prepCompleted?: boolean;
};
export type InterviewOutcomeResult = {
  interview: Interview;
  xpAwarded: number;
};

/**
 * Record how an interview went. Attendance records INTERVIEW_COMPLETED once per interview and pays
 * INTERVIEW_ATTENDED once per interview (`xpDedupeKey`). Prep completion pays INTERVIEW_PREP once
 * per interview.
 */
export async function markInterviewOutcome(
  userId: string,
  interviewId: string,
  input: InterviewOutcomeInput,
): Promise<InterviewOutcomeResult> {
  const ctx = await ctxFor(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interview.findFirst({
      where: { id: interviewId, userId },
    });
    if (!existing) throw new ApplicationNotFoundError("Interview not found.");
    const now = new Date();
    const interview = await tx.interview.update({
      where: { id: interviewId, userId },
      data: {
        outcome: input.outcome,
        attendedAt: input.attended ? (existing.attendedAt ?? now) : null,
        ...(input.prepCompleted === undefined
          ? {}
          : {
              prepCompletedAt: input.prepCompleted
                ? (existing.prepCompletedAt ?? now)
                : null,
            }),
      },
    });
    let xpAwarded = 0;
    if (input.attended) {
      const occurredAt =
        existing.scheduledAt.getTime() <= now.getTime()
          ? existing.scheduledAt
          : now;
      const activityDate = todayInTz(ctx.timezone, occurredAt);
      const res = await recordEventOnce(tx, {
        userId,
        applicationId: existing.applicationId,
        type: "INTERVIEW_COMPLETED",
        source: "USER",
        verified: true,
        occurredAt,
        activityDate,
        dedupeKey: `${existing.applicationId}:INTERVIEW_COMPLETED:${interviewId}`,
        xpDedupeKey: `xp:interview:${interviewId}:attended`,
        payload: {
          interviewId,
          outcomeLabel: INTERVIEW_OUTCOME_LABELS[input.outcome],
        },
      });
      xpAwarded += res.xpAwarded;
    }
    if (input.prepCompleted) {
      const prep = await awardXpOnce(tx, {
        userId,
        reason: "INTERVIEW_PREP",
        dedupeKey: `xp:interview:${interviewId}:prep`,
        sourceType: "Application",
        sourceId: existing.applicationId,
        activityDate: todayInTz(ctx.timezone, now),
      });
      if (prep.awarded) xpAwarded += prep.amount;
    }
    return { interview, xpAwarded };
  });
}

// ---------------------------------------------------------------------------
// Archive / delete
// ---------------------------------------------------------------------------

export async function archiveApplication(
  userId: string,
  id: string,
): Promise<void> {
  const r = await prisma.application.updateMany({
    where: { id, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (r.count === 0) throw new ApplicationNotFoundError();
}

export async function restoreApplication(
  userId: string,
  id: string,
): Promise<void> {
  const r = await prisma.application.updateMany({
    where: { id, userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  if (r.count === 0) throw new ApplicationNotFoundError();
}

/**
 * Hard delete (cascades history, events, interviews, offers). XP earned from the record is
 * revoked (compensating ledger rows) so delete → re-create cannot farm XP.
 */
export async function deleteApplication(
  userId: string,
  id: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // XP earned from a deleted record is revoked so delete → re-create cannot farm XP.
    await revokeXpForSource(tx, userId, "Application", id);
    const r = await tx.application.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw new ApplicationNotFoundError();
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const listSelect = {
  id: true,
  companyName: true,
  positionTitle: true,
  jobCategory: true,
  status: true,
  statusVerified: true,
  statusUpdatedAt: true,
  source: true,
  location: true,
  remote: true,
  employmentType: true,
  salaryMin: true,
  salaryMax: true,
  salaryPeriod: true,
  postingUrl: true,
  appliedAt: true,
  followUpAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  createdVia: true,
  _count: { select: { interviews: true } },
} satisfies Prisma.ApplicationSelect;

type ListRow = Prisma.ApplicationGetPayload<{ select: typeof listSelect }>;

export type ApplicationListItem = Omit<
  ListRow,
  "salaryMin" | "salaryMax" | "_count"
> & {
  salaryMin: number | null;
  salaryMax: number | null;
  interviewCount: number;
};

export type ApplicationListResult = {
  items: ApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Per-status counts for the current search (ignoring the status filter itself). */
  counts: Record<ApplicationStatus, number>;
  /** Total matching the current search ignoring the status filter. */
  totalUnfiltered: number;
  /** Does the user have any application at all (for the first-run empty state)? */
  hasAny: boolean;
};

function decimalToNumber(
  v: { toString(): string } | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function serializeListRow(r: ListRow): ApplicationListItem {
  const { salaryMin, salaryMax, _count, ...rest } = r;
  return {
    ...rest,
    salaryMin: decimalToNumber(salaryMin),
    salaryMax: decimalToNumber(salaryMax),
    interviewCount: _count.interviews,
  };
}

function orderFor(
  sort: ListFilters["sort"],
): Prisma.ApplicationOrderByWithRelationInput[] {
  switch (sort) {
    case "created":
      return [{ createdAt: "desc" }];
    case "applied":
      return [
        { appliedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ];
    case "company":
      return [{ companyName: "asc" }, { positionTitle: "asc" }];
    case "status":
      // Postgres orders enums by declaration order, which is the pipeline order in the schema.
      return [{ status: "asc" }, { statusUpdatedAt: "desc" }];
    case "followUp":
      return [
        { followUpAt: { sort: "asc", nulls: "last" } },
        { updatedAt: "desc" },
      ];
    case "updated":
    default:
      return [{ updatedAt: "desc" }];
  }
}

export async function listApplications(
  userId: string,
  filters: ListFilters,
): Promise<ApplicationListResult> {
  const base: Prisma.ApplicationWhereInput = {
    userId,
    mergedIntoId: null,
    ...(filters.includeArchived ? {} : { archivedAt: null }),
  };
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    base.OR = [
      { companyName: contains },
      { positionTitle: contains },
      { location: contains },
      { requisitionNumber: contains },
      { jobCategory: contains },
    ];
  }
  if (filters.source) base.source = filters.source;
  if (filters.category)
    base.jobCategory = { equals: filters.category, mode: "insensitive" };
  if (filters.from || filters.to) {
    const range = dayRangeInTz(
      filters.from,
      filters.to,
      await userTimezone(userId),
    );
    base.AND = [
      { OR: [{ appliedAt: range }, { appliedAt: null, createdAt: range }] },
    ];
  }
  const where: Prisma.ApplicationWhereInput = filters.status?.length
    ? { ...base, status: { in: filters.status } }
    : base;
  const skip = (filters.page - 1) * filters.pageSize;

  const [rows, total, grouped, anyRow] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: orderFor(filters.sort),
      skip,
      take: filters.pageSize,
      select: listSelect,
    }),
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    prisma.application.findFirst({
      where: { userId, mergedIntoId: null },
      select: { id: true },
    }),
  ]);

  const counts = Object.fromEntries(
    Object.keys(ApplicationStatus).map((s) => [s, 0]),
  ) as Record<ApplicationStatus, number>;
  let totalUnfiltered = 0;
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    totalUnfiltered += g._count._all;
  }
  return {
    items: rows.map(serializeListRow),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    counts,
    totalUnfiltered,
    hasAny: anyRow !== null,
  };
}

/** Distinct job categories the user has used (for the filter select). */
export async function listCategories(userId: string): Promise<string[]> {
  const rows = await prisma.application.findMany({
    where: { userId, mergedIntoId: null, jobCategory: { not: null } },
    distinct: ["jobCategory"],
    select: { jobCategory: true },
    orderBy: { jobCategory: "asc" },
  });
  return rows.map((r) => r.jobCategory).filter((c): c is string => Boolean(c));
}

/** Resume / cover-letter versions available to link from the form. */
export async function listDocumentOptions(userId: string) {
  const [resumes, coverLetters] = await Promise.all([
    prisma.resumeVersion.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.coverLetterVersion.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { resumes, coverLetters };
}

const detailInclude = {
  employer: { select: { id: true, name: true, website: true, domain: true } },
  resumeVersion: { select: { id: true, name: true } },
  coverLetter: { select: { id: true, name: true } },
  recruiterContact: {
    select: { id: true, name: true, email: true, phone: true },
  },
  statusHistory: { orderBy: { occurredAt: "desc" } },
  events: { orderBy: { occurredAt: "desc" }, take: 300 },
  interviews: { orderBy: { scheduledAt: "desc" } },
  offers: { orderBy: { createdAt: "desc" } },
  evidence: {
    orderBy: { capturedAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      title: true,
      snippet: true,
      capturedAt: true,
      data: true,
    },
  },
  sourceLinks: { orderBy: { createdAt: "asc" } },
  mergedInto: { select: { id: true, companyName: true, positionTitle: true } },
} satisfies Prisma.ApplicationInclude;

type DetailRow = Prisma.ApplicationGetPayload<{
  include: typeof detailInclude;
}>;

export type OfferSummary = {
  id: string;
  baseAmount: number | null;
  period: DetailRow["offers"][number]["period"];
  hoursPerWeek: number;
  signingBonus: number | null;
  annualBonus: number | null;
  benefitsValue: number | null;
  startDate: Date | null;
  decisionDue: Date | null;
  status: DetailRow["offers"][number]["status"];
  notes: string | null;
  createdAt: Date;
};

export type ApplicationDetail = Omit<
  DetailRow,
  "salaryMin" | "salaryMax" | "offers"
> & {
  salaryMin: number | null;
  salaryMax: number | null;
  offers: OfferSummary[];
};

export async function getApplication(
  userId: string,
  id: string,
): Promise<ApplicationDetail | null> {
  const row = await prisma.application.findFirst({
    where: { id, userId },
    include: detailInclude,
  });
  if (!row) return null;
  const { salaryMin, salaryMax, offers, ...rest } = row;
  return {
    ...rest,
    salaryMin: decimalToNumber(salaryMin),
    salaryMax: decimalToNumber(salaryMax),
    offers: offers.map((o) => ({
      id: o.id,
      baseAmount: decimalToNumber(o.baseAmount),
      period: o.period,
      hoursPerWeek: o.hoursPerWeek,
      signingBonus: decimalToNumber(o.signingBonus),
      annualBonus: decimalToNumber(o.annualBonus),
      benefitsValue: decimalToNumber(o.benefitsValue),
      startDate: o.startDate,
      decisionDue: o.decisionDue,
      status: o.status,
      notes: o.notes,
      createdAt: o.createdAt,
    })),
  };
}

/** Lightweight ownership-checked fetch for edit forms. */
export async function getApplicationForEdit(userId: string, id: string) {
  const row = await prisma.application.findFirst({
    where: { id, userId },
    include: { recruiterContact: { select: { name: true, email: true } } },
  });
  if (!row) return null;
  const { salaryMin, salaryMax, ...rest } = row;
  return {
    ...rest,
    salaryMin: decimalToNumber(salaryMin),
    salaryMax: decimalToNumber(salaryMax),
  };
}
