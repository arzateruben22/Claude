// Meanwhile, Inside No. 03, "The jump": the picture, a pure function of t.
//
// One world (µm, internodes compressed; badged "not to scale"): three nerve fibres along x (set/neuron.js):
//   hero  y = 0     myelinated, its cell body at x < 0 and its terminal at x = 660 (the tease's "end of the line")
//   bare  y = +24   a thin bare fibre: the signal re-fired step by step, a slow glow (the why; the slow racer)
//   ms    y = −24   a fibre in brain and spinal cord with one damaged sheath: the leaps falter there and stall
// Each leap of the hero's signal is drawn as an arc from gap to gap just over the sheath (a stylisation of
// saltatory conduction: the current flows inside; the action potential is re-fired at the gaps).
// One illustrated slide, the drum (its own place, arbitrary units): Helmholtz's 1850 method: a frog muscle on its
// nerve, two stimulating points on the nerve, a lever and a pen on a turning drum, two twitch traces a beat apart.
// The takeaway and the tally play over a large body silhouette (HUD SVG) with the toe-to-brain route: the fast and
// the slow signal leave the toe together, in real time (about 0.1 s and 2.1 s).
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { path, tube, instance } from "cinema/sci/path.js";
import { cutaway } from "cinema/sci/cutaway.js";
import { placeCamera, focusAt } from "cinema/keys.js";
import { look } from "../set/look.js";
import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
import { probe } from "../set/probe.js";
import { fibre } from "../set/neuron.js";

const FILM = window.FILM, W = window.W, H = window.H, THEME = window.THEME || { tokens: {} };
const S1 = Math.min(W, H) / 1080;
const SHOTS = FILM.shots;
const shotOf = (t) => shotAt(t, SHOTS).name;
const SLIDE = (sh) => (sh === "hook" || sh === "loop" || sh === "fibres" ? "fibres" : "drum");
const SHOT = Object.fromEntries(SHOTS.map((s, i) => [s.name, { at: s.at, end: SHOTS[i + 1] ? SHOTS[i + 1].at : FILM.dur }]));
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 1, 4000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 2500 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.024 });
const lin = (h) => L.lin(h);
const G = { fibres: new THREE.Group(), drum: new THREE.Group() };
for (const g of Object.values(G)) scene.add(g);
const SIG = "#D6F25F";

// ════ the fibres ═════════════════════════════════════════════════════════════════════════════════
const MY = { r: 3.6, internode: 40, node: 2.5 };
const HERO = fibre(THREE, L, { length: 660, axonR: 1.2, myelin: MY });
const BARE = fibre(THREE, L, { length: 660, axonR: 0.8 });
const MSF = fibre(THREE, L, { length: 660, axonR: 1.1, myelin: { r: 3.3, internode: 40, node: 2.5 } });
BARE.group.position.set(0, 24, 0); MSF.group.position.set(0, -24, 0);
G.fibres.add(HERO.group, BARE.group, MSF.group);
const NODES = HERO.nodes, MNODES = MSF.nodes;
// the damaged sheath on the ms fibre: thinner, patchy, a dull colour
const BAD = FILM.ms.bad;
const msSheaths = MSF.group.children.filter((m) => m.material === MSF.sheathMat);
{
  const m = msSheaths[BAD], mat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#B9A890"), roughness: 0.85 }), { fresnel: 0.2, key: "badsheath" });
  const g = m.geometry.clone(), p = g.attributes.position, r = rng(3);
  const bumps = Array.from({ length: 9 }, () => [r() * 40, r() * 6.28, 0.25 + 0.35 * r()]);
  for (let i = 0; i < p.count; i++) {   // eaten away in patches (lathe: x along the fibre, y/z around it)
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, y), rr = Math.hypot(y, z);
    let k = 0.62; for (const [bx, ba, d] of bumps) k -= d * Math.exp(-((x - bx) ** 2) / 30 - (Math.atan2(Math.sin(a - ba), Math.cos(a - ba)) ** 2) / 0.5);
    const nr = Math.max(1.15, rr * Math.max(0.35, k));
    p.setXYZ(i, x, (y / Math.max(1e-6, rr)) * nr, (z / Math.max(1e-6, rr)) * nr);
  }
  g.computeVertexNormals(); m.geometry = g; m.material = mat;
}
// the cell body and its dendrites, at the hero's start
const somaMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#C9A9B6"), roughness: 0.55 }), { fresnel: 0.4, fresnelPower: 2.2, key: "soma" });
const SOMA = cutaway({ radius: 12, noise: { amp: 0.12, freq: 1.6, seed: 5 }, segments: [64, 48], material: somaMat });
SOMA.group.position.set(-13, 0, 0); SOMA.group.scale.set(1.15, 1, 1); G.fibres.add(SOMA.group);
{
  const r = rng(17);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.45 + 1.1 * (k / 6)) + 0.2 * r(), b = (r() - 0.5) * 1.2, len = 30 + 26 * r();
    const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6, w = 3 * Math.sin(u * 3 + k); pts.push([-13 + Math.cos(a) * (10 + len * u), Math.sin(a) * (10 + len * u) * Math.cos(b) + w, Math.sin(b) * (8 + len * u * 0.6)]); }
    const P = path(pts);
    const g = tube(P, { radius: (s) => 2.2 * (1 - 0.75 * s / P.length) + 0.3, radial: 12, step: 2 });
    G.fibres.add(new THREE.Mesh(g, somaMat));
  }
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.5, 8, 24), somaMat); hill.rotation.z = Math.PI / 2; hill.position.set(-1.5, 0, 0); G.fibres.add(hill);
}
// the terminal at the hero's end, the gap, and the next cell's surface beyond it (dark: the signal stops here)
const TX = 660;
const boutonMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#C9A9B6"), roughness: 0.5, emissive: lin(SIG), emissiveIntensity: 0 }), { fresnel: 0.4, key: "bouton" });
const BOUTON = cutaway({ radius: 6, noise: { amp: 0.1, freq: 1.8, seed: 9 }, segments: [48, 32], material: boutonMat });
BOUTON.group.position.set(TX + 4, 0, 0); BOUTON.group.scale.set(1.1, 1, 1); G.fibres.add(BOUTON.group);
const postMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#A88E9A"), roughness: 0.6 }), { fresnel: 0.35, key: "post" });
const POST = cutaway({ radius: 26, noise: { amp: 0.05, freq: 1.2, seed: 11 }, segments: [64, 48], material: postMat });
POST.group.position.set(TX + 37, 0, -2); POST.group.scale.set(0.95, 1.2, 1); G.fibres.add(POST.group);
// neighbours, for depth
for (const [y, z, a, s] of [[70, -160, 0.05, 7], [-80, -190, -0.04, 8], [20, -240, 0.02, 9]]) { const F = fibre(THREE, L, { length: 760, axonR: 0.9, myelin: { r: 2.8, internode: 36, node: 2 } }); F.group.position.set(-60, y, z); F.group.rotation.z = a; G.fibres.add(F.group); }

// the leap: an arc of light from one gap to the next, just over the sheath, drawn on as the signal crosses
const arcMat = L.patch(new THREE.MeshStandardMaterial({ color: lin(SIG), emissive: lin(SIG), emissiveIntensity: 0.9, roughness: 0.3 }), { fresnel: 0, key: "arc" });
const ARCN = 64, ARCR = 8;
const STEP = MY.internode + MY.node;   // every hop is one internode plus its gap (both fibres share it)
const arcGeo = (() => { const pts = []; for (let i = 0; i <= 32; i++) { const u = i / 32; pts.push(new THREE.Vector3(u * STEP, 4.6 * Math.sin(Math.PI * u), 0)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), ARCN, 0.32, ARCR, false); })();
const mkArc = (parent) => { const m = new THREE.Mesh(arcGeo, arcMat); m.visible = false; parent.add(m); return m; };
const arcH = mkArc(HERO.group), arcM = mkArc(MSF.group);
const setArc = (m, a, b, u, lift) => {
  if (u <= 0.001 || a == null || b == null) { m.visible = false; return; }
  m.visible = true; m.position.set(a, lift, 0);
  m.geometry.setDrawRange(0, Math.max(1, Math.round(Math.min(1, u) * ARCN)) * ARCR * 6);
};
// the hero's signal at t: { k (the last node fired), u (progress of the leap to node k + 1) } or null
const HOP = FILM.hop;
const heroState = (t, sh) => {
  if (sh === "hook" || sh === "loop") { const tt = sh === "loop" ? 0 : t, x = (tt - FILM.hookSig.t0) / HOP; return { k: FILM.hookSig.node0 + Math.floor(x), u: x - Math.floor(x) }; }
  if (sh !== "fibres") return null;
  const W1 = FILM.whyJump;
  if (t >= W1.t0 && t < B.why.t1 - 0.4 && t < FILM.ms.t0 + 0.6) { const x = (t - W1.t0) / W1.hop; return { k: Math.floor(x), u: x - Math.floor(x), fade: 1 - seg(t, FILM.ms.t0, FILM.ms.t0 + 0.6) }; }
  const R = FILM.race;
  if (t >= R.wrap0 && t < B.takeaway.t0) { const front = R.vwrap * (t - R.wrap0); let k = -1; for (let i = 0; i < NODES.length; i++) if (NODES[i] <= front) k = i; const nx = NODES[k + 1]; return { k, u: k >= 0 && nx != null ? (front - NODES[k]) / (nx - NODES[k]) : 0 }; }
  const T = FILM.tease, kLast = NODES.length - 1, t0 = T.arrive - 3 * T.hop;
  if (t >= t0) { const x = (t - t0) / T.hop; const k = Math.min(kLast, kLast - 3 + Math.floor(x)); return { k, u: k < kLast ? x - Math.floor(x) : Math.min(1, (t - T.arrive) / 0.4) * 0, end: seg(t, T.arrive - 0.1, T.arrive + 0.2) }; }
  return null;
};
const writeFibres = (t, sh) => {
  // the hero
  const st = heroState(t, sh);
  if (st && st.k >= 0) {
    const k = Math.min(st.k, NODES.length - 1);
    HERO.set({ front: NODES[k], mode: "jump", tail: 50, glow: st.fade ?? 1 });
    const a = NODES[k], b = NODES[k + 1];
    setArc(arcH, a, b ?? null, b == null ? 0 : st.u * (st.fade ?? 1), MY.r - 0.4);
  } else { HERO.set({ front: -1, mode: "jump" }); arcH.visible = false; }
  boutonMat.emissiveIntensity = st && st.end ? 0.55 * st.end * (1 - 0.5 * seg(t, FILM.tease.arrive + 0.4, FILM.tease.arrive + 1.4)) : 0;
  // the bare fibre: the why's slow glow, then the race's crawl
  if (sh === "fibres" && t < B.whoa.t0) BARE.set({ front: t >= FILM.bare.t0 ? 60 + FILM.bare.v * (t - FILM.bare.t0) : -1, mode: "flow", tail: 26 });
  else if (sh === "fibres" && t >= FILM.race.bare0 && t < B.takeaway.t0) BARE.set({ front: FILM.race.vbare * (t - FILM.race.bare0), mode: "flow", tail: 12 });
  else BARE.set({ front: -1, mode: "flow" });
  // the damaged fibre: leaps to the damaged sheath, falters there, stalls
  const M = FILM.ms;
  if (sh === "fibres" && t >= M.t0 && t < B.whoa.t0) {
    const x = (t - M.t0) / M.hop, k = Math.min(BAD, Math.floor(x)), stall = seg(t, M.stall - 0.2, M.stall + 0.5);
    const falter = k >= BAD ? 0.55 + 0.45 * Math.abs(Math.sin((t - M.t0) * 9)) : 1;
    MSF.set({ front: MNODES[k], mode: "jump", tail: 50, glow: falter * (1 - stall) });
    const u = k < BAD ? x - Math.floor(x) : Math.min(0.42, (x - BAD) * 0.6) * (1 - stall);
    setArc(arcM, MNODES[k], MNODES[k + 1], u, 3.3 - 0.4);
  } else { MSF.set({ front: -1, mode: "jump" }); arcM.visible = false; }
};

// ════ the drum: Helmholtz's 1850 method (an illustration; arbitrary units) ═════════════════════════
const D = FILM.drum;
const DR = { c: [22, -8, -10], r: 15, h: 26, w: 0.55, pen: 0.32 };   // the pen sits at this angle (toward the camera)
const drum = new THREE.Group(); drum.position.set(...DR.c); G.drum.add(drum);
{
  const soot = L.patch(new THREE.MeshStandardMaterial({ color: lin("#2E2A27"), roughness: 0.92, metalness: 0.05 }), { fresnel: 0.25, key: "drum" });
  drum.add(new THREE.Mesh(new THREE.CylinderGeometry(DR.r, DR.r, DR.h, 96, 1, false), soot));
  const brass = L.patch(new THREE.MeshStandardMaterial({ color: lin("#B08D57"), roughness: 0.35, metalness: 0.7 }), { fresnel: 0.2, key: "brass" });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, DR.h + 16, 16), brass); drum.add(axle);
  const base = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 34), brass); base.position.set(4, -24, -6); G.drum.add(base);
}
const twitch = (s) => { const x = (s - 0.22) / 0.78; return x <= 0 ? 0 : Math.pow(x / 0.32, 2) * Math.exp(2 * (1 - x / 0.32)) * 0.5; };   // a latency, a rise, a slow fall
const TRACE_T = 1.3, ROWS = [3.2, -3.2], SHIFT = [0, 0.09];   // two traces: near and far stimulation; the far one's rise comes later
const penAngle = (t) => DR.pen - DR.w * (t - D.spin0);           // the drum-local angle under the pen
const traceMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#EFF6F2"), emissive: lin("#EFF6F2"), emissiveIntensity: 0.55, roughness: 0.5 }), { fresnel: 0, key: "trace" });
const TRACES = D.traces.map((t0, i) => {
  const N = 120, pts = [], a0 = penAngle(t0);
  for (let j = 0; j <= N; j++) { const s = j / N, a = a0 - DR.w * TRACE_T * s, y = ROWS[i] + 9 * twitch(s - SHIFT[i]); pts.push(new THREE.Vector3(Math.sin(a) * (DR.r + 0.15), y, Math.cos(a) * (DR.r + 0.15))); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.34, 6, false), m = new THREE.Mesh(g, traceMat);
  drum.add(m); return { m, g, t0, N };
});
// the muscle, its clamp, the nerve going up with two stimulating points, the lever to the pen
const muscleMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#D68A99"), roughness: 0.55 }), { fresnel: 0.35, key: "muscle" });
const MUS = cutaway({ radius: 7, noise: { amp: 0.1, freq: 1.6, seed: 2 }, segments: [56, 40], material: muscleMat });
const MUSC = [-14, 0, 0]; MUS.group.position.set(...MUSC); G.drum.add(MUS.group);
const metal = L.patch(new THREE.MeshStandardMaterial({ color: lin("#9AA3A0"), roughness: 0.35, metalness: 0.8 }), { fresnel: 0.15, key: "steel" });
{ const c = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 8), metal); c.position.set(-14, 13.5, 0); G.drum.add(c); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 50, 12), metal); post.position.set(-27, -1, -4); G.drum.add(post); const arm = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 1.4), metal); arm.position.set(-20.5, 14.5, -2); G.drum.add(arm); }
const nerveP = path([[-14, 10, 0], [-17, 22, 1], [-21, 34, 1.5], [-23, 46, 1], [-22, 56, 0]]);
const nerveMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#E8DCC6"), roughness: 0.55, emissive: lin(SIG), emissiveIntensity: 0 }), { fresnel: 0.3, key: "frognerve" });
G.drum.add(new THREE.Mesh(tube(nerveP, { radius: 0.9, radial: 12, step: 1 }), nerveMat));
const ELEC = [nerveP.at(nerveP.length * 0.32), nerveP.at(nerveP.length * 0.82)];
const sparkMat = L.patch(new THREE.MeshStandardMaterial({ color: lin(SIG), emissive: lin(SIG), emissiveIntensity: 0, roughness: 0.3 }), { fresnel: 0, key: "elec" });
const ELM = ELEC.map((p, i) => {
  const g = new THREE.Group(); g.position.set(p[0] - 4.5, p[1], p[2]);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 10), metal); wire.rotation.z = Math.PI / 2; g.add(wire);
  const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), sparkMat.clone()); tip.position.x = 4.2; g.add(tip);
  G.drum.add(g); return tip;
});
const lever = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), metal); G.drum.add(lever);
const penTip = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.6, 12), metal); G.drum.add(penTip);
const vL = new THREE.Vector3(), vM = new THREE.Vector3();
const activeTrace = (t) => { let i = -1; for (let k = 0; k < TRACES.length; k++) if (t >= TRACES[k].t0) i = k; return i; };
const writeDrum = (t) => {
  drum.rotation.y = DR.w * (t - D.spin0);
  let y = 0, row = ROWS[0];
  TRACES.forEach((T, i) => {
    const s = Math.min(1, Math.max(0, (t - T.t0) / TRACE_T));
    T.g.setDrawRange(0, Math.round(s * T.N) * 6 * 6); T.m.visible = s > 0.002;
    if (i === activeTrace(t)) { row = ROWS[i]; y = 9 * twitch(s - SHIFT[i]); }
  });
  ELM.forEach((m, i) => { m.material.emissiveIntensity = 2.0 * (1 - seg(t, D.stim[i], D.stim[i] + 0.35)) * seg(t, D.stim[i] - 0.03, D.stim[i]); });
  MUS.group.scale.set(1 + 0.12 * y / 7, 1.55 * (1 - 0.1 * y / 7), 1 + 0.12 * y / 7);
  // the lever: from the muscle's foot to the pen at the drum's face (the pen rises with the twitch)
  const foot = [MUSC[0], MUSC[1] - 10.5 * (1 - 0.1 * y / 7), MUSC[2] + 2];
  const pen = [DR.c[0] + Math.sin(DR.pen) * (DR.r + 0.8), DR.c[1] + row + y, DR.c[2] + Math.cos(DR.pen) * (DR.r + 0.8)];
  vL.set(...pen).sub(vM.set(...foot)); const len = vL.length();
  lever.scale.set(len, 0.9, 0.9); lever.position.set((foot[0] + pen[0]) / 2, (foot[1] + pen[1]) / 2, (foot[2] + pen[2]) / 2);
  lever.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), vL.normalize());
  penTip.position.set(...pen); penTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vM.set(-Math.sin(DR.pen), 0, -Math.cos(DR.pen)));
  nerveMat.emissiveIntensity = 0;
};
const traceAnchor = () => { const i = Math.max(0, activeTrace(1e9)); const T = TRACES[1]; const a = T.t0 != null ? penAngle(T.t0) - DR.w * TRACE_T * 0.45 : 0; return drum.localToWorld(new THREE.Vector3(Math.sin(a) * DR.r, ROWS[1] + 3, Math.cos(a) * DR.r)).toArray(); };

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 500 3vmin/1.35 var(--font-text); color: var(--text-2); }
.mi-spine { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
.mi-spine .v { color: var(--pulse); } .mi-spine .lb { color: var(--text); }
#hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-tally .lb { color: var(--text); }
.mi-fig { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }
`; document.head.appendChild(css);
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const vW = new THREE.Vector3();
const ANCH = {
  soma: () => [-13, 9, 6],
  muscle: () => [MUSC[0] - 4, MUSC[1] - 2, 6],
  frognerve: () => { const p = nerveP.at(nerveP.length * 0.6); return [p[0] + 1, p[1], p[2] + 1]; },
  traces: () => traceAnchor(),
  bare: () => [110, 25, 0],
  sheath: () => [NODES[3] + 20, MY.r, 1.5],
  node: () => [NODES[4], -1.5, 1.2],
  damaged: () => MSF.group.localToWorld(vW.set(MNODES[BAD] + 22, 1.8, 1.0)).toArray(),
  barefront: (t) => [Math.max(4, FILM.race.vbare * (t - FILM.race.bare0)), 24, 0],
  wrapfront: (t) => [Math.min(640, Math.max(4, FILM.race.vwrap * (t - FILM.race.wrap0))), 0, 0],
  terminal: () => [TX + 4, 6, 2],
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side });
// rule 8: the speed column top left, the standing cheats top right (at most two notes per corner)
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot || "tr" });
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const firedAt = (t) => { const W1 = FILM.whyJump; return t < W1.t0 ? 0 : Math.min(NODES.length, 1 + Math.floor((t - W1.t0) / W1.hop)); };
for (const sp of FILM.spine) {
  const fmt = sp.text ? () => sp.text : sp.fmt ? (v) => v.toFixed(sp.fmt) : commas;
  const o = sp.keys ? { keys: sp.keys, ease: "lin" } : { value: sp.count === "fired" ? firedAt : () => sp.value ?? 0 };
  const el = hud.counter(sp.id, { ...o, fmt, unit: sp.unit, label: sp.label, t0: sp.t0, t1: sp.t1, at: [0.5, 0.31], minCh: 1 });
  el.classList.add("mi-spine");
}
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: (v) => String(Math.floor(v)), unit: FILM.tally.unit, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.5, 0.31], minCh: 2 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 430 * S1, h: 232 * S1, region: [0.42, 0.93] });   // the toe
const LOC_T = [FILM.spine.find((s) => s.id === "len").t0, SHOT.drum.at - 0.3];

// the body silhouette (takeaway and tally): the figure from motif.js's locator, large; the toe-to-brain route; a heart
const NS = "http://www.w3.org/2000/svg";
const FIGURE = "M50 6 C59 6 64 13 64 22 C64 32 58 40 50 40 C42 40 36 32 36 22 C36 13 41 6 50 6 Z " +
  "M44 42 L56 42 L57 48 C66 49 74 52 77 58 L84 98 L90 128 C91 133 88 135 85 131 L76 102 L70 74 L68 112 L69 150 L67 220 C67 226 58 226 58 220 L54 158 L50 130 L46 158 L42 220 C42 226 33 226 33 220 L31 150 L32 112 L30 74 L24 102 L15 131 C12 135 9 133 10 128 L16 98 L23 58 C26 52 34 49 43 48 Z";
const ROUTE = [[37.5, 222], [37.8, 190], [38.5, 160], [40.5, 130], [46, 114], [49.5, 96], [50, 70], [50, 46], [50, 24]];
const figEl = document.createElement("div"); figEl.className = "mi-fig";
const FH = 1160 * S1, FS = FH / 230, FX = W / 2 - 50 * FS, FY = 300 * S1;
figEl.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="var(--bg)" opacity="0.72"/>
  <g transform="translate(${FX.toFixed(1)} ${FY.toFixed(1)}) scale(${FS.toFixed(4)})">
    <path d="${FIGURE}" fill="var(--surface)" fill-opacity="0.85" stroke="var(--text-2)" stroke-width="${(2.2 / FS * S1).toFixed(3)}" fill-rule="nonzero"/>
    <polyline points="${ROUTE.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--text-2)" stroke-opacity="0.55" stroke-width="${(3 / FS * S1).toFixed(3)}" stroke-dasharray="${(6 / FS).toFixed(2)} ${(6 / FS).toFixed(2)}"/>
    <path class="toe" d="M33 219 L42 219 L42 225 L33 225 Z" fill="var(--pulse)" opacity="0"/>
    <path class="brain" d="M41 18 C44 10 56 10 59 18 C60 24 56 28 50 28 C44 28 40 24 41 18 Z" fill="var(--signal)" opacity="0"/>
    <rect class="fast" x="-2.4" y="-2.4" width="4.8" height="4.8" rx="1.2" fill="var(--signal)" opacity="0"/>
    <rect class="slow" x="-2.1" y="-2.1" width="4.2" height="4.2" rx="1.0" fill="var(--text)" opacity="0"/>
    <polyline class="heart" fill="none" stroke="var(--pulse)" stroke-width="${(6 / FS * S1).toFixed(3)}" stroke-linejoin="round" points=""/>
  </g></svg>`;
document.getElementById("hud").prepend(figEl);
const figQ = (c) => figEl.querySelector("." + c);
const routeAt = (u) => { const segs = []; let tot = 0; for (let i = 1; i < ROUTE.length; i++) { const d = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); segs.push(d); tot += d; }
  let x = Math.min(1, Math.max(0, u)) * tot; for (let i = 0; i < segs.length; i++) { if (x <= segs[i]) { const f = x / segs[i]; return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f]; } x -= segs[i]; } return ROUTE[ROUTE.length - 1]; };
const writeFig = (t) => {
  const F = FILM.fig, T = FILM.toe, o = presence(t, F.t0, F.t1, { d: 0.5, out: 0.5 }).o;
  figEl.style.opacity = o.toFixed(3);
  if (o <= 0.001) return;
  const uf = seg(t, T.stub, T.fast), us = seg(t, T.stub, T.slow);
  const pf = routeAt(uf), ps = routeAt(us);
  figQ("fast").setAttribute("transform", `translate(${pf[0].toFixed(2)} ${pf[1].toFixed(2)})`); figQ("fast").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.fast + 0.6, T.fast + 1.2) : 0).toFixed(3));
  figQ("slow").setAttribute("transform", `translate(${ps[0].toFixed(2)} ${ps[1].toFixed(2)})`); figQ("slow").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.slow + 0.8, T.slow + 1.6) : 0).toFixed(3));
  figQ("toe").setAttribute("opacity", (seg(t, T.stub - 0.05, T.stub) * (1 - seg(t, T.stub + 0.3, T.stub + 1.4))).toFixed(3));
  const br = Math.max(0.9 * seg(t, T.fast - 0.03, T.fast) * (1 - seg(t, T.fast + 0.2, T.fast + 0.9)), 0.75 * seg(t, T.slow - 0.05, T.slow + 0.2) * (1 - seg(t, T.slow + 1.0, T.slow + 2.2)));
  figQ("brain").setAttribute("opacity", br.toFixed(3));
  // the heart: a small pulse-line complex in the chest that kicks on each beat of the tally
  const amp = t >= FILM.tally.t0 - 0.3 ? beatAmp(t, FILM.segBeats) : 0.0, hx = 54, hy = 64, w = 20;
  const pts = [[hx - w, hy], [hx - 4, hy], [hx - 2.5, hy - 1.5 * amp], [hx - 1, hy + 2 * amp], [hx, hy - 15 * amp], [hx + 1.2, hy + 3 * amp], [hx + 2.4, hy], [hx + 4.5, hy - 2 * amp], [hx + 6.5, hy], [hx + w * 0.6, hy]];
  figQ("heart").setAttribute("points", pts.map((p) => p.map((x) => x.toFixed(2)).join(",")).join(" "));
  figQ("heart").setAttribute("opacity", (t >= FILM.tally.t0 - 0.3 ? 1 : 0).toString());
};

// ── focus ───────────────────────────────────────────────────────────────────────────────────────
const sparkPt = (t) => { const s = heroState(t, shotOf(t)); return s && s.k >= 0 ? [NODES[Math.min(s.k, NODES.length - 1)] + 20 * Math.min(1, s.u), MY.r, 0] : [322, 0, 0]; };
const TARGETS = {
  spark: (t) => sparkPt(t), soma: () => [-13, 0, 0], mid: () => [300, 10, 0],
  rig: () => [4, 6, 0], traces: () => traceAnchor(),
  bare: () => [100, 24, 0], ms: () => [MNODES[BAD] + 10, -24, 0], terminal: () => [TX + 4, 0, 0],
};
window.CINEMA_FOCUS = (t) => focusAt(FILM.foc[shotOf(t)] || FILM.foc.hook, t, { targets: TARGETS });

// ── the probe ───────────────────────────────────────────────────────────────────────────────────
const PR = { fibres: probe(THREE, { W, H, near: 15, ndc: 1.15 }), drum: probe(THREE, { W, H, near: 15, ndc: 1.15 }) };
const STATIC = { fibres: [], drum: [] };
for (let x = -40; x <= 720; x += 15) for (const y of [-24, 0, 24]) STATIC.fibres.push([x, y, 0]);
for (const p of [[-14, 0, 0], [-22, 50, 0], [22, -8, 6], [22, 6, -10], [4, -24, 10], [-27, 20, -4]]) STATIC.drum.push(p);
let TIER_KMAX = null;

// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const shot = shotOf(t), sl = SLIDE(shot), C = window.CINEMA;
  for (const [k, g] of Object.entries(G)) g.visible = k === sl;
  placeCamera(camera, FILM.cam[shot], t, { handheld: 0 });
  camera.near = 1; camera.far = 4000; camera.updateProjectionMatrix();
  if (sl === "fibres") writeFibres(t, shot); else writeDrum(t);
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  scene.fog.density = 0.25 / Math.max(10, fd);
  hud.update(t);
  writeFig(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  LOC.update(t, shot === "hook" ? presence(t, LOC_T[0], LOC_T[1], { d: 0.45, out: 0.35 }).o : 0, 0.5);
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    const P = PR[sl]; P.begin(camera);
    STATIC[sl].forEach((p, i) => P.add(`s${i}`, p));
    if (sl === "fibres") { P.add("spark", sparkPt(t)); } else { TRACES.forEach((T, i) => P.add(`pen${i}`, penTip.position.toArray())); }
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
