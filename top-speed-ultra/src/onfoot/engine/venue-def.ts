// A venue as data (PROJECT_OC_SPORTS_BAR.md, "A venue is data"). Each venue exports one VenueDef from
// src/onfoot/venues/<id>/def.ts: mostly plain data, plus a dynamic import of its own slice and one predicate.
import type { Schedule } from './schedule';
import type { Stall } from './lot';
import type { Tree, SeatKind } from './venue-types';
import type { Emitter } from './geom';
import type { Quality } from './mats';

export type P2 = [number, number];
export type VisState = 'inside' | 'outside' | 'overhead';

export interface Budget {
  calls: number; tris: number;                    // the scene pass ("Phone performance budgets")
  frameCalls: number; frameTris: number;          // the whole frame: the pass plus shadow maps, GTAO's pass and post
  live: number; staff: number;                    // simulated people in the room (S3a), and how many may be staff
  drawn: Record<VisState, { lod0: number; lod1: number; atLod: number }>;
  cars: Record<VisState, { near: number; yours: 'detailed' | 'standin' }>;
  castPeople: number;                             // who casts into the sun's map in every state (S3a; your avatar in S1)
  fillerMinM: number;
}

/** a wall of a room, frame metres, outer face a to b; its thickness is measured inward */
export interface Wall { id: string; a: P2; b: P2; t: number; glazed: boolean; openings: { s0: number; s1: number; kind: 'door' | 'window'; y0: number; y1: number }[] }
export interface Room { id: string; outer: P2[]; inner: P2[]; floorY: number; ceilingM: number; roofM: number; walls: Wall[] }

/** a slot: a seat (Lot 57's Seat shape, in frame metres here) or a standing, staff or game spot */
export interface SlotDef {
  id: string; zone: string; group?: string;
  kind: 'seat' | 'stand' | 'staff';
  seat?: SeatKind;
  at: P2;                       // where the body is (frame)
  face: P2;                     // which way it faces (a frame direction)
  y: number;                    // seat height above the ground (seats), 0 for spots
  stand: P2;                    // where you stand to sit, or the spot itself (frame)
  r: number;                    // the check's circle: 0.45 m a seat, 0.3 m a spot (L12's RADIUS)
}
export interface Zone { id: string; room: 'inside' | 'patio'; u0: number; u1: number; v0: number; v1: number }
export interface Placement { type: string; id: string; at: P2; rot: number; opts?: Record<string, number | string | boolean> }
export interface ScreenPlacement { id: string; at: P2; y: number; face: P2; w: number; h: number; channel: 'featured' | 1 | 2 | 3 }
export interface StaffPlan { posts: { id: string; at: P2 }[]; maxDrawn: Record<Quality, number> }

export interface VenueDef {
  id: 'lot57' | 'sportsbar';
  name: string;
  template: 'taproom-yard' | 'sports-bar';
  slice: () => Promise<unknown>;
  frame: { origin: P2; u: P2; v: P2 };
  anchor: P2;
  groundM: number;
  site: { dropSegs?: number[]; dropBld?: number[]; replaceRing?: P2[]; keepHost?: { bld: number; unit: P2[] } };
  edge: P2[];
  schedule: Schedule;
  rooms: Room[];
  indoor: (u: number, v: number) => boolean;
  ceilingM?: number;
  zones: Zone[];
  slots: SlotDef[];
  objects: Placement[];
  screens?: ScreenPlacement[];
  lights: Emitter[];
  staff: StaffPlan;
  staffPath?: P2[];
  trees: Tree[];
  parking: { stalls: Stall[]; yours: number };
  lines: string[];
  sim: 'light' | 'full';
  palette: Record<string, string>;
  budgets: Record<Quality, Budget>;
}
