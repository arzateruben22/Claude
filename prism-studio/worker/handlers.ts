// The worker's job handlers. Each takes the job, a heartbeat (progress + message; returns false once cancellation
// is requested) and the database to use, so the same code runs in the worker and in tests.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { DB } from "../src/db/client";
import * as S from "../src/db/schema";
import type { JobRow } from "../src/domain/jobs";
import { rescheduleMissed } from "../src/domain/schedule";
import { refreshEvolution } from "../src/domain/living";
import { lessonBuildPlan, recordLessonBuild } from "../src/domain/lessons";
import { finalizeProcessing, publishPublication } from "../src/domain/publish";
import { pullMetrics } from "../src/domain/api-analytics";
import { DomainError } from "../src/domain/core";
import { importEpisodes } from "../scripts/import-episodes";

export type Beat = (p: number, msg: string) => Promise<boolean>;   // false = cancel requested
/** Failures that another attempt can't fix: the worker dead-letters these at once instead of retrying. */
export const NON_RETRYABLE = new Set(["needs_films_toolchain", "needs_reconnect", "pull_failed"]);
export type Handler = (job: JobRow, beat: Beat, d: DB) => Promise<Record<string, unknown>>;
export const HANDLERS: Record<string, Handler> = {
  async import_episodes(_, beat, d) {
    await beat(0.1, "reading films/channels");
    const report = await importEpisodes(d);
    return { report };
  },
  // Pile a lesson's episodes into one 16:9 video with the films pipeline (compilation.mjs), then record the outputs.
  async build_lesson(job, beat, d) {
    const plan = await lessonBuildPlan(d, String(job.payload.lessonId));
    const root = path.resolve(process.env.FILMS_REPO_ROOT || "..");
    // the films toolchain (kit, Chromium, ffmpeg) lives with the films repo, not in the hosted image
    if (!fs.existsSync(path.join(root, plan.args[0]))) throw new DomainError("needs_films_toolchain", "lessons are built where the films repo lives: run `npm run worker` on the films machine, then sync the compilation (deploy/sync-media.sh)");
    await beat(0.05, `compilation.mjs ${plan.lesson.name}`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("node", plan.args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => { err += String(d); });
      child.stdout.on("data", (d) => { const m = /(\d+)\/(\d+)/.exec(String(d)); if (m) void beat(0.05 + 0.85 * (+m[1] / +m[2]), String(d).trim().slice(0, 120)).then((ok) => { if (!ok) child.kill(); }); });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`compilation.mjs exited ${code}: ${err.slice(-600)}`))));
    });
    const dir = path.join(root, plan.outDir), video = path.join(dir, `${plan.lesson.name}-16x9.mp4`);
    if (!fs.existsSync(video)) throw new Error(`no output at ${plan.outDir}`);
    const sha = createHash("sha256").update(fs.readFileSync(video)).digest("hex");
    const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "");
    const qa = read("qa.json") ? JSON.parse(read("qa.json")) : {};
    await recordLessonBuild(d, plan.lesson.id, {
      videoPath: `films:${plan.outDir}/${plan.lesson.name}-16x9.mp4`, videoSha256: sha, thumbnailPath: fs.existsSync(path.join(dir, "thumbnail.jpg")) ? `films:${plan.outDir}/thumbnail.jpg` : "",
      chapters: read("chapters.txt"), description: read("description.md"), qa,
    });
    return { video: plan.outDir, sha256: sha.slice(0, 12), qa };
  },
  // Publish one approved publication through its connected destination (scheduled, or the owner's "Publish now").
  async publish(job, beat, d) {
    const r = await publishPublication(d, String(job.payload.publicationId), { manual: job.payload.manual === true, onProgress: beat });
    return { ...r };
  },
  // A post the platform was still processing: ask again; throw (retryable, with backoff) while it still is.
  async publish_status(job, _, d) {
    try { return { ...(await finalizeProcessing(d, String(job.payload.publicationId))) }; }
    catch (e) { if (e instanceof DomainError && e.code === "processing") throw new Error("still processing on the platform"); throw e; }
  },
  // API analytics for one verified post (housekeeping queues due ones; "Refresh now" queues one). Network trouble
  // retries with backoff; an expired grant marks the connection for reconnecting and stops (needs_reconnect).
  async pull_metrics(job, beat, d) {
    await beat(0.1, "asking the platform for this post's numbers");
    return { ...(await pullMetrics(d, String(job.payload.publicationId))) };
  },
  async reschedule_missed(_, __, d) {
    return { moved: await rescheduleMissed(d) };
  },
  async refresh_evolution(_, beat, d) {
    const chans = await d.select().from(S.channels);
    const out: Record<string, number[]> = {};
    for (const [i, c] of chans.entries()) {
      if (!(await beat(i / chans.length, `checking ${c.slug}`))) break;
      out[c.slug] = await refreshEvolution(d, c.id);
    }
    return out;
  },
};


export function runHandler(type: string, job: JobRow, beat: Beat, d: DB) {
  const h = HANDLERS[type];
  if (!h) throw new Error(`no handler for job type ${type}`);
  return h(job, beat, d);
}
