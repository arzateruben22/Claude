import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { seedReferenceData } from "@/lib/seed/run";
import { loadProgramSeeds, loadRequirementSeeds } from "@/lib/seed/load";
import { parseCertificationSeeds, parseProgramSeeds, toProgramRow, programSeedSchema } from "@/lib/seed/schema";

/**
 * Seed idempotency against careerquest_test. The seed only upserts global reference rows (never
 * deletes), so running it here is safe; the user created for the "user data survives" check is
 * removed in afterAll.
 */

let userId = "";
let tmpDir = "";

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({ data: { email: `seed-test+${stamp}@careerquest.test`, passwordHash: "x", name: "Seed Test" }, select: { id: true } });
  userId = user.id;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-seed-"));
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe("seed files", () => {
  it("validate with no errors and the expected keys", () => {
    const programs = loadProgramSeeds();
    const reqs = loadRequirementSeeds();
    expect(programs.errors).toEqual([]);
    expect(reqs.errors).toEqual([]);
    expect(programs.rows.map((r) => r.slug)).toEqual(expect.arrayContaining(["ibew-11-eti", "ibew-441-ocett", "weca", "abc-socal"]));
    expect(reqs.rows.map((r) => r.code)).toEqual(["GENERAL", "RESIDENTIAL", "FIRE_LIFE_SAFETY", "VOICE_DATA_VIDEO", "NON_RESIDENTIAL_LIGHTING"]);
    expect(reqs.rows.find((r) => r.code === "GENERAL")!.hoursRequired).toBe(8000);
    // No program is stored OPEN without dated, sourced evidence; only ETI has a verified wage.
    for (const p of programs.rows) {
      if (p.recruitmentStatus === "OPEN") expect(p.verifiedOn && p.sourceUrls.length > 0).toBeTruthy();
      if (p.startingWageVerified) expect(p.startingWage).toBeTruthy();
    }
    expect(programs.rows.filter((p) => p.startingWageVerified).map((p) => p.slug)).toEqual(["ibew-11-eti"]);
  });

  it("downgrades OPEN without evidence to UNVERIFIED and refuses a verified wage without text", () => {
    const parsed = programSeedSchema.parse({
      slug: "test-open",
      name: "Test",
      sponsor: "Sponsor",
      region: "Orange County",
      isUnion: true,
      recruitmentStatus: "OPEN",
      startingWageVerified: true,
      startingWage: null,
    });
    const { row, warnings } = toProgramRow(parsed);
    expect(row.recruitmentStatus).toBe("UNVERIFIED");
    expect(row.startingWageVerified).toBe(false);
    expect(warnings).toHaveLength(2);
  });

  it("skips invalid entries and duplicate keys without failing", () => {
    const result = parseProgramSeeds([
      { slug: "Bad Slug", name: "x", sponsor: "y", region: "z", isUnion: true },
      { slug: "ok-one", name: "x", sponsor: "y", region: "z", isUnion: false, website: "javascript:alert(1)" },
      { slug: "ok-two", name: "x", sponsor: "y", region: "z", isUnion: false },
      { slug: "ok-two", name: "dup", sponsor: "y", region: "z", isUnion: false },
    ]);
    expect(result.rows.map((r) => r.slug)).toEqual(["ok-two"]);
    expect(result.errors).toHaveLength(3);
    expect(parseCertificationSeeds({ not: "an array" }).errors[0]).toContain("expected a JSON array");
  });
});

describe("seedReferenceData", () => {
  it("is idempotent: a second run creates nothing and leaves identical rows", async () => {
    const first = await seedReferenceData(prisma);
    const programsAfterFirst = await prisma.apprenticeshipProgram.findMany({ orderBy: { slug: "asc" }, omit: { updatedAt: true } });
    const reqsAfterFirst = await prisma.certificationRequirement.findMany({ orderBy: { code: "asc" }, omit: { updatedAt: true } });

    const second = await seedReferenceData(prisma);
    expect(second.programs.created).toBe(0);
    expect(second.requirements.created).toBe(0);
    expect(second.programs.updated).toBe(first.programs.created + first.programs.updated);
    expect(second.programs.total).toBe(first.programs.total);
    expect(second.requirements.total).toBe(first.requirements.total);
    expect(second.errors).toEqual([]);

    const programsAfterSecond = await prisma.apprenticeshipProgram.findMany({ orderBy: { slug: "asc" }, omit: { updatedAt: true } });
    const reqsAfterSecond = await prisma.certificationRequirement.findMany({ orderBy: { code: "asc" }, omit: { updatedAt: true } });
    expect(programsAfterSecond).toEqual(programsAfterFirst);
    expect(reqsAfterSecond).toEqual(reqsAfterFirst);

    const eti = programsAfterSecond.find((p) => p.slug === "ibew-11-eti")!;
    expect(eti.recruitmentStatus).toBe("CLOSED");
    expect(eti.verifiedOn?.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(Array.isArray(eti.eligibility)).toBe(true);
  });

  it("never touches user data (saved interests survive a re-seed)", async () => {
    const program = await prisma.apprenticeshipProgram.findUniqueOrThrow({ where: { slug: "weca" } });
    await prisma.userProgramInterest.create({
      data: { userId, programId: program.id, status: "APPLIED", notes: "keep me", checklist: [{ id: "d-resume", label: "Résumé", source: "document", confirm: false, done: true, doneAt: null }] },
    });
    const log: string[] = [];
    await seedReferenceData(prisma, { log: (l) => log.push(l) });
    const interest = await prisma.userProgramInterest.findUniqueOrThrow({ where: { userId_programId: { userId, programId: program.id } } });
    expect(interest.status).toBe("APPLIED");
    expect(interest.notes).toBe("keep me");
    expect(log.some((l) => l.startsWith("ApprenticeshipProgram:"))).toBe(true);
    expect(log.some((l) => l.startsWith("CertificationRequirement:"))).toBe(true);
  });

  it("reports unreadable seed files instead of throwing", async () => {
    fs.writeFileSync(path.join(tmpDir, "apprenticeship_programs.json"), "{ not json");
    const before = await prisma.apprenticeshipProgram.count();
    const result = await seedReferenceData(prisma, { dataDir: tmpDir });
    expect(result.errors.length).toBe(2);
    expect(result.programs.total).toBe(before);
  });
});
