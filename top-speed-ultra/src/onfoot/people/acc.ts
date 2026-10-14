// What people wear beyond their clothes, all our own generic designs: hoop and stud earrings, a fine chain necklace,
// a watch and a bangle, glasses, and bags (a quilted shoulder bag on a chain strap, a crossbody bag). Chains and straps
// are laid on the person's outer surface (skin or clothes) by tracing a field; everything is skinned to the bones it
// rides on. One opaque mesh (vertex colour, per-vertex metalness/roughness, a quilting flag) plus glass lenses.
import * as THREE from 'three';
import { Rig, B } from './body';
import { Accessories, Look, Quality } from './params';
import { V3, add, sub, mul, norm, cross, dot, lerp, clamp, DEG } from './math';
import { NOISE } from './skin';

type Surf = (x: number, y: number, z: number) => number;

class MB {
  pos: number[] = []; nrm: number[] = []; col: number[] = []; pbr: number[] = []; uv: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = [];
  color: [number, number, number] = [1, 1, 1]; metal = 0; rough = 0.5; quilt = 0;
  bones: [number, number] = [B.head, B.head]; w2 = 0;
  v(p: V3, n: V3, u = 0, w = 0) {
    this.pos.push(p[0], p[1], p[2]); const nn = norm(n); this.nrm.push(nn[0], nn[1], nn[2]); this.uv.push(u, w);
    this.col.push(...this.color); this.pbr.push(this.metal, this.rough, this.quilt);
    this.si.push(this.bones[0], this.bones[1], 0, 0); this.sw.push(1 - this.w2, this.w2, 0, 0);
    return this.pos.length / 3 - 1;
  }
  setColor(hex: number) { const c = new THREE.Color(hex); this.color = [c.r, c.g, c.b]; }
  /** a tube along a path (closed or open) with radius r(t), `seg` sides; frames by parallel transport */
  tube(path: V3[], r: (t: number) => number, seg: number, closed: boolean) {
    const n = path.length, base = this.pos.length / 3;
    let prevN: V3 | null = null;
    for (let i = 0; i < n; i++) {
      const a = path[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const T = norm(sub(b, a));
      let N: V3 = prevN ? norm(sub(prevN, mul(T, dot(prevN, T)))) : norm(cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      if (!isFinite(N[0])) N = norm(cross(T, [1, 0, 0]));
      prevN = N;
      const Bn = cross(T, N), t = i / (closed ? n : n - 1), rr = r(t);
      for (let j = 0; j < seg; j++) {
        const a2 = (j / seg) * Math.PI * 2, d = add(mul(N, Math.cos(a2)), mul(Bn, Math.sin(a2)));
        this.v(add(path[i], mul(d, rr)), d, t, j / seg);
      }
    }
    const rings = closed ? n : n - 1;
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg), c = base + ((i + 1) % n) * seg + j, d = base + ((i + 1) % n) * seg + ((j + 1) % seg);
      this.idx.push(a, c, d, a, d, b);
    }
  }
  /** a rounded box (superellipsoid) with axes ex, ey, ez and half sizes; uv = the face coordinates for quilting */
  roundBox(c: V3, ex: V3, ey: V3, ez: V3, hx: number, hy: number, hz: number, nu = 18, nv = 12) {
    const base = this.pos.length / 3, p = 0.22;
    const sgn = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i <= nv; i++) {
      const th = -Math.PI / 2 + Math.PI * (i / nv);
      for (let j = 0; j <= nu; j++) {
        const ph = -Math.PI + 2 * Math.PI * (j / nu);
        const x = sgn(Math.cos(th), p) * sgn(Math.cos(ph), p), y = sgn(Math.sin(th), p), z = sgn(Math.cos(th), p) * sgn(Math.sin(ph), p);
        const q = add(c, add(add(mul(ex, x * hx), mul(ey, y * hy)), mul(ez, z * hz)));
        const nx = sgn(Math.cos(th), 2 - p) * sgn(Math.cos(ph), 2 - p) / hx, ny = sgn(Math.sin(th), 2 - p) / hy, nz = sgn(Math.cos(th), 2 - p) * sgn(Math.sin(ph), 2 - p) / hz;
        this.v(q, add(add(mul(ex, nx), mul(ey, ny)), mul(ez, nz)), x * hx * 10, y * hy * 10);
      }
    }
    for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
      const a = base + i * (nu + 1) + j, b = a + 1, c2 = a + nu + 1, d = c2 + 1;
      this.idx.push(a, b, d, a, d, c2);
    }
  }
}

/** push a point out onto a surface along the surface's gradient, then out by `off` */
function onSurface(f: Surf, p: V3, off: number): V3 {
  let q = p.slice() as V3;
  for (let it = 0; it < 6; it++) {
    const e = 0.0008, d = f(q[0], q[1], q[2]);
    const g = norm([f(q[0] + e, q[1], q[2]) - d, f(q[0], q[1] + e, q[2]) - d, f(q[0], q[1], q[2] + e) - d]);
    const k = d - off;
    q = [q[0] - g[0] * k, q[1] - g[1] * k, q[2] - g[2] * k];
    if (Math.abs(k) < 0.0002) break;
  }
  return q;
}

export function accMaterial(quality: Quality) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: quality === 'high' ? 0.2 : 0, clearcoatRoughness: 0.3, envMapIntensity: 1.1 });
  m.customProgramCacheKey = () => 'acc-' + quality;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPbr; attribute vec2 aUv; varying vec3 vPbr; varying vec2 vAuv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = aPbr; vAuv = aUv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPbr; varying vec2 vAuv;\n${NOISE}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vPbr.y;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.x;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (vPbr.z > 0.5) {
  // diamond quilting: stitched seams in two diagonals, the leather puffing between them
  vec2 q = vAuv * 18.0;
  float a = abs(fract((q.x + q.y) * 0.5) - 0.5), b = abs(fract((q.x - q.y) * 0.5) - 0.5);
  float H = -smoothstep(0.08, 0.0, a) - smoothstep(0.08, 0.0, b) + 0.6 * (min(a, b));
  normal = bumpNormal(-vViewPosition, normal, H * 0.0025, faceDirection);
}`);
  };
  return m;
}

export function buildAccessories(rig: Rig, acc: Accessories, look: Look, quality: Quality, outer: Surf) {
  const mb = new MB(), hf = rig.head;
  const hq = quality === 'high';
  const face = hf.face;
  // ---- earrings
  for (const sg of [1, -1]) {
    const eo = face.earOut, esz = face.earSize;
    const lobe = hf.toBody([sg * (0.0745 + 0.004 * eo - 0.0015), -0.014 - 0.03 * esz, -0.081 + 0.004]);
    mb.bones = [B.head, B.head]; mb.w2 = 0;
    if (acc.hoops !== null) {
      mb.setColor(acc.hoops); mb.metal = 1; mb.rough = 0.18; mb.quilt = 0;
      const R = 0.017 * hf.sx, path: V3[] = [];
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; path.push([lobe[0] + sg * 0.0025, lobe[1] - R + Math.cos(a) * R, lobe[2] + Math.sin(a) * R]); }
      mb.tube(path, () => 0.0013, hq ? 8 : 6, true);
    } else if (acc.studs !== null) {
      mb.setColor(acc.studs); mb.metal = 1; mb.rough = 0.15;
      const path: V3[] = [];
      for (let i = 0; i < 6; i++) path.push([lobe[0] + sg * (0.0005 + i * 0.0003), lobe[1], lobe[2] + 0.002]);
      mb.tube(path, (t) => 0.0024 * Math.sin(Math.PI * clamp(t * 0.95 + 0.03)), 8, false);
    }
  }
  // ---- a fine chain round the neck, lying on the skin or the top, a little lower in front
  const L = rig.limb, s = rig.s, jug = rig.joints[B.neck][1];
  if (acc.chain !== null) {
    mb.setColor(acc.chain); mb.metal = 1; mb.rough = 0.22;
    const path: V3[] = [], N = 72;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, cz = Math.cos(a), sx = Math.sin(a);
      const front = Math.max(0, cz);
      const y = jug + 0.02 * s - 0.075 * s * Math.pow(front, 1.6) + 0.012 * s * (1 - front);
      const p: V3 = [sx * (L.neckR + 0.03), y, L.neckBase[2] + 0.006 + cz * (L.neckR + 0.035)];
      path.push(onSurface(outer, p, 0.0012));
    }
    const start = mb.pos.length / 3;
    mb.bones = [B.chest, B.neck];
    mb.tube(path, (t) => 0.00062 * (1 + 0.35 * Math.abs(Math.sin(t * 900))), 5, true);
    // the back of the chain follows the neck more than the chest
    for (let v = start; v < mb.pos.length / 3; v++) { const z = mb.pos[v * 3 + 2]; const w = clamp((L.neckBase[2] - z) / 0.05, 0, 1) * 0.6; mb.sw[v * 4] = 1 - w; mb.sw[v * 4 + 1] = w; }
  }
  // ---- watch (left wrist) and bangle (right wrist): bands traced round the actual wrist
  const wrist = (sg: number, extra: number) => {
    const w = rig.wrist[sg > 0 ? 0 : 1];
    const c = sub(w.p, mul(w.n, 0.012 * s)), ax = w.n;
    const u = norm(cross(ax, [0, 0, 1])), v = cross(ax, u);
    const ring: V3[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      // trace in from outside
      let t = 0.08;
      for (let k = 0; k < 40; k++) { const q = add(c, mul(d, t)), f = rig.field.eval(q[0], q[1], q[2], null, 0); if (f < 0.0004) break; t -= Math.max(0.0005, f); }
      ring.push(add(c, mul(d, t + extra)));
    }
    return { ring, c, ax, u, v };
  };
  if (acc.watch !== null) {
    const W = wrist(1, 0.0022);
    mb.bones = [B.foreL, B.handL]; mb.w2 = 0.3;
    // the strap: a flattened band (two tubes side by side read as a strap at this size)
    mb.setColor(acc.watch === 0x161616 ? 0x161616 : 0x2a1c14); mb.metal = acc.watch === 0x161616 ? 0 : 0; mb.rough = 0.5;
    if (acc.watch !== 0x161616) { mb.setColor(acc.watch); mb.metal = 1; mb.rough = 0.25; }
    for (const off of [-0.0045, 0, 0.0045]) mb.tube(W.ring.map((p) => add(p, mul(W.ax, off))), () => 0.0022, 6, true);
    // the case on the back of the wrist: lateral, away from the body in the rest pose (palms face the thighs)
    let hN = norm(sub([1, 0, 0], mul(W.ax, W.ax[0])));
    let t = 0.08;
    for (let k = 0; k < 40; k++) { const q = add(W.c, mul(hN, t)), f = rig.field.eval(q[0], q[1], q[2], null, 0); if (f < 0.0004) break; t -= Math.max(0.0005, f); }
    hN = norm(hN);
    const top = add(W.c, mul(hN, t + 0.0035));
    const caseR = 0.0165 * s;
    mb.setColor(acc.watch); mb.metal = 1; mb.rough = 0.2;
    const pathC: V3[] = [];
    for (let i = 0; i < 6; i++) pathC.push(add(top, mul(hN, -0.004 + i * 0.0018)));
    mb.tube(pathC, (t) => caseR * (t < 0.8 ? 1 : 1 - (t - 0.8) * 1.5), 20, false);
    mb.setColor(0x0c0d10); mb.metal = 0; mb.rough = 0.05;
    const face: V3[] = [add(top, mul(hN, 0.0052)), add(top, mul(hN, 0.0056))];
    mb.tube(face, (t) => caseR * 0.86 * (1 - t), 20, false);
  }
  if (acc.bracelet !== null) {
    const W = wrist(-1, 0.003);
    mb.bones = [B.foreR, B.handR]; mb.w2 = 0.3;
    mb.setColor(acc.bracelet); mb.metal = 1; mb.rough = 0.2;
    mb.tube(W.ring.map((p) => add(p, mul(W.ax, -0.01))), () => 0.0016, 8, true);
  }
  // ---- bags
  const D = rig.dims;
  if (acc.bag !== 'none') {
    const quilted = acc.bag === 'quilted';
    const side = quilted ? 1 : -1;                       // the bag hangs on this side; a crossbody's strap crosses from the other shoulder
    const hw = (quilted ? 0.115 : 0.095) * s, hh = (quilted ? 0.072 : 0.065) * s, hd = (quilted ? 0.03 : 0.028) * s;
    const yB = D.hipY + (quilted ? 0.05 : 0.07) * s, xB = side * (D.hipHalf + hd + 0.012), zB = quilted ? -0.015 : 0.035;
    const c: V3 = [xB, yB, zB];
    const ex: V3 = [0, 0, 1], ey: V3 = [0, 1, 0], ez: V3 = [side, 0, 0];
    mb.bones = [B.hips, B.spine]; mb.w2 = 0.3;
    mb.setColor(acc.bagColor); mb.metal = 0; mb.rough = quilted ? 0.42 : 0.55; mb.quilt = quilted ? 1 : 0;
    mb.roundBox(c, ex, ey, ez, hw, hh, hd, hq ? 22 : 14, hq ? 14 : 9);
    mb.quilt = 0;
    // the flap's clasp
    mb.setColor(quilted ? 0xd8b25a : 0x9a9da3); mb.metal = 1; mb.rough = 0.2;
    const cl = add(c, add(mul(ey, hh * 0.35), mul(ez, hd + 0.002)));
    mb.tube([add(cl, mul(ez, -0.002)), add(cl, mul(ez, 0.002))], () => 0.006 * s, 12, false);
    // the strap: from the bag's top corners over the shoulder (the same side for a shoulder bag, the other for a crossbody)
    const sh = quilted ? side : -side;
    const shTop: V3 = [sh * (L.sh[0] * 0.62), D.shoulderY + 0.03 * s, -0.02 * s];
    const a0 = add(c, add(mul(ey, hh), mul(ex, hw * 0.75))), a1 = add(c, add(mul(ey, hh), mul(ex, -hw * 0.75)));
    const path: V3[] = [];
    const M = 46;
    for (let i = 0; i <= M; i++) {
      const t = i / M;
      // front corner -> over the shoulder -> back corner
      let p: V3;
      if (t < 0.5) { const u = t / 0.5; p = [lerp(a0[0], shTop[0], u), lerp(a0[1], shTop[1], u * u * (3 - 2 * u)), lerp(a0[2], 0.06 * s, u) * (1 - u) + shTop[2] * u + Math.sin(u * Math.PI) * (quilted ? 0.05 : 0.11) * s]; }
      else { const u = (t - 0.5) / 0.5; p = [lerp(shTop[0], a1[0], u), lerp(shTop[1], a1[1], u * u * (3 - 2 * u) * 0 + u), lerp(shTop[2], a1[2], u) - Math.sin(u * Math.PI) * 0.06 * s]; }
      if (!quilted) p[0] = lerp(p[0], -p[0] * 0.2, Math.sin(Math.PI * t) * 0.6);
      path.push(t > 0.04 && t < 0.96 ? onSurface(outer, p, 0.004) : p);
    }
    const st = mb.pos.length / 3;
    mb.bones = [B.chest, B.hips];
    if (quilted) { mb.setColor(0xd8b25a); mb.metal = 1; mb.rough = 0.22; mb.tube(path, (t) => 0.0024 * (1 + 0.45 * Math.abs(Math.sin(t * 210))), 6, false); }
    else { mb.setColor(acc.bagColor); mb.metal = 0; mb.rough = 0.55; for (const o2 of [-0.004, 0.004]) mb.tube(path.map((p) => [p[0] + o2 * 0.3, p[1], p[2] + o2] as V3), () => 0.0026, 5, false); }
    for (let v = st; v < mb.pos.length / 3; v++) { const y = mb.pos[v * 3 + 1]; const w = clamp((D.chestY - y) / (D.chestY - yB), 0, 1); mb.sw[v * 4] = 1 - w; mb.sw[v * 4 + 1] = w; }
  }
  // ---- glasses: rims, bridge and temples (opaque), lenses (glass)
  let lenses: THREE.SkinnedMesh | null = null;
  if (look.glasses) {
    mb.bones = [B.head, B.head]; mb.w2 = 0;
    const metalFrame = (look.hairColor % 3) === 0;
    mb.setColor(metalFrame ? 0xb8a070 : 0x14110f); mb.metal = metalFrame ? 1 : 0; mb.rough = metalFrame ? 0.25 : 0.3;
    const rw = 0.025, rh = 0.0175, zr = 0.031, tilt = 8 * DEG;
    const rim = (sg: number) => {
      const pts: V3[] = [];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2, cx = Math.cos(a), sy = Math.sin(a);
        const x = sg * (hf.eye.x + 0.001) + rw * Math.sign(cx) * Math.pow(Math.abs(cx), 0.75), y = -0.003 + rh * Math.sign(sy) * Math.pow(Math.abs(sy), 0.8);
        const z = zr - 0.004 * ((x - sg * hf.eye.x) / rw) ** 2 * 0 - (y + 0.003) * Math.sin(tilt) - 0.006 * Math.max(0, sg * (x - sg * hf.eye.x)) / rw;
        pts.push(hf.toBody([x, y, z]));
      }
      return pts;
    };
    const R = metalFrame ? 0.0011 : 0.0021;
    const rims = [rim(1), rim(-1)];
    for (const r of rims) mb.tube(r, () => R, 6, true);
    mb.tube([hf.toBody([0.0075, 0.006, zr + 0.001]), hf.toBody([0, 0.0075, zr + 0.002]), hf.toBody([-0.0075, 0.006, zr + 0.001])], () => R * 0.9, 6, false);
    for (const sg of [1, -1]) {
      const path: V3[] = [hf.toBody([sg * (hf.eye.x + rw), 0.004, zr - 0.006]), hf.toBody([sg * 0.07, 0.005, 0.0]), hf.toBody([sg * 0.074, 0.002, -0.05]), hf.toBody([sg * 0.072, -0.008, -0.083])];
      mb.tube(path, () => R * 0.85, 5, false);
    }
    // lenses: a fan of triangles inside each rim
    const lg = new THREE.BufferGeometry(), lp: number[] = [], li: number[] = [];
    for (const r of rims) {
      const c = r.reduce((a, p) => add(a, mul(p, 1 / r.length)), [0, 0, 0] as V3), b = lp.length / 3;
      lp.push(...c);
      for (const p of r) lp.push(...add(p, mul(sub(c, p), 0.02)));
      for (let i = 0; i < r.length; i++) li.push(b, b + 1 + i, b + 1 + ((i + 1) % r.length));
    }
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lg.setIndex(li); lg.computeVertexNormals();
    const n = lp.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = B.head; sw[i * 4] = 1; }
    lg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); lg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const lm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
    lenses = new THREE.SkinnedMesh(lg, lm);
    lenses.name = 'lenses'; lenses.renderOrder = 3;
  }
  if (!mb.idx.length) return { meshes: [] as THREE.SkinnedMesh[], mats: [] as THREE.Material[] };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(mb.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(mb.col, 3));
  g.setAttribute('aPbr', new THREE.Float32BufferAttribute(mb.pbr, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(mb.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(mb.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(mb.sw, 4));
  g.setIndex(mb.idx);
  const mat = accMaterial(quality);
  const mesh = new THREE.SkinnedMesh(g, mat);
  mesh.name = 'accessories';
  const meshes: THREE.SkinnedMesh[] = [mesh];
  const mats: THREE.Material[] = [mat];
  if (lenses) { meshes.push(lenses); mats.push(lenses.material as THREE.Material); }
  return { meshes, mats };
}
