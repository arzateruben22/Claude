// API analytics: the numbers a platform reports about a post it verified, pulled by the worker with the connection's
// sealed token and written as metric_snapshots with source "api".
// - Only real, verified-published posts (never simulated, never demo) on a live connection whose connector reads
//   metrics. The same check runs when a pull is queued and again when it runs.
// - One pulled row per (publication, metric, UTC day) (unique index metrics_api_daily): a re-pull that day updates the
//   row, never adds a second one. A metric the platform doesn't give gets no row (never 0).
// - Cadence: daily for the first 30 days after publication, then weekly, counted in UTC days from the last attempt
//   (success or not), so a failing post waits for its next period instead of retrying in a loop.
// - An auth failure (expired or revoked grant, a refresh the platform refused) marks the connection expired: it needs
//   reconnecting, nothing pulls from it until then, and the job is not retried. A refresh that fails on the network
//   leaves the connection as it is and is retried. A refusal about one post (Instagram's "(#10) not enough viewers")
//   fails that post's pull only.
// - "Stop external actions" pauses pulls too: while it's on, Prism doesn't call the platforms at all.
// Tokens are unsealed only for the call (connections.freshTokens) and never logged or stored anywhere else.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { connections, destinations, episodes, jobs, metricPulls, metricSnapshots, publications } from "../db/schema";
import { audit, type Conn, DomainError, settings } from "./core";
import { freshTokens, markConnectionError } from "./connections";
import { enqueue } from "./jobs";
import { evaluateSnapshot } from "./rewards";
import { connectorFor } from "../integrations";
import { ConnectorError, type Fetch, type Metrics, type Platform, type PlatformConnector } from "../integrations/types";

export const DAILY_FOR_DAYS = 30;
export const WEEKLY_EVERY_DAYS = 7;
const DAY_MS = 86_400_000;
const LABEL: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };

/** The metrics Prism records from an API answer, in display order. */
export const API_METRICS = ["views", "likes", "comments", "shares", "avg_view_duration_s", "watch_time_s", "followers_gained"] as const;
const UNIT: Partial<Record<(typeof API_METRICS)[number], string>> = { avg_view_duration_s: "seconds", watch_time_s: "seconds" };
const DEFINITION: Record<Platform, string> = {
  youtube: "YouTube Data API videos.list statistics, lifetime",
  tiktok: "TikTok Display API video/query, lifetime",
  instagram: "Instagram media insights, lifetime",
};

export const utcDay = (at: Date) => at.toISOString().slice(0, 10);
const dayNumber = (at: Date) => Math.floor(at.getTime() / DAY_MS);

/** Days between pulls for a post published at `publishedAt`: 1 for its first 30 days, then 7. */
export function cadenceDays(publishedAt: Date, now = new Date()): number {
  return now.getTime() - publishedAt.getTime() < DAILY_FOR_DAYS * DAY_MS ? 1 : WEEKLY_EVERY_DAYS;
}

/** Due when never attempted, or when the cadence's number of UTC days has passed since the last attempt. */
export function isPullDue(v: { publishedAt: Date; lastAttemptAt: Date | null }, now = new Date()): boolean {
  if (!v.lastAttemptAt) return true;
  return dayNumber(now) - dayNumber(v.lastAttemptAt) >= cadenceDays(v.publishedAt, now);
}

/** The instant daily pulls give way to weekly ones. */
export const weeklyFrom = (publishedAt: Date) => new Date(publishedAt.getTime() + DAILY_FOR_DAYS * DAY_MS);

type Resolve = (p: Platform) => PlatformConnector | null;
export type PullBlock = { code: string; message: string };

/** One publication with everything the pull rules look at. */
async function targets(c: Conn, ids: string[] | null) {
  if (ids && !ids.length) return [];
  const rows = await c.select({
    id: publications.id, status: publications.status, simulated: publications.simulated, postId: publications.postId,
    verifiedAt: publications.verifiedAt, reportedAt: publications.reportedAt, createdAt: publications.createdAt,
    isDemo: episodes.isDemo, channelId: episodes.channelId, destinationId: destinations.id, platform: destinations.platform,
    connStatus: connections.status, lastAttemptAt: metricPulls.lastAttemptAt,
  }).from(publications)
    .innerJoin(episodes, eq(episodes.id, publications.episodeId))
    .innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .leftJoin(connections, eq(connections.destinationId, destinations.id))
    .leftJoin(metricPulls, eq(metricPulls.publicationId, publications.id))
    .where(ids ? inArray(publications.id, ids)
      : and(eq(publications.status, "verified_published"), eq(publications.simulated, false), eq(episodes.isDemo, false), eq(connections.status, "connected")));
  return rows.map((r) => ({ ...r, publishedAt: r.verifiedAt ?? r.reportedAt ?? r.createdAt }));
}
type Target = Awaited<ReturnType<typeof targets>>[number];

const readsMetrics = (k: PlatformConnector | null): k is PlatformConnector & { metrics: NonNullable<PlatformConnector["metrics"]> } =>
  !!k && k.capabilities.metrics && typeof k.metrics === "function";

/** Why this publication can't be pulled now, or null when it can. */
export function pullBlocker(t: Pick<Target, "simulated" | "isDemo" | "status" | "postId" | "platform" | "connStatus">, o: { stopped: boolean; connector: PlatformConnector | null }): PullBlock | null {
  const name = LABEL[t.platform];
  if (t.simulated) return { code: "simulated", message: "Simulated publications are never pulled from a platform." };
  if (t.isDemo) return { code: "demo", message: "Demo episodes are never pulled from a platform." };
  if (t.status !== "verified_published") return { code: "not_verified", message: "Only a post the platform itself verified as published is pulled. Log its numbers by hand or paste a CSV." };
  if (!t.postId) return { code: "no_post_id", message: `${name} gave no post id for this publication.` };
  if (!readsMetrics(o.connector)) return { code: "no_metrics", message: `Prism can't read ${name} numbers yet.` };
  if (!t.connStatus) return { code: "not_connected", message: `This ${name} account isn't connected (Accounts → Connect).` };
  if (t.connStatus !== "connected") return { code: "needs_reconnect", message: `The ${name} connection needs reconnecting (Accounts → Reconnect).` };
  if (o.stopped) return { code: "stopped", message: "External actions are stopped in Settings, so analytics pulls are paused." };
  return null;
}

/** Publications with a queued or running pull job. */
async function pullsInFlight(c: Conn): Promise<Set<string>> {
  const rows = await c.select({ payload: jobs.payload }).from(jobs).where(and(eq(jobs.type, "pull_metrics"), inArray(jobs.status, ["queued", "running"])));
  return new Set(rows.map((r) => String(r.payload.publicationId)));
}

/** Every publication whose pull is due now: eligible, past its cadence, and not already queued. */
export async function duePulls(c: Conn, now = new Date(), resolve: Resolve = connectorFor) {
  const s = await settings(c);
  if (s.stopExternalActions) return [];
  const busy = await pullsInFlight(c);
  return (await targets(c, null)).filter((t) => !busy.has(t.id) && !pullBlocker(t, { stopped: false, connector: resolve(t.platform) }) && isPullDue(t, now));
}

/** Housekeeping: queue one pull per due publication. Idempotent per publication per UTC day. */
export async function enqueueDuePulls(d: DB, now = new Date(), resolve: Resolve = connectorFor): Promise<number> {
  let n = 0;
  for (const t of await duePulls(d, now, resolve)) {
    const q = await enqueue(d, { type: "pull_metrics", channelId: t.channelId, payload: { publicationId: t.id }, idempotencyKey: `pull_metrics:${t.id}:${utcDay(now)}`, priority: 0, maxAttempts: 3 });
    if (q.created) n++;
  }
  return n;
}

/** The owner's "Refresh now": queue a pull for this post now, or say why it can't be pulled. */
export async function requestPull(d: DB, publicationId: string, now = new Date(), resolve: Resolve = connectorFor) {
  const [t] = await targets(d, [publicationId]);
  if (!t) throw new DomainError("not_found", "publication not found");
  const s = await settings(d);
  const block = pullBlocker(t, { stopped: s.stopExternalActions, connector: resolve(t.platform) });
  if (block) throw new DomainError(block.code, block.message);
  if ((await pullsInFlight(d)).has(t.id)) return { created: false, platform: t.platform, status: "queued" as const };
  // one Refresh now per post per minute: a second press that minute finds this job, queued or already finished
  const q = await enqueue(d, { type: "pull_metrics", channelId: t.channelId, payload: { publicationId: t.id, manual: true }, idempotencyKey: `pull_metrics:${t.id}:now:${now.toISOString().slice(0, 16)}`, priority: 3, maxAttempts: 3 });
  if (q.created) await audit(d, "owner", "metrics.refresh", "publication", t.id, { platform: t.platform });
  const status = q.created || q.job.status === "queued" || q.job.status === "running" ? "queued" as const : q.job.status === "succeeded" ? "just_pulled" as const : "just_failed" as const;
  return { created: q.created, platform: t.platform, status };
}

async function notePull(c: Conn, publicationId: string, at: Date, outcome: "ok" | "empty" | "needs_reconnect" | "failed", text = "") {
  const ok = outcome === "ok" || outcome === "empty";
  const error = text.replace(/((?:access|refresh)_token|code)=[^&\s"']+/gi, "$1=[redacted]");   // never a token, even inside a URL in an error
  await c.insert(metricPulls).values({ publicationId, lastAttemptAt: at, lastSuccessAt: ok ? at : null, lastOutcome: outcome, lastError: error.slice(0, 300), pulls: 1 })
    .onConflictDoUpdate({ target: metricPulls.publicationId, set: { lastAttemptAt: at, ...(ok ? { lastSuccessAt: at } : {}), lastOutcome: outcome, lastError: error.slice(0, 300), pulls: sql`${metricPulls.pulls} + 1`, updatedAt: new Date() } });
}

/** Write one API answer: one row per reported metric for this UTC day (updated on a re-pull), then milestones. A
 *  re-pull that lowers the day's views is a downward revision like any other: the row is marked revised and the
 *  unlocks of that post are flagged. */
export async function recordApiMetrics(d: DB, t: { id: string; platform: Platform; publishedAt: Date }, m: Metrics, now = new Date()) {
  const written: string[] = [];
  const unlocked: string[] = [];
  const ageHours = Math.max(0, (now.getTime() - t.publishedAt.getTime()) / 3_600_000);
  for (const metric of API_METRICS) {
    const raw = m[metric];
    if (raw === undefined || raw === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;   // a nonsense answer is dropped, never written as 0
    const fields = { value, unit: UNIT[metric] ?? "count", definition: DEFINITION[t.platform], periodStart: t.publishedAt, periodEnd: now, ageHours, retrievedAt: now, status: "ok" };
    // the value this pull replaces, if the day's row exists: a lower number must still flag an unlock it backed
    const [before] = metric === "views" ? await d.select({ value: metricSnapshots.value }).from(metricSnapshots)
      .where(and(eq(metricSnapshots.publicationId, t.id), eq(metricSnapshots.metric, metric), eq(metricSnapshots.source, "api"), eq(metricSnapshots.utcDay, utcDay(now)))) : [];
    const [snap] = await d.insert(metricSnapshots).values({ publicationId: t.id, metric, source: "api", utcDay: utcDay(now), ...fields })
      .onConflictDoUpdate({ target: [metricSnapshots.publicationId, metricSnapshots.metric, metricSnapshots.utcDay], targetWhere: sql`source = 'api'`, set: fields })
      .returning();
    written.push(metric);
    if (metric === "views") unlocked.push(...(await evaluateSnapshot(d, snap.id, { replaced: before?.value })).map((e) => e.id));
  }
  return { written, unlocked };
}

export type PullOutcome = { outcome: "ok" | "empty" | "skipped"; note: string; written: string[]; unlocked: number };

/**
 * The pull_metrics job: ask the platform for one post's numbers and record them. Skips (no platform call) when the
 * post isn't eligible any more. Auth failures mark the connection expired and throw needs_reconnect; other
 * non-retryable platform answers throw pull_failed; network trouble is thrown as is, for the queue's backoff.
 */
export async function pullMetrics(d: DB, publicationId: string, deps: { connector?: PlatformConnector; fetch?: Fetch; now?: Date } = {}): Promise<PullOutcome> {
  const now = deps.now ?? new Date();
  const [t] = await targets(d, [publicationId]);
  if (!t) throw new DomainError("not_found", "publication not found");
  const s = await settings(d);
  const block = pullBlocker(t, { stopped: s.stopExternalActions, connector: deps.connector ?? connectorFor(t.platform) });
  if (block) return { outcome: "skipped", note: block.message, written: [], unlocked: 0 };

  let fresh: Awaited<ReturnType<typeof freshTokens>>;
  try {
    fresh = await freshTokens(d, t.destinationId, deps.fetch);
  } catch (e) {
    if (e instanceof DomainError && (e.code === "expired" || e.code === "not_connected")) {
      await notePull(d, t.id, now, "needs_reconnect", e.message);
      throw new DomainError("needs_reconnect", e.message);
    }
    // the refresh didn't get through (network, rate limit): the grant is fine; the queue retries with backoff
    await notePull(d, t.id, now, "failed", `token refresh: ${(e as Error).message ?? String(e)}`);
    throw e;
  }
  const { tokens } = fresh, connector = deps.connector ?? fresh.connector;
  if (!readsMetrics(connector)) return { outcome: "skipped", note: `Prism can't read ${LABEL[t.platform]} numbers yet.`, written: [], unlocked: 0 };

  let m: Metrics;
  try {
    m = await connector.metrics(tokens, t.postId, deps.fetch);
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    if (e instanceof ConnectorError && e.code === "auth") {
      await markConnectionError(d, t.destinationId, "expired", message);
      await notePull(d, t.id, now, "needs_reconnect", message);
      await audit(d, "worker", "metrics.pull_failed", "publication", t.id, { platform: t.platform, code: "auth" });
      throw new DomainError("needs_reconnect", `the ${LABEL[t.platform]} connection needs reconnecting (Accounts): ${message}`);
    }
    await notePull(d, t.id, now, "failed", message);
    await audit(d, "worker", "metrics.pull_failed", "publication", t.id, { platform: t.platform, code: e instanceof ConnectorError ? e.code : "unknown", error: message.slice(0, 300) });
    if (e instanceof ConnectorError && !e.retryable) throw new DomainError("pull_failed", message);
    throw e;
  }

  const r = await recordApiMetrics(d, t, m, now);
  await notePull(d, t.id, now, r.written.length ? "ok" : "empty");
  await audit(d, "worker", "metrics.pull", "publication", t.id, { platform: t.platform, metrics: r.written, unlocked: r.unlocked.length });
  return {
    outcome: r.written.length ? "ok" : "empty",
    note: r.written.length ? `${LABEL[t.platform]} reported ${r.written.join(", ")}` : `${LABEL[t.platform]} reported no numbers for this post yet`,
    written: r.written, unlocked: r.unlocked.length,
  };
}

export type PullState = {
  blocked: PullBlock | null; queued: boolean; cadenceDays: number | null; weeklyFrom: Date;
  lastAttemptAt: Date | null; lastSuccessAt: Date | null; lastOutcome: string; lastError: string;
};

/** For the analytics and episode screens: each publication's pull state, with no secrets. */
export async function pullStates(c: Conn, publicationIds: string[], now = new Date(), resolve: Resolve = connectorFor): Promise<Map<string, PullState>> {
  const ts = await targets(c, publicationIds);
  if (!ts.length) return new Map();
  const s = await settings(c);
  const busy = await pullsInFlight(c);
  const rows = await c.select().from(metricPulls).where(inArray(metricPulls.publicationId, ts.map((t) => t.id)));
  return new Map(ts.map((t) => {
    const p = rows.find((r) => r.publicationId === t.id);
    const blocked = pullBlocker(t, { stopped: s.stopExternalActions, connector: resolve(t.platform) });
    return [t.id, {
      blocked, queued: busy.has(t.id), cadenceDays: blocked ? null : cadenceDays(t.publishedAt, now), weeklyFrom: weeklyFrom(t.publishedAt),
      lastAttemptAt: p?.lastAttemptAt ?? null, lastSuccessAt: p?.lastSuccessAt ?? null, lastOutcome: p?.lastOutcome ?? "", lastError: p?.lastError ?? "",
    }];
  }));
}
