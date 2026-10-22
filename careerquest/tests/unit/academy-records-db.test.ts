import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { seedReferenceData } from "@/lib/seed/run";
import { addUtcDays, dateFromKey, dateKey, todayInTz } from "@/lib/dates";
import { saveDocument, deleteDocument } from "@/lib/documents/service";
import {
  createWorkHourEntry,
  deleteWorkHourEntry,
  exportHoursCsv,
  getHoursPageData,
  getHoursSummary,
  updateWorkHourEntry,
  DOWNGRADE_EXPLANATION,
} from "@/lib/academy/hours/service";
import type { WorkHourInput } from "@/lib/academy/hours/validation";
import { removeProgramInterest, saveProgramInterest, toggleChecklistItem, trackProgram } from "@/lib/academy/programs/interest";
import { getProgramBySlug, listPrograms } from "@/lib/academy/programs/directory";
import {
  getCertificationPageData,
  getCertificationVerification,
  removeCertificationVerification,
  saveCertificationStatus,
  verifyCertification,
} from "@/lib/academy/certification/service";
import type { CertificationStatusInput } from "@/lib/academy/certification/form";

const TZ = "America/Los_Angeles";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("png")]);

let userId = "";
let milestoneUserId = "";
let otherUserId = "";
let tmp = "";
const previousUploadDir = process.env.UPLOAD_DIR;
const todayKey = () => dateKey(todayInTz(TZ));
const daysAgo = (n: number) => dateKey(addUtcDays(dateFromKey(todayKey()), -n));

async function makeUser(label: string): Promise<string> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({
    data: { email: `records-${label}+${stamp}@careerquest.test`, passwordHash: "x", name: label, profile: { create: { timezone: TZ } } },
    select: { id: true },
  });
  return u.id;
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cq-records-"));
  process.env.UPLOAD_DIR = tmp;
  await seedReferenceData(prisma);
  userId = await makeUser("main");
  milestoneUserId = await makeUser("milestones");
  otherUserId = await makeUser("other");
});

afterAll(async () => {
  for (const id of [userId, milestoneUserId, otherUserId]) if (id) await prisma.user.delete({ where: { id } }).catch(() => undefined);
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = previousUploadDir;
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  await prisma.$disconnect();
});

function entry(over: Partial<WorkHourInput> = {}): WorkHourInput {
  return {
    employer: "Acme Electric",
    supervisor: "J. Rivera",
    dateWorked: daysAgo(1),
    hours: 8,
    workType: "COMMERCIAL",
    programId: null,
    description: null,
    verification: "SELF_REPORTED",
    documentId: null,
    ...over,
  };
}

async function ledgerSum(uid: string, where: { dedupeKey?: string; sourceType?: string; sourceId?: string }) {
  const agg = await prisma.xpLedger.aggregate({ where: { userId: uid, ...where }, _sum: { amount: true }, _count: true });
  return { sum: agg._sum.amount ?? 0, count: agg._count };
}

async function upload(uid: string, kind: "PAY_STUB" | "CERTIFICATE" | "HOURS_VERIFICATION", name = "proof.pdf", bytes = PDF) {
  const saved = await saveDocument(uid, kind, { name, size: bytes.byteLength, bytes: new Uint8Array(bytes) });
  if (!saved.ok) throw new Error(saved.error);
  return saved.document.id;
}

describe("work-hour entries", () => {
  it("awards WORK_HOURS_LOGGED once per entry; edits never re-award", async () => {
    const r = await createWorkHourEntry(userId, entry());
    expect(r).toMatchObject({ ok: true, savedAs: "SELF_REPORTED", downgraded: false });
    if (!r.ok) return;
    const key = `xp:hours-entry:${r.entryId}`;
    expect(await ledgerSum(userId, { dedupeKey: key })).toEqual({ sum: 10, count: 1 });
    const row = await prisma.xpLedger.findFirstOrThrow({ where: { userId, dedupeKey: key } });
    expect(row).toMatchObject({ reason: "WORK_HOURS_LOGGED", sourceType: "WorkHourEntry", sourceId: r.entryId, track: "ELECTRICIAN" });

    const u = await updateWorkHourEntry(userId, r.entryId, entry({ hours: 7.5, description: "Panel terminations" }));
    expect(u).toMatchObject({ ok: true });
    expect(await ledgerSum(userId, { sourceType: "WorkHourEntry", sourceId: r.entryId })).toEqual({ sum: 10, count: 1 });
    const saved = await prisma.workHourEntry.findUniqueOrThrow({ where: { id: r.entryId } });
    expect(Number(saved.hours)).toBe(7.5);
    expect(dateKey(saved.dateWorked)).toBe(daysAgo(1));
  });

  it("saves 'verified' hours without a document as self-reported, with an explanation", async () => {
    const r = await createWorkHourEntry(userId, entry({ verification: "EMPLOYER_VERIFIED", dateWorked: daysAgo(2) }));
    expect(r).toMatchObject({ ok: true, savedAs: "SELF_REPORTED", downgraded: true });
    if (r.ok) expect(r.message).toContain(DOWNGRADE_EXPLANATION);
    const r2 = await createWorkHourEntry(userId, entry({ verification: "OFFICIAL_RECORD", dateWorked: daysAgo(2), hours: 1 }));
    expect(r2).toMatchObject({ ok: true, savedAs: "SELF_REPORTED", downgraded: true });
  });

  it("keeps EMPLOYER_VERIFIED / OFFICIAL_RECORD when the user's own proof document is attached", async () => {
    const stub = await upload(userId, "PAY_STUB");
    const ok = await createWorkHourEntry(userId, entry({ verification: "EMPLOYER_VERIFIED", documentId: stub, dateWorked: daysAgo(3) }));
    expect(ok).toMatchObject({ ok: true, savedAs: "EMPLOYER_VERIFIED", downgraded: false });

    const foreign = await upload(otherUserId, "PAY_STUB");
    const bad = await createWorkHourEntry(userId, entry({ verification: "EMPLOYER_VERIFIED", documentId: foreign, dateWorked: daysAgo(3) }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors?.documentId).toBeDefined();

    const cert = await upload(userId, "CERTIFICATE");
    const wrongKind = await createWorkHourEntry(userId, entry({ verification: "OFFICIAL_RECORD", documentId: cert, dateWorked: daysAgo(3) }));
    expect(wrongKind.ok).toBe(false);
  });

  it("uploads a new proof file with the entry and cleans it up when the entry is rejected", async () => {
    const file = { name: "union-report.pdf", size: PDF.byteLength, arrayBuffer: async () => new Uint8Array(PDF).buffer };
    const ok = await createWorkHourEntry(userId, entry({ verification: "OFFICIAL_RECORD", dateWorked: daysAgo(4) }), { newDocument: { kind: "HOURS_VERIFICATION", file } });
    expect(ok).toMatchObject({ ok: true, savedAs: "OFFICIAL_RECORD" });
    if (ok.ok) {
      const e = await prisma.workHourEntry.findUniqueOrThrow({ where: { id: ok.entryId }, include: { document: true } });
      expect(e.document).toMatchObject({ fileName: "union-report.pdf", kind: "HOURS_VERIFICATION" });
    }
    const before = await prisma.document.count({ where: { userId } });
    const rejected = await createWorkHourEntry(userId, entry({ verification: "OFFICIAL_RECORD", dateWorked: daysAgo(4), hours: 24 }), { newDocument: { kind: "HOURS_VERIFICATION", file } });
    expect(rejected.ok).toBe(false);
    expect(await prisma.document.count({ where: { userId } })).toBe(before);
  });

  it("limits one date to 24 hours across entries", async () => {
    const date = daysAgo(10);
    const a = await createWorkHourEntry(userId, entry({ dateWorked: date, hours: 16 }));
    expect(a.ok).toBe(true);
    const over = await createWorkHourEntry(userId, entry({ dateWorked: date, hours: 8.25 }));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.fieldErrors?.hours?.[0]).toContain("at most 8 h more");
    const fits = await createWorkHourEntry(userId, entry({ dateWorked: date, hours: 8 }));
    expect(fits.ok).toBe(true);
    if (a.ok) {
      const grow = await updateWorkHourEntry(userId, a.entryId, entry({ dateWorked: date, hours: 16.25 }));
      expect(grow.ok).toBe(false);
      const same = await updateWorkHourEntry(userId, a.entryId, entry({ dateWorked: date, hours: 16 }));
      expect(same.ok).toBe(true);
    }
  });

  it("rejects future dates and another user's entry", async () => {
    const future = await createWorkHourEntry(userId, entry({ dateWorked: dateKey(addUtcDays(dateFromKey(todayKey()), 2)) }));
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.fieldErrors?.dateWorked).toBeDefined();
    const mine = await createWorkHourEntry(userId, entry({ dateWorked: daysAgo(20) }));
    if (!mine.ok) throw new Error(mine.error);
    expect(await updateWorkHourEntry(otherUserId, mine.entryId, entry())).toMatchObject({ ok: false });
    expect(await deleteWorkHourEntry(otherUserId, mine.entryId)).toMatchObject({ ok: false });
    expect(await prisma.workHourEntry.count({ where: { id: mine.entryId } })).toBe(1);
  });

  it("deleting an entry revokes its XP", async () => {
    const r = await createWorkHourEntry(userId, entry({ dateWorked: daysAgo(30), hours: 2 }));
    if (!r.ok) throw new Error(r.error);
    expect(await ledgerSum(userId, { sourceType: "WorkHourEntry", sourceId: r.entryId })).toMatchObject({ sum: 10 });
    const d = await deleteWorkHourEntry(userId, r.entryId);
    expect(d).toMatchObject({ ok: true, revokedXp: 10 });
    expect(await ledgerSum(userId, { sourceType: "WorkHourEntry", sourceId: r.entryId })).toMatchObject({ sum: 0, count: 2 });
    expect(await prisma.workHourEntry.count({ where: { id: r.entryId } })).toBe(0);
    expect(await deleteWorkHourEntry(userId, r.entryId)).toMatchObject({ ok: false });
  });

  it("summarizes self-reported and verified hours separately and exports CSV", async () => {
    const stub = await upload(userId, "HOURS_VERIFICATION", "school-transcript.pdf");
    const cls = await createWorkHourEntry(userId, entry({ workType: "CLASSROOM", hours: 4, dateWorked: daysAgo(15), verification: "OFFICIAL_RECORD", documentId: stub }));
    expect(cls).toMatchObject({ ok: true, savedAs: "OFFICIAL_RECORD" });
    const all = await prisma.workHourEntry.findMany({ where: { userId } });
    const rows = all.filter((r) => r.workType !== "CLASSROOM");
    const sum = (f: (v: string) => boolean) => rows.filter((r) => f(r.verification)).reduce((a, r) => a + Number(r.hours), 0);
    const s = await getHoursSummary(userId);
    expect(s.totals.selfReported).toBeCloseTo(sum((v) => v === "SELF_REPORTED"), 2);
    expect(s.totals.verified).toBeCloseTo(sum((v) => v !== "SELF_REPORTED"), 2);
    expect(s.totals.entries).toBe(rows.length);
    expect(s.entryCount).toBe(all.length);
    expect(s.classroom.totals).toMatchObject({ verified: 4, selfReported: 0 });
    expect(s.classroom.targets).toEqual({ annualMinimum: 150, routeTotal: 720 });
    expect(s.requirement).toMatchObject({ code: "GENERAL", hoursRequired: 8000, source: "database", verifiedOnKey: "2026-10-21" });
    expect(s.caps?.fromSeed).toBe(true);
    expect(s.weekly).toHaveLength(12);
    expect(s.projection.status).toBe("insufficient");

    const page = await getHoursPageData(userId);
    expect(page.entries.length).toBe(Math.min(25, all.length));
    expect(page.programs.length).toBeGreaterThan(0);

    const csv = await exportHoursCsv(userId);
    expect(csv.rows).toBe(all.length);
    expect(csv.csv.split("\r\n")).toHaveLength(all.length + 1);
  });
});

describe("verified-hour milestones", () => {
  it("awards TRAINING_MILESTONE once at 1,000 verified hours, revokes below it and re-awards at most once net", async () => {
    // Fixture: 41 days × 24 verified hours = 984 h, inserted directly.
    await prisma.workHourEntry.createMany({
      data: Array.from({ length: 41 }, (_, i) => ({
        userId: milestoneUserId,
        employer: "Big Job Electric",
        dateWorked: dateFromKey(daysAgo(100 + i)),
        hours: 24,
        workType: i % 2 ? ("COMMERCIAL" as const) : ("RESIDENTIAL" as const),
        verification: "EMPLOYER_VERIFIED" as const,
      })),
    });
    const stub = await upload(milestoneUserId, "PAY_STUB");
    // Verified classroom hours do not count toward on-the-job milestones.
    const classroom = await createWorkHourEntry(milestoneUserId, entry({ workType: "CLASSROOM", verification: "OFFICIAL_RECORD", documentId: stub, hours: 24, dateWorked: daysAgo(7) }));
    expect(classroom).toMatchObject({ ok: true, milestones: { awarded: [] } });
    expect(await prisma.xpLedger.count({ where: { userId: milestoneUserId, dedupeKey: "xp:hours-milestone:1000" } })).toBe(0);
    const crossing = await createWorkHourEntry(milestoneUserId, entry({ verification: "EMPLOYER_VERIFIED", documentId: stub, hours: 24, dateWorked: daysAgo(5) }));
    expect(crossing).toMatchObject({ ok: true, milestones: { awarded: [1000], revoked: [] } });
    expect(await ledgerSum(milestoneUserId, { dedupeKey: "xp:hours-milestone:1000" })).toEqual({ sum: 100, count: 1 });
    const ach = await prisma.userAchievement.findMany({ where: { userId: milestoneUserId, achievementKey: "verified-hours-1000" } });
    expect(ach).toHaveLength(1);

    const more = await createWorkHourEntry(milestoneUserId, entry({ verification: "EMPLOYER_VERIFIED", documentId: stub, hours: 8, dateWorked: daysAgo(6) }));
    expect(more).toMatchObject({ ok: true, milestones: { awarded: [] } });
    expect(await ledgerSum(milestoneUserId, { sourceType: "WorkHourMilestone", sourceId: "1000" })).toEqual({ sum: 100, count: 1 });
    expect(await prisma.xpLedger.count({ where: { userId: milestoneUserId, dedupeKey: "xp:hours-milestone:2000" } })).toBe(0);

    if (!crossing.ok || !more.ok) return;
    // 984 + 24 + 8 = 1016 → deleting the 24 h entry leaves 992 h: milestone revoked.
    const del = await deleteWorkHourEntry(milestoneUserId, crossing.entryId);
    expect(del.ok).toBe(true);
    if (del.ok) expect(del.message).toContain("Milestone XP for 1,000 verified hours was revoked");
    expect(await ledgerSum(milestoneUserId, { sourceType: "WorkHourMilestone", sourceId: "1000" })).toMatchObject({ sum: 0 });

    // Downgrading by deleting the proof document also counts: re-cross, then delete the stub.
    const again = await createWorkHourEntry(milestoneUserId, entry({ verification: "EMPLOYER_VERIFIED", documentId: stub, hours: 24, dateWorked: daysAgo(5) }));
    expect(again).toMatchObject({ ok: true, milestones: { awarded: [1000] } });
    expect(await ledgerSum(milestoneUserId, { sourceType: "WorkHourMilestone", sourceId: "1000" })).toMatchObject({ sum: 100 });
    const removed = await deleteDocument(milestoneUserId, stub);
    expect(removed).toMatchObject({ ok: true, downgradedEntries: 3 });
    expect(await ledgerSum(milestoneUserId, { sourceType: "WorkHourMilestone", sourceId: "1000" })).toMatchObject({ sum: 0 });
    const summary = await getHoursSummary(milestoneUserId);
    expect(summary.totals.verified).toBe(984);
    expect(summary.totals.selfReported).toBe(32);
  });
});

describe("apprenticeship tracking", () => {
  it("tracks a program with a generated checklist, unlocks the achievement on ACCEPTED and toggles items", async () => {
    const found = await getProgramBySlug(userId, "abc-socal");
    expect(found).not.toBeNull();
    const program = found!.program;
    expect(program.interest).toBeNull();
    expect(program.startingWageVerified).toBe(false);

    expect(await trackProgram(userId, program.id)).toMatchObject({ ok: true, status: "INTERESTED" });
    expect(await trackProgram(userId, program.id)).toMatchObject({ ok: true, message: "Already on your list." });
    const tracked = (await getProgramBySlug(userId, "abc-socal"))!.program.interest!;
    expect(tracked.checklist.some((i) => i.id === "d-dmv")).toBe(true);
    expect(tracked.checklist.some((i) => i.id === "d-resume")).toBe(true);

    const future = await saveProgramInterest(userId, { programId: program.id, status: "APPLIED", appliedAt: dateKey(addUtcDays(dateFromKey(todayKey()), 3)), notes: null });
    expect(future.ok).toBe(false);

    const accepted = await saveProgramInterest(userId, { programId: program.id, status: "ACCEPTED", appliedAt: daysAgo(40), notes: "Orientation in March" });
    expect(accepted).toMatchObject({ ok: true, status: "ACCEPTED" });
    if (accepted.ok) expect(accepted.unlocked).toContain("apprenticeship-accepted");
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "apprenticeship-accepted" } })).toBe(1);

    const item = tracked.checklist.find((i) => i.id === "d-resume")!;
    expect(await toggleChecklistItem(userId, program.id, item.id, true)).toMatchObject({ ok: true });
    const after = (await getProgramBySlug(userId, "abc-socal"))!.program.interest!;
    expect(after).toMatchObject({ status: "ACCEPTED", appliedAtKey: daysAgo(40), notes: "Orientation in March" });
    expect(after.checklist.find((i) => i.id === item.id)!.done).toBe(true);
    expect(after.progress.done).toBe(1);

    expect(await toggleChecklistItem(otherUserId, program.id, item.id, true)).toMatchObject({ ok: false });
    expect(await toggleChecklistItem(userId, program.id, "d-nope", true)).toMatchObject({ ok: false });

    const list = await listPrograms(userId, { region: null, union: "non-union" });
    expect(list.programs.every((p) => !p.isUnion)).toBe(true);
    expect(list.tracked).toBe(1);

    expect(await removeProgramInterest(userId, program.id)).toMatchObject({ ok: true });
    expect(await removeProgramInterest(userId, program.id)).toMatchObject({ ok: false });
  });
});

describe("certification tracker", () => {
  const base = (over: Partial<CertificationStatusInput> = {}): CertificationStatusInput => ({
    classification: "GENERAL",
    traineeRegisteredAt: null,
    traineeExpiresAt: null,
    schoolEnrolled: null,
    examApplicationAt: null,
    examEligibleAt: null,
    examScheduledAt: null,
    examPassedAt: null,
    certifiedAt: null,
    certificateExpiresAt: null,
    notes: null,
    ...over,
  });

  it("verifies only with a certification date and a CERTIFICATE document, awarding XP once", async () => {
    const futureCert = await saveCertificationStatus(userId, base({ certifiedAt: dateKey(addUtcDays(dateFromKey(todayKey()), 5)) }));
    expect(futureCert.ok).toBe(false);

    expect(await verifyCertification(userId, "GENERAL", {})).toMatchObject({ ok: false });

    expect(await saveCertificationStatus(userId, base({ traineeRegisteredAt: daysAgo(400), schoolEnrolled: "Approved Tech", examPassedAt: daysAgo(30), certifiedAt: daysAgo(10) }))).toMatchObject({ ok: true });
    expect(await verifyCertification(userId, "GENERAL", {})).toMatchObject({ ok: false });

    const stub = await upload(userId, "PAY_STUB");
    expect(await verifyCertification(userId, "GENERAL", { documentId: stub })).toMatchObject({ ok: false });

    const newFile = { name: "dir-card.png", size: PNG.byteLength, arrayBuffer: async () => new Uint8Array(PNG).buffer };
    const ok = await verifyCertification(userId, "GENERAL", { newFile });
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.message).toContain("self-attested with document");
    expect(await ledgerSum(userId, { dedupeKey: "xp:certification:GENERAL" })).toEqual({ sum: 1000, count: 1 });
    const v = await getCertificationVerification(userId, "GENERAL");
    expect(v?.fileName).toBe("dir-card.png");
    expect(await prisma.userAchievement.count({ where: { userId, achievementKey: "certified-electrician" } })).toBe(1);

    const again = await verifyCertification(userId, "GENERAL", { documentId: v!.documentId });
    expect(again).toMatchObject({ ok: true });
    if (again.ok) expect(again.message).toContain("Already verified");
    expect(await ledgerSum(userId, { sourceType: "CertificationDocument" })).toMatchObject({ sum: 1000 });

    const page = await getCertificationPageData(userId, "GENERAL");
    expect(page?.verification?.documentId).toBe(v!.documentId);
    expect(page?.timeline.find((s) => s.key === "renewal")).toMatchObject({ estimated: true });
    expect(page?.dirLinks.length).toBeGreaterThan(0);
    expect(page?.eligibility.required).toBe(8000);
    expect(await getCertificationPageData(userId, "NOT_A_CODE")).toBeNull();

    // Deleting the certificate document revokes the verification.
    expect(await deleteDocument(userId, v!.documentId)).toMatchObject({ ok: true, revokedCertifications: ["GENERAL"] });
    expect(await getCertificationVerification(userId, "GENERAL")).toBeNull();
    expect(await ledgerSum(userId, { sourceType: "CertificationDocument" })).toMatchObject({ sum: 0 });

    // Re-verifying re-awards once (net 1000), and removing the mark / clearing the date revokes it.
    const cert2 = await upload(userId, "CERTIFICATE", "card-2.pdf");
    expect(await verifyCertification(userId, "GENERAL", { documentId: cert2 })).toMatchObject({ ok: true });
    expect(await ledgerSum(userId, { sourceType: "CertificationDocument" })).toMatchObject({ sum: 1000 });
    expect(await removeCertificationVerification(userId, "GENERAL")).toMatchObject({ ok: true });
    expect(await ledgerSum(userId, { sourceType: "CertificationDocument" })).toMatchObject({ sum: 0 });
    expect(await verifyCertification(userId, "GENERAL", { documentId: cert2 })).toMatchObject({ ok: true });
    const cleared = await saveCertificationStatus(userId, base({ examPassedAt: daysAgo(30) }));
    expect(cleared).toMatchObject({ ok: true });
    if (cleared.ok) expect(cleared.message).toContain("no longer marked verified");
    expect(await ledgerSum(userId, { sourceType: "CertificationDocument" })).toMatchObject({ sum: 0 });
    expect(await prisma.document.count({ where: { id: cert2 } })).toBe(1);
  });

  it("keeps classifications separate", async () => {
    expect(await saveCertificationStatus(userId, base({ classification: "RESIDENTIAL", traineeRegisteredAt: daysAgo(100) }))).toMatchObject({ ok: true });
    const page = await getCertificationPageData(userId, "RESIDENTIAL");
    expect(page?.requirement).toMatchObject({ code: "RESIDENTIAL", hoursRequired: 4800 });
    expect(page?.dates.traineeRegisteredAt).toBe(daysAgo(100));
    expect(page?.hours.caps).toBeNull();
    expect(page?.trackedClassifications.sort()).toEqual(["GENERAL", "RESIDENTIAL"]);
    expect(await saveCertificationStatus(userId, base({ classification: "BOGUS" }))).toMatchObject({ ok: false });
  });
});
