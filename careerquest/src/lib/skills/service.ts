import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { TRACK_KEYS, type TrackKey } from "@/lib/academy/constants";
import { listLessons } from "@/lib/academy/content";
import { countDistinctAppliedPositions, safeTimezone, VERIFIED_HOUR_SOURCES } from "@/lib/game/facts";
import { loadCareerSeed } from "@/lib/career-map/load-seed";
import { computeSkills, emptySkillMetrics, SKILLS, type SkillMetrics, type SkillView } from "./catalog";

type Db = Prisma.TransactionClient | typeof prisma;

/** The game mission whose completion counts as salary-negotiation preparation. */
export const SALARY_PREP_MISSION_KEY = "gh.p3.salary";

const PRE_SUBMISSION = ["SAVED", "PREPARING"] as const;
const VERIFIED: ReadonlySet<string> = new Set(VERIFIED_HOUR_SOURCES);

/** The DIR General Electrician hour requirement, with its source, from the research seed. */
export function loadFieldHoursGoal(): SkillMetrics["fieldHoursGoal"] {
  const general = loadCareerSeed().classifications.find((c) => c.code === "GENERAL");
  return general?.hours ? { hours: general.hours.value, name: general.name, sources: general.hours.sources, verifiedOn: general.hours.verifiedOn } : null;
}

/** Every metric the skill tree uses, from persisted, userId-scoped data. */
export async function loadSkillMetrics(db: Db, userId: string): Promise<SkillMetrics> {
  const m = emptySkillMetrics();

  // Academy tracks: completions and the average best quiz score over completed lessons.
  const catalog = listLessons();
  const trackOf = new Map(catalog.map((l) => [l.key, l.track]));
  for (const l of catalog) m.tracks[l.track].total += 1;
  const progress = await db.lessonProgress.findMany({ where: { userId, status: "COMPLETED" }, select: { lessonKey: true, bestScore: true } });
  const scores = new Map<TrackKey, number[]>(TRACK_KEYS.map((k) => [k, []]));
  for (const p of progress) {
    const track = trackOf.get(p.lessonKey);
    if (!track) continue;
    m.tracks[track].completed += 1;
    if (p.bestScore !== null) scores.get(track)!.push(p.bestScore);
  }
  for (const k of TRACK_KEYS) {
    const s = scores.get(k)!;
    m.tracks[k].avgBestScore = s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  }

  // Field hours (classroom entries excluded).
  const hours = await db.workHourEntry.groupBy({ by: ["verification"], where: { userId, workType: { not: "CLASSROOM" } }, _sum: { hours: true } });
  for (const h of hours) {
    const v = h._sum.hours === null ? 0 : Number(h._sum.hours.toString());
    if (VERIFIED.has(h.verification)) m.verifiedFieldHours += v;
    else m.selfReportedFieldHours += v;
  }
  m.fieldHoursGoal = loadFieldHoursGoal();

  // Job search.
  const notMerged = { application: { mergedIntoId: null } };
  m.appliedPositions = await countDistinctAppliedPositions(db, userId);
  m.resumeVersions = await db.resumeVersion.count({ where: { userId } });
  m.applicationsWithResume = await db.application.count({
    where: { userId, mergedIntoId: null, resumeVersionId: { not: null }, OR: [{ appliedAt: { not: null } }, { status: { notIn: [...PRE_SUBMISSION] } }] },
  });
  m.interviewsCompleted = await db.applicationEvent.count({ where: { userId, type: "INTERVIEW_COMPLETED", ...notMerged } });
  m.interviewPreps = await db.interview.count({ where: { userId, prepCompletedAt: { not: null }, ...notMerged } });
  const profile = await db.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const tz = safeTimezone(profile?.timezone);
  const follow = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT e."applicationId", to_char((e."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d
      FROM "ApplicationEvent" e
      JOIN "Application" a ON a."id" = e."applicationId"
      WHERE e."userId" = ${userId} AND e."type" = 'FOLLOW_UP_SENT' AND a."mergedIntoId" IS NULL
    ) t`;
  m.followUps = Number(follow[0]?.n ?? 0);
  m.offersRecorded = await db.offer.count({ where: { userId, ...notMerged } });
  m.offersAccepted = await db.offer.count({ where: { userId, status: "ACCEPTED", ...notMerged } });
  const scenarios = await db.salaryScenario.count({ where: { userId } });
  const prepMission = await db.mission.count({ where: { userId, key: SALARY_PREP_MISSION_KEY, status: "COMPLETED" } });
  m.salaryPrep = scenarios + (prepMission > 0 ? 1 : 0);
  return m;
}

export type RefreshedSkills = { skills: SkillView[]; metrics: SkillMetrics; unlockedAt: Record<string, string | null>; changed: number };

/**
 * Recompute every skill from the user's data and upsert UserSkill idempotently: rows are created
 * once (ON CONFLICT DO NOTHING) and only rewritten when the level, points or first-reached date
 * changes, so repeated refreshes leave the table untouched. `unlockedAt` is the first time the
 * skill reached level 1 and is cleared if the activity behind it is later deleted.
 */
export async function refreshSkills(userId: string, now = new Date()): Promise<RefreshedSkills> {
  const metrics = await loadSkillMetrics(prisma, userId);
  const skills = computeSkills(metrics, SKILLS);
  const existing = await prisma.userSkill.findMany({ where: { userId }, select: { skillKey: true, level: true, xp: true, unlockedAt: true } });
  const byKey = new Map(existing.map((e) => [e.skillKey, e]));

  const missing = skills.filter((s) => !byKey.has(s.key));
  let changed = 0;
  if (missing.length) {
    const r = await prisma.userSkill.createMany({
      data: missing.map((s) => ({ userId, skillKey: s.key, level: s.level, xp: s.points, unlockedAt: s.level >= 1 ? now : null })),
      skipDuplicates: true,
    });
    changed += r.count;
  }

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const unlockedAt: Record<string, string | null> = {};
  for (const s of skills) {
    const e = byKey.get(s.key);
    if (!e) {
      unlockedAt[s.key] = s.level >= 1 ? now.toISOString() : null;
      continue;
    }
    const desired = s.level >= 1 ? (e.unlockedAt ?? now) : null;
    unlockedAt[s.key] = desired ? desired.toISOString() : null;
    if (e.level !== s.level || e.xp !== s.points || (e.unlockedAt?.getTime() ?? null) !== (desired?.getTime() ?? null)) {
      updates.push(prisma.userSkill.update({ where: { userId_skillKey: { userId, skillKey: s.key } }, data: { level: s.level, xp: s.points, unlockedAt: desired } }));
    }
  }
  if (updates.length) {
    await prisma.$transaction(updates);
    changed += updates.length;
  }
  return { skills, metrics, unlockedAt, changed };
}
