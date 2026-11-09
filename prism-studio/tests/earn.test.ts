import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, channel, S, sql } from "./helpers";
import type { DB } from "../src/db/client";
import { accountSnapshotsByDestination, attentionItems, earnProgress, recordAccountMetrics, type Snap } from "../src/domain/earn";

const now = new Date("2026-11-09T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
const s = (metric: string, value: number, days = 1, source = "manual"): Snap => ({ metric, value, source, recordedAt: ago(days) });

describe("earnProgress", () => {
  it("keeps missing numbers blank, never 0", () => {
    const p = earnProgress("youtube", [s("subscribers", 400)], now);
    const full = p.tiers[0];
    expect(full.reqs[0].value).toBe(400);
    expect(full.route!.value).toBeNull();
    expect(full.route!.percent).toBeNull();
    expect(full.route!.left).toBeNull();
    const none = earnProgress("tiktok", [], now);
    expect(none.status).toBe("not_started");
    expect(none.statusLabel).toBe("Not started (no numbers yet)");
    expect(none.ageLine).toBeNull();
    expect(none.tiers[0].reqs.every((r) => r.value === null)).toBe(true);
  });

  it("ignores estimates and demo numbers", () => {
    const p = earnProgress("youtube", [s("subscribers", 5000, 1, "estimate"), s("watch_hours_12m", 9000, 1, "demo")], now);
    expect(p.status).toBe("not_started");
    expect(p.hasNumbers).toBe(false);
    expect(p.ignored).toBe(2);
    // a newer estimate never replaces an older real number
    const q = earnProgress("youtube", [s("subscribers", 300, 5), s("subscribers", 9999, 1, "estimate")], now);
    expect(q.tiers[0].reqs[0].value).toBe(300);
  });

  it("uses the latest counted value", () => {
    const p = earnProgress("tiktok", [s("followers", 100, 20), s("followers", 250, 2)], now);
    expect(p.tiers[0].reqs[0].value).toBe(250);
  });

  it("picks the closer YouTube route", () => {
    const watch = earnProgress("youtube", [s("subscribers", 900), s("watch_hours_12m", 2000), s("shorts_views_90d", 1_000_000)], now);
    expect(watch.tiers[0].route!.metric).toBe("watch_hours_12m");
    expect(watch.tiers[0].otherRoute!.metric).toBe("shorts_views_90d");
    const shorts = earnProgress("youtube", [s("subscribers", 900), s("watch_hours_12m", 500), s("shorts_views_90d", 6_000_000)], now);
    expect(shorts.tiers[0].route!.metric).toBe("shorts_views_90d");
    expect(shorts.tiers[0].route!.percent).toBe(60);
  });

  it("reports the eligible state (full programme, early tier, TikTok)", () => {
    const full = earnProgress("youtube", [s("subscribers", 1000), s("watch_hours_12m", 4000)], now);
    expect(full.status).toBe("eligible");
    expect(full.statusLabel).toBe("Eligible: apply now");
    const viaShorts = earnProgress("youtube", [s("subscribers", 1200), s("shorts_views_90d", 10_000_000)], now);
    expect(viaShorts.tiers[0].met).toBe(true);
    const early = earnProgress("youtube", [s("subscribers", 500), s("uploads_90d", 3), s("watch_hours_12m", 3000)], now);
    expect(early.tiers[0].met).toBe(false);
    expect(early.tiers[1].met).toBe(true);
    expect(early.status).toBe("eligible");
    const tt = earnProgress("tiktok", [s("followers", 10_000), s("views_30d", 100_000)], now);
    expect(tt.status).toBe("eligible");
    expect(earnProgress("tiktok", [s("followers", 10_000), s("views_30d", 99_999)], now).status).not.toBe("eligible");
  });

  it("is On the way up to 75% and Close above it", () => {
    expect(earnProgress("tiktok", [s("followers", 7500), s("views_30d", 100_000)], now).status).toBe("on_the_way");
    expect(earnProgress("tiktok", [s("followers", 7600), s("views_30d", 100_000)], now).status).toBe("close");
  });

  it("flags data older than 14 days", () => {
    const fresh = earnProgress("tiktok", [s("followers", 5000, 14), s("views_30d", 1000, 14)], now);
    expect(fresh.stale).toBe(false);
    const old = earnProgress("tiktok", [s("followers", 5000, 1), s("views_30d", 1000, 23)], now);
    expect(old.stale).toBe(true);
    expect(old.ageDays).toBe(23);
    expect(old.ageLine).toBe("numbers are 23 days old");
  });

  it("says what is left in plain words", () => {
    const p = earnProgress("youtube", [s("subscribers", 820), s("watch_hours_12m", 100), s("uploads_90d", 3)], now);
    expect(p.lead.id).toBe("early");
    expect(p.next).toBe("2,900 more YouTube public watch hours to unlock the early tier");
  });
});

describe("attentionItems", () => {
  const row = (platform: "youtube" | "tiktok", snaps: Snap[]) => ({ platform, progress: earnProgress(platform, snaps, now) });
  it("ranks eligible first, then stale, caps the list, and groups blank accounts", () => {
    const items = attentionItems([
      { channel: "A", rows: [row("youtube", [s("subscribers", 1000), s("watch_hours_12m", 4000)])] },
      { channel: "B", rows: [row("tiktok", [s("followers", 9000, 30), s("views_30d", 90_000, 30)])] },
      { channel: "C", rows: [row("youtube", []), row("tiktok", [])] },
    ]);
    expect(items[0].kind).toBe("eligible");
    expect(items[1].text).toBe("Log your numbers: B's TikTok numbers are 30 days old");
    expect(items.some((i) => i.text === "No numbers yet for C on YouTube and TikTok")).toBe(true);
    expect(items.at(-1)!.text).toBe("TikTok: only videos 60 s or longer earn");
    expect(items.length).toBeLessThanOrEqual(5);
  });
  it("is just the eligible line when every account is eligible", () => {
    const r = row("tiktok", [s("followers", 20_000), s("views_30d", 200_000)]);
    expect(attentionItems([{ channel: "A", rows: [r] }]).map((i) => i.kind)).toEqual(["eligible"]);
  });
});

describe("account snapshots in the database", () => {
  let db: DB, end: () => Promise<void>;
  beforeAll(async () => ({ db, end } = await freshDb()));
  afterAll(() => end());
  it("logs only filled boxes, rejects the wrong platform, and counts only manual rows", async () => {
    const { yt } = await channel(db);
    await expect(recordAccountMetrics(db, { destinationId: yt.id, values: {}, source: "manual" })).rejects.toThrow();
    await expect(recordAccountMetrics(db, { destinationId: yt.id, values: { followers: 5 }, source: "manual" })).rejects.toThrow();
    await recordAccountMetrics(db, { destinationId: yt.id, values: { subscribers: 820, watch_hours_12m: null }, source: "manual", at: ago(3) });
    await recordAccountMetrics(db, { destinationId: yt.id, values: { subscribers: 5000 }, source: "estimate" });
    expect(await db.select().from(S.accountSnapshots)).toHaveLength(2);
    const snaps = (await accountSnapshotsByDestination(db)).get(yt.id)!;
    const p = earnProgress("youtube", snaps, now);
    expect(p.tiers[0].reqs[0].value).toBe(820);
    expect(p.tiers[0].route!.value).toBeNull();
    await db.execute(sql`delete from account_snapshots`);
  });
});
