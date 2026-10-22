/* Lumevina Skin Intelligence — the Skin Evolution model (shared)
 *
 * Turns sessions, captures, quality checks, measurements and treatments into
 * what the evolution screens draw: a visit timeline, the images of a region
 * visit by visit, the pairs that can honestly be compared, and the series of
 * one measurement over time with its uncertainty. No limit on visits.
 */

import { regionLabel } from "./regions.js";
import { MEASUREMENTS, isCalibrated } from "./measurements.js";

const byTime = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]));

/**
 * @param {object} d { sessions[], captures[], quality[] (latest per capture), measurements[], treatments[] (client-safe), devices[] }
 * @returns {Array} visits, oldest first: { session, date, label, captures[], treatments[], regions[] }
 */
export function buildTimeline(d) {
  const qBy = new Map((d.quality ?? []).map((q) => [q.capture_id, q]));
  const devBy = new Map((d.devices ?? []).map((x) => [x.id, x]));
  const sessions = [...(d.sessions ?? [])].filter((s) => s.status !== "void").sort(byTime("started_at"));
  const treatments = [...(d.treatments ?? [])].sort(byTime("treated_at"));
  return sessions.map((s, i) => {
    const caps = (d.captures ?? []).filter((c) => c.session_id === s.id && c.status !== "pending_upload")
      .map((c) => ({ ...c, quality: qBy.get(c.id) ?? null, device_kind: devBy.get(s.device_id)?.kind ?? null }))
      .sort(byTime("captured_at"));
    const day = String(s.started_at).slice(0, 10);
    const tr = treatments.filter((t) => (t.session_id && t.session_id === s.id) || (!t.session_id && String(t.treated_at).slice(0, 10) === day));
    return { index: i + 1, session: s, date: s.started_at, label: s.visit_label || `Visit ${i + 1}`, captures: caps, treatments: tr,
      regions: [...new Set(caps.map((c) => c.region))] };
  });
}

/** The capture of a region at each visit (the best one when there are several), oldest first. */
export function regionHistory(timeline, region, siteId = null) {
  const out = [];
  for (const v of timeline) {
    const caps = v.captures.filter((c) => c.region === region && (siteId == null || c.site_id === siteId) && c.status !== "excluded");
    if (!caps.length) continue;
    const best = caps.slice().sort((a, b) => score(b) - score(a))[0];
    out.push({ visit: v, capture: best });
  }
  return out;
  function score(c) { return (c.quality?.comparable ? 2 : 0) + (c.quality?.passed ? 1 : 0) + (c.status === "processed" ? 0.5 : 0); }
}

/** Whether two captures can be compared side by side as measurements (not just looked at). */
export function comparable(a, b) {
  const reasons = [];
  if (!a || !b) return { ok: false, reasons: ["missing"] };
  if (a.region !== b.region) reasons.push("different_regions");
  if (a.site_id !== b.site_id) reasons.push("different_sites");
  if (!a.quality?.comparable || !b.quality?.comparable) reasons.push("failed_quality_check");
  if ((a.device_kind ?? null) !== (b.device_kind ?? null)) reasons.push("different_devices");
  if (isCalibrated(a.calibration_status) !== isCalibrated(b.calibration_status)) reasons.push("calibration_differs");
  return { ok: reasons.length === 0, reasons };
}

/**
 * One measurement over time for a region: points oldest first, each with
 * value, uncertainty band, quality and whether it is experimental. Rejected
 * measurements and failed captures are left out; the latest algorithm
 * version per capture wins.
 */
export function measurementSeries(timeline, measurements, name, region) {
  const capIndex = new Map();
  for (const v of timeline) for (const c of v.captures) capIndex.set(c.id, { visit: v, capture: c });
  const latest = new Map();
  for (const m of measurements ?? []) {
    if (m.name !== name || m.region !== region || m.review_status === "rejected") continue;
    const prev = latest.get(m.capture_id);
    if (!prev || String(m.created_at) > String(prev.created_at)) latest.set(m.capture_id, m);
  }
  const pts = [];
  for (const [captureId, m] of latest) {
    const at = capIndex.get(captureId);
    if (!at || at.capture.status === "excluded" || at.capture.quality?.comparable === false) continue;
    const v = Number(m.value);
    const ci = Array.isArray(m.uncertainty?.ci95) ? m.uncertainty.ci95.map(Number) : (Number.isFinite(m.uncertainty?.sd) ? [v - 1.96 * m.uncertainty.sd, v + 1.96 * m.uncertainty.sd] : null);
    pts.push({ date: at.visit.date, visitIndex: at.visit.index, label: at.visit.label, captureId, value: Number.isFinite(v) ? v : null,
      ci, quality: m.quality, experimental: m.experimental !== false, verified: m.review_status === "verified", unit: m.unit, measurement: m });
  }
  pts.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { name, region, label: MEASUREMENTS[name]?.label ?? name, regionLabel: regionLabel(region), better: MEASUREMENTS[name]?.better ?? "lower", points: pts };
}

/** The first and last comparable points of a series (the baseline and the latest). */
export function baselineAndLatest(series) {
  const ok = series.points.filter((p) => p.value != null);
  return ok.length >= 2 ? { baseline: ok[0], latest: ok[ok.length - 1] } : null;
}

/** Regions with photos, with the visit count for each, for the region picker. */
export function regionsWithPhotos(timeline) {
  const count = new Map();
  for (const v of timeline) for (const r of v.regions) count.set(r, (count.get(r) ?? 0) + 1);
  return [...count.entries()].map(([id, n]) => ({ id, label: regionLabel(id), visits: n }));
}
