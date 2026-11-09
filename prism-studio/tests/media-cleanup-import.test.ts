// The importer and a cleared video: once the worker erased an episode's .mp4 files after posting, re-importing keeps
// the episode, its version, exports and publications exactly as they were (a missing video is expected there).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { markEpisodeUploaded } from "../src/domain/publications";
import { clearUploadedVideos } from "../src/domain/media-cleanup";

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "clear-import-"));
const DIR = "films/channels/space/ep01";
const write = (rel: string, body: string, mtime?: Date) => {
  const f = path.join(ROOT, DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
  if (mtime) fs.utimesSync(f, mtime, mtime);
};

let db: DB, end: () => Promise<void>;
let importEpisodes: (d: DB) => Promise<string[]>;
beforeAll(async () => {
  ({ db, end } = await freshDb());
  write("film.json", JSON.stringify({ dur: 31.5 }));
  write("out/sun-001-9x16.mp4", "master video", new Date("2026-11-01T00:00:00Z"));
  write("out/sun-001-9x16-youtube.mp4", "1440p video", new Date("2026-11-01T00:01:00Z"));
  write("out/sun-001-9x16.jpg", "poster");
  write("out/sun-001-cover.jpg", "cover", new Date("2026-11-01T00:02:00Z"));
  write("out/sun-001-9x16.srt", "1\n00:00:00,000 --> 00:00:01,000\nHi\n");
  write("out/posting.json", "{}");
  // the importer reads FILMS_REPO_ROOT when it loads
  process.env.FILMS_REPO_ROOT = ROOT;
  ({ importEpisodes } = await import("../scripts/import-episodes"));
});
afterAll(() => end());

describe("importing an episode whose video was cleared", () => {
  it("keeps the episode, version, exports and publications, and reports the missing video as expected", async () => {
    const first = await importEpisodes(db);
    expect(first.find((l) => l.startsWith("space ep1:"))).toMatch(/version 1 .*YouTube 1440p/);
    const [ch] = await db.select().from(S.channels).where(eq(S.channels.slug, "space"));
    const [ep] = await db.select().from(S.episodes).where(and(eq(S.episodes.channelId, ch.id), eq(S.episodes.number, 1)));
    expect(ep.filmsPath).toBe(DIR);

    await markEpisodeUploaded(db, ep.id, "youtube_tiktok");
    await markEpisodeUploaded(db, ep.id, "instagram");
    await db.update(S.publications).set({ reportedAt: new Date("2026-11-02T00:00:00Z") }).where(eq(S.publications.episodeId, ep.id));
    const snapshot = async () => {
      const [e] = await db.select().from(S.episodes).where(eq(S.episodes.id, ep.id));
      const vers = await db.select().from(S.versions).where(eq(S.versions.episodeId, ep.id));
      const xs = await db.select().from(S.platformExports).where(eq(S.platformExports.versionId, vers[0].id));
      const pubs = await db.select().from(S.publications).where(eq(S.publications.episodeId, ep.id));
      return {
        state: e.state, title: e.title, versions: vers.map((v) => [v.id, v.versionNo, v.videoPath, v.sha256, v.superseded]),
        exports: xs.map((x) => [x.id, x.platform, x.filePath, x.fileSha256, x.coverPath]).sort(),
        pubs: pubs.map((p) => [p.id, p.status, p.exportId, p.reportedAt?.toISOString()]).sort(),
      };
    };
    const before = await snapshot();
    expect(before.versions).toHaveLength(1);
    expect(before.exports).toHaveLength(3);
    expect(before.pubs).toHaveLength(3);

    const r = await clearUploadedVideos(db, ROOT, new Date("2026-11-09T12:00:00Z"));
    expect(r).toMatchObject({ episodes: 1, files: 2, failed: [] });
    expect(fs.existsSync(path.join(ROOT, DIR, "out/sun-001-9x16.mp4"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, DIR, "out/sun-001-cover.jpg"))).toBe(true);

    const again = await importEpisodes(db);
    expect(again.find((l) => l.startsWith("space ep1:"))).toBe("space ep1: video cleared after posting (records kept)");
    expect(await snapshot()).toEqual(before);
    const [e2] = await db.select().from(S.episodes).where(eq(S.episodes.id, ep.id));
    expect(e2.videoClearedAt?.toISOString()).toBe("2026-11-09T12:00:00.000Z");
    expect(e2.durationS).toBe(31.5);   // the episode's text and timings still come from the files that stay
  });
});
