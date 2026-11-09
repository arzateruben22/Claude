import * as THREE from "three";
// Possibility Lab Season 2, Episode 1 (S2E01, folder ep07), "Walking to the Moon". The picture as a pure function of t for
// the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world and the overlay from t
// alone, then makes exactly one renderer.render().
//
// One world (bible §2), in true metres: you (anchor blue) stand on the graph-paper desk, the top of the Earth, and a thin
// line leaves the paper straight up to the Moon. The camera pulls back to the whole line (a ruler of thirty Earths), then
// DIVES onto a walker and chases it: the figures are drawn at a screen size (13% of the frame, low in it), not to scale,
// the Earth and the Moon shaded globes at true size. Three walkers climb the line on one clock of years: nonstop (about
// 9), eight hours a day (about 26, blue: you, in stop-and-go steps, with a bed, a table and a shoe popping in at each
// stop) and 10,000 steps a day (about 140). The takeaway sends a capsule up the line in three days. The last frame is
// frame 0. Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { createPlanet } from "../set/ladder05.js";
import { moonSurface } from "../../space/set/moon.js";
import { earthSurface } from "../../space/set/planet.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene(); window.__scene = scene;
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF";
const UP = new THREE.Vector3(0, 1, 0);

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 60 });
scene.add(desk.group);
const earth = createPlanet({ tokens: TK, R: WD.rE });                          // rests on the desk: its top is the paper
scene.add(earth.mesh);
const moon = createPlanet({ tokens: TK, R: WD.rM });
moon.mesh.position.set(0, WD.yMoon, 0);
scene.add(moon.mesh);
const you = createFigure({ tokens: TK, height: WD.fig });
you.set({ at: [0, WD.fig / 2, 0] });
scene.add(you.group);

// flat things in the world: a unit quad (width, length), a unit ring, a unit bead; each scaled to the camera's distance
const basic = (hex, o = 1) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: false, depthWrite: false });
const mk = (geo, hex, order = 4) => { const m = new THREE.Mesh(geo, basic(hex)); m.renderOrder = order; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); return m; };
const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);           // grows up from its foot
const lane = { A: mk(quad, CHALK, 4), B: mk(quad, ANCH, 5), S: mk(quad, CHALK2, 3), C: mk(quad, MARK, 6) };
const bead = { A: mk(new THREE.CircleGeometry(1, 28), CHALK, 7), B: mk(new THREE.CircleGeometry(1, 28), ANCH, 8), S: mk(new THREE.CircleGeometry(1, 28), CHALK2, 7), C: mk(new THREE.CircleGeometry(1, 28), MARK, 9) };
// the ruler: thirty Earths side by side, one ring each
const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 48), basic(CHALK2, 0.9), WD.n - 1);
rings.frustumCulled = false; rings.renderOrder = 2; rings.userData.noProbe = true;
scene.add(rings);
// shaded globes: a half-Lambert chalk sphere, the Earth with a pencil graticule, the Moon with a few darker craters
const SVS = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SFS = `precision highp float;
uniform vec3 uCol, uDark, uLight; uniform float uExposure, uOpacity, uGrat, uCrat, uUseMap; uniform sampler2D uMap; varying vec3 vN;
${ACES_INV_GLSL}
float hh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight));
  vec3 col = mix(uDark, uCol, lam);
  if (uGrat > 0.0) { vec2 q = vec2(asin(clamp(n.y, -1.0, 1.0)), atan(n.z, n.x)) / radians(30.0); vec2 f = abs(fract(q + 0.5) - 0.5) / max(fwidth(q), vec2(1e-4)); col = mix(col, uDark * 0.45, 0.55 * (1.0 - smoothstep(0.6, 1.6, min(f.x, f.y)))); }
  if (uCrat > 0.0) { vec3 c = floor(n * 3.0); vec3 cc = normalize((c + 0.5) / 3.0); col *= 1.0 - 0.28 * step(0.7, hh(c)) * smoothstep(0.38, 0.2, length(n - cc)); }
  if (uUseMap > 0.0) { float lon = atan(n.x, n.z), lat = asin(clamp(n.y, -1.0, 1.0)); vec3 tx = texture2D(uMap, vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5)).rgb; if (uUseMap > 1.5) col = mix(col, tx * (0.3 + 0.9 * lam) * 1.1, 0.7); else col *= tx / 0.6; }
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const moonTex = new THREE.CanvasTexture(moonSurface({ width: 512, seed: 9 })); moonTex.wrapS = THREE.RepeatWrapping; moonTex.anisotropy = 4;
const earthTex = new THREE.CanvasTexture(earthSurface({ width: 1024 })); earthTex.wrapS = THREE.RepeatWrapping; earthTex.anisotropy = 4;
const globe = (hex, grat, crat, earthMap) => {
  const c = hexRgb(hex), u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.28)) }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.8) },
    uExposure: { value: 1 }, uOpacity: { value: 1 }, uGrat: { value: grat }, uCrat: { value: 0 }, uUseMap: { value: earthMap ? 2 : crat ? 1 : 0 }, uMap: { value: earthMap ? earthTex : moonTex } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthTest: true, depthWrite: false, extensions: { derivatives: true } }));
  m.renderOrder = 5; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m);
  return { mesh: m, set: (o) => { m.visible = o > 0.01; u.uOpacity.value = o; } };
};
const ringE = globe(CHALK2, 0, 0, true), ringM = globe(CHALK, 0, 1);
const figTk = (hex) => ({ ...TK, anchor: hex });
const wkA = createFigure({ tokens: figTk(CHALK2), height: WD.fig }), wkB = createFigure({ tokens: TK, height: WD.fig }), wkS = createFigure({ tokens: figTk("#8A8D96"), height: WD.fig });
for (const w of [wkA, wkB, wkS]) { w.set({ at: [0, WD.fig / 2, 0] }); w.group.visible = false; scene.add(w.group); }
// props for the stops: a bed, a table, a shoe (boxes and ellipsoids in the same half-Lambert chalk as the globes)
const solid = (hex) => { const c = hexRgb(hex), u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.35)) }, uLight: { value: new THREE.Vector3(-0.55, 0.6, 0.8) }, uExposure: { value: 1 }, uOpacity: { value: 1 }, uGrat: { value: 0 }, uCrat: { value: 0 } };
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: SVS, fragmentShader: SFS, transparent: true, extensions: { derivatives: true } }); };
const MC = solid(CHALK), MC2 = solid(CHALK2), MB = solid(ANCH), MM = solid(MARK);
const bx = (w, h, dd, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); o.position.set(x, y, z); return o; };
const el = (rx, ry, rz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m); o.scale.set(rx, ry, rz); o.position.set(x, y, z); return o; };
const cy = (r, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m); o.position.set(x, y, z); return o; };
const prop = (kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); g.visible = false; g.userData.noProbe = true; scene.add(g); return g; };
const propBed = prop([bx(2.0, 0.34, 1.05, MC2, 0, 0.17, 0), bx(1.9, 0.2, 0.95, MC, 0, 0.44, 0), bx(0.5, 0.16, 0.75, MC, -0.7, 0.62, 0), bx(1.2, 0.26, 0.97, MB, 0.3, 0.6, 0)]);
const propTable = prop([bx(1.5, 0.12, 0.95, MC, 0, 0.95, 0), ...[[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]].map(([x, z]) => bx(0.1, 0.9, 0.1, MC2, x, 0.45, z)), cy(0.3, 0.05, MC2, -0.2, 1.03, 0), cy(0.12, 0.2, MM, 0.35, 1.1, 0.1)]);
const propShoe = prop([bx(1.2, 0.14, 0.46, MC2, 0, 0.07, 0), el(0.5, 0.3, 0.26, MC, -0.25, 0.3, 0), el(0.38, 0.2, 0.25, MC, 0.35, 0.2, 0), bx(0.5, 0.04, 0.05, MM, 0.0, 0.5, 0.0)]);
const tentG = new THREE.ConeGeometry(1.05, 1.3, 4); tentG.rotateY(Math.PI / 4); tentG.translate(0, 0.65, 0);
const propTent = prop([new THREE.Mesh(tentG, MC), bx(0.36, 0.62, 0.05, MC2, 0, 0.3, 0.62), bx(2.0, 0.05, 1.3, MC2, 0, 0.02, 0)]);
const capsule = (() => { const g = new THREE.Group();   // an Apollo command module: a blunt cone with a dark heat-shield base and a docking tip, no fins
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.36, 0.78, 28), MC), shield = cy(0.37, 0.07, MM, 0, 0.02, 0), tip = cy(0.1, 0.14, MC2, 0, 0.9, 0), ring = cy(0.2, 0.05, MC2, 0, 0.82, 0);
  body.position.set(0, 0.43, 0); const win = el(0.09, 0.09, 0.05, MB, 0, 0.5, 0.2);
  g.add(body, shield, tip, ring, win); g.visible = false; g.userData.noProbe = true; scene.add(g); return g; })();
const dial = (() => { const g = new THREE.Group(); const face = cy(0.75, 0.08, MC, 0, 0, 0), rim = cy(0.84, 0.06, MC2, 0, 0, -0.04); face.rotation.x = rim.rotation.x = Math.PI / 2;
  const hrH = bx(0.09, 0.42, 0.04, MB, 0, 0.21, 0.07), mnH = bx(0.06, 0.62, 0.04, MM, 0, 0.31, 0.09); hrH.geometry.translate(0, 0, 0); g.add(rim, face);
  const hp = new THREE.Group(), mp = new THREE.Group(); hp.add(hrH); mp.add(mnH); g.add(hp, mp);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, tk = bx(0.05, i % 3 ? 0.08 : 0.14, 0.03, MC2, Math.sin(a) * 0.64, Math.cos(a) * 0.64, 0.06); tk.rotation.z = -a; g.add(tk); }
  g.userData = { hp, mp }; g.visible = false; g.userData.noProbe = true; scene.add(g); return g; })();
const floorPatch = (m) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: unlit(CHALK), transparent: true, opacity: 0, depthWrite: false })); o.visible = false; o.userData.noProbe = true; o.renderOrder = 3; scene.add(o); return o; };
const patches = [floorPatch(), floorPatch(), floorPatch(), floorPatch()];
const orbitRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: unlit(CHALK2), transparent: true, opacity: 0, depthTest: false, depthWrite: false })); orbitRing.visible = false; orbitRing.renderOrder = 4; orbitRing.userData.noProbe = true; scene.add(orbitRing);
const trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: unlit(MARK), transparent: true, opacity: 0, depthTest: false, depthWrite: false })); trail.geometry.translate(0, -0.5, 0); trail.visible = false; trail.renderOrder = 6; trail.userData.noProbe = true; scene.add(trail);
// the Earth and the Moon, outlined
const limbO = mk(new THREE.CircleGeometry(1, 128), CHALK2, 1), limbI = mk(new THREE.CircleGeometry(1, 128), TK.graphite || "#171A1E", 2);   // the Earth's edge in section, a thin chalk arc
const mark = mk(new THREE.CircleGeometry(1, 48), CHALK, 7);
const craters = [[-0.32, 0.28, 0.2], [0.30, -0.05, 0.28], [-0.1, -0.42, 0.15]].map(([x, y, r]) => ({ x, y, r, m: mk(new THREE.CircleGeometry(1, 24), CHALK2, 8) }));                   // the hook's small Moon, "not to scale", on the line above you

// scenery for the chase: star dust at random depths (both only near
const NDUST = 2600, dust = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), basic(CHALK2, 0.5), NDUST);
dust.frustumCulled = false; dust.renderOrder = 1; dust.userData.noProbe = true; scene.add(dust);
{ let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const MD = new THREE.Matrix4(), QD = new THREE.Quaternion(), SD = new THREE.Vector3(), PD = new THREE.Vector3();
  for (let i = 0; i < NDUST; i++) { const r = 3e4 + rnd() * rnd() * 1.0e5; SD.set(r, r, 1); PD.set((rnd() - 0.5) * 3.2e7, rnd() * WD.top, (rnd() - 0.5) * 3.2e7); MD.compose(PD, QD, SD); dust.setMatrixAt(i, MD); } dust.instanceMatrix.needsUpdate = true; }

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const LANE_X = { A: -1, B: 0, S: 1 };                                             // lane offsets as multiples of `off`
let off = 0;                                                                      // set in seek: metres, scales with the camera's distance
const PATH = (arr) => (t) => { const x = Math.max(0, t) * CUE.fps, i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
const frac = { A: PATH(CUE.pathA), B: PATH(CUE.pathB), S: PATH(CUE.pathS) };
let figH = 1.7;                                                                   // the walkers' height this frame (13% of the frame's height at any distance)
const wpos = (k) => { const t = window.__t || 0; return [LANE_X[k] * off, WD.top * frac[k](t), 0]; };
const PROPX = { bed: 1.45, table: -1.5, shoe: 1.4, tent: 1.5 };
const ppos = (name) => { const p = wpos("B"); return [p[0] + PROPX[name] * figH, p[1], 0]; };
const AN = {
  you: () => [0, WD.fig, 0], earth: () => [0, -WD.rE * 0.6, 0], moon: () => [0, WD.yMoon + WD.rM * 1.25, 0],
  walkA: () => wpos("A"), walkB: () => wpos("B"), walkS: () => wpos("S"),
  bed: () => ppos("bed"), table: () => ppos("table"), shoe: () => ppos("shoe"),
  capsule: () => { const t = window.__t || 0; return [CUE.lane * off + 0.9 * figH, WD.top * Math.min(1, seg(t, CUE.apollo[0], CUE.apollo[1])), 0]; },
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => String(Math.round(v)), minCh: 3,
    unit: "yr", lit: (v) => v >= c.end - 0.4 });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.17 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.14 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "5.6vmin"; if (endFo) endFo.style.marginTop = "1.6vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.7vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "1.6vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const place = (m, x, y, sx, sy) => { m.position.set(x, y, 0); m.scale.set(sx, sy, 1); };
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist; window.__d = d;
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 30); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const space = d > 3e5;
  const px = d * 0.0016;                                                           // a few pixels, at any distance

  // the planets: graticule only where it reads; the desk fades as the paper stops being the world
  earth.set({ opacity: 0, cam: camera.position.toArray(), grid: 1 - seg(Math.log10(d), 3.5, 5.5) });
  moon.set({ opacity: 0, cam: camera.position.toArray(), grid: 1 });
  desk.group.visible = d < 90;
  desk.update({ grid: 1 - seg(Math.log10(d), 1.3, 1.9), pool: [pose.target[0], pose.target[2]], casters: [[0, WD.fig, 0, 0.35]], span: Math.max(800, d * 8) });
  desk.uniforms.uExposure.value = 1 + 5 * seg(Math.log10(d), 1.4, 1.95);                // the paper darkens before the desk is hidden: no bright slab, no pop
  you.group.visible = d < 4e3 && (shot !== "end" || t > FILM.endCard + 1.5);

  // the lanes spread as the walk begins, then rest
  const spread = E.inout2(seg(t, CUE.spread[0], CUE.spread[1]));
  off = d * 0.05 * (space ? spread : 0) * (shot === "end" ? 1 - E.inout2(seg(t, FILM.endCard + 0.3, FILM.endCard + 1.6)) : 1);
  if (d < 3e5) off = d * 0.05 * spread;                                           // in a chase the lanes sit a body apart
  const afterHome = E.inout2(seg(t, CUE.home, CUE.home + 0.3)), moonSlide = E.inout2(seg(t, CUE.home + 0.35, CUE.home + 1.0));
  figH = 0.055 * d;
  const hs = figH / WD.fig, outG = shot === "end" ? gate : 1;
  const moonScale = 0.3 + 0.7 * seg(Math.log10(d), 8.5, 9.3);                      // the Moon is drawn smaller near it, so it never climbs behind the caption
  const bigMoon = seg(t, CUE.bigMoon[0], CUE.bigMoon[0] + 0.6) * (1 - E.inout2(seg(t, CUE.bigMoon[1], CUE.bigMoon[1] + 0.6)));
  const moonX = CUE.lane * off * (1 - moonSlide);                                  // the Moon sits over the capsule lane (right of the three walkers) while the walkers stand at its foot: never behind a figure
  const rE = Math.max(WD.rE, px * 3.4), rM = Math.max(WD.rM * moonScale, px * 3.0, 0.021 * d * bigMoon);
  const moonCy = rM < WD.rM ? WD.top + rM : Math.max(WD.yMoon, WD.top + rM * bigMoon);
  const fA = frac.A(t), fB = frac.B(t), fS = frac.S(t);
  const top = WD.top, pre = shot === "front" || shot === "pull" || t < CUE.spread[0];
  const endLine = shot === "end" ? E.inout2(seg(t, FILM.dur - 0.7, FILM.dur - 0.45)) : 0;   // the loop: the line and the little Moon return once the card has lifted
  const setLane = (k, x, f, w, o) => { const l = lane[k]; l.visible = o > 0.003; l.material.opacity = o; place(l, x, 0, w, Math.max(1e-6, top * f)); };
  const hookLine = pre ? 1 : 0, lanesOn = !pre && shot !== "end" ? (1 - afterHome) : 0;
  setLane("B", LANE_X.B * off, hookLine || endLine > 0 ? 1 : fB, px * (hookLine || endLine > 0 ? 0.6 : 1.0), hookLine ? 0.8 : shot === "end" ? Math.max(0.0, 0.8 * endLine) : seg(t, CUE.run[2] - 0.2, CUE.run[2] + 0.3) * lanesOn);
  setLane("A", LANE_X.A * off, fA, px * 0.9, seg(t, CUE.spread[1], CUE.run[0]) * lanesOn);
  setLane("S", LANE_X.S * off, fS, px * 0.7, seg(t, CUE.run[2], CUE.run[1]) * lanesOn);
  // the walkers: big figures, each bobbing as it walks, still when it stops
  const moving = (P, tt) => Math.abs(P(tt + 0.05) - P(tt - 0.05)) > 1e-6;
  const walk = (w, x, f, P, on, hex) => {
    const mv = moving(P, t) ? 1 : 0, ph = t * 7.5;
    w.group.visible = on > 0.02; w.group.scale.setScalar(hs);
    w.set({ at: [x, top * f + (mv ? Math.abs(Math.sin(ph)) * 0.035 * figH : 0) + hs * WD.fig / 2, 0], arms: mv ? 0.12 + 0.12 * Math.sin(ph) : 0.04, tilt: mv ? 0.05 : 0 });
  };
  const hideAB = E.inout2(seg(t, CUE.gf - 0.1, CUE.gf + 0.3));
  const hideMoon = hideAB * (1 - E.inout2(seg(t, CUE.home - 0.5, CUE.home - 0.1)));
  const hideA = E.inout2(seg(t, CUE.run[2] - 0.3, CUE.run[2] + 0.2)) * (1 - E.inout2(seg(t, CUE.box - 0.6, CUE.box - 0.1)));   // the nonstop walker rests at the Moon while the camera dives to the blue one
  const wkAOn = (1 - hideAB) * (1 - hideA) * seg(t, CUE.spread[1] - 0.2, CUE.spread[1] + 0.3) * lanesOn * (pre ? 0 : 1);
  const wkBOn = (1 - hideAB) * seg(t, CUE.run[2] - 0.2, CUE.run[2] + 0.3) * lanesOn * (pre ? 0 : 1);
  walk(wkA, LANE_X.A * off, fA, frac.A, wkAOn);
  walk(wkB, LANE_X.B * off, fB, frac.B, wkBOn);
  walk(wkS, LANE_X.S * off, fS, frac.S, seg(t, CUE.run[2], CUE.run[1]) * lanesOn * (pre ? 0 : 1));
  for (const k of ["A", "B", "S", "C"]) bead[k].visible = false;
  // the stops: a bed, a table and a shoe pop in beside the blue walker, one after another
  const popU = (t0, t1) => E.back(seg(t, t0, t0 + 0.32)) * (1 - E.in3(seg(t, t1 - 0.28, t1)));
  const prp = (g, name, t0, t1, rot) => { const u = Math.max(0, popU(t0, t1)), p = wpos("B"); g.visible = u > 0.01 && t > t0 && t < t1; g.scale.setScalar(hs * u); g.position.set(p[0] + PROPX[name] * figH, p[1], 0); g.rotation.y = rot + 0.25 * Math.sin(t * 2); };
  prp(propTent, "tent", CUE.props.rest, CUE.props.rest + 1.6, -0.35);
  prp(propBed, "bed", CUE.props.bed, CUE.props.bed + 1.0, -0.55); prp(propTable, "table", CUE.props.table, CUE.props.table + 1.0, 0.5); prp(propShoe, "shoe", CUE.props.shoe, CUE.props.shoe + 1.2, -0.5);
  // grounding: a short chalk ledge under each prop, and a time clock over you at the Moon (the hands sweep eight hours)
  [["bed", propBed, CUE.props.bed, 1.0], ["table", propTable, CUE.props.table, 1.0], ["shoe", propShoe, CUE.props.shoe, 1.2], ["tent", propTent, CUE.props.rest, 1.6]].forEach(([nm, g, t0, dur], i) => {
    const u = Math.max(0, popU(t0, t0 + dur)), p = wpos("B"), o = patches[i];
    o.visible = g.visible; o.material.opacity = 0.45 * Math.min(1, u); o.position.set(p[0] + PROPX[nm] * figH, p[1] - 0.012 * figH, 0); o.scale.set(2.5 * hs, 0.05 * hs, 1);
  });
  { const u = Math.max(0, popU(CUE.clock[0], CUE.clock[1])), p = wpos("B"), on = u > 0.01 && t > CUE.clock[0] && t < CUE.clock[1];
    dial.visible = false;   // the time clock is dropped: in the finished picture its face went black at the left edge (coordinator round 7)
     dial.scale.setScalar(hs * 0.95 * u); dial.position.set(-(off + 0.72 * figH), p[1] + 0.75 * figH, 0);
    const sw = E.inout2(seg(t, CUE.clock[0] + 0.1, CUE.clock[1] - 0.3)); dial.userData.hp.rotation.z = -sw * Math.PI * 2 * 8 / 12; dial.userData.mp.rotation.z = -sw * Math.PI * 2 * 8; }
  // the Apollo capsule: a real capsule in its own fourth lane, climbing in three "days" and landing on "three", then orbiting the Moon
  const cap = seg(t, CUE.apollo[0], CUE.apollo[1]), capE = cap, capOn = seg(t, CUE.apollo[0] - 0.1, CUE.apollo[0] + 0.15) * (1 - E.in3(seg(t, FILM.endCard - 0.7, FILM.endCard - 0.1)));
  const orb = seg(t, CUE.orbit[0], CUE.orbit[1]), Ro = 1.55 * rM, cx = CUE.lane * off * (1 - moonSlide), moonY = moonCy, ang0 = -Math.PI / 2 + 0.2, ang = ang0 + orb * Math.PI * 2 * 1.4;
  let cxp = cx, cyp = top * capE, rot = 0;
  if (t > CUE.apollo[1]) { const o2 = E.inout2(seg(t, CUE.apollo[1], CUE.orbit[0])), px0 = moonX + Ro * Math.cos(ang), py0 = moonY + Ro * Math.sin(ang), sx = moonX + Ro * Math.cos(ang0), sy = moonY + Ro * Math.sin(ang0);
    const bx0 = cx + (sx - cx) * o2, by0 = top + (sy - top) * o2; cxp = t < CUE.orbit[0] ? bx0 : px0; cyp = t < CUE.orbit[0] ? by0 : py0; rot = t < CUE.orbit[0] ? 0 : ang; }
  orbitRing.visible = capOn > 0.02 && t > CUE.apollo[1] + 0.2 && shot !== "end"; orbitRing.material.opacity = 0.35 * E.out3(seg(t, CUE.apollo[1], CUE.orbit[0])) * capOn; orbitRing.position.set(moonX, moonY, 0); orbitRing.scale.set(Ro, Ro, 1);
  setLane("C", cx, cap, px * 1.0, 0.45 * capOn * (1 - seg(t, CUE.apollo[1] - 0.6, CUE.apollo[1] - 0.1)));
  capsule.visible = capOn > 0.02 && shot !== "end"; capsule.scale.setScalar(figH * 0.5); capsule.position.set(cxp, cyp, 0); capsule.rotation.z = rot;
  trail.visible = capsule.visible && t < CUE.apollo[1] - 0.05; trail.material.opacity = 0.5 * capOn; trail.scale.set(figH * 0.22, Math.min(top * capE, figH * 5), 1); trail.position.set(cx, top * capE - figH * 0.4, 0);
  for (const k of ["A", "B", "S", "C"]) bead[k].visible = false;

  // the ruler: thirty Earths, 29 rings between you and the Moon, each appearing in turn
  for (let i = 1; i < WD.n; i++) {
    const on = E.out3(seg(t, CUE.rings[0] + (CUE.rings[1] - CUE.rings[0]) * (i - 1) / (WD.n - 1), CUE.rings[0] + (CUE.rings[1] - CUE.rings[0]) * (i - 1) / (WD.n - 1) + 0.25));
    const out = shot === "end" ? gate : 1;
    const r = WD.rE * on * out;
    S3.set(r, r, 1); P3.set(0, -WD.rE + i * WD.earthKm * 1e3, 0); M.compose(P3, Q, S3); rings.setMatrixAt(i - 1, M);
  }
  rings.instanceMatrix.needsUpdate = true;
  const near = 1 - seg(Math.log10(d), 7.9, 8.3);
  dust.visible = near > 0.02 && shot !== "front" && shot !== "pull" && shot !== "end"; dust.material.opacity = 0.5 * near;
  rings.visible = space && (shot === "pull" || shot === "end"); rings.material.opacity = 0.9 * seg(Math.log10(d), 8.2, 8.6);
  const pl = seg(Math.log10(d), 5.2, 6.8) * (shot === "end" ? gate : 1) * (1 - hideMoon);
  const mv = new THREE.Vector3(moonX, moonCy, 0).project(camera), mq = (1 - mv.y) / 2;           // where the Moon is on screen, from the top
  const bandFade = 1 - E.inout2(seg(mq, 0.49, 0.57)) * (1 - E.inout2(seg(mq, 0.69, 0.77)));   // the Moon never sits in the caption and plate band: it fades while it passes
  ringE.set(pl * seg(Math.log10(d), 7.5, 8.3)); ringM.set(pl * bandFade);
  const lm = seg(d, 80, 120) * (1 - seg(Math.log10(d), 6.2, 6.6)) * (shot === "end" ? gate : 1);
  limbO.visible = limbI.visible = lm > 0.01; limbO.material.opacity = 0.3 * lm; limbI.material.opacity = 1;
  place(limbO, 0, -WD.rE, WD.rE + px * 0.9, WD.rE + px * 0.9); place(limbI, 0, -WD.rE, WD.rE - px * 0.9, WD.rE - px * 0.9);
  ringE.mesh.position.set(0, -rE, -1.35 * rE); ringE.mesh.scale.set(rE, rE, rE);
  ringM.mesh.position.set(moonX, moonCy, -0.15 * rM); ringM.mesh.scale.set(rM, rM, rM);
  // the hook's small moon on the line above you: fades once the real one is findable
  const mk0 = 1 - E.inout2(seg(Math.log10(d), 1.5, 2.3));
  mark.visible = mk0 > 0.01 && d < 4e3 && (shot !== "end" || endLine > 0.01); mark.material.opacity = 0.9 * mk0 * (shot === "end" ? endLine : 1);
  const mr = 0.26 + Math.max(0, d - 17) * 0.012, my = 3.75 + Math.max(0, d - 17) * 0.2;
  mark.position.set(0, my, 0); mark.scale.set(mr, mr, 1);
  for (const c of craters) { c.m.visible = mark.visible; c.m.material.opacity = 0.9 * mk0; c.m.position.set(c.x * mr, my + c.y * mr, 0); c.m.scale.set(c.r * mr, c.r * mr, 1); }

  // debug hook for the overlap checker (screen pixels: figures as boxes, the Moon as a circle, lanes as columns)
  { const P = (x, y) => { const v = new THREE.Vector3(x, y, 0).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
    const figs = []; for (const [k, w, on] of [["A", wkA, wkAOn], ["B", wkB, wkBOn], ["S", wkS, seg(t, CUE.run[2], CUE.run[1]) * lanesOn]]) if (on > 0.3) { const p = wpos(k), a = P(p[0], p[1] - 0.5 * figH), b = P(p[0], p[1] + 0.5 * figH), wd = Math.abs(b[1] - a[1]) * 0.28; figs.push([a[0] - wd, Math.min(a[1], b[1]), a[0] + wd, Math.max(a[1], b[1]), k]); }
    const mc = P(moonX, moonCy), me = P(moonX + rM, moonCy);
    const lanes = []; for (const [k, l] of Object.entries(lane)) if (l.visible && l.material.opacity > 0.15) lanes.push([P(l.position.x, 0)[0], l.material.opacity, k]);
    window.__dbg = { figs, moon: ringM.mesh.visible && ringM.mesh.material.uniforms.uOpacity.value > 0.2 ? [mc[0], mc[1], Math.abs(me[0] - mc[0])] : null, lanes, shot, mark: mark.visible ? [mark.material.opacity] : null }; }
  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 1.1, beat("tease").t1 - 0.35));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  { const sc = document.querySelector(".hud-scrim"); if (sc && t >= FILM.endCard) sc.style.opacity = String(Number(sc.style.opacity || 0) * 0.45); }
  tFlap.update(t);
  { let h = 0; for (const [a, b] of (FILM.spineHide || [])) h = Math.max(h, seg(t, a, a + 0.25) * (1 - seg(t, b - 0.01, b + 0.25))); spine.update(t, gate * (1 - h)); }
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
