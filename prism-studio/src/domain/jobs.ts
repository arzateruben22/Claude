// A durable job queue in Postgres: idempotency keys, leases with heartbeats, capped retries with backoff,
// dead letters, cancellation, crash recovery, and a fair pick so one channel can't take every slot.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { jobs } from "../db/schema";
import { audit, type Conn, DomainError } from "./core";

export type JobRow = typeof jobs.$inferSelect;

export async function enqueue(c: Conn, v: { type: string; payload?: Record<string, unknown>; channelId?: string | null; idempotencyKey?: string; priority?: number; runAfter?: Date; maxAttempts?: number; isDemo?: boolean }) {
  const [row] = await c.insert(jobs).values({
    type: v.type, payload: v.payload ?? {}, channelId: v.channelId ?? null, idempotencyKey: v.idempotencyKey ?? null,
    priority: v.priority ?? 0, runAfter: v.runAfter ?? new Date(), maxAttempts: v.maxAttempts ?? 3, isDemo: v.isDemo ?? false,
  }).onConflictDoNothing({ target: jobs.idempotencyKey }).returning();
  if (row) return { job: row, created: true };
  const [existing] = await c.select().from(jobs).where(eq(jobs.idempotencyKey, v.idempotencyKey!));
  return { job: existing, created: false };
}

/**
 * Claim the next job. Fairness: among ready jobs, prefer the channel with the fewest running jobs, then priority,
 * then age; at most `perChannel` running jobs per channel. SKIP LOCKED lets several workers claim concurrently.
 */
export async function claim(d: DB, workerId: string, o: { types?: string[]; leaseSeconds?: number; perChannel?: number } = {}): Promise<JobRow | null> {
  const lease = o.leaseSeconds ?? 120, per = o.perChannel ?? 1;
  const types = o.types?.length ? sql`and j.type = any(${o.types})` : sql``;
  const r = await d.execute(sql`
    with running as (
      select channel_id, count(*) as n from jobs where status = 'running' group by channel_id
    ), candidate as (
      select j.id from jobs j left join running r on r.channel_id is not distinct from j.channel_id
       where j.status = 'queued' and j.run_after <= now() and not j.cancel_requested ${types}
         and coalesce(r.n, 0) < ${per}
       order by coalesce(r.n, 0) asc, j.priority desc, j.run_after asc, j.created_at asc
       limit 1
       for update of j skip locked
    )
    update jobs set status = 'running', attempts = attempts + 1, locked_by = ${workerId},
           lease_until = now() + make_interval(secs => ${lease}), heartbeat_at = now(), updated_at = now()
     where id in (select id from candidate)
     returning *`);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const [job] = await d.select().from(jobs).where(eq(jobs.id, row.id as string));
  return job;
}

export async function heartbeat(d: DB, jobId: string, workerId: string, progress?: number, message?: string, leaseSeconds = 120) {
  const [row] = await d.update(jobs).set({
    heartbeatAt: new Date(), leaseUntil: new Date(Date.now() + leaseSeconds * 1000), updatedAt: new Date(),
    ...(progress != null ? { progress } : {}), ...(message != null ? { message } : {}),
  }).where(and(eq(jobs.id, jobId), eq(jobs.lockedBy, workerId), eq(jobs.status, "running"))).returning();
  if (!row) throw new DomainError("lease_lost", "this worker no longer holds the job");
  return row.cancelRequested;   // the worker stops cleanly when true
}

export async function complete(d: DB, jobId: string, workerId: string, result: Record<string, unknown> = {}) {
  await d.update(jobs).set({ status: "succeeded", result, progress: 1, leaseUntil: null, lockedBy: null, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.lockedBy, workerId)));
}

/** A failure: retry with exponential backoff (30 s, 2 min, 8 min…) until max attempts, then dead-letter. */
export async function fail(d: DB, jobId: string, workerId: string, error: string, o: { retryable?: boolean } = {}) {
  const [j] = await d.select().from(jobs).where(eq(jobs.id, jobId));
  if (!j || j.lockedBy !== workerId) return;
  const dead = o.retryable === false || j.attempts >= j.maxAttempts;
  const backoff = 30_000 * 4 ** Math.max(0, j.attempts - 1);
  await d.update(jobs).set({
    status: dead ? "dead" : "queued", error: error.slice(0, 4000), lockedBy: null, leaseUntil: null,
    runAfter: dead ? j.runAfter : new Date(Date.now() + backoff), updatedAt: new Date(),
  }).where(eq(jobs.id, jobId));
  await audit(d, "worker", dead ? "job.dead" : "job.retry", "job", jobId, { error: error.slice(0, 300), attempts: j.attempts });
}

export async function requestCancel(d: DB, jobId: string) {
  const [j] = await d.select().from(jobs).where(eq(jobs.id, jobId));
  if (!j) throw new DomainError("not_found", "job not found");
  if (j.status === "queued" || j.status === "blocked") {
    await d.update(jobs).set({ status: "cancelled", cancelRequested: true, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  } else if (j.status === "running") {
    await d.update(jobs).set({ cancelRequested: true, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }
  await audit(d, "owner", "job.cancel", "job", jobId);
}

export async function markCancelled(d: DB, jobId: string, workerId: string) {
  await d.update(jobs).set({ status: "cancelled", lockedBy: null, leaseUntil: null, updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.lockedBy, workerId)));
}

export async function retry(d: DB, jobId: string) {
  const [j] = await d.update(jobs).set({ status: "queued", attempts: 0, error: null, cancelRequested: false, runAfter: new Date(), updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["failed", "dead", "cancelled"]))).returning();
  if (j) await audit(d, "owner", "job.retry_manual", "job", jobId);
  return j ?? null;
}

/** Crash recovery: running jobs whose lease expired go back to the queue (or dead-letter when out of attempts). */
export async function recoverExpired(d: DB) {
  const r = await d.execute(sql`
    update jobs set status = case when attempts >= max_attempts then 'dead'::job_status else 'queued'::job_status end,
           locked_by = null, lease_until = null, error = coalesce(error, '') || ' [lease expired: worker stopped]', updated_at = now()
     where status = 'running' and lease_until < now() returning id`);
  return r.rows.length;
}
