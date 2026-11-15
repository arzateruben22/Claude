// Stoppage Time's crowd, S3a (PROJECT_OC_SPORTS_BAR.md, "### S3a: the crowd, staff, fillers and how people are drawn").
// The engine parts are pure and live in engine/sim/ (crowd.ts: the regulars, parties, stays, teams and the staff plan;
// autonomy.ts: the utility AI; groups.ts: the talking groups; builds.ts: the time budget). This file turns them on for
// the bar and draws the room:
//   - the crowd: the target from the schedule (capacity x share), live guests up to the preset's cap (staff included),
//     parties arriving from the lot and the drop-off, stays and leaving, the regulars' pool, held guests and fillers;
//   - autonomy over the objects' adverts and (S3b, social.ts) people's, reservations, the watchdog and the decision log;
//   - the staff: two to four bartenders on the lane path by sections (the westmost one's flap trips at Low), one to
//     three servers on the job queue, the host, the barback, the cooks' plates at the pass, restroom visits;
//   - fillers and cards: the atlas eight, the cards' one instanced mesh and the blobs (cards.ts), where fillers go, the
//     hand-over to live guests with the 6 spare bodies, their reactions;
//   - how people are drawn: LODs and the visibility rule for people, the casting people (each with its LOD 1 body,
//     hidden under a LOD 2 where it's drawn at LOD 2), Ultra's pool-slot people, no NPC LOD 0;
//   - the background builds on the time budget and a change of graphics (the live count to the new cap, held guests,
//     rebuilds at a new people quality);
//   - moods on bodies (walk speed, a slump when Low, the clips) and the crowd's reactions to the screens.
// Nothing here is live and nobody is a real person: the crowd is simulated from the clock and seeds.
import * as THREE from 'three';
import { buildPerson, randomPerson } from '../../people';
import type { Person, PersonOptions } from '../../people';
import type { P2, VisState } from '../../engine/venue-def';
import type { Quality } from '../../engine/mats';
import { pointInPoly } from '../../engine/geom';
import { Needs, Traits, NEEDS, rates, advance, bump, Doing, FunKind, moodOf, moodLabel, Moodlets, emotionOf, Emotion, startNeeds } from '../../engine/sim/needs';
import type { AdvertTag, Advert } from '../../engine/sim/objects';
import { decide, Cand, Decision } from '../../engine/sim/autonomy';
import { Social, SGroup } from './social';
import type { Opp } from './games';
import { BuildScheduler, BuildJob, BuildReason } from '../../engine/sim/builds';
import { regularsPool, Regular, RegularGroup, partySize, stayMinutes, traitsOf, teamAt, staffPlan, staffTotal, StaffPlan, MEAN_PARTY, DRINK_FAVES, FOOD_FAVES, GAME_FAVES } from '../../engine/sim/crowd';
import { FIRST_NAMES } from '../../engine/sim/names';
import { hash32, mulberry, Rnd } from '../../engine/sim/rng';
import { fromAbs, TvEvent } from '../../engine/sim/tv';
import type { HeldItems } from '../../engine/sim/held';
import { CLIP_SECONDS, ClipName, DANCES } from '../../engine/sim/clips';
import { TYPES, DANCE_SLOTS } from './objects';
import { DRINKS, FOODS, itemById, EMPTY } from './menu';
import { Bartender, Server, Host, Barback, handPoint } from './crew';
import { setHiddenCaster } from './visibility';
import { Cards, SEATED, STANDING, CHEERING, CardPose, LOOKS } from './cards';
import { SCREENS, fd, FRONT, POOL_TABLES } from './layout';
import type { BarLife } from './life';
import { withFillRim } from './look';
import { apartFromSkin } from './dress';
import { sfx } from './sfx';

const SECS = 60;
/**
 * A body's own fill light (Lot 57's withFill, lot57/crowdview.ts, written for the bar so it doesn't import Lot 57's
 * crowd): the room's light is baked into the venue's vertex colours, so the builder's body material, lit only by the
 * sky and the few real lights, drew guests inside as near-black cut-outs at Low. The fill is added as the albedo times
 * its level; S4 adds the rim at HD and Ultra (look.ts withFillRim, which this now is).
 */
const withFill = withFillRim;
const WALK = 1.25;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
type Slot = { id: string; zone: string; group?: string; kind: 'seat' | 'stand' | 'staff'; at: P2; face: P2; y: number; stand: P2; r: number; x: number; z: number; sx: number; sz: number; seatId?: number };
type DrawMode = 'lod1' | 'lod2' | 'card' | 'off';

interface Hand { item: string; model: 'glass' | 'basket'; color: number; left: number; next: number }
export interface Act {
  action: string; object: string; slot: string | null; stage: 'walk' | 'do' | 'wait';
  t0: number; dur: number; continuous: boolean; tags: AdvertTag[]; score: number; screen: string | null; why: string;
}
export interface Party {
  id: number; members: Npc[]; from: 'lot' | 'dropoff' | 'settled' | 'filler' | 'spare';
  leaving: boolean; regularGroup: number | null; group: SGroup | null; arrivedT: number; stayUntil: number; yours: boolean;
  /** the unit it was seated at (a table or the singles it took) */
  unit: string | null;
}
export interface Npc {
  id: number; key: string; name: string; regular: string | null;
  opts: PersonOptions; look: number;
  traits: Traits; needs: Needs; moodlets: Moodlets; team: string | null; favourites: { drink: string; food: string; game: string };
  party: Party; mode: 'live' | 'held'; met: boolean;
  p: Person | null; q: 'phone' | 'high' | null; lod1: boolean;
  x: number; z: number; y: number; heading: number;
  slot: string | null; home: string | null;
  path: P2[] | null; pi: number; goal: P2 | null;
  act: Act | null; decideAt: number; leavingTo: P2 | null;
  hand: { drink: Hand | null; food: Hand | null };
  /** a drink and food on order (at the bar or the table), each on its own */
  order: { drink: boolean; food: boolean }; orderT: number;
  clip: ClipName | null; clipUntil: number; cheerCardUntil: number;
  hiddenUntil: number;
  stuckT: number; maxStuck: number; rescues: number; lastX: number; lastZ: number;
  teamMomentAt?: number; teamLostAt?: number;
  draw: DrawMode; caster: number; dist: number; speedK: number; mood: number; label: string; emotion: Emotion;
  seatedSince: number; walkedM: number;
  /** S3b: the talking group they're in (social.ts), and a game's walk: the way to face and what to do on arrival */
  grp: SGroup | null; faceYaw: number | null; onArrive: (() => void) | null;
}
interface Filler { slot: string; unit: string; look: number; pose: CardPose; yaw: number; cheerUntil: number; x: number; y: number; z: number }
interface Unit { id: string; kind: 'table' | 'single'; slots: string[]; zone: string; patio: boolean; fillerOk: boolean; object: string | null; x: number; z: number }
interface StaffRec { role: 'bartender' | 'server' | 'host' | 'barback' | 'house'; body: { p: Person; x: number; z: number; y: number; heading: number; on: boolean; animate?: (dt: number) => void }; id: number; name: string; draw: DrawMode; caster: number; dist: number; lod1: boolean; stuckT: number; maxStuck: number; lastX: number; lastZ: number }
interface Empty { x: number; y: number; z: number; yaw: number; model: 'glass' | 'basket' }
/** one person in the frame's people list: pooled entries, refilled in place each frame and sorted by distance (no
 *  allocation in the draw path); `want` marks the LOD 1 queue's people and `cast` the casting people */
interface PRec { kind: 'npc' | 'staff'; n: Npc | null; s: StaffRec | null; x: number; z: number; d: number; indoor: boolean; want: boolean; cast: boolean }
/** the plates' scale at the pass (one vector, read by putAt) */
const PLATE_SCALE = new THREE.Vector3(0.12, 0.012, 0.12);

/** the restroom doors (frame u, v): two, one person each, out of sight inside */
const RESTROOMS: P2[] = [[28.25, 11.1], [30.35, 11.1]];
/** the plan's per-preset filler distance ("fillerMinM"): 6 m at Low, 9 m at HD and Ultra */
export const FILLER_MIN: Record<Quality, number> = { low: 6, hd: 9, ultra: 9 };   // (def.budgets' fillerMinM, the same numbers)
/** guest slots fillers never take (ours): the counter's stools and gaps (they're where the bartenders serve, so a guest
 *  there is a live one), the staff spots, the water station, the jukebox spot and the games' player spots */
const NO_FILLER_ZONES = new Set(['bar', 'water station', 'kitchen', 'host stand']);
const DANCE_SET = new Set(DANCE_SLOTS);
const EXIT_LOT: P2[] = [[-6633.0, -9392.0], [-6622.0, -9392.0], [-6610.0, -9390.0], [-6640.0, -9374.0]];

export interface CrowdReport { [k: string]: unknown }

export class Crowd {
  npcs: Npc[] = [];
  byKey = new Map<string, Npc>();
  parties: Party[] = [];
  fillers = new Map<string, Filler>();
  staff: StaffRec[] = [];
  bartenders: Bartender[] = []; servers: Server[] = []; host!: Host; barback!: Barback;
  cards: Cards;
  sched = new BuildScheduler();
  units = new Map<string, Unit>();
  unitOf = new Map<string, Unit>();
  slots = new Map<string, Slot>();
  private sees = new Map<string, string[]>();
  private nextId = 1; private nextParty = 1; private seedN = 1;
  private pool: { regulars: Regular[]; groups: RegularGroup[] };
  private r: Rnd;
  private spares: { p: Person; opts: PersonOptions; q: 'phone' | 'high' }[] = [];
  /** the guests whose garments dress.ts moved away from their skin colour (the test hooks' list shows them) */
  private recoloured = new WeakSet<PersonOptions>();
  private empties: Empty[] = [];
  private plates: { x: number; z: number; until: number }[] = [];
  private decisionLog: unknown[] = [];
  private dueQ: Npc[] = [];
  private reactions: Record<string, unknown>[] = [];
  private dances: Record<string, unknown>[] = [];
  private switches: Record<string, unknown>[] = [];
  private audits = { overCap: 0, laneHits: 0, playerLane: 0, liveMax: 0, liveOver: 0, staffLowMax: 0, minGap: Infinity, steps: 0 };
  private plan: StaffPlan = { bartender: 0, server: 0, host: 0, barback: 0, house: 0 };
  private deficitT = 0;
  private quality: Quality = 'low';
  private pq: 'phone' | 'high' = 'phone';
  /** the decisions' time, one entry a batch (a step's up to 6 decisions), the last 400 batches */
  private decideMs: number[] = []; stepMs = 0; frameMs = 0; frameBuildMs = 0;
  /** the drinks' own log (believability, not a mark): orders at the bar and by table service, each one's wait from the
   *  order to the glass in hand (sim s), and once a sim minute how many live guests hold a drink or wait on one */
  private drinkLog = { bar: 0, table: 0, handed: 0, waits: [] as { via: 'bar' | 'table'; s: number }[], samples: [] as { t: number; live: number; holding: number; waiting: number }[], sampleT: 0 };
  private capT = 0;
  private _v = new THREE.Vector3(); private _w = new THREE.Vector3();
  private tapFront: Npc | null = null;
  /** hand-overs that couldn't be made under the cap (the fillers there went home instead) */
  handFails = 0;
  constructor(private life: BarLife, renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.cards = new Cards(renderer);
    scene.add(this.cards.group);
    this.r = mulberry(hash32('crowd', 1));
    this.pool = regularsPool(life.save.regularsSeed || 1);
    this.social = new Social(this, life);
  }
  /** S3b: people with each other (social.ts): groups, the interactions, relationships, guests' games */
  social: Social;
  /** the regulars' pool's seed (the device keeps the regulars' friendships for this pool) */
  get poolSeed() { return this.seedN; }
  get c() { return this.life.ctxRef; }
  get T() { return this.life.T * SECS; }
  get F() { return this.c.F; }

  // ------------------------------------------------------------------------------------------------ set-up
  /** the slots, the units, who sees which screen; the staff; then the room settles and the atlas is painted (before the
   *  first frame) */
  attach(q: Quality) {
    this.quality = q; this.pq = q === 'low' ? 'phone' : 'high';
    for (const s of this.c.venue.slots) { this.slots.set(s.id, s as Slot); if (s.seatId !== undefined) this.seatSlot.set(s.seatId, s.id); }
    // the jukebox's spot is the page's own (S2a's), not one of the venue's slots: the guests pick songs there too
    const js = this.life.slot('jukebox spot'); if (js) this.slots.set(js.id, js);
    const F = this.F;
    RESTROOMS.forEach((rr, i) => { const [x, z] = F.fromFrame(rr[0], rr[1]); this.slots.set(`restroom ${i + 1}`, { id: `restroom ${i + 1}`, zone: 'restrooms', kind: 'stand', at: rr, face: [0, 1], y: 0, stand: rr, r: 0.3, x, z, sx: x, sz: z }); });
    // the front walk's standing spots (crowdAt('outside') and nobody else): between the wall and the planters
    let k = 0;
    for (const d of [0.9, 2.2]) for (let s2 = 0.8; s2 < 17.6; s2 += 0.95) {
      if (s2 > FRONT.door[0] - 0.4 && s2 < FRONT.door[1] + 0.4) continue;
      if (d > 1.7 && ((s2 > 2.2 && s2 < 4.0) || (s2 > 12.2 && s2 < 15.8) || s2 > 16.1)) continue;
      const at = fd(d, s2), [x, z] = F.fromFrame(at[0], at[1]);
      if (!this.c.grid.isFree(x, z)) continue;
      const id = `front walk ${++k}`;
      this.slots.set(id, { id, zone: 'front walk', kind: 'stand', at, face: [-0.932, 0.362], y: 0, stand: at, r: 0.3, x, z, sx: x, sz: z });
    }
    // units: a booth, a high-top or a patio table is one unit of 4; everything else a single
    for (const s of this.slots.values()) {
      let tid: string | null = null;
      const bm = /^booth (\d) /.exec(s.id); if (bm) tid = `booth ${bm[1]}`;
      if (s.group?.startsWith('ht')) tid = `high-top ${+s.group.slice(2) + 1}`;
      if (s.group?.startsWith('pt')) tid = `patio table ${+s.group.slice(2) + 1}`;
      const patio = s.at[1] < 0 && s.at[0] > 2 && s.at[0] < 24;
      const fillerOk = s.kind !== 'staff' && !NO_FILLER_ZONES.has(s.zone) && !s.id.endsWith(' player') && s.id !== 'jukebox spot' && !s.id.startsWith('restroom') && s.zone !== 'front walk' && s.id !== 'shuffleboard thrower';
      const id = tid ?? `single ${s.id}`;
      let u = this.units.get(id);
      if (!u) { u = { id, kind: tid ? 'table' : 'single', slots: [], zone: s.zone, patio, fillerOk, object: null, x: 0, z: 0 }; this.units.set(id, u); }
      u.slots.push(s.id); this.unitOf.set(s.id, u);
      if (!fillerOk) u.fillerOk = false;
    }
    for (const u of this.units.values()) { let x = 0, z = 0; for (const id of u.slots) { const s = this.slots.get(id)!; x += s.x; z += s.z; } u.x = x / u.slots.length; u.z = z / u.slots.length; }
    // who sees which screen from each slot (within 25 m and 60 degrees of a seat's facing; standing spots turn)
    for (const s of this.slots.values()) {
      const seat = s.seatId !== undefined ? this.c.venue.seats[s.seatId] : null;
      this.sees.set(s.id, SCREENS.filter((sc) => this.life.screenInView(sc.id, s.x, s.z, seat ? seat.face : null)).map((sc) => sc.id));
    }
    this.buildStaff(this.pq, true);
    this.seed(1, true);
  }
  /** the staff bodies: the S2a bartender and server and S2b's house player are life's (at LOD 1); three more
   *  bartenders, two more servers, the host and the barback are built here at LOD 2 (all at load) */
  private buildStaff(pq: 'phone' | 'high', first: boolean) {
    const L = this.life, C = this.c;
    // the S2a bartender and server and the house player are life's own (it rebuilds and frees them)
    const old = this.staff.filter((s) => s.role !== 'house' && s.body !== this.bartenders[0] && s.body !== this.servers[0]).map((s) => s.body.p);
    const keepB = this.bartenders.slice(1), keepS = this.servers.slice(1);
    this.bartenders = [L.bartender]; this.servers = [L.server];
    for (let i = 1; i < 4; i++) {
      // (off shift till the staff plan puts it on: then it starts at its own section's post)
      const job = (): void => { const b = new Bartender(C.F, L.clips, pq, 4101 + i * 17, 2); b.grid = C.grid; b.on = false; const kb = keepB[i - 1]; if (kb) { b.s = kb.s; b.on = kb.on; b.section = kb.section; } this.bartenders.push(b); };
      this.sched.run({ who: -100 - i, level: 2, quality: pq, reason: first ? 'fill' : 'switch', run: job }, -1, true);
    }
    for (let i = 1; i < 3; i++) {
      const home: P2 = i === 1 ? [30.6, 11.0] : [26.6, 11.6];
      const job = (): void => { const s = new Server(C.F, C.grid, L.clips, pq, 4207 + i * 22, 2, home); const ks = keepS[i - 1]; if (ks) { s.x = ks.x; s.z = ks.z; s.on = ks.on; } this.servers.push(s); };
      this.sched.run({ who: -110 - i, level: 2, quality: pq, reason: first ? 'fill' : 'switch', run: job }, -1, true);
    }
    const hostOn = this.host?.on ?? false, bbOn = this.barback?.on ?? false;
    this.sched.run({ who: -120, level: 2, quality: pq, reason: first ? 'fill' : 'switch', run: () => { this.host = new Host(C.F, L.clips, pq, 4421, 2); this.host.on = hostOn; } }, -1, true);
    this.sched.run({ who: -121, level: 2, quality: pq, reason: first ? 'fill' : 'switch', run: () => { this.barback = new Barback(C.F, C.grid, L.clips, pq, 4519, 2); this.barback.on = bbOn; } }, -1, true);
    L.bartender.grid = C.grid;
    // the S2a pair and the house player get their LOD 2 now (they were built at LOD 1); the crowd draws them by distance
    [L.bartender.p, L.server.p, L.house.p].forEach((p, i) => this.sched.run({ who: -130 - i, level: 2, quality: pq, reason: first ? 'fill' : 'switch', run: () => { const lvl = p.stats().lod; p.setLod(2); p.setLod(lvl as 0 | 1 | 2); } }, -1, true));
    for (const p of old) { C.scene.remove(p.group); this.disposeBody(p); }
    const recs: StaffRec[] = [];
    let id = -1;
    const add = (role: StaffRec['role'], body: StaffRec['body'], name: string, lod1: boolean) => recs.push({ role, body, id: id--, name, draw: 'off', caster: 0, dist: 0, lod1, stuckT: 0, maxStuck: 0, lastX: body.x, lastZ: body.z });
    this.bartenders.forEach((b, i) => add('bartender', b, `bartender ${i + 1}`, i === 0));
    this.servers.forEach((s, i) => add('server', s, `server ${i + 1}`, i === 0));
    add('host', this.host, 'host', false); add('barback', this.barback, 'barback', false);
    add('house', L.house as unknown as StaffRec['body'], 'house', true);
    for (const s of recs) { if (s.role !== 'house' && s.body.on === undefined) s.body.on = true; C.scene.add(s.body.p.group); this.noCast(s.body.p); }
    this.staff = recs;
    for (const b of this.bartenders) { b.nextEmpty = () => this.takeEmpty(b.x, b.z); }
    this.barback.nextEmpty = () => this.takeEmpty(this.barback.x, this.barback.z);
  }
  private noCast(p: Person) { p.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); }
  /** the nearest empty to (x, z), with a function that takes it (the barback, the bartender's flap trip) */
  private takeEmpty(x: number, z: number) {
    if (!this.empties.length) return null;
    let best = this.empties[0], bd = Infinity;
    for (const e of this.empties) { const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    const f = this.c.grid.nearestFree(best.x, best.z, 2), e = best;
    return { x: f ? f[0] : e.x, z: f ? f[1] : e.z, take: () => { const i = this.empties.indexOf(e); if (i >= 0) this.empties.splice(i, 1); } };
  }

  // ------------------------------------------------------------------------------------------------ the target
  get cap() { return this.c.def.budgets[this.quality].live; }
  /** the target guest count: the capacity x the crowd share (which includes the noise, the events and the featured x1.25) */
  target() { const c = this.c.clock(); return c.open ? Math.round(this.c.def.schedule.capacity * c.share) : 0; }
  get staffOn() { return this.staff.filter((s) => s.body.on).length; }
  get liveGuests() { let n = 0; for (const x of this.npcs) if (x.mode === 'live') n++; return n; }
  get heldGuests() { let n = 0; for (const x of this.npcs) if (x.mode === 'held') n++; return n; }
  get live() { return this.liveGuests + this.staffOn; }
  private guestCap() { return this.cap - staffTotal(this.plan); }
  private hostWanted() {
    const n = this.life.now(), w = this.life.weekNow();
    return this.life.tv.featuredFactor(w, n.day, n.hour) > 1 || this.life.tv.gameNight(w, n.day, n.hour);
  }
  /** the staff plan for the share now, and the preset's drawn staff (Low: at most 5) */
  private applyStaff(enforce = true) {
    const c = this.c.clock(), houseInGame = !!this.life.games && ((!!this.life.games.mine && !this.life.games.vs) || !!this.life.games.houseAt);
    this.plan = staffPlan(c.share, { open: c.open, host: this.hostWanted(), low: this.quality === 'low', houseInGame });
    const want = { bartender: this.plan.bartender, server: this.plan.server, host: this.plan.host, barback: this.plan.barback };
    const fresh = new Set<Bartender>();
    this.bartenders.forEach((b, i) => { const on = i < want.bartender; if (!b.on && on) fresh.add(b); if (b.on && !on) { // off shift: its jobs go to the others
      const jobs = [...(b.job ? [b.job] : []), ...b.queue]; b.job = null; b.queue = []; b.trip = null; b.carry = null; b.on = false; for (const j of jobs) this.bartenderFor(j.forU).order(j.item, j.forU, j.make, j.done); }
      b.on = on; });
    this.servers.forEach((s, i) => { const on = i < want.server; if (s.on && !on) { const jobs = [...(s.job ? [s.job] : []), ...s.queue]; s.job = null; s.queue = []; s.on = false; for (const j of jobs) this.serverFor().add(j); } s.on = on; });
    this.host.on = !!want.host; this.barback.on = !!want.barback;
    if (enforce && this.npcs.length) this.enforceCap();
    // the house player: always on at HD and Ultra while open; at Low only while a game is on (taking the host's place)
    (this.life.house as unknown as { on: boolean }).on = c.open && (this.quality !== 'low' || this.plan.house > 0);
    this.sections(fresh);
  }
  /** more staff on shift than the room had room for: the farthest guests are held, by units, as a switch down holds them */
  private enforceCap() {
    const over = this.live - this.cap; if (over <= 0) return;
    const cp = this.camPoint(), P = { x: cp.x, z: cp.z };
    const cand = this.npcs.filter((n) => n.mode === 'live' && !n.party.yours).sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
    for (let i = 0; i < over && i < cand.length; i++) { if (cand[i].party.leaving) this.removeNpc(cand[i]); else this.hold(cand[i]); }
  }
  /** the counter split among the bartenders on the lane (not one out on a flap trip): equal stretches of u from the
   *  first stool to the server pick-up, so every stool and standing gap is in one section */
  private sections(fresh: Set<Bartender> = new Set()) {
    // in the order they stand along the lane (nobody has to pass anybody); one just on shift starts at its post
    const lane = this.bartenders.filter((b) => b.on && !b.trip && !fresh.has(b)).sort((a, b) => a.s - b.s);
    for (const b of fresh) { if (b.trip) continue; let k = lane.findIndex((x) => x.s > b.s); if (k < 0) k = lane.length; lane.splice(k, 0, b); }
    const u0 = 13.75, u1 = 26.2, n = Math.max(1, lane.length);
    lane.forEach((b, i) => {
      b.section = [u0 + ((u1 - u0) * i) / n, u0 + ((u1 - u0) * (i + 1)) / n];
      if (fresh.has(b)) b.s = Math.max(0, Math.min(12.6, b.post - 14.6));
    });
  }
  bartenderFor(u: number): Bartender {
    const lane = this.bartenders.filter((b) => b.on && !b.trip);
    for (const b of lane) if (u >= b.section[0] - 1e-6 && u <= b.section[1] + 1e-6) return b;
    return lane.length ? lane.reduce((a, b) => (Math.abs(b.post - u) < Math.abs(a.post - u) ? b : a)) : this.bartenders[0];
  }
  serverFor(): Server {
    const on = this.servers.filter((s) => s.on);
    if (!on.length) return this.servers[0];
    return on.reduce((a, b) => ((b.job ? 1 : 0) + b.queue.length < (a.job ? 1 : 0) + a.queue.length ? b : a));
  }

  // ------------------------------------------------------------------------------------------------ people
  private disposeBody(p: Person) {
    this.life.clips.forget(p); this.c.scene.remove(p.group);
    const sk = new Set<THREE.Skeleton>(); p.group.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton) sk.add(m.skeleton); });
    p.dispose(); for (const k of sk) k.dispose();
  }
  private newNpc(party: Party, o: { regular?: Regular; opts?: PersonOptions; t: number }): Npc {
    const id = this.nextId++, r = mulberry(hash32('npc', this.seedN, id));
    const reg = o.regular ?? null;
    // (S4's fourth pass: no body garment in the wearer's own skin colour, dress.ts; the card and the body agree)
    const raw = o.opts ?? (reg ? randomPerson(reg.seed % 100000) : randomPerson(hash32('walkin', this.seedN, id) % 100000)), opts = apartFromSkin(raw);
    if (opts !== raw) this.recoloured.add(opts);
    const featured = this.life.tv.featured(fromAbs(o.t / SECS).week, fromAbs(o.t / SECS).day);
    const n: Npc = {
      id, key: `n${id}`, name: reg ? reg.name : FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)], regular: reg ? reg.key : null,
      opts, look: this.cards.nearestLook(opts),
      traits: reg ? reg.traits : traitsOf(r), needs: startNeeds(r), moodlets: new Moodlets(), team: reg ? reg.team : teamAt(r, o.t / SECS, featured),
      favourites: reg ? reg.favourites : { drink: DRINK_FAVES[Math.floor(r() * 6)], food: FOOD_FAVES[Math.floor(r() * 7)], game: GAME_FAVES[Math.floor(r() * 3)] },
      party, mode: 'live', met: false,
      p: null, q: null, lod1: false,
      x: 0, z: 0, y: 0.15, heading: 0, slot: null, home: null, path: null, pi: 0, goal: null,
      act: null, decideAt: o.t + r() * 20, leavingTo: null,
      hand: { drink: null, food: null }, order: { drink: false, food: false }, orderT: 0,
      clip: null, clipUntil: 0, cheerCardUntil: 0, hiddenUntil: 0,
      stuckT: 0, maxStuck: 0, rescues: 0, lastX: 0, lastZ: 0,
      draw: 'card', caster: 0, dist: 0, speedK: 1, mood: 50, label: 'Fine', emotion: 'Fine', seatedSince: o.t, walkedM: 0,
      grp: null, faceYaw: null, onArrive: null,
    };
    this.npcs.push(n); this.byKey.set(n.key, n); party.members.push(n);
    return n;
  }
  private removeNpc(n: Npc) {
    this.social.gone(n, true);
    this.releaseAll(n);
    // a body kept as a spare forgets its draw state and its clip, so its next applyBody sets its visibility, LOD and
    // casting afresh (a stale 'card' signature would leave a reused body shown under a card)
    if (n.p) { if (this.spares.length < 6 && n.q === this.pq) { n.p.group.visible = false; n.p.group.userData.drawSig = ''; this.life.clips.forget(n.p); this.spares.push({ p: n.p, opts: n.opts, q: n.q }); } else this.disposeBody(n.p); }
    n.p = null;
    const i = this.npcs.indexOf(n); if (i >= 0) this.npcs.splice(i, 1);
    this.byKey.delete(n.key);
    const pi = n.party.members.indexOf(n); if (pi >= 0) n.party.members.splice(pi, 1);
    if (!n.party.members.length) { const k = this.parties.indexOf(n.party); if (k >= 0) this.parties.splice(k, 1); }
    this.dueQ = this.dueQ.filter((x) => x !== n);
  }
  private releaseAll(n: Npc) { this.life.res.releaseAll(n.key); }
  /** a slot's taker, if any: a live or held guest (by reservation), a filler, or you */
  slotTaken(id: string, by?: string) {
    if (this.fillers.has(id)) return true;
    const h = this.life.res.holder(id); if (h && h !== by) return true;
    // a place that's the page's own and not the crowd's (the games' player spots, yours to watch from): by the holder
    // and where you stand only
    const s = this.slots.get(id) ?? this.life.slot(id); if (!s) return true;
    const pl = this.c.player;
    if (s.seatId !== undefined && pl.seat && pl.seat.id === s.seatId) return by !== 'you';
    if (s.seatId === undefined && !pl.seat && Math.hypot(s.x - pl.x, s.z - pl.z) < 0.55 && by !== 'you') return true;
    return false;
  }
  /** a seat is taken (the page's own Sit and tap to sit ask this, so you never sit on someone) */
  seatTaken(seatId: number) { const id = this.seatSlot.get(seatId); if (!id) return false; const h = this.life.res.holder(id); return this.fillers.has(id) || (!!h && h !== 'you'); }
  private seatSlot = new Map<number, string>();
  /** free for this guest: nobody else's, no filler; a table only with nobody from another party at it */
  private freeFor(id: string, n: Npc) {
    if (this.slotTaken(id, n.key) || id === this.life.yourNext) return false;
    const u = this.unitOf.get(id);
    if (u && u.kind === 'table') for (const s of u.slots) {
      if (this.fillers.has(s)) return false;
      const h = this.life.res.holder(s); if (!h || h === n.key) continue;
      const o = this.byKey.get(h); if (!o || o.party !== n.party) return false;
    }
    return true;
  }
  private unitFree(u: Unit, allowFillers: boolean) {
    for (const id of u.slots) { if (this.fillers.has(id) && !allowFillers) return false; const h = this.life.res.holder(id); if (h) return false; if (this.slotTaken(id) && !this.fillers.has(id)) return false; }
    return true;
  }

  // ------------------------------------------------------------------------------------------------ parties
  /** a unit for a party of n: a free table for 2 to 4 (or 1 at a table when nothing else is free), else that many free
   *  singles close together; `fillers` lets it take a unit fillers sit at (they make room). Farthest from you first
   *  when taking fillers' places, nearest the bar's centre otherwise */
  private findUnit(size: number, allowFillers: boolean, r: Rnd, preferOutside = false): { unit: Unit | null; slots: string[] } {
    const pl = this.c.player, list = [...this.units.values()].filter((u) => !u.slots.some((s) => s.startsWith('restroom') || s.startsWith('front walk')) && u.zone !== 'kitchen' && u.zone !== 'host stand' && !u.slots.some((s) => this.slots.get(s)!.kind === 'staff') && !u.slots.some((s) => s.endsWith(' player') || s === 'jukebox spot' || s === 'water'));
    const score = (u: Unit) => (preferOutside ? (u.patio ? 0 : 50) : 0) + r() * 6 + (allowFillers && u.slots.some((s) => this.fillers.has(s)) ? -Math.hypot(u.x - pl.x, u.z - pl.z) * 0.2 : 0);
    const busy = this.c.clock().share >= 0.6;
    // (ours) when the room needs fillers (its target past the guest cap) and the live guests are many (HD's 60 and
    // Ultra's 90, not Low's 31, who leave tables enough), parties of two and three mostly take singles close together,
    // standing spots or stools: a party of two at a table of four leaves two seats nobody can take (no table mixes
    // fillers and live people), so whole tables stay free for fillers and the room reads as full as Low's
    const gcap = this.guestCap(), crowded = busy && this.target() > gcap && gcap > 0.4 * this.c.def.schedule.capacity, packs = crowded && size <= 3;
    if (size >= 2 && size <= 4 && busy && r() < (packs ? 0.75 : 0.35)) {
      const stands = list.filter((u) => u.kind === 'single' && (packs || this.slots.get(u.slots[0])!.kind === 'stand') && u.zone !== 'bar' && this.unitFree(u, allowFillers));
      if (stands.length >= size) {
        const seedU = stands[Math.floor(r() * stands.length)];
        const near = stands.map((u) => ({ u, d: Math.hypot(u.x - seedU.x, u.z - seedU.z) })).sort((a, b) => a.d - b.d).slice(0, size);
        if (near[near.length - 1].d <= 2.6) return { unit: near[0].u, slots: near.map((x) => x.u.slots[0]) };
      }
    }
    if (size >= 2 && size <= 4) {
      const tables = list.filter((u) => u.kind === 'table' && this.unitFree(u, allowFillers)).sort((a, b) => score(a) - score(b));
      if (tables.length) return { unit: tables[0], slots: tables[0].slots.slice(0, size) };
    }
    // singles: standing spots or stools near each other
    const singles = list.filter((u) => u.kind === 'single' && this.unitFree(u, allowFillers));
    if (singles.length < size) {
      if (size === 1) { const t = list.filter((u) => u.kind === 'table' && this.unitFree(u, allowFillers)); if (t.length) return { unit: t[0], slots: [t[0].slots[0]] }; }
      return { unit: null, slots: [] };
    }
    const seedU = singles[Math.floor(r() * singles.length)];
    const near = singles.map((u) => ({ u, d: Math.hypot(u.x - seedU.x, u.z - seedU.z) + (preferOutside && !u.patio ? 40 : 0) })).sort((a, b) => a.d - b.d).slice(0, size);
    if (near[near.length - 1].d > (preferOutside ? 60 : 6) && size > 1) return { unit: null, slots: [] };
    return { unit: near[0].u, slots: near.map((x) => x.u.slots[0]) };
  }
  private clearFillersAt(ids: string[]) { for (const id of ids) { const u = this.unitOf.get(id); if (u) for (const s of u.slots) this.fillers.delete(s); else this.fillers.delete(id); } }
  /** a new party now: regulars when their group comes in at this hour and isn't here, otherwise walk-ins */
  private makeParty(size: number, from: Party['from'], t: number, r: Rnd): Party {
    const party: Party = { id: this.nextParty++, members: [], from, leaving: false, regularGroup: null, group: null, arrivedT: t, stayUntil: t + stayMinutes(r) * SECS, yours: false, unit: null };
    const n = this.life.now(), present = new Set(this.parties.map((p) => p.regularGroup).filter((g) => g !== null));
    const g = this.pool.groups.find((gr) => gr.days.includes(n.day) && n.hour >= gr.from && n.hour < gr.to && !present.has(gr.id) && gr.members.length <= Math.max(size, 2) && r() < 0.35);
    if (g) { party.regularGroup = g.id; for (const i of g.members) this.newNpc(party, { regular: this.pool.regulars[i], t }); }
    else for (let k = 0; k < size; k++) this.newNpc(party, { t });
    this.parties.push(party);
    this.social.partyGroup(party);
    return party;
  }
  /** seat a party at its slots now (a settled room, crowdAt, a filler unit handed over) */
  private seatParty(party: Party, slots: string[], unit: Unit | null) {
    party.unit = unit?.id ?? null;
    party.members.forEach((m, i) => {
      const id = slots[i % slots.length], s = this.slots.get(id)!;
      m.home = id; m.slot = id; this.life.res.reserve(id, m.key, Infinity); this.life.res.use(id, m.key);
      this.placeAt(m, s);
      m.act = this.restAct(m, s); m.decideAt = this.T + this.r() * 20;
    });
  }
  placeAt(n: Npc, s: Slot) {
    const seat = s.seatId !== undefined ? this.c.venue.seats[s.seatId] : null;
    if (seat) { n.x = seat.x; n.z = seat.z; n.y = Math.max(-0.1, seat.y - 0.47); n.heading = seat.face; }
    else { n.x = s.x; n.z = s.z; n.y = this.c.grid.height(s.x, s.z); n.heading = this.F.yawFromFrame(s.face[0], s.face[1]); }
    n.path = null; n.goal = null; n.lastX = n.x; n.lastZ = n.z; n.stuckT = 0;
  }
  /** what someone at a slot does by default: sit, stand and watch, or stand */
  restAct(_n: Npc, s: Slot): Act {
    const seen = this.sees.get(s.id) ?? [];
    const watch = seen.length > 0 && this.c.clock().open;
    const seat = s.seatId !== undefined;
    return { action: watch ? (seat ? 'watch' : 'stand-watch') : seat ? 'sit' : 'stand', object: s.zone, slot: s.id, stage: 'do', t0: this.T, dur: Infinity, continuous: true, tags: watch ? ['watch'] : ['rest'], score: 0, screen: watch ? seen[0] : null, why: 'settled' };
  }

  // ------------------------------------------------------------------------------------------------ settling and seeds
  /** seed(n): the crowd's and the regulars' seed; the room settles again from nothing */
  seed(n: number, first = false) {
    this.seedN = n; this.r = mulberry(hash32('crowd', n));
    this.pool = regularsPool(n);
    for (const x of [...this.npcs]) this.removeNpc(x);
    this.parties = []; this.fillers.clear(); this.empties = [];
    this.social.reset();
    this.applyStaff();
    this.settle(true);
    if (first) this.paintAtlas('fill', true);
    return { seed: n, regulars: this.pool.regulars.length, groups: this.pool.groups.length, live: this.live, fillers: this.fillers.size };
  }
  /** the clock was set: the crowd settles at once (Lot 57's rule): closed, nobody; open, the live guests come to their
   *  target (parties added seated, or the farthest removed), then the fillers */
  settle(reset = false) {
    const c = this.c.clock();
    this.applyStaff();
    if (!c.open) { for (const x of [...this.npcs]) this.removeNpc(x); this.fillers.clear(); this.empties = []; return; }
    const G = this.target(), Lstar = Math.min(G, this.guestCap());
    const pl = this.c.player, r = mulberry(hash32('settle', this.seedN, Math.floor(this.life.T)));
    // the settled guests' drink state draws from its own stream, so it doesn't reshuffle who sits where
    const rd = mulberry(hash32('settle-drinks', this.seedN, Math.floor(this.life.T)));
    // too many: the farthest parties leave
    while (this.liveGuests > Lstar) {
      const far = this.parties.filter((p) => !p.yours).sort((a, b) => this.partyDist(b, pl) - this.partyDist(a, pl))[0];
      if (!far) break;
      for (const m of [...far.members]) this.removeNpc(m);
    }
    void reset;
    // too few: parties settle in, seated
    for (let guard = 0; this.liveGuests < Lstar && guard < 200; guard++) {
      const size = Math.min(partySize(r), Lstar - this.liveGuests);
      const { unit, slots } = this.findUnit(size, true, r);
      if (!slots.length) { if (size === 1) break; continue; }
      this.clearFillersAt(slots);
      const party = this.makeParty(size, 'settled', this.T - r() * 60 * SECS, r);
      while (party.members.length > slots.length) this.removeNpc(party.members[party.members.length - 1]);
      party.stayUntil = this.T + (5 + r() * 75) * SECS;
      this.seatParty(party, slots, unit);
      // (ours) a settled room has been here a while: each guest's thirst is somewhere in the drink cycle and about a
      // quarter are part-way through a drink, so the room's drinks don't all start, and run out, together
      for (const m of party.members) {
        if (rd() < 0.25) { const it = this.npcDrink(m, rd); m.hand.drink = { item: it.id, model: 'glass', color: it.color, left: 1 + Math.floor(rd() * 6), next: this.T + rd() * 60 }; m.needs.thirst = 45 + rd() * 30; }
        else m.needs.thirst = 40 + rd() * 45;
      }
    }
    this.relayFillers();
  }
  private partyDist(p: Party, pl: { x: number; z: number }) { let d = Infinity; for (const m of p.members) d = Math.min(d, Math.hypot(m.x - pl.x, m.z - pl.z)); return d; }

  // ------------------------------------------------------------------------------------------------ fillers
  /** fillers = min(target guests - live guests - held guests, free eligible slots): a table all fillers or none, no
   *  filler within the preset's distance of you (from the overhead's target in overhead), none on a live or held guest's
   *  table. Existing fillers stay where they are while the count allows (they don't jump about) */
  relayFillers() {
    const c = this.c.clock(), want = c.open ? Math.max(0, this.target() - this.liveGuests - this.heldGuests) : 0;
    const P = this.viewPoint();
    const eligibleUnit = this.eligibleFn();
    // drop fillers that broke a rule (a guest took the table, you came near)
    for (const [id, f] of this.fillers) { const u = this.units.get(f.unit); if (!u || !eligibleUnit(u)) this.fillers.delete(id); }
    // too many: the farthest go home first
    if (this.fillers.size > want) {
      const list = [...this.fillers.values()].sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
      for (const f of list) { if (this.fillers.size <= want) break; const u = this.units.get(f.unit)!; if (u.kind === 'table') for (const s of u.slots) this.fillers.delete(s); else this.fillers.delete(f.slot); }
    }
    if (this.fillers.size >= want) return;
    // more: whole free units, in a seeded order (a table's four, or a single), never past `want`
    const free = [...this.units.values()].filter((u) => eligibleUnit(u) && !u.slots.some((s) => this.fillers.has(s)));
    free.sort((a, b) => hash32('fill', this.seedN, a.id.length * 131 + a.x * 7) - hash32('fill', this.seedN, b.id.length * 131 + b.x * 7));
    // tables first take groups of four; when fewer than four are left, singles
    for (const u of free) {
      const left = want - this.fillers.size; if (left <= 0) break;
      if (u.kind === 'table' && left < u.slots.length) continue;
      for (const id of u.slots) this.addFiller(id, u);
    }
  }
  private addFiller(id: string, u: Unit) {
    const s = this.slots.get(id)!, seat = s.seatId !== undefined ? this.c.venue.seats[s.seatId] : null;
    const h = hash32('filler', this.seedN, id.length * 977 + Math.round(s.x * 10) * 31 + Math.round(s.z * 10));
    // S4's second repair (the art review: identical bodies side by side, three brown jackets in a row at the TV wall):
    // the seeded look, moved on to the next of the cards' looks while a filler within 3 m already wears it (a filler
    // keeps its look once placed, so nothing changes under the camera)
    const near: number[] = [];
    for (const g of this.fillers.values()) if (Math.abs(g.x - s.x) < 3 && Math.abs(g.z - s.z) < 3 && Math.hypot(g.x - s.x, g.z - s.z) < 3) near.push(g.look);
    let look = h % LOOKS;
    for (let k = 0; k < LOOKS && near.includes(look); k++) look = (look + 1) % LOOKS;
    const f: Filler = { slot: id, unit: u.id, look, pose: seat ? SEATED : STANDING, yaw: seat ? seat.face : this.F.yawFromFrame(s.face[0], s.face[1]), cheerUntil: 0, x: seat ? seat.x : s.x, y: seat ? Math.max(-0.1, seat.y - 0.47) : this.c.grid.height(s.x, s.z), z: seat ? seat.z : s.z };
    this.fillers.set(id, f);
  }
  /** the point fillers keep their distance from: you, or the overhead's target */
  private viewPoint() { const c = this.c; if (c.view() === 'overhead') { const t = this.life.overheadTarget(); return { x: t.x, z: t.z }; } return { x: c.player.x, z: c.player.z }; }
  /** you came within the distance of a filler's table or spot, or tapped one: that unit is handed to live walk-ins from
   *  the spare bodies, in the same frame; past the cap, the farthest seated, idle table of walk-ins (no regulars, nobody
   *  you've met) becomes fillers first */
  private handOver(u: Unit, tapped: string | null = null): Npc | null {
    const ids = u.slots.filter((s) => this.fillers.has(s)); if (!ids.length) return null;
    const P = this.viewPoint();
    // room under the cap (the farthest seated, idle table of walk-ins to fillers; fewer places, single walk-ins held)
    if (!this.makeRoom(ids.length)) return null;
    void P;
    for (const id of ids) this.fillers.delete(id);
    const r = mulberry(hash32('handover', this.seedN, Math.floor(this.T), ids.length));
    const party = this.makeParty(ids.length, 'filler', this.T, r);
    while (party.members.length > ids.length) this.removeNpc(party.members[party.members.length - 1]);
    while (party.members.length < ids.length) this.newNpc(party, { t: this.T });
    this.social.partyGroup(party);
    // the spare bodies: each new guest takes one (and its look)
    for (const m of party.members) {
      const sp = this.spares.find((x) => x.q === this.pq);
      // (hidden, with no draw state, till this frame's applyBody draws it by its mode: a card leaves it hidden)
      if (sp) { this.spares.splice(this.spares.indexOf(sp), 1); m.p = sp.p; m.q = sp.q; m.opts = sp.opts; m.look = this.cards.nearestLook(sp.opts); m.lod1 = !!sp.p.group.getObjectByName('lod1'); m.p.group.visible = false; m.p.group.userData.drawSig = ''; m.p.group.name = `npc-${m.id}`; m.p.group.userData.group = 'people'; this.c.scene.add(m.p.group); this.noCast(m.p); }
    }
    this.seatParty(party, ids, u);
    const t = tapped ? party.members[ids.indexOf(tapped)] ?? party.members[0] : null;
    return t;
  }
  /** room under the cap for k more live guests: the hand-over's rule (the farthest seated, idle table of live walk-ins,
   *  no regulars and nobody you've met, becomes fillers, their bodies to the spares); then, if that isn't enough, the
   *  farthest such walk-ins are held one by one. False if no room can be made */
  private makeRoom(k: number) {
    const P = this.viewPoint();
    let over = this.liveGuests + k - this.guestCap();
    // a whole table (4) goes to fillers only when that many places are wanted: fewer, and the farthest walk-ins are held
    // one by one, so the live count lands on the cap exactly
    while (over >= 4) {
      const cand = this.parties.filter((p) => !p.yours && p.unit && this.units.get(p.unit)?.kind === 'table' && p.members.every((m) => m.mode === 'live' && !m.regular && !m.met && !m.path && m.slot === m.home && m.slot !== null && this.slots.get(m.slot)?.seatId !== undefined))
        .sort((a, b) => this.partyDist(b, P) - this.partyDist(a, P))[0];
      if (!cand) break;
      const cu = this.units.get(cand.unit!)!;
      for (const m of [...cand.members]) this.removeNpc(m);
      if (cu.fillerOk) for (const s of cu.slots) this.addFiller(s, cu);
      over = this.liveGuests + k - this.guestCap();
    }
    if (over > 0) {
      const walkins = this.npcs.filter((n) => n.mode === 'live' && !n.regular && !n.met && !n.party.yours && !n.party.leaving).sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
      for (const n of walkins) { if (over <= 0) break; this.hold(n); over--; }
    }
    return over <= 0;
  }
  /** held guests near you come back as themselves */
  private unhold(n: Npc) { if (n.mode !== 'held') return; n.mode = 'live'; n.decideAt = this.T + 1; }

  // ------------------------------------------------------------------------------------------------ the sim step
  /** advance the crowd by dS sim seconds (a frame's share, or one fast-forward second) */
  step(dS: number, dtReal: number) {
    const t0 = performance.now();
    const c = this.c.clock();
    this.audits.steps++;
    if (!c.open) { if (this.npcs.length) { for (const x of [...this.npcs]) this.removeNpc(x); this.fillers.clear(); } this.applyStaff(); this.stepStaff(dS, dtReal); this.stepMs = performance.now() - t0; return; }
    // the staff plan follows the share (checked once a sim minute)
    this.capT += dS; if (this.capT >= 60) { this.capT = 0; this.applyStaff(); }
    this.arrivals(dS);
    const now = this.T;
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i]; if (!n || n.mode !== 'live') continue;
      this.stepNpc(n, dS, now);
    }
    this.decisions(now);
    this.social.stepGroups(dS);
    this.social.step(dS);
    this.stepStaff(dS, dtReal);
    this.audit();
    // once a sim minute: how many live guests hold a drink or wait on one
    const D = this.drinkLog; D.sampleT += dS;
    if (D.sampleT >= 60) { D.sampleT = 0; let live = 0, holding = 0, waiting = 0; for (const n of this.npcs) if (n.mode === 'live') { live++; if (n.hand.drink) holding++; else if (n.order.drink) waiting++; } D.samples.push({ t: +(this.T / SECS).toFixed(2), live, holding, waiting }); if (D.samples.length > 600) D.samples.shift(); }
    this.stepMs = performance.now() - t0;
  }
  private drinkHanded(via: 'bar' | 'table', t0: number) { const D = this.drinkLog; D.handed++; D.waits.push({ via, s: +(this.T - t0).toFixed(1) }); if (D.waits.length > 600) D.waits.shift(); }
  /** the drinks' log for the checks: orders, waits (median and the slowest) and the samples of who holds one */
  drinkReport(reset = false) {
    const D = this.drinkLog;
    const w = (via?: 'bar' | 'table') => { const l = D.waits.filter((x) => !via || x.via === via).map((x) => x.s).sort((a, b) => a - b); return l.length ? { n: l.length, median: l[Math.floor(l.length / 2)], max: l[l.length - 1] } : { n: 0, median: null, max: null }; };
    let live = 0, holding = 0, waiting = 0; for (const n of this.npcs) if (n.mode === 'live') { live++; if (n.hand.drink) holding++; else if (n.order.drink) waiting++; }
    const out = { orders: { bar: D.bar, table: D.table }, handed: D.handed, wait: { all: w(), bar: w('bar'), table: w('table') }, now: { live, holding, waiting }, samples: D.samples.slice(), servers: this.servers.filter((s) => s.on).length };
    if (reset) { D.bar = 0; D.table = 0; D.handed = 0; D.waits = []; D.samples = []; D.sampleT = 0; }
    return out;
  }
  private arrivals(dS: number) {
    const now = this.T, Lstar = Math.min(this.target(), this.guestCap());
    // leaving: a party whose stay is up walks out (yours never)
    for (const p of this.parties) if (!p.leaving && !p.yours && now >= p.stayUntil && p.members.every((m) => m.mode === 'live')) this.leave(p);
    // held guests are sent home off screen when their stay is up
    for (const p of [...this.parties]) if (now >= p.stayUntil && p.members.length && p.members.every((m) => m.mode === 'held')) for (const m of [...p.members]) this.removeNpc(m);
    const coming = this.parties.filter((p) => p.from !== 'settled' && p.members.some((m) => m.path && !p.leaving && m.act?.why === 'arriving')).reduce((a, p) => a + p.members.length, 0);
    const deficit = Lstar - (this.liveGuests - this.leavingCount()), room = this.guestCap() - this.liveGuests;
    // Poisson arrivals toward the target (ours: the deficit over about 6 sim minutes, in parties), never past the cap:
    // guests walking out are still live till they're gone
    if (deficit > coming && room > 0) {
      const rate = (deficit - coming) / (6 * MEAN_PARTY) / SECS;            // parties a sim second
      if (this.r() < 1 - Math.exp(-rate * dS)) this.arrive(Math.min(deficit - coming, room, partySize(this.r)));
    }
    // a room at its cap stays at its cap: after 2 sim minutes short, fillers become live walk-ins in place
    if (this.liveGuests < Math.min(this.guestCap(), Lstar) && this.fillers.size) { this.deficitT += dS; if (this.deficitT >= 120) { this.deficitT = 0; this.topUp(); } } else this.deficitT = 0;
    if (Math.floor(now / 5) !== Math.floor((now - dS) / 5)) this.relayFillers();
  }
  private leavingCount() { let n = 0; for (const p of this.parties) if (p.leaving) n += p.members.length; return n; }
  /** a party arrives from the lot or the drop-off and walks in to its unit */
  private arrive(size: number) {
    if (size <= 0) return;
    const r = this.r, { unit, slots } = this.findUnit(size, true, r);
    if (!slots.length) return;
    this.clearFillersAt(slots);
    const from: Party['from'] = r() < 0.75 ? 'lot' : 'dropoff';
    const party = this.makeParty(size, from, this.T, r);
    while (party.members.length > slots.length) this.removeNpc(party.members[party.members.length - 1]);
    party.unit = unit?.id ?? null;
    const F = this.F, start: P2 = from === 'lot' ? F.toLocal(...EXIT_LOT[Math.floor(r() * EXIT_LOT.length)]) : F.fromFrame(...fd(4.6, 6 + r() * 6));
    party.members.forEach((m, i) => {
      const id = slots[i], s = this.slots.get(id)!;
      m.home = id; this.life.res.reserve(id, m.key, Infinity);
      const f = this.c.grid.nearestFree(start[0] + (i % 3) * 0.6, start[1] + Math.floor(i / 3) * 0.6, 4) ?? start;
      m.x = f[0]; m.z = f[1]; m.y = 0; m.lastX = m.x; m.lastZ = m.z;
      m.act = { action: 'arrive', object: s.zone, slot: id, stage: 'walk', t0: this.T, dur: Infinity, continuous: false, tags: [], score: 0, screen: null, why: 'arriving' };
      this.walkToSlot(m, s);
    });
  }
  private leave(p: Party) {
    p.leaving = true;
    const r = mulberry(hash32('leave', p.id)), to: P2 = r() < 0.75 ? this.F.toLocal(...EXIT_LOT[Math.floor(r() * EXIT_LOT.length)]) : this.F.fromFrame(...fd(4.6, 6 + r() * 6));
    for (const m of p.members) {
      if (m.mode !== 'live') continue;
      this.social.gone(m, false);
      this.releaseAll(m); m.slot = null; m.home = null; m.order.drink = m.order.food = false;
      m.act = { action: 'leave', object: 'door', slot: null, stage: 'walk', t0: this.T, dur: Infinity, continuous: false, tags: [], score: 0, screen: null, why: 'stay over' };
      m.leavingTo = to; this.walkTo(m, to);
    }
  }
  /** the room's live count up to the cap from the fillers: whole units, nearest the camera first */
  topUp() {
    const want = Math.min(this.guestCap(), this.target() - this.heldGuests);
    const P = this.viewPoint();
    for (let guard = 0; this.liveGuests < want && guard < 100; guard++) {
      const fs = [...this.fillers.values()].sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
      if (!fs) break;
      const u = this.units.get(fs.unit)!, ids = u.slots.filter((s) => this.fillers.has(s));
      const room = want - this.liveGuests;
      for (const id of ids) this.fillers.delete(id);
      const r = mulberry(hash32('topup', this.seedN, Math.floor(this.T), guard));
      const party = this.makeParty(ids.length, 'filler', this.T, r);
      while (party.members.length > ids.length) this.removeNpc(party.members[party.members.length - 1]);
      while (party.members.length < ids.length) this.newNpc(party, { t: this.T });
      this.social.partyGroup(party);
      this.seatParty(party, ids, u);
      // the last unit overshot: the excess are held, from its seats farthest from the camera
      if (ids.length > room) { const ex = party.members.slice().sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z)).slice(0, ids.length - room); for (const m of ex) m.mode = 'held'; }
    }
  }

  // ------------------------------------------------------------------------------------------------ one guest's step
  private stepNpc(n: Npc, dS: number, now: number) {
    // hidden in the restrooms
    if (n.hiddenUntil > now) return;
    if (n.hiddenUntil && n.hiddenUntil <= now) { n.hiddenUntil = 0; n.needs.bladder = 100; this.finish(n, 'done'); }
    // walking
    const speed = WALK * n.speedK;
    if (n.path) {
      let left = speed * dS;
      while (left > 0 && n.path) {
        const tg = n.path[n.pi], dx = tg[0] - n.x, dz = tg[1] - n.z, d = Math.hypot(dx, dz);
        if (d <= left) { n.x = tg[0]; n.z = tg[1]; left -= d; n.walkedM += d; n.pi++; if (n.pi >= n.path.length) { n.path = null; this.arrived(n); } }
        else { n.x += (dx / d) * left; n.z += (dz / d) * left; n.walkedM += left; n.heading = Math.atan2(dx, dz); left = 0; }
      }
      // (an arrival has already placed them on their seat or spot, at its height)
      if (n.path) n.y = this.c.grid.height(n.x, n.z);
      // the watchdog: no progress toward the target for 30 sim s moves the person to the nearest free cell
      const moved = Math.hypot(n.x - n.lastX, n.z - n.lastZ); n.lastX = n.x; n.lastZ = n.z;
      if (moved < 0.02 * dS) { n.stuckT += dS; n.maxStuck = Math.max(n.maxStuck, n.stuckT); if (n.stuckT > 30) this.rescue(n); } else n.stuckT = 0;
    } else n.stuckT = 0;
    // needs
    const d = this.doing(n);
    const rr = rates(d, n.traits, this._rate);
    if (n.hand.food && n.hand.food.left > 0) { const eat = Math.min(n.hand.food.left, 10 * (dS / SECS)); n.hand.food.left -= eat; rr.hunger = -0.8 + eat / (dS / SECS); }
    advance(n.needs, rr, dS / SECS);
    if (n.act?.action === 'watch-pool') bump(n.needs, { fun: 2 * (dS / SECS) });
    // sips: every 40 to 70 s, +7 thirst (a drink is 6 sips); a finished drink leaves an empty and -8 bladder
    const h = n.hand.drink;
    if (h && now >= h.next && h.left > 0) {
      h.left--; h.next = now + 40 + 30 * this.r(); bump(n.needs, { thirst: 7 });
      if (n.draw === 'lod1' || n.draw === 'lod2') this.play(n, 'drink');
      if (h.left <= 0) { n.needs.bladder = Math.max(0, n.needs.bladder - 8); this.leaveEmpty(n, 'glass'); n.hand.drink = null; }
    }
    if (n.hand.food && n.hand.food.left <= 0) { this.leaveEmpty(n, 'basket'); n.hand.food = null; }
    // moodlets fade; too crowded; the heaters at night
    n.moodlets.prune(now / SECS);
    n.moodlets.hold('too-crowded', this.c.clock().share > 0.9 && n.traits.outgoing < 0.4, now / SECS);
    // the action's own clock
    const a = n.act;
    if (a && a.stage === 'do' && !a.continuous && now - a.t0 >= a.dur) this.finishTimed(n);
    if (a && a.stage === 'wait' && a.action === 'order-drink' && now - a.t0 > 240) this.finish(n, 'waited too long');
    // mood, emotion, walk speed (x0.9 when Low, x1.05 when Excited)
    const mm = moodOf(n.needs, n.traits, n.moodlets.sum(now / SECS));
    n.mood = mm; n.label = moodLabel(mm);
    n.emotion = emotionOf({ needs: n.needs, traits: n.traits, mood: mm, now: now / SECS, teamMomentAt: n.teamMomentAt, teamLostAt: n.teamLostAt, inGoodConversation: mm >= 45 && this.social.inConversation(n) });
    n.speedK = n.label === 'Low' ? 0.9 : n.emotion === 'Excited' ? 1.05 : 1;
    if (n.clip && now >= n.clipUntil) n.clip = null;
    // due a decision: at an action's end, or every 20 sim s in a continuous one
    if (!n.path && !n.party.leaving && (n.act === null || (n.act.continuous && now >= n.decideAt)) && !this.dueQ.includes(n)) this.dueQ.push(n);
  }
  private _rate = {} as Record<'hunger' | 'thirst' | 'fun' | 'social' | 'energy' | 'bladder', number>;
  private _doing: Doing = { posture: 'stand' };
  private doing(n: Npc): Doing {
    const d = this._doing, a = n.act, s = n.slot ? this.slots.get(n.slot) : null;
    d.posture = n.path ? 'walk' : s && s.seatId !== undefined ? 'sit' : 'stand';
    let fun: FunKind | undefined; d.match = 1; d.watchers = 3;
    if (a && a.stage === 'do' && !n.path) {
      if (a.action === 'watch' || a.action === 'stand-watch') { fun = 'watch'; d.match = a.screen ? this.life.matchFactor(a.screen) : 1; }
      else if (a.action === 'dance') fun = 'dance';
      else if (a.action === 'people-watch') fun = 'people-watch';
      else if (a.action === 'watch-freeway') fun = 'freeway';
      else if (a.action === 'chat' || a.action === 'lean-chat' || a.action === 'group') fun = 'conversation';
      else if (a.action === 'song') fun = 'music';
      else if (a.action === 'game') { const k = this.life.games?.kindOf(a.object); if (k) fun = k; }
    }
    const inGroup = this.social.inConversation(n);
    if (!fun && inGroup) fun = 'conversation';
    d.fun = fun; d.inGroup = inGroup; d.eating = !!n.hand.food && n.hand.food.left > 0;
    return d;
  }
  private rescue(n: Npc) {
    const f = this.c.grid.nearestFree(n.x, n.z, 6);
    if (f) { n.x = f[0]; n.z = f[1]; }
    n.rescues++; n.stuckT = 0;
    this.logDecision({ t: +(this.T / SECS).toFixed(3), npc: n.key, name: n.name, watchdog: true, why: 'no progress for 30 sim s: moved to the nearest free cell, planning again' });
    const goal = n.goal; n.path = null;
    if (goal) this.walkTo(n, goal); else this.finish(n, 'watchdog');
  }
  walkTo(n: Npc, to: P2) {
    const p = this.c.grid.path(n.x, n.z, to[0], to[1]);
    n.path = p && p.length ? [...p, to] : [to]; n.pi = 0; n.goal = to; n.lastX = n.x; n.lastZ = n.z;
    // standing up from a seat
    if (n.slot && n.slot !== n.home) { this.life.res.release(n.slot, n.key); }
    n.slot = null;
    return !!p;
  }
  walkToSlot(n: Npc, s: Slot) { const seat = s.seatId !== undefined ? this.c.venue.seats[s.seatId] : null; return this.walkTo(n, seat ? [seat.ax, seat.az] : [s.x, s.z]); }
  private arrived(n: Npc) {
    const a = n.act;
    if (n.party.leaving) { this.removeNpc(n); return; }
    if (a && (a.action === 'interact' || a.action === 'game')) { this.social.arrived(n); return; }
    if (!a || !a.slot) { if (a) this.finish(n, 'arrived'); return; }
    const s = this.slots.get(a.slot)!;
    this.placeAt(n, s); n.slot = s.id; this.life.res.use(s.id, n.key); n.seatedSince = this.T;
    if (a.action === 'arrive') { n.act = this.restAct(n, s); n.decideAt = this.T + 5 + this.r() * 15; if (this.host?.on && Math.hypot(this.host.x - n.x, this.host.z - n.z) < 12) this.host.greet(n.x, n.z); return; }
    a.stage = 'do'; a.t0 = this.T;
    switch (a.action) {
      case 'order-drink': case 'order-food': this.barOrder(n, a.action === 'order-drink' ? 'drink' : 'food'); break;
      case 'restroom': n.hiddenUntil = this.T + (60 + 60 * this.r()); break;
      case 'dance': this.play(n, DANCES[Math.floor(this.r() * 3)], a.dur); break;
    }
  }
  private finishTimed(n: Npc) {
    const a = n.act!;
    if (a.action === 'interact') { this.social.resolve(n); return; }
    if (a.action === 'water') bump(n.needs, { thirst: 20 });
    if (a.action === 'song') bump(n.needs, { fun: 6 });
    this.finish(n, 'done');
  }
  /** the action's over: back to the queue (a decision comes next) */
  finish(n: Npc, why: string) {
    const a = n.act;
    if (a && a.slot && a.slot !== n.home && n.slot !== a.slot) this.life.res.release(a.slot, n.key);
    if (a?.action === 'dance' && n.p) this.life.clips.stop(n.p);
    n.act = null; n.decideAt = this.T;
    void why;
  }

  // ------------------------------------------------------------------------------------------------ ordering
  /** at the counter: the bartender for this stretch makes it in 4 to 8 s and hands it over; food goes to the kitchen and
   *  a server brings it */
  private barOrder(n: Npc, kind: 'drink' | 'food') {
    const [u] = this.F.toFrame(n.x, n.z), r = this.r;
    n.order[kind] = true; n.orderT = this.T;
    if (kind === 'drink') {
      const it = this.npcDrink(n), t0 = this.T;
      n.act!.stage = 'wait'; this.drinkLog.bar++;
      this.bartenderFor(u).order(it.id, u, 4 + 4 * r(), () => { if (!this.byKey.has(n.key)) return; this.give(n, it.id, 'glass', it.color, 6); this.drinkHanded('bar', t0); n.order.drink = false; if (n.act && n.act.action === 'order-drink') this.finish(n, 'handed over'); });
    } else {
      const it = this.npcFood(n);
      this.finish(n, 'ordered');
      const ready = this.T + 60 + 120 * r();
      this.kitchen(n, it.id, ready);
    }
  }
  private npcDrink(n: Npc, r: Rnd = this.r) { const fav = itemById(n.favourites.drink); return r() < 0.35 ? { id: 'pint', color: 0xd8a040 } : fav && fav.kind === 'drink' ? { id: fav.id, color: fav.color } : { id: DRINKS[0].id, color: DRINKS[0].color }; }
  private npcFood(n: Npc) { const fav = itemById(n.favourites.food); return fav && fav.kind === 'food' ? { id: fav.id, color: fav.color } : { id: FOODS[0].id, color: FOODS[0].color }; }
  /** food: the kitchen's 60 to 180 s, the cooks' plate up at the pass, then a server brings it */
  private kitchen(n: Npc, item: string, ready: number) {
    n.order.food = true;
    const sv = this.serverFor(), pass = sv.pass;
    const wait = (): void => {
      if (!this.byKey.has(n.key)) { n.order.food = false; return; }
      if (this.T < ready) { sv.add({ kind: 'deliver', label: 'wait at the pass', delay: Math.max(1, ready - this.T), to: () => pass, arrive: wait }, true); return; }
      this.plates.push({ x: pass[0], z: pass[1], until: this.T + 6 });
      sv.carry = item;
      sv.add({ kind: 'deliver', label: 'bring food', to: () => this.beside(n), arrive: () => { sv.carry = null; if (this.byKey.has(n.key)) { const it = itemById(item); this.give(n, item, 'basket', it?.color ?? 0xd8a444, 0, it?.deltas.hunger ?? 45); } n.order.food = false; } }, true);
    };
    sv.add({ kind: 'deliver', label: 'to the pass', delay: 2, to: () => pass, arrive: wait });
  }
  /** table service: a server comes, takes the order in 8 s, fetches it (the bar's pick-up or the pass) and brings it */
  private tableOrder(n: Npc, kind: 'drink' | 'food') {
    n.order[kind] = true; n.orderT = this.T;
    const t0 = this.T; if (kind === 'drink') this.drinkLog.table++;
    const sv = this.serverFor(), share = this.c.clock().share;
    const delay = Math.max(0, 30 + 60 * clamp(share, 0, 1) - sv.walkSeconds(this.beside(n)));
    sv.add({ kind: 'take', label: 'take an order', delay, to: () => this.beside(n), arrive: () => {
      if (!this.byKey.has(n.key)) return;
      sv.face(n.x, n.z);
      if (kind === 'drink') {
        const it = this.npcDrink(n);
        sv.add({ kind: 'deliver', label: 'fetch', delay: 8, to: () => sv.pickup, arrive: () => {
          this.bartenderFor(26.15).order(it.id, 26.15, 4 + 4 * this.r(), () => { sv.carry = it.id; sv.add({ kind: 'deliver', label: 'bring', to: () => this.beside(n), arrive: () => { sv.carry = null; if (this.byKey.has(n.key)) { this.give(n, it.id, 'glass', it.color, 6); this.drinkHanded('table', t0); } n.order.drink = false; } }, true); });
        } }, true);
      } else { const it = this.npcFood(n); this.kitchen(n, it.id, this.T + 8 + 60 + 120 * this.r()); }
    } });
  }
  beside(n: Npc): P2 { const s = n.slot ? this.slots.get(n.slot) : null, seat = s && s.seatId !== undefined ? this.c.venue.seats[s.seatId] : null; const [x, z] = seat ? [seat.ax, seat.az] : [n.x + 0.7, n.z]; const f = this.c.grid.nearestFree(x, z, 2); return f ? [f[0], f[1]] : [x, z]; }
  give(n: Npc, item: string, model: 'glass' | 'basket', color: number, sips: number, food = 45) {
    if (model === 'glass') n.hand.drink = { item, model, color, left: sips, next: this.T + 20 }; else { n.hand.food = { item, model, color, left: food, next: this.T + 20 }; bump(n.needs, { energy: 5 }); if (item === n.favourites.food) n.moodlets.add('good-food', this.T / SECS); }
  }
  private leaveEmpty(n: Npc, model: 'glass' | 'basket') {
    // on the nearest table surface within 3 m, else it's carried till one comes (ours: set down where they are)
    const sf = this.life.surfacesNear(n.x, n.z, 3);
    if (sf) this.empties.push({ x: sf[0], y: sf[1], z: sf[2], yaw: (n.id * 1.7) % 6.28, model });
    if (this.empties.length > 60) this.empties.shift();
  }

  // ------------------------------------------------------------------------------------------------ decisions
  private decisions(now: number) {
    // at most 6 a step, staggered round the room
    let k = 0;
    const t0 = performance.now();
    while (this.dueQ.length && k < 6) {
      const n = this.dueQ.shift()!; if (!this.byKey.has(n.key) || n.mode !== 'live' || n.path || n.hiddenUntil > now) continue;
      this.decideFor(n, now); k++;
    }
    if (k) { this.decideMs.push(performance.now() - t0); if (this.decideMs.length > 400) this.decideMs.shift(); }
  }
  /** what an object type's adverts give this person (deltas already in their terms) */
  private cands(n: Npc): Cand[] {
    const out: Cand[] = [], cur = n.act, open = this.c.clock().open;
    const night = this.life.tv.gameNight(this.life.weekNow(), this.life.now().day, this.life.now().hour);
    const holdingDrink = !!n.hand.drink || n.order.drink, holdingFood = !!n.hand.food || n.order.food;
    const at = n.slot ? this.slots.get(n.slot) ?? null : null, seated = !!at && at.seatId !== undefined;
    const fanK = 0.6 + 0.8 * n.traits.fan;
    // leaving a conversation mid-turn: the speaker's adverts elsewhere take -25
    const midTurn = this.social.talking(n);
    // the current continuous action (walk 0)
    if (cur && cur.continuous && cur.stage === 'do') out.push(this.currentCand(n)!);
    const dist = (s: Slot) => (at && at.id === s.id ? 0 : Math.hypot(s.x - n.x, s.z - n.z) * 1.3);
    const nearestFree = (ids: string[], filter?: (s: Slot) => boolean): Slot | null => {
      let best: Slot | null = null, bd = Infinity;
      for (const id of ids) { const s = this.slots.get(id); if (!s || (filter && !filter(s))) continue; if (id === this.life.yourNext || (s.id !== n.slot && !this.freeFor(id, n))) continue; const d = dist(s); if (d < bd) { bd = d; best = s; } }
      return best;
    };
    for (const T of Object.values(TYPES)) {
      const objs = this.life.objects.filter((o) => o.type === T.type);
      for (const A of T.adverts) {
        if (A.requires?.includes('open') && !open) continue;
        if (A.requires?.includes('gameNight') && !night) continue;
        // S3b: a play advert is for a free spot of its kind (the guest invites a partner when they choose it)
        if (A.action.startsWith('play-')) {
          const kind = A.action.slice(5) as 'pool' | 'darts' | 'shuffleboard', spot = this.social.games.freeFor(kind, false); if (!spot) continue;
          const sp = this.life.games.spot(spot)!, [sx, sz] = sp.startW;
          out.push({ key: `${spot}:${A.action}`, action: A.action, object: spot, slot: null, deltas: { ...A.deltas }, tags: A.tags, walk: Math.hypot(sx - n.x, sz - n.z) * 1.3, occupancy: 0, wait: 0, favourite: n.favourites.game === kind });
          continue;
        }
        if (A.action === 'watch-pool' && !this.poolGameOn()) continue;                      // a game on at a table: yours or guests'
        const isOrder = A.action === 'order-drink' || A.action === 'order-food';
        if (isOrder && (A.action === 'order-drink' ? holdingDrink : holdingFood)) continue;
        if (A.action === 'eat' && !n.hand.food) continue;
        let slot: Slot | null = null, obj = objs[0]?.id ?? T.type, overlay = false;
        if (isOrder && T.type !== 'bar-counter') {
          // table service: an overlay at the table you're seated at
          if (!seated || !at || !objs.some((o) => o.slots.includes(at.id))) continue;
          overlay = true; slot = at; obj = objs.find((o) => o.slots.includes(at.id))!.id;
        } else if (isOrder) {
          const bar = objs[0]; if (!bar) continue;
          if (at && bar.slots.includes(at.id)) { overlay = true; slot = at; } else slot = nearestFree(bar.slots);
          obj = bar.id;
        } else if (A.action === 'watch' || A.action === 'stand-watch') {
          const pool = T.type === 'screen' ? [...this.slots.keys()].filter((id) => (this.sees.get(id) ?? []).length && !id.startsWith('restroom') && !id.startsWith('front walk') && this.slots.get(id)!.kind !== 'staff' && !id.endsWith(' player') && id !== 'jukebox spot' && id !== 'water')
            : objs.flatMap((o) => o.slots).filter((id) => (this.sees.get(id) ?? []).length);
          slot = nearestFree(pool); if (slot) obj = objs.find((o) => o.slots.includes(slot!.id))?.id ?? (T.type === 'screen' ? `screen-${this.sees.get(slot.id)![0]}` : obj);
        } else if (A.action === 'water') slot = nearestFree(['water']);
        else if (A.action === 'song') slot = nearestFree(['jukebox spot']);
        else if (A.action === 'restroom') slot = nearestFree(['restroom 1', 'restroom 2']);
        else if (A.action === 'dance') slot = nearestFree(DANCE_SLOTS);
        else if (A.action === 'chat') {
          // with the table: only at your own table with your party there
          if (!n.home || !this.inGroupAtHome(n)) continue;
          slot = this.slots.get(n.home) ?? null; obj = objs.find((o) => o.slots.includes(n.home!))?.id ?? obj;
        } else if (A.action === 'watch-pool') slot = nearestFree(this.poolWatchSlots());
        else {
          // sit, eat, people-watch, the freeway: a free seat (your own seat at home first)
          const seats = objs.flatMap((o) => o.slots).filter((id) => this.slots.get(id)?.seatId !== undefined);
          slot = n.home && seats.includes(n.home) ? this.slots.get(n.home)! : nearestFree(seats);
          if (slot) obj = objs.find((o) => o.slots.includes(slot!.id))?.id ?? obj;
        }
        if (!slot && !overlay) continue;
        if (cur && cur.continuous && cur.action === A.action && cur.slot === slot?.id) continue;   // the current one is in already
        const deltas = A.minutes === 'continuous' ? this.contDeltas(A.action, n, slot ? this.sees.get(slot.id)?.[0] ?? null : null, !!slot && slot.seatId !== undefined) : { ...A.deltas };
        if (A.action === 'watch' || A.action === 'stand-watch') { if (deltas.fun) deltas.fun *= 1; }
        const wait = isOrder ? (A.wait ? (A.wait[0] + A.wait[1]) / 2 : 0) : 0;
        const occ = T.type === 'bar-counter' || T.type === 'standing-floor' || T.type === 'dance-spot' ? this.occupancy(objs[0]?.slots ?? [], n) : 0;
        const fav = (A.tags.includes('drink') && n.favourites.drink !== '') || false;
        const screen = slot ? this.sees.get(slot.id)?.[0] ?? null : null;
        out.push({ key: `${obj}:${A.action}`, action: A.action, object: obj, slot: slot?.id ?? null, deltas, tags: A.tags, overlay, walk: overlay ? 0 : slot ? dist(slot) : 0, occupancy: occ, wait, favourite: fav && false, continuous: A.minutes === 'continuous', featuredScreen: (A.action === 'watch' || A.action === 'stand-watch') && !!screen && this.life.matchFactor(screen) > 1, leavesMidTurn: midTurn && !!slot && slot.id !== n.slot });
        void fanK;
      }
    }
    // S3b: the people present advertise (at most 8 of them, 6 interactions each)
    this.social.personAdverts(n, out);
    return out;
  }
  /** the current continuous action as an advert (walk 0): what it gives over the 5 sim-minute window */
  currentCand(n: Npc): Cand | null {
    const cur = n.act; if (!cur || !cur.continuous || cur.stage !== 'do') return null;
    const s = cur.slot ? this.slots.get(cur.slot) : null;
    return { key: 'current', action: cur.action, object: cur.object, slot: cur.slot, deltas: this.contDeltas(cur.action, n, cur.screen, !!s && s.seatId !== undefined), tags: cur.tags, walk: 0, occupancy: 0, wait: 0, current: true, continuous: true, featuredScreen: !!cur.screen && this.life.matchFactor(cur.screen) > 1 };
  }
  /** a pool game on at a table (yours or guests') */
  private poolGameOn() { const G = this.life.games; if (!G) return false; for (const s of G.spots) if (s.kind === 'pool' && (s.mine || s.npcBusy)) return true; return false; }
  private inGroupAtHome(n: Npc) { if (!n.home) return false; for (const m of n.party.members) if (m !== n && m.mode === 'live' && m.slot === m.home && !m.path) return true; return false; }
  private poolWatchSlots() { const G = this.life.games, t = G?.mine?.kind === 'pool' ? G.mine.id : G?.spots.find((s) => s.kind === 'pool' && s.npcBusy)?.id; const u = t === 'pool-1' ? POOL_TABLES[0][0] : POOL_TABLES[1][0]; return [...this.slots.values()].filter((s) => s.zone === 'pool' && s.kind === 'stand' && s.id.startsWith('pool watcher') && Math.abs(s.at[0] - u) < 4.2).map((s) => s.id); }
  private occupancy(ids: string[], n: Npc) { if (!ids.length) return 0; let k = 0; for (const id of ids) if (this.slotTaken(id, n.key)) k++; return k / ids.length; }
  /** a continuous advert's deltas in this person's terms over the 5 sim-minute window */
  private contDeltas(action: string, n: Npc, screen: string | null, seated: boolean): Partial<Record<'hunger' | 'thirst' | 'fun' | 'social' | 'energy' | 'bladder', number>> {
    const W = 5;
    if (action === 'watch' || action === 'stand-watch') { const m = screen ? this.life.matchFactor(screen) : 1; return { fun: 2.5 * m * (0.6 + 0.8 * n.traits.fan) * W, social: 1 * W, energy: (seated ? 0.8 : -0.4) * W }; }
    if (action === 'sit' || action === 'eat') return action === 'eat' ? { hunger: 10 * W, energy: 0.8 * W } : { energy: 0.8 * W };
    if (action === 'people-watch') return { fun: 0.8 * W, energy: 0.8 * W };
    if (action === 'watch-freeway') return { fun: 1 * W, energy: 0.8 * W };
    if (action === 'stand') return { energy: -0.4 * W };
    // S3b: standing (or sitting) in a group: a conversation's rates (social +4, fun +1 a minute)
    if (action === 'group') return { social: 4 * W, fun: 1 * W, energy: (seated ? 0.8 : -0.4) * W };
    return {};
  }
  private decideFor(n: Npc, now: number) {
    // S3b: a guest's own rule for buying a round comes first
    if (this.social.npcRound(n)) { n.decideAt = now + 20; return; }
    const cs = this.cands(n);
    const r = mulberry(hash32('decide', n.id, Math.floor(now)));
    const dcs: Decision = decide(cs, { needs: n.needs, traits: n.traits, emotion: n.emotion }, r);
    let objectAds = 0, personAds = 0; for (const c of cs) { if (c.inter || c.action === 'group') personAds++; else objectAds++; }
    n.decideAt = now + 20;
    const holdingDrink = !!n.hand.drink, waitingDrink = n.order.drink, waitingFood = n.order.food;
    this.logDecision({ t: +(now / SECS).toFixed(3), npc: n.key, name: n.name, needs: Object.fromEntries(NEEDS.map((k) => [k, +n.needs[k].toFixed(1)])), emotion: n.emotion, holdingDrink, waitingDrink, urgent: dcs.urgent,
      top: dcs.top.map((s) => ({ action: s.c.action, object: s.c.object, score: +s.score.toFixed(2), tags: s.c.tags })), chosen: dcs.chosen ? { action: dcs.chosen.c.action, object: dcs.chosen.c.object, tags: dcs.chosen.c.tags, score: +dcs.chosen.score.toFixed(2), raises: Object.keys(dcs.chosen.c.deltas).filter((k) => (dcs.chosen!.c.deltas[k as 'fun'] ?? 0) > 0) } : null, kept: dcs.kept,
      overlay: dcs.overlay ? { action: dcs.overlay.c.action, object: dcs.overlay.c.object, score: +dcs.overlay.score.toFixed(2), tags: dcs.overlay.c.tags, raises: Object.keys(dcs.overlay.c.deltas).filter((k) => (dcs.overlay!.c.deltas[k as 'fun'] ?? 0) > 0) } : null, cands: cs.length, holdingFood: !!n.hand.food, waitingFood,
      people: this.social.lastAds.people, adverts: { objects: objectAds, people: personAds, total: cs.length }, inter: dcs.chosen?.c.inter ?? null, target: dcs.chosen?.c.target ?? null });
    this.social.logAds(n, { objects: objectAds, people: personAds, total: cs.length });
    // the overlay first (table service, the counter's order)
    if (dcs.overlay) {
      const o = dcs.overlay.c;
      if (o.action === 'order-drink' || o.action === 'order-food') {
        const kind = o.action === 'order-drink' ? 'drink' : 'food';
        if (o.object === 'bar') { const keep = n.act; n.act = { action: o.action, object: 'bar', slot: n.slot, stage: 'do', t0: now, dur: Infinity, continuous: false, tags: o.tags, score: dcs.overlay.score, screen: null, why: 'overlay' }; this.barOrder(n, kind); if (kind === 'food' && keep) n.act = keep; }
        else this.tableOrder(n, kind);
      }
    }
    const ch = dcs.chosen; if (!ch || dcs.kept) { if (!n.act && n.slot) { const s = this.slots.get(n.slot)!; n.act = this.restAct(n, s); } return; }
    this.start(n, ch.c, ch.score);
  }
  private start(n: Npc, c: Cand, score: number) {
    if (c.action === 'interact') { this.social.begin(n, c, score); return; }
    if (c.action.startsWith('play-')) { this.social.games.invite(n, c); return; }
    this.social.leavingFor(n, c.slot);
    const A = this.advertOf(c.action);
    const r = this.r;
    const dur = A && A.minutes !== 'continuous' ? (A.minutes[0] + (A.minutes[1] - A.minutes[0]) * r()) * SECS : Infinity;
    // release what you were in (your home seat stays yours)
    const prev = n.act; if (prev && prev.slot && prev.slot !== n.home && prev.slot !== c.slot) this.life.res.release(prev.slot, n.key);
    const screen = c.slot ? this.sees.get(c.slot)?.[0] ?? null : null;
    n.act = { action: c.action, object: c.object, slot: c.slot, stage: 'walk', t0: this.T, dur, continuous: !!c.continuous, tags: c.tags, score, screen, why: 'decided' };
    n.decideAt = this.T + 20;
    if (c.slot && c.slot === n.slot) { n.act.stage = 'do'; if (c.action === 'restroom') n.hiddenUntil = this.T + 60 + 60 * r(); if (c.action === 'dance') this.play(n, DANCES[Math.floor(r() * 3)], dur); return; }
    if (!c.slot) { n.act.stage = 'do'; return; }
    const s = this.slots.get(c.slot)!;
    const reserveFor = Math.hypot(s.x - n.x, s.z - n.z) * 1.3 / WALK + 10;
    if (!this.life.res.reserve(c.slot, n.key, c.slot === n.home ? Infinity : this.T + reserveFor)) { this.finish(n, 'taken'); return; }
    this.walkToSlot(n, s);
  }
  private advertOf(action: string): Advert | null { for (const T of Object.values(TYPES)) { const a = T.adverts.find((x) => x.action === action); if (a) return a; } return null; }
  private logDecision(d: unknown) { this.decisionLog.push(d); if (this.decisionLog.length > 3000) this.decisionLog.shift(); }

  // ------------------------------------------------------------------------------------------------ groups and lines (social.ts)
  laughs: Record<string, unknown>[] = [];

  // ------------------------------------------------------------------------------------------------ the screens: reactions
  /** a moment on a screen: everyone who can see a screen on that channel reacts, after a staggered 0.2 to 0.7 s */
  moment(e: TvEvent, gameNightFinal: boolean) {
    const f = this.life.fixtureOf(e); if (!f) return;
    this.social.moment(e);
    const ch = e.channel, now = this.T;
    // game night begins at this whistle: the dance floor's spots are cleared of fillers first
    if (gameNightFinal) this.relayFillers();
    const sc = (id: string) => this.life.channelAt(id, e.t - 0.5 / SECS) === ch;
    for (const n of this.npcs) {
      if (n.mode !== 'live' || n.hiddenUntil > now) continue;
      const can = this.canSee(n, sc);
      const supports = n.team === null ? 'neutral' : n.team === e.team ? 'for' : n.team === f.home.abbr || n.team === f.away.abbr ? 'against' : 'neutral';
      const r = mulberry(hash32('react', n.id, Math.floor(e.t * 60), e.kind.length));
      const delay = 0.2 + 0.5 * r();
      const rec: Record<string, unknown> = { t: +e.t.toFixed(3), kind: e.kind, team: e.team, fixture: e.fixture, npc: n.key, supports, canSee: can, reacted: false, delay: +delay.toFixed(2), clip: null, lod: n.draw, fan: +n.traits.fan.toFixed(3), p: 0 };
      if (!can) { this.pushReaction(rec); continue; }
      if (e.kind === 'final') {
        if (supports === 'for') { n.moodlets.add('team-won', now / SECS); n.teamMomentAt = now / SECS;
          // the direct chance at the featured final whistle on Friday and Saturday
          if (gameNightFinal && f.featured && n.traits.active > 0.4 && n.needs.fun < 70) { const p = 0.5 * n.traits.active; rec.p = p; if (r() < p) { if (this.danceNow(n, delay)) { rec.reacted = true; rec.clip = 'dance'; this.dances.push({ t: +e.t.toFixed(3), npc: n.key, active: +n.traits.active.toFixed(3), fun: +n.needs.fun.toFixed(1), canSee: can, winner: true }); } else this.dances.push({ t: +e.t.toFixed(3), npc: n.key, noSpot: true }); } } }
        else if (supports === 'against') { n.moodlets.add('team-lost', now / SECS); n.teamLostAt = now / SECS; }
        this.pushReaction(rec); continue;
      }
      if (e.kind !== 'goal' && e.kind !== 'td' && e.kind !== 'fg' && e.kind !== 'bigChance') { this.pushReaction(rec); continue; }
      const big = e.kind === 'bigChance';
      if (supports === 'neutral') { rec.p = 0.25; if (r() < 0.25) { rec.reacted = true; rec.clip = 'clap'; this.react(n, 'clap', delay, CLIP_SECONDS.clap as number); } }
      else if (!big) {
        const p = 0.3 + 0.7 * n.traits.fan; rec.p = p;
        if (supports === 'for') { n.moodlets.add('goal-for', now / SECS); n.teamMomentAt = now / SECS; } else { n.moodlets.add('goal-against', now / SECS); n.teamMomentAt = now / SECS; }
        if (r() < p) { rec.reacted = true; const clip: ClipName = supports === 'for' ? 'cheer' : 'groan'; rec.clip = clip; this.react(n, clip, delay, supports === 'for' ? 0.8 + 1.7 * r() : 1 + r()); }
      }
      this.pushReaction(rec);
    }
    // fillers who can see a screen on that channel: the cheering cell for 1.5 s, p 0.4
    if (e.kind === 'goal' || e.kind === 'td' || e.kind === 'fg') for (const fl of this.fillers.values()) {
      const seen = this.sees.get(fl.slot) ?? []; if (!seen.some(sc)) continue;
      const r = mulberry(hash32('fillcheer', fl.slot.length * 17 + Math.round(fl.x * 10), Math.floor(e.t * 60)));
      if (r() < 0.4) fl.cheerUntil = now + 0.2 + 0.5 * r() + 1.5;
    }
  }
  private pushReaction(r: Record<string, unknown>) { this.reactions.push(r); if (this.reactions.length > 4000) this.reactions.shift(); }
  private canSee(n: Npc, onChannel: (id: string) => boolean) {
    if (n.slot && !n.path) return (this.sees.get(n.slot) ?? []).some(onChannel);
    return SCREENS.some((s) => onChannel(s.id) && this.life.screenInView(s.id, n.x, n.z, null));
  }
  /** a reaction in front of the current action: the clip, then the action resumes */
  private react(n: Npc, clip: ClipName, delay: number, seconds: number) {
    // S4: the reaction's sound (audio.ts sums a frame's reactions into one swell, its level by how many reacted)
    if (clip === 'cheer' || clip === 'groan' || clip === 'clap') sfx(clip, n.x, n.z, 1, delay);
    n.clip = clip; n.clipUntil = this.T + delay + seconds;
    if (clip === 'cheer') n.cheerCardUntil = this.T + delay + seconds;
    const at = this.T + delay;
    this.pendingClips.push({ n, clip, at, seconds, jump: clip === 'cheer' && n.traits.active > 0.6 ? 0.1 : 0 });
  }
  private pendingClips: { n: Npc; clip: ClipName; at: number; seconds: number; jump: number }[] = [];
  private danceNow(n: Npc, delay: number) {
    const s = this.freeDanceSlot(n);
    if (!s) return false;
    const A = this.advertOf('dance')!, dur = (A.minutes as [number, number])[0] * SECS + this.r() * 2 * SECS;
    this.start(n, { key: 'dance-spot:dance', action: 'dance', object: 'dance-spot', slot: s, deltas: A.deltas, tags: A.tags, walk: 0, occupancy: 0, wait: 0 }, 0);
    if (n.act) { n.act.dur = dur; n.act.why = 'final whistle'; n.act.t0 = this.T + delay; }
    return true;
  }
  private freeDanceSlot(n: Npc) { let best: string | null = null, bd = Infinity; for (const id of DANCE_SLOTS) { if (!this.freeFor(id, n)) continue; const s = this.slots.get(id)!; const d = Math.hypot(s.x - n.x, s.z - n.z); if (d < bd) { bd = d; best = id; } } return best; }
  play(n: Npc, clip: ClipName, seconds?: number) { if (!n.p) return; const seated = !!n.slot && this.slots.get(n.slot)?.seatId !== undefined; this.life.clips.play(n.p, clip, { upper: seated || clip === 'drink' || clip === 'eat', seconds: seconds && Number.isFinite(seconds) ? seconds / 1 : undefined }); this.clipLog.push({ t: +(this.T / SECS).toFixed(3), npc: n.key, clip, lod: n.p.stats().lod, draw: n.draw }); if (this.clipLog.length > 2000) this.clipLog.shift(); }
  clipLog: Record<string, unknown>[] = [];

  // ------------------------------------------------------------------------------------------------ the staff's step
  private houseGame = false;
  private stepStaff(dS: number, dtReal: number) {
    const L = this.life, dt = Math.max(dtReal, dS);
    const hg = !!L.games && (!!L.games.mine || !!L.games.houseAt);
    if (hg !== this.houseGame) { this.houseGame = hg; this.applyStaff(); }
    // the bartenders' lane limits: centres at least 0.6 m apart along the lane
    const lane = this.bartenders.filter((b) => b.on).sort((a, b) => a.s - b.s);
    for (let i = 0; i < lane.length; i++) { lane[i].sMin = i ? lane[i - 1].s + 0.6 : 0; lane[i].sMax = i < lane.length - 1 ? lane[i + 1].s - 0.6 : 99; }
    for (const b of this.bartenders) if (b.on) b.update(dt, this.T / SECS);
    // Low: the westmost bartender's flap trip when there are empties and nobody's waiting (at most every 3 sim minutes)
    if (this.quality === 'low' && this.c.clock().open) {
      const west = this.bartenders.filter((b) => b.on).sort((a, b) => b.post - a.post)[0];
      if (west && !west.trip && this.empties.length >= 2 && this.T - this.lastTrip > 180 && this.bartenders.filter((b) => b.on && !b.trip).length >= 2) { if (west.startTrip(this.T / SECS)) { this.lastTrip = this.T; this.sections(); } }
      if (west && !west.trip && this.tripWas) { this.sections(); }
      this.tripWas = !!west?.trip;
    }
    for (const s of this.servers) if (s.on) s.update(dt);
    if (this.host.on) this.host.update(dt);
    if (this.barback.on) this.barback.update(dt);
    // staff stuck checks (the watchdog's numbers; the lane and the grid keep them moving)
    for (const s of this.staff) {
      if (!s.body.on) continue;
      const mv = Math.hypot(s.body.x - s.lastX, s.body.z - s.lastZ); s.lastX = s.body.x; s.lastZ = s.body.z;
      const walking = (s.body as unknown as { moving?: boolean }).moving;
      if (walking && mv < 0.01 * dS) { s.stuckT += dS; s.maxStuck = Math.max(s.maxStuck, s.stuckT); } else s.stuckT = 0;
    }
    // the lane: no two bartenders' centres within 0.6 m along u
    const us = this.bartenders.filter((b) => b.on && !b.trip && b.s <= 12.6).map((b) => b.u).sort((a, b) => a - b);
    for (let i = 1; i < us.length; i++) this.audits.minGap = Math.min(this.audits.minGap, us[i] - us[i - 1]);
    void L;
  }
  private lastTrip = -1e9; private tripWas = false;

  // ------------------------------------------------------------------------------------------------ the checks' audits
  private audit() {
    // no slot over capacity: everyone at a slot, counted
    const at = new Map<string, number>();
    for (const n of this.npcs) if (n.slot && !n.path && !n.hiddenUntil) at.set(n.slot, (at.get(n.slot) ?? 0) + 1);
    for (const id of this.fillers.keys()) at.set(id, (at.get(id) ?? 0) + 1);
    const pl = this.c.player;
    if (pl.seat) for (const s of this.slots.values()) if (s.seatId === pl.seat.id) at.set(s.id, (at.get(s.id) ?? 0) + 1);
    for (const v of at.values()) if (v > 1) this.audits.overCap++;
    // nobody in the lane or the flap
    const cut = this.c.venue.region.cut;
    for (const n of this.npcs) if (n.mode === 'live' && cut.some((r) => pointInPoly(n.x, n.z, r))) this.audits.laneHits++;
    if (cut.some((r) => pointInPoly(pl.x, pl.z, r))) this.audits.playerLane++;
    const live = this.live;
    this.audits.liveMax = Math.max(this.audits.liveMax, live);
    if (live > this.cap) this.audits.liveOver++;
    if (this.quality === 'low') this.audits.staffLowMax = Math.max(this.audits.staffLowMax, this.staffOn);
  }

  // ------------------------------------------------------------------------------------------------ a change of graphics
  /** the live count moves to the new cap on the switch frame, holding or bringing back guests; at a new people quality
   *  every body is rebuilt (the atlas eight and the atlas behind the sheet, everyone else queued, a card till then) */
  setQuality(q: Quality, rebuild: boolean) {
    // the page's own first applyQuality (at load, the same preset): nothing moves
    if (q === this.quality && !rebuild) { this.applyStaff(); return; }
    const from = this.quality; this.quality = q; this.pq = q === 'low' ? 'phone' : 'high'; this.cellD = -1;
    const cp = this.camPoint(), t0 = performance.now(), P = { x: cp.x, z: cp.z };
    const liveBefore = this.live, heldBefore = this.heldGuests;
    // (the switch holds by units below, so the staff plan's own cap rule waits)
    this.applyStaff(false);
    const gc = this.guestCap();
    const held: { key: string; d: number; ud: number; regular: boolean; standing: boolean }[] = [], back: string[] = [];
    // the switch log's evidence for the checks: going down, the unit distance of every guest still live and not yours
    // (a unit's distance is its nearest member's); going up, the room under the cap before anyone came back
    let liveUD: number[] = [], roomUp = 0;
    let promoted = 0;
    if (this.liveGuests > gc) {
      // going down: by units, farthest from the camera first; your party, and anyone with you, never
      const units = new Map<string, Npc[]>();
      for (const n of this.npcs) if (n.mode === 'live' && !n.party.yours && !n.party.leaving) { const key = n.home ? this.unitOf.get(n.home)?.id ?? n.key : n.key; const l = units.get(key) ?? []; l.push(n); units.set(key, l); }
      const ud = new Map<Npc[], number>(); for (const g of units.values()) ud.set(g, Math.min(...g.map((m) => Math.hypot(m.x - P.x, m.z - P.z))));
      const order = [...units.values()].sort((a, b) => ud.get(b)! - ud.get(a)!);
      for (const grp of order) {
        const excess = this.liveGuests - gc; if (excess <= 0) break;
        const take = grp.slice().sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z)).slice(0, Math.min(excess, grp.length));
        for (const m of take) { this.hold(m); held.push({ key: m.key, d: +Math.hypot(m.x - P.x, m.z - P.z).toFixed(2), ud: +ud.get(grp)!.toFixed(3), regular: !!m.regular, standing: this.slots.get(m.home ?? '')?.seatId === undefined }); }
      }
      for (const grp of order) for (const m of grp) if (m.mode === 'live') liveUD.push(+ud.get(grp)!.toFixed(3));
      // leaving parties walking out are counted too: hold the farthest of them as well if still over
      for (const n of this.npcs.slice().sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z))) { if (this.liveGuests <= gc) break; if (n.mode === 'live' && !n.party.yours) { this.removeNpc(n); } }
    } else {
      // going up: held guests come back as themselves first, nearest the camera first, then fillers in place
      roomUp = gc - this.liveGuests;
      const hs = this.npcs.filter((n) => n.mode === 'held').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
      for (const n of hs) { if (this.liveGuests >= gc) break; this.unhold(n); back.push(n.key); }
      const before = this.liveGuests;
      if (this.liveGuests < gc) this.topUpTo(gc, P);
      promoted = this.liveGuests - before;
    }
    // rebuilds at the new people quality
    let rebuilt = 0;
    if (rebuild) {
      for (const n of this.npcs) if (n.p) { this.disposeBody(n.p); n.p = null; n.q = null; n.lod1 = false; }
      for (const s of this.spares) this.disposeBody(s.p); this.spares = [];
      this.buildStaff(this.pq, false);
      this.sections();
      rebuilt = this.paintAtlas('switch', false);
      for (const n of this.npcs) n.look = this.cards.nearestLook(n.opts);
    }
    this.relayFillers();
    // the bodies queued after a change of people quality are rebuilds: logged with the reason 'switch'
    this.pendingSwitch = rebuild;
    this.sched.markSwitch();
    this.sched.after(performance.now(), 0);
    this.switches.push({ from, to: q, rebuild, ms: Math.round(performance.now() - t0), liveBefore, live: this.live, cap: this.cap, heldBefore, held, back, promoted, rebuilt, liveUD, roomUp, fillers: this.fillers.size, target: this.target(), staff: this.staffOn, yours: this.parties.filter((p) => p.yours).flatMap((p) => p.members.map((m) => ({ key: m.key, mode: m.mode }))) });
  }
  private topUpTo(gc: number, P: { x: number; z: number }) {
    for (let guard = 0; this.liveGuests < gc && guard < 100; guard++) {
      const fs = [...this.fillers.values()].sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
      if (!fs) break;
      const room = gc - this.liveGuests;
      const u = this.units.get(fs.unit)!, ids = u.slots.filter((s) => this.fillers.has(s));
      for (const id of ids) this.fillers.delete(id);
      const r = mulberry(hash32('up', this.seedN, guard, Math.floor(this.T)));
      const party = this.makeParty(ids.length, 'filler', this.T, r);
      while (party.members.length > ids.length) this.removeNpc(party.members[party.members.length - 1]);
      while (party.members.length < ids.length) this.newNpc(party, { t: this.T });
      this.social.partyGroup(party);
      this.seatParty(party, ids, u);
      if (ids.length > room) { const ex = party.members.slice().sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z)).slice(0, ids.length - room); for (const m of ex) this.hold(m); }
    }
  }
  private hold(n: Npc) {
    if (n.mode === 'held') return;
    this.social.gone(n, false);
    // someone walking is held at the slot they're walking to
    if (n.path && n.act?.slot) { const s = this.slots.get(n.act.slot); if (s) { this.placeAt(n, s); n.slot = s.id; this.life.res.use(s.id, n.key); } }
    else if (n.path && n.home) { const s = this.slots.get(n.home); if (s) { this.placeAt(n, s); n.slot = s.id; } }
    n.path = null; n.mode = 'held'; n.act = n.slot ? this.restAct(n, this.slots.get(n.slot)!) : null;
    this.dueQ = this.dueQ.filter((x) => x !== n);
  }
  /** the atlas eight: the 8 live people nearest the camera, at LOD 2 at the preset's quality (built now if they aren't),
   *  then the atlas painted from them; spares fill in when the room has fewer than eight */
  private paintAtlas(reason: BuildReason, atLoad: boolean) {
    const cp = this.camPoint(), P = atLoad ? { x: this.c.player.x, z: this.c.player.z } : { x: cp.x, z: cp.z };
    // S4's second repair (the art review: at Low, cards of a bald guest in a grey shirt with skin showing through the
    // chest, twice in one frame): a LOD 2 body smears an open or deep neckline's skin over the chest, and the atlas
    // repeats that look across the room, so of the 14 nearest the 8 with closed tops go first (nearest first within each)
    const deep = (n: Npc) => n.opts.outfit.some((g) => (g.kind === 'shirt' && g.open === true) || g.neck === 'v' || g.neck === 'scoop' || g.neck === 'strap' || g.neck === 'square') ? 1 : 0;
    const near = this.npcs.filter((n) => n.mode === 'live').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 14)
      .map((n, i) => ({ n, k: deep(n) * 100 + i })).sort((a, b) => a.k - b.k).slice(0, 8).map((x) => x.n);
    let built = 0;
    for (const n of near) if (!n.p || n.q !== this.pq) { this.sched.run(this.bodyJob(n, 2, reason), -1, true); built++; }
    const bodies = near.filter((n) => n.p).map((n) => ({ p: n.p!, name: n.name }));
    while (bodies.length < 8 && this.spares.length < 6) { this.sched.run(this.spareJob(reason), -1, true); built++; }
    for (const s of this.spares) if (bodies.length < 8) bodies.push({ p: s.p, name: 'spare' });
    this.cards.paint(bodies, this.pq === 'high', this.life.clips, this.quality === 'low' ? this.restyle ?? undefined : undefined);
    for (const b of bodies) b.p.group.userData.drawSig = '';
    for (const n of this.npcs) n.look = this.cards.nearestLook(n.opts);
    this.sched.after(performance.now(), 0);
    return built;
  }

  // ------------------------------------------------------------------------------------------------ the builds
  private bodyJob(n: Npc, level: 1 | 2, reason: BuildReason): BuildJob {
    return { who: n.id, level, quality: this.pq, reason, run: () => {
      if (level === 2 || !n.p || n.q !== this.pq) {
        if (n.p) this.disposeBody(n.p);
        n.p = buildPerson({ ...this.forBuild(n.opts), quality: this.pq, lod: 2 }); n.q = this.pq; n.lod1 = false;
        n.p.group.name = `npc-${n.id}`; n.p.group.userData.group = 'people'; n.p.group.visible = false;
        this.noCast(n.p); this.c.scene.add(n.p.group);
      }
      if (level === 1 && n.p) { const was = n.p.stats().lod; n.p.setLod(1); n.p.setLod(was as 1 | 2); n.lod1 = true; this.noCast(n.p); }
    } };
  }
  /** what a body is built from: at phone quality (Low) a deep or open neckline is built closed (S4's second repair, the
   *  art review: phone LOD bodies smear the skin of a V, a scoop or an open shirt over the whole chest, which the
   *  Retro look turns into a flat skin-coloured patch); the person's own options (their card, their look) are kept */
  private forBuild(o: PersonOptions): PersonOptions {
    if (this.pq !== 'phone' || !o.outfit.some((g) => g.open || (g.neck && g.neck !== 'crew' && g.neck !== 'collar'))) return o;
    return { ...o, outfit: o.outfit.map((g) => (g.kind === 'shirt' || g.kind === 'tee' || g.kind === 'fitted' || g.kind === 'blouse' || g.kind === 'tank' || g.kind === 'cardigan' || g.kind === 'dress' || g.kind === 'polo') ? { ...g, open: false, neck: g.neck === 'collar' ? 'collar' : 'crew' } : g) };
  }
  private staffLod1Job(s: StaffRec): BuildJob { return { who: s.id, level: 1, quality: this.pq, reason: 'fill', run: () => { const was = s.body.p.stats().lod; s.body.p.setLod(1); s.body.p.setLod(was as 1 | 2); s.lod1 = true; this.noCast(s.body.p); } }; }
  private spareJob(reason: BuildReason): BuildJob {
    const k = hash32('spare', this.seedN, this.nextId++);
    return { who: -200, level: 2, quality: this.pq, reason, run: () => { const opts = apartFromSkin(randomPerson(k % 100000)); const p = buildPerson({ ...this.forBuild(opts), quality: this.pq, lod: 2 }); p.group.visible = false; p.group.name = 'spare'; this.noCast(p); this.c.scene.add(p.group); this.spares.push({ p, opts, q: this.pq }); } };
  }
  /** the next build in the plan's order: everyone live not yet built (LOD 2, nearest the camera first); then the casters'
   *  LOD 1; then the drawn LOD 1 count's, nearest first; then the 6 spares. A tap puts that person's LOD 1 first. The LOD 1
   *  list is the frame's (`wantLod1()`, worked out once a frame and at the start of buildAll) */
  private nextJob(): BuildJob | null {
    if (this.tapFront && this.byKey.has(this.tapFront.key)) { const n = this.tapFront; this.tapFront = null; if (!n.p || n.q !== this.pq || !n.lod1) return this.bodyJob(n, 1, 'tap'); }
    this.tapFront = null;
    const P = this.camPoint();
    let best: Npc | null = null, bd = Infinity;
    for (const n of this.npcs) { if (n.mode !== 'live' || (n.p && n.q === this.pq)) continue; const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < bd) { bd = d; best = n; } }
    if (best) return this.bodyJob(best, 2, this.pendingSwitch ? 'switch' : 'fill');
    for (let i = 0; i < this.wantN; i++) {
      const want = this.wanted[i];
      if (want.kind === 'npc') { const n = want.n!; if (!n.lod1 && this.byKey.has(n.key) && n.mode === 'live') return this.bodyJob(n, 1, this.pendingSwitch ? 'switch' : 'fill'); }
      else { const s = want.s!; if (!s.lod1) return this.staffLod1Job(s); }
    }
    if (this.spares.length < 6) return this.spareJob(this.pendingSwitch ? 'switch' : 'fill');
    this.pendingSwitch = false;
    return null;
  }
  private pendingSwitch = false;
  private nextJobFn = () => this.nextJob();
  // the frame's people (pooled, sorted by distance) and the LOD 1 queue's share of them
  private recs: PRec[] = []; private recN = 0;
  private wanted: PRec[] = []; private wantN = 0;
  /** the frame's people: everyone live and in sight of the rule (not in the restrooms) and the staff on shift, each with
   *  their distance from the camera (the overhead's target in overhead) and inside or not, sorted nearest first. The
   *  entries are reused frame to frame */
  private fillPeople() {
    const P = this.camPoint(), T = this.T, R = this.recs;
    let k = 0;
    for (const n of this.npcs) {
      if (n.mode !== 'live' || n.hiddenUntil > T) continue;
      let r = R[k]; if (!r) { r = { kind: 'npc', n: null, s: null, x: 0, z: 0, d: 0, indoor: false, want: false, cast: false }; R[k] = r; }
      r.kind = 'npc'; r.n = n; r.s = null; r.x = n.x; r.z = n.z; k++;
    }
    for (const s of this.staff) {
      if (!s.body.on) continue;
      let r = R[k]; if (!r) { r = { kind: 'staff', n: null, s: null, x: 0, z: 0, d: 0, indoor: false, want: false, cast: false }; R[k] = r; }
      r.kind = 'staff'; r.n = null; r.s = s; r.x = s.body.x; r.z = s.body.z; k++;
    }
    for (let i = 0; i < k; i++) { const r = R[i]; r.d = Math.hypot(r.x - P.x, r.z - P.z); r.indoor = this.indoorXZ(r.x, r.z); r.want = false; r.cast = false; }
    // an insertion sort over the first k entries (about 110 at most; no comparator closure, no work array)
    for (let i = 1; i < k; i++) { const r = R[i]; let j = i - 1; while (j >= 0 && R[j].d > r.d) { R[j + 1] = R[j]; j--; } R[j + 1] = r; }
    this.recN = k;
  }
  /** who should have a LOD 1 now, in the queue's order: the casters (HD 5 and Ultra 19 besides your avatar: the nearest
   *  outside the unit), at Ultra the pool-slot people, then the drawn LOD 1 count inside, nearest first. Once a frame,
   *  after fillPeople() */
  private wantLod1() {
    const q = this.quality, B = this.c.def.budgets[q], R = this.recs, N = this.recN, W = this.wanted;
    let k = 0;
    if (q !== 'low') {
      let c = 0;
      for (let i = 0; i < N && c < B.castPeople - 1; i++) { const x = R[i]; if (!x.indoor) { x.want = true; W[k++] = x; c++; } }
      if (q === 'ultra') for (let i = 0; i < N; i++) { const x = R[i]; if (!x.want && this.poolBit(x)) { x.want = true; W[k++] = x; } }
    }
    const inside = B.drawn.inside.lod1;
    for (let i = 0; i < N && i < inside; i++) { const x = R[i]; if (!x.want) { x.want = true; W[k++] = x; } }
    this.wantN = k;
  }
  private _cam = { x: 0, z: 0 };
  /** the camera's ground point (the overhead's target in overhead): one object, filled in place */
  private camPoint() { const c = this.c, o = this._cam; if (c.view() === 'overhead') { const t = this.life.overheadTarget(); o.x = t.x; o.z = t.z; } else { o.x = c.camera.position.x; o.z = c.camera.position.z; } return o; }
  private indoorAt(x: number, z: number) { return this.indoorXZ(x, z); }
  /** inside the unit at local (x, z): the frame's (u, v) worked out inline (no tuple) */
  private indoorXZ(x: number, z: number) { const A = this.F.A, B = this.F.B; return this.c.def.indoor(x * A[0] + z * A[1], x * B[0] + z * B[1]); }
  /** a pool spot's bit for someone at its 8 slots (4 players: you and the house when you play there; 4 watchers) */
  private poolBit(x: { kind: 'npc' | 'staff'; n?: Npc | null; s?: StaffRec | null }) {
    if (x.kind === 'npc') { const s = x.n!.slot ? this.slots.get(x.n!.slot) : null; if (!s || !s.id.startsWith('pool watcher') || x.n!.path) return 0; return s.at[0] < 13.15 || (s.at[0] === 13.15 && s.at[1] < 6.9) ? 2 : 4; }
    if (x.s!.role === 'house') { const h = this.life.games?.houseAt; const id = h?.id ?? this.life.games?.mine?.id; return id === 'pool-1' ? 2 : id === 'pool-2' ? 4 : 0; }
    return 0;
  }
  /** build every pending body now, up to the live cap (fastForward() and pose() call it first) */
  buildAll() {
    let k = 0;
    this.topUp();
    this.fillPeople(); this.wantLod1();
    for (let guard = 0; guard < 400; guard++) { const j = this.nextJob(); if (!j) break; this.sched.run(j, -1, true); k++; }
    return { built: k, live: this.live, cap: this.cap };
  }

  // ------------------------------------------------------------------------------------------------ the frame: drawing
  /** once a frame, at the top of the life layer's update and before the render: the build scheduler's check, the
   *  hand-over near you, the draw modes, casting, the bodies and the cards */
  frame(dt: number, state: VisState, avatarDrawn: 0 | 1 | 2) {
    const t0 = performance.now();
    // the frame's people and the LOD 1 queue, once (the scheduler's check and its job read them)
    this.fillPeople(); this.wantLod1();
    const b = this.sched.frame(performance.now(), this.nextJobFn, this.hasWork());
    // a hand-over or a held guest's return near you changes who's live: the list again
    if (this.nearYou()) this.fillPeople();
    this.drawModes(state, avatarDrawn);
    this.social.frame(dt);
    this.drawBodies(dt);
    // the crowd's own CPU this frame, less the build that landed in it (the build log has its own time)
    this.frameMs = performance.now() - t0 - (b ? b.dur : 0); this.frameBuildMs = b ? b.dur : 0;
  }
  private hasWork() { if (this.tapFront) return true; for (const n of this.npcs) if (n.mode === 'live' && (!n.p || n.q !== this.pq)) return true; for (let i = 0; i < this.wantN; i++) { const w = this.wanted[i]; if (w.kind === 'npc' ? !w.n!.lod1 : !w.s!.lod1) return true; } return this.spares.length < 6; }
  /** fillers and held guests within the distance of you are handed over / come back (and any you've just tapped) */
  /** (true when anyone came or went: the frame's people list is filled again) */
  private nearYou() {
    const P = this.viewPoint(), minD = FILLER_MIN[this.quality];
    // only when you've moved half a metre (a cell of the check's own, numbers rather than a string a frame)
    const cx = Math.round(P.x * 2), cz = Math.round(P.z * 2);
    if (cx === this.cellX && cz === this.cellZ && minD === this.cellD) return false;
    this.cellX = cx; this.cellZ = cz; this.cellD = minD;
    let moved = false;
    for (const f of [...this.fillers.values()]) { if (!this.fillers.has(f.slot)) continue; const u = this.units.get(f.unit)!; if (u.slots.some((s) => { const sl = this.slots.get(s)!; return Math.hypot(sl.x - P.x, sl.z - P.z) < minD; }) || Math.hypot(f.x - P.x, f.z - P.z) < minD) { moved = true; if (!this.handOver(u)) { for (const id of u.slots) this.fillers.delete(id); this.handFails++; } } }
    for (const n of this.npcs) if (n.mode === 'held' && Math.hypot(n.x - P.x, n.z - P.z) < minD) { if (this.makeRoom(1)) { this.unhold(n); moved = true; } }
    return moved;
  }
  private cellX = NaN; private cellZ = NaN; private cellD = -1;
  /** each person's draw mode and casting from the frame's people list (sorted nearest first): the casting people (HD 6,
   *  Ultra 20 with your avatar) are the nearest outside the unit with a LOD 1 body; outside, they're drawn as meshes
   *  first and the rest by distance up to the outside count; inside and overhead everyone built is a mesh. Two passes
   *  over the sorted list stand in for a casters-first copy; no allocation */
  private drawModes(state: VisState, avatarDrawn: 0 | 1 | 2) {
    const q = this.quality, B = this.c.def.budgets[q], dr = B.drawn[state], R = this.recs, N = this.recN, pq = this.pq;
    let casters = 0;
    if (q !== 'low') for (let i = 0; i < N && casters < B.castPeople - 1; i++) { const x = R[i]; const built = x.kind === 'npc' ? !!x.n!.p && x.n!.q === pq && x.n!.lod1 : x.s!.lod1; if (built && !x.indoor) { x.cast = true; casters++; } }
    const outside = state === 'outside';
    const meshCap = outside ? dr.atLod - (avatarDrawn ? 1 : 0) : Infinity;
    const lod1Cap = Math.max(0, dr.lod1 - (avatarDrawn === 1 ? 1 : 0));
    let meshes = 0, l1 = 0;
    const poolOn = q === 'ultra' && !outside;
    for (let pass = 0; pass < (outside ? 2 : 1); pass++) {
      for (let i = 0; i < N; i++) {
        const x = R[i];
        if (outside && x.cast !== (pass === 0)) continue;
        const built = x.kind === 'npc' ? !!x.n!.p && x.n!.q === pq : true;
        const hasL1 = x.kind === 'npc' ? x.n!.lod1 : x.s!.lod1;
        let mode: DrawMode = 'card';
        if (built && meshes < meshCap) { meshes++; mode = hasL1 && l1 < lod1Cap ? 'lod1' : 'lod2'; if (mode === 'lod1') l1++; }
        let bits = x.cast ? 1 : 0;
        if (poolOn && hasL1 && built) { const pb = this.poolBit(x); if (pb) bits = pb; }
        if (mode === 'card' || !hasL1) bits = 0;
        if (x.kind === 'npc') { const n = x.n!; n.draw = mode; n.caster = bits; n.dist = x.d; } else { const s = x.s!; s.draw = mode; s.caster = bits; s.dist = x.d; }
      }
    }
    for (const n of this.npcs) if (n.mode === 'held' || n.hiddenUntil > this.T) { n.draw = n.mode === 'held' ? 'card' : 'off'; n.caster = 0; }
    for (const s of this.staff) if (!s.body.on) { s.draw = 'off'; s.caster = 0; }
    const st = this.stats; st.meshes = meshes; st.lod1 = l1; st.casters = casters; st.state = state;
  }
  stats: { meshes: number; lod1: number; casters: number; state: VisState } = { meshes: 0, lod1: 0, casters: 0, state: 'outside' };
  /** the Retro style's restyle at Low (the plan: after every LOD swap, rebuild and card-to-mesh swap). Null until the
   *  Retro module lands (O15): S4 sets it to retro.restyle while the style is attached */
  restyle: ((o: THREE.Object3D) => void) | null = null;
  /** a body's levels and casting from its draw mode (only when it changes) */
  private fills = new WeakMap<Person, { value: THREE.Color }>();
  /** wrap a body's LOD 1 and LOD 2 materials with its fill (once each) */
  private wrapFill(p: Person) {
    let f = this.fills.get(p); if (!f) { f = { value: new THREE.Color(0, 0, 0) }; this.fills.set(p, f); }
    for (const n of ['lod1', 'lod2']) { const m = p.group.getObjectByName(n) as THREE.Mesh | undefined; if (m) withFill(m.material as THREE.Material, f); }
    return f;
  }
  /** the fill on a body where it stands: inside the room's light (more at Low, which has no real lights), outside a
   *  little at night under the lot's lamps, and (S4's repair) the pergola's warm light on the patio while open */
  private setFill(p: Person, x: number, z: number) {
    const f = this.fills.get(p); if (!f) return;
    const c = this.c.clock(), inside = this.indoorAt(x, z), k = this.quality === 'low' ? 1 : 0.55;
    if (inside && c.open) { f.value.setRGB(0.34 * k, 0.29 * k, 0.24 * k); return; }
    // inline, as indoorXZ does: this runs per body per frame, so it makes no array (the code review of S4's third pass)
    const A = this.F.A, B = this.F.B, u = x * A[0] + z * A[1], v = x * B[0] + z * B[1], patio = c.open && u > 2 && u < 24 && v < 0.3 && v > -5.5;
    if (patio) f.value.setRGB(0.26 * c.night, 0.19 * c.night, 0.13 * c.night); else f.value.setRGB(0.12 * c.night, 0.11 * c.night, 0.1 * c.night);
  }
  private applyBody(p: Person, mode: DrawMode, bits: number, key: string) {
    const sig = `${mode}:${bits}`;
    const was = (p.group.userData.drawSig as string | undefined) ?? '';
    if (was === sig) return;
    p.group.userData.drawSig = sig;
    if (mode === 'card' || mode === 'off') { p.group.visible = false; const l1 = p.group.getObjectByName('lod1') as THREE.Mesh | undefined; if (l1) { setHiddenCaster(l1, false); l1.castShadow = false; } return; }
    p.group.visible = true;
    p.setLod(mode === 'lod1' ? 1 : 2);
    this.wrapFill(p);
    this.restyle?.(p.group);
    const l1 = p.group.getObjectByName('lod1') as THREE.Mesh | undefined, l2 = p.group.getObjectByName('lod2') as THREE.Mesh | undefined;
    if (l2) l2.castShadow = false;
    if (l1) {
      if (bits) {
        l1.parent!.visible = true; l1.castShadow = true; l1.userData.maps = bits;
        l1.onBeforeShadow = this.life.shadowBefore; l1.onAfterShadow = this.life.shadowAfter;
        setHiddenCaster(l1, mode === 'lod2');
      } else { setHiddenCaster(l1, false); l1.castShadow = false; if (mode === 'lod2') l1.parent!.visible = false; }
    }
    void key;
  }
  private drawBodies(dt: number) {
    const C = this.cards, night = this.c.clock().night;
    C.begin();
    const now = this.T;
    // pending reaction clips start at their staggered time
    for (let i = this.pendingClips.length - 1; i >= 0; i--) { const pc = this.pendingClips[i]; if (now >= pc.at + pc.seconds) { this.pendingClips.splice(i, 1); this.clipLog.push({ t: +(now / SECS).toFixed(3), npc: pc.n.key, clip: pc.clip, missed: true }); continue; } if (now >= pc.at) { this.pendingClips.splice(i, 1); if (pc.n.p && (pc.n.draw === 'lod1' || pc.n.draw === 'lod2')) { const seated = !!pc.n.slot && this.slots.get(pc.n.slot)?.seatId !== undefined; this.life.clips.play(pc.n.p, pc.clip, { upper: seated, seconds: pc.seconds, jump: pc.jump }); this.clipLog.push({ t: +(now / SECS).toFixed(3), npc: pc.n.key, clip: pc.clip, lod: pc.n.p.stats().lod, draw: pc.n.draw }); } } }
    for (const n of this.npcs) {
      const seated = !!n.slot && !n.path && this.slots.get(n.slot)?.seatId !== undefined;
      if (n.p) this.applyBody(n.p, n.draw, n.caster, n.key);
      if (n.draw === 'off') continue;
      const tint = this.indoorAt(n.x, n.z) ? 0.95 : 1 - 0.5 * night;
      if (n.draw === 'card') {
        const pose: CardPose = n.cheerCardUntil > now ? CHEERING : seated ? SEATED : STANDING;
        C.put(n.x, n.y, n.z, n.heading, n.look, pose, tint);
        C.blob(n.x, this.c.grid.height(n.x, n.z), n.z, seated ? 0.9 : 0.75);
        continue;
      }
      const p = n.p!; p.group.position.set(n.x, n.y, n.z); p.group.rotation.y = n.heading; this.setFill(p, n.x, n.z);
      p.play(n.path ? 'walk' : seated ? 'sit' : this.talking(n) ? 'talk' : 'idle');
      p.update(dt * (n.path ? n.speedK : 1)); this.life.clips.apply(p, dt);
      this.posture(n);
      C.blob(n.x, this.c.grid.height(n.x, n.z), n.z, seated ? 0.9 : 0.75);
    }
    for (const s of this.staff) {
      this.applyBody(s.body.p, s.draw, s.caster, s.name);
      if (s.draw === 'off') continue;
      if (s.draw === 'card') { C.put(s.body.x, s.body.y, s.body.z, s.body.heading, this.cards.nearestLook(s.body.p.options), STANDING, this.indoorAt(s.body.x, s.body.z) ? 0.95 : 1 - 0.5 * night); C.blob(s.body.x, s.body.y, s.body.z, 0.75); continue; }
      if (s.role !== 'house') s.body.animate?.(dt);
      this.setFill(s.body.p, s.body.x, s.body.z);
      C.blob(s.body.x, s.body.y, s.body.z, 0.75);
    }
    for (const f of this.fillers.values()) {
      const tint = this.indoorAt(f.x, f.z) ? 0.95 : 1 - 0.5 * night;
      C.put(f.x, f.y, f.z, f.yaw, f.look, f.cheerUntil > now ? CHEERING : f.pose, tint);
      C.blob(f.x, this.c.grid.height(f.x, f.z), f.z, f.pose === SEATED ? 0.9 : 0.75);
    }
    C.end();
  }
  private boneCache = new WeakMap<Person, { chest: THREE.Bone | null; head: THREE.Bone | null }>();
  private talking(n: Npc) { return this.social.talking(n); }
  /** a slump when Low: the chest and the head a little forward (the builder rewrote every bone this update) */
  private posture(n: Npc) {
    if (n.label !== 'Low' || !n.p) return;
    let b = this.boneCache.get(n.p);
    if (!b) { let sk: THREE.Skeleton | null = null; n.p.group.traverse((o) => { if (!sk && (o as THREE.SkinnedMesh).isSkinnedMesh) sk = (o as THREE.SkinnedMesh).skeleton; }); const s2 = sk as THREE.Skeleton | null; b = { chest: s2?.getBoneByName('chest') ?? null, head: s2?.getBoneByName('head') ?? null }; this.boneCache.set(n.p, b); }
    if (b.chest) b.chest.rotateX(0.12); if (b.head) b.head.rotateX(0.1);
  }
  /** what people hold, for the item meshes: only people drawn as bodies (a card shows none); the empties; the plates at
   *  the pass */
  drawItems(I: HeldItems) {
    const now = this.T;
    for (const n of this.npcs) {
      if (!n.p || (n.draw !== 'lod1' && n.draw !== 'lod2')) continue;
      const hd = n.hand.drink, hf = n.hand.food;
      if (hd) { const hp = handPoint(n.p, 'R', this._v); if (hp) I.putAt(hd.model, hp.x, hp.y - (hd.model === 'glass' ? 0.07 : 0.03), hp.z, n.heading, 1, hd.color); }
      if (hf) { const hp = handPoint(n.p, 'L', this._v); if (hp) I.putAt(hf.model, hp.x, hp.y - (hf.model === 'glass' ? 0.07 : 0.03), hp.z, n.heading, 1, hf.color); }
    }
    for (const s of this.staff) {
      const b = s.body as unknown as { carry: string | null; p: Person; heading: number };
      if (s.draw !== 'lod1' && s.draw !== 'lod2') continue;
      if (!b.carry || s.role === 'house' || (s.role === 'bartender' && s.body === this.life.bartender) || (s.role === 'server' && s.body === this.life.server)) continue;
      const it = itemById(b.carry), model = it ? it.model : b.carry === 'empty-basket' ? 'basket' : 'glass', col = it ? it.color : EMPTY.glass;
      const hp = handPoint(b.p, 'R', this._w); if (hp) I.putAt(model, hp.x, hp.y - 0.07, hp.z, b.heading, 1, col);
    }
    for (const e of this.empties) I.putAt(e.model, e.x, e.y, e.z, e.yaw, 1, e.model === 'glass' ? EMPTY.glass : EMPTY.basket);
    for (let i = this.plates.length - 1; i >= 0; i--) { const pl = this.plates[i]; if (now > pl.until) { this.plates.splice(i, 1); continue; } I.putAt('disc', pl.x, 1.05, pl.z, 0, PLATE_SCALE, 0xeeeeee); }
  }

  // ------------------------------------------------------------------------------------------------ taps, joins and the hooks
  /** a tap's ray: the nearest person it meets (a body, a card or a filler), within `maxT`: a filler is handed over first
   *  (their table becomes live walk-ins), a held guest comes back, and their LOD 1 goes to the front of the queue */
  tapPerson(ray: THREE.Ray, maxT: number): Npc | null {
    let best: { t: number; n?: Npc; f?: Filler } | null = null;
    const test = (x: number, y: number, z: number, h: number) => {
      // a capsule as a vertical segment, 0.32 m round
      const o = ray.origin, d = ray.direction;
      for (let k = 0; k <= 4; k++) { const py = y + 0.2 + (h - 0.2) * (k / 4), vx = x - o.x, vy = py - o.y, vz = z - o.z, t = vx * d.x + vy * d.y + vz * d.z; if (t < 0.3 || t > maxT) continue; const dd = Math.hypot(vx - d.x * t, vy - d.y * t, vz - d.z * t); if (dd < 0.32) return t; }
      return Infinity;
    };
    for (const n of this.npcs) { if (n.draw === 'off') continue; const t = test(n.x, n.y, n.z, 1.7); if (t < (best?.t ?? Infinity)) best = { t, n }; }
    for (const f of this.fillers.values()) { const t = test(f.x, f.y, f.z, 1.7); if (t < (best?.t ?? Infinity)) best = { t, f }; }
    if (!best) return null;
    let n = best.n ?? null;
    if (best.f) n = this.handOver(this.units.get(best.f.unit)!, best.f.slot);
    if (!n) return null;
    if (n.mode === 'held') { if (!this.makeRoom(1)) return null; this.unhold(n); }
    this.tapFront = n;
    return n;
  }
  /** you join a talking group (Lot 57's Join): that party is yours (never held) and you stand with them */
  join(n: Npc) {
    return this.social.joinYou(n);
  }
  // ------------------------------------------------------------------------------------------------ S3b: games and rounds
  /** a guest's body now if they have none (an accepted Challenge: they play your game in front of you) */
  ensureBody(n: Npc) { if (!n.p || n.q !== this.pq) this.sched.run(this.bodyJob(n, 1, 'tap'), -1, true); }
  /** a guest as a game's player: walks on the walk grid (the game's own action, no decisions while it lasts), faces the
   *  way the game asks on arrival, and goes back to deciding when the game sends them home */
  oppFor(n: Npc): Opp {
    const self = this;
    return {
      get p() { return n.p; }, get x() { return n.x; }, get z() { return n.z; }, get walking() { return !!n.path; },
      walkTo(t: P2, yaw: number | null, done?: () => void) { self.gameWalk(n, t, yaw, done); },
      home() { if (n.act?.action === 'game') self.finish(n, 'game over'); },
    };
  }
  private gameWalk(n: Npc, t: P2, yaw: number | null, done?: () => void) {
    if (!n.act || n.act.action !== 'game') n.act = { action: 'game', object: this.life.games?.mine?.id ?? 'game', slot: null, stage: 'do', t0: this.T, dur: Infinity, continuous: false, tags: ['game'], score: 0, screen: null, why: 'your game' };
    n.faceYaw = yaw; n.onArrive = done ?? null;
    if (Math.hypot(t[0] - n.x, t[1] - n.z) < 0.05) { if (yaw !== null) n.heading = yaw; const cb = n.onArrive; n.onArrive = null; cb?.(); return; }
    this.walkTo(n, t);
  }
  /** a round brought by a server in about `inS` sim s (1 to 2 minutes): each guest their favourite drink (the plan's
   *  "each person gets their favourite"; a guest holding one gets theirs when it's done, ours: in hand now), yours
   *  alcohol-free */
  deliverRound(g: { cx: number; cz: number }, members: Npc[], you: boolean, inS: number, done: () => void) {
    const sv = this.serverFor(), pick = sv.pickup;
    const to = (): P2 => { const f = this.c.grid.nearestFree(g.cx + 0.8, g.cz, 3); return f ? [f[0], f[1]] : [g.cx, g.cz]; };
    const back = Math.hypot(to()[0] - pick[0], to()[1] - pick[1]) / 1.3;
    const delay = Math.max(1, inS - sv.walkSeconds(pick) - back - 4);
    const fav = members.length ? itemById(members[0].favourites.drink) : null;
    sv.add({ kind: 'deliver', label: 'fetch a round', delay, to: () => pick, arrive: () => {
      sv.carry = fav && fav.kind === 'drink' ? fav.id : DRINKS[0].id;
      sv.add({ kind: 'deliver', label: 'bring a round', to, arrive: () => {
        sv.carry = null;
        for (const m of members) { if (!this.byKey.has(m.key) || m.mode !== 'live') continue; const it = itemById(m.favourites.drink); const d = it && it.kind === 'drink' ? it : DRINKS[0]; this.give(m, d.id, 'glass', d.color, 6); }
        if (you) this.life.roundForYou();
        done();
      } }, true);
    } });
  }
  /** crowdAt('outside', n): walk-ins seated on the patio and the front walk until n live people are outside the unit (the
   *  budget poses' stall and patio); crowdAt(<zone>, n) the same into that zone's free slots */
  crowdAt(zone: string, n: number) {
    const outside = () => this.npcs.filter((x) => x.mode === 'live' && !this.indoorAt(x.x, x.z)).length + this.staff.filter((s) => s.body.on && !this.indoorAt(s.body.x, s.body.z)).length;
    const want = (s: Slot) => (zone === 'outside' ? !this.indoorAt(s.x, s.z) && (s.at[1] < 0 || s.zone === 'front walk') : s.zone === zone) && s.kind !== 'staff';
    const P = this.viewPoint();
    for (let guard = 0; outside() < n && guard < 200; guard++) {
      const mover = this.npcs.filter((x) => x.mode === 'live' && !x.regular && this.indoorAt(x.x, x.z) && !x.party.yours).sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z))[0];
      if (!mover) break;
      const free = [...this.slots.values()].filter((s) => want(s) && !this.life.res.holder(s.id) && !this.slotTaken(s.id)).sort((a, b) => (a.seatId !== undefined ? 0 : 1) - (b.seatId !== undefined ? 0 : 1) || a.at[0] - b.at[0]);
      // fillers on those slots make room
      const fl = free.length ? null : [...this.fillers.values()].find((f) => want(this.slots.get(f.slot)!));
      if (fl) { const u = this.units.get(fl.unit)!; for (const s of u.slots) this.fillers.delete(s); continue; }
      const s = free[0]; if (!s) break;
      this.releaseAll(mover); mover.home = s.id; mover.slot = s.id; this.life.res.reserve(s.id, mover.key, Infinity); this.life.res.use(s.id, mover.key);
      this.placeAt(mover, s); mover.act = this.restAct(mover, s); mover.party.unit = this.unitOf.get(s.id)?.id ?? null;
    }
    this.relayFillers();
    return { zone, outside: outside(), live: this.live, fillers: this.fillers.size };
  }
  /** the spare-body check: a guest sent home at once (their body to the spares while the pool is short) */
  sendHome(n: Npc) { const body = n.p?.group.uuid ?? null; this.removeNpc(n); return { body, spares: this.spares.length, spareBodies: this.spares.map((s) => s.p.group.uuid) }; }
  /** the spare-body check: the unit of the filler at a slot handed over to live walk-ins (the hand-over near you, done
   *  directly); who now sits at that slot and the body they took */
  handOverAt(slot: string) { const f = this.fillers.get(slot); if (!f) return null; const n = this.handOver(this.units.get(f.unit)!, slot); return n ? { id: n.id, key: n.key, body: n.p?.group.uuid ?? null, spares: this.spares.length } : null; }
  /** the check's needs: set needs on a seeded share of live guests */
  setNpcNeeds(values: Partial<Record<'hunger' | 'thirst' | 'fun' | 'social' | 'energy', number>>, share = 0.3, seed = 7) {
    const r = mulberry(hash32('npcneeds', seed)); let k = 0;
    const keys: string[] = [];
    for (const n of this.npcs) if (n.mode === 'live' && !n.party.leaving && r() < share) { for (const [key, v] of Object.entries(values)) n.needs[key as 'thirst'] = v as number; n.decideAt = this.T; k++; keys.push(n.key); }
    return { n: k, keys };
  }
  /** an NPC forced to LOD 0 in view (the Low shader check): the hair meshes marked retroSkip, as for your avatar */
  forceLod0(n: Npc) {
    if (!n.p) this.sched.run(this.bodyJob(n, 2, 'fill'), -1, true);
    const p = n.p!; p.setLod(0); p.group.traverse((o) => { if (o.name === 'hair-cap' || o.name === 'hair-cards') o.userData.retroSkip = true; });
    p.group.visible = true; p.group.userData.drawSig = 'forced';
    return p;
  }
  /** the person's radial menu items (S3a: a hello; S3b brings the 11 interactions) */
  sayHi(n: Npc) { const lines = ['Hey!', 'Oh, hey.', 'How\'s it going?', 'Good crowd tonight.']; n.met = true; this.life.sayCaption(n.name, lines[n.id % lines.length], 2.5); return true; }
  byId(id: number) { return this.npcs.find((n) => n.id === id) ?? null; }
  /** a patch of floor clear of the crowd: no live guest or staff on shift within r, no place the crowd uses (a seat's or
   *  spot's stand point, a filler's included) within rs (where you stand to watch a screen when every place that sees
   *  it is taken) */
  clearAt(x: number, z: number, r: number, rs: number) {
    for (const n of this.npcs) if (n.mode === 'live' && Math.abs(n.x - x) < r && Math.abs(n.z - z) < r && Math.hypot(n.x - x, n.z - z) < r) return false;
    for (const s of this.staff) if (s.body.on && Math.hypot(s.body.x - x, s.body.z - z) < r) return false;
    for (const s of this.slots.values()) if (Math.abs(s.sx - x) < rs && Math.abs(s.sz - z) < rs && Math.hypot(s.sx - x, s.sz - z) < rs) return false;
    return true;
  }
  /** the geometries the people's bodies hold on the GPU now (the guests', the spares' and the staff's): each body's
   *  geometries the renderer has uploaded (three.js adds its dispose listener on the upload). The memory check takes
   *  these off the renderer's count, the crowd being a moving population (who's in, who's at LOD 1; a filler made live
   *  is a new person); a body let go without being disposed is in none of these lists, so it stays in the rest */
  peopleGeometries() {
    const seen = new Set<THREE.BufferGeometry>();
    const add = (p: Person | null | undefined) => p?.group.traverse((o) => { const g = (o as THREE.Mesh).geometry as (THREE.BufferGeometry & { _listeners?: Record<string, unknown[]> }) | undefined; if (g && g._listeners?.dispose?.length) seen.add(g); });
    for (const n of this.npcs) add(n.p);
    for (const s of this.spares) add(s.p);
    for (const s of this.staff) add(s.body.p);
    return seen.size;
  }
  someoneNear(x: number, z: number, r: number) { for (const n of this.npcs) if (n.mode === 'live' && n.path && Math.abs(n.x - x) < r && Math.abs(n.z - z) < r && Math.hypot(n.x - x, n.z - z) < r) return true; return false; }
  statsBrief() {
    let seated = 0, walkers = 0;
    for (const n of this.npcs) if (n.mode === 'live') { if (n.path) walkers++; else if (n.slot && this.slots.get(n.slot)?.seatId !== undefined) seated++; }
    return { npcs: this.live, groups: this.social.groups.length, seated, walkers, held: this.heldGuests, fillers: this.fillers.size, cards: this.cards.cards, blobs: this.cards.blobCount, peopleMeshes: this.stats.meshes, peopleLod1: this.stats.lod1, crowdStepMs: +this.stepMs.toFixed(3), crowdFrameMs: +this.frameMs.toFixed(3), crowdFrameBuildMs: +this.frameBuildMs.toFixed(1), decideMs: this.decideMs.length ? +(this.decideMs.reduce((a, b) => a + b, 0) / this.decideMs.length).toFixed(3) : null };
  }
  /** vis()'s people: who's drawn how, who casts into which map (by their lod1: shown, or a hidden caster under a LOD 2),
   *  and any LOD 2 or LOD 0 mesh casting (there should be none) */
  visReport() {
    const drawn = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const rows: { key: string; draw: DrawMode; lod: number | null; bits: number; caster: { hidden: boolean; castShadow: boolean; shown: boolean } | null }[] = [];
    const bad: string[] = [];
    const look = (key: string, p: Person | null, draw: DrawMode, bits: number) => {
      if (!p) { rows.push({ key, draw, lod: null, bits, caster: null }); return; }
      const l1 = p.group.getObjectByName('lod1') as THREE.Mesh | undefined;
      p.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.castShadow && m !== l1 && drawn(m)) bad.push(`${key}:${m.name || 'mesh'}`); });
      rows.push({ key, draw, lod: p.stats().lod, bits, caster: l1 ? { hidden: !!l1.userData.hiddenCaster, castShadow: l1.castShadow, shown: drawn(l1) } : null });
    };
    for (const n of this.npcs) look(n.key, n.p, n.draw, n.caster);
    for (const s of this.staff) if (s.body.on) look(s.name, s.body.p, s.draw, s.caster);
    const members = (bit: number) => rows.filter((r) => r.bits & bit && r.caster?.castShadow && r.caster.shown).map((r) => r.key);
    // a body drawn while its person is a card (or off), or a spare body shown: neither should ever be
    const shownAsCards: string[] = [];
    for (const n of this.npcs) if (n.p && (n.draw === 'card' || n.draw === 'off') && drawn(n.p.group) && n.p.group.userData.drawSig !== 'forced') shownAsCards.push(n.key);
    for (const s of this.staff) if ((s.draw === 'card' || s.draw === 'off') && drawn(s.body.p.group)) shownAsCards.push(s.name);
    const sparesShown = this.spares.filter((s) => drawn(s.p.group)).length;
    return { state: this.stats.state, meshes: this.stats.meshes, lod1: this.stats.lod1, cards: this.cards.cards, blobs: this.cards.blobCount, fillers: this.fillers.size, held: this.heldGuests, live: this.live,
      lod0Npcs: rows.filter((r) => r.lod === 0 && r.draw !== 'off' && r.draw !== 'card').length, sun: members(1), pool1: members(2), pool2: members(4), castingNotLod1: bad,
      byMode: rows.reduce((a, r) => { a[r.draw] = (a[r.draw] ?? 0) + 1; return a; }, {} as Record<string, number>),
      cardsHolding: this.npcs.filter((n) => n.draw === 'card' && (n.hand.drink || n.hand.food)).length, shownAsCards, sparesShown, rows };
  }

  report(): CrowdReport {
    const staffRoles: Record<string, number> = {};
    for (const s of this.staff) if (s.body.on) staffRoles[s.role] = (staffRoles[s.role] ?? 0) + 1;
    const moods = this.npcs.filter((n) => n.mode === 'live').map((n) => n.mood).sort((a, b) => a - b);
    const lowShare = moods.length ? this.npcs.filter((n) => n.mode === 'live' && n.label === 'Low').length / moods.length : 0;
    return {
      cap: this.cap, live: this.live, liveGuests: this.liveGuests, held: this.heldGuests, fillers: this.fillers.size, staff: this.staffOn, staffRoles, plan: this.plan,
      target: this.target(), guestCap: this.guestCap(), parties: this.parties.length, regulars: this.npcs.filter((n) => n.regular).length, spares: this.spares.length,
      moodMedian: moods.length ? +moods[Math.floor(moods.length / 2)].toFixed(2) : null, lowShare: +lowShare.toFixed(3),
      draws: this.stats, cards: this.cards.cards, blobs: this.cards.blobCount, atlas: this.cards.source,
      stuckMax: Math.max(0, ...this.npcs.map((n) => n.maxStuck), ...this.staff.map((s) => s.maxStuck)), rescues: this.npcs.reduce((a, n) => a + n.rescues, 0),
      audits: { ...this.audits, minGap: Number.isFinite(this.audits.minGap) ? +this.audits.minGap.toFixed(3) : null },
      decideMs: this.decideMs.length ? { mean: +(this.decideMs.reduce((a, b) => a + b, 0) / this.decideMs.length).toFixed(3), max: +Math.max(...this.decideMs).toFixed(3), n: this.decideMs.length } : null,
      stepMs: +this.stepMs.toFixed(3), frameMs: +this.frameMs.toFixed(3),
    };
  }
  resetAudits() { this.audits = { overCap: 0, laneHits: 0, playerLane: 0, liveMax: 0, liveOver: 0, staffLowMax: 0, minGap: Infinity, steps: 0 }; for (const n of this.npcs) { n.maxStuck = 0; n.rescues = 0; } for (const s of this.staff) s.maxStuck = 0; for (const b of this.bartenders) { b.served.clear(); b.trips = []; } this.reactions = []; this.dances = []; this.clipLog = []; this.laughs = []; return true; }
  list() {
    const F = this.F;
    return [
      ...this.npcs.map((n) => { const [u, v] = F.toFrame(n.x, n.z); return { id: n.id, key: n.key, name: n.name, kind: 'guest', regular: n.regular, mode: n.mode, draw: n.draw, lod: n.p ? n.p.stats().lod : null, quality: n.q, lod1: n.lod1, caster: n.caster, u: +u.toFixed(2), v: +v.toFixed(2), indoor: this.indoorAt(n.x, n.z), slot: n.slot, home: n.home, walking: !!n.path, action: n.act?.action ?? null, stage: n.act?.stage ?? null, mood: +n.mood.toFixed(1), label: n.label, emotion: n.emotion, speedK: n.speedK, team: n.team, party: n.party.id, yours: n.party.yours, fan: +n.traits.fan.toFixed(3), active: +n.traits.active.toFixed(3), holding: { drink: n.hand.drink?.item ?? null, food: n.hand.food?.item ?? null }, order: n.order, dist: +n.dist.toFixed(2), look: n.look, hidden: n.hiddenUntil > this.T, body: n.p?.group.uuid ?? null, skin: '#' + n.opts.look.skin.toString(16).padStart(6, '0'), wear: n.opts.outfit.map((g) => `${g.kind} #${g.color.toString(16).padStart(6, '0')}`).join(', '), recoloured: this.recoloured.has(n.opts) }; }),
      ...this.staff.map((s) => { const [u, v] = F.toFrame(s.body.x, s.body.z); return { id: s.id, key: s.name, name: s.name, kind: 'staff', role: s.role, mode: s.body.on ? 'live' : 'off', draw: s.draw, lod: s.body.p.stats().lod, quality: this.pq, lod1: s.lod1, caster: s.caster, u: +u.toFixed(2), v: +v.toFixed(2), indoor: this.indoorAt(s.body.x, s.body.z), dist: +s.dist.toFixed(2) }; }),
    ];
  }
  /** every table unit: who sits at it (fillers, live, held); a table mixing fillers and live people would show here */
  tables() {
    const out: { unit: string; fillers: number; live: number; held: number; mixed: boolean }[] = [];
    for (const u of this.units.values()) {
      if (u.kind !== 'table') continue;
      let f = 0, l = 0, h = 0;
      for (const id of u.slots) { if (this.fillers.has(id)) f++; const k = this.life.res.holder(id); const n = k ? this.byKey.get(k) : null; if (n) { if (n.mode === 'held') h++; else l++; } }
      out.push({ unit: u.id, fillers: f, live: l, held: h, mixed: f > 0 && (l > 0 || h > 0) });
    }
    return out;
  }
  /** the slots fillers may take now, those they sit in included (the fillers check's "every free eligible slot") */
  freeEligible() { const el = this.eligibleFn(); let k = 0; for (const u of this.units.values()) if (el(u)) k += u.slots.length; return k; }
  /** a unit fillers may take: a filler's kind of slot, nobody else's, every seat of it at the distance from you, and on
   *  game nights not the dance floor (its 12 standing spots) */
  private eligibleFn() {
    const P = this.viewPoint(), minD = FILLER_MIN[this.quality];
    const nw = this.life.now(), gn = this.life.tv.gameNight(this.life.weekNow(), nw.day, nw.hour);
    return (u: Unit) => u.fillerOk && !(gn && u.slots.some((id) => DANCE_SET.has(id))) && !u.slots.some((s) => { const h = this.life.res.holder(s); return !!h || (this.slotTaken(s) && !this.fillers.has(s)); }) && u.slots.every((s) => { const sl = this.slots.get(s)!; return Math.hypot(sl.x - P.x, sl.z - P.z) >= minD; });
  }
  fillerList() { const P = this.viewPoint(); return [...this.fillers.values()].map((f) => ({ slot: f.slot, unit: f.unit, look: f.look, pose: f.pose, d: +Math.hypot(f.x - P.x, f.z - P.z).toFixed(2) })); }
  staffReport() {
    return {
      bartenders: this.bartenders.map((b, i) => ({ i, on: b.on, u: +b.u.toFixed(2), s: +b.s.toFixed(2), section: b.section.map((x) => +x.toFixed(2)), served: [...b.served].sort((a, c) => a - c), trip: b.trip?.stage ?? null, trips: b.trips })),
      servers: this.servers.map((s, i) => { const [u, v] = this.F.toFrame(s.x, s.z); return { i, on: s.on, busy: s.busy, u: +u.toFixed(2), v: +v.toFixed(2), job: s.job?.label ?? null, queue: s.queue.map((j) => j.label), carry: s.carry }; }), host: { on: this.host.on, greeted: this.host.greeted }, barback: { on: this.barback.on, picked: this.barback.picked }, house: (this.life.house as unknown as { on: boolean }).on,
      empties: this.empties.length, minGap: Number.isFinite(this.audits.minGap) ? +this.audits.minGap.toFixed(3) : null,
    };
  }
  /** every counter position (the 9 stools, the 4 gaps and the pick-up) gets one test order, to check each is served */
  serveAll() {
    const us = [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => 14.6 + 1.05 * (k - 1)), 13.75, 23.8, 24.45, 25.1, 26.15];
    for (const u of us) this.bartenderFor(u).order('pint', u, 4, () => { /* a test order */ });
    return us;
  }
  logs() { return { decisions: this.decisionLog, reactions: this.reactions, dances: this.dances, clips: this.clipLog, laughs: this.laughs, switches: this.switches }; }
  get decisionsLog() { return this.decisionLog; }
  dispose() { this.cards.dispose(); }
}
