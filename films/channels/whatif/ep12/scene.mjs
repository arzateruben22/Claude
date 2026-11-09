import * as THREE from "three";
// Possibility Lab Season 2, Episode 6 (S2E06, folder ep12), "Catch all the lightning". The picture as a pure function of t for the film
// kit's page: window.seek(t) sets the shot, the camera, the world and the overlay from t alone, then renders once.
//
// The world: you and a bulb under a night sky on the graph paper (frame 0 is the calm before a bolt); the globe with about 44 flashes a
// second; one bolt beside a log-scale meter; a tank that the year's flashes fill; a second tank, 77 times taller, for the world's
// electricity; bars for the 0.5 / 5 / 47 day cases; the globe again. Hard cuts between the scales. Everything timed comes from film.json
// (compile.py); this file only stages it.
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

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF";
const H1 = WD.h1, H2 = WD.h2, T1X = WD.t1x, T2X = WD.t2x, TW = WD.tw, RATE = WD.rate;
const BOLT = "#FFD76A";

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
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.anisotropy = 4; return t; };
const earthTex = tex(earthSurface({ width: 1024 }));
const globe = (map, hex, mix) => { const c = hexRgb(hex), u = { uCol: { value: new THREE.Vector3(...c) }, uDark: { value: new THREE.Vector3(...c.map((v) => v * 0.28)) }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.8) }, uExposure: { value: 1 }, uOpacity: { value: 1 }, uMix: { value: mix }, uMap: { value: map }, uSpin: { value: 0 } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 54), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: true, extensions: { derivatives: true } }));
  m.renderOrder = 3; m.frustumCulled = false; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };

// ── materials and the sets ──────────────────────────────────────────────────
const globeM = globe(earthTex, "#6A7080", 0.6);
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const dot = (hex, o, order, n) => { const m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), basic(hex, o, false), n); m.frustumCulled = false; m.renderOrder = order; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const NF = 16, flashCore = dot("#FFF1C2", 1, 8, NF), flashHalo = dot(BOLT, 0.38, 7, NF);

// the near stage: the paper, you, a bulb
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);
const you = createFigure({ tokens: TK, height: 1.7 });
scene.add(you.group);
const bulbM = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshBasicMaterial({ color: unlit("#6B6F78"), transparent: true, opacity: 1, depthWrite: false })); bulbM.renderOrder = 6; bulbM.userData.noProbe = true; scene.add(bulbM);
const bulbHalo = new THREE.Mesh(new THREE.CircleGeometry(1, 28), basic(BOLT, 0.0, false)); bulbHalo.renderOrder = 5; bulbHalo.userData.noProbe = true; scene.add(bulbHalo);
const bulbBase = box("#4A4E57", 1, 6); bulbBase.scale.set(0.2, 0.14, 0.2);
const BX = 0.45, BY = 1.35;

// bolts: a zigzag of boxes (an instanced mesh per bolt)
const BOLTBOX = new THREE.BoxGeometry(1, 1, 1);
const mkBolt = (n, hex, o, order) => { const m = new THREE.InstancedMesh(BOLTBOX, basic(hex, o, false), n); m.frustumCulled = false; m.renderOrder = order; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const UP = new THREE.Vector3(0, 1, 0), Va = new THREE.Vector3(), Vb = new THREE.Vector3(), Vd = new THREE.Vector3();
const zig = (x, ytop, ybot, z, n, amp, seed) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([x + (i === 0 || i === n ? 0 : (rnd(i, seed) - 0.5) * 2 * amp), ytop + (ybot - ytop) * u, z]); } return pts; };
const setBolt = (m, pts, w, grow = 1, hdr = 0) => { const n = pts.length - 1, upto = grow * n;
  for (let i = 0; i < n; i++) { const g = Math.min(1, Math.max(0, upto - i)); Va.set(...pts[i]); Vb.set(...pts[i + 1]); Vd.subVectors(Vb, Va); const len = Vd.length() * g; Q0.setFromUnitVectors(UP, Vd.clone().normalize());
    P3.copy(Va).addScaledVector(Vd, 0.5 * g); S3.set(w, Math.max(0.0001, len), w * 0.4); Mx.compose(P3, Q0, S3); m.setMatrixAt(hdr + i, Mx); }
  m.instanceMatrix.needsUpdate = true; };
const Mx = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();
const hookPts = zig(1.3, 5.8, 0.0, -2.5, 9, 0.35, 3), hookBolt = mkBolt(9, "#FFF1C2", 1, 9);
const bigPts = zig(0.0, 2.0, 0.0, 0, 9, 0.26, 8), bigBolt = mkBolt(9, "#FFF1C2", 1, 9), bigGlow = mkBolt(9, BOLT, 0.35, 8);
const NM = 55, miniB = mkBolt(NM * 3, BOLT, 0.95, 9), MCOLS = [-0.85, -0.55, 0.45, 0.75, 1.05];
const flashOverlay = document.createElement("div"); flashOverlay.style.cssText = "position:absolute;inset:0;background:#FFE9A8;opacity:0;pointer-events:none;z-index:1;mix-blend-mode:screen"; document.body.appendChild(flashOverlay);

// the meter: a log scale from 10^8 to 10^10 J beside the bolt
const MX_ = 1.55, MY0 = 0.2, MY1 = 1.9, MID = 0.5 * (MY0 + MY1);
const meterBar = box(CHALK2, 1, 8); meterBar.scale.set(0.035, MY1 - MY0, 0.03); meterBar.position.set(MX_, MID, 0);
const meterTicks = [MY0, MID, MY1].map((y) => { const m = box(CHALK, 1, 8); m.scale.set(0.22, 0.03, 0.03); m.position.set(MX_, y, 0); return m; });
const meterRange = box(MARK, 1, 9);
const meterMark = new THREE.Mesh(new THREE.CircleGeometry(1, 20), basic(MARK, 1, false)); meterMark.renderOrder = 10; meterMark.userData.noProbe = true; scene.add(meterMark);

// the tanks: bars on the paper, the first one for all the lightning of a year, the second for a year of the world's electricity
const edgeBox = (w, h, d) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: new THREE.Color(CHALK), transparent: true, opacity: 0.9, depthTest: false })); l.renderOrder = 8; l.userData.noProbe = true; l.frustumCulled = false; scene.add(l); return l; };
const tank1E = edgeBox(TW, H1, TW), tank2E = edgeBox(TW, H2, TW);
const fill1 = box(BOLT, 0.9, 6), fill2 = box(ANCH, 0.8, 5), shell1 = box(CHALK, 0.08, 4), shell2 = box(CHALK, 0.06, 3);
const markLine = box(MARK, 1, 9);
const ND = 260, drops = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), basic(BOLT, 0.95, false), ND); drops.frustumCulled = false; drops.renderOrder = 9; drops.userData.noProbe = true; drops.visible = false; scene.add(drops);
// star dust: parallax for the cuts and pans
const dustN = (() => { const n = 700, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.4, false), n); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 2; scene.add(m);
  const Mt = new THREE.Matrix4(), Pp = new THREE.Vector3(), Ss = new THREE.Vector3(), Qq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 0.02 + rnd(i, 1) * rnd(i, 2) * 0.07; Ss.set(r, r, 1); Pp.set((rnd(i, 3) - 0.5) * 14, rnd(i, 4) * 8 - 0.5, -2 - rnd(i, 5) * 7); Mt.compose(Pp, Qq, Ss); m.setMatrixAt(i, Mt); } m.instanceMatrix.needsUpdate = true; return m; })();
const dustF = (() => { const n = 900, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.45, false), n); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 2; scene.add(m);
  const Mt = new THREE.Matrix4(), Pp = new THREE.Vector3(), Ss = new THREE.Vector3(), Qq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 0.015 + rnd(i, 6) * rnd(i, 7) * 0.05; Ss.set(r, r, 1); Pp.set((rnd(i, 8) - 0.5) * 16, (rnd(i, 9) - 0.5) * 12, -4 - rnd(i, 10) * 9); Mt.compose(Pp, Qq, Ss); m.setMatrixAt(i, Mt); } m.instanceMatrix.needsUpdate = true; return m; })();
const dustT = (() => { const n = 500, m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.45, false), n); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 2; scene.add(m);
  const Mt = new THREE.Matrix4(), Pp = new THREE.Vector3(), Ss = new THREE.Vector3(), Qq = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const r = 0.4 + rnd(i, 11) * rnd(i, 12) * 1.6; Ss.set(r, r, 1); Pp.set((rnd(i, 13) - 0.5) * 220, rnd(i, 14) * 140 - 10, -30 - rnd(i, 15) * 60); Mt.compose(Pp, Qq, Ss); m.setMatrixAt(i, Mt); } m.instanceMatrix.needsUpdate = true; return m; })();

// the sensitivity bars (a year of electricity = the full bar), over the globe in the work shot
const barsEl = document.createElement("div");
barsEl.style.cssText = "position:absolute;left:9%;width:82%;top:73%;opacity:0;pointer-events:none;z-index:4;font:600 2.4vmin/1.2 var(--font-text);color:var(--hud-text)";
const BARD = [["10 × less per flash", WD.sens[0], "0.5 days"], ["as modelled", WD.sens[1], "5 days"], ["10 × more per flash", WD.sens[2], "47 days"]];
barsEl.innerHTML = BARD.map((b, i) => `<div style="display:flex;align-items:center;gap:2vmin;margin-bottom:0.7vmin;opacity:0" id="br${i}"><div style="width:30%;color:var(--hud-text-2)">${b[0]}</div><div style="flex:1;height:2.2vmin;border:.3vmin solid var(--hud-text-2);border-radius:99px;overflow:hidden;position:relative"><div style="height:100%;width:${Math.max(2.2, 100 * b[1]).toFixed(2)}%;background:${BOLT}"></div></div><div style="width:15%;font:700 2.4vmin/1 var(--font-mono);color:${BOLT}">${b[2]}</div></div>`).join("");
document.body.appendChild(barsEl);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const AN = { "meter-mid": () => [MX_, MID, 0], "meter-lo": () => [MX_, MY0, 0], "meter-range": () => [MX_ + 0.16, MY0 + 0.55, 0], "meter-hi": () => [MX_, MY1, 0],
  "tank1-top": () => [T1X + TW / 2, H1, 0], "tank1-top-w": () => [T1X, H1, 0], "tank2-top": () => [T2X - TW / 2, H2, 0] };
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" },
  assume: { color: "assume", glyph: "∵", mark: "dashed" }, calc: { color: "marker", glyph: "≈", mark: "dot" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => Math.round(v).toLocaleString("en-US"), minCh: 4, unit: c.unit, lit: (v) => v >= c.end - 0.05 });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: AN[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.215 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "5.6vmin"; if (endFo) endFo.style.marginTop = "1.6vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.7vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "1.6vmin auto 0" });
const ebox = endBox(endEl, { t0: FILM.endCard, answer: FILM.endAnswer, S1: Math.min(W, H) / 1080 });
const dimEl = document.createElement("div"); dimEl.style.cssText = "position:absolute;inset:0;background:#171A1E;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dimEl);

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const flashAt = (i, life) => ({ ti: (i + rnd(i, 3)) / RATE, life });

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist; window.__d = d; window.__cam = { pose: [pose.target, pose.dist, pose.el, pose.az, pose.fy], pos: camera.position.toArray() };
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 60); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const hookS = shot === "hook" || shot === "end", globeS = shot === "globe" || shot === "take" || shot === "work";
  const boltS = shot === "bolt", tankS = shot === "tank", towerS = shot === "tower";
  const nearS = hookS || boltS;

  // the paper and you (the hook), the bulb and the far bolt
  desk.group.visible = nearS || tankS;
  desk.update({ grid: 1, pool: [pose.target[0], pose.target[2]], casters: hookS ? [[-0.5, 1.7, 0, 0.35]] : [], span: 800 }); desk.uniforms.uExposure.value = 1;
  you.group.visible = hookS; you.set({ at: [-0.5, 0.85, 0.2], arms: 0.06, tilt: 0 });
  const cb = CUE.bolt, bu = hookS && shot === "hook" ? (t >= cb[0] && t < cb[1] ? 1 - seg(t, cb[0] + 0.05, cb[1]) : 0) : 0;
  const bflick = hookS && shot === "hook" && t >= cb[0] && t < cb[1] ? 1 : 0;
  hookBolt.visible = bflick > 0; if (bflick > 0) setBolt(hookBolt, hookPts, 0.07, E.out3(seg(t, cb[0], cb[0] + 0.06)));
  bulbM.visible = bulbHalo.visible = bulbBase.visible = hookS; bulbM.position.set(BX, BY, 0); bulbM.scale.setScalar(0.26); bulbBase.position.set(BX, BY - 0.3, 0);
  bulbM.material.color.set(bu > 0 ? unlit("#FFF1C2") : unlit("#6B6F78")); bulbHalo.position.set(BX, BY, -0.1); bulbHalo.scale.setScalar(0.42); bulbHalo.material.opacity = 0.35 * bu;
  flashOverlay.style.opacity = String((0.07 * bu).toFixed(3));
  dustN.visible = hookS || boltS; dustF.visible = globeS || tankS; dustT.visible = towerS;

  // the globe and its flashes
  const spin = 2 * Math.PI * t / 90;
  globeM.visible = globeS; globeM.position.set(0, 0, 0); globeM.scale.setScalar(1); globeM.material.uniforms.uSpin.value = spin; globeM.material.uniforms.uExposure.value = 0.75;
  flashCore.visible = flashHalo.visible = globeS;
  if (globeS) {
    const life = shot === "take" ? 0.2 : 0.22, i1 = Math.floor(t * RATE) + 1, i0 = Math.floor((t - life) * RATE) - 1;
    let k = 0;
    for (let i = Math.max(0, i0); i <= i1 && k < NF; i++) { const { ti } = flashAt(i, life), u = (t - ti) / life; if (u < 0 || u >= 1) continue;
      const lon = rnd(i, 1) * Math.PI * 2 + spin * 0, z = 2 * rnd(i, 2) - 1, rr = Math.sqrt(1 - z * z);
      let x = rr * Math.cos(lon), y = z * 0.92, zz = rr * Math.sin(lon);                                  // a point on the sphere
      const ca = Math.cos(spin), sa = Math.sin(spin), xr = x * ca + zz * sa, zr = -x * sa + zz * ca;       // the globe turns
      if (zr < 0.12) continue;
      const s = 0.032 * (1 - u * 0.6) * (u < 0.15 ? u / 0.15 : 1);
      P3.set(xr * 1.004, y * 1.004, zr * 1.004 + 0.01); S3.set(s, s, 1); Mx.compose(P3, Q0.identity(), S3); flashCore.setMatrixAt(k, Mx);
      S3.set(s * 2.8, s * 2.8, 1); Mx.compose(P3, Q0, S3); flashHalo.setMatrixAt(k, Mx); k++; }
    for (let j = k; j < NF; j++) { S3.set(0.00001, 0.00001, 1); P3.set(0, 0, -50); Mx.compose(P3, Q0, S3); flashCore.setMatrixAt(j, Mx); flashHalo.setMatrixAt(j, Mx); }
    flashCore.instanceMatrix.needsUpdate = flashHalo.instanceMatrix.needsUpdate = true; }

  // the bolt and the meter
  bigBolt.visible = bigGlow.visible = boltS;
  if (boltS) { const born = E.out3(seg(t, CUE.range - 99, CUE.range - 99)) ; void born;
    const bt = seg(t, FILM.beats[2].t0 + 0.1, FILM.beats[2].t0 + 0.5), pul = 0.85 + 0.15 * Math.sin(t * 9);
    setBolt(bigBolt, bigPts, 0.06 * pul, E.out3(bt)); setBolt(bigGlow, bigPts, 0.22 * pul, E.out3(bt)); }
  const mu = boltS ? E.out3(seg(t, CUE.j - 0.2, CUE.j + 0.5)) : 0;
  meterBar.visible = boltS && mu > 0.01; meterBar.scale.set(0.035, (MY1 - MY0) * mu, 0.03); meterBar.position.set(MX_, MY0 + (MY1 - MY0) * mu / 2, 0);
  meterTicks.forEach((m) => { m.visible = boltS && mu > 0.9; });
  const ru = boltS ? E.inout2(seg(t, CUE.range - 0.1, CUE.range + 0.6)) : 0;
  meterRange.visible = ru > 0.01; meterRange.scale.set(0.07, (MY1 - MY0) * ru, 0.04); meterRange.position.set(MX_ + 0.16, MID, 0);
  meterMark.visible = boltS && mu > 0.9; meterMark.position.set(MX_, MID, 0.02); meterMark.scale.setScalar(0.07);
  { const mu2 = boltS ? seg(t, CUE.mult, CUE.mult + 1.8) : 0; miniB.visible = mu2 > 0;
    for (let i = 0; i < NM; i++) { const u = E.out3(seg(mu2, i / NM * 0.8, i / NM * 0.8 + 0.2)), gx = MCOLS[i % 5], gy = Math.floor(i / 5) * 0.17 + 0.1;
      const pts = zig(gx, gy + 0.22, gy, 0.1, 3, 0.04, 20 + i); setBolt(miniB, pts, 0.03 * (u > 0 ? 1 : 0.0001), Math.max(0.0001, u), i * 3); } }

  // the tanks
  const showT1 = tankS || towerS;
  tank1E.visible = shell1.visible = showT1; tank1E.position.set(T1X, H1 / 2, 0); shell1.position.set(T1X, H1 / 2, 0); shell1.scale.set(TW, H1, TW);
  const fl = E.inout2(seg(t, CUE.fill[0], CUE.fill[1])) * (tankS ? 1 : 0) + (towerS ? 1 : 0);
  fill1.visible = showT1 && fl > 0.001; fill1.scale.set(TW * 0.98, Math.max(0.001, H1 * fl), TW * 0.98); fill1.position.set(T1X, H1 * fl / 2, 0);
  markLine.visible = showT1 && fl > 0.99; markLine.scale.set(TW * 1.1, 0.03, 0.03); markLine.position.set(T1X, H1 + 0.01, 0);
  tank2E.visible = shell2.visible = towerS; tank2E.position.set(T2X, H2 / 2, 0); shell2.position.set(T2X, H2 / 2, 0); shell2.scale.set(TW, H2, TW);
  const f2 = towerS ? E.inout2(seg(t, CUE.whoa + 0.2, CUE.eighty + 1.4)) : 0;
  fill2.visible = towerS && f2 > 0.001; fill2.scale.set(TW * 0.98, Math.max(0.001, H2 * f2), TW * 0.98); fill2.position.set(T2X, H2 * f2 / 2, 0);
  drops.visible = tankS;
  if (tankS) { for (let i = 0; i < ND; i++) { const per = 1.6, ph = (i / ND), s = (((t - CUE.fill[0]) / per) + ph) % 1, on = t > CUE.fill[0] - 0.4 && t < CUE.fill[1] + 0.2 ? 1 : 0;
      const y = 14 * (1 - s) + H1 * fl * s, x = T1X + (rnd(i, 20) - 0.5) * 2.0, z = (rnd(i, 21) - 0.5) * 2.0; S3.set(Math.max(0.0001, on * 0.13 * (0.6 + rnd(i, 22))), Math.max(0.0001, on * 0.13 * (0.6 + rnd(i, 22))), 1); P3.set(x, y, z); Mx.compose(P3, Q0, S3); drops.setMatrixAt(i, Mx); }
    drops.instanceMatrix.needsUpdate = true; }

  // the work bars, over the globe
  { const wb = shot === "work" ? seg(t, CUE.work0 + 0.4, CUE.work0 + 0.9) * (1 - seg(t, CUE.home - 0.5, CUE.home - 0.1)) : 0; barsEl.style.opacity = String(wb.toFixed(3));
    BARD.forEach((b, i) => { document.getElementById("br" + i).style.opacity = String((seg(t, CUE.ten - 0.3 + i * 0.5, CUE.ten + 0.3 + i * 0.5) * (i === 1 ? 1 : 1) + (i === 1 ? seg(t, CUE.work0 + 0.4, CUE.work0 + 0.9) : 0)).toFixed(3)); }); }

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
