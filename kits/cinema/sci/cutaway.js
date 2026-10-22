// cutaway.js — a shell cut open by a plane, with a flat cap over the cut (kits/cinema/sci). Brand-neutral.
// Body: a red cell cut in half (no nucleus), an alveolus, a heart chamber, tissue cells. Space: a planet's
// interior. Physics: a block of ice. The shell is star-shaped around its centre: r(dir), a sphere deformed
// by seeded value noise unless the caller gives its own radial function (a biconcave cell, an egg).
//
//   import { cutaway } from "cinema/sci/cutaway.js";
//   renderer.localClippingEnabled = true;                      // the shell is cut by a clipping plane
//   const C = cutaway({ radius: 6, noise: { amp: 0.12, freq: 1.6, seed: 4 }, material: skin, capMaterial: flesh });
//   scene.add(C.group);
//   window.seek = (t) => { C.group.position.set(...); C.set({ cut: { n: [0, 0, 1], d: 6 - 6 * open(t) } }); C.update(); ... };
//
// The cut: the local plane n·p = d. Everything on the side n·p > d is removed, so point n at the viewer
// and slide d from the shell's radius (closed) to 0 (cut through the middle). The cap is exact for a
// star-shaped section: for each angle ψ in the plane a bisection finds where the ray from the plane's foot
// leaves the shell, so the cap meets the cut edge without a stencil buffer (the cinema finish renders into
// targets without one). The shell is cut by a clipping plane, so a depth pass that overrides materials
// (cinema3d.js's depth of field) still sees the uncut shell there; with a small cut-away that costs a little
// blur accuracy at the cut, nothing more.
//
// cutaway(o) → C
//   o: { radius = 1, radial: (dir) => r (dir a unit [x, y, z]; replaces radius + noise), noise: { amp = 0
//        (fraction of the radius), freq = 2, octaves = 3, seed = 1 }, segments: [nu = 96, nv = 64] (around, pole
//        to pole), capSegments = 160, material (default MeshStandardMaterial), capMaterial (default: the same
//        colour, darker), clipShadows = false }
//   C.group, C.shell, C.cap          the meshes (C.cap is hidden while nothing is cut)
//   C.r(dir)                         the shell's radius along a unit direction (local units)
//   C.rmax                           the largest radius (sampled)
//   C.set({ cut, deform })           cut: { n: [x, y, z], d } or null; deform: null or (p, n) => ({ p, n }), a
//                                    map applied to every vertex of the shell and the cap (from their rest
//                                    positions), e.g. a cell folding into a parachute
//   C.update()                       after the group is placed for this frame: the world clipping plane from
//                                    group.matrixWorld, and the cap (and a deformed shell) rebuilt if the cut
//                                    or the deform changed (a deform function may carry a `key`; without one
//                                    the vertices are recomputed on every update). Call it every seek
//   C.section()                      the cap's outline in local units (rest positions), for labels and probes
//   C.capCentre()                    the cap's centre (local), the natural anchor for "the cut face"
//   The cap carries a float attribute `capEdge`: 0 at its centre, 1 on its outline, for a material that
//   draws a crust, a membrane or a rind along the cut edge (onBeforeCompile).
import * as THREE from "three";

// seeded value noise on 3D points: a hashed lattice, smoothstep-blended, summed over octaves
const hash3 = (x, y, z, s) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const sm = (u) => u * u * (3 - 2 * u);
export const noise3 = (x, y, z, seed = 1) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
  const L = (a, b, f) => a + (b - a) * f;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k, seed);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
};
export const fbm3 = (x, y, z, o = {}) => {
  let a = 1, f = 1, s = 0, tot = 0;
  for (let k = 0; k < (o.octaves ?? 3); k++) { s += a * noise3(x * f, y * f, z * f, (o.seed ?? 1) + k * 101); tot += a; a *= 0.5; f *= 2.03; }
  return s / tot;
};

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const cutaway = (o = {}) => {
  const R0 = o.radius ?? 1, nz = o.noise || {}, amp = nz.amp ?? 0, freq = nz.freq ?? 2;
  const r = o.radial || ((d) => R0 * (1 + (amp ? amp * fbm3(d[0] * freq + 11.3, d[1] * freq - 4.1, d[2] * freq + 7.7, nz) : 0)));
  const [nu, nv] = o.segments || [96, 64], NC = o.capSegments ?? 160;
  // F(p) = |p| − r(p/|p|): negative inside; its gradient is the outward normal
  const F = (p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1e-9; return l - r([p[0] / l, p[1] / l, p[2] / l]); };
  const grad = (p, h) => {
    const g = [F([p[0] + h, p[1], p[2]]) - F([p[0] - h, p[1], p[2]]), F([p[0], p[1] + h, p[2]]) - F([p[0], p[1] - h, p[2]]), F([p[0], p[1], p[2] + h]) - F([p[0], p[1], p[2] - h])];
    return norm(g);
  };
  // the shell: a pole-to-pole grid (y is the polar axis), each vertex pushed out to r(dir)
  const pos = [], nor = [], uv = [], idx = [];
  let rmax = 0;
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * Math.PI * 2, d = [st * Math.cos(ph), ct, st * Math.sin(ph)], rr = r(d);
      const p = [d[0] * rr, d[1] * rr, d[2] * rr];
      rmax = Math.max(rmax, rr);
      pos.push(p[0], p[1], p[2]);
      const n = grad(p, Math.max(1e-4, rr * 2e-3));
      nor.push(n[0], n[1], n[2]); uv.push(i / nu, 1 - j / nv);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    // j runs from the +y pole down; i runs around: (c − a) points down the meridian, (b − a) around it
    if (j > 0) idx.push(a, b, c);
    if (j < nv - 1) idx.push(b, d, c);
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  shellGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  shellGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  shellGeo.setIndex(idx);
  shellGeo.computeBoundingSphere();
  const restP = Float32Array.from(pos), restN = Float32Array.from(nor);

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
  const material = o.material || new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6 });
  material.clippingPlanes = [plane]; material.clipShadows = !!o.clipShadows;
  const capMaterial = o.capMaterial || (() => { const m = material.clone(); m.clippingPlanes = null; if (m.color) m.color.multiplyScalar(0.55); return m; })();
  const shell = new THREE.Mesh(shellGeo, material);
  const capGeo = new THREE.BufferGeometry();
  const capPos = new Float32Array((NC + 2) * 3), capNor = new Float32Array((NC + 2) * 3), capEdge = new Float32Array(NC + 2).fill(1), capIdx = [];
  capEdge[0] = 0;
  for (let k = 0; k < NC; k++) capIdx.push(0, 1 + k, 1 + ((k + 1) % NC));
  capGeo.setAttribute("position", new THREE.BufferAttribute(capPos, 3));
  capGeo.setAttribute("normal", new THREE.BufferAttribute(capNor, 3));
  capGeo.setAttribute("capEdge", new THREE.BufferAttribute(capEdge, 1));
  capGeo.setIndex(capIdx);
  const cap = new THREE.Mesh(capGeo, capMaterial);
  cap.visible = false;
  const group = new THREE.Group();
  group.add(shell, cap);

  let cut = null, deform = null, built = null, restCap = null, centre = [0, 0, 0];
  const section = (n, d) => {
    // the plane's foot, two in-plane axes with e1 × e2 = n (so the fan faces +n), then one bisection per angle
    const c0 = [n[0] * d, n[1] * d, n[2] * d];
    const e1 = norm(Math.abs(n[1]) < 0.9 ? cross([0, 1, 0], n) : cross([1, 0, 0], n)), e2 = cross(n, e1);
    const out = [];
    if (F(c0) >= 0) return null;                      // the plane misses the shell (or only grazes it)
    for (let k = 0; k < NC; k++) {
      const ps = (k / NC) * Math.PI * 2, e = [e1[0] * Math.cos(ps) + e2[0] * Math.sin(ps), e1[1] * Math.cos(ps) + e2[1] * Math.sin(ps), e1[2] * Math.cos(ps) + e2[2] * Math.sin(ps)];
      let lo = 0, hi = rmax * 2.2;
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (F([c0[0] + e[0] * m, c0[1] + e[1] * m, c0[2] + e[2] * m]) < 0) lo = m; else hi = m; }
      out.push([c0[0] + e[0] * lo, c0[1] + e[1] * lo, c0[2] + e[2] * lo]);
    }
    return { c0, pts: out };
  };
  const C = {
    group, shell, cap, r, rmax,
    set: (s = {}) => { if ("cut" in s) cut = s.cut ? { n: norm(s.cut.n), d: s.cut.d } : null; if ("deform" in s) deform = s.deform || null; },
    section: () => (restCap ? restCap.pts.map((p) => p.slice()) : []),
    capCentre: () => centre.slice(),
    update: () => {
      group.updateMatrixWorld();
      // the world clipping plane: keep n·p ≤ d (three keeps where normal·p + constant ≥ 0)
      if (cut) { plane.normal.set(-cut.n[0], -cut.n[1], -cut.n[2]); plane.constant = cut.d; plane.applyMatrix4(shell.matrixWorld); }
      else { plane.normal.set(0, 0, -1); plane.constant = 1e6; }
      // a deform with a `key` (any JSON value naming its parameters) is rebuilt only when the key changes;
      // one without a key is rebuilt on every update
      const k = deform && deform.key == null ? null : JSON.stringify([cut, deform ? deform.key : null]);
      if (k !== null && k === built) return;
      built = k;
      restCap = cut ? section(cut.n, cut.d) : null;
      cap.visible = !!restCap;
      const map = deform ? (p, n) => deform(p, n) : (p, n) => ({ p, n });
      if (restCap) {
        const cn = cut.n;
        // the centre of the fan: the mean of the outline (safer than the plane's foot for an off-centre section)
        const m = restCap.pts.reduce((a, p) => [a[0] + p[0] / NC, a[1] + p[1] / NC, a[2] + p[2] / NC], [0, 0, 0]);
        const mc = map(m, cn); capPos.set(mc.p, 0); capNor.set(mc.n, 0); centre = mc.p;
        restCap.pts.forEach((p, i) => { const q = map(p, cn); capPos.set(q.p, 3 * (i + 1)); capNor.set(q.n, 3 * (i + 1)); });
        capGeo.attributes.position.needsUpdate = true; capGeo.attributes.normal.needsUpdate = true;
        capGeo.computeBoundingSphere();
      }
      if (deform || shell.userData.deformed) {
        const P = shellGeo.attributes.position.array, N = shellGeo.attributes.normal.array;
        for (let v = 0; v < P.length; v += 3) {
          const q = map([restP[v], restP[v + 1], restP[v + 2]], [restN[v], restN[v + 1], restN[v + 2]]);
          P[v] = q.p[0]; P[v + 1] = q.p[1]; P[v + 2] = q.p[2]; N[v] = q.n[0]; N[v + 1] = q.n[1]; N[v + 2] = q.n[2];
        }
        shellGeo.attributes.position.needsUpdate = true; shellGeo.attributes.normal.needsUpdate = true;
        shellGeo.computeBoundingSphere();
        shell.userData.deformed = !!deform;
      }
    },
  };
  return C;
};
