// The garage cars' bodies: one parametric generator, five shapes (car-shape.ts). bodyFor(id) returns the body's
// surface functions (the cockpit fits its glass, dash and doors to them) and buildBody() files its geometry in a Kit.
//
// The shape is a handful of functions of z (the car's length): the plan width, the fender crests, the deck's centre,
// and a canopy (a superellipse in section) for the cabin, blended into the deck with a smooth max so the beltline
// fillets itself. Sections are sampled by arc length and lofted into one skin; the wheel arches are cut by starting
// each section's side at the arch edge. A smooth warp sets the nose's chin and the tail's lower half back, so the
// ends lean like a real car's instead of standing as flat walls. Glass is generated from outlines on the same
// surface, with a black frit border that hides where the paint was cut away beneath it. Shut lines are drawn by the
// paint shader (car-mats).
//
// Car frame: metres, x right, y up, the car faces -z, origin on the ground under the middle of the car.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Kit, V3, v3, curve, clamp, sstep, gridGeo, roundPoly, roundRect, mat, tubeGeo, latheGeo, extrude } from './car-kit';
import type { ShutLine } from './car-mats';
import { EYE } from './spec';
import { CarId, ShapeParams, shapeFor, rearR, seatOffset } from './car-shape';

export interface Arch { z: number; yc: number; R: number; cut: number }
export interface BodyOptions {
  q: 'phone' | 'high';
  glass?: boolean;           // windows (and the frit); false leaves the openings to be filled by the cockpit
  clip?: (c: V3) => boolean; // keep only skin quads whose centroid passes
  extras?: boolean;          // lamps, grilles, splitter, diffuser, exhausts, wipers, badges, wing (default true)
  mirrors?: boolean;         // door mirrors (default true)
}
export type CarBody = ReturnType<typeof makeBody>;
const bodies = new Map<string, CarBody>();
export function bodyFor(id: CarId = 'rossini-gt'): CarBody {
  if (!bodies.has(id)) bodies.set(id, makeBody(shapeFor(id)));
  return bodies.get(id)!;
}

function smax(a: number, b: number, k: number) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return a + (b - a) * h + k * h * (1 - h); }
// point in a convex quad (2D), shrunk by m
function inQuad(p: [number, number], q: [number, number][], m: number) {
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
    const cross = (ex * (p[1] - a[1]) - ey * (p[0] - a[0])) / l;
    if (cross < m) return false;
  }
  return true;
}
const ccw = (q: [number, number][]) => {
  let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
  return s > 0 ? q : [...q].reverse();
};
function offsetGeo(g: THREE.BufferGeometry, d: number) {
  const p = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * d, p.getY(i) + nn.getY(i) * d, p.getZ(i) + nn.getZ(i) * d);
  p.needsUpdate = true;
  return g;
}
// a param grid split into a frit border (black) and the clear middle
function glassPanel(kit: Kit, rows: V3[][], border: number, flip: boolean, keyGlass = 'glass', keyFrit = 'frit') {
  const ni = rows.length, nj = rows[0].length;
  const g = offsetGeo(gridGeo(rows, { flip }), 0.003);
  const idx = g.index!.array, inner: number[] = [], outer: number[] = [];
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const k = (i * (nj - 1) + j) * 6, frit = i < border || j < border || i >= ni - 1 - border || j >= nj - 1 - border;
    (frit ? outer : inner).push(...Array.from(idx.slice(k, k + 6)));
  }
  const gi = g.clone(); gi.setIndex(inner);
  const go = g.clone(); go.setIndex(outer);
  kit.add(keyGlass, gi); kit.add(keyFrit, go);
}

function makeBody(P: ShapeParams) {
  const { ZF, ZR, YSILL } = P;
  const AXLE = P.axle;
  const mkArch = (z: number, R: number, r: number): Arch => ({ z, yc: r, R, cut: Math.sqrt(R * R - (r - YSILL) ** 2) });
  const ARCHES = [mkArch(AXLE.zF, P.arch[0], AXLE.r), mkArch(AXLE.zR, P.arch[1], rearR(P))];
  const WP = curve(P.WP), FH = curve(P.FH), CC = curve(P.CC), RH = curve(P.RH), GB = curve(P.GB);
  const { ZC0, ZC1, DROP, ROLL } = P;
  const LOWC = P.lowCarbon ?? null;
  const DIFF = P.diffuser.half;

  // the nose and tail are rounded in plan and in elevation: a superellipse quadrant of radius R and exponent p (p > 2
  // starts with zero curvature, so the rounding blends into the flanks without a crease in the reflections)
  const ends = (z: number): [number, number] => {
    const q = (R: number, t: number, p = 2) => (t > 0 ? R * (1 - Math.pow(Math.max(0, 1 - Math.pow(Math.min(R, t) / R, p)), 1 / p)) : 0);
    const n = P.nose, t = P.tail;
    return [q(n.R, ZF + n.R - z, n.p) + q(t.R, z - (ZR - t.R), t.p), q(n.Ry, ZF + n.Ry - z, 2.4) + q(t.Ry, z - (ZR - t.Ry))];
  };
  // the side intake's scallop: the door's lower half sweeps inward to feed it
  const scallop = (z: number, y: number) => {
    const S = P.scallop, zr = S.rake ? z + S.rake * (y - S.yc) : z, ramp = sstep(S.z0, S.z1, zr) * (1 - sstep(S.e0, S.e1, zr));
    const v = (S.tilt ? y - S.yc - S.tilt * sstep(S.z0, S.e1, z) : y - S.yc) / S.h;
    return S.depth * ramp * (S.pow ? Math.exp(-Math.pow(Math.abs(v), S.pow)) : Math.exp(-v * v * v * v));
  };
  const sideRaw = (z: number, y: number, Ys: number) => {
    const w = WP(z) - ends(z)[0];
    const tuck = 0.075 * Math.pow(1 - sstep(YSILL, 0.4, y), 1.6), tumble = 0.035 * sstep(0.55, Ys, y);
    return w * (1 - tuck - tumble) - scallop(z, y);
  };
  const shoulderY = (z: number) => FH(z) - DROP;
  // (crown, the hypercar: the deck stays low across the middle and rises steeply into a peaked crest)
  const CROWN = P.crown ?? 0;
  const deck = (z: number, a: number, Ws: number) => {
    const Fh = FH(z), Ys = Fh - DROP, xF = Ws - ROLL, C = CC(z);
    if (a <= xF) { const u = a / xF, s = CROWN ? Math.pow(u, CROWN) : 1 - (1 - u * u) ** 2; return C + (Fh - C) * s; }
    const t = Math.min(1, (a - xF) / ROLL);
    return Ys + DROP * Math.sqrt(Math.max(0, 1 - t * t));
  };
  const canopy = (z: number, a: number) => {
    if (z < ZC0 || z > ZC1) return -9;
    const gb = GB(z); if (a >= gb) return -9;
    const base = CC(z), h = RH(z) - base; if (h <= 0) return -9;
    return base + h * Math.sqrt(1 - Math.pow(a / gb, P.P));
  };

  const body = {
    // the shoulder: where the side meets the top (half-width and height, before the end drop)
    shoulder(z: number) { const Ys = shoulderY(z); return { Ws: sideRaw(z, Ys, Ys), Ys }; },
    // the top surface's height at half-width a (|x|)
    top(z: number, a: number) {
      const { Ws } = body.shoulder(z);
      return smax(deck(z, Math.min(a, Ws), Ws), canopy(z, a), P.K) - ends(z)[1];
    },
    // the side surface's half-width at height y (below the shoulder)
    side(z: number, y: number) { return sideRaw(z, y, shoulderY(z)); },
    // where the body's side starts: the sill, or the arch edge over a wheel
    yStart(z: number) {
      let y = YSILL;
      for (const A of ARCHES) { const dz = Math.abs(z - A.z); if (dz < A.cut) y = Math.max(y, A.yc + Math.sqrt(A.R * A.R - dz * dz)); }
      return y;
    },
    // half-width of the canopy flank at height y (for side glass), by bisection
    canopyX(z: number, y: number) {
      let lo = 0, hi = body.shoulder(z).Ws;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (body.top(z, m) > y) lo = m; else hi = m; }
      return (lo + hi) / 2;
    },
    // the top surface's outward normal at (x, z)
    topNormal(x: number, z: number, out = new THREE.Vector3()) {
      const e = 0.002, a = Math.abs(x), s = Math.sign(x) || 1;
      const fa = (body.top(z, a + e) - body.top(z, Math.max(0, a - e))) / (a + e - Math.max(0, a - e)) * s;
      const fz = (body.top(z + e, a) - body.top(z - e, a)) / (2 * e);
      return out.set(-fa, 1, -fz).normalize();
    },
    halfWidth: (z: number) => WP(z),
  };

  // a point on the nose's corner skin at half-width ax and height y (the front-facing flank ahead of the front
  // wheel), by bisection along z, and the skin's outward normal there (right side)
  const cornerZ = (ax: number, y: number) => {
    let lo = ZF, hi = ZF + P.nose.R + 0.2;
    for (let i = 0; i < 36; i++) { const m = (lo + hi) / 2; if (body.side(m, y) < ax) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  const cornerN = (y: number, z: number) => {
    const e = 0.002, dz = (body.side(z + e, y) - body.side(z - e, y)) / (2 * e), dy = (body.side(z, y + e) - body.side(z, y - e)) / (2 * e);
    return v3(1, -dy, -dz).normalize();
  };
  const CORNER_Q = P.cornerIntake ? ccw(P.cornerIntake) : null;

  // the ends' lean: the nose's chin and the tail's lower half are set back (a smooth warp of everything filed in the
  // body's kit; the wheels are added rigid)
  const warp = (p: V3) => {
    let moved = false;
    const n = P.nose, t = P.tail;
    const wn = 1 - sstep(ZF, ZF + 0.55, p.z);
    if (wn > 0 && n.tuck > 0 && p.y < n.tuckY) { p.z += n.tuck * wn * Math.pow(1 - sstep(YSILL - 0.03, n.tuckY, p.y), 1.6); moved = true; }
    const wt = sstep(ZR - 0.55, ZR, p.z);
    if (wt > 0 && t.tuck > 0 && p.y < t.tuckY) { p.z -= t.tuck * wt * Math.pow(1 - sstep(YSILL - 0.03, t.tuckY, p.y), 1.6); moved = true; }
    return moved;
  };

  // ---------------------------------------------------------------------------------------------- glass outlines
  const WS = P.WS;
  const wsXZ = (s: number, t: number): [number, number] => {
    const zb = WS.zb + 0.03 * s * s, zt = WS.zt + 0.025 * s * s;
    return [s * (WS.xb + (WS.xt - WS.xb) * t), zb + (zt - zb) * t];
  };
  const wsPoint = (s: number, t: number, off = 0, out = new THREE.Vector3()) => {
    const [x, z] = wsXZ(s, t), y = body.top(z, Math.abs(x));
    out.set(x, y, z);
    if (off) out.addScaledVector(body.topNormal(x, z), off);
    return out;
  };
  // side glass, in side view (z, y): corners front-bottom, rear-bottom, rear-top, front-top
  const SG = { fb: [...P.SG.fb] as number[], rb: [...P.SG.rb] as number[], rt: [...P.SG.rt] as number[], ft: [P.SG.ftZ, body.top(P.SG.ftZ, P.SG.ftA ?? 0.66) - 0.004] as number[] };
  const sgZY = (u: number, v: number): [number, number] => {
    const bz = SG.fb[0] + (SG.rb[0] - SG.fb[0]) * u, by = SG.fb[1] + (SG.rb[1] - SG.fb[1]) * u;
    const tz = SG.ft[0] + (SG.rt[0] - SG.ft[0]) * u, ty = SG.ft[1] + (SG.rt[1] - SG.ft[1]) * u;
    return [bz + (tz - bz) * v, by + (ty - by) * v];
  };
  const sgPoint = (u: number, v: number, side: 1 | -1, out = new THREE.Vector3()) => {
    const [z, y] = sgZY(u, v);
    return out.set(side * body.canopyX(z, y), y, z);
  };
  // rear screen, in top view
  const RG = P.RG;
  const rgPoint = (s: number, t: number, out = new THREE.Vector3()) => {
    const x = s * (RG.x0 + (RG.x1 - RG.x0) * t), z = RG.z0 + (RG.z1 - RG.z0) * t;
    return out.set(x, body.top(z, Math.abs(x)), z);
  };
  // the glass roof (Vela E), in top view: a rectangle that narrows a little toward the back
  const RF = P.roofGlass;
  const rfPoint = (s: number, t: number, out = new THREE.Vector3()) => {
    if (!RF) return out.set(0, 0, 0);
    const z = RF.z0 + (RF.z1 - RF.z0) * t, x = s * RF.x * (1 - 0.1 * t) * Math.min(1, GB(z) / 0.8);
    return out.set(x, body.top(z, Math.abs(x)), z);
  };
  const WS_Q = ccw([wsXZ(-1, 0), wsXZ(1, 0), wsXZ(1, 1), wsXZ(-1, 1)]);
  const SG_Q = ccw([SG.fb, SG.rb, SG.rt, SG.ft] as [number, number][]);
  const RG_Q = ccw([[-RG.x0, RG.z0], [RG.x0, RG.z0], [RG.x1, RG.z1], [-RG.x1, RG.z1]]);
  const RF_Q = RF ? ccw([[rfPoint(-1, 0).x, RF.z0], [rfPoint(1, 0).x, RF.z0], [rfPoint(1, 1).x, RF.z1], [rfPoint(-1, 1).x, RF.z1]]) : null;
  const INTAKE = P.intake, LOUVRE = P.louvre;
  const IQ = P.intakeQ ?? null;

  // ---------------------------------------------------------------------------------------------- shut lines
  const shutLines = (): ShutLine[] => {
    const hy = P.noseStyle === 'hyper';
    const L: ShutLine[] = [
      { plane: 'side', pts: P.door, r: 0.04 },                                                                  // doors
      ...(hy ? [] : [{ plane: 'top', pts: P.frontLid, r: 0.07 } as ShutLine]),                                 // front lid
      { plane: 'side', pts: [[ZF + 0.58, 0.45], [ZF + 0.46, 0.655]], seg: true },                               // front bumper seams
      { plane: 'side', pts: [[ZR - 0.58, 0.47], [ZR - 0.32, 0.84]], seg: true },                                // rear bumper seams
      { plane: 'side', pts: [[1.0, 0.775], [1.12, 0.775], [1.12, 0.86], [1.0, 0.86]], r: 0.015, side: 1 },     // fuel filler / charge port
    ];
    if (P.handles === 'flush') {
      // flush handles: a slot in the door's upper rear corner, both sides
      const z1 = P.door[2][0] - 0.12, z0 = z1 - 0.2, y = P.door[2][1] - 0.13;
      L.push({ plane: 'side', pts: [[z0, y], [z1, y], [z1, y + 0.026], [z0, y + 0.026]], r: 0.012 });
    }
    // the engine lid (between the haunches, round the louvres or the rear screen)
    if (hy) { /* (the hypercar: no engine lid; the deck is open either side of the spine) */ }
    else if (P.tailStyle !== 'vela') L.push({ plane: 'top', pts: [[-0.47, RG.z0 - 0.04], [0.47, RG.z0 - 0.04], [0.47, ZR - 0.36], [-0.47, ZR - 0.36]], r: 0.06 });
    else L.push({ plane: 'top', pts: [[-0.55, RG.z1 + 0.06], [0.55, RG.z1 + 0.06], [0.55, ZR - 0.2], [-0.55, ZR - 0.2]], r: 0.06 });   // the boot
    return L;
  };

  // ---------------------------------------------------------------------------------------------- the skin
  function sec(z: number, nS: number, nT: number): V3[] {
    const [, dy] = ends(z), { Ws, Ys } = body.shoulder(z), y0 = Math.min(body.yStart(z), Ys - 0.02);
    const pts: [number, number][] = [];
    for (let i = 0; i < nS; i++) {
      const y = y0 + (Ys - y0) * (i / (nS - 1));
      pts.push([body.side(z, y), y0 + (y - y0) * (Ys - dy - y0) / (Ys - y0)]);
    }
    // the top: dense samples (the roll-off by angle, then across), resampled by arc length
    const dense: [number, number][] = [], xF = Ws - ROLL;
    for (let k = 0; k <= 16; k++) { const a = xF + ROLL * Math.cos((k / 16) * Math.PI / 2); dense.push([a, body.top(z, a)]); }
    for (let k = 1; k <= 180; k++) { const a = xF * (1 - k / 180); dense.push([a, body.top(z, a)]); }
    const cum = [0];
    for (let k = 1; k < dense.length; k++) cum.push(cum[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]));
    const L = cum[cum.length - 1];
    let kk = 0;
    for (let i = 1; i <= nT; i++) {
      const s = (i / nT) * L;
      while (kk < cum.length - 2 && cum[kk + 1] < s) kk++;
      const f = (s - cum[kk]) / Math.max(1e-9, cum[kk + 1] - cum[kk]);
      pts.push([dense[kk][0] + (dense[kk + 1][0] - dense[kk][0]) * f, dense[kk][1] + (dense[kk + 1][1] - dense[kk][1]) * f]);
    }
    const right = pts.map(([x, y]) => v3(x, y, z));
    const left = pts.slice(0, -1).reverse().map(([x, y]) => v3(-x, y, z));
    return [...right, ...left];
  }

  function buildBody(kit: Kit, o: BodyOptions) {
    const high = o.q === 'high';
    const nS = high ? 18 : 11, nT = high ? 44 : 26;
    const prevWarp = kit.warp;
    kit.warp = warp;
    // stations along z: a base step, finer at the ends and either side of each arch's vertical cut
    const zset = new Set<number>();
    const step = high ? 0.028 : 0.05;
    for (let z = ZF; z <= ZR + 1e-6; z += step) zset.add(+z.toFixed(4));
    for (let k = 1; k <= 12; k++) { zset.add(+(ZF + 0.3 * (k / 12) ** 2).toFixed(4)); zset.add(+(ZR - 0.18 * (k / 12) ** 2).toFixed(4)); }
    for (const A of ARCHES) for (const s of [-1, 1]) { zset.add(+(A.z + s * (A.cut - 0.0015)).toFixed(4)); zset.add(+(A.z + s * (A.cut + 0.0015)).toFixed(4)); }
    if (INTAKE) for (let z = INTAKE.z1 - 0.06; z < INTAKE.z1 + 0.12; z += 0.012) zset.add(+z.toFixed(4));
    // (the hypercar's raked scoop: its ends cross the stations diagonally, so through each end the stations are
    // finer and evenly spaced, in place of the base ones)
    const SC = P.scallop, zones: [number, number][] = SC.rake ? [[SC.z0, SC.z1], [SC.e0, SC.e1]].map(([a, b]) => [a - SC.rake! * SC.h * 1.15, b + SC.rake! * SC.h * 1.15] as [number, number]) : [];
    for (const [a, b] of zones) {
      for (const z of [...zset]) if (z > a && z < b) zset.delete(z);
      const st = high ? 0.018 : 0.03, n = Math.ceil((b - a) / st);
      for (let k = 0; k <= n; k++) zset.add(+(a + (b - a) * (k / n)).toFixed(4));
    }
    zset.add(ZF); zset.add(ZR);
    const zs = [...zset].filter((z) => z >= ZF && z <= ZR).sort((a, b) => a - b);

    const rows = zs.map((z) => sec(z, nS, nT));
    const nj = rows[0].length, ni = rows.length;
    // the skin, minus the openings (glass, side intakes, louvres) and anything the clip drops
    const pos = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2);
    for (let i = 0; i < ni; i++) {
      let u = 0;
      for (let j = 0; j < nj; j++) {
        const p = rows[i][j], k = i * nj + j;
        if (j > 0) u += p.distanceTo(rows[i][j - 1]);
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = u; uv[k * 2 + 1] = p.z;
      }
    }
    const idx: number[] = [], cIdx: number[] = [], c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const glass = o.glass ?? true;
    for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
      const a = rows[i][j], b = rows[i][j + 1], cc = rows[i + 1][j], d = rows[i + 1][j + 1];
      c.copy(a).add(b).add(cc).add(d).multiplyScalar(0.25);
      e1.subVectors(d, a); e2.subVectors(b, cc); n.crossVectors(e2, e1).normalize();
      if (o.clip && !o.clip(c)) continue;
      // openings
      const ax = Math.abs(c.x);
      if (n.y > 0.25 && inQuad([c.x, c.z], WS_Q, 0.022)) continue;
      if (n.y > 0.25 && inQuad([c.x, c.z], RG_Q, 0.022)) continue;
      if (RF_Q && n.y > 0.25 && inQuad([c.x, c.z], RF_Q, 0.035)) continue;
      if (Math.abs(n.x) > 0.2 && ax > 0.3 && inQuad([c.z, c.y], SG_Q, 0.022)) continue;
      if (INTAKE && Math.abs(n.x) > 0.3 && c.z > INTAKE.z0 + 0.012 && c.z < INTAKE.z1 - 0.012 && c.y > INTAKE.y0 + 0.012 && c.y < INTAKE.y1 - 0.012) continue;
      if (CORNER_Q && n.z < -0.15 && c.z < ZF + 0.7 && inQuad([ax, c.y], CORNER_Q, 0.008)) continue;
      if (LOUVRE && n.y > 0.3 && ax < LOUVRE.x - 0.012 && c.z > LOUVRE.z0 + 0.012 && c.z < LOUVRE.z1 - 0.012) continue;
      const ia = i * nj + j, ib = ia + 1, ic = ia + nj, id = ic + 1;
      // a carbon roof panel (Corsa): the canopy's top between the windscreen header and the rear screen
      const carbon = P.carbonRoof && n.y > 0.55 && c.z > WS.zt + 0.04 && c.z < RG.z0 - 0.03 && ax < GB(c.z) * 0.8 && c.y > 1.1;
      // two-tone (the hypercar): the skin ahead of the front wheels and behind the rears is carbon low down
      // (by row of the side, counted up from the sill, so the line runs smoothly along the body)
      const row = j < nS - 1 ? j : j >= nj - nS ? nj - 2 - j : 1e9;
      const low = LOWC && ((c.z < ARCHES[0].z - ARCHES[0].cut + 0.01 && row < Math.round(LOWC[0] * (nS - 1))) || (c.z > ARCHES[1].z + ARCHES[1].cut - 0.01 && row < Math.round(LOWC[1] * (nS - 1))));
      // through the scoop's diagonal ends (the hypercar), each quad is split along the diagonal that lies closer to
      // the surface: along the crease, not across it (a cross split shades the crease as a zigzag)
      if (zones.length && row < 1e8 && zones.some(([za, zb]) => c.z > za && c.z < zb)) {
        const yc = (a.y + b.y + cc.y + d.y) / 4, xt = body.side(c.z, yc);
        const ebc = Math.abs((Math.abs(b.x) + Math.abs(cc.x)) / 2 - xt), ead = Math.abs((Math.abs(a.x) + Math.abs(d.x)) / 2 - xt);
        if (ead < ebc) { (carbon || low ? cIdx : idx).push(ia, ib, id, ia, id, ic); continue; }
      }
      (carbon || low ? cIdx : idx).push(ia, ib, ic, ib, id, ic);
    }
    const mkSkin = (ix: number[]) => {
      const skin = new THREE.BufferGeometry();
      skin.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
      skin.setAttribute('uv', new THREE.BufferAttribute(uv.slice(), 2));
      skin.setIndex(ix); skin.computeVertexNormals();
      return skin;
    };
    {
      // normals from the whole skin (so the carbon roof's edge shades like the paint round it)
      const all = mkSkin([...idx, ...cIdx]);
      const paintG = all.clone(); paintG.setIndex(idx);
      kit.add('paint', paintG);
      if (cIdx.length) {
        const cg = all.clone(); cg.setIndex(cIdx); const cu = cg.attributes.uv as THREE.BufferAttribute, cp = cg.attributes.position, cn = cg.attributes.normal;
        // the weave in plan (the roof); the two-tone's sides and ends take it in their own planes
        for (let k = 0; k < cu.count; k++) {
          if (!LOWC) { cu.setXY(k, cp.getX(k), cp.getZ(k)); continue; }
          const sc = 1 / 0.15;   // the same weave as the splitter and the skirts
          if (Math.abs(cn.getY(k)) > 0.6) cu.setXY(k, cp.getX(k) * sc, cp.getZ(k) * sc);
          else if (Math.abs(cn.getX(k)) > Math.abs(cn.getZ(k))) cu.setXY(k, cp.getZ(k) * sc, cp.getY(k) * sc);
          else cu.setXY(k, cp.getX(k) * sc, cp.getY(k) * sc);
        }
        kit.add('carbon', cg);
      }
    }

    const keep = (p: V3) => !o.clip || o.clip(p);
    // the nose and tail faces, with their openings
    const capShape = (z: number, notch: boolean) => {
      const r = sec(z, nS, nT), s = new THREE.Shape();
      s.moveTo(r[0].x, r[0].y);
      for (let j = 1; j < r.length; j++) s.lineTo(r[j].x, r[j].y);
      if (notch) { const w = DIFF, wt = P.diffuser.top ?? DIFF; s.lineTo(-w, YSILL); s.lineTo(-wt, P.diffuser.h); s.lineTo(wt, P.diffuser.h); s.lineTo(w, YSILL); }
      s.closePath();
      return s;
    };
    const intakeF = roundPoly(P.noseIntake, 0.04);
    const M = P.rearMesh;
    const meshR = M ? roundRect(M.w, M.h, 0.04, 0, M.cy) : null;
    if (keep(v3(0, 0.3, ZF))) {
      const s = capShape(ZF, false); s.holes.push(intakeF);
      const g = new THREE.ShapeGeometry(s, 6); g.rotateY(Math.PI); g.translate(0, 0, ZF);
      kit.add(LOWC ? 'carbon' : 'paint', g, null, LOWC ? 0.15 : 1);
    }
    if (keep(v3(0, 0.3, ZR))) {
      const s = capShape(ZR, true); if (meshR) s.holes.push(meshR);
      const g = new THREE.ShapeGeometry(s, 6); g.translate(0, 0, ZR);
      kit.add('paint', g, null, 1);
    }

    // arch lips (the skin's edge turned in) and the wheel-well liners
    for (const A of ARCHES) {
      if (!keep(v3(0.9, 0.6, A.z))) continue;
      for (const sd of [1, -1]) {
        const lip: V3[][] = [];
        for (const z of zs) {
          const dz = Math.abs(z - A.z); if (dz > A.cut - 0.001) continue;
          const y = body.yStart(z), x = body.side(z, y) * sd, dir = v3(0, A.yc - y, A.z - z).normalize();
          lip.push([v3(x, y, z), v3(x - sd * 0.04, y, z).addScaledVector(dir, 0.006)]);
        }
        // the vertical edges either side, from the sill to the arch
        const edge = (z: number, s2: number) => {
          const rowsE: V3[][] = [];
          for (let k = 0; k <= 8; k++) { const y = YSILL + (A.yc + Math.sqrt(A.R * A.R - A.cut * A.cut) - YSILL) * (k / 8), x = body.side(z, y) * sd; rowsE.push([v3(x, y, z), v3(x - sd * 0.04, y, z + s2 * 0.006)]); }
          return rowsE;
        };
        const add = (r: V3[][], flip: boolean) => kit.add('paint', gridGeo(r, { flip }), null, 1);
        add(lip, sd < 0);
        add(edge(A.z - A.cut, 1), sd < 0);
        add(edge(A.z + A.cut, -1), sd > 0);
        // liner: a partial cylinder round the wheel, open toward it
        const phc = Math.asin((YSILL - A.yc) / A.R), rowsL: V3[][] = [];
        for (let k = 0; k <= 24; k++) {
          const ph = phc + (Math.PI - 2 * phc) * (k / 24), z = A.z + Math.cos(ph) * (A.R + 0.004), y = A.yc + Math.sin(ph) * (A.R + 0.004);
          rowsL.push([v3(sd * (body.side(z, Math.max(YSILL, Math.min(y, 0.7))) - 0.03), y, z), v3(sd * 0.47, y, z)]);
        }
        kit.add('liner', gridGeo(rowsL, { flip: sd > 0 }), null, 0.2);
        // inner wall of the well
        const wall = new THREE.CircleGeometry(A.R + 0.004, 24, phc, Math.PI - 2 * phc); wall.rotateY(sd * Math.PI / 2); wall.translate(sd * 0.47, A.yc, A.z);
        kit.add('liner', wall, null, 0.2);
      }
    }
    // underside: the floor between the wheels and the sill bottoms
    if (keep(v3(0, 0.13, 0))) {
      const f0 = AXLE.zF - 0.55, f1 = P.diffuser.z0;
      const floor = new THREE.PlaneGeometry(1.4, f1 - f0); floor.rotateX(Math.PI / 2); floor.translate(0, YSILL + 0.005, (f0 + f1) / 2);
      kit.add('dark', floor, null, 0.5);
      for (const sd of [1, -1]) {
        const r: V3[][] = [];
        for (const z of zs) { if (body.yStart(z) > YSILL + 1e-4 || z < ZF + 0.2 || z > f1) { if (r.length > 1) { kit.add('dark', gridGeo(r, { flip: sd < 0 }), null, 0.5); } r.length = 0; continue; } r.push([v3(sd * body.side(z, YSILL), YSILL, z), v3(sd * 0.7, YSILL + 0.005, z)]); }
        if (r.length > 1) kit.add('dark', gridGeo(r, { flip: sd < 0 }), null, 0.5);
      }
    }

    if (glass) buildGlass(kit, keep);
    if (o.extras ?? true) buildExtras(kit, keep, intakeF, meshR, sec(ZR, nS, nT), high);
    kit.warp = prevWarp;
    if (o.mirrors ?? true) for (const sd of [1, -1] as const) mirrorParts(kit, sd, true);
  }

  // ---------------------------------------------------------------------------------------------- glass
  const windscreenRows = (ns: number, nt: number, off = 0) => {
    const rows: V3[][] = [];
    for (let i = 0; i <= nt; i++) { const r: V3[] = []; for (let j = 0; j <= ns; j++) r.push(wsPoint(-1 + 2 * (j / ns), i / nt, off)); rows.push(r); }
    return rows;
  };
  const sideGlassRows = (side: 1 | -1, nu: number, nv: number) => {
    const rows: V3[][] = [];
    for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(sgPoint(j / nu, i / nv, side)); rows.push(r); }
    return rows;
  };
  const roofRows = (ns: number, nt: number) => {
    const rows: V3[][] = [];
    for (let i = 0; i <= nt; i++) { const r: V3[] = []; for (let j = 0; j <= ns; j++) r.push(rfPoint(-1 + 2 * (j / ns), i / nt)); rows.push(r); }
    return rows;
  };
  function buildGlass(kit: Kit, keep: (p: V3) => boolean) {
    if (keep(v3(0, 1, -0.6))) glassPanel(kit, windscreenRows(30, 18), 1, false);
    for (const sd of [1, -1] as const) if (keep(v3(sd * 0.8, 1, 0))) glassPanel(kit, sideGlassRows(sd, 24, 10), 1, sd < 0);
    if (keep(v3(0, 1.2, 0.6))) {
      const nt = Math.max(8, Math.round((RG.z1 - RG.z0) / 0.04)), rows: V3[][] = [];
      for (let i = 0; i <= nt; i++) { const r: V3[] = []; for (let j = 0; j <= 14; j++) r.push(rgPoint(-1 + 2 * (j / 14), i / nt)); rows.push(r); }
      glassPanel(kit, rows, 1, false);
    }
    if (RF && keep(v3(0, 1.3, 0.2))) glassPanel(kit, roofRows(16, 14), 1, false);
  }

  // ---------------------------------------------------------------------------------------------- door mirrors
  // a wedge-nosed pod on a blade from the door's top front corner; the glass faces back, flush in its rim
  const MIRROR = { at: v3(...P.mirrorAt), w: 0.205, h: 0.094, d: 0.12, glass: [0.172, 0.074] as [number, number] };
  // the headlamp beams' origin, right side (PlayerCar mirrors it): the blade's middle on the hypercar, set when its
  // lamps are built; the other cars keep the game's fixed lamp point
  const beamAt = v3(0.62, 0.55, -2.2);
  // this car's driver's eye (the hypercar's driver sits lower and further in: car-shape seatOffset)
  const eye = EYE.clone().add(v3(...seatOffset(P)));
  // Each mirror is aimed for the driver, as a driver would set it: the glass's normal halves the angle between the
  // eye and the view it should show (straight back, so the inboard edge just shows the flank)
  const mirrorQ = (side: 1 | -1) => {
    const c = v3(side * MIRROR.at.x, MIRROR.at.y, MIRROR.at.z + MIRROR.d / 2);
    const view = v3(side * 0.05, -0.02, 1).normalize();
    const nn = eye.clone().sub(c).normalize().add(view).normalize();
    const x = v3(0, 1, 0).cross(nn).normalize(), y = nn.clone().cross(x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, nn));
  };
  const mirrorGlassPlacement = (side: 1 | -1, inset = 0.006) => {
    const q = mirrorQ(side);
    const p = v3(0, 0, MIRROR.d / 2 - inset).applyQuaternion(q).add(v3(side * MIRROR.at.x, MIRROR.at.y, MIRROR.at.z));
    return { p, q };
  };
  // superellipse section of the housing at t (0 nose .. 1 back face)
  const podSection = (t: number, nn: number, side: 1 | -1): V3[] => {
    const s = Math.sqrt(1 - (1 - t) ** 2.2), out: V3[] = [];
    for (let j = 0; j < nn; j++) {
      const a = (j / nn) * Math.PI * 2, cc = Math.cos(a), sn = Math.sin(a);
      const x = Math.sign(cc) * Math.pow(Math.abs(cc), 2 / 3.2) * MIRROR.w / 2 * s, y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 3.2) * MIRROR.h / 2 * s;
      out.push(v3(side * x * (1 - 0.08 * Math.max(0, cc)), y * (y < 0 ? 0.85 : 1), -MIRROR.d / 2 + MIRROR.d * t));
    }
    return out;
  };
  function mirrorParts(kit: Kit, side: 1 | -1, withGlass: boolean, housingKey = P.id === 'rossini-corsa' || P.id === 'oc-hyper' ? 'carbon' : 'paint') {
    const q = mirrorQ(side), c = v3(side * MIRROR.at.x, MIRROR.at.y, MIRROR.at.z);
    const m = new THREE.Matrix4().compose(c, q, v3(1, 1, 1));
    const rows: V3[][] = [];
    for (let i = 0; i <= 10; i++) rows.push(podSection(i / 10, 40, side));
    kit.add(housingKey, gridGeo(rows, { closeU: true, flip: side < 0 }), m, housingKey === 'carbon' ? 0.06 : 0.3);
    // the back: a black rim, then the glass a few mm in
    const back = podSection(1, 40, side), inner = back.map((p) => v3(p.x * 0.9, p.y * 0.86, p.z));
    kit.add('trim', gridGeo([back, inner], { closeU: true, flip: side < 0 }), m, 0.1);
    const cup = new THREE.ShapeGeometry(new THREE.Shape(inner.map((p) => new THREE.Vector2(p.x, p.y))), 1);
    if (side < 0) { const ix = cup.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } }
    cup.translate(0, 0, MIRROR.d / 2 - 0.012);
    kit.add('dark', cup, m, 0.1);
    if (withGlass) { const g = new THREE.PlaneGeometry(MIRROR.glass[0], MIRROR.glass[1]); const gp = mirrorGlassPlacement(side); g.applyQuaternion(gp.q); g.translate(gp.p.x, gp.p.y, gp.p.z); kit.add('mirror', g, null, 0.2); }
    // the stalk to the door: a thin body-coloured aerofoil (about 70 mm chord, 14 mm thick) that rises out of the
    // door's shoulder, below the side glass, and flares at both ends
    const A = MIRROR.at, path: V3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, e = t * t * (3 - 2 * t);
      path.push(v3(side * (A.x - 0.143 + 0.118 * t), A.y - 0.147 + 0.132 * e, A.z + 0.032 - 0.022 * t));
    }
    const flare = (i: number) => 1 + 0.35 * Math.max(0, 1 - i / 2) + 0.25 * Math.max(0, (i - 6) / 2);
    kit.add(housingKey, tubeGeo(path, (i) => 0.0068 * flare(i), 10, { rb: (i) => 0.034 * flare(i), up: v3(0, 1, 0) }), null, 0.1);
  }

  // ---------------------------------------------------------------------------------------------- vents
  // An applied vent on a top surface (bonnet, front fenders): a dark well a hair proud of the paint, a raised frame
  // and angled blades, so it never opens a hole in the skin. Region in top view: x0..x1 (signed), z0..z1.
  function topVent(kit: Kit, x0: number, x1: number, z0: number, z1: number, n: number, frameKey = 'carbon') {
    const Y = (x: number, z: number) => body.top(z, Math.abs(x));
    const nx = 10, nz = 12, well: V3[][] = [];
    for (let i = 0; i <= nz; i++) { const z = z0 + (z1 - z0) * (i / nz), r: V3[] = []; for (let j = 0; j <= nx; j++) { const x = x0 + (x1 - x0) * (j / nx); r.push(v3(x, Y(x, z) + 0.002, z)); } well.push(r); }
    kit.add('dark', gridGeo(well, { flip: false }), null, 0.2);
    // the frame: a 14 mm band round the outline, 4 mm proud, with an inner wall down to the well
    const ring = (grow: number, lift: number) => {
      const r: V3[] = [], k = 8;
      const P2 = (x: number, z: number) => v3(x, Y(x, z) + lift, z);
      const a0 = x0 - grow, a1 = x1 + grow, b0 = z0 - grow, b1 = z1 + grow;
      for (let j = 0; j < k; j++) r.push(P2(a0 + (a1 - a0) * j / k, b0));
      for (let j = 0; j < k; j++) r.push(P2(a1, b0 + (b1 - b0) * j / k));
      for (let j = 0; j < k; j++) r.push(P2(a1 - (a1 - a0) * j / k, b1));
      for (let j = 0; j < k; j++) r.push(P2(a0, b1 - (b1 - b0) * j / k));
      return r;
    };
    kit.add(frameKey, gridGeo([ring(0.016, 0.0015), ring(0.006, 0.0045), ring(0, 0.0045), ring(0, 0.002)], { closeU: true, flip: true }), null, 0.06);
    // blades across x, leaning back, their tops just under the frame's lip
    for (let b = 0; b < n; b++) {
      const z = z0 + (z1 - z0) * ((b + 0.5) / n), r0: V3[] = [], r1: V3[] = [];
      for (let j = 0; j <= 8; j++) { const x = x0 + 0.004 + (x1 - x0 - 0.008) * (j / 8); r0.push(v3(x, Y(x, z) + 0.004, z - 0.012)); r1.push(v3(x, Y(x, z) + 0.002, z + 0.016)); }
      kit.add('trim', gridGeo([r0, r1], { flip: false }), null, 0.2);
    }
  }

  // the same as a quad on the top surface (x, z: inner-front, outer-front, outer-rear, inner-rear, for the right side;
  // sd = -1 mirrors it), the blades across its length, with a slight inward bow (the hypercar's cowl vents)
  function topVentQ(kit: Kit, Q: [number, number][], sd: 1 | -1, n: number, frameKey = 'carbon') {
    const at = (u: number, v: number, lift: number) => {
      const ax = Q[0][0] + (Q[1][0] - Q[0][0]) * u, az = Q[0][1] + (Q[1][1] - Q[0][1]) * u;
      const bx = Q[3][0] + (Q[2][0] - Q[3][0]) * u, bz = Q[3][1] + (Q[2][1] - Q[3][1]) * u;
      const x = ax + (bx - ax) * v - 0.03 * Math.sin(Math.PI * v), z = az + (bz - az) * v;
      return v3(sd * x, body.top(z, Math.abs(x)), z).addScaledVector(body.topNormal(sd * x, z), lift);
    };
    const fl = sd < 0;
    const grid = (lift: number, nu: number, nv: number, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
      const rr: V3[][] = [];
      for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(at(u0 + (u1 - u0) * (j / nu), v0 + (v1 - v0) * (i / nv), lift)); rr.push(r); }
      return rr;
    };
    kit.add('dark', gridGeo(grid(0.003, 6, 16), { flip: fl }), null, 0.2);
    // the frame: a band round the outline, proud of the paint, with an inner lip
    const ring = (g: number, lift: number) => {
      const r: V3[] = [], k = 6, kv = 16, a0 = -g * 6, a1 = 1 + g * 6, b0 = -g, b1 = 1 + g;
      for (let j = 0; j < k; j++) r.push(at(a0 + (a1 - a0) * (j / k), b0, lift));
      for (let j = 0; j < kv; j++) r.push(at(a1, b0 + (b1 - b0) * (j / kv), lift));
      for (let j = 0; j < k; j++) r.push(at(a1 - (a1 - a0) * (j / k), b1, lift));
      for (let j = 0; j < kv; j++) r.push(at(a0, b1 - (b1 - b0) * (j / kv), lift));
      return r;
    };
    kit.add(frameKey, gridGeo([ring(0.025, 0.002), ring(0.012, 0.0055), ring(0, 0.0055), ring(0, 0.003)], { closeU: true, flip: !fl }), null, 0.06);
    // blades across the vent, leaning back
    for (let b = 0; b < n; b++) {
      const v = (b + 0.5) / n, r0: V3[] = [], r1: V3[] = [];
      for (let j = 0; j <= 6; j++) { const u = 0.04 + 0.92 * (j / 6); r0.push(at(u, v - 0.018, 0.0055)); r1.push(at(u, v + 0.03, 0.0035)); }
      kit.add('trim', gridGeo([r0, r1], { flip: fl }), null, 0.2);
    }
  }

  // ---------------------------------------------------------------------------------------------- lamps, grilles, aero
  function buildExtras(kit: Kit, keep: (p: V3) => boolean, intakeF: THREE.Shape, meshR: THREE.Shape | null, tailSec: V3[], high = true) {
    const HEAD = P.head;
    const hyper = P.noseStyle === 'hyper', racy = P.noseStyle === 'corsa' || hyper;   // carbon frames and trims
    // an LED strip (the hypercar's ice blue): a ribbon w wide centred on the path, facing nrm(i), lifted off the
    // surface; u runs along it, v across it (the LED map's core and halo). key: the turn signals' amber overlays
    // ('sigL', 'sigR') use the same ribbon under their own keys
    const ledStrip = (pts: V3[], nrm: (i: number) => V3, w: number, lift = 0.0015, key = 'led') => {
      if (!P.led || pts.length < 2) return;
      const rows: V3[][] = [];
      for (let i = 0; i < pts.length; i++) {
        const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize(), n = nrm(i);
        const sd = n.clone().cross(t).normalize().multiplyScalar(w / 2), c = pts[i].clone().addScaledVector(n, lift);
        rows.push([c.clone().sub(sd), c.clone().add(sd)]);
      }
      let g = gridGeo(rows, { flip: false });
      const gn = g.attributes.normal, n0 = nrm(0);
      if (gn.getX(0) * n0.x + gn.getY(0) * n0.y + gn.getZ(0) * n0.z < 0) g = gridGeo(rows, { flip: true });
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < rows.length; i++) for (let j = 0; j < 2; j++) uv.setXY(i * 2 + j, i / (rows.length - 1), j);
      kit.add(key, g);
    };
    // the hypercar's blades (M2): a lit face standing on the nose, its foot along the black lower nose's top edge from
    // blade.x0 off the centre to the head quad's inner end, then along the quad's swept front edge round the fender's
    // corner; over it a dark lamp socket (the smoked lens, the module at its outer end) runs back to the skin, rising
    // blade.socket metres in the FRONT view. All in the lamp material (face and lens are two bands of its map), with
    // a gloss-black cap at each end. PlayerCar's beams start from beamAt.
    if (P.blade && keep(v3(0.6, 0.6, ZF + 0.3))) for (const sd of [1, -1]) {
      const BL = P.blade, xh = HEAD[0][0], xo = HEAD[1][0], yh = body.top(HEAD[0][1], xh);
      // the foot in plan: dense, then resampled by length
      const foot: [number, number][] = [];
      for (let k = 0; k <= 30; k++) {
        const x = BL.x0 + (xh - BL.x0) * (k / 30), y = BL.y0 + (yh - BL.y0) * (k / 30);
        let lo = ZF, hi = HEAD[0][1] + 0.05;
        for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (body.top(m, x) < y) lo = m; else hi = m; }
        foot.push([x, (lo + hi) / 2]);
      }
      for (let k = 1; k <= 40; k++) {
        const u = k / 40, sw = P.bladeSweep ?? 0, z = HEAD[0][1] + (HEAD[1][1] - HEAD[0][1]) * u + sw * u * u * u;
        foot.push([Math.min(xh + (xo - xh) * u, body.shoulder(z).Ws - 0.01), z]);
      }
      const cum = [0];
      for (let k = 1; k < foot.length; k++) cum.push(cum[k - 1] + Math.hypot(foot[k][0] - foot[k - 1][0], foot[k][1] - foot[k - 1][1]));
      const L = cum[cum.length - 1], N = high ? 44 : 26, at = (d: number): [number, number] => {
        let k = 1; while (k < cum.length - 1 && cum[k] < d) k++;
        const t = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
        return [foot[k - 1][0] + (foot[k][0] - foot[k - 1][0]) * t, foot[k - 1][1] + (foot[k][1] - foot[k - 1][1]) * t];
      };
      const F: V3[] = [], T: V3[] = [], S: V3[] = [], us: number[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, [x, z] = at(L * u), [xa, za] = at(L * Math.max(0, u - 0.01)), [xb, zb] = at(L * Math.min(1, u + 0.01));
        let tx = xb - xa, tz = zb - za; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nx = -tz, nz = tx;                                      // across the blade in plan: back and in
        const f = v3(sd * x, body.top(z, x), z).addScaledVector(body.topNormal(sd * x, z), high ? 0.004 : 0.006);
        const t = f.clone().add(v3(0, BL.h, 0));
        // the socket's back edge: on along the plan normal until the skin stands blade.socket over the face's top
        const rise = BL.socket[0] + (BL.socket[1] - BL.socket[0]) * u * u;
        let d = 0.004, sx = x, sz = z;
        for (; d < 0.3; d += 0.003) { sx = x + nx * d; sz = z + nz * d; if (body.top(sz, Math.min(sx, body.shoulder(sz).Ws - 0.01)) >= t.y + rise) break; }
        sx = Math.min(sx, body.shoulder(sz).Ws - 0.01);
        F.push(f); T.push(t); us.push(u);
        S.push(v3(sd * sx, body.top(sz, sx), sz).addScaledVector(body.topNormal(sd * sx, sz), high ? 0.003 : 0.005));
      }
      // the face (map rows 2..46 of 128) and the lens (rows 54..126), each turned to face out of the skin
      const k = Math.floor(N / 2), [xm, zm] = at(L * 0.5), outN = body.topNormal(sd * xm, zm);
      const band = (a: V3[], b: V3[], v0: number, v1: number) => {
        let g = gridGeo([a, b], { flip: false });
        const n = g.attributes.normal as THREE.BufferAttribute;
        if (n.getX(k) * outN.x + n.getY(k) * outN.y + n.getZ(k) * outN.z < 0) g = gridGeo([a, b], { flip: true });
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i <= N; i++) { uv.setXY(i, us[i], v0); uv.setXY(N + 1 + i, us[i], v1); }
        return g;
      };
      kit.add('lamp', band(F, T, 1 - 46 / 128, 1 - 2 / 128));
      kit.add('lamp', band(T, S, 1 - 54 / 128, 1 - 126 / 128));
      // the ends: a gloss-black cap closing the wedge, facing along the blade (in at the inner end, back at the outer)
      for (const i of [0, N]) {
        const j = i ? N - 1 : 1, along = F[i].clone().sub(F[j]).normalize();
        const cap = new THREE.BufferGeometry().setFromPoints([F[i], T[i], S[i]]); cap.setIndex([0, 1, 2]); cap.computeVertexNormals();
        const cn = cap.attributes.normal as THREE.BufferAttribute;
        if (cn.getX(0) * along.x + cn.getY(0) * along.y + cn.getZ(0) * along.z < 0) { cap.setIndex([0, 2, 1]); cap.computeVertexNormals(); }
        kit.add('trim', cap, null, 0.05);
      }
      if (sd > 0) beamAt.copy(F[Math.round(N * 0.55)]).lerp(T[Math.round(N * 0.55)], 0.5).add(v3(0, 0, -0.03));
    }
    // headlamps: a param patch on the fender tops, a hair proud of the paint
    else if (keep(v3(0.6, 0.6, ZF + 0.3))) for (const sd of [1, -1]) {
      const rows: V3[][] = [];
      for (let i = 0; i <= 6; i++) {
        const r: V3[] = [];
        for (let j = 0; j <= 16; j++) {
          const u = j / 16, vv = i / 6;
          const ax = HEAD[0][0] + (HEAD[1][0] - HEAD[0][0]) * u;
          let az = HEAD[0][1] + (HEAD[1][1] - HEAD[0][1]) * u;
          let bx = HEAD[3][0] + (HEAD[2][0] - HEAD[3][0]) * u, bz = HEAD[3][1] + (HEAD[2][1] - HEAD[3][1]) * u;
          if (P.bladeSweep) {
            // the hypercar's blade bends back up the fender's corner (z += sweep u^3 along its front edge); its rear
            // edge is the front edge moved back square to it in plan, so the lens doesn't shear where it turns
            const sw = P.bladeSweep, tx = HEAD[1][0] - HEAD[0][0], tz = HEAD[1][1] - HEAD[0][1] + 3 * sw * u * u, tl = Math.hypot(tx, tz);
            const dep = Math.hypot(HEAD[3][0] - HEAD[0][0], HEAD[3][1] - HEAD[0][1]) * (1 - u) + Math.hypot(HEAD[2][0] - HEAD[1][0], HEAD[2][1] - HEAD[1][1]) * u;
            az += sw * u * u * u; bx = ax - (tz / tl) * dep; bz = az + (tx / tl) * dep;
          }
          let x = ax + (bx - ax) * vv; const z = az + (bz - az) * vv;
          x = Math.min(x, body.shoulder(z).Ws - 0.01);
          if (hyper) r.push(v3(sd * x, body.top(z, x), z).addScaledVector(body.topNormal(sd * x, z), high ? 0.005 : 0.008));   // (the steep nose: along the normal)
          else r.push(v3(sd * x, body.top(z, x) + 0.004, z));
        }
        rows.push(r);
      }
      const g = gridGeo(rows, { flip: sd < 0 });
      const uvA = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 16; j++) uvA.setXY(i * 17 + j, j / 16, 1 - i / 6);
      kit.add('lamp', g);
    }
    // (the hypercar's blades have no field round them: the dark below them is the corner intakes and the carbon
    // lower nose, so nothing is laid over the paint there)
    // the Vela's light bar: a thin lit line across the nose between the headlamps, set in a gloss-black channel
    if (P.noseStyle === 'vela' && keep(v3(0, 0.5, ZF))) {
      const xe = HEAD[0][0] + 0.01, z0 = HEAD[0][1] + 0.02, rowsB: V3[][] = [], rowsC: V3[][] = [];
      for (let j = 0; j <= 24; j++) {
        const x = -xe + 2 * xe * (j / 24), z = z0 + (HEAD[0][1] - z0) * Math.abs(x / xe) ** 2 - 0.004;
        const y = body.top(z, Math.abs(x)), nrm = body.topNormal(x, z);
        rowsB.push([v3(x, y, z).addScaledVector(nrm, 0.003), v3(x, y, z + 0.012).addScaledVector(nrm, 0.003)]);
        rowsC.push([v3(x, y, z - 0.008).addScaledVector(nrm, 0.0015), v3(x, y, z + 0.02).addScaledVector(nrm, 0.0015)]);
      }
      const tr = (r: V3[][]) => r[0].map((_, k) => r.map((row) => row[k]));
      kit.add('trim', gridGeo(tr(rowsC), { flip: true }), null, 0.1);
      const bar = gridGeo(tr(rowsB), { flip: true }), bu = bar.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < bu.count; k++) bu.setXY(k, 0.5, 1 - 17 / 128);
      kit.add('lamp', bar);
    }
    // front intake: frame, tunnel, honeycomb, dark back
    if (keep(v3(0, 0.25, ZF))) {
      const pts = intakeF.getPoints(6);
      const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
      const frame = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.03, cy + (p.y - cy) * 1.1)));
      frame.holes.push(new THREE.Path(pts));
      const fg = new THREE.ShapeGeometry(frame, 4); fg.rotateY(Math.PI); fg.translate(0, 0, ZF - 0.003);
      kit.add(racy ? 'carbon' : 'trim', fg, null, 0.06);
      const tunnel: V3[][] = [pts.map((p) => v3(p.x, p.y, ZF)), pts.map((p) => v3(p.x, p.y, ZF + 0.09))];
      kit.add('dark', gridGeo(tunnel, { flip: false }), null, 0.2);
      const back = new THREE.ShapeGeometry(intakeF, 6); back.rotateY(Math.PI); back.translate(0, 0, ZF + 0.09);
      kit.add('dark', back, null, 0.2);
      const hc = new THREE.ShapeGeometry(intakeF, 6); hc.rotateY(Math.PI); hc.translate(0, 0, ZF + 0.025);
      kit.add('grille', hc, null, 1);
      // strakes split the opening into a centre duct and two radiator ducts
      // (the hypercar: vertical carbon blades at +-0.25 m and a centre fin)
      const strakes = P.noseStyle === 'corsa' ? [-0.3, -0.11, 0.11, 0.3] : P.noseStyle === 'gt' ? [-0.205, 0.205] : hyper ? [-0.25, 0, 0.25] : [];
      for (const x of strakes) {
        const st = new THREE.BoxGeometry(hyper ? 0.02 : 0.026, 0.2, 0.1, 1, 1, 1); st.translate(x, cy, ZF + 0.045);
        kit.add((Math.abs(x) < 0.2 && P.noseStyle === 'corsa') || hyper ? 'carbon' : 'paint', st, null, 0.2);
      }
      // splitter: a carbon blade under the nose, proud of it, with a turned-up lip at each end
      const S = P.splitter;
      const sp = roundRect(S.w, S.d, Math.min(0.2, S.d * 0.4), 0, 0); const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
      sg.rotateX(Math.PI / 2); sg.translate(0, YSILL - 0.008, ZF + S.d / 2 - S.proud);
      kit.add('carbon', sg, null, 0.15);
      if (!hyper) for (const sd of [-1, 1]) {
        const fin = new THREE.BoxGeometry(0.01, 0.06, 0.2); fin.translate(sd * (S.w / 2 - 0.07), YSILL + 0.02, ZF + 0.06 - S.proud * 0.5);
        kit.add('carbon', fin, null, 0.15);
      }
      if (hyper) {
        // the hypercar's splitter: a second, raised tier set back from the blade (the step), tall end plates that
        // rise to the corner intakes, and an LED along the blade's leading edge
        const T = P.splitterStep;
        if (T) {
          const st = new THREE.ExtrudeGeometry(roundRect(T.w, T.d, Math.min(0.16, T.d * 0.4), 0, 0), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
          st.rotateX(Math.PI / 2); st.translate(0, YSILL - 0.008 + T.h, ZF - S.proud + 0.06 + T.d / 2);
          kit.add('carbon', st, null, 0.15);
        }
        for (const sd of [-1, 1]) {
          const ep = new THREE.Shape(); ep.moveTo(0, 0); ep.lineTo(0.36, 0); ep.lineTo(0.36, 0.2); ep.lineTo(0.12, 0.16); ep.closePath();
          const eg = new THREE.ExtrudeGeometry(ep, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
          eg.rotateY(-Math.PI / 2); eg.translate(sd * (S.w / 2 - 0.03) + 0.006, YSILL - 0.01, ZF - S.proud + 0.02);
          kit.add('carbon', eg, null, 0.06);
        }
        const rr = Math.min(0.2, S.d * 0.4), out = roundRect(S.w, S.d, rr, 0, 0).getPoints(10), z0 = ZF + S.d / 2 - S.proud;
        const front = out.filter((q) => q.y < -S.d / 2 + rr + 0.02).map((q) => v3(q.x, YSILL - 0.016, q.y + z0)).sort((a, b) => a.x - b.x)
          .filter((q, i, A) => i === 0 || q.distanceTo(A[i - 1]) > 1e-4);
        const nOut = (i: number) => {
          const a = front[Math.max(0, i - 1)], b = front[Math.min(front.length - 1, i + 1)];
          const n = v3(b.z - a.z, 0, -(b.x - a.x)).normalize();
          return n.z > 0 ? n.negate() : n;
        };
        ledStrip(front.map((q, i) => q.clone().addScaledVector(nOut(i), 0.004)), nOut, 0.012, 0);
      }
      // canards: two dive planes on each corner of the bumper, rooted in the skin
      const CAN: [number, number, number][] = hyper ? [[0.2, 0.17, ZF + 0.36], [0.3, 0.12, ZF + 0.27]] : [[0.24, 0.2, ZF + 0.3], [0.33, 0.15, ZF + 0.2]];
      if (S.canards) for (const sd of [-1, 1]) for (const [y, len, z] of CAN) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0.05); sh.lineTo(len, 0.075); sh.lineTo(0, 0.06); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
        // in the plate's frame: x outward-forward along the corner, y back; laid nearly flat, tilted 14 degrees
        g.rotateX(Math.PI / 2); g.rotateZ(sd * -0.24);
        const root = v3(sd * (body.side(z, y) - 0.015), y, z);
        const m4 = new THREE.Matrix4().makeRotationY(sd > 0 ? -0.5 : Math.PI + 0.5);
        g.applyMatrix4(m4); g.translate(root.x, root.y, root.z);
        kit.add('carbon', g, null, 0.06);
      }
    }
    // corner intakes: an opening in each front corner under the lamp, with a frame that wraps the skin's cut edge,
    // a mesh set 20 mm back and a dark plenum behind it
    if (P.cornerIntake && keep(v3(0.6, 0.3, ZF + 0.1))) for (const sd of [1, -1] as const) {
      const Q = P.cornerIntake, nu = 12, nv = 6;
      const gu = 1 / Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), gv = 1 / Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
      const at = (u: number, v: number, d: number) => {
        const ax0 = Q[0][0] + (Q[1][0] - Q[0][0]) * u, y0 = Q[0][1] + (Q[1][1] - Q[0][1]) * u;
        const ax1 = Q[3][0] + (Q[2][0] - Q[3][0]) * u, y1 = Q[3][1] + (Q[2][1] - Q[3][1]) * u;
        const ax = ax0 + (ax1 - ax0) * v, y = y0 + (y1 - y0) * v, z = cornerZ(ax, y), nn = cornerN(y, z);
        return v3(sd * (ax + nn.x * d), y + nn.y * d, z + nn.z * d);
      };
      const grid = (d: number) => { const rr: V3[][] = []; for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(at(j / nu, i / nv, d)); rr.push(r); } return rr; };
      // the outline (counter-clockwise in u, v), grown outward by g metres
      const ring = (d: number, g: number) => {
        const r: V3[] = [], k = 8, a0 = -g * gu, a1 = 1 + g * gu, b0 = -g * gv, b1 = 1 + g * gv;
        for (let j = 0; j < k; j++) r.push(at(a0 + (a1 - a0) * (j / k), b0, d));
        for (let j = 0; j < k; j++) r.push(at(a1, b0 + (b1 - b0) * (j / k), d));
        for (let j = 0; j < k; j++) r.push(at(a1 - (a1 - a0) * (j / k), b1, d));
        for (let j = 0; j < k; j++) r.push(at(a0, b1 - (b1 - b0) * (j / k), d));
        return r;
      };
      const fl = sd < 0;
      const rl = hyper ? (high ? 0.005 : 0.008) : 0.003;
      kit.add(racy ? 'carbon' : 'trim', gridGeo([ring(rl, 0.012), ring(rl, -0.009)], { closeU: true, flip: fl }), null, 0.06);
      // the hypercar: an LED down the intake's outer edge (just outside its frame), from under the blade's outer end
      // to the splitter, then forward along the splitter's top to its corner
      if (hyper && P.led) {
        const pts: V3[] = [], ns: V3[] = [];
        const o = 0.02 * gu;
        for (let k = 0; k <= 14; k++) { const p = at(1 + o, 1.12 - 1.12 * (k / 14), rl + 0.002), z = p.z, nn = cornerN(p.y, z); pts.push(p); ns.push(v3(sd * nn.x, nn.y, nn.z)); }
        const S = P.splitter, last = pts[pts.length - 1], yS = YSILL - 0.003;
        for (let k = 1; k <= 5; k++) { const t = k / 5; pts.push(v3(last.x + sd * 0.07 * t, last.y + (yS - last.y) * Math.min(1, t * 2.5), last.z - (S.proud - 0.08) * t)); ns.push(v3(sd * 0.6, 0.8, -0.2).normalize()); }
        ledStrip(pts, (i) => ns[i], 0.012, 0.002);
        // the front turn signal: the corner LED's upper two thirds turn amber (PlayerCar shows it when it blinks)
        ledStrip(pts.slice(0, 10), (i) => ns[i], 0.014, 0.0035, sd < 0 ? 'sigL' : 'sigR');
      }
      kit.add('dark', gridGeo([ring(hyper ? rl - 0.002 : 0.001, -0.009), ring(-0.07, -0.009)], { closeU: true, flip: fl }), null, 0.2);
      const hc = gridGeo(grid(-0.02), { flip: fl }), hu = hc.attributes.uv as THREE.BufferAttribute, hp = hc.attributes.position;
      for (let k = 0; k < hu.count; k++) hu.setXY(k, hp.getX(k) - hp.getZ(k) * sd, hp.getY(k));
      kit.add('grille', hc);
      kit.add('dark', gridGeo(grid(-0.07), { flip: fl }), null, 0.2);
    }
    // the bonnet's centre vent and the front fenders' louvres (Corsa)
    if (P.bonnetVent && keep(v3(0, 0.7, -1.8))) topVent(kit, -0.34, 0.34, ZF + 0.5, ZF + 0.84, 6);
    // the hypercar: a louvred vent each side of the bonnet's centre, and a crease up the centre to a small fin at the cowl
    if (P.bonnetVents && keep(v3(0.4, 0.6, -1.8))) for (const sd of [-1, 1]) {
      const V = P.bonnetVents;
      topVent(kit, sd > 0 ? V.x[0] : -V.x[1], sd > 0 ? V.x[1] : -V.x[0], V.z[0], V.z[1], V.n);
    }
    if (hyper && keep(v3(0, 0.6, -1.8))) {
      const z0 = ZF + 0.16, z1 = WS.zb - 0.01, rowsR: V3[][] = [];
      for (let k = 0; k <= 30; k++) {
        const z = z0 + (z1 - z0) * (k / 30), w = 0.03, h = 0.006 + 0.012 * sstep(z0, z1, z) * Math.min(1, (k / 30) * 6);
        rowsR.push([v3(-w, body.top(z, w) - 0.002, z), v3(0, body.top(z, 0) + h, z), v3(w, body.top(z, w) - 0.002, z)]);
      }
      kit.add('paint', gridGeo(rowsR, { flip: true }), null, 1);
      const fin = new THREE.Shape(), zc = WS.zb, yb = body.top(zc, 0);
      fin.moveTo(zc - 0.34, body.top(zc - 0.34, 0) - 0.01); fin.lineTo(zc - 0.02, yb - 0.02); fin.lineTo(zc - 0.02, yb + 0.05); fin.closePath();
      const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
      fg.rotateY(-Math.PI / 2); fg.translate(0.004, 0, 0);
      kit.add('carbon', fg, null, 0.06);
    }
    // the hypercar: long vents laid along the front fenders' inner walls by the cowl (quads, mirrored)
    if (P.ventsQ && keep(v3(0.5, 0.7, -1.5))) for (const Q of P.ventsQ) for (const sd of [-1, 1] as const) topVentQ(kit, Q, sd, 9);
    if (P.fenderVents && keep(v3(0.7, 0.8, -1.2))) for (const sd of [-1, 1]) {
      const a = 0.56, b = Math.min(0.79, body.shoulder(AXLE.zF).Ws - ROLL - 0.02);
      topVent(kit, sd > 0 ? a : -b, sd > 0 ? b : -a, AXLE.zF - 0.02, AXLE.zF + 0.3, 7);
    }

    // rear: lamps, mesh, exhausts, diffuser, wordmark
    if (keep(v3(0, 0.5, ZR))) {
      // the tail's half-width at height y (where its face ends)
      const tailX = (y: number) => body.side(ZR, Math.min(y, body.shoulder(ZR).Ys - 0.005));
      const yTop = body.shoulder(ZR).Ys - ends(ZR)[1];
      const yl = yTop - 0.075;                                 // the lamps' line, just under the tail's top edge
      const bar = (w: number, h: number, y: number, z = ZR + 0.004, u0 = 0, u1 = 0.5) => {
        const g = new THREE.PlaneGeometry(w, h); g.translate(0, y, z);
        const uvA = g.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uvA.count; k++) uvA.setX(k, u0 + (u1 - u0) * uvA.getX(k));
        return g;
      };
      if (P.tailStyle === 'gt' || P.tailStyle === 'corsa') {
        // a gloss-black band across the tail; in it a thin LED line, and at each end a lamp that turns down
        const hw = tailX(yl) - 0.02;
        const band = new THREE.ShapeGeometry(roundRect(hw * 2, 0.1, 0.022, 0, yl - 0.004), 4); band.translate(0, 0, ZR + 0.002);
        kit.add('trim', band, null, 0.2);
        kit.add('tail', bar(hw * 2 - 0.5, 0.012, yl + 0.016));
        // a lamp cluster at each end: a swept lens standing 14 mm proud of the band (its sides catch the light),
        // the outer end turned down, a reflector strip under it
        for (const sd of [-1, 1]) {
          const L = 0.3, H = 0.06, xo = sd * (hw - 0.012), xi = xo - sd * L, y0 = yl - 0.034, y1 = y0 + H;
          const sh = new THREE.Shape();
          const pts: [number, number][] = [[xi + sd * 0.035, y0], [xo, y0 - 0.012], [xo, y1], [xi, y1]];
          sh.moveTo(pts[0][0], pts[0][1]); for (const pp of pts.slice(1)) sh.lineTo(pp[0], pp[1]); sh.closePath();
          const lens = extrude(sh, 0.014, 0.004, 4); lens.translate(0, 0, ZR + 0.001);
          const lu = lens.attributes.uv as THREE.BufferAttribute, lp = lens.attributes.position, xmin = Math.min(xi, xo);
          for (let k = 0; k < lu.count; k++) lu.setXY(k, clamp((lp.getX(k) - xmin) / L, 0, 1) * 0.5, clamp((lp.getY(k) - (y0 - 0.012)) / (H + 0.012), 0, 1));
          lens.computeVertexNormals();
          kit.add('tail', lens);
          const refl = new THREE.ShapeGeometry(roundRect(0.16, 0.008, 0.003, xo - sd * 0.1, y0 - 0.026), 1); refl.translate(0, 0, ZR + 0.0035);
          const ru = refl.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < ru.count; k++) ru.setXY(k, 0.02, 0.1);
          kit.add('tail', refl);
        }
        // the GT's ducktail: a carbon lip along the deck's trailing edge, kicked up 30 mm
        if (P.tailStyle === 'gt') {
          const half = body.shoulder(ZR).Ws - 0.14, rowsD: V3[][] = [];
          for (let k = 0; k <= 32; k++) {
            const x = -half + 2 * half * (k / 32), a = Math.abs(x), e = Math.min(1, (half - a) / 0.05);
            const zb = ZR - 0.09, yb = body.top(zb, a) - ends(zb)[1] * 0 - 0.002, ye = body.top(ZR - 0.012, a);
            rowsD.push([v3(x, yb, zb), v3(x, Math.max(ye, yb - 0.02) + 0.03 * e, ZR + 0.012), v3(x, Math.max(ye, yb - 0.02) + 0.03 * e - 0.009 - 0.003 * e, ZR + 0.014), v3(x, ye - 0.006, ZR - 0.008)]);
          }
          kit.add('carbon', gridGeo(rowsD, { closeU: true, flip: true }), null, 0.1);
        }
      } else if (P.tailStyle === 'brio') {
        // two round lamps a side in a body-coloured tail, each in a chrome ring
        const hw = tailX(yl);
        for (const sd of [-1, 1]) for (const k of [0, 1]) {
          const x = sd * (hw - 0.1 - k * 0.17), y = yl - 0.01, r = 0.056;
          const lamp = new THREE.CircleGeometry(r, 32); lamp.translate(x, y, ZR + 0.005);
          const lu = lamp.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < lu.count; i++) lu.setX(i, 0.5 + 0.5 * lu.getX(i));
          kit.add('tail', lamp);
          const ring = new THREE.TorusGeometry(r + 0.004, 0.005, 6, 32); ring.translate(x, y, ZR + 0.004); kit.add('chrome', ring, null, 0.05);
          const cupG = latheGeo([[r + 0.004, -0.02], [r + 0.004, 0.004]], 32, 'z'); cupG.translate(x, y, ZR); kit.add('dark', cupG, null, 0.05);
        }
      } else if (P.tailStyle === 'hyper') {
        // the hypercar: one thin, full-width red bar under the deck's trailing edge (the tail material, so it
        // brightens on the brakes), tapered at its ends, in a gloss-black channel
        const Bh = P.bar?.h ?? 0.02, yb = yTop - 0.045, hw = Math.min((P.bar?.len ?? 1.66) / 2, tailX(yb) - 0.03);
        const ch = new THREE.ShapeGeometry(roundRect(hw * 2 + 0.04, Bh + 0.026, 0.013, 0, yb), 4); ch.translate(0, 0, ZR + 0.002);
        kit.add('trim', ch, null, 0.2);
        const bs = new THREE.Shape(), tp = 0.16;
        bs.moveTo(-hw, yb); bs.lineTo(-hw + tp, yb - Bh / 2); bs.lineTo(hw - tp, yb - Bh / 2); bs.lineTo(hw, yb); bs.lineTo(hw - tp, yb + Bh / 2); bs.lineTo(-hw + tp, yb + Bh / 2); bs.closePath();
        const bg = new THREE.ShapeGeometry(bs, 1); bg.translate(0, 0, ZR + 0.005);
        const bu = bg.attributes.uv as THREE.BufferAttribute, bp = bg.attributes.position;
        for (let k = 0; k < bu.count; k++) bu.setXY(k, 0.5 * (bp.getX(k) + hw) / (2 * hw), 0.3 + 0.4 * (bp.getY(k) - (yb - Bh / 2)) / Bh);
        kit.add('tail', bg);
        // the rear turn signals: the bar's outer 0.26 m each side, amber, a hair proud (shown by PlayerCar when lit)
        for (const sd of [-1, 1]) {
          const ss = new THREE.Shape(), x0 = hw - 0.26, h2 = Bh / 2 + 0.001;
          ss.moveTo(x0, yb - h2); ss.lineTo(hw - tp, yb - h2); ss.lineTo(hw + 0.002, yb); ss.lineTo(hw - tp, yb + h2); ss.lineTo(x0, yb + h2); ss.closePath();
          const sg = new THREE.ShapeGeometry(ss, 1); if (sd < 0) { sg.scale(-1, 1, 1); const ix = sg.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } }
          sg.translate(0, 0, ZR + 0.0065); sg.computeVertexNormals();
          kit.add(sd < 0 ? 'sigL' : 'sigR', sg, null, 0.05);
        }
        // the stop light's haze (PlayerCar shows it on the brakes): a soft quad 0.11 m tall over the bar and its channel
        const gw = new THREE.PlaneGeometry(hw * 2 + 0.12, 0.11); gw.translate(0, yb, ZR + 0.008); kit.add('brakeGlow', gw);
      } else {
        // Vela: one lit line across the whole tail, wrapping round the corners, over a gloss-black band
        const hw = tailX(yl) - 0.006;
        const band = new THREE.ShapeGeometry(roundRect(hw * 2, 0.064, 0.014, 0, yl), 4); band.translate(0, 0, ZR + 0.002);
        kit.add('trim', band, null, 0.2);
        kit.add('tail', bar(hw * 2 - 0.02, 0.022, yl));
        for (const sd of [-1, 1]) {
          // round the corner: a strip on the side skin just ahead of the tail
          const rowsW: V3[][] = [];
          for (let k = 0; k <= 6; k++) { const z = ZR - 0.16 * (k / 6), x = sd * (body.side(z, yl) + 0.003); rowsW.push([v3(x, yl - 0.011, z), v3(x, yl + 0.011, z)]); }
          const wg = gridGeo(rowsW, { flip: sd > 0 }), wu = wg.attributes.uv as THREE.BufferAttribute;
          for (let k = 0; k < wu.count; k++) wu.setXY(k, 0.25, k % 2 ? 0.55 : 0.4);
          kit.add('tail', wg);
        }
      }
      if (meshR) {
        const pts = meshR.getPoints(6), M = P.rearMesh!;
        kit.add('dark', gridGeo([pts.map((p) => v3(p.x, p.y, ZR)), pts.map((p) => v3(p.x, p.y, ZR - 0.1))], { flip: true }), null, 0.2);
        const back = new THREE.ShapeGeometry(meshR, 6); back.translate(0, 0, ZR - 0.1); kit.add('dark', back, null, 0.2);
        const hc = new THREE.ShapeGeometry(meshR, 6); hc.translate(0, 0, ZR - 0.03); kit.add('grille', hc, null, 1);
        const frame = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * 1.012, M.cy + (p.y - M.cy) * 1.07)));
        frame.holes.push(new THREE.Path(pts));
        const fg = new THREE.ShapeGeometry(frame, 4); fg.translate(0, 0, ZR + 0.002); kit.add('trim', fg, null, 0.2);
      }
      // exhausts: thick-walled titanium tips with a rolled lip, sooty inside
      const tips: [number, number, number, number][] = P.exhaust === 'twin' ? [[0.135, 0.54, 1, 0.058], [-0.135, 0.54, 1, 0.058]]
        : P.exhaust === 'high' ? [[0.11, P.rearMesh!.cy + 0.02, 1, 0.066], [-0.11, P.rearMesh!.cy + 0.02, 1, 0.066]]
          : P.exhaust === 'single' ? [[0, 0.4, 1.55, 0.05]] : [];
      for (const [x, y, sx, r] of tips) {
        const k = r / 0.058;
        const tip = latheGeo([[0.058 * k, ZR - 0.12], [0.064 * k, ZR - 0.02], [0.067 * k, ZR + 0.022], [0.0635 * k, ZR + 0.034], [0.0575 * k, ZR + 0.026], [0.0565 * k, ZR - 0.16]], 40, 'z', { vScale: 0.1 });
        tip.scale(sx, 1, 1); tip.translate(x, y, 0);
        kit.add('exhaust', tip);
        const inner = new THREE.CircleGeometry(0.057 * k, 24); inner.scale(sx, 1, 1); inner.translate(x, y, ZR - 0.15); kit.add('dark', inner, null, 0.1);
      }
      // the lower tail: a carbon valance below the lamps' line, cut round the diffuser's mouth
      {
        const yv = P.tailStyle === 'brio' ? 0.36 : P.tailStyle === 'vela' ? 0.4 : hyper ? P.diffuser.h + 0.02 : 0.43, rightPts: [number, number][] = [];
        for (const p of tailSec) { if (p.x > 0 && p.y <= yv) rightPts.push([p.x, p.y]); }
        rightPts.sort((a, b) => a[1] - b[1]);
        if (rightPts.length) {
          const xAt = (y: number) => { let best = rightPts[0]; for (const p of rightPts) if (p[1] <= y) best = p; return best[0]; };
          const sh = new THREE.Shape(), Dh = P.diffuser.h;
          sh.moveTo(DIFF, YSILL); sh.lineTo(rightPts[0][0], rightPts[0][1]);
          for (const p of rightPts) sh.lineTo(p[0], p[1]);
          sh.lineTo(xAt(yv), yv); sh.lineTo(-xAt(yv), yv);
          for (const p of [...rightPts].reverse()) sh.lineTo(-p[0], p[1]);
          const DT = P.diffuser.top ?? DIFF;
          sh.lineTo(-DIFF, YSILL); sh.lineTo(-DT, Dh); sh.lineTo(DT, Dh); sh.closePath();
          const g = new THREE.ShapeGeometry(sh, 4); g.translate(0, 0, ZR + 0.004);
          kit.add(P.tailStyle === 'brio' || P.tailStyle === 'vela' ? 'trim' : 'carbon', g, null, 0.2);
          // the hypercar: the tail between the valance and the bar is gloss black, framed by the silver, with the
          // mesh and the plate set in it
          if (hyper) {
            const yt = yTop - 0.045 - (P.bar?.h ?? 0.02) / 2 - 0.013, inset = 0.045, side: [number, number][] = [];
            for (const p of tailSec) if (p.x > 0 && p.y > yv && p.y < yt) side.push([p.x - inset, p.y]);
            side.sort((a, b) => a[1] - b[1]);
            const ps = new THREE.Shape();
            ps.moveTo(-(xAt(yv) - inset), yv); ps.lineTo(xAt(yv) - inset, yv);
            for (const q of side) ps.lineTo(q[0], q[1]);
            const xt = side.length ? side[side.length - 1][0] : xAt(yv) - inset;
            ps.lineTo(xt, yt); ps.lineTo(-xt, yt);
            for (const q of [...side].reverse()) ps.lineTo(-q[0], q[1]);
            ps.closePath();
            if (meshR) ps.holes.push(new THREE.Path(meshR.getPoints(6)));
            const pg = new THREE.ShapeGeometry(ps, 4); pg.translate(0, 0, ZR + 0.003);
            kit.add('trim', pg, null, 0.2);
          }
        }
      }
      // diffuser: a ramp up from the floor with strakes
      const D = P.diffuser, ramp: V3[][] = [];
      const yr = (t: number) => YSILL + 0.005 + (D.h - YSILL - 0.005) * (t * t * (3 - 2 * t));
      for (let k = 0; k <= 8; k++) { const t = k / 8, z = D.z0 + (ZR - D.z0) * t; ramp.push([v3(-DIFF, yr(t), z), v3(DIFF, yr(t), z)]); }
      kit.add('dark', gridGeo(ramp, { flip: true }), null, 1);
      // (a trapezoid mouth, the hypercar: the outer strakes are cut down to its slanted sides)
      const DT = D.top ?? DIFF, capY = (x: number) => Math.abs(x) <= DT ? D.h : YSILL + 0.005 + (D.h - YSILL - 0.005) * Math.max(0, (DIFF - Math.abs(x)) / (DIFF - DT));
      for (const x of D.fins) {
        const s = new THREE.Shape(), k0 = (capY(x) - YSILL - 0.005) / (D.h - YSILL - 0.005);
        s.moveTo(D.z0, YSILL + 0.005); s.lineTo(ZR + 0.02, YSILL + 0.005);
        for (let k = 8; k >= 0; k--) { const t = k / 8; s.lineTo(D.z0 + (ZR - D.z0) * t, k0 >= 1 ? yr(t) : YSILL + 0.005 + (yr(t) - YSILL - 0.005) * k0); }
        const fin = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(x + 0.004, 0, 0);
        kit.add(hyper ? 'carbon' : 'dark', fin, null, 1);
      }
      if (hyper) {
        // the plate (the OC mark), an LED outlining the diffuser's mouth and a small lit centre accent in it, and
        // two small cold-gas nozzles set into the diffuser between its centre strakes (dark: unseen at a glance)
        if (P.plate) {
          const pl = new THREE.PlaneGeometry(P.plate.w, P.plate.h); pl.translate(0, P.plate.y, ZR + 0.014);
          kit.add('plate', pl);
          const pb = new RoundedBoxGeometry(P.plate.w + 0.02, P.plate.h + 0.02, 0.012, 2, 0.004); pb.translate(0, P.plate.y, ZR + 0.007);
          kit.add('trim', pb, null, 0.1);
          // the reversing lamps: a slim lens either side of the plate in a gloss-black housing; the lit face
          // ('reverse') is shown by PlayerCar while the car is in reverse
          for (const sd of [-1, 1]) {
            const x = sd * (P.plate.w / 2 + 0.11);
            const hb = new RoundedBoxGeometry(0.15, 0.034, 0.012, 2, 0.005); hb.translate(x, P.plate.y, ZR + 0.007); kit.add('trim', hb, null, 0.1);
            const lf = new THREE.PlaneGeometry(0.13, 0.016); lf.translate(x, P.plate.y, ZR + 0.0135); kit.add('reverse', lf);
          }
        }
        // the LED outlines the mouth on the valance just outside it: across its top, down its slanted sides, and out
        // along the floor to the tail's corners (the sheet's REAR: the outline angles up from the corners)
        const Dh = D.h, DT = D.top ?? DIFF, yb = YSILL + 0.012, xc = body.side(ZR, yb) - 0.04, e = 0.009;
        const mouth = [v3(-xc, yb, 0), v3(-DIFF - e, yb, 0), v3(-DT - e * 0.7, Dh + e * 0.7, 0), v3(DT + e * 0.7, Dh + e * 0.7, 0), v3(DIFF + e, yb, 0), v3(xc, yb, 0)];
        const lp: V3[] = [];
        for (let k = 0; k < mouth.length - 1; k++) for (let j = 0; j < 8; j++) lp.push(mouth[k].clone().lerp(mouth[k + 1], j / 8).setZ(ZR + 0.006));
        lp.push(mouth[mouth.length - 1].clone().setZ(ZR + 0.006));
        ledStrip(lp, () => v3(0, 0, 1), 0.011, 0);
        ledStrip([v3(-0.07, YSILL + 0.16, ZR - 0.06), v3(0, YSILL + 0.16, ZR - 0.06), v3(0.07, YSILL + 0.16, ZR - 0.06)], () => v3(0, 0, 1), 0.016, 0);
        if (P.thrusters) for (const sd of [-1, 1]) {
          const T = P.thrusters, x = sd * T.x;
          const noz = latheGeo([[T.r * 0.82, ZR - 0.12], [T.r, ZR - 0.05], [T.r, ZR - 0.012], [T.r * 0.86, ZR - 0.008], [T.r * 0.7, ZR - 0.03]], 24, 'z', { flip: true });
          noz.translate(x, T.y, 0); kit.add('trim', noz, null, 0.05);
          const nozIn = noz.clone(); { const ix = nozIn.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } }
          nozIn.computeVertexNormals(); kit.add('dark', nozIn, null, 0.05);
          const back = new THREE.CircleGeometry(T.r * 0.72, 20); back.translate(x, T.y, ZR - 0.06); kit.add('dark', back, null, 0.05);
        }
      }
      // the centre brake light (Corsa: a rain light in the diffuser, as on a race car)
      if (P.tailStyle === 'corsa') { const rl = bar(0.07, 0.03, YSILL + 0.1, ZR - 0.05); kit.add('tail', rl); }
    }
    // side skirts: a carbon blade along each sill between the arches, flaring out at its foot (a dark band under
    // the paint, so the body reads lower and thinner from the side)
    if (keep(v3(0.9, 0.15, 0))) for (const sd of [1, -1]) {
      const z0 = ARCHES[0].z + ARCHES[0].cut + 0.012, z1 = ARCHES[1].z - ARCHES[1].cut - 0.012, rowsS: V3[][] = [];
      const fl = P.id === 'rossini-corsa' ? 0.05 : hyper ? 0.065 : 0.03;
      for (let k = 0; k <= 40; k++) {
        const z = z0 + (z1 - z0) * (k / 40), e = Math.min(1, Math.min(z - z0, z1 - z) / 0.05), f = Math.sqrt(e);
        const x = (y: number) => body.side(z, y);
        // (the hypercar's skirt stands taller: the sheet's dark band under the door's scoop)
        const yT = hyper ? 0.29 : 0.255, yM = hyper ? 0.21 : 0.19;
        rowsS.push([v3(sd * (x(yT) + 0.0015), yT, z), v3(sd * (x(yM) + 0.013 * f), yM, z), v3(sd * (x(YSILL) + fl * f), YSILL + 0.006, z), v3(sd * (x(YSILL) + (fl - 0.004) * f), YSILL - 0.006, z), v3(sd * (x(YSILL) - 0.01), YSILL - 0.008, z)]);
      }
      kit.add(P.id === 'vela-e' ? 'trim' : 'carbon', gridGeo(rowsS, { flip: sd > 0 }), null, 0.15);
      // the hypercar: an ice-blue LED along the skirt's outer foot
      if (hyper) {
        const lp: V3[] = [];
        for (let k = 1; k < 40; k++) { const z = z0 + (z1 - z0) * (k / 40); lp.push(v3(sd * (body.side(z, YSILL) + fl + 0.001), YSILL + 0.0, z)); }
        ledStrip(lp, () => v3(sd, 0, 0), 0.01, 0.0015);
        // and a second line under the scoop, along the skirt's top edge (the sheet's upper sill light)
        const lu: V3[] = [];
        for (let k = 0; k <= 16; k++) { const z = -0.55 + 0.7 * (k / 16), y = 0.272; lu.push(v3(sd * (body.side(z, y) + 0.0125), y, z)); }
        ledStrip(lu, () => v3(sd, 0, 0), 0.008, 0.002);
      }
    }
    // side intakes: an opening at the end of the scallop, with a gloss frame, honeycomb and a dark plenum
    if (INTAKE && keep(v3(0.9, 0.5, 0.7))) for (const sd of [1, -1]) {
      const I = INTAKE, nz = 10, ny = 8;
      const conf = (z: number, y: number, d: number) => v3(sd * (body.side(z, y) + d), y, z);
      const grid = (d: number, m = 0) => { const rr: V3[][] = []; for (let i = 0; i <= ny; i++) { const r: V3[] = []; for (let j = 0; j <= nz; j++) r.push(conf(I.z0 + m + (I.z1 - I.z0 - 2 * m) * (j / nz), I.y0 + m + (I.y1 - I.y0 - 2 * m) * (i / ny), d)); rr.push(r); } return rr; };
      const hc = gridGeo(grid(-0.012), { flip: sd < 0 });
      const huv = hc.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < huv.count; k++) huv.setXY(k, hc.attributes.position.getZ(k), hc.attributes.position.getY(k));
      kit.add('grille', hc);
      kit.add('dark', gridGeo(grid(-0.09), { flip: sd < 0 }), null, 0.2);
      const ring = (d: number, grow: number) => { const r: V3[] = []; const z0 = I.z0 - grow, z1 = I.z1 + grow, y0 = I.y0 - grow, y1 = I.y1 + grow; const k = 6;
        for (let j = 0; j < k; j++) r.push(conf(z0 + (z1 - z0) * (j / k), y0, d)); for (let j = 0; j < k; j++) r.push(conf(z1, y0 + (y1 - y0) * (j / k), d));
        for (let j = 0; j < k; j++) r.push(conf(z1 - (z1 - z0) * (j / k), y1, d)); for (let j = 0; j <= k; j++) r.push(conf(z0, y1 - (y1 - y0) * (j / k), d)); return r; };
      kit.add('dark', gridGeo([ring(0.001, 0), ring(-0.09, 0)], { flip: sd < 0 }), null, 0.2);
      kit.add(racy ? 'carbon' : 'trim', gridGeo([ring(0.003, 0.016), ring(0.003, 0)], { flip: sd < 0 }), null, 0.06);
    }
    // a side intake shaped as a quad (the hypercar's deep intake under the haunch, at the end of the scoop): laid
    // on the skin rather than cut through it (a diagonal cut would step along the skin's quads), a dark plenum
    // in a slim carbon frame
    if (IQ && keep(v3(0.9, 0.45, 0.4))) for (const sd of [1, -1]) {
      const Q = IQ, nu = 14, nv = 10, fl = sd < 0;
      const zy = (u: number, v: number): [number, number] => {
        const bz = Q[0][0] + (Q[1][0] - Q[0][0]) * u, by = Q[0][1] + (Q[1][1] - Q[0][1]) * u;
        const tz = Q[3][0] + (Q[2][0] - Q[3][0]) * u, ty = Q[3][1] + (Q[2][1] - Q[3][1]) * u;
        return [bz + (tz - bz) * v, by + (ty - by) * v];
      };
      const conf = (u: number, v: number, d: number) => { const [z, y] = zy(u, v); return v3(sd * (body.side(z, y) + d), y, z); };
      const grid = (d: number) => { const rr: V3[][] = []; for (let i = 0; i <= nv; i++) { const r: V3[] = []; for (let j = 0; j <= nu; j++) r.push(conf(j / nu, i / nv, d)); rr.push(r); } return rr; };
      const gu = 1 / Math.hypot(Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]), gv = 1 / Math.hypot(Q[3][0] - Q[0][0], Q[3][1] - Q[0][1]);
      const ring = (d: number, g: number) => {
        const r: V3[] = [], k = 8, a0 = -g * gu, a1 = 1 + g * gu, b0 = -g * gv, b1 = 1 + g * gv;
        for (let j = 0; j < k; j++) r.push(conf(a0 + (a1 - a0) * (j / k), b0, d));
        for (let j = 0; j < k; j++) r.push(conf(a1, b0 + (b1 - b0) * (j / k), d));
        for (let j = 0; j < k; j++) r.push(conf(a1 - (a1 - a0) * (j / k), b1, d));
        for (let j = 0; j < k; j++) r.push(conf(a0, b1 - (b1 - b0) * (j / k), d));
        return r;
      };
      // (no mesh: the sheet's intake reads as a black opening). It stands off the analytic side (14 mm, 24 on the
      // coarser phone skin): the skin's chords cut across the scoop's crease and would show through anything closer
      const dI = high ? 0.014 : 0.024;
      kit.add('dark', gridGeo(grid(dI), { flip: fl }), null, 0.2);
      kit.add('carbon', gridGeo([ring(0.003, 0.02), ring(dI + 0.003, 0.006), ring(dI + 0.003, -0.006), ring(dI - 0.006, -0.008)], { closeU: true, flip: fl }), null, 0.06);
    }
    // engine-cover louvres between the haunches: dark well, gloss blades
    if (LOUVRE && keep(v3(0, 1.0, 1.3))) {
      const L = LOUVRE, well: V3[][] = [];
      for (let i = 0; i <= 12; i++) { const z = L.z0 + (L.z1 - L.z0) * (i / 12), r: V3[] = []; for (let j = 0; j <= 8; j++) { const x = -L.x + 2 * L.x * (j / 8); r.push(v3(x, body.top(z, Math.abs(x)) - 0.05, z)); } well.push(r); }
      kit.add('dark', gridGeo(well, { flip: false }), null, 0.2);
      const edge: V3[] = [];
      const k = 10; for (let j = 0; j <= k; j++) edge.push(v3(-L.x + 2 * L.x * j / k, 0, L.z0)); for (let j = 1; j <= k; j++) edge.push(v3(L.x, 0, L.z0 + (L.z1 - L.z0) * j / k));
      for (let j = 1; j <= k; j++) edge.push(v3(L.x - 2 * L.x * j / k, 0, L.z1)); for (let j = 1; j <= k; j++) edge.push(v3(-L.x, 0, L.z1 - (L.z1 - L.z0) * j / k));
      const top = edge.map((p) => v3(p.x, body.top(p.z, Math.abs(p.x)) + 0.001, p.z)), bot = edge.map((p) => v3(p.x, body.top(p.z, Math.abs(p.x)) - 0.05, p.z));
      kit.add('dark', gridGeo([top, bot], { flip: false }), null, 0.2);
      // a flange round the opening, on the paint, that covers the skin's stepped edge
      const fl = edge.map((p) => { const d = v3(Math.sign(p.x) * (Math.abs(Math.abs(p.x) - L.x) < 1e-4 ? 1 : 0), 0, Math.abs(p.z - L.z0) < 1e-4 ? -1 : Math.abs(p.z - L.z1) < 1e-4 ? 1 : 0); const q = p.clone().addScaledVector(d, 0.022); return v3(q.x, body.top(q.z, Math.abs(q.x)) + 0.002, q.z); });
      kit.add('trim', gridGeo([fl, top.map((p) => p.clone().setY(p.y + 0.001))], { flip: false }), null, 0.1);
      for (let b = 0; b < L.n; b++) {
        const z = L.z0 + 0.06 + (L.z1 - L.z0 - 0.12) * (b / (L.n - 1)), r0: V3[] = [], r1: V3[] = [];
        for (let j = 0; j <= 10; j++) { const x = -L.x + 0.01 + (2 * L.x - 0.02) * (j / 10), y = body.top(z, Math.abs(x)); r0.push(v3(x, y - 0.002, z - 0.03)); r1.push(v3(x, y - 0.03, z + 0.03)); }
        kit.add('trim', gridGeo([r0, r1], { flip: false }), null, 0.2);
      }
    }
    // the roof scoop (Corsa): a carbon periscope on the roof's crown, its mouth facing forward over the windscreen
    if (P.scoop && keep(v3(0, 1.3, 0.4))) {
      const z0 = 0.18, z1 = 0.8, rowsS: V3[][] = [], nA = 14;
      const hAt = (z: number) => 0.095 * (1 - sstep(z0 + 0.12, z1, z)) * sstep(z0 - 0.02, z0 + 0.03, z), wAt = (z: number) => 0.16 - 0.05 * sstep(z0, z1, z);
      const zsS: number[] = []; for (let k = 0; k <= 22; k++) zsS.push(z0 + (z1 - z0) * (k / 22));
      for (const z of zsS) {
        const r: V3[] = [], w = wAt(z), h = hAt(z);
        for (let j = 0; j <= nA; j++) {
          const a = Math.PI * (j / nA), cx = Math.cos(a), sy = Math.sin(a);
          const x = Math.sign(cx) * Math.pow(Math.abs(cx), 0.45) * w, base = body.top(z, Math.abs(x)) - 0.004;
          r.push(v3(x, base + Math.pow(sy, 0.35) * (h + 0.004), z));
        }
        rowsS.push(r);
      }
      kit.add('carbon', gridGeo(rowsS, { flip: false }), null, 0.06);
      // the mouth: a dark face with a mesh, framed by the shell's lip
      const r0 = rowsS[0].map((p) => p.clone()), r1 = rowsS[2].map((p) => p.clone());
      const mouth = new THREE.Shape(r1.map((p) => new THREE.Vector2(p.x * 0.88, r0[0].y + (p.y - r0[0].y) * 0.85)));
      const mg = new THREE.ShapeGeometry(mouth, 2); mg.rotateY(Math.PI); mg.translate(0, 0, zsS[2] - 0.003); mg.scale(-1, 1, 1);
      kit.add('grille', mg, null, 1);
      const lip = gridGeo([r0, r0.map((p) => v3(p.x * 0.88, r0[0].y + (p.y - r0[0].y) * 0.85, p.z + 0.03))], { flip: true });
      kit.add('carbon', lip, null, 0.06);
    }
    // the rear wing (Corsa): an inverted, cambered main plane with a gurney flap, end plates and swan-neck mounts
    // that hang it from above (the underside, which does the work, stays clean)
    if (P.wing && keep(v3(0, 1.2, ZR - 0.2))) {
      const W = P.wing, aoa = 0.12, nC = 18;
      const sect: [number, number][] = [];
      // a 12 % section with 6 % camber, curved down (inverted): points round from the trailing edge, over the top
      for (let k = 0; k <= nC; k++) { const t = 1 - k / nC, xc = t, th = 0.12 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4), cm = -0.06 * 4 * xc * (1 - xc); sect.push([xc, cm + th]); }
      for (let k = 1; k <= nC; k++) { const t = k / nC, xc = t, th = 0.12 * 5 * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4), cm = -0.06 * 4 * xc * (1 - xc); sect.push([xc, cm - th]); }
      // chord along +z (leading edge forward = -z), tilted trailing edge up
      const toCar = (xc: number, yc: number, x: number) => {
        const zz = (xc - 0.3) * W.chord, yy = yc * W.chord;
        return v3(x, W.y + yy * Math.cos(aoa) + zz * Math.sin(aoa), W.z + zz * Math.cos(aoa) - yy * Math.sin(aoa));
      };
      const xsW: number[] = []; for (let k = 0; k <= 16; k++) xsW.push(-W.span / 2 + W.span * (k / 16));
      const wingRows = xsW.map((x) => sect.map(([a, b]) => toCar(a, b, x)));
      kit.add('carbon', gridGeo(wingRows, { flip: true }), null, 'keep');
      // gurney flap along the trailing edge
      const te0 = toCar(1, 0, -W.span / 2), te1 = toCar(1, 0, W.span / 2);
      const gf = new THREE.BoxGeometry(W.span, 0.022, 0.004); gf.translate(0, (te0.y + te1.y) / 2 + 0.01, te0.z + 0.001); kit.add('trim', gf, null, 0.05);
      // end plates
      for (const sd of [-1, 1]) {
        const ep = new THREE.Shape(); const zc = W.z, yc = W.y;
        // W.plate (the hypercar): bigger, swept plates [length, height] whose trailing edge stands just behind the
        // wing's, with an LED along it
        const PL = W.plate, x1 = zc + W.chord * 0.78, x0 = PL ? x1 - PL[0] : 0, H = PL ? PL[1] : 0;
        if (PL) { ep.moveTo(x0, yc - H * 0.3); ep.lineTo(x1 - 0.06, yc - H * 0.58); ep.lineTo(x1, yc + H * 0.42); ep.lineTo(x0 + 0.16, yc + H * 0.2); ep.closePath(); }
        else { ep.moveTo(zc - W.chord * 0.45, yc - 0.1); ep.lineTo(zc + W.chord * 0.85, yc - 0.12); ep.lineTo(zc + W.chord * 0.85, yc + 0.11); ep.lineTo(zc - W.chord * 0.2, yc + 0.06); ep.closePath(); }
        const eg = new THREE.ExtrudeGeometry(ep, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
        eg.rotateY(-Math.PI / 2); eg.translate(sd * (W.span / 2 + 0.004) + (sd > 0 ? 0.008 : 0), 0, 0);
        kit.add('carbon', eg, null, 0.05);
        if (PL) {
          const xo = sd * (W.span / 2 + 0.0145), a = v3(xo, yc - H * 0.58 + 0.01, x1 - 0.06 - 0.012), b = v3(xo, yc + H * 0.42 - 0.012, x1 - 0.012);
          const lp: V3[] = []; for (let k = 0; k <= 6; k++) lp.push(a.clone().lerp(b, k / 6));
          ledStrip(lp, () => v3(sd, 0, 0), 0.01, 0.001);
        }
      }
      // an LED along the flap's top edge (the hypercar)
      if (W.plate) { const y = (te0.y + te1.y) / 2 + 0.021, z = te0.z + 0.0035; ledStrip([v3(-W.span / 2 + 0.01, y, z), v3(0, y, z), v3(W.span / 2 - 0.01, y, z)], () => v3(0, 0.3, 1).normalize(), 0.006, 0.0005); }
      // swan necks: from the deck behind the louvres, up and back over the wing, down onto its upper surface
      for (const sd of [-1, 1]) {
        const x = sd * W.mountX, zb = W.z - 0.42, yb = body.top(zb, Math.abs(x)) - 0.01;
        const top = toCar(0.45, 0.05, x);
        const pts: V3[] = [];
        for (let k = 0; k <= 14; k++) {
          const t = k / 14;
          // a smooth hook: rise steeply, arc over, drop onto the wing
          const zz = zb + (top.z - zb) * Math.sin(t * Math.PI / 2) ** 0.8, yy = yb + (top.y + 0.1 - yb) * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) - (t > 0.8 ? (t - 0.8) / 0.2 * 0.1 : 0);
          pts.push(v3(x, yy, zz));
        }
        pts[pts.length - 1].copy(top).setY(top.y + 0.005);
        kit.add('carbon', tubeGeo(pts, () => 0.006, 8, { rb: () => 0.032, up: v3(1, 0, 0) }), null, 0.05);
        const foot = new RoundedBoxGeometry(0.04, 0.02, 0.1, 2, 0.006); foot.translate(x, yb + 0.006, zb + 0.01); kit.add('trim', foot);
      }
    }
    // the hypercar's twin fins: thin blades standing on the rear deck either side of the spine, rising toward the
    // back and dropping off over the tail
    if (P.fins && keep(v3(0.5, 1.0, 1.4))) for (const sd of [-1, 1]) {
      const F = P.fins, rowsF: V3[][] = [], n = 28;
      for (let k = 0; k <= n; k++) {
        const t = k / n, z = F.z[0] + (F.z[1] - F.z[0]) * t, x = sd * (F.x[0] + (F.x[1] - F.x[0]) * t);
        const h = F.h * sstep(0, 0.55, t) * (1 - 0.85 * sstep(0.88, 1, t)), base = body.top(z, Math.abs(x)) - 0.008;
        const th = 0.012 * (1 - 0.4 * t), top = base + 0.008 + h;
        rowsF.push([v3(x - th, base, z), v3(x - th * 0.5, top, z), v3(x + th * 0.5, top, z), v3(x + th, base, z)]);
      }
      kit.add('paint', gridGeo(rowsF, { flip: true }), null, 1);
    }
    // the hypercar's rear deck: arched ribs across each opening beside the spine (the structure under the wing)
    if (P.deckRibs && keep(v3(0.5, 0.9, 1.4))) for (const sd of [-1, 1]) for (const z of P.deckRibs.z) {
      const [x0, x1] = P.deckRibs.x, path: V3[] = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, x = x0 + (x1 - x0) * t; path.push(v3(sd * x, body.top(z, x) - 0.004 + 0.045 * Math.sin(Math.PI * t) ** 0.7, z)); }
      kit.add('chrome', tubeGeo(path, () => 0.007, 8, { rb: () => 0.012 }), null, 0.1);
    }
    // the glass roof's frit is part of the panel; flush handles get a satin strip in the slot
    if (P.handles === 'flush' && keep(v3(0.9, 0.8, 0))) for (const sd of [1, -1]) {
      const z1 = P.door[2][0] - 0.12, z0 = z1 - 0.2, y = P.door[2][1] - 0.13 + 0.013, rowsH: V3[][] = [];
      for (let k = 0; k <= 6; k++) { const z = z0 + 0.01 + (z1 - z0 - 0.02) * (k / 6); rowsH.push([v3(sd * (body.side(z, y - 0.006) + 0.0012), y - 0.006, z), v3(sd * (body.side(z, y + 0.006) + 0.0012), y + 0.006, z)]); }
      kit.add('chrome', gridGeo(rowsH, { flip: sd > 0 }), null, 0.05);
    }
    // wipers parked along the base of the windscreen
    if (keep(v3(0, 0.9, WS.zb + 0.05))) for (const [px, len] of [[-0.06, 0.6], [0.6, 0.5]] as [number, number][]) {
      const path: V3[] = [];
      for (let k = 0; k <= 10; k++) { const x = px - len * (k / 10), z = WS.zb + 0.05 + 0.012 * (k / 10); path.push(v3(x, body.top(z, Math.abs(x)) + 0.016, z)); }
      kit.add('dark', tubeGeo(path, () => 0.007, 6, { rb: () => 0.004 }), null, 0.1);
      const blade = path.map((p) => p.clone().add(v3(0, -0.008, -0.012)));
      kit.add('rubber', tubeGeo(blade, () => 0.004, 5, { rb: () => 0.006 }), null, 0.1);
    }
    // badges: the R (or the V) on the nose, the wordmark on the tail (the hypercar's OC sits on the silver just above
    // the bonnet's leading edge, the black lower nose below it)
    if (keep(v3(0, 0.5, ZF + 0.1))) {
      const z = P.noseStyle === 'vela' ? ZF + 0.16 : hyper ? ZF + 0.13 : ZF + 0.1, y = body.top(z, 0), nrm = body.topNormal(0, z);
      const disc = new THREE.CircleGeometry(hyper ? 0.034 : 0.03, 32);
      const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), nrm);
      disc.applyQuaternion(q); disc.translate(0, y + 0.0025, z);
      kit.add('badge', disc);
    }
    if (!hyper && keep(v3(0, 0.86, ZR))) {
      const yw = P.tailStyle === 'brio' ? 0.5 : P.tailStyle === 'vela' ? body.shoulder(ZR).Ys - ends(ZR)[1] - 0.15 : body.shoulder(ZR).Ys - ends(ZR)[1] - 0.03;
      const w = new THREE.PlaneGeometry(0.36, 0.045); w.translate(0, P.tailStyle === 'gt' || P.tailStyle === 'corsa' ? Math.min(yw, 0.885) : yw, ZR + 0.003); kit.add('word', w);
    }
  }

  // ---------------------------------------------------------------------------------------------- a cabin seen through the glass
  // for outside views only: the shapes of the cockpit (dash and binnacle, the wheel, two bucket seats with their
  // bolsters and head sections, the console, the bulkhead) in flat materials, so the windows look into a cabin
  function cabinSilhouette(kit: Kit) {
    // a car whose driver sits lower (the hypercar's seatDrop) has its seats, wheel and hoop lowered with them
    const drop = P.seatDrop ?? 0;
    const put = (key: string, g: THREE.BufferGeometry, m: THREE.Matrix4) => kit.add(key, drop ? g.applyMatrix4(m).translate(0, -drop, 0) : g.applyMatrix4(m), null, 0.3);
    const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, r);
    const D = P.cabinW;
    put('interior', rb(D * 2 - 0.01, 0.2, 0.46, 0.06), mat(0, 0.755, -0.88, -0.08));
    put('interior', rb(P.interior === 'vela' ? 0.9 : 0.5, 0.11, 0.2, 0.04), mat(-(P.seatX ?? 0.37) + (P.interior === 'vela' ? 0.2 : 0), 0.86, -0.66, -0.3));
    put('interior', rb(0.24, 0.34, 1.0, 0.04), mat(0, 0.28, -0.15));
    // the bulkhead follows the canopy, so nothing pokes out through the roof
    {
      const z = 0.56, pts: THREE.Vector2[] = [new THREE.Vector2(D - 0.02, 0.45)];
      for (let k = 0; k <= 14; k++) { const y = 0.82 + (body.top(z, 0) - 0.06 - 0.82) * (k / 14); pts.push(new THREE.Vector2(Math.max(0.02, body.canopyX(z, y) - 0.04), y)); }
      const all = [...pts, ...pts.slice().reverse().map((p) => new THREE.Vector2(-p.x, p.y))];
      const g = new THREE.ShapeGeometry(new THREE.Shape(all), 2); g.rotateY(Math.PI); g.translate(0, 0, z);
      kit.add('interior', g, null, 0.3);
    }
    put('interior', new THREE.TorusGeometry(0.178, 0.022, 8, 32), mat(-(P.seatX ?? 0.37), 0.8, -0.42, -0.38));
    put('interior', rb(0.2, 0.13, 0.06, 0.03), mat(-(P.seatX ?? 0.37), 0.8, -0.43, -0.38));
    const SX = P.seatX ?? 0.37;
    for (const sx of [-SX, SX]) {
      put('seatSil', rb(0.5, 0.11, 0.5, 0.045), mat(sx, 0.29, 0.03));
      const tilt = -0.38;
      put('seatSil', rb(0.34, 0.6, 0.1, 0.04), mat(sx, 0.62, 0.38, tilt));
      for (const s of [-1, 1]) put('seatSil', rb(0.08, 0.56, 0.16, 0.035), mat(sx + s * 0.2, 0.6, 0.39, tilt, 0, s * 0.08));
      put('seatSil', rb(0.27, 0.2, 0.11, 0.05), mat(sx, 1.02, 0.52, tilt));
    }
    // the Corsa's roll hoop behind the seats
    if (P.interior === 'corsa' || P.interior === 'hyper') {
      const hoop: V3[] = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16, a = Math.PI * t; hoop.push(v3(-Math.cos(a) * 0.7, 0.3 + Math.sin(a) * 0.86, 0.5)); }
      const hg = tubeGeo(hoop, () => 0.022, 8); if (drop) hg.translate(0, -drop, 0);
      kit.add('interior', hg, null, 0.1);
    }
  }

  // the hypercar's two cold-gas nozzles (their mouths, in the car's frame, before the tail's lean), for the jets
  const thrusters = P.thrusters ? [-1, 1].map((sd) => v3(sd * P.thrusters!.x, P.thrusters!.y, ZR - 0.01)) : [];
  return {
    thrusters, beamAt, eye, P, ZF, ZR, YSILL, AXLE, ARCHES, body, WS, wsXZ, wsPoint, SG, sgZY, sgPoint, RG, rgPoint, RF, rfPoint, MIRROR, mirrorGlassPlacement,
    mirrorParts, shutLines, buildBody, cabinSilhouette, windscreenRows, sideGlassRows, roofRows, warp,
  };
}

// ------------------------------------------------------------------------------------------------ lamps
// The lamp textures for each car's style, drawn in code: housings, projector lenses, light guides; the tail atlas
// has a bar lens on its left half and a round lens on its right.
function lampTex(kind: 'head' | 'tail', style: 'twin' | 'round' | 'slim' | 'blade') {
  const w = kind === 'head' ? 512 : 1024, h = 128;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; };
  const [c, g] = mk(), [ce, ge] = mk();
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h);
  const projector = (x: number, y: number, r: number) => {
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.35);
    rg.addColorStop(0, '#f4f6f8'); rg.addColorStop(0.5, '#8b9096'); rg.addColorStop(1, '#2a2c2f');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 1.3, 0, Math.PI * 2); g.fill();
    const lg = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 1, x, y, r);
    lg.addColorStop(0, '#9fb4d8'); lg.addColorStop(0.35, '#1b2533'); lg.addColorStop(1, '#05070a');
    g.fillStyle = lg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    ge.fillStyle = 'rgba(160,180,210,0.25)'; ge.beginPath(); ge.arc(x, y, r * 0.7, 0, Math.PI * 2); ge.fill();
  };
  if (kind === 'head') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2d31'); gr.addColorStop(0.5, '#141619'); gr.addColorStop(1, '#0a0b0c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // the reflector's faint sparkle
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (style === 'twin') {
      g.fillStyle = '#5a3a10'; g.fillRect(8, 34, 90, 26);
      for (const cx of [0.5, 0.74]) projector(cx * w, h * 0.58, h * 0.27);
      for (const [ctx, col] of [[g, '#e8eef6'], [ge, '#ffffff']] as const) {
        ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(110, 17); ctx.lineTo(w - 26, 17); ctx.quadraticCurveTo(w - 10, 18, w - 12, 50); ctx.lineTo(w - 14, 96); ctx.stroke();
      }
    } else if (style === 'round') {
      g.fillStyle = '#5a3a10'; g.fillRect(14, 52, 70, 30);
      const x = w * 0.6, y = h * 0.55, r = h * 0.3;
      projector(x, y, r);
      for (const [ctx, col] of [[g, '#e8eef6'], [ge, '#ffffff']] as const) { ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(x, y, r * 1.55, r * 1.5, 0, 0, Math.PI * 2); ctx.stroke(); }
      projector(w * 0.86, h * 0.55, h * 0.13);
    } else if (style === 'blade') {
      // blade (the OC Hypercar, M2): two bands. Rows 0-48: the lit face, an ice-white core inside an ice-blue edge
      // (the sheet's HEADLIGHT DETAIL), a little brighter toward the outer end. Rows 50-128: the lamp socket's smoked
      // lens over a dark reflector with faint chrome ribs, and the three-cell projector module at its outer end
      g.fillStyle = '#04060a'; g.fillRect(0, 0, w, h);
      // (the face's emissive is the car's LED blue at both edges and a pale ice core in its middle third: the tone
      // map keeps the edges blue at the night level, so the blade reads ice blue as on the sheet, not white)
      for (const [ctx, edge, core] of [[g, '#4aa2f4', '#d6eeff'], [ge, '#2f8fe8', '#a6dcff']] as const) {
        const fg = ctx.createLinearGradient(0, 2, 0, 46);
        fg.addColorStop(0, edge); fg.addColorStop(0.22, edge); fg.addColorStop(0.42, core); fg.addColorStop(0.58, core); fg.addColorStop(0.78, edge); fg.addColorStop(1, edge);
        ctx.fillStyle = fg; ctx.fillRect(0, 2, w, 44);
      }
      const lift = ge.createLinearGradient(0, 0, w, 0); lift.addColorStop(0, 'rgba(0,0,0,0.25)'); lift.addColorStop(0.5, 'rgba(0,0,0,0)'); lift.addColorStop(1, 'rgba(0,0,0,0)');
      ge.fillStyle = lift; ge.fillRect(0, 2, w, 44);
      const lg = g.createLinearGradient(0, 50, 0, h); lg.addColorStop(0, '#0e141b'); lg.addColorStop(0.5, '#080b0f'); lg.addColorStop(1, '#030405');
      g.fillStyle = lg; g.fillRect(0, 50, w, h - 50);
      // the blade's light spilling up into the lens over it (the socket band starts at row 54): blue, fading out
      // over the first fifth of the socket, as the sheet's HEADLIGHT DETAIL glows into its recess. Mostly light (the
      // emissive map), hardly paint: the lens stays smoked by day, so from the hood camera, which looks down on the
      // sockets, they read as dark glass with a glow along the blade, not as blue panels
      for (const [ctx, a] of [[g, 0.12], [ge, 0.5]] as const) {
        const sp = ctx.createLinearGradient(0, 54, 0, 72); sp.addColorStop(0, `rgba(47,143,232,${a})`); sp.addColorStop(1, 'rgba(47,143,232,0)');
        ctx.fillStyle = sp; ctx.fillRect(0, 54, w, 18);
      }
      for (let x = 14; x < w - 110; x += 18) { g.fillStyle = 'rgba(150,170,195,0.12)'; g.fillRect(x, 56, 2, 66); }
      g.fillStyle = 'rgba(190,205,225,0.3)'; g.fillRect(0, 52, w, 2);
      for (let k = 0; k < 3; k++) {
        const x = w - 92 + k * 30, y = 90;
        g.fillStyle = '#5d646c'; g.fillRect(x - 12, y - 22, 24, 44);
        const cg = g.createLinearGradient(x, y - 18, x, y + 18); cg.addColorStop(0, '#9fc6ee'); cg.addColorStop(0.45, '#14202e'); cg.addColorStop(1, '#05070a');
        g.fillStyle = cg; g.fillRect(x - 9, y - 18, 18, 36);
        ge.fillStyle = 'rgba(150,200,255,0.3)'; ge.fillRect(x - 6, y - 10, 12, 20);
      }
    } else {
      // slim: a light guide along the top edge, five matrix cells under it
      for (const [ctx, col] of [[g, '#eef2f8'], [ge, '#ffffff']] as const) { ctx.fillStyle = col; ctx.fillRect(0, 12, w, 10); }
      for (let k = 0; k < 5; k++) {
        const x = 150 + k * 66, y = 62;
        g.fillStyle = '#7d8288'; g.fillRect(x - 24, y - 22, 48, 44);
        const lg = g.createLinearGradient(x, y - 18, x, y + 18); lg.addColorStop(0, '#8fa3c4'); lg.addColorStop(0.4, '#172030'); lg.addColorStop(1, '#05070a');
        g.fillStyle = lg; g.fillRect(x - 20, y - 18, 40, 36);
        ge.fillStyle = 'rgba(160,180,210,0.2)'; ge.fillRect(x - 12, y - 10, 24, 20);
      }
      g.fillStyle = '#5a3a10'; g.fillRect(20, 40, 90, 22);
    }
  } else if (style === 'blade') {
    // the hypercar's full-width bar (u 0..0.5, v 0.3..0.7 of this map): a smoked lens that reads dark red when the
    // bar is only a tail light, over a light guide whose emissive fills the band with a hotter core. The diffuse is
    // kept dark so the sun doesn't light the bar as if it were on, and the brake level (lampMaterials' levels) shows
    // as a clear step in daylight, not only at night
    g.fillStyle = '#120103'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#2a0407' : '#1c0205'; g.fillRect(x, h * 0.3, 4, h * 0.4); }
    const eg = ge.createLinearGradient(0, h * 0.3, 0, h * 0.7);
    eg.addColorStop(0, '#5a0408'); eg.addColorStop(0.3, '#ff2626'); eg.addColorStop(0.5, '#ff5a50'); eg.addColorStop(0.7, '#ff2626'); eg.addColorStop(1, '#5a0408');
    ge.fillStyle = eg; ge.fillRect(0, h * 0.3, w, h * 0.4);
  } else {
    // left half: a bar lens (vertical optics, a bright core band); right half: a round lens (rings, a bright ring)
    const W2 = w / 2;
    g.fillStyle = '#2a0204'; g.fillRect(0, 0, W2, h);
    for (let x = 0; x < W2; x += 6) { g.fillStyle = x % 12 ? '#5a0a0e' : '#40060a'; g.fillRect(x, 0, 3, h); }
    for (const [ctx, col, a] of [[g, '#ff3b3b', 0.9], [ge, '#ff2020', 1]] as const) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(0, h * 0.36, W2, h * 0.24); ctx.globalAlpha = 1; }
    const cx = W2 + h / 2 + (W2 - h) / 2, cy = h / 2;
    g.fillStyle = '#1e0103'; g.fillRect(W2, 0, W2, h);
    for (let r = 62; r > 4; r -= 5) { g.strokeStyle = r % 10 ? '#5c0a0f' : '#3f0509'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    for (const [ctx, col] of [[g, '#ff4040'], [ge, '#ff2424']] as const) { ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2); ctx.stroke(); }
    ge.fillStyle = 'rgba(255,40,40,0.35)'; ge.beginPath(); ge.arc(cx, cy, 30, 0, Math.PI * 2); ge.fill();
    // the round lens texture is drawn centred in the right half; the round lamps map u 0.5..1 onto it
    void style;
  }
  const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(ce);
  t.colorSpace = te.colorSpace = THREE.SRGBColorSpace; t.anisotropy = te.anisotropy = 8;
  return { map: t, emissiveMap: te };
}
const lampCache = new Map<string, { lamp: THREE.Material; tail: THREE.Material }>();
// the tail material's emissive level as a tail light and on the brakes (PlayerCar reads them from the material's
// userData.levels): 1.6 and 5 for every car's lamps, and for the hypercar's thin bar a dim tail light and a bright
// stop, because a 2 cm bar of saturated red reads the same at 1.6 and 5 once the tone map has clipped it
const TAIL_LEVELS: Record<'std' | 'blade', [number, number]> = { std: [1.6, 5], blade: [0.5, 6] };
export function lampMaterials(style: 'twin' | 'round' | 'slim' | 'blade' = 'twin') {
  if (!lampCache.has(style)) {
    const head = lampTex('head', style), tail = lampTex('tail', style);
    lampCache.set(style, {
      // (the blade's socket is a smoked lens in a black recess: it keeps a third of the sky's reflection, so it reads
      // dark over the lit face as on the sheet, not as a pale ledge)
      lamp: new THREE.MeshPhysicalMaterial({ map: head.map, emissive: 0xffffff, emissiveMap: head.emissiveMap, emissiveIntensity: 2.4, metalness: style === 'blade' ? 0.1 : 0.4, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: style === 'blade' ? 0.3 : 1 }),
      tail: new THREE.MeshPhysicalMaterial({ map: tail.map, emissive: 0xffffff, emissiveMap: tail.emissiveMap, emissiveIntensity: TAIL_LEVELS[style === 'blade' ? 'blade' : 'std'][0], roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 }),
    });
    lampCache.get(style)!.tail.userData.levels = TAIL_LEVELS[style === 'blade' ? 'blade' : 'std'];
  }
  return lampCache.get(style)!;
}

// The GT's numbers and functions, for code written against the single-car module (car-wheel, older tests)
const GT = bodyFor('rossini-gt');
export const ZF = GT.ZF, ZR = GT.ZR, YSILL = GT.YSILL, AXLE = GT.AXLE, ARCHES = GT.ARCHES;
