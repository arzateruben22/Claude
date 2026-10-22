import "server-only";
/**
 * Sync orchestration: one SyncRun per connection run, counts + errors recorded, the connection's
 * lastSyncAt / lastError / syncCursor updated. Used by the "Sync now" action, the session-authenticated
 * POST /api/integrations/sync, and the CRON_SECRET-authenticated scheduler call.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { SyncStatus } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getAdapter } from "./adapters";
import { safeErrorMessage } from "./adapters/http";
import { INFO_CODES, emptySyncResult, runOperation, type FetchLike, type IngestFn, type SyncIssue, type SyncResult } from "./adapters/types";
import { connectionTokenSource, isOAuthProvider, readConnectionSettings } from "./connections";
import { oauthConfigured, type IntegrationEnv } from "./registry";

export const MAX_ITEMS_PER_RUN = 500;
/** A RUNNING run older than this is considered interrupted (process restart) and closed as FAILED. */
export const STALE_RUN_MS = 30 * 60_000;
const MAX_STORED_ISSUES = 100;

export type SyncDeps = {
  ingest: IngestFn;
  env: IntegrationEnv;
  fetch?: FetchLike;
  now?: () => Date;
  maxItems?: number;
};

export type ConnectionSyncSummary = {
  connectionId: string;
  provider: string;
  runId: string | null;
  status: SyncStatus | "SKIPPED";
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  issues: SyncIssue[];
  message: string;
};

function skipped(connectionId: string, provider: string, message: string): ConnectionSyncSummary {
  return { connectionId, provider, runId: null, status: "SKIPPED", scanned: 0, matched: 0, created: 0, updated: 0, issues: [], message };
}

export function runStatusFor(result: SyncResult): SyncStatus {
  const problems = result.issues.filter((i) => !INFO_CODES.has(i.code));
  if (result.fatal) return result.scanned > 0 ? "PARTIAL" : "FAILED";
  return problems.length > 0 ? "PARTIAL" : "SUCCEEDED";
}

function summaryMessage(status: SyncStatus, r: SyncResult): string {
  if (status === "FAILED") return `Sync failed: ${r.fatal?.message ?? "unknown error"}`;
  const parts = [`${r.scanned} message${r.scanned === 1 ? "" : "s"} checked`];
  if (r.created) parts.push(`${r.created} new`);
  if (r.updated) parts.push(`${r.updated} updated`);
  const problems = r.issues.filter((i) => !INFO_CODES.has(i.code)).length;
  if (problems) parts.push(`${problems} problem${problems === 1 ? "" : "s"}`);
  if (r.capped) parts.push("more to fetch next time");
  return parts.join(", ");
}

/** Close RUNNING runs that were interrupted; report whether a live run is still in progress. */
async function closeStaleRuns(connectionId: string, now: Date): Promise<boolean> {
  await prisma.syncRun.updateMany({
    where: { connectionId, status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUN_MS) } },
    data: { status: "FAILED", finishedAt: now, errors: [{ code: "INTERRUPTED", message: "The sync was interrupted before it finished." }] },
  });
  const live = await prisma.syncRun.count({ where: { connectionId, status: "RUNNING" } });
  return live > 0;
}

/** Run one sync for a connection owned by `userId`. Never throws for provider problems. */
export async function syncConnection(userId: string, connectionId: string, deps: SyncDeps): Promise<ConnectionSyncSummary> {
  const nowFn = deps.now ?? (() => new Date());
  const fetchFn: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init));
  const conn = await prisma.integrationConnection.findFirst({ where: { id: connectionId, userId } });
  if (!conn) return skipped(connectionId, "UNKNOWN", "Connection not found.");
  if (!isOAuthProvider(conn.provider)) return skipped(conn.id, conn.provider, "This provider has nothing to sync.");
  if (conn.status !== "CONNECTED") return skipped(conn.id, conn.provider, "Reconnect this account before syncing.");
  if (!oauthConfigured(conn.provider, deps.env)) return skipped(conn.id, conn.provider, "The OAuth client is not configured on this server.");

  const startedAt = nowFn();
  if (await closeStaleRuns(conn.id, startedAt)) return skipped(conn.id, conn.provider, "A sync for this account is already running.");

  const run = await prisma.syncRun.create({ data: { connectionId: conn.id, startedAt, status: "RUNNING" } });
  const adapter = getAdapter(conn.provider, { fetch: fetchFn });
  const settings = readConnectionSettings(conn.settings);

  let result: SyncResult;
  try {
    result = await runOperation(adapter, "importApplications", {
      userId,
      connectionId: conn.id,
      fetch: fetchFn,
      ingest: deps.ingest,
      tokens: connectionTokenSource(conn, { env: deps.env, fetch: fetchFn, now: nowFn }),
      historyDays: settings.historyDays,
      cursor: conn.syncCursor,
      now: startedAt,
      maxItems: deps.maxItems ?? MAX_ITEMS_PER_RUN,
    });
  } catch (err) {
    result = emptySyncResult(conn.syncCursor);
    result.fatal = { message: safeErrorMessage(err), auth: false };
    result.issues.push({ code: "UNEXPECTED", message: safeErrorMessage(err) });
  }

  const status = runStatusFor(result);
  const finishedAt = nowFn();
  const issues = result.issues.slice(0, MAX_STORED_ISSUES);
  const problems = result.issues.filter((i) => !INFO_CODES.has(i.code)).length;
  const lastError = result.fatal
    ? result.fatal.message
    : problems > 0
      ? `${problems} item${problems === 1 ? "" : "s"} could not be processed in the last sync.`
      : null;

  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt,
      itemsScanned: result.scanned,
      itemsMatched: result.matched,
      itemsCreated: result.created,
      itemsUpdated: result.updated,
      errors: issues as unknown as Prisma.InputJsonValue,
    },
  });
  // Never resurrect a connection that was disconnected while the sync ran.
  await prisma.integrationConnection.updateMany({
    where: { id: conn.id, userId, status: { not: "DISCONNECTED" } },
    data: {
      ...(status !== "FAILED" ? { lastSyncAt: finishedAt } : {}),
      lastError,
      syncCursor: result.cursor,
      ...(result.fatal?.auth ? { status: "NEEDS_REAUTH" as const } : {}),
    },
  });
  if (result.fatal?.auth) {
    await audit("integration.needs_reauth", { userId, entityType: "IntegrationConnection", entityId: conn.id, metadata: { provider: conn.provider } });
  }

  return {
    connectionId: conn.id,
    provider: conn.provider,
    runId: run.id,
    status,
    scanned: result.scanned,
    matched: result.matched,
    created: result.created,
    updated: result.updated,
    issues,
    message: summaryMessage(status, result),
  };
}

/** Sync a user's CONNECTED mailbox connections (optionally only those with scheduled sync enabled). */
export async function syncUserConnections(
  userId: string,
  deps: SyncDeps,
  opts: { onlySyncEnabled?: boolean } = {},
): Promise<ConnectionSyncSummary[]> {
  const conns = await prisma.integrationConnection.findMany({
    where: {
      userId,
      status: "CONNECTED",
      provider: { in: ["GMAIL", "OUTLOOK"] },
      ...(opts.onlySyncEnabled ? { syncEnabled: true } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const out: ConnectionSyncSummary[] = [];
  for (const c of conns) out.push(await syncConnection(userId, c.id, deps));
  return out;
}

export type ScheduledSyncReport = {
  users: number;
  connections: number;
  results: Array<
    | { userId: string; ok: true; summaries: Array<Omit<ConnectionSyncSummary, "issues"> & { issueCount: number }> }
    | { userId: string; ok: false; error: string }
  >;
};

/**
 * Scheduler entry point: every user's syncEnabled, CONNECTED mailbox connections, one user at a time
 * (optionally limited to `userIds`). A failure for one user never stops the others.
 */
export async function syncAllUsers(deps: SyncDeps, opts: { userIds?: string[] } = {}): Promise<ScheduledSyncReport> {
  const rows = await prisma.integrationConnection.findMany({
    where: {
      status: "CONNECTED",
      syncEnabled: true,
      provider: { in: ["GMAIL", "OUTLOOK"] },
      user: { deletedAt: null },
      ...(opts.userIds ? { userId: { in: opts.userIds } } : {}),
    },
    select: { userId: true },
    distinct: ["userId"],
    orderBy: { userId: "asc" },
  });
  const report: ScheduledSyncReport = { users: rows.length, connections: 0, results: [] };
  for (const { userId } of rows) {
    try {
      const summaries = await syncUserConnections(userId, deps, { onlySyncEnabled: true });
      report.connections += summaries.length;
      report.results.push({
        userId,
        ok: true,
        summaries: summaries.map(({ issues, ...rest }) => ({ ...rest, issueCount: issues.length })),
      });
    } catch (err) {
      report.results.push({ userId, ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "Unknown error" });
    }
  }
  return report;
}

export type SyncRunView = {
  id: string;
  connectionId: string;
  provider: string;
  accountEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: SyncStatus;
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  issues: SyncIssue[];
};

export function readIssues(value: unknown): SyncIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      code: typeof v.code === "string" ? v.code : "ERROR",
      message: typeof v.message === "string" ? v.message : "Unknown error",
      ...(typeof v.ref === "string" ? { ref: v.ref } : {}),
    }));
}

/** The user's most recent sync runs across all connections. */
export async function listRecentSyncRuns(userId: string, take = 10): Promise<SyncRunView[]> {
  const runs = await prisma.syncRun.findMany({
    where: { connection: { userId } },
    orderBy: { startedAt: "desc" },
    take,
    include: { connection: { select: { provider: true, accountEmail: true } } },
  });
  return runs.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    provider: r.connection.provider,
    accountEmail: r.connection.accountEmail,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    status: r.status,
    scanned: r.itemsScanned,
    matched: r.itemsMatched,
    created: r.itemsCreated,
    updated: r.itemsUpdated,
    issues: readIssues(r.errors),
  }));
}
