// ladder.js — scale rungs, a log dolly, crossfades and float-safe re-centring for the science films
// (kits/cinema/sci). Brand-neutral; used by space (Sun → galaxy), body (cell → organ) and physics
// (atom → bench). A plain ES module; it touches three.js objects but imports nothing.
//
// The idea: a scene that spans many powers of ten can't put everything in one coordinate frame (float32
// on the GPU jitters long before a galaxy holds a planet). So each scale lives in its own rung: one
// THREE.Group drawn in its own units (1 unit = 1,000 km, 1 AU, 1,000 light-years, ...). A view is a
// focus point and a scale, both in one absolute unit of the scene's choosing (km, µm, ...). For each
// view the ladder places every rung so the focus sits at the scene origin and one scene unit is
// `scale` absolute units:
//     group.scale    = rung.unit / view.scale
//     group.position = (rung.origin − view.focus) / view.scale        (computed in doubles)
// so the numbers that reach the GPU stay small around the camera, which never moves far. The camera
// can stay put while the world shrinks around the focus: a dolly in log space, the scale jump.
//
//   const L = createLadder({ rungs: [
//     { id: "solar",  group: solar,  unit: 1e7,      origin: [0, 0, 0],       show: [5, 8.6] },   // log10 scale range where it is fully shown
//     { id: "galaxy", group: galaxy, unit: 9.461e15, origin: [-2.55e17, 0, 0], show: [15.2, 18] },
//   ], fade: 0.5 });                     // decades over which a rung fades in and out
//   const dolly = logDolly([{ t: 64.0, scale: 1e7, focus: [0, 0, 0] }, { t: 66.2, scale: 3e16, focus: [-2.55e17, 0, 0], ease: "inout3" }]);
//   window.seek = (t) => { const v = L.apply(dolly(t)); ... v.alpha.solar ... };
//
// createLadder({ rungs, fade = 0.5, opacity = setOpacity }) → L
//   rung: { id, group, unit (absolute units per local unit), origin [x,y,z] (absolute; where local 0 sits),
//           show: [lo, hi] (log10 of the view scale: fully shown inside, faded over `fade` decades outside),
//           fade (per rung) }
//   L.apply(view) → { scale, focus, s: log10(scale), alpha: { id: 0..1 } }: places, scales and fades every
//           rung for view { scale, focus }; a rung at alpha 0 is hidden (group.visible = false), so neither
//           the renderer nor the motion-blur probe ever sees a far-off rung at huge coordinates.
//   L.toScene(id, p, view)   a point in a rung's local units → scene units for that view (doubles; for labels)
//   L.toLocal(id, p, view)   the reverse
//   L.alpha(id, s)           a rung's opacity at log10 scale s
// logDolly(keys, { ease = "inout3" }) → (t) => { scale, focus, s, u }
//   keys: [{ t, scale, focus: [x,y,z], ease? }]. log10(scale) is eased between keys; the focus moves in
//   step with the zoom (by the same eased fraction, u), so a subject that leaves the centre does so at the
//   pace the eye reads the zoom. Before the first key the first holds; after the last, the last.
// setOpacity(object, a)     multiplies every material's opacity under object by a (each material's own
//                           opacity is remembered the first time, in userData.baseOpacity) and hides
//                           what reaches 0. ShaderMaterials with a uOpacity uniform are scaled the same way.
// niceLength(maxAbs, units) → { abs, text }: the longest round length (1, 2 or 5 × 10^n of a display unit)
//                           up to maxAbs, for a scale bar. units: [{ abs: absolute units per display unit,
//                           name, plural, min }] tried from the largest whose min ≤ maxAbs.
// fmtCount(n)               12000 → "12,000"
//
// Everything is a pure function of the view it is given.

const E = {
  lin: (x) => x,
  inout2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inout3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  out3: (x) => 1 - Math.pow(1 - x, 3),
  in3: (x) => x * x * x,
};
const ease = (e, fb = "inout3") => (typeof e === "function" ? e : E[e] || E[fb]);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const logDolly = (keys, opts = {}) => {
  const ks = keys.map((k) => ({ ...k, s: Math.log10(k.scale), focus: k.focus || [0, 0, 0] })).sort((a, b) => a.t - b.t);
  return (t) => {
    if (t <= ks[0].t) return { scale: ks[0].scale, s: ks[0].s, focus: ks[0].focus.slice(), u: 0 };
    for (let i = 1; i < ks.length; i++) {
      const a = ks[i - 1], b = ks[i];
      if (t < b.t) {
        const u = ease(b.ease, opts.ease || "inout3")(clamp01((t - a.t) / (b.t - a.t)));
        const s = a.s + (b.s - a.s) * u;
        return { scale: Math.pow(10, s), s, u, focus: [0, 1, 2].map((j) => a.focus[j] + (b.focus[j] - a.focus[j]) * u) };
      }
    }
    const z = ks[ks.length - 1];
    return { scale: z.scale, s: z.s, focus: z.focus.slice(), u: 1 };
  };
};

export const setOpacity = (object, a) => {
  object.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.uniforms && m.uniforms.uOpacity) {
        if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.uniforms.uOpacity.value;
        m.uniforms.uOpacity.value = m.userData.baseOpacity * a;
      } else if ("opacity" in m) {
        if (m.userData.baseOpacity == null) { m.userData.baseOpacity = m.opacity; if (a < 1) m.transparent = true; }
        m.opacity = m.userData.baseOpacity * a;
      }
    }
  });
  object.visible = a > 1e-4;
};

export const createLadder = ({ rungs, fade = 0.5, opacity = setOpacity }) => {
  const R = rungs.map((r) => ({ fade, show: [-Infinity, Infinity], origin: [0, 0, 0], ...r }));
  const byId = Object.fromEntries(R.map((r) => [r.id, r]));
  const alpha = (id, s) => {
    const r = byId[id], [lo, hi] = r.show, f = r.fade;
    const up = f > 0 ? clamp01((s - (lo - f)) / f) : s >= lo ? 1 : 0;
    const down = f > 0 ? clamp01(((hi + f) - s) / f) : s <= hi ? 1 : 0;
    const x = Math.min(up, down);
    return x * x * (3 - 2 * x);
  };
  const toScene = (id, p, v) => { const r = byId[id], k = r.unit / v.scale; return [0, 1, 2].map((j) => (r.origin[j] - v.focus[j]) / v.scale + p[j] * k); };
  const toLocal = (id, p, v) => { const r = byId[id], k = r.unit / v.scale; return [0, 1, 2].map((j) => (p[j] - (r.origin[j] - v.focus[j]) / v.scale) / k); };
  const apply = (view) => {
    const s = Math.log10(view.scale), out = { scale: view.scale, focus: view.focus, s, alpha: {} };
    for (const r of R) {
      const a = alpha(r.id, s);
      out.alpha[r.id] = a;
      if (a <= 1e-4) { r.group.visible = false; continue; }
      const k = r.unit / view.scale;
      r.group.scale.setScalar(k);
      r.group.position.set((r.origin[0] - view.focus[0]) / view.scale, (r.origin[1] - view.focus[1]) / view.scale, (r.origin[2] - view.focus[2]) / view.scale);
      opacity(r.group, a);
      r.group.visible = true;
    }
    return out;
  };
  return { apply, alpha, toScene, toLocal, rungs: R };
};

export const fmtCount = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const niceLength = (maxAbs, units) => {
  const us = [...units].sort((a, b) => b.abs - a.abs);
  const u = us.find((x) => (x.min ?? x.abs) <= maxAbs) || us[us.length - 1];
  const m = maxAbs / u.abs, p = Math.pow(10, Math.floor(Math.log10(m)));
  const n = [5, 2, 1].map((k) => k * p).find((x) => x <= m) || p;
  const label = n >= 1 ? fmtCount(n) : String(+n.toPrecision(2));
  return { abs: n * u.abs, text: `${label} ${n === 1 ? u.name : u.plural || u.name + "s"}` };
};
