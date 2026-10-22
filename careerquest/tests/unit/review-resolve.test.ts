/**
 * Database tests for the review queue loaders and decisions (own users, cascade cleanup). Email rows
 * are produced by the real email pipeline with the real ingestion engine.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processRawEmail } from "@/lib/email/pipeline";
import type { EmailProvider } from "@/lib/email/observation";
import { ingestObservation } from "@/lib/ingest/engine";
import { IngestValidationError } from "@/lib/ingest/rules";
import {
  ReviewError,
  getReviewCounts,
  loadAttachOptions,
  loadCaptureReview,
  loadDuplicateReview,
  loadEmailReview,
  resolveCaptureReview,
  resolveEmailReview,
  resolveInterviewInvite,
} from "@/lib/ingest/review";
import { scanDuplicates } from "@/lib/dedup/scan";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";

const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".eml"));
const fixture = (prefix: string) => fs.readFileSync(path.join(DIR, FILES.find((f) => f.startsWith(prefix))!));

let userId = "";
let otherUserId = "";

const run = (prefix: string, provider: EmailProvider = "EML") =>
  processRawEmail(userId, fixture(prefix), { provider }, (u, o) => ingestObservation(u, o));

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `review+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Review Test",
      profile: { create: { timezone: "America/Los_Angeles" } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({ data: { email: `review-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" } });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("email review", () => {
  it("lists a low-confidence email with editable fields and the matching record, then attaches it", async () => {
    const workday = await run("003");
    expect(workday.action).toBe("ingested");
    const review = await run("014");
    expect(review.action).toBe("needs_review");

    const { items, total } = await loadEmailReview(userId);
    expect(total).toBe(1);
    const item = items[0]!;
    expect(item).toMatchObject({ id: review.emailMessageId, classificationLabel: "Employer acknowledgment", verifiedSender: false, isInterview: false });
    expect(item.fields).toMatchObject({ company: "Harbor Line Elevator Co.", title: "Elevator Mechanic Helper", status: "CONFIRMED" });
    expect(item.reason).toMatch(/below the 80%/);
    expect(item.body).toBeTruthy();
    expect(item.candidates[0]).toMatchObject({ applicationId: workday.applicationId, score: 1 });
    expect(item.candidates[0]!.signals[0]!.label).toMatch(/Same requisition R-2026-01844/);
    expect(await getReviewCounts(userId)).toMatchObject({ emails: 1 });

    const out = await resolveEmailReview(userId, item.id, { kind: "attach", applicationId: workday.applicationId! }, { status: "CONFIRMED" });
    expect(out.applicationId).toBe(workday.applicationId);
    expect(out.message).toMatch(/^Attached to Harbor Line Elevator Co\. – Elevator Mechanic Helper/);
    const row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: item.id } });
    expect(row).toMatchObject({ reviewStatus: "CONFIRMED", applicationId: workday.applicationId, bodyText: null });
    expect(row.extracted).toMatchObject({ observation: { verified: true, applicationId: workday.applicationId } });
    expect(await prisma.evidence.count({ where: { userId, applicationId: workday.applicationId } })).toBe(2);
    expect((await loadEmailReview(userId)).total).toBe(0);

    await expect(resolveEmailReview(userId, item.id, { kind: "dismiss" }, { status: "SAVED" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(resolveEmailReview(otherUserId, item.id, { kind: "dismiss" }, { status: "SAVED" })).rejects.toBeInstanceOf(ReviewError);
  });

  it("creates a new record with the user's edits, or dismisses without side effects", async () => {
    const pasted = await run("028", "PASTE");
    expect(pasted.action).toBe("needs_review");
    await expect(
      resolveEmailReview(userId, pasted.emailMessageId, { kind: "create" }, { status: "REJECTED", company: "Southland Realty Partners" }),
    ).resolves.toBeTruthy();
    const created = await prisma.application.findFirstOrThrow({ where: { userId, normalizedCompany: "southland realty partners" } });
    expect(created).toMatchObject({ status: "REJECTED", statusVerified: true, createdVia: "EMAIL", positionTitle: "Building Engineer" });
    const history = await prisma.applicationStatusHistory.findFirstOrThrow({ where: { applicationId: created.id } });
    expect(history).toMatchObject({ source: "EMAIL", verified: true });

    const again = await run("028", "EML");
    expect(again.action).toBe("needs_review");
    const before = await prisma.application.count({ where: { userId } });
    const out = await resolveEmailReview(userId, again.emailMessageId, { kind: "dismiss" }, { status: "REJECTED" });
    expect(out.applicationId).toBeNull();
    expect(await prisma.application.count({ where: { userId } })).toBe(before);
    const row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: again.emailMessageId } });
    expect(row).toMatchObject({ reviewStatus: "DISMISSED", bodyText: null });
    expect(await prisma.evidence.count({ where: { userId, sourceRef: `EML:${row.externalId}` } })).toBe(0);
  });
});

describe("interview invitations", () => {
  it("offers unconfirmed interview times and adds the interview on request", async () => {
    const ack = await run("013");
    expect(ack.action).toBe("ingested");
    const invite = await run("020");
    expect(invite).toMatchObject({ action: "ingested", applicationId: ack.applicationId });
    const app = await prisma.application.findUniqueOrThrow({ where: { id: ack.applicationId! } });
    expect(app.status).toBe("INTERVIEWING");
    expect(await prisma.interview.count({ where: { applicationId: app.id } })).toBe(0);

    const { invites } = await loadEmailReview(userId, { now: new Date("2026-03-06T20:00:00Z") });
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ emailId: invite.emailMessageId, applicationId: app.id, interviewAt: "2026-03-10T10:00" });
    expect((await loadEmailReview(userId, { now: new Date("2026-10-22T00:00:00Z") })).invites).toHaveLength(0);

    const out = await resolveInterviewInvite(userId, invite.emailMessageId, {
      decision: "add",
      scheduledAt: new Date("2026-03-10T17:00:00Z"),
      type: "ONSITE",
    });
    expect(out.message).toMatch(/Interview added/);
    expect(await prisma.interview.count({ where: { applicationId: app.id, type: "ONSITE" } })).toBe(1);
    expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: invite.emailMessageId } })).reviewStatus).toBe("CONFIRMED");
    expect((await loadEmailReview(userId, { now: new Date("2026-03-06T20:00:00Z") })).invites).toHaveLength(0);
    await expect(resolveInterviewInvite(userId, invite.emailMessageId, { decision: "skip", type: "OTHER" })).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("capture review", () => {
  it("creates, attaches and dismisses captures", async () => {
    const make = (kind: "CONFIRMATION_PAGE" | "APPLY_STARTED" | "JOB_PAGE", over: Record<string, unknown> = {}) =>
      prisma.extensionCapture.create({
        data: {
          userId,
          kind,
          url: "https://jobs.lever.co/sunbelt/0f6b7c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f",
          platform: "LEVER",
          company: "Sunbelt HVAC Services",
          title: "HVAC Technician",
          confidence: 0.7,
          evidence: { pageTitle: "HVAC Technician - Sunbelt", detectedBy: ["lever"] },
          ...over,
        },
      });
    const started = await make("APPLY_STARTED");
    const { items } = await loadCaptureReview(userId);
    const view = items.find((i) => i.id === started.id)!;
    expect(view).toMatchObject({ applyStartedOnly: true, kindLabel: "Application started", platformLabel: "Lever" });
    expect(view.fields.status).toBe("PREPARING");
    expect(view.urlLabel).toMatch(/^jobs\.lever\.co\/sunbelt/);

    const out = await resolveCaptureReview(userId, started.id, { kind: "create" }, { status: "SUBMITTED" });
    const capture = await prisma.extensionCapture.findUniqueOrThrow({ where: { id: started.id } });
    expect(capture).toMatchObject({ status: "ACCEPTED", applicationId: out.applicationId });
    const app = await prisma.application.findUniqueOrThrow({ where: { id: out.applicationId! } });
    expect(app).toMatchObject({ status: "SUBMITTED", createdVia: "EXTENSION", statusVerified: true });

    const page = await make("JOB_PAGE");
    const attached = await resolveCaptureReview(userId, page.id, { kind: "attach", applicationId: app.id }, { status: "SAVED" });
    expect(attached.applicationId).toBe(app.id);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("SUBMITTED");

    const junk = await make("JOB_PAGE", { company: "Spam Co" });
    await resolveCaptureReview(userId, junk.id, { kind: "dismiss" }, { status: "SAVED" });
    expect((await prisma.extensionCapture.findUniqueOrThrow({ where: { id: junk.id } })).status).toBe("DISMISSED");

    const blank = await make("JOB_PAGE", { company: null, title: null });
    await expect(resolveCaptureReview(userId, blank.id, { kind: "create" }, { status: "SAVED" })).rejects.toBeInstanceOf(IngestValidationError);
    await expect(
      resolveCaptureReview(userId, blank.id, { kind: "attach", applicationId: "00000000-0000-4000-8000-000000000000" }, { status: "SAVED" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await prisma.extensionCapture.findUniqueOrThrow({ where: { id: blank.id } })).status).toBe("PENDING_CONFIRMATION");
  });
});

describe("duplicate review loader", () => {
  it("suggests keeping the record that is further along", async () => {
    const saved = await createApplication(
      userId,
      applicationInputSchema.parse({ companyName: "Dup Loader Co", positionTitle: "Estimator", location: "Irvine, CA" }),
      "EXTENSION",
    );
    const submitted = await createApplication(
      userId,
      applicationInputSchema.parse({ companyName: "Dup Loader Co", positionTitle: "Estimator", status: "SUBMITTED" }),
      "EMAIL",
    );
    await scanDuplicates(userId);
    const { items } = await loadDuplicateReview(userId);
    const item = items.find((i) => [i.a.id, i.b.id].includes(saved.application.id))!;
    expect(item.suggestedKeepId).toBe(submitted.application.id);
    expect(item.signals.map((s) => s.label)).toContain("Same company");
    const options = await loadAttachOptions(userId);
    expect(options.some((o) => o.id === saved.application.id && o.label.includes("Dup Loader Co – Estimator (Saved)"))).toBe(true);
  });
});
