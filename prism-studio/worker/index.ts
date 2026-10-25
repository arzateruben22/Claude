// Prism Studio worker: claims jobs from the Postgres queue (fair per channel, leased, heartbeated), runs them,
// and does the periodic housekeeping: recover expired leases, move missed uploads, re-check evolutions.
// Run alongside the web app: `npm run worker`. Stops cleanly on SIGINT/SIGTERM (the current job finishes).
import os from "node:os";
import { db, pool } from "../src/db/client";
import * as S from "../src/db/schema";
import { claim, complete, fail, heartbeat, markCancelled, recoverExpired, type JobRow } from "../src/domain/jobs";
import { rescheduleMissed } from "../src/domain/schedule";
import { refreshEvolution } from "../src/domain/living";
import { audit } from "../src/domain/core";
import { importEpisodes } from "../scripts/import-episodes";
import { loadEnv } from "../scripts/env";
import { eq } from "drizzle-orm";
loadEnv();

const ID = `${os.hostname()}:${process.pid}`;
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; console.log(`[worker] ${sig}: finishing the current job, then stopping`); });

type Handler = (job: JobRow, beat: (p: number, msg: string) => Promise<boolean>) => Promise<Record<string, unknown>>;
const HANDLERS: Record<string, Handler> = {
  async import_episodes(_, beat) {
    await beat(0.1, "reading films/channels");
    const report = await importEpisodes(db());
    return { report };
  },
  async reschedule_missed() {
    return { moved: await rescheduleMissed(db()) };
  },
  async refresh_evolution(_, beat) {
    const chans = await db().select().from(S.channels);
    const out: Record<string, number[]> = {};
    for (const [i, c] of chans.entries()) {
      if (!(await beat(i / chans.length, `checking ${c.slug}`))) break;
      out[c.slug] = await refreshEvolution(db(), c.id);
    }
    return out;
  },
};

async function runOne(): Promise<boolean> {
  const job = await claim(db(), ID, { types: Object.keys(HANDLERS), perChannel: 1 });
  if (!job) return false;
  console.log(`[worker] ${job.type} ${job.id.slice(0, 8)} (attempt ${job.attempts}/${job.maxAttempts})`);
  const beat = async (p: number, msg: string) => !(await heartbeat(db(), job.id, ID, p, msg));   // false = cancel requested
  try {
    const result = await HANDLERS[job.type](job, beat);
    const [j] = await db().select({ c: S.jobs.cancelRequested }).from(S.jobs).where(eq(S.jobs.id, job.id));
    if (j?.c) await markCancelled(db(), job.id, ID);
    else await complete(db(), job.id, ID, result);
  } catch (e) {
    console.error(`[worker] ${job.type} failed:`, e);
    await fail(db(), job.id, ID, (e as Error).message ?? String(e));
  }
  return true;
}

let lastHousekeeping = 0;
async function housekeeping() {
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
