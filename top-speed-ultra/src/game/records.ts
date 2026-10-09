// Runs and bests, kept on this device only (localStorage). The leaderboard is local and says so: there is no
// server, so nothing here is shared or verified.

import type { Mode } from './settings';

export interface Run {
  mode: Mode; score: number; distance: number; top: number; streak: number; nearMisses: number; overtakes: number;
  collisions: number; when: number; road: string;
}
export interface Leaderboard { mode: Mode; runs: Run[]; rank: number }

const KEY = 'tsu.runs.v1';
const KEEP = 10;

function load(): Record<string, Run[]> {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

// add a run to its mode's top ten; returns the board and where this run placed (0 if it didn't)
export function recordRun(run: Run): Leaderboard {
  const all = load();
  const list = (all[run.mode] ?? []).filter((r) => r && typeof r.score === 'number');
  list.push(run);
  list.sort((a, b) => b.score - a.score || a.when - b.when);
  const kept = list.slice(0, KEEP);
  all[run.mode] = kept;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* the board is a convenience */ }
  return { mode: run.mode, runs: kept, rank: kept.indexOf(run) + 1 };
}
export function board(mode: Mode): Run[] { return load()[mode] ?? []; }
