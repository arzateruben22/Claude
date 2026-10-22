// aces.js — Rest Frame's colour bridge through the finish (films/channels/physics/set). The cinema finish
// (kits/cinema/cinema3d.js) and three's own ACESFilmicToneMapping both map scene light c to the screen as
// sRGB(clamp(OUT · RRT(IN · c · exposure / 0.6))). A pale set under that curve never lands on its tokens
// (cross-check: #E6E2D8 needs about 1.0 of scene light, #F1EEE7 about 1.6), so every unlit surface here
// (the cyc, the rulers, rungs and arrows) outputs the curve's inverse of the colour it should show:
// unlit + inverse ⇒ the screen shows the token exactly (round-trip checked to the 8-bit value).
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
