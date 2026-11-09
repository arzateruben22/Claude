// Reality Rulebook · Season 2 · Episode 4, "The ring a coffee drop leaves" (films/channels/physics/ep10): the picture, a pure function of t.
// A thin drop on paper with a pinned edge, evaporating fastest at the edge: a closed-form model of the specks' paths (compile.py
// docstring). The paths are integrated at load (a table, so seek is pure), the numbers are made up, and the film says "model".
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, M = FILM.model;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12, shutter: 0 });   // no motion blur: it smears the specks
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62", speck: "#3A2412", water: "#8FA9C4" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
cyc.wall.visible = false; cyc.floor.scale.set(3, 1, 3);
cyc.uniforms.uCyl.value.set(40, 200, 1e6);
window.SCENE_READY = P.ready;

// ── the model: speck paths dr/dτ = G(r)/4, τ = -ln(1 - s); a table of the one trajectory (specks sit at different phases of it) ──
const R = M.R, H0 = M.H0, N = M.n, RINGF = M.ring;
const G = (r) => (2 * r * r - r ** 4 - 1 + Math.sqrt(Math.max(0, 1 - r * r))) / (r * (1 - r * r));
const TR = [[0, 1e-3]];
{ let r = 1e-3, t = 0; const dt = 0.002;
  while (r < 0.9995 && t < 60) { const k1 = G(r) / 4, k2 = G(r + dt / 2 * k1) / 4, k3 = G(r + dt / 2 * k2) / 4, k4 = G(r + dt * k3) / 4; r += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); t += dt; TR.push([t, r]); } }
const TEDGE = TR[TR.length - 1][0];
const lookT = (tt) => { let lo = 0, hi = TR.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TR[m][0] < tt) lo = m; else hi = m; } const a = TR[lo], b = TR[hi]; return a[1] + (b[1] - a[1]) * (tt - a[0]) / Math.max(1e-9, b[0] - a[0]); };
const tau0Of = (r0) => { let lo = 0, hi = TR.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TR[m][1] < r0) lo = m; else hi = m; } return TR[hi][0]; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rng(1997), SP = [];
for (let i = 0; i < N; i++) { const r0 = Math.max(1e-3, Math.sqrt(rnd())), ph = rnd() * Math.PI * 2, fr = 0.08 + 0.8 * rnd(); SP.push({ r0, ph, fr, tau0: tau0Of(r0), arrive: TEDGE - tau0Of(r0) }); }
{ const order = SP.map((p, i) => i).sort((a, b) => SP[a].arrive - SP[b].arrive); order.forEach((i, k) => { SP[i].rank = k / N; }); }
const tauOfS = (s) => -Math.log(1 - Math.min(0.9999, s));
const radiusAt = (p, s, back = 0) => { const tt = p.tau0 + Math.max(0, tauOfS(Math.min(s, M.stick)) - back);   // from M.stick on, specks still in the middle stay put (the film is thinner than a speck)
   return tt >= TEDGE ? 1 - 0.008 - 0.04 * p.rank : lookT(tt); };
const hAt = (r, s) => H0 * (1 - Math.min(1, s)) * (1 - r * r);

// ── takes ──
const takeAt = (t) => FILM.takes.find((k) => t >= k.t0 && t < k.t1) || FILM.takes[FILM.takes.length - 1];
const sAt = (t) => keyed(takeAt(t).keys, t, "lin");

// ── the drops, in 3-D: paper, then for each drop a lit coffee lens, specks, the stain growing on the paper ──
// A is our model (round specks carried to the edge); B is an illustration (oval specks stay spread out: our model has no capillary forces).
const YXf = (t) => { const w = FILM.yx; return 1 + Math.min(E.out2(seg(t, w[0], w[0] + 0.5)), 1 - E.in2(seg(t, w[1] - 0.4, w[1]))); };   // 1 normally, 2 in the side view
const prof = []; for (let i = 0; i <= 48; i++) { const r = i / 48; prof.push(new THREE.Vector2(R * r, H0 * (1 - r * r))); }
const lensGeo = new THREE.LatheGeometry(prof, 96);
const paperTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.fillStyle = "#e9e2d0"; g.fillRect(0, 0, 512, 512);
  const r2 = rng(7); for (let i = 0; i < 4200; i++) { const x = r2() * 512, y = r2() * 512, l = 8 + r2() * 30, a = r2() * Math.PI; g.strokeStyle = `rgba(${120 + r2() * 60 | 0},${100 + r2() * 50 | 0},${70 + r2() * 40 | 0},${0.12 + r2() * 0.2})`; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 8); return t; })();
const paper = new THREE.Mesh(new THREE.PlaneGeometry(260, 160), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, metalness: 0 })); paper.rotation.x = -Math.PI / 2; paper.position.y = 0.04; scene.add(paper);   // above the bench floor: coplanar planes flicker (z-fighting)
const speckGeo = new THREE.IcosahedronGeometry(1, 1);
const mtx = new THREE.Matrix4(), qy = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const NT = 220;
const mkDrop = (kind) => {
  const g = new THREE.Group(); scene.add(g);
  const washMat = new THREE.MeshBasicMaterial({ color: 0xb48a5a, transparent: true, opacity: 0, depthWrite: false });
  const wash = new THREE.Mesh(new THREE.CircleGeometry(R * 0.985, 96), washMat); wash.rotation.x = -Math.PI / 2; wash.position.y = 0.07; g.add(wash);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x4a2a12, transparent: true, opacity: 0, depthWrite: false });
  const band = new THREE.Mesh(new THREE.RingGeometry(R * 0.93, R * 1.006, 96), bandMat); band.rotation.x = -Math.PI / 2; band.position.y = 0.09; g.add(band);
  const n = kind === "A" ? N : 900;
  const mk = (cnt, col, scale, std) => { const m = new THREE.InstancedMesh(speckGeo, std ? new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }) : new THREE.MeshBasicMaterial({ color: col }), cnt); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(m); m.userData.scale = scale; return m; };
  const specks = mk(n, new THREE.Color(kind === "A" ? "#2b1708" : "#3a2010"), kind === "A" ? 0.2 : 0.3, true);
  const trails = kind === "A" ? [mk(NT, flat("#6D5338"), 0.2), mk(NT, flat("#8E7556"), 0.16), mk(NT, flat("#AE9B82"), 0.12)] : [];
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x5a3216, transparent: true, opacity: 0.4, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const lens = new THREE.Mesh(lensGeo, lensMat); g.add(lens);                  // after the specks, so the lens sits over them
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2b1708, roughness: 0.5, transparent: true });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.13, 8, 120), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; g.add(rim);
  return { g, kind, washMat, bandMat, specks, trails, lens, lensMat, rim, n };
};
const dA = mkDrop("A"), dB = mkDrop("B");
const place = (set, i, x, y, z, vis, sx = 1, sy = 1, sz = 1, ang = 0) => { const k = vis ? set.userData.scale : 0; s3.set(k * sx, k * sy, k * sz); p3.set(x, y, z); qy.setFromAxisAngle(UP, ang); mtx.compose(p3, qy, s3); set.setMatrixAt(i, mtx); };
const speckPos = (i, s, back = 0, yx = 1) => { const p = SP[i], r = radiusAt(p, s, back), h = hAt(r, s), piled = r > 0.93, y = piled ? 0.24 + 0.5 * p.fr * (0.4 + 0.6 * p.rank) : 0.22 + p.fr * h * yx; return [R * r * Math.cos(p.ph), y, R * r * Math.sin(p.ph)]; };
// oval specks (B): they stay where they started, jiggling a little, and settle flat on the paper
const rb = rng(2011), SB = []; for (let i = 0; i < 900; i++) SB.push({ r0: Math.sqrt(rb()) * 0.97, ph: rb() * Math.PI * 2, fr: 0.1 + 0.8 * rb(), a0: rb() * Math.PI * 2, w: 0.5 + rb() });
// arrows in the cutaway (plane z = 0) on drop A: the flow (blue, outward) and the evaporation (red, up) at the edge
const arMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true }), arMat2 = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true });
const mkArrow = (mat, len, rotZ) => { const g = new THREE.Group(), sh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len - 0.7, 8), mat), hd = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.75, 10), mat);
  sh.position.y = (len - 0.7) / 2; hd.position.y = len - 0.3; g.add(sh, hd); const o = new THREE.Group(); o.add(g); o.rotation.z = rotZ; dA.g.add(o); return o; };
const flowAr = []; for (const x of [2.6, 4.8, 7.0]) for (const sg of [1, -1]) { const a = mkArrow(arMat, 3.1, sg > 0 ? -Math.PI / 2 : Math.PI / 2); a.position.set(sg * x, 0.9, 0); flowAr.push([a, x, sg]); }
const evapAr = []; for (const x of [7.6, 8.7, 9.6]) for (const sg of [1, -1]) { const a = mkArrow(arMat2, 3.1, 0); a.position.set(sg * x, 0, 0); evapAr.push([a, x, sg]); }
// the mug (the tease: a cup filling with water, an illustration)
const mug = new THREE.Group(); scene.add(mug);
{ const cupProf = [[0.01, 0], [4.0, 0], [4.5, 0.5], [4.75, 9], [4.4, 9], [4.2, 1.0], [0.01, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProf, 64), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.35, side: THREE.DoubleSide })); mug.add(cup);
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.5, 12, 28, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.35 })); hnd.rotation.z = -Math.PI / 2; hnd.position.set(4.6, 4.8, 0); mug.add(hnd); }
const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x9cc6e6, transparent: true, opacity: 0.8, roughness: 0.05, clearcoat: 1, depthWrite: false });
const water = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.15, 1, 48), waterMat); mug.add(water);
const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 14), waterMat); mug.add(stream);
const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.rotation.x = Math.PI / 2; mug.add(m); return m; });
mug.visible = false;

// ── camera ──
const lerp = (a, b, u) => a + (b - a) * u;
const camNow = (t) => {
  const st = shotAt(t, FILM.shots), ks = FILM.cam[st.name];
  let i = ks.findIndex((k) => k.t > t); if (i < 0) i = ks.length - 1; if (i < 1) i = 1;
  const a = ks[Math.min(i - 1, ks.length - 1)], b = ks[Math.min(i, ks.length - 1)];
  const u = a === b ? 1 : ease(b.ease || "p2")(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  return { look: [0, 1, 2].map((j) => lerp(a.look[j], b.look[j], u)), dist: lerp(a.dist, b.dist, u), yaw: lerp(a.yaw, b.yaw, u), pitch: lerp(a.pitch, b.pitch, u), fov: lerp(a.fov, b.fov, u) };
};
const placeCam = (t) => {
  const c = camNow(t), y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
  camera.position.set(c.look[0] + c.dist * Math.sin(y) * Math.cos(p), c.look[1] + c.dist * Math.sin(p), c.look[2] + c.dist * Math.cos(y) * Math.cos(p));
  camera.fov = c.fov; camera.updateProjectionMatrix(); camera.lookAt(c.look[0], c.look[1], c.look[2]); camera.updateMatrixWorld();
};
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });

// ── the overlay ──
const inPair = (t) => (t >= FILM.pair.t0 && t < FILM.cue.cuts.measure) || (t >= FILM.cue.cuts.takeaway && t < FILM.pair.tease);
const hud = createHud({ camera, captionY: FILM.captionY, captionAt: (t) => (inPair(t) ? FILM.pair.capY : FILM.captionY), labelsBelowCaption: inPair });   // in the pair shots the caption sits in the gap between the two drops
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const worldOf = (d, x, y, z) => d.g.localToWorld(new THREE.Vector3(x, y, z)).toArray();
const anchorFn = (an) => {
  if (an === "edge") return () => worldOf(dA, R, 0.2, 0);
  if (an === "speck") return (t) => { const p = speckPos(7, sAt(t), 0, YXf(t)); return worldOf(dA, p[0], p[1], p[2]); };
  if (an === "edgeHi") return () => worldOf(dA, R - 0.2, 6.9, 0);
  if (an === "evap") return () => worldOf(dA, R - 1.8, 6.9, 0);
  if (an === "flow") return () => worldOf(dA, 3.0, 5.2, 0);
  if (an === "pairA") return () => worldOf(dA, R * 0.78, 0.3, R * 0.62);
  if (an === "pairB") return () => worldOf(dB, R * 0.78, 0.3, R * 0.62);
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const shareAt = (s) => { let c = 0; for (let i = 0; i < N; i++) if (radiusAt(SP[i], s) >= RINGF) c++; return (100 * c) / N; };
const spineVal = (t) => shareAt(sAt(t));
FILM.spine.forEach((SPN, i) => { const o = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "%", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 2 }, el = hud.counter(i ? "spine" + (i + 1) : "spine", o); placeSpine(o, el, hud, W, H, FILM.spineAt); });
const ES = FILM.endShow, endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

const takeB = (t) => keyed(FILM.takesB, t, "lin");
const pairU = (t) => { const P = FILM.pair, T = FILM.cue.cuts; const inA = t >= P.t0 && t < T.measure, inB = t >= T.takeaway && t < P.tease; return inA || inB ? 1 : 0; };
const L = (a, b, u) => a + (b - a) * u;
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const tease = t >= FILM.pair.tease, yx = YXf(t), s = sAt(t), sB = takeB(t), u0 = pairU(t), u = u0 * u0 * (3 - 2 * u0);
  dA.g.visible = !tease; dB.g.visible = !tease && u > 0.001; mug.visible = tease;
  const uA = (t >= FILM.cue.cuts.takeaway && t < FILM.pair.tease) ? 1 : u;   // in the takeaway the pair is there from the first frame
  dA.g.position.set(0, 0, L(0, -8.0, uA)); dA.g.scale.setScalar(L(1, 0.58, uA));
  dB.g.position.set(0, 0, 8.0); dB.g.scale.setScalar(0.58 * Math.max(0.001, u));
  // ── A ──
  dA.lens.scale.y = Math.max(0.001, (1 - s) * yx); dA.lensMat.opacity = 0.42 * Math.sqrt(Math.max(0, 1 - s)); dA.lens.visible = s < 0.998;
  dA.washMat.opacity = 0.34 * Math.min(1, Math.max(0, (s - 0.55) / 0.4)); dA.bandMat.opacity = 0.92 * Math.min(1, Math.max(0, (s - 0.2) / 0.75));
  for (let i = 0; i < N; i++) { const [x, y, z] = speckPos(i, s, 0, yx); place(dA.specks, i, x, y, z, true); }
  dA.specks.instanceMatrix.needsUpdate = true;
  const tk = win(t, FILM.cue.trail);
  dA.trails.forEach((set, k) => { for (let i = 0; i < NT; i++) { const [x, y, z] = speckPos(i, s, 0.14 * (k + 1), yx); const a = speckPos(i, s, 0, yx), moved = Math.hypot(x - a[0], z - a[2]) > 0.08; place(set, i, x, y, z, tk > 0.05 && moved); } set.instanceMatrix.needsUpdate = true; });
  const ck = Math.max(win(t, FILM.cue.cut), win(t, FILM.pulse) * (0.75 + 0.25 * Math.sin(t * 7)));
  flowAr.forEach(([a, x, sg]) => { a.visible = ck > 0.02; arMat.opacity = ck; a.position.y = (0.4 + 0.55 * hAt(x / R, s)) * yx; });
  evapAr.forEach(([a, x, sg]) => { a.visible = ck > 0.02; arMat2.opacity = ck; a.position.y = hAt(x / R, s) * yx + 0.3; });
  // ── B (illustration) ──
  if (dB.g.visible) {
    const hb = (r) => H0 * (1 - Math.min(1, sB)) * (1 - r * r), jit = 0.16 * (1 - Math.min(1, sB * 0.9));
    dB.lens.scale.y = Math.max(0.001, 1 - sB); dB.lensMat.opacity = 0.42 * Math.sqrt(Math.max(0, 1 - sB)); dB.lens.visible = sB < 0.998;
    dB.washMat.opacity = 0.34 * Math.min(1, Math.max(0, (sB - 0.35) / 0.55)); dB.bandMat.opacity = 0;
    for (let i = 0; i < 900; i++) { const p = SB[i], x = R * p.r0 * Math.cos(p.ph) + jit * Math.sin(5 * t * p.w + i), z = R * p.r0 * Math.sin(p.ph) + jit * Math.cos(4.3 * t * p.w + 1.7 * i);
      place(dB.specks, i, x, 0.14 + p.fr * hb(p.r0) * 0.7, z, true, 1.7, 0.6, 0.6, p.a0 + 0.8 * Math.sin(2.1 * t * p.w + i) * (1 - sB)); }
    dB.specks.instanceMatrix.needsUpdate = true;
  }
  // ── the mug ──
  if (tease) {
    const lv = 0.4 + 7.4 * Math.min(1, Math.max(0, (t - (FILM.pair.tease + 0.3)) / (FILM.dur - 0.5 - FILM.pair.tease - 0.3)));
    water.scale.y = lv; water.position.y = 0.9 + lv / 2;
    const top = 0.9 + lv, sl = 13.5 - top; stream.scale.y = sl; stream.position.set(0.0, top + sl / 2, 0);
    ripples.forEach((m, k) => { const ph = (t * 1.1 + k / 3) % 1; m.position.y = top + 0.03; m.scale.setScalar(0.5 + ph * 3.4); m.material.opacity = 0.7 * (1 - ph); });
  }
  cyc.update({ grid: 1, casters: tease ? [[0, 0, 0, 6]] : [[dA.g.position.x, dA.g.position.z, 0, 13 * dA.g.scale.x]] });
  dA.g.updateMatrixWorld(true); dB.g.updateMatrixWorld(true);
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};
const ck_vis = () => flowAr.some(([a]) => a.visible) || evapAr.some(([a]) => a.visible);
window.OBJ_RECTS = () => {
  const out = [], V = new THREE.Vector3();
  for (const [nm, d] of [["dropA", dA], ["dropB", dB]]) { if (!d.g.visible) continue; let l = 1e9, r = -1e9, tp = 1e9, b = -1e9;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; V.set(R * Math.cos(a), 0.2, R * Math.sin(a)); d.g.localToWorld(V); V.project(camera); const x = (V.x * 0.5 + 0.5) * W, y = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, x); r = Math.max(r, x); tp = Math.min(tp, y); b = Math.max(b, y); }
    out.push({ n: nm, l, r, t: tp, b }); }
  if (ck_vis()) { let l = 1e9, r = -1e9, tp = 1e9, b = -1e9; for (const [a] of [...flowAr, ...evapAr]) { if (!a.visible) continue; for (const [x, y] of [[-0.4, 0], [0.4, 3.1]]) { V.set(a.position.x + x, a.position.y + y, 0); dA.g.localToWorld(V); V.project(camera); const px = (V.x * 0.5 + 0.5) * W, py = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, px); r = Math.max(r, px); tp = Math.min(tp, py); b = Math.max(b, py); } } out.push({ n: "arrows", l, r, t: tp, b, label: true }); }
  if (mug.visible) { let l = 1e9, r = -1e9, tp = 1e9, b = -1e9; for (const [x, y, z] of [[-4.7, 0, 0], [6.9, 0, 0], [-4.7, 9, 0], [6.9, 9, 0]]) { V.set(x, y, z).project(camera); const px = (V.x * 0.5 + 0.5) * W, py = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, px); r = Math.max(r, px); tp = Math.min(tp, py); b = Math.max(b, py); } out.push({ n: "mug", l, r, t: tp, b }); }
  return out;
};
