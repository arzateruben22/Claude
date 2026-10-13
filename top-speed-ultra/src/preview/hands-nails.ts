// Nail plates for the driver's hands, laid on the fingertips' actual skin (sampled from the hand's distance field):
// tucked under the cuticle at the base and into the side folds, standing a fraction of a millimetre proud of the
// skin, curved across, and running on past the fingertip as the free edge (short on the male hands, longer and
// rounded on the female ones). Each plate is a thin closed shell so the free edge has a visible thickness.
// Built in the grip frame G (mm), like the hand.
import { Anatomy, Digit, V3, add, cross, dot, madd, mul, norm, sub } from './hands-sdf';

export interface NailGeometry {
  pos: number[]; nrm: number[]; idx: number[];
  nail: number[];          // vec4 per vertex: mm from the cuticle, across (-1..1), where the free edge starts, length
}

// the distance along the ray from p in direction d to the skin (the field's zero), or -1
function hit(A: Anatomy, p: V3, d: V3, t0: number, t1: number) {
  const f = A.field;
  const at = (t: number) => { const q = madd(p, d, t); return f.eval(q[0], q[1], q[2], null, 0); };
  let a = t0, fa = at(a), b = t1, fb = at(b);
  if (fa > 0 || fb < 0) return -1;
  for (let i = 0; i < 22; i++) { const m = (a + b) / 2, fm = at(m); if (fm < 0) { a = m; fa = fm; } else { b = m; fb = fm; } }
  return (a + b) / 2;
}

export function buildNails(A: Anatomy, female: boolean, quality: 'phone' | 'high'): NailGeometry {
  const out: NailGeometry = { pos: [], nrm: [], idx: [], nail: [] };
  const nr = quality === 'high' ? 14 : 9, nc = quality === 'high' ? 9 : 6;
  for (const g of A.digits) addNail(A, g, female, nr, nc, out);
  return out;
}

function addNail(A: Anatomy, g: Digit, female: boolean, nr: number, nc: number, out: NailGeometry) {
  const J2 = g.joints[2], J3 = g.joints[3], d = g.dirs[2], u = norm(sub(g.dorsal[2], mul(d, dot(g.dorsal[2], d))));
  const l = cross(d, u);
  const L3 = Math.hypot(...sub(J3, J2));
  const thumb = g.name === 'thumb';
  const Ln = g.nail.len, Wn = g.nail.width, Fe = g.nail.free * (thumb ? 0.85 : 1);
  const sh = L3 - (thumb ? 2.8 : 2.4);              // where the nail leaves the fingertip (the hyponychium)
  const s0 = sh - Ln;                                 // the cuticle
  const total = Ln + Fe;
  // top surface rows: attached part sampled on the skin, the free edge carried on past the fingertip
  const rows: { p: V3; n: V3; s: number; w: number }[][] = [];
  const centre: V3[] = [];
  for (let i = 0; i <= nr; i++) {
    const t = i / nr, s = s0 + t * total;
    const row: { p: V3; n: V3; s: number; w: number }[] = [];
    // outline: a rounded base, straight sides, and a rounded (female: oval) free edge
    const base = 0.78 + 0.22 * Math.min(1, Math.sqrt(Math.max(0, (s - s0) / 2.6)));
    let hw = (Wn / 2) * base;
    if (s > sh) {
      const e = (s - sh) / (Fe + (female ? 0.4 : 0.9));
      hw *= female ? Math.sqrt(Math.max(0.02, 1 - e * e * e)) * (1 - 0.18 * e) : Math.pow(Math.max(0.02, 1 - Math.pow(e, 4)), 0.5);
    }
    if (i === nr) hw *= female ? 0.35 : 0.6;
    for (let j = 0; j <= nc; j++) {
      const w = (j / nc) * 2 - 1, x = w * hw;
      const sa = Math.min(s, sh);
      const ax = madd(J2, d, sa);
      // the plate is flatter across than the finger: aim the ray to the plate's own arch
      const dir = norm(add(mul(u, 7.5), mul(l, x)));
      let r = hit(A, ax, dir, 0, 16);
      if (r < 0) r = 6;
      // standing proud of the skin, tucked at the cuticle and into the side folds
      const lift = (0.38 * Math.min(1, Math.max(0, (s - s0 - 0.15) / 1.3)) - 0.16 * (1 - Math.min(1, (s - s0) / 1.3))) * (1 - 0.8 * Math.pow(Math.abs(w), 3));
      let p = madd(ax, dir, r + lift);
      if (s > sh) {
        // past the fingertip: continue along the plate's line, drooping a little
        const e = s - sh;
        p = madd(madd(p, d, e), u, -0.022 * e * e - (female ? 0.03 : 0.05) * e);
      }
      row.push({ p, n: dir, s: s - s0, w });
    }
    rows.push(row);
    centre.push(row[nc >> 1].p);
  }
  // normals of the top surface from the grid
  const base = out.pos.length / 3;
  const T = 0.42;                                         // plate thickness (mm)
  const top: V3[][] = rows.map((row, i) => row.map((v, j) => {
    const a = rows[Math.min(nr, i + 1)][j].p, b = rows[Math.max(0, i - 1)][j].p, c = row[Math.min(nc, j + 1)].p, e = row[Math.max(0, j - 1)].p;
    let n = norm(cross(sub(c, e), sub(a, b)));
    if (dot(n, v.n) < 0) n = mul(n, -1);
    return n;
  }));
  const push = (p: V3, n: V3, s: number, w: number) => { out.pos.push(...p); out.nrm.push(...n); out.nail.push(s, w, Ln, total); return out.pos.length / 3 - 1; };
  const vt: number[][] = [], vb: number[][] = [];
  rows.forEach((row, i) => { vt.push(row.map((v, j) => push(v.p, top[i][j], v.s, v.w))); });
  rows.forEach((row, i) => { vb.push(row.map((v, j) => push(madd(v.p, top[i][j], -T), mul(top[i][j], -1), v.s, v.w))); });
  const quad = (a: number, b: number, c: number, e: number) => out.idx.push(a, b, c, a, c, e);
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    quad(vt[i][j], vt[i + 1][j], vt[i + 1][j + 1], vt[i][j + 1]);
    quad(vb[i][j], vb[i][j + 1], vb[i + 1][j + 1], vb[i + 1][j]);
  }
  // the rim of the shell: its own vertices so the edge shades crisply
  const ring: [number, number][] = [];
  for (let j = 0; j <= nc; j++) ring.push([0, j]);
  for (let i = 1; i <= nr; i++) ring.push([i, nc]);
  for (let j = nc - 1; j >= 0; j--) ring.push([nr, j]);
  for (let i = nr - 1; i >= 1; i--) ring.push([i, 0]);
  const cen = centre[nr >> 1];
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k], [i1, j1] = ring[(k + 1) % ring.length];
    const a = rows[i0][j0], b = rows[i1][j1];
    const ta = top[i0][j0], tb = top[i1][j1];
    const outward = norm(sub(lerpV(a.p, b.p), cen));
    const a0 = push(a.p, outward, a.s, a.w), b0 = push(b.p, outward, b.s, b.w);
    const a1 = push(madd(a.p, ta, -T), outward, a.s, a.w), b1 = push(madd(b.p, tb, -T), outward, b.s, b.w);
    quad(a0, a1, b1, b0);
  }
  // make every triangle face outward (the shell's winding depends on the finger's side)
  orient(out, base, cen);
}

function lerpV(a: V3, b: V3): V3 { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

// flip any triangle (of this nail's) whose winding disagrees with its vertices' normals
function orient(o: NailGeometry, firstVert: number, _c: V3) {
  for (let t = 0; t < o.idx.length; t += 3) {
    const a = o.idx[t], b = o.idx[t + 1], c = o.idx[t + 2];
    if (a < firstVert) continue;
    const pa: V3 = [o.pos[a * 3], o.pos[a * 3 + 1], o.pos[a * 3 + 2]], pb: V3 = [o.pos[b * 3], o.pos[b * 3 + 1], o.pos[b * 3 + 2]], pc: V3 = [o.pos[c * 3], o.pos[c * 3 + 1], o.pos[c * 3 + 2]];
    const fn = cross(sub(pb, pa), sub(pc, pa));
    const vn: V3 = [o.nrm[a * 3] + o.nrm[b * 3] + o.nrm[c * 3], o.nrm[a * 3 + 1] + o.nrm[b * 3 + 1] + o.nrm[c * 3 + 1], o.nrm[a * 3 + 2] + o.nrm[b * 3 + 2] + o.nrm[c * 3 + 2]];
    if (dot(fn, vn) < 0) { o.idx[t + 1] = c; o.idx[t + 2] = b; }
  }
}
