// GENERATED from js/skin/core/validate.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — input cleaning (shared)
 *
 * Every record a person can submit, bounded and checked, in the style of
 * functions/_shared/profiles.ts: strings trimmed and clipped, lists capped,
 * enums checked, numbers range-checked. The functions call these before any
 * write; the pages call them to show problems early. A cleaner returns
 * { ok: true, value } or { ok: false, errors: { field: message } }.
 */

import { REGION_IDS, AREA_IDS } from "./regions.js";
import { MEASUREMENT_NAMES } from "./measurements.js";
import { CONSENT_KINDS } from "./consent.js";

const str = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, n);
const list = (v, n, each) => (Array.isArray(v) ? v : []).slice(0, n).map(each).filter((x) => x !== "" && x != null);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) && !Number.isNaN(Date.parse(String(v) + "T12:00:00Z"));
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? ""));
const result = (value, errors) => (Object.keys(errors).length ? { ok: false, errors } : { ok: true, value });
export { isUuid, isDate };

export const normEmail = (e) => String(e ?? "").trim().toLowerCase();
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e)) && normEmail(e).length <= 254;

export const CONCERNS = ["Texture", "Pores", "Acne scars", "Other scars", "Dark spots", "Uneven tone", "Redness", "Fine lines", "Breakouts", "Dryness", "Oiliness", "Sensitivity"];

export function cleanSkinProfile(p) {
  const errors = {};
  const value = {
    name: str(p?.name, 120),
    goals: str(p?.goals, 600),
    concerns: list(p?.concerns, 12, (c) => str(c, 60)),
    skin_history: str(p?.skin_history, 1500),
    sensitivities: str(p?.sensitivities, 800),
    current_products: str(p?.current_products, 1500),
    prior_procedures: str(p?.prior_procedures, 1500),
  };
  if (p?.privacy && typeof p.privacy === "object") value.privacy = { email_when_report_ready: !!p.privacy.email_when_report_ready };
  return result(value, errors);
}

export function cleanContraindication(c) {
  const note = str(c?.note, 600);
  return note ? { ok: true, value: { note } } : { ok: false, errors: { note: "Write the contraindication." } };
}

export const MIME_OK = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/tiff", "image/webp"];
export const MAX_BYTES = 25 * 1024 * 1024;
export const SOURCES = ["camera", "upload", "microscope", "dermatoscope", "pro_export"];
export const extFor = (mime) => ({ "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/tiff": "tif", "image/webp": "webp" })[mime] ?? "bin";

export function cleanCaptureBegin(c) {
  const errors = {};
  const region = String(c?.region ?? "");
  if (!REGION_IDS.includes(region)) errors.region = "Choose an area.";
  const mime = String(c?.mime ?? "").toLowerCase();
  if (!MIME_OK.includes(mime)) errors.mime = "JPEG, PNG, HEIC, TIFF or WebP only.";
  const bytes = Number(c?.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) errors.bytes = "The file is empty.";
  else if (bytes > MAX_BYTES) errors.bytes = "The file is larger than 25 MB.";
  const source = SOURCES.includes(c?.source) ? c.source : "upload";
  if (c?.site_id != null && c.site_id !== "" && !isUuid(c.site_id)) errors.site_id = "Unknown site.";
  if (region === "custom" && !c?.site_id && !str(c?.custom_label, 80)) errors.site_id = "Choose or name the spot.";
  return result({
    region, mime, bytes, source,
    site_id: c?.site_id || null,
    capture_meta: cleanCaptureMeta(c?.capture_meta),
  }, errors);
}

/* What the capture screen knew; only known keys, only plain values. */
export function cleanCaptureMeta(m) {
  if (!m || typeof m !== "object") return {};
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 1000) / 1000 : null);
  const out = {};
  if (m.guide) out.guide = ["face-landmarks", "oval", "macro", "none"].includes(m.guide) ? m.guide : "none";
  if (m.pose && typeof m.pose === "object") out.pose = { yaw: num(m.pose.yaw), pitch: num(m.pose.pitch), roll: num(m.pose.roll) };
  if (m.checks && typeof m.checks === "object") {
    out.checks = {};
    for (const k of ["sharpness", "clip_dark", "clip_bright", "mean_l", "cast"]) if (m.checks[k] != null) out.checks[k] = num(m.checks[k]);
    out.checks.flags = list(m.checks.flags, 10, (f) => str(f, 30));
  }
  for (const k of ["camera_label", "facing", "file_name"]) if (m[k]) out[k] = str(m[k], 120);
  for (const k of ["width", "height", "distance_hint_cm"]) if (m[k] != null) out[k] = num(m[k]);
  return out;
}

export function cleanSession(s) {
  const errors = {};
  if (s?.booking_id && !isUuid(s.booking_id)) errors.booking_id = "Unknown booking.";
  if (s?.device_id && !isUuid(s.device_id)) errors.device_id = "Unknown device.";
  const value = {
    booking_id: s?.booking_id || null,
    visit_label: str(s?.visit_label, 80) || null,
    service_id: str(s?.service_id, 80) || null,
    device_id: s?.device_id || null,
    lighting: s?.lighting && typeof s.lighting === "object" ? cleanLighting(s.lighting) : null,
    notes_private: str(s?.notes_private, 2000) || null,
  };
  return result(value, errors);
}

export function cleanLighting(l) {
  const n = (v, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);
  return { source: str(l?.source, 80) || null, color_temp_k: n(l?.color_temp_k, 1500, 10000), distance_cm: n(l?.distance_cm, 1, 300), polarized: !!l?.polarized };
}

export const TREATMENT_TYPES = ["microchanneling", "microneedling", "peel", "facial", "dermaplaning", "led", "other"];
export const MAX_DEPTH_MM = 3.5;   // a typo guard, not a recommendation

export function cleanTreatment(t) {
  const errors = {};
  const type = TREATMENT_TYPES.includes(t?.treatment_type) ? t.treatment_type : "";
  if (!type) errors.treatment_type = "Choose the treatment.";
  const treated = t?.treated_at instanceof Date ? t.treated_at.toISOString() : String(t?.treated_at ?? "");
  if (!treated || Number.isNaN(Date.parse(treated))) errors.treated_at = "When was it done?";
  const areas = [...new Set(list(t?.areas, 12, (a) => (AREA_IDS.includes(a) || a === "front" ? a : str(a, 40))))];
  const depth = {};
  if (t?.needle_depth_mm && typeof t.needle_depth_mm === "object") {
    for (const [k, v] of Object.entries(t.needle_depth_mm).slice(0, 12)) {
      if (v === "" || v == null) continue;
      const d = Number(v);
      if (!Number.isFinite(d) || d <= 0 || d > MAX_DEPTH_MM) { errors.needle_depth_mm = `Check the depth for ${k}: it should be a number of millimetres above 0 and at most ${MAX_DEPTH_MM}.`; continue; }
      depth[str(k, 40)] = Math.round(d * 100) / 100;
    }
  }
  let rf = null;
  if (t?.rf && typeof t.rf === "object" && Object.values(t.rf).some((v) => v !== "" && v != null)) {
    rf = { device: str(t.rf.device, 80) || null, mode: str(t.rf.mode, 40) || null, energy: str(t.rf.energy, 40) || null, passes: Number.isFinite(Number(t.rf.passes)) ? Math.max(0, Math.min(20, Math.round(Number(t.rf.passes)))) : null };
  }
  let series = null;
  if (t?.series && typeof t.series === "object" && t.series.session_no) {
    const no = Math.round(Number(t.series.session_no)), of = Math.round(Number(t.series.of));
    if (!(no >= 1 && no <= 24) || !(of >= no && of <= 24)) errors.series = "Session number and series length don't add up.";
    else series = { package: str(t.series.package, 80) || null, session_no: no, of };
  }
  if (t?.follow_up_on && !isDate(t.follow_up_on)) errors.follow_up_on = "Pick a date.";
  const value = {
    treatment_type: type, treated_at: treated, areas, needle_depth_mm: depth, rf, series,
    service_id: str(t?.service_id, 80) || null,
    device: str(t?.device, 120) || null,
    topicals: list(t?.topicals, 12, (x) => str(x, 120)),
    notes_private: str(t?.notes_private, 4000) || null,
    reactions: str(t?.reactions, 1500) || null,
    adverse_event: !!t?.adverse_event,
    recovery_guidance: str(t?.recovery_guidance, 2000) || null,
    follow_up_on: t?.follow_up_on || null,
    client_summary: str(t?.client_summary, 400) || null,
    session_id: isUuid(t?.session_id) ? t.session_id : null,
    booking_id: isUuid(t?.booking_id) ? t.booking_id : null,
  };
  return result(value, errors);
}

export const ROUTINE_SLOTS = ["am", "pm", "weekly"];
export const ROUTINE_CATEGORIES = ["cleanser", "toner", "serum", "treatment", "moisturizer", "eye", "sunscreen", "mask", "exfoliant", "supplement", "other"];

export function cleanRoutineEntry(e) {
  const errors = {};
  const slot = ROUTINE_SLOTS.includes(e?.slot) ? e.slot : "";
  if (!slot) errors.slot = "Morning, night or weekly?";
  const name = str(e?.product_name, 120);
  if (!name) errors.product_name = "Name the product.";
  if (e?.started_on && !isDate(e.started_on)) errors.started_on = "Pick a date.";
  if (e?.stopped_on && !isDate(e.stopped_on)) errors.stopped_on = "Pick a date.";
  return result({
    slot, product_name: name,
    product_id: str(e?.product_id, 80) || null,
    category: ROUTINE_CATEGORIES.includes(e?.category) ? e.category : "other",
    how: str(e?.how, 300) || null,
    frequency: str(e?.frequency, 60) || null,
    started_on: e?.started_on || null,
    stopped_on: e?.stopped_on || null,
    position: Number.isFinite(Number(e?.position)) ? Math.max(0, Math.min(50, Math.round(Number(e.position)))) : 0,
  }, errors);
}

export function cleanCheckin(c) {
  const errors = {};
  if (!isDate(c?.on_date)) errors.on_date = "Pick a date.";
  const irr = ["none", "mild", "moderate", "strong"].includes(c?.irritation) ? c.irritation : null;
  return result({
    on_date: c?.on_date, am_done: c?.am_done == null ? null : !!c.am_done, pm_done: c?.pm_done == null ? null : !!c.pm_done,
    irritation: irr, note: str(c?.note, 500) || null,
  }, errors);
}

export function cleanRecoveryCheckin(c) {
  const errors = {};
  const scale = (v) => (v === "" || v == null ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 3 ? Number(v) : NaN);
  const value = {
    treatment_id: isUuid(c?.treatment_id) ? c.treatment_id : null,
    day_after: Number(c?.day_after),
    redness: scale(c?.redness), tightness: scale(c?.tightness), comfort: scale(c?.comfort),
    note: str(c?.note, 800) || null, flagged: !!c?.flagged,
  };
  if (!Number.isInteger(value.day_after) || value.day_after < 0 || value.day_after > 60) errors.day_after = "Which day after the treatment?";
  for (const k of ["redness", "tightness", "comfort"]) if (Number.isNaN(value[k])) errors[k] = "Choose 0 to 3.";
  return result(value, errors);
}

export function cleanConsentAnswer(c) {
  const errors = {};
  if (!CONSENT_KINDS.includes(c?.kind)) errors.kind = "Unknown consent.";
  if (typeof c?.granted !== "boolean") errors.granted = "Yes or no?";
  const version = str(c?.version, 20);
  if (!version) errors.version = "Which version was shown?";
  const signature = str(c?.signature, 120);
  if (c?.granted === true && signature.length < 2) errors.signature = "Type your full name to sign.";
  return result({ kind: c?.kind, granted: c?.granted, version, signature: signature || null }, errors);
}

export const DEVICE_KINDS = ["phone", "upload", "usb_microscope", "dermatoscope", "pro_export"];
export function cleanDevice(d) {
  const errors = {};
  const name = str(d?.name, 80);
  if (!name) errors.name = "Name the device.";
  const kind = DEVICE_KINDS.includes(d?.kind) ? d.kind : "";
  if (!kind) errors.kind = "Choose the kind of device.";
  let calibration = null;
  if (d?.calibration && d.calibration.um_per_px !== "" && d.calibration.um_per_px != null) {
    const u = Number(d.calibration.um_per_px);
    if (!Number.isFinite(u) || u <= 0 || u > 10000) errors.calibration = "Micrometres per pixel must be a positive number.";
    else calibration = { um_per_px: u, method: str(d.calibration.method, 200) || null, reference: str(d.calibration.reference, 200) || null, calibrated_at: d.calibration.calibrated_at || null };
  }
  return result({ name, kind, model: str(d?.model, 120) || null, notes: str(d?.notes, 600) || null, calibration,
    lighting: d?.lighting ? cleanLighting(d.lighting) : null, active: d?.active !== false }, errors);
}

export function cleanStaff(s) {
  const errors = {};
  const email = normEmail(s?.email);
  if (!isEmail(email)) errors.email = "A valid email.";
  const display_name = str(s?.display_name, 80);
  if (!display_name) errors.display_name = "Their name.";
  const role = ["practitioner", "admin"].includes(s?.role) ? s.role : "";
  if (!role) errors.role = "Practitioner or admin?";
  return result({ email, display_name, role, active: s?.active !== false }, errors);
}

export function cleanMeasurementReview(r) {
  const errors = {};
  if (!isUuid(r?.id)) errors.id = "Unknown measurement.";
  if (!["verified", "rejected", "unreviewed"].includes(r?.review_status)) errors.review_status = "Verify or reject?";
  return result({ id: r?.id, review_status: r?.review_status, review_note: str(r?.review_note, 600) || null }, errors);
}

export function cleanValidation(v) {
  const errors = {};
  if (!MEASUREMENT_NAMES.includes(v?.name)) errors.name = "Unknown measurement.";
  const rc = Number(v?.repeatability_coefficient);
  if (!Number.isFinite(rc) || rc <= 0) errors.repeatability_coefficient = "A positive number, in the measurement's unit.";
  return result({
    name: v?.name, region: str(v?.region, 40) || "any", device_kind: str(v?.device_kind, 40) || "any",
    status: ["experimental", "validated", "retired"].includes(v?.status) ? v.status : "experimental",
    repeatability_coefficient: rc, within_sd: Number.isFinite(Number(v?.within_sd)) ? Number(v.within_sd) : null,
    n_subjects: Number.isInteger(Number(v?.n_subjects)) ? Number(v.n_subjects) : null,
    n_repeats: Number.isInteger(Number(v?.n_repeats)) ? Number(v.n_repeats) : null,
    protocol_version: str(v?.protocol_version, 40) || null, algorithm_version: str(v?.algorithm_version, 40) || null,
    notes: str(v?.notes, 1000) || null,
  }, errors);
}
