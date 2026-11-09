// Freeing server disk once an episode is posted everywhere: the worker erases the episode's .mp4 files from the films
// folder on the server (FILMS_REPO_ROOT/films/channels/<channel>/epNN/out) once both Uploaded buttons ("YouTube &
// TikTok" and "Instagram") have stood for a grace period. The originals stay in the films repo on GitHub. Covers,
// thumbnails, captions, posting text, script, claims and film timings stay here, so the episode page keeps its cover
// and captions. Only episode folders are touched: compilations (long videos) never are.
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DB } from "../db/client";
import { destinations, episodes, publications } from "../db/schema";
import { audit } from "./core";
import { enqueue } from "./jobs";
import { pushPath, pushPrefix } from "./media-push";
import { UPLOAD_GROUPS, type UploadGroup } from "./publications";

/** How long both uploads must stand (not undone) before the server copy of the video is erased. */
export const VIDEO_CLEAR_GRACE_DAYS = 3;
export const VIDEO_CLEAR_GRACE_MS = VIDEO_CLEAR_GRACE_DAYS * 24 * 60 * 60 * 1000;
export const VIDEO_CLEAR_JOB = "cleanup_uploaded_media";

const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];
export type PubForClear = {
  platform: "youtube" | "tiktok" | "instagram"; status: string; simulated: boolean;
  reportedAt: Date | null; verifiedAt?: Date | null; scheduledFor?: Date | null;
};

/** When one upload group was recorded as uploaded, or null. Uploaded = it has real (not simulated) rows and every one
 *  is posted (the same test as the Uploaded button's done state); the time is the latest of them. An undone press puts
 *  its rows back (status "ready", no report time), so an undone group is null. A post scheduled on the platform counts
 *  from when it goes live, if that is later. */
export function groupUploadedAt(pubs: PubForClear[], group: UploadGroup): Date | null {
  const platforms: readonly string[] = UPLOAD_GROUPS[group];
  const rows = pubs.filter((p) => !p.simulated && platforms.includes(p.platform));
  if (!rows.length || !rows.every((p) => POSTED.includes(p.status))) return null;
  let latest: Date | null = null;
  for (const p of rows) {
    let t = p.reportedAt ?? p.verifiedAt ?? null;
    if (!t) return null;   // posted with no time recorded: never guess, keep the video
    if (p.status === "scheduled_on_platform" && p.scheduledFor && p.scheduledFor > t) t = p.scheduledFor;
    if (!latest || t > latest) latest = t;
  }
  return latest;
}

/** Whether an episode's video files are due for erasing: both groups uploaded, neither undone, and the later of the
 *  two at least VIDEO_CLEAR_GRACE_DAYS ago. `dueAt` says when it will be (null while a group is not uploaded). */
export function videoClearDue(pubs: PubForClear[], now: Date): { due: boolean; uploadedAt: Date | null; dueAt: Date | null } {
  const a = groupUploadedAt(pubs, "youtube_tiktok"), b = groupUploadedAt(pubs, "instagram");
  if (!a || !b) return { due: false, uploadedAt: null, dueAt: null };
  const uploadedAt = a > b ? a : b, dueAt = new Date(uploadedAt.getTime() + VIDEO_CLEAR_GRACE_MS);
  return { due: now.getTime() >= dueAt.getTime(), uploadedAt, dueAt };
}

const EPISODE_DIR = /^films\/channels\/[a-z0-9-]+\/ep\d{2}$/;
const EPISODE_VIDEO = /^films\/channels\/[a-z0-9-]+\/ep\d{2}\/out\/[^/]+\.mp4$/;

/** The episode folder a clear may touch ("films/channels/physics/ep01"), or null: never a compilation, a channel
 *  folder or anything outside films/channels (the same checks as the media-push cleanup prefix). */
export function clearableEpisodeDir(filmsPath: string | null | undefined): string | null {
  const p = (filmsPath ?? "").replace(/\/+$/, "");
  return EPISODE_DIR.test(p) && pushPrefix(`${p}/`) ? p : null;
}

/** Whether a file is one the clear erases: an .mp4 in an episode's out/ folder that a push could have written. */
export function isClearableVideo(rel: string): boolean {
  return pushPath(rel) !== null && EPISODE_VIDEO.test(rel);
}

/** Whether push-media should skip this file: an .mp4 inside an episode folder whose video was cleared. */
export function isClearedVideo(rel: string, clearedDirs: string[]): boolean {
  return /\.mp4$/.test(rel) && clearedDirs.some((d) => rel.startsWith(`${d}/`));
}

/** Why this machine must not erase videos, or null when it may: the films folder has to exist and be writable, and
 *  must not sit inside a git checkout (there the .mp4 files are the originals, not a server copy). */
export function videoClearBlocker(root: string): string | null {
  const abs = path.resolve(root), base = path.join(abs, "films", "channels");
  if (!fs.existsSync(base)) return "no films/channels folder under FILMS_REPO_ROOT";
  try { fs.accessSync(base, fs.constants.W_OK); } catch { return "the films folder is read-only here"; }
  for (let dir = abs; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return "FILMS_REPO_ROOT is a git checkout: its videos are the originals";
    if (path.dirname(dir) === dir) return null;
  }
}

/** The episode folders whose video was cleared, for media-push (so a push never sends those videos again). */
export async function clearedVideoDirs(d: DB): Promise<string[]> {
  const rows = await d.select({ filmsPath: episodes.filmsPath }).from(episodes).where(isNotNull(episodes.videoClearedAt));
  return rows.map((r) => clearableEpisodeDir(r.filmsPath)).filter((x): x is string => !!x).sort();
}

type Planned = { episodeId: string; dir: string; recorded: boolean; uploadedAt: Date; files: { rel: string; abs: string; bytes: number }[] };

/** The work there is to do: each due episode (real, imported, video not yet recorded as cleared, or recorded but with
 *  an .mp4 back in its folder) with the .mp4 files to erase. Nothing outside root/films/channels is ever listed. */
export async function videoClearPlan(d: DB, root: string, now = new Date()): Promise<Planned[]> {
  const abs = path.resolve(root), base = path.join(abs, "films", "channels");
  const posted = await d.selectDistinct({ id: episodes.id }).from(publications).innerJoin(episodes, eq(episodes.id, publications.episodeId))
    .where(and(inArray(publications.status, ["owner_reported", "scheduled_on_platform", "verified_published"]), eq(publications.simulated, false),
      eq(episodes.isDemo, false), isNotNull(episodes.filmsPath)));
  if (!posted.length) return [];
  const ids = posted.map((r) => r.id);
  const eps = await d.select({ id: episodes.id, filmsPath: episodes.filmsPath, videoClearedAt: episodes.videoClearedAt }).from(episodes).where(inArray(episodes.id, ids));
  const pubs = await d.select({ episodeId: publications.episodeId, platform: destinations.platform, status: publications.status, simulated: publications.simulated,
    reportedAt: publications.reportedAt, verifiedAt: publications.verifiedAt, scheduledFor: publications.scheduledFor })
    .from(publications).innerJoin(destinations, eq(destinations.id, publications.destinationId)).where(inArray(publications.episodeId, ids));
  const plan: Planned[] = [];
  for (const ep of eps) {
    const rule = videoClearDue(pubs.filter((p) => p.episodeId === ep.id), now);
    const dir = clearableEpisodeDir(ep.filmsPath);
    if (!rule.due || !dir) continue;
    const out = path.resolve(abs, dir, "out");
    if (!out.startsWith(base + path.sep)) continue;
    // a symlinked folder must not lead outside films/channels (files themselves: symlinks are skipped, e.isFile())
    if (fs.existsSync(out) && !fs.realpathSync(out).startsWith(fs.realpathSync(base) + path.sep)) continue;
    const files: Planned["files"] = [];
    for (const e of fs.existsSync(out) ? fs.readdirSync(out, { withFileTypes: true }) : []) {
      const rel = `${dir}/out/${e.name}`, file = path.join(out, e.name);
      if (!e.isFile() || !isClearableVideo(rel) || !file.startsWith(base + path.sep)) continue;
      files.push({ rel, abs: file, bytes: fs.statSync(file).size });
    }
    files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
    // a due episode with nothing left on disk is still recorded (its video is not in Prism storage either way)
    if (!ep.videoClearedAt || files.length) plan.push({ episodeId: ep.id, dir, recorded: !!ep.videoClearedAt, uploadedAt: rule.uploadedAt!, files });
  }
  return plan;
}

/** The job: erase the due episodes' .mp4 files, then record on each episode that its video was cleared and when
 *  (audit-logged). Idempotent: a second run finds nothing left to do. Does nothing where videoClearBlocker says no. */
export async function clearUploadedVideos(d: DB, root: string, now = new Date()) {
  const blocked = videoClearBlocker(root);
  if (blocked) return { skipped: blocked, episodes: 0, files: 0, bytes: 0, failed: [] as string[] };
  let cleared = 0, files = 0, bytes = 0;
  const failed: string[] = [];
  for (const p of await videoClearPlan(d, root, now)) {
    const removed: string[] = [];
    let freed = 0;
    for (const f of p.files) {
      try { fs.rmSync(f.abs, { force: true }); removed.push(f.rel); freed += f.bytes; }
      catch (e) { failed.push(`${f.rel}: ${(e as Error).message}`); }
    }
    files += removed.length; bytes += freed;
    if (removed.length < p.files.length) continue;   // something stayed: record nothing yet, the next run tries again
    const [row] = p.recorded ? [] : await d.update(episodes).set({ videoClearedAt: now })
      .where(and(eq(episodes.id, p.episodeId), isNull(episodes.videoClearedAt))).returning({ id: episodes.id });
    if (row) cleared++;
    if (row || removed.length) {
      await audit(d, "worker", "episode.video_cleared", "episode", p.episodeId, {
        folder: p.dir, files: removed, bytes: freed, uploadedAt: p.uploadedAt.toISOString(), graceDays: VIDEO_CLEAR_GRACE_DAYS, again: !row,
      });
    }
  }
  return { episodes: cleared, files, bytes, failed };
}

/** Housekeeping: when there is something to clear, queue the job, at most once an hour (UTC hour idempotency key). */
export async function enqueueVideoClear(d: DB, root: string, now = new Date()): Promise<boolean> {
  if (videoClearBlocker(root) || !(await videoClearPlan(d, root, now)).length) return false;
  const q = await enqueue(d, { type: VIDEO_CLEAR_JOB, idempotencyKey: `${VIDEO_CLEAR_JOB}:${now.toISOString().slice(0, 13)}`, maxAttempts: 3 });
  return q.created;
}
