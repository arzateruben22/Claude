// wanderer.js — B8, the wandering white cell (films/channels/body/set, bible §5): a neutrophil as a translucent
// immune-cream body with a ruffled membrane and a lobed nucleus inside, able to roll, settle, crawl and pour through
// a gap narrower than itself. Episode 6 ("The exit") builds on it; any episode with a white cell can reuse it.
//
//   import { wanderer } from "../set/wanderer.js";
//   const N = wanderer(THREE, L, { r: 4.15 });            // µm: about 8.3 µm across, round, in blood (BioNumbers)
//   scene.add(N.group);
//   window.seek = (t) => { N.set({ pass: 0.5, gap: 2.2, roll: 0, settle: 0, grips: 0 }); ... };
//
// Units are the caller's (episode 6: 1 = 1 µm). The body is a surface of revolution around the group's local y
// axis, rebuilt from a profile on every set() (cheap: 97 × 73 vertices), so its shape is a pure function of the
// state and safe for motion-blur sub-frames:
//   pass (0..1)  how much of the cell has crossed the wall plane y = 0 (local): 0 = all above, resting on it;
//                1 = all below, hanging from it. The volume is kept: an upper and a lower blob joined by a waist
//                held to the gap's radius at y = 0 (the hourglass of a cell squeezing through a junction).
//   gap          the waist's radius at y = 0 while it passes (about 2.2 for a 4–5 µm gap)
//   settle (0..1) flattening on the wall (rolling 0 → crawling 1): lower and wider, the same volume
//   roll         the angle (radians) the body has rolled about local z (its ruffles turn; the nucleus with them)
//   grips (0..1) a ring of small contact points under the body light up (its grips switching on)
//   lead (0..1)  the nucleus goes first: how far its leading lobe is ahead of the body's pass
//
// wanderer(THREE, L, o) → { group, body, nucleus: [Mesh ×3], grips, set(s), bodyMat, nucMat, R, centre() → local
//   [x, y, z] of the upper blob, centreOf(s) → the mass centre for a state (pure: nothing is rebuilt) }
// o: { r = 4.15, color = "#F3EEE4" (theme immune), nucleus = "#8C6FA6", opacity = 0.62, seed = 1, around = 72, rows = 96 }
import { fbm3 } from "cinema/sci/cutaway.js";

const SIGNAL = "#D6F25F";

export const wanderer = (THREE, L, o = {}) => {
  const R = o.r ?? 4.15, NA = o.around ?? 72, NR = o.rows ?? 96, seed = o.seed ?? 1;
  const group = new THREE.Group();
  // the body: a lathe whose rows run from the bottom pole (v = 0) to the top pole (v = 1)
  const pos = new Float32Array((NR + 1) * (NA + 1) * 3), uv = new Float32Array((NR + 1) * (NA + 1) * 2), idx = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) { const k = i * (NA + 1) + j; uv[k * 2] = j / NA; uv[k * 2 + 1] = i / NR; }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  // ruffles: a fixed noise over the membrane (by angle and row), so they turn with the body
  const RUF = new Float32Array((NR + 1) * (NA + 1));
  for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) {
    const th = (i / NR) * Math.PI, ph = (j / NA) * Math.PI * 2, d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    RUF[i * (NA + 1) + j] = 0.05 * fbm3(d[0] * 3.2, d[1] * 3.2, d[2] * 3.2, { seed: 11 + seed }) + 0.025 * fbm3(d[0] * 11, d[1] * 11, d[2] * 11, { seed: 12 + seed, octaves: 2 });
  }
  const bodyMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(o.color || "#F3EEE4"), roughness: 0.45, emissive: L.lin(o.color || "#F3EEE4"), emissiveIntensity: 0.06,
    transparent: true, opacity: o.opacity ?? 0.62, depthWrite: false }), { fresnel: 0.55, fresnelPower: 2.0, key: "wanderer" });
  const body = new THREE.Mesh(geo, bodyMat); body.renderOrder = 2;
  const spin = new THREE.Group(); spin.add(body); group.add(spin);
  // the nucleus: three lobes joined by thin strands (the segmented nucleus that gives the cell its name in a smear)
  const nucMat = L.patch(new THREE.MeshStandardMaterial({ color: L.lin(o.nucleus || "#8C6FA6"), roughness: 0.5, emissive: L.lin(o.nucleus || "#8C6FA6"), emissiveIntensity: 0.12 }), { fresnel: 0.25, key: "wnuc" });
  const lobeG = new THREE.SphereGeometry(1, 28, 20);
  { const p = lobeG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.08 * fbm3(x * 2, y * 2, z * 2, { seed: 21 + seed }); p.setXYZ(i, x * k, y * k, z * k); } lobeG.computeVertexNormals(); }
  const LOBE = [[-1.5, 0.5, 0.3, 1.25], [0.2, -0.3, -0.4, 1.35], [1.6, 0.6, 0.2, 1.15]];   // rest offsets (in R units/4.15) and radii
  const nucleus = LOBE.map(() => { const m = new THREE.Mesh(lobeG, nucMat); spin.add(m); return m; });
  // the grips: a ring of small points on the underside
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: L.lin(SIGNAL), emissiveIntensity: 0, roughness: 1, fog: false });
  const GN = 14, grips = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 1), gripMat, GN); grips.frustumCulled = false; group.add(grips);
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3();
  const V = (4 / 3) * Math.PI * R * R * R;
  let up = { c: R, r: R }, lo = { c: 0, r: 0 };
  // the profile radius at height y (local): the smooth union of the two blobs, its waist held to the gap at y = 0
  const prof = (y, st) => {
    const a = up.r > 1e-3 ? Math.max(0, up.r * up.r - (y - up.c) ** 2) : 0, b = lo.r > 1e-3 ? Math.max(0, lo.r * lo.r - (y - lo.c) ** 2) : 0;
    let r = Math.sqrt(Math.max(a, b) + 0.35 * Math.min(a, b));
    if (st.pass > 0.002 && st.pass < 0.998) { const w = st.gap + 0.9 * Math.abs(y) ** 1.6; r = Math.min(r, w); }
    return r;
  };
  const set = (s = {}) => {
    const pass = Math.min(1, Math.max(0, s.pass ?? 0)), gap = s.gap ?? 2.2, settle = s.settle ?? 0, lead = s.lead ?? 0;
    const st = { pass, gap };
    // the two blobs: volumes split by pass; flattening (settle) lowers and widens the upper one
    const ru = R * Math.cbrt(1 - pass), rl = R * Math.cbrt(pass), sq = 1 - 0.18 * settle * (1 - pass);
    up = { r: ru, c: ru * (pass > 0.002 ? 0.86 : 1) * sq };
    lo = { r: rl, c: -rl * (pass < 0.998 ? 0.86 : 1) };
    const top = up.r > 1e-3 ? up.c + up.r * sq : 0, bot = lo.r > 1e-3 ? lo.c - lo.r : (up.c - up.r * sq);
    const wide = 1 + 0.1 * settle * (1 - pass);
    for (let i = 0; i <= NR; i++) {
      const v = i / NR, y = bot + (top - bot) * (0.5 - 0.5 * Math.cos(Math.PI * v));   // denser rows at the poles
      // within the upper blob the flattening is a vertical squash (sq) of the sphere; the profile is taken unsquashed
      const yy = y >= 0 || pass < 0.002 ? up.c + (y - up.c) / sq : y;
      const r0 = prof(yy, st) * (y >= 0 || pass < 0.002 ? wide : 1);
      for (let j = 0; j <= NA; j++) {
        const ph = (j / NA) * Math.PI * 2, k = i * (NA + 1) + j, rr = r0 * (1 + RUF[k] * Math.min(1, r0 / 1.2));
        pos[k * 3] = rr * Math.cos(ph); pos[k * 3 + 1] = y; pos[k * 3 + 2] = rr * Math.sin(ph);
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    // the roll turns the whole body about local z through its centre (only while it is round and above the wall)
    const rc = up.c;
    spin.position.set(0, rc, 0); body.position.set(0, -rc, 0); spin.rotation.set(0, 0, (s.roll ?? 0) * (1 - Math.min(1, pass * 4)));
    // the nucleus: lobes in the upper blob at rest; as it passes, each lobe follows the body through the waist, the
    // leading one first (lead), pinched as it crosses y = 0
    const RS = R / 4.15;
    nucleus.forEach((m, n) => {
      const order = n === 1 ? 0 : n === 0 ? 1 : 2, f = Math.min(1, Math.max(0, pass * 1.35 - order * 0.17 + lead * (order === 0 ? 0.35 : 0)));
      const ya = up.c + LOBE[n][1] * RS * sq, yb = lo.r > 1e-3 ? lo.c + LOBE[n][1] * RS * 0.6 : -R * 0.6, y = ya + (yb - ya) * (0.5 - 0.5 * Math.cos(Math.PI * f));
      const pinch = Math.min(1, (gap * 0.95) / (LOBE[n][3] * RS)), near = Math.exp(-((y / (1.6 * RS)) ** 2)) * (pass > 0.002 && pass < 0.998 ? 1 : 0);
      const sxz = 1 - (1 - pinch) * near, sy = 1 + 0.6 * (1 - sxz);
      const xz = (1 - 0.7 * near) * (1 - 0.25 * (pass > 0.002 && pass < 0.998 ? 1 : 0));
      m.position.set(LOBE[n][0] * RS * xz * wide, y - rc, LOBE[n][2] * RS * xz * wide);   // in spin's frame (spin sits at rc)
      m.scale.set(LOBE[n][3] * RS * sxz, LOBE[n][3] * RS * sy * (1 - 0.15 * settle), LOBE[n][3] * RS * sxz);
    });
    // the grips: a ring under the body on the wall, lit by s.grips
    const g = Math.max(0, Math.min(1, s.grips ?? 0)), ring = R * (0.55 + 0.2 * settle);
    for (let k = 0; k < GN; k++) {
      const a = (k / GN) * Math.PI * 2 + 0.3 * Math.sin(k * 1.7), rr = ring * (0.7 + 0.3 * ((k * 0.618) % 1));
      grips.setMatrixAt(k, m4.compose(v3.set(rr * Math.cos(a), Math.max(0.15, bot + 0.15), rr * Math.sin(a)), q4, s3.setScalar(g > 0.01 && pass < 0.05 ? 0.6 + 0.6 * g : 0)));
    }
    grips.instanceMatrix.needsUpdate = true; gripMat.emissiveIntensity = 2.2 * g;
    group.updateMatrixWorld(true);
  };
  // the mass centre for a state, without building it (labels, focus and camera tracks call this many times a frame)
  const centreOf = (s = {}) => {
    const pass = Math.min(1, Math.max(0, s.pass ?? 0)), sq = 1 - 0.18 * (s.settle ?? 0) * (1 - pass);
    const cu = R * Math.cbrt(1 - pass) * (pass > 0.002 ? 0.86 : 1) * sq, cl = -R * Math.cbrt(pass) * (pass < 0.998 ? 0.86 : 1);
    return [0, (1 - pass) * cu + pass * cl, 0];
  };
  set({});
  return { group, body, nucleus, grips, set, bodyMat, nucMat, R, centre: () => [0, up.c, 0], centreOf, bottom: () => (lo.r > 1e-3 ? lo.c - lo.r : up.c - up.r) };
};
