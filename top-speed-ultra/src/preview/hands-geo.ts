// One arm (the right; the left is its mirror image), meshed once from the anatomy's distance field, with what the
// skin shader needs per vertex: where it is on the hand, how red and how pale it is there, how occluded it is
// (baked from the field with the rim as an occluder), how thin the flesh is (for light through the fingers), and
// where the finger joints' creases are. Cached per presentation and cell size.
import { Anatomy, buildAnatomy, Pres, V3, add, cross, dot, len, madd, mul, norm, sub, lerp3, rimSdfG } from './hands-sdf';
import { meshField, MeshOut, Box } from './hands-mesh';

export interface ArmGeometry {
  anatomy: Anatomy;
  mesh: MeshOut;          // G frame, mm
  skin: Float32Array;     // vec4: redness, palmar (paler), ambient occlusion, thinness
  joint: Float32Array;    // vec4: along the joint (mm), across it (mm), crease strength, kind (0 finger, 1 knuckle, 2 wrist)
  arm: Float32Array;      // vec2: distance from the wrist toward the elbow (mm), fingertip-ness
  debugColor: Float32Array;
  ms: number;
}

const cache = new Map<string, ArmGeometry>();

export function buildArmGeometry(pres: Pres, h: number): ArmGeometry {
  const key = `${pres}:${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t0 = performance.now();
  const A = buildAnatomy(pres);
  const f = A.field;

  // ---- an oriented box round the arm, along the forearm
  const ax = A.foreDir, ay = A.foreUp, az = cross(ax, ay);
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const capS = dot(sub(A.elbow, [0, 0, 0]), ax) + 42;
  for (const s of f.bounds()) {
    const c = [dot(s.c, ax), dot(s.c, ay), dot(s.c, az)];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - s.r); hi[i] = Math.max(hi[i], c[i] + s.r); }
  }
  // past ~22 cm from the wrist every look's sleeve covers the arm (the rolled work shirt ends ~20 cm up): no need to
  // mesh skin there
  hi[0] = Math.min(hi[0], capS, dot(A.wrist, ax) + 222);
  const pad = 2 * h + 2;
  for (let i = 0; i < 3; i++) { lo[i] -= pad; hi[i] += pad; }
  const box: Box = {
    o: add(add(mul(ax, lo[0]), mul(ay, lo[1])), mul(az, lo[2])), ax, ay, az,
    nx: Math.ceil((hi[0] - lo[0]) / h), ny: Math.ceil((hi[1] - lo[1]) / h), nz: Math.ceil((hi[2] - lo[2]) / h),
  };
  const mesh = meshField(f, box, h);

  // ---- per-vertex anatomy
  const nv = mesh.stats.verts, P = mesh.pos, Nn = mesh.nrm;
  const skin = new Float32Array(nv * 4), joint = new Float32Array(nv * 4), arm = new Float32Array(nv * 2), dbg = new Float32Array(nv * 3);
  const { O, N: dN } = A.palm;
  // the joints whose creases show on the back of the fingers
  interface Jt { p: V3; ax: V3; up: V3; r: number; s: number; kind: number }
  const joints: Jt[] = [];
  A.digits.forEach((g, gi) => {
    const thumb = gi === 4;
    for (let k = thumb ? 1 : 0; k < 3; k++) {
      const prev = k === 0 ? g.dirs[0] : g.dirs[k - 1], next = g.dirs[k];
      const up = norm(add(k === 0 ? A.palm.N : g.dorsal[k - 1], g.dorsal[k]));
      // the thumb's MCP is a knuckle (its folds), its IP a finger-like crease
      const s = thumb ? (k === 2 ? 0.95 : 0.8) : k === 1 ? 1 : k === 2 ? 0.72 : 0.5;
      joints.push({ p: g.joints[k], ax: norm(add(prev, next)), up, r: g.halfW[k] + 4, s, kind: k === 0 || (thumb && k === 1) ? 1 : 0 });
    }
  });
  joints.push({ p: madd(A.wrist, A.foreDir, 6), ax: A.foreDir, up: A.foreUp, r: A.wristHalf[0] + 6, s: 0.35, kind: 2 });
  const tips = A.digits.map((g) => g.joints[3]);
  const knuckles = A.mcp.map((m, i) => madd(m, dN, 6 + i * 0));
  const pips = A.digits.slice(0, 4).map((g) => g.joints[1]);
  const dips = A.digits.slice(0, 4).map((g) => g.joints[2]);
  // which bone is nearest, for the palmar side and thinness
  const bones: { a: V3; b: V3; up: V3; thin: number }[] = [];
  A.digits.forEach((g, gi) => { for (let k = gi === 4 ? 1 : 0; k < 3; k++) bones.push({ a: g.joints[k], b: g.joints[k + 1], up: g.dorsal[k], thin: gi === 4 ? 0.8 : 1 - (2 - k) * 0.12 }); });
  const segDist = (p: V3, a: V3, b: V3) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, madd(a, ab, t))); };
  const g3 = (d: number, s: number) => Math.exp(-(d * d) / (s * s));

  const aoS = [2, 5, 10, 17];
  for (let v = 0; v < nv; v++) {
    const p: V3 = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], n: V3 = [Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]];
    const a = mesh.act[mesh.vblock[v]], na = a ? a.length : 0;
    // ambient occlusion from the field itself, the rim included
    let occ = 0, w = 1;
    for (const s of aoS) {
      const q = madd(p, n, s);
      const d = Math.min(f.eval(q[0], q[1], q[2], a, na), rimSdfG(q[0], q[1], q[2]));
      occ += w * Math.max(0, (s - d) / s); w *= 0.6;
    }
    const aoRaw = Math.min(1, 1 - occ * 0.55);
    // nearest finger bone
    let bd = 1e9, bi = -1;
    for (let i = 0; i < bones.length; i++) { const d = segDist(p, bones[i].a, bones[i].b); if (d < bd) { bd = d; bi = i; } }
    const along = dot(sub(p, A.wrist), A.foreDir);
    const onFinger = bi >= 0 && bd < 13 ? 1 - Math.max(0, Math.min(1, (bd - 9) / 4)) : 0;
    // per vertex at 2-3 mm the occlusion is kept soft (or the creases smear), and the back of the hand never goes
    // darker than ~0.6 (single dark vertices read as dirt or stubble from the seat); the creases between fingers may
    const ao = Math.max(0.62 - 0.2 * onFinger, aoRaw);
    // the back of the hand turns smoothly into the back of the forearm, and into each finger's back
    const handUp = norm(lerp3(dN, A.foreUp, Math.max(0, Math.min(1, (along + 5) / 40))));
    const upDir = bi >= 0 ? norm(lerp3(handUp, bones[bi].up, onFinger)) : handUp;
    const pd = -dot(n, upDir), palmar = pd <= 0.05 ? 0 : pd >= 0.75 ? 1 : ((pd - 0.05) / 0.7) ** 2 * (3 - 2 * (pd - 0.05) / 0.7);
    // redness: knuckles, finger joints' backs, fingertips; the palm side of the fingers is pinker too
    let red = 0;
    for (let i = 0; i < 4; i++) {
      red = Math.max(red, g3(len(sub(p, knuckles[i])), 9) * 0.45, g3(len(sub(p, pips[i])), 7.5) * 0.35 * Math.max(0, dot(n, A.digits[i].dorsal[0]) + 0.3), g3(len(sub(p, dips[i])), 6) * 0.35);
    }
    for (const t of tips) red = Math.max(red, g3(len(sub(p, t)), 9) * 0.6);
    red = Math.max(red, palmar * onFinger * 0.3);
    const thin = onFinger * (bi >= 0 ? bones[bi].thin : 0);
    skin.set([red, palmar, ao, thin], v * 4);
    // the nearest joint's crease coordinates
    let best = 1e9, jv = [0, 0, 0, 0];
    for (const j of joints) {
      const d = sub(p, j.p), x = dot(d, j.ax);
      if (Math.abs(x) > 11) continue;
      const lat = cross(j.ax, j.up), y = dot(d, lat), z = dot(d, j.up);
      if (Math.hypot(y, z) > j.r + 3) continue;
      if (Math.abs(x) < best) { best = Math.abs(x); jv = [x, y, j.s * Math.max(0, Math.min(1, dot(n, j.up) * 1.6 + 0.2)), j.kind]; }
    }
    joint.set(jv, v * 4);
    let tipness = 0;
    for (const t of tips) tipness = Math.max(tipness, g3(len(sub(p, t)), 9));
    arm[v * 2] = along; arm[v * 2 + 1] = tipness;
    const base = [0.86, 0.62, 0.5];
    dbg.set([base[0] * ao * (1 + red * 0.15), base[1] * ao * (1 - red * 0.2), base[2] * ao * (1 - red * 0.25)], v * 3);
  }
  // the baked occlusion and redness, relaxed over the mesh: a vertex whose samples fell into a crease of its own makes
  // a dark speck a pixel wide from the seat; two passes of neighbour averaging (the minimum is kept in real creases)
  {
    const idx = mesh.idx, sum = new Float32Array(nv * 2), cnt = new Uint16Array(nv);
    for (let pass = 0; pass < 2; pass++) {
      sum.fill(0); cnt.fill(0);
      for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
        sum[a * 2] += skin[b * 4 + 2]; sum[a * 2 + 1] += skin[b * 4]; cnt[a]++;
        sum[b * 2] += skin[a * 4 + 2]; sum[b * 2 + 1] += skin[a * 4]; cnt[b]++;
      }
      for (let v = 0; v < nv; v++) if (cnt[v]) {
        const ao = sum[v * 2] / cnt[v], rd = sum[v * 2 + 1] / cnt[v];
        skin[v * 4 + 2] = Math.max(skin[v * 4 + 2], ao * 0.98) * 0.5 + ao * 0.5;
        skin[v * 4] = skin[v * 4] * 0.5 + rd * 0.5;
      }
    }
  }
  const res: ArmGeometry = { anatomy: A, mesh, skin, joint, arm, debugColor: dbg, ms: performance.now() - t0 };
  cache.set(key, res);
  void O; void lerp3;
  return res;
}
