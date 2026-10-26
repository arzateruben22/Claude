import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { markHandedOff, markUploaded, mayAutoPublish, parsePostUrl, undoUploaded } from "../src/domain/publications";
import { onPublicationReported, channelXp } from "../src/domain/living";
import { approve } from "../src/domain/approvals";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

describe("post links", () => {
  it("accepts the platform's own links and pulls the post id", () => {
    expect(parsePostUrl("youtube", "https://youtube.com/shorts/abc_123-X")).toMatchObject({ ok: true, postId: "abc_123-X" });
    expect(parsePostUrl("youtube", "https://youtu.be/xyz")).toMatchObject({ ok: true, postId: "xyz" });
    expect(parsePostUrl("tiktok", "https://www.tiktok.com/@restframe/video/7312345678901234567")).toMatchObject({ ok: true, author: "restframe", postId: "7312345678901234567" });
    expect(parsePostUrl("instagram", "https://www.instagram.com/reel/C0abc/")).toMatchObject({ ok: true, postId: "C0abc" });
  });
  it("refuses other domains, look-alikes, plain http and junk", () => {
    expect(parsePostUrl("youtube", "https://www.tiktok.com/@a/video/1").ok).toBe(false);
    expect(parsePostUrl("youtube", "https://youtube.com.evil.example/shorts/a").ok).toBe(false);
    expect(parsePostUrl("tiktok", "http://www.tiktok.com/@a/video/1").ok).toBe(false);
    expect(parsePostUrl("instagram", "not a url").ok).toBe(false);
  });
});

describe("one record per destination", () => {
  it("YouTube marked uploaded never marks TikTok", async () => {
    const { pubs } = await renderedEpisode(db);
    await markUploaded(db, pubs.youtube.id, { postUrl: "https://youtube.com/shorts/abc" });
    const [yt] = await db.select().from(S.publications).where(eq(S.publications.id, pubs.youtube.id));
    const [tt] = await db.select().from(S.publications).where(eq(S.publications.id, pubs.tiktok.id));
    expect(yt.status).toBe("owner_reported");
    expect(yt.evidence).toBe("owner_reported");
    expect(tt.status).toBe("planned");
  });
  it("handing off (download/share/open) is not a publication", async () => {
    const { pubs, exports, tt } = await renderedEpisode(db);
    await approve(db, { exportId: exports.tiktok.id, destinationId: tt.id });
    const p = await markHandedOff(db, pubs.tiktok.id);
    expect(p.status).toBe("handed_off");
    expect(p.reportedAt).toBeNull();
  });
  it("hand-off without approval is ignored", async () => {
    const { pubs } = await renderedEpisode(db);
    const p = await markHandedOff(db, pubs.tiktok.id);
    expect(p.status).toBe("planned");
    expect(p.handedOffAt).toBeNull();
  });
  it("a TikTok link from another account is refused", async () => {
    const { pubs, tt } = await renderedEpisode(db);
    await db.update(S.destinations).set({ handle: "@restframe" }).where(eq(S.destinations.id, tt.id));
    await expect(markUploaded(db, pubs.tiktok.id, { postUrl: "https://www.tiktok.com/@someoneelse/video/123" })).rejects.toThrow(/belongs to @someoneelse/);
  });
  it("a simulated publication can't be marked uploaded", async () => {
    const { pubs } = await renderedEpisode(db);
    await db.update(S.publications).set({ simulated: true }).where(eq(S.publications.id, pubs.youtube.id));
    await expect(markUploaded(db, pubs.youtube.id, {})).rejects.toThrow(/simulated/);
  });
  it("an automated publisher refuses once the owner posted, and when external actions are stopped", async () => {
    const { pubs } = await renderedEpisode(db);
    const p = await markUploaded(db, pubs.youtube.id, {});
    expect(mayAutoPublish({ ...p, method: "api" }, false)).toMatchObject({ ok: false });
    expect(mayAutoPublish({ ...pubs.tiktok, method: "api" }, true)).toMatchObject({ ok: false, reason: "external actions are stopped" });
    expect(mayAutoPublish({ ...pubs.tiktok, method: "api" }, false)).toMatchObject({ ok: true });
  });
  it("undo puts an owner report back on the desk", async () => {
    const { pubs } = await renderedEpisode(db);
    await markUploaded(db, pubs.youtube.id, { postUrl: "https://youtube.com/shorts/u" });
    const r = await undoUploaded(db, pubs.youtube.id);
    expect(r?.status).toBe("ready");
    expect(r?.postUrl).toBe("");
  });
  it("cross-posting one episode earns its publish XP once, and First Light unlocks once", async () => {
    const { pubs, c } = await renderedEpisode(db, "space");
    const before = (await channelXp(db, c.id)).xp;
    for (const p of [pubs.youtube, pubs.tiktok]) { await markUploaded(db, p.id, {}); await onPublicationReported(db, p.id); await onPublicationReported(db, p.id); }
    const xp = (await channelXp(db, c.id)).xp - before;
    expect(xp).toBe(60 + 10 + 10 + 100);   // publish once, placement per destination, First Light once (studio-wide)
    const [rule] = await db.select().from(S.milestoneRules).where(eq(S.milestoneRules.key, "first_published"));
    expect((await db.select().from(S.achievementEvents).where(eq(S.achievementEvents.ruleId, rule.id))).length).toBe(1);
  });
});
