// The shared Instagram: two posts a day by default, rotating across the channels, and an episode never goes up on
// Instagram twice, however many days are planned.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, channel, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { addDays, localDate, zonedTimeToUtc } from "../src/domain/time";
import { planDays, slotsForDate } from "../src/domain/schedule";

const LA = "America/Los_Angeles";

async function igPublications(db: DB) {
  const { ig } = await channel(db);
  return db.select({ p: S.publications, e: S.episodes, c: S.channels }).from(S.publications)
    .innerJoin(S.episodes, eq(S.episodes.id, S.publications.episodeId)).innerJoin(S.channels, eq(S.channels.id, S.episodes.channelId))
    .where(eq(S.publications.destinationId, ig.id)).orderBy(S.publications.scheduledFor);
}

describe("instagram planning", () => {
  let db: DB, end: () => Promise<void>;
  beforeAll(async () => ({ db, end } = await freshDb()));
  afterAll(() => end());

  it("has two Instagram slots a day by default", async () => {
    const [s] = await db.select().from(S.studioSettings);
    expect(s.instagramDaily).toBe(2);
    for (const day of ["2027-01-04", "2027-01-05", "2027-03-14" /* DST change day */]) {
      const ig = (await slotsForDate(db, day)).filter((x) => x.kind === "instagram");
      expect(ig).toHaveLength(2);
      expect(new Set(ig.map((x) => +x.at)).size).toBe(2);
      expect(ig.every((x) => localDate(x.at, LA) === day)).toBe(true);
    }
  });

  it("rotates across channels when several have content", async () => {
    for (const slug of ["physics", "body", "space"]) {
      await renderedEpisode(db, slug, { title: `${slug} one` });
      await renderedEpisode(db, slug, { title: `${slug} two` });
    }
    const from = "2027-01-10";
    await planDays(db, from, 2, zonedTimeToUtc(from, "00:00", LA));
    const rows = await igPublications(db);
    expect(rows).toHaveLength(4);                                   // two a day, two days
    const perDay = rows.reduce<Record<string, number>>((a, r) => { const d = localDate(r.p.scheduledFor!, LA); a[d] = (a[d] ?? 0) + 1; return a; }, {});
    expect(perDay).toEqual({ "2027-01-10": 2, "2027-01-11": 2 });
    const seq = rows.map((r) => r.c.slug);
    expect(new Set(seq.slice(0, 3)).size).toBe(3);                  // the first three posts come from three channels
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);   // never the same channel twice running
    expect(rows.every((r) => r.p.kind === "instagram" && r.p.status === "planned" && r.p.exportId)).toBe(true);
  });

  it("never schedules the same episode on Instagram twice, however many days are planned", async () => {
    const from = "2027-02-01";
    const placed = await planDays(db, from, 14, zonedTimeToUtc(from, "00:00", LA));
    expect(placed).toBeGreaterThan(0);
    await planDays(db, addDays(from, 7), 14, zonedTimeToUtc(from, "00:00", LA));   // overlapping re-plan
    const rows = await igPublications(db);
    const ids = rows.map((r) => r.e.id);
    expect(new Set(ids).size).toBe(ids.length);                     // one Instagram publication per episode
    expect(ids).toHaveLength(6);                                    // every rendered episode went up exactly once
    const slots = rows.map((r) => +r.p.scheduledFor!);
    expect(new Set(slots).size).toBe(slots.length);                 // and never two in one slot
    // with nothing left to place, more planning adds nothing on Instagram
    await planDays(db, "2027-03-01", 10, zonedTimeToUtc("2027-03-01", "00:00", LA));
    expect(await igPublications(db)).toHaveLength(6);
  });

  it("an episode posted to Instagram is never planned there again", async () => {
    const x = await renderedEpisode(db, "space", { title: "already posted" });
    await db.insert(S.publications).values({ episodeId: x.ep.id, destinationId: x.ig.id, exportId: x.exports.instagram.id, kind: "instagram", status: "owner_reported", reportedAt: new Date("2027-01-01T20:00:00Z") });
    await planDays(db, "2027-04-01", 5, zonedTimeToUtc("2027-04-01", "00:00", LA));
    const mine = await db.select().from(S.publications).where(and(eq(S.publications.episodeId, x.ep.id), eq(S.publications.destinationId, x.ig.id)));
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe("owner_reported");
  });
});
