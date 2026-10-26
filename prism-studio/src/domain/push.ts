// Push notifications (Stage E): Prism tells the owner's devices when something needs them.
// - Keys: one VAPID pair, made the first time it's needed. The private key is sealed (lib/crypto: INTEGRATIONS_KEY,
//   or a key derived from SESSION_SECRET when that isn't set) and only ever unsealed server-side to sign a send.
//   Only the public key reaches a browser. With neither secret set, nothing is made and the owner is told why.
// - Devices: a browser's push subscription (endpoint + its keys), saved by the owner from Settings. The endpoint and
//   keys stay server-side; screens get a label, dates and a hash of the endpoint. A 404/410 from the push service
//   means the browser dropped it: the row is deleted. Other failures are counted until the next success.
// - Events, each notified at most once (push_events.dedupe_key, unique; inserted before sending, so two workers
//   can't both send it):
//   (a) upload due: 30 minutes before a manual slot whose post is approved and ready (the exact export, current render);
//   (b) a scheduled automatic publish that gave up (dead job) or ended handed off (inbox/private): it needs the owner;
//   (c) an Instagram slot that passed with nothing planned on it.
//   Never for demo or simulated posts. Pause publishing silences (a) and (c); Stop external actions silences (a)
//   (the desk's hand-off is off then). Nothing is computed while no device is registered.
import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, inArray, isNull, lte, ne, notLike } from "drizzle-orm";
import webpush from "web-push";
import type { DB } from "../db/client";
import { channels, connections, destinations, episodes, jobs, platformExports, publications, pushEvents, pushKeys, pushSubscriptions, versions } from "../db/schema";
import { audit, type Conn, DomainError, settings } from "./core";
import { currentApproval } from "./approvals";
import { slotsForDate } from "./schedule";
import { addDays, formatLocal, localDate } from "./time";
import { type Env, integrationsConfigured, keyFor, keyFrom, type KeySource, sealWithKey, unsealWithKey } from "../lib/crypto";

const PURPOSE = "push-vapid";
const MIN = 60_000;
export const UPLOAD_LEAD_MIN = 30;      // (a) fires 30 minutes before the slot…
export const UPLOAD_GRACE_MIN = 15;     // …or up to 15 minutes after it, if the worker was busy at the time
export const PROBLEM_LOOKBACK_H = 6;    // (b) failures and hand-offs from the last 6 hours
export const SLOT_LOOKBACK_H = 3;       // (c) Instagram slots that passed in the last 3 hours (before missed posts move)
const PLATFORM = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" } as const;
const POSTED = ["owner_reported", "scheduled_on_platform", "verified_published"];

export type Urgency = "very-low" | "low" | "normal" | "high";
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushSendOptions = { vapid: { subject: string; publicKey: string; privateKey: string }; ttl: number; urgency: Urgency; topic?: string; timeoutMs: number };
/** Delivers one encrypted payload to one browser. Throws on failure; a push-service answer carries `statusCode`. */
export type PushSender = (target: PushTarget, payload: string, o: PushSendOptions) => Promise<{ statusCode: number }>;
export type PushMessage = { title: string; body: string; url: string; tag: string; ttl: number; urgency: Urgency };
export type PushKind = "upload_due" | "publish_failed" | "publish_handed_off" | "instagram_unplanned";
export type PushCandidate = PushMessage & { key: string; kind: PushKind; publicationId: string | null };
export type PushDeps = { sender?: PushSender; env?: Env; now?: Date };

const UNAVAILABLE = "Notifications need a secret to seal their signing key: set INTEGRATIONS_KEY (openssl rand -hex 32) or SESSION_SECRET in .env.local. Nothing was stored.";

// ── keys ─────────────────────────────────────────────────────────────────────
type KeyRow = typeof pushKeys.$inferSelect;

function openPrivateKey(row: KeyRow, env: Env): string {
  const k = keyFrom(row.sealedWith as KeySource, PURPOSE, env);
  if (!k) throw new DomainError("push_key_unreadable", row.sealedWith === "integrations"
    ? "The notification signing key was sealed with INTEGRATIONS_KEY, which isn't set now. Set it again, or reset notifications (every device then turns them on again)."
    : "The notification signing key was sealed with a key from SESSION_SECRET, which isn't set now. Set it again, or reset notifications (every device then turns them on again).");
  try { return unsealWithKey(row.privateKeySealed, k); }
  catch { throw new DomainError("push_key_unreadable", `The notification signing key can't be opened: ${row.sealedWith === "integrations" ? "INTEGRATIONS_KEY" : "SESSION_SECRET"} changed since it was made. Reset notifications (every device then turns them on again).`); }
}

/** The studio's VAPID key pair, made (and sealed) the first time it's needed. Server-side only. */
export async function vapidKeys(d: DB, env: Env = process.env): Promise<{ publicKey: string; privateKey: string }> {
  let [row] = await d.select().from(pushKeys).where(eq(pushKeys.id, 1));
  if (!row) {
    const k = keyFor(PURPOSE, env);
    if (!k) throw new DomainError("push_unavailable", UNAVAILABLE);
    const pair = webpush.generateVAPIDKeys();
    const [made] = await d.insert(pushKeys).values({ id: 1, publicKey: pair.publicKey, privateKeySealed: sealWithKey(pair.privateKey, k.key), sealedWith: k.source })
      .onConflictDoNothing().returning({ id: pushKeys.id });
    if (made) await audit(d, "system", "push.keys_created", "push_keys", "1", { sealedWith: k.source });
    [row] = await d.select().from(pushKeys).where(eq(pushKeys.id, 1));   // another process may have made it first
  }
  const privateKey = openPrivateKey(row, env);
  if (row.sealedWith === "session" && integrationsConfigured(env)) {
    // INTEGRATIONS_KEY was added later: move the key under it (the same pair, so devices keep working)
    const k = keyFrom("integrations", PURPOSE, env)!;
    await d.update(pushKeys).set({ privateKeySealed: sealWithKey(privateKey, k), sealedWith: "integrations", updatedAt: new Date() })
      .where(and(eq(pushKeys.id, 1), eq(pushKeys.sealedWith, "session")));
    await audit(d, "system", "push.keys_resealed", "push_keys", "1", { sealedWith: "integrations" });
  }
  return { publicKey: row.publicKey, privateKey };
}

/** What the browser needs to subscribe: the public key only. */
export async function vapidPublicKey(d: DB, env: Env = process.env): Promise<string> {
  return (await vapidKeys(d, env)).publicKey;
}

export type PushStatus = { canSeal: boolean; keys: "none" | "ok" | "unreadable"; sealedWith: KeySource | null; problem: string };

/** For Settings: can notifications work here, and is the key readable? No secrets in the answer. */
export async function pushStatus(c: Conn, env: Env = process.env): Promise<PushStatus> {
  const canSeal = !!keyFor(PURPOSE, env);
  const [row] = await c.select().from(pushKeys).where(eq(pushKeys.id, 1));
  if (!row) return { canSeal, keys: "none", sealedWith: null, problem: canSeal ? "" : UNAVAILABLE };
  try { openPrivateKey(row, env); return { canSeal, keys: "ok", sealedWith: row.sealedWith as KeySource, problem: "" }; }
  catch (e) { return { canSeal, keys: "unreadable", sealedWith: row.sealedWith as KeySource, problem: (e as Error).message }; }
}

/** Start over: forget the key pair and every device (their subscriptions were made for the old public key). */
export async function resetPush(d: DB) {
  const n = await d.$count(pushSubscriptions);
  await d.delete(pushSubscriptions);
  await d.delete(pushKeys);
  await audit(d, "owner", "push.reset", "push_keys", "1", { devicesRemoved: n });
  return n;
}

/** VAPID "sub": who push services contact about misbehaving notifications. Safari needs a real one (PUSH_SUBJECT). */
export function vapidSubject(env: Env = process.env): string {
  const s = (env.PUSH_SUBJECT || "").trim();
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(s) || /^https:\/\/[^/\s]+/i.test(s)) return s;
  const origin = (env.PUBLIC_ORIGIN || "").trim().replace(/\/$/, "");
  if (/^https:\/\/[^/\s]+$/i.test(origin)) return origin;
  return "mailto:prism-studio@example.invalid";
}

// ── devices ──────────────────────────────────────────────────────────────────
// Only browser push services: an endpoint is a URL the worker POSTs to, so nothing else is accepted (no SSRF).
// The label is whose push service carries it (Google's serves Chrome, Android and most Chromium browsers).
const PUSH_SERVICES: [RegExp, string][] = [
  [/(^|\.)googleapis\.com$/i, "Google"],
  [/(^|\.)push\.services\.mozilla\.com$/i, "Mozilla"],
  [/(^|\.)push\.apple\.com$/i, "Apple"],
  [/(^|\.)notify\.windows\.com$/i, "Microsoft"],
];
const b64uBytes = (s: string) => (/^[A-Za-z0-9_-]+={0,2}$/.test(s) ? Buffer.from(s, "base64url") : Buffer.alloc(0));
export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

/** A subscription as the browser gave it (PushSubscription.toJSON()), checked: an https push-service endpoint and real keys. */
export function checkSubscription(v: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null }): { endpoint: string; p256dh: string; auth: string; service: string } {
  const bad = (why: string) => new DomainError("bad_subscription", `This browser's subscription can't be used: ${why}.`);
  const endpoint = typeof v.endpoint === "string" ? v.endpoint.trim() : "";
  let u: URL;
  try { u = new URL(endpoint); } catch { throw bad("no endpoint"); }
  if (u.protocol !== "https:" || endpoint.length > 2048 || u.username || u.password || u.port) throw bad("the endpoint isn't a plain https address");
  const service = PUSH_SERVICES.find(([re]) => re.test(u.hostname));
  if (!service) throw bad(`${u.hostname} isn't a known browser push service`);
  const p256dh = typeof v.keys?.p256dh === "string" ? v.keys.p256dh : "", auth = typeof v.keys?.auth === "string" ? v.keys.auth : "";
  const pk = b64uBytes(p256dh);
  if (pk.length !== 65 || pk[0] !== 4) throw bad("its encryption key is missing");
  if (b64uBytes(auth).length !== 16) throw bad("its auth secret is missing");
  return { endpoint, p256dh, auth, service: service[1] };
}

const cleanLabel = (label: string) => label.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60);

/** Save (or refresh) one device. The same browser saving again updates its row instead of adding a second. */
export async function saveSubscription(d: DB, sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null }, label: string) {
  const s = checkSubscription(sub);
  const name = cleanLabel(label) || `Device (${s.service})`;
  const [row] = await d.insert(pushSubscriptions).values({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, label: name })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: s.p256dh, auth: s.auth, label: name, failureCount: 0, lastError: "" } })
    .returning({ id: pushSubscriptions.id });
  await audit(d, "owner", "push.device_saved", "push_subscription", row.id, { label: name, service: s.service });
  return { id: row.id, label: name };
}

/** The browser replaced its subscription (pushsubscriptionchange in the service worker): keep the device's name. */
export async function renewSubscription(d: DB, v: { subscription: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null }; replaces?: string | null }) {
  const [old] = v.replaces ? await d.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, v.replaces)) : [];
  const saved = await saveSubscription(d, v.subscription, old?.label || "Renewed device");
  if (old && old.id !== saved.id) await d.delete(pushSubscriptions).where(eq(pushSubscriptions.id, old.id));
  return saved;
}

export async function removeSubscription(d: DB, id: string) {
  const [row] = await d.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id)).returning({ label: pushSubscriptions.label });
  if (row) await audit(d, "owner", "push.device_removed", "push_subscription", id, { label: row.label });
  return !!row;
}

/** "Turn off on this device": the browser names its own endpoint. */
export async function removeEndpoint(d: DB, endpoint: string) {
  const [row] = await d.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return row ? removeSubscription(d, row.id) : false;
}

/** For Settings: each device without its endpoint or keys. */
export async function listDevices(c: Conn) {
  const rows = await c.select().from(pushSubscriptions).orderBy(desc(pushSubscriptions.createdAt));
  return rows.map((r) => ({
    id: r.id, label: r.label, createdAt: r.createdAt, lastSuccessAt: r.lastSuccessAt, lastFailureAt: r.lastFailureAt,
    failureCount: r.failureCount, lastError: r.lastError, endpointHash: endpointHash(r.endpoint),
    service: PUSH_SERVICES.find(([re]) => { try { return re.test(new URL(r.endpoint).hostname); } catch { return false; } })?.[1] ?? "a browser",
  }));
}
export type PushDevice = Awaited<ReturnType<typeof listDevices>>[number];

export async function recentPushEvents(c: Conn, limit = 5) {
  return c.select({ id: pushEvents.id, kind: pushEvents.kind, title: pushEvents.title, url: pushEvents.url, sent: pushEvents.sent, failed: pushEvents.failed, createdAt: pushEvents.createdAt })
    .from(pushEvents).orderBy(desc(pushEvents.createdAt)).limit(limit);
}

// ── delivery ─────────────────────────────────────────────────────────────────
const statusOf = (e: unknown) => { const s = (e as { statusCode?: unknown })?.statusCode; return typeof s === "number" ? s : null; };
/** A failure, in words that never carry the endpoint or a key. */
function describe(e: unknown): string {
  const s = statusOf(e);
  if (s) return `the push service answered ${s}`;
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" ? `couldn't reach the push service (${code})` : "couldn't reach the push service";
}
const topicFor = (tag: string) => createHash("sha256").update(tag).digest("base64url").slice(0, 32);

/** Send one message to every device. 404/410 = the browser dropped the subscription: delete it. */
export async function sendToDevices(d: DB, msg: PushMessage, o: { sender: PushSender; vapid: { publicKey: string; privateKey: string }; env?: Env; now?: Date }) {
  const subs = await d.select().from(pushSubscriptions);
  const out = { devices: subs.length, sent: 0, failed: 0, removed: 0 };
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });
  const opts: PushSendOptions = { vapid: { subject: vapidSubject(o.env), ...o.vapid }, ttl: Math.max(60, Math.round(msg.ttl)), urgency: msg.urgency, topic: topicFor(msg.tag), timeoutMs: 10_000 };
  for (const s of subs) {
    const now = o.now ?? new Date();
    try {
      await o.sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, opts);
      await d.update(pushSubscriptions).set({ lastSuccessAt: now, failureCount: 0, lastError: "" }).where(eq(pushSubscriptions.id, s.id));
      out.sent++;
    } catch (e) {
      const status = statusOf(e);
      if (status === 404 || status === 410) {
        await d.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        await audit(d, "system", "push.device_gone", "push_subscription", s.id, { label: s.label, status });
        out.removed++;
      } else {
        await d.update(pushSubscriptions).set({ lastFailureAt: now, failureCount: s.failureCount + 1, lastError: describe(e) }).where(eq(pushSubscriptions.id, s.id));
        out.failed++;
      }
    }
  }
  return out;
}

async function defaultSender(): Promise<PushSender> {
  return (await import("../lib/push-sender")).webPushSender;
}

/** Settings → "Send a test notification". */
export async function sendTestNotification(d: DB, deps: PushDeps = {}) {
  const env = deps.env ?? process.env;
  if (!(await d.$count(pushSubscriptions))) throw new DomainError("no_devices", "No device gets notifications yet: press Notify this device first.");
  const vapid = await vapidKeys(d, env);
  const r = await sendToDevices(d, { title: "Test notification", body: "Prism Studio can reach this device. Upload reminders arrive 30 minutes before a manual slot.", url: "/settings#notifications", tag: "test", ttl: 300, urgency: "normal" },
    { sender: deps.sender ?? (await defaultSender()), vapid, env, now: deps.now });
  await audit(d, "owner", "push.test", "push_subscription", "", r);
  return r;
}

// ── the three triggers ───────────────────────────────────────────────────────
const time = (at: Date, tz: string) => formatLocal(at, tz, { hour: "numeric", minute: "2-digit" });

/** (a) Approved, ready posts on manual slots starting within 30 minutes (or up to 15 minutes ago). */
export async function dueUploads(c: Conn, now = new Date()): Promise<PushCandidate[]> {
  const s = await settings(c);
  if (s.globalPause || s.stopExternalActions) return [];
  const rows = await c.select({ p: publications, e: episodes, ch: channels, dest: destinations, x: platformExports, conn: connections.status })
    .from(publications)
    .innerJoin(episodes, eq(episodes.id, publications.episodeId)).innerJoin(channels, eq(channels.id, episodes.channelId))
    .innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .innerJoin(platformExports, eq(platformExports.id, publications.exportId)).innerJoin(versions, eq(versions.id, platformExports.versionId))
    .leftJoin(connections, eq(connections.destinationId, destinations.id))
    .where(and(inArray(publications.status, ["planned", "ready", "handed_off"]), isNull(publications.reportedAt), eq(publications.simulated, false),
      gte(publications.scheduledFor, new Date(+now - UPLOAD_GRACE_MIN * MIN)), lte(publications.scheduledFor, new Date(+now + UPLOAD_LEAD_MIN * MIN)),
      eq(episodes.isDemo, false), eq(channels.paused, false), eq(destinations.paused, false), eq(versions.superseded, false)));
  const out: PushCandidate[] = [];
  for (const r of rows) {
    // the worker publishes these itself (scheduled publishing on a connected account): not the owner's upload
    const automatic = r.dest.publishMethod === "api" && r.conn === "connected" && r.ch.automationMode === "approved";
    if (automatic || !(await currentApproval(c, r.x.id, r.dest.id))) continue;
    const at = r.p.scheduledFor!, platform = PLATFORM[r.dest.platform];
    out.push({
      key: `upload_due:${r.p.id}:${at.toISOString()}`, kind: "upload_due", publicationId: r.p.id,
      title: `Upload due: ${r.e.title} → ${platform} at ${time(at, s.timezone)}`,
      body: `${r.dest.handle || `${platform} (${r.ch.label})`}: the approved video and text are ready on the Upload Desk.`,
      url: `/upload#task-${r.p.id}`, tag: `pub-${r.p.id}`, ttl: (+at - +now) / 1000 + UPLOAD_GRACE_MIN * 60, urgency: "high",
    });
  }
  return out;
}

/** The scheduled publish job for a publication (the same key scheduled and "Publish now" jobs use). */
async function publishJob(c: Conn, publicationId: string) {
  const [j] = await c.select().from(jobs).where(eq(jobs.idempotencyKey, `publish:${publicationId}`));
  return j ?? null;
}
const firstSentence = (s: string | null) => (s ?? "").replace(/\s*\[lease expired[^\]]*\]/g, "").split(/(?<=[.!?])\s|\n/)[0].trim().replace(/[.:]$/, "").slice(0, 120);

/** (b) Scheduled automatic publishes that gave up, or ended handed off (in the inbox, private): the owner must step in. */
export async function publishProblems(c: Conn, now = new Date()): Promise<PushCandidate[]> {
  const since = new Date(+now - PROBLEM_LOOKBACK_H * 3_600_000);
  const out: PushCandidate[] = [];
  const pubInfo = async (publicationId: string) => {
    const [r] = await c.select({ p: publications, e: episodes, dest: destinations }).from(publications)
      .innerJoin(episodes, eq(episodes.id, publications.episodeId)).innerJoin(destinations, eq(destinations.id, publications.destinationId))
      .where(eq(publications.id, publicationId));
    return r ?? null;
  };
  // failures: the publish job (or its "still processing" follow-up) is dead
  const dead = await c.select().from(jobs).where(and(inArray(jobs.type, ["publish", "publish_status"]), eq(jobs.status, "dead"), gte(jobs.updatedAt, since)));
  for (const j of dead) {
    const publicationId = String(j.payload.publicationId ?? "");
    const pj = j.type === "publish" ? j : await publishJob(c, publicationId);
    if (!pj || pj.payload.manual === true) continue;   // the owner pressed Publish now: they're in the app
    const r = await pubInfo(publicationId);
    if (!r || r.e.isDemo || r.p.simulated || POSTED.includes(r.p.status) || r.p.status === "cancelled") continue;
    const platform = PLATFORM[r.dest.platform];
    const why = j.type === "publish_status" ? `${platform} never finished processing it` : firstSentence(j.error) || "the upload failed";
    out.push({
      key: `publish_failed:${j.id}:${j.updatedAt.toISOString()}`, kind: "publish_failed", publicationId,
      title: `Publish failed: ${r.e.title} → ${platform}`,
      body: `${why.charAt(0).toUpperCase()}${why.slice(1)}. Try again from the Upload Desk, or post it yourself and mark it uploaded.`,
      url: `/upload#task-${publicationId}`, tag: `pub-${publicationId}`, ttl: 12 * 3600, urgency: "high",
    });
  }
  // hand-offs: uploaded through the connection but not public (the TikTok inbox, a private upload)
  const handed = await c.select({ p: publications, e: episodes, dest: destinations }).from(publications)
    .innerJoin(episodes, eq(episodes.id, publications.episodeId)).innerJoin(destinations, eq(destinations.id, publications.destinationId))
    .where(and(eq(publications.status, "handed_off"), eq(publications.method, "api"), gte(publications.handedOffAt, since),
      notLike(publications.note, "processing:%"), eq(publications.simulated, false), eq(episodes.isDemo, false)));
  for (const r of handed) {
    const pj = await publishJob(c, r.p.id);
    if (!pj || pj.payload.manual === true) continue;
    const platform = PLATFORM[r.dest.platform];
    const body = r.p.note.startsWith("inbox:") ? `It's in your ${platform} inbox: finish posting it in the ${platform} app, then mark it uploaded.`
      : r.p.note.startsWith("private:") ? `It went up as private: make it public on ${platform}, then mark it uploaded.`
      : `The upload stopped short of published: finish it on ${platform}, then mark it uploaded.`;
    out.push({
      key: `publish_handed_off:${r.p.id}:${r.p.handedOffAt!.toISOString()}`, kind: "publish_handed_off", publicationId: r.p.id,
      title: `Needs you: ${r.e.title} → ${platform}`, body,
      url: `/upload#task-${r.p.id}`, tag: `pub-${r.p.id}`, ttl: 12 * 3600, urgency: "high",
    });
  }
  return out;
}

/** (c) Instagram slots that passed in the last few hours with nothing planned on them. */
export async function unplannedInstagramSlots(c: Conn, now = new Date()): Promise<PushCandidate[]> {
  const s = await settings(c);
  const today = localDate(now, s.timezone);
  const slots = [...(await slotsForDate(c, addDays(today, -1))), ...(await slotsForDate(c, today))]
    .filter((x) => x.kind === "instagram" && x.at <= now && +x.at >= +now - SLOT_LOOKBACK_H * 3_600_000);
  const out: PushCandidate[] = [];
  for (const slot of slots) {
    const [taken] = await c.select({ n: count() }).from(publications)
      .where(and(eq(publications.destinationId, slot.destinationId), eq(publications.scheduledFor, slot.at), ne(publications.status, "cancelled")));
    if (taken.n) continue;
    out.push({
      key: `instagram_unplanned:${slot.destinationId}:${slot.at.toISOString()}`, kind: "instagram_unplanned", publicationId: null,
      title: `Instagram slot passed: nothing planned at ${time(slot.at, s.timezone)}`,
      body: "Plan the week in Calendar so the next Instagram slot has a post.",
      url: "/calendar", tag: `ig-${slot.at.toISOString()}`, ttl: 2 * 3600, urgency: "normal",
    });
  }
  return out;
}

/** Everything that should notify right now (before dedupe). */
export async function pushCandidates(c: Conn, now = new Date()): Promise<PushCandidate[]> {
  return [...(await dueUploads(c, now)), ...(await publishProblems(c, now)), ...(await unplannedInstagramSlots(c, now))];
}

/**
 * The worker's minute tick: claim each new event (insert its dedupe key; a conflict means it was already notified)
 * and send it to every device. Nothing happens while no device is registered or the key can't be used. When no device
 * took it and at least one failed for a passing reason (the push service down, a timeout), the claim is released so
 * the next tick tries again while the event is still inside its window; once any device has it, it's never resent.
 */
export async function notifyDue(d: DB, deps: PushDeps = {}) {
  const now = deps.now ?? new Date(), env = deps.env ?? process.env;
  const out = { events: 0, sent: 0, failed: 0, removed: 0, skipped: "" };
  if (!(await d.$count(pushSubscriptions))) return { ...out, skipped: "no devices" };
  let vapid: { publicKey: string; privateKey: string };
  try { vapid = await vapidKeys(d, env); }
  catch (e) { if (e instanceof DomainError) return { ...out, skipped: e.message }; throw e; }
  const sender = deps.sender ?? (await defaultSender());
  for (const ev of await pushCandidates(d, now)) {
    const [claimed] = await d.insert(pushEvents).values({ dedupeKey: ev.key, kind: ev.kind, title: ev.title, body: ev.body, url: ev.url, publicationId: ev.publicationId })
      .onConflictDoNothing({ target: pushEvents.dedupeKey }).returning({ id: pushEvents.id });
    if (!claimed) continue;
    const r = await sendToDevices(d, ev, { sender, vapid, env, now });
    if (r.sent === 0 && r.failed > 0) await d.delete(pushEvents).where(eq(pushEvents.id, claimed.id));   // retry next tick
    else await d.update(pushEvents).set({ sent: r.sent, failed: r.failed }).where(eq(pushEvents.id, claimed.id));
    out.events++; out.sent += r.sent; out.failed += r.failed; out.removed += r.removed;
  }
  return out;
}

/** Housekeeping: event rows older than 90 days (far past every lookback window, so dedupe still holds). */
export async function prunePushEvents(d: DB, now = new Date()) {
  const r = await d.delete(pushEvents).where(lte(pushEvents.createdAt, new Date(+now - 90 * 86_400_000))).returning({ id: pushEvents.id });
  return r.length;
}
