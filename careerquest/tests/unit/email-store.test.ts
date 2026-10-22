/**
 * Database tests for EmailMessage storage (idempotent upsert, user review decisions preserved, body
 * minimization and purge) and for the processing pipeline with a fake ingestion engine.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { classifyEmail } from "@/lib/email/classify";
import { toObservation, type EmailProvider } from "@/lib/email/observation";
import { fromGraphMessage, parseEmail, type ParsedEmail } from "@/lib/email/parse";
import { processRawEmail, processRawEmails, type IngestFn } from "@/lib/email/pipeline";
import {
  MAX_STORED_BODY_BYTES,
  decideReviewStatus,
  purgeReviewedBodies,
  storeClassifiedEmail,
  type StoredEmailExtract,
} from "@/lib/email/store";
import type { ApplicationObservation, IngestResult } from "@/lib/ingest/types";

const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".eml"));
const fixture = (prefix: string) => fs.readFileSync(path.join(DIR, FILES.find((f) => f.startsWith(prefix))!));

let userId = "";
let otherUserId = "";
let applicationId = "";
let otherApplicationId = "";

async function prepared(raw: string | Buffer, provider: EmailProvider = "EML") {
  const parsed = await parseEmail(raw);
  const classification = classifyEmail(parsed);
  const observation = toObservation(parsed, classification, { provider });
  return { parsed, classification, observation, provider };
}

const extractOf = (row: { extracted: unknown }) => row.extracted as StoredEmailExtract;

function result(over: Partial<IngestResult> = {}): IngestResult {
  return { action: "created", applicationId, candidateIds: [], reason: "Created from email", statusApplied: "SUBMITTED", xpAwarded: 25, ...over };
}

function oversizedNoEmployerRejection(): string {
  const filler = Array.from({ length: 2000 }, (_, i) => `Paragraph ${i} https://tracker.example/p?id=${i}&token=secret${i}`).join("\n");
  return [
    "From: Greenhouse <no-reply@greenhouse.io>",
    "To: Ruben Test <ruben.test@example.com>",
    "Subject: Update on your application",
    "Date: Wed, 06 May 2026 10:00:00 -0700",
    `Message-ID: <oversized-${Date.now()}@greenhouse.io>`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Hi Ruben,",
    "",
    "Unfortunately, we have decided to move forward with other candidates for this role.",
    "",
    filler,
  ].join("\r\n");
}

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `email-core+${stamp}@careerquest.test`, passwordHash: "x", name: "Email Core Test" },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `email-core-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" },
  });
  otherUserId = other.id;
  const app = await prisma.application.create({
    data: {
      userId,
      companyName: "Acme Electric",
      normalizedCompany: "acme electric",
      positionTitle: "Apprentice Electrician",
      normalizedTitle: "apprentice electrician",
    },
  });
  applicationId = app.id;
  const otherApp = await prisma.application.create({
    data: {
      userId: otherUserId,
      companyName: "Elsewhere",
      normalizedCompany: "elsewhere",
      positionTitle: "Helper",
      normalizedTitle: "helper",
    },
  });
  otherApplicationId = otherApp.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("decideReviewStatus", () => {
  it("routes by observation, confidence floor/threshold and employer presence", async () => {
    const confirm = await prepared(fixture("003"));
    expect(decideReviewStatus(confirm.classification, confirm.observation)).toMatchObject({ status: "AUTO_ACCEPTED", actionable: true });
    const alert = await prepared(fixture("034"));
    expect(decideReviewStatus(alert.classification, alert.observation)).toMatchObject({ status: "AUTO_ACCEPTED", actionable: false });
    const low = { ...confirm.classification, confidence: 0.7 };
    expect(decideReviewStatus(low, confirm.observation).status).toBe("NEEDS_REVIEW");
    const noEmployer = { ...confirm.observation!, company: null };
    expect(decideReviewStatus(confirm.classification, noEmployer)).toMatchObject({ status: "NEEDS_REVIEW", reason: "Employer could not be identified" });
    const floor = { ...confirm.classification, confidence: 0.3 };
    expect(decideReviewStatus(floor, confirm.observation)).toMatchObject({ status: "AUTO_ACCEPTED", actionable: false });
  });
});

describe("storeClassifiedEmail", () => {
  it("stores a high-confidence confirmation as AUTO_ACCEPTED with no body", async () => {
    const input = await prepared(fixture("003"));
    const row = await storeClassifiedEmail(userId, input);
    expect(row.userId).toBe(userId);
    expect(row.provider).toBe("EML");
    expect(row.externalId).toBe(input.parsed.externalId);
    expect(row.classification).toBe("APPLICATION_SUBMITTED");
    expect(row.reviewStatus).toBe("AUTO_ACCEPTED");
    expect(row.bodyText).toBeNull();
    expect(row.snippet!.length).toBeLessThanOrEqual(300);
    const x = extractOf(row);
    expect(x.employer).toBe("Harbor Line Elevator Co.");
    expect(x.requisitionNumber).toBe("R-2026-01844");
    expect(x.observation?.kind).toBe("SUBMITTED");
    expect(x.observation?.evidence.sourceRef).toBe(`EML:${input.parsed.externalId}`);
    expect(typeof x.observation?.observedAt).toBe("string");
  });

  it("is idempotent on (userId, provider, externalId)", async () => {
    const input = await prepared(fixture("003"));
    const a = await storeClassifiedEmail(userId, input);
    const b = await storeClassifiedEmail(userId, input);
    expect(b.id).toBe(a.id);
    const count = await prisma.emailMessage.count({ where: { userId, provider: "EML", externalId: input.parsed.externalId } });
    expect(count).toBe(1);
    // A different provider is a different source row; another user gets their own row.
    const gmail = await storeClassifiedEmail(userId, { ...input, provider: "GMAIL" });
    expect(gmail.id).not.toBe(a.id);
    const other = await storeClassifiedEmail(otherUserId, input);
    expect(other.id).not.toBe(a.id);
    expect(other.userId).toBe(otherUserId);
  });

  it("queues uncertain application mail for review with a minimized body", async () => {
    const input = await prepared(fixture("014"));
    expect(input.classification.confidence).toBeLessThan(0.8);
    const row = await storeClassifiedEmail(userId, input);
    expect(row.reviewStatus).toBe("NEEDS_REVIEW");
    expect(row.bodyText).toContain("Under Review");
    expect(Buffer.byteLength(row.bodyText!, "utf8")).toBeLessThanOrEqual(MAX_STORED_BODY_BYTES);
    expect(extractOf(row).observation?.kind).toBe("ACKNOWLEDGED");
  });

  it("stores non-actionable mail as AUTO_ACCEPTED with the classification only", async () => {
    for (const prefix of ["034", "037", "039", "040"]) {
      const row = await storeClassifiedEmail(userId, await prepared(fixture(prefix)));
      expect(row.reviewStatus).toBe("AUTO_ACCEPTED");
      expect(row.bodyText).toBeNull();
      expect(extractOf(row).observation).toBeNull();
    }
  });

  it("caps the stored body at 8 KB and strips URL query strings", async () => {
    const input = await prepared(oversizedNoEmployerRejection());
    expect(input.classification.classification).toBe("REJECTION");
    expect(input.observation?.company ?? null).toBeNull();
    const row = await storeClassifiedEmail(userId, input);
    expect(row.reviewStatus).toBe("NEEDS_REVIEW");
    expect(Buffer.byteLength(row.bodyText!, "utf8")).toBeLessThanOrEqual(MAX_STORED_BODY_BYTES);
    expect(row.bodyText).not.toContain("token=");
    expect(row.bodyText).toContain("https://tracker.example/p");
  });

  it("never changes a review status the user set, but refreshes the classification", async () => {
    const input = await prepared(fixture("014"));
    const first = await storeClassifiedEmail(userId, input);
    await prisma.emailMessage.update({
      where: { id: first.id },
      data: { reviewStatus: "CONFIRMED", applicationId, classification: "UNKNOWN", confidence: 0.1 },
    });
    const again = await storeClassifiedEmail(userId, input);
    expect(again.id).toBe(first.id);
    expect(again.reviewStatus).toBe("CONFIRMED");
    expect(again.applicationId).toBe(applicationId);
    expect(again.classification).toBe("EMPLOYER_ACKNOWLEDGMENT");
    expect(again.confidence).toBe(input.classification.confidence);
    expect(again.bodyText).not.toBeNull(); // purge owns body removal

    await prisma.emailMessage.update({ where: { id: first.id }, data: { reviewStatus: "DISMISSED" } });
    expect((await storeClassifiedEmail(userId, input)).reviewStatus).toBe("DISMISSED");
  });

  it("purgeReviewedBodies drops bodies only from confirmed/dismissed rows of that user", async () => {
    const pending = await storeClassifiedEmail(userId, await prepared(oversizedNoEmployerRejection()));
    expect(pending.bodyText).not.toBeNull();
    const otherPending = await storeClassifiedEmail(otherUserId, await prepared(fixture("014")));
    await prisma.emailMessage.update({ where: { id: otherPending.id }, data: { reviewStatus: "CONFIRMED" } });

    const purged = await purgeReviewedBodies(userId);
    expect(purged).toBeGreaterThanOrEqual(1);
    const reviewed = await prisma.emailMessage.findMany({ where: { userId, reviewStatus: { in: ["CONFIRMED", "DISMISSED"] } } });
    expect(reviewed.length).toBeGreaterThan(0);
    expect(reviewed.every((r) => r.bodyText === null)).toBe(true);
    expect((await prisma.emailMessage.findUnique({ where: { id: pending.id } }))!.bodyText).not.toBeNull();
    // Another user's reviewed row is untouched by this user's purge.
    expect((await prisma.emailMessage.findUnique({ where: { id: otherPending.id } }))!.bodyText).not.toBeNull();
    expect(await purgeReviewedBodies(userId)).toBe(0);
  });

  it("refuses a connection or import batch that belongs to another user", async () => {
    const conn = await prisma.integrationConnection.create({
      data: { userId: otherUserId, provider: "GMAIL", accountEmail: "other@example.com" },
    });
    const input = await prepared(fixture("005"));
    await expect(storeClassifiedEmail(userId, { ...input, connectionId: conn.id })).rejects.toThrow(/not found/);
    const batch = await prisma.importBatch.create({ data: { userId, kind: "EML", fileName: "x.eml" } });
    const row = await storeClassifiedEmail(userId, { ...input, importBatchId: batch.id });
    expect(row.importBatchId).toBe(batch.id);
  });
});

describe("processRawEmail (fake ingest)", () => {
  it("ingests an auto-accepted confirmation and links the application", async () => {
    const ingest = vi.fn<IngestFn>(async () => result());
    const summary = await processRawEmail(userId, fixture("001"), { provider: "MBOX" }, ingest);
    expect(summary.action).toBe("ingested");
    expect(summary.classification).toBe("APPLICATION_SUBMITTED");
    expect(summary.applicationId).toBe(applicationId);
    expect(ingest).toHaveBeenCalledTimes(1);
    const [uid, obs] = ingest.mock.calls[0]! as [string, ApplicationObservation];
    expect(uid).toBe(userId);
    expect(obs).toMatchObject({ kind: "SUBMITTED", source: "EMAIL", origin: "EMAIL", company: "Acme Electric", platform: "INDEED", verified: true });
    expect(obs.evidence.sourceRef).toBe(`MBOX:${summary.externalId}`);
    const row = await prisma.emailMessage.findUnique({ where: { id: summary.emailMessageId } });
    expect(row!.applicationId).toBe(applicationId);
    expect(row!.reviewStatus).toBe("AUTO_ACCEPTED");
    expect(row!.bodyText).toBeNull();
    expect(extractOf(row!).ingest?.action).toBe("created");
  });

  it("does not re-ingest a duplicate delivery", async () => {
    const ingest = vi.fn<IngestFn>(async () => result());
    const summary = await processRawEmail(userId, fixture("001"), { provider: "MBOX" }, ingest);
    expect(summary.action).toBe("duplicate");
    expect(summary.applicationId).toBe(applicationId);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("never calls ingest for job alerts, unfinished applications, invitations or unrelated mail", async () => {
    const ingest = vi.fn<IngestFn>(async () => result());
    for (const prefix of ["034", "035", "036", "037", "038", "039", "040"]) {
      const summary = await processRawEmail(userId, fixture(prefix), { provider: "MBOX" }, ingest);
      expect(summary.action).toBe("stored");
      expect(summary.applicationId).toBeNull();
    }
    expect(ingest).not.toHaveBeenCalled();
  });

  it("does not ingest rows that need review", async () => {
    const ingest = vi.fn<IngestFn>(async () => result());
    const summary = await processRawEmail(userId, fixture("014"), { provider: "MBOX" }, ingest);
    expect(summary.action).toBe("needs_review");
    expect(ingest).not.toHaveBeenCalled();
  });

  it("moves the row to review when the engine answers needs_review, keeping the body", async () => {
    const ingest = vi.fn<IngestFn>(async () => result({ action: "needs_review", applicationId: null, candidateIds: [applicationId], reason: "Two possible matches", statusApplied: null, xpAwarded: 0 }));
    const summary = await processRawEmail(userId, fixture("003"), { provider: "OUTLOOK" }, ingest);
    expect(summary.action).toBe("needs_review");
    expect(summary.reason).toBe("Two possible matches");
    const row = await prisma.emailMessage.findUnique({ where: { id: summary.emailMessageId } });
    expect(row!.reviewStatus).toBe("NEEDS_REVIEW");
    expect(row!.applicationId).toBeNull();
    expect(row!.bodyText).toContain("Elevator Mechanic Helper");
    expect(extractOf(row!).ingest).toMatchObject({ action: "needs_review", candidateIds: [applicationId] });
  });

  it("queues the message for review when ingest throws", async () => {
    const ingest = vi.fn<IngestFn>(async () => {
      throw new Error("engine unavailable");
    });
    const summary = await processRawEmail(userId, fixture("004"), { provider: "PASTE" }, ingest);
    expect(summary.action).toBe("ingest_failed");
    const row = await prisma.emailMessage.findUnique({ where: { id: summary.emailMessageId } });
    expect(row!.reviewStatus).toBe("NEEDS_REVIEW");
    expect(row!.bodyText).not.toBeNull();
    expect(extractOf(row!).ingest).toMatchObject({ action: "error", reason: "engine unavailable" });
  });

  it("respects a decision the user made on an earlier delivery", async () => {
    const first = await processRawEmail(userId, fixture("005"), { provider: "OUTLOOK" }, vi.fn<IngestFn>(async () => result()));
    await prisma.emailMessage.update({ where: { id: first.emailMessageId }, data: { reviewStatus: "DISMISSED" } });
    const ingest = vi.fn<IngestFn>(async () => result());
    const again = await processRawEmail(userId, fixture("005"), { provider: "OUTLOOK" }, ingest);
    expect(again.action).toBe("user_reviewed");
    expect(ingest).not.toHaveBeenCalled();
    expect((await prisma.emailMessage.findUnique({ where: { id: first.emailMessageId } }))!.reviewStatus).toBe("DISMISSED");
  });

  it("never links an application that belongs to another user", async () => {
    const ingest = vi.fn<IngestFn>(async () => result({ applicationId: otherApplicationId }));
    const summary = await processRawEmail(userId, fixture("006"), { provider: "OUTLOOK" }, ingest);
    expect(summary.applicationId).toBeNull();
    const row = await prisma.emailMessage.findUnique({ where: { id: summary.emailMessageId } });
    expect(row!.applicationId).toBeNull();
  });

  it("accepts an already-parsed message (Microsoft Graph path)", async () => {
    const parsed = fromGraphMessage({
      id: `graph-${Date.now()}`,
      internetMessageId: `<graph-${Date.now()}@mail.example>`,
      conversationId: "conv-1",
      subject: "Offer of Employment - Electrician Helper - Volt Partners Inc.",
      from: { emailAddress: { name: "Nina Shah", address: "nshah@voltpartners.example" } },
      toRecipients: [{ emailAddress: { address: "ruben.test@example.com" } }],
      receivedDateTime: "2026-05-01T17:00:00Z",
      body: {
        contentType: "text",
        content: "Hi Ruben,\n\nOn behalf of Volt Partners Inc., I am pleased to offer you the position of Electrician Helper. Your formal offer letter is attached for signature.\n\nNina Shah\nRecruiter | Volt Partners Inc.",
      },
    });
    const ingest = vi.fn<IngestFn>(async () => result({ action: "updated", statusApplied: "OFFER" }));
    const summary = await processRawEmail(userId, parsed, { provider: "OUTLOOK" }, ingest);
    expect(summary.classification).toBe("OFFER");
    expect(summary.action).toBe("ingested");
    const obs = ingest.mock.calls[0]![1] as ApplicationObservation;
    expect(obs.kind).toBe("OFFER");
    expect(obs.company).toBe("Volt Partners Inc.");
    expect(obs.recruiterName).toBe("Nina Shah");
    expect(obs.observedAt.toISOString()).toBe("2026-05-01T17:00:00.000Z");
  });

  it("processRawEmails reports a failing message without stopping the batch", async () => {
    const good = await parseEmail(fixture("010"));
    const bad: ParsedEmail = { ...good, externalId: `bad-${Date.now()}`, receivedAt: new Date("not a date") };
    const ingest = vi.fn<IngestFn>(async () => result());
    const out = await processRawEmails(userId, [bad, good], { provider: "EML" }, ingest);
    expect(out).toHaveLength(2);
    expect(out[0]!.ok).toBe(false);
    expect(out[1]).toMatchObject({ ok: true, summary: { classification: "APPLICATION_SUBMITTED" } });
  });
});
