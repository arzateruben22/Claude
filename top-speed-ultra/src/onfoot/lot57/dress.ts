// P1d's dressing for Lot 57: the details and the baked light that make it worth a photo. All ours, all built in
// code into the venue's batches (one draw call per material family, as before):
//   - two fire tables on the lawn (board-formed concrete, a burner pan of dark glass, flame cards that flicker after
//     dark) on gravel pads, in place of the low tables the lawn chairs faced;
//   - a corrugated-steel hood over each of the Shed's roll-up doors, on tie rods;
//   - our fictional menu board on the Shed's yard wall, under a gooseneck lamp;
//   - neon round the corner pylon's cabinet, both faces (lit when the taproom is open);
//   - a row of bike racks on the frontage strip, a stack of steel kegs by the bins;
//   - pools of warm light on the ground under the string lights, the heaters and the fire tables;
//   - ambient occlusion baked into the ground's vertex colours round walls, fences, tables, planters and the trucks,
//     and a slow variation in the lawn's and the yard's colour so neither reads as one tiled texture;
//   - oil stains on a third of the lot's stalls (lot.ts calls dressLot).
// Every name and mark is ours (fictional). Local metres (coords.ts).
import * as THREE from 'three';
import { Batch, Kit, rand } from './geom';
import { Collider, box, distTo, Hit } from './collide';
import type { Mats } from './mats';
import { flicker } from './mats';
import { ATLAS } from './tex';
import { PLAN } from './coords';

const HEX = { teal: 0x12333a, cream: 0xf3e6c4, red: 0xc8462f, patina: 0x4f7f6a, black: 0x1b1d1f, steel: 0x2b2e31, concrete: 0x9c958a };

/** a smooth value noise (0..1) on a grid of `cell` metres, seeded */
function noise2(seed: number, cell: number) {
  const r = rand(seed), N = 64, T = Array.from({ length: N * N }, () => r());
  const at = (i: number, j: number) => T[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  return (x: number, z: number) => {
    const u = x / cell, v = z / cell, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
    return (at(i, j) * (1 - su) + at(i + 1, j) * su) * (1 - sv) + (at(i, j + 1) * (1 - su) + at(i + 1, j + 1) * su) * sv;
  };
}

/** the fire table at (x, z): its parts in the venue's batches, its glow; the collider is the caller's (lawn chairs) */
export function fireTable(kit: Kit, m: Mats, x: number, z: number) {
  const conc = kit.get('venue-concrete', m.concrete, { uv: 4 });
  const rubber = kit.get('venue-rubber', m.rubber), steel = kit.get('venue-steel', m.steel, { cast: true });
  const fire = kit.get('fire-flames', m.fire, { glow: false, ao: false, order: 6 });
  const gravel = kit.get('fire-gravel', m.gravel, { uv: 1.5, ao: false });
  // the gravel pad (a 2.5 m disc, subdivided so the baked fire light pools on it)
  const ring: [number, number][] = [];
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; ring.push([x + Math.sin(a) * 2.5, z + Math.cos(a) * 2.5]); }
  for (let k = 0; k < 28; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 28];
    gravel.triFine([x, 0.042, z], [ax, 0.042, az], [bx, 0.042, bz], 0xffffff, 0.8);      // (wound to face up)
  }
  // steel edging round the pad
  for (let k = 0; k < 28; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 28]; steel.tube([ax, 0.03, az], [bx, 0.03, bz], 0.025, 3, 0x3a2a20); }
  // board-formed concrete, 1.0 m square, 0.42 m high, a chamfered lip
  conc.box(x, 0.2, z, 1.0, 0.4, 1.0, HEX.concrete);
  conc.box(x, 0.415, z, 1.06, 0.03, 1.06, 0xa8a196);
  // the burner pan: dark steel, filled with dark glass beads
  steel.box(x, 0.43, z, 0.56, 0.02, 0.56, 0x1c1c1e);
  rubber.box(x, 0.445, z, 0.5, 0.012, 0.5, 0x15181c);
  // the flames: three crossed cards (additive, shown after dark when open; mats.ts setNight and flicker)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI, c = Math.cos(a) * 0.3, s = Math.sin(a) * 0.3, y0 = 0.45, y1 = 0.98;
    fire.uvQuad([x - c, y0, z - s], [x + c, y0, z + s], [x + c, y1, z + s], [x - c, y1, z - s], { u0: 0, v0: 0, u1: 1, v1: 1 });
  }
  kit.light({ x, y: 0.75, z, i: 9, ch: 0, reach: 7 });
}

export interface DressOut { colliders: Collider[]; fires: THREE.Vector3[] }

/**
 * Everything else, after the venue is built (its colliders known, its string lights placed): the props, the pools,
 * the baked ground occlusion and the colour variation.
 */
export function dressVenue(kit: Kit, m: Mats, col: Collider[], bulbs: THREE.Vector3[], heaters: [number, number][], fires: [number, number][]): DressOut {
  flicker(m);
  const out: Collider[] = [];
  const steel = kit.get('venue-steel', m.steel, { cast: true });
  const wood = kit.get('venue-wood', m.wood, { uv: 1.6, cast: true });
  const labels = kit.get('venue-labels', m.labels, { uv: 1 });
  const roof = kit.get('shed-awnings', m.roof, { uv: 2, cast: true });
  const keg = kit.get('venue-kegs', m.keg, { uv: 1, cast: true });
  const neonCream = kit.get('neon-cream', m.neonCream, { glow: false, ao: false }), neonRed = kit.get('neon-red', m.neonRed, { glow: false, ao: false });
  const pools = kit.get('venue-pools', m.poolVenue, { glow: false, ao: false, order: 4 });

  // ---- a corrugated hood over each roll-up door on the Shed's yard wall (0.9 m deep, so it clears the string poles)
  const S = PLAN.shed, wallX = S.x1 + 0.14;
  for (const dz of [-38.2, -29.2, -20.2, -11.2]) {
    const z0 = dz - 2.55, z1 = dz + 2.55, x1 = wallX + 0.9, yIn = 4.78, yOut = 4.52;
    roof.quad([wallX, yIn, z0], [wallX, yIn, z1], [x1, yOut, z1], [x1, yOut, z0], 0xd8dade);       // the top
    roof.quad([x1, yOut - 0.02, z0], [x1, yOut - 0.02, z1], [wallX, yIn - 0.02, z1], [wallX, yIn - 0.02, z0], 0xb8babe); // the underside
    steel.box(x1 - 0.02, yOut - 0.06, (z0 + z1) / 2, 0.05, 0.1, z1 - z0, HEX.black);                // the fascia channel
    for (const zz of [z0 + 0.3, z1 - 0.3]) steel.tube([wallX, 6.1, zz], [x1 - 0.05, yOut + 0.02, zz], 0.018, 4, HEX.black);   // tie rods
    // a strip of light under the hood, over the door (lit with the venue's own lights)
    kit.light({ x: wallX + 0.5, y: yOut - 0.3, z: dz, i: 6, ch: 0, reach: 9, down: 0.8 });
  }

  // ---- our menu board on the Shed's yard wall, between the second and third doors, under a gooseneck lamp
  {
    const zc = -24.7, yc = 2.55, w = 2.7, h = 1.69, x = wallX + 0.035;
    wood.box(x + 0.02, yc, zc, 0.05, h + 0.14, w + 0.14, 0x4a3221);
    labels.panel(x + 0.05, yc, zc, w, h, 1, 0, ATLAS.chalk);
    steel.tube([wallX, yc + h / 2 + 0.55, zc], [wallX + 0.55, yc + h / 2 + 0.42, zc], 0.018, 4, HEX.black);
    steel.cyl(wallX + 0.6, yc + h / 2 + 0.28, zc, 0.13, 0.05, 0.16, 10, HEX.black, true);
    kit.light({ x: wallX + 0.6, y: yc + h / 2 + 0.25, z: zc, i: 5, ch: 0, reach: 4, down: 1.2 });
  }

  // ---- neon round the corner pylon's cabinet (both faces): a cream outline and a red rule under the name
  {
    const sx = PLAN.sign.x, sz = PLAN.sign.z, fx = Math.SQRT1_2, fz = -Math.SQRT1_2, ax = -fz, az = fx;   // face normal, along
    for (const sgn of [1, -1]) {
      const o = 0.36, cx = sx + fx * o * sgn, cz = sz + fz * o * sgn, hw = 2.0, y0 = 4.25, y1 = 6.95;
      const P = (d: number, y: number) => [cx + ax * d, y, cz + az * d];
      neonCream.tube(P(-hw, y0), P(hw, y0), 0.022, 5, 0xffffff); neonCream.tube(P(hw, y0), P(hw, y1), 0.022, 5, 0xffffff);
      neonCream.tube(P(hw, y1), P(-hw, y1), 0.022, 5, 0xffffff); neonCream.tube(P(-hw, y1), P(-hw, y0), 0.022, 5, 0xffffff);
      neonRed.tube(P(-1.55, 5.12), P(1.55, 5.12), 0.026, 5, 0xffffff);
    }
  }

  // ---- bike racks on the frontage strip, east of the gate (four inverted U's, galvanised)
  {
    const zc = -50.45;
    for (const x of [6.4, 7.3, 8.2, 9.1]) {
      const a = [x, 0, zc - 0.38], b = [x, 0.72, zc - 0.38], c = [x, 0.86, zc - 0.24], d = [x, 0.86, zc + 0.24], e = [x, 0.72, zc + 0.38], f = [x, 0, zc + 0.38];
      for (const [p, q] of [[a, b], [b, c], [c, d], [d, e], [e, f]]) steel.tube(p, q, 0.024, 6, 0x9ea3a8);
    }
    out.push(box(7.75, zc, 3.2, 0.95, 0, 'rail'));
  }

  // ---- a stack of steel kegs by the bins (four on the ground, two on top), with their rims
  {
    const kx = 20.55, kz = -9.6, R = 0.2, H = 0.58;
    const put = (x: number, y: number, z: number) => {
      keg.cyl(x, y, z, R, R, H, 16, 0xe4e6e8, true);
      for (const yy of [y + 0.05, y + H - 0.05, y + H * 0.3, y + H * 0.7]) keg.cyl(x, yy - 0.012, z, R + 0.012, R + 0.012, 0.024, 16, 0xcfd2d5, false);
      steel.cyl(x, y + H, z, 0.035, 0.035, 0.04, 8, 0x2a2b2c);
    };
    for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) put(kx + dx, 0, kz + dz);
    put(kx - 0.12, H + 0.01, kz); put(kx + 0.2, H + 0.01, kz + 0.1);
    out.push(box(kx, kz, 0.95, 0.95, 0, 'bin'));
  }

  // ---- pools of light on the ground: under the strings (every third bulb), the heaters and the fire tables
  const pool = (x: number, z: number, r: number, y = 0.048, hex = 0xffffff) => pools.uvQuad([x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], [x - r, y, z - r], { u0: 0, v0: 0, u1: 1, v1: 1 }, hex);
  bulbs.forEach((b, i) => { if (i % 3 === 1 && b.y > 3) pool(b.x, b.z, 2.1, 0.048, 0x9a8a78); });
  for (const [x, z] of heaters) pool(x, z, 2.6, 0.05, 0xffb070);
  for (const [x, z] of fires) pool(x, z, 3.0, 0.052, 0xffa060);

  // ---- baked occlusion and colour variation on the ground (vertex colours: no texture, no draw call)
  const occluders = [...col, ...out];
  bakeGroundAO(kit, ['yard-pavers', 'venue-concrete', 'lawn-turf', 'fire-gravel'], occluders);
  vary(kit, 'lawn-turf', 51, 7, 0.82, 1.12);
  vary(kit, 'yard-pavers', 52, 9, 0.9, 1.06);
  vary(kit, 'venue-concrete', 53, 6, 0.9, 1.05);
  return { colliders: out, fires: fires.map(([x, z]) => new THREE.Vector3(x, 0.8, z)) };
}

/** multiply a batch's upward-facing vertices' colours by a slow noise between lo and hi */
function vary(kit: Kit, name: string, seed: number, cell: number, lo: number, hi: number) {
  const e = kit.entries.find((k) => k.name === name); if (!e) return;
  const b = e.batch, n1 = noise2(seed, cell), n2 = noise2(seed + 7, cell * 0.37);
  for (let i = 0; i < b.pos.length; i += 3) {
    if (b.nor[i + 1] < 0.7) continue;
    const x = b.pos[i], z = b.pos[i + 2], k = lo + (hi - lo) * (0.7 * n1(x, z) + 0.3 * n2(x, z));
    b.col[i] *= k; b.col[i + 1] *= k * (name === 'lawn-turf' ? 0.98 + 0.04 * n2(z, x) : 1); b.col[i + 2] *= k;
  }
}

/**
 * Ambient occlusion baked into the ground's vertex colours: what stands on the ground darkens it near its foot, by
 * how tall it is (a wall or a truck most, a bench or a planter a little). The ground grids are a metre or so apart,
 * so it's a soft darkening toward the wall, not a crisp contact line (the blobs under the props do that).
 */
function bakeGroundAO(kit: Kit, names: string[], occ: Collider[]) {
  const reach: Record<string, [number, number]> = {
    wall: [1.8, 0.42], building: [1.8, 0.4], truck: [1.4, 0.45], fence: [0.9, 0.28], gate: [0.6, 0.2], tank: [0.9, 0.3],
    table: [0.6, 0.25], bench: [0.45, 0.18], planter: [0.7, 0.25], counter: [0.8, 0.3], heater: [0.4, 0.15], bin: [0.5, 0.2],
    pole: [0.5, 0.15], post: [0.5, 0.18], sign: [0.8, 0.25], game: [0.4, 0.12], stand: [0.5, 0.2], rail: [0.4, 0.12],
  };
  const hit: Hit = { d: 0, nx: 0, nz: 0 };
  const list = occ.filter((o) => reach[o.tag] && !o.dyn);
  // a coarse hash of the occluders (8 m cells), so each vertex tests only what's near it
  const C = 8, cells = new Map<number, Collider[]>(), key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  for (const o of list) {
    const [x0, z0, x1, z1] = bounds(o), pad = 2;
    for (let j = Math.floor((z0 - pad) / C); j <= Math.floor((z1 + pad) / C); j++) for (let i = Math.floor((x0 - pad) / C); i <= Math.floor((x1 + pad) / C); i++) {
      const k = key(i, j); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(o);
    }
  }
  for (const name of names) {
    const e = kit.entries.find((k) => k.name === name); if (!e) continue;
    const b: Batch = e.batch;
    for (let i = 0; i < b.pos.length; i += 3) {
      if (b.nor[i + 1] < 0.7 || b.pos[i + 1] > 0.2) continue;
      const x = b.pos[i], z = b.pos[i + 2], l = cells.get(key(Math.floor(x / C), Math.floor(z / C))); if (!l) continue;
      let dark = 0;
      for (const o of l) {
        const [R, K] = reach[o.tag]; distTo(o, x, z, hit);
        if (hit.d < R) dark += K * (hit.d <= 0 ? 1 : (1 - hit.d / R) ** 2);
      }
      const k = 1 - Math.min(0.55, dark);
      b.col[i] *= k; b.col[i + 1] *= k; b.col[i + 2] *= k;
    }
  }
}
function bounds(o: Collider): [number, number, number, number] {
  if (o.k === 'circ') return [o.ax - o.r, o.az - o.r, o.ax + o.r, o.az + o.r];
  if (o.k === 'seg') return [Math.min(o.ax, o.bx) - o.r, Math.min(o.az, o.bz) - o.r, Math.max(o.ax, o.bx) + o.r, Math.max(o.az, o.bz) + o.r];
  if (o.k === 'box') { const e = Math.hypot(o.hx, o.hz); return [o.ax - e, o.az - e, o.ax + e, o.az + e]; }
  const P = o.pts!; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 1]); z1 = Math.max(z1, P[i + 1]); }
  return [x0, z0, x1, z1];
}

/** oil stains on about a third of the lot's stalls (one draw call), seeded */
export function dressLot(kit: Kit, m: Mats, stalls: { x: number; z: number; face: number }[]) {
  const st = kit.get('lot-stains', m.stain, { glow: false, ao: false, order: 1 });
  const r = rand(5701);
  for (const s of stalls) {
    if (r() > 0.36) continue;
    const v = Math.floor(r() * 4), rr = 0.5 + r() * 0.5, a = r() * Math.PI;
    // toward the stall's front, where an engine sits (the stall's facing: face is the angle a car's nose points)
    const ox = Math.sin(s.face) * 1.2 + (r() - 0.5) * 0.4, oz = Math.cos(s.face) * 1.2 + (r() - 0.5) * 0.4;
    const x = s.x + ox, z = s.z + oz, ca = Math.cos(a), sa = Math.sin(a);
    const R = (u: number, w: number) => [x + u * ca - w * sa, 0.035, z + u * sa + w * ca];
    st.uvQuad(R(-rr, rr), R(rr, rr), R(rr, -rr), R(-rr, -rr), { u0: v / 4, v0: 0, u1: (v + 1) / 4, v1: 1 });
  }
}

