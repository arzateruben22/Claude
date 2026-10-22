import "server-only";
import { prisma } from "@/lib/db";
import { parsePrefs, type NotificationPrefs } from "./prefs";
import { buildReminderCandidates } from "./rules";
import { isActiveStatus } from "@/lib/applications/status";
import { todayInTz } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

const lastGenerated = new Map<string, number>();
const GENERATE_EVERY_MS = 5 * 60 * 1000;

/** Create any reminders that are now due. Idempotent (unique userId+dedupeKey) and throttled per user. */
export async function generateDueNotifications(userId: string, opts: { force?: boolean; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const last = lastGenerated.get(userId) ?? 0;
  if (!opts.force && now.getTime() - last < GENERATE_EVERY_MS) return 0;
  lastGenerated.set(userId, now.getTime());

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true, workdaysPerWeek: true, notificationPrefs: true },
  });
  const timezone = profile?.timezone ?? "America/Los_Angeles";
  const prefs = parsePrefs(profile?.notificationPrefs);
  const horizon = new Date(now.getTime() + 36 * 3600 * 1000);

  const [apps, interviews, certs, reports, applied] = await Promise.all([
    prisma.application.findMany({
      where: { userId, mergedIntoId: null, archivedAt: null, followUpAt: { lte: horizon } },
      select: { id: true, companyName: true, positionTitle: true, followUpAt: true, status: true },
      take: 200,
    }),
    prisma.interview.findMany({
      where: { userId, outcome: "PENDING", scheduledAt: { gte: now, lte: horizon } },
      select: { id: true, applicationId: true, scheduledAt: true, application: { select: { companyName: true } } },
      take: 50,
    }),
    prisma.certificationStatus.findMany({
      where: { userId },
      select: { classification: true, traineeExpiresAt: true, certificateExpiresAt: true },
    }),
    prisma.weeklyReport.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
      select: { weekStart: true, createdAt: true },
    }),
    prisma.dailyActivity.findUnique({
      where: { userId_date: { userId, date: todayInTz(timezone, now) } },
      select: { applicationsSubmitted: true },
    }),
  ]);

  const candidates = buildReminderCandidates(
    {
      now,
      timezone,
      workdaysPerWeek: profile?.workdaysPerWeek ?? 5,
      followUps: apps
        .filter((a) => a.followUpAt && isActiveStatus(a.status))
        .map((a) => ({ applicationId: a.id, companyName: a.companyName, positionTitle: a.positionTitle, followUpAt: a.followUpAt! })),
      interviews: interviews.map((i) => ({ id: i.id, applicationId: i.applicationId, companyName: i.application.companyName, scheduledAt: i.scheduledAt })),
      certifications: certs,
      weeklyReports: reports,
      appliedToday: applied?.applicationsSubmitted ?? 0,
    },
    prefs,
  );
  if (candidates.length === 0) return 0;
  const res = await prisma.notification.createMany({
    data: candidates.map((c) => ({ userId, dedupeKey: c.dedupeKey, type: c.type, title: c.title, body: c.body, link: c.link, scheduledFor: now })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function getNotificationSummary(userId: string) {
  const [unread, latest] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, link: true, createdAt: true, readAt: true },
    }),
  ]);
  return { unread, latest };
}

export async function listNotifications(userId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 100, 200),
  });
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { notificationPrefs: true } });
  return parsePrefs(profile?.notificationPrefs);
}

export async function savePrefs(userId: string, prefs: NotificationPrefs) {
  await prisma.userProfile.update({ where: { userId }, data: { notificationPrefs: prefs as unknown as Prisma.InputJsonValue } });
  lastGenerated.delete(userId);
}
