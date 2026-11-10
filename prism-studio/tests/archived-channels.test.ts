// Archived channels (src/domain/channels.ts): hidden from every list and total, skipped by everything automatic (the
// scheduler, publishing, notifications, analytics pulls, video cleanup, the importer, media push), never un-archived
// by the seed, every row kept, and Restore brings the channel back exactly as it was.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import {
  activeChannelBySlug, activeChannels, archiveChannel, archivedChannels, archivedFilmsPaths, inArchivedFolder, isArchived, onActiveChannel, restoreChannel,
} from "../src/domain/channels";
import { seed } from "../scripts/seed";
import { planDays, slotsForDate } from "../src/domain/schedule";
import { publishPublication } from "../src/domain/publish";
import { pullBlocker } from "../src/domain/api-analytics";
import { analyticsTotals } from "../src/domain/analytics";
import { dueUploads } from "../src/domain/push";
import { approve } from "../src/domain/approvals";
import { markUploaded } from "../src/domain/publications";
import { addDays, localDate } from "../src/domain/time";
import { rigLayout, RIG } from "../src/lib/rig";

// the importer reads FILMS_REPO_ROOT when it loads: a films folder with one Body Backstage episode and one long video
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "archived-"));
const write = (rel: string, body: string) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
write("films/channels/body/ep01/film.json", JSON.stringify({ dur: 30 }));
write("films/channels/body/ep01/out/single-file-9x16.mp4", "body master");
write("films/channels/body/compilations/vol01/vol01-16x9.mp4", "body long video");

let db: DB, end: () => Promise<void>;
let importEpisodes: (d: DB) => Promise<string[]>;
const body = async () => (await db.select().from(S.channels).where(eq(S.channels.slug, "body")))[0];
beforeAll(async () => {
  ({ db, end } = await freshDb());
  process.env.FILMS_REPO_ROOT = ROOT;
  ({ importEpisodes } = await import("../scripts/import-episodes"));
});
afterAll(async () => { await end(); fs.rmSync(ROOT, { recursive: true, force: true }); });

describe("the archived-channel helper", () => {
  it("leaves an archived channel out of the active list and lists it apart", async () => {
    expect((await activeChannels(db)).map((c) => c.slug)).toEqual(["skincare", "physics", "body", "space", "whatif"]);
    const b = await archiveChannel(db, (await body()).id);
    expect(isArchived(b)).toBe(true);
    expect((await activeChannels(db)).map((c) => c.slug)).toEqual(["skincare", "physics", "space", "whatif"]);
    expect((await archivedChannels(db)).map((c) => c.slug)).toEqual(["body"]);
    expect(await activeChannelBySlug(db, "body")).toBeNull();
    expect((await activeChannelBySlug(db, "physics"))?.slug).toBe("physics");
    expect(await archivedFilmsPaths(db)).toEqual(["films/channels/body"]);
    // archiving again keeps the first date; the archive is audit-logged once
    const again = await archiveChannel(db, b.id);
    expect(+again.archivedAt!).toBe(+b.archivedAt!);
    expect(await db.select().from(S.auditLog).where(and(eq(S.auditLog.action, "channel.archive"), eq(S.auditLog.entityId, b.id)))).toHaveLength(1);
  });

  it("filters rows that belong to an archived channel, and keeps rows with no channel", async () => {
    const dests = await db.select().from(S.destinations).where(onActiveChannel(S.destinations.channelId));
    expect(dests).toHaveLength(9);   // four channels × YouTube and TikTok, plus the shared Instagram
    expect(dests.some((d) => d.shared)).toBe(true);
    const b = await body();
    expect(dests.some((d) => d.channelId === b.id)).toBe(false);
    // nothing was deleted: the rows are all still there
    expect(await db.select().from(S.destinations)).toHaveLength(11);
  });

  it("the seed never brings an archived channel back", async () => {
    await seed(db);
    expect(isArchived(await body())).toBe(true);
    expect(await db.select().from(S.channels)).toHaveLength(5);
  });

  it("matches films paths inside an archived channel's folder only", () => {
    const gone = ["films/channels/body"];
    expect(inArchivedFolder("films/channels/body/ep01/out/x.mp4", gone)).toBe(true);
    expect(inArchivedFolder("films/channels/body/compilations/vol01/vol01-16x9.mp4", gone)).toBe(true);
    expect(inArchivedFolder("films/channels/bodyguard/ep01/out/x.mp4", gone)).toBe(false);
    expect(inArchivedFolder("films/channels/physics/ep01/out/x.mp4", gone)).toBe(false);
    expect(inArchivedFolder("films/channels/body/ep01/out/x.mp4", [])).toBe(false);
  });
});

describe("nothing automatic touches an archived channel", () => {
  it("the importer skips it: no series, episodes or long videos, whatever files arrive", async () => {
    const report = await importEpisodes(db);
    expect(report).toContain("body: archived, skipped");
    const b = await body();
    expect(await db.select().from(S.episodes).where(eq(S.episodes.channelId, b.id))).toHaveLength(0);
    expect(await db.select().from(S.series).where(eq(S.series.channelId, b.id))).toHaveLength(0);
    expect(await db.select().from(S.lessons).where(eq(S.lessons.channelId, b.id))).toHaveLength(0);
    expect(isArchived(await body())).toBe(true);   // and it is still archived
    // the active channels are imported as usual (their slates, here with no files: ideas)
    const [phys] = await db.select().from(S.channels).where(eq(S.channels.slug, "physics"));
    expect((await db.select().from(S.episodes).where(eq(S.episodes.channelId, phys.id))).length).toBeGreaterThan(0);
  });

  it("the schedule has no slots for it and planning never places its posts", async () => {
    const b = await body();
    const today = localDate(new Date(), "America/Los_Angeles");
    const slots = await slotsForDate(db, addDays(today, 1));
    expect(slots.some((s) => s.channelId === b.id)).toBe(false);
    expect(slots.some((s) => s.kind === "instagram")).toBe(true);
    // an Instagram-ready Body episode is never rotated onto the shared Instagram, and its own posts stay unplanned
    const r = await renderedEpisode(db, "body", { title: "Archived body episode" });
    await planDays(db, addDays(today, 1), 2);
    const own = await db.select().from(S.publications).where(eq(S.publications.episodeId, r.ep.id));
    expect(own.map((p) => p.scheduledFor)).toEqual([null, null]);
    const igPlanned = await db.select({ channelId: S.episodes.channelId }).from(S.publications).innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId))
      .innerJoin(S.destinations, eq(S.destinations.id, S.publications.destinationId)).where(eq(S.destinations.shared, true));
    expect(igPlanned.some((r) => r.channelId === b.id)).toBe(false);
  });

  it("publishing, upload reminders and analytics pulls skip it", async () => {
    const r = await renderedEpisode(db, "body", { title: "Due on an archived channel" });
    const now = new Date();
    await db.update(S.publications).set({ scheduledFor: new Date(+now + 10 * 60_000) }).where(eq(S.publications.id, r.pubs.youtube.id));
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    expect((await dueUploads(db, now)).some((c) => c.publicationId === r.pubs.youtube.id)).toBe(false);
    expect(await publishPublication(db, r.pubs.youtube.id, { manual: true })).toMatchObject({ outcome: "skipped", note: "this channel is archived" });
    expect(pullBlocker({ simulated: false, isDemo: false, status: "verified_published", postId: "x", platform: "youtube", connStatus: "connected", archived: true }, { stopped: false, connector: null })?.code).toBe("archived");
    // its posted numbers stay in the database but out of the studio's totals
    const before = await analyticsTotals(db);
    await markUploaded(db, r.pubs.tiktok.id, {});
    expect((await analyticsTotals(db)).posts).toBe(before.posts);
  });
});

describe("Restore", () => {
  it("brings the channel back everywhere, with everything it had, and is audit-logged", async () => {
    const b = await body();
    const kept = (await db.select().from(S.episodes).where(eq(S.episodes.channelId, b.id))).length;
    expect(kept).toBeGreaterThan(0);   // its episodes were kept while it was archived
    const r = await restoreChannel(db, b.id);
    expect(r.archivedAt).toBeNull();
    expect((await activeChannels(db)).map((c) => c.slug)).toContain("body");
    expect(await archivedChannels(db)).toHaveLength(0);
    expect(await db.select().from(S.episodes).where(eq(S.episodes.channelId, b.id))).toHaveLength(kept);
    const [log] = await db.select().from(S.auditLog).where(and(eq(S.auditLog.action, "channel.restore"), eq(S.auditLog.entityId, b.id)));
    expect(log.actor).toBe("owner");
    expect(log.detail).toMatchObject({ slug: "body" });
    // and the importer and the schedule take it again
    expect(await importEpisodes(db)).not.toContain("body: archived, skipped");
    expect(await db.select().from(S.lessons).where(eq(S.lessons.channelId, b.id))).toHaveLength(1);
    const today = localDate(new Date(), "America/Los_Angeles");
    expect((await slotsForDate(db, addDays(today, 1))).some((s) => s.channelId === b.id)).toBe(true);
  });
});

describe("the wall's layout", () => {
  it("five channels sit on their own screens", () => {
    const l = rigLayout(["skincare", "physics", "body", "space", "whatif"]);
    expect(Object.fromEntries([...l].map(([slug, pos]) => [pos, slug]))).toEqual(RIG);
  });
  it("four channels sit two a side, with no top screen", () => {
    const l = rigLayout(["skincare", "physics", "space", "whatif"]);
    expect(Object.fromEntries(l)).toEqual({ physics: "innerLeft", space: "innerRight", skincare: "outerRight", whatif: "outerLeft" });
    expect([...l.values()]).not.toContain("top");
  });
  it("fewer channels stay balanced", () => {
    expect([...rigLayout(["physics", "space", "whatif"]).values()].sort()).toEqual(["innerLeft", "innerRight", "top"]);
    expect([...rigLayout(["skincare", "whatif"]).values()].sort()).toEqual(["innerLeft", "innerRight"]);
  });
});
