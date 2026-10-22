/**
 * Draft templates for external communication. Pure.
 *
 * Drafts are text the user copies, reviews and sends themselves; CareerQuest never sends them.
 * They use only facts from the user's own records (company, title, dates, recruiter name, résumé
 * terms) and put a bracketed placeholder wherever a fact is unknown, so nothing is invented.
 */
import { DAY_MS } from "@/lib/dates";

export type DraftApplication = {
  id: string;
  companyName: string;
  positionTitle: string;
  status: string;
  requisitionNumber: string | null;
  sourceLabel: string | null;
  appliedAt: string | null;
  recruiterName: string | null;
  /** Most recent attended interview, if any. */
  lastInterviewAt: string | null;
};

export type Draft = { title: string; subject?: string; body: string };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** "October 14" in the user's calendar (date-only values are already UTC-midnight days). */
export function longDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "[date]";
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return dateOnly ? dateFmt.format(d) : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone }).format(d);
}

function firstName(full: string | null): string | null {
  const f = full?.trim().split(/\s+/)[0];
  return f && /^[A-Za-zÀ-ÿ'’-]{2,}$/.test(f) ? f : null;
}

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

/** Follow-up email: post-interview thank-you/check-in, or a check-in on a submitted application. */
export function followUpEmail(app: DraftApplication, opts: { userName: string; timeZone: string; now: Date }): { draft: Draft; notes: string[] } {
  const greetingName = firstName(app.recruiterName) ?? "[Hiring manager's name, or \"Hiring Team\"]";
  const req = app.requisitionNumber ? ` (Req. ${app.requisitionNumber})` : "";
  const signature = `${opts.userName.trim() || "[Your name]"}\n[Your phone number]`;
  const notes: string[] = [];
  const postInterview = app.lastInterviewAt !== null;

  let subject: string;
  let body: string;
  if (postInterview) {
    const when = longDate(app.lastInterviewAt!, opts.timeZone);
    subject = `Thank you – ${app.positionTitle} interview${req}`;
    body = [
      `Hi ${greetingName},`,
      `Thank you for taking the time to speak with me on ${when} about the ${app.positionTitle} position at ${app.companyName}. I enjoyed learning more about [something specific you discussed in the interview].`,
      `I'm still very interested in the role. [Optional: one sentence connecting a point from the interview to an experience on your résumé.]`,
      `Please let me know if there is anything else you need from me. I look forward to hearing about next steps.`,
      `Best regards,\n${signature}`,
    ].join("\n\n");
  } else {
    const applied = app.appliedAt ? ` on ${longDate(app.appliedAt, opts.timeZone)}` : "";
    subject = `Following up on my application – ${app.positionTitle}${req}`;
    body = [
      `Hi ${greetingName},`,
      `I applied for the ${app.positionTitle} position at ${app.companyName}${applied}${app.sourceLabel ? ` through ${app.sourceLabel}` : ""}, and I wanted to follow up. I'm still very interested in the role and would welcome the chance to talk about how I could contribute.`,
      `[Optional: one sentence about a qualification from your résumé that fits this role. Leave it out rather than stretch it.]`,
      `Please let me know if you need anything else from me. Thank you for your time.`,
      `Best regards,\n${signature}`,
    ].join("\n\n");
    const days = daysSince(app.appliedAt, opts.now);
    if (days !== null && days < 7) notes.push(`You applied ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}. Many recruiters suggest waiting about a week before following up.`);
  }
  const closed: Record<string, string> = { REJECTED: "rejected", WITHDRAWN: "withdrawn", CLOSED: "closed", HIRED: "hired", ACCEPTED: "accepted" };
  if (closed[app.status]) notes.unshift(`This application is marked ${closed[app.status]} in your tracker, so a follow-up may not be appropriate. Double-check before sending.`);
  if (!app.recruiterName) notes.push("No recruiter contact is recorded on this application, so the greeting is a placeholder. Add a contact on the application if you have one.");
  notes.push("Fill in or delete every [bracketed] part before sending.");
  return { draft: { title: `Follow-up email: ${app.companyName}`, subject, body }, notes };
}

/** Cover letter skeleton: real facts from the application, placeholders for everything else. */
export function coverLetter(
  app: DraftApplication,
  opts: { userName: string; matchedTerms: string[]; missingTerms: string[] },
): Draft {
  const salutation = app.recruiterName ? `Dear ${app.recruiterName.trim()},` : "Dear [Hiring manager's name],";
  const via = app.sourceLabel ? ` posted on ${app.sourceLabel}` : "";
  const req = app.requisitionNumber ? ` (Req. ${app.requisitionNumber})` : "";
  const evidence = opts.matchedTerms.length
    ? `[Turn these points from your résumé that match the posting into two or three sentences, with one specific example of what you did and the result: ${opts.matchedTerms.slice(0, 6).join(", ")}.]`
    : "[Describe your most relevant experience from your résumé in two or three sentences, with one specific example of what you did and the result.]";
  const gaps = opts.missingTerms.length
    ? `\n\n[The posting also asks for: ${opts.missingTerms.slice(0, 5).join(", ")}. Mention any of these only if they are true for you; otherwise leave this out.]`
    : "";
  const body = [
    `${opts.userName.trim() || "[Your name]"}\n[Your phone number] · [Your email]\n[Date]`,
    salutation,
    `I am applying for the ${app.positionTitle} position${req} at ${app.companyName}${via}.`,
    `[Why ${app.companyName}: one or two sentences on something specific you know about the company or its work. Only include what you can stand behind.]`,
    `${evidence}${gaps}`,
    `I would welcome the chance to discuss how I can contribute to ${app.companyName}. Thank you for your time and consideration.`,
    `Sincerely,\n${opts.userName.trim() || "[Your name]"}`,
  ].join("\n\n");
  return { title: `Cover letter draft: ${app.companyName}`, body };
}
