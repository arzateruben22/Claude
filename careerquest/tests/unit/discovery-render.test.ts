/**
 * Server-render smoke tests for Job Discovery (components and pages; auth and data loaders mocked).
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/discovery/profile", () => ({
  loadDiscoveryProfile: vi.fn(async () => ({
    primaryTrade: "ELECTRICIAN",
    careerInterests: ["Electrician"],
    regions: ["Los Angeles County, CA", "Orange County, CA"],
    immediateSalaryTarget: 80000,
    openToApprenticeships: true,
    apprenticeshipMinHourly: null,
    excludeCompanyVehicleJobs: false,
    excludeDrivingRecordJobs: false,
    excludeCdlJobs: true,
    timezone: "America/Los_Angeles",
  })),
}));
vi.mock("@/lib/discovery/leads", () => ({ listLeads: vi.fn() }));
vi.mock("@/lib/discovery/companies", () => ({ listTargetCompanies: vi.fn(async () => []), MAX_TARGET_COMPANIES: 300 }));
vi.mock("@/lib/academy/programs/directory", () => ({ listPrograms: vi.fn() }));

import { LeadCard } from "@/components/discovery/lead-card";
import { QuickAddLead } from "@/components/discovery/quick-add-lead";
import { TargetCompanyCard } from "@/components/discovery/target-company-card";
import { TargetCompanyForm } from "@/components/discovery/target-company-form";
import { SearchLinksView } from "@/components/discovery/search-links-view";
import { ProgramPortalList } from "@/components/discovery/program-portal-list";
import { CandidateChooser } from "@/components/discovery/discovery-parts";
import LeadsPage from "@/app/(app)/discovery/page";
import CompaniesPage from "@/app/(app)/discovery/companies/page";
import SearchPage from "@/app/(app)/discovery/search/page";
import PortalsPage from "@/app/(app)/discovery/apprenticeships/page";
import { listLeads, type LeadView, type LeadList } from "@/lib/discovery/leads";
import { listPrograms } from "@/lib/academy/programs/directory";
import { scoreLead } from "@/lib/discovery/score";
import { buildSearchPlan } from "@/lib/discovery/search-links";
import type { ProgramView } from "@/lib/academy/programs/directory";

const profile = {
  primaryTrade: "ELECTRICIAN" as const,
  careerInterests: ["Electrician"],
  regions: ["Los Angeles County, CA", "Orange County, CA"],
  immediateSalaryTarget: 80000,
  openToApprenticeships: true,
  apprenticeshipMinHourly: null,
  excludeCompanyVehicleJobs: false,
  excludeDrivingRecordJobs: false,
  excludeCdlJobs: true,
};

function leadView(over: Partial<LeadView> = {}): LeadView {
  const flags = { requiresCompanyVehicle: false, requiresDrivingRecord: true, requiresCdl: true };
  return {
    id: "6f1d3b8e-1111-4222-8333-444455556666",
    title: "Electrician Helper",
    company: "Volt Line Electric",
    url: "https://www.indeed.com/viewjob?jk=abc123",
    source: "INDEED",
    sourceLabel: "Indeed",
    location: "Anaheim, CA",
    salaryText: "$24–$30 an hour",
    category: "Electrical helper",
    notes: "Ask about the truck.",
    status: "NEW",
    flags,
    flagList: ["requiresDrivingRecord", "requiresCdl"],
    hiddenBy: ["requiresCdl"],
    score: scoreLead({ ...flags, title: "Electrician Helper", location: "Anaheim, CA", salaryText: "$24–$30 an hour" }, profile),
    convertedApplication: null,
    addedLabel: "Oct 21, 2026",
    ...over,
  };
}

const page = async (el: Promise<React.ReactElement>) => renderToStaticMarkup(await el);

describe("discovery components", () => {
  it("lead card shows fit score with every factor, flags, hidden notice and the conversion actions", () => {
    const lead = leadView();
    const html = renderToStaticMarkup(createElement(LeadCard, { lead, categories: [] }));
    expect(html).toContain("Electrician Helper");
    expect(html).toContain(`Fit ${lead.score.score}/100 · Estimate`);
    expect(html).toContain(`Why ${lead.score.score}/100?`);
    for (const f of lead.score.factors) expect(html).toContain(f.label);
    expect(html).toContain("Flag: CDL (Class A/B) (filtered)");
    expect(html).toContain("Flag: Driver&#x27;s license / driving record");
    expect(html).toContain("Hidden by your private filters");
    expect(html).toContain('href="/settings/eligibility"');
    expect(html).toContain("Convert to application");
    expect(html).toContain("I already applied");
    expect(html).toContain("Dismiss");
    expect(html).toMatch(/href="https:\/\/www\.indeed\.com\/viewjob\?jk=abc123" target="_blank" rel="noopener noreferrer"/);
  });

  it("converted leads link to the application and hide the convert button", () => {
    const html = renderToStaticMarkup(
      createElement(LeadCard, {
        lead: leadView({ status: "CONVERTED", hiddenBy: [], convertedApplication: { id: "a1", label: "Volt Line Electric – Electrician Helper", status: "SAVED", statusLabel: "Saved" } }),
        categories: [],
      }),
    );
    expect(html).toContain('href="/applications/a1"');
    expect(html).toContain("In tracker");
    expect(html).not.toContain("Convert to application");
    expect(html).toContain("I already applied");
  });

  it("quick add explains that links are never opened and offers the flags as editable checkboxes", () => {
    const html = renderToStaticMarkup(createElement(QuickAddLead, { categories: ["Electrician"] }));
    expect(html).toContain("Paste a job URL or posting text");
    expect(html).toContain("never opens the link");
    expect(html).toContain('name="requiresCdl"');
    expect(html).toContain("never rejected");
    expect(html).toContain("Save lead");
  });

  it("target company card shows the application count link and outbound careers link", () => {
    const html = renderToStaticMarkup(
      createElement(TargetCompanyCard, {
        company: {
          id: "c1",
          name: "Acme Electric",
          website: null,
          careersUrl: "https://acme.example.com/careers",
          category: "Electrical contractor",
          priority: 1,
          notes: null,
          applicationCount: 2,
          applicationsHref: "/applications?q=Acme+Electric&archived=1",
        },
        categories: [],
      }),
    );
    expect(html).toContain("2 applications in your tracker");
    expect(html).toContain('href="/applications?q=Acme+Electric&amp;archived=1"');
    expect(html).toContain("High priority");
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/);
    const form = renderToStaticMarkup(createElement(TargetCompanyForm, { categories: ["Utility"] }));
    expect(form).toContain('name="careersUrl"');
    expect(form).toContain("Add company");
  });

  it("search links open the boards in a new tab without referrer", () => {
    const groups = buildSearchPlan({ ...profile, openToApprenticeships: false });
    const html = renderToStaticMarkup(createElement(SearchLinksView, { groups }));
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBe(6 * 2 + 1);
    for (const a of links) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
    expect(html).toContain("CalCareers");
    expect(html).toContain("(opens Indeed in a new tab)");
  });

  it("apprenticeship portals show recruitment status honestly and link to the directory", () => {
    const program: ProgramView & { tracked: boolean } = {
      id: "p1",
      slug: "example-jatc",
      name: "Example Inside Wireman Apprenticeship",
      sponsor: "Example JATC",
      region: "Orange County",
      isUnion: true,
      website: "https://example-jatc.org",
      applyUrl: "https://example-jatc.org/apply",
      eligibility: [],
      processSteps: [],
      durationYears: 5,
      classroomHours: null,
      startingWage: "$25/hr",
      startingWageVerified: false,
      fees: null,
      contact: { phone: null, address: null, email: null },
      recruitmentStatus: "UNVERIFIED",
      recruitmentNote: null,
      sourceUrls: [],
      verifiedOnKey: null,
      tracked: true,
    };
    const html = renderToStaticMarkup(createElement(ProgramPortalList, { programs: [program] }));
    expect(html).toContain("Unverified — check the program site");
    expect(html).toContain("Recruitment status not verified yet.");
    expect(html).toContain("Starting wage: $25/hr (Unverified)");
    expect(html).toContain('href="/academy/apprenticeships/example-jatc"');
    expect(html).toContain("Tracking");
  });

  it("candidate chooser buttons carry the whole decision", () => {
    const id = "0b9c2f4e-aaaa-4bbb-8ccc-ddddeeeeffff";
    const html = renderToStaticMarkup(
      createElement(CandidateChooser, { mode: "applied", candidates: [{ id, label: "Acme – Wireman", statusLabel: "Saved", detail: "added Oct 1, 2026", score: 0.8 }], pending: false, submitter: null }),
    );
    expect(html).toMatch(new RegExp(`<button[^>]*value="applied:attach:${id}"`));
    expect(html).toMatch(/<button[^>]*value="applied:new"/);
    expect(html).toMatch(/<button[^>]*name="choice"/);
    expect(html).toContain("match 80%");
  });
});

describe("discovery pages", () => {
  const empty: LeadList = { view: "active", items: [], hidden: [], counts: { active: 0, dismissed: 0, converted: 0 } };

  it("leads page has an honest empty state", async () => {
    vi.mocked(listLeads).mockResolvedValueOnce(empty);
    const html = await page(LeadsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No leads yet");
    expect(html).toContain('href="/discovery/search"');
    expect(html).toContain("Active (0)");
  });

  it("hides filtered leads behind Show hidden (n) until asked", async () => {
    const hidden = leadView();
    vi.mocked(listLeads).mockResolvedValueOnce({ ...empty, items: [leadView({ id: "a2", title: "Wireman", hiddenBy: [], flagList: [] })], hidden: [hidden], counts: { active: 2, dismissed: 0, converted: 0 } });
    const closed = await page(LeadsPage({ searchParams: Promise.resolve({}) }));
    expect(closed).toContain("Show hidden (1)");
    expect(closed).toContain("Wireman");
    expect(closed).not.toContain("Electrician Helper");
    vi.mocked(listLeads).mockResolvedValueOnce({ ...empty, items: [], hidden: [hidden], counts: { active: 1, dismissed: 0, converted: 0 } });
    const open = await page(LeadsPage({ searchParams: Promise.resolve({ hidden: "1" }) }));
    expect(open).toContain("Electrician Helper");
    expect(open).toContain("Hide them again");
  });

  it("target companies, search links and portal pages render their empty states", async () => {
    expect(await page(CompaniesPage())).toContain("No target companies yet");
    const search = await page(SearchPage());
    expect(search).toContain("does not scrape");
    expect(search).toContain("https://www.indeed.com/jobs?q=electrician");
    vi.mocked(listPrograms).mockResolvedValueOnce({ programs: [], regions: [], totalPrograms: 0, tracked: 0, timezone: "America/Los_Angeles" });
    const portals = await page(PortalsPage());
    expect(portals).toContain("No apprenticeship programs are loaded yet");
    expect(portals).toContain('href="/academy/apprenticeships"');
  });
});
