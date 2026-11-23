// The run's two scores and where they are kept: FASTEST MINUTE and DRIFT SCORE (owner, 2026-11-17/18: the four traffic
// modes and their leaderboards). Pure logic with no engine in it, so a synthetic run can be checked exactly (the suite's
// modes group drives these through window.__game.bests).
//
// FASTEST MINUTE (Light, Medium and Extreme traffic): the best average speed over any continuous 60 s of a run, in mph,
// one decimal. A crash or a reset breaks the stretch (the next 60 s start from nothing); a window must be a full 60 s.
// DRIFT SCORE (Zero traffic, where the drift readout is on): the best single drift chain. A chain is the car sliding at
// DRIFT_MIN_DEG or more of body slip above DRIFT_MIN_MPH; its points are the slip angle (degrees) times the speed (mph)
// summed over the time it spends sliding (degree-mph-seconds). It ends when the car is out of the slide for more than
// DRIFT_GAP_S (the points are banked) or when it crashes (the points are lost).
//
// Both are kept on this device only (localStorage). There is no server board yet: nothing here is shared or verified,
// and every place that shows them says so. Two boards each: OPEN (every car you can earn; the OC Hypercar only in its
// race tune) and HYPERCAR UNLEASHED (the OC Hypercar in its Unleashed tune, Free Drive): paid speed never ranks against
// free cars (PROJECT_OC_MONETIZATION.md rule 3a).

import type { TrafficMode } from './settings';

export const MINUTE_S = 60;
export const DRIFT_MIN_DEG = 10;       // body slip that counts as a drift
export const DRIFT_MIN_MPH = 20;       // and the speed it must be held above
export const DRIFT_GAP_S = 1.5;        // out of the slide this long ends the chain
export type Board = 'open' | 'unleashed';
export type Kind = 'minute' | 'drift';
export const BOARDS: Board[] = ['open', 'unleashed'];
export const BOARD_LABEL: Record<Board, string> = { open: 'Open', unleashed: 'Hypercar Unleashed' };
// which score a traffic mode keeps: Zero traffic is the drift mode
export const kindOf = (t: TrafficMode): Kind => (t === 'zero' ? 'drift' : 'minute');
export const round1 = (v: number) => Math.round(v * 10) / 10;

export class MinuteMeter {
  private dts: number[] = []; private vs: number[] = []; private head = 0;
  private sumT = 0; private sumD = 0;     // seconds in the window, and mph x seconds
  best = 0;                               // the best full 60 s average this run (mph)
  reset() { this.dts = []; this.vs = []; this.head = 0; this.sumT = 0; this.sumD = 0; this.best = 0; }
  // a crash or a reset: the stretch starts over (the run's best so far stays)
  broken() { this.dts = []; this.vs = []; this.head = 0; this.sumT = 0; this.sumD = 0; }
  push(dt: number, mph: number) {
    if (!(dt > 0)) return;
    this.dts.push(dt); this.vs.push(mph); this.sumT += dt; this.sumD += mph * dt;
    while (this.head < this.dts.length - 1 && this.sumT - this.dts[this.head] >= MINUTE_S) {
      this.sumT -= this.dts[this.head]; this.sumD -= this.vs[this.head] * this.dts[this.head]; this.head++;
    }
    if (this.sumT > MINUTE_S) {            // trim the oldest step so the window is exactly 60 s
      const ex = this.sumT - MINUTE_S;
      this.dts[this.head] -= ex; this.sumD -= this.vs[this.head] * ex; this.sumT = MINUTE_S;
    }
    if (this.head > 4096) {                // keep the arrays small, and the sums honest
      this.dts = this.dts.slice(this.head); this.vs = this.vs.slice(this.head); this.head = 0;
      this.sumT = 0; this.sumD = 0;
      for (let i = 0; i < this.dts.length; i++) { this.sumT += this.dts[i]; this.sumD += this.vs[i] * this.dts[i]; }
    }
    if (this.full) this.best = Math.max(this.best, this.avg);
  }
  get t() { return Math.min(MINUTE_S, this.sumT); }
  get full() { return this.sumT >= MINUTE_S - 1e-6; }
  // the average over what is in the window (the full 60 s once there is that much)
  get avg() { return this.sumT > 0 ? this.sumD / this.sumT : 0; }
}

export class DriftTracker {
  active = false;       // a chain is running (sliding, or within the gap)
  points = 0;           // the running chain's points
  chainT = 0;           // seconds the chain has run (the gap included)
  best = 0;             // the best banked chain this run
  angle = 0;            // the slip angle now (degrees)
  private gap = 0;
  reset() { this.active = false; this.points = 0; this.chainT = 0; this.best = 0; this.angle = 0; this.gap = 0; }
  private bank() { this.best = Math.max(this.best, this.points); this.active = false; this.points = 0; this.chainT = 0; this.gap = 0; }
  // a crash: the chain is lost, not banked
  crash() { this.active = false; this.points = 0; this.chainT = 0; this.gap = 0; }
  step(dt: number, angleDeg: number, mph: number) {
    this.angle = angleDeg;
    const sliding = angleDeg >= DRIFT_MIN_DEG && mph >= DRIFT_MIN_MPH;
    if (sliding) {
      this.active = true; this.gap = 0; this.chainT += dt;
      this.points += angleDeg * mph * dt;
    } else if (this.active) {
      this.gap += dt; this.chainT += dt;
      if (this.gap > DRIFT_GAP_S) this.bank();
    }
  }
  // the end of the run: a chain still running is banked
  finish() { if (this.active) this.bank(); }
  // the best of the run so far, the running chain included
  get live() { return Math.max(this.best, this.points); }
}

// ---------------------------------------------------------------------------------------------- on this device
export interface BestEntry { v: number; when: number; car: string; road: string; run: 'free' | 'survival' }
type Store = Partial<Record<Board, Partial<Record<TrafficMode, BestEntry[]>>>>;
const KEY = 'tsu.bests.v1';
const KEEP = 10;

function load(): Store {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
const clean = (l: unknown): BestEntry[] => (Array.isArray(l) ? l.filter((e) => e && typeof e.v === 'number' && Number.isFinite(e.v) && e.v > 0) : []);

export function bestsFor(board: Board, traffic: TrafficMode): BestEntry[] { return clean(load()[board]?.[traffic]); }
export function bestOf(board: Board, traffic: TrafficMode): number { return bestsFor(board, traffic)[0]?.v ?? 0; }

export interface Placed {
  rank: number;            // 1 is the best on this device; 0: not placed (no score, or it fell off the top ten)
  of: number;              // entries on the board now
  prev: number;            // the best before this run (0 if none)
  best: number;            // the best now
  gapUp: number | null;    // how far under the place above (null: this run is the best, or isn't placed)
  newBest: boolean;
  list: BestEntry[];
}
// add a run's score to its board (a score of 0 is no score); ties go to whoever set it first
export function recordBest(board: Board, traffic: TrafficMode, e: BestEntry): Placed {
  const all = load(), prevList = clean(all[board]?.[traffic]), prev = prevList[0]?.v ?? 0;
  if (!(e.v > 0)) return { rank: 0, of: prevList.length, prev, best: prev, gapUp: null, newBest: false, list: prevList };
  const list = [...prevList, e].sort((a, b) => b.v - a.v || a.when - b.when).slice(0, KEEP);
  const rank = list.indexOf(e) + 1;
  (all[board] ??= {})[traffic] = list;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* the board is a convenience */ }
  return { rank, of: list.length, prev, best: list[0].v, gapUp: rank > 1 ? round1(list[rank - 2].v - e.v) : null, newBest: e.v > prev, list };
}

// the line the Share button copies (text and link): one line, nothing personal
export function shareLine(kind: Kind, value: number, trafficLabel: string, carLabel: string, link: string): string {
  const what = kind === 'minute' ? `Fastest Minute ${value.toFixed(1)} mph` : `Drift Score ${Math.round(value).toLocaleString('en-US')}`;
  return `OC Ultra: ${what} · ${trafficLabel} · ${carLabel}. Beat it: ${link}`;
}
