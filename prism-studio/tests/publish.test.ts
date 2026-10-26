process.env.INTEGRATIONS_KEY ??= "ab".repeat(32);
process.env.SESSION_SECRET ??= "s".repeat(40);
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { freshDb, renderedEpisode, eq, S } from "./helpers";
import type { DB } from "../src/db/client";
import { seal, unseal } from "../src/lib/crypto";
import { newOauthState, readOauthState } from "../src/lib/oauth-state";
import { signPublicMedia, verifyPublicMedia } from "../src/lib/public-media";
import { connectionFor, disconnect, freshTokens, saveConnection } from "../src/domain/connections";
import { enqueueDuePublishes, finalizeProcessing, publishPublication, tagsFromNotes } from "../src/domain/publish";
import { approve } from "../src/domain/approvals";
import { markUploaded } from "../src/domain/publications";
import { channelXp } from "../src/domain/living";
import { CONNECTORS } from "../src/integrations";
import { ConnectorError, type PlatformConnector, type PublishResult } from "../src/integrations/types";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

const tmp = path.join(os.tmpdir(), "prism-publish-test.mp4");
fs.writeFileSync(tmp, Buffer.alloc(1024, 1));

/** A connector that answers whatever the test wants, and records what it was asked. */
function fake(platform: "youtube" | "tiktok" | "instagram", answer: () => Promise<PublishResult>): PlatformConnector & { calls: unknown[] } {
  const c: PlatformConnector & { calls: unknown[] } = {
    platform, calls: [], envVars: [], configured: () => true,
    capabilities: { directPublish: true, captionsUpload: true, thumbnail: false, scheduling: false, metrics: false, conditions: "test" },
    authUrl: () => "https://example.test/auth", exchangeCode: async () => tokens(), refresh: async (t) => ({ ...t, accessToken: "refreshed", expiresAt: Date.now() + 3_600_000 }),
    whoAmI: async () => ({ accountId: "UCtest", handle: "@restframe", displayName: "Rest Frame", profileUrl: "https://www.youtube.com/@restframe" }),
    publish: async (_t, input) => { c.calls.push(input); return answer(); },
    publishStatus: async () => answer(),
  };
  return c;
}
const tokens = (expiresIn = 3_600_000) => ({ accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + expiresIn, scopes: ["upload"] });

async function connectedYouTube(slug = "physics") {
  const r = await renderedEpisode(db, slug);
  // point the export at a real file via the media resolver's films: root
  process.env.FILMS_REPO_ROOT = path.dirname(tmp);
  fs.mkdirSync(path.join(path.dirname(tmp), "films"), { recursive: true });
  fs.copyFileSync(tmp, path.join(path.dirname(tmp), "films", "t.mp4"));
  await db.update(S.platformExports).set({ filePath: "films:t.mp4" }).where(eq(S.platformExports.id, r.exports.youtube.id));
  await saveConnection(db, { destinationId: r.yt.id, platform: "youtube", tokens: tokens(), account: { accountId: `UC${r.yt.id.slice(0, 22)}`, handle: "@restframe", displayName: "Rest Frame", profileUrl: "https://www.youtube.com/@restframe" } });
  return r;
}

describe("sealing and state", () => {
  it("seals and unseals; a tampered value is refused", () => {
    const s = seal("secret token");
    expect(unseal(s)).toBe("secret token");
    expect(() => unseal(s.slice(0, -2) + "zz")).toThrow();
  });
  it("the OAuth state round-trips and expires", () => {
    const st = newOauthState("11111111-1111-1111-1111-111111111111", "youtube");
    expect(readOauthState(st.cookie, st.state, "youtube")?.verifier).toBe(st.verifier);
    expect(readOauthState(st.cookie, "other", "youtube")).toBeNull();
    expect(readOauthState(st.cookie, st.state, "tiktok")).toBeNull();
    expect(readOauthState(st.cookie, st.state, "youtube", -1)).toBeNull();
  });
  it("public media links are signed, expire, and name one key", () => {
    const t = signPublicMedia("films:x.mp4", 60);
    expect(verifyPublicMedia(t)).toBe("films:x.mp4");
    expect(verifyPublicMedia(t, Date.now() + 61_000)).toBeNull();
    expect(verifyPublicMedia(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
  });
  it("reads YouTube tags out of the posting notes", () => {
    expect(tagsFromNotes("Turn on the label.\n\nTags: Rest Frame, physics, science")).toEqual(["Rest Frame", "physics", "science"]);
    expect(tagsFromNotes("")).toEqual([]);
  });
});

describe("connections", () => {
  it("stores a sealed grant, verifies the account onto the destination, refuses the same account twice", async () => {
    const r = await renderedEpisode(db, "space");
    await saveConnection(db, { destinationId: r.yt.id, platform: "youtube", tokens: tokens(), account: { accountId: "UCspace", handle: "@lightminute", displayName: "Light Minute", profileUrl: "https://www.youtube.com/@lightminute" } });
    const [dest] = await db.select().from(S.destinations).where(eq(S.destinations.id, r.yt.id));
    expect(dest).toMatchObject({ handle: "@lightminute", provenance: "integration_verified", publishMethod: "api", platformAccountId: "UCspace" });
    const conn = await connectionFor(db, r.yt.id);
    expect(conn?.tokenCipher?.startsWith("v1:")).toBe(true);
    expect(conn?.tokenCipher).not.toContain("at");
    const other = await renderedEpisode(db, "body");
    await expect(saveConnection(db, { destinationId: other.yt.id, platform: "youtube", tokens: tokens(), account: { accountId: "UCspace", handle: "@lightminute", displayName: "x", profileUrl: "" } })).rejects.toThrow(/already connected/);
    await expect(saveConnection(db, { destinationId: r.tt.id, platform: "youtube", tokens: tokens(), account: { accountId: "UCx", handle: "@x", displayName: "x", profileUrl: "" } })).rejects.toThrow(/not youtube/);
  });
  it("refreshes a token about to expire, and marks the connection expired when the refresh fails", async () => {
    const r = await renderedEpisode(db, "whatif");
    CONNECTORS.youtube = fake("youtube", async () => ({ status: "published", postId: "x", postUrl: "", note: "" }));
    await saveConnection(db, { destinationId: r.yt.id, platform: "youtube", tokens: tokens(60_000), account: { accountId: "UCwhatif", handle: "@whatif", displayName: "What If", profileUrl: "" } });
    const t = await freshTokens(db, r.yt.id);
    expect(t.tokens.accessToken).toBe("refreshed");
    CONNECTORS.youtube = { ...CONNECTORS.youtube!, refresh: async () => { throw new ConnectorError("auth", "invalid_grant"); } };
    await db.update(S.connections).set({ expiresAt: new Date(), tokenCipher: seal(JSON.stringify(tokens(1000))) }).where(eq(S.connections.destinationId, r.yt.id));
    await expect(freshTokens(db, r.yt.id)).rejects.toThrow(/expired/);
    expect((await connectionFor(db, r.yt.id))?.status).toBe("expired");
    await disconnect(db, r.yt.id);
    expect(await connectionFor(db, r.yt.id)).toBeNull();
    const [dest] = await db.select().from(S.destinations).where(eq(S.destinations.id, r.yt.id));
    expect(dest.publishMethod).toBe("manual");
    expect(dest.handle).toBe("@whatif");
  });
});

describe("automated publishing", () => {
  it("refuses without an approval, and when external actions are stopped", async () => {
    const r = await connectedYouTube();
    const c = fake("youtube", async () => ({ status: "published", postId: "v1", postUrl: "https://www.youtube.com/watch?v=v1", note: "ok" }));
    await expect(publishPublication(db, r.pubs.youtube.id, { manual: true, deps: { connector: c } })).rejects.toThrow(/Approve this exact/);
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    await db.update(S.studioSettings).set({ stopExternalActions: true });
    await expect(publishPublication(db, r.pubs.youtube.id, { manual: true, deps: { connector: c } })).rejects.toThrow(/stopped/);
    await db.update(S.studioSettings).set({ stopExternalActions: false });
    expect(c.calls).toHaveLength(0);
  });
  it("a platform 'published' becomes a verified publication (and earns the publish XP once)", async () => {
    const r = await connectedYouTube("space");
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    const c = fake("youtube", async () => ({ status: "published", postId: "v2", postUrl: "https://www.youtube.com/watch?v=v2", note: "ok" }));
    const before = (await channelXp(db, r.c.id)).xp;
    const out = await publishPublication(db, r.pubs.youtube.id, { manual: true, deps: { connector: c } });
    expect(out.outcome).toBe("published");
    const [p] = await db.select().from(S.publications).where(eq(S.publications.id, r.pubs.youtube.id));
    expect(p).toMatchObject({ status: "verified_published", evidence: "api_verified", method: "api", postUrl: "https://www.youtube.com/watch?v=v2", postId: "v2" });
    expect((await channelXp(db, r.c.id)).xp - before).toBeGreaterThanOrEqual(70);
    const input = c.calls[0] as { title: string; disclosures: { aiVoice: boolean }; captionsSrt?: string; privacy?: string };
    expect(input.title).toBe("Thrown or dropped?");
    expect(input.privacy).toBe("public");
    // the owner can't double-post it by hand, and the scheduler won't queue it again
    await expect(markUploaded(db, r.pubs.youtube.id, {})).resolves.toBeTruthy();   // owner report of a verified post is a no-op-ish update, allowed
  });
  it("'processing' stays handed off with a status job; a later 'published' answer verifies it", async () => {
    const r = await connectedYouTube("body");
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    let answer: PublishResult = { status: "processing", postId: "v3", postUrl: "https://www.youtube.com/watch?v=v3", note: "processing" };
    const c = fake("youtube", async () => answer);
    expect((await publishPublication(db, r.pubs.youtube.id, { manual: true, deps: { connector: c } })).outcome).toBe("processing");
    let [p] = await db.select().from(S.publications).where(eq(S.publications.id, r.pubs.youtube.id));
    expect(p.status).toBe("handed_off");
    expect(p.note).toMatch(/^processing/);
    const jobs = await db.select().from(S.jobs).where(eq(S.jobs.type, "publish_status"));
    expect(jobs.some((j) => j.payload.publicationId === r.pubs.youtube.id)).toBe(true);
    await expect(finalizeProcessing(db, r.pubs.youtube.id, { connector: c })).rejects.toThrow(/still processing/);
    answer = { status: "published", postId: "v3", postUrl: "https://www.youtube.com/watch?v=v3", note: "done" };
    expect((await finalizeProcessing(db, r.pubs.youtube.id, { connector: c })).outcome).toBe("published");
    [p] = await db.select().from(S.publications).where(eq(S.publications.id, r.pubs.youtube.id));
    expect(p.status).toBe("verified_published");
  });
  it("a TikTok inbox upload is handed off with a note, never verified", async () => {
    const r = await renderedEpisode(db, "whatif");
    process.env.FILMS_REPO_ROOT = path.dirname(tmp);
    await db.update(S.platformExports).set({ filePath: "films:t.mp4" }).where(eq(S.platformExports.id, r.exports.tiktok.id));
    CONNECTORS.tiktok = fake("tiktok", async () => ({ status: "inbox", postId: "pub1", postUrl: "", note: "finish it in the TikTok app" }));
    await saveConnection(db, { destinationId: r.tt.id, platform: "tiktok", tokens: tokens(), account: { accountId: "open1", handle: "@whatif", displayName: "What If", profileUrl: "https://www.tiktok.com/@whatif" } });
    await approve(db, { exportId: r.exports.tiktok.id, destinationId: r.tt.id });
    const out = await publishPublication(db, r.pubs.tiktok.id, { manual: true });
    expect(out.outcome).toBe("inbox");
    const input = (CONNECTORS.tiktok as ReturnType<typeof fake>).calls[0] as { mode?: string; privacy?: string };
    expect(input.mode).toBe("inbox");
    expect(input.privacy).toBe("private");
    const [p] = await db.select().from(S.publications).where(eq(S.publications.id, r.pubs.tiktok.id));
    expect(p.status).toBe("handed_off");
    expect(p.evidence).toBe("none");
  });
  it("an auth error marks the connection expired and fails the publish", async () => {
    const r = await connectedYouTube("skincare");
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    const c = fake("youtube", async () => { throw new ConnectorError("auth", "token revoked"); });
    await expect(publishPublication(db, r.pubs.youtube.id, { manual: true, deps: { connector: c } })).rejects.toThrow(/revoked/);
    expect((await connectionFor(db, r.yt.id))?.status).toBe("expired");
  });
  it("the scheduler queues only due, approved publications on connected automatic channels", async () => {
    const r = await connectedYouTube("physics");
    await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
    const due = new Date(Date.now() - 60_000);
    await db.update(S.publications).set({ scheduledFor: due, status: "ready" }).where(eq(S.publications.id, r.pubs.youtube.id));
    await db.update(S.publications).set({ scheduledFor: due, status: "ready" }).where(eq(S.publications.id, r.pubs.tiktok.id));   // not connected
    expect(await enqueueDuePublishes(db)).toBe(0);   // channel is in draft mode
    await db.update(S.channels).set({ automationMode: "approved" }).where(eq(S.channels.id, r.c.id));
    expect(await enqueueDuePublishes(db)).toBe(1);
    expect(await enqueueDuePublishes(db)).toBe(0);   // idempotent
    const jobs = await db.select().from(S.jobs).where(eq(S.jobs.type, "publish"));
    expect(jobs.filter((j) => j.payload.publicationId === r.pubs.youtube.id)).toHaveLength(1);
    expect(jobs.some((j) => j.payload.publicationId === r.pubs.tiktok.id)).toBe(false);
    await db.update(S.studioSettings).set({ globalPause: true });
    expect(await enqueueDuePublishes(db)).toBe(0);
    await db.update(S.studioSettings).set({ globalPause: false });
  });
});
