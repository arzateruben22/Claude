// Vega & Vinnie's outside, from the owner's 13 photos (2026-11-16): the pieces of the site the photos show that the
// venue (venue.ts: the facade, the front walk, the patio, the strip) and the lot (lot.ts: the asphalt, aisle 416, the
// stalls) don't draw. Every piece stands where the slice data and the plan put things; the photos' details are placed
// on that mapped geometry, never the other way round (nothing mapped moves, and the stalls, your stall and the door
// are untouched: the driving game's LAST MILE lane reads them from the venue def).
//   - the pylon at the lot's street edge on Claudina Way (the owner's current pylon: a cream shield, a "<- OPEN" board
//     and a dark panel, here carrying the older pylon's menu list, on two stone pillars in a hedge);
//   - the lot's street edge: clipped hedges with red tips, a low stone-block wall with birds of paradise, backflow
//     pipes by the mapped power pole, a transformer and an LED street light on that pole, two tall fan palms;
//   - the raised centre walkway down the middle of the courtyard lot, between the two stall fields whose wheel stops
//     face it (the 2.9 m strip between the courtyard legs' back-to-back rows), three accessible stalls painted blue with
//     their signs, the "PARKING FOR CUSTOMERS ONLY" and blue "ACCESS" signs, the painted exit arrows;
//   - across Claudina Way: the substation's block wall with its row of tall Italian cypresses behind it, and the yellow
//     painted kerb; on Claudina, a hydrant, a steel cobra-head light and the painted median where the street forks.
// (2026-11-23 repair) and across Claudina from the lot's exit a chain-link fence with pines and fan palms; at the
// strip's south-east corner a stucco pier, a wooden pole with transformer and LED arm, a red-tipped hedge island and the
// parking-rules sign; the accessible stalls moved to the stalls nearest the front door and the strip's corner.
// It draws in the venue's existing batches (the chain-link alone adds one, outside-chain); the hedges, cypresses, pines
// and palm undersides carry a coarse Low part and a fine HD/Ultra part in the same batch (lod.ts), so Low stays cheap.
import { Batch, Kit, P2 } from '../../engine/geom';
import { Collider, box as cbox, circ } from '../../engine/collide';
import type { Stall } from '../../engine/lot';
import type { Frame } from '../../engine/frame';
import type { BarMats } from './mats';
import { ATLAS } from './tex';
import { lod } from './lod';

/** where the photos' pieces stand (game x, z), for the checks and the proof frames */
export const OUTSIDE = {
  pylon: [-6602.3, -9368.6] as P2,
  walkway: { x0: -6636.0, x1: -6603.0, z: -9384.8, w: 1.8 },
  stoneWall: { x: -6602.7, z0: -9358.6, z1: -9364.9 },
  backflow: [-6603.35, -9362.6] as P2,
  pole: [-6605.0, -9361.3] as P2,                  // the mapped power pole (slice infra point)
  streetLight: [-6602.3, -9381.2] as P2,
  hydrant: [-6602.0, -9355.9] as P2,
  palms: [[-6602.3, -9385.6], [-6602.3, -9357.9]] as P2[],
  substationWall: { a: [-6587.1, -9301.0] as P2, b: [-6587.6, -9376.5] as P2 },
  fork: { f: [-6595.5, -9351.7] as P2, a: [-6594.2, -9340.0] as P2, b: [-6597.5, -9340.0] as P2 },
  // the accessible stalls (2026-11-23 repair): the three mapped stalls nearest the front door and its accessible-entrance
  // sign (row 3, the courtyard's north row), and two in front of the strip's arched storefronts by its corner (row 0)
  ada: [[-6618.1, -9369.1], [-6620.9, -9369.1], [-6623.6, -9369.1], [-6609.9, -9400.5], [-6612.6, -9400.5]] as P2[],
  /** across Claudina from the lot's exit (front-exit-street.png): a chain-link fence on the east kerb with pines and
   *  fan palms behind it, gaps at the two mapped driveways opposite (segs 409 and 413) */
  exitFence: { x: -6588.6, runs: [[-9377.4, -9383.6], [-9390.6, -9406.4], [-9414.2, -9428.0]] as P2[] },
  /** the painted exit arrows on the courtyard's exit aisle (seg 415's leg at z -9394.8), one a lane, pointing out to
   *  Claudina Way (2026-11-23 repair: in the lot, 4 m in from the hedge line, not on the street's apron) */
  exitArrows: [[-6606.2, -9393.4], [-6606.2, -9396.3]] as P2[],
  /** the substation inside its mapped fence (infra 167) behind the block wall: steel bus gantries and the two mapped
   *  transformers' radiators and bushings (power:transformer at these points) */
  substation: { gantryX: [-6576.0, -6567.0], gantryZ: [-9351.0, -9360.0, -9369.0], cypressFrom: -9343.0, transformers: [[-6538.6, -9331.1], [-6556.4, -9331.3]] as P2[] },
  /** the street bend's extras: a second hydrant at the bend's west kerb and two cobra-head lights on Claudina's east kerb */
  bend: { hydrant: [-6601.2, -9366.2] as P2, lights: [[-6589.7, -9352.0], [-6590.4, -9322.0]] as P2[] },
  /** the I-5's northbound deck over its mapped bridge span (seg 560, 0.867 to 0.97 of its length): parapets and an
   *  overhead sign gantry, read from the street bend (front-street-bend.png) */
  i5: { seg: 560 },
  /** the strip's south-east corner (building 61's rest ring at frame (21.1, 67.7)) and what lot-strip-corner.png puts
   *  round it: the wooden pole with its transformer and LED arm, the red-tipped hedge island, the parking-rules sign */
  stripCorner: { corner: [-6607.6, -9404.2] as P2, pole: [-6599.4, -9403.6] as P2, island: { x0: -6602.9, x1: -6598.5, z0: -9399.4, z1: -9404.4 }, sign: [-6602.6, -9398.9] as P2 },
  signs: [-6602.35, -9378.9] as P2,
};

export interface BarOutside { colliders: Collider[]; raised: P2[][]; ada: number[] }

export function buildOutside(kit: Kit, m: BarMats, F: Frame, stalls: Stall[], slice?: { seg: { p: number[]; br?: number[][] }[] }): BarOutside {
  const L = (x: number, z: number): P2 => F.toLocal(x, z);
  const concrete = kit.get('venue-concrete', m.concrete, { uv: 4, cast: true });
  const plants = kit.get('venue-plants', m.plant, { cast: true });
  const steelK = kit.get('venue-steel', m.steel, { cast: true });
  // (2026-11-23) the outside's steel (poles, posts, pipes, fence) and the birds of paradise, the pines' trunks and the
  // palms across the street: drawn at every mode but kept out of the shadow maps at HD and Ultra, where Ultra's sun map
  // had no room left; built apart and added to both of their batches' parts at the end (lod.ts)
  const steel = new Batch(steelK.uvScale); steel.ao = steelK.ao;
  const paint = kit.get('bar-paint', m.paint);
  const marks = kit.get('venue-markings', m.marking, { ao: false });
  const signs = kit.get('bar-signs', m.signs, { uv: 1 });
  const signsLit = kit.get('bar-signs-lit', m.signsLit, { uv: 1, glow: false });
  const heads = kit.get('lot-heads', m.lampHead, { glow: false });
  const col: Collider[] = [];
  // detail by mode at no extra draw call (lod.ts): [Low only, HD and Ultra only]
  const [plantsLo, plantsHi] = lod(plants), [, paintHi] = lod(paint), [steelLo, steelHi] = lod(steelK);
  const oPlants = new Batch(plants.uvScale); oPlants.ao = plants.ao;
  const chain = kit.get('outside-chain', m.chain, { uv: 0.6, glow: false });
  /** a rounded clump of leaves (four rings, capped) */
  const blob = (bt: typeof plants, x: number, y: number, z: number, r: number, h: number, seg: number, hex: number, top = hex) => {
    const R = [0.62, 1, 0.86, 0.34], Y = [0, 0.34, 0.74, 1];
    for (let i = 0; i < 3; i++) bt.cyl(x, y + Y[i] * h, z, R[i] * r, R[i + 1] * r, (Y[i + 1] - Y[i]) * h, seg, i < 2 ? hex : top, i === 2);
  };
  const light = (x: number, y: number, z: number, i: number, ch: 0 | 1 | 2, reach: number, down?: number) => kit.light({ x, y, z, i, ch, reach, down });
  /** a leafy red-tipped shrub (photinia, the owner's lot photos) at local (x, z), base y, about r wide and h tall (HD
   *  and Ultra): a core and six or seven smaller clumps round it at hashed angles, glossy dark green, red new growth on
   *  the upper ones' tops */
  const shrubRed = (x: number, y: number, z: number, r: number, h: number, seed: number) => {
    const hs = (k: number) => { const q = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };
    blob(plantsHi, x, y, z, r * 0.6, h, 6, 0x2c4424, hs(0) > 0.4 ? 0x9a3a24 : 0x3f5a2c);
    const n = 6 + (hs(1) > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + hs(k + 2) * 0.8, d = r * (0.45 + 0.3 * hs(k + 9)), rr = r * (0.32 + 0.16 * hs(k + 15)), hh = h * (0.5 + 0.35 * hs(k + 21));
      blob(plantsHi, x + Math.cos(a) * d, y, z + Math.sin(a) * d, rr, hh, 5, k % 2 ? 0x2f4826 : 0x355230, hs(k + 27) > 0.45 ? (hs(k + 31) > 0.5 ? 0xa83e26 : 0x8a3424) : 0x4a6a34);
    }
  };
  const UP = [0, 1, 0];
  /** a flat atlas decal on the ground at game (x, z), w along x, d along z */
  const decal = (x: number, z: number, w: number, d: number, y: number, uv: { u0: number; v0: number; u1: number; v1: number }) => {
    const [lx, lz] = L(x, z);
    signs.uvQuad([lx - w / 2, y, lz + d / 2], [lx + w / 2, y, lz + d / 2], [lx + w / 2, y, lz - d / 2], [lx - w / 2, y, lz - d / 2], uv);
  };
  /** a clipped hedge run along z at game x, z0 to z1, w wide, about h tall: rounded clumps (dark glossy green, red new
   *  growth on top, as the owner's photos show the lot's hedges); HD and Ultra a clump every 0.55 m, Low one every 1.1 m */
  const hedge = (x: number, z0: number, z1: number, w: number, h: number, skip: (z: number) => boolean = () => false) => {
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / 0.55));
    for (let k = 0; k < n; k++) {
      const za = z0 + ((z1 - z0) * k) / n, zb = z0 + ((z1 - z0) * (k + 1)) / n, zc = (za + zb) / 2;
      if (skip(zc)) continue;
      const hh = h * (0.92 + 0.1 * Math.sin(k * 2.3)), [lx, lz] = L(x + 0.04 * Math.sin(k * 1.7), zc), r = w / 2;
      blob(plantsHi, lx, 0, lz, r * 1.05, hh, 8, k % 2 ? 0x2f4426 : 0x34492a, k % 3 === 1 ? 0x7a3a26 : 0x405a32);
      if (k % 2 === 0) { const zl = Math.min(zc + Math.abs(zb - za) / 2, z1 > z0 ? z1 : z0); const [mx, mz] = L(x, (zc + zl) / 2); blob(plantsLo, mx, 0, mz, r * 1.1, hh, 6, 0x33482a, 0x4a5a30); }
      col.push(cbox(lx, lz, w, Math.abs(zb - za), 0, 'planter', false));
    }
  };
  /** birds of paradise: stiff blue-green leaves and orange crests, a clump at game (x, z) */
  const birds = (x: number, z: number, r: number) => {
    const [lx, lz] = L(x, z);
    for (let k = 0; k < 9; k++) {
      const a = k * 2.399, len = r * (0.8 + 0.3 * ((k * 37) % 7) / 7), dx = Math.sin(a), dz = Math.cos(a), px = -dz * 0.07, pz = dx * 0.07;
      const tip = [lx + dx * len * 0.45, len * 1.05, lz + dz * len * 0.45];
      oPlants.quadTo([lx + px, 0.02, lz + pz], [lx - px, 0.02, lz - pz], tip, tip, [dx, 0.3, dz], 0x4f7a64);
      if (k % 3 === 0) { const c = [lx + dx * len * 0.5, len * 1.08, lz + dz * len * 0.5]; oPlants.quadTo(c, [c[0] + dx * 0.22, c[1] + 0.05, c[2] + dz * 0.22], [c[0] + dx * 0.05, c[1] + 0.18, c[2] + dz * 0.05], [c[0] + dx * 0.05, c[1] + 0.18, c[2] + dz * 0.05], [-dz, 0, dx], 0xe8762a); }
    }
  };
  /** a tall fan palm (low-poly): a gently leaning trunk, a skirt of dead fronds, a crown of green ones */
  const palm = (x: number, z: number, h: number, pb: Batch = plants) => {
    const [lx, lz] = L(x, z), lean = 0.35;
    pb.tube([lx, 0, lz], [lx + lean, h, lz + lean * 0.4], 0.22, 7, 0x7a6248);
    const cx = lx + lean, cz = lz + lean * 0.4;
    pb.cyl(cx, h - 1.3, cz, 0.34, 0.55, 1.4, 8, 0x8a6a42);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.45, pz = dx * 0.45, r = 2.4 + 0.4 * Math.sin(k * 3.1);
      const base = [cx, h + 0.1, cz], tip = [cx + dx * r, h + 0.1 - 0.6 - 0.3 * Math.sin(k * 1.7), cz + dz * r];
      pb.quadTo(base, [cx + dx * r * 0.6 + px, h + 0.25, cz + dz * r * 0.6 + pz], tip, [cx + dx * r * 0.6 - px, h + 0.25, cz + dz * r * 0.6 - pz], [0, 1, 0], k % 2 ? 0x56783a : 0x628a40);
      plantsHi.quadTo(base, [cx + dx * r * 0.6 - px, h + 0.25, cz + dz * r * 0.6 - pz], tip, [cx + dx * r * 0.6 + px, h + 0.25, cz + dz * r * 0.6 + pz], [0, -1, 0], 0x3f5a2a);
    }
    const [tx, tz] = [lx, lz]; col.push(circ(tx, tz, 0.3, 'tree', true));
  };

  // ------------------------------------------------------------------ the pylon at the lot's street edge
  {
    const [px, pz] = OUTSIDE.pylon, [lx, lz] = L(px, pz), PZ = [-1.05, 1.05];
    for (const dz of PZ) {
      // (2026-11-23: the stone pillars stand tall out of the hedge, 1.9 m, as in the photo)
      concrete.box(lx, 0.95, lz + dz, 0.66, 1.9, 0.66, 0xb69a74);
      for (let y = 0.14; y < 1.9; y += 0.135) paintHi.box(lx, y, lz + dz, 0.675, 0.014, 0.675, (Math.round(y * 7.4) % 2) ? 0x6a5a48 : 0x7a6650);
      for (const s2 of [1, -1]) for (let y = 0.07; y < 1.85; y += 0.27) signs.panel(lx + s2 * 0.335, y + 0.135, lz + dz, 0.66, 0.27, s2, 0, ATLAS.veneer);
      concrete.box(lx, 1.94, lz + dz, 0.76, 0.08, 0.76, 0xc8b08a);
      steel.box(lx, 4.12, lz + dz, 0.2, 4.8, 0.2, 0x1c1c1e);
      col.push(cbox(lx, lz + dz, 0.62, 0.62, 0, 'pole', true));
    }
    const face = (y: number, h: number, uv: { u0: number; v0: number; u1: number; v1: number }) => {
      paint.box(lx, y, lz, 0.12, h + 0.08, 1.98, 0x1c1c1e);
      for (const s of [1, -1]) signsLit.panel(lx + s * 0.065, y, lz, 1.9, h, s, 0, uv);
    };
    face(2.7, 1.5, ATLAS.menuPanel); face(3.89, 0.48, ATLAS.openBoard); face(5.3, 2.0, ATLAS.shield);
    steel.box(lx, 6.48, lz, 0.22, 0.12, 2.3, 0x1c1c1e);
    light(lx + 1.6, 1.0, lz, 5, 0, 5); light(lx - 1.6, 1.0, lz, 5, 0, 5);
    birds(px, pz, 0.9);
  }
  // ------------------------------------------------------------------ the lot's street edge
  const [pyx, pyz] = OUTSIDE.pylon;
  // (2026-11-23: 0.75 m wide on a line 0.4 m further out, so no clump reaches the car in the stall beside the pylon)
  // (2026-11-23, the art review: the hedge must run on through the pylon, round its two stone pillars, as the
  // substation photo shows it) one continuous run, the pillars standing in it; concrete wheel stops along its lot side
  hedge(-6601.9, -9366.9, -9371.6, 0.75, 1.0);
  for (const [z0, z1] of [[-9367.2, -9371.4], [-9378.7, -9391.8]]) {
    for (let z = z0 - 0.95; z > z1 + 0.8; z -= 2.65) { if (Math.abs(z - OUTSIDE.walkway.z) < 1.5) continue; const [wx, wz] = L(-6602.9, z); concrete.box(wx, 0.065, wz, 0.16, 0.13, 1.8, 0xd2ccc0); }
  }
  hedge(-6601.9, -9378.4, -9392.0, 0.75, 1.0, (z) => Math.abs(z - OUTSIDE.streetLight[1]) < 0.4 || Math.abs(z - OUTSIDE.palms[0][1]) < 0.4);
  void pyx; void pyz;
  {
    // the low stone-block wall, birds of paradise behind it, backflow pipes by the pole
    const W = OUTSIDE.stoneWall, [lx, lz0] = L(W.x, W.z0), [, lz1] = L(W.x, W.z1), zc = (lz0 + lz1) / 2, len = Math.abs(lz1 - lz0);
    concrete.box(lx, 0.36, zc, 0.45, 0.72, len, 0xc2ad8c);
    concrete.box(lx, 0.75, zc, 0.52, 0.06, len + 0.06, 0xd4c3a2);
    for (let y = 0.18; y < 0.72; y += 0.18) paint.box(lx, y, zc, 0.465, 0.014, len + 0.01, 0x7d6c56);
    for (let t = 0.3; t < len; t += 0.42) paint.box(lx, 0.36, Math.min(lz0, lz1) + t, 0.47, 0.72, 0.014, 0x7d6c56);
    col.push(cbox(lx, zc, 0.45, len, 0, 'wall', false));
    for (let z = W.z0 - 0.5; z > W.z1 + 0.4; z -= 1.3) birds(W.x + 0.75, z, 0.85);
    const [bx, bz] = L(OUTSIDE.backflow[0], OUTSIDE.backflow[1]);
    for (const dz of [-0.22, 0, 0.22]) { steel.cyl(bx, 0, bz + dz, 0.055, 0.055, 0.86, 7, 0x8a9096, false); steel.cyl(bx, 0.86, bz + dz, 0.08, 0.08, 0.1, 7, 0x6d7378); }
    steel.tube([bx, 0.92, bz - 0.22], [bx, 0.92, bz + 0.22], 0.045, 6, 0x8a9096);
    signs.panel(bx + 0.06, 0.6, bz, 0.12, 0.06, 1, 0, ATLAS.backflow);
    col.push(circ(bx, bz, 0.32, 'pole', false));
  }
  {
    // the mapped pole: a transformer can and an LED cobra-head light over the lot's edge
    const [lx, lz] = L(OUTSIDE.pole[0], OUTSIDE.pole[1]);
    steel.cyl(lx - 0.36, 8.2, lz, 0.27, 0.27, 0.85, 10, 0x9ea3a6); steel.cyl(lx - 0.36, 9.05, lz, 0.29, 0.2, 0.08, 10, 0x8a8f93);
    steel.box(lx - 0.2, 8.6, lz, 0.2, 0.12, 0.12, 0x5a4a39);
    steel.tube([lx, 7.5, lz], [lx + 1.5, 7.85, lz], 0.05, 6, 0x8d9297);
    heads.box(lx + 1.75, 7.83, lz, 0.62, 0.11, 0.3, 0xffffff);
    light(lx + 1.75, 7.6, lz, 55, 1, 24, 2.0);
    for (const t of [0.15, 0.35, 0.55]) steel.cyl(lx + 0.12, 2.2 + t * 6, lz, 0.03, 0.03, 0.6, 4, 0x2a2a2a, false);
  }
  for (const [x, z] of OUTSIDE.palms) palm(x, z, 11.5);
  {
    // a steel cobra-head street light on Claudina's kerb, and a hydrant on the strip by the bend
    const [lx, lz] = L(OUTSIDE.streetLight[0], OUTSIDE.streetLight[1]);
    steel.cyl(lx, 0, lz, 0.11, 0.08, 8.6, 8, 0x9aa0a4, false);
    steel.tube([lx, 8.5, lz], [lx + 1.9, 8.75, lz], 0.05, 6, 0x9aa0a4);
    heads.box(lx + 2.15, 8.72, lz, 0.7, 0.13, 0.32, 0xffffff);
    light(lx + 2.15, 8.5, lz, 60, 1, 28, 2.0);
    col.push(circ(lx, lz, 0.16, 'pole', false));
    const [hx, hz] = L(OUTSIDE.hydrant[0], OUTSIDE.hydrant[1]);
    paint.cyl(hx, 0, hz, 0.15, 0.13, 0.62, 8, 0xd8b830); paint.cyl(hx, 0.62, hz, 0.14, 0.05, 0.14, 8, 0xd8b830);
    paint.tube([hx - 0.2, 0.42, hz], [hx + 0.2, 0.42, hz], 0.06, 6, 0xc8a828);
    col.push(circ(hx, hz, 0.2, 'pole', false));
  }

  // ------------------------------------------------------------------ the courtyard lot: walkway, accessible stalls, signs
  const raised: P2[][] = [];
  {
    const W = OUTSIDE.walkway, a = L(W.x0, W.z), b = L(W.x1, W.z);
    concrete.slab([a, b], W.w, 0, 0.15, 0xd8d2c6, 0xc2bcb0);
    // its score joints every 1.5 m
    for (let x = Math.min(a[0], b[0]) + 1.5; x < Math.max(a[0], b[0]); x += 1.5) marks.box(x, 0.153, a[1], 0.025, 0.004, W.w - 0.06, 0x9a958a);
    raised.push([[a[0], a[1] - W.w / 2], [b[0], b[1] - W.w / 2], [b[0], b[1] + W.w / 2], [a[0], a[1] + W.w / 2]]);
  }
  const ada: number[] = [];
  for (const [gx, gz] of OUTSIDE.ada) {
    const [lx, lz] = L(gx, gz);
    let bi = -1, bd = 1.0;
    stalls.forEach((s, i) => { const d = Math.hypot(s.x - lx, s.z - lz); if (d < bd && !s.mine) { bd = d; bi = i; } });
    if (bi < 0) continue;
    ada.push(bi);
    const s = stalls[bi], W = 2.75, D = 5.5;
    // the blue fill between the stall's lines (the owner's walkway photo), the white symbol on it
    marks.quadTo([s.x - W / 2 + 0.1, 0.031, s.z - D / 2 + 0.1], [s.x + W / 2 - 0.1, 0.031, s.z - D / 2 + 0.1], [s.x + W / 2 - 0.1, 0.031, s.z + D / 2 - 0.1], [s.x - W / 2 + 0.1, 0.031, s.z + D / 2 - 0.1], UP, 0x2456b0);
    for (const dx of [-W / 2, W / 2]) marks.box(s.x + dx, 0.0325, s.z, 0.12, 0.005, D, 0x2a62c8);
    marks.box(s.x, 0.0325, s.z + (s.face === 0 ? D / 2 - 0.06 : -D / 2 + 0.06), W, 0.005, 0.12, 0x2a62c8);
    // (the symbol above the markings' polygon offset, so the fill doesn't cover it)
    { const [gx2, gz2] = F.toGame(s.x, s.z + (s.face === 0 ? 0.9 : -0.9)); decal(gx2, gz2, 1.25, 1.1, 0.06, ATLAS.adaStall); }
    // the sign at the stall's head, past its wheel stop
    const hz = s.face === 0 ? s.z - D / 2 - 0.35 : s.z + D / 2 + 0.35;
    steel.cyl(s.x, 0, hz, 0.035, 0.035, 2.1, 6, 0x9aa0a4, false);
    signs.panel(s.x, 1.85, hz + (s.face === 0 ? -0.04 : 0.04), 0.32, 0.32, 0, s.face === 0 ? 1 : -1, ATLAS.ada);
    col.push(circ(s.x, hz, 0.1, 'pole', false));
  }
  {
    // PARKING FOR CUSTOMERS ONLY over a blue ACCESS arrow, facing Claudina Way, at the hedge's south end
    const [lx, lz] = L(OUTSIDE.signs[0], OUTSIDE.signs[1]);
    steel.cyl(lx, 0, lz, 0.035, 0.035, 2.6, 6, 0x9aa0a4, false);
    for (const s of [1, -1]) { signs.panel(lx + s * 0.03, 2.2, lz, 0.5, 0.4, s, 0, ATLAS.parking); signs.panel(lx + s * 0.03, 1.72, lz, 0.6, 0.22, s, 0, ATLAS.access); }
    col.push(circ(lx, lz, 0.1, 'pole', false));
    // the painted exit arrows on the exit aisle, one a lane, pointing out to Claudina Way (2026-11-23: in the lot on the
    // aisle's asphalt, 2.4 m long and 1.2 m across the head, bright paint, so the exit view reads them)
    for (const [ax, az] of OUTSIDE.exitArrows) {
      const [cx, cz] = L(ax, az), y = 0.075;                                 // over the aisle's own ribbon
      marks.quadTo([cx - 1.4, y, cz - 0.18], [cx + 0.35, y, cz - 0.18], [cx + 0.35, y, cz + 0.18], [cx - 1.4, y, cz + 0.18], UP, 0xf6f4ee);
      // (the head as a quad with a 4 cm tip: quadTo picks its winding from the first three corners, and a triangle given
      // as a quad with two equal corners was left facing down, so the heads never drew)
      marks.quadTo([cx + 0.35, y, cz - 0.6], [cx + 1.25, y, cz - 0.02], [cx + 1.25, y, cz + 0.02], [cx + 0.35, y, cz + 0.6], UP, 0xf6f4ee);
    }
  }

  // ------------------------------------------------------------------ across Claudina Way: the substation's wall and cypresses
  {
    const { a, b } = OUTSIDE.substationWall, A = L(a[0], a[1]), B = L(b[0], b[1]);
    concrete.slab([A, B], 0.24, 0, 2.45, 0xb9ab90, 0xb0a286);
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / len, tz = (B[1] - A[1]) / len;
    for (let t = 0; t <= len; t += 6) concrete.box(A[0] + tx * t, 1.3, A[1] + tz * t, 0.42, 2.6, 0.42, 0xc3b597);
    // the cypresses: tall narrow cones just behind the wall, along its far part from the lot (2026-11-23: the photo's
    // row runs beside the substation's steel, which stands open behind the wall's part nearest the lot)
    const [, czFrom] = L(0, OUTSIDE.substation.cypressFrom);
    for (let t = 1.2, k = 0; t < len - 0.5; t += 2.7, k++) {
      const x = A[0] + tx * t + 1.5, z = A[1] + tz * t, h = 8.2 + 1.6 * Math.abs(Math.sin(k * 1.9));
      if (z < czFrom) continue;                                           // (north of it: the open steel)
      plantsHi.cyl(x, 0.4, z, 0.6, 0.72, h * 0.4, 7, 0x2d4628, false);
      plantsHi.cyl(x, 0.4 + h * 0.4, z, 0.72, 0.05, h * 0.6, 7, k % 2 ? 0x33502c : 0x2a4426, false);
      plantsLo.cyl(x, 0.4, z, 0.66, 0.05, h, 5, k % 2 ? 0x33502c : 0x2a4426, false);
    }
    // the yellow painted kerb on Claudina's east side, opposite the lot
    const k0 = L(-6590.3, -9338), k1 = L(-6590.6, -9379);
    marks.ribbon([k0, k1], 0.22, 0.04, 0xd8b52c);
    // the painted median where Claudina forks (2026-11-23, the art review: it didn't read): the island between the
    // two legs' centrelines (segs 411 and 417, mapped), 1.6 m in from each, outlined in double yellow and hatched with
    // diagonal yellow bars every 1.4 m, from the fork to where the legs part 6 m
    {
      const xAt = (pts: P2[], z: number) => { for (let i = 1; i < pts.length; i++) { const [x0, z0] = pts[i - 1], [x1, z1] = pts[i]; if ((z - z0) * (z - z1) <= 0 && z0 !== z1) return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0); } return NaN; };
      const east: P2[] = [[-6595.5, -9351.7], [-6593.3, -9331.7], [-6593.6, -9323.2]], west: P2[] = [[-6595.5, -9351.7], [-6599.0, -9331.5], [-6599.9, -9325.3]];
      const eL: P2[] = [], wL: P2[] = [];
      for (let z = -9346.5; z >= -9326; z -= 0.7) { const xe = xAt(east, z) - 1.6, xw = xAt(west, z) + 1.6; if (!(xe - xw > 0.25)) continue; eL.push([xe, z]); wL.push([xw, z]); }
      if (eL.length > 2) {
        const Lp = (q: P2[]) => q.map(([x, z]) => L(x, z)), tip = L(-6595.5, -9348.2);
        for (const dx of [0, 0.2]) { marks.ribbon([tip, ...Lp(eL.map(([x, z]) => [x - dx, z] as P2))], 0.14, 0.045, 0xe0b52c); marks.ribbon([tip, ...Lp(wL.map(([x, z]) => [x + dx, z] as P2))], 0.14, 0.045, 0xe0b52c); }
        for (let i = 1; i < eL.length; i += 2) { const a = L(wL[i][0] + 0.25, wL[i][1]), b = L(eL[i][0] - 0.25, eL[i][1] + Math.min(1.0, (eL[i][0] - wL[i][0]) * 0.5)); marks.ribbon([a, b], 0.42, 0.045, 0xe0b52c); }
      }
    }
  }
  // ------------------------------------------------------------------ the street bend's hydrant and lights
  {
    const B = OUTSIDE.bend, [hx, hz] = L(B.hydrant[0], B.hydrant[1]);
    paint.cyl(hx, 0, hz, 0.16, 0.14, 0.66, 8, 0xe0bc2a); paint.cyl(hx, 0.66, hz, 0.15, 0.05, 0.16, 8, 0xe0bc2a); paint.cyl(hx, 0.82, hz, 0.04, 0.04, 0.05, 6, 0xc8a828);
    paint.tube([hx - 0.22, 0.44, hz], [hx + 0.22, 0.44, hz], 0.065, 6, 0xd0ae28); paint.cyl(hx, 0.4, hz, 0.075, 0.075, 0.12, 6, 0xd0ae28, false);
    col.push(circ(hx, hz, 0.2, 'pole', false));
    for (const [gx, gz] of B.lights) {
      const [lx, lz] = L(gx, gz);
      steel.cyl(lx, 0, lz, 0.12, 0.08, 9.0, 8, 0x9aa0a4, false); steel.cyl(lx, 0, lz, 0.2, 0.18, 0.5, 8, 0x8a9094, false);
      steel.tube([lx, 8.9, lz], [lx - 2.1, 9.15, lz], 0.05, 6, 0x9aa0a4);
      heads.box(lx - 2.35, 9.12, lz, 0.72, 0.14, 0.34, 0xffffff);
      light(lx - 2.35, 8.9, lz, 60, 1, 28, 2.0);
    }
  }
  // ------------------------------------------------------------------ the substation's steel (front-pylon-substation.png)
  {
    // inside the mapped substation (infra 167) behind its block wall: three steel bus gantries (two lattice columns and
    // a lattice beam each, insulator strings and the bus between them), and radiators, bushings and a conservator on
    // the two mapped transformers (the streets' box is the tank). Galvanised grey, 9 to 11 m, above the wall and among
    // the cypresses
    const S = OUTSIDE.substation, G = 0xa7aeb3;
    // (HD and Ultra: four legs, girts and diagonals; Low: four legs and a girt every 2.8 m, which is what reads)
    const lattice = (x: number, z: number, h: number, w: number) => {
      for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) steel.box(x + dx, h / 2, z + dz, 0.09, h, 0.09, G);
      for (let y = 1.2; y < h - 0.3; y += 1.4) { const b = Math.round((y - 1.2) / 1.4) % 2 ? steelHi : steel; b.box(x, y, z - w, w * 2, 0.06, 0.06, G); b.box(x, y, z + w, w * 2, 0.06, 0.06, G); b.box(x - w, y, z, 0.06, 0.06, w * 2, G); b.box(x + w, y, z, 0.06, 0.06, w * 2, G); }
      for (let y = 0.5; y < h - 1.4; y += 2.8) { steelHi.tube([x - w, y, z - w], [x + w, y + 1.4, z - w], 0.03, 3, G); steelHi.tube([x + w, y + 1.4, z - w], [x - w, y + 2.8, z - w], 0.03, 3, G); steelHi.tube([x - w, y, z + w], [x - w, y + 1.4, z - w], 0.03, 3, G); }
    };
    for (const gz of S.gantryZ) {
      const h = 11.5, [ax, az] = L(S.gantryX[0], gz), [bx, bz] = L(S.gantryX[1], gz);
      lattice(ax, az, h, 0.35); lattice(bx, bz, h, 0.35);
      for (const y of [h - 0.4, h - 1.3]) steel.box((ax + bx) / 2, y, (az + bz) / 2, Math.abs(bx - ax) + 0.7, 0.1, 0.1, G);
      for (let x = Math.min(ax, bx) + 0.7; x < Math.max(ax, bx) - 0.6; x += 0.9) steelHi.tube([x, h - 1.3, az], [x + 0.45, h - 0.4, az], 0.03, 3, G);
      for (let t = 0.2; t < 0.85; t += 0.3) { const x = ax + (bx - ax) * t; steel.cyl(x, h - 3.0, az, 0.09, 0.09, 1.7, 6, 0x6d5a4a, false); }    // insulator strings
    }
    for (let t = 0.2; t < 0.85; t += 0.3) { const x = L(S.gantryX[0] + (S.gantryX[1] - S.gantryX[0]) * t, 0)[0], [, z0] = L(0, S.gantryZ[0]), [, z1] = L(0, S.gantryZ[S.gantryZ.length - 1]); steel.tube([x, 7.5, z0], [x, 7.5, z1], 0.06, 5, 0xb8bcbe); }
    for (const [gx, gz] of S.transformers) {
      const [tx, tz] = L(gx, gz);
      for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) steelHi.box(tx + s * 1.15, 1.0, tz + k * 0.25, 0.4, 1.7, 0.05, 0x7d8a80);                       // radiator fins
      for (const dz of [-0.45, 0, 0.45]) { steel.cyl(tx, 2.0, tz + dz, 0.09, 0.06, 1.1, 6, 0x6d5a4a, false); steel.cyl(tx, 3.1, tz + dz, 0.05, 0.05, 0.12, 6, G); }  // bushings
      steel.cyl(tx - 0.6, 2.25, tz - 0.9, 0.22, 0.22, 0.25, 8, 0x7d8a80);
    }
  }
  // ------------------------------------------------------------------ the I-5's deck over its mapped span (front-street-bend.png)
  if (slice?.seg[OUTSIDE.i5.seg]?.br?.length) {
    // the northbound carriageway's bridge span as the streets draw it (deck top 7.6 m, 14 m wide): light concrete
    // parapets along both edges, and an overhead sign gantry over it facing south toward Claudina (our own plain green
    // panels, no wording), so the deck reads at its mapped place from the street bend 190 m away
    const sg = slice.seg[OUTSIDE.i5.seg], pts: P2[] = []; { let x = 0, z = 0; for (let i = 0; i < sg.p.length; i += 2) { x += sg.p[i]; z += sg.p[i + 1]; pts.push(L(x / 10, z / 10)); } }
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const at = (d: number): [number, number, number, number] => { for (let i = 1; i < pts.length; i++) if (cum[i] >= d) { const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), ux = (pts[i][0] - pts[i - 1][0]) / (cum[i] - cum[i - 1] || 1), uz = (pts[i][1] - pts[i - 1][1]) / (cum[i] - cum[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, ux, uz]; } const n = pts.length - 1; return [pts[n][0], pts[n][1], 1, 0]; };
    const [f0, f1] = sg.br![0], d0 = f0 * cum[cum.length - 1], d1 = f1 * cum[cum.length - 1], TOPY = 7.6;
    for (const side of [-1, 1]) {
      const line: P2[] = [];
      for (let d = d0; d <= d1 + 0.01; d += Math.max(4, (d1 - d0) / 12)) { const [x, z, ux, uz] = at(Math.min(d, d1)); line.push([x - uz * 7.15 * side, z + ux * 7.15 * side]); }
      concrete.slab(line, 0.35, TOPY - 1.05, TOPY + 0.95, 0xd4d0c8, 0xbfbab0);
    }
    {
      const [x, z, ux, uz] = at(d0 + (d1 - d0) * 0.45), px = -uz, pz = ux, H = TOPY + 7.2, GR = 0x8d9297;
      for (const side of [-1, 1]) { const cx = x + px * 7.9 * side, cz = z + pz * 7.9 * side; steel.cyl(cx, TOPY - 1, cz, 0.22, 0.18, H - TOPY + 1.4, 8, GR, false); }
      for (const y of [H - 0.15, H - 1.25]) steel.tube([x - px * 7.9, y, z - pz * 7.9], [x + px * 7.9, y, z + pz * 7.9], 0.09, 6, GR);
      for (let t = -7.2; t < 7.2; t += 1.1) steel.tube([x + px * t, H - 1.25, z + pz * t], [x + px * (t + 0.55), H - 0.15, z + pz * (t + 0.55)], 0.035, 3, GR);
      // two green panels hung on its south face (toward the venue), white borders
      const nx = -ux, nz = -uz;                 // the panels face against the carriageway's direction: south-east, toward Claudina
      for (const off of [-3.6, 2.8]) {
        const cx = x + px * off + nx * 0.25, cz = z + pz * off + nz * 0.25, rotY = Math.atan2(-pz, px);
        paint.box(cx, H - 2.2, cz, 5.4, 3.0, 0.12, 0x1f6b3a, rotY);
        paint.box(cx + nx * 0.065, H - 2.2, cz + nz * 0.065, 5.1, 2.7, 0.02, 0xeef2ee, rotY);
        paint.box(cx + nx * 0.08, H - 2.2, cz + nz * 0.08, 4.9, 2.5, 0.02, 0x1f6b3a, rotY);
        for (const [dy, w] of [[0.6, 3.4], [0.0, 3.9], [-0.6, 2.1]] as [number, number][]) paint.box(cx + nx * 0.095, H - 2.2 + dy, cz + nz * 0.095, w, 0.26, 0.02, 0xeef2ee, rotY);
      }
    }
  }
  // ------------------------------------------------------------------ across Claudina from the exit (front-exit-street.png)
  {
    const E = OUTSIDE.exitFence;
    /** a pine: a trunk and stacked cones (HD and Ultra four, Low two) */
    const pine = (x: number, z: number, h: number, k: number) => {
      const [lx, lz] = L(x, z);
      oPlants.cyl(lx, 0, lz, 0.2, 0.14, h * 0.3, 5, 0x4a3626, false);
      for (let i = 0; i < 4; i++) { const y = h * (0.22 + i * 0.19), r = 2.3 * (1 - i * 0.2); plantsHi.cyl(lx, y, lz, r, r * 0.25, h * 0.3, 8, (k + i) % 2 ? 0x2c4a2c : 0x335433, true); }
      for (let i = 0; i < 2; i++) { const y = h * (0.22 + i * 0.38), r = 2.2 * (1 - i * 0.35); plantsLo.cyl(lx, y, lz, r, r * 0.15, h * 0.48, 6, 0x2f4e2f, false); }
    };
    let k = 0;
    for (const [z0, z1] of E.runs) {
      const a = L(E.x, z0), b = L(E.x, z1), len = Math.abs(z1 - z0), n = Math.max(1, Math.round(len / 3));
      // the mesh (alpha-tested chain-link, both faces from one quad), posts every 3 m, a top rail
      chain.quadTo([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 1.8, b[1]], [a[0], 1.8, a[1]], [1, 0, 0], 0xb9bec2);
      steel.tube([a[0], 1.8, a[1]], [b[0], 1.8, b[1]], 0.025, 5, 0x8d9297);
      for (let i = 0; i <= n; i++) { const t = i / n; steel.cyl(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t, 0.03, 0.03, 1.85, 6, 0x8d9297, false); }
      // the grass bank behind it, pines and fan palms in turn
      const g0 = L(E.x + 0.3, z0), g1 = L(E.x + 14, z1);
      plants.quadTo([g0[0], 0.04, g0[1]], [g1[0], 0.04, g0[1]], [g1[0], 0.04, g1[1]], [g0[0], 0.04, g1[1]], UP, 0x56703a);
      for (let z = z0 - 1.6; z > z1 + 0.8; z -= 2.9, k++) {
        if (k % 2) palm(E.x + 4.5 + (k % 3), z, 11 + (k % 4), oPlants); else pine(E.x + 6 + (k % 3), z, 10 + (k % 3) * 1.5, k);
      }
    }
  }
  // ------------------------------------------------------------------ the strip's south-east corner (lot-strip-corner.png)
  {
    const C = OUTSIDE.stripCorner;
    // the wooden pole: crossarms, a transformer can and an LED cobra-head on its arm, out over the corner
    const [px, pz] = L(C.pole[0], C.pole[1]);
    paint.cyl(px, 0, pz, 0.16, 0.12, 10.5, 8, 0x6e4c30, false);
    paint.box(px, 9.6, pz, 0.1, 0.12, 2.2, 0x5e4028); paint.box(px, 8.7, pz, 0.1, 0.1, 1.6, 0x5e4028);
    // (2026-11-23, the art review: the transformer and the LED arm didn't read from the corner view) a larger pale
    // transformer can strapped to the pole with its bushings and a cutout arm, and a longer LED arm with a broad flat head
    steel.cyl(px + 0.42, 7.2, pz, 0.34, 0.34, 1.15, 12, 0xb4b9bc); steel.cyl(px + 0.42, 8.35, pz, 0.36, 0.26, 0.1, 12, 0x9ea3a6);
    for (const dz of [-0.14, 0.14]) steel.cyl(px + 0.42, 8.45, pz + dz, 0.05, 0.03, 0.28, 6, 0x6d5a4a, false);
    paint.box(px + 0.2, 7.75, pz, 0.26, 0.1, 0.1, 0x3a3028); paint.box(px + 0.2, 7.4, pz, 0.26, 0.1, 0.1, 0x3a3028);
    steel.box(px, 9.1, pz - 0.75, 0.08, 0.36, 0.08, 0x6d5a4a); steel.box(px, 9.1, pz + 0.75, 0.08, 0.36, 0.08, 0x6d5a4a);
    steel.tube([px, 6.7, pz], [px - 2.3, 7.15, pz + 0.55], 0.055, 6, 0x9aa0a4);
    heads.box(px - 2.6, 7.12, pz + 0.62, 0.85, 0.15, 0.4, 0xffffff);
    light(px - 2.6, 6.9, pz + 0.62, 50, 1, 22, 2.0);
    for (const y of [2.4, 2.7]) paint.cyl(px, y, pz, 0.17, 0.17, 0.05, 8, 0xc9a24a, false);       // the pole's tags
    col.push(circ(px, pz, 0.2, 'pole', false));
    // the hedge island: a kerbed bed of red-tipped shrubs
    const I = C.island, i0 = L(I.x0, I.z0), i1 = L(I.x1, I.z1);
    concrete.box((i0[0] + i1[0]) / 2, 0.08, (i0[1] + i1[1]) / 2, Math.abs(i1[0] - i0[0]), 0.16, Math.abs(i1[1] - i0[1]), 0xc8c2b6);
    // (2026-11-23, the art review: a low box of red blobs) leafy hedges: at HD and Ultra rounded shrubs of six to
    // eight small clumps each, glossy dark green with red new growth on their tops, packed in two rows on mulch; at Low
    // four larger clumps with red tops
    { const [mx, mz] = [(i0[0] + i1[0]) / 2, (i0[1] + i1[1]) / 2]; plants.quadTo([i0[0] + 0.15, 0.165, i0[1] - 0.15], [i1[0] - 0.15, 0.165, i0[1] - 0.15], [i1[0] - 0.15, 0.165, i1[1] + 0.15], [i0[0] + 0.15, 0.165, i1[1] + 0.15], UP, 0x4a3426); void mx; void mz; }
    let hk = 0;
    for (let x = I.x0 + 0.6; x < I.x1 - 0.4; x += 1.05) for (let z = I.z0 - 0.6; z > I.z1 + 0.4; z -= 1.05, hk++) {
      const j = Math.sin(x * 7.1 + z * 3.3), [bx, bz] = L(x + 0.12 * Math.sin(z * 3), z + 0.1 * Math.cos(x * 5));
      shrubRed(bx, 0.16, bz, 0.62 + 0.08 * j, 0.95 + 0.15 * j, hk);
    }
    for (const [x, z] of [[I.x0 + 1.1, I.z0 - 1.2], [I.x1 - 1.2, I.z0 - 1.4], [I.x0 + 1.2, I.z1 + 1.2], [I.x1 - 1.1, I.z1 + 1.3]]) { const [bx, bz] = L(x, z); blob(plantsLo, bx, 0.16, bz, 0.95, 1.05, 6, 0x2f4a26, 0x8a3a24); }
    col.push(cbox((i0[0] + i1[0]) / 2, (i0[1] + i1[1]) / 2, Math.abs(i1[0] - i0[0]), Math.abs(i1[1] - i0[1]), 0, 'planter', false));
    // the parking-rules sign at the corner, facing the lot
    const [sx, sz] = L(C.sign[0], C.sign[1]);
    steel.cyl(sx, 0, sz, 0.035, 0.035, 2.4, 6, 0x9aa0a4, false);
    for (const f of [1, -1]) signs.panel(sx, 2.0, sz + f * 0.03, 0.5, 0.4, 0, f, ATLAS.parking);
    col.push(circ(sx, sz, 0.1, 'pole', false));
    // the corner itself: a stucco pier with a brown cornice wrapping the return (the rest of the strip's walls are
    // venue.ts's), so the corner reads as the photo's tan return
    const [cx, cz] = L(C.corner[0], C.corner[1]);
    concrete.box(cx + 0.18, 2.3, cz - 0.18, 0.62, 4.6, 0.62, 0xd2b386);
    paint.box(cx + 0.18, 4.45, cz - 0.18, 0.74, 0.22, 0.74, 0x6e4b31);
    paint.box(cx + 0.18, 0.45, cz - 0.18, 0.66, 0.9, 0.66, 0xa88a66);
  }
  steelLo.add(steel); steelHi.add(steel); plantsLo.add(oPlants); plantsHi.add(oPlants);
  return { colliders: col, raised, ada };
}
