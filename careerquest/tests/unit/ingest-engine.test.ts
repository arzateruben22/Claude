/**
 * Database tests for the ingestion engine (own users, cascade cleanup).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { ExtensionCapture, Prisma } from "@/generated/prisma/client";
import {
  IngestNotFoundError,
  IngestValidationError,
  ingestObservation,
  observationFromCapture,
  observationFromEmailRow,
} from "@/lib/ingest/engine";
import { serializeObservation, type ApplicationObservation } from "@/lib/ingest/types";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";
import { XP } from "@/lib/game/xp-config";

let userId = "";
let otherUserId = "";
let seq = 0;

function obs(over: Partial<ApplicationObservation> = {}): ApplicationObservation {
  seq += 1;
  return {
    kind: "SUBMITTED",
    source: "EMAIL",
    origin: "EMAIL",
    observedAt: new Date("2026-01-12T17:14:33Z"),
    company: "Acme Electric",
    title: "Apprentice Electrician",
    location: "Anaheim, CA",
    platform: "INDEED",
    postingUrl: "https://www.indeed.com/viewjob?jk=7c1e5a9b2d4f6a08",
    confidence: 0.95,
    verified: true,
    evidence: {
      kind: "EMAIL",
      sourceRef: `EML:engine-${seq}-${Date.now()}@test`,
      title: "Application submitted",
      snippet: "Your application was sent to Acme Electric.",
      data: { classification: "APPLICATION_SUBMITTED", provider: "EML", senderKind: "job_board" },
    },
    ...over,
  };
}

const submittedXp = (applicationId: string) =>
  prisma.xpLedger.aggregate({
    where: { userId, sourceType: "Application", sourceId: applicationId, reason: "APPLICATION_SUBMITTED" },
    _sum: { amount: true },
  });

async function counts() {
  const [apps, evidence, events, history, xp] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    prisma.evidence.count({ where: { userId } }),
    prisma.applicationEvent.count({ where: { userId } }),
    prisma.applicationStatusHistory.count({ where: { application: { userId } } }),
    prisma.xpLedger.count({ where: { userId } }),
  ]);
  return { apps, evidence, events, history, xp };
}

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `ingest-engine+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Ingest Engine Test",
      profile: { create: { timezone: "America/Los_Angeles" } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: { email: `ingest-engine-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" },
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

describe("ingestObservation — create, duplicate, match", () => {
  let acmeId = "";

  it("creates a Confirmed record from a verified platform confirmation, with evidence, source link and 25 XP", async () => {
    const o = obs({ salaryText: "$24–$30/hr" });
    const r = await ingestObservation(userId, o);
    expect(r).toMatchObject({ action: "created", statusApplied: "CONFIRMED", xpAwarded: XP.APPLICATION_SUBMITTED, candidateIds: [] });
    acmeId = r.applicationId!;
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: acmeId },
      include: { sourceLinks: true, evidence: true, statusHistory: true },
    });
    expect(app).toMatchObject({
      status: "CONFIRMED",
      statusVerified: true,
      createdVia: "EMAIL",
      source: "INDEED",
      location: "Anaheim, CA",
      salaryPeriod: "HOURLY",
      detectionConfidence: 0.95,
    });
    expect(Number(app.salaryMin)).toBe(24);
    expect(app.appliedAt?.toISOString()).toBe("2026-01-12T17:14:33.000Z");
    expect(app.sourceLinks).toHaveLength(1);
    expect(app.evidence).toHaveLength(1);
    expect(app.evidence[0]!.sourceRef).toBe(o.evidence.sourceRef);
    expect(app.statusHistory[0]).toMatchObject({ source: "EMAIL", verified: true, evidenceId: app.evidence[0]!.id });
    expect((await submittedXp(acmeId))._sum.amount).toBe(XP.APPLICATION_SUBMITTED);

    // Re-delivery of the same evidence changes nothing.
    const before = await counts();
    const again = await ingestObservation(userId, o);
    expect(again).toMatchObject({ action: "duplicate", applicationId: acmeId, xpAwarded: 0 });
    expect(await counts()).toEqual(before);
  });

  it("attaches a second piece of evidence about the same job without changing a confirmed stage", async () => {
    const r = await ingestObservation(
      userId,
      obs({
        kind: "ACKNOWLEDGED",
        location: null,
        platform: "COMPANY_SITE",
        postingUrl: null,
        observedAt: new Date("2026-01-14T00:20:05Z"),
        evidence: { kind: "EMAIL", sourceRef: `EML:ack-${Date.now()}@acme.example`, data: { senderKind: "employer" } },
      }),
    );
    expect(r).toMatchObject({ action: "updated", applicationId: acmeId, statusApplied: null, xpAwarded: 0 });
    expect(await prisma.evidence.count({ where: { userId, applicationId: acmeId } })).toBe(2);
    expect((await submittedXp(acmeId))._sum.amount).toBe(XP.APPLICATION_SUBMITTED);
  });

  it("moves a matched record forward on a rejection, attributed to the email", async () => {
    const r = await ingestObservation(
      userId,
      obs({ kind: "REJECTED", location: null, postingUrl: null, platform: "COMPANY_SITE", observedAt: new Date("2026-02-14T00:44:19Z") }),
    );
    expect(r).toMatchObject({ action: "updated", applicationId: acmeId, statusApplied: "REJECTED" });
    const last = await prisma.applicationStatusHistory.findFirst({ where: { applicationId: acmeId }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ toStatus: "REJECTED", source: "EMAIL" });
  });

  it("follows a merged record to the one that absorbed it for an explicit applicationId", async () => {
    const dup = await createApplication(userId, applicationInputSchema.parse({ companyName: "Merged Co", positionTitle: "Helper" }), "MANUAL");
    await prisma.application.update({ where: { id: dup.application.id }, data: { mergedIntoId: acmeId, archivedAt: new Date() } });
    const r = await ingestObservation(userId, obs({ kind: "RECRUITER_RESPONSE", applicationId: dup.application.id, verified: true }));
    expect(r.applicationId).toBe(acmeId);
  });
});

describe("ingestObservation — review routing and refusals", () => {
  it("asks for review when two records are equally likely", async () => {
    for (const location of ["Irvine, CA", "Long Beach, CA"]) {
      await createApplication(
        userId,
        applicationInputSchema.parse({ companyName: "Twin Builders", positionTitle: "Estimator", location, status: "SUBMITTED" }),
        "MANUAL",
      );
    }
    const before = await counts();
    const r = await ingestObservation(
      userId,
      obs({ kind: "REJECTED", company: "Twin Builders", title: "Estimator", location: null, postingUrl: null, platform: null }),
    );
    expect(r.action).toBe("needs_review");
    expect(r.candidateIds).toHaveLength(2);
    expect(r.statusApplied).toBeNull();
    const after = await counts();
    expect(after.apps).toBe(before.apps);
    expect(after.history).toBe(before.history);
    expect(after.evidence).toBe(before.evidence + 1); // kept, unattached, for the review queue
  });

  it("queues mid-confidence and incomplete evidence, ignores evidence below the floor", async () => {
    const mid = await ingestObservation(userId, obs({ company: "Brand New Co", title: "Wireman", confidence: 0.6, postingUrl: null }));
    expect(mid).toMatchObject({ action: "needs_review", applicationId: null });
    const noTitle = await ingestObservation(userId, obs({ company: "Brand New Co", title: null, postingUrl: null }));
    expect(noTitle.action).toBe("needs_review");

    const before = await counts();
    const low = await ingestObservation(userId, obs({ company: "Brand New Co", title: "Wireman", confidence: 0.3, postingUrl: null }));
    expect(low.action).toBe("ignored");
    expect(await counts()).toEqual(before); // the evidence it inserted was removed again
  });

  it("never records anything for APPLY_STARTED", async () => {
    const before = await counts();
    const r = await ingestObservation(userId, obs({ kind: "APPLY_STARTED", company: "Start Only Co", title: "Helper", postingUrl: null }));
    expect(r).toMatchObject({ action: "ignored", applicationId: null, statusApplied: null });
    expect(await counts()).toEqual(before);
  });

  it("creates a Saved lead from a seen posting without XP or an application date", async () => {
    const r = await ingestObservation(
      userId,
      obs({ kind: "JOB_SEEN", source: "EXTENSION", origin: "EXTENSION", company: "Seen Co", title: "Helper", verified: false, postingUrl: "https://www.linkedin.com/jobs/view/123456/" , platform: "LINKEDIN", evidence: { kind: "EXTENSION_CAPTURE", sourceRef: `capture:seen-${Date.now()}` } }),
    );
    expect(r).toMatchObject({ action: "created", statusApplied: "SAVED", xpAwarded: 0 });
    const app = await prisma.application.findUniqueOrThrow({ where: { id: r.applicationId! } });
    expect(app).toMatchObject({ status: "SAVED", appliedAt: null, statusVerified: false, createdVia: "EXTENSION" });
  });

  it("refuses to downgrade a user-confirmed record and says why", async () => {
    const manual = await createApplication(
      userId,
      applicationInputSchema.parse({ companyName: "Steady Mechanical", positionTitle: "Pipefitter", status: "INTERVIEWING" }),
      "MANUAL",
    );
    const r = await ingestObservation(
      userId,
      obs({
        kind: "SUBMITTED",
        company: "Steady Mechanical",
        title: "Pipefitter",
        verified: false,
        location: null,
        postingUrl: null,
        platform: "ADP",
        observedAt: new Date(),
      }),
    );
    expect(r).toMatchObject({ action: "updated", applicationId: manual.application.id, statusApplied: null });
    expect(r.reason).toMatch(/not applied/);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: manual.application.id } });
    expect(app).toMatchObject({ status: "INTERVIEWING", statusVerified: true });
  });

  it("rejects another user's application id before writing anything", async () => {
    const theirs = await createApplication(otherUserId, applicationInputSchema.parse({ companyName: "Theirs", positionTitle: "Helper" }), "MANUAL");
    const before = await counts();
    await expect(ingestObservation(userId, obs({ applicationId: theirs.application.id }))).rejects.toBeInstanceOf(IngestNotFoundError);
    expect(await counts()).toEqual(before);
    await expect(ingestObservation(userId, obs({ kind: "NOPE" as never }))).rejects.toBeInstanceOf(IngestValidationError);
  });
});

describe("ingestObservation — interviews, overrides, captures", () => {
  it("keeps an unverified interview time on the milestone and creates no Interview row", async () => {
    const created = await ingestObservation(
      userId,
      obs({ company: "Golden Interview Co", title: "Project Coordinator", postingUrl: null, platform: "GREENHOUSE", verified: false }),
    );
    expect(created.statusApplied).toBe("SUBMITTED");
    const at = new Date("2026-03-10T17:00:00Z");
    const r = await ingestObservation(
      userId,
      obs({
        kind: "INTERVIEW_INVITED",
        company: "Golden Interview Co",
        title: "Project Coordinator",
        postingUrl: null,
        platform: "COMPANY_SITE",
        verified: false,
        interviewAt: at,
        observedAt: new Date("2026-03-06T17:22:14Z"),
      }),
    );
    expect(r).toMatchObject({ action: "updated", applicationId: created.applicationId, statusApplied: "INTERVIEWING" });
    expect(await prisma.interview.count({ where: { applicationId: created.applicationId! } })).toBe(0);
    const milestone = await prisma.applicationEvent.findFirstOrThrow({
      where: { applicationId: created.applicationId!, dedupeKey: `${created.applicationId}:INTERVIEW_SCHEDULED` },
    });
    expect(milestone.payload).toMatchObject({ scheduledAt: at.toISOString() });
    const ev = await prisma.evidence.findFirstOrThrow({
      where: { applicationId: created.applicationId!, data: { path: ["interviewAt"], equals: at.toISOString() } },
    });
    expect(ev.kind).toBe("EMAIL");
  });

  it("routes unverified progress over a verified stage to review, and applies it once reviewed", async () => {
    const created = await ingestObservation(userId, obs({ company: "Verified Stage Co", title: "Wireman", postingUrl: null, platform: "WORKDAY" }));
    expect(created.statusApplied).toBe("CONFIRMED");
    const invite = obs({
      kind: "INTERVIEW_INVITED",
      company: "Verified Stage Co",
      title: "Wireman",
      postingUrl: null,
      platform: "COMPANY_SITE",
      verified: false,
      observedAt: new Date("2026-01-23T21:05:55Z"),
    });
    const before = await counts();
    const r = await ingestObservation(userId, invite);
    expect(r).toMatchObject({ action: "needs_review", applicationId: null, candidateIds: [created.applicationId] });
    const after = await counts();
    expect(after.history).toBe(before.history);
    expect(after.evidence).toBe(before.evidence + 1);
    expect(await prisma.evidence.count({ where: { userId, sourceRef: invite.evidence.sourceRef, applicationId: null } })).toBe(1);

    const reviewed = await ingestObservation(userId, { ...invite, applicationId: created.applicationId, verified: true });
    expect(reviewed).toMatchObject({ action: "updated", statusApplied: "INTERVIEWING" });
    const last = await prisma.applicationStatusHistory.findFirst({ where: { applicationId: created.applicationId! }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ toStatus: "INTERVIEWING", source: "EMAIL", verified: true });

    // Older evidence never reopens a closed record, even when reviewed.
    await ingestObservation(userId, obs({ kind: "REJECTED", applicationId: created.applicationId, observedAt: new Date("2026-02-14T00:00:00Z") }));
    const stale = await ingestObservation(userId, {
      ...obs({ kind: "RECRUITER_RESPONSE", observedAt: new Date("2026-01-30T00:00:00Z") }),
      applicationId: created.applicationId,
    });
    expect(stale).toMatchObject({ action: "updated", statusApplied: null });
    expect(stale.reason).toMatch(/older than the current Rejected stage/);
  });

  it("creates the Interview row for a verified (reviewed) invitation", async () => {
    const created = await ingestObservation(userId, obs({ company: "Verified Interview Co", title: "Technician", postingUrl: null, platform: "LEVER" }));
    const at = new Date("2026-04-16T21:30:00Z");
    const r = await ingestObservation(
      userId,
      obs({
        kind: "INTERVIEW_INVITED",
        applicationId: created.applicationId,
        company: "Verified Interview Co",
        title: "Technician",
        verified: true,
        interviewAt: at,
        interviewType: "VIDEO",
        postingUrl: null,
      }),
    );
    expect(r.statusApplied).toBe("INTERVIEWING");
    const interviews = await prisma.interview.findMany({ where: { applicationId: created.applicationId! } });
    expect(interviews).toHaveLength(1);
    expect(interviews[0]).toMatchObject({ type: "VIDEO", scheduledAt: at });
    const scheduled = await prisma.applicationEvent.findMany({ where: { applicationId: created.applicationId!, type: "INTERVIEW_SCHEDULED" } });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.payload).toMatchObject({ interviewId: interviews[0]!.id, typeLabel: "Video" });
  });

  it("forceCreate skips matching and statusOverride replaces the mapped stage", async () => {
    const first = await ingestObservation(userId, obs({ company: "Force Co", title: "Helper", postingUrl: null, platform: "OTHER" }));
    const second = await ingestObservation(
      userId,
      obs({ kind: "RECRUITER_RESPONSE", company: "Force Co", title: "Helper", postingUrl: null, platform: "OTHER", verified: true }),
      { forceCreate: true, statusOverride: "SUBMITTED" },
    );
    expect(second.action).toBe("created");
    expect(second.applicationId).not.toBe(first.applicationId);
    expect(second.statusApplied).toBe("SUBMITTED");
    await expect(
      ingestObservation(userId, obs({ company: "Force Co", title: null }), { forceCreate: true }),
    ).rejects.toBeInstanceOf(IngestValidationError);
  });

  it("serializes concurrent deliveries for the same new job into one record", async () => {
    const make = () => obs({ company: "Race Condition Inc", title: "Helper Two", postingUrl: null, platform: "WORKDAY" });
    const results = await Promise.all([ingestObservation(userId, make()), ingestObservation(userId, make())]);
    expect(results.map((r) => r.action).sort()).toEqual(["created", "updated"]);
    expect(await prisma.application.count({ where: { userId, normalizedCompany: "race condition" } })).toBe(1);
  });

  it("maps extension captures to observations", async () => {
    const capture = await prisma.extensionCapture.create({
      data: {
        userId,
        kind: "CONFIRMATION_PAGE",
        url: "https://boards.greenhouse.io/capturedco/jobs/4455667",
        platform: "GREENHOUSE",
        company: "Captured Co",
        title: "Maintenance Tech",
        location: "Irvine, CA",
        confidence: 0.93,
        evidence: { pageTitle: "Thank you for applying", confirmationText: "Thank you for applying to Captured Co!", capturedAt: "2026-02-01T18:00:00Z", detectedBy: ["phrase"] },
      },
    });
    const o = observationFromCapture(capture as ExtensionCapture);
    expect(o).toMatchObject({
      kind: "SUBMITTED",
      source: "EXTENSION",
      verified: true,
      evidence: { kind: "EXTENSION_CAPTURE", sourceRef: `capture:${capture.id}`, snippet: "Thank you for applying to Captured Co!" },
    });
    expect(o.observedAt.toISOString()).toBe("2026-02-01T18:00:00.000Z");
    const r = await ingestObservation(userId, o);
    expect(r).toMatchObject({ action: "created", statusApplied: "CONFIRMED" });

    expect(observationFromCapture({ ...capture, kind: "CONFIRMATION_PAGE", confidence: 0.7 }).verified).toBe(false);
    expect(observationFromCapture({ ...capture, kind: "MANUAL_CONFIRMATION", confidence: 0.4 })).toMatchObject({ kind: "USER_CONFIRMED_SUBMISSION", verified: true });
    expect(observationFromCapture({ ...capture, kind: "APPLY_STARTED" }).kind).toBe("APPLY_STARTED");
    expect(observationFromCapture({ ...capture, kind: "SHARED_URL" }).kind).toBe("JOB_SEEN");
    expect(observationFromCapture({ ...capture, kind: "JOB_PAGE" }).kind).toBe("JOB_SEEN");
  });

  it("reads the stored observation from an email row", () => {
    const o = obs({ interviewAt: new Date("2026-03-10T17:00:00Z") });
    const extracted = JSON.parse(JSON.stringify({ observation: serializeObservation(o) })) as Prisma.JsonValue;
    const back = observationFromEmailRow({ extracted });
    expect(back?.observedAt).toEqual(o.observedAt);
    expect(back?.interviewAt).toEqual(o.interviewAt);
    expect(observationFromEmailRow({ extracted: { observation: null } })).toBeNull();
    expect(observationFromEmailRow({ extracted: "nope" })).toBeNull();
  });
});
