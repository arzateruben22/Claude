import * as THREE from "three";
// Possibility Lab Season 2, Episode 2 (S2E02, folder ep08), "Everyone holds hands". The picture as a pure function of t for
// the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the world and the overlay from t alone,
// then makes exactly one renderer.render().
//
// The world: a chain of people (instanced figures, kids and grown-ups, hand in hand) runs off along the graph paper with you,
// in blue, at its head. The camera cranes up and pulls back (distance eased in log space) to the planet: the chain is a thread
// that leaves the ground and runs off into space, 13.1 million km long; it is wound round the Earth, one great circle per lap
// (327 thin rings), then laid out between the Earth and the Moon (34 trips). The camera returns to frame 0 for the loop.
// Everything timed comes from film.json, which compile.py hangs on the voice; this file only stages it.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createFigure } from "../set/anchor.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../set/aces.js";

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

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF", GRAPH = TK.graphite || "#171A1E";
const R_E = WD.rE;

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);
const you = createFigure({ tokens: TK, height: 1.7 });
scene.add(you.group);
const basic = (hex, o = 1, depth = false) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: depth, depthWrite: false });
// shaded chalk: half-Lambert from one lamp, output through the finish's inverse; fog to the ground colour by distance (the chain fades into the horizon)
const SVS = `varying vec3 vN; varying vec3 vW;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const IVS = `varying vec3 vN; varying vec3 vW;
void main() { vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SFS = `precision highp float;
uniform vec3 uCol, uDark, uLight, uBg, uCam; uniform float uExposure, uOpacity, uGrat, uFog0, uFog1; varying vec3 vN; varying vec3 vW;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight));
  vec3 col = mix(uDark, uCol, lam);
  if (uGrat > 0.0) { vec3 g = vec3(n.x, n.z, -n.y); vec2 q = vec2(asin(clamp(g.y, -1.0, 1.0)), atan(g.z, g.x)) / radians(30.0); vec2 f = abs(fract(q + 0.5) - 0.5) / max(fwidth(q), vec2(1e-4)); col = mix(col, uDark * 0.45, 0.55 * (1.0 - smoothstep(0.6, 1.6, min(f.x, f.y)))); }
  float fg = smoothstep(uFog0, uFog1, length(vW - uCam)); col = mix(col, uBg, fg);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const smat = (hex, o = {}) => { const c = hexRgb(hex);
  const u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.33)) }, uLight: { value: new THREE.Vector3(-0.55, 0.6, 0.8) }, uBg: { value: new THREE.Vector3(...hexRgb(GRAPH)) },
    uCam: { value: new THREE.Vector3() }, uExposure: { value: 1 }, uOpacity: { value: 1 }, uGrat: { value: o.grat || 0 }, uFog0: { value: o.fog0 ?? 1e12 }, uFog1: { value: o.fog1 ?? 2e12 } };
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: o.inst ? IVS : SVS, fragmentShader: SFS, transparent: Boolean(o.transparent), depthWrite: o.depthWrite ?? true, extensions: { derivatives: true } }); };

// the chain: instanced people (a capsule body, a round head, an arm link to the next person), heights a mix of kids and grown-ups
let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const NMAX = WD.nmax, HT = [], ZS = [];
for (let i = 0; i < NMAX + 2; i++) { const kid = rnd() < 0.25; HT.push(kid ? 1.0 + rnd() * 0.4 : 1.55 + rnd() * 0.3); }
{ let z = 0; for (let i = 0; i < NMAX + 2; i++) { ZS.push(z); z -= 0.5 * (HT[i] + HT[i + 1] || HT[i]) * 0.94; } }
const bodyG = new THREE.CapsuleGeometry(0.16, 0.42, 5, 14); bodyG.translate(0, 0.37, 0);
const headG = new THREE.SphereGeometry(0.13, 16, 12); headG.translate(0, 0.86, 0);
const linkG = new THREE.CapsuleGeometry(0.05, 1, 4, 8); linkG.rotateX(Math.PI / 2);
const chainMat = (hex) => smat(hex, { inst: true, fog0: 30, fog1: 150 });
const bodies = new THREE.InstancedMesh(bodyG, chainMat(CHALK2), NMAX), heads = new THREE.InstancedMesh(headG, chainMat(CHALK2), NMAX), links = new THREE.InstancedMesh(linkG, chainMat(CHALK2), NMAX);
for (const m of [bodies, heads, links]) { m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); }
{ const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S4 = new THREE.Vector3(), P4 = new THREE.Vector3();
  for (let i = 0; i < NMAX; i++) {
    const h = HT[i + 1], s = h / 1.0; S4.set(h, h, h); P4.set(0, 0, ZS[i + 1]); M4.compose(P4, Q0, S4); bodies.setMatrixAt(i, M4); heads.setMatrixAt(i, M4);
    const gap = Math.abs(ZS[i] - ZS[i + 1]), sh = 0.72 * Math.min(HT[i], HT[i + 1]); S4.set(1, 1, gap); P4.set(0, sh, (ZS[i] + ZS[i + 1]) / 2); M4.compose(P4, Q0, S4); links.setMatrixAt(i, M4);
  } for (const m of [bodies, heads, links]) m.instanceMatrix.needsUpdate = true; }
const SPAN_M = 1.7;
// a row of five (the arm-span shot) and the rods that say "arm span ≈ height"
const ROWH = [1.15, 1.75, 1.5, 1.85, 1.3], row = ROWH.map((h) => { const g = createFigure({ tokens: { ...TK, anchor: CHALK2 }, height: h }); g.group.visible = false; scene.add(g.group); return g; });
const rowLinks = ROWH.slice(1).map(() => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 1, 4, 8), smat(CHALK2)); m.rotation.z = Math.PI / 2; m.visible = false; scene.add(m); return m; });
const rodH = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.05), smat(MARK)), rodV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), smat(MARK));
for (const r of [rodH, rodV]) { r.visible = false; scene.add(r); }

// the planet: the Earth a shaded ball resting on the paper (its top is the paper), the thread, the ball of yarn, the Moon
const ball = (hex, grat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), smat(hex, { grat, transparent: false })); m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const earthB = ball(CHALK2, 1), moonB = ball(CHALK, 0);
earthB.renderOrder = 1; moonB.renderOrder = 1;
moonB.material.uniforms.uDark.value.multiplyScalar(0.85);
const NLAP = Math.ceil(WD.laps * 348 / 330) + 2;
const yarn = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.0016, 5, 128), basic(CHALK, 0.55, true), NLAP);
{ const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), S4 = new THREE.Vector3(), P4 = new THREE.Vector3(), Ax = new THREE.Vector3();
  let s2 = 5; const r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < NLAP; i++) { Ax.set(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize(); Q4.setFromAxisAngle(Ax, r2() * Math.PI); const rr = R_E * (1.004 + 0.00028 * i); S4.set(rr, rr, rr); P4.set(0, -R_E, 0); M4.compose(P4, Q4, S4); yarn.setMatrixAt(i, M4); }
  yarn.instanceMatrix.needsUpdate = true; }
yarn.frustumCulled = false; yarn.userData.noProbe = true; yarn.visible = false; yarn.renderOrder = 6; scene.add(yarn);
const lapRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 6, 160), basic(MARK, 0.95, false)); lapRing.renderOrder = 7; lapRing.frustumCulled = false; lapRing.visible = false; lapRing.userData.noProbe = true; scene.add(lapRing);
const threadG = new THREE.PlaneGeometry(1, 1); threadG.rotateX(-Math.PI / 2); threadG.translate(0, 0, -0.5);
const thread = new THREE.Mesh(threadG, new THREE.MeshBasicMaterial({ color: unlit(ANCH), transparent: true, opacity: 1, depthTest: true, depthWrite: false, side: THREE.DoubleSide }));
thread.renderOrder = 5; thread.frustumCulled = false; thread.userData.noProbe = true; thread.visible = false; scene.add(thread);
// the trips: 34 arcs between the Earth and the Moon, each drawn in turn
const NT = Math.ceil(WD.trips), arcs = [];
for (let i = 0; i < NT; i++) {
  const pts = [], hh = (0.02 + 0.2 * ((i * 0.618) % 1)) * 3.84e8, zz = ((((i * 0.381) % 1) - 0.5) * 2) * 0.12 * 3.84e8;
  for (let k = 0; k <= 48; k++) { const s3 = k / 48; pts.push(new THREE.Vector3(Math.sin(Math.PI * s3) * hh * (i % 2 ? 1 : -1), (WD.moonD - R_E - 1.737e6) * s3, Math.sin(Math.PI * s3) * zz)); }
  const g = new THREE.BufferGeometry().setFromPoints(pts), ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: unlit(i % 5 === 0 ? MARK : CHALK), transparent: true, opacity: 0.55, depthTest: false }));
  ln.frustumCulled = false; ln.visible = false; ln.userData.noProbe = true; scene.add(ln); arcs.push(ln);
}

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const keyed = (K, t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * (t - K[i - 1][0]) / Math.max(1e-6, K[i][0] - K[i - 1][0]); return K[K.length - 1][1]; };
const AN = {
  you: () => [0, 1.95, 0], span: () => [0.85, 0.05, 0], row: () => [0, 1.0, 0],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => String(Math.round(v)), minCh: 3,
    unit: c.unit, lit: (v) => v >= c.end - 0.6 });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.27 });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "4vmin auto 0" });
const box = endBox(endEl, { t0: FILM.endCard, answer: FILM.spine[FILM.spine.length - 1].terms.find((x) => x[0] === "ans")[1], S1: Math.min(W, H) / 1080 });


// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const place = (m, x, y, z, sx, sy, sz) => { m.position.set(x, y, z); m.scale.set(sx, sy, sz); };

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist;
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 60); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const px = d * 0.0016, camPos = camera.position;
  const paper = d < 400, tEnd1 = beat("tease").t1;

  // the paper: the grid, you, the chain, the row
  desk.group.visible = d < 320;
  desk.update({ grid: 1 - seg(Math.log10(d), 2.0, 2.5), pool: [pose.target[0], pose.target[2]], casters: [[0, 1.7, 0, 0.35]], span: Math.max(800, d * 8) });
  const endTail = shot === "end" ? 1 : 0;
  const showYou = d < 500 && shot !== "wrap" && shot !== "moon" && shot !== "row";
  you.group.visible = showYou;
  const armsU = shot === "arms" ? E.inout2(seg(t, beat("normal").t0 + 0.4, beat("normal").t0 + 1.4)) * (1 - E.inout2(seg(t, FILM.cue.row - 0.8, FILM.cue.row - 0.2))) : 0;
  you.set({ at: [0, 0.85, 0], arms: 0.04 + 0.6 * armsU + (shot === "front" || shot === "chain" || shot === "end" ? 0.34 : 0), tilt: 0 });
  // people in the chain
  let n = keyed(CUE.nPeople, t); if (shot === "end") n = WD.n0;
  const nn = Math.max(0, Math.min(WD.nmax, Math.floor(n)));
  const chainOn = (shot === "front" || shot === "chain" || shot === "end") && d < 3000;
  for (const m of [bodies, heads, links]) { m.visible = chainOn; m.count = nn; m.material.uniforms.uCam.value.copy(camPos); }
  // the row of five: only in the 'row' shot, hand in hand along x
  const rowOn = shot === "row" ? 1 : 0, XS = [-2.4, -1.2, 0, 1.2, 2.4];
  row.forEach((g, i) => { g.group.visible = rowOn > 0; g.set({ at: [XS[i], ROWH[i] / 2, 0], arms: 0.42, tilt: 0 }); });
  rowLinks.forEach((m, i) => { m.visible = rowOn > 0; const sh = 0.72 * Math.min(ROWH[i], ROWH[i + 1]); m.position.set((XS[i] + XS[i + 1]) / 2, sh, 0); m.scale.set(1, 1.5, 1); });
  // rods: arm span = height
  const rodsOn = shot === "arms" ? E.out3(seg(t, FILM.cue.row - 3.6, FILM.cue.row - 3.0)) * (1 - E.in3(seg(t, FILM.cue.row - 0.5, FILM.cue.row))) : 0;
  rodH.visible = rodV.visible = rodsOn > 0.02; rodH.scale.set(SPAN_M, 1, 1); rodH.position.set(0, 0.03, 0.35); rodV.scale.set(1, SPAN_M, 1); rodV.position.set(-1.45, SPAN_M / 2, 0);
  rodH.material.uniforms.uOpacity.value = rodV.material.uniforms.uOpacity.value = rodsOn;
  rodH.material.transparent = rodV.material.transparent = true;

  // the planet: the Earth, the thread, the ball of yarn
  const planet = d > 90;
  const rE = Math.max(R_E, px * 3.4);
  const eo = seg(Math.log10(d), 2.0, 2.5);
  earthB.visible = planet && eo > 0.01; earthB.position.set(0, -rE + 0.004 * d, 0); earthB.scale.setScalar(rE); earthB.material.uniforms.uCam.value.copy(camPos); earthB.material.transparent = true; earthB.material.uniforms.uOpacity.value = eo;
  const tf = keyed(CUE.thread, t), Lt = WD.len * tf;
  thread.visible = planet && tf > 0.0005 && shot !== "moon"; thread.scale.set(Math.max(px * 0.9, 1), 1, Math.max(1, Lt)); thread.position.set(0, 0.5, 0);
  thread.material.opacity = 0.95 * (shot === "end" ? 0 : 1);
  const laps = keyed(CUE.lapKeys, t), nLap = Math.max(0, Math.min(NLAP, Math.floor(laps)));
  const yarnFade = shot === "moon" ? 1 - E.inout2(seg(t, CUE.moon[0] + 0.1, CUE.moon[0] + 1.3)) : shot === "end" ? 0 : 1;
  yarn.visible = planet && nLap > 0 && yarnFade > 0.01 && shot !== "chain"; yarn.count = nLap; yarn.material.opacity = 0.55 * yarnFade;
  const oneOn = seg(t, CUE.one - 0.1, CUE.one + 0.4) * yarnFade * (shot === "wrap" ? 1 : 0);
  lapRing.visible = planet && oneOn > 0.01; lapRing.material.opacity = 0.95 * oneOn; lapRing.position.set(0, -R_E, 0); lapRing.scale.setScalar(R_E * 1.12); lapRing.rotation.set(1.1, 0.4, 0.2);
  // the Moon and the trips
  const moonOn = shot === "moon" || (shot === "end" && t < FILM.endCard + 1.2);
  const rM = Math.max(1.737e6, px * 3.0);
  moonB.visible = moonOn; moonB.position.set(0, -R_E + WD.moonD, 0); moonB.scale.setScalar(rM);
  const tr = keyed(CUE.tripKeys, t);
  arcs.forEach((a, i) => { const u = clamp01(tr - i); a.visible = moonOn && u > 0.001 && shot !== "end"; a.geometry.setDrawRange(0, Math.max(2, Math.floor(u * 49))); a.material.opacity = 0.55; a.position.y = 0; });
  // the Earth is small and the camera sees the planet in the Moon shot: lift the Moon to sit level with the Earth's centre
  void paper; void endTail; void place; void tEnd1; void gate;

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 1.1, beat("tease").t1 - 0.35));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
