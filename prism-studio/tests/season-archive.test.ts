// Archived seasons (src/domain/season-archive.ts): a season is uploaded once every real episode stands on both Uploaded
// buttons and every built long video of it is marked uploaded; then it leaves every working list (derived, so an Undo
// brings it straight back), keeps counting in analytics, is never planned, and the importer never brings it back.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, freshDb, S, sql } from "./helpers";
import type { DB } from "../src/db/client";
import {
  archivedSeasonOf, inArchivedSeason, lessonOnWorkingSeason, onWorkingSeason, seasonArchive, seasonUploaded, seriesOnWorkingSeason,
} from "../src/domain/season-archive";
import { allPosted, episodeUploaded, groupUploaded, markEpisodeUploaded, undoEpisodeUploaded } from "../src/domain/publications";
import { availableForLesson, markLessonUploaded, undoLessonUploaded } from "../src/domain/lessons";
import { analyticsTotals } from "../src/domain/analytics";
import { planDays, slotsForDate } from "../src/domain/schedule";
import { clearUploadedVideos, videoClearPlan } from "../src/domain/media-cleanup";
import { archiveChannel, restoreChannel } from "../src/domain/channels";
import { createEpisode } from "../src/domain/episodes";
import { addDays, localDate } from "../src/domain/time";

// ── the rule, on plain rows ──────────────────────────────────────────────────────────────────────────────────────
const pub = (platform: string, status = "owner_reported", simulated = false) => ({ platform, status, simulated });
const all = () => [pub("youtube"), pub("tiktok"), pub("instagram")];
const ep = (pubs = all(), o: { isDemo?: boolean; state?: string } = {}) => ({ isDemo: o.isDemo ?? false, state: o.state ?? "published", pubs });
const long = (o: { state?: string; videoPath?: string; isDemo?: boolean; isTestFixture?: boolean } = {}) =>
  ({ state: o.state ?? "published", videoPath: o.videoPath ?? "films:films/channels/physics/compilations/s1/s1-16x9.mp4", isDemo: o.isDemo ?? false, isTestFixture: o.isTestFixture ?? false });

describe("the Uploaded buttons' done state (one test, shared)", () => {
  it("needs real rows, every one posted", () => {
    expect(allPosted([])).toBe(false);
    expect(allPosted([pub("youtube"), pub("tiktok", "ready")])).toBe(false);
    expect(allPosted([pub("youtube", "scheduled_on_platform"), pub("tiktok", "verified_published")])).toBe(true);
    expect(allPosted([pub("youtube", "owner_reported", true)])).toBe(false);   // simulated only
    expect(allPosted([pub("youtube"), pub("tiktok", "planned", true)])).toBe(true);   // a simulated row never counts
    expect(groupUploaded([pub("youtube"), pub("tiktok")], "youtube_tiktok")).toBe(true);
    expect(groupUploaded([pub("youtube"), pub("tiktok")], "instagram")).toBe(false);
    expect(episodeUploaded(all())).toBe(true);
    expect(episodeUploaded([pub("youtube"), pub("tiktok"), pub("instagram", "ready")])).toBe(false);
  });
});

describe("seasonUploaded", () => {
  it("is true once every real episode is uploaded on both buttons", () => {
    expect(seasonUploaded([ep(), ep()])).toBe(true);
  });
  it("is false while one episode misses a button (incomplete)", () => {
    expect(seasonUploaded([ep(), ep([pub("youtube"), pub("tiktok")])])).toBe(false);                    // no Instagram row yet
    expect(seasonUploaded([ep(), ep([pub("youtube"), pub("tiktok", "ready"), pub("instagram")])])).toBe(false);
    expect(seasonUploaded([ep(), ep([], { state: "idea" })])).toBe(false);                               // still an idea
  });
  it("is false again after an Undo (the rows go back to ready)", () => {
    expect(seasonUploaded([ep(), ep([pub("youtube"), pub("tiktok"), pub("instagram", "ready")])])).toBe(false);
  });
  it("ignores demo episodes, and cancelled or superseded ones", () => {
    expect(seasonUploaded([ep(), ep([], { isDemo: true })])).toBe(true);
    expect(seasonUploaded([ep(), ep([], { state: "cancelled" }), ep([], { state: "superseded" })])).toBe(true);
  });
  it("is never true with no real episode", () => {
    expect(seasonUploaded([])).toBe(false);
    expect(seasonUploaded([ep(all(), { isDemo: true })])).toBe(false);
    expect(seasonUploaded([ep(all(), { state: "cancelled" })])).toBe(false);
  });
  it("waits for a built long video to be marked uploaded too; unbuilt, demo and test ones don't count", () => {
    expect(seasonUploaded([ep()], [long({ state: "ready_for_review" })])).toBe(false);
    expect(seasonUploaded([ep()], [long({ state: "approved" })])).toBe(false);
    expect(seasonUploaded([ep()], [long()])).toBe(true);
    expect(seasonUploaded([ep()], [long({ state: "render", videoPath: "" })])).toBe(true);
    expect(seasonUploaded([ep()], [long({ state: "ready_for_review", isDemo: true }), long({ state: "ready_for_review", isTestFixture: true })])).toBe(true);
  });
});

// ── on the database, through the importer ────────────────────────────────────────────────────────────────────────
// physics: Season 1 is six rendered episodes (ep01-ep06), Season 2 starts with one rendered episode (ep07)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "season-archive-"));
const write = (rel: string, body: string) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  const dir = `films/channels/physics/ep${String(n).padStart(2, "0")}`;
  write(`${dir}/film.json`, JSON.stringify({ dur: 30 + n }));
  write(`${dir}/out/physics-${n}-9x16.mp4`, `master ${n}`);
}

let db: DB, end: () => Promise<void>;
let importEpisodes: (d: DB) => Promise<string[]>;
let physics: typeof S.channels.$inferSelect;
let s1: { seasonId: string; seriesId: string; eps: (typeof S.episodes.$inferSelect)[] };
let s2: { seasonId: string; seriesId: string; eps: (typeof S.episodes.$inferSelect)[] };
const archive = () => seasonArchive(db);
const both = async (id: string) => { await markEpisodeUploaded(db, id, "youtube_tiktok"); await markEpisodeUploaded(db, id, "instagram"); };

beforeAll(async () => {
  ({ db, end } = await freshDb());
  process.env.FILMS_REPO_ROOT = ROOT;   // the importer reads it when it loads
  ({ importEpisodes } = await import("../scripts/import-episodes"));
  await importEpisodes(db);
  [physics] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
  const season = async (n: number) => {
    const [row] = await db.select({ id: S.seasons.id, seriesId: S.seasons.seriesId }).from(S.seasons).innerJoin(S.series, eq(S.series.id, S.seasons.seriesId))
      .where(and(eq(S.series.channelId, physics.id), eq(S.seasons.number, n)));
    const eps = await db.select().from(S.episodes).where(eq(S.episodes.seasonId, row.id)).orderBy(S.episodes.number);
    return { seasonId: row.id, seriesId: row.seriesId, eps };
  };
  s1 = await season(1); s2 = await season(2);
});
afterAll(async () => { await end(); fs.rmSync(ROOT, { recursive: true, force: true }); });

describe("seasonArchive (derived from the publication records)", () => {
  it("archives nothing while episodes wait, and says where each season stands", async () => {
    expect(s1.eps).toHaveLength(6);
    expect(s1.eps.every((e) => e.state === "ready_for_review")).toBe(true);
    const a = await archive();
    expect(a.seasonIds.size).toBe(0);
    const st = a.seasons.find((x) => x.id === s1.seasonId)!;
    expect(st).toMatchObject({ archived: false, episodes: 6, uploaded: 0, label: "Season 1", channelId: physics.id });
  });

  it("an incomplete season stays: five episodes on both buttons, the sixth only on YouTube & TikTok", async () => {
    for (const e of s1.eps.slice(0, 5)) await both(e.id);
    await markEpisodeUploaded(db, s1.eps[5].id, "youtube_tiktok");
    const a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(false);
    expect(a.seasons.find((x) => x.id === s1.seasonId)).toMatchObject({ episodes: 6, uploaded: 5 });
  });

  it("the last Uploaded press archives it: its season, series and every episode", async () => {
    await markEpisodeUploaded(db, s1.eps[5].id, "instagram");
    const a = await archive();
    expect([...a.seasonIds]).toEqual([s1.seasonId]);
    expect([...a.seriesIds]).toEqual([s1.seriesId]);
    expect(s1.eps.every((e) => a.episodeIds.has(e.id))).toBe(true);
    expect(s2.eps.some((e) => a.episodeIds.has(e.id))).toBe(false);
    const [arch] = a.archived;
    expect(arch).toMatchObject({ id: s1.seasonId, label: "Season 1", episodes: 6, uploaded: 6 });
    expect(arch.uploadedAt).toBeInstanceOf(Date);
    expect(arch.episodeList.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(archivedSeasonOf(a, s1.eps[0])?.id).toBe(s1.seasonId);
    expect(archivedSeasonOf(a, s2.eps[0])).toBeNull();
  });

  it("Undo brings the season straight back, and pressing again archives it again", async () => {
    expect(await undoEpisodeUploaded(db, s1.eps[2].id, "instagram")).toBe(1);
    expect((await archive()).seasonIds.size).toBe(0);
    await markEpisodeUploaded(db, s1.eps[2].id, "instagram");
    expect((await archive()).seasonIds.has(s1.seasonId)).toBe(true);
  });

  it("a demo episode in the season neither blocks it nor stays behind", async () => {
    const demo = await createEpisode(db, { channelId: physics.id, title: "Demo part", isDemo: true, state: "ready_for_review", seriesId: s1.seriesId });
    await db.update(S.episodes).set({ seasonId: s1.seasonId }).where(eq(S.episodes.id, demo.id));
    const a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(true);
    expect(a.episodeIds.has(demo.id)).toBe(true);
    expect(a.archived[0].episodes).toBe(6);   // real episodes only
  });

  it("a built long video of the season must be uploaded too: its own button (no approval) archives the season at once, Undo brings it back", async () => {
    const [l] = await db.insert(S.lessons).values({ channelId: physics.id, title: "Season 1, the long cut", name: "s1", state: "ready_for_review",
      videoPath: "films:films/channels/physics/compilations/s1/s1-16x9.mp4", videoSha256: "abc" }).returning();
    await db.insert(S.lessonEpisodes).values([{ lessonId: l.id, episodeId: s1.eps[0].id, position: 1 }, { lessonId: l.id, episodeId: s1.eps[1].id, position: 2 }]);
    const [unbuilt] = await db.insert(S.lessons).values({ channelId: physics.id, title: "Not built", name: "vol09", state: "render" }).returning();
    await db.insert(S.lessonEpisodes).values({ lessonId: unbuilt.id, episodeId: s1.eps[2].id, position: 1 });
    let a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(false);
    expect(a.seasons.find((x) => x.id === s1.seasonId)!.longVideosLeft).toEqual([{ id: l.id, name: "s1", title: "Season 1, the long cut" }]);
    // "Uploaded on YouTube" on the long video, never approved: the last button, so the season archives at once
    expect(l.approvedHash).toBe("");
    expect(await markLessonUploaded(db, l.id)).toBe("marked");
    a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(true);
    expect(a.archived[0].lessonList.find((x) => x.id === l.id)).toMatchObject({ state: "published" });
    // its Undo brings the season back, with the long video as what is left; pressing again archives it again
    expect(await undoLessonUploaded(db, l.id)).toBe(true);
    a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(false);
    expect(a.seasons.find((x) => x.id === s1.seasonId)).toMatchObject({ uploaded: 6, longVideosLeft: [{ id: l.id, name: "s1", title: "Season 1, the long cut" }] });
    expect(await markLessonUploaded(db, l.id)).toBe("marked");
    a = await archive();
    expect(a.seasonIds.has(s1.seasonId)).toBe(true);
    expect(a.lessonIds.has(l.id) && a.lessonIds.has(unbuilt.id)).toBe(true);   // both go with their season
    expect(a.archived[0].lessonList.map((x) => x.name).sort()).toEqual(["s1", "vol09"]);
  });

  it("an archived channel's seasons aren't listed at all", async () => {
    await archiveChannel(db, physics.id);
    expect((await archive()).seasons.some((x) => x.channelId === physics.id)).toBe(false);
    await restoreChannel(db, physics.id);
    expect((await archive()).seasonIds.has(s1.seasonId)).toBe(true);
  });
});

describe("the screens' list helpers leave an archived season out", () => {
  it("episodes (Review, Home counts, the channel's lists, Library): its episodes go; other seasons and season-less ones stay", async () => {
    const loose = await createEpisode(db, { channelId: physics.id, title: "No season", state: "ready_for_review" });
    const a = await archive();
    const rows = await db.select({ id: S.episodes.id }).from(S.episodes).where(and(eq(S.episodes.channelId, physics.id), onWorkingSeason(a, S.episodes.seasonId)));
    const ids = rows.map((r) => r.id);
    expect(s1.eps.some((e) => ids.includes(e.id))).toBe(false);
    expect(s2.eps.every((e) => ids.includes(e.id))).toBe(true);
    expect(ids).toContain(loose.id);
    expect(inArchivedSeason(a, s1.eps[0])).toBe(true);
    expect(inArchivedSeason(a, loose)).toBe(false);
    // the raw-SQL form the reports use
    const raw = await db.execute(sql`select count(*)::int as n from episodes e where e.channel_id = ${physics.id} and ${onWorkingSeason(a, sql`e.season_id`)}`);
    expect((raw.rows[0] as { n: number }).n).toBe(ids.length);
  });

  it("posts (Upload, Calendar, the /m queue): none of its publications are listed", async () => {
    const a = await archive();
    const listed = await db.select({ episodeId: S.publications.episodeId }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
      .where(and(eq(S.episodes.channelId, physics.id), onWorkingSeason(a, S.episodes.seasonId)));
    expect(listed.some((r) => a.episodeIds.has(r.episodeId))).toBe(false);
    expect(listed.some((r) => r.episodeId === s2.eps[0].id)).toBe(true);
  });

  it("long videos and seasons (the channel's Lessons and Series, the long-video lists)", async () => {
    const [free] = await db.insert(S.lessons).values({ channelId: physics.id, title: "Unlinked long video", name: "vol05", state: "ready_for_review", videoPath: "films:x-16x9.mp4" }).returning();
    const a = await archive();
    const ls = (await db.select({ id: S.lessons.id }).from(S.lessons).where(and(eq(S.lessons.channelId, physics.id), lessonOnWorkingSeason(a, S.lessons.id)))).map((r) => r.id);
    expect(ls).toContain(free.id);
    expect(ls.some((id) => a.lessonIds.has(id))).toBe(false);
    const ser = (await db.select({ id: S.series.id }).from(S.series).where(and(eq(S.series.channelId, physics.id), seriesOnWorkingSeason(a, S.series.id)))).map((r) => r.id);
    expect(ser).toEqual([s2.seriesId]);
  });

  it("the new-lesson picker offers no archived episode", async () => {
    const avail = (await availableForLesson(db, physics.id)).map((e) => e.id);
    expect(avail).toContain(s2.eps[0].id);   // ep07, rendered, Season 2
    expect(s1.eps.some((e) => avail.includes(e.id))).toBe(false);
  });
});

describe("archived seasons keep counting", () => {
  it("analytics totals still include every post of an archived season", async () => {
    const r = await db.execute(sql`select count(*)::int as n from publications p join episodes e on e.id = p.episode_id
      where p.status in ('owner_reported','scheduled_on_platform','verified_published') and not p.simulated and not e.is_demo`);
    const posted = (r.rows[0] as { n: number }).n;
    expect(posted).toBe(18);   // six episodes × YouTube, TikTok, Instagram
    expect((await analyticsTotals(db)).posts).toBe(posted);
  });
});

describe("nothing automatic touches an archived season", () => {
  it("planning never places its posts, and a later slot one of them still holds counts as free", async () => {
    const tz = "America/Los_Angeles", tomorrow = addDays(localDate(new Date(), tz), 1);
    const slot = (await slotsForDate(db, tomorrow)).find((x) => x.channelId === physics.id && x.platform === "youtube")!;
    const [yt] = await db.select().from(S.destinations).where(and(eq(S.destinations.channelId, physics.id), eq(S.destinations.platform, "youtube")));
    // Season 1's first episode was posted ahead of its slot: the row still holds tomorrow's YouTube slot
    await db.update(S.publications).set({ scheduledFor: slot.at }).where(and(eq(S.publications.episodeId, s1.eps[0].id), eq(S.publications.destinationId, yt.id)));
    const before = await db.select().from(S.publications).where(sql`${S.publications.episodeId} in ${s1.eps.map((e) => e.id)}`);
    await planDays(db, tomorrow, 1);
    const after = await db.select().from(S.publications).where(sql`${S.publications.episodeId} in ${s1.eps.map((e) => e.id)}`);
    const key = (p: typeof before[number]) => [p.id, p.status, p.scheduledFor?.toISOString() ?? null].join("|");
    expect(after.map(key).sort()).toEqual(before.map(key).sort());   // untouched, nothing new
    // the slot went to Season 2's episode instead
    const [s2yt] = await db.select().from(S.publications).where(and(eq(S.publications.episodeId, s2.eps[0].id), eq(S.publications.destinationId, yt.id)));
    expect(+s2yt.scheduledFor!).toBe(+slot.at);
  });

  it("the importer never brings it back: a re-render of an archived episode leaves its render and posts as they are", async () => {
    const snap = async () => {
      const vers = await db.select().from(S.versions).where(eq(S.versions.episodeId, s1.eps[0].id));
      const pubs = await db.select().from(S.publications).where(eq(S.publications.episodeId, s1.eps[0].id));
      return { vers: vers.map((v) => [v.id, v.sha256, v.superseded]), pubs: pubs.map((p) => [p.id, p.status, p.exportId]).sort() };
    };
    const before = await snap();
    write("films/channels/physics/ep01/out/physics-1-9x16.mp4", "a new master");
    const report = await importEpisodes(db);
    expect(report).toContain("physics ep1: season uploaded and archived (records kept)");
    expect(await snap()).toEqual(before);
    expect((await archive()).seasonIds.has(s1.seasonId)).toBe(true);
    // Season 2 imports as usual
    expect(report.find((l) => l.startsWith("physics ep7:"))).toMatch(/version 1/);
  });

  it("video clearing keeps working for an archived season's episodes", async () => {
    const later = new Date(Date.now() + 4 * 24 * 3_600_000);
    const plan = await videoClearPlan(db, ROOT, later);
    expect(s1.eps.every((e) => plan.some((p) => p.episodeId === e.id))).toBe(true);
    const r = await clearUploadedVideos(db, ROOT, later);
    expect(r.episodes).toBe(6);
    expect(fs.existsSync(path.join(ROOT, "films/channels/physics/ep01/out/physics-1-9x16.mp4"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "films/channels/physics/ep07/out/physics-7-9x16.mp4"))).toBe(true);
    expect((await archive()).seasonIds.has(s1.seasonId)).toBe(true);   // clearing never changes the season
  });

  it("an Undo after all that still brings the season back to the working lists", async () => {
    await undoEpisodeUploaded(db, s1.eps[1].id, "youtube_tiktok");
    const a = await archive();
    expect(a.seasonIds.size).toBe(0);
    const ids = (await db.select({ id: S.episodes.id }).from(S.episodes).where(and(eq(S.episodes.channelId, physics.id), onWorkingSeason(a, S.episodes.seasonId)))).map((r) => r.id);
    expect(s1.eps.every((e) => ids.includes(e.id))).toBe(true);
  });
});
