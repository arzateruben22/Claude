// Traffic vehicles, built from side profiles: a painted lower body, a dark glass greenhouse with a painted roof,
// tail and head lights, and wheels. Model frame: -z forward, +x right, y up, origin on the ground at the middle.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface CarClass {
  id: string; len: number; wid: number; mass: number; weight: number; lanes: number[];
  body: THREE.BufferGeometry; glass: THREE.BufferGeometry; tail: THREE.BufferGeometry; head: THREE.BufferGeometry;
  wheels: [number, number, number][]; wheelR: number; blink: [number, number, number][];
  speed: [number, number];           // m/s range they like
  fixedColor?: number[];             // trucks: white, a few fleet colours
}

function profile(points: [number, number][], width: number, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);                      // (z, y) profile, extruded across x
  g.translate(width / 2 - bevel, 0, 0);
  return g.index ? g.toNonIndexed() : g;
}
function box(w: number, h: number, l: number, x: number, y: number, z: number, r = 0.04) {
  const g = new RoundedBoxGeometry(w, h, l, 2, r); g.translate(x, y, z); return g.index ? g.toNonIndexed() : g;
}
const clean = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }))!;
function lights(spots: [number, number, number, number, number][], color: [number, number, number]) {
  const gs = spots.map(([w, h, x, y, z]) => box(w, h, 0.05, x, y, z, 0.012));
  const g = clean(gs);
  const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) { c[i] = color[0]; c[i + 1] = color[1]; c[i + 2] = color[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function car(id: string, len: number, wid: number, lower: [number, number][], green: [number, number][], roofY: number, roofZ: [number, number],
  tailY: number, headY: number, opts: Partial<CarClass> & { mass: number; weight: number; speed: [number, number] }): CarClass {
  const L = len / 2;
  const body = clean([profile(lower, wid), box(wid * 0.82, 0.05, roofZ[1] - roofZ[0], 0, roofY, (roofZ[0] + roofZ[1]) / 2, 0.02)]);
  const glass = clean([profile(green, wid * 0.86, 0.04)]);
  const tail = lights([[0.36, 0.11, -wid / 2 + 0.24, tailY, L + 0.005], [0.36, 0.11, wid / 2 - 0.24, tailY, L + 0.005]], [0.55, 0.04, 0.05]);
  const head = lights([[0.32, 0.09, -wid / 2 + 0.24, headY, -L - 0.005], [0.32, 0.09, wid / 2 - 0.24, headY, -L - 0.005]], [0.9, 0.9, 0.85]);
  const r = opts.wheelR ?? 0.33, ax = len * 0.31;
  return {
    id, len, wid, lanes: [0, 1, 2, 3], body, glass, tail, head, wheelR: r,
    wheels: opts.wheels ?? [[-wid / 2 + 0.12, r, -ax], [wid / 2 - 0.12, r, -ax], [-wid / 2 + 0.12, r, ax], [wid / 2 - 0.12, r, ax]],
    blink: [[-wid / 2 + 0.08, tailY + 0.1, L + 0.01], [wid / 2 - 0.08, tailY + 0.1, L + 0.01]],
    ...opts,
  } as CarClass;
}

export function buildClasses(): CarClass[] {
  const sedan = car('sedan', 4.8, 1.84,
    [[-2.4, 0.33], [-2.38, 0.62], [-2.12, 0.78], [-0.9, 0.87], [1.25, 0.9], [2.32, 0.86], [2.4, 0.55], [2.3, 0.3], [-2.3, 0.3]],
    [[-0.92, 0.86], [-0.08, 1.4], [0.95, 1.41], [1.62, 0.89]], 1.41, [-0.1, 0.95], 0.78, 0.66,
    { mass: 1550, weight: 36, speed: [27, 36] });
  const suv = car('suv', 4.9, 1.95,
    [[-2.45, 0.42], [-2.42, 0.86], [-2.2, 0.99], [-1.1, 1.06], [2.32, 1.08], [2.45, 1.02], [2.45, 0.48], [2.35, 0.38], [-2.35, 0.38]],
    [[-1.05, 1.05], [-0.3, 1.71], [2.2, 1.72], [2.38, 1.07]], 1.72, [-0.3, 2.2], 1.0, 0.86,
    { mass: 2150, weight: 28, speed: [26, 34], wheelR: 0.37 });
  const sports = car('sports', 4.5, 1.94,
    [[-2.25, 0.28], [-2.25, 0.46], [-1.8, 0.6], [-0.62, 0.77], [1.5, 0.84], [2.25, 0.8], [2.25, 0.4], [2.1, 0.28], [-2.1, 0.28]],
    [[-0.78, 0.76], [-0.05, 1.18], [0.75, 1.18], [1.55, 0.82]], 1.18, [-0.05, 0.75], 0.72, 0.52,
    { mass: 1500, weight: 8, speed: [31, 40], wheelR: 0.33 });
  const pickup = car('pickup', 5.8, 2.0,
    [[-2.9, 0.48], [-2.86, 0.98], [-2.6, 1.1], [-1.5, 1.14], [2.9, 1.14], [2.9, 0.52], [2.8, 0.42], [-2.8, 0.42]],
    [[-1.48, 1.13], [-0.98, 1.84], [0.38, 1.85], [0.5, 1.13]], 1.85, [-0.98, 0.38], 0.98, 0.9,
    { mass: 2400, weight: 12, speed: [26, 33], wheelR: 0.39 });
  // box truck: cab and a tall box, built from blocks
  const bt = (() => {
    const wid = 2.45, len = 8.2, L = len / 2;
    const body = clean([box(wid, 1.15, 2.0, 0, 1.0, -L + 1.0, 0.08), box(wid - 0.1, 0.5, 1.4, 0, 1.75, -L + 1.25, 0.08), box(wid + 0.04, 2.6, 5.9, 0, 2.15, 1.05, 0.05), box(wid * 0.9, 0.3, len - 0.4, 0, 0.55, 0, 0.03)]);
    const glass = clean([box(wid - 0.16, 0.6, 0.06, 0, 1.75, -L + 0.52, 0.02), box(wid - 0.02, 0.5, 0.9, 0, 1.75, -L + 1.2, 0.02)]);
    const tail = lights([[0.3, 0.14, -0.95, 0.75, L + 0.01], [0.3, 0.14, 0.95, 0.75, L + 0.01]], [0.55, 0.04, 0.05]);
    const head = lights([[0.3, 0.12, -0.9, 0.85, -L - 0.01], [0.3, 0.12, 0.9, 0.85, -L - 0.01]], [0.9, 0.9, 0.85]);
    return { id: 'truck', len, wid, mass: 7500, weight: 7, lanes: [2, 3], body, glass, tail, head, wheelR: 0.48, speed: [24, 28],
      wheels: [[-1.05, 0.48, -L + 1.3], [1.05, 0.48, -L + 1.3], [-1.05, 0.48, L - 1.4], [1.05, 0.48, L - 1.4]],
      blink: [[-1.15, 1.0, L + 0.02], [1.15, 1.0, L + 0.02]], fixedColor: [0xf2f2ef, 0xe8e8e2, 0xf4f4f2, 0x2c4f8a, 0xc9302c] } as CarClass;
  })();
  const semi = (() => {
    const wid = 2.55, len = 19.5, L = len / 2;
    const body = clean([box(wid, 1.5, 2.6, 0, 1.45, -L + 1.3, 0.12), box(wid - 0.1, 0.9, 1.8, 0, 2.6, -L + 1.6, 0.15), box(wid * 0.5, 0.25, 3.6, 0, 1.05, -L + 3.9, 0.05),
      box(wid + 0.05, 2.9, 14.6, 0, 2.6, L - 7.3, 0.04), box(wid * 0.8, 0.2, 14.4, 0, 1.0, L - 7.3, 0.03)]);
    const glass = clean([box(wid - 0.2, 0.75, 0.06, 0, 2.35, -L + 0.0 + 0.02, 0.02)]);
    const tail = lights([[0.3, 0.14, -1.05, 1.0, L + 0.01], [0.3, 0.14, 1.05, 1.0, L + 0.01]], [0.55, 0.04, 0.05]);
    const head = lights([[0.3, 0.14, -0.95, 1.05, -L - 0.01], [0.3, 0.14, 0.95, 1.05, -L - 0.01]], [0.9, 0.9, 0.85]);
    return { id: 'semi', len, wid, mass: 16000, weight: 8, lanes: [2, 3], body, glass, tail, head, wheelR: 0.52, speed: [24, 28],
      wheels: [[-1.05, 0.52, -L + 1.0], [1.05, 0.52, -L + 1.0], [-1.05, 0.52, -L + 4.6], [1.05, 0.52, -L + 4.6], [-1.05, 0.52, L - 2.6], [1.05, 0.52, L - 2.6], [-1.05, 0.52, L - 1.3], [1.05, 0.52, L - 1.3]],
      blink: [[-1.2, 1.2, L + 0.02], [1.2, 1.2, L + 0.02]], fixedColor: [0xf4f4f2, 0xf0f0ec, 0xdedcd6, 0xb8bcc2] } as CarClass;
  })();
  return [sedan, suv, sports, pickup, bt, semi];
}

// one wheel: dark tyre, a silver face with darker spoke gaps so you can see it turn
export function wheelGeometry() {
  const tyre = new THREE.CylinderGeometry(1, 1, 0.22, 20).rotateZ(Math.PI / 2);
  const face = new THREE.CircleGeometry(0.66, 20).rotateY(Math.PI / 2);
  face.translate(0.112, 0, 0);
  const face2 = face.clone(); face2.rotateY(Math.PI);
  const g = clean([tyre, face, face2]);
  const pos = g.attributes.position, c = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.hypot(y, z);
    const onFace = Math.abs(x) > 0.105 && r < 0.67;
    const spoke = Math.floor(((Math.atan2(z, y) + Math.PI) / (Math.PI * 2)) * 10) % 2 === 0;
    const k = onFace ? (spoke ? 0.72 : 0.3) : 0.07;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export const PAINTS = [0xf2f2f0, 0xf2f2f0, 0xe9e9e6, 0x111214, 0x111214, 0x1c1d20, 0x8d9196, 0x8d9196, 0xb5b8bc, 0x5d6168, 0x5d6168, 0x23395f, 0x7f1416, 0xb7a68c, 0x2c4a3a, 0x3f4a59];
