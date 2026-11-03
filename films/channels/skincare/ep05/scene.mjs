import * as THREE from "three";
// Skin Sense No. 005, "The sunscreen experiment" (films/channels/skincare/ep05), in the approved look (look test 2,
// 2 Nov; s1v2/BUILD-LOOK2.md). The picture as a pure function of t: window.seek(t) sets the shot, the camera, every
// object and the overlay from t alone, then makes exactly one renderer.render(). Everything timed comes from
// film.json, which compile.py hangs on the voice. One tone (medium) for the whole film.
//
// Three hero places, far apart in one scene:
//   x = 0      the sunscreen macro (as looktest2): one patch of skin, two halves of the same relief clipped at the
//              seam: the left under a thin film of sunscreen, the right bare. The UV switch (a cyan scan line, DOM)
//              turns the screened half dark (it absorbs) and the bare half lilac, its hidden freckles dark (an
//              illustration, not trial data). Also the to-scale shot (the film, grazing) and the loop.
//   x = 500    the silicone cast of the skin's lines: grey, no hairs, raking light; the right half's lines deepen.
//   x = 1000   the dermis block, its cut face the stained micrograph (set/ref), dust in a shaft.
// The model hands (../set/hands05.js) and the town (../set/town05.js) are retired from this episode.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, createShaft, createGrain } from "../set/studio.js";
import { SECTION } from "../set/ref/textures.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, P = FILM.plates;
const MV = FILM.move, UVW = FILM.uv, MC = FILM.macro, RK = FILM.rack;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.9, bloom: 0.3, exposure: 1.0, maxCoc: 0.035 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 20000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
injectCss();
const R = rng(11);
const tone = toneColor("living", 0.5);   // bible §1: 005 is the medium tone (the ramp's middle)
const load = (uri, srgb = true) => new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = uri; });

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) ──
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const particles = (n, box, size, color) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); scene.add(p);
  return { p, set(t, op = 1) { p.visible = op > 0.002; if (!p.visible) return; m.opacity = 0.7 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.25 * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + 0.12 * (t % 40) + 0.2 * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + 0.2 * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};

// ── A: the sunscreen macro (x = 0) ──────────────────────────────────────────
const mkHalf = (keepLeft) => {
  const T = createTerrain({ seed: 21, spots: 90, half: "right", segs: 400 });
  const clip = [new THREE.Plane(new THREE.Vector3(keepLeft ? -1 : 1, 0, 0), 0)];
  const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: keepLeft ? 0.7 : 0.05, hydration: keepLeft ? 0.8 : 0.25, repeat: 14, seed: 6, micro: 0.35 });
  m.roughness = keepLeft ? 0.3 : 0.6; m.clippingPlanes = clip; T.mesh.material = m;
  T.group.traverse((o) => { if (o.isInstancedMesh) o.material = new THREE.MeshPhysicalMaterial({ color: 0x3a2618, roughness: 0.35, clearcoat: 0.6, clippingPlanes: clip }); if (o.isMesh && o !== T.mesh && !o.isInstancedMesh) o.visible = false; });
  scene.add(T.group); return { T, m };
};
const HL = mkHalf(true), HR = mkHalf(false);
// the morning layer, made visible for the to-scale shot: a satin film over the screened half only
const filmMat = new THREE.MeshPhysicalMaterial({ color: 0xf6fbff, transparent: true, opacity: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const filmMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 80, 1, 1).rotateX(-Math.PI / 2), filmMat); filmMesh.position.set(-20, 0.3, 0); filmMat.userData.envK = 0.25; scene.add(filmMesh);
// the damage the eye misses: freckles that show only under UV, on the bare half (an illustration, not data)
const dmgMat = new THREE.MeshBasicMaterial({ color: 0x1e0c4a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const dmg = new THREE.Group(); dmg.renderOrder = 1; scene.add(dmg);
for (let i = 0; i < 90; i++) { const r = 0.12 + R() * R() * 0.45, m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), dmgMat); m.rotation.x = -Math.PI / 2; m.position.set(0.4 + R() * 9, 0.42, -14 + R() * 20); m.scale.set(1, 0.7 + R() * 0.6, 1); dmg.add(m); }
// the seam between the halves: a fine pale line, so the two halves read from frame 0
const seamMat = new THREE.MeshBasicMaterial({ color: 0xfff3e6, transparent: true, opacity: 0, depthWrite: false });
const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 80).rotateX(-Math.PI / 2), seamMat); seam.position.set(0, 0.43, 0); scene.add(seam);
// the loop: missed mornings on the screened half (bare gaps; fewer hidden freckles there), sunscreen mornings on the bare half
const gapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: null, transparent: true, opacity: 0, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
const GAPS = [[-2.4, -1.2, 1.3], [-4.6, -5.5, 1.5], [-1.6, -8.5, 1.2], [-5.2, 0.8, 1.1]];
gapMat.alphaMap = dotTex;
const gaps = GAPS.map(([x, z, r]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), gapMat); m.scale.set(r, 1, r * 0.8); m.position.set(x, 0.44, z); m.renderOrder = 1; scene.add(m); return m; });
const dmgL = new THREE.Group(); dmgL.renderOrder = 2; scene.add(dmgL);
GAPS.forEach(([x, z, r]) => { for (let i = 0; i < 4; i++) { const a = R() * 6.28, d = R() * r * 0.7, m = new THREE.Mesh(new THREE.CircleGeometry(0.12 + R() * 0.2, 20).rotateX(-Math.PI / 2), dmgMat); m.position.set(x + d * Math.cos(a), 0.45, z + 0.8 * d * Math.sin(a)); dmgL.add(m); } });
for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.1 + R() * 0.15, 20).rotateX(-Math.PI / 2), dmgMat); m.position.set(-0.6 - R() * 7, 0.45, -12 + R() * 16); dmgL.add(m); }
// "whenever they pleased, or not at all": soft satin patches of sunscreen come and go on the bare half
const patches = Array.from({ length: 9 }, (_, i) => {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xf2d8c4, alphaMap: dotTex, transparent: true, opacity: 0, roughness: 0.08, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), mat);
  const r = 1.4 + R() * 1.6; m.scale.set(r, 1, r * (0.7 + R() * 0.5)); m.position.set(1.2 + R() * 6, 0.44, -6 + R() * 9); scene.add(m);
  m.renderOrder = 3;
  return { m, mat, ph: i / 9 };
});
const shaftA = createShaft({ from: [-10, 26, -20], to: [3, -1, 3], radius: 3.4, color: "#B79BFF" }); scene.add(shaftA.group);
const dustA = particles(260, [[-14, 0.3, -12], [14, 9, 8]], 0.09, "#F3E9FF");
const FOGA = new THREE.Fog(0x2c1660, 22, 60);

// ── K: the silicone cast of the skin's lines (x = 500) ───────────────────────
const XK = 500;
const K = createTerrain({ seed: 21, spots: 0, hair: false, segs: 360 });
K.group.position.x = XK; scene.add(K.group);
{ const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.05, hydration: 0.1, micro: 2.2, repeat: 7, seed: 4 });   // the fine crosshatch of skin lines, caught by the raking light
  m.sheen = 0.1; m.sheenColor.setRGB(0.85, 0.88, 0.95); m.roughness = 0.66; m.specularIntensity = 0.25; K.mesh.material = m; }
K.group.traverse((o) => { if (o.isMesh && o !== K.mesh) o.visible = false; });
const CASTC = [0.5, 0.52, 0.56];   // grey silicone
const shaftK = createShaft({ from: [XK - 14, 12, -6], to: [XK + 2, -1, 1], radius: 3.0, color: "#D9E4FF" }); scene.add(shaftK.group);
const dustK = particles(220, [[XK - 12, 0.3, -10], [XK + 12, 8, 8]], 0.08, "#EEF2FF");
const FOGK = new THREE.Fog(0x1b1430, 26, 70);

// ── B: the dermis block, its cut face the stained micrograph (x = 1000) ─────
const XB = 1000, Bk = new THREE.Group(); Bk.position.x = XB; scene.add(Bk);
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), faceMat); face.position.set(0, -5.25, 0); Bk.add(face);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.78, 0.5, 0.55), roughness: 0.55 });
const blockSide = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 6), [sideMat, sideMat, skinMaterial({ tone: tone.map((v) => v * 1.1), oil: 0.1, repeat: 3, seed: 9, micro: 0.5 }), sideMat, sideMat, sideMat]);
blockSide.position.set(0, -5.25, -3.01); Bk.add(blockSide);
const backB = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ color: 0x2c1660 })); backB.position.set(0, -4, -14); Bk.add(backB);
const shaftB = createShaft({ from: [-6, 18, -4], to: [1, -6, 1], radius: 2.8, color: "#C9B4FF" }); shaftB.group.position.x = XB; scene.add(shaftB.group);
const dustB = particles(320, [[XB - 9, -11, 0.5], [XB + 9, 6, 9]], 0.07, "#FFF2F8");

window.SCENE_READY = Promise.all([load(SECTION)]).then(([sec]) => { faceMat.map = sec; faceMat.needsUpdate = true; });

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const grain = createGrain(hudRoot, { amount: 0.006 });
const hud = createHud({ camera, shots: FILM.shots });
const labelAt = { L: [-2.2, 0.4, -1], R: [2.2, 0.4, -1] };   // a point on each half, set per shot in seek()
const KIND = { water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const roll = c.roll, el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: (t) => (roll ? roll[0] + (roll[1] - roll[0]) * E.inout2(seg(t, roll[2], roll[3])) : 0), fmt: (v) => (roll ? `${Math.round(v)}` : c.text), lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  const anchor = L.at ? { at: () => labelAt[L.at] } : { screen: () => [L.screen[0] * W, L.screen[1] * H] };
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: L.at ? "dot" : "none", color: k.color, ...anchor, t0: L.t0, t1: L.t1, side: L.side, v: L.at ? "above" : "middle", fixed: true });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.5, liftAt: [0.18, 0.3] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
for (const el of document.querySelectorAll(".ol-gauge rect")) if (el.getAttribute("fill") === "var(--slide-low)") el.setAttribute("fill", "#F3EEE4");   // the paper bar reads as paper
// the UV switch: a cyan line sweeping down the frame (looktest2)
const scan = document.createElement("div");
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#5FF2E8", boxShadow: "0 0 18px 4px rgba(95,242,232,.55)", opacity: "0", zIndex: 2, pointerEvents: "none" });
hudRoot.appendChild(scan);
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "2.4vmin",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
const O = P.odds, M = P.mel;
const odds = plate(`<div style="font:600 4.6vmin/1.25 var(--font-body, inherit)">${O.text}</div><div style="font:500 2.9vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:1vmin">${O.sub}</div>`,
  { left: "45.8%", top: `${0.36 * H}px`, transform: "translateX(-50%)", width: "64vmin", padding: "2.2vmin 3vmin" });
const dots = (n, c) => Array.from({ length: n }, () => `<i style="display:inline-block;width:1.3vmin;height:1.3vmin;border-radius:50%;margin:.15vmin;background:${c};opacity:0"></i>`).join("");
const mel = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin:0 0 1.4vmin">melanomas, ten years on</div>
  <div style="display:grid;grid-template-columns:21vmin 1fr;white-space:nowrap;align-items:center;gap:1.4vmin;font:600 3vmin/1.2 var(--font-body, inherit)"><span>daily</span><span class="d1">${dots(M.n[0], "var(--water)")}</span>
  <span>as they pleased</span><span class="d2">${dots(M.n[1], "var(--uv)")}</span></div>
  <div class="sub" style="opacity:0"><div style="font:600 3.6vmin/1.25 var(--font-body, inherit);color:var(--text);margin-top:1.8vmin">${M.note}</div>
  <div style="font:500 2.7vmin/1.35 var(--font-mono);color:var(--text-2);margin-top:0.8vmin">${M.sub}</div></div>`,
  { left: "45.8%", top: `${0.3 * H}px`, transform: "translateX(-50%)", width: "64vmin", padding: "2.4vmin 3vmin" });
const msub = mel.querySelector(".sub"), d1 = [...mel.querySelectorAll(".d1 i")], d2 = [...mel.querySelectorAll(".d2 i")];
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.max(0, Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d)));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));
const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); };
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const mixT = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const UVBARE = [0.62, 0.48, 1.0], UVSCREEN = [0.12, 0.08, 0.26], WARM = [0.66, 0.24, 0.17];
const MACRO = ["hook", "seam", "pleased", "uv", "film", "loop"];

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, mv = MV[shot], u = E.inout2(seg(t, mv[0], mv[1]));
  const isA = MACRO.includes(shot), isK = shot === "cast", isB = shot === "micro";
  HL.T.group.visible = HR.T.group.visible = isA; K.group.visible = isK; Bk.visible = isB;
  shaftA.set({ op: isA ? 1 : 0 }); shaftK.set({ op: isK ? 0.9 : 0 }); shaftB.set({ op: isB ? 1 : 0 });
  dustA.set(t, isA ? 1 : 0); dustK.set(t, isK ? 0.8 : 0); dustB.set(t, isB ? 1 : 0);
  scene.fog = isA ? FOGA : isK ? FOGK : null;

  // ── the macro: daylight, or the UV view under the scan ──
  let uv = 0, sw = -1;
  if (shot === "uv" || shot === "loop") { const w = UVW[shot]; sw = seg(t, w[0], w[1]); uv = E.in2(sw); }   // the view follows the line down, never ahead of it
  scan.style.top = `${(Math.max(0, sw) * H).toFixed(1)}px`; scan.style.opacity = sw > 0 && sw < 1 ? "1" : "0";
  if (isA) {
    const flush = shot === "uv" ? 0.6 * u01(t, MC.flush) * (1 - uv) : 0;
    const base = mixT(tone, WARM, flush);
    HR.T.set({ tone: mixT(base, UVBARE, uv), furrows: 0.35, spot: 0.1 + 0.9 * uv });
    HL.T.set({ tone: mixT(tone, UVSCREEN, uv), furrows: 0.35, spot: 0.1 * (1 - uv) });
    HR.m.emissive.setRGB(0.03 * uv, 0.02 * uv, 0.09 * uv); HL.m.emissive.setRGB(0, 0, 0);
    const dk = shot === "uv" ? u01(t, MC.dmg) : shot === "loop" ? uv : 0;
    dmgMat.opacity = 0.75 * dk * uv; dmg.visible = dmgMat.opacity > 0.01; dmgL.visible = shot === "loop" && dmg.visible;
    // the screened half reads glossy from frame 0 (a faint satin film); the film shot shows it fully
    filmMat.opacity = shot === "film" ? 0.2 * u01(t, MC.film) : 0.1 * (1 - uv); filmMesh.visible = filmMat.opacity > 0.005;
    seamMat.opacity = shot === "film" ? 0.25 : 0.6 - 0.35 * uv; seam.visible = true;
    const mixed = shot === "loop" ? u01(t, MC.mixed) : 0;   // "Both groups missed mornings": gaps in the screen, sunscreen on the bare half
    gapMat.opacity = 0.95 * mixed; gaps.forEach((m) => (m.visible = mixed > 0.005));
    gapMat.color.setRGB(...mixT(tone.map((v) => v * 0.95), UVBARE, uv)); gapMat.emissive.setRGB(0.03 * uv, 0.02 * uv, 0.09 * uv);
    patches.forEach(({ m, mat, ph }) => {   // each patch: on for a while, then gone; never all at once (in the loop: on from "Both")
      const [a, b] = MC.patches, s0 = a + ph * (b - a) * 0.8, op = shot === "pleased" ? win(t, s0, s0 + 1.6 + 0.8 * ((ph * 7) % 1), 0.4) : mixed;
      mat.opacity = (0.55 + 0.35 * uv) * op; m.visible = op > 0.005;
      mat.color.setRGB(...mixT([1, 0.97, 0.93], UVSCREEN, uv));
    });
    studio.set({ key: 1.4 * (1 - 0.6 * uv), rim: 2.2, fill: 0.3, env: 0.4, warm: 0.5 * (1 - uv) + 0.3 * flush });
  } else { dmg.visible = dmgL.visible = false; filmMesh.visible = seam.visible = false; patches.forEach(({ m }) => (m.visible = false)); gaps.forEach((m) => (m.visible = false)); }

  if (shot === "hook" || shot === "loop") {   // the hook (and its loop): one slow push over the seam
    const uu = shot === "loop" ? 0.1 + 0.6 * u : u;
    look(mix3([0.6, 7.6, 21], [0.15, 2.6, 6.6], uu), mix3([0, 0, 0], [0.3, -0.2, -2.5], uu));   // a push you can see
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    const rk = shot === "hook" ? u01(t, RK.hook) : 1;   // rack on "aged": the dust near the lens, then the seam
    const near = camera.position.toArray().map((v, i) => v + [-0.2, -1.6, -4.5][i]);
    focusPt = mix3(near, mix3([0, 0, 0], [0.3, 0, -2.5], uu), rk); fstop = 0.22 + 0.12 * (1 - rk);
    labelAt.L = [-2.4, 0.4, -1.5]; labelAt.R = [2.4, 0.4, -1.5];
  } else if (shot === "seam") {   // a long crane down and along the seam, into the light
    look(mix3([-5.5, 9.5, 17], [1.8, 3.4, 8.5], u), mix3([-0.5, 0, -1], [0.3, -0.2, -4], u));
    labelAt.L = [-2.6, 0.4, -3]; labelAt.R = [2.6, 0.4, -3];
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([0, 0, 2], [0.3, 0, -1.5], u); fstop = 0.2;
  } else if (shot === "pleased") {   // close over the bare half, the seam at the left third
    look(mix3([1.6, 3.8, 9.4], [1.2, 2.9, 6.4], u), mix3([0.6, 0, -1], [0.7, -0.1, -3], u));   // the seam at the left third
    labelAt.L = [-1.3, 0.4, -2.2]; labelAt.R = [2.4, 0.4, -2.2];
    studio.aim([2, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([1.4, 0.2, 2.0], [1.2, 0.2, -0.2], u); fstop = 0.16;
  } else if (shot === "uv") {   // as looktest2: one slow push over the seam; the switch on "But"
    look(mix3([0.6, 5.6, 16], [0.2, 3.0, 7.5], u), mix3([0, 0, 0.5], [0.4, -0.2, -2.5], u));
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([0, 0, 2], [0.4, 0, -1.5], u); fstop = 0.22;
  } else if (shot === "film") {   // grazing over the screened half: the film catches the light
    look(mix3([-6.0, 2.7, 9.5], [-4.4, 2.0, 6.4], u), mix3([-1.6, -0.2, -3], [-1.2, -0.2, -4.5], u));
    studio.aim([-2, 0, -2], [-0.6, 0.7, 0.4], [0.5, 0.3, -0.85]); studio.set({ key: 1.1, rim: 1.2, fill: 0.35, env: 0.3, warm: 0.4 });
    focusPt = mix3([-3.4, 0.3, 1.4], [-2.6, 0.3, -0.6], u); fstop = 0.2;
  }

  // ── the cast: grey silicone, raking light; the right half's lines deepen over the shot ──
  if (isK) {
    const age = u01(t, MC.age), fq = Math.round((0.5 + 1.0 * age) * 40) / 40;   // quantized: the relief rebuilds only when it visibly changes
    K.set({ tone: CASTC, furrows: fq, spot: 0, sheen: 0 });
    look(mix3([XK - 1.6, 4.6, 8.6], [XK + 0.4, 3.2, 5.4], u), mix3([XK - 0.6, -0.2, -1.5], [XK + 0.3, -0.3, -3.2], u));
    studio.aim([XK, 0, 0], [-0.95, 0.16, -0.25], [0.6, 0.35, -0.75]); studio.set({ key: 3.2, rim: 1.4, fill: 0.12, env: 0.25, warm: 0.0 });
    focusPt = mix3([XK - 0.2, 0, 1.0], [XK + 0.4, 0, -1.2], u); fstop = 0.08;
  }

  // ── the micrograph: a slow push and drift into the collagen ──
  if (isB) {
    look(mix3([XB - 2.4, 0.5, 17.5], [XB + 2.2, -2.9, 8.6], u), mix3([XB - 0.6, -4.6, 0], [XB + 2.4, -4.7, 0], u));   // drifts up and right: the naevus nest (lower left of the section) stays off centre
    studio.aim([XB, -4, 0], [-0.45, 0.8, 0.55], [0.55, 0.35, -0.85]); studio.set({ key: 1.6, rim: 2.6, fill: 0.45, env: 0.5, warm: 0.2 });
    const rk = u01(t, RK.micro);   // rack: the dust in front, then the cut face
    focusPt = mix3([XB - 0.4, -2.6, 6.5], [XB + 1.8, -4.4, 0], rk); fstop = 0.18;
  }

  // ── plates ──
  show(odds, shot === "cast" ? win(t, O.t0, O.t1) : 0);
  show(mel, shot === "micro" ? win(t, M.t0, M.t1) : 0);
  d1.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d1.length) * (M.half - M.mel), 0.15).toFixed(3); });
  d2.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d2.length) * (M.half - M.mel), 0.15).toFixed(3); });
  msub.style.opacity = fadeIn(t, M.small - 0.2, 0.4).toFixed(3);

  // ── to scale: the test dose's film beside the paper ──
  const lift = shot === "film" ? Math.min(u01(t, G.rise), 1 - u01(t, G.back)) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: G.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  veil.style.opacity = (0.75 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard))).toFixed(4);
  grain.set(t);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
