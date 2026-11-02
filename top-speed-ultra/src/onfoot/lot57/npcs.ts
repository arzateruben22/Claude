// The people of Lot 57 (PROJECT_OC_ON_FOOT.md, "NPCs", "Groups that look like they're talking", "Walkers, arrivals
// and staff", "Simulated crowds", "Talk"). Forty people, every one built by the people builder (src/onfoot/people,
// used through its exports only) and every one fictional: nobody here is a real person or another player.
//
//   - Guests, in parties (lot57/npcs.ts ROSTER): standing groups in talking circles (at barrel tables, on the lawn, by
//     the trucks) and seated groups (at the communal tables, a picnic table, the bar, the lawn chairs). How many
//     parties are here follows the simulated crowd curve (lot57/clock.ts: the day and the hour, never anything live).
//     Parties arrive at random from the lot or the Orangewood sidewalk, walk in, stay a while (log-normal, median about
//     75 minutes) and walk out again. When the clock is set (a test, the clock menu), the crowd settles at once.
//   - Staff in our patina green: the bartender and a cook in each truck (P1b: they serve you), a second bartender
//     working the back bar, a host at the gate, a busser making rounds of the tables, and a lot attendant waving cars
//     in on busy nights.
//   - Walkers on the Orangewood sidewalks, one of them jogging, whether Lot 57 is open or not (they're outside).
//
// A group is a small state machine. Formation: a circle round a shared centre (standing), or the seats round a table.
// Turns: one speaker at a time, 1 to 10 s (median about 3.5 s), 0.2 to 0.8 s pauses; the next speaker is usually
// whoever the last one was looking at. The speaker talks (the builder's talk gestures and mouth; seated, a hand that
// beats the words), listeners look at the speaker most of the time (seated ones turn a little on the bench), glance
// away now and then and nod in the pauses. Laughter is a group event about 1.5 times a minute. Idles: the builder's
// breathing and weight shifts, and a sip of whatever they hold every 40 to 90 s. When you join a standing group, the
// circle re-spaces to open a gap where you stand and a short conversation runs (talk.ts).
//
// How they're drawn inside the phone and desktop budgets (bodies near, impostors far, nothing behind walls) is
// lot57/crowdview.ts.
import * as THREE from 'three';
import { buildPerson, Person, PersonOptions, randomPerson, LOD_RANGES } from '../people';
import { baseBody, baseLook, defaultFace, HAIR_COLORS } from '../people/params';
import type { Garment } from '../people';
import { Items, ItemId } from './items';
import { Exchange, OPENERS, FOLLOWUPS, WRAPS, LATER, HELLO, NAMES, pick, fill } from './talk';
import { rand, P2 } from './geom';
import type { Seat, SeatKind } from './venue';
import { PeopleView, Rep, Tier, ViewNpc } from './crowdview';

export type Role = 'regular' | 'bartender' | 'cook' | 'barback' | 'host' | 'busser' | 'attendant' | 'walker';
/** circle: standing in a group; seat: sitting with one; post: serving at a counter (P1b); crew: other staff; walker: the sidewalks */
export type Mode = 'circle' | 'seat' | 'post' | 'crew' | 'walker';
export type PeopleQuality = 'phone' | 'high';

export interface Npc extends ViewNpc {
  name: string; role: Role; mode: Mode;
  /** where they're going (a slot in the circle, a place along the bar) and which way they'll face there */
  tx: number; tz: number; th: number;
  hold: ItemId | null; held: THREE.Group | null;
  acc: number; acc0: number; lod: 0 | 1 | 2;
  speaking: boolean; look: THREE.Vector3 | null;
  /** their own look target (another member's eyes); `look` points at it, at your eyes, or nowhere */
  lv: THREE.Vector3;
  nodT: number; laughT: number; glanceT: number; anim: 'idle' | 'talk' | 'walk' | 'turn' | 'laugh' | 'sit';
  /** what the builder is playing (seated people keep 'sit' whatever they're doing) */
  playing: string;
  group: Group | null;
  /** the seat they sit in (seated groups), and how far they are through sitting down (0 standing .. 1 seated) */
  seat: Seat | null; sitK: number;
  /** a walk along a path (arriving, leaving, the sidewalks, the busser's rounds): waypoints, the next one, speed */
  route: P2[] | null; ri: number; spd: number; then: (() => void) | null;
  /** in their place (arrived) */
  placed: boolean;
  sipT: number; sipK: number; beat: number; waveT: number; wipeT: number; phase: number; greeted: boolean;
}
/** a party of guests: when they're here and how long they stay */
export interface Party { size: number; state: 'away' | 'in' | 'here' | 'out'; stay: number; from: 'lot' | 'street'; order: number; out: number }
export interface Group {
  id: number; label: string; cx: number; cz: number; r: number; table: boolean;
  members: Npc[];
  /** each member's angle round the centre now (radians, atan2(dx, dz)) and where they stand when you're not there */
  home: number[];
  speaker: number; turnT: number; pauseT: number; lookAt: number; lookT: number; laughT: number;
  /** your slot's angle when you're in the circle */
  you: number | null;
  talk: Talk | null;
  active: boolean;
  seed: number;
  /** a seated group (at a table, the bar, the lawn chairs): not joined like a circle */
  seated: boolean;
  /** everyone's in place (their own talk runs only then) */
  ready: boolean;
  party: Party;
}
/** the short conversation you're in (talk.ts) */
export interface Talk {
  stage: 'hello' | 'line' | 'reply' | 'you' | 'answer' | 'wrap' | 'done';
  t: number; n: number; ex: Exchange | null; by: Npc; choice: number; seed: number;
  /** what's on screen now (for the hooks) */
  caption: { who: string; text: string } | null;
  replies: [string, string] | null;
  log: { who: string; text: string }[];
}

const DEG = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** a line's reading time, for captions and the mouth */
const readS = (s: string) => clamp(1.0 + s.length * 0.055, 1.4, 5.5);
const BABBLE = ['so we took the long way round and the light was perfect', 'no, listen, that is not what happened', 'okay but the noodles though', 'I told her the left lane is for passing', 'he parked right under the tree again', 'honestly I would go back tomorrow', 'wait, which exit was it', 'we should do this every friday'];
/** how many guests the roster holds (the simulated crowd's share of the fictional 220 decides how many are here) */
export const GUESTS = 31;
const WALK = 1.25;

/**
 * The guests' parties (local metres, coords.ts). The first two are P1b's groups, unchanged (the same people, names and
 * places). `order` is when a party comes as the crowd grows: the first one alone on a quiet afternoon, everyone on a
 * packed Saturday night. Seated parties take the seats of `kind` nearest to (cx, cz).
 */
interface PartyDef { label: string; cx: number; cz: number; r: number; table: boolean; n: number; holds: (ItemId | null)[]; from: 'lot' | 'street'; order: number; sit?: SeatKind; at?: string }
const ROSTER: PartyDef[] = [
  { label: 'by the barrel table in the yard', cx: 1.5, cz: -26, r: 0.98, table: true, n: 3, holds: ['pint', 'fizz', 'pint'], from: 'lot', order: 0 },
  { label: 'on the lawn by the bag toss', cx: 36.5, cz: -25.5, r: 0.8, table: false, n: 3, holds: ['jamaica', 'pint', null], from: 'street', order: 3 },
  { label: 'at the barrel table by the lawn', cx: 19, cz: -19, r: 0.95, table: true, n: 4, holds: ['pint', null, 'horchata', 'pint'], from: 'lot', order: 5 },
  { label: 'at a barrel table in the Shed', cx: -33.2, cz: -24.5, r: 0.95, table: true, n: 3, holds: ['pint', 'pint', null], from: 'street', order: 7 },
  { label: 'by the third truck slot', cx: 40, cz: 4.5, r: 0.62, table: false, n: 2, holds: ['birria', 'fizz'], from: 'lot', order: 9 },
  { label: 'at table 6 in the yard', cx: -3, cz: -19, r: 1.2, table: true, n: 4, holds: ['pint', 'pint', null, 'fizz'], from: 'lot', order: 6, sit: 'bench', at: 'table 6' },
  { label: 'at table 11 in the yard', cx: 6, cz: -5, r: 1.2, table: true, n: 4, holds: ['garlic', 'birria', 'fizz', null], from: 'lot', order: 2, sit: 'bench', at: 'table 11' },
  { label: 'at a picnic table by the trucks', cx: 28.5, cz: 2.5, r: 1.0, table: true, n: 3, holds: ['birria', 'jamaica', null], from: 'street', order: 4, sit: 'picnic' },
  { label: 'at the bar', cx: -43.9, cz: -22.6, r: 0.5, table: true, n: 2, holds: ['pint', 'pint'], from: 'street', order: 1, sit: 'stool', at: 'bar' },
  { label: 'on the lawn chairs', cx: 46, cz: -22, r: 1.25, table: true, n: 3, holds: [null, 'pint', null], from: 'lot', order: 8, sit: 'lawn' },
];

const TOPS = new Set<Garment['kind']>(['dress', 'tee', 'fitted', 'tank', 'shirt', 'blouse', 'polo']);
const OUTER = new Set<Garment['kind']>(['jacket', 'leather', 'blazer', 'cardigan']);
/** colours a top swaps to when it would read as bare skin (ours, from the builder's night palette) */
const TOP_SWAP = [0x1d2a44, 0x2f4a3a, 0x3a2f4f, 0x0f3550, 0x7a1d24, 0x161616];
/** a tan, beige or brown in the range of skin tones (sRGB hue 12 to 50 degrees, some saturation, not near black or white) */
function skinLike(hex: number) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h >= 12 && h <= 50 && s >= 0.15 && s <= 0.8 && l >= 0.2 && l <= 0.85;
}
/**
 * The regulars' clothes at patio distance. The people builder's LOD 1 shells (what everyone here is drawn with on Low
 * and High) cut an open neckline (v, scoop, square) and a sleeveless armhole with a ragged edge that shows the skin in
 * patches, so a dress reads as torn; and a tan or beige top reads as bare skin under the warm string lights. Rendered
 * side by side at LOD 1, a crew neck with half sleeves came out clean on a slim and a heavy build. Until those shells
 * close up (a change for the people builder's own session), the regulars' tops and dresses take a crew neck (shirts
 * and polos keep their collars), sleeves to at least the mid upper arm, and a colour that isn't skin; nobody wears
 * heels on the lawn. The builder's own files are unchanged.
 */
export function patioOutfit(o: PersonOptions, lawn: boolean, seed: number): PersonOptions {
  const outfit = o.outfit.map((gm): Garment => {
    if (lawn && gm.kind === 'heels') return { ...gm, kind: 'flats' };
    const top = TOPS.has(gm.kind);
    if (!top && !OUTER.has(gm.kind)) return gm;
    const g: Garment = { ...gm };
    if (top) {
      if (g.kind === 'tank') g.kind = 'fitted';
      if (g.kind !== 'shirt' && g.kind !== 'polo') g.neck = 'crew';
      if ((g.sleeve ?? 0.25) < 0.3) g.sleeve = 0.5;
    }
    if (skinLike(g.color)) g.color = TOP_SWAP[seed % TOP_SWAP.length];
    return g;
  });
  return { ...o, outfit };
}
/** after dark, a few more people in a layer (clothes follow the clock): an open jacket or cardigan over the top */
const LAYERS: Garment[] = [
  { kind: 'jacket', color: 0x2a3a5c, fabric: 'denim', sleeve: 1, open: true },
  { kind: 'cardigan', color: 0x4a4a48, fabric: 'knit', sleeve: 1, open: true },
  { kind: 'leather', color: 0x161616, fabric: 'leather', sleeve: 1, open: true },
  { kind: 'jacket', color: 0x3a2a1e, fabric: 'cotton', sleeve: 1, open: true },
];
function forTheHour(o: PersonOptions, night: boolean, seed: number): PersonOptions {
  if (!night || o.outfit.some((g) => OUTER.has(g.kind) || g.kind === 'dress') || seed % 3 !== 0) return o;
  const shoes = o.outfit.findIndex((g) => ['heels', 'boots', 'sneakers', 'loafers', 'flats'].includes(g.kind));
  const outfit = [...o.outfit]; outfit.splice(shoes < 0 ? outfit.length : shoes, 0, { ...LAYERS[seed % LAYERS.length] });
  return { ...o, outfit };
}

/** a staff member's outfit: our patina-green top (the aprons are a garment the people builder doesn't make yet) */
function staffPerson(seed: number, f: boolean, top: Garment['kind']): PersonOptions {
  const r = rand(seed);
  const body = { ...baseBody(f ? 'f' : 'm'), age: 24 + Math.round(r() * 22), height: f ? 1.62 + r() * 0.08 : 1.72 + r() * 0.1, fat: 0.3 + r() * 0.25, muscle: 0.4 + r() * 0.2 };
  const look = { ...baseLook(), skin: [0xeac0a4, 0xc99472, 0x9c6545, 0x65402f][Math.floor(r() * 4)], hair: (f ? 'ponytail' : r() < 0.5 ? 'short' : 'buzz') as PersonOptions['look']['hair'], hairColor: [HAIR_COLORS.black, HAIR_COLORS.darkBrown, HAIR_COLORS.brown][Math.floor(r() * 3)] };
  const outfit: Garment[] = [
    { kind: top, color: 0x4f7f6a, fabric: 'cotton', sleeve: top === 'polo' ? 0.25 : 0.22, neck: top === 'polo' ? 'collar' : 'crew' },
    { kind: 'trousers', color: 0x22252a, fabric: 'cotton' },
    { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0xf2f2f0 },
  ];
  return { seed, name: 'staff', body, face: defaultFace(f ? 'f' : 'm'), look, outfit, acc: { hoops: null, studs: null, chain: null, watch: f ? null : 0x161616, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111 } };
}

export interface StaffPost {
  role: 'bartender' | 'cook'; counter: 'bar' | 'tacos' | 'noodles';
  /** where they stand (local metres), the floor height, which way they face to serve, the stretch they can move along (z) */
  x: number; y: number; z: number; face: number; z0: number; z1: number;
  /** where and which way they turn to make an order (the taps, the flat-top) */
  workX: number; workFace: number;
  /** a point on your side of their counter, just clear of it (the view test: a cook stands inside the truck's
   *  collider and the bartender behind the bar, so the line is tested to here, not to them) */
  seeX: number;
}
/** what the crowd needs from the page: the seats, a path planner on the walk grid, the ground height, whose seat is yours */
export interface CrowdCtx {
  seats: Seat[];
  plan: (ax: number, az: number, bx: number, bz: number) => P2[] | null;
  height: (x: number, z: number) => number;
  yourSeat: () => Seat | null;
  /** the sidewalk routes for the walkers (from the data: the Orangewood sidewalks either side) */
  sidewalks: P2[][];
  /** the people standing about changed (re-plan the walk grid round them) */
  moved: () => void;
}

export class Crowd {
  npcs: Npc[] = []; groups: Group[] = []; staff: Npc[] = []; crew: Npc[] = []; walkers: Npc[] = [];
  readonly root = new THREE.Group();
  view: PeopleView;
  private r = rand(5701);
  private _v = new THREE.Vector3(); private _w = new THREE.Vector3(); private _q = new THREE.Quaternion(); private _ax = new THREE.Vector3();
  /** the page's callbacks: a caption to show (null clears it), reply chips (null hides them) */
  onCaption: (who: string | null, text: string, seconds: number) => void = () => {};
  onReplies: (r: [string, string] | null) => void = () => {};
  /** your eyes (world), for "they turn to you" */
  you = new THREE.Vector3();
  night = false; car = 'rossini-gt';
  buildMs = 0;
  /** the crowd now: open, the simulated share of capacity, the guests it calls for, and the walkers on the street */
  open = false; share = 0; target = 0; streetN = 2; busy = false;
  /** seats the guests are in or walking to (nobody else sits there) */
  readonly taken = new Set<number>();
  /** what happened (arrivals, departures), for the hooks */
  log: string[] = [];
  /** how many walks had no path on the grid (they're placed straight there instead) */
  routeFails = 0;
  private ctx: CrowdCtx | null = null;
  private simT = 0;
  set occluded(f: ((ax: number, az: number, bx: number, bz: number) => boolean) | null) { this.view.occluded = f; }
  get occluded() { return this.view.occluded; }

  constructor(private items: Items, public quality: PeopleQuality, public ultra: boolean, renderer: THREE.WebGLRenderer, tier: Tier) {
    this.root.name = 'crowd';
    // 8 cells a person standing, 8 more for the seated
    const cells = 40 * 8 + ROSTER.reduce((s, d) => s + (d.sit ? d.n : 0), 0) * 8;
    this.view = new PeopleView(renderer, tier, cells);
    this.root.add(this.view.root);
  }

  /** build everyone (at load: a far body takes about a third of a second; the patio bodies come from the worker) */
  async build(posts: StaffPost[], ctx: CrowdCtx, night: boolean, progress: (k: number, n: number) => Promise<void> | void = () => {}) {
    const t0 = performance.now();
    this.ctx = ctx;
    // (with no progress to show, nothing is awaited and the whole build runs straight through)
    const total = 40, step = async () => { const k = this.npcs.length; if (k % 4 === 0) { const w = progress(k, total); if (w) await w; } };
    let seed = 300;
    for (let gi = 0; gi < ROSTER.length; gi++) {
      const d = ROSTER[gi];
      const party: Party = { size: d.n, state: 'away', stay: 0, from: d.from, order: d.order, out: 0 };
      const g: Group = { id: gi, label: d.label, cx: d.cx, cz: d.cz, r: d.r, table: d.table, members: [], home: [], speaker: -1, turnT: 0, pauseT: 0.5 + gi, lookAt: 0, lookT: 0, laughT: 20 + gi * 13, you: null, talk: null, active: false, seed: 77 + gi * 31, seated: !!d.sit, ready: false, party };
      const seats = d.sit ? this.pickSeats(ctx.seats, d) : [];
      for (let k = 0; k < d.n; k++) {
        // adults on a night out, dressed for the patio (patioOutfit, above); P1b's six (seeds 300 to 305) unchanged
        const o = forTheHour(patioOutfit(randomPerson(seed), !d.table, seed), night && gi >= 2, seed); seed++;
        const a = (k / d.n) * Math.PI * 2 + gi * 0.7;
        const st = seats[k] ?? null;
        const x = st ? st.x : d.cx + Math.sin(a) * d.r, z = st ? st.z : d.cz + Math.cos(a) * d.r;
        const n = this.add(o, 'regular', d.sit ? 'seat' : 'circle', NAMES[(gi * 5 + k * 3) % NAMES.length], x, 0, z, st ? st.face : wrap(a + Math.PI), !!st);
        n.group = g; g.members.push(n); g.home.push(a); n.seat = st;
        n.hold = d.holds[k] ?? null;
        await step();
      }
      this.groups.push(g);
    }
    posts.forEach((s, i) => {
      const o = staffPerson(900 + i * 17, i === 1, s.role === 'bartender' ? 'polo' : 'tee');
      const n = this.add(o, s.role, 'post', s.role === 'bartender' ? 'Bartender' : 'Cook', s.x, s.y, s.z, s.face, false);
      n.tx = s.x; n.tz = s.z; n.th = s.face; n.seeX = s.seeX;
      (n as Npc & { post: StaffPost }).post = s;
      this.staff.push(n);
    });
    await step();
    // the rest of the staff: a second bartender on the back bar, the host at the gate, the busser, the lot attendant
    const bar = posts.find((p) => p.counter === 'bar');
    const crew: [Role, string, number, boolean, number, number, number][] = [
      ['barback', 'Bartender', 961, true, bar ? bar.x : -45.6, -20, bar ? bar.face : Math.PI / 2],
      ['host', 'Host', 977, false, 5.4, -45.75, Math.PI],
      ['busser', 'Busser', 983, true, -16, -26, Math.PI / 2],
      ['attendant', 'Lot attendant', 991, false, -45.5, 44.5, -Math.PI / 2],
    ];
    for (const [role, name, sd, f, x, z, h] of crew) {
      const n = this.add(staffPerson(sd, f, role === 'barback' ? 'polo' : 'tee'), role, 'crew', name, x, 0, z, h, false);
      n.tx = x; n.tz = z; n.th = h;
      if (role === 'barback' && bar) { (n as Npc & { post: StaffPost }).post = bar; n.seeX = bar.seeX; }
      this.crew.push(n);
      await step();
    }
    // two walkers on the Orangewood sidewalks (one jogs)
    for (let k = 0; k < 2; k++) {
      const o = randomPerson(410 + k * 7);
      const n = this.add(patioOutfit(o, true, 410 + k), 'walker', 'walker', k ? 'Jogger' : 'Walker', 0, 0.15, -54, Math.PI / 2, false);
      n.spd = k ? 2.6 : 1.3;
      this.walkers.push(n);
    }
    // what they hold (castless: a cup's shadow is lost in its holder's)
    for (const n of this.npcs) if (n.hold) this.giveHeld(n, n.hold);
    // the impostors, painted from each person's own body, and the patio bodies ordered nearest the lot gate first
    for (const n of this.npcs) this.view.add(n, Math.hypot(n.x + 5, n.z - 13) + (n.role === 'regular' ? 0 : 5));
    this.view.finishMips();
    this.buildMs = Math.round(performance.now() - t0);
  }
  private giveHeld(n: Npc, id: ItemId) {
    if (n.held) { n.held.removeFromParent(); n.held = null; }
    n.hold = id;
    n.held = this.items.make(id, `held-${n.id}`);
    n.held.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = false; });
    n.heldCalls = n.held.children.length; n.heldTris = this.items.tris(id);
    n.held.visible = false;
    this.root.add(n.held);
  }
  /** P1b's staff take an item from the counter (doings.ts): it rides in their hand like a guest's */
  hand(n: Npc, id: ItemId) { this.giveHeld(n, id); }
  /** the seats of a seated party: of its kind, nearest its centre (the bar's: two side by side) */
  private pickSeats(all: Seat[], d: PartyDef) {
    const ok = all.filter((s) => s.kind === d.sit && (!d.at || s.at === d.at));
    ok.sort((a, b) => Math.hypot(a.x - d.cx, a.z - d.cz) - Math.hypot(b.x - d.cx, b.z - d.cz));
    return ok.slice(0, d.n);
  }
  private add(o: PersonOptions, role: Role, mode: Mode, name: string, x: number, y: number, z: number, heading: number, canSit: boolean): Npc {
    const opts: PersonOptions = { ...o, quality: this.quality, lod: 2 };
    const p = buildPerson(opts);
    p.group.position.set(x, y, z); p.group.rotation.y = heading; p.group.visible = false;
    this.root.add(p.group);
    const n: Npc = {
      id: this.npcs.length, name, role, mode, p, opts, x, y, z, heading, tx: x, tz: z, th: heading, ox: 0, oz: 0,
      hold: null, held: null, heldOn: false, heldCalls: 0, heldTris: 0, acc: 0, acc0: 0, lod: 2, shown: false, closeUp: false,
      speaking: false, look: null, lv: new THREE.Vector3(), nodT: 0, laughT: 0, glanceT: 0, anim: 'idle', playing: 'idle', group: null,
      pose: 'stand', canSit, rep: 'off', dist: 0, m1: null, g2: null, tris1: 0, tris2: 0, cells: [-1, -1], paintedFrom: 2, shadow: false,
      occl: false, occlK: this.npcs.length, seeX: null,
      seat: null, sitK: 0, route: null, ri: 0, spd: WALK, then: null, placed: true,
      sipT: 40 + (this.npcs.length * 7.3) % 50, sipK: 0, beat: 0, waveT: 4 + (this.npcs.length % 5), wipeT: 0, phase: (this.npcs.length * 1.618) % (Math.PI * 2), greeted: false,
    };
    p.play('idle');
    this.npcs.push(n);
    return n;
  }
  post(n: Npc) { return (n as Npc & { post: StaffPost }).post; }
  dispose() { for (const n of this.npcs) { this.root.remove(n.p.group); n.p.dispose(); } this.view.dispose(); this.npcs = []; this.groups = []; this.staff = []; this.crew = []; this.walkers = []; }

  // ------------------------------------------------------------------------------------------ the simulated crowd
  /**
   * The clock moved: open or not, the simulated share of the fictional capacity (clock.ts), night or day. `settle`
   * (the clock was set) puts the crowd straight at its level; otherwise (the live clock ticking on) parties arrive and
   * leave over the next minutes. Closed: nobody inside, the staff gone, the gate shut; the street keeps its walkers.
   */
  setCrowd(open: boolean, share: number, night: boolean, hour: number, settle: boolean) {
    this.open = open; this.share = open ? share : 0; this.night = night;
    this.target = open ? Math.round(GUESTS * this.share) : 0;
    this.busy = open && this.share >= 0.6 && night;
    // walkers: both by day and evening, one late, nobody in the small hours
    this.streetN = hour >= 7 && hour < 23 ? 2 : hour >= 1 && hour < 6 ? 0 : 1;
    if (settle || !open) this.settle();
    this.staffOn();
    for (let i = 0; i < this.walkers.length; i++) { const w = this.walkers[i], on = i < this.streetN; if (on !== w.shown) { if (on) this.startWalker(w, true); else { w.shown = false; w.route = null; } } }
  }
  /** the parties that make up `target` guests, in their arrival order (each whole party, none over by more than one) */
  private wanted(): Set<Group> {
    const out = new Set<Group>();
    let sum = 0;
    for (const g of [...this.groups].sort((a, b) => a.party.order - b.party.order)) {
      if (sum + g.party.size > this.target + 1) continue;
      if (g.seated && g.members.some((m) => m.seat && this.ctx?.yourSeat() === m.seat)) continue;
      out.add(g); sum += g.party.size;
    }
    return out;
  }
  /** straight to the crowd's level: wanted parties in place, the rest gone (a circle you're in stays) */
  settle() {
    const want = this.wanted();
    for (const g of this.groups) {
      const keep = want.has(g) || g.you !== null || !!g.talk;
      if (keep) this.place(g); else this.away(g);
    }
    this.ctx?.moved();
  }
  /** a party in its place now: standing in its circle or sat in its seats */
  private place(g: Group) {
    const P = g.party;
    if (P.state !== 'here') P.stay = this.stayS() * (0.2 + 0.8 * this.r());
    P.state = 'here'; g.active = true; g.ready = true;
    g.members.forEach((m, i) => {
      m.shown = true; m.route = null; m.then = null; m.placed = true;
      if (m.seat) { this.taken.add(m.seat.id); this.seatNow(m); }
      else if (g.you === null) { const a = g.home[i]; m.tx = g.cx + Math.sin(a) * g.r; m.tz = g.cz + Math.cos(a) * g.r; m.th = wrap(a + Math.PI); m.x = m.tx; m.z = m.tz; m.heading = m.th; m.y = 0; m.pose = 'stand'; this.setAnim(m, 'idle'); }
    });
  }
  private away(g: Group) {
    g.party.state = 'away'; g.active = false; g.ready = false; g.speaker = -1; g.talk = null; g.you = null;
    for (const m of g.members) { m.shown = false; m.route = null; m.then = null; m.speaking = false; if (m.seat) this.taken.delete(m.seat.id); }
  }
  /** a stay: log-normal, median 75 minutes (seconds) */
  private stayS() { const z = Math.sqrt(-2 * Math.log(this.r() + 1e-9)) * Math.cos(2 * Math.PI * this.r()); return 75 * 60 * Math.exp(0.45 * z); }
  /** the staff the hour calls for */
  private staffOn() {
    const on = this.open;
    for (const n of this.staff) n.shown = on;
    for (const n of this.crew) {
      const want = on && (n.role === 'host' || (n.role === 'barback' && this.share >= 0.4) || (n.role === 'busser' && this.share >= 0.3) || (n.role === 'attendant' && this.busy));
      if (want && !n.shown) { n.x = n.tx; n.z = n.tz; n.heading = n.th; n.route = null; }
      n.shown = want;
    }
  }
  /** a party arrives: from a car in the lot or along the sidewalk, each member walking to their place */
  arrive1(g: Group) {
    const P = g.party, C = this.ctx; if (!C) return;
    P.state = 'in'; g.active = true; g.ready = false; g.speaker = -1;
    const [sx, sz] = this.entry(P.from);
    this.log.push(`arrive ${g.id} from ${P.from}`);
    g.members.forEach((m, i) => {
      const ox = (i % 2 ? 1 : -1) * 0.55 * Math.ceil(i / 2), oz = (i % 3) * 0.45;
      m.shown = true; m.placed = false; m.speaking = false; m.look = null; m.x = sx + ox; m.z = sz + oz; m.y = C.height(m.x, m.z); m.pose = 'stand'; m.sitK = 0;
      // (no way from there on the walk grid: they're simply in their place, as when the clock is set)
      const done = () => { m.placed = true; if (m.seat && m.sitK < 1) m.sitK = 0.001; else { m.x = m.tx; m.z = m.tz; } if (g.members.every((k) => k.placed)) { P.state = 'here'; P.stay = this.stayS(); g.ready = true; g.pauseT = 1.5; this.ctx?.moved(); } };
      let tx: number, tz: number;
      if (m.seat) { this.taken.add(m.seat.id); tx = m.seat.ax; tz = m.seat.az; }
      else { const a = g.home[i]; tx = g.cx + Math.sin(a) * g.r; tz = g.cz + Math.cos(a) * g.r; m.tx = tx; m.tz = tz; m.th = wrap(a + Math.PI); }
      // (they set off a moment apart, so a party walks in as a party)
      if (!this.walkTo(m, tx, tz, done, i * 0.7)) { if (m.seat) this.seatNow(m); else { m.x = m.tx; m.z = m.tz; m.heading = m.th; } done(); }
    });
  }
  /** a party leaves: back to the lot or the street, then gone */
  leave1(g: Group) {
    const P = g.party; if (!this.ctx) return;
    P.state = 'out'; g.ready = false; g.speaker = -1; P.out = 0;
    this.log.push(`leave ${g.id} to ${P.from}`);
    const [ex, ez] = this.entry(P.from);
    g.members.forEach((m, i) => {
      m.speaking = false; m.look = null; m.placed = false;
      if (m.seat) { this.standNow(m); this.taken.delete(m.seat.id); }
      const gone = () => { m.shown = false; P.out++; if (P.out >= g.members.length) { this.away(g); } };
      // (no way out on the walk grid: they're simply gone)
      if (!this.walkTo(m, ex + (i - 1) * 0.6, ez, gone, i * 0.5)) gone();
    });
    this.ctx.moved();
  }
  /** where a party comes from: by a car in the lot (an aisle) or along the Orangewood sidewalk */
  private entry(from: 'lot' | 'street'): P2 {
    // (the lot's two aisles, by the parked cars; not the planted median between the rows)
    if (from === 'lot') return [-30 + this.r() * 50, this.r() < 0.5 ? 27 : 46.5];
    const s = this.r() < 0.5 ? -1 : 1;
    return [s * (24 + this.r() * 30), -54.2];
  }
  /** the crowd over time: stays run out, parties come in at random (about one every two minutes while it's under its
   *  level) and leave early at the same rate when it's over */
  private tickParties(dt: number) {
    if (!this.open) return;
    let present = 0;
    for (const g of this.groups) if (g.party.state === 'in' || g.party.state === 'here') present += g.party.size;
    for (const g of this.groups) {
      const P = g.party;
      if (P.state !== 'here') continue;
      P.stay -= dt;
      if (P.stay <= 0) { if (g.you !== null || g.talk) P.stay = 300; else { this.leave1(g); present -= P.size; } }
    }
    const rate = dt / 120;
    if (present < this.target && this.r() < rate) {
      const g = [...this.groups].sort((a, b) => a.party.order - b.party.order).find((k) => k.party.state === 'away' && present + k.party.size <= this.target + 1 && !(k.seated && k.members.some((m) => m.seat && this.ctx?.yourSeat() === m.seat)));
      if (g) this.arrive1(g);
    } else if (present > this.target + 1 && this.r() < rate) {
      const g = [...this.groups].sort((a, b) => b.party.order - a.party.order).find((k) => k.party.state === 'here' && k.you === null && !k.talk);
      if (g) this.leave1(g);
    }
  }
  /** the next party to leave now and the next to come in (for the hooks and the screenshots of people walking in) */
  turnover(): { left: number | null; arriving: number | null } {
    const here = [...this.groups].filter((g) => g.party.state === 'here' && g.you === null && !g.talk).sort((a, b) => b.party.order - a.party.order)[0] ?? null;
    if (here) this.leave1(here);
    const away = [...this.groups].filter((g) => g.party.state === 'away' && g !== here).sort((a, b) => a.party.order - b.party.order)[0] ?? null;
    if (away) this.arrive1(away);
    return { left: here?.id ?? null, arriving: away?.id ?? null };
  }

  // ------------------------------------------------------------------------------------------ walking and sitting
  /** walk to (x, z) by a path on the walk grid, then `then`; false (and no walk) when the grid has no way there:
   *  nobody ever walks a straight line through a wall */
  private walkTo(n: Npc, x: number, z: number, then: (() => void) | null, delay = 0): boolean {
    const p = this.ctx?.plan(n.x, n.z, x, z) ?? null;
    if (!p) { this.routeFails++; this.log.push(`no path ${n.name} ${n.x.toFixed(1)},${n.z.toFixed(1)} to ${x.toFixed(1)},${z.toFixed(1)}`); return false; }
    const route: P2[] = [...p];
    const last = route[route.length - 1];
    // (the last step onto the exact spot: a slot in a circle or a seat's approach, a few centimetres from the grid's
    // free cell the path ends on)
    if (Math.hypot(last[0] - x, last[1] - z) > 0.05) route.push([x, z]);
    n.route = route; n.ri = 1; n.then = then; n.wipeT = -delay;
    if (n.mode !== 'walker') n.spd = WALK * (0.92 + this.r() * 0.16);
    return true;
  }
  /** a seated guest in their seat now */
  private seatNow(m: Npc) { const s = m.seat!; m.x = s.x; m.z = s.z; m.heading = s.face; m.th = s.face; m.y = Math.max(-0.1, s.y - 0.47); m.pose = 'sit'; m.sitK = 1; this.setAnim(m, 'sit'); }
  private standNow(m: Npc) { const s = m.seat!; m.x = s.ax; m.z = s.az; m.y = 0; m.pose = 'stand'; m.sitK = 0; this.setAnim(m, 'idle'); }
  /** what a person does with their body: seated people keep sitting whatever they're doing */
  private setAnim(m: Npc, a: Npc['anim']) {
    m.anim = a;
    const real = m.pose === 'sit' && a !== 'walk' ? 'sit' : a === 'sit' ? 'idle' : a;
    if (real !== m.playing) { m.playing = real; m.p.play(real as 'idle'); }
  }
  /** a walker along their sidewalk: from one end to the other (back the other way next time) */
  private startWalker(w: Npc, anywhere: boolean) {
    const C = this.ctx; if (!C) return;
    const k = this.walkers.indexOf(w);
    // the south sidewalk (the venue's side) for the walker, the north one for the jogger
    const zz = k === 0 ? -54.2 : -86;
    const dir = (w.phase += 1) % 2 < 1 ? 1 : -1;
    // (each end on the mapped sidewalk nearest to it, so the walk stays on the walk)
    const [ax, az] = this.onWalk(-dir * 140, zz), [bx, bz] = this.onWalk(dir * 140, zz);
    const p = C.plan(ax, az, bx, bz);
    w.shown = true; w.pose = 'stand'; w.y = 0.15;
    if (!p || p.length < 2) { this.routeFails++; this.log.push(`no sidewalk path for ${w.name}`); w.shown = false; w.wipeT = -10; return; }
    w.route = p;
    w.ri = 1;
    // (the first time, part of the way along already)
    if (anywhere) { const t = this.r(); const i = Math.max(1, Math.floor(t * (w.route.length - 1))); const a = w.route[i - 1], b = w.route[i]; w.x = a[0] + (b[0] - a[0]) * 0.5; w.z = a[1] + (b[1] - a[1]) * 0.5; w.ri = i; }
    else { w.x = w.route[0][0]; w.z = w.route[0][1]; }
    w.then = () => { w.shown = false; w.wipeT = -(8 + this.r() * 20); w.route = null; };
    this.setAnim(w, 'walk');
  }
  /** the nearest point of a mapped sidewalk to (x, z) */
  private onWalk(x: number, z: number): P2 {
    let best: P2 = [x, z], bd = Infinity;
    for (const sw of this.ctx?.sidewalks ?? []) for (let i = 1; i < sw.length; i++) {
      const [ax, az] = sw[i - 1], [bx, bz] = sw[i], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
      const t = L > 1e-9 ? clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1) : 0, px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best;
  }
  /** move along a route; true while walking */
  private stepRoute(n: Npc, dt: number, player: { x: number; z: number }): boolean {
    if (!n.route) return false;
    if (n.wipeT < 0) { n.wipeT += dt; if (n.wipeT < 0) { this.setAnim(n, 'idle'); return true; } }
    const [wx, wz] = n.route[n.ri];
    const dx = wx - n.x, dz = wz - n.z, d = Math.hypot(dx, dz);
    // (they slow for you rather than walk through you)
    const px = player.x - n.x, pz = player.z - n.z, pd = Math.hypot(px, pz), ahead = d > 1e-3 && (px * dx + pz * dz) / d > 0;
    const sp = n.spd * (ahead && pd < 1.1 ? 0.25 : 1);
    const k = d > 1e-6 ? Math.min(1, (sp * dt) / d) : 1;
    n.x += dx * k; n.z += dz * k;
    if (d > 0.05) { const h = Math.atan2(dx, dz), dh = wrap(h - n.heading); n.heading += dh * Math.min(1, dt * 6); }
    n.y = this.ctx ? this.ctx.height(n.x, n.z) : n.y;
    this.setAnim(n, 'walk');
    if (k >= 1) {
      n.ri++;
      if (n.ri >= n.route.length) { n.route = null; const t = n.then; n.then = null; this.setAnim(n, 'idle'); t?.(); return false; }
    }
    return true;
  }

  /** the circles a planner should walk round (members in place where they'll stand; not your own slot) */
  blockers(out: { x: number; z: number; r: number }[] = []) {
    out.length = 0;
    for (const g of this.groups) if (g.active && !g.seated) for (const m of g.members) if (m.placed) out.push({ x: m.tx, z: m.tz, r: 0.28 });
    for (const n of this.crew) if (n.shown && (n.role === 'host' || n.role === 'attendant')) out.push({ x: n.x, z: n.z, r: 0.28 });
    return out;
  }
  /** the soft bodies you ease past (everyone on their feet where they are now): written into `out`'s own objects
   *  every frame, new ones only when the count grows */
  soft(out: { x: number; z: number; r: number }[] = []) {
    let k = 0;
    for (const m of this.npcs) {
      if (!m.shown || m.pose === 'sit' || m.mode === 'post' || m.role === 'barback') continue;
      const o = out[k] ?? (out[k] = { x: 0, z: 0, r: 0.26 });
      o.x = m.x + m.ox; o.z = m.z + m.oz; o.r = 0.26; k++;
    }
    out.length = k;
    return out;
  }

  // ------------------------------------------------------------------------------------------ joining
  /** where you'd stand to join a group from (px, pz): the slot that opens toward you */
  slotFor(g: Group, px: number, pz: number) {
    // you stand a step outside their ring, so the whole circle is in view in first person
    const a = Math.atan2(px - g.cx, pz - g.cz), r = g.r + 0.35;
    return { a, x: g.cx + Math.sin(a) * r, z: g.cz + Math.cos(a) * r };
  }
  /** open a gap at angle a: the members re-space evenly round the rest of the circle, keeping their order */
  join(g: Group, a: number) {
    g.you = a;
    const n = g.members.length, order = g.members.map((m, i) => ({ i, d: ((Math.atan2(m.x - g.cx, m.z - g.cz) - a) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.d - q.d);
    // keep their order round the circle, turned so the host (the first of the group: the one built up close on
    // Ultra, who speaks first) ends up across from you
    const h = order.findIndex((o) => o.i === 0), mid = Math.floor(n / 2);
    const turned = order.map((_, k) => order[(k + h - mid + n) % n]);
    turned.forEach((o, k) => this.slot(g, g.members[o.i], a + ((k + 1) / (n + 1)) * Math.PI * 2));
    g.speaker = -1; g.pauseT = 99;
    for (const m of g.members) { m.look = this.you; m.p.setExpression('smile', 0.7); m.speaking = false; this.setAnim(m, 'idle'); }
  }
  private slot(g: Group, m: Npc, a: number) { m.tx = g.cx + Math.sin(a) * g.r; m.tz = g.cz + Math.cos(a) * g.r; m.th = wrap(a + Math.PI); }
  /** you're in your slot: the conversation starts (talk.ts) */
  arrive(g: Group) {
    // the host, across the circle from you, starts (on Ultra, the one built up close)
    const by = g.members[0] ?? this.facing(g);
    g.talk = { stage: 'hello', t: 0.5, n: 0, ex: null, by, choice: -1, seed: g.seed + Math.floor(this.r() * 1000), caption: null, replies: null, log: [] };
  }
  /** the member most nearly across the circle from you (who speaks first) */
  private facing(g: Group) {
    let best = g.members[0], bd = -Infinity;
    for (const m of g.members) { const a = Math.atan2(m.tx - g.cx, m.tz - g.cz), d = Math.abs(wrap(a - (g.you ?? 0))); if (d > bd) { bd = d; best = m; } }
    return best;
  }
  /** your reply (0 or 1) */
  reply(g: Group, i: 0 | 1) {
    const t = g.talk; if (!t || t.stage !== 'reply' || !t.ex) return false;
    t.choice = i; t.stage = 'you'; t.t = readS(t.ex.replies[i]) * 0.8;
    this.say(g, null, t.ex.replies[i], t.t);
    t.replies = null; this.onReplies(null);
    for (const m of g.members) m.look = this.you;
    return true;
  }
  /** you step out: the circle closes up again; mid-conversation, someone says goodbye */
  leave(g: Group) {
    const t = g.talk, bye = !!t && t.stage !== 'done';
    if (bye) this.say(g, t!.by, LATER[t!.seed % LATER.length], 1.6);
    else this.onCaption(null, '', 0);
    // the circle closes up evenly, keeping their order, with the place you stood between two of them (so nobody
    // walks into the spot in front of you as you step back)
    const a = g.you ?? 0, n = g.members.length;
    const order = g.members.map((m, i) => ({ i, d: ((Math.atan2(m.tx - g.cx, m.tz - g.cz) - a) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI) })).sort((p, q) => p.d - q.d);
    order.forEach((o, k) => { const ang = a + ((k + 0.5) / n) * Math.PI * 2; g.home[o.i] = ang; });
    g.talk = null; g.you = null; this.onReplies(null);
    g.members.forEach((m, i) => { this.slot(g, m, g.home[i]); m.look = null; if (!(bye && m === t!.by)) m.p.setExpression('neutral', 1); });
    // their own talk picks up after the goodbye has been said (one speaker at a time)
    g.pauseT = bye ? 2.0 : 1.2; g.speaker = -1;
  }
  /** someone in the circle says a line (or you do: by null); a question waiting for your reply stays on screen */
  private say(g: Group, by: Npc | null, text: string, seconds: number, hold = false) {
    const who = by ? by.name : 'You';
    if (g.talk) { g.talk.caption = { who, text }; g.talk.log.push({ who, text }); }
    this.onCaption(who, text, hold ? 1e9 : seconds + 0.6);
    for (const m of g.members) { m.speaking = m === by; if (m === by) { this.setAnim(m, 'talk'); m.p.setExpression('talking', 0.75); m.p.say(text, seconds); m.look = this.you; } else if (m.anim === 'talk') { this.setAnim(m, 'idle'); m.p.setExpression('smile', 0.5); } }
    if (by) for (const m of g.members) if (m !== by) m.look = by.p.eyes(m.lv);
  }
  private stepTalk(g: Group, dt: number) {
    const t = g.talk!; t.t -= dt;
    if (t.t > 0) return;
    const quietAll = () => { for (const m of g.members) if (m.anim === 'talk') { this.setAnim(m, 'idle'); m.speaking = false; m.p.setExpression('smile', 0.6); } };
    switch (t.stage) {
      case 'hello': { const s = HELLO[t.seed % HELLO.length]; this.say(g, t.by, s, 1.1); t.stage = 'line'; t.t = 1.5; t.ex = pick(OPENERS, this.night, t.seed); break; }
      case 'line': {
        // the opener (or a follow-up, from another member)
        const ex = t.ex!, text = fill(ex.line, this.car), s = readS(text);
        this.say(g, t.by, text, s, true); t.stage = 'reply'; t.t = s; t.replies = ex.replies;
        this.onReplies(ex.replies);
        break;
      }
      case 'reply': quietAll(); for (const m of g.members) m.look = this.you; t.t = 1e9; break;   // waiting for you
      case 'you': {
        const a = t.ex!.answers[t.choice], s = readS(a);
        this.say(g, t.by, a, s); t.stage = 'answer'; t.t = s + 0.4; t.n++;
        // a laugh at the answer, now and then
        if ((t.seed + t.n) % 3 === 0) for (const m of g.members) m.laughT = 0.1 + this.r() * 0.3;
        break;
      }
      case 'answer': {
        quietAll();
        if (t.n < 2) {
          // the second exchange comes from someone else in the circle
          const others = g.members.filter((m) => m !== t.by); t.by = others[(t.seed + t.n) % others.length] ?? t.by;
          t.ex = pick(FOLLOWUPS, this.night, t.seed + t.n * 7); t.stage = 'line'; t.t = 0.7;
        } else { const w = WRAPS[t.seed % WRAPS.length]; this.say(g, t.by, w, readS(w)); t.stage = 'wrap'; t.t = readS(w) + 0.3; }
        break;
      }
      case 'wrap': quietAll(); t.stage = 'done'; t.caption = null; this.onCaption(null, '', 0); g.pauseT = 1.0; g.speaker = -1; for (const m of g.members) m.look = null; break;
      case 'done': break;
    }
  }

  // ------------------------------------------------------------------------------------------ the group's own talk
  private stepGroup(g: Group, dt: number) {
    if (g.talk && g.talk.stage !== 'done') { this.stepTalk(g, dt); return; }
    const M = g.members, n = M.length;
    if (n < 2) return;
    if (g.speaker < 0) {
      g.pauseT -= dt;
      if (g.pauseT <= 0) {
        // the next speaker: usually whoever the last one looked at
        const next = this.r() < 0.75 ? g.lookAt : Math.floor(this.r() * n);
        g.speaker = next % n;
        const s = M[g.speaker];
        // whoever spoke last (a goodbye, a line to you) has finished
        for (const m of M) if (m !== s && m.speaking) { m.speaking = false; if (m.anim === 'talk') this.setAnim(m, 'idle'); }
        // a turn of 1 to 10 s, median about 3.5 s (log-normal)
        const z = Math.sqrt(-2 * Math.log(this.r() + 1e-9)) * Math.cos(2 * Math.PI * this.r());
        g.turnT = clamp(3.5 * Math.exp(0.6 * z), 1, 10);
        s.speaking = true; this.setAnim(s, 'talk'); s.p.setExpression('talking', 0.7);
        s.p.say(BABBLE[Math.floor(this.r() * BABBLE.length)], g.turnT);
        g.lookAt = (g.speaker + 1 + Math.floor(this.r() * (n - 1))) % n; g.lookT = 1.5 + this.r() * 1.5;
        for (const m of M) if (m !== s) { m.p.setExpression(this.r() < 0.5 ? 'listen' : 'smile', 0.5 + this.r() * 0.3); m.glanceT = 2 + this.r() * 4; }
      }
    } else {
      const s = M[g.speaker];
      g.turnT -= dt; g.lookT -= dt;
      if (g.lookT <= 0) { g.lookAt = (g.speaker + 1 + Math.floor(this.r() * (n - 1))) % n; g.lookT = 1.5 + this.r() * 1.5; }
      if (g.turnT <= 0) {
        s.speaking = false; this.setAnim(s, 'idle'); s.p.setExpression('smile', 0.4);
        g.speaker = -1; g.pauseT = 0.2 + this.r() * 0.6;
        // listeners nod in the pause
        for (const m of M) if (m !== s && this.r() < 0.6) m.nodT = 0.6;
        // laughter: a group event, about 1.5 a minute (one turn in eight or so)
        if (this.r() < 0.12) for (const m of M) m.laughT = (m === s ? 0.01 : 0.1 + this.r() * 0.2);
      }
    }
    // where everyone looks: the speaker at a listener (or at you), listeners at the speaker, with glances
    for (let i = 0; i < n; i++) {
      const m = M[i];
      if (g.speaker === i) { m.look = g.you !== null && g.lookT > 2.6 ? this.you : M[g.lookAt].p.eyes(m.lv); continue; }
      m.glanceT -= dt;
      if (g.speaker >= 0) {
        // a glance away (at another member, or at you when you're in the circle) for about 0.7 s, then back
        if (m.glanceT < 0) { if (m.glanceT < -0.7) m.glanceT = 2 + this.r() * 5; else if (m.glanceT > -dt * 1.5) m.look = g.you !== null ? this.you : M[(i + 1 + Math.floor(this.r() * (n - 1))) % n].p.eyes(m.lv); }
        else m.look = M[g.speaker].p.eyes(m.lv);
      }
    }
  }

  // ------------------------------------------------------------------------------------------ staff at work
  private stepCrew(n: Npc, dt: number, player: { x: number; z: number }) {
    if (this.stepRoute(n, dt, player)) return;
    n.wipeT -= dt;
    if (n.role === 'barback') {
      // the back bar: the taps, then a stretch of counter to wipe, clear of the other bartender
      if (n.wipeT > 0) return;
      const post = this.post(n), main = this.staff[0];
      let z = post.z0 + this.r() * (post.z1 - post.z0);
      for (let k = 0; k < 6 && main && Math.abs(z - main.tz) < 2.2; k++) z = post.z0 + this.r() * (post.z1 - post.z0);
      const taps = this.r() < 0.5;
      n.tx = taps ? post.workX : post.x; n.tz = z; n.th = taps ? post.workFace : post.face;
      n.route = [[n.x, n.z], [n.tx, n.tz]]; n.ri = 1; n.spd = 1.0;
      n.then = () => { n.heading = n.th; n.wipeT = 5 + this.r() * 6; };
    } else if (n.role === 'busser') {
      // rounds of the yard: the end of a table, a few seconds' wiping, the next table
      if (n.wipeT > 0) return;
      const tables = [[-12, -33], [-3, -33], [6, -33], [15, -33], [15, -19], [6, -19], [-3, -19], [-12, -19], [-12, -5], [-3, -5], [6, -5], [15, -5]];
      const k = (Math.floor(n.phase) + 1) % tables.length; n.phase = k;
      const [cx, cz] = tables[k], end = this.r() < 0.5 ? -1 : 1;
      const x = cx + (this.r() - 0.5) * 0.5, z = cz + end * 2.05;
      if (!this.walkTo(n, x, z, () => { n.heading = Math.atan2(cx - n.x, cz - n.z); n.th = n.heading; n.wipeT = 3 + this.r() * 4; })) n.wipeT = 1;
    } else if (n.role === 'host' || n.role === 'attendant') {
      // the host turns to whoever comes in; the attendant waves now and then
      n.heading += wrap(n.th - n.heading) * Math.min(1, dt * 3);
      if (n.role === 'host' && !n.greeted && Math.hypot(player.x - n.x, player.z - n.z) < 3.2 && this.groups.every((g) => !g.talk || g.talk.stage === 'done')) {
        n.greeted = true; this.setAnim(n, 'talk'); n.p.setExpression('smile', 0.8); n.p.say('Welcome to Lot 57. Grab any open seat.', 2.4); n.speaking = true;
        this.onCaption(n.name, 'Welcome to Lot 57. Grab any open seat.', 3); n.wipeT = 2.6;
      } else if (n.speaking && n.wipeT <= 0) { n.speaking = false; this.setAnim(n, 'idle'); }
    }
  }

  // ------------------------------------------------------------------------------------------ the frame
  /** move, animate and choose how everyone is drawn; `total` is what the renderer drew in the last frame */
  update(dt: number, camera: THREE.Camera | null, player: { x: number; z: number }) {
    this.simT += dt;
    this.tickParties(dt);
    for (const g of this.groups) if (g.active && g.ready) this.stepGroup(g, dt);
    for (const w of this.walkers) if (!w.shown && w.wipeT < 0 && this.walkers.indexOf(w) < this.streetN) { w.wipeT += dt; if (w.wipeT >= 0) this.startWalker(w, false); }
    for (const n of this.npcs) {
      if (!n.shown) continue;
      if (n.mode === 'walker') { this.stepRoute(n, dt, player); }
      else if (n.mode === 'crew') this.stepCrew(n, dt, player);
      else if (n.route) this.stepRoute(n, dt, player);
      else if (n.mode === 'seat') this.stepSeat(n, dt);
      else {
        // walking to a slot (little side-steps), stepping aside for you; staff along their counter
        const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
        const moving = d > 0.03;
        // (the regulars side-step into a slot at 0.75 m/s; staff walk along the counter at an ordinary 1.2 m/s, the pace
        // the builder's walk cycle is tuned for)
        if (moving) { const k = Math.min(1, ((n.role === 'regular' ? 0.75 : 1.2) * dt) / d); n.x += dx * k; n.z += dz * k; }
        if (n.role === 'regular') {
          const px = player.x - (n.x + n.ox), pz = player.z - (n.z + n.oz), pd = Math.hypot(px, pz);
          const want = pd < 0.62 && n.group?.you === null ? 0.3 : 0;
          const ax = want ? (-px / (pd || 1)) * want : 0, az = want ? (-pz / (pd || 1)) * want : 0;
          n.ox += (ax - n.ox) * Math.min(1, dt * 3); n.oz += (az - n.oz) * Math.min(1, dt * 3);
        }
        // the body turns toward its facing (staff turn to work and back); staff walking face the way they go
        const face = n.role !== 'regular' && d > 0.25 ? Math.atan2(dx, dz) : n.th;
        const dh = wrap(face - n.heading); n.heading += dh * Math.min(1, dt * 5);
        if (n.role !== 'regular') {
          const want = d > 0.25 ? 'walk' : moving || Math.abs(dh) > 0.35 ? 'turn' : n.speaking ? 'talk' : 'idle';
          if (want !== n.anim) this.setAnim(n, want);
        } else if (moving && n.anim !== 'turn' && n.anim !== 'talk') this.setAnim(n, 'turn');
        else if (!moving && n.anim === 'turn') this.setAnim(n, 'idle');
      }
      // laughter (seated people laugh with their face and shoulders: the builder's laugh is a standing one)
      if (n.laughT > 0) { n.laughT -= dt; if (n.laughT <= 0) { if (n.pose === 'sit') n.p.setExpression('smile', 1); else { n.p.setExpression('laugh', 1); n.anim = 'laugh'; n.playing = 'laugh'; } n.laughT = -1.4; } }
      else if (n.laughT < 0) { n.laughT += dt; if (n.laughT >= 0) { n.laughT = 0; n.p.setExpression('smile', 0.6); this.setAnim(n, n.speaking ? 'talk' : 'idle'); } }
      n.p.group.position.set(n.x + n.ox, n.y, n.z + n.oz); n.p.group.rotation.y = n.heading;
    }
    // animate: 30 Hz near, 10 Hz to 40 m, 5 Hz beyond (bodies in view; everyone when the page steps unrendered)
    for (const n of this.npcs) {
      if (!n.shown) continue;
      const hz = n.dist < 15 ? 30 : n.dist < 40 ? 10 : 5;
      n.acc += dt;
      if ((isBody(n.rep) || !camera) && n.acc >= 1 / hz - 1e-4) this.animate(n);
    }
  }
  /** one step of a person's animation (their accumulated time, at most a quarter second), then the overlays */
  private animate(n: Npc) {
    const step = Math.min(n.acc, 0.25);
    n.p.lookAt(n.look);
    n.p.update(n.route && n.anim === 'walk' ? step * clamp(n.spd / WALK, 0.6, 2.2) : step);
    n.acc0 = step; n.acc = 0;
    this.pose(n, step);
  }
  /**
   * How everyone is drawn this frame (lot57/crowdview.ts), once the camera is placed for it: `total` is what the
   * renderer drew in the last frame. Anyone who has just become a body is posed now, so nobody shows a stale pose.
   */
  draw(camera: THREE.Camera, total: { calls: number; tris: number }) {
    const [l0] = LOD_RANGES[this.quality];
    for (const n of this.npcs) this.wasBody[n.id] = isBody(n.rep) ? 1 : 0;
    camera.updateMatrixWorld();
    this.view.allot(this.npcs, camera, total, l0 + 0.5);
    this.view.pump();
    for (const n of this.npcs) {
      n.lod = n.rep === 'm0' ? 0 : n.rep === 'm1' ? 1 : 2;
      if (!n.shown || !isBody(n.rep)) continue;
      if (!this.wasBody[n.id]) { n.acc = Math.max(n.acc, 1 / 30); this.animate(n); }
      else if (n.held && n.heldOn) placeHeld(n.p, n.held, n.heading, this._v, this._w);
    }
  }
  private wasBody: number[] = [];
  /** a seated guest: sitting down after the walk in, then turning a little on the seat toward whoever they listen to */
  private stepSeat(n: Npc, dt: number) {
    const s = n.seat; if (!s) return;
    if (n.sitK > 0 && n.sitK < 1) {
      // sitting down: from where you'd stand to sit, onto the seat, in half a second
      n.sitK = Math.min(1, n.sitK + dt / 0.5);
      if (n.pose !== 'sit') { n.pose = 'sit'; this.setAnim(n, 'sit'); }
      const k = n.sitK;
      n.x = s.ax + (s.x - s.ax) * k; n.z = s.az + (s.z - s.az) * k; n.y = Math.max(-0.1, s.y - 0.47) * k;
      n.heading += wrap(s.face - n.heading) * Math.min(1, dt * 8);
      return;
    }
    if (n.sitK === 0) return;
    // (a seated listener's hips turn on the seat, up to 25 degrees, toward the speaker; the head does the rest)
    let want = s.face;
    if (n.look) { const a = Math.atan2(n.look.x - n.x, n.look.z - n.z); want = s.face + clamp(wrap(a - s.face) * 0.6, -25 * DEG, 25 * DEG); }
    n.heading += wrap(want - n.heading) * Math.min(1, dt * 2.5);
  }
  /**
   * Ultra: the first of P1b's two groups gets the builder's close-up body (LOD 0: separate eyes, lashes, teeth,
   * clothes), shown within a few metres, so the person who talks to you when you join is the most detailed one on
   * screen. It takes seconds per person, so the page calls this at load or behind a toast, never mid-conversation.
   */
  buildCloseUps() {
    const t0 = performance.now();
    for (const g of this.groups.slice(0, 2)) { const m = g.members[0]; if (!m || m.closeUp) continue; m.p.setLod(0); m.p.setLod(2); m.closeUp = true; m.rep = 'off'; m.p.group.visible = false; }
    return Math.round(performance.now() - t0);
  }

  /** after the builder's animation: a sip, a held drink in the right hand, a nod, a seated speaker's hand, a laugh's
   *  shoulders, the attendant's wave, the busser's wipe; then put the held item in the hand */
  pose(n: Npc, dt: number) {
    const bones = n.p.group;
    // a nod: 8 to 12 degrees at about 2 Hz for 0.6 s
    if (n.nodT > 0) { const head = bones.getObjectByName('head'); if (head) { this._q.setFromAxisAngle(this._ax.set(1, 0, 0), Math.abs(Math.sin((0.6 - n.nodT) * Math.PI * 2)) * 10 * DEG); head.quaternion.multiply(this._q); } n.nodT -= dt; }
    // a seated laugh: the shoulders bounce, the head tips back
    if (n.pose === 'sit' && n.laughT < 0) {
      const ch = bones.getObjectByName('chest'), head = bones.getObjectByName('head'), w = Math.sin(-n.laughT / 1.4 * Math.PI);
      if (ch) { ch.quaternion.multiply(this._q.setFromAxisAngle(this._ax.set(1, 0, 0), -Math.abs(Math.sin(n.laughT * 14)) * 4 * DEG * w)); }
      if (head) head.quaternion.multiply(this._q.setFromAxisAngle(this._ax.set(1, 0, 0), -9 * DEG * w));
    }
    // a seated speaker beats the words with the free hand
    if (n.pose === 'sit' && n.sitK >= 1) {
      n.beat += ((n.speaking ? 1 : 0) - n.beat) * Math.min(1, dt * 4);
      if (n.beat > 0.02) { n.phase += dt * 2.3; armPose(n.p, n.held ? 'L' : 'R', n.beat * (0.35 + 0.3 * Math.abs(Math.sin(n.phase))), 55 + 25 * Math.abs(Math.sin(n.phase * 1.7)), 18, this._q, this._ax); }
    }
    if (n.role === 'attendant' && n.shown) {
      n.waveT -= dt;
      if (n.waveT < 0) { const w = Math.sin(clamp(-n.waveT / 2.2, 0, 1) * Math.PI); armPose(n.p, 'R', w, 40 + 25 * Math.sin(this.simT * 9), 125, this._q, this._ax); if (n.waveT < -2.2) n.waveT = 6 + (n.id % 4); }
    }
    if ((n.role === 'busser' || n.role === 'barback') && !n.route && n.wipeT > 0) armPose(n.p, 'R', 0.8, 70 + 12 * Math.sin(this.simT * 5), 30 + 10 * Math.sin(this.simT * 5 + 1), this._q, this._ax);
    if (!n.held) return;
    // a sip every 40 to 90 s: the cup comes up to the mouth for about a second and a half
    n.sipT -= dt;
    if (n.sipT < 0 && !n.speaking) { n.sipK = Math.min(1, -n.sipT / 0.4) * (n.sipT > -1.1 ? 1 : Math.max(0, (1.5 + n.sipT) / 0.4)); if (n.sipT < -1.5) { n.sipT = 40 + ((n.id * 37) % 50); n.sipK = 0; } }
    else if (n.sipT < 0) n.sipT = 3;
    holdPose(n.p, n.anim === 'laugh' ? 0.6 : 1, this._q, this._ax, n.sipK);
    if (n.heldOn) placeHeld(n.p, n.held, n.heading, this._v, this._w);
  }

  // ------------------------------------------------------------------------------------------ queries
  /** the person a ray from the camera hits first (a capsule round each one drawn), within maxT */
  hit(ray: THREE.Ray, maxT: number): { npc: Npc; t: number } | null {
    let best: { npc: Npc; t: number } | null = null;
    for (const n of this.npcs) {
      if (!n.shown || n.rep === 'off') continue;
      const top = n.pose === 'sit' ? 1.3 : 1.7;
      const a = this._v.set(n.x + n.ox, n.y + 0.25, n.z + n.oz), b = this._w.set(n.x + n.ox, n.y + top, n.z + n.oz);
      const t = rayCapsule(ray, a, b, 0.32);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { npc: n, t };
    }
    return best;
  }
  stats() {
    const act = this.npcs.filter((n) => n.shown), v = this.view.stats;
    const inside = (n: Npc) => n.x > -48 && n.x < 52 && n.z > -48 && n.z < 10;
    return {
      npcs: act.length, guests: act.filter((n) => n.role === 'regular').length, inside: act.filter(inside).length,
      groups: this.groups.filter((g) => g.active).length, talking: this.groups.filter((g) => g.active && g.ready && g.members.length > 1).length,
      seated: act.filter((n) => n.pose === 'sit').length,
      walkers: act.filter((n) => !!n.route && n.wipeT >= 0).length, street: act.filter((n) => n.role === 'walker').length,
      staff: act.filter((n) => n.mode === 'post' || n.mode === 'crew').length,
      drawn: act.filter((n) => n.rep !== 'off').length, bodies: v.meshes, impostors: v.imps, lod0: v.lod0, lod1: v.lod1, lod2: v.lod2, shadows: v.shadows, heldDrawn: v.held,
      tris: v.npcTris, calls: v.npcCalls, venueTris: v.venueTris, venueCalls: v.venueCalls,
      buildMs: this.buildMs, workerMs: v.workerMs.slice(-12), workerErrors: this.view.errors.slice(-3), workers: this.view.workers, lod1Built: v.lod1Built, lod1Pending: this.view.lod1Pending, paintMs: Math.round(v.paintMs), atlas: v.atlas,
      target: this.target, share: +this.share.toFixed(3), routeFails: this.routeFails, taken: this.taken.size,
    };
  }
}

/**
 * Hold something in the right hand: the forearm comes up to about waist height, steady (it stops swinging with the
 * walk and the talk gestures on that side). Rotations are about the bones' rest-frame axes, after the builder's
 * animation has written them (the builder's own files are unchanged). `sip` (0..1) brings it up to the mouth.
 */
export function holdPose(p: Person, k: number, q: THREE.Quaternion, ax: THREE.Vector3, sip = 0) {
  const arm = p.group.getObjectByName('armR'), fore = p.group.getObjectByName('foreR'), hand = p.group.getObjectByName('handR');
  if (!arm || !fore || !hand) return;
  const body = p.options.body, a = p.rig.armAngle;
  const heavy = clamp((body.fat - 0.55) / 0.45, 0, 1), out = (7 + 11 * heavy + 6 * clamp(body.muscle - 0.6, 0, 1)) * DEG;
  const lower = a - out;
  // the upper arm: lowered from the rest pose as the builder's stance does, a little forward, turned in (so the bent
  // forearm comes across in front of the hip); the elbow bent about 80 degrees; the wrist straight
  _t.setFromAxisAngle(ax.set(0, 0, 1), lower * 0.8).multiply(q.setFromAxisAngle(ax.set(1, 0, 0), (-14 - 26 * sip) * DEG)).multiply(q.setFromAxisAngle(ax.set(0, 1, 0), (18 + 10 * sip) * DEG));
  arm.quaternion.slerp(_t, k);
  _t.setFromAxisAngle(ax.set(Math.cos(a), -Math.sin(a), 0), (-80 - 52 * sip) * DEG);
  fore.quaternion.slerp(_t, k);
  hand.quaternion.slerp(q.set(0, 0, 0, 1), k);
}
/**
 * An arm raised for a gesture, a wave or a wipe, on either side: the upper arm lifted `lift` degrees forward from the
 * builder's stance and the elbow bent `elbow` degrees, blended in by k. Same rest-frame axes as holdPose; the left
 * side is its mirror image.
 */
export function armPose(p: Person, side: 'L' | 'R', k: number, elbow: number, lift: number, q: THREE.Quaternion, ax: THREE.Vector3) {
  const arm = p.group.getObjectByName('arm' + side), fore = p.group.getObjectByName('fore' + side);
  if (!arm || !fore || k <= 0) return;
  const a = p.rig.armAngle, s = side === 'R' ? 1 : -1;
  _t.setFromAxisAngle(ax.set(0, 0, 1), s * (a - 10 * DEG) * 0.8).multiply(q.setFromAxisAngle(ax.set(1, 0, 0), -lift * DEG)).multiply(q.setFromAxisAngle(ax.set(0, 1, 0), s * 12 * DEG));
  arm.quaternion.slerp(_t, clamp(k, 0, 1));
  _t.setFromAxisAngle(ax.set(Math.cos(a), -s * Math.sin(a), 0), -elbow * DEG);
  fore.quaternion.slerp(_t, clamp(k, 0, 1));
}
/** put a held item in the right hand: between the wrist and the fingers, upright, facing the way the body faces */
export function placeHeld(p: Person, item: THREE.Object3D, heading: number, v: THREE.Vector3, w: THREE.Vector3) {
  const hand = p.group.getObjectByName('handR'), fing = p.group.getObjectByName('fingR');
  if (!hand || !fing) return;
  p.group.updateMatrixWorld(true);
  hand.getWorldPosition(v); fing.getWorldPosition(w);
  const cupish = !HELD_LOW.has(item.userData.item as ItemId);
  v.lerp(w, 0.55);
  // into the palm (toward the body's midline and a little forward), the base below the grip
  const fx = Math.sin(heading), fz = Math.cos(heading), lx = Math.cos(heading), lz = -Math.sin(heading);
  item.position.set(v.x + fx * 0.025 + lx * 0.035, v.y - (cupish ? 0.07 : 0.035), v.z + fz * 0.025 + lz * 0.035);
  item.rotation.set(0, heading, 0);
}

const _t = new THREE.Quaternion();
const isBody = (r: Rep) => r === 'm0' || r === 'm1' || r === 'm2';
/** food held low in the palm (a boat, a box, a bowl); everything else is held as a cup */
const HELD_LOW = new Set<ItemId>(['pretzel', 'birria', 'asada', 'dumplings', 'garlic', 'cukes']);
/** the first hit of a ray on a vertical capsule (a to b, radius r), or null */
function rayCapsule(ray: THREE.Ray, a: THREE.Vector3, b: THREE.Vector3, r: number): number | null {
  // closest approach between the ray and the segment, then a sphere test there
  const d = ray.direction, o = ray.origin;
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const wx = o.x - a.x, wy = o.y - a.y, wz = o.z - a.z;
  const A = d.x * d.x + d.y * d.y + d.z * d.z, B = d.x * ux + d.y * uy + d.z * uz, C = ux * ux + uy * uy + uz * uz;
  const D = d.x * wx + d.y * wy + d.z * wz, E = ux * wx + uy * wy + uz * wz, den = A * C - B * B;
  let s = den > 1e-9 ? (B * E - C * D) / den : 0, u = den > 1e-9 ? (A * E - B * D) / den : 0;
  u = clamp(u, 0, 1); s = Math.max(0, (B * u - D) / A);
  const px = o.x + d.x * s - (a.x + ux * u), py = o.y + d.y * s - (a.y + uy * u), pz = o.z + d.z * s - (a.z + uz * u);
  const dist = Math.hypot(px, py, pz);
  if (dist > r) return null;
  return Math.max(0, s - Math.sqrt(r * r - dist * dist));
}
export type { Rep };
