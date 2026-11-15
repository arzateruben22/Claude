// collagen3d.js — Skin Sense Season 3, Episode 6 ("Your skin is still healing after it looks healed"): the soft voxel cut-away skin with a small clean gap (a notch) that seals, is cleaned by pale-teal cells,
// roofed by new cells creeping in from the edges, then filled by repair cells and a messy scaffold of fresh collagen fibres that over months is drawn into line and finally re-woven (warp and weft).
// The film opens on the payoff (the woven fibres, moving) and rewinds into the story. No red, no wound imagery: a pale amber seal, soft teal-white cells, cream fibres. Base set/w3d.js, look as episodes 1-5.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, mkGlow, key, rim, R } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.55; } });
  key.color.set(0xffe2c4); key.intensity = 2.2; key.position.set(-9, 14, 18); key.castShadow = false; rim.color.set(0xffc9a0); rim.intensity = 1.5; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.02);
  const S = (id, off = 0) => R(`start:${id}${off >= 0 ? "+" : ""}${off}`), E = (id, off = 0) => R(`end:${id}${off >= 0 ? "+" : ""}${off}`);
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, ...o });
  const cubeM = mat({ roughness: 0.5, envMapIntensity: 0.5 }); cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.3;"); };
  const D = new THREE.Object3D(), C1 = new THREE.Color();

  // ── the block with a gap (x -2..1, y -1..-4 removed, every depth) ────────────────────────────────────────────────────────────────────────────────────
  const GX0 = -2, GX1 = 1, GY = -4, inGap = (x, y, z) => x >= GX0 && x <= GX1 && y >= GY && (y === -1 || z >= -2);
  const topCol = new THREE.Color(0xb98466), midCol = new THREE.Color(0xc08a72), lowCol = new THREE.Color(0xcc9082), deepCol = new THREE.Color(0xd09a90);
  const colOf = (y) => (y >= -1 ? topCol : y >= -3 ? midCol : y >= -8 ? lowCol : deepCol);
  const cells = [];
  for (let x = -10; x <= 10; x++) for (let y = -1; y >= -15; y--) { const zmin = y >= -1 ? -7 : -2;
    for (let z = zmin; z <= 0; z++) { if (inGap(x, y, z)) continue; cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.06 + (z < 0 && y < -1 ? -0.03 * Math.min(3, -z) : 0)) }); } }
  for (let x = GX0; x <= GX1; x++) for (let y = -2; y >= GY; y--) for (let z = -3; z >= -4; z--) cells.push({ x, y, z, c: lowCol.clone().offsetHSL(0, 0, -0.07 - 0.03 * (-z - 3) + (hash(x * 5 + y * 9 + z) - 0.5) * 0.05) });     // the back wall of the gap, in the same rounded cells
  const block = new THREE.InstancedMesh(rbox(0.97, 0.13, 4), cubeM, cells.length); block.frustumCulled = false;
  cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); }); scene.add(block);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(21, 14.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1c0f0b) })); lining.position.set(0, -8.1, -3.6); scene.add(lining);
  const warm = mkGlow(1, 0xff9a55)[0]; warm.scale.set(36, 10, 1); warm.position.set(0, -7.5, -2.4); warm.material.opacity = 0.12; warm.material.fog = false; scene.add(warm);

  // ── the seal (pale amber slab of rounded cells in the gap), new surface cells, cleaning cells, repair cells, fibres ────────────────────────────────────
  const seal = []; for (let x = GX0; x <= GX1; x++) for (let y = -1; y >= GY; y--) for (let z = -2; z <= 0; z++) if (y !== -1 || true) seal.push({ x, y, z, th: hash(x * 5 + y * 11 + z * 3) });
  const sealM = mat({ color: 0xe9c48c, roughness: 0.3, emissive: 0xc88a30, emissiveIntensity: 0.35, transparent: true, opacity: 0.6, depthWrite: false }), sealI = new THREE.InstancedMesh(rbox(0.94, 0.14, 3), sealM, seal.length); sealI.frustumCulled = false; scene.add(sealI);
  const topC = []; for (let x = GX0; x <= GX1; x++) for (let z = 0; z >= -7; z--) topC.push({ x, z, th: hash(x * 9 + z * 5), e: x <= -1 ? -1 : 1 });
  const newM = mat({ color: 0xffffff, roughness: 0.5, emissive: 0x4a2a1a, emissiveIntensity: 0.2 }), newI = new THREE.InstancedMesh(rbox(0.97, 0.13, 3), newM, topC.length); newI.frustumCulled = false; scene.add(newI);
  const NI = 12, crewM = mat({ color: 0xe6f6f2, roughness: 0.3, emissive: 0x3fbfae, emissiveIntensity: 0.4, transparent: true, opacity: 0.92 }), crew = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 16, 12), crewM, NI); crew.frustumCulled = false; scene.add(crew);
  const NR = 10, repM = mat({ color: 0xb7efe3, roughness: 0.3, emissive: 0x3fbfae, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }), rep = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), repM, NR); rep.frustumCulled = false; scene.add(rep);
  // fibres: 120 loose rods (messy -> aligned) and a woven lattice (warp and weft in short segments)
  const NF = 120, fibM = mat({ color: 0xe8d2a8, roughness: 0.35, emissive: 0xa87a3c, emissiveIntensity: 0.22 }), fib = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1), fibM, NF); fib.frustumCulled = false; scene.add(fib);
  const fibS = Array.from({ length: NF }, (_, i) => ({ x: GX0 - 0.2 + (GX1 - GX0 + 0.4) * hash(i * 3.7), y: -1.2 + (GY + 0.3 + 1.2) * hash(i * 5.3), z: -1.9 + 1.7 * hash(i * 7.1), a: hash(i * 2.9) * 6.28, b: (hash(i * 4.1) - 0.5) * 1.6, len: 0.9 + 0.9 * hash(i * 8.3), th: hash(i * 1.7) }));
  const WN = 6, WS = 9, wov = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1), mat({ color: 0xeedcb4, roughness: 0.3, emissive: 0xb88a44, emissiveIntensity: 0.25 }), 2 * WN * WS); wov.frustumCulled = false; scene.add(wov);
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.material.fog = false; s.userData = { x: -12 + hash(i * 3.3) * 24, y: -14 + hash(i * 5.9) * 20, z: -hash(i * 7.1) * 6 + 3, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });

  const CK = [[0, [0.2, -2.3, 7.8], [-0.4, -2.5, -1.2], 30], [S("vo01", 3.2), [-1.5, 1.2, 11.0], [-0.4, -2.3, -1.0], 31], [S("vo02", 0.5), [-0.6, 0.6, 15.0], [-0.4, -2.3, -1.0], 31], [E("vo02", 0), [-0.4, -0.2, 13.0], [-0.4, -2.3, -1.0], 31],
    [S("vo03", 0.5), [-0.5, -3.4, 12.0], [-0.4, -3.2, -1.0], 31], [S("vo04", 0.5), [-0.5, -3.0, 11.0], [-0.4, -2.8, -1.0], 31], [S("vo05", 0.5), [-0.4, -2.6, 10.0], [-0.4, -2.6, -1.0], 30], [S("vo06", 0.0), [-0.4, -2.6, 6.8], [-0.4, -2.6, -1.2], 30],
    [E("vo06", 0), [-0.4, -2.4, 8.0], [-0.4, -2.5, -1.2], 30], [S("vo08", 0.5), [-0.4, -1.4, 10.0], [-0.4, -2.2, -1.0], 31], [E("vo08", 0), [-0.4, -0.8, 12.0], [-0.4, -2.2, -1.0], 31], [S("vo10", 0.0), [-0.4, -0.2, 16.0], [-0.4, -2.2, -1.0], 32], [E("vo11", 20), [0.0, 0.6, 22.0], [-0.2, -2.4, -1.0], 33]];
  const keyed = (i, t) => { let k = 0; while (k < CK.length - 2 && t >= CK[k + 1][0]) k++; const a = CK[k], b = CK[k + 1], e = sm(seg(t, a[0], b[0])); return a[i] instanceof Array ? a[i].map((v, j) => lerp(v, b[i][j], e)) : lerp(a[i], b[i], e); };
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), pale = new THREE.Color(0xe6c0a4);
  const rod = (m, i, x, y, z, dx, dy, dz, r, len) => { V.set(dx, dy, dz).normalize(); Q.setFromUnitVectors(UP, V); D.position.set(x, y, z); D.quaternion.copy(Q); D.scale.set(r, len, r); D.updateMatrix(); m.setMatrixAt(i, D.matrix); D.quaternion.identity(); };

  return {
    renderer,
    seek(t) {
      const cam = { pos: keyed(1, t), look: keyed(2, t), fov: keyed(3, t), roll: 0, sc: "S" }; cam.pos[0] += 0.5 * Math.sin(t * 0.21); cam.pos[1] += 0.25 * Math.sin(t * 0.17 + 1); W3.camPose(t, cam);
      const tz = 1 - sm(seg(t, 1.6, S("vo01", 3.6)));                                                                           // v2 opening: start on the woven payoff and rewind into the story
      const sealP = sm(seg(t, S("vo04", 0.3), E("vo04", 0.2))) * (1 - sm(seg(t, S("vo06", 0.5), E("vo07", -2)))) * (1 - tz), crewP = sm(seg(t, S("vo04", 1.0), S("vo04", 2.5))) * (1 - sm(seg(t, S("vo06", 0), E("vo06", 0))));
      const newP = Math.max(tz, sm(seg(t, S("vo05", 0.5), E("vo05", 0))));
      const repP = sm(seg(t, S("vo05", 1.0), S("vo05", 3.0))) * (1 - sm(seg(t, S("vo07", 1.0), E("vo07", 0)))) * (1 - tz);
      const mess = Math.max(tz, sm(seg(t, S("vo05", 1.5), E("vo06", 0))) * 0.85), aln = Math.max(tz, sm(seg(t, S("vo07", 2.0), E("vo08", -1.0)))), wv = Math.max(tz, sm(seg(t, S("vo09", 0.0), E("vo10", -2.0)))), pal = sm(seg(t, S("vo08", 2.0), E("vo08", 0)));
      // the seal
      seal.forEach((c, i) => { const g = sm(clamp(sealP * 1.4 - (1 - (-c.y - 0.5) / 4) * 0.4 - c.th * 0.2)), s = g; D.position.set(c.x, c.y, c.z); D.scale.set(s, s, s); D.updateMatrix(); sealI.setMatrixAt(i, D.matrix); }); D.scale.set(1, 1, 1); sealI.instanceMatrix.needsUpdate = true;
      // new surface cells creep in from both edges, then go a little paler (healed spots are paler)
      topC.forEach((c, i) => { const g = sm(clamp(newP * 1.3 - c.th * 0.3)), x0 = c.e < 0 ? GX0 - 1 : GX1 + 1, x = lerp(x0, c.x, g); D.position.set(x, -1, c.z); D.scale.set(g, g, g); D.updateMatrix(); newI.setMatrixAt(i, D.matrix);
        C1.copy(topCol).offsetHSL(0, 0, 0.02 * (c.th - 0.5)).lerp(pale, 0.55 * pal); newI.setColorAt(i, C1); }); D.scale.set(1, 1, 1); newI.instanceMatrix.needsUpdate = true; if (newI.instanceColor) newI.instanceColor.needsUpdate = true;
      // cleaning crews wander through the sealed gap
      for (let i = 0; i < NI; i++) { const a = t * (0.5 + 0.2 * hash(i)) + i * 1.9, x = -0.5 + 1.2 * Math.sin(a) + 0.3 * Math.sin(a * 2.3 + i), y = -2.6 + 1.2 * Math.sin(a * 0.8 + i * 2.1), z = -1.0 + 0.5 * Math.cos(a * 1.3 + i), s = 0.46 * crewP * (1 + 0.05 * Math.sin(t * 2 + i));
        D.position.set(x, y, z); D.scale.set(s, s, s); D.updateMatrix(); crew.setMatrixAt(i, D.matrix); } D.scale.set(1, 1, 1); crew.instanceMatrix.needsUpdate = true;
      // repair cells: spindle shaped, drifting slowly along the fibres
      for (let i = 0; i < NR; i++) { const a = t * 0.18 + i * 2.1, x = -0.5 + 1.3 * Math.sin(a + i), y = -2.5 + 1.0 * Math.sin(a * 1.3 + i * 1.7), z = -1.1 + 0.6 * Math.cos(a * 0.9 + i), s = repP;
        V.set(Math.cos(a + i), 0.3 * Math.sin(a), 0.2).normalize(); Q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), V); D.position.set(x, y, z); D.quaternion.copy(Q); D.scale.set(0.95 * s, 0.24 * s, 0.24 * s); D.updateMatrix(); rep.setMatrixAt(i, D.matrix); D.quaternion.identity(); } D.scale.set(1, 1, 1); rep.instanceMatrix.needsUpdate = true;
      // loose fibres: random angles at first (the scaffold), then drawn into parallel lines
      fibS.forEach((f, i) => { const g = sm(clamp(mess * 1.4 - f.th * 0.4)), ang = lerp(f.a, f.b * 0.35, aln), dxy = [Math.cos(ang), Math.sin(ang) * 0.6, 0.35 * Math.sin(f.a * 3) * (1 - aln)], yy = lerp(f.y, -1.3 - ((i % 9) + 0.5) * 0.3, aln), x = lerp(f.x, GX0 - 0.2 + (GX1 - GX0 + 0.4) * (((i * 7) % 12) / 12), aln * 0.4), r = lerp(0.04, 0.075, aln) * g, len = lerp(f.len, 2.2, aln) * g;
        rod(fib, i, x, yy, lerp(f.z, -0.6 - (i % 3) * 0.45, aln), dxy[0], dxy[1], dxy[2], r, Math.max(0.001, len)); });
      fib.instanceMatrix.needsUpdate = true; fibM.opacity = 1;
      // the re-woven lattice: warp (x) and weft (y) in short segments, over and under
      let wi = 0; for (let j = 0; j < WN; j++) for (let k = 0; k < WS; k++) { const g = sm(clamp(wv * 1.4 - (j / WN) * 0.3 - (k / WS) * 0.2)), over = (j + k) % 2 ? 1 : -1, y0 = -1.4 - j * 0.5, x0 = GX0 - 0.2 + k * 0.5, sway = 0.03 * Math.sin(t * 0.9 + j + k);
          rod(wov, wi++, x0 + 0.25, y0 + sway, -1.0 + 0.16 * over, 1, 0, 0, 0.07 * g, 0.5 * g + 0.001); rod(wov, wi++, GX0 + 0.2 + j * 0.62 + sway, -1.2 - k * 0.38, -1.0 - 0.16 * over, 0, 1, 0, 0.07 * g, 0.42 * g + 0.001); }
      wov.instanceMatrix.needsUpdate = true; fibM.emissiveIntensity = 0.2 + 0.06 * Math.sin(t * 0.8);
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.2 + 0.15 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(cam.look[0], cam.look[1], 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(cam);
    },
    anchor() { return null; },
  };
}
