/**
 * Serializable view models and labels for the review queue (/applications/review). Pure: imported
 * by the server loaders and by client components.
 */
import type {
  ApplicationStatus,
  CaptureKind,
  EmailClassification,
  InterviewType,
} from "@/generated/prisma/enums";
import type { Tone } from "@/components/ui/badge";
import type { MatchSignalEffect } from "./match-score";

export const EMAIL_CLASSIFICATION_LABELS: Record<EmailClassification, string> = {
  APPLICATION_SUBMITTED: "Application submitted",
  EMPLOYER_ACKNOWLEDGMENT: "Employer acknowledgment",
  RECRUITER_MESSAGE: "Recruiter message",
  INTERVIEW_INVITATION: "Interview invitation",
  ASSESSMENT_INVITATION: "Assessment invitation",
  REJECTION: "Rejection",
  OFFER: "Offer",
  ONBOARDING: "Onboarding",
  JOB_ALERT: "Job alert",
  INCOMPLETE_APPLICATION: "Unfinished application",
  APPLICATION_INVITATION: "Invitation to apply",
  UNRELATED: "Not job related",
  UNKNOWN: "Unclassified",
};

export const CAPTURE_KIND_LABELS: Record<CaptureKind, string> = {
  JOB_PAGE: "Job posting",
  APPLY_STARTED: "Application started",
  CONFIRMATION_PAGE: "Confirmation page",
  MANUAL_CONFIRMATION: "You marked it submitted",
  SHARED_URL: "Shared link",
};

export type SignalView = { label: string; effect: MatchSignalEffect };

export type ReviewCandidateView = {
  applicationId: string;
  companyName: string;
  positionTitle: string;
  location: string | null;
  status: ApplicationStatus;
  statusVerified: boolean;
  sourceLabel: string;
  /** "Applied Jan 12, 2026" / "Saved Jan 18, 2026". */
  dateLabel: string;
  archived: boolean;
  score: number;
  signals: SignalView[];
};

export type ReviewFieldsView = {
  company: string;
  title: string;
  location: string;
  status: ApplicationStatus;
  /** `datetime-local` value in the user's timezone, or "". */
  interviewAt: string;
  interviewType: InterviewType;
};

export type EmailReviewItemView = {
  id: string;
  subject: string;
  from: string;
  receivedLabel: string;
  classificationLabel: string;
  confidence: number;
  /** The producer judged the sender authentic (platform / employer domain, no forward, no auth failure). */
  verifiedSender: boolean;
  /** Why it is waiting for the user. */
  reason: string | null;
  snippet: string | null;
  /** Minimized body kept only while the row awaits review. */
  body: string | null;
  isInterview: boolean;
  fields: ReviewFieldsView;
  candidates: ReviewCandidateView[];
};

export type InterviewInviteView = {
  emailId: string;
  applicationId: string;
  companyName: string;
  positionTitle: string;
  subject: string;
  receivedLabel: string;
  interviewAtLabel: string;
  interviewAt: string;
  interviewType: InterviewType;
};

export type CaptureReviewItemView = {
  id: string;
  kindLabel: string;
  /** http(s) URL safe to link, or null. */
  url: string | null;
  urlLabel: string;
  platformLabel: string;
  capturedLabel: string;
  confidence: number;
  pageTitle: string | null;
  confirmationText: string | null;
  salaryText: string | null;
  /** The capture only shows the application was started; the user decides whether it was sent. */
  applyStartedOnly: boolean;
  fields: ReviewFieldsView;
  candidates: ReviewCandidateView[];
};

export type DuplicateSideView = {
  id: string;
  companyName: string;
  positionTitle: string;
  location: string | null;
  status: ApplicationStatus;
  statusVerified: boolean;
  sourceLabel: string;
  appliedLabel: string | null;
  createdLabel: string;
  createdViaLabel: string;
  evidenceCount: number;
  interviewCount: number;
  archived: boolean;
};

export type DuplicateReviewItemView = {
  id: string;
  score: number;
  signals: SignalView[];
  a: DuplicateSideView;
  b: DuplicateSideView;
  suggestedKeepId: string;
};

export type AttachOption = { id: string; label: string };

export type ReviewCounts = { emails: number; captures: number; duplicates: number };

export function percent(n: number): string {
  return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
}

/** Match strength wording (visible text, not color only). */
export function matchStrength(score: number): { label: string; tone: Tone } {
  if (score >= 0.9) return { label: "Likely the same job", tone: "success" };
  if (score >= 0.65) return { label: "Possible match", tone: "warning" };
  return { label: "Weak match", tone: "neutral" };
}

export function confidenceTone(c: number): Tone {
  if (c >= 0.8) return "success";
  if (c >= 0.6) return "warning";
  return "danger";
}

export function signalTone(effect: MatchSignalEffect): Tone {
  switch (effect) {
    case "strong":
    case "positive":
      return "success";
    case "negative":
      return "danger";
    default:
      return "neutral";
  }
}

export const SIGNAL_PREFIX: Record<MatchSignalEffect, string> = {
  strong: "✓",
  positive: "+",
  neutral: "·",
  negative: "−",
};
