/* global chrome */
/**
 * Popup: connection status, the current tab's detection, existing CareerQuest
 * matches, save / confirm actions and the pending-confirmation prompt.
 * Open it as a tab with ?tabId=<id> to inspect another tab (debugging/tests).
 */
import { CAPTURE_KIND, MSG } from "../lib/constants.js";

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const KIND_LABEL = {
  JOB_PAGE: ["Job posting", ""],
  APPLY_STARTED: ["Application in progress", "chip--gold"],
  CONFIRMATION_PAGE: ["Confirmation page", "chip--green"],
};

const PLATFORM_LABEL = {
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  GLASSDOOR: "Glassdoor",
  ZIPRECRUITER: "ZipRecruiter",
  WORKDAY: "Workday",
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  SMARTRECRUITERS: "SmartRecruiters",
  ICIMS: "iCIMS",
  ADP: "ADP",
  GOVERNMENTJOBS: "GovernmentJobs",
  USAJOBS: "USAJOBS",
  COMPANY_SITE: "Company site",
  OTHER: "Other",
};

/** @type {{ tabId: number | null, state: any }} */
const ui = { tabId: null, state: null };

/** @param {object} msg */
function send(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(res || { ok: false, error: "No response" });
    });
  });
}

async function resolveTabId() {
  const param = new URLSearchParams(location.search).get("tabId");
  if (param && Number.isFinite(Number(param))) return Number(param);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/** @param {string} text @param {"ok"|"error"|"warn"|""} [tone] @param {{ href: string, label: string }} [link] */
function setMessage(text, tone = "", link) {
  const el = $("message");
  el.className = `message${tone ? ` message--${tone}` : ""}`;
  el.textContent = text;
  if (link) {
    el.append(" ");
    const a = document.createElement("a");
    a.href = link.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = link.label;
    el.append(a);
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusLabel(status) {
  return String(status || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function renderConnection(state) {
  const pill = $("status-pill");
  const section = $("connect-section");
  const c = state.connection || { status: "disconnected" };
  const btn = $("connect-button");
  section.hidden = true;
  pill.className = "pill";
  if (!state.settings.hasToken || c.status === "disconnected") {
    pill.textContent = "Not connected";
    pill.classList.add("pill--muted");
    section.hidden = false;
    $("connect-text").textContent = "Connect the extension to CareerQuest to start saving jobs.";
    btn.textContent = "Connect";
  } else if (c.status === "unauthorized") {
    pill.textContent = "Token rejected";
    pill.classList.add("pill--bad");
    section.hidden = false;
    $("connect-text").textContent = "CareerQuest rejected the developer token. Create a new one and reconnect.";
    btn.textContent = "Reconnect";
  } else if (c.status === "connected") {
    pill.textContent = c.user?.name ? `Connected · ${c.user.name}` : "Connected";
    pill.classList.add("pill--ok");
  } else if (c.error) {
    pill.textContent = "Offline";
    pill.classList.add("pill--warn");
    pill.title = c.error;
  } else {
    pill.textContent = "Checking…";
    pill.classList.add("pill--muted");
  }
}

function renderDetection(state) {
  const d = state.detection;
  const chip = $("kind-chip");
  $("detection-fields").hidden = !d;
  $("no-detection").hidden = !!d;
  $("actions-section").hidden = !d;
  if (!d) {
    chip.hidden = true;
    return;
  }
  const [label, cls] = KIND_LABEL[d.kind] || ["Page", ""];
  chip.hidden = false;
  chip.textContent = label;
  chip.className = `chip ${cls}`.trim();
  $("f-title").textContent = d.title || "—";
  $("f-company").textContent = d.company || "—";
  $("f-location").textContent = d.location || "—";
  $("f-salary").textContent = d.salaryText || "—";
  $("f-req").textContent = d.requisitionId || "—";
  $("f-platform").textContent = PLATFORM_LABEL[d.platform] || d.platform || "—";
  const meter = /** @type {HTMLMeterElement} */ ($("f-confidence"));
  meter.value = d.confidence || 0;
  $("f-confidence-text").textContent = `${Math.round((d.confidence || 0) * 100)}%`;
  $("f-confidence-text").title = (d.detectedBy || []).join(", ");
}

function renderMatches(state) {
  const list = $("matches-list");
  list.replaceChildren();
  const matches = state.matches || [];
  $("matches-section").hidden = matches.length === 0;
  for (const m of matches) {
    const li = document.createElement("li");
    li.className = "match";
    const line = document.createElement("div");
    line.className = "match__line";
    line.textContent = `Already tracked: ${[m.companyName, m.positionTitle].filter(Boolean).join(" · ")}`;
    const meta = document.createElement("div");
    meta.className = "match__meta";
    const when = formatDate(m.appliedAt);
    meta.textContent = `${statusLabel(m.status)}${when ? ` on ${when}` : ""}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--ghost btn--small";
    btn.textContent = state.pending ? "Yes — attach to this record" : "Attach to this record";
    btn.dataset.applicationId = m.id;
    btn.addEventListener("click", () => attach(m.id));
    li.append(line, meta, btn);
    list.append(li);
  }
}

function renderPending(state) {
  const p = state.pending;
  $("pending-section").hidden = !p;
  if (!p) return;
  const d = p.detection || {};
  const what = [d.title, d.company].filter(Boolean).join(" at ");
  $("pending-text").textContent =
    p.reason === "apply_started"
      ? `It looks like you started an application${what ? ` for ${what}` : ""}. Tell us when it's submitted.`
      : `This looks like a confirmation page${what ? ` for ${what}` : ""}, but we're not certain. Nothing is recorded until you say so.`;
}

function renderQueue(state) {
  const q = state.queue || { length: 0 };
  $("queue-status").hidden = q.length === 0;
  $("retry-queue").hidden = q.length === 0;
  $("queue-status").textContent = q.length ? `${q.length} capture${q.length === 1 ? "" : "s"} waiting to send` : "";
}

function render(state) {
  ui.state = state;
  renderConnection(state);
  renderPending(state);
  renderDetection(state);
  renderMatches(state);
  renderQueue(state);
  const connected = state.connection?.status === "connected";
  for (const id of ["save-job", "confirm-submitted", "pending-yes"]) $(id).disabled = !state.settings.hasToken;
  if (state.detection && !connected && state.settings.hasToken && state.connection?.status !== "unauthorized") {
    setMessage("Captures will be queued until CareerQuest is reachable.", "warn");
  }
  document.querySelector("main").setAttribute("aria-busy", "false");
}

async function refresh() {
  const res = await send({ type: MSG.GET_STATE, tabId: ui.tabId });
  if (!res.ok) {
    setMessage(res.error || "Could not reach the extension background.", "error");
    return null;
  }
  render(res);
  return res;
}

function describeResult(res, verb) {
  if (res.ok) {
    const app = res.response?.application;
    const action = res.response?.action;
    const base = (ui.state?.settings?.apiBaseUrl || "").replace(/\/+$/, "");
    const link = app?.detailUrl ? { href: /^https?:/i.test(app.detailUrl) ? app.detailUrl : `${base}${app.detailUrl}`, label: "Open in CareerQuest" } : undefined;
    if (action === "duplicate") setMessage("Already in CareerQuest — nothing new recorded.", "ok", link);
    else if (action === "pending_confirmation") setMessage("Sent to CareerQuest for review.", "ok", link);
    else setMessage(`${verb} in CareerQuest.`, "ok", link);
  } else if (res.queued) {
    setMessage(`Saved locally — will send when CareerQuest is reachable (${res.error}).`, "warn");
  } else {
    setMessage(res.error || "Something went wrong.", "error");
  }
}

async function act(button, msg, verb) {
  button.disabled = true;
  setMessage("Sending…");
  try {
    const res = await send(msg);
    describeResult(res, verb);
    await refresh();
  } finally {
    button.disabled = false;
  }
}

function attach(applicationId) {
  const btn = document.activeElement instanceof HTMLButtonElement ? document.activeElement : $("save-job");
  const pending = ui.state?.pending;
  const kind = pending || ui.state?.detection?.kind === "CONFIRMATION_PAGE" ? CAPTURE_KIND.MANUAL_CONFIRMATION : CAPTURE_KIND.JOB_PAGE;
  const msg = pending ? { type: MSG.RESOLVE_PENDING, tabId: ui.tabId, confirmed: true, applicationId } : { type: MSG.SAVE_CAPTURE, tabId: ui.tabId, kind, applicationId };
  return act(btn, msg, "Attached");
}

function wire() {
  $("options-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  $("connect-button").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("status-pill").addEventListener("click", async () => {
    $("status-pill").textContent = "Checking…";
    await send({ type: MSG.TEST_CONNECTION });
    await refresh();
  });
  $("save-job").addEventListener("click", (e) => act(e.currentTarget, { type: MSG.SAVE_CAPTURE, tabId: ui.tabId, kind: CAPTURE_KIND.JOB_PAGE }, "Saved"));
  $("confirm-submitted").addEventListener("click", (e) => act(e.currentTarget, { type: MSG.SAVE_CAPTURE, tabId: ui.tabId, kind: CAPTURE_KIND.MANUAL_CONFIRMATION }, "Recorded as submitted"));
  $("pending-yes").addEventListener("click", (e) => act(e.currentTarget, { type: MSG.RESOLVE_PENDING, tabId: ui.tabId, confirmed: true }, "Recorded as submitted"));
  $("pending-no").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    await send({ type: MSG.RESOLVE_PENDING, tabId: ui.tabId, confirmed: false });
    setMessage("Okay — nothing recorded.");
    await refresh();
    e.currentTarget.disabled = false;
  });
  $("manual-detect").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    setMessage("Reading page…");
    const res = await send({ type: MSG.MANUAL_DETECT, tabId: ui.tabId });
    if (!res.ok) setMessage(res.error || "Could not read this page.", "error");
    else if (!res.detection?.kind) setMessage("No job posting found on this page.", "warn");
    else setMessage("");
    await refresh();
    e.currentTarget.disabled = false;
  });
  $("retry-queue").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const res = await send({ type: MSG.FLUSH_QUEUE });
    setMessage(res.ok ? `Sent ${res.sent}, ${res.remaining} still waiting.` : res.error, res.ok ? "ok" : "error");
    await refresh();
    e.currentTarget.disabled = false;
  });
}

async function main() {
  wire();
  ui.tabId = await resolveTabId();
  const state = await refresh();
  if (!state) return;
  const c = state.connection;
  const stale = !c?.checkedAt || Date.now() - c.checkedAt > 5 * 60 * 1000;
  if (state.settings.hasToken && (c?.status === "unknown" || (c?.status === "connected" && stale))) {
    await send({ type: MSG.TEST_CONNECTION });
    await refresh();
  }
  if (state.detection && state.matches == null && state.connection?.status === "connected") {
    await send({ type: MSG.LOOKUP, tabId: ui.tabId });
    await refresh();
  }
}

main().catch((err) => setMessage(err?.message || String(err), "error"));
