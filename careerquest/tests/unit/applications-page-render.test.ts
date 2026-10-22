/**
 * Page-level smoke test for the tracker list header (auth, service and review count mocked): the
 * Import and Review queue entry points render, and the count badge is hidden at zero.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationStatus } from "@/generated/prisma/enums";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/applications/review-count", () => ({ getReviewQueueCount: vi.fn(async () => 0) }));
vi.mock("@/lib/applications/service", () => ({
  listApplications: vi.fn(),
  listCategories: vi.fn(async () => []),
  userTimezone: vi.fn(async () => "America/Los_Angeles"),
}));

import ApplicationsPage from "@/app/(app)/applications/page";
import { getReviewQueueCount } from "@/lib/applications/review-count";
import { listApplications, type ApplicationListResult } from "@/lib/applications/service";

const counts = Object.fromEntries(Object.keys(ApplicationStatus).map((s) => [s, 0])) as ApplicationListResult["counts"];
const emptyResult: ApplicationListResult = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, counts, totalUnfiltered: 0, hasAny: false };

async function renderPage() {
  const el = await ApplicationsPage({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(el);
}

describe("applications list header", () => {
  it("links to Import and the Review queue, hiding the badge when nothing is waiting", async () => {
    vi.mocked(listApplications).mockResolvedValueOnce(emptyResult);
    vi.mocked(getReviewQueueCount).mockResolvedValueOnce(0);
    const html = await renderPage();
    expect(html).toContain('href="/applications/import"');
    expect(html).toContain('href="/applications/review"');
    expect(html).toContain("Review queue");
    expect(html).not.toContain('data-testid="review-count"');
    expect(html).toContain("No applications yet");
  });

  it("shows the waiting count with an accessible label", async () => {
    vi.mocked(listApplications).mockResolvedValueOnce(emptyResult);
    vi.mocked(getReviewQueueCount).mockResolvedValueOnce(3);
    const html = await renderPage();
    expect(html).toMatch(/data-testid="review-count"[^>]*>3</);
    expect(html).toContain('aria-label="Review queue, 3 items waiting"');
  });

  it("caps the badge at 99+", async () => {
    vi.mocked(listApplications).mockResolvedValueOnce(emptyResult);
    vi.mocked(getReviewQueueCount).mockResolvedValueOnce(250);
    expect(await renderPage()).toContain(">99+<");
  });
});
