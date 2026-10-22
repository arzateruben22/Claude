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

/**
 * Status-only heuristic: "submitted or later, or any closed status". Kept for display hints and
 * backward compatibility. It is NOT the definition used for metrics or XP: a saved lead that the
 * user closes or withdraws was never applied to. Use `impliesSubmission` / `countsAsSubmission`
 * for writes and `hasApplied` for reads.
 */
export function isSubmittedStatus(status: ApplicationStatus): boolean {
  return (
    statusRank(status) >= statusRank("SUBMITTED") ||
    status === "REJECTED" ||
    status === "NO_RESPONSE" ||
    status === "WITHDRAWN" ||
    status === "CLOSED"
  );
}

/**
 * Statuses that by themselves prove an application was sent: anything at/after SUBMITTED in the
 * pipeline, plus REJECTED and NO_RESPONSE (an employer can only reject or ignore something you
 * sent). WITHDRAWN and CLOSED are excluded: a saved lead can be withdrawn or closed without ever
 * applying.
 */
export function impliesSubmission(status: ApplicationStatus): boolean {
  return (
    statusRank(status) >= statusRank("SUBMITTED") ||
    status === "REJECTED" ||
    status === "NO_RESPONSE"
  );
}

/**
 * Does reaching `to` record a submission (APPLIED event, application date, XP, daily count)?
 * True when the status itself implies one, or for WITHDRAWN / CLOSED only when there is evidence
 * the application was actually sent: an application date, or a previous submitted status.
 */
export function countsAsSubmission(opts: {
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  appliedAt: Date | null;
}): boolean {
  if (impliesSubmission(opts.to)) return true;
  if (opts.to === "WITHDRAWN" || opts.to === "CLOSED") {
    return (
      opts.appliedAt !== null ||
      (opts.from !== null && impliesSubmission(opts.from))
    );
  }
  return false;
}

/**
 * The single metrics definition of "applied" used by the dashboard, the Numbers game and
 * Analytics: the record has an application date, or an APPLIED event was recorded for it.
 */
export function hasApplied(app: {
  appliedAt: Date | null;
  events: ReadonlyArray<{ type: string }>;
}): boolean {
  return app.appliedAt !== null || app.events.some((e) => e.type === "APPLIED");
}

/**
 * When the application was sent: the application date, else the earliest APPLIED event.
 * Null when the record was never applied (see `hasApplied`).
 */
export function appliedInstant(app: {
  appliedAt: Date | null;
  events: ReadonlyArray<{ type: string; occurredAt: Date }>;
}): Date | null {
  if (app.appliedAt) return app.appliedAt;
  let best: Date | null = null;
  for (const e of app.events) {
    if (e.type !== "APPLIED" || Number.isNaN(e.occurredAt.getTime())) continue;
    if (!best || e.occurredAt.getTime() < best.getTime()) best = e.occurredAt;
  }
  return best;
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
