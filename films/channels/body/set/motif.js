// motif.js — Meanwhile, Inside's 2D motifs (films/channels/body/set): the pulse line, the membrane iris
// and the "you are here" locator. DOM/SVG only, every one a pure function of t. No circles anywhere (the
// space channel owns the ring): the iris is a membrane blob, the locator marks its region with a pulse-line
// blip, and the head of the silhouette is an egg-shaped path.
//
//   import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
//   const pl = pulseLine({ width: 810, height: 64 });  titleEl.appendChild(pl.el);
//   window.seek = (t) => { ...; pl.update(beatAmp(t, [0, 0.4], { flat: endT })); ... };
//
// beatAmp(t, lubs, o) → 0..1: how hard the line kicks at t. lubs: the times of each "lub" (each beat). The
//   kick rises in 40 ms and decays over o.decay (0.45 s); o.rest (0.42) is the resting amplitude; after
//   o.flat (a time) the line eases to 0 over 0.5 s (the end card flat-lines).
// pulseLine({ width, height, at = 0.62, stroke = "var(--signal)", widthPx = 4.2 }) → { el, update(amp) }
//   A flat chartreuse trace with one lub-dub complex (a sharp spike and a smaller second bump, like an ECG)
//   at `at` of its width. The complex scales with amp; the line itself never moves, so it is crisp in any
//   still (the title card is the poster).
// iris(stage, { events: [{ t, close = 0.26, open = 0.34, cx = 0.5, cy = 0.38 }], fill = "var(--bg)",
//   stroke = "var(--signal)" }) → { el, update(t), covered(t) } — a full-frame SVG between the 3D canvas and
//   the HUD: the frame closes down to a soft membrane-shaped hole and opens again on the other side of a
//   cut. Fully closed exactly at each event's t (put the cut there). Its edge is the pulse line's colour.
// locator(root, { x, y, h, region: [u, v] (0..1 inside the figure's box), label = "you are here", plate,
//   loop }) → { el, update(t, presence, amp, loop = 0) } — a front-view body silhouette (text-2 outline, faint
//   fill), the region marked by a small pulse-line squiggle that kicks on the beat. plate: true sets it on the
//   caption plate with the text colour (for bright grounds). loop: true adds the blood's round trip, drawn on
//   in pulse as update's loop runs 0 → 1: heart → lungs → heart → down the body → heart.

const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));
export const beatAmp = (t, lubs, o = {}) => {
  const decay = o.decay ?? 0.45, rest = o.rest ?? 0.42;
  let k = 0;
  for (const b of lubs) {
    if (t < b - 0.04) continue;
    const x = t - b, up = Math.min(1, (x + 0.04) / 0.04), down = x > 0 ? Math.exp(-x / (decay / 3)) : 1;
    k = Math.max(k, up * down);
  }
  let a = rest + (1 - rest) * k;
  if (o.flat != null && t > o.flat) a *= Math.max(0, 1 - (t - o.flat) / 0.5);
  return a;
};

// one lub-dub complex as a function of x in "seconds" around the lub (stylised ECG)
const ecg = (x) => 1.0 * gauss(x, 0.011) - 0.32 * gauss(x - 0.032, 0.012) - 0.14 * gauss(x + 0.026, 0.01)
  + 0.46 * gauss(x - 0.2, 0.022) - 0.1 * gauss(x - 0.245, 0.016);

export const pulseLine = (o = {}) => {
  const W = o.width ?? 810, H = o.height ?? 64, at = o.at ?? 0.62, NS = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("class", "mi-pulse"); el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("width", W); el.setAttribute("height", H);
  el.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("fill", "none"); path.setAttribute("stroke", o.stroke || "var(--signal)");
  path.setAttribute("stroke-width", o.widthPx ?? 4.2); path.setAttribute("stroke-linejoin", "round"); path.setAttribute("stroke-linecap", "round");
  el.appendChild(path);
  const span = 0.5, x0 = W * at - W * 0.18, x1 = W * at + W * 0.34, base = H * 0.66, A = H * 0.58;
  let last = null;
  const update = (amp) => {
    const a = Math.round(amp * 1000) / 1000;
    if (a === last) return;
    last = a;
    const pts = [`M 0 ${base.toFixed(2)}`, `L ${x0.toFixed(2)} ${base.toFixed(2)}`];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, tx = ((x - W * at) / (x1 - x0)) * span * 1.6;
      pts.push(`L ${x.toFixed(2)} ${(base - A * a * ecg(tx)).toFixed(2)}`);
    }
    pts.push(`L ${W} ${base.toFixed(2)}`);
    path.setAttribute("d", pts.join(" "));
  };
  update(o.amp ?? 0.42);
  return { el, update };
};

// a membrane blob: a wobbly, slightly tall closed curve (never a circle)
const blob = (cx, cy, r, ph) => {
  const n = 96, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + 0.085 * Math.sin(3 * a + ph) + 0.05 * Math.sin(5 * a - 1.7 * ph + 0.9) + 0.035 * Math.sin(2 * a + 2.3);
    pts.push([cx + Math.cos(a) * r * w, cy + Math.sin(a) * r * w * 1.16]);
  }
  // a smooth closed path through the points (Catmull-Rom → cubic Béziers)
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
};
const inC = (x) => x * x * x, outC = (x) => 1 - Math.pow(1 - x, 3), cl = (x) => Math.min(1, Math.max(0, x));

export const iris = (stage, o = {}) => {
  const W = window.W, H = window.H, NS = "http://www.w3.org/2000/svg", ev = o.events || [];
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("class", "mi-iris"); el.setAttribute("viewBox", `0 0 ${W} ${H}`); el.setAttribute("aria-hidden", "true");
  const hole = document.createElementNS(NS, "path"), edge = document.createElementNS(NS, "path");
  hole.setAttribute("fill", o.fill || "var(--bg)"); hole.setAttribute("fill-rule", "evenodd");
  edge.setAttribute("fill", "none"); edge.setAttribute("stroke", o.stroke || "var(--signal)"); edge.setAttribute("stroke-width", (Math.min(W, H) * 0.0055).toFixed(2));
  el.append(hole, edge);
  const canvas = stage.querySelector("#gl");
  stage.insertBefore(el, canvas ? canvas.nextSibling : stage.firstChild);
  const full = Math.hypot(W, H) * 0.62;
  const state = (t) => {
    for (const e of ev) {
      const c = e.close ?? 0.26, op = e.open ?? 0.34;
      if (t >= e.t - c && t < e.t) return { e, r: full * (1 - inC(cl((t - (e.t - c)) / c))) };
      if (t >= e.t && t < e.t + op) return { e, r: full * outC(cl((t - e.t) / op)) };
    }
    return null;
  };
  const update = (t) => {
    const s = state(t);
    if (!s) { el.style.visibility = "hidden"; return; }
    el.style.visibility = "visible";
    const cx = (s.e.cx ?? 0.5) * W, cy = (s.e.cy ?? 0.38) * H, ph = 0.9 * t + (s.e.ph ?? 0);
    const b = s.r > 0.5 ? blob(cx, cy, s.r, ph) : "";
    hole.setAttribute("d", `M -10 -10 H ${W + 10} V ${H + 10} H -10 Z ` + b);
    edge.setAttribute("d", b);
    edge.style.opacity = s.r > 0.5 ? "1" : "0";
  };
  return { el, update, covered: (t) => { const s = state(t); return !!s && s.r < 1; } };
};

// a front-view figure in a 100 × 230 box: head (an egg), neck, torso, arms, legs, as one outline path
const FIGURE = "M50 6 C59 6 64 13 64 22 C64 32 58 40 50 40 C42 40 36 32 36 22 C36 13 41 6 50 6 Z " +
  "M44 42 L56 42 L57 48 C66 49 74 52 77 58 L84 98 L90 128 C91 133 88 135 85 131 L76 102 L70 74 L68 112 L69 150 L67 220 C67 226 58 226 58 220 L54 158 L50 130 L46 158 L42 220 C42 226 33 226 33 220 L31 150 L32 112 L30 74 L24 102 L15 131 C12 135 9 133 10 128 L16 98 L23 58 C26 52 34 49 43 48 Z";

export const locator = (root, o = {}) => {
  const NS = "http://www.w3.org/2000/svg", h = o.h ?? 260, w = (h * 100) / 230;
  const el = document.createElement("div");
  el.className = "mi-locator" + (o.plate ? " mi-locator-plate" : ""); el.id = "mi-locator";
  el.style.left = (o.x ?? 0).toFixed(2) + "px"; el.style.top = (o.y ?? 0).toFixed(2) + "px";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 230"); svg.setAttribute("width", w.toFixed(2)); svg.setAttribute("height", h.toFixed(2)); svg.setAttribute("aria-hidden", "true");
  const fig = document.createElementNS(NS, "path");
  fig.setAttribute("d", FIGURE); fig.setAttribute("fill", "var(--text-2)"); fig.setAttribute("fill-opacity", "0.16");
  if (o.plate) { fig.setAttribute("fill", "var(--text)"); fig.setAttribute("fill-opacity", "0.22"); }
  fig.setAttribute("stroke", o.plate ? "var(--text)" : "var(--text-2)"); fig.setAttribute("stroke-width", "1.6"); fig.setAttribute("stroke-linejoin", "round"); fig.setAttribute("fill-rule", "nonzero");
  const mark = document.createElementNS(NS, "path");
  mark.setAttribute("fill", "none"); mark.setAttribute("stroke", "var(--signal)"); mark.setAttribute("stroke-width", "2.6"); mark.setAttribute("stroke-linecap", "round"); mark.setAttribute("stroke-linejoin", "round");
  svg.append(fig, mark);
  // the round trip: from the heart up through both lungs and back, then down the trunk and a leg and back up
  const loop = o.loop ? document.createElementNS(NS, "path") : null;
  if (loop) {
    loop.setAttribute("d", "M54 74 C49 64 40 60 38 70 C36 80 47 82 54 74 C58 64 67 60 66 70 C65 79 58 80 54 74 " +
      "C60 96 61 128 60 160 C60 186 62 206 62 214 C62 220 56 220 56 212 C55 196 52 172 50 150 C48 120 49 96 54 74 Z");
    loop.setAttribute("pathLength", "1"); loop.setAttribute("fill", "none"); loop.setAttribute("stroke", "var(--pulse)");
    loop.setAttribute("stroke-width", "3"); loop.setAttribute("stroke-linecap", "round"); loop.setAttribute("stroke-linejoin", "round");
    loop.setAttribute("stroke-dasharray", "1 1"); loop.setAttribute("stroke-dashoffset", "1");
    svg.insertBefore(loop, mark);
  }
  const cap = document.createElement("span");
  cap.className = "mi-locator-tx"; cap.textContent = o.label ?? "you are here";
  el.append(svg, cap);
  root.appendChild(el);
  const [u, v] = o.region || [0.86, 0.5], mx = u * 100, my = v * 230;
  let last = null;
  const update = (t, pr, amp, lp = 0) => {
    el.style.opacity = pr.toFixed(4); el.style.visibility = pr > 0.001 ? "visible" : "hidden";
    if (loop) { loop.setAttribute("stroke-dashoffset", (1 - Math.min(1, Math.max(0, lp))).toFixed(4)); loop.style.visibility = lp > 0.001 ? "visible" : "hidden"; }
    const a = Math.round(amp * 1000) / 1000;
    if (a === last) return;
    last = a;
    // a 30-unit squiggle centred on the region: flat, spike, dip, small bump, flat
    const pts = [];
    for (let i = 0; i <= 40; i++) { const x = -15 + (30 * i) / 40, tx = (x / 30) * 0.5; pts.push(`${(mx + x).toFixed(2)} ${(my - 13 * a * ecg(tx)).toFixed(2)}`); }
    mark.setAttribute("d", "M " + pts.join(" L "));
  };
  return { el, update, box: () => ({ l: o.x, t: o.y, r: o.x + w, b: o.y + h }) };
};

export const MOTIF_CSS = `
.mi-iris { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; visibility: hidden; }
.mi-pulse { display: block; width: 100%; height: auto; margin-top: 1.4vmin; overflow: visible; }
.mi-locator { position: absolute; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: .8vmin; opacity: 0; visibility: hidden; }
.mi-locator svg { display: block; overflow: visible; }
.mi-locator-tx { font: 600 2.6vmin/1.1 var(--font-text); color: var(--text-2); white-space: nowrap; }
.mi-locator-plate { background: var(--hud-plate); padding: 1.2vmin 1.6vmin 1vmin; border-radius: var(--hud-cap-radius, 3vmin); }
.mi-locator-plate .mi-locator-tx { font-size: 2.963vmin; color: var(--text); }
`;
