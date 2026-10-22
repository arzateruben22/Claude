import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Server components are rendered with react-dom/server here; the shared "server-only" marker throws
// outside a React Server environment, so it is stubbed for this smoke test.
vi.mock("server-only", () => ({}));

import { ApplicationList } from "@/components/applications/application-list";
import { ApplicationFilters } from "@/components/applications/application-filters";
import { Pagination } from "@/components/applications/pagination";
import { ApplicationTimeline } from "@/components/applications/timeline";
import { parseListFilters } from "@/lib/applications/query";
import { buildTimeline } from "@/lib/applications/timeline";
import type { ApplicationListItem } from "@/lib/applications/service";
import { ApplicationStatus } from "@/generated/prisma/enums";

const TZ = "America/Los_Angeles";
const now = new Date("2026-10-21T19:00:00Z");

const item: ApplicationListItem = {
  id: "8b6e0f1a-1111-4222-8333-444455556666",
  companyName: "Acme Electric",
  positionTitle: "Apprentice Electrician",
  jobCategory: "Electrician",
  status: "SUBMITTED",
  statusVerified: true,
  statusUpdatedAt: now,
  source: "INDEED",
  location: "Anaheim, CA",
  remote: false,
  employmentType: "FULL_TIME",
  salaryMin: 28,
  salaryMax: 36,
  salaryPeriod: "HOURLY",
  postingUrl: "https://indeed.com/viewjob?jk=abc",
  appliedAt: new Date("2026-10-20T19:00:00Z"),
  followUpAt: new Date("2026-10-19T19:00:00Z"),
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  createdVia: "MANUAL",
  interviewCount: 1,
};

describe("tracker server components render", () => {
  it("renders the list with a quick status control, overdue follow-up and posting link", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationList, { items: [item], timezone: TZ, now }),
    );
    expect(html).toContain("Acme Electric");
    expect(html).toContain("Apprentice Electrician");
    expect(html).toContain(
      'aria-label="Status for Acme Electric – Apprentice Electrician"',
    );
    expect(html).toContain("overdue");
    expect(html).toContain("Oct 20, 2026");
    expect(html).toContain("1 interview");
    expect(html).toContain(`href="/applications/${item.id}"`);
  });

  it("renders filter chips with counts and preserves state in the search form", () => {
    const filters = parseListFilters({
      q: "acme",
      status: "SUBMITTED",
      sort: "company",
    });
    const counts = Object.fromEntries(
      Object.keys(ApplicationStatus).map((s) => [s, 0]),
    ) as Record<ApplicationStatus, number>;
    counts.SUBMITTED = 3;
    counts.OFFER = 1;
    const html = renderToStaticMarkup(
      createElement(ApplicationFilters, {
        filters,
        counts,
        totalUnfiltered: 4,
        categories: ["Electrician"],
      }),
    );
    expect(html).toContain("Submitted");
    expect(html).toContain("Offer");
    expect(html).not.toContain(">Preparing<");
    expect(html).toContain('value="acme"');
    expect(html).toContain('name="status" value="SUBMITTED"');
    expect(html).toContain("All categories");
    expect(html).toContain("Clear");
  });

  it("renders pagination links only where a page exists", () => {
    const filters = parseListFilters({ page: "2" });
    const html = renderToStaticMarkup(
      createElement(Pagination, {
        filters,
        page: 2,
        pageCount: 2,
        total: 30,
        pageSize: 25,
      }),
    );
    expect(html).toContain("Showing 26–30 of 30");
    expect(html).toContain('href="/applications"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("renders the merged timeline with source and verification badges", () => {
    const entries = buildTimeline(
      [
        {
          id: "h1",
          fromStatus: "SAVED",
          toStatus: "SUBMITTED",
          occurredAt: now,
          source: "EMAIL",
          verified: false,
          note: "Confirmation email",
        },
      ],
      [
        {
          id: "e1",
          type: "FOLLOW_UP_SENT",
          occurredAt: now,
          source: "USER",
          verified: true,
          payload: { note: "Called" },
        },
      ],
    );
    const html = renderToStaticMarkup(
      createElement(ApplicationTimeline, { entries, timezone: TZ }),
    );
    expect(html).toContain("Saved → Submitted");
    expect(html).toContain("Email");
    expect(html).toContain("Unverified");
    expect(html).toContain("Follow-up sent");
    expect(html).toContain("Verified");
    expect(html).toContain("Called");
    expect(
      renderToStaticMarkup(
        createElement(ApplicationTimeline, { entries: [], timezone: TZ }),
      ),
    ).toContain("No activity recorded yet");
  });
});

describe("phase-1 fixes: detail page pieces and honest form states", () => {
  it("offers card: entry point at offer stages, list otherwise, nothing when irrelevant", async () => {
    const { OffersCard, offerDetailsHref } = await import("@/components/applications/offers-card");
    const id = item.id;
    const empty = renderToStaticMarkup(createElement(OffersCard, { applicationId: id, status: "OFFER", offers: [], timezone: TZ }));
    expect(empty).toContain("Add offer details");
    expect(empty).toContain(`href="${offerDetailsHref(id).replace(/&/g, "&amp;")}"`);
    expect(offerDetailsHref(id)).toBe(`/salary/offers/new?applicationId=${id}`);
    expect(empty).toContain("No offer details recorded yet");
    expect(renderToStaticMarkup(createElement(OffersCard, { applicationId: id, status: "SUBMITTED", offers: [], timezone: TZ }))).toBe("");
    const offer = {
      id: "o1",
      baseAmount: 38.5,
      period: "HOURLY" as const,
      hoursPerWeek: 40,
      signingBonus: null,
      annualBonus: 2000,
      benefitsValue: null,
      startDate: new Date("2026-11-02T20:00:00Z"),
      decisionDue: null,
      status: "RECEIVED" as const,
      notes: "Union scale",
      createdAt: now,
    };
    const listed = renderToStaticMarkup(createElement(OffersCard, { applicationId: id, status: "REJECTED", offers: [offer], timezone: TZ }));
    expect(listed).toContain("$38.50");
    expect(listed).toContain("Received");
    expect(listed).toContain("Nov 2, 2026");
    expect(listed).not.toContain("Add offer details");
  });

  it("evidence card shows kind, a known source label, snippet and capture time; unknown sources are not echoed", async () => {
    const { EvidenceCard } = await import("@/components/applications/evidence-card");
    const html = renderToStaticMarkup(
      createElement(EvidenceCard, {
        timezone: TZ,
        evidence: [
          { id: "e1", kind: "EMAIL", title: "Thanks for applying", snippet: "We received your application", capturedAt: new Date("2026-10-20T17:05:00Z"), data: { provider: "gmail" } },
          { id: "e2", kind: "EXTENSION_CAPTURE", title: null, snippet: null, capturedAt: now, data: { platform: "WORKDAY" } },
          { id: "e3", kind: "EMAIL", title: "Other", snippet: null, capturedAt: now, data: { provider: "<script>x</script>" } },
        ],
      }),
    );
    expect(html).toContain("Gmail");
    expect(html).toContain("Browser extension · Workday");
    expect(html).toContain("We received your application");
    expect(html).toContain("Oct 20, 2026");
    expect(html).toContain("Untitled");
    expect(html).not.toContain("&lt;script&gt;");
    expect(renderToStaticMarkup(createElement(EvidenceCard, { timezone: TZ, evidence: [] }))).toBe("");
  });

  it("status panel offers a confirm action only for an unverified stage", async () => {
    const { StatusChangePanel } = await import("@/components/applications/status-change-panel");
    const unverified = renderToStaticMarkup(
      createElement(StatusChangePanel, { applicationId: item.id, status: "OFFER", today: "2026-10-21", verified: false, sourceLabel: "Email" }),
    );
    expect(unverified).toContain("Confirm Offer");
    expect(unverified).toContain("unverified, from Email");
    const verified = renderToStaticMarkup(createElement(StatusChangePanel, { applicationId: item.id, status: "OFFER", today: "2026-10-21" }));
    expect(verified).not.toContain("Confirm Offer");
    const lead = renderToStaticMarkup(createElement(StatusChangePanel, { applicationId: item.id, status: "SAVED", today: "2026-10-21", applied: false }));
    expect(lead).toContain("does not count as an application");
  });

  it("the form never asks for an application date on a record that was not applied", async () => {
    const { ApplicationForm } = await import("@/components/applications/application-form");
    const action = async () => ({ ok: true as const, data: undefined });
    const base = { action, documents: { resumes: [], coverLetters: [] }, cancelHref: "/applications", today: "2026-10-21" };
    const saved = renderToStaticMarkup(createElement(ApplicationForm, { ...base, mode: "create" }));
    expect(saved).toContain('data-testid="applied-not-yet"');
    expect(saved).not.toContain('id="appliedAt"');
    const withdrawn = renderToStaticMarkup(createElement(ApplicationForm, { ...base, mode: "create", initialValues: { status: "WITHDRAWN" } }));
    expect(withdrawn).toContain('id="appliedAt"');
    expect(withdrawn).toContain("Leave blank if you never applied.");
    expect(withdrawn).toContain("Counts as an application only if you enter the date you applied.");
    const editLead = renderToStaticMarkup(createElement(ApplicationForm, { ...base, mode: "edit", appliedEditable: false }));
    expect(editLead).toContain("Moving it to Submitted on the application page records the date.");
    const editApplied = renderToStaticMarkup(createElement(ApplicationForm, { ...base, mode: "edit", initialValues: { status: "SUBMITTED", appliedAt: "2026-10-20" } }));
    expect(editApplied).toContain("Blank keeps the current date.");
  });

  it("mobile cards show when a stage is unverified", () => {
    const html = renderToStaticMarkup(createElement(ApplicationList, { items: [{ ...item, statusVerified: false }], timezone: TZ, now }));
    expect(html).toContain("Unverified");
  });
});
