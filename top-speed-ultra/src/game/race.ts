// Races against three AI drivers on real stretches of freeway: sprints, checkpoint races and an endurance run.
// Countdown, live standings, a finish, and rewards in credits and XP (fictional, earned only). Best times are kept
// on this device.

import * as THREE from 'three';
import type { Path } from './world/Path';
import { ORIGIN } from './world/Path';
import * as T from './textures';

export type RaceKind = 'sprint' | 'checkpoint' | 'endurance';
export interface Course { id: string; name: string; kind: RaceKind; road: string; at: number; length: number; cps: number; reward: number[]; blurb: string }

export const COURSES: Course[] = [
  { id: 'irvine', name: 'Irvine Sprint', kind: 'sprint', road: 'I-405 North', at: 0.1, length: 8000, cps: 0, reward: [1500, 800, 400, 150], blurb: '8 km up the 405 from Irvine. Flat out, four lanes, real traffic.' },
  { id: 'santa-ana', name: 'Santa Ana Checkpoints', kind: 'checkpoint', road: 'I-5 North', at: 0.38, length: 12000, cps: 5, reward: [2200, 1200, 600, 200], blurb: '12 km of the 5 through Santa Ana, five gates to clear in order.' },
  { id: 'foothill', name: 'Foothill Sprint', kind: 'sprint', road: 'CA-241 South', at: 0.15, length: 10000, cps: 0, reward: [1800, 1000, 500, 200], blurb: '10 km down the 241 toll road: two lanes, hills, sweepers.' },
  { id: 'riverside', name: 'Riverside Endurance', kind: 'endurance', road: 'CA-91 East', at: 0.12, length: 30000, cps: 3, reward: [5000, 2500, 1200, 400], blurb: '30 km out the 91 toward Riverside. Pace yourself through the traffic.' },
];
// our fictional rivals; the tag is the OC city they race out of (the HUD shows it where a sim would show a flag)
export const RIVALS = [
  { name: 'Marco V.', tag: 'ANA', paint: 0x1d1f24, pace: 0.95 },
  { name: 'Dani K.', tag: 'IRV', paint: 0x0f6b4a, pace: 0.92 },
  { name: 'Sol R.', tag: 'HB', paint: 0xe8701a, pace: 0.89 },
];
export const YOUR_TAG = 'OC';

// a row of the live standings. gap: seconds between that car and you, positive when it is ahead of you, negative
// behind, 0 on your own row. It is an estimate from the distance along the course at your speed (there is no
// timing line between the cars), and the HUD says so. One speed for every row keeps the gaps in the same order as
// the positions; a rival's own speed would let a slow car further back show a smaller gap than a fast one ahead.
export interface Standing { pos: number; name: string; tag: string; you: boolean; gap: number; done: number }
export interface Runner { name: string; tag: string; prog: number; v: number; done: number }
export function standings(you: { prog: number; v: number }, rivals: Runner[], t: number, L: number): Standing[] {
  const me: Runner = { name: 'You', tag: YOUR_TAG, prog: you.prog, v: you.v, done: 0 };
  // finishers first in the order they crossed the line, then everyone else by distance covered
  const all = [...rivals, me].sort((a, b) => (a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : b.prog - a.prog));
  const vMe = Math.max(you.v, 8);
  return all.map((r, i) => {
    let gap = 0;
    if (r !== me) {
      if (r.done) gap = t - r.done + (L - you.prog) / vMe;                    // home already: how far behind you would cross at this speed
      else gap = (r.prog - you.prog) / vMe;                                   // ahead (+) or behind (−): the distance between you at your speed
    }
    return { pos: i + 1, name: r.name, tag: r.tag, you: r === me, gap, done: r.done };
  });
}

export function bestTime(id: string): number { try { return Number(localStorage.getItem('tsu.race.' + id)) || 0; } catch { return 0; } }
export function saveBestTime(id: string, t: number) {
  const b = bestTime(id);
  if (!b || t < b) { try { localStorage.setItem('tsu.race.' + id, String(t)); } catch { /* fine */ } return true; }
  return false;
}
export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

// gantries across the carriageway: chequered for the start and finish, yellow for checkpoints
export function gate(path: Path, s: number, kind: 'start' | 'finish' | 'cp', label: string) {
  const g = new THREE.Group();
  const at = path.sample(s);
  const left = path.wallL - 0.6, right = path.wallR + 0.6, H = 6.6, W = right - left;
  const post = new THREE.MeshStandardMaterial({ color: kind === 'cp' ? 0xf5c518 : 0xe8e8e4, roughness: 0.5 });
  for (const x of [left, right]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, H + 1.6, 0.5), post); p.position.set(x, (H + 1.6) / 2, 0); p.castShadow = true; g.add(p); }
  const tex = T.label(`gate-${kind}-${label}`, 1024, 128, (c, w, h) => {
    if (kind === 'cp') { c.fillStyle = '#f5c518'; c.fillRect(0, 0, w, h); }
    else { const n = 32; for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#f4f4ee'; c.fillRect((i * w) / n, (j * h) / 4, w / n + 1, h / 4 + 1); } }
    c.fillStyle = kind === 'cp' ? '#111' : '#d0141e'; c.fillRect(w * 0.32, h * 0.12, w * 0.36, h * 0.76);
    c.fillStyle = '#fff'; c.font = `800 ${h * 0.52}px "Saira Semi Condensed", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 2);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  banner.position.set((left + right) / 2, H + 0.6, 0); banner.castShadow = true;
  g.add(banner);
  // this frame: +x across the road to the right, facing back toward the oncoming driver
  g.rotation.y = at.h + Math.PI;
  g.userData.ax = at.x; g.userData.az = at.z;
  g.position.set(at.x - ORIGIN.x, at.y, at.z - ORIGIN.z);
  return g;
}
