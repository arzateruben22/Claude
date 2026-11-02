// Stoppage Time's layout in the building frame (PROJECT_OC_SPORTS_BAR.md, "Inside", "The patio's layout", "The
// front", "The bartenders' lane path" and "Site plan"). Every number is the plan's; frame metres, u along the arm from
// the tip toward the spine, v from the arm's south wall toward the courtyard. tools/anaheim/sportsbar_zones.py holds
// the same numbers: change both together.
import type { P2, SlotDef, Zone } from '../../engine/venue-def';

export const UNIT = { u1: 36, partyFace: 35.8, wallT: 0.25, partyT: 0.2, floor: 0.15, ceiling: 3.6, roof: 4.3, band: 5.4 };

/** the front's own frame: d out from the front wall's outer face, s along it from the south-east corner */
export const FN: P2 = [-0.932, 0.362], FS: P2 = [0.362, 0.932];
export const fd = (d: number, s: number): P2 => [d * FN[0] + s * FS[0], d * FN[1] + s * FS[1]];
/** a point d_in metres in from the front wall's inner face, at frame v (the zones script's front_u) */
export const frontU = (v: number, dIn: number) => { const v0 = v + 0.362 * dIn; return 0.388 * v0 + 0.27 + 0.932 * dIn; };

export const FRONT = {
  len: 17.73, door: [8.05, 9.85] as [number, number], doorC: 8.95,
  walk: { d0: 0, d1: 3.3, s0: -0.5, s1: 18.2 }, clear: 1.5, kerbD: 3.3, gutter: [3.3, 3.75] as [number, number],
  aisle: { d0: 3.75, d1: 8.25, w: 4.5 },
  ramp: { s0: 8.05, s1: 9.85, d0: 1.5, d1: 3.3, flare: 0.5 },
  planters: [{ d0: 2.1, d1: 2.7, s0: 2.5, s1: 3.7 }, { d0: 2.1, d1: 2.7, s0: 16.4, s1: 17.6 }],
  bikes: { d0: 1.9, d1: 2.9, s0: 12.5, s1: 15.5 },
  rideshare: { s0: 6, s1: 12 },
  blade: { s: 0.5, y0: 2.8, y1: 4.0 },
};
/** aisle 416 as we draw it (game coordinates): the mapped line round the tip to (-6616.2, -9323.6), then eased out
 *  and parallel to the front 6.0 m out, then straight to the courtyard junction */
export const AISLE416_TAIL: P2[] = [[-6613.4, -9324.8], [-6611.6, -9327.3], [-6610.7, -9330.5], [-6609.2, -9357.2], [-6613.2, -9374.9]];
export const ROUTES_END: P2 = [-6613.2, -9374.9];

export const ZONES: Zone[] = ([
  ['darts', 7.6, 12.6, 11.5, 15.8], ['pool', 8.9, 17.4, 4.3, 9.5], ['shuffleboard', 3.2, 9.9, 1.15, 1.75],
  ['bar', 14.0, 27.6, 13.3, 15.8], ['restrooms', 27.6, 31.0, 11.6, 15.8], ['kitchen', 31.0, 35.8, 9.0, 15.8],
  ['tv wall', 35.6, 35.8, 0.8, 9.0], ['standing floor', 31.5, 35.5, 0.8, 8.6], ['booths', 20.5, 31.3, 0.75, 2.35],
  ['high-tops', 19.5, 31.0, 3.0, 10.0], ['water station', 29.0, 29.6, 11.2, 11.6], ['host stand', 6.5, 7.1, 7.95, 8.45],
] as [string, number, number, number, number][]).map(([id, u0, u1, v0, v1]) => ({ id, room: 'inside' as const, u0, u1, v0, v1 }));

export const PATIO = { u0: 2.05, u1: 23.95, v0: -5.45, fenceT: 0.1, fenceH: 1.1, door: [18.0, 19.8] as [number, number] };
export const PATIO_TABLES = [4.2, 7.1, 10.0, 12.9, 15.8, 20.95];
export const HEATERS: P2[] = [[12.9, -3.95], [20.95, -3.95]];
export const PATIO_PLANTERS: [number, number, number, number][] = [[2.1, 2.9, -5.4, -4.4], [9.9, 11.7, -5.45, -4.95], [14.1, 15.9, -5.45, -4.95], [22.0, 23.9, -5.45, -4.95]];
export const PZONES: Zone[] = ([
  ['patio rail', 3.0, 9.5, -5.45, -5.15], ['patio door', 18.0, 19.8, -1.5, 0.0],
  ['heater 1', 12.6, 13.2, -4.25, -3.65], ['heater 2', 20.65, 21.25, -4.25, -3.65],
  ...PATIO_PLANTERS.map((p, i) => [`planter ${i + 1}`, ...p]),
  ...PATIO_TABLES.map((u, k) => [`patio table ${k + 1}`, u - 0.75, u + 0.75, -2.1, -0.5]),
] as [string, number, number, number, number][]).map(([id, u0, u1, v0, v1]) => ({ id, room: 'patio' as const, u0, u1, v0, v1 }));

export const POOL_TABLES: P2[] = [[11.0, 6.9], [15.3, 6.9]];
export const DART_BOARDS = [8.4, 10.1, 11.8];
export const HIGHTOPS: P2[] = [[21.0, 4.6], [24.6, 4.6], [28.2, 4.6], [21.0, 8.6], [24.6, 8.6], [28.2, 8.6]];
export const RAIL_V = [2.9, 3.95, 5.0, 6.05, 10.6, 11.65, 12.7, 13.75];
export const BAR = { u0: 14.0, u1: 26.8, edge: 13.3, top: 14.05, lane: 15.2, back: 15.8, backU1: 27.6, flap: [26.8, 27.6] as [number, number] };
export const BAR_SCREENS_U = [15.5, 18.7, 21.9, 25.1];
export const LANE_PATH: P2[] = [[14.6, 14.625], [27.2, 14.625], [27.2, 13.3], [27.2, 10.9]];
export const HANDOFF: P2 = [27.2, 10.9];
export const DOOR_START: P2 = [5.0, 8.2];
export const JUKEBOX: P2 = [32.0, 0.95];

const SEAT = 0.45, STAND = 0.3;
const S = (id: string, zone: string, group: string | undefined, seat: SlotDef['seat'], at: P2, face: P2, y: number, stand: P2): SlotDef => ({ id, zone, group, kind: 'seat', seat, at, face, y, stand, r: SEAT });
const P = (id: string, zone: string, at: P2, face: P2, kind: 'stand' | 'staff' = 'stand'): SlotDef => ({ id, zone, kind, at, face, y: 0, stand: at, r: STAND });
const norm = (x: number, y: number): P2 => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
// seat heights above the ground: Lot 57's (stools 0.78, benches 0.47) plus the 0.15 m slab or patio
const STOOL_Y = 0.93, BENCH_Y = 0.62;

/** every slot: the 91 seats, the 41 standing spots, and the staff and service spots */
export function slots(): SlotDef[] {
  const out: SlotDef[] = [];
  for (let k = 0; k < 9; k++) { const u = 14.6 + 1.05 * k; out.push(S(`bar stool ${k + 1}`, 'bar', undefined, 'stool', [u, 12.85], [0, 1], STOOL_Y, [u, 12.25])); }
  [13.75, 23.8, 24.45, 25.1].forEach((u, k) => out.push(P(`bar gap ${k + 1}`, 'bar', [u, 12.95], [0, 1])));
  out.push(P('server pick-up', 'bar', [26.15, 12.95], [0, 1], 'staff'));
  for (const v of RAIL_V) out.push(S(`rail stool v ${v}`, '', undefined, 'stool', [frontU(v, 0.6), v], FN, STOOL_Y, [frontU(v, 1.2), v]));
  HIGHTOPS.forEach(([cu, cv], t) => {
    for (const [du, dv] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]] as P2[]) {
      out.push(S(`high-top ${t + 1} ${du > 0 ? 'w' : du < 0 ? 'e' : dv > 0 ? 'n' : 's'}`, 'high-tops', `ht${t}`, 'hightop', [cu + du, cv + dv], norm(-du, -dv), STOOL_Y, [cu + (1.3 * du) / 0.7, cv + (1.3 * dv) / 0.7]));
    }
  });
  for (let b = 0; b < 5; b++) {
    const u0 = 20.5 + 2.15 * b;
    for (const [side, su, f] of [['east', u0 + 0.35, 1], ['west', u0 + 1.8, -1]] as [string, number, number][]) {
      for (const sv of [1.15, 1.95]) out.push(S(`booth ${b + 1} ${side} ${sv}`, 'booths', 'booth run', 'bench', [su, sv], [f, 0], BENCH_Y, [su, 2.85]));
    }
  }
  out.push(P('shuffleboard thrower', 'shuffleboard', [2.7, 1.45], [1, 0]), P('shuffleboard side 1', 'shuffleboard', [5.0, 2.1], [0, -1]), P('shuffleboard side 2', 'shuffleboard', [7.0, 2.1], [0, -1]));
  out.push(P('water', 'water station', [29.3, 10.85], [0, 1]));
  out.push(P('pass server 1', 'kitchen', [30.6, 10.35], [1, 0], 'staff'), P('pass server 2', 'kitchen', [30.6, 11.0], [1, 0], 'staff'));
  out.push(P('host', 'host stand', [6.8, 7.6], FN, 'staff'));
  // the standing floor: 20 spots about 0.9 m apart, facing the big screen
  for (const u of [32.2, 33.1, 34.0, 34.9]) for (const v of [2.75, 3.65, 4.55, 5.45, 6.35]) out.push(P(`standing ${u} ${v}`, 'standing floor', [u, v], [1, 0]));
  // 8 pool watchers round the two tables, 6 darts watchers behind the oche
  for (const [u, v] of [[9.2, 4.6], [9.2, 6.9], [9.2, 9.2], [13.15, 4.6], [13.15, 9.2], [17.1, 4.6], [17.1, 6.9], [17.1, 9.2]] as P2[]) out.push(P(`pool watcher ${u} ${v}`, 'pool', [u, v], norm(13.15 - u, 6.9 - v)));
  for (const u of [7.95, 8.85, 9.75, 10.65, 11.55, 12.3]) out.push(P(`darts watcher ${u}`, 'darts', [u, 11.85], [0, 1]));
  // the patio
  for (let k = 0; k < 6; k++) { const u = 3.6 + 1.05 * k; out.push(S(`patio rail stool ${k + 1}`, 'patio rail', undefined, 'stool', [u, -4.75], [0, -1], STOOL_Y, [u, -3.95])); }
  PATIO_TABLES.forEach((u, k) => {
    for (const [su, au, f] of [[u - 0.6, u - 1.3, 1], [u + 0.6, u + 1.3, -1]] as [number, number, number][]) {
      for (const sv of [-0.9, -1.7]) out.push(S(`patio table ${k + 1} ${f > 0 ? 'east' : 'west'} ${sv}`, `patio table ${k + 1}`, `pt${k}`, 'picnic', [su, sv], [f, 0], BENCH_Y, [au, sv]));
    }
  });
  return out;
}

/** furniture colliders in frame metres, each with the zone it belongs to ('' for none): boxes [u0, u1, v0, v1],
 *  circles [u, v, r] and polygons; the same sizes the zones script models */
export type FCol = { zone: string; tag: string; tall?: boolean } & ({ k: 'box'; b: [number, number, number, number] } | { k: 'circ'; c: [number, number, number] } | { k: 'poly'; p: P2[] });
export function furniture(): FCol[] {
  const out: FCol[] = [];
  const bx = (zone: string, tag: string, u0: number, u1: number, v0: number, v1: number, tall = false) => out.push({ zone, tag, tall, k: 'box', b: [u0, u1, v0, v1] });
  const ci = (zone: string, tag: string, u: number, v: number, r: number, tall = false) => out.push({ zone, tag, tall, k: 'circ', c: [u, v, r] });
  bx('bar', 'counter', 14.0, 26.8, 13.3, 14.05); bx('bar', 'counter', 14.0, 14.15, 14.05, 15.2); bx('bar', 'shelf', 14.0, 27.6, 15.2, 15.8, true);
  bx('bar', 'gate', 26.8, 27.6, 13.25, 13.35);
  bx('restrooms', 'wall', 27.6, 31.0, 11.6, 15.8, true); bx('kitchen', 'wall', 31.0, 35.8, 9.0, 15.8, true);
  bx('water station', 'stand', 29.0, 29.6, 11.2, 11.6); bx('darts', 'board', 7.6, 12.6, 15.75, 16.3, true);
  bx('shuffleboard', 'table', 3.2, 9.9, 1.15, 1.75); bx('booths', 'bench', 20.5, 31.3, 0.75, 2.35); bx('host stand', 'stand', 6.5, 7.1, 7.95, 8.45);
  bx('tv wall', 'wall', 35.6, 35.8, 0.8, 9.0, true); bx('standing floor', 'jukebox', 31.65, 32.35, 0.7, 1.2);
  for (const [u, v] of POOL_TABLES) bx('pool', 'table', u - 0.625, u + 0.625, v - 1.12, v + 1.12);
  for (let k = 0; k < 9; k++) ci('bar', 'stool', 14.6 + 1.05 * k, 12.85, 0.2);
  for (const [cu, cv] of HIGHTOPS) { ci('high-tops', 'table', cu, cv, 0.35); for (const [du, dv] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) ci('high-tops', 'stool', cu + du, cv + dv, 0.2); }
  for (const v of RAIL_V) ci('', 'stool', frontU(v, 0.6), v, 0.2);
  for (const [v0, v1] of [[2.5, 6.3], [10.0, 15.0]]) out.push({ zone: '', tag: 'rail', k: 'poly', p: [[frontU(v0, 0), v0], [frontU(v1, 0), v1], [frontU(v1, 0.3), v1], [frontU(v0, 0.3), v0]] });
  bx('patio rail', 'rail', 3.0, 9.5, -5.45, -5.15);
  for (let k = 0; k < 6; k++) ci('patio rail', 'stool', 3.6 + 1.05 * k, -4.75, 0.2);
  PATIO_TABLES.forEach((u, k) => bx(`patio table ${k + 1}`, 'table', u - 0.75, u + 0.75, -2.1, -0.5));
  HEATERS.forEach(([u, v], k) => ci(`heater ${k + 1}`, 'heater', u, v, 0.3, true));
  PATIO_PLANTERS.forEach(([u0, u1, v0, v1], k) => bx(`planter ${k + 1}`, 'planter', u0, u1, v0, v1));
  return out;
}

/** the screens: the big one and four 50-inch beside it on the party wall, four 65-inch over the back bar, one above
 *  the darts, two on the patio wall (12) */
export const SCREENS: { id: string; at: P2; y: number; face: P2; w: number; h: number; channel: 'featured' | 1 | 2 | 3 }[] = [
  { id: 'big', at: [35.78, 4.75], y: 2.35, face: [-1, 0], w: 3.2, h: 1.8, channel: 'featured' },
  { id: 'tv-l-lo', at: [35.78, 2.45], y: 1.85, face: [-1, 0], w: 1.1, h: 0.62, channel: 1 },
  { id: 'tv-l-hi', at: [35.78, 2.45], y: 2.6, face: [-1, 0], w: 1.1, h: 0.62, channel: 2 },
  { id: 'tv-r-lo', at: [35.78, 7.05], y: 1.85, face: [-1, 0], w: 1.1, h: 0.62, channel: 3 },
  { id: 'tv-r-hi', at: [35.78, 7.05], y: 2.6, face: [-1, 0], w: 1.1, h: 0.62, channel: 1 },
  ...BAR_SCREENS_U.map((u, i) => ({ id: `bar-${i + 1}`, at: [u, 15.95] as P2, y: 2.75, face: [0, -1] as P2, w: 1.43, h: 0.81, channel: ((i % 3) + 1) as 1 | 2 | 3 })),
  { id: 'darts', at: [10.1, 16.12], y: 2.95, face: [0, -1], w: 1.1, h: 0.62, channel: 2 },
  { id: 'patio-1', at: [6.0, -0.02], y: 2.45, face: [0, -1], w: 1.1, h: 0.62, channel: 'featured' },
  { id: 'patio-2', at: [14.0, 0.12], y: 2.45, face: [0, -1], w: 1.1, h: 0.62, channel: 1 },
];

/** our 10 street trees (frame), as tools/anaheim/sportsbar_sets.py places them: 6 palms 10.1 m out from the front wall
 *  every 6 m from s -6 to s 24, and 4 shade trees south of the arm at v -19 every 6 m from u -2 to u 16 */
export const TREES: { kind: 'palm' | 'shade'; at: P2 }[] = [
  ...[-6, 0, 6, 12, 18, 24].map((s) => ({ kind: 'palm' as const, at: fd(10.1, s) })),
  ...[-2, 4, 10, 16].map((u) => ({ kind: 'shade' as const, at: [u, -19] as P2 })),
];
