import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { listLessons } from "@/lib/academy/content";
import { addUtcDays, todayInTz } from "@/lib/dates";
import { safeTimezone, VERIFIED_HOUR_SOURCES } from "@/lib/game/facts";
import { loadCareerSeed } from "./load-seed";
import { buildCareerGraph, CAREER_NODE_KEYS, validateCareerGraph } from "./graph";
import { deriveCareerMap, PACE_WINDOW_DAYS, type ApplicationStatusName, type CareerUserData, type HoursSummary } from "./status";
import type { CareerGraph, CareerMapView, CareerNodeStatus, DocumentKindName, MarkableStatus } from "./types";

type Db = Prisma.TransactionClient | typeof prisma;

/** Applications loaded for role matching (most recently updated first). */
export const CAREER_MAP_APPLICATION_LIMIT = 2000;

const PRE_SUBMISSION: ReadonlySet<string> = new Set(["SAVED", "PREPARING"]);
const VERIFIED: ReadonlySet<string> = new Set(VERIFIED_HOUR_SOURCES);

/** Build the graph from the seed files and log (never throw on) integrity problems. */
export function loadCareerGraph(): { graph: CareerGraph; issues: string[] } {
  const graph = buildCareerGraph(loadCareerSeed());
  const issues = validateCareerGraph(graph);
  if (issues.length) console.warn(`[career-map] graph issues: ${issues.join(" | ")}`);
  return { graph, issues };
}

const dec = (v: Prisma.Decimal | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v.toString()));

/** Everything the status derivation reads, all scoped by userId. */
export async function loadCareerUserData(db: Db, userId: string, now = new Date()): Promise<CareerUserData> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { primaryTrade: true, careerInterests: true, onboardingCompletedAt: true, timezone: true },
  });
  const timezone = safeTimezone(profile?.timezone);

  const programs = await db.userProgramInterest.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { status: true, program: { select: { slug: true, name: true } } },
  });

  const certifications = await db.certificationStatus.findMany({
    where: { userId },
    select: {
      classification: true,
      traineeRegisteredAt: true,
      traineeExpiresAt: true,
      schoolEnrolled: true,
      examApplicationAt: true,
      examEligibleAt: true,
      examScheduledAt: true,
      examPassedAt: true,
      certifiedAt: true,
      certificateExpiresAt: true,
      updatedAt: true,
    },
  });

  // Work hours: on-the-job vs classroom, verified vs self-reported.
  const groups = await db.workHourEntry.groupBy({
    by: ["verification", "workType"],
    where: { userId },
    _sum: { hours: true },
    _count: { _all: true },
  });
  const hours: HoursSummary = {
    verifiedOjt: 0,
    selfReportedOjt: 0,
    verifiedClassroom: 0,
    selfReportedClassroom: 0,
    recentVerifiedOjt: 0,
    recentWindowDays: PACE_WINDOW_DAYS,
    entryCount: 0,
  };
  for (const g of groups) {
    const h = dec(g._sum.hours);
    const verified = VERIFIED.has(g.verification);
    hours.entryCount += g._count._all;
    if (g.workType === "CLASSROOM") {
      if (verified) hours.verifiedClassroom += h;
      else hours.selfReportedClassroom += h;
    } else if (verified) hours.verifiedOjt += h;
    else hours.selfReportedOjt += h;
  }
  if (hours.verifiedOjt > 0) {
    const since = addUtcDays(todayInTz(timezone, now), -PACE_WINDOW_DAYS);
    const recent = await db.workHourEntry.aggregate({
      where: { userId, verification: { in: [...VERIFIED_HOUR_SOURCES] }, workType: { not: "CLASSROOM" }, dateWorked: { gt: since } },
      _sum: { hours: true },
    });
    hours.recentVerifiedOjt = dec(recent._sum.hours);
  }

  const lessonProgress = await db.lessonProgress.findMany({ where: { userId }, select: { lessonKey: true, status: true, bestScore: true } });

  const exams = await db.quizAttempt.findMany({
    where: { userId, quizKey: { startsWith: "exam:" }, maxScore: { gt: 0 } },
    select: { score: true, maxScore: true, passed: true },
  });

  const apps = await db.application.findMany({
    where: { userId, mergedIntoId: null },
    orderBy: { updatedAt: "desc" },
    take: CAREER_MAP_APPLICATION_LIMIT,
    select: { id: true, positionTitle: true, jobCategory: true, companyName: true, status: true, appliedAt: true },
  });

  const docGroups = await db.document.groupBy({ by: ["kind"], where: { userId }, _count: { _all: true } });
  const documents: Partial<Record<DocumentKindName, number>> = {};
  for (const d of docGroups) documents[d.kind as DocumentKindName] = d._count._all;

  const overrides = await db.userCareerNode.findMany({
    where: { userId, nodeKey: { in: [...CAREER_NODE_KEYS] } },
    select: { nodeKey: true, status: true, notes: true, updatedAt: true },
  });

  return {
    now,
    timezone,
    profile: profile ? { primaryTrade: profile.primaryTrade, careerInterests: profile.careerInterests, onboardingCompletedAt: profile.onboardingCompletedAt } : null,
    programs: programs.map((p) => ({ slug: p.program.slug, name: p.program.name, status: p.status })),
    certifications,
    hours,
    lessons: { catalog: listLessons().map((l) => ({ key: l.key, track: l.track })), progress: lessonProgress },
    practiceExams: {
      attempts: exams.length,
      passed: exams.filter((e) => e.passed).length,
      bestPercent: exams.length ? Math.max(...exams.map((e) => Math.round((e.score / e.maxScore) * 100))) : null,
    },
    applications: apps.map((a) => ({
      id: a.id,
      title: a.positionTitle,
      category: a.jobCategory,
      company: a.companyName,
      status: a.status as ApplicationStatusName,
      applied: a.appliedAt !== null || !PRE_SUBMISSION.has(a.status),
    })),
    documents,
    overrides: overrides.map((o) => ({ nodeKey: o.nodeKey, status: o.status as CareerNodeStatus, notes: o.notes, updatedAt: o.updatedAt })),
  };
}

/** The whole /career-map view model for a user. */
export async function getCareerMapData(userId: string, now = new Date()): Promise<CareerMapView> {
  const { graph, issues } = loadCareerGraph();
  const data = await loadCareerUserData(prisma, userId, now);
  return { ...deriveCareerMap(graph, data), issues };
}

// ---------------------------------------------------------------------------
// User marks ("marked by you")
// ---------------------------------------------------------------------------

export class CareerMapInputError extends Error {}

const isNodeKey = (k: string): boolean => (CAREER_NODE_KEYS as readonly string[]).includes(k);

/**
 * Store the user's own status for a stop. It overrides the data-derived status on the map and is
 * always labelled "Marked by you"; it awards no XP and is not a credential.
 */
export async function setCareerNodeMark(
  userId: string,
  input: { nodeKey: string; status: MarkableStatus; notes: string | null },
  now = new Date(),
): Promise<{ nodeKey: string; status: CareerNodeStatus }> {
  if (!isNodeKey(input.nodeKey)) throw new CareerMapInputError("That stop is not on the map.");
  const key = { userId_nodeKey: { userId, nodeKey: input.nodeKey } };
  const existing = await prisma.userCareerNode.findUnique({ where: key, select: { startedAt: true, completedAt: true } });
  const startedAt = input.status === "AVAILABLE" ? null : (existing?.startedAt ?? now);
  const completedAt = input.status === "COMPLETED" ? (existing?.completedAt ?? now) : null;
  const row = await prisma.userCareerNode.upsert({
    where: key,
    create: { userId, nodeKey: input.nodeKey, status: input.status, startedAt, completedAt, notes: input.notes },
    update: { status: input.status, startedAt, completedAt, notes: input.notes },
    select: { nodeKey: true, status: true },
  });
  return { nodeKey: row.nodeKey, status: row.status as CareerNodeStatus };
}

/** Remove the user's mark so the stop follows their data again. Returns whether a mark existed. */
export async function clearCareerNodeMark(userId: string, nodeKey: string): Promise<boolean> {
  if (!isNodeKey(nodeKey)) throw new CareerMapInputError("That stop is not on the map.");
  const r = await prisma.userCareerNode.deleteMany({ where: { userId, nodeKey } });
  return r.count > 0;
}
