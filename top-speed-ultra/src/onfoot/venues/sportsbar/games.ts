// Stoppage Time's games, S2b (PROJECT_OC_SPORTS_BAR.md, "### S2b: the games" and "The games: pool, darts,
// shuffleboard"): pool on the two tables, darts on the three boards and the shuffleboard, each played against the
// scripted house opponent (house.ts) with the engine's physics and rules (engine/sim/pool.ts, darts.ts, shuffle.ts).
// Your controls: pool, drag back from the cue ball to aim and set the power (a guide line shows the first contact),
// release to shoot; darts, hold to steady the swaying aim and flick up to throw; shuffleboard, swipe to slide. Your turn
// moves the camera to the game's own view (gamecams.ts) and returns it after. The pieces are instances of S2a's six
// item meshes ("Held items, table items and game pieces"): the balls, the stripes' bands, the cues and darts as
// sticks, the pucks as discs, their matrices set from the physics each frame; nothing else is drawn for them (the aim
// and the power are HTML, the guide line a stick and a disc). Results: the winner's moodlet and 5 house tokens, or
// "Lost a close one" (life.ts). Nothing is wagered.
import * as THREE from 'three';
import type { Frame } from '../../engine/frame';
import type { P2 } from '../../engine/venue-def';
import type { WalkGrid } from '../../engine/walkgrid';
import type { Person } from '../../people';
import type { HeldItems } from '../../engine/sim/held';
import type { ClipLayer } from '../../engine/sim/clips';
import { PoolGame, POOL, HEAD, rack, candidates, groupOf, Ball, POCKETS, clearPath } from '../../engine/sim/pool';
import { DartsGame, swayInto, bedPoint, scoreAt } from '../../engine/sim/darts';
import { ShuffleGame, SHUFFLE, speedFor, zoneOf } from '../../engine/sim/shuffle';
import type { GameKind } from '../../engine/sim/games';
import { hash32, mulberry } from '../../engine/sim/rng';
import { POOL_TABLES, DART_BOARDS } from './layout';
import { RADIUS } from '../../engine/walkgrid';
import type { BarPlayer } from './player';
import type { HousePlayer } from './house';
import { HOUSE_NAME } from './house';
import { GameCams, CamPose, poolPose } from './gamecams';

export interface GamesCtx {
  F: Frame; camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; grid: WalkGrid;
  player: BarPlayer; person: () => Person | null; house: () => HousePlayer; clips: ClipLayer;
  reduced: () => boolean; input: { enabled: boolean }; overhead: () => boolean; blocked: () => boolean;
  /** your traits and energy as the games read them */
  competitive: () => number; energy: () => number;
  tell: (text: string, s?: number) => void;
  result: (o: GameOutcome) => void;
}
export interface GameOutcome { id: string; kind: GameKind; won: boolean; close: boolean; detail: string; potTwo?: boolean; landedThree?: boolean }
const $ = (id: string) => document.getElementById(id);
const HOUSE_C = 0.6;
const FLOOR = 0.15;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const BALL_HEX = [0xf4f1e8, 0xf2c230, 0x2a5fd0, 0xd13a2f, 0x6a2d8f, 0xf08c1a, 0x1f8a5a, 0x7a2430, 0x141414];
const ballHex = (id: number) => (id === 0 ? BALL_HEX[0] : id <= 8 ? BALL_HEX[id] : BALL_HEX[id - 8]);
const YOU_PUCK = 0xc3f23a, HOUSE_PUCK = 0xff6b4a, YOU_DART = 0xc3f23a, HOUSE_DART = 0xff6b4a;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), _to = new THREE.Vector3();

/** what every game spot shares */
abstract class Spot {
  abstract kind: GameKind;
  abstract label: string;
  /** where you stand to begin (frame) and which way you face */
  abstract start: P2; abstract startFace: P2;
  /** you're in this game */
  mine = false;
  /** the seconds left of a pause between turns (the darts left in the board, a frame's score shown) */
  hold = 0;
  houseWait = 0; houseBusy = false;
  outcome: GameOutcome | null = null;
  /** bumped whenever what the game's bar shows can change (a shot, a landing, a turn, a pause's end, a placing): the
   *  bar's text is rebuilt only then, never every frame */
  ver = 0;
  /** where the game is played from, local metres (the walk-away rule's anchor), worked out once */
  startW: P2 = [0, 0];
  constructor(public id: string, protected g: Games) {}
  bump() { this.ver++; }
  abstract begin(): void;
  abstract get playing(): boolean;
  /** your turn, waiting for your input */
  abstract yourTurn(): boolean;
  /** the house's turn in a game in progress */
  abstract houseUp(): boolean;
  /** whose pause it is (the darts left in the board after your turn: your view stays on the game) */
  holdFor = -1;
  /** the game's view is wanted: your turn, your shot still running, or the pause after it */
  camWanted(): boolean { return this.mine && this.playing && (this.turnNow() === 0 || (this.hold > 0 && this.holdFor === 0)); }
  abstract turnNow(): number;
  /** where the thing you play with is on screen (the cue ball, the board's bull, the next puck): the controls' test */
  abstract focus(out: THREE.Vector3): THREE.Vector3;
  abstract step(dS: number): void;
  abstract draw(I: HeldItems): void;
  abstract camPose(aspect: number, out: CamPose): CamPose;
  abstract state(): Record<string, unknown>;
  abstract shoot(p: Record<string, unknown>): Record<string, unknown>;
  abstract scoreLine(): { title: string; score: string; hint: string };
  // your controls (screen pixels); true when handled
  down(_x: number, _y: number) { return false; }
  move(_x: number, _y: number) { /* none */ }
  up(_x: number, _y: number) { /* none */ }
  frame(_dt: number) { /* real-time touches */ }
  abandon() { this.mine = false; this.houseBusy = false; this.bump(); }
  /** stand you somewhere for the game (the exact point if it's clear of every collider, else the nearest free cell) */
  standYou(at: P2, yaw: number) {
    const p = this.g.ctx.player;
    if (p.clearance(at[0], at[1]) >= RADIUS - 0.02) { p.x = at[0]; p.z = at[1]; p.vx = p.vz = 0; p.seat = null; p.path = null; p.pathGoal = null; p.y = this.g.ctx.grid.height(p.x, p.z); }
    else p.place(at[0], at[1]);
    p.heading = yaw; p.yaw = yaw;
  }
  finish(won: boolean, close: boolean, detail: string, extra: Partial<GameOutcome> = {}) {
    const o: GameOutcome = { id: this.id, kind: this.kind, won, close, detail, ...extra };
    this.outcome = o; this.mine = false; this.houseBusy = false; this.bump();
    this.g.ctx.house().home();
    this.g.ctx.result(o);
  }
}

// ================================================================================================== pool
class PoolSpot extends Spot {
  kind = 'pool' as const; label: string; start: P2; startFace: P2;
  game: PoolGame | null = null;
  private idle: Ball[];
  readonly o: P2; readonly ax: P2; readonly ay: P2; readonly Y: number;
  private rot: THREE.Quaternion[] = Array.from({ length: 16 }, () => new THREE.Quaternion());
  private last = new Float32Array(32);
  /** your aim: the cue's direction (radians, table) and power 0..1 */
  aim = { angle: Math.PI / 2, power: 0, dragging: false, sx: 0, sy: 0, startT: [0, 0] as [number, number] };
  /** ball in hand on your turn: a drag that starts on the cue ball moves it (anywhere on the bed, the nearest free spot) */
  placing = false;
  /** the house's next shot (its direction and speed, after the aim error), worked out when its turn starts */
  private plan: { angle: number; speed: number } | null = null;
  /** a test hook's scripted next shot for the house: a direction and speed, or 'scratch' (the cue ball into the nearest
   *  pocket it can reach) */
  houseNext: { angle: number; speed: number } | 'scratch' | null = null;
  /** the cue's strike: seconds since, and the shot's angle and where the cue ball was */
  private strike = { t: 9, angle: 0, who: 0, x: 0, y: 0 };
  private seed: number;
  /** the scratch the per-frame drawing writes table-to-local points into (no new array per ball, cue or line) */
  private w: P2 = [0, 0];
  /** the guide line's result, filled in place every frame you aim */
  private gd = { len: 0, ghost: [0, 0] as P2, ball: null as number | null, hasOb: false, ob: [0, 0, 0, 0] as [number, number, number, number] };
  constructor(id: string, g: Games, public cu: number, public cv: number, n: number) {
    super(id, g);
    this.label = `Pool table ${n}`;
    const F = g.ctx.F;
    this.o = F.fromFrame(cu, cv); this.ax = F.dirToLocal(1, 0); this.ay = F.dirToLocal(0, 1); this.Y = 0.875 + POOL.R;
    this.start = [cu, cv - 1.12 - 0.42]; this.startFace = [0, 1];
    this.seed = hash32(id, 1);
    this.idle = rack(this.seed);
    for (const b of this.idle) { this.last[b.id * 2] = b.x; this.last[b.id * 2 + 1] = b.y; }
  }
  get balls() { return this.game ? this.game.balls : this.idle; }
  get playing() { return !!this.game && this.game.winner === null; }
  /** table (x across, y along) to local (x, z), written into `out` (by default the spot's own scratch) */
  toW(x: number, y: number, out: P2 = this.w): P2 { out[0] = this.o[0] + x * this.ax[0] + y * this.ay[0]; out[1] = this.o[1] + x * this.ax[1] + y * this.ay[1]; return out; }
  toT(lx: number, lz: number): P2 { const dx = lx - this.o[0], dz = lz - this.o[1]; return [dx * this.ax[0] + dz * this.ax[1], dx * this.ay[0] + dz * this.ay[1]]; }
  yawOf(angle: number) { const c = Math.cos(angle), s = Math.sin(angle); return Math.atan2(c * this.ax[0] + s * this.ay[0], c * this.ax[1] + s * this.ay[1]); }
  begin() {
    this.seed = hash32(this.id, this.seed, 7);
    this.game = new PoolGame([{ who: 'You', group: null, competitive: this.g.ctx.competitive() }, { who: HOUSE_NAME, group: null, competitive: HOUSE_C }], this.seed, 0);
    for (const b of this.game.balls) { this.last[b.id * 2] = b.x; this.last[b.id * 2 + 1] = b.y; this.rot[b.id].identity(); }
    this.mine = true; this.outcome = null; this.plan = null; this.hold = 0; this.placing = false; this.houseNext = null;
    this.aim.angle = Math.PI / 2; this.aim.power = 0;
    this.bump();
    this.g.ctx.tell(`Pool with ${HOUSE_NAME}, the house player · you break`, 3);
    this.yourSetup();
  }
  yourTurn() { const g = this.game; return !!g && this.mine && g.winner === null && g.state === 'aim' && g.turn === 0 && this.hold <= 0; }
  houseUp() { const g = this.game; return !!g && this.mine && g.winner === null && g.turn === 1; }
  turnNow() { return this.game?.turn ?? -1; }
  focus(out: THREE.Vector3) { const c = this.game ? this.game.cue() : this.idle[0], w = this.toW(c.x, c.y); return out.set(w[0], this.Y, w[1]); }
  /** where a shooter stands for a shot along `angle`: behind the cue ball, just clear of the table */
  standPoint(angle: number): [P2, number] {
    const c = this.game!.cue(), dx = Math.cos(angle), dy = Math.sin(angle);
    let d = 0.4;
    for (; d < 2.6; d += 0.05) { const x = c.x - dx * d, y = c.y - dy * d; if (Math.abs(x) > 0.62 + 0.33 || Math.abs(y) > 1.12 + 0.33) break; }
    return [this.toW(c.x - dx * d, c.y - dy * d, [0, 0]), this.yawOf(angle)];
  }
  /** your turn starts: ball in hand starts on the head spot (and stays in hand: drag the cue ball to move it); the aim
   *  points at your best pot, at no power */
  private yourSetup() {
    const g = this.game!;
    if (g.ballInHand) this.placeCue(HEAD[0], HEAD[1]);
    const c = candidates(g.balls, g.targets(0));
    this.aim.angle = c.length ? c[0].angle : Math.atan2(-g.cue().y, -g.cue().x) || Math.PI / 2;
    this.aim.power = 0; this.placing = false;
    const [at, yaw] = this.standPoint(this.aim.angle); this.standYou(at, yaw);
    const p = this.g.ctx.person(); if (p) this.g.ctx.clips.play(p, 'pool-stance');
    // the house steps back to the other end and watches
    const h = this.g.ctx.house(), [hx, hz] = this.g.ctx.F.fromFrame(this.cu - 0.95, this.cv + 1.4);
    if (Math.hypot(h.x - hx, h.z - hz) > 0.3) h.walkTo([hx, hz], Math.atan2(this.o[0] - hx, this.o[1] - hz));
    this.g.ctx.clips.stop(h.p);
    this.bump();
  }
  /** ball in hand: the cue ball to a point on the bed (the nearest free spot), still in hand; you stand behind it */
  placeCue(x: number, y: number) {
    const g = this.game!; g.place(x, y, true);
    const c = g.cue(); this.last[0] = c.x; this.last[1] = c.y;
    if (this.mine && g.turn === 0) { const [at, yaw] = this.standPoint(this.aim.angle); this.standYou(at, yaw); }
    this.bump();
  }
  /** a strike: by you or the house */
  private fire(angle: number, speed: number, who: number) {
    const g = this.game!;
    if (!g.shoot(angle, speed)) return false;
    if (who === 0) { this.aim.dragging = false; this.placing = false; }
    // the cue ball has its speed but hasn't moved yet: where it's struck from
    const c0 = g.cue(); this.strike.t = 0; this.strike.angle = angle; this.strike.who = who; this.strike.x = c0.x; this.strike.y = c0.y;
    const body = who === 0 ? this.g.ctx.person() : this.g.ctx.house().p;
    if (body) this.g.ctx.clips.play(body, 'pool-shot');
    this.bump();
    return true;
  }
  step(dS: number) {
    const g = this.game; if (!g || g.winner !== null) return;
    this.strike.t += dS;
    if (this.hold > 0) {
      this.hold -= dS;
      if (this.hold <= 0) {
        this.bump();
        if (this.mine) { if (g.turn === 0) this.yourSetup(); else { const p = this.g.ctx.person(); if (p) this.g.ctx.clips.stop(p); this.watchFrom(); } }
      }
      return;
    }
    if (g.state === 'rolling') { if (g.step(dS)) this.after(); return; }
    if (g.turn === 1) this.houseTurn(dS);
  }
  private after() {
    const g = this.game!, r = g.last!;
    this.bump();
    const who = r.side === 0 ? 'You' : HOUSE_NAME;
    const objs = r.potted.filter((id) => id !== 0);
    let msg = objs.length ? `${who} pot${r.side === 0 ? '' : 's'} the ${objs.join(', ')}` : r.scratch ? '' : `${who}: nothing down`;
    if (r.note) msg = msg ? `${msg} · ${r.note}` : r.note;
    if (msg) this.g.ctx.tell(msg, 2.5);
    if (g.winner !== null) {
      const won = g.winner === 0;
      this.finish(won, !won && g.closeFor(0), g.overNote, { potTwo: g.bestTurnPots[0] >= 2 });
      return;
    }
    if (g.turn === 0 && this.mine) { this.hold = 0.6; this.holdFor = 0; }
    else if (g.turn === 1) { this.plan = null; this.houseWait = 0; if (r.side === 0) { this.hold = 0.9; this.holdFor = 0; } else this.holdFor = 1; }
  }
  /** the test hook's scratch: the cue ball straight into the nearest pocket it can reach with a clear path (aimed at the
   *  pocket's mouth, inside the cushions' line, so it drops rather than rebounding off a rail) */
  private scratchPlan() {
    const g = this.game!, c = g.cue(), XM = POOL.W / 2 - POOL.R - 0.006, YM = POOL.L / 2 - POOL.R - 0.006;
    let best: { angle: number; speed: number } | null = null, bd = Infinity;
    for (const k of POCKETS) {
      const tx = Math.sign(k.x) * XM, ty = k.side ? 0 : Math.sign(k.y) * YM, d = Math.hypot(tx - c.x, ty - c.y);
      if (d < bd && d > 0.05 && clearPath(g.balls, c.x, c.y, tx, ty, 0)) { bd = d; best = { angle: Math.atan2(ty - c.y, tx - c.x), speed: Math.min(POOL.MAX_V, Math.sqrt(2 * POOL.DECEL * d) + 0.6) }; }
    }
    return best;
  }
  /** the house's turn: plan (ball in hand placed first), walk behind the cue ball, settle into the stance, shoot */
  private houseTurn(dS: number) {
    const g = this.game!, h = this.g.ctx.house();
    if (this.g.houseAt && this.g.houseAt !== this) return;
    this.g.houseAt = this; this.houseBusy = true;
    if (!this.plan) {
      const next = this.houseNext; this.houseNext = null;
      this.plan = next === 'scratch' ? this.scratchPlan() : next ? next : g.plan(hash32(this.seed, g.shots), HOUSE_C);
      if (!this.plan) { this.finish(true, false, `${HOUSE_NAME} had no shot`); return; }
      const [at, yaw] = this.standPoint(this.plan.angle);
      h.walkTo(at, yaw); this.houseWait = 1.4 + (g.shots % 3) * 0.4;
      return;
    }
    if (h.walking) return;
    if (this.g.ctx.clips.playing(h.p) !== 'pool-stance' && this.houseWait > 0.5) this.g.ctx.clips.play(h.p, 'pool-stance');
    this.houseWait -= dS;
    if (this.houseWait <= 0) { const p = this.plan; this.plan = null; this.fire(p.angle, p.speed, 1); this.g.houseAt = null; }
  }
  /** while the house plays, you stand back by the head of the table and watch */
  private watchFrom() {
    const [x, z] = this.g.ctx.F.fromFrame(this.cu + 0.95, this.cv - 1.35);
    const [tx, tz] = this.o; this.standYou([x, z], Math.atan2(tx - x, tz - z));
    this.g.ctx.player.pitch = -0.35;
  }
  // ---- your controls: drag back from the cue ball (on the table's plane), release to shoot; with ball in hand, a drag
  //      that starts on the cue ball moves it first
  private ray = new THREE.Raycaster(); private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); private hit = new THREE.Vector3(); private ndc = new THREE.Vector2();
  private onTable(sx: number, sy: number): P2 | null {
    const c = this.g.ctx.canvas; this.ndc.set((sx / c.clientWidth) * 2 - 1, -(sy / c.clientHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.g.ctx.camera); this.plane.constant = -this.Y;
    return this.ray.ray.intersectPlane(this.plane, this.hit) ? this.toT(this.hit.x, this.hit.z) : null;
  }
  /** the grab radius round the cue ball for placing it (8 cm on the cloth: about 25 px on a phone's pool view) */
  static GRAB = 0.08;
  down(sx: number, sy: number) {
    if (!this.yourTurn()) return false;
    const t = this.onTable(sx, sy); if (!t) return false;
    const g = this.game!, c = g.cue();
    if (g.ballInHand && Math.hypot(t[0] - c.x, t[1] - c.y) < PoolSpot.GRAB) { this.placing = true; this.bump(); return true; }
    this.aim.dragging = true; this.aim.sx = sx; this.aim.sy = sy; this.aim.startT = t; this.move(sx, sy); return true;
  }
  move(sx: number, sy: number) {
    if (this.placing) { const t = this.onTable(sx, sy); if (t && this.game?.ballInHand) this.placeCue(t[0], t[1]); return; }
    if (!this.aim.dragging || !this.game) return;
    const t = this.onTable(sx, sy); if (!t) return;
    const c = this.game.cue(), dx = c.x - t[0], dy = c.y - t[1];
    if (Math.hypot(dx, dy) > 0.04) this.aim.angle = Math.atan2(dy, dx);
    this.aim.power = clamp(Math.hypot(t[0] - this.aim.startT[0], t[1] - this.aim.startT[1]) / 0.55, 0, 1);
    const [at, yaw] = this.standPoint(this.aim.angle); this.standYou(at, yaw);
  }
  up() {
    if (this.placing) { this.placing = false; this.bump(); return; }
    if (!this.aim.dragging) return;
    this.aim.dragging = false;
    if (this.aim.power < 0.04 || !this.yourTurn()) { this.aim.power = 0; return; }
    this.fire(this.aim.angle, 0.25 + this.aim.power * (POOL.MAX_V - 0.25), 0);
    this.aim.power = 0;
  }
  /** the screenshots' aim: an angle (degrees, table; or your best pot) and a power, shown as a drag in progress */
  setAim(angleDeg: number | null, power: number) {
    const g = this.game; if (!g) return null;
    if (angleDeg === null) { const c = candidates(g.balls, g.targets(0)); this.aim.angle = c.length ? c[0].angle : this.aim.angle; } else this.aim.angle = (angleDeg * Math.PI) / 180;
    this.aim.power = power; this.aim.dragging = power > 0;
    const [at, yaw] = this.standPoint(this.aim.angle); this.standYou(at, yaw);
    return { angle: (this.aim.angle * 180) / Math.PI, power };
  }
  /** a scripted shot: { angle (degrees, table) and speed (m/s) }, or { auto: true } (your best pot, no error), or
   *  { break: true }; with ball in hand, place: [x, y] (table metres) puts the cue ball there first (the nearest free
   *  spot); settle runs it to rest at once. An angle or a speed that isn't a finite number, or a speed that isn't above
   *  zero, is refused (never clamped) */
  shoot(p: Record<string, unknown>) {
    const g = this.game; if (!g) return { ok: false, why: 'no game' };
    if (g.state !== 'aim' || g.turn !== 0 || !this.mine) return { ok: false, why: `not your shot (${g.state}, turn ${g.turn})` };
    if (p.angle !== undefined && !(typeof p.angle === 'number' && Number.isFinite(p.angle))) return { ok: false, why: `the angle must be a finite number of degrees (got ${String(p.angle)})` };
    if (p.speed !== undefined && !(typeof p.speed === 'number' && Number.isFinite(p.speed) && p.speed > 0)) return { ok: false, why: `the speed must be a finite number above 0 m/s (got ${String(p.speed)})` };
    const inHand = g.ballInHand;
    if (p.place !== undefined) {
      const pl = p.place as unknown;
      if (!Array.isArray(pl) || pl.length !== 2 || !pl.every((v) => typeof v === 'number' && Number.isFinite(v))) return { ok: false, why: 'place wants [x, y] in table metres' };
      if (!inHand) return { ok: false, why: 'no ball in hand: the cue ball can only be placed after a scratch' };
      this.placeCue(pl[0] as number, pl[1] as number);
    }
    this.hold = 0;
    let angle = typeof p.angle === 'number' ? ((p.angle as number) * Math.PI) / 180 : this.aim.angle, speed = typeof p.speed === 'number' ? (p.speed as number) : 2;
    if (p.auto || p.break) {
      if (g.breakShot || p.break) { const cue = g.cue(), apex = g.balls.reduce((m, b) => (b.id && b.on && b.y < m.y ? b : m), { y: Infinity } as Ball); angle = Math.atan2(apex.y - cue.y, apex.x - cue.x); speed = 5; }
      else { const pl = g.plan(hash32('you', g.shots), 1); if (pl) { angle = pl.plan.angle; speed = pl.plan.speed; } }
    }
    this.aim.angle = angle;
    const [at, yaw] = this.standPoint(angle); this.standYou(at, yaw);
    if (!this.fire(angle, speed, 0)) return { ok: false, why: 'the shot was refused' };
    const from: P2 = [+this.strike.x.toFixed(4), +this.strike.y.toFixed(4)];
    let t = 0;
    if (p.settle) { t = g.settle(); this.after(); }
    return { ok: true, angle: +((angle * 180) / Math.PI).toFixed(2), speed: +speed.toFixed(3), from, ballInHand: inHand, settledIn: +t.toFixed(2), last: g.last };
  }
  /** the guide: the cue's path to its first contact (a ball's ghost position or a cushion), and the object ball's line;
   *  filled into one object kept for it (no new object or array while you aim) */
  guide() {
    const g = this.game!, c = g.cue(), dx = Math.cos(this.aim.angle), dy = Math.sin(this.aim.angle), R2 = 2 * POOL.R, gd = this.gd;
    let best = Infinity, hitBall: Ball | null = null;
    for (const b of g.balls) {
      if (!b.on || b.id === 0) continue;
      const ox = b.x - c.x, oy = b.y - c.y, t = ox * dx + oy * dy; if (t <= 0) continue;
      const q = ox * ox + oy * oy - t * t; if (q > R2 * R2) continue;
      const tt = t - Math.sqrt(R2 * R2 - q); if (tt < best) { best = tt; hitBall = b; }
    }
    const XM = POOL.W / 2 - POOL.R, YM = POOL.L / 2 - POOL.R;
    const tw = Math.min(dx > 1e-9 ? (XM - c.x) / dx : dx < -1e-9 ? (-XM - c.x) / dx : Infinity, dy > 1e-9 ? (YM - c.y) / dy : dy < -1e-9 ? (-YM - c.y) / dy : Infinity);
    if (tw < best) { best = tw; hitBall = null; }
    const gx = c.x + dx * best, gy = c.y + dy * best;
    gd.len = best; gd.ghost[0] = gx; gd.ghost[1] = gy; gd.ball = hitBall ? hitBall.id : null; gd.hasOb = !!hitBall;
    if (hitBall) { const nx = hitBall.x - gx, ny = hitBall.y - gy, l = Math.hypot(nx, ny) || 1; gd.ob[0] = hitBall.x; gd.ob[1] = hitBall.y; gd.ob[2] = nx / l; gd.ob[3] = ny / l; }
    return gd;
  }
  frame(dt: number) {
    // the balls roll: each turns about the axis across its motion by the distance it went over its radius
    for (const b of this.balls) {
      const i = b.id * 2, mx = b.x - this.last[i], my = b.y - this.last[i + 1];
      this.last[i] = b.x; this.last[i + 1] = b.y;
      const d = Math.hypot(mx, my); if (d < 1e-6 || d > 0.5) continue;
      const wx = mx * this.ax[0] + my * this.ay[0], wz = mx * this.ax[1] + my * this.ay[1];
      _d.set(wz, 0, -wx).normalize();
      this.rot[b.id].premultiply(_q.setFromAxisAngle(_d, d / POOL.R));
    }
    void dt;
  }
  draw(I: HeldItems) {
    const ox = this.o[0], oz = this.o[1], ax = this.ax, ay = this.ay;
    for (const b of this.balls) {
      if (!b.on) continue;
      _m.compose(_p.set(ox + b.x * ax[0] + b.y * ay[0], this.Y, oz + b.x * ax[1] + b.y * ay[1]), this.rot[b.id], _s.set(1, 1, 1));
      const stripe = b.id > 8;
      I.put('ball', _m, stripe ? 0xf4f1e8 : ballHex(b.id));
      if (stripe) I.put('band', _m, ballHex(b.id));
    }
    const g = this.game; if (!g || g.winner !== null) return;
    // the cue: behind the cue ball while aiming (yours pulled back with the power), through the strike, then away; not
    // while you're placing the cue ball in hand
    const c = g.cue();
    const aiming = g.state === 'aim' && ((g.turn === 0 && this.mine && this.hold <= 0 && !this.placing) || (g.turn === 1 && !!this.plan && !this.g.ctx.house().walking));
    const striking = this.strike.t < 0.35;
    if (aiming || striking) {
      const ang = aiming ? (g.turn === 0 ? this.aim.angle : this.plan!.angle) : this.strike.angle;
      const pull = aiming ? (g.turn === 0 ? 0.03 + this.aim.power * 0.22 : 0.1) : Math.max(-0.02, 0.12 - this.strike.t * 0.9);
      const bx = aiming ? c.x : this.strike.x, by = aiming ? c.y : this.strike.y;
      const dx = Math.cos(ang), dy = Math.sin(ang), wdx = dx * ax[0] + dy * ay[0], wdz = dx * ax[1] + dy * ay[1];
      const e = (8 * Math.PI) / 180, ux = wdx * Math.cos(e), uy = -Math.sin(e), uz = wdz * Math.cos(e);
      const back = POOL.R + 0.012 + pull, tx = ox + (bx - dx * back) * ax[0] + (by - dy * back) * ay[0], tz = oz + (bx - dx * back) * ax[1] + (by - dy * back) * ay[1];
      const ty = this.Y + 0.004, Lc = 1.47;
      _q.setFromUnitVectors(UP, _d.set(ux, uy, uz));
      _m.compose(_p.set(tx - ux * Lc, ty - uy * Lc, tz - uz * Lc), _q, _s.set(2, Lc, 2));
      I.put('stick', _m, 0xc8a070);
    }
    if (aiming && g.turn === 0) {
      // the guide line on the cloth to the first contact, the ghost ball there, and the object ball's line
      const gd = this.guide(), sx = ox + c.x * ax[0] + c.y * ay[0], sz = oz + c.x * ax[1] + c.y * ay[1], dx = Math.cos(this.aim.angle), dy = Math.sin(this.aim.angle);
      const wdx = dx * ax[0] + dy * ay[0], wdz = dx * ax[1] + dy * ay[1];
      const yl = 0.876 + 0.004;
      if (gd.len > POOL.R) {
        _q.setFromUnitVectors(UP, _d.set(wdx, 0, wdz));
        _m.compose(_p.set(sx + wdx * POOL.R, yl, sz + wdz * POOL.R), _q, _s.set(0.35, gd.len - POOL.R, 0.35));
        I.put('stick', _m, 0xf1efe7);
      }
      const gx = ox + gd.ghost[0] * ax[0] + gd.ghost[1] * ay[0], gz = oz + gd.ghost[0] * ax[1] + gd.ghost[1] * ay[1];
      _m.compose(_p.set(gx, yl - 0.002, gz), _q.identity(), _s.set(POOL.R, 0.002, POOL.R));
      I.put('disc', _m, 0xf1efe7);
      if (gd.hasOb) {
        const ob = gd.ob, bx = ox + ob[0] * ax[0] + ob[1] * ay[0], bz = oz + ob[0] * ax[1] + ob[1] * ay[1], odx = ob[2] * ax[0] + ob[3] * ay[0], odz = ob[2] * ax[1] + ob[3] * ay[1];
        _q.setFromUnitVectors(UP, _d.set(odx, 0, odz));
        _m.compose(_p.set(bx + odx * POOL.R, yl, bz + odz * POOL.R), _q, _s.set(0.35, 0.28, 0.35));
        I.put('stick', _m, 0xc3f23a);
      }
    }
  }
  private along = new THREE.Vector3(); private across = new THREE.Vector3(); private centre = new THREE.Vector3();
  camPose(aspect: number, out: CamPose) {
    this.centre.set(this.o[0], this.Y, this.o[1]); this.along.set(this.ay[0], 0, this.ay[1]); this.across.set(this.ax[0], 0, this.ax[1]);
    return poolPose(this.centre, this.along, this.across, aspect, out);
  }
  scoreLine() {
    const g = this.game!;
    const side = (s: number) => { const gr = g.sides[s].group, n = g.leftN[s]; return gr ? `${gr}, ${n} left${n === 0 ? ' (on the 8)' : ''}` : 'open table'; };
    const turn = g.winner !== null ? (g.winner === 0 ? 'You win' : `${HOUSE_NAME} wins`) : g.state === 'rolling' ? 'Rolling…' : g.turn === 0 ? 'Your shot' : `${HOUSE_NAME}'s shot`;
    const hint = !this.yourTurn() ? '' : g.ballInHand
      ? (this.placing ? 'Ball in hand: drag to put the cue ball anywhere on the table · let go to set it' : 'Ball in hand: drag the cue ball to place it anywhere · then drag back from it to aim · release to shoot')
      : 'Drag back from the cue ball to aim and set the power · release to shoot';
    return { title: `POOL · ${this.label.toUpperCase()}`, score: `You: ${side(0)} · ${HOUSE_NAME}: ${side(1)} · ${turn}`, hint };
  }
  state() {
    const g = this.game;
    return {
      id: this.id, kind: this.kind, playing: this.playing, mine: this.mine, outcome: this.outcome,
      balls: this.balls.map((b) => ({ id: b.id, on: b.on, x: +b.x.toFixed(4), y: +b.y.toFixed(4), moving: b.vx !== 0 || b.vy !== 0, group: groupOf(b.id) })),
      ...(g ? { state: g.state, turn: g.turn, sides: g.sides.map((s) => ({ ...s })), open: g.open, ballInHand: g.ballInHand, placing: this.placing, cue: [+g.cue().x.toFixed(4), +g.cue().y.toFixed(4)], strikeFrom: [+this.strike.x.toFixed(4), +this.strike.y.toFixed(4)], winner: g.winner, shots: g.shots, last: g.last, log: g.log.slice(-8), left: [g.left(0), g.left(1)], bestTurnPots: [...g.bestTurnPots], maxEnergyRise: g.maxEnergyRise, yourTurn: this.yourTurn(), aim: { angle: +((this.aim.angle * 180) / Math.PI).toFixed(2), power: +this.aim.power.toFixed(3) }, guide: this.yourTurn() ? (() => { const gd = this.guide(); return { len: gd.len, ghost: [...gd.ghost], ball: gd.ball, ob: gd.hasOb ? [...gd.ob] : null }; })() : null } : {}),
    };
  }
  abandon() { super.abandon(); if (this.game && this.game.winner === null) this.game.winner = -1 as never; this.plan = null; this.placing = false; this.houseNext = null; }
}

// ================================================================================================== darts
class DartsSpot extends Spot {
  kind = 'darts' as const; label: string; start: P2; startFace: P2 = [0, 1];
  game: DartsGame | null = null;
  readonly c = new THREE.Vector3(); readonly n: P2; readonly right: P2;
  /** your aim on the board (metres), the hold, and the recent touches for the flick */
  aim = { x: 0, y: bedPoint(20, 3)[1], holding: false, t: 0, t0: 0, phase: 0, sx: 0, sy: 0, hist: [] as { t: number; x: number; y: number; ax: number; ay: number }[] };
  private flying: { from: THREE.Vector3; to: P2; t: number; dur: number; side: number; delay: number }[] = [];
  private seed: number;
  /** the places this board's game uses, worked out once (local metres and yaws): the oche, where you stand aside on the
   *  house's turn, where the house waits on yours, and the camera's eye over your right shoulder */
  private ocheAt: P2; private ocheYaw: number; private asideAt: P2; private asideYaw: number; private houseAside: P2; private houseAsideYaw: number;
  private camEye = new THREE.Vector3();
  /** scratch pairs for the sway and the reticle (no new array a frame) */
  private sw: [number, number] = [0, 0]; private ret: P2 = [0, 0];
  /** the test hook's hold: a dart in the air stays at this share of its flight (null: it flies) */
  holdAt: number | null = null;
  constructor(id: string, g: Games, public u: number, n: number) {
    super(id, g);
    this.label = `Dartboard ${n}`;
    const F = g.ctx.F, [x, z] = F.fromFrame(u, 15.69 - 0.006);
    this.c.set(x, 1.73 + FLOOR, z);
    this.n = F.dirToLocal(0, -1); this.right = [this.n[1], -this.n[0]];
    this.start = [u, 13.15];
    this.seed = hash32(id, 3);
    this.ocheAt = F.fromFrame(u, 13.15); this.ocheYaw = Math.atan2(-this.n[0], -this.n[1]);
    this.asideAt = F.fromFrame(u - 0.85, 12.55); this.asideYaw = Math.atan2(this.c.x - this.asideAt[0], this.c.z - this.asideAt[1]);
    this.houseAside = F.fromFrame(u + 0.85, 12.55); this.houseAsideYaw = Math.atan2(this.c.x - this.houseAside[0], this.c.z - this.houseAside[1]);
    // over your right shoulder, far enough out that your head stays out of the frame and your throwing arm comes in
    this.camEye.set(this.ocheAt[0] + this.right[0] * 0.46 + this.n[0] * 0.6, 1.84, this.ocheAt[1] + this.right[1] * 0.46 + this.n[1] * 0.6);
  }
  get playing() { return !!this.game && this.game.winner === null; }
  /** a point on the board's face: board (x right, y up) to local */
  toW(x: number, y: number, out = _p) { return out.set(this.c.x + this.right[0] * x + this.n[0] * 0.004, this.c.y + y, this.c.z + this.right[1] * x + this.n[1] * 0.004); }
  begin() {
    this.seed = hash32(this.id, this.seed, 11);
    this.game = new DartsGame([{ who: 'You', competitive: this.g.ctx.competitive() }, { who: HOUSE_NAME, competitive: HOUSE_C }], 0);
    this.mine = true; this.outcome = null; this.flying.length = 0; this.hold = 0;
    this.bump();
    this.g.ctx.tell(`Darts with ${HOUSE_NAME}: 301, straight out · you throw first`, 3);
    this.yourSetup();
  }
  private yourSetup() {
    this.standYou(this.ocheAt, this.ocheYaw); this.g.ctx.player.pitch = 0.05; this.aim.holding = false;
    const h = this.g.ctx.house(), ha = this.houseAside;
    if (Math.hypot(h.x - ha[0], h.z - ha[1]) > 0.3) h.walkTo(ha, this.houseAsideYaw);
    this.bump();
  }
  yourTurn() { const g = this.game; return !!g && this.mine && g.winner === null && g.turn === 0 && this.hold <= 0 && !this.flying.length; }
  houseUp() { const g = this.game; return !!g && this.mine && g.winner === null && g.turn === 1; }
  turnNow() { return this.game?.turn ?? -1; }
  focus(out: THREE.Vector3) { return this.toW(this.aim.x, this.aim.y, out); }
  /** a dart on its way: from the thrower's hand to (x, y) on the board, landing after `delay + dur` */
  private throwDart(side: number, to: P2, delay = 0.12) {
    const body = side === 0 ? this.g.ctx.person() : this.g.ctx.house().p;
    if (body) this.g.ctx.clips.play(body, 'dart-throw', { upper: false });
    const thrower = side === 0 ? this.g.ctx.player : this.g.ctx.house();
    const from = new THREE.Vector3(thrower.x + this.right[0] * 0.22 - this.n[0] * 0.25, 1.72, thrower.z + this.right[1] * 0.22 - this.n[1] * 0.25);
    this.flying.push({ from, to, t: 0, dur: 0.32, side, delay });
    this.bump();
  }
  step(dS: number) {
    const g = this.game; if (!g || g.winner !== null) return;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      // the throw's wind-up, then the flight; a long step (a fast-forward's second) carries its remainder over
      const f = this.flying[i]; let d = dS;
      if (f.delay > 0) { const w = Math.min(f.delay, d); f.delay -= w; d -= w; if (f.delay > 0) continue; }
      f.t += d;
      if (this.holdAt !== null) f.t = Math.min(f.t, this.holdAt * f.dur);
      if (f.t >= f.dur) { this.flying.splice(i, 1); this.landed(f.side, f.to); }
    }
    if (this.flying.length) return;
    if (this.hold > 0) {
      this.hold -= dS;
      if (this.hold <= 0) {
        // the darts come out of the board and the oche passes
        this.bump();
        if (g.dart === 0 || g.winner !== null) g.clearBoard();
        if (g.turn === 0 && this.mine) this.yourSetup();
        else if (g.turn === 1) { this.standYou(this.asideAt, this.asideYaw); this.houseWait = 0; }
      }
      return;
    }
    if (g.turn === 1) this.houseTurn(dS);
  }
  private landed(side: number, to: P2) {
    const g = this.game!; if (g.turn !== side) return;
    const res = g.land(to[0], to[1], g.thrown.length);
    this.bump();
    const who = side === 0 ? 'You' : HOUSE_NAME;
    this.g.ctx.tell(`${who}: ${res.hit.label === 'Miss' ? 'off the board' : res.hit.label} · ${res.hit.score}${res.bust ? ' · bust' : ''} · ${res.won ? 'checked out!' : `${res.left} to go`}`, 2);
    if (res.won) { const won = side === 0; this.finish(won, !won && g.closeFor(0), won ? 'You checked out' : `${HOUSE_NAME} checked out`); return; }
    if (res.turnOver) { this.hold = 1.1; this.holdFor = side; }
  }
  private houseTurn(dS: number) {
    const g = this.game!, h = this.g.ctx.house();
    if (this.g.houseAt && this.g.houseAt !== this) return;
    this.g.houseAt = this; this.houseBusy = true;
    const at = this.ocheAt;
    if (Math.hypot(h.x - at[0], h.z - at[1]) > 0.15 && !h.walking) { h.walkTo(at, this.ocheYaw); this.houseWait = 0.9; return; }
    if (h.walking) return;
    this.houseWait -= dS;
    if (this.houseWait > 0) return;
    const t = g.houseThrow(this.seed, HOUSE_C);
    this.throwDart(1, t.at);
    this.houseWait = 1.2;
    if (g.dart >= 2) { this.g.houseAt = null; }
  }
  // ---- your controls: press and hold (the aim steadies for 1.2 s, then sways more), drag to move it, flick up to throw
  down(sx: number, sy: number) {
    if (!this.yourTurn()) return false;
    const a = this.aim; a.holding = true; a.t = 0; a.t0 = performance.now() / 1000; a.sx = sx; a.sy = sy; a.phase = (this.game!.thrown.length * 1.7) % 6.28; a.hist.length = 0;
    a.hist.push({ t: performance.now() / 1000, x: sx, y: sy, ax: a.x, ay: a.y });
    return true;
  }
  move(sx: number, sy: number) {
    const a = this.aim; if (!a.holding) return;
    const now = performance.now() / 1000, last = a.hist[a.hist.length - 1];
    const dx = sx - last.x, dy = sy - last.y, dtt = Math.max(1e-3, now - last.t), v = Math.hypot(dx, dy) / dtt / this.g.ctx.canvas.clientHeight;
    // a slow drag moves the aim (0.4 mm a pixel); a fast stroke is the flick, and leaves it
    if (v < 1.2) { a.x = clamp(a.x + dx * 0.0004, -0.2, 0.2); a.y = clamp(a.y - dy * 0.0004, -0.2, 0.2); }
    a.hist.push({ t: now, x: sx, y: sy, ax: a.x, ay: a.y }); if (a.hist.length > 12) a.hist.shift();
  }
  up(_sx: number, sy: number) {
    const a = this.aim; if (!a.holding) return;
    a.holding = false;
    const now = performance.now() / 1000, h = this.g.ctx.canvas.clientHeight;
    const old = a.hist.find((p) => now - p.t <= 0.15) ?? a.hist[0];
    const vy = (sy - old.y) / Math.max(0.016, now - old.t) / h;
    if (vy > -1.0 || !this.yourTurn()) return;                 // no flick up: no throw
    // the hold is real time (a slow frame doesn't shorten it), up to the flick's start
    this.release(old.ax, old.ay, Math.max(0, old.t - a.t0));
  }
  /** your dart: the aim plus the sway at the moment of release, plus a few millimetres of release scatter */
  private release(ax: number, ay: number, held: number) {
    const sw = swayInto(held, this.g.ctx.energy(), this.aim.phase, this.sw), r = mulberry(hash32('your-dart', this.seed, this.game!.thrown.length));
    const to: P2 = [ax + sw[0] + (r() - 0.5) * 0.008, ay + sw[1] + (r() - 0.5) * 0.008];
    this.throwDart(0, to, 0.12);
    return to;
  }
  frame(_dt: number) {
    if (this.aim.holding) this.aim.t = performance.now() / 1000 - this.aim.t0;
  }
  /** the screenshots' and the tests' aim: where, and held (from now) or not */
  setAim(x: number, y: number, holding: boolean) { const a = this.aim; a.x = x; a.y = y; a.holding = holding; a.t0 = performance.now() / 1000; a.t = 0; return { ...a, hist: undefined }; }
  /** where the reticle is now (the aim and its sway), on screen, written into a pair kept for it */
  reticle(cam: THREE.PerspectiveCamera, w: number, h: number): P2 | null {
    if (!this.yourTurn()) return null;
    cam.updateMatrixWorld();
    const a = this.aim;
    if (a.holding) swayInto(a.t, this.g.ctx.energy(), a.phase, this.sw); else { this.sw[0] = 0; this.sw[1] = 0; }
    const p = this.toW(a.x + this.sw[0], a.y + this.sw[1], _d).project(cam);
    if (p.z > 1) return null;
    this.ret[0] = (p.x * 0.5 + 0.5) * w; this.ret[1] = (-p.y * 0.5 + 0.5) * h;
    return this.ret;
  }
  /** a scripted dart: { x, y } (metres on the board) or { seg, mult } (a bed's middle), thrown as is (no sway) or with
   *  the sway after `held` seconds; settle lands it at once */
  shoot(p: Record<string, unknown>) {
    const g = this.game; if (!g) return { ok: false, why: 'no game' };
    if (!this.yourTurn()) return { ok: false, why: `not your throw (turn ${g.turn}, hold ${this.hold.toFixed(2)}, flying ${this.flying.length})` };
    for (const k of ['x', 'y', 'held', 'seg', 'mult']) if (p[k] !== undefined && !(typeof p[k] === 'number' && Number.isFinite(p[k] as number) && (k === 'x' || k === 'y' || (p[k] as number) >= 0))) return { ok: false, why: `${k} must be a finite number${k === 'x' || k === 'y' ? '' : ' of at least 0'} (got ${String(p[k])})` };
    let to: P2;
    if (typeof p.seg === 'number') to = bedPoint(p.seg as number, ((p.mult as number) ?? 1) as 1 | 2 | 3);
    else to = [Number(p.x ?? 0), Number(p.y ?? 0)];
    if (typeof p.held === 'number') to = this.release(to[0], to[1], p.held as number);
    else this.throwDart(0, to, 0.12);
    let res: unknown = null;
    if (p.settle) { const f = this.flying[this.flying.length - 1]; this.flying.pop(); const before = g.thrown.length; this.landed(0, f.to); res = g.thrown[before] ? { hit: g.thrown[before].hit, left: g.left[0] } : null; }
    return { ok: true, to: [+to[0].toFixed(4), +to[1].toFixed(4)], expect: scoreAt(to[0], to[1]), result: res };
  }
  draw(I: HeldItems) {
    const g = this.game; if (!g) return;
    // darts in the board: the tip at the hit, the barrel and flight standing out toward the oche, a little up
    const L = 0.14, ux = this.n[0] * 0.985, uy = 0.17, uz = this.n[1] * 0.985;
    for (const d of g.board) {
      const p = this.toW(d.x, d.y);
      _q.setFromUnitVectors(UP, _d.set(-ux, -uy, -uz).normalize());
      _m.compose(_p.set(p.x + ux * L, p.y + uy * L, p.z + uz * L), _q, _s.set(0.9, L, 0.9));
      I.put('stick', _m, d.side === 0 ? YOU_DART : HOUSE_DART);
    }
    for (const f of this.flying) {
      if (f.delay > 0) continue;
      const k = Math.min(1, f.t / f.dur), to = this.toW(f.to[0], f.to[1], _to);
      const x = f.from.x + (to.x - f.from.x) * k, z = f.from.z + (to.z - f.from.z) * k, y = f.from.y + (to.y - f.from.y) * k + Math.sin(k * Math.PI) * 0.12;
      _d.set(to.x - f.from.x, to.y - f.from.y + Math.cos(k * Math.PI) * 0.37, to.z - f.from.z).normalize();
      _q.setFromUnitVectors(UP, _d);
      _m.compose(_p.set(x - _d.x * L, y - _d.y * L, z - _d.z * L), _q, _s.set(0.9, L, 0.9));
      I.put('stick', _m, f.side === 0 ? YOU_DART : HOUSE_DART);
    }
  }
  camPose(_aspect: number, out: CamPose) {
    out.eye.copy(this.camEye);
    out.target.copy(this.c).setY(this.c.y - 0.02);
    out.up.set(0, 1, 0); out.fov = 24;
    return out;
  }
  scoreLine() {
    const g = this.game!;
    const turn = g.winner !== null ? (g.winner === 0 ? 'You win' : `${HOUSE_NAME} wins`) : g.turn === 0 ? `Your throw · dart ${g.dart + 1} of 3` : `${HOUSE_NAME} throws · dart ${Math.min(3, g.dart + 1)} of 3`;
    return { title: `DARTS · 301 · ${this.label.toUpperCase()}`, score: `You ${g.left[0]} · ${HOUSE_NAME} ${g.left[1]} · ${turn}`, hint: this.yourTurn() ? 'Hold to steady your aim (drag to move it) · flick up to throw' : '' };
  }
  state() {
    const g = this.game;
    return { id: this.id, kind: this.kind, playing: this.playing, mine: this.mine, outcome: this.outcome, ...(g ? { left: [...g.left], turn: g.turn, dart: g.dart, winner: g.winner, busts: [...g.busts], board: g.board.map((d) => ({ side: d.side, label: d.hit.label, score: d.hit.score })), thrown: g.thrown.length, flying: this.flying.length, inAir: this.flying.filter((f) => f.delay <= 0).length, flights: this.flying.map((f) => ({ side: f.side, windUp: +f.delay.toFixed(3), k: +(f.t / f.dur).toFixed(3) })), holdAt: this.holdAt, hold: +this.hold.toFixed(2), yourTurn: this.yourTurn(), aim: { x: +this.aim.x.toFixed(4), y: +this.aim.y.toFixed(4), holding: this.aim.holding, t: +this.aim.t.toFixed(2) } } : {}) };
  }
  abandon() { super.abandon(); this.flying.length = 0; if (this.game && this.game.winner === null) this.game.winner = -1 as never; }
}

// ================================================================================================== shuffleboard
class ShuffleSpot extends Spot {
  kind = 'shuffleboard' as const; label = 'The shuffleboard'; start: P2 = [2.7, 1.45]; startFace: P2 = [1, 0];
  game: ShuffleGame | null = null;
  readonly Y = 0.97;
  /** your swipe */
  swipe = { on: false, hist: [] as { t: number; x: number; y: number }[], x0: 0 };
  /** the release's lateral sign on screen: +1 when the bed's +y is to the right of a camera looking down the bed */
  side: number;
  private seed: number; lastSpeed = 0; lastLine = 0;
  /** the bed's frame in local metres (its throwing end's centre and its two axes) and the game's places, worked out
   *  once: where the thrower stands, where the one waiting stands (you, the house), the camera's eye and target */
  private o: P2; private ax: P2; private ay: P2; private w: P2 = [0, 0];
  private throwAt: P2; private throwYaw: number; private asideAt: P2; private asideYaw: number; private houseAside: P2; private houseAsideYaw: number;
  private camEye = new THREE.Vector3(); private camTarget = new THREE.Vector3();
  constructor(id: string, g: Games) {
    super(id, g);
    // looking along a local direction (dx, dz) with y up, the right is (-dz, dx) (S2b had (dz, -dx), the left, so a swipe
    // to the right sent the puck left and the camera stood on the left: repaired)
    const F = g.ctx.F, f = F.dirToLocal(1, 0), right: P2 = [-f[1], f[0]], ay = F.dirToLocal(0, 1);
    this.side = Math.sign(right[0] * ay[0] + right[1] * ay[1]) || 1;
    this.seed = hash32(id, 5);
    this.o = F.fromFrame(3.2, 1.45); this.ax = f; this.ay = ay;
    this.throwAt = F.fromFrame(2.75, 1.45); this.throwYaw = F.yawFromFrame(1, 0);
    const look = F.fromFrame(7.5, 1.45);
    this.asideAt = F.fromFrame(3.6, 2.15); this.asideYaw = Math.atan2(look[0] - this.asideAt[0], look[1] - this.asideAt[1]);
    this.houseAside = F.fromFrame(4.5, 2.15); this.houseAsideYaw = Math.atan2(look[0] - this.houseAside[0], look[1] - this.houseAside[1]);
    // just over the puck's release and to your side of it, ahead of your body, looking down the board to the far end
    const e = F.fromFrame(2.95, 1.45 + 0.34 * this.side), t = F.fromFrame(7.9, 1.45);
    this.camEye.set(e[0], 1.72, e[1]); this.camTarget.set(t[0], 0.82, t[1]);
  }
  get playing() { return !!this.game && this.game.winner === null; }
  /** bed (x along from the throwing end, y across) to local, written into `out` (by default the spot's scratch) */
  toW(x: number, y: number, out: P2 = this.w): P2 { out[0] = this.o[0] + x * this.ax[0] + y * this.ay[0]; out[1] = this.o[1] + x * this.ax[1] + y * this.ay[1]; return out; }
  begin() {
    this.seed = hash32(this.id, this.seed, 13);
    this.game = new ShuffleGame([{ who: 'You', competitive: this.g.ctx.competitive() }, { who: HOUSE_NAME, competitive: HOUSE_C }], 0);
    this.mine = true; this.outcome = null; this.hold = 0;
    this.bump();
    this.g.ctx.tell(`Shuffleboard with ${HOUSE_NAME}: four pucks a side, first to 15 · you slide first`, 3);
    this.yourSetup();
  }
  private yourSetup() {
    this.follow = null;
    this.standYou(this.throwAt, this.throwYaw); this.g.ctx.player.pitch = -0.12;
    const h = this.g.ctx.house(), ha = this.houseAside;
    if (Math.hypot(h.x - ha[0], h.z - ha[1]) > 0.3) h.walkTo(ha, this.houseAsideYaw);
    this.bump();
  }
  yourTurn() { const g = this.game; return !!g && this.mine && g.winner === null && g.state === 'aim' && g.turn === 0 && this.hold <= 0; }
  houseUp() { const g = this.game; return !!g && this.mine && g.winner === null && g.turn === 1; }
  turnNow() { return this.game?.turn ?? -1; }
  focus(out: THREE.Vector3) { const w = this.toW(SHUFFLE.X0, 0); return out.set(w[0], this.Y + 0.01, w[1]); }
  private slide(speed: number, line: number, y0: number, side: number) {
    const g = this.game!;
    if (!g.slide(speed, line, y0)) return false;
    const body = side === 0 ? this.g.ctx.person() : this.g.ctx.house().p;
    if (body) this.g.ctx.clips.play(body, 'shuffle-slide');
    if (side === 0) { this.lastSpeed = speed; this.lastLine = line; this.follow = g.pucks[g.pucks.length - 1]; }
    this.bump();
    return true;
  }
  step(dS: number) {
    const g = this.game; if (!g || g.winner !== null) return;
    if (this.hold > 0) {
      this.hold -= dS;
      if (this.hold <= 0) { this.bump(); if (g.turn === 0 && this.mine) this.yourSetup(); else this.standYou(this.asideAt, this.asideYaw); }
      return;
    }
    if (g.state === 'sliding') { const f0 = g.frame; if (g.step(dS)) this.after(f0); return; }
    if (g.turn === 1) this.houseTurn(dS);
  }
  private after(frame0: number) {
    const g = this.game!;
    this.bump();
    const p = g.pucks[g.pucks.length - 1];
    if (g.frame !== frame0 || g.winner !== null) {
      const f = g.lastFrame!;
      this.g.ctx.tell(`Frame ${frame0}: ${f.scorer === null ? 'no score' : `${f.scorer === 0 ? 'you score' : `${HOUSE_NAME} scores`} ${f.points}`} · You ${f.score[0]}, ${HOUSE_NAME} ${f.score[1]}`, 3);
      if (g.winner !== null) { const won = g.winner === 0; this.finish(won, !won && g.closeFor(0), `${won ? 'You' : HOUSE_NAME} reached ${g.score[g.winner]}`, { landedThree: g.best3[0] }); return; }
      this.hold = 2.2; this.holdFor = p && p.side === 0 ? 0 : 1;
    } else if (p) {
      const who = p.side === 0 ? 'Your' : `${HOUSE_NAME}'s`;
      this.g.ctx.tell(`${who} puck: ${p.out === 'gutter' ? 'in the gutter' : p.out === 'short' ? 'short of the line' : `zone ${zoneOf(p.x)}`}`, 1.8);
      this.hold = 0.7; this.holdFor = p.side;
    }
  }
  private plan: ReturnType<ShuffleGame['housePlan']> | null = null;
  private houseTurn(dS: number) {
    const g = this.game!, h = this.g.ctx.house();
    if (this.g.houseAt && this.g.houseAt !== this) return;
    this.g.houseAt = this; this.houseBusy = true;
    const at = this.throwAt;
    if (Math.hypot(h.x - at[0], h.z - at[1]) > 0.15 && !h.walking) { h.walkTo(at, this.throwYaw); this.houseWait = 1.2; return; }
    if (h.walking) return;
    if (!this.plan) this.plan = g.housePlan(this.seed, HOUSE_C);
    this.houseWait -= dS;
    if (this.houseWait > 0) return;
    const p = this.plan; this.plan = null; this.slide(p.speed, p.line, p.y0, 1); this.houseWait = 1.0;
    this.g.houseAt = null;
  }
  // ---- your controls: a swipe up the screen slides the puck; its speed sets the puck's, its sideways drift the line
  down(sx: number, sy: number) { if (!this.yourTurn()) return false; this.swipe.on = true; this.swipe.hist = [{ t: performance.now() / 1000, x: sx, y: sy }]; this.swipe.x0 = sx; return true; }
  move(sx: number, sy: number) { if (!this.swipe.on) return; this.swipe.hist.push({ t: performance.now() / 1000, x: sx, y: sy }); if (this.swipe.hist.length > 16) this.swipe.hist.shift(); }
  up(sx: number, sy: number) {
    if (!this.swipe.on) return; this.swipe.on = false;
    const now = performance.now() / 1000, c = this.g.ctx.canvas, h = c.clientHeight, w = c.clientWidth;
    const old = this.swipe.hist.find((p) => now - p.t <= 0.18) ?? this.swipe.hist[0], dtt = Math.max(0.016, now - old.t);
    const vy = -(sy - old.y) / dtt / h, vx = (sx - old.x) / dtt / h;
    if (vy < 0.35 || !this.yourTurn()) return;
    const speed = clamp(1.2 * vy, 0.4, 4.6), line = clamp((Math.atan2(vx, vy) * 180) / Math.PI * 0.3, -3, 3) * this.side;
    const y0 = clamp((this.swipe.x0 / w - 0.5) * 0.45, -0.2, 0.2) * this.side;
    this.slide(speed, line, y0, 0);
  }
  /** a scripted slide: { speed (m/s), line (degrees), y0 (m) } or { zone: 1 | 2 | 3 } (the speed for that zone's middle),
   *  settle runs it to rest at once */
  shoot(p: Record<string, unknown>) {
    const g = this.game; if (!g) return { ok: false, why: 'no game' };
    if (!this.yourTurn()) return { ok: false, why: `not your slide (${g.state}, turn ${g.turn}, hold ${this.hold.toFixed(2)})` };
    const mid = { 1: 5.6, 2: 6.0, 3: 6.43 } as Record<number, number>;
    if (p.zone !== undefined && !(p.zone === 1 || p.zone === 2 || p.zone === 3)) return { ok: false, why: `zone must be 1, 2 or 3 (got ${String(p.zone)})` };
    for (const k of ['speed', 'line', 'y0']) if (p[k] !== undefined && !(typeof p[k] === 'number' && Number.isFinite(p[k] as number) && (k !== 'speed' || (p[k] as number) > 0))) return { ok: false, why: `${k} must be a finite number${k === 'speed' ? ' above 0 m/s' : ''} (got ${String(p[k])})` };
    const speed = typeof p.zone === 'number' ? speedFor(mid[p.zone as number]) : Number(p.speed ?? 3), line = Number(p.line ?? 0), y0 = Number(p.y0 ?? 0);
    if (!this.slide(speed, line, y0, 0)) return { ok: false, why: 'the slide was refused' };
    let t = 0;
    if (p.settle) { const f0 = g.frame; t = g.settle(); this.after(f0); }
    const pk = g.pucks[g.pucks.length - 1];
    return { ok: true, speed: +speed.toFixed(3), line: +line.toFixed(3), settledIn: +t.toFixed(2), puck: pk ? { x: +pk.x.toFixed(4), y: +pk.y.toFixed(4), on: pk.on, out: pk.out, travelled: +(pk.x - SHUFFLE.X0).toFixed(4) } : null };
  }
  /** one puck on the bed (bed metres), as an instance of the disc mesh */
  private put(I: HeldItems, x: number, y: number, hex: number) {
    const w = this.toW(x, y);
    _m.compose(_p.set(w[0], this.Y, w[1]), _q.identity(), _s.set(SHUFFLE.R, 0.02, SHUFFLE.R)); I.put('disc', _m, hex);
  }
  draw(I: HeldItems) {
    const g = this.game;
    if (!g) {
      // between games the eight pucks wait at the near end, four of each colour
      for (let k = 0; k < 8; k++) this.put(I, k < 4 ? 0.035 : 0.095, -0.18 + (k % 4) * 0.12, k < 4 ? YOU_PUCK : HOUSE_PUCK);
      return;
    }
    for (const p of g.pucks) if (p.on) this.put(I, p.x, p.y, p.side === 0 ? YOU_PUCK : HOUSE_PUCK);
    // the next puck, at the release point while it's waiting to be slid
    if (g.winner === null && g.state === 'aim' && this.hold <= 0) this.put(I, SHUFFLE.X0, 0, g.turn === 0 ? YOU_PUCK : HOUSE_PUCK);
  }
  /** your puck the camera follows (null: none), kept through the pause after your slide (even when the frame's pucks
   *  are cleared for the next frame) */
  private follow: { x: number } | null = null;
  /** while you aim: over the release point, down the board. While your puck slides, and in the pause after it, the
   *  camera follows it down the board, 1.7 m behind it and over its line, so where it stops reads against the zones,
   *  their lines and numbers (from the throwing end they're 6 m off and nearly edge-on) */
  camPose(_aspect: number, out: CamPose) {
    const g = this.game;
    out.up.set(0, 1, 0); out.fov = 44;
    const px = this.follow && ((this.hold > 0 && this.holdFor === 0) || g?.state === 'sliding') ? this.follow.x : -1;
    if (px < 0) { out.eye.copy(this.camEye); out.target.copy(this.camTarget); return out; }
    // from the aim's eye (bed x -0.25, to your right, 1.72 m up) to over the line, a little lower, as the puck goes on
    const ex = Math.max(-0.25, Math.min(SHUFFLE.L - 2.0, px - 1.7)), k = Math.min(1, (ex + 0.25) / 1.5);
    const e = this.toW(ex, 0.34 * this.side * (1 - k)); out.eye.set(e[0], 1.72 - 0.2 * k, e[1]);
    const t = this.toW(Math.max(4.7, Math.min(SHUFFLE.L + 0.2, px + 1.4)), 0); out.target.set(t[0], 0.82, t[1]);
    return out;
  }
  scoreLine() {
    const g = this.game!, mineLeft = 4 - g.bySide[0], theirsLeft = 4 - g.bySide[1];
    const turn = g.winner !== null ? (g.winner === 0 ? 'You win' : `${HOUSE_NAME} wins`) : g.state === 'sliding' ? 'Sliding…' : g.turn === 0 ? `Your slide · ${mineLeft} left` : `${HOUSE_NAME}'s slide · ${theirsLeft} left`;
    return { title: `SHUFFLEBOARD · FRAME ${g.frame} · FIRST TO 15`, score: `You ${g.score[0]} · ${HOUSE_NAME} ${g.score[1]} · ${turn}`, hint: this.yourTurn() ? 'Swipe up to slide (faster goes farther) · zone 3 is the far end' : '' };
  }
  state() {
    const g = this.game;
    return { id: this.id, kind: this.kind, playing: this.playing, mine: this.mine, outcome: this.outcome, side: this.side, ...(g ? { score: [...g.score], frame: g.frame, turn: g.turn, thrown: g.thrown, state: g.state, winner: g.winner, pucks: g.pucks.map((p) => ({ side: p.side, on: p.on, out: p.out, x: +p.x.toFixed(4), y: +p.y.toFixed(4), zone: p.on ? zoneOf(p.x) : null })), lastFrame: g.lastFrame, log: g.log.slice(-6), yourTurn: this.yourTurn(), hold: +this.hold.toFixed(2), best3: [...g.best3] } : {}) };
  }
  abandon() { super.abandon(); this.plan = null; if (this.game && this.game.winner === null) this.game.winner = -1 as never; }
}

// ================================================================================================== the games
export class Games {
  spots: Spot[] = [];
  cams = new GameCams();
  /** the spot the house player is playing a turn at (one at a time) */
  houseAt: Spot | null = null;
  private disabledInput = false; private pose: CamPose = { eye: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 60 };
  /** the game's bar: it's rebuilt only when the game you're in changes (its version), never every frame; `gbt` is the
   *  height from the screen's bottom to the bar's top, where a game's messages (the toasts) sit, clear of the crowd chip */
  private bar = { el: $('gamebar'), title: $('gameTitle'), score: $('gameScore'), hint: $('gameHint'), power: $('gamePower'), reticle: $('reticle'), hud: $('hud'), spot: null as Spot | null, ver: -1, w: 0, h: 0, pw: -2, rx: -1, ry: -1, on: false };
  /** how many times the bar's text was rebuilt (the check reads it: it moves with the game, not with the frames) */
  barBuilds = 0;
  private ptr: number | null = null;
  constructor(public ctx: GamesCtx) {
    POOL_TABLES.forEach(([u, v], i) => this.spots.push(new PoolSpot(`pool-${i + 1}`, this, u, v, i + 1)));
    DART_BOARDS.forEach((u, i) => this.spots.push(new DartsSpot(`darts-${i + 1}`, this, u, i + 1)));
    this.spots.push(new ShuffleSpot('shuffleboard', this));
    for (const s of this.spots) s.startW = ctx.F.fromFrame(s.start[0], s.start[1]);
    const c = ctx.canvas;
    // your controls on your turn (Lot 57's stick and look are off then): the first pointer only
    c.addEventListener('pointerdown', (e) => { const m = this.mine; if (!m || this.ptr !== null || !m.yourTurn() || ctx.blocked()) return; const r = c.getBoundingClientRect(); if (m.down(e.clientX - r.left, e.clientY - r.top)) { this.ptr = e.pointerId; e.preventDefault(); } });
    addEventListener('pointermove', (e) => { if (e.pointerId !== this.ptr) return; const r = c.getBoundingClientRect(); this.mine?.move(e.clientX - r.left, e.clientY - r.top); });
    const up = (e: PointerEvent) => { if (e.pointerId !== this.ptr) return; this.ptr = null; const r = c.getBoundingClientRect(); this.mine?.up(e.clientX - r.left, e.clientY - r.top); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  spot(id: string) { return this.spots.find((s) => s.id === id) ?? null; }
  /** the game you're in */
  get mine(): Spot | null { for (const s of this.spots) if (s.mine) return s; return null; }
  kindOf(id: string): GameKind | null { return this.spot(id)?.kind ?? null; }
  /** where you stand to begin a game (frame), and the way you face */
  startOf(id: string) { const s = this.spot(id); return s ? { at: s.start, face: s.startFace } : null; }
  /** start a game against the house (any game you were in is left) */
  begin(id: string) {
    const s = this.spot(id); if (!s) return false;
    this.staged = false;
    const m = this.mine; if (m && m !== s) this.leave('another game');
    if (this.houseAt) { this.houseAt.houseBusy = false; this.houseAt = null; }
    s.begin();
    return true;
  }
  leave(why = 'left') {
    const m = this.mine; if (!m) return false;
    m.abandon(); if (this.houseAt === m) this.houseAt = null;
    this.ctx.house().home();
    const p = this.ctx.person(); if (p) this.ctx.clips.stop(p);
    this.ctx.tell(why === 'walked away' ? `You left the game. ${HOUSE_NAME} racks up for the next one.` : `You left the game (${why}).`, 3);
    return true;
  }
  /** the physics and the house's turns, in sim seconds */
  update(dS: number) {
    for (const s of this.spots) s.step(dS);
    if (this.houseAt && !this.houseAt.houseUp()) this.houseAt = null;
    // walking away from your game (8 m from where it's played) leaves it
    const m = this.mine;
    if (m && !this.staged) { const p = this.ctx.player; if (Math.hypot(p.x - m.startW[0], p.z - m.startW[1]) > 8) this.leave('walked away'); }
  }
  /** once a frame (real time): your controls, the camera's wish, the bar, the reticle */
  frame(dt: number) {
    const m = this.mine, c = this.ctx;
    this.cams.reduced = c.reduced();
    for (const s of this.spots) s.frame(dt);
    const mine = !!m && !this.staged && m.camWanted();
    if (mine) {
      this.cams.enter(m!.kind, m!.camPose(c.camera.aspect, this.pose));
      if (m instanceof PoolSpot) this.cams.retarget(m.camPose(c.camera.aspect, this.pose));
      if (c.input.enabled) { c.input.enabled = false; this.disabledInput = true; }
    } else {
      this.cams.exit();
      if (this.disabledInput) { this.disabledInput = false; c.input.enabled = !c.overhead() && !c.blocked(); }
      this.ptr = null;
    }
    // the game's bar: its text only when the game changed; while it shows, the HUD's toasts sit just above it (#hud
    // gets 'gaming' and --gbt), so a game's messages never cover the crowd chip at the top
    const b = this.bar;
    if (b.el) {
      if (m && (m as unknown as { game: unknown }).game) {
        if (m !== b.spot || m.ver !== b.ver) {
          b.spot = m; b.ver = m.ver; this.barBuilds++;
          const l = m.scoreLine();
          b.title!.textContent = l.title; b.score!.textContent = l.score; b.hint!.textContent = l.hint; b.hint!.hidden = !l.hint;
          b.w = 0;
        }
        if (!b.on) { b.on = true; b.el.classList.add('on'); b.hud?.classList.add('gaming'); b.w = 0; }
        if (b.w !== innerWidth || b.h !== innerHeight) {
          // measured once per change of the bar or the window, not per frame
          b.w = innerWidth; b.h = innerHeight;
          const r = b.el.getBoundingClientRect();
          b.hud?.style.setProperty('--gbt', `${Math.round(innerHeight - r.top + 6)}px`);
        }
      } else if (b.on) { b.on = false; b.spot = null; b.ver = -1; b.el.classList.remove('on'); b.hud?.classList.remove('gaming'); }
      const pw = m instanceof PoolSpot && m.aim.dragging ? Math.round(m.aim.power * 1000) / 1000 : -1;
      if (b.power && pw !== b.pw) { b.pw = pw; b.power.classList.toggle('on', pw >= 0); if (pw >= 0) b.power.style.setProperty('--p', String(pw)); }
      const ret = m instanceof DartsSpot && this.cams.blend >= 1 ? m.reticle(c.camera, c.canvas.clientWidth, c.canvas.clientHeight) : null;
      const rx = ret ? Math.round(ret[0]) : -1, ry = ret ? Math.round(ret[1]) : -1;
      if (b.reticle && (rx !== b.rx || ry !== b.ry)) {
        if ((rx < 0) !== (b.rx < 0)) b.reticle.classList.toggle('on', rx >= 0);
        b.rx = rx; b.ry = ry;
        if (rx >= 0) { b.reticle.style.left = rx + 'px'; b.reticle.style.top = ry + 'px'; }
      }
    }
  }
  /** the page's camera hook: after your own view is placed, the game view's blend; true while it shows */
  camera(cam: THREE.PerspectiveCamera, dt: number) { return this.cams.apply(cam, dt); }
  get camOn() { return this.cams.on; }
  /** the check's switch: no game pieces drawn at all (the base the pieces are measured against) */
  piecesOff = false;
  draw(I: HeldItems) { if (this.piecesOff) return; for (const s of this.spots) s.draw(I); }
  /** the check's setup: a game of each kind under way at once (pool-1 broken and aiming, darts-1 with two darts in the
   *  board, the shuffleboard with three pucks down), every piece drawn; a test hook only (in play you're in one game) */
  /** the check's setup is on: no game view and no walking-away rule, so the budget poses keep their own cameras */
  staged = false;
  stageAll() {
    const pool = this.spot('pool-1') as PoolSpot, darts = this.spot('darts-1') as DartsSpot, sh = this.spot('shuffleboard') as ShuffleSpot;
    pool.begin(); pool.shoot({ break: true, settle: true });
    darts.begin(); darts.shoot({ seg: 20, mult: 1, settle: true }); darts.shoot({ seg: 5, mult: 1, settle: true });
    sh.begin(); sh.shoot({ zone: 3, settle: true }); sh.game!.slide(2.8, 0.5, 0.1); sh.game!.settle(); sh.game!.slide(2.6, -0.5, -0.1); sh.game!.settle();
    for (const s of [pool, darts, sh]) { s.hold = 0; }
    this.staged = true; this.cams.exit();
    return this.spots.map((s) => s.state());
  }
  /** the hooks: a table's or a board's state; a scripted shot; the camera */
  state(id: string) { return this.spot(id)?.state() ?? null; }
  shoot(id: string, p: Record<string, unknown>) { const s = this.spot(id); return s ? s.shoot(p) : { ok: false, why: 'no such game: ' + id }; }
  /** the screenshots' aims: pool (angle in degrees or null for your best pot, power), darts (x, y, holding) */
  setAim(id: string, a: number | null, b: number, c?: boolean) {
    const s = this.spot(id);
    if (s instanceof PoolSpot) return s.setAim(a, b);
    if (s instanceof DartsSpot) return s.setAim(a ?? 0, b, !!c);
    return null;
  }
  /** the focus of a game on screen (pixels), for driving its controls with a pointer */
  screen(id: string, at?: [number, number]) {
    const s = this.spot(id); if (!s) return null; const c = this.ctx; c.camera.updateMatrixWorld();
    const v = s.focus(new THREE.Vector3());
    // a point on the table or the bed instead (pool: table metres; shuffleboard: bed metres), for the checks
    if (at && (s instanceof PoolSpot || s instanceof ShuffleSpot)) { const w = s.toW(at[0], at[1], [0, 0]); v.set(w[0], v.y, w[1]); }
    v.project(c.camera);
    return { x: (v.x * 0.5 + 0.5) * c.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * c.canvas.clientHeight, behind: v.z > 1 };
  }
  list() { return this.spots.map((s) => ({ id: s.id, kind: s.kind, label: s.label, playing: s.playing, mine: s.mine })); }
}
export type { Spot };
void POCKETS;
