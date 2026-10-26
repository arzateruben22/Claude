// Meanwhile, Inside No. 05, "Where breath goes": the picture, a pure function of t.
//
// Places (each its own spot in one scene, joined by the iris):
//   lung  (arbitrary units, generations compressed; badged "not to scale") an airway tree branching 7 times from
//         a windpipe; at every tip a cluster of air sacs (one InstancedMesh). The tree is moved so the hero tip's
//         cluster sits at the origin; there the hero sac is cut open (hollow: no cap, both faces drawn) with a net
//         of capillaries over the cluster. In the change an "airy flesh" envelope (the old idea, an illustration)
//         is drawn over the cluster and dissolves on "bubbles".
//   wall  (µm, true scale; badged "drawn to scale") air on the left, the 0.5 µm wall, a capillary with a red cell
//         (set/rbc.js) on the right; O₂ slips across; the wall thickens and fewer O₂ get through.
//   room  (metres) a person 1.75 m tall; the sacs unfold from the chest into a 70 m² floor (8.37 m square of tiles),
//         a singles tennis court's lines (23.77 × 8.23 m) around it; the tiles fold back for the takeaway; the person
//         breathes through the tally.
//   exit  a white blood cell pressed into a seam between two lining cells of a vessel wall (the tease).
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { path, tube, instance } from "cinema/sci/path.js";
import { cutaway } from "cinema/sci/cutaway.js";
import { swarm } from "cinema/sci/swarm.js";
import { placeCamera, focusAt } from "cinema/keys.js";
import { look } from "../set/look.js";
import { rbcGeometry, cellMaterial } from "../set/rbc.js";
import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
import { probe } from "../set/probe.js";

const FILM = window.FILM, W = window.W, H = window.H, THEME = window.THEME || { tokens: {} };
const S1 = Math.min(W, H) / 1080;
const SHOTS = FILM.shots;
const shotOf = (t) => shotAt(t, SHOTS).name;
const PLACE = { lung: [0, 0, 0], loop: [0, 0, 0], wall: [5000, 0, 0], room: [0, 0, 9000], exit: [-5000, 0, 0] };
const B = Object.fromEntries(FILM.beats.map((b) => [b.id, b]));

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 20000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 9000 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.026 });
const lin = (h) => L.lin(h);
const G = Object.fromEntries(["lung", "wall", "room", "exit"].map((k) => { const g = new THREE.Group(); g.position.set(...PLACE[k]); scene.add(g); return [k, g]; }));
const mat = (hex, key, o = {}) => L.patch(new THREE.MeshStandardMaterial({ color: lin(hex), roughness: o.r ?? 0.6, emissive: lin(o.emi || hex), emissiveIntensity: o.ei ?? 0.04, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent }), { fresnel: o.fres ?? 0.4, fresnelPower: 2.2, key });

// ════ the lung: an airway tree, clusters of sacs, the hero cluster at the origin ═══════════════════
const airwayMat = mat("#E3B8B0", "airway", { fres: 0.45 });
const sacMat = mat("#E9BDB5", "sacs", { fres: 0.5, ei: 0.06 });
const TIPS = [], SEGS = [];
{
  const r = rng(12), up = new THREE.Vector3(0, -1, 0);
  const grow = (p, dir, len, rad, gen) => {
    const e = p.clone().addScaledVector(dir, len);
    SEGS.push({ a: p.clone(), b: e.clone(), rad });
    if (gen === 7) { TIPS.push({ p: e.clone(), dir: dir.clone(), rad }); return; }
    const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(up, gen * Math.PI / 2 + 0.3 * r()).cross(dir).normalize();
    for (const s of [-1, 1]) {
      const a = (0.48 + 0.12 * r()) * s, d = dir.clone().applyAxisAngle(side, a).normalize();
      grow(e, d, len * (0.74 + 0.06 * r()), rad * 0.74, gen + 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), up.clone(), 110, 9, 0);
}
// the hero tip: the one nearest the viewer's side, low; move the whole tree so its cluster sits at the origin
const HT = TIPS.reduce((b, t) => (t.p.z * 0.6 - t.p.y * 0.1 + t.p.x * 0.05 > b.p.z * 0.6 - b.p.y * 0.1 + b.p.x * 0.05 ? t : b), TIPS[0]);
const SHIFT = HT.p.clone().addScaledVector(HT.dir, 1.6).multiplyScalar(-1);
const tree = new THREE.Group(); tree.position.copy(SHIFT); G.lung.add(tree);
for (const s of SEGS) { const P = path([s.a.toArray(), s.a.clone().lerp(s.b, 0.5).toArray(), s.b.toArray()]); tree.add(new THREE.Mesh(tube(P, { radius: s.rad, radial: Math.max(8, Math.round(s.rad * 3)), segments: 6 }), airwayMat)); }
// clusters: 9 sacs at each tip (a grape bunch); the hero's are left out of the instanced mesh and drawn on their own
const SACG = (() => { const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.06 * Math.sin(5 * x + 3 * y) * Math.cos(4 * z); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; })();
const CL = (tip, i) => { const out = [], r = rng(100 + i), base = tip.p.clone().addScaledVector(tip.dir, 1.6), s = tip.rad * 1.15;
  for (let k = 0; k < 9; k++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(k ? s * 1.25 : 0); out.push({ c: base.clone().add(v), r: s * (0.85 + 0.25 * r()) }); } return out; };
const ALL = []; TIPS.forEach((tp, i) => { if (tp !== HT) for (const s of CL(tp, i)) ALL.push(s); });
const sacs = new THREE.InstancedMesh(SACG, sacMat, ALL.length);
ALL.forEach((s, i) => instance(sacs, i, s.c.toArray(), null, s.r)); tree.add(sacs);
const HC = CL(HT, TIPS.indexOf(HT)).map((s) => ({ c: s.c.clone().add(SHIFT), r: s.r }));
// the hero sac is the one facing the lens (largest z), moved to the front of the list
const TOCAM = new THREE.Vector3(4, 3, 15).normalize();   // frame 0's camera direction (compile.py, lung key 0)
{ let k = 0; HC.forEach((s, i) => { if (s.c.dot(TOCAM) > HC[k].c.dot(TOCAM)) k = i; }); HC.unshift(HC.splice(k, 1)[0]); }
// the hero cluster: cutaway sacs; the front one cut open, hollow (no cap, both faces), its inside a darker lining
const insideMat = mat("#B0706E", "sacin", { side: THREE.DoubleSide, fres: 0.25 });
const HERO = HC.map((s, k) => { const C = cutaway({ radius: s.r, noise: { amp: 0.06, freq: 1.5, seed: 40 + k }, segments: [64, 48], material: sacMat }); C.group.position.copy(s.c); G.lung.add(C.group); return C; });
const HS = HC[0];
// camera keys written with look "HERO" are offsets from the hero sac (compile.py cannot know where the tree puts it)
for (const k of FILM.cam.lung) if (k.look === "HERO") { k.look = HS.c.toArray(); k.pos = k.pos.map((x, i) => x + k.look[i]); }
// (no cut: a cut-open sac read as a stray sliver behind its neighbours; the cluster itself carries the hook)
// a net of capillaries over the cluster's sacs (thin red tubes wandering over each surface)
const capMat = mat("#B8344F", "capil", { fres: 0.3, ei: 0.08, emi: "#E5334F" });
const CAPS = [];
const CUTN = TOCAM;
HC.forEach((s, k) => { const r = rng(300 + k); for (let n = 0; n < 12; n++) {
  const a0 = r() * 6.28, b0 = (r() - 0.5) * 2.6, pts = [];
  for (let i = 0; i <= 14; i++) { const a = a0 + i * 0.13, b = b0 + 0.22 * Math.sin(i * 1.1 + n * 1.7); const d = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)); pts.push(s.c.clone().addScaledVector(d, s.r * 1.035).toArray()); }
  if (pts.length < 3) continue;
  const P = path(pts), m = new THREE.Mesh(tube(P, { radius: s.r * 0.016, radial: 6, segments: 40 }), capMat); G.lung.add(m); CAPS.push(m); } });
// the old idea, drawn over the cluster: a soft lumpy envelope, dissolving on "bubbles"
const fleshMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#B85A64"), roughness: 0.85, transparent: true, opacity: 0, emissive: lin("#8E2A3F"), emissiveIntensity: 0.12 }), { fresnel: 0.3, key: "flesh" });
const FLESHM = cutaway({ radius: HS.r * 2.5, noise: { amp: 0.14, freq: 1.4, seed: 7 }, segments: [64, 48], material: fleshMat });
FLESHM.group.position.copy(HC.reduce((a, s) => a.add(s.c), new THREE.Vector3()).multiplyScalar(1 / HC.length)); G.lung.add(FLESHM.group);
const writeLung = (t) => {
  const F = FILM.flesh, o = Math.min(seg(t, F[0], F[0] + 0.6), 1 - seg(t, F[1], F[2]));
  fleshMat.opacity = 0.93 * o; FLESHM.group.visible = o > 0.003;
  const br = 1 + 0.035 * Math.sin(t * 1.4);                    // the cluster breathes gently
  HERO.forEach((C, k) => C.group.scale.setScalar(k ? br : 1));
};

// ════ the wall, at true scale (µm) ═══════════════════════════════════════════════════════════════
const WS = { x: 0, wall: 0.5 };
const wallMat = mat("#E7C2B8", "wall", { fres: 0.35 });
const wallM = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 8), wallMat); G.wall.add(wallM);
const lumenMat = mat("#F0D7CF", "lumen", { fres: 0.2, ei: 0.02 });
const endo = new THREE.Mesh(new THREE.BoxGeometry(0.3, 30, 8), lumenMat); G.wall.add(endo);
const rbcM = new THREE.Mesh(rbcGeometry(THREE, { around: 48, along: 32 }), cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: FILM.look["rbc-deep"], instanced: false }));
rbcM.rotation.z = Math.PI / 2; rbcM.position.set(4.4, -1, 0); G.wall.add(rbcM);
const o2Mat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#FFFFFF"), emissive: lin("#FFFFFF"), emissiveIntensity: 0.4, roughness: 0.35 }), { fresnel: 0.1, key: "o2" });
const WO = swarm({ n: 70, seed: 9, home: { box: [[-12, -12, -2], [-1.5, 12, 2]] }, waves: [{ amp: [0.9, 0.9, 0.3], omega: 1.2 }] });
const woM = WO.mesh(new THREE.IcosahedronGeometry(0.12, 1), o2Mat); G.wall.add(woM);
const thickAt = (t) => 1 + 5 * E.inout2(seg(t, FILM.wall.thick[0], FILM.wall.thick[1]));   // ×1 → ×6
const writeWall = (t) => {
  const k = thickAt(t), wth = WS.wall * k;
  wallM.scale.set(wth, 1, 1); wallM.position.x = wth / 2; endo.position.x = wth + 0.15;
  const S = FILM.wall.slip, thick = seg(t, FILM.wall.thick[0], FILM.wall.slow);
  for (let i = 0; i < WO.n; i++) {
    const h = WO.at(i, t), rate = 1 - 0.8 * thick, ph = (hash(i + 3) + (t - S[0]) * 0.45 * rate) % 1;
    let p = h, sc = 0.9;
    if (t >= S[0] - 0.5) {
      const u = E.inout2(Math.min(1, Math.max(0, ph * 1.4 - 0.2)));
      const from = [-2.5 - 3 * hash(i + 5), h[1] * 0.6, h[2]], to = [wth + 1.4 + 2.2 * hash(i + 6), -1 + (hash(i + 7) - 0.5) * 3.5, (hash(i + 8) - 0.5) * 2];
      p = from.map((x, j) => x + (to[j] - x) * u); sc = 0.9 * (1 - seg(ph, 0.85, 1)) * seg(ph, 0, 0.08);
    }
    instance(woM, i, p, null, sc);
  }
  woM.instanceMatrix.needsUpdate = true;
};

// ════ the room (metres) ══════════════════════════════════════════════════════════════════════════
const floorMat = mat("#E9BDB5", "floor", { fres: 0.25, ei: 0.08 });
const NT = 24, SIDE = Math.sqrt(70), TS = SIDE / NT;
const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1), floorMat, NT * NT); tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tiles.frustumCulled = false; G.room.add(tiles);
const CHEST = [0, 1.25, 0.05];
const TILE = Array.from({ length: NT * NT }, (_, i) => { const a = i % NT, b = Math.floor(i / NT); return { p: [(a + 0.5) * TS - SIDE / 2 + 1.6, 0.02, (b + 0.5) * TS - SIDE / 2], d: hash(i + 11) }; });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat("#123A33", "ground", { fres: 0, ei: 0, r: 0.95 })); ground.rotation.x = -Math.PI / 2; G.room.add(ground);
const lineMat = mat("#EFF6F2", "lines", { fres: 0, ei: 0.5, emi: "#EFF6F2" });
const COURT = new THREE.Group(); G.room.add(COURT);
{ const Lc = 23.77, Wd = 10.97, Ws = 8.23, w = 0.05;
  const bar = (x, z, sx, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.01, sz), lineMat); m.position.set(x, 0.045, z); COURT.add(m); };
  bar(0, -Lc / 2, Wd, w); bar(0, Lc / 2, Wd, w); bar(-Wd / 2, 0, w, Lc); bar(Wd / 2, 0, w, Lc); bar(-Ws / 2, 0, w, Lc); bar(Ws / 2, 0, w, Lc);
  bar(0, -6.4, Ws, w); bar(0, 6.4, Ws, w); bar(0, 0, w, 12.8); bar(0, 0, Wd + 0.9, 0.06); }
COURT.position.set(1.6, 0, 0); COURT.rotation.y = 0;
// the person: a simple standing figure, 1.75 m
const skinMat = mat("#D9B8A8", "person", { fres: 0.35 });
const PERSON = new THREE.Group(); G.room.add(PERSON);
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.5, 6, 16), skinMat); torso.position.y = 1.2; torso.scale.set(1, 1, 0.62); PERSON.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), skinMat); head.position.y = 1.64; head.scale.set(1, 1.18, 1); PERSON.add(head);
for (const s of [-1, 1]) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), skinMat); leg.position.set(0.1 * s, 0.46, 0); PERSON.add(leg);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.56, 4, 10), skinMat); arm.position.set(0.27 * s, 1.15, 0); arm.rotation.z = 0.08 * s; PERSON.add(arm);
}
const writeRoom = (t) => {
  const R = FILM.room, unf = (i) => { const d = TILE[i].d * 0.55; return E.inout2(seg(t, R.unfold[0] + (R.unfold[1] - R.unfold[0]) * d, R.unfold[0] + (R.unfold[1] - R.unfold[0]) * (d + 0.45))); };
  const fold = (i) => E.inout2(seg(t, R.fold[0] + (R.fold[1] - R.fold[0]) * TILE[i].d * 0.5, R.fold[0] + (R.fold[1] - R.fold[0]) * (TILE[i].d * 0.5 + 0.5)));
  for (let i = 0; i < TILE.length; i++) {
    const u = unf(i) * (1 - fold(i)), T = TILE[i];
    const p = CHEST.map((c, k) => c + (T.p[k] - c) * u + (k === 1 ? Math.sin(Math.PI * u) * 1.2 : 0));
    instance(tiles, i, p, null, 0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(TS * 0.94 * Math.max(0.02, u), 1, TS * 0.94 * Math.max(0.02, u)));
    tiles.setMatrixAt(i, m);
  }
  tiles.instanceMatrix.needsUpdate = true;
  const co = seg(t, R.court - 0.1, R.court + 0.6) * (1 - seg(t, R.fold[0], R.fold[0] + 0.6)); COURT.visible = co > 0.01; lineMat.emissiveIntensity = 0.5 * co; COURT.scale.setScalar(1);
  COURT.children.forEach((m) => { m.scale.y = 1; m.visible = co > 0.01; });
  const br = FILM.breaths.reduce((a, b) => Math.max(a, t >= b && t < b + 4 ? Math.sin(Math.PI * Math.min(1, (t - b) / 2.4)) : 0), 0);
  torso.scale.set(1 + 0.04 * br, 1, 0.62 * (1 + 0.08 * br));
};

// ════ the exit (the tease): a white cell pressed into a seam in a vessel wall ═══════════════════════
const liningMat = mat("#E9B3A8", "lining", { fres: 0.35 });
for (const s of [-1, 1]) { const C = cutaway({ radius: 9, noise: { amp: 0.1, freq: 1.4, seed: 60 + s }, segments: [56, 40], material: liningMat }); C.group.position.set(8.6 * s, -6, 0); C.group.scale.set(1, 0.42, 0.8); G.exit.add(C.group); }
const wbcMat = mat("#F3EEE4", "wbc", { fres: 0.45, ei: 0.05 });
const WBC = cutaway({ radius: 6, noise: { amp: 0.16, freq: 2.0, seed: 3 }, segments: [64, 48], material: wbcMat });
G.exit.add(WBC.group);
const writeExit = (t) => { const u = E.inout2(seg(t, FILM.exit.push[0], FILM.exit.push[1])); WBC.group.position.set(0, 1.2 - 3.4 * u, 0); WBC.group.scale.set(1 - 0.32 * u, 1 + 0.4 * u, 1 - 0.1 * u); };

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 500 3vmin/1.35 var(--font-text); color: var(--text-2); }
.mi-spine { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
.mi-spine .v { color: var(--pulse); } .mi-spine .lb { color: var(--text); }
#hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-tally .lb { color: var(--text); }
`; document.head.appendChild(css);
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const wp = (k, p) => [p[0] + PLACE[k][0], p[1] + PLACE[k][1], p[2] + PLACE[k][2]];
const ANCH = {
  sac: () => HC[3].c.clone().add(new THREE.Vector3(0, HC[3].r, 0)).toArray(),
  flesh: () => FLESHM.group.position.clone().add(new THREE.Vector3(HS.r * 2.4, HS.r * 1.6, 0)).toArray(),
  cap: () => { const s = HC[2]; return s.c.clone().add(new THREE.Vector3(-s.r, s.r * 0.3, 0.3)).toArray(); },
  air: () => wp("wall", [-6, 4, 0]),
  rbc: () => wp("wall", [4.6, 2.8, 0]),
  head: () => wp("room", [0.15, 1.7, 0]),
  court: () => wp("room", [1.6 - 10.97 / 2, 0.05, 8]),
  wbc: () => wp("exit", [3, 4, 2]),
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: "tl" });
for (const sp of FILM.spine) {
  const fmt = sp.text ? () => sp.text : (v) => String(Math.round(v));
  const o = sp.keys ? { keys: sp.keys, ease: "lin" } : { value: () => 0 };
  hud.counter(sp.id, { ...o, fmt, unit: sp.unit, label: sp.label, t0: sp.t0, t1: sp.t1, at: [0.5, 0.31], minCh: 1 }).classList.add("mi-spine");
}
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: (v) => v.toFixed(FILM.tally.fmt), unit: FILM.tally.unit, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.5, 0.31], minCh: 3 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 430 * S1, h: 232 * S1, region: FILM.loc.region });

// ── focus: targets in each place (camera keys are in each place's own frame) ─────────────────────
const TARGETS = { sac: () => HS.c.toArray(), tree: () => [0, 120, 0], wall: () => [1, 0, 0], chest: () => CHEST, floor: () => [1.6, 0, 0], wbc: () => [0, 0, 0] };
const placeOf = (shot) => (shot === "loop" ? "lung" : shot);
window.CINEMA_FOCUS = (t) => {
  const shot = shotOf(t), F = focusAt(FILM.foc[shot] || FILM.foc.lung, t, { targets: TARGETS }), o = PLACE[placeOf(shot)];
  return { ...F, point: [F.point[0] + o[0], F.point[1] + o[1], F.point[2] + o[2]] };
};

// ── the probe ───────────────────────────────────────────────────────────────────────────────────
const NEAR = { lung: 0.6, wall: 3, room: 0.6, exit: 4 };
const PRB = Object.fromEntries(Object.keys(NEAR).map((k) => [k, probe(THREE, { W, H, near: NEAR[k], ndc: 1.15 })]));
const STATIC = {
  lung: [...HC.map((s) => s.c.toArray()), [0, 40, 0], [0, 120, 0], [30, 80, -20], [-30, 60, 10]],
  wall: [[0, 0, 0], [0, 8, 0], [0, -8, 0], [5.6, -1, 0], [-6, 3, 0], [-6, -3, 0]].map((p) => wp("wall", p)),
  room: [[0, 1.2, 0], [0, 0, 0], [4, 0, 4], [-4, 0, -4], [5, 0, -6], [-3, 0, 7]].map((p) => wp("room", p)),
  exit: [[0, 0, 0], [8, -6, 0], [-8, -6, 0]].map((p) => wp("exit", p)),
};
let TIER_KMAX = null;
const camAt = (shot, t) => {   // camera keys are in the place's own frame; offset them into the world
  const o = PLACE[placeOf(shot)];
  placeCamera(camera, FILM.cam[shot], t, { handheld: 0 });
  camera.position.x += o[0]; camera.position.y += o[1]; camera.position.z += o[2];
  const d = new THREE.Vector3(); camera.getWorldDirection(d); camera.lookAt(camera.position.clone().add(d)); camera.updateMatrixWorld();
};

// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const shot = shotOf(t), pl = placeOf(shot), C = window.CINEMA, tt = shot === "loop" ? 0 : t;
  for (const [k, g] of Object.entries(G)) g.visible = k === pl;
  camAt(shot, t);
  camera.near = pl === "room" ? 0.05 : pl === "lung" ? 0.1 : 0.3; camera.far = 20000; camera.updateProjectionMatrix();
  if (pl === "lung") writeLung(tt);
  if (pl === "wall") writeWall(t);
  if (pl === "room") writeRoom(t);
  if (pl === "exit") writeExit(t);
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  scene.fog.density = 0.25 / Math.max(pl === "room" ? 6 : 3, fd);
  hud.update(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  LOC.update(t, presence(t, FILM.loc.t0, FILM.loc.t1, { d: 0.45, out: 0.35 }).o, beatAmp(t, FILM.breaths, { decay: 1.2 }));
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    const P = PRB[pl]; P.begin(camera);
    STATIC[pl].forEach((p, i) => P.add(`s${i}`, p));
    if (pl === "room") for (let i = 0; i < TILE.length; i += 23) { const m = new THREE.Matrix4(); tiles.getMatrixAt(i, m); P.add(`t${i}`, new THREE.Vector3().setFromMatrixPosition(m).add(new THREE.Vector3(...PLACE.room)).toArray()); }
    if (pl === "wall") for (let i = 0; i < WO.n; i += 5) { const m = new THREE.Matrix4(); woM.getMatrixAt(i, m); P.add(`o${i}`, new THREE.Vector3().setFromMatrixPosition(m).add(new THREE.Vector3(...PLACE.wall)).toArray()); }
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
