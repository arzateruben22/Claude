import * as THREE from "three";
// Outer Layer look test 2 (films/channels/skincare/looktest2): fewer, bolder hero shots with long, slow moves; real
// reference maps (set/ref: public domain / CC0); particles, dust in the shafts, haze between depth layers.
//   0–5 s    the sunscreen macro: one patch of skin, the left half under a thin film of sunscreen, the right bare, the
//            same light; then the UV camera switches on: the screened half goes dark (it absorbs), the bare half glows
//            with the damage the eye misses. One slow push over the seam.
//   5–10 s   the dermis: a block of skin cut open, its face the real stained micrograph (collagen bundles, cells,
//            vessels) under the skin's surface; a shaft with dust motes; one slow push and drift.
//   10–14 s  one white cell filling the frame, translucent, nucleus glowing, drifting through haze with the stained
//            tissue soft behind it; rack focus from the floating particles to the cell.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createTerrain } from "../set/terrain.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, cellMaterial, nucleusMaterial, createShaft, createGrain } from "../set/studio.js";
import { SECTION, DERMIS, CELL } from "../set/ref/textures.js";

const W = window.W, H = window.H;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.9, bloom: 0.3, exposure: 1.0, maxCoc: 0.035 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 20000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const R = rng(11);
const tone = toneColor("living", 0.5);
const load = (uri, srgb = true) => new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = uri; });

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) and haze cards ──
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const particles = (n, box, size, color) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); scene.add(p);
  return { p, set(t, op = 1) { p.visible = op > 0.002; m.opacity = 0.7 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.25 * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + 0.12 * t + 0.2 * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + 0.2 * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};
const haze = (w, h, pos, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false })); m.position.set(...pos); scene.add(m); return m; };

// ── A: the sunscreen macro ────────────────────────────────────────────────
renderer.localClippingEnabled = true;
// one patch, two halves of the same skin (same seed, same light), clipped at the seam: left under sunscreen, right bare
const mkHalf = (keepLeft) => {
  const T = createTerrain({ seed: 21, spots: 90, half: "right", segs: 400 });
  const clip = [new THREE.Plane(new THREE.Vector3(keepLeft ? -1 : 1, 0, 0), 0)];
  const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: keepLeft ? 0.7 : 0.05, hydration: keepLeft ? 0.8 : 0.25, repeat: 14, seed: 6, micro: 0.35 });
  m.roughness = keepLeft ? 0.3 : 0.6; m.clippingPlanes = clip; T.mesh.material = m;
  T.group.traverse((o) => { if (o.isInstancedMesh) o.material = new THREE.MeshPhysicalMaterial({ color: 0x3a2618, roughness: 0.35, clearcoat: 0.6, clippingPlanes: clip }); if (o.isMesh && o !== T.mesh && !o.isInstancedMesh) o.visible = false; });
  scene.add(T.group); return { T, m };
};
const HL = mkHalf(true), HR = mkHalf(false);
// the damage the eye misses: freckles that show only under UV, on the bare half (an illustration, not data)
const dmgMat = new THREE.MeshBasicMaterial({ color: 0x1e0c4a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const dmg = new THREE.Group(); scene.add(dmg);
for (let i = 0; i < 90; i++) { const r = 0.12 + R() * R() * 0.45, m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), dmgMat); m.rotation.x = -Math.PI / 2; m.position.set(0.4 + R() * 9, 0.42, -14 + R() * 20); m.scale.set(1, 0.7 + R() * 0.6, 1); dmg.add(m); }
const terrain = { group: { set visible(v) { HL.T.group.visible = HR.T.group.visible = v; } } };
const shaftA = createShaft({ from: [-10, 26, -20], to: [3, -1, 3], radius: 3.4, color: "#B79BFF" }); scene.add(shaftA.group);
const dustA = particles(260, [[-14, 0.3, -12], [14, 9, 8]], 0.09, "#F3E9FF");

// ── B: the dermis block, its cut face the stained micrograph ──────────────
const XB = 500, B = new THREE.Group(); B.position.x = XB; scene.add(B);
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), faceMat); face.position.set(0, -5.25, 0); B.add(face);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.78, 0.5, 0.55), roughness: 0.55 });
const blockSide = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 6), [sideMat, sideMat, skinMaterial({ tone: tone.map((v) => v * 1.1), oil: 0.1, repeat: 3, seed: 9, micro: 0.5 }), sideMat, sideMat, sideMat]);
blockSide.position.set(0, -5.25, -3.01); B.add(blockSide);
const shaftB = createShaft({ from: [-6, 18, -4], to: [1, -6, 1], radius: 2.8, color: "#C9B4FF" }); shaftB.group.position.x = XB; scene.add(shaftB.group);
const dustB = particles(320, [[XB - 9, -11, 0.5], [XB + 9, 6, 9]], 0.07, "#FFF2F8");

// ── C: one white cell in haze, the stained tissue soft behind ─────────────
const XC = 1000;
const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); back.position.set(XC, 0, -18); scene.add(back);
const hz1 = haze(60, 40, [XC, 0, -10], "#2C1660", 0.35), hz2 = haze(60, 40, [XC, 0, -4], "#3A2178", 0.18);
const cellMat = cellMaterial({ tint: [0.9, 0.88, 0.98], opacity: 0.92 }); cellMat.transmission = 0.3; cellMat.roughness = 0.5; cellMat.clearcoat = 0.3;
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vn3 = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w); };
const cellGeo = new THREE.SphereGeometry(2.4, 160, 120);
{ const p = cellGeo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const r = 0.06 * vn3(n.x * 3.1, n.y * 3.1, n.z * 3.1) + 0.03 * vn3(n.x * 7.3 + 5, n.y * 7.3, n.z * 7.3) + 0.012 * vn3(n.x * 17 + 9, n.y * 17, n.z * 17) - 0.05;   // irregular membrane ruffles   // membrane ruffles, as in a micrograph of a white cell
    v.addScaledVector(n, r * 2.4); p.setXYZ(i, v.x, v.y, v.z); } cellGeo.computeVertexNormals(); }
const cell = new THREE.Mesh(cellGeo, cellMat); cell.position.set(XC, 0, 0); scene.add(cell);
const nuc = new THREE.Group(); [[-0.5, 0.25, 0.1, 0.85], [0.45, 0.4, -0.1, 0.75], [0.1, -0.5, 0.2, 0.8]].forEach(([x, y, z, r]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), nucleusMaterial({ color: "#B79BFF", k: 0.9 })); m.position.set(x, y, z); nuc.add(m); });
nuc.position.set(XC, 0, 0); scene.add(nuc);
const granules = particles(140, [[XC - 1.7, -1.7, -1.7], [XC + 1.7, 1.7, 1.7]], 0.12, "#5FF2E8");
const dustC = particles(360, [[XC - 12, -14, -6], [XC + 12, 10, 10]], 0.1, "#E9DEFF");
const shaftC = createShaft({ from: [XC - 8, 20, -6], to: [XC + 2, -6, 0], radius: 4, color: "#B79BFF" }); scene.add(shaftC.group);

// ── finish ───────────────────────────────────────────────────────────────
const hud = document.getElementById("hud");
const grain = createGrain(hud, { amount: 0.02 });
const scan = document.createElement("div");   // the UV switch: a cyan line sweeping down the frame
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#5FF2E8", boxShadow: "0 0 18px 4px rgba(95,242,232,.55)", opacity: "0", zIndex: 2 });
hud.appendChild(scan);
const tag = (text, color) => { const d = document.createElement("div"); d.textContent = text; Object.assign(d.style, { position: "absolute", fontFamily: "var(--font-mono)", fontSize: "2.6vmin", letterSpacing: ".12em", textTransform: "uppercase", color, opacity: "0", zIndex: 3 }); hud.appendChild(d); return d; };
const tL = tag("sunscreen", "var(--text)"), tR = tag("bare skin", "var(--text)"), tB = tag("micrograph · stained skin", "var(--text-2)");
Object.assign(tL.style, { left: `${0.12 * W}px`, top: `${0.7 * H}px` }); Object.assign(tR.style, { right: `${0.12 * W}px`, top: `${0.7 * H}px` }); Object.assign(tB.style, { left: `${0.1 * W}px`, top: `${0.12 * H}px` });

window.SCENE_READY = Promise.all([load(SECTION), load(DERMIS), load(CELL, false)]).then(([sec, der, cel]) => {
  faceMat.map = sec; faceMat.needsUpdate = true;
  back.material.map = der; back.material.needsUpdate = true;
  cellMat.bumpMap = cel; cellMat.bumpScale = 1.5; cellMat.needsUpdate = true;
});

const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); };
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const FOGA = new THREE.Fog(0x2c1660, 22, 60);

window.seek = function (t) {
  const shot = stage(t).name;
  terrain.group.visible = shot === "screen"; dmg.visible = shot === "screen"; B.visible = shot === "dermis"; [cell, nuc, back, hz1, hz2].forEach((o) => (o.visible = shot === "cell"));
  shaftA.set({ op: shot === "screen" ? 1 : 0 }); shaftB.set({ op: shot === "dermis" ? 1 : 0 }); shaftC.set({ op: shot === "cell" ? 0.8 : 0 });
  dustA.set(t, shot === "screen" ? 1 : 0); dustB.set(t, shot === "dermis" ? 1 : 0); dustC.set(t, shot === "cell" ? 1 : 0); granules.set(t * 0.3, shot === "cell" ? 0.8 : 0);
  scene.fog = shot === "screen" ? FOGA : null;
  let uv = 0;
  if (shot === "screen") {
    const u = E.inout2(seg(t, 0, 5));
    look(mix3([0.5, 5.2, 15], [0.2, 3.0, 7.5], u), mix3([0, 0, 0], [0.4, -0.2, -2.5], u));   // one slow push over the seam
    uv = E.inout2(seg(t, 2.2, 3.0));
    const sw = seg(t, 2.1, 2.9); scan.style.top = `${(sw * H).toFixed(1)}px`; scan.style.opacity = sw > 0 && sw < 1 ? "1" : "0";
    // daylight → UV: the bare half glows lilac with its hidden damage dark; the screened half goes dark (it absorbs UV)
    // under UV the bare half glows lilac with its hidden damage dark; the screened half goes dark (it absorbs)
    HR.T.set({ tone: tone.map((v, i) => v * (1 - uv) + [0.62, 0.48, 1.0][i] * uv), furrows: 0.35, spot: 0.1 + 0.9 * uv });
    HL.T.set({ tone: tone.map((v, i) => v * (1 - uv) + [0.12, 0.08, 0.26][i] * uv), furrows: 0.35, spot: 0.1 * (1 - uv) });
    HR.m.emissive.setRGB(0.03 * uv, 0.02 * uv, 0.09 * uv); dmgMat.opacity = 0.7 * E.inout2(seg(t, 2.6, 3.4)); HL.m.emissive.setRGB(0, 0, 0);
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]); studio.set({ key: 1.4 * (1 - 0.6 * uv), rim: 2.2, fill: 0.3, env: 0.4, warm: 0.5 * (1 - uv) });
    focusPt = mix3([0, 0, 2], [0.4, 0, -1.5], u); fstop = 0.22;
    tL.style.opacity = tR.style.opacity = E.out3(seg(t, 3.0, 3.6)).toFixed(3);
  } else { tL.style.opacity = tR.style.opacity = "0"; scan.style.opacity = "0"; }
  if (shot === "dermis") {
    const u = E.inout2(seg(t, 5, 10));
    look(mix3([XB - 3, 0.5, 17], [XB + 0.5, -3.5, 9.5], u), mix3([XB - 1, -4.8, 0], [XB + 0.8, -5.6, 0], u));   // a slow push and drift into the collagen
    studio.aim([XB, -4, 0], [-0.45, 0.8, 0.55], [0.55, 0.35, -0.85]); studio.set({ key: 1.6, rim: 2.6, fill: 0.45, env: 0.5, warm: 0.2 });
    focusPt = [XB + 0.6, -4.2, 0]; fstop = 0.18;
    tB.style.opacity = (E.out3(seg(t, 5.6, 6.2)) * (1 - E.out3(seg(t, 9.4, 9.9)))).toFixed(3);
  } else tB.style.opacity = "0";
  if (shot === "cell") {
    const u = E.inout2(seg(t, 10, 14));
    look(mix3([XC + 2.5, 1.2, 16], [XC + 0.6, 0.3, 10.5], u), [XC, 0, 0]);   // one slow push onto the cell
    cell.rotation.set(0.1 * t, 0.25 * t, 0); nuc.rotation.set(0, 0.18 * t, 0.05 * t); cell.position.y = nuc.position.y = 0.15 * Math.sin(t * 0.7);
    studio.aim([XC, 0, 0], [-0.5, 0.8, 0.6], [0.6, 0.4, -0.8]); studio.set({ key: 1.3, rim: 3.4, fill: 0.4, env: 0.7, warm: 0.0 });
    const rk = E.inout2(seg(t, 10.6, 12.2)); focusPt = mix3([XC + 1.2, 0.5, 5.5], [XC, 0, 2.2], rk); fstop = 0.3;   // rack: the particles, then the cell
  }
  grain.set(t);
  renderer.render(scene, camera);
};
