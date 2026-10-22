/* Lumevina Skin Intelligence — the studio (studio-skin.html)
 *
 * For practitioners and admins, signed in with their own account and an
 * authenticator app. Needs you · Clients · a client's record (overview,
 * imaging, Skin Evolution and comparison, measurements, treatments,
 * routine, reports, consents) · Admin (staff, settings, devices and
 * calibration, measurement validation, analytics, audit log, data requests).
 * functions/studio-skin decides who may see and do what; this page only asks.
 */

import { createSession, LIVE } from "./session.js";
import { createApi, explain } from "./api.js";
import { esc, $, day, shortDay, time, minsToTime, toast, openSheet, twoTap, formValues, showErrors, busy } from "./ui.js";
import { CONSENT_KINDS, CONSENT_LABELS, may } from "./core/consent.js";
import { REGIONS, STANDARD_SET, AREA_IDS, regionLabel } from "./core/regions.js";
import { MEASUREMENTS, MEASUREMENT_NAMES, formatValue } from "./core/measurements.js";
import { checkWording } from "./core/wording.js";
import { cleanTreatment, TREATMENT_TYPES, ROUTINE_CATEGORIES, DEVICE_KINDS, MAX_DEPTH_MM } from "./core/validate.js";
import { renderEvolution } from "./evolution-view.js";
import { openCapture } from "./capture.js";

const session = createSession("staff");
const api = createApi("studio-skin", session);
const main = $("#sk-main");
let me = null;
const SERVICES = { "procell-microchanneling": "ProCell Microchanneling", "procell-package": "ProCell Package (4)", "procell-package-rebook": "ProCell Package · next session", "lumevina-custom-facial": "Custom Facial" };

async function boot() {
  const arrived = await session.arrive();
  if (arrived.error) toast(arrived.error);
  if (!LIVE) $("#sk-banner").innerHTML = `<div class="sk-banner sk-banner--demo" role="note"><span class="sk-badge sk-badge--syn">Demo</span><div><b>Demonstration studio.</b> One synthetic client; images are generated textures measured by the real analysis. Live, this page needs your own sign-in and an authenticator app code. <button type="button" class="sk-link" data-reset>Start over</button></div></div>`;
  $("#sk-banner").addEventListener("click", async (e) => { if (e.target.closest("[data-reset]")) { (await import("./demo-backend.js")).resetDemo(); location.reload(); } });
  window.addEventListener("hashchange", route);
  route();
}

async function route() {
  const [page, id, tab] = (location.hash.slice(1) || "needs").split("/");
  document.querySelectorAll(".sk-nav a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + (page === "client" ? "clients" : page) ? "page" : "false"));
  if (LIVE && !session.signedIn()) return signIn();
  if (LIVE && session.aal() !== "aal2") return mfa();
  try {
    me ??= await api.call("whoami");
    $("#sk-who").innerHTML = `<span>${esc(me.staff.name)} · ${esc(me.staff.role)}</span><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-signout>Sign out</button>`;
    $("#sk-who [data-signout]").onclick = async () => { await session.signOut(); location.reload(); };
    document.querySelector('.sk-nav a[href="#admin"]').hidden = me.staff.role !== "admin";
    main.setAttribute("aria-busy", "true");
    if (page === "find" && id) {
      const q = decodeURIComponent(id);
      const r = await api.call("clients", { q });
      const exact = r.clients.filter((c) => c.email === q.toLowerCase());
      if (exact.length === 1) { location.replace(`#client/${exact[0].id}`); return; }
      await clients(q);
    } else if (page === "client" && id) await client(id, tab || "overview");
    else if (page === "clients") await clients();
    else if (page === "admin") await admin(id || "analytics");
    else await needs();
  } catch (e) {
    if (e.reason === "mfa_required") return mfa();
    if (e.reason === "sign_in") return signIn();
    main.innerHTML = `<div class="sk-section"><p class="sk-empty">${esc(explain(e))}</p></div>`;
  } finally { main.removeAttribute("aria-busy"); }
}

/* ── sign-in and multifactor ── */
function signIn() {
  main.innerHTML = `<section class="sk-section"><div class="sk-card" style="max-width:30rem;margin:2rem auto"><p class="sk-kicker">Lumevina Studio</p><h1 class="sk-h2">Skin Intelligence</h1>
    <p class="sk-fine">Staff sign in with their own email, then an authenticator app code. The shared studio key doesn't open this page.</p>
    <form class="sk-fields" data-f novalidate><label class="sk-field"><span>Your email</span><input type="email" name="email" autocomplete="email" required></label><button class="sk-btn">Email me a sign-in link</button><p class="sk-fine" role="status" data-st></p></form></div></section>`;
  main.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault(); const st = e.target.querySelector("[data-st]");
    try { await session.sendLink(e.target.email.value); st.textContent = "Check your email. The link opens this page."; } catch (err) { st.textContent = err.status === 429 ? "A link was just sent." : "No studio account for that email, or try again in a moment."; }
  });
}

async function mfa() {
  let factors = [];
  try { factors = await session.factors(); } catch { return signIn(); }
  const verified = factors.find((f) => f.status === "verified");
  if (verified) {
    main.innerHTML = `<section class="sk-section"><div class="sk-card" style="max-width:26rem;margin:2rem auto"><h1 class="sk-h2">Your code</h1><p class="sk-fine">From your authenticator app.</p>
      <form class="sk-fields" data-f><label class="sk-field"><span>Six-digit code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" required></label><button class="sk-btn">Continue</button></form></div></section>`;
    main.querySelector("[data-f]").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await session.verifyTotp(verified.id, e.target.code.value); route(); } catch { showErrors(e.target, { code: "That code didn't match. Try the next one." }); }
    });
    return;
  }
  const en = await session.enrollTotp();
  main.innerHTML = `<section class="sk-section"><div class="sk-card" style="max-width:30rem;margin:2rem auto"><h1 class="sk-h2">Set up your authenticator</h1>
    <p class="sk-fine">Client photos and treatment records need a second step. Scan this with an authenticator app (Apple Passwords, Google Authenticator, 1Password), then type the code it shows.</p>
    <div class="st-qr"><img src="${esc(en.totp.qr_code)}" alt="QR code for your authenticator app"></div>
    <p class="sk-fine">Or enter this key by hand: <span class="st-code">${esc(en.totp.secret)}</span></p>
    <form class="sk-fields" data-f><label class="sk-field"><span>Six-digit code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" required></label><button class="sk-btn">Turn it on</button></form></div></section>`;
  main.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await session.verifyTotp(en.id, e.target.code.value); toast("Authenticator on."); route(); } catch { showErrors(e.target, { code: "That code didn't match. Try the next one." }); }
  });
}

/* ── Needs you ── */
async function needs() {
  const n = await api.call("needs");
  const name = (pid) => { const x = n.names.find((y) => y.id === pid); return x ? x.name || x.email : "A client"; };
  const items = [
    ...Object.entries(n.measurements_to_review).map(([pid, k]) => ({ t: `${k} measurement${k > 1 ? "s" : ""} to review`, who: name(pid), href: `#client/${pid}/measurements` })),
    ...n.changes.map((c) => ({ t: `${c.verdict === "deterioration" ? "Possible change to review" : "Change to review"}: ${MEASUREMENTS[c.name]?.short || c.name}, ${regionLabel(c.region).toLowerCase()}`, who: name(c.profile_id), href: `#client/${c.profile_id}/evolution` })),
    ...n.recovery.map((r) => ({ t: `Asked you to look at their recovery (day ${r.day_after})`, who: name(r.profile_id), href: `#client/${r.profile_id}/overview` })),
    ...n.sessions.map((s) => ({ t: `Session submitted: ${s.visit_label || "imaging"}`, who: name(s.profile_id), href: `#client/${s.profile_id}/imaging` })),
    ...n.data_requests.map((d) => ({ t: `Data request: ${d.kind}`, who: "Privacy", href: "#admin/privacy" })),
  ];
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Skin Intelligence</p><h1 class="sk-h1">Needs you.</h1>
    ${items.length ? items.map((i) => `<a class="st-need sk-card--link" href="${i.href}"><div><b>${esc(i.t)}</b><div class="sk-fine">${esc(i.who)}</div></div><span aria-hidden="true">›</span></a>`).join("") : `<p class="sk-empty">Nothing waiting. New photos, measurements and check-ins land here.</p>`}
    <div class="sk-row" style="margin-top:1.4rem"><a class="sk-btn" href="#clients">Clients</a></div></section>`;
}

/* ── Clients ── */
async function clients(q = "") {
  const r = await api.call("clients", { q });
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Clients</p><h1 class="sk-h1">Skin records.</h1>
    <form class="sk-row" data-search role="search"><label class="sk-field" style="flex:1 1 18rem"><span class="sk-vh">Search</span><input name="q" value="${esc(q)}" placeholder="Name or email" autocomplete="off"></label><button class="sk-btn sk-btn-quiet">Search</button></form>
    <div class="sk-card" style="margin-top:1rem">${r.clients.length ? r.clients.map((c) => `<a class="st-client" href="#client/${c.id}"><div><b>${esc(c.name || c.email)}</b><small>${esc(c.email)} · ${esc((c.concerns || []).join(", "))}</small></div><small>${c.last_session ? "Last " + esc(shortDay(c.last_session)) : "No photos yet"}${c.status !== "active" ? ` · <span class="sk-badge sk-badge--bad">${esc(c.status.replace("_", " "))}</span>` : ""}</small></a>`).join("") : `<p class="sk-empty">No enrolled clients${q ? " match" : " yet"}.</p>`}</div>
    ${r.not_enrolled.length ? `<div class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">Clients without a skin record</h2>${r.not_enrolled.map((c) => `<div class="st-client"><div><b>${esc(c.name || c.email)}</b><small>${esc(c.email)}</small></div><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-enroll="${esc(c.email)}" data-name="${esc(c.name || "")}">Start a skin record</button></div>`).join("")}</div>` : ""}
    <details class="sk-card" style="margin-top:1rem"><summary class="sk-h3" style="cursor:pointer">Start a record by email</summary><form class="sk-fields sk-fields-2" data-new style="margin-top:.8rem"><label class="sk-field"><span>Email</span><input type="email" name="email" required></label><label class="sk-field"><span>Name</span><input name="name"></label><div><button class="sk-btn sk-btn-sm">Start</button></div></form></details></section>`;
  main.querySelector("[data-search]").addEventListener("submit", (e) => { e.preventDefault(); clients(e.target.q.value.trim()); });
  const enroll = async (email, name) => { try { const { profile } = await api.call("enroll", { email, name }); location.hash = `#client/${profile.id}`; } catch (err) { toast(explain(err)); } };
  main.querySelector("[data-new]").addEventListener("submit", (e) => { e.preventDefault(); enroll(e.target.email.value, e.target.name.value); });
  main.addEventListener("click", (e) => { const b = e.target.closest("[data-enroll]"); if (b) enroll(b.dataset.enroll, b.dataset.name); });
}

/* ── One client ── */
const TABS = [["overview", "Overview"], ["imaging", "Imaging"], ["evolution", "Evolution"], ["measurements", "Measurements"], ["treatments", "Treatments"], ["routine", "Routine"], ["reports", "Reports"], ["consents", "Consents"]];
let current = null;

async function client(id, tab) {
  current = await api.call("client", { profile_id: id });
  const p = current.profile;
  main.innerHTML = `<section class="sk-section"><a class="sk-fine" href="#clients">‹ Clients</a>
    <div class="sk-row" style="justify-content:space-between;align-items:flex-end"><div><h1 class="sk-h1" style="margin-bottom:.2rem">${esc(p.name || p.email)}</h1><p class="sk-fine">${esc(p.email)} · enrolled ${esc(day(p.enrolled_at))}${p.status !== "active" ? ` · <span class="sk-badge sk-badge--bad">${esc(p.status.replace("_", " "))}</span>` : ""}</p></div>
      <div class="sk-row">${[["clinical_photography", "Photos"], ["treatment", "Treatment records"]].map(([k, l]) => `<span class="sk-badge ${current.consents[k].active ? "sk-badge--ok" : "sk-badge--bad"}">${l}: ${current.consents[k].active ? "yes" : "no consent"}</span>`).join("")}</div></div>
    <div class="st-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join("")}</div>
    <div data-panel role="tabpanel"></div></section>`;
  main.querySelector(".st-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) location.hash = `#client/${id}/${b.dataset.tab}`; });
  const panel = main.querySelector("[data-panel]");
  await ({ overview, imaging, evolution, measurements, treatments, routine, reports, consents })[tab]?.(panel, current);
}
const reload = () => route();
const urls = async (ids, kind, ref) => (await api.call("image_urls", { profile_id: current.profile.id, capture_ids: ids, kind, reference_id: ref })).urls;

function overview(el, c) {
  const p = c.profile, a = c.intake?.answers || {};
  const upcoming = (c.bookings || []).filter((b) => b.date >= new Date().toISOString().slice(0, 10) && ["pending", "held"].includes(b.status));
  el.innerHTML = `<div class="sk-grid-2"><div class="sk-stack">
      <div class="sk-card"><h2 class="sk-h3">Profile</h2><dl class="sk-fine" style="display:grid;grid-template-columns:9rem 1fr;gap:.4rem .8rem;margin:0">
        ${[["Goals", p.goals], ["Working on", (p.concerns || []).join(", ")], ["History", p.skin_history], ["Sensitivities", p.sensitivities], ["Uses now", p.current_products], ["Before", p.prior_procedures]].map(([k, v]) => `<dt>${k}</dt><dd style="margin:0;color:var(--sk-ink)">${esc(v || "—")}</dd>`).join("")}</dl></div>
      <div class="sk-card"><h2 class="sk-h3">Contraindications</h2>${(p.contraindications || []).length ? `<ul class="sk-list">${p.contraindications.map((x) => `<li><span>${esc(x.note)}</span><span class="sk-fine">${esc(x.by || "")} · ${esc(shortDay(x.at))}</span></li>`).join("")}</ul>` : `<p class="sk-fine">None recorded.</p>`}
        <form class="sk-row" data-ci style="margin-top:.6rem"><label class="sk-field" style="flex:1 1 16rem"><span class="sk-vh">Add</span><input name="note" placeholder="Add one (e.g. no retinoids 5 days before)" maxlength="600"></label><button class="sk-btn sk-btn-sm sk-btn-quiet">Add</button></form>
        <p class="sk-fine">Recorded for safe planning. The software never decides eligibility.</p></div></div>
    <div class="sk-stack">
      <div class="sk-card"><h2 class="sk-h3">Pre-visit form</h2>${c.intake ? `<p class="sk-fine">Signed ${esc(day(c.intake.signed_at))}</p><dl class="sk-fine" style="display:grid;grid-template-columns:9rem 1fr;gap:.3rem .8rem;margin:0">${Object.entries(a).slice(0, 12).map(([k, v]) => `<dt>${esc(k.replace(/_/g, " "))}</dt><dd style="margin:0;color:var(--sk-ink)">${esc(Array.isArray(v) ? v.join(", ") : v)}</dd>`).join("")}</dl>` : `<p class="sk-fine">No form on file.</p>`}</div>
      <div class="sk-card"><h2 class="sk-h3">Appointments</h2>${upcoming.length ? `<ul class="sk-list">${upcoming.map((b) => `<li><span>${esc(day(b.date))} · ${esc(minsToTime(b.start_min))}<br><small class="sk-fine">${esc((b.services || []).map((s) => SERVICES[s] || s).join(", "))}</small></span><button type="button" class="sk-btn sk-btn-sm" data-session="${b.id}" data-service="${esc((b.services || [])[0] || "")}">Open imaging</button></li>`).join("")}</ul>` : `<p class="sk-fine">Nothing booked on the website. Bookings in GlossGenius: start a session from Imaging.</p>`}</div>
      <div class="sk-card"><h2 class="sk-h3">Recovery check-ins</h2>${(c.recovery || []).length ? `<ul class="sk-list">${c.recovery.slice(0, 6).map((r) => `<li><span>Day ${esc(r.day_after)} · redness ${esc(r.redness ?? "–")}/3, tightness ${esc(r.tightness ?? "–")}/3, comfort ${esc(r.comfort ?? "–")}/3${r.note ? `<br><small class="sk-fine">“${esc(r.note)}”</small>` : ""}</span>${r.flagged ? `<span class="sk-badge sk-badge--bad">Asked you</span>` : ""}</li>`).join("")}</ul>` : `<p class="sk-fine">None yet.</p>`}</div></div></div>`;
  el.querySelector("[data-ci]").addEventListener("submit", async (e) => { e.preventDefault(); try { await api.call("contraindication_add", { profile_id: c.profile.id, note: e.target.note.value }); reload(); } catch (err) { toast(explain(err)); } });
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-session]"); if (b) startSession({ booking_id: b.dataset.session, service_id: b.dataset.service }); });
}

async function startSession(extra = {}) {
  if (!may.capture(current.consents)) { toast("No photography consent yet. Record it in Consents first."); location.hash = `#client/${current.profile.id}/consents`; return; }
  const devices = await api.call("devices").catch(() => ({ devices: [] }));
  const sheet = openSheet({ title: "New imaging session", html: `<form class="sk-fields" data-f>
    <label class="sk-field"><span>Visit label</span><input name="visit_label" placeholder="ProCell #2" value="${esc(extra.service_id ? SERVICES[extra.service_id] || "" : "")}"></label>
    <label class="sk-field"><span>Device</span><select name="device_id">${(devices.devices || []).filter((d) => d.active).map((d) => `<option value="${d.id}">${esc(d.name)}${d.calibration?.um_per_px ? ` · ${d.calibration.um_per_px} µm/px` : ""}</option>`).join("")}</select></label>
    <fieldset class="sk-field" style="border:0;padding:0"><legend>Areas</legend><div class="sk-chips">${STANDARD_SET.concat("custom").map((r) => `<label class="sk-chip"><input type="checkbox" name="regions" value="${r}" ${r !== "custom" ? "checked" : ""}>${esc(regionLabel(r))}</label>`).join("")}</div></fieldset>
    <label class="sk-field"><span>Private note (optional)</span><textarea name="notes_private" maxlength="2000"></textarea></label>
    <button class="sk-btn">Start capture</button></form>` });
  sheet.body.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try {
      const { session: s } = await api.call("session_open", { profile_id: current.profile.id, visit_label: v.visit_label, device_id: v.device_id || null, notes_private: v.notes_private, ...extra });
      sheet.close();
      openCapture({ api, mode: "studio", sessionId: s.id, regions: v.regions, onDone: () => { location.hash = `#client/${current.profile.id}/imaging`; reload(); } });
    } catch (err) { toast(explain(err)); }
  });
}

async function imaging(el, c) {
  const qBy = new Map((c.quality || []).map((q) => [q.capture_id, q]));
  const sessions = [...c.sessions].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  const thumbs = await urls(c.captures.map((x) => x.id), "thumb");
  el.innerHTML = `<div class="sk-row" style="justify-content:space-between;margin-bottom:1rem"><p class="sk-fine">${c.captures.length} photos over ${sessions.length} sessions</p><button type="button" class="sk-btn" data-new>New session</button></div>
    ${sessions.map((s) => { const caps = c.captures.filter((x) => x.session_id === s.id); return `<div class="sk-card" style="margin-bottom:1rem"><div class="sk-card-head"><div><b>${esc(s.visit_label || "Session")}</b> <span class="sk-fine">${esc(day(s.started_at))}${s.service_id ? " · " + esc(SERVICES[s.service_id] || s.service_id) : ""}</span></div><span class="st-pill">${esc(s.status)}</span></div>
      ${s.notes_private ? `<p class="sk-fine">Private note: ${esc(s.notes_private)}</p>` : ""}
      <div class="sk-gallery">${caps.map((x) => { const q = qBy.get(x.id); return `<figure><img src="${esc(thumbs[x.id] || "")}" alt="${esc(regionLabel(x.region))}" loading="lazy">
        <figcaption><b>${esc(regionLabel(x.region))}</b> · ${q ? (q.comparable ? `<span class="sk-badge sk-badge--ok">Comparable</span>` : q.passed ? `<span class="sk-badge sk-badge--exp" title="${esc(q.flags.join(", "))}">${esc(q.flags.join(", ") || "Marginal")}</span>` : `<span class="sk-badge sk-badge--bad" title="${esc(q.flags.join(", "))}">${esc(q.flags.join(", ") || "Failed")}</span>`) : `<span class="sk-badge sk-badge--un">${esc(x.status)}</span>`}
        <div class="sk-row" style="margin-top:.3rem">${x.status !== "excluded" ? `<button type="button" class="sk-link sk-fine" data-q="accept" data-cap="${x.id}">Accept</button><button type="button" class="sk-link sk-fine" data-q="exclude" data-cap="${x.id}">Exclude</button><button type="button" class="sk-link sk-fine" data-scar="${x.id}">Outline scar</button><button type="button" class="sk-link sk-fine" data-analyze="${x.id}">Re-measure</button>` : `<span class="sk-fine">Excluded${x.excluded_reason ? ": " + esc(x.excluded_reason) : ""}</span>`}</div></figcaption></figure>`; }).join("") || `<p class="sk-fine">No photos in this session.</p>`}</div>
      ${s.status === "open" ? `<div class="sk-row" style="margin-top:.8rem"><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-more="${s.id}">Add photos</button><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-submit="${s.id}">Mark reviewed</button></div>` : ""}</div>`; }).join("") || `<p class="sk-empty">No sessions yet.</p>`}`;
  el.addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.closest("[data-new]")) return startSession();
      if (t.closest("[data-more]")) return openCapture({ api, mode: "studio", sessionId: t.closest("[data-more]").dataset.more, onDone: reload });
      if (t.closest("[data-submit]")) { await api.call("session_update", { session_id: t.closest("[data-submit]").dataset.submit, status: "reviewed" }); return reload(); }
      if (t.closest("[data-q]")) { const b = t.closest("[data-q]"); await api.call("quality_review", { capture_id: b.dataset.cap, decision: b.dataset.q }); toast(b.dataset.q === "accept" ? "Accepted for comparison." : "Excluded from comparisons."); return reload(); }
      if (t.closest("[data-analyze]")) { const r = await api.call("analyze", { capture_id: t.closest("[data-analyze]").dataset.analyze }); return toast(r.note || "Queued: new measurements in a minute or two."); }
      if (t.closest("[data-scar]")) return outlineScar(t.closest("[data-scar]").dataset.scar);
    } catch (err) { toast(explain(err)); }
  });
}

async function outlineScar(captureId) {
  const cap = current.captures.find((x) => x.id === captureId);
  const src = (await urls([captureId], "view"))[captureId];
  const sheet = openSheet({ title: "Outline the scar", wide: true, html: `<p class="sk-fine">Tap around the scar's edge. The analysis measures its colour against the skin around it, its texture, and its area. Depth, volume and translucency are not measured from photos.</p>
    <div style="position:relative;max-width:48rem"><img src="${esc(src)}" alt="The photo to outline" style="width:100%;display:block;border-radius:12px" draggable="false"><svg data-svg style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair"></svg></div>
    <div class="sk-row" style="margin-top:.8rem"><button type="button" class="sk-btn sk-btn-quiet sk-btn-sm" data-undo>Undo</button><button type="button" class="sk-btn sk-btn-sm" data-go disabled>Measure this scar</button></div>` });
  const svg = sheet.body.querySelector("[data-svg]"), img = sheet.body.querySelector("img"), pts = [];
  const paint = () => { svg.innerHTML = `<polygon points="${pts.map((p) => `${p[0] * 100}%,${p[1] * 100}%`).join(" ")}" fill="rgba(234,185,200,.25)" stroke="#eab9c8" stroke-width="2"/>` + pts.map((p) => `<circle cx="${p[0] * 100}%" cy="${p[1] * 100}%" r="4" fill="#eab9c8"/>`).join(""); svg.setAttribute("viewBox", ""); sheet.body.querySelector("[data-go]").disabled = pts.length < 3; };
  svg.addEventListener("click", (e) => { const r = img.getBoundingClientRect(); pts.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]); paint(); });
  sheet.body.querySelector("[data-undo]").onclick = () => { pts.pop(); paint(); };
  sheet.body.querySelector("[data-go]").onclick = async () => {
    const W = cap.width || img.naturalWidth, H = cap.height || img.naturalHeight;
    try { const r = await api.call("analyze", { capture_id: captureId, scar_roi: pts.map(([x, y]) => [Math.round(x * W), Math.round(y * H)]) }); toast(r.note || "Queued: scar measurements in a minute or two."); sheet.close(); } catch (err) { toast(explain(err)); }
  };
}

async function evolution(el, c) {
  await renderEvolution(el, {
    data: c, audience: "practitioner", urls,
    onCompare: (a, b) => api.call("compare", { from_capture_id: a, to_capture_id: b }),
    onReviewChange: (id, review_status, share) => api.call("change_review", { id, review_status, shared_with_client: share }),
  });
}

function measurements(el, c) {
  const byCap = new Map();
  for (const m of c.measurements) (byCap.get(m.capture_id) ?? byCap.set(m.capture_id, []).get(m.capture_id)).push(m);
  const caps = c.captures.filter((x) => byCap.has(x.id)).sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)));
  el.innerHTML = `<p class="sk-fine">Verify what looks right; reject what the photo misled (glare, hair, a shadow). Rejected values are never shown to the client. Your notes stay private.</p>
    ${caps.map((x) => `<div class="sk-card" style="margin-top:1rem"><div class="sk-card-head"><b>${esc(regionLabel(x.region))} · ${esc(day(x.captured_at))}</b><span class="sk-fine">${esc(byCap.get(x.id)[0]?.algorithm_version || "")}</span></div>
      <div class="sk-table-wrap"><table class="sk-table"><thead><tr><th>Measurement</th><th>Value</th><th>95% range</th><th>Quality</th><th>Status</th><th></th></tr></thead><tbody>
      ${byCap.get(x.id).map((m) => `<tr><td>${esc(MEASUREMENTS[m.name]?.label || m.name)}${m.region !== x.region ? ` <small class="sk-fine">(${esc(regionLabel(m.region))})</small>` : ""}${m.experimental !== false ? ` <span class="sk-badge sk-badge--exp">exp</span>` : ""}</td>
        <td>${esc(formatValue(m))}</td><td class="sk-fine">${m.uncertainty?.ci95 ? `${(+m.uncertainty.ci95[0]).toFixed(2)}–${(+m.uncertainty.ci95[1]).toFixed(2)}` : "—"}</td><td>${esc(m.quality)}</td>
        <td><span class="sk-badge ${m.review_status === "verified" ? "sk-badge--ok" : m.review_status === "rejected" ? "sk-badge--bad" : "sk-badge--un"}">${esc(m.review_status)}</span></td>
        <td class="sk-row"><button type="button" class="sk-link sk-fine" data-rv="verified" data-id="${m.id}">Verify</button><button type="button" class="sk-link sk-fine" data-rv="rejected" data-id="${m.id}">Reject</button></td></tr>`).join("")}
      </tbody></table></div></div>`).join("") || `<p class="sk-empty">No measurements yet.</p>`}`;
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rv]"); if (!b) return;
    const note = b.dataset.rv === "rejected" ? prompt("Why? (private, optional)") ?? null : null;
    try { await api.call("measurement_review", { id: b.dataset.id, review_status: b.dataset.rv, review_note: note }); const m = c.measurements.find((x) => x.id === b.dataset.id); if (m) m.review_status = b.dataset.rv; measurements(el, c); } catch (err) { toast(explain(err)); }
  });
}

function treatments(el, c) {
  const list = [...c.treatments].sort((a, b) => String(b.treated_at).localeCompare(String(a.treated_at)));
  el.innerHTML = `<div class="sk-row" style="justify-content:space-between;margin-bottom:1rem"><p class="sk-fine">Private to the practitioner. The client sees only the summary line, once signed.</p><button type="button" class="sk-btn" data-new>New treatment record</button></div>
    ${list.map((t) => `<div class="sk-card" style="margin-bottom:.8rem"><div class="sk-card-head"><div><b>${esc(t.treatment_type[0].toUpperCase() + t.treatment_type.slice(1))}${t.series ? ` · ${t.series.session_no} of ${t.series.of}` : ""}</b> <span class="sk-fine">${esc(day(t.treated_at))} ${esc(time(t.treated_at))}</span></div><span class="sk-badge ${t.status === "signed" ? "sk-badge--ok" : t.status === "amended" ? "sk-badge--un" : "sk-badge--exp"}">${esc(t.status)}</span></div>
      <dl class="sk-fine" style="display:grid;grid-template-columns:9rem 1fr;gap:.3rem .8rem;margin:0">
        <dt>Device</dt><dd style="margin:0">${esc(t.device || "—")}</dd><dt>Areas</dt><dd style="margin:0">${esc((t.areas || []).map(regionLabel).join(", ") || "—")}</dd>
        <dt>Depth (mm)</dt><dd style="margin:0">${esc(Object.entries(t.needle_depth_mm || {}).map(([k, v]) => `${regionLabel(k)} ${v}`).join(" · ") || "—")}</dd>
        ${t.rf ? `<dt>RF</dt><dd style="margin:0">${esc([t.rf.device, t.rf.mode, t.rf.energy, t.rf.passes && t.rf.passes + " passes"].filter(Boolean).join(" · "))}</dd>` : ""}
        <dt>Topicals</dt><dd style="margin:0">${esc((t.topicals || []).join(", ") || "—")}</dd><dt>Reactions</dt><dd style="margin:0">${esc(t.reactions || "—")}${t.adverse_event ? ` <span class="sk-badge sk-badge--bad">Adverse event</span>` : ""}</dd>
        <dt>Aftercare given</dt><dd style="margin:0">${esc(t.recovery_guidance || "—")}</dd><dt>Follow-up</dt><dd style="margin:0">${esc(t.follow_up_on ? day(t.follow_up_on) : "—")}</dd>
        <dt>Private notes</dt><dd style="margin:0">${esc(t.notes_private || "—")}</dd><dt>Client sees</dt><dd style="margin:0;color:var(--sk-ink)">${esc(t.client_summary || "—")}</dd></dl>
      <div class="sk-row" style="margin-top:.8rem">${t.status === "draft" ? `<button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-edit="${t.id}">Edit</button><button type="button" class="sk-btn sk-btn-sm" data-sign="${t.id}">Sign</button>` : t.status === "signed" ? `<button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-amend="${t.id}">Amend</button>` : `<span class="sk-fine">Replaced by an amendment</span>`}</div></div>`).join("") || `<p class="sk-empty">No treatment records yet.</p>`}`;
  el.addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.closest("[data-new]")) return treatmentForm();
      if (t.closest("[data-edit]")) return treatmentForm(c.treatments.find((x) => x.id === t.closest("[data-edit]").dataset.edit));
      if (t.closest("[data-amend]")) return treatmentForm(c.treatments.find((x) => x.id === t.closest("[data-amend]").dataset.amend), true);
      if (t.closest("[data-sign]")) { await api.call("treatment_sign", { id: t.closest("[data-sign]").dataset.sign }); toast("Signed. It can no longer be edited; amend it if needed."); reload(); }
    } catch (err) { toast(err.reason === "wording" ? `Reword the client summary: ${err.body.problems.map((p) => p.why).join(" ")}` : explain(err)); }
  });
}

function treatmentForm(t = null, amend = false) {
  if (!may.recordTreatment(current.consents)) { toast("No treatment-records consent yet. Record it in Consents first."); return; }
  const v = t || { treatment_type: "microchanneling", treated_at: new Date().toISOString(), areas: [], needle_depth_mm: {}, topicals: [] };
  const local = new Date(new Date(v.treated_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const sheet = openSheet({ title: amend ? "Amend treatment record" : t ? "Edit draft" : "Treatment record", wide: true, html: `<form class="sk-fields" data-f novalidate>
    <div class="sk-fields sk-fields-2"><label class="sk-field"><span>Treatment</span><select name="treatment_type">${TREATMENT_TYPES.map((x) => `<option ${x === v.treatment_type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="sk-field"><span>When</span><input type="datetime-local" name="treated_at" value="${local}"></label>
      <label class="sk-field"><span>Service</span><select name="service_id"><option value="">—</option>${Object.entries(SERVICES).map(([k, l]) => `<option value="${k}" ${k === v.service_id ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label class="sk-field"><span>Device</span><input name="device" value="${esc(v.device || "ProCell Microchanneling Device")}"></label></div>
    <fieldset class="sk-field" style="border:0;padding:0"><legend>Areas treated, and the depth you set (mm)</legend><div class="st-depths">${AREA_IDS.concat("front").map((r) => `<label class="sk-field"><span><input type="checkbox" name="areas" value="${r}" ${(v.areas || []).includes(r) ? "checked" : ""}> ${esc(regionLabel(r))}</span><input name="depth_${r}" inputmode="decimal" placeholder="mm" value="${esc(v.needle_depth_mm?.[r] ?? "")}"></label>`).join("")}</div>
      <p class="sk-fine">You set the depth. The software records it; it never suggests one. Values over ${MAX_DEPTH_MM} mm are refused as a likely typo.</p></fieldset>
    <details><summary class="sk-fine" style="cursor:pointer">Radiofrequency (when used)</summary><div class="sk-fields sk-fields-2" style="margin-top:.6rem">${["device", "mode", "energy", "passes"].map((k) => `<label class="sk-field"><span>${k[0].toUpperCase() + k.slice(1)}</span><input name="rf_${k}" value="${esc(v.rf?.[k] ?? "")}"></label>`).join("")}</div></details>
    <div class="sk-fields sk-fields-2"><label class="sk-field"><span>Series: session</span><input name="series_no" inputmode="numeric" value="${esc(v.series?.session_no ?? "")}"></label><label class="sk-field"><span>of</span><input name="series_of" inputmode="numeric" value="${esc(v.series?.of ?? "")}"></label></div>
    <label class="sk-field"><span>Topicals used (one per line)</span><textarea name="topicals">${esc((v.topicals || []).join("\n"))}</textarea></label>
    <label class="sk-field"><span>Reactions observed or reported</span><textarea name="reactions">${esc(v.reactions || "")}</textarea></label>
    <label class="sk-switch"><input type="checkbox" name="adverse_event" ${v.adverse_event ? "checked" : ""}><span>Adverse event</span></label>
    <label class="sk-field"><span>Aftercare given</span><textarea name="recovery_guidance">${esc(v.recovery_guidance || "")}</textarea></label>
    <div class="sk-fields sk-fields-2"><label class="sk-field"><span>Follow-up</span><input type="date" name="follow_up_on" value="${esc(v.follow_up_on || "")}"></label></div>
    <label class="sk-field"><span>Private notes</span><textarea name="notes_private">${esc(v.notes_private || "")}</textarea></label>
    <label class="sk-field"><span>What the client sees (one line)</span><input name="client_summary" maxlength="400" value="${esc(v.client_summary || "")}"></label><div data-wording></div>
    <div class="sk-row"><button class="sk-btn">${amend ? "Save the amendment (signed)" : "Save draft"}</button></div></form>` });
  const f = sheet.body.querySelector("[data-f]");
  const wording = () => { const w = checkWording(f.client_summary.value); sheet.body.querySelector("[data-wording]").innerHTML = w.length ? `<p class="st-warn">${esc(w.map((x) => x.why).join(" "))}</p>` : ""; };
  f.client_summary.addEventListener("input", wording); wording();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const x = formValues(f);
    const depth = {}; for (const r of AREA_IDS.concat("front")) if (x["depth_" + r]) depth[r] = x["depth_" + r];
    const treatment = { id: amend ? undefined : t?.id, treatment_type: x.treatment_type, treated_at: new Date(x.treated_at).toISOString(), service_id: x.service_id, device: x.device, areas: x.areas,
      needle_depth_mm: depth, rf: { device: x.rf_device, mode: x.rf_mode, energy: x.rf_energy, passes: x.rf_passes }, series: x.series_no ? { package: x.service_id || null, session_no: x.series_no, of: x.series_of || x.series_no } : null,
      topicals: x.topicals.split("\n").map((s) => s.trim()).filter(Boolean), reactions: x.reactions, adverse_event: x.adverse_event, recovery_guidance: x.recovery_guidance, follow_up_on: x.follow_up_on || null,
      notes_private: x.notes_private, client_summary: x.client_summary };
    const clean = cleanTreatment(treatment);
    if (!clean.ok) return showErrors(f, clean.errors.needle_depth_mm ? { ...clean.errors, ["depth_" + AREA_IDS[0]]: clean.errors.needle_depth_mm } : clean.errors);
    try {
      if (amend) await api.call("treatment_amend", { id: t.id, treatment });
      else await api.call("treatment_save", { profile_id: current.profile.id, treatment });
      sheet.close(); toast(amend ? "Amendment saved and signed." : "Draft saved. Sign it when it's complete."); reload();
    } catch (err) { if (err.body?.errors) showErrors(f, err.body.errors); else toast(explain(err)); }
  });
}

function routine(el, c) {
  const rows = (c.routine || []).filter((e) => e.status !== "stopped");
  el.innerHTML = `<div class="sk-grid-2"><div class="sk-card"><h2 class="sk-h3">Their routine</h2>${rows.length ? `<ul class="sk-list">${rows.map((e) => `<li><span><b>${esc(e.product_name)}</b> <small class="sk-fine">${esc(e.slot.toUpperCase())}${e.how ? " · " + esc(e.how) : ""}</small></span><span class="sk-badge ${e.status === "proposed" ? "sk-badge--exp" : "sk-badge--ok"}">${esc(e.status === "proposed" ? "suggested" : e.source)}</span></li>`).join("")}</ul>` : `<p class="sk-fine">Nothing yet.</p>`}</div>
    <form class="sk-card sk-fields" data-f><h2 class="sk-h3">Suggest a product</h2><p class="sk-fine">It appears in My Skin as your suggestion; it joins their routine only if they add it.</p>
      <label class="sk-field"><span>Product</span><input name="product_name" required maxlength="120"></label>
      <div class="sk-fields sk-fields-2"><label class="sk-field"><span>When</span><select name="slot"><option value="am">Morning</option><option value="pm">Night</option><option value="weekly">Weekly</option></select></label><label class="sk-field"><span>Kind</span><select name="category">${ROUTINE_CATEGORIES.map((x) => `<option>${x}</option>`).join("")}</select></label></div>
      <label class="sk-field"><span>How to use it</span><input name="how" maxlength="300"></label><button class="sk-btn sk-btn-sm">Suggest</button></form></div>`;
  el.querySelector("[data-f]").addEventListener("submit", async (e) => { e.preventDefault(); try { await api.call("routine_propose", { profile_id: c.profile.id, entry: formValues(e.target) }); toast("Suggested."); reload(); } catch (err) { toast(explain(err)); } });
}

async function reports(el, c) {
  const caps = c.captures.filter((x) => x.status === "processed");
  const thumbs = await urls(caps.map((x) => x.id), "thumb");
  el.innerHTML = `<div class="sk-grid-2"><form class="sk-card sk-fields" data-f><h2 class="sk-h3">New progress report</h2>
      <label class="sk-field"><span>Title</span><input name="title" value="Your ProCell series" maxlength="120"></label>
      <fieldset class="sk-field" style="border:0;padding:0"><legend>Photos to include</legend><div class="sk-gallery">${caps.map((x) => `<label style="cursor:pointer"><img src="${esc(thumbs[x.id] || "")}" alt=""><span class="sk-fine"><input type="checkbox" name="images" value="${x.id}"> ${esc(regionLabel(x.region))} · ${esc(shortDay(x.captured_at))}</span></label>`).join("")}</div></fieldset>
      <label class="sk-field"><span>Your summary for them</span><textarea name="summary" maxlength="2000" placeholder="In your words: how the series went, what you see, what's next."></textarea></label><div data-wording></div>
      <p class="sk-fine">Included automatically: measurements you verified, changes you confirmed and chose to share, each signed treatment's summary line, and their routine.</p>
      <button class="sk-btn">Prepare draft</button></form>
    <div class="sk-card"><h2 class="sk-h3">Reports</h2>${(c.reports || []).length ? `<ul class="sk-list">${c.reports.map((r) => `<li><span><b>${esc(r.title)}</b><br><small class="sk-fine">${esc(day(r.created_at))}</small></span><span class="sk-row"><span class="sk-badge ${r.status === "approved" ? "sk-badge--ok" : r.status === "draft" ? "sk-badge--exp" : "sk-badge--un"}">${esc(r.status)}</span><a class="sk-link sk-fine" href="report.html?id=${encodeURIComponent(r.id)}&studio=1" target="_blank" rel="noopener">Preview</a>${r.status === "draft" ? `<button type="button" class="sk-btn sk-btn-sm" data-approve="${r.id}">Approve</button>` : ""}${r.status !== "withdrawn" ? `<button type="button" class="sk-link sk-fine" data-withdraw="${r.id}">${r.status === "draft" ? "Delete" : "Withdraw"}</button>` : ""}</span></li>`).join("")}</ul>` : `<p class="sk-fine">None yet.</p>`}</div></div>`;
  const f = el.querySelector("[data-f]");
  f.summary.addEventListener("input", () => { const w = checkWording(f.summary.value); el.querySelector("[data-wording]").innerHTML = w.length ? `<p class="st-warn">${esc(w.map((x) => x.why).join(" "))}</p>` : ""; });
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(f);
    try { const r = await api.call("report_draft", { profile_id: c.profile.id, title: v.title, summary: v.summary, image_capture_ids: v.images }); toast(r.problems.length ? "Draft saved; reword the summary before approving." : "Draft ready. Preview it, then approve."); reload(); } catch (err) { toast(explain(err)); }
  });
  el.addEventListener("click", async (e) => {
    try {
      if (e.target.closest("[data-approve]")) { await api.call("report_approve", { id: e.target.closest("[data-approve]").dataset.approve }); toast("Approved. They can see it in My Skin."); reload(); }
      if (e.target.closest("[data-withdraw]")) { await api.call("report_withdraw", { id: e.target.closest("[data-withdraw]").dataset.withdraw }); reload(); }
    } catch (err) { toast(err.reason === "wording" ? `Reword the summary: ${err.body.problems.map((p) => p.why).join(" ")}` : explain(err)); }
  });
}

async function consents(el, c) {
  el.innerHTML = `<div class="sk-grid-2"><div class="sk-card"><h2 class="sk-h3">In force</h2><ul class="sk-list">${CONSENT_KINDS.map((k) => `<li><span>${esc(CONSENT_LABELS[k])}</span><span class="sk-badge ${c.consents[k].active ? "sk-badge--ok" : "sk-badge--un"}">${c.consents[k].active ? "Yes · " + esc(shortDay(c.consents[k].recorded_at)) : c.consents[k].granted === false ? "No" : c.consents[k].withdrawn_at ? "Withdrawn" : "Not asked"}</span></li>`).join("")}</ul>
      <h3 class="sk-h3" style="margin-top:1rem">History</h3><ul class="sk-list">${(c.consent_history || []).map((h) => `<li><span class="sk-fine">${esc(CONSENT_LABELS[h.kind])}: ${h.granted ? "yes" : "no"}${h.withdrawn_at ? ", withdrawn " + esc(shortDay(h.withdrawn_at)) : ""} · v${esc(h.version)}</span><span class="sk-fine">${esc(h.source)} · ${esc(shortDay(h.recorded_at))}</span></li>`).join("")}</ul></div>
    <form class="sk-card sk-fields" data-f><h2 class="sk-h3">Record a consent in person</h2><p class="sk-fine">Show the client the exact text (in My Skin → Privacy, or on your screen), then record their answer and typed name.</p>
      <label class="sk-field"><span>Consent</span><select name="kind">${CONSENT_KINDS.map((k) => `<option value="${k}">${esc(CONSENT_LABELS[k])}</option>`).join("")}</select></label>
      <label class="sk-field"><span>Their answer</span><select name="granted"><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label class="sk-field"><span>Their full name, typed by them</span><input name="signature" autocomplete="off"></label>
      <input type="hidden" name="version" value="1-draft"><button class="sk-btn sk-btn-sm">Record</button>
      <p class="sk-fine">Version 1-draft is for testing; counsel's approved wording goes in as version 1 before any real client signs.</p></form></div>`;
  el.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api.call("consent_record", { profile_id: c.profile.id, kind: v.kind, granted: v.granted === "yes", version: v.version, signature: v.signature }); toast("Recorded."); reload(); }
    catch (err) { if (err.reason === "text_changed") { e.target.version.value = err.body.current?.version || "1-draft"; toast("The consent text has a newer version; show it again, then record."); } else if (err.body?.errors) showErrors(e.target, err.body.errors); else toast(explain(err)); }
  });
}

/* ── Admin ── */
const ADMIN = [["analytics", "Analytics"], ["staff", "Staff"], ["devices", "Devices"], ["validation", "Validation"], ["privacy", "Data requests"], ["audit", "Audit log"], ["settings", "Settings"]];

async function admin(tab) {
  if (me.staff.role !== "admin") { main.innerHTML = `<p class="sk-empty sk-section">Admins only.</p>`; return; }
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Admin</p><h1 class="sk-h1">The clinic.</h1>
    <div class="st-tabs" role="tablist">${ADMIN.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join("")}</div><div data-panel></div></section>`;
  main.querySelector(".st-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) location.hash = `#admin/${b.dataset.tab}`; });
  const el = main.querySelector("[data-panel]");
  await ({ analytics: adminAnalytics, staff: adminStaff, devices: adminDevices, validation: adminValidation, privacy: adminPrivacy, audit: adminAudit, settings: adminSettings })[tab](el);
}

async function adminAnalytics(el) {
  const a = await api.call("analytics");
  const months = Object.entries(a.sessions_by_month).sort();
  const max = Math.max(1, ...months.map(([, n]) => n));
  el.innerHTML = `<div class="st-kpis">${[["Enrolled clients", a.enrolled_clients], ["Imaging sessions", a.imaging_sessions], ["Clients imaged twice or more", a.clients_with_repeat_imaging], ["Photos", a.captures], ["Quality failures", a.quality_failure_rate == null ? "—" : a.quality_failure_rate + "%"], ["Awaiting your review", a.measurements_awaiting_review],
      ["Follow-ups completed", a.follow_up_completion_rate == null ? "—" : a.follow_up_completion_rate + "%"], ["Series in progress", a.series_in_progress], ["Series completed", a.series_completed], ["Reports approved", a.reports_approved], ["Recovery flags", a.recovery_flags]].map(([k, v]) => `<div class="st-kpi"><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join("")}</div>
    <div class="sk-grid-2" style="margin-top:1rem"><div class="sk-card"><h2 class="sk-h3">Sessions by month</h2><svg viewBox="0 0 ${Math.max(1, months.length) * 48} 120" style="width:100%;height:auto" role="img" aria-label="Imaging sessions by month">${months.map(([m, n], i) => `<rect x="${i * 48 + 8}" y="${100 - (n / max) * 86}" width="32" height="${(n / max) * 86}" rx="4" fill="var(--sk-chart-line)"><title>${m}: ${n}</title></rect><text x="${i * 48 + 24}" y="116" text-anchor="middle" font-size="10" fill="var(--sk-chart-text)">${m.slice(5)}</text>`).join("")}</svg></div>
    <div class="sk-card"><h2 class="sk-h3">Why photos failed quality</h2>${Object.keys(a.quality_flags).length ? `<ul class="sk-list">${Object.entries(a.quality_flags).map(([k, n]) => `<li><span>${esc(k.replace("_", " "))}</span><b>${n}</b></li>`).join("")}</ul>` : `<p class="sk-fine">No failures.</p>`}</div></div>
    <p class="sk-fine" style="margin-top:1rem">${esc(a.note)} Business reports stay in the Lumevina Studio dashboard.</p>`;
}

async function adminStaff(el) {
  const s = await api.call("staff_list");
  el.innerHTML = `<div class="sk-grid-2"><div class="sk-card"><h2 class="sk-h3">Staff</h2><ul class="sk-list">${s.staff.map((x) => `<li><span><b>${esc(x.display_name)}</b><br><small class="sk-fine">${esc(x.email)}</small></span><span class="sk-row"><span class="st-pill">${esc(x.role)}</span>${x.active ? "" : `<span class="sk-badge sk-badge--un">inactive</span>`}</span></li>`).join("")}</ul></div>
    <form class="sk-card sk-fields" data-f><h2 class="sk-h3">Add or change</h2><p class="sk-fine">They sign in once at this page with their email first; then add them here. Everyone needs an authenticator app.</p>
      <label class="sk-field"><span>Email</span><input type="email" name="email" required></label><label class="sk-field"><span>Name</span><input name="display_name" required></label>
      <label class="sk-field"><span>Role</span><select name="role"><option value="practitioner">Practitioner: clients' imaging and treatment records</option><option value="admin">Admin: also staff, devices, validation, privacy, audit</option></select></label>
      <label class="sk-switch"><input type="checkbox" name="active" checked><span>Active</span></label><button class="sk-btn sk-btn-sm">Save</button></form></div>`;
  el.querySelector("[data-f]").addEventListener("submit", async (e) => { e.preventDefault(); try { await api.call("staff_set", formValues(e.target)); toast("Saved."); adminStaff(el); } catch (err) { toast(explain(err)); } });
}

async function adminDevices(el) {
  const d = await api.call("devices");
  el.innerHTML = `<div class="sk-grid-2"><div class="sk-card"><h2 class="sk-h3">Imaging devices</h2><ul class="sk-list">${d.devices.map((x) => `<li><span><b>${esc(x.name)}</b><br><small class="sk-fine">${esc(x.kind.replace("_", " "))}${x.model ? " · " + esc(x.model) : ""}</small></span><span>${x.calibration?.um_per_px ? `<span class="sk-badge sk-badge--ok">${esc(x.calibration.um_per_px)} µm/px</span>` : `<span class="sk-badge sk-badge--un">uncalibrated</span>`}</span></li>`).join("")}</ul>
      <p class="sk-fine">Advertised magnification is not calibration. Photograph a ruler or calibration slide at the working distance and measure how many micrometres one pixel covers.</p></div>
    <form class="sk-card sk-fields" data-f><h2 class="sk-h3">Add a device</h2>
      <label class="sk-field"><span>Name</span><input name="name" required></label><label class="sk-field"><span>Kind</span><select name="kind">${DEVICE_KINDS.map((k) => `<option value="${k}">${k.replace("_", " ")}</option>`).join("")}</select></label>
      <label class="sk-field"><span>Model</span><input name="model"></label>
      <div class="sk-fields sk-fields-2"><label class="sk-field"><span>Micrometres per pixel</span><input name="um" inputmode="decimal"></label><label class="sk-field"><span>Measured with</span><input name="method" placeholder="0.1 mm calibration slide"></label></div>
      <div class="sk-fields sk-fields-2"><label class="sk-field"><span>Light source</span><input name="light"></label><label class="sk-field"><span>Colour temperature (K)</span><input name="k" inputmode="numeric"></label></div>
      <label class="sk-switch"><input type="checkbox" name="polarized"><span>Cross-polarized</span></label><button class="sk-btn sk-btn-sm">Add</button></form></div>`;
  el.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api.call("device_set", { device: { name: v.name, kind: v.kind, model: v.model, calibration: v.um ? { um_per_px: v.um, method: v.method } : null, lighting: { source: v.light, color_temp_k: v.k, polarized: v.polarized } } }); toast("Added."); adminDevices(el); } catch (err) { if (err.body?.errors) showErrors(e.target, err.body.errors); else toast(explain(err)); }
  });
}

async function adminValidation(el) {
  const d = await api.call("devices");
  const rows = d.validation || [];
  el.innerHTML = `<div class="sk-card"><h2 class="sk-h3">Measurement validation</h2><p class="sk-fine">A measurement is trusted for change detection only once the repeatability protocol (skin-intelligence/VALIDATION.md) has given it a threshold for that area and kind of device. Everything else stays experimental.</p>
      <div class="sk-table-wrap"><table class="sk-table"><thead><tr><th>Measurement</th><th>Area</th><th>Device</th><th>Status</th><th>Threshold (RC)</th><th>People × repeats</th><th>Notes</th></tr></thead><tbody>
      ${MEASUREMENT_NAMES.flatMap((n) => { const v = rows.filter((r) => r.name === n); return v.length ? v.map((r) => `<tr><td>${esc(MEASUREMENTS[n].label)}</td><td>${esc(r.region === "any" ? "any" : regionLabel(r.region))}</td><td>${esc(r.device_kind)}</td><td><span class="sk-badge ${r.status === "validated" ? "sk-badge--ok" : "sk-badge--exp"}">${esc(r.status)}</span></td><td>${r.repeatability_coefficient != null ? esc((+r.repeatability_coefficient).toPrecision(3)) : "—"}</td><td>${esc(r.n_subjects ?? "—")} × ${esc(r.n_repeats ?? "—")}</td><td class="sk-fine">${esc(r.notes || r.note || "")}</td></tr>`) : [`<tr><td>${esc(MEASUREMENTS[n].label)}</td><td>—</td><td>—</td><td><span class="sk-badge sk-badge--exp">experimental</span></td><td>—</td><td>—</td><td></td></tr>`]; }).join("")}
      </tbody></table></div></div>
    <p class="sk-fine" style="margin-top:.8rem">Results come in from <span class="st-code">worker/scripts/repeatability.py --publish</span> after a protocol run; entering them by hand is deliberately not offered here.</p>`;
}

async function adminPrivacy(el) {
  const r = await api.call("data_requests");
  el.innerHTML = `<div class="sk-card"><h2 class="sk-h3">Data requests</h2>${r.requests.length ? `<ul class="sk-list">${r.requests.map((x) => `<li><span><b>${esc(x.kind === "delete" ? "Delete" : "Copy of data")}</b> · ${esc(x.email)}<br><small class="sk-fine">${esc(day(x.requested_at))}${x.note ? " · “" + esc(x.note) + "”" : ""}${x.resolution ? " · " + esc(x.resolution) : ""}</small></span>
      ${x.status === "open" ? `<span class="sk-row"><label class="sk-switch sk-fine"><input type="checkbox" data-keep="${x.id}" checked>Keep signed treatment records</label><button type="button" class="sk-btn sk-btn-sm sk-btn-danger" data-done="${x.id}">Complete</button><button type="button" class="sk-link sk-fine" data-decline="${x.id}">Decline</button></span>` : `<span class="sk-badge sk-badge--ok">${esc(x.status)}</span>`}</li>`).join("")}</ul>` : `<p class="sk-fine">No requests.</p>`}
    <p class="sk-fine">Completing a deletion removes the client's photos and everything derived from them, their routine, check-ins and reports. Consents and the audit log stay as the record of what was agreed and done. How long signed treatment records must be kept is a legal question (see PRIVACY-SECURITY.md).</p></div>`;
  el.querySelectorAll("[data-done]").forEach((b) => twoTap(b, "Tap again: delete", async () => { try { const r = await api.call("data_request_complete", { id: b.dataset.done, keep_treatments: el.querySelector(`[data-keep="${b.dataset.done}"]`).checked }); toast(r.request.resolution || "Done."); adminPrivacy(el); } catch (err) { toast(explain(err)); } }));
  el.addEventListener("click", async (e) => { const b = e.target.closest("[data-decline]"); if (b) { const why = prompt("Why? (sent with the reply)"); if (why == null) return; await api.call("data_request_complete", { id: b.dataset.decline, status: "declined", resolution: why }); adminPrivacy(el); } });
}

async function adminAudit(el, filter = "") {
  const r = await api.call("audit", filter ? { action_prefix: filter } : {});
  el.innerHTML = `<div class="sk-card"><div class="sk-card-head"><h2 class="sk-h3">Audit log</h2><div class="sk-seg" role="radiogroup">${[["", "All"], ["studio.capture", "Image views"], ["studio.treatment", "Treatments"], ["client.", "Clients"], ["studio.denied", "Refused"]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${k === filter}" data-f="${k}">${l}</button>`).join("")}</div></div>
    <div class="sk-table-wrap"><table class="sk-table st-audit"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Client</th><th>Outcome</th></tr></thead><tbody>${r.entries.map((x) => `<tr><td>${esc(day(x.at))} ${esc(time(x.at))}</td><td>${esc(x.actor_role)}</td><td>${esc(x.action)}</td><td class="sk-fine">${esc(String(x.profile_id || "").slice(0, 8))}</td><td>${esc(x.outcome)}</td></tr>`).join("") || `<tr><td colspan="5" class="sk-fine">Nothing yet.</td></tr>`}</tbody></table></div>
    <p class="sk-fine">Append-only: entries can't be edited or deleted, except by the retention run after the period set in Settings.</p></div>`;
  el.querySelector(".sk-seg").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) adminAudit(el, b.dataset.f); });
}

async function adminSettings(el) {
  const s = me.settings || {};
  el.innerHTML = `<form class="sk-card sk-fields" data-f style="max-width:36rem"><h2 class="sk-h3">Settings</h2>
    <label class="sk-field"><span>Which clients a practitioner opens</span><select name="assignment_mode"><option value="all" ${s.assignment_mode !== "assigned" ? "selected" : ""}>Every enrolled client (a solo studio)</option><option value="assigned" ${s.assignment_mode === "assigned" ? "selected" : ""}>Only clients assigned to them</option></select></label>
    <label class="sk-field"><span>How long an image link works (seconds)</span><input name="signed_url_seconds" inputmode="numeric" value="${esc(s.signed_url_seconds ?? 300)}"></label>
    <button class="sk-btn sk-btn-sm">Save</button></form>`;
  el.querySelector("[data-f]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api.call("settings_set", { key: "assignment_mode", value: v.assignment_mode }); await api.call("settings_set", { key: "signed_url_seconds", value: Number(v.signed_url_seconds) }); me = null; toast("Saved."); } catch (err) { toast(explain(err)); }
  });
}

boot();
