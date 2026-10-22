import "server-only";
/**
 * GET /api/extension/lookup — "Already tracked" in the extension popup. Uses the ingestion
 * matcher (`findCandidateMatches`), scoped to the token's user, and returns at most three
 * applications scoring ≥ 0.65. Read-only.
 */
import { prisma } from "@/lib/db";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { detectPlatform } from "@/lib/applications/normalize";
import { findCandidateMatches } from "@/lib/ingest/match";
import { applicationDetailUrl } from "./cors";
import { isHttpUrl, type LookupQuery } from "./schemas";

export const LOOKUP_LIMIT = 3;
export const LOOKUP_MIN_SCORE = 0.65;

export type LookupMatch = {
  id: string;
  companyName: string;
  positionTitle: string;
  status: ApplicationStatus;
  appliedAt: string | null;
  postingUrl: string | null;
  detailUrl: string;
};

export async function lookupMatches(userId: string, query: LookupQuery, appBase: string, now: Date = new Date()): Promise<LookupMatch[]> {
  const candidates = await findCandidateMatches(
    prisma,
    userId,
    {
      postingUrl: query.url ?? null,
      company: query.company ?? null,
      title: query.title ?? null,
      requisitionId: query.requisitionId ?? null,
      platform: query.url ? detectPlatform(query.url) : null,
      observedAt: now,
    },
    { limit: LOOKUP_LIMIT, minScore: LOOKUP_MIN_SCORE },
  );
  if (!candidates.length) return [];
  const urls = await prisma.application.findMany({
    where: { userId, id: { in: candidates.map((c) => c.applicationId) } },
    select: { id: true, postingUrl: true },
  });
  const urlById = new Map(urls.map((u) => [u.id, u.postingUrl]));
  return candidates.map((c) => {
    const postingUrl = urlById.get(c.applicationId) ?? null;
    return {
      id: c.applicationId,
      companyName: c.application.companyName,
      positionTitle: c.application.positionTitle,
      status: c.application.status,
      appliedAt: c.application.appliedAt ? c.application.appliedAt.toISOString() : null,
      postingUrl: postingUrl && isHttpUrl(postingUrl) ? postingUrl : null,
      detailUrl: applicationDetailUrl(appBase, c.applicationId),
    };
  });
}
