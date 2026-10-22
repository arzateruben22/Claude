import "server-only";
/**
 * Duplicate scan: stores possible duplicates among one user's non-merged applications as
 * DuplicateCandidate rows (applicationAId < applicationBId, unique per pair) for the review queue.
 * Pairs the user dismissed (or merged) are never re-proposed; pending rows that no longer score as
 * duplicates are removed.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeUrl } from "@/lib/applications/normalize";
import { lockUserIngestion } from "@/lib/ingest/engine";
import { findDuplicatePairs, pairKey, type DedupApp } from "./pairs";

/** Upper bound on records compared in one scan (newest first). */
export const MAX_SCAN_APPLICATIONS = 5000;

export type ScanResult = {
  /** Applications compared. */
  scanned: number;
  /** Pairs at or above the "possible duplicate" score. */
  found: number;
  created: number;
  updated: number;
  /** Pending rows removed because the pair no longer looks like a duplicate. */
  removed: number;
  /** Pairs found again but already dismissed or merged by the user. */
  skipped: number;
};

export async function scanDuplicates(userId: string): Promise<ScanResult> {
  const rows = await prisma.application.findMany({
    where: { userId, mergedIntoId: null },
    select: {
      id: true,
      normalizedCompany: true,
      normalizedTitle: true,
      location: true,
      requisitionNumber: true,
      normalizedUrl: true,
      source: true,
      appliedAt: true,
      createdAt: true,
      sourceLinks: { select: { url: true }, take: 25 },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_SCAN_APPLICATIONS,
  });
  const apps: DedupApp[] = rows.map(({ sourceLinks, ...a }) => ({
    ...a,
    linkUrls: [
      ...new Set(
        sourceLinks
          .map((l) => normalizeUrl(l.url))
          .filter((u): u is string => Boolean(u)),
      ),
    ],
  }));
  const ids = new Set(apps.map((a) => a.id));

  const threadRows = await prisma.emailMessage.findMany({
    where: { userId, threadId: { not: null }, applicationId: { not: null } },
    select: { threadId: true, applicationId: true },
    distinct: ["threadId", "applicationId"],
    take: 20_000,
  });
  const byThread = new Map<string, Set<string>>();
  for (const r of threadRows) {
    if (!r.threadId || !r.applicationId || !ids.has(r.applicationId)) continue;
    const set = byThread.get(r.threadId) ?? new Set<string>();
    set.add(r.applicationId);
    byThread.set(r.threadId, set);
  }
  const threadLinkedPairs: Array<[string, string]> = [];
  for (const set of byThread.values()) {
    const list = [...set];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        threadLinkedPairs.push([list[i]!, list[j]!]);
  }

  const pairs = findDuplicatePairs(apps, { threadLinkedPairs });
  const scannedAt = new Date().toISOString();

  return prisma.$transaction(
    async (tx) => {
      await lockUserIngestion(tx, userId);
      const existing = await tx.duplicateCandidate.findMany({
        where: { userId },
        select: {
          id: true,
          applicationAId: true,
          applicationBId: true,
          status: true,
        },
      });
      const byKey = new Map(
        existing.map((c) => [pairKey(c.applicationAId, c.applicationBId), c]),
      );
      const found = new Set<string>();
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const toCreate: Prisma.DuplicateCandidateCreateManyInput[] = [];
      for (const p of pairs) {
        const key = pairKey(p.aId, p.bId);
        found.add(key);
        const signals = JSON.parse(
          JSON.stringify({
            signals: p.signals,
            deterministic: p.deterministic,
            scannedAt,
          }),
        ) as Prisma.InputJsonValue;
        const row = byKey.get(key);
        if (!row) {
          toCreate.push({
            userId,
            applicationAId: p.aId,
            applicationBId: p.bId,
            score: p.score,
            signals,
          });
        } else if (row.status === "PENDING") {
          await tx.duplicateCandidate.update({
            where: { id: row.id },
            data: { score: p.score, signals },
          });
          updated += 1;
        } else {
          skipped += 1;
        }
      }
      if (toCreate.length) {
        created = (
          await tx.duplicateCandidate.createMany({
            data: toCreate,
            skipDuplicates: true,
          })
        ).count;
      }
      const stale = existing.filter(
        (c) =>
          c.status === "PENDING" &&
          !found.has(pairKey(c.applicationAId, c.applicationBId)) &&
          ids.has(c.applicationAId) &&
          ids.has(c.applicationBId),
      );
      let removed = 0;
      if (stale.length) {
        removed += (
          await tx.duplicateCandidate.deleteMany({
            where: { userId, id: { in: stale.map((c) => c.id) } },
          })
        ).count;
      }
      // Pending pairs that involve a record merged since they were proposed are moot.
      removed += (
        await tx.duplicateCandidate.deleteMany({
          where: {
            userId,
            status: "PENDING",
            OR: [
              { applicationA: { mergedIntoId: { not: null } } },
              { applicationB: { mergedIntoId: { not: null } } },
            ],
          },
        })
      ).count;
      return {
        scanned: apps.length,
        found: pairs.length,
        created,
        updated,
        removed,
        skipped,
      };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}
