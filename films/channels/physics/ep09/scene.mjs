// Reality Rulebook · Season 2 · Episode 3, "The nut that rises" (films/channels/physics/ep09): the picture, a pure function of t.
// The grains are a 2D soft-disc simulation run once (sim.mjs → sim.json → film.json); the film plays it 2× slower and says so.
// The arrows of the flow loop and the ghosts of the big ball are drawn on top. It is our model, not a measurement.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, SIM = FILM.sim, PR = SIM.params;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#6E6A62" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

// ── the simulation, read at film time t ──
const WC = PR.Wc, RS = PR.rs, RB = PR.rb, NP = SIM.xy[0].length / 2;
const simT = (t) => (t >= FILM.replay.t0 ? (t - FILM.replay.t0) * FILM.replay.rate : t / SIM.slow);   // the main run is 2× slower; from the measure beat a replay of the climb runs 1.6× faster
const frameAt = (t) => { const s = Math.min(SIM.xy.length - 1.001, Math.max(0, simT(t) / SIM.dt)), i = Math.floor(s); return [i, s - i]; };
const posAt = (t, n) => { const [i, u] = frameAt(t), a = SIM.xy[i], b = SIM.xy[i + 1]; return [a[2 * n] + (b[2 * n] - a[2 * n]) * u, a[2 * n + 1] + (b[2 * n + 1] - a[2 * n + 1]) * u]; };
const floorAt = (t) => { const [i, u] = frameAt(t); return SIM.floor[i] + (SIM.floor[i + 1] - SIM.floor[i]) * u; };

// ── the jar and the grains, drawn in 3-D from the 2-D simulation ──
// The simulation is flat (discs in a plane), so the jar is a thin cell one big nut deep: each small grain gets a fixed depth in the cell,
// a fixed random tumble that spins with its sideways motion, and a lumpy nut shape; the big nut is a ridged, dark nut. The picture is a 3-D
// drawing of a 2-D model (badged), not a 3-D simulation. The second jar (the reverse effect) is an illustration, also badged.
const DZ = 4.2, JH = 28, JX = FILM.rev.ox;
const hash = (n, k = 0) => { let x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const lumpy = (kind, seed) => {
  const g = new THREE.SphereGeometry(1, 28, 20), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 0.06 * Math.sin(3.1 * x + seed) * Math.sin(2.7 * y + 1.3 * seed) + 0.05 * Math.sin(4.3 * z + 2 * seed) * Math.cos(3.7 * x);
    let r = 1 + n, sx = 1, sy = 0.78, sz = 0.72;
    if (kind === 0) { r *= 1 - 0.16 * Math.exp(-((x / 0.3) ** 2)); sx = 1.0; sy = 0.72; sz = 0.7; }          // peanut: a waist
    else if (kind === 1) { r *= 1 - 0.22 * Math.abs(x) ** 3; sx = 1.0; sy = 0.66; sz = 0.5; }                      // almond: pointed
    else { sx = 0.9; sy = 0.86; sz = 0.84; }                                                                     // hazelnut
    pos.setXYZ(i, x * r * sx, y * r * sy, z * r * sz);
    const v = 0.82 + 0.18 * Math.sin(9 * x + 3 * seed) * Math.sin(8 * y) + 0.1 * Math.sin(11 * z + seed);
    col[3 * i] = v; col[3 * i + 1] = v * 0.97; col[3 * i + 2] = v * 0.93;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
};
const bigGeo = (light) => {
  const g = new THREE.SphereGeometry(1, 48, 32), pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (light) {                                         // the lighter ball: a smooth puffed ball
      const n = 1 + 0.025 * Math.sin(7 * x + 2) * Math.sin(6 * y) ; pos.setXYZ(i, x * n, y * n, z * n); const v = 0.9 + 0.08 * Math.sin(10 * z + 4 * x); col[3 * i] = v; col[3 * i + 1] = v; col[3 * i + 2] = v * 0.97; continue;
    }
    const th = Math.atan2(z, y), ridge = Math.cos(3 * th), taper = 1 - 0.1 * x * x;
    const r = (0.94 + 0.07 * ridge) * taper + 0.02 * Math.sin(12 * x) * Math.sin(9 * y + z);
    pos.setXYZ(i, x * r, y * r, z * r);
    const v = 0.78 + 0.22 * ridge * 0.5 + 0.1 * Math.sin(14 * x + 3 * y) * Math.sin(10 * z);
    col[3 * i] = v; col[3 * i + 1] = v * 0.95; col[3 * i + 2] = v * 0.9;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
};
const GEOS = [lumpy(0, 1.1), lumpy(1, 2.3), lumpy(2, 3.7)];
const TONES = ["#E2B160", "#C99347", "#EBC784"].map((h) => new THREE.Color(h));
const grainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.02, vertexColors: true });
const ballMatD = new THREE.MeshStandardMaterial({ color: new THREE.Color("#5A3A24"), roughness: 0.55, metalness: 0.0, vertexColors: true });
const ballMatL = new THREE.MeshStandardMaterial({ color: new THREE.Color("#F1E6CF"), roughness: 0.85, metalness: 0.0, vertexColors: true });
const ringMat = new THREE.MeshBasicMaterial({ color: flat("#1F3BD1") });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xd8efe9, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, depthWrite: false });
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xa9d6cc, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false });
const baseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#3B3F48"), roughness: 0.6 });
const sheenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false });
const mtx = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), eu = new THREE.Euler(), ax = new THREE.Vector3();
// a cell = a glass jar: grains (3 nut shapes), the big ball, a ring marker, a base that shakes with the floor
// no motion-blur accumulation: the shaken grains alias at 30 fps and the blur smears them into double rings
if (window.CINEMA) window.CINEMA.shutter = 0;
const mkCell = (ox, light) => {
  const jar = new THREE.Group(); jar.position.x = ox; scene.add(jar);
  const sub = new THREE.Group(); jar.add(sub);          // everything that shakes
  const idx = [[], [], []]; for (let i = 1; i < NP; i++) idx[(i - 1) % 3].push(i);
  const meshes = idx.map((list, k) => { const m = new THREE.InstancedMesh(GEOS[k], grainMat, list.length); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; list.forEach((n, j) => m.setColorAt(j, TONES[(n * 7) % 3])); m.instanceColor.needsUpdate = true; jar.add(m); return m; });
  const ball = new THREE.Mesh(bigGeo(light), light ? ballMatL : ballMatD); ball.scale.setScalar(RB); jar.add(ball);
  const spin = []; for (let i = 0; i < NP; i++) spin.push([hash(i, 1) * 6.28, hash(i, 2) * 6.28, hash(i, 3) * 6.28]);
  const zOf = (i) => (hash(i, 4) - 0.5) * 2 * (DZ - 1.5);
  const base = new THREE.Mesh(new THREE.BoxGeometry(WC + 1.8, 1.8, 2 * DZ + 1.6), baseMat); base.position.set(WC / 2, -0.9, 0); sub.add(base);
  for (const [x, z] of [[-0.3, -DZ - 0.3], [-0.3, DZ + 0.3], [WC + 0.3, -DZ - 0.3], [WC + 0.3, DZ + 0.3]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.5, JH + 1, 0.5), edgeMat); e.position.set(x, JH / 2, z); sub.add(e); }
  for (const z of [-DZ - 0.3, DZ + 0.3]) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(WC + 0.9, JH + 1), glassMat); pane.position.set(WC / 2, JH / 2, z); sub.add(pane); }
  for (const x of [-0.3, WC + 0.3]) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(2 * DZ + 0.6, JH + 1), glassMat); pane.rotation.y = Math.PI / 2; pane.position.set(x, JH / 2, 0); sub.add(pane); }
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, JH - 3), sheenMat); sheen.position.set(2.0, JH / 2, DZ + 0.4); sub.add(sheen);
  const sheen2 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, JH - 6), sheenMat); sheen2.position.set(3.1, JH / 2, DZ + 0.4); sub.add(sheen2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 48), ringMat); ring.scale.setScalar(RB * 1.05); jar.add(ring);
  const place = (get, bpos, shakeY) => {
    meshes.forEach((m, k) => { const list = idx[k]; for (let j = 0; j < list.length; j++) { const n = list[j], [x, y] = get(n), sp = spin[n];
      eu.set(sp[0] + y * 0.5, sp[1], sp[2] - x * 1.0); qa.setFromEuler(eu); p3.set(x, y, zOf(n)); const sz = RS * (0.92 + 0.14 * hash(n, 5)); s3.set(sz, sz, sz); mtx.compose(p3, qa, s3); m.setMatrixAt(j, mtx); } m.instanceMatrix.needsUpdate = true; });
    ball.position.set(bpos[0], bpos[1], 0); ball.rotation.set(0.4, 0.6, -bpos[0] * 0.2); ring.position.set(bpos[0], bpos[1], DZ + 1.6);
    sub.position.y = shakeY; };
  return { jar, ball, ring, place };
};
const cellA = mkCell(0, false), cellB = mkCell(JX, true);
const wallMat = baseMat;
// ruler beside the jar (measure): ticks every 5 cm from the floor
const rulerMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) }), ruler = new THREE.Group();
for (let c = 0; c <= 25; c += 5) { const w = c % 10 === 0 ? 2.4 : 1.5, tk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.4), rulerMat); tk.position.set(-w / 2 - 0.9, c, DZ + 1); ruler.add(tk); }
const rbar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 25, 0.4), rulerMat); rbar.position.set(-0.9, 12.5, DZ + 1); ruler.add(rbar);
scene.add(ruler);
// ghosts of the big ball every 3 s of simulation time (measure, takeaway)
const NG = 14, ghostMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ghost) }), ghosts = [];
for (let i = 0; i < NG; i++) { const g = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), ghostMat); g.visible = false; scene.add(g); ghosts.push(g); }   // a dot at the big ball's centre every 3 s of simulated shaking
const ghostPos = (k) => { const ts = CUE.ghosts.every * k, i = Math.min(SIM.xy.length - 1, Math.round(ts / SIM.dt)); return [SIM.xy[i][0], SIM.xy[i][1]]; };
// the flow loop (illustrated): arrows up along the walls and down the middle, in front of the glass
const arrowMat = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true }), arrowMat2 = new THREE.MeshBasicMaterial({ color: flat(HEX.force), transparent: true });
const mkArrow = (x, y0, y1, mat) => { const gr = new THREE.Group(), dir = Math.sign(y1 - y0), L = Math.abs(y1 - y0);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, L - 2.4, 10), mat); sh.position.set(0, (y0 + y1) / 2 - dir * 0.6, 0);
  const hd = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 12), mat); hd.position.set(0, y1 - dir * 1.2, 0); if (dir < 0) hd.rotation.z = Math.PI;
  gr.add(sh, hd); gr.position.set(x, 0, DZ + 1.2); scene.add(gr); return gr; };
const arrowsUp = [mkArrow(1.6, 3, 24, arrowMat), mkArrow(WC - 1.6, 3, 24, arrowMat)], arrowsDown = [mkArrow(WC / 2, 24, 3, arrowMat2)];
// the reverse-effect jar (illustration): a frozen snapshot of the bed with the lighter ball sunk by hand; grains are pushed aside
const SNAP = SIM.xy[FILM.rev.snap], BX0 = SNAP[0], BY0 = SNAP[1];
const revAt = (t) => {
  const u = Math.min(1, Math.max(0, (t - FILM.rev.t0) / (FILM.rev.t1 - FILM.rev.t0))), e = u * u * (3 - 2 * u);
  const bx = BX0 + (WC / 2 - BX0) * e, by = BY0 + (FILM.rev.yEnd - BY0) * e, min = RB + RS * 0.95;
  const gx = [], gy = [];
  for (let n = 1; n < NP; n++) {
    let x = SNAP[2 * n], y = SNAP[2 * n + 1], dx = x - bx, dy = y - by, d = Math.hypot(dx, dy);
    if (d < min) { const k = min / Math.max(d, 1e-3); x = bx + dx * k; y = by + dy * k; }
    gx[n] = Math.min(WC - RS, Math.max(RS, x)); gy[n] = Math.max(RS, y);
  }
  return { bx, by, gx, gy };
};

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
window.CINEMA_FOCUS = () => ({ point: [WC / 2, 14, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
hud.badge("hook-speed", { kind: "speed", slot: FILM.noteSlots.hook, t0: 0, t1: CUE.cuts.normal, text: () => FILM.speedNote });
hud.badge("speed", { kind: "speed", slot: FILM.noteSlots.speed, t0: CUE.cuts.normal, t1: FILM.speedEnd, text: () => FILM.speedNote });   // not while the illustration jar is on screen: a hand-moved ball has no speed
hud.badge("speed2", { kind: "speed", slot: FILM.noteSlots.speed, t0: FILM.replay.t0, t1: null, text: () => FILM.replay.note });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const anchorFn = (an) => {
  if (an === "ball") return (t) => { const [x, y] = posAt(t, 0); return [x + RB, y, DZ]; };
  if (an === "small") return () => [WC - 2.2, 17, DZ];
  if (an === "under") return (t) => { const [x, y] = posAt(t, 0); return [x + 1, y - RB - 1.2, DZ]; };
  if (an === "wallL") return () => [1.6, 22, DZ + 1];
  if (an === "mid") return () => [WC / 2, 12, DZ + 1];
  if (an === "ghost0") return () => { const [x, y] = ghostPos(0); return [x + RB + 1.4, y, DZ]; };
  if (an === "lball") return (t) => { const r = revAt(t); return [JX + r.bx + RB, r.by, DZ]; };
  return () => [WC / 2, 14, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const spineVal = (t) => posAt(t, 0)[1];   // the ball's CENTRE height, as in review/sim-trace.md (3.9 cm at the start)
const counterEls = FILM.spine.map((SPN, i) => { const o = { value: spineVal, fmt: (v) => v.toFixed(0), unit: "cm", label: SPN.label, t0: SPN.t0, t1: SPN.t1, minCh: 2 }, el = hud.counter(i ? "spine" + (i + 1) : "spine", o); placeSpine(o, el, hud, W, H, FILM.spineAt); return el; });
const ES = FILM.endShow, endEl = hud.end({ t0: ES - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: ES, fps: FILM.fps, head: ".t", fall: 90 });
const win = (t, w, fin = 0.5, fout = 0.4) => (w ? Math.min(E.out2(seg(t, w[0], w[0] + fin)), 1 - E.in2(seg(t, w[1] - fout, w[1]))) : 0);

window.seek = function (t) {
  stage(t);
  placeCam(t);
  const fl = floorAt(t);
  cellA.place((n) => posAt(t, n), posAt(t, 0), fl);
  const rv = revAt(t);
  cellB.place((n) => [rv.gx[n], rv.gy[n]], [rv.bx, rv.by], fl * 0.8);
  ruler.visible = t >= CUE.height[0] - 0.3 && t < CUE.cuts.tease;
  const ak = win(t, CUE.arrows);
  arrowsUp.forEach((a) => { a.visible = ak > 0.01; a.children.forEach((m) => { m.material.opacity = ak; }); });
  arrowsDown.forEach((a) => { a.visible = ak > 0.01; a.children.forEach((m) => { m.material.opacity = ak; }); });
  ghosts.forEach((g, k) => { const tk = CUE.ghosts.every * k; g.visible = t >= CUE.ghosts.t0 && t < CUE.ghosts.t1 && simT(t) >= tk + 0.1; if (g.visible) { const [gx, gy] = ghostPos(k); g.position.set(gx, gy, DZ + 1.7); } });
  cyc.update({ grid: 1, casters: [[WC / 2, 2, 0, 11], [JX + WC / 2, 2, 0, 11]] });
  dropT(t); dropE(t);
  hud.update(t);
  renderer.render(scene, camera);
};

// the self-check (kit audit does the text): where the 3-D objects land on the screen, for the render's own overlap pass
window.OBJ_RECTS = () => {
  const out = [], V = new THREE.Vector3();
  const scr = (x, y, z) => { V.set(x, y, z).project(camera); return [(V.x * 0.5 + 0.5) * W, (1 - (V.y * 0.5 + 0.5)) * H]; };
  for (const [name, cell] of [["ringA", cellA], ["ringB", cellB]]) {
    const p = cell.ring.position, x = cell.jar.position.x + p.x, y = p.y + cell.jar.position.y, c = scr(x, y, p.z), e = scr(x + RB * 1.05, y, p.z);
    const r = Math.hypot(e[0] - c[0], e[1] - c[1]); out.push({ n: name, cx: c[0], cy: c[1], r });
  }
  ghosts.forEach((g, k) => { if (g.visible) { const c = scr(g.position.x, g.position.y, g.position.z); out.push({ n: "dot" + k, cx: c[0], cy: c[1], r: 6 }); } });
  return out;
};
