/**
 * How funnel stages are derived from application state. Pure constants + helpers so the query
 * module and tests agree on definitions.
 *
 * An application "reached" a stage when its current status is at/after that stage, or its status
 * history shows it was ever at/after that stage, or an event of that stage type was recorded.
 */
import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/enums";

export type FunnelStage = "responses" | "screenings" | "interviews" | "offers" | "hires";

export const SUBMITTED_STATUSES: ApplicationStatus[] = [
  "SUBMITTED",
  "CONFIRMED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
  "CLOSED",
];

/** Statuses that keep an application "in play" for follow-ups. */
export const ACTIVE_STATUSES: ApplicationStatus[] = ["SUBMITTED", "CONFIRMED", "SCREENING", "INTERVIEWING", "OFFER"];

export const STAGE_STATUSES: Record<FunnelStage, ApplicationStatus[]> = {
  responses: ["SCREENING", "INTERVIEWING", "OFFER", "ACCEPTED", "HIRED", "REJECTED"],
  screenings: ["SCREENING", "INTERVIEWING", "OFFER", "ACCEPTED", "HIRED"],
  interviews: ["INTERVIEWING", "OFFER", "ACCEPTED", "HIRED"],
  offers: ["OFFER", "ACCEPTED", "HIRED"],
  hires: ["HIRED"],
};

export const STAGE_EVENTS: Record<FunnelStage, ApplicationEventType[]> = {
  responses: [
    "RECRUITER_RESPONSE",
    "SCREENING_SCHEDULED",
    "ASSESSMENT_INVITED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "OFFER_RECEIVED",
    "OFFER_ACCEPTED",
    "REJECTED",
  ],
  screenings: ["SCREENING_SCHEDULED", "ASSESSMENT_INVITED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "OFFER_RECEIVED", "OFFER_ACCEPTED"],
  interviews: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "OFFER_RECEIVED", "OFFER_ACCEPTED"],
  offers: ["OFFER_RECEIVED", "OFFER_ACCEPTED"],
  hires: [],
};

export const FUNNEL_STAGES: FunnelStage[] = ["responses", "screenings", "interviews", "offers", "hires"];

export type FunnelCounts = {
  submitted: number;
  responses: number;
  screenings: number;
  interviews: number;
  offers: number;
  hires: number;
};

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
