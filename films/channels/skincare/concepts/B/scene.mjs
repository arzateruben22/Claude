import * as THREE from "three";
// Look concept B, "macro cinema": a low drone over skin at golden hour. The terrain is the skin's microrelief (the fine
// diamond grid of furrows), pores as craters, fine hairs as trees. A seam runs away from the camera: left, ten years of
// daily sunscreen (model): the grid shallow and even. Right, ten years without (model): the furrows deeper, brown
// patches of sun-laid pigment. Shallow depth of field, warm rim light. A still for the owner's pick, not an episode.
import { createHud } from "cinema/sci/hud.js";
import { rng } from "cinema/film/runtime.js";

const FILM = window.FILM, W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.9, bloom: 0.3, exposure: 1.05 });
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x3a2a20, 55, 110);
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 300);
camera.position.set(0, 10.5, 33); camera.lookAt(0, 0, 4);
window.CINEMA_FOCUS = () => ({ point: [0, 0, 14], fstop: 0.5 })   // cocScale grows with fstop: 0.5 keeps the seam sharp, the horizon soft;   // focus on the seam a little ahead; the far skin goes soft

// light: a low warm sun behind and to the right (rim), a cool sky fill
scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2418, 0.55));
const sun = new THREE.DirectionalLight(0xffb870, 4.2); sun.position.set(30, 6, -30); scene.add(sun);
const key = new THREE.DirectionalLight(0xfff0e0, 0.9); key.position.set(-10, 14, 20); scene.add(key);

// the terrain
const R = rng(7), N = 360, S = 80;
const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v; };
const fbm = (x, y) => { let s = 0, a = 0.5; for (let k = 0; k < 4; k++) { s += a * vn(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
// pores (follicle craters) on a jittered grid
const pores = []; for (let gx = -S / 2; gx < S / 2; gx += 3.2) for (let gz = -S / 2; gz < S / 2; gz += 3.2) pores.push([gx + (R() - 0.5) * 2.2, gz + (R() - 0.5) * 2.2]);
const base = [0.58, 0.38, 0.26], spot = [0.13, 0.065, 0.04];
// sun-laid pigment spots (lentigines), round and blotchy: many on the unprotected half, a few on the protected one
const SPOTS = []; for (let k = 0; k < 70; k++) SPOTS.push([1.5 + R() * 34, -36 + R() * 60, 0.8 + R() * 1.8]); for (let k = 0; k < 9; k++) SPOTS.push([2 + R() * 7, 6 + R() * 22, 0.9 + R() * 1.3]); for (let k = 0; k < 6; k++) SPOTS.push([-1.5 - R() * 30, -36 + R() * 60, 0.6 + R() * 0.8]);   // one medium tone (bible: one tone per episode)
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  const right = 1 / (1 + Math.exp(-x * 1.4));                                   // the seam at x = 0
  // the diamond microrelief: two crossing families of furrows, deeper and wider without sunscreen
  const d1 = Math.abs(Math.sin((x + z) * 0.55 + 0.6 * fbm(x * 0.2, z * 0.2))), d2 = Math.abs(Math.sin((x - z) * 0.48 + 0.7 * fbm(x * 0.2 + 5, z * 0.2)));
  const furrow = Math.pow(1 - Math.min(d1, d2), 6);
  let y = 0.25 * fbm(x * 0.35, z * 0.35) - furrow * (0.2 + 1.1 * right);
  // pores: smooth craters
  for (const [px, pz] of pores) { const r2 = (x - px) ** 2 + (z - pz) ** 2; if (r2 < 1.2) y -= 0.55 * Math.exp(-r2 / 0.18); }
  pos.setY(i, y);
  // pigment patches (lentigines): sun-laid, mostly on the unprotected side
  let patch = 0; for (const [sx, sz, sr] of SPOTS) { const d2 = ((x - sx) ** 2 + (z - sz) ** 2) / (sr * sr); if (d2 < 2.5) patch = Math.max(patch, 1 / (1 + Math.exp((d2 - 1) * 6))); }
  const k = Math.min(1, patch), sheen = 1 - right;
  for (let c = 0; c < 3; c++) cols[3 * i + c] = (base[c] + (spot[c] - base[c]) * k) * (0.92 + 0.12 * fbm(x * 1.5, z * 1.5)) * (1 - 0.45 * furrow * (0.4 + 0.6 * right)) * (1.06 - 0.12 * right);
}
geo.setAttribute("color", new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, sheen: 0.12, sheenColor: new THREE.Color(0xffd2b0), sheenRoughness: 0.6, clearcoat: 0.0 });
const skin = new THREE.Mesh(geo, mat); scene.add(skin);
// the sunscreen side: a thin satin film (a clearcoat sheet just above the left half)
const filmGeo = new THREE.PlaneGeometry(S / 2, S, 1, 1); filmGeo.rotateX(-Math.PI / 2);
const film = new THREE.Mesh(filmGeo, new THREE.MeshPhysicalMaterial({ color: 0xfff4e8, transparent: true, opacity: 0.2, roughness: 0.1, clearcoat: 1, depthWrite: false }));
film.position.set(-S / 4, 0.32, 0); scene.add(film);
// hairs: fine, pale, leaning away from the sun, rising out of the pores
const hairGeo = new THREE.CylinderGeometry(0.018, 0.045, 1, 5, 1).translate(0, 0.5, 0);
const hairs = new THREE.InstancedMesh(hairGeo, new THREE.MeshStandardMaterial({ color: 0xc9a27e, roughness: 0.4 }), pores.length);
const dm = new THREE.Object3D();
pores.forEach(([px, pz], i) => { dm.position.set(px, -0.3, pz); dm.rotation.set(-0.5 - R() * 0.4, R() * 0.6 - 0.3, (R() - 0.5) * 0.5); dm.scale.set(1, 2.2 + R() * 2.2, 1); dm.updateMatrix(); hairs.setMatrixAt(i, dm.matrix); });
scene.add(hairs);
// the seam: a thin cool line along x = 0
const seam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, S), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.55 })); seam.position.y = 0.4; scene.add(seam);

// the overlay
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
const at = (p) => () => p;
hud.label("l-spf", { text: "daily sunscreen", glyph: "◆", mark: "none", color: "uv", at: at([-7, 0.4, 16]), t0: 0, t1: 9, side: -1, v: "above", fixed: true });
hud.label("l-none", { text: "none: deeper lines, spots", glyph: "◆", mark: "none", color: "text", at: at([6, 0.2, 0]), t0: 0, t1: 9, side: 1, v: "above", fixed: true });
hud.badge("b-model", { text: "model, not a photo · 1 mm of skin", t0: 0, t1: 9, slot: "tl" });
const c = hud.counter("c-yrs", { label: "same skin, two halves", t0: 0, t1: 9, at: [0.5, 0.215], value: () => 0, fmt: () => "10 years", lit: () => true });
Object.assign(c.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "2.4vmin", boxShadow: "var(--hud-shadow)" });

window.seek = function (t) {
  hud.update(t);
  renderer.render(scene, camera);
};
