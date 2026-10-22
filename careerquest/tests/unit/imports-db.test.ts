/**
 * Imports end to end against the real ingestion engine and the test database:
 * - re-importing the same spreadsheet creates nothing new (second run: all duplicates);
 * - LinkedIn's export: only date/company/title/URL are imported, contact details and Q&A never stored;
 * - job-URL lists create saved leads or ask for details, never submissions;
 * - email files: content-checked, unrelated mail not stored, matched to existing records, idempotent.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestObservation } from "@/lib/ingest/engine";
import type { ApplicationObservation } from "@/lib/ingest/types";
import { importEmails } from "@/lib/imports/email-files";
import { suggestMapping } from "@/lib/imports/mapping";
import { PRESETS } from "@/lib/imports/presets";
import { importSpreadsheet, readSpreadsheet } from "@/lib/imports/spreadsheet";
import { importUrls } from "@/lib/imports/url-import";

const TZ = "America/Los_Angeles";
const TODAY = "2026-10-22";
const ingest = (userId: string, o: ApplicationObservation) => ingestObservation(userId, o);
const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const FILES = fs.readdirSync(DIR);
const fixture = (prefix: string) => fs.readFileSync(path.join(DIR, FILES.find((f) => f.startsWith(prefix))!));

const users: string[] = [];
async function makeUser(tag: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({ data: { email: `imports-${tag}+${stamp}@careerquest.test`, passwordHash: "x", name: `Imports ${tag}` } });
  users.push(u.id);
  return u.id;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

const CSV = [
  "﻿Company,Job Title,Date Applied,Status,Job URL,Location,Notes",
  'Acme Electric,Apprentice Electrician,01/05/2026,Applied,https://www.indeed.com/viewjob?jk=aa11bb22&from=serp,"Anaheim, CA",Referred by Sam',
  'Beta Builders,"Electrician Helper, Commercial",2026-02-10,,,Irvine CA,',
  "Gamma Power,Maintenance Technician,,,,Long Beach,Saved for later",
  "",
  'Delta Lighting,Lighting Technician,"Mar 3, 2026",Interview scheduled,,,',
  ",,,,,,",
  "Bad Row,,2026-01-01,,,,",
].join("\r\n");

async function importCsv(userId: string, bytes: Buffer, fileName = "tracker.csv") {
  const read = await readSpreadsheet(fileName, bytes, "generic");
  if (!read.ok) throw new Error(read.error);
  const mapping = suggestMapping(read.table.headers);
  const res = await importSpreadsheet(userId, { fileName, bytes, presetId: "generic", mapping, timezone: TZ, todayKey: TODAY }, ingest);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

describe("spreadsheet import (real ingestion engine)", () => {
  let userId = "";
  beforeAll(async () => {
    userId = await makeUser("csv");
  });

  it("creates records from valid rows, reports invalid rows, and re-importing the same file creates nothing new", async () => {
    const bytes = Buffer.from(CSV, "utf8");
    const first = await importCsv(userId, bytes);
    expect(first.totals).toMatchObject({ total: 5, created: 4, updated: 0, duplicate: 0, errors: 1 });
    expect(first.status).toBe("PARTIAL");
    expect(first.issues.filter((i) => i.type === "error")).toEqual([{ row: 8, type: "error", message: "Job title is empty." }]);

    const apps = await prisma.application.findMany({ where: { userId }, orderBy: { companyName: "asc" } });
    expect(apps.map((a) => a.companyName)).toEqual(["Acme Electric", "Beta Builders", "Delta Lighting", "Gamma Power"]);
    const acme = apps.find((a) => a.companyName === "Acme Electric")!;
    expect(acme).toMatchObject({ status: "SUBMITTED", createdVia: "CSV_IMPORT", statusVerified: false, source: "INDEED", location: "Anaheim, CA" });
    expect(acme.appliedAt?.toISOString()).toBe("2026-01-05T20:00:00.000Z");
    const gamma = apps.find((a) => a.companyName === "Gamma Power")!;
    expect(gamma).toMatchObject({ status: "SAVED", appliedAt: null });
    expect(apps.find((a) => a.companyName === "Beta Builders")!.positionTitle).toBe("Electrician Helper, Commercial");

    const evidence = await prisma.evidence.findMany({ where: { userId, kind: "CSV_ROW" } });
    expect(evidence).toHaveLength(4);
    expect(evidence.every((e) => /^[0-9a-f]{64}$/.test(e.sourceRef) && e.applicationId)).toBe(true);
    expect(evidence.find((e) => e.applicationId === acme.id)!.snippet).toBe("Referred by Sam");

    const second = await importCsv(userId, bytes);
    expect(second.totals).toMatchObject({ total: 5, created: 0, updated: 0, duplicate: 4, needsReview: 0, errors: 1 });
    expect(await prisma.application.count({ where: { userId } })).toBe(4);
    expect(await prisma.evidence.count({ where: { userId, kind: "CSV_ROW" } })).toBe(4);

    const batches = await prisma.importBatch.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(batches).toHaveLength(2);
    expect(batches[0]).toMatchObject({ kind: "CSV", fileName: "tracker.csv", status: "PARTIAL" });
    expect(batches[1]!.totals).toMatchObject({ duplicate: 4, created: 0 });
    expect(batches[1]!.errors).toEqual([{ row: 8, type: "error", message: "Job title is empty." }]);
  });

  it("the same rows in a different file format (TSV with reordered columns) are still duplicates", async () => {
    const tsv = [
      "Date Applied\tCompany\tJob Title\tStatus\tJob URL\tLocation",
      "2026-01-05\tACME ELECTRIC\tApprentice Electrician\tsubmitted\thttps://indeed.com/viewjob?jk=AA11BB22\tAnaheim, CA",
    ].join("\n");
    const res = await importCsv(userId, Buffer.from(tsv), "tracker.tsv");
    expect(res.totals).toMatchObject({ total: 1, duplicate: 1, created: 0 });
  });

  it("validates the mapping server-side", async () => {
    const bytes = Buffer.from(CSV);
    const res = await importSpreadsheet(userId, { fileName: "t.csv", bytes, presetId: "generic", mapping: { company: 0 }, timezone: TZ, todayKey: TODAY }, ingest);
    expect(res).toEqual({ ok: false, error: "Choose the column that holds “Job title”." });
    const bad = await importSpreadsheet(userId, { fileName: "t.csv", bytes, presetId: "generic", mapping: { company: 0, title: 42 }, timezone: TZ, todayKey: TODAY }, ingest);
    expect(bad.ok).toBe(false);
  });
});

describe("LinkedIn export import", () => {
  it("imports only date, company, title and URL; contact details and Q&A are never stored", async () => {
    const userId = await makeUser("linkedin");
    const csv = [
      "Application Date,Contact Email,Contact Phone Number,Company Name,Job Title,Job Url,Resume Name,Question And Answers",
      '"10/14/25, 3:41 PM",ruben.private@example.com,+1 714-555-0199,Harbor Line Electric,Electrician Apprentice,https://www.linkedin.com/jobs/view/4012345678/,Ruben_Resume_2025.pdf,"Do you have a valid driver\'s license?: Yes | Years of experience: 2"',
      '"9/30/25, 10:02 AM",ruben.private@example.com,+1 714-555-0199,Sunrise Solar,PV Installer,https://www.linkedin.com/jobs/view/4011111111/,Ruben_Resume_2025.pdf,',
    ].join("\n");
    const bytes = Buffer.from(csv);
    const read = await readSpreadsheet("Job Applications.csv", bytes, "linkedin");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.table.headers).toEqual(["Application Date", "Company Name", "Job Title", "Job Url"]);
    expect(JSON.stringify(read.table)).not.toContain("714-555");
    const mapping = suggestMapping(read.table.headers, PRESETS.linkedin.headerHints);
    // A notes mapping is not allowed for this preset and is dropped server-side.
    const res = await importSpreadsheet(
      userId,
      { fileName: "Job Applications.csv", bytes, presetId: "linkedin", mapping: { ...mapping, notes: 1 }, timezone: TZ, todayKey: TODAY },
      ingest,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ kind: "PLATFORM_EXPORT", totals: { total: 2, created: 2, errors: 0 } });

    const apps = await prisma.application.findMany({ where: { userId }, orderBy: { companyName: "asc" } });
    expect(apps.map((a) => [a.companyName, a.positionTitle, a.source, a.status])).toEqual([
      ["Harbor Line Electric", "Electrician Apprentice", "LINKEDIN", "SUBMITTED"],
      ["Sunrise Solar", "PV Installer", "LINKEDIN", "SUBMITTED"],
    ]);
    expect(apps[0]!.normalizedUrl).toBe("https://linkedin.com/jobs/view/4012345678");
    const everything = JSON.stringify([
      apps,
      await prisma.evidence.findMany({ where: { userId } }),
      await prisma.importBatch.findMany({ where: { userId } }),
      await prisma.applicationEvent.findMany({ where: { userId } }),
      await prisma.applicationSourceLink.findMany({ where: { application: { userId } } }),
    ]);
    for (const secret of ["714-555-0199", "ruben.private@example.com", "driver's license", "Ruben_Resume_2025", "Years of experience"]) {
      expect(everything).not.toContain(secret);
    }
  });
});

describe("job URL import", () => {
  it("creates saved leads (never submissions), asks for details it cannot infer, and is idempotent", async () => {
    const userId = await makeUser("urls");
    const text = [
      "https://boards.greenhouse.io/omegacontrols/jobs/777 | Omega Controls | Controls Technician",
      "https://www.linkedin.com/jobs/view/solar-installer-at-sunrise-energy-3999999999/",
      "https://www.indeed.com/viewjob?jk=zz99&from=serp",
      "not a url",
    ].join("\n");
    const first = await importUrls(userId, text, ingest);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.totals).toMatchObject({ total: 4, created: 2, errors: 1 });
    expect(first.data.totals.needsReview + first.data.totals.ignored).toBe(1);
    const indeedIssue = first.data.issues.find((i) => i.row === 3 && i.type !== "warning")!;
    expect(indeedIssue.message).toMatch(/Add “\| Company \| Job title”/);
    expect(indeedIssue.message).not.toMatch(/review queue/);
    expect(first.data.issues.find((i) => i.row === 2 && i.type === "warning")!.message).toMatch(/Sunrise Energy — Solar Installer/);

    const apps = await prisma.application.findMany({ where: { userId }, orderBy: { companyName: "asc" } });
    expect(apps.map((a) => [a.companyName, a.positionTitle, a.status, a.appliedAt, a.createdVia])).toEqual([
      ["Omega Controls", "Controls Technician", "SAVED", null, "URL_IMPORT"],
      ["Sunrise Energy", "Solar Installer", "SAVED", null, "URL_IMPORT"],
    ]);
    expect(await prisma.applicationEvent.count({ where: { userId, type: "APPLIED" } })).toBe(0);

    const again = await importUrls(userId, text, ingest);
    expect(again.ok && again.data.totals).toMatchObject({ created: 0, duplicate: 2 });
    expect(await prisma.application.count({ where: { userId } })).toBe(2);
    expect(await prisma.importBatch.count({ where: { userId, kind: "URL_LIST" } })).toBe(2);
  });
});

describe("email file import", () => {
  it("checks content, skips unrelated mail, matches existing records and is idempotent", async () => {
    const userId = await makeUser("email");
    // An existing record the Indeed confirmation (fixture 001) should match.
    const csv = "Company,Job Title,Date Applied\nAcme Electric,Apprentice Electrician,01/12/2026\n";
    await importCsv(userId, Buffer.from(csv));
    expect(await prisma.application.count({ where: { userId } })).toBe(1);

    const mbox = Buffer.concat([Buffer.from("From noreply@greenhouse.io Mon Jan 12 09:00:00 2026\n"), fixture("027-"), Buffer.from("\n")]);
    const files = [
      { name: "001.eml", bytes: fixture("001-") },
      { name: "alert.eml", bytes: fixture("034-") },
      { name: "newsletter.eml", bytes: fixture("040-") },
      { name: "rejections.mbox", bytes: mbox },
      { name: "notes.txt", bytes: Buffer.from("hello") },
    ];
    const first = await importEmails(userId, { files, pasted: null }, ingest);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.kind).toBe("MBOX");
    expect(first.data.totals.total).toBe(5);
    expect(first.data.totals.errors).toBe(1);
    expect(first.data.totals.ignored).toBeGreaterThanOrEqual(2); // alert + unrelated newsletter
    expect(first.data.issues.some((i) => /notes\.txt/.test(i.message))).toBe(true);

    const rows = await prisma.emailMessage.findMany({ where: { userId } });
    expect(rows.some((r) => r.classification === "UNRELATED")).toBe(false);
    expect(rows.find((r) => r.classification === "JOB_ALERT")).toBeTruthy();
    expect(rows.every((r) => r.importBatchId === first.data.batchId)).toBe(true);
    expect(rows.map((r) => r.provider).sort()).toEqual(["EML", "EML", "MBOX"]);

    // The Indeed confirmation matched the imported record instead of creating a second one.
    const acme = await prisma.application.findMany({ where: { userId, normalizedCompany: "acme electric" } });
    expect(acme).toHaveLength(1);
    const confirmation = rows.find((r) => r.classification === "APPLICATION_SUBMITTED")!;
    expect(confirmation.applicationId === acme[0]!.id || confirmation.reviewStatus === "NEEDS_REVIEW").toBe(true);

    const appCount = await prisma.application.count({ where: { userId } });
    const second = await importEmails(userId, { files: files.slice(0, 4), pasted: null }, ingest);
    expect(second.ok && second.data.totals.created).toBe(0);
    expect(await prisma.application.count({ where: { userId } })).toBe(appCount);
    expect(await prisma.emailMessage.count({ where: { userId } })).toBe(rows.length);
  });

  it("accepts pasted source and rejects uploads with nothing importable", async () => {
    const userId = await makeUser("email-paste");
    const pasted = await importEmails(userId, { files: [], pasted: fixture("005-").toString("utf8") }, ingest);
    expect(pasted.ok && pasted.data.kind).toBe("EML");
    expect(await prisma.emailMessage.count({ where: { userId, provider: "PASTE" } })).toBe(1);

    const bad = await importEmails(userId, { files: [{ name: "x.eml", bytes: Buffer.from("just text, no headers") }], pasted: null }, ingest);
    expect(bad).toEqual({ ok: false, error: "x.eml: this does not look like an email (no message headers found)." });
    const big = await importEmails(userId, { files: [{ name: "big.mbox", bytes: Buffer.alloc(26 * 1024 * 1024, 65) }], pasted: null }, ingest);
    expect(big.ok).toBe(false);
  });
});
