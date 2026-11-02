// tape04.js — paper on the desk (films/channels/whatif/set), built for No. 004 ("Count to a billion"): flat
// sheets lying on the graph paper whose faces are drawn with the 2D canvas, so they can carry real type (the
// theme's faces, loaded before the first frame) and redraw when their state changes. Three uses:
//
//   import { createSheet, numberWords, syllables } from "../set/tape04.js";
//   const s = createSheet({ w: 4, d: 1, ppu: 256, at: [x, 0, z], draw: (ctx, W, H, state) => { ... } });
//   scene.add(s.mesh);
//   s.set({ state, opacity })     // redraws only when JSON.stringify(state) changes, so seek stays pure in t
//
//   - the counting tape: one slip per number, as long as the number takes to say (its syllables);
//   - the calendar of a summer (one square per day, filled as the days pass);
//   - the ruler of centuries (years of counting, lifetimes laid end to end).
//
// The sheet's face is composed in display colours and output through the finish's inverse (./aces.js), as
// desk.js and anchor.js are, so the paper and ink land exactly on the theme's tokens. Alpha comes from the
// canvas (rounded corners); opacity fades the whole sheet. Sheets never move: the finish's probe reads the
// camera only. numberWords() spells American number names (no "and"), the same rule calc.py counts.
import * as THREE from "three";
import { ACES_INV_GLSL } from "./aces.js";

const VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `
precision highp float;
uniform sampler2D uMap; uniform float uOpacity, uExposure;
varying vec2 vUv;
${ACES_INV_GLSL}
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a * uOpacity < 0.004) discard;
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(c.rgb, 0.0, 1.0)), uExposure), c.a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createSheet = (o) => {
  const w = o.w, d = o.d, ppu = o.ppu ?? 256;
  const cw = Math.min(4096, Math.round(w * ppu)), ch = Math.min(4096, Math.round(d * ppu));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;                      // the shader reads the canvas's sRGB values as they are
  tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const u = { uMap: { value: tex }, uOpacity: { value: 1 }, uExposure: { value: o.exposure ?? 1 } };
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);                                   // flat on the desk, the canvas's top edge away from the camera (−z)
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false }));
  mesh.position.set(...(o.at || [0, 0, 0]));
  mesh.position.y += o.lift ?? 0.01;
  mesh.renderOrder = o.order ?? -4;
  let key = null;
  const set = (s = {}) => {
    if (s.opacity !== undefined) { u.uOpacity.value = s.opacity; mesh.visible = s.opacity > 0.002; }
    if (!mesh.visible) return;
    const k = JSON.stringify(s.state ?? null);
    if (k !== key) {
      ctx.clearRect(0, 0, cw, ch);
      o.draw(ctx, cw, ch, s.state ?? null);
      tex.needsUpdate = true;
      key = k;
    }
  };
  return { mesh, set, w, d, canvas };
};

// a rounded rectangle path on a 2D context
export const rrect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
};

// American number names (no "and"), and their syllables: the same table as ep04/calc.py
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SYL = { one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 2, eight: 1, nine: 1, ten: 1, eleven: 3, twelve: 1, thirteen: 2,
  fourteen: 2, fifteen: 2, sixteen: 2, seventeen: 3, eighteen: 2, nineteen: 2, twenty: 2, thirty: 2, forty: 2, fifty: 2, sixty: 2,
  seventy: 3, eighty: 2, ninety: 2, hundred: 2, thousand: 2, million: 2, billion: 2 };
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(ONES[h], "hundred");
  if (r && r < 20) out.push(ONES[r]);
  else if (r) out.push(TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : ""));
  return out.join(" ");
};
export const numberWords = (n) => {
  if (n === 1e9) return "one billion";
  const m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), u = n % 1000, out = [];
  if (m) out.push(three(m) + " million");
  if (k) out.push(three(k) + " thousand");
  if (u) out.push(three(u));
  return out.join(" ");
};
export const syllables = (n) => numberWords(n).split(/[\s-]+/).filter(Boolean).reduce((a, w) => a + SYL[w], 0);
export const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
