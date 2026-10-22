/**
 * Regression tests for the Phase-1 review findings on the applications service (F1, F6, F8, F9,
 * F10), the transaction-composable service API used by the ingestion engine, merged-record
 * semantics in tracker queries, and the review-queue count. DB-backed: each run creates its own
 * users and deletes them (cascade) afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import {
  addSourceLinkInTx,
  changeStatus,
  changeStatusInTx,
  createApplication,
  createApplicationInTx,
  fillEmptyFieldsInTx,
  getApplication,
  listApplications,
  listCategories,
  updateApplication,
  type ServiceTx,
} from "@/lib/applications/service";
import { getReviewQueueCount } from "@/lib/applications/review-count";
import { parseListFilters } from "@/lib/applications/query";
import { XP } from "@/lib/game/xp-config";
import { todayInTz } from "@/lib/dates";
import type { ApplicationEventType } from "@/generated/prisma/enums";

const TZ = "America/Los_Angeles";
let userId = "";
let otherUserId = "";

function input(over: Record<string, unknown> = {}) {
  return applicationInputSchema.parse({
    companyName: "Fixes Electric Co",
    positionTitle: `Role ${Math.random().toString(36).slice(2, 8)}`,
    ...over,
  });
}

const eventsOf = (applicationId: string, type?: ApplicationEventType) =>
  prisma.applicationEvent.findMany({ where: { applicationId, ...(type ? { type } : {}) }, orderBy: { createdAt: "asc" } });
const xpFor = (applicationId: string, reason?: string) =>
  prisma.xpLedger.findMany({ where: { userId, sourceId: applicationId, amount: { gt: 0 }, ...(reason ? { reason } : {}) } });
const todaySubmittedCount = async () =>
  (await prisma.dailyActivity.findUnique({ where: { userId_date: { userId, date: todayInTz(TZ) } } }))?.applicationsSubmitted ?? 0;

async function makeUser(label: string, timezone = TZ) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({
    data: { email: `${label}+${stamp}@careerquest.test`, passwordHash: "x", name: label, profile: { create: { timezone } }, stats: { create: {} } },
  });
  return u.id;
}

beforeAll(async () => {
  userId = await makeUser("fixes-test");
  otherUserId = await makeUser("fixes-other");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// F1 — closing a never-applied lead must not count as a submission
// ---------------------------------------------------------------------------

describe("F1: closing a never-applied lead is not a submission", () => {
  for (const terminal of ["CLOSED", "WITHDRAWN"] as const) {
    it(`SAVED → ${terminal} records no APPLIED event, no XP, no appliedAt and no daily count`, async () => {
      const { application } = await createApplication(userId, input({ status: "SAVED" }));
      const before = await todaySubmittedCount();
      const r = await changeStatus(userId, application.id, { status: terminal });
      expect(r.applied).toBe(true);
      expect(r.applied && r.xpAwarded).toBe(0);
      const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
      expect(row.status).toBe(terminal);
      expect(row.appliedAt).toBeNull();
      expect(await eventsOf(application.id, "APPLIED")).toHaveLength(0);
      expect(await xpFor(application.id, "APPLICATION_SUBMITTED")).toHaveLength(0);
      expect(await todaySubmittedCount()).toBe(before);
    });
  }

  it("PREPARING → WITHDRAWN is not a submission either", async () => {
    const { application } = await createApplication(userId, input({ status: "PREPARING" }));
    const r = await changeStatus(userId, application.id, { status: "WITHDRAWN" });
    expect(r.applied && r.xpAwarded).toBe(0);
    expect(await eventsOf(application.id, "APPLIED")).toHaveLength(0);
  });

  it("SAVED → REJECTED and SAVED → NO_RESPONSE do imply an application existed", async () => {
    for (const status of ["REJECTED", "NO_RESPONSE"] as const) {
      const { application } = await createApplication(userId, input({ status: "SAVED" }));
      const r = await changeStatus(userId, application.id, { status });
      expect(r.applied && r.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
      const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
      expect(row.appliedAt).toBeInstanceOf(Date);
      expect(await eventsOf(application.id, "APPLIED")).toHaveLength(1);
    }
  });

  it("withdrawing a submitted application keeps its appliedAt and pays nothing extra", async () => {
    const appliedAt = new Date("2026-09-10T19:00:00Z");
    const { application } = await createApplication(userId, { ...input({ status: "SUBMITTED" }), appliedAt });
    const r = await changeStatus(userId, application.id, { status: "WITHDRAWN" });
    expect(r.applied && r.xpAwarded).toBe(0);
    const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(row.appliedAt?.toISOString()).toBe(appliedAt.toISOString());
    expect(await eventsOf(application.id, "APPLIED")).toHaveLength(1);
  });

  it("creating a record as CLOSED without an application date is not a submission", async () => {
    const { application, xpAwarded } = await createApplication(userId, input({ status: "CLOSED" }));
    expect(xpAwarded).toBe(0);
    expect(application.appliedAt).toBeNull();
    expect(await eventsOf(application.id, "APPLIED")).toHaveLength(0);
  });

  it("creating a record as WITHDRAWN with the date you applied counts that application", async () => {
    const appliedAt = new Date("2026-09-12T19:00:00Z");
    const { application, xpAwarded } = await createApplication(userId, { ...input({ status: "WITHDRAWN" }), appliedAt });
    expect(xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    expect(application.appliedAt?.toISOString()).toBe(appliedAt.toISOString());
    const applied = await eventsOf(application.id, "APPLIED");
    expect(applied).toHaveLength(1);
    expect(applied[0]!.occurredAt.toISOString()).toBe(appliedAt.toISOString());
  });

  it("a SAVED record never stores an application date (it would count as applied)", async () => {
    const { application } = await createApplication(userId, { ...input({ status: "SAVED" }), appliedAt: new Date("2026-09-01T19:00:00Z") });
    expect(application.appliedAt).toBeNull();
  });

  it("editing keeps the application date of a submitted record when the field is left blank", async () => {
    const appliedAt = new Date("2026-09-14T19:00:00Z");
    const created = await createApplication(userId, { ...input({ status: "SUBMITTED", positionTitle: "Keep date" }), appliedAt });
    const updated = await updateApplication(userId, created.application.id, input({ positionTitle: "Keep date (edited)" }));
    expect(updated.appliedAt?.toISOString()).toBe(appliedAt.toISOString());
    // …and ignores a date typed onto a never-applied record.
    const saved = await createApplication(userId, input({ status: "SAVED" }));
    const edited = await updateApplication(userId, saved.application.id, { ...input(), appliedAt: new Date("2026-09-02T19:00:00Z") });
    expect(edited.appliedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F6 — origin drives source attribution and verification
// ---------------------------------------------------------------------------

describe("F6: createApplication attributes machine-created records to their origin", () => {
  it("EMAIL origin is attributed to EMAIL and is unverified by default", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }), "EMAIL");
    expect(application.createdVia).toBe("EMAIL");
    expect(application.statusVerified).toBe(false);
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: application.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ source: "EMAIL", verified: false });
    const saved = await eventsOf(application.id, "SAVED");
    expect(saved[0]).toMatchObject({ source: "EMAIL", verified: false });
    const applied = await eventsOf(application.id, "APPLIED");
    expect(applied[0]).toMatchObject({ source: "EMAIL", verified: false });
  });

  it("maps every origin to its event source", async () => {
    const cases = [
      ["EXTENSION", "EXTENSION", false],
      ["CSV_IMPORT", "IMPORT", false],
      ["URL_IMPORT", "IMPORT", false],
      ["PLATFORM_API", "PLATFORM_API", false],
      ["MOBILE", "USER", true],
      ["MANUAL", "USER", true],
      ["SYSTEM", "SYSTEM", false],
    ] as const;
    for (const [origin, source, verified] of cases) {
      const { application } = await createApplication(userId, input({ status: "SAVED" }), origin);
      const h = await prisma.applicationStatusHistory.findFirstOrThrow({ where: { applicationId: application.id } });
      expect([origin, h.source, h.verified]).toEqual([origin, source, verified]);
      expect(application.statusVerified).toBe(verified);
    }
  });

  it("honors explicit source/verified/evidenceId options", async () => {
    const evidence = await prisma.evidence.create({ data: { userId, kind: "EMAIL", sourceRef: `msg-${Date.now()}`, title: "Thanks for applying" } });
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }), "EMAIL", { verified: true, evidenceId: evidence.id });
    expect(application.statusVerified).toBe(true);
    const h = await prisma.applicationStatusHistory.findFirstOrThrow({ where: { applicationId: application.id } });
    expect(h).toMatchObject({ source: "EMAIL", verified: true, evidenceId: evidence.id });
    const applied = await eventsOf(application.id, "APPLIED");
    expect(applied[0]).toMatchObject({ source: "EMAIL", verified: true, evidenceId: evidence.id });
  });

  it("an unverified machine-created OFFER earns no verified-offer XP and a later inferred update is not blocked", async () => {
    const { application, xpAwarded } = await createApplication(userId, input({ status: "OFFER" }), "EXTENSION");
    expect(await xpFor(application.id, "JOB_OFFER_VERIFIED")).toHaveLength(0);
    expect(xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    const r = await changeStatus(userId, application.id, { status: "ACCEPTED" }, "EMAIL", false);
    expect(r.applied).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F9 — an unverified offer milestone is upgraded when the offer is confirmed
// ---------------------------------------------------------------------------

describe("F9: confirming an inferred offer pays the verified-offer XP once", () => {
  it("the user confirming the same (unverified) stage upgrades the milestone", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }), "EMAIL");
    const inferred = await changeStatus(userId, application.id, { status: "OFFER" }, "EMAIL", false);
    expect(inferred.applied && inferred.xpAwarded).toBe(0);
    expect((await eventsOf(application.id, "OFFER_RECEIVED"))[0]?.verified).toBe(false);

    const confirmed = await changeStatus(userId, application.id, { status: "OFFER" });
    expect(confirmed.applied).toBe(true);
    expect(confirmed.applied && confirmed.xpAwarded).toBe(XP.JOB_OFFER_VERIFIED);
    const offers = await eventsOf(application.id, "OFFER_RECEIVED");
    expect(offers).toHaveLength(1);
    expect(offers[0]!.verified).toBe(true);
    const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(row.statusVerified).toBe(true);

    // Now verified: the same stage again is a no-op and pays nothing.
    const again = await changeStatus(userId, application.id, { status: "OFFER" });
    expect(again).toMatchObject({ applied: false, reason: "same_status" });
    expect(await xpFor(application.id, "JOB_OFFER_VERIFIED")).toHaveLength(1);
  });

  it("moving an inferred offer to Accepted also pays the verified-offer XP", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }), "EMAIL");
    await changeStatus(userId, application.id, { status: "OFFER" }, "EMAIL", false);
    const accepted = await changeStatus(userId, application.id, { status: "ACCEPTED" });
    expect(accepted.applied && accepted.xpAwarded).toBe(XP.JOB_OFFER_VERIFIED + XP.JOB_ACCEPTED);
    expect(await xpFor(application.id, "JOB_OFFER_VERIFIED")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// F10 — STATUS_CHANGED events are per transition
// ---------------------------------------------------------------------------

describe("F10: re-entering a status on the same picked date keeps both events", () => {
  it("records a STATUS_CHANGED event (with its note) for every transition", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }));
    const day = new Date("2026-10-05T19:00:00Z");
    await changeStatus(userId, application.id, { status: "SCREENING", occurredAt: day });
    await changeStatus(userId, application.id, { status: "SUBMITTED", occurredAt: day, note: "Wrong record" });
    await changeStatus(userId, application.id, { status: "SCREENING", occurredAt: day, note: "Recruiter called" });
    const changes = await eventsOf(application.id, "STATUS_CHANGED");
    const toScreening = changes.filter((e) => (e.payload as { to?: string }).to === "SCREENING");
    expect(toScreening).toHaveLength(2);
    expect((toScreening[1]!.payload as { note?: string }).note).toBe("Recruiter called");
    expect(changes).toHaveLength(4); // created + 3 transitions
  });
});

// ---------------------------------------------------------------------------
// F8 — tracker date filters use the profile timezone
// ---------------------------------------------------------------------------

describe("F8: tracker from/to filters use the profile timezone", () => {
  it("an 8 PM Pacific application lands on its local day", async () => {
    const appliedAt = new Date("2025-10-21T03:00:00Z"); // Oct 20, 8 PM in Los Angeles
    const { application } = await createApplication(userId, { ...input({ status: "SUBMITTED", companyName: "Tz Filter Co" }), appliedAt });
    const onDay = await listApplications(userId, parseListFilters({ q: "tz filter", from: "2025-10-20", to: "2025-10-20" }));
    expect(onDay.items.map((i) => i.id)).toEqual([application.id]);
    const nextDay = await listApplications(userId, parseListFilters({ q: "tz filter", from: "2025-10-21", to: "2025-10-21" }));
    expect(nextDay.items).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Transaction-composable API for the ingestion engine
// ---------------------------------------------------------------------------

describe("transaction-composable service API", () => {
  it("createApplicationInTx + changeStatusInTx compose inside one transaction and roll back together", async () => {
    const company = `Rollback Co ${Date.now()}`;
    await expect(
      prisma.$transaction(async (tx: ServiceTx) => {
        const { application } = await createApplicationInTx(tx, userId, input({ status: "SUBMITTED", companyName: company }), "EMAIL");
        const r = await changeStatusInTx(tx, userId, application.id, { status: "SCREENING" }, "EMAIL", true);
        expect(r.applied).toBe(true);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await prisma.application.count({ where: { userId, companyName: company } })).toBe(0);

    const committed = await prisma.$transaction(async (tx) => {
      const { application } = await createApplicationInTx(tx, userId, input({ status: "SUBMITTED", companyName: company }), "EMAIL");
      return changeStatusInTx(tx, userId, application.id, { status: "SCREENING" }, "EMAIL", true);
    });
    expect(committed.applied).toBe(true);
    expect(committed.applied && committed.application.status).toBe("SCREENING");
  });

  it("reads the profile timezone through the transaction", async () => {
    const tzUser = await makeUser("fixes-tz");
    try {
      const appliedAt = new Date("2026-10-01T20:00:00Z"); // Oct 1 in Los Angeles, Oct 2 in Tokyo
      await prisma.$transaction(async (tx) => {
        await tx.userProfile.update({ where: { userId: tzUser }, data: { timezone: "Asia/Tokyo" } });
        await createApplicationInTx(tx, tzUser, { ...input({ status: "SUBMITTED" }), appliedAt }, "MANUAL");
      });
      const days = await prisma.dailyActivity.findMany({ where: { userId: tzUser }, select: { date: true, applicationsSubmitted: true } });
      expect(days.map((d) => [d.date.toISOString().slice(0, 10), d.applicationsSubmitted])).toEqual([["2026-10-02", 1]]);
    } finally {
      await prisma.user.delete({ where: { id: tzUser } });
    }
  });

  it("changeStatusInTx refuses another user's record", async () => {
    const { application } = await createApplication(userId, input({ status: "SAVED" }));
    const r = await prisma.$transaction((tx) => changeStatusInTx(tx, otherUserId, application.id, { status: "SUBMITTED" }, "EMAIL", true));
    expect(r).toMatchObject({ applied: false, reason: "not_found" });
  });

  it("addSourceLinkInTx is idempotent per platform + normalized URL", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }));
    const add = (platform: "INDEED" | "WORKDAY", url: string | null, externalId: string | null = null) =>
      prisma.$transaction((tx) => addSourceLinkInTx(tx, userId, application.id, { platform, url, externalId, origin: "EMAIL" }));
    const first = await add("INDEED", "https://www.indeed.com/viewjob?jk=abc123&from=serp");
    expect(first.created).toBe(true);
    const again = await add("INDEED", "https://indeed.com/viewjob?jk=abc123&utm_source=email");
    expect(again.created).toBe(false);
    expect(again.link.id).toBe(first.link.id);
    const workday = await add("WORKDAY", "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/X_R-1", "R-1");
    expect(workday.created).toBe(true);
    const byExternalId = await add("WORKDAY", null, "R-1");
    expect(byExternalId.created).toBe(false);
    const links = await prisma.applicationSourceLink.findMany({ where: { applicationId: application.id } });
    expect(links.map((l) => l.platform).sort()).toEqual(["INDEED", "WORKDAY"]);
    expect(links.find((l) => l.platform === "INDEED")?.origin).toBe("EMAIL");

    await expect(
      prisma.$transaction((tx) => addSourceLinkInTx(tx, otherUserId, application.id, { platform: "INDEED", url: "https://indeed.com/x", origin: "EMAIL" })),
    ).rejects.toThrow(/not found/i);
  });

  it("fillEmptyFieldsInTx only fills empty fields and re-derives URL facts", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", location: "Irvine, CA", recruiterName: "Pat Recruiter", jobDescription: "" }),
    );
    const result = await prisma.$transaction((tx) =>
      fillEmptyFieldsInTx(tx, userId, application.id, {
        location: "Somewhere else",
        jobDescription: "Install conduit. Req R-55501.",
        postingUrl: "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Irvine/Electrician_JR-2026-9001?utm_source=x",
        employmentType: "FULL_TIME",
        salaryMin: 30,
        salaryMax: 38,
        salaryPeriod: "HOURLY",
        recruiterName: "Someone Else",
        recruiterEmail: "pat@example.com",
      }),
    );
    const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id }, include: { recruiterContact: true } });
    expect(row.location).toBe("Irvine, CA"); // never overwritten
    expect(row.jobDescription).toBe("Install conduit. Req R-55501.");
    expect(row.postingUrl).toContain("myworkdayjobs.com");
    expect(row.normalizedUrl).not.toContain("utm_source");
    expect(row.requisitionNumber).toBe("JR-2026-9001");
    expect(row.source).toBe("WORKDAY");
    expect(row.employmentType).toBe("FULL_TIME");
    expect(Number(row.salaryMin)).toBe(30);
    expect(row.salaryPeriod).toBe("HOURLY");
    expect(row.recruiterContact?.name).toBe("Pat Recruiter"); // name kept
    expect(row.recruiterContact?.email).toBe("pat@example.com"); // empty email filled
    expect(result.filled.sort()).toEqual(
      ["employmentType", "jobDescription", "postingUrl", "recruiterEmail", "requisitionNumber", "salaryMax", "salaryMin", "salaryPeriod", "source"].sort(),
    );

    // A second fill with different values changes nothing.
    const second = await prisma.$transaction((tx) =>
      fillEmptyFieldsInTx(tx, userId, application.id, { salaryMin: 99999, salaryPeriod: "ANNUAL", postingUrl: "https://indeed.com/viewjob?jk=zzz" }),
    );
    expect(second.filled).toEqual([]);
  });

  it("fillEmptyFieldsInTx creates a recruiter contact when none is linked", async () => {
    const { application } = await createApplication(userId, input({ status: "SUBMITTED" }));
    await prisma.$transaction((tx) => fillEmptyFieldsInTx(tx, userId, application.id, { recruiterEmail: "hr@example.com" }));
    const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id }, include: { recruiterContact: true } });
    expect(row.recruiterContact).toMatchObject({ name: "hr@example.com", email: "hr@example.com", userId });
  });

  it("fillEmptyFieldsInTx refuses another user's record", async () => {
    const { application } = await createApplication(userId, input({ status: "SAVED" }));
    await expect(prisma.$transaction((tx) => fillEmptyFieldsInTx(tx, otherUserId, application.id, { location: "X" }))).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// Merged records and the review queue
// ---------------------------------------------------------------------------

describe("merged records are excluded from tracker queries", () => {
  it("never lists or counts a merged record, even with archived included", async () => {
    const mergeUser = await makeUser("fixes-merge");
    try {
      const survivor = await createApplication(mergeUser, input({ status: "SUBMITTED", companyName: "Merge Target", jobCategory: "Electrician" }));
      const dup = await createApplication(mergeUser, input({ status: "SUBMITTED", companyName: "Merge Dup", jobCategory: "Merged Only Category" }));
      await prisma.application.update({ where: { id: dup.application.id }, data: { mergedIntoId: survivor.application.id, archivedAt: new Date() } });

      for (const archived of [undefined, "1"]) {
        const r = await listApplications(mergeUser, parseListFilters(archived ? { archived } : {}));
        expect(r.items.map((i) => i.id)).toEqual([survivor.application.id]);
        expect(r.total).toBe(1);
        expect(r.totalUnfiltered).toBe(1);
        expect(r.counts.SUBMITTED).toBe(1);
      }
      expect(await listCategories(mergeUser)).toEqual(["Electrician"]);
      // The record itself stays reachable (the detail page explains where it went).
      expect((await getApplication(mergeUser, dup.application.id))?.mergedIntoId).toBe(survivor.application.id);

      // hasAny ignores merged-only trackers.
      await prisma.application.update({ where: { id: survivor.application.id }, data: { mergedIntoId: dup.application.id } });
      expect((await listApplications(mergeUser, parseListFilters({}))).hasAny).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: mergeUser } });
    }
  });
});

describe("getReviewQueueCount", () => {
  it("counts emails needing review, pending captures and pending duplicates for the user only", async () => {
    const qUser = await makeUser("fixes-queue");
    try {
      expect(await getReviewQueueCount(qUser)).toBe(0);
      const a = await createApplication(qUser, input({ status: "SUBMITTED" }));
      const b = await createApplication(qUser, input({ status: "SUBMITTED" }));
      await prisma.emailMessage.createMany({
        data: [
          { userId: qUser, provider: "EML", externalId: "m1", reviewStatus: "NEEDS_REVIEW" },
          { userId: qUser, provider: "EML", externalId: "m2", reviewStatus: "NEEDS_REVIEW" },
          { userId: qUser, provider: "EML", externalId: "m3", reviewStatus: "CONFIRMED" },
          { userId: otherUserId, provider: "EML", externalId: `other-${Date.now()}`, reviewStatus: "NEEDS_REVIEW" },
        ],
      });
      await prisma.extensionCapture.createMany({
        data: [
          { userId: qUser, kind: "CONFIRMATION_PAGE", url: "https://indeed.com/a", status: "PENDING_CONFIRMATION" },
          { userId: qUser, kind: "JOB_PAGE", url: "https://indeed.com/b", status: "DISMISSED" },
        ],
      });
      await prisma.duplicateCandidate.create({
        data: { userId: qUser, applicationAId: a.application.id, applicationBId: b.application.id, score: 0.8, status: "PENDING" },
      });
      expect(await getReviewQueueCount(qUser)).toBe(4);
    } finally {
      await prisma.user.delete({ where: { id: qUser } });
    }
  });
});
