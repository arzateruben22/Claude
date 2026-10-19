// The garage cars' wheels, one generator in four styles:
//   twin5 (Rossini GT)    20-inch forged twin-five-spoke rims, machined faces, gunmetal sides, a deep concave
//   five  (Rossini Brio)  19-inch five-spoke, painted silver with a machined lip
//   cl10  (Rossini Corsa) ten straight spokes in satin black, a centre-lock hub with a red hex nut
//   aero  (Vela E)        a dished aero cover with five curved turbine slots over a gunmetal rim
//   multi (OC Hypercar)   five spokes in gloss black, each splitting in two toward the rim (ten prongs at the rim,
//                         the reference sheet's WHEEL DETAIL), a deep concave, a gloss-black lip (no polished ring), the
//                         OC mark on a bigger centre cap; built with a lower sidewall (a 22-inch look)
// Tyres are modelled in section (rim protector, sidewall bulge, rounded shoulders, three circumferential grooves; no
// lettering); drilled carbon-ceramic discs on anodised bells; six-piston monobloc calipers in the car's colour.
// Built in the wheel's own frame (axle along x, +x outboard) at the GT's 0.345 m radius and filed into a Kit; the
// caller's matrix scales the radius for smaller wheels.
import * as THREE from 'three';
import { Kit, V3, v3, gridGeo, latheGeo, capGeo } from './car-kit';

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

export type WheelStyle = 'twin5' | 'five' | 'cl10' | 'aero' | 'multi';
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

  // spokes: (centre angle, splay sign) for each spoke, and how each style shapes them
  const xh = hw - 0.062, xr = hw + 0.009, rh = 0.088, rr = 0.239, nR = high ? 14 : 8;
  const spokes: [number, number][] = [];
  if (style === 'twin5') for (let pr = 0; pr < 5; pr++) for (const s of [-1, 1]) spokes.push([(pr / 5) * Math.PI * 2 + Math.PI / 2, s]);
  if (style === 'five') for (let k = 0; k < 5; k++) spokes.push([(k / 5) * Math.PI * 2 + Math.PI / 2, 0]);
  if (style === 'cl10') for (let k = 0; k < 10; k++) spokes.push([(k / 10) * Math.PI * 2 + Math.PI / 2, 0]);
  // multi: each of five spokes is built as two halves side by side that part toward the rim (a split spoke)
  if (style === 'multi') for (let k = 0; k < 5; k++) for (const s of [-1, 1]) spokes.push([(k / 5) * Math.PI * 2 + Math.PI / 2, s]);
  const faceKey = style === 'twin5' ? 'machined' : 'rimPaint';
  for (const [pc, s] of spokes) {
    const faceRows: V3[][] = [], sideL: V3[][] = [], sideR: V3[][] = [];
    for (let i = 0; i <= nR; i++) {
      const f = i / nR, r = rh + (rr - rh) * f;
      // multi: the halves part at 36 % of the spoke's length and run straight to the rim (the sheet's WHEEL DETAIL
      // forks are straight Ys): the gap grows linearly with the radius, 0.17 rad either side at the rim
      const split = style === 'multi' ? Math.min(1, Math.max(0, (f - 0.36) / 0.64)) : 0;
      const th = style === 'multi' ? pc + s * Math.atan2(rr * Math.sin(0.17) * split, r) : pc + s * (0.055 + 0.085 * Math.pow(f, 1.3));
      // five: broad spokes that taper and thin toward the rim; cl10: slim straight ones, a shallow concave; multi:
      // a half of a slim spoke, offset to its side until the halves part
      const wdt = style === 'five' ? 0.058 - 0.026 * f : style === 'cl10' ? 0.022 - 0.006 * f : style === 'multi' ? 0.029 - 0.012 * f : 0.026 - 0.009 * f;
      const dep = style === 'five' ? 0.032 - 0.01 * f : style === 'multi' ? 0.03 - 0.012 * f : 0.036 - 0.012 * f;
      const xf = xh + (xr - xh) * Math.pow(f, style === 'cl10' ? 0.85 : style === 'five' ? 0.7 : style === 'multi' ? 0.5 : 0.62);
      const off = style === 'multi' ? s * wdt * 0.5 * (1 - split) : 0;
      const Rd = v3(0, Math.cos(th), Math.sin(th)), T = v3(0, -Math.sin(th), Math.cos(th));
      const at = (x: number, t: number) => Rd.clone().multiplyScalar(r).add(T.clone().multiplyScalar(t + off)).setX(x);
      const fl = at(xf, -wdt * 0.36), fr = at(xf, wdt * 0.36), cl = at(xf - 0.005, -wdt / 2), cr = at(xf - 0.005, wdt / 2);
      const bl = at(xf - dep, -wdt * 0.42), br = at(xf - dep, wdt * 0.42);
      faceRows.push([fl, fr]); sideL.push([bl, cl, fl]); sideR.push([fr, cr, br]);
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
    // a dished cover from the hub to the rim with five curved turbine slots; behind it, the spokes' shadows
    const outline: THREE.Vector2[] = [];
    for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2; outline.push(new THREE.Vector2(Math.cos(a) * 0.238, Math.sin(a) * 0.238)); }
    const holes: THREE.Vector2[][] = [];
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * Math.PI * 2 + 0.3, slot: THREE.Vector2[] = [], inner: THREE.Vector2[] = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10, r = 0.115 + 0.105 * t, a = a0 + 0.55 * t * t, wd = 0.012 + 0.018 * Math.sin(Math.PI * Math.min(1, t * 1.1));
        slot.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
        inner.push(new THREE.Vector2(Math.cos(a + wd / r * 1.0) * r, Math.sin(a + wd / r * 1.0) * r));
      }
      holes.push([...slot, ...inner.reverse()]);
    }
    const ring: THREE.Vector2[] = []; for (let k = 0; k < 40; k++) { const a = -(k / 40) * Math.PI * 2; ring.push(new THREE.Vector2(Math.cos(a) * 0.05, Math.sin(a) * 0.05)); }
    const disc = capGeo(outline, [...holes, ring], high ? 0.022 : 0.04);
    // dish it: the face sits proud at the rim and steps in toward the hub, then turn it to face +x
    const dp = disc.attributes.position;
    for (let k = 0; k < dp.count; k++) { const y = dp.getX(k), z = dp.getY(k), r = Math.hypot(y, z); dp.setXYZ(k, xr - 0.004 - 0.028 * Math.pow(Math.max(0, 1 - r / 0.238), 1.6), y, z); }
    disc.computeVertexNormals();
    const du = disc.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < du.count; k++) { const y = dp.getY(k), z = dp.getZ(k); du.setXY(k, Math.atan2(z, y) / (Math.PI * 2), Math.hypot(y, z) * 6); }
    // (the cap faced +z in its own plane; the cyclic swap of axes above keeps its winding, so it now faces +x)
    put(S, 'aero', disc);
    // the slot walls, down to a dark backing plate
    for (const h of holes) {
      const top = h.map((p) => { const r = Math.hypot(p.x, p.y); return v3(xr - 0.004 - 0.028 * Math.pow(Math.max(0, 1 - r / 0.238), 1.6), p.x, p.y); });
      const bot = top.map((p) => p.clone().setX(p.x - 0.03));
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
    const hub: [number, number][] = [[0.0, xh + 0.0075], [0.031, xh + 0.0075], [0.0345, xh + 0.0095], [0.038, xh + 0.006], [0.07, xh + 0.004], [0.088, xh + 0.001], [0.096, xh - 0.008], [0.098, xh - 0.034]];
    put(S, style === 'twin5' ? 'machined' : 'rimPaint', lathe(hub, hub.map((p) => p[0] * 6), high ? 64 : 32, true));
    for (let k = 0; k < (style === 'multi' ? 0 : 5); k++) {   // multi: the big centre cap covers the bolts
      const a = (k / 5) * Math.PI * 2 + Math.PI / 2 + Math.PI / 5, y = Math.cos(a) * 0.056, z = Math.sin(a) * 0.056;
      const rec = new THREE.CircleGeometry(0.0155, 16); rec.rotateY(Math.PI / 2); rec.translate(xh + 0.0055, y, z);
      put(S, 'dark', rec);
      const bolt = new THREE.CylinderGeometry(0.0105, 0.0105, 0.016, 6); bolt.rotateZ(-Math.PI / 2); bolt.translate(xh + 0.006, y, z);
      put(S, 'chrome', bolt.toNonIndexed());
    }
  }
  if (style !== 'cl10') {
    // the badge reads upright: CircleGeometry's u runs to -z (forward), which is right as seen from outboard
    const cap = new THREE.CircleGeometry(style === 'multi' ? 0.042 : 0.0295, 32); cap.rotateY(Math.PI / 2); cap.translate(style === 'aero' ? xr - 0.031 : style === 'multi' ? xh + 0.0105 : xh + 0.0078, 0, 0);
    put(S, 'badge', cap);
    if (style === 'aero') { const cr = latheGeo([[0.05, xr - 0.032], [0.05, xr - 0.06]], 32, 'x', { flip: false }); put(S, 'dark', cr); }
  }

  // brake: drilled carbon-ceramic friction ring on an anodised bell
  const Rd = o.front ? 0.2 : 0.19, td = o.front ? 0.036 : 0.032, xd = xh - 0.052, xo = xd + td / 2, xi = xd - td / 2, ri = 0.128;
  const ringRows: V3[][] = [];
  const dsegs = high ? 96 : 48;
  for (let i = 0; i <= 3; i++) { const r = ri + (Rd - ri) * (i / 3), row: V3[] = []; for (let j = 0; j <= dsegs; j++) { const a = (j / dsegs) * Math.PI * 2; row.push(v3(xo, Math.cos(a) * r, Math.sin(a) * r)); } ringRows.push(row); }
  const ring = gridGeo(ringRows, { flip: false });
  const ruv = ring.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= dsegs; j++) ruv.setXY(i * (dsegs + 1) + j, j / dsegs, i / 3);
  put(S, 'disc', ring);
  put(S, 'dark', lathe([[Rd, xi], [Rd, xo]], [0, 1], dsegs, false));
  const bell: [number, number][] = [[ri + 0.004, xo + 0.0005], [ri - 0.004, xo + 0.016], [0.1, xo + 0.026], [0.098, xh - 0.034]];
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
  // the wordmark along the caliper's outer face
  const tRows: V3[][] = [];
  for (let i = 0; i <= 1; i++) { const r = 0.152 + 0.036 * i, row: V3[] = []; for (let j = 0; j <= 12; j++) { const a = thc + 0.32 - 0.64 * (j / 12); row.push(v3(xo + 0.0352, Math.cos(a) * r, Math.sin(a) * r)); } tRows.push(row); }
  const tg = gridGeo(tRows, { flip: true });
  const tuv = tg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 12; j++) tuv.setXY(i * 13 + j, j / 12, i);
  put(kit, 'calText', tg);
}
