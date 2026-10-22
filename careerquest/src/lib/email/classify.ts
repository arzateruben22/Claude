/**
 * Deterministic job-search email classifier.
 *
 * 1. Build views of the message: subject, main body (quoted replies removed, forwarded content
 *    unwrapped, URLs removed) and the effective sender (the original sender of a forward).
 * 2. Score every class with weighted phrase families (noisy-OR of the rules that fire). Phrases in the
 *    subject or the opening of the body count fully; deep matches (listings, footers) count less.
 *    Per-class neutralizers remove phrases that look like a signal but are not (hypothetical or past
 *    interviews, "offer the position to another candidate", "accepting your offer" …).
 * 3. Decide with explicit precedence: unfinished applications and invitations to apply are never
 *    submissions; job-alert digests win over listings that mention applications; offer / rejection /
 *    onboarding / interview / assessment beat "thank you for applying"; otherwise received vs recruiter.
 *    Received-style mail from a job board or ATS is APPLICATION_SUBMITTED, from the employer itself
 *    EMPLOYER_ACKNOWLEDGMENT.
 * 4. Calibrate confidence from the winning score, the sender, and the strongest competing class.
 * 5. Extract fields (employer, title, requisition, platform, interview time, recruiter …).
 *
 * An optional AI classifier can be consulted for low-confidence results (see classifyEmailWithOptionalAi).
 */
import type { ApplicationSource, EmailClassification } from "@/generated/prisma/enums";
import type { ParsedEmail } from "./parse";
import { domainMatchesEmployer, senderInfo, type SenderInfo, type SenderKind } from "./platforms";
import {
  extractApplicationUrl,
  extractEmployer,
  extractLocation,
  extractRecruiter,
  extractRequisition,
  extractSalary,
  extractTitle,
  personFromDisplayName,
  softUnwrap,
  type ExtractionInput,
} from "./extract";
import { extractAppointment, findDateTimes } from "./datetime";

export type ExtractedFields = {
  employer: string | null;
  positionTitle: string | null;
  requisitionNumber: string | null;
  platform: ApplicationSource | null;
  location: string | null;
  salaryText: string | null;
  interviewAt: Date | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  applicationUrl: string | null;
};

export type ClassificationSender = {
  address: string | null;
  domain: string | null;
  kind: SenderKind;
  /** A job board or applicant-tracking system sent it. */
  recognizedPlatform: boolean;
  /** The sender's domain belongs to the extracted employer. */
  employerDomain: boolean;
  /** The message is a forward; the sender facts describe the original sender. */
  forwarded: boolean;
  /** When the (original) message was sent: the Date header, or the forwarded block's date. */
  sentAt: Date | null;
  /** The receiving server recorded a DMARC/DKIM/SPF failure for this message (never verified then). */
  authFailed: boolean;
};

export type EmailClassificationResult = {
  classification: EmailClassification;
  /** 0..1 */
  confidence: number;
  /** Human-readable reasons ("REJECTION:moved-forward-with-others", "sender:ats:WORKDAY" …). */
  signals: string[];
  extracted: ExtractedFields;
  /** The decisive phrase as it appears in the message (used for evidence snippets). */
  matchedPhrase: string | null;
  sender: ClassificationSender;
};

/** Name used by the AI hook contract. */
export type Classification = EmailClassificationResult;

/** Classes whose observation counts as a completed submission. */
export const SUBMISSION_CLASSES: ReadonlySet<EmailClassification> = new Set(["APPLICATION_SUBMITTED", "EMPLOYER_ACKNOWLEDGMENT"]);
/** Classes that must never be turned into a submission (by rules or by AI). */
export const NEVER_SUBMISSION_CLASSES: ReadonlySet<EmailClassification> = new Set([
  "JOB_ALERT",
  "INCOMPLETE_APPLICATION",
  "APPLICATION_INVITATION",
]);

// ---------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------

type Views = {
  subject: string;
  /** Main body with line structure (URLs removed, soft-wrapped lines joined). */
  body: string;
  /** Body collapsed to single spaces. */
  flat: string;
  forwarded: boolean;
  fromAddress: string | null;
  fromName: string | null;
  receivedAt: Date | null;
};

const FORWARD_MARKER =
  /^[ \t>]*(?:-{2,}\s*(?:Forwarded message|Original Message|Forwarded Message)\s*-{2,}|Begin forwarded message:?|-{5,}\s*Forwarded by.*)\s*$/im;
const HEADER_LINE = /^[ \t>]*(From|Sent|Date|To|Cc|Subject|Reply-To)\s*:\s*(.*)$/i;

function parseAddress(value: string): { address: string | null; name: string | null } {
  const addr =
    /<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(value)?.[1] ??
    /\[mailto:([^\]\s]+)\]/i.exec(value)?.[1] ??
    /([^\s<>"'[\]]+@[^\s<>"'[\]]+)/.exec(value)?.[1] ??
    null;
  const name = value
    .replace(/<[^>]*>|\[mailto:[^\]]*\]/gi, "")
    .replace(addr ?? "\u0000", "")
    .replace(/["']/g, "")
    .trim();
  return { address: addr ? addr.toLowerCase() : null, name: name || null };
}

/**
 * Date line of a forwarded block. With an explicit offset/zone it is parsed as-is; client-formatted
 * dates without a zone ("Tue, Mar 3, 2026 at 10:15 AM") are read as Pacific wall-clock time, like
 * every other zone-less time in this module (never the server's own timezone).
 */
function parseDateLoose(value: string): Date | null {
  const cleaned = value.replace(/\([^)]*\)/g, " ").replace(/\s+at\s+/i, " ").trim();
  if (/[+-]\d{2}:?\d{2}\b|\b(GMT|UTC)\b|\dZ\b/.test(cleaned)) {
    const d = new Date(cleaned);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return findDateTimes(value, null)[0]?.at ?? null;
}

/** Unwrap "---------- Forwarded message ---------" blocks: original sender, subject, date and body. */
function unwrapForward(text: string, subjectIsForward: boolean) {
  const marker = FORWARD_MARKER.exec(text);
  let start = marker ? marker.index + marker[0].length : -1;
  if (start < 0 && subjectIsForward) {
    // No marker line: a header block ("From: … / Subject: …") near the top still identifies the original.
    const m = /^[ \t>]*From\s*:\s*.+$/im.exec(text);
    if (m && m.index < 1500) start = m.index;
  }
  if (start < 0) return null;
  const lines = text.slice(start).split("\n");
  let i = 0;
  while (i < lines.length && !lines[i]!.replace(/^[ \t>]*/, "").trim()) i++;
  const headers: Record<string, string> = {};
  let headerCount = 0;
  for (; i < lines.length; i++) {
    const m = HEADER_LINE.exec(lines[i]!);
    if (!m) break;
    headers[m[1]!.toLowerCase()] = m[2]!.trim();
    headerCount++;
  }
  if (!headerCount || (!headers.from && !headers.subject)) return null;
  let bodyLines = lines.slice(i);
  const quoted = bodyLines.filter((l) => l.trim()).filter((l) => /^\s*>/.test(l)).length;
  if (quoted > bodyLines.filter((l) => l.trim()).length / 2) bodyLines = bodyLines.map((l) => l.replace(/^\s*>\s?/, ""));
  const from = headers.from ? parseAddress(headers.from) : { address: null, name: null };
  const date = headers.date ?? headers.sent;
  return {
    subject: headers.subject ?? null,
    fromAddress: from.address,
    fromName: from.name,
    receivedAt: date ? parseDateLoose(date) : null,
    body: bodyLines.join("\n").trim(),
  };
}

/** Remove quoted reply history ("On … wrote:", Outlook headers, ">" lines). Signatures are kept. */
function stripQuotedReply(text: string): string {
  const cuts = [
    /^[ \t]*On\b[^\n]{0,200}\bwrote:[ \t]*$/m,
    /^[ \t]*On\b[^\n]{0,200}\n[^\n]{0,200}\bwrote:[ \t]*$/m,
    /^[ \t]*-{2,}\s*Original Message\s*-{2,}/im,
    /^[ \t]*From:\s.+\n[ \t]*(?:Sent|Date):\s/m,
    /^[ \t]*_{20,}[ \t]*$/m,
  ];
  let end = text.length;
  for (const re of cuts) {
    const m = re.exec(text);
    if (m && m.index > 0 && m.index < end) end = m.index;
  }
  return text
    .slice(0, end)
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

function stripUrls(text: string): string {
  return text
    .replace(/\bhttps?:\/\/[^\s<>()"'\]]+/gi, " ")
    .replace(/\bwww\.[^\s<>()"'\]]+/gi, " ")
    .replace(/\[\s*\]|\(\s*\)|<\s*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ +\n/g, "\n");
}

function buildViews(parsed: ParsedEmail): Views {
  let subject = parsed.subject ?? "";
  let text = parsed.text ?? "";
  let fromAddress = parsed.fromAddress;
  let fromName = parsed.fromName;
  let receivedAt = parsed.receivedAt;
  const subjectIsForward = /^\s*((re|aw|sv)\s*:\s*)*(fwd?|fw|wg|tr)\s*:/i.test(subject);
  let forwarded = false;
  const inner = unwrapForward(text, subjectIsForward);
  if (inner && (subjectIsForward || FORWARD_MARKER.test(text))) {
    forwarded = true;
    subject = inner.subject ?? subject;
    fromAddress = inner.fromAddress ?? fromAddress;
    fromName = inner.fromName ?? fromName;
    receivedAt = inner.receivedAt ?? receivedAt;
    text = inner.body;
  } else {
    if (subjectIsForward) forwarded = true;
    text = stripQuotedReply(text);
  }
  subject = subject.replace(/^\s*((re|fwd?|fw|aw|wg|sv|tr)\s*:\s*)+/i, "").trim();
  const body = softUnwrap(stripUrls(text))
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    subject,
    body,
    flat: body.replace(/\s+/g, " "),
    forwarded,
    fromAddress,
    fromName,
    receivedAt,
  };
}

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

type Where = "subject" | "body" | "both";
type Rule = { id: string; re: RegExp; w: number; where?: Where; lines?: boolean };

/** Characters of the (flattened) body that count as its opening. */
const LEAD_CHARS = 800;
/** Weight factor for matches deep in the body (listings, footers). */
const DEEP_FACTOR = 0.7;

/** Internal score buckets; RECEIVED becomes APPLICATION_SUBMITTED or EMPLOYER_ACKNOWLEDGMENT by sender. */
type Bucket =
  | "RECEIVED"
  | "RECRUITER_MESSAGE"
  | "INTERVIEW_INVITATION"
  | "ASSESSMENT_INVITATION"
  | "REJECTION"
  | "OFFER"
  | "ONBOARDING"
  | "JOB_ALERT"
  | "INCOMPLETE_APPLICATION"
  | "APPLICATION_INVITATION"
  | "UNRELATED";

const RULES: Record<Bucket, Rule[]> = {
  RECEIVED: [
    { id: "subj-application-received", where: "subject", w: 0.6, re: /\b(application|candidacy)\b[^.!?]{0,60}\b(submitted|sent|received|complete|completed|confirmed|confirmation|acknowledg(e)?ment|acknowledged)\b/i },
    { id: "subj-received-your-application", where: "subject", w: 0.6, re: /\b(received|submitted|sent|confirm(ing|ed)?)\b[^.!?]{0,20}\b(your )?application\b/i },
    { id: "subj-thanks-for-applying", where: "subject", w: 0.6, re: /\bthank(s| you)\b[^.!?]{0,20}\b(applying|your application)\b/i },
    { id: "application-was-received", w: 0.7, re: /\byour (job )?(application|resume|résumé|cv|submission)\b[^.!?]{0,80}?\b(has been|was|have been|is)( now)?( successfully)? (submitted|sent|received|delivered|completed)\b/i },
    { id: "we-received-your-application", w: 0.7, re: /\b(we('ve| have)?|has|have|i('ve| have)?)( successfully| just| already)? (received|got|gotten) your (job )?(application|resume|résumé|cv|submission)\b|\b(acknowledge|confirm|confirming|acknowledging) (the )?receipt of your (job )?(application|resume|résumé|cv|submission)\b/i },
    { id: "confirms-your-application", w: 0.6, re: /\b(this|the) (e-?mail|message|note|letter) (is to )?(confirms?|confirming|acknowledges?|let(s)? you know)\b[^.!?]{0,40}\byour (application|submission)\b/i },
    { id: "application-reached-team", w: 0.5, re: /\byour (application|resume|résumé)\b[^.!?]{0,80}\b(made it to|reached|is with|has been (forwarded|passed|sent) to|was (forwarded|passed) to)\b[^.!?]{0,30}\b(hiring|recruiting|talent|hr|selection) (team|manager|department)/i },
    { id: "forwarded-for-review", w: 0.35, re: /\b(forwarded|passed|shared|sent)\b[^.!?]{0,40}\b(to|with)\b[^.!?]{0,60}\bfor (review|consideration)\b/i },
    { id: "application-reviewed", w: 0.35, re: /\byour application\b[^.!?]{0,80}\b(has been|was) (reviewed|forwarded|shared|passed along)\b/i },
    { id: "thanks-for-applying", w: 0.45, re: /\bthank(s| you)( so much)? for (applying|your application|submitting your application|your submission)\b/i },
    { id: "status-received", w: 0.5, re: /\b(application )?status\s*:?\s*(received|submitted|in review|under review|application received)\b/i },
    { id: "date-applied", w: 0.4, re: /\b(date (submitted|applied|received)|application date|submitted on|applied on|applied \d+ (seconds?|minutes?|hours?|days?) ago)\b/i },
    { id: "received-label", lines: true, w: 0.3, re: /^(received|submitted|applied)\s*:\s*\S/im },
    { id: "track-application", w: 0.25, re: /\b(track|check|view|monitor)\b[^.!?]{0,30}\b(status of )?your applications?\b|\bstatus of your application\b/i },
    { id: "you-applied", w: 0.2, re: /\byou( have|'ve)? applied (to|for)\b/i },
    { id: "under-review", w: 0.45, re: /\b(is|are|now|currently) (now |currently )?(under|in) review\b/i },
    { id: "passed-screening", w: 0.3, re: /\b(met|meet|meets|passed) (our|the) (initial |minimum )?(screening|qualifications?|requirements|criteria)\b/i },
  ],
  INCOMPLETE_APPLICATION: [
    { id: "not-finished", w: 0.8, re: /\b(haven'?t|have not|hasn'?t|has not|didn'?t|did not|not yet|never)( yet)? (finish(ed)?|complete[d]?|submit(ted)?)\b[^.!?]{0,40}?\b(your |the |this )?(application|it)\b/i },
    { id: "started-not-finished", w: 0.8, re: /\bstarted (an?|your) (job )?application\b[^.!?]{0,40}\b(but|and)\b[^.!?]{0,20}\b(didn'?t|did not|haven'?t|have not|not)\b/i },
    { id: "started-application", w: 0.5, re: /\b(you )?(recently )?started (an?|your) (job )?application\b|\b(you )?(recently )?started applying\b/i },
    { id: "finish-your-application", w: 0.55, re: /\b(finish|complete|continue|resume)( and submit)? your (job )?(application|draft)\b|\b(finish|complete) applying\b|\bpick up where you left off\b/i },
    { id: "progress-saved", w: 0.35, re: /\b(your )?(progress|answers|draft|application)( so far)? (has|have|will|is) (been |be )?saved\b/i },
    { id: "application-incomplete", w: 0.6, re: /\byour application (is|was) (still )?(incomplete|not (yet )?(complete|completed|finished|submitted))\b|\bincomplete application\b|\bunfinished application\b|\bapplications? (that )?(have|has) not (yet )?been submitted\b/i },
    { id: "subj-incomplete", where: "subject", w: 0.6, re: /\b(haven'?t|didn'?t|did not|have not) (yet )?(finish(ed)?|complete[d]?|submit(ted)?)\b|\b(finish|complete|continue) (your application|applying)\b|\bincomplete application\b/i },
  ],
  APPLICATION_INVITATION: [
    { id: "invited-to-apply", w: 0.8, re: /\b(invited|invites|inviting|invite) you to apply\b|\binvitation to apply\b/i },
    { id: "profile-matches", w: 0.5, re: /\byour (profile|background|experience|resume|résumé|skills)\b[^.!?]{0,20}\b(match|matches|is a (great|good|strong) match)\b/i },
    { id: "great-fit-apply", w: 0.45, re: /\byou('d| would| could| might) be a (great|good|strong|perfect) (fit|match)\b[^.!?]{0,80}\bapply\b|\bwe('d| would) (love|like) to see your application\b/i },
    { id: "wants-you-to-apply", w: 0.4, re: /\b(recruiter|employer|hiring team|company)\b[^.!?]{0,40}\b(wants|would like|asked) you to apply\b/i },
    { id: "apply-cta", w: 0.1, re: /\b(apply now|apply today|easily apply|easy apply|quick apply|1-click apply)\b/i },
  ],
  JOB_ALERT: [
    { id: "subj-digest", where: "subject", w: 0.7, re: /\b\d+\+?\s+(new|more|recommended|matching)\b|\b\d+\+?\s+(jobs|openings)\b|\b(jobs?|openings) for you\b|\bnew (\S+ ){0,4}jobs?\b|\bjob alert\b|\bjobs? you (may|might) (like|be interested in)\b|\brecommended jobs?\b|\bjobs (in|near) [A-Z]/i },
    { id: "job-alert", where: "body", w: 0.55, re: /\bjob alerts?\b|\balert emails?\b/i },
    { id: "jobs-you-may-like", where: "body", w: 0.6, re: /\bjobs? (you|that) (may|might|could) (like|be interested in|want)\b|\bjobs? (recommended|picked) for you\b|\brecommended for you\b|\btop jobs for you\b/i },
    { id: "new-jobs-for", where: "body", w: 0.5, re: /\b(\d+ )?new jobs? (for|matching|that match|in|near|within)\b|\b\d+ new (\S+ ){0,3}jobs?\b/i },
    { id: "jobs-match-search", where: "body", w: 0.5, re: /\bjobs? match(es|ing)? your (search|preferences|alert|criteria|saved search)\b|\bbased on your (saved )?(search|preferences|job alert)\b/i },
    { id: "see-all-jobs", where: "body", w: 0.45, re: /\b(see|view|browse) (all|more) (\d+ )?(new |matching |similar )?jobs\b/i },
    { id: "alert-subscription", where: "body", w: 0.6, re: /\b(created|subscribed to|set up|signed up for) (a |an |your )?(job )?alerts?\b|\b(manage|edit|update) (your )?(job )?alerts?\b|\balerts are sent (daily|weekly)\b/i },
  ],
  RECRUITER_MESSAGE: [
    { id: "i-am-recruiter", w: 0.5, re: /\bI('m| am) (a |the |an )?(\w+ ){0,2}recruit(er|ing)\b|\bI('m| am) on the (recruiting|talent|hiring) team\b|\bI (lead|run|handle|manage) (\w+ ){0,2}recruit/i },
    { id: "reaching-out", w: 0.25, re: /\b(reaching|reach) out\b/i },
    { id: "quick-call", w: 0.35, re: /\b(quick|brief|short|informal|\d+-minute|\d+ minute) (phone )?(call|chat|conversation|phone call)\b/i },
    { id: "availability", w: 0.35, re: /\b(your|current) availability\b|\bwhat does your schedule look like\b|\blet me know (a few|some|what) (days|times|days\/times)\b|\bwhen (are you|would you be) available\b/i },
    { id: "best-number", w: 0.35, re: /\bbest (phone )?number to reach you\b|\bbest way to reach you\b/i },
    { id: "open-to", w: 0.3, re: /\b(would|are) you (be )?(open|interested|available)\b/i },
    { id: "came-across", w: 0.3, re: /\b(came across|found|saw|reviewed) your (application|profile|resume|résumé)\b|\byour (profile|resume|résumé) (came up|caught my eye|stood out)\b/i },
    { id: "staffing", w: 0.3, re: /\bstaffing (agency|firm|coordinator|company)\b|\bcontract-to-hire\b|\binmail\b/i },
    { id: "subj-outreach", where: "subject", w: 0.3, re: /\binterested\?|\bare you available\b|\bquick question\b|\blet'?s (find a time|chat|connect|talk)\b|\bopportunit(y|ies)\b/i },
    { id: "openings", w: 0.1, re: /\bopenings?\b|\bopportunit(y|ies)\b/i },
  ],
  INTERVIEW_INVITATION: [
    { id: "invite-to-interview", w: 0.7, re: /\b(invite|invited|inviting)\b[^.!?]{0,20}\byou\b[^.!?]{0,10}\b(to|for)\b[^.!?]{0,30}\binterview\b|\b(would|'d) (like|love) to (meet|interview|speak with|talk with) you\b[^.!?]{0,30}\binterview\b/i },
    { id: "schedule-interview", w: 0.6, re: /\b(schedule|book|pick|choose|select|reserve)\b[^.!?]{0,15}\b(an?|your|the)\b[^.!?]{0,25}\b(interview|phone screen|screening call)\b/i },
    { id: "scheduled-for-interview", w: 0.7, re: /\b(have been|are|been|you're|you are) (scheduled|selected|confirmed|booked) for (an?|your|the)\b[^.!?]{0,25}\binterview\b/i },
    { id: "interview-confirmation", w: 0.65, re: /\binterview (confirmation|invitation|invite|details|appointment|scheduled|request)\b|\bnotice of (an? )?interview\b|\b(confirm(ing|ation of)?|scheduling) (your|an|the) interview\b/i },
    { id: "your-interview", w: 0.45, re: /\b(your|an?|the) (upcoming |scheduled )?(in-person|onsite|on-site|video|phone|virtual|panel|oral|final|second|first|technical|zoom|teams) interview\b/i },
    { id: "interview-date-label", w: 0.5, re: /\binterview (date|time|location)\s*:/i },
    { id: "meeting-details", w: 0.25, re: /\b(join (link|url|the (meeting|call|interview))|meeting id|passcode|dial-in|teams meeting|google meet|webex)\b/i },
    { id: "when-label", w: 0.15, re: /\b(when|time)\s*:\s*\S/i },
    { id: "meeting-you", w: 0.2, re: /\blooking forward to (meeting|speaking with|talking (with|to)|seeing) you\b|\bsee you (on )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|then|soon)\b/i },
    { id: "interviewers", w: 0.25, re: /\binterview(ers| panel)\b/i },
    { id: "phone-screen", w: 0.3, re: /\bphone (screen|interview)\b|\bscreening call\b/i },
    { id: "come-in-for-interview", w: 0.6, re: /\b(come in|stop by|join us) for (an?|your) (\w+ )?interview\b|\bavailable for (an?|your) (\w+ )?interview (on|at)\b/i },
    { id: "booking", w: 0.3, re: /\b(once|after) you (book|schedule|pick|select)\b/i },
    { id: "reschedule", w: 0.2, re: /\b(need|have) to reschedule\b|\bcannot attend\b|\bonly one reschedule\b/i },
    { id: "confirm-attendance", w: 0.2, re: /\b(reply|respond)\b[^.!?]{0,15}\bconfirm\b[^.!?]{0,30}\b(make (this|that|the) time|attendance|this time)\b/i },
    { id: "subj-interview", where: "subject", w: 0.35, re: /\binterview\b|\bphone screen\b/i },
  ],
  ASSESSMENT_INVITATION: [
    { id: "invited-to-complete", w: 0.7, re: /\b(invit(ed|e|es|ing) you|asked you|ask you|like you|need you|required|requested|please)\b[^.!?]{0,30}\b(to )?(complete|take|finish|begin|start)\b[^.!?]{0,60}\b(assessments?|tests?|evaluations?|questionnaires?|exams?|challenges?|video interview)\b/i },
    { id: "one-way-video", w: 0.55, re: /\bon-?demand (video )?interview\b|\bone-?way (video )?interview\b|\brecorded (video )?(questions|responses|interview)\b|\bpre-?recorded (video )?interview\b/i },
    { id: "start-assessment", w: 0.6, re: /\b(start|begin|take|launch|access) (your|the) (online |skills |pre-employment )?(assessment|test|evaluation|exam|challenge)\b/i },
    { id: "scheduled-to-take", w: 0.7, re: /\byou (are|have been|were) scheduled to take\b|\b(accepted|approved|eligible|selected) for testing\b/i },
    { id: "test-date-label", w: 0.5, re: /\b(test|testing|assessment|exam) (date|appointment|session|time|location)\s*:/i },
    { id: "subj-assessment", where: "subject", w: 0.55, re: /\b(assessment|aptitude test|skills test|test appointment|testing appointment|coding challenge|online test|exam appointment|questionnaire)\b/i },
    { id: "deadline", w: 0.2, re: /\bdeadline\s*:|\bcomplete (it )?(by|within)\b|\bexpires? (on|in)\b/i },
    { id: "next-step-assessment", w: 0.5, re: /\bnext step (is|will be|in (the|our) process is) (a|an|the|to complete)\b[^.!?]{0,40}\b(assessment|test|challenge|questionnaire|evaluation)\b/i },
    { id: "aptitude-mention", w: 0.15, re: /\b(aptitude|skills?|technical|cognitive|personality|mechanical reasoning|pre-employment) (test|assessment|evaluation)s?\b/i },
  ],
  REJECTION: [
    { id: "unfortunately", w: 0.35, re: /\b(unfortunately|regrettably)\b/i },
    { id: "regret", w: 0.6, re: /\b(regret|sorry) to (inform|let you know|tell you)\b/i },
    { id: "moved-forward-with-others", w: 0.85, re: /\b(decided|chosen|chose|elected|opted|going|decision) (to )?(move|proceed|go|continue|moving|proceeding)( forward)? with (other|another|a different|candidates)\b|\b(decided|chosen|chose|elected|opted|going) to (pursue|interview|hire|select) (other|another|a different|more qualified) (candidates?|applicants?|individuals?)\b/i },
    { id: "position-to-another", w: 0.85, re: /\b(offer(ed)?|extend(ed)?|give|gave|award(ed)?) the\b[^.!?]{0,60}?\b(position|role|job|opportunity) to (another|a different|other) (candidate|applicant|person)s?\b/i },
    { id: "other-candidates", w: 0.5, re: /\b(other|another) (candidates?|applicants?) (whose|who)\b|\bmore closely match(es)?\b/i },
    { id: "position-filled", w: 0.8, re: /\b(position|role|job|opening|requisition|vacancy) (has been|was|is now|has now been|is) (filled|closed|cancel(l)?ed|put on hold)\b/i },
    { id: "closed-requisition", w: 0.5, re: /\b(we have|we've) (closed|cancel(l)?ed|filled) (the|this) (requisition|position|role|posting)\b/i },
    { id: "no-longer-considered", w: 0.8, re: /\b(no longer|not) (under|being) consider(ed|ation)\b/i },
    { id: "not-moving-forward", w: 0.75, re: /\b(won'?t|will not|are not|aren'?t|not|unable to|cannot|can'?t)( to)? (be )?(moving|move|proceed(ing)?) (your application |you |your candidacy |with your (application|candidacy) )?forward\b|\bnot (be )?(moving|proceeding) (forward )?with your (application|candidacy)\b/i },
    { id: "not-selected", w: 0.6, re: /\b(were|was|have|has|been) not (been )?selected\b|\bnot to (move|proceed) forward\b|\bdecided not to (proceed|move forward|pursue|continue|offer)\b/i },
    { id: "unsuccessful", w: 0.8, re: /\byour (application|candidacy) (was|has been|is) (unsuccessful|declined|rejected|not successful)\b/i },
    { id: "status-rejected", w: 0.85, re: /\bstatus\b[^.!?\n]{0,60}?(:|\bto\b:?)\s*(rejected|declined|not selected|disqualified|no longer under consideration|not moving forward|closed|position filled|unsuccessful)\b/i },
    { id: "careful-consideration", w: 0.3, re: /\bafter (careful|thoughtful) (consideration|review)\b/i },
    { id: "on-file", w: 0.2, re: /\bkeep your (resume|résumé|application|information|details|profile) on file\b/i },
    { id: "best-wishes", w: 0.15, re: /\bwish you (the best|(continued )?success|luck|all the best)\b|\bbest of luck\b|\bpaths cross again\b/i },
    { id: "future-openings", w: 0.2, re: /\b(encourage|invite) you to (apply|review)\b[^.!?]{0,40}\b(future|other|open) (openings|positions|roles|opportunities)\b/i },
  ],
  OFFER: [
    { id: "pleased-to-offer", w: 0.85, re: /\b(pleased|happy|delighted|excited|thrilled|glad) to (formally )?(offer|extend) you\b|\b(would|'d) like to (formally )?offer you (the|a|this|our)\b|\b(are|am) (pleased to be )?offering you (the|a|this) (position|role|job)\b/i },
    { id: "offer-of-employment", w: 0.7, re: /\b(offer of employment|employment offer|job offer)\b/i },
    { id: "extend-offer", w: 0.75, re: /\b(extend|make|making|extending) (you )?(an? |our )?(formal |conditional |verbal |written |contingent )?(job )?offer\b/i },
    { id: "conditional-offer", w: 0.6, re: /\b(conditional|contingent) offer\b/i },
    { id: "offer-letter", w: 0.4, re: /\boffer letter\b/i },
    { id: "offer-details", w: 0.5, re: /\b(summary of the offer|offer details|terms of (the|this|your) offer)\b/i },
    { id: "accept-offer", w: 0.3, re: /\b(accept|sign|review)( and sign)? (the|this|our|your) offer\b|\bto acknowledge the (conditional )?offer\b/i },
    { id: "start-date", w: 0.3, re: /\b(anticipated|tentative|proposed|expected) start date\b/i },
    { id: "pay-line", w: 0.15, re: /\b(pay rate|salary|compensation|hourly rate|base pay)\s*:/i },
  ],
  ONBOARDING: [
    { id: "accepted-offer", w: 0.7, re: /\b(congratulations|thank(s| you)) (on|for) accepting\b|\byou('ve| have) accepted (our|the|your) offer\b/i },
    { id: "onboarding-tasks", w: 0.6, re: /\bonboarding (tasks?|paperwork|checklist|portal|documents|steps|forms)\b|\bcomplete your onboarding\b|\bnew hire (paperwork|orientation|forms?|packet)\b/i },
    { id: "first-day", w: 0.5, re: /\b(your )?first day\b/i },
    { id: "all-set-start", w: 0.5, re: /\b(all set|ready) for your (start|first day)\b|\bwelcome to the team\b/i },
    { id: "screening-cleared", w: 0.4, re: /\b(background check|drug screen|screening)\b[^.!?]{0,40}\b(clear|cleared|passed|came back (clear|clean))\b/i },
    { id: "i9", w: 0.25, re: /\b(form )?i-9\b/i },
    { id: "w4", w: 0.2, re: /\bw-4\b/i },
    { id: "direct-deposit", w: 0.2, re: /\bdirect deposit\b/i },
    { id: "orientation", w: 0.2, re: /\borientation\b/i },
    { id: "what-to-bring", w: 0.25, re: /\bwhat to bring\b|\bplease bring\b[^.!?]{0,40}\b(documents|id|i-9)\b/i },
    { id: "welcome", w: 0.3, re: /\bwelcome aboard\b|\bwelcome to [A-Z]/ },
  ],
  UNRELATED: [
    { id: "education-marketing", w: 0.35, re: /\b(enroll(ment|ing)?|tuition|financial aid|classes (start|begin)|semester|admissions?|campus tour|open house|course catalog|certificate program)\b/i },
    { id: "newsletter", w: 0.4, re: /\bnewsletter\b|\b(you('re| are) receiving|you received) this (e-?mail|message) because you (requested|signed up|subscribed|opted)\b|\bupdate (your )?(email )?preferences\b/i },
    { id: "commerce", w: 0.5, re: /\b(order (number|#|confirmation|summary)|your order|receipt|invoice|payment (received|confirmation|due)|has shipped|tracking number|subscription (renewal|confirmation)|billing statement)\b/i },
    { id: "marketing", w: 0.3, re: /\b(% off|discount|promo(tion|code)?|limited time|webinar|register now|rsvp|free trial|sale ends)\b/i },
    { id: "subj-marketing", where: "subject", w: 0.4, re: /\b(enrollment|newsletter|webinar|sale|% off|receipt|order|invoice|statement|now open|programs)\b/i },
  ],
};

/** Phrases removed before scoring a class: they look like that class's signal but are not. */
const NEUTRALIZERS: Partial<Record<Bucket, RegExp[]>> = {
  INTERVIEW_INVITATION: [
    /\b(may|might|could|will|would) be (contacted|invited|selected|considered|asked)\b[^.!?]{0,20}\binterviews?\b/gi,
    /\bbefore (we|i) (set up|schedule|arrange|book)\b[^.!?]{0,30}\binterview\b/gi,
    /\bno need to schedule\b[^.!?]*/gi,
    /\binterview (stage|process|round)s?\b/gi,
    /\bon-?demand (video )?interview\b|\bone-?way (video )?interview\b|\b(pre-?)?recorded (video )?interview\b/gi,
    /\b(following|after|since|thank(s| you) for)\b[^.!?]{0,40}\binterview(ed|ing|s)?\b/gi,
    /\b(if|once|when) (you are|you're|selected|we)\b[^.!?]{0,40}\binterview\b/gi,
  ],
  ASSESSMENT_INVITATION: [
    /\b(you (have )?(passed|completed|taken|took|failed)|results of|scored on|your score on)\b[^.!?]{0,60}\b(tests?|assessments?|exams?)\b/gi,
    /\bwill be (scheduled|invited|contacted) for\b[^.!?]{0,60}\b(tests?|assessments?|exams?)\b/gi,
    /\bprepares? you for\b[^.!?]{0,80}/gi,
    /\b(advance|proceed|move) to the interview stage\b/gi,
  ],
  OFFER: [
    /\b(offer(ed)?|extend(ed)?|give|gave) the\b[^.!?]{0,60}?\b(position|role|job) to (another|a different|other)\b[^.!?]*/gi,
    /\b(on|for) accepting (your|the|our) offer\b|\byou('ve| have) accepted (our|the|your) offer\b|\bthank(s| you) for accepting\b/gi,
    /\b(unable|not able) to (make|extend) (you )?an offer\b/gi,
  ],
  RECEIVED: [/\bthank(s| you) for (applying|your application)\b[^.!?]{0,40}\b(unfortunately|however)\b/gi],
  APPLICATION_INVITATION: [
    // Conditional clauses describe a process, not an invitation ("If your background matches the role …").
    /\b(if|when|whether|should) your (profile|background|experience|resume|résumé|skills|qualifications)\b[^.!?]*/gi,
  ],
};

const TERMINALS: Bucket[] = ["REJECTION", "OFFER", "ONBOARDING", "INTERVIEW_INVITATION", "ASSESSMENT_INVITATION"];
const PLATFORM_TYPICAL: ReadonlySet<EmailClassification> = new Set([
  "APPLICATION_SUBMITTED",
  "JOB_ALERT",
  "INCOMPLETE_APPLICATION",
  "APPLICATION_INVITATION",
  "REJECTION",
  "ONBOARDING",
]);

type Hit = { id: string; w: number; text: string; inSubject: boolean; inLead: boolean };
type BucketScore = { score: number; leadScore: number; hits: Hit[] };

function noisyOr(ws: number[]): number {
  return 1 - ws.reduce((acc, w) => acc * (1 - Math.min(Math.max(w, 0), 0.99)), 1);
}

function neutralize(text: string, patterns: RegExp[] | undefined): string {
  if (!patterns) return text;
  let out = text;
  for (const re of patterns) out = out.replace(re, (m) => " ".repeat(m.length));
  return out;
}

function scoreBucket(bucket: Bucket, v: Views, extra: Hit[] = []): BucketScore {
  const neutral = NEUTRALIZERS[bucket];
  const subject = neutralize(v.subject, neutral);
  const flat = neutralize(v.flat, neutral);
  const body = neutralize(v.body, neutral);
  const hits: Hit[] = [];
  for (const rule of RULES[bucket]) {
    const where = rule.where ?? "both";
    let best: Hit | null = null;
    if (where !== "body") {
      const m = rule.re.exec(subject);
      if (m) best = { id: rule.id, w: rule.w, text: m[0], inSubject: true, inLead: true };
    }
    if (where !== "subject" && (!best || best.w < rule.w)) {
      const target = rule.lines ? body : flat;
      const m = rule.re.exec(target);
      if (m) {
        const inLead = m.index < (rule.lines ? LEAD_CHARS * 1.1 : LEAD_CHARS);
        const w = inLead ? rule.w : rule.w * DEEP_FACTOR;
        if (!best || w > best.w) best = { id: rule.id, w, text: m[0], inSubject: false, inLead };
      }
    }
    if (best) hits.push(best);
  }
  hits.push(...extra);
  return {
    score: noisyOr(hits.map((h) => h.w)),
    leadScore: noisyOr(hits.filter((h) => h.inSubject || h.inLead).map((h) => h.w)),
    hits,
  };
}

const JOB_VOCAB = /\b(application|applied|apply|position|role|job|interview|recruit(er|ing)|hiring|resume|résumé|candidate|offer|employment|career|requisition)\b/i;
/** Call-to-action buttons of job cards ("Apply now", "Easy Apply", a bare "Apply:" label). Prose "apply" is not counted. */
const APPLY_CTA = /\b(apply now|easily apply|easy apply|quick apply|1-click apply)\b|^\s*apply\s*:?\s*$|\bapply\s*:/gim;

// ---------------------------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------------------------

function emptyExtracted(): ExtractedFields {
  return {
    employer: null,
    positionTitle: null,
    requisitionNumber: null,
    platform: null,
    location: null,
    salaryText: null,
    interviewAt: null,
    recruiterName: null,
    recruiterEmail: null,
    applicationUrl: null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Classify a parsed email and extract application facts. Pure and deterministic. */
export function classifyEmail(parsed: ParsedEmail): EmailClassificationResult {
  const v = buildViews(parsed);
  const sender: SenderInfo = senderInfo(v.fromAddress, v.fromName);
  const signals: string[] = [];
  signals.push(`sender:${sender.kind}${sender.platform ? `:${sender.platform}` : ""}`);
  if (v.forwarded) signals.push("forwarded");

  // Computed (non-phrase) evidence.
  const alertExtra: Hit[] = [];
  const ctaCount = [...v.body.matchAll(APPLY_CTA)].length;
  if (ctaCount >= 5) alertExtra.push({ id: `listing:${ctaCount}-apply-links`, w: 0.4, text: "", inSubject: false, inLead: false });
  else if (ctaCount >= 3) alertExtra.push({ id: `listing:${ctaCount}-apply-links`, w: 0.25, text: "", inSubject: false, inLead: false });
  if (sender.localPart && /(^|[-_.])(job)?alerts?([-_.]|$)|jobalert|digest/.test(sender.localPart)) {
    alertExtra.push({ id: "sender:alert-mailbox", w: 0.4, text: "", inSubject: true, inLead: true });
  }
  const recruiterExtra: Hit[] = [];
  const personSender = personFromDisplayName(v.fromName) !== null;
  if (personSender && !sender.noReply && sender.kind !== "ats") {
    recruiterExtra.push({ id: "sender:person", w: 0.15, text: "", inSubject: false, inLead: true });
  } else if (personSender && /\bvia\b/i.test(v.fromName ?? "")) {
    recruiterExtra.push({ id: "sender:person-via-platform", w: 0.15, text: "", inSubject: false, inLead: true });
  }
  const interviewExtra: Hit[] = [];
  // Appointments are stated in the message itself, not deep in appended text.
  const appointment = extractAppointment([v.body.slice(0, 20_000), v.subject], v.receivedAt);
  if (appointment) interviewExtra.push({ id: "schedule:concrete-date-time", w: 0.2, text: "", inSubject: false, inLead: true });

  const buckets = Object.keys(RULES) as Bucket[];
  const scores = {} as Record<Bucket, BucketScore>;
  for (const b of buckets) {
    const extra = b === "JOB_ALERT" ? alertExtra : b === "RECRUITER_MESSAGE" ? recruiterExtra : b === "INTERVIEW_INVITATION" ? interviewExtra : [];
    scores[b] = scoreBucket(b, v, extra);
  }
  const s = (b: Bucket) => scores[b].score;
  const receivedClass: EmailClassification = sender.recognizedPlatform ? "APPLICATION_SUBMITTED" : "EMPLOYER_ACKNOWLEDGMENT";
  const toClass = (b: Bucket): EmailClassification => (b === "RECEIVED" ? receivedClass : b);

  let bestTerminal: Bucket = TERMINALS[0]!;
  for (const t of TERMINALS) if (s(t) > s(bestTerminal) + 1e-9) bestTerminal = t;

  const alertSubject = scores.JOB_ALERT.hits.some((h) => h.id === "subj-digest");
  const subjectStrong = (b: Bucket) => noisyOr(scores[b].hits.filter((h) => h.inSubject && !h.id.startsWith("sender:")).map((h) => h.w));

  let winner: Bucket | "UNKNOWN";
  if (s("INCOMPLETE_APPLICATION") >= 0.6 && s(bestTerminal) < s("INCOMPLETE_APPLICATION") + 0.15) {
    winner = "INCOMPLETE_APPLICATION";
    if (s("RECEIVED") >= 0.3) signals.push("rule:unfinished-application-is-not-a-submission");
  } else if (s("APPLICATION_INVITATION") >= 0.6 && s(bestTerminal) < s("APPLICATION_INVITATION") + 0.15) {
    winner = "APPLICATION_INVITATION";
    if (s("RECEIVED") >= 0.3) signals.push("rule:invitation-to-apply-is-not-a-submission");
  } else if (
    (alertSubject && Math.max(subjectStrong("RECEIVED"), subjectStrong(bestTerminal)) < 0.6) ||
    (s("JOB_ALERT") >= 0.8 && Math.max(scores.RECEIVED.leadScore, scores[bestTerminal].leadScore, scores.RECRUITER_MESSAGE.leadScore) < 0.85)
  ) {
    winner = "JOB_ALERT";
    if (s("RECEIVED") >= 0.3 || s(bestTerminal) >= 0.3) signals.push("rule:job-alert-digest-overrides-listing-text");
  } else if (s(bestTerminal) >= 0.5) {
    winner = bestTerminal;
    if (bestTerminal === "INTERVIEW_INVITATION" && s(bestTerminal) < 0.65 && s("RECRUITER_MESSAGE") > s(bestTerminal) + 0.2) {
      winner = "RECRUITER_MESSAGE";
      signals.push("rule:availability-request-is-not-an-interview");
    } else if (s("RECEIVED") >= 0.3) {
      signals.push(`precedence:${bestTerminal}>${receivedClass}`);
    }
  } else if (s("UNRELATED") >= 0.6 && Math.max(s("RECEIVED"), s("RECRUITER_MESSAGE")) < 0.5) {
    winner = "UNRELATED";
  } else if (Math.max(s("RECEIVED"), s("RECRUITER_MESSAGE")) >= 0.35) {
    winner = s("RECEIVED") >= s("RECRUITER_MESSAGE") ? "RECEIVED" : "RECRUITER_MESSAGE";
  } else if (s(bestTerminal) >= 0.35) {
    winner = bestTerminal;
  } else {
    const weak = (["INCOMPLETE_APPLICATION", "APPLICATION_INVITATION", "JOB_ALERT"] as Bucket[]).sort((a, b) => s(b) - s(a))[0]!;
    if (s(weak) >= 0.45) winner = weak;
    else if (s("UNRELATED") >= 0.3 || !JOB_VOCAB.test(`${v.subject} ${v.flat}`)) winner = "UNRELATED";
    else winner = "UNKNOWN";
  }

  // Confidence: winning score, platform boost, competitor penalty.
  let confidence: number;
  let classification: EmailClassification;
  if (winner === "UNKNOWN") {
    classification = "UNKNOWN";
    confidence = 0.25;
  } else {
    classification = toClass(winner);
    const base = s(winner);
    if (winner === "UNRELATED") {
      confidence = Math.max(base, JOB_VOCAB.test(`${v.subject} ${v.flat}`) ? 0.55 : 0.7);
    } else {
      confidence = base;
      if (PLATFORM_TYPICAL.has(classification) && sender.recognizedPlatform) confidence += (1 - confidence) * 0.4;
    }
    const competitorsOf = (w: Bucket): Bucket[] => {
      if (TERMINALS.includes(w)) return [...TERMINALS.filter((t) => t !== w), "INCOMPLETE_APPLICATION"];
      if (w === "INCOMPLETE_APPLICATION" || w === "APPLICATION_INVITATION") return [...TERMINALS, w === "INCOMPLETE_APPLICATION" ? "APPLICATION_INVITATION" : "INCOMPLETE_APPLICATION"];
      if (w === "JOB_ALERT") return [...TERMINALS, "INCOMPLETE_APPLICATION", "APPLICATION_INVITATION"];
      if (w === "UNRELATED") return buckets.filter((b) => b !== "UNRELATED");
      return [...TERMINALS, "INCOMPLETE_APPLICATION", "APPLICATION_INVITATION", "JOB_ALERT", w === "RECEIVED" ? "RECRUITER_MESSAGE" : "RECEIVED"];
    };
    const rival = competitorsOf(winner).sort((a, b) => s(b) - s(a))[0];
    const competitor = rival ? s(rival) : 0;
    const penalty = 0.5 * Math.max(0, competitor - 0.35);
    if (penalty > 0 && rival) signals.push(`penalty:competing-${toClass(rival)}(${round2(competitor)})`);
    confidence = Math.min(0.98, Math.max(0.05, confidence - penalty));
  }

  // Signals: the winning rules, strongest first.
  let matchedPhrase: string | null = null;
  if (winner !== "UNKNOWN") {
    const hits = [...scores[winner].hits].sort((a, b) => b.w - a.w);
    for (const h of hits.slice(0, 8)) signals.push(`${classification}:${h.id}`);
    matchedPhrase = hits.find((h) => h.text && !h.inSubject)?.text ?? hits.find((h) => h.text)?.text ?? null;
  }

  const extracted = extractFields(classification, v, parsed, sender, appointment);
  const auth = parsed.headers.authenticationResults ?? "";
  const authFailed = /\bdmarc=fail\b/i.test(auth) || (/\b(dkim|spf)=(fail|softfail)\b/i.test(auth) && !/\bdkim=pass\b/i.test(auth));
  if (authFailed) signals.push("auth:failed");
  const employerDomain = domainMatchesEmployer(sender.domain, extracted.employer);

  return {
    classification,
    confidence: round2(confidence),
    signals,
    extracted,
    matchedPhrase,
    sender: {
      address: sender.address,
      domain: sender.domain,
      kind: sender.kind,
      recognizedPlatform: sender.recognizedPlatform,
      employerDomain,
      forwarded: v.forwarded,
      sentAt: v.receivedAt,
      authFailed,
    },
  };
}

function extractFields(
  classification: EmailClassification,
  v: Views,
  parsed: ParsedEmail,
  sender: SenderInfo,
  appointment: Date | null,
): ExtractedFields {
  const out = emptyExtracted();
  if (classification === "UNRELATED") return out;
  out.platform = classification === "UNKNOWN" ? (sender.recognizedPlatform ? sender.platform : null) : sender.platform;
  // Digests name many employers and titles; none of them is "the" application.
  if (classification === "JOB_ALERT") return out;

  const input: ExtractionInput = {
    subject: v.subject,
    body: v.body,
    fromName: v.fromName,
    fromAddress: v.fromAddress,
    replyTo: parsed.headers.replyTo,
    toAddress: parsed.toAddress,
    links: parsed.links,
  };
  out.employer = extractEmployer(input);
  out.positionTitle = extractTitle(input, out.employer);
  out.requisitionNumber = extractRequisition(input);
  out.location = extractLocation(input, out.employer, out.positionTitle);
  out.salaryText = extractSalary(input, out.employer);
  out.applicationUrl = extractApplicationUrl(parsed.links);
  if (classification === "INTERVIEW_INVITATION") out.interviewAt = appointment;
  const recruiter = extractRecruiter(input, { senderIsPlatform: sender.recognizedPlatform || sender.kind === "assessment" });
  out.recruiterName = recruiter.name;
  out.recruiterEmail = recruiter.email;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Optional AI second opinion
// ---------------------------------------------------------------------------------------------

/** Pluggable AI classifier (implemented elsewhere). Returning null means "no opinion". */
export interface EmailAiClassifier {
  classify(parsed: ParsedEmail, deterministic: Classification): Promise<Classification | null>;
}

/** Below this deterministic confidence the AI classifier (if any) is consulted. */
export const AI_CONSULT_THRESHOLD = 0.6;
/** AI-derived confidence is capped so it never reaches auto-verification on its own. */
export const AI_MAX_CONFIDENCE = 0.85;

const VALID_CLASSES: ReadonlySet<string> = new Set([
  "APPLICATION_SUBMITTED",
  "EMPLOYER_ACKNOWLEDGMENT",
  "RECRUITER_MESSAGE",
  "INTERVIEW_INVITATION",
  "ASSESSMENT_INVITATION",
  "REJECTION",
  "OFFER",
  "ONBOARDING",
  "JOB_ALERT",
  "INCOMPLETE_APPLICATION",
  "APPLICATION_INVITATION",
  "UNRELATED",
  "UNKNOWN",
]);

/**
 * Deterministic classification, with an AI second opinion only when deterministic confidence is below
 * 0.6. The AI can never turn a job alert, unfinished application or invitation to apply into a
 * submission; its confidence is capped at 0.85; deterministic extracted values win over AI ones.
 */
export async function classifyEmailWithOptionalAi(parsed: ParsedEmail, ai?: EmailAiClassifier | null): Promise<Classification> {
  const det = classifyEmail(parsed);
  if (!ai || det.confidence >= AI_CONSULT_THRESHOLD) return det;
  let opinion: Classification | null = null;
  try {
    opinion = await ai.classify(parsed, det);
  } catch {
    return { ...det, signals: [...det.signals, "ai:error"] };
  }
  if (!opinion || !VALID_CLASSES.has(opinion.classification)) return { ...det, signals: [...det.signals, "ai:no-opinion"] };
  if (NEVER_SUBMISSION_CLASSES.has(det.classification) && SUBMISSION_CLASSES.has(opinion.classification)) {
    return { ...det, signals: [...det.signals, `ai:rejected-unsafe-upgrade:${opinion.classification}`] };
  }
  const merged: ExtractedFields = { ...emptyExtracted() };
  for (const key of Object.keys(merged) as Array<keyof ExtractedFields>) {
    const d = det.extracted[key];
    const a = opinion.extracted?.[key];
    (merged as Record<string, unknown>)[key] = d ?? a ?? null;
  }
  if (merged.interviewAt && !(merged.interviewAt instanceof Date)) {
    const d = new Date(merged.interviewAt as unknown as string);
    merged.interviewAt = Number.isNaN(d.getTime()) ? null : d;
  }
  const confidence = Math.min(AI_MAX_CONFIDENCE, Math.max(0, Number(opinion.confidence) || 0));
  return {
    classification: opinion.classification,
    confidence: round2(confidence),
    signals: [...det.signals, `ai:${det.classification}->${opinion.classification}`, ...(opinion.signals ?? []).slice(0, 5).map((x) => `ai:${x}`)],
    extracted: merged,
    matchedPhrase: det.matchedPhrase ?? opinion.matchedPhrase ?? null,
    sender: det.sender,
  };
}
