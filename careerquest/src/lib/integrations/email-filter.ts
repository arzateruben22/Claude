/**
 * What the mailbox syncs are allowed to look at. Pure (no DB, no network).
 *
 * The Gmail sync sends `buildGmailQuery()` to Google so only matching messages are ever fetched. The
 * Outlook sync cannot express the same filter in Graph, so it fetches the date window and discards
 * every message that fails `isLikelyJobEmail()` before parsing or storing anything.
 *
 * Mixed HR/payroll domains (ADP, Workday's employee tenant) are deliberately excluded from the sender
 * list: their mail only qualifies through an application-related subject, so pay statements and HR
 * notices are never read.
 */
import { senderInfo } from "@/lib/email/platforms";

/** Senders that only send recruiting mail. LinkedIn is narrowed to its jobs mailbox. */
export const JOB_SENDERS = [
  "indeed.com",
  "indeedemail.com",
  "jobs-noreply@linkedin.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "myworkdayjobs.com",
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "smartrecruiters.com",
  "smartrecruitersmail.com",
  "icims.com",
  "governmentjobs.com",
  "neogov.com",
  "usajobs.gov",
  "taleo.net",
  "successfactors.com",
  "jobvite.com",
  "applytojob.com",
  "workablemail.com",
  "ashbyhq.com",
  "hirevue.com",
] as const;

export const JOB_SUBJECT_TERMS = ["application", "applying", "interview", "offer", "assessment"] as const;

const SUBJECT_RE = /\b(application|applications|applying|applied|interview|interviews|interviewing|offer|assessment)\b/i;
const MIXED_HR_DOMAIN = /(^|\.)(adp\.com|myworkday\.com|workday\.com)$/i;

/** Gmail search query: recruiting senders OR job-related subjects, newer than `days`, no chats. */
export function buildGmailQuery(days: number): string {
  const d = Math.max(1, Math.min(3650, Math.floor(days)));
  const from = JOB_SENDERS.join(" OR ");
  const subject = JOB_SUBJECT_TERMS.join(" OR ");
  return `newer_than:${d}d -in:chats (from:(${from}) OR subject:(${subject}))`;
}

/** Local equivalent of the Gmail query (used for Outlook, and as a safety net). */
export function isLikelyJobEmail(input: { fromAddress: string | null; fromName?: string | null; subject: string | null }): boolean {
  if (input.subject && SUBJECT_RE.test(input.subject)) return true;
  const address = input.fromAddress?.toLowerCase() ?? "";
  if (!address) return false;
  const info = senderInfo(address, input.fromName ?? null);
  if (info.domain && MIXED_HR_DOMAIN.test(info.domain)) return false;
  if (address === "jobs-noreply@linkedin.com") return true;
  if (info.domain && /(^|\.)linkedin\.com$/.test(info.domain)) return false; // social notifications
  return info.recognizedPlatform || info.kind === "assessment" || info.kind === "union";
}
