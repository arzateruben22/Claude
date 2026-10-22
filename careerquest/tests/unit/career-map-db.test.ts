import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { CareerMapInputError, clearCareerNodeMark, getCareerMapData, loadCareerUserData, setCareerNodeMark } from "@/lib/career-map/service";
import { addUtcDays, todayInTz } from "@/lib/dates";

const TZ = "America/Los_Angeles";
const NOW = new Date();
const createdUsers: string[] = [];
const createdPrograms: string[] = [];

async function makeUser(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `career-map-${label}+${stamp}@careerquest.test`,
      passwordHash: "x",
      name: `Career ${label}`,
      profile: { create: { timezone: TZ, primaryTrade: "ELECTRICIAN", careerInterests: ["Commercial HVAC"], onboardingCompletedAt: new Date("2026-09-01T17:00:00Z") } },
    },
  });
  createdUsers.push(user.id);
  return user.id;
}

afterAll(async () => {
  if (createdUsers.length) await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  if (createdPrograms.length) await prisma.apprenticeshipProgram.deleteMany({ where: { id: { in: createdPrograms } } });
  await prisma.$disconnect();
});

describe("career map: statuses from real records", () => {
  let userId = "";
  let otherId = "";

  beforeAll(async () => {
    userId = await makeUser("main");
    otherId = await makeUser("other");
    const today = todayInTz(TZ, NOW);
    const recent = addUtcDays(today, -10);
    const old = addUtcDays(today, -400);

    const program = await prisma.apprenticeshipProgram.create({
      data: { slug: `cm-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name: "Test Electrical JATC", sponsor: "Test", region: "Orange County" },
    });
    createdPrograms.push(program.id);
    await prisma.userProgramInterest.create({ data: { userId, programId: program.id, status: "APPLIED" } });

    await prisma.certificationStatus.create({
      data: { userId, classification: "GENERAL", traineeRegisteredAt: new Date("2026-01-10T18:00:00Z"), traineeExpiresAt: addUtcDays(NOW, 200), schoolEnrolled: "Approved School" },
    });

    await prisma.workHourEntry.createMany({
      data: [
        { userId, employer: "Volt Co", dateWorked: old, hours: "400", verification: "EMPLOYER_VERIFIED", workType: "COMMERCIAL" },
        { userId, employer: "Volt Co", dateWorked: old, hours: "400", verification: "EMPLOYER_VERIFIED", workType: "COMMERCIAL" },
        { userId, employer: "Volt Co", dateWorked: recent, hours: "400", verification: "EMPLOYER_VERIFIED", workType: "RESIDENTIAL" },
        { userId, employer: "Volt Co", dateWorked: recent, hours: "40", verification: "OFFICIAL_RECORD", workType: "INDUSTRIAL" },
        { userId, employer: "Volt Co", dateWorked: recent, hours: "300", verification: "SELF_REPORTED", workType: "COMMERCIAL" },
        { userId, employer: "School", dateWorked: recent, hours: "20", verification: "EMPLOYER_VERIFIED", workType: "CLASSROOM" },
        // Another user's hours never leak into this map.
        { userId: otherId, employer: "Elsewhere", dateWorked: recent, hours: "999", verification: "EMPLOYER_VERIFIED", workType: "COMMERCIAL" },
      ],
    });

    await prisma.lessonProgress.create({ data: { userId, lessonKey: "ohms-law", status: "COMPLETED", bestScore: 90, attempts: 1, completedAt: NOW } });
    await prisma.quizAttempt.create({ data: { userId, quizKey: "exam:25:12345", score: 20, maxScore: 25, passed: true } });
    await prisma.document.create({ data: { userId, kind: "HOURS_VERIFICATION", fileName: "letter.pdf", mimeType: "application/pdf", sizeBytes: 100, storagePath: "x", sha256: "y" } });
    await prisma.application.createMany({
      data: [
        { userId, companyName: "Volt Co", normalizedCompany: "volt co", positionTitle: "Apprentice Electrician", normalizedTitle: "apprentice electrician", status: "SUBMITTED", appliedAt: NOW },
        { userId, companyName: "Cool Air", normalizedCompany: "cool air", positionTitle: "HVAC Helper", normalizedTitle: "hvac helper", status: "SAVED" },
      ],
    });
  });

  it("loads only this user's records, split by verification and work type", async () => {
    const d = await loadCareerUserData(prisma, userId, NOW);
    expect(d.hours.verifiedOjt).toBe(1240);
    expect(d.hours.selfReportedOjt).toBe(300);
    expect(d.hours.verifiedClassroom).toBe(20);
    expect(d.hours.recentVerifiedOjt).toBe(440);
    expect(d.hours.entryCount).toBe(6);
    expect(d.programs).toEqual([expect.objectContaining({ name: "Test Electrical JATC", status: "APPLIED" })]);
    expect(d.practiceExams).toEqual({ attempts: 1, passed: 1, bestPercent: 80 });
    expect(d.documents).toEqual({ HOURS_VERIFICATION: 1 });
    expect(d.applications.find((a) => a.title === "HVAC Helper")?.applied).toBe(false);
    expect(d.lessons.catalog.length).toBeGreaterThan(20);
  });

  it("derives each stop with its evidence", async () => {
    const view = await getCareerMapData(userId, NOW);
    expect(view.issues).toEqual([]);
    const s = (k: string) => view.nodes.find((n) => n.key === k)!.state;
    expect(s("beginner").status).toBe("COMPLETED");
    expect(s("trainee-or-apprentice").status).toBe("COMPLETED");
    expect(s("supervised-experience").reason).toBe("In progress because: 1,240 verified hours of 8,000 (General Electrician)");
    expect(s("supervised-experience").documentsOnFile.find((d) => /verifying your hours/.test(d.label))?.onFile).toBe(true);
    expect(s("supervised-experience").durationEstimate?.text).toMatch(/recent verified pace/);
    expect(s("trainee-or-apprentice").evidence.some((e) => /1 program application in progress: Test Electrical JATC/.test(e.text))).toBe(true);
    expect(s("ca-certification").evidence.some((e) => /Practice exams: 1 attempt, 1 passed, best score 80%/.test(e.text))).toBe(true);
    // A saved (not submitted) HVAC application is not activity; the interest is shown.
    expect(s("hvac-entry").status).toBe("AVAILABLE");
    expect(s("hvac-entry").interest).toBe("interest");
    expect(view.currentKey).toBe("supervised-experience");

    const other = await getCareerMapData(otherId, NOW);
    expect(other.nodes.find((n) => n.key === "supervised-experience")!.state.reason).toBe("In progress because: 999 verified hours of 8,000 (General Electrician)");
  });

  it("stores, updates and clears the user's own mark", async () => {
    await setCareerNodeMark(userId, { nodeKey: "foreman", status: "COMPLETED", notes: "Promoted" }, new Date("2026-10-01T17:00:00Z"));
    let row = await prisma.userCareerNode.findUnique({ where: { userId_nodeKey: { userId, nodeKey: "foreman" } } });
    expect(row).toMatchObject({ status: "COMPLETED", notes: "Promoted" });
    expect(row?.startedAt?.toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(row?.completedAt?.toISOString()).toBe("2026-10-01T17:00:00.000Z");

    let view = await getCareerMapData(userId, NOW);
    const foreman = view.nodes.find((n) => n.key === "foreman")!.state;
    expect(foreman.status).toBe("COMPLETED");
    expect(foreman.derivedStatus).toBe("LOCKED");
    expect(foreman.reason).toBe("Marked by you: Completed");

    await setCareerNodeMark(userId, { nodeKey: "foreman", status: "IN_PROGRESS", notes: null }, new Date("2026-10-05T17:00:00Z"));
    row = await prisma.userCareerNode.findUnique({ where: { userId_nodeKey: { userId, nodeKey: "foreman" } } });
    expect(row).toMatchObject({ status: "IN_PROGRESS", notes: null, completedAt: null });
    expect(row?.startedAt?.toISOString()).toBe("2026-10-01T17:00:00.000Z");

    // Marks are per user.
    const otherView = await getCareerMapData(otherId, NOW);
    expect(otherView.nodes.find((n) => n.key === "foreman")!.state.override).toBeNull();

    expect(await clearCareerNodeMark(userId, "foreman")).toBe(true);
    expect(await clearCareerNodeMark(userId, "foreman")).toBe(false);
    view = await getCareerMapData(userId, NOW);
    expect(view.nodes.find((n) => n.key === "foreman")!.state.override).toBeNull();

    await expect(setCareerNodeMark(userId, { nodeKey: "not-a-stop", status: "COMPLETED", notes: null })).rejects.toBeInstanceOf(CareerMapInputError);
    await expect(clearCareerNodeMark(userId, "not-a-stop")).rejects.toBeInstanceOf(CareerMapInputError);
  });
});
