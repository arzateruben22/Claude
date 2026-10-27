import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { channel, eq, freshDb, renderedEpisode, sql, S } from "./helpers";
import type { DB } from "../src/db/client";
import { channelEpisodes, showDemo } from "../src/domain/demo";
import { analyticsTotals } from "../src/domain/analytics";
import { channelXp, onPublicationReported, publishedEpisodes, refreshEvolution, requirementsFor } from "../src/domain/living";
import { markUploaded } from "../src/domain/publications";
import { recordMetric, rewardBalances, setMonthlyCap, addFunding } from "../src/domain/rewards";
import { availableForLesson } from "../src/domain/lessons";
import { planDays } from "../src/domain/schedule";
import { localDate } from "../src/domain/time";
import { seedDemo } from "../scripts/seed";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

const setShow = (on: boolean) => db.update(S.studioSettings).set({ showDemo: on });

/** A rendered, demo-flagged episode with planned YouTube/TikTok publications (otherwise eligible for everything). */
async function demoEpisode(slug = "physics") {
  const r = await renderedEpisode(db, slug, { title: "A demo short" });
  await db.update(S.episodes).set({ isDemo: true, filmsPath: `channels/${slug}/ep90` }).where(eq(S.episodes.id, r.ep.id));
  return r;
}

describe("the Show demo data switch", () => {
  it("is off by default: demo episodes are hidden; on, they're listed and flagged is_demo", async () => {
    const { c } = await channel(db);
    expect(await showDemo(db)).toBe(false);
    const n = await seedDemo(db);
    expect(n).toBe(3);
    expect((await channelEpisodes(db, c.id)).some((e) => e.isDemo)).toBe(false);
    await setShow(true);
    const shown = (await channelEpisodes(db, c.id)).filter((e) => e.isDemo);
    expect(shown.map((e) => e.number)).toEqual([901, 902, 903]);
    await setShow(false);
  });

  it("seed --demo is idempotent, labelled and never spends a real episode number", async () => {
    const { c } = await channel(db);
    expect(await seedDemo(db)).toBe(0);
    const [ser] = await db.select().from(S.series).where(eq(S.series.channelId, c.id));
    expect(ser.isDemo).toBe(true);
    const [counter] = await db.select().from(S.episodeCounters).where(eq(S.episodeCounters.channelId, c.id));
    expect(counter.nextNumber).toBe(1);
  });
});

describe("with Show demo data on, demo data still never counts", () => {
  beforeAll(async () => {
    await db.execute(sql`truncate table episodes, series, xp_events, achievement_events, rewards, reward_ledger, evolutions restart identity cascade`);
    await setShow(true);
    await setMonthlyCap(db, 100_000);
    await addFunding(db, { amountCents: 100_000 });
  });

  it("a demo episode marked uploaded earns no XP, no achievement and no evolution progress", async () => {
    const { c, pubs, ep } = await demoEpisode();
    await markUploaded(db, pubs.youtube.id, { postUrl: "https://youtube.com/shorts/demo1" });
    await onPublicationReported(db, pubs.youtube.id);
    expect((await channelXp(db, c.id)).xp).toBe(0);
    expect(await db.select().from(S.xpEvents)).toHaveLength(0);
    expect(await db.select().from(S.achievementEvents)).toHaveLength(0);
    expect(await publishedEpisodes(db, c.id)).toHaveLength(0);
    expect((await requirementsFor(db, c.id, 2))[0].met).toBe(false);
    expect(await refreshEvolution(db, c.id)).toEqual([]);
    const [after] = await db.select().from(S.episodes).where(eq(S.episodes.id, ep.id));
    expect(after.state).toBe("ready_for_review");   // not moved to "published"
  });

  it("demo views never unlock a real milestone or reserve a reward, and stay out of analytics totals", async () => {
    const [pub] = await db.select().from(S.publications).where(eq(S.publications.status, "owner_reported"));
    const before = await rewardBalances(db);
    const real = await recordMetric(db, { publicationId: pub.id, metric: "views", value: 2_000_000, source: "manual" });
    expect(real.unlocked).toEqual([]);
    const demo = await recordMetric(db, { publicationId: pub.id, metric: "views", value: 2_000_000, source: "demo" });
    expect(demo.unlocked.length).toBeGreaterThan(0);
    expect(demo.unlocked.every((u) => u.isDemo)).toBe(true);           // a DEMO badge preview at most
    expect(await db.select().from(S.rewards)).toHaveLength(0);
    expect(await rewardBalances(db)).toEqual(before);
    expect((await channelXp(db, (await channel(db)).c.id)).xp).toBe(0);   // demo XP is kept apart
    expect(await analyticsTotals(db)).toEqual({ posts: 0, measured: 0, views: 0 });
  });

  it("a demo episode never joins a lesson or gets planned on the calendar", async () => {
    const { c } = await channel(db);
    const ids = (await db.select().from(S.episodes).where(eq(S.episodes.isDemo, true))).map((e) => e.id);
    expect((await availableForLesson(db, c.id)).some((e) => ids.includes(e.id))).toBe(false);
    await planDays(db, localDate(new Date(), "America/Los_Angeles"), 3);
    const planned = await db.select().from(S.publications).where(sql`${S.publications.episodeId} in ${ids} and ${S.publications.scheduledFor} is not null`);
    expect(planned).toHaveLength(0);
  });

  it("the same steps on a real episode do count (so the checks above would see counting)", async () => {
    const { c, pubs, ep } = await renderedEpisode(db, "physics", { title: "A real short" });
    await db.update(S.episodes).set({ filmsPath: "channels/physics/ep01" }).where(eq(S.episodes.id, ep.id));
    expect((await availableForLesson(db, c.id)).some((e) => e.id === ep.id)).toBe(true);
    await markUploaded(db, pubs.youtube.id, { postUrl: "https://youtube.com/shorts/real1" });
    await onPublicationReported(db, pubs.youtube.id);
    await recordMetric(db, { publicationId: pubs.youtube.id, metric: "views", value: 1500, source: "manual" });
    await recordMetric(db, { publicationId: pubs.youtube.id, metric: "views", value: 9_999_999, source: "demo" });
    expect((await channelXp(db, c.id)).xp).toBeGreaterThan(0);
    expect(await publishedEpisodes(db, c.id)).toHaveLength(1);
    expect(await analyticsTotals(db)).toEqual({ posts: 1, measured: 1, views: 1500 });   // demo numbers never join the total
  });

  it("turning the switch off or on changes no total", async () => {
    const { c } = await channel(db);
    const snapshot = async () => ({
      xp: await channelXp(db, c.id), totals: await analyticsTotals(db), published: (await publishedEpisodes(db, c.id)).length,
      rewards: await rewardBalances(db), form2: (await requirementsFor(db, c.id, 2)).map((r) => r.met),
      achievements: (await db.select().from(S.achievementEvents).where(eq(S.achievementEvents.isDemo, false))).length,
    });
    await setShow(true);
    const on = await snapshot();
    await setShow(false);
    const off = await snapshot();
    expect(on).toEqual(off);
  });
});
