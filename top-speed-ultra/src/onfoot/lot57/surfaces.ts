// P1d's surfaces, painted in code at load (no downloaded textures): the Shed's painted brick and corrugated metal,
// gravel, umbrella canvas, brushed steel, flame cards and oil stains, and the normal maps (from painted height
// fields, tex.ts normalTex) that HD and Ultra put on the brick, the metal, the gravel, the wood, the concrete and
// the asphalt. Colours stay ours (Lot 57's palette, tex.ts PAL); every surface is white or grey where the vertex
// colour paints it.
import * as THREE from 'three';
import { canvasTex, rand } from './geom';
import { normalTex } from './tex';

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, seed: number, alpha: number, light = false, size = 2.2) {
  const r = rand(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,255,255,${r() * alpha})` : `rgba(0,0,0,${r() * alpha})`;
    const s = 0.8 + r() * size;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

// ------------------------------------------------------------------ the Shed: painted brick (3.2 m per repeat)
// 16 bricks across and 42 courses: about 0.2 m x 0.076 m. Painted over (white here, the vertex colour makes it our
// brick red): the paint pools in the joints, chips show raw brick and mortar, and the wall fades toward the top
const PB = { cols: 16, rows: 42 };
export const paintedBrickTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rand(301), bw = w / PB.cols, bh = h / PB.rows;
  g.fillStyle = '#c9c4bd'; g.fillRect(0, 0, w, h);                         // the joints: paint over mortar, a shade darker
  for (let row = 0; row < PB.rows; row++) for (let c = -1; c < PB.cols; c++) {
    const x = c * bw + (row % 2) * bw / 2, y = row * bh, k = 0.93 + r() * 0.07;
    g.fillStyle = `rgb(${250 * k | 0},${247 * k | 0},${243 * k | 0})`;
    g.fillRect(x + 1.2, y + 1.1, bw - 2.2, bh - 2);
  }
  // roller marks and soft mottling in the paint
  for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.035})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 70, 14 + r() * 40, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * w, 0, 5 + r() * 12, h); }
  // chips: the brick's own colour under the paint (darker than the paint, so they read through the vertex colour)
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, s = 2 + r() * 7;
    g.fillStyle = `rgba(${90 + r() * 30 | 0},${48 + r() * 14 | 0},${36 + r() * 10 | 0},0.55)`;
    g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.5), r() * 3, 0, 7); g.fill();
  }
  speckle(g, w, h, 9000, 302, 0.08);
}, { repeat: true });
export const paintedBrickNormal = () => normalTex(512, (g, w, h) => {
  const r = rand(303), bw = w / PB.cols, bh = h / PB.rows;
  g.fillStyle = '#303030'; g.fillRect(0, 0, w, h);
  for (let row = 0; row < PB.rows; row++) for (let c = -1; c < PB.cols; c++) {
    const x = c * bw + (row % 2) * bw / 2, y = row * bh, v = 0.82 + r() * 0.12;
    g.fillStyle = `rgb(${255 * v * 0.8 | 0},${255 * v * 0.8 | 0},${255 * v * 0.8 | 0})`; g.fillRect(x + 1, y + 1, bw - 2, bh - 1.8);
    g.fillStyle = `rgb(${255 * v | 0},${255 * v | 0},${255 * v | 0})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 3.6);
  }
  speckle(g, w, h, 14000, 304, 0.25);
}, 1.6);

// ------------------------------------------------------------------ corrugated metal (2 m per repeat, ribs across u)
// 26 ribs to 2 m (a 76 mm profile): white galvanised with a little weathering, streaks under the fixings
export const corrugatedTex = () => canvasTex(512, 512, (g, w, h) => {
  const r = rand(311), n = 26, p = w / n;
  for (let i = 0; i < n; i++) for (let x = 0; x < p; x++) {
    const s = Math.sin((x / p) * Math.PI * 2), v = 222 + s * 22;
    g.fillStyle = `rgb(${v | 0},${v | 0},${(v + 3) | 0})`; g.fillRect(i * p + x, 0, 1, h);
  }
  for (let i = 0; i < 14; i++) { const x = r() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,70,50,0.16)'); gr.addColorStop(1, 'rgba(90,70,50,0)'); g.fillStyle = gr; g.fillRect(x, r() * h * 0.5, 3 + r() * 6, h * 0.6); }
  for (const y of [0.18, 0.68]) for (let i = 0; i < n; i += 2) { g.fillStyle = 'rgba(40,40,44,0.5)'; g.beginPath(); g.arc(i * p + p * 0.25, y * h, 2, 0, 7); g.fill(); }
  speckle(g, w, h, 7000, 312, 0.07);
}, { repeat: true });
export const corrugatedNormal = () => normalTex(512, (g, w) => {
  const n = 26, p = w / n;
  for (let x = 0; x < w; x++) { const v = 128 + Math.sin(((x % p) / p) * Math.PI * 2) * 110; g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.fillRect(x, 0, 1, w); }
}, 3.2);

// ------------------------------------------------------------------ gravel (1.5 m per repeat)
export const gravelTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#8a8070'; g.fillRect(0, 0, w, h);
  const r = rand(321);
  for (let i = 0; i < 5200; i++) {
    const x = r() * w, y = r() * h, s = 2 + r() * 5, t = r();
    const c = t < 0.4 ? [196, 186, 168] : t < 0.7 ? [168, 156, 138] : t < 0.88 ? [142, 122, 100] : [212, 204, 190];
    const k = 0.75 + r() * 0.3;
    g.fillStyle = `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`;
    g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.25, s * 0.4, s * 0.3, 0, 0, 7); g.fill();
  }
}, { repeat: true });
export const gravelNormal = () => normalTex(512, (g, w, h) => {
  g.fillStyle = '#202020'; g.fillRect(0, 0, w, h);
  const r = rand(321);
  for (let i = 0; i < 5200; i++) {
    const x = r() * w, y = r() * h, s = 2 + r() * 5; r(); const k = r();
    const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(255,255,255,${0.7 + k * 0.3})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
  }
}, 2.6);

// ------------------------------------------------------------------ fabric: the umbrellas' canvas (1 m per repeat)
export const canvasWeaveTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.035 + ((y / 2) % 2) * 0.02})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + ((x / 2) % 2) * 0.02})`; g.fillRect(x, 0, 1, h); }
  speckle(g, w, h, 1800, 331, 0.05, false, 1.2);
  // a soft weathering bloom
  const r = rand(332);
  for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(80,70,50,${r() * 0.04})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, 7); g.fill(); }
}, { repeat: true });
export const canvasWeaveNormal = () => normalTex(256, (g, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 4) {
    const over = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) === 0, v = over ? 200 : 90;
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 4, 1);
  }
}, 0.9);

// ------------------------------------------------------------------ brushed stainless (kegs, heaters, the line)
export const brushedTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, w, h);
  const r = rand(341);
  for (let i = 0; i < 900; i++) { const y = r() * h; g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.08})`; g.fillRect(0, y, w, 0.6 + r()); }
}, { repeat: true });

// ------------------------------------------------------------------ the wood's grain as relief, and worn concrete
/** six boards per repeat with raised grain (matches tex.ts woodTex's layout) */
export const woodNormal = () => normalTex(512, (g, w, h) => {
  const r = rand(351), n = 6, bh = h / n;
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let b = 0; b < n; b++) {
    for (let i = 0; i < 60; i++) {
      const y = b * bh + r() * bh, v = 100 + r() * 90;
      g.strokeStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.lineWidth = 0.8 + r() * 2; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * (1 + r() * 2));
      g.stroke();
    }
    g.fillStyle = '#101010'; g.fillRect(0, b * bh, w, 3);
  }
}, 1.4);
/** concrete: pits, hairline cracks and the scored joints (the batch maps 4 m to a repeat, a joint per metre) */
export const concreteNormal = () => normalTex(512, (g, w, h) => {
  g.fillStyle = '#909090'; g.fillRect(0, 0, w, h);
  const r = rand(361);
  for (let i = 0; i < 2600; i++) { const v = r() < 0.5 ? 40 : 200; g.fillStyle = `rgba(${v},${v},${v},${0.3 + r() * 0.4})`; const s = 1 + r() * 2.5; g.fillRect(r() * w, r() * h, s, s); }
  g.strokeStyle = '#303030'; g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); }
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(40,40,40,0.8)'; g.lineWidth = 1; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
}, 1.3);
/** asphalt: aggregate relief and the sealed cracks (matches tex.ts asphaltTex's seed for the cracks) */
export const asphaltNormal = () => normalTex(512, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 22000, 371, 0.6, true, 2.2); speckle(g, w, h, 16000, 372, 0.5, false, 2.2);
  const r = rand(5);
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = 'rgba(20,20,20,0.9)'; g.lineWidth = 1.5 + r() * 2; g.beginPath();
    let x = r() * w, y = r() * h; g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 80; y += (r() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
}, 1.5);

// ------------------------------------------------------------------ sprites and decals
/** a flame tongue (additive): white-yellow at the root, orange, a red tip, soft edges */
export const flameTex = () => canvasTex(128, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (const [cx, sx, top, a] of [[0.5, 0.36, 0.05, 1], [0.34, 0.2, 0.3, 0.8], [0.68, 0.2, 0.22, 0.8]] as [number, number, number, number][]) {
    const x0 = cx * w, wd = sx * w;
    const gr = g.createLinearGradient(0, h, 0, top * h);
    gr.addColorStop(0, `rgba(255,236,170,${a})`); gr.addColorStop(0.25, `rgba(255,190,90,${a})`); gr.addColorStop(0.65, `rgba(240,100,30,${a * 0.8})`); gr.addColorStop(1, 'rgba(160,30,10,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - wd, h); g.quadraticCurveTo(x0 - wd * 1.1, h * 0.55, x0, top * h); g.quadraticCurveTo(x0 + wd * 1.1, h * 0.55, x0 + wd, h); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, w, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.2, 'rgba(0,0,0,1)'); fade.addColorStop(0.8, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, w, h);
}, {});
/** an oil stain (alpha only: black where the stain is), four variants across */
export const stainTex = () => canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  const r = rand(381);
  for (let k = 0; k < 4; k++) {
    const cx = k * 64 + 32, cy = 32;
    for (let i = 0; i < 9; i++) {
      const gr = g.createRadialGradient(cx + (r() - 0.5) * 22, cy + (r() - 0.5) * 22, 0, cx, cy, 10 + r() * 16);
      gr.addColorStop(0, `rgba(0,0,0,${0.25 + r() * 0.3})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(k * 64, 0, 64, 64);
    }
  }
  // (alpha comes from the inverse of the luminance in the material: alphaMap reads green)
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - d[i]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}, { srgb: false });

/** set the anisotropy of every texture on the materials under root (a re-upload where it changes) */
export function setAnisotropy(root: THREE.Object3D, aniso: number) {
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || Array.isArray(m)) return;
    for (const t of [m.map, m.normalMap, m.emissiveMap, m.roughnessMap]) {
      if (!t || seen.has(t) || (t as THREE.DataTexture).isDataTexture || (t as THREE.Texture).isRenderTargetTexture) continue;
      seen.add(t);
      if (t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; }
    }
  });
  return seen.size;
}
