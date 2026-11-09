// Reality Rulebook · Season 2 · Episode 5, "Listen to the cup fill" (films/channels/physics/ep11): the picture, a pure function of t.
// A cutaway mug (R = 4 cm, 10 cm of inside height), water filling it, the empty space drawn as a pipe closed at the water end with its air as
// layers that move at f / 300 (badged), a scope strip of the sound, and a chart in the measure beat. Pitch is the paper's f = c / (4 (l + 0.62 R)).
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, M = FILM.mug, ES = FILM.endShow;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12, shutter: 0 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink: "#1B1E24", ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
cyc.wall.visible = false; cyc.floor.scale.set(3, 1, 3);
cyc.uniforms.uCyl.value.set(40, 200, 1e6);
cyc.group.position.y = -12.6;   // the bench sits below the scope strip, so the strip is not hidden by the floor
window.SCENE_READY = P.ready;

// ── physics ──
const R = M.R, HH = M.H, SLOW = M.slow, CC = M.c, BETA = M.beta;
const pitchOf = (level) => CC / (4 * ((HH - level) + BETA * R));
const levelAt = (t) => keyed(FILM.level, t, "lin");
const fvis = (t) => pitchOf(levelAt(t)) / SLOW;                     // the air layers' visible rate: f / 300
// the phase of the air layers, integrated so the rate can change smoothly (a table: seek stays pure)
const PH = [0]; { const dt = 1 / 120; for (let k = 0; k < Math.ceil((FILM.dur + 1) / dt); k++) PH.push(PH[k] + 2 * Math.PI * fvis(k * dt) * dt); }
const phaseAt = (t) => { const x = Math.max(0, t) * 120, i = Math.min(PH.length - 2, Math.floor(x)); return PH[i] + (PH[i + 1] - PH[i]) * (x - i); };
// the two pipes (why): a long and a short one; the long one is shortened by a plug (as a flute player does)
const RP = 1.6, pitchPipe = (L) => CC / (4 * (L + BETA * RP));
const plugAt = (t) => { const [a, b] = FILM.fluteT; return 6.0 * E.inout3(seg(t, a, b)); };    // the plug's height in the long pipe (cm)
const PIPEH = 10, SHORT = 4;
const pipeL = (t) => PIPEH - plugAt(t);
const phasePipe = (t, L) => 2 * Math.PI * (pitchPipe(L) / SLOW) * t;     // good enough for a pipe whose length changes slowly

// ── the mug (a cutaway: half a shell behind, cut faces at z = 0) ──
const ceramic = new THREE.MeshStandardMaterial({ color: 0xf3eee3, roughness: 0.38, side: THREE.DoubleSide });
const mug = new THREE.Group(); scene.add(mug);
{ const prof = [[0.01, -0.6], [4.5, -0.6], [4.5, 10], [4.0, 10], [4.0, 0], [0.01, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 48, Math.PI / 2, Math.PI), ceramic); mug.add(shell);
  for (const x of [-4.25, 4.25]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.6, 0.06), ceramic); w.position.set(x, 4.7, 0.0); mug.add(w); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 0.06), ceramic); base.position.set(0, -0.3, 0); mug.add(base);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdcd5c6, roughness: 0.5 });
  for (const x of [-4.25, 4.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), rimMat); r.position.set(x, 10.0, 0.03); mug.add(r); } }
// water: a half-cylinder behind the cut and a translucent face on the cut
const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x73aee0, transparent: true, opacity: 0.55, roughness: 0.08, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
const waterBody = new THREE.Mesh(new THREE.CylinderGeometry(3.97, 3.97, 1, 48, 1, false, Math.PI / 2, Math.PI), waterMat); mug.add(waterBody);
const waterFace = new THREE.Mesh(new THREE.PlaneGeometry(7.94, 1), new THREE.MeshBasicMaterial({ color: flat("#6FA8DC"), transparent: true, opacity: 0.5, depthWrite: false })); waterFace.position.z = 0.05; mug.add(waterFace);
const surfLine = new THREE.Mesh(new THREE.BoxGeometry(7.94, 0.09, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff })); surfLine.position.z = 0.09; mug.add(surfLine);
// the empty space as a pipe: a tint, side lines, a closed end at the water, and the air layers
const airTint = new THREE.Mesh(new THREE.PlaneGeometry(7.94, 1), new THREE.MeshBasicMaterial({ color: flat(HEX.motion), transparent: true, opacity: 0.11, depthWrite: false })); airTint.position.z = 0.04; mug.add(airTint);
const pipeSideMat = new THREE.MeshBasicMaterial({ color: flat(HEX.motion), transparent: true });
const pipeSides = [-3.97, 3.97].map((x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), pipeSideMat); m.position.set(x, 0, 0.1); mug.add(m); return m; });
const capMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force) });
const closedEnd = new THREE.Mesh(new THREE.BoxGeometry(7.94, 0.16, 0.1), capMat); closedEnd.position.z = 0.1; mug.add(closedEnd);
const NAIR = 13, layerMat = new THREE.MeshBasicMaterial({ color: flat("#0B7A5C") });
const layers = []; for (let i = 0; i < NAIR; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.14, 0.12), layerMat); m.position.z = 0.12; mug.add(m); layers.push(m); }
// the bracket that measures the empty space (l)
const brMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const bracket = new THREE.Group(); mug.add(bracket);
const brLine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), brMat); bracket.add(brLine);
const brTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), brMat), brBot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), brMat); bracket.add(brTop, brBot);
bracket.position.set(-5.6, 0, 0.1);
// the stream from a spout on the right, and its ripples
const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.5 });
const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.0, 20), metal); spout.rotation.z = Math.PI / 2; spout.position.set(7.0, 12.6, 0.1); mug.add(spout);
const spoutCap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), metal); spoutCap.position.set(8.5, 12.6, 0.1); mug.add(spoutCap);
const spoutTip = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.7, 20), metal); spoutTip.position.set(6.2, 12.35, 0.1); mug.add(spoutTip);
const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xa9d0ee, transparent: true, opacity: 0.85, roughness: 0.05, depthWrite: false });
const NS = 60, stream = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), streamMat, NS); stream.frustumCulled = false; stream.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mug.add(stream);
const sm = new THREE.Matrix4(), sp = new THREE.Vector3(), ss = new THREE.Vector3(1, 1, 1), sq = new THREE.Quaternion();
const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.rotation.x = Math.PI / 2; mug.add(m); return m; });

// ── the two pipes (why) ──
const pipes = new THREE.Group(); scene.add(pipes); pipes.visible = false;
const mkPipe = (x, Lmax) => { const g = new THREE.Group(); g.position.x = x; pipes.add(g);
  const tint = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ color: flat(HEX.motion), transparent: true, opacity: 0.12, depthWrite: false })); tint.position.z = 0.04; g.add(tint);
  const sides = [-1.6, 1.6].map((sx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1, 0.09), pipeSideMat); m.position.set(sx, 0, 0.08); g.add(m); return m; });
  const frame = [-1.75, 1.75].map((sx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, Lmax + 0.7, 0.3), ceramic); m.position.set(sx, (Lmax - 0.6) / 2 + 0.0, 0.0); g.add(m); return m; });
  const plug = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 0.35), new THREE.MeshBasicMaterial({ color: flat(HEX.force) })); plug.position.z = 0.1; g.add(plug);
  const lay = []; for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.13, 0.12), layerMat); m.position.z = 0.12; g.add(m); lay.push(m); }
  return { g, tint, sides, plug, lay, frame }; };
const pipeA = mkPipe(-4.8, PIPEH), pipeB = mkPipe(4.8, PIPEH);

// ── the scope strip (below the caption): the sound as a wave, then the chart ──
const panel = new THREE.Group(); panel.position.set(0, -8.2, 1.2); scene.add(panel);
const card = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 6.2), new THREE.MeshBasicMaterial({ color: flat("#F6F1E6") })); card.position.z = -0.05; panel.add(card);
const cardEdge = new THREE.Mesh(new THREE.PlaneGeometry(17.8, 6.4), new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) })); cardEdge.position.z = -0.09; panel.add(cardEdge);
const mkRibbon = (n, color) => { const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = 2 * i, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); } g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; panel.add(m); return { m, pos, n, g }; };
const setRibbon = (rb, pts, w) => { for (let i = 0; i < rb.n; i++) { const [x, y] = pts[Math.min(i, pts.length - 1)]; rb.pos.set([x, y + w, 0, x, y - w, 0], i * 6); } rb.g.attributes.position.needsUpdate = true; };
const NW = 220, wave1 = mkRibbon(NW, flat("#0B7A5C")), wave2 = mkRibbon(NW, flat("#B8321A"));
const chartCurve = mkRibbon(120, flat("#1B1E24"));
// chart: x = water level 0..8 cm (left to right), y = pitch 600..2000 Hz
const CX0 = -6.8, CX1 = 7.4, CY0 = -2.2, CY1 = 2.3, LV1 = 8.0, F0 = 600, F1 = 2000;
const cxOf = (lv) => CX0 + (CX1 - CX0) * lv / LV1, cyOf = (f) => CY0 + (CY1 - CY0) * (f - F0) / (F1 - F0);
const axisMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const axes = new THREE.Group(); panel.add(axes);
{ const ax = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0 + 0.4, 0.07, 0.05), axisMat); ax.position.set((CX0 + CX1) / 2, CY0 - 0.3, 0.02); axes.add(ax);
  const ay = new THREE.Mesh(new THREE.BoxGeometry(0.07, CY1 - CY0 + 0.6, 0.05), axisMat); ay.position.set(CX0 - 0.3, (CY0 + CY1) / 2, 0.02); axes.add(ay); }
const dotMat0 = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) }), dotMat1 = new THREE.MeshBasicMaterial({ color: flat(HEX.energy) });
const dot0 = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), dotMat0), dot1 = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), dotMat1);
dot0.position.set(cxOf(0), cyOf(pitchOf(0)), 0.06); dot1.position.set(cxOf(8), cyOf(pitchOf(8)), 0.06); panel.add(dot0, dot1);
const mkTag = (text, w, h, x, y) => { const cv = document.createElement("canvas"); cv.width = 512; cv.height = Math.round(512 * h / w); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.set(x, y, 0.08); panel.add(m);
  const draw = () => { const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = "#1B1E24"; g.font = `600 ${Math.round(cv.height * 0.55)}px "IBM Plex Sans", sans-serif`; g.textBaseline = "middle"; g.fillText(text, 8, cv.height / 2); tex.needsUpdate = true; };
  if (window.FONTS_READY) window.FONTS_READY.then(draw); else draw(); return m; };
const tagSound = mkTag("sound", 4.6, 1.1, -6.2, 2.35), tagTen = mkTag("10 cm of space: 687 Hz", 7.4, 1.1, 0, 0), tagTwo = mkTag("2 cm: 1,914 Hz", 5.6, 1.1, 0, 0);
tagTen.position.set(cxOf(0) + 3.9, cyOf(pitchOf(0)) + 0.9, 0.08); tagTwo.position.set(cxOf(8) - 3.2, cyOf(pitchOf(8)) - 0.6, 0.08);

// ── the rain (tease): a cloud and drops falling past a height ruler ──
const rain = new THREE.Group(); scene.add(rain); rain.visible = false;
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: 0.9 });
for (const [x, y, s] of [[-6.5, 9.8, 1.5], [-3.9, 10.5, 1.9], [-0.7, 10.1, 1.7], [1.9, 9.6, 1.3], [-2.1, 9.2, 1.6]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 18), cloudMat); m.position.set(x, y, -1); rain.add(m); }
const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x7db4e6, transparent: true, opacity: 0.9, roughness: 0.05, clearcoat: 1 });
const drops = [0, 1, 2, 3].map((k) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), dropMat); rain.add(m); return m; });
const streaks = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), new THREE.MeshBasicMaterial({ color: 0xcfe2f4, transparent: true, opacity: 0.55 })); rain.add(m); return m; });
const ruler = new THREE.Group(); rain.add(ruler);
{ const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 24, 0.1), axisMat); bar.position.set(-9.0, 4, 0); ruler.add(bar);
  for (let y = -8; y <= 16; y += 2) { const t = new THREE.Mesh(new THREE.BoxGeometry(y % 4 === 0 ? 1.2 : 0.7, 0.08, 0.1), axisMat); t.position.set(-9.0 + (y % 4 === 0 ? 0.6 : 0.35), y, 0); ruler.add(t); } }

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
window.CINEMA_FOCUS = () => ({ point: [0, 4, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const worldOfMug = (x, y, z = 0.2) => new THREE.Vector3(x, y, z).toArray();
const anchorFn = (an) => {
  if (an === "water") return (t) => worldOfMug(-1.5, levelAt(t) + 0.5);
  if (an === "air") return (t) => worldOfMug(3.2, levelAt(t) + (HH - levelAt(t)) / 2);
  if (an === "airtop") return () => worldOfMug(0, 9.9);
  if (an === "pipeL") return (t) => worldOfMug(-4.8, plugAt(t) + pipeL(t) * 0.5);
  if (an === "pipeR") return () => worldOfMug(4.8, 8.2);
  return () => [0, 0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const hzFmt = (v) => Math.round(v).toLocaleString("en-US");
FILM.spine.forEach((SPN, i) => { const o = { value: (t) => pitchOf(levelAt(t)), fmt: hzFmt, unit: "Hz", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 4 }, el = hud.counter(i ? "spine" + (i + 1) : "spine", o); placeSpine(o, el, hud, W, H, FILM.spineAt); });
const endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });

window.seek = function (t) {
  stage(t);
  placeCam(t);
  const T = FILM.cue.cuts, inPipes = t >= CUE.pipes[0] && t < CUE.pipes[1], inRain = t >= T.tease, inChart = t >= CUE.chart[0] && t < CUE.chart[1];
  mug.visible = !inPipes && !inRain; pipes.visible = inPipes; rain.visible = inRain; panel.visible = !inRain;
  const lv = Math.max(0, levelAt(t)), l = HH - lv, ph = phaseAt(t);
  if (mug.visible) {
    const lvS = Math.max(0.001, lv), lS = Math.max(0.001, l);
    waterBody.scale.y = lvS; waterBody.position.y = lv / 2; waterFace.scale.y = lvS; waterFace.position.y = lv / 2; surfLine.position.y = lv; surfLine.visible = lv > 0.02;
    airTint.scale.y = lS; airTint.position.y = lv + l / 2; closedEnd.position.y = lv;
    pipeSides[0].scale.y = lS; pipeSides[1].scale.y = lS; pipeSides[0].position.y = pipeSides[1].position.y = lv + l / 2;
    for (let i = 0; i < NAIR; i++) { const z = ((i + 0.5) / NAIR) * l, d = 0.55 * Math.sin((Math.PI * z) / (2 * l)) * Math.sin(ph) * Math.min(1, l / 3); layers[i].position.y = lv + z + d; layers[i].visible = l > 0.4; }
    brLine.scale.y = lS; bracket.position.y = lv + l / 2; brTop.position.y = l / 2; brBot.position.y = -l / 2;
    for (let i = 0; i < NS; i++) { const u = i / (NS - 1), x = 6.2 - 2.7 * Math.pow(u, 1.5), y = 12.1 - (12.1 - lv) * u * u; sp.set(x, y, 0.1); sm.compose(sp, sq, ss); stream.setMatrixAt(i, sm); } stream.instanceMatrix.needsUpdate = true;
    ripples.forEach((m, k) => { const q = (t * 1.3 + k / 3) % 1; m.position.set(3.5, lv + 0.04, 0.1); m.scale.setScalar(0.3 + q * 1.9); m.material.opacity = 0.8 * (1 - q); });
  }
  if (inPipes) {
    const pl = plugAt(t), Ls = [PIPEH - pl, SHORT];
    [[pipeA, pl, Ls[0]], [pipeB, PIPEH - SHORT, Ls[1]]].forEach(([p, plug, L], j) => {
      p.tint.scale.y = L; p.tint.position.y = plug + L / 2; p.sides.forEach((s) => { s.scale.y = L; s.position.y = plug + L / 2; }); p.plug.position.y = plug;
      p.lay.forEach((m, i) => { const z = ((i + 0.5) / p.lay.length) * L, d = 0.5 * Math.sin((Math.PI * z) / (2 * L)) * Math.sin(phasePipe(t, L)); m.position.y = plug + z + d; });
    });
  }
  // the scope strip or the chart
  const showWave = !inRain && !inChart;
  wave1.m.visible = showWave; wave2.m.visible = showWave && inPipes; tagSound.visible = showWave;
  axes.visible = inChart; chartCurve.m.visible = inChart; dot0.visible = dot1.visible = inChart;
  tagTen.visible = inChart && t >= FILM.tagT[0]; tagTwo.visible = inChart && t >= FILM.tagT[1];
  if (showWave) {
    const f1 = inPipes ? pitchPipe(pipeL(t)) : pitchOf(lv), f2 = pitchPipe(SHORT), pts1 = [], pts2 = [];
    for (let i = 0; i < NW; i++) { const x = -8 + 16 * i / (NW - 1);
      pts1.push([x, (inPipes ? 1.1 : 0) + (inPipes ? 0.75 : 1.5) * Math.sin(2 * Math.PI * (f1 / 220) * (x + 8) / 16 - (inPipes ? phasePipe(t, pipeL(t)) : ph) * 3)]);
      pts2.push([x, -1.4 + 0.75 * Math.sin(2 * Math.PI * (f2 / 220) * (x + 8) / 16 - phasePipe(t, SHORT) * 3)]); }
    setRibbon(wave1, pts1, 0.09); setRibbon(wave2, pts2, 0.09);
  }
  if (inChart) {
    const lim = Math.min(LV1, lv), pts = []; for (let i = 0; i < 120; i++) { const q = LV1 * i / 119, lvq = Math.min(q, lim); pts.push([cxOf(lvq), cyOf(pitchOf(lvq))]); }
    setRibbon(chartCurve, pts, 0.1);
  }
  // the rain
  if (inRain) {
    drops.forEach((m, k) => { const q = ((t - T.tease) * 0.42 + k / 4) % 1, y = 8.6 - 20 * Math.pow(q, 1.35), x = [-7.6, -6.2, 6.2, 7.6][k];
      m.position.set(x, y, 0); m.scale.set(1, 1.25, 1); const s = streaks[k]; const len = 1.5 + 4.5 * q; s.scale.set(1, len, 1); s.position.set(x, y + 0.6 + len / 2, 0); s.visible = q > 0.02; });
  }
  cyc.update({ grid: 1, casters: [] });
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};
// the self-check: boxes of the things on screen
window.OBJ_RECTS = () => {
  const out = [], V = new THREE.Vector3();
  const box = (n, pts) => { let l = 1e9, r = -1e9, tp = 1e9, b = -1e9; for (const [x, y, z] of pts) { V.set(x, y, z).project(camera); const px = (V.x * 0.5 + 0.5) * W, py = (1 - (V.y * 0.5 + 0.5)) * H; l = Math.min(l, px); r = Math.max(r, px); tp = Math.min(tp, py); b = Math.max(b, py); } out.push({ n, l, r, t: tp, b }); };
  if (mug.visible) { box("mug", [[-4.5, -0.6, 0], [4.5, -0.6, 0], [-4.5, 10, 0], [4.5, 10, 0]]); box("spout", [[5.7, 11.8, 0], [9.0, 13.2, 0]]); box("bracket", [[-6.1, 0, 0], [-5.1, 10, 0]]); }
  if (pipes.visible) box("pipes", [[-6.6, -0.3, 0], [6.6, -0.3, 0], [-6.6, 10.4, 0], [6.6, 10.4, 0]]);
  if (panel.visible) box("panel", [[-8.9, -11.3, 1.2], [8.9, -11.3, 1.2], [-8.9, -5.1, 1.2], [8.9, -5.1, 1.2]]);
  if (rain.visible) { box("cloud", [[-8, 8.4, -1], [3.2, 12, -1]]); drops.forEach((m, k) => { const p = m.position; box("drop" + k, [[p.x - 0.5, p.y - 0.7, 0], [p.x + 0.5, p.y + 0.7, 0]]); }); }
  return out;
};
