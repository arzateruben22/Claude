/**
 * Database tests for mobile capture (/share) decisions (own users, cascade cleanup).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";
import { parseSharePayload } from "@/lib/discovery/paste";
import { loadShareContext, shareDecision } from "@/lib/discovery/share";
import { shareDecisionSchema } from "@/lib/discovery/schemas";

let userId = "";
let otherUserId = "";

const URL_A = "https://www.indeed.com/viewjob?jk=5ha7e0001&from=share";

const decide = (over: Record<string, unknown>) =>
  shareDecisionSchema.parse({ decision: "track", url: URL_A, company: "Share Electric", title: "Electrician Helper", location: "Tustin, CA", ...over });

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `share+${stamp}@careerquest.test`, passwordHash: "x", name: "Share Test", profile: { create: { timezone: "America/Los_Angeles" } }, stats: { create: {} } },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `share-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other", profile: { create: {} }, stats: { create: {} } },
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("share decisions", () => {
  it("requires company and title before saving anything", async () => {
    const res = await shareDecision(userId, decide({ company: undefined, title: undefined }));
    expect(res).toMatchObject({ ok: false, reason: "fields" });
    if (!res.ok && res.reason === "fields") expect(Object.keys(res.fieldErrors).sort()).toEqual(["company", "title"]);
    expect(await prisma.jobLead.count({ where: { userId } })).toBe(0);
  });

  it("Save as lead creates a Job Discovery lead with eligibility flags from the shared text; sharing it again is a duplicate", async () => {
    const res = await shareDecision(userId, decide({ decision: "lead", sharedText: "Must have a clean driving record." }));
    expect(res).toMatchObject({ ok: true, href: "/discovery", applicationId: null });
    const lead = await prisma.jobLead.findFirstOrThrow({ where: { userId } });
    expect(lead).toMatchObject({ source: "INDEED", normalizedUrl: "https://indeed.com/viewjob?jk=5ha7e0001", requiresDrivingRecord: true, status: "NEW" });
    expect(await shareDecision(userId, decide({ decision: "lead" }))).toMatchObject({ ok: false, reason: "duplicate" });
    expect(await prisma.application.count({ where: { userId } })).toBe(0);
  });

  it("Save to tracker creates a Saved record from the phone and converts the matching lead", async () => {
    const res = await shareDecision(userId, decide({ decision: "track" }));
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    const app = await prisma.application.findUniqueOrThrow({ where: { id: res.applicationId! } });
    expect(app).toMatchObject({ status: "SAVED", createdVia: "MOBILE", appliedAt: null, source: "INDEED" });
    const lead = await prisma.jobLead.findFirstOrThrow({ where: { userId } });
    expect(lead).toMatchObject({ status: "CONVERTED", convertedApplicationId: app.id });
    expect(res.href).toBe(`/applications/${app.id}`);
  });

  it("shows the tracked record when the same posting is shared again", async () => {
    const draft = parseSharePayload({ title: "Electrician Helper - Share Electric - Tustin, CA - Indeed.com", text: URL_A });
    const ctx = await loadShareContext(userId, draft);
    expect(ctx.matches).toHaveLength(1);
    expect(ctx.matches[0]).toMatchObject({ label: "Share Electric – Electrician Helper", statusLabel: "Saved" });
    expect(ctx.lead).toMatchObject({ status: "CONVERTED" });
    const other = await loadShareContext(otherUserId, draft);
    expect(other.matches).toEqual([]);
  });

  it("I applied moves that same record to Submitted (verified), once", async () => {
    const res = await shareDecision(userId, decide({ decision: "applied" }));
    expect(res).toMatchObject({ ok: true });
    const apps = await prisma.application.findMany({ where: { userId, normalizedCompany: "share electric" } });
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ status: "SUBMITTED", statusVerified: true });
    expect(apps[0]!.appliedAt).not.toBeNull();
    const again = await shareDecision(userId, decide({ decision: "applied" }));
    expect(again).toMatchObject({ ok: true });
    if (again.ok) expect(again.message).toMatch(/already has this recorded/);
    const xp = await prisma.xpLedger.count({ where: { userId, reason: "APPLICATION_SUBMITTED" } });
    expect(xp).toBe(1);
  });

  it("I applied without a link still records the job, and never attaches to another user's application", async () => {
    const res = await shareDecision(userId, decide({ decision: "applied", url: undefined, company: "Text Only Electric", title: "Wireman" }));
    expect(res).toMatchObject({ ok: true });
    const foreign = await createApplication(otherUserId, applicationInputSchema.parse({ companyName: "Foreign", positionTitle: "Helper" }));
    const attach = await shareDecision(userId, decide({ decision: "applied", attachTo: foreign.application.id }));
    expect(attach).toMatchObject({ ok: false, reason: "not_found" });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: foreign.application.id } })).status).toBe("SAVED");
  });

  it("asks the user to choose between uncertain matches, then honors the choice", async () => {
    for (let i = 0; i < 2; i++) {
      await createApplication(userId, applicationInputSchema.parse({ companyName: "Pair Electric", positionTitle: "Apprentice Electrician" }));
    }
    const base = { decision: "applied", url: undefined, company: "Pair Electric", title: "Apprentice Electrician", location: undefined };
    const choose = await shareDecision(userId, decide(base));
    expect(choose).toMatchObject({ ok: false, reason: "choose" });
    if (choose.ok || choose.reason !== "choose") return;
    expect(choose.candidates).toHaveLength(2);
    const picked = await shareDecision(userId, decide({ ...base, attachTo: choose.candidates[0]!.id }));
    expect(picked).toMatchObject({ ok: true, applicationId: choose.candidates[0]!.id });
    const created = await shareDecision(userId, decide({ ...base, decision: "track", force: "1" }));
    expect(created).toMatchObject({ ok: true });
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "pair electric" } })).toBe(3);
  });
});
