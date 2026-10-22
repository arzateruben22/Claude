import "server-only";
/**
 * Target companies: the employers the user wants to work for, with how many of the user's own
 * applications went to each (matched on the normalized company name). Adding a company earns
 * TARGET_COMPANY_ADDED XP once per company name (`xp:target-company:<normalizedName>`), at most
 * DAILY_XP_CAP times in 24 hours so a list of throwaway names cannot farm XP; deleting a company
 * revokes its XP.
 */
import { prisma } from "@/lib/db";
import { normalizeCompany } from "@/lib/applications/normalize";
import { awardXpStandalone, revokeXpForSource } from "@/lib/game/xp";
import { todayInTz } from "@/lib/dates";
import { loadDiscoveryProfile } from "./profile";
import type { TargetCompanyInput } from "./schemas";

export const MAX_TARGET_COMPANIES = 300;
export const DAILY_XP_CAP = 10;
export const XP_SOURCE_TYPE = "TargetCompany";

export const targetCompanyXpKey = (normalizedName: string) => `xp:target-company:${normalizedName}`;

export type TargetCompanyView = {
  id: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  category: string | null;
  priority: 1 | 2 | 3;
  notes: string | null;
  applicationCount: number;
  /** Tracker search link for this company's applications. */
  applicationsHref: string;
};

const isHttp = (u: string | null): u is string => Boolean(u && /^https?:\/\//i.test(u));
const asPriority = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

export async function listTargetCompanies(userId: string): Promise<TargetCompanyView[]> {
  const rows = await prisma.targetCompany.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    take: MAX_TARGET_COMPANIES,
  });
  const names = [...new Set(rows.map((r) => normalizeCompany(r.name)))];
  const counts = names.length
    ? await prisma.application.groupBy({
        by: ["normalizedCompany"],
        where: { userId, mergedIntoId: null, normalizedCompany: { in: names } },
        _count: { _all: true },
      })
    : [];
  const byName = new Map(counts.map((c) => [c.normalizedCompany, c._count._all]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    website: isHttp(r.website) ? r.website : null,
    careersUrl: isHttp(r.careersUrl) ? r.careersUrl : null,
    category: r.category,
    priority: asPriority(r.priority),
    notes: r.notes,
    applicationCount: byName.get(normalizeCompany(r.name)) ?? 0,
    applicationsHref: `/applications?${new URLSearchParams({ q: r.name, archived: "1" }).toString()}`,
  }));
}

export type CompanyWriteResult =
  | { ok: true; id: string; message: string; xpAwarded: number }
  | { ok: false; reason: "duplicate" | "not_found" | "limit"; message: string };

async function duplicateOf(userId: string, name: string, excludeId?: string) {
  const normalized = normalizeCompany(name);
  // The list is capped at MAX_TARGET_COMPANIES, so comparing normalized names in memory is exact.
  const candidates = await prisma.targetCompany.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  return candidates.find((c) => normalizeCompany(c.name) === normalized) ?? null;
}

export async function createTargetCompany(userId: string, input: TargetCompanyInput, now: Date = new Date()): Promise<CompanyWriteResult> {
  const dup = await duplicateOf(userId, input.name);
  if (dup) return { ok: false, reason: "duplicate", message: `${dup.name} is already on your list.` };
  if ((await prisma.targetCompany.count({ where: { userId } })) >= MAX_TARGET_COMPANIES) {
    return { ok: false, reason: "limit", message: `You already track ${MAX_TARGET_COMPANIES} companies. Remove some first.` };
  }
  const row = await prisma.targetCompany.create({
    data: {
      userId,
      name: input.name,
      website: input.website ?? null,
      careersUrl: input.careersUrl ?? null,
      category: input.category ?? null,
      priority: input.priority,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });

  let xpAwarded = 0;
  const recentAwards = await prisma.xpLedger.count({
    where: { userId, reason: "TARGET_COMPANY_ADDED", amount: { gt: 0 }, createdAt: { gte: new Date(now.getTime() - 24 * 3600 * 1000) } },
  });
  if (recentAwards < DAILY_XP_CAP) {
    const { timezone } = await loadDiscoveryProfile(userId);
    const award = await awardXpStandalone({
      userId,
      reason: "TARGET_COMPANY_ADDED",
      dedupeKey: targetCompanyXpKey(normalizeCompany(input.name)),
      sourceType: XP_SOURCE_TYPE,
      sourceId: row.id,
      activityDate: todayInTz(timezone, now),
    });
    xpAwarded = award.amount;
  }
  return {
    ok: true,
    id: row.id,
    xpAwarded,
    message: `${input.name} added to your target companies.${xpAwarded ? ` +${xpAwarded} XP.` : ""}`,
  };
}

export async function updateTargetCompany(userId: string, id: string, input: TargetCompanyInput): Promise<CompanyWriteResult> {
  const existing = await prisma.targetCompany.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return { ok: false, reason: "not_found", message: "That company is no longer on your list." };
  const dup = await duplicateOf(userId, input.name, id);
  if (dup) return { ok: false, reason: "duplicate", message: `${dup.name} is already on your list.` };
  await prisma.targetCompany.updateMany({
    where: { id, userId },
    data: {
      name: input.name,
      website: input.website ?? null,
      careersUrl: input.careersUrl ?? null,
      category: input.category ?? null,
      priority: input.priority,
      notes: input.notes ?? null,
    },
  });
  return { ok: true, id, xpAwarded: 0, message: `${input.name} updated.` };
}

export async function deleteTargetCompany(userId: string, id: string): Promise<{ ok: boolean; message: string; xpRevoked: number }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.targetCompany.findFirst({ where: { id, userId }, select: { id: true, name: true } });
    if (!row) return { ok: false, message: "That company is no longer on your list.", xpRevoked: 0 };
    await tx.targetCompany.delete({ where: { id: row.id } });
    const xpRevoked = await revokeXpForSource(tx, userId, XP_SOURCE_TYPE, row.id);
    return { ok: true, message: `${row.name} removed.${xpRevoked ? ` ${xpRevoked} XP for adding it was taken back.` : ""}`, xpRevoked };
  });
}
