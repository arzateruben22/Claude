// Meanwhile, Inside No. 04, "The gap": the picture, a pure function of t.
//
// One world (arbitrary units; the junction hugely enlarged, badged "not to scale"):
//   the hero junction at the origin: an axon (set/neuron.js, bare) ending in a terminal (cutaway.js, cut open toward
//   the lens: its vesicles inside), the gap, and the next cell (a large cell body) with receptors facing the gap;
//   around them a small network of nerve cells, joined by branches that end in small terminals on their targets.
// A handoff, as one schedule: the signal glows down the axon and stops at the terminal; calcium enters; the docked
// vesicles fuse and spill; messengers drift across; the receptors light and the next cell glows. It plays once in the
// why (on the words), once slowed in the whoa (the 0.001 s readout), and on each breath of the tally.
// The change is two illustrated panels in the overlay (seeded drawings: one web, separate cells).
// The tease is an air sac in the dark (far away at x = 3000, behind its own iris).
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence } from "cinema/film/runtime.js";
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
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 1, 6000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 4500 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.03 });
const lin = (h) => L.lin(h);
const SIG = "#D6F25F";
const world = new THREE.Group(), sacG = new THREE.Group(); scene.add(world, sacG);

// ════ the hero junction ══════════════════════════════════════════════════════════════════════════
const cellMat = (hex, key, emi = 0) => L.patch(new THREE.MeshStandardMaterial({ color: lin(hex), roughness: 0.55, emissive: lin(SIG), emissiveIntensity: emi }), { fresnel: 0.38, fresnelPower: 2.2, key });
const AX = fibre(THREE, L, { length: 230, axonR: 2.0 });
AX.group.position.set(-237, 0, 0); world.add(AX.group);
const tipMat = cellMat("#C9A9B6", "tip");
const capMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#8E7480"), roughness: 0.7, side: THREE.DoubleSide }), { fresnel: 0.05, key: "tipcap" });
{
  const prev = capMat.onBeforeCompile, mem = lin("#E7D3DA");
  capMat.onBeforeCompile = (sh, r) => {
    prev(sh, r); sh.uniforms.uMem = { value: mem };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float capEdge; varying float vEdge;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvEdge = capEdge;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uMem; varying float vEdge;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uMem, smoothstep(0.93, 0.975, vEdge));");
  };
}
const TIP = cutaway({ radius: 9, noise: { amp: 0.06, freq: 1.5, seed: 4 }, segments: [80, 60], capSegments: 160, material: tipMat, capMaterial: capMat });
world.add(TIP.group); TIP.set({ cut: { n: [0, 0, 1], d: 0 } }); world.updateMatrixWorld(true); TIP.update();
const hill = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 5.5, 6, 24), tipMat); hill.rotation.z = Math.PI / 2; hill.position.set(-8.5, 0, 0); world.add(hill);
const postMat = cellMat("#A88E9A", "post");
const POST = cutaway({ radius: 38, noise: { amp: 0.035, freq: 1.2, seed: 11 }, segments: [96, 72], material: postMat });
POST.group.position.set(50.5, 0, 0); world.add(POST.group);
const GAPX = [9.1, 50.5 - POST.r([-1, 0, 0])];         // the gap: the terminal's face and the next cell's face
// the vesicles inside the cut terminal (in the cut's plane); the eight docked ones sit at the face by the gap
const VN = 42, DOCK = 8;
const vesMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#CFE8C6"), emissive: lin("#A8D89A"), emissiveIntensity: 0.18, roughness: 0.35 }), { fresnel: 0.3, key: "ves" });
const VH = [];
{
  const r = rng(21);
  for (let i = 0; i < DOCK; i++) { const y = -5.6 + (11.2 * i) / (DOCK - 1); VH.push([Math.sqrt(Math.max(0, 7.6 * 7.6 - y * y)) - 0.4, y, 0.6]); }
  for (let tries = 0; VH.length < VN && tries < 5000; tries++) { const x = (r() * 2 - 1) * 7, y = (r() * 2 - 1) * 7; if (x * x + y * y > 6.6 * 6.6 || x > 4.8) continue; if (VH.some((p) => Math.hypot(p[0] - x, p[1] - y) < 2.05)) continue; VH.push([x, y, 0.6 + 0.4 * r()]); }
}
const NV = VH.length;   // as many as fit (the rejection loop stops early on a crowded section)
const ves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), vesMat, NV); ves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ves.frustumCulled = false; world.add(ves);
// calcium, outside the terminal's face, moving in; messengers, from the docked vesicles across the gap
const CAN = 26, MSN = 96;
const caMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#E8D7B0"), emissive: lin("#E8D7B0"), emissiveIntensity: 0.35, roughness: 0.4 }), { fresnel: 0, key: "ca" });
const msMat = L.patch(new THREE.MeshStandardMaterial({ color: lin(SIG), emissive: lin(SIG), emissiveIntensity: 0.6, roughness: 0.4 }), { fresnel: 0, key: "msg" });
const caM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 1), caMat, CAN); caM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); caM.frustumCulled = false; world.add(caM);
const msM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 1), msMat, MSN); msM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); msM.frustumCulled = false; world.add(msM);
const CAH = Array.from({ length: CAN }, (_, i) => { const a = (hash(i + 40) - 0.5) * 2.2, rr = 12 + 4 * hash(i + 41); return { from: [Math.cos(a) * rr, Math.sin(a) * rr, 0.5 + 3 * hash(i + 42)], to: [Math.cos(a) * 6.8, Math.sin(a) * 6.8, 0.8] }; });
// receptors on the next cell's face
const RN = 14, recMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#B8C2A0"), emissive: lin(SIG), emissiveIntensity: 0, roughness: 0.4 }), { fresnel: 0.2, key: "rec" });
const rec = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 10), recMat, RN); world.add(rec);
const RH = [];
for (let i = 0; i < RN; i++) { const y = -6.4 + (12.8 * i) / (RN - 1), z = 0.4 + 2.6 * hash(i + 60); const x = 50.5 - POST.r([-1, y / 40, z / 40].map((v, k, a) => v / Math.hypot(...a))) * 1.0 - 0.3; RH.push([x, y, z]); instance(rec, i, [x, y, z], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)), 1); }

// ── the handoffs: the why (on the words), the whoa replay (scaled), one per breath (scaled) ───────────
const R0 = FILM.rel;
const MAIN = { sig: R0.sig, ca: R0.ca, sp: R0.spill, dr: R0.drift, post: R0.post };
const scaled = (t0, d) => { const P = MAIN, a = P.sig[0], z = P.post + 0.4, k = d / (z - a), m = (x) => t0 + (x - a) * k; return { sig: P.sig.map(m), ca: P.ca.map(m), sp: P.sp.map(m), dr: P.dr.map(m), post: m(P.post) }; };
const SCHED = [MAIN, scaled(FILM.replay[0], FILM.replay[1] - FILM.replay[0]), ...FILM.breaths.map((b) => scaled(b - 0.4, 1.8))];
const schedAt = (t) => { let s = null; for (const S of SCHED) if (t >= S.sig[0] - 0.3) s = S; return s; };
const sinceUse = (t) => { let best = Infinity; for (const b of FILM.use.beats) if (t >= b) best = t - b; return best; };
const writeJunction = (t) => {
  const S = schedAt(t);
  const sigU = S ? seg(t, S.sig[0], S.sig[1]) : 0, held = S ? (t >= S.sig[1] ? 1 - seg(t, S.post, S.post + 0.8) : 0) : 0;
  AX.set({ front: S && t >= S.sig[0] && t < S.post + 0.8 ? 230 * E.in2(sigU) : -1, mode: "flow", tail: 60, glow: 1 });
  tipMat.emissiveIntensity = 0.25 * held;
  // calcium
  const caU = S ? E.inout2(seg(t, S.ca[0], S.ca[1])) : 0, caOn = S ? seg(t, S.ca[0] - 0.25, S.ca[0]) * (1 - seg(t, S.sp[1] + 0.2, S.sp[1] + 0.7)) : 0;
  for (let i = 0; i < CAN; i++) { const h = CAH[i], u = Math.min(1, Math.max(0, caU * 1.2 - hash(i + 43) * 0.2)); instance(caM, i, h.from.map((x, k) => x + (h.to[k] - x) * u), null, caOn); }
  caM.instanceMatrix.needsUpdate = true;
  // vesicles: the docked ones move to the face and fuse (shrink into it); they re-form before the next handoff
  for (let i = 0; i < NV; i++) {
    let p = VH[i], sc = 1;
    if (i < DOCK && S) {
      const d0 = S.sp[0] + (S.sp[1] - S.sp[0]) * hash(i + 70) * 0.6, u = E.in2(seg(t, d0, d0 + (S.sp[1] - S.sp[0]) * 0.5));
      const fx = Math.sqrt(Math.max(0, 8.9 * 8.9 - p[1] * p[1]));
      p = [p[0] + (fx - p[0]) * u, p[1], p[2]]; sc = 1 - E.in3(seg(u, 0.55, 1));
      const nxt = SCHED[SCHED.indexOf(S) + 1]; if (t > S.post + 0.6) sc = nxt ? seg(t, nxt.sig[0] - 1.0, nxt.sig[0] - 0.3) : seg(t, S.post + 1.2, S.post + 2.2);
    }
    instance(ves, i, p, null, sc);
  }
  ves.instanceMatrix.needsUpdate = true;
  // messengers: born at the docked vesicles' fusion points, drifting across to the receptors
  for (let i = 0; i < MSN; i++) {
    let p = [0, 0, 0], sc = 0;
    if (S && t >= S.sp[0]) {
      const v = i % DOCK, born = S.sp[0] + (S.sp[1] - S.sp[0]) * (hash(v + 70) * 0.6 + 0.3), r = RH[(i * 7) % RN];
      const from = [8.8, VH[v][1], VH[v][2] + 0.3 * (hash(i + 80) - 0.5)], to = [r[0] - 0.5, r[1] + 0.6 * (hash(i + 81) - 0.5), r[2] + 0.6 * (hash(i + 82) - 0.5)];
      const u = E.out2(seg(t, Math.max(born, S.dr[0] + (hash(i + 83) - 0.5) * 0.3), S.dr[1] + (hash(i + 84) - 0.2) * 0.3));
      const wob = 0.6 * Math.sin(t * 7 + i) * (1 - u);
      p = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u + wob, from[2] + (to[2] - from[2]) * u + 0.5 * Math.cos(t * 5 + i) * (1 - u)];
      sc = seg(t, born, born + 0.15) * (1 - seg(t, S.post + 0.3, S.post + 1.1));
    }
    instance(msM, i, p, null, sc);
  }
  msM.instanceMatrix.needsUpdate = true;
  const lit = S ? seg(t, S.post - 0.25, S.post) * (1 - seg(t, S.post + 0.6, S.post + 1.6)) : 0;
  recMat.emissiveIntensity = 0.9 * lit; postMat.emissiveIntensity = 0.22 * lit;
  // the junction used again and again (whoa): it pulses and grows
  const su = sinceUse(t), pulse = su < 0.5 ? 1 - su / 0.5 : 0, grow = E.inout2(seg(t, FILM.use.grow[0], FILM.use.grow[1]));
  USED.mat.emissiveIntensity = 0.15 + 0.7 * pulse + 0.25 * grow; USED.bouton.scale.setScalar(1 + 0.6 * grow);
};

// ════ the network around it ══════════════════════════════════════════════════════════════════════
const netMat = cellMat("#B79AA8", "net"), SOMAS = [];
{
  const r = rng(77);
  const add = (c, rad) => { const C = cutaway({ radius: rad, noise: { amp: 0.12, freq: 1.6, seed: 30 + SOMAS.length }, segments: [40, 30], material: netMat }); C.group.position.set(...c); world.add(C.group); SOMAS.push({ c, rad }); };
  add([-262, 40, -10], 26);                                    // the hero's own cell body (the axon leaves it)
  for (let tries = 0; SOMAS.length < 15 && tries < 2000; tries++) {
    const c = [(r() - 0.5) * 1300, (r() - 0.5) * 1500 + 40, -40 - 260 * r()];
    if (Math.hypot(c[0], c[1]) < 140) continue;
    if (SOMAS.some((s) => Math.hypot(s.c[0] - c[0], s.c[1] - c[1], s.c[2] - c[2]) < 220)) continue;
    add(c, 18 + 12 * r());
  }
}
SOMAS.push({ c: [50.5, 0, 0], rad: 38, post: true });
// the hero's axon leaves its cell body: a short curve from the body to the axon's start
{ const P = path([[-240, 34, -8], [-246, 12, -4], [-238, 0, 0]]); world.add(new THREE.Mesh(tube(P, { radius: 2.0, radial: 12, step: 2 }), netMat)); }
const EDGES = [], boutonGeo = new THREE.IcosahedronGeometry(1, 2);
let USED = null;
{
  const r = rng(91);
  SOMAS.forEach((a, i) => {
    const near = SOMAS.map((b, j) => [j, Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2])]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3);
    for (const [j] of near.slice(0, 2 + (r() < 0.5 ? 1 : 0))) {
      const b = SOMAS[j], d = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]], l = Math.hypot(...d), u = d.map((x) => x / l);
      // keep the hero junction clear: no branch into the hero's next cell, none passing near the origin
      if (b.post || a.post) continue;
      { const tt = Math.max(0, Math.min(1, -(a.c[0] * d[0] + a.c[1] * d[1] + a.c[2] * d[2]) / (l * l))), q = a.c.map((x, k) => x + d[k] * tt); if (Math.hypot(...q) < 90) continue; }
      const s = a.c.map((x, k) => x + u[k] * a.rad * 0.95), e = b.c.map((x, k) => x - u[k] * (b.rad + 4.5));
      const m = s.map((x, k) => (x + e[k]) / 2 + (r() - 0.5) * l * 0.25);
      const P = path([s, m, e]); const g = tube(P, { radius: (q) => 2.4 - 1.3 * (q / P.length), radial: 10, step: 6 });
      world.add(new THREE.Mesh(g, netMat));
      const mat = cellMat("#C9A9B6", "bout" + EDGES.length, 0.15), bouton = new THREE.Mesh(boutonGeo, mat);
      bouton.position.set(...e); bouton.scale.setScalar(4.2); world.add(bouton);
      EDGES.push({ e, mat, bouton, i, j });
    }
  });
  // the junction "used often": the edge whose terminal sits nearest a chosen spot right of the hero, in the pulled-back view
  let best = EDGES[0], bd = Infinity;
  for (const E2 of EDGES) { const d = Math.hypot(E2.e[0] - 260, E2.e[1] - 220); if (d < bd && E2.e[2] > -200) { bd = d; best = E2; } }
  USED = best; const mesh = best.bouton, g = new THREE.Group();
  world.remove(mesh); g.position.set(...best.e); mesh.position.set(0, 0, 0); g.add(mesh); world.add(g); USED.bouton = g;
}

// ════ the air sac (the tease) ════════════════════════════════════════════════════════════════════
const sacMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#D9A9A3"), emissive: lin("#F0C9B8"), emissiveIntensity: 0.08, roughness: 0.75 }), { fresnel: 0.5, key: "sac" });
const SAC = cutaway({ radius: 50, noise: { amp: 0.06, freq: 1.4, seed: 8 }, segments: [80, 60], material: sacMat });
SAC.group.position.set(3000, 0, 0); sacG.add(SAC.group);
const SAC2 = [[3070, 60, -60, 36], [2930, -70, -50, 40], [3050, -90, -90, 30], [2950, 80, -80, 34]].map(([x, y, z, r], k) => { const C = cutaway({ radius: r, noise: { amp: 0.07, freq: 1.4, seed: 12 + k }, segments: [48, 36], material: sacMat }); C.group.position.set(x, y, z); sacG.add(C.group); return C; });

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 500 3vmin/1.35 var(--font-text); color: var(--text-2); }
.mi-spine { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
.mi-spine .v { color: var(--pulse); } .mi-spine .lb { color: var(--text); }
#hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-tally .lb { color: var(--text); }
.mi-panels { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }
.mi-panels .cap { font: 650 30px/1.2 var(--font-text); fill: var(--text); }
.mi-panels .who { font: 600 58px/1 var(--font-display); fill: var(--text); }
`; document.head.appendChild(css);
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const vW = new THREE.Vector3();
const ANCH = {
  gap: () => [(GAPX[0] + GAPX[1]) / 2, 7.5, 2],
  tip: () => [-2, 8.6, 1],
  ca: () => CAH[3].to.map((x, k) => x + (CAH[3].from[k] - x) * 0.5),
  ves: () => VH[DOCK + 3],
  rec: () => RH[3],
  used: () => USED.e,
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: "tl" });
for (const sp of FILM.spine) {
  const fmt = sp.text ? () => sp.text : (v) => v.toFixed(sp.fmt ?? 0);
  const o = sp.keys ? { keys: sp.keys, ease: "lin" } : { value: () => 0 };
  hud.counter(sp.id, { ...o, fmt, unit: sp.unit, label: sp.label, t0: sp.t0, t1: sp.t1, at: [0.5, 0.31], minCh: 1 }).classList.add("mi-spine");
}
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: (v) => String(Math.floor(v)), unit: FILM.tally.unit, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.5, 0.31], minCh: 2 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 430 * S1, h: 232 * S1, region: FILM.loc.region });

// the two readings of one stained tissue: the same seeded drawing; Golgi's joins every branch into the next cell,
// Cajal's stops each branch short of it (a gap)
const NS = "http://www.w3.org/2000/svg";
const drawing = (gapped) => {
  const r = rng(5), cells = [[90, 120], [250, 90], [170, 250], [60, 330], [280, 300], [190, 420]], out = [];
  cells.forEach(([x, y], i) => {
    out.push(`<path d="M${x - 13} ${y} C${x - 13} ${y - 15} ${x + 13} ${y - 15} ${x + 13} ${y} C${x + 13} ${y + 13} ${x - 13} ${y + 13} ${x - 13} ${y} Z" fill="var(--bone)"/>`);
    for (let k = 0; k < 3; k++) { const a = r() * 6.28, l = 26 + 30 * r(); out.push(`<path d="M${x} ${y} q ${(Math.cos(a) * l * 0.5 + (r() - 0.5) * 12).toFixed(1)} ${(Math.sin(a) * l * 0.5 + (r() - 0.5) * 12).toFixed(1)} ${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}" stroke="var(--bone)" stroke-width="3" fill="none" stroke-linecap="round"/>`); }
  });
  [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [4, 5], [3, 5], [1, 4]].forEach(([a, b]) => {
    const [x0, y0] = cells[a], [x1, y1] = cells[b], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    const stop = gapped ? 24 : 12, mx = (x0 + x1) / 2 + uy * 18, my = (y0 + y1) / 2 - ux * 18;
    out.push(`<path d="M${(x0 + ux * 12).toFixed(1)} ${(y0 + uy * 12).toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${(x1 - ux * stop).toFixed(1)} ${(y1 - uy * stop).toFixed(1)}" stroke="var(--bone)" stroke-width="3.4" fill="none" stroke-linecap="round"/>`);
    if (gapped) out.push(`<path d="M${(x1 - ux * stop + uy * 5).toFixed(1)} ${(y1 - uy * stop - ux * 5).toFixed(1)} L${(x1 - ux * stop - uy * 5).toFixed(1)} ${(y1 - uy * stop + ux * 5).toFixed(1)}" stroke="var(--bone)" stroke-width="5" stroke-linecap="round"/>`);
  });
  return out.join("");
};
const panels = document.createElement("div"); panels.className = "mi-panels";
const PW = 340, PH = 470, PS = (W * 0.405) / PW, PY = H * 0.21;
panels.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
  <rect width="${W}" height="${H}" fill="var(--bg)" opacity="0.88"/>
  <g class="golgi" transform="translate(${(W * 0.075).toFixed(1)} ${PY.toFixed(1)}) scale(${PS.toFixed(4)})">
    <rect width="${PW}" height="${PH}" rx="18" fill="var(--surface)"/><g opacity="0.95">${drawing(false)}</g>
    <text class="who" x="${PW / 2}" y="${PH + 70}" text-anchor="middle">Golgi</text><text class="cap" x="${PW / 2}" y="${PH + 118}" text-anchor="middle">one continuous web</text></g>
  <g class="cajal" transform="translate(${(W * 0.52).toFixed(1)} ${PY.toFixed(1)}) scale(${PS.toFixed(4)})">
    <rect width="${PW}" height="${PH}" rx="18" fill="var(--surface)"/><g opacity="0.95">${drawing(true)}</g>
    <text class="who" x="${PW / 2}" y="${PH + 70}" text-anchor="middle">Cajal</text><text class="cap" x="${PW / 2}" y="${PH + 118}" text-anchor="middle">separate cells</text></g>
</svg>`;
document.getElementById("hud").prepend(panels);
const writePanels = (t) => {
  const P = FILM.panels, o = presence(t, P.t0, P.t1 - 0.35, { d: 0.4, out: 0.35 }).o;
  panels.style.opacity = o.toFixed(3);
  panels.querySelector(".golgi").style.opacity = seg(t, P.golgi - 0.4, P.golgi).toFixed(3);
  panels.querySelector(".cajal").style.opacity = seg(t, P.cajal - 0.4, P.cajal).toFixed(3);
};

// ── focus ───────────────────────────────────────────────────────────────────────────────────────
const TARGETS = { behind: () => [8, 0, -260], gap: () => [(GAPX[0] + GAPX[1]) / 2, 0, 0], net: () => [0, 20, -80], sac: () => [3000, 0, 0] };
window.CINEMA_FOCUS = (t) => focusAt(FILM.foc[shotOf(t)] || FILM.foc.syn, t, { targets: TARGETS });

// ── the probe ───────────────────────────────────────────────────────────────────────────────────
const PR = probe(THREE, { W, H, near: 6, ndc: 1.15 });
const STATIC = [[0, 0, 0], [9, 6, 0], [12, -6, 0], [50, 0, 0], [-60, 0, 0], [-150, 0, 0], ...SOMAS.map((s) => s.c), [3000, 0, 0], [3000, 40, 30], [3040, -30, 20]];
let TIER_KMAX = null;

// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const shot = shotOf(t), C = window.CINEMA, tt = shot === "loop" ? 0 : t;
  world.visible = shot !== "sac"; sacG.visible = shot === "sac";
  placeCamera(camera, FILM.cam[shot], t, { handheld: 0 });
  camera.near = 1; camera.far = 6000; camera.updateProjectionMatrix();
  writeJunction(tt);
  const br = 1 + 0.1 * Math.sin((t - SHOTS[1].at) * 1.6);
  SAC.group.scale.setScalar(br); SAC2.forEach((c, k) => c.group.scale.setScalar(1 + 0.08 * Math.sin((t - SHOTS[1].at) * 1.6 - 0.4 * (k + 1))));
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  scene.fog.density = 0.25 / Math.max(30, Math.hypot(camera.position.x - 8 * (shot !== "sac") - 3000 * (shot === "sac"), camera.position.y, camera.position.z));
  hud.update(t);
  writePanels(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  LOC.update(t, presence(t, FILM.loc.t0, FILM.loc.t1, { d: 0.45, out: 0.35 }).o, beatAmp(t, FILM.breaths, { decay: 1.2 }));
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    PR.begin(camera);
    STATIC.forEach((p, i) => PR.add(`s${i}`, p));
    for (let i = 0; i < MSN; i += 4) { const m = new THREE.Matrix4(); msM.getMatrixAt(i, m); const p = new THREE.Vector3().setFromMatrixPosition(m); PR.add(`m${i}`, p.toArray()); }
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
