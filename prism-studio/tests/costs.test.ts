import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { channel, freshDb, sql, S } from "./helpers";
import type { DB } from "../src/db/client";
import {
  addCost, anyChannelBudget, canUsePaidGeneration, costTotals, editCost, monthsBack, paidSwitch, parseMoney, setBudget, voidCost, type CostInput,
} from "../src/domain/costs";
import { addFunding, rewardBalances, setMonthlyCap } from "../src/domain/rewards";
import { createEpisode } from "../src/domain/episodes";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());
beforeEach(async () => {
  await db.execute(sql`truncate table cost_ledger, budgets, reward_ledger, rewards restart identity cascade`);
  await db.update(S.studioSettings).set({ timezone: "America/Los_Angeles", paidGenerationEnabled: true, stopExternalActions: false });
  await db.update(S.rewardSettings).set({ monthlyCapCents: null });
});

// 2026-10-20 12:00 in Los Angeles; the studio month is "2026-10"
const OCT = new Date("2026-10-20T19:00:00Z");
const cost = (v: Partial<CostInput>): CostInput => ({ description: "Narration", amountCents: 1000, incurredOn: "2026-10-12", source: "manual", category: "voice", ...v });

describe("money is whole cents, parsed as text", () => {
  it("reads amounts people type", () => {
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("19.99")).toBe(1999);
    expect(parseMoney("$1,234.56")).toBe(123456);
    expect(parseMoney(" 0.29 ")).toBe(29);   // 0.29 * 100 is 28.999… in floating point
  });
  it("refuses anything that isn't plain money", () => {
    for (const bad of ["", "12.345", "-5", "abc", "1e3", "12.", "1,23", "10000000.01"]) expect(() => parseMoney(bad)).toThrow();
  });
  it("lists months back across a year boundary", () => {
    expect(monthsBack("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("spent vs budget", () => {
  it("estimates are shown but never count as spent", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 5000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 1000 }));
    const est = await addCost(db, cost({ channelId: c.id, amountCents: 3000, source: "estimate" }));
    expect(est).toMatchObject({ source: "estimate", actualCents: null, estimateCents: 3000 });
    const s = (await costTotals(db, ["2026-10"])).scope(c.id, "2026-10");
    expect(s).toMatchObject({ spentCents: 1000, estimateCents: 3000, remainingCents: 4000, overCents: 0 });
  });

  it("a voided entry stays on the record and counts for nothing; it can't be edited or voided again", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 5000 });
    const e = await addCost(db, cost({ channelId: c.id, amountCents: 2500 }));
    await voidCost(db, e.id, "entered twice");
    const s = (await costTotals(db, ["2026-10"])).scope(c.id, "2026-10");
    expect(s.spentCents).toBe(0);
    expect(await db.select().from(S.costLedger)).toHaveLength(1);
    await expect(editCost(db, e.id, cost({ channelId: c.id }))).rejects.toThrow(/void/);
    await expect(voidCost(db, e.id, "again")).rejects.toThrow(/void/);
    await expect(voidCost(db, (await addCost(db, cost({}))).id, " ")).rejects.toThrow(/why/i);
  });

  it("editing an estimate into an actual cost makes it count", async () => {
    const { c } = await channel(db);
    const e = await addCost(db, cost({ channelId: c.id, amountCents: 700, source: "estimate" }));
    await editCost(db, e.id, cost({ channelId: c.id, amountCents: 650, source: "manual" }));
    const s = (await costTotals(db, ["2026-10"])).scope(c.id, "2026-10");
    expect(s).toMatchObject({ spentCents: 650, estimateCents: 0 });
  });

  it("the studio-wide total includes every channel and studio-level costs; a channel's only its own", async () => {
    const a = (await channel(db, "physics")).c, b = (await channel(db, "space")).c;
    await addCost(db, cost({ channelId: a.id, amountCents: 100 }));
    await addCost(db, cost({ channelId: b.id, amountCents: 200 }));
    await addCost(db, cost({ channelId: null, amountCents: 400 }));
    await addCost(db, cost({ channelId: a.id, amountCents: 800, incurredOn: "2026-09-30" }));
    const t = await costTotals(db, ["2026-09", "2026-10"]);
    expect(t.scope(null, "2026-10").spentCents).toBe(700);
    expect(t.scope(a.id, "2026-10").spentCents).toBe(100);
    expect(t.scope(a.id, "2026-09").spentCents).toBe(800);
  });

  it("a budget carries forward from its month until changed or ended", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-08", capCents: 10_000 });
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: null });
    const t = await costTotals(db, ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(t.scope(c.id, "2026-07").budget).toBeNull();
    expect(t.scope(c.id, "2026-09").budget?.capCents).toBe(10_000);
    expect(t.scope(c.id, "2026-10").budget).toBeNull();
    expect(t.scope(c.id, "2026-11").budget).toBeNull();
    // setting the same month again replaces it (one budget per scope per month)
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2_000 });
    expect((await db.select().from(S.budgets))).toHaveLength(2);
    expect((await costTotals(db, ["2026-11"])).scope(c.id, "2026-11").budget?.capCents).toBe(2_000);
  });

  it("costs in another currency aren't converted or counted against the budget", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 5000, currency: "USD" });
    await addCost(db, cost({ channelId: c.id, amountCents: 900, currency: "EUR" }));
    const s = (await costTotals(db, ["2026-10"])).scope(c.id, "2026-10");
    expect(s.spentCents).toBe(0);
    expect(s.unconverted).toEqual([{ currency: "EUR", cents: 900 }]);
  });

  it("an episode's cost belongs to its channel; a DEMO episode can't carry a real cost", async () => {
    const { c } = await channel(db, "physics");
    const other = (await channel(db, "space")).c;
    const ep = await createEpisode(db, { channelId: c.id, title: "Real one" });
    const e = await addCost(db, cost({ episodeId: ep.id }));
    expect(e.channelId).toBe(c.id);
    await expect(addCost(db, cost({ episodeId: ep.id, channelId: other.id }))).rejects.toThrow(/another channel/);
    const demo = await createEpisode(db, { channelId: c.id, title: "Demo one", isDemo: true });
    await expect(addCost(db, cost({ episodeId: demo.id }))).rejects.toThrow(/DEMO/);
  });

  it("refuses bad entries and leaves job-recorded costs alone", async () => {
    await expect(addCost(db, cost({ amountCents: 0 }))).rejects.toThrow(/above zero/);
    await expect(addCost(db, cost({ amountCents: 12.5 }))).rejects.toThrow(/whole cents/);
    await expect(addCost(db, cost({ currency: "BTC" }))).rejects.toThrow(/USD/);
    await expect(addCost(db, cost({ incurredOn: "2026-02-30" }))).rejects.toThrow(/date/);
    await expect(addCost(db, cost({ category: "dinner" }))).rejects.toThrow(/category/);
    const [job] = await db.insert(S.jobs).values({ type: "render" }).returning();
    const [row] = await db.insert(S.costLedger).values({ jobId: job.id, category: "render", source: "manual", actualCents: 100 }).returning();
    await expect(editCost(db, row.id, cost({}))).rejects.toThrow(/job/);
    await expect(voidCost(db, row.id, "no")).rejects.toThrow(/job/);
  });

  it("the database itself refuses an estimate that claims an actual amount", async () => {
    await expect(db.insert(S.costLedger).values({ category: "voice", source: "estimate", estimateCents: 100, actualCents: 100 })).rejects.toThrow();
    await expect(db.insert(S.costLedger).values({ category: "voice", source: "manual", actualCents: null })).rejects.toThrow();
  });
});

describe("canUsePaidGeneration(channelId, amount)", () => {
  it("stays off without a production budget for that channel, even with a studio-wide one", async () => {
    const { c } = await channel(db);
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: false, code: "no_budget" });
    await setBudget(db, { channelId: null, month: "2026-10", capCents: 100_000 });
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: false, code: "no_budget" });
    expect(await anyChannelBudget(db, OCT)).toBe(false);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    expect(await anyChannelBudget(db, OCT)).toBe(true);
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: true, code: "ok", remainingCents: 2000, currency: "USD" });
  });

  it("needs room for the whole amount; estimates don't use up room", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 1500 }));
    await addCost(db, cost({ channelId: c.id, amountCents: 9999, source: "estimate" }));
    expect(await canUsePaidGeneration(db, c.id, 500, OCT)).toMatchObject({ ok: true, remainingCents: 500 });
    expect(await canUsePaidGeneration(db, c.id, 501, OCT)).toMatchObject({ ok: false, code: "no_room", remainingCents: 500 });
  });

  it("a studio-wide budget is a ceiling over every channel", async () => {
    const a = (await channel(db, "physics")).c, b = (await channel(db, "space")).c;
    await setBudget(db, { channelId: a.id, month: "2026-10", capCents: 2000 });
    await setBudget(db, { channelId: null, month: "2026-10", capCents: 1700 });
    await addCost(db, cost({ channelId: a.id, amountCents: 1500 }));
    await addCost(db, cost({ channelId: b.id, amountCents: 150 }));
    expect(await canUsePaidGeneration(db, a.id, 50, OCT)).toMatchObject({ ok: true });
    expect(await canUsePaidGeneration(db, a.id, 100, OCT)).toMatchObject({ ok: false, code: "studio_no_room" });
  });

  it("is off when the Settings switch is off or external actions are stopped", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    await db.update(S.studioSettings).set({ paidGenerationEnabled: false });
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: false, code: "switch_off", remainingCents: 2000 });
    await db.update(S.studioSettings).set({ paidGenerationEnabled: true, stopExternalActions: true });
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: false, code: "stopped" });
  });

  it("the Settings switch: turning it on needs a channel budget; keeping it on never blocks the rest of the save", async () => {
    const { c } = await channel(db);
    const NOV = new Date("2026-11-01T17:00:00Z");   // Nov 1, 10:00 in Los Angeles
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    await setBudget(db, { channelId: c.id, month: "2026-11", capCents: null });   // the owner ended the budget from November
    expect(await anyChannelBudget(db, NOV)).toBe(false);
    // stored on (beforeEach): the owner presses Save on Nov 1 to stop external actions; the switch stays as it was
    const kept = await paidSwitch(db, true, NOV);
    expect(kept.on).toBe(true);
    expect(kept.notice).toMatch(/no channel has a production budget this month/);
    expect(await canUsePaidGeneration(db, c.id, 100, NOV)).toMatchObject({ ok: false, code: "no_budget" });   // and the gate still refuses
    // stored off: turning it on without a budget leaves it off, with a notice (the rest is still saved by the action)
    await db.update(S.studioSettings).set({ paidGenerationEnabled: false });
    expect(await paidSwitch(db, true, NOV)).toEqual({ on: false, notice: expect.stringMatching(/stays off until a channel has a production budget/) });
    expect(await paidSwitch(db, true, OCT)).toEqual({ on: true, notice: "" });
    expect(await paidSwitch(db, false, OCT)).toEqual({ on: false, notice: "" });
  });

  it("refuses amounts that aren't whole cents above zero", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    for (const amount of [0, -100, 12.5, Number.NaN]) expect(await canUsePaidGeneration(db, c.id, amount, OCT)).toMatchObject({ ok: false, code: "bad_amount" });
  });

  it("stays off while there are unconverted costs in another currency that month", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 2000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 100, currency: "GBP" }));
    expect(await canUsePaidGeneration(db, c.id, 100, OCT)).toMatchObject({ ok: false, code: "unconverted" });
  });

  it("uses the studio timezone's month: 23:00 on Oct 31 in Los Angeles is still October", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 1000 });
    await setBudget(db, { channelId: c.id, month: "2026-11", capCents: 1000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 1000, incurredOn: "2026-10-31" }));
    const lateOct = new Date("2026-11-01T06:00:00Z");    // Oct 31, 23:00 PDT
    const earlyNov = new Date("2026-11-01T08:00:00Z");   // Nov 1, 01:00 PDT
    expect(await canUsePaidGeneration(db, c.id, 100, lateOct)).toMatchObject({ ok: false, code: "no_room", month: "2026-10" });
    expect(await canUsePaidGeneration(db, c.id, 100, earlyNov)).toMatchObject({ ok: true, month: "2026-11", remainingCents: 1000 });
  });
});

describe("production budgets never mix with personal rewards", () => {
  it("costs and budgets leave the reward ledger and balances untouched", async () => {
    const { c } = await channel(db);
    await setMonthlyCap(db, 50_000);
    await addFunding(db, { amountCents: 30_000 });
    const before = await rewardBalances(db);
    const ledgerBefore = await db.select().from(S.rewardLedger);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 99_000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 12_345 }));
    const e = await addCost(db, cost({ channelId: c.id, amountCents: 500 }));
    await voidCost(db, e.id, "refunded");
    expect(await rewardBalances(db)).toEqual(before);
    expect(await db.select().from(S.rewardLedger)).toEqual(ledgerBefore);
  });

  it("reward money never adds room to a production budget", async () => {
    const { c } = await channel(db);
    await setBudget(db, { channelId: c.id, month: "2026-10", capCents: 1000 });
    await addCost(db, cost({ channelId: c.id, amountCents: 1000 }));
    await setMonthlyCap(db, 100_000);
    await addFunding(db, { amountCents: 100_000 });
    expect(await canUsePaidGeneration(db, c.id, 1, OCT)).toMatchObject({ ok: false, code: "no_room", remainingCents: 0 });
  });
});
