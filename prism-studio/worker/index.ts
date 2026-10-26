// Prism Studio worker: claims jobs from the Postgres queue (fair per channel, leased, heartbeated), runs them,
// and does the periodic housekeeping: recover expired leases, move missed uploads, queue due analytics pulls, and
// notify the owner's devices (upload due, a scheduled publish that needs them, an empty Instagram slot).
// Run alongside the web app: `npm run worker`. Stops cleanly on SIGINT/SIGTERM (the current job finishes).
import os from "node:os";
import { db, pool } from "../src/db/client";
import { claim, complete, fail, heartbeat, markCancelled, recoverExpired } from "../src/domain/jobs";
import { rescheduleMissed } from "../src/domain/schedule";
import { enqueueDuePublishes } from "../src/domain/publish";
import { enqueueDuePulls } from "../src/domain/api-analytics";
import { notifyDue, prunePushEvents } from "../src/domain/push";
import { audit, DomainError } from "../src/domain/core";
import { eq } from "drizzle-orm";
import * as S from "../src/db/schema";
import { HANDLERS, NON_RETRYABLE, runHandler } from "./handlers";
import { loadEnv } from "../scripts/env";
loadEnv();

const ID = `${os.hostname()}:${process.pid}`;
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; console.log(`[worker] ${sig}: finishing the current job, then stopping`); });

async function runOne(): Promise<boolean> {
  const job = await claim(db(), ID, { types: Object.keys(HANDLERS), perChannel: 1 });
  if (!job) return false;
  console.log(`[worker] ${job.type} ${job.id.slice(0, 8)} (attempt ${job.attempts}/${job.maxAttempts})`);
  const beat = async (p: number, msg: string) => !(await heartbeat(db(), job.id, ID, p, msg));   // false = cancel requested
  try {
    const result = await runHandler(job.type, job, beat, db());
    const [j] = await db().select({ c: S.jobs.cancelRequested }).from(S.jobs).where(eq(S.jobs.id, job.id));
    if (j?.c) await markCancelled(db(), job.id, ID);
    else await complete(db(), job.id, ID, result);
  } catch (e) {
    console.error(`[worker] ${job.type} failed:`, e);
    await fail(db(), job.id, ID, (e as Error).message ?? String(e), { retryable: !(e instanceof DomainError && NON_RETRYABLE.has(e.code)) });
  }
  return true;
}

let lastHousekeeping = 0, lastSchedule = 0, lastPushSkip = "";
/** Push notifications for whatever became due this minute. A push problem never stops the worker; only counts are logged. */
async function notify() {
  try {
    const r = await notifyDue(db());
    if (r.events) console.log(`[worker] notified ${r.events} event${r.events > 1 ? "s" : ""}: ${r.sent} delivered, ${r.failed} failed, ${r.removed} device${r.removed === 1 ? "" : "s"} gone`);
    const skip = r.skipped === "no devices" ? "" : r.skipped;
    if (skip !== lastPushSkip) { if (skip) console.warn(`[worker] notifications paused: ${skip}`); lastPushSkip = skip; }
  } catch (e) {
    console.error("[worker] notifications:", (e as Error).message);
  }
}

async function housekeeping() {
  // every minute: queue publications that are due on connected, automatic destinations, then notify
  if (Date.now() - lastSchedule >= 60_000) {
    lastSchedule = Date.now();
    const queued = await enqueueDuePublishes(db());
    if (queued) console.log(`[worker] queued ${queued} due publication${queued > 1 ? "s" : ""}`);
    await notify();
  }
  if (Date.now() - lastHousekeeping < 15 * 60_000) return;
  lastHousekeeping = Date.now();
  const recovered = await recoverExpired(db());
  const moved = await rescheduleMissed(db());
  // API analytics: daily for each verified post's first 30 days, then weekly (one pull per post per UTC day at most)
  const pulls = await enqueueDuePulls(db());
  if (pulls) console.log(`[worker] queued ${pulls} analytics pull${pulls > 1 ? "s" : ""}`);
  await prunePushEvents(db());
  if (recovered || moved || pulls) await audit(db(), "worker", "housekeeping", "jobs", "", { recovered, moved, pulls });
}

console.log(`[worker] ${ID} started`);
while (!stopping) {
  try {
    await housekeeping();
    if (!(await runOne())) await new Promise((r) => setTimeout(r, 3000));
  } catch (e) {
    console.error("[worker] loop error:", e);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await pool().end();
console.log("[worker] stopped");
