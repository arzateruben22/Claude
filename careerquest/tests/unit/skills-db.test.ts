import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { SKILLS } from "@/lib/skills/catalog";
import { loadSkillMetrics, refreshSkills } from "@/lib/skills/service";
import { listLessons } from "@/lib/academy/content";

const created: string[] = [];

async function makeUser(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `skills-${label}+${stamp}@careerquest.test`, passwordHash: "x", name: `Skills ${label}`, profile: { create: { timezone: "America/Los_Angeles" } } },
  });
  created.push(user.id);
  return user.id;
}

afterAll(async () => {
  if (created.length) await prisma.user.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("refreshSkills", () => {
  let userId = "";
  const fundamentals = listLessons().filter((l) => l.track === "FUNDAMENTALS");

  beforeAll(async () => {
    userId = await makeUser("main");
  });

  it("creates one row per skill and is idempotent", async () => {
    const first = await refreshSkills(userId, new Date("2026-10-20T17:00:00Z"));
    expect(first.changed).toBe(SKILLS.length);
    const rows = await prisma.userSkill.findMany({ where: { userId }, orderBy: { skillKey: "asc" } });
    expect(rows).toHaveLength(SKILLS.length);
    expect(rows.every((r) => r.level === 0 && r.xp === 0 && r.unlockedAt === null)).toBe(true);

    const second = await refreshSkills(userId, new Date("2026-10-21T17:00:00Z"));
    expect(second.changed).toBe(0);
    const again = await prisma.userSkill.findMany({ where: { userId }, orderBy: { skillKey: "asc" } });
    expect(again.map((r) => r.updatedAt.getTime())).toEqual(rows.map((r) => r.updatedAt.getTime()));
  });

  it("levels follow real activity and record when a skill was first reached", async () => {
    expect(fundamentals.length).toBeGreaterThanOrEqual(3);
    await prisma.lessonProgress.createMany({
      data: fundamentals.slice(0, 3).map((l) => ({ userId, lessonKey: l.key, status: "COMPLETED" as const, bestScore: 95, attempts: 1 })),
    });
    await prisma.workHourEntry.createMany({
      data: [
        { userId, employer: "Volt Co", dateWorked: new Date("2026-09-01"), hours: "500", verification: "EMPLOYER_VERIFIED", workType: "COMMERCIAL" },
        { userId, employer: "Volt Co", dateWorked: new Date("2026-09-02"), hours: "600", verification: "OFFICIAL_RECORD", workType: "RESIDENTIAL" },
        { userId, employer: "Volt Co", dateWorked: new Date("2026-09-03"), hours: "900", verification: "SELF_REPORTED", workType: "COMMERCIAL" },
        { userId, employer: "School", dateWorked: new Date("2026-09-04"), hours: "200", verification: "EMPLOYER_VERIFIED", workType: "CLASSROOM" },
      ],
    });
    const resume = await prisma.resumeVersion.create({ data: { userId, name: "Electrical", content: "…" } });
    const app = await prisma.application.create({
      data: {
        userId,
        companyName: "Volt Co",
        normalizedCompany: "volt co",
        positionTitle: "Apprentice Electrician",
        normalizedTitle: "apprentice electrician",
        status: "INTERVIEWING",
        appliedAt: new Date("2026-09-10T17:00:00Z"),
        resumeVersionId: resume.id,
      },
    });
    await prisma.interview.create({ data: { userId, applicationId: app.id, scheduledAt: new Date("2026-09-20T17:00:00Z"), prepCompletedAt: new Date("2026-09-19T17:00:00Z") } });
    await prisma.applicationEvent.createMany({
      data: [
        { userId, applicationId: app.id, type: "APPLIED", dedupeKey: `t:applied:${app.id}`, occurredAt: new Date("2026-09-10T17:00:00Z") },
        { userId, applicationId: app.id, type: "FOLLOW_UP_SENT", dedupeKey: `t:fu1:${app.id}`, occurredAt: new Date("2026-09-12T17:00:00Z") },
        { userId, applicationId: app.id, type: "FOLLOW_UP_SENT", dedupeKey: `t:fu2:${app.id}`, occurredAt: new Date("2026-09-12T18:00:00Z") },
        { userId, applicationId: app.id, type: "INTERVIEW_COMPLETED", dedupeKey: `t:int:${app.id}`, occurredAt: new Date("2026-09-20T18:00:00Z") },
      ],
    });
    await prisma.salaryScenario.create({ data: { userId, name: "Apprentice vs helper", inputs: {} } });

    const m = await loadSkillMetrics(prisma, userId);
    expect(m.tracks.FUNDAMENTALS).toMatchObject({ completed: 3, total: fundamentals.length, avgBestScore: 95 });
    expect(m.verifiedFieldHours).toBe(1100);
    expect(m.selfReportedFieldHours).toBe(900);
    expect(m.fieldHoursGoal?.hours).toBe(8000);
    expect(m).toMatchObject({ appliedPositions: 1, resumeVersions: 1, applicationsWithResume: 1, interviewsCompleted: 1, interviewPreps: 1, followUps: 1, salaryPrep: 1 });

    const now = new Date("2026-10-22T17:00:00Z");
    const r = await refreshSkills(userId, now);
    const level = (k: string) => r.skills.find((s) => s.key === k)!.level;
    // 3 completed lessons: level 2 needs a third of the track (rounded up).
    expect(level("electrical.fundamentals")).toBe(3 >= Math.ceil(fundamentals.length / 3) ? 2 : 1);
    expect(level("field.supervised-hours")).toBe(2);
    expect(level("jobs.applications")).toBe(1);
    expect(level("jobs.resume")).toBe(1);
    expect(level("jobs.interviewing")).toBe(2);
    expect(level("jobs.networking")).toBe(1);
    expect(level("jobs.negotiation")).toBe(1);

    const row = await prisma.userSkill.findUnique({ where: { userId_skillKey: { userId, skillKey: "field.supervised-hours" } } });
    expect(row?.level).toBe(2);
    expect(row?.xp).toBe(r.skills.find((s) => s.key === "field.supervised-hours")!.points);
    expect(row?.unlockedAt?.toISOString()).toBe(now.toISOString());
    expect(r.unlockedAt["field.supervised-hours"]).toBe(now.toISOString());

    // A later refresh keeps the first-reached date.
    await refreshSkills(userId, new Date("2026-10-25T17:00:00Z"));
    const kept = await prisma.userSkill.findUnique({ where: { userId_skillKey: { userId, skillKey: "field.supervised-hours" } } });
    expect(kept?.unlockedAt?.toISOString()).toBe(now.toISOString());
  });

  it("drops levels when the activity behind them is deleted", async () => {
    await prisma.workHourEntry.deleteMany({ where: { userId } });
    const r = await refreshSkills(userId, new Date("2026-10-26T17:00:00Z"));
    expect(r.skills.find((s) => s.key === "field.supervised-hours")!.level).toBe(0);
    const row = await prisma.userSkill.findUnique({ where: { userId_skillKey: { userId, skillKey: "field.supervised-hours" } } });
    expect(row).toMatchObject({ level: 0, xp: 0, unlockedAt: null });
  });

  it("never reads another user's activity", async () => {
    const other = await makeUser("other");
    const r = await refreshSkills(other);
    expect(r.skills.every((s) => s.level === 0)).toBe(true);
  });
});
