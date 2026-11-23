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
import { Kit, P2 } from '../../engine/geom';
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
  exitArrows: [[-6601.2, -9393.6], [-6598.4, -9393.6]] as P2[],
  /** the strip's south-east corner (building 61's rest ring at frame (21.1, 67.7)) and what lot-strip-corner.png puts
   *  round it: the wooden pole with its transformer and LED arm, the red-tipped hedge island, the parking-rules sign */
  stripCorner: { corner: [-6607.6, -9404.2] as P2, pole: [-6599.4, -9403.6] as P2, island: { x0: -6602.9, x1: -6598.5, z0: -9399.4, z1: -9404.4 }, sign: [-6602.6, -9398.9] as P2 },
  signs: [-6602.35, -9378.9] as P2,
};

export interface BarOutside { colliders: Collider[]; raised: P2[][]; ada: number[] }

export function buildOutside(kit: Kit, m: BarMats, F: Frame, stalls: Stall[]): BarOutside {
  const L = (x: number, z: number): P2 => F.toLocal(x, z);
  const concrete = kit.get('venue-concrete', m.concrete, { uv: 4, cast: true });
  const plants = kit.get('venue-plants', m.plant, { cast: true });
  const steel = kit.get('venue-steel', m.steel, { cast: true });
  const paint = kit.get('bar-paint', m.paint);
  const marks = kit.get('venue-markings', m.marking, { ao: false });
  const signs = kit.get('bar-signs', m.signs, { uv: 1 });
  const signsLit = kit.get('bar-signs-lit', m.signsLit, { uv: 1, glow: false });
  const heads = kit.get('lot-heads', m.lampHead, { glow: false });
  const col: Collider[] = [];
  // detail by mode at no extra draw call (lod.ts): [Low only, HD and Ultra only]
  const [plantsLo, plantsHi] = lod(plants), [, paintHi] = lod(paint);
  const chain = kit.get('outside-chain', m.chain, { uv: 0.6, glow: false });
  /** a rounded clump of leaves (four rings, capped) */
  const blob = (bt: typeof plants, x: number, y: number, z: number, r: number, h: number, seg: number, hex: number, top = hex) => {
    const R = [0.62, 1, 0.86, 0.34], Y = [0, 0.34, 0.74, 1];
    for (let i = 0; i < 3; i++) bt.cyl(x, y + Y[i] * h, z, R[i] * r, R[i + 1] * r, (Y[i + 1] - Y[i]) * h, seg, i < 2 ? hex : top, i === 2);
  };
  const light = (x: number, y: number, z: number, i: number, ch: 0 | 1 | 2, reach: number, down?: number) => kit.light({ x, y, z, i, ch, reach, down });
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
      plants.quadTo([lx + px, 0.02, lz + pz], [lx - px, 0.02, lz - pz], tip, tip, [dx, 0.3, dz], 0x4f7a64);
      if (k % 3 === 0) { const c = [lx + dx * len * 0.5, len * 1.08, lz + dz * len * 0.5]; plants.quadTo(c, [c[0] + dx * 0.22, c[1] + 0.05, c[2] + dz * 0.22], [c[0] + dx * 0.05, c[1] + 0.18, c[2] + dz * 0.05], [c[0] + dx * 0.05, c[1] + 0.18, c[2] + dz * 0.05], [-dz, 0, dx], 0xe8762a); }
    }
  };
  /** a tall fan palm (low-poly): a gently leaning trunk, a skirt of dead fronds, a crown of green ones */
  const palm = (x: number, z: number, h: number) => {
    const [lx, lz] = L(x, z), lean = 0.35;
    plants.tube([lx, 0, lz], [lx + lean, h, lz + lean * 0.4], 0.22, 7, 0x7a6248);
    const cx = lx + lean, cz = lz + lean * 0.4;
    plants.cyl(cx, h - 1.3, cz, 0.34, 0.55, 1.4, 8, 0x8a6a42);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), px = -dz * 0.45, pz = dx * 0.45, r = 2.4 + 0.4 * Math.sin(k * 3.1);
      const base = [cx, h + 0.1, cz], tip = [cx + dx * r, h + 0.1 - 0.6 - 0.3 * Math.sin(k * 1.7), cz + dz * r];
      plants.quadTo(base, [cx + dx * r * 0.6 + px, h + 0.25, cz + dz * r * 0.6 + pz], tip, [cx + dx * r * 0.6 - px, h + 0.25, cz + dz * r * 0.6 - pz], [0, 1, 0], k % 2 ? 0x56783a : 0x628a40);
      plantsHi.quadTo(base, [cx + dx * r * 0.6 - px, h + 0.25, cz + dz * r * 0.6 - pz], tip, [cx + dx * r * 0.6 + px, h + 0.25, cz + dz * r * 0.6 + pz], [0, -1, 0], 0x3f5a2a);
    }
    const [tx, tz] = [lx, lz]; col.push(circ(tx, tz, 0.3, 'tree', true));
  };

  // ------------------------------------------------------------------ the pylon at the lot's street edge
  {
    const [px, pz] = OUTSIDE.pylon, [lx, lz] = L(px, pz), PZ = [-1.05, 1.05];
    for (const dz of PZ) {
      concrete.box(lx, 0.85, lz + dz, 0.62, 1.7, 0.62, 0xb69a74);
      for (let y = 0.14; y < 1.7; y += 0.135) paintHi.box(lx, y, lz + dz, 0.635, 0.014, 0.635, 0x6a5a48);
      concrete.box(lx, 1.74, lz + dz, 0.7, 0.08, 0.7, 0xc8b08a);
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
  hedge(-6601.9, -9366.9, -9371.6, 0.75, 1.0, (z) => Math.abs(z - (pyz - 1.05)) < 0.55 || Math.abs(z - (pyz + 1.05)) < 0.55);
  hedge(-6601.9, -9378.4, -9392.0, 0.75, 1.0, (z) => Math.abs(z - OUTSIDE.streetLight[1]) < 0.4 || Math.abs(z - OUTSIDE.palms[0][1]) < 0.4);
  void pyx;
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
    // the painted exit arrows on the north driveway, pointing out to Claudina Way
    // (2026-11-23: nearer the kerb, larger, where the exit view sees them)
    for (const [ax, az] of OUTSIDE.exitArrows) {
      const [cx, cz] = L(ax, az), y = 0.07;                                  // over the aisle's own ribbon
      marks.quadTo([cx - 1.5, y, cz - 0.16], [cx + 0.3, y, cz - 0.16], [cx + 0.3, y, cz + 0.16], [cx - 1.5, y, cz + 0.16], UP, 0xf2f0e8);
      marks.quadTo([cx + 0.3, y, cz - 0.55], [cx + 1.3, y, cz], [cx + 1.3, y, cz], [cx + 0.3, y, cz + 0.55], UP, 0xf2f0e8);
    }
  }

  // ------------------------------------------------------------------ across Claudina Way: the substation's wall and cypresses
  {
    const { a, b } = OUTSIDE.substationWall, A = L(a[0], a[1]), B = L(b[0], b[1]);
    concrete.slab([A, B], 0.24, 0, 2.45, 0xb9ab90, 0xb0a286);
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / len, tz = (B[1] - A[1]) / len;
    for (let t = 0; t <= len; t += 6) concrete.box(A[0] + tx * t, 1.3, A[1] + tz * t, 0.42, 2.6, 0.42, 0xc3b597);
    // the cypresses: tall narrow cones just behind the wall
    for (let t = 1.2, k = 0; t < len - 0.5; t += 2.7, k++) {
      const x = A[0] + tx * t + 1.5, z = A[1] + tz * t, h = 8.2 + 1.6 * Math.abs(Math.sin(k * 1.9));
      plantsHi.cyl(x, 0.4, z, 0.6, 0.72, h * 0.4, 7, 0x2d4628, false);
      plantsHi.cyl(x, 0.4 + h * 0.4, z, 0.72, 0.05, h * 0.6, 7, k % 2 ? 0x33502c : 0x2a4426, false);
      plantsLo.cyl(x, 0.4, z, 0.66, 0.05, h, 5, k % 2 ? 0x33502c : 0x2a4426, false);
    }
    // the yellow painted kerb on Claudina's east side, opposite the lot
    const k0 = L(-6590.3, -9338), k1 = L(-6590.6, -9379);
    marks.ribbon([k0, k1], 0.22, 0.04, 0xd8b52c);
    // the painted median where Claudina forks: two yellow edge lines and chevrons between the legs
    const { f, a: fa, b: fb } = OUTSIDE.fork, F0 = L(f[0], f[1]), FA = L(fa[0], fa[1]), FB = L(fb[0], fb[1]);
    marks.ribbon([F0, FA], 0.12, 0.04, 0xd8b52c); marks.ribbon([F0, FB], 0.12, 0.04, 0xd8b52c);
    for (let t = 0.25; t < 1; t += 0.22) {
      const pa: P2 = [F0[0] + (FA[0] - F0[0]) * t, F0[1] + (FA[1] - F0[1]) * t], pb: P2 = [F0[0] + (FB[0] - F0[0]) * t, F0[1] + (FB[1] - F0[1]) * t], mid: P2 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 - 0.9];
      marks.ribbon([pa, mid, pb], 0.2, 0.04, 0xd8b52c);
    }
  }
  // ------------------------------------------------------------------ across Claudina from the exit (front-exit-street.png)
  {
    const E = OUTSIDE.exitFence;
    /** a pine: a trunk and stacked cones (HD and Ultra four, Low two) */
    const pine = (x: number, z: number, h: number, k: number) => {
      const [lx, lz] = L(x, z);
      plants.cyl(lx, 0, lz, 0.2, 0.14, h * 0.3, 5, 0x4a3626, false);
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
        if (k % 2) palm(E.x + 4.5 + (k % 3), z, 11 + (k % 4)); else pine(E.x + 6 + (k % 3), z, 10 + (k % 3) * 1.5, k);
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
    steel.cyl(px + 0.32, 7.7, pz, 0.24, 0.24, 0.8, 10, 0x9ea3a6); steel.cyl(px + 0.32, 8.5, pz, 0.26, 0.18, 0.08, 10, 0x8a8f93);
    steel.tube([px, 7.1, pz], [px - 1.6, 7.45, pz + 0.4], 0.045, 6, 0x8d9297);
    heads.box(px - 1.85, 7.43, pz + 0.46, 0.6, 0.11, 0.28, 0xffffff);
    light(px - 1.85, 7.2, pz + 0.46, 50, 1, 22, 2.0);
    for (const y of [2.4, 2.7]) paint.cyl(px, y, pz, 0.17, 0.17, 0.05, 8, 0xc9a24a, false);       // the pole's tags
    col.push(circ(px, pz, 0.2, 'pole', false));
    // the hedge island: a kerbed bed of red-tipped shrubs
    const I = C.island, i0 = L(I.x0, I.z0), i1 = L(I.x1, I.z1);
    concrete.box((i0[0] + i1[0]) / 2, 0.08, (i0[1] + i1[1]) / 2, Math.abs(i1[0] - i0[0]), 0.16, Math.abs(i1[1] - i0[1]), 0xc8c2b6);
    // a clipped hedge mass (the photo's), its top in soft rounded clumps with red new growth here and there (HD and
    // Ultra); Low the mass and a few red tips
    plants.box((i0[0] + i1[0]) / 2, 0.16 + 0.4, (i0[1] + i1[1]) / 2, Math.abs(i1[0] - i0[0]) - 0.35, 0.8, Math.abs(i1[1] - i0[1]) - 0.35, 0x344f2a);
    for (let x = I.x0 + 0.45; x < I.x1 - 0.3; x += 0.55) for (let z = I.z0 - 0.45; z > I.z1 + 0.3; z -= 0.55) {
      const [bx, bz] = L(x + 0.06 * Math.sin(z * 3), z), j = Math.sin(x * 7.1 + z * 3.3);
      blob(plantsHi, bx, 0.62, bz, 0.36, 0.42 + 0.06 * j, 7, j > 0.3 ? 0x3c5a2e : 0x45663a, j > 0.55 ? 0x8e4a2a : 0x4e7040);
      if (j > 0.2) blob(plantsHi, bx + 0.12, 0.98, bz - 0.08, 0.1, 0.12, 5, 0xa8452a);
    }
    for (const [x, z] of [[I.x0 + 1.0, I.z0 - 1.2], [I.x1 - 1.2, I.z0 - 2.6], [I.x0 + 2.2, I.z1 + 1.0]]) { const [bx, bz] = L(x, z); plantsLo.cyl(bx, 0.94, bz, 0.25, 0.05, 0.16, 5, 0x9a4428, false); }
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
  return { colliders: col, raised, ada };
}
