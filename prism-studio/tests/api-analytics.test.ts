process.env.INTEGRATIONS_KEY ??= "ab".repeat(32);
process.env.SESSION_SECRET ??= "s".repeat(40);
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { freshDb, renderedEpisode, S } from "./helpers";
import type { DB } from "../src/db/client";
import { seal } from "../src/lib/crypto";
import { connectionFor, saveConnection } from "../src/domain/connections";
import { cadenceDays, duePulls, enqueueDuePulls, isPullDue, pullMetrics, pullStates, requestPull, utcDay } from "../src/domain/api-analytics";
import { analyticsTotals } from "../src/domain/analytics";
import { enqueue } from "../src/domain/jobs";
import { CONNECTORS } from "../src/integrations";
import { ConnectorError, type Metrics, type PlatformConnector } from "../src/integrations/types";
import { NON_RETRYABLE, runHandler } from "../worker/handlers";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
const tokens = (expiresIn = 3_600_000) => ({ accessToken: "secret-access", refreshToken: "secret-refresh", expiresAt: Date.now() + expiresIn, scopes: ["readonly"] });

/** A connector that answers metrics with whatever the test wants and records which posts it was asked about. */
function fake(platform: "youtube" | "tiktok" | "instagram", answer: () => Promise<Metrics>, o: { metrics?: boolean } = {}): PlatformConnector & { asked: string[] } {
  const c: PlatformConnector & { asked: string[] } = {
    platform, asked: [], envVars: [], configured: () => true,
    capabilities: { directPublish: true, captionsUpload: false, thumbnail: false, scheduling: false, metrics: o.metrics ?? true, conditions: "test" },
    authUrl: () => "https://example.test/auth", exchangeCode: async () => tokens(),
    refresh: async (t) => ({ ...t, accessToken: "refreshed", expiresAt: Date.now() + 3_600_000 }),
    whoAmI: async () => ({ accountId: "x", handle: "@x", displayName: "x", profileUrl: "" }),
    publish: async () => { throw new Error("publishing is not part of these tests"); },
    ...(o.metrics === false ? {} : { metrics: async (_t, postId) => { c.asked.push(postId); return answer(); } }),
  };
  return c;
}
let numbers: Metrics = { views: 1200, likes: 40, comments: 5, retrievedAt: new Date().toISOString() };
let yt = fake("youtube", async () => numbers);
beforeEach(() => {
  numbers = { views: 1200, likes: 40, comments: 5, retrievedAt: new Date().toISOString() };
  yt = fake("youtube", async () => numbers);
  CONNECTORS.youtube = yt;
});

/** A real episode whose YouTube publication the platform verified `ageDays` ago, on a connected YouTube channel. */
async function verifiedPost(slug: string, o: { ageDays?: number; now?: Date; connect?: boolean } = {}) {
  const r = await renderedEpisode(db, slug, { title: `Post ${Math.random().toString(36).slice(2, 7)}` });
  const now = o.now ?? new Date();
  const verifiedAt = new Date(now.getTime() - (o.ageDays ?? 2) * DAY);
  const [p] = await db.update(S.publications).set({ status: "verified_published", verifiedAt, reportedAt: verifiedAt, postId: `vid-${r.ep.id.slice(0, 8)}`, postUrl: "https://www.youtube.com/watch?v=x", evidence: "api_verified", method: "api" })
    .where(eq(S.publications.id, r.pubs.youtube.id)).returning();
  if (o.connect !== false && !(await connectionFor(db, r.yt.id)))
    await saveConnection(db, { destinationId: r.yt.id, platform: "youtube", tokens: tokens(), account: { accountId: `UC${r.yt.id.slice(0, 22)}`, handle: `@${slug}`, displayName: slug, profileUrl: "" } });
  return { ...r, pub: p };
}
const apiRows = (publicationId: string) => db.select().from(S.metricSnapshots).where(and(eq(S.metricSnapshots.publicationId, publicationId), eq(S.metricSnapshots.source, "api")));
const pullJobs = async (publicationId: string) => (await db.select().from(S.jobs).where(eq(S.jobs.type, "pull_metrics"))).filter((j) => j.payload.publicationId === publicationId);
const clearPullJobs = () => db.delete(S.jobs).where(eq(S.jobs.type, "pull_metrics"));

describe("cadence", () => {
  const published = at("2026-09-01T12:00:00Z");
  it("is daily for the first 30 days after publication, then weekly", () => {
    expect(cadenceDays(published, at("2026-09-02T12:00:00Z"))).toBe(1);
    expect(cadenceDays(published, at("2026-10-01T11:59:00Z"))).toBe(1);   // 29 d 23 h 59 min
    expect(cadenceDays(published, at("2026-10-01T12:00:00Z"))).toBe(7);   // 30 days exactly
    expect(cadenceDays(published, at("2026-12-01T00:00:00Z"))).toBe(7);
  });
  it("counts whole UTC days since the last attempt", () => {
    expect(isPullDue({ publishedAt: published, lastAttemptAt: null }, at("2026-09-01T12:05:00Z"))).toBe(true);
    // daily: the same UTC day is not due again; just past midnight UTC is
    expect(isPullDue({ publishedAt: published, lastAttemptAt: at("2026-09-10T00:01:00Z") }, at("2026-09-10T23:59:00Z"))).toBe(false);
    expect(isPullDue({ publishedAt: published, lastAttemptAt: at("2026-09-10T23:59:00Z") }, at("2026-09-11T00:01:00Z"))).toBe(true);
  });
  it("switches from daily to weekly at 30 days", () => {
    const yesterday = (now: Date) => new Date(now.getTime() - DAY);
    const day29 = at("2026-09-30T12:00:00Z"), day31 = at("2026-10-02T12:00:00Z");
    expect(isPullDue({ publishedAt: published, lastAttemptAt: yesterday(day29) }, day29)).toBe(true);
    expect(isPullDue({ publishedAt: published, lastAttemptAt: yesterday(day31) }, day31)).toBe(false);
    const day45 = at("2026-10-16T12:00:00Z");
    expect(isPullDue({ publishedAt: published, lastAttemptAt: new Date(day45.getTime() - 6 * DAY) }, day45)).toBe(false);
    expect(isPullDue({ publishedAt: published, lastAttemptAt: new Date(day45.getTime() - 7 * DAY) }, day45)).toBe(true);
  });
});

describe("due selection", () => {
  it("queues verified real posts on connected destinations, once; never simulated, demo, unverified, unconnected or metric-less ones", async () => {
    const good = await verifiedPost("physics");
    const sim = await verifiedPost("physics");
    await db.update(S.publications).set({ simulated: true }).where(eq(S.publications.id, sim.pub.id));
    const demo = await verifiedPost("physics");
    await db.update(S.episodes).set({ isDemo: true }).where(eq(S.episodes.id, demo.ep.id));
    const reported = await verifiedPost("physics");
    await db.update(S.publications).set({ status: "owner_reported", evidence: "owner_reported" }).where(eq(S.publications.id, reported.pub.id));
    const unconnected = await verifiedPost("body", { connect: false });

    const due = (await duePulls(db)).map((t) => t.id);
    expect(due).toContain(good.pub.id);
    for (const p of [sim, demo, reported, unconnected]) expect(due).not.toContain(p.pub.id);
    // TikTok publications of the same episodes aren't verified or connected either
    expect(due).not.toContain(good.pubs.tiktok.id);

    const n = await enqueueDuePulls(db);
    expect(n).toBe(1);
    expect(await enqueueDuePulls(db)).toBe(0);   // already queued
    const [job] = await pullJobs(good.pub.id);
    expect(job).toMatchObject({ type: "pull_metrics", channelId: good.c.id, idempotencyKey: `pull_metrics:${good.pub.id}:${utcDay(new Date())}` });

    // a connector that can't read metrics makes nothing due
    await clearPullJobs();
    CONNECTORS.youtube = fake("youtube", async () => numbers, { metrics: false });
    expect((await duePulls(db)).map((t) => t.id)).not.toContain(good.pub.id);
    CONNECTORS.youtube = yt;
    // Stop external actions pauses pulls
    await db.update(S.studioSettings).set({ stopExternalActions: true });
    expect(await enqueueDuePulls(db)).toBe(0);
    await expect(requestPull(db, good.pub.id)).rejects.toThrow(/stopped/);
    await db.update(S.studioSettings).set({ stopExternalActions: false });
  });

  it("after a pull the post waits for its period: tomorrow while young, a week once 30 days old", async () => {
    await clearPullJobs();
    const now = new Date();
    const young = await verifiedPost("space", { ageDays: 3, now });
    const old = await verifiedPost("space", { ageDays: 40, now });
    for (const p of [young, old]) expect((await pullMetrics(db, p.pub.id, { now })).outcome).toBe("ok");
    const ids = (later: Date) => duePulls(db, later).then((ts) => ts.map((t) => t.id));
    expect(await ids(now)).not.toContain(young.pub.id);
    expect(await ids(new Date(now.getTime() + DAY))).toContain(young.pub.id);
    expect(await ids(new Date(now.getTime() + DAY))).not.toContain(old.pub.id);
    expect(await ids(new Date(now.getTime() + 6 * DAY))).not.toContain(old.pub.id);
    expect(await ids(new Date(now.getTime() + 7 * DAY))).toContain(old.pub.id);
  });
});

describe("pulling", () => {
  it("writes one API row per reported metric per UTC day; a re-pull that day updates it, the next day adds one", async () => {
    const day1 = new Date();
    const r = await verifiedPost("whatif", { now: day1 });
    const out = await pullMetrics(db, r.pub.id, { now: day1 });
    expect(out).toMatchObject({ outcome: "ok", written: ["views", "likes", "comments"] });
    expect(yt.asked).toEqual([r.pub.postId]);
    let rows = await apiRows(r.pub.id);
    expect(rows.map((x) => x.metric).sort()).toEqual(["comments", "likes", "views"]);   // no shares row: unavailable is never 0
    const views = rows.find((x) => x.metric === "views")!;
    expect(views).toMatchObject({ value: 1200, source: "api", utcDay: utcDay(day1), unit: "count", status: "ok" });
    expect(views.definition).toMatch(/YouTube/);
    expect(views.ageHours).toBeGreaterThan(47);

    // again the same day, with higher numbers: still one row per metric, now holding the new value
    numbers = { views: 1500, likes: 44, comments: 6, avg_view_duration_s: 21.5, retrievedAt: "" };
    const later = new Date(day1.getTime() + 60_000);
    await pullMetrics(db, r.pub.id, { now: later });
    rows = await apiRows(r.pub.id);
    expect(rows.filter((x) => x.metric === "views")).toHaveLength(1);
    expect(rows.find((x) => x.metric === "views")).toMatchObject({ value: 1500, retrievedAt: later });
    expect(rows.find((x) => x.metric === "avg_view_duration_s")).toMatchObject({ value: 21.5, unit: "seconds" });

    // two pulls racing on the same day still leave one row
    await Promise.all([pullMetrics(db, r.pub.id, { now: later }), pullMetrics(db, r.pub.id, { now: later })]);
    expect((await apiRows(r.pub.id)).filter((x) => x.metric === "views")).toHaveLength(1);

    // the next UTC day is a new row; the totals read the latest one
    numbers = { views: 2100, retrievedAt: "" };
    const day2 = new Date(day1.getTime() + DAY);
    await pullMetrics(db, r.pub.id, { now: day2 });
    rows = await apiRows(r.pub.id);
    expect(rows.filter((x) => x.metric === "views").map((x) => x.value).sort()).toEqual([1500, 2100]);
    const [pull] = await db.select().from(S.metricPulls).where(eq(S.metricPulls.publicationId, r.pub.id));
    expect(pull).toMatchObject({ lastOutcome: "ok", lastError: "", lastAttemptAt: day2, lastSuccessAt: day2 });
    expect((await analyticsTotals(db)).views).toBeGreaterThanOrEqual(2100);
  });

  it("API views unlock a milestone once, however often the day's row is re-pulled", async () => {
    const r = await verifiedPost("skincare");
    numbers = { views: 12_000, retrievedAt: "" };
    expect((await pullMetrics(db, r.pub.id)).unlocked).toBe(1);
    numbers = { views: 12_500, retrievedAt: "" };
    expect((await pullMetrics(db, r.pub.id)).unlocked).toBe(0);
    const [rule] = await db.select().from(S.milestoneRules).where(eq(S.milestoneRules.key, "views_10k"));
    const evs = await db.select().from(S.achievementEvents).where(eq(S.achievementEvents.ruleId, rule.id));
    expect(evs).toHaveLength(1);
    expect(evs[0].evidence).toMatchObject({ source: "api" });
  });

  it("an empty answer writes nothing and counts as the day's attempt", async () => {
    const r = await verifiedPost("body");
    numbers = { retrievedAt: "" };
    expect((await pullMetrics(db, r.pub.id)).outcome).toBe("empty");
    expect(await apiRows(r.pub.id)).toHaveLength(0);
    expect((await duePulls(db)).map((t) => t.id)).not.toContain(r.pub.id);
  });

  it("never pulls a simulated or demo publication, even when asked directly", async () => {
    const sim = await verifiedPost("physics");
    await db.update(S.publications).set({ simulated: true }).where(eq(S.publications.id, sim.pub.id));
    const demo = await verifiedPost("physics");
    await db.update(S.episodes).set({ isDemo: true }).where(eq(S.episodes.id, demo.ep.id));
    for (const p of [sim, demo]) {
      const out = await pullMetrics(db, p.pub.id);
      expect(out.outcome).toBe("skipped");
      await expect(requestPull(db, p.pub.id)).rejects.toThrow(/never pulled/);
      expect(await apiRows(p.pub.id)).toHaveLength(0);
    }
    expect(yt.asked).toEqual([]);
  });
});

describe("expired and failing connections", () => {
  it("an auth error marks the connection for reconnecting, stops pulls from it, and is not retried", async () => {
    await clearPullJobs();
    const a = await verifiedPost("whatif");
    const b = await verifiedPost("whatif");   // same channel, same YouTube destination
    yt = fake("youtube", async () => { throw new ConnectorError("auth", "Invalid Credentials. Reconnect the YouTube account."); });
    CONNECTORS.youtube = yt;
    const e = await pullMetrics(db, a.pub.id).catch((x) => x);
    expect(e.code).toBe("needs_reconnect");
    expect(NON_RETRYABLE.has(e.code)).toBe(true);
    expect((await connectionFor(db, a.yt.id))?.status).toBe("expired");
    const [pull] = await db.select().from(S.metricPulls).where(eq(S.metricPulls.publicationId, a.pub.id));
    expect(pull.lastOutcome).toBe("needs_reconnect");
    expect(pull.lastError).not.toContain("secret");

    // nothing else on that destination is queued or asked
    const due = (await duePulls(db)).map((t) => t.id);
    expect(due).not.toContain(a.pub.id);
    expect(due).not.toContain(b.pub.id);
    expect((await pullMetrics(db, b.pub.id)).outcome).toBe("skipped");
    expect(yt.asked).toHaveLength(1);
    await expect(requestPull(db, b.pub.id)).rejects.toThrow(/reconnect/);
    const states = await pullStates(db, [a.pub.id, b.pub.id]);
    expect(states.get(a.pub.id)?.blocked?.code).toBe("needs_reconnect");

    // reconnecting makes them due again
    await saveConnection(db, { destinationId: a.yt.id, platform: "youtube", tokens: tokens(), account: { accountId: `UC${a.yt.id.slice(0, 22)}`, handle: "@whatif", displayName: "What If", profileUrl: "" } });
    expect((await duePulls(db, new Date(Date.now() + DAY))).map((t) => t.id)).toEqual(expect.arrayContaining([a.pub.id, b.pub.id]));
  });

  it("a refresh that fails on an expiring token marks the connection expired without asking for metrics", async () => {
    const r = await verifiedPost("space");
    yt.refresh = async () => { throw new ConnectorError("auth", "invalid_grant"); };
    await db.update(S.connections).set({ tokenCipher: seal(JSON.stringify(tokens(60_000))), expiresAt: new Date(Date.now() + 60_000) }).where(eq(S.connections.destinationId, r.yt.id));
    await expect(pullMetrics(db, r.pub.id)).rejects.toMatchObject({ code: "needs_reconnect" });
    expect((await connectionFor(db, r.yt.id))?.status).toBe("expired");
    expect(yt.asked).toEqual([]);
  });

  it("network trouble is retried by the queue; a rejected post is not", async () => {
    const r = await verifiedPost("skincare");
    CONNECTORS.youtube = fake("youtube", async () => { throw new ConnectorError("network", "YouTube 503", true); });
    const net = await pullMetrics(db, r.pub.id).catch((x) => x);
    expect(net).toBeInstanceOf(ConnectorError);   // not a DomainError: the worker retries it with backoff
    CONNECTORS.youtube = fake("youtube", async () => { throw new ConnectorError("rejected", "video vid-x no longer exists on YouTube"); });
    const gone = await pullMetrics(db, r.pub.id).catch((x) => x);
    expect(gone.code).toBe("pull_failed");
    expect(NON_RETRYABLE.has(gone.code)).toBe(true);
    expect((await connectionFor(db, r.yt.id))?.status).toBe("connected");   // the grant is fine
    const [pull] = await db.select().from(S.metricPulls).where(eq(S.metricPulls.publicationId, r.pub.id));
    expect(pull).toMatchObject({ lastOutcome: "failed", lastSuccessAt: null });
    expect((await duePulls(db)).map((t) => t.id)).not.toContain(r.pub.id);   // the failed attempt was today's
  });
});

describe("refresh now and the worker job", () => {
  it("queues one pull for the post, not two, and the job writes API rows", async () => {
    await clearPullJobs();
    const r = await verifiedPost("body");
    const first = await requestPull(db, r.pub.id);
    expect(first.created).toBe(true);
    expect((await requestPull(db, r.pub.id)).created).toBe(false);   // already queued
    const [job] = await pullJobs(r.pub.id);
    expect(job.payload).toMatchObject({ publicationId: r.pub.id, manual: true });
    expect((await pullStates(db, [r.pub.id])).get(r.pub.id)).toMatchObject({ queued: true, blocked: null, cadenceDays: 1 });
    const result = await runHandler("pull_metrics", job, async () => true, db);
    expect(result).toMatchObject({ outcome: "ok", written: ["views", "likes", "comments"] });
    expect(await apiRows(r.pub.id)).toHaveLength(3);
    await expect(requestPull(db, r.pubs.tiktok.id)).rejects.toThrow(/verified/);
  });

  it("refuses posts that aren't connected", async () => {
    const r = await verifiedPost("physics", { connect: false });
    await db.delete(S.connections).where(eq(S.connections.destinationId, r.yt.id));
    await expect(requestPull(db, r.pub.id)).rejects.toThrow(/isn't connected/);
    const queued = await enqueue(db, { type: "pull_metrics", payload: { publicationId: r.pub.id } });
    expect((await runHandler("pull_metrics", queued.job, async () => true, db)).outcome).toBe("skipped");
    expect(await db.select().from(S.metricSnapshots).where(inArray(S.metricSnapshots.publicationId, [r.pub.id]))).toHaveLength(0);
  });
});
