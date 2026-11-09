// S4: the bar's surfaces' relief, made in code (PROJECT_OC_SPORTS_BAR.md, "Graphics: Low, HD, Ultra", Materials): height
// fields painted on a canvas and turned into tangent-space normal maps by Lot 57's normalTex (engine/tex.ts). Ours:
// the booths' coral vinyl tufted in diamonds with a button at each crossing, the pool cloth's nap, the oak's grain, the
// polished concrete's faint aggregate, brushed steel, and (S4's repair) the dartboards' sisal: the bristle of the fibre
// ends and the raised wire spider, on a map laid out like the signs' atlas that carries the boards (flat everywhere
// else on it). Only HD and Ultra draw them (Low keeps its flat, crisp surfaces, as Lot 57's P1d does); look.ts makes
// them once, at the size the preset asks for.
import * as THREE from 'three';
import { normalTex } from '../../engine/tex';
import { rand } from '../../engine/geom';
import { ATLAS } from './tex';

/** diamond tufting: pillows between buttons on a diamond lattice (2 x 2 diamonds a tile, so it repeats seamlessly) */
function tufts(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.createImageData(w, h), d = img.data, n = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // the lattice in diamond coordinates: a and b run along the two diagonals
    const u = (x / w) * n, v = (y / h) * n;
    const a = u + v, b = u - v;
    const fa = a - Math.floor(a) - 0.5, fb = b - Math.floor(b) - 0.5;
    // a pillow: high in each diamond's middle, down to the seams; a button dimple where the seams cross
    const pillow = Math.cos(fa * Math.PI) * Math.cos(fb * Math.PI);
    const ca = Math.abs(fa) - 0.5, cb = Math.abs(fb) - 0.5, button = Math.exp(-(ca * ca + cb * cb) / 0.004);
    const hgt = 0.18 + 0.72 * Math.pow(Math.max(0, pillow), 0.6) - 0.25 * button;
    const k = (y * w + x) * 4, c = Math.max(0, Math.min(255, hgt * 255));
    d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
/** the cloth's nap: fine fibres laid one way, a little cross-hatch of the weave under them */
function nap(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  const r = rand(311);
  g.lineWidth = 1;
  for (let i = 0; i < w * 6; i++) {
    const x = r() * w, y = r() * h, l = 2 + r() * 5, c = 110 + Math.floor(r() * 60);
    g.strokeStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.25, y + l); g.stroke();
  }
  g.globalAlpha = 0.18;
  for (let i = 0; i < w; i += 2) { g.fillStyle = i % 4 ? '#707070' : '#909090'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
  g.globalAlpha = 1;
}
/** the oak's grain: long rings drifting across the board, pores between them (quarter-sawn, laid along u) */
function grain(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.createImageData(w, h), d = img.data, r = rand(905);
  const ph = Array.from({ length: 6 }, () => r() * 6.28);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = (x / w) * 6.28318, s = (y / h) * 6.28318;
    const ring = s * 9 + 1.1 * Math.sin(t + ph[0]) + 0.5 * Math.sin(2 * t + ph[1]) + 0.25 * Math.sin(3 * s + ph[2]);
    const band = 0.5 + 0.5 * Math.sin(ring * 2.0);
    const pore = (Math.sin(x * 2.7 + Math.sin(y * 0.37) * 3) * Math.sin(y * 1.9 + ph[3]) > 0.93 ? 0.25 : 0);
    const hgt = 0.35 + 0.4 * Math.pow(band, 3) - pore;
    const k = (y * w + x) * 4, c = Math.max(0, Math.min(255, hgt * 255));
    d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
/** polished concrete: a ground-flat slab with the aggregate barely proud of the paste, and a few fine cracks */
function aggregate(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
  const r = rand(4401);
  for (let i = 0; i < w * 1.4; i++) {
    const x = r() * w, y = r() * h, s = 1 + r() * (w / 90), c = 128 + Math.floor(r() * 50);
    g.fillStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3.14, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = '#5c5c5c'; g.lineWidth = Math.max(1, w / 512);
  for (let k = 0; k < 3; k++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 14; j++) { x += (r() - 0.5) * w * 0.06; y += w * 0.03; g.lineTo(x, y); } g.stroke(); }
}
/** brushed brass and steel: fine scratches along one direction */
function brushed(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  const r = rand(77);
  for (let i = 0; i < h * 3; i++) { const y = r() * h, c = 100 + Math.floor(r() * 56); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(0, y, w, 0.6 + r() * 0.8); }
}

export interface BarRelief { vinyl: THREE.Texture; cloth: THREE.Texture; oak: THREE.Texture; floor: THREE.Texture; metal: THREE.Texture }
/** every relief map at one size (HD 256, Ultra 512); repeats are set for each batch's metres per UV unit */
export function makeRelief(size: number): BarRelief {
  const out: BarRelief = {
    vinyl: normalTex(size, tufts, 3.2),
    cloth: normalTex(size, nap, 0.9),
    oak: normalTex(size, grain, 1.4),
    floor: normalTex(size, aggregate, 0.7),
    metal: normalTex(size, brushed, 0.6),
  };
  // the batches' UVs are world metres over their scale (venue.ts): the vinyl 4 m, the oak and the pool tables 1.4 m,
  // the floor 4 m. A tuft 0.24 m across (2 a tile), the nap's fibres a few mm, the grain's boards about 0.7 m long
  out.vinyl.repeat.set(4 / 0.48, 4 / 0.48);
  out.cloth.repeat.set(1.4 / 0.12, 1.4 / 0.12);
  out.oak.repeat.set(2, 1.4 / 0.35);
  out.floor.repeat.set(4 / 1.6, 4 / 1.6);
  out.metal.repeat.set(4, 4);
  for (const t of Object.values(out)) t.name = 'relief';
  return out;
}
export function disposeRelief(r: BarRelief | null) { if (r) for (const t of Object.values(r)) t.dispose(); }

/** the dartboards' sisal, in the signs' atlas layout (1024 px a side there; tex.ts's dartboard: centre 128, 488, 556.5
 *  px a metre): the scoring area a bristle of fibre ends, the wire spider proud of it (the bull's rings, the treble and
 *  double rings and the twenty radial wires), the rest of the atlas flat. HD 512, Ultra 1024 */
function sisal(g: CanvasRenderingContext2D, w: number) {
  const k = w / 1024, cx = 128 * k, cy = 488 * k, PX = (256 / 0.46) * k;
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, w);
  const D = ATLAS.dartboard, x0 = Math.floor(D.u0 * w), y0 = Math.floor((1 - D.v1) * w), bw = Math.ceil((D.u1 - D.u0) * w), bh = Math.ceil((D.v1 - D.v0) * w);
  const img = g.getImageData(x0, y0, bw, bh), d = img.data, r = rand(1759), R = 0.17 * PX;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const dx = x0 + x + 0.5 - cx, dy = y0 + y + 0.5 - cy;
    if (dx * dx + dy * dy > R * R) continue;
    const c = 128 + Math.round((r() - 0.5) * 34), i = (y * bw + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = c;
  }
  g.putImageData(img, x0, y0);
  g.strokeStyle = '#c4c4c4'; g.lineWidth = Math.max(1, 1.1 * k);
  for (const m of [0.0159, 0.099, 0.107, 0.162, 0.17]) { g.beginPath(); g.arc(cx, cy, m * PX, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 20; i++) {
    const a = ((i - 0.5) / 20) * Math.PI * 2 - Math.PI / 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 0.0159 * PX, cy + Math.sin(a) * 0.0159 * PX); g.lineTo(cx + Math.cos(a) * 0.17 * PX, cy + Math.sin(a) * 0.17 * PX); g.stroke();
  }
}
/** the signs' relief (the dartboards' sisal), the atlas's size at this mode; look.ts sets it as the signs' normal map */
export function makeSisal(size: number) { const t = normalTex(size, sisal, 2.4); t.name = 'relief-sisal'; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
