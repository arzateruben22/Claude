// Traffic vehicles: the realism preview's lofted bodies (src/preview/traffic.ts: sedan, coupe, SUV, pickup, van, box
// truck, and the tractor-trailer semi, with the glass band and vertex-coloured trim) plus the game's own instanced
// wheels and lamps. Model frame: -z forward, +x right, y up, origin on the ground at the middle.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { trafficParts, TrafficKind } from '../../preview/traffic';

export interface CarClass {
  id: string; len: number; wid: number; height: number; mass: number; weight: number; lanes: number[];   // height: the roof (a semi: its trailer's top)
  body: THREE.BufferGeometry; glass: THREE.BufferGeometry; tail: THREE.BufferGeometry; head: THREE.BufferGeometry;
  trim?: THREE.BufferGeometry;       // grille, bumpers, mirrors, box, bed: vertex-coloured, one shared material
  // High and Ultra (Traffic swaps them in by props.glow.tier; Low and Medium keep the two above): on the sedan, coupe
  // and SUV, an LED bar between the tail lamps, and door seams and handles on the trim
  tailHi?: THREE.BufferGeometry; trimHi?: THREE.BufferGeometry;
  wheels: [number, number, number][]; wheelR: number; blink: [number, number, number][];
  speed: [number, number];           // m/s range they like
  fixedColor?: number[];             // trucks: white, a few fleet colours
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

// the trim with extra boxes merged in, each given the trim's own attributes (its colour from the list, the rest zero)
function withParts(base: THREE.BufferGeometry, parts: [THREE.BufferGeometry, number[]][]) {
  const keys = Object.keys(base.attributes);
  const gs = parts.map(([g, col]) => {
    for (const k of Object.keys(g.attributes)) if (!keys.includes(k)) g.deleteAttribute(k);
    for (const k of keys) {
      if (g.attributes[k]) continue;
      const n = g.attributes.position.count, sz = base.attributes[k].itemSize, a = new Float32Array(n * sz);
      if (k === 'color') for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) a[i * sz + c] = col[c] ?? 1;
      g.setAttribute(k, new THREE.BufferAttribute(a, sz));
    }
    return base.index ? g : g.toNonIndexed();
  });
  return mergeGeometries([base, ...gs])!;
}

// a class from the preview's traffic bodies, with the game's own wheels (they turn) and lamps (they brake and blink)
function fromPreview(id: string, kind: TrafficKind, opts: { mass: number; weight: number; speed: [number, number]; lanes?: number[]; fixedColor?: number[] }): CarClass {
  const p = trafficParts(kind, 'phone', { wheels: false }), S = p.spec, L = S.len / 2, W2 = S.wid / 2;
  const tailY = S.box ? 1.0 : S.rig ? S.rig.trailerY[0] - 0.08 : S.deck - 0.14, headY = S.hood - 0.12;
  const tail = lights([[0.36, 0.11, -W2 * 0.78, tailY, L + 0.005], [0.36, 0.11, W2 * 0.78, tailY, L + 0.005]], [0.55, 0.04, 0.05]);
  const head = lights([[0.32, 0.09, -W2 * 0.7, headY, -L - 0.005], [0.32, 0.09, W2 * 0.7, headY, -L - 0.005]], [0.9, 0.9, 0.85]);
  let tailHi: THREE.BufferGeometry | undefined, trimHi: THREE.BufferGeometry | undefined;
  if (kind === 'sedan' || kind === 'coupe' || kind === 'suv') {
    tailHi = lights([[0.36, 0.11, -W2 * 0.78, tailY, L + 0.005], [0.36, 0.11, W2 * 0.78, tailY, L + 0.005], [W2 * 1.24, 0.035, 0, tailY + 0.02, L + 0.006]], [0.55, 0.04, 0.05]);
    // door seams (a shut line down each door's edges, from over the sill or the wheel arch to the belt) and handles
    const doors = kind === 'coupe' ? [S.ws0 + 0.08, S.ws0 + 1.25] : [S.ws0 + 0.08, S.ws0 + 1.15, Math.min(S.bl0 + 0.2, S.ws0 + 2.15)];
    const archTop = (z: number) => { let y = S.sill; for (const za of [-S.wb / 2 - 0.15, S.wb / 2 - 0.15]) { const dz = Math.abs(z - za), R = S.r + 0.06; if (dz < R) y = Math.max(y, S.r + Math.sqrt(R * R - dz * dz) * 0.95); } return y; };
    const parts: [THREE.BufferGeometry, number[]][] = [];
    for (const sd of [1, -1]) {
      for (const z of doors) {
        const y0 = archTop(z) + 0.06, y1 = S.belt - 0.015;
        const g = new THREE.BoxGeometry(0.012, y1 - y0, 0.012); g.translate(sd * (W2 + 0.004), (y0 + y1) / 2, z); parts.push([g, [0.04, 0.04, 0.045]]);
      }
      for (let k = 0; k < doors.length - 1; k++) {
        const g = new THREE.BoxGeometry(0.03, 0.03, 0.17); g.translate(sd * (W2 + 0.012), S.belt - 0.11, doors[k + 1] - 0.16); parts.push([g, [0.32, 0.32, 0.34]]);
      }
    }
    trimHi = withParts(p.trim, parts);
  }
  return {
    tailHi, trimHi,
    id, len: S.len, wid: S.wid, height: S.rig ? S.rig.trailerY[1] : S.roof, lanes: opts.lanes ?? [0, 1, 2, 3], body: p.paint, glass: p.glass, trim: p.trim, tail, head, wheelR: S.r,
    wheels: S.axles.flatMap((z) => [[-S.track, S.r, z], [S.track, S.r, z]] as [number, number, number][]),
    blink: [[-W2 + 0.08, tailY + 0.1, L + 0.01], [W2 - 0.08, tailY + 0.1, L + 0.01]],
    mass: opts.mass, weight: opts.weight, speed: opts.speed, fixedColor: opts.fixedColor,
  };
}

export function buildClasses(): CarClass[] {
  const sedan = fromPreview('sedan', 'sedan', { mass: 1550, weight: 34, speed: [27, 36] });
  const suv = fromPreview('suv', 'suv', { mass: 2150, weight: 28, speed: [26, 34] });
  const sports = fromPreview('sports', 'coupe', { mass: 1500, weight: 8, speed: [31, 40] });
  const pickup = fromPreview('pickup', 'pickup', { mass: 2400, weight: 12, speed: [26, 33] });
  const van = fromPreview('van', 'van', { mass: 2300, weight: 8, speed: [25, 32], lanes: [1, 2, 3], fixedColor: [0xf2f2f0, 0xe8e8e2, 0xf4f4f2, 0x2c4f8a, 0x8d9196] });
  const bt = fromPreview('truck', 'boxTruck', { mass: 7500, weight: 7, speed: [24, 28], lanes: [2, 3], fixedColor: [0xf2f2ef, 0xe8e8e2, 0xf4f4f2, 0x2c4f8a, 0xc9302c] });
  const semi = fromPreview('semi', 'semi', { mass: 16000, weight: 8, speed: [24, 28], lanes: [2, 3], fixedColor: [0xf4f4f2, 0xf0f0ec, 0xdedcd6, 0xb8bcc2, 0x8a1c1c, 0x1e3a8a] });
  return [sedan, suv, sports, pickup, van, bt, semi];
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
