import * as THREE from "three";
// One More Orbit, Season 2 · Episode 5 (folder ep11), "Saturn floats". The picture as a pure function of t.
//
// One 3-D world (a thought experiment, badged): a tank of water wider than Saturn, Saturn (pale lemon, a thin ring) beside it, next to Earth at true scale and cut away,
// a balance (a small dense ball and a big spread-out one), Saturn lowered onto the water and floating, then breaking up into gas that mixes (not real), and a ring from the Sun to Saturn (80 min).
// The last frame is frame 0's pose (a replay loops).
// Set: ../set (motif, beacon, look, planet). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring, segment } from "cinema/sci/front.js";
import { createBeacon } from "../set/beacon.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, CAMK = FILM.camk;
const S1 = Math.min(W, H) / 1080, sx = W / 1080, sy = H / 1920;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x080a1c, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, W / H, 0.05, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const pos = (c) => c.map((v) => Math.max(0, v));
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const V = (a) => new THREE.Vector3(...a);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] }, XY = { e1: [1, 0, 0], e2: [0, 1, 0] }, YZ = { e1: [0, 0, 1], e2: [0, 1, 0] };


// ── the world ─────────────────────────────────────────────────────────────
renderer.localClippingEnabled = true;
scene.add(new THREE.AmbientLight(0x7d8ab8, 0.9)); const sun = new THREE.DirectionalLight(0xfff4dc, 2.6); sun.position.set(-8, 10, 14); scene.add(sun);
const R = 3.0, SIN = FILM.sat[0], SOUT = FILM.sat[1], BAL = FILM.bal;
const NST = 3000, sr = mul(5), stP = new Float32Array(NST * 3), stR = new Float32Array(NST);
for (let i = 0; i < NST; i++) { const th = Math.acos(2 * sr() - 1), ph = sr() * 6.2832, r = 250 + 80 * sr(); stP.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], i * 3); stR[i] = sr(); }
const stG = new THREE.BufferGeometry(); stG.setAttribute("position", new THREE.BufferAttribute(stP, 3)); stG.setAttribute("rnd", new THREE.BufferAttribute(stR, 1));
const stars = new THREE.Points(stG, new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 4 * S1 } },
  vertexShader: `attribute float rnd; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.5 + 1.3 * rnd); vA = 0.2 + 0.7 * rnd; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a * 1.3, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
stars.frustumCulled = false; scene.add(stars); scene.fog = null;
// Saturn: banded pale-lemon sphere and a thin ring (a shader), a group so it can move, spin and tilt
const bandTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d"); const rb = mul(11);
  for (let y = 0; y < 256; y++) { const lat = y / 256, v = 0.5 + 0.5 * Math.sin(lat * 38 + Math.sin(lat * 11) * 2) * 0.6 + 0.2 * Math.sin(lat * 97 + 1); const k = Math.max(0, Math.min(1, v)); g.fillStyle = `rgb(${Math.round(196 + 40 * k)},${Math.round(178 + 46 * k)},${Math.round(128 + 52 * k)})`; g.fillRect(0, y, 512, 1); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,248,220,${0.03 + 0.04 * rb()})`; g.fillRect(rb() * 512, rb() * 256, 20 + rb() * 60, 1 + rb() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const sat = new THREE.Group(); scene.add(sat);
const clipP = new THREE.Plane(new THREE.Vector3(0, 0, -1), 50);
const satMat = new THREE.MeshLambertMaterial({ map: bandTex, clippingPlanes: [clipP], clipShadows: false, transparent: true });
const satMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), satMat); sat.add(satMesh);
const ringMat = new THREE.ShaderMaterial({
  uniforms: { uA: { value: 1 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uA; varying vec2 vP; void main(){ float r = length(vP); float k = (r - 3.9) / 2.9; float band = 0.55 + 0.45 * sin(r * 21.0) * sin(r * 6.0 + 1.0); float gap = 1.0 - smoothstep(0.0, 0.03, abs(k - 0.62) ) * 0.0 - (1.0 - smoothstep(0.0, 0.045, abs(k - 0.62)));
    float a = band * gap * smoothstep(0.0, 0.04, k) * (1.0 - smoothstep(0.94, 1.0, k)) * 0.8; gl_FragColor = vec4(vec3(0.95, 0.9, 0.7) * a * uA, a * uA); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide });
const satRing = new THREE.Mesh(new THREE.RingGeometry(3.9, 6.8, 128, 1), ringMat); satRing.rotation.x = -Math.PI / 2; const ringG = new THREE.Group(); ringG.add(satRing); sat.add(ringG);
// the cutaway cloud of hydrogen and helium (inside the cut half)
const NG = 2600, gr = mul(13), gP = new Float32Array(NG * 3), gA = new Float32Array(NG), gGeo = new THREE.BufferGeometry();
for (let i = 0; i < NG; i++) { let x, y, z; do { x = (gr() * 2 - 1) * R; y = (gr() * 2 - 1) * R; z = -gr() * R; } while (x * x + y * y + z * z > R * R * 0.94); gP.set([x, y, z], i * 3); gA[i] = 0.3 + 0.6 * gr(); }
gGeo.setAttribute("position", new THREE.BufferAttribute(gP, 3)); gGeo.setAttribute("alpha", new THREE.BufferAttribute(gA, 1));
const ptMat = (col, px) => new THREE.ShaderMaterial({
  uniforms: { uPx: { value: px * S1 }, uCol: { value: new THREE.Vector3(...col) }, uK: { value: 1 } },
  vertexShader: `attribute float alpha; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * clamp(26.0 / length(mv.xyz), 0.5, 3.0); vA = alpha; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uK; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA * uK; gl_FragColor = vec4(uCol * a * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const cloudMat = ptMat([0.78, 0.9, 1.0], 6), cloud = new THREE.Points(gGeo, cloudMat); cloud.frustumCulled = false; sat.add(cloud);
// the break-up: Saturn's gas as points that spread through the water and return
const NB = 3200, br = mul(17), bP0 = new Float32Array(NB * 3), bP1 = new Float32Array(NB * 3), bP = new Float32Array(NB * 3), bAA = new Float32Array(NB), bGeo = new THREE.BufferGeometry();
for (let i = 0; i < NB; i++) { const th = Math.acos(2 * br() - 1), ph = br() * 6.2832, rr = R * Math.cbrt(br()); bP0.set([rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph)], i * 3); bP1.set([(br() - 0.5) * 19, -0.3 - br() * 4.4, (br() - 0.5) * 9], i * 3); bAA[i] = 0.35 + 0.65 * br(); }
bGeo.setAttribute("position", new THREE.BufferAttribute(bP, 3)); bGeo.setAttribute("alpha", new THREE.BufferAttribute(bAA, 1));
const mixMat = ptMat([0.96, 0.92, 0.7], 6), mix = new THREE.Points(bGeo, mixMat); mix.frustumCulled = false; scene.add(mix);
// the tank
const TANKC = [6, -0.5, 0], tank = new THREE.Group(); tank.position.fromArray(TANKC); scene.add(tank);
tank.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(20, 9, 10)), new THREE.LineBasicMaterial({ color: 0x4fe3c6, transparent: true, opacity: 0.85 })));
const water = new THREE.Mesh(new THREE.BoxGeometry(19.9, 5, 9.9), new THREE.MeshBasicMaterial({ color: 0x3c8bd9, transparent: true, opacity: 0.2, depthWrite: false })); water.position.set(0, -2.0, 0); tank.add(water);
const wline = ring({ color: pos(line("teal", 0.95)), width: 3, opacity: 0 }); scene.add(wline.mesh);
const dimA = segment({ color: pos(line("lemon", 0.95)), width: 3, opacity: 0 }), dimB = segment({ color: pos(line("teal", 0.95)), width: 3, opacity: 0 }); scene.add(dimA.mesh, dimB.mesh);
// Earth, at Saturn's scale
const earthP = new THREE.Group(); scene.add(earthP);
const earth = createPlanet({ radius: 0.33, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 64 }); earthP.add(earth.group);
// the balance: a beam, two balls, a pool
const bal = new THREE.Group(); bal.position.fromArray(BAL); scene.add(bal);
const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x8fd0ff })), post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), new THREE.MeshBasicMaterial({ color: 0x8fd0ff }));
post.position.set(0, -0.2, 0); beam.position.set(0, 1.5, 0); bal.add(beam, post);
const rockB = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), new THREE.MeshLambertMaterial({ color: 0x9bb6e8 })); bal.add(rockB);
const gasGeo = new THREE.BufferGeometry(), NGB = 1600, gbP = new Float32Array(NGB * 3), gbA = new Float32Array(NGB), gbr = mul(23);
for (let i = 0; i < NGB; i++) { const th = Math.acos(2 * gbr() - 1), ph = gbr() * 6.2832, rr = 2.4 * Math.cbrt(gbr()); gbP.set([rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph)], i * 3); gbA[i] = 0.3 + 0.5 * gbr(); }
gasGeo.setAttribute("position", new THREE.BufferAttribute(gbP, 3)); gasGeo.setAttribute("alpha", new THREE.BufferAttribute(gbA, 1));
const gasB = new THREE.Points(gasGeo, ptMat([0.96, 0.92, 0.7], 6)); gasB.frustumCulled = false; bal.add(gasB);
const gasShell = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 24), new THREE.MeshBasicMaterial({ color: 0xf2eda6, transparent: true, opacity: 0.06, depthWrite: false })); bal.add(gasShell);
const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 6), new THREE.MeshBasicMaterial({ color: 0x3c8bd9, transparent: true, opacity: 0.24, depthWrite: false })); pool.position.set(0, -3.8, 0); bal.add(pool);
const poolEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(14, 3, 6)), new THREE.LineBasicMaterial({ color: 0x4fe3c6, transparent: true, opacity: 0.7 })); poolEdge.position.copy(pool.position); bal.add(poolEdge);
// the readout: the Sun, Saturn as a dot, a ring that grows from the Sun to Saturn
const SUNP = [-140, 0, 0], sunB = createBeacon({ color: pos(hdr("lemon", 1.7)), px: 70, core: 0.5 }), satDot = createBeacon({ color: pos(hdr("lemon", 1.4)), px: 22, core: 0.5 }), earthDot = createBeacon({ color: pos(hdr("ice", 1.4)), px: 14, core: 0.5 });
const sunRing = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 });
scene.add(sunB.mesh, satDot.mesh, earthDot.mesh, sunRing.mesh);

// ── the 2-D layer: the density bar, the dips ─────────────────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], ICE = [143, 208, 255], VOID = [8, 10, 28];
function overlay2d(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const bk = fadeIn(t, CUE.weighs, 0.5) * (1 - fadeIn(t, CUE.tank - 0.2, 0.4));
  if (bk > 0.01) {
    const x0 = 130 * sx, wMax = 820 * sx; ctx.fillStyle = rgba(VOID, 0.8 * bk); ctx.beginPath(); ctx.roundRect(90 * sx, 1480 * sy, 900 * sx, 170 * sy, 18 * S1); ctx.fill();
    ctx.font = `700 ${Math.round(26 * S1)}px Lexend, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = rgba(ICE, bk); ctx.fillText("water  1.0", x0, 1510 * sy); ctx.fillStyle = rgba(ICE, 0.9 * bk); ctx.beginPath(); ctx.roundRect(x0, 1526 * sy, wMax, 20 * sy, 8 * S1); ctx.fill();
    const g = E.out3(seg(t, CUE.weighs + 0.4, CUE.weighs + 1.6)); ctx.fillStyle = rgba(LEMON, bk); ctx.fillText("Saturn  0.69", x0, 1576 * sy); ctx.fillStyle = rgba(LEMON, 0.95 * bk); ctx.beginPath(); ctx.roundRect(x0, 1592 * sy, wMax * 0.687 * g, 20 * sy, 8 * S1); ctx.fill();
  }
  const D = CUE.dip, fl = (d) => E.inout3(seg(t, d - 0.1, d + 0.2)) * (1 - E.inout3(seg(t, d + 0.2, d + 0.45)));
  const dip = Math.max(fl(D[0]), fl(D[1]), fl(D[2]), E.inout3(seg(t, D[3] - 0.1, D[3] + 0.15)) * (1 - E.inout3(seg(t, D[3] + 0.15, D[3] + 0.4))));
  if (dip > 0.001) { ctx.fillStyle = rgba(VOID, dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { sat: [0, 0, 0], tank: [0, 0, 0], earthP: [0, 0, 0], rock: [0, 0, 0], gasb: [0, 0, 0] };
const KIND = { star: { color: "lemon", glyph: "✦", mark: "none" }, body: { color: "ice", glyph: "●", mark: "none" }, light: { color: "teal", glyph: "◯", mark: "none" }, grav: { color: "lilac", glyph: "", mark: "dashed" } };
const cap0 = FILM.captions[0], capShift = FILM.loop0 - 0.05 - cap0.t0;
const capLoop = { t0: FILM.loop0 - 0.05, t1: FILM.dur + 5, lines: cap0.lines.map((ln) => ln.map(([w, tw]) => [w, tw + capShift])) };
hud.captions([...FILM.captions, capLoop]);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const CEL = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  CEL[c.id] = el; el.classList.add(c.read ? "lm-read" : "lm-clock");
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.4vmin" : "5.4vmin";
  else if (v && c.text.length > 8 && !c.read) v.style.fontSize = "7.5vmin";
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed }); }
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";
const fo2 = endEl.querySelector(".fo");
if (fo2) fo2.style.marginTop = "1.8vmin";
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const scrimEl = document.querySelector(".hud-scrim");
let LOOPEL = null;
function makeLoop() { hud.update(1.5); tRing.update(1.5); LOOPEL = [titleEl, CEL["c-hook"]].filter(Boolean).map((el) => { const c = el.cloneNode(true); c.removeAttribute("id"); c.style.opacity = "0"; c.style.visibility = "hidden"; el.parentNode.appendChild(c); return c; }); }

// ── the camera: own keyframes (position, look-at, field of view), eased ──────────────────────────────
const lerp = (a, b, u) => a + (b - a) * u;
function camAt(t) {
  let i = CAMK.findIndex((k) => k.t > t); if (i < 0) i = CAMK.length - 1; if (i < 1) i = 1;
  const a = CAMK[i - 1], b = CAMK[i], u = b.t === a.t ? 1 : E.inout3(clamp01((t - a.t) / (b.t - a.t)));
  return { p: a.p.map((v, k) => lerp(v, b.p[k], u)), l: a.l.map((v, k) => lerp(v, b.l[k], u)), fov: lerp(a.fov, b.fov, u) };
}

window.seek = function (t) {
  if (!LOOPEL) makeLoop();
  const dipT = CUE.dip[3] + 0.15, tt = t >= dipT ? 0 : t;
  const cm = camAt(tt); camera.position.fromArray(cm.p); camera.fov = cm.fov; camera.updateProjectionMatrix(); camera.lookAt(...cm.l); camera.updateMatrixWorld();
  const inBal = tt >= CUE.dip[1] + 0.1 && tt < CUE.dip[2] + 0.1, inRd = tt >= CUE.rd + 0.1 && tt < CUE.end + 1;
  tank.visible = !inBal && !inRd; water.visible = tank.visible; earthP.visible = !inBal && !inRd && tt >= CUE.c && tt < CUE.dip[1]; bal.visible = inBal;
  sat.visible = !inBal && !inRd;
  // Saturn: in the tank (hook), beside it (normal, change), lowered onto the water (whoa), floating (takeaway)
  const lower = E.inout3(seg(tt, CUE.dip[2] + 0.1, CUE.floats + 0.5));
  let sp;
  if (tt < CUE.dip[0] + 0.1) sp = [SIN[0], SIN[1] + 0.12 * Math.sin(tt * 1.6), SIN[2]];
  else if (tt < CUE.dip[2]) sp = SOUT.slice();
  else sp = [SIN[0], (8 + (SIN[1] - 8) * lower) + (lower >= 0.999 ? 0.12 * Math.sin(tt * 1.6) : 0), SIN[2]];
  sat.position.fromArray(sp); S.sat = sp; S.tank = [TANKC[0] + 6, TANKC[1] + 3.5, 0];
  satMesh.rotation.y = 0.12 * tt; const tilt = tt < CUE.tk ? 0.5 : 0.5 + (0.06 - 0.5) * E.inout3(seg(tt, CUE.tk, CUE.tk + 1.4)); ringG.rotation.set(tilt, 0, 0.1);
  // the mix: the sphere dissolves into points that spread through the water, then returns
  const sp1 = E.inout3(seg(tt, CUE.mix, CUE.mix + 2.2)) * (1 - E.inout3(seg(tt, CUE.tk - 0.2, CUE.tk + 1.4))), mixOn = sp1 > 0.003;
  satMat.opacity = 1 - E.inout3(clamp01(sp1 * 3)); satMesh.visible = satMat.opacity > 0.02; ringMat.uniforms.uA.value = 1 - clamp01(sp1 * 2);
  mix.visible = mixOn; mix.position.set(0, 0, 0);
  for (let i = 0; i < NB; i++) { const j = i * 3, w = sp1, wob = Math.sin(tt * 1.1 + i) * 0.15 * w; bP[j] = sp[0] + bP0[j] + (bP1[j] - sp[0] - bP0[j]) * w + wob; bP[j + 1] = sp[1] + bP0[j + 1] + (bP1[j + 1] - sp[1] - bP0[j + 1]) * w; bP[j + 2] = bP0[j + 2] + (bP1[j + 2] - bP0[j + 2]) * w; }
  bGeo.attributes.position.needsUpdate = true;
  // the cutaway: half of Saturn is cut away to show the hydrogen and helium cloud
  const cutK = E.inout3(seg(tt, CUE.hydrogen - 0.4, CUE.hydrogen + 0.8)) * (1 - E.inout3(seg(tt, CUE.why - 0.9, CUE.why - 0.35)));
  clipP.constant = sp[2] + 0.0 + (1 - cutK) * 50; cloud.visible = cutK > 0.02; cloudMat.uniforms.uK.value = cutK;
  // the water line round Saturn, and the dimension lines (Saturn's width, the tank's width)
  const inWater = Math.abs(sp[1]) < R && sp[0] === SIN[0]; wline.arc({ center: [sp[0], 0.0, 0], r: Math.sqrt(Math.max(0.01, R * R - sp[1] * sp[1])), e1: [1, 0, 0], e2: [0, 0, -1] }).set({ opacity: inWater && !inBal && !inRd && sp1 < 0.2 ? 0.8 : 0 });
  const dk = fadeIn(tt, CUE.tank, 0.7) * (1 - fadeIn(tt, CUE.c - 0.3, 0.4));
  dimA.seg([sp[0] - R, sp[1] + 4.6, 0], [sp[0] + R, sp[1] + 4.6, 0]).set({ opacity: 0.95 * dk }); dimB.seg([TANKC[0] - 10, 4.9, 0], [TANKC[0] + 10, 4.9, 0]).set({ opacity: 0.95 * dk });
  // Earth at Saturn's scale
  const ep = [sp[0] - 5.6, sp[1] - 8.2, 4.0]; earthP.position.fromArray(ep); S.earthP = ep; earth.set({ center: [0, 0, 0], sunDir: [0.5, 0.3, 0.8], sun: 1, rimNight: 0.5, spin: -0.9 + 0.1 * tt });
  // the balance: level at first; the rock ball sinks in the pool, the gas ball floats on it
  const u1 = E.inout3(seg(tt, CUE.tight - 0.4, CUE.tight + 1.4)), u2 = E.inout3(seg(tt, CUE.thin - 1.2, CUE.thin + 0.8));
  const rockY = 1.5 - 1.2 - 3.2 * u1, gasY = 1.5 - 2.6 * 0.1 + 1.0 - 0.9 * u2;
  rockB.position.set(-4.5, rockY, 0); gasB.position.set(4.5, gasY, 0); gasShell.position.copy(gasB.position); gasB.rotation.y = 0.1 * tt;
  beam.rotation.z = 0; S.rock = [BAL[0] - 4.5, BAL[1] + rockY + 1.2, BAL[2]]; S.gasb = [BAL[0] + 4.5, BAL[1] + gasY + 2.6, BAL[2]];
  // the readout: the Sun, a dot for Saturn, a ring from the Sun to Saturn (not to scale)
  const u = E.inout3(seg(tt, CUE.eighty - 0.3, CUE.reach + 1.2)), rr = 140 * u, rdOn = inRd;
  sunB.set({ center: SUNP, camera, opacity: rdOn ? 1 : 0 }); satDot.set({ center: [0, 0, 0], camera, opacity: rdOn ? 1 : 0 }); earthDot.set({ center: [-125.3, 0, 0], camera, opacity: rdOn ? 1 : 0 });
  sunRing.arc({ center: SUNP, r: Math.max(0.01, rr), e1: [1, 0, 0], e2: [0, 0, -1] }).set({ opacity: rdOn && u > 0.002 ? 0.95 * (1 - 0.3 * u) * (1 - fadeIn(tt, CUE.end - 0.3, 0.3)) : 0 });
  overlay2d(t);
  hud.update(t); tRing.update(t); eRing.update(t);
  const lk = fadeIn(t, FILM.loop0, 0.45);
  endEl.style.opacity = String(1 - lk);
  if (scrimEl) scrimEl.style.opacity = String(parseFloat(scrimEl.style.opacity || "0") * (1 - lk));
  for (const c of LOOPEL) { c.style.visibility = lk > 0.01 ? "visible" : "hidden"; c.style.opacity = String(lk); }
  renderer.render(scene, camera);
};
