// Billboards: ad panels on posts beside the freeway, from src/data/ads.json. Each slot is found on its carriageway
// by the nearest point to a place in game metres, then moved back `before` metres so the sign comes up ahead of the
// exit. Only our own venues until a business signs a deal. The panels are in the gates' frame (race.ts): +x across
// the road to the right, facing back toward the oncoming driver; the game rebases them with the floating origin.

import * as THREE from 'three';
import type { Network } from '../world/Network';
import { ORIGIN } from '../world/Path';
import * as T from '../textures';

export interface Creative { title: string; line: string; tag: string; bg: string; fg: string; accent: string }
export interface Slot { road: string; near: [number, number]; side: 'L' | 'R'; before: number; creative: string }
export interface Ads { creatives: Record<string, Creative>; slots: Slot[] }

const W = 12, H = 4, POST_H = 5.5, STEP = 40;

export function buildBillboards(net: Network, ads: Ads): THREE.Group {
  const group = new THREE.Group();
  group.name = 'billboards';
  const postM = new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.7, metalness: 0.4 });
  const backM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 });
  const panels = new Map<string, THREE.Material>();
  const pt = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };
  for (const slot of ads.slots) {
    const cr = ads.creatives[slot.creative];
    const path = net.mains.find((m) => m.label === slot.road);
    if (!cr || !path) continue;
    // the nearest point on the carriageway to the place, coarsely then finely
    let bestS = 0, bestD = Infinity;
    for (let s = 0; s <= path.len; s += STEP) { path.sample(s, pt); const d = Math.hypot(pt.x - slot.near[0], pt.z - slot.near[1]); if (d < bestD) { bestD = d; bestS = s; } }
    for (let s = Math.max(0, bestS - STEP); s <= Math.min(path.len, bestS + STEP); s += 4) { path.sample(s, pt); const d = Math.hypot(pt.x - slot.near[0], pt.z - slot.near[1]); if (d < bestD) { bestD = d; bestS = s; } }
    if (bestD > 1200) continue;                       // the place isn't on this road
    const s = Math.max(20, Math.min(path.len - 20, bestS - slot.before));
    path.sample(s, pt);
    const x = slot.side === 'R' ? path.wallR + 6 : path.wallL - 6;
    let mat = panels.get(slot.creative);
    if (!mat) {
      const tex = T.label(`billboard-${slot.creative}`, 1024, 342, (c, w, h) => {
        c.fillStyle = cr.bg; c.fillRect(0, 0, w, h);
        c.fillStyle = cr.accent; c.fillRect(0, h - 14, w, 14);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillStyle = cr.fg; c.font = `900 ${h * 0.4}px "Big Shoulders Display", Impact, sans-serif`; c.fillText(cr.title, w * 0.05, h * 0.5);
        c.fillStyle = cr.accent; c.font = `600 ${h * 0.14}px "Chakra Petch", Arial, sans-serif`; c.fillText(cr.line, w * 0.05, h * 0.7);
        c.fillStyle = cr.fg; c.globalAlpha = 0.75; c.font = `500 ${h * 0.1}px "Chakra Petch", Arial, sans-serif`; c.fillText(cr.tag, w * 0.05, h * 0.86); c.globalAlpha = 1;
      });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.35 });
      panels.set(slot.creative, mat);
    }
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, POST_H + H, 0.6), postM); post.position.set(x, (POST_H + H) / 2, 0); post.castShadow = true; g.add(post);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); panel.position.set(x, POST_H + H / 2, -0.35); panel.castShadow = true; g.add(panel);
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, H + 0.3, 0.2), backM); back.position.set(x, POST_H + H / 2, -0.5); g.add(back);
    g.rotation.y = pt.h + Math.PI;
    g.userData.ax = pt.x; g.userData.az = pt.z; g.userData.road = slot.road; g.userData.s = s; g.userData.creative = slot.creative;
    g.position.set(pt.x - ORIGIN.x, pt.y, pt.z - ORIGIN.z);
    group.add(g);
  }
  return group;
}
