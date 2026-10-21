// The garage cars' wheels, one generator in seven styles:
//   twin5 (Rossini GT)    20-inch forged twin-five-spoke rims, machined faces, gunmetal sides, a deep concave
//   five  (Rossini Brio)  19-inch five-spoke, painted silver with a machined lip
//   cl10  (Rossini Corsa) ten straight spokes in satin black, a centre-lock hub with a red hex nut
//   aero  (Vela E)        a dished aero cover with five curved turbine slots over a gunmetal rim
//   multi (OC Hypercar)   five spokes in gloss black, each splitting in two toward the rim (ten prongs at the rim,
//                         the reference sheet's WHEEL DETAIL), a deep concave, a gloss-black lip (no polished ring), the
//                         OC mark on a bigger centre cap; built with a lower sidewall (a 22-inch look)
//   mesh  (garage option) twenty slim spokes laced in crossing pairs (each pair crosses halfway out), machined faces
//   blade (garage option) seven blades swept toward the rim like a turbine's (mirrored on the left, as directional
//                         wheels are)
// The garage's Wheels tab (cars.ts WHEELS) offers each car its own style and one second style.
// Spoke faces are crowned (a highlight runs along each spoke); the five-bolt styles sit on a boss a third of the
// rim's radius with chamfered hex nuts in dark recesses, and every open style has a valve stem at the barrel.
// Tyres are modelled in section (rim protector, sidewall bulge, rounded shoulders, three circumferential grooves; no
// lettering); finely drilled carbon-ceramic discs on anodised bells; six-piston monobloc calipers in the car's colour
// with the wordmark on an 8:1 strip.
// Built in the wheel's own frame (axle along x, +x outboard) at the GT's 0.345 m radius and filed into a Kit; the
// caller's matrix scales the radius for smaller wheels.
import * as THREE from 'three';
import { Kit, V3, v3, gridGeo, latheGeo, between } from './car-kit';

export const WHEEL = { R: 0.345, rim: 0.254, wF: 0.245, wR: 0.305 };
export const TREAD_V: [number, number] = [0.3, 0.7];

// mirror a geometry across x (positions, normals, and the winding so faces still point out)
function mirrorX(g: THREE.BufferGeometry) {
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  return g;
}
// a revolved profile with explicit v per point (so textures land on the same part of every tyre)
function lathe(profile: [number, number][], vs: number[], segs: number, flip: boolean, a0 = 0, a1 = Math.PI * 2) {
  const g = latheGeo(profile, segs, 'x', { flip, a0, a1 });
  const uv = g.attributes.uv as THREE.BufferAttribute, nj = segs + 1;
  for (let i = 0; i < profile.length; i++) for (let j = 0; j < nj; j++) uv.setXY(i * nj + j, (j / segs) * ((a1 - a0) / (Math.PI * 2)), vs[i]);
  return g;
}
const pathLen = (pts: [number, number][]) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };

function tyre(w: number, segs: number) {
  const hw = w / 2, R = WHEEL.R;
  const side: [number, number][] = [
    [0.256, hw - 0.012], [0.266, hw + 0.001], [0.276, hw + 0.009], [0.283, hw + 0.012], [0.289, hw + 0.008], [0.298, hw + 0.01],
    [0.312, hw + 0.011], [0.325, hw + 0.007], [0.334, hw - 0.001], [0.34, hw - 0.012], [0.3438, hw - 0.025], [R, hw - 0.038],
  ];
  const tread: [number, number][] = [];
  for (const gx of [0.5, 0.12, -0.3].map((k) => k * hw)) tread.push([R, gx + 0.0055], [R - 0.0068, gx + 0.0042], [R - 0.0068, gx - 0.0042], [R, gx - 0.0055]);
  const inner = side.map(([r, x]) => [r, -x] as [number, number]).reverse();
  const prof = [...side, ...tread, ...inner];
  // v: outer sidewall 0..0.3, tread 0.3..0.7, inner sidewall 0.7..1 (each by arc length)
  const cs = pathLen(side), vs: number[] = [];
  side.forEach((_, i) => vs.push(0.3 * cs[i] / cs[cs.length - 1]));
  const t0 = side[side.length - 1][1], t1 = -t0;
  tread.forEach(([, x]) => vs.push(0.3 + 0.4 * (t0 - x) / (t0 - t1)));
  inner.forEach((_, i) => vs.push(0.7 + 0.3 * (cs[cs.length - 1] - cs[side.length - 1 - i]) / cs[cs.length - 1]));
  return lathe(prof, vs, segs, true);
}

export type WheelStyle = 'twin5' | 'five' | 'cl10' | 'aero' | 'multi' | 'mesh' | 'blade';
// sidewall: the tyre's sidewall height as a share of the standard one; below 1 the rim, spokes, hub and brake grow
// to meet it (a low-profile tyre on a bigger rim, the same outside diameter)
export interface WheelOptions { q: 'phone' | 'high'; front: boolean; style?: WheelStyle; w?: number; sidewall?: number }
// add one wheel (built for the right side) to a kit; m places it, out = -1 mirrors it for the left
export function addWheel(kit: Kit, o: WheelOptions, m: THREE.Matrix4, out: 1 | -1, spin?: Kit) {
  const high = o.q === 'high', segs = high ? 120 : 56, style = o.style ?? 'twin5';
  const w = o.w ?? (o.front ? WHEEL.wF : WHEEL.wR), hw = w / 2;
  const S = spin ?? kit;                 // spinning parts can go to their own kit
  const sw = o.sidewall ?? 1, R0 = WHEEL.R, bead = 0.256, sRim = (R0 - (R0 - bead) * sw) / bead;
  const put = (k: Kit, key: string, g: THREE.BufferGeometry) => {
    if (sw !== 1) {
      // a lower sidewall: the tyre's radii pulled toward the tread, everything inside it scaled up to the new bead
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z);
        const f = key === 'tyre' ? (r > 1e-6 && r < R0 ? (R0 - (R0 - r) * sw) / r : 1) : sRim;
        p.setY(i, y * f); p.setZ(i, z * f);
      }
      p.needsUpdate = true;
    }
    if (out < 0) {
      mirrorX(g);
      // decals read the right way round on the left side too
      if (key === 'calText' || key === 'badge') { const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    }
    k.add(key, g, m);
  };

  put(S, 'tyre', tyre(w, segs));
  // rim lip (machined) and barrel (painted)
  const lip: [number, number][] = [[0.257, hw - 0.01], [0.268, hw - 0.002], [0.2705, hw + 0.006], [0.2665, hw + 0.0118], [0.256, hw + 0.0132], [0.245, hw + 0.0105], [0.2385, hw + 0.003]];
  put(S, style === 'multi' ? 'rimPaint' : 'machined', lathe(lip, lip.map((p) => p[0] * 6), segs, false));
  const barrel: [number, number][] = [[0.2385, hw + 0.003], [0.236, hw - 0.016], [0.236, -hw + 0.01], [0.246, -hw - 0.004], [0.256, -hw - 0.006]];
  put(S, 'rimPaint', lathe(barrel, barrel.map((p) => p[1] * 4), high ? 72 : 40, false));

  // spokes: (centre angle, splay sign) for each spoke, and how each style shapes them. The five-bolt styles' spokes
  // grow from a boss of r 0.082 (34 % of the rim, as forged five-bolt wheels are); the Corsa's centre-lock boss is bigger
  const xh = hw - 0.062, xr = hw + 0.009, hb = style === 'cl10' ? 0.098 : 0.082, rh = style === 'cl10' ? 0.088 : 0.074, rr = 0.239, nR = high ? 14 : 8;
  const spokes: [number, number][] = [];
  if (style === 'twin5') for (let pr = 0; pr < 5; pr++) for (const s of [-1, 1]) spokes.push([(pr / 5) * Math.PI * 2 + Math.PI / 2, s]);
  if (style === 'five') for (let k = 0; k < 5; k++) spokes.push([(k / 5) * Math.PI * 2 + Math.PI / 2, 0]);
  if (style === 'cl10') for (let k = 0; k < 10; k++) spokes.push([(k / 10) * Math.PI * 2 + Math.PI / 2, 0]);
  // multi: each of five spokes is built as two halves side by side that part toward the rim (a split spoke)
  if (style === 'multi') for (let k = 0; k < 5; k++) for (const s of [-1, 1]) spokes.push([(k / 5) * Math.PI * 2 + Math.PI / 2, s]);
  // mesh: ten pairs, each spoke running from one side of its pair's line at the hub to the other side at the rim
  if (style === 'mesh') for (let k = 0; k < 10; k++) for (const s of [-1, 1]) spokes.push([(k / 10) * Math.PI * 2 + Math.PI / 2, s]);
  if (style === 'blade') for (let k = 0; k < 7; k++) spokes.push([(k / 7) * Math.PI * 2 + Math.PI / 2, 0]);
  const faceKey = style === 'twin5' || style === 'mesh' ? 'machined' : 'rimPaint';
  for (const [pc, s] of spokes) {
    const faceRows: V3[][] = [], sideL: V3[][] = [], sideR: V3[][] = [];
    for (let i = 0; i <= nR; i++) {
      const f = i / nR, r = rh + (rr - rh) * f;
      // multi: the halves part at 36 % of the spoke's length and run straight to the rim (the sheet's WHEEL DETAIL
      // forks are straight Ys): the gap grows linearly with the radius, 0.17 rad either side at the rim
      const split = style === 'multi' ? Math.min(1, Math.max(0, (f - 0.36) / 0.64)) : 0;
      const th = style === 'multi' ? pc + s * Math.atan2(rr * Math.sin(0.17) * split, r)
        : style === 'mesh' ? pc + s * 0.15 * (1 - 2 * f)          // the pair crosses at half the spoke's length
        : style === 'blade' ? pc + 0.6 * Math.pow(f, 1.4)        // swept back toward the rim
        : pc + s * (0.055 + 0.085 * Math.pow(f, 1.3));
      // widths: forged faces of 28-44 mm at the hub tapering to the rim (twin5, cl10, blade; the old 22-36 mm read
      // as wire); five: broad spokes that taper and thin toward the rim; multi: a half of a slim spoke, offset to
      // its side until the halves part (the sheet's slim prongs); mesh: slim laces
      const wdt = style === 'five' ? 0.058 - 0.026 * f : style === 'cl10' ? 0.028 - 0.008 * f : style === 'multi' ? 0.029 - 0.012 * f
        : style === 'mesh' ? 0.015 - 0.004 * f : style === 'blade' ? 0.044 - 0.018 * f : 0.036 - 0.012 * f;
      const dep = style === 'five' ? 0.032 - 0.01 * f : style === 'multi' ? 0.03 - 0.012 * f : style === 'mesh' ? 0.024 - 0.008 * f : 0.036 - 0.012 * f;
      // mesh: the two spokes of a pair sit 3 mm apart in depth where they cross, so neither face fights the other
      const xf = xh + (xr - xh) * Math.pow(f, style === 'cl10' ? 0.85 : style === 'five' ? 0.7 : style === 'multi' ? 0.5 : style === 'blade' ? 0.55 : 0.62) + (style === 'mesh' ? s * 0.0015 : 0);
      const off = style === 'multi' ? s * wdt * 0.5 * (1 - split) : 0;
      const Rd = v3(0, Math.cos(th), Math.sin(th)), T = v3(0, -Math.sin(th), Math.cos(th));
      const at = (x: number, t: number) => Rd.clone().multiplyScalar(r).add(T.clone().multiplyScalar(t + off)).setX(x);
      // the face's edges, across the spoke. A twin5 pair's two spokes overlap out to about 40 % of their length,
      // so there each face stops at the pair's centre line: one Y-shaped face with a seam down its stem, instead
      // of two crowns cutting through each other
      let tl = -wdt * 0.36, tr = wdt * 0.36;
      if (style === 'twin5') { const tc = r * Math.sin(pc - th); if (s > 0) tl = Math.max(tl, tc); else tr = Math.min(tr, tc); }
      // the face is crowned: its middle sits up to 3 mm proud of its edges, so the smooth normals turn through
      // about 20 deg across it and a highlight runs along the spoke, where a flat face went all black or all white
      const cw = tr - tl, crown = Math.min(0.003, 0.11 * cw);
      const fl = at(xf, tl), fm1 = at(xf + crown, tl + 0.3 * cw), fm2 = at(xf + crown, tl + 0.7 * cw), fr = at(xf, tr);
      const cl = at(xf - 0.005, tl - 0.14 * wdt), cr = at(xf - 0.005, tr + 0.14 * wdt);
      const bl = at(xf - dep, tl - 0.06 * wdt), br = at(xf - dep, tr + 0.06 * wdt);
      faceRows.push([fl, fm1, fm2, fr]); sideL.push([bl, cl, fl]); sideR.push([fr, cr, br]);
    }
    const face = gridGeo(faceRows, { flip: false });
    const fuv = face.attributes.uv as THREE.BufferAttribute, fp = face.attributes.position;
    for (let k = 0; k < fuv.count; k++) { const y = fp.getY(k), z = fp.getZ(k); fuv.setXY(k, Math.atan2(z, y) / (Math.PI * 2), Math.hypot(y, z) * 6); }
    put(S, faceKey, face);
    put(S, 'rimPaint', gridGeo(sideL, { flip: false }));
    put(S, 'rimPaint', gridGeo(sideR, { flip: false }));
    const backRows: V3[][] = [];
    for (let i = 0; i <= nR; i++) backRows.push([sideR[i][2], sideL[i][0]]);
    put(S, 'rimPaint', gridGeo(backRows, { flip: false }));
  }
  if (style === 'aero') {
    // a dished cover from the hub to the rim with five curved turbine slots; behind it, the spokes' shadows.
    // The dish: x = h(r), proud at the rim and 28 mm in at the hub. Slot k runs from t = 0 (r 0.115) to t = 1
    // (r 0.22), its near edge at near(k, t) and its far edge a width wd(t) further round.
    const RC = 0.238, dish = (r: number) => xr - 0.004 - 0.028 * Math.pow(Math.max(0, 1 - r / RC), 1.6);
    const slotR = (t: number) => 0.115 + 0.105 * t, slotW = (t: number) => 0.012 + 0.018 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    const near = (k: number, t: number) => (k / 5) * Math.PI * 2 + 0.3 + 0.55 * t * t;
    const far = (k: number, t: number) => near(k, t) + slotW(t) / slotR(t);
    const at = (r: number, a: number) => v3(dish(r), Math.cos(a) * r, Math.sin(a) * r);
    // The cover is polar grids on the dish, not a triangulated cap: a cap with point holes came out as fans of
    // slivers (aspect up to 500, edges of 430 mm on a 476 mm cover) and the per-vertex normal tilt and the baked
    // 'ao' interpolated along them, so the clearcoat shaded the dish in vertical bands. Here every cell is about
    // 10 x 18 mm: five gap grids between the slots, with rows at the slot walls' own t = j/10 and columns from
    // slot k's far edge to slot k+1's near edge, and two annuli (hub ring to the slots' start, slots' end to the
    // rim) whose columns are the gap grids' columns, so every edge meets a gap grid or a slot's end wall exactly.
    const nT = 10, nC = high ? 10 : 5;
    const gapCols = (k: number, t: number) => { const a0 = far(k, t), a1 = near(k + 1, t); return Array.from({ length: nC + 1 }, (_, c) => a0 + (a1 - a0) * (c / nC)); };
    const ringCols = (t: number) => { const as: number[] = []; for (let k = 0; k < 5; k++) as.push(...gapCols(k, t)); return as; };
    const pieces: [V3[][], boolean][] = [];
    for (let k = 0; k < 5; k++) {
      const rows: V3[][] = [];
      for (let j = 0; j <= nT; j++) { const t = j / nT, r = slotR(t); rows.push(gapCols(k, t).map((a) => at(r, a))); }
      pieces.push([rows, false]);
    }
    const annulus = (r0: number, r1: number, n: number, t: number) => { const as = ringCols(t), rows: V3[][] = []; for (let i = 0; i <= n; i++) { const r = r0 + (r1 - r0) * (i / n); rows.push(as.map((a) => at(r, a))); } return rows; };
    pieces.push([annulus(0.05, slotR(0), high ? 4 : 3, 0), true]);
    pieces.push([annulus(slotR(1), RC, 1, 1), true]);
    for (const [rows, closeU] of pieces) {
      const g = gridGeo(rows, { closeU, flip: false });
      // the dish's normals from its formula (x = h(r)); UVs round the wheel and out along it
      const gp = g.attributes.position, gn = g.attributes.normal as THREE.BufferAttribute, gu = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < gp.count; k++) {
        const y = gp.getY(k), z = gp.getZ(k), r = Math.hypot(y, z), dh = 0.028 * 1.6 * Math.pow(Math.max(0, 1 - r / RC), 0.6) / RC;
        const n = v3(1, r > 1e-6 ? -dh * y / r : 0, r > 1e-6 ? -dh * z / r : 0).normalize();
        gn.setXYZ(k, n.x, n.y, n.z);
        gu.setXY(k, Math.atan2(z, y) / (Math.PI * 2), r * 6);
      }
      put(S, 'aero', g);
    }
    // the slot walls, down to a dark backing plate: the same points as the gap grids' edge columns
    for (let k = 0; k < 5; k++) {
      const slot: V3[] = [], inner: V3[] = [];
      for (let j = 0; j <= nT; j++) { const t = j / nT, r = slotR(t); slot.push(at(r, near(k, t))); inner.push(at(r, far(k, t))); }
      const top = [...slot, ...inner.reverse()], bot = top.map((p) => p.clone().setX(p.x - 0.03));
      put(S, 'dark', gridGeo([top, bot], { closeU: true, flip: true }));
      put(S, 'dark', gridGeo([top, bot], { closeU: true, flip: false }));
    }
    const back = new THREE.CircleGeometry(0.236, 48); back.rotateY(Math.PI / 2); back.translate(xh - 0.03, 0, 0); put(S, 'rimPaint', back);
    // a silver ring at the cover's edge
    put(S, 'machined', lathe([[0.2385, xr - 0.003], [0.234, xr - 0.0035], [0.226, xr - 0.0045]], [0, 0.3, 0.6], segs, true));
  }
  // hub: machined face with a centre-cap ring, five bolts in recesses, the badge; the Corsa's is a centre lock
  if (style === 'cl10') {
    const hub: [number, number][] = [[0.0, xh + 0.004], [0.06, xh + 0.004], [0.084, xh - 0.002], [0.098, xh - 0.034]];
    put(S, 'rimPaint', lathe(hub, hub.map((p) => p[0] * 6), high ? 48 : 24, true));
    const nut = new THREE.CylinderGeometry(0.044, 0.046, 0.028, 6); nut.rotateZ(-Math.PI / 2); nut.translate(xh + 0.016, 0, 0);
    put(S, 'nut', nut.toNonIndexed());
    const cone = latheGeo([[0.0, xh + 0.046], [0.018, xh + 0.044], [0.03, xh + 0.03]], 24, 'x', { flip: true }); put(S, 'chrome', cone);
    const peg = new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8); peg.rotateZ(-Math.PI / 2); peg.translate(xh + 0.006, 0.07, 0); put(S, 'chrome', peg);
  } else if (style !== 'aero') {
    // the boss: a centre-cap ring, a flat bolt face (the bolt circle at r 0.056, its recesses out to 0.0715) and a
    // bevel down to the bell at r 0.082; the mesh style's is machined like its laces
    const hub: [number, number][] = [[0.0, xh + 0.0075], [0.031, xh + 0.0075], [0.0345, xh + 0.0095], [0.038, xh + 0.006], [0.062, xh + 0.004], [0.074, xh + 0.001], [0.0805, xh - 0.008], [hb, xh - 0.034]];
    put(S, style === 'twin5' || style === 'mesh' ? 'machined' : 'rimPaint', lathe(hub, hub.map((p) => p[0] * 6), high ? 64 : 32, true));
    for (let k = 0; k < (style === 'multi' ? 0 : 5); k++) {   // multi: the big centre cap covers the bolts
      const a = (k / 5) * Math.PI * 2 + Math.PI / 2 + Math.PI / 5, y = Math.cos(a) * 0.056, z = Math.sin(a) * 0.056;
      const rec = new THREE.CircleGeometry(0.0155, 16); rec.rotateY(Math.PI / 2); rec.translate(xh + 0.0065, y, z);
      put(S, 'dark', rec);
      // a 19 mm hex nut, 12 mm tall, under a chamfer cap that takes its corners down to a 12 mm flat; faceted
      const hex = (rt: number, rb: number, h: number, x: number, open: boolean) => { const g = new THREE.CylinderGeometry(rt, rb, h, 6, 1, open).toNonIndexed(); g.computeVertexNormals(); g.rotateZ(-Math.PI / 2); g.translate(x, y, z); return g; };
      put(S, 'chrome', hex(0.0095, 0.0095, 0.012, xh + 0.012, true));
      put(S, 'chrome', hex(0.006, 0.0095, 0.003, xh + 0.0195, false));
    }
  }
  if (style !== 'cl10') {
    // the badge reads upright: CircleGeometry's u runs to -z (forward), which is right as seen from outboard
    const cap = new THREE.CircleGeometry(style === 'multi' ? 0.042 : 0.0295, 32); cap.rotateY(Math.PI / 2); cap.translate(style === 'aero' ? xr - 0.031 : style === 'multi' ? xh + 0.0105 : xh + 0.0078, 0, 0);
    put(S, 'badge', cap);
    if (style === 'aero') { const cr = latheGeo([[0.05, xr - 0.032], [0.05, xr - 0.06]], 32, 'x', { flip: false }); put(S, 'dark', cr); }
  }
  // the valve: a rubber stem out of the barrel between two spokes, leaning 25 deg outboard, under a chrome cap (the
  // aero cover hides the barrel, so that style has none). The stem is 'dark' (the recesses' near-black), not 'rubber':
  // in the game every key is a mesh per wheel, and a key of its own would cost four draw calls a car
  if (style !== 'aero') {
    const av = Math.PI / 2 + (style === 'cl10' || style === 'mesh' ? Math.PI / 10 : style === 'blade' ? 0.6 + Math.PI / 7 : Math.PI / 5);
    const Rv = v3(0, Math.cos(av), Math.sin(av)), dir = Rv.clone().multiplyScalar(-Math.cos(0.436)).setX(Math.sin(0.436));
    const base = Rv.clone().multiplyScalar(0.238).setX(hw - 0.02), tip = base.clone().addScaledVector(dir, 0.028);
    put(S, 'dark', new THREE.CylinderGeometry(0.004, 0.004, 1, 8, 1, true).applyMatrix4(between(base, tip)));
    // the cap: chrome where the wheel has chrome nuts already; black on the hypercar's black-on-black multi (no
    // chrome there, so a chrome cap would be a mesh of its own on each wheel)
    put(S, style === 'multi' ? 'dark' : 'chrome', new THREE.CylinderGeometry(0.0045, 0.0045, 1, 8).applyMatrix4(between(base.clone().addScaledVector(dir, 0.02), tip)));
  }

  // brake: drilled carbon-ceramic friction ring on an anodised bell
  const Rd = o.front ? 0.2 : 0.19, td = o.front ? 0.036 : 0.032, xd = xh - 0.052, xo = xd + td / 2, xi = xd - td / 2, ri = 0.128;
  const ringRows: V3[][] = [];
  const dsegs = high ? 96 : 48;
  for (let i = 0; i <= 3; i++) { const r = ri + (Rd - ri) * (i / 3), row: V3[] = []; for (let j = 0; j <= dsegs; j++) { const a = (j / dsegs) * Math.PI * 2; row.push(v3(xo, Math.cos(a) * r, Math.sin(a) * r)); } ringRows.push(row); }
  const ring = gridGeo(ringRows, { flip: false });
  const ruv = ring.attributes.uv as THREE.BufferAttribute;
  // u round the ring repeats the map four times, so its holes (drawn round in texels, 24 a repeat) come out 7 x 8 mm,
  // 96 a row at a 10.7 mm pitch: a finely drilled ring, not the 28 x 8 mm ovals one repeat stretched them to. An
  // integer repeat, so the pattern meets itself at the seam
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= dsegs; j++) ruv.setXY(i * (dsegs + 1) + j, 4 * j / dsegs, i / 3);
  put(S, 'disc', ring);
  // the edge stays 'dark': a heat-tinted edge (the exhaust tips' iridescent steel) was tried and showed from no
  // wheel view (edge-on from the side, behind the lip at 3/4), and in the game a key of its own is a mesh per wheel
  put(S, 'dark', lathe([[Rd, xi], [Rd, xo]], [0, 1], dsegs, false));
  const bell: [number, number][] = [[ri + 0.004, xo + 0.0005], [ri - 0.004, xo + 0.016], [hb + 0.002, xo + 0.026], [hb, xh - 0.034]];
  put(S, 'rimPaint', lathe(bell, bell.map((p) => p[0] * 6), high ? 48 : 24, false));

  // caliper (does not spin): a U round the disc edge, rear-top of the disc
  const thc = o.front ? 1.2 : 1.35, span = 0.44;
  const U: [number, number][] = [
    [0.128, xo + 0.004], [0.128, xo + 0.026], [0.136, xo + 0.034], [0.205, xo + 0.034], [0.224, xo + 0.022], [0.231, xo + 0.004],
    [0.231, xi - 0.004], [0.224, xi - 0.022], [0.205, xi - 0.034], [0.136, xi - 0.034], [0.128, xi - 0.026], [0.128, xi - 0.004],
    [0.212, xi - 0.004], [0.212, xo + 0.004], [0.128, xo + 0.004],
  ];
  put(kit, 'caliper', lathe(U, U.map((_, i) => i / (U.length - 1)), high ? 20 : 10, true, thc - span, thc + span));
  const tri = THREE.ShapeUtils.triangulateShape(U.slice(0, -1).map(([r, x]) => new THREE.Vector2(r, x)), []);
  for (const a of [thc - span, thc + span]) {
    const pos: number[] = [];
    for (const t of tri) for (const k of (a > thc ? t : [t[0], t[2], t[1]])) { const [r, x] = U[k]; pos.push(x, Math.cos(a) * r, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    put(kit, 'caliper', g);
  }
  // the wordmark along the caliper's outer face: a 16 mm strip over 0.75 rad (128 mm at r 0.17), 8:1 like its map,
  // so ROSSINI and the OC mark read unsquashed (the old 36 mm x 109 mm strip stood them up 2.7 times too tall)
  const tRows: V3[][] = [];
  for (let i = 0; i <= 1; i++) { const r = 0.162 + 0.016 * i, row: V3[] = []; for (let j = 0; j <= 12; j++) { const a = thc + 0.375 - 0.75 * (j / 12); row.push(v3(xo + 0.0352, Math.cos(a) * r, Math.sin(a) * r)); } tRows.push(row); }
  const tg = gridGeo(tRows, { flip: true });
  const tuv = tg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 12; j++) tuv.setXY(i * 13 + j, j / 12, i);
  put(kit, 'calText', tg);
}
