import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProgramChecklist, checklistProgress, fnv1a, mergeChecklist, parseChecklist, setChecklistItem } from "@/lib/academy/programs/checklist";
import { formatDuration, matchesProgramFilters, parseProgramFilters, recruitmentBadge } from "@/lib/academy/programs/labels";
import { parseProgramSeeds } from "@/lib/seed/schema";
import {
  addYearsKey,
  buildCertificationTimeline,
  certificationReminders,
  eligibilityEstimate,
  EMPTY_CERT_DATES,
  type CertDates,
} from "@/lib/academy/certification/timeline";
import { certificationStatusSchema } from "@/lib/academy/certification/form";
import { parseCertificationSourceId, certificationSourceId } from "@/lib/academy/certification/constants";
import { buildDirLinks, labelForDirUrl } from "@/lib/academy/certification/links";
import { buildRoadmap } from "@/lib/academy/roadmap";

const seedDir = path.resolve(__dirname, "../../data/seed");
const programs = parseProgramSeeds(JSON.parse(fs.readFileSync(path.join(seedDir, "apprenticeship_programs.json"), "utf8"))).rows;
const bySlug = (slug: string) => programs.find((p) => p.slug === slug)!;

describe("application checklist", () => {
  it("builds items from eligibility, steps and standard documents; DMV printout only when listed", () => {
    const abc = buildProgramChecklist(bySlug("abc-socal"));
    const eti = buildProgramChecklist(bySlug("ibew-11-eti"));
    expect(abc.some((i) => i.id === "d-dmv")).toBe(true);
    expect(eti.some((i) => i.id === "d-dmv")).toBe(false);
    for (const list of [abc, eti]) {
      for (const id of ["d-diploma", "d-algebra", "d-photo-id", "d-resume"]) expect(list.some((i) => i.id === id)).toBe(true);
      expect(list.every((i) => i.done === false)).toBe(true);
      expect(list.some((i) => i.source === "eligibility")).toBe(true);
      expect(list.some((i) => i.source === "process")).toBe(true);
    }
  });

  it("turns unverified requirements into 'Ask the program' items", () => {
    const eti = buildProgramChecklist(bySlug("ibew-11-eti"));
    const dl = eti.find((i) => i.label.includes("Driver's license requirement"))!;
    expect(dl.confirm).toBe(true);
    expect(dl.label.startsWith("Ask the program: ")).toBe(true);
    const age = eti.find((i) => i.label.startsWith("Minimum 18"))!;
    expect(age.confirm).toBe(false);
  });

  it("has stable, unique ids and keeps ticks when regenerated", () => {
    const a = buildProgramChecklist(bySlug("weca"));
    const b = buildProgramChecklist(bySlug("weca"));
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(new Set(a.map((i) => i.id)).size).toBe(a.length);
    const ticked = setChecklistItem(a, a[1]!.id, true, new Date("2026-10-22T10:00:00Z"));
    expect(ticked.found).toBe(true);
    const merged = mergeChecklist(parseChecklist(JSON.parse(JSON.stringify(ticked.items))), b);
    expect(merged[1]).toMatchObject({ done: true, doneAt: "2026-10-22T10:00:00.000Z" });
    expect(checklistProgress(merged)).toEqual({ done: 1, total: a.length });
    expect(setChecklistItem(a, "x-missing", true, new Date()).found).toBe(false);
  });

  it("handles a program with no researched requirements and junk stored JSON", () => {
    const its = buildProgramChecklist(bySlug("la-county-its-electrical-jatc"));
    expect(its.map((i) => i.source)).toEqual(["document", "document", "document", "document"]);
    expect(parseChecklist("nope")).toEqual([]);
    expect(parseChecklist([{ id: 1 }, null, { id: "d-x", label: "ok", done: "yes" }])).toEqual([
      { id: "d-x", label: "ok", source: "document", confirm: false, done: false, doneAt: null },
    ]);
    expect(fnv1a("abc")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("directory labels and filters", () => {
  it("never presents UNVERIFIED as open", () => {
    expect(recruitmentBadge("UNVERIFIED").label).toBe("Unverified — check the program site");
    expect(recruitmentBadge("CLOSED").label).toBe("Closed");
    expect(recruitmentBadge("OPEN").label).toBe("Open");
  });

  it("parses filters against known regions only", () => {
    const regions = ["Los Angeles County", "Orange County"];
    expect(parseProgramFilters({ region: "Orange County", union: "union" }, regions)).toEqual({ region: "Orange County", union: "union" });
    expect(parseProgramFilters({ region: "Mars", union: "maybe" }, regions)).toEqual({ region: null, union: null });
    expect(parseProgramFilters({ region: ["Los Angeles County", "x"] }, regions).region).toBe("Los Angeles County");
    const p = { region: "Orange County", isUnion: false };
    expect(matchesProgramFilters(p, { region: "Orange County", union: "non-union" })).toBe(true);
    expect(matchesProgramFilters(p, { region: null, union: "union" })).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDuration(5)).toBe("5 years");
    expect(formatDuration(4.5)).toBe("4.5 years (54 months)");
    expect(formatDuration(null)).toBeNull();
  });
});

const dates = (over: Partial<CertDates>): CertDates => ({ ...EMPTY_CERT_DATES, ...over });

describe("certification timeline", () => {
  const today = "2026-10-22";

  it("estimates the annual trainee renewal and reminds 60 days ahead", () => {
    const d = dates({ traineeRegisteredAt: "2025-12-01", schoolEnrolled: "Approved College" });
    const steps = buildCertificationTimeline(d, today);
    const renewal = steps.find((s) => s.key === "trainee-renewal")!;
    expect(renewal).toMatchObject({ dateKey: "2026-12-01", estimated: true, state: "due-soon" });
    const r = certificationReminders(d, today);
    expect(r[0]).toMatchObject({ key: "trainee-soon", tone: "warning" });
    expect(certificationReminders(dates({ traineeRegisteredAt: "2025-06-01" }), today)[0]!.key).toBe("trainee-overdue");
    expect(certificationReminders(dates({ traineeRegisteredAt: "2026-06-01" }), today)).toEqual([]);
  });

  it("uses an entered trainee expiry over the estimate", () => {
    const steps = buildCertificationTimeline(dates({ traineeRegisteredAt: "2025-12-01", traineeExpiresAt: "2027-01-15" }), today);
    expect(steps.find((s) => s.key === "trainee-renewal")).toMatchObject({ dateKey: "2027-01-15", estimated: false, state: "scheduled" });
  });

  it("tracks the exam window and the 3-year renewal with the 32-hour CE reminder", () => {
    const eligible = dates({ examApplicationAt: "2025-09-01", examEligibleAt: "2025-11-15" });
    expect(buildCertificationTimeline(eligible, today).find((s) => s.key === "exam-window")).toMatchObject({ dateKey: "2026-11-15", state: "due-soon", estimated: true });
    expect(certificationReminders(eligible, today).map((r) => r.key)).toContain("exam-window-soon");

    const certified = dates({ examPassedAt: "2023-12-01", certifiedAt: "2023-12-20" });
    const steps = buildCertificationTimeline(certified, today);
    expect(steps.find((s) => s.key === "renewal")).toMatchObject({ dateKey: "2026-12-20", estimated: true, state: "due-soon" });
    expect(steps.find((s) => s.key === "trainee")!.state).toBe("done");
    expect(steps.some((s) => s.key === "trainee-renewal")).toBe(false);
    const reminders = certificationReminders(certified, today);
    expect(reminders[0]!.key).toBe("cert-urgent");
    expect(reminders[0]!.body).toContain("32 hours");
    expect(certificationReminders(dates({ certifiedAt: "2024-06-01" }), today)[0]!.key).toBe("cert-window");
    expect(certificationReminders(dates({ certifiedAt: "2023-01-01" }), today)[0]!.key).toBe("cert-overdue");
  });

  it("handles leap days when adding years", () => {
    expect(addYearsKey("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYearsKey("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("validates chronology", () => {
    const base = { classification: "GENERAL" };
    expect(certificationStatusSchema.safeParse({ ...base, traineeRegisteredAt: "2026-01-02", traineeExpiresAt: "2025-01-01" }).success).toBe(false);
    expect(certificationStatusSchema.safeParse({ ...base, examPassedAt: "2026-01-01", certifiedAt: "2025-12-01" }).success).toBe(false);
    expect(certificationStatusSchema.safeParse({ ...base, classification: "general" }).success).toBe(false);
    const ok = certificationStatusSchema.parse({ ...base, traineeRegisteredAt: "", schoolEnrolled: " " });
    expect(ok.traineeRegisteredAt).toBeNull();
    expect(ok.schoolEnrolled).toBeNull();
  });
});

describe("eligibility estimate", () => {
  it("uses verified hours only and respects the caps estimate", () => {
    const e = eligibilityEstimate({ required: 8000, verified: 8200, selfReported: 500, countableVerified: 7400 });
    expect(e).toMatchObject({ ratio: 1, remaining: 0, met: false, countableRatio: 7400 / 8000 });
    const e2 = eligibilityEstimate({ required: 4800, verified: 1200, selfReported: 4000 });
    expect(e2).toMatchObject({ ratio: 0.25, remaining: 3600, met: false, countableVerified: null });
    expect(eligibilityEstimate({ required: 2000, verified: 2000, selfReported: 0 }).met).toBe(true);
  });
});

describe("certification XP source ids and DIR links", () => {
  it("round-trips the source id", () => {
    const id = certificationSourceId("GENERAL", "5b0c6c1e-1111-4222-8333-444455556666");
    expect(parseCertificationSourceId(id)).toEqual({ classification: "GENERAL", documentId: "5b0c6c1e-1111-4222-8333-444455556666" });
    expect(parseCertificationSourceId("nope")).toBeNull();
  });

  it("collects dir.ca.gov links from the seed facts", () => {
    const facts = JSON.parse(fs.readFileSync(path.join(seedDir, "certification_facts.json"), "utf8"));
    const reqs = JSON.parse(fs.readFileSync(path.join(seedDir, "certification_requirements.json"), "utf8"));
    const links = buildDirLinks(buildRoadmap(facts, reqs), "https://dir.ca.gov/DLSE/ECU/1a.html");
    expect(links.length).toBeGreaterThan(5);
    expect(links.every((l) => /dir\.ca\.gov/.test(new URL(l.url).hostname))).toBe(true);
    expect(links.find((l) => l.group === "program")!.label).toBe("DIR Electrician Certification Program");
    expect(links.some((l) => l.label === "List of DIR-approved schools")).toBe(true);
    expect(links.some((l) => l.label === "Trainee registration renewal form")).toBe(true);
    expect(new Set(links.map((l) => l.url)).size).toBe(links.length);
    expect(labelForDirUrl("https://www.dir.ca.gov/x/y/Whatever.html")).toBe("DIR: Whatever.html");
  });
});
