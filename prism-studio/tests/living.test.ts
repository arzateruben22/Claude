import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, and, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { awardXp, channelXp, completeChallenge, evolve, levelFor, onPublicationReported, refreshEvolution, requirementsFor } from "../src/domain/living";
import { markUploaded } from "../src/domain/publications";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

it("XP is awarded once per idempotency key", async () => {
  const { c } = await renderedEpisode(db, "body");
  await Promise.all([1, 2, 3].map(() => awardXp(db, { channelId: c.id, kind: "test", amount: 50, key: "k1" })));
  expect((await channelXp(db, c.id)).xp).toBe(50);
  expect(levelFor(0)).toBe(1); expect(levelFor(50)).toBe(2); expect(levelFor(199)).toBe(2); expect(levelFor(200)).toBe(3);
});

describe("evolution", () => {
  it("can't evolve before it's earned", async () => {
    const { c } = await renderedEpisode(db, "space");
    await expect(evolve(db, c.id)).rejects.toThrow(/not been earned/);
  });
  it("the intro challenge can't be ticked until a sourced episode is really published", async () => {
    const { c } = await renderedEpisode(db, "whatif", { sourcesOk: false });
    const [intro] = await db.select().from(S.challenges).where(and(eq(S.challenges.channelId, c.id), eq(S.challenges.tier, "intro")));
    await expect(completeChallenge(db, intro.id, { note: "", by: "owner" })).rejects.toThrow(/Not yet/);
  });
  it("form 2: publish a sourced episode, finish the intro challenge, then Evolve exactly once", async () => {
    const { c, pubs } = await renderedEpisode(db, "physics");
    await markUploaded(db, pubs.youtube.id, {});
    await onPublicationReported(db, pubs.youtube.id);
    let reqs = await requirementsFor(db, c.id, 2);
    expect(reqs[0].met).toBe(true); expect(reqs[1].met).toBe(false);
    const [intro] = await db.select().from(S.challenges).where(and(eq(S.challenges.channelId, c.id), eq(S.challenges.tier, "intro")));
    await completeChallenge(db, intro.id, { note: "", by: "owner" });
    reqs = await requirementsFor(db, c.id, 2);
    expect(reqs.every((r) => r.met)).toBe(true);
    expect(await refreshEvolution(db, c.id)).toEqual([]);   // already recorded by completeChallenge
    const r = await evolve(db, c.id);
    expect(r).toMatchObject({ from: 1, toForm: 2 });
    await expect(evolve(db, c.id)).rejects.toThrow(/not been earned/);
    const [cr] = await db.select().from(S.creations).where(eq(S.creations.channelId, c.id));
    expect(cr.form).toBe(2);
  });
  it("evolving re-checks the requirements at the moment of evolving", async () => {
    const { c } = await renderedEpisode(db, "skincare");
    await db.update(S.creations).set({ form: 2 }).where(eq(S.creations.channelId, c.id));
    await db.insert(S.evolutions).values({ channelId: c.id, toForm: 3 });
    // requirements aren't met either: the re-check at the moment of evolving refuses
    await expect(evolve(db, c.id, { branch: "b" })).rejects.toThrow(/no longer met/);
  });
  it("owner-confirmed challenges need an evidence note", async () => {
    const { c } = await renderedEpisode(db, "body");
    const [adv] = await db.select().from(S.challenges).where(and(eq(S.challenges.channelId, c.id), eq(S.challenges.tier, "advanced")));
    await expect(completeChallenge(db, adv.id, { note: "  ", by: "owner" })).rejects.toThrow(/evidence/);
    expect((await completeChallenge(db, adv.id, { note: "diagram reviewed by Dr X", by: "owner" })).status).toBe("completed");
  });
});
