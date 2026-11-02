import * as THREE from "three";
// Back of the Envelope No. 003, "All the ants" (films/channels/whatif/ep03). The picture as a pure function of t
// for the film kit's page (kits/cinema/film): window.seek(t) sets the shot, the camera, the balances, the heaps
// and the overlay from t alone, then makes exactly one renderer.render().
//
// One world on the graph-paper desk (1 unit = 1 cm; the ruling re-scales by tens with the camera, so the macro
// reads in millimetres): a pan balance with every ant on the left pan and every person on the right (heaps not to
// scale, badged), its beam leaning as the story weighs them (film.json "tilt"); the count sites dotted across the
// paper; one real ant on the millimetre ruling; a second balance (ants against every wild bird and mammal); one
// person among their ants; and back to the first ant (the loop). Everything timed comes from film.json.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createBalance, createAnt, shaded } from "../set/balance.js";
import { createFigure } from "../set/anchor.js";
import { createCrowd } from "../set/crowd.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";

const FILM = window.FILM, W = window.W, H = window.H, PH = FILM.phys, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 1e4);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 24, threshold: 0.9, bloom: 0.4, holdCuts: true });   // no frame blurs across a cut
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const keyed = (keys, t) => {
  let i = keys.findIndex((k) => k[0] > t);
  if (i < 0) return keys[keys.length - 1][1];
  if (i === 0) return keys[0][1];
  const [ta, va] = keys[i - 1], [tb, vb] = keys[i];
  return va + (vb - va) * E.inout2(seg(t, ta, tb));
};

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 70 });
scene.add(desk.group);
const bal = createBalance({ tokens: TK, span: 60, height: 40 });
const wild = createBalance({ tokens: TK, span: 60, height: 40, rightColor: TK["chalk-2"] || "#A7AAB2" });
scene.add(bal.group, wild.group);
const WILD_X = 95;
const ant = createAnt({ length: 0.5, color: "#7E8189" }), ant2 = createAnt({ length: 0.45 });
scene.add(ant.group, ant2.group);
const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.6, 8, 24), shaded(TK.anchor || "#4DA3FF", 0.6));   // a fingertip, true size beside the ant
tip.rotation.z = Math.PI / 2; tip.position.set(40.85 + 1.55, 0.78, 30); scene.add(tip);   // side-on, entering from the right, its tip ~5 mm from the ant
const you = createFigure({ tokens: TK, height: 170 });          // true height beside ants a few mm long: they are specks
scene.add(you.group);
const YOU = FILM.you, CP = FILM.carpet;
const carpet = createCrowd({ tokens: { ...TK, anchor: "#8C8F96" }, density: CP.density, dotR: 0.24, far: [0.03, 0.12], aniso: true });   // your ants, 5 mm apart: 2.44 million fill this square
carpet.mesh.material.depthTest = false; carpet.mesh.renderOrder = 1; you.group.traverse((o) => { o.renderOrder = 2; });   // over the paper, under you
carpet.group.position.set(YOU[0], 0.05, YOU[2]); carpet.set({ side: CP.side, opacity: 1 }); scene.add(carpet.group);
// the person's ants: a seeded swarm on the paper around them
const swarmMat = shaded("#5A5D64", 0.45);
const swarm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), swarmMat, 2400);
{
  const R = rng(73), m4 = new THREE.Matrix4();
  for (let i = 0; i < 2400; i++) {
    const a = R() * Math.PI * 2, r = 30 + Math.sqrt(R()) * 330;
    m4.makeScale(1.6, 0.8, 1); m4.setPosition(-260 + r * Math.cos(a), 0.1, 160 + r * Math.sin(a));
    swarm.setMatrixAt(i, m4);
  }
  swarm.frustumCulled = false; scene.add(swarm);
}
// the count sites: 489 seeded dots across the paper, lit one by one
const NS = 489, sites = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6, 1.6, 0.05, 12), shaded(TK.chalk || "#F4F2EC", 0.9), NS);
const SITE = [];
{
  const R = rng(5);
  for (let i = 0; i < NS; i++) {
    // clustered like real studies: around a few dozen centres
    const c = Math.floor(R() * 36), cr = rng(1000 + c);
    const cx = -170 + cr() * 340, cz = -260 + cr() * 520;
    SITE.push([cx + (R() - 0.5) * 40, cz + (R() - 0.5) * 40, R()]);
  }
  sites.frustumCulled = false; scene.add(sites);
}
const m4 = new THREE.Matrix4();
const showSites = (u) => {
  for (let i = 0; i < NS; i++) {
    const [x, z, k] = SITE[i], on = E.out3(Math.max(0, Math.min(1, (u - k * 0.85) / 0.15)));
    m4.makeScale(on + 1e-4, 1, on + 1e-4); m4.setPosition(x, 0.03, z); sites.setMatrixAt(i, m4);
  }
  sites.instanceMatrix.needsUpdate = true;
};

// ── camera and overlay ──────────────────────────────────────────────────────
const rig = createRig(FILM.cam);
const hud = createHud({ camera, shots: FILM.shots });
const S = { ant: [-110, 0.6, 60], left: [0, 0, 0], right: [0, 0, 0], site: [SITE[3][0], 0, SITE[3][1]], ant2: [40, 0.4, 30], tip: [40.95, 1.5, 30], wild: [0, 0, 0], you: [YOU[0], 175, YOU[2]] };
const KIND = { anchor: { color: "anchor", glyph: "◆", mark: "dot" }, part: { color: "chalk", glyph: "", mark: "bar" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "70vmin", margin: "4vmin auto 0" });   // readable on a phone (second builder's review, 2 Nov)
const box = endBox(endEl, { t0: FILM.endCard, answer: "≈ ⅕ of us", S1 });

window.seek = function (t) {
  const st = stage(t), shot = st.name;
  const P = rig.place(camera, shot, t);
  camera.near = Math.max(0.01, P.dist * 0.004); camera.far = P.dist * 60; camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const unit = Math.pow(10, Math.floor(Math.log10(Math.max(0.1, P.dist / 12))));
  desk.uniforms.uUnit.value = unit; desk.uniforms.uFar.value = Math.max(70, P.dist * 2.2);
  desk.update({ grid: 1, span: P.dist * 8, pool: [P.target[0], P.target[2]], casters: [[0, 40, 0, 12]] });

  // the main balance: heaps fill, the beam leans with the story
  bal.set({ tilt: keyed(FILM.tilt, t), left: keyed(FILM.fill.left, t), right: keyed(FILM.fill.right, t) });
  S.left = bal.panAt("left"); S.right = bal.panAt("right");
  // the wild balance swings in on "wild" and leans toward the ants
  const w = E.inout2(seg(t, CUE.wild, CUE.wild + 1.2));
  wild.group.visible = t >= CUE.wild - 0.1 && shot !== "home" && shot !== "end";   // never peeking in at the frame's edge on the way home
  wild.set({ x: WILD_X, tilt: PH.tilt_wild * w, left: 1, right: w });
  { const p = wild.panAt("right"); S.wild = [p[0], p[1] - 20, p[2]]; }   // under the right pan (its label hangs below it, clear of the chains and the beam)

  // the walking ants: one at the hook (and the loop), one on the millimetre ruling
  const WK = FILM.walk, ws = t <= WK.t1 ? WK.v * t : t >= WK.t2 ? WK.v * (t - WK.dur) : WK.v * WK.t1;
  ant.set({ at: [WK.p0[0] + WK.dir[0] * ws, 0, WK.p0[2] + WK.dir[1] * ws], heading: 0.5, step: (ws / 0.18) % 1 });   // legs keep pace with the ground
  S.ant = [WK.p0[0] + WK.dir[0] * ws, 0.6, WK.p0[2] + WK.dir[1] * ws];   // walking toward the balance
  ant2.set({ at: [40.1 + 0.08 * Math.sin(t), 0, 30], heading: 2.2, step: (t * 2.6) % 1 });
  you.set({ at: [YOU[0], 85, YOU[2]] });
  swarm.visible = false;
  carpet.group.visible = you.group.visible = shot === "each";
  showSites(shot === "sites" || shot === "tiny" ? seg(t, CUE.sites, CUE.twice) : 0);
  sites.visible = shot === "sites";
  tip.visible = shot === "tiny";

  hud.update(t);
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  box.update(t);
  renderer.render(scene, camera);
};
