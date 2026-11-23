// Stoppage Time built in code (PROJECT_OC_SPORTS_BAR.md, "The venue", "Site plan", "The front", "Inside" and "The
// patio's layout"): our unit at the east end of building 61 (night-violet facade, the parapet sign band with the
// wordmark, the "+3" blade sign, black-steel storefront glazing and a double door), the rest of the building as
// generic unnamed units, the front walk with its kerb ramp, planters and bike rack, the patio with its pergola, and
// the interior: the 12.8 m bar with its lane, back bar, taps and staff flap, the booths, high-tops and window rails, two
// pool tables, three dartboards, the shuffleboard, the TV wall and the other screens (a still "SIMULATED" test card),
// the restroom and kitchen doors and the pass, the jukebox and the water station. Every size is the plan's, and
// every name and mark is ours. Built in local metres through the building frame.
import * as THREE from 'three';
import { Batch, Kit, P2, Emitter } from '../../engine/geom';
import { Collider, seg, box, circ, poly } from '../../engine/collide';
import type { Frame } from '../../engine/frame';
import type { Seat } from '../../engine/venue-types';
import type { SlotDef, Room } from '../../engine/venue-def';
import type { BarMats } from './mats';
import { HEX } from './brand';
import { ATLAS, UV } from './tex';
import { lod } from './lod';
import {
  UNIT, FRONT, fd, frontU, furniture, slots as allSlots, POOL_TABLES, DART_BOARDS, HIGHTOPS, RAIL_V, BAR, PATIO, PATIO_TABLES, PT_CHAIRS,
  HEATERS, PATIO_PLANTERS, JUKEBOX, SCREENS, PATIO_HIGHTOP, southWallV,
} from './layout';

export interface BarVenue {
  colliders: Collider[];
  /** colliders that hold only while the bar is closed (the doors, locked) */
  closedOnly: Collider[];
  seats: Seat[];
  /** every slot with its local position (seats point into seats[]) */
  slots: (SlotDef & { x: number; z: number; sx: number; sz: number; seatId?: number })[];
  /** the meshes the overhead camera swaps: each wall side full and cut to 0.9 m, the roof and ceiling */
  walls: Record<string, { full: THREE.Object3D[]; cut: THREE.Object3D[]; out: P2; mid: P2 }>;
  roofs: THREE.Object3D[];
  /** the pool tables, their own meshes (Ultra's pool spots light them); `batch` is the table's, which the page bakes
   *  the night light into once every light is known, as the kit's batches are */
  pool: { table: THREE.Mesh; light: THREE.Mesh; at: P2; batch: Batch }[];
  doors: { id: 'front' | 'patio'; centre: P2; along: P2; leaves: number[]; open: number; collider: Collider }[];
  doorLeaves: THREE.InstancedMesh;
  poseDoors: (cut: Record<string, boolean>) => void;
  meshes: THREE.Object3D[];
  emitters: Emitter[];
  insideLights: { x: number; y: number; z: number; kind: 'pool' | 'fill' | 'back' }[];
  /** the walk region's pieces (local rings): the front walk, the patio painted to 0.5 m past its fence, the interior
   *  painted to 0.5 m past the walls' inner faces; and what's cut out of it (the lane and the flap) */
  region: { front: P2[]; patio: P2[]; interior: P2[]; cut: P2[][]; raised: P2[][]; rampLow: P2[] };
  layout: Record<string, unknown>;
}

export function buildBarVenue(kit: Kit, m: BarMats, F: Frame, room: Room, restRing: P2[], hostOuterF: P2[]): BarVenue {
  const L = (u: number, v: number): P2 => F.fromFrame(u, v);
  const P3 = (u: number, v: number, y: number) => { const [x, z] = L(u, v); return [x, y, z]; };
  const rot = F.rot;
  const col: Collider[] = [], closedOnly: Collider[] = [], meshes: THREE.Object3D[] = [];
  const emitters: Emitter[] = [];
  const light = (u: number, v: number, y: number, i: number, ch: 0 | 1 | 2, reach = 12, down?: number) => { const [x, z] = L(u, v); const e = { x, y, z, i, ch, reach, down }; kit.light(e); emitters.push(e); };
  // ---------------------------------------------------------------- batches (one draw call per material family)
  const floor = kit.get('bar-floor', m.floor, { uv: 4, ao: false });
  const marks = kit.get('venue-markings', m.marking, { ao: false });
  const concrete = kit.get('venue-concrete', m.concrete, { uv: 4, cast: true });
  const oak = kit.get('bar-oak', m.oak, { uv: 1.4 });
  const vinyl = kit.get('bar-vinyl', m.vinyl);
  const paint = kit.get('bar-paint', m.paint);
  const steel = kit.get('venue-steel', m.steel, { cast: true });
  const neon = kit.get('bar-neon', m.neon, { glow: false });
  const screens = kit.get('bar-screens', m.screen, { glow: false });
  const signs = kit.get('bar-signs', m.signs, { uv: 1 });
  const signsLit = kit.get('bar-signs-lit', m.signsLit, { uv: 1, glow: false });
  const exit = kit.get('bar-exit', m.exitSign, { uv: 1, glow: false });
  const plants = kit.get('venue-plants', m.plant, { cast: true });
  const lamps = kit.get('venue-lamps', m.lamp, { glow: false });
  const patioWood = kit.get('patio-wood', m.oak, { uv: 1.4, cast: true });
  const glassPatio = kit.get('patio-glass@hi', m.glass, { glow: false, order: 2 });      // the flame heaters' glass tubes (HD and Ultra; Low shows the flame alone, one call fewer)
  const restWalls = kit.get('host-walls', m.tilt, { uv: 7.5, cast: true, glow: true });
  const restRoof = kit.get('host-roof', m.roofs, { uv: 8, cast: true });
  const restWin = kit.get('host-windows', m.window, { glow: false });
  const unitRoof = kit.get('unit-roof', m.roofs, { uv: 8, cast: true });
  const ceiling = kit.get('unit-ceiling', m.interior, { ao: false });
  const word = kit.get('unit-wordmark', m.wordmark, { glow: false, order: 3 });
  const blade = kit.get('unit-blade', m.blade, { glow: false });
  // (2026-11-23) detail by mode at no extra draw call (lod.ts): each pair is [Low only, HD and Ultra only] parts of the
  // batch above it; and two HD-and-Ultra-only batches (the heaters' flickering flames, the chairs' perforated steel)
  const [plantsLo, plantsHi] = lod(plants), [steelLo, steelHi] = lod(steel), [neonLo, neonHi] = lod(neon), [paintLo, paintHi] = lod(paint), [lampsLo, lampsHi] = lod(lamps);
  const flamesHi = kit.get('patio-flame@hi', m.flame, { glow: false });
  const meshHi = kit.get('patio-mesh@hi', m.mesh, { uv: 0.064, cast: true });

  // frame-space helpers
  const fbox = (b: Batch, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, hex: number) => { const [x, z] = L((u0 + u1) / 2, (v0 + v1) / 2); b.box(x, (y0 + y1) / 2, z, Math.abs(u1 - u0), Math.abs(y1 - y0), Math.abs(v1 - v0), hex, rot); };
  const fcyl = (b: Batch, u: number, v: number, y0: number, r0: number, r1: number, h: number, segs: number, hex: number, caps = true) => { const [x, z] = L(u, v); b.cyl(x, y0, z, r0, r1, h, segs, hex, caps); };
  const ftube = (b: Batch, a: [number, number, number], c: [number, number, number], r: number, segs: number, hex: number) => b.tube(P3(a[0], a[1], a[2]), P3(c[0], c[1], c[2]), r, segs, hex);
  /** a vertical panel facing the frame direction f, centred at (u, v, y), w x h, with atlas UVs */
  const fpanel = (b: Batch, u: number, v: number, y: number, w: number, h: number, f: P2, uv: UV, hex = 0xffffff) => { const [x, z] = L(u, v), [nx, nz] = F.dirToLocal(f[0], f[1]); b.panel(x, y, z, w, h, nx, nz, uv, hex); };
  /** a quad on the floor or a ramp, wound to face up whichever way the frame turns (the frame's (u, v) can mirror
   *  three.js's (x, z), so a quad's corner order alone doesn't say which side it faces: S1's chalk circle and oche line
   *  faced down and drew nothing) */
  const UPW = [0, 1, 0];
  const fquad = (b: Batch, pts: [number, number, number][], hex: number) => b.quadTo(P3(...pts[0]), P3(...pts[1]), P3(...pts[2]), P3(...pts[3]), UPW, hex);
  const ring = (r: P2[]) => r.map(([u, v]) => L(u, v));
  /** a rounded clump of leaves at local (x, z), its base at y, r wide, h tall: four rings (a soft dome), capped */
  const blob = (bt: Batch, x: number, y: number, z: number, r: number, h: number, seg: number, hex: number, top = hex) => {
    const R = [0.62, 1, 0.86, 0.34], Y = [0, 0.34, 0.74, 1];
    for (let i = 0; i < 3; i++) bt.cyl(x, y + Y[i] * h, z, R[i] * r, R[i + 1] * r, (Y[i + 1] - Y[i]) * h, seg, i < 2 ? hex : top, i === 2);
  };
  /** a clipped shrub at frame (u, v): one rounded clump (the owner's photos' boxwood and red-tip hedging) */
  const shrub = (u: number, v: number, y: number, r: number, h: number, hex = 0x3a5530, bt: Batch = plants, seg = 6) => {
    const [x, z] = L(u, v);
    blob(bt, x, y, z, r, h, seg, hex, hex === 0x3a5530 ? 0x4d6b38 : hex);
  };
  /** a leafy shrub cluster at frame (u, v), base y, about r wide and h tall (HD and Ultra: the patio's planter walls):
   *  a taller core and five or six smaller clumps round it at hashed angles and sizes, dark olive below, their tops a
   *  lighter yellow-green; seed varies it */
  const leafy = (u: number, v: number, y: number, r: number, h: number, seed: number, bt: Batch) => {
    const [x, z] = L(u, v), hs = (k: number) => { const q = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };
    const DARK = [0x2a3f22, 0x2f4626, 0x324a28], TIP = [0x5f7a34, 0x6b8438, 0x56702f];
    blob(bt, x, y, z, r * 0.62, h, 6, DARK[(seed | 0) % 3], TIP[(seed | 0) % 3]);
    const n = 5 + (hs(0) > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + hs(k + 1) * 0.9, d = r * (0.42 + 0.3 * hs(k + 7)), rr = r * (0.3 + 0.18 * hs(k + 13)), hh = h * (0.45 + 0.35 * hs(k + 19));
      blob(bt, x + Math.cos(a) * d, y + h * 0.08 * hs(k + 23), z + Math.sin(a) * d, rr, hh, 5, DARK[k % 3], TIP[(k + 1) % 3]);
    }
  };


  // (2026-11-23) the rooftop HVAC units, kept out of the shadow maps at HD and Ultra as the patio's steel is
  const hvac = new Batch(steel.uvScale); hvac.ao = steel.ao;
  // ---------------------------------------------------------------- the rest of building 61: the strip's other units
  // (the owner's lot photos: tan stucco with brown trim, arched storefronts on stone-veneer piers, tenant sign bands,
  // wall lamps, rooftop HVAC; the tenants are generic trades in our own words, no real business's name or mark)
  {
    const rest = ring(restRing);
    restWalls.walls(rest, 0, UNIT.roof, (i) => [0xd2b386, 0xc9a97c, 0xd2b386, 0xcdae82][i % 4]);
    restWalls.walls(rest, UNIT.roof - 0.62, UNIT.roof - 0.42, 0x6e4b31);           // the brown trim band near the top
    restWalls.walls(rest, UNIT.roof, UNIT.roof + 0.45, 0xd8bc90);                   // the parapet
    restWalls.walls(rest, UNIT.roof + 0.45, UNIT.roof + 0.55, 0x6e4b31);            // its brown cap
    restRoof.cap(rest, UNIT.roof, 0xa7a49c);
    col.push(poly(rest, 'building', true));
    let area = 0; for (let i = 0; i < rest.length; i++) { const [x0, z0] = rest[i], [x1, z1] = rest[(i + 1) % rest.length]; area += x0 * z1 - x1 * z0; }
    let k = 0, tk = 0;
    for (let i = 0; i < rest.length; i++) {
      const [ax, az] = rest[i], [bx, bz] = rest[(i + 1) % rest.length], len = Math.hypot(bx - ax, bz - az);
      if (len < 10) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len, onx = area > 0 ? uz : -uz, onz = area > 0 ? -ux : ux, nx = onx * 0.05, nz = onz * 0.05;
      const Q = (t: number, y: number, d = 0) => [ax + ux * t + nx + onx * d, y, az + uz * t + nz + onz * d];
      const wing = i === 0;                         // the north wing's courtyard face: roll-up doors
      const out = [nx, 0, nz];
      for (let t = 3; t + 3.4 < len - 2; t += 6.2, k++) {
        if (wing && k % 2 === 0) { restWin.quadTo(Q(t, 0), Q(t + 3.6, 0), Q(t + 3.6, 3.4), Q(t, 3.4), out, 0x8d9093); continue; }
        const lit = Math.sin(k * 91.7) > 0.55 ? 0xffffff : 0x202428;
        // the storefront: glass to 2.6 m, an arched transom over it to 3.3 m, a brown trim round the arch
        restWin.quadTo(Q(t, 0.2), Q(t + 3.4, 0.2), Q(t + 3.4, 2.6), Q(t, 2.6), out, lit);
        const cx = t + 1.7, N = 8;
        for (let j = 0; j < N; j++) {
          const a0 = (j / N) * Math.PI, a1 = ((j + 1) / N) * Math.PI, p0 = Q(cx - Math.cos(a0) * 1.7, 2.6 + Math.sin(a0) * 0.7), p1 = Q(cx - Math.cos(a1) * 1.7, 2.6 + Math.sin(a1) * 0.7);
          restWin.quadTo(Q(cx, 2.6), p0, p1, p1, out, lit);
          const q0 = Q(cx - Math.cos(a0) * 1.92, 2.6 + Math.sin(a0) * 0.9, 0.04), q1 = Q(cx - Math.cos(a1) * 1.92, 2.6 + Math.sin(a1) * 0.9, 0.04), r0 = Q(cx - Math.cos(a0) * 1.72, 2.6 + Math.sin(a0) * 0.72, 0.04), r1 = Q(cx - Math.cos(a1) * 1.72, 2.6 + Math.sin(a1) * 0.72, 0.04);
          paint.quadTo(r0, q0, q1, r1, out, 0x6e4b31);
        }
        // the stone-veneer piers either side of the bay, and a wall lamp over each
        for (const tp of [t - 0.55, t + 3.45]) {
          // (HD and Ultra boxes; Low their faces alone, which is all the lot sees)
          const [px, , pz] = Q(tp + 0.27, 0, 0.06);
          paintHi.box(px, 0.42, pz, 0.6, 0.84, 0.14, 0xa88a66, Math.atan2(-uz, ux));
          paintLo.quadTo(Q(tp - 0.03, 0, 0.13), Q(tp + 0.57, 0, 0.13), Q(tp + 0.57, 0.84, 0.13), Q(tp - 0.03, 0.84, 0.13), out, 0xa88a66);
          const [lx, , lz] = Q(tp + 0.27, 0, 0.12);
          lampsHi.box(lx, 3.05, lz, 0.22, 0.2, 0.16, 0x2a2833);
          lampsLo.quadTo(Q(tp + 0.16, 2.95, 0.2), Q(tp + 0.38, 2.95, 0.2), Q(tp + 0.38, 3.15, 0.2), Q(tp + 0.16, 3.15, 0.2), out, 0x2a2833);
        }
        // a tenant band over every other bay (our own generic trades), blank on the rest
        if (k % 2 === 1) { const [sx, , sz] = Q(cx, 0, 0.03); signs.panel(sx, 3.62, sz, 2.4, 0.5, onx, onz, ATLAS.tenants[tk++ % ATLAS.tenants.length]); }
      }
      // rooftop HVAC units, set 4 m in from this wall
      for (let t = 7; t < len - 5; t += 15) { const [hx, , hz] = Q(t, 0, -4.5); hvac.box(hx, UNIT.roof + 0.55, hz, 1.6, 1.1, 1.2, 0xb4b7b8, Math.atan2(-uz, ux)); hvac.box(hx, UNIT.roof + 1.14, hz, 0.9, 0.08, 0.9, 0x8d9091, Math.atan2(-uz, ux)); }
    }
  }
  // rooftop HVAC on our own unit (behind the parapet band, seen from the lot)
  for (const [u, v] of [[14, 9], [24, 6], [31, 11]] as P2[]) { fbox(hvac, u - 0.8, u + 0.8, v - 0.6, v + 0.6, UNIT.roof, UNIT.roof + 1.1, 0xb4b7b8); fbox(hvac, u - 0.45, u + 0.45, v - 0.45, v + 0.45, UNIT.roof + 1.1, UNIT.roof + 1.18, 0x8d9091); }
  steelLo.add(hvac); steelHi.add(hvac);

  // ---------------------------------------------------------------- our unit's walls (one mesh per side, full and cut)
  // night violet in the sun: the paint's own colour, lifted a step so a sunlit wall reads violet, not black
  const OAK = 0xc08a58;
  // (Vega & Vinnie's, 2026-11-16: the outer faces take the owner's front photo's black facade, lifted a step so a
  // sunlit wall reads as black paint, not a hole; the inside keeps S4's violet)
  const FACADE = 0x2c2a2b;
  const VIOLET = 0x3b3672, INSIDE = 0x2f2a44, STEEL = 0x141416, TOP = UNIT.roof, CEIL = UNIT.ceiling, FL = UNIT.floor;
  const walls: BarVenue['walls'] = {};
  const doorSpecs: { id: 'front' | 'patio'; centre: P2; t: P2; n: P2; s0: number; s1: number; at: (s: number, off: number, y: number) => number[]; rot: number; collider: Collider }[] = [];
  const sideOf = (id: string) => ({ full: kit.get('wall-' + id, m.paint, { cast: true }), cut: kit.get('cut-' + id, m.paint, { cast: false }), glass: kit.get('glass-' + id, m.glass, { glow: false, order: 2 }) });
  const sides: Record<string, ReturnType<typeof sideOf>> = {};
  for (const w of room.walls) {
    const S = (sides[w.id] = sideOf(w.id));
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), t: P2 = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
    // inward: toward the room's inner ring's centre
    const ci = room.inner.reduce((a, p) => [a[0] + p[0] / room.inner.length, a[1] + p[1] / room.inner.length], [0, 0] as P2);
    let n: P2 = [-t[1], t[0]]; const mid: P2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    if ((ci[0] - mid[0]) * n[0] + (ci[1] - mid[1]) * n[1] < 0) n = [-n[0], -n[1]];
    // the wall's own straight run on the inner face: trim it to the neighbouring walls' inner faces (approximately,
    // by the thickness), so the inner faces meet without overlap
    const at = (s: number, off: number, y: number) => P3(w.a[0] + t[0] * s + n[0] * off, w.a[1] + t[1] * s + n[1] * off, y);
    const outC = w.id === 'party' ? INSIDE : FACADE;
    const nl = F.dirToLocal(n[0], n[1]), UP = [0, 1, 0], DOWN = [0, -1, 0];
    const q = (b: Batch, s0: number, s1: number, off: number, y0: number, y1: number, hex: number, facing: 1 | -1) => {
      b.quadTo(at(s0, off, y0), at(s1, off, y0), at(s1, off, y1), at(s0, off, y1), [nl[0] * facing, 0, nl[1] * facing], hex);
    };
    const [tlx, tlz] = F.dirToLocal(t[0], t[1]), wallRot = Math.atan2(-tlz, tlx);
    const T = w.t;
    // segments along the wall: solid, glazed (front and south) and the door
    const runs: { s0: number; s1: number; kind: 'solid' | 'glass' | 'door' }[] = [];
    const doors = w.openings.filter((o) => o.kind === 'door');
    let cursor = 0;
    // (Vega & Vinnie's, the owner's front photo: north of the front door the facade is a solid black wall carrying the
    // wings mural, so that run is solid; the glazing south of the door, behind the covered front, keeps its storefront
    // over a stone-veneer wainscot to 1.1 m)
    const runKind = (s0: number): 'solid' | 'glass' => (w.id === 'front' && s0 >= FRONT.door[1] - 0.01 ? 'solid' : w.glazed ? 'glass' : 'solid');
    for (const d of doors) { if (d.s0 > cursor) runs.push({ s0: cursor, s1: d.s0, kind: runKind(cursor) }); runs.push({ s0: d.s0, s1: d.s1, kind: 'door' }); cursor = d.s1; }
    if (cursor < len) runs.push({ s0: cursor, s1: len, kind: runKind(cursor) });
    const glassY = w.id === 'front' ? [1.1, 3.05] : [0.95 + FL, 2.75], doorY = 2.45;
    // each face: the outer one (facing out, -n) and the inner one (facing in, +n), floor to ceiling inside
    for (const r of runs) {
      const ends = w.id === 'south' || w.id === 'north' ? [r.s0 === 0 ? T : r.s0, r.s1] : [r.s0, r.s1];
      if (r.kind === 'solid') {
        q(S.full, r.s0, r.s1, 0, 0, TOP, outC, -1); q(S.full, ends[0], ends[1], T, FL, CEIL, INSIDE, 1);
        q(S.cut, r.s0, r.s1, 0, 0, 0.9, outC, -1); q(S.cut, ends[0], ends[1], T, FL, 0.9, INSIDE, 1);
        continue;
      }
      const [g0, g1] = r.kind === 'door' ? [FL, doorY] : glassY;
      // below the glass (a kick panel or sill), above it (the header to the roof), the jambs at the ends
      if (g0 > 0.05) { q(S.full, r.s0, r.s1, 0, 0, g0, outC, -1); q(S.full, ends[0], ends[1], T, FL, g0, INSIDE, 1); S.full.quadTo(at(r.s0, 0, g0), at(r.s1, 0, g0), at(r.s1, T, g0), at(r.s0, T, g0), UP, 0x1f1e20); }
      q(S.full, r.s0, r.s1, 0, g1, TOP, outC, -1); q(S.full, ends[0], ends[1], T, g1, CEIL, INSIDE, 1);
      S.full.quadTo(at(r.s0, T, g1), at(r.s1, T, g1), at(r.s1, 0, g1), at(r.s0, 0, g1), DOWN, 0x1f1e20);       // (the sill and the soffit black, not the inside's violet: they show from outside)
      // black-steel mullions about every 1.6 m in the glazing, and frames at the ends
      const nb = Math.max(1, Math.round((r.s1 - r.s0) / 1.6));
      for (let k = 0; k <= nb; k++) {
        const s = r.s0 + ((r.s1 - r.s0) * k) / nb, [u, v] = [w.a[0] + t[0] * s + n[0] * T * 0.5, w.a[1] + t[1] * s + n[1] * T * 0.5];
        if (r.kind === 'door' && k > 0 && k < nb) continue;
        const [x, z] = L(u, v); S.full.box(x, (g0 + g1) / 2, z, 0.07, g1 - g0, T * 0.9, STEEL, wallRot);
      }
      if (r.kind === 'glass') {
        S.glass.quad(at(r.s0, T * 0.5, g0), at(r.s1, T * 0.5, g0), at(r.s1, T * 0.5, g1), at(r.s0, T * 0.5, g1), 0xffffff);
        // a transom bar across the storefront
        if (w.id === 'front') { const [x, z] = L(w.a[0] + t[0] * (r.s0 + r.s1) / 2 + n[0] * T * 0.5, w.a[1] + t[1] * (r.s0 + r.s1) / 2 + n[1] * T * 0.5); S.full.box(x, 2.6, z, r.s1 - r.s0, 0.07, T * 0.9, STEEL, wallRot); }
      }
      // the cut wall: solid to 0.9 m, open at the doors
      if (r.kind !== 'door') { q(S.cut, r.s0, r.s1, 0, 0, 0.9, outC, -1); q(S.cut, ends[0], ends[1], T, FL, 0.9, INSIDE, 1); }
    }
    // the wall's top (full: under the roof edge, the parapet band rises to 5.4 m on the front and to 4.7 m round the
    // sides; cut: a capped top edge at 0.9 m)
    const band = w.id === 'front' ? UNIT.band : w.id === 'party' ? TOP : TOP + 0.4;
    if (band > TOP) { q(S.full, 0, len, 0, TOP, band, FACADE, -1); q(S.full, 0, len, T, TOP, band, FACADE, 1); S.full.quadTo(at(0, 0, band), at(len, 0, band), at(len, T, band), at(0, T, band), UP, 0x1c1b1c); }
    // the stone-veneer wainscot on the outer faces (the owner's front and lot photos: ledgestone in tans and browns
    // under the glazing and the black wall, to about 1.1 m on the front): one textured quad per 3.5 m or less, 3 cm proud
    // (2026-11-23: it was laid stone by stone, about 4k triangles; the atlas's ledgestone strip reads the same)
    if (w.id !== 'party') for (const r of runs) {
      if (r.kind === 'door') continue;
      const top = w.id === 'front' ? 1.1 : r.kind === 'solid' ? 0.9 : glassY[0];
      const n0 = Math.max(1, Math.ceil((r.s1 - r.s0) / 3.5)), V = ATLAS.veneer, vt = V.v0 + (V.v1 - V.v0) * Math.min(1, top / 1.1);
      for (let k = 0; k < n0; k++) {
        const s0 = r.s0 + ((r.s1 - r.s0) * k) / n0, s1 = r.s0 + ((r.s1 - r.s0) * (k + 1)) / n0, uw = V.u0 + (V.u1 - V.u0) * Math.min(1, (s1 - s0) / 3.5);
        // bottom-left, bottom-right, top-right, top-left as seen from outside (-n)
        let A = at(s0, -0.03, 0), B = at(s1, -0.03, 0);
        const ex = B[0] - A[0], ez = B[2] - A[2];
        if (ex * nl[1] - ez * nl[0] > 0) [A, B] = [B, A];
        signs.uvQuad(A, B, [B[0], top, B[2]], [A[0], top, A[2]], { u0: V.u0, v0: V.v0, u1: uw, v1: vt });
      }
    }
    // the front door's dark-wood surround (the owner's photo: a single glass door in a wood frame on the black wall)
    if (w.id === 'front') for (const d of doors) {
      q(paint, d.s0 - 0.14, d.s0, -0.035, FL, doorY + 0.14, 0x5a3424, -1); q(paint, d.s1, d.s1 + 0.14, -0.035, FL, doorY + 0.14, 0x5a3424, -1);
      q(paint, d.s0 - 0.14, d.s1 + 0.14, -0.035, doorY, doorY + 0.14, 0x5a3424, -1);
    }
    for (const r of runs) if (r.kind !== 'door') S.cut.quadTo(at(r.s0, 0, 0.9), at(r.s1, 0, 0.9), at(r.s1, T, 0.9), at(r.s0, T, 0.9), UP, 0x3a3550);
    // colliders: the wall as a thick segment on its centreline, gaps at the doors (a locked door closes its gap)
    const cline = (s0: number, s1: number, tag: string) => { const a = L(w.a[0] + t[0] * s0 + n[0] * T / 2, w.a[1] + t[1] * s0 + n[1] * T / 2), b = L(w.a[0] + t[0] * s1 + n[0] * T / 2, w.a[1] + t[1] * s1 + n[1] * T / 2); return seg(a[0], a[1], b[0], b[1], T, tag, true); };
    for (const r of runs) {
      if (r.kind === 'door') {
        const c = cline(r.s0, r.s1, 'door'); c.dyn = true; closedOnly.push(c);
        const sc = (r.s0 + r.s1) / 2, centre: P2 = [w.a[0] + t[0] * sc + n[0] * T / 2, w.a[1] + t[1] * sc + n[1] * T / 2];
        doorSpecs.push({ id: w.id === 'front' ? 'front' : 'patio', centre, t, n, s0: r.s0, s1: r.s1, at: (s: number, off: number, y: number) => at(s, off, y), rot: wallRot, collider: c });
        continue;
      }
      col.push(cline(Math.max(0, r.s0 - 0.01), Math.min(len, r.s1 + 0.01), r.kind === 'glass' ? 'glass' : 'wall'));
    }
    const outN: P2 = [-n[0], -n[1]];
    walls[w.id] = { full: [], cut: [], out: outN, mid };
  }

  // wall packs on our unit's courtyard wall and at the front's corners, lighting the walk round to the door
  for (const [u, v, f] of [[12, 16.75, [0, 1]], [24, 16.6, [0, 1]], [33, 16.5, [0, 1]]] as [number, number, P2][]) {
    fbox(lamps, u - 0.2, u + 0.2, v - 0.05, v + 0.12, 3.5, 3.75, 0x2a2833);
    light(u + f[0] * 0.6, v + f[1] * 0.6, 3.4, 60, 1, 16, 1.6);
  }
  // the roof over our unit and the ceiling under it (both hidden in the overhead view)
  unitRoof.cap(ring(room.outer), TOP, 0x8f8c86);
  // the ceiling: a suspended acoustic-tile ceiling, as a strip-mall unit has, in a pale violet-grey on a dark T-bar grid
  // (2 x 4 ft tiles), with square supply diffusers. S1 shipped it as one cap in near-black paint, which read as a room
  // open to a black sky at noon and at night. The tiles are subdivided so the baked interior light reads on them, and
  // carry a little interior glow of their own (the bounce off the floor and the bar's lights; dark when closed)
  {
    const DOWN = [0, -1, 0];
    // S4's repair: the tiles' own glow 0.55 to 0.32 of the room's channel, which rises after dark: at 0.55 the ceiling
    // was the brightest thing in the night frames, flat from end to end, and the pendants and screens didn't read; the
    // tiles a shade deeper too
    // S4's second repair (the art review: the ceiling was still the brightest, largest flat surface in every inside
    // frame, a pink-lilac plane over the top third): its own glow 0.32 to 0.12, the tiles a neutral dark grey with
    // only a trace of violet (0x736e80 to 0x4c4a52), and mats.ts's interior material darker and less lit by the sky's
    // environment, so the pendants, the LED strip and the screens are the brightest things inside
    ceiling.emit = [0, 0, 0.12];
    ceiling.plane(room.inner, [], (u, v) => P3(u, v, CEIL), DOWN, 0x4c4a52, 1.4);
    ceiling.emit = null;
    /** where the line u = c (axis 0) or v = c (axis 1) crosses the inner ring: the other coordinate's range */
    const span = (axis: 0 | 1, c: number): [number, number] | null => {
      let lo = Infinity, hi = -Infinity;
      const R = room.inner;
      for (let i = 0; i < R.length; i++) {
        const a = R[i], b = R[(i + 1) % R.length], da = a[axis] - c, db = b[axis] - c;
        if ((da < 0) === (db < 0) || da === db) continue;
        const t = da / (da - db), o = a[1 - axis] + (b[1 - axis] - a[1 - axis]) * t;
        lo = Math.min(lo, o); hi = Math.max(hi, o);
      }
      return lo < hi ? [lo, hi] : null;
    };
    const gy = CEIL - 0.006, GRID = 0x2c2836, W = 0.022;
    const strip = (u0: number, v0: number, u1: number, v1: number, y: number, hex: number) => ceiling.quadTo(P3(u0, v0, y), P3(u1, v0, y), P3(u1, v1, y), P3(u0, v1, y), DOWN, hex);
    for (let u = 1.2; u < UNIT.u1; u += 1.2) { const r = span(0, u); if (r) strip(u - W, r[0], u + W, r[1], gy, GRID); }
    for (let v = 0.9; v < 16.4; v += 0.6) { const r = span(1, v); if (r) strip(r[0], v - W, r[1], v + W, gy, GRID); }
    // supply diffusers: a pale square with a darker louvred centre, in a run down the room and over the bar
    for (const [u, v] of [[6.0, 4.5], [12.0, 4.5], [18.0, 4.5], [24.0, 4.5], [30.0, 4.5], [8.4, 11.7], [15.6, 11.7], [22.8, 11.7]] as P2[]) {
      strip(u - 0.3, v - 0.3, u + 0.3, v + 0.3, gy - 0.004, 0x8a8890);
      for (let k = 0; k < 3; k++) { const d = 0.22 - k * 0.07; strip(u - d, v - d, u + d, v + d, gy - 0.008 - k * 0.004, k % 2 ? 0x76747c : 0x2e2c34); }
    }
  }
  // the floor: polished concrete on the 0.15 m slab, the chalk centre circle in front of the big screen
  floor.cap(ring(room.inner), FL, 0xffffff);
  for (let k = 0; k < 48; k++) {
    const a0 = (k / 48) * Math.PI * 2, a1 = ((k + 1) / 48) * Math.PI * 2, c: P2 = [33.5, 4.75];
    for (const [r0, r1] of [[1.62, 1.72], [0.1, 0.18]]) {
      const p = (a: number, r: number): [number, number, number] => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, FL + 0.004];
      fquad(marks, [p(a0, r0), p(a0, r1), p(a1, r1), p(a1, r0)], HEX.chalk);
    }
  }
  fquad(marks, [[31.55, 4.7, FL + 0.004], [35.5, 4.7, FL + 0.004], [35.5, 4.8, FL + 0.004], [31.55, 4.8, FL + 0.004]], HEX.chalk);
  // the oche line at v 13.38
  fquad(marks, [[7.6, 13.36, FL + 0.004], [12.6, 13.36, FL + 0.004], [12.6, 13.41, FL + 0.004], [7.6, 13.41, FL + 0.004]], HEX.chalk);

  // ---------------------------------------------------------------- the bar
  {
    const top = 1.07 + FL;
    fbox(oak, BAR.u0, BAR.u1, BAR.edge, BAR.top, top - 0.06, top, OAK);                     // the oak top, 12.8 m
    fbox(paint, BAR.u0 + 0.05, BAR.u1, BAR.edge + 0.12, BAR.top - 0.05, FL, top - 0.06, VIOLET);  // the die
    fbox(oak, BAR.u0, BAR.u0 + 0.15, BAR.top, BAR.lane, FL, top, OAK);                       // the return
    fbox(neon, BAR.u0 + 0.1, BAR.u1 - 0.1, BAR.edge + 0.02, BAR.edge + 0.05, top - 0.1, top - 0.08, HEX.lime);   // the LED strip
    ftube(steel, [BAR.u0 + 0.2, BAR.edge - 0.12, 0.33], [BAR.u1 - 0.2, BAR.edge - 0.12, 0.33], 0.025, 6, 0xb08d57);   // brass foot rail
    for (let u = BAR.u0 + 0.6; u < BAR.u1; u += 2.0) ftube(steel, [u, BAR.edge - 0.12, FL], [u, BAR.edge - 0.12, 0.33], 0.015, 4, 0xb08d57);
    for (let u = BAR.u0 + 0.5; u < BAR.u1; u += 1.6) light(u, BAR.edge - 0.1, top - 0.1, 3, 2, 4);
    // the back bar: cabinets, a counter, two shelves of plain bottles, the tap wall (plain coloured handles, no marks)
    fbox(oak, BAR.u0, BAR.backU1, BAR.lane, BAR.back, FL, 0.95 + FL, OAK);
    fbox(oak, BAR.u0, BAR.backU1, BAR.lane - 0.02, BAR.back, 0.95 + FL, 1.0 + FL, OAK);
    for (const y of [1.55, 2.0]) fbox(paint, BAR.u0 + 0.3, BAR.backU1 - 0.3, BAR.back - 0.28, BAR.back, y, y + 0.03, 0x3a3328);
    const bottle = [0x4b6b3a, 0x7a4a22, 0xb8b0a0, 0x2d4a6a, 0x8a2a2a, 0x6a5a2a];
    for (const y of [1.0 + FL, 1.58, 2.03]) for (let u = BAR.u0 + 0.4, k = 0; u < BAR.backU1 - 0.4; u += 0.16, k++) if ((k * 7) % 5 !== 0) fcyl(paint, u, BAR.back - 0.13, y, 0.035, 0.03, 0.26 + (k % 3) * 0.04, 6, bottle[k % 6], false);
    fbox(steel, 16.5, 22.5, BAR.top + 0.04, BAR.top + 0.1, top + 0.15, top + 0.22, 0x9a9da2);    // the tap rail
    for (let u = 16.7, k = 0; u < 22.4; u += 0.32, k++) { fcyl(steel, u, BAR.top + 0.07, top + 0.22, 0.012, 0.012, 0.1, 4, 0x9a9da2, false); fbox(paint, u - 0.02, u + 0.02, BAR.top + 0.05, BAR.top + 0.09, top + 0.32, top + 0.52, [HEX.coral, HEX.lime, HEX.chalk, 0x3a7ad8, 0xe0a030][k % 5]); }
    light(20.4, 15.4, 1.6, 8, 2, 7);
    // the staff flap's waist-high swing gate, closed at v 13.3
    fbox(oak, BAR.flap[0] + 0.02, BAR.flap[1] - 0.02, 13.26, 13.34, FL + 0.15, FL + 1.0, OAK);
    // 9 stools, every 1.05 m from u 14.6
    for (let k = 0; k < 9; k++) stool(14.6 + 1.05 * k, 12.85);
    // the four bar screens over the back bar (in the screens batch below)
  }
  function stool(u: number, v: number, seatHex = 0x1d1b22, sb: Batch = steel) {
    fcyl(sb, u, v, FL, 0.2, 0.18, 0.03, 10, STEEL);
    fcyl(sb, u, v, FL + 0.03, 0.025, 0.025, 0.72, 5, STEEL, false);
    ftube(sb, [u - 0.16, v, FL + 0.3], [u + 0.16, v, FL + 0.3], 0.012, 4, STEEL);
    fcyl(vinyl, u, v, 0.86, 0.19, 0.19, 0.07, 10, seatHex);
  }

  // ---------------------------------------------------------------- booths, high-tops, window rails
  for (let b = 0; b < 5; b++) {
    const u0 = 20.5 + 2.15 * b, v0 = 0.75, v1 = 2.35;
    for (const [s0, s1, back] of [[u0 + 0.08, u0 + 0.62, u0], [u0 + 1.53, u0 + 2.07, u0 + 2.03]] as [number, number, number][]) {
      fbox(vinyl, s0, s1, v0 + 0.05, v1 - 0.05, FL, 0.62, HEX.coral);                          // the seat
      fbox(vinyl, back, back + 0.12, v0, v1, FL, 1.25, 0xe85a3c);                             // the backrest
      fbox(paint, s0, s1, v0 + 0.05, v1 - 0.05, FL, FL + 0.1, 0x2a2238);
    }
    fbox(oak, u0 + 0.72, u0 + 1.43, v0 + 0.15, v1 - 0.1, 0.9, 0.95, OAK);                    // the table across the booth
    fcyl(steel, u0 + 1.075, (v0 + v1) / 2, FL, 0.04, 0.04, 0.75, 6, STEEL, false);
    light(u0 + 1.075, 1.55, 2.3, 4, 2, 5);
    fcyl(paint, u0 + 1.075, 1.55, 2.25, 0.16, 0.08, 0.18, 8, 0x1e1b3a);                        // a dark shade, lit underneath
    fcyl(lamps, u0 + 1.075, 1.55, 2.24, 0.15, 0.15, 0.012, 8, 0xffffff);
    ftube(steel, [u0 + 1.075, 1.55, 2.43], [u0 + 1.075, 1.55, CEIL], 0.006, 3, 0x111111);
  }
  for (const [cu, cv] of HIGHTOPS) {
    fcyl(oak, cu, cv, 1.12, 0.38, 0.38, 0.05, 14, OAK);
    fcyl(steel, cu, cv, FL, 0.04, 0.04, 0.97, 6, STEEL, false);
    fcyl(steel, cu, cv, FL, 0.25, 0.22, 0.03, 10, STEEL);
    for (const [du, dv] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) stool(cu + du, cv + dv, 0x2a2238);
    fcyl(paint, cu, cv, 2.55, 0.2, 0.08, 0.2, 10, 0x1e1b3a);
    fcyl(lamps, cu, cv, 2.54, 0.19, 0.19, 0.012, 10, 0xffffff);
    ftube(steel, [cu, cv, 2.75], [cu, cv, CEIL], 0.006, 3, 0x111111);
    light(cu, cv, 2.5, 9, 2, 6, 1.2);
  }
  for (const [v0, v1] of [[2.5, 6.3], [10.0, 15.0]]) {
    const r: P2[] = [[frontU(v0, 0), v0], [frontU(v1, 0), v1], [frontU(v1, 0.3), v1], [frontU(v0, 0.3), v0]];
    oak.cap(ring(r), 1.1 + FL, OAK); oak.cap(ring(r), 1.06 + FL, OAK, [], true); oak.walls(ring(r), 1.06 + FL, 1.1 + FL, 0xc49a6a);
  }
  for (const v of RAIL_V) stool(frontU(v, 0.6), v);

  // ---------------------------------------------------------------- pool tables (their own meshes: Ultra's pool spots)
  const pool: BarVenue['pool'] = [];
  POOL_TABLES.forEach(([cu, cv], i) => {
    const tb = new Batch(1.4), lb = new Batch(1.4);
    const fb = (b: Batch, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, hex: number) => { const [x, z] = L((u0 + u1) / 2, (v0 + v1) / 2); b.box(x, (y0 + y1) / 2, z, u1 - u0, y1 - y0, v1 - v0, hex, rot); };
    const fcylB = (b: Batch, u: number, v: number, y0: number, r0: number, r1: number, h: number, segs: number, hex: number) => { const [x, z] = L(u, v); b.cyl(x, y0, z, r0, r1, h, segs, hex, true); };
    // the body and apron, the night-violet bed, and the oak rails round it (their tops at 0.92 m). S2b: the playing
    // bed between the cushions' noses is the plan's 0.99 m x 1.98 m (engine/sim/pool.ts plays on it): the cloth under
    // the cushions runs to +-0.54 x +-1.035, the rails from there to the apron's edge (the same boxes as S1's, moved)
    fb(tb, cu - 0.62, cu + 0.62, cv - 1.12, cv + 1.12, 0.62, 0.84, 0x5a3b22);              // the apron
    fb(tb, cu - 0.54, cu + 0.54, cv - 1.035, cv + 1.035, 0.84, 0.875, 0x2c2470);            // the night-violet cloth
    for (const [a, b2, c, d] of [[-0.62, -0.54, -1.12, 1.12], [0.54, 0.62, -1.12, 1.12], [-0.54, 0.54, -1.12, -1.035], [-0.54, 0.54, 1.035, 1.12]]) fb(tb, cu + a, cu + b2, cv + c, cv + d, 0.84, 0.92, 0x6b4428);
    // the cushions: cloth-covered rubber from the bed's edge to the rails, broken at the six pockets
    const CUSH = 0x3a3190, cw = 0.045, gap = 0.1, HW = 0.495, HL = 0.99;
    for (const s2 of [-1, 1]) {
      const u0 = s2 < 0 ? cu - HW - cw : cu + HW, u1 = u0 + cw;
      fb(tb, u0, u1, cv - HL + gap, cv - gap * 0.75, 0.875, 0.905, CUSH);
      fb(tb, u0, u1, cv + gap * 0.75, cv + HL - gap, 0.875, 0.905, CUSH);
      const v0 = s2 < 0 ? cv - HL - cw : cv + HL;
      fb(tb, cu - HW + gap, cu + HW - gap, v0, v0 + cw, 0.875, 0.905, CUSH);
    }
    // the six pockets: a black mouth through the rail's top at each corner and each side's middle, centred on the
    // pockets the physics uses (the bed's corners and the long sides' middles), a little outward
    for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      const pu = cu + du * (HW + (dv ? 0.014 : 0.03)), pv = cv + dv * (HL + 0.014);
      fcylB(tb, pu, pv, 0.79, 0.06, 0.06, 0.134, 10, 0x070707);
    }
    // the diamond sights on the rails' tops (mother-of-pearl dots), three a half-side along the long rails, three a
    // short end
    for (const s2 of [-1, 1]) {
      for (const t of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) fb(tb, cu + s2 * 0.58 - 0.012, cu + s2 * 0.58 + 0.012, cv + t * 0.99 - 0.012, cv + t * 0.99 + 0.012, 0.92, 0.923, 0xe8e2d4);
      for (const t of [-0.25, 0, 0.25]) fb(tb, cu + t * 0.99 - 0.012, cu + t * 0.99 + 0.012, cv + s2 * 1.0775 - 0.012, cv + s2 * 1.0775 + 0.012, 0.92, 0.923, 0xe8e2d4);
    }
    for (const [du, dv] of [[-0.48, -0.95], [0.48, -0.95], [-0.48, 0.95], [0.48, 0.95]]) fb(tb, cu + du - 0.08, cu + du + 0.08, cv + dv - 0.08, cv + dv + 0.08, FL, 0.62, 0x3b2616);
    // the lamp over it: a long shade on two cords, lit underneath
    fb(tb, cu - 0.22, cu + 0.22, cv - 0.8, cv + 0.8, 2.08, 2.2, 0x1e1b3a);
    tb.tube(P3(cu, cv - 0.6, 2.2), P3(cu, cv - 0.6, CEIL), 0.006, 3, 0x111111); tb.tube(P3(cu, cv + 0.6, 2.2), P3(cu, cv + 0.6, CEIL), 0.006, 3, 0x111111);
    fb(lb, cu - 0.2, cu + 0.2, cv - 0.78, cv + 0.78, 2.06, 2.08, 0xffffff);
    const table = tb.mesh(m.cloth, `pool-${i + 1}-table`, { cast: true }), lamp = lb.mesh(m.lamp, `pool-${i + 1}-light`, { cast: true });
    table.userData.cast = true; lamp.userData.cast = true;
    pool.push({ table, light: lamp, at: [cu, cv], batch: tb });
    meshes.push(table, lamp);
    light(cu, cv, 2.0, 14, 2, 6, 1.6);
  });
  // ---------------------------------------------------------------- darts, shuffleboard, jukebox, water, host stand
  fbox(oak, 7.6, 12.6, 15.75, 16.15, FL, FL + 2.3, OAK);                                  // the dart surround
  for (const u of DART_BOARDS) {
    // the board's face 1 cm proud of its black backboard (S1 had the face inside the backboard's box, so the darts
    // zone showed three black rectangles)
    fpanel(signs, u, 15.69, 1.73 + FL, 0.46, 0.46, [0, -1], ATLAS.dartboard);
    fbox(paint, u - 0.38, u + 0.38, 15.7, 15.75, 1.1 + FL, 2.25 + FL, 0x111111);
    fbox(paint, u + 0.42, u + 0.72, 15.72, 15.75, 1.4 + FL, 2.0 + FL, 0x22282a);                // a chalk scoreboard
    light(u, 15.2, 2.4, 5, 2, 4, 1.4);
  }
  // the shuffleboard, 22 ft: S2b's bed is the plan's 6.7 m x 0.51 m (engine/sim/shuffle.ts slides on it, x = u - 3.2),
  // between two low side rails; the lines: the far foul line 1.83 m from the end, then zones 1, 2 and 3 at 1.3, 0.9
  // and 0.5 m from it (the throwing end is at u 3.2, the far end at u 9.9)
  fbox(oak, 3.2, 9.9, 1.15, 1.75, FL, 0.95, 0x8a5a36);
  fbox(oak, 3.2, 9.9, 1.195, 1.705, 0.95, 0.97, 0xe8d0a6);
  fbox(oak, 3.2, 9.9, 1.15, 1.195, 0.95, 1.0, 0x6b4428); fbox(oak, 3.2, 9.9, 1.705, 1.75, 0.95, 1.0, 0x6b4428);
  // S2b's repair: the lines 4 cm wide and light (cream on the oak; the foul line a bright red), and the zone numbers 1,
  // 2 and 3 painted in the middle of each zone, upright for the thrower, in the same markings batch (no new call): each
  // numeral is a few 2.2 cm strokes, 18 cm tall and 11 cm wide
  for (const u of [8.07, 8.6, 9.0, 9.4]) fbox(marks, u - 0.02, u + 0.02, 1.2, 1.7, 0.972, 0.974, u === 8.07 ? 0xe0343a : 0xf1e6cc);
  {
    // the thrower looks along +u; looking along a local direction (dx, dz) with y up, their right is (-dz, dx), so the
    // numerals' x runs along +v when that's +v (the same sign as games.ts's `side`)
    const fu = F.dirToLocal(1, 0), fv = F.dirToLocal(0, 1), side = Math.sign(fu[0] * fv[1] - fu[1] * fv[0]) || 1;
    const H = 0.18, Wd = 0.11, S = 0.022, y0 = 0.972, y1 = 0.9745;
    // the seven strokes in the numeral's own frame (x to the thrower's right, y away from them): [x0, x1, y0, y1]
    const SEG: Record<string, [number, number, number, number]> = {
      a: [-Wd / 2, Wd / 2, H / 2 - S, H / 2], g: [-Wd / 2, Wd / 2, -S / 2, S / 2], d: [-Wd / 2, Wd / 2, -H / 2, -H / 2 + S],
      b: [Wd / 2 - S, Wd / 2, 0, H / 2], c: [Wd / 2 - S, Wd / 2, -H / 2, 0], f: [-Wd / 2, -Wd / 2 + S, 0, H / 2], e: [-Wd / 2, -Wd / 2 + S, -H / 2, 0],
    };
    const DIGIT: Record<number, string> = { 1: 'bc', 2: 'abged', 3: 'abgcd' };
    // the zones' middles along the bed (u), zone 3 from its line to the end
    for (const [n, uc] of [[1, 8.8], [2, 9.2], [3, 9.62]] as [number, number][]) {
      for (const k of DIGIT[n]) { const [x0, x1, yy0, yy1] = SEG[k]; fbox(marks, uc + yy0, uc + yy1, 1.45 + side * x0, 1.45 + side * x1, y0, y1, 0xf1e6cc); }
    }
  }
  fbox(paint, JUKEBOX[0] - 0.35, JUKEBOX[0] + 0.35, 0.7, 1.2, FL, FL + 1.45, 0x2a2238);          // the jukebox
  fbox(neon, JUKEBOX[0] - 0.3, JUKEBOX[0] + 0.3, 1.2, 1.22, FL + 0.6, FL + 1.3, HEX.coral);
  light(JUKEBOX[0], 1.6, 1.2, 3, 2, 4);
  fbox(steel, 29.0, 29.6, 11.2, 11.6, FL, FL + 0.95, 0x9aa0a6);                                 // the water station
  fbox(steel, 29.1, 29.5, 11.35, 11.6, FL + 0.95, FL + 1.45, 0xc8ccd0);
  fbox(oak, 6.5, 7.1, 7.95, 8.45, FL, FL + 1.1, OAK);                                      // the host stand

  // ---------------------------------------------------------------- the restrooms and the kitchen (doors only), the pass
  {
    const blk = (u0: number, u1: number, v0: number, v1: number, hex: number) => {
      fbox(paint, u0, u1, v0, v0 + 0.1, FL, CEIL, hex); fbox(paint, u0, u0 + 0.1, v0, v1, FL, CEIL, hex); fbox(paint, u1 - 0.1, u1, v0, v1, FL, CEIL, hex);
    };
    blk(27.6, 31.0, 11.6, 15.8, 0x3a3456);
    fbox(paint, 31.0, 35.8, 9.0, 9.1, FL, CEIL, 0x3a3456);                                         // the kitchen's south face
    fbox(paint, 31.0, 31.1, 9.0, 9.3, FL, CEIL, 0x3a3456); fbox(paint, 31.0, 31.1, 11.3, 15.8, FL, CEIL, 0x3a3456);   // its east face, round the pass
    fbox(paint, 31.0, 31.1, 9.3, 11.3, FL, FL + 1.05, 0x3a3456); fbox(paint, 31.0, 31.1, 9.3, 11.3, FL + 1.95, CEIL, 0x3a3456);
    for (const u of [28.4, 30.2]) { fbox(paint, u - 0.45, u + 0.45, 11.55, 11.6, FL, FL + 2.1, 0x1a1724); fpanel(signs, u, 11.54, 1.75, 0.3, 0.3, [0, -1], ATLAS.restroom); }
    fbox(paint, 33.0, 34.0, 8.95, 9.0, FL, FL + 2.1, 0x1a1724);                                  // the staff swing door                                // the staff swing door
    // the pass: a 2 m window on the kitchen's east face, the lit kitchen behind, a stainless shelf, heat lamps, a bell
    fpanel(signsLit, 31.5, 10.3, FL + 1.5, 2.0, 0.9, [-1, 0], ATLAS.kitchen);
    fbox(steel, 30.75, 31.1, 9.3, 11.3, FL + 1.05, FL + 1.1, 0xc8ccd0);
    for (const v of [9.7, 10.3, 10.9]) fbox(lamps, 30.85, 31.05, v - 0.12, v + 0.12, 2.15, 2.2, 0x2a2833);
    fbox(steel, 30.9, 31.0, 9.4, 11.2, 2.0, 2.03, 0x9aa0a6);                                     // the ticket rail
    fcyl(steel, 30.85, 11.15, FL + 1.1, 0.04, 0.02, 0.05, 6, 0xb08d57);                         // the bell
    light(30.6, 10.3, 1.9, 6, 2, 5);
    // the scarves wall over the kitchen's swing door, the chalkboard and the house rules
    fpanel(signs, 33.4, 8.94, 2.75, 4.5, 0.6, [0, -1], ATLAS.scarves);
    fpanel(signs, 27.54, 13.7, 1.95, 1.9, 1.33, [-1, 0], ATLAS.chalkboard);
    fpanel(signs, 13.3, 16.17, 1.85, 1.05, 0.41, [0, -1], ATLAS.rules);
    // our neon over the restroom doors: the "+3" board and a ball. The board faces -v, and a viewer facing +v has +u
    // on their left, so the glyphs are laid out in u mirrored about the board's centre (NU): "+" at the largest u,
    // then the "3" with its upright at its smallest u, then the ball, so it reads "+3" and the ball (S1 had it
    // mirrored, reading the ball, a backwards 3 and a plus)
    const nz = 11.52, ny = 2.95, NU = 29.06;
    const seg3 = (a: P2, b: P2, hex: number) => ftube(neon, [2 * NU - a[0], nz, ny + a[1]], [2 * NU - b[0], nz, ny + b[1]], 0.018, 4, hex);
    for (const [a, b] of [[[28.0, -0.3], [28.0, 0.3]], [[27.7, 0], [28.3, 0]], [[28.6, 0.3], [29.1, 0.3]], [[29.1, 0.3], [29.1, -0.3]], [[28.75, 0], [29.1, 0]], [[28.6, -0.3], [29.1, -0.3]]] as [P2, P2][]) seg3(a, b, HEX.coral);
    for (let k = 0; k < 16; k++) { const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2; seg3([30.1 + Math.cos(a0) * 0.32, Math.sin(a0) * 0.32], [30.1 + Math.cos(a1) * 0.32, Math.sin(a1) * 0.32], HEX.lime); }
    seg3([29.8, 0.1], [30.4, 0.1], HEX.lime); seg3([29.85, -0.12], [30.35, -0.12], HEX.lime);
    light(29.1, 11.2, 2.9, 5, 2, 5);
  }
  // the exit signs over both doors (lit whenever the bar is dark too)
  {
    const fm = fd(-0.27, FRONT.doorC);
    fpanel(exit, fm[0], fm[1], 2.75, 0.42, 0.19, FS_IN, ATLAS.exit);
    fpanel(exit, 18.9, 0.55, 2.75, 0.42, 0.19, [0, 1], ATLAS.exit);
  }

  // ---------------------------------------------------------------- the screens (12): a still SIMULATED test card
  const card: UV = { u0: 0, v0: 0, u1: 1, v1: 1 };
  for (const s of SCREENS) {
    const back: P2 = [s.at[0] - s.face[0] * 0.06, s.at[1] - s.face[1] * 0.06];
    fpanel(screens, s.at[0], s.at[1], s.y, s.w, s.h, s.face, card);
    const [x, z] = L(back[0], back[1]);
    paint.box(x, s.y, z, s.face[0] ? 0.08 : s.w + 0.06, s.h + 0.06, s.face[0] ? s.w + 0.06 : 0.08, 0x0b0b0e, rot);
    light(s.at[0] + s.face[0] * 0.6, s.at[1] + s.face[1] * 0.6, s.y, s.id === 'big' ? 12 : 3, 2, s.id === 'big' ? 9 : 4);
  }
  fbox(neon, 35.72, 35.76, 3.2, 6.3, 1.2, 1.32, HEX.lime);                                      // the score ticker under the big screen

  // ---------------------------------------------------------------- the patio (the owner's patio-night photos)
  // Vega & Vinnie's patio, as the owner's three night photos show it: a stained concrete floor, a dark textured ceiling
  // on black steel posts and beams, warm Edison-bulb string lights in swags, black horizontal-slat planter walls topped
  // with shrubs (lit from below after dark), round butcher-block tables on black pedestals with black mesh bistro chairs,
  // a tall butcher-block high-top with four black stools, two pyramid glass-tube flame heaters on wood-topped black
  // planter pedestals and a stainless mushroom heater. Sized to the owner's rule (layout.ts PATIO: u 2-27, 140 m2)
  const PV1 = 0.0;
  // (2026-11-23) the patio's steel, wood and floor, drawn at every mode but kept out of the shadow maps at HD and Ultra (the patio is
  // under its own ceiling, so the sun never sees it; Ultra's sun map had no room for it): built apart, then added to
  // the steel batch's Low and HD/Ultra parts both (lod.ts)
  const pSteel = new Batch(steel.uvScale); pSteel.ao = steel.ao;
  const pWood = new Batch(patioWood.uvScale), pConc = new Batch(concrete.uvScale); pWood.ao = patioWood.ao; pConc.ao = concrete.ao;
  {
    const U0 = PATIO.out.u0, U1 = PATIO.out.u1, V0 = PATIO.out.v0, wallV = southWallV;
    const pr: P2[] = [[U0, V0], [U1, V0], [U1, wallV(U1)], [U0, wallV(U0)]];
    // the stained concrete floor, subdivided to 1 m so the bulbs' baked light reads on it
    pConc.plane(pr, [], (u, v) => P3(u, v, FL), [0, 1, 0], 0x625c55, 1.0); pConc.walls(ring(pr), 0, FL, 0x5a544c);
    // the fence line: steel posts and a top rail at 1.1 m (the collider), wrapped outside by the slat planter walls
    const fenceLine: P2[] = [[U0, wallV(U0)], [U0, V0], [U1, V0], [U1, wallV(U1)]];
    const PH = 2.95, POSTS = [2.0, 7.0, 12.0, 17.0, 22.0, 27.0];
    for (let i = 1; i < fenceLine.length; i++) {
      const [a, b] = [fenceLine[i - 1], fenceLine[i]];
      ftube(pSteel, [a[0], a[1], FL + PATIO.fenceH], [b[0], b[1], FL + PATIO.fenceH], 0.03, 5, STEEL);
      col.push(seg(...L(a[0], a[1]), ...L(b[0], b[1]), PATIO.fenceT, 'fence', false));
      // the slat planter wall outside the line: a black box 0.38 m deep, 0.95 m tall, horizontal slats on its face,
      // shrubs in it rising to about 1.9 m
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tu = (b[0] - a[0]) / len, tv = (b[1] - a[1]) / len;
      const nu = tv, nv = -tu;                                                   // outward (away from the patio)
      const sgn = ((a[0] + b[0]) / 2 - 14) * nu + ((a[1] + b[1]) / 2 + 2.7) * nv > 0 ? 1 : -1, ou = nu * sgn, ov = nv * sgn;
      const off = (t: number, d: number, y: number): [number, number, number] => [a[0] + tu * t + ou * d, a[1] + tv * t + ov * d, y];
      const box4 = (t0: number, t1: number, d0: number, d1: number, y0: number, y1: number, hex: number, b: Batch = paint) => {
        const c = off((t0 + t1) / 2, (d0 + d1) / 2, 0); const [x, z] = L(c[0], c[1]);
        const [lx, lz] = F.dirToLocal(tu, tv); b.box(x, (y0 + y1) / 2, z, t1 - t0, y1 - y0, d1 - d0, hex, Math.atan2(-lz, lx));
      };
      // (2026-11-23, the art review: the slats barely read) a near-black backing set 4 cm behind charcoal slats with
      // dark gaps between them, on both faces
      box4(0, len, 0.1, 0.4, 0, 0.95, 0x0b0b0c);
      // (HD and Ultra seven slats a face, both faces; Low four broader ones on the outer face)
      for (let y = 0.06; y < 0.92; y += 0.125) { box4(0.02, len - 0.02, 0.4, 0.46, y, y + 0.085, 0x3a3a40, paintHi); box4(0.02, len - 0.02, 0.04, 0.1, y, y + 0.085, 0x34343a, paintHi); }
      for (let y = 0.08; y < 0.92; y += 0.22) box4(0.02, len - 0.02, 0.4, 0.46, y, y + 0.14, 0x3a3a40, paintLo);
      box4(0, len, 0.04, 0.46, 0.94, 0.98, 0x26262a);
      // the shrubs on top (the 2026-11-23 art review: the old single domes read as flat lime blobs): at HD and Ultra
      // leafy clusters, each five to seven small dark-olive clumps of varied size round a taller core, their upper
      // rings a lighter yellow-green (the uplit tips in the photos), one cluster every 0.5 m; at Low one larger clump a
      // metre. Warm uplights under them every 1.5 m (baked), so after dark they glow from below as in the photos
      for (let t = 0.25; t < len - 0.1; t += 0.5) {
        const [cu, cv] = off(t, 0.25, 0);
        leafy(cu, cv, 0.95, 0.34 + 0.05 * Math.sin(t * 7.1), 0.72 + 0.16 * Math.sin(t * 3.3), t * 13.7 + len, plantsHi);
      }
      for (let t = 0.6; t < len - 0.1; t += 1.3) { const [pu, pv] = off(t, 0.25, 0); shrub(pu, pv, 0.95, 0.56, 0.85, 0x34502a, plantsLo, 5); }
      for (let t = 0.75; t < len - 0.3; t += 1.5) { const [pu, pv] = off(t, 0.7, 0); light(pu, pv, 0.9, 1.0, 0, 2.0); }
    }
    // black steel posts and beams, the dark textured ceiling on them
    for (const u of POSTS) { fbox(pSteel, u - 0.07, u + 0.07, V0 - 0.07, V0 + 0.07, FL, PH, STEEL); fbox(pSteel, u - 0.05, u + 0.05, V0, wallV(u) - 0.02, PH - 0.22, PH, STEEL); }
    fbox(pSteel, U0 - 0.05, U1 + 0.05, V0 - 0.07, V0 + 0.07, PH - 0.26, PH, STEEL);
    {
      const DOWN = [0, -1, 0], UPF = [0, 1, 0];
      paint.plane(pr, [], (u, v) => P3(u, v, PH + 0.02), DOWN, 0x2b2724, 1.4);
      paint.plane(pr, [], (u, v) => P3(u, v, PH + 0.16), UPF, 0x3a3a3c, 4.0);
      paint.walls(ring([[U0 - 0.05, V0 - 0.08], [U1 + 0.05, V0 - 0.08], [U1 + 0.05, wallV(U1)], [U0 - 0.05, wallV(U0)]]), PH, PH + 0.18, 0x141416);
    }
    // the Edison-bulb string lights: swags along the outer beam, across the patio from the wall to the beam at every
    // post, and two runs down its length, sagging between their ends (warm amber bulbs in the neon batch)
    // (HD and Ultra: every swag, each bulb a socket and a glass bulb; Low: the outer beam's and the two long runs' swags
    // only, a coarser wire and each bulb two crossed quads; the baked light is the same at every mode)
    const swag = (a: [number, number, number], b: [number, number, number], n: number, sag: number, low: boolean) => {
      const at = (t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)];
      for (let k = 0; k < 8; k++) ftube(steelHi, at(k / 8), at((k + 1) / 8), 0.005, 3, 0x111111);
      for (let k = 1; k < n; k++) { const [u, v, y] = at(k / n); fcyl(steelHi, u, v, y - 0.035, 0.012, 0.012, 0.035, 4, 0x111111, false); fcyl(neonHi, u, v, y - 0.1, 0.014, 0.03, 0.065, 4, 0xffb24a, false); }
      if (low) {
        for (let k = 0; k < 4; k++) ftube(steelLo, at(k / 4), at((k + 1) / 4), 0.007, 3, 0x111111);
        for (let k = 1; k < n; k++) {
          const [u, v, y] = at(k / n), c = P3(u, v, y - 0.075);
          for (const [dx, dz] of [[0.03, 0], [0, 0.03]]) neonLo.quad([c[0] - dx, c[1] - 0.04, c[2] - dz], [c[0] + dx, c[1] - 0.04, c[2] + dz], [c[0] + dx, c[1] + 0.04, c[2] + dz], [c[0] - dx, c[1] + 0.04, c[2] - dz], 0xffb24a);
        }
      }
      for (const t of [0.25, 0.75]) { const [u, v, y] = at(t); light(u, v, y - 0.2, 3.2, 0, 5, 0.6); }
    };
    const TOPY = PH - 0.12;
    for (let i = 1; i < POSTS.length; i++) swag([POSTS[i - 1], V0 + 0.08, TOPY], [POSTS[i], V0 + 0.08, TOPY], 9, 0.38, true);
    for (const u of POSTS) swag([u, V0 + 0.1, TOPY], [u, wallV(u) - 0.1, TOPY], 6, 0.3, false);
    for (const v of [-1.6, -3.7]) for (let i = 1; i < POSTS.length; i++) swag([POSTS[i - 1], v, TOPY], [POSTS[i], v, TOPY], 8, 0.32, true);
    // round butcher-block tables on black pedestal bases, four black mesh bistro chairs each (at the seat slots)
    // (HD and Ultra: a perforated steel seat and back, alpha-tested, on four thin legs; Low: a block chair)
    const chair = (su: number, sv: number, fu: number, fv: number) => {
      const CH = 0x1b1b1d;
      const bu = su - fu * 0.2, bv = sv - fv * 0.2;                                           // the back, away from the table
      const [lx, lz] = F.dirToLocal(-fv, fu), br = Math.atan2(-lz, lx);
      fcyl(meshHi, su, sv, 0.55, 0.22, 0.22, 0.025, 10, CH);                                  // the perforated seat
      fcyl(steelHi, su, sv, 0.545, 0.225, 0.225, 0.03, 10, CH, false);                        // its rim
      for (const [du, dv] of [[-0.15, -0.15], [0.15, -0.15], [0.15, 0.15], [-0.15, 0.15]]) ftube(steelHi, [su + du * 1.1, sv + dv * 1.1, FL], [su + du, sv + dv, 0.56], 0.012, 4, CH);
      ftube(steelHi, [bu - fv * 0.18, bv + fu * 0.18, 0.57], [bu - fv * 0.19, bv + fu * 0.19, 1.02], 0.012, 4, CH);
      ftube(steelHi, [bu + fv * 0.18, bv - fu * 0.18, 0.57], [bu + fv * 0.19, bv - fu * 0.19, 1.02], 0.012, 4, CH);
      { const [x, z] = L(bu - fu * 0.01, bv - fv * 0.01); meshHi.box(x, 0.82, z, 0.36, 0.36, 0.008, CH, br); steelHi.box(x, 1.01, z, 0.4, 0.025, 0.025, CH, br); }
      { const [x, z] = L(su, sv); paintLo.box(x, 0.36 + FL / 2, z, 0.42, 0.42, 0.42, CH); }
      { const [x, z] = L(bu, bv); paintLo.box(x, 0.8, z, 0.42, 0.44, 0.04, CH, br); }
    };
    // (2026-11-23, the art review: the long tables, benches and rail stools read as a corridor, not the photos' cafe)
    // seven round tables in two staggered rows, the four chairs of each on its diagonals turned to face it
    for (const [u, v] of PATIO_TABLES) {
      fcyl(pWood, u, v, 0.86, 0.43, 0.43, 0.06, 16, 0xc08a52);                           // the butcher-block top
      fcyl(pWood, u, v, 0.845, 0.41, 0.43, 0.018, 16, 0x8a5a32, false);                   // its darker edge grain
      fcyl(pSteel, u, v, FL, 0.045, 0.045, 0.71, 6, STEEL, false);                        // the pedestal
      fcyl(pSteel, u, v, FL, 0.27, 0.25, 0.035, 14, STEEL);                               // its round base
      for (const c of PT_CHAIRS) { const l = Math.hypot(c.d[0], c.d[1]); chair(u + c.d[0], v + c.d[1], -c.d[0] / l, -c.d[1] / l); }
    }
    // the high-top: a tall square butcher-block table on a black post and cross foot, four black stools (one a side)
    {
      const [hu, hv] = PATIO_HIGHTOP.at;
      fbox(pWood, hu - 0.4, hu + 0.4, hv - 0.4, hv + 0.4, 1.1, 1.16, 0xc08a52);
      fbox(pWood, hu - 0.4, hu + 0.4, hv - 0.4, hv + 0.4, 1.085, 1.1, 0x8a5a32);
      fcyl(pSteel, hu, hv, FL, 0.05, 0.05, 0.95, 6, STEEL, false);
      fbox(pSteel, hu - 0.3, hu + 0.3, hv - 0.04, hv + 0.04, FL, FL + 0.05, STEEL); fbox(pSteel, hu - 0.04, hu + 0.04, hv - 0.3, hv + 0.3, FL, FL + 0.05, STEEL);
      for (const [su, sv] of PATIO_HIGHTOP.stools) stool(su, sv, 0x1d1b1e, pSteel);
    }
    // the heaters: two pyramid glass-tube flame heaters on wood-topped black planter pedestals, a stainless mushroom one
    // (2026-11-23: the flames in their own batch on HD and Ultra, which flicker; at Low in the lamps' batch, steady, as
    // before the repair, so Low draws no extra call; the mushroom heater's burner is stainless, not a white glow)
    HEATERS.forEach(([u, v], k) => {
      if (k < 2) {
        fbox(paint, u - 0.25, u + 0.25, v - 0.25, v + 0.25, FL, FL + 0.55, 0x161618);                         // the pedestal
        fbox(pWood, u - 0.28, u + 0.28, v - 0.28, v + 0.28, FL + 0.55, FL + 0.6, 0xc08a52);              // its wood top
        const y0 = FL + 0.6, y1 = y0 + 1.45;
        fbox(pSteel, u - 0.2, u + 0.2, v - 0.2, v + 0.2, y0, y0 + 0.12, 0x9aa0a6);
        for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ftube(pSteel, [u + du * 0.17, v + dv * 0.17, y0 + 0.12], [u + du * 0.09, v + dv * 0.09, y1], 0.012, 4, 0x9aa0a6);
        fcyl(pSteel, u, v, y1, 0.14, 0.16, 0.05, 4, 0x9aa0a6); fcyl(pSteel, u, v, y1 + 0.05, 0.16, 0.02, 0.1, 4, 0x9aa0a6);
        fcyl(glassPatio, u, v, y0 + 0.12, 0.06, 0.06, 1.3, 8, 0xffffff, false);
        fcyl(flamesHi, u, v, y0 + 0.22, 0.04, 0.012, 1.05, 6, 0xffffff, false);
        fcyl(lampsLo, u, v, y0 + 0.22, 0.04, 0.012, 1.05, 4, 0xff8a40, false);
        light(u, v, y0 + 0.8, 5, 0, 5);
      } else {
        fcyl(pSteel, u, v, FL, 0.24, 0.22, 0.62, 14, 0x9ba1a7);                                               // the tank
        fcyl(pSteel, u, v, FL + 0.62, 0.05, 0.05, 1.45, 8, 0xa6acb2, false);
        fcyl(pSteel, u, v, FL + 2.02, 0.1, 0.12, 0.17, 10, 0x55595e);                                          // the burner's grille
        fcyl(pSteel, u, v, FL + 2.19, 0.06, 0.48, 0.16, 18, 0xa9afb5);                                         // the reflector
        light(u, v, FL + 1.9, 4, 0, 4);
      }
    });
    // planters along the fence: low black boxes with shrubs
    for (const [u0, u1, v0, v1] of PATIO_PLANTERS) { fbox(paint, u0, u1, v0, v1, FL, FL + 0.55, 0x161618); for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.6) shrub(u, (v0 + v1) / 2, FL + 0.55, 0.3, 0.6, 0x3f6232, plantsHi); for (let u = u0 + 0.45; u < u1 - 0.2; u += 0.9) shrub(u, (v0 + v1) / 2, FL + 0.55, 0.42, 0.6, 0x3f6232, plantsLo, 5); }
    // the patio door (the leaves are the door mesh below), its approach kept clear
    void PV1;
  }
  steelLo.add(pSteel); steelHi.add(pSteel);
  { const [wLo, wHi] = lod(patioWood), [cLo, cHi] = lod(concrete); wLo.add(pWood); wHi.add(pWood); cLo.add(pConc); cHi.add(pConc); }

  // ---------------------------------------------------------------- the front: walk, kerb ramp, planters, bike rack, signs
  const FS_D = fd;
  {
    const W = FRONT.walk, R = FRONT.ramp;
    const walkRing: P2[] = [FS_D(0, W.s0), FS_D(W.d1, W.s0), FS_D(W.d1, W.s1), FS_D(0, W.s1)];
    concrete.cap(ring(walkRing), FL, 0xe2ddd3); concrete.walls(ring(walkRing), 0, FL, 0xc9c4ba);
    // the kerb ramp: 1.8 m wide, rising 0.15 m over the strip's 1.8 m, with 0.5 m flares
    const rp = (d: number, s: number, y: number): [number, number, number] => { const [u, v] = FS_D(d, s); return [u, v, y]; };
    fquad(concrete, [rp(R.d1, R.s0, 0.01), rp(R.d1, R.s1, 0.01), rp(R.d0, R.s1, FL + 0.005), rp(R.d0, R.s0, FL + 0.005)], 0xd0cbc0);
    const tri3 = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => { const A = P3(...a), B = P3(...b), C = P3(...c); concrete.tri(A, B, C, 0xc8c3b8); concrete.tri(A, C, B, 0xc8c3b8); };
    tri3(rp(R.d1, R.s0 - R.flare, 0.01), rp(R.d1, R.s0, 0.01), rp(R.d0, R.s0, FL + 0.005));
    tri3(rp(R.d1, R.s1, 0.01), rp(R.d1, R.s1 + R.flare, 0.01), rp(R.d0, R.s1, FL + 0.005));
    for (let s = R.s0 + 0.1; s < R.s1; s += 0.12) fquad(marks, [rp(R.d1 - 0.05, s, 0.03), rp(R.d1 - 0.05, s + 0.05, 0.03), rp(R.d1 - 0.45, s + 0.05, 0.07), rp(R.d1 - 0.45, s, 0.07)], 0xd8b84a);
    // the front's planters (the owner's front photo, 2026-11-23 repair): terracotta pots of red-tipped shrubs at both
    // planter spots by the kerb and a big one beside the door under the mural; against the black wall at the north end
    // the hedge wall ("WINES COLD BEER" on its face) rising out of a corten box, and a long low corten planter box under
    // the mural's right half (the wall items keep 1.3 m or more of the walk clear in front of the bike rack)
    const pot = (s0: number, d0: number, r: number, h: number) => {
      const c = FS_D(d0, s0);
      fcyl(paint, c[0], c[1], FL, r * 0.74, r, h, 10, 0xc98a5a, false); fcyl(paint, c[0], c[1], FL + h, r * 1.04, r * 1.04, 0.07, 10, 0xb97a4c);
      fcyl(paintHi, c[0], c[1], FL + h * 0.45, r * 0.9, r * 0.92, 0.04, 10, 0xb07448, false);
      { const [x, z] = L(c[0], c[1]); blob(plants, x, FL + h + 0.02, z, r * 1.25, r * 2.3, 7, 0x3d5c2e, 0x9a3a22); }      // red-tipped photinia
      const [x, z] = L(c[0], c[1]); col.push(circ(x, z, r + 0.04, 'planter', false));
    };
    for (const p of FRONT.planters) for (const sc of [p.s0 + 0.3, p.s1 - 0.3]) pot(sc, (p.d0 + p.d1) / 2, 0.29, 0.5);
    pot(10.75, 0.55, 0.36, 0.6);
    {
      const corten = (s0: number, s1: number, d0: number, d1: number, h: number) => {
        const r: P2[] = [FS_D(d0, s0), FS_D(d1, s0), FS_D(d1, s1), FS_D(d0, s1)];
        concrete.cap(ring(r), FL + h, 0x3a2a20); concrete.walls(ring(r), FL, FL + h, 0x8a4126);
        return r;
      };
      col.push(poly(ring(corten(14.0, 16.25, 0.05, 0.62, 0.62)), 'planter', false));
      // the hedge wall: a clipped box of leaves 1.3 m along the wall, 0.5 m deep, to 2.6 m, out of its corten base
      const H0 = 16.3, H1 = 17.6, D0 = 0.05, D1 = 0.6;
      corten(H0, H1, D0, D1, 0.45);
      const c = FS_D((D0 + D1) / 2, (H0 + H1) / 2), [x, z] = L(c[0], c[1]), [tx, tz] = F.dirToLocal(FRONT_S[0], FRONT_S[1]), hr = Math.atan2(-tz, tx);
      plants.box(x, (FL + 0.45 + 2.6) / 2, z, H1 - H0 - 0.04, 2.6 - FL - 0.45, D1 - D0 - 0.06, 0x3f5a2e, hr);
      // its leafy face (HD and Ultra: tufts on the face and the south end; Low: the clipped box alone)
      // (small, many and jittered, so the face reads as clipped leaves, not blocks)
      for (let k = 0; k < 9; k++) for (let y = FL + 0.6, j = 0; y < 2.52; y += 0.15, j++) {
        const sk = H0 + 0.08 + k * 0.145 + 0.05 * Math.sin(y * 13 + k * 2.1);
        if (Math.abs(sk - (H0 + H1) / 2) < 0.24 && y > 1.06 && y < 1.9) continue;                    // the plaque
        const q = FS_D(D1 - 0.03 + 0.02 * Math.sin(k * 5 + j), sk), [qx, qz] = L(q[0], q[1]), hue = (k * 7 + j * 3) % 5;
        blob(plantsHi, qx, y - 0.05, qz, 0.075, 0.13, 5, hue < 2 ? 0x3e5c2c : hue < 4 ? 0x4c6c36 : 0x5c7e40);
      }
      const pc = FS_D(D1 + 0.01, (H0 + H1) / 2); fpanel(signs, pc[0], pc[1], 1.47, 0.34, 0.76, FN_OUT, ATLAS.wines);
      // tall: it hides the camera as a wall does, so the third-person camera never sits inside it
      col.push(poly(ring([FS_D(D0, H0), FS_D(D1, H0), FS_D(D1, H1), FS_D(D0, H1)]), 'hedge', true));
    }
    // the red bollards along the kerb, clear of the ramp, the planters and the bike rack
    for (const sb of [0.4, 1.9, 5.0, 6.3, 11.3, 16.0]) { const c = FS_D(3.0, sb); fcyl(paint, c[0], c[1], FL, 0.11, 0.11, 0.92, 8, 0x8c3b26, false); fcyl(paint, c[0], c[1], FL + 0.92, 0.11, 0.02, 0.05, 8, 0x7a3220); const [x, z] = L(c[0], c[1]); col.push(circ(x, z, 0.14, 'pole', false)); }
    // the chalkboard A-frame beside the door, in the furniture strip
    {
      const c = FS_D(1.82, 6.75), b0 = FS_D(1.62, 6.75), b1 = FS_D(2.02, 6.75);
      fpanel(signs, b0[0], b0[1], FL + 0.48, 0.56, 0.84, FN_OUT, ATLAS.aframe); fpanel(signs, b1[0], b1[1], FL + 0.48, 0.56, 0.84, FS_IN, ATLAS.aframe);
      const [x, z] = L(c[0], c[1]); col.push(circ(x, z, 0.27, 'stand', false));
    }
    // the four-hoop bike rack and two parked bikes
    const B = FRONT.bikes;
    for (let k = 0; k < 4; k++) {
      const s = B.s0 + 0.35 + k * 0.78, a = FS_D(2.4, s - 0.25), b = FS_D(2.4, s + 0.25);
      ftube(steel, [a[0], a[1], FL], [a[0], a[1], FL + 0.8], 0.025, 5, 0x3a3d40); ftube(steel, [b[0], b[1], FL], [b[0], b[1], FL + 0.8], 0.025, 5, 0x3a3d40); ftube(steel, [a[0], a[1], FL + 0.8], [b[0], b[1], FL + 0.8], 0.025, 5, 0x3a3d40);
    }
    for (const [s, hexc] of [[B.s0 + 0.75, HEX.coral], [B.s0 + 2.3, 0x2a6fdb]] as [number, number][]) {
      const w0 = FS_D(B.d0 + 0.1, s), w1 = FS_D(B.d1 - 0.1, s);
      for (const w of [w0, w1]) { const [x, z] = L(w[0], w[1]); steel.box(x, FL + 0.34, z, 0.04, 0.68, 0.04, 0x111111); }
      ftube(steel, [w0[0], w0[1], FL + 0.36], [w1[0], w1[1], FL + 0.36], 0.02, 4, hexc); ftube(steel, [w0[0], w0[1], FL + 0.36], [w1[0], w1[1], FL + 0.75], 0.02, 4, hexc);
    }
    col.push(poly(ring([FS_D(B.d0, B.s0), FS_D(B.d1, B.s0), FS_D(B.d1, B.s1), FS_D(B.d0, B.s1)]), 'rack', false));
    // the wordmark on the east parapet: chalk letters, a lime halo at night, and the tagline under it
    // the script sign over the door (the owner's front photo), 11.5 m x 1.68 m on the black wall and parapet
    const a = fd(0.03, 3.2), b = fd(0.03, 14.7);
    word.uvQuad(P3(a[0], a[1], 3.62), P3(b[0], b[1], 3.62), P3(b[0], b[1], 5.3), P3(a[0], a[1], 5.3), { u0: 0, v0: 0, u1: 1, v1: 1 });
    light(fd(-1.2, FRONT.len / 2)[0], fd(-1.2, FRONT.len / 2)[1], 4.6, 10, 0, 9);
    // the wings mural on the black wall beside the door, at eye height (ours: "Take Flight", no team's name or mark),
    // 5.4 m x 2.0 m; the accessible-entrance sign on the other side of the door
    { const mc = fd(0.02, 13.0); fpanel(signs, mc[0], mc[1], 2.17, 5.4, 2.0, FN_OUT, ATLAS.mural); }
    { const ac = fd(0.02, 7.45); fpanel(signs, ac[0], ac[1], 1.55, 0.3, 0.3, FN_OUT, ATLAS.ada); }
    // two gooseneck lamps flanking the sign, lighting it after dark
    for (const sl of [2.45, 15.45]) {
      const w0 = fd(0.0, sl), w1 = fd(0.55, sl), hc = fd(0.62, sl);
      ftube(steel, [w0[0], w0[1], 4.75], [w1[0], w1[1], 5.05], 0.02, 4, STEEL);
      fcyl(steel, hc[0], hc[1], 4.86, 0.17, 0.05, 0.16, 10, STEEL); fcyl(lamps, hc[0], hc[1], 4.85, 0.15, 0.15, 0.01, 10, 0xffffff);
      light(fd(0.9, sl)[0], fd(0.9, sl)[1], 4.4, 6, 0, 6, 1.2);
    }
    // a black awning over the glazing south of the door and over the door, cantilevered (no posts in the clear path),
    // with Edison bulbs under its edge
    for (const [s0, s1] of [[0.3, 7.75], [7.75, 10.15]] as [number, number][]) {
      const p = (d: number, sx: number, y: number) => { const f = fd(d, sx); return P3(f[0], f[1], y); };
      paint.quadTo(p(0, s0, 3.47), p(0, s1, 3.47), p(1.05, s1, 3.22), p(1.05, s0, 3.22), [0, 1, 0], 0x1a1a1c);
      paint.quadTo(p(0, s0, 3.45), p(1.05, s0, 3.2), p(1.05, s1, 3.2), p(0, s1, 3.45), [0, -1, 0], 0x141415);
      paint.quadTo(p(1.05, s0, 3.22), p(1.05, s1, 3.22), p(1.05, s1, 3.02), p(1.05, s0, 3.02), [FN_OUT[0], 0, FN_OUT[1]], 0x1a1a1c);
      for (let sx = s0 + 0.35; sx < s1; sx += 0.55) { const f = fd(1.0, sx); fcyl(neon, f[0], f[1], 2.9, 0.014, 0.03, 0.065, 4, 0xffb24a, false); }
    }
    // the double-sided blade sign at the south-east corner, 2.8 to 4.0 m up, over the walk
    const bs = fd(0.78, FRONT.blade.s);
    const [bx, bz] = L(bs[0], bs[1]), [sx, sz] = F.dirToLocal(FRONT_S[0], FRONT_S[1]);
    const bh = FRONT.blade.y1 - FRONT.blade.y0, by = (FRONT.blade.y0 + FRONT.blade.y1) / 2;
    blade.panel(bx + sx * 0.03, by, bz + sz * 0.03, bh / 2, bh, sx, sz, { u0: 0, v0: 0, u1: 1, v1: 1 });
    blade.panel(bx - sx * 0.03, by, bz - sz * 0.03, bh / 2, bh, -sx, -sz, { u0: 0, v0: 0, u1: 1, v1: 1 });
    const b0 = fd(0.0, FRONT.blade.s), b1 = fd(1.1, FRONT.blade.s);
    ftube(steel, [b0[0], b0[1], FRONT.blade.y1 + 0.06], [b1[0], b1[1], FRONT.blade.y1 + 0.06], 0.03, 5, STEEL);
    const e0 = fd(0.48, FRONT.blade.s), e1 = fd(1.08, FRONT.blade.s);
    for (const e of [e0, e1]) ftube(steel, [e[0], e[1], FRONT.blade.y1 + 0.06], [e[0], e[1], FRONT.blade.y1], 0.01, 3, STEEL);
    light(bs[0], bs[1], by, 6, 0, 6);
  }

  // ---------------------------------------------------------------- the doors: a double door in the front, glass doors to the patio
  const doors: BarVenue['doors'] = [];
  const leafGeo = doorLeafGeometry(0.88, 2.28);
  const doorLeaves = new THREE.InstancedMesh(leafGeo, m.doorLeaf, 4);
  doorLeaves.name = 'door-leaves'; doorLeaves.frustumCulled = false; doorLeaves.castShadow = false;
  // each leaf slides along its wall at a fixed offset and height: its point at s = 0 and its local direction, worked out
  // once (poseDoors runs every frame in the overhead view and allocates nothing)
  const leafPose: { x0: number; y0: number; z0: number; tx: number; ty: number; tz: number; s0: number; dir: number; q: THREE.Quaternion }[] = [];
  const leafAt = (at: (s: number, off: number, y: number) => number[], off: number) => { const a = at(0, off, FL), b = at(1, off, FL); return { x0: a[0], y0: a[1], z0: a[2], tx: b[0] - a[0], ty: b[1] - a[1], tz: b[2] - a[2] }; };
  for (const d of doorSpecs) {
    const k = leafPose.length, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.rot, 0));
    leafPose.push({ ...leafAt(d.at, UNIT.wallT * 0.5 - 0.04), s0: d.s0, dir: -1, q }, { ...leafAt(d.at, UNIT.wallT * 0.5 + 0.04), s0: d.s1 - 0.88, dir: 1, q });
    doors.push({ id: d.id, centre: d.centre, along: d.t, leaves: [k, k + 1], open: 0, collider: d.collider });
  }
  meshes.push(doorLeaves);

  // ---------------------------------------------------------------- colliders (furniture) and slots
  for (const c of furniture()) {
    if (c.k === 'box') { const [u0, u1, v0, v1] = c.b, [x, z] = L((u0 + u1) / 2, (v0 + v1) / 2); col.push(box(x, z, u1 - u0, v1 - v0, rot, c.tag, !!c.tall)); }
    else if (c.k === 'circ') { const [x, z] = L(c.c[0], c.c[1]); col.push(circ(x, z, c.c[2], c.tag, !!c.tall)); }
    else col.push(poly(ring(c.p), c.tag, !!c.tall));
  }
  const seats: Seat[] = [];
  const outSlots: BarVenue['slots'] = allSlots().map((s) => {
    const [x, z] = L(s.at[0], s.at[1]), [sx, sz] = L(s.stand[0], s.stand[1]);
    const o: BarVenue['slots'][number] = { ...s, x, z, sx, sz };
    if (s.kind === 'seat') { o.seatId = seats.length; seats.push({ id: seats.length, x, z, y: s.y, face: F.yawFromFrame(s.face[0], s.face[1]), kind: s.seat!, at: s.zone || 'window rail', ax: sx, az: sz }); }
    return o;
  });

  // ---------------------------------------------------------------- the walk region's pieces
  const interior = insetConvex(room.inner, -0.5);                 // the region over the walls, 0.5 m past their inner faces
  const patioPaint: P2[] = [[PATIO.u0 - 0.5, PATIO.v0 - 0.5], [PATIO.u1 + 0.5, PATIO.v0 - 0.5], [PATIO.u1 + 0.5, southWallV(PATIO.u1 + 0.5) + 0.3], [PATIO.u0 - 0.5, southWallV(PATIO.u0 - 0.5) + 0.3]];
  const frontRing: P2[] = [fd(0, FRONT.walk.s0), fd(FRONT.walk.d1, FRONT.walk.s0), fd(FRONT.walk.d1, FRONT.walk.s1), fd(0, FRONT.walk.s1)];
  const lane: P2[][] = [[[14.15, 14.05], [27.6, 14.05], [27.6, 15.2], [14.15, 15.2]], [[26.8, 13.35], [27.6, 13.35], [27.6, 14.05], [26.8, 14.05]]];
  const rampLow: P2[] = [fd((FRONT.ramp.d0 + FRONT.ramp.d1) / 2, FRONT.ramp.s0 - FRONT.ramp.flare), fd(FRONT.ramp.d1 + 0.01, FRONT.ramp.s0 - FRONT.ramp.flare), fd(FRONT.ramp.d1 + 0.01, FRONT.ramp.s1 + FRONT.ramp.flare), fd((FRONT.ramp.d0 + FRONT.ramp.d1) / 2, FRONT.ramp.s1 + FRONT.ramp.flare)];
  void hostOuterF;
  /** pose the door leaves: open 0..1 for each door; cut (overhead, that wall cut away) lowers the leaves to 0.9 m */
  // made once: poseDoors runs every frame in the overhead view
  const pm4 = new THREE.Matrix4(), pp = new THREE.Vector3(), psc = new THREE.Vector3();
  const poseDoors = (cut: Record<string, boolean>) => {
    for (let di = 0; di < doors.length; di++) {
      const d = doors[di], low = cut[d.id === 'front' ? 'front' : 'south'] ? 0.33 : 1;
      for (let j = 0; j < d.leaves.length; j++) {
        const li = d.leaves[j], lp = leafPose[li], s = lp.s0 + lp.dir * 0.86 * d.open;
        pp.set(lp.x0 + lp.tx * s, lp.y0 + lp.ty * s, lp.z0 + lp.tz * s); psc.set(1, low, 1);
        doorLeaves.setMatrixAt(li, pm4.compose(pp, lp.q, psc));
      }
    }
    doorLeaves.instanceMatrix.needsUpdate = true;
  };
  poseDoors({});
  return {
    poseDoors,
    colliders: col, closedOnly, seats, slots: outSlots, walls, roofs: [], pool, doors, doorLeaves, meshes, emitters,
    insideLights: [
      ...POOL_TABLES.map(([u, v]) => { const [x, z] = L(u, v); return { x, y: 2.05, z, kind: 'pool' as const }; }),
      (() => { const [x, z] = L(34.6, 4.75); return { x, y: 2.4, z, kind: 'fill' as const }; })(),
      (() => { const [x, z] = L(20.4, 14.2); return { x, y: 2.6, z, kind: 'back' as const }; })(),
    ],
    region: { front: ring(frontRing), patio: ring(patioPaint), interior: ring(interior), cut: lane.map(ring), raised: [ring(frontRing), ring([[PATIO.out.u0, PATIO.out.v0], [PATIO.out.u1, PATIO.out.v0], [PATIO.out.u1, southWallV(PATIO.out.u1) + 0.01], [PATIO.out.u0, southWallV(PATIO.out.u0) + 0.01]]), ring(insetConvex(room.inner, -UNIT.wallT))], rampLow: ring(rampLow) },
    layout: { frontRing, patioPaint, interior, lane, rampLow },
  };
}

/** into the room through the front wall, and along the front wall (s) */
const FS_IN: P2 = [0.932, -0.362], FRONT_S: P2 = [0.362, 0.932], FN_OUT: P2 = [-0.932, 0.362];

/** a convex ring grown (d < 0) or shrunk (d > 0) by d on every edge */
function insetConvex(r: P2[], d: number): P2[] {
  const n = r.length; let area = 0; for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1, lines: { p: P2; t: P2 }[] = [];
  for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), t: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; lines.push({ p: [a[0] - t[1] * sg * d, a[1] + t[0] * sg * d], t }); }
  return lines.map((L1, i) => { const L0 = lines[(i + n - 1) % n], den = L0.t[0] * L1.t[1] - L0.t[1] * L1.t[0], dx = L1.p[0] - L0.p[0], dz = L1.p[1] - L0.p[1], k = (dx * L1.t[1] - dz * L1.t[0]) / den; return [L0.p[0] + L0.t[0] * k, L0.p[1] + L0.t[1] * k] as P2; });
}


/** one door leaf: a black-steel frame round a glass pane (vertex alpha), 0 to w along x, 0 to h up, at z 0 */
function doorLeafGeometry(w: number, h: number) {
  const pos: number[] = [], col: number[] = [];
  const quad = (x0: number, y0: number, x1: number, y1: number, z: number, c: [number, number, number, number]) => {
    for (const s of [1, -1]) {
      const p = [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]];
      if (s < 0) p.reverse();
      for (const [x, y] of p) { pos.push(x, y, z * s); col.push(...c); }
    }
  };
  const F: [number, number, number, number] = [0.05, 0.05, 0.06, 1], G: [number, number, number, number] = [0.55, 0.65, 0.7, 0.22];
  const f = 0.07;
  quad(0, 0, w, f, 0.025, F); quad(0, h - f, w, h, 0.025, F); quad(0, 0, f, h, 0.025, F); quad(w - f, 0, w, h, 0.025, F);
  quad(f, f, w - f, h - f, 0.0, G);
  quad(0.08, 1.0, w - 0.08, 1.04, 0.03, F);                     // a push bar
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
