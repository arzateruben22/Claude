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
import {
  UNIT, FRONT, fd, frontU, furniture, slots as allSlots, POOL_TABLES, DART_BOARDS, HIGHTOPS, RAIL_V, BAR, PATIO, PATIO_TABLES,
  HEATERS, PATIO_PLANTERS, JUKEBOX, SCREENS,
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
  const glassPatio = kit.get('patio-glass', m.glass, { glow: false, order: 2 });
  const restWalls = kit.get('host-walls', m.tilt, { uv: 7.5, cast: true, glow: true });
  const restRoof = kit.get('host-roof', m.roofs, { uv: 8, cast: true });
  const restWin = kit.get('host-windows', m.window, { glow: false });
  const unitRoof = kit.get('unit-roof', m.roofs, { uv: 8, cast: true });
  const ceiling = kit.get('unit-ceiling', m.interior, { ao: false });
  const word = kit.get('unit-wordmark', m.wordmark, { glow: false, order: 3 });
  const blade = kit.get('unit-blade', m.blade, { glow: false });

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
  /** an agave (or a clump of grass): stiff blades from a rosette at frame (u, v), its base at y */
  const agave = (b: Batch, u: number, v: number, y: number, r: number) => {
    const [x, z] = L(u, v);
    for (let k = 0; k < 11; k++) {
      const a = k * 2.399, len = r * (0.75 + 0.35 * ((k * 37) % 7) / 7), lean = 0.55 + 0.3 * ((k * 13) % 5) / 5;
      const dx = Math.sin(a), dz = Math.cos(a), px = -dz * 0.05, pz = dx * 0.05;
      const tip = [x + dx * len * lean, y + len * (1 - lean * 0.45) + 0.1, z + dz * len * lean];
      b.tri([x + px, y, z + pz], [x - px, y, z - pz], tip, k % 3 ? 0x5d7a5a : 0x7a9a6a);
    }
  };

  // ---------------------------------------------------------------- the rest of building 61: generic unnamed units
  {
    const rest = ring(restRing);
    restWalls.walls(rest, 0, UNIT.roof, (i) => [0xd8d1c2, 0xcfc7b6, 0xd8d1c2, 0xd3cbbb][i % 4]);
    restWalls.walls(rest, UNIT.roof - 0.6, UNIT.roof - 0.35, 0x8a8577);            // blank sign bands, a reveal near the top
    restWalls.walls(rest, UNIT.roof, UNIT.roof + 0.45, 0xd8d1c2);                   // the parapet
    restRoof.cap(rest, UNIT.roof, 0xa7a49c);
    col.push(poly(rest, 'building', true));
    // storefront bays along its long walls (dark glass, a few lit at night) and roll-up doors on the north wing's
    // courtyard face; no names anywhere
    let area = 0; for (let i = 0; i < rest.length; i++) { const [x0, z0] = rest[i], [x1, z1] = rest[(i + 1) % rest.length]; area += x0 * z1 - x1 * z0; }
    let k = 0;
    for (let i = 0; i < rest.length; i++) {
      const [ax, az] = rest[i], [bx, bz] = rest[(i + 1) % rest.length], len = Math.hypot(bx - ax, bz - az);
      if (len < 10) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len, nx = (area > 0 ? uz : -uz) * 0.05, nz = (area > 0 ? -ux : ux) * 0.05;
      const Q = (t: number, y: number) => [ax + ux * t + nx, y, az + uz * t + nz];
      const wing = i === 0;                         // the north wing's courtyard face: roll-up doors
      for (let t = 3; t + 3.4 < len - 2; t += 6.2, k++) {
        const out = [nx, 0, nz];
        if (wing && k % 2 === 0) { restWin.quadTo(Q(t, 0), Q(t + 3.6, 0), Q(t + 3.6, 3.4), Q(t, 3.4), out, 0x8d9093); continue; }
        const lit = Math.sin(k * 91.7) > 0.55 ? 0xffffff : 0x202428;
        restWin.quadTo(Q(t, 0.2), Q(t + 3.4, 0.2), Q(t + 3.4, 2.8), Q(t, 2.8), out, lit);
      }
    }
  }

  // ---------------------------------------------------------------- our unit's walls (one mesh per side, full and cut)
  // night violet in the sun: the paint's own colour, lifted a step so a sunlit wall reads violet, not black
  const OAK = 0xc08a58;
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
    const outC = w.id === 'party' ? INSIDE : VIOLET;
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
    for (const d of doors) { if (d.s0 > cursor) runs.push({ s0: cursor, s1: d.s0, kind: w.glazed ? 'glass' : 'solid' }); runs.push({ s0: d.s0, s1: d.s1, kind: 'door' }); cursor = d.s1; }
    if (cursor < len) runs.push({ s0: cursor, s1: len, kind: w.glazed ? 'glass' : 'solid' });
    const glassY = w.id === 'front' ? [0.45 + FL, 3.05] : [0.95 + FL, 2.75], doorY = 2.45;
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
      if (g0 > 0.05) { q(S.full, r.s0, r.s1, 0, 0, g0, outC, -1); q(S.full, ends[0], ends[1], T, FL, g0, INSIDE, 1); S.full.quadTo(at(r.s0, 0, g0), at(r.s1, 0, g0), at(r.s1, T, g0), at(r.s0, T, g0), UP, INSIDE); }
      q(S.full, r.s0, r.s1, 0, g1, TOP, outC, -1); q(S.full, ends[0], ends[1], T, g1, CEIL, INSIDE, 1);
      S.full.quadTo(at(r.s0, T, g1), at(r.s1, T, g1), at(r.s1, 0, g1), at(r.s0, 0, g1), DOWN, INSIDE);
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
    if (band > TOP) { q(S.full, 0, len, 0, TOP, band, VIOLET, -1); q(S.full, 0, len, T, TOP, band, VIOLET, 1); S.full.quadTo(at(0, 0, band), at(len, 0, band), at(len, T, band), at(0, T, band), UP, 0x2a2640); }
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
    ceiling.emit = [0, 0, 0.55];
    ceiling.plane(room.inner, [], (u, v) => P3(u, v, CEIL), DOWN, 0x8c8698, 1.4);
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
      strip(u - 0.3, v - 0.3, u + 0.3, v + 0.3, gy - 0.004, 0xc9c5cf);
      for (let k = 0; k < 3; k++) { const d = 0.22 - k * 0.07; strip(u - d, v - d, u + d, v + d, gy - 0.008 - k * 0.004, k % 2 ? 0xb3aebb : 0x4a4656); }
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
  function stool(u: number, v: number, seatHex = 0x1d1b22) {
    fcyl(steel, u, v, FL, 0.2, 0.18, 0.03, 10, STEEL);
    fcyl(steel, u, v, FL + 0.03, 0.025, 0.025, 0.72, 5, STEEL, false);
    ftube(steel, [u - 0.16, v, FL + 0.3], [u + 0.16, v, FL + 0.3], 0.012, 4, STEEL);
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

  // ---------------------------------------------------------------- the patio: paving, fence, pergola, tables, heaters
  const PV1 = 0.0;
  {
    const wallV = (u: number) => 0.012 * u;                                                        // the south wall's outer face
    const pr: P2[] = [[2.0, -5.5], [24.0, -5.5], [24.0, wallV(24)], [2.0, wallV(2)]];
    concrete.cap(ring(pr), FL, 0xd6d0c4); concrete.walls(ring(pr), 0, FL, 0xb8b2a6);
    // the fence: 1.1 m glass and steel, inner faces at u 2.05, u 23.95 and v -5.45; posts in the fence line
    const fenceLine: P2[] = [[2.0, wallV(2)], [2.0, -5.5], [24.0, -5.5], [24.0, wallV(24)]];
    for (let i = 1; i < fenceLine.length; i++) {
      const [a, b] = [fenceLine[i - 1], fenceLine[i]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 1.8));
      for (let k = 0; k <= n; k++) { const t = k / n, u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t; fcyl(steel, u, v, FL, 0.035, 0.035, PATIO.fenceH, 6, STEEL, false); }
      ftube(steel, [a[0], a[1], FL + PATIO.fenceH], [b[0], b[1], FL + PATIO.fenceH], 0.03, 5, STEEL);
      glassPatio.quad(P3(a[0], a[1], FL + 0.08), P3(b[0], b[1], FL + 0.08), P3(b[0], b[1], FL + PATIO.fenceH - 0.04), P3(a[0], a[1], FL + PATIO.fenceH - 0.04), 0xffffff);
      col.push(seg(...L(a[0], a[1]), ...L(b[0], b[1]), PATIO.fenceT, 'fence', false));
    }
    // the pergola: steel posts in the fence line, beams at 2.9 m, louvres, warm linear lights under the beams
    const PH = 2.95;
    for (const u of [2.0, 7.5, 13.0, 18.5, 24.0]) { fbox(steel, u - 0.06, u + 0.06, -5.56, -5.44, FL, PH, STEEL); ftube(steel, [u, -5.5, PH], [u, wallV(u), PH], 0.05, 5, STEEL); }
    ftube(steel, [2.0, -5.5, PH], [24.0, -5.5, PH], 0.06, 5, STEEL);
    for (let u = 2.4; u < 24.0; u += 0.55) fbox(patioWood, u - 0.04, u + 0.04, -5.45, wallV(u) - 0.05, PH + 0.04, PH + 0.2, 0xb08a60);
    // the warm linear lights: thin strips, lit after dark (the lot heads' material: dark by day)
    const strips = kit.get('lot-heads', m.lampHead, { glow: false });
    for (const v of [-1.6, -3.9]) { fbox(steel, 2.3, 23.7, v - 0.025, v + 0.025, PH - 0.05, PH - 0.01, STEEL); fbox(strips, 2.3, 23.7, v - 0.018, v + 0.018, PH - 0.056, PH - 0.05, 0xffe3b0); for (let u = 4; u < 24; u += 5) light(u, v, PH - 0.2, 6, 0, 7, 1.0); }
    // six bench tables, long axis along v, a bench each side
    for (const u of PATIO_TABLES) {
      fbox(patioWood, u - 0.375, u + 0.375, -2.1, -0.5, 0.88, 0.93, OAK);
      for (const du of [-0.3, 0.3]) fbox(patioWood, u + du - 0.03, u + du + 0.03, -2.0, -0.6, FL, 0.88, 0x7a5a3a);
      for (const s of [-1, 1]) { fbox(patioWood, u + s * 0.6 - 0.15, u + s * 0.6 + 0.15, -2.05, -0.55, 0.58, 0.62, OAK); fbox(steel, u + s * 0.6 - 0.02, u + s * 0.6 + 0.02, -1.9, -0.7, FL, 0.58, STEEL); }
    }
    // the drink rail on the fence, its 6 stools facing the freeway
    fbox(patioWood, 3.0, 9.5, -5.45, -5.15, 1.08 + FL, 1.12 + FL, OAK);
    for (let k = 0; k < 6; k++) stool(3.6 + 1.05 * k, -4.75);
    // two tall heaters, their flames lit after dark while open
    for (const [u, v] of HEATERS) { fcyl(steel, u, v, FL, 0.28, 0.25, 0.08, 10, 0x6a6e72); fcyl(steel, u, v, FL + 0.08, 0.05, 0.05, 2.1, 6, 0x9aa0a6, false); fcyl(steel, u, v, FL + 2.18, 0.08, 0.42, 0.18, 10, 0x9aa0a6); fcyl(lamps, u, v, FL + 1.6, 0.07, 0.07, 0.5, 6, 0xff8a40, false); light(u, v, 2.0, 5, 0, 5); }
    // four planters of agave and grasses against the fence
    for (const [u0, u1, v0, v1] of PATIO_PLANTERS) { fbox(concrete, u0, u1, v0, v1, FL, FL + 0.55, 0x8a8478); agave(plants, (u0 + u1) / 2, (v0 + v1) / 2, FL + 0.55, Math.min(u1 - u0, v1 - v0) * 0.55); }
    // the patio door (the leaves are the door mesh below), its approach kept clear
    void PV1;
  }

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
    for (const p of FRONT.planters) {
      const r: P2[] = [FS_D(p.d0, p.s0), FS_D(p.d1, p.s0), FS_D(p.d1, p.s1), FS_D(p.d0, p.s1)];
      concrete.cap(ring(r), FL + 0.6, 0x8a8478); concrete.walls(ring(r), FL, FL + 0.6, 0x9a948a);
      const c = FS_D((p.d0 + p.d1) / 2, (p.s0 + p.s1) / 2); agave(plants, c[0], c[1], FL + 0.6, 0.4);
      col.push(poly(ring(r), 'planter', false));
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
    const a = fd(0.03, 0.6), b = fd(0.03, FRONT.len - 0.6);
    word.uvQuad(P3(a[0], a[1], 4.1), P3(b[0], b[1], 4.1), P3(b[0], b[1], 5.35), P3(a[0], a[1], 5.35), { u0: 0, v0: 0, u1: 1, v1: 1 });
    light(fd(-1.2, FRONT.len / 2)[0], fd(-1.2, FRONT.len / 2)[1], 4.6, 10, 0, 9);
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
  const patioPaint: P2[] = [[PATIO.u0 - 0.5, PATIO.v0 - 0.5], [PATIO.u1 + 0.5, PATIO.v0 - 0.5], [PATIO.u1 + 0.5, 0.012 * 24.5 + 0.3], [PATIO.u0 - 0.5, 0.012 * 1.5 + 0.3]];
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
    region: { front: ring(frontRing), patio: ring(patioPaint), interior: ring(interior), cut: lane.map(ring), raised: [ring(frontRing), ring([[2.0, -5.5], [24.0, -5.5], [24.0, 0.3], [2.0, 0.03]]), ring(insetConvex(room.inner, -UNIT.wallT))], rampLow: ring(rampLow) },
    layout: { frontRing, patioPaint, interior, lane, rampLow },
  };
}

/** into the room through the front wall, and along the front wall (s) */
const FS_IN: P2 = [0.932, -0.362], FRONT_S: P2 = [0.362, 0.932];

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
