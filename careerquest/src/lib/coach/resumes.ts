import "server-only";
import { prisma } from "@/lib/db";
import { todayInTz } from "@/lib/dates";
import { applyEventToMissions } from "@/lib/game/missions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { safeTimezone } from "@/lib/game/facts";

/**
 * Résumé versions (the text the Advisor tailors from and that applications reference). Every query
 * is scoped by userId. Saving a version counts toward the résumé missions through the shared
 * mission hook; no XP is awarded directly, so re-saving cannot farm XP.
 */

export const RESUME_NAME_MAX = 120;
export const RESUME_CONTENT_MIN = 20;
export const RESUME_CONTENT_MAX = 50_000;

export type ResumeListItem = {
  id: string;
  name: string;
  content: string;
  fileName: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  applicationCount: number;
};

export async function listResumes(userId: string): Promise<ResumeListItem[]> {
  const rows = await prisma.resumeVersion.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, content: true, fileName: true, isDefault: true, createdAt: true, updatedAt: true, _count: { select: { applications: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    content: r.content,
    fileName: r.fileName,
    isDefault: r.isDefault,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    applicationCount: r._count.applications,
  }));
}

export type SaveResumeInput = { id?: string | null; name: string; content: string; isDefault: boolean };

export type SaveResumeResult = { ok: true; id: string; created: boolean } | { ok: false; reason: "not_found" };

export async function saveResume(userId: string, input: SaveResumeInput, now = new Date()): Promise<SaveResumeResult> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } });
  const activityDate = todayInTz(safeTimezone(profile?.timezone), now);
  return prisma.$transaction(async (tx) => {
    let id: string;
    let created = false;
    if (input.id) {
      const res = await tx.resumeVersion.updateMany({ where: { id: input.id, userId }, data: { name: input.name, content: input.content } });
      if (res.count === 0) return { ok: false as const, reason: "not_found" as const };
      id = input.id;
    } else {
      const count = await tx.resumeVersion.count({ where: { userId } });
      const row = await tx.resumeVersion.create({
        data: { userId, name: input.name, content: input.content, isDefault: input.isDefault || count === 0 },
        select: { id: true },
      });
      id = row.id;
      created = true;
    }
    if (input.isDefault) {
      await tx.resumeVersion.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
      await tx.resumeVersion.updateMany({ where: { userId, id }, data: { isDefault: true } });
    }
    await applyEventToMissions(tx, { userId, type: "RESUME_UPDATED", occurredAt: now, activityDate, sourceId: id });
    await evaluateAchievements(tx, userId);
    return { ok: true as const, id, created };
  });
}

export async function setDefaultResume(userId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.resumeVersion.count({ where: { id, userId } });
    if (!owned) return false;
    await tx.resumeVersion.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    await tx.resumeVersion.updateMany({ where: { userId, id }, data: { isDefault: true } });
    return true;
  });
}

/** Deletes one of the user's résumé versions; applications that used it keep their record (link cleared). */
export async function deleteResume(userId: string, id: string): Promise<boolean> {
  const res = await prisma.resumeVersion.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
