/**
 * Pure duplicate-detection helpers: blocking + pairwise scoring over one user's applications, and
 * the rule for which stage survives a merge. No I/O (unit-tested directly).
 */
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { isTerminalStatus, statusRank } from "@/lib/applications/status";
import {
  normalizeRequisition,
  scoreMatch,
  subjectFromApplication,
  type ApplicationLike,
  type MatchSignal,
} from "@/lib/ingest/match-score";
import { INGEST_THRESHOLDS } from "@/lib/ingest/types";

export type DedupApp = ApplicationLike & {
  id: string;
  /** Normalized URLs of the record's source links. */
  linkUrls: readonly string[];
};

export type DedupPair = {
  /** Lexicographically smaller id (DuplicateCandidate.applicationAId). */
  aId: string;
  bId: string;
  score: number;
  signals: MatchSignal[];
  deterministic: boolean;
};

export function orderedPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export const pairKey = (x: string, y: string) => orderedPair(x, y).join("|");

export type FindPairsOptions = {
  /** Pairs of applications linked to messages of the same email thread. */
  threadLinkedPairs?: Iterable<readonly [string, string]>;
  minScore?: number;
  /** Members compared exhaustively per block; larger blocks compare neighbours only. */
  maxBlockSize?: number;
  /** Neighbour window for oversized blocks. */
  window?: number;
};

function compactCompany(nc: string): string {
  return nc.replace(/[^a-z0-9]/g, "");
}

/**
 * Candidate duplicate pairs (score ≥ MATCH_POSSIBLE by default). Records are only compared when
 * they share a block — the same posting URL (own or source link), the same requisition, a company
 * name starting with the same four characters, or a linked email thread — so the work stays close
 * to linear for a personal tracker.
 */
export function findDuplicatePairs(
  apps: readonly DedupApp[],
  opts: FindPairsOptions = {},
): DedupPair[] {
  const minScore = opts.minScore ?? INGEST_THRESHOLDS.MATCH_POSSIBLE;
  const maxBlock = opts.maxBlockSize ?? 250;
  const window = opts.window ?? 60;
  const byId = new Map(apps.map((a) => [a.id, a]));
  const blocks = new Map<string, DedupApp[]>();
  const put = (key: string, a: DedupApp) => {
    const list = blocks.get(key);
    if (list) {
      if (!list.includes(a)) list.push(a);
    } else blocks.set(key, [a]);
  };
  for (const a of apps) {
    if (a.normalizedUrl) put(`u:${a.normalizedUrl}`, a);
    for (const u of a.linkUrls) put(`u:${u}`, a);
    const req = normalizeRequisition(a.requisitionNumber);
    if (req) put(`r:${req}`, a);
    const cc = compactCompany(a.normalizedCompany);
    if (cc) put(`c:${cc.slice(0, 4)}`, a);
  }

  const thread = new Set<string>();
  const comparisons = new Set<string>();
  for (const [x, y] of opts.threadLinkedPairs ?? []) {
    if (x === y || !byId.has(x) || !byId.has(y)) continue;
    const key = pairKey(x, y);
    thread.add(key);
    comparisons.add(key);
  }
  for (const members of blocks.values()) {
    if (members.length < 2) continue;
    const sorted =
      members.length > maxBlock
        ? [...members].sort(
            (p, q) => p.createdAt.getTime() - q.createdAt.getTime(),
          )
        : members;
    const span = members.length > maxBlock ? window : sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < Math.min(sorted.length, i + 1 + span); j++) {
        comparisons.add(pairKey(sorted[i]!.id, sorted[j]!.id));
      }
    }
  }

  const out: DedupPair[] = [];
  for (const key of comparisons) {
    const [aId, bId] = key.split("|") as [string, string];
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;
    const sourceLinkMatch =
      (a.normalizedUrl !== null && b.linkUrls.includes(a.normalizedUrl)) ||
      (b.normalizedUrl !== null && a.linkUrls.includes(b.normalizedUrl)) ||
      a.linkUrls.some((u) => b.linkUrls.includes(u));
    const s = scoreMatch(subjectFromApplication(a), subjectFromApplication(b), {
      threadLinked: thread.has(key),
      sourceLinkMatch,
    });
    if (s.score >= minScore)
      out.push({
        aId,
        bId,
        score: s.score,
        signals: s.signals,
        deterministic: s.deterministic,
      });
  }
  out.sort(
    (p, q) =>
      q.score - p.score ||
      pairKey(p.aId, p.bId).localeCompare(pairKey(q.aId, q.bId)),
  );
  return out;
}

export type StageLike = {
  status: ApplicationStatus;
  statusVerified: boolean;
  statusUpdatedAt: Date;
};

/**
 * Does the merged record's stage replace the kept record's? Only when it is further along: later
 * in the pipeline, a closing status reached after the kept record's last change, a later reopening,
 * or the same stage backed by verification the kept record lacks. The applications service still
 * refuses changes that would override verified data with unverified data.
 */
export function shouldAdoptMergedStatus(
  keep: StageLike,
  merged: StageLike,
): boolean {
  if (merged.status === keep.status)
    return merged.statusVerified && !keep.statusVerified;
  const kt = isTerminalStatus(keep.status);
  const mt = isTerminalStatus(merged.status);
  if (!kt && !mt) return statusRank(merged.status) > statusRank(keep.status);
  if (mt && !kt)
    return merged.statusUpdatedAt.getTime() >= keep.statusUpdatedAt.getTime();
  if (!mt && kt)
    return merged.statusUpdatedAt.getTime() > keep.statusUpdatedAt.getTime();
  return false;
}

/** Which record to keep by default: the one further along, then the older one. */
export function suggestKeep<
  T extends StageLike & { id: string; createdAt: Date },
>(a: T, b: T): T {
  if (shouldAdoptMergedStatus(a, b)) return b;
  if (shouldAdoptMergedStatus(b, a)) return a;
  return a.createdAt.getTime() <= b.createdAt.getTime() ? a : b;
}
