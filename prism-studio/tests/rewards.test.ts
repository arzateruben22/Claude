import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, eq, S, sql } from "./helpers";
import type { DB } from "../src/db/client";
import { addFunding, claimReward, recordMetric, releaseReward, rewardBalances, setMonthlyCap, tryReserve } from "../src/domain/rewards";
import { markUploaded } from "../src/domain/publications";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());
beforeEach(async () => {
  await db.execute(sql`truncate table reward_ledger, rewards, achievement_events, metric_snapshots, xp_events restart identity cascade`);
  await db.update(S.rewardSettings).set({ monthlyCapCents: null });
});

async function postedPub() {
  const { pubs } = await renderedEpisode(db);
  await markUploaded(db, pubs.youtube.id, { postUrl: "https://youtube.com/shorts/m" });
  return pubs.youtube.id;
}
const rule = async (key: string) => (await db.select().from(S.milestoneRules).where(eq(S.milestoneRules.key, key)))[0];

describe("1M Club", () => {
  it("unlocks once; with no budget configured the reward waits for funding", async () => {
    const pub = await postedPub();
    const r1 = await recordMetric(db, { publicationId: pub, metric: "views", value: 1_000_500, source: "manual" });
    const r2 = await recordMetric(db, { publicationId: pub, metric: "views", value: 1_200_000, source: "manual" });
    const oneM = await rule("1m_club");
    expect(r1.unlocked.some((u) => u.ruleId === oneM.id)).toBe(true);
    expect(r2.unlocked.some((u) => u.ruleId === oneM.id)).toBe(false);
    const rewards = await db.select().from(S.rewards);
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ amountCents: 20_000, status: "pending_funding" });
  });
  it("a second post crossing a million never unlocks the studio-wide reward again", async () => {
    const a = await postedPub(), b = await postedPub();
    await recordMetric(db, { publicationId: a, metric: "views", value: 1_000_000, source: "api" });
    await recordMetric(db, { publicationId: b, metric: "views", value: 3_000_000, source: "api" });
    expect(await db.select().from(S.rewards)).toHaveLength(1);
  });
  it("reserves once the owner funds it within the monthly cap, and never more than the balance", async () => {
    const pub = await postedPub();
    await recordMetric(db, { publicationId: pub, metric: "views", value: 1_000_000, source: "manual" });
    await addFunding(db, { amountCents: 15_000 });
    await setMonthlyCap(db, 50_000);
    expect((await db.select().from(S.rewards))[0].status).toBe("pending_funding");   // $150 < $200
    await addFunding(db, { amountCents: 5_000 });
    expect((await db.select().from(S.rewards))[0].status).toBe("reserved");
    const b = await rewardBalances(db);
    expect(b).toMatchObject({ fundedCents: 20_000, reservedCents: 20_000, availableCents: 0, remainingMonthlyCents: 30_000 });
  });
  it("the monthly cap holds even with plenty of funds", async () => {
    const pub = await postedPub();
    await addFunding(db, { amountCents: 100_000 });
    await setMonthlyCap(db, 10_000);
    await recordMetric(db, { publicationId: pub, metric: "views", value: 1_000_000, source: "manual" });
    expect((await db.select().from(S.rewards))[0].status).toBe("pending_funding");
  });
  it("two concurrent reservations can't spend the same balance", async () => {
    await setMonthlyCap(db, 100_000);
    await addFunding(db, { amountCents: 20_000 });
    const oneM = await rule("1m_club"), ch = await rule("channel_1m");
    const evs = await db.insert(S.achievementEvents).values([{ ruleId: oneM.id, scopeKey: "studio" }, { ruleId: ch.id, scopeKey: "x" }]).returning();
    const rws = await db.insert(S.rewards).values(evs.map((e) => ({ achievementEventId: e.id, amountCents: 20_000 }))).returning();
    const results = await Promise.all(rws.map((r) => tryReserve(db, r.id)));
    expect(results.filter((x) => x === "reserved")).toHaveLength(1);
    expect((await rewardBalances(db)).availableCents).toBe(0);
  });
  it("demo and estimated numbers never create or reserve a real reward", async () => {
    const pub = await postedPub();
    await addFunding(db, { amountCents: 100_000 });
    await setMonthlyCap(db, 100_000);
    const d = await recordMetric(db, { publicationId: pub, metric: "views", value: 5_000_000, source: "demo" });
    const e = await recordMetric(db, { publicationId: pub, metric: "views", value: 5_000_000, source: "estimate" });
    expect(d.unlocked.every((u) => u.isDemo)).toBe(true);
    expect(e.unlocked).toHaveLength(0);
    expect(await db.select().from(S.rewards)).toHaveLength(0);
  });
  it("a number revised downward flags the unlock's evidence instead of unlocking again", async () => {
    const pub = await postedPub();
    await recordMetric(db, { publicationId: pub, metric: "views", value: 1_100_000, source: "api" });
    await recordMetric(db, { publicationId: pub, metric: "views", value: 900_000, source: "api" });
    const evs = await db.select().from(S.achievementEvents).where(eq(S.achievementEvents.publicationId, pub));
    expect(evs.length).toBeGreaterThan(0);
    expect(evs.every((e) => e.evidenceStatus === "flagged")).toBe(true);
  });
  it("only a reserved reward can be claimed; releasing returns it to the budget", async () => {
    const pub = await postedPub();
    await recordMetric(db, { publicationId: pub, metric: "views", value: 1_000_000, source: "manual" });
    const [r] = await db.select().from(S.rewards);
    await expect(claimReward(db, r.id, {})).rejects.toThrow(/reserved/);
    await setMonthlyCap(db, 50_000); await addFunding(db, { amountCents: 20_000 });
    await releaseReward(db, r.id);
    expect((await rewardBalances(db)).availableCents).toBe(20_000);
    await tryReserve(db, r.id);
    await claimReward(db, r.id, { description: "dinner" });
    const b = await rewardBalances(db);
    expect(b).toMatchObject({ claimedCents: 20_000, reservedCents: 0, availableCents: 0 });
  });
  it("rejects nonsense amounts and values", async () => {
    await expect(addFunding(db, { amountCents: -5 })).rejects.toThrow();
    await expect(addFunding(db, { amountCents: 10.5 })).rejects.toThrow();
    const pub = await postedPub();
    await expect(recordMetric(db, { publicationId: pub, metric: "views", value: -1, source: "manual" })).rejects.toThrow();
  });
});
