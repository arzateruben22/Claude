// tan3d.js — Skin Sense S2 E4 ("What a tan really is") as a 3-D scene in the owner's art (shared base: w3d.js).
// Four sets, hard-cut between, every one always moving:
//   C  one big skin cell: pale membrane, mauve nucleus, a cap of brown granules; lilac light arrives and the cap takes it
//   M  a star-shaped pigment cell passes brown granules along its arms to the cells around it; after the light they gather into caps
//   R  a row of capped cells (some bigger caps than others): rays are absorbed and scattered over the caps; a membrane sensor wakes
//   P  two medium-tone patches side by side (the takeaway)
// Units ≈ 1 µm-ish, illustrated and not to scale. Pure function of t. create() returns { seek, anchor } for ss3.mjs.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, makeTube, NV, mkGlow, glowTex, key, T, AW, BH, BTOP } = W3;
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.4, ...o });
  const groups = { C: new THREE.Group(), M: new THREE.Group(), R: new THREE.Group(), P: new THREE.Group() }, CX = { C: 0, M: 60, R: 120, P: 180 };
  for (const k in groups) { groups[k].position.x = CX[k]; scene.add(groups[k]); }
  const memM = mat({ color: 0xf6d2c2, transparent: true, opacity: 0.26, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.4, depthWrite: false, envMapIntensity: 0.5, side: THREE.DoubleSide });
  const nucM = mat({ color: 0xcf7f9e, roughness: 0.55, emissive: 0x7a2c4a, emissiveIntensity: 0.25, clearcoat: 0.3 });
  const granM = mat({ color: 0x6a3a22, roughness: 0.4, clearcoat: 0.5 });
  const sphere = (r, w = 28, h = 18) => new THREE.SphereGeometry(r, w, h);

  // ── a cell batch: instanced membranes, nuclei and cap granules (one draw call each) ─────────────────────────
  const GN = 34;                                                                                   // granules per cell
  const batch = (group, cells) => {
    const n = cells.length, mem = new THREE.InstancedMesh(sphere(1), memM, n), nuc = new THREE.InstancedMesh(sphere(1), nucM, n), gr = new THREE.InstancedMesh(sphere(1, 10, 8), granM, n * GN);
    for (const m of [mem, nuc, gr]) { m.frustumCulled = false; group.add(m); } nuc.castShadow = true; gr.castShadow = true;
    const d = new THREE.Object3D(), slots = cells.map((c, i) => Array.from({ length: GN }, (_, g) => { const a = ((g % 17) / 16 - 0.5) * 2.3 + (hash(i * 7 + g) - 0.5) * 0.1, row = g < 17 ? 0 : 1; return { a, r: 1.18 + row * 0.12 + (hash(i * 3 + g) - 0.5) * 0.06, row, s: 0.05 + hash(g * 5 + i) * 0.04 }; }));
    return { cells, mem, nuc, gr, slots,
      update(cap, from, t) {   // cap(i) 0…1; from(i, g) → [x, y, z] where a granule starts before it gathers
        cells.forEach((c, i) => { const R = c.r;
          d.position.set(c.x, c.y, c.z); d.rotation.set(0, 0, 0); d.scale.set(R * 1.2, R * 0.98, R * 1.05); d.updateMatrix(); mem.setMatrixAt(i, d.matrix);
          d.position.set(c.x, c.y - R * 0.12, c.z); d.scale.setScalar(R * 0.46 * (1 + 0.015 * Math.sin(t * 1.3 + i))); d.updateMatrix(); nuc.setMatrixAt(i, d.matrix);
          const cp = cap(i), nr = R * 0.46;
          for (let g = 0; g < GN; g++) { const sl = slots[i][g], k = clamp(cp * 1.25 - hash(i + g * 1.7) * 0.25), tx = c.x + Math.sin(sl.a) * nr * sl.r * 1.12, ty = c.y - R * 0.12 + Math.cos(sl.a) * nr * sl.r * 1.12, tz = c.z + (hash(g * 3 + i) - 0.5) * nr * 0.6;
            const f = from(i, g), e = eio(k); d.position.set(lerp(f[0], tx, e), lerp(f[1], ty, e) + 0.08 * Math.sin(t * 2 + g + i) * (1 - e), lerp(f[2], tz, e)); d.scale.setScalar(sl.s * R * (k > 0.01 ? 1 : 0.001)); d.updateMatrix(); gr.setMatrixAt(i * GN + g, d.matrix); } });
        mem.instanceMatrix.needsUpdate = nuc.instanceMatrix.needsUpdate = gr.instanceMatrix.needsUpdate = true; } };
  };
  const backC = (g, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: 0xf6ede0 })); m.position.z = z; g.add(m); };
  const beamTex = (() => { const c = mkCanvas(32, 256), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(150,110,240,0)"); gr.addColorStop(0.25, "rgba(150,110,240,.75)"); gr.addColorStop(1, "rgba(170,130,245,.55)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 256); const h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = h; g.fillRect(0, 0, 32, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const rays = (group, n, spread, h, z = 0) => Array.from({ length: n }, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + hash(i * 3.3) * 0.8, h), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.userData = { x: (i / (n - 1) - 0.5) * spread + (hash(i * 7) - 0.5) * 0.8, ph: hash(i * 5.9) }; m.position.z = z + (hash(i * 9.1) - 0.5) * 1.5; group.add(m); return m; });
  const sparks = (group, n) => { const a = mkGlow(n, 0xcfb4ff); a.forEach((s) => group.add(s)); return a; };

  // ── set C: one big cell ──────────────────────────────────────────────────────────────────────────────────────
  backC(groups.C, -8);
  const cellC = batch(groups.C, [{ x: 0, y: 0, z: 0, r: 3.4 }, { x: -6, y: 0.8, z: -3, r: 3 }, { x: 6, y: -0.6, z: -3.5, r: 3.1 }, { x: -3, y: -3.8, z: -2, r: 2.6 }, { x: 4, y: 4.2, z: -2.5, r: 2.8 }]);
  const raysC = rays(groups.C, 5, 6, 12, 0.4), spC = sparks(groups.C, 22);
  // ── set M: the pigment cell and its neighbours ───────────────────────────────────────────────────────────────
  backC(groups.M, -9);
  const MEL = [0, -1.6, 0.4], targets = [[-4.6, 1.6, 0.3, 2.2], [-1.6, 3.6, -0.5, 2.1], [2.6, 3.4, 0.2, 2.3], [5.2, 0.6, 0.4, 2.1], [4.2, -3.4, 0.1, 2.2], [-4.4, -3.2, -0.2, 2.1], [0.6, 0.9, -2.6, 2.0]];
  const cellM = batch(groups.M, targets.map(([x, y, z, r]) => ({ x, y, z, r })));
  const mBody = new THREE.Mesh(sphere(1.25, 32, 20), mat({ color: 0xbd8a5a, roughness: 0.45, clearcoat: 0.5 })); mBody.position.set(...MEL); groups.M.add(mBody);
  const mNuc = new THREE.Mesh(sphere(0.55), nucM); mNuc.position.set(MEL[0], MEL[1], MEL[2] + 0.5); groups.M.add(mNuc);
  const arms = targets.slice(0, 6).map((tg, i) => { const a = new THREE.Vector3(...MEL), b = new THREE.Vector3(tg[0], tg[1] - 0.8, tg[2]), mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3((hash(i * 3) - 0.5) * 1.2, (hash(i * 5) - 0.5) * 1.2, 0.5)); const curve = new THREE.CatmullRomCurve3([a, mid, b]); const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.2, 10, false), mat({ color: 0xc89868, roughness: 0.45, clearcoat: 0.4 })); groups.M.add(mesh); return curve; });
  const travelers = new THREE.InstancedMesh(sphere(1, 10, 8), granM, 6 * 22); travelers.frustumCulled = false; groups.M.add(travelers);
  const raysM = rays(groups.M, 6, 11, 14, 0.8), spM = sparks(groups.M, 16);
  // ── set R: a row of capped cells and a sensor ────────────────────────────────────────────────────────────────
  backC(groups.R, -9);
  const rowCells = Array.from({ length: 9 }, (_, i) => ({ x: -12 + i * 3.1, y: (i % 2 ? 0.25 : -0.2), z: (hash(i * 3.1) - 0.5) * 0.8, r: 1.45 + hash(i * 5.7) * 0.2 })), capK = [1, 0.5, 0.9, 0.3, 1, 0.7, 0.4, 0.95, 0.6];
  const cellR = batch(groups.R, rowCells), rowBack = batch(groups.R, rowCells.map((c, i) => ({ x: c.x + 1.5, y: c.y + 2.4, z: -2.6, r: c.r * 1.05 })));
  const raysR = rays(groups.R, 14, 24, 11, 1.2), spR = sparks(groups.R, 36);
  const sens = Array.from({ length: 10 }, () => { const s = new THREE.Mesh(sphere(0.12, 10, 8), mat({ color: 0xffd9a8, emissive: 0xffb860, emissiveIntensity: 0, roughness: 0.3 })); groups.R.add(s); return s; });
  // ── set P: two medium patches ────────────────────────────────────────────────────────────────────────────────
  backC(groups.P, -8);
  const patchC = mkCanvas(512, 512), pg = patchC.getContext("2d"); { pg.fillStyle = "#bd7a52"; pg.fillRect(0, 0, 512, 512); for (let i = 0; i < 600; i++) { pg.strokeStyle = `rgba(120,70,40,${0.05 + rnd() * 0.1})`; const x = rnd() * 512, y = rnd() * 512, a = (rnd() < 0.5 ? 0.6 : -0.6) + (rnd() - 0.5) * 0.3, L = 10 + rnd() * 30; pg.beginPath(); pg.moveTo(x, y); pg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); pg.stroke(); } }
  const patchTex = tex(patchC, [2, 2]), patchMat = mat({ map: patchTex, bumpMap: patchTex, bumpScale: 1.2, roughness: 0.65, clearcoat: 0.1 });
  const patches = [-1, 1].map((sd) => { const m = new THREE.Mesh(new THREE.BoxGeometry(5, 6.5, 2.2, 24, 24, 4), patchMat); m.position.set(sd * 3.1, 0, 0); m.castShadow = m.receiveShadow = true; groups.P.add(m); return m; });
  patches.forEach((m) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const e = 1 - Math.pow(Math.abs(x) / 2.5, 6) * 0.35 - Math.pow(Math.abs(y) / 3.25, 6) * 0.35; p.setZ(i, z * 0.6 + z * 0.4 * e); } m.geometry.computeVertexNormals(); });

  // ── timeline ────────────────────────────────────────────────────────────────────────────────────────────────────
  const raysOn = (t) => Math.max(sm(seg(t, 0.4, 1.4)), sm(seg(t, 11, 12.4)) * (1 - sm(seg(t, 16.4, 17.2))), sm(seg(t, 18.2, 19.2)) * (1 - sm(seg(t, 45, 46))), sm(seg(t, 47, 48)) * (1 - sm(seg(t, 60, 61))));
  const setC = (t) => {
    const cap = (i) => (i === 0 ? clamp(0.3 + 0.7 * sm(seg(t, 0.2, 2.2))) : 0.9), on = raysOn(t);
    cellC.update(cap, (i, g) => [cellC.cells[i].x + Math.sin(g * 2.1) * 3, cellC.cells[i].y + Math.cos(g * 1.3) * 2.5, cellC.cells[i].z + 0.5], t);
    raysC.forEach((m, i) => { const U = m.userData, top = 3.0, h = 12; m.position.set(U.x, top + h / 2 - 0.2, m.position.z); m.scale.set(1 + 0.1 * Math.sin(t * 1.4 + i), 1, 1); m.material.opacity = 0.5 * on * (0.75 + 0.25 * Math.sin(t * 1.7 + U.ph * 6)); });
    spC.forEach((s, i) => { const k = ((t * 0.5 + hash(i * 1.9)) % 1), a = (hash(i * 3.3) - 0.5) * 2.6, r = 2.2 + k * 3.5; s.position.set(Math.sin(a) * r * 1.1, 1.0 + Math.cos(a) * r * 0.7, 1 + hash(i) ); s.scale.setScalar(0.45 * (1 - k)); s.material.opacity = 0.7 * on * Math.sin(Math.PI * k) * (t > 47 ? 0.45 : 1); });
  };
  const setM = (t) => {
    const grow = (i) => (i < 6 ? sm(seg(t, 11.6 + i * 0.35, 15.6 + i * 0.3)) : sm(seg(t, 13, 16.5)) * 0.8), on = raysOn(t);
    const armP = (i, g) => { const c = arms[i % 6], u = clamp(((t - 5.4) * 0.22 + g / 22) % 1); const p = c.getPoint(i < 6 ? u : 0.9); return [p.x, p.y, p.z]; };
    cellM.update(grow, (i, g) => { const c = arms[i % 6], p = c.getPoint(0.97 + (g % 3) * 0.01); return [p.x + (hash(g + i) - 0.5) * 0.5, p.y + (hash(g * 3 + i) - 0.5) * 0.4, p.z]; }, t);
    const d = new THREE.Object3D(); let q = 0;
    arms.forEach((c, i) => { for (let g = 0; g < 22; g++) { const u = (((t - 5.2) * 0.2 + g / 22) % 1 + 1) % 1, p = c.getPoint(u), vis = t > 5.2 && t < 12 ? 1 : 0.0; d.position.set(p.x + Math.sin(u * 9 + g) * 0.08, p.y, p.z + 0.1); d.scale.setScalar(vis ? 0.07 + hash(g * 7 + i) * 0.04 : 0.0001); d.updateMatrix(); travelers.setMatrixAt(q++, d.matrix); } }); travelers.instanceMatrix.needsUpdate = true;
    mBody.scale.setScalar(1 + 0.03 * Math.sin(t * 1.6)); mBody.rotation.y = t * 0.2;
    raysM.forEach((m, i) => { const U = m.userData; m.position.set(U.x, 7 - 0.2, m.position.z); m.material.opacity = 0.45 * on * (0.75 + 0.25 * Math.sin(t * 1.7 + U.ph * 6)); });
    spM.forEach((s, i) => { const k = ((t * 0.5 + hash(i * 1.9)) % 1), tg = targets[i % 6]; s.position.set(tg[0] + Math.sin(i * 2) * 2, tg[1] + 2 + k * 1.6, 1); s.scale.setScalar(0.4 * (1 - k)); s.material.opacity = 0.6 * on * Math.sin(Math.PI * k) * (t > 12 ? 1 : 0); });
  };
  const setR = (t) => {
    const on = raysOn(t), wake = sm(seg(t, 40, 43.4)) * (1 - sm(seg(t, 44.6, 45.6)));
    const capR = (i) => 0.25 + 0.75 * capK[i % 9] * (0.6 + 0.4 * sm(seg(t, 17.6, 20))) + 0.25 * wake * (i % 3 === 0 ? 1 : 0);
    cellR.update(capR, (i, g) => [cellR.cells[i].x + Math.sin(g * 2.1) * 2, cellR.cells[i].y + 1.8, cellR.cells[i].z], t); rowBack.update((i) => capK[i % 9] * 0.7 + 0.2, (i, g) => [rowBack.cells[i].x, rowBack.cells[i].y + 1.5, rowBack.cells[i].z], t);
    raysR.forEach((m, i) => { const U = m.userData; m.position.set(U.x, 5.5, m.position.z); m.material.opacity = 0.42 * on * (0.7 + 0.3 * Math.sin(t * 1.6 + U.ph * 6)); });
    spR.forEach((s, i) => { const k = ((t * 0.55 + hash(i * 1.9)) % 1), c = rowCells[i % 9]; const a = (hash(i * 3.3) - 0.5) * 2.4; s.position.set(c.x + Math.sin(a) * (1.6 + k * 2.6), c.y + 1.3 + Math.cos(a) * (0.6 + k * 1.8), 1.2); s.scale.setScalar(0.34 * (1 - k)); s.material.opacity = 0.65 * on * Math.sin(Math.PI * k) * (0.3 + 0.7 * capK[i % 9]); });
    sens.forEach((s, i) => { const c = rowCells[i % 9]; const a = Math.PI * 0.5 + (i % 2 ? 0.55 : -0.55); s.position.set(c.x + Math.cos(a) * c.r * 1.2, c.y + Math.sin(a) * c.r * 0.98, c.z + 0.3); s.material.emissiveIntensity = 2.2 * wake * (0.6 + 0.4 * Math.sin(t * 4 + i)); s.scale.setScalar(1 + 0.5 * wake); });
  };
  const setP = (t) => { patches.forEach((m, i) => { m.rotation.y = (i ? -0.3 : 0.3) + 0.22 * Math.sin(t * 0.8 + i * 2); m.rotation.x = 0.1 * Math.sin(t * 0.6 + i); m.position.y = 0.2 * Math.sin(t * 0.9 + i); }); };

  const V = new THREE.Vector3();
  const ANC = { cap: () => [CX.C, 2.2, 0.8], star: () => [CX.M, -1.6, 0.8], row: () => [CX.R - 2, 1.4, 0.8] };
  let curSc = "C";
  return {
    renderer,
    seek(t) {
      const c = T.coverCam ? { ...T.coverCam, roll: 0, sc: T.coverCam.sc || "C" } : W3.camAt(t); curSc = c.sc || "C"; for (const k in groups) groups[k].visible = k === curSc;
      W3.camPose(t, c);
      if (curSc === "C") setC(t); else if (curSc === "M") setM(t); else if (curSc === "R") setR(t); else setP(t);
      const cx = CX[curSc]; key.target.position.set(cx, 0, 0); key.position.set(cx - 9, 12, 11); key.target.updateMatrixWorld(); W3.paintSet(t);
      W3.render(c);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); V.set(p[0], p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
