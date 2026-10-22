import "server-only";
/**
 * Candidate lookup for the ingestion engine and the review queue.
 *
 * Every query is scoped by userId and limited to non-merged applications. Lookups are bounded and
 * index-friendly: requisition (userId, requisitionNumber), posting URL (userId, normalizedUrl),
 * company equality / prefix (userId, normalizedCompany — the database collation is C, so a LIKE
 * prefix uses the btree), plus the user's 30 most recent records to catch company spellings that
 * share no prefix. Email-thread and source-link lookups are joined through the user's own rows.
 * Scoring itself is pure (`match-score.ts`).
 */
import type { Prisma } from "@/generated/prisma/client";
import type {
  ApplicationSource,
  ApplicationStatus,
} from "@/generated/prisma/enums";
import { normalizeUrl } from "@/lib/applications/normalize";
import {
  scoreMatch,
  subjectFromApplication,
  subjectFromPartial,
  type MatchContext,
  type MatchSignal,
  type PartialFields,
} from "./match-score";

/** Anything with the delegates we read: the Prisma client or an interactive transaction. */
export type MatchDb = Pick<
  Prisma.TransactionClient,
  "application" | "emailMessage" | "applicationSourceLink"
>;

export type CandidatePartial = PartialFields & {
  /** An application the caller already knows (explicit choice): scores 1.0 when owned. */
  applicationId?: string | null;
  /** Email thread id; another message of the thread linked to a record is a strong signal. */
  emailThreadId?: string | null;
};

export type CandidateSummary = {
  id: string;
  companyName: string;
  positionTitle: string;
  location: string | null;
  status: ApplicationStatus;
  statusVerified: boolean;
  source: ApplicationSource;
  appliedAt: Date | null;
  createdAt: Date;
  archivedAt: Date | null;
};

export type CandidateMatch = {
  applicationId: string;
  score: number;
  signals: MatchSignal[];
  deterministic: boolean;
  application: CandidateSummary;
};

export type FindCandidateOptions = {
  /** Maximum candidates returned (1–25, default 5). */
  limit?: number;
  /** Candidates scoring below this are dropped (default 0.5). */
  minScore?: number;
  /** Applications never returned (e.g. the record itself when scanning for its duplicates). */
  excludeIds?: readonly string[];
};

const candidateSelect = {
  id: true,
  companyName: true,
  normalizedCompany: true,
  positionTitle: true,
  normalizedTitle: true,
  location: true,
  requisitionNumber: true,
  normalizedUrl: true,
  source: true,
  status: true,
  statusVerified: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  sourceLinks: { select: { url: true }, take: 25 },
} satisfies Prisma.ApplicationSelect;

type CandidateRow = Prisma.ApplicationGetPayload<{
  select: typeof candidateSelect;
}>;

const unique = <T>(xs: T[]) => [...new Set(xs)];

/**
 * Score the user's non-merged applications against partial evidence and return the best
 * candidates (highest score first). Never reads another user's rows.
 */
export async function findCandidateMatches(
  db: MatchDb,
  userId: string,
  partial: CandidatePartial,
  opts: FindCandidateOptions = {},
): Promise<CandidateMatch[]> {
  const limit = Math.min(25, Math.max(1, Math.floor(opts.limit ?? 5)));
  const minScore = opts.minScore ?? 0.5;
  const exclude = new Set(opts.excludeIds ?? []);
  const subject = subjectFromPartial(partial);
  const base = {
    userId,
    mergedIntoId: null,
  } satisfies Prisma.ApplicationWhereInput;

  const rows = new Map<string, CandidateRow>();
  const ctx = new Map<string, MatchContext>();
  const add = (list: CandidateRow[]) => {
    for (const r of list) if (!exclude.has(r.id)) rows.set(r.id, r);
  };
  const flag = (id: string, key: keyof MatchContext) => {
    if (exclude.has(id)) return;
    ctx.set(id, { ...ctx.get(id), [key]: true });
  };

  if (partial.applicationId) {
    const r = await db.application.findFirst({
      where: { ...base, id: partial.applicationId },
      select: candidateSelect,
    });
    if (r) {
      add([r]);
      flag(r.id, "explicit");
    }
  }

  const req = partial.requisitionId?.trim();
  if (req && subject.requisition) {
    add(
      await db.application.findMany({
        where: {
          ...base,
          requisitionNumber: { in: unique([req, req.toUpperCase()]) },
        },
        select: candidateSelect,
        take: 20,
      }),
    );
  }

  if (subject.normalizedUrl) {
    add(
      await db.application.findMany({
        where: { ...base, normalizedUrl: subject.normalizedUrl },
        select: candidateSelect,
        take: 20,
      }),
    );
  }

  if (partial.emailThreadId) {
    const linked = await db.emailMessage.findMany({
      where: {
        userId,
        threadId: partial.emailThreadId,
        applicationId: { not: null },
      },
      select: { applicationId: true },
      take: 20,
    });
    for (const m of linked)
      if (m.applicationId) flag(m.applicationId, "threadLinked");
  }

  const rawUrl = partial.postingUrl?.trim();
  if (rawUrl && subject.normalizedUrl) {
    const links = await db.applicationSourceLink.findMany({
      where: {
        url: { in: unique([rawUrl, subject.normalizedUrl]) },
        application: base,
      },
      select: { applicationId: true },
      take: 20,
    });
    for (const l of links) flag(l.applicationId, "sourceLinkMatch");
  }

  if (subject.normalizedCompany) {
    const nc = subject.normalizedCompany;
    const first = nc.split(" ")[0] ?? "";
    const or: Prisma.ApplicationWhereInput[] = [{ normalizedCompany: nc }];
    if (first.length >= 3 && first !== nc)
      or.push({ normalizedCompany: { startsWith: first } });
    add(
      await db.application.findMany({
        where: { ...base, OR: or },
        select: candidateSelect,
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    );
  }

  add(
    await db.application.findMany({
      where: base,
      select: candidateSelect,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  );

  const missing = [...ctx.keys()].filter((id) => !rows.has(id));
  if (missing.length) {
    add(
      await db.application.findMany({
        where: { ...base, id: { in: missing } },
        select: candidateSelect,
      }),
    );
  }

  const scored: CandidateMatch[] = [];
  for (const row of rows.values()) {
    const c: MatchContext = { ...ctx.get(row.id) };
    if (
      subject.normalizedUrl &&
      row.sourceLinks.some((l) => normalizeUrl(l.url) === subject.normalizedUrl)
    ) {
      c.sourceLinkMatch = true;
    }
    const s = scoreMatch(subject, subjectFromApplication(row), c);
    if (s.score < minScore) continue;
    scored.push({
      applicationId: row.id,
      score: s.score,
      signals: s.signals,
      deterministic: s.deterministic,
      application: {
        id: row.id,
        companyName: row.companyName,
        positionTitle: row.positionTitle,
        location: row.location,
        status: row.status,
        statusVerified: row.statusVerified,
        source: row.source,
        appliedAt: row.appliedAt,
        createdAt: row.createdAt,
        archivedAt: row.archivedAt,
      },
    });
  }
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      y.application.createdAt.getTime() - x.application.createdAt.getTime(),
  );
  return scored.slice(0, limit);
}
