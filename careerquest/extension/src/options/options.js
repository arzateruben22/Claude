/* global chrome */
/**
 * Options page: API base URL + developer token, "Test connection" (/me),
 * optional host permission request for the base URL origin (and revocation of
 * origins no longer configured), and the local queue.
 */
import { MSG, STORAGE } from "../lib/constants.js";
import { baseUrlError, hostPatternFor, isGrantableOrigin, normalizeBaseUrl, staleHostOrigins } from "../lib/url.js";

const MANIFEST = chrome.runtime.getManifest();

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

function send(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(res || { ok: false, error: "No response" });
    });
  });
}

function setMessage(text, tone = "") {
  const el = $("form-message");
  el.className = `message${tone ? ` message--${tone}` : ""}`;
  el.textContent = text;
}

function setPermState(text, tone = "") {
  const el = $("perm-state");
  el.className = `state${tone ? ` state--${tone}` : ""}`;
  el.textContent = text;
}

/** Current values from the form (base URL normalised; urlError explains a rejected URL). */
function readForm() {
  const raw = /** @type {HTMLInputElement} */ ($("apiBaseUrl")).value;
  const apiBaseUrl = normalizeBaseUrl(raw);
  const token = /** @type {HTMLInputElement} */ ($("token")).value.trim();
  return { apiBaseUrl, token, urlError: apiBaseUrl ? null : baseUrlError(raw) };
}

const cannotGrantText = (pattern) =>
  `Chrome cannot grant access to ${pattern} (only https:// sites, http://localhost and http://127.0.0.1 can be allowed). CareerQuest must answer CORS for the extension, or use an https:// URL.`;

/** Lists CareerQuest origins the extension still holds besides `pattern`. */
async function renderOtherGrants(pattern) {
  let others = [];
  try {
    others = staleHostOrigins((await chrome.permissions.getAll()).origins || [], pattern, MANIFEST);
  } catch {
    others = [];
  }
  const el = $("perm-others");
  el.hidden = others.length === 0;
  el.textContent = others.length ? `Also allowed (no longer used): ${others.join(", ")} — they are removed when you save.` : "";
}

async function renderPermission(apiBaseUrl) {
  const pattern = apiBaseUrl ? hostPatternFor(apiBaseUrl) : null;
  const record = (await chrome.storage.local.get(STORAGE.HOST_PERMISSION))[STORAGE.HOST_PERMISSION];
  $("revoke").hidden = true;
  await renderOtherGrants(pattern);
  if (!pattern) {
    setPermState("Enter a valid CareerQuest URL first.");
    return;
  }
  if (!isGrantableOrigin(pattern, MANIFEST)) {
    setPermState(cannotGrantText(pattern), "bad");
    return;
  }
  let granted = false;
  try {
    granted = await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    granted = false;
  }
  $("revoke").hidden = !granted;
  if (granted) setPermState(`Granted for ${pattern}`, "ok");
  else if (record?.pattern === pattern && record.revokedAt) setPermState(`Revoked for ${pattern}. Save again to allow it.`, "warn");
  else if (record?.pattern === pattern && record.error) setPermState(`Could not request permission for ${pattern}: ${record.error}`, "bad");
  else if (record?.pattern === pattern && record.granted === false) setPermState(`Denied for ${pattern}. Save again to re-request, or allow it in chrome://extensions.`, "bad");
  else if (record?.pattern === pattern && record.requestedAt) setPermState(`Requested for ${pattern} — waiting for your answer in Chrome's prompt.`, "warn");
  else setPermState(`Not granted yet for ${pattern}. It is requested when you save.`, "warn");
}

/** Revokes host access to CareerQuest origins other than `keepPattern`. */
async function revokeStaleOrigins(keepPattern) {
  let stale = [];
  try {
    stale = staleHostOrigins((await chrome.permissions.getAll()).origins || [], keepPattern, MANIFEST);
  } catch {
    return [];
  }
  const removed = [];
  for (const origin of stale) {
    try {
      if (await chrome.permissions.remove({ origins: [origin] })) removed.push(origin);
    } catch {
      /* required or already gone */
    }
  }
  return removed;
}

async function renderQueue() {
  const res = await send({ type: MSG.GET_STATE });
  const n = res.ok ? res.queue.length : 0;
  $("queue-state").textContent = `${n} capture${n === 1 ? "" : "s"} waiting.`;
  $("flush").toggleAttribute("disabled", n === 0);
  $("clear-queue").toggleAttribute("disabled", n === 0);
}

async function load() {
  const stored = (await chrome.storage.local.get(STORAGE.SETTINGS))[STORAGE.SETTINGS] || {};
  /** @type {HTMLInputElement} */ ($("apiBaseUrl")).value = stored.apiBaseUrl || "http://localhost:3000";
  /** @type {HTMLInputElement} */ ($("token")).value = stored.token || "";
  await renderPermission(stored.apiBaseUrl || "http://localhost:3000");
  await renderQueue();
}

async function onSave(event) {
  event.preventDefault();
  const { apiBaseUrl, token, urlError } = readForm();
  if (!apiBaseUrl) {
    setMessage(urlError || "Enter a valid http(s) URL for CareerQuest.", "error");
    return;
  }
  const pattern = hostPatternFor(apiBaseUrl);
  const grantable = !!pattern && isGrantableOrigin(pattern, MANIFEST);
  // permissions.request must run inside the click's user activation: call it
  // before awaiting anything else. Origins the manifest cannot grant are never
  // requested (Chrome would reject them) and are reported as such.
  /** @type {Promise<{ granted: boolean } | { error: string }> | null} */
  const permissionPromise = grantable
    ? chrome.permissions.request({ origins: [pattern] }).then(
        (granted) => ({ granted: !!granted }),
        (err) => ({ error: (err && err.message) || String(err) }),
      )
    : null;
  // Record the request so the state survives the prompt / a reload.
  await chrome.storage.local.set({ [STORAGE.HOST_PERMISSION]: { pattern, requestedAt: Date.now(), granted: grantable ? null : false, grantable } });
  const saved = await send({ type: MSG.SAVE_SETTINGS, apiBaseUrl, token });
  if (!saved.ok) {
    setMessage(saved.error || "Could not save settings.", "error");
    return;
  }
  // The previous CareerQuest origin (if any) is no longer needed.
  await revokeStaleOrigins(pattern);
  setMessage(token ? "Saved. Testing connection…" : "Saved. Add a developer token to connect.", "ok");
  if (!grantable) setPermState(cannotGrantText(pattern), "bad");
  else setPermState(`Requested for ${pattern} — waiting for your answer in Chrome's prompt.`, "warn");
  if (permissionPromise) {
    // Settles when the user answers (never in headless automation).
    permissionPromise.then(async (outcome) => {
      const record = "error" in outcome ? { pattern, requestedAt: Date.now(), granted: false, error: outcome.error } : { pattern, requestedAt: Date.now(), granted: outcome.granted };
      await chrome.storage.local.set({ [STORAGE.HOST_PERMISSION]: record });
      await renderPermission(apiBaseUrl);
      // Re-test once access is granted (the first test may have failed on CORS).
      if ("granted" in outcome && outcome.granted && token) await onTest();
    });
  }
  if (token) await onTest();
  await renderPermission(apiBaseUrl);
}

async function onRevoke() {
  const { apiBaseUrl } = readForm();
  const pattern = apiBaseUrl ? hostPatternFor(apiBaseUrl) : null;
  if (!pattern) return;
  try {
    await chrome.permissions.remove({ origins: [pattern] });
  } catch (err) {
    setPermState(`Could not revoke: ${err.message}`, "bad");
    return;
  }
  await chrome.storage.local.set({ [STORAGE.HOST_PERMISSION]: { pattern, granted: false, revokedAt: Date.now() } });
  await renderPermission(apiBaseUrl);
  setMessage(`Removed the extension's access to ${pattern}.`, "ok");
}

async function onTest() {
  const { apiBaseUrl, token, urlError } = readForm();
  if (!apiBaseUrl && urlError && token) {
    setMessage(urlError, "error");
    return;
  }
  if (!apiBaseUrl || !token) {
    setMessage("Enter the CareerQuest URL and a developer token first.", "error");
    return;
  }
  $("test").setAttribute("disabled", "");
  setMessage("Testing connection…");
  const res = await send({ type: MSG.TEST_CONNECTION, apiBaseUrl, token });
  $("test").removeAttribute("disabled");
  if (res.ok) setMessage(`Connected as ${res.user.name || res.user.email}.`, "ok");
  else if (res.code === "unauthorized") setMessage("Token rejected (401). Create a new developer token in CareerQuest and try again.", "error");
  else setMessage(res.error || "Connection failed.", "error");
}

async function onForget() {
  await send({ type: MSG.DISCONNECT });
  /** @type {HTMLInputElement} */ ($("token")).value = "";
  setMessage("Token removed from this browser.", "ok");
}

async function onFlush() {
  const res = await send({ type: MSG.FLUSH_QUEUE });
  setMessage(res.ok ? `Sent ${res.sent}, ${res.remaining} still waiting.` : res.error || "Retry failed.", res.ok ? "ok" : "error");
  await renderQueue();
}

async function onClearQueue() {
  await send({ type: MSG.CLEAR_QUEUE });
  setMessage("Local queue cleared.", "ok");
  await renderQueue();
}

$("settings-form").addEventListener("submit", onSave);
$("test").addEventListener("click", onTest);
$("forget").addEventListener("click", onForget);
$("flush").addEventListener("click", onFlush);
$("clear-queue").addEventListener("click", onClearQueue);
$("revoke").addEventListener("click", onRevoke);
$("apiBaseUrl").addEventListener("change", () => renderPermission(readForm().apiBaseUrl));
load().catch((err) => setMessage(err.message, "error"));
