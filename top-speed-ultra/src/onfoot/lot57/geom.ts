// Geometry helpers for the on-foot venue: a batch that collects coloured triangles (boxes, cylinders, quads, ribbons,
// polygon caps, extruded walls) and turns them into one BufferGeometry, so a whole family of props is one draw call.
// Local frame: x east, y up, z south, metres from ORIGIN (coords.ts). Colours are sRGB hex.
//
// Night light is baked per vertex ("glow", three channels: the venue's own lights, the street and lot lights, the
// Shed's interior lights) from a list of point emitters, and the materials (mats.ts glowify) add albedo x glow x the
// channel's level to the emissive term. A whole lit yard costs no real-time lights; big flat areas are built as
// subdivided grids so the light pools read.
import * as THREE from 'three';

export type P2 = [number, number];
const _c = new THREE.Color();

/** a point of light for the baked glow: position, strength (lumen-ish units), channel 0 venue, 1 street, 2 interior */
export interface Emitter { x: number; y: number; z: number; i: number; ch: 0 | 1 | 2; reach?: number; down?: number }

export class Batch {
  pos: number[] = []; nor: number[] = []; col: number[] = []; uv: number[] = [];
  glow: Float32Array | null = null;
  /** world-scale UVs: metres per texture repeat */
  constructor(public uvScale = 4) {}
  get empty() { return this.pos.length === 0; }
  get vertices() { return this.pos.length / 3; }

  /** darken vertical faces toward the ground and undersides (a cheap baked occlusion); off for flat ground batches */
  ao = true;
  private v(x: number, y: number, z: number, nx: number, ny: number, nz: number, r: number, g: number, b: number, u: number, w: number) {
    if (this.ao) {
      const k = ny < -0.6 ? 0.55 : ny > 0.7 ? 1 : 0.68 + 0.32 * Math.min(1, Math.max(0, y / 1.1));
      r *= k; g *= k; b *= k;
    }
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.col.push(r, g, b); this.uv.push(u, w);
  }
  /** a triangle with a flat normal and world-projected UVs (projection picked from the normal) */
  tri(a: number[], b: number[], c: number[], hex: number, shade = 1) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    _c.setHex(hex); const r = _c.r * shade, g = _c.g * shade, bb = _c.b * shade, s = this.uvScale;
    const proj = (p: number[]): [number, number] => Math.abs(ny) > 0.7 ? [p[0] / s, p[2] / s] : Math.abs(nx) > Math.abs(nz) ? [p[2] / s, p[1] / s] : [p[0] / s, p[1] / s];
    for (const p of [a, b, c]) { const [u, w] = proj(p); this.v(p[0], p[1], p[2], nx, ny, nz, r, g, bb, u, w); }
  }
  quad(a: number[], b: number[], c: number[], d: number[], hex: number, shade = 1) { this.tri(a, b, c, hex, shade); this.tri(a, c, d, hex, shade); }
  /** a quad with explicit UVs: a bottom-left, b bottom-right, c top-right, d top-left, as seen from the side it faces */
  uvQuad(a: number[], b: number[], c: number[], d: number[], r: { u0: number; v0: number; u1: number; v1: number }, hex = 0xffffff) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    _c.setHex(hex);
    const V = (p: number[], u: number, w: number) => { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(_c.r, _c.g, _c.b); this.uv.push(u, w); };
    V(a, r.u0, r.v0); V(b, r.u1, r.v0); V(c, r.u1, r.v1);
    V(a, r.u0, r.v0); V(c, r.u1, r.v1); V(d, r.u0, r.v1);
  }
  /** a vertical rectangle centred at (cx, cy, cz), w x h, facing (nx, nz), with explicit UVs */
  panel(cx: number, cy: number, cz: number, w: number, h: number, nx: number, nz: number, r: { u0: number; v0: number; u1: number; v1: number }, hex = 0xffffff) {
    const rx = nz * w / 2, rz = -nx * w / 2, hy = h / 2;
    this.uvQuad([cx - rx, cy - hy, cz - rz], [cx + rx, cy - hy, cz + rz], [cx + rx, cy + hy, cz + rz], [cx - rx, cy + hy, cz - rz], r, hex);
  }

  /** an axis-aligned box (rotated about y by `rot` round its centre); `faces` can colour faces by outward normal */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: number, rot = 0, faces?: (nx: number, nz: number, ny: number) => number | null) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, c = Math.cos(rot), s = Math.sin(rot);
    const P = (x: number, y: number, z: number) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const f = (nx: number, ny: number, nz: number) => {
      const wx = nx * c + nz * s, wz = -nx * s + nz * c;
      const h = faces ? faces(wx, wz, ny) : hex;
      return h === null ? null : (h ?? hex);
    };
    const add = (a: number[], b: number[], cc: number[], d: number[], h: number | null) => { if (h !== null) this.quad(a, b, cc, d, h); };
    add(P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), f(0, 1, 0));      // top
    add(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), f(0, -1, 0)); // bottom
    add(P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(hx, -hy, hz), f(1, 0, 0));      // +x
    add(P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), P(-hx, -hy, -hz), f(-1, 0, 0)); // -x
    add(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), f(0, 0, 1));      // +z
    add(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), f(0, 0, -1)); // -z
  }
  /** a box from two corners (min, max) */
  boxMM(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: number, faces?: (nx: number, nz: number, ny: number) => number | null) {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), hex, 0, faces);
  }
  /** a vertical cylinder (or cone) from y0 to y1 */
  cyl(x: number, y0: number, z: number, r0: number, r1: number, h: number, seg: number, hex: number, caps = true) {
    _c.setHex(hex);
    const r = _c.r, g = _c.g, b = _c.b, y1 = y0 + h, s = this.uvScale;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const slope = (r0 - r1) / Math.max(1e-6, h);
      const n0 = new THREE.Vector3(c0, slope, s0).normalize(), n1 = new THREE.Vector3(c1, slope, s1).normalize();
      const A = [x + c0 * r0, y0, z + s0 * r0], B = [x + c1 * r0, y0, z + s1 * r0], C = [x + c1 * r1, y1, z + s1 * r1], D = [x + c0 * r1, y1, z + s0 * r1];
      const u0 = (i / seg) * 2 * Math.PI * Math.max(r0, r1) / s, u1 = ((i + 1) / seg) * 2 * Math.PI * Math.max(r0, r1) / s;
      this.v(A[0], A[1], A[2], n0.x, n0.y, n0.z, r, g, b, u0, y0 / s); this.v(D[0], D[1], D[2], n0.x, n0.y, n0.z, r, g, b, u0, y1 / s); this.v(C[0], C[1], C[2], n1.x, n1.y, n1.z, r, g, b, u1, y1 / s);
      this.v(A[0], A[1], A[2], n0.x, n0.y, n0.z, r, g, b, u0, y0 / s); this.v(C[0], C[1], C[2], n1.x, n1.y, n1.z, r, g, b, u1, y1 / s); this.v(B[0], B[1], B[2], n1.x, n1.y, n1.z, r, g, b, u1, y0 / s);
      if (caps) {
        if (r1 > 0) this.tri([x, y1, z], C, D, hex);
        if (r0 > 0) this.tri([x, y0, z], A, B, hex);
      }
    }
  }
  /** a cylinder between two 3D points (rails, struts, pipes) */
  tube(a: number[], b: number[], r: number, seg: number, hex: number) {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = B.clone().sub(A), len = d.length();
    if (len < 1e-6) return;
    d.divideScalar(len);
    const up = Math.abs(d.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(d, up).normalize(), w = new THREE.Vector3().crossVectors(d, u).normalize();
    _c.setHex(hex);
    const r0 = _c.r, g0 = _c.g, b0 = _c.b;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const n0 = u.clone().multiplyScalar(Math.cos(a0)).addScaledVector(w, Math.sin(a0));
      const n1 = u.clone().multiplyScalar(Math.cos(a1)).addScaledVector(w, Math.sin(a1));
      const p0 = A.clone().addScaledVector(n0, r), p1 = A.clone().addScaledVector(n1, r), p2 = B.clone().addScaledVector(n1, r), p3 = B.clone().addScaledVector(n0, r);
      const V = (p: THREE.Vector3, n: THREE.Vector3) => this.v(p.x, p.y, p.z, n.x, n.y, n.z, r0, g0, b0, 0, 0);
      V(p0, n0); V(p3, n0); V(p2, n1); V(p0, n0); V(p2, n1); V(p1, n1);
    }
  }
  /** a flat polygon (ring of [x, z], any winding, optional holes) at height y, facing up */
  cap(ring: P2[], y: number, hex: number, holes: P2[][] = [], down = false) {
    if (ring.length < 3) return;
    const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
    const hs = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    for (const h of hs) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
    const all = contour.concat(...hs);
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
    for (const [i, j, k] of tris) {
      const a = all[i], b = all[j], c = all[k];
      // x-z with y up: a counter-clockwise ring in (x, z) faces down, so swap for an upward face
      if (down) this.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], hex);
      else this.tri([a.x, y, a.y], [c.x, y, c.y], [b.x, y, b.y], hex);
    }
  }
  /** vertical walls round a ring from y0 to y1 (outward faces), with per-edge colour */
  walls(ring: P2[], y0: number, y1: number, hex: number | ((i: number) => number), inward = false) {
    const n = ring.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
    const ccw = area > 0;   // in (x, z) with z south: positive area = counter-clockwise seen from above with z down the page
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const h = typeof hex === 'function' ? hex(i) : hex;
      let p0 = [a[0], y0, a[1]], p1 = [b[0], y0, b[1]], p2 = [b[0], y1, b[1]], p3 = [a[0], y1, a[1]];
      if (ccw !== inward) { [p0, p1, p2, p3] = [p1, p0, p3, p2]; }
      this.quad(p0, p1, p2, p3, h);
    }
  }
  /** a flat strip along a polyline (width w) at height y */
  ribbon(pts: P2[], w: number, y: number, hex: number) {
    if (pts.length < 2) return;
    const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
    for (let i = 0; i + 1 < pts.length; i++) {
      this.quad([L[i][0], y, L[i][1]], [R[i][0], y, R[i][1]], [R[i + 1][0], y, R[i + 1][1]], [L[i + 1][0], y, L[i + 1][1]], hex);
    }
  }
  /** a raised strip (a sidewalk): top at y1 with side faces down to y0 */
  slab(pts: P2[], w: number, y0: number, y1: number, hex: number, side = hex) {
    if (pts.length < 2) return;
    const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
    for (let i = 0; i + 1 < pts.length; i++) {
      this.quad([L[i][0], y1, L[i][1]], [R[i][0], y1, R[i][1]], [R[i + 1][0], y1, R[i + 1][1]], [L[i + 1][0], y1, L[i + 1][1]], hex);
      this.quad([L[i + 1][0], y0, L[i + 1][1]], [L[i][0], y0, L[i][1]], [L[i][0], y1, L[i][1]], [L[i + 1][0], y1, L[i + 1][1]], side, 0.85);
      this.quad([R[i][0], y0, R[i][1]], [R[i + 1][0], y0, R[i + 1][1]], [R[i + 1][0], y1, R[i + 1][1]], [R[i][0], y1, R[i][1]], side, 0.85);
    }
  }
  /** merge another batch in, moved by (dx, dy, dz) and turned by rot round y */
  add(o: Batch, dx = 0, dy = 0, dz = 0, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < o.pos.length; i += 3) {
      const x = o.pos[i], y = o.pos[i + 1], z = o.pos[i + 2];
      this.pos.push(dx + x * c + z * s, dy + y, dz - x * s + z * c);
      const nx = o.nor[i], ny = o.nor[i + 1], nz = o.nor[i + 2];
      this.nor.push(nx * c + nz * s, ny, -nx * s + nz * c);
      this.col.push(o.col[i], o.col[i + 1], o.col[i + 2]);
    }
    for (let i = 0; i < o.uv.length; i++) this.uv.push(o.uv[i]);
  }
  /** a flat, subdivided rectangle facing up (so baked light pools read on it); step in metres */
  grid(x0: number, z0: number, x1: number, z1: number, y: number, hex: number, step = 1, keep?: (x: number, z: number) => boolean) {
    const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const ax = x0 + ((x1 - x0) * i) / nx, bx = x0 + ((x1 - x0) * (i + 1)) / nx, az = z0 + ((z1 - z0) * j) / nz, bz = z0 + ((z1 - z0) * (j + 1)) / nz;
      if (keep && !keep((ax + bx) / 2, (az + bz) / 2)) continue;
      this.quad([ax, y, az], [ax, y, bz], [bx, y, bz], [bx, y, az], hex);
    }
  }
  /**
   * Bake the night light from point emitters into the glow attribute: each vertex gets, per channel, the sum of
   * strength x a soft facing term / (distance squared + 1), out to each emitter's reach. Emitters are hashed in 8 m
   * cells so a batch of 100k vertices against a few hundred emitters stays quick.
   */
  bake(emitters: Emitter[], wrap = 0.35) {
    const n = this.vertices, g = this.glow ?? new Float32Array(n * 3);
    if (g.length !== n * 3) throw new Error('bake: batch changed after an earlier bake');
    const C = 8, cells = new Map<number, Emitter[]>(), key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
    let maxReach = 0;
    for (const e of emitters) {
      const r = e.reach ?? 26; maxReach = Math.max(maxReach, r);
      const k = key(Math.floor(e.x / C), Math.floor(e.z / C));
      let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(e);
    }
    const R = Math.ceil(maxReach / C), P = this.pos, N = this.nor;
    for (let v = 0; v < n; v++) {
      const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
      const ci = Math.floor(px / C), cj = Math.floor(pz / C);
      let a = 0, b = 0, c = 0;
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const l = cells.get(key(ci + di, cj + dj)); if (!l) continue;
        for (const e of l) {
          const dx = e.x - px, dy = e.y - py, dz = e.z - pz, d2 = dx * dx + dy * dy + dz * dz, reach = e.reach ?? 26;
          if (d2 > reach * reach) continue;
          const d = Math.sqrt(d2) || 1;
          let f = (dx * nx + dy * ny + dz * nz) / d;
          f = (f + wrap) / (1 + wrap); if (f <= 0) continue;
          // a downlight (lot and street heads) throws most of its light down
          if (e.down) { const cosd = -dy / d; f *= Math.max(0.08, cosd) ** e.down; }
          const fall = 1 - (d / reach) ** 2;
          const w = (e.i * f * fall) / (d2 + 1);
          if (e.ch === 0) a += w; else if (e.ch === 1) b += w; else c += w;
        }
      }
      g[v * 3] += a; g[v * 3 + 1] += b; g[v * 3 + 2] += c;
    }
    this.glow = g;
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('glow', new THREE.BufferAttribute(this.glow ?? new Float32Array(this.vertices * 3), 3));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat: THREE.Material, name: string, o: { cast?: boolean; receive?: boolean } = {}) {
    const m = new THREE.Mesh(this.build(), mat);
    m.name = name; m.castShadow = !!o.cast; m.receiveShadow = o.receive ?? true;
    return m;
  }
}

/** offset a polyline sideways by d (positive = left of the direction of travel, seen from above with y up) */
export function offsetLine(pts: P2[], d: number): P2[] {
  const n = pts.length, out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
    let tx0 = b[0] - a[0], tz0 = b[1] - a[1], tx1 = c[0] - b[0], tz1 = c[1] - b[1];
    const l0 = Math.hypot(tx0, tz0) || 1, l1 = Math.hypot(tx1, tz1) || 1;
    tx0 /= l0; tz0 /= l0; tx1 /= l1; tz1 /= l1;
    if (i === 0) { tx0 = tx1; tz0 = tz1; }
    if (i === n - 1) { tx1 = tx0; tz1 = tz0; }
    // the left normal of (tx, tz) in x-z with y up is (tz, -tx)
    let nx = tz0 + tz1, nz = -(tx0 + tx1);
    const nl = Math.hypot(nx, nz);
    if (nl < 1e-6) { nx = tz1; nz = -tx1; } else { nx /= nl; nz /= nl; }
    const cos = nx * tz1 + nz * -tx1;
    const k = d / Math.max(0.35, cos);     // mitre, limited
    out.push([b[0] + nx * k, b[1] + nz * k]);
  }
  return out;
}

export const polyLen = (pts: P2[]) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

/** points every `step` metres along a polyline (with the direction there) */
export function along(pts: P2[], step: number, start = step / 2): { x: number; z: number; dx: number; dz: number }[] {
  const out: { x: number; z: number; dx: number; dz: number }[] = [];
  let t = start;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 1e-6) continue;
    while (t <= l) { const k = t / l; out.push({ x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, dx: (x1 - x0) / l, dz: (z1 - z0) / l }); t += step; }
    t -= l;
  }
  return out;
}

export function pointInPoly(x: number, z: number, ring: P2[] | Float64Array): boolean {
  let inside = false;
  if (ring instanceof Float64Array) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i * 2], zi = ring[i * 2 + 1], xj = ring[j * 2], zj = ring[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** a seeded random number generator (mulberry32) */
export function rand(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** a canvas texture painted in code */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { srgb?: boolean; repeat?: boolean } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Batches waiting to become meshes: the venue, the lot and the streets add theirs, the page collects every light
 * (emitters), then finish() bakes the night light into each glowing batch and makes the meshes in one group.
 */
export interface KitEntry { name: string; batch: Batch; mat: THREE.Material; cast: boolean; receive: boolean; glow: boolean; order?: number; layer?: number }
export class Kit {
  entries: KitEntry[] = [];
  emitters: Emitter[] = [];
  /** a batch per name, made on first use */
  private byName = new Map<string, KitEntry>();
  get(name: string, mat: THREE.Material, o: { uv?: number; cast?: boolean; receive?: boolean; glow?: boolean; ao?: boolean; order?: number } = {}): Batch {
    let e = this.byName.get(name);
    if (!e) {
      const b = new Batch(o.uv ?? 4); b.ao = o.ao ?? true;
      e = { name, batch: b, mat, cast: o.cast ?? false, receive: o.receive ?? true, glow: o.glow ?? true, order: o.order };
      this.byName.set(name, e); this.entries.push(e);
    }
    return e.batch;
  }
  light(e: Emitter) { this.emitters.push(e); }
  finish(group: THREE.Group, emitters: Emitter[] = this.emitters, castShadows = true): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const e of this.entries) {
      if (e.batch.empty) continue;
      if (e.glow) e.batch.bake(emitters);
      const m = e.batch.mesh(e.mat, e.name, { cast: castShadows && e.cast, receive: e.receive });
      if (e.order !== undefined) m.renderOrder = e.order;
      group.add(m); out.push(m);
    }
    return out;
  }
}
