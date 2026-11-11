// Long videos built and pushed from a cloud session (films/channels/<ch>/compilations/<name>/) become lessons:
// registered by folder name, refreshed when the video changes, never doubled, linked to episodes only with certainty.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, channel, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import {
  approveLesson, availableForLesson, compilationTitle, createLesson, editLesson, fallbackCompilationTitle, lessonHash, markLessonUploaded,
  parseChapters, registerCompilation, titleFromDescription, type CompilationBuild,
} from "../src/domain/lessons";
import { markEpisodeUploaded } from "../src/domain/publications";
import { seasonArchive } from "../src/domain/season-archive";
import { sha256 } from "../src/domain/core";

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "compilations-"));
const put = (rel: string, body: string | Buffer) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
};

let db: DB, end: () => Promise<void>;
let importEpisodes: (d: DB) => Promise<string[]>;
beforeAll(async () => {
  ({ db, end } = await freshDb());
  process.env.FILMS_REPO_ROOT = ROOT;   // the importer reads it when it loads
  ({ importEpisodes } = await import("../scripts/import-episodes"));
});
afterAll(() => end());

const build = (name: string, o: Partial<CompilationBuild> = {}): CompilationBuild => ({
  videoPath: `films:films/channels/physics/compilations/${name}/${name}-16x9.mp4`, videoSha256: "a".repeat(64),
  thumbnailPath: `films:films/channels/physics/compilations/${name}/thumbnail.jpg`, chapters: "0:00 One\n1:10 Two\n", description: "Forces you can see\n\nSources…", qa: { fails: [], dur: 366 }, ...o,
});
const lessonsOf = (channelId: string) => db.select().from(S.lessons).where(eq(S.lessons.channelId, channelId));
const audits = (id: string) => db.select().from(S.auditLog).where(and(eq(S.auditLog.entityId, id), eq(S.auditLog.action, "lesson.register")));

describe("compilation titles and chapters", () => {
  it("takes the description's first line or heading, else a fallback from the folder name", () => {
    expect(titleFromDescription("Forces you can see\n\nEveryday things…")).toBe("Forces you can see");
    expect(titleFromDescription("\n# Season 2: What your *skin* does\n\nChapters")).toBe("Season 2: What your skin does");
    expect(titleFromDescription("**Bold title**")).toBe("Bold title");
    expect(titleFromDescription("")).toBeNull();
    expect(titleFromDescription("0:00 Why goosebumps happen")).toBeNull();
    expect(titleFromDescription("Chapters\n0:00 x")).toBeNull();
    expect(titleFromDescription("x".repeat(101))).toBeNull();
    expect(fallbackCompilationTitle("s2", "Skin Sense")).toBe("Skin Sense · Season 2");
    expect(fallbackCompilationTitle("vol02", "Skin Sense")).toBe("Skin Sense · Volume 2");
    expect(fallbackCompilationTitle("season-3", "Body Backstage (name TBD)")).toBe("Body Backstage · Season 3");
    expect(fallbackCompilationTitle("bonus", "Skin Sense")).toBe("Skin Sense · bonus");
    expect(compilationTitle("s2", "", "Skin Sense")).toBe("Skin Sense · Season 2");
    expect(compilationTitle("s2", "What your skin does\n", "Skin Sense")).toBe("What your skin does");
  });
  it("reads YouTube chapters", () => {
    expect(parseChapters("0:00 Thrown or dropped?\n1:18 The swing's secret\nnot a chapter\n1:02:03 Long one\n")).toEqual([
      { at: 0, title: "Thrown or dropped?" }, { at: 78, title: "The swing's secret" }, { at: 3723, title: "Long one" },
    ]);
  });
});

describe("registerCompilation", () => {
  it("adds a new one as a built lesson, then is a no-op while the video is the same", async () => {
    const { c } = await channel(db, "physics");
    const r = await registerCompilation(db, c.id, "vol01", build("vol01"));
    expect(r.action).toBe("created");
    expect(r.lesson).toMatchObject({ name: "vol01", title: "Forces you can see", state: "ready_for_review", approvedHash: "", videoSha256: "a".repeat(64) });
    expect(r.lesson.videoPath).toBe("films:films/channels/physics/compilations/vol01/vol01-16x9.mp4");
    expect(r.lesson.outline.map((o) => o.part)).toEqual(["One", "Two"]);
    expect(await audits(r.lesson.id)).toHaveLength(1);
    const again = await registerCompilation(db, c.id, "vol01", build("vol01"));
    expect(again.action).toBe("unchanged");
    expect(again.lesson.updatedAt.getTime()).toBe(r.lesson.updatedAt.getTime());
    // a missing file never clears what is stored
    const missing = await registerCompilation(db, c.id, "vol01", build("vol01", { description: "", chapters: "", thumbnailPath: "", qa: {} }));
    expect(missing.action).toBe("unchanged");
    expect(missing.lesson).toMatchObject({ description: r.lesson.description, chapters: r.lesson.chapters, thumbnailPath: r.lesson.thumbnailPath });
    expect(await lessonsOf(c.id)).toHaveLength(1);
    expect(await audits(r.lesson.id)).toHaveLength(1);
  });

  it("a new video replaces the build and withdraws the approval, as a rebuild does; the owner's title stays", async () => {
    const { c } = await channel(db, "physics");
    const r = await registerCompilation(db, c.id, "vol02", build("vol02"));
    await db.update(S.lessons).set({ title: "Owner's own title" }).where(eq(S.lessons.id, r.lesson.id));
    await approveLesson(db, r.lesson.id);
    let [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, r.lesson.id));
    expect(row.state).toBe("approved");
    expect(row.approvedHash).toBe(lessonHash(row));
    const u = await registerCompilation(db, c.id, "vol02", build("vol02", { videoSha256: "b".repeat(64), thumbnailPath: "", chapters: "0:00 New", description: "New title\n\nNew text", qa: { fails: ["loudness"] } }));
    expect(u.action).toBe("updated");
    [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, r.lesson.id));
    expect(row).toMatchObject({ state: "ready_for_review", approvedHash: "", videoSha256: "b".repeat(64), thumbnailPath: "", chapters: "0:00 New", description: "New title\n\nNew text", title: "Owner's own title" });
    expect(row.qa).toEqual({ fails: ["loudness"] });
    const log = await audits(r.lesson.id);
    expect(log).toHaveLength(2);
    expect(log.find((a) => (a.detail as { approvalWithdrawn?: boolean }).approvalWithdrawn)).toBeTruthy();
    expect(await lessonsOf(c.id)).toHaveLength(2);
  });

  it("fills in what was missing (a thumbnail or description pushed later) without touching the rest", async () => {
    const { c } = await channel(db, "space");
    const r = await registerCompilation(db, c.id, "s2", build("s2", { thumbnailPath: "", description: "", chapters: "", qa: {} }));
    expect(r.lesson.title).toBe("One More Orbit · Season 2");
    const f = await registerCompilation(db, c.id, "s2", build("s2", { description: "Bigger than it looks\n\nSources" }));
    expect(f.action).toBe("filled");
    expect(f.lesson).toMatchObject({ title: "Bigger than it looks", description: "Bigger than it looks\n\nSources", chapters: "0:00 One\n1:10 Two\n" });
    expect(f.lesson.thumbnailPath).toMatch(/^films:.*thumbnail\.jpg$/);
    expect(f.lesson.qa).toEqual({ fails: [], dur: 366 });
    expect((await registerCompilation(db, c.id, "s2", build("s2", { description: "Bigger than it looks\n\nSources" }))).action).toBe("unchanged");
  });

  it("the same video: a corrected chapters.txt or description.md is picked up; the owner's edited description is kept", async () => {
    const { c } = await channel(db, "physics");
    const r = await registerCompilation(db, c.id, "s3", build("s3", { chapters: "0:00 One\n1:10 Two\n", description: "Season 3 film\n\nOld text" }));
    await approveLesson(db, r.lesson.id);
    const fixed = await registerCompilation(db, c.id, "s3", build("s3", { chapters: "0:00 Uno\n1:10 Dos\n", description: "Season 3 film\n\nCorrected text" }));
    expect(fixed.action).toBe("refreshed");
    expect(fixed.lesson).toMatchObject({ chapters: "0:00 Uno\n1:10 Dos\n", description: "Season 3 film\n\nCorrected text", title: "Season 3 film", approvedHash: "", state: "ready_for_review" });
    expect(fixed.lesson.outline.map((o) => o.part)).toEqual(["Uno", "Dos"]);
    // nobody chose the title (it is the description's title line), so it follows a new title line
    const retitled = await registerCompilation(db, c.id, "s3", build("s3", { chapters: "0:00 Uno\n1:10 Dos\n", description: "Better title\n\nCorrected text" }));
    expect(retitled.lesson.title).toBe("Better title");
    // the owner edits the description in Prism: a later file change leaves their text (and their title) alone, and says so once
    await editLesson(db, r.lesson.id, { title: "Owner's title", description: "Owner's words" });
    const kept = await registerCompilation(db, c.id, "s3", build("s3", { chapters: "0:00 Uno\n1:10 Dos\n", description: "Third title\n\nThird text" }));
    expect(kept.action).toBe("unchanged");
    expect(kept.notes).toEqual(["description.md changed, but the description was edited in Prism: kept the edited text"]);
    expect(kept.lesson).toMatchObject({ title: "Owner's title", description: "Owner's words" });
    const quiet = await registerCompilation(db, c.id, "s3", build("s3", { chapters: "0:00 Uno\n1:10 Dos\n", description: "Third title\n\nThird text" }));
    expect(quiet).toMatchObject({ action: "unchanged", notes: [] });
  });

  it("a lesson from before the description record: its text counts as edited unless the file still matches it", async () => {
    const { c } = await channel(db, "space");
    const a = await registerCompilation(db, c.id, "old-a", build("old-a", { description: "Old A\n\nText" }));
    const b = await registerCompilation(db, c.id, "old-b", build("old-b", { description: "Old B\n\nText" }));
    await db.update(S.lessons).set({ importedDescriptionSha: "" }).where(eq(S.lessons.channelId, c.id));
    // a: the stored text differs from the file (an edit or an old file: unknown), so it is kept
    const ka = await registerCompilation(db, c.id, "old-a", build("old-a", { description: "Old A\n\nNew text" }));
    expect(ka.lesson.description).toBe("Old A\n\nText");
    expect(ka.notes).toHaveLength(1);
    // b: the file still matches, so this import records it, and the next corrected file is picked up
    const same = await registerCompilation(db, c.id, "old-b", build("old-b", { description: "Old B\n\nText" }));
    expect(same.action).toBe("unchanged");
    expect(same.lesson.importedDescriptionSha).toBe(sha256("Old B\n\nText"));
    const fixed = await registerCompilation(db, c.id, "old-b", build("old-b", { description: "Old B\n\nFixed" }));
    expect(fixed).toMatchObject({ action: "refreshed", lesson: { description: "Old B\n\nFixed" } });
    expect(a.lesson.id).not.toBe(b.lesson.id);
  });

  it("the same video, no parts linked yet: tries again once the parts exist or the chapters are corrected", async () => {
    const { c } = await channel(db, "space");
    const film = build("s3", { chapters: "0:00 The Moon starts coming closer\n1:05 One quarter closer\n", description: "How close can the Moon get?\n" });
    const first = await registerCompilation(db, c.id, "s3", film);
    expect(first.linked).toBe(0);   // the parts aren't imported yet
    const p1 = (await renderedEpisode(db, "space", { title: "The Moon starts coming closer" })).ep;
    const p2 = (await renderedEpisode(db, "space", { title: "One quarter closer" })).ep;
    const retry = await registerCompilation(db, c.id, "s3", film);
    expect(retry).toMatchObject({ action: "refreshed", linked: 2 });
    const links = await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, first.lesson.id));
    expect(links.sort((x, y) => x.position - y.position).map((x) => x.episodeId)).toEqual([p1.id, p2.id]);
    expect(retry.lesson.outline).toEqual([{ part: "The Moon starts coming closer", episodeId: p1.id }, { part: "One quarter closer", episodeId: p2.id }]);
    expect((await registerCompilation(db, c.id, "s3", film)).action).toBe("unchanged");   // linked: nothing more to do

    // a chapters.txt line that didn't match a part's title, corrected later
    const q1 = (await renderedEpisode(db, "space", { title: "Half the distance" })).ep;
    const q2 = (await renderedEpisode(db, "space", { title: "Too bright" })).ep;
    const wrong = await registerCompilation(db, c.id, "s4", build("s4", { chapters: "0:00 Half the distance\n1:00 Far too bright\n" }));
    expect(wrong.linked).toBe(0);
    const right = await registerCompilation(db, c.id, "s4", build("s4", { chapters: "0:00 Half the distance\n1:00 Too bright\n" }));
    expect(right).toMatchObject({ action: "refreshed", linked: 2 });
    expect((await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, right.lesson.id))).map((x) => x.episodeId).sort()).toEqual([q1.id, q2.id].sort());
  });

  it("reuses a lesson the owner created under the same name: no duplicate, its episodes and title kept, its pending build cancelled", async () => {
    const { c } = await channel(db, "body");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const e = await renderedEpisode(db, "body", { title: `Part ${i + 1}` });
      await db.update(S.episodes).set({ filmsPath: `films/channels/body/ep0${i + 1}` }).where(eq(S.episodes.id, e.ep.id));
      ids.push(e.ep.id);
    }
    const l = await createLesson(db, { channelId: c.id, episodeIds: ids, title: "The traffic inside you" });
    expect(l.name).toBe("vol01");
    const r = await registerCompilation(db, c.id, "vol01", build("vol01", { description: "Another title\n" }));
    expect(r.action).toBe("updated");
    expect(r.lesson.id).toBe(l.id);
    expect(r.lesson).toMatchObject({ title: "The traffic inside you", state: "ready_for_review" });
    expect(await lessonsOf(c.id)).toHaveLength(1);
    expect(await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, l.id))).toHaveLength(4);
    const [job] = await db.select().from(S.jobs).where(eq(S.jobs.type, "build_lesson"));
    expect(job.status).toBe("cancelled");
    // and the owner's next lesson never takes a name a pushed compilation holds
    await registerCompilation(db, c.id, "vol03", build("vol03"));
    const more: string[] = [];
    for (let i = 0; i < 4; i++) more.push((await renderedEpisode(db, "body", { title: `More ${i + 1}` })).ep.id);
    for (const [i, id] of more.entries()) await db.update(S.episodes).set({ filmsPath: `films/channels/body/ep1${i}` }).where(eq(S.episodes.id, id));
    expect((await createLesson(db, { channelId: c.id, episodeIds: more, title: "Next one" })).name).toBe("vol04");
  });

  it("links episodes only when every chapter names exactly one free episode of the channel", async () => {
    const { c } = await channel(db, "whatif");
    const a = (await renderedEpisode(db, "whatif", { title: "Through the Earth" })).ep;
    const b = (await renderedEpisode(db, "whatif", { title: "All the ants" })).ep;
    await renderedEpisode(db, "whatif", { title: "Twice" });
    await renderedEpisode(db, "whatif", { title: "Twice" });
    const ambiguous = await registerCompilation(db, c.id, "vol09", build("vol09", { chapters: "0:00 Through the Earth\n1:00 Twice\n" }));
    expect(ambiguous.linked).toBe(0);
    const unknown = await registerCompilation(db, c.id, "vol08", build("vol08", { chapters: "0:00 Through the Earth\n1:00 Not an episode\n" }));
    expect(unknown.linked).toBe(0);
    const ok = await registerCompilation(db, c.id, "s2", build("s2", { chapters: "0:00 through  the earth\n1:12 All the *ants*\n" }));
    expect(ok.linked).toBe(2);
    const links = await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, ok.lesson.id));
    expect(links.sort((x, y) => x.position - y.position).map((x) => x.episodeId)).toEqual([a.id, b.id]);
    expect((await availableForLesson(db, c.id)).map((e) => e.id)).not.toContain(a.id);
    // already in a lesson: another compilation naming them stays unlinked (episode_id is unique), and isn't refused
    const taken = await registerCompilation(db, c.id, "vol07", build("vol07", { chapters: "0:00 Through the Earth\n1:12 All the ants\n" }));
    expect(taken).toMatchObject({ action: "created", linked: 0 });
  });

  it("leaves an uploaded lesson as it is, and ignores demo lessons of the same name", async () => {
    const { c } = await channel(db, "skincare");
    await db.insert(S.lessons).values({ channelId: c.id, name: "vol01", title: "Demo", isDemo: true });
    const r = await registerCompilation(db, c.id, "vol01", build("vol01"));
    expect(r.lesson.isDemo).toBe(false);
    await markLessonUploaded(db, r.lesson.id, {});   // no approval needed
    const p = await registerCompilation(db, c.id, "vol01", build("vol01", { videoSha256: "c".repeat(64) }));
    expect(p.action).toBe("published");
    const [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, r.lesson.id));
    expect(row).toMatchObject({ state: "published", videoSha256: "a".repeat(64) });
  });

  it("refuses anything but a folder name and films: keys", async () => {
    const { c } = await channel(db, "physics");
    await expect(registerCompilation(db, c.id, "../x", build("x"))).rejects.toThrow(/folder name/);
    await expect(registerCompilation(db, c.id, "vol05", build("vol05", { videoPath: "/etc/passwd" }))).rejects.toThrow(/films:/);
  });

  it("a retry never links an uploaded (archived) season's episodes, so the season stays archived", async () => {
    const { c } = await channel(db, "body");
    const [se] = await db.insert(S.series).values({ channelId: c.id, title: "Season 9: Done and uploaded", status: "active" }).returning();
    const [sn] = await db.insert(S.seasons).values({ seriesId: se.id, number: 9, title: "Season 9" }).returning();
    const done: string[] = [];
    for (const title of ["Done one", "Done two"]) {
      const e = (await renderedEpisode(db, "body", { title })).ep;
      await db.update(S.episodes).set({ seasonId: sn.id, seriesId: se.id }).where(eq(S.episodes.id, e.id));
      await markEpisodeUploaded(db, e.id, "youtube_tiktok");
      await markEpisodeUploaded(db, e.id, "instagram");
      done.push(e.id);
    }
    expect((await seasonArchive(db)).seasonIds.has(sn.id)).toBe(true);
    const r = await registerCompilation(db, c.id, "s9", build("s9", { chapters: "0:00 Done one\n1:00 Done 2\n" }));
    expect(r.linked).toBe(0);
    const again = await registerCompilation(db, c.id, "s9", build("s9", { chapters: "0:00 Done one\n1:00 Done two\n" }));
    expect(again).toMatchObject({ action: "refreshed", linked: 0 });
    expect(await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, r.lesson.id))).toHaveLength(0);
    expect((await seasonArchive(db)).seasonIds.has(sn.id)).toBe(true);
  });
});

describe("importing pushed compilations", () => {
  it("registers each compilations/* folder with a *-16x9.mp4, survives missing files, and is idempotent", async () => {
    const { c } = await channel(db, "skincare");
    // Season 2's episode folders exist, so the importer makes its six episodes (titles from the slate)
    for (let n = 7; n <= 12; n++) fs.mkdirSync(path.join(ROOT, `films/channels/skincare/ep${String(n).padStart(2, "0")}`), { recursive: true });
    const s2 = "films/channels/skincare/compilations/s2";
    put(`${s2}/s2-16x9.mp4`, "season two video");
    put(`${s2}/thumbnail.jpg`, "jpg");
    put(`${s2}/chapters.txt`, "0:00 Why goosebumps happen\n1:10 Why fingers wrinkle in water\n2:20 How sweat cools you\n3:30 What a tan really is\n4:40 The brick wall on your skin\n5:50 Fingerprints before birth\n");
    put(`${s2}/description.md`, "What your skin does\n\nSee what your skin does on its own.\n");
    put(`${s2}/qa.json`, JSON.stringify({ dur: 420, fails: [] }));
    put("films/channels/skincare/compilations/vol02/vol02-16x9.mp4", "volume two video");     // the video alone
    put("films/channels/skincare/compilations/vol02/qa.json", "{ not json");
    put("films/channels/skincare/compilations/vol02/vol02-16x9.mp4.0123456789ab.part", "half");
    put("films/channels/skincare/compilations/notes/readme.txt", "no video here");
    put("films/channels/physics/compilations/vol01/vol01-16x9.mp4", "physics video");

    const first = await importEpisodes(db);
    expect(first).toContain('skincare compilations/s2: created "What your skin does", 6 episodes linked');
    expect(first).toContain('skincare compilations/vol02: created "Skin Sense · Volume 2"');
    expect(first).toContain("skincare compilations/notes: no *-16x9.mp4 yet");
    const mine = (await lessonsOf(c.id)).filter((l) => !l.isDemo);
    const s2l = mine.find((l) => l.name === "s2")!, v2 = mine.find((l) => l.name === "vol02")!;
    expect(s2l).toMatchObject({ state: "ready_for_review", videoPath: `films:${s2}/s2-16x9.mp4`, thumbnailPath: `films:${s2}/thumbnail.jpg`, description: "What your skin does\n\nSee what your skin does on its own.\n" });
    expect(s2l.chapters).toMatch(/^0:00 Why goosebumps happen/);
    expect(s2l.qa).toEqual({ dur: 420, fails: [] });
    const [season2] = await db.select().from(S.series).where(and(eq(S.series.channelId, c.id), eq(S.series.title, "Season 2: What your skin does")));
    expect(s2l.seriesId).toBe(season2.id);
    expect(v2).toMatchObject({ videoPath: "films:films/channels/skincare/compilations/vol02/vol02-16x9.mp4", thumbnailPath: "", chapters: "", description: "", qa: {} });

    const again = await importEpisodes(db);
    expect(again.filter((l) => l.includes("compilations/"))).toEqual(expect.arrayContaining([
      'skincare compilations/s2: unchanged "What your skin does"', 'skincare compilations/vol02: unchanged "Skin Sense · Volume 2"',
    ]));
    expect((await lessonsOf(c.id)).filter((l) => !l.isDemo)).toHaveLength(mine.length);
    expect(await db.select().from(S.lessonEpisodes).where(eq(S.lessonEpisodes.lessonId, s2l.id))).toHaveLength(6);

    // a rebuilt s2 pushed later: refreshed in place
    put(`${s2}/s2-16x9.mp4`, "season two video, rebuilt");
    const third = await importEpisodes(db);
    expect(third).toContain('skincare compilations/s2: updated "What your skin does"');
    const [row] = await db.select().from(S.lessons).where(eq(S.lessons.id, s2l.id));
    expect(row.videoSha256).not.toBe(s2l.videoSha256);
  });
});
