/**
 * Generalization and adversarial tests for the email library, using messages written inline (different
 * senders, platforms and phrasings than the fixture corpus), plus unit tests for the parsing helpers,
 * date extraction, observation building and the optional AI hook.
 */
import { describe, expect, it, vi } from "vitest";
import {
  AI_MAX_CONFIDENCE,
  classifyEmail,
  classifyEmailWithOptionalAi,
  type Classification,
  type EmailAiClassifier,
} from "@/lib/email/classify";
import { findDateTimes, extractAppointment } from "@/lib/email/datetime";
import { decodeEntities, htmlToText, htmlToTextWithLinks } from "@/lib/email/html";
import { buildSnippet, maskPii, observationKindFor, toObservation } from "@/lib/email/observation";
import { fromGraphMessage, MAX_TEXT_BYTES, parseEmail, parseGmailRaw, splitMbox } from "@/lib/email/parse";

// ---------------------------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------------------------

type Msg = {
  from: string;
  to?: string;
  subject: string;
  date?: string | null;
  messageId?: string | null;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  /** Raw header lines that are already encoded (e.g. RFC 2047 subjects). */
  rawSubject?: string;
  charset?: string;
  encoding?: "7bit" | "8bit" | "quoted-printable" | "base64";
};

let counter = 0;
function eml(m: Msg): string {
  counter++;
  const lines = [
    `From: ${m.from}`,
    `To: ${m.to ?? "Jordan Rivera <jordan.rivera@example.com>"}`,
    `Subject: ${m.rawSubject ?? m.subject}`,
  ];
  if (m.date !== null) lines.push(`Date: ${m.date ?? "Tue, 05 May 2026 09:15:00 -0700"}`);
  if (m.messageId !== null) lines.push(`Message-ID: <${m.messageId ?? `synthetic-${counter}@mail.example`}>`);
  for (const [k, v] of Object.entries(m.headers ?? {})) lines.push(`${k}: ${v}`);
  lines.push("MIME-Version: 1.0");
  const charset = m.charset ?? "UTF-8";
  const encoding = m.encoding ?? "8bit";
  if (m.text !== undefined && m.html !== undefined) {
    const boundary = `b${counter}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, "");
    lines.push(`--${boundary}`, `Content-Type: text/plain; charset="${charset}"`, `Content-Transfer-Encoding: ${encoding}`, "", m.text);
    lines.push(`--${boundary}`, `Content-Type: text/html; charset="${charset}"`, `Content-Transfer-Encoding: ${encoding}`, "", m.html);
    lines.push(`--${boundary}--`, "");
  } else if (m.html !== undefined) {
    lines.push(`Content-Type: text/html; charset="${charset}"`, `Content-Transfer-Encoding: ${encoding}`, "", m.html);
  } else {
    lines.push(`Content-Type: text/plain; charset="${charset}"`, `Content-Transfer-Encoding: ${encoding}`, "", m.text ?? "");
  }
  return lines.join("\r\n");
}

async function classify(m: Msg) {
  const parsed = await parseEmail(eml(m));
  const result = classifyEmail(parsed);
  const observation = toObservation(parsed, result, { provider: "PASTE", now: new Date("2026-05-05T16:15:00Z") });
  return { parsed, result, observation };
}

const lc = (v: string | null | undefined) => (v ?? null)?.toLowerCase().replace(/\s+/g, " ").trim() ?? null;

// ---------------------------------------------------------------------------------------------
// Generalization: phrasings, senders and platforms not present in the fixture corpus
// ---------------------------------------------------------------------------------------------

describe("synthetic emails (generalization)", () => {
  it("Glassdoor submission confirmation", async () => {
    const { result, observation } = await classify({
      from: "Glassdoor <noreply@glassdoor.com>",
      subject: "Your application to Bright Path Logistics was submitted",
      text: [
        "Hi Jordan,",
        "",
        "Good news! Your application for Forklift Operator at Bright Path Logistics has been submitted.",
        "",
        "Forklift Operator",
        "Bright Path Logistics · Ontario, CA",
        "",
        "You can track your application status from your Glassdoor account.",
        "",
        "The Glassdoor Team",
      ].join("\n"),
    });
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.extracted.platform).toBe("GLASSDOOR");
    expect(result.extracted.employer).toBe("Bright Path Logistics");
    expect(result.extracted.positionTitle).toBe("Forklift Operator");
    expect(result.extracted.location).toBe("Ontario, CA");
    expect(observation?.kind).toBe("SUBMITTED");
    expect(observation?.verified).toBe(true);
  });

  it("employer acknowledgment phrased as 'acknowledge receipt'", async () => {
    const { result, observation } = await classify({
      from: "Northwind Plumbing HR <hr@northwindplumbing.example>",
      subject: "Application acknowledgment - Plumber Apprentice",
      text: [
        "Dear Jordan,",
        "",
        "We acknowledge receipt of your application for the Plumber Apprentice role at our Riverside shop.",
        "A member of our team will contact you within ten business days if we would like to talk further.",
        "",
        "Regards,",
        "Northwind Plumbing Human Resources",
      ].join("\n"),
    });
    expect(result.classification).toBe("EMPLOYER_ACKNOWLEDGMENT");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.extracted.employer).toBe("Northwind Plumbing");
    expect(result.extracted.positionTitle).toBe("Plumber Apprentice");
    expect(result.extracted.platform).toBe("COMPANY_SITE");
    expect(observation?.kind).toBe("ACKNOWLEDGED");
  });

  it("interview request proposing a time with a zone abbreviation", async () => {
    const { result, observation } = await classify({
      from: "Maria Lopez <mlopez@coastlinesolar.example>",
      subject: "Interview request: Solar Installer",
      date: "Thu, 30 Apr 2026 10:02:00 -0700",
      text: [
        "Hi Jordan,",
        "",
        "Thanks for your interest in Coastline Solar. We'd like to meet you for an in-person interview for the Solar Installer position.",
        "Does Wednesday, May 6 at 9:30 am PDT work for you? We're at 410 Harbor Blvd, Costa Mesa.",
        "",
        "Maria Lopez",
        "Recruiting Coordinator | Coastline Solar",
      ].join("\n"),
    });
    expect(result.classification).toBe("INTERVIEW_INVITATION");
    expect(result.extracted.interviewAt?.toISOString()).toBe("2026-05-06T16:30:00.000Z");
    expect(result.extracted.recruiterName).toBe("Maria Lopez");
    expect(result.extracted.employer).toBe("Coastline Solar");
    expect(result.extracted.positionTitle).toBe("Solar Installer");
    expect(observation?.kind).toBe("INTERVIEW_INVITED");
    expect(observation?.interviewAt?.toISOString()).toBe("2026-05-06T16:30:00.000Z");
  });

  it("phone screen with a numeric date and Eastern time", async () => {
    const { result } = await classify({
      from: "Devon Price <dprice@atlasrail.example>",
      subject: "Phone interview confirmed - Signal Maintainer",
      date: "Mon, 08 Jun 2026 08:00:00 -0400",
      text: "Hi Jordan,\n\nYour phone interview for the Signal Maintainer opening is confirmed for Thursday 6/11 at 1 p.m. ET. I'll call the number on your resume.\n\nDevon Price\nTalent Acquisition, Atlas Rail",
    });
    expect(result.classification).toBe("INTERVIEW_INVITATION");
    expect(result.extracted.interviewAt?.toISOString()).toBe("2026-06-11T17:00:00.000Z");
  });

  it("offer phrased as 'delighted to extend an offer'", async () => {
    const { result, observation } = await classify({
      from: "Redline Fabrication <people@redlinefab.example>",
      subject: "Your offer from Redline Fabrication",
      text: [
        "Congratulations, Jordan!",
        "",
        "We are delighted to extend an offer for the position of Welder II on our structural line.",
        "Starting wage: $27.00 per hour, with a review at 90 days.",
        "Please review and sign the offer letter in the portal by Friday.",
        "",
        "Redline Fabrication People Team",
      ].join("\n"),
    });
    expect(result.classification).toBe("OFFER");
    expect(result.extracted.employer).toBe("Redline Fabrication");
    expect(result.extracted.positionTitle).toBe("Welder II");
    expect(result.extracted.salaryText).toBe("$27.00 per hour");
    expect(observation?.kind).toBe("OFFER");
  });

  it("skills test from an assessment vendor", async () => {
    const { result } = await classify({
      from: "Harbor Foods via TestGorilla <no-reply@testgorilla.com>",
      subject: "Skills assessment for Maintenance Planner at Harbor Foods",
      text: "Hello Jordan,\n\nHarbor Foods has asked you to complete a skills test as part of your application for the Maintenance Planner role. Please complete it within 72 hours.\n\nGood luck!",
    });
    expect(result.classification).toBe("ASSESSMENT_INVITATION");
    expect(result.extracted.platform).toBe("OTHER");
    expect(result.extracted.employer).toBe("Harbor Foods");
    expect(result.extracted.positionTitle).toBe("Maintenance Planner");
    expect(result.extracted.recruiterName).toBeNull();
  });

  it("rejection phrased as 'pursue other applicants'", async () => {
    const { result, observation } = await classify({
      from: "Valley Water Talent <talent@valleywater.example>",
      subject: "Your candidacy - Water Treatment Operator",
      text: "Dear Jordan,\n\nWe appreciate the time you spent with us. After reviewing all candidates we have decided to pursue other applicants for the Water Treatment Operator position.\n\nValley Water Talent Team",
    });
    expect(result.classification).toBe("REJECTION");
    expect(observation?.kind).toBe("REJECTED");
  });

  it("Glassdoor job alert digest", async () => {
    const { result, observation } = await classify({
      from: "Glassdoor Jobs <jobs@glassdoor.com>",
      subject: "Jobs for you: Warehouse Associate and 14 more",
      text: [
        "Based on your saved search, here are new openings near Riverside, CA.",
        "",
        "Warehouse Associate - Pinnacle Freight - Riverside, CA - Apply Now",
        "Shipping Clerk - Sunrise Packaging - Corona, CA - Apply Now",
        "Forklift Driver - Bright Path Logistics - Ontario, CA - Apply Now",
        "Inventory Specialist - Mesa Supply - Riverside, CA - Easy Apply",
        "",
        "Manage your job alerts",
      ].join("\n"),
    });
    expect(result.classification).toBe("JOB_ALERT");
    expect(result.extracted.employer).toBeNull();
    expect(result.extracted.positionTitle).toBeNull();
    expect(observation).toBeNull();
  });

  it("unfinished application reminder phrased as 'finish applying'", async () => {
    const { result, observation } = await classify({
      from: "SmartRecruiters <noreply@smartrecruiters.com>",
      subject: "Don't forget to finish applying to Bayview Hospital",
      text: "Hi Jordan,\n\nYou started applying for Facilities Technician at Bayview Hospital. Your application is not complete yet - pick up where you left off before the posting closes.",
    });
    expect(result.classification).toBe("INCOMPLETE_APPLICATION");
    expect(result.extracted.employer).toBe("Bayview Hospital");
    expect(observation).toBeNull();
  });

  it("recruiter-style invitation to apply", async () => {
    const { result, observation } = await classify({
      from: "LinkedIn <jobs-noreply@linkedin.com>",
      subject: "A recruiter at Vista Energy thinks you'd be a great fit — apply to Lineworker Apprentice",
      text: "Your skills match this role at Vista Energy.\n\nLineworker Apprentice\nVista Energy · Fresno, CA\n\nApply now",
    });
    expect(result.classification).toBe("APPLICATION_INVITATION");
    expect(observation).toBeNull();
  });

  it("onboarding with orientation and I-9 documents", async () => {
    const { result, observation } = await classify({
      from: "Cal Coast Transit HR <hr@calcoasttransit.example>",
      subject: "Welcome to the team!",
      text: "Hi Jordan,\n\nWelcome to the team! Your new hire orientation is Monday at 8:00 AM in Building C. Please bring two forms of ID for your I-9 and a voided check for direct deposit.\n\nCal Coast Transit Human Resources",
    });
    expect(result.classification).toBe("ONBOARDING");
    expect(result.extracted.interviewAt).toBeNull();
    expect(observation?.kind).toBe("ONBOARDING");
  });

  it("staffing-agency outreach", async () => {
    const { result } = await classify({
      from: "Sam Patel <sam@brightcoaststaffing.example>",
      subject: "Opportunity: Controls Technician in Irvine",
      text: "Hi Jordan,\n\nI came across your profile and think you might be a good match for a Controls Technician role with one of our manufacturing clients. Do you have time for a quick call this week?\n\nSam Patel\nSenior Recruiter, Bright Coast Staffing",
    });
    expect(result.classification).toBe("RECRUITER_MESSAGE");
    expect(result.extracted.recruiterName).toBe("Sam Patel");
    expect(result.extracted.platform).toBe("OTHER");
  });

  it("shipping receipt is unrelated", async () => {
    const { result, observation } = await classify({
      from: "ToolDepot <orders@tooldepot.example>",
      subject: "Your order #48213 has shipped",
      text: "Thanks for shopping with ToolDepot! Your order #48213 (Klein lineman pliers, 1 x $42.99) has shipped. Tracking number: 1Z999AA10123456784.",
    });
    expect(result.classification).toBe("UNRELATED");
    expect(result.extracted.platform).toBeNull();
    expect(observation).toBeNull();
  });
});

describe("more phrasings", () => {
  const cases: Array<{ name: string; msg: Msg; want: string; interviewAt?: string }> = [
    {
      name: "offer: 'we'd like to offer you the role'",
      msg: {
        from: "Ana Ortiz <aortiz@brightwater.example>",
        subject: "Good news",
        text: "Hi Jordan, after meeting with the team we'd like to offer you the Maintenance Mechanic role at $34/hour, starting July 6. Let me know if you have questions. Ana Ortiz, HR Manager",
      },
      want: "OFFER",
    },
    {
      name: "rejection: status updated to Not Selected",
      msg: {
        from: "Careers <donotreply@icims.com>",
        subject: "Application update",
        text: "Your application status for Warehouse Lead (REQ-20391) has been updated to: Not Selected. Thank you for your interest.",
      },
      want: "REJECTION",
    },
    {
      name: "rejection: decided not to move forward with your candidacy",
      msg: {
        from: "Lena Brooks <lbrooks@pinecrestmedical.example>",
        subject: "Biomedical Technician",
        text: "Hi Jordan, thank you for interviewing with us. The hiring team has decided not to move forward with your candidacy at this time. Lena",
      },
      want: "REJECTION",
    },
    {
      name: "interview: 'come in for an interview' with a time",
      msg: {
        from: "Rick Chan <rick@chanautobody.example>",
        subject: "Body Shop Technician",
        date: "Mon, 08 Jun 2026 11:00:00 -0700",
        text: "Hi Jordan, thanks for applying for the Body Shop Technician job. Can you come in for an interview on Friday, June 12 at 2pm? Rick",
      },
      want: "INTERVIEW_INVITATION",
      interviewAt: "2026-06-12T21:00:00.000Z",
    },
    {
      name: "interview: booking link, no fixed time",
      msg: {
        from: "Talent Team <talent@nimbusair.example>",
        subject: "Next steps for Aircraft Mechanic",
        text: "Hi Jordan, we're excited to move forward with your application and would like to schedule an interview. Please use the link below to book a time for your interview.",
      },
      want: "INTERVIEW_INVITATION",
    },
    {
      name: "assessment: next step is a coding challenge",
      msg: {
        from: "HackerRank <support@hackerrank.com>",
        subject: "Invitation from Orbit Robotics",
        text: "Hi Jordan, your next step is a coding challenge for the PLC Programmer role at Orbit Robotics. You have 7 days to finish it.",
      },
      want: "ASSESSMENT_INVITATION",
    },
    {
      name: "acknowledgment: 'your resume has been received'",
      msg: {
        from: "Granite Builders <careers@granitebuilders.example>",
        subject: "Thanks from Granite Builders",
        text: "Hello Jordan, your resume has been received and is with our hiring team for the Concrete Finisher opening. Granite Builders Recruiting",
      },
      want: "EMPLOYER_ACKNOWLEDGMENT",
    },
    {
      name: "recruiter: technical recruiter outreach",
      msg: {
        from: "Chris Young <chris@apextalent.example>",
        subject: "Instrumentation Tech role",
        text: "Hi Jordan, I'm a technical recruiter with Apex Talent Partners. I have an Instrumentation Technician role in Carson that might interest you. Would you be open to a quick call tomorrow?",
      },
      want: "RECRUITER_MESSAGE",
    },
    {
      name: "unrelated: profile-views notification from a job board",
      msg: {
        from: "LinkedIn <notifications-noreply@linkedin.com>",
        subject: "You appeared in 12 searches this week",
        text: "See who's looking. You appeared in 12 searches this week. Keep your profile up to date.",
      },
      want: "UNRELATED",
    },
  ];

  it.each(cases)("$name", async ({ msg, want, interviewAt }) => {
    const { result, observation } = await classify(msg);
    expect(result.classification, result.signals.join(", ")).toBe(want);
    if (interviewAt) expect(result.extracted.interviewAt?.toISOString()).toBe(interviewAt);
    if (want === "UNRELATED") {
      expect(result.extracted.platform).toBeNull();
      expect(observation).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Adversarial cases
// ---------------------------------------------------------------------------------------------

describe("adversarial emails", () => {
  it("job-alert digest with 'application submitted' inside a listing is still a job alert", async () => {
    const listing = (title: string, company: string, extra = "") =>
      `${title}\n${company} · Orange County, CA\n${extra ? `${extra}\n` : ""}Easy Apply\n`;
    const { result, observation } = await classify({
      from: "LinkedIn <jobs-listings@linkedin.com>",
      subject: "Your weekly job picks",
      text: [
        "Jobs you may be interested in, based on your preferences.",
        "",
        listing("Electrician Apprentice", "Volt Masters"),
        listing("Low Voltage Technician", "Signal Path Networks"),
        listing("Maintenance Electrician", "Summit Foods", "Your application was submitted 3 days ago"),
        listing("Solar Electrician", "SunCrest Energy"),
        listing("Electrical Helper", "Bay Builders"),
        "See all 24 jobs",
        "Manage your job alerts · Unsubscribe",
      ].join("\n"),
    });
    expect(result.classification).toBe("JOB_ALERT");
    expect(observation).toBeNull();
    expect(result.signals.join(" ")).toContain("job-alert-digest");
  });

  it("alert subject wins even when a card says 'Application submitted'", async () => {
    const { result, observation } = await classify({
      from: "Indeed <alert@indeed.com>",
      subject: "Pipefitter jobs in Long Beach, CA: 9 new jobs",
      text: "Pipefitter\nPort Mechanical - Long Beach, CA\nApplication submitted\n\nPipefitter Helper\nHarborside Piping - Wilmington, CA\nApply now\n\nSteamfitter\nDelta Mechanical - Carson, CA\nApply now",
    });
    expect(result.classification).toBe("JOB_ALERT");
    expect(observation).toBeNull();
  });

  it("rejection that says 'thank you for applying' is a rejection, not a submission", async () => {
    const { result, observation } = await classify({
      from: "Summit Data Centers Careers <careers@summitdatacenters.example>",
      subject: "Thank you for applying to Summit Data Centers",
      text: "Hi Jordan,\n\nThank you for applying for the Data Center Technician position. We appreciate your interest. Regrettably, we will not be proceeding with your application at this time.\n\nWe wish you success in your search.\nSummit Data Centers Recruiting",
    });
    expect(result.classification).toBe("REJECTION");
    expect(result.signals.join(" ")).toContain("precedence:REJECTION");
    expect(observation?.kind).toBe("REJECTED");
  });

  it("ATS rejection from a platform sender beats its 'thank you for your application' opener", async () => {
    const { result } = await classify({
      from: "Mesa Water District <no-reply@us.greenhouse-mail.io>",
      subject: "Thank you for your application",
      text: "Hi Jordan,\n\nThank you for your application for the Water Systems Operator role. Unfortunately, we have decided to move forward with other candidates whose experience more closely matches our needs.\n\nMesa Water District Recruiting",
    });
    expect(result.classification).toBe("REJECTION");
    expect(result.extracted.platform).toBe("GREENHOUSE");
  });

  it("forwarded confirmation uses the original sender, subject and date and is not verified", async () => {
    const { result, observation } = await classify({
      from: "Jordan Rivera <jordan.rivera@gmail.com>",
      to: "Jordan Rivera <jordan.rivera@gmail.com>",
      subject: "Fwd: Application submitted: Line Cook at Harbor Grill",
      date: "Thu, 05 Mar 2026 18:00:00 -0800",
      text: [
        "keeping track of this one",
        "",
        "---------- Forwarded message ---------",
        "From: Indeed <noreply@indeed.com>",
        "Date: Tue, Mar 3, 2026 at 10:15 AM",
        "Subject: Application submitted: Line Cook at Harbor Grill",
        "To: <jordan.rivera@gmail.com>",
        "",
        "Your application has been sent to Harbor Grill.",
        "",
        "Line Cook",
        "Harbor Grill - San Pedro, CA",
        "Applied on March 3, 2026",
      ].join("\n"),
    });
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    expect(result.extracted.platform).toBe("INDEED");
    expect(result.extracted.employer).toBe("Harbor Grill");
    expect(result.extracted.positionTitle).toBe("Line Cook");
    expect(result.sender.forwarded).toBe(true);
    expect(observation?.verified).toBe(false);
    // The forwarded block's zone-less date is read as Pacific time: 10:15 AM PST.
    expect(observation?.observedAt.toISOString()).toBe("2026-03-03T18:15:00.000Z");
  });

  it("non-ASCII subject (RFC 2047) and quoted-printable UTF-8 body", async () => {
    const subject = "Your application to Café Olé Hospitality was received";
    const { parsed, result } = await classify({
      from: "=?UTF-8?Q?Caf=C3=A9_Ol=C3=A9_Hospitality?= <jobs@cafeole.example>",
      subject,
      rawSubject: `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
      encoding: "quoted-printable",
      text: "Hola Jordan =E2=80=94 thank you for applying to Caf=C3=A9 Ol=C3=A9 Hospitality! We=E2=80=99ve receiv=\r\ned your application for the Sous Chef position in San Jos=C3=A9, CA.\r\n\r\nSaludos,\r\nEquipo de Talento",
    });
    expect(parsed.subject).toBe(subject);
    expect(parsed.fromName).toBe("Café Olé Hospitality");
    expect(parsed.text).toContain("We’ve received your application");
    expect(result.classification).toBe("EMPLOYER_ACKNOWLEDGMENT");
    expect(result.extracted.employer).toBe("Café Olé Hospitality");
    expect(result.extracted.positionTitle).toBe("Sous Chef");
  });

  it("missing Date and Message-ID headers: no invented date, stable fallback id", async () => {
    const msg: Msg = {
      from: "Lever <no-reply@hire.lever.co>",
      subject: "Thanks for applying to Granite Rock Paving",
      date: null,
      messageId: null,
      text: "Hi Jordan,\n\nThanks for applying to the Equipment Operator position at Granite Rock Paving. We've received your application and the team will review it soon.",
    };
    const a = await parseEmail(eml(msg));
    const b = await parseEmail(eml(msg));
    expect(a.receivedAt).toBeNull();
    expect(a.externalId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(a.externalId).toBe(b.externalId);
    const result = classifyEmail(a);
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    const now = new Date("2026-05-05T12:00:00Z");
    expect(toObservation(a, result, { provider: "PASTE", now })?.observedAt).toEqual(now);
  });

  it("HTML-only message with tracking links, hidden preheader, script and style", async () => {
    const html = `<!DOCTYPE html><html><head><title>x</title><style>.hidden{display:none} p{color:red}</style>
<script>document.write("you were rejected")</script></head><body>
<div style="display:none;max-height:0">Unfortunately we regret to inform you</div>
<!--[if mso]><p>Outlook only: interview scheduled</p><![endif]-->
<table><tr><td><a href="https://click.mail.mesawater.example/ls/click?upn=abc123"><img src="https://cdn.mesawater.example/logo.png" alt="Mesa Water"></a></td></tr>
<tr><td><p>Hi Jordan,</p><p>Thanks for applying to <b>Mesa Water District</b>! We have received your application for the
<a href="https://click.mail.mesawater.example/ls/click?upn=def456">Water Treatment Operator</a> position.</p>
<p>Questions? Email <a href="mailto:jobs@mesawater.example">jobs@mesawater.example</a> &amp; we&#8217;ll help.</p>
<p><a href="https://jobs.lever.co/mesawater/1b2c3d4e-0000-4000-8000-123456789abc?lever-source=email">View the job posting</a></p></td></tr></table>
<img src="https://t.mesawater.example/open.gif?u=1" width="1" height="1"></body></html>`;
    const { parsed, result, observation } = await classify({
      from: "Mesa Water District <no-reply@hire.lever.co>",
      subject: "We received your application",
      html,
    });
    expect(parsed.text).not.toMatch(/https?:|document\.write|regret|Outlook only|color:red/);
    expect(parsed.text).toContain("Water Treatment Operator position");
    expect(parsed.text).toContain("& we’ll help");
    expect(parsed.links.some((l) => l.url.includes("open.gif"))).toBe(false);
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    expect(result.extracted.positionTitle).toBe("Water Treatment Operator");
    expect(result.extracted.applicationUrl).toBe("https://jobs.lever.co/mesawater/1b2c3d4e-0000-4000-8000-123456789abc");
    expect(observation?.postingUrl).toBe("https://jobs.lever.co/mesawater/1b2c3d4e-0000-4000-8000-123456789abc");
  });

  it("oversized body is capped at 200 KB and still classified", async () => {
    const filler = Array.from({ length: 30000 }, (_, i) => `Line ${i}: safety bulletin text that pads this message.`).join("\n");
    const { parsed, result } = await classify({
      from: "Workday <no-reply@myworkday.com>",
      subject: "Thank you for applying to Inland Grid Services",
      text: `Dear Jordan,\n\nYour application for the Substation Technician position has been submitted.\n\nInland Grid Services Talent Acquisition\n\n${filler}`,
    });
    expect(Buffer.byteLength(parsed.text, "utf8")).toBeLessThanOrEqual(MAX_TEXT_BYTES);
    expect(parsed.text.length).toBeGreaterThan(100_000);
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    expect(result.extracted.employer).toBe("Inland Grid Services");
  });

  it("a platform-looking confirmation that failed DMARC is never verified", async () => {
    const msg: Msg = {
      from: "Workday <no-reply@myworkday.com>",
      subject: "Thank you for applying to Orion Elevator",
      headers: { "Authentication-Results": "mx.example.com; dkim=none; spf=softfail smtp.mailfrom=myworkday.com; dmarc=fail header.from=myworkday.com" },
      text: "Dear Jordan,\n\nThank you for applying to Orion Elevator. Your application for the Elevator Apprentice position has been submitted.\n\nOrion Elevator Talent Acquisition",
    };
    const spoofed = await classify(msg);
    expect(spoofed.result.classification).toBe("APPLICATION_SUBMITTED");
    expect(spoofed.result.sender.authFailed).toBe(true);
    expect(spoofed.observation?.verified).toBe(false);
    const genuine = await classify({ ...msg, headers: { "Authentication-Results": "mx.example.com; dkim=pass header.d=myworkday.com; spf=pass; dmarc=pass" } });
    expect(genuine.observation?.verified).toBe(true);
  });

  it("hypothetical interview mention in a confirmation does not make it an interview", async () => {
    const { result } = await classify({
      from: "iCIMS <donotreply@icims.com>",
      subject: "Application received",
      text: "Thank you for applying. Your application has been received. Candidates who meet the requirements may be contacted for an interview.",
    });
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
  });
});

// ---------------------------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------------------------

describe("parsing helpers", () => {
  it("splitMbox separates messages and unescapes >From lines by one level", () => {
    const mbox = [
      "From sender@example.com Mon Jan 12 09:14:33 2026",
      "Subject: one",
      "",
      ">From the desk of the hiring manager",
      ">>From quoted",
      "",
      "From other@example.com Tue Jan 13 10:00:00 2026",
      "Subject: two",
      "",
      "From here on, this body line is not an envelope because it has no date.",
      "",
    ].join("\n");
    const parts = splitMbox(mbox);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("\nFrom the desk of the hiring manager\n>From quoted");
    expect(parts[1]).toContain("From here on, this body line");
  });

  it("parseGmailRaw decodes base64url and honours the Gmail thread id", async () => {
    const raw = eml({ from: "Indeed <noreply@indeed.com>", subject: "Application submitted: Cook at Grill", text: "Your application has been sent to Grill." });
    const b64 = Buffer.from(raw, "utf8").toString("base64url");
    const parsed = await parseGmailRaw(b64, { id: "18c2f", threadId: "18c2a" });
    const direct = await parseEmail(raw);
    expect(parsed.externalId).toBe(direct.externalId);
    expect(parsed.threadId).toBe("18c2a");
    const noId = await parseGmailRaw(Buffer.from(eml({ from: "a@b.example", subject: "x", text: "hello", messageId: null }), "utf8").toString("base64url"), { id: "abc" });
    expect(noId.externalId).toBe("gmail:abc");
  });

  it("threads on the root of References", async () => {
    const parsed = await parseEmail(
      eml({
        from: "Dana <dana@acme.example>",
        subject: "Re: hello",
        headers: { References: "<root@x.example> <mid@x.example>", "In-Reply-To": "<mid@x.example>" },
        text: "Thanks!",
      }),
    );
    expect(parsed.threadId).toBe("root@x.example");
  });

  it("fromGraphMessage maps a Microsoft Graph message", () => {
    const parsed = fromGraphMessage({
      id: "AAMkAG",
      internetMessageId: "<CAF123@mail.example>",
      conversationId: "AAQkAG-conv",
      subject: "Thank you for applying to Orion Elevator",
      from: { emailAddress: { name: "Orion Elevator", address: "No-Reply@MyWorkday.com" } },
      toRecipients: [{ emailAddress: { name: "Jordan", address: "jordan@example.com" } }],
      replyTo: [{ emailAddress: { address: "Talent@orion.example" } }],
      receivedDateTime: "2026-02-03T18:04:05Z",
      body: {
        contentType: "html",
        content: "<p>Dear Jordan,</p><p>Your application for the <b>Elevator Apprentice</b> position has been submitted.</p><p>Job Requisition ID: R-77120</p>",
      },
      internetMessageHeaders: [{ name: "Auto-Submitted", value: "auto-generated" }],
    });
    expect(parsed.externalId).toBe("CAF123@mail.example");
    expect(parsed.threadId).toBe("AAQkAG-conv");
    expect(parsed.fromAddress).toBe("no-reply@myworkday.com");
    expect(parsed.receivedAt?.toISOString()).toBe("2026-02-03T18:04:05.000Z");
    expect(parsed.headers).toEqual({
      listUnsubscribe: null,
      autoSubmitted: "auto-generated",
      replyTo: "talent@orion.example",
      authenticationResults: null,
    });
    expect(parsed.text).toContain("Your application for the Elevator Apprentice position has been submitted.");
    const result = classifyEmail(parsed);
    expect(result.classification).toBe("APPLICATION_SUBMITTED");
    expect(result.extracted.platform).toBe("WORKDAY");
    expect(result.extracted.requisitionNumber).toBe("R-77120");
    expect(fromGraphMessage({ id: "only-id", body: { contentType: "text", content: "hi" } }).externalId).toBe("graph:only-id");
  });

  it("htmlToText decodes entities, keeps link text, drops images and hidden blocks", () => {
    expect(decodeEntities("A &amp; B &lt;b&gt; &#8211; &#x2014; &nbsp;&middot; &bogus;")).toBe("A & B <b> \u2013 \u2014 \u0020\u00b7 &bogus;");
    const { text, links } = htmlToTextWithLinks(
      '<p>Hello&nbsp;<a href="https://example.com/x?a=1&amp;b=2">World</a></p><ul><li>One</li><li>Two</li></ul><table><tr><td>Job ID:</td><td>123</td></tr></table>',
    );
    expect(text).toBe("Hello World\n\n- One\n- Two\n\nJob ID: 123");
    expect(links).toEqual([{ text: "World", url: "https://example.com/x?a=1&b=2" }]);
    expect(htmlToText("<span style='display:none'>secret</span><p>Visible</p>")).toBe("Visible");
  });
});

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

describe("date/time extraction", () => {
  const ref = new Date("2026-03-01T12:00:00Z");
  it("pairs a date with the following time and applies the zone", () => {
    const [c] = findDateTimes("When: Thursday, April 16, 2026, 2:30 PM - 3:15 PM Pacific Time", ref);
    expect(c!.at.toISOString()).toBe("2026-04-16T21:30:00.000Z");
  });
  it("resolves a missing year from the weekday", () => {
    const [c] = findDateTimes("See you Tuesday, March 9 at 10am", new Date("2027-02-01T00:00:00Z"));
    // March 9 is a Tuesday in 2027.
    expect(c!.at.toISOString()).toBe("2027-03-09T18:00:00.000Z");
  });
  it("uses PST in winter (-08:00) and Central time when stated", () => {
    expect(findDateTimes("Interview date: Feb 2, 2026 at 9:00 AM PST", ref)[0]!.at.toISOString()).toBe("2026-02-02T17:00:00.000Z");
    expect(findDateTimes("Interview date: 2026-07-01 at 15:30 CT", ref)[0]!.at.toISOString()).toBe("2026-07-01T20:30:00.000Z");
  });
  it("never treats a deadline or a bare date as an appointment", () => {
    expect(extractAppointment(["Deadline: Tuesday, February 24, 2026 at 11:59 PM PT"], ref)).toBeNull();
    expect(extractAppointment(["Your interview is on March 10, 2026."], ref)).toBeNull();
    expect(extractAppointment(["Your interview is on March 10, 2026 at 1:00 PM."], ref)?.toISOString()).toBe("2026-03-10T20:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------------------------

describe("observations", () => {
  it("maps classifications to observation kinds", () => {
    expect(observationKindFor("APPLICATION_SUBMITTED")).toBe("SUBMITTED");
    expect(observationKindFor("EMPLOYER_ACKNOWLEDGMENT")).toBe("ACKNOWLEDGED");
    expect(observationKindFor("RECRUITER_MESSAGE")).toBe("RECRUITER_RESPONSE");
    expect(observationKindFor("INTERVIEW_INVITATION")).toBe("INTERVIEW_INVITED");
    expect(observationKindFor("ASSESSMENT_INVITATION")).toBe("ASSESSMENT_INVITED");
    expect(observationKindFor("REJECTION")).toBe("REJECTED");
    expect(observationKindFor("OFFER")).toBe("OFFER");
    expect(observationKindFor("ONBOARDING")).toBe("ONBOARDING");
    for (const c of ["JOB_ALERT", "INCOMPLETE_APPLICATION", "APPLICATION_INVITATION", "UNRELATED", "UNKNOWN"] as const) {
      expect(observationKindFor(c)).toBeNull();
    }
  });

  it("masks emails, phone numbers and links and keeps snippets ≤ 300 characters", () => {
    expect(maskPii("Call (714) 555-0188 or +1 669 555 0100, mail jo@x.example, see https://x.example/a?t=1")).toBe(
      "Call [phone] or [phone], mail [email], see [link]",
    );
    const long = `${"intro ".repeat(100)}we have decided to move forward with other candidates ${"outro ".repeat(100)} jo@x.example`;
    const snippet = buildSnippet(long, "decided to move forward with other candidates")!;
    expect(snippet.length).toBeLessThanOrEqual(300);
    expect(snippet).toContain("decided to move forward with other candidates");
    expect(snippet.startsWith("…")).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Optional AI hook
// ---------------------------------------------------------------------------------------------

describe("classifyEmailWithOptionalAi", () => {
  const vague = () =>
    parseEmail(eml({ from: "Pat <pat@somewhere.example>", subject: "Following up", text: "Hi, just following up about the position we discussed. Thanks, Pat" }));
  const weakAlert = () =>
    parseEmail(eml({ from: "Updates <updates@careersite.example>", subject: "This week", text: "Here are 3 new jobs for welders near you." }));
  const opinion = (base: Classification, over: Partial<Classification>): Classification => ({ ...base, ...over });

  it("does not consult the AI when deterministic confidence is ≥ 0.6", async () => {
    const parsed = await parseEmail(eml({ from: "Indeed <noreply@indeed.com>", subject: "Application submitted: Cook at Grill", text: "Your application has been sent to Grill." }));
    const ai: EmailAiClassifier = { classify: vi.fn() };
    const res = await classifyEmailWithOptionalAi(parsed, ai);
    expect(res.classification).toBe("APPLICATION_SUBMITTED");
    expect(ai.classify).not.toHaveBeenCalled();
  });

  it("consults the AI below 0.6 and caps its confidence", async () => {
    const parsed = await vague();
    const det = classifyEmail(parsed);
    expect(det.confidence).toBeLessThan(0.6);
    const ai: EmailAiClassifier = {
      classify: vi.fn(async (_p, d: Classification) => opinion(d, { classification: "RECRUITER_MESSAGE", confidence: 0.99, signals: ["llm"] })),
    };
    const res = await classifyEmailWithOptionalAi(parsed, ai);
    expect(ai.classify).toHaveBeenCalledTimes(1);
    expect(res.classification).toBe("RECRUITER_MESSAGE");
    expect(res.confidence).toBe(AI_MAX_CONFIDENCE);
    expect(res.signals).toContain(`ai:${det.classification}->RECRUITER_MESSAGE`);
  });

  it("never lets the AI turn a job alert into a submission", async () => {
    const parsed = await weakAlert();
    const det = classifyEmail(parsed);
    expect(det.classification).toBe("JOB_ALERT");
    expect(det.confidence).toBeLessThan(0.6);
    const ai: EmailAiClassifier = { classify: async (_p, d) => opinion(d, { classification: "APPLICATION_SUBMITTED", confidence: 0.95 }) };
    const res = await classifyEmailWithOptionalAi(parsed, ai);
    expect(res.classification).toBe("JOB_ALERT");
    expect(res.signals.some((s) => s.startsWith("ai:rejected-unsafe-upgrade"))).toBe(true);
  });

  it("falls back to the deterministic result when the AI fails or abstains", async () => {
    const parsed = await vague();
    const det = classifyEmail(parsed);
    const failing: EmailAiClassifier = { classify: async () => Promise.reject(new Error("timeout")) };
    expect((await classifyEmailWithOptionalAi(parsed, failing)).classification).toBe(det.classification);
    const abstain: EmailAiClassifier = { classify: async () => null };
    expect((await classifyEmailWithOptionalAi(parsed, abstain)).classification).toBe(det.classification);
  });
});

describe("recruiter name hygiene", () => {
  it("never returns the recipient's own name", async () => {
    const { result } = await classify({
      from: "Jordan Rivera <jordan.rivera@example.com>",
      subject: "Re: Apprentice Electrician application",
      text: "Hi, I've got your resume and forwarded it to our hiring manager for review.",
    });
    expect(lc(result.extracted.recruiterName)).not.toBe("jordan rivera");
  });
});
