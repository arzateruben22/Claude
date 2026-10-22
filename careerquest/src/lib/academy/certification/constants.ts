/** Certification tracker constants. Pure. */

/**
 * XP attribution for a verified certification: sourceType "CertificationDocument" and sourceId
 * `<CLASSIFICATION>:<documentId>`. The active ledger row (dedupeKey exactly
 * `xp:certification:<CLASSIFICATION>`) is the record of which certificate document verified it, so
 * deleting the document or clearing the certified date revokes it.
 */
export const CERT_XP_SOURCE = "CertificationDocument";
export const certificationXpKey = (classification: string) => `xp:certification:${classification}`;
export const certificationSourceId = (classification: string, documentId: string) => `${classification}:${documentId}`;

export function parseCertificationSourceId(sourceId: string | null | undefined): { classification: string; documentId: string } | null {
  if (!sourceId) return null;
  const i = sourceId.indexOf(":");
  if (i <= 0) return null;
  const classification = sourceId.slice(0, i);
  const documentId = sourceId.slice(i + 1);
  return /^[A-Z][A-Z0-9_]*$/.test(classification) && documentId ? { classification, documentId } : null;
}

export const CERTIFICATION_CODE = /^[A-Z][A-Z0-9_]{0,59}$/;

export const VERIFIED_CERT_LABEL = "Self-attested with document — CareerQuest does not check state records";

/** Electrician Trainee registration renews every year. */
export const TRAINEE_RENEWAL_MONTHS = 12;
/** Certification renews every 3 years with 32 hours of continuing education. */
export const CERT_RENEWAL_YEARS = 3;
export const CERT_CE_HOURS = 32;
/** Exam must be taken within one year of the eligibility notice. */
export const EXAM_ELIGIBILITY_WINDOW_DAYS = 365;

/** Reminder lead times (days). */
export const TRAINEE_REMINDER_DAYS = 60;
export const CERT_RENEWAL_WINDOW_DAYS = 365;
export const CERT_RENEWAL_URGENT_DAYS = 90;
export const EXAM_WINDOW_REMINDER_DAYS = 60;
