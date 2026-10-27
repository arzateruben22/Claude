import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb, renderedEpisode, channel, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { addVersion, canTransition, createEpisode, editExport, transitionEpisode, upsertExport } from "../src/domain/episodes";
import { approve, currentApproval } from "../src/domain/approvals";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

describe("episode numbering", () => {
  it("hands out unique, consecutive numbers under concurrency", async () => {
    const { c } = await channel(db, "body");
    const eps = await Promise.all(Array.from({ length: 20 }, (_, i) => createEpisode(db, { channelId: c.id, title: `E${i}` })));
    expect(eps.map((e) => e.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("an imported number moves the counter past it", async () => {
    const { c } = await channel(db, "space");
    await createEpisode(db, { channelId: c.id, title: "imported", number: 7 });
    expect((await createEpisode(db, { channelId: c.id, title: "next" })).number).toBe(8);
  });
});

describe("state machine", () => {
  it("allows one step forward, any step back, and side states; never out of cancelled", () => {
    expect(canTransition("script", "fact_check")).toBe(true);
    expect(canTransition("script", "render")).toBe(false);
    expect(canTransition("render", "script")).toBe(true);
    expect(canTransition("published", "blocked")).toBe(true);
    expect(canTransition("cancelled", "idea")).toBe(false);
    expect(canTransition("blocked", "ready_for_review")).toBe(true);
    expect(canTransition("blocked", "published")).toBe(false);
  });
  it("rejects an illegal move", async () => {
    const { ep } = await renderedEpisode(db);
    await expect(transitionEpisode(db, ep.id, "published")).rejects.toThrow(/cannot move/);
  });
});

describe("approvals are bound to the exact export and account", () => {
  it("editing the caption withdraws the approval and sends the episode back to review", async () => {
    const { ep, yt, exports } = await renderedEpisode(db);
    await approve(db, { exportId: exports.youtube.id, destinationId: yt.id });
    await transitionEpisode(db, ep.id, "approved");
    expect(await currentApproval(db, exports.youtube.id, yt.id)).not.toBeNull();
    const r = await editExport(db, exports.youtube.id, { caption: "changed" });
    expect(r.revoked).toBe(1);
    expect(await currentApproval(db, exports.youtube.id, yt.id)).toBeNull();
    const [e] = await db.select().from(S.episodes).where(eq(S.episodes.id, ep.id));
    expect(e.state).toBe("ready_for_review");
  });
  it("an edit to one platform's text leaves the other platform's approval alone", async () => {
    const { yt, tt, exports } = await renderedEpisode(db);
    await approve(db, { exportId: exports.youtube.id, destinationId: yt.id });
    await approve(db, { exportId: exports.tiktok.id, destinationId: tt.id });
    await editExport(db, exports.tiktok.id, { hashtags: "#new" });
    expect(await currentApproval(db, exports.youtube.id, yt.id)).not.toBeNull();
    expect(await currentApproval(db, exports.tiktok.id, tt.id)).toBeNull();
  });
  it("a new render supersedes the old version: its approvals end and it can't be approved", async () => {
    const { ep, yt, exports } = await renderedEpisode(db);
    await approve(db, { exportId: exports.youtube.id, destinationId: yt.id });
    const v2 = await addVersion(db, { episodeId: ep.id, videoPath: "films:v2.mp4", sha256: "v2" });
    expect(v2.versionNo).toBe(2);
    expect(await currentApproval(db, exports.youtube.id, yt.id)).toBeNull();
    await expect(approve(db, { exportId: exports.youtube.id, destinationId: yt.id })).rejects.toThrow(/replaced/);
    const x2 = await upsertExport(db, { versionId: v2.id, platform: "youtube", filePath: "films:v2.mp4", fileSha256: "v2" });
    expect(await approve(db, { exportId: x2.id, destinationId: yt.id })).toBeTruthy();
  });
  it("a new file for an export (the YouTube 1440p version) withdraws its approval; other platforms keep theirs", async () => {
    const { yt, tt, exports, ver: version } = await renderedEpisode(db);
    await approve(db, { exportId: exports.youtube.id, destinationId: yt.id });
    await approve(db, { exportId: exports.tiktok.id, destinationId: tt.id });
    const same = await upsertExport(db, { versionId: version.id, platform: "youtube", filePath: exports.youtube.filePath, fileSha256: exports.youtube.fileSha256 });
    expect(same.id).toBe(exports.youtube.id);
    expect(await currentApproval(db, exports.youtube.id, yt.id)).not.toBeNull();       // the same file again changes nothing
    await upsertExport(db, { versionId: version.id, platform: "youtube", filePath: "films:ep-9x16-youtube.mp4", fileSha256: "yt1440" });
    expect(await currentApproval(db, exports.youtube.id, yt.id)).toBeNull();
    const [a] = await db.select().from(S.approvals).where(eq(S.approvals.exportId, exports.youtube.id));
    expect(a.revokedAt).not.toBeNull();
    expect(await currentApproval(db, exports.tiktok.id, tt.id)).not.toBeNull();
  });
  it("a TikTok export can't be approved for YouTube", async () => {
    const { yt, exports } = await renderedEpisode(db);
    await expect(approve(db, { exportId: exports.tiktok.id, destinationId: yt.id })).rejects.toThrow(/cannot be approved/);
  });
  it("moving an approved episode back to an earlier step withdraws its approvals", async () => {
    const { ep, yt, exports } = await renderedEpisode(db);
    await approve(db, { exportId: exports.youtube.id, destinationId: yt.id });
    await transitionEpisode(db, ep.id, "approved");
    await transitionEpisode(db, ep.id, "script");
    expect(await currentApproval(db, exports.youtube.id, yt.id)).toBeNull();
  });
});
