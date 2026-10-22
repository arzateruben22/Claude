import "server-only";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/action-result";
import { awardXp, revokeXpForSource, type Tx } from "@/lib/game/xp";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { lockPlayer, safeTimezone } from "@/lib/game/facts";
import { dateKey, dateKeyInTz, todayInTz } from "@/lib/dates";
import { parseDateInput } from "@/lib/applications/time";
import { loadRoadmap } from "@/lib/academy/roadmap";
import { deleteDocument, listDocuments, saveFormFile, type DocumentSummary, type FormFile } from "@/lib/documents/service";
import { CERTIFICATION_DOC_KINDS } from "@/lib/documents/validation";
import { getHoursSummary, type HoursSummary } from "@/lib/academy/hours/service";
import { DEFAULT_CLASSIFICATION } from "@/lib/academy/hours/constants";
import { getRequirement, listRequirements, type RequirementView } from "./requirements";
import { CERT_XP_SOURCE, certificationSourceId, certificationXpKey, parseCertificationSourceId } from "./constants";
import { CERT_DATE_FIELDS, PAST_ONLY_FIELDS, type CertificationStatusInput } from "./form";
import {
  EMPTY_CERT_DATES,
  buildCertificationTimeline,
  certificationReminders,
  eligibilityEstimate,
  type CertDates,
  type EligibilityEstimate,
  type Reminder,
  type TimelineStep,
} from "./timeline";
import { buildDirLinks, type DirLink } from "./links";

/**
 * Certification tracker (CertificationStatus per classification). Every date is self-reported.
 * "Verified certification" means: a certification date is recorded AND the user attached a
 * CERTIFICATE document — it is labelled "self-attested with document"; CareerQuest never checks
 * state records. The active CERTIFICATION_VERIFIED ledger row (sourceId `<code>:<documentId>`) is
 * the link between the classification and its document.
 */

const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

async function timezoneFor(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  return safeTimezone(profile?.timezone);
}

type StatusRow = {
  traineeRegisteredAt: Date | null;
  traineeExpiresAt: Date | null;
  schoolEnrolled: string | null;
  examApplicationAt: Date | null;
  examEligibleAt: Date | null;
  examScheduledAt: Date | null;
  examPassedAt: Date | null;
  certifiedAt: Date | null;
  certificateExpiresAt: Date | null;
  notes: string | null;
};

export function toCertDates(row: StatusRow | null, tz: string): CertDates {
  if (!row) return { ...EMPTY_CERT_DATES };
  const k = (d: Date | null) => (d ? dateKeyInTz(d, tz) : null);
  return {
    traineeRegisteredAt: k(row.traineeRegisteredAt),
    traineeExpiresAt: k(row.traineeExpiresAt),
    schoolEnrolled: row.schoolEnrolled,
    examApplicationAt: k(row.examApplicationAt),
    examEligibleAt: k(row.examEligibleAt),
    examScheduledAt: k(row.examScheduledAt),
    examPassedAt: k(row.examPassedAt),
    certifiedAt: k(row.certifiedAt),
    certificateExpiresAt: k(row.certificateExpiresAt),
  };
}

export type CertificationVerification = { documentId: string; fileName: string; verifiedAt: Date } | null;

async function activeVerification(db: Tx, userId: string, classification: string): Promise<{ sourceId: string; documentId: string; createdAt: Date } | null> {
  const row = await db.xpLedger.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey: certificationXpKey(classification) } },
    select: { sourceType: true, sourceId: true, amount: true, createdAt: true },
  });
  if (!row || row.amount <= 0 || row.sourceType !== CERT_XP_SOURCE) return null;
  const parsed = parseCertificationSourceId(row.sourceId);
  if (!parsed || parsed.classification !== classification) return null;
  return { sourceId: row.sourceId!, documentId: parsed.documentId, createdAt: row.createdAt };
}

export async function getCertificationVerification(userId: string, classification: string): Promise<CertificationVerification> {
  const active = await activeVerification(prisma, userId, classification);
  if (!active) return null;
  const doc = await prisma.document.findFirst({ where: { id: active.documentId, userId }, select: { id: true, fileName: true } });
  return doc ? { documentId: doc.id, fileName: doc.fileName, verifiedAt: active.createdAt } : null;
}

export type CertificationPageData = {
  timezone: string;
  todayKey: string;
  requirements: RequirementView[];
  requirement: RequirementView;
  dates: CertDates;
  notes: string | null;
  hasRecord: boolean;
  timeline: TimelineStep[];
  reminders: Reminder[];
  eligibility: EligibilityEstimate;
  hours: Pick<HoursSummary, "totals" | "caps">;
  verification: CertificationVerification;
  documents: DocumentSummary[];
  dirLinks: DirLink[];
  /** "YYYY-MM-DD" the DIR facts were last checked (from the seed facts). */
  factsVerifiedOn: string | null;
  trackedClassifications: string[];
};

export async function getCertificationPageData(userId: string, code?: string | null, now = new Date()): Promise<CertificationPageData | null> {
  const requirements = await listRequirements();
  const requirement = await getRequirement(code || DEFAULT_CLASSIFICATION, requirements);
  if (!requirement) return null;
  const timezone = await timezoneFor(userId);
  const todayKey = dateKey(todayInTz(timezone, now));
  const [row, tracked, verification, documents, hours] = await Promise.all([
    prisma.certificationStatus.findUnique({ where: { userId_classification: { userId, classification: requirement.code } } }),
    prisma.certificationStatus.findMany({ where: { userId }, select: { classification: true } }),
    getCertificationVerification(userId, requirement.code),
    listDocuments(userId, CERTIFICATION_DOC_KINDS),
    getHoursSummary(userId, { now, requirement }),
  ]);
  const dates = toCertDates(row, timezone);
  const roadmap = loadRoadmap();
  return {
    timezone,
    todayKey,
    requirements: requirements.length ? requirements : [requirement],
    requirement,
    dates,
    notes: row?.notes ?? null,
    hasRecord: Boolean(row),
    timeline: buildCertificationTimeline(dates, todayKey),
    reminders: certificationReminders(dates, todayKey),
    eligibility: eligibilityEstimate({
      required: requirement.hoursRequired,
      verified: hours.totals.verified,
      selfReported: hours.totals.selfReported,
      countableVerified: hours.caps ? hours.caps.verified.countable : null,
    }),
    hours: { totals: hours.totals, caps: hours.caps },
    verification: verification && dates.certifiedAt ? verification : null,
    documents,
    dirLinks: buildDirLinks(roadmap, requirement.sourceUrl),
    factsVerifiedOn: roadmap.verifiedOn && /^\d{4}-\d{2}-\d{2}$/.test(roadmap.verifiedOn) ? roadmap.verifiedOn : null,
    trackedClassifications: tracked.map((t) => t.classification),
  };
}

export type CertWriteResult = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: FieldErrors };

async function afterCertificationChange(tx: Tx, userId: string, now: Date, today: Date): Promise<void> {
  await applyEventToMissions(tx, { userId, type: "PROFILE_UPDATED", occurredAt: now, activityDate: today });
  await evaluateAchievements(tx, userId);
}

/** Save the self-reported timeline for one classification. Clearing the certified date un-verifies it. */
export async function saveCertificationStatus(userId: string, input: CertificationStatusInput, now = new Date()): Promise<CertWriteResult> {
  const requirement = await getRequirement(input.classification);
  if (!requirement) return { ok: false, error: "Unknown classification." };
  const tz = await timezoneFor(userId);
  const today = todayInTz(tz, now);
  const todayKey = dateKey(today);
  const fieldErrors: FieldErrors = {};
  for (const f of PAST_ONLY_FIELDS) {
    const v = input[f];
    if (v && v > todayKey) fieldErrors[f] = ["This date cannot be in the future."];
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const toDate = (k: string | null) => (k ? parseDateInput(k, tz) : null);
  const data = {
    ...Object.fromEntries(CERT_DATE_FIELDS.map((f) => [f, toDate(input[f])])),
    schoolEnrolled: input.schoolEnrolled,
    notes: input.notes,
  } as Record<(typeof CERT_DATE_FIELDS)[number], Date | null> & { schoolEnrolled: string | null; notes: string | null };

  const unverified = await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, userId);
    await tx.certificationStatus.upsert({
      where: { userId_classification: { userId, classification: requirement.code } },
      create: { userId, classification: requirement.code, ...data },
      update: data,
    });
    let revoked = false;
    if (!data.certifiedAt) {
      const active = await activeVerification(tx, userId, requirement.code);
      if (active) revoked = (await revokeXpForSource(tx, userId, CERT_XP_SOURCE, active.sourceId)) > 0;
    }
    await afterCertificationChange(tx, userId, now, today);
    return revoked;
  }, TX_OPTIONS);
  return {
    ok: true,
    message: unverified
      ? `Saved your ${requirement.name} timeline. The certified date was cleared, so it is no longer marked verified.`
      : `Saved your ${requirement.name} timeline (self-reported).`,
  };
}

export type VerifyOptions = { documentId?: string | null; newFile?: FormFile | null; now?: Date };

/**
 * Mark a classification's certification as "verified (self-attested with document)". Requires a
 * recorded certification date and a CERTIFICATE document of the user's. Awards
 * CERTIFICATION_VERIFIED once (`xp:certification:<code>`); switching the document keeps the net
 * award at one.
 */
export async function verifyCertification(userId: string, classification: string, opts: VerifyOptions = {}): Promise<CertWriteResult> {
  const now = opts.now ?? new Date();
  const requirement = await getRequirement(classification);
  if (!requirement) return { ok: false, error: "Unknown classification." };
  const tz = await timezoneFor(userId);
  const today = todayInTz(tz, now);

  const status = await prisma.certificationStatus.findUnique({
    where: { userId_classification: { userId, classification: requirement.code } },
    select: { certifiedAt: true },
  });
  if (!status?.certifiedAt) {
    return { ok: false, error: "Record your certification date on the timeline first.", fieldErrors: { certifiedAt: ["Record your certification date first."] } };
  }

  let uploadedId: string | null = null;
  if (opts.newFile) {
    const saved = await saveFormFile(userId, "CERTIFICATE", opts.newFile);
    if (!saved.ok) return { ok: false, error: saved.error, fieldErrors: { file: [saved.error] } };
    uploadedId = saved.document.id;
  }
  const documentId = uploadedId ?? opts.documentId ?? null;
  if (!documentId) {
    return { ok: false, error: "Attach your certificate (PDF or image) to verify.", fieldErrors: { file: ["Attach your certificate or choose an uploaded one."] } };
  }

  const outcome = await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const doc = await tx.document.findFirst({ where: { id: documentId, userId, kind: "CERTIFICATE" }, select: { id: true, fileName: true } });
    if (!doc) return { kind: "bad-doc" as const };
    const active = await activeVerification(tx, userId, requirement.code);
    if (active?.documentId === doc.id) return { kind: "same" as const, fileName: doc.fileName };
    if (active) await revokeXpForSource(tx, userId, CERT_XP_SOURCE, active.sourceId);
    const award = await awardXp(tx, {
      userId,
      reason: "CERTIFICATION_VERIFIED",
      dedupeKey: certificationXpKey(requirement.code),
      sourceType: CERT_XP_SOURCE,
      sourceId: certificationSourceId(requirement.code, doc.id),
      activityDate: today,
    });
    await afterCertificationChange(tx, userId, now, today);
    return { kind: "verified" as const, fileName: doc.fileName, switched: Boolean(active), xp: award.awarded ? award.amount : 0 };
  }, TX_OPTIONS);

  if (outcome.kind === "bad-doc") {
    if (uploadedId) await deleteDocument(userId, uploadedId).catch(() => undefined);
    return { ok: false, error: "Choose one of your certificate documents.", fieldErrors: { documentId: ["Choose one of your certificate documents."] } };
  }
  if (outcome.kind === "same") return { ok: true, message: `Already verified with ${outcome.fileName}.` };
  return {
    ok: true,
    message: outcome.switched
      ? `Verification now uses ${outcome.fileName} (self-attested with document).`
      : `${requirement.name} certification marked verified with ${outcome.fileName} — self-attested with document${outcome.xp ? ` (+${outcome.xp} XP)` : ""}.`,
  };
}

/** Remove the "verified" mark (revokes its XP). The document itself is kept. */
export async function removeCertificationVerification(userId: string, classification: string, now = new Date()): Promise<CertWriteResult> {
  const requirement = await getRequirement(classification);
  if (!requirement) return { ok: false, error: "Unknown classification." };
  const tz = await timezoneFor(userId);
  const today = todayInTz(tz, now);
  const removed = await prisma.$transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const active = await activeVerification(tx, userId, requirement.code);
    if (!active) return false;
    await revokeXpForSource(tx, userId, CERT_XP_SOURCE, active.sourceId);
    await afterCertificationChange(tx, userId, now, today);
    return true;
  }, TX_OPTIONS);
  return removed ? { ok: true, message: "Removed the verified mark. Your certificate document was kept." } : { ok: false, error: "This certification is not marked verified." };
}
