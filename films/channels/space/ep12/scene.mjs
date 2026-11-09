import * as THREE from "three";
// One More Orbit, Season 2 · Episode 6 (folder ep12), "Footprints". The picture as a pure function of t.
//
// One 3-D world: lunar dust (a height-field with boot prints, a trail, a lander base and rover tracks) in low light with Earth in the sky; a beach where the same print washes out;
// grains striking the dust; the camera pulling back from one print to the whole site; the Moon over a street; a ring from Earth to the Moon (1.25 s). The last frame is frame 0's pose.
// Set: ../set (motif, beacon, look, planet). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring, segment } from "cinema/sci/front.js";
import { createBeacon } from "../set/beacon.js";
import { createPlanet, earthSurface } from "../set/planet.js";
import { moonSurface } from "../set/moon.js";
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
scene.add(new THREE.AmbientLight(0x6f7aa8, 0.55)); const sunL = new THREE.DirectionalLight(0xfff4dc, 3.0); sunL.position.set(-30, 7, 14); scene.add(sunL);
const BEACH = FILM.beach, ST = FILM.street, EMP = FILM.emp, LAND = FILM.land;
const NST = 3200, sr = mul(5), stP = new Float32Array(NST * 3), stR = new Float32Array(NST);
for (let i = 0; i < NST; i++) { const th = Math.acos(2 * sr() - 1), ph = sr() * 6.2832, r = 300 + 80 * sr(); stP.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], i * 3); stR[i] = sr(); }
const stG = new THREE.BufferGeometry(); stG.setAttribute("position", new THREE.BufferAttribute(stP, 3)); stG.setAttribute("rnd", new THREE.BufferAttribute(stR, 1));
const stars = new THREE.Points(stG, new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 4 * S1 } },
  vertexShader: `attribute float rnd; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.5 + 1.3 * rnd); vA = 0.2 + 0.7 * rnd; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(0.92, 0.94, 1.0) * a * 1.3, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
stars.frustumCulled = false; scene.add(stars); scene.fog = null;
// height-field terrains. base(x, z): gentle noise; prints: a boot print (a rounded dent with two ridges); amp scales the prints
const hn = (x, z, s) => { let h = Math.imul((Math.floor(x * 7.31) * 374761393) ^ (Math.floor(z * 7.31) * 668265263) ^ s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, z, s) => { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const g = (i, j) => hn(i / 7.31 + 0.01, j / 7.31 + 0.01, s); return g(xi, zi) + (g(xi + 1, zi) - g(xi, zi)) * u + (g(xi, zi + 1) - g(xi, zi)) * v + (g(xi, zi) - g(xi + 1, zi) - g(xi, zi + 1) + g(xi + 1, zi + 1)) * u * v; };
const baseH = (x, z, rough) => rough * (0.5 * vn(x * 0.9, z * 0.9, 3) + 0.25 * vn(x * 2.7, z * 2.7, 5) + 0.12 * vn(x * 8, z * 8, 7) - 0.45);
function printH(dx, dz, ang) { const c = Math.cos(ang), s = Math.sin(ang), u = dx * c + dz * s, v = -dx * s + dz * c; const L = 0.8, Wd = 0.35; const q = (u / L) ** 2 + (v / Wd) ** 2; if (q > 1.6) return 0;
  const bowl = -0.09 * Math.exp(-q * 2.4), tread = 0.005 * Math.sin(u * 22) * Math.exp(-q * 2.5), rim = 0.03 * Math.exp(-Math.pow((Math.sqrt(q) - 1.0) / 0.2, 2)); return bowl + tread + rim; }
function buildTerrain(size, n, rough, prints, tracks) {
  const g = new THREE.PlaneGeometry(size, size, n, n); g.rotateX(-Math.PI / 2); const P = g.attributes.position;
  const apply = (amp) => { for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); let y = baseH(x, z, rough); let pr = 0;
      for (const [px, pz, a] of prints) { const dx = x - px, dz = z - pz; if (Math.abs(dx) < 0.9 && Math.abs(dz) < 0.9) pr += printH(dx, dz, a); }
      for (const [x0, z0, x1, z1] of tracks) { const vx = x1 - x0, vz = z1 - z0, L2 = vx * vx + vz * vz, tt = Math.max(0, Math.min(1, ((x - x0) * vx + (z - z0) * vz) / L2)), d = Math.hypot(x - (x0 + tt * vx), z - (z0 + tt * vz)); if (d < 0.5) pr += -0.03 * Math.exp(-Math.pow((d - 0.2) / 0.1, 2)); }
      P.setY(i, y + pr * amp); } P.needsUpdate = true; g.computeVertexNormals(); };
  apply(1); return { g, apply };
}
// the Moon: a trail of prints from the lander base to the boot print at the origin and beyond, plus two rover tracks
const prints = [], path = [[LAND[0] + 2.0, LAND[2] + 1.4], [-5, -4.6], [-2.2, -1.6], [0, 0], [3.0, 0.6], [7, 1.8], [12, 3.0], [17, 4.4]];
for (let k = 1; k < path.length; k++) { const [x0, z0] = path[k - 1], [x1, z1] = path[k], L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0); for (let d = 0; d < L; d += 1.15) { const side = (Math.floor(d / 1.15) + k) % 2 ? 1 : -1; prints.push([x0 + (x1 - x0) * d / L - Math.sin(a) * 0.32 * side, z0 + (z1 - z0) * d / L + Math.cos(a) * 0.32 * side, a + 0.08 * side]); } }
prints.push([0, 0, 0.05]);
const moonT = buildTerrain(50, 560, 0.012, prints, [[LAND[0] - 1.5, LAND[2] + 4.5, 14, 14], [LAND[0] - 1.5, LAND[2] + 5.3, 14, 14.8]]);
const moonMesh = new THREE.Mesh(moonT.g, new THREE.MeshStandardMaterial({ color: 0xa4a7b8, roughness: 1, metalness: 0 })); scene.add(moonMesh);
// the lander base: a platform, four legs, a dish (pale)
const floorBig = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0xa4a7b8, roughness: 1 })); floorBig.rotation.x = -Math.PI / 2; floorBig.position.y = -0.08; scene.add(floorBig);
const lander = new THREE.Group(); lander.position.set(LAND[0], 0.05, LAND[2]); scene.add(lander);
const lm = new THREE.MeshStandardMaterial({ color: 0xd8dcf0, roughness: 0.6, metalness: 0.2 });
const plat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.32, 1.9), lm); plat.position.y = 0.95; lander.add(plat);
for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.25, 8), lm); leg.position.set(lx * 1.15, 0.5, lz * 1.15); leg.rotation.z = -lx * 0.5; leg.rotation.x = lz * 0.5; lander.add(leg); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), lm); pad.position.set(lx * 1.5, 0.0, lz * 1.5); lander.add(pad); }
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.8, 10), lm); body.position.y = 1.5; lander.add(body);
// Earth in the black sky (frame 0), and the Earth and Moon of the readout
const earthSky = createPlanet({ radius: 5, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 64 }); const eg = new THREE.Group(); eg.position.set(-72, 30, -96); eg.add(earthSky.group); scene.add(eg);
// the beach: the same print in sand; it washes out under rain and wind
const beachT = buildTerrain(14, 190, 0.01, [[0, 0, 0.05]], []);
const beachMesh = new THREE.Mesh(beachT.g, new THREE.MeshStandardMaterial({ color: 0xc7c0a0, roughness: 1 })); beachMesh.position.fromArray(BEACH); scene.add(beachMesh);
const NR = 700, rr2 = mul(29), rP = new Float32Array(NR * 3), rA = new Float32Array(NR), rG = new THREE.BufferGeometry();
rG.setAttribute("position", new THREE.BufferAttribute(rP, 3)); rG.setAttribute("alpha", new THREE.BufferAttribute(rA, 1));
const ptMat = (col, px) => new THREE.ShaderMaterial({
  uniforms: { uPx: { value: px * S1 }, uCol: { value: new THREE.Vector3(...col) } },
  vertexShader: `attribute float alpha; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * clamp(8.0 / length(mv.xyz), 0.5, 3.0); vA = alpha; }`,
  fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0 || vA < 0.01) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(uCol * a * 1.5, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const rain = new THREE.Points(rG, ptMat([0.5, 0.85, 1.0], 5)); rain.frustumCulled = false; scene.add(rain);
const NGR = 140, gr = mul(31), gP = new Float32Array(NGR * 3), gA = new Float32Array(NGR), gG = new THREE.BufferGeometry();
gG.setAttribute("position", new THREE.BufferAttribute(gP, 3)); gG.setAttribute("alpha", new THREE.BufferAttribute(gA, 1));
const grains = new THREE.Points(gG, ptMat([0.95, 0.93, 0.8], 7)); grains.frustumCulled = false; scene.add(grains);
const GR = Array.from({ length: NGR }, () => ({ x: (gr() - 0.5) * 2.6, z: (gr() - 0.5) * 2.0, ph: gr(), per: 0.7 + gr() * 0.8 }));
// the street at night: dark ground and buildings with lit windows, the Moon rising
const street = new THREE.Group(); street.position.fromArray(ST); scene.add(street);
const gnd = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x0a0d24 })); gnd.rotation.x = -Math.PI / 2; street.add(gnd);
const bm = mul(41), bx = new THREE.MeshBasicMaterial({ color: 0x12163a }), winP = [];
for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 9; i++) { const w = 6 + bm() * 4, h = 10 + bm() * 22, d = 8 + bm() * 4, x = side * (11 + w / 2), z = 10 - i * 12; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bx); m.position.set(x, h / 2, z); street.add(m);
  for (let k = 0; k < 14; k++) if (bm() > 0.45) winP.push(x - side * w * 0.5 + (bm() - 0.5) * 0.2, 1.5 + bm() * (h - 2.5), z + d / 2 + 0.05 + (bm() - 0.5) * 0.0); }
const winG = new THREE.BufferGeometry(); const wp = new Float32Array(winP); winG.setAttribute("position", new THREE.BufferAttribute(wp, 3)); const wa = new Float32Array(wp.length / 3).fill(0.85); winG.setAttribute("alpha", new THREE.BufferAttribute(wa, 1));
const wins = new THREE.Points(winG, ptMat([1.0, 0.95, 0.7], 14)); wins.frustumCulled = false; street.add(wins);
const moonUp = createPlanet({ radius: 12, surface: moonSurface({ width: 1024, seed: 9 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.4, segments: 64 }); const mgU = new THREE.Group(); mgU.position.set(ST[0], 20, ST[2] - 90); mgU.add(moonUp.group); scene.add(mgU);
// the readout: Earth and Moon; a ring that grows from Earth to the Moon (not to scale)
const emE = createPlanet({ radius: 2.5, surface: earthSurface({ width: W >= 1000 ? 2048 : 1024 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.5, segments: 64 }); const emEg = new THREE.Group(); emEg.position.fromArray(EMP); emEg.add(emE.group); scene.add(emEg);
const emM = createPlanet({ radius: 0.7, surface: moonSurface({ width: 512, seed: 9 }), tilt: 0, pin: 0, rimDay: 0.5, rimNight: 0.4, segments: 48 }); const emMg = new THREE.Group(); emMg.position.set(EMP[0] + 28, EMP[1], EMP[2]); emMg.add(emM.group); scene.add(emMg);
const emRing = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 }); scene.add(emRing.mesh);
const emRing2 = ring({ color: pos(line("teal", 0.8)), width: 3, opacity: 0 }); scene.add(emRing2.mesh);

// ── the 2-D layer: the dips ──────────────────────────────────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const VOID = [8, 10, 28];
function overlay2d(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const D = CUE.dip, fl = (d) => E.inout3(seg(t, d - 0.1, d + 0.2)) * (1 - E.inout3(seg(t, d + 0.2, d + 0.45)));
  const dip = Math.max(fl(D[0]), fl(D[1]), fl(D[2]), fl(D[3]), E.inout3(seg(t, D[4] - 0.1, D[4] + 0.15)) * (1 - E.inout3(seg(t, D[4] + 0.15, D[4] + 0.4))));
  if (dip > 0.001) { ctx.fillStyle = rgba(VOID, dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { print: [0, 0, 0], trail: [0, 0, 0], beachP: [0, 0, 0], lander: [0, 0, 0] };
const KIND = { star: { color: "lemon", glyph: "✦", mark: "none" }, body: { color: "ice", glyph: "●", mark: "none" }, light: { color: "teal", glyph: "◯", mark: "none" }, grav: { color: "lilac", glyph: "", mark: "dashed" } };
const cap0 = FILM.captions[0], capShift = FILM.loop0 - 0.05 - cap0.t0;
const capLoop = { t0: FILM.loop0 - 0.05, t1: FILM.dur + 5, lines: cap0.lines.map((ln) => ln.map(([w, tw]) => [w, tw + capShift])) };
hud.captions([...FILM.captions, capLoop]);
const titleEl = hud.title(FILM.title);
{ const se = titleEl.querySelector(".hud-series"), m = /Episode (\d+)/.exec(FILM.title.series || ""); if (se && m) { se.innerHTML = 'ONE MORE ORBIT · SEASON <b style="color:var(--teal,#4fe3c6)">2</b> · EPISODE <b style="color:var(--teal,#4fe3c6)">' + m[1] + "</b>"; Object.assign(se.style, { color: "var(--text-2)", whiteSpace: "nowrap", fontSize: "2.1vmin", letterSpacing: ".1em" }); } }
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const CEL = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  CEL[c.id] = el; el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (!c.read) Object.assign(el.style, { background: "rgba(8,10,28,.82)", borderRadius: "2vmin", padding: "1.2vmin 2.4vmin" });
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.4vmin" : "5.4vmin";
  if (v && c.text.length > 20 && !c.read) v.style.fontSize = "4.2vmin";
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

let lastAmp = -1;
window.seek = function (t) {
  if (!LOOPEL) makeLoop();
  const dipT = CUE.dip[4] + 0.15, tt = t >= dipT ? 0 : t;
  const cm = camAt(tt); { const dd = Math.hypot(cm.p[0] - cm.l[0], cm.p[1] - cm.l[1], cm.p[2] - cm.l[2]) * 0.03; cm.p = [cm.p[0] + Math.sin(tt * 0.9) * dd, cm.p[1] + Math.sin(tt * 0.65 + 1.0) * dd * 0.6, cm.p[2] + Math.sin(tt * 0.5 + 2.0) * dd * 0.5]; }   // a slow drift: the picture is never still
  camera.position.fromArray(cm.p); camera.fov = cm.fov; camera.updateProjectionMatrix(); camera.lookAt(...cm.l); camera.updateMatrixWorld();
  const D = CUE.dip, inBeach = tt >= D[0] + 0.1 && tt < D[1] + 0.1, inStreet = tt >= D[2] + 0.1 && tt < D[3] + 0.1, inEM = tt >= D[3] + 0.1 && tt < CUE.end + 1;
  const onMoon = !inBeach && !inStreet && !inEM;
  moonMesh.visible = onMoon; floorBig.visible = onMoon; lander.visible = onMoon && ((tt >= CUE.orbiters - 0.2 && tt < CUE.c) || tt >= CUE.pull + 0.5); eg.visible = onMoon; beachMesh.visible = inBeach; rain.visible = inBeach; grains.visible = onMoon; street.visible = inStreet; mgU.visible = inStreet; emEg.visible = inEM; emMg.visible = inEM;
  sunL.position.set(inStreet ? -10 : -30, inStreet ? 12 : 7, 14); sunL.target.position.set(0, 0, 0);
  S.print = [0, 0.02, 0]; S.trail = [3, 0.1, -9]; S.lander = [LAND[0], 1.3, LAND[2]]; S.beachP = [BEACH[0], 0.1, 0];
  // the beach print: it washes out on "days" (rain and wind), the sand smooths
  const amp = 1 - E.inout3(seg(tt, CUE.earth + 0.6, CUE.days + 0.3)); if (inBeach && Math.abs(amp - lastAmp) > 0.01) { beachT.apply(amp); lastAmp = amp; }
  for (let i = 0; i < NR; i++) { const ph = (tt * 1.8 + i * 0.137) % 1, x = BEACH[0] + (rr2() - 0.5) * 0.0 + Math.sin(i * 12.9) * 3.2 + 1.2 * (1 - ph), z = Math.cos(i * 7.7) * 3.2, y = 4 * (1 - ph); rP[i * 3] = x + 0.4 * (1 - ph); rP[i * 3 + 1] = y; rP[i * 3 + 2] = z; rA[i] = inBeach ? 0.55 * fadeIn(tt, CUE.earth, 0.6) * (1 - fadeIn(tt, CUE.air - 0.5, 0.3)) : 0; }
  rG.attributes.position.needsUpdate = true; rG.attributes.alpha.needsUpdate = true;
  // grains strike the lunar dust (one at a time, a flash each), mostly while the narration says so
  const gOn = fadeIn(tt, CUE.grains - 0.5, 0.5) * (1 - fadeIn(tt, CUE.mm + 0.8, 0.5));
  GR.forEach((g, k) => { const ph = ((tt / g.per) + g.ph) % 1, fall = ph < 0.82, hit = !fall; const hx = g.x, hz = g.z; const u = fall ? ph / 0.82 : (ph - 0.82) / 0.18;
    gP[k * 3] = hx + (fall ? (1 - u) * 1.4 : 0); gP[k * 3 + 1] = fall ? 0.05 + (1 - u) * 1.8 : 0.03 + 0.12 * u; gP[k * 3 + 2] = hz; gA[k] = onMoon && tt > CUE.grains - 0.6 && tt < CUE.mm + 1.4 ? gOn * (fall ? 0.9 * u : 0.8 * (1 - u)) : 0; });
  gG.attributes.position.needsUpdate = true; gG.attributes.alpha.needsUpdate = true;
  // the street Moon rises; the Earth and Moon readout
  mgU.position.y = 17 + 11 * (0.5 * E.inout3(seg(tt, CUE.tk, CUE.rd)) + 0.5 * seg(tt, CUE.tk, CUE.rd)); moonUp.set({ center: [0, 0, 0], sunDir: [-0.4, 0.2, 0.9], sun: 1, rimNight: 0.4, spin: 0.3 + 0.35 * tt });
  emE.set({ center: [0, 0, 0], sunDir: [0.6, 0.3, 0.7], sun: 1, rimNight: 0.5, spin: -0.9 + 0.45 * tt }); emM.set({ center: [0, 0, 0], sunDir: [-0.6, 0.3, 0.7], sun: 1, rimNight: 0.4, spin: 0.2 });
  earthSky.set({ center: [0, 0, 0], sunDir: [0.5, 0.2, 0.85], sun: 1, rimNight: 0.5, spin: -0.9 + 0.03 * tt });
  const u = E.inout3(seg(tt, CUE.light + 0.1, CUE.quarter + 1.0)), rr = 28 * u;
  emRing.arc({ center: EMP, r: Math.max(0.01, rr), e1: [1, 0, 0], e2: [0, 0, -1] }).set({ opacity: inEM && u > 0.002 ? 0.95 * (1 - 0.3 * u) * (1 - fadeIn(tt, CUE.end - 0.3, 0.3)) : 0 });
  { const ph = Math.max(0, tt - (CUE.quarter + 0.6)) * 0.55 % 1, on2 = inEM && tt > CUE.quarter + 0.6; emRing2.arc({ center: EMP, r: Math.max(0.01, 3 + 25 * ph), e1: [1, 0, 0], e2: [0, 0, -1] }).set({ opacity: on2 ? 0.55 * (1 - ph) * (1 - fadeIn(tt, CUE.end - 0.3, 0.3)) : 0 }); }
  overlay2d(t);
  hud.update(t); tRing.update(t); eRing.update(t);
  const lk = fadeIn(t, FILM.loop0, 0.45);
  endEl.style.opacity = String(1 - lk);
  if (scrimEl) scrimEl.style.opacity = String(parseFloat(scrimEl.style.opacity || "0") * (1 - lk));
  for (const c of LOOPEL) { c.style.visibility = lk > 0.01 ? "visible" : "hidden"; c.style.opacity = String(lk); }
  renderer.render(scene, camera);
};
