process.env.INTEGRATIONS_KEY ??= "ab".repeat(32);   // connections in the "automatic slot" case seal their tokens
process.env.SESSION_SECRET ??= "s".repeat(40);
import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import webpush from "web-push";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, renderedEpisode, S } from "./helpers";
import type { DB } from "../src/db/client";
import { approve } from "../src/domain/approvals";
import { saveConnection } from "../src/domain/connections";
import { DomainError } from "../src/domain/core";
import { slotsForDate } from "../src/domain/schedule";
import { formatLocal, zonedTimeToUtc } from "../src/domain/time";
import {
  checkSubscription, dueUploads, endpointHash, listDevices, notifyDue, publishProblems, pushStatus, renewSubscription, resetPush,
  saveSubscription, sendTestNotification, unplannedInstagramSlots, vapidKeys, type PushSender,
} from "../src/domain/push";
import { seal } from "../src/lib/crypto";

let db: DB, end: () => Promise<void>;
beforeAll(async () => ({ db, end } = await freshDb()));
afterAll(() => end());

const MIN = 60_000, HOUR = 3_600_000;
const TZ = "America/Los_Angeles";
const ENV = { INTEGRATIONS_KEY: "cd".repeat(32), SESSION_SECRET: "x".repeat(40) };
const NOW = zonedTimeToUtc("2026-11-10", "08:00", TZ);   // a Tuesday morning in the studio's timezone

const b64u = (b: Buffer) => b.toString("base64url");
const browserSub = (host = "fcm.googleapis.com") => ({
  endpoint: `https://${host}/fcm/send/${b64u(randomBytes(12))}`,
  keys: { p256dh: b64u(Buffer.concat([Buffer.from([4]), randomBytes(64)])), auth: b64u(randomBytes(16)) },
});

/** A fake push service: records every send; `fail` maps an endpoint to the status it answers with. */
function fakeSender(fail: Record<string, number> = {}) {
  const sent: { endpoint: string; keys: { p256dh: string; auth: string }; payload: string; vapid: { publicKey: string; privateKey: string; subject: string }; ttl: number; urgency: Parameters<PushSender>[2]["urgency"]; topic?: string }[] = [];
  const send: PushSender = async (target, payload, o) => {
    const status = fail[target.endpoint];
    if (status) throw Object.assign(new Error(`Received unexpected response code ${status}`), { statusCode: status, endpoint: target.endpoint });
    sent.push({ endpoint: target.endpoint, keys: target.keys, payload, vapid: o.vapid, ttl: o.ttl, urgency: o.urgency, topic: o.topic });
    return { statusCode: 201 };
  };
  return { send, sent };
}

const clearPush = async () => {
  await db.delete(S.pushEvents);
  await db.delete(S.pushSubscriptions);
  await db.delete(S.pushKeys);
};
beforeEach(clearPush);

/** A real episode whose YouTube post is approved and planned `inMin` minutes after NOW, on a manual destination. */
async function dueEpisode(o: { inMin?: number; approved?: boolean; slug?: string } = {}) {
  const r = await renderedEpisode(db, o.slug ?? "physics", { title: `Due ${Math.random().toString(36).slice(2, 7)}` });
  const at = new Date(+NOW + (o.inMin ?? 20) * MIN);
  await db.update(S.publications).set({ scheduledFor: at, originalSlot: at }).where(eq(S.publications.id, r.pubs.youtube.id));
  if (o.approved !== false) await approve(db, { exportId: r.exports.youtube.id, destinationId: r.yt.id });
  return { ...r, at, pub: r.pubs.youtube };
}
const keysOf = (list: { publicationId: string | null }[]) => list.map((c) => c.publicationId);

describe("VAPID keys", () => {
  it("are made once, on first need, with the private key sealed under INTEGRATIONS_KEY", async () => {
    expect(await db.select().from(S.pushKeys)).toHaveLength(0);
    const a = await vapidKeys(db, ENV);
    expect(Buffer.from(a.publicKey, "base64url")).toHaveLength(65);
    expect(Buffer.from(a.privateKey, "base64url")).toHaveLength(32);
    const rows = await db.select().from(S.pushKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0].sealedWith).toBe("integrations");
    expect(rows[0].privateKeySealed).toMatch(/^v1:/);
    expect(rows[0].privateKeySealed).not.toContain(a.privateKey);
    const b = await vapidKeys(db, ENV);
    expect(b).toEqual(a);                                         // the same pair, not a new one
    expect(await db.select().from(S.pushKeys)).toHaveLength(1);
  });

  it("without INTEGRATIONS_KEY are sealed with a key derived from SESSION_SECRET, never stored in plain text", async () => {
    const env = { SESSION_SECRET: "y".repeat(40) };
    const a = await vapidKeys(db, env);
    const [row] = await db.select().from(S.pushKeys);
    expect(row.sealedWith).toBe("session");
    expect(row.privateKeySealed).toMatch(/^v1:/);
    expect(row.privateKeySealed).not.toContain(a.privateKey);
    expect(await vapidKeys(db, env)).toEqual(a);
    // platform tokens never take that fallback: they still need INTEGRATIONS_KEY
    expect(() => seal("token", env)).toThrow(/INTEGRATIONS_KEY/);
  });

  it("move under INTEGRATIONS_KEY once it is set, keeping the same pair", async () => {
    const a = await vapidKeys(db, { SESSION_SECRET: "y".repeat(40) });
    const b = await vapidKeys(db, { SESSION_SECRET: "y".repeat(40), INTEGRATIONS_KEY: "ef".repeat(32) });
    expect(b).toEqual(a);
    const [row] = await db.select().from(S.pushKeys);
    expect(row.sealedWith).toBe("integrations");
    expect(await vapidKeys(db, { INTEGRATIONS_KEY: "ef".repeat(32) })).toEqual(a);   // readable without SESSION_SECRET now
  });

  it("refuse with a clear message, and store nothing, when no secret can seal them", async () => {
    await expect(vapidKeys(db, {})).rejects.toMatchObject({ code: "push_unavailable" });
    await expect(vapidKeys(db, { SESSION_SECRET: "short" })).rejects.toThrow(/INTEGRATIONS_KEY/);
    expect(await db.select().from(S.pushKeys)).toHaveLength(0);
    expect((await pushStatus(db, {})).canSeal).toBe(false);
  });

  it("say so when the sealing secret changed, and a reset starts over without the old devices", async () => {
    await vapidKeys(db, ENV);
    await saveSubscription(db, browserSub(), "Phone");
    const other = { ...ENV, INTEGRATIONS_KEY: "01".repeat(32) };
    await expect(vapidKeys(db, other)).rejects.toMatchObject({ code: "push_key_unreadable" });
    expect((await pushStatus(db, other)).keys).toBe("unreadable");
    expect((await pushStatus(db, ENV)).keys).toBe("ok");
    // the worker skips (nothing claimed, nothing sent) instead of failing every minute
    const fake = fakeSender();
    expect((await notifyDue(db, { env: other, sender: fake.send, now: NOW })).skipped).toMatch(/can't be opened/);
    expect(await db.select().from(S.pushEvents)).toHaveLength(0);
    expect(await resetPush(db)).toBe(1);
    expect(await db.select().from(S.pushKeys)).toHaveLength(0);
    expect(await db.select().from(S.pushSubscriptions)).toHaveLength(0);
  });
});

describe("devices", () => {
  it("accept only a browser push service over https, with real keys", () => {
    expect(checkSubscription(browserSub()).service).toBe("Google");
    expect(checkSubscription(browserSub("web.push.apple.com")).service).toBe("Apple");
    expect(checkSubscription(browserSub("updates.push.services.mozilla.com")).service).toBe("Mozilla");
    const s = browserSub();
    expect(() => checkSubscription({ ...s, endpoint: s.endpoint.replace("https:", "http:") })).toThrow(DomainError);
    expect(() => checkSubscription({ ...s, endpoint: "https://169.254.169.254/latest/meta-data" })).toThrow(/known browser push service/);
    expect(() => checkSubscription({ ...s, endpoint: "https://fcm.googleapis.com.evil.example/x" })).toThrow(/known browser push service/);
    expect(() => checkSubscription({ ...s, keys: { ...s.keys, p256dh: "short" } })).toThrow(/encryption key/);
    expect(() => checkSubscription({ ...s, keys: { ...s.keys, auth: "" } })).toThrow(/auth secret/);
  });

  it("are one row per browser, and the list never carries an endpoint or a key", async () => {
    const s = browserSub();
    await saveSubscription(db, s, "Phone · Safari");
    await saveSubscription(db, s, "Renamed phone");
    const list = await listDevices(db);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("Renamed phone");
    expect(list[0].endpointHash).toBe(endpointHash(s.endpoint));
    const json = JSON.stringify(list);
    for (const secret of [s.endpoint, s.keys.p256dh, s.keys.auth]) expect(json).not.toContain(secret);
  });

  it("keep their name when the browser renews the subscription", async () => {
    const old = browserSub(), fresh = browserSub();
    await saveSubscription(db, old, "Desk Mac");
    await renewSubscription(db, { subscription: fresh, replaces: old.endpoint });
    const rows = await db.select().from(S.pushSubscriptions);
    expect(rows.map((r) => [r.endpoint, r.label])).toEqual([[fresh.endpoint, "Desk Mac"]]);
  });
});

describe("(a) upload due", () => {
  it("fires 30 minutes before a manual slot whose post is approved and ready", async () => {
    const r = await dueEpisode({ inMin: 20 });
    const [c] = (await dueUploads(db, NOW)).filter((x) => x.publicationId === r.pub.id);
    expect(c.kind).toBe("upload_due");
    expect(c.title).toBe(`Upload due: ${r.ep.title} → YouTube at ${formatLocal(r.at, TZ, { hour: "numeric", minute: "2-digit" })}`);
    expect(c.url).toBe(`/upload#task-${r.pub.id}`);
    expect(c.key).toBe(`upload_due:${r.pub.id}:${r.at.toISOString()}`);
  });

  it("waits until the slot is 30 minutes away, and lets go 15 minutes after it", async () => {
    const r = await dueEpisode({ inMin: 40 });
    expect(keysOf(await dueUploads(db, NOW))).not.toContain(r.pub.id);
    expect(keysOf(await dueUploads(db, new Date(+NOW + 10 * MIN)))).toContain(r.pub.id);
    expect(keysOf(await dueUploads(db, new Date(+r.at + 14 * MIN)))).toContain(r.pub.id);
    expect(keysOf(await dueUploads(db, new Date(+r.at + 16 * MIN)))).not.toContain(r.pub.id);
  });

  it("never fires for a post that isn't approved, is posted, simulated, demo, or published by the worker itself", async () => {
    const unapproved = await dueEpisode({ approved: false });
    const posted = await dueEpisode();
    await db.update(S.publications).set({ status: "owner_reported", reportedAt: NOW }).where(eq(S.publications.id, posted.pub.id));
    const simulated = await dueEpisode();
    await db.update(S.publications).set({ simulated: true }).where(eq(S.publications.id, simulated.pub.id));
    const demo = await dueEpisode();
    await db.update(S.episodes).set({ isDemo: true }).where(eq(S.episodes.id, demo.ep.id));
    // an "Approved"-mode channel with a connected YouTube: the worker uploads it, no reminder
    const auto = await dueEpisode({ slug: "space" });
    await saveConnection(db, { destinationId: auto.yt.id, platform: "youtube", tokens: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + HOUR, scopes: [] }, account: { accountId: "UCauto", handle: "@space", displayName: "space", profileUrl: "" } });
    await db.update(S.channels).set({ automationMode: "approved" }).where(eq(S.channels.id, auto.c.id));
    const fired = keysOf(await dueUploads(db, NOW));
    for (const r of [unapproved, posted, simulated, demo, auto]) expect(fired).not.toContain(r.pub.id);
    // the same connected channel in Draft mode is the owner's upload again
    await db.update(S.channels).set({ automationMode: "draft" }).where(eq(S.channels.id, auto.c.id));
    expect(keysOf(await dueUploads(db, NOW))).toContain(auto.pub.id);
  });

  it("stays quiet while publishing is paused or external actions are stopped", async () => {
    const r = await dueEpisode();
    for (const flag of ["globalPause", "stopExternalActions"] as const) {
      await db.update(S.studioSettings).set({ [flag]: true }).where(eq(S.studioSettings.id, 1));
      expect(keysOf(await dueUploads(db, NOW))).not.toContain(r.pub.id);
      await db.update(S.studioSettings).set({ [flag]: false }).where(eq(S.studioSettings.id, 1));
    }
    expect(keysOf(await dueUploads(db, NOW))).toContain(r.pub.id);
  });
});

describe("(b) a scheduled automatic publish that needs the owner", () => {
  async function apiPost(slug = "body") {
    const r = await renderedEpisode(db, slug, { title: `Auto ${Math.random().toString(36).slice(2, 7)}` });
    return { ...r, pub: r.pubs.tiktok };
  }
  const job = (publicationId: string, v: { type?: string; status: "dead" | "succeeded"; manual?: boolean; error?: string; at?: Date }) =>
    db.insert(S.jobs).values({
      type: v.type ?? "publish", status: v.status, payload: { publicationId, ...(v.manual ? { manual: true } : {}) },
      idempotencyKey: v.type === "publish_status" ? `publish_status:${publicationId}:x` : `publish:${publicationId}`,
      error: v.error ?? null, attempts: 3, updatedAt: v.at ?? new Date(+NOW - 10 * MIN),
    }).returning();

  it("fires when the scheduled publish gave up, with the reason", async () => {
    const r = await apiPost();
    const [j] = await job(r.pub.id, { status: "dead", error: "the export file is missing: films:x.mp4" });
    const [c] = (await publishProblems(db, NOW)).filter((x) => x.publicationId === r.pub.id);
    expect(c.kind).toBe("publish_failed");
    expect(c.title).toBe(`Publish failed: ${r.ep.title} → TikTok`);
    expect(c.body).toMatch(/^The export file is missing: films:x\.mp4\. Try again/);
    expect(c.key).toBe(`publish_failed:${j.id}:${j.updatedAt.toISOString()}`);
  });

  it("fires when the platform never finished processing a scheduled upload", async () => {
    const r = await apiPost();
    await job(r.pub.id, { status: "succeeded" });
    await job(r.pub.id, { type: "publish_status", status: "dead", error: "still processing on the platform" });
    const [c] = (await publishProblems(db, NOW)).filter((x) => x.publicationId === r.pub.id);
    expect(c.body).toMatch(/^TikTok never finished processing it/);
  });

  it("fires when a scheduled upload ended handed off (the TikTok inbox, a private upload), not while it's processing", async () => {
    const inbox = await apiPost(), priv = await apiPost(), processing = await apiPost();
    for (const [r, note] of [[inbox, "inbox: sent to the creator's inbox"], [priv, "private: uploaded as private"], [processing, "processing: still processing"]] as const) {
      await db.update(S.publications).set({ status: "handed_off", method: "api", handedOffAt: new Date(+NOW - 5 * MIN), note }).where(eq(S.publications.id, r.pub.id));
      await job(r.pub.id, { status: "succeeded" });
    }
    const list = await publishProblems(db, NOW);
    const of = (id: string) => list.find((x) => x.publicationId === id);
    expect(of(inbox.pub.id)?.body).toMatch(/in your TikTok inbox/);
    expect(of(inbox.pub.id)?.title).toBe(`Needs you: ${inbox.ep.title} → TikTok`);
    expect(of(priv.pub.id)?.body).toMatch(/went up as private/);
    expect(of(processing.pub.id)).toBeUndefined();
  });

  it("stays quiet for the owner's own Publish now, old events, and posts that are already up", async () => {
    const manual = await apiPost(), old = await apiPost(), fixed = await apiPost(), handedManual = await apiPost();
    await job(manual.pub.id, { status: "dead", manual: true, error: "boom" });
    await job(old.pub.id, { status: "dead", error: "boom", at: new Date(+NOW - 7 * HOUR) });
    await job(fixed.pub.id, { status: "dead", error: "boom" });
    await db.update(S.publications).set({ status: "owner_reported", reportedAt: NOW }).where(eq(S.publications.id, fixed.pub.id));
    await db.update(S.publications).set({ status: "handed_off", method: "api", handedOffAt: new Date(+NOW - 5 * MIN), note: "inbox: x" }).where(eq(S.publications.id, handedManual.pub.id));
    await job(handedManual.pub.id, { status: "succeeded", manual: true });
    const fired = keysOf(await publishProblems(db, NOW));
    for (const r of [manual, old, fixed, handedManual]) expect(fired).not.toContain(r.pub.id);
  });
});

describe("(c) an Instagram slot passes with nothing planned", () => {
  const firstIgSlot = async (date: string) => (await slotsForDate(db, date)).filter((s) => s.kind === "instagram")[0];
  const slotKeys = (list: { key: string }[]) => list.map((c) => c.key);

  it("fires once the slot has passed and nothing is planned on it", async () => {
    const slot = await firstIgSlot("2026-11-12");
    const key = `instagram_unplanned:${slot.destinationId}:${slot.at.toISOString()}`;
    expect(slotKeys(await unplannedInstagramSlots(db, new Date(+slot.at - 5 * MIN)))).not.toContain(key);   // not yet
    const [c] = (await unplannedInstagramSlots(db, new Date(+slot.at + 10 * MIN))).filter((x) => x.key === key);
    expect(c.title).toBe(`Instagram slot passed: nothing planned at ${formatLocal(slot.at, TZ, { hour: "numeric", minute: "2-digit" })}`);
    expect(c.url).toBe("/calendar");
    expect(slotKeys(await unplannedInstagramSlots(db, new Date(+slot.at + 4 * HOUR)))).not.toContain(key);   // past the lookback
  });

  it("stays quiet when a post was planned on the slot, or publishing is paused", async () => {
    const slot = await firstIgSlot("2026-11-13");
    const key = `instagram_unplanned:${slot.destinationId}:${slot.at.toISOString()}`;
    const after = new Date(+slot.at + 10 * MIN);
    await db.update(S.studioSettings).set({ globalPause: true }).where(eq(S.studioSettings.id, 1));
    expect(slotKeys(await unplannedInstagramSlots(db, after))).not.toContain(key);
    await db.update(S.studioSettings).set({ globalPause: false }).where(eq(S.studioSettings.id, 1));
    const r = await renderedEpisode(db, "space", { title: "On the slot" });
    await db.insert(S.publications).values({ episodeId: r.ep.id, destinationId: slot.destinationId, exportId: r.exports.instagram.id, kind: "instagram", status: "planned", scheduledFor: slot.at });
    expect(slotKeys(await unplannedInstagramSlots(db, after))).not.toContain(key);
  });
});

describe("delivery", () => {
  it("does nothing while no device is registered", async () => {
    await dueEpisode();
    const fake = fakeSender();
    expect(await notifyDue(db, { env: ENV, sender: fake.send, now: NOW })).toMatchObject({ events: 0, skipped: "no devices" });
    expect(fake.sent).toHaveLength(0);
    expect(await db.select().from(S.pushEvents)).toHaveLength(0);
    expect(await db.select().from(S.pushKeys)).toHaveLength(0);   // and makes no key
  });

  it("notifies each event at most once per device, even when two workers tick together", async () => {
    const r = await dueEpisode();
    const phone = browserSub(), laptop = browserSub("updates.push.services.mozilla.com");
    await saveSubscription(db, phone, "Phone");
    await saveSubscription(db, laptop, "Laptop");
    const fake = fakeSender();
    const deps = { env: ENV, sender: fake.send, now: NOW };
    await Promise.all([notifyDue(db, deps), notifyDue(db, deps)]);
    await notifyDue(db, { ...deps, now: new Date(+NOW + 5 * MIN) });   // the next minute's tick: same event
    const mine = fake.sent.filter((s) => JSON.parse(s.payload).url === `/upload#task-${r.pub.id}`);
    expect(mine.map((s) => s.endpoint).sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    const [ev] = await db.select().from(S.pushEvents).where(eq(S.pushEvents.dedupeKey, `upload_due:${r.pub.id}:${r.at.toISOString()}`));
    expect(ev).toMatchObject({ kind: "upload_due", sent: 2, failed: 0, publicationId: r.pub.id });
    // a new slot is a new event: rescheduling the post reminds again
    const later = new Date(+r.at + 24 * HOUR);
    await db.update(S.publications).set({ scheduledFor: later }).where(eq(S.publications.id, r.pub.id));
    await notifyDue(db, { ...deps, now: new Date(+later - 20 * MIN) });
    expect(fake.sent.filter((s) => JSON.parse(s.payload).url === `/upload#task-${r.pub.id}`)).toHaveLength(4);
  });

  it("an event no device got, because the push service was down, is tried again on the next tick; once sent, never again", async () => {
    const r = await dueEpisode({ inMin: 25 });
    const phone = browserSub();
    await saveSubscription(db, phone, "Phone");
    const key = `upload_due:${r.pub.id}:${r.at.toISOString()}`;
    const mine = (f: ReturnType<typeof fakeSender>) => f.sent.filter((x) => JSON.parse(x.payload).url === `/upload#task-${r.pub.id}`);
    const down = fakeSender({ [phone.endpoint]: 503 });
    await notifyDue(db, { env: ENV, sender: down.send, now: NOW });
    expect(await db.select().from(S.pushEvents).where(eq(S.pushEvents.dedupeKey, key))).toHaveLength(0);   // claim released
    const [dev] = await db.select().from(S.pushSubscriptions);
    expect(dev.failureCount).toBeGreaterThan(0);
    const up = fakeSender();
    await notifyDue(db, { env: ENV, sender: up.send, now: new Date(+NOW + MIN) });   // the next minute: still inside the window
    expect(mine(up)).toHaveLength(1);
    const [ev] = await db.select().from(S.pushEvents).where(eq(S.pushEvents.dedupeKey, key));
    expect(ev).toMatchObject({ sent: 1, failed: 0 });
    await notifyDue(db, { env: ENV, sender: up.send, now: new Date(+NOW + 2 * MIN) });
    expect(mine(up)).toHaveLength(1);
  });

  it("sends only title, body, screen and tag, signed with the studio's key", async () => {
    await dueEpisode();
    await saveSubscription(db, browserSub(), "Phone");
    const fake = fakeSender();
    await notifyDue(db, { env: ENV, sender: fake.send, now: NOW });
    const keys = await vapidKeys(db, ENV);
    expect(fake.sent.length).toBeGreaterThan(0);
    for (const s of fake.sent) {
      expect(Object.keys(JSON.parse(s.payload)).sort()).toEqual(["body", "tag", "title", "url"]);
      expect(s.payload).not.toContain(keys.privateKey);
      expect(s.vapid.publicKey).toBe(keys.publicKey);
      expect(s.vapid.subject).toMatch(/^(mailto:|https:)/);
      expect(s.topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    }
  });

  it("hands web-push options it accepts: a JWT signed with the unsealed key and an encrypted payload (no network)", async () => {
    await dueEpisode();
    const browserKey = createECDH("prime256v1");
    browserKey.generateKeys();
    await saveSubscription(db, { endpoint: "https://fcm.googleapis.com/fcm/send/real-shape", keys: { p256dh: b64u(browserKey.getPublicKey()), auth: b64u(randomBytes(16)) } }, "Phone");
    const fake = fakeSender();
    await notifyDue(db, { env: ENV, sender: fake.send, now: NOW });
    const s = fake.sent[0];
    const req = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: s.keys }, s.payload, { vapidDetails: s.vapid, TTL: s.ttl, urgency: s.urgency, topic: s.topic });
    expect(req.body?.toString("latin1")).not.toContain("Upload due");                 // encrypted for the browser
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(req.headers.Authorization)!;
    expect(k).toBe((await vapidKeys(db, ENV)).publicKey);
    const [head, claims, sig] = jwt.split(".");
    const pub = Buffer.from(k, "base64url");
    const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({ aud: "https://fcm.googleapis.com", sub: s.vapid.subject });
  });

  it("deletes a device on 404 or 410, counts other failures, and resets the count on success", async () => {
    const gone = browserSub(), expired = browserSub(), flaky = browserSub();
    await saveSubscription(db, gone, "Old phone");
    await saveSubscription(db, expired, "Old laptop");
    await saveSubscription(db, flaky, "Tablet");
    const bad = fakeSender({ [gone.endpoint]: 410, [expired.endpoint]: 404, [flaky.endpoint]: 500 });
    const r = await sendTestNotification(db, { env: ENV, sender: bad.send, now: NOW });
    expect(r).toMatchObject({ devices: 3, sent: 0, failed: 1, removed: 2 });
    const left = await db.select().from(S.pushSubscriptions);
    expect(left.map((x) => x.label)).toEqual(["Tablet"]);
    expect(left[0]).toMatchObject({ failureCount: 1, lastError: "the push service answered 500" });
    expect(left[0].lastError).not.toContain(flaky.endpoint);
    await sendTestNotification(db, { env: ENV, sender: fakeSender().send, now: NOW });
    const [ok] = await db.select().from(S.pushSubscriptions);
    expect(ok.failureCount).toBe(0);
    expect(ok.lastSuccessAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("refuses a test with no device", async () => {
    await expect(sendTestNotification(db, { env: ENV, sender: fakeSender().send })).rejects.toMatchObject({ code: "no_devices" });
  });
});
