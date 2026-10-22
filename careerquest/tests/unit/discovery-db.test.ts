/**
 * Database tests for Job Discovery services (own users, cascade cleanup).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";
import { ingestObservation } from "@/lib/ingest/engine";
import { convertLead, createLead, deleteLead, listLeads, setLeadStatus, updateLead } from "@/lib/discovery/leads";
import { createTargetCompany, deleteTargetCompany, listTargetCompanies, updateTargetCompany, DAILY_XP_CAP } from "@/lib/discovery/companies";
import { leadInputSchema, targetCompanySchema } from "@/lib/discovery/schemas";
import { XP } from "@/lib/game/xp-config";

let userId = "";
let otherUserId = "";

const lead = (over: Record<string, unknown> = {}) => leadInputSchema.parse({ title: "Apprentice Electrician", company: "Volt Line Electric", location: "Anaheim, CA", ...over });
const company = (over: Record<string, unknown> = {}) => targetCompanySchema.parse({ name: "Acme Electric", priority: "2", ...over });

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `discovery+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Discovery Test",
      profile: { create: { timezone: "America/Los_Angeles", careerInterests: ["Electrician"], immediateSalaryTarget: 80000 } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `discovery-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other", profile: { create: {} }, stats: { create: {} } },
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("leads", () => {
  it("creates a lead with detected source, normalized URL, flags from the pasted text and a stored score", async () => {
    const res = await createLead(
      userId,
      lead({ url: "https://www.indeed.com/viewjob?jk=feedbeef01&from=serp", salaryText: "$24 - $28 an hour" }),
      { postingText: "Requires a valid driver's license. Company truck provided." },
    );
    expect(res).toMatchObject({ ok: true });
    const row = await prisma.jobLead.findFirstOrThrow({ where: { userId, normalizedUrl: "https://indeed.com/viewjob?jk=feedbeef01" } });
    expect(row).toMatchObject({ source: "INDEED", status: "NEW", requiresDrivingRecord: true, requiresCompanyVehicle: true, requiresCdl: false });
    expect(row.matchScore).toBeGreaterThan(50);
  });

  it("trusts the reviewed checkboxes when the form showed them", async () => {
    const res = await createLead(userId, lead({ title: "Wireman", url: "https://example-electric.com/jobs/88" }), {
      postingText: "Clean driving record required",
      flagsReviewed: true,
    });
    expect(res.ok).toBe(true);
    const row = await prisma.jobLead.findFirstOrThrow({ where: { userId, title: "Wireman" } });
    expect(row.requiresDrivingRecord).toBe(false);
  });

  it("refuses duplicates of leads and of tracked applications (by normalized URL, or company+title without a URL)", async () => {
    const again = await createLead(userId, lead({ url: "https://indeed.com/viewjob?jk=feedbeef01" }));
    expect(again).toMatchObject({ ok: false, reason: "duplicate_lead" });
    const tracked = await createApplication(userId, applicationInputSchema.parse({ companyName: "Tracked Co", positionTitle: "Helper", postingUrl: "https://boards.greenhouse.io/tracked/jobs/555" }));
    const t = await createLead(userId, lead({ company: "Tracked Co", title: "Helper", url: "https://boards.greenhouse.io/tracked/jobs/555?gh_src=x" }));
    expect(t).toMatchObject({ ok: false, reason: "tracked", applicationId: tracked.application.id });
    expect((await createLead(userId, lead({ company: "No Url Co", title: "Journeyman" }))).ok).toBe(true);
    expect(await createLead(userId, lead({ company: "No URL Co.", title: "journeyman" }))).toMatchObject({ ok: false, reason: "duplicate_lead" });
  });

  it("hides leads flagged by the private filters behind the hidden list and sorts by fit", async () => {
    await createLead(userId, lead({ company: "Truck Co", title: "Electrician Driver", requiresCdl: "on" }), { flagsReviewed: true });
    await prisma.userProfile.update({ where: { userId }, data: { excludeCdlJobs: true } });
    const list = await listLeads(userId, "active");
    expect(list.hidden.map((l) => l.company)).toEqual(["Truck Co"]);
    expect(list.items.every((l) => l.hiddenBy.length === 0)).toBe(true);
    expect(list.hidden[0]!.hiddenBy).toEqual(["requiresCdl"]);
    const scores = list.items.map((l) => l.score.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(list.counts.active).toBe(list.items.length + list.hidden.length);
    await prisma.userProfile.update({ where: { userId }, data: { excludeCdlJobs: false } });
    expect((await listLeads(userId, "active")).hidden).toEqual([]);
  });

  it("updates, dismisses, restores and deletes only the user's own leads", async () => {
    const created = await createLead(userId, lead({ company: "Edit Me Electric", title: "Helper" }));
    if (!created.ok) throw new Error("setup");
    const id = created.leadId;
    expect(await updateLead(userId, id, lead({ company: "Edit Me Electric", title: "Senior Helper", url: "https://editme.example.com/j/1" }))).toMatchObject({ ok: true });
    expect((await prisma.jobLead.findUniqueOrThrow({ where: { id } })).source).toBe("COMPANY_SITE");
    expect(await setLeadStatus(otherUserId, id, "DISMISSED")).toMatchObject({ ok: false });
    expect(await setLeadStatus(userId, id, "DISMISSED")).toMatchObject({ ok: true });
    expect((await listLeads(userId, "dismissed")).items.map((l) => l.id)).toContain(id);
    expect(await setLeadStatus(userId, id, "SAVED")).toMatchObject({ ok: true });
    expect(await deleteLead(otherUserId, id)).toMatchObject({ ok: false });
    expect(await updateLead(otherUserId, id, lead())).toMatchObject({ ok: false, reason: "not_found" });
    expect(await deleteLead(userId, id)).toMatchObject({ ok: true });
  });
});

describe("converting leads", () => {
  it("Convert to application creates a Saved record (origin URL_IMPORT) with the lead's flags, and links the lead", async () => {
    const created = await createLead(userId, lead({ company: "Convert Electric", title: "Apprentice", url: "https://jobs.lever.co/convert/11111111-2222-4333-8444-000000000001", salaryText: "$25/hr", requiresCompanyVehicle: "on" }), { flagsReviewed: true });
    if (!created.ok) throw new Error("setup");
    const res = await convertLead(userId, created.leadId, { mode: "saved" });
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    const app = await prisma.application.findUniqueOrThrow({ where: { id: res.applicationId } });
    expect(app).toMatchObject({ status: "SAVED", createdVia: "URL_IMPORT", source: "LEVER", requiresCompanyVehicle: true, appliedAt: null, salaryPeriod: "HOURLY" });
    expect(Number(app.salaryMin)).toBe(25);
    const l = await prisma.jobLead.findUniqueOrThrow({ where: { id: created.leadId } });
    expect(l).toMatchObject({ status: "CONVERTED", convertedApplicationId: res.applicationId });
    // Converting again is idempotent.
    expect(await convertLead(userId, created.leadId, { mode: "saved" })).toMatchObject({ ok: true, applicationId: res.applicationId });
    // "I already applied" on the converted lead moves that same record forward.
    const applied = await convertLead(userId, created.leadId, { mode: "applied" });
    expect(applied).toMatchObject({ ok: true, applicationId: res.applicationId });
    const after = await prisma.application.findUniqueOrThrow({ where: { id: res.applicationId } });
    expect(after).toMatchObject({ status: "SUBMITTED", statusVerified: true });
    expect(after.appliedAt).not.toBeNull();
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "convert electric" } })).toBe(1);
  });

  it("I already applied matches an email-imported record instead of duplicating it", async () => {
    const email = await ingestObservation(userId, {
      kind: "SUBMITTED",
      source: "EMAIL",
      origin: "EMAIL",
      observedAt: new Date(Date.now() - 86_400_000),
      company: "Mailbox Electric",
      title: "Journeyman Electrician",
      postingUrl: "https://mailbox.wd1.myworkdayjobs.com/External/job/Irvine-CA/Journeyman-Electrician_R-55501",
      confidence: 0.95,
      verified: true,
      evidence: { kind: "EMAIL", sourceRef: `EML:discovery-${Date.now()}@test`, data: { senderKind: "ats" } },
    });
    const created = await createLead(userId, lead({ company: "Mailbox Electric", title: "Journeyman Electrician", url: "https://mailbox.wd1.myworkdayjobs.com/External/job/Irvine-CA/Journeyman-Electrician_R-55501?source=LinkedIn" }));
    expect(created).toMatchObject({ ok: false, reason: "tracked", applicationId: email.applicationId });
    // A lead added without the URL still converts onto the same record.
    const noUrl = await createLead(userId, lead({ company: "Mailbox Electric", title: "Journeyman Electrician", location: "Irvine, CA" }));
    if (!noUrl.ok) throw new Error("setup");
    const res = await convertLead(userId, noUrl.leadId, { mode: "applied" });
    expect(res).toMatchObject({ ok: true, applicationId: email.applicationId });
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "mailbox electric" } })).toBe(1);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: email.applicationId! } });
    expect(app.status).toBe("CONFIRMED");
  });

  it("asks the user to choose when the match is uncertain, then attaches or creates as told", async () => {
    for (let i = 0; i < 2; i++) {
      await createApplication(userId, applicationInputSchema.parse({ companyName: "Twin Electric", positionTitle: "Apprentice Electrician", location: "Irvine, CA" }));
    }
    const a = await createLead(userId, lead({ company: "Twin Electric", title: "Apprentice Electrician", location: "Irvine, CA", notes: "first" }));
    if (!a.ok) throw new Error("setup");
    const choose = await convertLead(userId, a.leadId, { mode: "applied" });
    expect(choose).toMatchObject({ ok: false, reason: "choose" });
    if (choose.ok || choose.reason !== "choose") return;
    expect(choose.candidates).toHaveLength(2);
    expect(choose.candidates[0]!.label).toBe("Twin Electric – Apprentice Electrician");
    const target = choose.candidates[1]!.id;
    const attached = await convertLead(userId, a.leadId, { mode: "applied", attachTo: target });
    expect(attached).toMatchObject({ ok: true, applicationId: target });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: target } })).status).toBe("SUBMITTED");

    const saved = await convertLead(userId, a.leadId, { mode: "saved" });
    expect(saved).toMatchObject({ ok: true, applicationId: target });

    await prisma.jobLead.deleteMany({ where: { id: a.leadId } });
    const b = await createLead(userId, lead({ company: "Twin Electric", title: "Apprentice Electrician", location: "Irvine, CA", notes: "second" }));
    if (!b.ok) throw new Error("setup");
    const forced = await convertLead(userId, b.leadId, { mode: "saved", force: true });
    expect(forced).toMatchObject({ ok: true });
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "twin electric" } })).toBe(3);
  });

  it("never converts another user's lead or attaches to another user's application", async () => {
    const mine = await createLead(userId, lead({ company: "Mine Only", title: "Helper" }));
    if (!mine.ok) throw new Error("setup");
    expect(await convertLead(otherUserId, mine.leadId, { mode: "saved" })).toMatchObject({ ok: false, reason: "not_found" });
    const foreign = await createApplication(otherUserId, applicationInputSchema.parse({ companyName: "Foreign", positionTitle: "Helper" }));
    expect(await convertLead(userId, mine.leadId, { mode: "applied", attachTo: foreign.application.id })).toMatchObject({ ok: false, reason: "not_found" });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: foreign.application.id } })).status).toBe("SAVED");
  });
});

describe("target companies", () => {
  it("adds a company once with XP keyed by its normalized name, and counts the user's applications to it", async () => {
    await createApplication(userId, applicationInputSchema.parse({ companyName: "Acme Electric, Inc.", positionTitle: "Electrician" }));
    await createApplication(otherUserId, applicationInputSchema.parse({ companyName: "Acme Electric", positionTitle: "Electrician" }));
    const res = await createTargetCompany(userId, company({ careersUrl: "https://acme.example.com/careers", priority: "1" }));
    expect(res).toMatchObject({ ok: true, xpAwarded: XP.TARGET_COMPANY_ADDED });
    const ledger = await prisma.xpLedger.findFirstOrThrow({ where: { userId, reason: "TARGET_COMPANY_ADDED" } });
    expect(ledger.dedupeKey).toBe("xp:target-company:acme electric");
    expect(await createTargetCompany(userId, company({ name: "The Acme Electric Co." }))).toMatchObject({ ok: false, reason: "duplicate" });
    const list = await listTargetCompanies(userId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Acme Electric", priority: 1, applicationCount: 1, careersUrl: "https://acme.example.com/careers" });
    expect(list[0]!.applicationsHref).toBe("/applications?q=Acme+Electric&archived=1");
  });

  it("revokes XP on delete, refuses other users' rows, and caps XP-earning additions per 24 hours", async () => {
    const [acme] = await listTargetCompanies(userId);
    expect(await updateTargetCompany(otherUserId, acme!.id, company())).toMatchObject({ ok: false, reason: "not_found" });
    expect((await deleteTargetCompany(otherUserId, acme!.id)).ok).toBe(false);
    const del = await deleteTargetCompany(userId, acme!.id);
    expect(del).toMatchObject({ ok: true, xpRevoked: XP.TARGET_COMPANY_ADDED });
    const stats = await prisma.playerStats.findUniqueOrThrow({ where: { userId } });
    const sum = await prisma.xpLedger.aggregate({ where: { userId, reason: { in: ["TARGET_COMPANY_ADDED", "REVOKED_TARGET_COMPANY_ADDED"] } }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(0);
    expect(stats.totalXp).toBeGreaterThanOrEqual(0);

    let awarded = 0;
    for (let i = 0; i < DAILY_XP_CAP + 1; i++) {
      const r = await createTargetCompany(userId, company({ name: `Cap Test Electric ${i}` }));
      if (r.ok) awarded += r.xpAwarded > 0 ? 1 : 0;
    }
    // One award already happened in the last 24 h (Acme); the cap counts it.
    expect(awarded).toBe(DAILY_XP_CAP - 1);
  });
});
