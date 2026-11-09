import * as THREE from "three";
// Possibility Lab Season 2, Episode 3 (S2E03, folder ep09), "A rope around the Earth". The picture as a pure function of t for
// the film kit's page: window.seek(t) sets the shot, the camera, the world and the overlay from t alone, then renders once.
//
// The world: you in blue beside a rope on the graph paper; seen from far out, the rope is a ring hugging the Earth (a flat ring drawn by a
// shader, crisp at any scale). The ring is lifted a meter (drawn exaggerated), the camera dives to the lifted rope on poles, a flat
// circle diagram shows the radius grow by one meter, the extra rope (6.3 m) is laid out beside four of you lying head to toe, and a
// ten-meter lift needs 63 m. Everything timed comes from film.json (compile.py); this file only stages it.
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
const R_E = WD.rE, EXTRA = WD.extra, DIA = CUE.dia, LAY = CUE.lay, TEN = CUE.ten;
const TH = 0.62;                                                                // the diagram's radius line points 60 degrees round (radians)

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);
const you = createFigure({ tokens: TK, height: 1.7 });
scene.add(you.group);
const basic = (hex, o = 1, depth = true) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: depth, depthWrite: false });
const box = (hex, o = 1, order = 4) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(hex, o)); m.renderOrder = order; m.frustumCulled = false; m.userData.noProbe = true; scene.add(m); return m; };
const cyl = (r, h) => { const g = new THREE.CylinderGeometry(r, r, h, 10); g.translate(0, h / 2, 0); return g; };

// the globe: a half-Lambert chalk ball with a baked continents-and-ocean texture (the Space channel's), crisp at any scale
const SVS = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SFS = `precision highp float; uniform vec3 uCol, uDark, uLight; uniform float uExposure, uOpacity; uniform sampler2D uMap; varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight)); vec3 col = mix(uDark, uCol, lam);
  float lon = atan(n.x, n.z), lat = asin(clamp(n.y, -1.0, 1.0)); vec3 tx = texture2D(uMap, vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5)).rgb;
  col = mix(col, tx * (0.3 + 0.9 * lam) * 1.1, 0.7);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const earthTex = new THREE.CanvasTexture(earthSurface({ width: 1024 })); earthTex.wrapS = THREE.RepeatWrapping; earthTex.anisotropy = 4;
const earthB = (() => { const c = hexRgb(CHALK2), u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.3)) }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.8) }, uExposure: { value: 1 }, uOpacity: { value: 1 }, uMap: { value: earthTex } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, extensions: { derivatives: true } }));
  m.renderOrder = 3; m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; })();
// the rope as a ring: a flat quad in the XY plane through the Earth's centre; the shader draws two rings (the rope and the lifted rope), always a few pixels thick
const RVS = `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RFS = `precision highp float; uniform vec3 uCol; uniform float uR1, uR2, uW, uO1, uO2; varying vec2 vP;
${ACES_INV_GLSL}
void main() {
  float r = length(vP);
  float a1 = (1.0 - smoothstep(uW * 0.55, uW, abs(r - uR1))) * uO1, a2 = (1.0 - smoothstep(uW * 0.55, uW, abs(r - uR2))) * uO2, a = max(a1, a2);
  if (a < 0.004) discard;
  gl_FragColor = vec4(acesInv(srgbToLinear(uCol), 1.0), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ringQ = (() => { const g = new THREE.PlaneGeometry(2.4, 2.4);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(CHALK)) }, uR1: { value: 1 }, uR2: { value: 1 }, uW: { value: 0.01 }, uO1: { value: 1 }, uO2: { value: 0 } },
    vertexShader: RVS, fragmentShader: RFS, transparent: true, depthTest: false, depthWrite: false }));
  m.renderOrder = 7; m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; })();

// the rope near you: a long box along x, the lifted rope on poles; a meter rod
const rope = box(CHALK, 1, 6); rope.scale.set(4000, 0.05, 0.05);
const NPOLE = 81, poles = new THREE.InstancedMesh(cyl(0.025, 1), basic(CHALK2, 0.9), NPOLE); poles.frustumCulled = false; poles.renderOrder = 5; poles.userData.noProbe = true; scene.add(poles);
const Mx = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
const rod = box(CHALK, 1, 6); rod.scale.set(0.05, 1, 0.05); rod.position.set(1.7, 0.5, 0.6);
const rodTicks = [0.25, 0.5, 0.75, 1.0].map((y) => { const m = box(MARK, 1, 7); m.scale.set(0.22, 0.03, 0.06); m.position.set(1.7, y, 0.6); return m; });

// the diagram on the paper: the rope as a circle (radius 3), its radius, and the circle grown by a meter (exaggerated)
const torus = (hex, order) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 160), basic(hex, 1, false)); m.rotation.x = -Math.PI / 2; m.renderOrder = order; m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const diaIn = torus(CHALK, 6), diaOut = torus(MARK, 7); const DRAW = 8 * 6 * 160;
const diaRad = box(MARK, 1, 8), diaDot = new THREE.Mesh(new THREE.CircleGeometry(1, 20), basic(CHALK, 1, false)); diaDot.rotation.x = -Math.PI / 2; diaDot.renderOrder = 8; diaDot.visible = false; diaDot.userData.noProbe = true; scene.add(diaDot);
const RDIA = 1.0, RDIA2 = 1.28;

// the extra rope laid out, and four of you lying head to toe
const layRope = box(CHALK, 1, 6);
const figTk = (hex) => ({ ...TK, anchor: hex });
const lying = [0, 1, 2, 3].map(() => { const f = createFigure({ tokens: figTk("#8A8D96"), height: 1.7 }); f.set({ at: [0, 0, 0], arms: 0.08, tilt: 0 }); const w = new THREE.Group(); w.add(f.group); w.rotation.z = -Math.PI / 2; w.visible = false; scene.add(w); return { f, w }; });
const layEnd = box(MARK, 1, 8); layEnd.scale.set(0.05, 0.5, 0.05);

// ten meters: poles ten meters tall, the rope on top, and its 63 m laid out on the ground in ten pieces
const NT = 12, tenPoles = new THREE.InstancedMesh(cyl(0.06, 1), basic(CHALK2, 0.9), NT); tenPoles.frustumCulled = false; tenPoles.renderOrder = 5; tenPoles.userData.noProbe = true; scene.add(tenPoles);
const tenRope = box(CHALK, 1, 6);
const pieces = Array.from({ length: 10 }, (_, i) => box(i % 2 ? CHALK2 : CHALK, 1, 6));

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
let youX = 0;
const AN = {
  you: () => [youX, 1.95, 0], rope: () => [-3.5, 0.15, -0.45], rod: () => [1.85, 0.62, 0.6],
  rad: () => [DIA[0] + 1.5 * Math.cos(TH), 0.05, DIA[2] - 1.5 * Math.sin(TH)], gap: () => [DIA[0] + 3.4 * Math.cos(TH + 0.5), 0.05, DIA[2] - 3.4 * Math.sin(TH + 0.5)],
  "lay-end": () => [LAY[0] + EXTRA, 0.15, 0], "ten-top": () => [TEN[0] + 5, 9.6, 0], "long-end": () => [TEN[0] + 63, 0.2, 3.0],
};
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => (c.unit === "m" ? v.toFixed(1) : String(Math.round(v))), minCh: 3, unit: c.unit, lit: (v) => v >= c.end - 0.05 });
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
// the guess bar: how much extra rope you might guess ("thousands of km?")
const guessEl = document.createElement("div");
guessEl.style.cssText = "position:absolute;left:12%;top:30%;width:76%;opacity:0;pointer-events:none;z-index:4;font:600 3.4vmin/1.2 var(--font-text);color:var(--hud-text)";
guessEl.innerHTML = '<div style="margin-bottom:1.6vmin;letter-spacing:.02em">extra rope you might guess</div><div style="height:4.2vmin;border:.35vmin solid var(--hud-text-2);border-radius:99px;overflow:hidden"><div id="gfill" style="height:100%;width:0%;background:' + MARK + '"></div></div><div id="gq" style="margin-top:1.6vmin;font:700 4.6vmin/1 var(--font-mono);color:' + MARK + '">thousands of km?</div>';
document.body.appendChild(guessEl);

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist, ld = Math.log10(d); window.__d = d; window.__cam = { pose: [pose.target, pose.dist, pose.el, pose.az, pose.fy], pos: camera.position.toArray() };
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 60); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const px = d * 0.0016;

  // the paper (darkened before it is hidden: no bright slab) and you
  desk.group.visible = d < 5000;
  desk.update({ grid: 1 - seg(ld, 2.0, 2.5), pool: [pose.target[0], pose.target[2]], casters: [[youX, 1.7, 0, 0.35]], span: Math.max(800, d * 8) });
  { const wash = 1 + 9 * seg(ld, 3.0, 3.5) * (1 - seg(ld, 4.3, 7.4)); desk.uniforms.uExposure.value = wash; earthB.material.uniforms.uExposure.value = 1 + (wash - 1) / 3; }
  const lifted = seg(t, CUE.lift, CUE.lift + 1.2) * (1 - seg(t, CUE.why, CUE.why + 0.01));
  const ropeOn = (shot === "front" || shot === "pull" || shot === "lift" || shot === "end") && d < 4e4;
  const ropeY = 0.03 + 0.97 * lifted;
  rope.visible = ropeOn; rope.position.set(0, ropeY, -0.45); rope.material.opacity = 1 - seg(ld, 4.3, 4.6);
  poles.visible = ropeOn && lifted > 0.01; poles.material.opacity = 0.9 * (1 - seg(ld, 3.0, 3.8));
  for (let i = 0; i < NPOLE; i++) { S3.set(1, Math.max(0.01, ropeY), 1); P3.set((i - 40) * 5, 0, -0.45); Mx.compose(P3, Q0, S3); poles.setMatrixAt(i, Mx); } poles.instanceMatrix.needsUpdate = true;
  const rodOn = shot === "lift" && t > CUE.dive[1] - 0.8 ? E.out3(seg(t, CUE.dive[1] - 0.8, CUE.dive[1] - 0.2)) * (1 - E.in3(seg(t, CUE.why - 0.2, CUE.why + 0.1))) : 0;
  rod.visible = rodOn > 0.02; rod.material.opacity = rodOn; for (const m of rodTicks) { m.visible = rodOn > 0.02; m.material.opacity = rodOn; }
  const onTen = t >= CUE.home - 0.2 && shot === "take";
  youX = onTen ? TEN[0] - 3.2 : 0;
  you.group.visible = d < 500 && (shot === "front" || shot === "pull" || shot === "lift" || shot === "end" || onTen);
  const armsU = shot === "front" || shot === "end" ? 0.3 : 0.04;
  you.set({ at: [youX, 0.85, onTen ? 1.0 : 0], arms: armsU, tilt: 0 }); if (shot === "lift" && t > CUE.dive[1] - 1.5) you.set({ at: [0.15, 0.85, 0.2], arms: 0.06, tilt: 0 });

  // the planet and its rope ring
  const planet = d > 2e4 && (shot === "pull" || shot === "lift");
  const pl = seg(ld, 5.6, 7.0);
  earthB.visible = planet && pl > 0.01; earthB.position.set(0, -R_E, 0); earthB.scale.setScalar(R_E); earthB.material.uniforms.uOpacity.value = pl * (1 - 0.8 * E.inout2(seg(t, CUE.dive[0], CUE.dive[0] + 0.9)));
  const lu = E.inout2(seg(t, CUE.lift, CUE.lift + 1.4));
  ringQ.visible = planet; ringQ.position.set(0, -R_E, 0); ringQ.scale.setScalar(R_E * 1.0);
  const w = px * 1.6 / R_E;
  ringQ.material.uniforms.uR1.value = 1.0; ringQ.material.uniforms.uR2.value = 1.0 + 0.055 * lu; ringQ.material.uniforms.uW.value = w;
  ringQ.material.uniforms.uO1.value = seg(ld, 4.3, 4.7) * (1 - 0.35 * lu); ringQ.material.uniforms.uO2.value = lu * seg(ld, 4.3, 4.7);

  // the guess bar
  { const g = seg(t, CUE.guess[0] - 0.1, CUE.guess[0] + 0.4) * (1 - seg(t, CUE.guess[2], CUE.guess[2] + 0.5));
    guessEl.style.opacity = String((g * 0.95).toFixed(3)); const f = E.inout2(seg(t, CUE.guess[0] + 0.3, CUE.guess[1])); document.getElementById("gfill").style.width = (84 * f).toFixed(1) + "%"; }

  // the diagram: the rope as a circle, the radius, the circle grown by a meter
  const c = CUE.circle, inShot = shot === "why" || shot === "whoa";
  const dIn = seg(t, c[0], c[1]), dRad = E.out3(seg(t, c[1], c[1] + 0.5)), dOut = E.inout2(seg(t, c[2], c[3]));
  const diaOn = inShot && t < CUE.whoa + 1.4;
  diaIn.visible = diaOn && dIn > 0.001; diaIn.position.set(DIA[0], 0.03, DIA[2]); diaIn.scale.setScalar(RDIA); diaIn.geometry.setDrawRange(0, Math.max(6, Math.floor(E.inout2(dIn) * DRAW)));
  diaDot.visible = diaOn && dIn > 0.001; diaDot.position.set(DIA[0], 0.04, DIA[2]); diaDot.scale.setScalar(0.09);
  diaRad.visible = diaOn && dRad > 0.01; diaRad.scale.set(RDIA * dRad, 0.03, 0.035); diaRad.rotation.y = TH; diaRad.position.set(DIA[0] + 0.5 * RDIA * dRad * Math.cos(TH), 0.04, DIA[2] - 0.5 * RDIA * dRad * Math.sin(TH));
  diaOut.visible = diaOn && dOut > 0.001; diaOut.position.set(DIA[0], 0.03, DIA[2]); diaOut.scale.setScalar(RDIA + (RDIA2 - RDIA) * dOut); diaOut.material.opacity = dOut;

  // the extra rope, laid out beside four of you
  const lu2 = E.inout2(seg(t, CUE.grows, CUE.six)), layOn = (shot === "whoa" || shot === "work") && t > CUE.whoa;
  layRope.visible = layOn && lu2 > 0.001; layRope.scale.set(Math.max(0.01, EXTRA * lu2), 0.06, 0.06); layRope.position.set(LAY[0] + EXTRA * lu2 / 2, 0.04, LAY[2]);
  layEnd.visible = layOn && lu2 > 0.99; layEnd.position.set(LAY[0] + EXTRA, 0.25, LAY[2]);
  lying.forEach((o, i) => { const u = layOn ? E.back(seg(t, CUE.four + 0.28 * i, CUE.four + 0.28 * i + 0.4)) : 0; o.w.visible = layOn && u > 0.01; o.w.scale.setScalar(Math.max(0.01, u)); o.w.position.set(LAY[0] + 0.85 + 1.7 * i, 0.22, -0.65); });

  // ten meters
  const tenOn = shot === "take" || (shot === "end" && t < FILM.endCard + 1.0);
  const grow = E.inout2(seg(t, CUE.home + 0.2, CUE.home + 2.0)), hh = 1 + 9 * grow;
  tenPoles.visible = tenOn; tenRope.visible = tenOn;
  for (let i = 0; i < NT; i++) { S3.set(1, hh, 1); P3.set(TEN[0] - 30 + i * 12, 0, 0); Mx.compose(P3, Q0, S3); tenPoles.setMatrixAt(i, Mx); } tenPoles.instanceMatrix.needsUpdate = true;
  tenRope.scale.set(160, 0.06, 0.06); tenRope.position.set(TEN[0] + 40, hh, 0);
  pieces.forEach((m, i) => { const u = seg(t, CUE.ph2 + 0.9 + 0.22 * i, CUE.ph2 + 1.25 + 0.22 * i); m.visible = tenOn && u > 0.01; m.scale.set(Math.max(0.01, (EXTRA - 0.12) * u), 0.07, 0.07); m.position.set(TEN[0] + EXTRA * i + (EXTRA - 0.12) * u / 2, 0.05, 3.0); });

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 1.1, beat("tease").t1 - 0.35));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  ebox.update(t);
  void clamp01; void W;
  renderer.render(scene, camera);
};
