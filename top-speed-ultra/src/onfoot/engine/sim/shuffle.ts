// Shuffleboard (PROJECT_OC_SPORTS_BAR.md, "The games: pool, darts, shuffleboard"): pucks r 0.026 m on a 6.7 m x
// 0.51 m bed, sliding friction mu 0.07 (0.69 m/s^2: a release at 3.0 m/s travels 6.55 m, v^2 / 2 mu g), puck-puck
// restitution 0.8, side rails 0.6, fixed 240 Hz substeps; a puck past the end drops into the gutter. Four pucks a side,
// alternating; zones 1, 2 and 3, and 4 for a puck hanging off the end; first to 15. The house aims at a target zone
// with speed error sigma = 0.10 - 0.07 competitive m/s and line error sigma = 1.5 - 1.0 competitive degrees.
// Engine-first: no three.js. Bed coordinates: x along the bed from the throwing end (0) to the far end (6.7), y across
// it from its centre line.
// Ours, where the plan doesn't say: the puck is released 0.10 m onto the bed; the far foul line is 1.83 m (6 ft) from
// the end and a puck that stops short of it is taken off; the zone lines are 1.3, 0.9 and 0.5 m from the end (the
// venue's painted lines); a frame is scored the standard way (only the side with the farthest puck scores, each of its
// pucks beyond the other side's farthest); the side that scored throws first in the next frame.
import { gauss, hash32, mulberry } from './rng';

export const SHUFFLE = { L: 6.7, W: 0.51, R: 0.026, MU: 0.07, G: 9.81, E_PUCK: 0.8, E_RAIL: 0.6, HZ: 240, X0: 0.1, FOUL: 6.7 - 1.83, Z1: 5.4, Z2: 5.8, Z3: 6.2, TO: 15 };
export const DECEL = SHUFFLE.MU * SHUFFLE.G;
const YM = SHUFFLE.W / 2 - SHUFFLE.R;

export interface Puck { id: number; side: number; x: number; y: number; vx: number; vy: number; on: boolean; out: 'gutter' | 'short' | null; thrown: boolean }
/** the zone a puck's centre is in: 4 hanging off the end, then 3, 2, 1, or 0 */
export function zoneOf(x: number) { const { L, R, Z1, Z2, Z3 } = SHUFFLE; return x > L - R ? 4 : x >= Z3 ? 3 : x >= Z2 ? 2 : x >= Z1 ? 1 : 0; }
/** the speed that stops a puck released at X0 at x */
export const speedFor = (x: number) => Math.sqrt(2 * DECEL * Math.max(0, x - SHUFFLE.X0));

/** one substep: friction, motion, the rails, the ends, then puck-puck impulses (approaching only) */
export function substepPucks(ps: Puck[], ev: { clacks: number }) {
  const dt = 1 / SHUFFLE.HZ, dv = DECEL * dt, D = 2 * SHUFFLE.R, J = (1 + SHUFFLE.E_PUCK) / 2;
  for (const p of ps) {
    if (!p.on) continue;
    const s = Math.hypot(p.vx, p.vy);
    if (s <= dv) { p.vx = 0; p.vy = 0; continue; }
    const k = (s - dv) / s; p.vx *= k; p.vy *= k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.y > YM) { p.y = YM; if (p.vy > 0) p.vy *= -SHUFFLE.E_RAIL; } else if (p.y < -YM) { p.y = -YM; if (p.vy < 0) p.vy *= -SHUFFLE.E_RAIL; }
    if (p.x > SHUFFLE.L || p.x < 0) { p.on = false; p.out = 'gutter'; p.vx = p.vy = 0; }
  }
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i]; if (!a.on) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j]; if (!b.on) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= D * D || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, un = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (un > 0) { const imp = J * un; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; ev.clacks++; }
      const push = (D - d) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
}
export const sliding = (ps: Puck[]) => { for (const p of ps) if (p.on && (p.vx !== 0 || p.vy !== 0)) return true; return false; };
/** how far a puck released at speed v straight down the middle of an empty bed slides before it stops, on the bed
 *  itself with the game's substeps (the check's 3.0 m/s: 6.55 m); Infinity if it went into the gutter */
export function slideDistance(v: number) {
  const g = new ShuffleGame([{ who: 'a', competitive: 0.5 }, { who: 'b', competitive: 0.5 }]);
  g.slide(v, 0, 0); g.settle(30);
  const p = g.pucks[0];
  return p.out === 'gutter' ? Infinity : p.x - SHUFFLE.X0;
}

export interface ShuffleSide { who: string; competitive: number }
export interface FrameResult { scorer: number | null; points: number; zones: number[]; score: [number, number] }
export class ShuffleGame {
  pucks: Puck[] = [];
  score: [number, number] = [0, 0];
  turn = 0; thrown = 0; frame = 1; firstOfFrame = 0;
  /** each side's pucks slid in this frame, kept as a field (a HUD reads the pucks left without counting) */
  bySide: [number, number] = [0, 0];
  state: 'aim' | 'sliding' | 'over' = 'aim';
  winner: number | null = null;
  lastFrame: FrameResult | null = null;
  /** the best zone each side landed in a frame's scoring (the "land a 3" goal) */
  best3 = [false, false];
  private acc = 0; t = 0; slideT = 0; clacks = 0; private ev = { clacks: 0 };
  log: string[] = [];
  constructor(public sides: [ShuffleSide, ShuffleSide], first = 0) { this.turn = first; this.firstOfFrame = first; }
  /** the puck in play now, by side, and whose throw is next */
  slide(speed: number, lineDeg: number, y0 = 0) {
    if (this.state !== 'aim' || this.winner !== null) return false;
    if (!Number.isFinite(speed) || !Number.isFinite(lineDeg) || !Number.isFinite(y0) || speed <= 0) return false;
    const a = (lineDeg * Math.PI) / 180, p: Puck = { id: this.thrown, side: this.turn, x: SHUFFLE.X0, y: Math.max(-YM, Math.min(YM, y0)), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, on: true, out: null, thrown: true };
    this.pucks.push(p); this.thrown++; this.bySide[p.side]++; this.state = 'sliding'; this.acc = 0; this.slideT = 0;
    return true;
  }
  step(dt: number): boolean {
    if (this.state !== 'sliding') return false;
    this.acc += dt; this.t += dt;
    const h = 1 / SHUFFLE.HZ, ev = this.ev; ev.clacks = 0;
    while (this.acc >= h) {
      this.acc -= h; this.slideT += h; substepPucks(this.pucks, ev);
      if (!sliding(this.pucks)) { this.acc = 0; this.clacks += ev.clacks; this.rest(); return true; }
    }
    this.clacks += ev.clacks;
    return false;
  }
  settle(maxS = 30) { const t0 = this.slideT; while (this.state === 'sliding' && this.slideT - t0 < maxS) this.step(1 / SHUFFLE.HZ); return this.slideT - t0; }
  private rest() {
    // short of the far foul line: taken off
    for (const p of this.pucks) if (p.on && p.x < SHUFFLE.FOUL) { p.on = false; p.out = 'short'; }
    if (this.thrown >= 8) { this.scoreFrame(); return; }
    this.turn = 1 - this.turn; this.state = 'aim';
  }
  /** the frame's score: the side with the farthest puck scores each of its pucks beyond the other side's farthest */
  private scoreFrame() {
    const on = this.pucks.filter((p) => p.on);
    const far = [0, 1].map((s) => Math.max(-1, ...on.filter((p) => p.side === s).map((p) => p.x)));
    let scorer: number | null = null, points = 0; const zones: number[] = [];
    if (far[0] > far[1]) scorer = 0; else if (far[1] > far[0]) scorer = 1;
    if (scorer !== null) {
      for (const p of on) if (p.side === scorer && p.x > far[1 - scorer]) { const z = zoneOf(p.x); points += z; zones.push(z); if (z === 3) this.best3[scorer] = true; }
      this.score[scorer] += points;
    }
    this.lastFrame = { scorer, points, zones, score: [this.score[0], this.score[1]] };
    this.log.push(`frame ${this.frame}: ${scorer === null ? 'no score' : `${this.sides[scorer].who} ${points} (${zones.join('+')})`} · ${this.score[0]}-${this.score[1]}`);
    if (scorer !== null && this.score[scorer] >= SHUFFLE.TO) { this.winner = scorer; this.state = 'over'; return; }
    // a new frame: the scorer throws first
    this.frame++; this.pucks = []; this.thrown = 0; this.bySide[0] = this.bySide[1] = 0; this.firstOfFrame = scorer ?? 1 - this.firstOfFrame; this.turn = this.firstOfFrame; this.state = 'aim';
  }
  /** the house's slide: a target (its own zone 3, or knocking off the other side's leader when that one is in front),
   *  then the errors */
  housePlan(seed: number, competitive = this.sides[this.turn].competitive) {
    const r = mulberry(hash32('puck', seed, this.frame, this.thrown)), s = this.turn;
    const on = this.pucks.filter((p) => p.on), mine = Math.max(-1, ...on.filter((p) => p.side === s).map((p) => p.x));
    const theirs = on.filter((p) => p.side !== s).sort((a, b) => b.x - a.x)[0];
    let tx = 6.45, ty = (r() - 0.5) * 0.16, kind = 'zone 3';
    if (theirs && theirs.x > mine && theirs.x > SHUFFLE.Z1) { tx = Math.min(SHUFFLE.L + 0.6, theirs.x + 0.9); ty = theirs.y; kind = 'knock off'; }
    const v = speedFor(tx), line = Math.atan2(ty - 0, tx - SHUFFLE.X0) * (180 / Math.PI);
    const sv = 0.1 - 0.07 * competitive, sl = 1.5 - 1.0 * competitive;
    return { kind, target: [tx, ty] as [number, number], speed: Math.max(0.3, v + gauss(r) * sv), line: line + gauss(r) * sl, y0: 0 };
  }
  /** a close loss: the loser had 11 or more */
  closeFor(side: number) { return this.score[side] >= SHUFFLE.TO - 4; }
}
