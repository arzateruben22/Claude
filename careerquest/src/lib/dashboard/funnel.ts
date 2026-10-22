/**
 * Dashboard funnel shape and labels. The stage definitions themselves live in one place —
 * `computeFunnel` / `classifyApplication` in `src/lib/analytics/funnel.ts` — so the Command Center
 * and Analytics always agree (applied = application date or APPLIED event; later stages from
 * status, history, events, interview and offer rows; ACCEPTED counts as hired).
 */
import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/enums";
import type { FunnelCounts as AnalyticsFunnelCounts } from "@/lib/analytics/types";

/** Statuses that keep an application "in play" for follow-ups. */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["SUBMITTED", "CONFIRMED", "SCREENING", "INTERVIEWING", "OFFER"];

export type FunnelCounts = {
  submitted: number;
  responses: number;
  screenings: number;
  interviews: number;
  offers: number;
  hires: number;
};

/** Map the shared Analytics counts onto the dashboard strip's stage names. */
export function dashboardFunnelCounts(c: AnalyticsFunnelCounts): FunnelCounts {
  return {
    submitted: c.applied,
    responses: c.responded,
    screenings: c.screened,
    interviews: c.interviewed,
    offers: c.offers,
    hires: c.hired,
  };
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export const EVENT_LABELS: Record<ApplicationEventType, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  CONFIRMATION_RECEIVED: "Confirmation received",
  RECRUITER_RESPONSE: "Recruiter responded",
  SCREENING_SCHEDULED: "Screening scheduled",
  ASSESSMENT_INVITED: "Assessment invited",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_COMPLETED: "Interview completed",
  OFFER_RECEIVED: "Offer received",
  OFFER_ACCEPTED: "Offer accepted",
  OFFER_DECLINED: "Offer declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  FOLLOW_UP_SENT: "Follow-up sent",
  NOTE_ADDED: "Note added",
  STATUS_CHANGED: "Status changed",
  MERGED: "Merged",
  ONBOARDING_RECEIVED: "Onboarding received",
};
