// motif.js — Outer Layer's overlay motifs (films/channels/skincare/set), added to kits/cinema/sci/hud.js's shells:
// the avatar's three stacked layer bars, drawn in on the signature beside OUTER LAYER on the title card and above
// "Next layer: …" on the end card, and the depth gauge (the channel's spine: a µm ruler on the frame's left edge,
// projected from the section so its marks are true to the picture, and lifted to centre for the "to scale"
// segment). Pure functions of t, like the HUD. Colours are the theme's tokens (CSS variables), never literals.
//
//   const tb = titleBars(hud.title({...}), { t0: 0, sig });          tb.update(t)
//   const eb = endBars(hud.end({...}), { t0, d: 0.8 });              eb.update(t)
//   const g = createGauge({ root, W, H, safe });                    g.update(t, { top, bottom, um, ... })
import { seg, E } from "cinema/film/runtime.js";

const CSS = `
.hud-series { display: flex; align-items: center; gap: 1.6vmin; }
.ol-bars { flex: none; display: inline-flex; flex-direction: column; gap: .55vmin; width: 5.2vmin; }
.ol-bars i { display: block; height: var(--h); background: var(--text); border-radius: .3vmin; transform-origin: 0 50%; }
.ol-bars i:nth-child(1) { --h: .55vmin; } .ol-bars i:nth-child(2) { --h: .95vmin; } .ol-bars i:nth-child(3) { --h: 1.45vmin; }
.ol-band { position: absolute; left: 0; width: 100%; z-index: 2; pointer-events: none; opacity: 0;
  background: linear-gradient(180deg, rgba(238, 242, 241, 0) 0%, rgba(238, 242, 241, .86) 24%, rgba(238, 242, 241, .86) 76%, rgba(238, 242, 241, 0) 100%); }
.hud-end { text-align: center; }
.hud-end .ol-bars { margin: 0 auto 3.2vmin; width: 10vmin; gap: 1vmin; }
.hud-end .ol-bars i:nth-child(1) { --h: 1vmin; } .hud-end .ol-bars i:nth-child(2) { --h: 1.7vmin; } .hud-end .ol-bars i:nth-child(3) { --h: 2.6vmin; }
.ol-gauge { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; overflow: visible; }
.ol-gauge text { font-family: var(--font-mono); fill: var(--text); }
.ol-gauge .sub { fill: var(--text-2); }
`;
let injected = false;
export const injectCss = () => {
  if (injected || document.getElementById("ol-css")) return;
  const st = document.createElement("style");
  st.id = "ol-css"; st.textContent = CSS;
  document.head.appendChild(st);
  injected = true;
};

const bars = () => {
  const b = document.createElement("span");
  b.className = "ol-bars"; b.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) b.appendChild(document.createElement("i"));
  return b;
};
// the bars draw in left to right, one after another, the last landing on `sig`
const drawBars = (b, t, t0, sig) => {
  [...b.children].forEach((el, i) => {
    const a = t0 + (sig - t0) * (i / 3), z = t0 + (sig - t0) * ((i + 1) / 3);
    el.style.transform = `scaleX(${E.out3(seg(t, a, z)).toFixed(4)})`;
  });
};

export const titleBars = (el, { t0 = 0, sig } = {}) => {
  injectCss();
  const band = document.createElement("div");
  band.className = "ol-band";
  el.parentNode.insertBefore(band, el);
  const b = bars(), series = el.querySelector(".hud-series");
  if (series) series.insertBefore(b, series.firstChild); else el.insertBefore(b, el.firstChild);
  return {
    update(t) {
      // frame 0 is the poster and the loop point: the bars are already drawn there (the title holds from frame 0)
      if (t0 <= 0) [...b.children].forEach((x) => (x.style.transform = "scaleX(1)")); else drawBars(b, t, t0, sig);
      const pad = 0.035 * Math.min(window.W, window.H);
      band.style.top = (el.offsetTop - pad).toFixed(2) + "px";
      band.style.height = (el.offsetHeight + 2 * pad).toFixed(2) + "px";
      band.style.opacity = el.style.opacity || "0";
    },
  };
};

export const endBars = (el, { t0, d = 0.8 } = {}) => {
  injectCss();
  const b = bars();
  el.insertBefore(b, el.firstChild);
  return { update(t) { drawBars(b, t, t0, t0 + d); } };
};

// the depth gauge. Attached: a ruler down the frame's left, its 0 at the section's surface (top) and its marks
// spaced by the projected µm (bottom − top over `um`), so it stays true to the picture as the camera moves; a water
// band covers the dead layer (0 … sc µm) and the paper mark sits at 100 µm. Lifted ("to scale"): the same ruler at
// the centre-left, 100 µm = `liftPx`, with two bars beside it: the dead layer's thickness and a sheet of paper's.
const NS = "http://www.w3.org/2000/svg";
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
export const createGauge = ({ root, W, H, S1 = Math.min(W, H) / 1080, safe }) => {
  injectCss();
  const svg = mk("svg", { class: "ol-gauge", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
  root.appendChild(svg);
  const g = mk("g", {}, svg);
  const spine = mk("line", { stroke: "var(--text)", "stroke-width": 3 * S1, "stroke-linecap": "round" }, g);
  const band = mk("rect", { fill: "var(--water)", opacity: 0.9, rx: 2 * S1 }, g);
  const ticks = Array.from({ length: 13 }, (_, i) => mk("line", { stroke: "var(--text)", "stroke-width": (i % 5 === 0 ? 3 : 2) * S1 }, g));
  const lab = [0, 50, 100].map((v) => mk("text", { "font-size": 26 * S1, "dominant-baseline": "middle" }, g));
  lab.forEach((e, i) => (e.textContent = `${[0, 50, 100][i]}`));
  const unit = mk("text", { "font-size": 24 * S1, class: "sub" }, g); unit.textContent = "µm";
  const paperMark = mk("line", { stroke: "var(--text-2)", "stroke-width": 2 * S1, "stroke-dasharray": `${6 * S1} ${5 * S1}` }, g);
  const paperTxt = mk("text", { "font-size": 24 * S1, class: "sub", "dominant-baseline": "middle" }, g); paperTxt.textContent = "paper ≈ 100 µm";
  // the lifted bars
  const scBar = mk("rect", { fill: "var(--water)", rx: 3 * S1 }, g), paperBar = mk("rect", { fill: "var(--card)", stroke: "var(--text-2)", "stroke-width": 2 * S1, rx: 3 * S1 }, g);
  const scTxt = mk("text", { "font-size": 34 * S1, "dominant-baseline": "middle" }, g), paperTxt2 = mk("text", { "font-size": 34 * S1, "dominant-baseline": "middle" }, g);
  scTxt.textContent = "dead layer ≈ 17 µm"; paperTxt2.textContent = "paper ≈ 100 µm";
  const card = mk("rect", { fill: "var(--card)", opacity: 0.94, rx: 22 * S1 }, g);
  g.insertBefore(card, spine);
  const xL = (safe ? safe.l : 0.083) * W + 18 * S1;
  return {
    // top/bottom: the surface and the `um`-deep point on screen (px), or null when the section is off; op: 0 … 1;
    // lift: 0 (attached) … 1 (to scale); sc: µm of the dead layer; fillSc, fillPaper: 0 … 1 (the bars' fill)
    update(t, { top, bottom, um = 100, op = 1, lift = 0, sc = 17, fillSc = 0, fillPaper = 0, paperUm = 100 }) {
      svg.style.opacity = op.toFixed(4);
      if (op <= 0.001 || top == null) { svg.style.visibility = "hidden"; return; }
      svg.style.visibility = "visible";
      // attached geometry (px per µm from the projection) blended to the lifted geometry
      const pxA = (bottom - top) / um, liftPx = 0.30 * H / 100, yA = top, yL = 0.30 * H, xLift = 0.30 * W;
      const u = E.inout2(Math.min(1, Math.max(0, lift)));
      const px = pxA + (liftPx - pxA) * u, y0 = yA + (yL - yA) * u, x = xL + (xLift - xL) * u;
      const len = 120 * px;
      spine.setAttribute("x1", x); spine.setAttribute("x2", x); spine.setAttribute("y1", y0); spine.setAttribute("y2", y0 + len);
      band.setAttribute("x", x - 7 * S1); band.setAttribute("width", 7 * S1); band.setAttribute("y", y0); band.setAttribute("height", Math.max(0, sc * px));
      band.setAttribute("opacity", (0.9 * (1 - u)).toFixed(3));
      ticks.forEach((e, i) => { const y = y0 + i * 10 * px, w = (i % 5 === 0 ? 22 : 12) * S1; e.setAttribute("x1", x); e.setAttribute("x2", x + w); e.setAttribute("y1", y); e.setAttribute("y2", y); });
      lab.forEach((e, i) => { e.setAttribute("x", x + 30 * S1); e.setAttribute("y", y0 + i * 50 * px); e.setAttribute("opacity", Math.min(1, Math.max(0, (50 * px - 34 * S1) / (20 * S1))).toFixed(3)); });
      unit.setAttribute("x", x - 8 * S1); unit.setAttribute("y", y0 - 18 * S1);
      const yP = y0 + paperUm * px;
      paperMark.setAttribute("x1", x - 10 * S1); paperMark.setAttribute("x2", x + 120 * S1 * (1 - u)); paperMark.setAttribute("y1", yP); paperMark.setAttribute("y2", yP);
      paperTxt.setAttribute("x", x + 76 * S1); paperTxt.setAttribute("y", yP + 22 * S1); paperTxt.setAttribute("opacity", ((1 - u) * Math.min(1, Math.max(0, (yP - y0 - 120 * S1) / (40 * S1)))).toFixed(3));
      // lifted: two bars to the right of the ruler, filled from the top
      const bx = x + 70 * S1, bw = 90 * S1;
      scBar.setAttribute("x", bx); scBar.setAttribute("width", bw); scBar.setAttribute("y", y0); scBar.setAttribute("height", Math.max(0, sc * px * fillSc)); scBar.setAttribute("opacity", u.toFixed(3));
      paperBar.setAttribute("x", bx + bw + 40 * S1); paperBar.setAttribute("width", bw); paperBar.setAttribute("y", y0); paperBar.setAttribute("height", Math.max(0, paperUm * px * fillPaper)); paperBar.setAttribute("opacity", u.toFixed(3));
      scTxt.setAttribute("x", bx); scTxt.setAttribute("y", y0 - 34 * S1); scTxt.setAttribute("opacity", (u * fillSc).toFixed(3));
      paperTxt2.setAttribute("x", bx + bw + 40 * S1); paperTxt2.setAttribute("y", y0 + paperUm * px + 34 * S1); paperTxt2.setAttribute("opacity", (u * fillPaper).toFixed(3));
      card.setAttribute("x", x - 50 * S1); card.setAttribute("y", y0 - 80 * S1); card.setAttribute("width", (bx + 2 * bw + 90 * S1) - (x - 50 * S1)); card.setAttribute("height", 120 * px + 140 * S1);
      card.setAttribute("opacity", (0.94 * u).toFixed(3));
    },
  };
};
