import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server environment; the service modules are plain TS.
vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { applicationInputSchema } from "@/lib/validation/application";
import {
  addNote,
  archiveApplication,
  changeStatus,
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  listCategories,
  markInterviewOutcome,
  recordFollowUp,
  restoreApplication,
  scheduleInterview,
  updateApplication,
} from "@/lib/applications/service";
import { LIST_SORTS, parseListFilters } from "@/lib/applications/query";
import { XP } from "@/lib/game/xp-config";
import { todayInTz } from "@/lib/dates";
import type { ApplicationEventType } from "@/generated/prisma/enums";

const TZ = "America/Los_Angeles";
let userId = "";
let otherUserId = "";

function input(over: Record<string, unknown> = {}) {
  return applicationInputSchema.parse({
    companyName: "Acme Electric, Inc.",
    positionTitle: "Apprentice Electrician",
    postingUrl: "https://www.indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a&from=serp",
    ...over,
  });
}

const ledgerRows = (reason: string, like?: string) =>
  prisma.xpLedger.findMany({
    where: {
      userId,
      reason,
      ...(like ? { OR: [{ dedupeKey: { contains: like } }, { sourceId: like }] } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
const eventsOf = (applicationId: string, type?: ApplicationEventType) =>
  prisma.applicationEvent.findMany({
    where: { applicationId, ...(type ? { type } : {}) },
    orderBy: { occurredAt: "asc" },
  });

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `tracker-test+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Tracker Test",
      profile: { create: { timezone: TZ } },
      stats: { create: {} },
    },
  });
  userId = user.id;
  const other = await prisma.user.create({
    data: {
      email: `tracker-other+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: "Other",
    },
  });
  otherUserId = other.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [userId, otherUserId] } },
  });
  await prisma.$disconnect();
});

describe("createApplication", () => {
  it("creates a SUBMITTED application, derives fields, writes history and awards 25 XP exactly once", async () => {
    const { application, xpAwarded } = await createApplication(
      userId,
      input({ status: "SUBMITTED" }),
    );
    expect(xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    expect(application.status).toBe("SUBMITTED");
    expect(application.statusVerified).toBe(true);
    expect(application.appliedAt).toBeInstanceOf(Date);
    expect(application.normalizedCompany).toBe("acme electric");
    expect(application.normalizedTitle).toBe("apprentice electrician");
    expect(application.normalizedUrl).toBe(
      "https://indeed.com/viewjob?jk=5e8c7a1b2d3f4e6a",
    );
    expect(application.source).toBe("INDEED");
    expect(application.createdVia).toBe("MANUAL");

    const employer = await prisma.employer.findUnique({
      where: {
        userId_normalizedName: { userId, normalizedName: "acme electric" },
      },
    });
    expect(employer?.id).toBe(application.employerId);

    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: application.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "SUBMITTED",
      source: "USER",
      verified: true,
    });

    const types = (await eventsOf(application.id)).map((e) => e.type).sort();
    expect(types).toEqual(["APPLIED", "SAVED", "STATUS_CHANGED"]);

    const submitted = await ledgerRows("APPLICATION_SUBMITTED", application.id);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]!.amount).toBe(25);

    const day = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId, date: todayInTz(TZ) } },
    });
    expect(day?.applicationsSubmitted).toBe(1);
  });

  it("creates a SAVED application without APPLIED XP and reuses the employer", async () => {
    const { application, xpAwarded } = await createApplication(
      userId,
      input({ status: "SAVED", postingUrl: "", source: "REFERRAL" }),
    );
    expect(xpAwarded).toBe(0);
    expect(application.appliedAt).toBeNull();
    expect(application.source).toBe("REFERRAL");
    const types = (await eventsOf(application.id)).map((e) => e.type).sort();
    expect(types).toEqual(["SAVED", "STATUS_CHANGED"]);
    const employers = await prisma.employer.count({
      where: { userId, normalizedName: "acme electric" },
    });
    expect(employers).toBe(1);
  });

  it("falls back to a requisition id from the posting URL and links a recruiter contact", async () => {
    const { application } = await createApplication(
      userId,
      input({
        companyName: "Workday Co",
        postingUrl:
          "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Los-Angeles-CA/Electrician_JR-2024-1234",
        recruiterName: "Pat Recruiter",
        recruiterEmail: "pat@example.com",
      }),
    );
    expect(application.requisitionNumber).toBe("JR-2024-1234");
    expect(application.source).toBe("WORKDAY");
    const contact = await prisma.contact.findFirst({
      where: { id: application.recruiterContactId!, userId },
    });
    expect(contact?.name).toBe("Pat Recruiter");
  });
});

describe("changeStatus", () => {
  it("moving forward through the pipeline awards no additional APPLICATION_SUBMITTED XP and records each milestone once", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", positionTitle: "Journeyman Electrician" }),
    );
    const id = application.id;
    for (const status of ["CONFIRMED", "SCREENING", "INTERVIEWING"] as const) {
      const r = await changeStatus(userId, id, { status });
      expect(r.applied).toBe(true);
    }
    expect(await ledgerRows("APPLICATION_SUBMITTED", id)).toHaveLength(1);
    const types = (await eventsOf(id)).map((e) => e.type);
    expect(types.filter((t) => t === "CONFIRMATION_RECEIVED")).toHaveLength(1);
    expect(types.filter((t) => t === "RECRUITER_RESPONSE")).toHaveLength(1);
    expect(types.filter((t) => t === "INTERVIEW_SCHEDULED")).toHaveLength(1);
    expect(types.filter((t) => t === "STATUS_CHANGED")).toHaveLength(4);
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: id },
      orderBy: { occurredAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "SUBMITTED",
      "CONFIRMED",
      "SCREENING",
      "INTERVIEWING",
    ]);
    expect(history[3]).toMatchObject({
      fromStatus: "SCREENING",
      toStatus: "INTERVIEWING",
      source: "USER",
      verified: true,
    });

    // Moving back and forward again does not re-award or re-record milestones.
    const back = await changeStatus(userId, id, {
      status: "SUBMITTED",
      note: "Logged by mistake",
    });
    expect(back.applied).toBe(true);
    const fwd = await changeStatus(userId, id, { status: "INTERVIEWING" });
    expect(fwd.applied && fwd.xpAwarded).toBe(0);
    expect(await ledgerRows("APPLICATION_SUBMITTED", id)).toHaveLength(1);
    const again = (await eventsOf(id)).map((e) => e.type);
    expect(again.filter((t) => t === "APPLIED")).toHaveLength(1);
    expect(again.filter((t) => t === "RECRUITER_RESPONSE")).toHaveLength(1);
    expect(again.filter((t) => t === "INTERVIEW_SCHEDULED")).toHaveLength(1);
    expect(again.filter((t) => t === "STATUS_CHANGED")).toHaveLength(6);

    // Same status is a no-op for the user.
    const same = await changeStatus(userId, id, { status: "INTERVIEWING" });
    expect(same).toMatchObject({ applied: false, reason: "same_status" });

    // Reaching OFFER from the user awards the verified offer XP once; ACCEPTED pays acceptance once.
    const offer = await changeStatus(userId, id, { status: "OFFER" });
    expect(offer.applied && offer.xpAwarded).toBe(XP.JOB_OFFER_VERIFIED);
    const accepted = await changeStatus(userId, id, { status: "ACCEPTED" });
    expect(accepted.applied && accepted.xpAwarded).toBe(XP.JOB_ACCEPTED);
    expect(await ledgerRows("JOB_OFFER_VERIFIED", id)).toHaveLength(1);
    expect(await ledgerRows("JOB_ACCEPTED", id)).toHaveLength(1);
  });

  it("refuses inferred downgrades and unverified overrides, but applies verified forward inferences", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", positionTitle: "Electrician Helper" }),
    );
    const id = application.id;
    await changeStatus(userId, id, { status: "SCREENING" });

    const downgrade = await changeStatus(
      userId,
      id,
      { status: "SUBMITTED" },
      "EMAIL",
      true,
    );
    expect(downgrade).toMatchObject({
      applied: false,
      reason: "inferred_not_allowed",
    });

    const unverified = await changeStatus(
      userId,
      id,
      { status: "INTERVIEWING" },
      "EXTENSION",
      false,
    );
    expect(unverified).toMatchObject({
      applied: false,
      reason: "inferred_not_allowed",
    });

    const stillScreening = await prisma.application.findUnique({
      where: { id },
      select: { status: true, statusVerified: true },
    });
    expect(stillScreening).toEqual({
      status: "SCREENING",
      statusVerified: true,
    });
    expect(
      await prisma.applicationStatusHistory.count({
        where: { applicationId: id },
      }),
    ).toBe(2);

    const verifiedForward = await changeStatus(
      userId,
      id,
      { status: "INTERVIEWING" },
      "EMAIL",
      true,
    );
    expect(verifiedForward.applied).toBe(true);
    const row = await prisma.applicationStatusHistory.findFirst({
      where: { applicationId: id, toStatus: "INTERVIEWING" },
    });
    expect(row).toMatchObject({ source: "EMAIL", verified: true });
  });

  it("does not let another user touch the record", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SAVED", positionTitle: "Private" }),
    );
    const r = await changeStatus(otherUserId, application.id, {
      status: "SUBMITTED",
    });
    expect(r).toMatchObject({ applied: false, reason: "not_found" });
    expect(await getApplication(otherUserId, application.id)).toBeNull();
    await expect(
      deleteApplication(otherUserId, application.id),
    ).rejects.toThrow(/not found/i);
  });
});

describe("recordFollowUp", () => {
  it("awards follow-up XP once per calendar day; the same timestamp twice is recorded once", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", positionTitle: "Follow-up test" }),
    );
    const id = application.id;
    const day1 = new Date("2026-10-01T18:00:00Z");
    const day2 = new Date("2026-10-02T18:00:00Z");

    const first = await recordFollowUp(userId, id, {
      occurredAt: day1,
      note: "Emailed the hiring manager",
      nextFollowUpAt: day2,
    });
    expect(first.eventCreated).toBe(true);
    expect(first.xpAwarded).toBe(XP.FOLLOW_UP_COMPLETED);
    expect(first.application.followUpAt?.toISOString()).toBe(
      day2.toISOString(),
    );

    const duplicate = await recordFollowUp(userId, id, {
      occurredAt: day1,
      note: "Emailed the hiring manager",
    });
    expect(duplicate.eventCreated).toBe(false);
    expect(duplicate.xpAwarded).toBe(0);

    const second = await recordFollowUp(userId, id, {
      occurredAt: day2,
      note: "Called",
    });
    expect(second.eventCreated).toBe(true);
    expect(second.xpAwarded).toBe(XP.FOLLOW_UP_COMPLETED);
    expect(second.application.followUpAt).toBeNull();

    // A second follow-up on the same day is logged but does not pay again.
    const sameDay = await recordFollowUp(userId, id, {
      occurredAt: new Date("2026-10-02T20:00:00Z"),
    });
    expect(sameDay.eventCreated).toBe(true);
    expect(sameDay.xpAwarded).toBe(0);

    expect(await eventsOf(id, "FOLLOW_UP_SENT")).toHaveLength(3);
    expect(await ledgerRows("FOLLOW_UP_COMPLETED", id)).toHaveLength(2);
    const day2Activity = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId, date: todayInTz(TZ, day2) } },
    });
    expect(day2Activity?.followUps).toBe(2);
  });
});

describe("notes, interviews and outcomes", () => {
  it("appends notes and records NOTE_ADDED events", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SAVED", positionTitle: "Notes test", notes: "First" }),
    );
    const updated = await addNote(userId, application.id, "Second note");
    expect(updated.notes).toBe("First\n\nSecond note");
    expect(await eventsOf(application.id, "NOTE_ADDED")).toHaveLength(1);
  });

  it("scheduling an interview moves a SAVED application to INTERVIEWING and outcomes pay XP once per interview", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SAVED", positionTitle: "Interview test" }),
    );
    const id = application.id;
    const when = new Date("2026-10-05T17:00:00Z");
    const scheduled = await scheduleInterview(userId, id, {
      type: "PHONE_SCREEN",
      scheduledAt: when,
      interviewer: "Sam",
    });
    expect(scheduled.statusChange?.applied).toBe(true);
    const app = await prisma.application.findUnique({
      where: { id },
      select: { status: true, appliedAt: true },
    });
    expect(app?.status).toBe("INTERVIEWING");
    expect(app?.appliedAt).toBeInstanceOf(Date);
    // One interview event (the interview's own), not a duplicate generic milestone.
    expect(await eventsOf(id, "INTERVIEW_SCHEDULED")).toHaveLength(1);
    expect(await ledgerRows("APPLICATION_SUBMITTED", id)).toHaveLength(1);

    const attended = await markInterviewOutcome(
      userId,
      scheduled.interview.id,
      { outcome: "ADVANCED", attended: true, prepCompleted: true },
    );
    expect(attended.xpAwarded).toBe(XP.INTERVIEW_ATTENDED + XP.INTERVIEW_PREP);
    expect(attended.interview.attendedAt).toBeInstanceOf(Date);
    expect(attended.interview.prepCompletedAt).toBeInstanceOf(Date);

    const repeat = await markInterviewOutcome(userId, scheduled.interview.id, {
      outcome: "ADVANCED",
      attended: true,
      prepCompleted: true,
    });
    expect(repeat.xpAwarded).toBe(0);

    // A second, distinct interview for the same application pays attendance again (per interview).
    const second = await scheduleInterview(userId, id, {
      type: "ONSITE",
      scheduledAt: new Date("2026-10-08T17:00:00Z"),
    });
    expect(second.statusChange).toBeNull();
    const secondAttended = await markInterviewOutcome(
      userId,
      second.interview.id,
      { outcome: "PENDING", attended: true },
    );
    expect(secondAttended.xpAwarded).toBe(XP.INTERVIEW_ATTENDED);
    expect(await ledgerRows("INTERVIEW_ATTENDED")).toHaveLength(2);
    expect(await eventsOf(id, "INTERVIEW_COMPLETED")).toHaveLength(2);

    // Marking as not attended clears attendance but never claws XP back.
    const noShow = await markInterviewOutcome(userId, second.interview.id, {
      outcome: "NO_SHOW",
      attended: false,
    });
    expect(noShow.interview.attendedAt).toBeNull();
    expect(await ledgerRows("INTERVIEW_ATTENDED")).toHaveLength(2);
  });
});

describe("update, list, archive, delete", () => {
  it("updateApplication re-normalises fields without touching status", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", positionTitle: "Update test" }),
    );
    const updated = await updateApplication(
      userId,
      application.id,
      input({
        companyName: "Beta Power LLC",
        positionTitle: "Electrician (Req #777777)",
        status: "HIRED",
        postingUrl: "",
      }),
    );
    expect(updated.status).toBe("SUBMITTED");
    expect(updated.companyName).toBe("Beta Power LLC");
    expect(updated.normalizedCompany).toBe("beta power");
    expect(updated.normalizedTitle).toBe("electrician");
    expect(updated.requisitionNumber).toBe("777777");
    expect(
      await prisma.applicationStatusHistory.count({
        where: { applicationId: application.id },
      }),
    ).toBe(1);
  });

  it("lists with search, status filter, counts and archive handling", async () => {
    const { application } = await createApplication(
      userId,
      input({
        status: "SAVED",
        companyName: "Zeta Unique Corp",
        positionTitle: "List test",
      }),
    );
    const all = await listApplications(userId, parseListFilters({}));
    expect(all.hasAny).toBe(true);
    expect(all.total).toBeGreaterThan(0);
    expect(all.items.every((i) => i.archivedAt === null)).toBe(true);
    expect(Object.values(all.counts).reduce((a, b) => a + b, 0)).toBe(
      all.totalUnfiltered,
    );

    const searched = await listApplications(
      userId,
      parseListFilters({ q: "zeta unique" }),
    );
    expect(searched.items.map((i) => i.id)).toEqual([application.id]);
    expect(searched.counts.SAVED).toBe(1);

    const filtered = await listApplications(
      userId,
      parseListFilters({ q: "zeta unique", status: "SUBMITTED" }),
    );
    expect(filtered.items).toHaveLength(0);
    expect(filtered.totalUnfiltered).toBe(1);

    await archiveApplication(userId, application.id);
    expect(
      (await listApplications(userId, parseListFilters({ q: "zeta unique" })))
        .items,
    ).toHaveLength(0);
    expect(
      (
        await listApplications(
          userId,
          parseListFilters({ q: "zeta unique", archived: "1" }),
        )
      ).items,
    ).toHaveLength(1);
    await restoreApplication(userId, application.id);
    expect(
      (await listApplications(userId, parseListFilters({ q: "zeta unique" })))
        .items,
    ).toHaveLength(1);

    const other = await listApplications(otherUserId, parseListFilters({}));
    expect(other.hasAny).toBe(false);
    expect(other.items).toHaveLength(0);
  });

  it("accepts every sort order and the source/category/date filters", async () => {
    const { application } = await createApplication(
      userId,
      input({
        status: "SUBMITTED",
        companyName: "Sortable Co",
        positionTitle: "Sort test",
        jobCategory: "Electrician",
        appliedAt: "2026-09-15",
      }),
    );
    for (const sort of LIST_SORTS) {
      const r = await listApplications(userId, parseListFilters({ sort }));
      expect(r.items.length).toBeGreaterThan(0);
    }
    const bySource = await listApplications(
      userId,
      parseListFilters({ q: "sortable", source: "INDEED" }),
    );
    expect(bySource.items.map((i) => i.id)).toEqual([application.id]);
    expect(
      (
        await listApplications(
          userId,
          parseListFilters({ q: "sortable", source: "LINKEDIN" }),
        )
      ).items,
    ).toHaveLength(0);
    const byCategory = await listApplications(
      userId,
      parseListFilters({ q: "sortable", category: "electrician" }),
    );
    expect(byCategory.items.map((i) => i.id)).toEqual([application.id]);
    const inRange = await listApplications(
      userId,
      parseListFilters({ q: "sortable", from: "2026-09-01", to: "2026-09-30" }),
    );
    expect(inRange.items.map((i) => i.id)).toEqual([application.id]);
    expect(
      (
        await listApplications(
          userId,
          parseListFilters({ q: "sortable", from: "2026-10-01" }),
        )
      ).items,
    ).toHaveLength(0);
    expect(await listCategories(userId)).toContain("Electrician");
  });

  it("getApplication returns the full record and deleteApplication cascades", async () => {
    const { application } = await createApplication(
      userId,
      input({ status: "SUBMITTED", positionTitle: "Detail test" }),
    );
    const detail = await getApplication(userId, application.id);
    expect(detail?.statusHistory).toHaveLength(1);
    expect(detail?.events.length).toBeGreaterThanOrEqual(3);
    expect(detail?.employer?.name).toBe("Acme Electric, Inc.");
    expect(detail?.salaryMin).toBeNull();
    await deleteApplication(userId, application.id);
    expect(await getApplication(userId, application.id)).toBeNull();
    expect(
      await prisma.applicationEvent.count({
        where: { applicationId: application.id },
      }),
    ).toBe(0);
  });
});

describe("XP anti-farming guarantees", () => {
  it("a second record for the same position earns no extra submission XP", async () => {
    const position = { companyName: "Duplicate Check Electric LLC", positionTitle: "Electrician Trainee", location: "Irvine, CA" };
    const first = await createApplication(userId, input({ ...position, status: "SUBMITTED", postingUrl: "https://www.indeed.com/viewjob?jk=dup0001" }));
    const second = await createApplication(userId, input({ ...position, status: "SUBMITTED", postingUrl: "https://acme.wd1.myworkdayjobs.com/en-US/careers/job/Irvine/Electrician-Trainee_R-77001" }));
    expect(first.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    expect(second.xpAwarded).toBe(0);
  });

  it("deleting a record revokes its XP, and re-creating it earns the submission XP exactly once more", async () => {
    const position = { companyName: "Revoke Test Mechanical", positionTitle: "HVAC Technician", location: "Long Beach, CA" };
    const before = (await prisma.playerStats.findUniqueOrThrow({ where: { userId } })).totalXp;
    const created = await createApplication(userId, input({ ...position, status: "SUBMITTED" }));
    expect(created.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    await deleteApplication(userId, created.application.id);
    const afterDelete = (await prisma.playerStats.findUniqueOrThrow({ where: { userId } })).totalXp;
    expect(afterDelete).toBe(before);

    const again = await createApplication(userId, input({ ...position, status: "SUBMITTED" }));
    expect(again.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    await deleteApplication(userId, again.application.id);
    const third = await createApplication(userId, input({ ...position, status: "SUBMITTED" }));
    expect(third.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    const final = (await prisma.playerStats.findUniqueOrThrow({ where: { userId } })).totalXp;
    expect(final).toBe(before + XP.APPLICATION_SUBMITTED);
  });

  it("recording the same event twice inside one transaction neither throws nor double-counts", async () => {
    const { application } = await createApplication(userId, input({ companyName: "Tx Safety Builders", status: "SAVED" }));
    const { recordApplicationEvent } = await import("@/lib/events/record-event");
    const results = await prisma.$transaction(async (tx) => {
      const a = await recordApplicationEvent(tx, { userId, applicationId: application.id, type: "NOTE_ADDED", source: "USER", activityDate: todayInTz(TZ), dedupeKey: "tx-dup-key" });
      const b = await recordApplicationEvent(tx, { userId, applicationId: application.id, type: "NOTE_ADDED", source: "USER", activityDate: todayInTz(TZ), dedupeKey: "tx-dup-key" });
      // The transaction must still be usable after the duplicate.
      const count = await tx.applicationEvent.count({ where: { userId, dedupeKey: "tx-dup-key" } });
      return { a, b, count };
    });
    expect(results.a.created).toBe(true);
    expect(results.b.created).toBe(false);
    expect(results.b.eventId).toBe(results.a.eventId);
    expect(results.count).toBe(1);
  });
});
