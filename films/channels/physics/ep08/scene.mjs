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
const { L, thetaMax: TH, Y0, rad: RAD } = SK;
const SHELF = Y0 - 16, GV = 260, GAP = 0.8;                       // the shelf the loose pieces land on (cm), the flight's gravity, the gap a break opens (cm)
const arcPt = (s, th) => {                                     // a point on the held arc: bend angle th at each end
  if (th < 1e-4) return { x: s - L / 2, y: Y0, a: 0 };
  const R = L / (2 * th), phi = -th + s / R;
  return { x: R * Math.sin(phi), y: Y0 + R * (Math.cos(phi) - Math.cos(th)), a: -phi };      // a: the tangent's angle from +x
};
// an instance's state at film time t: [{ tk: { breaks, phimax }, tau, xo, key }]: one stick, or two side by side (the takeaway)
const takeAt = (t) => FILM.takes.find((k) => t >= k.t0 && t < k.t1) || FILM.takes[FILM.takes.length - 1];
const instsAt = (t) => {
  const tk = takeAt(t);
  if (tk.pair) return tk.pair.map((p, i) => ({ tk: p, tau: keyed(p.keys, t, "lin"), xo: p.xo, yo: p.yo || 0, i }));
  return [{ tk, tau: keyed(tk.keys, t, "lin"), xo: 0, yo: 0, i: 0 }];
};
const tauAt = (t) => instsAt(t)[0].tau;
const breaksOf = (tk) => (tk.breaks === "casc" ? SK.casc : SK.single);
const bendOf = (tau) => Math.min(1, Math.max(0, tau));
const twistOf = (tk, tau) => (tk.phimax ? (tau < 0 ? tk.phimax * (1 + tau) : tk.phimax) : 0);    // degrees
const normA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// pieces: split the held stick at each break, in time order; loose pieces fly, the end pieces stay in the hands
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
const wig = (u, dtp) => 0.4 * Math.exp(-dtp / 0.18) * Math.sin(9 * u + 26 * dtp);
const recoil = (dt) => Math.min(1.3, Math.max(0, 1 - Math.exp(-dt / 0.07) * Math.cos(9 * dt)));      // a fast spring-back with a little overshoot
function shape(pc, post) {
  const l0 = pc.s1 - pc.s0, dtp = Math.max(0, post - pc.born);
  const cutEnds = (pc.endL || pc.endR) ? 1 : 2;                // the ends a break opened a gap at
  const l = Math.max(2, l0 - GAP * cutEnds * (pc.born > 0 || post > 0 ? 1 : 0) * 0.5), n = Math.max(6, Math.round((l / L) * 64)), du = l / n, out = [];
  if (pc.endL || pc.endR) {                                    // in a hand: springs back from the break, then hangs
    const anchor = arcPt(pc.endL ? 0 : L, TH), e = recoil(Math.max(0, post));
    let x = anchor.x, y = anchor.y;
    for (let i = 0; i <= n; i++) {
      const u = i * du, sg = pc.endL ? u : L - u, h0 = normA(arcPt(sg, TH).a + (pc.endL ? 0 : Math.PI));
      const h = h0 + normA(-Math.PI / 2 - (pc.endL ? 0.35 : -0.35) * 0 - h0) * e + wig(u / l, post);
      out.push({ x, y, s: sg });
      x += Math.cos(h) * du; y += Math.sin(h) * du;
    }
    return out;
  }
  // a loose piece: flung outward, falling under gravity onto the shelf, turning, then lying flat
  const m = arcPt(pc.mid, TH), sgn = pc.mid > L / 2 ? 1 : -1, off = Math.abs(pc.mid - L / 2) / L;
  const vx = sgn * (14 + 30 * off), vy0 = 18, spin = -sgn * 4.2;
  const yEnd = SHELF + RAD * 1.2, disc = vy0 * vy0 + 2 * GV * (m.y - yEnd), tl = (vy0 + Math.sqrt(Math.max(0, disc))) / GV, tt = Math.min(dtp, tl);
  const cx = m.x + vx * tt, cy = m.y + vy0 * tt - 0.5 * GV * tt * tt;
  const angL = m.a + spin * tl, tgt = Math.round(angL / Math.PI) * Math.PI;
  const ang = dtp <= tl ? m.a + spin * dtp : angL + (tgt - angL) * (1 - Math.exp(-(dtp - tl) / 0.06));
  const kap = (1 / (L / (2 * TH))) * relax(Math.max(0, post));
  const hd = (u) => ang - kap * u + wig(u / l, dtp) * (dtp > tl ? 0.2 : 1);
  const xs = new Array(n + 1), ys = new Array(n + 1), mi = Math.floor(n / 2); xs[mi] = 0; ys[mi] = 0;
  for (let i = mi + 1; i <= n; i++) { const u = ((i - 0.5) / n) * l - l / 2; xs[i] = xs[i - 1] + Math.cos(hd(u)) * du; ys[i] = ys[i - 1] + Math.sin(hd(u)) * du; }
  for (let i = mi - 1; i >= 0; i--) { const u = ((i + 0.5) / n) * l - l / 2; xs[i] = xs[i + 1] - Math.cos(hd(u)) * du; ys[i] = ys[i + 1] - Math.sin(hd(u)) * du; }
  const mx = xs.reduce((a, b2) => a + b2, 0) / (n + 1), my = ys.reduce((a, b2) => a + b2, 0) / (n + 1);
  let lift = 0; if (dtp > tl) { const miny = Math.min(...ys.map((v) => cy + v - my)); lift = Math.max(0, yEnd - miny); }
  for (let i = 0; i <= n; i++) out.push({ x: cx + xs[i] - mx, y: cy + ys[i] - my + (dtp > tl ? lift * Math.min(1, (dtp - tl) / 0.06) : 0), s: pc.s0 + (i / n) * l });
  return out;
}
function sticks(tk, tau) {
  if (tau < 1) {
    const th = TH * bendOf(tau), n = 64, pts = [];
    for (let i = 0; i <= n; i++) { const s = (i / n) * L, p = arcPt(s, th); pts.push({ x: p.x, y: p.y, s }); }
    return [pts];
  }
  return pieceList(tk, tau).map((pc) => shape(pc, tau - 1));
}

// ── drawing: lit cylinders, two stripes (tubes) for the twist, stylised hands, break rings, the shelf ──
const POOL = 190;
const segGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
const woodMat = () => new THREE.MeshStandardMaterial({ color: flat(HEX.stick), roughness: 0.55, metalness: 0.0 });
const SKIN = flat("#D8A58B");
const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
const up = new THREE.Vector3(0, 1, 0), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), dirv = new THREE.Vector3();
const COL_STICK = flat(HEX.stick), COL_RIP = flat(HEX.energy), tmpc = new THREE.Color();
function makeHand() {                                          // local +x points away from the stick: a fist round the stick's end, a thumb, a wrist, a forearm
  const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner);
  const fist = new THREE.Mesh(new THREE.CapsuleGeometry(2.1, 2.2, 6, 14), skinMat); fist.rotation.z = Math.PI / 2; fist.position.x = 1.6; inner.add(fist);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.8, 4, 10), skinMat); thumb.position.set(0.4, 2.3, 0.9); thumb.rotation.z = -0.9; inner.add(thumb);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(1.45, 9, 6, 14), skinMat); wrist.rotation.z = Math.PI / 2; wrist.position.x = 8.6; inner.add(wrist);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 1.3, 20), new THREE.MeshStandardMaterial({ color: flat(HEX.force), roughness: 0.5 })); band.rotation.z = Math.PI / 2; band.position.x = 5.2; inner.add(band);
  const notch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: flat("#FFFFFF") })); notch.position.set(5.2, 1.75, 0); inner.add(notch);
  scene.add(outer); return { outer, inner };
}
function makeInst() {
  const I = { segs: [], stripes: [], hands: [makeHand(), makeHand()], marks: [], ring: null };
  for (let i = 0; i < POOL; i++) { const m = new THREE.Mesh(segGeo, woodMat()); m.visible = false; scene.add(m); I.segs.push(m); }
  const markMat = new THREE.MeshBasicMaterial({ color: flat(HEX.energy), transparent: true }), markRing = new THREE.TorusGeometry(1.5, 0.2, 8, 28);
  I.marks = [0, 1, 2].map(() => { const m = new THREE.Mesh(markRing, markMat.clone()); m.visible = false; scene.add(m); return m; });
  return I;
}
const INST = [makeInst(), makeInst()];
const stripeMesh = (I, i, k) => { const key = i * 2 + k; if (!I.stripes[key]) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: flat(k ? HEX.energy : HEX.force) })); m.visible = false; scene.add(m); I.stripes[key] = m; } return I.stripes[key]; };
const shelf = new THREE.Mesh(new THREE.BoxGeometry(96, 1.6, 14), new THREE.MeshStandardMaterial({ color: flat("#C9C2B2"), roughness: 0.8 })); shelf.position.set(0, SHELF - 0.8, 0); scene.add(shelf);
const shelfEdge = new THREE.Mesh(new THREE.BoxGeometry(96, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: flat(HEX.ink2) })); shelfEdge.position.set(0, SHELF, 7); scene.add(shelfEdge);
const shelf2 = shelf.clone(), shelfEdge2 = shelfEdge.clone(); scene.add(shelf2, shelfEdge2);

function stripeTube(pts, tw, off, rr) {                      // a thin tube running round the stick: its angle about the stick's line grows with s
  const P3 = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], tx = c.x - a.x, ty = c.y - a.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, ph = tw * (p.s / L) + off;
    return new THREE.Vector3(p.x + nx * rr * Math.cos(ph), p.y + ny * rr * Math.cos(ph), rr * Math.sin(ph));
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P3), Math.max(8, pts.length * 2), 0.3, 6, false);
}
function drawInst(I, t, tk, tau, xo, yo, main) {
  const lines = sticks(tk, tau).map((pts) => pts.map((p) => ({ x: p.x + xo, y: p.y + yo, s: p.s }))), post = tau - 1;
  let k = 0;
  const p01 = bendOf(tau), stressAmt = tau < 1 ? Math.max(0, (p01 - 0.8) / 0.2) : 0;     // the stick reddens where the bend is greatest, before it breaks
  for (const pts of lines) {
    for (let i = 0; i + 1 < pts.length && k < POOL; i++) {
      const a = pts[i], b = pts[i + 1], m = I.segs[k++];
      v1.set(a.x, a.y, 0); v2.set(b.x, b.y, 0); dirv.subVectors(v2, v1);
      const len = dirv.length(); if (len < 1e-6) { k--; continue; }
      m.visible = true; m.position.copy(v1).add(v2).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, dirv.normalize()); m.scale.set(RAD, len * 1.03, RAD);
      const sMid = (a.s + b.s) / 2;
      let amt = stressAmt * 0.75 * Math.exp(-(((sMid - L / 2) / (0.16 * L)) ** 2));
      if (main && tau > 1 && t >= CUE.ripple[0] - 0.2 && t < CUE.ripple[1]) {          // the ripple: a band of red running out from the first break
        const d = Math.abs(sMid - L / 2), front = SK.wave * L * Math.max(0, post);
        amt = Math.max(amt, Math.max(0, 1 - Math.abs(d - front) / (0.06 * L)) * (post < 0.55 ? 1 : 0));
      }
      m.material.color.copy(tmpc.copy(COL_STICK).lerp(COL_RIP, amt));
    }
  }
  for (; k < POOL; k++) I.segs[k].visible = false;
  const tw = (twistOf(tk, tau) * Math.PI) / 180;
  I.stripes.forEach((m) => { m.visible = false; });
  if (tw > 0.03) lines.forEach((pts, i) => [0, 1].forEach((kk) => { const m = stripeMesh(I, i, kk); m.geometry.dispose(); m.geometry = stripeTube(pts, tw, kk * Math.PI, RAD * 1.08); m.visible = true; }));
  // the hands: a fist round each end; the right forearm turns with the twist (the white notch on its band shows how far)
  const th = tau < 1 ? TH * bendOf(tau) : TH, eL = arcPt(0, th), eR = arcPt(L, th);
  const hL = I.hands[0], hR = I.hands[1];
  hL.outer.position.set(eL.x + xo, eL.y + yo, 0); hL.outer.rotation.z = normA(eL.a + Math.PI); hL.inner.rotation.x = 0;
  hR.outer.position.set(eR.x + xo, eR.y + yo, 0); hR.outer.rotation.z = normA(eR.a); hR.inner.rotation.x = tw;
  const br = breaksOf(tk);
  I.marks.forEach((mk, i) => {
    const b = br[i], on = b && tau > 1 && post >= b[1] && post - b[1] < 0.5;
    mk.visible = !!on;
    if (on) { const p = arcPt(b[0] * L, TH), age = (post - b[1]) / 0.5; mk.position.set(p.x + xo, p.y + yo, 0.8); mk.scale.setScalar(1 + 1.8 * age); mk.material.opacity = 1 - age; }
  });
}
function hideInst(I) { I.segs.forEach((m) => { m.visible = false; }); I.stripes.forEach((m) => { m.visible = false; }); I.marks.forEach((m) => { m.visible = false; }); I.hands.forEach((h) => { h.outer.visible = false; }); }
function drawStick(t) {
  const st = instsAt(t);
  INST.forEach((I, i) => { if (!st[i]) { hideInst(I); return; } I.hands.forEach((h) => { h.outer.visible = true; }); drawInst(I, t, st[i].tk, st[i].tau, st[i].xo, st[i].yo, i === 0 && !takeAt(t).pair); });
}
const piecesAt = (t) => { const st = instsAt(t)[0]; return st.tau < 1 ? 1 : pieceList(st.tk, st.tau).length; };
// the centre of the i-th piece of instance 0 (for the numbered labels)
const pieceCentre = (t, i, inst = 0) => { const st = instsAt(t)[inst]; if (!st || st.tau < 1) return [st ? st.xo : 0, Y0, 0]; const ln = sticks(st.tk, st.tau)[i] || sticks(st.tk, st.tau)[0]; const m = ln[Math.floor(ln.length / 2)]; return [m.x + st.xo, m.y + st.yo, 0]; };

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
hud.badge("slow", { kind: "tag", slot: "tl", t0: 0, t1: null, text: (t) => (instsAt(t).some((x) => x.tau > 1 && x.tau < 1.9) ? "Slow motion" : null) });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, title: b.title, kind: b.kind, t0: b.t0, t1: b.t1 ?? null, slot: b.slot });
const PB = FILM.piecesBadge;
hud.badge(PB.id, { kind: "tag", slot: PB.slot, t0: PB.t0, t1: PB.t1, text: (t) => { const tk = takeAt(t); return twistOf(tk, tauAt(t)) >= PB.thr ? "Bend it now: two pieces" : "Bend it now: three or more"; } });
const anchorFn = (an) => {
  if (an === "stick") return (t) => { const th = tauAt(t) < 1 ? TH * bendOf(tauAt(t)) : TH, p = arcPt(L / 2, th); return [p.x, p.y + 1, 0]; };
  if (an === "hang") return () => [10, Y0 - 9, 0];
  if (an === "shat") return (t) => [instsAt(t)[0].xo, Y0 - 10 + instsAt(t)[0].yo, 0];
  if (an === "twist2") return (t) => { const s = instsAt(t); return [s[1] ? s[1].xo : 0, Y0 - 10 + (s[1] ? s[1].yo : 0), 0]; };
  { const pm = /^pc(\d)$/.exec(an); if (pm) return (t) => pieceCentre(t, +pm[1] - 1); }
  if (an === "end") return (t) => { const th = TH * bendOf(tauAt(t)), p = arcPt(0, th); return [p.x - 1, p.y, 0]; };
  if (an === "ripple") return (t) => { const post = tauAt(t) - 1, p = arcPt(Math.min(L, L / 2 - SK.wave * L * Math.max(0, post)), TH); return [p.x, p.y + 1, 0]; };
  const m = /^b(\d)$/.exec(an);
  if (m) { const b = SK.casc[+m[1] - 1], p = arcPt(b[0] * L, TH); return () => [p.x, p.y + 2, 0]; }
  return () => [0, Y0, 0];
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, color: lb.color, mark: lb.mark || "bar", at: anchorFn(lb.at), t0: lb.t0, t1: lb.t1 ?? null, side: lb.side, fixed: !!lb.fixed });
const SPN = FILM.spine;
const spineAt = (t) => SPN.find((s) => t >= s.t0 && t < s.t1) || (t < SPN[0].t0 ? SPN[0] : SPN[SPN.length - 1]);
const spineVal = (t) => { const s = spineAt(t); return s.kind === "pieces" ? piecesAt(t) : s.kind === "twist" ? twistOf(instsAt(t)[0].tk, tauAt(t)) : s.v; };
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
  { const pr = takeAt(t).pair; shelf2.visible = shelfEdge2.visible = !!pr; if (pr) { const y2 = pr[1].yo || 0, y1 = pr[0].yo || 0; shelf.position.y = SHELF + y1 - 0.8; shelfEdge.position.y = SHELF + y1; shelf2.position.set(0, SHELF + y2 - 0.8, 0); shelfEdge2.position.set(0, SHELF + y2, 7); } else { shelf.position.y = SHELF - 0.8; shelfEdge.position.y = SHELF; } }
  cyc.update({ grid: 1, casters: [[0, Y0 - 20, 0, 26]] });
  dropT(t); dropE(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp); }
  hud.update(t);
  { const s = spineAt(t); counterLb.textContent = s.label; counterU.textContent = s.unit; counterV.textContent = spineVal(t).toFixed(s.dp);
    counterEl.classList.toggle("lit", !!(s.lit && t >= s.lit[0] && t < s.lit[1])); }
  renderer.render(scene, camera);
};
