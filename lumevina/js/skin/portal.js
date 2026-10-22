/* Lumevina Skin Intelligence — My Skin, the client's portal (my-skin.html)
 *
 * Home · My skin profile · Skin Evolution · Appointments · Routine · Orders ·
 * Reports · Privacy. Everything comes from functions/skin with the client's
 * own sign-in (or the demo record), and nothing here decides what they may
 * see: the function does.
 */

import { createSession, LIVE } from "./session.js";
import { createApi, explain } from "./api.js";
import { esc, $, day, shortDay, minsToTime, money, toast, openSheet, twoTap, formValues, showErrors, busy } from "./ui.js";
import { CONSENT_KINDS, CONSENT_LABELS, may } from "./core/consent.js";
import { CONCERNS, cleanSkinProfile, cleanRoutineEntry, ROUTINE_CATEGORIES } from "./core/validate.js";
import { regionLabel, STANDARD_SET } from "./core/regions.js";
import { renderEvolution, evolutionHighlights } from "./evolution-view.js";
import { openCapture } from "./capture.js";

const session = createSession("client");
const api = createApi("skin", session);
const main = $("#sk-main");
const SERVICES = { "procell-microchanneling": "ProCell Microchanneling", "procell-package": "ProCell Package", "procell-package-rebook": "ProCell Package · next session", "lumevina-custom-facial": "Custom Facial" };
const service = (id) => SERVICES[id] || String(id || "").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const ROUTES = ["home", "profile", "evolution", "appointments", "routine", "orders", "reports", "privacy"];
let me = null;

async function boot() {
  const arrived = await session.arrive();
  if (arrived.error) toast(arrived.error);
  if (!LIVE) $("#sk-banner").innerHTML = `<div class="sk-banner sk-banner--demo" role="note"><span class="sk-badge sk-badge--syn">Demo</span><div><b>You're looking at a demonstration.</b> The client, photos and numbers are synthetic: generated textures, measured by Lumevina's real analysis. Changes you make stay in this browser. <button type="button" class="sk-link" data-reset>Start the demo over</button></div></div>`;
  $("#sk-banner").addEventListener("click", async (e) => { if (e.target.closest("[data-reset]")) { (await import("./demo-backend.js")).resetDemo(); location.reload(); } });
  window.addEventListener("hashchange", route);
  await route();
}

async function route() {
  const r = (location.hash.slice(1) || "home").split("/")[0];
  const page = ROUTES.includes(r) ? r : "home";
  document.querySelectorAll(".sk-nav a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + page ? "page" : "false"));
  if (LIVE && !session.signedIn()) return signIn();
  try {
    me = await api.call("me");
    $("#sk-who").innerHTML = `<span>${esc(me.profile?.name || session.who()?.name || me.email)}</span>`;
    if (!me.profile && page !== "privacy") return start();
    main.setAttribute("aria-busy", "true");
    await ({ home, profile, evolution, appointments, routine, orders, reports, privacy })[page]();
  } catch (e) {
    if (e.reason === "sign_in") return signIn();
    main.innerHTML = `<div class="sk-section"><p class="sk-empty">${esc(explain(e))}</p></div>`;
  } finally { main.removeAttribute("aria-busy"); main.focus({ preventScroll: true }); }
}

function signIn() {
  main.innerHTML = `<section class="sk-section"><div class="sk-card" style="max-width:32rem;margin:2rem auto">
    <p class="sk-kicker">My Skin</p><h1 class="sk-h2">Sign in to see your skin record</h1>
    <p class="sk-lede">We'll email you a link. No password.</p>
    <form class="sk-fields" data-signin novalidate><label class="sk-field"><span>Your email</span><input type="email" name="email" autocomplete="email" required></label>
    <button class="sk-btn" type="submit">Email me a sign-in link</button><p class="sk-fine" role="status" data-st></p></form></div></section>`;
  main.querySelector("[data-signin]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim(), stEl = e.target.querySelector("[data-st]");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErrors(e.target, { email: "Check your email address." }); return; }
    try { await session.sendLink(email); stEl.textContent = "Check your email for the link. It opens this page, signed in."; }
    catch (err) { stEl.textContent = err.status === 429 ? "A link was just sent. Check your inbox." : "That didn't work. Try again in a moment."; }
  });
}

function consentCard(kind, compact = false) {
  const t = me.texts[kind], s = me.consents[kind];
  if (!t) return "";
  return `<div class="sk-consent" data-consent="${kind}">
    <div class="sk-card-head" style="margin:0"><b>${esc(t.title)}</b><span class="sk-consent-state ${s.active ? "on" : "off"}">${s.active ? `Yes · ${esc(shortDay(s.recorded_at))}` : s.granted === false ? "No" : s.withdrawn_at ? "Withdrawn" : "Not answered"}</span></div>
    ${compact ? "" : `<div class="sk-consent-body">${esc(t.body)}</div>`}
    <form class="sk-row" data-consent-form>
      ${s.active ? `<button type="button" class="sk-btn sk-btn-sm sk-btn-danger" data-withdraw>Withdraw</button>` : `
        <label class="sk-field" style="flex:1 1 14rem"><span class="sk-vh">Type your full name to sign</span><input name="signature" placeholder="Type your full name to sign" autocomplete="name"></label>
        <button type="submit" class="sk-btn sk-btn-sm">I agree</button><button type="button" class="sk-btn sk-btn-sm sk-btn-ghost" data-no>No thanks</button>`}
    </form><p class="sk-fine" style="margin:.4rem 0 0">Version ${esc(t.version)}</p></div>`;
}

function bindConsents(root, after) {
  root.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-consent-form]"); if (!f) return;
    e.preventDefault();
    const kind = f.closest("[data-consent]").dataset.consent;
    try { me.consents = (await api.call("consent", { kind, granted: true, version: me.texts[kind].version, signature: f.signature.value })).consents; toast("Thank you. Saved."); after(); }
    catch (err) { if (err.body?.errors) showErrors(f, err.body.errors); else toast(explain(err)); }
  });
  root.addEventListener("click", async (e) => {
    const box = e.target.closest("[data-consent]"); if (!box) return;
    const kind = box.dataset.consent;
    if (e.target.closest("[data-no]")) { me.consents = (await api.call("consent", { kind, granted: false, version: me.texts[kind].version })).consents; toast("Saved: no."); after(); }
    if (e.target.closest("[data-withdraw]")) { me.consents = (await api.call("consent_withdraw", { kind })).consents; toast("Withdrawn."); after(); }
  });
}

async function start() {
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">My Skin</p><h1 class="sk-h1">Your skin, <em>visit by visit.</em></h1>
    <p class="sk-lede">A private record of how your skin looks over time: photos from each visit and your own, side by side, with careful measurements your practitioner reviews. Only you and the practitioner caring for you see it. It's never shared, never posted, and never sent to an AI service.</p>
    <div class="sk-card" style="max-width:44rem"><h2 class="sk-h2">Start your record</h2>
    <p class="sk-fine">Read each part and answer yes or no. You can change your mind any time in Privacy.</p>
    <div class="sk-stack" data-consents>${["clinical_photography", "treatment"].map((k) => consentCard(k)).join("")}</div>
    <div class="sk-row" style="margin-top:1rem"><button type="button" class="sk-btn" data-enroll>Start my record</button></div></div></section>`;
  bindConsents(main, start);
  main.querySelector("[data-enroll]").addEventListener("click", async (e) => {
    await busy(e.target, "Starting…", async () => { await api.call("enroll"); location.hash = "#home"; await route(); });
  });
}

/* ── Home ── */
async function home() {
  const [ev, appts, rt, reps] = await Promise.all([api.call("evolution"), api.call("appointments"), api.call("routine"), api.call("reports")]);
  const caps = ev.captures.filter((c) => c.status !== "excluded");
  const last = [...ev.sessions].sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  const region = caps.filter((c) => c.region === "left_cheek").length ? "left_cheek" : caps[0]?.region;
  const hi = region ? evolutionHighlights(ev, region) : [];
  const lastThumb = last ? caps.filter((c) => c.session_id === last.id)[0] : null;
  const thumbUrl = lastThumb ? (await api.call("image_urls", { capture_ids: [lastThumb.id], kind: "thumb" })).urls[lastThumb.id] : null;
  const next = appts.upcoming[0];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCheck = rt.checkins.find((c) => c.on_date === todayKey);
  const proposed = rt.entries.filter((e) => e.status === "proposed").length;
  main.innerHTML = `<section class="sk-section">
    <p class="sk-kicker">My Skin</p><h1 class="sk-h1">Hi${me.profile?.name ? ", " + esc(me.profile.name.split(" ")[0]) : ""}.</h1>
    <p class="sk-lede">${ev.sessions.length ? `${ev.sessions.length} visit${ev.sessions.length > 1 ? "s" : ""} in your record since ${esc(day(ev.sessions[0]?.started_at))}.` : "Your record starts at your next visit."}</p>
    <div class="sk-grid">
      <a class="sk-card sk-card--link" href="#evolution"><p class="sk-kicker">Skin Evolution</p>
        ${thumbUrl ? `<img src="${esc(thumbUrl)}" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;margin:.3rem 0 .6rem">` : ""}
        <b>${last ? esc(last.visit_label || "Last visit") + " · " + esc(day(last.started_at)) : "No photos yet"}</b>
        <div style="margin-top:.6rem">${hi.filter((h) => h.last).map((h) => `<div class="sk-row" style="justify-content:space-between"><span class="sk-fine">${esc(h.label)} · ${esc(h.region)}</span>${h.spark}</div>`).join("")}</div></a>
      <div class="sk-card"><p class="sk-kicker">Next appointment</p>${next ? `<b>${esc(day(next.date, { weekday: "long", month: "long", day: "numeric" }))}</b><p class="sk-muted" style="margin:.2rem 0">${esc(minsToTime(next.start_min))} · ${esc((next.services || []).map(service).join(", "))}</p>` : `<p class="sk-muted">Nothing booked.</p>`}
        <a class="sk-btn sk-btn-sm sk-btn-ghost" href="index.html#services" style="margin-top:.6rem">Book</a></div>
      <div class="sk-card"><p class="sk-kicker">Today's routine</p>
        <form class="sk-row" data-today><label class="sk-chip"><input type="checkbox" name="am_done" ${todayCheck?.am_done ? "checked" : ""}>Morning done</label><label class="sk-chip"><input type="checkbox" name="pm_done" ${todayCheck?.pm_done ? "checked" : ""}>Night done</label></form>
        <p class="sk-fine">${proposed ? `<a href="#routine">${proposed} suggestion${proposed > 1 ? "s" : ""} from Evelyn to look at</a>` : "Logging is optional and only for you and Evelyn."}</p></div>
      <a class="sk-card sk-card--link" href="#reports"><p class="sk-kicker">Reports</p><b>${reps.reports.length ? esc(reps.reports[0].title) : "No reports yet"}</b><p class="sk-fine">${reps.reports.length ? "Approved " + esc(day(reps.reports[0].approved_at)) : "Your practitioner prepares one after a series."}</p></a>
      <div class="sk-card"><p class="sk-kicker">Add your own photos</p><p class="sk-fine">Between visits, in daylight, the same way each time. They join your record privately.</p>
        <button type="button" class="sk-btn sk-btn-sm" data-add ${may.capture(me.consents) ? "" : "disabled"}>Add photos</button>
        ${may.capture(me.consents) ? "" : `<p class="sk-fine"><a href="#privacy">Agree to photos for your record first</a></p>`}</div>
    </div></section>`;
  main.querySelector("[data-today]").addEventListener("change", async (e) => {
    const f = e.currentTarget;
    try { await api.call("checkin", { on_date: todayKey, am_done: f.am_done.checked, pm_done: f.pm_done.checked }); toast("Logged."); } catch (err) { toast(explain(err)); }
  });
  main.querySelector("[data-add]")?.addEventListener("click", () => addPhotos());
}

function addPhotos() {
  const sheet = openSheet({ title: "Which photos?", html: `<p class="sk-fine">The full set takes about two minutes. Or add just one area.</p>
    <div class="sk-row" style="margin:.8rem 0"><button type="button" class="sk-btn" data-set="all">The full set</button></div>
    <div class="sk-chips">${STANDARD_SET.map((r) => `<button type="button" class="sk-chip" data-set="${r}">${esc(regionLabel(r))}</button>`).join("")}</div>` });
  sheet.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]"); if (!b) return;
    sheet.close();
    openCapture({ api, mode: "client", regions: b.dataset.set === "all" ? STANDARD_SET : [b.dataset.set], onDone: () => location.hash === "#evolution" ? route() : null });
  });
}

/* ── My skin profile ── */
async function profile() {
  const ev = await api.call("timeline");
  const p = me.profile;
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">My skin profile</p><h1 class="sk-h1">What you're working on.</h1>
    <div class="sk-grid-2">
      <form class="sk-card sk-fields" data-profile novalidate>
        <label class="sk-field"><span>Your goals</span><textarea name="goals" maxlength="600">${esc(p.goals || "")}</textarea></label>
        <fieldset class="sk-field" style="border:0;padding:0;margin:0"><legend>What you'd like to work on</legend><div class="sk-chips">${CONCERNS.map((c) => `<label class="sk-chip"><input type="checkbox" name="concerns" value="${esc(c)}" ${(p.concerns || []).includes(c) ? "checked" : ""}>${esc(c)}</label>`).join("")}</div></fieldset>
        <label class="sk-field"><span>Your skin's history</span><textarea name="skin_history" maxlength="1500">${esc(p.skin_history || "")}</textarea></label>
        <label class="sk-field"><span>Sensitivities and allergies</span><textarea name="sensitivities" maxlength="800">${esc(p.sensitivities || "")}</textarea></label>
        <label class="sk-field"><span>What you use now</span><textarea name="current_products" maxlength="1500">${esc(p.current_products || "")}</textarea></label>
        <label class="sk-field"><span>Treatments you've had before (here or elsewhere)</span><textarea name="prior_procedures" maxlength="1500">${esc(p.prior_procedures || "")}</textarea></label>
        <label class="sk-switch"><input type="checkbox" name="email_when_report_ready" ${p.privacy?.email_when_report_ready ? "checked" : ""}><span>Email me when a progress report is ready</span></label>
        <p class="sk-fine">Medicines, pregnancy and health conditions belong on your pre-visit form, where only Evelyn reads them.</p>
        <div class="sk-row"><button class="sk-btn" type="submit">Save</button></div>
      </form>
      <div class="sk-stack">
        <div class="sk-card"><h2 class="sk-h3">Noted by your practitioner</h2>${(p.contraindications || []).length ? `<ul class="sk-list">${p.contraindications.map((c) => `<li><span>${esc(c.note)}</span><span class="sk-fine">${esc(shortDay(c.at))}</span></li>`).join("")}</ul>` : `<p class="sk-fine">Nothing noted.</p>`}</div>
        <div class="sk-card"><h2 class="sk-h3">Treatment history</h2>${ev.treatments.length ? `<ul class="sk-list">${ev.treatments.slice().reverse().map((t) => `<li><div><b>${esc(t.summary || t.treatment_type)}</b><div class="sk-fine">${esc(t.recovery_guidance || "")}</div></div><span class="sk-fine">${esc(day(t.treated_at))}</span></li>`).join("")}</ul>` : `<p class="sk-fine">No treatments recorded yet.</p>`}
          <p class="sk-fine">You see the summary your practitioner writes. Ask any time for a full copy of a treatment record.</p></div>
      </div></div></section>`;
  main.querySelector("[data-profile]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formValues(e.target);
    const body = { ...v, privacy: { email_when_report_ready: v.email_when_report_ready } };
    const clean = cleanSkinProfile(body);
    if (!clean.ok) return showErrors(e.target, clean.errors);
    try { me.profile = (await api.call("profile_save", { profile: body })).profile; toast("Saved."); } catch (err) { toast(explain(err)); }
  });
}

/* ── Skin Evolution ── */
async function evolution() {
  const ev = await api.call("evolution");
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Skin Evolution</p>
    <div class="sk-row" style="justify-content:space-between;align-items:flex-end"><h1 class="sk-h1" style="margin-bottom:0">Visit 1 to <em>today.</em></h1>
    <button type="button" class="sk-btn sk-btn-sm sk-btn-quiet sk-noprint" data-add ${may.capture(me.consents) ? "" : "disabled"}>Add photos</button></div>
    <p class="sk-lede">Real photos from each visit. Measurements are shown with how sure they are; anything not yet validated is marked experimental, and differences small enough to come from the photo itself are called no meaningful change.</p>
    <div data-evo></div></section>`;
  main.querySelector("[data-add]")?.addEventListener("click", () => addPhotos());
  await renderEvolution(main.querySelector("[data-evo]"), {
    data: ev, audience: "client",
    urls: async (ids, kind, ref) => (await api.call("image_urls", { capture_ids: ids, kind, reference_id: ref })).urls,
  });
}

/* ── Appointments ── */
async function appointments() {
  const a = await api.call("appointments");
  const row = (b) => `<li><div><b>${esc(day(b.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }))}</b> · ${esc(minsToTime(b.start_min))}<div class="sk-fine">${esc((b.services || []).map(service).join(", "))}</div></div><span class="sk-badge ${b.status === "completed" ? "sk-badge--ok" : b.status === "cancelled" ? "sk-badge--un" : "sk-badge--exp"}">${esc(b.status === "held" ? "booked" : b.status)}</span></li>`;
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Appointments</p><h1 class="sk-h1">Your visits.</h1>
    <div class="sk-grid-2"><div class="sk-card"><h2 class="sk-h3">Coming up</h2>${a.upcoming.length ? `<ul class="sk-list">${a.upcoming.map(row).join("")}</ul>` : `<p class="sk-fine">Nothing booked.</p>`}
      <div class="sk-row" style="margin-top:.8rem"><a class="sk-btn sk-btn-sm" href="index.html#services">Book a visit</a></div><p class="sk-fine">To move or cancel, use the link in your confirmation email.</p></div>
    <div class="sk-card"><h2 class="sk-h3">History</h2>${a.history.length ? `<ul class="sk-list">${a.history.map(row).join("")}</ul>` : `<p class="sk-fine">No past visits on the website yet.</p>`}</div></div></section>`;
}

/* ── Routine ── */
async function routine() {
  const r = await api.call("routine");
  const active = (slot) => r.entries.filter((e) => e.slot === slot && e.status === "active").sort((a, b) => a.position - b.position);
  const proposed = r.entries.filter((e) => e.status === "proposed");
  const days = Array.from({ length: 28 }, (_, i) => new Date(Date.now() - (27 - i) * 86400000).toISOString().slice(0, 10));
  const byDay = new Map(r.checkins.map((c) => [c.on_date, c]));
  const slotCard = (slot, title) => `<div class="sk-card"><h2 class="sk-h3">${title}</h2>${active(slot).length ? active(slot).map((e, i) => `<div class="sk-step"><span class="sk-step-n">${i + 1}</span><div style="flex:1"><b>${esc(e.product_name)}</b>${e.how ? `<div class="sk-fine">${esc(e.how)}</div>` : ""}<div class="sk-fine">${esc(e.source === "practitioner" ? "From Evelyn" : e.source === "order" ? "From your order" : "Added by you")}${e.started_on ? " · since " + esc(shortDay(e.started_on)) : ""}</div></div><button type="button" class="sk-link sk-fine" data-stop="${e.id}">Stop</button></div>`).join("") : `<p class="sk-fine">Nothing yet.</p>`}</div>`;
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Routine</p><h1 class="sk-h1">Morning, night, <em>and weekly.</em></h1>
    ${proposed.length ? `<div class="sk-card" style="margin-bottom:1rem"><h2 class="sk-h3">Suggested by Evelyn</h2><ul class="sk-list">${proposed.map((e) => `<li><div><b>${esc(e.product_name)}</b> <span class="sk-fine">${esc(e.slot === "am" ? "Morning" : e.slot === "pm" ? "Night" : "Weekly")}${e.how ? " · " + esc(e.how) : ""}</span></div><span class="sk-row"><button type="button" class="sk-btn sk-btn-sm" data-accept="${e.id}">Add to my routine</button><button type="button" class="sk-link" data-decline="${e.id}">Not now</button></span></li>`).join("")}</ul></div>` : ""}
    <div class="sk-routine">${slotCard("am", "Morning")}${slotCard("pm", "Night")}${slotCard("weekly", "Weekly")}</div>
    <div class="sk-grid-2" style="margin-top:1rem">
      <div class="sk-card"><h2 class="sk-h3">The last four weeks</h2><div class="sk-cal" aria-label="Routine log">${days.map((d) => { const c = byDay.get(d); const n = (c?.am_done ? 1 : 0) + (c?.pm_done ? 1 : 0); return `<span class="${n === 2 ? "both" : n === 1 ? "one" : ""}${c?.irritation && c.irritation !== "none" ? " irr" : ""}" title="${esc(day(d))}${c ? `: ${c.am_done ? "morning" : ""}${c.am_done && c.pm_done ? " and " : ""}${c.pm_done ? "night" : ""}${c.irritation && c.irritation !== "none" ? `, ${c.irritation} irritation` : ""}` : ""}">${new Date(d + "T12:00:00").getDate()}</span>`; }).join("")}</div>
        <p class="sk-fine" style="margin-top:.6rem">Your log sits next to your skin's measurements so you and Evelyn can talk about both. It doesn't explain changes on its own: light, hydration, recovery, medications and the seasons all play a part.</p>
        <form class="sk-fields" data-checkin style="margin-top:.8rem"><div class="sk-row"><label class="sk-chip"><input type="checkbox" name="am_done">Morning done today</label><label class="sk-chip"><input type="checkbox" name="pm_done">Night done today</label></div>
          <label class="sk-field"><span>Any irritation?</span><select name="irritation"><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="strong">Strong</option></select></label>
          <button class="sk-btn sk-btn-sm" type="submit">Log today</button></form></div>
      <div class="sk-card"><h2 class="sk-h3">Add a product</h2>
        ${r.purchased.length ? `<p class="sk-fine">You bought these from Lumevina. Add one if you're using it:</p><div class="sk-chips" style="margin-bottom:.8rem">${r.purchased.map((p) => `<button type="button" class="sk-chip" data-from-order="${esc(p.product_id)}" data-name="${esc(p.product_name)}">+ ${esc(p.product_name)}</button>`).join("")}</div>` : ""}
        <form class="sk-fields" data-add-entry novalidate>
          <label class="sk-field"><span>Product</span><input name="product_name" maxlength="120" required></label>
          <div class="sk-fields sk-fields-2"><label class="sk-field"><span>When</span><select name="slot"><option value="am">Morning</option><option value="pm">Night</option><option value="weekly">Weekly</option></select></label>
          <label class="sk-field"><span>Kind</span><select name="category">${ROUTINE_CATEGORIES.map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join("")}</select></label></div>
          <label class="sk-field"><span>How you use it (optional)</span><input name="how" maxlength="300"></label>
          <input type="hidden" name="product_id"><button class="sk-btn sk-btn-sm" type="submit">Add</button></form></div>
    </div>
    <div class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">After a treatment</h2><p class="sk-fine">A quick note on day 1, 3 or 7 helps Evelyn see how your skin settles. Tick the box if you'd like her to look.</p>
      <form class="sk-fields sk-fields-2" data-recovery><label class="sk-field"><span>Day after treatment</span><input type="number" name="day_after" min="0" max="60" value="1"></label>
        <label class="sk-field"><span>Redness (0 none – 3 a lot)</span><input type="range" name="redness" min="0" max="3" value="1"></label>
        <label class="sk-field"><span>Tightness (0–3)</span><input type="range" name="tightness" min="0" max="3" value="1"></label>
        <label class="sk-field"><span>Comfort (0 comfortable – 3 uncomfortable)</span><input type="range" name="comfort" min="0" max="3" value="0"></label>
        <label class="sk-field" style="grid-column:1/-1"><span>Anything else</span><textarea name="note" maxlength="800"></textarea></label>
        <label class="sk-switch"><input type="checkbox" name="flagged"><span>Please ask Evelyn to look</span></label>
        <div class="sk-row sk-row--end"><button class="sk-btn sk-btn-sm" type="submit">Send</button></div></form>
      <p class="sk-fine">If you have trouble breathing, swelling of the lips or eyes, a spreading or blistering reaction, or signs of infection, call 911 or your doctor first.</p></div>
  </section>`;
  main.removeEventListener("click", routineClicks);
  main.addEventListener("click", routineClicks);
  main.querySelector("[data-add-entry]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = formValues(e.target); const clean = cleanRoutineEntry(v);
    if (!clean.ok) return showErrors(e.target, clean.errors);
    try { await api.call("routine_save", { entry: { ...v, from_order: !!v.product_id } }); toast("Added."); routine(); } catch (err) { toast(explain(err)); }
  });
  main.querySelector("[data-checkin]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api.call("checkin", { on_date: new Date().toISOString().slice(0, 10), am_done: v.am_done, pm_done: v.pm_done, irritation: v.irritation }); toast("Logged."); routine(); } catch (err) { toast(explain(err)); }
  });
  main.querySelector("[data-recovery]").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api.call("recovery_checkin", { ...v, day_after: Number(v.day_after), redness: Number(v.redness), tightness: Number(v.tightness), comfort: Number(v.comfort) }); toast(v.flagged ? "Sent. Evelyn will look." : "Saved."); e.target.reset(); } catch (err) { toast(explain(err)); }
  });
}
async function routineClicks(e) {
  const t = e.target;
  try {
    if (t.closest("[data-stop]")) { await api.call("routine_stop", { id: t.closest("[data-stop]").dataset.stop }); toast("Stopped. It stays in your history."); }
    else if (t.closest("[data-accept]")) { await api.call("routine_accept", { id: t.closest("[data-accept]").dataset.accept }); toast("Added to your routine."); }
    else if (t.closest("[data-decline]")) { await api.call("routine_accept", { id: t.closest("[data-decline]").dataset.decline, accept: false }); }
    else if (t.closest("[data-from-order]")) { const b = t.closest("[data-from-order]"); const f = main.querySelector("[data-add-entry]"); f.product_name.value = b.dataset.name; f.product_id.value = b.dataset.fromOrder; f.product_name.focus(); return; }
    else return;
    routine();
  } catch (err) { toast(explain(err)); }
}

/* ── Orders ── */
async function orders() {
  const o = await api.call("orders");
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Orders</p><h1 class="sk-h1">From the shop.</h1>
    ${o.orders.length ? `<div class="sk-stack">${o.orders.map((x) => `<div class="sk-card"><div class="sk-card-head"><div><b>${esc(x.ref)}</b> <span class="sk-fine">${esc(day(x.paid_at))}</span></div><b>${esc(money(x.total_cents))}</b></div>
      <ul class="sk-list">${(x.items || []).map((i) => `<li><span>${esc(i.qty)} × ${esc(i.name)}</span><a class="sk-link sk-fine" href="#routine">Add to routine</a></li>`).join("")}</ul>
      <p class="sk-fine">${x.delivery === "ship" ? (x.shipment ? `${esc(x.shipment.status === "delivered" ? "Delivered" : x.shipment.status === "shipped" ? "On its way" : "Being packed")}${x.shipment.tracking ? ` · ${esc(x.shipment.carrier || "")} ${esc(x.shipment.tracking)}` : ""}` : "Being packed") : x.delivery === "pickup" ? "Pick up at your next visit" : ""}</p></div>`).join("")}</div>` : `<p class="sk-empty">No orders yet. <a href="index.html#shop">Visit the shop</a></p>`}
    <p class="sk-fine" style="margin-top:1rem">Buying a product doesn't add it to your routine; add it when you start using it.</p></section>`;
}

/* ── Reports ── */
async function reports() {
  const r = await api.call("reports");
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Progress reports</p><h1 class="sk-h1">Prepared by your practitioner.</h1>
    ${r.reports.length ? `<div class="sk-grid">${r.reports.map((x) => `<a class="sk-card sk-card--link" href="report.html?id=${encodeURIComponent(x.id)}"><b>${esc(x.title)}</b><p class="sk-fine">${x.period_from ? esc(day(x.period_from)) + " – " : ""}${esc(day(x.period_to))}</p><span class="sk-btn sk-btn-sm sk-btn-quiet">Open · print or save as PDF</span></a>`).join("")}</div>` : `<p class="sk-empty">No reports yet. Evelyn prepares one after a treatment series, from measurements she has checked.</p>`}</section>`;
}

/* ── Privacy ── */
async function privacy() {
  main.innerHTML = `<section class="sk-section"><p class="sk-kicker">Privacy and account</p><h1 class="sk-h1">Your record, <em>your say.</em></h1>
    <div class="sk-grid-2">
      <div class="sk-card"><h2 class="sk-h3">Your consents</h2><p class="sk-fine">Four separate choices. Saying no to one never affects the others.</p>
        <div class="sk-stack" data-consents>${CONSENT_KINDS.map((k) => consentCard(k)).join("")}</div></div>
      <div class="sk-stack">
        <div class="sk-card"><h2 class="sk-h3">Who sees what</h2><ul class="sk-list">
          <li><span>Your photos and measurements</span><span class="sk-fine">You and your practitioner</span></li>
          <li><span>Treatment details (settings, private notes)</span><span class="sk-fine">Your practitioner; you get the summary</span></li>
          <li><span>AI services</span><span class="sk-fine">Never your skin record</span></li>
          <li><span>Every look at your photos</span><span class="sk-fine">Logged</span></li></ul></div>
        <div class="sk-card"><h2 class="sk-h3">Your data</h2><div class="sk-row"><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-export>Download a copy</button><button type="button" class="sk-btn sk-btn-sm sk-btn-danger" data-delete>Ask to delete my skin record</button></div>
          <p class="sk-fine">Deleting removes your photos, measurements, routine and reports. Signed treatment records may have to be kept for a period the law requires; you'll be told what was kept.</p></div>
        <div class="sk-card"><h2 class="sk-h3">Signing in</h2><div class="sk-row"><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-out>Sign out</button><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-out-all>Sign out on every device</button></div></div>
      </div></div></section>`;
  bindConsents(main, privacy);
  main.querySelector("[data-export]").addEventListener("click", async (e) => {
    await busy(e.target, "Preparing…", async () => {
      const data = await api.call("export");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `lumevina-my-skin-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  });
  twoTap(main.querySelector("[data-delete]"), "Tap again to send the request", async () => {
    try { await api.call("delete_request", {}); toast("Request sent. Evelyn will confirm by email."); } catch (err) { toast(explain(err)); }
  });
  main.querySelector("[data-out]").addEventListener("click", async () => { await session.signOut(); location.reload(); });
  main.querySelector("[data-out-all]").addEventListener("click", async () => { await session.signOut({ everywhere: true }); location.reload(); });
}

boot();
