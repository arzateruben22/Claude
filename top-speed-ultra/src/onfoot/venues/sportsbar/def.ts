// Stoppage Time as a VenueDef (PROJECT_OC_SPORTS_BAR.md, "A venue is data"). The frame is computed at load from
// building 61's ring in the bar's own slice (never copied); everything else is the plan's layout, in frame metres,
// turned into local metres (world-aligned, origin at the frame's origin O) here.
import type { VenueDef, Budget, Room, P2, SlotDef } from '../../engine/venue-def';
import type { Schedule } from '../../engine/schedule';
import type { Stall } from '../../engine/lot';
import type { Tree } from '../../engine/venue-types';
import { makeFrame, frameFromRing, Frame } from '../../engine/frame';
import { pointInPoly } from '../../engine/geom';
import sliceJson from '../../../data/anaheim/sportsbar-slice.json';
import { BAR_NAME, PALETTE } from './brand';
import { UNIT, ZONES, PZONES, slots, SCREENS, TREES, LANE_PATH, ROUTES_END, POOL_TABLES } from './layout';

export interface SliceJson {
  what: string; attribution: string;
  venue: { x: number; z: number; bld: number; site: { lot_p: number[] } };
  dict: { seg: string[]; sub: string[]; name: string[]; bcls: string[]; lu: string[]; water: string[]; infra: string[] };
  seg: { c: number | string; s?: number; n?: number; p: number[]; ow?: number; k?: number[]; br?: number | [number, number][]; tn?: number | [number, number][]; lv?: unknown }[];
  bld: { p: number[]; hl?: number[][]; h?: number; mh?: number; c?: number }[];
  landuse: { c: number; p?: number[]; l?: number[] }[];
  water: { c: number; p?: number[]; l?: number[] }[];
  infra: { c: number; p?: number[]; l?: number[]; hl?: number[][] }[];
  infra_pts: number[];
}

/** decimetre delta-coded points to game metres */
export function decodeGame(p: number[]): P2[] {
  const out: P2[] = []; let x = 0, z = 0;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; out.push([x / 10, z / 10]); }
  return out;
}

/** the plan's building-frame table, which the computed frame is checked against (to 0.1 m) */
export const FRAME_TABLE = { O: [-6616.5, -9333.8] as P2, A: [-0.9098, -0.4151] as P2, B: [0.4151, -0.9098] as P2,
  points: [{ name: 'south-east corner', g: [-6616.5, -9333.8] as P2, f: [0, 0] as P2 }, { name: 'north-east corner', g: [-6615.5, -9351.5] as P2, f: [6.4, 16.5] as P2 },
    { name: "the bar's point", g: [-6621.5, -9342.6] as P2, f: [8.2, 5.9] as P2 }, { name: 'inner corner', g: [-6665.2, -9373.5] as P2, f: [60.8, 15.9] as P2 },
    { name: 'south-west end of the arm', g: [-6684.6, -9365.8] as P2, f: [75.2, 0.9] as P2 }] };

/** the hours (ours): Mon-Thu 11-24, Fri 11-02, Sat 09-02, Sun 09-24, and the plan's crowd curve and events */
export const SCHEDULE: Schedule = {
  capacity: 130,
  hours: [[9, 24], [11, 24], [11, 24], [11, 24], [11, 24], [11, 26], [9, 26]],
  bands: [
    { from: 9, to: 11, share: [0, 0, 0.2, 0.25] }, { from: 11, to: 14, share: [0.25, 0.3, 0.35, 0.45] },
    { from: 14, to: 17, share: [0.15, 0.25, 0.5, 0.6] }, { from: 17, to: 20, share: [0.45, 0.7, 0.8, 0.65] },
    { from: 20, to: 23, share: [0.4, 0.9, 0.95, 0.35] }, { from: 23, to: 24, share: [0.2, 0.75, 0.8, 0.15] },
    { from: 24, to: 26, share: [0, 0.45, 0.5, 0] },
  ],
  events: [{ day: 2, from: 19, to: 22, factor: 1.15, label: 'House darts league' }, { day: 3, from: 19, to: 22, factor: 1.1, label: 'Pool tournament' }],
  weather: { rain: 0.95, fog: 0.95 },
  noiseSeed: 2,
};

/** (S3a) staff: Low draws at most 5; HD and Ultra up to 9 and the house player; fillerMinM 6 m at Low, 9 m at HD and Ultra */
const B = (calls: number, tris: number, frameCalls: number, frameTris: number, live: number, staff: number, drawn: Budget['drawn'], cars: Budget['cars'], castPeople: number): Budget => ({ calls, tris, frameCalls, frameTris, live, staff, drawn, cars, castPeople, fillerMinM: live > 36 ? 9 : 6 });
export const BUDGETS: VenueDef['budgets'] = {
  low: B(150, 250e3, 150, 250e3, 36, 5, { inside: { lod0: 0, lod1: 7, atLod: 36 }, outside: { lod0: 0, lod1: 7, atLod: 12 }, overhead: { lod0: 0, lod1: 6, atLod: 36 } },
    { inside: { near: 0, yours: 'standin' }, outside: { near: 4, yours: 'detailed' }, overhead: { near: 0, yours: 'standin' } }, 0),
  high: B(350, 700e3, 500, 1.1e6, 70, 10, { inside: { lod0: 0, lod1: 17, atLod: 70 }, outside: { lod0: 0, lod1: 7, atLod: 24 }, overhead: { lod0: 0, lod1: 16, atLod: 70 } },
    { inside: { near: 0, yours: 'standin' }, outside: { near: 12, yours: 'detailed' }, overhead: { near: 12, yours: 'detailed' } }, 6),
  ultra: B(600, 1.5e6, 1400, 3.6e6, 100, 10, { inside: { lod0: 1, lod1: 41, atLod: 100 }, outside: { lod0: 1, lod1: 19, atLod: 40 }, overhead: { lod0: 0, lod1: 40, atLod: 100 } },
    { inside: { near: 0, yours: 'detailed' }, outside: { near: 36, yours: 'detailed' }, overhead: { near: 36, yours: 'detailed' } }, 20),
};
/** the plan's allocations ("The allocations"), calls and triangles, which S1 measures the built rows against. Low's
 *  venue and streets were re-allocated in S1's repair (50k and 35k before; the built streets came to 38.1k at the
 *  budget poses and the venue to 16.5k); the "without people or items" sums don't move */
export const ALLOC: Record<'low' | 'high' | 'ultra', Record<'venue' | 'streets' | 'near' | 'trees', [number, number]>> = {
  low: { venue: [40, 45e3], streets: [20, 40e3], near: [14, 16e3], trees: [4, 4e3] },
  high: { venue: [50, 90e3], streets: [30, 60e3], near: [14, 16e3], trees: [4, 10e3] },
  ultra: { venue: [60, 150e3], streets: [40, 120e3], near: [15, 25e3], trees: [4, 10e3] },
};
/** S1's check: the pass without people or items, per state (the plan's sums) */
export const NO_PEOPLE: Record<'low' | 'high' | 'ultra', Record<'inside' | 'outside' | 'overhead', [number, number]>> = {
  low: { inside: [74, 101.4e3], outside: [119, 177.8e3], overhead: [74, 101.4e3] },
  high: { inside: [94, 174.4e3], outside: [139, 328.2e3], overhead: [139, 328.2e3] },
  ultra: { inside: [139, 415.4e3], outside: [159, 611.4e3], overhead: [159, 611.4e3] },
};

const lineX = (a: P2, b: P2, u: number): P2 => { const t = (u - a[0]) / (b[0] - a[0]); return [u, a[1] + (b[1] - a[1]) * t]; };
/** a convex ring inset edge by edge (each edge by its own distance), as the intersections of the moved lines */
export function insetRing(ring: P2[], d: number[]): P2[] {
  const n = ring.length, lines: { p: P2; t: P2 }[] = [];
  let area = 0; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]), t: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    const nrm: P2 = [-t[1] * sgn, t[0] * sgn];          // inward for either winding
    lines.push({ p: [a[0] + nrm[0] * d[i], a[1] + nrm[1] * d[i]], t });
  }
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const L0 = lines[(i + n - 1) % n], L1 = lines[i];
    const den = L0.t[0] * L1.t[1] - L0.t[1] * L1.t[0];
    const dx = L1.p[0] - L0.p[0], dz = L1.p[1] - L0.p[1], k = (dx * L1.t[1] - dz * L1.t[0]) / den;
    out.push([L0.p[0] + L0.t[0] * k, L0.p[1] + L0.t[1] * k]);
  }
  return out;
}

export interface BarSite {
  def: VenueDef; frame: Frame; slice: SliceJson;
  /** building 61 (game), our unit's outer and inner rings (frame), the rest of the building (frame) */
  host: P2[]; unitOuter: P2[]; unitInner: P2[]; restRing: P2[];
  /** the derived lot (frame) and its stalls' rows; the fill bias L6's rule gives these stalls */
  lot: P2[]; fillBias: number; yourStall: Stall;
  frameCheck: { computed: { O: P2; A: P2; B: P2 }; worst: number; points: { name: string; game: P2; frame: P2; want: P2; err: number }[]; pointInUnit: boolean };
}

export async function loadSite(): Promise<BarSite> {
  // a static import (the single-file build inlines it as one JSON string); the def's slice() hands the same object back
  const slice = sliceJson as unknown as SliceJson;
  const host = decodeGame(slice.bld[slice.venue.bld].p);
  const fr = frameFromRing(host, [slice.venue.x, slice.venue.z]);
  const frame = makeFrame(fr.origin, fr.A, fr.B);
  const toF = (g: P2): P2 => { const l = frame.toLocal(g[0], g[1]); return frame.toFrame(l[0], l[1]); };
  const hostF = host.map(toF);
  // our unit: the east 36 m of the arm, cut from building 61 between the front edge's two corners; the rest of the
  // building is the ring with those two corners replaced by the cut's ends
  const [s, t] = fr.front;                          // s the south-east corner (O), t the north-east one
  const n = hostF.length, sNext = (s + 1) % n === t ? (s - 1 + n) % n : (s + 1) % n, tNext = (t + 1) % n === s ? (t - 1 + n) % n : (t + 1) % n;
  const cutS = lineX(hostF[s], hostF[sNext], UNIT.u1), cutN = lineX(hostF[t], hostF[tNext], UNIT.u1);
  const unitOuter: P2[] = [hostF[s], cutS, cutN, hostF[t]];          // south-east, south cut, north cut, north-east
  const unitInner = insetRing(unitOuter, [UNIT.wallT, UNIT.partyT, UNIT.wallT, UNIT.wallT]);
  const rest: P2[] = [];
  for (let k = 0; k < n; k++) {
    if (k === s) { rest.push(cutS); continue; }
    if (k === t) { rest.push(cutN); continue; }
    rest.push(hostF[k]);
  }
  // keep the ring's order but make the two cut points adjacent (s and t are adjacent in the ring)
  const indoor = (u: number, v: number) => pointInPoly(u, v, unitInner);
  // the frame check against the plan's table
  const pts = FRAME_TABLE.points.map((p) => { const f = toF(p.g); return { name: p.name, game: p.g, frame: [+f[0].toFixed(3), +f[1].toFixed(3)] as P2, want: p.f, err: +Math.hypot(f[0] - p.f[0], f[1] - p.f[1]).toFixed(3) }; });
  const oErr = Math.hypot(fr.origin[0] - FRAME_TABLE.O[0], fr.origin[1] - FRAME_TABLE.O[1]);
  const anchorF = toF([slice.venue.x, slice.venue.z]);
  // the lot S0-data derived (frame), and our stalls on aisle 415's two east-west legs (game x, z; faces 0 or pi)
  const lotG = decodeGame(slice.venue.site.lot_p), lot = lotG.map(toF);
  const stallsG = courtyardStalls(slice);
  let best = 0, bd = Infinity;
  stallsG.forEach((st, i) => { const d = Math.hypot(st.x - ROUTES_END[0], st.z - ROUTES_END[1]); if (d < bd) { bd = d; best = i; } });
  const stalls: Stall[] = stallsG.map((st, i) => { const [x, z] = frame.toLocal(st.x, st.z); return { x, z, face: st.face, row: st.row, mine: i === best, ada: false }; });
  // L6's fill rule favours stalls near Lot 57's gate point, local (-5, 20); its mean factor over these stalls
  const others = stalls.filter((st) => !st.mine);
  const fillBias = others.reduce((a, st) => a + 0.75 + 0.5 * Math.max(0, 1 - Math.hypot(st.x + 5, st.z - 20) / 90), 0) / others.length;
  const L = (f: P2): P2 => frame.fromFrame(f[0], f[1]);
  const trees: Tree[] = TREES.map((t) => { const [x, z] = L(t.at); return { x, z, y: 0, s: t.kind === 'palm' ? 1 : 0.95, kind: t.kind }; });
  const room: Room = {
    id: 'unit', outer: unitOuter, inner: unitInner, floorY: UNIT.floor, ceilingM: UNIT.ceiling, roofM: UNIT.roof,
    walls: [
      { id: 'south', a: hostF[s], b: cutS, t: UNIT.wallT, glazed: true, openings: [{ s0: 18.0, s1: 19.8, kind: 'door', y0: 0.15, y1: 2.4 }] },
      { id: 'party', a: cutS, b: cutN, t: UNIT.partyT, glazed: false, openings: [] },
      { id: 'north', a: cutN, b: hostF[t], t: UNIT.wallT, glazed: false, openings: [] },
      // the front measured from the south-east corner, as the plan's s is
      { id: 'front', a: hostF[s], b: hostF[t], t: UNIT.wallT, glazed: true, openings: [{ s0: 8.05, s1: 9.85, kind: 'door', y0: 0.15, y1: 2.4 }] },
    ],
  };
  const allSlots: SlotDef[] = slots();
  const def: VenueDef = {
    id: 'sportsbar', name: BAR_NAME, template: 'sports-bar',
    slice: () => Promise.resolve(slice),
    frame: { origin: fr.origin, u: fr.A, v: fr.B },
    anchor: [slice.venue.x, slice.venue.z],
    groundM: 44.5,
    site: { dropSegs: [416], keepHost: { bld: slice.venue.bld, unit: unitOuter } },
    edge: lot.map(L),
    schedule: SCHEDULE,
    rooms: [room],
    indoor, ceilingM: UNIT.ceiling,
    zones: [...ZONES, ...PZONES],
    slots: allSlots,
    objects: [
      { type: 'bar-counter', id: 'bar', at: [20.4, 13.7], rot: 0 },
      ...POOL_TABLES.map((p, i) => ({ type: 'pool-table', id: `pool-${i + 1}`, at: p, rot: 0 })),
      { type: 'shuffleboard', id: 'shuffleboard', at: [6.55, 1.45], rot: 0 },
      { type: 'jukebox', id: 'jukebox', at: [32.0, 0.95], rot: 0 },
      { type: 'water-station', id: 'water', at: [29.3, 11.4], rot: 0 },
      { type: 'host-stand', id: 'host', at: [6.8, 8.2], rot: 0 },
    ],
    screens: SCREENS,
    lights: [],
    staff: { posts: [15.5, 18.7, 21.9, 25.1].map((u, i) => ({ id: `bartender ${i + 1}`, at: [u, 14.625] as P2 })), maxDrawn: { low: 5, high: 8, ultra: 10 } },
    staffPath: LANE_PATH,
    trees,
    parking: { stalls, yours: best },
    lines: [],
    sim: 'full',
    palette: PALETTE,
    budgets: BUDGETS,
  };
  return {
    def, frame, slice, host, unitOuter, unitInner, restRing: rest, lot, fillBias, yourStall: stalls[best],
    frameCheck: { computed: { O: fr.origin, A: fr.A, B: fr.B }, worst: Math.max(oErr, ...pts.map((p) => p.err)), points: pts, pointInUnit: indoor(anchorF[0], anchorF[1]) },
  };
}

/** our stalls (ours: 2.75 m x 5.5 m, every one facing 0 or pi) in four rows on aisle 415's two east-west legs, kept
 *  clear of aisle 416's line into the courtyard junction; game coordinates */
function courtyardStalls(slice: SliceJson): { x: number; z: number; face: number; row: number }[] {
  const leg = decodeGame(slice.seg[415].p);
  // the legs as mapped: the northern one from Claudina west (points 0 to 1), the southern one from the diagonal's end
  // east to Claudina (points 3 to 5)
  const north = { z: (leg[0][1] + leg[1][1]) / 2, x0: leg[1][0] + 3.5, x1: Math.min(leg[0][0], -6601.5) - 1.5 };
  const south = { z: (leg[3][1] + leg[4][1] + leg[5][1]) / 3, x0: leg[3][0] + 0.5, x1: Math.min(leg[5][0], -6601.5) - 1.5 };
  const W = 2.75, D = 5.5, half = 3, out: { x: number; z: number; face: number; row: number }[] = [];
  // aisle 416's last leg, (-6609.2, -9357.2) to the junction: no stall within its 4.5 m ribbon and a margin
  const a: P2 = [-6609.2, -9357.2], b: P2 = ROUTES_END;
  const clear416 = (x: number, z: number) => {
    // the stall's rectangle against the line, 2.25 m half-width and a 0.4 m margin
    const c: P2[] = [[x - W / 2, z - D / 2], [x + W / 2, z - D / 2], [x + W / 2, z + D / 2], [x - W / 2, z + D / 2]];
    let d = Infinity;
    for (let i = 0; i < 4; i++) d = Math.min(d, segSeg(a, b, c[i], c[(i + 1) % 4]));
    return d > 2.25 + 0.4;
  };
  const rows = [{ leg: north, side: -1, face: 0 }, { leg: north, side: 1, face: Math.PI }, { leg: south, side: -1, face: 0 }, { leg: south, side: 1, face: Math.PI }];
  rows.forEach((r, ri) => {
    const zc = r.leg.z + r.side * (half + D / 2);
    // only the southern leg's south row lies across aisle 416's line into the junction
    for (let x = r.leg.x1 - W / 2; x - W / 2 >= r.leg.x0; x -= W) if (ri !== 3 || clear416(x, zc)) out.push({ x, z: zc, face: r.face, row: ri });
  });
  return out;
}
const pSeg = (p: P2, a: P2, b: P2) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
const cross2 = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** the distance between two segments (0 when they cross) */
export function segSeg(a: P2, b: P2, c: P2, d: P2) {
  if (cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0) return 0;
  return Math.min(pSeg(a, c, d), pSeg(b, c, d), pSeg(c, a, b), pSeg(d, a, b));
}
