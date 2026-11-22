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
// Low draws all of it (it is cheap: about 14k triangles in the venue's existing batches, no new draw call); HD and
// Ultra add nothing here, their look is look.ts's.
import { Kit, P2 } from '../../engine/geom';
import { Collider, box as cbox, circ } from '../../engine/collide';
import type { Stall } from '../../engine/lot';
import type { Frame } from '../../engine/frame';
import type { BarMats } from './mats';
import { ATLAS } from './tex';

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
  ada: [[-6604.4, -9369.1], [-6607.1, -9369.1], [-6604.4, -9380.6]] as P2[],
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
  const light = (x: number, y: number, z: number, i: number, ch: 0 | 1 | 2, reach: number, down?: number) => kit.light({ x, y, z, i, ch, reach, down });
  const UP = [0, 1, 0];
  /** a flat atlas decal on the ground at game (x, z), w along x, d along z */
  const decal = (x: number, z: number, w: number, d: number, y: number, uv: { u0: number; v0: number; u1: number; v1: number }) => {
    const [lx, lz] = L(x, z);
    signs.uvQuad([lx - w / 2, y, lz + d / 2], [lx + w / 2, y, lz + d / 2], [lx + w / 2, y, lz - d / 2], [lx - w / 2, y, lz - d / 2], uv);
  };
  /** a clipped hedge run along z at game x, z0 to z1, w wide, about h tall: overlapping rounded clumps (dark glossy
   *  green, red new growth here and there on top, as the owner's photos show the lot's hedges) */
  const hedge = (x: number, z0: number, z1: number, w: number, h: number, skip: (z: number) => boolean = () => false) => {
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / 0.55));
    for (let k = 0; k < n; k++) {
      const za = z0 + ((z1 - z0) * k) / n, zb = z0 + ((z1 - z0) * (k + 1)) / n, zc = (za + zb) / 2;
      if (skip(zc)) continue;
      const hh = h * (0.9 + 0.12 * Math.sin(k * 2.3)), [lx, lz] = L(x + 0.08 * Math.sin(k * 1.7), zc), r = w / 2;
      plants.cyl(lx, 0, lz, r * 0.8, r, hh * 0.55, 7, k % 2 ? 0x2f4426 : 0x34492a);
      plants.cyl(lx, hh * 0.55, lz, r, r * 0.55, hh * 0.45, 7, k % 3 ? 0x3c5530 : 0x4a3a26);
      if (k % 3 === 1) plants.cyl(lx + r * 0.2, hh * 0.92, lz, r * 0.35, r * 0.08, hh * 0.14, 5, 0x8a3a2a);
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
      plants.quadTo(base, [cx + dx * r * 0.6 - px, h + 0.25, cz + dz * r * 0.6 - pz], tip, [cx + dx * r * 0.6 + px, h + 0.25, cz + dz * r * 0.6 + pz], [0, -1, 0], 0x3f5a2a);
    }
    const [tx, tz] = [lx, lz]; col.push(circ(tx, tz, 0.3, 'tree', true));
  };

  // ------------------------------------------------------------------ the pylon at the lot's street edge
  {
    const [px, pz] = OUTSIDE.pylon, [lx, lz] = L(px, pz), PZ = [-1.05, 1.05];
    for (const dz of PZ) {
      concrete.box(lx, 0.85, lz + dz, 0.62, 1.7, 0.62, 0xb69a74);
      for (let y = 0.14; y < 1.7; y += 0.135) paint.box(lx, y, lz + dz, 0.635, 0.014, 0.635, 0x6a5a48);
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
  hedge(-6602.3, -9366.9, -9371.6, 1.0, 1.0, (z) => Math.abs(z - (pyz - 1.05)) < 0.55 || Math.abs(z - (pyz + 1.05)) < 0.55);
  hedge(-6602.3, -9378.4, -9392.0, 1.0, 1.0, (z) => Math.abs(z - OUTSIDE.streetLight[1]) < 0.4 || Math.abs(z - OUTSIDE.palms[0][1]) < 0.4);
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
    for (const dx of [-W / 2, W / 2]) marks.box(s.x + dx, 0.0325, s.z, 0.12, 0.005, D, 0x2a62c8);
    marks.box(s.x, 0.0325, s.z + (s.face === 0 ? D / 2 - 0.06 : -D / 2 + 0.06), W, 0.005, 0.12, 0x2a62c8);
    decal(s.x, s.z + (s.face === 0 ? 0.9 : -0.9), 1.25, 1.1, 0.034, ATLAS.adaStall);
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
    for (const [ax, az] of [[-6604.6, -9393.6], [-6604.6, -9396.6]] as P2[]) {
      const [cx, cz] = L(ax, az), y = 0.035;
      marks.quadTo([cx - 1.1, y, cz - 0.12], [cx + 0.2, y, cz - 0.12], [cx + 0.2, y, cz + 0.12], [cx - 1.1, y, cz + 0.12], UP, 0xf2f0e8);
      marks.quadTo([cx + 0.2, y, cz - 0.42], [cx + 0.95, y, cz], [cx + 0.95, y, cz], [cx + 0.2, y, cz + 0.42], UP, 0xf2f0e8);
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
      plants.cyl(x, 0.4, z, 0.6, 0.72, h * 0.4, 7, 0x2d4628);
      plants.cyl(x, 0.4 + h * 0.4, z, 0.72, 0.05, h * 0.6, 7, k % 2 ? 0x33502c : 0x2a4426);
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
  return { colliders: col, raised, ada };
}
