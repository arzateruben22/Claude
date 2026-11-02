// melanocyte04.js — No. 004's tanning set (films/channels/skincare/set), added to a section from section.js:
//   createMelanocyte: a pigment cell on the basal row, its branches (dendrites) reaching up between the living
//     cells, and its melanosomes: they fill the cell body (fill), then travel up the branches and out to the cells
//     above (travel), where they become each cell's cap over its nucleus;
//   createCaps: those caps (the "parasols"), one over each spinous cell's nucleus, grown by `tan`, cut open by the
//     section's own clipping planes; only cells whose nucleus the cut opens get one, so caps show where nuclei do;
//   createSignal: a short chain of small beads drifting from one cell down to the melanocyte (the chemical message,
//     α-MSH; an illustration).
// All built once from a seed and the section's own instance positions; set from t alone. Colours come from the
// section's melanin ramp (toneColor), never from a token, so every tone tans in its own colours.
//
//   const M = createMelanocyte(S, { x: 6, seed: 21 });   M.set({ tone, fill, travel, glow })   M.at.body(), M.at.tip(i)
//   const C = createCaps(S);                            C.set({ tone, tan })                  C.cellNear([x, y, z])
//   const G = createSignal({ from, to, n: 14 });         G.set(u, { gain, color })            (u: 0 … 1 along the way)
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

const clipOf = (S) => S.meshes.corneoMesh.material.clippingPlanes;
const spinPositions = (S) => {
  const m = S.meshes.spinMesh, M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), out = [];
  for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.decompose(p, q, s); out.push({ pos: [p.x + S.group.position.x, p.y, p.z], sy: s.y }); }
  return out;
};

export const createCaps = (S, { scale = 1 } = {}) => {
  const D = S.dims, z1 = D.D / 2, ox = S.group.position.x;
  const cells = spinPositions(S).filter((c) => Math.abs(c.pos[0] - ox) < D.W / 2 - 2 && Math.abs(c.pos[2] - z1) < 2.1);   // cells whose nucleus the cut opens
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clipOf(S) });
  const geo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  const dummy = new THREE.Object3D();
  const R = rng(17), jit = cells.map(() => 0.85 + 0.3 * R());
  return {
    mesh, cells,
    // tan: 0 (none) … 1 (a full cap over every nucleus); tone: the section's melanin level; dim: 0 … 1
    set({ tone = 0.5, tan = 0, dim = 0 } = {}) {
      const c = toneColor("melanin", Math.min(1, tone + 0.25)), k = (1 - 0.5 * dim) * 0.85;
      mat.color.setRGB(c[0] * k, c[1] * k, c[2] * k);
      mesh.visible = tan > 0.01;
      cells.forEach((cl, i) => {
        const g = Math.min(1, Math.max(0, tan * 1.15 - 0.15 * jit[i] + 0.05));
        const flat = cl.sy / 6.0;
        dummy.position.set(cl.pos[0] - ox, cl.pos[1] + 1.1 * flat, cl.pos[2]);   // a dome over the nucleus, cut open with it
        dummy.scale.set(3.1 * scale * g * jit[i] + 1e-4, (2.3 * flat * g + 1e-4) * scale, 3.1 * scale * g * jit[i] + 1e-4);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    // the cut-face cell nearest a point (world space): its nucleus position and its cap's top
    cellNear(p) {
      let best = null, bd = Infinity;
      for (const cl of cells) { const d = Math.hypot(cl.pos[0] - p[0], cl.pos[1] - p[1], (cl.pos[2] - p[2]) * 2); if (d < bd) { bd = d; best = cl; } }
      return best;
    },
  };
};

export const createMelanocyte = (S, { x = 6, seed = 21, n = 90, branches = 5 } = {}) => {
  const D = S.dims, z1 = D.D / 2, ox = S.group.position.x, R = rng(seed);
  const yb = S.junction(x) + D.BA * 0.45, zc = z1 - 3.2;
  const g = new THREE.Group();
  g.position.x = ox;
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bodyMat);
  body.position.set(x, yb, zc); body.scale.set(5.6, 3.6, 3.4);
  // an ink outline (back faces of a slightly larger shell), as the climbing cell in No. 001, so it reads in every tone
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x13252c, side: THREE.BackSide, transparent: true, opacity: 0.8, toneMapped: false });
  const line = new THREE.Mesh(body.geometry, lineMat);
  line.position.copy(body.position); line.scale.set(6.3, 4.3, 4.1);
  g.add(line, body);
  const curves = [];
  const tubeMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, emissive: 0x000000 });
  const tubeLine = new THREE.MeshBasicMaterial({ color: 0x13252c, transparent: true, opacity: 0.8, toneMapped: false, side: THREE.BackSide });
  for (let b = 0; b < branches; b++) {
    const a = (b / (branches - 1) - 0.5) * 2;                          // −1 … 1 across
    const tipX = x + a * 34 + (R() - 0.5) * 6, tipY = D.yS - D.SP * (0.25 + 0.45 * R());
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x + a * 3, yb + 2, zc), new THREE.Vector3(x + a * 14, yb + 9 + R() * 4, zc + 0.6),
      new THREE.Vector3(x + a * 25, (yb + tipY) / 2 + 6, zc + 0.3), new THREE.Vector3(tipX, tipY, zc)]);
    curves.push(c);
    const geo = new THREE.TubeGeometry(c, 40, 1.05, 8, false);
    g.add(new THREE.Mesh(geo, tubeLine), new THREE.Mesh(geo, tubeMat));
    // the outline tube: the same path, a little fatter
    g.children[g.children.length - 2].geometry = new THREE.TubeGeometry(c, 40, 1.55, 8, false);
  }
  // melanosomes: small dark ellipsoids, each with a branch, a place in the body, a delay and a destination cap
  const mm = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
  const ms = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mm, n);
  const M = Array.from({ length: n }, (_, i) => ({ b: i % branches, k: R(), d: R() * 0.45, home: [x + (R() - 0.5) * 7, yb + (R() - 0.5) * 4, zc + 1.6 + R() * 1.4], out: [(R() - 0.5) * 10, 1 + R() * 3] }));
  g.add(ms);
  const dummy = new THREE.Object3D();
  return {
    group: g,
    // fill: 0 … 1 (melanosomes appear in the body and darken); travel: 0 … 1 (they climb the branches and leave
    // at the tips toward the cells above); glow: 0 … 1 a faint lift on the body so it wins its frames; dim: 0 … 1
    set({ tone = 0.5, fill = 0, travel = 0, glow = 0, dim = 0 } = {}) {
      const liv = toneColor("basal", tone), mel = toneColor("melanin", Math.min(1, tone + 0.3)), k = 1 - 0.55 * dim;
      bodyMat.color.setRGB(...liv.map((v) => (v + (1 - v) * 0.3) * k));
      bodyMat.emissive.setRGB(...liv.map((v) => v * 0.35 * glow));
      tubeMat.color.copy(bodyMat.color); tubeMat.emissive.copy(bodyMat.emissive);
      lineMat.opacity = tubeLine.opacity = 0.8 * k;
      mm.color.setRGB(...mel.map((v) => v * k));
      M.forEach((m, i) => {
        const on = Math.min(1, Math.max(0, (fill - m.k * 0.8) / 0.2));
        const u = Math.min(1, Math.max(0, (travel - m.d) / 0.55));
        let p;
        if (u <= 0) p = m.home;
        else if (u < 0.85) { const q = curves[m.b].getPoint(Math.min(1, u / 0.85)); p = [q.x, q.y, q.z + 1.2]; }
        else { const q = curves[m.b].getPoint(1), w = (u - 0.85) / 0.15; p = [q.x + m.out[0] * w, q.y + m.out[1] * w, q.z + 1.2]; }
        const s = 0.95 * on * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
        dummy.position.set(...p); dummy.scale.set(s * 1.0 + 1e-4, s * 0.7 + 1e-4, s * 0.7 + 1e-4); dummy.updateMatrix(); ms.setMatrixAt(i, dummy.matrix);
      });
      ms.instanceMatrix.needsUpdate = true;
    },
    at: {
      body: () => [x + ox + 4, yb + 1, zc + 3.6],
      tip: (b) => { const q = curves[b].getPoint(1); return [q.x + ox, q.y, q.z + 1]; },
    },
  };
};

export const createSignal = ({ from, to, n = 14, seed = 23, size = 1.1 } = {}) => {
  const R = rng(seed);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: true });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat, n);
  mesh.frustumCulled = false;
  const B = Array.from({ length: n }, (_, i) => ({ lag: (i / n) * 0.55, wob: R() * 6.28, off: [(R() - 0.5) * 6, (R() - 0.5) * 3, (R() - 0.5) * 2] }));
  const dummy = new THREE.Object3D();
  return {
    mesh,
    // u: 0 (all at `from`) … 1 (all arrived at `to`, faded); t: film time for the drift; gain: overall opacity
    set(u, t, { gain = 1, color = [0.3, 0.7, 0.75] } = {}) {
      mat.color.setRGB(...color); mat.opacity = gain;
      mesh.visible = gain > 0.002 && u > 0 && u < 1.2;
      let any = null;
      B.forEach((b, i) => {
        const v = Math.min(1, Math.max(0, (u - b.lag) / 0.45)), w = Math.sin(Math.PI * v);
        const p = from.map((f, j) => f + (to[j] - f) * v + b.off[j] * w + (j === 0 ? 1.2 * Math.sin(t * 1.7 + b.wob) * w : 0));
        const s = size * Math.min(1, v * 6) * (v >= 1 ? 0 : 1);
        dummy.position.set(...p); dummy.scale.setScalar(s + 1e-4); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        if (!any && v > 0.3 && v < 0.7) any = p;
      });
      mesh.instanceMatrix.needsUpdate = true;
      return any;
    },
  };
};
