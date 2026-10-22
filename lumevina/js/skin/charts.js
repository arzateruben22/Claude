/* Lumevina Skin Intelligence — measurement charts (hand-drawn SVG)
 *
 * One measurement over visits, the way it can honestly be read:
 *   • the line and points: solid for verified values, hollow for unreviewed
 *   • the shaded band around each point: its 95% uncertainty
 *   • a dashed line and an "Experimental" label until the measurement is
 *     validated; once it is, a band around the first visit shows the
 *     repeatability threshold (changes inside it are not meaningful)
 *   • treatment days as small diamonds along the bottom
 * Colours come from CSS variables so the chart reads in the light client
 * page and the dark studio. A visually hidden table carries the numbers for
 * screen readers. No chart library.
 */

import { esc, shortDay, day } from "./ui.js";

const W = 640, H = 230, PAD = { l: 52, r: 18, t: 18, b: 44 };

function niceTicks(min, max, n = 4) {
  if (!(max > min)) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const span = max - min, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = []; for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}

/**
 * @param {HTMLElement} el
 * @param {object} series  from core/evolution.js measurementSeries()
 * @param {object} o  { unit, decimals, treatments: [{ treated_at, label }], validation: { status, repeatability_coefficient } }
 */
export function lineChart(el, series, o = {}) {
  const pts = series.points.filter((p) => p.value != null);
  if (pts.length === 0) { el.innerHTML = `<p class="sk-empty">Insufficient data: no measurement of this yet.</p>`; return; }
  const t = (d) => Date.parse(d);
  const t0 = t(pts[0].date), t1 = t(pts[pts.length - 1].date);
  const span = Math.max(t1 - t0, 86400000 * 14);
  const x = (d) => PAD.l + ((t(d) - t0) / span) * (W - PAD.l - PAD.r) * (pts.length > 1 ? 1 : 0) + (pts.length > 1 ? 0 : (W - PAD.l - PAD.r) / 2);
  const vals = pts.flatMap((p) => (p.ci ? [p.ci[0], p.ci[1], p.value] : [p.value]));
  const rc = o.validation?.status === "validated" ? Number(o.validation.repeatability_coefficient) : null;
  if (rc) vals.push(pts[0].value - rc, pts[0].value + rc);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const vmin = ticks[0], vmax = ticks[ticks.length - 1];
  const y = (v) => PAD.t + (1 - (v - vmin) / (vmax - vmin || 1)) * (H - PAD.t - PAD.b);
  const dec = o.decimals ?? 2;
  const experimental = !rc;
  const id = "c" + Math.random().toString(36).slice(2, 8);

  const band = pts.filter((p) => p.ci).length >= 2
    ? `<path class="sk-ch-band" d="M${pts.filter((p) => p.ci).map((p) => `${x(p.date)},${y(p.ci[1])}`).join("L")}L${pts.filter((p) => p.ci).reverse().map((p) => `${x(p.date)},${y(p.ci[0])}`).join("L")}Z"/>`
    : pts.filter((p) => p.ci).map((p) => `<line class="sk-ch-err" x1="${x(p.date)}" x2="${x(p.date)}" y1="${y(p.ci[0])}" y2="${y(p.ci[1])}"/>`).join("");
  const thr = rc ? `<rect class="sk-ch-thr" x="${PAD.l}" width="${W - PAD.l - PAD.r}" y="${y(pts[0].value + rc)}" height="${Math.max(1, y(pts[0].value - rc) - y(pts[0].value + rc))}"><title>Within ±${rc.toFixed(dec)} of the first visit: not a meaningful change for this measurement</title></rect>` : "";
  const line = pts.length > 1 ? `<path class="sk-ch-line${experimental ? " is-exp" : ""}" d="M${pts.map((p) => `${x(p.date)},${y(p.value)}`).join("L")}"/>` : "";
  const dots = pts.map((p, i) => `<g class="sk-ch-pt${p.verified ? " is-ok" : ""}${p.quality === "marginal" ? " is-marg" : ""}" tabindex="0" role="img"
      aria-label="${esc(`${p.label}, ${day(p.date)}: ${p.value.toFixed(dec)} ${o.unit || ""}${p.verified ? ", verified" : ", not yet reviewed"}`)}">
      <circle cx="${x(p.date)}" cy="${y(p.value)}" r="5"/><title>${esc(`${p.label} · ${day(p.date)}\n${p.value.toFixed(dec)} ${o.unit || ""}${p.ci ? `\n95% range ${p.ci[0].toFixed(dec)}–${p.ci[1].toFixed(dec)}` : ""}${p.verified ? "\nVerified by your practitioner" : "\nNot yet reviewed"}`)}</title></g>`).join("");
  const grid = ticks.map((v) => `<g class="sk-ch-grid"><line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${PAD.l - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(dec)}</text></g>`).join("");
  const xl = pts.map((p, i) => `<text class="sk-ch-x" x="${x(p.date)}" y="${H - PAD.b + 18}" text-anchor="middle">${esc(shortDay(p.date))}</text>`).join("");
  const tr = (o.treatments || []).filter((d) => t(d.treated_at) >= t0 - 86400000 && t(d.treated_at) <= t1 + 86400000)
    .map((d) => { const cx = x(d.treated_at); return `<g class="sk-ch-tr"><line x1="${cx}" x2="${cx}" y1="${PAD.t}" y2="${H - PAD.b}"/><path d="M${cx},${H - PAD.b + 26} l5,5 l-5,5 l-5,-5z"/><title>${esc(`${d.label || "Treatment"} · ${day(d.treated_at)}`)}</title></g>`; }).join("");

  el.innerHTML = `
    <figure class="sk-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d" preserveAspectRatio="xMidYMid meet">
        <title id="${id}-t">${esc(series.label)}, ${esc(series.regionLabel)}</title>
        <desc id="${id}-d">${esc(`${pts.length} visits, from ${pts[0].value.toFixed(dec)} to ${pts[pts.length - 1].value.toFixed(dec)} ${o.unit || ""}.${experimental ? " Experimental: not yet validated." : ""}`)}</desc>
        ${grid}${thr}${tr}${band}${line}${dots}${xl}
      </svg>
      <figcaption class="sk-ch-legend">
        <span><i class="sk-k sk-k-line${experimental ? " is-exp" : ""}"></i>${experimental ? "Experimental (not yet validated)" : "Measured value"}</span>
        <span><i class="sk-k sk-k-band"></i>95% range</span>
        ${rc ? `<span><i class="sk-k sk-k-thr"></i>No-meaningful-change zone</span>` : ""}
        ${(o.treatments || []).length ? `<span><i class="sk-k sk-k-tr"></i>Treatment</span>` : ""}
        <span><i class="sk-k sk-k-ok"></i>Verified</span><span><i class="sk-k sk-k-un"></i>Not yet reviewed</span>
      </figcaption>
      <div class="sk-vh"><table><caption>${esc(series.label)}, ${esc(series.regionLabel)}</caption><thead><tr><th>Visit</th><th>Date</th><th>Value</th><th>95% range</th><th>Reviewed</th></tr></thead>
        <tbody>${pts.map((p) => `<tr><td>${esc(p.label)}</td><td>${esc(day(p.date))}</td><td>${p.value.toFixed(dec)} ${esc(o.unit || "")}</td><td>${p.ci ? `${p.ci[0].toFixed(dec)}–${p.ci[1].toFixed(dec)}` : "—"}</td><td>${p.verified ? "Verified" : "Not yet"}</td></tr>`).join("")}</tbody></table></div>
    </figure>`;
}

/** A tiny sparkline for cards (no axes). */
export function sparkline(values, { w = 120, h = 32, better = "lower" } = {}) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return "";
  const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
  const d = v.map((x, i) => `${(i / (v.length - 1)) * (w - 4) + 2},${h - 2 - ((x - lo) / r) * (h - 4)}`).join("L");
  const trend = (v[v.length - 1] - v[0]) * (better === "lower" ? -1 : 1);
  return `<svg class="sk-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="M${d}" class="${trend > 0 ? "is-up" : "is-flat"}"/></svg>`;
}
