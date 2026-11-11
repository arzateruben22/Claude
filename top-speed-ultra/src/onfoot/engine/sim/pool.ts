// Pool (PROJECT_OC_SPORTS_BAR.md, "The games: pool, darts, shuffleboard"): 2D table physics, simplified 8-ball and the
// house opponent's shot selection, written engine-first (no three.js), so the player's game, an NPC's game and the
// unit test (tests/sportsbar-games.mjs) all run the same code.
//   Physics: balls r 0.028 m on a 1.98 m x 0.99 m bed, ball-ball restitution 0.95, cushions 0.75, rolling deceleration
//   0.25 m/s^2, six pockets r 0.055, fixed 240 Hz substeps, no spin.
//   Rules: solids (1-7) or stripes (9-15), the 8 last; a scratch gives ball in hand anywhere; no called shots.
//   The house opponent: for each own ball b and pocket k, the ghost ball G = b - 2r u (u from b to k); both paths clear
//   (no other centre within 2r of cue-G or of b-k; side pockets need u within 50 degrees of the cushion's normal); the
//   cut angle under 70 degrees; score cos(theta) - 0.25 (d1 + d2) / 2.2; speed v0 = 1.15 sqrt(vc^2 + 2 a d1) with
//   vc = vb / (0.975 cos theta) and vb = sqrt(2 a (d2 + 0.1)); no shot: a safety, full ball on its nearest own ball at
//   1.2 m/s. Then the aim error, sigma = 6 - 4.5 competitive degrees, and the power x N(1, 0.08).
// Table coordinates: metres from the bed's centre, x across (the 0.99 m width), y along (the 1.98 m length); the head
// spot is at y = -L/4 and the foot spot (the rack's apex) at y = +L/4.
import { mulberry, hash32, gauss } from './rng';

export const POOL = { R: 0.028, W: 0.99, L: 1.98, E_BALL: 0.95, E_CUSH: 0.75, DECEL: 0.25, POCKET_R: 0.055, HZ: 240, MAX_V: 5.5 };
const { R, W, L } = POOL;
const XM = W / 2 - R, YM = L / 2 - R;
/** the six pockets: four corners, then the two sides; each with the cushion's outward normal (for the 50 degree rule) */
export const POCKETS: { x: number; y: number; nx: number; ny: number; side: boolean }[] = [
  { x: -W / 2, y: -L / 2, nx: -Math.SQRT1_2, ny: -Math.SQRT1_2, side: false }, { x: W / 2, y: -L / 2, nx: Math.SQRT1_2, ny: -Math.SQRT1_2, side: false },
  { x: -W / 2, y: L / 2, nx: -Math.SQRT1_2, ny: Math.SQRT1_2, side: false }, { x: W / 2, y: L / 2, nx: Math.SQRT1_2, ny: Math.SQRT1_2, side: false },
  { x: -W / 2, y: 0, nx: -1, ny: 0, side: true }, { x: W / 2, y: 0, nx: 1, ny: 0, side: true },
];
export const HEAD: [number, number] = [0, -L / 4];
export const FOOT: [number, number] = [0, L / 4];

export interface Ball { id: number; x: number; y: number; vx: number; vy: number; on: boolean }
export type Group = 'solids' | 'stripes';
export const groupOf = (id: number): Group | 'eight' | 'cue' => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solids' : 'stripes');

/** fifteen balls racked at the foot spot (the 8 in the middle of the third row, a solid and a stripe in the back
 *  corners, the rest seeded) and the cue ball on the head spot */
export function rack(seed: number): Ball[] {
  const r = mulberry(hash32('rack', seed));
  const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  // a solid and a stripe for the back corners
  const si = rest.findIndex((b) => b < 8), solid = rest.splice(si, 1)[0], ti = rest.findIndex((b) => b > 8), stripe = rest.splice(ti, 1)[0];
  const order: number[] = [];
  let k = 0;
  const dy = 2 * R * Math.cos(Math.PI / 6) + 0.0004, dx = 2 * R + 0.0004;
  const out: Ball[] = [{ id: 0, x: HEAD[0], y: HEAD[1], vx: 0, vy: 0, on: true }];
  for (let row = 0; row < 5; row++) for (let c = 0; c <= row; c++) {
    let id: number;
    if (row === 2 && c === 1) id = 8;
    else if (row === 4 && c === 0) id = solid;
    else if (row === 4 && c === 4) id = stripe;
    else id = rest[k++];
    order.push(id);
    out.push({ id, x: (c - row / 2) * dx, y: FOOT[1] + row * dy, vx: 0, vy: 0, on: true });
  }
  return out;
}

/** kinetic energy per unit mass (every ball has the same mass) */
export const energy = (balls: Ball[]) => { let e = 0; for (const b of balls) if (b.on) e += 0.5 * (b.vx * b.vx + b.vy * b.vy); return e; };
export const moving = (balls: Ball[]) => { for (const b of balls) if (b.on && (b.vx !== 0 || b.vy !== 0)) return true; return false; };

export interface StepEvents { potted: number[]; firstHit: number | null; cushions: number; clicks: number }
/** one 240 Hz substep: rolling deceleration, motion, the pockets, the cushions, then ball-ball collisions (impulses
 *  along the line of centres only while approaching, so no collision adds energy; overlaps are pushed apart along the
 *  same line, which moves no velocity) */
export function substep(balls: Ball[], ev: StepEvents) {
  const dt = 1 / POOL.HZ, dv = POOL.DECEL * dt, P2 = POOL.POCKET_R * POOL.POCKET_R;
  for (const b of balls) {
    if (!b.on) continue;
    const s = Math.hypot(b.vx, b.vy);
    if (s <= dv) { b.vx = 0; b.vy = 0; continue; }
    const k = (s - dv) / s; b.vx *= k; b.vy *= k;
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const p of POCKETS) { const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < P2) { b.on = false; b.vx = 0; b.vy = 0; ev.potted.push(b.id); break; } }
    if (!b.on) continue;
    if (b.x > XM) { b.x = XM; if (b.vx > 0) { b.vx *= -POOL.E_CUSH; ev.cushions++; } } else if (b.x < -XM) { b.x = -XM; if (b.vx < 0) { b.vx *= -POOL.E_CUSH; ev.cushions++; } }
    if (b.y > YM) { b.y = YM; if (b.vy > 0) { b.vy *= -POOL.E_CUSH; ev.cushions++; } } else if (b.y < -YM) { b.y = -YM; if (b.vy < 0) { b.vy *= -POOL.E_CUSH; ev.cushions++; } }
  }
  const D = 2 * R, D2 = D * D, J = (1 + POOL.E_BALL) / 2;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (!a.on) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]; if (!b.on) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= D2 || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const un = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (un > 0) {
        const imp = J * un;
        a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
        ev.clicks++;
        if (ev.firstHit === null && (a.id === 0 || b.id === 0)) ev.firstHit = a.id === 0 ? b.id : a.id;
      }
      const push = (D - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
  // the push can nudge a ball past a cushion's line: back inside (no velocity changes)
  for (const b of balls) { if (!b.on) continue; if (b.x > XM) b.x = XM; else if (b.x < -XM) b.x = -XM; if (b.y > YM) b.y = YM; else if (b.y < -YM) b.y = -YM; }
}

/** a free spot for a ball near (x, y): no overlap with any ball on the table, clear of the pockets' mouths */
export function freeSpot(balls: Ball[], x: number, y: number, skip = -1): [number, number] {
  const ok = (px: number, py: number) => {
    if (Math.abs(px) > XM || Math.abs(py) > YM) return false;
    for (const p of POCKETS) if (Math.hypot(px - p.x, py - p.y) < POOL.POCKET_R + R) return false;
    for (const b of balls) if (b.on && b.id !== skip && Math.hypot(b.x - px, b.y - py) < 2 * R + 0.002) return false;
    return true;
  };
  if (ok(x, y)) return [x, y];
  for (let r = 0.01; r < 1.2; r += 0.01) for (let a = 0; a < 24; a++) { const px = x + Math.cos((a / 24) * Math.PI * 2) * r, py = y + Math.sin((a / 24) * Math.PI * 2) * r; if (ok(px, py)) return [px, py]; }
  return [x, y];
}

// ---------------------------------------------------------------------------------------------- the house opponent
export interface ShotPlan {
  kind: 'pot' | 'safety';
  /** the cue's direction (radians, atan2(dy, dx) in table coordinates) and speed (m/s), before the aim error */
  angle: number; speed: number;
  ball: number; pocket: number; theta: number; score: number; ghost: [number, number]; d1: number; d2: number;
}
/** a point's distance from a segment */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** the clear-path test: no ball's centre (other than the one or two skipped ids) strictly within 2r of the segment; the
 *  ids are plain numbers (-1 for none), so the house's ball-in-hand search makes no array per test */
export function clearPath(balls: Ball[], ax: number, ay: number, bx: number, by: number, skipA: number, skipB = -1) {
  for (const o of balls) { if (!o.on || o.id === skipA || o.id === skipB) continue; if (segDist(o.x, o.y, ax, ay, bx, by) < 2 * R) return false; }
  return true;
}
/** every candidate pot for a shooter's target balls, with the plan's tests and score; the passing ones only */
export function candidates(balls: Ball[], targets: number[]): ShotPlan[] {
  const cue = balls.find((b) => b.id === 0 && b.on); if (!cue) return [];
  const out: ShotPlan[] = [], a = POOL.DECEL;
  for (const id of targets) {
    const b = balls.find((x) => x.id === id && x.on); if (!b) continue;
    POCKETS.forEach((k, ki) => {
      const d2 = Math.hypot(k.x - b.x, k.y - b.y); if (d2 < 1e-6) return;
      const ux = (k.x - b.x) / d2, uy = (k.y - b.y) / d2;
      // side pockets: u within 50 degrees of the cushion's normal
      if (k.side && ux * k.nx + uy * k.ny < Math.cos((50 * Math.PI) / 180)) return;
      const gx = b.x - 2 * R * ux, gy = b.y - 2 * R * uy;
      // the ghost ball must be on the bed
      if (Math.abs(gx) > XM + 1e-9 || Math.abs(gy) > YM + 1e-9) return;
      if (!clearPath(balls, cue.x, cue.y, gx, gy, 0, b.id)) return;
      if (!clearPath(balls, b.x, b.y, k.x, k.y, b.id)) return;
      const d1 = Math.hypot(gx - cue.x, gy - cue.y); if (d1 < 1e-6) return;
      const cx = (gx - cue.x) / d1, cy = (gy - cue.y) / d1, cosT = Math.max(-1, Math.min(1, cx * ux + cy * uy)), theta = Math.acos(cosT);
      if (theta > (70 * Math.PI) / 180) return;
      const vb = Math.sqrt(2 * a * (d2 + 0.1)), vc = vb / (0.975 * Math.cos(theta)), v0 = 1.15 * Math.sqrt(vc * vc + 2 * a * d1);
      out.push({ kind: 'pot', angle: Math.atan2(cy, cx), speed: Math.min(POOL.MAX_V, v0), ball: b.id, pocket: ki, theta, score: Math.cos(theta) - (0.25 * (d1 + d2)) / 2.2, ghost: [gx, gy], d1, d2 });
    });
  }
  return out.sort((p, q) => q.score - p.score);
}
/** the house opponent's choice: the best pot, or a safety (full ball on its nearest own ball at 1.2 m/s) */
export function choose(balls: Ball[], targets: number[]): ShotPlan | null {
  const c = candidates(balls, targets);
  if (c.length) return c[0];
  const cue = balls.find((b) => b.id === 0 && b.on); if (!cue) return null;
  let best: Ball | null = null, bd = Infinity;
  for (const id of targets) { const b = balls.find((x) => x.id === id && x.on); if (!b) continue; const d = Math.hypot(b.x - cue.x, b.y - cue.y); if (d < bd) { bd = d; best = b; } }
  if (!best) { for (const b of balls) if (b.on && b.id !== 0) { const d = Math.hypot(b.x - cue.x, b.y - cue.y); if (d < bd) { bd = d; best = b; } } }
  if (!best) return null;
  return { kind: 'safety', angle: Math.atan2(best.y - cue.y, best.x - cue.x), speed: 1.2, ball: best.id, pocket: -1, theta: 0, score: -Infinity, ghost: [best.x, best.y], d1: bd, d2: 0 };
}
/** the aim error: sigma = 6 - 4.5 competitive degrees on the angle, and the power x N(1, 0.08) */
export function withError(p: ShotPlan, competitive: number, r: () => number) {
  const sigma = ((6 - 4.5 * competitive) * Math.PI) / 180;
  return { angle: p.angle + gauss(r) * sigma, speed: Math.min(POOL.MAX_V, Math.max(0.2, p.speed * (1 + 0.08 * gauss(r)))) };
}

// ---------------------------------------------------------------------------------------------- the game
export interface PoolSide { who: string; group: Group | null; competitive: number }
export type PoolState = 'aim' | 'rolling' | 'over';
export interface ShotResult { side: number; potted: number[]; scratch: boolean; continues: boolean; won: number | null; note: string; firstHit: number | null; t: number }

/** simplified 8-ball between two sides (the player and the house, or two NPCs) */
export class PoolGame {
  balls: Ball[];
  sides: [PoolSide, PoolSide];
  turn = 0; state: PoolState = 'aim';
  open = true; breakShot = true; ballInHand = false;
  winner: number | null = null; overNote = '';
  shots = 0; t = 0; private acc = 0; private shotT = 0;
  /** balls of the shooter's own group potted in the current turn (the "two in one turn" goal) */
  turnPots = 0; bestTurnPots = [0, 0];
  last: ShotResult | null = null;
  private ev: StepEvents = { potted: [], firstHit: null, cushions: 0, clicks: 0 };
  /** S4: the earlier shots' clicks, cushions and pots (the sounds read the totals; the physics doesn't) */
  private done = { clicks: 0, cushions: 0, potted: 0 };
  get clicksN() { return this.done.clicks + this.ev.clicks; }
  get cushionsN() { return this.done.cushions + this.ev.cushions; }
  get pottedN() { return this.done.potted + this.ev.potted.length; }
  private groupClearedAtStart = false;
  /** the most energy seen in each shot's substeps after the cue's strike (the energy check reads it) */
  maxEnergyRise = 0;
  log: string[] = [];
  constructor(sides: [PoolSide, PoolSide], seed: number, first = 0) { this.sides = sides; this.balls = rack(seed); this.turn = first; }
  /** the balls the shooter may pot: their group, the 8 once it's cleared; anything but the 8 while the table is open */
  targets(side = this.turn): number[] {
    const g = this.sides[side].group, on = (id: number) => this.balls.some((b) => b.id === id && b.on);
    if (!g) return this.balls.filter((b) => b.on && b.id !== 0 && b.id !== 8).map((b) => b.id);
    const own = this.balls.filter((b) => b.on && groupOf(b.id) === g).map((b) => b.id);
    return own.length ? own : on(8) ? [8] : [];
  }
  left(side: number) { const g = this.sides[side].group; return g ? this.balls.filter((b) => b.on && groupOf(b.id) === g).length : 7; }
  /** each side's balls left, kept as a field (set when a shot comes to rest), so a HUD reads it without counting */
  leftN: [number, number] = [7, 7];
  cue() { return this.balls[0]; }
  /** ball in hand: put the cue ball at a spot on the bed (the nearest free one); `keep` leaves the ball in hand, so the
   *  player can move it again before the shot (the shot itself ends it) */
  place(x: number, y: number, keep = false) {
    const c = this.cue(), px = Math.max(-XM, Math.min(XM, x)), py = Math.max(-YM, Math.min(YM, y));
    [c.x, c.y] = freeSpot(this.balls, px, py, 0); c.on = true; c.vx = c.vy = 0; this.ballInHand = keep && this.ballInHand;
  }
  /** strike the cue ball: a direction (radians, table coordinates) and a speed (m/s) */
  shoot(angle: number, speed: number) {
    if (this.state !== 'aim' || this.winner !== null) return false;
    // a direction or a speed that isn't a number is refused (a NaN would leave the table rolling to the settle limit)
    if (!Number.isFinite(angle) || !Number.isFinite(speed) || speed <= 0) return false;
    if (this.ballInHand) this.place(this.cue().x, this.cue().y);
    const s = Math.max(0.05, Math.min(POOL.MAX_V, speed)), c = this.cue();
    c.vx = Math.cos(angle) * s; c.vy = Math.sin(angle) * s;
    this.done.clicks += this.ev.clicks; this.done.cushions += this.ev.cushions; this.done.potted += this.ev.potted.length;
    this.ev = { potted: [], firstHit: null, cushions: 0, clicks: 0 };
    const g = this.sides[this.turn].group;
    this.groupClearedAtStart = !!g && this.left(this.turn) === 0;
    this.state = 'rolling'; this.shots++; this.shotT = 0; this.acc = 0;
    return true;
  }
  /** advance the physics by dt seconds (fixed substeps); true when a shot settled in this call */
  step(dt: number): boolean {
    if (this.state !== 'rolling') return false;
    this.acc += dt; this.t += dt;
    const h = 1 / POOL.HZ;
    let e0 = energy(this.balls);
    while (this.acc >= h) {
      this.acc -= h; this.shotT += h;
      substep(this.balls, this.ev);
      const e1 = energy(this.balls); if (e1 - e0 > this.maxEnergyRise) this.maxEnergyRise = e1 - e0; e0 = e1;
      if (!moving(this.balls)) { this.acc = 0; this.resolve(); return true; }
    }
    return false;
  }
  /** run the shot to rest (the scripted shots and the unit test); returns the seconds it took */
  settle(maxS = 60) { const t0 = this.shotT; while (this.state === 'rolling' && this.shotT - t0 < maxS) this.step(1 / POOL.HZ); return this.shotT - t0; }
  /** the rules, once the balls are at rest */
  private resolve() {
    const s = this.turn, o = 1 - s, ev = this.ev, potted = ev.potted.slice();
    const scratch = potted.includes(0), eight = potted.includes(8), objects = potted.filter((id) => id !== 0 && id !== 8);
    let cont = false, note = '';
    if (eight && this.breakShot) {
      // the 8 on the break is spotted back
      const b = this.balls.find((x) => x.id === 8)!; [b.x, b.y] = freeSpot(this.balls, FOOT[0], FOOT[1], 8); b.on = true; note = 'the 8 went down on the break: spotted';
    } else if (eight) {
      const cleared = this.groupClearedAtStart;
      if (cleared && !scratch) { this.winner = s; note = `${this.sides[s].who} sank the 8`; }
      else { this.winner = o; note = scratch ? `${this.sides[s].who} scratched on the 8` : `${this.sides[s].who} sank the 8 early`; }
    }
    if (this.winner === null) {
      if (this.open && objects.length && !this.breakShot) {
        // the table is open: the first ball potted decides the groups
        const g = groupOf(objects[0]) as Group;
        this.sides[s].group = g; this.sides[o].group = g === 'solids' ? 'stripes' : 'solids'; this.open = false;
        note = `${this.sides[s].who} takes the ${g}`;
      }
      const g = this.sides[s].group;
      const own = g ? objects.filter((id) => groupOf(id) === g).length : objects.length;
      if (scratch) {
        const c = this.cue(); c.on = true; [c.x, c.y] = freeSpot(this.balls, HEAD[0], HEAD[1], 0); this.ballInHand = true;
        note = (note ? note + '; ' : '') + `${this.sides[s].who} scratched: ball in hand`;
      } else cont = own > 0;
      if (cont) this.turnPots += own;
      if (this.turnPots > this.bestTurnPots[s]) this.bestTurnPots[s] = this.turnPots;
    }
    this.breakShot = false;
    this.leftN[0] = this.left(0); this.leftN[1] = this.left(1);
    this.last = { side: s, potted, scratch, continues: cont && this.winner === null, won: this.winner, note, firstHit: ev.firstHit, t: +this.shotT.toFixed(2) };
    this.log.push(`${this.sides[s].who}: ${potted.length ? 'potted ' + potted.join(', ') : 'nothing down'}${note ? ' (' + note + ')' : ''}`);
    if (this.winner !== null) { this.state = 'over'; this.overNote = note; return; }
    if (!cont) { this.turn = o; this.turnPots = 0; }
    this.state = 'aim';
  }
  /** the house's shot (or any side's, by the plan's selection), with its aim error, from a seeded draw */
  plan(seed: number, competitive = this.sides[this.turn].competitive) {
    const r = mulberry(hash32('pool-shot', seed, this.shots));
    if (this.ballInHand) this.bestPlacement();
    const p = choose(this.balls, this.targets());
    if (!p) return null;
    return { plan: p, ...withError(p, competitive, r) };
  }
  /** ball in hand: the spot (on a grid over the bed) whose best shot scores most */
  bestPlacement() {
    const c = this.cue(), targets = this.targets();
    let bx = HEAD[0], by = HEAD[1], found = false, bs = -Infinity;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 13; j++) {
      const x = -XM + 0.05 + ((2 * XM - 0.1) * i) / 6, y = -YM + 0.05 + ((2 * YM - 0.1) * j) / 12;
      let blocked = false;
      for (const b of this.balls) if (b.on && b.id !== 0 && Math.hypot(b.x - x, b.y - y) < 2 * R + 0.01) { blocked = true; break; }
      if (blocked) continue;
      c.x = x; c.y = y; c.on = true;
      const cand = candidates(this.balls, targets);
      if (cand.length && cand[0].score > bs) { bs = cand[0].score; bx = x; by = y; found = true; }
    }
    if (!found) [bx, by] = freeSpot(this.balls, HEAD[0], HEAD[1], 0);
    this.place(bx, by);
  }
  /** a close game for the loser: at most 2 of their own balls left (or on the 8) */
  closeFor(side: number) { const g = this.sides[side].group; return !!g && this.left(side) <= 2; }
}

// ---------------------------------------------------------------------------------------------- games nobody watches
/** an unwatched turn, resolved statistically ("Games nobody is watching"): 15 to 30 s; k balls potted, k geometric
 *  with p = 0.25 + 0.35 competitive (the number of successes before the first miss); a shot on the 8 scratches with
 *  p 0.03 */
export function statTurn(r: () => number, competitive: number, onEight: boolean) {
  const p = 0.25 + 0.35 * competitive;
  let k = 0; while (r() < p && k < 8) k++;
  return { seconds: 15 + 15 * r(), pots: k, scratchOnEight: onEight && r() < 0.03 };
}
/** the balls left, laid out at seeded positions when someone comes within 15 m (no two within 2r, none in a pocket's
 *  mouth) */
export function layOut(ids: number[], seed: number): Ball[] {
  const r = mulberry(hash32('layout', seed)), out: Ball[] = [];
  for (const id of ids) {
    for (let k = 0; k < 400; k++) {
      const x = (r() * 2 - 1) * XM, y = (r() * 2 - 1) * YM;
      if (POCKETS.some((p) => Math.hypot(x - p.x, y - p.y) < POOL.POCKET_R + R)) continue;
      if (out.some((b) => Math.hypot(b.x - x, b.y - y) < 2 * R + 0.002)) continue;
      out.push({ id, x, y, vx: 0, vy: 0, on: true }); break;
    }
  }
  return out;
}
