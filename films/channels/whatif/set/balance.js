// balance.js — a pan balance and the heaps it weighs (films/channels/whatif/set). Built for No. 003 ("All the
// ants": every ant on one pan, every person on the other); reusable for any "which weighs more" sum. Units are
// the scene's (No. 003: 1 unit = 1 cm on the desk).
//
//   import { createBalance, createAnt } from "../set/balance.js";
//   const B = createBalance({ tokens, span: 60, height: 40 });   scene.add(B.group);
//   B.set({ tilt: radians (+: the left pan goes down), left: 0–1, right: 0–1 (how full each heap is), x, z })
//   (o.rightColor: the right heap's colour, default anchor blue: people)
//   B.panAt("left" | "right") → [x, y, z] of that pan's centre (for labels)
//   const ant = createAnt({ tokens, length: 0.5 });              scene.add(ant.group);   ant.set({ at, heading, step })
//
// The balance is drawn like the planet model: chalk plaster with a graphite post, shaded by one lamp direction
// in display space. The left heap is ants (a graphite-grey mound speckled with seeded instanced ants, tiny); the
// right heap is people (anchor blue capsules: blue is people). Heaps are seeded, so any frame can be sought
// alone; `left`/`right` grow them from nothing (never a pop). The beam's tilt eases where it is told; the pans
// hang plumb from its ends whatever the tilt (they are re-placed each frame), like a real balance.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";
import { rng } from "cinema/film/runtime.js";

const VS = `
varying vec3 vN;
void main() {
  vec3 n = normal;
  #ifdef USE_INSTANCING
  n = mat3(instanceMatrix) * n;
  #endif
  vN = normalize(mat3(modelMatrix) * n);
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;
const FS = `
precision highp float;
uniform vec3 uCol, uLight; uniform float uExposure, uLo;
varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  float lam = 0.5 + 0.5 * dot(normalize(vN), normalize(uLight));
  vec3 col = uCol * mix(uLo, 1.0, lam);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const shaded = (hex, lo = 0.6) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(hex)) }, uLight: { value: new THREE.Vector3(-0.5, 0.8, 0.45) }, uExposure: { value: 1 }, uLo: { value: lo } },
  vertexShader: VS, fragmentShader: FS,
});

// a heap: n instanced items on a cone of radius r and height h, seeded; fill (0–1) shows the first fill·n
const heap = (geo, mat, n, r, h, seed) => {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const R = rng(seed), P = [];
  for (let i = 0; i < n; i++) {
    const u = Math.sqrt(R()), a = R() * Math.PI * 2, rr = r * u;              // uniform on the disc
    const y = h * (1 - u) * (0.75 + 0.25 * R());                              // under a cone
    P.push({ x: rr * Math.cos(a), y, z: rr * Math.sin(a), rx: R() * 6.28, ry: R() * 6.28, s: 0.8 + 0.4 * R(), k: R() });
  }
  P.sort((p, q) => p.y - q.y);                                                // fill from the bottom up
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const set = (fill) => {
    const k = Math.round(Math.max(0, Math.min(1, fill)) * n);
    for (let i = 0; i < n; i++) {
      const p = P[i], on = i < k ? 1 : 0;
      q.setFromEuler(e.set(p.rx, p.ry, 0)); s.setScalar(p.s * on + 1e-4); pos.set(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m4.compose(pos, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  set(1);
  return { mesh, set };
};

export const createBalance = (o = {}) => {
  const tk = o.tokens || {}, S = o.span ?? 60, Hh = o.height ?? 40;
  const plaster = shaded(tk.model || "#E6E2D8", 0.55), post = shaded("#3A3D44", 0.7);
  const antMat = shaded("#8C8F96", 0.5), personMat = shaded(o.rightColor || tk.anchor || "#4DA3FF", 0.62);
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.16, S * 0.2, Hh * 0.05, 48), post);
  base.position.y = Hh * 0.025;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.025, S * 0.035, Hh, 24), post);
  column.position.y = Hh / 2;
  const beam = new THREE.Group(); beam.position.y = Hh;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(S, S * 0.025, S * 0.04), plaster);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(S * 0.04, 24, 16), plaster);
  beam.add(bar, pivot);
  group.add(base, column, beam);
  const DROP = Hh * 0.55, PAN_R = S * 0.22;
  const pan = (side) => {
    const g = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(PAN_R, PAN_R * 0.8, S * 0.03, 48), plaster);
    const strings = [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2, geo = new THREE.CylinderGeometry(S * 0.003, S * 0.003, 1, 6);
      const m = new THREE.Mesh(geo, post); m.userData.a = a; return m;
    });
    g.add(dish, ...strings);
    const items = side < 0
      ? heap(new THREE.SphereGeometry(S * 0.006, 6, 4), antMat, o.ants ?? 2400, PAN_R * 0.85, S * 0.12, 31)
      : heap(new THREE.CapsuleGeometry(S * 0.012, S * 0.03, 3, 8), personMat, o.people ?? 260, PAN_R * 0.85, S * 0.12, 47);
    items.mesh.position.y = S * 0.015;
    g.add(items.mesh);
    group.add(g);
    return { g, dish, strings, items };
  };
  const L = pan(-1), R = pan(1);
  const place = (P, side, tilt) => {
    const ex = (side * S) / 2;
    const end = new THREE.Vector3(ex * Math.cos(tilt), Hh + ex * Math.sin(tilt), 0);   // the beam's end after rotating by tilt about z
    P.g.position.set(end.x, end.y - DROP, 0);
    for (const m of P.strings) {                                                  // three strings from the beam's end to the rim
      const a = m.userData.a, rim = new THREE.Vector3(PAN_R * 0.95 * Math.cos(a), 0, PAN_R * 0.95 * Math.sin(a));
      const top = new THREE.Vector3(0, DROP, 0), mid = rim.clone().add(top).multiplyScalar(0.5), len = rim.distanceTo(top);
      m.position.copy(mid); m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(rim).normalize());
    }
  };
  const state = { tilt: 0 };
  const set = (s = {}) => {
    group.position.set(s.x ?? 0, 0, s.z ?? 0);
    const tilt = s.tilt ?? 0; state.tilt = tilt;
    beam.rotation.z = tilt;                                                      // + : the left end goes down
    place(L, -1, tilt); place(R, 1, tilt);
    if (s.left !== undefined) L.items.set(s.left);
    if (s.right !== undefined) R.items.set(s.right);
  };
  const panAt = (side) => { const P = side === "left" ? L : R; const v = new THREE.Vector3(); P.g.getWorldPosition(v); return [v.x, v.y + S * 0.08, v.z]; };
  set({});
  return { group, set, panAt, span: S, height: Hh };
};

// an ant: three segments, six legs, two antennae; graphite grey (not a token colour: the subject is drawn,
// not coded). length in scene units. step (0–1, cycling) swings the legs for walking.
export const createAnt = (o = {}) => {
  const Lh = o.length ?? 0.5, m = shaded(o.color || "#5A5D64", 0.45);
  const g = new THREE.Group(), body = new THREE.Group();
  const seg = (rx, ry, rz, x) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m); s.scale.set(rx, ry, rz); s.position.set(x, Lh * 0.12, 0); body.add(s); return s; };
  seg(Lh * 0.13, Lh * 0.11, Lh * 0.11, Lh * 0.36);            // head
  seg(Lh * 0.17, Lh * 0.09, Lh * 0.08, Lh * 0.12);            // thorax
  seg(Lh * 0.24, Lh * 0.15, Lh * 0.15, -Lh * 0.24);           // gaster
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 1 : -1, k = i % 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(Lh * 0.012, Lh * 0.012, Lh * 0.45, 5), m);
    leg.geometry.translate(0, -Lh * 0.22, 0);
    leg.position.set(Lh * (0.2 - 0.08 * k), Lh * 0.13, side * Lh * 0.06);
    leg.userData = { side, k };
    body.add(leg); legs.push(leg);
  }
  for (const side of [1, -1]) {
    const an = new THREE.Mesh(new THREE.CylinderGeometry(Lh * 0.008, Lh * 0.008, Lh * 0.32, 5), m);
    an.geometry.translate(0, Lh * 0.16, 0);
    an.position.set(Lh * 0.44, Lh * 0.18, side * Lh * 0.04);
    an.rotation.set(side * 0.5, 0, -0.9);
    body.add(an);
  }
  g.add(body);
  const set = (s = {}) => {
    if (s.at) g.position.set(...s.at);
    g.rotation.y = s.heading ?? 0;
    const ph = (s.step ?? 0) * Math.PI * 2;
    for (const leg of legs) {
      const { side, k } = leg.userData, sw = Math.sin(ph + (k % 2 ? Math.PI : 0) + (side < 0 ? Math.PI : 0)) * 0.35;
      leg.rotation.set(side * 1.15, 0, 0.5 - 0.5 * k + sw);
    }
  };
  set({});
  return { group: g, set, length: Lh };
};
