// hair3d.js — Skin Sense Season 3, Episode 5 ("Every hair is scheduled to fall out"): the soft voxel cut-away skin with several follicles, each running its own hair cycle:
// growth (the hair lengthens from a glowing teal-lit bulb), a pause, regression (the root shrinks and the hair loosens), rest, and exit (a new hair begins at the bottom and gently pushes the old one out).
// The head follicle grows long; the eyebrow follicle stops short. Wide shots show several follicles on their own schedules. Base set/w3d.js, look as episodes 1-4. No faces, no scalp or surface bare patches.
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
  const D = new THREE.Object3D();

  // ── follicles: x centre (the channel is the two columns around it), longest hair (fraction of the full tube), cycle ─────────────────────────────────────
  const FOL = [{ cx: -0.5, lmax: 1.0, tag: "head" }, { cx: 5.5, lmax: 0.55, tag: "brow" }, { cx: -6.5, lmax: 0.8, tag: "c" }, { cx: 8.5, lmax: 0.68, tag: "e" }];
  const pk = (a, t) => { let k = 0; while (k < a.length - 2 && t >= a[k + 1][0]) k++; const p = a[k], q = a[k + 1]; return lerp(p[1], q[1], seg(t, p[0], q[0])); };
  const PK = {
    head: () => [[0, 0.9], [2.6, 1.0], [S("vo01", 3.5), 1.0], [S("vo03", 0), 1.12], [E("vo03", -0.2), 1.96], [E("vo03", 1.5), 2.0], [S("vo04", 0), 2.0], [E("vo04", 0), 2.55], [E("vo10", 20), 2.8]],
    brow: () => [[0, 0.5], [S("vo05", 0), 0.5], [E("vo05", 0), 0.6], [S("vo06", 0), 0.6], [E("vo06", 0), 0.88], [S("vo07", 2.0), 0.9], [E("vo07", 0), 1.04], [E("vo07", 3.0), 1.2], [E("vo10", 20), 1.5]],
    c: () => [[0, 0.3], [S("vo08", 0), 1.75], [E("vo08", 0), 2.02], [E("vo10", 20), 2.4]],
    e: () => [[0, 0.75], [S("vo08", 0), 2.2], [S("vo10", 0), 3.85], [E("vo10", 0), 4.04], [E("vo10", 20), 4.1]] };
  const chan = (x, y, z) => y >= -9 && z >= -2 && FOL.some((f) => x === Math.round(f.cx - 0.5) || x === Math.round(f.cx - 0.5) + 1);
  const topCol = new THREE.Color(0xb98466), midCol = new THREE.Color(0xc08a72), lowCol = new THREE.Color(0xcc9082), deepCol = new THREE.Color(0xd09a90);
  const colOf = (y) => (y >= -1 ? topCol : y >= -3 ? midCol : y >= -8 ? lowCol : deepCol);
  const cells = [];
  for (let x = -10; x <= 10; x++) for (let y = -1; y >= -15; y--) { const zmin = y >= -1 ? -7 : -2;
    for (let z = zmin; z <= 0; z++) { if (chan(x, y, z)) continue; cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.06 + (z < 0 && y < -1 ? -0.03 * Math.min(3, -z) : 0)) }); } }
  const block = new THREE.InstancedMesh(rbox(0.97, 0.13, 4), cubeM, cells.length); block.frustumCulled = false;
  cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); }); scene.add(block);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(21, 14.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1c0f0b) })); lining.position.set(0, -8.1, -3.6); scene.add(lining);
  const TN = []; FOL.forEach((f, fi) => { for (let y = -1; y >= -9; y--) for (let k = 0; k < 9; k++) { const ph = (k / 8) * Math.PI, r = 1.18 + 0.06 * hash(y * 3 + k + fi * 17), dp = Math.min(1, (-y - 1) / 8);
    TN.push({ x: f.cx + r * Math.cos(ph), y, z: -1 - r * Math.sin(ph), ry: Math.atan2(r * Math.cos(ph), r * Math.sin(ph)), c: new THREE.Color(0xb27562).lerp(new THREE.Color(0x6e3a2c), 0.25 + 0.55 * dp).offsetHSL(0, 0, (hash(k * 7 + y * 5 + fi) - 0.5) * 0.05) }); } });
  const tunnel = new THREE.InstancedMesh(rbox(0.9, 0.14, 4), cubeM, TN.length); tunnel.frustumCulled = false;
  TN.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.rotation.set(0, c.ry, 0); D.scale.set(0.85, 1, 0.85); D.updateMatrix(); tunnel.setMatrixAt(i, D.matrix); tunnel.setColorAt(i, c.c); }); D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1); scene.add(tunnel);
  const deepGlow = mkGlow(1, 0xff9a55)[0]; deepGlow.scale.set(40, 9, 1); deepGlow.position.set(0, -7.5, -2.2); deepGlow.material.opacity = 0.14; deepGlow.material.fog = false; scene.add(deepGlow);

  // ── the hairs: two per follicle (the hair of this cycle and the new hair of the next), each with its bulb and a teal pulse ──────────────────────────────
  const gcv = mkCanvas(128, 128), gx = gcv.getContext("2d"); { const g = gx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = g; gx.fillRect(0, 0, 128, 128); }
  const gtex = new THREE.CanvasTexture(gcv), HS = 90;
  const mkHair = (f, fi) => { const cx = f.cx, curve = new THREE.CatmullRomCurve3([[cx - 0.05, -8.2, -1.0], [cx - 0.1, -5.5, -1.1], [cx + 0.02, -2.0, -1.0], [cx - 0.1, 1.0, -0.8], [cx + 0.5, 4.0, -0.6], [cx + 1.3, 7.0, -0.5], [cx + 2.2, 10.5, -0.4]].map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, HS, 0.15, 10, false), idx = geo.index.count, hm = mat({ color: 0x241108, roughness: 0.22, metalness: 0.15, emissive: 0x4a2410, emissiveIntensity: 0.6, transparent: true }), hairM = new THREE.Mesh(geo, hm); hairM.frustumCulled = false;
    const bm = mat({ color: 0xd9b48c, roughness: 0.5, emissive: 0xff9a55, emissiveIntensity: 0.2, transparent: true }), bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bm); bulb.position.set(cx - 0.05, -8.5, -1.0); bulb.scale.y = 1.2;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: 0x3fbfae, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.set(cx - 0.05, -8.3, -0.2); sp.scale.setScalar(3.2);
    const grp = new THREE.Group(); grp.add(hairM, bulb, sp); scene.add(grp); return { grp, geo, idx, hm, bm, bulb, sp, curve }; };
  FOL.forEach((f, i) => { f.h = [mkHair(f, i), mkHair(f, i)]; f.key = PK[f.tag] ? PK[f.tag]() : null; });
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.material.fog = false; s.userData = { x: -12 + hash(i * 3.3) * 24, y: -14 + hash(i * 5.9) * 20, z: -hash(i * 7.1) * 6 + 3, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });

  // ── camera ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const CK = [[0, [0.6, 2.2, 10.5], [-0.3, 0.8, -0.8], 31], [S("vo01", 3.2), [-0.4, -4.8, 9.8], [-0.5, -6.6, -1.0], 31], [S("vo02", 1.0), [-0.6, -6.4, 8.6], [-0.5, -7.2, -1.0], 30], [E("vo02", 0), [-0.6, -6.0, 8.8], [-0.5, -7.0, -1.0], 30],
    [S("vo03", 0.0), [-0.6, -5.0, 11.5], [-0.5, -5.2, -1.0], 31], [E("vo03", 0), [-0.4, -1.5, 18.0], [-0.5, -0.5, -1.0], 33], [S("vo04", 1.0), [0.0, 0.5, 20.0], [-0.2, 0.8, -1.0], 36], [E("vo04", 0), [2.0, 0.0, 20.0], [2.2, 0.2, -1.0], 36],
    [S("vo05", 0.5), [5.8, -0.4, 14.0], [5.5, -0.8, -1.0], 32], [S("vo06", 0.0), [5.4, -5.2, 10.5], [5.4, -6.0, -1.0], 31], [E("vo06", 0), [5.4, -5.0, 10.8], [5.4, -5.6, -1.0], 31], [S("vo07", 2.0), [5.4, -3.0, 12.0], [5.4, -2.6, -1.0], 32],
    [E("vo07", 0.5), [5.4, 1.0, 14.0], [5.5, 1.6, -1.0], 33], [S("vo08", 0.5), [1.2, -3.5, 26.0], [1.2, -3.2, -1.0], 34], [E("vo09", 0), [0.8, -3.2, 27.0], [1.0, -3.0, -1.0], 34], [E("vo10", 20), [0.4, -3.0, 27.5], [0.8, -2.8, -1.0], 34]];
  const keyed = (i, t) => { let k = 0; while (k < CK.length - 2 && t >= CK[k + 1][0]) k++; const a = CK[k], b = CK[k + 1], e = sm(seg(t, a[0], b[0])); return a[i] instanceof Array ? a[i].map((v, j) => lerp(v, b[i][j], e)) : lerp(a[i], b[i], e); };
  const setHair = (H, f, len, lift, alpha, bscale, teal, vis) => { H.grp.visible = vis; if (!vis) return; H.geo.setDrawRange(0, Math.max(3, Math.floor(H.idx * clamp(len, 0.001, 1) / 3) * 3)); H.grp.position.y = lift; H.hm.opacity = alpha; H.bm.opacity = alpha; H.bulb.scale.set(bscale, 1.2 * bscale, bscale); H.sp.material.opacity = teal * alpha; };

  return {
    renderer,
    seek(t) {
      const cam = { pos: keyed(1, t), look: keyed(2, t), fov: keyed(3, t), roll: 0, sc: "S" }; cam.pos[0] += 0.5 * Math.sin(t * 0.21); cam.pos[1] += 0.25 * Math.sin(t * 0.17 + 1); W3.camPose(t, cam);
      FOL.forEach((f) => { const P = f.key ? pk(f.key, t) : 0, k = Math.floor(P), u = P - k, cur = f.h[k % 2], nxt = f.h[(k + 1) % 2], pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + f.cx);
        const g = sm(clamp(u / 0.55)), len = lerp(0.18, f.lmax, g), reg = sm(seg(u, 0.62, 0.8)), ex = sm(seg(u, 0.88, 1.0)), lift = 2.6 * reg + 30 * ex * ex, alpha = 1 - sm(seg(u, 0.9, 0.99)), bs = lerp(1, 0.55, reg), teal = (1 - reg) * (0.25 + 0.2 * pulse) * (u < 0.62 ? 1 : 0);
        setHair(cur, f, len, lift, Math.max(0.0001, alpha), bs, teal, alpha > 0.01);
        const nl = lerp(0.001, 0.18, ex); setHair(nxt, f, nl, 0, 1, 0.2 + 0.8 * ex, 0.3 * ex * (0.6 + 0.4 * pulse), u > 0.88); });
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.2 + 0.15 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(cam.look[0], cam.look[1], 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(cam);
    },
    anchor() { return null; },
  };
}
