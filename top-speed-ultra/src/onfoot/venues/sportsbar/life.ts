// Stoppage Time's life-sim layer, S2a (PROJECT_OC_SPORTS_BAR.md, "### S2a"): your needs, mood and moodlets, the
// smart objects and their adverts, reservations and the action queue, held items, ordering at the counter and table
// service with one bartender and one server, the screens (the fictional leagues, the schedule, the featured match and
// game nights, the broadcast pictures, highlights, the guide card and "Pick a side"), watching, the jukebox, the
// water station, the dance spot on game nights (you only, in S2a), house tokens and saving. The engine parts live in
// engine/sim/; this file turns them on for the bar and wires them to the page. Everything is simulated from the
// clock and seeds; nothing is live, and nothing costs money.
import * as THREE from 'three';
import type { Frame } from '../../engine/frame';
import type { VenueDef, P2 } from '../../engine/venue-def';
import type { WalkGrid } from '../../engine/walkgrid';
import { ColliderSet, isTall } from '../../engine/collide';
import type { Hud } from '../../engine/hud';
import type { Seat } from '../../engine/venue-types';
import type { Person } from '../../people';
import { buildPerson, randomPerson } from '../../people';
import type { Quality } from '../../engine/mats';
import * as C from '../../engine/clock';
import { Needs, Traits, AVERAGE, AVERAGE_START, SHOWN, ShownNeed, rates, advance, bump, Doing, FunKind, moodOf, moodLabel, needsAverage, Moodlets, emotionOf, Need, needWord, MOODLETS } from '../../engine/sim/needs';
import { Reservations, ActionQueue, QueuedAction, SmartObject } from '../../engine/sim/objects';
import { Tv, absMinute, fromAbs, hhmm, DAY_NAMES, TvEvent, Fixture } from '../../engine/sim/tv';
import { Broadcast } from '../../engine/sim/broadcast';
import { HeldItems, ALLOC_TRIS, MODELS, CAPS } from '../../engine/sim/held';
import { ClipLayer, CLIPS, ClipName, DANCES, STAFF_CLIPS, GAME_CLIPS } from '../../engine/sim/clips';
import { wonGameValue, GAME_TOKENS, NO_STAKES } from '../../engine/sim/games';
import { Games, GameOutcome } from './games';
import { HousePlayer, HOUSE_NAME } from './house';
import { loadSave, writeSave, SaveData, TOKENS_LABEL, SAVE_LABEL, GOALS, GoalId, tonightsThree, EARN } from '../../engine/sim/tokens';
import { hash32, mulberry } from '../../engine/sim/rng';
import { LEAGUES, teamByAbbr, crestSvg, CHANNEL_NAMES } from '../../engine/sim/leagues';
import { TYPES, placed, surfaces, JUKEBOX_SPOT, ADVERT_COUNT } from './objects';
import { PLAYER_MENU, DRINKS, FOODS, BarItem, itemById, MENU_NOTE, EMPTY } from './menu';
import { Bartender, Server, handPoint } from './crew';
import { SCREENS, PATIO, POOL_TABLES } from './layout';
import type { BarPlayer } from './player';
import { WALK } from '../../engine/player';
import type { BarHud } from './hud';
import type { BarView } from './views';
import type { BarVenue } from './venue';
import type { BarMats } from './mats';
import { BAR_NAME } from './brand';
import { Crowd } from './crowd';
import type { VisState } from '../../engine/venue-def';

export interface LifeCtx {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; F: Frame; def: VenueDef; venue: BarVenue; mats: BarMats;
  grid: WalkGrid; set: ColliderSet; player: BarPlayer; hud: Hud; barHud: BarHud;
  person: () => Person | null; view: () => BarView; quality: () => Quality; reduced: () => boolean;
  clock: () => { day: number; hour: number; live: boolean; open: boolean; night: number; share: number };
  worldMeshes: THREE.Mesh[];
  shadowHooks: { before: THREE.Object3D['onBeforeShadow']; after: THREE.Object3D['onAfterShadow'] };
  input: { enabled: boolean };
  walkToCar: () => void;
  canvas: HTMLCanvasElement;
  /** S3a: the renderer (the filler atlas), the overhead's target, the visibility state, how your avatar is drawn (0 not
   *  drawn, 1 at LOD 1, 2 at LOD 0) */
  renderer: THREE.WebGLRenderer;
  overheadTarget: () => { x: number; z: number };
  visState: () => VisState;
  avatarDrawn: () => 0 | 1 | 2;
}
type Slot = BarVenue['slots'][number];
interface Held { item: BarItem; left: number; next: number; sipT: number; nudged?: boolean }
interface Order {
  id: number; item: BarItem | null; kind: 'drink' | 'food'; where: 'bar' | 'table';
  stage: 'server-coming' | 'choosing' | 'taking' | 'making' | 'kitchen' | 'carrying' | 'ready' | 'done';
  t: number; readyAt: number; start: number; label: string; seat?: Seat | null;
  /** S3a: the server on shift who looks after this order (the least busy when it was called) */
  sv?: Server;
}
interface Empty { model: 'glass' | 'basket'; x: number; y: number; z: number; yaw: number }

/** S3a: the place you stand to watch a screen when the crowd has every place that sees it (standSpotFor) */
const YOUR_SPOT = 'your watch spot';
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const SECS = 60;
/** the two hands, in a constant (the per-frame loops make no array) */
const KINDS = ['drink', 'food'] as const;
/** the patio heaters (frame u, v): +2 mood at night within 2.5 m */
const HEATERS: readonly P2[] = [[12.9, -3.95], [20.95, -3.95]];
/** a sip or a bite takes 2.4 s (its clip); no second one starts before it ends */
const SIP_S = 2.4;
/** each screen's channel by id (the featured ones follow the big screen) */
const SCREEN_CH = new Map(SCREENS.map((s) => [s.id, s.channel]));
/** a walk's length along its waypoints, from (x, z) */
const pathLen = (x: number, z: number, path: P2[]) => { let d = 0; for (const [px, pz] of path) { d += Math.hypot(px - x, pz - z); x = px; z = pz; } return d; };
const SIM_STEP_S = 1;                     // fast-forward steps one sim second at a time
/** the ISO week of a date (the device's, in its own time zone) */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

export class BarLife {
  // ---- the engine parts (made before the page's clock first runs: the crowd's x1.25 reads the TV schedule)
  tv: Tv; week: number | null = null; deviceWeek = isoWeek(new Date());
  /** sim minutes past the clock's reading (the time scale and fast-forward), and the reading it's measured from */
  private drift = 0; private clockKey = ''; timeScale = 1;
  /** the absolute sim minute now (engine/sim/tv.ts's scheme) */
  T = 0;
  /** the crowd's extra factor for engine/schedule.ts: the featured match's x1.25 */
  readonly extra = (day: number, hour: number) => this.tv.featuredFactor(this.weekNow(), day, hour);
  // ---- you
  needs: Needs = { ...AVERAGE_START } as Needs;
  traits: Traits = { ...AVERAGE };
  moodlets = new Moodlets();
  queue = new ActionQueue();
  res = new Reservations();
  held: { drink: Held | null; food: Held | null } = { drink: null, food: null };
  orders: Order[] = [];
  private orderId = 1;
  empties: Empty[] = [];
  save: SaveData; storage: string;
  private savedAt = -1e9; dirty = false;
  team: string | null = null;
  private inBarMin = 0; private tokensFromTime = 0;
  private tonight: { goals: GoalId[]; done: GoalId[] } = { goals: [], done: [] };
  log: { t: number; what: string }[] = [];
  // ---- the page parts
  private ctx!: LifeCtx;
  /** S3a: the crowd, the staff, the fillers and how people are drawn (crowd.ts) */
  crowd!: Crowd;
  get ctxRef() { return this.ctx; }
  objects: SmartObject[] = placed();
  private slots = new Map<string, Slot>();
  items!: HeldItems; clips = new ClipLayer(); broadcast!: Broadcast;
  bartender!: Bartender; server!: Server;
  /** S2b: the house player and the games */
  house!: HousePlayer; games!: Games;
  private wonGameAt?: number;
  gameResults: (GameOutcome & { t: number; moodlet: string | null; tokens: number })[] = [];
  private screenMesh!: THREE.Mesh;
  private surfaces = surfaces();
  /** the nearest table surface within r metres of (x, z): its local (x, y, z) (the crowd's empties go down there) */
  surfacesNear(x: number, z: number, r: number): [number, number, number] | null {
    let best: [number, number, number] | null = null, bd = r;
    for (const sf of this.surfaces) { const [sx, sz] = this.ctx.F.fromFrame(sf.at[0], sf.at[1]), d = Math.hypot(sx - x, sz - z); if (d < bd) { bd = d; best = [sx + ((x * 13.1) % 0.2) - 0.1, sf.y, sz + ((z * 7.3) % 0.16) - 0.08]; } }
    return best;
  }
  overheadTarget() { return this.ctx.overheadTarget(); }
  /** S4: a game night now (the featured match's final whistle until close): the dance spot's lights (look.ts) */
  gameNightNow() { const n = this.now(); return this.tv.gameNight(this.weekNow(), n.day, n.hour); }
  /** a guest or one of the staff within r metres of (x, z) (the doors open for them) */
  someoneNear(x: number, z: number, r: number) { return !!this.crowd && this.crowd.someoneNear(x, z, r); }
  /** the crowd's counts for stats() */
  crowdStats() { return this.crowd ? this.crowd.statsBrief() : { npcs: 0, groups: 0, seated: 0, walkers: 0 }; }
  /** the people's own roots for the map members' listing (people are reported by visPeople, person by person) */
  peopleRoots(): THREE.Object3D[] { return []; }
  visPeople() { return this.crowd ? this.crowd.visReport() : null; }
  get shadowBefore() { return this.ctx.shadowHooks.before; }
  get shadowAfter() { return this.ctx.shadowHooks.after; }
  /** a guest's caption line (its sim time noted, as the staff's are) */
  sayCaption(who: string, text: string, seconds = 3) { this.say(who, text, seconds); }
  /** a slot free for you: nobody's reservation and no filler or guest on it */
  private freeForYou(id: string) { if (id.startsWith(YOUR_SPOT)) return this.res.free(id, 'you'); return this.crowd ? !this.crowd.slotTaken(id, 'you') && this.res.free(id, 'you') : this.res.free(id, 'you'); }
  private cheerT = 0; private lastMoment: TvEvent | null = null; private teamMomentAt?: number; private teamLostAt?: number;
  private nudgeT = 0; private lowWas: Record<string, boolean> = {}; private tiredShown = false;
  private watching: { screen: string; since: number } | null = null;
  private dancing: { clip: ClipName; until: number; next: number } | null = null;
  private cancelled: string | null = null;
  /** the budget check: every item model at its cap */
  itemsAtCap = false;
  private capSpot(k: number): [number, number, number] { const sf = this.surfaces[k % this.surfaces.length], [x, z] = this.ctx.F.fromFrame(sf.at[0] + ((k * 0.37) % 0.3) - 0.15, sf.at[1] + ((k * 0.53) % 0.2) - 0.1); return [x, sf.y, z]; }
  private startPos = new Map<number, P2>();
  private radialFor: string | null = null;
  /** the order whose menu sheet is open: one at a time (a second ordering action waits until it's answered) */
  private menuFor: Order | null = null;
  /** the screens' channels change only at whole sim minutes (every kick-off and final whistle is on one), so they're
   *  worked out once a minute: the big screen's channel and whether each channel's match in play is the featured one */
  private tvMin = NaN; private bigCh: 1 | 2 | 3 = 3; private feat1 = false; private feat2 = false; private screenOpen: boolean | null = null; private screenBig = -1;
  /** when the life layer's last toast and caption went up (sim seconds) and for how long, so a fast-forward can take
   *  stale ones down */
  private toastAt = -1; private toastFor = 0; private capAt = -1; private capFor = 0;
  private _doing: Doing = { posture: 'stand', fun: undefined, match: 1, eating: false, watchers: 0 };
  private _e = new THREE.Euler();
  constructor(def: VenueDef, seed = 1) {
    this.tv = new Tv(def.schedule.noiseSeed, def.schedule);
    const L = loadSave(seed); this.save = L.data; this.storage = L.storage;
    this.team = this.save.team;
    // a visit: one more on the device's count; 50 tokens the first time
    this.save.visits++;
    if (!this.save.firstVisitPaid) { this.save.tokens += EARN.firstVisit; this.save.firstVisitPaid = true; this.note('first visit: 50 house tokens'); }
    // your needs start seeded (the plan's start ranges), from the device's visit count
    const r = mulberry(hash32('you', this.save.visits, seed));
    for (const k of SHOWN) this.needs[k] = clamp(AVERAGE_START[k] + (r() - 0.5) * 10, 0, 100);
    this.dirty = true;
  }
  weekNow() { return this.week ?? this.deviceWeek; }
  private note(what: string) { this.log.push({ t: this.T, what }); if (this.log.length > 200) this.log.shift(); }

  // ------------------------------------------------------------------------------------------------ attach to the page
  attach(ctx: LifeCtx) {
    this.ctx = ctx;
    for (const s of ctx.venue.slots) this.slots.set(s.id, s);
    // the jukebox's own use spot (it has no layout slot)
    const [jx, jz] = ctx.F.fromFrame(JUKEBOX_SPOT[0], JUKEBOX_SPOT[1]);
    this.slots.set('jukebox spot', { id: 'jukebox spot', zone: 'standing floor', kind: 'stand', at: JUKEBOX_SPOT, face: [0, -1], y: 0, stand: JUKEBOX_SPOT, r: 0.3, x: jx, z: jz, sx: jx, sz: jz });
    const q = ctx.quality();
    this.items = new HeldItems(q !== 'low');
    for (const im of Object.values(this.items.meshes)) { im.onBeforeShadow = ctx.shadowHooks.before; im.onAfterShadow = ctx.shadowHooks.after; }
    ctx.scene.add(this.items.group);
    // the screens: one atlas of the three channels on the twelve screens, in one mesh (the venue's still test card's
    // batch is hidden: same calls)
    this.broadcast = new Broadcast(this.tv, { title: BAR_NAME, line: 'Fictional leagues · simulated matches' });
    this.broadcast.setQuality(q); this.broadcast.reduced = ctx.reduced();
    this.buildScreens();
    // the staff (and S2b's house player)
    this.buildCrew(q);
    // S2b: the games, each against the house player; where you stand to begin each is a slot of its own
    this.games = new Games({
      F: ctx.F, camera: ctx.camera, canvas: ctx.canvas, grid: ctx.grid, player: ctx.player, person: ctx.person, house: () => this.house, clips: this.clips,
      reduced: ctx.reduced, input: ctx.input, overhead: () => ctx.view() === 'overhead', blocked: () => ctx.hud.paused || ctx.barHud.anySheet() || ctx.barHud.radialOpen,
      competitive: () => this.traits.competitive, energy: () => this.needs.energy,
      tell: (t, sec) => this.tell(t, sec), result: (o) => this.gameResult(o), simMin: () => this.T,
    });
    for (const sp of this.games.spots) {
      const [gx, gz] = ctx.F.fromFrame(sp.start[0], sp.start[1]);
      this.slots.set(`${sp.id} player`, { id: `${sp.id} player`, zone: sp.kind, kind: 'stand', at: sp.start, face: sp.startFace, y: 0, stand: sp.start, r: 0.3, x: gx, z: gz, sx: gx, sz: gz });
    }
    ctx.player.onArrive = (g) => this.arrived(g.spot ?? '');
    // the HUD
    const bh = ctx.barHud;
    bh.onNeeds = () => this.openNeeds();
    bh.onGuide = () => this.openGuide();
    bh.onCancel = (id) => this.cancel(id);
    bh.onRadial = (key) => this.pick(key);
    bh.onRadialClose = () => { this.radialFor = null; };
    bh.onCheer = () => this.cheer();
    bh.onSide = (t) => { this.team = t; this.save.team = t; this.dirty = true; this.openGuide(); this.ctx.hud.toast(t ? `You're backing ${teamByAbbr(t)?.name}` : 'No side for tonight', 2.5); };
    bh.onLeave = () => ctx.walkToCar();
    bh.onText = (s) => { bh.setText(s); this.save.settings.text = s; this.dirty = true; };
    bh.onSheet = (open) => { ctx.input.enabled = !open && ctx.view() !== 'overhead'; };
    bh.setText(this.save.settings.text);
    ctx.hud.onOrderPick = (id) => this.orderPicked(id);
    // "Not now" (or the backdrop, or Escape) drops the order its menu was opened for, and only that one
    ctx.hud.onOrderClose = () => { ctx.hud.closeOrder(); const o = this.menuFor; this.menuFor = null; if (o) this.dropOrder(o, 'not now'); bh.onSheet(bh.anySheet()); };
    this.syncClock();
    // S3a: the crowd (the slots, the staff plan, the room settled, the filler atlas painted before the first frame)
    this.crowd = new Crowd(this, ctx.renderer, ctx.scene);
    this.crowd.attach(q);
    // S3b: the friendships the device kept (yours and the regulars'), your reply chips, People here
    this.relsLoaded = this.crowd.social.load(this.save.social);
    ctx.hud.onReply = (i) => { this.crowd.social.reply(i); };
    bh.onPeople = () => this.crowd.social.openPeople();
    const day = fromAbs(this.T), dateKey = this.weekNow() * 10 + day.day;
    if (!this.save.tonight || this.save.tonight.date !== dateKey || this.save.tonight.visit !== this.save.visits) this.save.tonight = { date: dateKey, visit: this.save.visits, goals: tonightsThree(dateKey, this.save.visits), done: [] };
    this.tonight = { goals: this.save.tonight.goals, done: this.save.tonight.done };
    this.refreshHud(true);
  }
  private buildCrew(q: Quality) {
    const pq = q === 'low' ? 'phone' : 'high', c = this.ctx;
    const old = [this.bartender?.p, this.server?.p, this.house?.p].filter(Boolean) as Person[];
    const keepB = this.bartender, keepS = this.server, keepH = this.house;
    this.bartender = new Bartender(c.F, this.clips, pq);
    this.server = new Server(c.F, c.grid, this.clips, pq);
    this.house = new HousePlayer(c.F, c.grid, this.clips, pq);
    if (keepH) { this.house.x = keepH.x; this.house.z = keepH.z; this.house.heading = keepH.heading; if (keepH.goal) this.house.walkTo(keepH.goal, null); }
    // a rebuilt crew keeps its jobs and where it was
    if (keepB) { this.bartender.s = keepB.s; this.bartender.job = keepB.job; this.bartender.queue = keepB.queue; }
    if (keepS) { this.server.x = keepS.x; this.server.z = keepS.z; this.server.job = keepS.job; this.server.queue = keepS.queue; }
    for (const p of [this.bartender.p, this.server.p, this.house.p]) {
      // inside the unit nobody but your avatar casts into the sun's map (the roof's shadow covers them)
      p.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
      c.scene.add(p.group);
    }
    // the people builder's dispose() leaves the skeleton's bone texture (handoff item 6): freed here too
    for (const p of old) { c.scene.remove(p.group); this.clips.forget(p); const sk = new Set<THREE.Skeleton>(); p.group.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton) sk.add(m.skeleton); }); p.dispose(); for (const k of sk) k.dispose(); }
  }
  /** the twelve screens as one mesh of quads, each mapped to its channel's cell of the broadcast atlas */
  private buildScreens() {
    const c = this.ctx, F = c.F, n = SCREENS.length;
    const pos = new Float32Array(n * 4 * 3), nrm = new Float32Array(n * 4 * 3), uv = new Float32Array(n * 4 * 2), idx: number[] = [];
    SCREENS.forEach((s, i) => {
      const [x, z] = F.fromFrame(s.at[0] + s.face[0] * 0.012, s.at[1] + s.face[1] * 0.012), [fx, fz] = F.dirToLocal(s.face[0], s.face[1]);
      // a viewer facing the screen looks along -f; their right is (-f) x up
      const rx = fz, rz = -fx, hw = s.w / 2, hh = s.h / 2;
      const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      corners.forEach(([a, b], k) => { const o = (i * 4 + k) * 3; pos[o] = x + rx * a; pos[o + 1] = s.y + b; pos[o + 2] = z + rz * a; nrm[o] = fx; nrm[o + 1] = 0; nrm[o + 2] = fz; });
      const b0 = i * 4; idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = c.mats.screen; m.map = this.broadcast.texture; m.emissiveMap = this.broadcast.texture; m.needsUpdate = true;
    this.screenMesh = new THREE.Mesh(g, m); this.screenMesh.name = 'bar-screens-tv'; this.screenMesh.userData.group = 'venue';
    this.screenMesh.castShadow = false; this.screenMesh.receiveShadow = false;
    const old = c.worldMeshes.find((w) => w.name === 'bar-screens'); if (old) { old.visible = false; old.parent?.add(this.screenMesh); } else c.scene.add(this.screenMesh);
    this.mapScreens(true);
  }
  /** the per-minute TV state (the big screen's channel, which channel's match in play is featured), when the sim
   *  minute changes */
  private tvTick() {
    const m = Math.floor(this.T); if (m === this.tvMin) return; this.tvMin = m;
    this.bigCh = this.tv.bigChannel(this.T);
    this.feat1 = !!this.tv.inPlay(1, this.T)?.featured; this.feat2 = !!this.tv.inPlay(2, this.T)?.featured;
  }
  /** each screen's channel now: the featured screens follow the big screen's channel */
  channelOf(id: string): 1 | 2 | 3 { this.tvTick(); const c = SCREEN_CH.get(id) ?? 3; return c === 'featured' ? this.bigCh : c; }
  /** a screen's channel at a given sim minute (a final whistle: the channel while the match was in play, before the big
   *  screen turns to highlights at that same minute) */
  channelAt(id: string, a: number): 1 | 2 | 3 { const c = SCREEN_CH.get(id) ?? 3; return c === 'featured' ? this.tv.bigChannel(a) : c; }
  private mapScreens(force = false) {
    // only the featured screens change channel, with the big screen, and every screen with the opening hours
    this.tvTick();
    const open = this.ctx.clock().open;
    if (!force && open === this.screenOpen && this.bigCh === this.screenBig) return;
    this.screenOpen = open; this.screenBig = this.bigCh;
    const uv = this.screenMesh.geometry.attributes.uv as THREE.BufferAttribute;
    SCREENS.forEach((s, i) => {
      const r = this.broadcast.uv(open ? this.channelOf(s.id) : 4);
      const q = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
      q.forEach(([u, v], k) => uv.setXY(i * 4 + k, u, v));
    });
    uv.needsUpdate = true;
  }
  setQuality(q: Quality, rebuildPeople: boolean) {
    if (!this.ctx) return;
    // a radial menu is pinned to a point on the screen: a change of graphics closes it (the person's "Say hi" included)
    this.closeRadial();
    this.items.setDetail(q !== 'low');
    for (const im of Object.values(this.items.meshes)) { im.onBeforeShadow = this.ctx.shadowHooks.before; im.onAfterShadow = this.ctx.shadowHooks.after; }
    const oldTex = this.broadcast.texture;
    this.broadcast.setQuality(q);
    if (this.broadcast.texture !== oldTex) { const m = this.ctx.mats.screen; m.map = this.broadcast.texture; m.emissiveMap = this.broadcast.texture; m.needsUpdate = true; }
    this.broadcast.update(this.T, performance.now() / 1000, true);
    if (rebuildPeople) this.buildCrew(q);
    this.crowd?.setQuality(q, rebuildPeople);
  }

  // ------------------------------------------------------------------------------------------------ time
  /** the page's clock moved (a set clock, a test, the live clock's minute): sim time follows it. A clock that was set
   *  (`reset`; the live clock's minute ticks aren't) starts sim time afresh from it, even when it's set to the same
   *  reading again */
  syncClock(reset = false) {
    const c = this.ctx?.clock(); if (!c) return;
    const key = c.live ? 'live' : `${c.day}:${c.hour}`;
    if (key !== this.clockKey || reset) { this.clockKey = key; if (!c.live || reset) this.drift = 0; }
    this.deviceWeek = isoWeek(new Date());
    const T1 = this.clockMinute() + this.drift;
    if (this.synced && T1 !== this.T) this.rebase(T1 - this.T);
    this.T = T1; this.synced = true;
    if (reset && this.crowd) this.crowd.settle(true);
  }
  private synced = false;
  /** sim time jumped by d minutes without being lived through (a set clock, a pinned week): every timer that counts in
   *  absolute sim time keeps the time it had left (the next sip, an order's wait, an action's start, a dance, the
   *  reservations, the moodlets' fading, the nudges' spacing), so a clock set back can't stall them and one set forward
   *  can't skip them */
  private rebase(dMin: number) {
    const dS = dMin * SECS;
    for (const k of KINDS) { const h = this.held[k]; if (h) h.next += dS; }
    for (const o of this.orders) { o.readyAt += dS; o.start += dS; }
    for (const a of this.queue.items) if (a.t0 !== undefined) a.t0 += dS;
    if (this.dancing) { this.dancing.until += dS; this.dancing.next += dS; }
    if (this.watching) this.watching.since += dMin;
    this.res.shift(dS); this.moodlets.shift(dMin);
    this.nudgeT += dMin;
    if (this.teamMomentAt !== undefined) this.teamMomentAt += dMin;
    if (this.teamLostAt !== undefined) this.teamLostAt += dMin;
    if (this.toastAt >= 0) this.toastAt += dS;
    if (this.capAt >= 0) this.capAt += dS;
    this.tvMin = NaN;
  }
  private clockMinute() {
    const c = this.ctx.clock();
    if (c.live) { const l = C.liveClock(); return absMinute(this.weekNow(), l.day, l.hour); }
    return absMinute(this.weekNow(), c.day, c.hour);
  }
  /** the sim's day and hour now */
  now() { return fromAbs(this.T); }

  // ------------------------------------------------------------------------------------------------ the frame
  /** once a frame, after the camera and your avatar have moved: sim time, needs, actions, staff, items, screens, HUD */
  update(dt: number, hideAvatar: boolean) {
    const c = this.ctx; if (!c) return;
    // S3a: the build scheduler checks the gap here, at the top of the update and before the render
    this.crowd.frame(dt, c.visState(), c.avatarDrawn());
    const paused = c.hud.paused || c.barHud.isOpen('needsSheet') || c.barHud.isOpen('guide') || c.barHud.isOpen('tired');
    const realNow = performance.now() / 1000;
    if (!paused) {
      const dMin = (dt / 60) * this.timeScale;
      this.drift += c.clock().live ? (dt / 60) * (this.timeScale - 1) : dMin;
      const T1 = this.clockMinute() + this.drift;
      this.simulate(T1 - this.T, dt);
    }
    this.afterAvatar(dt, hideAvatar);
    this.games.frame(dt);
    this.drawItems();
    this.broadcast.reduced = c.reduced();
    if (c.clock().open) this.broadcast.update(this.T, realNow);
    this.mapScreens();
    if (this.cheerT > 0) { this.cheerT -= dt; if (this.cheerT <= 0) c.barHud.cheer(false); }
    this.refreshHud();
    if (this.dirty && realNow - this.savedAt > 5) this.persist();
  }
  /** advance the sim by dMin sim minutes (the frame's share, or a fast-forward step); dtReal drives the walking staff */
  private simulate(dMin: number, dtReal: number) {
    if (dMin <= 0) return;
    const T0 = this.T, T1 = T0 + dMin;
    this.T = T1;
    this.stepNeeds(dMin);
    this.stepActions(dMin * SECS);
    this.stepOrders(dMin * SECS);
    // the staff walk on real time at 1x, sim time when sped up or fast-forwarding
    const staffDt = Math.max(dtReal, dMin * SECS);
    // (S3a: the crowd steps every bartender, server, the host and the barback; the house player is life's)
    this.house.update(staffDt);
    this.crowd?.step(dMin * SECS, dtReal);
    // S2b: the games' physics and the house's turns, in sim seconds
    this.games.update(dMin * SECS);
    for (const e of this.tv.eventsBetween(T0, T1)) this.moment(e);
    this.time(dMin);
  }
  /** fast-forward: needs, actions, orders, the staff and the matches, deterministically, one sim second at a time;
   *  your walks are stepped as the page steps them. The device clock doesn't move. */
  fastForward(min: number) {
    const c = this.ctx, steps = Math.round((min * SECS) / SIM_STEP_S);
    // what was on screen belongs to the time before the jump
    this.clearMessages();
    // S3a: every pending body first (the plan: fastForward() and pose() build up to the live cap before they measure)
    this.crowd.buildAll();
    for (let i = 0; i < steps; i++) {
      if (c.player.path) for (let k = 0; k < 60 * SIM_STEP_S; k++) { c.player.step({ x: 0, y: 0, run: false }); if (!c.player.path) break; }
      this.drift += SIM_STEP_S / SECS;
      this.simulate(this.clockMinute() + this.drift - this.T, SIM_STEP_S);
    }
    this.crowd.topUp(); this.crowd.relayFillers();
    this.broadcast.update(this.T, performance.now() / 1000, true);
    this.mapScreens(); this.refreshHud(true);
    // a toast or a caption from early in the jump has had its time (in sim seconds) by its end
    const now = this.T * SECS;
    if (this.toastAt >= 0 && now - this.toastAt > this.toastFor) { c.hud.clearToast(/[\s\S]/); this.toastAt = -1; }
    if (this.capAt >= 0 && now - this.capAt > this.capFor) { c.hud.caption(null, ''); this.capAt = -1; }
    return this.hooks().needs();
  }

  /** S2b: the page's camera hook (after your own view is placed): a game's own view on your turn; true while it shows */
  gameCamera(cam: THREE.PerspectiveCamera, dt: number) { return this.games ? this.games.camera(cam, dt) : false; }
  get gameCamOn() { return !!this.games && this.games.camOn; }
  /** the pool table's overhead view is showing (blending in, on, or blending back): your avatar would stand just under
   *  its camera, at the frame's edge, so the page hides it then (darts and shuffleboard show it over your shoulder) */
  get gameHidesYou() { return !!this.games && this.games.camOn && this.games.cams.shown === 'pool'; }
  /** take every toast and caption down (the clock was set, or a fast-forward starts) */
  clearMessages() { if (!this.ctx) return; this.ctx.hud.clearToast(/[\s\S]/); this.ctx.hud.caption(null, ''); this.toastAt = this.capAt = -1; }
  /** a toast from the life layer (its sim time noted, for the fast-forward) */
  tell(text: string, seconds = 3) { this.ctx.hud.toast(text, seconds); this.toastAt = this.T * SECS; this.toastFor = seconds; }
  /** a staff member's caption (its sim time noted, for the fast-forward) */
  private say(who: string, text: string, seconds = 3) { this.ctx.hud.caption(who, text, seconds); this.capAt = this.T * SECS; this.capFor = seconds; }

  // ------------------------------------------------------------------------------------------------ needs and mood
  private doing(): Doing {
    const p = this.ctx.player, a = this.queue.current;
    const posture = p.seat ? 'sit' : p.path ? 'walk' : 'stand';
    let fun: FunKind | undefined, match = 1;
    if (a && a.stage === 'doing') {
      if (a.action === 'watch' || a.action === 'stand-watch') { fun = 'watch'; match = this.watching ? this.matchFactor(this.watching.screen) : 1; }
      else if (a.action === 'dance') fun = 'dance';
      else if (a.action === 'song') fun = 'music';
      else if (a.action === 'people-watch' || a.action === 'watch-game') fun = 'people-watch';
      else if (a.action === 'watch-freeway') fun = 'freeway';
    }
    // S2b: in a game (your turn or the house's), the game's rates
    const gm = this.games?.mine; if (gm) fun = gm.kind;
    // one object, filled in place (this runs every frame)
    const d = this._doing; d.posture = posture; d.fun = fun; d.match = match; d.eating = !!this.held.food && this.held.food.left > 0; d.watchers = 0;
    return d;
  }
  /** x1.6 while the screen watched shows the featured match in play, otherwise 1 */
  matchFactor(screen: string) {
    const ch = this.channelOf(screen); if (ch === 3) return 1;
    return (ch === 1 ? this.feat1 : this.feat2) ? 1.6 : 1;
  }
  private rate = {} as Record<Need, number>;
  private stepNeeds(dMin: number) {
    const d = this.doing(), r = rates(d, this.traits, this.rate);
    // eating: the basket's hunger is eaten at +10 a minute until it's gone
    if (this.held.food && d.eating) { const eat = Math.min(this.held.food.left, 10 * dMin); this.held.food.left -= eat; r.hunger = -0.8 + eat / dMin; }
    advance(this.needs, r, dMin);
    this.needs.bladder = 100;                         // the player has no bladder need (NPCs' hidden sixth)
    this.moodlets.prune(this.T);
    // the heaters' +2 at night within 2.5 m (the patio)
    const c = this.ctx, p = c.player, [u, v] = c.F.toFrame(p.x, p.z);
    let warm = false;
    if (c.clock().night > 0.5) for (let i = 0; i < HEATERS.length; i++) if (Math.hypot(u - HEATERS[i][0], v - HEATERS[i][1]) < 2.5) warm = true;
    this.moodlets.hold('heater', warm, this.T);
    // the meters' nudges and the tired prompt
    for (const k of SHOWN) {
      const low = this.needs[k] < 30;
      if (low && !this.lowWas[k] && this.T - this.nudgeT > 1) { this.nudgeT = this.T; this.tell(this.nudge(k), 4); this.note('nudge ' + k); }
      this.lowWas[k] = low;
    }
    if (this.needs.energy < 10 && !this.tiredShown) { this.tiredShown = true; this.ctx.barHud.sheet('tired', true); }
    if (this.needs.energy > 20) this.tiredShown = false;
  }
  private nudge(k: ShownNeed) {
    const p = this.ctx.player, d = (u: number, v: number) => { const [x, z] = this.ctx.F.fromFrame(u, v); return Math.round(Math.hypot(x - p.x, z - p.z)); };
    if (k === 'thirst') return `Thirsty: the bar's ${d(20.4, 12.9)} m away`;
    if (k === 'hunger') return `Hungry: order at the bar or a table (${d(20.4, 12.9)} m)`;
    if (k === 'fun') return `Bored: the big screen's ${d(33.5, 4.75)} m away`;
    if (k === 'social') return 'Lonely: the standing floor fills up for the big match';
    return 'Tired: find a seat';
  }
  moodNow() {
    const m = moodOf(this.needs, this.traits, this.moodlets.sum(this.T)), label = moodLabel(m);
    const emotion = emotionOf({ needs: this.needs, traits: this.traits, mood: m, now: this.T, teamMomentAt: this.teamMomentAt, teamLostAt: this.teamLostAt, wonGameAt: this.wonGameAt });
    return { value: m, label, emotion, average: needsAverage(this.needs, this.traits) };
  }
  /** a moment on a screen: the GOAL banner is the broadcast's; here the Cheer button, the moodlets for your team */
  private moment(e: TvEvent) {
    // S3a: the crowd reacts (everyone who can see a screen on that channel), wherever you are
    if (this.crowd) { const f = this.fixtureOf(e), d = fromAbs(e.t), bd = d.hour < 2 ? (d.day + 6) % 7 : d.day; this.crowd.moment(e, e.kind === 'final' && !!f?.featured && (bd === 5 || bd === 6)); }
    const c = this.ctx, p = c.player, [u, v] = c.F.toFrame(p.x, p.z), here = c.clock().open && (c.def.indoor(u, v) || (u > 2 && u < 24 && v < 0.3 && v > -5.5));
    if (!here) return;
    const f = this.fixtureOf(e);
    // the plan: "a big Cheer button appears for 8 s after any moment" (a goal, a big chance, a touchdown, a field goal,
    // a big play or a final whistle)
    this.lastMoment = e; this.cheerT = 8; c.barHud.cheer(true);
    const mine = !!this.team && !!f && (f.home.abbr === this.team || f.away.abbr === this.team);
    if (e.kind === 'goal' || e.kind === 'td' || e.kind === 'fg') {
      if (mine) {
        if (e.team === this.team) { this.moodlets.add('goal-for', this.T); this.teamMomentAt = this.T; } else { this.moodlets.add('goal-against', this.T); this.teamMomentAt = this.T; }
      }
    } else if (e.kind === 'final' && f) {
      if (mine && e.team) {
        if (e.team === this.team) this.moodlets.add('team-won', this.T); else { this.moodlets.add('team-lost', this.T); this.teamLostAt = this.T; }
      }
      // tonight's three: a match watched to the final whistle. The screen's channel is taken just before the whistle:
      // at the whistle's own minute the big screen (and the screens that follow it) has already turned to highlights
      const w = this.watching;
      if (w && this.channelAt(w.screen, e.t - 0.5 / SECS) === e.channel && e.t - w.since > 1) this.goal('watch-final');
    }
  }
  fixtureOf(e: TvEvent): Fixture | null { const d = fromAbs(e.t); return this.tv.fixtures(d.week, d.day).find((f) => f.id === e.fixture) ?? null; }
  /** a cheer: your avatar's arms go up (an upper-body overlay when seated) */
  cheer() {
    const p = this.ctx.person(); if (!p) return false;
    this.clips.play(p, 'cheer', { upper: !!this.ctx.player.seat, jump: this.traits.active > 0.6 ? 0.1 : 0 });
    this.cheerT = 0; this.ctx.barHud.cheer(false);
    const m = this.lastMoment;
    if (m && this.team && m.team === this.team && (m.kind === 'goal' || m.kind === 'td' || m.kind === 'fg' || m.kind === 'final')) this.teamMomentAt = this.T;
    return true;
  }
  /** a minute in the bar: 1 token per 5 minutes (at most 12 a visit) */
  private time(dMin: number) {
    const c = this.ctx, p = c.player, [u, v] = c.F.toFrame(p.x, p.z);
    if (!c.clock().open || !(c.def.indoor(u, v) || (u > 2 && u < 24 && v < 0.3 && v > -5.5))) return;
    this.inBarMin += dMin;
    const earned = Math.min(EARN.perVisitTimeCap, Math.floor(this.inBarMin / 5));
    if (earned > this.tokensFromTime) { this.save.tokens += earned - this.tokensFromTime; this.tokensFromTime = earned; this.dirty = true; }
  }
  goal(g: GoalId) {
    if (!this.tonight.goals.includes(g) || this.tonight.done.includes(g)) return;
    this.tonight.done.push(g); this.save.tokens += EARN.tonightsGoal; this.dirty = true;
    if (this.save.tonight) this.save.tonight.done = this.tonight.done;
    this.tell(`Tonight's three: ${GOALS[g]} · +5 house tokens`, 3.5); this.note('goal ' + g);
  }

  // ------------------------------------------------------------------------------------------------ objects and adverts
  objectById(id: string) { return this.objects.find((o) => o.id === id) ?? null; }
  /** a slot's local positions */
  slot(id: string) { return this.slots.get(id) ?? null; }
  private seatOf(slotId: string): Seat | null { const s = this.slots.get(slotId); return s && s.seatId !== undefined ? this.ctx.venue.seats[s.seatId] : null; }
  /** the requirement checks for the player */
  private allowed(req: string, obj: SmartObject) {
    const c = this.ctx, d = this.now();
    switch (req) {
      case 'open': return c.clock().open;
      case 'staffed': return c.clock().open;
      case 'gameNight': return this.tv.gameNight(this.weekNow(), d.day, d.hour);
      // not holding one (an empty doesn't count: it's set down when the next arrives), none on order, none queued
      case 'notHolding:drink': return !this.holds('drink') && !this.orders.some((o) => o.kind === 'drink') && !this.queue.items.some((q) => q.action === 'order-drink');
      case 'notHolding:food': return !this.holds('food') && !this.orders.some((o) => o.kind === 'food') && !this.queue.items.some((q) => q.action === 'order-food');
      case 'holding:food': return !!this.held.food;
      case 'holding:drink': return !!this.held.drink;
      case 'seated': return true;                           // table service seats you first if you're standing
      case 'screenInView': return obj.type !== 'screen' || this.bestSlotFor(obj.id) !== null || this.screenInView(obj.id.slice(7), c.player.x, c.player.z, null) || this.standSpotFor(obj.id) !== null;
      case 'npcOnly': return false;
    }
    return true;
  }
  /** holding a drink or food that isn't finished */
  private holds(k: 'drink' | 'food') { const h = this.held[k]; return !!h && h.left > 0; }
  /** what an object offers you now (the radial menu's verbs) */
  offers(objectId: string): { action: string; label: string }[] {
    const o = this.objectById(objectId); if (!o) return [];
    const T = TYPES[o.type]; if (!T) return [];
    const out: { action: string; label: string }[] = [];
    for (const a of T.adverts) {
      const sp = this.games.spot(o.id);
      if (a.action === 'watch-pool') continue;                                       // the crowd's; yours is Watch (below)
      if (a.action.startsWith('play-') && (sp?.mine || sp?.npcBusy)) continue;      // you're playing here already, or guests are
      if (a.action === 'chat' || a.action === 'lean-chat' || a.action === 'eat') continue;   // chat with people through their menus (S3b); eating is automatic
      if (a.action === 'watch' && o.type !== 'screen' && !this.screenFrom(o)) continue;
      if (!(a.requires ?? []).every((r) => this.allowed(r, o))) continue;
      out.push({ action: a.action, label: a.label });
    }
    // S3b: guests playing on a game spot: watch them (and you're next there: openRadial queues you)
    const gs = this.games.spot(o.id);
    if (gs && gs.npcBusy && !gs.mine) out.push({ action: 'watch-game', label: gs.kind === 'pool' ? 'Watch pool' : gs.kind === 'darts' ? 'Watch darts' : 'Watch shuffleboard' });
    // the big screen also offers the standing floor and, on game nights, the dance spot
    if (o.id === 'screen-big') {
      const sf = this.objectById('standing-floor')!, ds = this.objectById('dance-spot')!;
      for (const [obj, act] of [[sf, 'stand-watch'], [ds, 'dance']] as [SmartObject, string][]) {
        const a = TYPES[obj.type].adverts.find((x) => x.action === act)!;
        if ((a.requires ?? []).every((r) => this.allowed(r, obj))) out.push({ action: `${obj.id}:${act}`, label: a.label });
      }
    }
    return out.slice(0, 6);
  }
  /** a screen in view from a point: within 25 m, the point in front of it, no tall collider between, and (seated)
   *  within 60 degrees of the seat's facing */
  screenInView(screenId: string, x: number, z: number, faceYaw: number | null) {
    const s = SCREENS.find((q) => q.id === screenId); if (!s) return false;
    const F = this.ctx.F, [sx, sz] = F.fromFrame(s.at[0], s.at[1]), [fx, fz] = F.dirToLocal(s.face[0], s.face[1]);
    const dx = x - sx, dz = z - sz, d = Math.hypot(dx, dz);
    if (d > 25 || d < 0.5 || dx * fx + dz * fz <= 0.1 * d) return false;
    if (faceYaw !== null) { const lx = Math.sin(faceYaw), lz = Math.cos(faceYaw); if ((-dx * lx - dz * lz) / d < 0.5) return false; }
    const ex = sx + (dx / d) * 0.45, ez = sz + (dz / d) * 0.45;
    return this.ctx.set.ray(x, z, ex, ez, isTall) >= 1;
  }
  /** the best screen from an object's place (a table, the bar): the big screen first, then the nearest in view */
  private screenFrom(o: SmartObject): string | null {
    const [x, z] = this.ctx.F.fromFrame(o.at[0], o.at[1]);
    const ids = ['big', ...SCREENS.filter((s) => s.id !== 'big').map((s) => s.id)];
    for (const id of ids) if (this.screenInView(id, x, z, null)) return id;
    return null;
  }
  /** a free slot to watch a screen from, nearest to you: seats and spots with it in view */
  private bestSlotFor(objId: string): Slot | null {
    const id = objId.startsWith('screen-') ? objId.slice(7) : objId, p = this.ctx.player;
    let best: Slot | null = null, bd = Infinity;
    for (const s of this.slots.values()) {
      if (s.kind === 'staff' || s.id.startsWith(YOUR_SPOT) || !this.freeForYou(s.id)) continue;
      const seat = this.seatOf(s.id);
      if (!this.screenInView(id, s.x, s.z, seat ? seat.face : null)) continue;
      const d = Math.hypot(s.sx - p.x, s.sz - p.z); if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  /** S3a: with every place that sees a screen taken by the crowd, a place to stand and watch it from: clear floor 2.5 to
   *  9 m in front of it with it in view, on the same side of the wall (the patio's inside its rail), clear of people and
   *  of every place the crowd uses; nearest to you. It's yours only (the crowd's slots don't include it) */
  private standSpotFor(objId: string): Slot | null {
    if (!this.crowd) return null;
    const id = objId.startsWith('screen-') ? objId.slice(7) : objId, sc = SCREENS.find((q) => q.id === id); if (!sc) return null;
    const c = this.ctx, F = c.F, p = c.player, [fu, fv] = sc.face, inside = c.def.indoor(sc.at[0] + fu * 0.6, sc.at[1] + fv * 0.6);
    let best: number[] | null = null, bd = Infinity;
    for (let d = 2.5; d <= 9; d += 0.75) for (let l = -3; l <= 3; l += 0.75) {
      const u = sc.at[0] + fu * d - fv * l, v = sc.at[1] + fv * d + fu * l;
      if (c.def.indoor(u, v) !== inside) continue;
      if (!inside && (u < PATIO.u0 + 0.4 || u > PATIO.u1 - 0.4 || v < PATIO.v0 + 0.5 || v > -0.4)) continue;
      const [x, z] = F.fromFrame(u, v);
      if (!c.grid.isFree(x, z) || !this.screenInView(id, x, z, null) || !this.crowd.clearAt(x, z, 0.8, 0.6)) continue;
      const dd = Math.hypot(x - p.x, z - p.z) + 0.3 * Math.abs(l); if (dd < bd) { bd = dd; best = [u, v, x, z]; }
    }
    if (!best) return null;
    // two of them, so the one you're standing at keeps its place while another screen's is found
    const [u, v, x, z] = best, at: P2 = [u, v], id2 = this.res.holder(YOUR_SPOT) === 'you' ? `${YOUR_SPOT} 2` : YOUR_SPOT;
    const s: Slot = { id: id2, zone: inside ? 'standing floor' : 'patio', kind: 'stand', at, face: [-fu, -fv], y: 0, stand: at, r: 0.3, x, z, sx: x, sz: z };
    this.slots.set(id2, s);
    return s;
  }
  /** the nearest free slot of an object (for walking to it), and whether you're at one already */
  private freeSlotOf(o: SmartObject, filter?: (s: Slot) => boolean): Slot | null {
    const p = this.ctx.player; let best: Slot | null = null, bd = Infinity;
    for (const id of o.slots) {
      const s = this.slots.get(id); if (!s || (filter && !filter(s))) continue;
      if (!this.freeForYou(id)) continue;
      const d = Math.hypot(s.sx - p.x, s.sz - p.z); if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  private atSlotOf(o: SmartObject): Slot | null {
    const p = this.ctx.player;
    for (const id of o.slots) {
      const s = this.slots.get(id); if (!s) continue;
      const seat = this.seatOf(id);
      if (seat && p.seat === seat) return s;
      if (!seat && !p.seat && Math.hypot(s.x - p.x, s.z - p.z) < 0.7) return s;
    }
    return null;
  }

  // ------------------------------------------------------------------------------------------------ the action queue
  /** queue an action on an object (the radial menu, the hooks): it walks there first */
  use(objectId: string, action: string, item?: string): { ok: boolean; why?: string; id?: number } {
    let oid = objectId, act = action;
    if (action.includes(':')) [oid, act] = action.split(':');
    const o = this.objectById(oid); if (!o) return { ok: false, why: 'no such object: ' + oid };
    if (act === 'watch-game' || act === 'watch-pool') return this.watchGame(o);
    const T = TYPES[o.type], adv = T?.adverts.find((a) => a.action === act);
    if (!adv) return { ok: false, why: `${oid} offers no ${act}` };
    if (T.later?.includes(act)) return { ok: false, why: `${adv.label} comes with the crowd (S3a)` };
    if (act.startsWith('play-') && this.games.spot(oid)?.mine) return { ok: false, why: 'you are playing here already' };
    for (const r of adv.requires ?? []) if (!this.allowed(r, o)) return { ok: false, why: `needs ${r}` };
    // a continuous action you're in gives way to the next one queued
    const cur = this.queue.current;
    if (cur && cur.stage === 'doing' && this.isContinuous(cur.action)) this.finish(cur, 'next');
    const icon = act.startsWith('order-drink') || act === 'water' ? (act === 'water' ? 'water' : 'drink') : act === 'order-food' ? 'food' : act === 'dance' ? 'dance' : act === 'song' ? 'music' : act.startsWith('play-') ? 'game' : act.includes('watch') ? 'watch' : 'sit';
    const q = this.queue.add({ action: act, object: oid, label: `${adv.label} · ${o.label}`, icon, item });
    if (!q) return { ok: false, why: 'the queue is full (3)' };
    // S3b: a game spot you chose is held for you while you walk there (guests don't start on it)
    if (this.isGame(act)) this.crowd?.social.games.holdYou(oid, 90);
    this.note(`queued ${act} at ${oid}`);
    if (this.queue.current === q) this.start(q);
    return { ok: true, id: q.id };
  }
  /** S3b: watch a game spot (guests playing there): stand at a free watcher's place by it, facing the game */
  private watchGame(o: SmartObject): { ok: boolean; why?: string; id?: number } {
    const sp = this.games.spot(o.id); if (!sp) return { ok: false, why: `${o.label} isn't a game` };
    if (sp.mine) return { ok: false, why: 'you are playing here already' };
    const cur = this.queue.current;
    if (cur && cur.stage === 'doing' && this.isContinuous(cur.action)) this.finish(cur, 'next');
    const q = this.queue.add({ action: 'watch-game', object: o.id, label: `Watch · ${sp.label}`, icon: 'watch' });
    if (!q) return { ok: false, why: 'the queue is full (3)' };
    this.note(`queued watch-game at ${o.id}`);
    if (this.queue.current === q) this.start(q);
    return { ok: true, id: q.id };
  }
  /** the free place nearest a game spot to watch it from: a pool watcher's by that table, a darts watcher's by that
   *  board, the shuffleboard's sides */
  private watchSlotFor(spotId: string): Slot | null {
    const sp = this.games.spot(spotId); if (!sp) return null;
    const ids: string[] = [];
    const tableU = sp.kind === 'pool' ? POOL_TABLES[Number(spotId.slice(5)) - 1]?.[0] ?? 0 : 0;
    for (const s of this.slots.values()) {
      if (sp.kind === 'pool' && s.id.startsWith('pool watcher') && Math.abs(s.at[0] - tableU) < 4.2) ids.push(s.id);
      else if (sp.kind === 'darts' && s.id.startsWith('darts watcher')) ids.push(s.id);
      else if (sp.kind === 'shuffleboard' && s.id.startsWith('shuffleboard side')) ids.push(s.id);
    }
    const [sx, sz] = sp.startW; let best: Slot | null = null, bd = Infinity;
    for (const id of ids) { const s = this.slot(id); if (!s || !this.freeForYou(id)) continue; const d = Math.hypot(s.x - sx, s.z - sz); if (d < bd) { bd = d; best = s; } }
    if (best) return best;
    // every watcher's place taken on a busy night: clear floor 1.6 to 4.5 m from the game, inside, nearest you
    const c = this.ctx, F = c.F, p = c.player, o = this.objectById(spotId); if (!o) return null;
    let at: number[] | null = null; bd = Infinity;
    for (let d = 1.6; d <= 4.5; d += 0.6) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, u = o.at[0] + Math.cos(a) * d, v = o.at[1] + Math.sin(a) * d;
      if (!c.def.indoor(u, v)) continue;
      const [x, z] = F.fromFrame(u, v);
      if (!c.grid.isFree(x, z) || !this.crowd.clearAt(x, z, 0.8, 0.6)) continue;
      const dd = Math.hypot(x - p.x, z - p.z) + 0.5 * d; if (dd < bd) { bd = dd; at = [u, v, x, z]; }
    }
    if (!at) return null;
    const [u, v, x, z] = at, id = `${YOUR_SPOT} game`;
    const s: Slot = { id, zone: sp.kind, kind: 'stand', at: [u, v], face: [o.at[0] - u, o.at[1] - v], y: 0, stand: [u, v], r: 0.3, x, z, sx: x, sz: z };
    this.slots.set(id, s);
    return s;
  }
  /** S3a: the one-person spot you're waiting for (the jukebox's, the water station's): the crowd leaves it to you */
  get yourNext(): string | null { const a = this.queue.current; return a && a.stage === 'queued' && this.nextSince.has(a.id) ? (a.action === 'water' ? 'water' : 'jukebox spot') : null; }
  private nextSince = new Map<number, number>();
  private isContinuous(a: string) { return a === 'watch' || a === 'stand-watch' || a === 'sit' || a === 'people-watch' || a === 'watch-freeway' || a === 'watch-game'; }
  private isGame(a: string) { return a === 'play-pool' || a === 'play-darts' || a === 'play-shuffleboard'; }
  private walkTo(a: QueuedAction, s: Slot) {
    const p = this.ctx.player, seat = this.seatOf(s.id);
    if (!this.freeForYou(s.id)) return false;
    const x0 = p.x, z0 = p.z;
    const path = seat ? p.goTo(seat.ax, seat.az, { seat }) : p.goTo(s.x, s.z, { spot: s.id });
    if (!path) { this.tell("Can't get there from here.", 2); return false; }
    // the plan's reservation: the walk there (its path at walking pace) plus 10 s
    this.res.reserve(s.id, 'you', this.T * SECS + pathLen(x0, z0, path) / WALK + 10);
    a.slot = s.id;
    a.stage = 'walking';
    return true;
  }
  /** start the queue's current action: walk to its slot, or do it where you are */
  private start(a: QueuedAction) {
    const o = this.objectById(a.object)!, p = this.ctx.player;
    let ok = true;
    switch (a.action) {
      case 'order-drink': case 'order-food': {
        if (o.type === 'bar-counter') { const at = this.atSlotOf(o); if (at) { a.slot = at.id; this.res.use(at.id, 'you'); this.doNow(a); } else { const s = this.freeSlotOf(o); ok = !!s && this.walkTo(a, s); } }
        else { const at = this.atSlotOf(o); if (at) { a.slot = at.id; this.doNow(a); } else { const s = this.freeSlotOf(o, (x) => x.kind === 'seat'); ok = !!s && this.walkTo(a, s); } }
        break;
      }
      case 'watch': {
        const scr = o.type === 'screen' ? o.id.slice(7) : this.screenFrom(o);
        if (!scr) { ok = false; break; }
        a.item = scr;
        if (o.type !== 'screen') { const at = this.atSlotOf(o); if (at) { a.slot = at.id; this.doNow(a); break; } const s = this.freeSlotOf(o, (x) => this.screenInView(scr, x.x, x.z, this.seatOf(x.id)?.face ?? null)); ok = !!s && this.walkTo(a, s); break; }
        if (this.screenInView(scr, p.x, p.z, p.seat ? p.seat.face : null)) { this.doNow(a); break; }
        const s = this.bestSlotFor(o.id) ?? this.standSpotFor(o.id); ok = !!s && this.walkTo(a, s);
        break;
      }
      case 'stand-watch': { a.item = 'big'; const at = this.atSlotOf(o); if (at) { a.slot = at.id; this.doNow(a); } else { const s = this.freeSlotOf(o); ok = !!s && this.walkTo(a, s); } break; }
      case 'dance': { const at = this.atSlotOf(o); if (at) { a.slot = at.id; this.doNow(a); } else { const s = this.freeSlotOf(o); ok = !!s && this.walkTo(a, s); } break; }
      case 'water': case 'song': {
        const s = this.slot(a.action === 'water' ? 'water' : 'jukebox spot')!;
        if (Math.hypot(s.x - p.x, s.z - p.z) < 0.7 && !p.seat) { this.doNow(a); break; }
        // S3a: a one-person spot someone in the crowd is using: you're next (nobody else starts there after them), the
        // action stays queued and starts once they're done; after 2 sim minutes it gives up
        if (this.crowd && this.crowd.slotTaken(s.id, 'you')) {
          const t0 = this.nextSince.get(a.id);
          if (t0 === undefined) { this.nextSince.set(a.id, this.T * SECS); this.tell(`${a.label.split(' · ')[0]}: someone's there, you're next`, 2.5); this.note(`${a.action} waits for ${s.id}`); return; }
          if (this.T * SECS - t0 < 120) return;
          ok = false; break;
        }
        ok = this.walkTo(a, s); break;
      }
      case 'sit': case 'people-watch': case 'watch-freeway': { const at = this.atSlotOf(o); if (at && this.seatOf(at.id)) { a.slot = at.id; this.doNow(a); } else { const s = this.freeSlotOf(o, (x) => x.kind === 'seat'); ok = !!s && this.walkTo(a, s); } break; }
      // S3b: watch guests' game from a watcher's place by it
      case 'watch-game': { const s = this.watchSlotFor(o.id); if (s && Math.hypot(s.x - p.x, s.z - p.z) < 0.7 && !p.seat) { a.slot = s.id; this.doNow(a); } else ok = !!s && this.walkTo(a, s); break; }
      // S2b: walk to where the game begins (the head of the table, the oche, the shuffleboard's end), then play
      case 'play-pool': case 'play-darts': case 'play-shuffleboard': { const s = this.slot(`${o.id} player`)!; if (Math.hypot(s.x - p.x, s.z - p.z) < 0.7 && !p.seat) { a.slot = s.id; this.doNow(a); } else ok = this.walkTo(a, s); break; }
      default: ok = false;
    }
    this.nextSince.delete(a.id);
    if (!ok) { this.tell(`${a.label.split(' · ')[0]}: no free place right now`, 2.5); this.queue.cancel(a.id); this.next(); }
  }
  /** you've arrived at a slot (Lot 57's player tells the page when a walk with a goal ends) */
  private arrived(spot: string) {
    const a = this.queue.current; if (!a || a.stage !== 'walking' || a.slot !== spot) return;
    const s = this.slot(spot); if (s) { const [fx, fz] = this.ctx.F.dirToLocal(s.face[0], s.face[1]); this.ctx.player.yaw = this.ctx.player.heading = Math.atan2(fx, fz); }
    this.doNow(a);
  }
  private doNow(a: QueuedAction) {
    const c = this.ctx, p = c.player;
    a.stage = 'doing'; a.t0 = this.T * SECS; this.startPos.set(a.id, [p.x, p.z]);
    if (a.slot) this.res.use(a.slot, 'you');
    const r = mulberry(hash32('dur', a.id, Math.floor(this.T)));
    switch (a.action) {
      case 'order-drink': case 'order-food': {
        const kind = a.action === 'order-drink' ? 'drink' : 'food', o = this.objectById(a.object)!;
        const where = o.type === 'bar-counter' ? 'bar' : 'table';
        // one menu at a time: with a menu open, an order at the counter that needs one waits in the queue (its icon
        // stays) until that menu is answered or closed, then opens its own
        if (where === 'bar' && !a.item && this.menuFor) { a.stage = 'waiting'; this.note(`${a.action} waits for the open menu`); return; }
        const ord: Order = { id: this.orderId++, item: a.item ? itemById(a.item) : null, kind, where, stage: 'choosing', t: 0, readyAt: 0, start: this.T * SECS, label: '', seat: p.seat };
        this.orders.push(ord);
        if (where === 'bar') { if (ord.item) this.placeBarOrder(ord); else this.openMenu(ord, 'Bartender', 'Hey. What can I get you?'); }
        else { ord.stage = 'server-coming'; this.callServer(ord); }
        // ordering is an overlay: the queue moves on (the order carries on by itself)
        this.finish(a, 'done');
        return;
      }
      case 'watch': case 'stand-watch': {
        const scr = a.item ?? 'big';
        this.watching = { screen: scr, since: this.T };
        this.faceScreen(scr);
        a.dur = Infinity;
        return;
      }
      case 'dance': { a.dur = (3 + 2 * r()) * SECS; this.dancing = { clip: DANCES[Math.floor(r() * 3)], until: this.T * SECS + a.dur, next: this.T * SECS + 60 }; const pp = c.person(); if (pp) this.clips.play(pp, this.dancing.clip); return; }
      case 'water': a.dur = 15; return;
      case 'song': a.dur = 20; return;
      case 'sit': case 'people-watch': case 'watch-freeway': a.dur = Infinity; return;
      case 'watch-game': {
        // face the game: the table's or the bed's middle, or the board
        const o = this.objectById(a.object); if (o) { const [x, z] = c.F.fromFrame(o.at[0], o.at[1]); p.yaw = p.heading = Math.atan2(x - p.x, z - p.z); p.pitch = -0.25; }
        a.dur = Infinity; return;
      }
      case 'play-pool': case 'play-darts': case 'play-shuffleboard': {
        // the queue's other actions wait: a game runs until someone wins or you leave it
        a.dur = Infinity; if (a.slot) this.res.release(a.slot, 'you');
        this.games.begin(a.object, this.vsNext); this.vsNext = null; this.note(`game ${a.object} begun`);
        return;
      }
    }
  }
  private faceScreen(scr: string) {
    const c = this.ctx, p = c.player, s = SCREENS.find((q) => q.id === scr); if (!s) return;
    const [sx, sz] = c.F.fromFrame(s.at[0], s.at[1]), e = p.eyePos(new THREE.Vector3());
    const yaw = Math.atan2(sx - p.x, sz - p.z), pitch = Math.atan2(s.y - e.y, Math.hypot(sx - p.x, sz - p.z));
    if (p.seat) { const dy = Math.atan2(Math.sin(yaw - p.seat.face), Math.cos(yaw - p.seat.face)); p.yaw = p.seat.face + clamp(dy, -100 * Math.PI / 180, 100 * Math.PI / 180); }
    else { p.yaw = yaw; p.heading = yaw; }
    p.pitch = clamp(pitch, -0.9, 0.7);
  }
  /** the queue's actions tick: walks, timed actions, continuous ones */
  private stepActions(dS: number) {
    const c = this.ctx, p = c.player, a = this.queue.current;
    // reservations lapse 10 s after the walk's time; yours, still walking there, plans again: the same slot, if it's
    // still free (nobody else takes slots in S2a), for the rest of the walk plus 10 s
    const lost = this.res.lapse(this.T * SECS);
    if (lost.length && a && a.stage === 'walking' && a.slot && lost.includes('you') && this.res.free(a.slot, 'you')) {
      const s = this.slot(a.slot), seat = this.seatOf(a.slot), tx = seat ? seat.ax : s?.x ?? p.x, tz = seat ? seat.az : s?.z ?? p.z;
      this.res.reserve(a.slot, 'you', this.T * SECS + Math.hypot(tx - p.x, tz - p.z) / WALK + 10);
    }
    // sips and bites play automatically every 40 to 70 s
    this.sips(dS);
    if (!a) return;
    if (a.stage === 'queued') { this.start(a); return; }
    if (a.stage === 'waiting') {
      // an order waiting for the open menu: it goes ahead once the menu is answered; leaving the counter drops it
      const s = a.slot ? this.slot(a.slot) : null, seat = a.slot ? this.seatOf(a.slot) : null;
      const left = seat ? p.seat !== seat : s ? Math.hypot(s.x - p.x, s.z - p.z) > 0.9 : false;
      if (left) this.finish(a, 'left');
      else if (!this.menuFor) this.doNow(a);
      return;
    }
    if (a.stage === 'walking') {
      // moving the stick cancels the current walk, as at Lot 57
      const s = a.slot ? this.slot(a.slot) : null, seat = a.slot ? this.seatOf(a.slot) : null;
      if (!p.path) {
        if (seat && p.seat === seat) this.doNow(a);
        else if (s && Math.hypot(s.x - p.x, s.z - p.z) < 0.6) this.doNow(a);
        else { this.cancelled = a.label; this.finish(a, 'stopped'); }
      }
      return;
    }
    if (a.stage !== 'doing') return;
    const t = this.T * SECS - (a.t0 ?? 0);
    // leaving the spot ends what you were doing there
    const s = a.slot ? this.slot(a.slot) : null, seat = a.slot ? this.seatOf(a.slot) : null;
    const sp = this.startPos.get(a.id);
    const left = seat ? p.seat !== seat : s ? Math.hypot(s.x - p.x, s.z - p.z) > 0.9 : sp ? Math.hypot(sp[0] - p.x, sp[1] - p.z) > 0.9 : false;
    if (this.isGame(a.action)) { const sp = this.games.spot(a.object); if (!sp?.mine) this.finish(a, sp?.outcome ? 'done' : 'left'); return; }
    if (left && a.action !== 'order-drink' && a.action !== 'order-food') { this.finish(a, 'left'); return; }
    switch (a.action) {
      case 'water': if (t >= (a.dur ?? 15)) { bump(this.needs, { thirst: 20 }); this.clipYou('drink'); this.finish(a, 'done'); } break;
      case 'song': if (t >= (a.dur ?? 20)) { bump(this.needs, { fun: 6 }); this.songToast(); this.goal('song'); this.finish(a, 'done'); } break;
      case 'dance': {
        const d = this.dancing, pp = c.person();
        if (d && this.T * SECS >= d.next && pp) { d.next = this.T * SECS + 60; d.clip = DANCES[(DANCES.indexOf(d.clip) + 1) % 3]; this.clips.play(pp, d.clip); }
        if (t >= (a.dur ?? 180)) { this.goal('dance-game-night'); this.finish(a, 'done'); }
        else { const n = this.now(); if (!this.tv.gameNight(this.weekNow(), n.day, n.hour)) this.finish(a, 'the night ended'); }
        break;
      }
      case 'watch': case 'stand-watch': if (!c.clock().open) this.finish(a, 'closed'); break;
    }
  }
  private songToast() { const n = ['Late Merge', 'Golden Hour on the 5', 'Katella Nights', 'Carpool Lane', 'Sundown Signal'][Math.floor(this.T) % 5]; this.tell(`Picked a song: "${n}" · KFWY 96.9`, 3); }
  private clipYou(name: ClipName) { const p = this.ctx.person(); if (p && !this.dancing) this.clips.play(p, name, { upper: !!this.ctx.player.seat || name === 'drink' || name === 'eat' }); }
  private finish(a: QueuedAction, why: string) {
    if (a.slot) this.res.release(a.slot, 'you');
    this.nextSince.delete(a.id);
    this.startPos.delete(a.id);
    if (a.action === 'watch' || a.action === 'stand-watch') this.watching = null;
    if (this.isGame(a.action) && why === 'cancelled' && this.games.spot(a.object)?.mine) this.games.leave('cancelled');
    if (a.action === 'dance') { this.dancing = null; const p = this.ctx.person(); if (p && DANCES.includes(this.clips.playing(p) as ClipName)) this.clips.stop(p); }
    this.queue.cancel(a.id);
    this.note(`${a.action} ${why}`);
    this.next();
  }
  private next() { const n = this.queue.current; if (n && n.stage === 'queued') this.start(n); }
  cancel(id: number) {
    const a = this.queue.items.find((x) => x.id === id); if (!a) return false;
    if (a.stage === 'walking') { this.ctx.player.path = null; this.ctx.player.pathGoal = null; }
    this.finish(a, 'cancelled');
    return true;
  }

  // ------------------------------------------------------------------------------------------------ ordering
  /** the menu sheet (Lot 57's order sheet, our items): drinks or food */
  private openMenu(o: Order, who: string, hello: string) {
    const items = (o.kind === 'drink' ? DRINKS : FOODS).map((i) => ({ id: i.id, name: i.name, note: i.note, kind: i.kind }));
    // the callers wait while another menu is open; should one still be, it's dropped (one order choosing at a time)
    if (this.menuFor && this.menuFor !== o) this.dropOrder(this.menuFor, 'replaced');
    o.stage = 'choosing'; this.menuFor = o;
    this.ctx.hud.openOrder({ id: 'bar', title: o.kind === 'drink' ? `${BAR_NAME} · drinks` : `${BAR_NAME} · food`, hello, ready: '', making: '', items } as never, who);
    this.ctx.barHud.onSheet(true);
    void MENU_NOTE;
  }
  /** an item picked on the menu: it answers the open menu's order if it's of that order's kind (a drink for a drink
   *  order, food for a food order); an item of the other kind answers nothing */
  private orderPicked(id: string) {
    const it = itemById(id), o = this.menuFor;
    if (!it || !o || o.stage !== 'choosing' || o.kind !== it.kind) return false;
    this.menuFor = null;
    this.ctx.hud.closeOrder(); this.ctx.barHud.onSheet(this.ctx.barHud.anySheet());
    o.item = it;
    if (o.where === 'bar') this.placeBarOrder(o); else this.tableOrderTaken(o);
    return true;
  }
  private dropOrder(o: Order, why: string) { const i = this.orders.indexOf(o); if (i >= 0) this.orders.splice(i, 1); if (this.menuFor === o) this.menuFor = null; this.note(`order ${o.id} dropped: ${why}`); }
  /** the menu's own bookkeeping, every frame: a menu sheet closed without an answer (a test hook, another sheet) drops
   *  its order; any order still 'choosing' with no menu open is dropped, so a half-made order can never keep you from
   *  ordering for the rest of the visit */
  private checkMenu() {
    if (this.menuFor && !this.ctx.hud.orderOpen) this.dropOrder(this.menuFor, 'menu closed');
    for (let i = this.orders.length - 1; i >= 0; i--) { const o = this.orders[i]; if (o.stage === 'choosing' && o !== this.menuFor) this.dropOrder(o, 'no menu'); }
  }
  /** at the counter: a drink is made in 4 to 8 s and handed over; food goes to the kitchen and the server brings it */
  private placeBarOrder(o: Order) {
    const it = o.item!, r = mulberry(hash32('prep', o.id, Math.floor(this.T * 10)));
    const prep = it.prep[0] + (it.prep[1] - it.prep[0]) * r();
    if (it.id === this.save.favourites.drink || it.id === this.save.favourites.food) this.goal('order-favourite');
    if (it.kind === 'drink') {
      o.stage = 'making'; o.label = `Pouring your ${it.name}`; o.start = this.T * SECS; o.readyAt = this.T * SECS + prep;
      const [u] = this.ctx.F.toFrame(this.ctx.player.x, this.ctx.player.z);
      this.crowd.bartenderFor(u).order(it.id, u, prep, () => { this.give(it); this.dropOrder(o, 'handed over'); this.say('Bartender', `One ${it.name}. Enjoy.`, 2.5); });
      this.say('Bartender', `${it.name}, coming up.`, 2.5);
    } else {
      o.stage = 'kitchen'; o.label = `Your ${it.name} is in the kitchen`; o.start = this.T * SECS; o.readyAt = this.T * SECS + prep;
      this.say('Bartender', `${it.name}. The kitchen'll have it out to you.`, 3);
    }
    this.note(`order ${o.id}: ${it.id} at the bar, ${prep.toFixed(1)} s`);
  }
  /** table service: the server comes within 30 to 90 s (by staffing), takes the order in 8 s, and brings it */
  private callServer(o: Order) {
    const c = this.ctx, seat = c.player.seat, at: P2 = seat ? [seat.ax, seat.az] : [c.player.x, c.player.z];
    // the arrival within 30 to 90 s by staffing (one server in S2a: the busier the room, the longer), less the walk
    // the walk: the server's path on the walk grid over the server's pace
    // S3a: the least busy server on shift takes your order and brings it (the crowd's servers share the floor)
    const sv = o.sv = this.yourServer();
    const target = 30 + 60 * clamp(c.clock().share, 0, 1), walkS = sv.walkSeconds(at);
    const delay = clamp(target - walkS, 0, 90);
    o.label = 'A server is on the way'; o.start = this.T * SECS; o.readyAt = this.T * SECS + delay + walkS;
    const ask = () => {
      if (!this.orders.includes(o)) return;
      const p = this.ctx.player; sv.face(p.x, p.z);
      if (o.item) { this.tableOrderTaken(o); return; }
      // another menu is open (one at a time): the server waits beside you until it's answered
      if (this.menuFor) { o.label = 'The server is waiting for you'; sv.add({ kind: 'take', label: 'wait to take an order', delay: 2, to: () => this.besidePlayer(), arrive: ask }, true); return; }
      this.openMenu(o, 'Server', 'Hi! What can I get you?');
    };
    sv.add({ kind: 'take', label: 'take an order', delay, to: () => this.besidePlayer(), arrive: ask });
    this.tell('A server will be right over', 2.5);
  }
  /** S3a: the server on shift with the shortest queue (the S2a server before the crowd is attached) */
  private yourServer(): Server { return this.crowd ? this.crowd.serverFor() : this.server; }
  /** a point beside you for the server to stand at: next to your seat's stand point, or beside you */
  private besidePlayer(): P2 {
    const p = this.ctx.player, s = p.seat;
    const [x, z] = s ? [s.ax, s.az] : [p.x + Math.sin(p.heading) * 0.8, p.z + Math.cos(p.heading) * 0.8];
    const f = this.ctx.grid.nearestFree(x, z, 2); return f ? [f[0], f[1]] : [x, z];
  }
  private tableOrderTaken(o: Order) {
    const it = o.item!, r = mulberry(hash32('prep', o.id, Math.floor(this.T * 10)));
    if (it.id === this.save.favourites.drink || it.id === this.save.favourites.food) this.goal('order-favourite');
    o.stage = 'taking'; o.t = 8; o.label = `Ordering your ${it.name}`;
    this.say('Server', it.kind === 'drink' ? `${it.name}. Back in a minute.` : `${it.name}. I'll bring it out from the kitchen.`, 2.5);
    const prep = it.prep[0] + (it.prep[1] - it.prep[0]) * r();
    o.start = this.T * SECS; o.readyAt = this.T * SECS + 8 + (it.kind === 'food' ? prep : 25);
    // after 8 s the server goes for it: the bartender pours drinks at the pick-up; food waits at the pass (S3a: the
    // order's own server, its jobs ahead of the crowd's)
    const sv = o.sv ?? (o.sv = this.yourServer());
    sv.add({ kind: 'deliver', label: 'fetch', delay: 8, to: () => (it.kind === 'drink' ? sv.pickup : sv.pass), arrive: () => {
      const fetch = () => { sv.carry = it.id; o.stage = 'carrying'; o.label = `Your ${it.name} is on the way`; sv.add({ kind: 'deliver', label: 'bring', to: () => this.besidePlayer(), arrive: () => { sv.carry = null; this.give(it); this.dropOrder(o, 'delivered'); this.say('Server', `${it.name}. Enjoy.`, 2.5); } }, true); };
      if (it.kind === 'drink') { o.stage = 'making'; o.label = `Pouring your ${it.name}`; this.crowd.bartenderFor(26.15).order(it.id, 26.15, 4 + 4 * r(), fetch); }
      else { o.stage = 'kitchen'; o.label = `Your ${it.name} is in the kitchen`; const wait = () => { if (this.T * SECS >= o.readyAt) fetch(); else sv.add({ kind: 'deliver', label: 'wait at the pass', delay: Math.max(1, o.readyAt - this.T * SECS), to: () => sv.pass, arrive: wait }, true); }; wait(); }
    } }, true);
    this.note(`order ${o.id}: ${it.id} at a table`);
  }
  /** the orders' timers: food from the kitchen at the bar (the server brings it), table orders being taken */
  private stepOrders(dS: number) {
    this.checkMenu();
    for (let i = 0; i < this.orders.length; i++) {
      const o = this.orders[i];
      if (o.stage === 'taking') { o.t -= dS; if (o.t <= 0 && o.item?.kind === 'drink') o.stage = 'making'; else if (o.t <= 0) o.stage = 'kitchen'; }
      if (o.where === 'bar' && o.stage === 'kitchen' && this.T * SECS >= o.readyAt) {
        // S3a: the least busy server on shift brings it, ahead of the crowd's jobs (the S2a server alone could have a
        // long queue of the crowd's table service in front of yours)
        const it = o.item!, sv = o.sv = this.yourServer(); o.stage = 'carrying'; o.label = `Your ${it.name} is on the way`;
        sv.add({ kind: 'deliver', label: 'fetch food', to: () => sv.pass, arrive: () => { sv.carry = it.id; sv.add({ kind: 'deliver', label: 'bring food', to: () => this.besidePlayer(), arrive: () => { sv.carry = null; this.give(it); this.dropOrder(o, 'delivered'); this.say('Server', `${it.name}. Enjoy.`, 2.5); } }, true); } }, true);
      }
    }
    // the server buses empties when free
    if (!this.server.busy && this.empties.length) {
      const s = this.server, e = this.empties.reduce((b, x) => (Math.hypot(x.x - s.x, x.z - s.z) < Math.hypot(b.x - s.x, b.z - s.z) ? x : b));
      s.add({ kind: 'bus', label: 'bus an empty', delay: 20, to: () => { const f = this.ctx.grid.nearestFree(e.x, e.z, 2); return f ? [f[0], f[1]] : [e.x, e.z]; }, arrive: () => { this.empties = this.empties.filter((x) => x !== e); s.carry = e.model === 'glass' ? 'empty-glass' : 'empty-basket'; s.add({ kind: 'bus', label: 'to the pass', to: () => s.pass, arrive: () => { s.carry = null; } }, true); } });
    }
  }
  /** an item into your hand (a drink in the right, food in the left) */
  give(it: BarItem) {
    // an empty still in that hand is set down first, on the nearest surface (you're at the bar or a table)
    if (this.held[it.kind] && this.held[it.kind]!.left <= 0) this.leaveEmpty(it.kind, true);
    const h: Held = { item: it, left: it.kind === 'drink' ? it.count : (it.deltas.hunger ?? 45), next: this.T * SECS + 20, sipT: 0 };
    if (it.kind === 'drink') this.held.drink = h; else { this.held.food = h; bump(this.needs, { energy: it.deltas.energy ?? 0 }); }
    this.note(`holding ${it.id}`);
    if (it.kind === 'food' && it.id === this.save.favourites.food) this.moodlets.add('good-food', this.T);
  }
  /** sips every 40 to 70 s (+7 thirst each, about 6 a drink); bites while there's food; empties left on a surface */
  private sips(dS: number) {
    const now = this.T * SECS;
    for (let i = 0; i < KINDS.length; i++) {
      const k = KINDS[i], h = this.held[k]; if (!h) continue;
      if (h.sipT > 0) h.sipT = Math.max(0, h.sipT - dS);
      if (now >= h.next && h.left > 0) this.sip(k);
      // the empty goes down only once the last sip's (or bite's) clip has ended
      if (h.left <= 0 && h.sipT <= 0) this.leaveEmpty(k);
    }
  }
  /** one sip or bite now (automatic, or a tap on the second action). A sip takes its 2.4 s clip: taps while one plays
   *  do nothing, so a drink can't go down in one go */
  sip(k: 'drink' | 'food' = this.held.drink ? 'drink' : 'food') {
    const h = this.held[k]; if (!h || h.left <= 0 || h.sipT > 0) return false;
    const r = mulberry(hash32('sip', Math.floor(this.T * SECS), h.left));
    h.next = this.T * SECS + 40 + 30 * r(); h.sipT = SIP_S;
    if (k === 'drink') {
      const per = (h.item.deltas.thirst ?? 42) / h.item.count, extra: Partial<Record<Need, number>> = { thirst: per };
      if (h.item.deltas.energy) extra.energy = h.item.deltas.energy / h.item.count;
      if (h.item.deltas.fun) extra.fun = h.item.deltas.fun / h.item.count;
      bump(this.needs, extra); h.left--;
    } else if (h.item.deltas.fun) bump(this.needs, { fun: (h.item.deltas.fun ?? 0) / h.item.count });
    this.clipYou(k === 'drink' ? 'drink' : 'eat');
    return true;
  }
  /** set an empty down on the nearest free table surface within 3 m (`anywhere`: the nearest at any distance, when the
   *  next item arrives); with none in reach it stays in your hand, and you're told once where it can go */
  private leaveEmpty(k: 'drink' | 'food', anywhere = false) {
    const c = this.ctx, p = c.player, h = this.held[k]!;
    let best: { at: P2; y: number } | null = null, bd = anywhere ? Infinity : 3;
    for (const s of this.surfaces) { const [x, z] = c.F.fromFrame(s.at[0], s.at[1]), d = Math.hypot(x - p.x, z - p.z); if (d < bd && !this.empties.some((e) => Math.hypot(e.x - x, e.z - z) < 0.12)) { bd = d; best = s; } }
    if (!best) {
      if (!h.nudged) { h.nudged = true; this.tell(`Your ${k === 'drink' ? 'glass' : 'basket'} is empty: set it down at a table or the bar`, 4); this.note(`empty ${h.item.id} kept: no table in reach`); }
      return;
    }
    const [x, z] = c.F.fromFrame(best.at[0], best.at[1]);
    this.empties.push({ model: h.item.model === 'glass' ? 'glass' : 'basket', x, y: best.y, z, yaw: (x * 7.1) % 6.28 });
    if (this.empties.length > 30) this.empties.shift();
    this.held[k] = null; this.note(`empty ${h.item.id} left`);
  }

  // ------------------------------------------------------------------------------------------------ drawing
  private _m = new THREE.Matrix4(); private _v = new THREE.Vector3(); private _q = new THREE.Quaternion(); private _s = new THREE.Vector3(); private _col = new THREE.Color();
  /** your avatar's clips (after the builder's update) */
  private afterAvatar(dt: number, hide: boolean) {
    const p = this.ctx.person(); if (!p) return;
    void hide;
    this.clips.apply(p, dt);
  }
  /** every item instance this frame: what you hold, what the staff carry, the empties */
  private drawItems() {
    const c = this.ctx, I = this.items, cam = c.camera, view = c.view(), p = c.person();
    I.begin();
    const first = view === 'first';
    for (let i = 0; i < KINDS.length; i++) {
      const k = KINDS[i], h = this.held[k]; if (!h) continue;
      const model = h.item.model, col = this._col.set(h.item.color);
      if (first) {
        // in the corner of the first-person view, brought up on a sip
        const s = h.sipT > 0 ? Math.sin(Math.min(1, (SIP_S - h.sipT) / SIP_S) * Math.PI) : 0;
        const off = k === 'drink' ? this._v.set(0.25 - 0.15 * s, -0.31 + 0.17 * s, -0.6 + 0.24 * s) : this._v.set(-0.27, -0.33 + 0.08 * s, -0.62 + 0.1 * s);
        off.applyMatrix4(cam.matrixWorld);
        this._q.copy(cam.quaternion);
        const e = this._e.setFromQuaternion(this._q, 'YXZ'); e.x = k === 'drink' ? -0.9 * s : 0; e.z = 0; this._q.setFromEuler(e);
        I.put(model, this._m.compose(off, this._q, this._s.set(1, 1, 1)), col);
      } else if (p) {
        const hp = handPoint(p, k === 'drink' ? 'R' : 'L', this._v);
        if (hp) I.putAt(model, hp.x, hp.y - (model === 'glass' ? 0.07 : 0.03), hp.z, c.player.heading, 1, col);
      }
    }
    // staff carrying
    this.drawCarry(this.bartender); this.drawCarry(this.server);
    // S2b: the games' pieces (balls, bands, cues, darts, pucks) and the guide line
    this.games.draw(I);
    // S3a: what the crowd holds (bodies only: a card holds nothing), their empties, the cooks' plates at the pass
    this.crowd?.drawItems(I);
    for (const e of this.empties) I.putAt(e.model, e.x, e.y, e.z, e.yaw, 1, e.model === 'glass' ? EMPTY.glass : EMPTY.basket);
    // the budget check's worst case: every model at its cap ("The sums" count the items so), set on the room's surfaces
    if (this.itemsAtCap) {
      let k = 0;
      for (const m of MODELS) {
        const cap = CAPS[m], col = m === 'ball' ? 0xe8c040 : m === 'band' ? 0xffffff : m === 'stick' ? 0x8a6a40 : m === 'disc' ? 0xeeeeee : m === 'basket' ? 0xd8a444 : 0xe8b03c;
        while (I.counts()[m] < cap && I.put(m, this._m.compose(this._v.set(...this.capSpot(k++)), this._q.identity(), this._s.set(m === 'disc' ? 0.12 : 1, m === 'disc' ? 0.012 : m === 'stick' ? 0.15 : 1, m === 'disc' ? 0.12 : 1)), col)) { /* placed */ }
      }
    }
    I.end();
  }

  private drawCarry(s: Bartender | Server) {
    if (!s.carry) return;
    const it = itemById(s.carry), model = it ? it.model : s.carry === 'empty-basket' ? 'basket' : 'glass', col = it ? it.color : s.carry === 'empty-basket' ? EMPTY.basket : EMPTY.glass;
    const hp = handPoint(s.p, 'R', this._v);
    if (hp) this.items.putAt(model, hp.x, hp.y - (model === 'glass' ? 0.07 : 0.03), hp.z, s.heading, 1, col);
  }

  // ------------------------------------------------------------------------------------------------ the HUD
  private hudT = 0;
  refreshHud(force = false) {
    const c = this.ctx, now = performance.now() / 1000;
    if (!force && now - this.hudT < 0.25) return; this.hudT = now;
    const m = this.moodNow();
    c.barHud.setNeeds(this.needs, { value: m.value, label: m.label, emotion: m.emotion });
    c.barHud.setQueue(this.queue.items.map((a, i) => ({ id: a.id, icon: a.icon, label: a.label, now: i === 0 && a.stage !== 'queued' })));
    c.barHud.setTv(this.tvChip());
    // the order and holding chip
    const o = this.orders.find((x) => x.stage !== 'choosing');
    if (o) { const now2 = this.T * SECS, wait = Math.max(0, o.readyAt - now2), total = Math.max(1, o.readyAt - o.start); c.hud.status(o.label + (wait > 1 && o.stage !== 'carrying' ? ` · ${Math.ceil(wait)} s` : ''), 'making', o.stage === 'carrying' ? 1 : 1 - wait / total); }
    else if (this.held.drink || this.held.food) { const h = (this.held.drink ?? this.held.food)!; c.hud.status(`${h.item.name}${this.held.drink && this.held.food ? ` and ${this.held.food.item.name}` : ''}`, 'hold'); }
    else c.hud.status(null);
    if (this.cancelled) { this.tell(`${this.cancelled.split(' · ')[0]}: stopped`, 2); this.cancelled = null; }
    if (c.barHud.isOpen('needsSheet')) this.fillNeeds();
  }
  private tvChip() {
    if (!this.ctx.clock().open) return 'Screens off · simulated';
    const ch = this.tv.bigChannel(this.T);
    if (ch === 3) return 'On now: Highlights · simulated';
    const f = this.tv.inPlay(ch, this.T); if (!f) return `On now: ${CHANNEL_NAMES[ch]} · simulated`;
    const s = this.tv.scoreAt(f, this.T);
    return `On now: ${f.home.abbr} ${s[0]}–${s[1]} ${f.away.abbr} · simulated`;
  }
  private fillNeeds() {
    const m = this.moodNow();
    this.ctx.barHud.fillNeeds({ needs: this.needs, mood: m, moodlets: this.moodlets.report(this.T), tokens: this.save.tokens, tokenNote: TOKENS_LABEL, three: this.tonight.goals.map((g) => ({ text: GOALS[g], done: this.tonight.done.includes(g) })), save: SAVE_LABEL + (this.storage === 'blocked' ? ' (storage is off in this browser, so nothing is kept after you leave)' : '') });
  }
  openNeeds() { this.fillNeeds(); this.ctx.barHud.sheet('needsSheet', true); }
  openGuide() {
    const n = this.now(), list = this.tv.fixtures(n.week, n.day), f = this.tv.featured(n.week, n.day);
    const rows = (ch: 1 | 2) => list.filter((x) => x.channel === ch).map((x) => { const d = this.tv.describe(x, this.T); return { kickoff: d.kickoff, home: d.home, away: d.away, homeCrest: crestSvg(x.home, 26), awayCrest: crestSvg(x.away, 26), score: d.state === 'upcoming' ? '–' : `${d.score[0]}–${d.score[1]}`, state: d.state === 'in play' ? `${this.tv.clockLabel(x, this.T)}` : d.state, featured: x.featured }; });
    const sides = f ? [f.home, f.away].map((t) => ({ abbr: t.abbr, name: t.name, crest: crestSvg(t, 22) })) : [...LEAGUES.marigold.teams.slice(0, 2), ...LEAGUES.gridiron.teams.slice(0, 2)].map((t) => ({ abbr: t.abbr, name: t.name, crest: crestSvg(t, 22) }));
    const hl = this.tv.highlights(this.T);
    this.ctx.barHud.fillGuide({
      note: 'Fictional leagues · simulated matches · not live',
      groups: [{ title: `${DAY_NAMES[n.day]} · ${CHANNEL_NAMES[1]} (channel 1)`, rows: rows(1) }, { title: `${DAY_NAMES[n.day]} · ${CHANNEL_NAMES[2]} (channel 2)`, rows: rows(2) }, { title: `Channel 3 · ${hl.title}`, rows: [], empty: hl.items.length ? `The newest ${hl.items.length} scores, replayed` : 'Nothing to replay yet' }],
      sides, team: this.team,
    });
    this.ctx.barHud.sheet('guide', true);
  }

  // ------------------------------------------------------------------------------------------------ taps, keys, buttons
  /** the hot boxes of the objects you can tap, in frame (u, y, v) */
  private hot(o: SmartObject) { return { u0: o.at[0] - o.size[0] / 2, u1: o.at[0] + o.size[0] / 2, v0: o.at[1] - o.size[1] / 2, v1: o.at[1] + o.size[1] / 2, y0: o.y[0], y1: o.y[1] }; }
  /** a tap: if its ray meets an object with something to offer before anything else, the radial menu opens on it
   *  and the tap is handled (true); otherwise the page's tap to go takes it */
  tap(ray: THREE.Ray, sx: number, sy: number, wallT = Infinity): boolean {
    const c = this.ctx, F = c.F;
    if (c.barHud.radialOpen) { c.barHud.closeRadial(); this.radialFor = null; }
    // S3a: a person first (a body, a card or a filler) if the ray meets one before anything else
    const who = this.crowd?.tapPerson(ray, Math.min(wallT, 40));
    if (who) { this.openPerson(who.id, sx, sy); return true; }
    const [ou, ov] = F.toFrame(ray.origin.x, ray.origin.z), [du, dv] = F.toFrame(ray.direction.x, ray.direction.z), dy = ray.direction.y, oy = ray.origin.y;
    let best: SmartObject | null = null, bt = Math.min(wallT, 40);
    for (const o of this.objects) {
      if (o.type === 'standing-floor' || o.type === 'dance-spot' || o.type === 'restroom' || o.type === 'window-rail' || o.type === 'patio-rail') continue;
      const h = this.hot(o);
      let t0 = 0, t1 = bt;
      for (const [org, dir, lo, hi] of [[ou, du, h.u0, h.u1], [oy, dy, h.y0, h.y1], [ov, dv, h.v0, h.v1]] as [number, number, number, number][]) {
        if (Math.abs(dir) < 1e-9) { if (org < lo || org > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - org) / dir, b = (hi - org) / dir; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < bt && t0 > 0.2) { bt = t0; best = o; }
    }
    if (!best) return false;
    const offers = this.offers(best.id);
    if (!offers.length) return false;
    this.openRadial(best.id, sx, sy);
    return true;
  }
  openRadial(objectId: string, sx?: number, sy?: number) {
    const c = this.ctx, o = this.objectById(objectId); if (!o) return false;
    if (sx === undefined || sy === undefined) {
      const [x, z] = c.F.fromFrame(o.at[0], o.at[1]), v = this._v.set(x, (o.y[0] + o.y[1]) / 2, z).project(c.camera);
      sx = (v.x * 0.5 + 0.5) * c.canvas.clientWidth; sy = (-v.y * 0.5 + 0.5) * c.canvas.clientHeight;
    }
    const offers = this.offers(objectId); if (!offers.length) return false;
    this.radialFor = objectId;
    c.barHud.radial(sx, sy, o.label, offers.map((x) => ({ label: x.label, key: x.action })));
    // S3b: a game spot guests are playing on: you're next there (nobody else starts when their match ends)
    const gs = this.games.spot(objectId);
    if (gs && gs.npcBusy && !gs.mine && this.crowd?.social.games.queueYou(objectId)) this.tell(`Guests are playing ${gs.kind === 'shuffleboard' ? 'shuffleboard' : gs.kind} here · you're next`, 3);
    return true;
  }
  /** close any radial menu (an object's or a person's), e.g. when the camera jumps (a pose) or the graphics change */
  closeRadial() { if (this.ctx?.barHud.radialOpen) this.ctx.barHud.closeRadial(); this.radialFor = null; }
  /** a person's radial menu (S3b): up to six of the 11 interactions that fit the moment, "More…" for the rest, and the
   *  "i" for their card */
  openPerson(id: number, sx?: number, sy?: number) {
    const n = this.crowd.byId(id); if (!n) return false;
    if (sx === undefined || sy === undefined) { const v = this._v.set(n.x, n.y + 1.5, n.z).project(this.ctx.camera); sx = (v.x * 0.5 + 0.5) * this.ctx.canvas.clientWidth; sy = (-v.y * 0.5 + 0.5) * this.ctx.canvas.clientHeight; }
    this.radialFor = `person:${id}`;
    this.ctx.barHud.radial(sx, sy, n.name, this.crowd.social.menuFor(n), true);
    return true;
  }
  private pick(key: string) {
    const o = this.radialFor; this.ctx.barHud.closeRadial(); this.radialFor = null;
    if (!o) return;
    if (o.startsWith('person:')) { const n = this.crowd.byId(Number(o.slice(7))); if (n) this.crowd.social.pick(n, key); return; }
    const r = this.use(o, key);
    if (!r.ok) this.ctx.hud.toast(r.why ?? "Can't do that now", 2.5);
  }
  /** the bar's own actions from the keys and the gamepad: Tab the needs panel, G the guide, 1 to 6 the radial's items,
   *  LB the radial on the nearest object. True when handled */
  action(a: string): boolean {
    const c = this.ctx;
    if (a === 'needs') { if (c.barHud.isOpen('needsSheet')) c.barHud.sheet('needsSheet', false); else this.openNeeds(); return true; }
    if (a === 'guide') { if (c.barHud.isOpen('guide')) c.barHud.sheet('guide', false); else this.openGuide(); return true; }
    if (a.startsWith('menu') && c.barHud.radialOpen) { const i = Number(a.slice(4)) - 1, it = c.barHud.radialItems[i]; if (it) this.pick(it.key); return true; }
    if (a === 'radial') { const o = this.nearestObject(); if (o) this.openRadial(o); return true; }
    return false;
  }
  private nearestObject(): string | null {
    const p = this.ctx.player; let best: string | null = null, bd = 6;
    for (const o of this.objects) { if (!this.offers(o.id).length) continue; const [x, z] = this.ctx.F.fromFrame(o.at[0], o.at[1]), d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = o.id; } }
    return best;
  }
  /** the second action button: Sip while holding something; Order at the counter */
  second(): string | null {
    if (this.games?.mine && !this.games.mine.yourTurn()) return 'Leave';
    if (this.held.drink && this.held.drink.left > 0) return 'Sip';
    if (this.held.food && this.held.food.left > 0) return 'Bite';
    const bar = this.objectById('bar')!;
    if (this.ctx.clock().open && this.atSlotOf(bar) && !this.orders.length) return 'Order';
    return null;
  }
  doSecond(): string | null {
    const s = this.second();
    if (s === 'Sip') { this.sip('drink'); return 'sip'; }
    if (s === 'Bite') { this.sip('food'); return 'bite'; }
    if (s === 'Order') { this.openRadial('bar'); return 'order'; }
    if (s === 'Leave') { this.games.leave('you left'); return 'leave'; }
    return null;
  }
  /** a game's result (S2b): the winner's moodlet scaled by competitive and 5 house tokens, or "Lost a close one";
   *  tonight's three where they apply. Nothing is wagered. */
  private gameResult(o: GameOutcome) {
    let moodlet: string | null = null, tokens = 0;
    if (o.won) {
      this.moodlets.add('won-game', this.T, wonGameValue(this.traits.competitive)); moodlet = 'won-game';
      this.save.tokens += GAME_TOKENS; tokens = GAME_TOKENS; this.wonGameAt = this.T; this.dirty = true;
      this.tell(`You won at ${o.kind}! +${GAME_TOKENS} house tokens · ${o.detail}`, 4);
      if (o.kind === 'darts') this.goal('darts-win');
    } else {
      if (o.close) { this.moodlets.add('lost-close', this.T); moodlet = 'lost-close'; }
      this.tell(`${HOUSE_NAME} wins this one${o.close ? ' (close!)' : ''} · ${o.detail}`, 4);
    }
    if (o.potTwo) this.goal('pool-two');
    if (o.landedThree) this.goal('shuffle-three');
    this.gameResults.push({ ...o, t: +this.T.toFixed(4), moodlet, tokens });
    this.note(`game ${o.id} ${o.won ? 'won' : 'lost'}${o.close ? ' (close)' : ''}`);
    const p = this.ctx.person(); if (p && o.won) this.clips.play(p, 'cheer', { upper: false });
    // S3b: a game with a guest counts for both of you
    const vs = this.games.vs; if (vs) this.crowd.social.playedWith(vs.id, o.won, o.close);
  }
  // ------------------------------------------------------------------------------------------------ S3b's needs of the social layer
  /** your next game's opponent (an accepted Challenge), set before your walk to it */
  private vsNext: Games['vs'] = null;
  relsLoaded = 0;
  /** an accepted Challenge: you walk to the game as for any game; your opponent is the guest */
  challenge(spot: string, kind: string, vs: NonNullable<Games['vs']>) {
    this.vsNext = vs;
    const r = this.use(spot, `play-${kind}`);
    if (!r.ok) { this.vsNext = null; this.tell(r.why ?? "Can't start that game now", 2.5); }
    return r.ok;
  }
  /** house tokens spent on a round (no cash value; earned in the bar only) */
  spendTokens(n: number) { this.save.tokens = Math.max(0, this.save.tokens - n); this.dirty = true; }
  /** 2 tokens for a first good conversation with someone new */
  earnFirstChat() { this.save.tokens += EARN.firstGoodChat; this.dirty = true; this.tell(`Great chat · +${EARN.firstGoodChat} house tokens`, 2.5); return EARN.firstGoodChat; }
  /** your drink from a round: your favourite, alcohol-free like everything on your menu */
  roundForYou() { const it = itemById(this.save.favourites.drink); const d = it && it.kind === 'drink' ? it : DRINKS[0]; if (!this.held.drink || this.held.drink.left <= 0) this.give(d); this.dirty = true; }
  /** your avatar's beat in an interaction, logged with the clips */
  clipYouLog(kind: string, clip: string) { this.note(`beat ${kind} (${clip})`); }
  private persist() { this.dirty = false; this.savedAt = performance.now() / 1000; if (this.save.tonight) this.save.tonight.done = this.tonight.done; if (this.crowd) this.save.social = { ...this.crowd.social.toSave(), at: Date.now() }; writeSave(this.save); }

  // ------------------------------------------------------------------------------------------------ test hooks
  hooks() {
    const self = this, round = (n: Record<string, number>) => Object.fromEntries(SHOWN.map((k) => [k, +n[k].toFixed(3)]));
    return {
      needs() { const m = self.moodNow(); return { ...round(self.needs), mood: +m.value.toFixed(3), label: m.label, emotion: m.emotion, traits: { ...self.traits }, doing: { ...self.doing() } }; },
      setNeeds(n: Partial<Record<ShownNeed, number>>) { for (const k of SHOWN) if (n[k] !== undefined) self.needs[k] = clamp(n[k]!, 0, 100); self.lowWas = Object.fromEntries(SHOWN.map((k) => [k, self.needs[k] < 30])); return this.needs(); },
      setTraits(t: Partial<Traits>) { self.traits = { ...self.traits, ...t }; return { ...self.traits }; },
      clearMoodlets() { self.moodlets.clear(); return true; },
      mood() { const m = self.moodNow(); return { mood: +m.value.toFixed(3), label: m.label, emotion: m.emotion, average: +m.average.toFixed(3), moodlets: self.moodlets.report(self.T), formula: +(20 + 0.6 * m.average + self.moodlets.sum(self.T)).toFixed(3) }; },
      use(objectId: string, action: string, item?: string) { return self.use(objectId, action, item); },
      offers(objectId: string) { return self.offers(objectId); },
      queue() { return self.queue.items.map((a) => ({ id: a.id, action: a.action, object: a.object, stage: a.stage, slot: a.slot ?? null, label: a.label })); },
      cancelAction(id: number) { return self.cancel(id); },
      tv(day?: number | string, week?: number) {
        const n = self.now(), d = day === undefined ? n.day : C.parseDay(day), w = week ?? (day === undefined ? n.week : self.weekNow());
        const list = self.tv.fixtures(w, d), f = self.tv.featured(w, d);
        return {
          week: w, day: d, dayName: DAY_NAMES[d], now: { week: n.week, day: n.day, time: hhmm(self.T), T: +self.T.toFixed(4) },
          featured: f ? self.tv.describe(f, self.T) : null, featuredFactor: self.tv.featuredFactor(n.week, n.day, n.hour), gameNight: self.tv.gameNight(n.week, n.day, n.hour),
          big: self.tv.bigChannel(self.T), screens: Object.fromEntries(SCREENS.map((s) => [s.id, self.channelOf(s.id)])),
          fixtures: list.map((x) => self.tv.describe(x, self.T)), highlights: (() => { const h = self.tv.highlights(self.T); return { title: h.title, day: h.day, items: h.items.map((x) => ({ fixture: x.f.id, kind: x.e.kind, team: x.e.team, score: x.e.score, at: hhmm(x.e.t) })) }; })(),
          chip: self.tvChip(),
        };
      },
      tvAt(day: number | string, hour: number) { const d = C.parseDay(day), w = self.weekNow(); return { featuredFactor: self.tv.featuredFactor(w, d, hour), gameNight: self.tv.gameNight(w, d, hour), big: self.tv.bigChannel(absMinute(w, d, hour)) }; },
      tvFrames() { return { ...self.broadcast.stats, cell: [self.broadcast.w, self.broadcast.h], hz: self.broadcast.hz }; },
      setWeek(n: number | null) { self.week = n; self.syncClock(); return self.weekNow(); },
      setTimeScale(k: number) { self.timeScale = clamp(k, 1, 120); return self.timeScale; },
      fastForward(min: number) { return self.fastForward(min); },
      tokens() { return { tokens: self.save.tokens, label: TOKENS_LABEL, fromTime: self.tokensFromTime, inBarMin: +self.inBarMin.toFixed(2), visits: self.save.visits, tonight: self.tonight, storage: self.storage }; },
      held() { const h = (x: Held | null) => (x ? { id: x.item.id, name: x.item.name, left: +x.left.toFixed(2), model: x.item.model } : null); return { drink: h(self.held.drink), food: h(self.held.food) }; },
      orders() { return self.orders.map((o) => ({ id: o.id, kind: o.kind, where: o.where, stage: o.stage, item: o.item?.id ?? null, label: o.label, readyIn: +Math.max(0, o.readyAt - self.T * SECS).toFixed(1), menu: o === self.menuFor })); },
      pickItem(id: string) { self.orderPicked(id); return this.orders(); },
      /** the menu sheet: open or not, and for which order (the order sheet's "Not now" is notNow()) */
      menu() { return { open: self.ctx.hud.orderOpen, order: self.menuFor ? { id: self.menuFor.id, kind: self.menuFor.kind, where: self.menuFor.where } : null, title: self.ctx.hud.orderOpen ? document.getElementById('orderTitle')?.textContent ?? '' : '' }; },
      /** "Not now" on the open menu, as its button does */
      notNow() { self.ctx.hud.onOrderClose(); return this.orders(); },
      staff() { const s = (b: Bartender | Server) => { const [u, v] = self.ctx.F.toFrame(b.x, b.z); return { role: b.role, u: +u.toFixed(2), v: +v.toFixed(2), moving: b.moving, carry: b.carry, busy: b.busy, lod: b.p.stats().lod, tris: b.p.stats().tris }; }; return [s(self.bartender), s(self.server)]; },
      items() { return { counts: self.items.counts(), perInstance: self.items.perInstance(), alloc: Object.fromEntries(MODELS.map((k) => [k, ALLOC_TRIS[k][self.items.hi ? 1 : 0]])), caps: CAPS, hi: self.items.hi, empties: self.empties.length, meshes: MODELS.map((k) => self.items.meshes[k].name), frustumCulled: MODELS.map((k) => self.items.meshes[k].frustumCulled) }; },
      catalogue() { return { adverts: ADVERT_COUNT, types: Object.keys(TYPES).length, objects: self.objects.length, menu: PLAYER_MENU.map((i) => ({ id: i.id, name: i.name, kind: i.kind, alcohol: i.alcohol, keys: Object.keys(i) })), menuNote: MENU_NOTE, slots: self.slots.size, reservations: self.res.report() }; },
      saveNow() { self.persist(); try { return JSON.parse(localStorage.getItem('oc.onfoot.sportsbar.v1') ?? 'null'); } catch { return { blocked: true }; } },
      saved() { return { ...self.save }; },
      sip(k?: 'drink' | 'food') { return self.sip(k); },
      lastToast() { return self.ctx.hud.toastText; },
      lastCaption() { return self.ctx.hud.captionText; },
      cheer() { return self.cheer(); },
      cheerShown() { return self.ctx.barHud.cheering; },
      radial(objectId: string) { return self.openRadial(objectId) ? self.ctx.barHud.radialItems : null; },
      closeRadial() { self.ctx.barHud.closeRadial(); self.radialFor = null; return true; },
      openNeeds() { self.openNeeds(); return true; },
      openGuide() { self.openGuide(); return true; },
      closeSheets() { for (const id of ['needsSheet', 'guide', 'tired']) self.ctx.barHud.sheet(id, false); self.ctx.hud.closeOrder(); return true; },
      lifeLog(n = 30) { return self.log.slice(-n); },
      simTime() { return { ...self.now(), T: +self.T.toFixed(4), drift: +self.drift.toFixed(4), scale: self.timeScale, pinnedWeek: self.week }; },
      /** S2a's clip check: a person built at each level of detail (phone quality), every clip probed on it: its
       *  weight and how far it turned the bones from the builder's own pose */
      clipTest(levels: (0 | 1 | 2)[] = [2, 1, 0]) {
        const out: Record<string, unknown>[] = [];
        const p = buildPerson({ ...randomPerson(5150), quality: 'phone', lod: 2 });
        for (const lod of levels) {
          const t0 = performance.now(); p.setLod(lod); const ms = performance.now() - t0;
          // S2a's clips at 1.0 s as before; S2b's game clips in their swing (the shot, the throw and the push at 0.4 s)
          const at = (n: ClipName) => (n === 'pool-shot' || n === 'dart-throw' || n === 'shuffle-slide' ? 0.4 : 1.0);
          const probes = [...CLIPS, ...STAFF_CLIPS, ...GAME_CLIPS].map((n) => ({ ...self.clips.probe(p, n, at(n)), upper: self.clips.probe(p, n, at(n), true).armR }));
          out.push({ lod, buildMs: Math.round(ms), tris: p.stats().tris, probes });
        }
        // the people builder's dispose() leaves the skeleton's bone texture (handoff item 6): freed here too
        const sk = new Set<THREE.Skeleton>(); p.group.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton) sk.add(m.skeleton); });
        self.clips.forget(p); p.dispose(); for (const k of sk) k.dispose();
        return out;
      },
      clipYou(name: ClipName, seconds?: number) { const p = self.ctx.person(); if (!p) return false; self.clips.play(p, name, { upper: !!self.ctx.player.seat, seconds }); return true; },
      moodletsList() { return Object.keys(MOODLETS); },
      /** every mesh in the scene by name (drawn or not): the items check's "no other new mesh" */
      meshNames() { const out: string[] = []; self.ctx.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o.name || o.type); }); return [...new Set(out)].sort(); },
      /** the budget check's worst case: every item model at its cap, drawn on the room's surfaces */
      itemsAtCap(on: boolean) { self.itemsAtCap = on; self.drawItems(); return self.items.counts(); },
      /** tonight's three, set for a test (a goal that S2a can complete, drawn for this visit) */
      setTonight(goals: GoalId[]) { self.tonight = { goals: [...goals], done: [] }; if (self.save.tonight) { self.save.tonight.goals = self.tonight.goals; self.save.tonight.done = self.tonight.done; } return { ...self.tonight }; },
      setTeam(abbr: string | null) { self.team = abbr; self.save.team = abbr; self.dirty = true; return self.team; },
      words() { return SHOWN.map((k) => ({ k, word: needWord(k, self.needs[k]) })); },
      // ---- S2b: the games
      /** a table's or a board's state (pool-1, pool-2, darts-1 to darts-3, shuffleboard) */
      game(id: string) { return self.games.state(id); },
      /** every game spot */
      games() { return { spots: self.games.list(), mine: self.games.mine?.id ?? null, houseAt: self.games.houseAt?.id ?? null, opponent: self.games.oppName, vs: self.games.vs ? { id: self.games.vs.id, name: self.games.vs.name } : null, results: self.gameResults, note: NO_STAKES }; },
      /** a scripted shot on your turn: pool { angle, speed } or { auto } or { break }; darts { seg, mult } or { x, y } (held: with the sway); shuffleboard
       *  { speed, line, y0 } or { zone }; settle: true runs it to rest at once */
      shoot(id: string, p: Record<string, unknown> = {}) { return self.games.shoot(id, p); },
      /** start a game against the house where you stand (the hooks' shortcut past the walk; the radial menu walks you there) */
      playHere(id: string) {
        const st = self.games.startOf(id); if (!st) return null;
        // (S3b) guests playing there aren't moved: you're next there, as a tap on the spot does; the caller waits for
        // their match to end (busy) and asks again
        const sp = self.games.spot(id);
        if (sp && sp.npcBusy && !sp.mine) { self.crowd.social.games.queueYou(id); return { ok: false, busy: true, why: `guests are playing at ${id}: you're next` }; }
        const [x, z] = self.ctx.F.fromFrame(st.at[0], st.at[1]); self.ctx.player.place(x, z); return self.use(id, `play-${self.games.kindOf(id) === 'pool' ? 'pool' : self.games.kindOf(id)}`);
      },
      /** the game spots now: yours, guests', free for you, free for guests, the one you're next for */
      spots() { return self.crowd.social.games.spotsReport(); },
      leaveGame() { return self.games.leave('you left'); },
      gamecam() { return { ...self.games.cams.report(), camOn: self.games.camOn }; },
      gameScreen(id: string, at?: [number, number]) { return self.games.screen(id, at); },
      lastSlide() { const sp = self.games.spot('shuffleboard') as unknown as { lastSpeed: number } | null; return sp ? +sp.lastSpeed.toFixed(3) : null; },
      /** your last slide's line (degrees; + is toward the bed's +y) and the spot's screen side */
      lastLine() { const sp = self.games.spot('shuffleboard') as unknown as { lastLine: number; side: number } | null; return sp ? { line: +sp.lastLine.toFixed(3), side: sp.side } : null; },
      gameAim(id: string, a: number | null, b: number, c?: boolean) { return self.games.setAim(id, a, b, c); },
      /** pool, ball in hand: move the cue ball (table metres; it goes to the nearest free spot and stays in hand) */
      placeCue(id: string, x: number, y: number) { const s = self.games.spot(id) as unknown as { game: { ballInHand: boolean } | null; placeCue(x: number, y: number): void; yourTurn(): boolean } | null; if (!s || s.game === undefined || !s.game?.ballInHand || !s.yourTurn()) return { ok: false }; s.placeCue(x, y); return { ok: true, state: self.games.state(id) }; },
      /** pool: script the house's next shot ({ angle (degrees, table), speed } with no aim error, or 'scratch': the cue
       *  ball into the nearest pocket it can reach), for a check that needs one (ball in hand after the house's scratch) */
      houseShot(id: string, p: { angle: number; speed: number } | 'scratch') { const s = self.games.spot(id) as unknown as { kind: string; houseNext: unknown } | null; if (!s || s.kind !== 'pool') return false; s.houseNext = p === 'scratch' ? 'scratch' : { angle: (p.angle * Math.PI) / 180, speed: p.speed }; return true; },
      /** darts: hold a dart in the air at this share of its flight (0 to 1; null lets it fly), so a screenshot can catch
       *  the throw (a frame here takes longer than the 0.44 s throw) */
      holdDart(id: string, k: number | null) { const s = self.games.spot(id) as unknown as { kind: string; holdAt: number | null } | null; if (!s || s.kind !== 'darts') return false; s.holdAt = k === null ? null : Math.max(0, Math.min(0.98, k)); return true; },
      /** the game bar's rebuild count and the game's version (the bar's text is rebuilt only when the game changes) */
      gamebar() { const m = self.games.mine; return { builds: self.games.barBuilds, ver: m ? m.ver : null, gaming: document.getElementById('hud')?.classList.contains('gaming') ?? false }; },
      /** the toast and the crowd chip on screen: their boxes and whether they overlap */
      hudBoxes() { const r = (id: string) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), shown: getComputedStyle(e).display !== 'none' && (id !== 'toast' || e.classList.contains('on')) }; }; const t = r('toast'), c = r('crowd'), gb = r('gamebar'); const over = !!t && !!c && t.x < c.x + c.w && c.x < t.x + t.w && t.y < c.y + c.h && c.y < t.y + t.h; return { toast: t, crowd: c, gamebar: gb, toastText: self.ctx.hud.toastText, overlap: over }; },
      /** the pieces check: draw no game pieces (true), or all of them again (false) */
      piecesOff(on: boolean) { self.games.piecesOff = on; self.drawItems(); return self.items.counts(); },
      /** a game of each kind under way at once on spots nobody is using (guests' matches aren't moved; a kind with no
       *  free spot isn't staged, and its guests' pieces are drawn instead when they're on the physics) */
      stageGames() { const free = (k: string) => self.games.spots.find((s) => s.kind === k && !s.npcBusy && !s.mine)?.id ?? null; const ids = { pool: free('pool'), darts: free('darts'), shuffleboard: free('shuffleboard') }; const r = self.games.stageAll(ids); self.drawItems(); return { staged: ids, states: r.map((x) => ({ id: x.id, playing: x.playing })), counts: self.items.counts() }; },
      house() { const h = self.house, [u, v] = self.ctx.F.toFrame(h.x, h.z); return { name: HOUSE_NAME, u: +u.toFixed(2), v: +v.toFixed(2), walking: h.walking, clip: self.clips.playing(h.p), lod: h.p.stats().lod, tris: h.p.stats().tris }; },
      gameResults() { return self.gameResults; },
      /** play a game out to its end in sim time: your turns by a strategy, the house's by its own; best: your best pot,
       *  the bed you need, zone 3 (no error); stall: darts down to 20 or less, then off the board; returns the outcome */
      playOut(id: string, strategy: 'best' | 'stall' = 'best', maxMin = 90) {
        const sp = self.games.spot(id); if (!sp) return null;
        let turns = 0, guard = 0; const t0 = self.T;
        while (sp.mine && guard++ < 20000 && self.T - t0 < maxMin) {
          if (sp.yourTurn()) {
            turns++;
            if (sp.kind === 'pool') sp.shoot({ auto: true, settle: true });
            else if (sp.kind === 'darts') {
              const left = (sp.state().left as number[])[0];
              if (strategy === 'stall' && left <= 40) sp.shoot({ x: 0.3, y: 0.3, settle: true });
              else { const tg = left > 60 ? { seg: 20, mult: 3 } : left === 50 ? { seg: 25, mult: 2 } : left === 25 ? { seg: 25, mult: 1 } : left <= 20 ? { seg: left, mult: 1 } : left % 3 === 0 && left / 3 <= 20 ? { seg: left / 3, mult: 3 } : left % 2 === 0 && left / 2 <= 20 ? { seg: left / 2, mult: 2 } : { seg: Math.min(20, left - 1), mult: 1 }; sp.shoot({ ...tg, settle: true }); }
            } else sp.shoot({ zone: 3, settle: true });
          } else self.fastForward(2 / 60);
        }
        return { outcome: sp.outcome, yourTurns: turns, simMinutes: +(self.T - t0).toFixed(2), state: sp.state() };
      },
      // ---- S3a: the crowd, the staff, the fillers and how people are drawn
      /** live, held and fillers counted, and each person's draw mode */
      people() { const c = self.crowd; return { ...c.report(), list: c.list() }; },
      peopleGeometries() { return self.crowd.peopleGeometries(); },
      peopleBrief() { return self.crowd.report(); },
      /** the last n decisions: the NPC, the needs, the top three with scores, what was chosen and any overlay */
      decisions(n = 20) { return self.crowd.decisionsLog.slice(-n); },
      /** the crowd's and the regulars' seed: the room settles again from it */
      seed(n: number) { return self.crowd.seed(n); },
      /** seats walk-ins in a zone ('outside': the patio and the front walk) until n live people are there */
      crowdAt(zone: string, n: number) { return self.crowd.crowdAt(zone, n); },
      /** the build log since a frame: each frame's check and build, each build's person, level, quality, reason, start,
       *  duration and frame; the load and the switches marked */
      builds(since = 0) { return self.crowd.sched.report(since); },
      buildFrame() { return self.crowd.sched.frameNo; },
      fillers() { return self.crowd.fillerList(); },
      crowdLogs(which?: string, n = 400) { const L = self.crowd.logs() as Record<string, unknown[]>; if (which) return (L[which] ?? []).slice(-n); return Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length])); },
      staffReport() { return self.crowd.staffReport(); },
      serveAll() { return self.crowd.serveAll(); },
      resetAudits() { return self.crowd.resetAudits(); },
      /** a seeded moment on a channel now, for the reactions check (the crowd and you react as to the screens' own) */
      fireMoment(kind: 'goal' | 'final' | 'bigChance', team: string, channel: 1 | 2 = 1) {
        const fx = self.tv.inPlay(channel, self.T) ?? self.tv.featured(self.now().week, self.now().day);
        if (!fx) return null;
        const e: TvEvent = { channel: fx.channel, kind, team, intensity: 1, t: self.T, fixture: fx.id, score: [0, 0], label: kind };
        self.moment(e);
        return { fixture: fx.id, home: fx.home.abbr, away: fx.away.abbr, featured: fx.featured, channel: fx.channel };
      },
      setNpcNeeds(values: Record<string, number>, share = 0.3, seed = 7) { return self.crowd.setNpcNeeds(values, share, seed); },
      /** you join the party of guest `id` (Lot 57's Join): they're never held */
      join(id: number) { const n = self.crowd.byId(id); return n ? self.crowd.join(n) : null; },
      tapPerson(id: number) { return self.openPerson(id); },
      /** a tap on the filler at a slot: the hand-over, then their menu */
      tapFiller(slot: string) { const f = self.crowd.fillers.get(slot); if (!f) return null; const [x, z] = [f.x, f.z]; const cam = self.ctx.camera.position; const d = new THREE.Vector3(x - cam.x, f.y + 1.2 - cam.y, z - cam.z), len = d.length(); const ray = new THREE.Ray(cam.clone(), d.normalize()); const n = self.crowd.tapPerson(ray, len + 1); if (!n) return { ok: false }; self.openPerson(n.id); return { ok: true, id: n.id, name: n.name, slot: n.slot, menu: self.ctx.barHud.radialOpen ? self.ctx.barHud.radialItems : null, title: document.querySelector('#radial .title, #radialTitle')?.textContent ?? null }; },
      forceLod0(id: number) { const n = self.crowd.byId(id); if (!n) return null; const p = self.crowd.forceLod0(n); return { id, lod: p.stats().lod, calls: p.stats().calls, tris: p.stats().tris }; },
      atlasImage() { return self.crowd.cards.atlasImage(); },
      tables() { return self.crowd.tables(); },
      /** a tap on guest `id` (a body or a card, held or live): the ray from the camera to their chest; who it gave */
      tapNpc(id: number) { const n = self.crowd.byId(id); if (!n) return null; const cam = self.ctx.camera.position; const d = new THREE.Vector3(n.x - cam.x, n.y + 1.1 - cam.y, n.z - cam.z), len = d.length(); const who = self.crowd.tapPerson(new THREE.Ray(cam.clone(), d.normalize()), len + 1); return who ? { id: who.id, key: who.key, name: who.name, mode: who.mode, same: who.id === id } : null; },
      /** three.js's renderer.debug.onShaderError, watched from now on (each error is still printed); returns what it caught */
      shaderWatch() { const r = self.ctx.renderer as unknown as { debug: { onShaderError: ((...a: unknown[]) => void) | null } }; const w = self as unknown as { shaderErrs?: string[] }; if (!w.shaderErrs) { w.shaderErrs = []; r.debug.onShaderError = (gl, prog, vs, fs) => { const g = gl as WebGL2RenderingContext; const msg = `program ${g.getProgramInfoLog(prog as WebGLProgram)} vs ${g.getShaderInfoLog(vs as WebGLShader)} fs ${g.getShaderInfoLog(fs as WebGLShader)}`; w.shaderErrs!.push(msg); console.error('THREE.WebGLProgram: shader error ' + msg); }; } return w.shaderErrs; },
      /** the spare-body check: a guest sent home at once; a filler's unit handed over directly */
      sendHome(id: number) { const n = self.crowd.byId(id); return n ? self.crowd.sendHome(n) : null; },
      handOverFiller(slot: string) { return self.crowd.handOverAt(slot); },
      /** the drinks' log: orders, waits and the samples of who holds one (reset: start a fresh log) */
      drinks(reset = false) { return self.crowd.drinkReport(reset); },
      fillerCheck() { const c = self.crowd; return { target: c.target(), live: c.liveGuests, held: c.heldGuests, fillers: c.fillers.size, freeEligible: c.freeEligible(), staff: c.staffOn, cap: c.cap, handFails: c.handFails }; },
      npcs(filter?: string) { const l = self.crowd.list(); return filter ? l.filter((x) => JSON.stringify(x).includes(filter)) : l; },
      // ---- S3b: people with each other
      ...self.crowd.social.hooks(),
      setTokens(n: number) { self.save.tokens = Math.max(0, Math.round(n)); self.dirty = true; return self.save.tokens; },
      personMenu(id: number) { return self.openPerson(id) ? { items: self.ctx.barHud.radialItems, info: !!document.querySelector('#radial .info') } : null; },
      relsLoaded() { return self.relsLoaded; },
      /** an item into your hand now (a check's setup: Toast needs you holding a drink) */
      giveYou(id: string) { const it = itemById(id); if (!it) return null; self.give(it); return this.held(); },
    };
  }
}
