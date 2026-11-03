import * as THREE from "three";
// Skin Sense No. 002 (reboot), "Where a glow comes from" (films/channels/skincare/ep02). The picture as a pure
// function of t (window.seek). Places (compile.py): the macro terrain at golden hour with a beam of light and its
// glint (one ray off smooth, hydrated skin; a haze off dry skin), the section where the rest of the light threads among
// cells and fibres and much of it climbs back out, warmed by melanin and reddened by a widening capillary; the
// viewfinder's model cheek beside a "blood colour" slider; a depth chart (blue ≈ 1 mm, ten sheets of paper; red 4–5
// mm); and back to the terrain, glowing from within.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, injectCss } from "../set/motif.js";
import { createUVSkin, createViewfinder, createDaylight } from "../set/uvcam.js";
import { createTerrain, goldenHour } from "../set/terrain.js";
import { createSection, createVessels, toneColor } from "../set/section.js";
import { createBeam, createGlint, createPaths } from "../set/light02.js";
import { createStudio, skinMaterial, strandMaterial, createGrain, createShaft } from "../set/studio.js";
import { DERMIS } from "../set/ref/textures.js";
import { hazeVolume, richen, bokeh } from "../set/prod.js";
import { lookV3 } from "../set/look3.js";
import { unifyHud } from "../set/hudv2.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, K = FILM.keys, PL = FILM.place, FPS = FILM.fps || 30, D = FILM.depth;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.88, bloom: 0.36, exposure: 1.0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 30000);
injectCss();
const lights = goldenHour(scene);
const studio = createStudio(renderer, scene, {});
const FOG = scene.fog; scene.fog = null;
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const tone = FILM.tone, SKIN = toneColor("living", tone);

// ── the set ─────────────────────────────────────────────────────────────────
const terrain = createTerrain({ seed: 13, spots: 0, segs: 400 }); terrain.group.position.x = PL.tx; scene.add(terrain.group);
{ const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.1, hydration: 0.35, repeat: 14, seed: 6, micro: 0.35 }); m.roughness = 0.56; terrain.mesh.material = m;
  terrain.group.traverse((o) => { if (o.isInstancedMesh) { o.material = strandMaterial({ tint: [0.3, 0.18, 0.12], gloss: 0.5 }); o.material.transmission = 0; } }); }
const beam = createBeam({ from: [PL.tx - 9, 16, -6], to: [PL.tx, 0.25, 0], radius: 0.1 }); scene.add(beam.group);
const glint = createGlint({ at: [PL.tx, 0.3, 0], dir: [0.55, 1, 0.45], len: 7 }); scene.add(glint.group);
const beamL = createBeam({ from: [PL.tx - 11, 16, -6], to: [PL.tx - 3, 0.25, 0], radius: 0.09 }), beamR = createBeam({ from: [PL.tx - 6, 16, -6], to: [PL.tx + 2, 0.25, 0], radius: 0.09 });
const glintL = createGlint({ at: [PL.tx - 3, 0.3, 0], dir: [0.55, 1, 0.45], len: 4, seed: 5 }), glintR = createGlint({ at: [PL.tx + 2, 0.3, 0], dir: [0.55, 1, 0.45], len: 4, seed: 6 });
scene.add(beamL.group, beamR.group, glintL.group, glintR.group);
// the glow from within (takeaway): warm rays rising out of the surface around the beam
// soft warm blooms over the pores (blood-tinted: light that met the blood) (additive sprites, under the bloom knee), not rays: light coming back out from under the surface
const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,176,140,1)"); gr.addColorStop(0.35, "rgba(240,104,92,.5)"); gr.addColorStop(1, "rgba(220,70,70,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const glowAt = (p, size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); sp.position.set(...p); sp.scale.set(size, size, 1); scene.add(sp); return sp; };
const glows = terrain.pores.filter(([x, z]) => Math.abs(x) < 9 && z > -10 && z < 7).map(([x, z], i) => glowAt([PL.tx + x, 0.15, z], 1.6 + ((i * 37) % 10) / 10));
const bloom = glowAt([PL.tx, 0.2, 0], 5.5);   // the beam's foot: the light sinking in

const S = createSection({ width: 180, depth: 60, sc: 17, gran: 10, spin: 48, basal: 10, seed: 23, x: PL.sx, backing: true });
S.group.position.x = PL.sx; scene.add(S.group);
richen(S.group, { seed: 23, jitter: 0.14, hue: 0.07, micro: 0.5, skip: (o) => o.geometry && o.geometry.type === "CylinderGeometry" });   // the horny-layer plates stay flat (tilted, they striped into dashes)   // no two cells alike; a micro surface on every one
const V = createVessels({ x: [-80, 80], ys: [-118, -132], z: 30.4, r: 4.2, ox: PL.sx, dz: 0 }); scene.add(V.group);
const paths = createPaths({ n: 9, origin: [0, 0, 32], width: 170, depth: 150, seed: 6 }); paths.group.position.x = PL.sx; scene.add(paths.group);
// light paths as glowing threads (not 1-px wire): a thin tube with a soft halo along each path, revealed with the path
const glowTubes = paths.group.children.filter((o) => o.isLine).map((l) => {
  const a = l.geometry.attributes.position, pts = []; for (let i = 0; i < a.count; i++) pts.push(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  const curve = new THREE.CatmullRomCurve3(pts), seg = (a.count - 1) * 6;
  const core = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, 0.32, 6), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, 1.1, 8), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.renderOrder = halo.renderOrder = 21; l.parent.add(core, halo); l.visible = false;
  return { l, core, halo };
});
const syncTubes = () => glowTubes.forEach(({ l, core, halo }) => {
  const np = l.userData.np, f = Math.min(1, (l.geometry.drawRange.count - 1) / (np - 1)), op = l.material.opacity;
  for (const [m, k] of [[core, 0.55], [halo, 0.08]]) { m.geometry.setDrawRange(0, Math.round(m.geometry.index.count * f / 6) * 6); m.material.color.copy(l.material.color); m.material.opacity = op * k; m.visible = op > 0.002; }
});
const beamS = createBeam({ from: [PL.sx - 70, 230, 32], to: [PL.sx, 1, 32], radius: 2.2 }); scene.add(beamS.group);
const shaftS = createShaft({ from: [PL.sx - 80, 260, 20], to: [PL.sx, -60, 26], radius: 26, color: "#fff1e2" }); scene.add(shaftS.group);   // the light as a volume in the tissue, not just a rod
// the wrong idea (why): a glow sitting on the skin, a warm film on its top, shown and then let go
const sheen = new THREE.Mesh(new THREE.BoxGeometry(200, 5, 2), new THREE.MeshBasicMaterial({ color: 0xffc48a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
sheen.position.set(PL.sx, 3, 32); scene.add(sheen);
// below the section: the deep dermis continues (no clear colour under the slab)
const deepPlainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...toneColor("dermis", tone).map((v) => v * 0.8)) });
const deep = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: new THREE.Color(...toneColor("dermis", tone).map((v) => v * 0.8)) }));
deep.position.set(PL.sx, -140 - 1500, 0); scene.add(deep);

const face = createUVSkin({ seed: 5.0 }); face.mesh.rotation.x = -0.18; scene.add(face.mesh);
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
// production pass: a graded volume behind every non-terrain set, haze the key reads through, far bokeh, one grade
const hz = hazeVolume(scene, { at: [PL.sx, -70, -60], size: [700, 420, 160], color: "#c9b6ff", n: 5, op: 0.05 });
const bk = bokeh(scene, { n: 120, box: [[PL.sx - 600, PL.sx + 600], [-500, 300], [-900, -400]], size: 46, color: "#d9ccff", op: 0.35 });
const look = lookV3({ canvas, hudRoot, fog: FOG, terrain, skin: terrain.mesh.material }); unifyHud(hudRoot);   // the channel look v3 and the one-system HUD
// the graded backdrop drawn in WebGL too (an opaque canvas: the sky is the gradient, not a flat violet strip; additive light reads as light)
scene.background = (() => { const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256; const x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#3b2479"); g.addColorStop(1, "#06030c"); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
// the viewfinder's own text on the HUD plate, readable on bright skin
{ const s = document.createElement("style"); s.textContent = ".ol-vf .rec,.ol-vf .hl,.ol-vf .hr{background:var(--hud-plate);padding:.6vmin 1.4vmin;border-radius:1.4vmin;font-size:2.9vmin!important;color:var(--text)}.ol-vf .rec{color:var(--water)}"; document.head.appendChild(s); }
// haze in the light over the macro skin: the beam reads as light in air, not a frosted rod
const hzM = hazeVolume(scene, { at: [PL.tx, 6, -4], size: [40, 26, 16], color: "#fff0e0", n: 5, op: 0.05 });
// the twist: two rendered skin forms under one light; left, the light stays on the surface (a hard highlight, no glow);
// right, the light goes inside (soft, warm, lit from within). Models, not photos.
const cgSkin = new THREE.Color(...SKIN.map((v) => v * 1.05));
const faceGeo = (() => { const g = new THREE.SphereGeometry(1.6, 128, 96), p = g.attributes.position, v = new THREE.Vector3();
  const bump = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = Math.max(0, v.z / 1.6);   // front half only
    let d = 0.34 * bump(v.x, v.y, 0, -0.02, 0.2, 0.32) - 0.16 * (bump(v.x, v.y, -0.46, 0.3, 0.26, 0.17) + bump(v.x, v.y, 0.46, 0.3, 0.26, 0.17)) + 0.12 * bump(v.x, v.y, 0, 0.55, 0.75, 0.12) + 0.07 * bump(v.x, v.y, 0, -0.52, 0.28, 0.07)
      - 0.07 * bump(v.x, v.y, 0, -0.62, 0.3, 0.08) + 0.06 * (bump(v.x, v.y, -0.6, -0.15, 0.3, 0.25) + bump(v.x, v.y, 0.6, -0.15, 0.3, 0.25));
    v.addScaledVector(v.clone().normalize(), d * f * f); if (v.y < -0.6) v.y -= 0.25 * (-0.6 - v.y) * f; v.z -= 0.18 * Math.max(0, -v.z); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; })();
const cgL = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: cgSkin.clone().multiplyScalar(1.12), roughness: 0.22, metalness: 0 }));   // matched in lightness to the right face: only the light differs
const cgR = new THREE.Mesh(faceGeo, new THREE.MeshPhysicalMaterial({ color: cgSkin, roughness: 0.6, metalness: 0, sheen: 0.9, sheenRoughness: 0.55,
  sheenColor: new THREE.Color(1.0, 0.55, 0.45), emissive: new THREE.Color(0.55, 0.12, 0.08), emissiveIntensity: 0.3, clearcoat: 0.15, clearcoatRoughness: 0.4 }));
cgR.material.normalMap = skinMaterial({ micro: 0.6, seed: 9, repeat: 4 }).normalMap; cgR.material.normalScale = new THREE.Vector2(0.4, 0.4);
cgL.scale.set(0.78, 0.96, 0.74); cgR.scale.set(0.78, 0.96, 0.74); cgL.position.set(-1.55, -0.25, 1.2); cgR.position.set(1.55, -0.25, 1.2);
const cgRim = new THREE.PointLight(0xff8a6a, 0, 9, 1.6); cgRim.position.set(1.55, -0.25, -2.4);
scene.add(cgL, cgR, cgRim);
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.255, w: 0.8, h: 0.29 });
vf.el.querySelector(".rec").textContent = "● REC  DAYLIGHT"; vf.el.style.fontSize = "3.1vmin"; vf.el.style.setProperty("--ol-rec-size", "3.2vmin");
const day = createDaylight({ root: hudRoot, W, H, y: 0.7, label: "daylight" }); day.el.style.fontSize = "2.9vmin";
// the slider (whoa): "blood colour", nudged up
const slider = document.createElement("div");
slider.innerHTML = `<span class="k">pulse, from colour</span><svg width="38vmin" height="6vmin" viewBox="0 0 300 44" preserveAspectRatio="none"><polyline fill="none" stroke="#5FF2E8" stroke-width="3" stroke-linejoin="round"/></svg>`;
const trace = slider.querySelector("polyline");
Object.assign(slider.style, { position: "absolute", left: "50%", top: `${0.535 * H}px`, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "2.4vmin", padding: "1.2vmin 2.6vmin",
  borderRadius: "2.4vmin", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", fontFamily: "var(--font-mono)", fontSize: "3.2vmin", color: "var(--text)", zIndex: 4, opacity: "0" });
const css = document.createElement("style");
css.textContent = `.sl-tr{position:relative;display:block;width:36vmin;height:1.2vmin;border-radius:1vmin;background:linear-gradient(90deg,#d9b49a,#c8504a)}.sl-tr i{position:absolute;top:50%;width:3.4vmin;height:3.4vmin;margin:-1.7vmin 0 0 -1.7vmin;border-radius:50%;background:#F7F3FF;border:.5vmin solid var(--water)}.sl-tr b{display:none}
.dc{position:absolute;left:50%;transform:translateX(-50%);display:flex;gap:5vmin;align-items:flex-start;padding:2.4vmin 3.4vmin;border-radius:2.4vmin;background:var(--hud-plate);box-shadow:var(--hud-shadow);font-family:var(--font-mono);color:var(--text);font-size:2.8vmin;z-index:4}
.dc .col{display:flex;flex-direction:column;align-items:center;gap:1vmin}.dc .bar{width:9vmin;border-radius:.6vmin;background:var(--c)}.dc .sh{display:flex;flex-direction:column;gap:.35vmin}.dc .sh i{display:block;width:9vmin;height:.55vmin;background:#EDE6FF;border-radius:.2vmin}
.dc .ax{position:relative;width:9vmin;white-space:nowrap;border-left:.35vmin solid var(--text-2)}.dc .ax span{position:absolute;left:1vmin;font-size:2.3vmin;color:var(--text-2);transform:translateY(-50%)}`;
document.head.appendChild(css);
hudRoot.appendChild(slider);
// the micrograph under the section is a real photo: said so, under the captions, while it shows
const photoNote = document.createElement("div"); photoNote.textContent = "behind: a tissue photo (normal skin)";
Object.assign(photoNote.style, { position: "absolute", left: "50%", top: `${0.588 * H}px`, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: "2.9vmin", letterSpacing: ".03em", textTransform: "none",
  color: "var(--text)", background: "var(--hud-plate)", padding: ".5vmin 1.4vmin", borderRadius: "1vmin", whiteSpace: "nowrap", zIndex: 3, opacity: "0", pointerEvents: "none" });
hudRoot.appendChild(photoNote);
let cgBuilt = false;
const buildCg = () => { if (cgBuilt) return; cgBuilt = true;
  [0, 1].forEach((i) => { const f = fsvg.cloneNode(true); Object.assign(f.style, { position: "static", width: "100%", height: "85%", opacity: "1", transform: "none" });
    // both faces in the episode's one tone; they differ only in how light behaves: a hard surface highlight and no flush (left), soft light from inside (right)
    if (i === 0) { f.querySelectorAll("ellipse").forEach((e) => { if ((e.getAttribute("fill") || "").includes("blush")) e.setAttribute("opacity", "0"); });
      const hl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse"); [["cx", 455], ["cy", 380], ["rx", 46], ["ry", 22], ["fill", "#ffffff"], ["opacity", "0.85"]].forEach(([k, v]) => hl.setAttribute(k, v)); f.appendChild(hl); f.style.filter = "contrast(1.18) saturate(.92)"; }
    else { f.style.filter = "drop-shadow(0 0 2.4vmin rgba(255,120,90,.55))"; f.querySelectorAll("ellipse").forEach((e) => { if ((e.getAttribute("fill") || "").includes("blush")) e.setAttribute("opacity", "0.65"); }); }
    void f; cgCols[i].style.justifyContent = "flex-end"; cgCols[i].appendChild(cgTag(i === 0 ? "light stays on top" : "light goes inside")); }); };   // the faces themselves are rendered (cgL, cgR)
// the model face (whoa): a stylised face drawn in the viewfinder (labelled "model face, not a photo"): its skin and
// cheeks take on blood colour as the slider rises
const NS = "http://www.w3.org/2000/svg", mk = (tag, at, p) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; };
const fsvg = mk("svg", { width: W, height: H, viewBox: "250 170 500 760", preserveAspectRatio: "xMidYMid meet" });
Object.assign(fsvg.style, { position: "absolute", left: `${0.1 * W}px`, top: `${0.3 * H}px`, width: `${0.8 * W}px`, height: `${0.245 * H}px`, zIndex: 1, pointerEvents: "none", opacity: "0" });
hudRoot.appendChild(fsvg);
const defs = mk("defs", {}, fsvg);
const blushG = mk("radialGradient", { id: "blush" }, defs); mk("stop", { offset: "0", "stop-color": "#d23c3c", "stop-opacity": "0.9" }, blushG); mk("stop", { offset: "1", "stop-color": "#d23c3c", "stop-opacity": "0" }, blushG);
const shadeG = mk("radialGradient", { id: "shade", cx: "0.42", cy: "0.38", r: "0.75" }, defs); const sh0 = mk("stop", { offset: "0" }, shadeG), sh1 = mk("stop", { offset: "1" }, shadeG);
const neck = mk("path", { d: "M430 780 L430 840 Q300 860 260 930 L740 930 Q700 860 570 840 L570 780 Z" }, fsvg);   // neck and shoulders
const earL = mk("ellipse", { cx: 318, cy: 500, rx: 34, ry: 62 }, fsvg), earR = mk("ellipse", { cx: 682, cy: 500, rx: 34, ry: 62 }, fsvg);
const head = mk("ellipse", { cx: 500, cy: 480, rx: 180, ry: 250, fill: "url(#shade)" }, fsvg);
mk("path", { d: "M318 430 Q312 220 500 205 Q690 215 684 430 Q660 300 520 290 Q380 300 318 430 Z", fill: "#2a1a14" }, fsvg);   // hair
const blL = mk("ellipse", { cx: 410, cy: 560, rx: 80, ry: 56, fill: "url(#blush)" }, fsvg), blR = mk("ellipse", { cx: 590, cy: 560, rx: 80, ry: 56, fill: "url(#blush)" }, fsvg);
const ink = { fill: "none", stroke: "#3a2418", "stroke-width": 7, "stroke-linecap": "round" };
mk("path", { d: "M400 455 Q430 440 460 455", ...ink }, fsvg); mk("path", { d: "M540 455 Q570 440 600 455", ...ink }, fsvg);   // eyes (closed, calm)
mk("path", { d: "M395 415 Q430 395 468 410", ...ink, "stroke-width": 9 }, fsvg); mk("path", { d: "M532 410 Q570 395 605 415", ...ink, "stroke-width": 9 }, fsvg);   // brows
mk("path", { d: "M500 470 Q492 545 478 575 Q500 590 522 575", ...ink, "stroke-width": 6 }, fsvg);   // nose
const lips = mk("path", { d: "M455 640 Q500 668 545 640 Q500 652 455 640 Z", fill: "#a8555a" }, fsvg);
const cgWrap = document.createElement("div");
Object.assign(cgWrap.style, { position: "absolute", left: `${0.16 * W}px`, top: `${0.27 * H}px`, width: `${0.68 * W}px`, height: `${0.3 * H}px`, display: "flex", gap: `${0.04 * W}px`, zIndex: 1, opacity: "0", pointerEvents: "none" });
hudRoot.appendChild(cgWrap);
const cgTag = (txt) => { const d = document.createElement("div"); d.textContent = txt; Object.assign(d.style, { fontFamily: "var(--font-mono)", fontSize: "3.1vmin", letterSpacing: ".01em", textTransform: "none", color: "var(--text)", textAlign: "center", marginTop: "1vmin", whiteSpace: "nowrap", background: "var(--hud-plate)", padding: ".5vmin 1.4vmin", borderRadius: "1vmin" }); return d; };
const cgCols = [0, 1].map(() => { const col = document.createElement("div"); Object.assign(col.style, { flex: "1", display: "flex", flexDirection: "column", alignItems: "center" }); cgWrap.appendChild(col); return col; });
const skinHex = (k) => { const c = SKIN.map((v) => v * 1.2), r = [Math.min(1, c[0] * (1 + 0.1 * k)), c[1] * (1 - 0.13 * k), c[2] * (1 - 0.1 * k)]; return `rgb(${r.map((v) => Math.round(Math.min(1, v) * 255)).join(",")})`; };
// the depth chart (toscale): a full-width card, mm down the left; blue to ≈ 1 mm beside ten 100 µm sheets; red on to ≈ 4–5 mm
const PXMM = 0.058 * H;                                               // 1 mm on the chart
const chart = document.createElement("div"); chart.className = "dc";
chart.innerHTML = `<div class="ax" style="height:${5 * PXMM}px">${[0, 1, 2, 3, 4, 5].map((m) => `<span style="top:${m * PXMM}px">${m} mm</span>`).join("")}</div>
  <div class="col"><div class="bar b" style="--c:#7C98FF;height:0px"></div><span class="v vb">≈ 1 mm</span><span class="h">blue</span></div>
  <div class="col"><div class="sh">${Array.from({ length: 10 }, () => "<i></i>").join("")}</div><span class="v vs">10 × 100 µm</span><span class="h">paper</span></div>
  <div class="col"><div class="bar r" style="--c:#FF5A4E;height:0px"></div><span class="v vr">≈ 4–5 mm</span><span class="h hr">red</span></div>`;
Object.assign(chart.style, { top: `${0.165 * H}px`, width: `${0.8 * W}px`, height: `${5 * PXMM + 0.115 * H}px`, boxSizing: "border-box", opacity: "0" });
hudRoot.appendChild(chart);
const barB = chart.querySelector(".bar.b"), barR = chart.querySelector(".bar.r"), sheets = [...chart.querySelectorAll(".sh i")];
const vB = chart.querySelector(".vb"), vS = chart.querySelector(".vs"), vR = chart.querySelector(".vr"), hR = chart.querySelector(".hr");
sheets.forEach((s) => { s.style.height = `${0.1 * PXMM * 0.62}px`; s.style.marginBottom = `${0.1 * PXMM * 0.38}px`; });
const dcss = document.createElement("style");
dcss.textContent = `.dc{justify-content:center;gap:3vmin;background:var(--card);font-size:3.6vmin;padding:3vmin 4vmin}.dc .ax{margin-right:7vmin}.dc .ax span{font-size:3.2vmin;color:var(--text)}.dc .col{gap:1.4vmin}.dc .bar,.dc .sh i{width:10vmin}.dc .sh{gap:0}.dc .h{font-weight:600}.dc .v{font-size:3.3vmin;color:var(--water);font-weight:600;white-space:nowrap}`;
document.head.appendChild(dcss);

const hud = createHud({ camera, shots: FILM.shots });
const KIND = { layer: { color: "ink", glyph: "▬" }, cell: { color: "text", glyph: "●" }, water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
const A = {};
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: FILM.title.t0 || 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.text.length > 9) el.style.setProperty("--hud-counter-size", `${(10 * 9 / c.text.length).toFixed(2)}vmin`);
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: "none", color: k.color, at: () => A[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed }); }
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.5vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "80vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-14vmin)";

const grain = look.grain;
let deepPhotoMat = null;
window.SCENE_READY = new Promise((res) => { const img = new Image(); img.onload = () => { const tx = new THREE.Texture(img); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(1, 1); tx.needsUpdate = true; deepPhotoMat = new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(1, 0.92, 0.95) }); res(); }; img.src = DERMIS; });

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  rig.place(camera, shot, t);
  const isT = ["macro", "split", "rise", "macro2", "face"].includes(shot), isS = shot === "inside" || shot === "depth";
  terrain.group.visible = isT; S.group.visible = V.group.visible = paths.group.visible = deep.visible = isS;
  face.mesh.visible = false;   // the pulse beat is shot on the macro skin itself (the terrain), not a flat patch
  hz.group.visible = isS; bk.points.visible = shot === "depth";   // no starfield over the section's surface hz.set({ t }); bk.set({ t });
  hzM.group.visible = ["macro", "split", "macro2"].includes(shot); hzM.set({ t });
  cgL.visible = cgR.visible = shot === "cg"; cgRim.intensity = shot === "cg" ? 7 : 0;
  if (deepPhotoMat) deep.material = shot === "depth" ? deepPhotoMat : deepPlainMat;   // the micrograph (a real photo) only in the depth beat, where its note is up
  scene.fog = isT ? FOG : null;
  lights.sun.intensity = isT ? 3.0 : 1.6; lights.key.intensity = isT ? 0.4 : 1.2;
  studio.set({ key: isT ? 0.5 : 1.0, rim: isT ? 1.6 : 2.0, fill: 0.3, env: 0.45, warm: 0.6 });
  fstop = shot === "face" ? 0.3 : isT ? 0.45 : isS ? 0.16 : shot === "face" ? 0.35 : shot === "cg" ? 0.12 : 0; focusPt = isS ? [PL.sx, -80, 30] : shot === "cg" ? [0, -1.0, 2.8] : shot === "face" ? [PL.tx + 3, 0, 5] : [PL.tx, 0, 0];

  // ── the terrain: one beam and its glint; then two halves, smooth (one ray) and dry (a haze) ──
  if (isT) terrain.set({ tone: SKIN.map((v) => v * 1.1), furrows: shot === "split" ? 1.5 : 0.3, sheen: shot === "split" ? 1 : 0, spot: 0 });
  const one = shot === "macro" || shot === "macro2";
  beam.set({ op: one ? 1 : 0, grow: shot === "macro" ? E.out3(seg(t, K.beam[0], K.beam[1])) : 1 });
  glint.set({ op: shot === "macro" ? E.out3(seg(t, K.glint[0], K.glint[1])) : 0, spread: 0 });
  beamL.set({ op: shot === "split" ? 1 : 0 }); beamR.set({ op: shot === "split" ? 1 : 0 });
  glintL.set({ op: shot === "split" ? 1 : 0, spread: 0 });
  glintR.set({ op: shot === "split" ? 1 : 0, spread: shot === "split" ? E.inout2(seg(t, K.spread[0], K.spread[1])) : 0 });
  const gOut = shot === "macro2" ? E.inout2(seg(t, K.glowout[0], K.glowout[1])) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : shot === "rise" ? 0.9 : 0;   // the rise: the reddened light coming out
  // the glow from within: soft at frame 0 (the payoff), fading as the story starts; back on in the takeaway
  const gIn = shot === "macro" ? 0.75 * (1 - E.inout2(seg(t, CUE.inside + 0.4, CUE.inside + 1.6))) : 0;
  glows.forEach((g, i) => { g.material.opacity = Math.max(gIn, 0.85 * gOut) * (0.7 + 0.3 * Math.sin(t * 1.3 + i)); g.visible = g.material.opacity > 0.002; });
  const bl = shot === "macro" ? E.out3(seg(t, K.bloom[0], K.bloom[1])) * (1 - fadeIn(t, SH.split - 0.6, 0.5)) : 0;
  bloom.material.opacity = 0.7 * bl; bloom.visible = bl > 0.002;
  A.glint = [PL.tx, 0.4, 0]; A.glintL = [PL.tx - 3, 0.3, 0.5]; A.glintR = [PL.tx + 2, 0.3, 0.5];

  // ── the section: the rest of the light threads in; much of it climbs back out, warmed, then reddened ──
  if (isS) {
    const dim = shot === "depth" ? 0.55 * fadeIn(t, SH.depth, 0.6) : 0;
    S.set({ tone, dimDead: dim, dimLiving: 0.25 + dim });
    const widen = shot === "inside" ? E.inout2(seg(t, K.widen[0], K.widen[1])) : 1;
    V.set({ k: 1 + 1.6 * widen, opacity: 1 });
    const warm = shot === "inside" ? E.inout2(seg(t, K.warm[0], K.warm[0] + 1.0)) : 1;   // amber on "melanin", then blood red on "rush"
    paths.set({ grow: shot === "inside" ? E.inout2(seg(t, K.paths[0], K.paths[1])) : 1, out: shot === "inside" ? E.inout2(seg(t, K.out[0], K.out[1])) * (0.6 + 0.4 * warm) : 1,
      red: shot === "inside" ? 0.4 * warm + 0.6 * widen : 1, op: 1 - dim });
    syncTubes();
  }
  shaftS.set({ op: shot === "inside" ? 0.8 : 0 });
  beamS.set({ op: isS ? 1 - (shot === "depth" ? 0.6 * fadeIn(t, SH.depth, 0.6) : 0) : 0 });
  const sh = shot === "inside" ? E.inout2(seg(t, K.sheen[0], K.sheen[1])) * (1 - E.inout2(seg(t, K.sheen[2], K.sheen[3]))) : 0;
  sheen.material.opacity = 0.55 * sh; sheen.visible = sh > 0.002;
  A.melanin = [PL.sx - 40, -80, 32]; A.cap = [PL.sx + 30, -118, 34]; A.sheen = [PL.sx + 30, 5, 32];

  // ── the viewfinder cheek: daylight, the slider nudged up, the cheek flushing ──
  // the colour rises and falls with each heartbeat (amplified, as Eulerian video magnification shows it)
  const beat = (x) => Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * x / 0.85), 5);
  const amp = shot === "face" ? E.inout2(seg(t, K.pulse[0], K.pulse[0] + 1.2)) : 0;
  const flush = amp * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * (t - K.pulse[0]) / 0.85), 2), pulse = 0;   // amplified, about 70 a minute
  const fk = 0.15 + flush;
  const skc = skinHex(fk); [head, earL, earR, neck].forEach((e) => e !== head && e.setAttribute("fill", skc)); sh0.setAttribute("stop-color", skc);
  sh1.setAttribute("stop-color", (() => { const c = SKIN.map((v) => v * 0.95); return `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`; })());
  blL.setAttribute("opacity", (0.15 + 0.85 * flush + 0.2 * pulse).toFixed(3)); blR.setAttribute("opacity", (0.15 + 0.85 * flush + 0.2 * pulse).toFixed(3));
  fsvg.style.opacity = "0";
  // the pulse: the macro skin itself flushes with each beat (amplified, as Eulerian video magnification shows it)
  terrain.mesh.material.color.setRGB(1 + 0.32 * flush, 1 - 0.2 * flush, 1 - 0.16 * flush);   // amplified, as in Eulerian video magnification (labelled)
  // a slow push in on the cheek across the whole beat (no locked frame)
  const push = shot === "face" ? E.inout2(seg(t, SH.face, SH.depth)) : 0;
  fsvg.style.transform = `scale(${(1 + 0.18 * push).toFixed(4)})`; fsvg.style.transformOrigin = "57% 78%";
  vf.set({ op: shot === "face" ? fadeIn(t, SH.face, 0.4) : 0, left: "model skin · colour amplified", right: "" });
  slider.style.opacity = (shot === "face" ? fadeIn(t, SH.face + 0.6, 0.5) : 0).toFixed(3);
  // the pulse trace, read from the face's colour: the last three seconds, drawn as a line
  const pts = []; for (let k = 0; k <= 90; k++) { const x = t - 3 + k / 30; pts.push(`${(k / 90 * 300).toFixed(1)},${(40 - 32 * beat(x) * (x > K.cam[0] ? 1 : 0.15)).toFixed(1)}`); }
  trace.setAttribute("points", pts.join(" "));

  // ── the model faces: computer faces before subsurface scattering beside a face whose light goes inside ──
  if (shot === "cg") buildCg();
  cgWrap.style.opacity = (shot === "cg" ? fadeIn(t, SH.cg, 0.4) : 0).toFixed(3);
  vf.set({ op: shot === "face" ? fadeIn(t, SH.face, 0.4) : shot === "cg" ? fadeIn(t, SH.cg, 0.4) : 0, left: shot === "cg" ? "" : "model skin · colour amplified", right: "" });

  // ── the depth chart ──
  const cOp = shot === "depth" ? fadeIn(t, SH.depth - 0.05, 0.3) * (1 - fadeIn(t, SH.macro2 - 0.5, 0.45)) : 0;
  chart.style.opacity = cOp.toFixed(3); chart.style.visibility = cOp > 0.002 ? "visible" : "hidden";
  barB.style.height = `${(D.blue_mm * PXMM * E.out3(seg(t, K.blue[0], K.blue[1]))).toFixed(1)}px`;
  sheets.forEach((s, i) => { s.style.opacity = (E.out3(seg(t, K.sheets[0] + i * 0.08, K.sheets[0] + i * 0.08 + 0.3))).toFixed(2); });
  barR.style.height = `${(D.red_mm[1] * PXMM * E.out3(seg(t, K.redbar[0], K.redbar[1]))).toFixed(1)}px`;
  vB.style.opacity = E.out3(seg(t, K.blue[1] - 0.2, K.blue[1] + 0.2)).toFixed(3); vS.style.opacity = E.out3(seg(t, K.sheets[1] - 0.2, K.sheets[1] + 0.2)).toFixed(3);
  hR.style.opacity = E.out3(seg(t, K.redbar[0], K.redbar[0] + 0.3)).toFixed(3); vR.style.opacity = E.out3(seg(t, K.redbar[1] - 0.2, K.redbar[1] + 0.2)).toFixed(3);
  day.set({ op: shot === "macro2" ? fadeIn(t, SH.macro2 + 0.3, 0.6) * (1 - fadeIn(t, FILM.endCard - 0.4, 0.4)) : 0 });

  photoNote.style.opacity = shot === "depth" ? "1" : "0";   // on every frame the photo is
  grain.set(t);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
