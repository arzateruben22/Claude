// Meanwhile, Inside No. 06, "The exit": the picture, a pure function of t.
//
// Places (each its own spot in one scene, joined by the iris):
//   vein    (µm) a venule under a fingertip's skin: a floor of wall cells (cutaway pancakes) meeting at seams, the
//           hero seam between two of them at x = 0 running along z; the far wall of the vessel behind (a half pipe);
//           red cells streaming over the floor in +x (slowed, badged); the tissue beneath the floor: fibres and a
//           few white cells that got out. The hero neutrophil (set/wanderer.js) rides the stream, rolls, stops,
//           crawls to the seam, wedges its nucleus in and pours through while the two wall cells part around it
//           (a local deform of their shells), then the seam closes. In the hook, the whoa and the loop the floor is
//           cut open at z = 0 (the cutaways' caps), so the seam and the cell's waist show in section.
//   finger  (mm) a stylised fingertip: one sore spot by the nail (a swelling and a soft glow, the same on any skin),
//           its white cells ghosted beneath.
// The overlay carries the change's engraving (one plate, its cells coming alive and climbing out) and the tease's
// body figure (in from the fingertip, up the arm, to the heart; its pacemaker patch flickering on each beat).
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { path, tube, instance } from "cinema/sci/path.js";
import { cutaway, fbm3 } from "cinema/sci/cutaway.js";
import { placeCamera, focusAt } from "cinema/keys.js";
import { look } from "../set/look.js";
import { rbcGeometry, cellMaterial, R as RC } from "../set/rbc.js";
import { lining } from "../set/vessel.js";
import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
import { probe } from "../set/probe.js";
import { wanderer } from "../set/wanderer.js";

const FILM = window.FILM, W = window.W, H = window.H, THEME = window.THEME || { tokens: {} };
const S1 = Math.min(W, H) / 1080;
const SHOTS = FILM.shots;
const shotOf = (t) => shotAt(t, SHOTS).name;
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));
const PLACE = { vein: [0, 0, 0], finger: [0, 0, 9000] };
const placeOf = (shot) => (shot === "finger" || shot === "tease" ? "finger" : "vein");
const CUTSHOT = (shot) => shot === "hook" || shot === "whoa" || shot === "loop";   // the floor cut open in section

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.2, 12000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 9000 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.024 });
const lin = (h) => L.lin(h);
const G = Object.fromEntries(Object.keys(PLACE).map((k) => { const g = new THREE.Group(); g.position.set(...PLACE[k]); scene.add(g); return [k, g]; }));
const mat = (hex, key, o = {}) => L.patch(new THREE.MeshStandardMaterial({ color: lin(hex), roughness: o.r ?? 0.6, emissive: lin(o.emi || hex), emissiveIntensity: o.ei ?? 0.04,
  side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 }), { fresnel: o.fres ?? 0.3, fresnelPower: o.fp ?? 2.2, key });
const SIG = "#D6F25F";

// ════ the vein (µm) ═══════════════════════════════════════════════════════════════════════════════
// the floor: a pavement of wall cells, each a thin noisy pancake (top surface near y = 0); the hero seam is where
// cells A (x < 0) and B (x > 0) meet
const wallMat = mat("#E9B3A8", "wallcell", { fres: 0.22, ei: 0.05, r: 0.55 });
const wallCap = mat("#C98E86", "wallcap", { fres: 0.05, ei: 0.04, r: 0.7, side: THREE.DoubleSide });
const WR = 22, WY = 0.055, WZ = 0.9;
const FLOOR = [];
for (const [cx, cz, k] of [[-22, 0, "A"], [22, 0, "B"], [-66, 0], [66, 0], [-110, 0], [110, 0], [-154, 0], [154, 0],
  [0, -40], [-44, -40], [44, -40], [-88, -40], [88, -40], [-132, -40], [132, -40], [0, 40], [-44, 40], [44, 40], [-88, 40], [88, 40]]) {
  const C = cutaway({ radius: WR, noise: { amp: 0.05, freq: 1.3, seed: 70 + FLOOR.length }, segments: [72, 40], capSegments: 120, material: wallMat, capMaterial: wallCap });
  C.group.position.set(cx, -WR * WY, cz); C.group.scale.set(1, WY, WZ); G.vein.add(C.group);
  FLOOR.push({ C, k: k || null, s: k === "A" ? 1 : k === "B" ? -1 : 0, row: cz });
}
// the two hero cells part around the passing cell and close again: a local deform near the seam (in each shell's
// own unscaled frame); `open` 0..1 is the gap's half-width over GAP
const GAP = 2.2;
const seamDeform = (s, open) => {
  const f = (p, n) => {
    const zw = p[2] * WZ, w = Math.exp(-(zw * zw) / 60) * Math.min(1, Math.max(0, (p[0] * s - 8) / 12));
    return { p: [p[0] - s * GAP * 1.15 * open * w, p[1], p[2]], n };
  };
  f.key = Math.round(open * 500); return f;
};
// the seam itself: a thin line along z at x = 0 that glows when it is named
const seamMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: lin(SIG), emissiveIntensity: 0, roughness: 1, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const seamLine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 36), seamMat); seamLine.position.set(0, 0.12, 0); G.vein.add(seamLine);
// the far wall of the vessel: a half pipe behind (radius 32, its axis at y = 30), lined
const pipe = (() => {
  const NX = 60, NP = 40, R0 = 32, pos = [], uvs = [], idx = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NP; j++) {
    const x = -220 + (440 * i) / NX, ph = (j / NP) * (160 * Math.PI / 180);
    pos.push(x, 30 + R0 * Math.cos(ph), -R0 * Math.sin(ph)); uvs.push(i / NX * 6, j / NP);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NP; j++) { const a = i * (NP + 1) + j, b = a + NP + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  const tex = lining(THREE, { seed: 9 }); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return new THREE.Mesh(g, L.patch(new THREE.MeshStandardMaterial({ color: lin("#D9A39A"), map: tex, roughness: 0.7, side: THREE.DoubleSide }), { fresnel: 0.15, key: "pipe" }));
})();
G.vein.add(pipe);
// the stream: red cells over the floor, faster in the middle of the vessel, wrapping along x
const RBN = 70, rbcGeo = rbcGeometry(THREE, { around: 32, along: 20 });
const rbcAF = new THREE.InstancedBufferAttribute(new Float32Array(RBN * 2), 2); rbcGeo.setAttribute("aFold", rbcAF);
const rbcs = new THREE.InstancedMesh(rbcGeo, cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: "#B8445A", roughness: 0.55, fresnel: 0.15 }), RBN);
rbcs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rbcs.frustumCulled = false; G.vein.add(rbcs);
const RBS = []; { const r = rng(31); while (RBS.length < RBN) { const y = 4 + 52 * r(), z = -28 + 56 * r(), d = Math.hypot(y - 30, z); if (d > 27) continue; RBS.push({ x0: -180 + 360 * r(), y, z, v: 42 * (1 - (d / 32) ** 2) + 6, rot: [r() * 6.28, r() * 6.28, r() * 6.28], w: 0.3 + 0.5 * r() }); } }
for (let i = 0; i < RBN; i++) { rbcs.setColorAt(i, new THREE.Color(1, 1, 1)); rbcAF.setXY(i, 0, 0); }
// the tissue beneath the floor: fibres, and a few white cells that already got out
const fibreMat = mat("#CDBB97", "ecm", { fres: 0.1, ei: 0.03, r: 0.8 });
{
  const r = rng(41);
  for (let k = 0; k < 46; k++) {
    const y = -4 - 34 * r(), z = -30 + 40 * r(), x0 = -160 + 320 * r(), a = (r() - 0.5) * 0.9, len = 40 + 90 * r();
    const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([x0 + Math.cos(a) * len * u, y + Math.sin(a) * len * u * 0.4 + 2 * Math.sin(u * 5 + k), z + 6 * Math.sin(u * 3 + k * 1.3)]); }
    G.vein.add(new THREE.Mesh(tube(path(pts), { radius: 0.35 + 0.35 * r(), radial: 8, step: 3 }), fibreMat));
  }
}
const PILED = [[22, -9, 2, 0.6, 2], [36, -12, -6, 0.3, 3], [12, -15, -10, 0.5, 4], [48, -8, 6, 0.8, 5], [30, -19, 4, 0.2, 6], [58, -14, -4, 0.6, 7]].map(([x, y, z, st, seed]) => {
  const N = wanderer(THREE, L, { r: 4.15, seed }); N.group.position.set(x, y, z); N.group.rotation.set(0.4 * hash(seed), 6.28 * hash(seed + 1), 0.3 * hash(seed + 2));
  N.set({ pass: 1, settle: st }); G.vein.add(N.group); return N;
});
// the selectins: fine threads on the lining along the hero's path, lighting on "sticky"
const THN = 160, thMat = new THREE.MeshStandardMaterial({ color: lin("#A8D89A"), emissive: lin("#A8D89A"), emissiveIntensity: 0, roughness: 0.6 });
const threads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1, 5), thMat, THN); threads.frustumCulled = false; G.vein.add(threads);
{ const r = rng(51), m = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < THN; i++) { const x = -72 + 74 * r(), z = -7 + 14 * r(), h = 0.7 + 0.8 * r(); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8)); threads.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(1, h, 1))); } }
// the hero and the faulty cell
const HERO = wanderer(THREE, L, { r: 4.15, seed: 1 }); G.vein.add(HERO.group);
const FAULT = wanderer(THREE, L, { r: 4.15, seed: 9 }); G.vein.add(FAULT.group);

// the hero's state at t: position on the floor (x, lift above it, z) and its shape
const heroAt = (t, shot) => {
  const W1 = FILM.why, W2 = FILM.whoa, R = HERO.R;
  if (shot === "hook" || shot === "loop") { const tt = shot === "loop" ? 0 : t, u = seg(tt, 0, SHOTS[1].at); return { x: 0, y: 0, z: 0, pass: FILM.hookSt.pass[0] + (FILM.hookSt.pass[1] - FILM.hookSt.pass[0]) * u, settle: 0, grips: 0, lead: 0.5, open: 1 }; }
  if (shot === "normal") {
    const N = FILM.normal, u = seg(t, SHOTS[1].at, N.out[0]), x = N.x[0] + (N.x[1] - N.x[0]) * u + 6 * Math.max(0, t - N.out[0]);
    return { x, y: 9 + 0.8 * Math.sin(t * 1.1), z: 4, pass: 0, settle: 0, grips: 0, roll: -(x - N.x[0]) / R * 0.35, lead: 0, open: 0 };
  }
  if (shot === "why") {
    const t0 = SHOTS.find((s) => s.name === "why").at, touch = W1.sticky[0], xTouch = -62, xStop = -12;
    let x, y = 0, roll = 0, settle = 0, grips = 0, lead = 0, pass = 0;
    if (t < touch) { x = -80 + (xTouch + 80) * seg(t, t0, touch); y = 3.2 * (1 - E.inout2(seg(t, t0 + 0.6, touch))); }
    else if (t < W1.stop) { const u = E.out2(seg(t, W1.roll[0], W1.stop)); x = xTouch + (xStop - xTouch) * u; roll = -(x - xTouch) / R; }
    else if (t < W1.crawl[0]) { x = xStop; roll = -(xStop - xTouch) / R; settle = E.inout2(seg(t, W1.stop, W1.stop + 0.5)); grips = seg(t, W1.stop - 0.05, W1.stop + 0.25); }
    else { const u = E.inout2(seg(t, W1.crawl[0], W1.crawl[1])); x = xStop * (1 - u); roll = -(xStop - xTouch) / R; settle = 1; grips = 1; }
    if (t >= W1.press[0]) { lead = E.inout2(seg(t, W1.press[0], W1.press[1])); pass = 0.03 * lead; }
    return { x, y, z: 0, pass, settle, grips, roll, lead, open: 0.15 * lead };
  }
  if (shot === "whoa") {
    const wedge = E.inout2(seg(t, W2.wedge[0], W2.wedge[1])), pour = E.inout2(seg(t, W2.pour[0], W2.pour[1])), seal = E.inout2(seg(t, W2.seal[0], W2.seal[1]));
    const free = E.inout2(seg(t, W2.free[0], W2.free[0] + 2.4));
    return { x: 0, y: -7 * free, z: 0, pass: 0.03 + 0.09 * wedge + 0.88 * pour, settle: 1 - wedge, grips: 1 - seg(t, W2.pour[0], W2.pour[0] + 0.8), lead: 1, open: Math.max(wedge * (1 - seal), 0), roll: 0 };
  }
  return { x: 0, y: -7, z: 0, pass: 1, settle: 0, grips: 0, lead: 1, open: 0 };
};
const heroWorld = (t) => { const s = heroAt(t, shotOf(t)), c = HERO.centreOf(s); return [s.x + c[0], s.y + c[1], s.z + c[2]]; };
const writeVein = (t, shot) => {
  const st = heroAt(shot === "loop" ? 0 : t, shot);
  HERO.group.position.set(st.x, st.y, st.z); HERO.set(st);
  // the faulty cell: grips dark, it rolls along the floor and on past the seam (the stakes)
  const F = FILM.why.faulty, fo = shot === "why" ? presence(t, F[0], F[1], { d: 0.3, out: 0.4 }).o : 0;
  FAULT.group.visible = fo > 0.01;
  if (FAULT.group.visible) { const x = -70 + 130 * seg(t, F[0], F[1]); FAULT.group.position.set(x, 0, -13); FAULT.set({ pass: 0, roll: -(x + 70) / FAULT.R, grips: 0 }); FAULT.bodyMat.opacity = 0.62 * fo; }
  // the floor: cut open in section for the hook, the whoa and the loop; the hero pair part around the cell
  const cutOn = CUTSHOT(shot);
  for (const P of FLOOR) {
    // the cut is the world plane z = 0: it opens the hero row; the row in front of it is not drawn, the one behind is whole
    P.C.group.visible = !(cutOn && P.row > 0);
    P.C.set({ cut: cutOn && P.row === 0 ? { n: [0, 0, 1], d: 0 } : null, deform: P.s ? seamDeform(P.s, st.open) : null });
    P.C.update();
  }
  // the seam glows when it is named, and once more as it seals
  const W1 = FILM.why, W2 = FILM.whoa;
  seamMat.emissiveIntensity = 1.6 * Math.max(shot === "why" ? seg(t, W1.seam[0] - 0.1, W1.seam[0] + 0.2) * (1 - seg(t, W1.seam[1], W1.seam[1] + 0.8)) : 0,
    shot === "whoa" ? seg(t, W2.seal[1] - 0.2, W2.seal[1]) * (1 - seg(t, W2.seal[1] + 0.3, W2.seal[1] + 1.2)) : 0);
  // the threads light on "sticky" and stay faintly lit while it rolls
  thMat.emissiveIntensity = shot === "why" ? 0.9 * seg(t, W1.sticky[0], W1.sticky[0] + 0.4) * (1 - 0.6 * seg(t, W1.stop + 0.5, W1.stop + 1.5)) : 0;
  threads.visible = shot === "why" || shot === "normal";
  // the stream: wrapping along x; it parts over the stopped hero; in the cut shots only the cells behind are drawn
  for (let i = 0; i < RBN; i++) {
    const c = RBS[i], x = ((c.x0 + c.v * t + 180) % 360 + 360) % 360 - 180;
    let y = c.y; const dx = x - st.x, dz = c.z - st.z;
    if (st.y < 1 && Math.abs(dz) < 9 && y < 14) y += 7 * Math.exp(-(dx * dx) / 120) * (1 - Math.abs(dz) / 9);
    const vis = cutOn ? (c.z < -3 ? 1 : 0) : 1;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.rot[0] + c.w * t, c.rot[1], c.rot[2] + 0.5 * c.w * t));
    instance(rbcs, i, [x, y, c.z], q, (7.6 / (2 * RC)) * vis);
  }
  rbcs.instanceMatrix.needsUpdate = true;
};

// ════ the finger (mm) ════════════════════════════════════════════════════════════════════════════
const skinMat = mat("#C08B73", "skin", { fres: 0.18, ei: 0.03, r: 0.55 });
const nailMat = mat("#E8CFC4", "nail", { fres: 0.3, ei: 0.04, r: 0.28 });
const finger = new THREE.Group(); G.finger.add(finger);
{
  const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(8, 34, 16, 64), skinMat); shaft.rotation.z = Math.PI / 2; shaft.position.set(-8, 0, 0); shaft.scale.set(1, 1, 0.86); finger.add(shaft);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), nailMat); nail.scale.set(7.2, 0.9, 5.8); nail.position.set(11, 7.0, 0); nail.rotation.z = -0.12; finger.add(nail);
  // the knuckle crease lines and the pad, for scale
  for (const x of [-20, -24]) { const c = new THREE.Mesh(new THREE.TorusGeometry(8.05, 0.12, 6, 64, Math.PI), mat("#9C6B57", "crease", { fres: 0, ei: 0 })); c.rotation.y = Math.PI / 2; c.position.set(x, 0, 0); c.scale.set(1, 1, 0.86); finger.add(c); }
}
// the sore spot by the nail fold: a swelling with a soft warm glow (never a wound, never blood or pus drawn)
const SPOT = [4.2, 7.6, 3.4];
const spotMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#C99079"), roughness: 0.5, emissive: lin("#FFB37A"), emissiveIntensity: 0.3 }), { fresnel: 0.2, key: "spot" });
const spot = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), spotMat); spot.scale.set(3.6, 1.6, 3.0); spot.position.set(...SPOT); spot.lookAt(SPOT[0], SPOT[1] + 5, SPOT[2] + 3); finger.add(spot);
// the white cells beneath it, ghosted through the skin
const ghostMat = new THREE.MeshBasicMaterial({ color: lin("#F3EEE4"), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
const GHN = 34, ghosts = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 1), ghostMat, GHN); ghosts.renderOrder = 6; ghosts.frustumCulled = false; finger.add(ghosts);
{ const r = rng(61); for (let i = 0; i < GHN; i++) instance(ghosts, i, [SPOT[0] + 4 * (r() - 0.5), SPOT[1] - 1.6 - 1.6 * r(), SPOT[2] + 3.4 * (r() - 0.5)], null, 0.8 + 0.5 * r()); }
const writeFinger = (t) => {
  const g = 0.3 + 0.12 * Math.sin(t * 2.2);
  spotMat.emissiveIntensity = g;
  ghostMat.opacity = 0.55 * seg(t, FILM.finger.pull[0] + 0.6, FILM.finger.pull[0] + 1.6);
};

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 500 3vmin/1.35 var(--font-text); color: var(--text-2); }
#hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); transition: none; }
#hud-tally .lb { color: var(--text); }
#hud-tally .v { color: var(--text); }
/* dimmed to a third until the meanwhile (the spine readout, parked) */
#hud-tally.mi-dim > * { opacity: .34; }
#hud-tally.mi-dim { background: rgba(7, 21, 19, .45); }
.mi-plate, .mi-fig { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }
.hud-scrim { background: rgba(7, 21, 19, .6); }
`; document.head.appendChild(css);
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(330 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const wp = (k, p) => [p[0] + PLACE[k][0], p[1] + PLACE[k][1], p[2] + PLACE[k][2]];
const ANCH = {
  hero: (t) => { const c = heroWorld(t); return [c[0], c[1] + HERO.R * 0.9, c[2] + 1]; },
  piled: () => { const g = PILED[0].group; return [g.position.x, g.position.y + 7.5, g.position.z + 2]; },
  grips: (t) => { const s = heroAt(t, shotOf(t)); return [s.x + 1.5, 0.3, s.z + HERO.R * 0.7]; },
  seam: () => [0, 0.3, 12],
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side, fixed: lb.fixed, v: lb.v });
// rule 8: the speed column top left, the standing cheats top right (at most two notes per corner)
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot || "tr" });
// the size: a scale bar as long as the cell is across, at its depth
hud.scale("size", { text: FILM.scale.text, t0: FILM.scale.t0, t1: FILM.scale.t1, bar: (t) => { const c = heroWorld(t), a = hud.project([c[0] - HERO.R, c[1], c[2]]), b = hud.project([c[0] + HERO.R, c[1], c[2]]); return Math.hypot(b.x - a.x, b.y - a.y); } });
// the spine readout: the meanwhile's tally itself, from frame 0, dimmed to a third until the meanwhile
const commas = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: commas, unit: "", label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.5, 0.345], minCh: 10 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 560 * S1, h: 232 * S1, region: FILM.loc.region, plate: true });
const NS = "http://www.w3.org/2000/svg";

// the change: one engraved plate (light lines on the dark plate; hatching for shade); its vessel and tissue, the
// tissue's cells glowing on "tissue", the blood inside starting to move on "Julius Cohnheim", and three white cells
// climbing out through the lower wall on "out"
const PL = { w: 600, h: 480 }, PS2 = (W * 0.75) / PL.w, PX = (W - PL.w * PS2) / 2, PY = H * 0.215;
const blob = (cx, cy, rx, ry, seed, wob = 0.12) => { const r = rng(seed), n = 10, pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832, k = 1 + wob * (r() - 0.5) * 2; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`; for (let i = 0; i < n; i++) { const p0 = pts[i], p1 = pts[(i + 1) % n], m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; d += ` Q${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; } return d + " Z"; };
const plate = document.createElement("div"); plate.className = "mi-plate";
{
  const r = rng(81), tissue = [], blood = [], white = [];
  for (let i = 0; i < 9; i++) { const x = 40 + 520 * r(), y = r() < 0.5 ? 60 + 90 * r() : 340 + 110 * r(); tissue.push(`<path class="tc" d="${blob(x, y, 26 + 10 * r(), 11 + 4 * r(), 200 + i, 0.18)}" transform="rotate(${(r() - 0.5) * 50} ${x.toFixed(1)} ${y.toFixed(1)})"/>`); }
  for (let i = 0; i < 12; i++) { const x = 30 + 50 * i + 20 * r(), y = 205 + 70 * r(); blood.push(`<path d="${blob(x, y, 15, 9, 300 + i, 0.06)}" transform="rotate(${(r() - 0.5) * 70} ${x.toFixed(1)} ${y.toFixed(1)})"/>`); }
  for (let i = 0; i < 3; i++) { const x = 150 + 150 * i, y = 268; white.push(`<g class="wc" data-x="${x}"><path d="${blob(0, 0, 19, 17, 400 + i, 0.1)}" class="wb"/><path d="M-9 -2 q4 -6 8 0 q4 6 9 -1" class="wn"/></g>`); }
  plate.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
  <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="var(--bone)" stroke-width="1.2" opacity="0.55"/></pattern></defs>
  <rect width="${W}" height="${H}" fill="var(--bg)" opacity="0.9"/>
  <g transform="translate(${PX.toFixed(1)} ${PY.toFixed(1)}) scale(${PS2.toFixed(4)})">
    <rect width="${PL.w}" height="${PL.h}" rx="18" fill="var(--surface)"/>
    <rect x="12" y="12" width="${PL.w - 24}" height="${PL.h - 24}" rx="10" fill="none" stroke="var(--bone)" stroke-width="1.5" opacity="0.5"/>
    <g class="tissue" fill="url(#hatch)" stroke="var(--bone)" stroke-width="2.2">${tissue.join("")}</g>
    <g class="glow" fill="var(--bone)" opacity="0">${tissue.join("")}</g>
    <path d="M0 180 C150 168 300 194 600 178 L600 192 C300 208 150 182 0 194 Z" fill="url(#hatch)" stroke="var(--bone)" stroke-width="2"/>
    <path d="M0 300 C150 312 300 290 600 304 L600 318 C300 304 150 326 0 314 Z" fill="url(#hatch)" stroke="var(--bone)" stroke-width="2"/>
    <g class="blood" fill="none" stroke="var(--bone)" stroke-width="2">${blood.join("")}</g>
    <g class="white" fill="var(--surface)" stroke="var(--bone)" stroke-width="2.6">${white.join("")}</g>
  </g></svg>`;
  document.getElementById("hud").prepend(plate);
}
const pq = (c) => plate.querySelector("." + c);
const WCS = [...plate.querySelectorAll(".wc")].map((g) => ({ g, x: +g.dataset.x }));
plate.querySelectorAll(".wn").forEach((n) => { n.setAttribute("fill", "none"); n.setAttribute("stroke", "var(--bone)"); n.setAttribute("stroke-width", "3"); });
const writePlate = (t) => {
  const P = FILM.panel, o = presence(t, P.t0, P.t1, { d: 0.4, out: 0.35 }).o;
  plate.style.opacity = o.toFixed(3);
  if (o <= 0.001) return;
  pq("glow").setAttribute("opacity", (0.45 * seg(t, P.tissue - 0.1, P.tissue + 0.4) * (1 - 0.6 * seg(t, P.alive, P.alive + 1.0))).toFixed(3));
  const alive = Math.max(0, t - P.alive);
  pq("blood").setAttribute("transform", `translate(${((alive * 24) % 50).toFixed(1)} 0)`);
  // the white cells roll slowly along the lower wall, then climb out through it (pinched as they pass)
  WCS.forEach(({ g, x }, i) => {
    const out = E.inout2(seg(t, P.out[0] + 0.25 * i, P.out[1] + 0.25 * i)), y = 268 + 78 * out, pinch = Math.exp(-(((y - 309) / 16) ** 2));
    g.setAttribute("transform", `translate(${(x + alive * 6).toFixed(1)} ${y.toFixed(1)}) scale(${(1 - 0.45 * pinch).toFixed(3)} ${(1 + 0.25 * pinch).toFixed(3)})`);
  });
};

// the tease: the body figure, in from the fingertip up the arm to the heart; the pacemaker patch flickers on each beat
const FIGURE = "M50 6 C59 6 64 13 64 22 C64 32 58 40 50 40 C42 40 36 32 36 22 C36 13 41 6 50 6 Z " +
  "M44 42 L56 42 L57 48 C66 49 74 52 77 58 L84 98 L90 128 C91 133 88 135 85 131 L76 102 L70 74 L68 112 L69 150 L67 220 C67 226 58 226 58 220 L54 158 L50 130 L46 158 L42 220 C42 226 33 226 33 220 L31 150 L32 112 L30 74 L24 102 L15 131 C12 135 9 133 10 128 L16 98 L23 58 C26 52 34 49 43 48 Z";
const HEART = "M50 58 C46 52 40 55 41 61 C42 67 49 71 54 75 C59 71 66 67 67 61 C68 55 62 52 58 58 C56 61 52 61 50 58 Z";
const figEl = document.createElement("div"); figEl.className = "mi-fig";
figEl.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
  <rect width="${W}" height="${H}" fill="var(--bg)" opacity="0.94"/>
  <g class="body"><path d="${FIGURE}" fill="var(--surface)" fill-opacity="0.9" stroke="var(--text-2)" stroke-width="0.7"/>
    <path d="${HEART}" fill="var(--pulse)" fill-opacity="0.85"/>
    <path class="pace" d="M45 57 C46 55 49 55 50 57 C50 59 47 60 45 59 Z" fill="var(--signal)" opacity="0"/></g></svg>`;
document.getElementById("hud").prepend(figEl);
const figQ = (c) => figEl.querySelector("." + c);
const writeFig = (t) => {
  const F = FILM.fig, o = presence(t, F.t0 + 0.05, SHOTS.find((s) => s.name === "loop").at - 0.3, { d: 0.35, out: 0.3 }).o;
  figEl.style.opacity = o.toFixed(3);
  if (o <= 0.001) return;
  // the view travels from the fingertip (the figure's right hand, viewer's left) up the arm to the heart
  const u = E.inout2(seg(t, FILM.tease.zoom[0], FILM.tease.zoom[1])), c = [12 + (54 - 12) * u, 132 + (65 - 132) * u], k = (16 + (7 - 16) * u) * S1;
  figQ("body").setAttribute("transform", `translate(${(W / 2 - c[0] * k).toFixed(1)} ${(H * 0.42 - c[1] * k).toFixed(1)}) scale(${k.toFixed(3)})`);
  let pc = 0; for (const b of FILM.segBeats) pc = Math.max(pc, seg(t, b - 0.06, b) * (1 - seg(t, b + 0.02, b + 0.3)));
  figQ("pace").setAttribute("opacity", (pc * seg(t, FILM.tease.zoom[1] - 0.6, FILM.tease.zoom[1])).toFixed(3));
};

// ── focus ───────────────────────────────────────────────────────────────────────────────────────
const TARGETS = { hero: (t) => heroWorld(t), piled: () => PILED[0].group.position.toArray(), seam: () => [0, 0, 0], spot: () => SPOT };
window.CINEMA_FOCUS = (t) => {
  const shot = shotOf(t), F = focusAt(FILM.foc[shot] || FILM.foc.hook, t, { targets: TARGETS }), o = PLACE[placeOf(shot)];
  return { ...F, point: [F.point[0] + o[0], F.point[1] + o[1], F.point[2] + o[2]] };
};

// ── the probe ───────────────────────────────────────────────────────────────────────────────────
const PRB = { vein: probe(THREE, { W, H, near: 4, ndc: 1.15 }), finger: probe(THREE, { W, H, near: 2, ndc: 1.15 }) };
const STATIC = {
  vein: [[0, 0, 0], [-40, 0, 0], [40, 0, 0], [0, 20, -20], [0, -12, 0], [30, -10, 0], [-60, 0, 0], [0, 40, -25]],
  finger: [[0, 0, 0], [10, 7, 0], [SPOT[0], SPOT[1], SPOT[2]], [-20, 0, 0]].map((p) => wp("finger", p)),
};
let TIER_KMAX = null;
const camAt = (shot, t) => {   // camera keys are in the place's own frame; "rel" ones follow the hero
  const o = PLACE[placeOf(shot)];
  placeCamera(camera, FILM.cam[shot], t, { track: () => heroWorld(t), handheld: 0 });
  camera.position.x += o[0]; camera.position.y += o[1]; camera.position.z += o[2];
  const d = new THREE.Vector3(); camera.getWorldDirection(d); camera.lookAt(camera.position.clone().add(d)); camera.updateMatrixWorld();
};

// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const shot = shotOf(t), pl = placeOf(shot), C = window.CINEMA;
  for (const [k, g] of Object.entries(G)) g.visible = k === pl;
  camAt(shot, t);
  camera.near = pl === "finger" ? 0.5 : 0.5; camera.far = 12000; camera.updateProjectionMatrix();
  if (pl === "vein") writeVein(t, shot);
  if (pl === "finger") writeFinger(t);
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  L.uniforms.uFogStart.value = fd;
  scene.fog.density = 1.0 / Math.max(6, fd);
  hud.update(t);
  // the tally: dimmed (parked) until the meanwhile, then lit, on its pulse line
  const lit = t >= FILM.tally.lit[0] && t < FILM.tally.lit[1];
  tallyEl.classList.toggle("mi-dim", !lit);
  yPulse.el.style.visibility = lit ? "visible" : "hidden";
  writePlate(t);
  writeFig(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  LOC.update(t, presence(t, FILM.loc.t0, FILM.loc.t1, { d: 0.45, out: 0.35 }).o, beatAmp(t, FILM.segBeats));
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    const P = PRB[pl]; P.begin(camera);
    STATIC[pl].forEach((p, i) => P.add(`s${i}`, p));
    if (pl === "vein") { P.add("hero", heroWorld(t)); for (let i = 0; i < RBN; i += 5) { const m = new THREE.Matrix4(); rbcs.getMatrixAt(i, m); P.add(`r${i}`, new THREE.Vector3().setFromMatrixPosition(m).toArray()); } }
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
