import "server-only";
/**
 * Merging duplicate applications. One transaction moves everything the merged record owns (status
 * history, events, interviews, offers, evidence, source links, emails, captures, leads) onto the
 * kept record, fills the kept record's empty fields, adopts a further-along stage through the
 * applications service, settles XP so the pair is rewarded exactly as one record, and leaves the
 * merged record in place as `mergedIntoId = keep` (hidden from every list and metric).
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import {
  addSourceLinkInTx,
  changeStatusInTx,
  fillEmptyFieldsInTx,
  type ServiceTx,
} from "@/lib/applications/service";
import { normalizeUrl } from "@/lib/applications/normalize";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { STATUS_LABELS } from "@/lib/applications/status";
import {
  recordApplicationEvent,
  positionFingerprint,
} from "@/lib/events/record-event";
import { awardXp, revokeXpForSource } from "@/lib/game/xp";
import { XP, type XpReason } from "@/lib/game/xp-config";
import { audit } from "@/lib/audit";
import { todayInTz } from "@/lib/dates";
import { lockUserIngestion } from "@/lib/ingest/engine";
import { orderedPair, shouldAdoptMergedStatus } from "./pairs";

export class DuplicateError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "DuplicateError";
  }
}

export type MergeResult = {
  keepId: string;
  mergedId: string;
  /** Rows moved to the kept record, per table. */
  moved: Record<string, number>;
  /** Kept-record fields that were empty and were filled from the merged record. */
  fieldsFilled: string[];
  statusChange: {
    attempted: boolean;
    applied: boolean;
    status: ApplicationStatus | null;
    message: string | null;
  };
  xpRevoked: number;
  xpRestored: number;
};

const DEFAULT_TIMEZONE = "America/Los_Angeles";
const REVOKED_MARK = "#revoked:";

/** One award per application for these reasons (the milestone event that pays them). */
const ONE_PER_APPLICATION: Partial<
  Record<XpReason, "APPLIED" | "OFFER_RECEIVED" | "OFFER_ACCEPTED">
> = {
  APPLICATION_SUBMITTED: "APPLIED",
  JOB_OFFER_VERIFIED: "OFFER_RECEIVED",
  JOB_ACCEPTED: "OFFER_ACCEPTED",
};

const mergeSelect = {
  id: true,
  userId: true,
  companyName: true,
  positionTitle: true,
  normalizedCompany: true,
  normalizedTitle: true,
  location: true,
  postingUrl: true,
  requisitionNumber: true,
  source: true,
  submissionDestination: true,
  salaryMin: true,
  salaryMax: true,
  salaryPeriod: true,
  employmentType: true,
  jobCategory: true,
  jobDescription: true,
  appliedAt: true,
  followUpAt: true,
  status: true,
  statusVerified: true,
  statusUpdatedAt: true,
  employerId: true,
  resumeVersionId: true,
  coverLetterVersionId: true,
  recruiterContactId: true,
  notes: true,
  createdVia: true,
  archivedAt: true,
  mergedIntoId: true,
  recruiterContact: { select: { name: true, email: true } },
} satisfies Prisma.ApplicationSelect;

type MergeRow = Prisma.ApplicationGetPayload<{ select: typeof mergeSelect }>;

const num = (v: { toString(): string } | null) =>
  v === null ? null : Number(v.toString());

/**
 * Merge `mergeId` into `keepId` (both must be the user's own, distinct, non-merged records).
 * Throws DuplicateError for invalid requests. Writes an audit row.
 */
export async function mergeApplications(
  userId: string,
  keepId: string,
  mergeId: string,
): Promise<MergeResult> {
  if (keepId === mergeId)
    throw new DuplicateError(
      "INVALID",
      "Pick two different applications to merge.",
    );
  const result = await prisma.$transaction(
    (tx) => mergeInTx(tx, userId, keepId, mergeId),
    {
      maxWait: 10_000,
      timeout: 60_000,
    },
  );
  await audit("applications.merge", {
    userId,
    entityType: "Application",
    entityId: keepId,
    metadata: {
      mergedId: mergeId,
      fieldsFilled: result.fieldsFilled,
      statusApplied: result.statusChange.applied
        ? result.statusChange.status
        : null,
      xpRevoked: result.xpRevoked,
      xpRestored: result.xpRestored,
    },
  });
  return result;
}

/** Merge the pair behind a pending DuplicateCandidate, keeping `keepId` (one of the two). */
export async function mergeDuplicateCandidate(
  userId: string,
  candidateId: string,
  keepId: string,
): Promise<MergeResult> {
  const c = await prisma.duplicateCandidate.findFirst({
    where: { id: candidateId, userId },
    select: { applicationAId: true, applicationBId: true, status: true },
  });
  if (!c)
    throw new DuplicateError(
      "NOT_FOUND",
      "That possible duplicate no longer exists.",
    );
  if (c.status !== "PENDING")
    throw new DuplicateError(
      "INVALID",
      "That possible duplicate was already resolved.",
    );
  if (keepId !== c.applicationAId && keepId !== c.applicationBId) {
    throw new DuplicateError(
      "INVALID",
      "Choose one of the two applications to keep.",
    );
  }
  const mergeId =
    keepId === c.applicationAId ? c.applicationBId : c.applicationAId;
  return mergeApplications(userId, keepId, mergeId);
}

/** "Not a duplicate": the pair is never proposed again. */
export async function dismissDuplicate(
  userId: string,
  candidateId: string,
): Promise<void> {
  const r = await prisma.duplicateCandidate.updateMany({
    where: { id: candidateId, userId, status: "PENDING" },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  if (r.count === 0)
    throw new DuplicateError(
      "NOT_FOUND",
      "That possible duplicate no longer exists or was already resolved.",
    );
}

async function mergeInTx(
  tx: ServiceTx,
  userId: string,
  keepId: string,
  mergeId: string,
): Promise<MergeResult> {
  await lockUserIngestion(tx, userId);
  const [keep, merge] = await Promise.all([
    tx.application.findFirst({
      where: { id: keepId, userId },
      select: mergeSelect,
    }),
    tx.application.findFirst({
      where: { id: mergeId, userId },
      select: mergeSelect,
    }),
  ]);
  if (!keep || !merge)
    throw new DuplicateError("NOT_FOUND", "Application not found.");
  if (keep.mergedIntoId || merge.mergedIntoId) {
    throw new DuplicateError(
      "INVALID",
      "One of these applications was already merged into another record.",
    );
  }
  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const timezone = profile?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const moved: Record<string, number> = {};

  // 1. XP earned by the merged record is revoked; what the kept record should hold is restored below.
  const awards = await tx.xpLedger.findMany({
    where: {
      userId,
      sourceType: "Application",
      sourceId: mergeId,
      amount: { gt: 0 },
      NOT: { dedupeKey: { contains: REVOKED_MARK } },
    },
    select: { reason: true, dedupeKey: true, amount: true },
  });
  const xpRevoked = await revokeXpForSource(tx, userId, "Application", mergeId);

  // 2. Events move under the kept record's keys; a milestone the kept record already has keeps its
  //    history under a `merged:<mergeId>:` key (no second award, no second milestone).
  moved.events = await moveEvents(tx, userId, keepId, mergeId, timezone);

  // 3. Everything else the merged record owns.
  moved.statusHistory = (
    await tx.applicationStatusHistory.updateMany({
      where: { applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.interviews = (
    await tx.interview.updateMany({
      where: { userId, applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.offers = (
    await tx.offer.updateMany({
      where: { userId, applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.evidence = (
    await tx.evidence.updateMany({
      where: { userId, applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.emailMessages = (
    await tx.emailMessage.updateMany({
      where: { userId, applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.captures = (
    await tx.extensionCapture.updateMany({
      where: { userId, applicationId: mergeId },
      data: { applicationId: keepId },
    })
  ).count;
  moved.leads = (
    await tx.jobLead.updateMany({
      where: { userId, convertedApplicationId: mergeId },
      data: { convertedApplicationId: keepId },
    })
  ).count;
  moved.earlierMerges = (
    await tx.application.updateMany({
      where: { userId, mergedIntoId: mergeId },
      data: { mergedIntoId: keepId },
    })
  ).count;
  moved.sourceLinks = await moveSourceLinks(tx, userId, keepId, merge);

  // 4. Empty fields on the kept record.
  const fieldsFilled = await fillFromMerged(tx, userId, keep, merge);

  // 5. A further-along stage comes along (attributed to SYSTEM; the service refuses overrides of
  //    verified data by unverified data).
  const current = await tx.application.findUniqueOrThrow({
    where: { id: keepId },
    select: { status: true, statusVerified: true, statusUpdatedAt: true },
  });
  const statusChange: MergeResult["statusChange"] = {
    attempted: false,
    applied: false,
    status: null,
    message: null,
  };
  if (shouldAdoptMergedStatus(current, merge)) {
    statusChange.attempted = true;
    const occurredAt = new Date(
      Math.max(
        current.statusUpdatedAt.getTime(),
        merge.statusUpdatedAt.getTime(),
      ),
    );
    const change = await changeStatusInTx(
      tx,
      userId,
      keepId,
      {
        status: merge.status,
        occurredAt,
        note: `Stage carried over from the merged duplicate (${SOURCE_LABELS[merge.source]})`,
      },
      "SYSTEM",
      merge.statusVerified,
    );
    statusChange.applied = change.applied;
    statusChange.status = merge.status;
    statusChange.message = change.applied
      ? `Stage set to ${STATUS_LABELS[merge.status]}.`
      : change.message;
  }

  // 6. Restore the awards the combined record should hold (never a second one for the same slot).
  const xpRestored = await restoreAwards(tx, userId, keepId, mergeId, awards);

  // 7. Retire the merged record and record the merge on the kept one.
  await tx.application.update({
    where: { id: mergeId },
    data: { mergedIntoId: keepId, archivedAt: now },
  });
  const detail = `Merged duplicate: ${merge.companyName} – ${merge.positionTitle} (${SOURCE_LABELS[merge.source]})`;
  await recordApplicationEvent(tx, {
    userId,
    applicationId: keepId,
    type: "MERGED",
    source: "USER",
    verified: true,
    occurredAt: now,
    activityDate: todayInTz(timezone, now),
    dedupeKey: `${keepId}:MERGED:${mergeId}`,
    payload: {
      detail,
      mergedId: mergeId,
      fieldsFilled,
      statusAdopted: statusChange.applied ? merge.status : null,
    },
  });

  // 8. Duplicate candidates: this pair is merged; other pending pairs with the merged record are
  //    moot; "not a duplicate" decisions carry over to the kept record.
  await settleCandidates(tx, userId, keepId, mergeId, now);

  return {
    keepId,
    mergedId: mergeId,
    moved,
    fieldsFilled,
    statusChange,
    xpRevoked,
    xpRestored,
  };
}

async function moveEvents(
  tx: ServiceTx,
  userId: string,
  keepId: string,
  mergeId: string,
  timezone: string,
): Promise<number> {
  const keepKeys = new Set(
    (
      await tx.applicationEvent.findMany({
        where: { userId, applicationId: keepId },
        select: { dedupeKey: true },
      })
    ).map((e) => e.dedupeKey),
  );
  const events = await tx.applicationEvent.findMany({
    where: { userId, applicationId: mergeId },
    select: { id: true, dedupeKey: true, type: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });
  const prefix = `${mergeId}:`;
  for (const e of events) {
    let key = e.dedupeKey;
    if (key.startsWith(prefix)) key = `${keepId}:${key.slice(prefix.length)}`;
    if (keepKeys.has(key)) {
      key = `merged:${mergeId}:${e.dedupeKey}`;
      // The kept record already counts this submission: the merged one no longer adds to the day.
      if (e.type === "APPLIED") {
        await tx.dailyActivity.updateMany({
          where: {
            userId,
            date: todayInTz(timezone, e.occurredAt),
            applicationsSubmitted: { gt: 0 },
          },
          data: { applicationsSubmitted: { decrement: 1 } },
        });
      }
    }
    keepKeys.add(key);
    await tx.applicationEvent.update({
      where: { id: e.id },
      data: { applicationId: keepId, dedupeKey: key },
    });
  }
  return events.length;
}

async function moveSourceLinks(
  tx: ServiceTx,
  userId: string,
  keepId: string,
  merge: MergeRow,
): Promise<number> {
  const keepLinks = await tx.applicationSourceLink.findMany({
    where: { applicationId: keepId },
  });
  const mergeLinks = await tx.applicationSourceLink.findMany({
    where: { applicationId: merge.id },
    orderBy: { createdAt: "asc" },
  });
  let moved = 0;
  for (const l of mergeLinks) {
    const n = normalizeUrl(l.url);
    const same = keepLinks.find(
      (k) =>
        k.platform === l.platform &&
        ((n !== null && normalizeUrl(k.url) === n) ||
          (l.externalId !== null && k.externalId === l.externalId) ||
          (n === null && !l.externalId)),
    );
    if (same) {
      const fill: Prisma.ApplicationSourceLinkUpdateInput = {};
      if (!same.url && l.url) fill.url = l.url;
      if (!same.externalId && l.externalId) fill.externalId = l.externalId;
      if (Object.keys(fill).length)
        await tx.applicationSourceLink.update({
          where: { id: same.id },
          data: fill,
        });
      await tx.applicationSourceLink.delete({ where: { id: l.id } });
    } else {
      const updated = await tx.applicationSourceLink.update({
        where: { id: l.id },
        data: { applicationId: keepId },
      });
      keepLinks.push(updated);
      moved += 1;
    }
  }
  // Where the merged record itself was seen survives the merge.
  if (merge.source !== "OTHER" || merge.postingUrl) {
    const r = await addSourceLinkInTx(tx, userId, keepId, {
      platform: merge.source,
      url: merge.postingUrl,
      origin: merge.createdVia,
    });
    if (r.created) moved += 1;
  }
  return moved;
}

async function fillFromMerged(
  tx: ServiceTx,
  userId: string,
  keep: MergeRow,
  merge: MergeRow,
): Promise<string[]> {
  const linkContact =
    !keep.recruiterContactId && merge.recruiterContactId !== null;
  const fill = await fillEmptyFieldsInTx(tx, userId, keep.id, {
    location: merge.location,
    salaryMin: num(merge.salaryMin),
    salaryMax: num(merge.salaryMax),
    salaryPeriod: merge.salaryPeriod,
    requisitionNumber: merge.requisitionNumber,
    postingUrl: merge.postingUrl,
    jobDescription: merge.jobDescription,
    employmentType: merge.employmentType,
    jobCategory: merge.jobCategory,
    // An unlinked kept record takes over the merged record's contact as-is (below), so no new
    // contact row is created; a linked one may only gain a missing email.
    recruiterEmail: linkContact
      ? null
      : (merge.recruiterContact?.email ?? null),
  });
  const filled = [...fill.filled];
  const data: Prisma.ApplicationUpdateInput = {};
  if (!keep.appliedAt && merge.appliedAt) {
    data.appliedAt = merge.appliedAt;
    filled.push("appliedAt");
  }
  if (!keep.followUpAt && merge.followUpAt) {
    data.followUpAt = merge.followUpAt;
    filled.push("followUpAt");
  }
  if (!keep.submissionDestination && merge.submissionDestination) {
    data.submissionDestination = merge.submissionDestination;
    filled.push("submissionDestination");
  }
  if (fill.application.source === "OTHER" && merge.source !== "OTHER") {
    data.source = merge.source;
    filled.push("source");
  }
  if (!keep.employerId && merge.employerId)
    data.employer = { connect: { id: merge.employerId } };
  if (!keep.resumeVersionId && merge.resumeVersionId) {
    data.resumeVersion = { connect: { id: merge.resumeVersionId } };
    filled.push("resumeVersion");
  }
  if (!keep.coverLetterVersionId && merge.coverLetterVersionId) {
    data.coverLetter = { connect: { id: merge.coverLetterVersionId } };
    filled.push("coverLetter");
  }
  if (linkContact) {
    data.recruiterContact = { connect: { id: merge.recruiterContactId! } };
    filled.push("recruiter");
  }
  const mergeNotes = merge.notes?.trim();
  if (mergeNotes) {
    const keepNotes = keep.notes?.trim() ?? "";
    if (!keepNotes) {
      data.notes = mergeNotes;
      filled.push("notes");
    } else if (!keepNotes.includes(mergeNotes)) {
      data.notes =
        `${keepNotes}\n\nFrom the merged duplicate (${merge.companyName} – ${merge.positionTitle}):\n${mergeNotes}`.slice(
          0,
          20_000,
        );
      filled.push("notes");
    }
  }
  if (Object.keys(data).length)
    await tx.application.update({ where: { id: keep.id }, data });
  return filled;
}

async function restoreAwards(
  tx: ServiceTx,
  userId: string,
  keepId: string,
  mergeId: string,
  awards: ReadonlyArray<{ reason: string; dedupeKey: string; amount: number }>,
): Promise<number> {
  if (!awards.length) return 0;
  const held = await tx.xpLedger.findMany({
    where: {
      userId,
      sourceType: "Application",
      sourceId: keepId,
      amount: { gt: 0 },
      NOT: { dedupeKey: { contains: REVOKED_MARK } },
    },
    select: { reason: true, dedupeKey: true },
  });
  const heldReasons = new Set(held.map((h) => h.reason));
  const heldKeys = new Set(held.map((h) => h.dedupeKey));
  const keep = await tx.application.findUniqueOrThrow({
    where: { id: keepId },
    select: { normalizedCompany: true, normalizedTitle: true, location: true },
  });
  const events = await tx.applicationEvent.findMany({
    where: {
      userId,
      applicationId: keepId,
      type: { in: ["APPLIED", "OFFER_RECEIVED", "OFFER_ACCEPTED"] },
    },
    select: { type: true, verified: true },
  });
  let restored = 0;
  for (const a of awards) {
    if (!Object.prototype.hasOwnProperty.call(XP, a.reason)) continue;
    const reason = a.reason as XpReason;
    let key: string;
    const milestone = ONE_PER_APPLICATION[reason];
    if (milestone) {
      if (heldReasons.has(reason)) continue;
      const has = events.some(
        (e) =>
          e.type === milestone &&
          (reason !== "JOB_OFFER_VERIFIED" || e.verified),
      );
      if (!has) continue;
      key =
        reason === "APPLICATION_SUBMITTED"
          ? `xp:submitted:${positionFingerprint(keep)}`
          : `xp:${keepId}:${reason}`;
    } else {
      key = a.dedupeKey.split(mergeId).join(keepId);
      if (heldKeys.has(key)) continue;
    }
    // No activity date: the original award already counted toward that day's XP and streak.
    const r = await awardXp(tx, {
      userId,
      reason,
      dedupeKey: key,
      amount: a.amount,
      sourceType: "Application",
      sourceId: keepId,
    });
    if (r.awarded) {
      restored += r.amount;
      heldReasons.add(reason);
      heldKeys.add(key);
    }
  }
  return restored;
}

async function settleCandidates(
  tx: ServiceTx,
  userId: string,
  keepId: string,
  mergeId: string,
  now: Date,
): Promise<void> {
  const [a, b] = orderedPair(keepId, mergeId);
  const pair = await tx.duplicateCandidate.findUnique({
    where: {
      applicationAId_applicationBId: { applicationAId: a, applicationBId: b },
    },
    select: { id: true, userId: true },
  });
  if (pair && pair.userId === userId) {
    await tx.duplicateCandidate.update({
      where: { id: pair.id },
      data: { status: "MERGED", resolvedAt: now },
    });
  } else if (!pair) {
    await tx.duplicateCandidate.create({
      data: {
        userId,
        applicationAId: a,
        applicationBId: b,
        score: 1,
        signals: { mergedManually: true },
        status: "MERGED",
        resolvedAt: now,
      },
    });
  }
  const others = await tx.duplicateCandidate.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "DISMISSED"] },
      OR: [{ applicationAId: mergeId }, { applicationBId: mergeId }],
    },
    select: {
      id: true,
      applicationAId: true,
      applicationBId: true,
      status: true,
      score: true,
      signals: true,
    },
  });
  for (const c of others) {
    const third =
      c.applicationAId === mergeId ? c.applicationBId : c.applicationAId;
    if (c.status === "PENDING" || third === keepId) {
      await tx.duplicateCandidate.delete({ where: { id: c.id } });
      continue;
    }
    const [x, y] = orderedPair(keepId, third);
    const existing = await tx.duplicateCandidate.findUnique({
      where: {
        applicationAId_applicationBId: { applicationAId: x, applicationBId: y },
      },
      select: { id: true, status: true },
    });
    if (!existing) {
      await tx.duplicateCandidate.create({
        data: {
          userId,
          applicationAId: x,
          applicationBId: y,
          score: c.score,
          signals: (c.signals ?? {}) as Prisma.InputJsonValue,
          status: "DISMISSED",
          resolvedAt: now,
        },
      });
    } else if (existing.status === "PENDING") {
      await tx.duplicateCandidate.update({
        where: { id: existing.id },
        data: { status: "DISMISSED", resolvedAt: now },
      });
    }
  }
}
