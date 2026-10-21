// What the driver wears on the arms, one outfit per driver (drivers.ts lookFor: outfit, accent):
//   'shirt'  the Closer: a pressed shirt's barrel cuff with its edge stitch, the cuff seam the sleeve gathers into, a
//            placket with a gold cufflink (him) or a pearl button (her), an oxford weave; the gold watch (index ring,
//            blued dauphine hands, a fluted crown, a date), the ring, her rope bangle
//   'suit'   the Ace: a fire suit's ribbed sleeve over a fine knit cuff, a small Rossini "R" chevron patch on the
//            forearm (our own badge, no team or brand); the racing gloves are the skin shader's (hands-skin.ts)
//   'work'   the Wrench: an olive work shirt rolled up past the forearm (a neat roll, turned up twice, with its hem stitch; a felled seam
//            with its double row of stitching, a twill), the smart watch with its green grip readout on a sport band
// Everything is built round the arm's actual skin (rays cast into the hand's distance field), in the grip frame G
// (mm) as the right arm, and mirrored to the left where it's worn there. All of it is skinned to the arm's bones.
// Cloth seams, stitches, the knit cuff's and the suit's ribs are drawn by the cloth shader from a per-vertex seam coordinate
// (aCloth) so they stay crisp at any distance; the weaves are canvas tiles in millimetres.
import * as THREE from 'three';
import type { DriverLook } from '../game/drivers';
import { Anatomy, V3, add, cross, dot, len, madd, mul, norm, perp, sub, lerp3, G_FINGER } from './hands-sdf';
import { BUMP_GLSL, Quality, rollAt } from './hands-skin';
import { EYE } from './spec';

export type Outfit = 'shirt' | 'suit' | 'work';
export function outfitOf(look: DriverLook): Outfit { return look.outfit ?? (look.sleeve === null ? 'work' : look.gloves !== null ? 'suit' : 'shirt'); }
export function accentOf(look: DriverLook): number { return look.accent ?? (outfitOf(look) === 'suit' ? 0xb9a6ff : outfitOf(look) === 'work' ? 0x7dffa8 : 0xffd166); }

export interface AccOptions {
  anatomy: Anatomy; look: DriverLook; female: boolean; quality: Quality; watchTime: [number, number, number];
  toCar(p: V3, side: number): V3; dirToCar(d: V3, side: number): V3;
}
export interface Accessories { meshes: THREE.SkinnedMesh[]; sleeveFrom: number }

// ------------------------------------------------------------------------------------------------ mesh builder
type Cloth = [number, number, number, number];   // lateral mm to the lengthwise seam (99 none), mm to a ring seam (99 none), mm from the open end, zone
const NO_CLOTH: Cloth = [99, 99, 0, 0];
class MB {
  pos: number[] = []; nrm: number[] = []; uv: number[] = []; col: number[] = []; pbr: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = []; cloth: number[] = [];
  color: [number, number, number] = [1, 1, 1]; metal = 0; rough = 0.5; bone = 0; bone2 = 0; w2 = 0; clothV: Cloth = NO_CLOTH;
  constructor(public side: number, public o: AccOptions) {}
  // (the last good normal: a zero normal is never emitted, it is NaN in the shader; see grid)
  private lastN: V3 = [0, 0, 1];
  v(p: V3, n: V3, u = 0, w = 0) {
    const l = len(n), nn: V3 = l > 1e-9 && Number.isFinite(l) ? (this.lastN = norm(n)) : this.lastN;
    this.pos.push(...this.o.toCar(p, this.side)); this.nrm.push(...this.o.dirToCar(nn, this.side)); this.uv.push(u, w);
    this.col.push(...this.color); this.pbr.push(this.metal, this.rough); this.cloth.push(...this.clothV);
    const b0 = this.side * 3;
    this.si.push(b0 + this.bone, b0 + this.bone2, 0, 0); this.sw.push(1 - this.w2, this.w2, 0, 0);
    return this.pos.length / 3 - 1;
  }
  // a triangle given in G with outward winding (G is mirrored once; the left side mirrors it back)
  t(a: number, b: number, c: number) { if (this.side === 0) this.idx.push(a, c, b); else this.idx.push(a, b, c); }
  q(a: number, b: number, c: number, d: number) { this.t(a, b, c); this.t(a, c, d); }
  // a grid of rings: pts[i][j], closed round j, with smooth normals; flip if the rings run the other way
  grid(pts: V3[][], closed = true, uvs?: [number, number][][], flip = false, cloth?: Cloth[][]) {
    const ni = pts.length, nj = pts[0].length, ids: number[][] = [];
    for (let i = 0; i < ni; i++) {
      const row: number[] = [];
      for (let j = 0; j < nj; j++) {
        const jp = closed ? (j + 1) % nj : Math.min(nj - 1, j + 1), jm = closed ? (j - 1 + nj) % nj : Math.max(0, j - 1);
        const ip = Math.min(ni - 1, i + 1), im = Math.max(0, i - 1);
        let n = cross(sub(pts[ip][j], pts[im][j]), sub(pts[i][jp], pts[i][jm]));
        // a ring with coincident points (the smart watch glass's top ring: each rounded corner collapses to a point)
        // has no tangent there: widen the stencil round the ring, else take the next row's. A zero normal is NaN in
        // the shader, and the game's post-processing spread that one pixel over the whole frame (black)
        for (let k = 2; len(n) < 1e-9 && k < nj; k++) {
          const a = closed ? (j + k) % nj : Math.min(nj - 1, j + k), b = closed ? (j - k + nj) % nj : Math.max(0, j - k);
          n = cross(sub(pts[ip][j], pts[im][j]), sub(pts[i][a], pts[i][b]));
        }
        if (len(n) < 1e-9) { const r = i > 0 ? i - 1 : Math.min(ni - 1, i + 1), rp = Math.min(ni - 1, r + 1), rm = Math.max(0, r - 1); n = cross(sub(pts[rp][j], pts[rm][j]), sub(pts[r][jp], pts[r][jm])); }
        if (flip) n = mul(n, -1);
        if (cloth) this.clothV = cloth[i][j];
        row.push(this.v(pts[i][j], n, uvs ? uvs[i][j][0] : 0, uvs ? uvs[i][j][1] : 0));
      }
      ids.push(row);
    }
    this.clothV = NO_CLOTH;
    const nq = closed ? nj : nj - 1;
    for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nq; j++) {
      const a = ids[i][j], b = ids[i + 1][j], c = ids[i + 1][(j + 1) % nj], d = ids[i][(j + 1) % nj];
      if (flip) this.q(a, d, c, b); else this.q(a, b, c, d);
    }
    return ids;
  }
  // revolve a profile [radius, height] about an axis (frame: centre c, axis up, reference x), outward-facing;
  // sx, sy stretch it into an oval; flutes > 0 alternate the radius every other segment (a fluted crown)
  lathe(c: V3, up: V3, x: V3, prof: [number, number][], seg: number, flip = false, sx = 1, sy = 1, flutes = 0) {
    const y = cross(up, x), pts: V3[][] = [];
    for (const [r, h] of prof) {
      const ring: V3[] = [];
      for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2, f = r > 0.1 ? 1 + flutes * (j % 2 ? 1 : -1) : 1; ring.push(madd(madd(madd(c, up, h), x, Math.cos(a) * r * sx * f), y, Math.sin(a) * r * sy * f)); }
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
  // soft > 0: the corner normals lean out (a polished, rounded-edged piece: no flat face that mirrors the sky white
  // at a grazing angle)
  soft = 0;
  box(c: V3, ax: V3, ay: V3, az: V3) {
    const nv = (n: V3, o: V3) => this.soft > 0 ? norm(madd(norm(n), norm(o), this.soft)) : n;
    const f = (n: V3, u: V3, w: V3) => {
      const p1 = add(add(add(c, n), mul(u, -1)), mul(w, -1)), p2 = add(add(add(c, n), u), mul(w, -1));
      const p3 = add(add(add(c, n), u), w), p4 = add(add(add(c, n), mul(u, -1)), w);
      const a = this.v(p1, nv(n, sub(p1, c))), b = this.v(p2, nv(n, sub(p2, c)));
      const d = this.v(p3, nv(n, sub(p3, c))), e = this.v(p4, nv(n, sub(p4, c)));
      this.q(a, b, d, e);
    };
    f(ax, ay, az); f(mul(ax, -1), az, ay); f(ay, az, ax); f(mul(ay, -1), ax, az); f(az, ax, ay); f(mul(az, -1), ay, ax);
  }
  // a flat polygon (counter-clockwise seen from its normal n) extruded by h against n: top, bottom and sides, flat-shaded
  extrude(poly: V3[], n: V3, h: number) {
    const nn = norm(n), top = poly, bot = poly.map((p) => madd(p, nn, -h)), m = poly.length;
    const tv = top.map((p) => this.v(p, nn)), bv = bot.map((p) => this.v(p, mul(nn, -1)));
    for (let i = 1; i < m - 1; i++) { this.t(tv[0], tv[i], tv[i + 1]); this.t(bv[0], bv[i + 1], bv[i]); }
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m, e = sub(top[j], top[i]), sn = norm(cross(e, nn));
      const a = this.v(top[i], sn), b = this.v(top[j], sn), c = this.v(bot[j], sn), d = this.v(bot[i], sn);
      this.q(a, b, c, d);
    }
  }
  append(o: MB) {
    const base = this.pos.length / 3;
    this.pos.push(...o.pos); this.nrm.push(...o.nrm); this.uv.push(...o.uv); this.col.push(...o.col); this.pbr.push(...o.pbr); this.si.push(...o.si); this.sw.push(...o.sw); this.cloth.push(...o.cloth);
    for (const i of o.idx) this.idx.push(i + base);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPbr', new THREE.Float32BufferAttribute(this.pbr, 2));
    g.setAttribute('aCloth', new THREE.Float32BufferAttribute(this.cloth, 4));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    return g;
  }
}

const lin = (hex: number): [number, number, number] => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const shade = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

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
// the skin's radius round the arm at `along`, one ray per direction: rays that miss (toward the elbow the field can
// end, or a ray stays inside the upper arm) or land far out (on the elbow's bulge) are filled from their good
// neighbours round the ring, or the ring before (a miss had fallen back to a fixed 40 mm and put a sharp fin through
// the rolled sleeve); smooth: one 1-2-1 pass round the ring
// (cap: a ray longer than cap × the ring's median counts as a miss; the sleeve passes Infinity, misses only)
function skinRadii(A: Anatomy, along: number, dirs: V3[], prev: number[] | null, smooth = false, cap = 1.3): number[] {
  const n = dirs.length, raw = dirs.map((d) => skinR(A, along, d));
  const ok = raw.filter((r) => r > 0).sort((a, b) => a - b), med = ok.length ? ok[ok.length >> 1] : 30;
  const good = raw.map((r) => r > 0 && r < med * cap);
  const rs = raw.map((r, j) => {
    if (good[j]) return r;
    let a = -1, b = -1;
    for (let k = 1; k < n && (a < 0 || b < 0); k++) { if (a < 0 && good[(j - k + n) % n]) a = k; if (b < 0 && good[(j + k) % n]) b = k; }
    if (a < 0) return prev ? prev[j] : med;
    return (raw[(j - a + n) % n] * b + raw[(j + b) % n] * a) / (a + b);
  });
  return smooth ? rs.map((r, j) => 0.25 * rs[(j - 1 + n) % n] + 0.5 * r + 0.25 * rs[(j + 1) % n]) : rs;
}
function armFrame(A: Anatomy) {
  const fd = A.foreDir, fu = A.foreUp, fl = perp(A.palm.R, fd);
  return { fd, fu, fl };
}

// ------------------------------------------------------------------------------------------------ sleeves
interface SleeveSpec { kind: Outfit; color: number; end: number }
interface Station { c: V3; ax: V3; along: number; s: number; up: V3; lat: V3 }
// the sleeve's surface as built: rings of nT points per station, for draping things on it (the placket, the patch)
interface SleeveSurf { rings: V3[][]; st: Station[]; nT: number; cuffLen: number; thPk: number }
function onSleeve(S: SleeveSurf, along: number, th: number): { p: V3; n: V3 } {
  const P = (al: number, t: number): V3 => {
    let i = 0; while (i < S.st.length - 2 && S.st[i + 1].along <= al) i++;
    const a0 = S.st[i].along, a1 = S.st[i + 1].along, k = Math.max(0, Math.min(1, (al - a0) / (a1 - a0)));
    const jf = (((t / (2 * Math.PI)) * S.nT) % S.nT + S.nT) % S.nT, j0 = Math.floor(jf) % S.nT, j1 = (j0 + 1) % S.nT, u = jf - Math.floor(jf);
    return lerp3(lerp3(S.rings[i][j0], S.rings[i][j1], u), lerp3(S.rings[i + 1][j0], S.rings[i + 1][j1], u), k);
  };
  const p = P(along, th), dA = sub(P(along + 2, th), P(along - 2, th)), dT = sub(P(along, th + 0.05), P(along, th - 0.05));
  let n = norm(cross(dA, dT));
  let i = 0; while (i < S.st.length - 2 && S.st[i + 1].along <= along) i++;
  if (dot(n, sub(p, S.st[i].c)) < 0) n = mul(n, -1);
  return { p, n };
}

function sleeve(mb: MB, A: Anatomy, s: SleeveSpec, q: Quality, seed: number): SleeveSurf {
  const { fd, fu, fl } = armFrame(A);
  const nT = q === 'high' ? 48 : 28;
  const elbowAlong = A.fore, upperLen = len(sub(A.shoulder, A.elbow));
  const upDir = norm(sub(A.shoulder, A.elbow));
  const rnd = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5 + 0.5;
  const female = A.scale < 1;
  const cuffLen = s.kind === 'shirt' ? (female ? 56 : 62) : s.kind === 'suit' ? (female ? 46 : 52) : 0;
  // stations along the arm: forearm from the sleeve's end to the elbow (close together through the cuff and the
  // gather above it), then the upper arm to the shoulder
  const st: Station[] = [];
  const start = s.end;
  const mk = (c: V3, ax: V3, along: number): Station => { const up = perp(fu, ax); return { c, ax, along, s: along - start, up, lat: cross(ax, up) }; };
  for (let a = start; a < elbowAlong; a += a - start < cuffLen + 24 || a < start + 40 ? 4 : 9) st.push(mk(madd(A.wrist, fd, a), fd, a));
  for (let t = 0; t <= upperLen + 1; t += 14) {
    const k = Math.min(1, t / 60), ax = norm(lerp3(fd, upDir, k * k * (3 - 2 * k)));
    st.push(mk(madd(A.elbow, upDir, t), ax, elbowAlong + t));
  }
  // the placket (and the cuff's button) on the outer side of the wrist; the felled seam runs under the arm
  const thPk = Math.atan2(dot(fl, st[0].lat), dot(fl, st[0].up)), thSeam = Math.PI;
  const rRef = female ? 31 : 35;         // the weave's circumferential millimetres are measured on one radius, so the ribs line up ring to ring
  const rings: V3[][] = [], uvs: [number, number][][] = [], shades: number[][] = [], cloths: Cloth[][] = [];
  let prevSkin: number[] | null = null;
  for (const S of st) {
    const { up, lat } = S;
    const ring: V3[] = [], uvr: [number, number][] = [], sh: number[] = [], cl: Cloth[] = [];
    const dirs = Array.from({ length: nT }, (_, j) => { const th = (j / nT) * Math.PI * 2; return norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th)))); });
    // the skin under this station, misses filled round the ring (the rolled sleeve starts near the elbow, where they
    // happen; its first ring had no ring before it and fell back to 40 mm: a fin through the roll)
    const skinRs = S.along < elbowAlong - 10 ? (prevSkin = skinRadii(A, S.along, dirs, prevSkin, false, Infinity)) : null;
    for (let j = 0; j < nT; j++) {
      const th = (j / nT) * Math.PI * 2, dir = dirs[j];
      let r = skinRs ? skinRs[j] : -1;
      const upperR = 47 * (female ? 0.86 : 1) * (1 + 0.1 * Math.cos(2 * th));
      // (just below the elbow: the last skin ring's radii; the last sleeve ring's, already eased, eased again station by
      // station and put a sharp point on the outside of the bent elbow)
      if (r < 0) r = S.along >= elbowAlong ? upperR : (prevSkin ? prevSkin[j] : 40);
      const inCuff = S.s < cuffLen;
      // ease over the skin: a stiff barrel cuff with the fuller sleeve gathered into it, a snug knit cuff under the
      // suit's roomier sleeve, a shirt's room up the arm
      let ease: number, zone = 0, foldK = 1;
      if (s.kind === 'shirt') { ease = inCuff ? 3.4 + 0.012 * S.s : 4.4 + 8 * Math.min(1, (S.s - cuffLen) / 80); zone = inCuff ? 1 : 0; foldK = inCuff ? 0 : 1; }
      else if (s.kind === 'suit') { ease = inCuff ? 2.0 + 0.6 * S.s / cuffLen : 4.5 + 6 * Math.min(1, (S.s - cuffLen) / 80); zone = inCuff ? 3 : 0; foldK = inCuff ? 0 : 0.45; }
      // (the rolled sleeve's body starts under the roll: its folds come in over the first 30 mm, or the crook's folds
      // pushed its open end out through the roll as a sharp fin)
      else { ease = 3.2 + 10 * Math.min(1, S.s / 90); foldK = Math.min(1, S.s / 30) ** 2; }
      // folds: drape and twist up the forearm, crumple in the crook of the elbow, bunching above a cuff
      const crook = Math.exp(-(((S.along - elbowAlong) / 45) ** 2)) * Math.max(0, -Math.cos(th) * 0.8 + 0.4);
      const bunch = s.kind === 'shirt' ? Math.exp(-(((S.s - cuffLen - 12) / 16) ** 2)) : 0;
      const f1 = Math.sin(th * 2 + S.s * 0.05 + rnd(1) * 6) * 1.6, f2 = Math.sin(th * 3 - S.s * 0.08 + rnd(2) * 6) * 1.1;
      const f3 = Math.sin(S.s * 0.36 + th * 1.3 + rnd(3) * 6) * Math.sin(th * 5 + rnd(4) * 6) * 2.4;
      const gather = bunch * (0.5 + 0.5 * Math.sin(th * 9 + rnd(5) * 6)) * 2.2;     // the gathers: close pleats round the cuff seam
      const fold = foldK * (f1 + f2 + (crook * 2.4 + bunch * 1.6) * f3 + crook * 2.5 + gather);
      r = r + ease + fold;
      ring.push(madd(S.c, dir, r));
      uvr.push([(j / nT) * (2 * Math.PI * rRef), S.along]);
      sh.push(Math.max(0.55, Math.min(1.08, 1 + fold * 0.05 - crook * 0.12 - (bunch ? 0.05 * (0.5 + 0.5 * Math.cos(th * 9 + rnd(5) * 6)) : 0))));
      // the seam coordinates: lateral mm to the felled seam, mm to the nearest ring seam (the cuff's edge stitch, the cuff seam)
      const seamL = s.kind === 'suit' ? 99 : r * angDiff(th, thSeam);
      const ringSeams = s.kind === 'shirt' ? [3, cuffLen] : s.kind === 'suit' ? [cuffLen] : [];
      let seamR = 99; for (const rs of ringSeams) if (Math.abs(S.s - rs) < Math.abs(seamR)) seamR = S.s - rs;
      cl.push([seamL, seamR, S.s, zone]);
    }
    rings.push(ring); uvs.push(uvr); shades.push(sh); cloths.push(cl);
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
      mb.color = shade(lin(s.color), shades[i][j]); mb.clothV = cloths[i][j];
      row.push(mb.v(p, mul(n, -1), uvs[i][j][0], uvs[i][j][1]));
    });
    ids.push(row);
  });
  mb.clothV = NO_CLOTH;
  for (let i = 0; i < ids.length - 1; i++) for (let j = 0; j < nT; j++) {
    const a = ids[i][j], b = ids[i + 1][j], c = ids[i + 1][(j + 1) % nT], d = ids[i][(j + 1) % nT];
    mb.q(a, d, c, b);
  }
  // the open end's turned edge and the inside, a few millimetres deep
  const first = rings[0], inner: V3[] = [], lip: V3[] = [];
  const ax0 = st[0].ax;
  first.forEach((p) => { const out = norm(sub(p, st[0].c)); lip.push(madd(madd(p, ax0, -0.9), out, -0.9)); inner.push(madd(madd(p, out, -1.8), ax0, 6)); });
  const c0 = lin(s.color);
  mb.color = shade(c0, 0.9); mb.bone = 1; mb.w2 = 0;
  const L0 = first.map((p, j) => mb.v(p, sub(p, st[0].c), uvs[0][j][0], uvs[0][j][1]));
  const L1 = lip.map((p) => mb.v(p, mul(ax0, -1), 0, 0));
  mb.color = shade(c0, 0.45);
  const L2 = inner.map((p) => mb.v(p, sub(st[0].c, p), 0, 0));
  for (let j = 0; j < nT; j++) {
    const jn = (j + 1) % nT;
    mb.q(L0[j], L1[j], L1[jn], L0[jn]);
    mb.q(L1[j], L2[j], L2[jn], L1[jn]);
  }
  mb.bone = b0;
  return { rings, st, nT, cuffLen, thPk };
}

// the shirt cuff's placket: the overlap where the cuff closes, a flap one cloth thickness proud with a free edge on
// one side (sewn down on the other), edge-stitched; the cufflink or button sits on it
function placket(mb: MB, S: SleeveSurf, color: number, q: Quality) {
  const nS = q === 'high' ? 12 : 7, L = S.cuffLen - 3, half = 8;
  const cols: { x: number; lift: number }[] = [{ x: -half, lift: 0.1 }, { x: -half + 3, lift: 1.0 }, { x: half - 1, lift: 1.0 }, { x: half, lift: 1.0 }, { x: half, lift: -0.2 }];
  const pts: V3[][] = [], cl: Cloth[][] = [], uvs: [number, number][][] = [];
  for (let i = 0; i <= nS; i++) {
    const s = 1.5 + (i / nS) * L, along = S.st[0].along + s;
    const row: V3[] = [], cr: Cloth[] = [], ur: [number, number][] = [];
    for (const c of cols) {
      const r = len(sub(onSleeve(S, along, S.thPk).p, S.st[0].c)), th = S.thPk + c.x / r;
      const { p, n } = onSleeve(S, along, th);
      // the flap's edge is a step: the top layer ends, the cuff beneath goes on
      row.push(madd(p, n, c.lift)); cr.push([c.x - half, 99, s, 2]); ur.push([c.x + 40, along]);
    }
    pts.push(row); cl.push(cr); uvs.push(ur);
  }
  mb.bone = 1; mb.w2 = 0; mb.color = lin(color);
  mb.grid(pts, false, uvs, false, cl);
  mb.clothV = NO_CLOTH;
}

// a gold cufflink (an oval, bevelled, polished) or a pearl button with its thread cross, on the placket
function cuffFastener(mb: MB, S: SleeveSurf, female: boolean, shirt: number) {
  const along = S.st[0].along + S.cuffLen * 0.42, r = len(sub(onSleeve(S, along, S.thPk).p, S.st[0].c));
  const { p, n } = onSleeve(S, along, S.thPk + 1.5 / r);
  const c = madd(p, n, 1.0), x = perp(S.st[0].ax, n);
  mb.bone = 1; mb.w2 = 0;
  if (!female) {
    mb.color = lin(GOLD); mb.metal = 1; mb.rough = 0.12; mb.soft = 0;
    mb.lathe(c, n, x, [[0.01, 0], [0.86, 0], [1, 0.5], [1, 1.3], [0.88, 1.8], [0.55, 2.05], [0.01, 2.1]], 28, false, 5.2, 3.6);
    // a small raised bar across it (the link's design: a plain bar, no monogram)
    mb.rough = 0.08;
    mb.box(madd(c, n, 2.15), mul(x, 2.6), mul(cross(n, x), 0.45), mul(n, 0.2));
  } else {
    mb.color = lin(0xf1ece2); mb.metal = 0; mb.rough = 0.22;
    mb.lathe(c, n, x, [[0.01, 0], [4.0, 0], [4.6, 0.5], [4.6, 1.3], [4.0, 1.95], [2.6, 2.1], [1.6, 1.9], [0.01, 1.85]], 24);
    // four holes and the thread cross
    mb.color = [0.08, 0.07, 0.06]; mb.rough = 0.6;
    const y = cross(n, x);
    for (const [hx, hy] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) mb.lathe(madd(madd(c, x, hx), y, hy), n, x, [[0.01, 1.7], [0.42, 1.7], [0.42, 1.95], [0.01, 1.95]], 10, true);
    mb.color = shade(lin(shirt), 0.85); mb.rough = 0.7;
    mb.box(madd(c, n, 1.95), mul(norm(add(x, y)), 1.65), mul(norm(sub(x, y)), 0.2), mul(n, 0.16));
    mb.box(madd(c, n, 1.95), mul(norm(sub(x, y)), 1.65), mul(norm(add(x, y)), 0.2), mul(n, 0.16));
  }
}

// the Rossini "R" chevron patch on the fire suit's forearm: a thin embroidered rectangle lifted off the ribs,
// with a merrowed border (the accent) round it; the face is a canvas texture (patchTexture)
function patch(mb: MB, S: SleeveSurf, female: boolean, accent: number) {
  const W = female ? 24 : 27, H = female ? 17 : 19, along0 = S.st[0].along + S.cuffLen + (female ? 38 : 44);
  // turned round the sleeve to face the driver's eye (wheel straight), so it reads from the seat
  let th0 = 0, best = -2;
  for (let k = 0; k < 72; k++) {
    const th = (k / 72) * Math.PI * 2, { p, n } = onSleeve(S, along0, th);
    const pc = mb.o.toCar(p, mb.side), nc = mb.o.dirToCar(n, mb.side);
    const e = norm([EYE.x - pc[0], EYE.y - pc[1], EYE.z - pc[2]]), f = dot(norm(nc), e);
    if (f > best) { best = f; th0 = th; }
  }
  const nx = 7, ny = 5, pts: V3[][] = [], uvs: [number, number][][] = [];
  const r = len(sub(onSleeve(S, along0, th0).p, S.st[0].c));
  for (let i = 0; i <= ny; i++) {
    const row: V3[] = [], ur: [number, number][] = [];
    for (let j = 0; j <= nx; j++) {
      const u = j / nx, v = i / ny, along = along0 + (v - 0.5) * H, th = th0 + ((u - 0.5) * W) / r;
      const { p, n } = onSleeve(S, along, th);
      row.push(madd(p, n, 1.2)); ur.push([u, 1 - v]);
    }
    pts.push(row); uvs.push(ur);
  }
  // the left arm is the right's mirror image: flip the face's u where that would make the R read backwards (u to the
  // right and the texture's v up must make a right-handed pair with the outward normal, in the car's frame)
  {
    const c = (p: V3) => mb.o.toCar(p, mb.side), mi = ny >> 1, mj = nx >> 1;
    const tu = sub(c(pts[mi][nx]), c(pts[mi][0])), tv = sub(c(pts[0][mj]), c(pts[ny][mj]));
    const nC = mb.o.dirToCar(onSleeve(S, along0, th0).n, mb.side);
    if (dot(cross(tu, tv), nC) < 0) for (const row of uvs) for (const uv of row) uv[0] = 1 - uv[0];
  }
  mb.bone = 1; mb.w2 = 0; mb.color = [1, 1, 1]; mb.metal = 0; mb.rough = 0.75;
  // (flip: rows run along the arm and columns round it, so the grid's own normals point into the sleeve)
  mb.grid(pts, false, uvs, true);
  // the border's skirt down to the cloth, in the accent colour
  mb.color = lin(accent);
  const edge: [number, number][] = [];
  for (let j = 0; j <= nx; j++) edge.push([0, j]);
  for (let i = 1; i <= ny; i++) edge.push([i, nx]);
  for (let j = nx - 1; j >= 0; j--) edge.push([ny, j]);
  for (let i = ny - 1; i >= 1; i--) edge.push([i, 0]);
  const ctr = onSleeve(S, along0, th0);
  for (let k = 0; k < edge.length; k++) {
    const [i0, j0] = edge[k], [i1, j1] = edge[(k + 1) % edge.length];
    const a = pts[i0][j0], b = pts[i1][j1], out = norm(sub(lerp3(a, b, 0.5), ctr.p));
    const a0 = mb.v(a, out, uvs[i0][j0][0], uvs[i0][j0][1]), b0 = mb.v(b, out, uvs[i1][j1][0], uvs[i1][j1][1]);
    const a1 = mb.v(madd(a, ctr.n, -1.4), out, uvs[i0][j0][0], uvs[i0][j0][1]), b1 = mb.v(madd(b, ctr.n, -1.4), out, uvs[i1][j1][0], uvs[i1][j1][1]);
    mb.q(a0, b0, b1, a1);
  }
}

// the rolled sleeve's roll: the cuff turned up twice into a neat, flat band with rounded edges, the inner fold's edge
// peeking out as a step a little below the middle, and the cuff's hem stitch round it near the lower edge (drawn by
// the cloth shader from the ring-seam coordinate); a slight drape round the arm, nothing lumpy
function roll(mb: MB, A: Anatomy, at: number, color: number, q: Quality, seed: number) {
  const { fd, fu } = armFrame(A);
  const nT = q === 'high' ? 48 : 28, nP = q === 'high' ? 22 : 12;
  const c = lin(color), pts: V3[][] = [], cols: number[][] = [], cl: Cloth[][] = [], al: number[] = [];
  const W = 38, T = 6.5, lo = at - W / 2, hem = 5.5, fold = 0.42;
  const up = perp(fu, fd), lat = cross(fd, up);
  const dirAt = (j: number) => { const th = (j / nT) * Math.PI * 2; return norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th)))); };
  const dirs = Array.from({ length: nT }, (_, j) => dirAt(j));
  let prevRs: number[] | null = null;
  // (smoothed: the folded band bridges the skin's small dips)
  const skinRing = (along: number) => (prevRs = skinRadii(A, along, dirs, prevRs, true));
  for (let i = 0; i <= nP; i++) {
    // rows bunched toward the rounded edges and the fold's step, so the profile stays crisp
    const u = i / nP, t = 0.5 - 0.5 * Math.cos(u * Math.PI), along = lo + t * W, ring: V3[] = [], cr: number[] = [], cc: Cloth[] = [];
    al.push(along);
    // the band's profile: rounded at both edges (a quarter-round over ~3.5 mm), the upper layer 0.9 mm proud above
    // the fold's edge
    const s = t * W, e = Math.min(s, W - s), edge = Math.sqrt(Math.max(0, 1 - Math.max(0, 1 - e / 3.5) ** 2));
    const step = 0.9 * (1 / (1 + Math.exp(-(t - fold) * W * 2.2)));
    const rs = skinRing(along);
    for (let j = 0; j < nT; j++) {
      const th = (j / nT) * Math.PI * 2, dir = dirAt(j);
      let r = rs[j];
      const drape = 0.5 * Math.sin(th * 2 + seed) + 0.3 * Math.sin(th * 5 + seed * 2.3);
      r += 2.6 + (T + step + drape) * edge;
      ring.push(madd(madd(A.wrist, fd, along), dir, r));
      // shading: the rounded edges and the shadow under the step a little darker
      const under = Math.exp(-((((t - fold + 0.03) * W) / 1.2) ** 2));
      cr.push(0.8 + 0.2 * edge - 0.14 * under);
      cc.push([99, s - hem, s, 0]);
    }
    pts.push(ring); cols.push(cr); cl.push(cc);
  }
  mb.bone = 1; mb.w2 = 0;
  const ids: number[][] = [];
  pts.forEach((ring, i) => {
    const row: number[] = [];
    ring.forEach((p, j) => {
      const jp = (j + 1) % nT, jm = (j - 1 + nT) % nT, ip = Math.min(nP, i + 1), im = Math.max(0, i - 1);
      const n = cross(sub(pts[ip][j], pts[im][j]), sub(ring[jp], ring[jm]));
      mb.color = shade(c, cols[i][j]); mb.clothV = cl[i][j];
      row.push(mb.v(p, mul(n, -1), (j / nT) * 2 * Math.PI * 38, al[i]));
    });
    ids.push(row);
  });
  mb.clothV = NO_CLOTH;
  for (let i = 0; i < nP; i++) for (let j = 0; j < nT; j++) mb.q(ids[i][j], ids[i][(j + 1) % nT], ids[i + 1][(j + 1) % nT], ids[i + 1][j]);
}

// ------------------------------------------------------------------------------------------------ watches
// (the smart watch: a silver titanium case, polished: the ULTRA look's metal, crisp highlights, not a dull gunmetal)
const GOLD = 0xe8b65c, STEEL = 0xd9dde2, TITANIUM = 0xb4b8bd, BLUED = 0x1a1d26;
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
  const metal = kind === 'gold' ? GOLD : kind === 'steel' ? STEEL : TITANIUM;
  mbMetal.bone = 1; mbMetal.w2 = 0;
  if (kind !== 'smart') {
    const R = 19 * k, H = 10 * k;
    // case back, middle, polished bezel (rounded), the crystal's seat
    mbMetal.color = lin(metal); mbMetal.metal = 1; mbMetal.rough = 0.28;
    mbMetal.lathe(base, N, X, [[R * 0.82, 0], [R * 0.96, 0.6], [R, 2], [R * 1.005, H * 0.62], [R * 0.99, H * 0.7]], seg);
    // the case back (closed: where the wrist falls away beside the case, the dial's underside showed through)
    mbMetal.disc(base, N, X, R * 0.83, seg);
    mbMetal.rough = 0.1;
    mbMetal.lathe(base, N, X, [[R * 0.99, H * 0.7], [R * 0.985, H * 0.78], [R * 0.95, H * 0.86], [R * 0.9, H * 0.9], [R * 0.86, H * 0.9]], seg);
    // the inner wall (rehaut) down to the dial
    mbMetal.rough = 0.3;
    mbMetal.lathe(base, N, X, [[R * 0.86, H * 0.9], [R * 0.845, H * 0.78]], seg, true);
    // the crown at 3 o'clock: fluted, with a domed cap
    mbMetal.rough = 0.18;
    mbMetal.lathe(madd(madd(base, N, H * 0.42), X, R * 0.98), X, N, [[2.0 * k, 0], [2.7 * k, 0.6], [3.0 * k, 1.2], [3.0 * k, 3.6 * k], [2.6 * k, 4.2 * k], [1.4 * k, 4.6 * k], [0.01, 4.7 * k]], 24, false, 1, 1, 0.1);
    // lugs: four short horns from the case down toward the wrist, the bracelet's end links between them
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
      const c = madd(madd(madd(base, Y, sy * R * 1.0), X, sx * R * 0.48), N, H * 0.3);
      const dY = norm(madd(mul(Y, sy), N, -0.35));
      mbMetal.soft = 0.7; mbMetal.box(c, mul(dY, 3.6 * k), mul(X, 1.5 * k), mul(N, 2.0 * k)); mbMetal.soft = 0;
    }
    // the dial
    const dz = H * 0.78, dr = R * 0.84;
    mbDial.bone = 1; mbDial.color = [1, 1, 1];
    mbDial.disc(madd(base, N, dz), N, X, dr, seg, 1);
    // applied indices (polished gold batons, a double at 12) inside the printed index ring
    mbMetal.rough = 0.1; mbMetal.color = lin(metal);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, rd = norm(add(mul(Y, Math.cos(a)), mul(X, Math.sin(a)))), tg = cross(N, rd);
      const long = i % 3 === 0 ? 1.3 : 1;
      if (i === 0) { for (const o of [-1, 1]) mbMetal.box(madd(madd(madd(base, N, dz + 0.3), rd, dr * 0.76), tg, o * 0.85 * k), mul(rd, 1.6 * long * k), mul(tg, 0.5 * k), mul(N, 0.3)); }
      else mbMetal.box(madd(madd(base, N, dz + 0.3), rd, dr * 0.76), mul(rd, 1.6 * long * k), mul(tg, 0.6 * k), mul(N, 0.3));
    }
    // blued-steel dauphine hands (dark: they read on the silvered dial), a thin seconds hand, a gold centre cap
    const [h, m, s] = time;
    mbMetal.color = lin(BLUED); mbMetal.metal = 1; mbMetal.rough = 0.22;
    const hand = (ang: number, L: number, W: number, z: number, tail: number) => {
      const rd = norm(add(mul(Y, Math.cos(ang)), mul(X, Math.sin(ang)))), tg = cross(N, rd), o = madd(base, N, dz + z);
      const pt = (a: number, b: number) => madd(madd(o, rd, a), tg, b);
      mbMetal.extrude([pt(-tail, -W * 0.4), pt(L * 0.3, -W), pt(L, 0), pt(L * 0.3, W), pt(-tail, W * 0.4)], N, 0.3);
    };
    const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2, ma = (m + s / 60) / 60 * Math.PI * 2, sa = (s / 60) * Math.PI * 2;
    hand(ha, dr * 0.56, 1.5 * k, 0.9, 2.2 * k); hand(ma, dr * 0.86, 1.1 * k, 1.3, 2.6 * k);
    { const rd = norm(add(mul(Y, Math.cos(sa)), mul(X, Math.sin(sa)))), tg = cross(N, rd); mbMetal.box(madd(madd(base, N, dz + 1.7), rd, (dr * 0.9 - 4) / 2), mul(rd, (dr * 0.9 + 4) / 2), mul(tg, 0.16 * k), mul(N, 0.12)); }
    mbMetal.color = lin(metal); mbMetal.rough = 0.1;
    mbMetal.lathe(madd(base, N, dz + 1.6), N, X, [[1.2 * k, 0], [1.2 * k, 0.5], [0.01, 0.75]], 12);
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
    // the rounded-rectangle case (titanium, polished), its screen and the glass over it
    mbMetal.color = lin(TITANIUM); mbMetal.metal = 1; mbMetal.rough = 0.2;
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
  const frame = (a: { p: V3; n: V3 }, b: { p: V3; n: V3 }) => {
    const t = norm(sub(b.p, a.p));
    let n = norm(cross(fd, t)); if (dot(n, add(a.n, b.n)) < 0) n = mul(n, -1);
    return { t, n, L: len(sub(b.p, a.p)) };
  };
  // one articulated band: the outer pieces of each link (brushed), the polished centre pieces staggered over the
  // joints (they hold neighbouring links together, as the pins do), and the pins' bar under it all, so no light
  // shows through between the rows
  mb.soft = 0.7;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], c = lerp3(a.p, b.p, 0.5), { t, n, L } = frame(a, b);
    mb.color = lin(metal); mb.metal = 1; mb.rough = 0.3;
    for (const sx of [-1, 1]) mb.box(madd(madd(c, fd, sx * W * 0.345), n, 1.9), mul(t, L * 0.48), mul(fd, W * 0.15), mul(n, 1.5));
    // the bar under the link, across the whole width (darker: it is mostly in shadow between the pieces)
    mb.color = shade(lin(metal), 0.55); mb.rough = 0.45;
    mb.box(madd(c, n, 1.2), mul(t, L * 0.5), mul(fd, W * 0.47), mul(n, 0.75));
    if (i + 2 < path.length) {
      const nx = path[i + 2], f2 = frame(b, nx), tc = norm(add(t, f2.t)), nc = norm(add(n, f2.n));
      mb.color = lin(metal); mb.rough = 0.07;
      mb.box(madd(b.p, nc, 2.15), mul(tc, (L + f2.L) * 0.24), mul(fd, W * 0.2), mul(nc, 1.55));
    }
  }
  mb.soft = 0;
}

function sportBand(mb: MB, A: Anatomy, along: number, N: V3, Hh0: number, female: boolean, q: Quality, attach?: [V3, V3]) {
  const { fd } = armFrame(A);
  const gap = Math.asin(Math.min(0.9, (Hh0 / 2) / 30));
  const path = bandPath(A, along, N, q === 'high' ? 40 : 24, gap, attach);
  const bw = (female ? 18 : 21), T = 2.6;
  mb.color = lin(0x22282a); mb.metal = 0; mb.rough = 0.72;
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
  const c = lerp3(a, b, 0.3), seg = q === "high" ? 48 : 28;      // near the web, where rings sit
  const W = female ? 2.4 : 4.6, T = female ? 1.5 : 1.8;
  const f = A.field, pts: V3[][] = [];
  const prof: [number, number][] = [[0, -W / 2], [T * 0.7, -W / 2], [T, -W * 0.3], [T, W * 0.3], [T * 0.7, W / 2], [0, W / 2]];
  const rs: number[] = [];
  for (let j = 0; j < seg; j++) {
    const th = (j / seg) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th))));
    let lo = 0, hi = 16;
    // the ring finger's own surface
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2, p = madd(c, dir, m); if (f.groupDist(G_FINGER + 2, p[0], p[1], p[2]) < 0) lo = m; else hi = m; }
    // and the skin as it is meshed (the flesh blended in from the web and the neighbours, the bulge on the rim):
    // the first exit going out from the finger's axis, over the band's whole width
    let full = 0;
    for (let m = lo * 0.5; m < 18; m += 0.2) {
      let inside = false;
      for (const z of [-W / 2, 0, W / 2]) { const p = madd(madd(c, dir, m), d, z); if (f.eval(p[0], p[1], p[2], null, 0) < 0) { inside = true; break; } }
      if (!inside) { full = m; break; }
      full = m;
    }
    // where a neighbour presses on the finger the skin runs on into it: the band goes under that flesh (hidden)
    // rather than standing off it like a fin
    rs.push(full > lo + 3 ? lo - 0.4 : Math.max(lo, full) + 0.3);
  }
  for (const [rOff, z] of prof) {
    const row: V3[] = [];
    for (let j = 0; j < seg; j++) { const th = (j / seg) * Math.PI * 2, dir = norm(add(mul(up, Math.cos(th)), mul(lat, Math.sin(th)))); row.push(madd(madd(c, dir, rs[j] + rOff), d, z)); }
    pts.push(row);
  }
  pts.push(pts[0]);
  mbMetal.bone = 2; mbMetal.w2 = 0; mbMetal.color = lin(GOLD); mbMetal.metal = 1; mbMetal.rough = 0.07;
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
  mb.bone = 1; mb.w2 = 0; mb.color = lin(GOLD); mb.metal = 1; mb.rough = 0.12;
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
// the weaves: a height field drawn on a canvas tile of `mm` millimetres, as a colour map (the threads' shading) and a
// normal map; the sleeve's UVs are in millimetres, so the tile repeats 1/mm times per unit
interface Weave { map: THREE.Texture; normalMap: THREE.Texture; mm: number }
let weaveCache: Map<string, Weave> | null = null;
function weave(kind: 'oxford' | 'twill' | 'ripstop'): Weave {
  weaveCache ??= new Map();
  const hit = weaveCache.get(kind);
  if (hit) return hit;
  const n = 256, h = new Float32Array(n * n);
  // the tile in mm and the height at (x, y) mm
  const mm = kind === 'oxford' ? 3.2 : kind === 'twill' ? 4 : 6;
  const hash = (x: number, y: number) => (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  for (let yi = 0; yi < n; yi++) for (let xi = 0; xi < n; xi++) {
    const x = (xi / n) * mm, y = (yi / n) * mm;
    let v: number;
    if (kind === 'oxford') {
      // a basket weave: pairs of threads 0.8 mm wide going over and under
      const cx = Math.floor(x / 0.8), cy = Math.floor(y / 0.8), over = (cx + cy) & 1;
      const tx = (x / 0.8) % 1, ty = (y / 0.8) % 1;
      const warp = Math.sin(((tx * 2) % 1) * Math.PI), weft = Math.sin(((ty * 2) % 1) * Math.PI);   // two threads per cell
      v = over ? 0.55 + 0.45 * warp * Math.pow(Math.sin(ty * Math.PI), 0.4) : 0.35 + 0.45 * weft * Math.pow(Math.sin(tx * Math.PI), 0.4);
    } else if (kind === 'twill') {
      // a 2/1 twill: diagonal wales 1.33 mm apart, each a rounded ridge
      const d = ((x + y) / 1.333) % 1;
      v = 0.3 + 0.7 * Math.pow(Math.sin(d * Math.PI), 1.5);
      v *= 0.85 + 0.15 * Math.sin(((x - y) / 0.5) * Math.PI);
    } else {
      // ripstop: a fine plain weave with a heavier thread every 6 mm each way
      const fx = Math.sin((x / 0.45) * Math.PI), fy = Math.sin((y / 0.45) * Math.PI);
      v = 0.45 + 0.25 * fx * fy;
      const gx = Math.exp(-((Math.min(x, mm - x) / 0.35) ** 2)), gy = Math.exp(-((Math.min(y, mm - y) / 0.35) ** 2));
      v += 0.35 * Math.max(gx, gy);
    }
    h[yi * n + xi] = v + hash(xi, yi) * 0.08;
  }
  const col = new Uint8Array(n * n * 4), nrm = new Uint8Array(n * n * 4);
  const hAt = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4, v = hAt(x, y);
    // the colour: threads lit from above, the dips between them darker (a faint weave, not a checkerboard)
    const c = 255 * (0.88 + 0.12 * v);
    col[o] = col[o + 1] = col[o + 2] = c; col[o + 3] = 255;
    const hx = hAt(x + 1, y) - hAt(x - 1, y), hy = hAt(x, y + 1) - hAt(x, y - 1);
    const s = kind === 'ripstop' ? 1.4 : 2.2, nx = -hx * s, ny = -hy * s, l = Math.hypot(nx, ny, 1);
    nrm[o] = ((nx / l) * 0.5 + 0.5) * 255; nrm[o + 1] = ((ny / l) * 0.5 + 0.5) * 255; nrm[o + 2] = ((1 / l) * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  const tex = (d: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 8; t.repeat.set(1 / mm, 1 / mm); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    return t;
  };
  const w = { map: tex(col, true), normalMap: tex(nrm, false), mm };
  weaveCache.set(kind, w);
  return w;
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

// the cloth: the weave's colour and normal maps under a procedural layer drawn from aCloth (seam distances in mm):
// the felled seam's ridge with its two rows of stitching, the cuff's edge stitch and the cuff seam, the placket's
// edge stitch, the knit cuff's ribs, the fire suit's ribs round the arm. Thread and stitches
// fade out where a pixel is wider than a thread, so nothing sparkles from the seat.
function clothMaterial(color: number, outfit: Outfit, q: Quality) {
  const kind = outfit === 'shirt' ? 'oxford' : outfit === 'work' ? 'twill' : 'ripstop';
  const w = weave(kind);
  // the sheen: a soft cotton halo on the shirts; the fire suit's black stays black (a strong pale sheen greyed it)
  const sheenC = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), outfit === 'suit' ? 0.12 : 0.35);
  // (the olive twill gets little: a strong pale sheen washed the roll out to a whitish green)
  const sheen = (outfit === 'suit' ? 0.3 : outfit === 'work' ? 0.25 : 0.7) * (q === 'high' ? 1 : 0.45);
  const m = new THREE.MeshPhysicalMaterial({
    // (the display colour as an albedo a touch darker, as the skin does: the pressed white otherwise burnt out flat)
    color: new THREE.Color(0.88, 0.88, 0.88),
    vertexColors: true, roughness: outfit === 'suit' ? 0.8 : 0.86, metalness: 0, sheen, sheenColor: sheenC, sheenRoughness: 0.55,
    map: w.map, normalMap: w.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.7,
  });
  // the thread: a tone of the cloth on the shirt, grey on the suit, a contrasting tan triple-stitch on the work shirt
  const thread = new THREE.Color(outfit === 'shirt' ? color : outfit === 'suit' ? 0x45454b : 0xc9a86a);
  if (outfit === 'shirt') thread.multiplyScalar(0.82);
  const uniforms = { uThread: { value: thread }, uOutfit: { value: outfit === 'shirt' ? 0 : outfit === 'suit' ? 1 : 2 } };
  m.customProgramCacheKey = () => `hands-cloth-${outfit}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCloth; varying vec4 vCloth; varying vec2 vMm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = aCloth; vMm = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
varying vec4 vCloth; varying vec2 vMm; uniform vec3 uThread; uniform float uOutfit;
float ln(float d, float w) { return 1.0 - smoothstep(w, w + 0.3, abs(d)); }
${BUMP_GLSL}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
float pixC = length(fwidth(vMm));                 // mm per pixel
float sharp = smoothstep(1.4, 0.45, pixC);
float sx = vCloth.x, sr = vCloth.y, ss = vCloth.z, zone = vCloth.w;
float stitch = 0.0, groove = 0.0, HC = 0.0;
float dashL = step(0.5, fract(ss / 2.4)), dashR = step(0.5, fract(vMm.x / 2.4));
if (zone < 1.5 && sx < 50.0) {
  // the felled seam: a ridge with a row of stitching either side
  stitch += (ln(sx - 3.0, 0.3) + ln(sx + 3.0, 0.3)) * dashL;
  groove += 0.6 * (1.0 - smoothstep(0.0, 4.5, abs(sx)));
  HC += 0.35 * (1.0 - smoothstep(0.0, 3.2, abs(sx)));
}
if (zone > 1.5 && zone < 2.5) { stitch += ln(sx + 2.2, 0.3) * dashL; HC -= 0.1 * ln(sx + 2.2, 0.5); }   // the placket, edge-stitched
if (sr < 50.0) { stitch += ln(sr, 0.3) * dashR; groove += 0.5 * (1.0 - smoothstep(0.0, 1.6, abs(sr))); HC -= 0.2 * (1.0 - smoothstep(0.0, 1.2, abs(sr))); }
if (zone > 2.5 && zone < 3.5) {
  // the knit cuff: ribs along the sleeve, 1.4 mm apart
  float rib = 0.5 + 0.5 * cos(vMm.x / 1.4 * 6.2832);
  HC += 0.35 * rib * sharp; diffuseColor.rgb *= 0.84 + 0.2 * rib;
}
if (uOutfit > 0.5 && uOutfit < 1.5 && zone < 0.5) {
  // the fire suit's ribbed body: rounded ribs round the arm, 4.5 mm apart, the furrows a shade darker; faded to a
  // plain dark cloth where a pixel is wider than a rib's half (no moire from the seat)
  float rr = 0.5 + 0.5 * cos(vMm.y / 4.5 * 6.2832), ribK = smoothstep(2.6, 1.2, pixC);
  HC += 0.55 * rr * ribK; diffuseColor.rgb *= mix(0.93, 0.8 + 0.22 * rr, ribK);
}
stitch = clamp(stitch, 0.0, 1.0) * sharp;
diffuseColor.rgb *= 1.0 - 0.22 * groove;
diffuseColor.rgb = mix(diffuseColor.rgb, uThread, stitch);
HC += 0.12 * stitch;
`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bumpNormal(-vViewPosition, normal, HC * 0.001, faceDirection);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor - 0.12 * stitch, 0.3, 1.0);');
  };
  return m;
}

function dialTexture(kind: 'gold' | 'steel' | 'smart', time: [number, number, number], accent: number) {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!;
  const cx = n / 2;
  if (kind === 'smart') {
    // the Wrench's face: a tyre-grip readout (our own design) lit in the driver's green: the grip left as an arc
    // gauge and a big number, the four tyres' bite as bars, the time small at the top
    const green = '#' + accent.toString(16).padStart(6, '0'), dim = 'rgba(125,255,168,0.28)';
    g.fillStyle = '#020403'; g.fillRect(0, 0, n, n);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#cfd8d2'; g.font = '500 40px system-ui, Helvetica, Arial, sans-serif';
    g.fillText(`${time[0]}:${String(time[1]).padStart(2, '0')}`, cx, 54);
    // the gauge: a 270-degree track, the grip filled on it
    const grip = 0.92, r = 150, a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5;
    g.lineCap = 'round'; g.lineWidth = 22;
    g.strokeStyle = dim; g.beginPath(); g.arc(cx, cx + 10, r, a0, a1); g.stroke();
    g.strokeStyle = green; g.beginPath(); g.arc(cx, cx + 10, r, a0, a0 + (a1 - a0) * grip); g.stroke();
    // the ticks on the track
    g.lineWidth = 3; g.strokeStyle = 'rgba(207,216,210,0.5)';
    for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * (i / 10); g.beginPath(); g.moveTo(cx + Math.cos(a) * (r + 20), cx + 10 + Math.sin(a) * (r + 20)); g.lineTo(cx + Math.cos(a) * (r + 30), cx + 10 + Math.sin(a) * (r + 30)); g.stroke(); }
    g.fillStyle = green; g.font = '700 118px system-ui, Helvetica, Arial, sans-serif';
    g.fillText(`${Math.round(grip * 100)}`, cx, cx - 8);
    g.font = '600 34px system-ui, Helvetica, Arial, sans-serif'; g.fillStyle = '#cfd8d2';
    g.fillText('GRIP %', cx, cx + 68);
    // the tyres: four bars, front left to rear right
    const bites = [0.94, 0.9, 0.88, 0.93], labels = ['FL', 'FR', 'RL', 'RR'];
    bites.forEach((b, i) => {
      const x = cx - 105 + i * 70, y0 = n - 60, hgt = 72;
      g.fillStyle = dim; g.fillRect(x - 14, y0 - hgt, 28, hgt);
      g.fillStyle = green; g.fillRect(x - 14, y0 - hgt * b, 28, hgt * b);
      g.fillStyle = '#cfd8d2'; g.font = '500 22px system-ui, Helvetica, Arial, sans-serif'; g.fillText(labels[i], x, n - 34);
    });
  } else {
    // a sunburst dial: radial brushing as fine light and dark spokes over the base colour
    const base = kind === 'gold' ? [226, 224, 216] : [18, 22, 30];   // gold watch: a silvered white dial
    g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2, l = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      g.strokeStyle = `rgba(${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${l > 0 ? 255 : 0},${Math.abs(l) * 0.06})`;
      g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cx); g.lineTo(cx + Math.cos(a) * cx, cx + Math.sin(a) * cx); g.stroke();
    }
    const ink = kind === 'gold' ? '#2a2420' : '#e9e6df';
    g.strokeStyle = ink; g.fillStyle = ink;
    // the index ring: a printed chapter ring (two circles) with the minute track between them, the hour marks bolder
    g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cx, cx * 0.925, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cx, cx * 0.97, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r0 = cx * 0.97, r1 = cx * (i % 5 === 0 ? 0.895 : 0.925);
      g.lineWidth = i % 5 === 0 ? 4 : 1.6; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cx - Math.cos(a) * r1); g.stroke();
    }
    // a fine inner circle the batons sit on, and the date at 3
    g.lineWidth = 1; g.strokeStyle = 'rgba(42,36,32,0.45)'; g.beginPath(); g.arc(cx, cx, cx * 0.62, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f7f5ef'; g.fillRect(cx + cx * 0.56 - 22, cx - 17, 44, 34);
    g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(cx + cx * 0.56 - 22, cx - 17, 44, 34);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = ink; g.font = '600 26px Georgia, "Times New Roman", serif'; g.fillText('21', cx + cx * 0.56, cx + 1);
    g.font = '600 34px Georgia, "Times New Roman", serif'; g.fillText('ROSSINI', cx, cx - 95);
    g.font = '500 17px Georgia, "Times New Roman", serif'; g.fillText('AUTOMATIC', cx, cx + 100);
    g.font = '500 13px Georgia, serif'; g.fillText('ORANGE COUNTY', cx, cx + 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// the Rossini "R" chevron patch: a black twill ground, the chevron and a serif R embroidered in the accent, a
// merrowed border; our own badge
function patchTexture(suit: number, accent: number) {
  const W = 256, H = 180, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const bg = new THREE.Color(suit).lerp(new THREE.Color(1, 1, 1), 0.015), acc = '#' + accent.toString(16).padStart(6, '0');
  g.fillStyle = '#' + bg.getHexString(); g.fillRect(0, 0, W, H);
  // the ground's twill
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
  for (let i = -H; i < W + H; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  // the merrowed border: a dense zigzag of thread
  g.strokeStyle = acc; g.lineWidth = 3; g.lineCap = 'round';
  const b = 7;
  for (let i = 0; i < W; i += 4) { g.beginPath(); g.moveTo(i, 1); g.lineTo(i + 2, b * 2); g.stroke(); g.beginPath(); g.moveTo(i, H - 1); g.lineTo(i + 2, H - b * 2); g.stroke(); }
  for (let i = 0; i < H; i += 4) { g.beginPath(); g.moveTo(1, i); g.lineTo(b * 2, i + 2); g.stroke(); g.beginPath(); g.moveTo(W - 1, i); g.lineTo(W - b * 2, i + 2); g.stroke(); }
  // the chevron across the top, pointing down, as satin stitch (slanted hatching inside its outline)
  g.save();
  g.beginPath(); g.moveTo(40, 24); g.lineTo(W / 2, 58); g.lineTo(W - 40, 24); g.lineTo(W - 40, 42); g.lineTo(W / 2, 78); g.lineTo(40, 42); g.closePath();
  g.clip(); g.fillStyle = acc; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
  for (let i = -H; i < W + H; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 40, H); g.stroke(); }
  g.restore();
  // the R
  g.fillStyle = acc; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 84px Georgia, "Times New Roman", serif'; g.fillText('R', W / 2, 124);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  g.save(); g.beginPath(); g.rect(W / 2 - 45, 88, 90, 74); g.clip();
  for (let i = -60; i < 130; i += 3) { g.beginPath(); g.moveTo(W / 2 - 45 + i, 88); g.lineTo(W / 2 - 45 + i + 20, 162); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------------------------------------ assemble
// The accessories' geometry (sampled from the arm's field, the slow part) is kept per presentation, quality and look;
// each build clones it, so a second driver with the same look costs only the materials.
interface AccGeo { cloth: THREE.BufferGeometry | null; patch: THREE.BufferGeometry | null; metal: THREE.BufferGeometry | null; dial: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null; sleeveFrom: number; outfit: Outfit; sleeveColor: number }
const accCache = new Map<string, AccGeo>();
function accGeometry(o: AccOptions): AccGeo {
  const A = o.anatomy, look = o.look, q = o.quality, outfit = outfitOf(look), accent = accentOf(look);
  const key = [A.pres, q, look.sleeve, look.gloves, look.watch, look.ring, look.bracelet, o.female, outfit, accent, o.watchTime.join(':')].join('|');
  const hit = accCache.get(key);
  if (hit) return hit;
  const metal = new MB(0, o), dial = new MB(0, o), glass = new MB(0, o), cloth = new MB(0, o), patchMB = new MB(0, o);
  // ---- sleeves
  const color = look.sleeve ?? 0x55603c;
  const kinds: SleeveSpec = outfit === 'suit' ? { kind: 'suit', color, end: 16 } : outfit === 'shirt' ? { kind: 'shirt', color, end: 52 } : { kind: 'work', color, end: rollAt(o.female) };
  const clothSides = [new MB(0, o), new MB(1, o)], metalSides = [new MB(0, o), new MB(1, o)], patchSides = [new MB(0, o), new MB(1, o)];
  for (let side = 0; side < 2; side++) {
    const mb = clothSides[side];
    if (kinds.kind === 'work') {
      // rolled up past the forearm: the sleeve body starts above the roll
      sleeve(mb, A, { ...kinds, end: kinds.end + 12 }, q, side + 1);
      roll(mb, A, kinds.end + 4, kinds.color, q, side + 3);
    } else {
      const S = sleeve(mb, A, kinds, q, side + 1);
      if (kinds.kind === 'shirt') { placket(mb, S, kinds.color, q); cuffFastener(metalSides[side], S, o.female, kinds.color); }
      if (kinds.kind === 'suit') patch(patchSides[side], S, o.female, accent);
    }
  }
  const sleeveFrom = kinds.kind === 'work' ? kinds.end + 30 : kinds.end + 22;
  for (const c of clothSides) cloth.append(c);
  for (const p of patchSides) patchMB.append(p);
  // ---- the watch, ring and bangle
  const metalL = new MB(1, o), dialL = new MB(1, o), glassL = new MB(1, o);
  if (look.watch) watch(metalL, dialL, glassL, A, look.watch, o.female, o.watchTime, q);
  const metalR = new MB(0, o), glassR = new MB(0, o);
  if (look.ring) { const mL = new MB(1, o), gL = new MB(1, o); ring(mL, gL, A, o.female, q); metalL.append(mL); glassL.append(gL); }
  if (look.bracelet) bangle(metalR, A, q);
  metal.append(metalL); metal.append(metalR); for (const m of metalSides) metal.append(m);
  dial.append(dialL); glass.append(glassL); glass.append(glassR);

  const g = (mb: MB) => (mb.idx.length ? mb.geometry() : null);
  const res: AccGeo = { cloth: g(cloth), patch: g(patchMB), metal: g(metal), dial: g(dial), glass: g(glass), sleeveFrom, outfit, sleeveColor: kinds.color };
  accCache.set(key, res);
  return res;
}

export function buildAccessories(o: AccOptions): Accessories {
  const look = o.look, q = o.quality, accent = accentOf(look);
  const G = accGeometry(o);
  const meshes: THREE.SkinnedMesh[] = [];
  const mk = (geo: THREE.BufferGeometry | null, mat: THREE.Material, name: string) => {
    if (!geo) { mat.dispose(); return; }
    const m = new THREE.SkinnedMesh(geo.clone(), mat); m.name = name; meshes.push(m);
  };
  mk(G.cloth, clothMaterial(G.sleeveColor, G.outfit, q), 'sleeves');
  mk(G.patch, new THREE.MeshPhysicalMaterial({ map: patchTexture(G.sleeveColor, accent), vertexColors: true, roughness: 0.78, metalness: 0, sheen: 0.15, sheenColor: new THREE.Color(accent), sheenRoughness: 0.6, envMapIntensity: 0.6 }), 'patch');
  mk(G.metal, accMaterial(), 'metal');
  if (look.watch) {
    const dt = dialTexture(look.watch, o.watchTime, accent);
    const dm = look.watch === 'smart'
      ? new THREE.MeshStandardMaterial({ map: dt, emissiveMap: dt, emissive: 0xffffff, emissiveIntensity: 0.9, color: 0x050505, roughness: 0.6, envMapIntensity: 0, side: THREE.DoubleSide })   // (no reflection of its own: the sky in it washed the black screen out to a pale grey; the glass over it reflects)
      : new THREE.MeshPhysicalMaterial({ map: dt, roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide });   // lacquered, not metal: a metal dial took the warm sky's colour and read as skin;
    // (double sided: the dial disc's winding faced into the case, so it was culled and the wrist showed through)
    mk(G.dial, dm, 'dial');
  }
  // the smart watch's flat glass over a black screen: a fainter reflection, or the sky washed the lit face out grey
  const smart = look.watch === 'smart';
  mk(G.glass, new THREE.MeshPhysicalMaterial({ color: 0xf4f8ff, roughness: 0.02, metalness: 0, transparent: true, opacity: smart ? 0.06 : 0.16, envMapIntensity: smart ? 0.7 : 2.4, clearcoat: smart ? 0.4 : 1, clearcoatRoughness: 0.02, depthWrite: false, ior: smart ? 1.5 : 1.77 }), 'crystal');
  return { meshes, sleeveFrom: G.sleeveFrom };
}
