// plug3d.js — Skin Sense Season 3, Episode 4 ("How one pore turns into a pimple"): the same soft voxel cut-away follicle as set/pore3d.js, seen from the inside only. Old cells that usually leave with the oil cling together, oil and cells pack
// into a plug, the doorway starts to close; the plug darkens where it stays open and stays pale under a closed lid; oil pools behind it and the pore swells; microbes feast; immune cells arrive along a groove and the tissue around the pore warms.
// No surface spots, no face: everything happens inside the cut-away. Base set/w3d.js, finish and look as episodes 1-3.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, mkGlow, key, rim, R } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.55; } });
  key.color.set(0xffe2c4); key.intensity = 2.2; key.position.set(-9, 14, 18); key.castShadow = false; rim.color.set(0xffc9a0); rim.intensity = 1.5; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.022);
  const S = (id, off = 0) => R(`start:${id}${off >= 0 ? "+" : ""}${off}`), E = (id, off = 0) => R(`end:${id}${off >= 0 ? "+" : ""}${off}`);
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, ...o });
  const cubeM = mat({ roughness: 0.5, envMapIntensity: 0.5 }); cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.3;"); };
  const D = new THREE.Object3D(), C1 = new THREE.Color(), C2 = new THREE.Color();

  // ── the block ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const GL = { x0: 2, x1: 7, y0: -8, y1: -3 };
  const inChannel = (x, y, z) => (x === -1 || x === 0) && y >= -9 && z >= -2;
  const inGland = (x, y, z) => x >= GL.x0 && x <= GL.x1 && y >= GL.y0 && y <= GL.y1 && z >= -1;
  const inDuct = (x, y, z) => z >= -1 && y === -5 && x >= 1 && x <= 2;
  const gy = (x) => -10 + (x + 8) * (7 / 6);                                                                                              // the vessel groove (front layer only), lower left up to the pore wall
  const inGroove = (x, y, z) => z === 0 && x >= -8 && x <= -2 && Math.abs(y - gy(x)) < 0.75;
  const topCol = new THREE.Color(0xb98466), midCol = new THREE.Color(0xc08a72), lowCol = new THREE.Color(0xcc9082), deepCol = new THREE.Color(0xd09a90);
  const colOf = (y) => (y >= -1 ? topCol : y >= -3 ? midCol : y >= -8 ? lowCol : deepCol);
  const cells = [], X0 = -10, X1 = 10, YB = -15;
  for (let x = X0; x <= X1; x++) for (let y = -1; y >= YB; y--) { const zmin = y >= -1 ? -7 : -2;
    for (let z = zmin; z <= 0; z++) { if (inChannel(x, y, z) || inGland(x, y, z) || inDuct(x, y, z) || inGroove(x, y, z)) continue;
      cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.06 + (z < 0 && y < -1 ? -0.03 * Math.min(3, -z) : 0)) }); } }
  const block = new THREE.InstancedMesh(rbox(0.97, 0.13, 4), cubeM, cells.length); block.frustumCulled = false;
  const near = []; cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.scale.set(1, 1, 1); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); if (c.y <= -1 && c.y >= -6 && Math.abs(c.x + 0.5) <= 4.5 && c.z >= -2) near.push(i); }); scene.add(block);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(21, 14.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1c0f0b) })); lining.position.set(0, -8.1, -3.6); scene.add(lining);
  const TN = []; for (let y = -1; y >= -9; y--) for (let k = 0; k < 9; k++) { const ph = (k / 8) * Math.PI, r = 1.18 + 0.06 * hash(y * 3 + k), dp = Math.min(1, (-y - 1) / 8);
    TN.push({ ph, r, y, c: new THREE.Color(0xb27562).lerp(new THREE.Color(0x6e3a2c), 0.25 + 0.55 * dp).offsetHSL(0, 0, (hash(k * 7 + y * 5) - 0.5) * 0.05) }); }
  const tunnel = new THREE.InstancedMesh(rbox(0.9, 0.14, 4), cubeM, TN.length); tunnel.frustumCulled = false; TN.forEach((c, i) => tunnel.setColorAt(i, c.c)); scene.add(tunnel);
  const deepGlow = mkGlow(1, 0xff9a55)[0]; deepGlow.scale.set(5, 9, 1); deepGlow.position.set(-0.5, -7.5, -1.8); deepGlow.material.opacity = 0.22; deepGlow.material.fog = false; scene.add(deepGlow);
  const warm = mkGlow(1, 0xff6a4a)[0]; warm.scale.set(11, 9, 1); warm.position.set(-0.8, -3.2, -2.6); warm.material.opacity = 0; warm.material.fog = false; scene.add(warm);

  // ── hair, gland (full of oil), duct ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const hairCurve = new THREE.CatmullRomCurve3([[-0.5, -8.2, -1.0], [-0.55, -6.0, -1.1], [-0.45, -3.5, -1.0], [-0.5, -1.0, -0.9], [-0.35, 1.0, -0.7], [0.1, 2.6, -0.5], [0.8, 3.9, -0.3]].map((p) => new THREE.Vector3(...p)));
  const hair = new THREE.Mesh(new THREE.TubeGeometry(hairCurve, 90, 0.15, 10, false), mat({ color: 0x241108, roughness: 0.22, metalness: 0.15, emissive: 0x4a2410, emissiveIntensity: 0.6 })); hair.frustumCulled = false; scene.add(hair);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat({ color: 0xd9b48c, roughness: 0.5, emissive: 0xff9a55, emissiveIntensity: 0.2 })); bulb.position.set(-0.5, -8.5, -1.0); bulb.scale.y = 1.2; scene.add(bulb);
  const lobeC = [[3.4, -4.4, -0.6], [5.0, -4.2, -0.8], [6.4, -4.8, -0.6], [3.8, -6.0, -0.5], [5.4, -6.0, -0.7], [6.6, -6.6, -0.6], [4.2, -7.3, -0.5], [5.8, -7.4, -0.6]];
  const lobeM = mat({ color: 0xe6c88e, roughness: 0.18, transparent: true, opacity: 0.2, emissive: 0xc88a30, emissiveIntensity: 0.4, depthWrite: false });
  lobeC.forEach(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.95 + 0.12 * hash(i), 22, 16), lobeM); m.position.set(x, y, z); scene.add(m); });
  const oilM = mat({ color: 0xf0a428, roughness: 0.18, emissive: 0xe07408, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 });
  const gO = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), oilM, 14 * lobeC.length); gO.frustumCulled = false; let gi = 0;
  lobeC.forEach(([x, y, z], i) => { for (let k = 0; k < 14; k++) { const a = hash(i * 31 + k * 7) * 6.28, b = Math.acos(2 * hash(i * 17 + k * 3) - 1), r = 0.55 * Math.cbrt(hash(i * 13 + k)), s = 0.34 + 0.1 * hash(i + k);
      D.position.set(x + r * Math.sin(b) * Math.cos(a), y + r * Math.sin(b) * Math.sin(a) * 0.9, z + r * Math.cos(b) * 0.7 + 0.05); D.scale.set(s, s, s); D.updateMatrix(); gO.setMatrixAt(gi++, D.matrix); } }); D.scale.set(1, 1, 1); scene.add(gO);
  const duct = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.8, -5.0, -0.9), new THREE.Vector3(1.8, -5.0, -0.9), new THREE.Vector3(0.6, -4.7, -0.9)]), 20, 0.2, 14, false), new THREE.MeshStandardMaterial({ color: 0xf0b848, roughness: 0.25, transparent: true, opacity: 0.9, emissive: 0xd88a22, emissiveIntensity: 0.4 })); scene.add(duct);

  // ── beads (sebum on the way up), old cells, the plug, the pool, microbes, immune cells ───────────────────────────────────────────────────────────────
  const sebPath = new THREE.CatmullRomCurve3([[3.0, -5.0, -0.4], [1.8, -4.95, -0.4], [0.8, -4.6, -0.5], [0.1, -3.6, -0.6], [0.0, -2.0, -0.6], [0.1, -0.6, -0.5], [0.3, 0.2, -0.3]].map((p) => new THREE.Vector3(...p)));
  const NB = 26, bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), oilM, NB); bead.frustumCulled = false; scene.add(bead);
  const NF = 16, flatM = mat({ color: 0xe9b8a4, roughness: 0.4, emissive: 0x8a4a3a, emissiveIntensity: 0.3 }), flat = new THREE.InstancedMesh(rbox(1, 0.2, 4), flatM, NF); flat.frustumCulled = false; scene.add(flat);
  const pm = new THREE.Vector3(), NPL = 64, plugG = new THREE.SphereGeometry(0.5, 12, 10), plugM = mat({ color: 0xffffff, roughness: 0.3, emissive: 0x6a4a20, emissiveIntensity: 0.3 }), plug = new THREE.InstancedMesh(plugG, plugM, NPL); plug.frustumCulled = false; scene.add(plug);
  const plugSlot = Array.from({ length: NPL }, (_, i) => ({ x: -1.05 + 1.1 * hash(i * 3.1), y: -2.3 + 1.8 * hash(i * 5.7), z: -1.5 + 1.1 * hash(i * 7.9), s: 0.26 + 0.18 * hash(i * 2.3), th: hash(i * 9.1) }));
  const NPO = 12, drpM = mat({ color: 0xf6c35a, roughness: 0.12, emissive: 0xe08a18, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), pool = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), drpM, NPO); pool.frustumCulled = false; scene.add(pool);
  const poolSlot = Array.from({ length: NPO }, (_, i) => ({ a: 0.4 + 2.4 * hash(i * 4.3), u: hash(i * 6.1), s: 0.1 + 0.09 * hash(i * 1.9), th: hash(i * 5.5) }));
  const LQ0 = -3.9, LQH = 1.8, liqG = new THREE.CylinderGeometry(1, 1, 1, 28, 18, false), liqBase = liqG.attributes.position.array.slice(), liqM = mat({ color: 0xf2b84a, roughness: 0.1, emissive: 0xd88a22, emissiveIntensity: 0.4, transparent: true, opacity: 0.6, depthWrite: false }), liquid = new THREE.Mesh(liqG, liqM); liquid.frustumCulled = false; scene.add(liquid);
  const NM = 34, micM = mat({ color: 0xbff2e8, roughness: 0.35, emissive: 0x3fbfae, emissiveIntensity: 0.55 }), mic = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), micM, NM); mic.frustumCulled = false; scene.add(mic);
  const NI = 14, imM = mat({ color: 0xe6f6f2, roughness: 0.3, emissive: 0x3fbfae, emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }), imm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 16, 12), imM, NI); imm.frustumCulled = false; scene.add(imm);
  const nucM = mat({ color: 0x8a7ab8, roughness: 0.4, emissive: 0x5a4a98, emissiveIntensity: 0.4, transparent: true, opacity: 0.55 }), nuc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), nucM, NI); nuc.frustumCulled = false; scene.add(nuc);
  const lipM = mat({ color: 0xb98466, roughness: 0.5, emissive: 0x3a2014, emissiveIntensity: 0.3 }), lips = [0, 1, 2].map(() => { const m = new THREE.Mesh(rbox(1, 0.16, 4), lipM); scene.add(m); return m; });
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.material.fog = false; s.userData = { x: -10 + hash(i * 3.3) * 20, y: -14 + hash(i * 5.9) * 17, z: -hash(i * 7.1) * 6 + 3, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });

  const imPath = (i, u) => { const x = lerp(-7.6, -2.4 - 0.7 * hash(i * 3), u), y0 = gy(-7.6) + 0.15 * Math.sin(i), y1 = gy(-2.4); return [x, lerp(y0, y1, u) + 0.12 * Math.sin(u * 9 + i), -0.1]; };

  // ── camera keys ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const CK = [[0, [-3.5, 3.5, 10.5], [-0.3, -1.0, -1.5], 32], [S("vo01", 3.0), [-1.2, -0.6, 9.5], [-0.4, -3.0, -0.8], 32], [S("vo02", 0), [-0.6, -2.8, 9.0], [-0.3, -2.6, -0.8], 31], [E("vo02", 0), [-0.3, -1.8, 8.8], [-0.3, -1.6, -0.8], 30],
    [S("vo03", 0.5), [-0.4, -1.6, 8.2], [-0.4, -1.4, -0.8], 30], [S("vo04", 1.5), [-0.4, -1.3, 7.8], [-0.4, -1.2, -0.9], 30], [E("vo04", 0), [-0.2, -0.6, 8.0], [-0.3, -0.9, -1.0], 30], [S("vo05", 3.0), [0.2, 1.2, 8.6], [-0.3, -0.6, -1.0], 30],
    [E("vo05", 0), [0.0, 1.0, 8.8], [-0.3, -0.7, -1.0], 30], [E("vo06", 0), [-0.2, -0.2, 9.8], [-0.3, -1.4, -1.0], 31], [S("vo07", 1.0), [-0.8, -2.8, 10.5], [-0.4, -3.0, -0.8], 31], [E("vo07", 0), [-1.0, -3.2, 10.8], [-0.5, -3.2, -0.8], 31],
    [S("vo08", 0.5), [-1.2, -3.6, 9.0], [-0.6, -3.7, -0.8], 30], [S("vo09", 0), [-3.0, -4.4, 11.5], [-2.4, -4.4, -0.6], 31], [E("vo09", 0), [-1.8, -3.2, 12.6], [-0.8, -3.2, -0.8], 32], [S("vo10", 0), [-0.8, -1.8, 15], [-0.5, -2.8, -0.8], 32],
    [S("vo10", 5.0), [-0.3, 0.4, 25], [-0.3, -3.0, -0.8], 32], [E("vo10", 0), [-0.3, 0.6, 26], [-0.3, -3.0, -0.8], 32], [E("vo11", 20), [-0.2, 0.8, 26.5], [-0.3, -3.0, -0.8], 32]];
  const keyed = (i, t) => { let k = 0; while (k < CK.length - 2 && t >= CK[k + 1][0]) k++; const a = CK[k], b = CK[k + 1], e = sm(seg(t, a[0], b[0])); return a[i] instanceof Array ? a[i].map((v, j) => lerp(v, b[i][j], e)) : lerp(a[i], b[i], e); };
  const pt = new THREE.Vector3(), plugCol = new THREE.Color(), pale = new THREE.Color(0xeed6a2), amber = new THREE.Color(0xf0b448), dark = new THREE.Color(0x1c110c);
  let lastRd = -1;

  return {
    renderer,
    seek(t) {
      const cam = { pos: keyed(1, t), look: keyed(2, t), fov: keyed(3, t), roll: 0, sc: "S" }; cam.pos[0] += 0.5 * Math.sin(t * 0.21); cam.pos[1] += 0.25 * Math.sin(t * 0.17 + 1); W3.camPose(t, cam);
      const f2 = sm(seg(t, S("vo02", 0.2), E("vo02", 0.8))), f3 = sm(seg(t, S("vo03", 0.3), E("vo03", 0.2))), pg = sm(seg(t, S("vo04", 0.5), E("vo04", -0.2))), dk = clamp(sm(seg(t, S("vo05", 3.0), S("vo05", 6.5))) * (1 - sm(seg(t, S("vo06", 0.4), E("vo06", -0.4)))) + 0.9 * sm(seg(t, S("vo10", 3.0), S("vo10", 6.0))));
      const lidC = 0.55 * sm(seg(t, S("vo04", 2.0), E("vo04", 0))) + 0.45 * sm(seg(t, S("vo06", 0.2), E("vo06", -0.3))) - 0.9 * sm(seg(t, S("vo10", 0.8), S("vo10", 4.0)));
      const pl = sm(seg(t, S("vo07", 0.5), E("vo07", -0.5))), sw = sm(seg(t, S("vo07", 1.0), E("vo07", 2.0))), mv = sm(seg(t, E("vo07", 0.5), S("vo08", 1.6))), imA = sm(seg(t, S("vo09", 0.3), E("vo09", -0.5))), rd = sm(seg(t, S("vo08", 2.0), E("vo09", 1.5))) * (1 - 0.4 * sm(seg(t, S("vo10", 4), E("vo10", 0))));
      // swelling: the tunnel widens and the cells beside it are pushed out; warmth spreads around it
      const wf = (y) => Math.exp(-(((y + 2.8) / 2.4) ** 2));
      TN.forEach((c, i) => { const r = c.r * (1 + 0.8 * sw * wf(c.y)); D.position.set(-0.5 + r * Math.cos(c.ph), c.y, -1 - r * Math.sin(c.ph)); D.rotation.set(0, Math.atan2(r * Math.cos(c.ph), r * Math.sin(c.ph)), 0); D.scale.set(0.85, 1, 0.85); D.updateMatrix(); tunnel.setMatrixAt(i, D.matrix); });
      D.rotation.set(0, 0, 0); tunnel.instanceMatrix.needsUpdate = true;
      near.forEach((i) => { const c = cells[i], dx = Math.sign(c.x + 0.5) * 1.7 * sw * wf(c.y) * Math.exp(-Math.abs(c.x + 0.5) / 7); D.position.set(c.x + dx, c.y, c.z); D.scale.set(1, 1, 1); D.updateMatrix(); block.setMatrixAt(i, D.matrix); });
      block.instanceMatrix.needsUpdate = true;
      if (Math.abs(rd - lastRd) > 0.002) { lastRd = rd; C2.set(0xe2837c); near.forEach((i) => { const c = cells[i], k = rd * 0.8 * Math.exp(-(((c.x + 0.5) / 5) ** 2 + ((c.y + 3) / 3.6) ** 2)); C1.copy(c.c).lerp(C2, k); block.setColorAt(i, C1); }); if (block.instanceColor) block.instanceColor.needsUpdate = true; }
      warm.material.opacity = 0.28 * rd; warm.scale.set(13, 10, 1);
      // beads on their way up (first the usual flow, later the stream that pools behind the plug)
      const flowA = sm(seg(t, S("vo01", 1.0), S("vo01", 3.0))) * (1 - sm(seg(t, S("vo03", 0.5), S("vo03", 2.0)))), flowB = sm(seg(t, S("vo07", 0.0), S("vo07", 1.5))), umax = t < S("vo05") ? 1 : 0.6;
      for (let i = 0; i < NB; i++) { const k = ((t - 1) * 0.1 + i / NB) % 1, u = clamp((k + 1) % 1) * umax, vis = (t < S("vo05") ? flowA : flowB) * Math.min(1, u * 8) * Math.min(1, (1 - u / umax) * 6); sebPath.getPoint(u, pt); D.position.set(pt.x + 0.12 * Math.sin(i * 2.3 + t), pt.y, pt.z + 0.12 * Math.cos(i * 1.7)); const sz = 0.2 * vis * (0.8 + 0.4 * hash(i)); D.scale.set(sz, sz, sz); D.updateMatrix(); bead.setMatrixAt(i, D.matrix); }
      bead.instanceMatrix.needsUpdate = true;
      // old cells: they rise with the oil, then cling together and stay in the plug
      for (let i = 0; i < NF; i++) { const u0 = 0.15 + 0.55 * hash(i * 3.7), u = lerp(u0, 0.82, f2) , a = (u0 < 0.5 ? 1 : 1); sebPath.getPoint(clamp(u), pt); const slot = plugSlot[(i * 3) % NPL], x = lerp(pt.x + 0.18 * Math.sin(i * 2.1), slot.x, f3), y = lerp(pt.y, slot.y + 0.2, f3), z = lerp(pt.z + 0.15 * Math.cos(i), slot.z, f3), vis = sm(seg(t, S("vo01", 4.0) + hash(i) * 3, S("vo01", 6.0) + hash(i) * 3));
        D.position.set(x, y, z); D.rotation.set(0.4 * Math.sin(i + t * 0.7) * (1 - f3), 0.5 * i, 0.5 * Math.sin(i * 1.3) * (1 - 0.6 * f3)); const sc = 0.5 * vis; D.scale.set(sc, sc * 0.28, sc * 0.8); D.updateMatrix(); flat.setMatrixAt(i, D.matrix); } D.rotation.set(0, 0, 0); flat.instanceMatrix.needsUpdate = true;
      // the plug packs together; the part near the open top darkens
      for (let i = 0; i < NPL; i++) { const p = plugSlot[i], g = sm(seg(pg * 1.2 - p.th * 0.2, 0, 0.6)), top = clamp((p.y + 1.6) / 1.1); D.position.set(p.x + 0.03 * Math.sin(t * 0.9 + i), p.y, p.z); const s = p.s * g * (1 + 0.04 * Math.sin(t * 1.1 + i)); D.scale.set(s * 1.15, s * 0.85, s); D.updateMatrix(); plug.setMatrixAt(i, D.matrix);
        plugCol.copy(pale).lerp(amber, p.th * 0.45).lerp(dark, clamp(dk * (0.35 + 0.65 * top))); plug.setColorAt(i, plugCol); } D.scale.set(1, 1, 1); plug.instanceMatrix.needsUpdate = true; if (plug.instanceColor) plug.instanceColor.needsUpdate = true; plugM.emissiveIntensity = 0.3 * (1 - 0.7 * dk);
      { const lv = Math.max(0.001, pl), pa = liqG.attributes.position, h = LQH * lv; liquid.position.set(-0.5, LQ0 + h / 2, -1); liquid.scale.set(1, 1, 1); liquid.visible = pl > 0.01;
        for (let i = 0; i < pa.count; i++) { const by = liqBase[i * 3 + 1], yw = LQ0 + (by + 0.5) * h, r = 0.9 * (1 + 0.8 * sw * wf(yw)) * (1 - 0.55 * Math.pow(Math.max(0, Math.abs(by) - 0.28) / 0.22, 2)) * (1 + 0.02 * Math.sin(t * 1.4 + by * 9 + liqBase[i * 3] * 4));
          pa.setXYZ(i, liqBase[i * 3] * r, by * h, liqBase[i * 3 + 2] * r); } pa.needsUpdate = true; liqG.computeVertexNormals(); liqG.computeBoundingSphere(); liqM.emissiveIntensity = 0.35 + 0.1 * Math.sin(t * 1.1); }
      for (let i = 0; i < NPO; i++) { const p = poolSlot[i], g = sm(seg(pl * 1.3 - p.th * 0.3, 0, 0.6)), yw = LQ0 + LQH * (0.1 + 0.85 * p.u) * Math.max(0.001, pl), r = 0.9 * (1 + 0.8 * sw * wf(yw)) + 0.06, s = p.s * g; D.position.set(-0.5 + r * Math.cos(p.a + 3.14) * 1.0, yw, -1 - r * Math.sin(p.a) * 0.9); D.scale.set(s, s, s); D.updateMatrix(); pool.setMatrixAt(i, D.matrix); } pool.instanceMatrix.needsUpdate = true;
      // microbes at the pool, feasting
      for (let i = 0; i < NM; i++) { const y = -3.7 + 1.7 * hash(i * 3.1), side = i % 2 ? 1 : -1, x = (side > 0 ? 0.55 : -1.55) * (1 + 0.2 * sw) + 0.2 * hash(i * 7.7) + 0.08 * Math.sin(t * 1.6 + i * 2.1), z = -1.3 + 0.7 * hash(i * 9.3) + 0.06 * Math.cos(t * 1.3 + i), pulse = 1 + 0.2 * Math.sin(t * 3.2 + i * 1.7) * mv, sz = 0.2 * mv * pulse;
        D.position.set(x, y + 0.06 * Math.sin(t * 1.1 + i), z); D.rotation.set(0, 0, 0.6 * Math.sin(i)); D.scale.set(sz * 1.5, sz, sz); D.updateMatrix(); mic.setMatrixAt(i, D.matrix); } D.rotation.set(0, 0, 0); mic.instanceMatrix.needsUpdate = true; micM.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 2.2);
      // immune cells travel the groove and gather at the pore wall
      for (let i = 0; i < NI; i++) { const u = clamp(imA * 1.3 - hash(i * 2.9) * 0.3), q = imPath(i, u), vis = sm(seg(u, 0, 0.08)), sz = 0.62 * vis * (1 + 0.04 * Math.sin(t * 2 + i));
        D.position.set(q[0] + (u > 0.9 ? 0.0 : 0), q[1] + (u > 0.98 ? 0.0 : 0), q[2] + 0.0); D.scale.set(sz, sz, sz); D.updateMatrix(); imm.setMatrixAt(i, D.matrix); D.position.set(q[0] + 0.1 * sz, q[1] + 0.06 * sz, q[2] + 0.12); D.scale.set(sz * 0.5, sz * 0.5, sz * 0.5); D.updateMatrix(); nuc.setMatrixAt(i, D.matrix); } D.scale.set(1, 1, 1); imm.instanceMatrix.needsUpdate = nuc.instanceMatrix.needsUpdate = true;
      // the doorway closing: lips slide in from both sides, a cap follows
      const c = clamp(lidC); lips[0].position.set(lerp(-2.7, -0.95, c), -0.75, -0.9); lips[0].scale.set(1.6, 0.5, 2.2); lips[1].position.set(lerp(2.2, 0.5, c), -0.75, -0.9); lips[1].scale.set(1.6, 0.5, 2.2);
      lips[2].position.set(-0.25, lerp(-0.2, -0.72, sm(seg(c, 0.8, 1))), -0.9); lips[2].scale.setScalar(0.001 + 0.9 * sm(seg(c, 0.75, 1))); lips[2].scale.y *= 0.55;
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.2 + 0.15 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(cam.look[0], cam.look[1], 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(cam);
    },
    anchor() { return null; },
  };
}
