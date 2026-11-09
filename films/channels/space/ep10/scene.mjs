import * as THREE from "three";
// One More Orbit, Season 2 · Episode 4 (folder ep10), "Black-hole edge". The picture as a pure function of t.
//
// One 3-D world (not to scale, badged): a black hole (dark sphere, thin disk, bright ring), a teal horizon ring, probes that climb and fall back,
// a far-away watcher and a falling friend, three clocks at three distances, the friend's clock slowing as seen from afar, a GPS inset (Earth), and
// a ring that grows to 'about 55 million years'. The last frame is frame 0's pose (a replay loops). Nothing is claimed about the inside.
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
const RS = 2.0, EARTH = [400, 0, 0];
const NST = 3200, sr = mul(5), stP = new Float32Array(NST * 3), stR = new Float32Array(NST);
for (let i = 0; i < NST; i++) { const th = Math.acos(2 * sr() - 1), ph = sr() * 6.2832, r = 150 + 60 * sr(); stP.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], i * 3); stR[i] = sr(); }
const stG = new THREE.BufferGeometry(); stG.setAttribute("position", new THREE.BufferAttribute(stP, 3)); stG.setAttribute("rnd", new THREE.BufferAttribute(stR, 1));
const stars = new THREE.Points(stG, new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 4.5 * S1 } },
  vertexShader: `attribute float rnd; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.5 + 1.3 * rnd); vA = 0.25 + 0.75 * rnd; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a * 1.4, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
stars.frustumCulled = false; scene.add(stars);
scene.fog = null;
// the black hole: a dark sphere, a thin disk (pale lemon inside, ice and lilac outside), a bright ring that faces the camera
const BH = new THREE.Group(); scene.add(BH);
BH.add(new THREE.Mesh(new THREE.SphereGeometry(RS, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 })));
const diskMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uGain: { value: 1 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT, uGain; varying vec2 vP;
    void main(){ float r = length(vP), a = atan(vP.y, vP.x); float k = clamp((r - 2.7) / 6.8, 0.0, 1.0);
      float swirl = 0.72 + 0.28 * sin(a * 3.0 - r * 2.4 + uT * 1.3) * sin(a * 5.0 + r * 1.7 - uT * 0.8);
      float dop = 0.62 + 0.38 * cos(a - 0.7); float b = pow(1.0 - k, 2.0) * swirl * dop * smoothstep(0.0, 0.08, k) * 1.6;
      vec3 col = mix(vec3(1.0, 0.95, 0.74), mix(vec3(0.56, 0.82, 1.0), vec3(0.62, 0.52, 0.95), smoothstep(0.55, 1.0, k)), smoothstep(0.05, 0.55, k));
      gl_FragColor = vec4(col * b * uGain, b * uGain); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const diskG = new THREE.Group(); diskG.rotation.set(1.28, 0, 0.18); BH.add(diskG);
const disk = new THREE.Mesh(new THREE.RingGeometry(2.7, 9.5, 160, 20), diskMat); diskG.add(disk);
const haloMat = new THREE.ShaderMaterial({
  uniforms: { uGain: { value: 1 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uGain; varying vec2 vP; void main(){ float r = length(vP); float b = exp(-pow((r - 2.35) / 0.2, 2.0)) * 1.4 + exp(-pow((r - 2.9) / 0.7, 2.0)) * 0.32; float a = atan(vP.y, vP.x); b *= 0.65 + 0.35 * cos(a - 0.7);
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * b * uGain, b * uGain); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 4.2, 96, 1), haloMat); scene.add(halo);
const hzRing = ring({ color: pos(line("teal", 0.95)), width: 3.5, opacity: 0 });
scene.add(hzRing.mesh);
// the hook's faint dot, you, the friend (with a short trail), and a probe at a time
const dot0 = createBeacon({ color: pos(hdr("ice", 1.2)), px: 16, core: 0.5 });
const youB = createBeacon({ color: pos(hdr("ice", 1.5)), px: 22, core: 0.5 }), friendB = createBeacon({ color: pos(hdr("lemon", 1.6)), px: 22, core: 0.5 });
const PRB = [{ t0: CUE.escape + 0.4, dur: 2.2, A: 1.3, ph: 0.2, col: pos(hdr("ice", 1.4)) }, { t0: CUE.escape + 1.6, dur: 2.2, A: 2.8, ph: 0.65, col: pos(hdr("ice", 1.4)) }, { t0: CUE.more, dur: 2.4, A: 4.6, ph: 1.1, col: pos(hdr("teal", 1.6)) }];
const probeB = PRB.map((p) => createBeacon({ color: p.col, px: 14, core: 0.5 }));
const NTR = 22, trP = new Float32Array(PRB.length * NTR * 3), trA = new Float32Array(PRB.length * NTR), trG = new THREE.BufferGeometry();
trG.setAttribute("position", new THREE.BufferAttribute(trP, 3)); trG.setAttribute("alpha", new THREE.BufferAttribute(trA, 1));
const trails = new THREE.Points(trG, new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 7 * S1 } },
  vertexShader: `attribute float alpha; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * clamp(24.0 / length(mv.xyz), 0.6, 3.0); vA = alpha; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0 || vA < 0.01) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(0.7, 0.9, 1.0) * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
trails.frustumCulled = false; scene.add(trails);
// clocks: a ring that faces the camera and one hand; the hand's angle is the integral of the tick rate
const CLK = { far: ring({ color: pos(line("ice", 0.9)), width: 3, opacity: 0 }), mid: ring({ color: pos(line("ice", 0.9)), width: 3, opacity: 0 }), near: ring({ color: pos(line("lilac", 0.95)), width: 3, opacity: 0 }), you: ring({ color: pos(line("ice", 0.95)), width: 3, opacity: 0 }), fr: ring({ color: pos(line("lemon", 0.95)), width: 3, opacity: 0 }) };
const HND = { far: segment({ color: pos(line("ice", 0.9)), width: 3, opacity: 0 }), mid: segment({ color: pos(line("ice", 0.9)), width: 3, opacity: 0 }), near: segment({ color: pos(line("lilac", 0.95)), width: 3, opacity: 0 }), you: segment({ color: pos(line("ice", 0.95)), width: 3, opacity: 0 }), fr: segment({ color: pos(line("lemon", 0.95)), width: 3, opacity: 0 }) };
for (const k in CLK) { scene.add(CLK[k].mesh); scene.add(HND[k].mesh); }
// Earth with a GPS satellite (the inset), far from the hole
const earthG = new THREE.Group(); earthG.position.fromArray(EARTH); scene.add(earthG);
const earth = createPlanet({ radius: 2.2, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 96 });
earthG.add(earth.group);
const gpsB = createBeacon({ color: pos(hdr("lemon", 1.5)), px: 18, core: 0.5 }), gpsOrb = ring({ color: pos(line("teal", 0.8)), width: 2.5, opacity: 0 });
scene.add(gpsB.mesh, gpsOrb.mesh);
// the readout ring: it grows from the hole (not to scale)
const ringR = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 }); scene.add(ringR.mesh);
const earthDot = createBeacon({ color: pos(hdr("ice", 1.4)), px: 16, core: 0.5 }); scene.add(earthDot.mesh);
scene.add(dot0.mesh, youB.mesh, friendB.mesh); probeB.forEach((b) => scene.add(b.mesh));

// ── the 2-D layer: the tick-rate bars, the dips ─────────────────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], ICE = [143, 208, 255], LILAC = [185, 166, 255], TXT = [238, 240, 255], VOID = [8, 10, 28];
// the friend's path: r(t) in units of the hole's radius
const FKEYS = [[CUE.friend, 12], [CUE.falling + 1.5, 9], [t_why_(), 6.5], [CUE.slower, 5], [CUE.toyou, 4.2], [CUE.tick + 1.5, 3.4], [CUE.gap, 2.9], [CUE.gap + 3, 2.45], [CUE.tk + 0.01, 2.4]];
function t_why_() { return CUE.why; }
function friendR(t) { if (t <= FKEYS[0][0]) return FKEYS[0][1]; for (let i = 1; i < FKEYS.length; i++) if (t <= FKEYS[i][0]) { const a = FKEYS[i - 1], b = FKEYS[i]; return a[1] + (b[1] - a[1]) * E.inout3(seg(t, a[0], b[0])); } return FKEYS[FKEYS.length - 1][1]; }
const fRate = (r) => Math.sqrt(Math.max(0.02, 1 - RS / r));                       // tick rate of a clock at radius r, as seen from far away
// integrate a hand's angle: rate(t) numerically
function phase(rateFn, t) { let s = 0; const dt = 0.05; for (let x = 0; x < t; x += dt) s += rateFn(x) * Math.min(dt, t - x); return s; }
const RATE = {
  far: () => 1, mid: () => fRate(9), near: () => fRate(3.4),
  you: (x) => (x >= CUE.them ? 1 / fRate(friendR(x)) : 1),
  fr: (x) => (x >= CUE.them ? 1 : fRate(friendR(x))),
};
function overlay2d(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  // tick-rate bars: how fast each clock ticks, as one watcher sees it
  const bk = fadeIn(t, CUE.toyou, 0.5) * (1 - fadeIn(t, CUE.tk - 0.2, 0.4));
  if (bk > 0.01) {
    const them = t >= CUE.them, rf = friendR(t), a = 1, b = them ? 1 / fRate(rf) : fRate(rf), mx = them ? 2.6 : 1.1, x0 = 110 * sx, wMax = 860 * sx;
    ctx.fillStyle = rgba(VOID, 0.85 * bk); ctx.beginPath(); ctx.roundRect(70 * sx, 1440 * sy, 940 * sx, 300 * sy, 22 * S1); ctx.fill();
    ctx.font = `700 ${Math.round(40 * S1)}px Lexend, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = rgba(ICE, bk); ctx.fillText(them ? "everyone else, as they see it" : "you, far away", x0, 1480 * sy);
    ctx.fillStyle = rgba(ICE, 0.95 * bk); ctx.beginPath(); ctx.roundRect(x0, 1508 * sy, wMax * (them ? b : a) / mx, 36 * sy, 12 * S1); ctx.fill();
    ctx.fillStyle = rgba(LEMON, bk); ctx.fillText(them ? "your friend, hovering" : "your friend, as you see them", x0, 1596 * sy);
    ctx.fillStyle = rgba(LEMON, 0.95 * bk); ctx.beginPath(); ctx.roundRect(x0, 1624 * sy, wMax * (them ? a : b) / mx, 36 * sy, 12 * S1); ctx.fill();
  }
  const [d0, d1, d2] = CUE.dip;
  const dip = Math.max(E.inout3(seg(t, d0 - 0.1, d0 + 0.2)) * (1 - E.inout3(seg(t, d0 + 0.2, d0 + 0.45))), E.inout3(seg(t, d1 - 0.1, d1 + 0.2)) * (1 - E.inout3(seg(t, d1 + 0.2, d1 + 0.45))), E.inout3(seg(t, d2 - 0.1, d2 + 0.15)) * (1 - E.inout3(seg(t, d2 + 0.15, d2 + 0.4))));
  if (dip > 0.001) { ctx.fillStyle = rgba(VOID, dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { you: [0, 0, 0], friend: [0, 0, 0], probe: [0, 0, 0], hz: [0, 0, 0], gps: [0, 0, 0], clockFar: [0, 0, 0], clockNear: [0, 0, 0] };
const KIND = { star: { color: "lemon", glyph: "✦", mark: "none" }, body: { color: "ice", glyph: "●", mark: "none" }, light: { color: "teal", glyph: "◯", mark: "none" }, grav: { color: "lilac", glyph: "", mark: "dashed" } };
const cap0 = FILM.captions[0], capShift = FILM.loop0 - 0.05 - cap0.t0;
const capLoop = { t0: FILM.loop0 - 0.05, t1: FILM.dur + 5, lines: cap0.lines.map((ln) => ln.map(([w, tw]) => [w, tw + capShift])) };
hud.captions([...FILM.captions, capLoop]);
const titleEl = hud.title(FILM.title);
{ const se = titleEl.querySelector(".hud-series"), m = /Episode (\d+)/.exec(FILM.title.series || ""); if (se && m) { se.innerHTML = 'ONE MORE ORBIT · SEASON <b style="color:var(--teal,#4fe3c6)">2</b> · EPISODE <b style="color:var(--teal,#4fe3c6)">' + m[1] + "</b>"; Object.assign(se.style, { color: "var(--text-2)", whiteSpace: "nowrap", fontSize: "2.1vmin", letterSpacing: ".1em" }); } }
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) { const be = hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot }); if (be && be.style) be.style.marginTop = "6.4vmin"; }
const CEL = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  CEL[c.id] = el; el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (!c.read) Object.assign(el.style, { background: "rgba(8,10,28,.82)", borderRadius: "2vmin", padding: "1.2vmin 2.4vmin" });
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
if (endT) endT.style.fontSize = "5.2vmin";
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
  const a = CAMK[i - 1], b = CAMK[i], u = b.t === a.t ? 1 : (() => { const x = clamp01((t - a.t) / (b.t - a.t)); return 0.55 * E.inout3(x) + 0.45 * x; })();
  return { p: a.p.map((v, k) => lerp(v, b.p[k], u)), l: a.l.map((v, k) => lerp(v, b.l[k], u)), fov: lerp(a.fov, b.fov, u) };
}

window.seek = function (t) {
  if (!LOOPEL) makeLoop();
  const dipT = CUE.dip[2] + 0.15, tt = t >= dipT ? 0 : t;
  const cm = camAt(tt); { const dd = Math.hypot(cm.p[0] - cm.l[0], cm.p[1] - cm.l[1], cm.p[2] - cm.l[2]) * 0.03; cm.p = [cm.p[0] + Math.sin(tt * 0.9) * dd, cm.p[1] + Math.sin(tt * 0.65 + 1.0) * dd * 0.6, cm.p[2] + Math.sin(tt * 0.5 + 2.0) * dd * 0.5]; }   // a slow drift: the picture is never still
  camera.position.fromArray(cm.p); camera.fov = cm.fov; camera.updateProjectionMatrix(); camera.lookAt(...cm.l); camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const bb = (c, r) => ({ center: c, r, e1: right.toArray(), e2: up.toArray() });
  const inGPS = tt >= CUE.dip[0] + 0.1 && tt < CUE.dip[1] + 0.1;
  BH.visible = !inGPS; halo.visible = !inGPS; stars.visible = true; earthG.visible = inGPS;
  halo.position.set(0, 0, 0); halo.quaternion.copy(camera.quaternion);
  diskMat.uniforms.uT.value = tt; const dk = 1 - 0.3 * fadeIn(tt, CUE.tk, 1.0); diskMat.uniforms.uGain.value = dk; haloMat.uniforms.uGain.value = dk;
  const bhOn = !inGPS;
  // the horizon ring (teal, faces the camera): it draws on "horizon", stays through the escape lines, softens later
  const hzK = fadeIn(tt, CUE.horizon, 0.7) * (1 - 0.55 * fadeIn(tt, CUE.dip[1] + 0.4, 0.8));
  hzRing.arc(bb([0, 0, 0], RS * 1.05)).set({ opacity: bhOn ? 0.95 * hzK : 0 });
  S.hz = [RS * 1.05 * Math.cos(0.5) * right.x + RS * 1.05 * Math.sin(0.5) * up.x, RS * 1.05 * (Math.cos(0.5) * right.y + Math.sin(0.5) * up.y), RS * 1.05 * (Math.cos(0.5) * right.z + Math.sin(0.5) * up.z)];
  // the hook's dot, hovering at the edge (and again for the loop)
  const dRad = 2.75, dA = 0.9 + 0.1 * Math.sin(tt * 1.2);
  dot0.set({ center: [dRad * Math.cos(dA) * right.x + dRad * Math.sin(dA) * up.x, dRad * (Math.cos(dA) * right.y + Math.sin(dA) * up.y), dRad * (Math.cos(dA) * right.z + Math.sin(dA) * up.z)], camera, opacity: tt < CUE.n + 0.2 ? 0.95 * (1 - fadeIn(tt, CUE.n - 0.3, 0.5)) : 0 });
  // probes: each rises from the ring and falls back, whatever its speed; the last is a light-speed pulse (teal)
  PRB.forEach((p, k) => {
    const s = (tt - p.t0) / p.dur, on = s >= 0 && s < 1;
    const r = RS * 1.02 + p.A * 4 * s * (1 - s) * (1 - 0.35 * s), ang = p.ph;
    const c = [r * (Math.cos(ang) * right.x + Math.sin(ang) * up.x), r * (Math.cos(ang) * right.y + Math.sin(ang) * up.y), r * (Math.cos(ang) * right.z + Math.sin(ang) * up.z)];
    probeB[k].set({ center: c, camera, opacity: on ? Math.min(1, s * 8) * (1 - E.in3(seg(s, 0.9, 1))) : 0 });
    for (let j = 0; j < NTR; j++) {
      const sj = Math.max(0, s - j * 0.018), rj = RS * 1.02 + p.A * 4 * sj * (1 - sj) * (1 - 0.35 * sj), idx = (k * NTR + j) * 3;
      trP[idx] = rj * (Math.cos(ang) * right.x + Math.sin(ang) * up.x); trP[idx + 1] = rj * (Math.cos(ang) * right.y + Math.sin(ang) * up.y); trP[idx + 2] = rj * (Math.cos(ang) * right.z + Math.sin(ang) * up.z);
      trA[k * NTR + j] = on && s - j * 0.018 > 0 ? 0.6 * (1 - j / NTR) * (1 - E.in3(seg(s, 0.9, 1))) : 0;
    }
    if (k === PRB.length - 1) S.probe = c;
  });
  trG.attributes.position.needsUpdate = true; trG.attributes.alpha.needsUpdate = true;
  // you (far away, left) and the friend (falling): the friend's path is a line from the right side into the hole
  const YOU = [-9, -1.4, 15]; S.you = YOU;
  const fr = friendR(tt), fd = V([0.8, 0.12, 0.58]).normalize(), fp = [fd.x * fr * 1.0, fd.y * fr, fd.z * fr];
  S.friend = fp;
  const fOn = tt >= CUE.friend - 0.3 && tt < CUE.dip[0] || tt >= CUE.dip[1] + 0.3 && tt < CUE.tk + 0.3;
  youB.set({ center: YOU, camera, opacity: bhOn && fOn ? 1 : 0 }); friendB.set({ center: fp, camera, opacity: bhOn && fOn ? 1 : 0 });
  // clocks
  const clk = (key, c, rad, on) => { CLK[key].arc(bb(c, rad)).set({ opacity: on ? 0.9 : 0 }); const ph = phase(RATE[key], tt) * 0.9, hv = [c[0] + rad * (Math.sin(ph) * right.x + Math.cos(ph) * up.x), c[1] + rad * (Math.sin(ph) * right.y + Math.cos(ph) * up.y), c[2] + rad * (Math.sin(ph) * right.z + Math.cos(ph) * up.z)]; HND[key].seg(c, hv).set({ opacity: on ? 0.95 : 0 }); };
  const cOn = tt >= CUE.dip[1] + 0.3 && tt < CUE.toyou - 0.1;
  const cf = [-8.5, 3.5, 3], cm2 = [-1.2, 5.6, 0], cn = [4.8, 3.8, -2];
  S.clockFar = cf; S.clockNear = cn;
  clk("far", cf, 1.3, cOn && bhOn && tt > CUE.closer - 3.5); clk("mid", cm2, 1.3, cOn && bhOn && tt > CUE.closer - 2.2); clk("near", cn, 1.3, cOn && bhOn && tt > CUE.closer);
  const wOn = tt >= CUE.toyou - 0.1 && tt < CUE.tk + 0.4 && bhOn;
  clk("you", [YOU[0], YOU[1] + 2.4, YOU[2]], 1.0, wOn); clk("fr", [fp[0], fp[1] + 1.5, fp[2]], 0.7, wOn);
  // Earth and a GPS satellite
  earth.set({ center: [0, 0, 0], sunDir: [0.5, 0.2, 0.85], sun: 1, rimNight: 0.5, spin: -0.9 + 0.06 * tt });
  const ga = 0.5 + 0.3 * (tt - CUE.gps), gp = [EARTH[0] + 9.2 * Math.cos(ga), EARTH[1] + 9.2 * Math.sin(ga) * 0.55, EARTH[2] + 3.0 * Math.sin(ga)];
  S.gps = gp; gpsB.set({ center: gp, camera, opacity: inGPS ? 1 : 0 });
  gpsOrb.arc({ center: EARTH, r: 9.2, e1: [1, 0, 0], e2: [0, 0.55, 0.3] }).set({ opacity: inGPS ? 0.6 : 0 });
  // the readout ring: from the hole outward; a dot for us at its edge
  const u = E.inout3(seg(tt, CUE.photo + 0.2, CUE.years + 0.5)), rr = 40 * u;
  ringR.arc({ center: [0, 0, 0], r: Math.max(0.01, rr), ...XZ }).set({ opacity: u > 0.002 ? 0.95 * (1 - 0.35 * u) * (1 - fadeIn(tt, CUE.end - 0.3, 0.3)) : 0 });
  earthDot.set({ center: [0, 0, rr], camera, opacity: u > 0.5 ? (u - 0.5) * 2 * (1 - fadeIn(tt, CUE.end - 0.3, 0.3)) : 0 });
  overlay2d(t);
  hud.update(t); tRing.update(t); eRing.update(t);
  const lk = fadeIn(t, FILM.loop0, 0.45);
  endEl.style.opacity = String(1 - lk);
  if (scrimEl) scrimEl.style.opacity = String(parseFloat(scrimEl.style.opacity || "0") * (1 - lk));
  for (const c of LOOPEL) { c.style.visibility = lk > 0.01 ? "visible" : "hidden"; c.style.opacity = String(lk); }
  renderer.render(scene, camera);
};
