// terrain.js — Outer Layer's movement (films/channels/skincare/set): the macro flight over skin at golden hour.
//   createTerrain(o): the skin's microrelief as terrain: two crossing families of furrows (the diamond grid), pore
//     craters on a jittered grid, fine hairs rising from the pores, and round pigment spots. Units are arbitrary
//     (a pore every `pore` units); the episode's gauge carries the real scale.
//     o: { size, segs, pore, seed, hair, spots: [[x, z, r], ...] or a count, half: "right" | null (spots only right) }
//     set({ tone: [r, g, b], furrows (0 … 1.5 depth), spot (0 … 1 darkness), sheen (0 … 1 a satin film on x < 0),
//       redden: [x, z, r, k] (a red, raised spot: a pimple), visible })   (geometry rebuilt only when a value changes)
//     at(x, z) → [x, y, z] on the surface, for labels and camera keys
//   goldenHour(scene): the low warm sun behind and to the right (the rim), a cool sky fill, a soft key, warm fog.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const goldenHour = (scene, { fog = [55, 110] } = {}) => {
  scene.fog = new THREE.Fog(0x2c1660, fog[0], fog[1]);   // the theme's violet: the far edge melts into the ground colour
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2418, 0.55));
  const sun = new THREE.DirectionalLight(0xffb870, 4.2); sun.position.set(30, 6, -30); scene.add(sun);
  const key = new THREE.DirectionalLight(0xfff0e0, 0.9); key.position.set(-10, 14, 20); scene.add(key);
  return { sun, key };
};

export const createTerrain = ({ size = 80, segs = 360, pore = 3.2, seed = 7, hair = true, spots = 0, half = "right" } = {}) => {
  const R = rng(seed), S = size;
  const geo = new THREE.PlaneGeometry(S, S, segs, segs); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, base = Float32Array.from(pos.array), cols = new Float32Array(pos.count * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v; };
  const fbm = (x, y) => { let s = 0, a = 0.5; for (let k = 0; k < 4; k++) { s += a * vn(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
  const pores = []; for (let gx = -S / 2; gx < S / 2; gx += pore) for (let gz = -S / 2; gz < S / 2; gz += pore) pores.push([gx + (R() - 0.5) * pore * 0.7, gz + (R() - 0.5) * pore * 0.7]);
  const SP = Array.isArray(spots) ? spots : Array.from({ length: spots }, () => [(half === "right" ? 1.5 : -S / 2) + R() * (half === "right" ? S / 2 - 2 : S), -S / 2 + R() * S, 0.8 + R() * 1.8]);
  // per vertex: the static fields (furrow, pore depth, spot weight, fine noise)
  const F = new Float32Array(pos.count), P = new Float32Array(pos.count), K = new Float32Array(pos.count), N = new Float32Array(pos.count), Y0 = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = base[3 * i], z = base[3 * i + 2];
    const d1 = Math.abs(Math.sin((x + z) * 0.55 + 0.6 * fbm(x * 0.2, z * 0.2))), d2 = Math.abs(Math.sin((x - z) * 0.48 + 0.7 * fbm(x * 0.2 + 5, z * 0.2)));
    F[i] = Math.pow(1 - Math.min(d1, d2), 6);
    let p = 0; for (const [px, pz] of pores) { const r2 = (x - px) ** 2 + (z - pz) ** 2; if (r2 < 1.2) p += 0.55 * Math.exp(-r2 / 0.18); } P[i] = p;
    let k = 0; for (const [sx, sz, sr] of SP) { const d2 = ((x - sx) ** 2 + (z - sz) ** 2) / (sr * sr); if (d2 < 2.5) k = Math.max(k, 1 / (1 + Math.exp((d2 - 1) * 6))); } K[i] = k;
    N[i] = fbm(x * 1.5, z * 1.5); Y0[i] = 0.25 * fbm(x * 0.35, z * 0.35);
  }
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, sheen: 0.12, sheenColor: new THREE.Color(0xffd2b0), sheenRoughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group(); group.add(mesh);
  // the satin film (sunscreen, or a hydrated surface) over x < 0
  const filmGeo = new THREE.PlaneGeometry(S / 2, S, 1, 1); filmGeo.rotateX(-Math.PI / 2);
  const film = new THREE.Mesh(filmGeo, new THREE.MeshPhysicalMaterial({ color: 0xfff4e8, transparent: true, opacity: 0, roughness: 0.1, clearcoat: 1, depthWrite: false }));
  film.position.set(-S / 4, 0.32, 0); group.add(film);
  let hairs = null;
  if (hair) {
    const hg = new THREE.CylinderGeometry(0.018, 0.045, 1, 5, 1).translate(0, 0.5, 0);
    hairs = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ color: 0xc9a27e, roughness: 0.4 }), pores.length);
    const dm = new THREE.Object3D();
    pores.forEach(([px, pz], i) => { dm.position.set(px, -0.3, pz); dm.rotation.set(-0.5 - R() * 0.4, R() * 0.6 - 0.3, (R() - 0.5) * 0.5); dm.scale.set(1, 2.2 + R() * 2.2, 1); dm.updateMatrix(); hairs.setMatrixAt(i, dm.matrix); });
    group.add(hairs);
  }
  let last = "";
  const scarK = (x, z, sc) => (sc ? Math.exp(-(((z - sc[0] - 0.35 * Math.sin(x * 0.12)) / sc[1]) ** 6)) : 0);   // a wavy band across the terrain
  const surfY = (i, furrows, rd, sc) => {
    const x = base[3 * i], z = base[3 * i + 2];
    const right = 1 / (1 + Math.exp(-x * 1.4)), sk = scarK(x, z, sc);
    let y = (Y0[i] - F[i] * (0.2 + furrows * right) - P[i]) * (1 - sk) + sk * 0.35;
    if (rd) { const d2 = ((x - rd[0]) ** 2 + (z - rd[1]) ** 2) / (rd[2] * rd[2]); y += rd[3] * 1.6 * Math.exp(-d2); }
    return y;
  };
  return {
    group, mesh, pores,
    // scar: [z0, half-width] a smooth, pale band with no furrows, pores or hairs (none leaning in either; No. 003); scarGlow lifts it
    set({ tone = [0.58, 0.38, 0.26], furrows = 0.2, spot = 0, sheen = 0, redden = null, visible = true, scar = null, scarGlow = 0 } = {}) {
      group.visible = visible; if (!visible) return;
      film.material.opacity = 0.2 * sheen; film.visible = sheen > 0.01;
      const key = [tone, furrows, spot, redden, scar, scarGlow].map((v) => JSON.stringify(v)).join("|");
      if (key === last) return; last = key;
      const dark = tone.map((v) => v * 0.23), red = [0.72, 0.16, 0.14];
      for (let i = 0; i < pos.count; i++) {
        const x = base[3 * i], z = base[3 * i + 2], right = 1 / (1 + Math.exp(-x * 1.4));
        pos.setY(i, surfY(i, furrows, redden, scar)); const sk = scarK(x, z, scar);
        let rk = 0; if (redden) { const d2 = ((x - redden[0]) ** 2 + (z - redden[1]) ** 2) / (redden[2] * redden[2]); rk = redden[3] * Math.exp(-d2 * 0.6); }
        const k = K[i] * spot;
        for (let c = 0; c < 3; c++) {
          let v = (tone[c] + (dark[c] - tone[c]) * k) * (0.92 + 0.12 * N[i]) * (1 - 0.45 * F[i] * (0.4 + 0.6 * right * Math.min(1, furrows)));
          v = v + (red[c] - v) * Math.min(1, rk);
          const pale = [0.86, 0.72, 0.66][c] * (0.9 + 0.1 * tone[c] / 0.6) + 0.12 * scarGlow;   // scar tissue: paler, no pigment pattern
          cols[3 * i + c] = v + (pale - v) * sk;
        }
      }
      pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
      if (hairs && scar) { const dm = new THREE.Object3D(), mtx = new THREE.Matrix4(); pores.forEach(([px, pz], i) => { hairs.getMatrixAt(i, mtx); if (scarK(px, pz, [scar[0], scar[1] * 1.9]) > 0.3) { mtx.decompose(dm.position, dm.quaternion, dm.scale); dm.scale.set(0.0001, 0.0001, 0.0001); dm.updateMatrix(); hairs.setMatrixAt(i, dm.matrix); } }); hairs.instanceMatrix.needsUpdate = true; }
    },
    at: (x, z) => [x, 0.25, z],
  };
};
