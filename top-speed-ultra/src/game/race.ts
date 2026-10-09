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
export const RIVALS = [
  { name: 'Marco V.', paint: 0x1d1f24, pace: 0.95 },
  { name: 'Dani K.', paint: 0x0f6b4a, pace: 0.92 },
  { name: 'Sol R.', paint: 0xe8701a, pace: 0.89 },
];

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
