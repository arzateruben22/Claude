/**
 * Turns a classified email into an `ApplicationObservation` for the ingestion engine.
 *
 * Job alerts, unfinished applications, invitations to apply, unrelated and unknown mail produce no
 * observation. Evidence carries a short PII-masked snippet around the decisive phrase, never the body.
 */
import type { EmailClassification } from "@/generated/prisma/enums";
import type { ApplicationObservation, ObservationKind } from "@/lib/ingest/types";
import type { Classification } from "./classify";
import { isPostingUrl } from "./extract";
import type { ParsedEmail } from "./parse";

export type EmailProvider = "GMAIL" | "OUTLOOK" | "EML" | "MBOX" | "PASTE";
export const EMAIL_PROVIDERS: readonly EmailProvider[] = ["GMAIL", "OUTLOOK", "EML", "MBOX", "PASTE"];

const KIND_BY_CLASS: Partial<Record<EmailClassification, ObservationKind>> = {
  APPLICATION_SUBMITTED: "SUBMITTED",
  EMPLOYER_ACKNOWLEDGMENT: "ACKNOWLEDGED",
  RECRUITER_MESSAGE: "RECRUITER_RESPONSE",
  INTERVIEW_INVITATION: "INTERVIEW_INVITED",
  ASSESSMENT_INVITATION: "ASSESSMENT_INVITED",
  REJECTION: "REJECTED",
  OFFER: "OFFER",
  ONBOARDING: "ONBOARDING",
};

/** Observation kind for a classification; null for JOB_ALERT / INCOMPLETE / INVITATION / UNRELATED / UNKNOWN. */
export function observationKindFor(classification: EmailClassification): ObservationKind | null {
  return KIND_BY_CLASS[classification] ?? null;
}

/** Kinds that may be marked verified when the evidence is strong enough. */
export const VERIFIABLE_KINDS: ReadonlySet<ObservationKind> = new Set(["SUBMITTED", "ACKNOWLEDGED", "REJECTED", "OFFER", "ONBOARDING"]);
export const VERIFY_MIN_CONFIDENCE = 0.9;
export const SNIPPET_MAX = 300;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>()"'\]]+|\bwww\.[^\s<>()"'\]]+/gi;
// (714) 555-0188 · 714-555-0188 · +1 669 555 0100 · 714.555.0188
const PHONE_RE = /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

/** Replace email addresses, phone numbers and URLs (which often carry personal tokens). */
export function maskPii(text: string): string {
  return text.replace(EMAIL_RE, "[email]").replace(URL_RE, "[link]").replace(PHONE_RE, "[phone]");
}

/** ≤ 300-character masked excerpt around `phrase` (or the start of the body when it is not found). */
export function buildSnippet(text: string, phrase: string | null | undefined, max = SNIPPET_MAX): string | null {
  const flat = maskPii(text).replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= max) return flat;
  const needle = phrase ? maskPii(phrase).replace(/\s+/g, " ").trim().toLowerCase() : "";
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1;
  const budget = max - 2; // room for a leading and a trailing ellipsis
  let start = at >= 0 ? Math.max(0, at - Math.floor((budget - Math.min(needle.length, budget)) / 2)) : 0;
  start = Math.min(start, Math.max(0, flat.length - budget));
  const end = Math.min(flat.length, start + budget);
  let snippet = flat.slice(start, end);
  if (start > 0) {
    const sp = snippet.indexOf(" ");
    if (sp >= 0 && sp < 25) snippet = snippet.slice(sp + 1);
    snippet = `…${snippet}`;
  }
  if (end < flat.length) {
    const sp = snippet.lastIndexOf(" ");
    if (sp > snippet.length - 25) snippet = snippet.slice(0, sp);
    snippet = `${snippet}…`;
  }
  return snippet;
}

export type ToObservationOptions = {
  provider: EmailProvider;
  /** Used as observedAt only when the message has no usable date. */
  now?: Date;
};

/** Build the ingestion observation for a classified email, or null when the email is not actionable. */
export function toObservation(
  parsed: ParsedEmail,
  classification: Classification,
  opts: ToObservationOptions,
): ApplicationObservation | null {
  const kind = observationKindFor(classification.classification);
  if (!kind) return null;
  const x = classification.extracted;
  const sender = classification.sender;
  const trustedSender = sender.recognizedPlatform || sender.employerDomain;
  const verified =
    VERIFIABLE_KINDS.has(kind) &&
    classification.confidence >= VERIFY_MIN_CONFIDENCE &&
    trustedSender &&
    !sender.forwarded &&
    !sender.authFailed;

  return {
    kind,
    source: "EMAIL",
    origin: "EMAIL",
    observedAt: sender.sentAt ?? parsed.receivedAt ?? opts.now ?? new Date(),
    company: x.employer,
    title: x.positionTitle,
    location: x.location,
    requisitionId: x.requisitionNumber,
    postingUrl: isPostingUrl(x.applicationUrl) ? x.applicationUrl : null,
    platform: x.platform,
    salaryText: x.salaryText,
    recruiterName: x.recruiterName,
    recruiterEmail: x.recruiterEmail,
    interviewAt: x.interviewAt,
    confidence: classification.confidence,
    verified,
    evidence: {
      kind: "EMAIL",
      sourceRef: `${opts.provider}:${parsed.externalId}`,
      title: parsed.subject,
      snippet: buildSnippet(parsed.text, classification.matchedPhrase),
      data: {
        classification: classification.classification,
        provider: opts.provider,
        senderDomain: sender.domain,
        senderKind: sender.kind,
        forwarded: sender.forwarded,
      },
    },
  };
}
