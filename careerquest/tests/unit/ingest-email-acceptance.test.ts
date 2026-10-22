/**
 * Phase 2 acceptance: an authorized application confirmation email produces a correctly classified,
 * nonduplicated record. Runs the real email pipeline (`processRawEmail`) with the real ingestion
 * engine (`ingestObservation`) over the fixture corpus (tests/fixtures/emails, see its README for
 * which messages describe the same application). Each scenario uses its own user.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  processRawEmail,
  type EmailProcessSummary,
} from "@/lib/email/pipeline";
import type { StoredEmailExtract } from "@/lib/email/store";
import { ingestObservation } from "@/lib/ingest/engine";
import { loadEmailReview, resolveEmailReview } from "@/lib/ingest/review";
import { createApplication } from "@/lib/applications/service";
import { applicationInputSchema } from "@/lib/validation/application";
import { XP } from "@/lib/game/xp-config";

const DIR = path.join(process.cwd(), "tests", "fixtures", "emails");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".eml"));
const fixture = (prefix: string) =>
  fs.readFileSync(
    path.join(
      DIR,
      FILES.find((f) => f.startsWith(prefix))!,
    ),
  );
const users: string[] = [];

async function newUser(label: string): Promise<string> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const u = await prisma.user.create({
    data: {
      email: `acceptance-${label}+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: `Acceptance ${label}`,
      profile: { create: { timezone: "America/Los_Angeles" } },
      stats: { create: {} },
    },
  });
  users.push(u.id);
  return u.id;
}

const runEmail = (
  userId: string,
  raw: Buffer | string,
): Promise<EmailProcessSummary> =>
  processRawEmail(userId, raw, { provider: "EML" }, (u, o) =>
    ingestObservation(u, o),
  );

const liveApps = (userId: string) =>
  prisma.application.findMany({ where: { userId, mergedIntoId: null } });

/** Net submission XP for the user (awards minus revocations). */
async function submissionXp(userId: string): Promise<number> {
  const agg = await prisma.xpLedger.aggregate({
    where: {
      userId,
      reason: {
        in: ["APPLICATION_SUBMITTED", "REVOKED_APPLICATION_SUBMITTED"],
      },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

async function snapshot(userId: string) {
  const [apps, evidence, events, history, xp, emails, contacts, links] =
    await Promise.all([
      prisma.application.count({ where: { userId } }),
      prisma.evidence.count({ where: { userId } }),
      prisma.applicationEvent.count({ where: { userId } }),
      prisma.applicationStatusHistory.count({
        where: { application: { userId } },
      }),
      prisma.xpLedger.count({ where: { userId } }),
      prisma.emailMessage.count({ where: { userId } }),
      prisma.contact.count({ where: { userId } }),
      prisma.applicationSourceLink.count({
        where: { application: { userId } },
      }),
    ]);
  return { apps, evidence, events, history, xp, emails, contacts, links };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

describe("Phase 2 acceptance — same application, two emails", () => {
  it("001 Indeed confirmation + 011 employer acknowledgment → one Confirmed record, two evidence rows, 25 XP once; re-runs change nothing", async () => {
    const userId = await newUser("acme");
    const first = await runEmail(userId, fixture("001"));
    expect(first).toMatchObject({
      classification: "APPLICATION_SUBMITTED",
      action: "ingested",
    });
    const second = await runEmail(userId, fixture("011"));
    expect(second).toMatchObject({
      classification: "EMPLOYER_ACKNOWLEDGMENT",
      action: "ingested",
      applicationId: first.applicationId,
    });

    const apps = await liveApps(userId);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      id: first.applicationId,
      companyName: "Acme Electric",
      positionTitle: "Apprentice Electrician",
      status: "CONFIRMED",
      statusVerified: true,
      source: "INDEED",
      createdVia: "EMAIL",
    });
    expect(apps[0]!.appliedAt?.toISOString()).toBe("2026-01-12T17:14:33.000Z");
    const evidence = await prisma.evidence.findMany({ where: { userId } });
    expect(evidence).toHaveLength(2);
    expect(
      evidence.every(
        (e) => e.applicationId === first.applicationId && e.kind === "EMAIL",
      ),
    ).toBe(true);
    expect(await submissionXp(userId)).toBe(XP.APPLICATION_SUBMITTED);
    const emails = await prisma.emailMessage.findMany({ where: { userId } });
    expect(emails.map((e) => [e.reviewStatus, e.applicationId])).toEqual([
      ["AUTO_ACCEPTED", first.applicationId],
      ["AUTO_ACCEPTED", first.applicationId],
    ]);
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: first.applicationId! },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      toStatus: "CONFIRMED",
      source: "EMAIL",
      verified: true,
    });

    const before = await snapshot(userId);
    const rerun = [
      await runEmail(userId, fixture("001")),
      await runEmail(userId, fixture("011")),
    ];
    expect(rerun.map((r) => r.action)).toEqual(["duplicate", "duplicate"]);
    expect(await snapshot(userId)).toEqual(before);
  });

  it("003 Workday confirmation + 014 status update → one record once the queued email is attached; 25 XP once; re-runs change nothing", async () => {
    const userId = await newUser("harbor");
    const workday = await runEmail(userId, fixture("003"));
    expect(workday).toMatchObject({
      classification: "APPLICATION_SUBMITTED",
      action: "ingested",
    });
    // 014 is a subtle employer message (confidence below the auto-apply threshold): it is queued, never guessed.
    const update = await runEmail(userId, fixture("014"));
    expect(update).toMatchObject({
      classification: "EMPLOYER_ACKNOWLEDGMENT",
      action: "needs_review",
      applicationId: null,
    });
    expect(await liveApps(userId)).toHaveLength(1);

    // The review queue offers the Workday record as a certain match (same requisition + company).
    const { items } = await loadEmailReview(userId);
    expect(items).toHaveLength(1);
    expect(items[0]!.candidates[0]).toMatchObject({
      applicationId: workday.applicationId,
      score: 1,
    });
    await resolveEmailReview(
      userId,
      items[0]!.id,
      { kind: "attach", applicationId: workday.applicationId! },
      { status: items[0]!.fields.status },
    );

    const apps = await liveApps(userId);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      status: "CONFIRMED",
      requisitionNumber: "R-2026-01844",
      source: "WORKDAY",
    });
    expect(
      await prisma.evidence.count({
        where: { userId, applicationId: workday.applicationId },
      }),
    ).toBe(2);
    expect(await submissionXp(userId)).toBe(XP.APPLICATION_SUBMITTED);

    const before = await snapshot(userId);
    const rerun = [
      await runEmail(userId, fixture("003")),
      await runEmail(userId, fixture("014")),
    ];
    expect(rerun.map((r) => r.action)).toEqual(["duplicate", "user_reviewed"]);
    expect(await snapshot(userId)).toEqual(before);
  });
});

describe("Phase 2 acceptance — later mail about the same job", () => {
  it("a rejection for the same job moves it to Rejected with source EMAIL; an unverified interview link waits for review", async () => {
    const userId = await newUser("reject");
    const submitted = await runEmail(userId, fixture("001"));
    await runEmail(userId, fixture("011"));

    // 019: unverified phone-screen link; it would move a verified stage forward, so the user decides.
    const screen = await runEmail(userId, fixture("019"));
    expect(screen).toMatchObject({
      classification: "INTERVIEW_INVITATION",
      action: "needs_review",
    });
    const row = await prisma.emailMessage.findUniqueOrThrow({
      where: { id: screen.emailMessageId },
    });
    expect((row.extracted as StoredEmailExtract).ingest?.candidateIds).toEqual([
      submitted.applicationId,
    ]);

    const rejection = await runEmail(userId, fixture("025"));
    expect(rejection).toMatchObject({
      classification: "REJECTION",
      action: "ingested",
      applicationId: submitted.applicationId,
    });
    const apps = await liveApps(userId);
    expect(apps).toHaveLength(1);
    expect(apps[0]!.status).toBe("REJECTED");
    const last = await prisma.applicationStatusHistory.findFirstOrThrow({
      where: { applicationId: submitted.applicationId! },
      orderBy: { occurredAt: "desc" },
    });
    expect(last).toMatchObject({
      fromStatus: "CONFIRMED",
      toStatus: "REJECTED",
      source: "EMAIL",
    });
    const rejectedEvent = await prisma.applicationEvent.findFirstOrThrow({
      where: { applicationId: submitted.applicationId!, type: "REJECTED" },
    });
    expect(rejectedEvent.source).toBe("EMAIL");
    expect(
      await prisma.evidence.count({
        where: { userId, applicationId: submitted.applicationId },
      }),
    ).toBe(3);
    expect(await submissionXp(userId)).toBe(XP.APPLICATION_SUBMITTED);
  });

  it("job alerts, unfinished applications and invitations to apply create nothing", async () => {
    const userId = await newUser("alerts");
    for (const prefix of ["034", "035", "036", "037", "038", "039", "040"]) {
      const r = await runEmail(userId, fixture(prefix));
      expect(r.action).toBe("stored");
      expect(r.applicationId).toBeNull();
    }
    expect(await prisma.application.count({ where: { userId } })).toBe(0);
    expect(await prisma.evidence.count({ where: { userId } })).toBe(0);
    expect(await prisma.xpLedger.count({ where: { userId } })).toBe(0);
    expect(
      await prisma.emailMessage.count({
        where: { userId, reviewStatus: "NEEDS_REVIEW" },
      }),
    ).toBe(0);
  });

  it("a user-confirmed Interviewing record is never downgraded by an unverified submission email", async () => {
    const userId = await newUser("nodowngrade");
    const manual = await createApplication(
      userId,
      applicationInputSchema.parse({
        companyName: "Sunbelt HVAC Services",
        positionTitle: "HVAC Technician",
        status: "INTERVIEWING",
        appliedAt: "2026-02-01T12:00:00.000Z",
      }),
      "MANUAL",
    );
    const xpBefore = await submissionXp(userId);
    const historyBefore = await prisma.applicationStatusHistory.count({
      where: { applicationId: manual.application.id },
    });

    // 005 with a failed DMARC check recorded by the receiving server: classified as a submission, not verified.
    const raw = fixture("005")
      .toString("utf8")
      .replace(
        "\r\n",
        "\r\nAuthentication-Results: mx.example.com; dmarc=fail header.from=hire.lever.co\r\n",
      );
    const r = await runEmail(userId, raw);
    expect(r).toMatchObject({
      classification: "APPLICATION_SUBMITTED",
      action: "ingested",
      applicationId: manual.application.id,
    });
    const row = await prisma.emailMessage.findUniqueOrThrow({
      where: { id: r.emailMessageId },
    });
    expect((row.extracted as StoredEmailExtract).observation?.verified).toBe(
      false,
    );
    expect((row.extracted as StoredEmailExtract).ingest?.reason).toMatch(
      /not applied/,
    );

    const app = await prisma.application.findUniqueOrThrow({
      where: { id: manual.application.id },
    });
    expect(app).toMatchObject({ status: "INTERVIEWING", statusVerified: true });
    expect(
      await prisma.applicationStatusHistory.count({
        where: { applicationId: manual.application.id },
      }),
    ).toBe(historyBefore);
    expect(
      await prisma.evidence.count({
        where: { userId, applicationId: manual.application.id },
      }),
    ).toBe(1);
    expect(await submissionXp(userId)).toBe(xpBefore);
    expect(await liveApps(userId)).toHaveLength(1);
  });
});
