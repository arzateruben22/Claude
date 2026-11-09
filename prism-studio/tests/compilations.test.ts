// Long videos built and pushed from a cloud session (films/channels/<ch>/compilations/<name>/) become lessons:
// registered by folder name, refreshed when the video changes, never doubled, linked to episodes only with certainty.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, channel, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import {
  approveLesson, availableForLesson, compilationTitle, createLesson, fallbackCompilationTitle, lessonHash, markLessonUploaded,
  parseChapters, registerCompilation, titleFromDescription, type CompilationBuild,
} from "../src/domain/lessons";

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
    const again = await registerCompilation(db, c.id, "vol01", build("vol01", { description: "Something else", chapters: "" }));
    expect(again.action).toBe("unchanged");
    expect(again.lesson.updatedAt.getTime()).toBe(r.lesson.updatedAt.getTime());
    expect(again.lesson.description).toBe(r.lesson.description);   // text already there is never overwritten by the same video
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
    await expect(markLessonUploaded(db, row.id, {})).rejects.toThrow(/Approve this exact/);
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
    expect((await registerCompilation(db, c.id, "s2", build("s2"))).action).toBe("unchanged");
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
    await approveLesson(db, r.lesson.id);
    await markLessonUploaded(db, r.lesson.id, {});
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
