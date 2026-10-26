// Prism Studio worker: claims jobs from the Postgres queue (fair per channel, leased, heartbeated), runs them,
// and does the periodic housekeeping: recover expired leases, move missed uploads, re-check evolutions.
// Run alongside the web app: `npm run worker`. Stops cleanly on SIGINT/SIGTERM (the current job finishes).
import os from "node:os";
import { db, pool } from "../src/db/client";
import { claim, complete, fail, heartbeat, markCancelled, recoverExpired } from "../src/domain/jobs";
import { rescheduleMissed } from "../src/domain/schedule";
import { enqueueDuePublishes } from "../src/domain/publish";
import { audit, DomainError } from "../src/domain/core";
import { eq } from "drizzle-orm";
import * as S from "../src/db/schema";
import { HANDLERS, runHandler } from "./handlers";
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
    await fail(db(), job.id, ID, (e as Error).message ?? String(e), { retryable: !(e instanceof DomainError && e.code === "needs_films_toolchain") });
  }
  return true;
}

let lastHousekeeping = 0, lastSchedule = 0;
async function housekeeping() {
  // every minute: queue publications that are due on connected, automatic destinations
  if (Date.now() - lastSchedule >= 60_000) {
    lastSchedule = Date.now();
    const queued = await enqueueDuePublishes(db());
    if (queued) console.log(`[worker] queued ${queued} due publication${queued > 1 ? "s" : ""}`);
  }
  if (Date.now() - lastHousekeeping < 15 * 60_000) return;
  lastHousekeeping = Date.now();
  const recovered = await recoverExpired(db());
  const moved = await rescheduleMissed(db());
  if (recovered || moved) await audit(db(), "worker", "housekeeping", "jobs", "", { recovered, moved });
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
