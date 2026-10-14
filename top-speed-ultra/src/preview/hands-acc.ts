// What the driver wears on the arms: shirt sleeves to the shoulders (a pressed shirt's buttoned cuffs, a racing top's
// knit sleeves, or a work shirt rolled to below the elbow), the watch on the left wrist (our own unbranded designs:
// a gold or steel three-hand watch with a domed crystal, polished bezel, applied indices and a link bracelet, or a
// smart watch with a lit face on a sport band), a ring and a rope bangle for the female look.
// Everything is built round the arm's actual skin (rays cast into the hand's distance field), in the grip frame G
// (mm) as the right arm, and mirrored to the left where it's worn there. All of it is skinned to the arm's bones.
import * as THREE from 'three';
import type { DriverLook } from '../game/drivers';
import { Anatomy, V3, add, cross, dot, len, madd, mul, norm, perp, sub, lerp3, G_FINGER } from './hands-sdf';
import type { Quality } from './hands-skin';

export interface AccOptions {
  anatomy: Anatomy; look: DriverLook; female: boolean; quality: Quality; watchTime: [number, number, number];
  toCar(p: V3, side: number): V3; dirToCar(d: V3, side: number): V3;
}
export interface Accessories { meshes: THREE.SkinnedMesh[]; sleeveFrom: number }

// ------------------------------------------------------------------------------------------------ mesh builder
class MB {
  pos: number[] = []; nrm: number[] = []; uv: number[] = []; col: number[] = []; pbr: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = [];
  color: [number, number, number] = [1, 1, 1]; metal = 0; rough = 0.5; bone = 0; bone2 = 0; w2 = 0;
  constructor(public side: number, public o: AccOptions) {}
  v(p: V3, n: V3, u = 0, w = 0) {
    this.pos.push(...this.o.toCar(p, this.side)); this.nrm.push(...this.o.dirToCar(norm(n), this.side)); this.uv.push(u, w);
    this.col.push(...this.color); this.pbr.push(this.metal, this.rough);
    const b0 = this.side * 3;
    this.si.push(b0 + this.bone, b0 + this.bone2, 0, 0); this.sw.push(1 - this.w2, this.w2, 0, 0);
    return this.pos.length / 3 - 1;
  }
  // a triangle given in G with outward winding (G is mirrored once; the left side mirrors it back)
  t(a: number, b: number, c: number) { if (this.side === 0) this.idx.push(a, c, b); else this.idx.push(a, b, c); }
  q(a: number, b: number, c: number, d: number) { this.t(a, b, c); this.t(a, c, d); }
  // a grid of rings: pts[i][j], closed round j, with smooth normals; flip if the rings run the other way
  grid(pts: V3[][], closed = true, uvs?: [number, number][][], flip = false) {
    const ni = pts.length, nj = pts[0].length, ids: number[][] = [];
    for (let i = 0; i < ni; i++) {
      const row: number[] = [];
      for (let j = 0; j < nj; j++) {
        const jp = closed ? (j + 1) % nj : Math.min(nj - 1, j + 1), jm = closed ? (j - 1 + nj) % nj : Math.max(0, j - 1);
        const ip = Math.min(ni - 1, i + 1), im = Math.max(0, i - 1);
        let n = cross(sub(pts[ip][j], pts[im][j]), sub(pts[i][jp], pts[i][jm]));
        if (flip) n = mul(n, -1);
        row.push(this.v(pts[i][j], n, uvs ? uvs[i][j][0] : 0, uvs ? uvs[i][j][1] : 0));
      }
      ids.push(row);
    }
    const nq = closed ? nj : nj - 1;
    for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nq; j++) {
      const a = ids[i][j], b = ids[i + 1][j], c = ids[i + 1][(j + 1) % nj], d = ids[i][(j + 1) % nj];
      if (flip) this.q(a, d, c, b); else this.q(a, b, c, d);
    }
    return ids;
  }
  // revolve a profile [radius, height] about an axis (frame: centre c, axis up, reference x), outward-facing
  lathe(c: V3, up: V3, x: V3, prof: [number, number][], seg: number, flip = false) {
    const y = cross(up, x), pts: V3[][] = [];
    for (const [r, h] of prof) {
      const ring: V3[] = [];
      for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2; ring.push(madd(madd(madd(c, up, h), x, Math.cos(a) * r), y, Math.sin(a) * r)); }
      pts.push(ring);
    }
    return this.grid(pts, true, undefined, !flip);
  }
  disc(c: V3, up: V3, x: V3, r: number, seg: number, uvScale = 0) {
    const y = cross(up, x), ctr = this.v(c, up, 0.5, 0.5), ids: number[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, p = madd(madd(c, x, Math.cos(a) * r), y, Math.sin(a) * r);
      ids.push(this.v(p, up, 0.5 + Math.cos(a) * 0.5 * uvScale, 0.5 + Math.sin(a) * 0.5 * uvScale));
    }
    for (let j = 0; j < seg; j++) this.t(ctr, ids[(j + 1) % seg], ids[j]);
  }
  // a box from its centre and three half-extent vectors, flat-shaded
  box(c: V3, ax: V3, ay: V3, az: V3) {
    const f = (n: V3, u: V3, w: V3) => {
      const a = this.v(add(add(add(c, n), mul(u, -1)), mul(w, -1)), n), b = this.v(add(add(add(c, n), u), mul(w, -1)), n);
      const d = this.v(add(add(add(c, n), u), w), n), e = this.v(add(add(add(c, n), mul(u, -1)), w), n);
      this.q(a, b, d, e);
    };
    f(ax, ay, az); f(mul(ax, -1), az, ay); f(ay, az, ax); f(mul(ay, -1), ax, az); f(az, ax, ay); f(mul(az, -1), ay, ax);
  }
  append(o: MB) {
    const base = this.pos.length / 3;
    this.pos.push(...o.pos); this.nrm.push(...o.nrm); this.uv.push(...o.uv); this.col.push(...o.col); this.pbr.push(...o.pbr); this.si.push(...o.si); this.sw.push(...o.sw);
    for (const i of o.idx) this.idx.push(i + base);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPbr', new THREE.Float32BufferAttribute(this.pbr, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    return g;
  }
}

const lin = (hex: number): [number, number, number] => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ------------------------------------------------------------------------------------------------ the arm's surface
// distance from the forearm's axis (through the wrist joint along the forearm) to the skin, toward direction d
function skinR(A: Anatomy, along: number, d: V3, max = 70) {
  const p = madd(A.wrist, A.foreDir, along), f = A.field;
  const at = (t: number) => { const q = madd(p, d, t); return f.free(q[0], q[1], q[2], null, 0); };
  if (at(0) > 0) return -1;
  let a = 0, b = max;
  if (at(b) < 0) return -1;
  for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if (at(m) < 0) a = m; else b = m; }
  return (a + b) / 2;
}
function armFrame(A: Anatomy) {
  const fd = A.foreDir, fu = A.foreUp, fl = perp(A.palm.R, fd);
  return { fd, fu, fl };
}

// ------------------------------------------------------------------------------------------------ sleeves
interface SleeveSpec { kind: 'cuff' | 'knit' | 'rolled'; color: number; end: number }
function sleeve(mb: MB, A: Anatomy, s: SleeveSpec, q: Quality, seed: number) {
  const { fd, fu } = armFrame(A);
  const nT = q === 'high' ? 44 : 28;
  const elbowAlong = A.fore, upperLen = len(sub(A.shoulder, A.elbow));
  const upDir = norm(sub(A.shoulder, A.elbow));
  const rnd = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5 + 0.5;
  // stations along the arm: forearm from the sleeve's end to the elbow, then the upper arm to the shoulder
  const st: { c: V3; ax: V3; along: number; s: number }[] = [];
  const start = s.end;
  for (let a = start; a < elbowAlong; a += a < start + 40 ? 4 : 9) st.push({ c: madd(A.wrist, fd, a), ax: fd, along: a, s: a - start });
  for (let t = 0; t <= upperLen + 1; t += 14) {
    const k = Math.min(1, t / 60), ax = norm(lerp3(fd, upDir, k * k * (3 - 2 * k)));
    st.push({ c: madd(A.elbow, upDir, t), ax, along: elbowAlong + t, s: elbowAlong - start + t });
  }
  const knit = s.kind === 'knit', cuff = s.kind === 'cuff';
  const rings: V3[][] = [], uvs: [number, number][][] = [], shade: number[][] = [];
  let prevR: number[] | null = null;
  for (const S of st) {
    const ax = S.ax, up = perp(fu, ax), lat = cross(ax, up);
    const ring: V3[] = [], uvr: [number, number][] = [], sh: number[] = [];
    const rr: number[] = [];
    for (let j = 0; j < nT; j++) {
      const th = (j / nT) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
      let r = S.along < elbowAlong - 10 ? skinR(A, S.along, dir) : -1;
      const upperR = 47 * (A.scale < 1 ? 0.86 : 1) * (1 + 0.1 * Math.cos(2 * th));
      if (r < 0) r = S.along >= elbowAlong ? upperR : (prevR ? prevR[j] : 40);
      // ease over the skin: snug at a knit cuff, a shirt's room up the arm
      const cuffZone = Math.max(0, 1 - S.s / (cuff ? 62 : 22));
      let ease = knit ? 2.2 + 3.5 * Math.min(1, S.s / 70) : 3.2 + 10 * Math.min(1, S.s / 90);
      if (cuff && S.s < 62) ease = 3.4 + 0.012 * S.s;
      // folds: drape and twist up the forearm, crumple in the crook of the elbow, bunching above a cuff
      const crook = Math.exp(-(((S.along - elbowAlong) / 45) ** 2)) * Math.max(0, -Math.cos(th) * 0.8 + 0.4);
      const bunch = cuff ? Math.exp(-(((S.s - 75) / 18) ** 2)) : 0;
      const zone = 1 - cuffZone;
      const f1 = Math.sin(th * 2 + S.s * 0.05 + rnd(1) * 6) * 1.6, f2 = Math.sin(th * 3 - S.s * 0.08 + rnd(2) * 6) * 1.1;
      const f3 = Math.sin(S.s * 0.36 + th * 1.3 + rnd(3) * 6) * Math.sin(th * 5 + rnd(4) * 6) * 2.4;
      const fold = (knit ? 0.35 : 1) * zone * (f1 + f2 + (crook * 2.4 + bunch * 1.6) * f3 + crook * 2.5 + bunch * 2);
      r = r + ease + fold;
      // the open end: a turned edge so the cloth has thickness
      rr.push(r);
      ring.push(madd(S.c, dir, r));
      uvr.push([(j / nT) * (2 * Math.PI * r) / 5.5, S.along / 5.5]);
      sh.push(Math.max(0.55, Math.min(1.08, 1 + fold * 0.05 - crook * 0.12)));
    }
    prevR = rr;
    rings.push(ring); uvs.push(uvr); shade.push(sh);
  }
  // weights: forearm below the elbow, upper arm above, blended through it
  const b0 = mb.bone, ids: number[][] = [];
  rings.forEach((ring, i) => {
    const S = st[i], wu = Math.min(1, Math.max(0, (S.along - (elbowAlong - 35)) / 70));
    const row: number[] = [];
    ring.forEach((p, j) => {
      const nT2 = ring.length, jp = (j + 1) % nT2, jm = (j - 1 + nT2) % nT2, ip = Math.min(rings.length - 1, i + 1), im = Math.max(0, i - 1);
      const n = cross(sub(rings[ip][j], rings[im][j]), sub(ring[jp], ring[jm]));
      mb.bone = 1; mb.bone2 = 0; mb.w2 = wu;
      const c = lin(s.color); mb.color = [c[0] * shade[i][j], c[1] * shade[i][j], c[2] * shade[i][j]];
      row.push(mb.v(p, mul(n, -1), uvs[i][j][0], uvs[i][j][1]));
    });
    ids.push(row);
  });
  for (let i = 0; i < ids.length - 1; i++) for (let j = 0; j < nT; j++) {
    const a = ids[i][j], b = ids[i + 1][j], c = ids[i + 1][(j + 1) % nT], d = ids[i][(j + 1) % nT];
    mb.q(a, d, c, b);
  }
  // the open end's turned edge and the inside, a few millimetres deep
  const first = rings[0], inner: V3[] = [], lip: V3[] = [];
  const ax0 = st[0].ax;
  first.forEach((p) => { const out = norm(sub(p, st[0].c)); lip.push(madd(madd(p, ax0, -0.9), out, -0.9)); inner.push(madd(madd(p, out, -1.8), ax0, 6)); });
  const c0 = lin(s.color);
  mb.color = [c0[0] * 0.9, c0[1] * 0.9, c0[2] * 0.9]; mb.bone = 1; mb.w2 = 0;
  const L0 = first.map((p, j) => mb.v(p, sub(p, st[0].c), uvs[0][j][0], uvs[0][j][1]));
  const L1 = lip.map((p) => mb.v(p, mul(ax0, -1), 0, 0));
  mb.color = [c0[0] * 0.45, c0[1] * 0.45, c0[2] * 0.45];
  const L2 = inner.map((p) => mb.v(p, sub(st[0].c, p), 0, 0));
  for (let j = 0; j < nT; j++) {
    const jn = (j + 1) % nT;
    mb.q(L0[j], L1[j], L1[jn], L0[jn]);
    mb.q(L1[j], L2[j], L2[jn], L1[jn]);
  }
  mb.bone = b0;
  return { rings, st };
}

// the rolled sleeve's roll: a fat, slightly lumpy band of folded cloth
function roll(mb: MB, A: Anatomy, at: number, color: number, q: Quality, seed: number) {
  const { fd, fu } = armFrame(A);
  const nT = q === 'high' ? 44 : 28, nP = q === 'high' ? 14 : 9;
  const c = lin(color), pts: V3[][] = [], cols: number[][] = [];
  const W = 38, Hh = 9;
  for (let i = 0; i <= nP; i++) {
    const t = i / nP, along = at - W / 2 + t * W, ring: V3[] = [], cr: number[] = [];
    for (let j = 0; j < nT; j++) {
      const th = (j / nT) * Math.PI * 2, up = perp(fu, fd), lat = cross(fd, up), dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
      let r = skinR(A, along, dir); if (r < 0) r = 40;
      // three layers of cloth folded over: a rounded bulge with creases between the layers
      const prof = Math.sin(t * Math.PI), layers = 0.7 * Math.abs(Math.sin(t * Math.PI * 3));
      const lump = 1.2 * Math.sin(th * 3 + seed) * Math.sin(t * Math.PI) + 0.8 * Math.sin(th * 7 + seed * 2);
      r += 3 + Hh * Math.pow(prof, 0.6) + layers + lump * prof;
      ring.push(madd(madd(A.wrist, fd, along), dir, r));
      cr.push(0.78 + 0.22 * Math.pow(prof, 0.5) - 0.12 * layers);
    }
    pts.push(ring); cols.push(cr);
  }
  mb.bone = 1; mb.w2 = 0;
  const ids: number[][] = [];
  pts.forEach((ring, i) => {
    const row: number[] = [];
    ring.forEach((p, j) => {
      const jp = (j + 1) % nT, jm = (j - 1 + nT) % nT, ip = Math.min(nP, i + 1), im = Math.max(0, i - 1);
      const n = cross(sub(pts[ip][j], pts[im][j]), sub(ring[jp], ring[jm]));
      mb.color = [c[0] * cols[i][j], c[1] * cols[i][j], c[2] * cols[i][j]];
      row.push(mb.v(p, mul(n, -1), (j / nT) * 40, i * 1.2));
    });
    ids.push(row);
  });
  for (let i = 0; i < nP; i++) for (let j = 0; j < nT; j++) mb.q(ids[i][j], ids[i][(j + 1) % nT], ids[i + 1][(j + 1) % nT], ids[i + 1][j]);
}

// ------------------------------------------------------------------------------------------------ watches
const GOLD = 0xe8b65c, STEEL = 0xd9dde2, ALU = 0x55595f;
function watch(mbMetal: MB, mbDial: MB, mbGlass: MB, A: Anatomy, kind: 'gold' | 'steel' | 'smart', female: boolean, time: [number, number, number], q: Quality) {
  const { fd, fu, fl } = armFrame(A);
  const along = 30;
  const up0 = perp(fu, fd);
  const rTop = skinR(A, along, up0);
  const seg = q === 'high' ? 64 : 40;
  // the case sits on the back of the wrist; 12 o'clock toward the thumb, 3 o'clock toward the hand
  const N = up0, X = mul(fd, -1), Y = norm(cross(N, X));
  void fl;
  const k = female ? 0.84 : 1;
  // the case back presses a little into the flesh of the wrist
  const base = madd(madd(A.wrist, fd, along), N, rTop - 0.8);
  const metal = kind === 'gold' ? GOLD : kind === 'steel' ? STEEL : ALU;
  mbMetal.bone = 1; mbMetal.w2 = 0;
  if (kind !== 'smart') {
    const R = 19 * k, H = 10 * k;
    // case back, middle, polished bezel (rounded), the crystal's seat
    mbMetal.color = lin(metal); mbMetal.metal = 1; mbMetal.rough = 0.28;
    mbMetal.lathe(base, N, X, [[R * 0.82, 0], [R * 0.96, 0.6], [R, 2], [R * 1.005, H * 0.62], [R * 0.99, H * 0.7]], seg);
    mbMetal.rough = 0.12;
    mbMetal.lathe(base, N, X, [[R * 0.99, H * 0.7], [R * 0.985, H * 0.78], [R * 0.95, H * 0.86], [R * 0.9, H * 0.9], [R * 0.86, H * 0.9]], seg);
    // the inner wall (rehaut) down to the dial
    mbMetal.rough = 0.3;
    mbMetal.lathe(base, N, X, [[R * 0.86, H * 0.9], [R * 0.845, H * 0.78]], seg, true);
    // the crown at 3 o'clock, fluted (a pattern of lighter and darker vertex colours)
    mbMetal.rough = 0.2;
    mbMetal.lathe(madd(madd(base, N, H * 0.42), X, R * 0.98), X, N, [[2.6 * k, 0], [2.8 * k, 0.6], [2.8 * k, 3.4 * k], [2.2 * k, 4 * k], [0.01, 4.1 * k]], 16);
    // lugs: four short bars from the case to the bracelet
    // lugs: four short horns from the case down toward the wrist, the bracelet's end links between them
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
      const c = madd(madd(madd(base, Y, sy * R * 1.0), X, sx * R * 0.48), N, H * 0.3);
      const dY = norm(madd(mul(Y, sy), N, -0.35));
      mbMetal.box(c, mul(dY, 3.6 * k), mul(X, 1.5 * k), mul(N, 2.0 * k));
    }
    // the dial
    const dz = H * 0.78, dr = R * 0.84;
    mbDial.bone = 1; mbDial.color = [1, 1, 1];
    mbDial.disc(madd(base, N, dz), N, X, dr, seg, 1);
    // applied indices (polished) and the hands
    mbMetal.rough = 0.1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, rd = norm(add(mul(Y, Math.cos(a)), mul(X, Math.sin(a)))), tg = cross(N, rd);
      const long = i % 3 === 0 ? 1.45 : 1;
      mbMetal.box(madd(madd(base, N, dz + 0.35), rd, dr * 0.78), mul(rd, 1.9 * long * k), mul(tg, (i === 0 ? 1.4 : 0.6) * k), mul(N, 0.35));
    }
    const [h, m, s] = time;
    const hand = (ang: number, L: number, W: number, z: number, tail = 0) => {
      const rd = norm(add(mul(Y, Math.cos(ang)), mul(X, Math.sin(ang)))), tg = cross(N, rd);
      const c = madd(madd(base, N, dz + z), rd, (L - tail) / 2);
      mbMetal.box(c, mul(rd, (L + tail) / 2), mul(tg, W / 2), mul(N, 0.18));
    };
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2, ma = (m + s / 60) / 60 * Math.PI * 2, sa = (s / 60) * Math.PI * 2;
    hand(ha, dr * 0.55, 1.7 * k, 0.9); hand(ma, dr * 0.82, 1.2 * k, 1.3); hand(sa, dr * 0.88, 0.3 * k, 1.7, 4);
    mbMetal.lathe(madd(base, N, dz + 1.5), N, X, [[1.1 * k, 0], [1.1 * k, 0.6], [0.01, 0.7]], 12);
    // the crystal: domed sapphire
    const cr = R * 0.88, prof: [number, number][] = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push([cr * Math.cos(t * Math.PI / 2) + 0.01, H * 0.9 + 0.9 * Math.sin(t * Math.PI / 2)]); }
    mbGlass.bone = 1; mbGlass.color = [1, 1, 1];
    mbGlass.lathe(base, N, X, prof, seg);
    // the bracelet: three-piece links round the wrist, polished centres and brushed outer pieces
    const att: [V3, V3] = [madd(madd(base, Y, R * 1.1), N, H * 0.02), madd(madd(base, Y, -R * 1.1), N, H * 0.02)];
    bracelet3(mbMetal, A, along, N, metal, R * 1.0, k, q, att);
  } else {
    const W = 34 * (female ? 0.88 : 1), Hh = 40 * (female ? 0.88 : 1), T = 10.5, rc = 8.5;
    // the rounded-rectangle case (aluminium, bead-blasted), its screen and the glass over it
    mbMetal.color = lin(ALU); mbMetal.metal = 1; mbMetal.rough = 0.42;
    const outline = (inset: number, z: number) => {
      const pts: V3[] = [], n = 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
        const px = Math.sign(cx) * Math.min(Math.abs(cx) * 1e3, (W / 2 - rc)) + cx * (rc - inset), py = Math.sign(cy) * Math.min(Math.abs(cy) * 1e3, (Hh / 2 - rc)) + cy * (rc - inset);
        pts.push(madd(madd(madd(base, X, px), Y, py), N, z));
      }
      return pts;
    };
    const prof: [number, number][] = [[3, 0], [0.8, 1.2], [0, 3], [0, T * 0.75], [0.6, T * 0.9], [1.6, T]];
    mbMetal.grid(prof.map(([i, z]) => outline(i, z)), true, undefined, true);
    // digital crown and side button
    mbMetal.rough = 0.25;
    mbMetal.lathe(madd(madd(madd(base, N, T * 0.55), X, W / 2 - 0.5), Y, 6), X, N, [[3.4, 0], [3.4, 3], [0.01, 3.2]], 20);
    mbMetal.box(madd(madd(madd(base, N, T * 0.5), X, W / 2 + 0.4), Y, -8), mul(X, 0.8), mul(Y, 4.5), mul(N, 1.6));
    // screen (a lit face on a canvas) and the glass
    mbDial.bone = 1; mbDial.color = [1, 1, 1];
    const sp = outline(2.2, T - 0.05);
    const ctr = mbDial.v(madd(base, N, T - 0.05), N, 0.5, 0.5);
    const ids = sp.map((p) => { const d = sub(p, base); return mbDial.v(p, N, 0.5 + dot(d, X) / W, 0.5 + dot(d, Y) / Hh); });
    for (let i = 0; i < ids.length; i++) mbDial.t(ctr, ids[(i + 1) % ids.length], ids[i]);
    mbGlass.bone = 1; mbGlass.color = [1, 1, 1];
    mbGlass.grid([outline(1.6, T), outline(5, T + 0.6), outline(rc, T + 0.9)], true, undefined, true);
    // the sport band
    sportBand(mbMetal, A, along, N, Hh, female, q, [madd(madd(base, Y, Hh / 2 - 1), N, T * 0.35), madd(madd(base, Y, -Hh / 2 + 1), N, T * 0.35)]);
  }
}

// a band that follows the wrist round, from one side of the case to the other: centre line, width, thickness
// attach: where the band leaves the case at each end (+Y side first): the band's first and last few links rise from
// the skin to meet the lugs, so the head is held on the wrist rather than floating over it
function bandPath(A: Anatomy, along: number, N: V3, n: number, gap: number, attach?: [V3, V3]) {
  const { fd } = armFrame(A);
  const up = perp(N, fd), lat = cross(fd, up), out: { p: V3; n: V3; t: V3 }[] = [];
  for (let i = 0; i <= n; i++) {
    const th = gap + (i / n) * (Math.PI * 2 - 2 * gap), dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
    let r = skinR(A, along, dir); if (r < 0) r = 30;
    let p = madd(madd(A.wrist, fd, along), dir, r);
    if (attach) {
      const m = Math.max(4, Math.round(n * 0.2));
      const e0 = i / m, e1 = (n - i) / m;
      if (e0 < 1) p = lerp3(attach[0], p, e0 * e0 * (3 - 2 * e0));
      if (e1 < 1) p = lerp3(attach[1], p, e1 * e1 * (3 - 2 * e1));
    }
    out.push({ p, n: dir, t: norm(cross(fd, dir)) });
  }
  return out;
}

function bracelet3(mb: MB, A: Anatomy, along: number, N: V3, metal: number, R: number, k: number, q: Quality, attach?: [V3, V3]) {
  const { fd } = armFrame(A);
  const gap = Math.asin(Math.min(0.9, (R * 0.95) / 30));
  const path = bandPath(A, along, N, q === 'high' ? 40 : 26, gap, attach);
  const W = 19 * k;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], c = lerp3(a.p, b.p, 0.5), t = norm(sub(b.p, a.p)), L = len(sub(b.p, a.p));
    // each link lies along the band (where it rises to the lugs too), its face out from the wrist
    let n = norm(cross(fd, t)); if (dot(n, add(a.n, b.n)) < 0) n = mul(n, -1);
    for (const [off, w, polished] of [[-W * 0.36, W * 0.27, 0], [0, W * 0.2, 1], [W * 0.36, W * 0.27, 0]] as [number, number, number][]) {
      mb.color = lin(metal); mb.metal = 1; mb.rough = polished ? 0.1 : 0.34;
      const ctr = madd(madd(c, fd, off), n, 1.9 + (polished ? 0.25 : 0));
      mb.box(ctr, mul(t, L * 0.47), mul(fd, w / 2), mul(n, 1.5));
    }
  }
}

function sportBand(mb: MB, A: Anatomy, along: number, N: V3, Hh0: number, female: boolean, q: Quality, attach?: [V3, V3]) {
  const { fd } = armFrame(A);
  const gap = Math.asin(Math.min(0.9, (Hh0 / 2) / 30));
  const path = bandPath(A, along, N, q === 'high' ? 40 : 24, gap, attach);
  const bw = (female ? 18 : 21), T = 2.6;
  mb.color = lin(0x2a2c30); mb.metal = 0; mb.rough = 0.72;
  const rows: V3[][] = path.map((s) => {
    const o = madd(s.p, s.n, 0.6);
    return [madd(o, fd, -bw / 2), madd(madd(o, fd, -bw / 2 + 1), s.n, T), madd(madd(o, fd, bw / 2 - 1), s.n, T), madd(o, fd, bw / 2)];
  });
  mb.grid(rows, false, undefined, false);
}

// ------------------------------------------------------------------------------------------------ ring and bangle
function ring(mbMetal: MB, mbGlass: MB, A: Anatomy, female: boolean, q: Quality) {
  const g = A.digits[2];                               // the ring finger
  const a = g.joints[0], b = g.joints[1], d = g.dirs[0], up = g.dorsal[0], lat = cross(d, up);
  const c = lerp3(a, b, 0.46), seg = q === "high" ? 48 : 28;
  const W = female ? 2.4 : 4.6, T = female ? 1.5 : 1.8;
  const f = A.field, pts: V3[][] = [];
  const prof: [number, number][] = [[0, -W / 2], [T * 0.7, -W / 2], [T, -W * 0.3], [T, W * 0.3], [T * 0.7, W / 2], [0, W / 2]];
  const rs: number[] = [];
  for (let j = 0; j < seg; j++) {
    const th = (j / seg) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
    let lo = 0, hi = 16;
    // the ring finger's own surface (the neighbours pressed against it would pull the band out of round)
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2, p = madd(c, dir, m); if (f.groupDist(G_FINGER + 2, p[0], p[1], p[2]) < 0) lo = m; else hi = m; }
    rs.push(lo + 0.15);
  }
  for (const [rOff, z] of prof) {
    const row: V3[] = [];
    for (let j = 0; j < seg; j++) { const th = (j / seg) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th)))); row.push(madd(madd(c, dir, rs[j] + rOff), d, z)); }
    pts.push(row);
  }
  pts.push(pts[0]);
  mbMetal.bone = 2; mbMetal.w2 = 0; mbMetal.color = lin(GOLD); mbMetal.metal = 1; mbMetal.rough = 0.1;
  mbMetal.grid(pts, true, undefined, true);
  if (female) {
    // a small stone in a rub-over (bezel) setting on top: low, so nothing catches
    const top = madd(c, up, rs[0] + T * 0.8), sz = 2.0;
    mbMetal.lathe(top, up, lat, [[sz * 0.7, -0.3], [sz * 1.12, 0.2], [sz * 1.1, 1.0], [sz * 0.95, 1.15]], 20);
    mbGlass.bone = 2; mbGlass.color = [1, 1, 1];
    mbGlass.lathe(madd(top, up, 0.5), up, lat, [[0.01, 0.0], [sz * 0.95, 0.6], [sz * 0.7, 1.3], [0.01, 1.45]], 10);
  }
}

function bangle(mb: MB, A: Anatomy, q: Quality) {
  const { fd, fu } = armFrame(A);
  const along = 26, n = q === 'high' ? 96 : 56, m = 8;
  const up = perp(fu, fd), lat = cross(fd, up);
  // a twisted rope of two strands, resting loosely on the back of the wrist
  const centre: { p: V3; n: V3 }[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
    let r = skinR(A, along + 4 * Math.cos(th), dir); if (r < 0) r = 28;
    centre.push({ p: madd(madd(A.wrist, fd, along + 4 * Math.cos(th)), dir, r + 2.2 + 2.5 * (1 - Math.cos(th)) * 0.5), n: dir });
  }
  mb.bone = 1; mb.w2 = 0; mb.color = lin(GOLD); mb.metal = 1; mb.rough = 0.16;
  for (let strand = 0; strand < 2; strand++) {
    const rows: V3[][] = [];
    for (let i = 0; i <= n; i++) {
      const c = centre[i % n], t = norm(sub(centre[(i + 1) % n].p, centre[(i - 1 + n) % n].p)), b = cross(t, c.n);
      const tw = (i / n) * Math.PI * 2 * 26 + strand * Math.PI;
      const sc = madd(madd(c.p, c.n, Math.cos(tw) * 0.75), b, Math.sin(tw) * 0.75);
      const row: V3[] = [];
      for (let j = 0; j < m; j++) { const a = (j / m) * Math.PI * 2; row.push(madd(madd(sc, c.n, Math.cos(a) * 0.85), b, Math.sin(a) * 0.85)); }
      rows.push(row);
    }
    mb.grid(rows, true, undefined, true);
  }
}

// ------------------------------------------------------------------------------------------------ materials
let weaveCache: Map<string, THREE.Texture> | null = null;
function weave(kind: 'poplin' | 'knit' | 'twill'): THREE.Texture {
  weaveCache ??= new Map();
  const hit = weaveCache.get(kind);
  if (hit) return hit;
  const n = 128, h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v: number;
    if (kind === 'knit') { const u = x / 4, w = y / 8; v = Math.abs(Math.sin((u + Math.abs(((w % 2) + 2) % 2 - 1) * 0.5) * Math.PI)) * Math.abs(Math.sin(w * Math.PI)); }
    else if (kind === 'twill') { const d = (x + y) % 8; v = d < 4 ? 0.5 + 0.5 * Math.sin((d / 4) * Math.PI) : 0.2; v *= 0.8 + 0.2 * Math.sin((x - y) * 0.8); }
    else { const over = ((x >> 1) + (y >> 1)) & 1; v = over ? 0.5 + 0.5 * Math.sin(((x % 2) / 2 + 0.25) * Math.PI) : 0.5 + 0.5 * Math.sin(((y % 2) / 2 + 0.25) * Math.PI); v *= 0.85; }
    h[y * n + x] = v + (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.08;
  }
  const d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const hx = h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)], hy = h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x];
    const s = 1.6, nx = -hx * s, ny = -hy * s, l = Math.hypot(nx, ny, 1);
    const o = (y * n + x) * 4;
    d[o] = ((nx / l) * 0.5 + 0.5) * 255; d[o + 1] = ((ny / l) * 0.5 + 0.5) * 255; d[o + 2] = ((1 / l) * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8; t.needsUpdate = true;
  weaveCache.set(kind, t);
  return t;
}

function accMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 1, clearcoat: 0, envMapIntensity: 1.1 });
  m.customProgramCacheKey = () => 'hands-acc';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPbr; varying vec2 vPbr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = aPbr;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPbr;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vPbr.y;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.x;');
  };
  return m;
}

function dialTexture(kind: 'gold' | 'steel' | 'smart', time: [number, number, number]) {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!;
  const cx = n / 2;
  if (kind === 'smart') {
    g.fillStyle = '#020203'; g.fillRect(0, 0, n, n);
    // a simple face: big time, a date line and three activity rings (our own design)
    g.fillStyle = '#f2f2f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 150px system-ui, Helvetica, Arial, sans-serif';
    g.fillText(`${time[0]}:${String(time[1]).padStart(2, '0')}`, cx, cx - 30);
    g.font = '500 44px system-ui, Helvetica, Arial, sans-serif'; g.fillStyle = '#ff8a3d';
    g.fillText('TUE 13', cx, cx + 80);
    const ringsC = ['#ff3b5c', '#9cff3d', '#3de0ff'];
    ringsC.forEach((col, i) => { g.strokeStyle = col; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cx + 172, 50 - i * 16, -Math.PI / 2, -Math.PI / 2 + (0.55 + i * 0.15) * Math.PI * 2); g.stroke(); });
  } else {
    // a sunburst dial: radial brushing as fine light and dark spokes over the base colour
    const base = kind === 'gold' ? [226, 224, 216] : [18, 22, 30];   // gold watch: a silvered white dial
    g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2, l = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      g.strokeStyle = `rgba(${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${Math.abs(l) * 0.06})`;
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cx); g.lineTo(cx + Math.cos(a) * cx, cx + Math.sin(a) * cx); g.stroke();
    }
    // the minute track and our name
    const ink = kind === 'gold' ? '#2a2420' : '#e9e6df';
    g.strokeStyle = ink; g.fillStyle = ink;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = cx * 0.94, r1 = cx * (i % 5 === 0 ? 0.88 : 0.91);
      g.lineWidth = i % 5 === 0 ? 3 : 1.6; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cx - Math.cos(a) * r1); g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 34px Georgia, "Times New Roman", serif'; g.fillText('ROSSINI', cx, cx - 95);
    g.font = '500 17px Georgia, "Times New Roman", serif'; g.fillText('AUTOMATIC', cx, cx + 100);
    g.font = '500 13px Georgia, serif'; g.fillText('ORANGE COUNTY', cx, cx + 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------------------------------------ assemble
// The accessories' geometry (sampled from the arm's field, the slow part) is kept per presentation, quality and look;
// each build clones it, so a second driver with the same look costs only the materials.
interface AccGeo { cloth: THREE.BufferGeometry | null; metal: THREE.BufferGeometry | null; dial: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null; sleeveFrom: number; weaveKind: 'poplin' | 'knit' | 'twill'; sleeveColor: number }
const accCache = new Map<string, AccGeo>();
function accGeometry(o: AccOptions): AccGeo {
  const A = o.anatomy, look = o.look, q = o.quality;
  const key = [A.pres, q, look.sleeve, look.gloves, look.watch, look.ring, look.bracelet, o.female, o.watchTime.join(':')].join('|');
  const hit = accCache.get(key);
  if (hit) return hit;
  const metal = new MB(0, o), dial = new MB(0, o), glass = new MB(0, o), cloth = new MB(0, o);
  const sides = [new MB(0, o), new MB(1, o)];
  let sleeveFrom = 1e9;
  let weaveKind: 'poplin' | 'knit' | 'twill' = 'poplin';
  // ---- sleeves
  const kinds: SleeveSpec | null = look.sleeve !== null
    ? (look.gloves !== null ? { kind: 'knit', color: look.sleeve, end: 16 } : { kind: 'cuff', color: look.sleeve, end: 52 })
    : { kind: 'rolled', color: 0x2b3a52, end: Math.round(A.fore * 0.66) };
  weaveKind = kinds.kind === 'knit' ? 'knit' : kinds.kind === 'rolled' ? 'twill' : 'poplin';
  const clothSides = [new MB(0, o), new MB(1, o)];
  for (let side = 0; side < 2; side++) {
    const mb = clothSides[side];
    if (kinds.kind === 'rolled') {
      sleeve(mb, A, { ...kinds, end: kinds.end + 12 }, q, side + 1);
      roll(mb, A, kinds.end + 4, kinds.color, q, side + 3);
    } else sleeve(mb, A, kinds, q, side + 1);
    if (kinds.kind === 'cuff') {
      // the cuff's button, on the outer side of the wrist
      const { fd, fl } = armFrame(A), at = kinds.end + 22;
      const r = skinR(A, at, mul(fl, 1)) + 3.6;
      mb.color = lin(0xeeeae2); mb.metal = 0; mb.rough = 0.35; mb.bone = 1;
      mb.lathe(madd(madd(A.wrist, fd, at), fl, r), fl, fd, [[5, 0], [5.2, 0.6], [4.8, 1.6], [0.01, 2]], 18);
    }
  }
  sleeveFrom = (kinds.kind === 'rolled' ? kinds.end + 30 : kinds.end + 22);
  for (const c of clothSides) cloth.append(c);
  void sides;
  // ---- the watch, ring and bangle
  const metalL = new MB(1, o), dialL = new MB(1, o), glassL = new MB(1, o);
  if (look.watch) watch(metalL, dialL, glassL, A, look.watch, o.female, o.watchTime, q);
  const metalR = new MB(0, o), glassR = new MB(0, o);
  if (look.ring) { const mL = new MB(1, o), gL = new MB(1, o); ring(mL, gL, A, o.female, q); metalL.append(mL); glassL.append(gL); }
  if (look.bracelet) bangle(metalR, A, q);
  metal.append(metalL); metal.append(metalR); dial.append(dialL); glass.append(glassL); glass.append(glassR);

  const g = (mb: MB) => (mb.idx.length ? mb.geometry() : null);
  const res: AccGeo = { cloth: g(cloth), metal: g(metal), dial: g(dial), glass: g(glass), sleeveFrom, weaveKind, sleeveColor: kinds.color };
  accCache.set(key, res);
  return res;
}

export function buildAccessories(o: AccOptions): Accessories {
  const look = o.look, q = o.quality;
  const G = accGeometry(o);
  const meshes: THREE.SkinnedMesh[] = [];
  const weaveKind = G.weaveKind, sleeveFrom = G.sleeveFrom, kinds = { color: G.sleeveColor };
  const mk = (geo: THREE.BufferGeometry | null, mat: THREE.Material, name: string) => {
    if (!geo) { mat.dispose(); return; }
    const m = new THREE.SkinnedMesh(geo.clone(), mat); m.name = name; meshes.push(m);
  };
  const sheenC = new THREE.Color(kinds.color).lerp(new THREE.Color(1, 1, 1), 0.35);
  const clothMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: weaveKind === 'knit' ? 0.78 : 0.86, metalness: 0, sheen: q === 'high' ? 0.7 : 0.3, sheenColor: sheenC, sheenRoughness: 0.55,
    normalMap: weave(weaveKind), normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 0.7,
  });
  mk(G.cloth, clothMat, 'sleeves');
  mk(G.metal, accMaterial(), 'metal');
  if (look.watch) {
    const dt = dialTexture(look.watch, o.watchTime);
    const dm = look.watch === 'smart'
      ? new THREE.MeshStandardMaterial({ map: dt, emissiveMap: dt, emissive: 0xffffff, emissiveIntensity: 0.55, color: 0x050505, roughness: 0.3 })
      : new THREE.MeshPhysicalMaterial({ map: dt, roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.2 })   // lacquered, not metal: a metal dial took the warm sky's colour and read as skin;
    mk(G.dial, dm, 'dial');
  }
  mk(G.glass, new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, ior: 1.77 }), 'crystal');
  return { meshes, sleeveFrom };
}
