import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { addDays, localDate, zonedTimeToUtc } from "../src/domain/time";
import { planDays, rescheduleMissed, slotsForDate } from "../src/domain/schedule";

const LA = "America/Los_Angeles";

describe("timezones", () => {
  it("converts ordinary local times", () => {
    expect(zonedTimeToUtc("2026-10-25", "09:00", LA).toISOString()).toBe("2026-10-25T16:00:00.000Z");   // PDT
    expect(zonedTimeToUtc("2026-12-01", "09:00", LA).toISOString()).toBe("2026-12-01T17:00:00.000Z");   // PST
  });
  it("a time skipped by spring-forward lands on the first valid instant", () => {
    expect(zonedTimeToUtc("2026-03-08", "02:30", LA).toISOString()).toBe("2026-03-08T10:00:00.000Z");   // 03:00 PDT
  });
  it("an ambiguous fall-back time resolves to its first occurrence", () => {
    expect(zonedTimeToUtc("2026-11-01", "01:30", LA).toISOString()).toBe("2026-11-01T08:30:00.000Z");   // 01:30 PDT
  });
  it("local dates and day arithmetic", () => {
    expect(localDate(new Date("2026-10-26T06:30:00Z"), LA)).toBe("2026-10-25");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("schedule", () => {
  let db: DB, end: () => Promise<void>;
  beforeAll(async () => ({ db, end } = await freshDb()));
  afterAll(() => end());

  it("one Short per channel per platform a day, staggered, plus two Instagram posts", async () => {
    const slots = await slotsForDate(db, "2026-11-10");
    expect(slots).toHaveLength(5 * 2 + 2);
    const yt = slots.filter((s) => s.platform === "youtube").map((s) => s.at.toISOString());
    expect(new Set(yt).size).toBe(5);   // staggered, not all at once
  });
  it("blackouts and the global pause remove slots", async () => {
    await db.insert(S.blackouts).values({ startsAt: zonedTimeToUtc("2026-11-11", "00:00", LA), endsAt: zonedTimeToUtc("2026-11-12", "00:00", LA) });
    expect(await slotsForDate(db, "2026-11-11")).toHaveLength(0);
    await db.update(S.studioSettings).set({ globalPause: true });
    expect(await slotsForDate(db, "2026-11-10")).toHaveLength(0);
    await db.update(S.studioSettings).set({ globalPause: false });
  });
  it("planning fills slots in episode order without double-booking", async () => {
    const a = await renderedEpisode(db, "physics", { title: "first" });
    const b = await renderedEpisode(db, "physics", { title: "second" });
    const now = zonedTimeToUtc("2026-11-20", "00:00", LA);
    const n1 = await planDays(db, "2026-11-20", 2, now);
    const n2 = await planDays(db, "2026-11-20", 2, now);
    expect(n2).toBe(0);
    expect(n1).toBeGreaterThanOrEqual(4);
    const [pa] = await db.select().from(S.publications).where(eq(S.publications.id, a.pubs.youtube.id));
    const [pb] = await db.select().from(S.publications).where(eq(S.publications.id, b.pubs.youtube.id));
    expect(localDate(pa.scheduledFor!, LA)).toBe("2026-11-20");
    expect(localDate(pb.scheduledFor!, LA)).toBe("2026-11-21");
  });
  it("missed uploads move to the next free days, one a day (no catch-up burst)", async () => {
    const x = await renderedEpisode(db, "body", { title: "m1" }), y = await renderedEpisode(db, "body", { title: "m2" });
    const past = zonedTimeToUtc("2026-12-01", "09:40", LA);
    for (const p of [x.pubs.youtube, y.pubs.youtube]) await db.update(S.publications).set({ scheduledFor: past, status: "ready" }).where(eq(S.publications.id, p.id));
    const now = zonedTimeToUtc("2026-12-02", "08:00", LA);
    expect(await rescheduleMissed(db, now)).toBeGreaterThanOrEqual(2);   // earlier tests' unposted slots move too
    const rows = await db.select().from(S.publications).where(eq(S.publications.destinationId, x.yt.id));
    const days = rows.filter((r) => [x.pubs.youtube.id, y.pubs.youtube.id].includes(r.id)).map((r) => localDate(r.scheduledFor!, LA)).sort();
    expect(days).toEqual(["2026-12-02", "2026-12-03"]);
    expect(rows.find((r) => r.id === x.pubs.youtube.id)!.originalSlot?.toISOString()).toBe(past.toISOString());
  });
});
