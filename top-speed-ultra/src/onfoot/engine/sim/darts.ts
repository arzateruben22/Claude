// Darts (PROJECT_OC_SPORTS_BAR.md, "The games: pool, darts, shuffleboard"): the standard generic 20-segment board,
// 301 straight out (no double needed) with a bust over, your swaying aim, and the house opponent's throws. Engine-first:
// no three.js. Board coordinates: metres from the bullseye, x to the thrower's right, y up.
//   Your throw: the aim sways; holding steadies it for 1.2 s, then the sway grows; low energy widens it a little.
//   The house opponent (ours): it aims at a bed chosen from what it has left and throws with a per-axis error
//   sigma = 0.03 - 0.02 competitive m.
import { gauss, hash32, mulberry } from './rng';

/** the standard board's radii (metres): bull, outer bull, treble ring, double ring */
export const BOARD = { bull: 0.00635, outerBull: 0.0159, trebleIn: 0.099, trebleOut: 0.107, doubleIn: 0.162, doubleOut: 0.17 };
/** the segments clockwise from the top */
export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const START = 301;

export interface Hit { score: number; mult: 0 | 1 | 2 | 3; seg: number; label: string }
/** the score of a dart at (x, y) on the board */
export function scoreAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r <= BOARD.bull) return { score: 50, mult: 2, seg: 25, label: 'Bull' };
  if (r <= BOARD.outerBull) return { score: 25, mult: 1, seg: 25, label: '25' };
  if (r > BOARD.doubleOut) return { score: 0, mult: 0, seg: 0, label: 'Miss' };
  let a = Math.atan2(x, y); if (a < 0) a += Math.PI * 2;               // 0 at the top, clockwise
  const seg = ORDER[Math.floor((a + Math.PI / 20) / (Math.PI / 10)) % 20];
  const mult = r >= BOARD.trebleIn && r <= BOARD.trebleOut ? 3 : r >= BOARD.doubleIn ? 2 : 1;
  return { score: seg * mult, mult, seg, label: (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + seg };
}
/** the middle of a bed: a segment (or 25 for the bull) and a multiplier; 'big' singles aim at the outer single bed */
export function bedPoint(seg: number, mult: 1 | 2 | 3, outer = true): [number, number] {
  if (seg === 25) return mult === 2 ? [0, 0] : [0, (BOARD.bull + BOARD.outerBull) / 2];
  const i = ORDER.indexOf(seg), a = (i * Math.PI) / 10;
  const r = mult === 3 ? (BOARD.trebleIn + BOARD.trebleOut) / 2 : mult === 2 ? (BOARD.doubleIn + BOARD.doubleOut) / 2 : outer ? (BOARD.trebleOut + BOARD.doubleIn) / 2 : (BOARD.outerBull + BOARD.trebleIn) / 2;
  return [Math.sin(a) * r, Math.cos(a) * r];
}
/** what the house aims at with `left` to go (straight out: any bed that finishes, else the treble 20) */
export function houseTarget(left: number): { seg: number; mult: 1 | 2 | 3 } {
  if (left > 60) return { seg: 20, mult: 3 };
  if (left === 50) return { seg: 25, mult: 2 };
  if (left === 25) return { seg: 25, mult: 1 };
  if (left <= 20) return { seg: left, mult: 1 };
  if (left % 3 === 0 && left / 3 <= 20) return { seg: left / 3, mult: 3 };
  if (left % 2 === 0 && left / 2 <= 20) return { seg: left / 2, mult: 2 };
  // leave a single to finish next: the biggest single that leaves 1 to 20
  return { seg: Math.min(20, left - 1), mult: 1 };
}
/** the house's throw error: per axis, metres */
export const houseSigma = (competitive: number) => 0.03 - 0.02 * competitive;

/** your aim's sway (metres) after holding for t seconds: it steadies to 30% over the first 1.2 s, then grows again;
 *  under 30 energy it widens by up to half */
export function swayAmp(t: number, energy: number) {
  const base = 0.03, k = 1 + 0.5 * Math.max(0, Math.min(1, (30 - energy) / 30));
  const a = t <= 1.2 ? base * (1 - (0.7 * t) / 1.2) : base * 0.3 * (1 + 1.4 * (t - 1.2));
  return Math.min(0.08, a * k);
}
/** the sway's offset at time t (a slow seeded figure of eight), written into `out` (the page's per-frame reticle and
 *  the release reuse one array) */
export function swayInto(t: number, energy: number, phase: number, out: [number, number]): [number, number] {
  const a = swayAmp(t, energy);
  out[0] = a * Math.sin(2 * Math.PI * 0.9 * t + phase); out[1] = a * Math.sin(2 * Math.PI * 1.3 * t + phase * 1.7) * 0.8;
  return out;
}
/** the sway's offset at time t, as a new pair (the tests) */
export const swayAt = (t: number, energy: number, phase: number): [number, number] => swayInto(t, energy, phase, [0, 0]);

export interface DartsSide { who: string; competitive: number }
export interface Dart { x: number; y: number; side: number; hit: Hit; t: number }
export interface DartResult { side: number; hit: Hit; bust: boolean; won: boolean; turnOver: boolean; left: number }

/** 301 straight out between two sides; each turn is up to three darts; a dart past zero busts the turn (its darts
 *  don't count and the turn ends) */
export class DartsGame {
  left: [number, number] = [START, START];
  turn = 0; dart = 0; private turnStart = START;
  winner: number | null = null;
  board: Dart[] = [];
  /** every dart thrown: the log and the tests */
  thrown: Dart[] = [];
  turns = 0; busts = [0, 0];
  constructor(public sides: [DartsSide, DartsSide], first = 0) { this.turn = first; this.turnStart = this.left[first]; }
  /** a dart lands at (x, y) on the board */
  land(x: number, y: number, t = 0): DartResult {
    const s = this.turn, hit = scoreAt(x, y), d = { x, y, side: s, hit, t };
    this.board.push(d); this.thrown.push(d);
    const next = this.left[s] - hit.score;
    let bust = false, won = false, over = false;
    if (next < 0) { bust = true; this.left[s] = this.turnStart; this.busts[s]++; over = true; }
    else { this.left[s] = next; if (next === 0) { won = true; this.winner = s; over = true; } }
    this.dart++;
    if (this.dart >= 3) over = true;
    const res = { side: s, hit, bust, won, turnOver: over, left: this.left[s] };
    if (over && !won) this.endTurn();
    return res;
  }
  /** pass the oche (the darts are pulled from the board) */
  endTurn() { this.turn = 1 - this.turn; this.dart = 0; this.turnStart = this.left[this.turn]; this.turns++; }
  clearBoard() { this.board.length = 0; }
  /** the house's next dart: its target bed and where the dart lands (seeded) */
  houseThrow(seed: number, competitive = this.sides[this.turn].competitive) {
    const r = mulberry(hash32('dart', seed, this.thrown.length)), tg = houseTarget(this.left[this.turn]), [tx, ty] = bedPoint(tg.seg, tg.mult), s = houseSigma(competitive);
    return { target: tg, aim: [tx, ty] as [number, number], at: [tx + gauss(r) * s, ty + gauss(r) * s] as [number, number] };
  }
  /** a close loss: the loser had 40 or fewer left */
  closeFor(side: number) { return this.left[side] <= 40; }
}
