// aces.js — the colour bridge through the finish (films/channels/whatif/set): Rest Frame's set/aces.js,
// unchanged in code. The cinema finish (kits/cinema/cinema3d.js) and three's ACESFilmicToneMapping both map
// scene light c to the screen as sRGB(clamp(OUT · RRT(IN · c · exposure / 0.6))), so every unlit surface
// here (the desk, the model's cut face, the figure, the car) outputs the curve's inverse of the colour it
// should show, and the screen shows the token exactly.
//
//   acesInv("#E6E2D8")        → [r, g, b] scene-linear values for a MeshBasicMaterial (≈ [1.13, 0.99, 0.71])
//   ACES_INV_GLSL             GLSL: srgbToLinear(vec3), acesInv(vec3 displayLinear, float exposure)
//   unlit(hex)                → a THREE.Color holding acesInv(hex), for MeshBasicMaterial / instance colours
//
// Keep the bloom threshold at 2.5 or more (cyc-hi needs 1.88 in its brightest channel; the bright pass's
// soft knee starts 0.25 below the threshold), and lit props at albedo 0.7 or below.
import * as THREE from "three";

const IN_INV = [[1.7647409720361253, -0.6757776782442765, -0.08896329379184853],
  [-0.14702785203237845, 1.1602515117121115, -0.013223659679733166],
  [-0.036336830118448675, -0.16243643691024318, 1.1987732670286917]];
const OUT_INV = [[0.6430382485582231, 0.31118675184431016, 0.04577545735204027],
  [0.05926869042026886, 0.931436486850086, 0.00929491567880172],
  [0.005961901254404335, 0.06392901568906076, 0.9301183842403774]];
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const rrtInv = (y) => {
  const A = 1 - 0.983729 * y, B = 0.0245786 - 0.432951 * y, C = -(0.000090537 + 0.238081 * y);
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
};
export const hexRgb = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
export const acesInv = (hex, exposure = 1) => {
  const lin = (Array.isArray(hex) ? hex : hexRgb(hex)).map(s2l);
  const x = mul(OUT_INV, lin).map((y) => rrtInv(Math.min(1.0, Math.max(0, y))));
  return mul(IN_INV, x).map((c) => Math.max(0, (c * 0.6) / exposure));
};
export const unlit = (hex, exposure = 1) => { const c = acesInv(hex, exposure); return new THREE.Color().setRGB(c[0], c[1], c[2]); };
// the forward curve, as the finish applies it: scene light [r, g, b] → the screen's sRGB, 0–1 (acesFwd(acesInv(hex)) ≈ hex)
const IN_M = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
const OUT_M = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const acesFwd = (c, exposure = 1) => {
  const x = mul(IN_M, c.map((v) => (v * exposure) / 0.6)).map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081));
  return mul(OUT_M, x).map((y) => l2s(Math.min(1, Math.max(0, y))));
};
// the opacity at which a mark showing inkHex over paperHex keeps k (0–1) of its contrast on screen. Blending happens in
// scene light, before the curve, so opacity 1/3 shows far less than a third (about 1/11 for ink-2 on the cyc; a third needs about 0.7)
export const screenAlpha = (k, inkHex, paperHex = "#E6E2D8") => {
  if (k >= 1) return 1;
  if (k <= 0) return 0;
  const a = acesInv(inkHex), b = acesInv(paperHex), lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const P = lum(hexRgb(paperHex)), I = lum(hexRgb(inkHex));
  let lo = 0, hi = 1;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2, d = lum(acesFwd(a.map((v, j) => m * v + (1 - m) * b[j])));
    if ((P - d) / (P - I) < k) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
};
// three's sRGB → linear for a lit material's albedo (ColorManagement does the same for new THREE.Color(hex))
export const albedo = (hex, k = 1) => { const c = hexRgb(hex).map(s2l); return new THREE.Color().setRGB(c[0] * k, c[1] * k, c[2] * k); };

// GLSL (column-major mat3, as the finish writes its own): display-linear → scene-linear
export const ACES_INV_GLSL = `
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 acesInv(vec3 lin, float exposure) {
  const mat3 OUTI = mat3(vec3(0.6430382, 0.0592687, 0.0059619), vec3(0.3111868, 0.9314365, 0.0639290), vec3(0.0457755, 0.0092949, 0.9301184));
  const mat3 INI = mat3(vec3(1.7647410, -0.1470279, -0.0363368), vec3(-0.6757777, 1.1602515, -0.1624364), vec3(-0.0889633, -0.0132237, 1.1987733));
  vec3 y = clamp(OUTI * lin, 0.0, 1.0);
  vec3 A = 1.0 - 0.983729 * y, B = 0.0245786 - 0.432951 * y, C = -(0.000090537 + 0.238081 * y);
  vec3 x = (-B + sqrt(B * B - 4.0 * A * C)) / (2.0 * A);
  return max(INI * x * 0.6 / exposure, 0.0);
}`;
