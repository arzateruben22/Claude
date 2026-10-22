/* Lumevina Skin Intelligence — the demo backend
 *
 * Answers the same actions as functions/skin and functions/studio-skin, with
 * the same shapes, from the synthetic record in demo-data.js (generated
 * images, real measurements of them). Changes made while trying the demo
 * (consents, routine, check-ins, treatment drafts, reports, reviews) are
 * kept in this browser; photos added in the demo stay in this tab only.
 * It uses the same shared rules (js/skin/core) as the real functions.
 */

import { DEMO } from "./demo-data.js";
import { consentState, may, blockedReason } from "./core/consent.js";
import { classifyChange, changeMessage } from "./core/change.js";
import { buildReport } from "./core/report.js";
import { checkWording } from "./core/wording.js";
import { measurementForClient, sessionForClient, treatmentForClient } from "./core/access.js";
import { cleanCaptureBegin, cleanCheckin, cleanConsentAnswer, cleanRecoveryCheckin, cleanRoutineEntry, cleanSkinProfile, cleanTreatment, cleanMeasurementReview, cleanDevice, cleanValidation } from "./core/validate.js";
import { ApiError } from "./api.js";

const KEY = "lumevina_skin_demo";
const TEXTS = {
  clinical_photography: { kind: "clinical_photography", version: "1-draft", title: "Photos of your skin, for your record",
    body: "I agree that Lumevina may take photographs and magnified images of my face and of any area being treated, at my visits, and that I may add my own, to keep a private record of how my skin looks over time and to compare one visit with another. The images are stored privately and seen only by me and the Lumevina practitioner caring for me. They are never posted, never shared, and never sent to an AI service. Measurements made from them describe how my skin looks in a photograph; they are not a diagnosis. I can stop at any time; images already taken stay in my record unless I ask for them to be deleted." },
  treatment: { kind: "treatment", version: "1-draft", title: "Your treatment records",
    body: "I agree that Lumevina keeps a record of each treatment I receive: the date, the areas treated, the device and its settings, the products used, how my skin responded, and the aftercare I was given, so my practitioner can plan each visit safely. The detailed record is kept by my practitioner; I see a summary in my progress reports and can ask for a full copy at any time." },
  ai_processing: { kind: "ai_processing", version: "1-draft", title: "Photos you send with a question",
    body: "When I send a photo with a question in Ask Lumevina, I agree that it may be read by an AI assistant (Claude, by Anthropic) to help draft Evelyn's reply. Evelyn reads and decides every reply herself. Without this yes, my photos go to Evelyn only. Photos taken for my skin record are never sent to an AI service, whatever I choose here." },
  marketing: { kind: "marketing", version: "1-draft", title: "Photos in Lumevina's own posts",
    body: "I agree that Lumevina may use selected photos of my skin, without my name, in its own posts, website or printed materials. Lumevina will show me each photo before it is used, and I can withdraw this at any time; photos already published will be taken down where Lumevina controls them." },
};

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "demo-" + Math.random().toString(16).slice(2));
const clone = (x) => JSON.parse(JSON.stringify(x));

/* the demo's starting state on top of the generated record */
function seed() {
  const s = DEMO.sessions;
  return {
    profile: clone(DEMO.profile),
    consents: [
      { id: uid(), kind: "clinical_photography", version: "1-draft", granted: true, recorded_at: "2026-05-06T09:52:00Z", withdrawn_at: null, source: "studio" },
      { id: uid(), kind: "treatment", version: "1-draft", granted: true, recorded_at: "2026-05-06T09:53:00Z", withdrawn_at: null, source: "studio" },
      { id: uid(), kind: "ai_processing", version: "1-draft", granted: false, recorded_at: "2026-05-06T09:53:30Z", withdrawn_at: null, source: "client" },
      { id: uid(), kind: "marketing", version: "1-draft", granted: false, recorded_at: "2026-05-06T09:54:00Z", withdrawn_at: null, source: "client" },
    ],
    treatments: s.slice(0, 4).map((x, i) => ({
      id: `demo-tr-${i + 1}`, profile_id: DEMO.profile.id, session_id: x.id, booking_id: null, service_id: i === 0 ? "procell-package" : "procell-package-rebook",
      treated_at: x.started_at.replace("T10:", "T11:"), performed_by: "demo-staff", device: "ProCell Microchanneling Device",
      treatment_type: "microchanneling", areas: ["forehead", "left_cheek", "right_cheek", "nose", "chin"],
      needle_depth_mm: { forehead: 0.25, left_cheek: 0.5, right_cheek: 0.5, nose: 0.25, chin: 0.5 }, rf: null,
      topicals: ["ProCell Stem Cell Serum"], notes_private: "Demo: private treatment notes stay with the practitioner.",
      reactions: i === 1 ? "Mild redness, settled within the visit" : "Expected pinkness", adverse_event: false,
      recovery_guidance: "Gentle cleanser, no actives for 72 hours, SPF daily.", follow_up_on: s[i + 1]?.started_at.slice(0, 10) ?? null,
      client_summary: `ProCell Microchanneling, session ${i + 1} of 4, full face.`, series: { package: "procell-package", session_no: i + 1, of: 4 },
      status: "signed", signed_at: x.started_at, amended_from: null, created_at: x.started_at, updated_at: x.started_at,
    })),
    routine: [
      { id: uid(), slot: "am", position: 0, product_id: "fr-gentle-gel-cleanser", product_name: "Gentle Gel Cleanser", category: "cleanser", how: "Massage for 30 seconds, rinse", frequency: "daily", source: "practitioner", status: "active", started_on: "2026-05-06" },
      { id: uid(), slot: "am", position: 1, product_id: "fr-daily-spf-30", product_name: "Daily SPF 30", category: "sunscreen", how: "Two finger-lengths, every morning", frequency: "daily", source: "order", status: "active", started_on: "2026-05-10" },
      { id: uid(), slot: "pm", position: 0, product_id: "fr-gentle-gel-cleanser", product_name: "Gentle Gel Cleanser", category: "cleanser", how: null, frequency: "daily", source: "client", status: "active", started_on: "2026-05-06" },
      { id: uid(), slot: "pm", position: 1, product_id: "fr-barrier-gel-cream", product_name: "Barrier Gel Cream", category: "moisturizer", how: "Pea-sized amount", frequency: "daily", source: "practitioner", status: "proposed", started_on: null },
    ],
    checkins: Array.from({ length: 21 }, (_, i) => {
      const d = new Date(Date.now() - (i + 1) * 86400000).toISOString().slice(0, 10);
      return { id: uid(), on_date: d, am_done: i % 6 !== 3, pm_done: i % 5 !== 2, irritation: i === 9 ? "mild" : "none", note: null };
    }),
    recovery: [{ id: uid(), treatment_id: "demo-tr-4", day_after: 1, redness: 2, tightness: 1, comfort: 1, note: "Pink and a bit tight, as expected.", flagged: false, created_at: "2026-07-30T18:00:00Z" }],
    reviews: {},          // measurement id → { review_status, review_note }
    changes: [],          // generated change detections, with review state
    reports: [],
    addedCaptures: [],    // this tab only
    quality: [],
    deletion: null,
    staff: [{ user_id: "demo-staff", email: "evelyn@lumevina.test", display_name: "Evelyn", role: "admin", active: true, created_at: "2026-05-01T00:00:00Z" }],
    devices: clone(DEMO.devices),
    validation: clone(DEMO.validation),
    settings: { assignment_mode: "all", signed_url_seconds: 300 },
    audit: [],
  };
}

let state = null;
const images = new Map();   // capture id → object URL (this tab)
function load() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state || state.v !== DEMO.generated) { state = { v: DEMO.generated, ...seed() }; save(); }
  state.addedCaptures = [];   // object URLs don't survive a reload
  if (!state.seededChanges) seedChanges();
  return state;
}

/* Evelyn has already compared each area's first and latest visits, confirmed what exceeds the threshold, and shared it. */
function seedChanges() {
  state.seededChanges = true;
  const byRegion = {};
  for (const c of DEMO.captures) if (c.status === "processed") (byRegion[c.region] ??= []).push(c);
  for (const caps of Object.values(byRegion)) {
    caps.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    for (const ch of detect(caps[0].id, caps[caps.length - 1].id)) {
      const row = state.changes.find((x) => x.id === ch.id);
      if (row && (row.verdict === "improvement" || row.verdict === "deterioration")) { row.review_status = "confirmed"; row.shared_with_client = true; }
    }
  }
  save();
}
function save() { try { const { addedCaptures, ...rest } = state; localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* full or private */ } }
export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* */ } state = null; }

function record() {
  const s = load();
  const captures = [...DEMO.captures, ...s.addedCaptures];
  const quality = [...DEMO.quality, ...s.quality];
  const measurements = DEMO.measurements.map((m) => ({ ...m, ...(s.reviews[m.id] || {}) }));
  return { sessions: DEMO.sessions, captures, quality, measurements, derived: DEMO.derived, treatments: s.treatments, devices: s.devices, validation: s.validation, changes: s.changes };
}

function audit(action, extra = {}) { const s = load(); s.audit.unshift({ id: s.audit.length + 1, at: now(), actor_user_id: "demo-staff", actor_role: "admin", action, profile_id: DEMO.profile.id, outcome: "ok", ...extra }); s.audit = s.audit.slice(0, 300); save(); }

function clientRecord(r) {
  const q = new Map(r.quality.map((x) => [x.capture_id, x]));
  return {
    sessions: r.sessions.map(sessionForClient),
    captures: r.captures.map((c) => ({ ...c, quality: q.get(c.id) ? { passed: q.get(c.id).passed, comparable: q.get(c.id).comparable, flags: q.get(c.id).flags } : null,
      derived: [...new Set(r.derived.filter((d) => d.capture_id === c.id).map((d) => d.kind))], device_kind: "phone" })),
    treatments: r.treatments.map(treatmentForClient).filter(Boolean),
  };
}

function urlsFor(ids, kind, referenceId) {
  const r = record();
  const out = {};
  for (const id of ids) {
    if (images.has(id) && (kind === "view" || kind === "thumb" || kind === "original")) { out[id] = images.get(id); continue; }
    const d = r.derived.find((x) => x.capture_id === id && x.kind === (kind === "original" ? "view" : kind) && (!referenceId || x.reference_capture_id === referenceId));
    out[id] = d ? d.path : null;
  }
  return out;
}

/** Change detections between two captures, with the same rules the studio function uses. */
function detect(fromId, toId) {
  const s = load(), r = record();
  const from = r.captures.find((c) => c.id === fromId), to = r.captures.find((c) => c.id === toId);
  const q = new Map(r.quality.map((x) => [x.capture_id, x]));
  const latest = (cid) => { const m = new Map(); for (const x of r.measurements) if (x.capture_id === cid) m.set(x.name, x); return m; };
  const A = latest(fromId), Z = latest(toId);
  const out = [];
  for (const [name, ma] of A) {
    const mz = Z.get(name); if (!mz) continue;
    const side = (m, c) => ({ name, region: m.region, value: m.value == null ? NaN : Number(m.value), quality: m.quality, comparable: q.get(c.id)?.comparable ?? false,
      calibration_status: m.calibration_status, device_kind: "phone", um_per_px: null, algorithm_version: m.algorithm_version, review_status: m.review_status });
    const v = s.validation.find((x) => x.name === name && (x.region === ma.region || x.region === "any") && x.status === "validated") ?? null;
    const res = classifyChange(side(ma, from), side(mz, to), v);
    let row = s.changes.find((c) => c.from_capture_id === fromId && c.to_capture_id === toId && c.name === name);
    if (!row) {
      row = { id: uid(), profile_id: DEMO.profile.id, name, region: ma.region, from_capture_id: fromId, to_capture_id: toId, from_value: ma.value, to_value: mz.value,
        delta: res.delta, threshold: res.threshold, verdict: res.verdict, reasons: res.reasons, algorithm_version: res.version, review_status: "unreviewed", shared_with_client: false, created_at: now() };
      s.changes.push(row);
    }
    out.push({ ...row, text: changeMessage(name, ma.region, res, "practitioner") });
  }
  save();
  return out;
}

function fail(status, reason, extra = {}) { throw new ApiError(status, { reason, ...extra }); }

export function demoBackend(fn) {
  const client = async (action, b) => {
    const s = load(), r = record(), st = consentState(s.consents);
    switch (action) {
      case "me": return { email: DEMO.profile.email, profile: s.deletion ? null : s.profile, consents: st, texts: TEXTS, demo: true, notice: DEMO.notice };
      case "enroll": return { profile: s.profile };
      case "profile_save": { const c = cleanSkinProfile(b.profile); if (!c.ok) fail(400, "invalid", { errors: c.errors }); Object.assign(s.profile, c.value, { updated_at: now() }); save(); return { profile: s.profile }; }
      case "consent": {
        const c = cleanConsentAnswer(b); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        s.consents.unshift({ id: uid(), ...c.value, recorded_at: now(), withdrawn_at: null, source: "client" }); save();
        return { consents: consentState(s.consents) };
      }
      case "consent_withdraw": { const live = s.consents.find((x) => x.kind === b.kind); if (live && live.granted && !live.withdrawn_at) live.withdrawn_at = now(); save(); return { consents: consentState(s.consents) }; }
      case "timeline": return clientRecord(r);
      case "image_urls": return { urls: urlsFor(b.capture_ids || [], b.kind || "view", b.reference_id), expires_in: 300 };
      case "evolution": return {
        ...clientRecord(r),
        measurements: r.measurements.map(measurementForClient).filter(Boolean),
        validation: s.validation.map((v) => ({ name: v.name, region: v.region, device_kind: v.device_kind, status: v.status, repeatability_coefficient: v.status === "validated" ? v.repeatability_coefficient : null, notes: v.notes })),
        changes: s.changes.filter((c) => c.shared_with_client && c.review_status === "confirmed").map((c) => ({ ...c, text: changeMessage(c.name, c.region, c, "client") })),
      };
      case "capture_begin": {
        if (!may.capture(st)) fail(403, "consent_required", { kind: "clinical_photography", message: blockedReason("capture", st) });
        const c = cleanCaptureBegin(b); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        const id = uid();
        s.addedCaptures.push({ id, session_id: "demo-own", profile_id: DEMO.profile.id, region: c.value.region, source: c.value.source, captured_at: now(), status: "pending_upload", calibration_status: "uncalibrated", captured_by_role: fn === "skin" ? "client" : "practitioner", capture_meta: c.value.capture_meta, mime: c.value.mime });
        return { capture_id: id, session_id: "demo-own", upload: { url: "demo:" + id, token: "demo", content_type: c.value.mime } };
      }
      case "capture_commit": {
        const cap = s.addedCaptures.find((x) => x.id === b.capture_id); if (!cap) fail(404, "no_capture");
        if (!images.has(cap.id)) fail(409, "not_uploaded");
        cap.status = "processed";
        const m = cap.capture_meta?.checks || {};
        s.quality.push({ capture_id: cap.id, algorithm_version: "device-1", metrics: m, flags: m.flags || [], passed: !(m.flags || []).some((f) => ["blur", "underexposed", "overexposed"].includes(f)), comparable: !(m.flags || []).length, created_at: now() });
        return { capture_id: cap.id, status: "uploaded", note: "Demo: this photo stays in this tab; nothing was sent anywhere." };
      }
      case "routine": {
        const have = new Set(s.routine.filter((e) => e.status !== "stopped").map((e) => e.product_id));
        const purchased = [{ product_id: "fr-hydrabalance-gel", product_name: "HydraBalance Gel", bought_at: "2026-09-12T00:00:00Z", where: "shop" }, { product_id: "fr-daily-spf-30", product_name: "Daily SPF 30", bought_at: "2026-05-10T00:00:00Z", where: "studio" }].filter((p) => !have.has(p.product_id));
        return { entries: s.routine, checkins: s.checkins, recovery: s.recovery, purchased };
      }
      case "routine_save": {
        const c = cleanRoutineEntry(b.entry); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        if (b.entry.id) { const e = s.routine.find((x) => x.id === b.entry.id); if (!e) fail(404, "no_entry"); Object.assign(e, c.value); save(); return { entry: e }; }
        const e = { id: uid(), ...c.value, source: b.entry.from_order ? "order" : "client", status: "active", started_on: c.value.started_on || today() };
        s.routine.push(e); save(); return { entry: e };
      }
      case "routine_stop": { const e = s.routine.find((x) => x.id === b.id); if (!e) fail(404, "no_entry"); e.status = "stopped"; e.stopped_on = today(); save(); return { entry: e }; }
      case "routine_accept": { const e = s.routine.find((x) => x.id === b.id && x.status === "proposed"); if (!e) fail(404, "no_entry"); e.status = b.accept === false ? "stopped" : "active"; e.started_on = today(); save(); return { entry: e }; }
      case "checkin": {
        const c = cleanCheckin(b); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        const e = s.checkins.find((x) => x.on_date === c.value.on_date);
        if (e) Object.assign(e, c.value); else s.checkins.unshift({ id: uid(), ...c.value });
        save(); return { checkin: e || s.checkins[0] };
      }
      case "recovery_checkin": { const c = cleanRecoveryCheckin(b); if (!c.ok) fail(400, "invalid", { errors: c.errors }); const row = { id: uid(), ...c.value, created_at: now() }; s.recovery.unshift(row); save(); return { checkin: row }; }
      case "reports": return { reports: s.reports.filter((x) => x.status === "approved").map(({ id, title, period_from, period_to, approved_at }) => ({ id, title, period_from, period_to, approved_at })) };
      case "report": {
        const rep = s.reports.find((x) => x.id === b.id && (x.status === "approved" || b.preview)); if (!rep) fail(404, "no_report");
        return { report: rep, urls: urlsFor((rep.content.images || []).map((i) => i.capture_id), "view"), expires_in: 300 };
      }
      case "appointments": return {
        upcoming: [{ id: "demo-b1", date: "2026-11-11", start_min: 600, dur_min: 60, services: ["lumevina-custom-facial"], status: "held" }],
        history: DEMO.sessions.slice().reverse().map((x, i) => ({ id: "demo-h" + i, date: x.started_at.slice(0, 10), start_min: 600, dur_min: x.service_id === "procell-microchanneling" ? 90 : 60, services: [x.service_id], status: "completed" })),
      };
      case "orders": return { orders: [
        { id: "demo-o1", ref: "LUM-D3M0A1B2", status: "paid", items: [{ id: "fr-hydrabalance-gel", name: "HydraBalance Gel", qty: 1, price_cents: 4400 }], delivery: "ship", total_cents: 5200, paid_at: "2026-09-12T15:20:00Z", shipment: { status: "delivered", carrier: "USPS", tracking: "9400 0000 0000 0000 0000 00", shipped_at: "2026-09-13T17:00:00Z" } },
        { id: "demo-o2", ref: "LUM-D3M0C3D4", status: "paid", items: [{ id: "fr-daily-spf-30", name: "Daily SPF 30", qty: 1, price_cents: 3800 }], delivery: "pickup", total_cents: 3800, paid_at: "2026-05-10T12:00:00Z", shipment: null },
      ] };
      case "export": return { exported_at: now(), email: DEMO.profile.email, consents: s.consents, profile: s.profile, ...clientRecord(r), measurements: r.measurements.map(measurementForClient).filter(Boolean), routine: s.routine, checkins: s.checkins, recovery: s.recovery, reports: s.reports.filter((x) => x.status === "approved"), demo: true };
      case "delete_request": s.deletion = { id: uid(), requested_at: now(), note: b.note || null }; save(); return { request_id: s.deletion.id, status: "open" };
      default: fail(400, "unknown_action");
    }
  };

  const studio = async (action, b) => {
    const s = load(), r = record(), st = consentState(s.consents);
    const p = s.profile;
    const needProfile = () => { if (b.profile_id && b.profile_id !== p.id) fail(404, "no_profile"); };
    switch (action) {
      case "whoami": return { staff: { id: "demo-staff", email: "evelyn@lumevina.test", name: "Evelyn", role: "admin" }, settings: s.settings, demo: true };
      case "clients": {
        const last = DEMO.sessions[DEMO.sessions.length - 1].started_at;
        const list = [{ id: p.id, email: p.email, name: p.name, concerns: p.concerns, status: s.deletion ? "deletion_requested" : p.status, enrolled_at: p.enrolled_at, updated_at: p.updated_at, last_session: last }];
        const q = String(b.q || "").toLowerCase();
        return { clients: q ? list.filter((c) => c.email.includes(q) || c.name.toLowerCase().includes(q)) : list, not_enrolled: q.length >= 2 ? [{ email: "maya@example.test", name: "Maya (sample contact)" }].filter((c) => c.email.includes(q) || c.name.toLowerCase().includes(q)) : [] };
      }
      case "client": {
        needProfile(); audit("studio.client.open", { record_table: "skin_profiles" });
        return { profile: p, consents: st, consent_history: s.consents, intake: { answers: { allergies: "Fragrance", conditions: ["None"], pregnant: "No", last_retinol: "Over a month ago", acne_photos: "Yes", photo_consent: "I do not accept" }, signed_at: "2026-05-01T18:00:00Z" },
          bookings: [{ id: "demo-b1", date: "2026-11-11", start_min: 600, dur_min: 60, services: ["lumevina-custom-facial"], status: "held" }],
          routine: s.routine, recovery: s.recovery, reports: s.reports, sites: [], ...r };
      }
      case "enroll": return { profile: p, existed: true };
      case "profile_save": { const c = cleanSkinProfile(b.profile); if (!c.ok) fail(400, "invalid", { errors: c.errors }); Object.assign(p, c.value, { updated_at: now() }); save(); audit("studio.profile.save"); return { profile: p }; }
      case "contraindication_add": { const note = String(b.note || "").trim(); if (!note) fail(400, "invalid", { errors: { note: "Write the contraindication." } }); p.contraindications.push({ note, at: now(), by: "Evelyn" }); save(); return { profile: p }; }
      case "consent_record": { const c = cleanConsentAnswer(b); if (!c.ok) fail(400, "invalid", { errors: c.errors }); s.consents.unshift({ id: uid(), ...c.value, recorded_at: now(), withdrawn_at: null, source: "studio" }); save(); audit("studio.consent.record", { detail: { kind: c.value.kind } }); return { consents: consentState(s.consents) }; }
      case "session_open": { if (!may.capture(st)) fail(403, "consent_required", { kind: "clinical_photography", message: blockedReason("capture", st) }); const id = uid(); return { session: { id, profile_id: p.id, visit_label: b.visit_label || "Today", status: "open", started_at: now() } }; }
      case "session_update": return { session: { id: b.session_id, status: b.status || "open" } };
      case "capture_begin": return client("capture_begin", b);
      case "capture_commit": return client("capture_commit", b);
      case "quality_review": { const q = r.quality.find((x) => x.capture_id === b.capture_id); if (q) { q.review_decision = b.decision; if (s.quality.includes(q)) save(); } audit("studio.quality.review"); return { capture_id: b.capture_id, decision: b.decision }; }
      case "image_urls": audit("studio.capture.view", { detail: { n: (b.capture_ids || []).length, kind: b.kind } }); return { urls: urlsFor(b.capture_ids || [], b.kind || "view", b.reference_id), expires_in: 300 };
      case "analyze": return { queued: true, note: "Demo: measurements were computed when the demo was generated." };
      case "compare": { const changes = detect(b.from_capture_id, b.to_capture_id); audit("studio.compare"); return { queued_registration: true, changes }; }
      case "measurement_review": {
        const c = cleanMeasurementReview(b); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        s.reviews[c.value.id] = { review_status: c.value.review_status, review_note: c.value.review_note, reviewed_at: now() }; save();
        return { measurement: { ...DEMO.measurements.find((m) => m.id === c.value.id), ...s.reviews[c.value.id] } };
      }
      case "change_review": { const c = s.changes.find((x) => x.id === b.id); if (!c) fail(404, "no_change"); c.review_status = b.review_status; c.shared_with_client = b.review_status === "confirmed" && !!b.shared_with_client && c.verdict !== "invalid_comparison"; save(); return { change: c }; }
      case "site_save": return { site: { id: uid(), name: b.name, region: b.region } };
      case "treatment_save": {
        if (!may.recordTreatment(st)) fail(403, "consent_required", { kind: "treatment", message: blockedReason("recordTreatment", st) });
        const c = cleanTreatment(b.treatment); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        let row = b.treatment.id ? s.treatments.find((t) => t.id === b.treatment.id && t.status === "draft") : null;
        if (b.treatment.id && !row) fail(409, "not_a_draft");
        if (row) Object.assign(row, c.value, { updated_at: now() });
        else { row = { id: uid(), profile_id: p.id, performed_by: "demo-staff", status: "draft", created_at: now(), updated_at: now(), amended_from: null, signed_at: null, ...c.value }; s.treatments.push(row); }
        save(); audit("studio.treatment.save"); return { treatment: row, wording: checkWording(row.client_summary) };
      }
      case "treatment_sign": {
        const t = s.treatments.find((x) => x.id === b.id); if (!t) fail(404, "no_treatment"); if (t.status !== "draft") fail(409, "not_a_draft");
        const problems = checkWording(t.client_summary); if (problems.length && !b.accept_wording) fail(422, "wording", { problems });
        t.status = "signed"; t.signed_at = now(); save(); audit("studio.treatment.sign"); return { treatment: t };
      }
      case "treatment_amend": {
        const old = s.treatments.find((x) => x.id === b.id); if (!old || old.status !== "signed") fail(409, "not_signed");
        const c = cleanTreatment({ ...old, ...b.treatment }); if (!c.ok) fail(400, "invalid", { errors: c.errors });
        const row = { ...old, ...c.value, id: uid(), amended_from: old.id, status: "signed", signed_at: now(), created_at: now() };
        old.status = "amended"; s.treatments.push(row); save(); audit("studio.treatment.amend"); return { treatment: row };
      }
      case "routine_propose": { const c = cleanRoutineEntry(b.entry); if (!c.ok) fail(400, "invalid", { errors: c.errors }); const e = { id: uid(), ...c.value, source: "practitioner", status: "proposed" }; s.routine.push(e); save(); return { entry: e }; }
      case "report_draft": {
        const sessions = DEMO.sessions.filter((x) => !b.session_ids || b.session_ids.includes(x.id));
        const ids = new Set(r.captures.filter((c) => sessions.some((x) => x.id === c.session_id)).map((c) => c.id));
        const capDate = new Map(r.captures.map((c) => [c.id, c.captured_at]));
        const built = buildReport({
          profile: p, period: { from: b.period_from ?? sessions[0]?.started_at.slice(0, 10), to: b.period_to ?? today() },
          visits: sessions.map((x, i) => ({ id: x.id, date: x.started_at, label: x.visit_label ?? `Visit ${i + 1}` })),
          images: (b.image_capture_ids || []).filter((id) => ids.has(id)).map((id) => { const c = r.captures.find((x) => x.id === id); return { capture_id: id, region: c.region, date: c.captured_at, label: DEMO.sessions.find((x) => x.id === c.session_id)?.visit_label }; }),
          measurements: r.measurements.filter((m) => ids.has(m.capture_id)).map((m) => ({ ...m, date: capDate.get(m.capture_id) })),
          changes: s.changes.filter((c) => ids.has(c.to_capture_id)), treatments: s.treatments.filter((t) => t.status === "signed"),
          routine: s.routine.filter((e) => e.status === "active"), summary: b.summary,
        });
        const rep = { id: uid(), profile_id: p.id, title: String(b.title || "").trim() || "Your skin progress", period_from: b.period_from ?? null, period_to: b.period_to ?? today(), content: built.content, status: "draft", created_at: now() };
        s.reports.unshift(rep); save(); return { report: rep, problems: built.ok ? [] : built.problems };
      }
      case "report_approve": {
        const rep = s.reports.find((x) => x.id === b.id); if (!rep) fail(404, "no_report"); if (rep.status !== "draft") fail(409, "not_a_draft");
        const problems = checkWording(rep.content.summary); if (problems.length) fail(422, "wording", { problems });
        rep.status = "approved"; rep.approved_at = now(); save(); audit("studio.report.approve"); return { report: rep };
      }
      case "report_withdraw": { const i = s.reports.findIndex((x) => x.id === b.id); if (i < 0) fail(404, "no_report"); if (s.reports[i].status === "draft") s.reports.splice(i, 1); else { s.reports[i].status = "withdrawn"; s.reports[i].withdrawn_at = now(); } save(); return { ok: true }; }
      case "report": return client("report", { ...b, preview: true });
      case "needs": {
        const unreviewed = r.measurements.filter((m) => m.review_status === "unreviewed").length;
        return { sessions: [], measurements_to_review: unreviewed ? { [p.id]: unreviewed } : {}, changes: s.changes.filter((c) => c.review_status === "unreviewed" && ["improvement", "deterioration"].includes(c.verdict)),
          recovery: s.recovery.filter((x) => x.flagged), data_requests: s.deletion ? [{ id: s.deletion.id, kind: "delete", requested_at: s.deletion.requested_at }] : [], names: [{ id: p.id, name: p.name, email: p.email }] };
      }
      case "staff_list": return { staff: s.staff };
      case "staff_set": { const email = String(b.email || "").toLowerCase(); let row = s.staff.find((x) => x.email === email); if (!row) fail(404, "no_account", { message: "In the demo, only Evelyn exists. Live, they sign in once at the studio page, then you add them here." }); Object.assign(row, { role: b.role, active: b.active !== false, display_name: b.display_name || row.display_name }); save(); return { staff: row }; }
      case "assign": case "unassign": return { ok: true };
      case "settings_set": s.settings[b.key] = b.value; save(); return { key: b.key, value: b.value };
      case "devices": return { devices: s.devices, validation: s.validation };
      case "device_set": { const c = cleanDevice(b.device); if (!c.ok) fail(400, "invalid", { errors: c.errors }); let d = s.devices.find((x) => x.id === b.device.id); if (d) Object.assign(d, c.value); else { d = { id: uid(), ...c.value }; s.devices.push(d); } save(); return { device: d }; }
      case "validation_set": { const c = cleanValidation(b); if (!c.ok) fail(400, "invalid", { errors: c.errors }); const i = s.validation.findIndex((v) => v.name === c.value.name && v.region === c.value.region && v.device_kind === c.value.device_kind); if (i >= 0) s.validation[i] = { ...s.validation[i], ...c.value }; else s.validation.push(c.value); save(); return { validation: c.value }; }
      case "audit": return { entries: s.audit };
      case "data_requests": return { requests: s.deletion ? [{ id: s.deletion.id, email: p.email, kind: "delete", status: "open", note: s.deletion.note, requested_at: s.deletion.requested_at }] : [] };
      case "data_request_complete": s.deletion = null; save(); return { request: { id: b.id, status: "declined", resolution: "Demo: nothing is deleted in the demo." }, files_removed: 0 };
      case "analytics": {
        const q = r.quality;
        return { since: "2026-05-01", enrolled_clients: 1, imaging_sessions: DEMO.sessions.length, sessions_by_month: Object.fromEntries(DEMO.sessions.map((x) => [x.started_at.slice(0, 7), 1])),
          clients_with_repeat_imaging: 1, captures: r.captures.length, client_added_captures: s.addedCaptures.length, quality_checked: q.length,
          quality_failure_rate: Math.round((q.filter((x) => !x.passed).length / q.length) * 1000) / 10, quality_flags: { blur: q.filter((x) => x.flags.includes("blur")).length },
          measurements_awaiting_review: r.measurements.filter((m) => m.review_status === "unreviewed").length, follow_ups_due: 4, follow_ups_completed: 4, follow_up_completion_rate: 100,
          series_in_progress: 0, series_completed: 1, reports_approved: s.reports.filter((x) => x.status === "approved").length, recovery_flags: s.recovery.filter((x) => x.flagged).length,
          note: "Demo numbers from the synthetic record. Operational counts only." };
      }
      default: fail(400, "unknown_action");
    }
  };

  return {
    async call(action, body = {}) {
      await new Promise((res) => setTimeout(res, 60));   // feel like a network call
      return (fn === "skin" ? client : studio)(action, body);
    },
    async upload(blob, info) {
      const id = String(info.url).replace(/^demo:/, "");
      images.set(id, URL.createObjectURL(blob));
    },
  };
}
