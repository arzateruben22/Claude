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
