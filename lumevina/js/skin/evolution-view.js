/* Lumevina Skin Intelligence — Skin Evolution (shared by My Skin and the studio)
 *
 * Visit 1 to today, for one area at a time:
 *   the visit timeline (with treatment days), any two visits compared
 *   (slider, side by side with synchronized zoom, difference map), each
 *   measurement charted with its uncertainty, the changes the practitioner
 *   confirmed, every visit's photos in one grid, and the dated sequence.
 * Image links are short-lived and fetched on demand.
 */

import { buildTimeline, regionHistory, measurementSeries, regionsWithPhotos, comparable } from "./core/evolution.js";
import { GROUPS, MEASUREMENTS, NOT_MEASURED, formatValue, displayable, isCalibrated } from "./core/measurements.js";
import { regionLabel } from "./core/regions.js";
import { reasonText } from "./core/change.js";
import { SCOPE_NOTE, CONFOUNDERS } from "./core/wording.js";
import { lineChart, sparkline } from "./charts.js";
import { createCompare, createSequence } from "./viewer.js";
import { esc, day, shortDay } from "./ui.js";

/**
 * @param {HTMLElement} el
 * @param {object} o
 *   data        { sessions, captures, quality?, measurements, treatments, devices?, validation, changes, derived? }
 *   urls        async (captureIds, kind, referenceId) → { id: url }
 *   audience    'client' | 'practitioner'
 *   onCompare   optional (fromId, toId) → practitioner asks for registration + change detection
 */
export async function renderEvolution(el, o) {
  const q = o.data.quality ?? o.data.captures.map((c) => (c.quality ? { capture_id: c.id, ...c.quality } : null)).filter(Boolean);
  const tl = buildTimeline({ ...o.data, quality: q });
  const regions = regionsWithPhotos(tl).filter((r) => r.id !== "front" || true);
  if (!tl.length || !regions.length) {
    el.innerHTML = `<div class="sk-empty">No photos yet. ${o.audience === "client" ? "Your first visit's photos will appear here, or add your own." : "Open a session to take the first photos."}</div>`;
    return;
  }
  const st = { region: regions.sort((a, b) => b.visits - a.visits)[0].id, a: null, b: null, group: "redness", cache: new Map() };

  el.innerHTML = `
    <div class="sk-row" style="justify-content:space-between;margin-bottom:.6rem">
      <div class="sk-chips" role="radiogroup" aria-label="Area" data-regions></div>
      <span class="sk-fine">${tl.length} visit${tl.length === 1 ? "" : "s"} · ${esc(day(tl[0].date))} to ${esc(day(tl[tl.length - 1].date))}</span>
    </div>
    <h3 class="sk-h3">Visits <span class="sk-fine">(choose two to compare)</span></h3>
    <div class="sk-tl" data-tl></div>
    <div class="sk-grid-2" style="margin-top:.5rem">
      <section class="sk-card" aria-labelledby="ev-cmp"><div class="sk-card-head"><h3 class="sk-h3" id="ev-cmp">Before and after</h3><span class="sk-fine" data-cmp-note></span></div><div data-cmp></div><div data-cmp-actions></div></section>
      <section class="sk-card" aria-labelledby="ev-chg"><h3 class="sk-h3" id="ev-chg">${o.audience === "client" ? "What changed" : "Change detection"}</h3><div data-changes></div></section>
    </div>
    <section class="sk-card" style="margin-top:1rem" aria-labelledby="ev-m">
      <div class="sk-card-head"><h3 class="sk-h3" id="ev-m">Measurements</h3><div class="sk-seg" role="radiogroup" aria-label="Measurement group" data-groups></div></div>
      <div data-charts></div>
      <p class="sk-fine" style="margin-top:.8rem">${esc(SCOPE_NOTE)}</p>
    </section>
    <div class="sk-grid-2" style="margin-top:1rem">
      <section class="sk-card" aria-labelledby="ev-g"><h3 class="sk-h3" id="ev-g">Every visit</h3><div data-gallery></div></section>
      <section class="sk-card" aria-labelledby="ev-s"><h3 class="sk-h3" id="ev-s">Your skin over time</h3><div data-seq></div></section>
    </div>
    <details class="sk-card" style="margin-top:1rem"><summary class="sk-h3" style="cursor:pointer">What photographs can't measure</summary>
      <div class="sk-notm" style="margin-top:.8rem">${NOT_MEASURED.map((n) => `<div><b>${esc(n.what)}</b>${esc(n.needs)}</div>`).join("")}</div></details>`;

  const $ = (s) => el.querySelector(s);
  const urlsFor = async (ids, kind = "view", ref = null) => {
    const need = ids.filter((id) => !st.cache.has(`${kind}:${ref}:${id}`));
    if (need.length) { const got = await o.urls(need, kind, ref); for (const id of need) st.cache.set(`${kind}:${ref}:${id}`, got[id] ?? null); }
    return Object.fromEntries(ids.map((id) => [id, st.cache.get(`${kind}:${ref}:${id}`)]));
  };

  function paintRegions() {
    $("[data-regions]").innerHTML = regions.map((r) => `<button type="button" class="sk-chip" role="radio" aria-checked="${r.id === st.region}" aria-pressed="${r.id === st.region}" data-region="${r.id}">${esc(r.label)} <small>${r.visits}</small></button>`).join("");
  }

  async function paintTimeline() {
    const hist = regionHistory(tl, st.region);
    if (!st.a || !hist.some((h) => h.capture.id === st.a)) st.a = hist[0]?.capture.id ?? null;
    if (!st.b || !hist.some((h) => h.capture.id === st.b)) st.b = hist[hist.length - 1]?.capture.id ?? null;
    const thumbs = await urlsFor(hist.map((h) => h.capture.id), "thumb");
    $("[data-tl]").innerHTML = hist.map((h) => {
      const tags = [...h.visit.treatments.map((t) => `<span class="sk-tag sk-tag--tr">${esc(t.treatment_type === "microchanneling" ? "Microchanneling" : t.treatment_type || "Treatment")}</span>`),
        ...(h.capture.quality && !h.capture.quality.comparable ? [`<span class="sk-tag sk-tag--bad">Not comparable</span>`] : [])].join("");
      const pick = h.capture.id === st.a ? "Before" : h.capture.id === st.b ? "After" : "";
      return `<button type="button" class="sk-tl-item" data-cap="${h.capture.id}" aria-pressed="${!!pick}">
        ${thumbs[h.capture.id] ? `<img src="${esc(thumbs[h.capture.id])}" alt="" loading="lazy">` : `<div style="aspect-ratio:4/3;border-radius:9px;background:var(--sk-stage)"></div>`}
        <b>${esc(h.visit.label)}</b><small>${esc(day(h.visit.date))}${pick ? ` · ${pick}` : ""}</small><div class="sk-tl-tags">${tags}</div></button>`;
    }).join("");
  }

  async function paintCompare() {
    const hist = regionHistory(tl, st.region);
    const A = hist.find((h) => h.capture.id === st.a), B = hist.find((h) => h.capture.id === st.b);
    if (!A || !B || A === B) { $("[data-cmp]").innerHTML = `<p class="sk-empty">${hist.length < 2 ? "Comparisons start from the second visit." : "Choose two different visits."}</p>`; $("[data-cmp-note]").textContent = ""; return; }
    const [views, diff, aligned] = await Promise.all([urlsFor([A.capture.id, B.capture.id], "view"), urlsFor([B.capture.id], "diffmap", A.capture.id), urlsFor([B.capture.id], "aligned", A.capture.id)]);
    createCompare($("[data-cmp]"), {
      before: { src: views[A.capture.id], label: A.visit.label, date: A.visit.date, kind: "view" },
      after: { src: views[B.capture.id], label: B.visit.label, date: B.visit.date, kind: "view" },
      diff: diff[B.capture.id] ? { src: diff[B.capture.id] } : null,
      alignedAfter: aligned[B.capture.id] ? { src: aligned[B.capture.id] } : null,
    });
    const c = comparable(A.capture, B.capture);
    $("[data-cmp-note]").innerHTML = c.ok ? `<span class="sk-badge sk-badge--ok">Comparable</span>` : `<span class="sk-badge sk-badge--un" title="${esc(c.reasons.map(reasonText).join("; "))}">Look only</span>`;
    $("[data-cmp-actions]").innerHTML = o.onCompare ? `<div class="sk-row sk-row--end" style="margin-top:.6rem"><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-run>Align and detect changes</button></div>` : "";
    paintChanges(A.capture.id, B.capture.id);
  }

  function paintChanges(aId, bId) {
    const list = (o.data.changes || []).filter((c) => (o.audience === "client" || (c.from_capture_id === aId && c.to_capture_id === bId)) && (c.region === st.region || o.audience === "client"));
    const mine = o.audience === "client" ? list.filter((c) => c.region === st.region) : list;
    $("[data-changes]").innerHTML = mine.length
      ? mine.map((c) => `<div class="sk-change sk-change--${esc(c.verdict)}" style="margin-bottom:.6rem">${esc(c.text || "")}
          ${o.audience === "practitioner" ? `<div class="sk-row" style="margin-top:.45rem"><span class="sk-badge ${c.review_status === "confirmed" ? "sk-badge--ok" : "sk-badge--un"}">${esc(c.review_status)}</span>${c.shared_with_client ? `<span class="sk-badge sk-badge--ok">Shared</span>` : ""}
            ${["improvement", "deterioration"].includes(c.verdict) ? `<button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-chg="${c.id}" data-share="1">Confirm and share</button><button type="button" class="sk-btn sk-btn-sm sk-btn-quiet" data-chg="${c.id}" data-share="0">Confirm, keep private</button><button type="button" class="sk-link" data-chg="${c.id}" data-dismiss>Dismiss</button>` : ""}</div>` : ""}</div>`).join("")
      : `<p class="sk-fine">${o.audience === "client" ? "Changes appear here once your practitioner has reviewed them. " + esc(CONFOUNDERS) : "Run “Align and detect changes” to compare these two visits measurement by measurement."}</p>`;
  }

  function paintGroups() {
    $("[data-groups]").innerHTML = GROUPS.filter((g) => g.id !== "scars" || o.data.measurements.some((m) => m.name.startsWith("scar_")))
      .map((g) => `<button type="button" role="radio" aria-checked="${g.id === st.group}" data-group="${g.id}">${esc(g.label)}</button>`).join("");
  }

  function paintCharts() {
    const g = GROUPS.find((x) => x.id === st.group);
    const treatments = (o.data.treatments || []).map((t) => ({ treated_at: t.treated_at, label: t.summary || t.client_summary || t.treatment_type }));
    $("[data-charts]").innerHTML = g.names.map((n) => `<div class="sk-mchart" data-m="${n}" style="margin:1rem 0 1.4rem"></div>`).join("");
    for (const name of g.names) {
      const box = el.querySelector(`[data-m="${name}"]`);
      const series = measurementSeries(tl, o.data.measurements, name, st.region);
      const v = (o.data.validation || []).find((x) => x.name === name && (x.region === st.region || x.region === "any") && x.status === "validated");
      const def = MEASUREMENTS[name];
      const last = [...series.points].reverse().find((p) => p.value != null);
      const unit = last ? (last.unit || (isCalibrated(last.measurement.calibration_status) ? def.unit.calibrated : def.unit.uncalibrated)) : def.unit.uncalibrated;
      box.innerHTML = `<div class="sk-card-head" style="margin-bottom:.3rem"><div><b>${esc(def.label)}</b> <span class="sk-fine">${esc(unit)}</span>
          <p class="sk-fine" style="margin:.15rem 0 0">${esc(def.what)}</p></div>
          <div class="sk-row">${v ? `<span class="sk-badge sk-badge--ok" title="${esc(v.notes || `Changes smaller than ${(+v.repeatability_coefficient).toFixed(def.decimals)} aren't meaningful`)}">Validated${/DEMO/.test(v.notes || "") ? " (demo)" : ""}</span>` : `<span class="sk-badge sk-badge--exp" title="Shown for interest; not used to decide whether skin has changed">Experimental</span>`}
          ${last ? `<b>${esc(displayable(last.measurement).ok ? formatValue(last.measurement) : displayable(last.measurement).why)}</b>` : ""}</div></div><div data-chart></div>`;
      lineChart(box.querySelector("[data-chart]"), series, { unit, decimals: def.decimals, treatments, validation: v });
    }
  }

  async function paintGallery() {
    const ids = [];
    const rows = tl.map((v) => { const caps = v.captures.filter((c) => c.region === st.region && c.status !== "excluded"); ids.push(...caps.map((c) => c.id)); return { v, caps }; }).filter((r) => r.caps.length);
    const thumbs = await urlsFor(ids, "thumb");
    $("[data-gallery]").innerHTML = `<div class="sk-gallery">${rows.flatMap((r) => r.caps.map((c) => `<figure><img src="${esc(thumbs[c.id] || "")}" alt="${esc(`${regionLabel(c.region)}, ${r.v.label}, ${day(r.v.date)}`)}" loading="lazy"><figcaption>${esc(r.v.label)} · ${esc(shortDay(r.v.date))}</figcaption></figure>`)).join("")}</div>`;
    const hist = regionHistory(tl, st.region);
    const views = await urlsFor(hist.map((h) => h.capture.id), "view");
    if (hist.length >= 2) createSequence($("[data-seq]"), hist.map((h) => ({ src: views[h.capture.id], label: h.visit.label, date: h.visit.date })));
    else $("[data-seq]").innerHTML = `<p class="sk-empty">The sequence starts from the second visit.</p>`;
  }

  async function paintAll() { paintRegions(); await paintTimeline(); await paintCompare(); paintGroups(); paintCharts(); await paintGallery(); }

  el.addEventListener("click", async (e) => {
    const r = e.target.closest("[data-region]");
    if (r) { st.region = r.dataset.region; st.a = st.b = null; await paintAll(); return; }
    const cap = e.target.closest("[data-cap]");
    if (cap) {
      const id = cap.dataset.cap;
      if (id === st.a || id === st.b) return;
      const hist = regionHistory(tl, st.region); const idx = (x) => hist.findIndex((h) => h.capture.id === x);
      if (idx(id) < idx(st.b)) st.a = id; else st.b = id;
      await paintTimeline(); await paintCompare(); return;
    }
    const g = e.target.closest("[data-group]"); if (g) { st.group = g.dataset.group; paintGroups(); paintCharts(); return; }
    if (e.target.closest("[data-run]") && o.onCompare) {
      const btn = e.target.closest("[data-run]"); btn.disabled = true; btn.textContent = "Comparing…";
      try { const res = await o.onCompare(st.a, st.b); o.data.changes = [...(o.data.changes || []).filter((c) => !(c.from_capture_id === st.a && c.to_capture_id === st.b)), ...(res.changes || [])]; paintChanges(st.a, st.b); }
      finally { btn.disabled = false; btn.textContent = "Align and detect changes"; }
      return;
    }
    const chg = e.target.closest("[data-chg]");
    if (chg && o.onReviewChange) {
      const res = await o.onReviewChange(chg.dataset.chg, chg.hasAttribute("data-dismiss") ? "dismissed" : "confirmed", chg.dataset.share === "1");
      const c = o.data.changes.find((x) => x.id === chg.dataset.chg); if (c && res?.change) Object.assign(c, res.change);
      paintChanges(st.a, st.b);
    }
  });
  await paintAll();
}

/** A one-line summary per group for dashboard cards: latest value and a sparkline. */
export function evolutionHighlights(data, region) {
  const q = data.quality ?? data.captures.map((c) => (c.quality ? { capture_id: c.id, ...c.quality } : null)).filter(Boolean);
  const tl = buildTimeline({ ...data, quality: q });
  return ["redness_a_star", "texture_roughness", "pigment_contrast", "pore_density"].map((name) => {
    const s = measurementSeries(tl, data.measurements, name, region);
    const vals = s.points.map((p) => p.value);
    const last = [...s.points].reverse().find((p) => p.value != null);
    return { name, label: MEASUREMENTS[name].short, region: s.regionLabel, last, spark: sparkline(vals, { better: MEASUREMENTS[name].better }), visits: s.points.length };
  });
}
