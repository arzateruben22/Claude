// Reality Rulebook No. 008, "Spaghetti never breaks in two" (films/channels/physics/ep08): the picture, a pure function of t.
// An illustration drawn after published results (Audoly and Neukirch 2005; Heisser et al. 2018), not a simulation: the stick
// is a circular arc held at both ends; at the break the pieces relax and fly in a stylised way (ends stay in the hands).
// Everything timed comes from film.json (compile.py). τ is each take's own phase: [-1, 0] the twist, [0, 1] the bend, above 1
// the time after the first break.
import * as THREE from "three";
import { stage, seg, E, ease, shotAt, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createCyc } from "../set/cyc.js";
import { createProps } from "../set/props.js";
import { dropTitle } from "../set/title.js";
import { SPINE_CSS, placeSpine } from "../set/spine.js";
import { acesInv } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, TK = (window.THEME && window.THEME.tokens) || {};
const CUE = FILM.cue, EC = FILM.endCard, SK = FILM.stick;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.sortObjects = false;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 2.6, bloom: 0.35, fstop: 0, kMax: 12 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 2, 4000);
const HEX = { ink2: TK["ink-2"] || "#4B505B", energy: TK.energy || "#B8321A", force: TK.force || "#1F3BD1", motion: TK.motion || "#08805A", ghost: "#55585F", stick: "#8F6A1F" };
const flat = (hex) => new THREE.Color().setRGB(...acesInv(hex));
const cyc = createCyc({ W, H, tokens: TK });
const P = createProps({ tokens: TK });
P.rig.group.visible = false; P.stick.visible = false;
scene.add(cyc.group, P.group);
window.SCENE_READY = P.ready;

// ── the stick ──
const { L, thetaMax: TH, Y0, rad: RAD, g: GR, fall: FALL, wave: WV } = SK;
const arcPt = (s, th) => {                                     // a point on the held arc: bend angle th at each end
  if (th < 1e-4) return { x: s - L / 2, y: Y0, a: 0 };
  const R = L / (2 * th), phi = -th + s / R;
  return { x: R * Math.sin(phi), y: Y0 + R * (Math.cos(phi) - Math.cos(th)), a: -phi };      // a: the tangent's angle from +x
};
const takeAt = (t) => FILM.takes.find((k) => t >= k.t0 && t < k.t1) || FILM.takes[FILM.takes.length - 1];
const tauAt = (t) => keyed(takeAt(t).keys, t, "lin");
const breaksOf = (tk) => (tk.breaks === "casc" ? SK.casc : SK.single);
const bendOf = (tau) => Math.min(1, Math.max(0, tau)) ;
const twistOf = (tk, tau) => (tk.phimax ? (tau < 0 ? tk.phimax * (1 + tau) : tk.phimax) : 0);    // degrees

// pieces: split the held stick at each break, in time order; free pieces fly, end pieces stay in the hands
const relax = (dt) => 0.12 + 0.88 * Math.exp(-dt / 0.2);
function pieceList(tk, tau) {
  const post = tau - 1;
  const bs = breaksOf(tk).filter(([, dt]) => post >= dt);
  const cuts = [0, ...bs.map(([f]) => f * L).sort((a, b) => a - b), L];
  const ps = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1], mid = (s0 + s1) / 2;
    const born = Math.max(...breaksOf(tk).filter(([f, dt]) => post >= dt && (Math.abs(f * L - s0) < 1e-6 || Math.abs(f * L - s1) < 1e-6)).map(([, dt]) => dt), 0);
    ps.push({ s0, s1, mid, born, endL: i === 0, endR: i + 2 === cuts.length });
  }
  return ps;
}
const wig = (u, dtp) => 0.5 * Math.exp(-dtp / 0.22) * Math.sin(9 * u + 22 * dtp);
// the points of one piece at post-break time dtp (post = τ − 1), as {x, y, s}
function shape(pc, tk, post) {
  const n = Math.max(5, Math.round(((pc.s1 - pc.s0) / L) * 70)), out = [];
  const l = pc.s1 - pc.s0, dtp = Math.max(0, post - pc.born), r = relax(Math.max(0, post));
  const R = L / (2 * TH);
  if (pc.endL || pc.endR) {                                   // in the hand: relaxes toward hanging
    const dir = pc.endL ? 1 : -1, anchor = arcPt(pc.endL ? 0 : L, TH), e = 1 - Math.exp(-Math.max(0, post) / 0.25);
    let x = anchor.x, y = anchor.y;
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * l, sg = pc.endL ? u : L - u;
      const h0 = arcPt(sg, TH).a + (pc.endL ? 0 : Math.PI);
      const h = h0 + (-Math.PI / 2 - h0 + (pc.endL ? 0 : -0)) * e * 0.0 + (((-Math.PI / 2 - ((h0 + Math.PI) % (2 * Math.PI) - Math.PI)) * e)) + wig(u / l, post);
      out.push({ x, y, s: sg });
      x += Math.cos(h) * (l / n); y += Math.sin(h) * (l / n);
    }
    return out;
  }
  // a free piece: an arc about its middle, moving and turning
  const mA = arcPt(pc.mid, TH), kick = (pc.mid > L / 2 ? 1 : -1) * (0.6 + 0.9 * Math.abs(pc.mid - L / 2) / L) * 12;
  const spin = (pc.mid > L / 2 ? -1 : 1) * 2.4 * (0.5 + Math.abs(pc.mid - L / 2) / L);
  const cx = mA.x + kick * dtp, cy = Math.max(Y0 - FALL, mA.y + 14 * dtp - 0.5 * GR * dtp * dtp);
  const ang = mA.a + spin * dtp;
  let px = 0, py = 0; const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * l - l / 2;
    pts.push([u, -(1 / R) * r * u * 0 + 0]);
  }
  // integrate the heading about the middle: heading(u) = ang - kappa u + wiggle
  const kap = (1 / R) * r; const hd = (u) => ang - kap * u + wig(u / l, dtp);
  const half = []; let ax = 0, ay = 0; half[Math.floor(n / 2)] = [0, 0];
  const mi = Math.floor(n / 2), du = l / n;
  const xs = new Array(n + 1), ys = new Array(n + 1); xs[mi] = 0; ys[mi] = 0;
  for (let i = mi + 1; i <= n; i++) { const u = ((i - 0.5) / n) * l - l / 2; xs[i] = xs[i - 1] + Math.cos(hd(u)) * du; ys[i] = ys[i - 1] + Math.sin(hd(u)) * du; }
  for (let i = mi - 1; i >= 0; i--) { const u = ((i + 0.5) / n) * l - l / 2; xs[i] = xs[i + 1] - Math.cos(hd(u)) * du; ys[i] = ys[i + 1] - Math.sin(hd(u)) * du; }
  const mx = xs.reduce((a, b) => a + b, 0) / (n + 1), my = ys.reduce((a, b) => a + b, 0) / (n + 1);
  for (let i = 0; i <= n; i++) out.push({ x: cx + xs[i] - mx, y: cy + ys[i] - my, s: pc.s0 + (i / n) * l });
  return out;
}
// the whole stick at (tk, τ): a list of polylines
function sticks(tk, tau) {
  if (tau < 1) {
    const th = TH * bendOf(tau), n = 64, pts = [];
    for (let i = 0; i <= n; i++) { const s = (i / n) * L, p = arcPt(s, th); pts.push({ x: p.x, y: p.y, s }); }
    return [pts];
  }
  return pieceList(tk, tau).map((pc) => shape(pc, tk, tau - 1));
}

// ── drawing: a pool of cylinders for the segments, spheres along a helix for the twist stripe, clamps, break marks ──
const POOL = 190;
const segGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
const segs = [];
for (let i = 0; i < POOL; i++) {
  const m = new THREE.Mesh(segGeo, new THREE.MeshBasicMaterial({ color: flat(HEX.stick) }));
  m.visible = false; scene.add(m); segs.push(m);
}
const up = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), dirv = new THREE.Vector3();
const COL_STICK = flat(HEX.stick), COL_RIP = flat(HEX.energy), tmpc = new THREE.Color();
const NST = 110, stripeGeo = new THREE.SphereGeometry(0.62, 8, 6), stripes = [];
const stripeMat = new THREE.MeshBasicMaterial({ color: flat(HEX.force) });
for (let i = 0; i < NST; i++) { const m = new THREE.Mesh(stripeGeo, stripeMat); m.visible = false; scene.add(m); stripes.push(m); }
const clampMat = new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) });
const clampL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.2, 3.4), clampMat), clampR = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.2, 3.4), clampMat);
const tickL = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 3.0), flat(HEX.force) && new THREE.MeshBasicMaterial({ color: flat(HEX.force) }));
scene.add(clampL, clampR);
const markMat = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true });
const markGeo = new THREE.TorusGeometry(1.5, 0.2, 8, 28);
const marks = [0, 1, 2].map(() => { const m = new THREE.Mesh(markGeo, markMat.clone()); m.visible = false; scene.add(m); return m; });

function drawStick(t) {
  const tk = takeAt(t), tau = tauAt(t), lines = sticks(tk, tau);
  const post = tau - 1;
  let k = 0; const allPts = [];
  for (const pts of lines) {
    for (let i = 0; i + 1 < pts.length && k < POOL; i++) {
      const a = pts[i], b = pts[i + 1], m = segs[k++];
      v1.set(a.x, a.y, 0); v2.set(b.x, b.y, 0); dirv.subVectors(v2, v1);
      const len = dirv.length(); if (len < 1e-6) { k--; continue; }
      m.visible = true; m.position.copy(v1).add(v2).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, dirv.normalize()); m.scale.set(RAD, len * 1.02, RAD);
      // the ripple: a band of red running out from the first break
      let amt = 0;
      if (tau > 1 && t >= CUE.ripple[0] - 0.2 && t < CUE.ripple[1]) {
        const sMid = (a.s + b.s) / 2, d = Math.abs(sMid - L / 2), front = WV * L * Math.max(0, post);
        amt = Math.max(0, 1 - Math.abs(d - front) / (0.06 * L)) * (post < 0.55 ? 1 : 0);
      }
      m.material.color.copy(tmpc.copy(COL_STICK).lerp(COL_RIP, amt));
    }
    allPts.push(pts);
  }
  for (; k < POOL; k++) segs[k].visible = false;
  // the twist stripe: spheres on a helix about the stick's own line
  const tw = twistOf(tk, tau) * Math.PI / 180;
  let n = 0;
  if (tw > 0.02) {
    for (let j = 0; j < NST; j++) {
      const s = ((j + 0.5) / NST) * L;
      let found = null;
      for (const pts of allPts) { const i = pts.findIndex((p, ii) => ii + 1 < pts.length && s >= p.s - 1e-9 && s <= pts[ii + 1].s + 1e-9); if (i >= 0) { found = [pts[i], pts[i + 1]]; break; } }
      const m = stripes[j];
      if (!found) { m.visible = false; continue; }
      const [a, b] = found, u = (s - a.s) / Math.max(1e-6, b.s - a.s);
      const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      const ph = tw * (s / L) * 1.0, rr = RAD * 1.45;
      m.visible = true; m.position.set(x + nx * rr * Math.cos(ph), y + ny * rr * Math.cos(ph), rr * Math.sin(ph));
    }
  } else stripes.forEach((m) => { m.visible = false; });
  // the hands: they hold the ends (closer as the bend grows)
  const th = tau < 1 ? TH * bendOf(tau) : TH, eL = arcPt(0, th), eR = arcPt(L, th);
  clampL.position.set(eL.x - 1.2, eL.y - 1.6, 0); clampR.position.set(eR.x + 1.2, eR.y - 1.6, 0);
  // the break marks (rings that flash at the break and fade)
  const br = breaksOf(tk);
  marks.forEach((mk, i) => {
    const b = br[i], on = b && tau > 1 && post >= b[1] && post - b[1] < 0.5 && t >= (tk.t0 + 0.0);
    mk.visible = !!on;
    if (on) { const p = arcPt(b[0] * L, TH), age = (post - b[1]) / 0.5; mk.position.set(p.x, p.y, 0.6); mk.scale.setScalar(1 + 1.6 * age); mk.material.opacity = 1 - age; }
  });
}
const piecesAt = (t) => { const tk = takeAt(t), tau = tauAt(t); return tau < 1 ? 1 : pieceList(tk, tau).length; };

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
window.CINEMA_FOCUS = () => ({ point: [0, Y0, 0], fstop: 0 });

// ── the overlay ──
const hud = createHud({ camera, captionY: FILM.captionY });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const dropT = dropTitle(titleEl, { sig: FILM.title.sig, fps: FILM.fps });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const PB = FILM.piecesBadge;
hud.badge(PB.id, { kind: "tag", slot: PB.slot, t0: PB.t0, t1: PB.t1, text: (t) => { const tk = takeAt(t); return twistOf(tk, tauAt(t)) >= PB.thr ? "Bend it now: two pieces" : "Bend it now: three or more"; } });
const anchorFn = (an) => {
  if (an === "stick") return (t) => { const th = tauAt(t) < 1 ? TH * bendOf(tauAt(t)) : TH, p = arcPt(L / 2, th); return [p.x, p.y + 1, 0]; };
  if (an === "end") return (t) => { const th = TH * bendOf(tauAt(t)), p = arcPt(0, th); return [p.x - 1, p.y, 0]; };
  if (an === "ripple") return (t) => { const post = tauAt(t) - 1, p = arcPt(Math.min(L, L / 2 - WV * L * Math.max(0, post)), TH); return [p.x, p.y + 1, 0]; };
  const m = /^b(\d)$/.exec(an);
  if (m) { const b = SK.casc[+m[1] - 1], p = arcPt(b[0] * L, TH); return () => [p.x, p.y + 2, 0]; }
  return () => [0, Y0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: false });
const SPN = FILM.spine;
const spineAt = (t) => SPN.find((s) => t >= s.t0 && t < s.t1) || (t < SPN[0].t0 ? SPN[0] : SPN[SPN.length - 1]);
const spineVal = (t) => { const s = spineAt(t); return s.kind === "pieces" ? piecesAt(t) : s.kind === "twist" ? twistOf(takeAt(t), tauAt(t)) : s.v; };
const spineOpts = { value: spineVal, fmt: (v) => v.toFixed(0), unit: " ", label: SPN[0].label, t0: SPN[0].t0, t1: SPN[SPN.length - 1].t1, minCh: 3 }, counterEl = hud.counter("spine", spineOpts);
placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);
const counterLb = counterEl.querySelector(".lb"), counterU = counterEl.querySelector(".u"), counterV = counterEl.querySelector(".v");
const endEl = hud.end({ t0: EC - 0.3, d: 0.3, ...FILM.end });
const footEl = document.createElement("div"); footEl.className = "rf-foot"; footEl.textContent = FILM.end.foot; endEl.appendChild(footEl);
{ const st = document.createElement("style");
  st.textContent = SPINE_CSS + ".rf-foot { margin-top: 3.2vmin; max-width: 62vmin; font: 500 2.9vmin/1.35 var(--font-text); color: var(--ink-2, #4B505B); }";
  document.head.appendChild(st); }
const dropE = dropTitle(endEl, { sig: EC, fps: FILM.fps, head: ".t", fall: 90 });

window.seek = function (t) {
  stage(t);
  placeCam(t);
  drawStick(t);
  cyc.update({ grid: 1, casters: [[0, Y0 - 20, 0, 26]] });
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp); }
  hud.update(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp);
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
