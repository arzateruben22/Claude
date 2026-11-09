import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { markEpisodeUploaded, undoEpisodeUploaded } from "../src/domain/publications";
import {
  clearableEpisodeDir, clearedVideoDirs, clearUploadedVideos, enqueueVideoClear, groupUploadedAt, isClearableVideo, isClearedVideo,
  VIDEO_CLEAR_GRACE_DAYS, VIDEO_CLEAR_GRACE_MS, VIDEO_CLEAR_JOB, videoClearBlocker, videoClearDue, videoClearPlan, type PubForClear,
} from "../src/domain/media-cleanup";

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);
const pub = (platform: PubForClear["platform"], reportedAt: string | null, o: Partial<PubForClear> = {}): PubForClear =>
  ({ platform, status: reportedAt ? "owner_reported" : "ready", simulated: false, reportedAt: reportedAt ? at(reportedAt) : null, ...o });

describe("when an episode's video is due for erasing (pure rule, UTC)", () => {
  const both = [pub("youtube", "2026-11-01T10:00:00Z"), pub("tiktok", "2026-11-01T10:00:00Z"), pub("instagram", "2026-11-02T18:30:00Z")];

  it("the grace period is a named 3 days", () => {
    expect(VIDEO_CLEAR_GRACE_DAYS).toBe(3);
    expect(VIDEO_CLEAR_GRACE_MS).toBe(3 * DAY);
  });
  it("needs both groups: YouTube & TikTok alone, or Instagram alone, is never due", () => {
    const late = at("2026-12-31T00:00:00Z");
    expect(videoClearDue(both.slice(0, 2), late).due).toBe(false);
    expect(videoClearDue(both.slice(2), late).due).toBe(false);
    expect(videoClearDue([], late).due).toBe(false);
  });
  it("the YouTube & TikTok group needs every one of its rows uploaded", () => {
    const half = [pub("youtube", "2026-11-01T10:00:00Z"), pub("tiktok", null), pub("instagram", "2026-11-01T10:00:00Z")];
    expect(groupUploadedAt(half, "youtube_tiktok")).toBeNull();
    expect(videoClearDue(half, at("2026-12-31T00:00:00Z")).due).toBe(false);
  });
  it("counts 3 days from the later of the two groups, to the millisecond", () => {
    const r = videoClearDue(both, at("2026-11-05T18:29:59.999Z"));
    expect(r.uploadedAt?.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(r.dueAt?.toISOString()).toBe("2026-11-05T18:30:00.000Z");
    expect(r.due).toBe(false);
    expect(videoClearDue(both, at("2026-11-05T18:30:00.000Z")).due).toBe(true);
    // 3 days after the earlier group is not enough
    expect(videoClearDue(both, at("2026-11-04T10:00:00Z")).due).toBe(false);
  });
  it("an undone group (rows back to ready, no report time) is not uploaded: nothing is due", () => {
    const undone = [both[0], both[1], pub("instagram", null)];
    expect(groupUploadedAt(undone, "instagram")).toBeNull();
    expect(videoClearDue(undone, at("2026-12-31T00:00:00Z")).due).toBe(false);
  });
  it("pressed again after an undo: the grace period starts over from the new press", () => {
    const again = [both[0], both[1], pub("instagram", "2026-11-04T09:00:00Z")];
    expect(videoClearDue(again, at("2026-11-06T00:00:00Z")).due).toBe(false);
    expect(videoClearDue(again, at("2026-11-07T09:00:00Z")).due).toBe(true);
  });
  it("ignores simulated rows; a group with only simulated rows is not uploaded", () => {
    const sim = [...both.slice(0, 2), pub("instagram", "2026-11-01T00:00:00Z", { simulated: true })];
    expect(videoClearDue(sim, at("2026-12-31T00:00:00Z")).due).toBe(false);
    const extra = [...both, pub("tiktok", null, { simulated: true })];
    expect(videoClearDue(extra, at("2026-11-05T18:30:00Z")).due).toBe(true);
  });
  it("a post scheduled on the platform counts from when it goes live, if later", () => {
    const sched = [both[0], both[1], pub("instagram", "2026-11-01T10:00:00Z", { status: "scheduled_on_platform", scheduledFor: at("2026-11-10T17:00:00Z") })];
    expect(videoClearDue(sched, at("2026-11-12T00:00:00Z")).due).toBe(false);
    expect(videoClearDue(sched, at("2026-11-13T17:00:00Z")).due).toBe(true);
  });
  it("a verified post counts; a posted row with no time recorded keeps the video", () => {
    const verified = [pub("youtube", null, { status: "verified_published", verifiedAt: at("2026-11-01T00:00:00Z") }), both[1], both[2]];
    expect(videoClearDue(verified, at("2026-11-05T18:30:00Z")).due).toBe(true);
    const timeless = [pub("youtube", null, { status: "owner_reported" }), both[1], both[2]];
    expect(videoClearDue(timeless, at("2026-12-31T00:00:00Z")).due).toBe(false);
  });
});

describe("what the clear may touch", () => {
  it("episode folders only: never a compilation, a channel folder or anything outside films/channels", () => {
    expect(clearableEpisodeDir("films/channels/physics/ep01")).toBe("films/channels/physics/ep01");
    expect(clearableEpisodeDir("films/channels/physics/ep01/")).toBe("films/channels/physics/ep01");
    for (const bad of [null, "", "films/channels/physics", "films/channels/physics/compilations/vol01", "films/channels/../ep01", "films/channels/physics/ep01/out",
      "/etc", "films/channels/Physics/ep01", "films/kits/ep01", "films/channels/.x/ep01"]) expect(clearableEpisodeDir(bad)).toBeNull();
  });
  it("only .mp4 files in an episode's out/ folder; covers, thumbnails, captions, posting text, script, claims and film.json stay", () => {
    for (const ok of ["films/channels/physics/ep01/out/rest-frame-001-9x16.mp4", "films/channels/physics/ep01/out/rest-frame-001-9x16-youtube.mp4"]) expect(isClearableVideo(ok)).toBe(true);
    for (const keep of ["films/channels/physics/ep01/out/rest-frame-001-9x16.jpg", "films/channels/physics/ep01/out/rest-frame-001-cover.jpg", "films/channels/physics/ep01/out/rest-frame-001-cover-480.jpg",
      "films/channels/physics/ep01/out/rest-frame-001-thumb.jpg", "films/channels/physics/ep01/out/rest-frame-001-9x16.srt", "films/channels/physics/ep01/out/posting.json",
      "films/channels/physics/ep01/out/POSTING.md", "films/channels/physics/ep01/script.md", "films/channels/physics/ep01/claims.json", "films/channels/physics/ep01/film.json",
      "films/channels/space/compilations/vol01/vol01-16x9.mp4", "films/channels/physics/ep01/build/x.mp4", "films/channels/physics/ep01/out/sub/a.mp4",
      "films/channels/physics/ep01/out/.hidden.mp4", "films/channels/physics/ep01/../ep02/out/a.mp4"]) expect(isClearableVideo(keep)).toBe(false);
  });
  it("push-media skips only the .mp4 files of cleared episode folders", () => {
    const cleared = ["films/channels/physics/ep01"];
    expect(isClearedVideo("films/channels/physics/ep01/out/a-9x16.mp4", cleared)).toBe(true);
    expect(isClearedVideo("films/channels/physics/ep01/out/a-cover.jpg", cleared)).toBe(false);
    expect(isClearedVideo("films/channels/physics/ep010/out/a-9x16.mp4", cleared)).toBe(false);
    expect(isClearedVideo("films/channels/physics/ep02/out/a-9x16.mp4", cleared)).toBe(false);
  });
  it("never runs without a films folder, or inside a git checkout (the originals live there)", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "clear-bare-"));
    expect(videoClearBlocker(bare)).toMatch(/no films\/channels/);
    fs.mkdirSync(path.join(bare, "films", "channels"), { recursive: true });
    expect(videoClearBlocker(bare)).toBeNull();
    fs.mkdirSync(path.join(bare, ".git"));
    expect(videoClearBlocker(bare)).toMatch(/git checkout/);
    expect(videoClearBlocker(path.resolve(import.meta.dirname, "../.."))).not.toBeNull();   // this repo
  });
});

// ── the job, against the test database and a scratch films folder ─────────────────────────────────────────────────
let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

const EP_FILES = ["out/t-001-9x16.mp4", "out/t-001-9x16-youtube.mp4", "out/t-001-9x16.jpg", "out/t-001-cover.jpg", "out/t-001-cover-480.jpg", "out/t-001-thumb.jpg",
  "out/t-001-9x16.srt", "out/posting.json", "out/POSTING.md", "script.md", "claims.json", "film.json"];

/** A scratch films root (not a git checkout) with one episode folder per given path, and one compilation. */
function filmsRoot(...dirs: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "clear-films-"));
  for (const dir of dirs) for (const f of EP_FILES) {
    fs.mkdirSync(path.dirname(path.join(root, dir, f)), { recursive: true });
    fs.writeFileSync(path.join(root, dir, f), `${f} `.repeat(50));
  }
  const comp = path.join(root, "films/channels/space/compilations/vol01/vol01-16x9.mp4");
  fs.mkdirSync(path.dirname(comp), { recursive: true });
  fs.writeFileSync(comp, "long video");
  return root;
}
const has = (root: string, rel: string) => fs.existsSync(path.join(root, rel));

/** An imported-looking episode posted on both groups, with both presses backdated to the given times. */
async function postedEpisode(filmsPath: string, ytAt: Date, igAt: Date, title: string) {
  const r = await renderedEpisode(db, "physics", { title });
  await db.update(S.episodes).set({ filmsPath }).where(eq(S.episodes.id, r.ep.id));
  await markEpisodeUploaded(db, r.ep.id, "youtube_tiktok");
  await markEpisodeUploaded(db, r.ep.id, "instagram");
  await backdate(r.ep.id, ytAt, igAt);
  return r;
}
async function backdate(episodeId: string, ytAt: Date, igAt: Date) {
  const rows = await db.select({ id: S.publications.id, platform: S.destinations.platform }).from(S.publications)
    .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId)).where(eq(S.publications.episodeId, episodeId));
  for (const r of rows) await db.update(S.publications).set({ reportedAt: r.platform === "instagram" ? igAt : ytAt }).where(eq(S.publications.id, r.id));
}
const episode = async (id: string) => (await db.select().from(S.episodes).where(eq(S.episodes.id, id)))[0];
const clearAudits = async (id: string) => db.select().from(S.auditLog).where(and(eq(S.auditLog.entityId, id), eq(S.auditLog.action, "episode.video_cleared")));

describe("the cleanup job (cleanup_uploaded_media)", () => {
  const now = at("2026-11-09T12:00:00Z");

  it("erases only the .mp4 files of a due episode, records when, audit-logs it, and is idempotent", async () => {
    const dir = "films/channels/physics/ep01", root = filmsRoot(dir, "films/channels/physics/ep02");
    const { ep } = await postedEpisode(dir, at("2026-11-01T08:00:00Z"), at("2026-11-05T09:00:00Z"), "Due");
    const r = await clearUploadedVideos(db, root, now);
    expect(r).toMatchObject({ episodes: 1, files: 2, failed: [] });
    expect(r.bytes).toBeGreaterThan(0);
    for (const f of EP_FILES) expect(has(root, `${dir}/${f}`)).toBe(!f.endsWith(".mp4"));
    // another episode's folder and the compilation are untouched
    expect(has(root, "films/channels/physics/ep02/out/t-001-9x16.mp4")).toBe(true);
    expect(has(root, "films/channels/space/compilations/vol01/vol01-16x9.mp4")).toBe(true);
    expect((await episode(ep.id)).videoClearedAt?.toISOString()).toBe(now.toISOString());
    const logs = await clearAudits(ep.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor).toBe("worker");
    expect(logs[0].detail).toMatchObject({ folder: dir, files: [`${dir}/out/t-001-9x16-youtube.mp4`, `${dir}/out/t-001-9x16.mp4`].sort(), graceDays: 3 });
    expect(await clearedVideoDirs(db)).toContain(dir);

    // the second run finds nothing to do, records nothing new and keeps the first time
    const again = await clearUploadedVideos(db, root, at("2026-11-09T13:00:00Z"));
    expect(again).toMatchObject({ episodes: 0, files: 0 });
    expect((await episode(ep.id)).videoClearedAt?.toISOString()).toBe(now.toISOString());
    expect(await clearAudits(ep.id)).toHaveLength(1);
    expect(await videoClearPlan(db, root, now)).toEqual([]);

    // a video that comes back into a cleared folder is erased again (logged), without a new clear time
    fs.writeFileSync(path.join(root, dir, "out/t-001-9x16.mp4"), "back");
    expect(await clearUploadedVideos(db, root, now)).toMatchObject({ episodes: 0, files: 1 });
    expect(has(root, `${dir}/out/t-001-9x16.mp4`)).toBe(false);
    expect(await clearAudits(ep.id)).toHaveLength(2);
  });

  it("keeps the video inside the grace period, counted from the later press", async () => {
    const dir = "films/channels/physics/ep03", root = filmsRoot(dir);
    const { ep } = await postedEpisode(dir, at("2026-11-01T00:00:00Z"), new Date(now.getTime() - 3 * DAY + 60_000), "Grace");
    expect(await clearUploadedVideos(db, root, now)).toMatchObject({ episodes: 0, files: 0 });
    expect(has(root, `${dir}/out/t-001-9x16.mp4`)).toBe(true);
    expect((await episode(ep.id)).videoClearedAt).toBeNull();
    expect(await clearUploadedVideos(db, root, new Date(now.getTime() + 60_000))).toMatchObject({ episodes: 1, files: 2 });
  });

  it("an upload undone before the grace period ends: nothing is erased, however late the job runs", async () => {
    const dir = "films/channels/physics/ep04", root = filmsRoot(dir);
    const { ep } = await postedEpisode(dir, at("2026-11-08T00:00:00Z"), at("2026-11-08T00:00:00Z"), "Undone");
    expect(await undoEpisodeUploaded(db, ep.id, "instagram")).toBe(1);
    expect(await clearUploadedVideos(db, root, at("2026-12-31T00:00:00Z"))).toMatchObject({ episodes: 0, files: 0 });
    expect(has(root, `${dir}/out/t-001-9x16.mp4`)).toBe(true);
    expect((await episode(ep.id)).videoClearedAt).toBeNull();
  });

  it("a demo episode or one with only one group uploaded is never cleared", async () => {
    const dir = "films/channels/physics/ep05", root = filmsRoot(dir);
    const { ep } = await renderedEpisode(db, "physics", { title: "Half" });
    await db.update(S.episodes).set({ filmsPath: dir }).where(eq(S.episodes.id, ep.id));
    await markEpisodeUploaded(db, ep.id, "youtube_tiktok");
    await backdate(ep.id, at("2026-10-01T00:00:00Z"), at("2026-10-01T00:00:00Z"));
    expect(await clearUploadedVideos(db, root, now)).toMatchObject({ episodes: 0, files: 0 });
    await markEpisodeUploaded(db, ep.id, "instagram");
    await backdate(ep.id, at("2026-10-01T00:00:00Z"), at("2026-10-01T00:00:00Z"));
    await db.update(S.episodes).set({ isDemo: true }).where(eq(S.episodes.id, ep.id));
    expect(await clearUploadedVideos(db, root, now)).toMatchObject({ episodes: 0, files: 0 });
    expect(has(root, `${dir}/out/t-001-9x16.mp4`)).toBe(true);
  });

  it("does nothing where it must not erase (a git checkout), and records nothing there", async () => {
    const dir = "films/channels/physics/ep06", root = filmsRoot(dir);
    fs.mkdirSync(path.join(root, ".git"));
    const { ep } = await postedEpisode(dir, at("2026-10-01T00:00:00Z"), at("2026-10-01T00:00:00Z"), "Checkout");
    const r = await clearUploadedVideos(db, root, now);
    expect(r.skipped).toMatch(/git checkout/);
    expect(has(root, `${dir}/out/t-001-9x16.mp4`)).toBe(true);
    expect((await episode(ep.id)).videoClearedAt).toBeNull();
    expect(await enqueueVideoClear(db, root, now)).toBe(false);
  });

  it("never follows a symlinked out/ folder outside films/channels", async () => {
    const dir = "films/channels/physics/ep08", root = filmsRoot("films/channels/physics/ep09");
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "clear-outside-"));
    fs.writeFileSync(path.join(outside, "keep-9x16.mp4"), "not ours");
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.symlinkSync(outside, path.join(root, dir, "out"));
    await postedEpisode(dir, at("2026-10-01T00:00:00Z"), at("2026-10-01T00:00:00Z"), "Symlink");
    expect((await videoClearPlan(db, root, now)).map((p) => p.dir)).not.toContain(dir);
    await clearUploadedVideos(db, root, now);
    expect(fs.existsSync(path.join(outside, "keep-9x16.mp4"))).toBe(true);
  });

  it("housekeeping queues the job only when something is due, at most once an hour", async () => {
    const dir = "films/channels/physics/ep07", root = filmsRoot(dir);
    // earlier tests' due episodes have nothing on disk under this root: they are recorded without erasing anything
    expect(await clearUploadedVideos(db, root, now)).toMatchObject({ files: 0 });
    expect(await enqueueVideoClear(db, root, now)).toBe(false);
    await postedEpisode(dir, at("2026-10-01T00:00:00Z"), at("2026-10-01T00:00:00Z"), "Queue");
    expect(await enqueueVideoClear(db, root, now)).toBe(true);
    expect(await enqueueVideoClear(db, root, at("2026-11-09T12:45:00Z"))).toBe(false);
    expect(await enqueueVideoClear(db, root, at("2026-11-09T13:05:00Z"))).toBe(true);
    const jobs = await db.select().from(S.jobs).where(eq(S.jobs.type, VIDEO_CLEAR_JOB));
    expect(jobs.map((j) => j.idempotencyKey).sort()).toEqual([`${VIDEO_CLEAR_JOB}:2026-11-09T12`, `${VIDEO_CLEAR_JOB}:2026-11-09T13`]);
    await clearUploadedVideos(db, root, now);
    expect(await enqueueVideoClear(db, root, at("2026-11-09T14:05:00Z"))).toBe(false);   // nothing left to do
  });
});
