// Every surface texture is painted in code at load time: no image files to download.

import * as THREE from 'three';
import { tfbm, tnoise, rng, clamp, smoothstep } from './util';

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
// a tangent-space normal map from a height field (wraps at the edges); sy scales the slopes along y for a texture
// whose texels are longer than they are wide
function normalMap(h: Float32Array, w: number, hh: number, strength: number, sy = strength) {
  const [c, g] = mk(w, hh), img = g.createImageData(w, hh), d = img.data;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
    const u = h[((y - 1 + hh) % hh) * w + x], dn = h[((y + 1) % hh) * w + x];
    let nx = (l - r) * strength, ny = (dn - u) * sy, nz = 1;
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

// a broad, tileable field (wear, mottle) sampled on a coarse cu x cv grid and read back bilinearly, so it costs a few
// operations a texel instead of a noise call per octave (a 1024 texture has a million texels)
function coarse(cu: number, cv: number, f: (u: number, v: number) => number) {
  const g = new Float32Array(cu * cv);
  for (let j = 0; j < cv; j++) for (let i = 0; i < cu; i++) g[j * cu + i] = f(i / cu, j / cv);
  return (u: number, v: number) => {
    const x = u * cu, y = v * cv, i0 = Math.floor(x), j0 = Math.floor(y), fx = x - i0, fy = y - j0;
    const i = ((i0 % cu) + cu) % cu, j = ((j0 % cv) + cv) % cv, i1 = (i + 1) % cu, j1 = (j + 1) % cv;
    const a = g[j * cu + i] + (g[j * cu + i1] - g[j * cu + i]) * fx, b = g[j1 * cu + i] + (g[j1 * cu + i1] - g[j1 * cu + i]) * fx;
    return a + (b - a) * fy;
  };
}

// strokes or fills what draw() paints nine times, a tile over each way, so a mark leaving one edge comes back at the
// opposite one (w and h in the context's current units)
function wrapped(g: Ctx, w: number, h: number, draw: () => void) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.save(); g.translate(ox, oy); draw(); g.restore(); }
}

// Freeway asphalt, one lane wide and two lane-widths long (the textures repeat 0.5 along v, so a texel is 3.6 mm
// across and 7.2 mm along; the marks are drawn with the y axis at half scale): aggregate, tyre rubber darkening the
// two wheel paths, an oil line, hairline cracks and tar snakes (crack sealant: the joint beside the lane line sealed
// its whole length, and a few meandering ones). The roughness eases only a little in the wheel paths, broad and
// patchy, so a low sun's glare spreads over the lane instead of drawing a bright line down each wheel path.
export function asphalt(): PBR {
  return once('asphalt', () => {
    const n = Math.min(SIZE, 1024), r = rng(11), k = n / 1024;
    const [c, g] = mk(n, n), [rc, rg] = mk(n, n);
    // the tar snakes first, as a mask on a CPU canvas (it's read back once)
    const mc = document.createElement('canvas'); mc.width = mc.height = n;
    const mg = mc.getContext('2d', { willReadFrequently: true })!;
    mg.fillStyle = '#000'; mg.fillRect(0, 0, n, n);
    mg.setTransform(1, 0, 0, 0.5, 0, 0); mg.strokeStyle = '#fff'; mg.lineCap = mg.lineJoin = 'round';
    const snake = (pts: [number, number][], w0: number) => wrapped(mg, n, 2 * n, () => {
      for (let s = 1; s < pts.length; s++) {
        mg.lineWidth = w0 * (0.75 + 0.5 * Math.abs(Math.sin(s * 0.7 + w0)));
        mg.beginPath(); mg.moveTo(pts[s - 1][0], pts[s - 1][1]); mg.lineTo(pts[s][0], pts[s][1]); mg.stroke();
      }
    });
    const seal: [number, number][] = [];
    for (let Y = 0; Y <= 2 * n; Y += 16 * k) seal.push([n * 0.028 + 5 * k * Math.sin((Y / n) * Math.PI * 2 + 1.3) + 3 * k * Math.sin((Y / n) * Math.PI * 7 + 0.4), Y]);
    snake(seal, 11 * k);
    for (let m = 0; m < 3; m++) {
      let x = r() * n, Y = r() * 2 * n, a = (m === 0 ? Math.PI / 2 : 0) + (r() - 0.5) * 0.8;
      const pts: [number, number][] = [[x, Y]], steps = (m === 0 ? 40 : 18) + Math.floor(r() * 14), w0 = (9 + r() * 5) * k;
      let fork: [number, number, number] | null = null;
      for (let s = 0; s < steps; s++) {
        a += (r() - 0.5) * 0.5; x += Math.cos(a) * 10 * k; Y += Math.sin(a) * 10 * k; pts.push([x, Y]);
        if (m === 1 && s === 12) fork = [x, Y, a + 0.9];
      }
      snake(pts, w0);
      if (fork) {
        let [fx, fY, fa] = fork; const br: [number, number][] = [[fx, fY]];
        for (let s = 0; s < 16; s++) { fa += (r() - 0.5) * 0.5; fx += Math.cos(fa) * 10 * k; fY += Math.sin(fa) * 10 * k; br.push([fx, fY]); }
        snake(br, w0 * 0.75);
      }
    }
    const md = mg.getImageData(0, 0, n, n).data; mc.width = 1;
    const img = g.createImageData(n, n), d = img.data, rimg = rg.createImageData(n, n), rd = rimg.data;
    const height = new Float32Array(n * n);
    const wearF = coarse(64, 128, (u, v) => tfbm(u * 3, v * 12, 3, 3, 6)), patchF = coarse(64, 128, (u, v) => tfbm(u * 6, v * 12, 6, 3, 8));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n, i = (y * n + x) * 4;
      const grain = tnoise(x * 0.9, y * 1.8, n * 0.9, 3);
      const coarse = tfbm(u * 8, v * 16, 8, 4, 5);
      // tyre rubber: two broad, soft bands, heavier in places
      const wear = 0.65 + 0.7 * wearF(u, v);
      const path = (Math.exp(-(((u - 0.28) / 0.09) ** 2)) + Math.exp(-(((u - 0.72) / 0.09) ** 2))) * wear;
      const oil = Math.exp(-(((u - 0.5) / 0.06) ** 2)) * (0.4 + 0.6 * tfbm(u * 4, v * 32, 4, 3, 9));
      const patch = patchF(u, v);
      const tar = md[i] / 255, stone = grain > 0.86 ? (grain - 0.86) * 2.2 : 0;
      let lum = 0.36 + (coarse - 0.5) * 0.12 + (grain - 0.5) * 0.16 - path * 0.06 - oil * 0.06 + stone;
      lum = lum * (1 - tar) + (0.16 + (grain - 0.5) * 0.1 + (coarse - 0.5) * 0.04) * tar;      // sealant, dusted with grit
      d[i] = clamp(lum * 255, 0, 255); d[i + 1] = clamp(lum * 255 * 0.99, 0, 255); d[i + 2] = clamp(lum * 255 * (0.97 + path * 0.015), 0, 255); d[i + 3] = 255;
      const rough = clamp(0.92 - path * 0.05 - oil * 0.05 + (grain - 0.5) * 0.1 + (patch - 0.5) * 0.16, 0.6, 1) * (1 - tar) + 0.66 * tar;
      rd[i] = rd[i + 1] = rd[i + 2] = rough * 255; rd[i + 3] = 255;
      height[y * n + x] = (grain * 0.7 + coarse * 0.3 + stone) * (1 - tar) + 0.62 * tar;
    }
    g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
    // hairline cracks not yet sealed: thin, dark, and a little rougher with the grit in them
    g.setTransform(1, 0, 0, 0.5, 0, 0); rg.setTransform(1, 0, 0, 0.5, 0, 0);
    g.strokeStyle = 'rgba(22,22,24,0.5)'; rg.strokeStyle = 'rgba(255,255,255,0.3)';
    for (let m = 0; m < 6; m++) {
      let x = r() * n, Y = r() * 2 * n, a = r() * Math.PI * 2;
      const pts: [number, number][] = [[x, Y]];
      for (let s = 0; s < 30; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 8 * k; Y += Math.sin(a) * 8 * k; pts.push([x, Y]); }
      g.lineWidth = rg.lineWidth = (1.5 + r() * 1.5) * k;
      for (const cx of [g, rg]) wrapped(cx, n, 2 * n, () => { cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) cx.lineTo(p[0], p[1]); cx.stroke(); });
    }
    const nm = normalMap(height, n, n, 2.2, 1.1); nm.repeat.set(1, 0.5);
    return { map: tex(c, true, 1, 0.5), normalMap: nm, roughnessMap: tex(rc, false, 1, 0.5) };
  });
}

// Shoulders: two textures side by side, each SHOULDER_U metres wide, u running out from the travel lanes' edge (the
// strip's u is the distance from the edge / (2 x SHOULDER_U)): the freeways' in the left half, the ramps' from 0.5.
// v runs along the road, SHOULDER_V metres a tile. Older asphalt than the lanes, oxidised lighter and browner and
// gritty, dust gathering toward the outer edge, a sealed transverse crack or two and a few oil drips. The freeways'
// half adds the sealed joint where the concrete lane meets the asphalt and a ground-in rumble strip (0.18 m dips
// every 0.3 m in a 0.4 m band from 0.3 m out); ramps have neither. Roads.ts gives a freeway shoulder the ramps' half
// where a ramp runs alongside (the barrier is open there), so the rumble strip stops at every exit and entrance.
export const SHOULDER_U = 4, SHOULDER_V = 6;
export function shoulder(): PBR {
  return once('shoulder', () => {
    const W = SIZE >= 1024 ? 1024 : 512, H = W / 2, hw = W / 2, pu = hw / SHOULDER_U, pv = H / SHOULDER_V, k = W / 1024, r = rng(23);
    const [c, g] = mk(W, H), img = g.createImageData(W, H), d = img.data, height = new Float32Array(W * H);
    // the sealant first, as a mask (white = crack sealant): a transverse crack most of the way across each half and
    // a shorter one, wandering, drawn wrapped along v
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
    const mg = mc.getContext('2d', { willReadFrequently: true })!;
    mg.fillStyle = '#000'; mg.fillRect(0, 0, W, H); mg.strokeStyle = '#fff'; mg.lineCap = mg.lineJoin = 'round';
    for (const x0 of [0, hw]) for (const [reach, w0] of [[0.92, 4.5], [0.4, 3.5]]) {
      let x = x0 + 3 * k, y = r() * H, a = 0;
      const pts: [number, number][] = [[x, y]];
      while (x < x0 + hw * reach) { a = clamp(a + (r() - 0.5) * 0.6, -0.45, 0.45); x += Math.cos(a) * 7 * k; y += Math.sin(a) * 5 * k; pts.push([x, y]); }
      mg.lineWidth = w0 * k;
      wrapped(mg, 0, H, () => { mg.beginPath(); mg.moveTo(pts[0][0], pts[0][1]); for (const p of pts) mg.lineTo(p[0], p[1]); mg.stroke(); });
    }
    const md = mg.getImageData(0, 0, W, H).data; mc.width = 1;
    const drips: [number, number, number][] = [];
    for (let m = 0; m < 5; m++) drips.push([(m % 2 ? hw : 0) + (0.9 + r() * 1.6) * pu, r() * H, (0.12 + r() * 0.25) * pu]);
    const crsF = coarse(192, 48, (u, v) => tfbm(u * 16, v * 16, 16, 4, 22)), dustF = coarse(64, 32, (u, v) => tfbm(u * 6, v * 6, 6, 3, 24));
    for (let y = 0; y < H; y++) {
      const ym = y / pv, ph = ((ym % 0.3) + 0.3) % 0.3, b = (ph - 0.15) / 0.09;                 // along the rumble strip's dips
      const seam = 0.03 + 0.012 * Math.sin(ym * 2.3) + 0.008 * Math.sin(ym * 7.1 + 1.2);          // the joint's sealant, wandering
      for (let x = 0; x < W; x++) {
        const ramp = x >= hw, xm = (x - (ramp ? hw : 0)) / pu, i = (y * W + x) * 4;
        const grain = tnoise(x * 0.8, y * 1.25, H * 1.25, 21), crs = crsF(x / W, y / H);
        const dust = smoothstep(0.5, 3.2, xm) * (0.45 + 0.55 * dustF(x / W, y / H));
        const stone = grain > 0.85 ? (grain - 0.85) * 1.8 : 0;
        let lum = (ramp ? 0.4 : 0.43) + (crs - 0.5) * 0.13 + (grain - 0.5) * 0.17 + stone + dust * 0.07, ht = grain * 0.7 + crs * 0.3 + stone;
        let dip = 0;
        if (!ramp) {
          const a = (xm - 0.5) / 0.2;
          if (Math.abs(a) < 1 && Math.abs(b) < 1) dip = (1 - b * b) * smoothstep(1, 0.8, Math.abs(a));
          lum = lum * (1 - 0.2 * dip) - dip * 0.03; ht -= dip * 1.1;
          const s = 1 - smoothstep(seam, seam + 0.012, xm);
          lum = lum * (1 - s) + (0.17 + (grain - 0.5) * 0.06) * s; ht = ht * (1 - s) + 0.55 * s;
        }
        const tar = md[i] / 255;
        lum = lum * (1 - tar) + (0.16 + (grain - 0.5) * 0.08 + dust * 0.04) * tar; ht = ht * (1 - tar) + 0.6 * tar;
        let drip = 0;
        for (const [cx, cy, rr] of drips) { const dx = (x - cx) / rr, dy0 = Math.abs(y - cy), dy = Math.min(dy0, H - dy0) / (rr * 1.6 * pv / pu); drip += Math.exp(-(dx * dx + dy * dy) * 2); }
        lum *= 1 - 0.16 * Math.min(1, drip);
        d[i] = clamp(lum * 255 * (1 + dust * 0.03), 0, 255); d[i + 1] = clamp(lum * 255 * 0.975, 0, 255); d[i + 2] = clamp(lum * 255 * (0.92 - dust * 0.03), 0, 255); d[i + 3] = 255;
        height[y * W + x] = ht;
      }
    }
    g.putImageData(img, 0, 0);
    const map = tex(c, true), normal = normalMap(height, W, H, 2, 2 * pv / pu);           // texels are longer along v
    map.wrapS = normal.wrapS = THREE.ClampToEdgeWrapping;             // the two halves don't bleed into each other
    return { map, normalMap: normal };
  });
}

// The Jersey barrier (the median's, and the outside one where there's no sound wall), cast concrete, weathered. u is
// the height on the barrier (BARRIER_U metres, clamped; Roads.ts gives each profile point its height), v runs along
// the road, BARRIER_V metres a tile with a weakened-plane joint at its start. Road grime and tyre spray at the foot,
// black tyre scuffs on the lip and lower slope where cars have rubbed it, rain streaks under the top edge, dust on
// top and a blotchy wander in the tone.
export const BARRIER_U = 1, BARRIER_V = 6.1;
export function barrier(): PBR {
  return once('barrier', () => {
    const W = SIZE >= 1024 ? 256 : 128, H = 4 * W, pu = W / BARRIER_U, pv = H / BARRIER_V, r = rng(61);
    const [c, g] = mk(W, H), img = g.createImageData(W, H), d = img.data, height = new Float32Array(W * H);
    // tyre scuffs: long smears at the lip and the lower slope, a little rising or falling along the wall
    const scuffs: { h: number; y0: number; len: number; th: number; k: number; sl: number }[] = [];
    for (let m = 0; m < 9; m++) scuffs.push({ h: 0.07 + r() * 0.3, y0: r() * H, len: (0.3 + r() * 1.6) * pv, th: 0.006 + r() * 0.02, k: 0.25 + r() * 0.45, sl: (r() - 0.5) * 0.06 });
    const blotF = coarse(16, 64, (u, v) => tfbm(u * 2, v * 8, 8, 3, 62));
    for (let y = 0; y < H; y++) {
      const yv = y / H;
      const grimeH = 0.09 + 0.15 * tfbm(1.5, yv * 24, 24, 3, 64);
      const streak = smoothstep(0.56, 0.74, tfbm(2.5, yv * 60, 60, 2, 65)), sLen = 0.08 + 0.3 * tfbm(3.5, yv * 30, 30, 2, 66);
      const jd = Math.min(y, H - y) / pv;                                 // metres from the joint
      for (let x = 0; x < W; x++) {
        const hm = x / pu, i = (y * W + x) * 4;
        const pore = tnoise(x * 0.5, y * 0.75, H * 0.75, 67), blot = blotF(x / W, yv);
        let lum = 0.72 + (blot - 0.5) * 0.14 + (pore - 0.5) * 0.07 - (pore > 0.9 ? 0.08 : 0), ht = pore * 0.4 + blot * 0.2, warm = 0;
        // rain streaks under the top edge, and dust settled on the top
        if (hm < 0.8) { const run = streak * Math.max(0, 1 - (0.8 - hm) / sLen); lum -= run * 0.07; }
        else lum *= 0.9;
        for (const s of scuffs) {
          let dy = y - s.y0; if (dy < 0) dy += H;
          if (dy > s.len) continue;
          const t = dy / s.len, off = Math.abs(hm - s.h - s.sl * t) / s.th;
          if (off < 1) lum *= 1 - s.k * (1 - off * off) * Math.sin(Math.PI * t) ** 0.5 * (0.6 + 0.4 * pore);
        }
        // the foot: road grime and spray, ragged and flecked along its top
        const fleck = hm < grimeH * 1.6 && pore > 0.8 ? 0.35 : 0;
        const grime = Math.min(1, 1 - smoothstep(grimeH * 0.35, grimeH, hm) + fleck);
        lum *= 1 - 0.36 * grime; warm += grime;
        if (jd < 0.005) { lum *= 0.55; ht -= 0.8; } else if (jd < 0.014) lum *= 0.9;
        d[i] = clamp(lum * 255 * (1 + 0.02 * warm), 0, 255); d[i + 1] = clamp(lum * 255 * 0.985, 0, 255); d[i + 2] = clamp(lum * 255 * (0.955 - 0.05 * warm), 0, 255); d[i + 3] = 255;
        height[y * W + x] = ht;
      }
    }
    g.putImageData(img, 0, 0);
    const map = tex(c, true), normal = normalMap(height, W, H, 1.4, 1.4 * pv / pu);
    map.wrapS = normal.wrapS = THREE.ClampToEdgeWrapping;             // the foot and the top don't wrap into each other
    return { map, normalMap: normal };
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
// longitudinal tining, tyre rubber in two broad wheel paths (heavier in places, and a little cooler than the
// slab), an oil line, grit packed into the joints with a few spalls broken out of the slab's edge, and a hairline
// crack. Every slab shows the same tile, so the wear is kept to soft, low-contrast marks that don't read as copies.
// The roughness eases only a little in the wheel paths, broad and patchy, so a low sun's glare spreads instead of
// streaking down each wheel path.
export const SLAB = 4.57;
export function pcc(): PBR {
  return once('pcc', () => {
    const n = Math.min(SIZE, 1024), r = rng(41), k = n / 1024;
    const [c, g] = mk(n, n), [rc, rg] = mk(n, n);
    const img = g.createImageData(n, n), d = img.data, rimg = rg.createImageData(n, n), rd = rimg.data;
    const height = new Float32Array(n * n);
    const skew = 0.06 * n;                                 // the joints run a little off square, as Caltrans saws them
    const wearF = coarse(64, 64, (u, v) => tfbm(u * 3, v * 6, 3, 3, 46)), patchF = coarse(64, 64, (u, v) => tfbm(u * 6, v * 6, 6, 3, 47));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const grain = tnoise(x * 1.1, y * 1.1, n * 1.1, 42);
      const coarse = tfbm(u * 5, v * 5, 5, 4, 43);
      const mottle = tfbm(u * 2, v * 2, 2, 3, 44);
      // longitudinal tining, as Caltrans finishes its slabs: 192 grooves 19 mm apart across the lane, stopping 8 cm
      // short of the lane's edge
      const tine = (0.5 + 0.5 * Math.sin((x / n) * 192 * Math.PI * 2)) * smoothstep(0.012 * n, 0.022 * n, Math.min(x, n - x)) * (k < 1 ? 0.5 : 1);
      const wear = 0.65 + 0.7 * wearF(u, v);
      const path = (Math.exp(-(((u - 0.28) / 0.11) ** 2)) + Math.exp(-(((u - 0.72) / 0.11) ** 2))) * wear;
      const oil = Math.exp(-(((u - 0.5) / 0.06) ** 2)) * (0.3 + 0.7 * tfbm(u * 4, v * 8, 4, 3, 45));
      const patch = patchF(u, v);
      const jy = (((y - u * skew) % n) + n) % n, tj = Math.min(jy, n - jy), lj = Math.min(x, n - x);
      const joint = Math.max(tj < 3 ? 1 : tj < 7 ? 0.35 : 0, lj < 2 ? 1 : lj < 5 ? 0.3 : 0);
      // grit packs into the joints and stains a hand's width either side of them
      const grime = Math.exp(-((tj / (16 * k)) ** 2)) * 0.7 + Math.exp(-((lj / (10 * k)) ** 2)) * 0.4;
      let lum = 0.58 + (mottle - 0.5) * 0.08 + (coarse - 0.5) * 0.07 + (grain - 0.5) * 0.09 - path * 0.055 - oil * 0.05 - tine * 0.015 - grime * 0.035;
      lum -= joint * 0.26;
      const warm = 1 - Math.min(1, path) * 0.5;            // rubber is neutral, so the wheel paths lose a little warmth
      const i = (y * n + x) * 4;
      d[i] = clamp(lum * 255 * (1 + 0.02 * warm), 0, 255); d[i + 1] = clamp(lum * 255, 0, 255); d[i + 2] = clamp(lum * 255 * (1 - 0.06 * warm), 0, 255); d[i + 3] = 255;
      const rough = clamp(0.86 - path * 0.04 - oil * 0.04 + (grain - 0.5) * 0.08 + (patch - 0.5) * 0.16 + joint * 0.1 + grime * 0.02, 0.55, 1);
      rd[i] = rd[i + 1] = rd[i + 2] = rough * 255; rd[i + 3] = 255;
      height[y * n + x] = grain * 0.35 + coarse * 0.25 + tine * 0.16 - joint * 0.8;
    }
    g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
    // spalls: shallow chips broken out of the slab's edge along the transverse joint, darker and rougher
    for (let m = 0; m < 5; m++) {
      const x0 = r() * n, y0 = (x0 / n) * skew + (r() < 0.5 ? -1 : 1) * (4 + r() * 5) * k, rad = (5 + r() * 8) * k;
      const pts: [number, number][] = [];
      for (let a = 0; a < 7; a++) { const ang = (a / 7) * Math.PI * 2, rr = rad * (0.6 + 0.5 * r()); pts.push([x0 + Math.cos(ang) * rr * 1.4, y0 + Math.sin(ang) * rr * 0.7]); }
      for (const [cx, col] of [[g, 'rgba(84,80,74,0.5)'], [rg, 'rgba(255,255,255,0.3)']] as const) wrapped(cx, n, n, () => {
        cx.fillStyle = col; cx.beginPath(); cx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) cx.lineTo(p[0], p[1]); cx.closePath(); cx.fill();
      });
    }
    // a hairline crack, faint (every slab repeats it)
    g.strokeStyle = 'rgba(40,38,36,0.3)'; g.lineWidth = 1.5 * k;
    {
      let x = r() * n, y = r() * n, a = r() * Math.PI * 2;
      const pts: [number, number][] = [[x, y]];
      for (let s = 0; s < 30; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 6 * k; y += Math.sin(a) * 6 * k; pts.push([x, y]); }
      wrapped(g, n, n, () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); });
    }
    return { map: tex(c, true), normalMap: normalMap(height, n, n, 1.6), roughnessMap: tex(rc, false) };
  });
}

// A masonry sound wall: split-face block in running bond, tan, 0.2 m courses of 0.4 m blocks under a smooth precast
// cap course. One tile is WALL_U up the face (u, from the wall's foot) by WALL_V along the road (v); Roads.ts maps u
// from the height on both faces, so the weathering sits where it belongs: road grime and spray at the foot, rain
// streaks running down from the cap (most of them from its joints), the cap's shadow line, and a broad wander in the
// blocks' tone. Roads.ts adds a slower wander along the wall, tens of metres long, in vertex colours.
export const WALL_U = 4.8, WALL_V = 8;
export function blockWall(): PBR {
  return once('blockWall', () => {
    const W = SIZE >= 1024 ? 512 : 256, H = 2 * W;               // x runs up the face (W px over 4.8 m), y along it (H over 8 m)
    const [c, g] = mk(W, H), img = g.createImageData(W, H), d = img.data, height = new Float32Array(W * H);
    const pu = W / WALL_U, pv = H / WALL_V, s = W / 512;
    const bh = 0.2 * pu, bw = 0.4 * pv, capAt = 4.4 * pu, capLen = 1.6 * pv, mo = Math.max(1, 1.6 * s);
    const broadF = coarse(32, 64, (u, v) => tfbm(u * 2, v * 4, 2, 3, 54));
    for (let y = 0; y < H; y++) {
      const yv = y / W;
      // along the wall: where the streaks run and how far down, and how high the grime reaches
      const capJ = Math.min(y % capLen, capLen - (y % capLen));
      const streak = smoothstep(0.52, 0.68, tfbm(0.37, (y / H) * 40, 40, 3, 55)) * 0.8 + Math.exp(-((capJ / (0.07 * pv)) ** 2)) * 0.7;
      const runLen = 0.5 + 1.8 * tfbm(1.7, (y / H) * 20, 20, 2, 56);
      const grimeH = 0.22 + 0.32 * tfbm(2.3, (y / H) * 16, 16, 3, 57);
      for (let x = 0; x < W; x++) {
        const hm = x / pu, i = (y * W + x) * 4;
        const face = tnoise(x * 1.25, y * 1.25, W * 1.25, 51), split = tfbm((x / W) * 10, yv * 10, 10, 4, 52);
        const broad = broadF(x / W, y / H);
        let lum: number, ht: number, gg = 0.9, bb = 0.74;
        if (x >= capAt) {
          // the cap: precast, smoother and greyer, in 1.6 m units, a shadow line under its lip, dirt settled on top
          const cj = capJ < mo * 1.2;
          lum = cj ? 0.5 : 0.71 + (split - 0.5) * 0.06 + (face - 0.5) * 0.05 + (broad - 0.5) * 0.06;
          if (x - capAt < 2.5 * s) lum *= 0.6;
          if (hm > 4.6) lum -= 0.06;
          gg = 0.94; bb = 0.84;
          ht = cj ? 0.6 : 0.9 + (face - 0.5) * 0.08;
        } else {
          const course = Math.floor(x / bh), xx = x - course * bh;
          const yo = (y + (course % 2) * (bw / 2)) % H, by = Math.floor(yo / bw), yy = yo - by * bw;
          const mortar = xx < mo || yy < mo;
          lum = mortar ? 0.7 : 0.62 + (hashT(by, course, 53) - 0.5) * 0.06 + (split - 0.5) * 0.14 + (face - 0.5) * 0.1;
          lum += (broad - 0.5) * 0.1;
          ht = mortar ? 0 : 0.5 + (split - 0.5) * 0.8 + (face - 0.5) * 0.3;
          // rain streaks: darker, greyer runs from the cap down, fading as they go, over a band of drip right under it
          const below = (capAt - x) / pu;
          const run = streak * Math.max(0, 1 - below / runLen) ** 1.5 + Math.max(0, 1 - below / 0.3) * 0.3;
          lum -= run * 0.13; gg += run * 0.03; bb += run * 0.07;
        }
        // road grime at the foot: tyre spray and dust, higher in patches, flecked along its top edge
        const fleck = hm < grimeH * 1.7 && tnoise(x * 0.5, y * 0.5, W * 0.5, 58) > 0.78 ? 0.4 : 0;
        const grime = Math.min(1, 1 - smoothstep(grimeH * 0.3, grimeH, hm) + fleck);
        lum *= 1 - 0.34 * grime; gg += grime * 0.02; bb += grime * 0.06;
        d[i] = clamp(lum * 255, 0, 255); d[i + 1] = clamp(lum * 255 * gg, 0, 255); d[i + 2] = clamp(lum * 255 * bb, 0, 255); d[i + 3] = 255;
        height[y * W + x] = ht;
      }
    }
    g.putImageData(img, 0, 0);
    const map = tex(c, true), normal = normalMap(height, W, H, 2.4, 2.4 * pv / pu);     // texels are shorter along v
    map.wrapS = normal.wrapS = THREE.ClampToEdgeWrapping;           // the face's foot and its cap don't wrap into each other
    return { map, normalMap: normal };
  });
}

// Worn road paint, a linear multiplier on the line's colour: u across the line, v along it (a tile is PAINT_V
// metres). Tyre-polished streaks run along it, its edges are ragged and chips show the road through.
export const PAINT_V = 6;
export function paintWear(): THREE.Texture {
  return once('paintWear', () => {
    const w = 64, h = Math.min(SIZE, 1024), [c, g] = mk(w, h), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      // about 7% chipped (more in some stretches than others) and 8% lost off the edges
      const v = y / h, e0 = 0.01 + 0.07 * tfbm(0.3, v * 256, 16, 2, 73), e1 = 0.01 + 0.07 * tfbm(0.6, v * 256, 16, 2, 74), thr = 0.68 + 0.14 * tfbm(0.9, v * 16, 16, 2, 75);
      for (let x = 0; x < w; x++) {
        const u = x / w, i = (y * w + x) * 4;
        const streak = tfbm(u * 8, v * 8, 8, 3, 71), chip = tfbm(u * 16, v * 512, 16, 3, 72);
        let f = 0.78 + 0.3 * streak;
        if (chip > thr || u < e0 || 1 - u < e1) f = 0.22 + 0.12 * chip;
        d[i] = d[i + 1] = d[i + 2] = clamp(f * 255, 0, 255); d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return tex(c, false);
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

// ---------------------------------------------------------------- buildings
// Two atlases, painted once: stucco() for the houses and facade() for the offices. Each is a stack of strips that run
// the whole width and repeat across (u wraps), so a wall of any length shows whole bays. The geometry maps its faces
// into the strips with the layouts below, given in pixels of a 1024 x 2048 design (y down; v = 1 - y / 2048); the
// canvases are that size at High and half of it at Low. The alpha channel is a tint mask: 255 where the
// per-instance colour applies (stucco and roofing on a house, the glass on an office), 0 where it doesn't (window
// frames, doors, garage doors, precast concrete, metal). Like frond(), the texture is the ImageData itself, so the
// colour under a zero alpha survives. Gutters between the strips repeat their edge rows, against mip-map bleed.
export const ATLAS_H = 2048;
export const STUCCO = {
  wallM: 18,                                     // metres of wall across the atlas (56.9 px a metre)
  win: [0, 165], up: [173, 327], front: [335, 500], plain: [508, 673],   // storeys: 2.9, 2.7, 2.9, 2.9 m (top, bottom)
  roofM: 12, slopeM: 7,                          // a roof row: 12 m along the eave, 7 m up the slope (from its bottom)
  roof0: 684, roofH: 448, roofPitch: 456,        // three rows: Spanish S-tile, grey laminated composite, brown shake
  // the front strip's pieces, in metres along it
  garage: [0, 5.6], entry: [5.6, 8.4], picture: [8.4, 12.4], small: [12.4, 15.2], blank: [15.2, 18],
} as const;
export const FACADE = {
  wallM: 16,                                     // metres of facade across the atlas (64 px a metre)
  pitch: 336, parapet: 64, storey: 256,          // style k: parapet at y = 336 k, its 4 m storey under it
  roof: [1016, 1528], mech: [1536, 1792], penthouse: [1800, 2040],      // roof membrane, rooftop units, penthouse panel
} as const;

type Layers = { c: Ctx; m: Ctx; h: Ctx; r: Ctx };
// a rectangle on the layers it names: colour (or a gradient), tint mask (1 tinted, 0 not), height and roughness (0-255)
function lay(L: Layers, x: number, y: number, w: number, h: number, col?: string | CanvasGradient, mask?: 0 | 1, ht?: number, ro?: number) {
  if (col !== undefined) { L.c.fillStyle = col; L.c.fillRect(x, y, w, h); }
  if (mask !== undefined) { L.m.fillStyle = mask ? '#fff' : '#000'; L.m.fillRect(x, y, w, h); }
  if (ht !== undefined) { L.h.fillStyle = `rgb(${ht},${ht},${ht})`; L.h.fillRect(x, y, w, h); }
  if (ro !== undefined) { L.r.fillStyle = `rgb(${ro},${ro},${ro})`; L.r.fillRect(x, y, w, h); }
}
// The layers are CPU canvases (willReadFrequently): they're read back once painted, and on a GPU canvas that
// readback first flushes every fill through the GPU (in software rendering it took 15 to 35 s an atlas, not 1 to 2).
function layers(n: number, H: number): [HTMLCanvasElement[], Layers] {
  const cpu = (): [HTMLCanvasElement, Ctx] => { const cv = document.createElement('canvas'); cv.width = n; cv.height = H; return [cv, cv.getContext('2d', { willReadFrequently: true })!]; };
  const [c, g] = cpu(), [mc, mg] = cpu(), [hc, hg] = cpu(), [rc, rg] = cpu();
  const k = n / 1024;
  for (const x of [g, mg, hg, rg]) x.setTransform(k, 0, 0, k, 0, 0);
  return [[c, mc, hc, rc], { c: g, m: mg, h: hg, r: rg }];
}
// copy each strip's edge rows into the gutter below it (design rows [a, b) take row a - 1, as far as the next strip)
function gutters(cs: HTMLCanvasElement[], n: number, k: number, gaps: [number, number][]) {
  for (const cv of cs) {
    const g = cv.getContext('2d')!;
    // row copies as ImageData (a canvas drawn onto itself snapshots the whole canvas on every call)
    for (const [a, b] of gaps) {
      const ya = Math.round(a * k), yb = Math.round(b * k), mid = (ya + yb) >> 1;
      const above = g.getImageData(0, ya - 1, n, 1), below = g.getImageData(0, yb, n, 1);
      for (let y = ya; y < mid; y++) g.putImageData(above, 0, y);
      for (let y = mid; y < yb; y++) g.putImageData(below, 0, y);
    }
  }
}
// the finished atlas: colour with the mask as alpha (as ImageData), plus the normal and roughness maps when asked
export interface Atlas { map: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture }
function finish(cs: HTMLCanvasElement[], n: number, H: number, bump: number, withNormal: boolean, withRough: boolean): Atlas {
  const [c, mc, hc, rc] = cs;
  const img = c.getContext('2d')!.getImageData(0, 0, n, H), mask = mc.getContext('2d')!.getImageData(0, 0, n, H).data, d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = mask[i];
  const map = new THREE.Texture(img);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = ANISO; map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping; map.needsUpdate = true;
  let normal: THREE.Texture | undefined, rough: THREE.Texture | undefined;
  if (withNormal) {
    const hd = hc.getContext('2d')!.getImageData(0, 0, n, H).data, h = new Float32Array(n * H);
    for (let i = 0; i < h.length; i++) h[i] = hd[i * 4] / 255;
    normal = normalMap(h, n, H, bump); normal.wrapT = THREE.ClampToEdgeWrapping;
  }
  if (withRough) { rough = tex(rc, false); rough.wrapT = THREE.ClampToEdgeWrapping; } else rc.width = 1;
  mc.width = hc.width = c.width = 1;                               // free the canvases the textures don't keep
  return { map, normalMap: normal, roughnessMap: rough };
}
const hashT = (a: number, b: number, s: number) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The house atlas. Stucco is painted near white so the instance's colour is the house's colour (warm white, sand,
// greige, soft terracotta...). Windows are white vinyl with sky in the glass, some with grids or blinds; the front
// strip has a two-car sectional garage door, a recessed entry with a panelled door and sidelight, and a gridded
// picture window. The eave's shadow darkens each storey's top, a weep screed and the slab show at the bottom. The
// roofs are painted per pixel from their real dimensions: S-tile barrels 0.3 m apart in 0.42 m courses with the
// bird-stop ends at the eave, laminated composite in 0.14 m courses with random tab widths and shadow bands, and
// shakes of random widths in 0.25 m courses with grain and gaps.
export function stucco(detail: boolean): Atlas {
  return once('stucco' + (detail ? 1 : 0), () => {
    const n = Math.min(SIZE, 1024), H = n * 2, k = n / 1024, S = STUCCO, ppm = 1024 / S.wallM;
    const [cs, L] = layers(n, H);
    // per pixel: the stucco everywhere, then the three roof rows over it
    const g = L.c, img = g.createImageData(n, H), d = img.data, hImg = L.h.createImageData(n, H), hd = hImg.data, rImg = L.r.createImageData(n, H), rd = rImg.data;
    const P = 0.3, CT = 0.42, CC = 0.142, CS = 0.25, rows = [0, 1, 2].map((i) => S.roof0 + i * S.roofPitch);
    // the composite's tabs and the shakes: random widths, per course, as a column -> piece lookup
    const pieces = (kind: number, course: number) => {
      const out = new Int16Array(n), rr = rng(500 + kind * 977 + course * 31), lo = kind === 1 ? 0.16 : 0.1, hi = kind === 1 ? 0.42 : 0.3;
      let x = rr() * hi, id = 0;
      const edges: number[] = [];
      while (x < S.roofM) { edges.push(x); x += lo + rr() * (hi - lo); }
      for (let i = 0; i < n; i++) { const X = (i / n) * S.roofM; while (id < edges.length - 1 && X >= edges[id + 1]) id++; out[i] = X < edges[0] ? edges.length - 1 : id; }
      return { out, edges };
    };
    const cache = new Map<number, ReturnType<typeof pieces>>();
    const piece = (kind: number, course: number) => { const key = kind * 1000 + course; let p = cache.get(key); if (!p) cache.set(key, (p = pieces(kind, course))); return p; };
    for (let y = 0; y < H; y++) {
      const yd = y / k;
      const row = rows.findIndex((r0) => yd >= r0 - 4 && yd < r0 + S.roofH + 4);
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        let R: number, G: number, B: number, ht: number, ro: number;
        if (row < 0) {
          // sand-finish stucco: fine grain, soft blotches; tileable across
          const fine = tnoise(x * 0.5, y * 0.5, n * 0.5, 151), blot = tfbm(x / n * 6, y / n * 6, 6, 3, 152);
          const l = 0.93 + (fine - 0.5) * 0.07 + (blot - 0.5) * 0.06;
          R = 250 * l; G = 247 * l; B = 240 * l; ht = 128 + (fine - 0.5) * 18 + (blot - 0.5) * 10; ro = 235;
        } else {
          const bottom = rows[row] + S.roofH, s = Math.max(0, (bottom - yd) / (S.roofH / S.slopeM)), X = (x / n) * S.roofM;
          const grain = tnoise(x, y, n, 160 + row) - 0.5;
          if (row === 0) {                                  // Spanish S-tile
            const ci = Math.floor(s / CT), fs = s / CT - ci, ti = Math.floor(X / P), ph = X / P - ti;
            const cap = ph < 0.5, q = cap ? ph * 2 : (ph - 0.5) * 2;
            const prof = cap ? Math.sin(Math.PI * q) : -0.45 * Math.sin(Math.PI * q), slope = cap ? Math.cos(Math.PI * q) : -0.45 * Math.cos(Math.PI * q);
            const h1 = hashT(ti, ci, 7), h2 = hashT(ti, ci, 8), h3 = hashT(ti, ci, 9);
            let r = 0.68 + h1 * 0.07, gg = 0.34 + h2 * 0.05, b = 0.23 + h3 * 0.04;
            if (h3 > 0.9) { r *= 0.82; gg *= 0.78; b *= 0.8; } else if (h3 < 0.05) { r *= 1.04; gg *= 1.07; b *= 1.1; }
            let l = (cap ? 0.98 + slope * 0.2 + prof * 0.05 : 0.68 + prof * 0.22) * (1 + grain * 0.1);
            if (fs > 0.86) l *= 0.62 + (1 - fs) * 1.5;      // the shadow under the next course's ends
            if (s < 0.16) {                                 // the eave: barrel ends with bird stops
              const dx = (q - 0.5) * P * 0.5, dy = s - 0.02;
              if (cap && dx * dx + dy * dy < 0.0036) { r = 0.16; gg = 0.12; b = 0.1; l = 1; } else if (!cap) l *= 0.85;
            }
            R = 255 * r * l; G = 255 * gg * l; B = 255 * b * l;
            ht = 128 + prof * 70 + (1 - fs) * 30; ro = 185;
          } else if (row === 1) {                           // grey laminated composite shingles
            const ci = Math.floor(s / CC), fs = s / CC - ci, pc = piece(1, ci), t = pc.out[x];
            const h1 = hashT(t, ci, 21), h2 = hashT(t, ci, 22);
            const base = 0.36 + h1 * 0.12, warm = h2 < 0.5 ? 1 : 0;
            let l = 1 + (hashT(x, y, 23) - 0.5) * 0.22 + grain * 0.08;
            if (h2 > 0.55 && fs < 0.38) l *= 0.72;           // the laminate's shadow band
            if (fs > 0.9) l *= 0.55;                        // the course above's edge
            const X0 = pc.edges[t], dX = Math.abs(X - X0);
            if (dX < 0.008 && fs < 0.6) l *= 0.6;           // the cut between tabs
            R = 255 * base * l * (warm ? 1.02 : 0.99); G = 255 * base * l; B = 255 * base * l * (warm ? 0.97 : 1.01);
            if (s < 0.16) { const e = s / 0.16; R = G = B = 214 + e * 18; if (e < 0.2) { R *= 0.7; G *= 0.7; B *= 0.7; } }   // the gutter
            ht = 128 + (1 - fs) * 50; ro = 245;
          } else {                                          // brown shake
            const ci = Math.floor(s / CS), fs = s / CS - ci, pc = piece(2, ci), t = pc.out[x];
            const h1 = hashT(t, ci, 31), h2 = hashT(t, ci, 32);
            let r = 0.46 + h1 * 0.08, gg = 0.37 + h1 * 0.06, b = 0.28 + h1 * 0.04;
            if (h2 < 0.14) { r = 0.49; gg = 0.45; b = 0.4; } else if (h2 > 0.9) { r *= 0.8; gg *= 0.78; b *= 0.78; }
            const streak = tnoise(X * 60, s * 3, Math.round(S.roofM * 60), 33) - 0.5;
            let l = 1 + streak * 0.24 + grain * 0.06;
            if (fs > 0.82) l *= 0.5 + (1 - fs) * 1.6;      // thick butts throw a deep shadow
            const X0 = pc.edges[t];
            if (Math.abs(X - X0) < 0.014) l *= 0.35;       // the keyway between shakes
            if (s < 0.18) { r = 0.42; gg = 0.33; b = 0.25; l = s < 0.03 ? 0.6 : 1 + grain * 0.1; }   // the fascia
            R = 255 * r * l; G = 255 * gg * l; B = 255 * b * l;
            ht = 128 + (1 - fs) * 80 + streak * 20; ro = 245;
          }
        }
        d[i] = clamp(R, 0, 255); d[i + 1] = clamp(G, 0, 255); d[i + 2] = clamp(B, 0, 255); d[i + 3] = 255;
        hd[i] = hd[i + 1] = hd[i + 2] = clamp(ht, 0, 255); hd[i + 3] = 255;
        rd[i] = rd[i + 1] = rd[i + 2] = ro; rd[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); L.h.putImageData(hImg, 0, 0); L.r.putImageData(rImg, 0, 0);
    lay(L, 0, 0, 1024, ATLAS_H, undefined, 1);
    // ------------------------------------------------ the walls, drawn in design pixels
    const r = rng(171), M = (m: number) => m * ppm;
    // a window: x, the sill's and the head's heights (m above the floor), its width (m), on a storey whose floor is at y
    const win = (x: number, floor: number, w: number, sill: number, head: number, o: { grid?: [number, number]; rail?: 'h' | 'v'; blind?: number } = {}) => {
      const X = M(x), W = M(w), Y = floor - M(head), Hh = M(head - sill), f = 4;
      lay(L, X - 4, Y - 3, W + 8, Hh + 8, 'rgba(0,0,0,0.13)');                                // the stucco return's shadow
      lay(L, X - 3, Y + Hh + 1, W + 6, 5, 'rgba(255,255,255,0.28)');                         // a foam sill
      lay(L, X, Y, W, Hh, '#ebe9e3', 0, 150, 120);                                            // the vinyl frame
      const gl = L.c.createLinearGradient(0, Y, 0, Y + Hh);
      const top = r() * 0.25;
      gl.addColorStop(0, `rgb(${150 + top * 80 | 0},${168 + top * 60 | 0},${184 + top * 40 | 0})`); gl.addColorStop(0.45, '#5b6c7b'); gl.addColorStop(1, '#2c3743');
      lay(L, X + f, Y + f, W - 2 * f, Hh - 2 * f, gl, 0, 100, 20);
      if (o.blind) lay(L, X + f, Y + f, W - 2 * f, (Hh - 2 * f) * o.blind, 'rgba(222,214,198,0.82)');
      L.c.fillStyle = 'rgba(255,255,255,0.12)'; L.c.beginPath(); L.c.moveTo(X + f + W * 0.15, Y + f); L.c.lineTo(X + f + W * 0.35, Y + f); L.c.lineTo(X + f + W * 0.05, Y + Hh - f); L.c.lineTo(X + f, Y + Hh - f); L.c.lineTo(X + f, Y + Hh * 0.55); L.c.closePath(); L.c.fill();
      if (o.rail === 'h') lay(L, X, Y + Hh / 2 - 2, W, 4, '#e4e2dc', 0, 150, 120);
      if (o.rail === 'v') lay(L, X + W / 2 - 2, Y, 4, Hh, '#e4e2dc', 0, 150, 120);
      if (o.grid) {
        const [gx, gy] = o.grid;
        for (let a = 1; a < gx; a++) lay(L, X + f + ((W - 2 * f) * a) / gx - 1, Y + f, 2, Hh - 2 * f, '#e8e6e0');
        for (let a = 1; a < gy; a++) lay(L, X + f, Y + f + ((Hh - 2 * f) * a) / gy - 1, W - 2 * f, 2, '#e8e6e0');
      }
      lay(L, X, Y, W, 2, 'rgba(0,0,0,0.25)');                                                 // the head's shadow in the frame
    };
    // a storey's top (the eave's shadow) and, at the ground, the weep screed, the slab and a little splash dirt
    const eave = (top: number) => { const gr = L.c.createLinearGradient(0, top, 0, top + 26); gr.addColorStop(0, 'rgba(40,32,24,0.42)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); lay(L, 0, top, 1024, 26, gr); };
    const base = (floor: number) => {
      const gr = L.c.createLinearGradient(0, floor - 30, 0, floor); gr.addColorStop(0, 'rgba(110,95,70,0)'); gr.addColorStop(1, 'rgba(110,95,70,0.16)');
      lay(L, 0, floor - 30, 1024, 30, gr);
      lay(L, 0, floor - 8, 1024, 8, '#a9a59c', 0, 110, 230); lay(L, 0, floor - 10, 1024, 2, '#d4d4d0', 0, 170, 140); lay(L, 0, floor - 8, 1024, 1, 'rgba(0,0,0,0.3)');
    };
    // ground floor: a run of windows across 18 m
    {
      const [t, f] = S.win;
      eave(t); base(f);
      win(1.0, f, 1.9, 0.9, 2.1, { rail: 'v', grid: [4, 2] });
      win(5.2, f, 1.8, 0.9, 2.1, { rail: 'v', blind: 0.35 });
      win(9.3, f, 0.8, 1.5, 2.1, { rail: 'h' });
      win(11.6, f, 1.0, 0.9, 2.1, { rail: 'h', grid: [2, 4] });
      win(14.8, f, 1.6, 0.9, 2.1, { rail: 'v', blind: 0.6 });
    }
    // upper floor: smaller windows, a foam belly band at the floor line
    {
      const [t, f] = S.up;
      eave(t);
      win(1.6, f, 1.5, 0.95, 2.05, { rail: 'v', blind: 0.4 });
      win(5.8, f, 1.0, 0.95, 2.05, { rail: 'h', grid: [2, 4] });
      win(8.9, f, 1.0, 0.95, 2.05, { rail: 'h' });
      win(12.4, f, 1.8, 0.95, 2.05, { rail: 'v', grid: [4, 2] });
      win(16.2, f, 0.7, 1.4, 2.05, { rail: 'h' });
      lay(L, 0, f - 15, 1024, 15, 'rgba(255,255,255,0.22)', undefined, 175); lay(L, 0, f - 15, 1024, 2, 'rgba(255,255,255,0.3)'); lay(L, 0, f - 2, 1024, 2, 'rgba(0,0,0,0.18)');
    }
    // the front: garage, entry, picture window, small window, blank
    {
      const [t, f] = S.front;
      eave(t); base(f);
      // the two-car sectional door, 4.9 x 2.15 m, under a stucco header; 4 sections of 8 raised panels
      const gx = M(S.garage[0] + 0.35), gw = M(4.9), gh = M(2.15), gy = f - gh;
      lay(L, gx - 5, gy - 5, gw + 10, gh + 5, 'rgba(0,0,0,0.22)');
      lay(L, gx, gy, gw, gh, '#e9e6de', 0, 120, 160);
      for (let row = 0; row < 4; row++) {
        const sy = gy + (gh * row) / 4, sh = gh / 4;
        lay(L, gx, sy, gw, 1.5, 'rgba(0,0,0,0.35)', undefined, 90);
        for (let col = 0; col < 8; col++) {
          const px = gx + 5 + ((gw - 10) * col) / 8, pw = (gw - 10) / 8 - 5, py = sy + 5, ph = sh - 10;
          lay(L, px, py, pw, ph, '#f1eee7', undefined, 150); lay(L, px, py, pw, 1.5, 'rgba(255,255,255,0.8)'); lay(L, px, py + ph - 1.5, pw, 1.5, 'rgba(0,0,0,0.22)');
          lay(L, px + pw - 1.5, py, 1.5, ph, 'rgba(0,0,0,0.14)');
        }
      }
      const gg = L.c.createLinearGradient(0, gy, 0, gy + 12); gg.addColorStop(0, 'rgba(0,0,0,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); lay(L, gx, gy, gw, 12, gg);
      // coach lights
      const lamp = (x: number, y: number) => { lay(L, x, y, 9, 15, '#2a2724', 0, 170, 120); lay(L, x + 2, y + 3, 5, 9, '#d8c79a', 0); };
      lamp(gx - 16, gy + 26); lamp(gx + gw + 7, gy + 26);
      // the entry: a recessed porch, a panelled door and a sidelight
      const ex = M(S.entry[0] + 0.2), ew = M(2.4), eh = M(2.55);
      const pg = L.c.createLinearGradient(0, f - eh, 0, f); pg.addColorStop(0, 'rgba(30,24,18,0.55)'); pg.addColorStop(1, 'rgba(30,24,18,0.3)');
      lay(L, ex, f - eh, ew, eh, pg, undefined, 60);
      lay(L, ex - 6, f - eh - 6, ew + 12, 6, 'rgba(255,255,255,0.3)');
      const dx = ex + M(0.55), dw = M(0.95), dh = M(2.1);
      lay(L, dx - 4, f - dh - 4, dw + 8 + M(0.42), dh + 4, '#e7e4dc', 0, 120, 140);
      lay(L, dx, f - dh, dw, dh, '#5a3926', 0, 110, 150);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
        const px = dx + 6 + b * (dw - 12) / 2, py = f - dh + 8 + a * (dh - 16) / 3, pw = (dw - 12) / 2 - 6, ph = (dh - 16) / 3 - 8;
        lay(L, px, py, pw, ph, '#6a4630'); lay(L, px, py, pw, 1.5, 'rgba(255,220,180,0.25)'); lay(L, px, py + ph - 1.5, pw, 1.5, 'rgba(0,0,0,0.35)');
      }
      lay(L, dx + dw - 9, f - dh * 0.48, 4, 4, '#c9a85a');
      const sl = L.c.createLinearGradient(0, f - dh, 0, f); sl.addColorStop(0, '#8fa2b2'); sl.addColorStop(1, '#2d3640');
      lay(L, dx + dw + 6, f - dh + 4, M(0.3), dh - 8, sl, 0, 100, 20);
      lamp(ex + ew - 16, f - dh + 22);
      // the picture window, gridded, in a foam surround
      win(S.picture[0] + 0.8, f, 2.4, 0.75, 2.25, { grid: [6, 3] });
      lay(L, M(S.picture[0] + 0.8) - 7, f - M(2.25) - 7, M(2.4) + 14, 4, 'rgba(255,255,255,0.35)');
      win(S.small[0] + 0.9, f, 1.0, 0.9, 2.1, { rail: 'h', blind: 0.5 });
    }
    // the plain strip: stucco with the slab at the bottom (side walls, gables, soffits)
    { const [t, f] = S.plain; eave(t); base(f); }
    gutters(cs, n, k, [[S.win[1], S.up[0]], [S.up[1], S.front[0]], [S.front[1], S.plain[0]], [S.plain[1], S.roof0], ...[1, 2].map((i): [number, number] => [S.roof0 + i * S.roofPitch - 8, S.roof0 + i * S.roofPitch])]);
    return finish(cs, n, H, 1.6, detail, detail);
  });
}

// The office atlas: three facade styles, one storey each with its parapet above, then the roof, the rooftop units
// and a penthouse's metal panel. Style 0 is an Irvine curtain wall (vision glass in 1.6 m bays, opaque spandrel
// glass at each floor, silver mullions), style 1 a darker tower glass with aluminium spandrels and deep fins every
// 2 m, style 2 a Costa Mesa precast block with ribbon windows. The glass is the tinted part (alpha 255), so each
// building's colour picks its glass (blue, green, silver, bronze); concrete and metal keep their own colour.
export function facade(detail: boolean): Atlas {
  return once('facade' + (detail ? 1 : 0), () => {
    const n = Math.min(SIZE, 1024), H = n * 2, k = n / 1024, F = FACADE, ppm = 1024 / F.wallM;
    const [cs, L] = layers(n, H);
    // per pixel: warm precast concrete everywhere (the precast style and the coping keep it), roofing grit below
    const img = L.c.createImageData(n, H), d = img.data, hImg = L.h.createImageData(n, H), hd = hImg.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4, fine = tnoise(x * 0.5, y * 0.5, n * 0.5, 181), blot = tfbm(x / n * 8, y / n * 8, 8, 3, 182);
      const l = 0.86 + (fine - 0.5) * 0.08 + (blot - 0.5) * 0.08;
      d[i] = 236 * l; d[i + 1] = 228 * l; d[i + 2] = 212 * l; d[i + 3] = 255;
      hd[i] = hd[i + 1] = hd[i + 2] = 128 + (fine - 0.5) * 50; hd[i + 3] = 255;
    }
    L.c.putImageData(img, 0, 0); L.h.putImageData(hImg, 0, 0);
    lay(L, 0, 0, 1024, ATLAS_H, undefined, 0, undefined, 225);
    const r = rng(191), M = (m: number) => m * ppm;
    const Y = (s: number, m: number) => s * F.pitch + F.parapet + F.storey - M(m);     // m metres above style s's floor
    // a band of glass from a to b metres, in panes `bay` metres wide: a soft sky reflection, each pane a little different
    const glass = (s: number, a: number, b: number, bay: number, top: string, bot: string) => {
      const y0 = Y(s, b), y1 = Y(s, a);
      for (let x = 0; x < 1024; x += M(bay)) {
        const gr = L.c.createLinearGradient(0, y0, 0, y1), v = r();
        gr.addColorStop(0, top); gr.addColorStop(0.5 + v * 0.3, bot); gr.addColorStop(1, bot);
        lay(L, x, y0, M(bay) + 1, y1 - y0, gr, 1, 105, 12);
        lay(L, x, y0, M(bay) + 1, y1 - y0, `rgba(${v < 0.5 ? '255,255,255' : '0,10,20'},${0.04 + r() * 0.08})`);
        L.c.fillStyle = 'rgba(255,255,255,0.07)'; L.c.beginPath(); L.c.moveTo(x + M(bay) * (0.2 + v * 0.5), y0); L.c.lineTo(x + M(bay) * (0.45 + v * 0.5), y0); L.c.lineTo(x + M(bay) * (0.05 + v * 0.3), y1); L.c.lineTo(x, y1); L.c.closePath(); L.c.fill();
      }
    };
    const vlines = (s: number, a: number, b: number, every: number, w: number, col: string, ht = 190) => {
      for (let x = 0; x <= 1024; x += M(every)) { lay(L, x - w / 2, Y(s, b), w, Y(s, a) - Y(s, b), col, 0, ht, 110); lay(L, x + w / 2, Y(s, b), 1.5, Y(s, a) - Y(s, b), 'rgba(0,0,0,0.3)'); }
    };
    const hband = (s: number, a: number, b: number, col: string, mask: 0 | 1, ht: number, ro: number) => lay(L, 0, Y(s, b), 1024, Y(s, a) - Y(s, b), col, mask, ht, ro);
    const parapet = (s: number, col: string) => {
      const y = s * F.pitch;
      lay(L, 0, y, 1024, F.parapet, col, 0, 150, 120);
      lay(L, 0, y, 1024, 7, '#e9ebec', 0, 200, 90); lay(L, 0, y + 7, 1024, 3, 'rgba(0,0,0,0.35)');
      lay(L, 0, y + F.parapet - 3, 1024, 3, 'rgba(0,0,0,0.2)');
    };
    // style 0: Irvine curtain wall
    hband(0, 2.95, 4, '#33444f', 1, 120, 30);                                          // spandrel glass
    glass(0, 0.15, 2.85, 1.6, '#b4c8d6', '#46606e');
    hband(0, 0, 0.15, '#aab3ba', 0, 170, 110); hband(0, 2.85, 2.95, '#aab3ba', 0, 170, 110); lay(L, 0, Y(0, 4), 1024, 3, '#c3cad0', 0, 180, 110);
    vlines(0, 0, 4, 1.6, 5, '#b6bec4');
    parapet(0, '#c5cacd');
    // style 1: tower glass, aluminium spandrels, fins every 2 m
    hband(1, 2.65, 4, '#97a1aa', 0, 140, 90);
    for (let x = 0; x < 1024; x += 16) lay(L, x, Y(1, 4), 1, Y(1, 2.65) - Y(1, 4), 'rgba(0,0,0,0.06)');
    glass(1, 0.1, 2.6, 1.0, '#9fb0bf', '#34465a');
    hband(1, 0, 0.1, '#b7bec4', 0, 170, 110); hband(1, 2.6, 2.65, '#b7bec4', 0, 170, 110);
    vlines(1, 0, 4, 1.0, 3, '#a8b0b6', 170); vlines(1, 0, 4, 2.0, 10, '#d3d8dc', 230);
    parapet(1, '#aab2b8');
    // style 2: precast spandrels with ribbon windows; a reveal's shadow over the glass, rain stains under it
    glass(2, 1.0, 3.1, 1.6, '#a3adb4', '#4a5159');
    vlines(2, 1.0, 3.1, 1.6, 4, '#3c3833', 150);
    { const gr = L.c.createLinearGradient(0, Y(2, 3.1), 0, Y(2, 3.1) + 14); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); lay(L, 0, Y(2, 3.1), 1024, 14, gr); }
    for (let x = 0; x < 1024; x += M(4)) { lay(L, x, Y(2, 4), 2, Y(2, 3.1) - Y(2, 4), 'rgba(60,55,45,0.35)', undefined, 90); lay(L, x, Y(2, 1.0), 2, Y(2, 0) - Y(2, 1.0), 'rgba(60,55,45,0.35)', undefined, 90); }
    for (let i = 0; i < 40; i++) { const x = r() * 1024, w = 3 + r() * 8; const gr = L.c.createLinearGradient(0, Y(2, 1.0), 0, Y(2, 0.2)); gr.addColorStop(0, `rgba(70,62,50,${0.05 + r() * 0.08})`); gr.addColorStop(1, 'rgba(70,62,50,0)'); lay(L, x, Y(2, 1.0), w, Y(2, 0.2) - Y(2, 1.0), gr); }
    lay(L, 0, Y(2, 1.0), 1024, 3, 'rgba(255,255,255,0.25)');
    parapet(2, '#d9d2c3');
    // the roof: a pale membrane in 3 m rolls with seams, grime and drains
    {
      const [a, b] = F.roof;
      lay(L, 0, a, 1024, b - a, 'rgba(190,190,186,0.9)', 0, 128, 245);
      for (let y = a; y < b; y += 48) lay(L, 0, y, 1024, 2, 'rgba(255,255,255,0.35)', undefined, 150);
      for (let i = 0; i < 60; i++) { const x = r() * 1024, y = a + r() * (b - a), s = 10 + r() * 50; L.c.fillStyle = `rgba(80,76,70,${0.02 + r() * 0.04})`; L.c.beginPath(); L.c.ellipse(x, y, s, s * 0.6, r() * 3, 0, Math.PI * 2); L.c.fill(); }
      for (let i = 0; i < 8; i++) lay(L, r() * 1024, a + r() * (b - a), 8, 8, '#55534f');
    }
    // rooftop units: louvred grey metal
    {
      const [a, b] = F.mech;
      lay(L, 0, a, 1024, b - a, '#a9aba6', 0, 140, 140);
      for (let y = a + 40; y < b - 20; y += 7) lay(L, 0, y, 1024, 3, 'rgba(40,42,44,0.45)', undefined, 100);
      for (let x = 0; x < 1024; x += 128) lay(L, x, a, 3, b - a, 'rgba(0,0,0,0.3)');
      lay(L, 0, a, 1024, 8, '#c9cbc7');
    }
    // the penthouse: ribbed metal panel
    {
      const [a, b] = F.penthouse;
      lay(L, 0, a, 1024, b - a, '#c2c4c1', 0, 140, 130);
      for (let x = 0; x < 1024; x += 19) { lay(L, x, a, 3, b - a, 'rgba(255,255,255,0.35)', undefined, 200); lay(L, x + 3, a, 2, b - a, 'rgba(0,0,0,0.18)', undefined, 90); }
      lay(L, 0, a, 1024, 10, '#dfe1df'); lay(L, 0, a + 10, 1024, 3, 'rgba(0,0,0,0.3)');
    }
    gutters(cs, n, k, [[F.parapet + F.storey, F.pitch], [F.pitch + F.parapet + F.storey, 2 * F.pitch], [2 * F.pitch + F.parapet + F.storey, F.roof[0]], [F.roof[1], F.mech[0]], [F.mech[1], F.penthouse[0]]]);
    return finish(cs, n, H, 1.2, detail, true);
  });
}

// lens flare sprites: a soft warm glow for the sun itself, and a hollow ring for the ghosts down the lens axis
export function flareGlow(): THREE.Texture {
  return once('flareGlow', () => {
    const n = 256, [c, g] = mk(n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    // a small hot core and a long soft halo, so the sun reads as a point with glare rather than a flat disc
    gr.addColorStop(0, 'rgba(255,250,240,1)'); gr.addColorStop(0.06, 'rgba(255,245,228,0.85)'); gr.addColorStop(0.18, 'rgba(255,225,180,0.3)'); gr.addColorStop(0.4, 'rgba(255,210,155,0.09)'); gr.addColorStop(0.7, 'rgba(255,205,150,0.025)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
export function flareGhost(): THREE.Texture {
  return once('flareGhost', () => {
    const n = 128, [c, g] = mk(n, n);
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    // a faint disc with a soft bright rim (0.7 to 0.97), as a lens's internal reflections look
    gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.07)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.86, 'rgba(255,255,255,0.36)'); gr.addColorStop(0.97, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
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

// The low beams' pool on the road, seen from above and laid on a strip BEAM_POOL.w metres wide that runs from
// BEAM_POOL.near to BEAM_POOL.far metres ahead of the car's centre (near end at the bottom of the canvas). Two
// lamps' pools merge a few metres out into one wedge that widens with distance, full by 7 m, easing off toward a
// low beam's soft horizontal cut-off that sits farther out on the right (the kick-up that lights the shoulder and
// the signs), with a warm core inside a cooler rim and a faint scatter past the lit wedge. Painted in linear light;
// the alpha carries the shape. The SpotLights in PlayerCar still light the traffic and the walls; this is the patch
// the beams leave on the road, which a 1/d² spot cone can only paint as a blob at the bumper.
export const BEAM_POOL = { w: 12, near: 2, far: 40 };
export function beamPool(): THREE.Texture {
  return once('beamPool', () => {
    const w = 128, h = 512, [c, g] = mk(w, h), img = g.createImageData(w, h), d = img.data;
    const { w: W, near, far } = BEAM_POOL, row = new Float32Array(w);
    for (let j = 0; j < h; j++) {
      const k = far - (far - near) * ((j + 0.5) / h);          // metres ahead, far at the top of the canvas
      const sig = 0.33 + 0.1 * k;                               // each lamp's pool widens with distance
      let peak = 0;
      for (let i = 0; i < w; i++) {
        const x = ((i + 0.5) / w - 0.5) * W;
        const a = Math.exp(-((x - 0.62) ** 2) / (2 * sig * sig)) + Math.exp(-((x + 0.62) ** 2) / (2 * sig * sig));
        row[i] = a; if (a > peak) peak = a;
      }
      for (let i = 0; i < w; i++) {
        const x = ((i + 0.5) / w - 0.5) * W, core = row[i] / peak;
        const cut = 30 + 6 * smoothstep(-0.4, 1.4, x);          // the cut-off line, lifted on the right
        const along = smoothstep(near, 6.5, k) * (1 - 0.78 * smoothstep(10, cut, k)) * (1 - smoothstep(cut - 2, cut + 3, k));
        const spill = 0.13 * Math.exp(-(x * x) / (2 * (2.4 * sig) ** 2));
        const edge = 1 - smoothstep(W / 2 - 1.5, W / 2, Math.abs(x));
        const a = clamp((core + spill) * along * edge, 0, 1), m = Math.pow(core, 0.6);
        const o = (j * w + i) * 4;
        d[o] = (0.78 + 0.22 * m) * 255; d[o + 1] = (0.86 + 0.08 * m) * 255; d[o + 2] = (1 - 0.18 * m) * 255; d[o + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = tex(c, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = ANISO; return t;
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
