// hud.js — the overlay for the science films (kits/cinema/sci). Brand-neutral: every colour, face and
// size is a CSS custom property, set per channel by its theme.json through page.mjs (README.md lists the
// roles). Generalized from films/skin-school-tiktok/motion/scene.mjs ("tiktok:" lines), not copied from
// Lumevina's runtime. Imports only ../film/runtime.js; projection is done here, so no three.js import.
//
//   const hud = createHud({ camera });          // after the scene made its camera
//   hud.captions(FILM.captions);                // word-lit captions from film.json
//   hud.label("planet", { text: "planet", glyph: "●", color: "ice", at: (t) => planetAt(t), t0: 1.2 });
//   hud.badge("warp", { from: clk });           // clock.js badges ("slowed ×20"), one element
//   hud.badge("nts", { text: "not to scale", t0: 2 });
//   hud.counter("tau", { value: (t) => clk.tau(t), fmt: (v) => v.toFixed(2), unit: "s", t0: 1 });
//   hud.scale("au", { text: "1 AU", bar: (t) => px, t0: 3 });
//   hud.title({ series: "Light Minute · No. 01", title: "If the Sun *vanished*", t1: 2.4 });
//   hud.end({ t0: FILM.endCard, title: "...", next: "Next light: ...", follow: "Follow ..." });
//   window.seek = (t) => { stage(t); placeCamera(...); ...; hud.update(t); renderer.render(scene, camera); };
//
// Every part is a pure function of t: hud.update(t) rewrites the whole overlay from t, the film data and
// the camera at t. The one cache (the caption page's DOM) is rebuilt from scratch whenever the page
// changes, so a seek gives the same pixels whatever was sought before. A part whose t0 is 0 or earlier
// is fully there on frame 0 (the poster and loop point); a later t0 fades it in from that moment.
//
// Geometry: positions are px in the frame (W × H). Sizes scale with the short side, so a 540 × 960
// draft is a 1080 × 1920 final at half size. The safe box (theme.safe, as fractions of the frame,
// default the apps' organic safe area x 90–900, y 250–1420 of 1080 × 1920) holds every label, badge,
// title and card. Labels also stay above the caption plate's top (opts.captionY).
//
// createHud(opts): { camera, W, H, root, safe: { l, r, t, b } fractions, captionY: 0.61, capMaxW: 0.72,
//   gap: 14 (px at 1080 short side), shots: FILM.shots }
// hud.captions(pages, o)   pages [{ t0, t1, lines: [[[word, t], ...], ...] }] (kits/cinema/script);
//                          o: { y: top as a fraction of H, maxW: fraction of W (capped at the safe
//                          width), x: centre fraction (default the safe box's centre), fade: 0.12 }
// hud.label(id, o)         o: { text, glyph, mark: "dot" | "ring" | "dashed" | "bar" | "none", color
//                          (a theme token name, "--var", or any CSS colour), at: (t) => [x, y, z] or a
//                          Vector3 in world space, or screen: (t) => [px, py]; side: 1 right / -1 left
//                          (preferred), v: "above" | "middle", t0, t1, shot (only in that shot), fixed
//                          (true: only the preferred spot, clamped; no jumping for fast anchors) }
// hud.badge(id, o)         o: { text: string or (t) => string | null, t0, t1, from: a clock.js clock
//                          (its badges, faded at each segment), slot: "tr" | "tl" | "br" | "bl" }
// hud.counter(id, o)       o: { keys: [[t, v], ...] or value: (t) => v, fmt, unit, label, t0, t1,
//                          at: [x, y] centre as fractions, lit: (v) => bool, ease, minCh }
// hud.scale(id, o)         o: { text: string or (t) => string, bar: (t) => px or null, t0, t1,
//                          at: [x, y] top-left as fractions (default: bottom-left, above the captions) }
// hud.title(o)             o: { series, title ("*word*" is the accent), sub, t0 = 0, t1, y, sig (when the
//                          sonic signature lands, for the cue sheet; default t0) }
// hud.end(o)               o: { t0, title, next, follow, d: 0.6 }; holds to the end
// hud.update(t)            draw the overlay for t (call after the camera is placed for t)
// hud.cues()               the overlay's events for the sound: label, counter.show, scale, badge, signature
//                          (badge and scale still need rows in kits/cinema/events.json)
// project(camera, p, W, H) world point → { x, y, front, on } in frame px (no three.js needed)
import { seg, E, presence, apply, shotAt, keyed, ease } from "../film/runtime.js";

const CSS = `
:root {
  --hud-text: var(--text, #f2f2f0); --hud-text-2: var(--text-2, #a4a9b1); --hud-accent: var(--accent, var(--hud-text));
  --hud-plate: rgba(10, 11, 13, .72); --hud-cap-next: var(--hud-text-2); --hud-cap-said: var(--hud-text);
  --hud-cap-lit: var(--hud-accent); --hud-cap-lit-bg: transparent;
  --hud-label-bg: rgba(10, 11, 13, .86); --hud-label-text: var(--hud-text); --hud-ring: var(--hud-text);
  --hud-badge-bg: rgba(10, 11, 13, .6); --hud-badge-text: var(--hud-text-2); --hud-badge-border: var(--hud-text-2);
  --hud-scrim: rgba(0, 0, 0, .62); --hud-scale-line: var(--hud-text);
  --hud-shadow: 0 .6vmin 2.2vmin rgba(0, 0, 0, .45); --hud-text-shadow: 0 .3vmin 1.4vmin rgba(0, 0, 0, .6);
}
#hud { position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; font-family: var(--font-text); color: var(--hud-text); }
#hud .hud-leads { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; overflow: visible; }
.hud-label { position: absolute; left: 0; top: 0; z-index: 2; display: flex; align-items: center; gap: 1.1vmin; white-space: nowrap;
  padding: 1.2vmin 2.3vmin; border-radius: var(--hud-label-radius, 999px); font-size: var(--hud-label-size, 3.7vmin); font-weight: var(--hud-label-weight, 650);
  line-height: 1.1; color: var(--hud-label-text); background: var(--hud-label-bg); border: .42vmin solid var(--c, var(--hud-text)); box-shadow: var(--hud-shadow); }
.hud-label .mk { flex: none; width: 1.9vmin; height: 1.9vmin; border-radius: 50%; background: var(--c, var(--hud-text)); box-sizing: border-box; }
.hud-label.mk-ring .mk { background: transparent; border: .45vmin solid var(--c); }
.hud-label.mk-dashed .mk { background: transparent; border: .45vmin dashed var(--c); }
.hud-label.mk-bar { border-left-width: 1.3vmin; } .hud-label.mk-bar .mk, .hud-label.mk-none .mk { display: none; }
.hud-label .g { color: var(--c); font-family: var(--font-glyph, var(--font-text)); }
.hud-cap { position: absolute; left: 0; top: 0; z-index: 7; width: max-content; text-align: center; font-size: var(--hud-cap-size, 5.9vmin);
  font-weight: var(--hud-cap-weight, 700); line-height: 1.24; letter-spacing: var(--hud-cap-tracking, -.005em); padding: 1.5vmin 2.6vmin;
  border-radius: var(--hud-cap-radius, 3vmin); background: var(--hud-plate); opacity: 0; }
.hud-cap .r { display: block; white-space: nowrap; }
.hud-cap i { font-style: normal; color: var(--hud-cap-next); padding: 0 .1em; border-radius: .16em; }
.hud-cap i.said { color: var(--hud-cap-said); }
.hud-cap i.on { color: var(--hud-cap-lit); background: var(--hud-cap-lit-bg); }
.hud-badge { position: absolute; left: 0; top: 0; z-index: 3; white-space: nowrap; padding: .9vmin 1.8vmin; border-radius: var(--hud-badge-radius, 1.2vmin);
  font: var(--hud-badge-weight, 600) var(--hud-badge-size, 2.9vmin)/1.15 var(--font-mono); letter-spacing: .02em; color: var(--hud-badge-text);
  background: var(--hud-badge-bg); border: .3vmin solid var(--hud-badge-border); }
.hud-counter { position: absolute; left: 0; top: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; white-space: nowrap; }
.hud-counter .row { display: flex; align-items: baseline; gap: 1.2vmin; }
.hud-counter .v { font: 700 var(--hud-counter-size, 10vmin)/1 var(--font-mono); font-variant-numeric: tabular-nums lining-nums; letter-spacing: -.02em;
  color: var(--hud-text); text-shadow: var(--hud-text-shadow); text-align: right; }
.hud-counter.lit .v { color: var(--hud-accent); }
.hud-counter .u { font: 650 4.2vmin/1 var(--font-text); color: var(--hud-text); text-shadow: var(--hud-text-shadow); }
.hud-counter .lb { font: 600 2.9vmin/1.2 var(--font-text); color: var(--hud-text-2); margin-bottom: .6vmin; text-shadow: var(--hud-text-shadow); }
.hud-scale { position: absolute; left: 0; top: 0; z-index: 3; display: flex; align-items: center; gap: 1.4vmin; white-space: nowrap; padding: 1vmin 2.1vmin;
  border-radius: 999px; background: var(--hud-label-bg); font: 600 3vmin/1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--hud-text); }
.hud-scale .bar { display: block; flex: none; height: 1.5vmin; border: .38vmin solid var(--hud-scale-line); border-top: 0; box-sizing: border-box; }
.hud-title { position: absolute; left: 0; top: 0; z-index: 3; }
.hud-series { font: 600 var(--hud-series-size, 3vmin)/1.2 var(--font-text); letter-spacing: .04em; color: var(--hud-accent); }
.hud-h { font: var(--hud-title-weight, 700) var(--hud-title-size, 7.4vmin)/1.04 var(--font-display); margin: 1vmin 0 0; color: var(--hud-text);
  letter-spacing: var(--hud-title-tracking, -.02em); text-wrap: balance; text-shadow: var(--hud-text-shadow); }
.hud-h em, .hud-end .t em { font-style: normal; color: var(--hud-accent); }
.hud-sub { margin-top: 1.6vmin; font: 500 3.6vmin/1.25 var(--font-text); color: var(--hud-text-2); }
.hud-scrim { position: absolute; inset: 0; z-index: 5; background: var(--hud-scrim); opacity: 0; }
.hud-end { position: absolute; left: 0; top: 0; z-index: 6; opacity: 0; }
.hud-end .t { font: 700 var(--hud-end-size, 8vmin)/1.04 var(--font-display); letter-spacing: var(--hud-title-tracking, -.02em); text-wrap: balance; }
.hud-end .nx { margin-top: 4vmin; font: 600 4.6vmin/1.2 var(--font-text); color: var(--hud-text); }
.hud-end .fo { display: inline-block; margin-top: 3.4vmin; padding: 1.3vmin 2.6vmin; border-radius: 999px; border: .35vmin solid var(--hud-text-2);
  font: 600 3.4vmin/1 var(--font-text); color: var(--hud-text-2); }
.hud-label, .hud-badge, .hud-counter, .hud-scale, .hud-title, .hud-end { opacity: 0; visibility: hidden; }
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// "*word*" → the accent span; everything else is text
const accent = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const f2 = (x) => (Math.round(x * 100) / 100).toString();
// Anything that starts at t0 <= 0 is already there on frame 0 (frame 0 is the poster and the loop point:
// an honesty badge or a label must not be missing from it); a later one arrives over its fade.
const from0 = (t0) => ((t0 ?? 0) > 0 ? t0 : null);

export const project = (camera, p, W, H) => {
  const x = p.x ?? p[0], y = p.y ?? p[1], z = p.z ?? p[2];
  const v = camera.matrixWorldInverse.elements, P = camera.projectionMatrix.elements;
  const vx = v[0] * x + v[4] * y + v[8] * z + v[12], vy = v[1] * x + v[5] * y + v[9] * z + v[13], vz = v[2] * x + v[6] * y + v[10] * z + v[14];
  const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15];
  if (!(cw > 1e-6)) return { x: NaN, y: NaN, front: false, on: false };
  const sx = ((cx / cw + 1) / 2) * W, sy = ((1 - cy / cw) / 2) * H;
  return { x: sx, y: sy, front: true, on: sx >= 0 && sx <= W && sy >= 0 && sy <= H };
};

export const createHud = (opts = {}) => {
  const W = opts.W ?? window.W, H = opts.H ?? window.H, S1 = Math.min(W, H) / 1080;   // px per 1080-px unit
  const camera = opts.camera || null;
  const theme = window.THEME || {};
  const sf = opts.safe || theme.safe || { l: 90 / 1080, r: 900 / 1080, t: 250 / 1920, b: 1420 / 1920 };
  const SAFE = { l: sf.l * W, r: sf.r * W, t: sf.t * H, b: sf.b * H };
  const capY = (opts.captionY ?? theme.captionY ?? 0.61) * H, GAP = (opts.gap ?? 14) * S1;
  const shots = opts.shots || (window.FILM && window.FILM.shots) || [];
  const tokens = theme.tokens || {};
  const colour = (c) => (c == null ? "var(--hud-text)" : c.startsWith("--") ? `var(${c})` : c in tokens ? `var(--${c})` : c);

  if (!document.getElementById("hud-css")) {
    const st = document.createElement("style");
    st.id = "hud-css"; st.textContent = CSS;
    document.head.insertBefore(st, document.head.querySelector("style"));   // first, so the theme's own CSS wins
  }
  let root = opts.root || document.getElementById("hud");
  if (!root) { root = document.createElement("div"); root.id = "hud"; (document.querySelector(".stage") || document.body).appendChild(root); }
  const mk = (tag, cls, parent = root) => { const el = document.createElement(tag); if (cls) el.className = cls; parent.appendChild(el); return el; };
  const leads = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  leads.setAttribute("class", "hud-leads"); leads.setAttribute("viewBox", `0 0 ${W} ${H}`); leads.setAttribute("aria-hidden", "true");
  root.appendChild(leads);

  const L = [], B = [], C = [], SC = [];
  let CAP = null, TITLE = null, END = null;
  const place = (el, x, y) => { el.style.left = x.toFixed(2) + "px"; el.style.top = y.toFixed(2) + "px"; };
  const box = (x, y, w, h) => ({ l: x, t: y, r: x + w, b: y + h });

  // ── captions ──────────────────────────────────────────────────────────────
  const captions = (pages, o = {}) => {
    const el = mk("div", "hud-cap");
    el.id = "hud-cap";
    const maxW = Math.min((o.maxW ?? opts.capMaxW ?? 0.72) * W, SAFE.r - SAFE.l);
    CAP = { el, pages: pages || [], y: o.y != null ? o.y * H : capY, cx: o.x != null ? o.x * W : (SAFE.l + SAFE.r) / 2,
      maxW, maxH: (o.maxH != null ? o.maxH * H : SAFE.b - (o.y != null ? o.y * H : capY)), fade: o.fade ?? 0.12, shown: -1, w: 0, h: 0 };
    return el;
  };
  const drawCaptions = (t) => {
    if (!CAP) return null;
    const c = CAP, P = c.pages;
    let k = -1;
    for (let j = 0; j < P.length; j++) if (t >= P[j].t0 && t < P[j].t1) k = j;
    if (k !== c.shown) {                       // a new page: rebuild it from nothing, then fit it to the box
      c.el.innerHTML = k < 0 ? "" : P[k].lines.map((r) => '<span class="r">' + r.map(([w]) => "<i>" + esc(w) + "</i>").join(" ") + "</span>").join("");
      c.el.style.fontSize = "";
      for (let pass = 0; pass < 3 && k >= 0; pass++) {
        const w = c.el.offsetWidth, h = c.el.offsetHeight, s = Math.min(1, (c.maxW - 2) / w, (c.maxH - 2) / h);
        if (s >= 1) break;
        c.el.style.fontSize = (parseFloat(getComputedStyle(c.el).fontSize) * s).toFixed(2) + "px";
      }
      c.w = c.el.offsetWidth; c.h = c.el.offsetHeight; c.shown = k;
    }
    if (k < 0) { c.el.style.opacity = "0"; return null; }
    const pg = P[k], words = pg.lines.flat(), is = c.el.querySelectorAll("i");
    let on = -1;
    words.forEach(([, wt], j) => { if (t >= wt) on = j; });
    is.forEach((e, j) => { const cl = j === on ? "on" : j < on ? "said" : ""; if (e.className !== cl) e.className = cl; });
    const op = Math.max(0, Math.min(1, (t - pg.t0) / c.fade, (pg.t1 - t) / c.fade));
    c.el.style.opacity = op.toFixed(4);
    place(c.el, c.cx - c.w / 2, c.y);
    return op > 0.01 ? box(c.cx - c.w / 2, c.y, c.w, c.h) : null;
  };

  // ── labels on anchors ─────────────────────────────────────────────────────
  const label = (id, o) => {
    const el = mk("div", "hud-label mk-" + (o.mark || "dot"));
    el.id = "hud-" + id;
    el.innerHTML = '<i class="mk"></i>' + (o.glyph ? '<span class="g">' + esc(o.glyph) + "</span>" : "") + '<span class="tx">' + esc(o.text) + "</span>";
    el.style.setProperty("--c", colour(o.color));
    L.push({ id, el, o, c: colour(o.color) });
    return el;
  };
  const anchorAt = (o, t) => {
    if (o.screen) { const [x, y] = o.screen(t); return { x, y, front: true, on: x >= 0 && x <= W && y >= 0 && y <= H }; }
    if (!camera) throw new Error("hud.label: a world anchor (at) needs createHud({ camera })");
    return project(camera, o.at(t), W, H);
  };
  // Placement, generalized from the TikTok scene: try the preferred side, the other side, above, below,
  // then the four corners, each clamped into the safe box (and above the captions). Take the first spot
  // that covers no anchor (its own or another label's), no placed label and no other overlay part; if
  // none is clear, the one with the least overlap. Visible labels are placed in the order they were
  // made, so the result is the same on every seek.
  const drawLabels = (t, shot, obstacles) => {
    const top = SAFE.t, bottom = Math.min(SAFE.b, capY - GAP), placed = [], svg = [];
    const g = 16 * S1, m = 8 * S1, now = L.map((lb) => {
      const o = lb.o, pr = o.shot && o.shot !== shot ? { o: 0, x: 0, y: 0, s: 1 } : presence(t, from0(o.t0), o.t1 ?? null, { dy: 0.012, d: 0.45 });
      return { pr: gated(pr), a: anchorAt(o, t) };
    });
    const spots = now.filter((n) => n.pr.o > 0.001 && n.a.on).map((n) => n.a);
    L.forEach((lb, i) => {
      const { el, o } = lb, { pr, a } = now[i], w = el.offsetWidth, h = el.offsetHeight;
      const x = Number.isFinite(a.x) ? a.x : (SAFE.l + SAFE.r) / 2, y = Number.isFinite(a.y) ? a.y : (top + bottom) / 2;
      const side = o.side ?? 1, rise = (o.v || "above") === "above" ? y - h - 12 * S1 : y - h / 2;
      const sx = (s) => (s > 0 ? x + g : x - w - g);
      const cands = [[sx(side), rise], [sx(-side), rise], [x - w / 2, y - h - 22 * S1], [x - w / 2, y + 22 * S1],
        [sx(side), y - h - g], [sx(-side), y - h - g], [sx(side), y + g], [sx(-side), y + g]];
      const fit = ([cl, ct]) => [Math.min(SAFE.r - w, Math.max(SAFE.l, cl)), Math.min(bottom - h, Math.max(top, ct))];
      const over = (r, q) => Math.max(0, Math.min(r.r, q.r + m) - Math.max(r.l, q.l - m)) * Math.max(0, Math.min(r.b, q.b + m) - Math.max(r.t, q.t - m));
      const cost = ([cl, ct]) => {
        const r = box(cl, ct, w, h);
        let c = 0;
        for (const p of spots) if (p.x > r.l - m && p.x < r.r + m && p.y > r.t - m && p.y < r.b + m) c += w * h;   // never on a spot a label names
        for (const q of placed) c += 2 * over(r, q);
        for (const q of obstacles) c += over(r, q);
        return c;
      };
      let [lx, ly] = fit(cands[0]);
      if (pr.o > 0.001) {
        if (!o.fixed) {
          let best = Infinity;
          for (const cd of cands) { const f = fit(cd), c = cost(f); if (c < best - 1e-6) { best = c; [lx, ly] = f; } if (c === 0) break; }
        }
        placed.push(box(lx, ly, w, h));
      }
      place(el, lx, ly);
      apply(el, pr);
      // the leader: from the exact spot to the nearest point of the pill, in the label's colour, and a dot on the spot
      if (pr.o > 0.01 && a.on) {
        const nx = Math.min(lx + w, Math.max(lx, x)), ny = Math.min(ly + h, Math.max(ly, y)), d = Math.hypot(nx - x, ny - y), op = pr.o.toFixed(3);
        if (d > 10 * S1) svg.push(`<line x1="${f2(x)}" y1="${f2(y)}" x2="${f2(nx)}" y2="${f2(ny)}" style="stroke:${lb.c}" stroke-width="${f2(4.3 * S1)}" stroke-linecap="round" opacity="${op}"/>`);
        svg.push(`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(9.5 * S1)}" style="fill:${lb.c};stroke:var(--hud-ring)" stroke-width="${f2(3.8 * S1)}" opacity="${op}"/>`);
      }
    });
    leads.innerHTML = svg.join("");
  };

  // ── badges ────────────────────────────────────────────────────────────────
  const badge = (id, o) => {
    const el = mk("div", "hud-badge");
    el.id = "hud-" + id;
    B.push({ id, el, o });
    return el;
  };
  const badgeNow = (o, t) => {
    if (o.from) {
      const segs = o.from.badges || [];
      let b = null;
      for (const s of segs) if (t >= s.t0) b = s;                        // the latest that has started
      if (!b) return null;
      const t1 = b.t1 === Infinity ? null : b.t1;
      return { text: b.text, pr: presence(t, from0(b.t0), t1, { d: 0.35, out: 0.3 }) };
    }
    const text = typeof o.text === "function" ? o.text(t) : o.text;
    if (text == null) return null;
    return { text, pr: presence(t, from0(o.t0), o.t1 ?? null, { d: 0.35, out: 0.3 }) };
  };
  const drawBadges = (t, obstacles) => {
    const stack = { tr: SAFE.t, tl: SAFE.t, br: capY - GAP, bl: capY - GAP }, rects = [];
    for (const bd of B) {
      const { el, o } = bd, now = badgeNow(o, t);
      // a clock's badge can also be limited to a window of its own (t0, t1)
      const win = o.from && (o.t0 != null || o.t1 != null) ? presence(t, from0(o.t0), o.t1 ?? null, { d: 0.35, out: 0.3 }).o : 1;
      if (!now) { apply(el, { o: 0, x: 0, y: 0, s: 1 }); continue; }
      if (el.textContent !== now.text) el.textContent = now.text;
      const pr = { ...now.pr, o: now.pr.o * win * gate }, w = el.offsetWidth, h = el.offsetHeight, slot = o.slot || "tr";
      const x = slot[1] === "r" ? SAFE.r - w : SAFE.l;
      let y;
      if (slot[0] === "t") { y = stack[slot]; if (pr.o > 0.001) stack[slot] += h + 10 * S1; }
      else { y = stack[slot] - h; if (pr.o > 0.001) stack[slot] -= h + 10 * S1; }
      place(el, x, y);
      apply(el, pr);
      if (pr.o > 0.01) rects.push(box(x, y, w, h));
    }
    obstacles.push(...rects);
  };

  // ── counters (tabular figures) ────────────────────────────────────────────
  const counter = (id, o) => {
    const el = mk("div", "hud-counter");
    el.id = "hud-" + id;
    el.innerHTML = (o.label ? '<span class="lb">' + esc(o.label) + "</span>" : "") + '<span class="row"><b class="v"></b>' + (o.unit ? '<span class="u">' + esc(o.unit) + "</span>" : "") + "</span>";
    if (o.minCh) el.querySelector(".v").style.minWidth = o.minCh + "ch";
    C.push({ id, el, v: el.querySelector(".v"), o });
    return el;
  };
  const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const drawCounters = (t, obstacles) => {
    for (const ct of C) {
      const { el, v, o } = ct;
      const val = o.value ? o.value(t) : keyed(o.keys || [[0, 0]], t, o.ease ? ease(o.ease) : E.inout3);
      const txt = (o.fmt || commas)(val);
      if (v.textContent !== txt) v.textContent = txt;
      el.classList.toggle("lit", !!(o.lit && o.lit(val)));
      const pr = gated(presence(t, from0(o.t0), o.t1 ?? null, { dy: 0.02 })), w = el.offsetWidth, h = el.offsetHeight;
      const [fx, fy] = o.at || [(SAFE.l + SAFE.r) / 2 / W, 0.47];
      const x = fx * W - w / 2, y = fy * H - h / 2;
      place(el, x, y);
      apply(el, pr);
      if (pr.o > 0.01) obstacles.push(box(x, y, w, h));
    }
  };

  // ── scale pill ────────────────────────────────────────────────────────────
  const scale = (id, o) => {
    const el = mk("div", "hud-scale");
    el.id = "hud-" + id;
    el.innerHTML = '<span class="bar"></span><span class="tx"></span>';
    SC.push({ id, el, bar: el.querySelector(".bar"), tx: el.querySelector(".tx"), o });
    return el;
  };
  const drawScales = (t, obstacles) => {
    for (const sp of SC) {
      const { el, bar, tx, o } = sp;
      const text = typeof o.text === "function" ? o.text(t) : o.text, px = o.bar ? o.bar(t) : null;
      if (tx.textContent !== text) tx.textContent = text;
      bar.style.display = px == null ? "none" : "block";
      if (px != null) bar.style.width = Math.max(4 * S1, Math.min(px, (SAFE.r - SAFE.l) * 0.6)).toFixed(2) + "px";
      const pr = gated(presence(t, from0(o.t0), o.t1 ?? null, { d: 0.4 })), w = el.offsetWidth, h = el.offsetHeight;
      const x = o.at ? o.at[0] * W : SAFE.l, y = o.at ? o.at[1] * H : capY - GAP - h;
      place(el, x, y);
      apply(el, pr);
      if (pr.o > 0.01) obstacles.push(box(x, y, w, h));
    }
  };

  // ── title card and end card (shells: a channel adds its motif to the returned element) ──
  const title = (o) => {
    const el = mk("div", "hud-title");
    el.id = "hud-title";
    el.innerHTML = (o.series ? '<p class="hud-series">' + esc(o.series) + "</p>" : "") + '<h1 class="hud-h">' + accent(o.title || "") + "</h1>" + (o.sub ? '<p class="hud-sub">' + esc(o.sub) + "</p>" : "");
    el.style.width = (SAFE.r - SAFE.l).toFixed(2) + "px";
    TITLE = { el, o };
    return el;
  };
  const drawTitle = (t, obstacles) => {
    if (!TITLE) return;
    // a title from t0 <= 0 is already there on frame 0 (from0); a later one arrives
    const { el, o } = TITLE, pr = gated(presence(t, from0(o.t0), o.t1 ?? null, { d: 0.55, out: 0.45, dy: 0.03 }));
    const y = o.y != null ? o.y * H : SAFE.t;
    place(el, SAFE.l, y);
    apply(el, pr);
    if (pr.o > 0.01) obstacles.push(box(SAFE.l, y, el.offsetWidth, el.offsetHeight));
  };
  const end = (o) => {
    const scrim = mk("div", "hud-scrim"), el = mk("div", "hud-end");
    el.id = "hud-end";
    el.innerHTML = '<p class="t">' + accent(o.title || "") + "</p>" + (o.next ? '<p class="nx">' + esc(o.next) + "</p>" : "") + (o.follow ? '<span class="fo">' + esc(o.follow) + "</span>" : "");
    el.style.width = (SAFE.r - SAFE.l).toFixed(2) + "px";
    END = { el, scrim, o };
    return el;
  };
  const drawEnd = (t) => {
    if (!END) return;
    const { el, scrim, o } = END, e = E.out3(seg(t, o.t0, o.t0 + (o.d ?? 0.6)));
    place(el, SAFE.l, (o.y ?? 0.33) * H);
    apply(el, { o: e, x: 0, y: 0.024 * (1 - e), s: 1 });
    scrim.style.opacity = e.toFixed(4);
  };

  // the end card takes over: labels, badges, counters, pills and the title give way as it arrives (the
  // captions stay, above the scrim, because the tease is spoken over the card)
  let gate = 1;
  const gated = (pr) => (gate < 1 ? { ...pr, o: pr.o * gate } : pr);
  const update = (t) => {
    if (camera && camera.updateMatrixWorld) camera.updateMatrixWorld();   // project through this frame's camera, not the last one drawn
    gate = END ? 1 - E.out3(seg(t, END.o.t0, END.o.t0 + (END.o.d ?? 0.6))) : 1;
    const shot = shotAt(t, shots.length ? shots : [{ at: 0, name: "main" }]).name, obstacles = [];
    const cap = drawCaptions(t);
    if (cap) obstacles.push(cap);
    drawTitle(t, obstacles);
    drawBadges(t, obstacles);
    drawCounters(t, obstacles);
    drawScales(t, obstacles);
    drawLabels(t, shot, obstacles);
    drawEnd(t);
  };

  // the overlay's own events, for the studio (render.mjs --cues adds pos and shown for each el)
  const cues = () => {
    const ev = [];
    for (const { id, el, o } of L) ev.push({ t: o.t0 ?? 0, kind: "label", tag: id, el: el.id });
    for (const { id, el, o } of C) ev.push({ t: o.t0 ?? 0, kind: "counter.show", tag: id, el: el.id });
    for (const { id, el, o } of SC) ev.push({ t: o.t0 ?? 0, kind: "scale", tag: id, el: el.id });
    for (const { id, el, o } of B) {
      if (o.from) (o.from.badges || []).forEach((b, k) => ev.push({ t: b.t0, kind: "badge", tag: `${id}:${k}`, el: el.id, text: b.text }));
      else ev.push({ t: o.t0 ?? 0, kind: "badge", tag: id, el: el.id, text: typeof o.text === "string" ? o.text : null });
    }
    if (TITLE) ev.push({ t: TITLE.o.sig ?? TITLE.o.t0 ?? 0, kind: "signature", tag: "title", el: TITLE.el.id });
    if (END) ev.push({ t: END.o.t0, kind: "signature", tag: "end", el: END.el.id });
    return ev.sort((a, b) => a.t - b.t);
  };
  if (!window.SCENE_CUES) window.SCENE_CUES = () => ({ dur: (window.SCENE && window.SCENE.dur) || (window.FILM && window.FILM.dur), events: cues() });
  window.HUD_SAFE = SAFE;   // the renderer's audit checks text against it

  const projectNow = (p) => { camera.updateMatrixWorld(); return project(camera, p, W, H); };
  return { captions, label, badge, counter, scale, title, end, update, cues, safe: SAFE, project: projectNow };
};
