// runtime.js — the film runtime (kits/cinema/film): the small helpers every scene and the HUD share.
// A plain ES module with no imports and no state, so it also loads in Node for tests. Brand-neutral:
// it carries no colour, type or motif (those come from the channel's theme.json, through page.mjs).
//
// The contract it serves (README.md): a scene's window.seek(t) sets everything on screen from t alone.
// No timers, no CSS transitions, no requestAnimationFrame, no Date, no Math.random (the renderer seeds
// them anyway). Every helper below is a pure function of its arguments; the DOM helpers only write.
//
// clamp(x, a, b), clamp01(x), lerp(a, b, u)
// seg(t, a, b)          0 before a, 1 after b, linear between (b <= a is a step at a)
// E                     eases on [0, 1]: lin, in2, out2, inout2, in3, out3, inout3, sine, back, expo
// ease(name, fb)        the ease for a name ("p2"/"p3" are inout2/inout3, as in keys.js); fb when unknown
// tw(t, a, b, from, to, e)   a tween: from → to over [a, b] with ease e (default out3)
// keyed(keys, t, e)     a value from keys [[t, v], ...]: holds the first before it, eases between keys
// hash(i)               an integer → [0, 1), the same on every machine
// rng(seed)             a seeded generator (mulberry32): call it for the next number in [0, 1)
// presence(t, t0, t1, o) → { o, x, y, s, p, q }: how far something has arrived at t0 and left at t1
//                       o: { d: 0.5 in, out: 0.4 out, dy: 0.022 (fraction of the short side), dx: 0,
//                       s: 0.97 starting scale, ease, outEase, dxOut / dyOut: 0 (a leave fades in place,
//                       so nothing drifts out of the safe box) }. t1 null: it never leaves.
// apply(el, pr, u)      write a presence to an element: opacity, then translate/scale in px (u = px per
//                       unit of dx/dy; default the short side of window.W × window.H)
// enter(el, t, t0, o) / leave(el, t, t1, o)   presence(...) + apply(...) for one end only
// show(el, t, t0, t1, o)                      both ends at once; returns the opacity
// stage(t, shots, o)    the shot stage: which shot is on at t, its local time, and a short cross-fade
//                       for elements marked data-shot="<name>". Also sets window.M.t, which cinema3d.js
//                       passes to window.CINEMA_FOCUS. Call it first in seek.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const seg = (t, a, b) => (b > a ? clamp01((t - a) / (b - a)) : t >= a ? 1 : 0);

export const E = {
  lin: (x) => x,
  in2: (x) => x * x,
  out2: (x) => 1 - (1 - x) * (1 - x),
  inout2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  in3: (x) => x * x * x,
  out3: (x) => 1 - Math.pow(1 - x, 3),
  inout3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  // a small overshoot that settles at 1 (labels and pills popping in)
  back: (x) => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};
const ALIAS = { p2: "inout2", p3: "inout3", out: "out3", in: "in3", inout: "inout3", linear: "lin" };
export const ease = (name, fb = "inout2") => E[name] || E[ALIAS[name]] || E[fb] || E.inout2;

export const tw = (t, a, b, from, to, e = E.out3) => from + (to - from) * e(seg(t, a, b));

// keys: [[t, v], ...] sorted by t; e is the ease between two keys (a function or a name)
export const keyed = (keys, t, e = E.inout3) => {
  if (!keys.length) return 0;
  const f = typeof e === "function" ? e : ease(e);
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [ta, va] = keys[i - 1], [tb, vb] = keys[i];
    if (t < tb) return va + (vb - va) * f(seg(t, ta, tb));
  }
  return keys[keys.length - 1][1];
};

export const hash = (i) => {
  let x = Math.imul((i | 0) + 1, 2654435761) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
export const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

// ── presence: arrive at t0, leave at t1, as numbers (no DOM) ───────────────
export const presence = (t, t0, t1 = null, o = {}) => {
  const d = o.d ?? 0.5, dOut = o.out ?? 0.4;
  const inE = typeof o.ease === "function" ? o.ease : ease(o.ease || "out3");
  const outE = typeof o.outEase === "function" ? o.outEase : ease(o.outEase || "in3");
  const p = t0 == null ? 1 : seg(t, t0, t0 + d), qi = inE(p);
  const q = t1 == null ? 0 : outE(seg(t, t1, t1 + dOut));
  const dy = o.dy ?? 0.022, dx = o.dx ?? 0, s0 = o.s ?? 0.97;
  return {
    p, q,
    o: Math.min(1, p * 2.2) * (1 - q),
    x: dx * (1 - qi) - (o.dxOut ?? 0) * q,
    y: dy * (1 - qi) - (o.dyOut ?? 0) * q,
    s: s0 + (1 - s0) * qi,
  };
};
const unit = () => Math.min(window.W || innerWidth, window.H || innerHeight);
export const apply = (el, pr, u = unit()) => {
  if (!el) return;
  el.style.opacity = pr.o <= 0.001 ? "0" : pr.o >= 0.999 ? "1" : pr.o.toFixed(4);
  el.style.visibility = pr.o <= 0.001 ? "hidden" : "visible";
  el.style.translate = (pr.x * u).toFixed(2) + "px " + (pr.y * u).toFixed(2) + "px";
  el.style.scale = pr.s.toFixed(4);
};
export const enter = (el, t, t0, o = {}) => { const pr = presence(t, t0, null, o); apply(el, pr); return pr.p; };
export const leave = (el, t, t1, o = {}) => { const pr = presence(t, null, t1, o); apply(el, pr); return pr.q; };
export const show = (el, t, t0, t1, o = {}) => { const pr = presence(t, t0, t1, o); apply(el, pr); return pr.o; };

// ── the shot stage ──────────────────────────────────────────────────────────
export const shotAt = (t, shots) => {
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (t >= shots[k].at) i = k;
  const s = shots[i] || { at: 0, name: "main" }, next = shots[i + 1];
  return { i, at: s.at, lt: t - s.at, name: s.name, end: next ? next.at : Infinity };
};
export const stage = (t, shots = (globalThis.FILM && globalThis.FILM.shots) || [], o = {}) => {
  const st = shotAt(t, shots.length ? shots : [{ at: 0, name: "main" }]);
  if (typeof window !== "undefined") {
    (window.M ||= {}).t = t;
    const fade = o.fade ?? 0.35, prev = shots[st.i - 1];
    for (const el of document.querySelectorAll("[data-shot]")) {
      const name = el.dataset.shot;
      let op = 0;
      if (name === st.name) op = st.i === 0 ? 1 : E.out3(seg(st.lt, 0, fade));
      else if (prev && name === prev.name && st.lt < fade) op = 1 - E.in3(seg(st.lt, 0, fade));
      el.style.opacity = op.toFixed(4);
      el.style.visibility = op > 0.001 ? "visible" : "hidden";
    }
  }
  return st;
};
