/* Lumevina Skin Intelligence — the comparison viewer
 *
 * Two real images of the same region from two visits:
 *   slider      drag (or arrow keys) to reveal one over the other
 *   side        side by side; zoom and pan move both together, at the same
 *               scale, so the same spot stays under your eye in both
 *   difference  the worker's difference map: warm where colour differs
 *               more, hatched grey where the two photos don't line up
 *               locally (likely the capture, not the skin)
 * Every image is labelled for what it is: the original as taken, aligned to
 * the earlier visit, or a difference map. Nothing is generated or retouched.
 * Zoom: pinch, ctrl/⌘ + scroll, the + and − buttons, or double-tap.
 */

import { esc, day } from "./ui.js";

/**
 * @param {HTMLElement} el
 * @param {object} o { before: { src, label, date, kind }, after: { src, label, date, kind }, diff: { src } | null, alignedAfter: { src } | null, mode }
 */
export function createCompare(el, o) {
  const st = { mode: o.mode || "slider", split: 50, zoom: 1, x: 0, y: 0, aligned: !!o.alignedAfter?.src };
  const afterSrc = () => (st.aligned && o.alignedAfter?.src ? o.alignedAfter.src : o.after.src);
  const kindLabel = (k) => ({ original: "Original, as taken", aligned: "Aligned to the earlier visit", diff: "Difference map", view: "Original, resized for viewing" }[k] || "Original, resized for viewing");

  el.classList.add("sk-cmp");
  el.innerHTML = `
    <div class="sk-cmp-bar" role="toolbar" aria-label="Comparison view">
      <div class="sk-seg" role="radiogroup" aria-label="View">
        <button type="button" role="radio" data-mode="slider">Slider</button>
        <button type="button" role="radio" data-mode="side">Side by side</button>
        ${o.diff?.src ? `<button type="button" role="radio" data-mode="diff">Difference</button>` : ""}
      </div>
      <div class="sk-cmp-zoom">
        ${o.alignedAfter?.src ? `<label class="sk-switch"><input type="checkbox" data-aligned ${st.aligned ? "checked" : ""}><span>Aligned</span></label>` : ""}
        <button type="button" class="sk-icon-btn" data-z="-1" aria-label="Zoom out">−</button>
        <output class="sk-cmp-zv" aria-live="polite">1×</output>
        <button type="button" class="sk-icon-btn" data-z="1" aria-label="Zoom in">+</button>
        <button type="button" class="sk-icon-btn" data-z="0" aria-label="Reset zoom">⟲</button>
      </div>
    </div>
    <div class="sk-cmp-stage" tabindex="0" aria-label="Images. Use the slider, or + and − to zoom; arrow keys pan when zoomed.">
      <div class="sk-cmp-pane sk-cmp-a"><img alt="" draggable="false"></div>
      <div class="sk-cmp-pane sk-cmp-b"><img alt="" draggable="false"></div>
      <div class="sk-cmp-pane sk-cmp-d"><img alt="" draggable="false"></div>
      <input class="sk-cmp-range" type="range" min="0" max="100" value="50" aria-label="Reveal the later image">
      <div class="sk-cmp-handle" aria-hidden="true"><span></span></div>
    </div>
    <div class="sk-cmp-caps">
      <p class="sk-cmp-cap sk-cmp-cap-a"></p>
      <p class="sk-cmp-cap sk-cmp-cap-b"></p>
    </div>
    <p class="sk-cmp-legend" hidden>
      <span class="sk-dl"><i class="sk-dl-ramp"></i>Larger colour difference</span>
      <span class="sk-dl"><i class="sk-dl-hatch"></i>Low confidence: the photos don't line up here (likely the capture, not the skin)</span>
      <span class="sk-dl-note">Overall brightness is matched first: a brighter photo is not lighter skin.</span>
    </p>`;

  const stage = el.querySelector(".sk-cmp-stage");
  const [ia, ib, id] = ["a", "b", "d"].map((k) => el.querySelector(`.sk-cmp-${k} img`));
  const range = el.querySelector(".sk-cmp-range");
  const zv = el.querySelector(".sk-cmp-zv");

  function paint() {
    el.dataset.mode = st.mode;
    for (const b of el.querySelectorAll("[data-mode]")) b.setAttribute("aria-checked", String(b.dataset.mode === st.mode));
    ia.src = o.before.src; ia.alt = `${o.before.label || "Earlier visit"}, ${day(o.before.date)}`;
    const bs = afterSrc(); if (ib.getAttribute("src") !== bs) ib.src = bs;
    ib.alt = `${o.after.label || "Later visit"}, ${day(o.after.date)}${st.aligned ? ", aligned to the earlier visit" : ""}`;
    if (o.diff?.src) { id.src = o.diff.src; id.alt = `Difference map between ${day(o.before.date)} and ${day(o.after.date)}`; }
    stage.style.setProperty("--split", st.split + "%");
    stage.style.setProperty("--tf", `translate(${st.x}px, ${st.y}px) scale(${st.zoom})`);
    range.value = String(st.split);
    zv.textContent = `${st.zoom % 1 ? st.zoom.toFixed(1) : st.zoom}×`;
    el.querySelector(".sk-cmp-cap-a").innerHTML = `<b>${esc(o.before.label || "Earlier")}</b> · ${esc(day(o.before.date))}<br><small>${esc(kindLabel(o.before.kind))}</small>`;
    el.querySelector(".sk-cmp-cap-b").innerHTML = st.mode === "diff"
      ? `<b>Difference map</b> · ${esc(day(o.before.date))} → ${esc(day(o.after.date))}<br><small>Made by the analysis from the two originals</small>`
      : `<b>${esc(o.after.label || "Later")}</b> · ${esc(day(o.after.date))}<br><small>${esc(kindLabel(st.aligned ? "aligned" : o.after.kind))}</small>`;
    el.querySelector(".sk-cmp-legend").hidden = st.mode !== "diff";
  }

  const clampPan = () => {
    const r = stage.getBoundingClientRect(), mx = (r.width * (st.zoom - 1)) / 2, my = (r.height * (st.zoom - 1)) / 2;
    st.x = Math.max(-mx, Math.min(mx, st.x)); st.y = Math.max(-my, Math.min(my, st.y));
  };
  const zoomBy = (f, cx = 0, cy = 0) => {
    const z = Math.max(1, Math.min(8, st.zoom * f));
    st.x = cx - ((cx - st.x) * z) / st.zoom; st.y = cy - ((cy - st.y) * z) / st.zoom; st.zoom = z;
    if (z === 1) { st.x = 0; st.y = 0; }
    clampPan(); paint();
  };
  const centerOf = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };

  el.querySelector(".sk-cmp-bar").addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]"); if (m) { st.mode = m.dataset.mode; paint(); return; }
    const z = e.target.closest("[data-z]"); if (z) { const v = Number(z.dataset.z); if (v === 0) { st.zoom = 1; st.x = 0; st.y = 0; paint(); } else zoomBy(v > 0 ? 1.5 : 1 / 1.5); }
  });
  el.querySelector("[data-aligned]")?.addEventListener("change", (e) => { st.aligned = e.target.checked; paint(); });
  range.addEventListener("input", () => { st.split = Number(range.value); paint(); });

  // pointer: drag to pan when zoomed (or to move the split when not), pinch to zoom
  const pts = new Map();
  let last = null, pinch0 = null;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target === range) return;
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    last = [e.clientX, e.clientY];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: st.zoom }; }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomBy((pinch0.z * d) / pinch0.d / st.zoom, ...centerOf({ clientX: (a[0] + b[0]) / 2, clientY: (a[1] + b[1]) / 2 }));
      return;
    }
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
    if (st.zoom > 1) { st.x += dx; st.y += dy; clampPan(); paint(); }
    else if (st.mode === "slider") { const r = stage.getBoundingClientRect(); st.split = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); paint(); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", (e) => { if (!e.ctrlKey && !e.metaKey && st.zoom === 1) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, ...centerOf(e)); }, { passive: false });
  stage.addEventListener("dblclick", (e) => (st.zoom > 1 ? (st.zoom = 1, st.x = 0, st.y = 0, paint()) : zoomBy(2.5, ...centerOf(e))));
  stage.addEventListener("keydown", (e) => {
    const step = 40;
    if (e.key === "+" || e.key === "=") zoomBy(1.5);
    else if (e.key === "-") zoomBy(1 / 1.5);
    else if (st.zoom > 1 && e.key.startsWith("Arrow")) { e.preventDefault(); st.x += e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0; st.y += e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0; clampPan(); paint(); }
  });
  paint();
  return { set(next) { Object.assign(o, next); paint(); }, state: st };
}

/**
 * A dated sequence of real images of one region, one per visit. Crossfades
 * between frames are labelled as transitions, never shown as skin states:
 * the caption always names the real visit on screen.
 */
export function createSequence(el, frames) {
  let i = 0, timer = null;
  el.classList.add("sk-seq");
  el.innerHTML = `
    <div class="sk-seq-stage">${frames.map((f, k) => `<img src="${esc(f.src)}" alt="${esc(`${f.label}, ${day(f.date)}`)}" data-k="${k}" class="${k === 0 ? "on" : ""}">`).join("")}
      <p class="sk-seq-cap" aria-live="polite"></p></div>
    <div class="sk-seq-bar">
      <button type="button" class="sk-btn sk-btn-ghost" data-play>Play</button>
      <input type="range" min="0" max="${frames.length - 1}" value="0" aria-label="Visit">
    </div>
    <p class="sk-fine">Each frame is a real photo from that visit. The fade between frames is only a transition; it is not a picture of your skin.</p>`;
  const imgs = [...el.querySelectorAll("img")], cap = el.querySelector(".sk-seq-cap"), range = el.querySelector("input"), play = el.querySelector("[data-play]");
  const show = (k) => { i = k; imgs.forEach((im, n) => im.classList.toggle("on", n === k)); range.value = String(k); cap.textContent = `${frames[k].label} · ${day(frames[k].date)} · visit ${k + 1} of ${frames.length}`; };
  range.addEventListener("input", () => show(Number(range.value)));
  play.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = "Play"; return; }
    play.textContent = "Pause";
    timer = setInterval(() => show((i + 1) % frames.length), matchMedia("(prefers-reduced-motion: reduce)").matches ? 2500 : 1400);
  });
  show(0);
  return { stop() { clearInterval(timer); } };
}
