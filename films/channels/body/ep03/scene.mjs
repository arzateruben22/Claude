// Body Backstage No. 03 (season 1 reboot, live scan), "The jump": the picture, a pure function of t.
//
// One world (µm, internodes compressed; badged "not to scale"): three nerve fibres along x (set/neuron.js):
//   hero  y = 0     myelinated, its cell body at x < 0 and its terminal at x = 660 (the tease's "end of the line")
//                   (the race's thick wrapped racer: its cross-section drawn 1.5× thicker there, FILM.race.thick)
//   bare  y = +24   a thin bare fibre: the signal re-fired step by step, a slow glow (the why; the slow racer)
//   ms    y = −24   a fibre in brain and spinal cord with one damaged sheath: the leaps falter there and stall
// Each leap of the hero's signal is drawn as an arc from gap to gap just over the sheath (a stylisation of
// saltatory conduction: the current flows inside; the action potential is re-fired at the gaps).
// One illustrated slide, the drum (its own place, arbitrary units): Helmholtz's method: a frog muscle on its nerve,
// two stimulating points on the nerve, a lever and a pen on a turning drum; two recordings on the same strip of the
// drum (it turns once between them), the far stimulus's rise later; the drum stops so both face the lens.
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
L.studio(renderer, scene, 0.6);                          // live scan: reflections for the wet clearcoat
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 0.95, bloom: 0.38, maxCoc: 0.024 });
const lin = (h) => L.lin(h);
const G = { fibres: new THREE.Group(), drum: new THREE.Group() };
for (const g of Object.values(G)) scene.add(g);
// the drum rig is drawn mirrored (muscle and lever on the right), so the drum's surface runs right to left past the pen
// and its traces read left to right in time: the far stimulus's later twitch lands to the right (time reads forward)
G.drum.scale.x = -1; G.drum.updateMatrixWorld(true);
const SIG = "#D6F25F";

// ════ the fibres ═════════════════════════════════════════════════════════════════════════════════
const MY = { r: 3.6, internode: 40, node: 2.5 };
const HERO = fibre(THREE, L, { length: 660, axonR: 1.2, myelin: MY });
const BARE = fibre(THREE, L, { length: 600, axonR: 0.8 });
const MSF = fibre(THREE, L, { length: 600, axonR: 1.1, myelin: { r: 3.3, internode: 40, node: 2.5 } });
BARE.group.position.set(0, 24, 0); MSF.group.position.set(0, -24, 0);
G.fibres.add(HERO.group, BARE.group, MSF.group);
const NODES = HERO.nodes, MNODES = MSF.nodes;
// round 2 (review r1 finding 1): keep the fibre's own lamellae sheath (set/neuron.js: spiral bump map, pearly sheen, wet clearcoat); the old satin override flattened it into a smooth pill
// the spark at each gap: additive light (it blooms; the sheath never does), a little wider than the axon's own glow
const sparkBand = () => new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: lin(SIG), emissiveIntensity: 0, roughness: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
for (const F of [HERO, MSF]) F.bands.forEach((b) => { b.material = sparkBand(); b.scale.set(1, 1.2, 1.2); });
const glowSet = (F, o) => { F.set(o); F.bands.forEach((b) => { b.material.emissiveIntensity *= 2.8; b.material.opacity = 1; }); };
// the damaged sheath on the ms fibre: its own dense lathe, eaten away in small patches down to the axon
const BAD = FILM.ms.bad;
const msSheaths = MSF.group.children.filter((m) => m.material === MSF.sheathMat);
{
  const m = msSheaths[BAD], mat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#CDBFA6"), roughness: 0.7 }), { fresnel: 0.2, key: "badsheath" });
  const il = 40, ar = 1.1, R = 3.3, prof = [];
  for (let i = 0; i <= 96; i++) { const x = (i / 96) * il, e = Math.min(1, Math.min(x, il - x) / (il * 0.12)), sn = Math.sin((e * Math.PI) / 2); prof.push(new THREE.Vector2(ar + (R - ar) * Math.pow(sn, 0.7), x)); }
  const g = new THREE.LatheGeometry(prof, 64); g.rotateZ(-Math.PI / 2);
  const p = g.attributes.position, r = rng(3);
  const bumps = Array.from({ length: 24 }, () => [r() * 40, r() * 6.28, 0.35 + 0.45 * r()]);
  for (let i = 0; i < p.count; i++) {   // lathe: x along the fibre, y/z around it
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, y), rr = Math.hypot(y, z);
    let k = 0.92; for (const [bx, ba, d] of bumps) k -= d * Math.exp(-((x - bx) ** 2) / 4 - (Math.atan2(Math.sin(a - ba), Math.cos(a - ba)) ** 2) / 0.12);
    const nr = Math.max(1.15, rr * Math.max(0.3, k));
    p.setXYZ(i, x, (y / Math.max(1e-6, rr)) * nr, (z / Math.max(1e-6, rr)) * nr);
  }
  g.computeVertexNormals(); m.geometry = g; m.material = mat;
}
// the cell body and its dendrites, at the hero's start
const somaMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#C9A9B6"), roughness: 0.55 }), { fresnel: 0.4, fresnelPower: 2.2, key: "soma" });
const SOMA = cutaway({ radius: 12, noise: { amp: 0.22, freq: 2.3, seed: 5 }, segments: [112, 84], material: somaMat });   // review r1 (h): a lumpy living cell body, not a ball
SOMA.group.position.set(-13, 0, 0); SOMA.group.scale.set(1.15, 1, 1); G.fibres.add(SOMA.group);
{
  const r = rng(17);
  // review r1 (h): dendrites wander, taper and branch (no straight cones)
  const branch = (p0, dir, len, r0, depth) => {
    const pts = [p0.slice()], d = dir.slice(); let p = p0.slice();
    for (let i = 1; i <= 9; i++) { d[0] += (r() - 0.5) * 0.5; d[1] += (r() - 0.5) * 0.5; d[2] += (r() - 0.5) * 0.35; const n = Math.hypot(...d); for (let q = 0; q < 3; q++) d[q] /= n;
      p = p.map((x, q) => x + d[q] * len / 9); pts.push(p.slice()); }
    const P = path(pts);
    G.fibres.add(new THREE.Mesh(tube(P, { radius: (sv) => r0 * (1 - 0.8 * sv / P.length) + 0.25, radial: 12, step: 1.5 }), somaMat));
    if (depth > 0) for (const f of [0.4, 0.68]) { const k = Math.round(f * 9), q = pts[k], nd = [d[0] + (r() - 0.5) * 1.6, d[1] + (r() - 0.5) * 1.6, d[2] + (r() - 0.5)]; const n = Math.hypot(...nd);
      branch(q, nd.map((x) => x / n), len * 0.5, r0 * (1 - 0.8 * f) * 0.8, depth - 1); }
  };
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.45 + 1.1 * (k / 6)) + 0.2 * r(), b = (r() - 0.5) * 1.2, len = 34 + 28 * r();
    const dir = [Math.cos(a), Math.sin(a) * Math.cos(b), Math.sin(b)];
    branch([-13 + dir[0] * 10, dir[1] * 10, dir[2] * 8], dir, len, 2.4, 1);
  }
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.5, 8, 24), somaMat); hill.rotation.z = Math.PI / 2; hill.position.set(-1.5, 0, 0); G.fibres.add(hill);
}
// the terminal at the hero's end, the gap, and the next cell's surface beyond it (dark: the signal stops here)
const TX = 660;
const boutonMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#C9A9B6"), roughness: 0.5, emissive: lin(SIG), emissiveIntensity: 0 }), { fresnel: 0.25, key: "bouton" });
// round 2 (review r1 findings 1, 7): the terminal is a bouton swelling out of a tapering stalk, its skin mottled and
// translucent (vesicles glimpsed under it); the next cell is a curved membrane wall studded with receptors, not a ball.
const mott = (w, h, seed, base, dots) => { const r = rng(seed), c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < dots; i++) { const rad = 2 + 7 * r(); x.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.05 + 0.12 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, rad, 0, 6.283); x.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
boutonMat.bumpMap = mott(256, 128, 61, "#808080", 420); boutonMat.bumpScale = 2.2; boutonMat.clearcoat = 0.6; boutonMat.clearcoatRoughness = 0.25; boutonMat.roughness = 0.4; boutonMat.needsUpdate = true;
const BOUTON = new THREE.Group();
{
  const prof = [], N = 40;   // the lathe runs along y: stalk at y 0, swelling to r 6.5, a rounded face at y 16
  for (let i = 0; i <= N; i++) { const u = i / N, y = u * 16; const stalk = 1.3 + 0.2 * (1 - u), bulb = 6.4 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.9))), 0.55); prof.push(new THREE.Vector2(Math.max(stalk, u < 0.1 ? stalk : bulb), y)); }
  const g = new THREE.LatheGeometry(prof, 64); g.rotateZ(-Math.PI / 2); g.translate(-12, 0, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 0.9 + y * 1.7) * Math.cos(z * 1.3 + x * 0.6); p.setXYZ(i, x, y * (1 + 0.04 * n), z * (1 + 0.04 * n)); }
  g.computeVertexNormals(); BOUTON.add(new THREE.Mesh(g, boutonMat));
  // vesicles glimpsed through the skin: small bright spheres just under the surface of the bulb
  const vr = rng(71), vm = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#E6D3DC"), roughness: 0.3, emissive: lin("#E6D3DC"), emissiveIntensity: 0.12 }), { fresnel: 0.3, key: "vesicle" });
  const ves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), vm, 18), m4 = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) { const x = 2 + 7 * vr(), a = vr() * 6.283, rr = 3.6 * vr(), s = 0.55 + 0.6 * vr(); m4.compose(new THREE.Vector3(x, Math.cos(a) * rr, Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); ves.setMatrixAt(i, m4); }
  BOUTON.add(ves);
}
BOUTON.position.set(TX - 2, 0, 0); G.fibres.add(BOUTON);
const postMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#7B6578"), emissive: lin("#3E2F3D"), emissiveIntensity: 0.2, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, bumpMap: mott(256, 256, 73, "#808080", 300), bumpScale: 1.4 }), { fresnel: 0.3, key: "post", dry: true });
const POST = cutaway({ radius: 40, noise: { amp: 0.04, freq: 1.0, seed: 11 }, segments: [64, 48], material: postMat });
POST.group.position.set(TX + 40, 0, -4); POST.group.scale.set(0.25, 1.1, 1); G.fibres.add(POST.group);   // a curved wall facing the bouton across the gap
{ // receptors: small domes on the wall's face
  const rr = rng(83), rm = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#C9A9B6"), roughness: 0.4, emissive: lin("#C9A9B6"), emissiveIntensity: 0.08 }), { fresnel: 0.3, key: "receptor" });
  const rec = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), rm, 70), m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) { const y = (rr() - 0.5) * 42, z = (rr() - 0.5) * 30, x = TX + 40 - 10 * Math.sqrt(Math.max(0.05, 1 - (y / 44) ** 2 - (z / 40) ** 2)) - 0.4, s = 0.9 + 0.9 * rr(); m4.compose(new THREE.Vector3(x, y, z - 4), new THREE.Quaternion(), new THREE.Vector3(s * 0.8, s, s)); rec.setMatrixAt(i, m4); }
  G.fibres.add(rec);
}
// neighbours, for depth
// neighbours, dimmer, for depth (clear of the readout row and of the racers)
const NEIGH = [];
for (const [y, z, a, s] of [[130, -160, 0, 7], [-80, -190, -0.04, 8], [-130, -240, 0.02, 9]]) { const F = fibre(THREE, L, { length: 940, axonR: 0.9, myelin: { r: 2.8, internode: 36, node: 2 }, myelinColor: "#B5AA97", axonColor: "#9C8C96" }); F.group.position.set(-60, y, z); F.group.rotation.z = a; G.fibres.add(F.group); NEIGH.push(F); }

// the leap: an arc of light from one gap to the next, just over the sheath, drawn on as the signal crosses
const arcMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: lin(SIG), emissiveIntensity: 2.6, roughness: 1, fog: false });
const headMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: lin(SIG), emissiveIntensity: 4.0, roughness: 1, fog: false });
const ARCN = 64, ARCR = 10, ARCH = 2.6;
const STEP = MY.internode + MY.node;   // every hop is one internode plus its gap (both fibres share it)
const arcGeo = (() => { const pts = []; for (let i = 0; i <= 32; i++) { const u = i / 32; pts.push(new THREE.Vector3(u * STEP, ARCH * Math.sin(Math.PI * u), 0)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), ARCN, 0.55, ARCR, false); })();
const mkArc = (parent) => { const m = new THREE.Mesh(arcGeo, arcMat), h = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), headMat); m.visible = false; h.visible = false; parent.add(m, h); m.userData.head = h; return m; };
const arcH = mkArc(HERO.group), arcM = mkArc(MSF.group);
// a leap from x = a toward b (b − a may be longer than one STEP: the arc stretches), drawn on to u
const setArc = (m, a, b, u, lift) => {
  const h = m.userData.head;
  if (u <= 0.001 || a == null || b == null) { m.visible = false; h.visible = false; return; }
  const sx = (b - a) / STEP, uu = Math.min(1, u);
  m.visible = true; m.position.set(a, lift, 0); m.scale.set(sx, 1, 1);
  m.geometry.setDrawRange(0, Math.max(1, Math.round(uu * ARCN)) * ARCR * 6);
  h.visible = uu < 0.999; h.position.set(a + uu * STEP * sx, lift + ARCH * Math.sin(Math.PI * uu), 0);
};
// the race's thick wrapped fibre (26 Oct audit): the hero's cross-section, 1 → race.thick during the camera's move into the
// race (race.grow), back to 1 under the dimmed, defocused meanwhile (race.shrink); 1 everywhere else, so frame 0 and the loop match
const raceThick = (t) => { const R = FILM.race; return R.thick ? 1 + (R.thick - 1) * (E.inout2(seg(t, R.grow[0], R.grow[1])) - E.inout2(seg(t, R.shrink[0], R.shrink[1]))) : 1; };
// the hero's signal at t: { k (the last node fired), u (progress of the leap to node k + 1) } or null
const HOP = FILM.hop;
// (hook: a spike train across the framed internode, each leap taking 70% of a hop, then the landing lit; from "cell's",
// a fresh spike runs down from the cell body)
const heroState = (t, sh) => {
  if (sh === "hook" || sh === "loop") {
    const tt = sh === "loop" ? 0 : t;
    if (tt < FILM.hookRun) { const x = (tt - FILM.hookSig.t0) / HOP, f = x - Math.floor(x); return { k: FILM.hookSig.node0, u: Math.min(1, f / 0.7), landed: f >= 0.7 }; }
    const x = (tt - FILM.hookRun) / HOP; return { k: Math.min(NODES.length - 1, Math.floor(x)), u: x - Math.floor(x) };
  }
  if (sh !== "fibres") return null;
  const W1 = FILM.whyJump;
  if (t >= W1.t0 && t < B.why.t1 - 0.4 && t < FILM.ms.t0 + 0.6) { const x = (t - W1.t0) / W1.hop; return { k: W1.k0 + Math.floor(x), u: x - Math.floor(x), fade: 1 - seg(t, FILM.ms.t0, FILM.ms.t0 + 0.6) }; }
  const R = FILM.race;
  if (t >= R.wrap0 && t < B.takeaway.t0) {   // a wrapped pulse leaves the start line every R.every s
    const n = Math.floor((t - R.wrap0) / R.every), front = R.x0 + R.vwrap * (t - R.wrap0 - n * R.every);
    let k = -1; for (let i = 0; i < NODES.length; i++) if (NODES[i] <= front) k = i; const nx = NODES[k + 1];
    return { k, u: k >= 0 && nx != null ? (front - NODES[k]) / (nx - NODES[k]) : 0 };
  }
  const T = FILM.tease, kLast = NODES.length - 1, t0 = T.arrive - 4 * T.hop;   // three gaps, then the leap onto the terminal on "jump"
  if (t >= t0) { const x = (t - t0) / T.hop, j = Math.floor(x); return { k: Math.min(kLast, kLast - 3 + j), u: j <= 3 ? x - j : 1, tease: true, end: seg(t, T.arrive - 0.1, T.arrive + 0.2) }; }
  return null;
};
// round 2 (review r1 finding 4): the race runs from one lit start line, with distance ticks, so a winner is visible
const startMat = new THREE.MeshBasicMaterial({ color: lin(SIG), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const RACEX0 = FILM.race.x0, startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 64), startMat); startLine.position.set(RACEX0 - 2, 8, 0); G.fibres.add(startLine);
const tickGeo = new THREE.PlaneGeometry(0.35, 6), ticks = [];
for (let i = 1; i <= 6; i++) { const m = new THREE.Mesh(tickGeo, startMat); m.position.set(RACEX0 - 2 + i * 30, -12, 0); G.fibres.add(m); ticks.push(m); }
const writeFibres = (t, sh) => {
  // the hero; in the race it is the thick wrapped racer, drawn FILM.race.thick × thicker (its arc's head stays round)
  const th = raceThick(t); HERO.group.scale.set(1, th, th); arcH.userData.head.scale.set(th, 1, 1);
  const st = heroState(t, sh), kLast = NODES.length - 1;
  if (st && st.k >= 0) {
    const k = Math.min(st.k, kLast);
    glowSet(HERO, { front: NODES[k] + (st.landed ? STEP : 0), mode: "jump", tail: 50, glow: st.fade ?? 1 });
    // the tease's last leap lands on the terminal itself (a longer arc)
    const a = NODES[k], b = k < kLast ? NODES[k + 1] : st.tease && t < FILM.tease.arrive ? TX : null;
    setArc(arcH, a, b, b == null ? 0 : st.u * (st.fade ?? 1), MY.r - 0.4);
  } else { glowSet(HERO, { front: -1, mode: "jump" }); setArc(arcH, null, null, 0, 0); }
  boutonMat.emissiveIntensity = st && st.end ? 0.55 * st.end * (1 - 0.3 * seg(t, FILM.tease.arrive + 0.4, FILM.tease.arrive + 1.4)) : 0;
  // the bare fibre: the why's step-by-step re-firing (the head moves in steps), then the race's crawl
  const Bf = FILM.bare, R = FILM.race;
  if (sh === "fibres" && t < B.whoa.t0) BARE.set({ front: t >= Bf.t0 ? Bf.x0 + Bf.step * Math.floor((Bf.v * (t - Bf.t0)) / Bf.step) : -1, mode: "flow", tail: 26 });
  else if (sh === "fibres" && t >= R.bare0 && t < B.takeaway.t0) BARE.set({ front: R.x0 + R.vbare * (t - R.bare0), mode: "flow", tail: 12 });
  else BARE.set({ front: -1, mode: "flow" });
  // the damaged fibre: two leaps to the damaged sheath, falters there, stalls
  const M = FILM.ms;
  if (sh === "fibres" && t >= M.t0 && t < B.whoa.t0) {
    const x = (t - M.t0) / M.hop, k = Math.min(BAD, M.k0 + Math.floor(x)), stall = seg(t, M.stall - 0.2, M.stall + 0.5);
    const falter = k >= BAD ? 0.55 + 0.45 * Math.abs(Math.sin((t - M.t0) * 9)) : 1;
    glowSet(MSF, { front: MNODES[k], mode: "jump", tail: 50, glow: falter * (1 - stall) });
    const u = k < BAD ? x - Math.floor(x) : Math.min(0.42, (x - (BAD - M.k0)) * 0.6) * (1 - stall);
    setArc(arcM, MNODES[k], MNODES[k + 1], u, 3.3 - 0.4);
  } else { glowSet(MSF, { front: -1, mode: "jump" }); setArc(arcM, null, null, 0, 0); }
  startMat.opacity = 0.85 * presence(t, FILM.race.bare0 - 0.4, B.takeaway.t0 - 0.2, { d: 0.4, out: 0.5 }).o * (sh === "fibres" ? 1 : 0);
  // one cell, alone: the bare and ms fibres are not in the hook (the ms one sits out the race and the figure too)
  BARE.group.visible = sh === "fibres";
  MSF.group.visible = sh === "fibres" && !(t >= B.whoa.t0 && t < B.tease.t0);
};

// ════ the drum: Helmholtz's 1850 method (an illustration; arbitrary units) ═════════════════════════
const D = FILM.drum;
const DR = { c: [22, -8, -10], r: 15, h: 26, w: 0.55, pen: -0.3 };   // the pen sits at this angle (toward the camera)
const drum = new THREE.Group(); drum.position.set(...DR.c); G.drum.add(drum);
// a small studio environment so brass and steel read as metal (a dark room, one warm softbox, top right)
const ENV = (() => {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: lin("#123A33"), side: THREE.BackSide })));
  const box = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5.2), side: THREE.DoubleSide }));
  box.position.set(25, 30, 20); box.lookAt(0, 0, 0); es.add(box);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.04); pm.dispose(); return rt.texture;
})();
{
  // round 2 (review r1 finding 1): a period instrument, not primitives. Smoked paper on the drum (soot with fine
  // horizontal scratches), a grained wooden base with a bevelled brass trim, brass rims, spindle and crank.
  const cvs = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); f(x, w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rr = rng(41);
  const sootTex = cvs(512, 256, (x, w, h) => { x.fillStyle = "#3A322C"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const a = 0.04 + 0.12 * rr(); x.fillStyle = rr() < 0.5 ? `rgba(12,9,7,${a})` : `rgba(120,100,84,${a * 0.6})`; x.fillRect(rr() * w, rr() * h, 6 + rr() * 60, 0.6); }
    x.fillStyle = "rgba(190,170,140,0.18)"; x.fillRect(0, h * 0.47, w, 2); });   // the paper's overlap seam
  const sootBump = cvs(512, 256, (x, w, h) => { x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${rr() < 0.5 ? 40 : 220},${rr() < 0.5 ? 40 : 220},${rr() < 0.5 ? 40 : 220},0.35)`; x.fillRect(rr() * w, rr() * h, 4 + rr() * 40, 0.8); } });
  const woodTex = cvs(512, 256, (x, w, h) => { x.fillStyle = "#4A3022"; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const y = rr() * h; x.strokeStyle = `rgba(${rr() < 0.5 ? "28,16,10" : "112,76,50"},${0.12 + 0.2 * rr()})`; x.lineWidth = 0.6 + 1.6 * rr(); x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= w; px += 32) x.lineTo(px, y + 3 * Math.sin(px / 61 + i)); x.stroke(); } });
  const soot = L.patch(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: sootTex, bumpMap: sootBump, bumpScale: 1.2, roughness: 0.62, metalness: 0.05, envMap: ENV, envMapIntensity: 0.4 }), { fresnel: 0.35, key: "drum" });
  sootTex.repeat.set(3, 1);
  const brass = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#B08D57"), roughness: 0.3, metalness: 0.85, envMap: ENV, envMapIntensity: 1.2 }), { fresnel: 0.2, key: "brass" });
  const wood = L.patch(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: woodTex, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3, envMap: ENV, envMapIntensity: 0.5 }), { fresnel: 0.25, key: "wood" });
  drum.add(new THREE.Mesh(new THREE.CylinderGeometry(DR.r, DR.r, DR.h, 128, 1, false), soot));
  for (const sy of [1, -1]) { const rim = new THREE.Mesh(new THREE.CylinderGeometry(DR.r + 0.5, DR.r + 0.5, 1.6, 96), brass); rim.position.y = sy * (DR.h / 2 + 0.2); drum.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1.2, 32), brass); hub.position.y = sy * (DR.h / 2 + 1.2); drum.add(hub); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, DR.h + 20, 24), brass); drum.add(axle);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 12), brass); crank.rotation.z = Math.PI / 2; crank.position.set(4.5, DR.h / 2 + 9, 0); drum.add(crank);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), wood); knob.position.set(9, DR.h / 2 + 9, 0); drum.add(knob);
  const base = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 34, 1, 1, 1), wood); base.position.set(4, -24, -6); G.drum.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(61.4, 0.7, 35.4), brass); trim.position.set(4, -22.3, -6); G.drum.add(trim);   // brass bevel line on the top edge
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(56, 1.6, 30), wood); plinth.position.set(4, -22.0, -6); G.drum.add(plinth);
  for (const [fx, fz] of [[-24, -20], [32, -20], [-24, 8], [32, 8]]) { const ft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 2.2, 20), brass); ft.position.set(fx, -26.5, fz); G.drum.add(ft); }
  // contact shade on the base under the drum and the post
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const cx = cv.getContext("2d"), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(2,8,7,1)"); gr.addColorStop(1, "rgba(2,8,7,0)"); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const shade = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.6, depthWrite: false });
  for (const [x, z, s] of [[DR.c[0], DR.c[2], 40], [-27, -4, 10]]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(s, s), shade); d.rotation.x = -Math.PI / 2; d.position.set(x, -22.45, z); G.drum.add(d); }
}
const twitch = (s) => { const x = (s - 0.22) / 0.78; return x <= 0 ? 0 : Math.pow(x / 0.32, 2) * Math.exp(2 * (1 - x / 0.32)) * 0.5; };   // a latency, a rise, a slow fall
const TRACE_T = 1.3, ROWS = [-3.2, 3.2], SHIFT = [0, 0.16];   // near and far stimulation; the far one (upper row) rises later (drawn about 13× wider than the real ~2 ms: badged "delay exaggerated")
// the drum's turn: steady, plus one extra whirl between the recordings so the second starts on the same strip as the
// first (the far trace sits right over the near one); it stops once the second is written
const WHIRL = [D.traces[0] + TRACE_T + 0.02, D.traces[1] - 0.05], WX = 2 * Math.PI - DR.w * (D.traces[1] - D.traces[0]), DSTOP = D.traces[1] + TRACE_T + 0.1;
const drumAngle = (t) => DR.w * (Math.min(t, DSTOP) - D.spin0) + WX * E.inout2(seg(t, WHIRL[0], WHIRL[1]));
const penAngle = (t) => DR.pen - drumAngle(t);           // the drum-local angle under the pen
const traceMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#EFF6F2"), emissive: lin("#EFF6F2"), emissiveIntensity: 0.55, roughness: 0.5 }), { fresnel: 0, key: "trace" });
const A0 = penAngle(D.traces[0]);
const TRACES = D.traces.map((t0, i) => {
  const N = 160, pts = [];
  for (let j = 0; j <= N; j++) { const s = j / N, a = A0 - DR.w * TRACE_T * s, y = ROWS[i] + 9 * twitch(s - SHIFT[i]); pts.push(new THREE.Vector3(Math.sin(a) * (DR.r + 0.05), y, Math.cos(a) * (DR.r + 0.05))); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.18, 6, false), m = new THREE.Mesh(g, traceMat);
  drum.add(m); return { m, g, t0, N };
});
// the muscle, its clamp, the nerve going up with two stimulating points, the lever to the pen
const striae = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, 64, 256); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${i % 2 ? 30 : 230},${i % 2 ? 30 : 230},${i % 2 ? 30 : 230},0.5)`; x.fillRect(i * 0.7, 0, 0.5 + (i % 3) * 0.4, 256); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); return t; })();   // round 2: muscle fibre striation
const muscleMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#D68A99"), roughness: 0.4, bumpMap: striae, bumpScale: 1.6, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: lin("#FFC0CC") }), { fresnel: 0.35, key: "muscle" });
const MUS = cutaway({ radius: 7, noise: { amp: 0.1, freq: 1.6, seed: 2 }, segments: [56, 40], material: muscleMat });
const MUSC = [-14, 0, 0]; MUS.group.position.set(...MUSC); G.drum.add(MUS.group);
const metal = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#9AA3A0"), roughness: 0.35, metalness: 0.8 }), { fresnel: 0.15, key: "steel" });
{ const c = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 8), metal); c.position.set(-14, 13.5, 0); G.drum.add(c); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 50, 12), metal); post.position.set(-27, -1, -4); G.drum.add(post); const arm = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 1.4), metal); arm.position.set(-20.5, 14.5, -2); G.drum.add(arm); }
const nerveP = path([[-14, 10, 0], [-17, 22, 1], [-21, 34, 1.5], [-23, 46, 1], [-22, 56, 0]]);
const nerveMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin("#E8DCC6"), roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1, emissive: lin(SIG), emissiveIntensity: 0 }), { fresnel: 0.3, key: "frognerve" });
G.drum.add(new THREE.Mesh(tube(nerveP, { radius: 0.6, radial: 14, step: 1 }), nerveMat));
const ELEC = [nerveP.at(nerveP.length * 0.32), nerveP.at(nerveP.length * 0.82)];
const sparkMat = L.patch(new THREE.MeshPhysicalMaterial({ color: lin(SIG), emissive: lin(SIG), emissiveIntensity: 0, roughness: 0.3 }), { fresnel: 0, key: "elec" });
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
  drum.rotation.y = drumAngle(t);
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
const traceAnchor = () => { const a = A0 - DR.w * TRACE_T * 0.63; drum.updateMatrixWorld(true); return drum.localToWorld(new THREE.Vector3(Math.sin(a) * DR.r, ROWS[1] + 5.4, Math.cos(a) * DR.r)).toArray(); };   // just over the far twitch's peak

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 600 3.3vmin/1.35 var(--font-text); color: var(--text); background: var(--hud-plate); padding: 1.4vmin 2.2vmin; border-radius: 1.2vmin; }   /* review r1: plated */
.mi-spine { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
.mi-spine .v { color: var(--nerve); } .mi-spine .lb { color: var(--text); }   /* nerve numbers in the nerve colour: pink is for blood only */
#hud-ms { white-space: pre-line; max-width: none; border-radius: 3vmin; }
#hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-tally .lb { color: var(--text); }
.mi-fig { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }
`; document.head.appendChild(css);
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(200 * S1), height: Math.round(70 * S1), at: 0.3 });   // the title's width: clear of the readout
tPulse.el.style.width = `${Math.round(200 * S1)}px`;   // its own width: .mi-pulse is width 100% of the title box (~840 px), which scaled a narrow line ×2.5–4 into a thick bar below the title
titleEl.appendChild(tPulse.el);
const vW = new THREE.Vector3();
const ANCH = {
  soma: () => [-3, -7.5, 3.5],   // the soma's lower-right flank: the pill sits below the axon, clear of the dendrites
  muscle: () => [-(MUSC[0] + 6), MUSC[1] - 2, 6],   // its flank toward the drum (the rig is mirrored): the pill sits in the gap
  frognerve: () => { const p = nerveP.at(nerveP.length * 0.6); return [-(p[0] + 1), p[1], p[2] + 1]; },   // mirrored rig
  traces: () => traceAnchor(),
  bare: (t) => { const b = FILM.bare, d = Math.max(0, b.v * (t - b.t0)); return [b.x0 + b.step * Math.floor(d / b.step) - 3, 25, 0]; },   // the glow's head, as it steps
  sheath: () => [NODES[3] + 30, MY.r, 1.5],
  node: () => [NODES[FILM.whyJump.k0 + 5], -(MY.r + 0.3), 1.2],   // node 7, where the leap in flight on "gaps" lands: the bottom of its notch (the pill sits below the arcs)
  damaged: () => MSF.group.localToWorld(vW.set(MNODES[BAD] + 8, 1.8, 1.0)).toArray(),
  barefront: (t) => [FILM.race.x0 + Math.max(0, FILM.race.vbare * (t - FILM.race.bare0)), 24, 0],
  wrapfront: (t) => [80, MY.r * raceThick(t), 1],   // the wrapped fibre's top, in frame (its pulses streak past), drawn thicker in the race
  terminal: () => [TX + 4, 6, 2],
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side, fixed: lb.fixed, v: lb.v, lift: lb.lift });
// rule 8: the speed column top left, the standing cheats top right (at most two notes per corner)
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: Math.max(b.t0, FILM.title.t1 + 0.7),   // the title owns its zone while it shows (owner, 3 Nov)
   t1: b.t1, slot: b.slot || "tr" });
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const FIG_Y = 0.215;
const firedAt = (t) => { const W1 = FILM.whyJump; return t < W1.t0 ? 0 : Math.min(NODES.length, 1 + Math.floor((t - W1.t0) / W1.hop)); };
for (const sp of FILM.spine) {
  const fmt = sp.text ? () => sp.text : sp.fmt ? (v) => v.toFixed(sp.fmt) : commas;
  const o = sp.keys ? { keys: sp.keys, ease: "lin" } : { value: sp.count === "fired" ? firedAt : () => sp.value ?? 0 };
  // over the body figure (the stub, the tally) the readout sits higher, so the figure fits between it and the caption
  const el = hud.counter(sp.id, { ...o, fmt, unit: sp.unit, label: sp.label, t0: sp.t0, t1: sp.t1, at: [sp.id === "light" ? 0.55 : 0.5, sp.id === "toe" ? FIG_Y : 0.31], minCh: 1 });   // light's plate right of the frog's nerve
  el.classList.add("mi-spine");
  if (sp.id === "light") el.querySelector(".v").style.fontSize = "6.8vmin";   // nine digits inside the safe box, right of the nerve
}
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: (v) => String(Math.floor(v)), unit: FILM.tally.unit, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.5, FIG_Y], minCh: 2 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const FIN = L.finish(document.querySelector(".stage"));   // live scan: grain and vignette
const SCL = L.scanLine(document.querySelector(".stage"));
scene.add(camera); const MOT = L.motes(camera, { n: 140, size: 6, op: 0.4 });   // live scan: motes in the haze
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 340 * S1, h: 232 * S1, region: [0.42, 0.93], plate: true });   // the toe
const LOC_T = [FILM.spine.find((s) => s.id === "len").t0, SHOT.drum.at - 0.3];

// the body silhouette (takeaway and tally): the figure from motif.js's locator, large; the toe-to-brain route; a heart
const NS = "http://www.w3.org/2000/svg";
const FIGURE = "M50 6 C59 6 64 13 64 22 C64 32 58 40 50 40 C42 40 36 32 36 22 C36 13 41 6 50 6 Z " +
  "M44 42 L56 42 L57 48 C66 49 74 52 77 58 L84 98 L90 128 C91 133 88 135 85 131 L76 102 L70 74 L68 112 L69 150 L67 220 C67 226 58 226 58 220 L54 158 L50 130 L46 158 L42 220 C42 226 33 226 33 220 L31 150 L32 112 L30 74 L24 102 L15 131 C12 135 9 133 10 128 L16 98 L23 58 C26 52 34 49 43 48 Z";
const ROUTE = [[37.5, 222], [37.8, 190], [38.5, 160], [40.5, 130], [46, 114], [49.5, 96], [50, 70], [50, 46], [50, 24]];
const figEl = document.createElement("div"); figEl.className = "mi-fig";
// the figure fits between the readout (bottom ≈ 0.26) and the caption plate (top 0.61)
const FH = 620 * S1, FS = FH / 230, FX = W / 2 - 50 * FS, FY = 530 * S1;
const pl = (cls, stroke, w, extra = "") => `<polyline class="${cls}" points="${ROUTE.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${(w / FS * S1).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" ${extra}/>`;
figEl.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="var(--bg)" opacity="0.5"/>
  <g class="body" transform="translate(${FX.toFixed(1)} ${FY.toFixed(1)}) scale(${FS.toFixed(4)})">
    <defs>
      <linearGradient id="bvol" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F6F68" stop-opacity="0.85"/><stop offset="0.45" stop-color="#0E2E2D" stop-opacity="0.78"/><stop offset="1" stop-color="#1F5650" stop-opacity="0.85"/></linearGradient>
      <radialGradient id="bcore" cx="0.5" cy="0.3" r="0.6"><stop offset="0" stop-color="#8FE3D0" stop-opacity="0.35"/><stop offset="1" stop-color="#8FE3D0" stop-opacity="0"/></radialGradient>
      <clipPath id="bclip"><path d="${FIGURE}"/></clipPath>
      <filter id="bglow" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="${(2.4 / FS * S1).toFixed(2)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="${FIGURE}" fill="url(#bvol)" fill-rule="nonzero"/>
    <g clip-path="url(#bclip)">
      <rect x="0" y="0" width="100" height="230" fill="url(#bcore)"/>
      ${Array.from({ length: 29 }, (_, i) => `<line x1="0" x2="100" y1="${4 + i * 8}" y2="${4 + i * 8}" stroke="#BFEFE3" stroke-opacity="${i % 4 === 0 ? 0.22 : 0.09}" stroke-width="${(0.9 / FS * S1).toFixed(3)}"/>`).join("")}
      <polyline points="50,46 50,70 50,114 50,158 50,226" fill="none" stroke="#BFEFE3" stroke-opacity="0.18" stroke-width="${(3.4 / FS * S1).toFixed(3)}" stroke-dasharray="1.2 2.2"/>
    </g>
    <path d="${FIGURE}" fill="none" stroke="#9FF0DC" stroke-opacity="0.9" stroke-width="${(2.4 / FS * S1).toFixed(3)}" stroke-linejoin="round" filter="url(#bglow)"/>
    ${pl("route", "var(--text-2)", 3, 'stroke-opacity="0.6"')}
    ${pl("slowtrail", "var(--text)", 5)}
    ${pl("fasttrail", "var(--signal)", 6, 'filter="url(#bglow)"')}
    <path class="toe" d="M33 219 L42 219 L42 225 L33 225 Z" fill="var(--signal)" opacity="0"/>
    <path class="brain" d="M41 18 C44 10 56 10 59 18 C60 24 56 28 50 28 C44 28 40 24 41 18 Z" fill="var(--signal)" opacity="0"/>
    <rect class="fast" x="-4" y="-4" width="8" height="8" rx="2" fill="var(--signal)" opacity="0"/>
    <rect class="slow" x="-3.5" y="-3.5" width="7" height="7" rx="1.8" fill="var(--text)" opacity="0"/>
    <polyline class="heart" fill="none" stroke="var(--signal)" stroke-width="${(6 / FS * S1).toFixed(3)}" stroke-linejoin="round" points=""/>
    <rect class="pace" x="-1.8" y="-1.8" width="3.6" height="3.6" rx="0.9" transform="translate(52.5 58)" fill="var(--signal)" opacity="0"/>
  </g></svg>`;
document.getElementById("hud").prepend(figEl);
const figQ = (c) => figEl.querySelector("." + c);
const routeAt = (u) => { const segs = []; let tot = 0; for (let i = 1; i < ROUTE.length; i++) { const d = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); segs.push(d); tot += d; }
  let x = Math.min(1, Math.max(0, u)) * tot; for (let i = 0; i < segs.length; i++) { if (x <= segs[i]) { const f = x / segs[i]; return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f]; } x -= segs[i]; } return ROUTE[ROUTE.length - 1]; };
const writeFig = (t) => {
  const F = FILM.fig, T = FILM.toe, o = presence(t, F.t0, F.t1, { d: 0.5, out: 0.5 }).o;
  figEl.style.opacity = o.toFixed(3);
  if (o <= 0.001) return;
  // the meanwhile: in to the heart (×1.6 about the chest)
  // ×1.6 about the chest, lowered as it grows so the head stays under the tally plate
  const dz = E.inout2(seg(t, F.zoom[0], F.zoom[1])), z = 1 + 0.6 * dz, hx0 = 54, hy0 = 64;
  figQ("body").setAttribute("transform", `translate(${(FX + hx0 * FS * (1 - z)).toFixed(1)} ${(FY + hy0 * FS * (1 - z) + 120 * S1 * dz).toFixed(1)}) scale(${(FS * z).toFixed(4)})`);
  const uf = seg(t, T.stub, T.fast), us = seg(t, T.stub, T.slow);
  const pf = routeAt(uf), ps = routeAt(us);
  // the route draws on from the toe before the stub ("toe … twice"); each signal leaves its trail along it
  figQ("route").setAttribute("stroke-dashoffset", (1 - E.inout2(seg(t, F.route[0], F.route[1]))).toFixed(4));
  figQ("route").setAttribute("opacity", (1 - 0.67 * dz).toFixed(3));   // the takeaway's route steps back for the heart
  figQ("fasttrail").setAttribute("stroke-dashoffset", (1 - uf).toFixed(4)); figQ("fasttrail").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.fast + 0.6, T.fast + 1.2) : 0).toFixed(3));
  figQ("slowtrail").setAttribute("stroke-dashoffset", (1 - us).toFixed(4)); figQ("slowtrail").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.slow + 0.8, T.slow + 1.6) : 0).toFixed(3));
  figQ("fast").setAttribute("transform", `translate(${pf[0].toFixed(2)} ${pf[1].toFixed(2)})`); figQ("fast").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.fast + 0.6, T.fast + 1.2) : 0).toFixed(3));
  figQ("slow").setAttribute("transform", `translate(${ps[0].toFixed(2)} ${ps[1].toFixed(2)})`); figQ("slow").setAttribute("opacity", (t >= T.stub ? 1 - seg(t, T.slow + 0.8, T.slow + 1.6) : 0).toFixed(3));
  // the toe: a glance on "toe", then the stub
  const ant = 0.45 * seg(t, F.route[0] - 0.05, F.route[0] + 0.15) * (1 - seg(t, F.route[0] + 0.5, F.route[0] + 1.0));
  figQ("toe").setAttribute("opacity", Math.max(ant, seg(t, T.stub - 0.05, T.stub) * (1 - seg(t, T.stub + 0.3, T.stub + 1.4))).toFixed(3));
  const br = Math.max(0.9 * seg(t, T.fast - 0.03, T.fast) * (1 - seg(t, T.fast + 0.2, T.fast + 0.9)), 0.75 * seg(t, T.slow - 0.05, T.slow + 0.2) * (1 - seg(t, T.slow + 1.0, T.slow + 2.2)));
  figQ("brain").setAttribute("opacity", br.toFixed(3));
  // the heart: a small pulse-line complex in the chest that kicks on each beat of the tally
  const amp = t >= FILM.tally.t0 - 0.3 ? beatAmp(t, FILM.segBeats) : 0.0, hx = 54, hy = 64, w = 20;
  const pts = [[hx - w, hy], [hx - 4, hy], [hx - 2.5, hy - 1.5 * amp], [hx - 1, hy + 2 * amp], [hx, hy - 15 * amp], [hx + 1.2, hy + 3 * amp], [hx + 2.4, hy], [hx + 4.5, hy - 2 * amp], [hx + 6.5, hy], [hx + w * 0.6, hy]];
  figQ("heart").setAttribute("points", pts.map((p) => p.map((x) => x.toFixed(2)).join(",")).join(" "));
  figQ("heart").setAttribute("opacity", (t >= FILM.tally.t0 - 0.3 ? 1 : 0).toString());
  // the pacemaker: a spark at the top of the heart just before each kick, brightest on "spark"
  let pc = 0; if (t >= FILM.tally.t0 - 0.3) for (const b of FILM.segBeats) pc = Math.max(pc, seg(t, b - 0.09, b - 0.04) * (1 - seg(t, b - 0.02, b + 0.22)));
  const big = 1 + 0.8 * seg(t, F.spark - 0.05, F.spark + 0.1) * (1 - seg(t, F.spark + 0.3, F.spark + 1.0));
  figQ("pace").setAttribute("opacity", Math.min(1, pc * big).toFixed(3)); figQ("pace").setAttribute("transform", `translate(52.5 58) scale(${big.toFixed(3)})`);
};

// ── focus ───────────────────────────────────────────────────────────────────────────────────────
const sparkPt = (t) => { const s = heroState(t, shotOf(t)); return s && s.k >= 0 ? [NODES[Math.min(s.k, NODES.length - 1)] + 20 * Math.min(1, s.u), MY.r, 0] : [109.5, 0, 0]; };
const TARGETS = {
  spark: (t) => sparkPt(t), soma: () => [-13, 0, 0], mid: () => [300, 10, 0], race: () => [60, 12, 0], near: () => [70, 12, 140],
  rig: () => [-4, 6, 0], traces: () => traceAnchor(),
  bare: () => [100, 24, 0], ms: () => [MNODES[BAD] + 10, -24, 0], terminal: () => [TX + 4, 0, 0],
};
window.CINEMA_FOCUS = (t) => focusAt(FILM.foc[shotOf(t)] || FILM.foc.hook, t, { targets: TARGETS });

// ── the probe ───────────────────────────────────────────────────────────────────────────────────
const PR = { fibres: probe(THREE, { W, H, near: 15, ndc: 1.15 }), drum: probe(THREE, { W, H, near: 15, ndc: 1.15 }) };
const STATIC = { fibres: [], drum: [] };
for (let x = -40; x <= 720; x += 15) for (const y of [-24, 0, 24]) STATIC.fibres.push([x, y, 0]);
for (const p of [[14, 0, 0], [22, 50, 0], [-22, -8, 6], [-22, 6, -10], [-4, -24, 10], [27, 20, -4]]) STATIC.drum.push(p);   // mirrored rig
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
  FIN.set(t); MOT.set(t);
  { const S = FILM.scan, on = t >= S.up[0] && t < S.off ? 1 : 0, y = on ? 1 - (1 - S.park) * E.inout2(seg(t, S.up[0], S.up[1])) : 2;   // scan view
    L.SCAN.set(y, on); SCL.set(y, on * (1 - seg(t, S.off - 0.35, S.off - 0.05)), S.tag); }
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    const P = PR[sl]; P.begin(camera);
    STATIC[sl].forEach((p, i) => P.add(`s${i}`, p));
    if (sl === "fibres") { P.add("spark", sparkPt(t)); } else { TRACES.forEach((T, i) => P.add(`pen${i}`, penTip.getWorldPosition(new THREE.Vector3()).toArray())); }
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
