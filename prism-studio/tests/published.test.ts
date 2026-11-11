// Published (src/domain/published.ts): an episode moves from the Episodes tab to Published once YouTube, TikTok and
// Instagram are all marked uploaded, or 24 hours after the first Uploaded press (worked out at read time from the report
// times, so an Undo brings it back); a long video 24 hours after its "Uploaded on YouTube" press. And the season numbers
// shown with them: "S3 · E1" ahead of "No. 013", "S3" (or "Vol 1") for a long video.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, freshDb, renderedEpisode, S } from "./helpers";
import type { DB } from "../src/db/client";
import {
  episodePublished, episodePublishedState, episodeSeason, lessonPublished, lessonPublishedState, lessonSeason, lessonSeasons, loadSeasonIndex, longVideoLabel,
  oneSeason, PUBLISHED_AFTER_MS, publishedPubs, seasonFromTitle, seasonIndexFrom, seasonTag,
} from "../src/domain/published";
import { markEpisodeUploaded, undoEpisodeUploaded } from "../src/domain/publications";
import { markLessonUploaded, undoLessonUploaded } from "../src/domain/lessons";

// the importer reads FILMS_REPO_ROOT when it loads: point it at this file's own folder first
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "published-"));
process.env.FILMS_REPO_ROOT = ROOT;
const { importEpisodes, slateForEpisode } = await import("../scripts/import-episodes");

const NOW = new Date("2026-11-11T20:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const pub = (platform: string, at: Date | null = hoursAgo(1), status = "owner_reported", simulated = false) => ({ platform, status, simulated, reportedAt: at });

// ── the rule, on plain rows ──────────────────────────────────────────────────────────────────────────────────────
describe("an episode is published", () => {
  it("once all three platforms are marked uploaded, right away", () => {
    const st = episodePublishedState([pub("youtube", hoursAgo(0.1)), pub("tiktok", hoursAgo(0.1)), pub("instagram", hoursAgo(0.05))], NOW);
    expect(st).toMatchObject({ done: true, why: "all_three" });
    expect(st.firstAt).toEqual(hoursAgo(0.1));
    expect(st.platforms.map((p) => [p.platform, p.uploaded])).toEqual([["youtube", true], ["tiktok", true], ["instagram", true]]);
  });

  it("24 hours after the first mark, even with a platform missing: one marked 25 h ago is done", () => {
    const st = episodePublishedState([pub("youtube", hoursAgo(25)), pub("tiktok", null, "ready"), pub("instagram", null, "planned")], NOW);
    expect(st).toMatchObject({ done: true, why: "day_passed" });
    expect(st.platforms.map((p) => p.uploaded)).toEqual([true, false, false]);
  });

  it("not while the first mark is under 24 hours old: one marked 2 h ago stays in Episodes", () => {
    expect(episodePublishedState([pub("youtube", hoursAgo(2)), pub("tiktok", hoursAgo(2)), pub("instagram", null, "ready")], NOW)).toMatchObject({ done: false, why: null });
    expect(episodePublished([pub("youtube", hoursAgo(2))], NOW)).toBe(false);
  });

  it("never with nothing marked", () => {
    expect(episodePublishedState([], NOW)).toMatchObject({ done: false, firstAt: null });
    expect(episodePublished([pub("youtube", null, "planned"), pub("tiktok", null, "ready"), pub("instagram", null, "handed_off")], NOW)).toBe(false);
  });

  it("counts the clock from the first mark, not the latest one", () => {
    expect(episodePublished([pub("youtube", hoursAgo(24)), pub("tiktok", hoursAgo(24)), pub("instagram", null, "ready")], NOW)).toBe(true);   // exactly 24 h
    expect(episodePublished([pub("youtube", hoursAgo(23.9)), pub("tiktok", hoursAgo(23.9))], NOW)).toBe(false);
    expect(episodePublished([pub("youtube", hoursAgo(30)), pub("instagram", hoursAgo(1))], NOW)).toBe(true);
  });

  it("takes every posted status, and a verification's time when no report time is recorded", () => {
    expect(episodePublished([pub("youtube", hoursAgo(1), "verified_published"), pub("tiktok", hoursAgo(1), "scheduled_on_platform"), pub("instagram")], NOW)).toBe(true);
    expect(episodePublished([{ platform: "youtube", status: "verified_published", reportedAt: null, verifiedAt: hoursAgo(26) }], NOW)).toBe(true);
  });

  it("never counts a simulated (demo) row", () => {
    expect(episodePublished([pub("youtube", hoursAgo(1), "owner_reported", true), pub("tiktok"), pub("instagram")], NOW)).toBe(false);
    expect(episodePublished([pub("youtube", hoursAgo(48), "verified_published", true)], NOW)).toBe(false);
  });

  it("a posted row with no time counts toward all three but never starts the clock (never guess a time)", () => {
    expect(episodePublished([pub("youtube", null)], NOW)).toBe(false);
    expect(episodePublished([pub("youtube", null), pub("tiktok", null), pub("instagram", null)], NOW)).toBe(true);
  });

  it("is back in Episodes after an Undo (the rows go back to ready with no report time)", () => {
    expect(episodePublished([pub("youtube", null, "ready"), pub("tiktok", null, "ready")], NOW)).toBe(false);
  });
});

describe("a long video is published", () => {
  it("24 hours after its Uploaded on YouTube press (until then it stays on Home with its Undo)", () => {
    expect(lessonPublishedState({ state: "published", reportedAt: hoursAgo(2) }, NOW)).toEqual({ uploaded: true, done: false, at: hoursAgo(2) });
    expect(lessonPublished({ state: "published", reportedAt: hoursAgo(25) }, NOW)).toBe(true);
    expect(lessonPublished({ state: "published", reportedAt: hoursAgo(24) }, NOW)).toBe(true);
  });
  it("never while it is not marked uploaded (or after an Undo)", () => {
    expect(lessonPublished({ state: "ready_for_review", reportedAt: null }, NOW)).toBe(false);
    expect(lessonPublished({ state: "approved", reportedAt: hoursAgo(48) }, NOW)).toBe(false);
  });
  it("one marked before report times were kept has been up longer than a day", () => {
    expect(lessonPublished({ state: "published", reportedAt: null }, NOW)).toBe(true);
  });
});

// ── season numbers ───────────────────────────────────────────────────────────────────────────────────────────────
describe("season and episode-in-season", () => {
  const idx = seasonIndexFrom([
    { seriesId: "ser1", seriesTitle: "Season 1: Under the surface", seasonId: "sea1", number: 1 },
    { seriesId: "ser2", seriesTitle: "Season 2: What your skin does", seasonId: "sea2", number: 2 },
    { seriesId: "ser3", seriesTitle: "Season 3: Inside your skin, slowly", seasonId: "sea3", number: 3 },
    { seriesId: "ser4", seriesTitle: "Season 4: Planned", seasonId: null, number: null },   // no season row yet: its title says
    { seriesId: "demo", seriesTitle: "Things that fall", seasonId: null, number: null },
  ]);

  it("reads 'S3 · E1' ahead of the number, and nothing without a season", () => {
    expect(seasonTag(3, 1)).toBe("S3 · E1");
    expect(seasonTag(2, 6)).toBe("S2 · E6");
    expect(seasonTag(3, null)).toBe("S3");
    expect(seasonTag(null, 1)).toBeNull();
  });

  it("takes the season from the episode's season row, else its series", () => {
    expect(episodeSeason({ seasonId: "sea3", seriesId: "ser3" }, idx)).toBe(3);
    expect(episodeSeason({ seasonId: null, seriesId: "ser2" }, idx)).toBe(2);
    expect(episodeSeason({ seasonId: null, seriesId: "ser4" }, idx)).toBe(4);
    expect(episodeSeason({ seasonId: null, seriesId: "demo" }, idx)).toBeNull();
    expect(episodeSeason({ seasonId: null, seriesId: null }, idx)).toBeNull();
    expect(seasonFromTitle("Season 12: x")).toBe(12);
    expect(seasonFromTitle("Seasonal things")).toBeNull();
  });

  it("matches the importer's slates: Skin Sense ep13-ep18 are S3 · E1-E6, ep07 is S2 · E1", () => {
    for (const n of [13, 14, 15, 16, 17, 18]) {
      const s = slateForEpisode("skincare", n)!;
      expect(seasonTag(s.season, s.order)).toBe(`S3 · E${n - 12}`);
    }
    expect(seasonTag(slateForEpisode("skincare", 7)!.season, slateForEpisode("skincare", 7)!.order)).toBe("S2 · E1");
    expect(seasonTag(slateForEpisode("physics", 13)!.season, slateForEpisode("physics", 13)!.order)).toBe("S3 · E1");
  });

  it("gives a long video its one season, or none when the data doesn't say", () => {
    expect(lessonSeason({ seriesId: "ser1" }, [{ seasonId: "sea1", seriesId: "ser1" }], idx)).toBe(1);
    expect(lessonSeason({ seriesId: "ser3" }, [], idx)).toBe(3);
    expect(lessonSeason({ seriesId: null }, [{ seasonId: "sea2", seriesId: "ser2" }], idx)).toBe(2);
    expect(lessonSeason({ seriesId: null }, [], idx)).toBeNull();
    expect(lessonSeason({ seriesId: null }, [{ seasonId: "sea1", seriesId: "ser1" }, { seasonId: "sea2", seriesId: "ser2" }], idx)).toBeNull();   // two seasons
    expect(oneSeason([3, 3, null])).toBe(3);
  });

  it("labels a long video S1/S2/S3 when its season is known, else Vol 1 / Vol 2", () => {
    expect(longVideoLabel("vol01", 1)).toBe("S1");
    expect(longVideoLabel("earth-spin", 3)).toBe("S3");
    expect(longVideoLabel("vol01", null)).toBe("Vol 1");
    expect(longVideoLabel("vol02", null)).toBe("Vol 2");
    expect(longVideoLabel("earth-spin", null)).toBe("earth-spin");
  });
});

// ── on the database: the Uploaded buttons and the importer's seasons ────────────────────────────────────────────
let db: DB, end: () => Promise<void>;
// Skin Sense: an episode folder at the start of each season, so the importer makes Seasons 1, 2 and 3 (ep01, ep07, ep13)
for (const n of [1, 7, 13]) fs.mkdirSync(path.join(ROOT, "films/channels/skincare", `ep${String(n).padStart(2, "0")}`), { recursive: true });

beforeAll(async () => {
  ({ db, end } = await freshDb());
  await importEpisodes(db);
});
afterAll(async () => { await end(); fs.rmSync(ROOT, { recursive: true, force: true }); });

describe("on the database", () => {
  it("tags the imported Skin Sense episodes from their season rows", async () => {
    const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "skincare"));
    const idx = await loadSeasonIndex(db, [ch.id]);
    const eps = await db.select().from(S.episodes).where(eq(S.episodes.channelId, ch.id));
    const tag = (n: number) => { const e = eps.find((x) => x.number === n)!; return seasonTag(episodeSeason(e, idx), e.seriesOrder); };
    expect([tag(1), tag(6), tag(7), tag(12), tag(13), tag(18)]).toEqual(["S1 · E1", "S1 · E6", "S2 · E1", "S2 · E6", "S3 · E1", "S3 · E6"]);
  });

  it("follows the Uploaded buttons: partly uploaded waits 24 h, all three moves it now, Undo brings it back", async () => {
    const { ep } = await renderedEpisode(db);
    const state = async (now = new Date()) => episodePublishedState(await publishedPubs(db, [ep.id]), now);
    expect((await state()).done).toBe(false);

    await markEpisodeUploaded(db, ep.id, "youtube_tiktok");
    const partly = await state();
    expect(partly).toMatchObject({ done: false });
    expect(partly.platforms.map((p) => p.uploaded)).toEqual([true, true, false]);
    expect((await state(new Date(partly.firstAt!.getTime() + PUBLISHED_AFTER_MS))).done).toBe(true);   // a day later, by itself

    await markEpisodeUploaded(db, ep.id, "instagram");
    expect(await state()).toMatchObject({ done: true, why: "all_three" });

    await undoEpisodeUploaded(db, ep.id, "instagram");
    await undoEpisodeUploaded(db, ep.id, "youtube_tiktok");
    expect(await state(new Date(Date.now() + 2 * PUBLISHED_AFTER_MS))).toMatchObject({ done: false, firstAt: null });
  });

  it("a long video: its season from the episodes it is built from, done a day after its press, back on Undo", async () => {
    const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "skincare"));
    const [s3] = await db.select({ id: S.seasons.id }).from(S.seasons).innerJoin(S.series, eq(S.series.id, S.seasons.seriesId))
      .where(and(eq(S.series.channelId, ch.id), eq(S.seasons.number, 3)));
    const parts = await db.select().from(S.episodes).where(eq(S.episodes.seasonId, s3.id));
    const [l] = await db.insert(S.lessons).values({ channelId: ch.id, title: "Inside your skin", name: "inside-your-skin", state: "ready_for_review", videoPath: "films:films/channels/skincare/compilations/inside-your-skin/x-16x9.mp4" }).returning();
    await db.insert(S.lessonEpisodes).values(parts.map((p, i) => ({ lessonId: l.id, episodeId: p.id, position: i + 1 })));
    const [vol] = await db.insert(S.lessons).values({ channelId: ch.id, title: "Volume one", name: "vol01", state: "ready_for_review", videoPath: "films:films/channels/skincare/compilations/vol01/vol01-16x9.mp4" }).returning();
    const seasons = await lessonSeasons(db, [l, vol], await loadSeasonIndex(db, [ch.id]));
    expect(longVideoLabel(l.name, seasons.get(l.id))).toBe("S3");
    expect(longVideoLabel(vol.name, seasons.get(vol.id))).toBe("Vol 1");   // nothing links it to a season

    await markLessonUploaded(db, l.id);
    const [marked] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(lessonPublished(marked)).toBe(false);
    expect(lessonPublished(marked, new Date(marked.reportedAt!.getTime() + PUBLISHED_AFTER_MS))).toBe(true);
    await undoLessonUploaded(db, l.id);
    const [undone] = await db.select().from(S.lessons).where(eq(S.lessons.id, l.id));
    expect(lessonPublished(undone, new Date(Date.now() + 2 * PUBLISHED_AFTER_MS))).toBe(false);
  });
});
