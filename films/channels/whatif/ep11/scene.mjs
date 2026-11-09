import * as THREE from "three";
// Possibility Lab Season 2, Episode 5 (S2E05, folder ep11), "All the water in one ball". The picture as a pure function of t for the
// film kit's page: window.seek(t) sets the shot, the camera, the world and the overlay from t alone, then renders once.
//
// The world: you beside a glass of water on the graph paper (the loop's frame 0); the water gathers into a floating ball. Then a stage
// in kilometres, all to scale: six sources stream into one ball that swells to 1,383 km; the Moon sits to its left and the Earth to its
// right; the fresh-water ball (404 km) sits beside it in the work shot; the Earth wears a thin blue film (drawn thicker). Hard cuts
// between the scales. Everything timed comes from film.json (compile.py); this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../set/aces.js";
import { earthSurface } from "../../space/set/planet.js";
import { moonSurface } from "../../space/set/moon.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.15 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF";
const BALL_R = WD.ballR, FRESH_R = WD.freshR, MOON_R = WD.moonR, EARTH_R = WD.earthR, MOON_X = WD.moonX, EARTH_X = WD.earthX;
const FRESH_X = 1250;

// ── materials ───────────────────────────────────────────────────────────────
const basic = (hex, o = 1, depth = true) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: depth, depthWrite: false });
const box = (hex, o = 1, order = 4) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(hex, o)); m.renderOrder = order; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); return m; };
const SVS = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SFS = `precision highp float; uniform vec3 uCol, uDark, uLight; uniform float uExposure, uOpacity, uMix; uniform sampler2D uMap; uniform float uSpin; varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight)); vec3 col = mix(uDark, uCol, lam);
  float lon = atan(n.x, n.z) + uSpin, lat = asin(clamp(n.y, -1.0, 1.0)); vec3 tx = texture2D(uMap, vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5)).rgb;
  col = mix(col, tx * (0.3 + 0.9 * lam) * 1.1, uMix);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const waterCanvas = () => { const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#3C8DF0"); gr.addColorStop(1, "#1E62BC"); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  let sd = 5; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${(0.05 + 0.08 * rn()).toFixed(3)})`; g.beginPath(); g.ellipse(rn() * 512, rn() * 256, 12 + 50 * rn(), 1.5 + 4 * rn(), 0, 0, 7); g.fill(); }
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(8,30,90,${(0.06 + 0.1 * rn()).toFixed(3)})`; g.beginPath(); g.ellipse(rn() * 512, rn() * 256, 10 + 40 * rn(), 2 + 4 * rn(), 0, 0, 7); g.fill(); }
  return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const waterTex = tex(waterCanvas()), earthTex = tex(earthSurface({ width: 1024 })), moonTex = tex(moonSurface({ width: 512, seed: 9 }));
const globe = (map, hex, mix) => { const c = hexRgb(hex), u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.28)) }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.8) }, uExposure: { value: 1 }, uOpacity: { value: 1 }, uMix: { value: mix }, uMap: { value: map }, uSpin: { value: 0 } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: true, extensions: { derivatives: true } }));
  m.renderOrder = 3; m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const ball = globe(waterTex, ANCH, 0.85), freshBall = globe(waterTex, ANCH, 0.85), nearBall = globe(waterTex, ANCH, 0.85);
const moon = globe(moonTex, CHALK2, 0.8), earth = globe(earthTex, CHALK2, 0.7);
// the Earth's film of water: a thin blue shell, bright at the limb
const FVS = `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FFS = `precision highp float; uniform vec3 uCol; uniform float uO; varying vec3 vN;
${ACES_INV_GLSL}
void main() { float rim = pow(1.0 - abs(vN.z), 1.5); float a = clamp(rim * 1.15, 0.0, 1.0) * uO; if (a < 0.01) discard;
  gl_FragColor = vec4(acesInv(srgbToLinear(uCol), 1.0), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const film = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(ANCH)) }, uO: { value: 1 } }, vertexShader: FVS, fragmentShader: FFS, transparent: true, depthWrite: false }));
film.renderOrder = 4; film.frustumCulled = false; film.userData.noProbe = true; film.visible = false; scene.add(film);

// ── the near stage: the paper, you, a glass of water ────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);
const you = createFigure({ tokens: TK, height: 1.7 });
scene.add(you.group);
const glassG = new THREE.CylinderGeometry(0.2, 0.17, 0.62, 28, 1, true); glassG.translate(0, 0.31, 0);
const glass = new THREE.Mesh(glassG, new THREE.MeshBasicMaterial({ color: unlit(CHALK), transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })); glass.renderOrder = 5; glass.userData.noProbe = true; scene.add(glass);
const rimG = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 40), basic(CHALK, 0.9)); rimG.rotation.x = Math.PI / 2; rimG.position.y = 0.62; rimG.renderOrder = 6; rimG.userData.noProbe = true; scene.add(rimG);
const waterG = new THREE.CylinderGeometry(0.19, 0.165, 1, 28); waterG.translate(0, 0.5, 0);
const water = new THREE.Mesh(waterG, new THREE.MeshBasicMaterial({ color: new THREE.Color("#1F5FD0"), toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false })); water.renderOrder = 4; water.userData.noProbe = true; scene.add(water);
const GX = 0.65;

// ── the stage in km ─────────────────────────────────────────────────────────
const NODEP = [[-950, 560], [950, 560], [-980, 0], [980, 0], [-950, -560], [950, -560]];
const NODEC = ["#2F7FE0", "#D8EEF8", "#4DA3FF", "#7FD0C4", "#C79BFF", "#A7AAB2"];
const nodes = NODEC.map((hex) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), basic(hex, 1, false)); m.renderOrder = 5; m.visible = false; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); return m; });
const NP = 70, drops = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), basic(ANCH, 0.95, false), 6 * NP); drops.frustumCulled = false; drops.renderOrder = 6; drops.userData.noProbe = true; drops.visible = false; scene.add(drops);
const Mx = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
const rulerBar = box(CHALK, 1, 8), rulerA = box(CHALK, 1, 8), rulerB = box(CHALK, 1, 8);
const rulerTicks = Array.from({ length: 6 }, () => box(MARK, 1, 9));
// star dust (km scale): parallax for the pull-back, so no frame is ever empty
const dust = (() => { const n = 1800, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.5, false), n); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 2; scene.add(m);
  let sd = 31; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const Mt = new THREE.Matrix4(), Pp = new THREE.Vector3(), Ss = new THREE.Vector3(), Qq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 5 + rn() * rn() * 22; Ss.set(r, r, 1); Pp.set(-9000 + rn() * 30000, (rn() - 0.5) * 22000, -9000 - rn() * 8000); Mt.compose(Pp, Qq, Ss); m.setMatrixAt(i, Mt); } m.instanceMatrix.needsUpdate = true; return m; })();
const dustN = (() => { const n = 500, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.4, false), n); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 2; scene.add(m);
  let sd = 77; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647; const Mt = new THREE.Matrix4(), Pp = new THREE.Vector3(), Ss = new THREE.Vector3(), Qq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 0.02 + rn() * rn() * 0.07; Ss.set(r, r, 1); Pp.set((rn() - 0.5) * 12, rn() * 7 - 0.5, -2 - rn() * 6); Mt.compose(Pp, Qq, Ss); m.setMatrixAt(i, Mt); } m.instanceMatrix.needsUpdate = true; return m; })();

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const AN = {
  "ruler-end": () => [BALL_R, 0, 0], "moon-top": () => [MOON_X - 0.7 * MOON_R, 0.7 * MOON_R, 0], "ball-top": () => [0, BALL_R, 0],
  "earth-top": () => [EARTH_X - 0.7 * EARTH_R, 0.7 * EARTH_R, 0], "fresh-top": () => [FRESH_X, FRESH_R, 0], "fresh-bottom": () => [FRESH_X, -FRESH_R, 0],
};
NODEP.forEach((p, i) => { AN["node" + i] = () => [p[0], p[1] + 120, 0]; });
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => Math.round(v).toLocaleString("en-US"), minCh: 5, unit: c.unit, lit: (v) => v >= c.end - 0.05 });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.14 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "5.6vmin"; if (endFo) endFo.style.marginTop = "1.6vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.7vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "1.6vmin auto 0" });
const ebox = endBox(endEl, { t0: FILM.endCard, answer: FILM.endAnswer, S1: Math.min(W, H) / 1080 });
const dimEl = document.createElement("div"); dimEl.style.cssText = "position:absolute;inset:0;background:#171A1E;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dimEl);

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const cbrt = Math.cbrt;

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist; window.__d = d; window.__cam = { pose: [pose.target, pose.dist, pose.el, pose.az, pose.fy], pos: camera.position.toArray() };
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 60); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const near = shot === "glass" || shot === "end", far = !near;
  const px = d * 0.00023;                                         // km per pixel (at 1920 px tall)

  // the near stage
  desk.group.visible = near;
  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: [[-0.5, 1.7, 0, 0.35]], span: 800 });
  desk.uniforms.uExposure.value = 1;
  you.group.visible = near; you.set({ at: [-0.5, 0.85, 0.2], arms: 0.06, tilt: 0 });
  const g = near ? (shot === "end" ? 0 : seg(t, CUE.gather[0], CUE.gather[1] + 0.3)) : 0, gu = E.inout2(g);
  glass.visible = false; rimG.visible = near; glass.position.set(GX, 0, 0); rimG.position.set(GX, 0.62, 0);
  const lvl = 0.56 * (1 - gu); water.visible = near && lvl > 0.01; water.position.set(GX, 0.01, 0); water.scale.set(1, Math.max(0.001, lvl), 1);
  const bob = 0.035 * Math.sin(2 * Math.PI * t / FILM.dur * 5);
  nearBall.visible = near; nearBall.position.set(GX, 1.02 + bob, 0); nearBall.scale.setScalar(0.15 + 0.2 * gu); nearBall.material.uniforms.uSpin.value = 2 * Math.PI * t / FILM.dur * 3;
  dustN.visible = near;

  // the km stage
  const inPool = shot === "pool", inWhy = shot === "why", sp = shot === "moon" || shot === "earth" || shot === "take" || inWhy;
  const v = clamp01((t - CUE.vol[0]) / (CUE.vol[1] - CUE.vol[0]));
  const rGrow = inPool ? Math.max(22, BALL_R * cbrt(E.inout2(v))) : BALL_R;
  const pulse = inPool ? 1 + 0.03 * Math.sin(Math.PI * seg(t, CUE.squeeze[0], CUE.squeeze[0] + 0.9)) - 0.03 * seg(t, CUE.squeeze[0] + 0.9, CUE.squeeze[1]) * 0 : 1;
  ball.visible = far && shot !== "work" ? true : shot === "work";
  ball.position.set(0, 0, 0); ball.scale.setScalar(rGrow * pulse); ball.material.uniforms.uSpin.value = 2 * Math.PI * t / FILM.dur * 2;
  const wk = shot === "work", fr = wk ? E.out3(seg(t, CUE.fresh[0], CUE.fresh[0] + 0.7)) : 0;
  freshBall.visible = wk && fr > 0.01; freshBall.position.set(FRESH_X, 0, 0); freshBall.scale.setScalar(Math.max(1, FRESH_R * fr));
  moon.visible = sp && shot !== "take"; moon.position.set(MOON_X, 0, 0); moon.scale.setScalar(MOON_R); moon.material.uniforms.uSpin.value = 0.5;
  earth.visible = sp; earth.position.set(EARTH_X, 0, 0); earth.scale.setScalar(EARTH_R); earth.material.uniforms.uSpin.value = 2 * Math.PI * t / FILM.dur;
  const fo = shot === "take" ? E.out3(seg(t, CUE.home + 0.2, CUE.home + 1.0)) : 0;
  film.visible = fo > 0.01; film.position.set(EARTH_X, 0, 0); film.scale.setScalar(EARTH_R * 1.012); film.material.uniforms.uO.value = fo;
  dust.visible = far && !wk; dust.material.opacity = 0.5;

  // the sources
  const NV = inPool && t < CUE.vol[1] + 1.4;
  nodes.forEach((m, i) => { const born = E.out3(seg(t, CUE.nodes[i] - 0.1, CUE.nodes[i] + 0.4)), dr = seg(t, CUE.nodes[i] + 0.3, CUE.vol[1]), gone = 1 - E.inout2(seg(t, CUE.vol[1] + 0.2, CUE.vol[1] + 1.2));
    const s = 118 * born * (1 - 0.8 * dr) * gone; m.visible = NV && s > 1; m.position.set(NODEP[i][0], NODEP[i][1], 0.5); m.scale.setScalar(Math.max(1, s)); });
  drops.visible = NV;
  { let k = 0; for (let i = 0; i < 6; i++) { const t0 = CUE.nodes[i], act = t > t0 && t < CUE.vol[1] + 0.4;
      for (let j = 0; j < NP; j++, k++) { let s = ((t - t0) * 0.55 + j / NP) % 1; if (s < 0) s += 1; const on = act ? Math.sin(Math.PI * s) : 0;
        const bx = NODEP[i][0], by = NODEP[i][1], cx = bx * 0.25 + (i % 2 ? -1 : 1) * 260, cy = by * 0.9; const u = 1 - s;
        const x = u * u * bx + 2 * u * s * cx, y = u * u * by + 2 * u * s * cy;
        S3.set(Math.max(0.01, 20 * on), Math.max(0.01, 20 * on), 1); P3.set(x, y, 1); Mx.compose(P3, Q0, S3); drops.setMatrixAt(k, Mx); } }
    drops.instanceMatrix.needsUpdate = true; }

  // the ruler across the ball
  const ru = shot === "pool" ? E.inout2(seg(t, CUE.ruler[0], CUE.ruler[0] + 0.9)) : 0, rt = Math.max(2, px * 3.2);
  rulerBar.visible = ru > 0.01; rulerBar.scale.set(2 * BALL_R * ru, rt, 1); rulerBar.position.set(0, 0, BALL_R + 5);
  for (const [m, sx] of [[rulerA, -1], [rulerB, 1]]) { m.visible = ru > 0.99; m.scale.set(rt, px * 46, 1); m.position.set(sx * BALL_R, 0, BALL_R + 5); }
  rulerTicks.forEach((m, i) => { const x = -BALL_R + (2 * BALL_R) * (i + 1) / 7; m.visible = ru > 0.99; m.scale.set(rt * 0.8, px * 24, 1); m.position.set(x, 0, BALL_R + 5); });

  // the end: the dim under the end card, lifted on the bare scene once the card text is gone
  dimEl.style.opacity = String((0.88 * seg(t, FILM.endCard - 0.25, FILM.endCard + 0.3) * (1 - seg(t, beat("tease").t1 - 0.75, beat("tease").t1 - 0.05))).toFixed(3));

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 1.35, beat("tease").t1 - 0.8));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  ebox.update(t);
  void clamp01; void W;
  renderer.render(scene, camera);
};
