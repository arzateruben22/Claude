import type {
  ApplicationEventType,
  ApplicationSource,
  EmploymentType,
  EventSource,
  EvidenceKind,
  InterviewOutcome,
  InterviewType,
  OfferStatus,
  RecordOrigin,
  SalaryPeriod,
} from "@/generated/prisma/enums";

/** Human labels for enums used by the tracker UI. Safe to import from client components. */

export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  INDEED: "Indeed",
  GLASSDOOR: "Glassdoor",
  LINKEDIN: "LinkedIn",
  ZIPRECRUITER: "ZipRecruiter",
  WORKDAY: "Workday",
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  SMARTRECRUITERS: "SmartRecruiters",
  ICIMS: "iCIMS",
  ADP: "ADP",
  GOVERNMENTJOBS: "GovernmentJobs",
  USAJOBS: "USAJOBS",
  COMPANY_SITE: "Company site",
  UNION_PORTAL: "Union portal",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  APPRENTICESHIP: "Apprenticeship",
  INTERNSHIP: "Internship",
  UNKNOWN: "Not specified",
};

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  HOURLY: "per hour",
  ANNUAL: "per year",
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: "Phone screen",
  VIDEO: "Video",
  ONSITE: "On-site",
  PANEL: "Panel",
  TECHNICAL: "Technical / skills test",
  APPRENTICESHIP_INTERVIEW: "Apprenticeship interview",
  OTHER: "Other",
};

export const INTERVIEW_OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  PENDING: "Pending",
  ADVANCED: "Advanced",
  REJECTED: "Rejected",
  OFFER: "Offer",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  RECEIVED: "Received",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  RESCINDED: "Rescinded",
};

/** Who attributed a status change or event. */
export const EVENT_SOURCE_LABELS: Record<EventSource, string> = {
  USER: "You",
  EMAIL: "Email",
  EXTENSION: "Extension",
  IMPORT: "Import",
  PLATFORM_API: "Platform",
  SYSTEM: "System",
};

export const RECORD_ORIGIN_LABELS: Record<RecordOrigin, string> = {
  MANUAL: "Added manually",
  EMAIL: "Detected from email",
  EXTENSION: "Captured by extension",
  CSV_IMPORT: "CSV import",
  URL_IMPORT: "URL import",
  PLATFORM_API: "Platform sync",
  MOBILE: "Mobile capture",
  SYSTEM: "System",
};

export const EVENT_TYPE_LABELS: Record<ApplicationEventType, string> = {
  SAVED: "Application saved",
  APPLIED: "Application submitted",
  CONFIRMATION_RECEIVED: "Confirmation received",
  RECRUITER_RESPONSE: "Employer responded",
  SCREENING_SCHEDULED: "Screening scheduled",
  ASSESSMENT_INVITED: "Assessment invitation",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_COMPLETED: "Interview attended",
  OFFER_RECEIVED: "Offer received",
  OFFER_ACCEPTED: "Offer accepted",
  OFFER_DECLINED: "Offer declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  FOLLOW_UP_SENT: "Follow-up sent",
  NOTE_ADDED: "Note added",
  STATUS_CHANGED: "Status changed",
  MERGED: "Merged with another record",
  ONBOARDING_RECEIVED: "Onboarding received",
};

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  EMAIL: "Email",
  EXTENSION_CAPTURE: "Page capture",
  SCREENSHOT: "Screenshot",
  CSV_ROW: "CSV row",
  URL: "Link",
  MANUAL_NOTE: "Note",
  DOCUMENT: "Document",
};

/** Where a piece of evidence came from, when the producer did not record anything more specific. */
export const EVIDENCE_DEFAULT_SOURCE_LABELS: Record<EvidenceKind, string> = {
  EMAIL: "Email",
  EXTENSION_CAPTURE: "Browser extension",
  SCREENSHOT: "Uploaded screenshot",
  CSV_ROW: "CSV import",
  URL: "URL import",
  MANUAL_NOTE: "Added by you",
  DOCUMENT: "Uploaded document",
};

const EMAIL_PROVIDER_LABELS: Record<string, string> = {
  GMAIL: "Gmail",
  OUTLOOK: "Outlook",
  EML: "Uploaded .eml file",
  MBOX: "Mailbox (.mbox) import",
  PASTE: "Pasted email",
};

/**
 * Human source label for an evidence row: the email provider or job platform the producer stored
 * in `data` (`provider` / `platform`) when it is one we know, otherwise a label for the kind.
 * Unknown strings are never echoed, so arbitrary captured data cannot masquerade as a source.
 */
export function evidenceSourceLabel(kind: EvidenceKind, data: unknown): string {
  const d = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const provider = typeof d.provider === "string" ? d.provider.toUpperCase() : null;
  if (provider && EMAIL_PROVIDER_LABELS[provider]) return EMAIL_PROVIDER_LABELS[provider]!;
  const platform = typeof d.platform === "string" ? d.platform.toUpperCase() : null;
  if (platform && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, platform)) {
    const label = SOURCE_LABELS[platform as ApplicationSource];
    return kind === "EXTENSION_CAPTURE" ? `Browser extension · ${label}` : label;
  }
  return EVIDENCE_DEFAULT_SOURCE_LABELS[kind];
}

/** Suggestions for the free-text job category field (a datalist, not a constraint). */
export const JOB_CATEGORY_SUGGESTIONS = [
  "Electrician",
  "Apprentice electrician",
  "Journeyman electrician",
  "Electrical helper",
  "Low-voltage technician",
  "HVAC technician",
  "Maintenance technician",
  "Building engineer",
  "Elevator mechanic",
  "Plumber / pipefitter",
  "Construction coordinator",
  "Estimator",
  "Project manager",
  "Other",
] as const;
