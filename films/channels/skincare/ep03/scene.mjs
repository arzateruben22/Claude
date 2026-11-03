import * as THREE from "three";
// Skin Sense No. 003 (reboot), "What's in a scar" (films/channels/skincare/ep03). The picture as a pure function of
// t (window.seek). Places (compile.py): the macro terrain with an old scar across it (golden hour, deep tone); the
// dermis in section, its collagen woven over and under (a tug each way), cut, and patched with parallel threads (lit
// cyan) while follicles and glands stay out; a strength meter that stalls near 80%; fetal skin whose cut regrows the
// weave, follicles and all; the gauge (the top layer ≈ a sheet of paper); and the UV camera on the scar's seam.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, injectCss } from "../set/motif.js";
import { createUVSkin, createViewfinder, createDaylight } from "../set/uvcam.js";
import { createTerrain, goldenHour } from "../set/terrain.js";
import { createWeave } from "../set/weave03.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, strandMaterial, cellMaterial, createGrain } from "../set/studio.js";
import { DERMIS } from "../set/ref/textures.js";
import { hazeVolume, richen, bokeh } from "../set/prod.js";
import { lookV3 } from "../set/look3.js";
import { unifyHud } from "../set/hudv2.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, K = FILM.keys, G = FILM.gauge, PL = FILM.place, FPS = FILM.fps || 30;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.88, bloom: 0.34, exposure: 1.0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 30000);
injectCss();
const lights = goldenHour(scene);
const studio = createStudio(renderer, scene, {});   // the studio look: softbox environment, three-point rig
const FOG = scene.fog; scene.fog = null;
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const tone = FILM.tone, SKIN = toneColor("living", tone);

// ── the set ─────────────────────────────────────────────────────────────────
const terrain = createTerrain({ seed: 17, spots: 0, segs: 400, organic: true }); terrain.group.position.x = PL.tx; scene.add(terrain.group);
{ const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.08, hydration: 0.3, repeat: 14, seed: 9, micro: 0.35 }); m.roughness = 0.58; terrain.mesh.material = m;
  terrain.group.traverse((o) => { if (o.isInstancedMesh) { o.material = strandMaterial({ tint: [0.3, 0.18, 0.12], gloss: 0.5 }); o.material.transmission = 0; } }); }
const SCAR = [0.5, 1.6];
const EPI = 100;
const mkBlock = (x, scale) => {
  const g = new THREE.Group(); g.position.x = x; g.scale.setScalar(scale);
  const weave = createWeave({ w: 600, h: 260, d: 300, seed: 31 + x, irregular: true });
  weave.group.position.y = -EPI; g.add(weave.group);
  weave.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.5; o.material.roughness = Math.min(o.material.roughness, 0.42); } });   // a little studio sheen on the threads
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1500, 900), new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0x4a3040 })); back.position.set(0, -EPI - 130, -420); g.add(back);   // the micrograph behind the section
  const epiMat = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.94 });
  const epi = new THREE.Mesh(new THREE.BoxGeometry(600, EPI, 300), epiMat); epi.position.y = -EPI / 2; g.add(epi); epiMat.userData.mesh = epi;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(600, 12, 300), new THREE.MeshStandardMaterial({ roughness: 0.8 })); floor.position.y = -EPI - 266; g.add(floor);
  scene.add(g);
  return { g, weave, epiMat, floor, back };
};
const MUCOSA = new THREE.Color(0.86, 0.42, 0.46);   // mouth lining: pinker, wetter
const FS = 0.62;   // fetal skin: a smaller block
const adult = mkBlock(PL.wx, 1), fetal = mkBlock(PL.fx, FS);
// adult mouth lining: no hair follicles, a cut that closes nearly seamlessly (an illustration)
const mouth = mkBlock(PL.mx, FS);
// the mouse study (Martin et al., 2003), stacked: with germ-fighting cells, a patch; without them, the weave regrown
const MSC = 0.3, miceA = mkBlock(PL.mox, MSC), miceB = mkBlock(PL.mox, MSC);
miceA.g.position.x = PL.mox - 112; miceB.g.position.x = PL.mox + 112;   // side by side, filling the panel
 miceA.back.visible = miceB.back.visible = false;   // no backing cards: the two blocks sit in the volume
const immA = new THREE.Group(); miceA.g.add(immA);
const immAMat = cellMaterial({ tint: [0.86, 0.92, 1.0], opacity: 0.9 }); immAMat.transmission = 0;
const IMMA = Array.from({ length: 26 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + 3 * ((i * 7) % 5) / 4, 2), immAMat); immA.add(m);
  return { m, x: ((i * 37) % 13 - 6) * 10, y: -110 - ((i * 11) % 7) * 12, z: ((i * 23) % 17 - 8) * 16, ph: i * 0.7 }; });
const uv = createUVSkin({ seed: 7.0 }); uv.mesh.rotation.x = -0.18; scene.add(uv.mesh);
// the defence: germ-fighting cells gathering at the seam (the mouse study, a model)
const imm = new THREE.Group(); uv.mesh.add(imm);
const immMat = cellMaterial({ tint: [0.86, 0.9, 1.0], opacity: 0.8 }); immMat.transmission = 0;
const IMM = Array.from({ length: 22 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075 + 0.03 * ((i * 7) % 5) / 4, 2), immMat); imm.add(m); const a = i * 2.39996, r = 1.4 + 0.9 * ((i * 13) % 7) / 7; return { m, a, r, v: ((i * 5) % 11) / 11 - 0.5 }; });
// production pass: fibre surfaces on every weave, a graded volume behind the sets, haze, far bokeh, one grade
for (const b of [adult, fetal, mouth, miceA, miceB]) richen(b.weave.group, { seed: 31, jitter: 0, hue: 0, micro: 0.7 });
// collagen as fibre bundles: the micro surface stretched along each strand (fibrils), a satin roughness
for (const b of [adult, fetal, mouth, miceA, miceB]) b.weave.group.traverse((o) => { if (o.isMesh && o.material && o.material.normalMap && !o.material.userData.fibre) {
  o.material.normalMap = o.material.normalMap.clone(); o.material.normalMap.repeat.set(2, 18); o.material.normalMap.needsUpdate = true; o.material.normalScale.set(0.6, 0.6); o.material.roughness = 0.42; o.material.envMapIntensity = 0.9; o.material.userData.fibre = true; } });
// round 9: the fibrils as lengthwise grooves you can see at draft size (a stripe map, not only a normal map), a warm
// rim on the silhouettes that face the camera, and the slab's bottom fading into the volume instead of a dark floor
const fibrilTex = (() => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 256; const x = cv.getContext("2d"), R = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 11; i++) { const y = (i + 0.2 + 0.6 * R()) * 256 / 11, w = 3 + R() * 6, a = 0.28 + 0.3 * R(); x.fillStyle = `rgba(70,50,40,${a})`; x.fillRect(0, y - w / 2, 64, w); x.fillStyle = `rgba(255,250,240,0.5)`; x.fillRect(0, y + w / 2, 64, 1.5); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
const finishBlock = (b) => {
  const fade = { y0: { value: -1e9 }, y1: { value: -1e9 + 1 } }; b.fade = fade; b.floor.visible = false;
  const mats = new Set(); b.weave.group.traverse((o) => { if (o.isMesh && o.material) mats.add(o.material); });
  for (const m of mats) {
    if (m.normalMap && m.userData.fibre) { m.map = fibrilTex; m.bumpMap = null; m.normalScale.set(1.1, 1.1); }
    m.transparent = true; const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { prev && prev(sh, r); sh.uniforms.uY0 = fade.y0; sh.uniforms.uY1 = fade.y1;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform float uY0; uniform float uY1;")
        .replace("#include <dithering_fragment>", `#include <dithering_fragment>
  { vec3 n = normalize(vNormal); float rim = pow(1.0 - abs(dot(n, normalize(vViewPosition))), 2.6) * (0.55 + 0.45 * clamp(n.y + 0.3, 0.0, 1.0));
    gl_FragColor.rgb += vec3(1.0, 0.66, 0.38) * 0.42 * rim;
    float fa = smoothstep(uY0, uY1, vWP.y); gl_FragColor.rgb = mix(vec3(0.03, 0.02, 0.06), gl_FragColor.rgb, fa); gl_FragColor.a *= fa; }`); };
    m.customProgramCacheKey = () => "ep03fin" + (m.normalMap ? 1 : 0) + (m.map ? 1 : 0);
    m.needsUpdate = true;
  }
};
const fadeAt = (b) => { b.g.updateMatrixWorld(); const v = new THREE.Vector3(0, -EPI - 268, 0); b.g.localToWorld(v); const y0 = v.y; v.set(0, -EPI - 150, 0); b.g.localToWorld(v); b.fade.y0.value = y0; b.fade.y1.value = v.y; };
for (const b of [adult, fetal, mouth, miceA, miceB]) finishBlock(b);
const hz = hazeVolume(scene, { at: [PL.wx, -120, -80], size: [1600, 900, 300], color: "#c9b6ff", n: 5, op: 0.045 });
const bk = bokeh(scene, { n: 140, box: [[PL.wx - 1400, PL.wx + 1400], [-700, 500], [-1600, -700]], size: 70, color: "#d9ccff", op: 0.3 });
// the rope (whoa): "only as strong as a rope missing one strand in five": five twisted strands, one slipping away
const rope = new THREE.Group(); rope.position.set(PL.wx, -10, 300); scene.add(rope);
const ropeMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.93, 0.86, 0.76), roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(1, 0.95, 0.9), clearcoat: 0.2 });
const ropeLost = ropeMat.clone();
const STRANDS = [0, 1, 2, 3, 4].map((i) => {
  const pts = []; for (let k = 0; k <= 120; k++) { const u = k / 120, a = u * Math.PI * 2 * 3.2 + i * Math.PI * 2 / 5; pts.push(new THREE.Vector3(-185 + 370 * u, 15 * Math.sin(a), 15 * Math.cos(a))); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 7.5, 10), i === 2 ? ropeLost : ropeMat); rope.add(m); return m; });
richen(rope, { seed: 7, jitter: 0, hue: 0, micro: 0.8 });
// the scar band (look v3): a satiny seam with faint lengthwise striations and a raised edge against the furrowed skin,
// carved once into the terrain after its own compute (it recomputes only when its settings change; ours are fixed)
let scarDone = null;
const scarDetail = () => {
  const geo = terrain.mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
  if (scarDone === pos.array) return;   // done for this compute
  const [z0, hw] = SCAR;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.abs(z - z0), sk = 1 - Math.min(1, Math.max(0, (d - hw * 0.8) / (hw * 0.3)));
    const edge = Math.exp(-((d - hw * 0.92) ** 2) / (2 * (hw * 0.08) ** 2));
    const stri = Math.sin((z - z0) * 26 + 0.6 * Math.sin(x * 0.7)) * 0.5 + 0.5;
    const outer = Math.exp(-((d - hw * 1.05) ** 2) / (2 * (hw * 0.07) ** 2));   // the furrowed skin dips just outside the raised edge (its shadow)
    pos.setY(i, pos.getY(i) + 0.085 * edge - 0.03 * outer + 0.028 * stri * sk);
    if (col && sk > 0) for (let c = 0; c < 3; c++) col.array[3 * i + c] *= (1 - 0.06 * sk + 0.12 * sk * (stri - 0.5) - 0.18 * outer) * (c === 0 ? 1 + 0.03 * sk : 1 - 0.02 * sk);   // satin: a touch rosier, striped faintly
  }
  pos.needsUpdate = true; if (col) col.needsUpdate = true; geo.computeVertexNormals(); scarDone = pos.array;
};
const rig = createRig(FILM.cam);
const uvAt = (u, v) => { const p = new THREE.Vector3(...uv.at(u, v)); uv.mesh.updateMatrixWorld(); return uv.mesh.localToWorld(p).toArray(); };

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const look = lookV3({ canvas, hudRoot, fog: FOG, terrain, skin: terrain.mesh.material }); unifyHud(hudRoot);   // the channel look: skin, hairs, fog, grade
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.285, w: 0.8, h: 0.3 });
vf.el.style.setProperty("--ol-rec-size", "3.3vmin"); vf.el.style.setProperty("--ol-rec-weight", "600");
const day = createDaylight({ root: hudRoot, W, H, y: 0.7, label: "daylight" }); day.el.style.fontSize = "2.6vmin";
const grain = look.grain;
// atmosphere: dust the depth of field turns to bokeh
const SR = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const dotTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const dustN = 260, dustPos = new Float32Array(dustN * 3), dustBase = Array.from({ length: dustN }, () => [SR() - 0.5, SR() - 0.5, SR() - 0.5, SR() * 6.28]);
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ map: dotTex, color: 0xf0e8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
const placeDust = (t, c, size, pt) => { dust.visible = true; dustMat.size = pt; dustBase.forEach(([x, y, z, ph], i) => { dustPos[3 * i] = c[0] + x * size[0] + 0.03 * size[0] * Math.sin(t * 0.3 + ph); dustPos[3 * i + 1] = c[1] + y * size[1] + 0.02 * size[1] * Math.sin(t * 0.21 + ph); dustPos[3 * i + 2] = c[2] + z * size[2]; }); dustGeo.attributes.position.needsUpdate = true; };
window.SCENE_READY = new Promise((res) => { const img = new Image(); img.onload = () => { const tx = new THREE.Texture(img); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1, 1); tx.needsUpdate = true;
  for (const b of [adult]) { b.back.material.map = tx; b.back.material.color.setRGB(0.38, 0.3, 0.4); b.back.material.needsUpdate = true; } res(); }; img.onerror = () => res(); img.src = DERMIS; });
// the micrograph behind the weave is a real photo: said so, under the captions, while it shows
const photoNote = document.createElement("div"); photoNote.textContent = "behind: a tissue photo (normal skin)";
Object.assign(photoNote.style, { position: "absolute", left: "50%", top: `${0.285 * H}px`, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: "2.9vmin", letterSpacing: ".03em", textTransform: "none",
  color: "var(--text)", background: "var(--hud-plate)", padding: ".5vmin 1.4vmin", borderRadius: "1vmin", whiteSpace: "nowrap", zIndex: 3, opacity: "0", pointerEvents: "none" });
hudRoot.appendChild(photoNote);
const dip = document.createElement("div");
Object.assign(dip.style, { position: "absolute", inset: "0", background: "var(--bg, #2C1660)", opacity: "0", zIndex: 1, pointerEvents: "none" });
hudRoot.appendChild(dip);
// the strength meter (why): unwounded = 100 %; the scar's bar climbs over weeks and months and stalls near 80 %
const meter = document.createElement("div");
meter.innerHTML = `<div class="mr"><span class="k">unwounded</span><span class="tk"><b style="width:100%"></b></span><span class="v">100%</span></div>
  <div class="mr"><span class="k">scar</span><span class="tk"><b class="s"></b><i></i></span><span class="v sv">0%</span></div><div class="when">strength, against unwounded skin</div>`;
Object.assign(meter.style, { position: "absolute", left: "50%", top: `${0.3 * H}px`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: "1.2vmin", padding: "1.6vmin 2.8vmin",
  borderRadius: "2.4vmin", background: "var(--card)", boxShadow: "var(--hud-shadow)", fontFamily: "var(--font-mono)", fontSize: "3.2vmin", color: "var(--text)", zIndex: 4, opacity: "0", width: "72vmin" });
const css = document.createElement("style");
css.textContent = `.mr{display:flex;align-items:center;gap:2vmin}.mr .k{width:16vmin;color:var(--text-2)}.mr .tk{position:relative;flex:1;height:2.4vmin;border-radius:1vmin;background:rgba(247,243,255,.14)}
.mr .tk b{position:absolute;left:0;top:0;bottom:0;border-radius:1vmin;background:var(--text-2)}.mr .tk b.s{background:var(--water)}.mr .tk i{position:absolute;left:80%;top:-.8vmin;bottom:-.8vmin;border-left:.4vmin dashed var(--text)}
.mr .v{width:10vmin;text-align:right}.when{font-size:3.1vmin;color:var(--text);text-align:center}.mr .k{color:var(--text);width:20vmin}.mr .v{width:11vmin}`;
document.head.appendChild(css);
hudRoot.appendChild(meter);
const sBar = meter.querySelector("b.s"), sVal = meter.querySelector(".sv");

const hud = createHud({ camera, shots: FILM.shots });
const KIND = { layer: { color: "ink", glyph: "▬" }, cell: { color: "text", glyph: "●" }, water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
const A = {};
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.text.length > 9) el.style.setProperty("--hud-counter-size", `${(10 * 9 / c.text.length).toFixed(2)}vmin`);
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: "none", color: k.color, at: () => A[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed }); }
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.7vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-14vmin)";
const gauge = createTopGauge();

// the to-scale card (No. 003's own): the top layer (≈ 0.1 mm on most of the body) beside a sheet of paper (≈ 100 µm),
// both drawn at the same scale; under them, the line where the weave starts
function createTopGauge() {
  const NS = "http://www.w3.org/2000/svg", mk = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` }); Object.assign(svg.style, { position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" });
  hudRoot.appendChild(svg);
  const cx = 0.1 * W, cw = 0.8 * W, cy = 0.165 * H, ch = 0.3 * H, GH = 0.15 * H, base = cy + 0.07 * H + GH;
  mk("rect", { x: cx, y: cy, width: cw, height: ch, rx: 24 * S1, fill: "var(--card)", opacity: 0.97 }, svg);
  const T = (x, y, size, fill, anchor = "middle", w = 600, fam = "var(--font-text)") => mk("text", { x, y, "font-size": size * S1, fill, "font-family": fam, "font-weight": w, "text-anchor": anchor, "dominant-baseline": "middle" }, svg);
  T(cx + 40 * S1, cy + 52 * S1, 34, "var(--text-2)", "start", 500, "var(--font-mono)").textContent = "TO SCALE";
  const bw = 0.2 * cw, x1 = cx + 0.2 * cw, x2 = cx + 0.6 * cw;
  const out = (x) => mk("rect", { x, y: base - GH, width: bw, height: GH, rx: 4 * S1, fill: "none", stroke: "var(--text-2)", "stroke-width": 2.5 * S1, "stroke-dasharray": `${10 * S1} ${8 * S1}` }, svg);
  out(x1); out(x2);
  const b1 = mk("rect", { x: x1, width: bw, rx: 4 * S1, fill: "var(--water)" }, svg), b2 = mk("rect", { x: x2, width: bw, rx: 4 * S1, fill: "var(--text)" }, svg);
  mk("line", { x1: cx + 30 * S1, x2: cx + cw - 30 * S1, y1: base, y2: base, stroke: "var(--text-2)", "stroke-width": 2 * S1 }, svg);
  const n1 = T(x1 + bw / 2, base + 40 * S1, 42, "var(--text)"), v1 = T(x1 + bw / 2, base + 86 * S1, 38, "var(--water)");
  const n2 = T(x2 + bw / 2, base + 40 * S1, 42, "var(--text)"), v2 = T(x2 + bw / 2, base + 86 * S1, 38, "var(--text)");
  n1.textContent = "top layer"; v1.textContent = "≈ 100 µm"; n2.textContent = "paper"; v2.textContent = "≈ 100 µm";
  return {
    update(t, op) {
      svg.style.opacity = op.toFixed(3); svg.style.visibility = op > 0.002 ? "visible" : "hidden"; if (op <= 0.002) return;
      const a = E.inout2(seg(t, G.sc - 0.1, G.sc + 0.8)), b = E.inout2(seg(t, G.paper - 0.1, G.paper + 0.8));
      b1.setAttribute("y", (base - GH * a).toFixed(1)); b1.setAttribute("height", (GH * a).toFixed(1));
      b2.setAttribute("y", (base - GH * b).toFixed(1)); b2.setAttribute("height", (GH * b).toFixed(1));
      [n1, v1].forEach((e) => e.setAttribute("opacity", E.out3(seg(t, G.sc + 0.3, G.sc + 0.7)).toFixed(3)));
      [n2, v2].forEach((e) => e.setAttribute("opacity", E.out3(seg(t, G.paper + 0.3, G.paper + 0.7)).toFixed(3)));
    },
  };
}

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shotRaw = stage(t).name;
  const P = rig.place(camera, shotRaw, t);
  const shot = shotRaw === "uvb" ? "uv" : shotRaw;   // uvb: the UV scar again, for "the price of defence"
  const isA = ["weave", "test", "gauge"].includes(shot);
  const isM = shot === "macro" || shot === "macro2";
  terrain.group.visible = isM; adult.g.visible = isA; fetal.g.visible = shot === "fetal"; uv.mesh.visible = shot === "uv";
  mouth.g.visible = shot === "mouth"; miceA.g.visible = miceB.g.visible = shot === "mice";
  scene.fog = isM ? FOG : null;
  lights.sun.intensity = isM ? 3.0 : 1.8; lights.key.intensity = isM ? 0.45 : 1.3;
  studio.set({ key: isM ? 0.5 : 1.1, rim: isM ? 1.6 : 3.4, fill: 0.3, env: shot === "uv" ? 0 : 0.45, warm: isM ? 0.6 : 0.3 });
  if (isM) placeDust(t, [PL.tx, 2, 0], [30, 8, 24], 0.1);
  else if (isA || ["fetal", "mouth", "mice"].includes(shot)) { const bx = { fetal: PL.fx, mouth: PL.mx, mice: PL.mox }[shot] || PL.wx; placeDust(t, [bx, -150, 250], [900, 500, 300], 4); }
  else dust.visible = false;
  fstop = shot === "macro" ? 0.18 : shot === "macro2" ? 0.15 : 0; focusPt = isM ? P.target : [PL.tx, 0, SCAR[0]];   // focus where the camera looks: the scar, from frame 0
  const isB = isA || ["fetal", "mouth", "mice"].includes(shot);   // the tissue blocks: a lens on them too, haze and bokeh around
  if (isB) { fstop = 0.16; const bx = { fetal: PL.fx, mouth: PL.mx, mice: PL.mox }[shot] || PL.wx; focusPt = [bx, -110, 150]; hz.set({ at: [bx, -120, -80], t }); bk.points.position.x = bx - PL.wx; }
  adult.epiMat.userData.mesh.visible = !(shot === "weave" && t < SH.weave + 1.0);   // the surface layer's shading bands at the cut: it fades in after
  hz.group.visible = bk.points.visible = isB; bk.set({ t });
  if (isB) for (const b of [adult, fetal, mouth, miceA, miceB]) if (b.g.visible) fadeAt(b);
  if (shot === "mice") focusPt = [PL.mox, -54, 45];   // the two blocks, larger now: focus between them
  // the rope: in the test, from "rope" until the cut; on "strand" one of the five slips out and dims
  const ropeOn = shot === "test" ? E.inout2(seg(t, CUE.four - 1.6, CUE.four - 1.0)) : 0;
  rope.visible = ropeOn > 0.01; rope.scale.setScalar(0.6 + 0.4 * ropeOn); rope.rotation.x = 0.15 * t;
  const lost = E.inout2(seg(t, CUE.four - 0.1, CUE.four + 0.9));
  STRANDS[2].position.set(30 * lost, 48 * lost, 90 * lost); STRANDS[2].rotation.z = -0.08 * lost; ropeLost.transparent = true; ropeLost.opacity = 1 - 0.45 * lost; ropeLost.color.setRGB(1.0, 0.86 - 0.55 * lost, 0.76 - 0.5 * lost); ropeLost.emissive.setRGB(0.35 * lost, 0.05 * lost, 0.04 * lost);

  // ── the macro flight: the scar across the knee ──
  if (isM) { terrain.set({ tone: SKIN.map((v) => v * 1.25), furrows: 0.35, scar: SCAR, scarGlow: 0 }); scarDetail(); }
  A.scar = [PL.tx + 0.5, 0.6, SCAR[0]];

  // ── the adult weave: tugs, the cut, the patch (lit), the strength test ──
  const epiCol = SKIN.map((v) => v * 1.05);
  const topK = shot === "gauge" ? E.inout2(seg(t, G.sc - 0.2, G.sc + 0.5)) * (1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;   // the top layer lit
  if (isA) {
    // the give, visible: about a quarter of the block one way, then the other
    const tug = shot === "weave" ? Math.sin(Math.PI * seg(t, K.tug1[0], K.tug1[1])) * 2.2 : 0, tug2 = shot === "weave" ? Math.sin(Math.PI * seg(t, K.tug2[0], K.tug2[1])) * 2.2 : 0;
    // the test: pulled steadily until "tears", then it lets go
    const stretch = shot === "test" ? 1.6 * E.inout2(seg(t, K.stretch[0], K.tear[0] + 0.2)) * (1 - E.out3(seg(t, K.tear[0] + 0.2, K.tear[1] + 0.6))) : 0;
    const cut = shot === "weave" ? E.inout2(seg(t, K.cut[0], K.cut[1])) : 1;
    const tearK = shot === "test" ? Math.sin(Math.PI * seg(t, K.tear[0], K.tear[1] + 0.8)) : 0;   // "tears": threads give way in the patch
    const patch = shot === "weave" ? E.inout2(seg(t, K.patch[0], K.patch[1])) : 1 - 0.5 * tearK;
    adult.weave.set({ tone, pull: [tug + stretch, tug2], cut, patch, glow: shot === "weave" ? E.inout2(seg(t, K.glow[0], K.glow[1])) : shot === "test" ? 1 : 0.5,
      dim: shot === "gauge" ? 0.4 * fadeIn(t, SH.gauge, 0.6) : 0 });
    adult.epiMat.color.setRGB(...epiCol); adult.epiMat.opacity = shot === "weave" ? 0.94 * (1 - fadeIn(t, SH.weave + 0.4, 1.2)) + 0.3 : shot === "gauge" ? 0.3 + 0.55 * topK : 0.3;
    adult.epiMat.emissive = adult.epiMat.emissive || new THREE.Color(); adult.epiMat.emissive.setRGB(0.12 * topK, 0.55 * topK, 0.52 * topK);
    adult.floor.material.color.setRGB(...toneColor("dermis", tone));
  }
  A.weave = [PL.wx - 170, -170, 160]; A.gap = [PL.wx, -110, 160]; A.app = [PL.wx + 40, -210, 160]; A.top = [PL.wx + 160, -30, 160];

  // ── the strength meter ──
  const mOp = shot === "test" ? fadeIn(t, SH.test + 0.3, 0.5) : 0;
  meter.style.opacity = mOp.toFixed(3); meter.style.visibility = mOp > 0.002 ? "visible" : "hidden";
  const pct = FILM.str.pct * E.out3(seg(t, K.meter[0], K.meter[1]));
  sBar.style.width = `${pct.toFixed(1)}%`; sVal.textContent = `${Math.round(pct)}%`;
  const snap = shot === "test" ? Math.max(0, 1 - Math.abs(t - FILM.keys.tear[0] - 0.2) / 0.5) : 0;   // the snap at "tears"
  sBar.style.background = snap > 0.05 ? `color-mix(in srgb, #FF5A4E ${(snap * 100).toFixed(0)}%, var(--water))` : "";

  // ── fetal skin: a cut that closes with the weave regrown, follicles and all; after the switch, a patch ──
  if (shot === "fetal") {
    // "After that, it patches": the regrown weave gives way to parallel threads, lit cyan, and the follicles go
    const fcut = E.inout2(seg(t, K.fcut[0], K.fcut[0] + 0.6)), fp = E.inout2(seg(t, K.fpatch[0], K.fpatch[1])), regrow = E.inout2(seg(t, K.regrow[0], K.regrow[1])) * (1 - fp);
    fetal.weave.set({ tone, cut: fcut, regrow, patch: fp, follicles: 1, glow: fp });
    fetal.epiMat.color.setRGB(...epiCol.map((v) => Math.min(1, v * 1.1))); fetal.epiMat.opacity = 0.3;
    fetal.floor.material.color.setRGB(...toneColor("dermis", tone));
  }
  // ── adult mouth lining: the cut closes, the weave nearly as it was; no follicles (none in the mouth lining) ──
  if (shot === "mouth") {
    const mcut = E.inout2(seg(t, SH.mouth + 0.15, SH.mouth + 0.6)), mre = E.inout2(seg(t, SH.mouth + 0.9, SH.mouth + 2.6));
    mouth.weave.set({ tone, cut: mcut, regrow: 0.93 * mre, patch: 0.07 * mre, follicles: 0, glow: 0 });
    mouth.weave.group.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material.color.lerp(MUCOSA, 0.35); o.material.roughness = 0.2; o.material.envMapIntensity = 1.3; } });   // wet mucosa: glossier, pinker
    mouth.epiMat.color.copy(MUCOSA); mouth.epiMat.opacity = 0.32;
    mouth.floor.material.color.setRGB(...toneColor("dermis", tone));
  }
  A.mgap = [PL.mx, -110 * FS, 150 * FS];
  // ── the mouse study: with the cells (top) a patch forms; without them (bottom) the weave regrows ──
  if (shot === "mice") {
    const k = E.inout2(seg(t, SH.mice + 0.5, SH.mice + 2.2));
    miceA.weave.set({ tone, cut: 1, patch: k, glow: 0.35 * k, follicles: 1 }); miceB.weave.set({ tone, cut: 1, regrow: k, follicles: 1 });
    for (const b of [miceA, miceB]) { b.epiMat.color.setRGB(...epiCol); b.epiMat.opacity = 0.3; b.floor.material.color.setRGB(...toneColor("dermis", tone)); }
    IMMA.forEach(({ m, x, y, z, ph }, i) => { const g = E.out3(seg(t, SH.mice + 0.1 + 0.025 * i, SH.mice + 0.9 + 0.025 * i)); m.position.set(x * (0.4 + 0.6 * g) + 4 * Math.sin(t * 1.3 + ph), y + 160 * (1 - g), z); m.scale.setScalar(0.3 + 0.7 * g); });
  }
  A.miceL = [PL.mox - 112, 20, 150 * MSC]; A.miceR = [PL.mox + 112, -92, 150 * MSC];   // under its block (the two labels would collide side by side)
  A.fgap = [PL.fx, -110 * FS, 150 * FS]; A.fside = [PL.fx - 150 * FS, -40 * FS, 150 * FS];

  // ── the gauge: a centred card above the section: the top layer ≈ a sheet of paper, the weave below ──
  const lift = shot === "gauge" ? E.inout2(seg(t, G.rise[0] - 0.2, G.rise[0] + 0.4)) : 0;
  gauge.update(t, shot === "gauge" ? lift * (1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0);

  // ── the UV camera on the scar: a seam with no pores and no pattern ──
  // the knee again, in daylight, then the UV camera switches on: the seam with no pores and no pattern
  if (shot === "uv") uv.set({ damage: 0.35, scar: 1, glow: 1, opacity: 1, form: 1 });
  imm.visible = shotRaw === "uvb";   // the defence at the seam, with "the price of defence"
  if (shotRaw === "uvb") { const c = uv.at(0.66, 0.5), g = E.inout2(seg(t, SH.uvb - 0.2, SH.uvb + 2.2));
    IMM.forEach(({ m, a, r, v }, i) => { const rr = r * (1 - 0.82 * g) + 0.1, aa = a + 0.25 * t; m.position.set(c[0] + 0.25 * rr * Math.cos(aa), c[1] + rr * Math.sin(aa) * 0.9 + v * 0.3 * g, c[2] + 0.12 + 0.03 * Math.sin(t * 2 + i)); m.scale.setScalar(0.4 + 0.6 * E.out3(seg(t, SH.uvb - 0.3 + 0.03 * i, SH.uvb + 0.3 + 0.03 * i))); }); }
  day.set({ op: shot === "uv" ? fadeIn(t, SH.uv + 0.6, 0.5) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });
  const dz = (c) => Math.max(0, 1 - Math.abs(t - c) / 0.07);   // a 2–3 frame dip, not an empty frame
  dip.style.opacity = Math.max(dz(SH.weave), dz(SH.fetal), dz(SH.mouth), dz(SH.gauge), dz(SH.uv), dz(SH.mice), dz(SH.uvb)).toFixed(3);   // macro2 rises out of the skin instead
  A.uvscar = uvAt(0.66, 0.5);
  vf.set({ op: shot === "uv" ? fadeIn(t, SH.uv, 0.4) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });

  photoNote.style.opacity = isA ? "1" : "0";
  photoNote.style.top = `${({ test: 0.43, gauge: 0.495 }[shot] || 0.285) * H}px`;   // clear of the strength meter and the gauge card   // the micrograph is only behind the adult weave: the note is up on every frame it shows
  grain.set(t);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
