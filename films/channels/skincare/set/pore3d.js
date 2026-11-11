// pore3d.js — Skin Sense Season 3, Episode 3 ("What is actually inside a pore?"): a soft voxel cut-away of the skin with a hair follicle running down its middle. The camera starts over the surface (the pore is a small
// dark opening), drops into the tunnel past the hair, finds the oil gland, watches its cells fill with oil and break down, follows the sebum up along the hair and out over the surface, meets the microbes feeding on it,
// pulls wide to show doorway, hair, gland and residents, and ends at the mouth as the doorway starts to close. Look and finish as episodes 1-2 (set/shiver3d.js, set/cells3d.js): base set/w3d.js.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, mkGlow, glowTex, key, rim, T, AW, BH, BTOP, R } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.55; } });
  key.color.set(0xffe2c4); key.intensity = 2.2; key.position.set(-9, 14, 18); key.castShadow = false; rim.color.set(0xffc9a0); rim.intensity = 1.5; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.022);
  const S = (id, off = 0) => R(`start:${id}${off >= 0 ? "+" : ""}${off}`), E = (id, off = 0) => R(`end:${id}${off >= 0 ? "+" : ""}${off}`);
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, ...o });
  const cubeM = mat({ roughness: 0.5, envMapIntensity: 0.5 }); cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.3;"); };

  // ── the block: the follicle channel down the middle, the gland's chamber to the right, one (light) skin tone ─────────────────────────────────────────────
  const FX = [-1, 0], GL = { x0: 2, x1: 7, y0: -8, y1: -3 };                                                   // follicle columns, the gland chamber
  const inChannel = (x, y, z) => FX.includes(x) && y >= -9 && z >= -2;
  const inGland = (x, y, z) => x >= GL.x0 && x <= GL.x1 && y >= GL.y0 && y <= GL.y1 && z >= -1;
  const inDuct = (x, y, z) => z >= -1 && y === -5 && x >= 1 && x <= 2;
  const topCol = new THREE.Color(0xb98466), midCol = new THREE.Color(0xc08a72), lowCol = new THREE.Color(0xcc9082), deepCol = new THREE.Color(0xd09a90);
  const colOf = (y) => (y >= -1 ? topCol : y >= -3 ? midCol : y >= -8 ? lowCol : deepCol);
  const cells = [], X0 = -10, X1 = 10, YB = -15;
  for (let x = X0; x <= X1; x++) for (let y = -1; y >= YB; y--) { const zmin = y >= -1 ? -7 : -2;
    for (let z = zmin; z <= 0; z++) { if (inChannel(x, y, z) || inGland(x, y, z) || inDuct(x, y, z)) continue;
      cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.06 + (z < 0 && y < -1 ? -0.03 * Math.min(3, -z) : 0)) }); } }
  const block = new THREE.InstancedMesh(rbox(0.97, 0.13, 4), cubeM, cells.length); block.frustumCulled = false; const D = new THREE.Object3D();
  cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); }); scene.add(block);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(21, 14.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6a3a30) })); lining.position.set(0, -8.1, -2.7); scene.add(lining);          // the chamber's and channel's back wall
  const glowBack = mkGlow(1, 0xff8a4a)[0]; glowBack.scale.set(46, 46, 1); glowBack.position.set(0, -5, -9); glowBack.material.opacity = 0.08; glowBack.material.fog = false; scene.add(glowBack);

  // ── the hair: grows up from its bulb, out through the pore ────────────────────────────────────────────────────────────────────────────────────────────
  const hairPts = [[-0.5, -8.2, -1.0], [-0.55, -6.0, -1.1], [-0.45, -3.5, -1.0], [-0.5, -1.0, -0.9], [-0.35, 1.0, -0.7], [0.1, 2.6, -0.5], [0.8, 3.9, -0.3]].map((p) => new THREE.Vector3(...p));
  const hairCurve = new THREE.CatmullRomCurve3(hairPts), HS = 90, hairGeo = new THREE.TubeGeometry(hairCurve, HS, 0.1, 8, false), hairIdx = hairGeo.index.count;
  const hairM = mat({ color: 0x1a0d08, roughness: 0.45, emissive: 0x3a1a0a, emissiveIntensity: 0.5 }), hair = new THREE.Mesh(hairGeo, hairM); hair.frustumCulled = false; scene.add(hair);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat({ color: 0xd9b48c, roughness: 0.5, emissive: 0xff9a55, emissiveIntensity: 0.2 })); bulb.position.set(-0.5, -8.5, -1.0); bulb.scale.y = 1.2; scene.add(bulb);

  // ── the gland: lobes of cells that fill with oil and break down; a duct to the follicle ─────────────────────────────────────────────────────────────────
  const lobeC = [[3.4, -4.4, -0.6], [5.0, -4.2, -0.8], [6.4, -4.8, -0.6], [3.8, -6.0, -0.5], [5.4, -6.0, -0.7], [6.6, -6.6, -0.6], [4.2, -7.3, -0.5], [5.8, -7.4, -0.6]];
  const lobeM = mat({ color: 0xe8d4a8, roughness: 0.35, transparent: true, opacity: 0.55, emissive: 0xc88a30, emissiveIntensity: 0.15, depthWrite: false });
  const lobes = lobeC.map(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.95 + 0.12 * hash(i), 22, 16), lobeM); m.position.set(x, y, z); scene.add(m); return m; });
  const cellG = new THREE.SphereGeometry(0.5, 12, 10), cellM = mat({ color: 0xf0e0b8, roughness: 0.45, emissive: 0xb8863a, emissiveIntensity: 0.25 }), NCL = 14 * lobeC.length, cellI = new THREE.InstancedMesh(cellG, cellM, NCL); cellI.frustumCulled = false; scene.add(cellI);
  const oilM = mat({ color: 0xf2b84a, roughness: 0.2, emissive: 0xe08a1a, emissiveIntensity: 0.55, transparent: true, opacity: 0.92 }), oilI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), oilM, NCL); oilI.frustumCulled = false; scene.add(oilI);
  const duct = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.8, -5.0, -0.5), new THREE.Vector3(1.8, -5.0, -0.5), new THREE.Vector3(0.6, -4.7, -0.6)]), 20, 0.3, 10, false), new THREE.MeshStandardMaterial({ color: 0xe8c47a, roughness: 0.3, transparent: true, opacity: 0.6, emissive: 0xc88a30, emissiveIntensity: 0.2 })); scene.add(duct);

  // ── sebum: beads gliding duct -> follicle -> up along the hair -> out, then a thin coat spreading on the surface; microbes feeding ────────────────────────
  const sebPath = new THREE.CatmullRomCurve3([[3.0, -5.0, -0.4], [1.8, -4.95, -0.4], [0.8, -4.6, -0.5], [0.1, -3.6, -0.6], [0.0, -2.0, -0.6], [0.1, -0.6, -0.5], [0.3, 0.2, -0.3]].map((p) => new THREE.Vector3(...p)));
  const NB = 26, bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), oilM, NB); bead.frustumCulled = false; scene.add(bead);
  const coat = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12), mat({ color: 0xf2c25a, roughness: 0.15, emissive: 0xd88a22, emissiveIntensity: 0.35, transparent: true, opacity: 0.5 })); coat.position.set(0.3, -0.42, -1.2); coat.scale.set(0.01, 0.02, 0.01); scene.add(coat);
  const NM = 18, micM = mat({ color: 0xbff2e8, roughness: 0.35, emissive: 0x3fbfae, emissiveIntensity: 0.55 }), mic = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), micM, NM); mic.frustumCulled = false; scene.add(mic);
  const gcv = mkCanvas(128, 128), gx = gcv.getContext("2d"); { const g = gx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = g; gx.fillRect(0, 0, 128, 128); }
  const gtex = new THREE.CanvasTexture(gcv), lobeGlow = lobeC.map(([x, y, z]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: 0xffc050, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.set(x, y, z + 0.9); sp.scale.setScalar(2.6); scene.add(sp); return sp; });
  const plugs = [0, 1, 2].map((i) => { const m = new THREE.Mesh(rbox(1, 0.16, 4), mat({ color: 0xa8745a, roughness: 0.5, emissive: 0x3a2014, emissiveIntensity: 0.3 })); m.scale.set(1.5, 0.5, 1.1); m.visible = false; scene.add(m); return m; });
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.material.fog = false; s.userData = { x: -10 + hash(i * 3.3) * 20, y: -14 + hash(i * 5.9) * 17, z: -hash(i * 7.1) * 6 + 3, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });
  const rimGlow = mkGlow(1, 0xff9a60)[0]; rimGlow.scale.set(30, 5, 1); rimGlow.position.set(0, 0.2, -4); rimGlow.material.opacity = 0.05; rimGlow.material.fog = false; scene.add(rimGlow);

  // ── timing and camera keys ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const T0 = { grow0: S("vo03", 0.4), grow1: E("vo03", 1.0), fill0: S("vo05", 0.8), fill1: E("vo05", -0.8), seb0: S("vo06", 0.3), seb1: E("vo06", 0.0), coat0: S("vo06", 4.0), coat1: E("vo06", 2.0), mic0: S("vo07", 0.2), blk0: S("vo09", 0.2), blk1: E("vo09", 1.2) };
  const CK = [[0, [-5.5, 5.6, 10.5], [0.2, -0.6, -2.0], 32], [S("vo01", 4.0), [-3.5, 4.4, 9.5], [0.2, -0.7, -2.0], 32], [S("vo02", 0.3), [-1.5, 2.2, 10.5], [-0.3, -1.4, -0.6], 32], [S("vo02", 3.8), [-0.6, -2.6, 9.5], [-0.4, -3.0, -0.6], 30],
    [S("vo03", 0), [-0.6, -5.0, 9.0], [-0.4, -5.2, -0.8], 30], [E("vo03", 0), [-0.2, -6.6, 9.5], [-0.3, -6.4, -0.8], 30], [S("vo04", 0.5), [2.2, -5.6, 11.5], [2.4, -5.4, -0.6], 32], [S("vo05", 0), [4.6, -5.6, 9.2], [4.6, -5.6, -0.6], 30], [E("vo05", 0), [4.6, -5.6, 9.8], [4.6, -5.6, -0.6], 30],
    [S("vo06", 1.5), [1.4, -3.6, 10.0], [0.9, -3.8, -0.6], 30], [S("vo06", 5.5), [0.3, -0.8, 10.5], [0.3, -0.9, -0.6], 31], [E("vo06", 0), [-0.2, -1.8, 9.5], [0.0, -2.2, -0.7], 30], [S("vo07", 1.0), [-0.8, -2.8, 8.5], [-0.2, -2.8, -0.7], 30], [E("vo07", 0), [-0.6, -3.0, 9.0], [-0.2, -2.8, -0.7], 30],
    [S("vo08", 0.2), [0.5, -4.0, 14], [0.8, -4.2, -0.6], 32], [S("vo08", 4.0), [1.0, -4.4, 27], [1.2, -4.6, -0.6], 32], [E("vo08", 0), [1.2, -4.0, 25], [1.2, -4.4, -0.6], 32], [S("vo09", 1.0), [-1.6, 1.6, 11], [0.2, -0.7, -1.2], 32], [E("vo09", 0), [-1.2, 1.2, 11.5], [0.2, -0.8, -1.4], 32], [E("vo10", 20), [-1.0, 1.0, 11.6], [0.2, -0.8, -1.4], 32]];
  const keyed = (i, t) => { let k = 0; while (k < CK.length - 2 && t >= CK[k + 1][0]) k++; const a = CK[k], b = CK[k + 1], e = sm(seg(t, a[0], b[0])); return a[i] instanceof Array ? a[i].map((v, j) => lerp(v, b[i][j], e)) : lerp(a[i], b[i], e); };
  const pt = new THREE.Vector3();

  return {
    renderer,
    seek(t) {
      const cam = { pos: keyed(1, t), look: keyed(2, t), fov: keyed(3, t), roll: 0, sc: "S" }; cam.pos[0] += 0.5 * Math.sin(t * 0.21); cam.pos[1] += 0.25 * Math.sin(t * 0.17 + 1); W3.camPose(t, cam);
      // hair growth: draw the tube up to its growing length
      const g = 0.62 + 0.38 * sm(seg(t, T0.grow0, T0.grow1)); hairGeo.setDrawRange(0, Math.floor(hairIdx * g / 3) * 3);
      // gland: cells fill with oil, then break down into oil
      const fill = sm(seg(t, T0.fill0, T0.fill1)), glow = sm(seg(t, S("vo04", 0.5), S("vo05", 2))) * (1 - 0.5 * sm(seg(t, T0.seb0, T0.seb1 + 3)));
      let ci = 0; lobeC.forEach(([x, y, z], i) => { for (let k = 0; k < 14; k++) { const a = hash(i * 31 + k * 7) * 6.28, b = Math.acos(2 * hash(i * 17 + k * 3) - 1), r = 0.55 * Math.cbrt(hash(i * 13 + k)), px = x + r * Math.sin(b) * Math.cos(a), py = y + r * Math.sin(b) * Math.sin(a) * 0.9, pz = z + r * Math.cos(b) * 0.7;
          const ph = clamp(fill * 1.3 - hash(i * 5 + k) * 0.3), cell = (1 - sm(seg(ph, 0.55, 1.0))) * 0.34, oil = (sm(seg(ph, 0.1, 0.9)) * 0.26 + sm(seg(ph, 0.6, 1.0)) * 0.16);
          D.position.set(px, py, pz); D.rotation.set(0, 0, 0); D.scale.set(cell, cell, cell); D.updateMatrix(); cellI.setMatrixAt(ci, D.matrix); D.position.set(px, py, pz + 0.05); D.scale.set(oil, oil, oil); D.updateMatrix(); oilI.setMatrixAt(ci, D.matrix); ci++; } lobeGlow[i].material.opacity = 0.28 * glow; });
      cellI.instanceMatrix.needsUpdate = oilI.instanceMatrix.needsUpdate = true; lobeM.emissiveIntensity = 0.15 + 0.5 * fill; oilM.emissiveIntensity = 0.45 + 0.3 * Math.sin(t * 1.3);
      // sebum beads along the path, in a steady stream while it flows
      const flow = sm(seg(t, T0.seb0 - 0.5, T0.seb0 + 1.5)) * (1 - 0.7 * sm(seg(t, E("vo07", 2), E("vo08", 0))));
      for (let i = 0; i < NB; i++) { const k = ((t - T0.seb0) * 0.1 + i / NB) % 1, kk = (k + 1) % 1, u = clamp(kk), vis = flow * (t > T0.seb0 - 0.5 ? 1 : 0) * Math.min(1, u * 8) * Math.min(1, (1 - u) * 6); sebPath.getPoint(u, pt); D.position.set(pt.x + 0.12 * Math.sin(i * 2.3 + t), pt.y, pt.z + 0.12 * Math.cos(i * 1.7)); const sz = 0.2 * vis * (0.8 + 0.4 * hash(i)); D.scale.set(sz, sz, sz); D.updateMatrix(); bead.setMatrixAt(i, D.matrix); }
      bead.instanceMatrix.needsUpdate = true;
      const cs = sm(seg(t, T0.coat0, T0.coat1)); coat.scale.set(0.01 + 3.2 * cs, 0.02 + 0.09 * cs, 0.01 + 1.8 * cs);
      // microbes along the follicle wall, feeding (pulse) once line 7 begins
      const mv = sm(seg(t, T0.mic0, T0.mic0 + 1.6)) * (1 - 0.3 * sm(seg(t, E("vo08", 0), E("vo09", 0))));
      for (let i = 0; i < NM; i++) { const y = -1.2 - 3.0 * hash(i * 3.1), side = i % 2 ? 1 : -1, x = (side > 0 ? 0.62 : -1.5) + 0.2 * hash(i * 7.7) + 0.08 * Math.sin(t * 1.6 + i * 2.1), z = -1.3 + 0.7 * hash(i * 9.3) + 0.06 * Math.cos(t * 1.3 + i), pulse = 1 + 0.18 * Math.sin(t * 3.2 + i * 1.7) * mv, sz = 0.2 * mv * pulse;
        D.position.set(x, y + 0.06 * Math.sin(t * 1.1 + i), z); D.rotation.set(0, 0, 0.6 * Math.sin(i)); D.scale.set(sz * 1.5, sz, sz); D.updateMatrix(); mic.setMatrixAt(i, D.matrix); } D.rotation.set(0, 0, 0); mic.instanceMatrix.needsUpdate = true; micM.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 2.2);
      // the doorway starts to close: a few flat cells slide into the mouth
      const bk = sm(seg(t, T0.blk0, T0.blk1)); plugs.forEach((m, i) => { m.visible = bk > 0.01; const dir = i === 1 ? 0 : (i === 0 ? -1 : 1); m.position.set(lerp(dir * 3.2, dir * 0.55 + (i === 1 ? 0.0 : 0), bk), -0.28 + (i === 1 ? 0.35 * (1 - bk) : 0), -0.5 - (i === 1 ? 0.6 : 0)); m.scale.set(1.5, 0.5, 1.1); });
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.2 + 0.15 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(cam.look[0], cam.look[1], 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(cam);
    },
    anchor() { return null; },
  };
}
