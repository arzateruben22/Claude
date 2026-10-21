/* global chrome */
/**
 * Options page: API base URL + developer token, "Test connection" (/me),
 * optional host permission request for the base URL origin, and the local queue.
 */
import { MSG, STORAGE } from "../lib/constants.js";
import { hostPatternFor, normalizeBaseUrl } from "../lib/url.js";

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

/** Current values from the form (base URL normalised). */
function readForm() {
  const apiBaseUrl = normalizeBaseUrl(/** @type {HTMLInputElement} */ ($("apiBaseUrl")).value);
  const token = /** @type {HTMLInputElement} */ ($("token")).value.trim();
  return { apiBaseUrl, token };
}

async function renderPermission(apiBaseUrl) {
  const pattern = apiBaseUrl ? hostPatternFor(apiBaseUrl) : null;
  const record = (await chrome.storage.local.get(STORAGE.HOST_PERMISSION))[STORAGE.HOST_PERMISSION];
  if (!pattern) {
    setPermState("Enter a CareerQuest URL first.");
    return;
  }
  let granted = false;
  try {
    granted = await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    granted = false;
  }
  if (granted) setPermState(`Granted for ${pattern}`, "ok");
  else if (record?.pattern === pattern && record.granted === false) setPermState(`Denied for ${pattern}. Save again to re-request, or allow it in chrome://extensions.`, "bad");
  else if (record?.pattern === pattern && record.requestedAt) setPermState(`Requested for ${pattern} — waiting for your answer in Chrome's prompt.`, "warn");
  else setPermState(`Not granted yet for ${pattern}. It is requested when you save.`, "warn");
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
  const { apiBaseUrl, token } = readForm();
  if (!apiBaseUrl) {
    setMessage("Enter a valid http(s) URL for CareerQuest.", "error");
    return;
  }
  const pattern = hostPatternFor(apiBaseUrl);
  // Record the request before asking so the state survives the prompt / a reload.
  await chrome.storage.local.set({ [STORAGE.HOST_PERMISSION]: { pattern, requestedAt: Date.now(), granted: null } });
  // permissions.request must run inside the click's user activation: call it before awaiting anything else.
  const permissionPromise = (async () => {
    try {
      return await chrome.permissions.request({ origins: [pattern] });
    } catch (err) {
      setPermState(`Could not request permission: ${err.message}`, "bad");
      return null;
    }
  })();
  const saved = await send({ type: MSG.SAVE_SETTINGS, apiBaseUrl, token });
  if (!saved.ok) {
    setMessage(saved.error || "Could not save settings.", "error");
    return;
  }
  setMessage(token ? "Saved. Testing connection…" : "Saved. Add a developer token to connect.", "ok");
  setPermState(`Requested for ${pattern} — waiting for your answer in Chrome's prompt.`, "warn");
  if (token) await onTest();
  const granted = await permissionPromise;
  if (granted !== null) {
    await chrome.storage.local.set({ [STORAGE.HOST_PERMISSION]: { pattern, requestedAt: Date.now(), granted } });
  }
  await renderPermission(apiBaseUrl);
}

async function onTest() {
  const { apiBaseUrl, token } = readForm();
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
$("apiBaseUrl").addEventListener("change", () => renderPermission(readForm().apiBaseUrl));
load().catch((err) => setMessage(err.message, "error"));
