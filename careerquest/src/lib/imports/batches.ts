import "server-only";
/** ImportBatch bookkeeping: one batch per import action, totals + per-row problems recorded at the end. */
import type { Prisma } from "@/generated/prisma/client";
import type { ImportKind, SyncStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { describeTotals, totalsFromJson, type ImportTotals } from "./outcome";
import { MAX_LISTED_ISSUES, type ImportSummaryData, type RowIssue } from "./types";

const MAX_STORED_ISSUES = 500;

export async function createBatch(userId: string, kind: ImportKind, fileName: string | null) {
  return prisma.importBatch.create({ data: { userId, kind, fileName: fileName?.slice(0, 255) ?? null, status: "RUNNING" } });
}

export function batchStatus(totals: ImportTotals): SyncStatus {
  if (totals.total > 0 && totals.errors >= totals.total) return "FAILED";
  if (totals.errors > 0) return "PARTIAL";
  return "SUCCEEDED";
}

/** Persist the outcome and build the summary returned to the UI. Row problems (never row content) are stored. */
export async function finishBatch(
  userId: string,
  batch: { id: string; kind: ImportKind; fileName: string | null },
  totals: ImportTotals,
  issues: RowIssue[],
  opts: { unit: ImportSummaryData["unit"]; reviewQueue?: boolean },
): Promise<ImportSummaryData> {
  const status = batchStatus(totals);
  const stored = issues.filter((i) => i.type !== "warning").slice(0, MAX_STORED_ISSUES);
  await prisma.importBatch.updateMany({
    where: { id: batch.id, userId },
    data: {
      status,
      totals: totals as unknown as Prisma.InputJsonValue,
      errors: stored as unknown as Prisma.InputJsonValue,
    },
  });
  return {
    batchId: batch.id,
    kind: batch.kind,
    fileName: batch.fileName,
    status,
    totals,
    issues: issues.slice(0, MAX_LISTED_ISSUES),
    issuesTruncated: issues.length > MAX_LISTED_ISSUES,
    message: `Import finished: ${describeTotals(totals)}.`,
    reviewQueue: Boolean(opts.reviewQueue),
    unit: opts.unit,
  };
}

export type ImportBatchView = {
  id: string;
  kind: ImportKind;
  fileName: string | null;
  status: SyncStatus;
  createdAt: string;
  totals: ImportTotals;
  problemCount: number;
};

export async function listRecentBatches(userId: string, kinds: ImportKind[], take = 6): Promise<ImportBatchView[]> {
  const rows = await prisma.importBatch.findMany({
    where: { userId, kind: { in: kinds } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    fileName: r.fileName,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    totals: totalsFromJson(r.totals),
    problemCount: Array.isArray(r.errors) ? r.errors.length : 0,
  }));
}
