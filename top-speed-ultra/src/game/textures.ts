// Every surface texture is painted in code at load time: no image files to download.

import * as THREE from 'three';
import { tfbm, tnoise, rng, clamp } from './util';

let SIZE = 1024;
let ANISO = 8;
export function configureTextures(size: number, maxAniso: number) { SIZE = size; ANISO = Math.min(16, maxAniso); }

type Ctx = CanvasRenderingContext2D;
function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: false })!];
}
function tex(c: HTMLCanvasElement, srgb: boolean, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = ANISO;
  return t;
}
// a tangent-space normal map from a height field (wraps at the edges)
function normalMap(h: Float32Array, w: number, hh: number, strength: number) {
  const [c, g] = mk(w, hh), img = g.createImageData(w, hh), d = img.data;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
    const u = h[((y - 1 + hh) % hh) * w + x], dn = h[((y + 1) % hh) * w + x];
    let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}

const memo = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  if (!memo.has(key)) memo.set(key, make());
  return memo.get(key) as T;
}

export interface PBR { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture }

// Freeway asphalt, one lane wide: aggregate, darker polished wheel paths, tar-sealed cracks, oil down the middle.
export function asphalt(): PBR {
  return once('asphalt', () => {
    const n = Math.min(SIZE, 1024), r = rng(11);
    const [c, g] = mk(n, n), [rc, rg] = mk(n, n);
    const img = g.createImageData(n, n), d = img.data, rimg = rg.createImageData(n, n), rd = rimg.data;
    const height = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const grain = tnoise(x * 0.9, y * 0.9, n * 0.9, 3);
      const coarse = tfbm(u * 8, v * 8, 8, 4, 5);
      const path = Math.exp(-Math.pow((u - 0.28) / 0.07, 2)) + Math.exp(-Math.pow((u - 0.72) / 0.07, 2));
      const oil = Math.exp(-Math.pow((u - 0.5) / 0.05, 2)) * (0.5 + 0.5 * tfbm(u * 4, v * 16, 4, 3, 9));
      let lum = 0.36 + (coarse - 0.5) * 0.12 + (grain - 0.5) * 0.16 - path * 0.05 - oil * 0.06;
      const stone = grain > 0.86 ? (grain - 0.86) * 2.2 : 0;
      lum += stone;
      const i = (y * n + x) * 4;
      d[i] = clamp(lum * 255 * 1.0, 0, 255); d[i + 1] = clamp(lum * 255 * 0.99, 0, 255); d[i + 2] = clamp(lum * 255 * 0.97, 0, 255); d[i + 3] = 255;
      const rough = clamp(0.92 - path * 0.18 - oil * 0.2 + (grain - 0.5) * 0.1, 0.35, 1);
      rd[i] = rd[i + 1] = rd[i + 2] = rough * 255; rd[i + 3] = 255;
      height[y * n + x] = grain * 0.7 + coarse * 0.3 + stone;
    }
    g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
    // tar-sealed cracks: dark, smooth, wandering lines
    for (let k = 0; k < 9; k++) {
      let x = r() * n, y = r() * n, a = r() * Math.PI * 2;
      g.strokeStyle = 'rgba(18,18,20,0.75)'; rg.strokeStyle = 'rgba(90,90,90,1)';
      g.lineWidth = rg.lineWidth = 2 + r() * 4;
      g.beginPath(); rg.beginPath(); g.moveTo(x, y); rg.moveTo(x, y);
      for (let s = 0; s < 40; s++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); rg.lineTo(x, y); }
      g.stroke(); rg.stroke();
    }
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 2.2), roughnessMap: tex(rc, false) };
  });
}

// shoulder asphalt: older, lighter, no wheel paths, with grit
export function shoulder(): PBR {
  return once('shoulder', () => {
    const n = 512, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const grain = tnoise(x * 0.8, y * 0.8, n * 0.8, 21), coarse = tfbm(x / n * 6, y / n * 6, 6, 4, 22);
      const lum = 0.42 + (coarse - 0.5) * 0.16 + (grain - 0.5) * 0.18;
      const i = (y * n + x) * 4;
      d[i] = lum * 255; d[i + 1] = lum * 250; d[i + 2] = lum * 242; d[i + 3] = 255;
      height[y * n + x] = grain;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 2) };
  });
}

// cast concrete: barriers, overpasses, pillars
export function concrete(): PBR {
  return once('concrete', () => {
    const n = 512, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const f = tfbm(u * 6, v * 6, 6, 5, 31), pores = tnoise(x * 0.7, y * 0.7, n * 0.7, 32);
      const streak = tfbm(u * 24, v * 1.5, 24, 3, 33);
      const lum = 0.7 + (f - 0.5) * 0.18 - (streak > 0.62 ? (streak - 0.62) * 0.5 : 0) - (pores > 0.92 ? 0.12 : 0);
      const i = (y * n + x) * 4;
      d[i] = lum * 255; d[i + 1] = lum * 250; d[i + 2] = lum * 240; d[i + 3] = 255;
      height[y * n + x] = f * 0.6 + pores * 0.4;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 1.4) };
  });
}

// Portland cement concrete lanes (the 405, the 5, the 55, the 57, the 91, the 22): one lane wide by one slab long.
// Light grey-beige slabs with a sealed, slightly skewed transverse joint, the longitudinal joint at the lane edge,
// diamond-ground tining, darker polished wheel paths, an oil line, hairline cracks and a patch.
export const SLAB = 4.57;
export function pcc(): PBR {
  return once('pcc', () => {
    const n = Math.min(SIZE, 1024), r = rng(41);
    const [c, g] = mk(n, n), [rc, rg] = mk(n, n);
    const img = g.createImageData(n, n), d = img.data, rimg = rg.createImageData(n, n), rd = rimg.data;
    const height = new Float32Array(n * n);
    const skew = 0.06 * n;                                 // the joints run a little off square, as Caltrans saws them
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const grain = tnoise(x * 1.1, y * 1.1, n * 1.1, 42);
      const coarse = tfbm(u * 5, v * 5, 5, 4, 43);
      const mottle = tfbm(u * 2, v * 2, 2, 3, 44);
      const tine = 0.5 + 0.5 * Math.sin((y / 4.5) * Math.PI * 2);        // grooves about 2 cm apart
      const path = Math.exp(-(((u - 0.28) / 0.08) ** 2)) + Math.exp(-(((u - 0.72) / 0.08) ** 2));
      const oil = Math.exp(-(((u - 0.5) / 0.04) ** 2)) * (0.4 + 0.6 * tfbm(u * 4, v * 8, 4, 3, 45));
      const jy = (((y - u * skew) % n) + n) % n, tj = Math.min(jy, n - jy), lj = Math.min(x, n - x);
      const joint = Math.max(tj < 3 ? 1 : tj < 7 ? 0.35 : 0, lj < 2 ? 1 : lj < 5 ? 0.3 : 0);
      let lum = 0.58 + (mottle - 0.5) * 0.08 + (coarse - 0.5) * 0.07 + (grain - 0.5) * 0.09 - path * 0.05 - oil * 0.05 - tine * 0.015;
      lum -= joint * 0.26;
      const i = (y * n + x) * 4;
      d[i] = clamp(lum * 255 * 1.02, 0, 255); d[i + 1] = clamp(lum * 255, 0, 255); d[i + 2] = clamp(lum * 255 * 0.94, 0, 255); d[i + 3] = 255;
      const rough = clamp(0.86 - path * 0.14 - oil * 0.12 + (grain - 0.5) * 0.08 + joint * 0.1, 0.4, 1);
      rd[i] = rd[i + 1] = rd[i + 2] = rough * 255; rd[i + 3] = 255;
      height[y * n + x] = grain * 0.35 + coarse * 0.25 + tine * 0.25 - joint * 0.8;
    }
    g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
    g.strokeStyle = 'rgba(40,38,36,0.45)'; g.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      let x = r() * n, y = r() * n, a = r() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 30; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
      g.stroke();
    }
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 1.6), roughnessMap: tex(rc, false) };
  });
}

// a masonry sound wall: split-face block in running bond, tan, 0.2 m courses of 0.4 m blocks; one tile is 4 m by
// 4 m with the height along u (the wall strip's u runs up the face) and the road along v
export function blockWall(): PBR {
  return once('blockWall', () => {
    const n = 512, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    const bh = n / 20, bw = n / 10;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const course = Math.floor(x / bh), xx = x - course * bh;
      const yo = (y + (course % 2) * (bw / 2)) % n, by = Math.floor(yo / bw), yy = yo - by * bw;
      const mortar = xx < 2 || yy < 2;
      const face = tnoise(x * 1.3, y * 1.3, n * 1.3, 51), split = tfbm((x / n) * 10, (y / n) * 10, 10, 4, 52);
      const tint = tfbm((by * 0.37 + course * 0.11) % 1, (course * 0.23) % 1, 1, 1, 53);
      const lum = mortar ? 0.72 : 0.62 + (tint - 0.5) * 0.14 + (split - 0.5) * 0.14 + (face - 0.5) * 0.1;
      const i = (y * n + x) * 4;
      d[i] = clamp(lum * 255, 0, 255); d[i + 1] = clamp(lum * 255 * 0.9, 0, 255); d[i + 2] = clamp(lum * 255 * 0.74, 0, 255); d[i + 3] = 255;
      height[y * n + x] = mortar ? 0 : 0.5 + (split - 0.5) * 0.8 + (face - 0.5) * 0.3;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 2.4) };
  });
}

// roadside ground: dry Southern California grass and dirt, tinted further by vertex colour
export function ground(): PBR {
  return once('ground', () => {
    const n = 512, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const f = tfbm(u * 5, v * 5, 5, 5, 41), blade = tnoise(x * 1.3, y * 0.35, n * 1.3, 42);
      const dirt = Math.min(1, Math.max(0, (0.46 - f) * 6));          // soft patches of bare earth
      const i = (y * n + x) * 4;
      const l = 0.84 + (blade - 0.5) * 0.32;
      d[i] = (170 - dirt * 14) * l; d[i + 1] = (154 - dirt * 22) * l; d[i + 2] = (104 - dirt * 6) * l; d[i + 3] = 255;
      height[y * n + x] = blade * 0.7 + f * 0.3;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 3) };
  });
}

// 2x2 twill carbon fibre with rounded tows; looks right under a clear coat
export function carbon(): PBR {
  return once('carbon', () => {
    const n = 512, tow = 16, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i0 = Math.floor(x / tow), j0 = Math.floor(y / tow);
      const horiz = ((i0 + j0) & 3) < 2;
      const fx = (x % tow) / tow, fy = (y % tow) / tow;
      const across = horiz ? fy : fx, along = horiz ? fx : fy;
      const round = Math.sin(across * Math.PI);
      const fibre = 0.5 + 0.5 * Math.sin((horiz ? y : x) * 2.6 + tnoise(x * 0.3, y * 0.3, n * 0.3, 51) * 3);
      const lum = 0.06 + round * 0.1 + fibre * 0.035 + (horiz ? 0.025 : 0);
      const i = (y * n + x) * 4;
      d[i] = lum * 255; d[i + 1] = lum * 255; d[i + 2] = lum * 262; d[i + 3] = 255;
      height[y * n + x] = round * 0.8 + along * 0.05;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 1.2) };
  });
}

// pebbled leather grain (neutral: the material colour tints it black or tan)
export function leather(): PBR {
  return once('leather', () => {
    const n = 512, [c, g] = mk(n, n), img = g.createImageData(n, n), d = img.data, height = new Float32Array(n * n);
    const cells = 26, r = rng(61), pts: [number, number][] = [];
    for (let i = 0; i < cells * cells; i++) pts.push([((i % cells) + r()) / cells, (Math.floor(i / cells) + r()) / cells]);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n, ci = Math.floor(u * cells), cj = Math.floor(v * cells);
      let best = 9, second = 9;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ii = (ci + a + cells) % cells, jj = (cj + b + cells) % cells, p = pts[jj * cells + ii];
        // the neighbour's point, shifted by whole tiles so the grain wraps without a seam
        const px = p[0] + (ci + a - ii) / cells, py = p[1] + (cj + b - jj) / cells;
        const dist = Math.hypot(u - px, v - py);
        if (dist < best) { second = best; best = dist; } else if (dist < second) second = dist;
      }
      const edge = clamp((second - best) * cells * 2.4, 0, 1);
      const lum = 0.86 + edge * 0.1 + (tnoise(x * 0.5, y * 0.5, n * 0.5, 62) - 0.5) * 0.05;
      const i = (y * n + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = lum * 255; d[i + 3] = 255;
      height[y * n + x] = edge;
    }
    g.putImageData(img, 0, 0);
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 1.6) };
  });
}

// a clean car-paint flake normal is overkill; this is a soft orange-peel for the clear coat
export function paintPeel(): THREE.Texture {
  return once('peel', () => {
    const n = 256, h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = tfbm(x / n * 16, y / n * 16, 16, 2, 71);
    return normalMap(h, n, n, 0.6);
  });
}

// palm trunk: the leaf-base scars, a spiral lattice of diamonds under horizontal ring grooves (8 a repeat)
export function bark(): THREE.Texture {
  return once('bark', () => {
    const w = 128, h = 256, [c, g] = mk(w, h), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = Math.sin((x / w) * Math.PI * 6 + (y / h) * Math.PI * 4), b = Math.sin((x / w) * Math.PI * 6 - (y / h) * Math.PI * 4);
      const lattice = 0.5 + 0.5 * a * b;
      const ry = y % 32, groove = ry < 5 ? 0.6 : ry < 9 ? 1.1 : 1;              // a dark groove with a lighter lip above it
      const fibre = (tnoise(x * 0.5, y * 0.25, 64, 81) - 0.5) * 0.22 + (tnoise(x * 0.125, y * 0.0625, 16, 82) - 0.5) * 0.16;
      const l = (0.76 + lattice * 0.24 + fibre) * groove;
      const i = (y * w + x) * 4;
      d[i] = 134 * l; d[i + 1] = 116 * l; d[i + 2] = 96 * l; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, true);
  });
}

// Palm fronds on a transparent background, both in one texture: a live pinnate frond in the left half (a bare
// petiole, a pale midrib that tapers to the tip, and lance-shaped leaflets angled toward the tip, drooping at their
// ends, with gaps between them) and a dead, straw-brown one in the right half whose leaflets hang along it. A strip
// across the top, above both cards' UVs, is the fibrous brown of the crown shaft the fronds grow from. The RGB is
// painted everywhere so the transparent gaps don't darken the mip-maps' edges, and the blade's envelope keeps a low
// alpha floor so a far mip-map still clears the alpha test as a solid frond instead of dissolving.
// A live card is 1.5 m wide and 2.9-3.8 m long, so a leaflet drawn at (dx, dy) pixels in this 256-pixel-wide half
// lies at about (dx, 1.2 dy) on the card: the leaflets leave the midrib at about 45 degrees.
export function frond(): THREE.Texture {
  return once('frond', () => {
    const n = 512, [c, g] = mk(n, n), [mc, mg] = mk(n, n), r = rng(91);
    g.fillStyle = '#5b7a39'; g.fillRect(0, 0, n / 2, n); g.fillStyle = '#8a7049'; g.fillRect(n / 2, 0, n / 2, n);
    mg.fillStyle = '#000'; mg.fillRect(0, 0, n, n);
    // a quadratic stroke whose width follows w(t), drawn as a polygon on both canvases (its colour, and white on
    // the alpha mask); `vein` adds a lighter centre line
    const stroke = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, w: (t: number) => number, col: string, vein?: string) => {
      const L: [number, number][] = [], R: [number, number][] = [], C: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, mt = 1 - t, x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
        const dx = 2 * mt * (x1 - x0) + 2 * t * (x2 - x1), dy = 2 * mt * (y1 - y0) + 2 * t * (y2 - y1), len = Math.hypot(dx, dy) || 1;
        const hw = w(t) / 2, nx = -dy / len * hw, ny = dx / len * hw;
        L.push([x + nx, y + ny]); R.push([x - nx, y - ny]); C.push([x, y]);
      }
      for (const [ctx, fill] of [[g, col], [mg, '#fff']] as const) {
        ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
        for (const [x, y] of L.slice(1)) ctx.lineTo(x, y);
        for (let k = R.length - 1; k >= 0; k--) ctx.lineTo(R[k][0], R[k][1]);
        ctx.closePath(); ctx.fill();
      }
      if (vein) { g.strokeStyle = vein; g.lineWidth = 1; g.beginPath(); g.moveTo(C[0][0], C[0][1]); for (const [x, y] of C.slice(1, 8)) g.lineTo(x, y); g.stroke(); }
    };
    const leaf = (cx: number, dead: boolean) => {
      const base = 506, blade0 = 404, tip = 52;
      // the leaflets' length along the blade (t = 0 at its base, 1 at the tip): longest 40% of the way up
      const lenAt = (t: number) => (dead ? 0.8 : 1) * (28 + 96 * Math.sin(Math.PI * Math.pow(0.04 + t * 0.96, 0.76)));
      // where a leaflet of length l ends, relative to where it leaves the rachis
      const reach = (l: number): [number, number] => (dead ? [l * 0.6, -l * 0.6] : [l * 0.95, -l * 0.3]);
      // the blade's envelope on the mask, at a low alpha: solid at a distance, cut away between the leaflets up close
      mg.fillStyle = 'rgb(46,46,46)'; mg.beginPath(); mg.moveTo(cx, blade0 + 4);
      for (let k = 0; k <= 24; k++) { const t = k / 24, y = blade0 - (blade0 - tip) * t, [ex, ey] = reach(lenAt(t) * 0.92); mg.lineTo(cx + ex, y + ey); }
      mg.lineTo(cx, tip - 10);
      for (let k = 24; k >= 0; k--) { const t = k / 24, y = blade0 - (blade0 - tip) * t, [ex, ey] = reach(lenAt(t) * 0.92); mg.lineTo(cx - ex, y + ey); }
      mg.closePath(); mg.fill();
      const step = dead ? 9 : 12;
      for (let y0 = blade0 - 2; y0 > tip + 2; y0 -= step) {
        for (const s of [-1, 1]) {
          const y = y0 - (s > 0 ? step / 2 : 0), t = (blade0 - y) / (blade0 - tip);         // the two rows alternate
          if (t > 1 || (dead && r() < 0.18)) continue;                                      // dead ones lose leaflets
          const l = lenAt(t) * (0.88 + r() * 0.24), [ex, ey] = reach(l), j = (r() - 0.5) * 10;
          if (dead) {
            const col = r() < 0.2 ? `rgb(${116 + r() * 16 | 0},${108 + r() * 12 | 0},${94 + r() * 10 | 0})` : `rgb(${124 + r() * 36 | 0},${100 + r() * 26 | 0},${64 + r() * 20 | 0})`;
            stroke(cx + s, y, cx + s * ex * 0.6, y + ey * 0.4, cx + s * ex, y + ey + j, (u) => 1 + 3.2 * Math.sin(Math.PI * Math.pow(u, 0.7)), col);
          } else {
            const yellow = r() < 0.05, sh = r();
            const col = yellow ? `rgb(${104 + sh * 20 | 0},${124 + sh * 16 | 0},${50 + sh * 12 | 0})` : `rgb(${50 + sh * 36 | 0},${96 + sh * 40 | 0},${32 + sh * 22 | 0})`;
            stroke(cx + s * 2, y, cx + s * ex * 0.5, y + ey * 1.45, cx + s * ex, y + ey + j, (u) => 1 + 5.6 * Math.sin(Math.PI * Math.pow(u, 0.62)), col,
              yellow ? undefined : `rgba(190,205,120,${0.25 + sh * 0.2})`);
          }
        }
      }
      // the petiole and the midrib over the leaflets' roots
      stroke(cx, base, cx, (base + blade0) / 2, cx, blade0, (u) => 10 - u * 3, dead ? '#7c6345' : '#87864f');
      stroke(cx, blade0, cx, (blade0 + tip) / 2, cx, tip - 6, (u) => 7 - u * 5.5, dead ? '#9b8257' : '#b4b86a');
    };
    leaf(128, false); leaf(384, true);
    // the crown shaft's strip: fibrous brown, solid
    g.fillStyle = '#5c4b34'; g.fillRect(0, 0, n, 24); mg.fillStyle = '#fff'; mg.fillRect(0, 0, n, 24);
    for (let x = 0; x < n; x += 2) { g.fillStyle = `rgba(${r() < 0.5 ? '40,30,20' : '130,110,80'},${0.15 + r() * 0.3})`; g.fillRect(x, 0, 1 + (r() * 2 | 0), 24); }
    const img = g.getImageData(0, 0, n, n), mask = mg.getImageData(0, 0, n, n).data, d = img.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = mask[i];
    // the texture is the ImageData itself, not the canvas: a canvas keeps premultiplied colour, so putting this back
    // on it would turn every transparent texel black, and the mip-maps would darken the fronds' edges
    c.width = mc.width = 1;                                                                                  // free both canvases
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  });
}

// stucco walls with a window grid (beige or office glass), one cell = one storey x one bay
export function facade(kind: 0 | 1 | 2): THREE.Texture {
  return once('facade' + kind, () => {
    const n = 256, [c, g] = mk(n, n), r = rng(100 + kind);
    const wall = ['#d9cbb2', '#e8e4dc', '#9fb1c2'][kind], glass = ['#3d4b5a', '#566676', '#2b3d52'][kind];
    g.fillStyle = wall; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * n, r() * n, 2, 2); }
    if (kind === 2) {                               // curtain wall
      g.fillStyle = glass; g.fillRect(0, 0, n, n);
      g.strokeStyle = '#c9d3dc'; g.lineWidth = 6;
      for (let k = 0; k <= n; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); }
      const sky = g.createLinearGradient(0, 0, n, n); sky.addColorStop(0, 'rgba(200,225,250,.35)'); sky.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sky; g.fillRect(0, 0, n, n);
    } else {
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
        const x0 = xx * 128 + 30, y0 = yy * 128 + 34;
        g.fillStyle = glass; g.fillRect(x0, y0, 68, 58);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, y0, 68, 14);
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x0 - 4, y0 + 58, 76, 6);
      }
    }
    return tex(c, true);
  });
}

// lens flare sprites: a soft warm glow for the sun itself, and a hollow ring for the ghosts down the lens axis
export function flareGlow(): THREE.Texture {
  return once('flareGlow', () => {
    const n = 256, [c, g] = mk(n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,250,240,1)'); gr.addColorStop(0.1, 'rgba(255,242,220,0.9)'); gr.addColorStop(0.3, 'rgba(255,218,165,0.28)'); gr.addColorStop(0.6, 'rgba(255,205,150,0.07)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
export function flareGhost(): THREE.Texture {
  return once('flareGhost', () => {
    const n = 128, [c, g] = mk(n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.09)'); gr.addColorStop(0.86, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.95, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// soft cumulus on a transparent sky layer
export function clouds(): THREE.Texture {
  return once('clouds', () => {
    const w = 1024, h = 512, [c, g] = mk(w, h), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const f = tfbm(x / w * 6, y / h * 3, 6, 6, 111);
      const band = Math.sin((y / h) * Math.PI);
      const a = clamp((f - 0.5) * 3.2, 0, 1) * band;
      const i = (y * w + x) * 4;
      const shade = 235 + (f - 0.5) * 30;
      d[i] = shade; d[i + 1] = shade; d[i + 2] = shade + 8; d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    const t = tex(c, true); t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// red stitching: dashes on a transparent strip
export function stitch(): THREE.Texture {
  return once('stitch', () => {
    const [c, g] = mk(64, 8); g.clearRect(0, 0, 64, 8);
    g.fillStyle = '#c0141c'; for (let x = 4; x < 64; x += 16) g.fillRect(x, 1, 10, 6);
    const t = tex(c, true); t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// a Caltrans-style guide sign
export function sign(lines: { route?: string; name: string; sub: string; exit?: string }): THREE.Texture {
  return once('sign' + JSON.stringify(lines), () => {
    const w = 1024, h = 512, [c, g] = mk(w, h);
    g.fillStyle = '#0a6a3a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f4f4ee'; g.lineWidth = 12; roundRect(g, 16, 16, w - 32, h - 32, 26); g.stroke();
    g.fillStyle = '#f4f4ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const font = (wt: number, px: number) => `${wt} ${px}px "Saira Semi Condensed", "Arial Narrow", Arial, sans-serif`;
    let y = 110;
    if (lines.exit) {
      g.fillRect(w - 330, 0, 300, 84); g.fillStyle = '#0a6a3a'; g.font = font(700, 54); g.fillText(lines.exit, w - 180, 48); g.fillStyle = '#f4f4ee';
      y = 150;
    }
    if (lines.route) {
      g.font = font(800, 74); g.fillText(lines.route, w / 2, y); y += 110;
    }
    g.font = font(700, lines.route ? 92 : 110); fitText(g, lines.name, w / 2, y + (lines.route ? 10 : 40), w - 120);
    g.font = font(700, 70); g.fillText(lines.sub, w / 2, h - 90);
    const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
function fitText(g: Ctx, text: string, x: number, y: number, max: number) {
  const m = g.measureText(text).width;
  if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, x, y);
}
export function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// small labelled textures: the start button, a can, button icons
export function label(key: string, w: number, h: number, draw: (g: Ctx, w: number, h: number) => void, srgb = true): THREE.Texture {
  return once('label' + key, () => {
    const [c, g] = mk(w, h); draw(g, w, h);
    const t = tex(c, srgb); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
