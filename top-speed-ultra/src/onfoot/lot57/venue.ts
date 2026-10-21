// Lot 57 built in code (PROJECT_OC_ON_FOOT.md, "The venue" and "Site plan"): the Shed (a brick-red tilt-up taproom
// with a five-tooth north-light sawtooth roof and four glass roll-up doors onto the yard; inside, a 16 m bar with 20
// stools, a tap wall of plain coloured handles, stainless tanks behind glass, high-tops, a chalkboard menu and the
// game's local leaderboard), the yard (12 communal tables, 8 light poles, about 300 bulbs on catenaries, 4 patio
// heaters), the lawn (three bag-toss lanes, a stacking-block table, lawn chairs), the food-truck bay (our Two Lane
// Tacos and Night Shift Noodles, picnic tables), the brick planter wall and gate on Orangewood, our sign, and the
// fences. Every size is our design; every name and mark is ours (fictional). Local metres (coords.ts).
import * as THREE from 'three';
import { Batch, Kit, rand } from './geom';
import { Collider, seg, box, boxMM, circ } from './collide';
import { PLAN } from './coords';
import { ATLAS } from './tex';
import type { Mats } from './mats';

export const HEX = {
  teal: 0x12333a, cream: 0xf3e6c4, red: 0xc8462f, patina: 0x4f7f6a, brick: 0x8e4a36,
  black: 0x1b1d1f, steel: 0x2b2e31, cedar: 0xb07a50, oak: 0xb88a5c, concrete: 0xbab4a8, interior: 0xe4ded2, soil: 0x4a3a2c,
};

export type SeatKind = 'bench' | 'stool' | 'hightop' | 'picnic' | 'lawn';
/** a place to sit: where the body sits (x, z, seat height y), which way it faces, and where you stand to sit down */
export interface Seat { id: number; x: number; z: number; y: number; face: number; kind: SeatKind; at: string; ax: number; az: number }
/** a place to do something (order at the bar or a truck window, play a lawn game) */
export interface Spot { kind: 'bar' | 'truck' | 'game'; x: number; z: number; face: number; label: string }

export interface Venue {
  colliders: Collider[];
  seats: Seat[];
  spots: Spot[];
  bulbs: THREE.Vector3[];
  wires: number[];                    // line segment pairs (x, y, z, x, y, z)
  heaters: THREE.Vector3[];
  /** colliders that hold when the venue is closed (gates and doors shut) */
  closedOnly: Collider[];
  /** colliders that hold only while open (the gate leaves swung open against the wall) */
  openOnly: Collider[];
  /** where a person stands in each catenary's light, for the high presets' few real lights */
  lightSpots: { x: number; y: number; z: number; i: number }[];
  /** the Shed's pendants (on whenever it's open), for the same few real lights indoors */
  insideLights: { x: number; y: number; z: number; i: number }[];
  trees: Tree[];
}
/** a tree to instance: olive-ish in planters, shade trees in the lot, palms along the streets */
export interface Tree { x: number; z: number; y: number; s: number; kind: 'olive' | 'shade' | 'palm' }

const faceTo = (dx: number, dz: number) => Math.atan2(dx, dz);

export function buildVenue(kit: Kit, m: Mats): Venue {
  const col: Collider[] = [], seats: Seat[] = [], spots: Spot[] = [], closedOnly: Collider[] = [], openOnly: Collider[] = [];
  const trees: Tree[] = [];
  const insideLights: { x: number; y: number; z: number; i: number }[] = [];
  const r = rand(5757);
  // ---------------------------------------------------------------- batches (one draw call per material family)
  const tilt = kit.get('shed-walls', m.tilt, { uv: 6.5, cast: true });
  const inner = kit.get('shed-inside', m.block, { uv: 3.2 });
  const roof = kit.get('shed-roof', m.roof, { uv: 6, cast: true });
  const floor = kit.get('shed-floor', m.shedFloor, { uv: 4.5, ao: false });
  const deck = kit.get('shed-deck', m.deck, { uv: 2, ao: false });
  const mural = kit.get('shed-mural', m.mural, { uv: 1, ao: false });
  const pavers = kit.get('yard-pavers', m.pavers, { uv: 4, ao: false });
  const concrete = kit.get('venue-concrete', m.concrete, { uv: 4 });
  const turf = kit.get('lawn-turf', m.turf, { uv: 5, ao: false });
  const wood = kit.get('venue-wood', m.wood, { uv: 1.6, cast: true });
  const steel = kit.get('venue-steel', m.steel, { cast: true });
  const paint = kit.get('venue-paint', m.paint, { cast: true });
  const stainless = kit.get('venue-stainless', m.stainless, { cast: true });
  const brick = kit.get('frontage-brick', m.brick, { uv: 2, cast: true });
  const plants = kit.get('venue-plants', m.plant, { cast: true });
  const canvas = kit.get('venue-canvas', m.canvas, { cast: true });
  const rubber = kit.get('venue-rubber', m.rubber);
  const glass = kit.get('venue-glass', m.glass, { glow: false, order: 2 });
  const glazing = kit.get('shed-glazing', m.glazing, { glow: false, cast: true });
  const skylight = kit.get('shed-skylight', m.skylight, { glow: false });
  const labels = kit.get('venue-labels', m.labels, { uv: 1 });
  const paintLabels = kit.get('venue-labels-paint', m.labelsAlpha, { uv: 1, order: 1 });
  const signFace = kit.get('sign-face', m.sign, { glow: false });
  const screen = kit.get('shed-screen', m.screen, { glow: false });
  const reader = kit.get('sign-reader', m.readerBoard, { glow: false });
  const windowGlow = kit.get('truck-windows', m.window, { glow: false });
  const flame = kit.get('heater-flames', m.flame, { glow: false });
  const shadows = kit.get('contact-shadows', m.blob, { glow: false, ao: false, order: 1 });
  // state: the gate leaves and the Shed's doors, open or shut (the page shows one set by the clock)
  const openSteel = kit.get('when-open-steel', m.steel, { cast: true });
  const shutSteel = kit.get('when-closed-steel', m.steel, { cast: true });
  const shutDoors = kit.get('when-closed-doors', m.doorGlass, { glow: false, order: 3 });
  const openDoors = kit.get('when-open-doors', m.doorGlass, { glow: false, order: 3 });

  /** a soft dark blob under a prop (the contact shadow a shadow map can't resolve; the only one on Low) */
  const blob = (cx: number, cz: number, sx: number, sz: number, rot = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot), hx = sx / 2, hz = sz / 2;
    const P = (x: number, z: number) => [cx + x * c + z * s, 0.03, cz - x * s + z * c];
    shadows.uvQuad(P(-hx, hz), P(hx, hz), P(hx, -hz), P(-hx, -hz), { u0: 0, v0: 0, u1: 1, v1: 1 });
  };

  // ---------------------------------------------------------------- the Shed
  shed(); yard(); lawn(); trucks(); frontage(); fences();
  const lights = stringLights();

  function wallRun(B: Batch, In: Batch | null, dir: 'x' | 'z', at: number, u0: number, u1: number, t: number, top: (u: number) => number,
    holes: { a: number; b: number; y0: number; y1: number }[], out: 1 | -1, hex: number, inHex: number, breaks: number[] = []) {
    // P(u, y, side): side +1 the outer face, -1 the inner
    const P = (u: number, y: number, side: number) => dir === 'x' ? [u, y, at + out * side * t / 2] : [at + out * side * t / 2, y, u];
    const us = [...new Set([u0, u1, ...breaks, ...holes.flatMap((h) => [h.a, h.b])])].filter((u) => u >= u0 && u <= u1).sort((a, b) => a - b);
    // a face of the strip [p, q] between heights y0(u) and y1(u), on one side, facing outward on that side
    const strip = (p: number, q: number, y0p: number, y0q: number, y1p: number, y1q: number, side: number) => {
      const Bt = side > 0 ? B : In; if (!Bt) return;
      const c = side > 0 ? hex : inHex;
      // seen from that side, does u run left to right? outer face of a dir-x wall with out = +1 faces +z: u = x runs right
      const ltr = (dir === 'x' ? out : -out) * side > 0;
      const a = P(p, y0p, side), b = P(q, y0q, side), cc = P(q, y1q, side), d = P(p, y1p, side);
      if (ltr) Bt.quad(a, b, cc, d, c); else Bt.quad(b, a, d, cc, c);
    };
    for (let k = 0; k + 1 < us.length; k++) {
      const p = us[k], q = us[k + 1], mid = (p + q) / 2, eps = 1e-4;
      const tp = top(p + eps), tq = top(q - eps);
      const h = holes.find((hh) => hh.a <= mid && mid <= hh.b);
      for (const side of [1, -1]) {
        if (!h) strip(p, q, 0, 0, tp, tq, side);
        else {
          if (h.y0 > 0) strip(p, q, 0, 0, h.y0, h.y0, side);
          if (h.y1 < Math.min(tp, tq)) strip(p, q, h.y1, h.y1, tp, tq, side);
        }
      }
      // coping along the top (the inner batch has no roof over it from below, so only the outer one)
      const tA = P(p, tp, 1), tB = P(q, tq, 1), tC = P(q, tq, -1), tD = P(p, tp, -1);
      B.quad(tA, tB, tC, tD, hex); B.quad(tA, tD, tC, tB, hex);
    }
    // reveals: jambs, sills and heads of every hole
    for (const h of holes) {
      for (const [u, y0, y1] of [[h.a, h.y0, h.y1], [h.b, h.y0, h.y1]]) {
        const o0 = P(u, y0, 1), i0 = P(u, y0, -1), i1 = P(u, y1, -1), o1 = P(u, y1, 1);
        B.quad(o0, i0, i1, o1, hex); B.quad(i0, o0, o1, i1, hex);
      }
      for (const y of [h.y0, h.y1]) {
        if (y <= 0) continue;
        const a = P(h.a, y, 1), b = P(h.b, y, 1), c = P(h.b, y, -1), d = P(h.a, y, -1);
        B.quad(a, b, c, d, hex); B.quad(a, d, c, b, hex);
      }
    }
    // colliders: the solid stretches between the door holes (a hole starting above 0.3 m is a window: solid)
    const solid: [number, number][] = [];
    let s0 = u0;
    for (const h of [...holes].filter((hh) => hh.y0 < 0.3).sort((a, b) => a.a - b.a)) { if (h.a > s0) solid.push([s0, h.a]); s0 = Math.max(s0, h.b); }
    if (u1 > s0) solid.push([s0, u1]);
    for (const [a, b] of solid) col.push(dir === 'x' ? seg(a, at, b, at, t, 'wall', true) : seg(at, a, at, b, t, 'wall', true));
  }

  function shed() {
    const S = PLAN.shed, EAVE = S.eave, PEAK = S.peak, N = 5, L = (S.z1 - S.z0) / N, T = 0.28;
    const teeth = Array.from({ length: N - 1 }, (_, k) => S.z0 + (k + 1) * L);
    const saw = (z: number) => { const k = Math.min(N - 1, Math.floor((z - S.z0) / L)), t = (z - S.z0 - k * L) / L; return PEAK - (PEAK - EAVE) * t; };
    const flat = () => EAVE;
    const body = HEX.brick, inHex = HEX.interior;
    // north: the entrance and two storefront windows onto the forecourt
    wallRun(tilt, inner, 'x', S.z0, S.x0, S.x1, T, flat, [
      { a: -46.2, b: -39.2, y0: 0.9, y1: 3.4 }, { a: -36.4, b: -33.6, y0: 0, y1: 2.8 }, { a: -30.6, b: -21.8, y0: 0.9, y1: 3.4 },
    ], -1, body, inHex);
    // east, onto the yard: four roll-up doors and the window onto the tank room
    const doors = [-38.2, -29.2, -20.2, -11.2];
    wallRun(tilt, inner, 'z', S.x1, S.z0, S.z1, T, saw, [
      ...doors.map((z) => ({ a: z - 2.1, b: z + 2.1, y0: 0, y1: 4.2 })), { a: -1.4, b: 6.6, y0: 1.0, y1: 5.4 },
    ], 1, body, inHex, teeth);
    // south: a service door
    wallRun(tilt, inner, 'x', S.z1, S.x0, S.x1, T, flat, [{ a: -24.6, b: -23.2, y0: 0, y1: 2.3 }], 1, body, inHex);
    // west: high windows over the bar
    wallRun(tilt, inner, 'z', S.x0, S.z0, S.z1, T, saw, [
      { a: -41.5, b: -36.5, y0: 4.9, y1: 6.3 }, { a: -15.5, b: -10.5, y0: 4.9, y1: 6.3 }, { a: -7.5, b: -2.5, y0: 4.9, y1: 6.3 },
    ], -1, body, inHex, teeth);
    // a darker painted base and a cream band under the eave on every face (thin skins just proud of the wall)
    const skin = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, hex: number) => paint.boxMM(x0, y0, z0, x1, y1, z1, hex);
    const o = T / 2 + 0.02;
    skin(S.x0 - o, S.z0 - o, S.x1 + o, S.z0 - o + 0.04, 6.55, 6.95, HEX.cream);
    skin(S.x0 - o, S.z1 + o - 0.04, S.x1 + o, S.z1 + o, 6.55, 6.95, HEX.cream);
    skin(S.x0 - o, S.z0 - o, S.x0 - o + 0.04, S.z1 + o, 6.55, 6.95, HEX.cream);
    skin(S.x1 + o - 0.04, S.z0 - o, S.x1 + o, S.z1 + o, 6.55, 6.95, HEX.cream);
    // downspouts
    for (const z of [S.z0 + 0.6, -18, S.z1 - 0.6]) steel.box(S.x0 - o - 0.08, 3.5, z, 0.12, 7, 0.12, HEX.steel);
    for (const x of [S.x0 + 0.8, S.x1 - 0.8]) steel.box(x, 3.5, S.z1 + o + 0.08, 0.12, 7, 0.12, HEX.steel);
    // the painted wall sign on the north face, over the entrance (ours: LOT 57, TAPROOM & YARD)
    paintLabels.panel(-31.5, 5.1, S.z0 - T / 2 - 0.03, 10.5, 3.28, 0, -1, ATLAS.wall);

    // roof: five north-light teeth; the slopes fall to the south, the glazing faces north
    const X0 = S.x0 - 0.2, X1 = S.x1 + 0.2, RT = 0.22;
    for (let k = 0; k < N; k++) {
      const za = S.z0 + k * L, zb = za + L;
      // top surface (normal up and to the south)
      roof.quad([X0, PEAK + RT, za], [X0, EAVE + RT, zb], [X1, EAVE + RT, zb], [X1, PEAK + RT, za], 0xc9c6be);
      // ceiling (the underside, seen from inside)
      deck.quad([X1, PEAK - 0.02, za], [X1, EAVE - 0.02, zb], [X0, EAVE - 0.02, zb], [X0, PEAK - 0.02, za], 0x45484c);
      // the fascia at each end of the slope
      roof.quad([X0, EAVE, zb], [X0, EAVE + RT, zb], [X0, PEAK + RT, za], [X0, PEAK, za], 0x8f8a82);
      roof.quad([X1, PEAK, za], [X1, PEAK + RT, za], [X1, EAVE + RT, zb], [X1, EAVE, zb], 0x8f8a82);
      // north glazing: from the slope below (or the north wall) up to the peak
      // outside: dark glass (warm at night, lit from within); inside: the north sky through it
      glazing.quad([X1, EAVE + (k ? RT : 0), za], [X0, EAVE + (k ? RT : 0), za], [X0, PEAK, za], [X1, PEAK, za], 0xffffff);
      skylight.quad([X0, EAVE + (k ? RT : 0), za + 0.02], [X1, EAVE + (k ? RT : 0), za + 0.02], [X1, PEAK, za + 0.02], [X0, PEAK, za + 0.02], 0xffffff);
      for (let x = X0 + 0.1; x <= X1; x += 1.8) steel.box(x, (EAVE + PEAK) / 2 + 0.05, za - 0.03, 0.08, PEAK - EAVE, 0.08, HEX.steel);
      steel.box((X0 + X1) / 2, PEAK + RT / 2, za, X1 - X0, RT, 0.12, HEX.steel);
      // open-web joists under each slope
      for (let j = 1; j < 4; j++) {
        const z = za + (L * j) / 4, y = PEAK - ((PEAK - EAVE) * j) / 4 - 0.25;
        steel.box((S.x0 + S.x1) / 2, y, z, S.x1 - S.x0 - 0.4, 0.06, 0.16, 0x3a3d40);
      }
    }
    // two rooftop units
    for (const [x, z] of [[-41, -28], [-27, -7]]) { paint.box(x, saw(z + 2) + RT + 0.7, z, 2.2, 1.4, 1.6, 0xa9a9a4); paint.box(x, saw(z + 2) + RT + 1.42, z, 1.0, 0.05, 1.0, 0x6d6e6c); }

    // floor: polished concrete (a grid, so the pendants' light pools read)
    floor.grid(S.x0 + T / 2, S.z0 + T / 2, S.x1 - T / 2, S.z1 - T / 2, 0.02, 0xa49d94, 1.3);

    // storefront glass and the doors
    for (const [a, b] of [[-46.2, -39.2], [-30.6, -21.8]]) {
      glass.quad([b, 0.9, S.z0], [a, 0.9, S.z0], [a, 3.4, S.z0], [b, 3.4, S.z0], 0xffffff);
      for (let x = a; x <= b + 0.01; x += (b - a) / 3) steel.box(x, 2.15, S.z0, 0.07, 2.5, T + 0.02, HEX.black);
    }
    // the entrance: two glass doors in black frames (open, or shut after hours)
    for (const side of [-1, 1]) {
      const hinge = -35 + side * 1.4;
      // shut: in the opening
      shutSteel.box(-35 + side * 0.7, 1.4, S.z0, 1.4, 2.8, 0.06, HEX.black, 0, (_nx, nz, ny) => (Math.abs(nz) > 0.5 && ny === 0 ? null : HEX.black));
      shutDoors.panel(-35 + side * 0.7, 1.4, S.z0 - 0.04, 1.3, 2.7, 0, -1, { u0: 0, v0: 0, u1: 0.5, v1: 1 });
      shutDoors.panel(-35 + side * 0.7, 1.4, S.z0 + 0.04, 1.3, 2.7, 0, 1, { u0: 0, v0: 0, u1: 0.5, v1: 1 });
      // open: swung out flat against the forecourt side of the wall
      openSteel.box(hinge + side * 0.7, 1.4, S.z0 - T / 2 - 0.1, 1.4, 2.8, 0.05, HEX.black);
    }
    closedOnly.push(seg(-36.4, S.z0, -33.6, S.z0, 0.2, 'door', true, true));
    // the roll-up doors: up in their hoods when open, down (glass) when shut
    for (const z of doors) {
      steel.box(S.x1 + T / 2 + 0.25, 4.55, z, 0.5, 0.6, 4.6, 0x3b3f42);         // the hood the door rolls into
      steel.box(S.x1 + T / 2 + 0.05, 2.1, z - 2.15, 0.1, 4.2, 0.1, 0x6c7074); steel.box(S.x1 + T / 2 + 0.05, 2.1, z + 2.15, 0.1, 4.2, 0.1, 0x6c7074);
      shutDoors.panel(S.x1 + 0.02, 2.1, z, 4.2, 4.2, 1, 0, { u0: 0, v0: 0, u1: 1, v1: 1 });
      shutDoors.panel(S.x1 - 0.02, 2.1, z, 4.2, 4.2, -1, 0, { u0: 0, v0: 0, u1: 1, v1: 1 });
      openDoors.panel(S.x1 + T / 2 + 0.52, 4.55, z, 4.2, 0.55, 1, 0, { u0: 0, v0: 0.85, u1: 1, v1: 1 });
      closedOnly.push(seg(S.x1, z - 2.1, S.x1, z + 2.1, 0.2, 'door', true, true));
    }
    // the tank-room window onto the yard
    glass.quad([S.x1, 1.0, 6.6], [S.x1, 1.0, -1.4], [S.x1, 5.4, -1.4], [S.x1, 5.4, 6.6], 0xffffff);
    for (let z = -1.4; z <= 6.61; z += 2) steel.box(S.x1, 3.2, z, T + 0.03, 4.4, 0.08, HEX.black);
    steel.box(S.x1, 3.2, 2.6, T + 0.03, 0.08, 8, HEX.black);
    // our mural on the yard wall between the last roll-up door and the tank-room window, with three barn lights over it
    mural.panel(S.x1 + T / 2 + 0.012, 3.4, -5.25, 7.2, 6.0, 1, 0, { u0: 0, v0: 0, u1: 1, v1: 1 });
    for (const z of [-7.6, -5.25, -2.9]) {
      steel.tube([S.x1 + T / 2, 6.75, z], [S.x1 + T / 2 + 0.55, 6.85, z], 0.02, 5, HEX.black);
      steel.tube([S.x1 + T / 2 + 0.55, 6.85, z], [S.x1 + T / 2 + 0.62, 6.62, z], 0.02, 5, HEX.black);
      paint.cyl(S.x1 + T / 2 + 0.62, 6.42, z, 0.24, 0.05, 0.22, 12, HEX.patina, false);
      windowGlow.cyl(S.x1 + T / 2 + 0.62, 6.41, z, 0.12, 0.12, 0.02, 8, 0xffffff);
      kit.light({ x: S.x1 + T / 2 + 0.9, y: 6.2, z, i: 7, ch: 0, reach: 9, down: 0.6 });
    }
    // the service door (staff only: always shut)
    paint.box(-23.9, 1.15, S.z1 + T / 2 + 0.02, 1.4, 2.3, 0.05, 0x5b5f5c);
    col.push(seg(-24.6, S.z1, -23.2, S.z1, T, 'door', true));

    // ------------------------------------------------ inside: the bar along the west wall
    const BZ0 = -33, BZ1 = -17;                          // 16 m
    const backX = S.x0 + T / 2;
    // back bar: cabinets, a counter, the tap wall, shelves
    wood.boxMM(backX, 0, BZ0, backX + 0.62, 0.92, BZ1, 0x6e4a32);
    stainless.boxMM(backX, 0.92, BZ0, backX + 0.64, 0.96, BZ1, 0xc9ccd0);
    stainless.boxMM(backX, 0.96, -28.6, backX + 0.08, 1.85, -21.4, 0xb9bcc0);       // the tap wall's backsplash
    stainless.boxMM(backX + 0.08, 1.38, -28.4, backX + 0.18, 1.48, -21.6, 0xd2d5d8); // the tap rail
    const tapColours = [HEX.red, HEX.cream, HEX.patina, 0xd99a3a, HEX.teal, 0x6b4a8a, 0xe2e2dc, 0x2d5d8a, HEX.brick, 0x8aa63a, 0xc8462f, 0xf0c27a];
    for (let i = 0; i < 24; i++) {
      const z = -28.2 + i * 0.28;
      stainless.box(backX + 0.24, 1.36, z, 0.12, 0.05, 0.05, 0xd8dadc);           // the faucet
      paint.box(backX + 0.24, 1.55, z, 0.045, 0.24, 0.045, tapColours[i % tapColours.length]); // plain coloured handle, no marks
    }
    for (const y of [2.15, 2.75]) wood.boxMM(backX, y, BZ0 + 0.5, backX + 0.32, y + 0.05, -28.9, 0x5a3b26);
    for (const y of [2.15, 2.75]) wood.boxMM(backX, y, -21.1, backX + 0.32, y + 0.05, BZ1 - 0.5, 0x5a3b26);
    // bottles and glassware on the shelves (plain shapes, no labels)
    for (const [z0, z1] of [[BZ0 + 0.7, -29.1], [-20.9, BZ1 - 0.7]]) for (const y of [2.2, 2.8]) for (let z = z0; z < z1; z += 0.16) {
      const h = 0.22 + r() * 0.12;
      glass.box(backX + 0.16, y + h / 2, z, 0.08, h, 0.08, 0xffffff);
      paint.cyl(backX + 0.16, y, z, 0.035, 0.035, h * 0.8, 6, [0x3d5a2a, 0x6a3a1a, 0x2a2a2a, 0x8a6a2a][Math.floor(r() * 4)], false);
    }
    // the chalkboard menu over the taps (ours) and the leaderboard screen on the north wall
    labels.panel(backX + 0.02, 3.35, -25, 4.8, 3.0, 1, 0, ATLAS.chalk);
    wood.boxMM(backX, 1.8, -27.5, backX + 0.05, 1.86, -22.5, 0x3a2616);
    steel.box(-27.2, 3.6, S.z0 + T / 2 + 0.04, 2.7, 1.6, 0.06, 0x101214);
    screen.panel(-27.2, 3.6, S.z0 + T / 2 + 0.08, 2.56, 1.44, 0, 1, ATLAS.board);
    // the counter: a wood top on a corrugated-steel front
    const cx0 = backX + 1.75, cx1 = cx0 + 0.72;
    wood.boxMM(cx0 - 0.05, 1.02, BZ0 - 0.05, cx1 + 0.08, 1.08, BZ1 + 0.05, 0x8a5c38);
    paint.boxMM(cx0, 0, BZ0, cx1, 1.02, BZ1, 0x4a5a56);
    for (let z = BZ0 + 0.06; z < BZ1; z += 0.12) paint.box(cx1 + 0.012, 0.51, z, 0.02, 0.96, 0.05, 0x56685f);
    steel.boxMM(cx1 + 0.08, 0.22, BZ0, cx1 + 0.12, 0.26, BZ1, 0xb9bcc0);                 // foot rail
    rubber.boxMM(cx0, 0.95, BZ0 + 0.3, cx0 + 0.3, 1.02, BZ1 - 0.3, 0x1a1a1a);            // the bartender's mats
    col.push(boxMM(S.x0, BZ0 - 0.1, cx1 + 0.14, BZ1 + 0.1, 'bar', false));
    col.push(boxMM(cx0 - 0.2, BZ1, cx1 + 0.14, -14.5, 'bar', false));                    // the bar's hinged flap end (staff only)
    paint.boxMM(cx0, 0, BZ1, cx1, 1.02, -14.5, 0x4a5a56); wood.boxMM(cx0 - 0.05, 1.02, BZ1, cx1 + 0.08, 1.08, -14.5, 0x8a5c38);
    spots.push({ kind: 'bar', x: cx1 + 0.75, z: -25, face: faceTo(-1, 0), label: 'the bar' });
    // 20 stools along the counter
    for (let i = 0; i < 20; i++) {
      const z = BZ0 + 0.4 + i * (BZ1 - BZ0 - 0.8) / 19, x = cx1 + 0.55;
      stool(x, z, 0.76, 0.19);
      seats.push({ id: seats.length, x, z, y: 0.78, face: faceTo(-1, 0), kind: 'stool', at: 'bar', ax: x + 0.55, az: z });
    }
    // pendant lamps over the bar and the high-tops
    const pendant = (x: number, z: number, y: number) => {
      steel.tube([x, 7.0, z], [x, y + 0.25, z], 0.008, 4, 0x111111);
      paint.cyl(x, y, z, 0.24, 0.07, 0.25, 10, HEX.patina, false);
      windowGlow.cyl(x, y - 0.02, z, 0.12, 0.12, 0.04, 8, 0xffffff);
      kit.light({ x, y: y - 0.1, z, i: 9, ch: 2, reach: 12, down: 1.2 });
      insideLights.push({ x, y: y - 0.15, z, i: 5 });
    };
    for (let z = BZ0 + 1.5; z < BZ1; z += 2.6) pendant(cx1 - 0.2, z, 3.1);
    // high-tops: six round tables with four stools
    for (const [x, z] of [[-39.5, -39], [-32, -39], [-39.5, -10.5], [-32, -10.5], [-27, -30], [-27, -20]]) {
      steel.cyl(x, 0, z, 0.26, 0.26, 0.03, 12, 0x222222); steel.cyl(x, 0, z, 0.04, 0.04, 1.04, 6, 0x222222);
      wood.cyl(x, 1.04, z, 0.42, 0.42, 0.05, 16, 0x8a5c38);
      col.push(circ(x, z, 0.45, 'table'));
      blob(x, z, 1.4, 1.4);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.4, sx = x + Math.sin(a) * 0.68, sz = z + Math.cos(a) * 0.68;
        stool(sx, sz, 0.76, 0.18);
        seats.push({ id: seats.length, x: sx, z: sz, y: 0.78, face: faceTo(x - sx, z - sz), kind: 'hightop', at: 'hightop', ax: x + Math.sin(a) * 1.2, az: z + Math.cos(a) * 1.2 });
      }
      pendant(x, z, 3.6);
    }
    // general light from the ceiling: big enamel pendants in two rows down the room
    const bigPendant = (x: number, z: number) => {
      steel.tube([x, 7.1, z], [x, 4.75, z], 0.01, 4, 0x111111);
      paint.cyl(x, 4.35, z, 0.46, 0.09, 0.4, 14, HEX.teal, false);
      paint.cyl(x, 4.33, z, 0.47, 0.47, 0.03, 14, HEX.cream, false);
      windowGlow.cyl(x, 4.33, z, 0.2, 0.2, 0.04, 10, 0xffffff);
      kit.light({ x, y: 4.2, z, i: 26, ch: 2, reach: 16, down: 0.9 });
      insideLights.push({ x, y: 4.1, z, i: 9 });
    };
    for (const z of [-36, -27, -18, -9]) for (const x of [-37.5, -29]) bigPendant(x, z);
    for (const z of [-38, -27, -16, -6]) for (const x of [-42, -30]) kit.light({ x, y: 6.4, z, i: 10, ch: 2, reach: 16, down: 0.8 });
    // standing tables made from old barrels down the middle of the room, and a drink rail along the tank glass
    for (const [x, z] of [[-37.5, -31.5], [-33.2, -24.5], [-37.5, -17.5], [-24.5, -34], [-24.5, -15]]) {
      wood.cyl(x, 0, z, 0.3, 0.33, 0.5, 14, 0x7a5232, false); wood.cyl(x, 0.5, z, 0.33, 0.3, 0.5, 14, 0x7a5232, false);
      for (const y of [0.12, 0.42, 0.58, 0.88]) steel.cyl(x, y, z, 0.335, 0.335, 0.045, 14, 0x2a2b2c, false);
      wood.cyl(x, 1.0, z, 0.46, 0.46, 0.05, 16, 0x8a5c38);
      col.push(circ(x, z, 0.47, 'table'));
      blob(x, z, 1.2, 1.2);
    }
    wood.boxMM(S.x0 + 0.8, 1.04, -3.05, S.x1 - 0.8, 1.09, -2.7, 0x8a5c38);
    for (let x = S.x0 + 1.2; x < S.x1 - 0.8; x += 2.6) steel.box(x, 0.52, -2.75, 0.05, 1.04, 0.05, HEX.black);
    col.push(boxMM(S.x0 + 0.8, -3.1, S.x1 - 0.8, -2.6, 'rail', false));
    // a merch shelf by the entrance (plain goods, our name only)
    wood.boxMM(-38.9, 0, S.z0 + 0.3, -36.9, 1.8, S.z0 + 0.75, 0x5a3b26);
    for (const y of [0.6, 1.2]) for (let x = -38.7; x < -37.1; x += 0.28) paint.box(x + 0.1, y + 0.13, S.z0 + 0.52, 0.22, 0.24, 0.3, [HEX.teal, HEX.cream, HEX.red, HEX.patina][Math.floor(r() * 4)]);
    col.push(boxMM(-39.0, S.z0, -36.8, S.z0 + 0.8, 'shelf', false));
    // the tank room behind glass at the south end: six fermenters
    glass.quad([S.x0 + T / 2, 0, -2.6], [S.x1 - T / 2, 0, -2.6], [S.x1 - T / 2, 3.9, -2.6], [S.x0 + T / 2, 3.9, -2.6], 0xffffff);
    for (let x = S.x0 + T / 2; x <= S.x1 - T / 2 + 0.01; x += (S.x1 - S.x0 - T) / 10) steel.box(x, 1.95, -2.6, 0.07, 3.9, 0.07, HEX.black);
    steel.box((S.x0 + S.x1) / 2, 3.92, -2.6, S.x1 - S.x0 - T, 0.07, 0.07, HEX.black);
    col.push(seg(S.x0, -2.6, S.x1, -2.6, 0.12, 'glass', true));
    for (const [x, z] of [[-44.5, 0.6], [-40, 0.6], [-35.5, 0.6], [-44.5, 5.0], [-40, 5.0], [-35.5, 5.0]]) tank(x, z);
    for (const [x, z] of [[-30, 2.2], [-25.5, 2.2]]) { tank(x, z, 1.25, 3.0); }
    for (const x of [-42, -33, -27]) kit.light({ x, y: 6.0, z: 2.5, i: 14, ch: 2, reach: 14, down: 0.6 });
    // inside light through the roll-up doors onto the yard (a broad, soft spill)
    for (const z of doors) kit.light({ x: S.x1 - 1.5, y: 3.2, z, i: 26, ch: 2, reach: 18 });
  }

  function stool(x: number, z: number, h: number, rr: number) {
    steel.cyl(x, 0, z, 0.2, 0.17, 0.03, 8, 0x1c1c1c);
    steel.cyl(x, 0.03, z, 0.03, 0.03, h - 0.05, 5, 0x1c1c1c);
    steel.tube([x - 0.15, 0.3, z], [x + 0.15, 0.3, z], 0.012, 4, 0x1c1c1c);
    wood.cyl(x, h - 0.04, z, rr, rr, 0.06, 10, 0x6a4a30);
    col.push(circ(x, z, 0.2, 'stool'));
  }

  function tank(x: number, z: number, R = 0.9, H = 3.6) {
    const y0 = 0.9;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; stainless.tube([x + Math.sin(a) * R * 0.8, 0, z + Math.cos(a) * R * 0.8], [x + Math.sin(a) * R * 0.85, y0 + 0.3, z + Math.cos(a) * R * 0.85], 0.05, 5, 0xc3c6ca); }
    stainless.cyl(x, y0 - 0.55, z, 0.12, R, 0.55, 18, 0xc9ccd0, false);       // the cone
    stainless.cyl(x, y0, z, R, R, H, 18, 0xd0d3d6, false);                      // the shell
    stainless.cyl(x, y0 + H, z, R, R * 0.35, 0.35, 18, 0xc9ccd0, true);        // the dome
    stainless.cyl(x, y0 + H + 0.35, z, 0.16, 0.16, 0.12, 8, 0xb6b9bd);
    paint.cyl(x, y0 + H * 0.3, z, R + 0.012, R + 0.012, 0.06, 18, 0x8a8d90, false); // jacket bands
    paint.cyl(x, y0 + H * 0.65, z, R + 0.012, R + 0.012, 0.06, 18, 0x8a8d90, false);
    stainless.box(x + R * 0.7, y0 + 0.4, z + R * 0.7, 0.3, 0.42, 0.06, 0xb0b3b7, Math.PI / 4);   // the manway
    col.push(circ(x, z, R + 0.05, 'tank', true));
  }

  // ---------------------------------------------------------------- the yard
  function yard() {
    const Y = PLAN.yard;
    pavers.grid(Y.x0, Y.z0, Y.x1, Y.z1, 0.025, 0xffffff, 1.2);
    // a concrete apron along the Shed's doors and a band at the frontage
    concrete.grid(Y.x0, Y.z0, Y.x0 + 2.6, Y.z1, 0.03, 0xc4beb2, 1.3);
    // 12 communal tables in three rows of four, 8 seats each (96)
    const cols = [-12, -3, 6, 15], rows = [-33, -19, -5];
    for (const cz of rows) for (const cx of cols) {
      const L = 3.2, half = L / 2;
      // the top: five planks; two steel trestles
      for (let k = 0; k < 5; k++) wood.box(cx - 0.36 + k * 0.18, 0.75, cz, 0.165, 0.045, L, k % 2 ? 0xb88a5c : 0xae8054);
      for (const s of [-1, 1]) {
        const zz = cz + s * (half - 0.35);
        steel.tube([cx - 0.85, 0.02, zz], [cx, 0.73, zz], 0.025, 5, HEX.black); steel.tube([cx + 0.85, 0.02, zz], [cx, 0.73, zz], 0.025, 5, HEX.black);
        steel.box(cx, 0.43, zz, 1.7, 0.05, 0.06, HEX.black);
      }
      for (const side of [-1, 1]) {
        const bx = cx + side * 0.74;
        for (let k = 0; k < 2; k++) wood.box(bx - 0.08 + k * 0.16, 0.45, cz, 0.145, 0.04, L - 0.2, 0xb88a5c);
        col.push(box(bx, cz, 0.36, L - 0.2, 0, 'bench'));
        for (let i = 0; i < 4; i++) {
          const z = cz - 1.125 + i * 0.75;
          seats.push({ id: seats.length, x: bx, z, y: 0.47, face: faceTo(-side, 0), kind: 'bench', at: `table ${rows.indexOf(cz) * 4 + cols.indexOf(cx) + 1}`, ax: bx + side * 0.6, az: z });
        }
      }
      col.push(box(cx, cz, 0.95, L, 0, 'table'));
      blob(cx, cz, 2.6, L + 0.6);
    }
    // four patio heaters (stainless mushrooms with a burner glow under the hood)
    for (const [x, z] of [[-7.5, -26], [10.5, -26], [-7.5, -12], [10.5, -12]]) {
      stainless.cyl(x, 0, z, 0.24, 0.24, 0.08, 12, 0xb9bcc0);
      stainless.cyl(x, 0.08, z, 0.2, 0.2, 0.75, 12, 0xc9ccd0);                 // the tank housing
      stainless.cyl(x, 0.83, z, 0.05, 0.05, 1.35, 6, 0xc9ccd0);
      flame.cyl(x, 2.08, z, 0.14, 0.14, 0.22, 10, 0xffffff);                    // the burner screen
      stainless.cyl(x, 2.3, z, 0.12, 0.44, 0.12, 14, 0xd2d5d8, false);          // the reflector hood
      stainless.cyl(x, 2.42, z, 0.44, 0.06, 0.06, 14, 0xd2d5d8, true);
      col.push(circ(x, z, 0.3, 'heater'));
      kit.light({ x, y: 2.0, z, i: 4, ch: 0, reach: 6 });
      blob(x, z, 0.9, 0.9);
    }
    // corten planters with olive-ish trees along the yard's north edge and by the Shed
    for (const [x, z] of [[-16.5, -42.2], [-8, -42.2], [8, -42.2], [17.5, -42.2], [-16.5, 6.3], [18, 6.3]]) planter(x, z, 1.3, 0.75, true);
    // trash and recycling by the trucks
    for (const [x, z, c] of [[20.5, -12.5, 0x2c2e30], [20.5, -11.6, 0x2a4a6a]] as [number, number, number][]) { paint.box(x, 0.5, z, 0.6, 1.0, 0.6, c); col.push(box(x, z, 0.62, 0.62, 0, 'bin')); }
  }

  /** a corten-steel planter with soil, a small tree (or grasses) */
  function planter(x: number, z: number, s: number, h: number, tree: boolean) {
    paint.box(x, h / 2, z, s, h, s, 0x7a4426);
    rubber.box(x, h - 0.04, z, s - 0.1, 0.04, s - 0.1, HEX.soil);
    if (tree) {
      trees.push({ x, z, y: h, s: 0.42 + r() * 0.08, kind: 'olive' });
      grasses(x, z, s * 0.35, h, 4);
    } else grasses(x, z, s * 0.4, h, 9);
    col.push(box(x, z, s, s, 0, 'planter'));
    blob(x, z, s + 0.5, s + 0.5);
  }
  /** clumps of ornamental grass and agave rosettes (thin crossed blades) */
  function grasses(x: number, z: number, rad: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      const agave = r() < 0.35, hgt = agave ? 0.45 : 0.55 + r() * 0.35;
      const tint = agave ? [0x7f9a8a, 0x6f8c7c][i % 2] : [0x9a9a5a, 0x8a8f52, 0xa9a066][i % 3];
      for (let k = 0; k < (agave ? 7 : 5); k++) {
        const b = k * (Math.PI * 2 / (agave ? 7 : 5)) + r(), lean = agave ? 0.35 : 0.15, w = agave ? 0.07 : 0.05;
        const tx = px + Math.sin(b) * hgt * lean, tz = pz + Math.cos(b) * hgt * lean;
        plants.tri([px - Math.cos(b) * w, y, pz + Math.sin(b) * w], [px + Math.cos(b) * w, y, pz - Math.sin(b) * w], [tx, y + hgt, tz], tint);
      }
    }
  }

  // ---------------------------------------------------------------- the lawn
  function lawn() {
    const L = PLAN.lawn;
    turf.grid(L.x0, L.z0, L.x1, L.z1, 0.03, 0xffffff, 1.25);
    // steel edging
    for (const [ax, az, bx, bz] of [[L.x0, L.z0, L.x1, L.z0], [L.x0, L.z1, L.x1, L.z1], [L.x0, L.z0, L.x0, L.z1]]) steel.boxMM(Math.min(ax, bx) - 0.02, 0, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, 0.06, Math.max(az, bz) + 0.02, 0x3a2a20);
    // three bag-toss lanes: boards 8.2 m apart, ours in teal and red (no marks)
    for (const [i, x] of [27.5, 34, 40.5].entries()) {
      for (const [z, f] of [[-40.6, 1], [-32.4, -1]] as [number, number][]) {
        const c = i % 2 ? HEX.red : HEX.teal;
        // a slanted board: front lip 0.1 m, back 0.3 m
        const z0 = z - f * 0.61, z1 = z + f * 0.61;
        paint.quad([x - 0.305, 0.1, z1], [x + 0.305, 0.1, z1], [x + 0.305, 0.3, z0], [x - 0.305, 0.3, z0], c);
        paint.quad([x + 0.305, 0.1, z1], [x - 0.305, 0.1, z1], [x - 0.305, 0.3, z0], [x + 0.305, 0.3, z0], c);
        paint.box(x, 0.15, z0, 0.61, 0.3, 0.04, c); paint.box(x, 0.05, z1, 0.61, 0.1, 0.04, c);
        paint.box(x - 0.3, 0.1, z, 0.03, 0.2, 1.2, c); paint.box(x + 0.3, 0.1, z, 0.03, 0.2, 1.2, c);
        // the hole and a cream stripe
        rubber.cyl(x, 0.27 - 0.05, z - f * 0.32, 0.076, 0.076, 0.035, 12, 0x101010);
        paint.quad([x - 0.305, 0.19, z + f * 0.2], [x + 0.305, 0.19, z + f * 0.2], [x + 0.305, 0.21, z + f * 0.08], [x - 0.305, 0.21, z + f * 0.08], HEX.cream);
        col.push(box(x, z, 0.65, 1.25, 0, 'game'));
        blob(x, z, 1.0, 1.6);
        // a few bags lying about
        for (let b = 0; b < 3; b++) canvas.box(x + (r() - 0.5) * 0.9, 0.04, z + f * (0.9 + r() * 0.8), 0.15, 0.06, 0.15, b % 2 ? HEX.red : HEX.cream, r() * 3);
      }
      spots.push({ kind: 'game', x, z: -36.5, face: 0, label: 'bag toss' });
    }
    // the stacking-block table
    const bx = 47.5, bz = -38.5;
    wood.box(bx, 0.35, bz, 1.0, 0.7, 1.0, 0x7a5638); col.push(box(bx, bz, 1.05, 1.05, 0, 'game'));
    for (let layer = 0; layer < 15; layer++) for (let k = 0; k < 3; k++) {
      if (layer > 9 && (layer * 3 + k) % 5 === 0) continue;                   // a few pulled out
      const o = (k - 1) * 0.105, y = 0.72 + layer * 0.064;
      if (layer % 2) wood.box(bx + o, y, bz, 0.1, 0.06, 0.31, 0xd9b98a); else wood.box(bx, y, bz + o, 0.31, 0.06, 0.1, 0xd9b98a);
    }
    spots.push({ kind: 'game', x: bx - 1.2, z: bz, face: faceTo(1, 0), label: 'stacking blocks' });
    // two clusters of lawn chairs (slatted, angled backs), facing each other round a low table
    for (const [cx, cz] of [[26, -21], [46, -22]]) {
      wood.box(cx, 0.22, cz, 0.7, 0.44, 0.7, 0x6a4a30); col.push(box(cx, cz, 0.75, 0.75, 0, 'table'));
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + 0.3, x = cx + Math.sin(a) * 1.25, z = cz + Math.cos(a) * 1.25, f = a + Math.PI;
        lawnChair(x, z, f, k % 2 ? HEX.patina : HEX.cream);
        seats.push({ id: seats.length, x, z, y: 0.38, face: f, kind: 'lawn', at: 'lawn', ax: x + Math.sin(a) * 0.9, az: z + Math.cos(a) * 0.9 });
      }
    }
  }
  function lawnChair(x: number, z: number, f: number, c: number) {
    const s = Math.sin(f), cc = Math.cos(f);
    const P = (lx: number, y: number, lz: number) => [x + lx * cc + lz * s, y, z - lx * s + lz * cc];
    // seat slats sloping back, a reclined back, arms
    for (let k = 0; k < 5; k++) { const lz = 0.25 - k * 0.12; paint.box(...(P(0, 0.38 - k * 0.025, lz) as [number, number, number]), 0.56, 0.03, 0.09, c, f); }
    for (let k = 0; k < 5; k++) { const lx = -0.24 + k * 0.12; const a = P(lx, 0.36, -0.3), b = P(lx, 1.0, -0.62); paint.tube(a, b, 0.04, 4, c); }
    for (const lx of [-0.34, 0.34]) { paint.box(...(P(lx, 0.62, 0.0) as [number, number, number]), 0.12, 0.03, 0.75, c, f); paint.tube(P(lx, 0, 0.3), P(lx, 0.62, 0.3), 0.025, 4, c); paint.tube(P(lx, 0, -0.35), P(lx, 0.62, -0.25), 0.025, 4, c); }
    col.push(box(x, z, 0.8, 0.95, f, 'chair'));
    blob(x, z, 1.0, 1.1, f);
  }

  // ---------------------------------------------------------------- the food-truck bay
  function trucks() {
    const B = PLAN.trucks;
    concrete.grid(B.x0, B.z0 - 2, B.x1, B.z1, 0.03, 0xc2bcb0, 1.4);
    truck(46.2, -10.3, ATLAS.truck1, ATLAS.menu1, HEX.red, 'Two Lane Tacos');
    truck(46.2, -3.0, ATLAS.truck2, ATLAS.menu2, HEX.teal, 'Night Shift Noodles');
    // the third slot (busy nights): painted lines and two cones
    for (const z of [0.9, 7.7]) concrete.box(46.2, 0.04, z, 3.0, 0.01, 0.1, 0xe8d36a);
    for (const [x, z] of [[44.6, 1.6], [44.6, 7.0]]) { paint.cyl(x, 0, z, 0.17, 0.03, 0.7, 10, 0xe2622a); paint.box(x, 0.015, z, 0.36, 0.03, 0.36, 0x222222); col.push(circ(x, z, 0.2, 'cone')); }
    // picnic tables with umbrellas (24 seats)
    for (const [x, z] of [[28.5, -9], [35.5, -9], [28.5, 2.5], [35.5, 2.5]]) {
      for (let k = 0; k < 4; k++) wood.box(x, 0.75, z - 0.27 + k * 0.18, 2.0, 0.045, 0.16, 0x9a6a44);
      for (const s of [-1, 1]) { wood.box(x, 0.45, z + s * 0.68, 2.0, 0.04, 0.3, 0x9a6a44); col.push(box(x, z + s * 0.68, 2.0, 0.34, 0, 'bench')); }
      for (const sx of [-0.75, 0.75]) { steel.tube([x + sx, 0, z - 0.75], [x + sx, 0.73, z + 0.1], 0.025, 4, HEX.black); steel.tube([x + sx, 0, z + 0.75], [x + sx, 0.73, z - 0.1], 0.025, 4, HEX.black); }
      col.push(box(x, z, 2.0, 0.85, 0, 'table'));
      blob(x, z, 2.6, 2.4);
      // the umbrella
      steel.cyl(x, 0, z, 0.025, 0.025, 2.45, 6, 0xd8d8d0);
      const rows = 8, R = 1.35, top = 2.55, rim = 2.2, uc = [HEX.cream, HEX.teal];
      for (let k = 0; k < rows; k++) {
        const a0 = (k / rows) * Math.PI * 2, a1 = ((k + 1) / rows) * Math.PI * 2;
        const p0 = [x + Math.sin(a0) * R, rim, z + Math.cos(a0) * R], p1 = [x + Math.sin(a1) * R, rim, z + Math.cos(a1) * R];
        canvas.tri([x, top, z], p1, p0, uc[k % 2]);
      }
      for (let i = 0; i < 3; i++) {
        const sx = x - 0.66 + i * 0.66;
        for (const s of [-1, 1]) seats.push({ id: seats.length, x: sx, z: z + s * 0.68, y: 0.47, face: faceTo(0, -s), kind: 'picnic', at: 'truck tables', ax: sx, az: z + s * 1.3 });
      }
    }
  }
  function truck(x: number, z: number, livery: { u0: number; v0: number; u1: number; v1: number }, menu: { u0: number; v0: number; u1: number; v1: number }, body: number, label: string) {
    const W = 2.4, L = 6.5, y0 = 0.62, H = 2.75, hx = W / 2, hz = L / 2, cab = 1.7;
    // the box (window side faces west, toward the yard), the cab at the north end
    paint.boxMM(x - hx, y0, z - hz + cab, x + hx, y0 + H, z + hz, body, (nx) => (nx < -0.5 ? null : body));
    // the west side, built round the serving window (2.8 m x 1.15 m)
    const wz0 = z - hz + cab + 0.6, wz1 = wz0 + 2.8, wy0 = y0 + 0.95, wy1 = wy0 + 1.15, X = x - hx;
    const side = (za: number, zb: number, ya: number, yb: number) => paint.quad([X, ya, za], [X, ya, zb], [X, yb, zb], [X, yb, za], body);
    side(z - hz + cab, wz0, y0, y0 + H); side(wz1, z + hz, y0, y0 + H); side(wz0, wz1, y0, wy0); side(wz0, wz1, wy1, y0 + H);
    // inside the window: a lit kitchen (stainless back, a warm glow), the counter shelf, the awning
    windowGlow.quad([X + 0.9, wy0, wz0], [X + 0.9, wy0, wz1], [X + 0.9, wy1, wz1], [X + 0.9, wy1, wz0], 0xffffff);
    stainless.boxMM(X + 0.05, wy0, wz0, X + 0.9, wy0 + 0.02, wz1, 0xd0d3d6);
    for (const zz of [wz0, wz1]) stainless.boxMM(X, wy0, zz - 0.02, X + 0.9, wy1, zz + 0.02, 0xb9bcc0);
    stainless.boxMM(X - 0.35, wy0 - 0.04, wz0, X, wy0, wz1, 0xd0d3d6);
    paint.quad([X, wy1 + 0.08, wz1], [X, wy1 + 0.08, wz0], [X - 1.0, wy1 + 0.45, wz0], [X - 1.0, wy1 + 0.45, wz1], body);
    paint.quad([X - 1.0, wy1 + 0.42, wz1], [X - 1.0, wy1 + 0.42, wz0], [X, wy1 + 0.05, wz0], [X, wy1 + 0.05, wz1], 0xd8d2c4);
    for (const zz of [wz0 + 0.1, wz1 - 0.1]) steel.tube([X, wy0 + 0.3, zz], [X - 0.95, wy1 + 0.42, zz], 0.015, 4, 0x888888);
    // our livery high on both long sides and the menu boards beside the window
    labels.panel(x + hx + 0.012, y0 + H / 2 + 0.1, z + 0.75, 4.5, 2.2, 1, 0, livery);
    // a roof-mounted board over the window, facing the yard
    const tz = (wz0 + wz1) / 2, ty = y0 + H + 0.92;
    labels.panel(X + 0.12, ty, tz, 3.2, 1.56, -1, 0, livery);
    paint.box(X + 0.17, ty, tz, 0.08, 1.62, 3.26, body);
    for (const zz of [tz - 1.2, tz + 1.2]) steel.box(X + 0.3, y0 + H + 0.1, zz, 0.06, 0.2, 0.06, HEX.black);
    labels.panel(X - 0.012, wy0 + 0.25, wz1 + 0.75, 0.95, 1.26, -1, 0, menu);
    // the cab: a rounded nose, the windscreen, mirrors
    paint.boxMM(x - hx, y0, z - hz + 0.45, x + hx, y0 + 1.25, z - hz + cab, body);
    paint.boxMM(x - hx + 0.05, y0 + 1.25, z - hz + 0.85, x + hx - 0.05, y0 + H - 0.1, z - hz + cab, 0xe9e5dc);
    glass.quad([x + hx - 0.12, y0 + 1.35, z - hz + 0.86], [x - hx + 0.12, y0 + 1.35, z - hz + 0.86], [x - hx + 0.12, y0 + H - 0.3, z - hz + 0.92], [x + hx - 0.12, y0 + H - 0.3, z - hz + 0.92], 0xffffff);
    paint.boxMM(x - hx + 0.05, y0 + 0.2, z - hz + 0.05, x + hx - 0.05, y0 + 0.9, z - hz + 0.45, 0x2a2a2a);
    for (const s of [-1, 1]) steel.box(x + s * (hx + 0.12), y0 + 1.7, z - hz + 1.0, 0.04, 0.3, 0.18, HEX.black);
    // wheels and the skirt
    for (const zz of [z - hz + 1.0, z + hz - 1.2]) for (const s of [-1, 1]) {
      rubber.cyl(x + s * (hx - 0.18), 0.45, zz, 0.45, 0.45, 0.01, 12, 0x111111);
      rubber.tube([x + s * (hx - 0.32), 0.45, zz], [x + s * (hx - 0.04), 0.45, zz], 0.45, 12, 0x141414);
    }
    paint.boxMM(x - hx, y0 - 0.05, z - hz + 0.45, x + hx, y0 + 0.02, z + hz, 0x222222);
    // the roof: an extractor hood and an AC unit
    stainless.box(x - 0.2, y0 + H + 0.25, wz0 + 1.2, 0.9, 0.5, 0.9, 0xc9ccd0);
    paint.box(x + 0.4, y0 + H + 0.2, z + hz - 1.2, 1.0, 0.4, 0.9, 0xd9d9d4);
    // a generator and a propane cage behind
    paint.box(x + hx + 1.5, 0.45, z + 1.6, 1.1, 0.9, 0.75, 0x3a5a3a); col.push(box(x + hx + 1.5, z + 1.6, 1.15, 0.8, 0, 'generator'));
    steel.box(x + hx + 1.5, 0.6, z - 1.4, 0.8, 1.2, 0.6, 0x9a9da0); col.push(box(x + hx + 1.5, z - 1.4, 0.85, 0.65, 0, 'cage'));
    // step and the serving counter's queue rail
    col.push(box(x, z, W + 0.1, L + 0.1, 0, 'truck', true));
    col.push(box(X - 0.2, (wz0 + wz1) / 2, 0.4, wz1 - wz0, 0, 'counter'));
    blob(x, z, W + 1.4, L + 1.4);
    spots.push({ kind: 'truck', x: X - 0.85, z: (wz0 + wz1) / 2, face: faceTo(1, 0), label });
    kit.light({ x: X - 0.6, y: wy1 + 0.2, z: (wz0 + wz1) / 2, i: 22, ch: 0, reach: 12 });
    kit.light({ x: X - 0.95, y: wy1 + 0.35, z: (wz0 + wz1) / 2, i: 10, ch: 0, reach: 6, down: 1.5 });
  }

  // ---------------------------------------------------------------- the frontage: planter wall, gate, sign
  function frontage() {
    const F = PLAN.frontage, Z = F.z, T = 0.7, H = 0.95, [g0, g1] = F.gate;
    // the forecourt in front of the Shed and the entry walk
    concrete.grid(F.x0, Z + T / 2, PLAN.shed.x1, PLAN.shed.z0, 0.03, 0xc8c2b6, 1.5);
    concrete.grid(PLAN.shed.x1, Z + T / 2, F.x1, PLAN.yard.z0, 0.03, 0xc8c2b6, 1.5);
    concrete.grid(g0, -53, g1, Z - T / 2, 0.04, 0xc8c2b6, 1.0);
    for (const [a, b] of [[F.x0, g0], [g1, F.x1]] as [number, number][]) {
      brick.boxMM(a, 0, Z - T / 2, b, H, Z + T / 2, 0xffffff);
      concrete.boxMM(a - 0.04, H, Z - T / 2 - 0.04, b + 0.04, H + 0.06, Z - T / 2 + 0.1, 0xd6d0c4);
      concrete.boxMM(a - 0.04, H, Z + T / 2 - 0.1, b + 0.04, H + 0.06, Z + T / 2 + 0.04, 0xd6d0c4);
      rubber.boxMM(a + 0.05, H - 0.05, Z - T / 2 + 0.1, b - 0.05, H + 0.02, Z + T / 2 - 0.1, HEX.soil);
      for (let x = a + 0.6; x < b - 0.4; x += 1.6) grasses(x, Z, 0.28, H, 3);
      col.push(seg(a, Z, b, Z, T, 'wall', false));
    }
    // the short wall closing the forecourt's west side
    brick.boxMM(F.x0 - T / 2, 0, Z, F.x0 + T / 2, H, PLAN.shed.z0, 0xffffff);
    col.push(seg(F.x0, Z, F.x0, PLAN.shed.z0, T, 'wall', false));
    // the gateway: two steel posts and a beam carrying our name
    for (const x of [g0 - 0.2, g1 + 0.2]) { steel.box(x, 2.3, Z, 0.3, 4.6, 0.3, HEX.black); col.push(circ(x, Z, 0.25, 'post', true)); }
    steel.box((g0 + g1) / 2, 4.45, Z, g1 - g0 + 0.7, 0.42, 0.28, HEX.black);
    signFace.panel((g0 + g1) / 2, 3.72, Z - 0.16, 4.2, 1.02, 0, -1, { u0: ATLAS.sign.u0, v0: ATLAS.sign.v0 + (ATLAS.sign.v1 - ATLAS.sign.v0) * 0.24, u1: ATLAS.sign.u1, v1: ATLAS.sign.v1 - (ATLAS.sign.v1 - ATLAS.sign.v0) * 0.03 });
    steel.box((g0 + g1) / 2, 3.72, Z, 4.3, 1.1, 0.24, HEX.teal);
    // the gate leaves: shut across the opening after hours, swung back against the wall when open
    const leaf = (B: Batch, hx: number, z: number, w: number, along: 'x' | 'z') => {
      for (const y of [0.15, 1.7]) along === 'x' ? B.box(hx + w / 2, y, z, w, 0.06, 0.06, HEX.black) : B.box(hx, y, z + w / 2, 0.06, 0.06, w, HEX.black);
      for (let k = 0; k <= Math.round(w / 0.16); k++) {
        const o = (k / Math.round(w / 0.16)) * w;
        along === 'x' ? B.box(hx + o, 0.92, z, 0.025, 1.6, 0.025, HEX.black) : B.box(hx, 0.92, z + o, 0.025, 1.6, 0.025, HEX.black);
      }
    };
    const w = (g1 - g0) / 2;
    leaf(shutSteel, g0, Z, w, 'x'); leaf(shutSteel, g0 + w, Z, w, 'x');
    leaf(openSteel, g0 + 0.05, Z + T / 2 + 0.06, w, 'z'); leaf(openSteel, g1 - 0.05, Z + T / 2 + 0.06, w, 'z');
    closedOnly.push(seg(g0, Z, g1, Z, 0.12, 'gate', true, true));
    openOnly.push(box(g0 + 0.1, Z + T / 2 + 0.06 + w / 2, 0.16, w, 0, 'gate', false, true), box(g1 - 0.1, Z + T / 2 + 0.06 + w / 2, 0.16, w, 0, 'gate', false, true));
    // a host stand inside the gate
    wood.box(g1 + 1.4, 0.55, Z + 1.6, 0.7, 1.1, 0.5, 0x5a3b26); col.push(box(g1 + 1.4, Z + 1.6, 0.75, 0.55, 0, 'stand'));
    // planters along the frontage strip (outside, toward the sidewalk)
    for (const x of [-30, -18, 14, 26, 38]) { rubber.box(x, 0.06, -50.3, 2.6, 0.12, 1.4, HEX.soil); grasses(x, -50.3, 0.9, 0.12, 8); }

    // ---- our sign: a 6.5 m steel pylon with a lit cabinet at the Orangewood and Dupont corner
    const sx = PLAN.sign.x, sz = PLAN.sign.z;
    concrete.box(sx, 0.3, sz, 1.8, 0.6, 0.9, 0xb9b3a7);
    steel.box(sx, 2.2, sz, 0.36, 3.2, 0.36, HEX.teal);
    // the cabinet, its faces east and west (to the traffic on Orangewood)
    paint.box(sx, 5.25, sz, 0.5, 2.5, 3.6, HEX.teal);
    signFace.panel(sx + 0.26, 5.25, sz, 3.4, 2.34, 1, 0, ATLAS.sign);
    signFace.panel(sx - 0.26, 5.25, sz, 3.4, 2.34, -1, 0, ATLAS.sign);
    paint.box(sx, 6.55, sz, 0.56, 0.1, 3.7, HEX.cream);
    // the reader board under it: hours, or "Closed · opens 11:00"
    paint.box(sx, 3.55, sz, 0.3, 0.82, 2.9, 0x0d1a1d);
    reader.panel(sx + 0.16, 3.55, sz, 2.8, 0.72, 1, 0, { u0: 0, v0: 0, u1: 1, v1: 1 });
    reader.panel(sx - 0.16, 3.55, sz, 2.8, 0.72, -1, 0, { u0: 0, v0: 0, u1: 1, v1: 1 });
    col.push(box(sx, sz, 1.8, 0.9, 0, 'sign', true));
    grasses(sx, sz, 1.4, 0.02, 10);
    kit.light({ x: sx + 1.2, y: 5.2, z: sz, i: 16, ch: 1, reach: 9 });
    kit.light({ x: sx - 1.2, y: 5.2, z: sz, i: 16, ch: 1, reach: 9 });
  }

  // ---------------------------------------------------------------- fences: cedar slats on black posts
  function fences() {
    const H = 1.85;
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, rot = Math.atan2(dz, dx);
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      for (let k = 0; k < 11; k++) wood.box(cx, 0.12 + k * 0.155 + 0.065, cz, len, 0.13, 0.03, k % 3 === 1 ? 0x9e6a44 : 0xa87650, -rot);
      steel.box(cx, H + 0.03, cz, len, 0.05, 0.07, HEX.black, -rot);
      for (let t = 0; t <= len + 0.01; t += Math.max(1, len / Math.ceil(len / 2.4))) steel.box(ax + dx * t, H / 2, az + dz * t, 0.08, H + 0.06, 0.08, HEX.black, -rot);
      col.push(seg(ax, az, bx, bz, 0.12, 'fence', false));
    };
    const SF = PLAN.southFence, [l0, l1] = SF.gate;
    run(PLAN.shed.x1, PLAN.shed.z1, PLAN.shed.x1, SF.z);
    run(SF.x0, SF.z, l0, SF.z); run(l1, SF.z, SF.x1, SF.z);
    // the east fence with a vehicle gate for the trucks (shut)
    const EX = PLAN.eastFence.x;
    run(EX, PLAN.frontage.z, EX, -12.5); run(EX, -3.5, EX, SF.z);
    for (let z = -12.4; z < -3.5; z += 0.16) steel.box(EX, 0.95, z, 0.03, 1.7, 0.03, HEX.black);
    for (const y of [0.15, 1.75]) steel.box(EX, y, -8, 0.06, 0.06, 9, HEX.black);
    col.push(seg(EX, -12.5, EX, -3.5, 0.12, 'gate', false));
    // the lot gate (open by day and night while open; shut after hours)
    for (const x of [l0, l1]) steel.box(x, 1.2, SF.z, 0.12, 2.4, 0.12, HEX.black);
    const w = (l1 - l0) / 2;
    for (const [hx, s] of [[l0, 1], [l1, -1]] as [number, number][]) {
      for (const y of [0.15, 1.7]) shutSteel.box(hx + s * w / 2, y, SF.z, w, 0.05, 0.05, HEX.black);
      for (let k = 1; k < 14; k++) shutSteel.box(hx + s * (k / 14) * w, 0.92, SF.z, 0.025, 1.55, 0.025, HEX.black);
      for (const y of [0.15, 1.7]) openSteel.box(hx, y, SF.z - s * 0 - w / 2 - 0.1, 0.05, 0.05, w, HEX.black);
      for (let k = 1; k < 14; k++) openSteel.box(hx, 0.92, SF.z - 0.1 - (k / 14) * w, 0.025, 1.55, 0.025, HEX.black);
      openOnly.push(box(hx, SF.z - 0.1 - w / 2, 0.14, w, 0, 'gate', false, true));
    }
    closedOnly.push(seg(l0, SF.z, l1, SF.z, 0.12, 'gate', true, true));
    // bougainvillea trained up the cedar (the yard side of the lot fence, the truck bay, the lawn's east fence)
    for (const [x, z, nx, nz, w] of [[-12, SF.z, 0, -1, 3.5], [6, SF.z, 0, -1, 4], [13, SF.z, 0, -1, 3], [30, SF.z, 0, -1, 4], [EX, -35, -1, 0, 4], [EX, -20, -1, 0, 4]] as [number, number, number, number, number][]) bougainvillea(x, z, nx, nz, w, 2.5);
    // a lot-gate arch sign facing the lot
    steel.box((l0 + l1) / 2, 2.65, SF.z, l1 - l0 + 0.2, 0.1, 0.1, HEX.black);
    signFace.panel((l0 + l1) / 2, 2.95, SF.z + 0.06, 2.4, 0.56, 0, 1, { u0: ATLAS.sign.u0, v0: ATLAS.sign.v0 + (ATLAS.sign.v1 - ATLAS.sign.v0) * 0.24, u1: ATLAS.sign.u1, v1: ATLAS.sign.v1 - (ATLAS.sign.v1 - ATLAS.sign.v0) * 0.03 });
    steel.box((l0 + l1) / 2, 2.95, SF.z, 2.5, 0.62, 0.1, HEX.teal);
    kit.light({ x: (l0 + l1) / 2, y: 2.6, z: SF.z + 0.8, i: 5, ch: 0, reach: 7 });
  }

  /** a bougainvillea on a fence: leafy clusters, magenta bracts mostly up top and on the outside; a soft collider */
  function bougainvillea(cx: number, cz: number, nx: number, nz: number, w: number, h: number) {
    const tx = -nz, tz = nx, greens = [0x2f5a24, 0x3b6a2b, 0x467733, 0x2a4f20], pinks = [0xc0186a, 0xd62f86, 0xa3125a, 0xe0559c, 0xb81c78];
    // single small leaves and bracts (triangles, not squares, so the mass reads soft rather than blocky)
    const shade = (hex: number, k: number) => { const c = new THREE.Color(hex).multiplyScalar(k); return c.getHex(); };
    // a dense dark core close to the fence first, so the shrub reads as a mass and not as confetti
    for (let i = 0; i < 260; i++) {
      const u = (r() - 0.5) * w * 0.85, hgt = h * Math.sqrt(r()) * (1 - 0.4 * Math.abs(u) / (w / 2)) * 0.92;
      const out = 0.04 + r() * 0.22 * Math.sin(Math.PI * Math.min(1, hgt / h) * 0.9 + 0.2);
      const x = cx + tx * u + nx * out, z = cz + tz * u + nz * out, y = 0.12 + hgt, sz = 0.16 + r() * 0.14, a = r() * Math.PI * 2;
      plants.tri([x - Math.cos(a) * sz, y - sz * 0.5, z - Math.sin(a) * sz], [x + Math.cos(a) * sz, y - sz * 0.4, z + Math.sin(a) * sz], [x + Math.sin(a) * sz * 0.3, y + sz * 0.9, z - Math.cos(a) * sz * 0.3], shade(0x1f3d19, 0.8 + r() * 0.35));
    }
    for (let i = 0; i < 1500; i++) {
      const u = (r() - 0.5) * w * (0.75 + 0.25 * r()), hgt = h * Math.sqrt(r()) * (1 - 0.35 * Math.abs(u) / (w / 2));
      const out = 0.06 + r() * 0.5 * Math.sin(Math.PI * Math.min(1, hgt / h) * 0.9 + 0.2);
      const x = cx + tx * u + nx * out, z = cz + tz * u + nz * out, y = 0.15 + hgt;
      const pink = r() < 0.12 + 0.55 * (hgt / h) * Math.min(1, out / 0.45);
      const c = shade(pink ? pinks[Math.floor(r() * pinks.length)] : greens[Math.floor(r() * greens.length)], 0.85 + r() * 0.3);
      const sz = (pink ? 0.045 : 0.06) + r() * 0.045, a = r() * Math.PI * 2, b = (r() - 0.5) * 2.2;
      const ux = Math.cos(a) * sz, uz = Math.sin(a) * sz, vy = Math.cos(b) * sz * 1.3, vx = Math.sin(b) * sz * Math.sin(a + 1.3), vz = Math.sin(b) * sz * Math.cos(a + 1.3);
      plants.tri([x - ux, y - vy * 0.4, z - uz], [x + ux, y - vy * 0.4, z + uz], [x + vx, y + vy, z + vz], c);
    }
    for (let k = 0; k < 4; k++) { const u = (k / 3 - 0.5) * w * 0.6; wood.tube([cx + tx * u + nx * 0.1, 0, cz + tz * u + nz * 0.1], [cx + tx * u * 1.3 + nx * 0.25, h * 0.7, cz + tz * u * 1.3 + nz * 0.25], 0.03, 5, 0x5a4030); }
    col.push(box(cx + nx * 0.35, cz + nz * 0.35, Math.abs(tx) * w + Math.abs(nx) * 0.7, Math.abs(tz) * w + Math.abs(nz) * 0.7, 0, 'plant'));
    blob(cx + nx * 0.3, cz + nz * 0.3, Math.abs(tx) * w + 0.8, Math.abs(tz) * w + 0.8);
  }

  // ---------------------------------------------------------------- string lights over the yard
  function stringLights() {
    const Y = PLAN.yard, H = 6.0, wx = Y.x0 + 1.2, ex = Y.x1 - 0.5;
    const zs = [-43, -27.5, -12, 7];
    // four more poles carry runs on over the lawn games and the truck tables (east of the yard)
    const extra: [number, number][] = [[51.2, -43.5], [51.2, -28], [41, -13.6], [41, 7.6]];
    const poles: [number, number][] = [...zs.map((z) => [wx, z] as [number, number]), ...zs.map((z) => [ex, z] as [number, number]), ...extra];
    for (const [x, z] of poles) {
      concrete.cyl(x, 0, z, 0.32, 0.3, 0.45, 12, 0xb9b3a7);
      steel.cyl(x, 0.45, z, 0.075, 0.06, H - 0.45, 8, HEX.black);
      steel.cyl(x, H, z, 0.1, 0.1, 0.06, 8, HEX.black);
      steel.tube([x, H - 0.1, z], [x + (x < 0 ? 0.35 : -0.35), H - 0.1, z], 0.02, 4, HEX.black);
      col.push(circ(x, z, 0.34, 'pole', true));
      blob(x, z, 0.9, 0.9);
    }
    const W: [number, number][] = zs.map((z) => [wx + 0.35, z]), E: [number, number][] = zs.map((z) => [ex - 0.35, z]);
    const spans: [[number, number], [number, number]][] = [];
    for (let i = 0; i < 4; i++) spans.push([W[i], E[i]]);
    for (let i = 0; i < 3; i++) { spans.push([W[i], E[i + 1]]); spans.push([E[i], W[i + 1]]); }
    const X: [number, number][] = extra.map(([x, z]) => [x - 0.35, z]);
    spans.push([E[0], X[0]], [E[1], X[1]], [E[0], X[1]], [E[2], X[2]], [E[3], X[3]], [E[2], X[3]]);
    const bulbs: THREE.Vector3[] = [], wires: number[] = [], lightSpots: { x: number; y: number; z: number; i: number }[] = [];
    for (const [a, b] of spans) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), sag = 0.025 * len + 0.25, n = Math.max(2, Math.round(len / 1.35));
      const ys = (t: number) => H - 0.12 - sag * 4 * t * (1 - t);
      let prev: number[] | null = null, acc: THREE.Vector3[] = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40, p = [a[0] + (b[0] - a[0]) * t, ys(t), a[1] + (b[1] - a[1]) * t];
        if (prev) wires.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
        prev = p;
      }
      for (let k = 1; k < n; k++) {
        const t = k / n, v = new THREE.Vector3(a[0] + (b[0] - a[0]) * t, ys(t) - 0.09, a[1] + (b[1] - a[1]) * t);
        bulbs.push(v); acc.push(v);
        if (acc.length === 5 || k === n - 1) {
          const c = acc.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(acc.length);
          kit.light({ x: c.x, y: c.y, z: c.z, i: 2.2 * acc.length, ch: 0, reach: 22 });
          acc = [];
        }
      }
      lightSpots.push({ x: (a[0] + b[0]) / 2, y: ys(0.5) - 0.2, z: (a[1] + b[1]) / 2, i: n });
    }
    return { bulbs, wires, lightSpots };
  }

  const heaters = [[-7.5, -26], [10.5, -26], [-7.5, -12], [10.5, -12]].map(([x, z]) => new THREE.Vector3(x, 2.1, z));
  return { colliders: col, seats, spots, bulbs: lights.bulbs, wires: lights.wires, heaters, closedOnly, openOnly, lightSpots: lights.lightSpots, insideLights, trees };
}
