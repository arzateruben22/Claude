// Generic, unbranded traffic vehicles with real proportions: a mid-size sedan, a coupe, a compact SUV, a full-size
// crew-cab pickup, a high-roof van and a 16 ft box truck. One body loft each with the glass band split into a second
// material, a trim material carrying tyres, rims, grille, bumpers and the body's details (door mirrors on stalks, the
// doors' cut lines, handles, window pillars, wheel-arch liners, dark sills, blank plates, the third brake light) by
// vertex colour, and the lamps.
//
//   trafficParts(kind, quality?, { wheels? }): { paint, glass, trim, lamps, spec }
//     Merged, AO-baked geometries in the vehicle's own frame (x right, y up, faces -z, origin on the ground under
//     the middle), for instancing: the game's traffic uses them with its own wheels (wheels: false) and lamps.
//     spec carries the dimensions, the wheel radius, the track and the axle positions (zA).
//   buildTrafficCar(kind, paint, quality?): THREE.Group
//     The same parts as meshes, with a contact shadow: at most 4 draw calls and about 8k triangles.
import * as THREE from 'three';
import { V3, v3, gridGeo, sstep, curve, bakeAO } from './car-kit';
import * as M from './car-mats';
import { once } from './car-tex';
import { contactPatch, Quality } from './car';

export type TrafficKind = 'sedan' | 'coupe' | 'suv' | 'pickup' | 'van' | 'boxTruck' | 'semi';
export interface TrafficSpec {
  len: number; wid: number; wb: number; r: number; track: number; sill: number; belt: number; roof: number; hood: number; deck: number;
  ws0: number; ws1: number; bl0: number; bl1: number; bed?: number; box?: [number, number];
  glassEnd?: number;                 // the side glass stops here (a sleeper cab is solid behind the doors)
  // a tractor-trailer: the loft is the tractor (len, placed at the front of the rig); the trailer box spans trailer[0]..trailer[1]
  // along the rig and trailerY[0]..trailerY[1] up, in the rig's frame (origin at the middle of its total length); axles lists
  // every axle's z in that frame
  rig?: { total: number; trailer: [number, number]; trailerY: [number, number]; axles: number[] };
}
export const TRAFFIC_SPECS: Record<TrafficKind, TrafficSpec> = {
  // ws0/ws1: windscreen base and top (z); bl0/bl1: back glass top and base (z); hood/deck heights at the ends
  sedan: { len: 4.88, wid: 1.84, wb: 2.83, r: 0.33, track: 0.8, sill: 0.2, belt: 0.92, roof: 1.44, hood: 0.86, deck: 0.98, ws0: -0.95, ws1: -0.25, bl0: 0.85, bl1: 1.45 },
  coupe: { len: 4.5, wid: 1.9, wb: 2.62, r: 0.33, track: 0.83, sill: 0.17, belt: 0.84, roof: 1.3, hood: 0.78, deck: 0.9, ws0: -0.78, ws1: -0.08, bl0: 0.62, bl1: 1.3 },
  suv: { len: 4.6, wid: 1.86, wb: 2.69, r: 0.36, track: 0.81, sill: 0.32, belt: 1.08, roof: 1.68, hood: 1.04, deck: 1.1, ws0: -1.0, ws1: -0.38, bl0: 1.9, bl1: 2.1 },
  pickup: { len: 5.89, wid: 2.03, wb: 3.68, r: 0.4, track: 0.87, sill: 0.45, belt: 1.32, roof: 1.92, hood: 1.27, deck: 1.3, ws0: -1.1, ws1: -0.52, bl0: 0.5, bl1: 0.55, bed: 0.62 },
  van: { len: 5.93, wid: 2.02, wb: 3.66, r: 0.37, track: 0.86, sill: 0.42, belt: 1.18, roof: 2.55, hood: 1.12, deck: 2.4, ws0: -2.05, ws1: -1.45, bl0: 2.95, bl1: 2.96 },
  boxTruck: { len: 7.4, wid: 2.3, wb: 4.3, r: 0.48, track: 0.95, sill: 0.6, belt: 1.55, roof: 3.45, hood: 1.6, deck: 3.4, ws0: -2.9, ws1: -2.55, bl0: 3.7, bl1: 3.7, box: [-1.55, 3.7] },
  // a conventional tractor (2.2 m hood, sleeper cab, roof fairing, the tandem under the trailer's nose) and a 45 ft box
  // trailer: 20 m in all. deck is the frame level behind the sleeper
  semi: { len: 6.3, wid: 2.5, wb: 5.65, r: 0.52, track: 1.05, sill: 0.55, belt: 1.95, roof: 3.0, hood: 1.75, deck: 1.0, ws0: -0.95, ws1: -0.45, bl0: 1.95, bl1: 2.2, glassEnd: 1.0,
    rig: { total: 20, trailer: [-3.85, 9.85], trailerY: [1.3, 4.1], axles: [-8.6, -3.6, -2.3, 7.05, 8.35] } },
};
// trim colours (vertex colour on one shared material)
const TRIM = { tyre: [0.035, 0.035, 0.037], rim: [0.55, 0.57, 0.6], black: [0.03, 0.03, 0.032], chrome: [0.75, 0.76, 0.78], head: [0.9, 0.92, 0.95], tail: [0.55, 0.02, 0.02], amber: [0.8, 0.35, 0.02], box: [0.82, 0.83, 0.82] } as const;
function tint(g: THREE.BufferGeometry, c: readonly number[]) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// ------------------------------------------------------------------------------------------------ body details
// Along each side (z in the vehicle's frame, the semi's in its tractor's): the doors' cut lines, the window pillars
// across the glass band ([z, width], matt black: the B-pillar, and the divider behind a rear door) and the door
// handles, near each door's back edge
const DOORS: Record<TrafficKind, { cuts: number[]; pillars: [number, number][]; handles: number[] }> = {
  sedan: { cuts: [-0.97, 0.08, 0.98], pillars: [[0.08, 0.085], [0.98, 0.04]], handles: [-0.14, 0.78] },
  coupe: { cuts: [-0.8, 0.5], pillars: [[0.5, 0.05]], handles: [0.28] },
  suv: { cuts: [-1.02, 0.1, 1.0], pillars: [[0.1, 0.09], [1.0, 0.05]], handles: [-0.12, 0.8] },
  pickup: { cuts: [-1.14, -0.18, 0.4, 0.6], pillars: [[-0.18, 0.09]], handles: [-0.38, 0.2] },     // 0.6: cab to bed
  van: { cuts: [-1.82, -0.95, 0.35], pillars: [[-0.95, 0.1], [0.35, 0.06]], handles: [-1.15, -0.8] }, // a sliding door
  boxTruck: { cuts: [-2.82, -1.62], pillars: [], handles: [-1.8] },
  semi: { cuts: [-0.9, 0.3], pillars: [[0.3, 0.08]], handles: [0.12] },
};
const DETAIL = {
  seam: [0.012, 0.012, 0.014], sill: [0.045, 0.045, 0.05], liner: [0.02, 0.02, 0.022], handle: [0.09, 0.09, 0.095],
  plate: [0.8, 0.81, 0.82], glass: [0.34, 0.38, 0.44],
} as const;
type Fr = (w: number, h: number, x: number, y: number, z: number, c: readonly number[], back?: boolean) => THREE.BufferGeometry;
type Section = (z: number) => { row: V3[]; c: number[]; yb: number };

// flat faces in one colour, each wound to face the normal it is given
class Faces {
  private pos: number[] = []; private nor: number[] = [];
  tri(a: V3, b: V3, c: V3, n: V3) {
    const ok = b.clone().sub(a).cross(c.clone().sub(a)).dot(n) >= 0;
    for (const v of ok ? [a, b, c] : [a, c, b]) { this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); }
  }
  quad(a: V3, b: V3, c: V3, d: V3, n: V3) { this.tri(a, b, c, n); this.tri(a, c, d, n); }
  geo(col: readonly number[]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    return tint(g, col);
  }
  get empty() { return !this.pos.length; }
}

// a blank licence plate (no text, no real format) in a black frame, centred at (x, y) on a face at z
function plate(fr: Fr, x: number, y: number, z: number, back: boolean) {
  const s = back ? 1 : -1;
  return [fr(0.335, 0.18, x, y, z + s * 0.004, TRIM.black, back), fr(0.305, 0.152, x, y, z + s * 0.009, DETAIL.plate, back)];
}

// The details that make a lofted body read as a car, all vertex-coloured trim (the same one mesh per class): door
// mirrors on stalks (a pod with its glass facing back; a tall west-coast mirror on two arms on a truck), the doors'
// cut lines as dark recessed strips, the door handles, the B-pillar and the rear door's divider across the glass,
// wheel-arch liners, dark lower sills between the arches, blank licence plates front and back, and the third brake
// light under the roof's back edge (not on the box truck or the semi: the rule exempts vehicles 80 in wide or wider).
function bodyDetails(kind: TrafficKind, S: TrafficSpec, zA: [number, number], section: Section, nr: number, fr: Fr) {
  const zF = -S.len / 2, zR = S.len / 2, truck = !!S.rig || kind === 'boxTruck', tall = kind === 'van' || kind === 'boxTruck';
  const out: THREE.BufferGeometry[] = [];
  const f = { seam: new Faces(), sill: new Faces(), liner: new Faces(), handle: new Faces(), glass: new Faces() };
  // the side of the section at z between heights y0 and y1: a polyline up the skin, with its outward normals
  const sidePath = (z: number, side: 1 | -1, y0: number, y1: number) => {
    const { row } = section(z), pts: V3[] = [];
    for (let j = 0; j < nr / 2; j++) {
      const a = row[side > 0 ? j : nr - j], b = row[side > 0 ? j + 1 : nr - j - 1];
      if (b.y <= y0 || a.y >= y1) continue;
      if (!pts.length) pts.push(a.clone().lerp(b, Math.max(0, (y0 - a.y) / (b.y - a.y))));
      pts.push(a.clone().lerp(b, Math.min(1, (y1 - a.y) / (b.y - a.y))));
    }
    const nrm = pts.map((_, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)]; return v3(side * (b.y - a.y), -side * (b.x - a.x), 0).normalize(); });
    return { pts, nrm };
  };
  const crown = (z: number) => section(z).row[nr / 2].y;
  // the side glass at z: its lowest and highest points, or null where there is none
  const glassBand = (z: number): [number, number] | null => {
    const { row, c } = section(z); let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= nr / 2; j++) if (c[j]) { lo = Math.min(lo, row[j].y); hi = Math.max(hi, row[j].y); }
    return lo < hi ? [lo, hi] : null;
  };
  const sillTop = (z: number) => glassBand(z)?.[0] ?? Math.min(S.belt + 0.03, crown(z) - 0.06);
  // a strip up the side at z from y0 to y1, w long, d proud of the skin
  const strip = (fc: Faces, z: number, side: 1 | -1, y0: number, y1: number, w: number, d: number, z1 = z + w / 2, z0 = z - w / 2) => {
    const { pts, nrm } = sidePath(z, side, y0, y1);
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k].clone().addScaledVector(nrm[k], d), b = pts[k + 1].clone().addScaledVector(nrm[k + 1], d);
      fc.quad(v3(a.x, a.y, z0), v3(a.x, a.y, z1), v3(b.x, b.y, z1), v3(b.x, b.y, z0), nrm[k].clone().add(nrm[k + 1]).normalize());
    }
  };
  // a point d proud of the side at (z, y), and the skin's normal there
  const sideAt = (z: number, side: 1 | -1, y: number, d = 0) => {
    const { pts, nrm } = sidePath(z, side, y - 0.01, y + 0.01);
    if (pts.length < 2) { const x = Math.abs(section(z).row[0].x); return { p: v3(side * (x + d), y, z), n: v3(side, 0, 0) }; }   // above the side
    const n = nrm[0].clone().add(nrm[nrm.length - 1]).normalize();
    return { p: pts[0].clone().lerp(pts[pts.length - 1], 0.5).addScaledVector(n, d), n };
  };
  const D = DOORS[kind];
  for (const sd of [1, -1] as const) {
    // the doors' cut lines: from the sill (or the arch) up to the glass
    for (const z of D.cuts) strip(f.seam, z, sd, section(z).yb + 0.012, Math.min(sillTop(z), crown(z) - 0.06) - 0.004, 0.014, 0.01);
    // the pillars across the glass band, a little over its edges
    for (const [z, w] of D.pillars) { const g = glassBand(z); if (g) strip(f.seam, z, sd, g[0] - 0.012, g[1] + 0.012, w, 0.01); }
    // handles: a dark grip just below the glass (lower on a truck's tall door)
    for (const z of D.handles) {
      const { p, n } = sideAt(z, sd, sillTop(z) - (truck ? 0.38 : 0.08), 0.01), u = v3(0, 0.017, 0);
      f.handle.quad(v3(p.x, p.y - u.y, z - 0.07), v3(p.x, p.y - u.y, z + 0.07), v3(p.x, p.y + u.y, z + 0.07), v3(p.x, p.y + u.y, z - 0.07), n);
    }
  }
  // door mirrors, at the door's front top corner
  {
    const zm = S.ws0 + (S.rig ? 0.1 : 0.2), ym = sillTop(zm);
    for (const sd of [1, -1] as const) {
      const xs = Math.abs(sideAt(zm, sd, ym).p.x), box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); return b; };
      if (truck) {
        const hw = 0.2, hh = 0.42, hd = 0.08, xc = xs + 0.32, yc = ym + 0.3, xa = xc - hw / 2 - xs + 0.03;
        out.push(tint(box(hw, hh, hd, sd * xc, yc, zm), TRIM.black));
        for (const dy of [-0.15, 0.15]) out.push(tint(box(xa, 0.025, 0.025, sd * (xs - 0.02 + xa / 2), yc + dy, zm), TRIM.black));
        f.glass.quad(v3(sd * (xc - hw / 2 + 0.015), yc - hh / 2 + 0.02, zm + hd / 2 + 0.003), v3(sd * (xc + hw / 2 - 0.015), yc - hh / 2 + 0.02, zm + hd / 2 + 0.003),
          v3(sd * (xc + hw / 2 - 0.015), yc + hh / 2 - 0.02, zm + hd / 2 + 0.003), v3(sd * (xc - hw / 2 + 0.015), yc + hh / 2 - 0.02, zm + hd / 2 + 0.003), v3(0, 0, 1));
      } else {
        const big = kind === 'suv' || kind === 'pickup' || kind === 'van';
        const mw = big ? 0.24 : 0.2, mh = big ? 0.15 : 0.12, md = 0.09, xc = xs + 0.06 + mw / 2, yc = ym + mh / 2 - 0.005;
        // the pod: a box whose nose is lower and swept back at its outboard end
        const pod = new THREE.BoxGeometry(mw, mh, md), pp = pod.attributes.position;
        for (let i = 0; i < pp.count; i++) if (pp.getZ(i) < 0) { pp.setY(i, pp.getY(i) * 0.72); if (pp.getX(i) * sd > 0) pp.setZ(i, pp.getZ(i) + 0.03); }
        pod.computeVertexNormals(); pod.translate(sd * xc, yc, zm);
        out.push(tint(pod, TRIM.black), tint(box(0.09, 0.03, 0.05, sd * (xs + 0.035), ym + 0.012, zm + 0.01), TRIM.black));
        const gw = mw / 2 - 0.016, gh = mh / 2 - 0.016, gz = zm + md / 2 + 0.003;
        f.glass.quad(v3(sd * (xc - gw), yc - gh, gz), v3(sd * (xc + gw), yc - gh, gz), v3(sd * (xc + gw), yc + gh, gz), v3(sd * (xc - gw), yc + gh, gz), v3(0, 0, 1));
      }
    }
  }
  if (!S.rig) {
    // wheel-arch liners: a dark tunnel just inside each arch's cut, closed by a wall on the inboard side
    const R = (S.r + 0.06) * 0.985, Ry = R * 0.95, n = 6;
    for (const za of zA) {
      const xo = Math.abs(section(za).row[0].x) - 0.012, xi = xo - 0.3;
      const arc = Array.from({ length: n + 1 }, (_, k) => { const t = (Math.PI * k) / n; return [S.r + Ry * Math.sin(t), za - R * Math.cos(t)]; });
      for (const sd of [1, -1] as const) for (let k = 0; k < n; k++) {
        const [y0, z0] = arc[k], [y1, z1] = arc[k + 1], tm = (Math.PI * (k + 0.5)) / n;
        f.liner.quad(v3(sd * xi, y0, z0), v3(sd * xo, y0, z0), v3(sd * xo, y1, z1), v3(sd * xi, y1, z1), v3(0, -Math.sin(tm), Math.cos(tm)));
        f.liner.tri(v3(sd * xi, S.r, za), v3(sd * xi, y0, z0), v3(sd * xi, y1, z1), v3(sd, 0, 0));
      }
    }
    // the lower sills between the arches, in dark plastic
    const z0 = zA[0] + S.r + 0.08, z1 = zA[1] - S.r - 0.08;
    for (const sd of [1, -1] as const) strip(f.sill, (z0 + z1) / 2, sd, S.sill - 0.01, S.sill + (tall ? 0.12 : 0.09), 0, 0.006, z1, z0);
    // licence plates: the front one between the bumper and the grille, the back one low on the tail
    out.push(...plate(fr, 0, S.sill + 0.22, zF - 0.016, false), ...plate(fr, 0, S.sill + (kind === 'boxTruck' ? 0.32 : 0.3), zR + 0.016, true));
  }
  // the third brake light: centred under the roof's back edge, laid on the slope there
  if (!truck) {
    const yc = S.roof - 0.07; let zc = zR;
    while (zc > 0 && crown(zc) < yc) zc -= 0.005;
    const slope = (crown(zc + 0.01) - crown(zc - 0.01)) / 0.02, n = v3(0, 1, -slope).normalize();
    const c = new THREE.PlaneGeometry(0.3, 0.035); c.rotateX(Math.atan2(-n.y, n.z)); c.translate(0, crown(zc), zc); c.translate(n.x * 0.008, n.y * 0.008, n.z * 0.008);
    out.push(tint(c, TRIM.tail));
  }
  for (const [k, fc] of Object.entries(f)) if (!fc.empty) out.push(fc.geo(DETAIL[k as keyof typeof f]));
  return out;
}

export function trafficMaterials(paint: number, q: Quality) {
  return {
    paint: M.paint(paint, q, [], { key: 'traffic', flake: 0.2 }),
    glass: once('m.tglass', () => new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 })),
    trim: once('m.ttrim', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 })),
    lamp: once('m.tlamp', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.0 })),
  };
}

export interface TrafficParts { paint: THREE.BufferGeometry; glass: THREE.BufferGeometry; trim: THREE.BufferGeometry; lamps: THREE.BufferGeometry; spec: TrafficSpec & { zA: [number, number]; axles: number[] } }

// merge parts into one geometry with position, normal, uv and (if any part has it) colour, and bake the AO heuristic
function mergePart(parts: THREE.BufferGeometry[]) {
  const clean = parts.map((p) => {
    const x = p.index ? p : p.setIndex([...Array(p.attributes.position.count).keys()]);
    if (!x.attributes.normal) x.computeVertexNormals();
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    return x;
  });
  const hasColor = clean.some((p) => p.attributes.color);
  for (const p of clean) if (hasColor && !p.attributes.color) tint(p, [1, 1, 1]); else if (!hasColor && p.attributes.color) p.deleteAttribute('color');
  return bakeAO(mergeAll(clean), (p, n) => (0.6 + 0.4 * sstep(0.1, 1.0, p.y)) * (n.y < -0.4 ? 0.6 : 1));
}

export function trafficParts(kind: TrafficKind, quality: Quality = 'high', o: { wheels?: boolean } = {}): TrafficParts {
  const S = TRAFFIC_SPECS[kind], q = quality;
  const L2 = S.len / 2, W2 = S.wid / 2, zF = -L2, zR = L2;
  const tall = kind === 'van' || kind === 'boxTruck';
  // section squareness (sides, top) and how much the hood narrows ahead of the cab: a tractor is boxy with a narrow hood
  const sq = kind === 'semi' ? [0.12, 0.1] : [0.25, 0.2], hoodIn = kind === 'semi' ? 0.2 : 0;
  // the rig's loft is its tractor, built in the tractor's own frame and moved to the front of the rig at the end
  const dz = S.rig ? -S.rig.total / 2 + S.len / 2 : 0;
  const zA: [number, number] = S.rig ? [S.rig.axles[0] - dz, S.rig.axles[1] - dz] : [-S.wb / 2 + (tall ? -0.35 : -0.15), S.wb / 2 + (tall ? -0.35 : -0.15)];
  // the body: sections along z, a rounded box whose top follows hood, glass, roof and deck
  const topAt = curve([[zF, S.hood - 0.08], [zF + 0.25, S.hood], [S.ws0, S.hood + 0.04], [S.ws1, S.roof], [S.box ? S.box[0] : S.bl0 - 0.05, S.roof], [S.bl0, S.box ? S.roof : S.roof - 0.02], [S.bl1, S.deck], [zR - 0.15, S.deck], [zR, S.deck - 0.06]]);
  const cabTop = (z: number) => (S.bed !== undefined && z > S.bl1 ? S.belt : topAt(z));
  const ns = q === 'high' ? 70 : 44, nr = q === 'high' ? 26 : 18;
  // the section at z: its points around the half-section (right side up, over, left side down) and which are glass;
  // the loft samples it ns + 1 times, and the trim's details below are laid on it
  const section = (z: number) => {
    const endR = Math.min(1, Math.min(z - zF, zR - z) / 0.22), end = 1 - Math.sqrt(Math.max(0, 1 - endR * endR));
    const w = W2 - 0.12 * end - hoodIn * (1 - sstep(S.ws0 - 0.55, S.ws0 + 0.05, z)), top = cabTop(z) - 0.06 * end;
    let yb = S.sill;
    for (const za of zA) { const e = Math.abs(z - za), R = S.r + 0.06; if (e < R) yb = Math.max(yb, S.r + Math.sqrt(R * R - e * e) * 0.95); }
    const row: V3[] = [], c: number[] = [];
    const green = top > S.belt + 0.05 && !(S.box && z > S.box[0]);
    for (let j = 0; j <= nr; j++) {
      const u = j / nr, a = u * Math.PI;              // around the half-section: right side up, over, left side down
      const sx = Math.cos(a), sy = Math.sin(a);
      // a rounded-box section with tumblehome above the belt
      const k = Math.pow(Math.abs(sx), sq[0]) * Math.sign(sx), yy = Math.pow(sy, sq[1]);
      let y = yb + (top - yb) * yy, x = w * k;
      if (green && y > S.belt) { const f = (y - S.belt) / Math.max(0.01, top - S.belt); x *= 1 - 0.14 * f * f; }
      row.push(v3(x, y, z));
      c.push(green && y > S.belt + 0.04 && y < top - 0.07 && z > S.ws0 + 0.04 && z < Math.min(S.glassEnd ?? 1e9, Math.max(S.bl1, S.ws1 + 0.3)) - 0.04 ? 1 : 0);
    }
    return { row, c, yb };
  };
  const rows: V3[][] = [], cls: number[][] = [];
  for (let i = 0; i <= ns; i++) { const sc = section(zF + (zR - zF) * (i / ns)); rows.push(sc.row); cls.push(sc.c); }
  const body = gridGeo(rows, { flip: true });
  const idx = body.index!.array, paintI: number[] = [], glassI: number[] = [];
  for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) {
    const k = (i * nr + j) * 6, glassy = cls[i][j] + cls[i + 1][j] + cls[i][j + 1] + cls[i + 1][j + 1] >= 3;
    (glassy ? glassI : paintI).push(...Array.from(idx.slice(k, k + 6)));
  }
  const bp = body.clone(); bp.setIndex(paintI);
  const bg = body.clone(); bg.setIndex(glassI);
  // nose and tail caps
  const cap = (i: number, back: boolean) => { const r = rows[i], s = new THREE.Shape(); s.moveTo(r[0].x, r[0].y); for (const p of r.slice(1)) s.lineTo(p.x, p.y); s.closePath(); const c2 = new THREE.ShapeGeometry(s, 2); if (!back) c2.rotateY(Math.PI); c2.translate(0, 0, r[0].z); return c2; };
  const paintParts: THREE.BufferGeometry[] = [bp, cap(0, false), cap(ns, true)];
  const trim: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [];
  // the box on a box truck, the bed walls on a pickup
  if (S.box) { const b = new THREE.BoxGeometry(S.wid + 0.04, S.roof - S.sill - 0.15, S.box[1] - S.box[0], 2, 2, 4); b.translate(0, (S.roof + S.sill + 0.15) / 2, (S.box[0] + S.box[1]) / 2); trim.push(tint(b, TRIM.box)); }
  if (S.bed !== undefined) { const b = new THREE.BoxGeometry(S.wid - 0.2, 0.06, zR - S.bl1 - 0.15); b.translate(0, S.belt - 0.45, (S.bl1 + zR) / 2); trim.push(tint(b, TRIM.black)); }
  // grille, bumpers, lamps, mirrors
  const fr = (w: number, h: number, x: number, y: number, z: number, c: readonly number[], back = false) => { const p = new THREE.PlaneGeometry(w, h); if (!back) p.rotateY(Math.PI); p.translate(x, y, z); return tint(p, c); };
  trim.push(fr(S.wid * 0.5, (S.hood - S.sill) * 0.35, 0, S.sill + (S.hood - S.sill) * 0.6, zF - (S.rig ? 0.03 : 0.012), TRIM.black));
  trim.push(fr(S.wid - 0.1, 0.12, 0, S.sill + 0.08, zF - 0.012, TRIM.black));
  if (!S.rig) trim.push(fr(S.wid - 0.1, 0.12, 0, S.sill + 0.08, zR + 0.012, TRIM.black, true));
  for (const sd of [1, -1]) {
    lamps.push(fr(S.wid * 0.18, 0.09, sd * W2 * 0.7, S.hood - 0.12, zF - 0.014, TRIM.head));
    if (!S.rig) lamps.push(fr(S.wid * 0.12, 0.16, sd * W2 * 0.78, (S.box ? 1.0 : S.deck - 0.14), zR + 0.014, TRIM.tail, true));
  }
  trim.push(...bodyDetails(kind, S, zA, section, nr, fr));
  for (const p of paintParts) if (p.attributes.color) p.deleteAttribute('color');
  if (S.rig) {
    const R = S.rig, [t0, t1] = R.trailer, [y0, y1] = R.trailerY, tw = S.wid + 0.1, tl = t1 - t0, tz = (t0 + t1) / 2;
    const put = (w: number, h: number, l: number, x: number, y: number, z: number, c: readonly number[]) => { const b = new THREE.BoxGeometry(w, h, l); b.translate(x, y, z); trim.push(tint(b, c)); };
    // the tractor, in its own frame: chrome grille surround and bumper, sun visor, the roof fairing in paint, exhaust
    // stacks, fuel tanks between the axles, frame rails back under the trailer and the fifth wheel over the tandem
    const tandem = (R.axles[1] + R.axles[2]) / 2 - dz;
    trim.push(fr(S.wid * 0.62, (S.hood - S.sill) * 0.55, 0, S.sill + (S.hood - S.sill) * 0.55, zF - 0.015, TRIM.chrome));
    put(S.wid + 0.1, 0.24, 0.14, 0, S.sill + 0.12, zF + 0.04, TRIM.chrome);
    trim.push(...plate(fr, 0, S.sill + 0.12, zF - 0.03, false));
    put(S.wid - 0.1, 0.05, 0.4, 0, S.roof - 0.02, S.ws1 - 0.1, TRIM.black);
    paintParts.push(wedge(S.wid - 0.3, S.ws1 + 0.3, S.bl1 - 0.1, S.roof - 0.08, S.roof + 0.05, y1 - 0.1));
    put(0.95, 0.08, 0.95, 0, 1.12, tandem, TRIM.black);
    for (const sd of [1, -1]) {
      const st = new THREE.CylinderGeometry(0.065, 0.065, S.roof - S.deck + 0.3, 10); st.translate(sd * (W2 - 0.05), (S.roof + S.deck) / 2 + 0.15, S.bl1 + 0.12); trim.push(tint(st, TRIM.chrome));
      const tk = new THREE.CylinderGeometry(0.32, 0.32, 1.5, 14); tk.rotateX(Math.PI / 2); tk.translate(sd * (W2 - 0.3), 0.74, (zA[0] + zA[1]) / 2 - 0.3); trim.push(tint(tk, TRIM.chrome));
      put(0.1, 0.26, R.axles[2] + 0.6 - dz - S.ws1, sd * 0.45, 0.92, (S.ws1 + R.axles[2] + 0.6 - dz) / 2, TRIM.black);
    }
    for (const g of [...paintParts, bg, ...trim, ...lamps]) g.translate(0, 0, dz);
    // the trailer, in the rig's frame
    put(tw, y1 - y0, tl, 0, (y0 + y1) / 2, tz, TRIM.box);                       // the box
    put(tw - 0.2, 0.22, tl - 0.6, 0, y0 - 0.11, tz, TRIM.black);                // the floor frame under it
    put(0.025, y1 - y0 - 0.3, 0.03, 0, (y0 + y1) / 2, t1 + 0.012, TRIM.black);  // the seam between the rear doors
    put(tw - 0.3, 0.12, 0.08, 0, 0.55, t1 - 0.08, TRIM.black);                  // the underride guard
    trim.push(...plate(fr, -0.62, y0 + 0.17, t1 + 0.02, true));                  // the plate, between the lock rods
    for (const sd of [1, -1]) {
      put(0.14, y0 - 0.3, 0.14, sd * 0.55, (y0 - 0.3) / 2 + 0.3, t0 + 3.4, TRIM.black);   // landing gear
      put(0.62, 0.5, 0.02, sd * (S.track - 0.05), 0.28, R.axles[R.axles.length - 1] + 0.75, TRIM.black);  // mud flaps
      put(0.03, 0.7, tl * 0.5, sd * (tw / 2 - 0.03), y0 - 0.4, tz - 0.6, TRIM.box);       // side skirt
      put(0.012, 0.05, tl - 0.3, sd * (tw / 2 + 0.004), y0 + 0.12, tz, TRIM.tail);        // conspicuity tape
      for (const x of [0.4, 0.85]) put(0.03, y1 - y0 - 0.5, 0.035, sd * x, (y0 + y1) / 2, t1 + 0.02, TRIM.chrome);  // door lock rods
      lamps.push(fr(0.3, 0.16, sd * (tw / 2 - 0.3), y0 - 0.1, t1 + 0.014, TRIM.tail, true));
    }
  }
  const axles = S.rig ? S.rig.axles : [zA[0], zA[1]];
  // wheels: tyre torus and a rim disc, by vertex colour, at every axle of the finished frame (the game instances its
  // own, which turn)
  if (o.wheels ?? true) {
    for (const za of axles) for (const sd of [1, -1]) {
      const ty = new THREE.TorusGeometry(S.r - 0.07, 0.075, 8, q === 'high' ? 28 : 18); ty.rotateY(Math.PI / 2); ty.scale(1.6, 1, 1); ty.translate(sd * S.track, S.r, za);
      trim.push(tint(ty, TRIM.tyre));
      const rim = new THREE.CircleGeometry(S.r - 0.11, 16); rim.rotateY(sd * Math.PI / 2); rim.translate(sd * (S.track + 0.1), S.r, za);
      trim.push(tint(rim, kind === 'boxTruck' || kind === 'semi' ? TRIM.box : TRIM.rim));
    }
  }
  return { paint: mergePart(paintParts), glass: mergePart([bg]), trim: mergePart(trim), lamps: mergePart(lamps), spec: { ...S, len: S.rig ? S.rig.total : S.len, zA, axles } };
}

export function buildTrafficCar(kind: TrafficKind, paint: number, quality: Quality = 'high'): THREE.Group {
  const parts = trafficParts(kind, quality), S = parts.spec, mats = trafficMaterials(paint, quality);
  const g = new THREE.Group();
  g.name = 'traffic-' + kind;
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, name: string, shadow: boolean) => {
    if (!geo.attributes.position.count) return;
    const mesh = new THREE.Mesh(geo, m); mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh);
  };
  add(parts.paint, mats.paint, 'paint', true);
  add(parts.glass, mats.glass, 'glass', false);
  add(parts.trim, mats.trim, 'trim', true);
  add(parts.lamps, mats.lamp, 'lamps', false);
  g.add(contactPatch(S.len, S.wid, S.axles.flatMap((z) => [[-S.track, z], [S.track, z]] as [number, number][])));
  return g;
}

// a wedge across x: a trapezoid in (z, y), yFront high at z0 and yBack at z1, extruded w wide
function wedge(w: number, z0: number, z1: number, y0: number, yFront: number, yBack: number) {
  const s = new THREE.Shape(); s.moveTo(z0, y0); s.lineTo(z1, y0); s.lineTo(z1, yBack); s.lineTo(z0, yFront); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
  return g;
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const P = p.attributes.position, N = p.attributes.normal, U = p.attributes.uv, C = p.attributes.color;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i)); if (C) col.push(C.getX(i), C.getY(i), C.getZ(i)); }
    const I = p.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + base);
    base += P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
