/**
 * Server-render smoke tests for the review queue (cards, pages, layout). Server actions, auth and
 * loaders are mocked; the markup is checked for labels, decisions and honest empty states.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/applications/review/duplicates", redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/ingest/review-actions", () => ({
  resolveEmailReviewAction: vi.fn(),
  resolveCaptureReviewAction: vi.fn(),
  resolveInterviewInviteAction: vi.fn(),
  resolveDuplicateAction: vi.fn(),
  scanDuplicatesAction: vi.fn(),
}));
vi.mock("@/lib/ingest/review", () => ({
  getReviewCounts: vi.fn(async () => ({ emails: 3, captures: 0, duplicates: 120 })),
  loadEmailReview: vi.fn(),
  loadCaptureReview: vi.fn(),
  loadDuplicateReview: vi.fn(),
  loadAttachOptions: vi.fn(async () => [{ id: "app-9", label: "Golden State Builders – Estimator (Saved)" }]),
}));

import { EmailReviewCard } from "@/components/review/email-review-card";
import { CaptureReviewCard } from "@/components/review/capture-review-card";
import { DuplicateReviewCard } from "@/components/review/duplicate-review-card";
import { InterviewInviteCard } from "@/components/review/interview-invite-card";
import { ScanDuplicatesButton } from "@/components/review/scan-duplicates-button";
import ReviewLayout from "@/app/(app)/applications/review/layout";
import ReviewEmailsPage from "@/app/(app)/applications/review/page";
import ReviewCapturesPage from "@/app/(app)/applications/review/captures/page";
import ReviewDuplicatesPage from "@/app/(app)/applications/review/duplicates/page";
import { loadCaptureReview, loadDuplicateReview, loadEmailReview } from "@/lib/ingest/review";
import type {
  CaptureReviewItemView,
  DuplicateReviewItemView,
  EmailReviewItemView,
  InterviewInviteView,
  ReviewCandidateView,
} from "@/lib/ingest/review-view";

const candidate: ReviewCandidateView = {
  applicationId: "app-1",
  companyName: "Harbor Line Elevator Co.",
  positionTitle: "Elevator Mechanic Helper",
  location: "Long Beach, CA",
  status: "CONFIRMED",
  statusVerified: true,
  sourceLabel: "Workday",
  dateLabel: "Applied Jan 20, 2026",
  archived: false,
  score: 1,
  signals: [
    { label: "Same requisition R-2026-01844", effect: "strong" },
    { label: "Different location (Anaheim vs Long Beach)", effect: "negative" },
  ],
};

const email: EmailReviewItemView = {
  id: "email-1",
  subject: "Your application status",
  from: "Harbor Line HR <careers@harborline.example>",
  receivedLabel: "Jan 29, 2026, 12:30 PM",
  classificationLabel: "Interview invitation",
  confidence: 0.75,
  verifiedSender: false,
  reason: "Classification confidence 75% is below the 80% needed to apply it automatically.",
  snippet: "We would like to invite you to an interview.",
  body: "Hi Ruben,\nWe would like to invite you to an interview.",
  isInterview: true,
  fields: {
    company: "Harbor Line Elevator Co.",
    title: "Elevator Mechanic Helper",
    location: "",
    status: "INTERVIEWING",
    interviewAt: "2026-02-03T10:00",
    interviewType: "ONSITE",
  },
  candidates: [candidate],
};

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("review cards", () => {
  it("renders an email with evidence, editable fields, candidates and every decision", () => {
    const html = render(createElement(EmailReviewCard, { item: email, attachOptions: [{ id: "app-9", label: "Golden State Builders – Estimator (Saved)" }] }));
    expect(html).toContain("Your application status");
    expect(html).toContain("Interview invitation");
    expect(html).toContain("Confidence 75%");
    expect(html).toContain("Unverified sender");
    expect(html).toContain("below the 80%");
    expect(html).toContain("We would like to invite you to an interview.");
    expect(html).toContain("Show the email text kept for review");
    // Implicit submission (Enter) is disabled by a hidden disabled first submit button.
    expect(html).toMatch(/<form[^>]*>(<input[^>]*>)*<button type="submit" disabled="" hidden="" aria-hidden="true" tabindex="-1">/);
    for (const label of ["Company", "Job title", "Location", "Stage", "Interview time", "Interview type"]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('for="email-email-1-company"');
    expect(html).toContain('id="email-email-1-company"');
    expect(html).toContain('value="2026-02-03T10:00"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain("Likely the same job · 100%");
    expect(html).toContain("Same requisition R-2026-01844");
    expect(html).toContain("Different location (Anaheim vs Long Beach)");
    expect(html).toContain('value="attach:app-1"');
    expect(html).toContain('aria-label="Attach to this record: Harbor Line Elevator Co. – Elevator Mechanic Helper"');
    expect(html).toContain('href="/applications/app-1"');
    expect(html).toContain("Or attach to another application");
    expect(html).toContain('value="attach-other"');
    expect(html).toContain('value="create"');
    expect(html).toContain("Create new application");
    expect(html).toContain('value="dismiss"');
    expect(html).toContain("Not an application");
  });

  it("explains when nothing matches and hides the interview fields for other emails", () => {
    const html = render(
      createElement(EmailReviewCard, {
        item: { ...email, isInterview: false, candidates: [], body: null, reason: null, verifiedSender: true },
        attachOptions: [],
      }),
    );
    expect(html).toContain("No tracked application looks like this one.");
    expect(html).toContain("Verified sender");
    expect(html).not.toContain("Interview time");
    expect(html).not.toContain("Or attach to another application");
  });

  it("renders a capture with a safe external link and the apply-started warning", () => {
    const capture: CaptureReviewItemView = {
      id: "cap-1",
      kindLabel: "Application started",
      url: "https://jobs.lever.co/sunbelt/abc",
      urlLabel: "jobs.lever.co/sunbelt/abc",
      platformLabel: "Lever",
      capturedLabel: "Feb 2, 2026, 8:17 AM",
      confidence: 0.7,
      pageTitle: "HVAC Technician - Sunbelt",
      confirmationText: null,
      salaryText: "$30–$38/hr",
      applyStartedOnly: true,
      fields: { company: "Sunbelt HVAC Services", title: "HVAC Technician", location: "", status: "PREPARING", interviewAt: "", interviewType: "OTHER" },
      candidates: [],
    };
    const html = render(createElement(CaptureReviewCard, { item: capture, attachOptions: [] }));
    expect(html).toContain("Sunbelt HVAC Services – HVAC Technician");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(opens in a new tab)");
    expect(html).toContain("Started, not confirmed as sent");
    expect(html).toContain("Detection 70%");
    expect(html).toContain("$30–$38/hr");
    expect(html).toContain('name="captureId"');
  });

  it("renders a duplicate pair with the suggested record pre-selected", () => {
    const side = {
      companyName: "Harbor Line Elevator Co.",
      positionTitle: "Elevator Mechanic Helper",
      location: "Long Beach, CA",
      statusVerified: false,
      createdLabel: "Jan 18, 2026",
      createdViaLabel: "Captured by extension",
      evidenceCount: 1,
      interviewCount: 0,
      archived: false,
    };
    const dup: DuplicateReviewItemView = {
      id: "dup-1",
      score: 0.82,
      signals: [{ label: "Same company", effect: "positive" }],
      a: { ...side, id: "a1", status: "SAVED", sourceLabel: "Indeed", appliedLabel: null },
      b: { ...side, id: "b1", status: "SUBMITTED", sourceLabel: "Workday", appliedLabel: "Jan 20, 2026", interviewCount: 1 },
      suggestedKeepId: "b1",
    };
    const html = render(createElement(DuplicateReviewCard, { item: dup }));
    expect(html).toContain("Possible match · 82%");
    expect(html).toContain("Which record should stay?");
    const radio = (id: string) => html.match(new RegExp(`<input id="dup-dup-1-${id}"[^>]*>`))?.[0] ?? "";
    expect(radio("b1")).toContain('type="radio"');
    expect(radio("b1")).toContain('name="keepId"');
    expect(radio("b1")).toContain('checked=""');
    expect(radio("a1")).not.toContain("checked");
    expect(html).toContain("Suggested to keep");
    expect(html).toContain("Not applied");
    expect(html).toContain("1 interview");
    expect(html).toContain("Merge into the selected record");
    expect(html).toContain("Not a duplicate");
  });

  it("renders an interview invitation and the scan button", () => {
    const invite: InterviewInviteView = {
      emailId: "e2",
      applicationId: "app-2",
      companyName: "Golden State Builders",
      positionTitle: "Assistant Project Manager",
      subject: "On-site interview",
      receivedLabel: "Mar 6, 2026",
      interviewAtLabel: "Mar 10, 2026, 10:00 AM",
      interviewAt: "2026-03-10T10:00",
      interviewType: "ONSITE",
    };
    const html = render(createElement(InterviewInviteCard, { invite }));
    expect(html).toContain("time read from the email: Mar 10, 2026, 10:00 AM (not confirmed)");
    expect(html).toContain('value="2026-03-10T10:00"');
    expect(html).toContain("Add interview");
    expect(html).toContain("Not needed");
    expect(render(createElement(ScanDuplicatesButton))).toContain("Scan for duplicates");
  });
});

describe("review pages", () => {
  it("shows tab counts in the layout", async () => {
    const html = render(await ReviewLayout({ children: createElement("p", null, "child") }));
    expect(html).toContain("Review queue");
    expect(html).toContain("Emails (3)");
    expect(html).toContain(">Captures<");
    expect(html).toContain("Possible duplicates (99+)");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("child");
  });

  it("shows honest empty states", async () => {
    vi.mocked(loadEmailReview).mockResolvedValueOnce({ items: [], total: 0, invites: [] });
    const emails = render(await ReviewEmailsPage());
    expect(emails).toContain("No emails waiting for review");
    expect(emails).toContain('href="/integrations"');

    vi.mocked(loadCaptureReview).mockResolvedValueOnce({ items: [], total: 0 });
    expect(render(await ReviewCapturesPage())).toContain("No captures waiting for confirmation");

    vi.mocked(loadDuplicateReview).mockResolvedValueOnce({ items: [], total: 0 });
    const dups = render(await ReviewDuplicatesPage());
    expect(dups).toContain("No possible duplicates waiting");
    expect(dups).toContain("Scan for duplicates");
  });

  it("lists items with a paging note", async () => {
    vi.mocked(loadEmailReview).mockResolvedValueOnce({ items: [email], total: 30, invites: [] });
    const html = render(await ReviewEmailsPage());
    expect(html).toContain("Showing the 1 newest of 30 emails");
    expect(html).toContain("Your application status");
    expect(html).toContain("Golden State Builders – Estimator (Saved)");
  });
});
