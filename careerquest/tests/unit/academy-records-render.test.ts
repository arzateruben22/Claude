import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/academy/hours",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/academy/programs/directory", () => ({ listPrograms: vi.fn(), getProgramBySlug: vi.fn() }));
vi.mock("@/lib/academy/hours/service", () => ({ getHoursPageData: vi.fn() }));
vi.mock("@/lib/academy/certification/service", () => ({ getCertificationPageData: vi.fn() }));

import { ProgramCard } from "@/components/academy/records/program-card";
import { ClassroomCard, HoursTotals } from "@/components/academy/records/hours-summary";
import { CapsTable } from "@/components/academy/records/caps-table";
import { HourEntryList } from "@/components/academy/records/hour-entry-list";
import { HourEntryForm } from "@/components/academy/records/hour-entry-form";
import { ProgramInterestForm } from "@/components/academy/records/program-interest-form";
import { ProgramChecklist } from "@/components/academy/records/program-checklist";
import { CertificationTimeline, ClassificationTabs } from "@/components/academy/records/certification-timeline";
import { CertificationForm } from "@/components/academy/records/certification-form";
import { VerifyCertification } from "@/components/academy/records/verify-certification";
import { DirLinks, EligibilityCard } from "@/components/academy/records/certification-cards";
import { DocumentList } from "@/components/academy/records/documents";
import { DocumentUploadForm } from "@/components/academy/records/document-upload-form";
import { CumulativeHoursChart, WeeklyHoursChart } from "@/components/academy/records/hours-charts";
import { listPrograms } from "@/lib/academy/programs/directory";
import { getHoursPageData } from "@/lib/academy/hours/service";
import { getCertificationPageData } from "@/lib/academy/certification/service";
import ApprenticeshipsPage from "@/app/(app)/academy/apprenticeships/page";
import HoursPage from "@/app/(app)/academy/hours/page";
import CertificationPage from "@/app/(app)/academy/certification/page";
import type { DirectoryEntry } from "@/lib/academy/programs/directory";
import { parseProgramSeeds } from "@/lib/seed/schema";
import { buildProgramChecklist } from "@/lib/academy/programs/checklist";
import { estimateCountableHours, parseAreaCaps } from "@/lib/academy/hours/caps";
import { cumulativeSeries, projectCompletion, splitTotals, weeklySeries, type HourPoint } from "@/lib/academy/hours/stats";
import { buildCertificationTimeline, eligibilityEstimate, EMPTY_CERT_DATES } from "@/lib/academy/certification/timeline";
import type { RequirementView } from "@/lib/academy/certification/requirements";
import type { HourEntryView } from "@/lib/academy/hours/service";

const html = (el: ReactElement) => renderToStaticMarkup(el);

/** Every labelled control: each element with an id that is an input/select/textarea has a <label for>. */
function expectLabelled(markup: string) {
  const ids = [...markup.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)]
    .filter((m) => !/type="hidden"/.test(m[0]))
    .map((m) => m[2]!);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(markup).toContain(`for="${id}"`);
}

const seedDir = path.resolve(__dirname, "../../data/seed");
const seedPrograms = parseProgramSeeds(JSON.parse(fs.readFileSync(path.join(seedDir, "apprenticeship_programs.json"), "utf8"))).rows;
const GENERAL_NOTES = (JSON.parse(fs.readFileSync(path.join(seedDir, "certification_requirements.json"), "utf8")) as { code: string; notes: string }[]).find(
  (r) => r.code === "GENERAL",
)!.notes;

function program(slug: string, over: Partial<DirectoryEntry> = {}): DirectoryEntry {
  const s = seedPrograms.find((p) => p.slug === slug)!;
  return {
    id: `00000000-0000-4000-8000-${String(seedPrograms.indexOf(s)).padStart(12, "0")}`,
    slug: s.slug,
    name: s.name,
    sponsor: s.sponsor,
    region: s.region,
    isUnion: s.isUnion,
    website: s.website,
    applyUrl: s.applyUrl,
    eligibility: s.eligibility,
    processSteps: s.processSteps,
    durationYears: s.durationYears,
    classroomHours: s.classroomHours,
    startingWage: s.startingWage,
    startingWageVerified: s.startingWageVerified,
    fees: s.fees,
    contact: { phone: s.contact.phone ?? null, address: s.contact.address ?? null, email: s.contact.email ?? null },
    recruitmentStatus: s.recruitmentStatus,
    recruitmentNote: s.recruitmentNote,
    sourceUrls: s.sourceUrls,
    verifiedOnKey: s.verifiedOn ? s.verifiedOn.toISOString().slice(0, 10) : null,
    interest: null,
    ...over,
  };
}

const requirement: RequirementView = {
  code: "GENERAL",
  name: "General Electrician",
  hoursRequired: 8000,
  notes: GENERAL_NOTES,
  sourceUrl: "https://dir.ca.gov/DLSE/ECU/1a.html",
  verifiedOnKey: "2026-10-21",
  source: "database",
};

const points: HourPoint[] = [
  { dateKey: "2026-10-20", hours: 8, verification: "EMPLOYER_VERIFIED", workType: "COMMERCIAL" },
  { dateKey: "2026-10-19", hours: 6, verification: "SELF_REPORTED", workType: "RESIDENTIAL" },
  { dateKey: "2026-09-01", hours: 3500, verification: "OFFICIAL_RECORD", workType: "RESIDENTIAL" },
];

const entryView: HourEntryView = {
  id: "8b6e0f1a-1111-4222-8333-444455556666",
  dateKey: "2026-10-20",
  hours: 8,
  employer: "Acme Electric",
  supervisor: "J. Rivera",
  workType: "COMMERCIAL",
  verification: "EMPLOYER_VERIFIED",
  description: "Panel terminations",
  program: null,
  document: { id: "9c6e0f1a-1111-4222-8333-444455556666", fileName: "oct-stub.pdf" },
  createdAt: new Date("2026-10-20T20:00:00Z"),
};

describe("apprenticeship directory components", () => {
  it("shows Unverified (never Open) and hides unverified wages", () => {
    const out = html(createElement(ProgramCard, { program: program("weca") }));
    expect(out).toContain("Unverified — check the program site");
    expect(out).not.toContain(">Open<");
    expect(out).toContain("Not verified — contact the program");
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("Save to my list");
    expect(out).toContain("Last verified Oct 21, 2026");
  });

  it("shows a verified starting wage, Closed status and the user's status", () => {
    const eti = program("ibew-11-eti");
    const out = html(
      createElement(ProgramCard, {
        program: { ...eti, interest: { id: "i1", status: "TESTING", appliedAtKey: "2026-10-06", notes: null, checklist: buildProgramChecklist(eti), progress: { done: 2, total: 10 }, updatedAt: new Date() } },
      }),
    );
    expect(out).toContain("$26.00/hr");
    expect(out).toContain(">Closed<");
    expect(out).toContain("Testing");
    expect(out).toContain("Checklist 2/10");
    expect(out).not.toContain("Save to my list");
  });

  it("renders OPEN only when the record says OPEN", () => {
    expect(html(createElement(ProgramCard, { program: program("weca", { recruitmentStatus: "OPEN" }) }))).toContain(">Open<");
  });

  it("renders the tracker form and the checklist with labels", () => {
    const form = html(createElement(ProgramInterestForm, { programId: "p1", programName: "WECA", interest: null, todayKey: "2026-10-22" }));
    expectLabelled(form);
    expect(form).toContain("Waitlisted / ranked");
    const items = buildProgramChecklist(program("abc-socal"));
    const list = html(createElement(ProgramChecklist, { programId: "p1", items }));
    expectLabelled(list);
    expect(list).toContain("Ask the program:");
    expect(list).toContain(`0 of ${items.length} done`);
  });
});

describe("hours components", () => {
  const caps = parseAreaCaps(GENERAL_NOTES);
  const totals = splitTotals(points);

  it("puts verified and self-reported totals side by side with the requirement and an estimate label", () => {
    const out = html(createElement(HoursTotals, { totals, requirement, projection: projectCompletion(points, "2026-10-22", 8000) }));
    expect(out).toContain("Verified hours");
    expect(out).toContain("Self-reported hours");
    expect(out).toContain("not treated as accepted by California");
    expect(out).toContain("8,000");
    expect(out).toContain("last verified Oct 21, 2026");
    expect(out).toContain("Estimate");
  });

  it("shows classroom milestones separately, and only targets found in the seed", () => {
    const cls = splitTotals([{ dateKey: "2026-03-01", hours: 40, verification: "OFFICIAL_RECORD", workType: "CLASSROOM" }]);
    const withTargets = html(createElement(ClassroomCard, { classroom: { totals: cls, year: 2026, yearToDate: cls, targets: { annualMinimum: 150, routeTotal: 720 } } }));
    expect(withTargets).toContain("of at least 150 h this year");
    expect(withTargets).toContain("of 720 h related instruction");
    const none = html(createElement(ClassroomCard, { classroom: { totals: cls, year: 2026, yearToDate: cls, targets: { annualMinimum: null, routeTotal: null } } }));
    expect(none).not.toContain("this year");
    expect(none).toContain("are not in the reference data");
  });

  it("labels the caps table as an estimate", () => {
    const out = html(
      createElement(CapsTable, {
        verified: estimateCountableHours({ RESIDENTIAL: 3500, COMMERCIAL: 8 }, caps),
        logged: estimateCountableHours({ RESIDENTIAL: 3506, COMMERCIAL: 8 }, caps),
        capsFromSeed: true,
      }),
    );
    expect(out).toContain("Estimate — DIR decides eligibility");
    expect(out).toContain("+500 over cap");
    expect(out).toContain("3,008 h");
  });

  it("lists entries with edit, delete and owner-only document links", () => {
    const out = html(createElement(HourEntryList, { entries: [entryView], page: 1, pageCount: 2 }));
    expect(out).toContain(`href="/academy/hours/${entryView.id}"`);
    expect(out).toContain(`href="/api/documents/${entryView.document!.id}"`);
    expect(out).toContain("Employer-verified");
    expect(out).toContain('aria-label="Delete 8 h on Oct 20, 2026 at Acme Electric"');
    expect(out).toContain("Page 1 of 2");
  });

  it("renders the entry form with labelled controls (new and edit)", () => {
    const docs = [{ id: entryView.document!.id, fileName: "oct-stub.pdf", kind: "PAY_STUB" as const, createdAt: new Date() }];
    const create = html(createElement(HourEntryForm, { todayKey: "2026-10-22", programs: [{ id: "p1", name: "WECA" }], documents: docs }));
    expectLabelled(create);
    expect(create).toContain('max="2026-10-22"');
    expect(create).toContain('step="0.25"');
    expect(create).toContain("Log hours");
    const edit = html(
      createElement(HourEntryForm, {
        todayKey: "2026-10-22",
        programs: [],
        documents: docs,
        entry: { id: entryView.id, employer: "Acme", supervisor: null, dateKey: "2026-10-20", hours: 8, workType: "COMMERCIAL", programId: null, description: null, verification: "EMPLOYER_VERIFIED", documentId: docs[0]!.id },
      }),
    );
    expect(edit).toContain(`name="id" value="${entryView.id}"`);
    expect(edit).toContain("Save changes");
  });

  it("renders both charts with accessible summaries", () => {
    const weekly = html(createElement(WeeklyHoursChart, { weekly: weeklySeries(points, "2026-10-22") }));
    expect(weekly).toContain("8 h verified and 6 h self-reported");
    const cum = html(createElement(CumulativeHoursChart, { points: cumulativeSeries(points, "2026-10-22"), required: 8000, requirementLabel: "General Electrician requirement" }));
    expect(cum).toContain("<caption>Cumulative hours by week, verified and self-reported</caption>");
    expect(cum).toContain("3,508 h verified");
  });

  it("renders documents and the upload form", () => {
    const list = html(
      createElement(DocumentList, {
        documents: [{ id: "d1", kind: "PAY_STUB", fileName: "stub.pdf", mimeType: "application/pdf", sizeBytes: 2048, sha256: "x", createdAt: new Date("2026-10-20T20:00:00Z") }],
        timezone: "America/Los_Angeles",
        empty: "None",
      }),
    );
    expect(list).toContain('href="/api/documents/d1"');
    expect(list).toContain("2.0 KB");
    expect(html(createElement(DocumentList, { documents: [], timezone: "UTC", empty: "Nothing yet." }))).toContain("Nothing yet.");
    const form = html(createElement(DocumentUploadForm, { kinds: ["PAY_STUB", "HOURS_VERIFICATION"] }));
    expectLabelled(form);
    expect(form).toContain('accept=".pdf,.png,.jpg,.jpeg,.webp');
  });
});

describe("certification components", () => {
  it("renders the timeline with estimate labels and classification tabs", () => {
    const steps = buildCertificationTimeline({ ...EMPTY_CERT_DATES, traineeRegisteredAt: "2025-12-01" }, "2026-10-22");
    const out = html(createElement(CertificationTimeline, { steps }));
    expect(out).toContain("Trainee registration renewal");
    expect(out).toContain("Estimate");
    expect(out).toContain("Due soon");
    const tabs = html(createElement(ClassificationTabs, { requirements: [requirement, { ...requirement, code: "RESIDENTIAL", name: "Residential Electrician" }], current: "GENERAL", tracked: ["RESIDENTIAL"] }));
    expect(tabs).toContain('href="/academy/certification?c=RESIDENTIAL"');
    expect(tabs).toContain('aria-current="page"');
  });

  it("renders the dates form with labelled controls", () => {
    const out = html(createElement(CertificationForm, { classification: "GENERAL", classificationName: "General Electrician", dates: EMPTY_CERT_DATES, notes: null, todayKey: "2026-10-22" }));
    expectLabelled(out);
    expect(out).toContain('name="certifiedAt"');
  });

  it("verification card states", () => {
    const needsDate = html(createElement(VerifyCertification, { classification: "GENERAL", classificationName: "General Electrician", certifiedAtLabel: null, verification: null, certificates: [], xpReward: 1000 }));
    expect(needsDate).toContain("Record the date you were certified");
    const canVerify = html(
      createElement(VerifyCertification, { classification: "GENERAL", classificationName: "General Electrician", certifiedAtLabel: "Oct 1, 2026", verification: null, certificates: [{ id: "c1", fileName: "card.pdf" }], xpReward: 1000 }),
    );
    expectLabelled(canVerify);
    expect(canVerify).toContain("Mark certification verified");
    const verified = html(
      createElement(VerifyCertification, {
        classification: "GENERAL",
        classificationName: "General Electrician",
        certifiedAtLabel: "Oct 1, 2026",
        verification: { documentId: "c1", fileName: "card.pdf", verifiedAtLabel: "Oct 2, 2026" },
        certificates: [],
        xpReward: 1000,
      }),
    );
    expect(verified).toContain("Self-attested with document — CareerQuest does not check state records");
    expect(verified).toContain('href="/api/documents/c1"');
  });

  it("eligibility estimate and DIR links", () => {
    const out = html(createElement(EligibilityCard, { estimate: eligibilityEstimate({ required: 8000, verified: 2000, selfReported: 300, countableVerified: 1900 }), requirement }));
    expect(out).toContain("Estimate — DIR decides eligibility");
    expect(out).toContain("6,000 h to go");
    expect(out).toContain("300 h self-reported hours are not included");
    const links = html(createElement(DirLinks, { links: [{ label: "DIR Electrician Certification Program", url: "https://www.dir.ca.gov/dlse/ecu/electricaltrade.html", group: "program" }], verifiedOn: "2026-10-21" }));
    expect(links).toContain('rel="noopener noreferrer"');
    expect(links).toContain("last checked Oct 21, 2026");
  });
});

describe("pages", () => {
  const sp = (v: Record<string, string> = {}) => ({ searchParams: Promise.resolve(v) });

  it("apprenticeships page: empty directory says how to load it", async () => {
    vi.mocked(listPrograms).mockResolvedValueOnce({ programs: [], regions: [], totalPrograms: 0, tracked: 0, timezone: "America/Los_Angeles" });
    const out = html(await ApprenticeshipsPage(sp()));
    expect(out).toContain("has not been loaded yet");
    expect(out).toContain("npm run db:seed");
  });

  it("apprenticeships page: filters by union status in memory", async () => {
    const all = [program("ibew-11-eti"), program("weca"), program("abc-socal")];
    vi.mocked(listPrograms).mockResolvedValueOnce({ programs: all, regions: ["Los Angeles County", "Southern California"], totalPrograms: 3, tracked: 0, timezone: "America/Los_Angeles" });
    const out = html(await ApprenticeshipsPage(sp({ union: "non-union" })));
    expect(out).toContain("Showing 2 of 3 programs");
    expect(out).not.toContain(all[0]!.name.replace(/&/g, "&amp;"));
    expect(out).toContain("Recruitment status last checked Oct 21, 2026");
  });

  it("hours page: empty state, no CSV export, honest labels", async () => {
    const empty = splitTotals([]);
    vi.mocked(getHoursPageData).mockResolvedValueOnce({
      timezone: "America/Los_Angeles",
      todayKey: "2026-10-22",
      totals: empty,
      classroom: { totals: empty, year: 2026, yearToDate: empty, targets: { annualMinimum: 150, routeTotal: 720 } },
      entryCount: 0,
      requirement,
      caps: { verified: estimateCountableHours({}, parseAreaCaps(GENERAL_NOTES)), logged: estimateCountableHours({}, parseAreaCaps(GENERAL_NOTES)), fromSeed: true },
      weekly: weeklySeries([], "2026-10-22"),
      cumulative: [],
      projection: projectCompletion([], "2026-10-22", 8000),
      milestones: [1000, 2000, 4000, 6000, 8000].map((hours) => ({ hours, reached: false })),
      firstEntryKey: null,
      entries: [],
      page: 1,
      pageCount: 1,
      programs: [],
      documents: [],
    });
    const out = html(await HoursPage(sp()));
    expect(out).toContain("No hours logged yet");
    expect(out).not.toContain("Export CSV");
    expect(out).toContain("Self-reported hours are not treated as accepted by California");
    expect(out).toContain("Not enough data");
    expect(out).toContain("+10 XP per entry");
    expect(out).toContain("of at least 150 h this year");
    expect(out).toContain("of 720 h related instruction");
  });

  it("certification page renders and 404s unknown classifications", async () => {
    vi.mocked(getCertificationPageData).mockResolvedValueOnce({
      timezone: "America/Los_Angeles",
      todayKey: "2026-10-22",
      requirements: [requirement],
      requirement,
      dates: EMPTY_CERT_DATES,
      notes: null,
      hasRecord: false,
      timeline: buildCertificationTimeline(EMPTY_CERT_DATES, "2026-10-22"),
      reminders: [],
      eligibility: eligibilityEstimate({ required: 8000, verified: 0, selfReported: 0, countableVerified: 0 }),
      hours: { totals: splitTotals([]), caps: null },
      verification: null,
      documents: [],
      dirLinks: [],
      factsVerifiedOn: "2026-10-21",
      trackedClassifications: [],
    });
    const out = html(await CertificationPage(sp()));
    expect(out).toContain("Everything here is self-reported");
    expect(out).toContain("General Electrician timeline");
    vi.mocked(getCertificationPageData).mockResolvedValueOnce(null);
    await expect(CertificationPage(sp({ c: "NOPE" }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
