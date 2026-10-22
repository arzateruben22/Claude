/**
 * Database tests for duplicate scanning, merging and dismissing (own users, cascade cleanup).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  DuplicateError,
  dismissDuplicate,
  mergeApplications,
  mergeDuplicateCandidate,
} from "@/lib/dedup/merge";
import { scanDuplicates } from "@/lib/dedup/scan";
import { ingestObservation } from "@/lib/ingest/engine";
import type { ApplicationObservation } from "@/lib/ingest/types";
import {
  createApplication,
  listApplications,
  markInterviewOutcome,
  scheduleInterview,
} from "@/lib/applications/service";
import { parseListFilters } from "@/lib/applications/query";
import { applicationInputSchema } from "@/lib/validation/application";
import { XP } from "@/lib/game/xp-config";

let seq = 0;
const users: string[] = [];

async function newUser(label: string): Promise<string> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({
    data: {
      email: `dedup-${label}+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: `Dedup ${label}`,
      profile: { create: { timezone: "America/Los_Angeles" } },
      stats: { create: {} },
    },
  });
  users.push(u.id);
  return u.id;
}

function obs(
  over: Partial<ApplicationObservation> = {},
): ApplicationObservation {
  seq += 1;
  return {
    kind: "SUBMITTED",
    source: "EMAIL",
    origin: "EMAIL",
    observedAt: new Date("2026-01-20T22:05:51Z"),
    company: "Harbor Line Elevator Co.",
    title: "Elevator Mechanic Helper",
    confidence: 0.95,
    verified: false,
    evidence: {
      kind: "EMAIL",
      sourceRef: `EML:dedup-${seq}-${Date.now()}@test`,
    },
    ...over,
  };
}

/** Net XP attributed to applications (awards minus revocations). */
async function applicationXp(userId: string): Promise<number> {
  const agg = await prisma.xpLedger.aggregate({
    where: { userId, sourceType: "Application" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

async function activeAwards(
  userId: string,
  applicationId: string,
  reason: string,
) {
  return prisma.xpLedger.findMany({
    where: {
      userId,
      sourceType: "Application",
      sourceId: applicationId,
      reason,
      amount: { gt: 0 },
      NOT: { dedupeKey: { contains: "#revoked:" } },
    },
  });
}

/** Indeed posting saved by the extension + the Workday submission recorded as a separate record. */
async function indeedAndWorkday(userId: string) {
  const indeed = await ingestObservation(
    userId,
    obs({
      kind: "JOB_SEEN",
      source: "EXTENSION",
      origin: "EXTENSION",
      observedAt: new Date("2026-01-18T17:00:00Z"),
      location: "Long Beach, CA",
      platform: "INDEED",
      postingUrl: "https://www.indeed.com/viewjob?jk=feed1234beef5678",
      evidence: {
        kind: "EXTENSION_CAPTURE",
        sourceRef: `capture:dedup-${seq}-${Date.now()}`,
        data: { platform: "INDEED" },
      },
    }),
  );
  const workday = await ingestObservation(
    userId,
    obs({
      title: "Elevator Mechanic Helper - Long Beach",
      requisitionId: "R-2026-01844",
      platform: "WORKDAY",
      postingUrl:
        "https://harborline.wd5.myworkdayjobs.com/en-US/careers/job/Long-Beach/Elevator-Mechanic-Helper_R-2026-01844",
      salaryText: "$28–$34/hr",
    }),
    { forceCreate: true },
  );
  expect(indeed).toMatchObject({
    action: "created",
    statusApplied: "SAVED",
    xpAwarded: 0,
  });
  expect(workday).toMatchObject({
    action: "created",
    statusApplied: "SUBMITTED",
    xpAwarded: XP.APPLICATION_SUBMITTED,
  });
  return { indeedId: indeed.applicationId!, workdayId: workday.applicationId! };
}

beforeAll(async () => {
  await newUser("warmup");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("scanDuplicates + mergeDuplicateCandidate", () => {
  it("Indeed SAVED + Workday SUBMITTED → one SUBMITTED record, history preserved, 25 XP total", async () => {
    const userId = await newUser("main");
    const { indeedId, workdayId } = await indeedAndWorkday(userId);
    expect(await applicationXp(userId)).toBe(XP.APPLICATION_SUBMITTED);

    const scan = await scanDuplicates(userId);
    expect(scan).toMatchObject({ scanned: 2, found: 1, created: 1 });
    const candidate = await prisma.duplicateCandidate.findFirstOrThrow({
      where: { userId, status: "PENDING" },
    });
    expect([candidate.applicationAId, candidate.applicationBId].sort()).toEqual(
      [indeedId, workdayId].sort(),
    );
    expect(candidate.applicationAId < candidate.applicationBId).toBe(true);
    expect(candidate.score).toBeGreaterThanOrEqual(0.65);

    // Re-scanning updates in place.
    expect(await scanDuplicates(userId)).toMatchObject({
      created: 0,
      updated: 1,
    });

    const result = await mergeDuplicateCandidate(
      userId,
      candidate.id,
      indeedId,
    );
    expect(result).toMatchObject({
      keepId: indeedId,
      mergedId: workdayId,
      statusChange: { attempted: true, applied: true, status: "SUBMITTED" },
    });
    expect(result.fieldsFilled).toEqual(
      expect.arrayContaining([
        "requisitionNumber",
        "salaryMin",
        "salaryMax",
        "appliedAt",
      ]),
    );

    const keep = await prisma.application.findUniqueOrThrow({
      where: { id: indeedId },
      include: {
        sourceLinks: true,
        evidence: true,
        statusHistory: true,
        events: true,
      },
    });
    expect(keep).toMatchObject({
      status: "SUBMITTED",
      requisitionNumber: "R-2026-01844",
      source: "INDEED",
    });
    expect(keep.appliedAt?.toISOString()).toBe("2026-01-20T22:05:51.000Z");
    expect(keep.sourceLinks.map((l) => l.platform).sort()).toEqual([
      "INDEED",
      "WORKDAY",
    ]);
    expect(keep.evidence).toHaveLength(2);
    expect(keep.statusHistory.map((h) => h.toStatus).sort()).toEqual([
      "SAVED",
      "SUBMITTED",
      "SUBMITTED",
    ]);
    expect(keep.events.filter((e) => e.type === "APPLIED")).toHaveLength(1);
    expect(keep.events.find((e) => e.type === "MERGED")?.payload).toMatchObject(
      { mergedId: workdayId },
    );
    expect(
      keep.events.every((e) => !e.dedupeKey.startsWith(`${workdayId}:`)),
    ).toBe(true);

    const merged = await prisma.application.findUniqueOrThrow({
      where: { id: workdayId },
    });
    expect(merged.mergedIntoId).toBe(indeedId);
    expect(merged.archivedAt).not.toBeNull();

    expect(await applicationXp(userId)).toBe(XP.APPLICATION_SUBMITTED);
    expect(
      await activeAwards(userId, indeedId, "APPLICATION_SUBMITTED"),
    ).toHaveLength(1);
    expect(
      await activeAwards(userId, workdayId, "APPLICATION_SUBMITTED"),
    ).toHaveLength(0);

    const list = await listApplications(
      userId,
      parseListFilters({ archived: "1" }),
    );
    expect(list.items.map((i) => i.id)).toEqual([indeedId]);

    expect(
      (
        await prisma.duplicateCandidate.findUniqueOrThrow({
          where: { id: candidate.id },
        })
      ).status,
    ).toBe("MERGED");
    expect(await scanDuplicates(userId)).toMatchObject({
      scanned: 1,
      found: 0,
      created: 0,
    });
    const audit = await prisma.auditLog.findFirst({
      where: { userId, action: "applications.merge", entityId: indeedId },
    });
    expect(audit?.metadata).toMatchObject({ mergedId: workdayId });

    // Evidence for the merged-away record now lands on the kept one.
    const later = await ingestObservation(
      userId,
      obs({
        kind: "REJECTED",
        applicationId: workdayId,
        verified: true,
        observedAt: new Date("2026-03-01T00:00:00Z"),
      }),
    );
    expect(later).toMatchObject({
      applicationId: indeedId,
      statusApplied: "REJECTED",
    });
  });

  it("keeping the submitted record changes no stage and keeps 25 XP", async () => {
    const userId = await newUser("reverse");
    const { indeedId, workdayId } = await indeedAndWorkday(userId);
    const r = await mergeApplications(userId, workdayId, indeedId);
    expect(r.statusChange.attempted).toBe(false);
    const keep = await prisma.application.findUniqueOrThrow({
      where: { id: workdayId },
      include: { sourceLinks: true },
    });
    expect(keep.status).toBe("SUBMITTED");
    expect(keep.location).toBe("Long Beach, CA");
    expect(keep.sourceLinks.map((l) => l.platform).sort()).toEqual([
      "INDEED",
      "WORKDAY",
    ]);
    expect(await applicationXp(userId)).toBe(XP.APPLICATION_SUBMITTED);
  });

  it("restores the submission award when the merged record was the one holding it", async () => {
    const userId = await newUser("fingerprint");
    const input = applicationInputSchema.parse({
      companyName: "Same Print Co",
      positionTitle: "Helper",
      status: "SUBMITTED",
    });
    const first = await createApplication(userId, input, "MANUAL");
    const second = await createApplication(userId, input, "MANUAL");
    expect(first.xpAwarded).toBe(XP.APPLICATION_SUBMITTED);
    expect(second.xpAwarded).toBe(0); // same position: submission XP is paid once
    const r = await mergeApplications(
      userId,
      second.application.id,
      first.application.id,
    );
    expect(r.xpRevoked).toBe(XP.APPLICATION_SUBMITTED);
    expect(r.xpRestored).toBe(XP.APPLICATION_SUBMITTED);
    expect(await applicationXp(userId)).toBe(XP.APPLICATION_SUBMITTED);
    expect(
      await activeAwards(
        userId,
        second.application.id,
        "APPLICATION_SUBMITTED",
      ),
    ).toHaveLength(1);
    const keep = await prisma.application.findUniqueOrThrow({
      where: { id: second.application.id },
      include: { events: true },
    });
    expect(keep.events.filter((e) => e.type === "APPLIED")).toHaveLength(2); // both submissions stay in history
    expect(
      keep.events.filter((e) =>
        e.dedupeKey.startsWith(`merged:${first.application.id}:`),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("moves interviews and their XP, and never downgrades a user-confirmed later stage", async () => {
    const userId = await newUser("interview");
    const keep = await createApplication(
      userId,
      applicationInputSchema.parse({
        companyName: "Stage Co",
        positionTitle: "Wireman",
        status: "INTERVIEWING",
        location: "Irvine, CA",
      }),
      "MANUAL",
    );
    const dup = await createApplication(
      userId,
      applicationInputSchema.parse({
        companyName: "Stage Co",
        positionTitle: "Wireman",
        status: "SUBMITTED",
        location: "Anaheim, CA",
        notes: "Referred by Sam",
      }),
      "MANUAL",
    );
    const iv = await scheduleInterview(userId, dup.application.id, {
      type: "PHONE_SCREEN",
      scheduledAt: new Date("2026-02-01T18:00:00Z"),
    });
    await markInterviewOutcome(userId, iv.interview.id, {
      outcome: "ADVANCED",
      attended: true,
    });
    const before = await applicationXp(userId);
    expect(before).toBe(XP.APPLICATION_SUBMITTED * 2 + XP.INTERVIEW_ATTENDED);

    const r = await mergeApplications(
      userId,
      keep.application.id,
      dup.application.id,
    );
    expect(r.statusChange.attempted).toBe(false);
    expect(r.moved.interviews).toBe(1);
    const after = await prisma.application.findUniqueOrThrow({
      where: { id: keep.application.id },
      include: { interviews: true },
    });
    expect(after).toMatchObject({
      status: "INTERVIEWING",
      statusVerified: true,
      location: "Irvine, CA",
    });
    expect(after.notes).toBe("Referred by Sam");
    expect(after.interviews).toHaveLength(1);
    // The duplicate submission is not paid twice; the attended interview stays paid, now on the kept record.
    expect(await applicationXp(userId)).toBe(
      XP.APPLICATION_SUBMITTED + XP.INTERVIEW_ATTENDED,
    );
    expect(
      await activeAwards(userId, keep.application.id, "INTERVIEW_ATTENDED"),
    ).toHaveLength(1);
  });
});

describe("dismissing and guarding merges", () => {
  it("a dismissed pair is never proposed again", async () => {
    const userId = await newUser("dismiss");
    await indeedAndWorkday(userId);
    await scanDuplicates(userId);
    const c = await prisma.duplicateCandidate.findFirstOrThrow({
      where: { userId },
    });
    await dismissDuplicate(userId, c.id);
    expect(
      (
        await prisma.duplicateCandidate.findUniqueOrThrow({
          where: { id: c.id },
        })
      ).status,
    ).toBe("DISMISSED");
    expect(await scanDuplicates(userId)).toMatchObject({
      found: 1,
      created: 0,
      updated: 0,
      skipped: 1,
    });
    await expect(dismissDuplicate(userId, c.id)).rejects.toBeInstanceOf(
      DuplicateError,
    );
    await expect(
      mergeDuplicateCandidate(userId, c.id, c.applicationAId),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("refuses foreign, identical or already merged records", async () => {
    const userId = await newUser("guard");
    const otherId = await newUser("guard-other");
    const mine = await createApplication(
      userId,
      applicationInputSchema.parse({
        companyName: "Mine",
        positionTitle: "Helper",
      }),
      "MANUAL",
    );
    const mine2 = await createApplication(
      userId,
      applicationInputSchema.parse({
        companyName: "Mine",
        positionTitle: "Helper II",
      }),
      "MANUAL",
    );
    const theirs = await createApplication(
      otherId,
      applicationInputSchema.parse({
        companyName: "Theirs",
        positionTitle: "Helper",
      }),
      "MANUAL",
    );
    await expect(
      mergeApplications(userId, mine.application.id, theirs.application.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      mergeApplications(userId, mine.application.id, mine.application.id),
    ).rejects.toMatchObject({ code: "INVALID" });
    await mergeApplications(userId, mine.application.id, mine2.application.id);
    await expect(
      mergeApplications(userId, mine.application.id, mine2.application.id),
    ).rejects.toMatchObject({ code: "INVALID" });
    const theirsAfter = await prisma.application.findUniqueOrThrow({
      where: { id: theirs.application.id },
    });
    expect(theirsAfter.mergedIntoId).toBeNull();
  });
});
