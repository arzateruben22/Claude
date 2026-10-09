// The live instruments: tachometer face and needle, gear readout, the two side screens and the wheel's shift lights.

import * as THREE from 'three';
import { roundRect } from '../textures';
import { SPEC } from './Physics';
import { MPH, clamp } from '../util';

const FONT = '"Saira Semi Condensed", "Arial Narrow", Arial, sans-serif';

export const TACH_START = (225 * Math.PI) / 180;      // 0 rpm at lower left
export const TACH_SWEEP = (270 * Math.PI) / 180;      // to 10,000 at lower right
export const rpmAngle = (rpm: number) => TACH_START - (clamp(rpm, 0, 10000) / 10000) * TACH_SWEEP;

export function tachFace(): THREE.CanvasTexture {
  const n = 1024, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!, cx = n / 2, cy = n / 2, R = n * 0.47;
  const bg = g.createRadialGradient(cx, cy * 0.9, 0, cx, cy, R * 1.05);
  bg.addColorStop(0, '#20232a'); bg.addColorStop(0.7, '#101216'); bg.addColorStop(1, '#050608');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R * 1.04, 0, Math.PI * 2); g.fill();
  // red zone
  g.strokeStyle = '#d0141e'; g.lineWidth = R * 0.07;
  g.beginPath(); g.arc(cx, cy, R * 0.9, -rpmAngle(8000), -rpmAngle(10000)); g.stroke();
  for (let v = 0; v <= 10000; v += 250) {
    const a = rpmAngle(v), major = v % 1000 === 0, half = v % 500 === 0;
    const r0 = R * (major ? 0.8 : half ? 0.85 : 0.88), r1 = R * 0.95;
    g.strokeStyle = v >= 8000 ? '#ff3a3a' : '#e9e9e4'; g.lineWidth = major ? 9 : half ? 5 : 3;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy - Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy - Math.sin(a) * r1); g.stroke();
    if (major) {
      g.fillStyle = v >= 8000 ? '#ff3a3a' : '#f2f2ee'; g.font = `700 ${R * 0.17}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(v / 1000), cx + Math.cos(a) * R * 0.64, cy - Math.sin(a) * R * 0.64);
    }
  }
  g.fillStyle = '#9aa0a8'; g.font = `600 ${R * 0.07}px ${FONT}`; g.textAlign = 'center';
  g.fillText('RPM x 1000', cx, cy + R * 0.3);
  // the make's badge, small, above centre (our own mark: an R in a yellow shield)
  g.fillStyle = '#f5c518'; roundRect(g, cx - R * 0.07, cy - R * 0.42, R * 0.14, R * 0.17, R * 0.03); g.fill();
  g.fillStyle = '#111'; g.font = `italic 800 ${R * 0.13}px ${FONT}`; g.textBaseline = 'middle'; g.fillText('R', cx, cy - R * 0.335);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

class Screen {
  readonly canvas = document.createElement('canvas');
  readonly g: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  constructor(w: number, h: number) {
    this.canvas.width = w; this.canvas.height = h;
    this.g = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
  }
}

export interface Readout { speed: number; rpm: number; gear: number; auto: boolean; limiter: boolean; distance: number; throttle: number; mode: string; time: string }

export class Instruments {
  readonly face = tachFace();
  readonly gear = new Screen(256, 192);
  readonly left = new Screen(768, 448);
  readonly right = new Screen(768, 448);
  private lastGear = '';
  private t = 0;
  private menu = 0;
  private menuT = 0;

  update(dt: number, r: Readout) {
    const label = (r.gear < 0 ? 'R' : String(r.gear)) + (r.auto ? 'A' : 'M');
    if (label !== this.lastGear) { this.lastGear = label; this.drawGear(r); }
    this.t += dt; this.menuT += dt;
    if (this.menuT > 4) { this.menuT = 0; this.menu = (this.menu + 1) % 6; }
    if (this.t < 1 / 15) return;
    this.t = 0;
    this.drawLeft(r); this.drawRight(r);
  }

  private drawGear(r: Readout) {
    const { g, canvas: c } = this.gear;
    g.fillStyle = '#07080a'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#d0141e'; g.lineWidth = 8; roundRect(g, 10, 10, c.width - 20, c.height - 20, 18); g.stroke();
    g.fillStyle = '#ff2a2a'; g.font = `800 132px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(r.gear < 0 ? 'R' : String(r.gear), c.width / 2, c.height / 2 + 8);
    g.fillStyle = '#e8e8e2'; g.font = `700 28px ${FONT}`; g.fillText(r.auto ? 'AUTO' : '', c.width / 2, 34);
    this.gear.tex.needsUpdate = true;
  }

  private drawLeft(r: Readout) {
    const { g, canvas: c } = this.left, w = c.width, h = c.height;
    g.fillStyle = '#06070a'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(70,80,96,.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9aa3ad'; g.font = `600 30px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(r.mode.toUpperCase(), 40, 62);
    g.textAlign = 'right'; g.fillText('mph', w - 44, 62);
    g.fillStyle = '#f4f4ef'; g.font = `700 200px ${FONT}`; g.textAlign = 'center';
    g.fillText(String(Math.round(r.speed * MPH)), w / 2, 280);
    // fuel and oil temperature bars
    const bar = (y: number, f: number, label: string, col: string) => {
      g.fillStyle = '#2a2e35'; g.fillRect(150, y, 470, 14);
      g.fillStyle = col; g.fillRect(150, y, 470 * f, 14);
      g.fillStyle = '#9aa3ad'; g.font = `600 26px ${FONT}`; g.textAlign = 'right'; g.fillText(label, 132, y + 14);
    };
    bar(330, 0.72, 'FUEL', '#e7e7e2');
    bar(372, clamp(0.45 + r.rpm / 30000, 0, 1), 'OIL', r.rpm > 7000 ? '#ff8a3a' : '#e7e7e2');
    g.fillStyle = '#9aa3ad'; g.font = `600 26px ${FONT}`; g.textAlign = 'left';
    g.fillText(`TRIP ${(r.distance / 1609.34).toFixed(1)} mi`, 40, 432);
    this.left.tex.needsUpdate = true;
  }

  private drawRight(r: Readout) {
    const { g, canvas: c } = this.right, w = c.width, h = c.height;
    g.fillStyle = '#06070a'; g.fillRect(0, 0, w, h);
    const items = ['NAVI', 'RADIO', 'MEDIA', 'PHONE', 'VEHICLE', 'SETTINGS'];
    g.font = `600 40px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    items.forEach((it, i) => {
      const y = 52 + i * 62;
      if (i === this.menu) { g.fillStyle = 'rgba(208,20,30,.85)'; roundRect(g, 26, y - 26, 300, 52, 8); g.fill(); }
      g.fillStyle = i === this.menu ? '#ffffff' : '#c9ced5'; g.fillText(it, 46, y + 2);
    });
    // a power meter on the right: how much of the engine you're using
    g.fillStyle = '#2a2e35'; g.fillRect(560, 60, 22, 300);
    g.fillStyle = r.limiter ? '#ff2a2a' : '#e8e8e2'; const f = clamp(r.throttle * (r.rpm / SPEC.redline), 0, 1); g.fillRect(560, 60 + 300 * (1 - f), 22, 300 * f);
    g.fillStyle = '#9aa3ad'; g.font = `600 24px ${FONT}`; g.textAlign = 'center'; g.fillText('PWR', 571, 390);
    g.textAlign = 'right'; g.font = `600 34px ${FONT}`; g.fillStyle = '#e8e8e2'; g.fillText(r.time, w - 40, 418);
    this.right.tex.needsUpdate = true;
  }
}
