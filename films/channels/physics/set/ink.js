// ink.js — line drawings for "the Bench" (films/channels/physics/set): illustrations drawn as ink strokes standing
// in the set (a grandfather clock, a hand, Joule's paddle-wheel apparatus), in centimetres. They are illustrations,
// never measurements: an episode that uses one says so (badge or README). Strokes are thin unlit boxes and tori in
// ink-2 that land on their token through the ACES inverse (./aces.js), with a shared opacity for drawing on and off.
//
//   import { inkSet, hand, joule } from "../set/ink.js";
//   const I = inkSet({ color: TK["ink-2"] });           // one material for every stroke of a drawing
//   const g = I.group(); g.add(I.bar(x0, y0, x1, y1, w), I.ring(r, w), I.poly(points, w, closed));
//   I.opacity(k)                                         // 0–1, draws the whole set on and off
//   const H = hand(I, { x, y, z, scale });               // a hand seen from the side, palm down, fingers to +x
//   const J = joule(I, { x, z });                        // a tank with a paddle wheel, two pulleys, two weights, a thermometer
//   J.update(u, warm)                                    // u 0–1: the weights' fall (paddle turns), warm 0–1: the thermometer
import * as THREE from "three";
import { unlit } from "./aces.js";

export const inkSet = (o = {}) => {
  const mat = new THREE.MeshBasicMaterial({ color: unlit(o.color || "#4B505B"), transparent: true, opacity: 1, depthWrite: false });
  const accent = new THREE.MeshBasicMaterial({ color: unlit(o.accent || "#B8321A"), transparent: true, opacity: 1, depthWrite: false });
  const bar = (x0, y0, x1, y1, w = 0.9, m = mat) => {
    const l = Math.hypot(x1 - x0, y1 - y0) || 1e-3, b = new THREE.Mesh(new THREE.BoxGeometry(l + w * 0.6, w, 0.4), m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); b.rotation.z = Math.atan2(y1 - y0, x1 - x0); return b;
  };
  const ring = (r, w = 0.8, m = mat) => new THREE.Mesh(new THREE.TorusGeometry(r, w / 2, 6, 48), m);
  const poly = (pts, w = 0.9, closed = false, m = mat) => {
    const g = new THREE.Group(), n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n]; g.add(bar(a[0], a[1], b[0], b[1], w, m)); }
    return g;
  };
  const opacity = (k) => { mat.opacity = k; accent.opacity = k; };
  return { mat, accent, bar, ring, poly, opacity, group: () => new THREE.Group() };
};

// a hand seen from the side, palm down, wrist at the left, fingertips at the right (0, 0) holding something under them
export const hand = (I, o = {}) => {
  const s = o.scale ?? 1, g = new THREE.Group();
  const P = [[-34, 7], [-14, 8.5], [-6, 9], [0, 7.5], [5, 5], [8, 1.5], [8.5, -1.5], [6.5, -3], [3, -1.5], [0, 0.5],   // the back of the hand, the fingertips
    [-5, 1.2], [-8, -1.8], [-10.5, -2.2], [-12, 0.5], [-16, 1.5], [-34, 1.5]];                                           // the thumb tucked under, the wrist
  g.add(I.poly(P.map(([x, y]) => [x * s, y * s]), 0.85 * s, false));
  [[-1, 4.5, 3.5, 2.2], [-4, 5.6, 1, 3.4]].forEach(([x0, y0, x1, y1]) => g.add(I.bar(x0 * s, y0 * s, x1 * s, y1 * s, 0.6 * s)));   // knuckle creases
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  return g;
};

// Joule's apparatus (1840s), simplified: an insulated tank of water with a paddle wheel on a vertical shaft; cords run
// from a drum on the shaft over two pulleys to two weights; as they fall the paddles turn and the thermometer rises
export const joule = (I, o = {}) => {
  const g = new THREE.Group(), W = 34, Hh = 30, top = Hh, py = 78;
  g.add(I.poly([[-W / 2, 0], [W / 2, 0], [W / 2, top], [-W / 2, top]], 1.0, true));          // the tank
  g.add(I.bar(-W / 2 + 2, top - 6, W / 2 - 2, top - 6, 0.5));                                // the water line
  g.add(I.bar(0, 4, 0, py - 18, 0.9));                                                         // the shaft
  const drum = I.poly([[-3, py - 26], [3, py - 26], [3, py - 18], [-3, py - 18]], 0.7, true); g.add(drum);
  const paddles = new THREE.Group(); paddles.position.set(0, 12, 0);
  for (let k = 0; k < 3; k++) { const b = I.bar(-9, 0, 9, 0, 1.1); b.position.y = (k - 1) * 6; paddles.add(b); }
  g.add(paddles);
  const pulleys = [-1, 1].map((sd) => { const r = I.ring(4, 0.8); r.position.set(sd * 30, py, 0); g.add(r); return r; });
  const cordTop = [-1, 1].map((sd) => I.bar(sd * 3, py - 22, sd * 30, py + 4, 0.35));   // drum → over the pulley cordTop.forEach((c) => g.add(c));
  const cords = [-1, 1].map(() => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.4), I.mat); g.add(c); return c; });
  const weights = [-1, 1].map(() => { const w = I.poly([[-4, -6], [4, -6], [4, 6], [-4, 6]], 0.8, true); g.add(w); return w; });
  const therm = I.poly([[W / 2 + 6, 6], [W / 2 + 9, 6], [W / 2 + 9, 44], [W / 2 + 6, 44]], 0.5, true); g.add(therm);
  const bulb = I.ring(2.6, 0.6); bulb.position.set(W / 2 + 7.5, 4, 0); g.add(bulb);
  const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 0.4), I.accent); g.add(col);
  const update = (u, warm) => {
    const drop = 30 * u;                                                                      // the weights fall 30 cm
    [-1, 1].forEach((sd, i) => {
      const x = sd * 34, y0 = py, y1 = py - 22 - drop;
      weights[i].position.set(x, y1 - 6, 0);
      cords[i].position.set(x, (y0 + y1) / 2, 0); cords[i].scale.set(1, Math.max(0.1, y0 - y1), 1);
    });
    paddles.rotation.y = u * Math.PI * 6;
    const h = 4 + 34 * Math.max(0, Math.min(1, warm));
    col.scale.y = h; col.position.set(W / 2 + 7.5, 6 + h / 2, 0);
  };
  update(0, 0);
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  return { group: g, update };
};
