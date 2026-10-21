import type { ApplicationStatus } from "@/generated/prisma/enums";

/** Ordered pipeline (left → right). Terminal statuses are separate. */
export const PIPELINE: ApplicationStatus[] = [
  "SAVED",
  "PREPARING",
  "SUBMITTED",
  "CONFIRMED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "HIRED",
];

export const TERMINAL: ApplicationStatus[] = [
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
  "CLOSED",
];

export const ALL_STATUSES: ApplicationStatus[] = [...PIPELINE, ...TERMINAL];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  PREPARING: "Preparing",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  NO_RESPONSE: "No response",
  CLOSED: "Closed",
};

/** Semantic color token name used by <StatusBadge>. */
export const STATUS_TONE: Record<
  ApplicationStatus,
  "neutral" | "info" | "accent" | "success" | "warning" | "danger" | "gold"
> = {
  SAVED: "neutral",
  PREPARING: "neutral",
  SUBMITTED: "info",
  CONFIRMED: "info",
  SCREENING: "accent",
  INTERVIEWING: "accent",
  OFFER: "gold",
  ACCEPTED: "success",
  HIRED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
  NO_RESPONSE: "warning",
  CLOSED: "neutral",
};

export function statusRank(status: ApplicationStatus): number {
  const i = PIPELINE.indexOf(status);
  return i === -1 ? -1 : i;
}

/** "Submitted or later" — counts as a real application for metrics. */
export function isSubmittedStatus(status: ApplicationStatus): boolean {
  return (
    statusRank(status) >= statusRank("SUBMITTED") ||
    status === "REJECTED" ||
    status === "NO_RESPONSE" ||
    status === "WITHDRAWN" ||
    status === "CLOSED"
  );
}

export function isActiveStatus(status: ApplicationStatus): boolean {
  return (
    !TERMINAL.includes(status) && status !== "HIRED" && status !== "ACCEPTED"
  );
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return TERMINAL.includes(status);
}

/** Did the employer respond at some point (for response-rate metrics)? */
export function impliesEmployerResponse(status: ApplicationStatus): boolean {
  return [
    "SCREENING",
    "INTERVIEWING",
    "OFFER",
    "ACCEPTED",
    "HIRED",
    "REJECTED",
  ].includes(status);
}

/**
 * Rule for inferred (email/extension/import) status changes:
 * they may only move a record forward in the pipeline and never override a status the user
 * confirmed or that is backed by verified evidence, unless the inferred change is itself verified.
 */
export function canApplyInferredStatus(opts: {
  current: ApplicationStatus;
  currentVerified: boolean;
  next: ApplicationStatus;
  nextVerified: boolean;
}): boolean {
  const { current, currentVerified, next, nextVerified } = opts;
  if (current === next) return false;
  if (currentVerified && !nextVerified) return false;
  if (isTerminalStatus(next)) return !isTerminalStatus(current) || nextVerified;
  if (isTerminalStatus(current)) return nextVerified; // reopening needs evidence
  return statusRank(next) > statusRank(current);
}
