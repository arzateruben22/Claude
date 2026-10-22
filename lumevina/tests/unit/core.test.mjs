// The shared Skin Intelligence logic (js/skin/core), the same modules the
// pages and the edge functions load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOT } from "../pg/harness.mjs";
import { REGIONS, LANDMARKS, convexHull, regionPolygon, polygonArea, poseFromLandmarks, faceBox, framingAdvice, isRegion } from "../../js/skin/core/regions.js";
import { MEASUREMENTS, MEASUREMENT_NAMES, GROUPS, formatValue, displayable } from "../../js/skin/core/measurements.js";
import { checkWording, isSafeWording, CONFOUNDERS, SCOPE_NOTE } from "../../js/skin/core/wording.js";
import { classifyChange, changeMessage, VERDICTS } from "../../js/skin/core/change.js";
import { consentState, may, blockedReason, CONSENT_LABELS } from "../../js/skin/core/consent.js";
import { cleanTreatment, cleanCaptureBegin, cleanConsentAnswer, cleanRoutineEntry, cleanRecoveryCheckin, cleanDevice, cleanSkinProfile, MAX_BYTES } from "../../js/skin/core/validate.js";
import { staffMayOpen, treatmentForClient, sessionForClient, measurementForClient } from "../../js/skin/core/access.js";
import { buildTimeline, regionHistory, measurementSeries, comparable, baselineAndLatest } from "../../js/skin/core/evolution.js";
import { buildReport } from "../../js/skin/core/report.js";

const canon = JSON.parse(readFileSync(new URL("../fixtures/canonical-face-subset.json", import.meta.url)));

/* Project MediaPipe's canonical face, rotated by known angles, the way a camera would see it. */
function project({ yaw = 0, pitch = 0, roll = 0 } = {}) {
  const r = (d) => (d * Math.PI) / 180;
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  for (const [i, [x0, y0, z0]] of Object.entries(canon)) {
    // yaw about y (positive brings the client's right cheek, x < 0, forward), then pitch about x, then roll about z
    let x = x0 * Math.cos(r(yaw)) + z0 * Math.sin(r(yaw)), z = -x0 * Math.sin(r(yaw)) + z0 * Math.cos(r(yaw)), y = y0;
    const y2 = y * Math.cos(r(pitch)) + z * Math.sin(r(pitch)); z = -y * Math.sin(r(pitch)) + z * Math.cos(r(pitch)); y = y2;
    const x3 = x * Math.cos(r(roll)) - y * Math.sin(r(roll)); y = x * Math.sin(r(roll)) + y * Math.cos(r(roll)); x = x3;
    lm[i] = { x: 0.5 + x / 40, y: 0.5 - y / 40 };   // image coordinates, y down, normalized
  }
  return lm;
}

test("regions: ids are unique and every area has a landmark set", () => {
  const ids = REGIONS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of REGIONS.filter((x) => x.kind === "area")) assert.ok(LANDMARKS[r.id]?.length >= 10, r.id);
  assert.ok(isRegion("left_cheek") && !isRegion("ear"));
});

test("regions: the hull of a square's corners and an inside point is the square", () => {
  const hull = convexHull([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0.5, y: 0.5 }]);
  assert.equal(hull.length, 4);
  assert.equal(polygonArea(hull), 1);
});

test("regions: on the canonical face, each region lands where it should", () => {
  const lm = project();
  const c = (poly) => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length });
  const f = c(regionPolygon(lm, "forehead")), n = c(regionPolygon(lm, "nose")), ch = c(regionPolygon(lm, "chin"));
  const rc = c(regionPolygon(lm, "right_cheek")), lc = c(regionPolygon(lm, "left_cheek"));
  assert.ok(f.y < n.y && n.y < ch.y, "forehead above nose above chin");
  assert.ok(rc.x < n.x && lc.x > n.x, "unmirrored: the client's right cheek is on the image's left");
  assert.ok(Math.abs((n.x - rc.x) - (lc.x - n.x)) < 0.002, "cheeks are symmetric about the nose");
  assert.ok(lm[33].x < 0.5, "landmark 33 (the client's right eye) is on the image's left too");
});

test("pose: yaw sign and size from the landmarks match the rotation", () => {
  for (const yaw of [-40, -20, -5, 0, 5, 20, 40]) {
    const p = poseFromLandmarks(project({ yaw }));
    assert.ok(Math.abs(p.yaw - yaw) < 1.5, `yaw ${yaw} → ${p.yaw}`);
  }
});

test("pose: the same in a mirrored (selfie-preview) image", () => {
  const lm = project({ yaw: 20 }).map((p) => ({ x: 1 - p.x, y: p.y }));
  assert.ok(Math.abs(poseFromLandmarks(lm).yaw - 20) < 1.5);
});

test("pose: pitch has the right sign and rough size; roll the right size", () => {
  const up = poseFromLandmarks(project({ pitch: 15 })), down = poseFromLandmarks(project({ pitch: -15 }));
  assert.ok(up.pitch > 8 && up.pitch < 25, `chin up → ${up.pitch}`);
  assert.ok(down.pitch < -8 && down.pitch > -25, `chin down → ${down.pitch}`);
  assert.ok(Math.abs(Math.abs(poseFromLandmarks(project({ roll: 10 })).roll) - 10) < 1);
  assert.ok(Math.abs(poseFromLandmarks(project()).pitch) < 1);
});

test("framing: straight on is fine for the front; a turned head gets the right instruction", () => {
  const lm = project();
  const box = faceBox(lm);
  const scaled = { x: 0.5 - 0.3, y: 0.5 - 0.3, w: 0.6, h: 0.6 };
  assert.ok(box.h > 0);
  assert.deepEqual(framingAdvice("front", poseFromLandmarks(lm), scaled), { ok: true, hints: [] });
  const left = framingAdvice("left_cheek", { yaw: 10, pitch: 0, roll: 0 }, scaled);
  assert.match(left.hints[0], /left cheek faces the camera/);
  assert.ok(framingAdvice("left_cheek", { yaw: -20, pitch: 0, roll: 0 }, scaled).ok);
  assert.ok(framingAdvice("right_cheek", { yaw: 20, pitch: 0, roll: 0 }, scaled).ok);
  assert.ok(framingAdvice("front", { yaw: 0, pitch: 0, roll: 0 }, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }).hints.includes("Come a little closer"));
  assert.ok(framingAdvice("custom", null, null).ok);
});

test("wording: every built-in label, explanation and message reads safely", () => {
  const texts = [CONFOUNDERS, SCOPE_NOTE, ...Object.values(CONSENT_LABELS)];
  for (const [name, m] of Object.entries(MEASUREMENTS)) texts.push(m.label, m.short, m.what, m.method);
  for (const g of GROUPS) texts.push(g.label);
  const ok = { region: "left_cheek", comparable: true, quality: "good", calibration_status: "uncalibrated", device_kind: "phone", algorithm_version: "v1" };
  const val = { status: "validated", repeatability_coefficient: 1 };
  for (const name of MEASUREMENT_NAMES) {
    for (const [a, b] of [[5, 2], [2, 5], [5, 5.5]]) {
      const r = classifyChange({ ...ok, name, value: a }, { ...ok, name, value: b }, val);
      texts.push(changeMessage(name, "left_cheek", r, "practitioner"), changeMessage(name, "left_cheek", r, "client"));
    }
    texts.push(changeMessage(name, "nose", classifyChange({ ...ok, name, value: 1 }, { ...ok, name, value: 2 }, null)));
    texts.push(changeMessage(name, "nose", classifyChange({ ...ok, name, value: 1 }, { ...ok, name, value: 2, region: "chin" }, val)));
  }
  for (const t of texts) assert.deepEqual(checkWording(t), [], `unsafe wording: ${t}`);
});

test("wording: the guard catches the claims the directive forbids", () => {
  for (const bad of [
    "Your collagen density increased since March.", "Skin hydration level is up.", "You look 5 years younger.", "Your skin age is 32.",
    "Texture is 30% smoother.", "Pores improved by 40%.", "Skin score 82/100.", "Your glow score went up.",
    "This happened because you didn't follow your routine.", "Redness caused by your new serum.",
    "We diagnose rosacea from the photo.", "Guaranteed results in four sessions.", "The scar has fully healed.", "This proves the treatment works.",
  ]) assert.ok(!isSafeWording(bad), `should be flagged: ${bad}`);
  assert.ok(isSafeWording("Your left cheek looked smoother at your last two visits; we'll keep the same routine."));
});

test("change: the verdicts follow the rules", () => {
  const base = { name: "texture_roughness", region: "left_cheek", comparable: true, quality: "good", calibration_status: "uncalibrated", device_kind: "phone", algorithm_version: "v1" };
  const v = { status: "validated", repeatability_coefficient: 0.8 };
  const cls = (a, b, val = v, extra = {}) => classifyChange({ ...base, value: a }, { ...base, value: b, ...extra }, val).verdict;
  assert.equal(cls(5, 3), "improvement");               // lower is better
  assert.equal(cls(3, 5), "deterioration");
  assert.equal(cls(5, 4.5), "no_meaningful_change");     // within 0.8
  assert.equal(cls(5, 3, null), "uncertain");             // no validated threshold
  assert.equal(cls(5, 3, { status: "experimental", repeatability_coefficient: 0.8 }), "uncertain");
  assert.equal(cls(5, 3, v, { quality: "marginal" }), "uncertain");
  assert.equal(cls(5, 3, v, { quality: "poor" }), "invalid_comparison");
  assert.equal(cls(5, 3, v, { region: "chin" }), "invalid_comparison");
  assert.equal(cls(5, 3, v, { comparable: false }), "invalid_comparison");
  assert.equal(cls(5, 3, v, { device_kind: "usb_microscope" }), "invalid_comparison");
  assert.equal(cls(5, 3, v, { algorithm_version: "v2" }), "invalid_comparison");
  assert.equal(cls(5, 3, v, { calibration_status: "device_calibrated" }), "invalid_comparison");
  assert.equal(cls(5, NaN), "invalid_comparison");
  const up = { ...base, name: "texture_uniformity" };
  assert.equal(classifyChange({ ...up, value: 0.5 }, { ...up, value: 0.9 }, { status: "validated", repeatability_coefficient: 0.1 }).verdict, "improvement");
  for (const r of [cls(5, 3), cls(3, 5)]) assert.ok(VERDICTS.includes(r));
});

test("change: the deterioration message matches the directive's example and gives no cause", () => {
  const base = { name: "texture_roughness", region: "left_cheek", comparable: true, quality: "good", calibration_status: "uncalibrated", device_kind: "phone", algorithm_version: "v1" };
  const r = classifyChange({ ...base, value: 3 }, { ...base, value: 5 }, { status: "validated", repeatability_coefficient: 0.8 });
  const msg = changeMessage("texture_roughness", "left_cheek", r);
  assert.match(msg, /^The left cheek appears rougher than at the earlier visit\. This change exceeds the established repeatability threshold/);
  assert.match(msg, /Practitioner review recommended\./);
  assert.match(msg, /Lighting, hydration, inflammation/);
  assert.doesNotMatch(msg, /routine|adherence|because/i);
});

test("consent: the newest answer per kind wins and a withdrawal is a no", () => {
  const s = consentState([
    { kind: "clinical_photography", granted: true, version: "1", recorded_at: "2026-01-01T00:00:00Z" },
    { kind: "clinical_photography", granted: true, version: "1", recorded_at: "2026-02-01T00:00:00Z", withdrawn_at: "2026-03-01T00:00:00Z" },
    { kind: "treatment", granted: false, version: "1", recorded_at: "2026-01-01T00:00:00Z" },
    { kind: "treatment", granted: true, version: "1", recorded_at: "2026-01-02T00:00:00Z" },
  ]);
  assert.equal(may.capture(s), false);
  assert.equal(may.recordTreatment(s), true);
  assert.equal(may.sendPhotosToAI(s), false);
  assert.match(blockedReason("capture", s), /agreed to photos/);
  assert.equal(blockedReason("recordTreatment", s), "");
});

test("validate: treatment depths are bounded as a typo guard and nothing else", () => {
  const ok = cleanTreatment({ treatment_type: "microchanneling", treated_at: "2026-10-20T15:00:00Z", areas: ["forehead", "left_cheek"], needle_depth_mm: { forehead: "0.25", left_cheek: 0.5 } });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.needle_depth_mm, { forehead: 0.25, left_cheek: 0.5 });
  assert.ok(!cleanTreatment({ treatment_type: "microchanneling", treated_at: "2026-10-20", needle_depth_mm: { forehead: 25 } }).ok);
  assert.ok(!cleanTreatment({ treatment_type: "microchanneling", treated_at: "2026-10-20", needle_depth_mm: { forehead: -1 } }).ok);
  assert.ok(!cleanTreatment({ treatment_type: "laser", treated_at: "2026-10-20" }).ok);
  assert.ok(!cleanTreatment({ treatment_type: "peel", treated_at: "2026-10-20", series: { session_no: 5, of: 4 } }).ok);
  assert.equal(cleanTreatment({ treatment_type: "peel", treated_at: "2026-10-20", rf: { energy: "", mode: "" } }).value.rf, null);
});

test("validate: captures accept image types up to 25 MB, and a custom spot needs a name", () => {
  assert.ok(cleanCaptureBegin({ region: "left_cheek", mime: "image/heic", bytes: 4e6, source: "camera" }).ok);
  assert.ok(!cleanCaptureBegin({ region: "left_cheek", mime: "application/pdf", bytes: 4e6 }).ok);
  assert.ok(!cleanCaptureBegin({ region: "left_cheek", mime: "image/jpeg", bytes: MAX_BYTES + 1 }).ok);
  assert.ok(!cleanCaptureBegin({ region: "ear", mime: "image/jpeg", bytes: 10 }).ok);
  assert.ok(!cleanCaptureBegin({ region: "custom", mime: "image/jpeg", bytes: 10 }).ok);
  const meta = cleanCaptureBegin({ region: "front", mime: "image/jpeg", bytes: 10, capture_meta: { guide: "face-landmarks", pose: { yaw: 3.14159 }, evil: "<script>", checks: { sharpness: 120, flags: ["blur"] } } }).value.capture_meta;
  assert.deepEqual(meta, { guide: "face-landmarks", pose: { yaw: 3.142, pitch: null, roll: null }, checks: { sharpness: 120, flags: ["blur"] } });
});

test("validate: a yes needs a typed signature; a no doesn't", () => {
  assert.ok(!cleanConsentAnswer({ kind: "clinical_photography", granted: true, version: "1-draft", signature: "" }).ok);
  assert.ok(cleanConsentAnswer({ kind: "clinical_photography", granted: false, version: "1-draft" }).ok);
  assert.ok(!cleanConsentAnswer({ kind: "everything", granted: true, version: "1", signature: "Ana Diaz" }).ok);
});

test("validate: routine, recovery check-ins, devices, profiles", () => {
  assert.ok(cleanRoutineEntry({ slot: "am", product_name: "Gentle Gel Cleanser", category: "cleanser" }).ok);
  assert.ok(!cleanRoutineEntry({ slot: "noon", product_name: "x" }).ok);
  assert.ok(cleanRecoveryCheckin({ day_after: 1, redness: 2, comfort: 1 }).ok);
  assert.ok(!cleanRecoveryCheckin({ day_after: 1, redness: 7 }).ok);
  assert.ok(!cleanDevice({ name: "Scope", kind: "usb_microscope", calibration: { um_per_px: -3 } }).ok);
  assert.equal(cleanSkinProfile({ goals: "x".repeat(5000) }).value.goals.length, 600);
});

test("access: practitioners open clients per the assignment mode; admins always", () => {
  const p = { role: "practitioner", active: true }, a = { role: "admin", active: true };
  assert.ok(staffMayOpen(p, "x", { assignmentMode: "all" }));
  assert.ok(!staffMayOpen(p, "x", { assignmentMode: "assigned", assignedProfileIds: ["y"] }));
  assert.ok(staffMayOpen(p, "x", { assignmentMode: "assigned", assignedProfileIds: ["x"] }));
  assert.ok(staffMayOpen(a, "x", { assignmentMode: "assigned" }));
  assert.ok(!staffMayOpen({ ...a, active: false }, "x"));
});

test("access: the client view of a treatment, a session and a measurement leaves out the private parts", () => {
  const t = treatmentForClient({ id: "t", status: "signed", treated_at: "2026-10-20", treatment_type: "microchanneling", areas: ["forehead"], needle_depth_mm: { forehead: 0.5 }, notes_private: "secret", client_summary: "Microchanneling" });
  assert.equal(t.notes_private, undefined); assert.equal(t.needle_depth_mm, undefined); assert.equal(t.summary, "Microchanneling");
  assert.equal(treatmentForClient({ status: "draft" }), null);
  assert.equal(sessionForClient({ id: "s", notes_private: "secret" }).notes_private, undefined);
  assert.equal(measurementForClient({ id: "m", review_status: "verified", review_note: "secret" }).review_note, undefined);
  assert.equal(measurementForClient({ id: "m", review_status: "rejected" }), null);
});

function fakeHistory(visits = 3) {
  const sessions = [], captures = [], quality = [], measurements = [];
  for (let i = 0; i < visits; i++) {
    const day = `2026-${String(1 + Math.floor(i / 2)).padStart(2, "0")}-${String(1 + (i % 2) * 14).padStart(2, "0")}T10:00:00Z`;
    sessions.push({ id: `s${i}`, started_at: day, status: "reviewed", device_id: "d1", visit_label: null });
    captures.push({ id: `c${i}`, session_id: `s${i}`, region: "left_cheek", status: "processed", captured_at: day, calibration_status: "uncalibrated" });
    quality.push({ capture_id: `c${i}`, passed: true, comparable: i !== 1 });
    measurements.push({ capture_id: `c${i}`, name: "redness_a_star", region: "left_cheek", value: 14 - i, uncertainty: { sd: 0.3 }, quality: "good", review_status: i === 2 ? "verified" : "unreviewed", created_at: day, experimental: true });
  }
  return { sessions, captures, quality, measurements, devices: [{ id: "d1", kind: "phone" }], treatments: [] };
}

test("evolution: timeline, region history and series skip what can't be compared", () => {
  const h = fakeHistory(3);
  const tl = buildTimeline(h);
  assert.deepEqual(tl.map((v) => v.label), ["Visit 1", "Visit 2", "Visit 3"]);
  assert.equal(regionHistory(tl, "left_cheek").length, 3);
  const s = measurementSeries(tl, h.measurements, "redness_a_star", "left_cheek");
  assert.deepEqual(s.points.map((p) => p.value), [14, 12]);    // visit 2 failed quality
  assert.equal(s.points[0].ci.length, 2);
  const bl = baselineAndLatest(s);
  assert.equal(bl.baseline.value, 14); assert.equal(bl.latest.value, 12);
  assert.ok(!comparable(tl[0].captures[0], tl[1].captures[0]).ok);
  assert.ok(comparable(tl[0].captures[0], tl[2].captures[0]).ok);
});

test("evolution: a newer analysis of the same image replaces the older one in the series", () => {
  const h = fakeHistory(1);
  h.measurements.push({ ...h.measurements[0], value: 99, created_at: "2027-01-01T00:00:00Z" });
  const s = measurementSeries(buildTimeline(h), h.measurements, "redness_a_star", "left_cheek");
  assert.deepEqual(s.points.map((p) => p.value), [99]);
});

test("evolution: twenty-five visits are no different from three", () => {
  const h = fakeHistory(25);
  const tl = buildTimeline(h);
  assert.equal(tl.length, 25);
  assert.equal(measurementSeries(tl, h.measurements, "redness_a_star", "left_cheek").points.length, 24);
});

test("report: only verified measurements, confirmed shared changes, and no private notes", () => {
  const r = buildReport({
    profile: { name: "Ana" },
    measurements: [
      { name: "redness_a_star", region: "left_cheek", value: 12.3, quality: "good", review_status: "verified", review_note: "secret", calibration_status: "uncalibrated" },
      { name: "texture_roughness", region: "left_cheek", value: 3, quality: "good", review_status: "unreviewed", calibration_status: "uncalibrated" },
    ],
    changes: [
      { name: "redness_a_star", region: "left_cheek", verdict: "improvement", reasons: [], shared_with_client: true, review_status: "confirmed" },
      { name: "texture_roughness", region: "left_cheek", verdict: "deterioration", reasons: [], shared_with_client: false, review_status: "unreviewed" },
    ],
    treatments: [{ id: "t", status: "signed", treated_at: "2026-10-20", treatment_type: "microchanneling", notes_private: "secret", needle_depth_mm: { forehead: 0.5 }, client_summary: "Microchanneling, full face" }],
    summary: "Your left cheek looked less red this month.",
  });
  assert.ok(r.ok, JSON.stringify(r.problems));
  const json = JSON.stringify(r.content);
  assert.doesNotMatch(json, /secret|needle_depth/);
  assert.equal(r.content.measurements.length, 1);
  assert.equal(r.content.changes.length, 1);
  assert.match(r.content.changes[0].text, /appears less red/);
});

test("report: a summary that breaks the wording rules is sent back with the reasons", () => {
  const r = buildReport({ summary: "Your texture is 40% smoother and collagen production is up!" });
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems.map((p) => p.id).sort(), ["biology", "percent"]);
});

test("measurements: values display honestly", () => {
  assert.equal(formatValue({ name: "redness_a_star", value: 12.345, calibration_status: "uncalibrated" }), "12.35 a*");
  assert.equal(formatValue({ name: "redness_a_star", value: null }), "Insufficient data");
  assert.equal(displayable({ name: "scar_area", value: 120, quality: "good", calibration_status: "uncalibrated" }).why, "Needs a calibrated image");
  assert.equal(displayable({ name: "redness_a_star", value: 1, quality: "poor" }).ok, false);
});
