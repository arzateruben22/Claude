// voxel3d.js — Skin Sense Season 3 look test, take 2: a soft 3-D voxel world (rounded cubes) in episode 1's deep tone, glowing from within, on a green-black ground (#0B1513) —
// influenced by the Skin School course's tactile voxel layers, with Skin Sense's own touches (softer, glowing cubes; teal signal). Hairs rise from the surface in a slow wave,
// the camera sinks down the cut face and a soft teal pulse travels a thin nerve strand set into the voxels. One continuous scene. Base set/w3d.js. Pure function of t.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, mkGlow, glowTex, key, rim, T, AW, BH, BTOP } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.5; } });
  key.color.set(0xffe2c4); key.intensity = 2.3; key.position.set(-9, 14, 16); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); key.shadow.bias = -0.0008;
  rim.color.set(0xffc9a0); rim.intensity = 1.8; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.028);
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.5, ...o });

  // ── rounded cube ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };
  const cubeG = rbox(0.97, 0.13, 6);
  const cubeM = mat({ roughness: 0.46, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.35, sheenColor: new THREE.Color(1, 0.6, 0.4), emissive: 0x000000, envMapIntensity: 0.5 });
  cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.32;"); };   // glowing from within: each cube lights itself a little in its own colour

  // ── the block: layers of deep warm brown at the top, warmer and rosier below; a rough stepped surface ───────────────────────────
  const NXc = [-12, 11], NYc = [-8, -1], NZc = [-9, 0];
  const nervePath = [[-1.0, -1.4], [-0.5, -2.6], [0.8, -3.9], [2.1, -5.2], [3.3, -6.5], [4.2, -7.6]].map((p) => new THREE.Vector3(p[0], p[1], 0));
  const nerve = new THREE.CatmullRomCurve3(nervePath), npts = nerve.getPoints(60);
  const nearNerve = (x, y) => { for (const p of npts) if (Math.hypot(p.x - x, p.y - y) < 0.78) return true; return [[-1.5, -0.8], [-0.9, -0.7], [-0.5, -0.9]].some(([a, b]) => Math.hypot(a - x, b - y) < 0.7); };
  const cells = []; const topH = (x, z) => (Math.sin(x * 0.9 + z * 0.6) + Math.sin(x * 0.4 - z * 1.3) + 2 * hash(Math.round(x) * 31 + Math.round(z) * 7)) > 1.9 ? 1 : 0;
  const cols = [[-1, 0x3b2116], [-3, 0x522d1e], [-5, 0x6b3733], [-8, 0x83433d]].map(([y, c]) => [y, new THREE.Color(c)]);
  const colOf = (y) => { for (const [lim, c] of cols) if (y >= lim) return c; return cols[cols.length - 1][1]; };
  for (let x = NXc[0]; x <= NXc[1]; x++) for (let y = NYc[0]; y <= NYc[1]; y++) for (let z = NZc[0]; z <= NZc[1]; z++) {
    if (z === 0 && nearNerve(x, y)) continue;                                                      // the groove the nerve strand sits in
    cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.07) }); }
  for (let x = NXc[0]; x <= NXc[1]; x++) for (let z = NZc[0]; z <= NZc[1]; z++) if (topH(x, z) && !(z === 0 && nearNerve(x, 0))) cells.push({ x, y: 0, z, c: colOf(-1).clone().offsetHSL(0, 0, 0.03 + (hash(x * 3 + z * 5) - 0.5) * 0.05) });
  const block = new THREE.InstancedMesh(cubeG, cubeM, cells.length); block.castShadow = block.receiveShadow = true; block.frustumCulled = false; const D = new THREE.Object3D();
  cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); }); scene.add(block);

  // ── warm glow where the skin meets the dark ──────────────────────────────────────────────────────────────────────────────────────
  const glowFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff8a4a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); glowFloor.rotation.x = -Math.PI / 2; glowFloor.position.set(0, -8.55, -4); scene.add(glowFloor);
  const rimGlow = mkGlow(1, 0xff9a60)[0]; rimGlow.scale.set(26, 6, 1); rimGlow.position.set(0, 0.3, -4.5); rimGlow.material.opacity = 0.22; rimGlow.material.fog = false; scene.add(rimGlow);

  // ── hairs: thin dark strands rising from the surface in a slow wave ──────────────────────────────────────────────────────────────
  const NH = 150, hairs = []; for (let i = 0; i < NH; i++) { const x = -10 + hash(i * 3.1) * 16, z = -8 + hash(i * 5.7) * 7.6, yaw = (hash(i * 7.3) - 0.5) * 1.4, L = 1.5 + hash(i * 9.9) * 1.0; hairs.push({ x: Math.round(x * 2) / 2, z: Math.round(z), yaw, L, d: ((x + 10) / 16 * 0.5 + (z + 8) / 7.6 * 0.5) * 1.0 + hash(i * 1.3) * 0.2, lean: (hash(i * 2.9) - 0.5) * 0.3, y: topH(Math.round(x), Math.round(z)) + 0.49 }); }
  const hg = new THREE.CylinderGeometry(0.012, 0.03, 1, 5, 4, true); hg.translate(0, 0.5, 0);
  const hairM = mat({ color: 0x0e0704, roughness: 0.5, sheen: 0.15, sheenColor: new THREE.Color(1, 0.6, 0.3) }), hairI = new THREE.InstancedMesh(hg, hairM, NH); hairI.frustumCulled = false; hairI.castShadow = true; scene.add(hairI);
  const O = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), HT0 = 1.3;

  // ── the nerve: a thin strand in the groove, a free ending at the top, a soft teal pulse ───────────────────────────────────────
  const NSEG = 120, ng = new THREE.TubeGeometry(nerve, NSEG, 0.05, 8, false), ncol = new Float32Array(ng.attributes.position.count * 3); ng.setAttribute("color", new THREE.BufferAttribute(ncol, 3));
  scene.add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  [[-1.0, -1.4, -1.5, -0.8], [-1.0, -1.4, -0.9, -0.7], [-1.0, -1.4, -0.5, -0.9]].forEach(([a, b, c, d]) => scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(a, b, 0), new THREE.Vector3(c, d, 0)]), 6, 0.03, 6, false), new THREE.MeshBasicMaterial({ color: 0x2fa89a, toneMapped: false }))));
  const halo = new THREE.Mesh(new THREE.TubeGeometry(nerve, 40, 0.14, 8, false), new THREE.MeshBasicMaterial({ color: 0x3fbfae, transparent: true, opacity: 0.04, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(halo);
  const pulse = mkGlow(3, 0x3fbfae); pulse.forEach((s) => scene.add(s)); const cool = mkGlow(12, 0x3fbfae); cool.forEach((s) => scene.add(s));
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.userData = { x: -8 + hash(i * 3.3) * 18, y: -6 + hash(i * 5.9) * 9, z: -hash(i * 7.1) * 10 + 4, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });
  [pulse, cool, dust].forEach((a) => a.forEach((sp) => { sp.material.fog = false; }));
  const PT0 = 5.3, PT1 = 9.55, pu = (t) => eio(seg(t, PT0, PT1));
  const nBase = new THREE.Color(0.02, 0.17, 0.145), nPeak = new THREE.Color(0.2, 1.2, 1.0), cc = new THREE.Color(), np = ng.attributes.position, nuv = ng.attributes.uv;

  return {
    renderer,
    seek(t) {
      const c = W3.camAt(t); W3.camPose(t, c);
      for (let i = 0; i < NH; i++) { const h = hairs[i], r = sm(seg(t, HT0 + h.d, HT0 + h.d + 0.85)), pitch = lerp(0.1, 1.42, r);
        dir.set(Math.cos(h.yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(h.yaw) * Math.cos(pitch) + h.lean * r).normalize(); O.position.set(h.x, h.y, h.z); O.quaternion.setFromUnitVectors(up, dir); O.scale.set(1, h.L, 1); O.updateMatrix(); hairI.setMatrixAt(i, O.matrix); }
      hairI.instanceMatrix.needsUpdate = true;
      const u = pu(t), act = seg(t, PT0 - 0.2, PT0 + 0.3) * (1 - sm(seg(t, 9.4, 10)));
      for (let i = 0; i < np.count; i++) { const uu = nuv.getY(i), d = uu - u, g = Math.exp(-(d * d) / (2 * 0.05 * 0.05)) * act, tail = d < 0 && d > -0.35 ? Math.exp(d * 9) * 0.25 * act : 0; cc.copy(nBase).lerp(nPeak, clamp(g + tail)); ncol[i * 3] = cc.r; ncol[i * 3 + 1] = cc.g; ncol[i * 3 + 2] = cc.b; }
      ng.attributes.color.needsUpdate = true;
      pulse.forEach((s, i) => { s.position.copy(nerve.getPoint(clamp(u - (i / 3) * 0.05))); s.position.z += 0.2; s.scale.setScalar((1 - 0.25 * i) * 1.3); s.material.opacity = act * (1 - 0.3 * i); });
      const cb = seg(t, 5.0, 5.8) * (1 - sm(seg(t, 6.6, 7.8))); cool.forEach((s, i) => { const a = hash(i * 3.3) * 6.28, r = 0.2 + hash(i * 5.1) * 0.7 + 0.25 * seg(t, 5.0, 7.5); s.position.set(-1.0 + Math.cos(a) * r, -1.3 + Math.sin(a) * r * 0.7, 0.5); s.scale.setScalar(0.45 + 0.4 * hash(i * 8.8)); s.material.opacity = cb * 0.25; });
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.07 + 0.05 * hash(i)); s.material.opacity = 0.22 + 0.18 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(0, -3, -3); key.target.updateMatrixWorld();
      W3.compMat.uniforms.tm.value = t * 37.1; W3.render(c);
    },
    anchor() { return null; },
  };
}
