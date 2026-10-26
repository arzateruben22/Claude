// Rest Frame No. 004, "The hammer and the feather" (films/channels/physics/ep04): the picture, a pure function of t.
// The channel's Bench (../set: the cyc, the Moon dressing, the hammer and the feather, ink drawings, the title drop)
// plus the kit's blocks (hud, clock, strobe, arrows). Everything timed comes from film.json (compile.py).
//
// The physics: both released from rest with their lowest points 160 cm up. On the Moon (162 cm/s², no air) both fall
// in 1.405 s, exactly together (closed form). On Earth the hammer falls freely (0.571 s); the feather's drift is an
// illustration (badged). The whoa's Earth, orbit and satellite are an ink illustration.
//
// WRITING.md "The picture" 8, one line wins: what the caption names is the brightest thing; whatever delivered the beat
// (or line) before steps back to about a third of its contrast on screen (FILM.dim, keyed on cuts and words in
// compile.py). The notes keep the channel's corners (the speed column top-left, the standing cheats top-right; the
// hook's speed note bottom-right, under the title drop) and the spine readout sits between and below them, in each
// shot's empty region (FILM.spineAt).
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { strobe } from "cinema/sci/strobe.js";
import { arrows } from "cinema/sci/arrows.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { createMoonFloor, createHammer, createFeather } from "../set/moon.js";
import { inkSet, hand } from "../set/ink.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { unlit, acesInv, hexRgb, ACES_INV_GLSL } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, DR = FILM.drop, TAKES = FILM.takes, EC = FILM.endCard;

// ── rule 8: stepping back. dimAt(name, t) is the strength (1 as built, a third stepped back), measured on screen: the
// displayed colour (sRGB, after the ACES curve the draft and the finish share) goes two-thirds of the way to the paper
// #E6E2D8, so a third of its contrast against the paper is left in either path. Unlit things (the ink, the arrows, the
// rungs) take the mixed hex through the ACES inverse (set/aces.js); the lit props and the ghost rows do the same mix in
// their shaders, after lighting and before tone mapping (rfToPaper: tone-map, mix, map back). At 1 nothing changes ──
const DIM = FILM.dim || {};
const dimAt = (name, t) => (DIM[name] ? keyed(DIM[name], t) : 1);
const INK_HEX = TK.ink || "#15171C", INK2_HEX = TK["ink-2"] || "#4B505B", FORCE_HEX = TK.force || "#1F3BD1", PAPER_HEX = TK.cyc || "#E6E2D8";
const mixHex = (a, b, u) => "#" + [1, 3, 5].map((i) => { const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16);
  return Math.round(x + (y - x) * u).toString(16).padStart(2, "0"); }).join("");
const stepped = (hex, k) => unlit(mixHex(hex, PAPER_HEX, 1 - k));   // an unlit colour at strength k, as a THREE.Color
const STEP_GLSL = ACES_INV_GLSL + `
uniform vec3 uPaperD;
vec3 rfAces(vec3 c) {   // three's ACESFilmicToneMapping at exposure 1 (the finish's cinAces): scene light to display-linear
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = IN * (c / 0.6); c = (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.4329510) + 0.238081);
  return clamp(OUT * c, 0.0, 1.0); }
vec3 rfEnc(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 rfToPaper(vec3 c, float fade) { return fade > 0.0 ? acesInv(srgbToLinear(mix(rfEnc(rfAces(c)), uPaperD, fade)), 1.0) : c; }
`;
const toPaper = (sh, fade) => {   // the fragment's lit colour → the paper on screen, by fade (a GLSL float expression)
  sh.uniforms.uPaperD = { value: new THREE.Vector3(...hexRgb(PAPER_HEX)) };
  sh.fragmentShader = STEP_GLSL + sh.fragmentShader.replace("#include <tonemapping_fragment>",
    `gl_FragColor.rgb = rfToPaper(gl_FragColor.rgb, ${fade});\n#include <tonemapping_fragment>`);
};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 5, 4000);

// ── the set ───────────────────────────────────────────────────────────────
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK, stickX: -46 });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;
// the regolith covers the whole visible floor: centred on the cyc's floor (x 40, z 200), its near edge is the floor's own
// (z 800, below every shot's frame) and the cove and the wall hide the rest of its edge
const moon = createMoonFloor({ size: 1200, x: 40, z: 200 }); scene.add(moon.group);
const hammer = createHammer(), feather = createFeather();
feather.scale.setScalar(1.35);                           // a falcon flight feather, about 32 cm
scene.add(hammer, feather);
// each prop steps back as one (FILM.dim "hammer", "drop"): every material of it mixes toward the paper by its uFade
const propFade = { hammer: { value: 0 }, feather: { value: 0 } };
for (const [obj, u] of [[hammer, propFade.hammer], [feather, propFade.feather]]) obj.traverse((m) => {
  if (!m.material) return;
  m.material.onBeforeCompile = (sh) => { sh.uniforms.uFade = u; toPaper(sh, "uFade"); sh.fragmentShader = "uniform float uFade;\n" + sh.fragmentShader; };
  m.material.customProgramCacheKey = () => "rf-prop-fade";
});
const HAM_LOW = 29.4;                                     // the hammer's origin (head centre) above its lowest point (the handle's end)

const clk = clock(FILM.clock, { words: { slow: "{n}× slower", fast: "{n}× faster", freeze: "paused" } });
const TAKE_NAMES = Object.keys(TAKES);
const takeAt = (t) => TAKE_NAMES.find((n) => t >= TAKES[n].t0 && t < TAKES[n].t1) || null;
const local = (take, t) => clk.tau(t) - TAKES[take].tauR;
// cm fallen: the Moon's closed form, Earth's free fall for the hammer, the feather's illustrated drift on Earth
const fallen = (world, which, tau) => {
  if (tau <= 0) return 0;
  if (world === "earth" && which === "feather") {
    const tc = DR.vt / DR.gE;
    return Math.min(DR.h0, tau < tc ? 0.5 * DR.gE * tau * tau : 0.5 * DR.gE * tc * tc + DR.vt * (tau - tc));
  }
  const g = world === "earth" ? DR.gE : DR.gM;
  return Math.min(DR.h0, 0.5 * g * tau * tau);
};
// the lowest point's height, and where each object's label anchors (the hammer's head, the feather's vane)
const objAt = (take, which, t) => {
  const tk = TAKES[take], tau = local(take, t), y = DR.h0 - fallen(tk.world, which, tau);
  if (which === "hammer") return [DR.xh, y + HAM_LOW, 0];
  const sway = tk.world === "earth" ? 4 * Math.sin(5 * Math.max(0, tau)) : 0;
  return [DR.xf + sway, y + 12, 0];
};

// ── ghost rows: beads at the hammer's head and the feather's middle, every 1/10 s (Moon) or 1/20 s (Earth) ──
// Each bead carries its own step-back (aFade, an instance attribute: the take's hammer row is slots 0–15, its feather
// row 16–31; the Earth's rows held through the change, FILM.hold, 32–47 and 48–63), mixed toward the paper after the
// rim, so a stepped-back bead loses its dark rim too. strobe() chains this onBeforeCompile ahead of its rim. The rungs
// (one take's at a time) share one colour, RUNG
const GMAX = 64, RUNG = unlit(INK2_HEX);
const ghostGeo = new THREE.SphereGeometry(1, 20, 14), ghostFade = new THREE.InstancedBufferAttribute(new Float32Array(GMAX), 1);
ghostGeo.setAttribute("aFade", ghostFade);
const ghostMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
ghostMat.onBeforeCompile = (sh) => {
  sh.vertexShader = "attribute float aFade;\nvarying float vFade;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvFade = aFade;");
  toPaper(sh, "vFade");
  sh.fragmentShader = "varying float vFade;\n" + sh.fragmentShader;
};
const S = strobe({ geometry: ghostGeo, radius: 1.6, max: GMAX, pop: 0.14,
  material: ghostMat, rim: { color: [0.045, 0.048, 0.055], width: 0.42, strength: 0.62 },
  rungs: { max: 16, radius: 0.22 }, park: [0, 60, 0] });
scene.add(S.group);
const HCOL = new THREE.Color().setRGB(0.42, 0.44, 0.47), FCOL = new THREE.Color().setRGB(0.36, 0.30, 0.24);
for (const name of TAKE_NAMES) {
  const tk = TAKES[name];
  if (!tk.stamps) continue;
  const earth = tk.world === "earth", dt = earth ? DR.dtE : DR.dt, n = earth ? DR.nE : DR.n;
  // the take's own rows; the Earth's are copied once more for the change (FILM.hold), where they stand at a third
  const rows = [[name, tk.t0, tk.t1, 0]].concat(earth && FILM.hold ? [["hold", FILM.hold.t0, FILM.hold.t1, 32]] : []);
  for (const [id, t0, t1, base] of rows) ["hammer", "feather"].forEach((which, j) => S.ladder(`${id}:${which}`, {
    at: (tau) => { const y = DR.h0 - fallen(tk.world, which, tau); return which === "hammer" ? [DR.xh, y + HAM_LOW, -2] : [DR.xf + (earth ? 4 * Math.sin(5 * tau) : 0), y + 12, -2]; },
    dt, n, when: (tau) => clk.tOf(tk.tauR + tau), t0, t1, slot: base + j * 16, color: which === "hammer" ? HCOL : FCOL,
  }));
  if (!earth) S.rung(`${name}:r`, { a: `${name}:feather`, b: `${name}:hammer`, k: [0, n - 1], slot: 0, color: RUNG, grow: 0.2 });
}

// ── the why's vectors: gravity's pull (force) and the acceleration (motion) ──
// FORCE (the pull arrows' colour) and the outline's ink are read by reference each update: the pull steps back by them
// (FILM.dim "pull"); the outline is shared by every arrow, so that table is back at 1 before the acceleration draws
const FORCE = unlit(FORCE_HEX), MOTION = unlit(TK.motion || "#08805A");
const AR = arrows({ max: 8, shaft: 0.6, head: [3.6, 1.6], outline: 0.34, ink: acesInv(INK_HEX), park: [0, 60, 0] });
const AR_INK = AR.meshes[2] ? AR.meshes[2].material : null;   // the outline hulls' one material (arrows.js)
scene.add(AR.group);
const HOLD = [TAKES.why.t0, TAKES.why.t1];
AR.add("pull-h", { tail: (t) => objAt("why", "hammer", t), vec: [0, -34, 0], color: FORCE, t0: CUE.why.pull, t1: CUE.why.inertia, slot: 0, hold: HOLD });
AR.add("pull-f", { tail: (t) => objAt("why", "feather", t), vec: [0, -1.2, 0], color: FORCE, t0: CUE.why.pull + 0.15, t1: CUE.why.inertia, slot: 1, hold: HOLD });
AR.add("acc-h", { tail: (t) => objAt("why", "hammer", t), vec: [0, -16, 0], color: MOTION, t0: CUE.why.acc[0], t1: CUE.why.acc[1], slot: 2, hold: HOLD });
AR.add("acc-f", { tail: (t) => objAt("why", "feather", t), vec: [0, -16, 0], color: MOTION, t0: CUE.why.acc[0] + 0.15, t1: CUE.why.acc[1], slot: 3, hold: HOLD });

// ── ink: two hands that held them (I: their own strength, FILM.dim "hands"), the whoa's Earth and orbit; each set
// steps back by its colour (opacity would blend in scene light under the finish and keep far less than a third) ──
const I = inkSet({ color: TK["ink-2"] || "#4B505B" });
const handH = hand(I, { x: DR.xh - 3.5, y: DR.h0 + HAM_LOW + 3.6, z: 2, scale: 0.9 });
const handF = hand(I, { x: DR.xf + 3.5, y: DR.h0 + 24 + 1.4, z: 2, scale: 0.9 }); handF.scale.x = -1;
scene.add(handH, handF);
// the Earth's ring, the orbit and the satellite (with its two metals, the accent) each in its own ink set, so each steps
// back on its own (FILM.dim "earthInk", "orbitInk"; the satellite stays full)
const IE = inkSet({ color: TK["ink-2"] || "#4B505B" }), IO = inkSet({ color: TK["ink-2"] || "#4B505B" });
const IS = inkSet({ color: TK["ink-2"] || "#4B505B", accent: TK.cobalt || "#1F3BD1" });
const space = new THREE.Group(); space.position.set(0, 190, -20);
const earthR = 46, orbitR = 51.1;                        // 710 km over 6,371 km, to scale
space.add(IE.ring(earthR, 1.2), IO.ring(orbitR, 0.45));
const sat = IS.poly([[-2.2, -1.4], [2.2, -1.4], [2.2, 1.4], [-2.2, 1.4]], 0.6, true); space.add(sat);
const masses = [IS.ring(0.9, 0.35, IS.accent), IS.ring(0.45, 0.3, IS.accent)]; masses.forEach((m) => sat.add(m));
scene.add(space);
const satAt = (t) => { const a = 1.2 + 0.9 * (t - CUE.whoa.orbit); return [orbitR * Math.cos(a), orbitR * Math.sin(a)]; };

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
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.look[0], c.look[1], c.look[2]);
  camera.updateMatrixWorld();
};
window.CINEMA_FOCUS = () => ({ point: [0, 80, 0], fstop: 0 });
const PROBE_PTS = [[-40, 160, 0], [40, 160, 0], [-40, 0, 0], [40, 0, 0], [0, 80, -60]].map((p) => new THREE.Vector3(...p));
const pv = new THREE.Vector3();

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
// the speed column, top-left: the clock's note in its windows (FILM.warpWindows: the why's leaves with the why's other
// notes); the hook's own speed note bottom-right (FILM.hookNote), clear of the title drop; the cheats top-right
(FILM.warpWindows || [[null, null]]).forEach(([w0, w1], k) => hud.badge(k ? `warp${k + 1}` : "warp", { from: clk, slot: "tl", t0: w0 ?? undefined, t1: w1 ?? null }));
{ const HN = FILM.hookNote;
  hud.badge("hook-speed", { kind: "speed", slot: HN.slot, t0: 0, t1: HN.paused[1], text: (t) => (t < HN.paused[0] ? HN.text[0] : HN.text[1]) }); }
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an.obj) return (t) => objAt(an.obj[0], an.obj[1], t);
  if (an.arrow) return (t) => AR.tip(an.arrow, t);
  if (an.sat) return (t) => { const s = satAt(t); return [s[0], 190 + s[1], -20]; };
  return () => an.point;
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.anchor), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed, v: lb.v });
// the spine readout: its step at t (label, wrap, unit, digits, lit window), set from t in seek before hud.update, so the
// plate is measured and placed (set/spine.js placeSpine, FILM.spineAt: a step at each cut) with this frame's text
const SP = FILM.spine;
const spineSeg = (t) => SP.find((s) => t >= s.t0 && t < s.t1) || (t < SP[0].t0 ? SP[0] : SP[SP.length - 1]);
const spineNum = (s, t) => (s.kind === "const" ? s.v : s.kind === "watch" ? Math.min(s.cap, Math.max(0, local(s.take, t))) : 0);
let spNow = SP[0], spLit = false;
const spineOpts = { value: (t) => spineNum(spNow, t), fmt: (v) => (spNow.kind === "text" ? spNow.text : v.toFixed(spNow.dp)), unit: "s",
  label: SP[0].label, t0: SP[0].t0, t1: SP[SP.length - 1].t1, minCh: 4, lit: () => spLit }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const foot = document.createElement("div"); foot.className = "rf-foot"; foot.textContent = FILM.end.foot; endEl.appendChild(foot);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS
    + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

// ── one frame ─────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  placeCam(t);
  const take = takeAt(t) || "loop", tk = TAKES[take], inSpace = tk.world === "space";
  // the Moon's regolith: on in the hook, off for Earth, faded in on "take the air away", on from then (not in space)
  const mk = take === "hook" ? 1 : take === "earth" ? 0 : take === "moon" ? E.inout2(seg(t, CUE.moon.fade[0], CUE.moon.fade[1])) : 1;
  moon.set(mk);
  const casters = [];
  const showObj = take !== "space";
  hammer.visible = feather.visible = showObj; handH.visible = handF.visible = showObj;
  // rule 8 (FILM.dim): the hammer and its row step back in the Earth take on "feather"; the measure's whole drop (both
  // props, both rows, the rung) on "On Earth"; the hands outside their drops; each back at full by the loop's frame
  const kDrop = dimAt("drop", t), kHam = Math.min(dimAt("hammer", t), kDrop);
  propFade.hammer.value = 1 - kHam; propFade.feather.value = 1 - kDrop;
  ghostFade.array.fill(1 - kHam, 0, 16); ghostFade.array.fill(1 - kDrop, 16, 32);
  ghostFade.array.fill(1 - dimAt("earthRowH", t), 32, 48); ghostFade.array.fill(1 - dimAt("earthRowF", t), 48, 64); ghostFade.needsUpdate = true;
  RUNG.copy(stepped(INK2_HEX, kDrop));
  I.mat.color.copy(stepped(INK2_HEX, dimAt("hands", t)));
  IE.mat.color.copy(stepped(INK2_HEX, dimAt("earthInk", t))); IO.mat.color.copy(stepped(INK2_HEX, dimAt("orbitInk", t)));   // the satellite (IS) stays full
  // the why's pull arrows step back on "But" (their fill and the outline; nothing else draws an arrow then)
  { const kp = dimAt("pull", t); FORCE.copy(stepped(FORCE_HEX, kp)); if (AR_INK) AR_INK.color.setRGB(...acesInv(mixHex(INK_HEX, PAPER_HEX, 1 - kp))); }
  if (showObj) {
    const h = objAt(take, "hammer", t), fe = objAt(take, "feather", t), tau = local(take, t);
    hammer.position.set(...h);
    // the hammer tips over once it lands (an illustration: the fall itself is exact)
    const tl = (tk.world === "earth" ? DR.tE : DR.tM);
    const tip = Math.min(1, Math.max(0, (tau - tl) / 0.35));
    hammer.rotation.z = -1.45 * E.in2(tip);
    hammer.position.x = DR.xh + Math.sin(1.45 * E.in2(tip)) * HAM_LOW; hammer.position.y = h[1] - (1 - Math.cos(1.45 * E.in2(tip))) * HAM_LOW + 0.0;
    feather.position.set(fe[0], fe[1] - 12, 0);
    feather.rotation.z = tk.world === "earth" ? 0.3 * Math.sin(5 * Math.max(0, tau) + 1) * Math.min(1, Math.max(0, tau) * 4) : 0.08;
    casters.push([hammer.position.x, hammer.position.y - 10, 0, 6], [fe[0], fe[1] - 6, 0, 3]);
  }
  space.visible = inSpace;
  if (inSpace) {
    const s = satAt(t); sat.position.set(s[0], s[1], 0); sat.rotation.z = Math.atan2(s[1], s[0]);
  }
  S.update(t); AR.update(t);
  cyc.update({ grid: 1, casters });
  if (window.CINEMA && window.CINEMA.mode === "probe") {
    PROBE_PTS.forEach((p, i) => {
      pv.copy(p).project(camera);
      if (Math.abs(pv.x) <= 1.15 && Math.abs(pv.y) <= 1.15 && pv.z < 1) window.CINEMA.probe.set("bench" + i, [(pv.x + 1) * 0.5 * W, (1 - pv.y) * 0.5 * H]);
    });
  }
  dropT(t); dropE(t);
  spNow = spineSeg(t); spLit = !!(spNow.lit && t >= spNow.lit[0] && t < spNow.lit[1]);
  counterLb.textContent = spNow.label; counterU.textContent = spNow.unit; counterV.style.minWidth = (spNow.minCh ?? 4) + "ch";
  counterLb.style.maxWidth = spNow.wrap ? spNow.wrap + "vmin" : "";   // this step's wrap: a wrapped label's box is the wrap's width
  hud.update(t);   // writes the value through fmt (this step's digits or text), measures the plate, places it, lights it
  renderer.render(scene, camera);
};
