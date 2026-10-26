// Rest Frame No. 001, "Thrown or dropped?" (films/channels/physics/ep01): the picture, a pure function of t.
// The set is the channel's reusable Bench (../set: the cyc, the props, the closed-form motion, the title
// drop, the ruler readouts) plus the kit's shared blocks (kits/cinema/sci: hud, clock, strobe, arrows).
// Everything timed comes from film.json, which compile.py hangs on the spoken words: the time warp, the
// takes (each release solved back from the word its landing lands on), labels, badges, readouts, camera.
//
// The physics is exact and closed-form (set/bench.js): g = 981 cm/s², a 100 cm drop, level throws at
// 0.44 / 0.89 / 1.33 m/s, air ignored (badged, with the size of what it leaves out). Ghosts are stamped at
// the true positions every 1/20 s of scene time, so every gap on screen is the real one.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { ballAt, R_BALL } from "../set/bench.js";
import { dropTitle } from "../set/title.js";
import { createReadouts } from "../set/readout.js";
import { unlit, acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, BENCH = FILM.bench, TAKES = FILM.takes, EC = FILM.endCard;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
// draw in scene-graph order: three sorts opaque objects by program id, which depends on which material compiled first,
// so the draw order (and the last bit of a few pixels) would depend on the frames sought before this one
renderer.sortObjects = false;
// the finish (absent on the plain path): bloom only above 2.5 (the cyc's brightest token needs 1.88), deep focus,
// and real-time bursts capped at K 12 (bible §5). The draft tier lowers kMax to 6 after load.
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK, stickX: BENCH.stickX });
scene.add(cyc.group, P.group);
P.rig.place({ x0: -8, x1: 0, gatesAt: [-8, 0] });
window.SCENE_READY = P.ready;

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || null;
const ballSpec = (take, id) => TAKES[take].balls.find((b) => b.id === id);
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;                 // scene seconds since the take's release
const ballPos = (take, id, t) => ballAt(local(take, t), ballSpec(take, id));

// the live balls: a pool of four, shown for the current take only (the measure segment reads the record)
const balls = Array.from({ length: 4 }, () => { const m = P.ball(); scene.add(m); return m; });

// the strobe ladders: one per ball per take, all on one opaque InstancedMesh; rungs on a second
const GZ = 2;                                            // ghosts sit 2 cm behind the live balls' plane, so a ball always wins where it overlaps its fresh ghost
const INK2 = unlit(TK["ink-2"] || "#4B505B");
const S = strobe({
  geometry: new THREE.SphereGeometry(1, 28, 18), radius: R_BALL * 0.985, max: 48, pop: 0.2,
  material: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 },
  rungs: { max: 24, radius: 0.3 }, park: [10, 50, 0],
});
scene.add(S.group);
for (const name of TAKE_NAMES) {
  const tk = TAKES[name];
  tk.balls.forEach((b, j) => S.ladder(`${name}:${b.id}`, {
    at: (tau) => { const p = ballAt(tau, b); return [p[0], p[1], p[2] - GZ]; }, dt: BENCH.dt, n: BENCH.n, when: (tau) => clk.tOf(tk.tauR + tau),
    t0: tk.t0, t1: tk.keep ? Infinity : tk.t1, slot: j * BENCH.n, color: P.ghostColor,
  }));
}
S.rung("change:land", { a: "change:drop", b: "change:t44", k: [9, 9], at: () => CUE.change.L, grow: 0.22, slot: 0, color: INK2 });
S.rung("why:r", { a: "why:drop", b: "why:t44", k: [0, 9], at: (k) => CUE.why.rungs + 0.11 * k, grow: 0.3, slot: 0, color: INK2 });
S.rung("whoa:r", { a: "whoa:drop", b: "whoa:t133", k: [0, 9], slot: 0, color: INK2, grow: 0.3,
  at: (k) => Math.max(CUE.whoa.rungs + 0.1 * k, S.stampAt("whoa:t133", k) + 0.15) });
const rungPt = (take, k, u) => {
  const a = S.ghost(`${take}:drop`, k), b = S.ghost(take === "why" ? "why:t44" : "whoa:t133", k);
  return [a[0] + (b[0] - a[0]) * u, a[1], a[2] + (b[2] - a[2]) * u];
};

// "a steady glide across": small pegs on the floor under each ghost of the throw, equally spaced
const pegGeo = new THREE.CylinderGeometry(1, 1, 1, 12); pegGeo.translate(0, 0.5, 0);
const PEG = strobe({ geometry: pegGeo, material: new THREE.MeshBasicMaterial({ color: 0xffffff }), max: 12, pop: 0.16, park: [10, 50, 0] });
scene.add(PEG.group);
{
  const tk = TAKES.why, b = ballSpec("why", "t44");
  PEG.ladder("why:pegs", { at: (tau) => [b.x0 + b.vx * tau, 0, -GZ], dt: BENCH.dt, n: BENCH.n, scale: [0.42, 3.4, 0.42],
    when: (tau) => Math.max(CUE.why.glide + tau * 1.6, clk.tOf(tk.tauR + tau) + 0.05), t0: tk.t0, t1: tk.t1, slot: 0, color: INK2 });
}

// "Old gunnery books drew cannonballs flying straight, then dropping": the 1500s drawing, dotted (film.json cue.why.old),
// drawn on along its path from "drew" and taken back from its end as the real glide starts
const OLD = CUE.why.old, OLDN = OLD.pts.length;
const oldMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), OLDN);
oldMesh.frustumCulled = false;
for (let i = 0; i < OLDN; i++) oldMesh.setColorAt(i, INK2);
scene.add(oldMesh);
const om = new THREE.Matrix4(), oq = new THREE.Quaternion(), os = new THREE.Vector3(), op = new THREE.Vector3();
const oldUpdate = (t) => {
  for (let i = 0; i < OLDN; i++) {
    const a = OLD.drew + (1.5 * i) / OLDN, b = OLD.out + (0.35 * (OLDN - 1 - i)) / OLDN;
    const k = t < a ? 0 : Math.min(E.back(seg(t, a, a + 0.16)), 1 - E.in3(seg(t, b, b + 0.2)));
    const r = 0.95 * Math.max(0, k), at = r > 0 ? OLD.pts[i] : [10, 50, 0];   // parked inside the set when hidden (the probe reads it)
    om.compose(op.set(at[0], at[1], at[2]), oq, os.set(r, r, r));
    oldMesh.setMatrixAt(i, om);
  }
  oldMesh.instanceMatrix.needsUpdate = true;
};

// the vectors: gravity (force), sideways speed and the gaps (motion); ink outlines
const FORCE = unlit(TK.force || "#1F3BD1"), MOTION = unlit(TK.motion || "#08805A");
const AR = arrows({ max: 24, shaft: 0.62, head: [3.6, 1.6], outline: 0.34, ink: acesInv(TK.ink || "#15171C"), park: [10, 50, 0] });
const HOLD = (take) => [TAKES[take] ? TAKES[take].t0 : CUE.cuts[take], TAKES[take] ? TAKES[take].t1 : Infinity];   // a slot stays put from cut to cut
scene.add(AR.group);
const gyk = (k) => BENCH.drop + BENCH.r - 0.5 * BENCH.g * (k * BENCH.dt) ** 2;           // ghost k's centre height
AR.add("nm-g", { tail: (t) => ballPos("normal", "drop", t), vec: [0, -20, 0], color: FORCE, t0: CUE.normal.gravity, t1: CUE.normal.gTip, slot: 9, hold: HOLD("normal") });
for (let k = 0; k < 9; k++) {
  AR.add(`nm-gap${k}`, { tail: [BENCH.gapX, gyk(k), 0], tip: [BENCH.gapX, gyk(k + 1), 0], color: MOTION, slot: k, grow: 0.25,
    t0: Math.max(CUE.normal.gaps + 0.09 * k, S.stampAt("normal:drop", k + 1) + 0.12), t1: CUE.cuts.change - 0.2, shrink: 0.15, hold: HOLD("normal") });
  AR.add(`ms-gap${k}`, { tail: [BENCH.gapX, gyk(k), 0], tip: [BENCH.gapX, gyk(k + 1), 0], color: MOTION, slot: k, grow: 0.22, t0: CUE.measure.gaps[k], hold: HOLD("measure") });
}
AR.add("wy-g-drop", { tail: (t) => ballPos("why", "drop", t), vec: [0, -20, 0], color: FORCE, t0: CUE.why.gravity, t1: CUE.why.gTip, slot: 10, hold: HOLD("why") });
AR.add("wy-g-t44", { tail: (t) => ballPos("why", "t44", t), vec: [0, -20, 0], color: FORCE, t0: CUE.why.gravity + 0.1, t1: CUE.why.gTip, slot: 11, hold: HOLD("why") });
AR.add("wy-v", { tail: (t) => { const p = ballPos("why", "t44", t); return [p[0] + R_BALL * 0.4, p[1], p[2]]; }, vec: [ballSpec("why", "t44").vx * 0.3, 0, 0],
  color: MOTION, t0: CUE.why.two, t1: CUE.why.contact, slot: 12, hold: HOLD("why") });

// ── camera: orbit keys per shot (film.json "cam"), level by default, the turn as a true arc ──
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
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.look[0], c.look[1], c.look[2]);
  camera.updateMatrixWorld();
  return c;
};
window.CINEMA_FOCUS = () => ({ point: [10, 50, 0], fstop: 0 });          // deep focus (bible §5)
// the camera's own motion, for the finish's probe: five points of the bench (cinema3d.js sees only mesh
// origins, and its own camera points read 0 px until probe2 lands)
const PROBE_PTS = [[-8, 100, 0], [60, 100, 0], [-8, 0, 0], [60, 0, 0], [26, 50, -60]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ───────────────────────────────────────────────────────────
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("warp", { from: clk, slot: "tr" });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot, maxW: b.maxW });
const anchorFn = (an) => {
  if (an.ball) return (t) => ballPos(an.ball[0], an.ball[1], t);
  if (an.gap) { const [take, k] = an.gap, x = ballSpec(take, "drop").x0 + (an.dx || 0); return () => [x, (gyk(k) + gyk(k + 1)) / 2, 0]; }
  if (an.arrow) return (t) => AR.tip(an.arrow, t);
  if (an.rung) return () => rungPt(an.rung[0], an.rung[1], an.u ?? 0.5);
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
// the measure segment's counter: nine gaps of 1/20 s, read as a stopwatch
const G = CUE.measure.gaps, nGaps = (t) => G.filter((x) => t >= x).length;
const counterEl = hud.counter("clock", { value: (t) => 0.05 * nGaps(t), fmt: (v) => v.toFixed(2), unit: "s", label: "0 gaps × 1/20 s",
  t0: CUE.measure.counter[0], t1: CUE.measure.counter[1], at: [0.69, 0.215], minCh: 4 });
const counterLb = counterEl.querySelector(".lb");
const RD = createReadouts({ project: hud.project });
for (const r of FILM.readouts) RD.add(r.id, { at: r.at, text: r.text, t0: r.t0, t1: r.t1 ?? null });
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
// the end card's one true-fact footnote (WRITING.md picture rule 6), styled as the channel's later episodes
if (FILM.end.foot) {
  const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
  const st = document.createElement("style");
  st.textContent = ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st);
}
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });
const hudCues = window.SCENE_CUES;
window.SCENE_CUES = () => { const c = hudCues(); return { ...c, events: [...c.events, ...RD.cues()].sort((a, b) => a.t - b.t) }; };

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t), casters = [[-40, 3, -6, 4.5], [BENCH.stickX, 2.4, 0, 2.4]];
  balls.forEach((m, i) => {
    const b = take ? TAKES[take].balls[i] : null;
    m.visible = !!b;
    if (b) { const p = ballAt(local(take, t), b); m.position.set(p[0], p[1], p[2]); casters.push([p[0], p[1], p[2], R_BALL]); }
  });
  P.rig.release(take ? local(take, t) : 1);
  S.update(t); PEG.update(t); AR.update(t); oldUpdate(t);
  cyc.update({ grid: 1, casters });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((p, i) => {                     // on-screen points only: what leaves the frame can't smear
      pv.copy(p).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  const n = nGaps(t);                                   // everything that changes a HUD part's size, before the HUD measures it
  counterLb.textContent = `${n} gap${n === 1 ? "" : "s"} × 1/20 s`;
  dropT(t); dropE(t);
  hud.update(t);
  counterEl.classList.toggle("lit", CUE.measure.lit.some(([a, b]) => t >= a && t < b));
  RD.update(t, 1 - E.out3(seg(t, EC - 0.3, EC)));
  renderer.render(scene, camera);
};
