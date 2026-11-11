// Season 3 (films/channels/SEASON-FORMAT.md): the slates, where each season's folders start (derived from the earlier
// slates, so Season 4 needs only its slate), and a part imported end to end: the right season and place, a statement hook
// kept a statement, film.json's title and packaging's winner over the placeholder, a real voice disclosed as one.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, freshDb, S } from "./helpers";
import type { DB } from "../src/db/client";
import { regenerateExports } from "../src/domain/exports";
import { parsePostingNotes } from "../src/domain/metadata";

// the importer reads FILMS_REPO_ROOT when it loads: point it at this file's own folder first
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "season3-"));
process.env.FILMS_REPO_ROOT = ROOT;
const { SEASON3, importEpisodes, seasonsFor, slateForEpisode } = await import("../scripts/import-episodes");

describe("Season 3 slates and folder numbers", () => {
  it("each channel's seasons start right after the previous one's last folder", () => {
    for (const slug of ["physics", "space", "whatif"]) {
      expect(seasonsFor(slug).map((s) => [s.season, s.first, s.slate.titles.length])).toEqual([[1, 1, 6], [2, 7, 6], [3, 13, 8]]);
    }
    expect(seasonsFor("skincare").map((s) => [s.season, s.first, s.slate.titles.length])).toEqual([[1, 1, 6], [2, 7, 6], [3, 13, 6]]);
    expect(seasonsFor("body").map((s) => s.season)).toEqual([1]);   // no Season 2, so no Season 3 either
    // Season 4 would start at ep21 (film channels) and ep19 (Skin Sense)
    const next = (slug: string) => { const s = seasonsFor(slug).at(-1)!; return s.first + s.slate.titles.length; };
    expect(["physics", "space", "whatif"].map(next)).toEqual([21, 21, 21]);
    expect(next("skincare")).toBe(19);
  });

  it("maps a folder number to its season and place", () => {
    expect(slateForEpisode("physics", 13)).toMatchObject({ season: 3, order: 1, first: 13 });
    expect(slateForEpisode("physics", 20)).toMatchObject({ season: 3, order: 8 });
    expect(slateForEpisode("physics", 21)).toBeNull();
    expect(slateForEpisode("physics", 12)).toMatchObject({ season: 2, order: 6 });
    expect(slateForEpisode("skincare", 18)).toMatchObject({ season: 3, order: 6 });
    expect(slateForEpisode("skincare", 19)).toBeNull();
    expect(slateForEpisode("space", 13)?.slate.series).toBe("Season 3: The Moon comes closer");
  });

  it("uses the stable series titles (a series row is found by its title)", () => {
    expect(Object.fromEntries(Object.entries(SEASON3).map(([k, v]) => [k, v.series]))).toEqual({
      physics: "Season 3: One second, slowed down", space: "Season 3: The Moon comes closer",
      whatif: "Season 3: The Earth spins faster", skincare: "Season 3: Inside your skin, slowly",
    });
    for (const s of Object.values(SEASON3)) expect(s.objective.length).toBeGreaterThan(20);
  });
});

// ── a part imported end to end ──────────────────────────────────────────────────────────────────────────────────
const write = (rel: string, body: string) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
};
const PH = "films/channels/physics";
// Season 3's first folder must exist for the season to be created; Seasons 1 and 2 are made from their slates as usual
write(`${PH}/ep13/script.md`, `# Reality Rulebook · Season 3 · Part 1 of 8

## hook {chapter: 1 · part hook} (0.0–3.0 s)
vo: Watch a wing, slowed ten times. {-}

## body {chapter: wings} (3.0–60.0 s)
vo: Ten times slower. {-} A small hummingbird hovers at the window. {-} Its wings beat about fifty times a second. {c3} Quick pause: if that one got you, tap like and follow. {-} Okay, back to it. {-} But look at the fly by the cup. {-}

## tease {end card} (60.0–66.0 s)
vo: Part 1 of 8. {-} Full video on YouTube. {-}
end card: "Part 1 of 8" · "Full video on YouTube"
`);
write(`${PH}/ep13/film.json`, JSON.stringify({ id: "s3p1", dur: 67.2, title: null, disclosures: { aiVoice: false, aiVisuals: false } }));
write(`${PH}/ep13/claims.json`, JSON.stringify([{ id: "c3", claim: "A small hummingbird beats its wings about 50 times a second", source_url: "https://www.britannica.com/animal/hummingbird", status: "ok" }]));
write(`${PH}/ep13/out/reality-rulebook-s3p1-9x16.mp4`, "part one video");
// ep14: a delivered title in film.json (the synthetic voice by default: no disclosures)
write(`${PH}/ep14/film.json`, JSON.stringify({ id: "s3p2", dur: 66, title: { title: "A fly's *wings*, then a splash" } }));
write(`${PH}/ep14/out/reality-rulebook-s3p2-9x16.mp4`, "part two video");
write(`${PH}/ep14/out/packaging.json`, JSON.stringify({ version: 1, format: "short", winner: { title: "A Fly's Wings Still Blur at 100× Slower" } }));

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(async () => { await end(); fs.rmSync(ROOT, { recursive: true, force: true }); });

const episode = async (n: number) => {
  const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
  const [e] = await db.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, n)));
  const [se] = await db.select().from(S.series).where(eq(S.series.id, e.seriesId!));
  const [sn] = await db.select().from(S.seasons).where(eq(S.seasons.id, e.seasonId!));
  const [v] = await db.select().from(S.versions).where(eq(S.versions.episodeId, e.id));
  const xs = v ? await db.select().from(S.platformExports).where(eq(S.platformExports.versionId, v.id)) : [];
  return { e, se, sn, x: (p: string) => xs.find((x) => x.platform === p)! };
};

describe("importing a Season 3 part", () => {
  it("creates it in Season 3, part 1 of 8, with the slate's title and a statement hook kept a statement", async () => {
    const report = await importEpisodes(db);
    expect(report.find((l) => l.startsWith("physics ep13:"))).toMatch(/version 1/);
    const { e, se, sn } = await episode(13);
    expect(se.title).toBe("Season 3: One second, slowed down");
    expect(sn.number).toBe(3);
    expect(e).toMatchObject({ seriesOrder: 1, title: "Watch a wing, slowed ten times", question: "Watch a wing, slowed ten times.", state: "ready_for_review" });
    // the rest of the season is planned from the slate, up to ep20 and no further
    for (const n of [15, 20]) expect((await episode(n)).e).toMatchObject({ state: "idea", seriesOrder: n - 12 });
    const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
    expect(await db.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, 21)))).toHaveLength(0);
  });

  it("a real voice is disclosed as one: no synthetic-voice line and no AI label to turn on", async () => {
    const { x } = await episode(13);
    for (const p of ["youtube", "tiktok", "instagram"]) {
      expect(x(p).disclosures).toMatchObject({ aiVoice: false, aiVisuals: false });
      expect(x(p).caption).not.toMatch(/synthetic|AI voice/i);
      expect(x(p).postingNotes).not.toMatch(/synthetic content label/);
      expect(parsePostingNotes(x(p).postingNotes)).toMatchObject({ aiLabel: false, captionsOff: true });
    }
    expect(x("youtube").title).toBe("Watch a wing, slowed ten times | Reality Rulebook S3 · Ep 1");
    // the body carries the posting text (without the like/follow moment), not just the two-second hook
    expect(x("youtube").caption).toContain("Its wings beat about fifty times a second. But look at the fly by the cup.");
    expect(x("youtube").caption).not.toMatch(/tap like|back to it/i);
    expect(x("youtube").caption).toContain("Series: Season 3: One second, slowed down, part 1 of 8.");
    // regenerating the text keeps the real voice and the season's label
    await regenerateExports(db, (await episode(13)).e.id);
    const again = await episode(13);
    expect(again.x("youtube").caption).not.toMatch(/synthetic/i);
    expect(again.x("youtube").title).toBe("Watch a wing, slowed ten times | Reality Rulebook S3 · Ep 1");
  });

  it("film.json's title wins over the placeholder; packaging's winner is the YouTube title; the voice defaults to synthetic", async () => {
    const { e, x } = await episode(14);
    expect(e).toMatchObject({ title: "A fly's wings, then a splash", seriesOrder: 2 });
    expect(x("youtube").title).toBe("A Fly's Wings Still Blur at 100× Slower");
    expect(x("youtube").disclosures).toMatchObject({ aiVoice: true });
    expect(x("youtube").caption).toContain("Narration: synthetic voice (AI)");
  });

  it("is idempotent", async () => {
    await importEpisodes(db);
    const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
    const s3 = await db.select().from(S.series).where(and(eq(S.series.channelId, ch.id), eq(S.series.title, "Season 3: One second, slowed down")));
    expect(s3).toHaveLength(1);
    expect(await db.select().from(S.episodes).where(eq(S.episodes.seriesId, s3[0].id))).toHaveLength(8);
  });
});
