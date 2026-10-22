// look.js — Light Minute's colours as the finish needs them (films/channels/space/set).
//
// kits/cinema/cinema3d.js renders the scene in linear light, then applies ACES and sRGB. A colour that
// must land exactly on a theme token after the finish (the void sky, the teal of a light-time ring) is
// therefore fed through the inverse of that curve here, solved numerically against the finish's own
// formulas (the same matrices and rational fit as cinema3d.js's cinAces). The plain path (the animatic
// tier, no finish) shows the same values without ACES, a little brighter; only the finish is graded.
//
//   tok("teal")            the token's linear value that the finish turns back into #4FE3C6, as [r, g, b]
//   lin("#4FE3C6")         plain sRGB → linear (no tone-curve inversion)
//   hdr("teal", k)         the token's inverted value × k (k > 1 glows: the bloom picks it up)
//   THEME                  window.THEME (tokens from the channel's theme.json)
const T = (window.THEME && window.THEME.tokens) || {};

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexRGB = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); };
export const lin = (hex) => hexRGB(hex).map(s2l);

// the finish's curve (cinema3d.js T.outMat): c *= exposure / 0.6; OUT · RRT(IN · c); clamp; then sRGB
const IN = [[0.59719, 0.35458, 0.04823], [0.076, 0.90834, 0.01566], [0.0284, 0.13383, 0.83777]];
const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const rrt = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
export const aces = (c, exposure = 1) => mul(OUT, mul(IN, c.map((x) => x * exposure / 0.6)).map(rrt)).map((x) => Math.min(1, Math.max(0, x)));
const finish = (c) => aces(c).map(l2s);

// Newton on the 3×3 system finish(x) = target (sRGB), with a numeric Jacobian
const invert = (target) => {
  let x = target.map(s2l).map((v) => Math.max(v, 0.004));
  for (let it = 0; it < 40; it++) {
    const f = finish(x), r = f.map((v, i) => v - target[i]);
    if (Math.max(...r.map(Math.abs)) < 1e-6) break;
    const J = [0, 1, 2].map(() => [0, 0, 0]);
    for (let j = 0; j < 3; j++) {
      const h = Math.max(1e-6, x[j] * 1e-4), xp = x.slice(); xp[j] += h;
      const fp = finish(xp);
      for (let i = 0; i < 3; i++) J[i][j] = (fp[i] - f[i]) / h;
    }
    const det = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
    const inv = [
      [(J[1][1] * J[2][2] - J[1][2] * J[2][1]) / det, (J[0][2] * J[2][1] - J[0][1] * J[2][2]) / det, (J[0][1] * J[1][2] - J[0][2] * J[1][1]) / det],
      [(J[1][2] * J[2][0] - J[1][0] * J[2][2]) / det, (J[0][0] * J[2][2] - J[0][2] * J[2][0]) / det, (J[0][2] * J[1][0] - J[0][0] * J[1][2]) / det],
      [(J[1][0] * J[2][1] - J[1][1] * J[2][0]) / det, (J[0][1] * J[2][0] - J[0][0] * J[2][1]) / det, (J[0][0] * J[1][1] - J[0][1] * J[1][0]) / det],
    ];
    const d = mul(inv, r);
    x = x.map((v, i) => Math.max(1e-5, v - d[i]));
  }
  return x;
};
const cache = new Map();
export const tok = (name) => {
  const hex = name.startsWith("#") ? name : T[name];
  if (!hex) throw new Error(`look.js: no token "${name}" in the theme`);
  if (!cache.has(hex)) cache.set(hex, invert(hexRGB(hex)));
  return cache.get(hex).slice();
};
export const hdr = (name, k = 1) => tok(name).map((v) => v * k);
export const THEME = window.THEME || {};
