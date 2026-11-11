import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, freshDb, renderedEpisode, channel, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { HANDLERS } from "../worker/handlers";
import type { JobRow } from "../src/domain/jobs";
import {
  approveLesson, availableForLesson, createLesson, dissolveLesson, editLesson, lessonBuildPlan, lessonHash, markLessonUploaded, recordLessonBuild, undoLessonUploaded,
} from "../src/domain/lessons";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

async function fourRendered(slug: string) {
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    const r = await renderedEpisode(db, slug, { title: `Part ${i + 1}` });
    await db.update(S.episodes).set({ filmsPath: `films/channels/${slug}/ep0${i + 1}` }).where(eq(S.episodes.id, r.ep.id));
    ids.push(r.ep.id);
  }
  return ids;
}
const built = (id: string, qa: Record<string, unknown> = { fails: [] }) =>
  recordLessonBuild(db, id, { videoPath: "films:films/channels/physics/compilations/vol01/vol01-16x9.mp4", videoSha256: "abc", thumbnailPath: "", chapters: "0:00 Intro", description: "Sources…", qa });

describe("lessons", () => {
  it("needs 4–8 rendered, unused episodes of the channel", async () => {
    const { c } = await channel(db, "physics");
    const ids = await fourRendered("physics");
    await expect(createLesson(db, { channelId: c.id, episodeIds: ids.slice(0, 3), title: "Too few" })).rejects.toThrow(/4 to 8/);
    const nine = Array.from({ length: 9 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`);
    await expect(createLesson(db, { channelId: c.id, episodeIds: nine, title: "Too many" })).rejects.toThrow(/4 to 8/);
    const other = (await renderedEpisode(db, "space")).ep.id;
    await expect(createLesson(db, { channelId: c.id, episodeIds: [...ids.slice(0, 3), other], title: "Wrong channel" })).rejects.toThrow(/Every episode/);
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "Forces you can see" });
    expect(l.name).toBe("vol01");
    expect(l.state).toBe("render");
    expect((await availableForLesson(db, c.id)).map((e) => e.id)).not.toContain(ids[0]);   // consumed
    await expect(createLesson(db, { channelId: c.id, episodeIds: ids, title: "Again" })).rejects.toThrow(/Every episode/);
    const plan = await lessonBuildPlan(db, l.id);
    expect(plan.args).toEqual(["kits/cinema/film/compilation.mjs", "--channel", "films/channels/physics", "--episodes", "ep01,ep02,ep03,ep04", "--title", "Forces you can see", "--name", "vol01"]);
    const jobs = await db.select().from(S.jobs).where(eq(S.jobs.type, "build_lesson"));
    expect(jobs).toHaveLength(1);
  });
  it("a season film's 8 parts fit in one lesson (LESSON_MAX 8)", async () => {
    const { c } = await channel(db, "skincare");
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await renderedEpisode(db, "skincare", { title: `Part ${i + 1}` });
      await db.update(S.episodes).set({ filmsPath: `films/channels/skincare/ep${13 + i}` }).where(eq(S.episodes.id, r.ep.id));
      ids.push(r.ep.id);
    }
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "Eight parts" });
    expect(await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, l.id))).toHaveLength(8);
    expect((await lessonBuildPlan(db, l.id)).args).toContain("ep13,ep14,ep15,ep16,ep17,ep18,ep19,ep20");
  });
  it("a host without the films toolchain refuses the build once, with where to run it", async () => {
    const { c } = await channel(db, "space");
    const l = await createLesson(db, { channelId: c.id, episodeIds: await fourRendered("space"), title: "Light, late" });
    const prev = process.env.FILMS_REPO_ROOT;
    process.env.FILMS_REPO_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "no-films-"));
    try {
      const job = { id: "j", type: "build_lesson", payload: { lessonId: l.id } } as unknown as JobRow;
      await expect(HANDLERS.build_lesson(job, async () => true, db)).rejects.toMatchObject({ code: "needs_films_toolchain" });
    } finally { process.env.FILMS_REPO_ROOT = prev; }
  });
  it("a recorded approval binds the built video, title and description (no longer needed to mark uploaded)", async () => {
    const { c } = await channel(db, "body");
    const ids = await fourRendered("body");
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "Traffic inside you" });
    await expect(approveLesson(db, l.id)).rejects.toThrow(/hasn't been built/);
    await built(l.id, { fails: ["loudness"] });
    await expect(approveLesson(db, l.id)).rejects.toThrow(/quality check/);
    await built(l.id);
    await approveLesson(db, l.id);
    let [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.state).toBe("approved");
    expect(row.approvedHash).toBe(lessonHash(row));
    await editLesson(db, l.id, { description: "edited" });
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.approvedHash).toBe("");
    expect(row.state).toBe("ready_for_review");
    await expect(markLessonUploaded(db, l.id, { postUrl: "https://www.tiktok.com/@a/video/1" })).rejects.toThrow(/not a youtube link/);
    await markLessonUploaded(db, l.id, { postUrl: "https://youtu.be/abc" });
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.state).toBe("published");
    expect(row.postUrl).toBe("https://youtu.be/abc");
    await expect(dissolveLesson(db, l.id)).rejects.toThrow(/published/);
  });
  it("a rebuild withdraws the approval", async () => {
    const { c } = await channel(db, "space");
    const ids = await fourRendered("space");
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "How far, how fast" });
    await built(l.id); await approveLesson(db, l.id);
    await recordLessonBuild(db, l.id, { videoPath: "films:x.mp4", videoSha256: "def", thumbnailPath: "", chapters: "", description: "Sources…", qa: {} });
    const [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.approvedHash).toBe("");
    expect(row.state).toBe("ready_for_review");
  });
  it("Uploaded on YouTube: one press records any built, real long video, with no approval; demo, test and unbuilt ones are refused", async () => {
    const { c } = await channel(db, "physics");
    const l = await createLesson(db, { channelId: c.id, episodeIds: await fourRendered("physics"), title: "No approval needed" });
    await expect(markLessonUploaded(db, l.id)).rejects.toThrow(/isn't built yet/);
    await built(l.id, { fails: ["loudness"] });   // even a failed QA: the owner says it is up, so it is recorded
    let [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.approvedHash).toBe("");
    expect(await markLessonUploaded(db, l.id)).toBe("marked");
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row.state).toBe("published");
    expect(row.reportedAt).toBeInstanceOf(Date);
    expect(row.postUrl).toBe("");
    const first = row.reportedAt!;
    // a second press changes nothing: the first report stands, audit-logged once, as the owner's
    expect(await markLessonUploaded(db, l.id)).toBe("already");
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(+row.reportedAt!).toBe(+first);
    const log = await db.select().from(S.auditLog).where(and(eq(S.auditLog.action, "lesson.mark_uploaded"), eq(S.auditLog.entityId, l.id)));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor: "owner", detail: { evidence: "owner_reported" } });
    // demo and test long videos are never recorded
    const [demo] = await db.insert(S.lessons).values({ channelId: c.id, title: "Demo long", name: "vol90", isDemo: true, videoPath: "films:x-16x9.mp4" }).returning();
    const [fixture] = await db.insert(S.lessons).values({ channelId: c.id, title: "Fixture", name: "vol91", isTestFixture: true, videoPath: "films:y-16x9.mp4" }).returning();
    await expect(markLessonUploaded(db, demo.id)).rejects.toThrow(/demo or test/);
    await expect(markLessonUploaded(db, fixture.id)).rejects.toThrow(/demo or test/);
  });
  it("Undo puts a long video back to built and not uploaded (audit-logged); pressing again records it again", async () => {
    const [l] = await db.select().from(S.lessons).where(eq(S.lessons.title, "No approval needed"));
    expect(l.state).toBe("published");
    expect(await undoLessonUploaded(db, l.id)).toBe(true);
    let [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row).toMatchObject({ state: "ready_for_review", reportedAt: null, postUrl: "" });
    expect(await undoLessonUploaded(db, l.id)).toBe(false);   // nothing left to undo
    const [log] = await db.select().from(S.auditLog).where(and(eq(S.auditLog.action, "lesson.undo_uploaded"), eq(S.auditLog.entityId, l.id)));
    expect(log.actor).toBe("owner");
    expect(log.detail).toMatchObject({ postUrl: "" });
    expect((log.detail as { reportedAt: string | null }).reportedAt).toBeTruthy();
    // not uploaded again: it can be dissolved; pressed again, it is uploaded again
    expect(await markLessonUploaded(db, l.id, { postUrl: "https://youtu.be/xyz" })).toBe("marked");
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(row).toMatchObject({ state: "published", postUrl: "https://youtu.be/xyz" });
    // a demo long video marked published by the seed is never undone by the button
    const [demo] = await db.insert(S.lessons).values({ channelId: l.channelId, title: "Demo up", name: "vol92", isDemo: true, state: "published", videoPath: "films:z-16x9.mp4" }).returning();
    expect(await undoLessonUploaded(db, demo.id)).toBe(false);
  });
  it("dissolving an unpublished lesson frees its episodes", async () => {
    const { c } = await channel(db, "whatif");
    const ids = await fourRendered("whatif");
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "What if" });
    await dissolveLesson(db, l.id);
    expect((await availableForLesson(db, c.id)).map((e) => e.id).sort()).toEqual([...ids].sort());
    const l2 = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "What if, again" });
    expect(l2.name).toBe("vol01");   // the dissolved one no longer counts
  });
});
