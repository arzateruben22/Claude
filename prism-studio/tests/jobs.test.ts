import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshDb, channel, eq, S, sql } from "./helpers";
import type { DB } from "../src/db/client";
import { claim, complete, enqueue, fail, heartbeat, recoverExpired, requestCancel, retry } from "../src/domain/jobs";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());
beforeEach(async () => { await db.execute(sql`truncate table jobs cascade`); });

describe("job queue", () => {
  it("an idempotency key enqueues once", async () => {
    const a = await enqueue(db, { type: "import_episodes", idempotencyKey: "k" });
    const b = await enqueue(db, { type: "import_episodes", idempotencyKey: "k" });
    expect(a.created).toBe(true); expect(b.created).toBe(false); expect(b.job.id).toBe(a.job.id);
  });
  it("is fair: a busy channel can't take every worker", async () => {
    const { c: a } = await channel(db, "physics"), { c: b } = await channel(db, "space");
    for (let i = 0; i < 3; i++) await enqueue(db, { type: "render", channelId: a.id, priority: 5 });
    await enqueue(db, { type: "render", channelId: b.id });
    const [j1, j2, j3] = await Promise.all([claim(db, "w1"), claim(db, "w2"), claim(db, "w3")]);
    const got = [j1, j2, j3].filter(Boolean).map((j) => j!.channelId);
    expect(got.sort()).toEqual([a.id, b.id].sort());   // one per channel; the third worker waits
  });
  it("filters by type, including several types", async () => {
    await enqueue(db, { type: "a" }); await enqueue(db, { type: "b" });
    expect((await claim(db, "w", { types: ["c", "b"] }))?.type).toBe("b");
  });
  it("retries with growing backoff, then dead-letters", async () => {
    await enqueue(db, { type: "x", maxAttempts: 2 });
    const j = (await claim(db, "w"))!;
    await fail(db, j.id, "w", "boom");
    let [row] = await db.select().from(S.jobs).where(eq(S.jobs.id, j.id));
    expect(row.status).toBe("queued");
    expect(+row.runAfter - Date.now()).toBeGreaterThan(20_000);
    await db.update(S.jobs).set({ runAfter: new Date(0) }).where(eq(S.jobs.id, j.id));
    await claim(db, "w");
    await fail(db, j.id, "w", "boom again");
    [row] = await db.select().from(S.jobs).where(eq(S.jobs.id, j.id));
    expect(row.status).toBe("dead");
    expect((await retry(db, j.id))?.status).toBe("queued");
  });
  it("a worker that loses its lease can't complete or heartbeat the job", async () => {
    await enqueue(db, { type: "x" });
    const j = (await claim(db, "w1", { leaseSeconds: 1 }))!;
    await db.update(S.jobs).set({ leaseUntil: new Date(Date.now() - 1000) }).where(eq(S.jobs.id, j.id));
    expect(await recoverExpired(db)).toBe(1);
    const again = (await claim(db, "w2"))!;
    expect(again.id).toBe(j.id);
    await expect(heartbeat(db, j.id, "w1")).rejects.toThrow(/no longer holds/);
    await complete(db, j.id, "w1");   // ignored: w1 isn't the holder
    expect((await db.select().from(S.jobs).where(eq(S.jobs.id, j.id)))[0].status).toBe("running");
  });
  it("cancels queued jobs at once and running jobs at their next heartbeat", async () => {
    const q = (await enqueue(db, { type: "x" })).job;
    await requestCancel(db, q.id);
    expect((await db.select().from(S.jobs).where(eq(S.jobs.id, q.id)))[0].status).toBe("cancelled");
    await enqueue(db, { type: "y" });
    const r = (await claim(db, "w"))!;
    await requestCancel(db, r.id);
    expect(await heartbeat(db, r.id, "w")).toBe(true);
  });
});
