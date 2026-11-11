// night3d.js — Skin Sense Season 3 look test ("the night look"): deep-tone skin glowing from within out of a green-black dark, hairs rising in a slow wave,
// then the camera sinks through the surface and a soft teal signal travels along a glowing nerve fibre into the dark. One continuous scene, no cuts.
// Shared base set/w3d.js (finish: depth of field, bloom, ACES, grain; dark ground via three.bg / three.ground). Pure function of t.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, mkGlow, glowTex, key, rim, T, AW, BH, BTOP } = W3;
  // the night: almost no ambient light, one warm low key from behind-left, a trace of teal from the right
  scene.environmentIntensity = 0.03; scene.traverse((o) => { if (o.isHemisphereLight) { o.intensity = 0.03; } });
  scene.fog = new THREE.FogExp2(0x0b1513, 0.055); key.color.set(0xffa86a); key.intensity = 0.4; key.castShadow = false; rim.color.set(0x3fbfae); rim.intensity = 0.35; rim.position.set(10, 4, 2);
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.5, ...o });
  const SKH = T.skinHex || "#6a3a22";

  // ── the skin: a rolling landscape of deep-tone skin, pores in the bump map, a warm glow from within ───────────────────────────────
  const hf = (x, z) => 0.24 * Math.sin(0.9 * x + 0.7 * z) + 0.13 * Math.sin(1.7 * x - 1.1 * z + 1.0) + 0.06 * Math.sin(3.1 * x + 2.3 * z + 2.0);
  const pores = mkCanvas(512, 512), pg = pores.getContext("2d"); { pg.fillStyle = "#808080"; pg.fillRect(0, 0, 512, 512); for (let i = 0; i < 1500; i++) { const x = rnd() * 512, y = rnd() * 512, r = 1 + rnd() * 2.6; pg.fillStyle = `rgba(${rnd() < 0.5 ? 30 : 200},${rnd() < 0.5 ? 30 : 200},${rnd() < 0.5 ? 30 : 200},.35)`; pg.beginPath(); pg.arc(x, y, r, 0, 7); pg.fill(); }
    pg.strokeStyle = "rgba(20,20,20,.35)"; pg.lineWidth = 1.2; for (let i = 0; i < 260; i++) { const x = rnd() * 512, y = rnd() * 512, a = (rnd() < 0.5 ? 0.6 : -0.6) + (rnd() - 0.5) * 0.4, L = 20 + rnd() * 50; pg.beginPath(); pg.moveTo(x, y); pg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); pg.stroke(); } }
  const bump = tex(pores, [10, 10]), glowC = mkCanvas(512, 512), gg = glowC.getContext("2d"); { gg.fillStyle = "#3a1a0c"; gg.fillRect(0, 0, 512, 512); for (let i = 0; i < 70; i++) { const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 90, g = gg.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,120,60,.55)"); g.addColorStop(1, "rgba(255,120,60,0)"); gg.fillStyle = g; gg.fillRect(x - r, y - r, 2 * r, 2 * r); } }
  const glowT = tex(glowC, [3, 3]);
  const skinM = mat({ color: new THREE.Color(SKH), bumpMap: bump, bumpScale: 1.6, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color(0.8, 0.4, 0.2), emissive: new THREE.Color(0xa8441a), emissiveMap: glowT, emissiveIntensity: 0.26, side: THREE.DoubleSide, transparent: true });
  const gs = new THREE.PlaneGeometry(36, 24, 260, 170); gs.rotateX(-Math.PI / 2); gs.translate(1, 0, -5); const gp = gs.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, hf(gp.getX(i), gp.getZ(i))); gs.computeVertexNormals();
  const skin = new THREE.Mesh(gs, skinM); scene.add(skin);

  // ── hairs lying flat that rise one after another in a slow wave, a small bump under each ───────────────────────────────────────────
  const NH = 520, hairs = []; for (let i = 0; i < NH; i++) { const x = -4 + hash(i * 3.1) * 12, z = -8 + hash(i * 5.7) * 9, yaw = (hash(i * 7.3) - 0.5) * 1.1, L = 0.9 + hash(i * 9.9) * 0.6; hairs.push({ x, z, yaw, L, y: hf(x, z), d: ((x + 4) / 12 * 0.5 + (z + 8) / 9 * 0.5) * 1.15 + hash(i * 1.3) * 0.25, lean: (hash(i * 2.9) - 0.5) * 0.35 }); }
  const hg = new THREE.CylinderGeometry(0.006, 0.02, 1, 5, 4, true); hg.translate(0, 0.5, 0);
  const hairM = mat({ color: 0xc88c55, emissive: 0xff9a55, emissiveIntensity: 0.7, roughness: 0.4 }), hairI = new THREE.InstancedMesh(hg, hairM, NH); hairI.frustumCulled = false; scene.add(hairI);
  const bumpI = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8), skinM, NH); bumpI.frustumCulled = false; scene.add(bumpI);
  const O = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), HT0 = 1.3;

  // ── below the surface: the glowing nerve, its free ending near the underside, branches, hair roots, warm haze ───────────────────────
  const nervePts = [[2.2, -0.7, -0.9], [2.9, -1.05, -1.05], [3.8, -1.6, -1.4], [4.9, -2.1, -1.8], [6.2, -2.55, -2.3], [7.8, -2.95, -2.9], [9.6, -3.3, -3.6]].map((p) => new THREE.Vector3(...p));
  const nerve = new THREE.CatmullRomCurve3(nervePts), NSEG = 160, NR = 8;
  const ng = new THREE.TubeGeometry(nerve, NSEG, 0.04, NR, false), ncol = new Float32Array(ng.attributes.position.count * 3); ng.setAttribute("color", new THREE.BufferAttribute(ncol, 3));
  const nerveM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); const nerveMesh = new THREE.Mesh(ng, nerveM); scene.add(nerveMesh);
  const halo = new THREE.Mesh(new THREE.TubeGeometry(nerve, 60, 0.16, 8, false), new THREE.MeshBasicMaterial({ color: 0x1f8f80, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(halo);
  const finger = (a, b) => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(...a), new THREE.Vector3(...b)]); return new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.014, 6, false), new THREE.MeshBasicMaterial({ color: 0x1f7a70, toneMapped: false })); };
  [[2.2, -0.7, -0.9, 1.95, -0.45, -0.8], [2.2, -0.7, -0.9, 2.4, -0.42, -1.0], [2.2, -0.7, -0.9, 2.15, -0.48, -1.2]].forEach((f) => scene.add(finger(f.slice(0, 3), f.slice(3))));    // the free ending, three fine tips reaching up toward the surface
  const branch = (pts, r = 0.025) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, r, 6, false), new THREE.MeshBasicMaterial({ color: 0x1b6a60, toneMapped: false })); scene.add(m); return m; };
  branch([[3.8, -1.6, -1.4], [4.3, -1.3, -1.9], [5.1, -1.2, -2.6], [6.0, -1.4, -3.4]]); branch([[4.9, -2.1, -1.8], [5.4, -2.7, -1.5], [6.4, -3.3, -1.2]], 0.03); branch([[6.2, -2.55, -2.3], [6.9, -2.2, -3.0], [7.8, -2.1, -4.0]]); branch([[3.0, -1.1, -1.05], [3.1, -0.7, -1.6], [3.5, -0.4, -2.3]], 0.018);
  const roots = []; for (let i = 0; i < 9; i++) { const x = -1 + hash(i * 4.1) * 9, z = -1.0 - hash(i * 6.3) * 4, y0 = hf(x, z), d = 0.9 + hash(i * 8.1) * 0.6; const root = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, d, 6), mat({ color: 0x5a3820, emissive: 0xff8a4a, emissiveIntensity: 0.12, transparent: true, opacity: 0.45 })); root.position.set(x, y0 - d / 2, z); scene.add(root); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat({ color: 0x8a5a38, emissive: 0xff8a4a, emissiveIntensity: 0.2, transparent: true, opacity: 0.7 })); bulb.position.set(x, y0 - d, z); bulb.scale.set(1, 1.3, 1); roots.push(root); }
  const fibresG = new THREE.Group(); scene.add(fibresG); for (let i = 0; i < 10; i++) { const x = -2 + hash(i * 2.3) * 12, y = -0.6 - hash(i * 3.7) * 3.6, z = -hash(i * 5.1) * 5.5, a = (hash(i * 7.9) - 0.5) * 1.6; const pts = [0, 1, 2, 3].map((k) => new THREE.Vector3(x + k * 0.9 * Math.cos(a), y + (hash(i * 3 + k) - 0.5) * 0.7, z + k * 0.9 * Math.sin(a))); fibresG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 4, false), new THREE.MeshBasicMaterial({ color: 0x5a3017, transparent: true, opacity: 0.14, toneMapped: false }))); }
  const haze = mkGlow(70, 0xc4733a); haze.forEach((s, i) => { s.position.set(-1 + hash(i * 1.7) * 11, -0.8 - hash(i * 2.9) * 3.4, -0.5 - hash(i * 4.3) * 6); s.scale.setScalar(1.1 + hash(i * 6.1) * 3.2); s.userData.o = 0.1 + hash(i * 8.3) * 0.14; scene.add(s); });
  const dust = mkGlow(46, 0xffc89a); dust.forEach((s, i) => { s.userData = { x: -4 + hash(i * 3.3) * 14, y: -2.8 + hash(i * 5.9) * 4.2, z: -hash(i * 7.1) * 7 + 1, sp: 0.05 + hash(i * 9.7) * 0.08, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });
  const pulse = mkGlow(3, 0x3fbfae); pulse.forEach((s) => scene.add(s)); const cool = mkGlow(14, 0x3fbfae); cool.forEach((s) => scene.add(s));

  [haze, dust, pulse, cool].forEach((a) => a.forEach((sp) => { sp.material.fog = false; }));
  // ── per frame ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const PT0 = 5.3, PT1 = 9.55, pu = (t) => eio(seg(t, PT0, PT1));                       // the signal's travel along the nerve (u 0…1)
  const nBase = new THREE.Color(0.01, 0.125, 0.105), nPeak = new THREE.Color(0.1, 0.95, 0.8), cc = new THREE.Color(), np = ng.attributes.position, nuv = ng.attributes.uv;
  return {
    renderer,
    seek(t) {
      const c = W3.camAt(t); W3.camPose(t, c);
      // hairs: rise in a slow wave
      for (let i = 0; i < NH; i++) { const h = hairs[i], r = sm(seg(t, HT0 + h.d, HT0 + h.d + 0.85)), pitch = lerp(0.12, 1.38, r), cy = Math.cos(h.yaw);
        dir.set(Math.cos(h.yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(h.yaw) * Math.cos(pitch) + h.lean * r).normalize(); O.position.set(h.x, h.y - 0.01, h.z); O.quaternion.setFromUnitVectors(up, dir); O.scale.set(1, h.L * (1 - 0.04 * r), 1); O.updateMatrix(); hairI.setMatrixAt(i, O.matrix);
        O.position.set(h.x, h.y - 0.03, h.z); O.quaternion.identity(); O.scale.set(0.05 + 0.1 * r, 0.02 + 0.06 * r, 0.05 + 0.1 * r); O.updateMatrix(); bumpI.setMatrixAt(i, O.matrix); }
      hairI.instanceMatrix.needsUpdate = bumpI.instanceMatrix.needsUpdate = true;
      // the surface thins to a glowing veil as the camera sinks through it
      const camY = camera.position.y, veil = sm(seg(camY, 0.3, -0.35)); skinM.opacity = 1 - 0.62 * veil; skinM.depthWrite = veil < 0.05; skinM.emissiveIntensity = 0.26 + 0.3 * veil; hairM.opacity = 1;
      // the nerve: a dim glow, brighter where the signal is
      const u = pu(t), act = seg(t, PT0 - 0.2, PT0 + 0.3) * (1 - sm(seg(t, 9.4, 10)));
      for (let i = 0; i < np.count; i++) { const uu = nuv.getY(i), d = (uu - u), g = Math.exp(-(d * d) / (2 * 0.045 * 0.045)) * act, tail = d < 0 && d > -0.35 ? Math.exp(d * 9) * 0.25 * act : 0; cc.copy(nBase).lerp(nPeak, clamp(g + tail)); ncol[i * 3] = cc.r; ncol[i * 3 + 1] = cc.g; ncol[i * 3 + 2] = cc.b; }
      ng.attributes.color.needsUpdate = true;
      const pp = nerve.getPoint(clamp(u)); pulse.forEach((s, i) => { const k = i / 3; s.position.copy(nerve.getPoint(clamp(u - k * 0.05))); s.position.z += 0.15; s.scale.setScalar((1.0 - 0.25 * i) * 1.5); s.material.opacity = act * (1.0 - 0.3 * i); });
      // a cool breath at the free ending as "the air cool" is said, then it settles
      const cb = seg(t, 5.0, 5.8) * (1 - sm(seg(t, 6.6, 7.8))); cool.forEach((s, i) => { const a = hash(i * 3.3) * 6.28, r = 0.15 + hash(i * 5.1) * 0.9 + 0.3 * seg(t, 5.0, 7.5); s.position.set(2.2 + Math.cos(a) * r, -0.35 - 0.5 * hash(i * 2.1) + 0.1 * Math.sin(t * 1.5 + i), -0.9 + Math.sin(a) * r * 0.7); s.scale.setScalar(0.5 + 0.5 * hash(i * 8.8)); s.material.opacity = cb * 0.22; });
      haze.forEach((s, i) => { s.material.opacity = s.userData.o * (0.7 + 0.3 * Math.sin(t * 0.6 + i)); });
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3 + 0.1 * Math.sin(t * 0.7 + U.ph), U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.25 + 0.2 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(1, 0, -2); key.position.set(-6, 1.2, -8); key.target.updateMatrixWorld();
      W3.compMat.uniforms.tm.value = t * 37.1; W3.render(c);
    },
    anchor() { return null; },
  };
}
