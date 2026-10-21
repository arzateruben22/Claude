/* global chrome */
/**
 * CareerQuest Job Tracker — background service worker (MV3, ES module).
 *
 * Responsibilities:
 *  - message hub for content scripts, popup and options page
 *  - settings (apiBaseUrl, token) in chrome.storage.local — the token is never logged
 *  - API client with timeouts, 401 (→ "unauthorized" connection state) and 429 handling
 *  - action badge per tab ("✓" tracked/sent, "!" confirmation pending, "…" applying)
 *  - offline queue of unsent captures with exponential backoff via chrome.alarms
 *
 * All decision logic lives in ./lib/*.js (pure, unit-testable); this file only
 * adapts it to chrome.* APIs.
 */

import { ALARM_QUEUE_RETRY, CAPTURE_KIND, CONFIDENCE, DEFAULT_SETTINGS, MSG, SESSION, STORAGE } from "./lib/constants.js";
import { createApiClient, isRetryable } from "./lib/api-client.js";
import { dueItems, enqueue, isExhausted, markFailed, nextAttemptAt, removeItem, replaceItem } from "./lib/queue.js";
import { buildCapturePayload, captureDedupeKey, decideAction, mergeWithLastJob } from "./lib/capture.js";
import { normalizeBaseUrl } from "./lib/url.js";

/* ----------------------------- storage ---------------------------------- */

const local = {
  /** @param {string} key */
  get: async (key) => (await chrome.storage.local.get(key))[key],
  /** @param {string} key @param {unknown} value */
  set: (key, value) => chrome.storage.local.set({ [key]: value }),
};
const session = {
  /** @param {string} key */
  get: async (key) => (await chrome.storage.session.get(key))[key],
  /** @param {string} key @param {unknown} value */
  set: (key, value) => chrome.storage.session.set({ [key]: value }),
};

/** @returns {Promise<{ apiBaseUrl: string, token: string }>} */
async function getSettings() {
  const stored = (await local.get(STORAGE.SETTINGS)) || {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

/* ----------------------------- logging ---------------------------------- */

/** Redacts bearer tokens / token fields before anything reaches the console. */
function redact(value) {
  if (typeof value === "string") return value.replace(/cqt_[A-Za-z0-9_-]+/g, "cqt_***");
  if (value && typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value, (k, v) => (k === "token" || k === "Authorization" ? "***" : v)));
    } catch {
      return "[object]";
    }
  }
  return value;
}
function log(...args) {
  console.debug("[CareerQuest]", ...args.map(redact));
}

/* ----------------------------- API -------------------------------------- */

const api = createApiClient({ fetchImpl: (...a) => fetch(...a), getSettings });

/** @param {Partial<{ status: string, user: object | null, error: string | null }>} patch */
async function setConnection(patch) {
  const prev = (await local.get(STORAGE.CONNECTION)) || { status: "disconnected" };
  const next = { ...prev, ...patch, checkedAt: Date.now() };
  await local.set(STORAGE.CONNECTION, next);
  return next;
}

/** Records the outcome of a failed API call on the connection state. */
async function noteApiError(err) {
  if (err?.code === "unauthorized") return setConnection({ status: "unauthorized", user: null, error: err.message });
  if (err?.code === "not_configured") return setConnection({ status: "disconnected", user: null, error: null });
  return setConnection({ error: err?.message || String(err) });
}

/**
 * Calls /me and updates the connection state.
 * @param {{ apiBaseUrl?: string, token?: string }} [override] test unsaved values
 */
async function testConnection(override) {
  const settings = override?.token ? { ...(await getSettings()), ...override } : undefined;
  try {
    const me = await api.me(settings);
    const user = { userId: me.userId, name: me.name, email: me.email, scopes: Array.isArray(me.scopes) ? me.scopes : [] };
    const connection = await setConnection({ status: "connected", user, error: null });
    return { ok: true, user, connection };
  } catch (err) {
    const connection = await noteApiError(err);
    return { ok: false, error: err.message, code: err.code, connection };
  }
}

/* ----------------------------- badge ------------------------------------ */

const BADGE = Object.freeze({
  none: { text: "", color: "#0b0e14" },
  tracked: { text: "✓", color: "#4cc9ff" },
  sent: { text: "✓", color: "#22c55e" },
  pending: { text: "!", color: "#f3c75b" },
  applying: { text: "…", color: "#6b7280" },
  queued: { text: "↻", color: "#f3c75b" },
});

/** @param {number} tabId @param {keyof typeof BADGE} state */
async function setBadge(tabId, state) {
  const b = BADGE[state] || BADGE.none;
  try {
    await chrome.action.setBadgeText({ tabId, text: b.text });
    if (b.text) await chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
  } catch {
    /* tab gone */
  }
}

/* ----------------------------- per-tab state ---------------------------- */

async function getMap(store, key) {
  return (await store.get(key)) || {};
}

/** Serialises read-modify-write cycles so concurrent handlers cannot clobber each other. */
let mutationLock = Promise.resolve();
function serialized(fn) {
  const run = mutationLock.then(fn, fn);
  mutationLock = run.catch(() => {});
  return run;
}

function patchMap(store, key, tabId, value) {
  return serialized(async () => {
    const map = await getMap(store, key);
    if (value === undefined) delete map[tabId];
    else map[tabId] = value;
    await store.set(key, map);
  });
}

const tabState = {
  getDetection: async (tabId) => (await getMap(session, SESSION.DETECTIONS))[tabId] || null,
  setDetection: (tabId, d) => patchMap(session, SESSION.DETECTIONS, tabId, d),
  getLastJob: async (tabId) => (await getMap(session, SESSION.LAST_JOB))[tabId] || null,
  setLastJob: (tabId, d) => patchMap(session, SESSION.LAST_JOB, tabId, d),
  getMatches: async (tabId) => (await getMap(session, SESSION.MATCHES))[tabId] || null,
  setMatches: (tabId, m) => patchMap(session, SESSION.MATCHES, tabId, m),
  getPending: async (tabId) => (await getMap(local, STORAGE.PENDING))[tabId] || null,
  setPending: (tabId, p) => patchMap(local, STORAGE.PENDING, tabId, p),
  async forget(tabId) {
    await Promise.all([this.setDetection(tabId, undefined), this.setLastJob(tabId, undefined), this.setMatches(tabId, undefined), this.setPending(tabId, undefined)]);
  },
};

/* ----------------------------- queue ------------------------------------ */

async function getQueue() {
  return (await local.get(STORAGE.QUEUE)) || [];
}

/**
 * @param {object} payload
 * @param {{ code?: string, message?: string, retryAfterSeconds?: number }} err why the direct send failed
 */
async function enqueueCapture(payload, err) {
  const { queue, item } = enqueue(await getQueue(), payload);
  const retryAfterMs = err?.retryAfterSeconds ? err.retryAfterSeconds * 1000 : undefined;
  const scheduled = replaceItem(queue, markFailed(item, { retryAfterMs, error: err?.message || err?.code }));
  await local.set(STORAGE.QUEUE, scheduled);
  await scheduleRetry(scheduled);
  log("queued capture", { kind: payload.kind, reason: err?.code, size: scheduled.length });
  return scheduled;
}

/** (Re)arms the retry alarm for the earliest due item, or clears it. */
async function scheduleRetry(queue) {
  const at = nextAttemptAt(queue);
  if (at == null) {
    await chrome.alarms.clear(ALARM_QUEUE_RETRY);
    return;
  }
  await chrome.alarms.create(ALARM_QUEUE_RETRY, { when: Math.max(at, Date.now() + 1000) });
}

/**
 * Attempts queued captures. `force` ignores per-item schedules (used by the alarm
 * and the popup's "Retry now").
 * @param {{ force?: boolean }} [opts]
 */
async function flushQueue(opts = {}) {
  let queue = await getQueue();
  if (!queue.length) {
    await chrome.alarms.clear(ALARM_QUEUE_RETRY);
    return { sent: 0, remaining: 0 };
  }
  const now = Date.now();
  const items = opts.force ? queue : dueItems(queue, now);
  let sent = 0;
  for (const item of items) {
    try {
      const res = await api.createCapture(item.payload);
      queue = removeItem(queue, item.id);
      sent++;
      log("queued capture sent", { action: res?.action });
    } catch (err) {
      if (err.code === "unauthorized" || err.code === "not_configured") {
        await noteApiError(err);
        break;
      }
      if (isRetryable(err)) {
        const retryAfterMs = err.retryAfterSeconds ? err.retryAfterSeconds * 1000 : undefined;
        const updated = markFailed(item, { retryAfterMs, error: err.message });
        queue = isExhausted(updated) ? removeItem(queue, item.id) : replaceItem(queue, updated);
        if (isExhausted(updated)) log("dropping capture after max attempts", { kind: item.payload.kind });
      } else {
        log("dropping capture rejected by server", { kind: item.payload.kind, error: err.message });
        queue = removeItem(queue, item.id);
      }
    }
  }
  await local.set(STORAGE.QUEUE, queue);
  await scheduleRetry(queue);
  return { sent, remaining: queue.length };
}

/**
 * Sends a capture now, queueing it when the API is unreachable, rate limited,
 * failing (5xx) or not yet connected.
 * @param {object} payload
 */
async function sendCapture(payload) {
  try {
    const response = await api.createCapture(payload);
    return { ok: true, response };
  } catch (err) {
    await noteApiError(err);
    if (isRetryable(err) || err.code === "unauthorized" || err.code === "not_configured") {
      const queue = await enqueueCapture(payload, err);
      return { ok: false, queued: true, error: err.message, code: err.code, queueLength: queue.length };
    }
    return { ok: false, queued: false, error: err.message, code: err.code };
  }
}

/* ----------------------------- lookup ----------------------------------- */

/** Asks CareerQuest for existing records matching the detection; caches per tab. */
async function refreshMatches(tabId, detection) {
  const settings = await getSettings();
  if (!settings.token || !detection?.url) return null;
  const connection = (await local.get(STORAGE.CONNECTION)) || {};
  if (connection.status === "unauthorized") return null;
  try {
    const data = await api.lookup({ url: detection.url, company: detection.company, title: detection.title, requisitionId: detection.requisitionId });
    const matches = Array.isArray(data?.matches) ? data.matches.slice(0, 10) : [];
    await tabState.setMatches(tabId, { url: detection.url, matches, at: Date.now() });
    if (connection.status !== "connected") await setConnection({ status: "connected", error: null });
    return matches;
  } catch (err) {
    await noteApiError(err);
    return null;
  }
}

/* ----------------------------- detections ------------------------------- */

/**
 * Handles a detection reported by a content script (or manual capture).
 * @param {number} tabId
 * @param {import("./lib/capture.js").Detection} detection
 * @param {{ passive?: boolean }} [opts] passive: store + lookup only, never auto-post or prompt
 */
async function onDetection(tabId, detection, opts = {}) {
  const lastJob = await tabState.getLastJob(tabId);
  if (detection.kind === "JOB_PAGE") await tabState.setLastJob(tabId, detection);
  const merged = detection.kind === "JOB_PAGE" ? detection : mergeWithLastJob(detection, lastJob);
  await tabState.setDetection(tabId, merged);
  const action = opts.passive ? (merged.kind ? "job_page" : "none") : decideAction(merged);
  log("detection", { tabId, kind: merged.kind, platform: merged.platform, confidence: merged.confidence, action });

  switch (action) {
    case "auto_confirm":
      await autoConfirm(tabId, merged);
      break;
    case "prompt":
      await tabState.setPending(tabId, { tabId, url: merged.url, reason: "needs_confirmation", detection: merged, createdAt: Date.now() });
      await setBadge(tabId, "pending");
      break;
    case "apply_started":
      await tabState.setPending(tabId, { tabId, url: merged.url, reason: "apply_started", detection: merged, createdAt: Date.now() });
      await setBadge(tabId, "applying");
      break;
    case "job_page": {
      await tabState.setPending(tabId, undefined);
      const matches = await refreshMatches(tabId, merged);
      await setBadge(tabId, matches && matches.length ? "tracked" : "none");
      break;
    }
    default: {
      const pending = await tabState.getPending(tabId);
      await setBadge(tabId, pending ? (pending.reason === "apply_started" ? "applying" : "pending") : "none");
    }
  }
  return merged;
}

/** Records a high-confidence confirmation page exactly once per page/sentence. */
async function autoConfirm(tabId, detection) {
  const payload = buildCapturePayload(detection, { kind: CAPTURE_KIND.CONFIRMATION_PAGE });
  const key = captureDedupeKey(payload);
  const sent = await getMap(session, SESSION.SENT);
  if (sent[key]) {
    await setBadge(tabId, "sent");
    return { ok: true, deduped: true };
  }
  sent[key] = Date.now();
  await session.set(SESSION.SENT, sent);
  await tabState.setPending(tabId, undefined);
  const result = await sendCapture(payload);
  await setBadge(tabId, result.ok ? "sent" : result.queued ? "queued" : "none");
  return result;
}

/**
 * Saves a capture for the tab's current detection (popup actions).
 * @param {{ tabId: number, kind: string, applicationId?: string, confidence?: number }} req
 */
async function saveCapture(req) {
  const tabId = Number(req.tabId);
  const pending = await tabState.getPending(tabId);
  const detection = (await tabState.getDetection(tabId)) || pending?.detection;
  if (!detection) throw new Error("No job detected on this tab yet.");
  const isUserConfirmation = req.kind === CAPTURE_KIND.MANUAL_CONFIRMATION;
  const payload = buildCapturePayload(detection, {
    kind: req.kind,
    applicationId: req.applicationId,
    confidence: isUserConfirmation ? CONFIDENCE.USER_ASSERTED : req.confidence,
  });
  if (isUserConfirmation) {
    payload.evidence.detectedBy = [...payload.evidence.detectedBy, "user-asserted"];
  }
  const result = await sendCapture(payload);
  if (isUserConfirmation || req.kind === CAPTURE_KIND.CONFIRMATION_PAGE) await tabState.setPending(tabId, undefined);
  if (result.ok) {
    await refreshMatches(tabId, detection);
    await setBadge(tabId, "sent");
  } else if (result.queued) {
    await setBadge(tabId, "queued");
  }
  return result;
}

/** Runs the platform detector if present, else injects the generic extractor (activeTab). */
async function manualDetect(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: MSG.DETECT_NOW });
    if (res?.detection) return onDetection(tabId, res.detection, { passive: true });
  } catch {
    /* no platform content script on this tab */
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content/common.js", "src/content/generic.js"] });
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (typeof window.__cqDetect === "function" ? window.__cqDetect() : null),
  });
  const detection = injected?.result;
  if (!detection) throw new Error("Could not read this page.");
  return onDetection(tabId, detection, { passive: true });
}

/* ----------------------------- popup state ------------------------------ */

async function getState(tabId) {
  const settings = await getSettings();
  const connection = (await local.get(STORAGE.CONNECTION)) || { status: settings.token ? "unknown" : "disconnected" };
  const detection = tabId != null ? await tabState.getDetection(tabId) : null;
  const matchEntry = tabId != null ? await tabState.getMatches(tabId) : null;
  const matches = matchEntry && detection && matchEntry.url === detection.url ? matchEntry.matches : null;
  const pending = tabId != null ? await tabState.getPending(tabId) : null;
  const queue = await getQueue();
  return {
    settings: { apiBaseUrl: settings.apiBaseUrl, hasToken: !!settings.token },
    connection: settings.token ? connection : { status: "disconnected" },
    detection,
    matches,
    pending,
    queue: { length: queue.length, nextAttemptAt: nextAttemptAt(queue) },
  };
}

/* ----------------------------- message hub ------------------------------ */

/**
 * @param {{ type: string, [k: string]: unknown }} msg
 * @param {chrome.runtime.MessageSender} sender
 */
async function handleMessage(msg, sender) {
  switch (msg.type) {
    case MSG.DETECTION: {
      const tabId = sender.tab?.id;
      if (tabId == null || !msg.detection) return { ignored: true };
      await onDetection(tabId, msg.detection);
      return {};
    }
    case MSG.GET_STATE:
      return getState(msg.tabId == null ? null : Number(msg.tabId));
    case MSG.SAVE_SETTINGS: {
      const apiBaseUrl = normalizeBaseUrl(msg.apiBaseUrl) || DEFAULT_SETTINGS.apiBaseUrl;
      const token = String(msg.token ?? "").trim();
      await local.set(STORAGE.SETTINGS, { apiBaseUrl, token });
      await setConnection({ status: token ? "unknown" : "disconnected", user: null, error: null });
      log("settings saved", { apiBaseUrl });
      if (token) await scheduleRetry(await getQueue());
      return { settings: { apiBaseUrl, hasToken: !!token } };
    }
    case MSG.TEST_CONNECTION:
      return testConnection(msg.apiBaseUrl || msg.token ? { apiBaseUrl: normalizeBaseUrl(msg.apiBaseUrl) || undefined, token: msg.token } : undefined);
    case MSG.LOOKUP: {
      const tabId = Number(msg.tabId);
      const detection = await tabState.getDetection(tabId);
      return { matches: detection ? await refreshMatches(tabId, detection) : null };
    }
    case MSG.SAVE_CAPTURE:
      return saveCapture(msg);
    case MSG.RESOLVE_PENDING: {
      const tabId = Number(msg.tabId);
      if (msg.confirmed) return saveCapture({ tabId, kind: CAPTURE_KIND.MANUAL_CONFIRMATION, applicationId: msg.applicationId });
      await tabState.setPending(tabId, undefined);
      await setBadge(tabId, "none");
      return { dismissed: true };
    }
    case MSG.MANUAL_DETECT:
      return { detection: await manualDetect(Number(msg.tabId)) };
    case MSG.FLUSH_QUEUE:
      return flushQueue({ force: true });
    case MSG.CLEAR_QUEUE:
      await local.set(STORAGE.QUEUE, []);
      await chrome.alarms.clear(ALARM_QUEUE_RETRY);
      return { cleared: true };
    case MSG.DISCONNECT: {
      const settings = await getSettings();
      await local.set(STORAGE.SETTINGS, { apiBaseUrl: settings.apiBaseUrl, token: "" });
      await setConnection({ status: "disconnected", user: null, error: null });
      return {};
    }
    default:
      throw new Error(`Unknown message type: ${msg?.type}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("cq:")) return false;
  handleMessage(msg, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => {
      log("message failed", msg.type, err?.message);
      sendResponse({ ok: false, error: err?.message || String(err), code: err?.code });
    });
  return true; // keep the channel open for the async response
});

/* ----------------------------- lifecycle -------------------------------- */

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_QUEUE_RETRY) flushQueue({ force: true }).catch((err) => log("flush failed", err?.message));
});

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await local.get(STORAGE.SETTINGS);
  if (!settings) await local.set(STORAGE.SETTINGS, { ...DEFAULT_SETTINGS });
  await scheduleRetry(await getQueue());
});

chrome.runtime.onStartup.addListener(async () => {
  // Tab ids are not stable across browser restarts: drop per-tab prompts.
  await local.set(STORAGE.PENDING, {});
  await scheduleRetry(await getQueue());
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.forget(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  // A new document is loading: the content script will re-report. Keep lastJob
  // (to pre-fill a confirmation that follows) and any unresolved prompt.
  Promise.all([tabState.setDetection(tabId, undefined), tabState.setMatches(tabId, undefined)])
    .then(() => tabState.getPending(tabId))
    .then((pending) => setBadge(tabId, pending ? (pending.reason === "apply_started" ? "applying" : "pending") : "none"))
    .catch(() => {});
});
