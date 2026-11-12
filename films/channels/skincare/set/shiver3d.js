// shiver3d.js — Skin Sense Season 3, Episode 1 ("What one shiver does inside you"): one continuous camera journey through a soft voxel cut-away of skin (rounded cubes in episode 1's
// deep tone, glowing from within, on a green-black ground), following Evelyn's eight lines: the cool surface; sensors and a teal signal along a nerve; the small vessels near the
// surface narrowing so warm blood stays deep; muscle fibres trembling and making heat; the tiny muscle beside a hair lifting it upright; back up and out to the calm surface.
// Look and finish as in the look test (set/voxel3d.js): shared base set/w3d.js. Pure function of t (anchors come from film.json's lines via episode.json camera specs).
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, mkGlow, glowTex, makeTube, key, rim, T, AW, BH, BTOP, R } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.5; } });
  key.color.set(0xffe2c4); key.intensity = 2.2; key.position.set(-9, 14, 18); key.castShadow = false; rim.color.set(0xffc9a0); rim.intensity = 1.6; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.024);
  const S = (id, off = 0) => R(`start:${id}${off >= 0 ? "+" : ""}${off}`), E = (id, off = 0) => R(`end:${id}${off >= 0 ? "+" : ""}${off}`);     // line anchors from film.json
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, ...o });

  // ── rounded cubes, glowing from within ────────────────────────────────────────────────────────────────────────────────────────
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };
  const cubeG = rbox(0.97, 0.13, 4), cubeM = mat({ roughness: 0.5, envMapIntensity: 0.5 });
  cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.32;"); };

  // ── the block ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const NERVE = [[-1.0, -1.4], [-1.6, -2.8], [-2.6, -4.2], [-3.5, -5.8], [-4.0, -7.6], [-4.3, -10.0]].map((p) => new THREE.Vector3(p[0], p[1], -0.25)), nerve = new THREE.CatmullRomCurve3(NERVE), nPts = nerve.getPoints(70);
  const VY = (x) => -3.8 + 0.18 * Math.sin(x * 0.55 + 0.6), DVY = (x) => -10.0 + 0.25 * Math.sin(x * 0.4 + 1.0);
  const FOL = 3, ARA = [0.5, -1.2], ARB = [FOL, -4.6];                         // the follicle column, the muscle's two ends (relaxed)
  const distSeg = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], k = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(px - a[0] - k * dx, py - a[1] - k * dy); };
  const groove = (x, y) => nPts.some((p) => Math.hypot(p.x - x, p.y - y) < 0.72) || Math.abs(y - VY(x)) < 0.8 || Math.abs(y - DVY(x)) < 1.0 || (x === FOL && y <= 0 && y >= -7) || distSeg(x, y, ARA, ARB) < 0.62 || [[-1.7, -0.8], [-1.0, -0.6], [-0.4, -0.9]].some(([a, b]) => Math.hypot(a - x, b - y) < 0.7) ||
    [-6, -3.5, 0, 4.5, 6.5].some((cx) => Math.abs(x - cx) < 0.55 && y >= VY(cx) && y <= -1.8);
  const topH = (x, z) => (Math.sin(x * 0.9 + z * 0.6) + Math.sin(x * 0.4 - z * 1.3) + 2 * hash(Math.round(x) * 31 + Math.round(z) * 7)) > 1.9 ? 1 : 0;
  const cols = [[-1, 0x55301f], [-4, 0x633626], [-8, 0x74403a], [-12, 0x84463f], [-40, 0x924f48]].map(([y, c]) => [y, new THREE.Color(c)]), colOf = (y) => { for (const [lim, c] of cols) if (y >= lim) return c; return cols[cols.length - 1][1]; };
  const cells = [], X0 = -9, X1 = 8, YB = -27;
  for (let x = X0; x <= X1; x++) for (let y = 0; y >= YB; y--) { const zmin = y >= -1 ? -9 : y >= -7 ? -2 : -2;
    for (let z = zmin; z <= 0; z++) { if (y === 0 && !(topH(x, z) && true)) continue; if (z === 0 && groove(x, y)) continue; if (y <= -14 && y >= -20 && z >= -1) continue;                       // the muscle window
      cells.push({ x, y, z, c: colOf(y).clone().offsetHSL((hash(x * 7 + y * 13 + z * 3) - 0.5) * 0.02, 0, (hash(x * 3 + y * 5 + z * 11) - 0.5) * 0.07 + (z < 0 && y < -1 ? -0.03 * Math.min(3, -z) : 0)) }); } }
  const block = new THREE.InstancedMesh(cubeG, cubeM, cells.length); block.frustumCulled = false; const D = new THREE.Object3D();
  cells.forEach((c, i) => { D.position.set(c.x, c.y, c.z); D.updateMatrix(); block.setMatrixAt(i, D.matrix); block.setColorAt(i, c.c); }); scene.add(block);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 34), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a1c18) })); back.position.set(0, -17, -2.6); scene.add(back);   // behind the muscle window
  const glowBack = mkGlow(1, 0xff8a4a)[0]; glowBack.scale.set(46, 52, 1); glowBack.position.set(0, -10, -7); glowBack.material.opacity = 0.16; glowBack.material.fog = false; scene.add(glowBack);
  const rimGlow = mkGlow(1, 0xff9a60)[0]; rimGlow.scale.set(30, 6, 1); rimGlow.position.set(0, 0.3, -4.5); rimGlow.material.opacity = 0.05; rimGlow.material.fog = false; scene.add(rimGlow);

  // ── hairs: fine, dark, tapered, each from its own small bump ────────────────────────────────────────────────────────────────────
  const NH = 70, hairs = []; for (let i = 0; i < NH; i++) { const x = -9 + hash(i * 3.1) * 17, z = -8.5 + hash(i * 5.7) * 7.8, yaw = (hash(i * 7.3) - 0.5) * 1.4, L = 1.6 + hash(i * 9.9) * 0.9; hairs.push({ x: Math.round(x * 2) / 2, z: Math.round(z), yaw, L, d: hash(i * 1.3) * 2.4, lean: (hash(i * 2.9) - 0.5) * 0.3, y: topH(Math.round(x * 2) / 2, Math.round(z)) ? 0.5 : -0.5 }); }
  const hg = new THREE.CylinderGeometry(0.008, 0.026, 1, 5, 4, true); hg.translate(0, 0.5, 0);
  const hairM = new THREE.MeshStandardMaterial({ color: 0x140a05, roughness: 0.5, emissive: 0x3a1a0a, emissiveIntensity: 0.6 }), hairI = new THREE.InstancedMesh(hg, hairM, NH + 1); hairI.frustumCulled = false; scene.add(hairI);
  const bumpI = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4a2819, roughness: 0.5, emissive: 0x2a1209, emissiveIntensity: 0.5 }), NH); bumpI.frustumCulled = false; scene.add(bumpI);
  const O = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const rootG = new THREE.CylinderGeometry(0.1, 0.1, 7.2, 8), root = new THREE.Mesh(rootG, hairM); root.position.set(FOL, -3.4, 0); scene.add(root);                        // the hero hair's root inside the follicle column
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.5, emissive: 0xff8a4a, emissiveIntensity: 0.1 })); bulb.position.set(FOL, -7.0, 0); bulb.scale.y = 1.25; scene.add(bulb);
  const muscleM = new THREE.MeshStandardMaterial({ color: 0x7a3a4c, roughness: 0.55, emissive: 0x3a1420, emissiveIntensity: 0.4 }), araT = makeTube(30, 10, muscleM, false);

  // ── the nerve: a round glowing fibre, fine branching endings, a small bright teal pulse with a soft trail ────────────────────
  const NSEG = 140, ng = new THREE.TubeGeometry(nerve, NSEG, 0.05, 8, false), ncol = new Float32Array(ng.attributes.position.count * 3); ng.setAttribute("color", new THREE.BufferAttribute(ncol, 3));
  scene.add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  const tipM = new THREE.MeshBasicMaterial({ color: 0x2fa89a, toneMapped: false }), tips = [[-1.0, -1.4, -1.55, -0.75], [-1.0, -1.4, -1.25, -0.55], [-1.0, -1.4, -0.95, -0.55], [-1.0, -1.4, -0.45, -0.75], [-1.0, -1.4, -0.2, -1.05], [-1.3, -0.65, -1.7, -0.3], [-0.45, -0.75, -0.2, -0.4]];
  tips.forEach(([a, b, c, d]) => { scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(a, b, -0.25), new THREE.Vector3(c, d, -0.25)]), 6, 0.022, 6, false), tipM)); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), tipM); bb.position.set(c, d, -0.25); scene.add(bb); });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(nerve, 50, 0.15, 8, false), new THREE.MeshBasicMaterial({ color: 0x3fbfae, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending })));
  const gcv = mkCanvas(128, 128), gx = gcv.getContext("2d"); { const g = gx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = g; gx.fillRect(0, 0, 128, 128); }
  const gtex = new THREE.CanvasTexture(gcv), pulse = [0xeafffb, 0x3fbfae, 0x2fa89a].map((c) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: c, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false })); sp.renderOrder = 10; scene.add(sp); return sp; });
  const cool = mkGlow(30, 0xbfeee6); cool.forEach((s, i) => { s.material.fog = false; s.userData = { y: -0.2 + hash(i * 3.3) * 3.0, z: -7 + hash(i * 5.7) * 7, sp: 1.3 + hash(i * 7.9) * 1.1, x0: -16 + hash(i * 2.3) * 22 }; scene.add(s); });
  const nBase = new THREE.Color(0.01, 0.12, 0.105), nPeak = new THREE.Color(0.25, 1.15, 1.0), cc = new THREE.Color(), np = ng.attributes.position, nuv = ng.attributes.uv;

  // ── vessels: a surface plexus that narrows, a deep vessel that glows warm ─────────────────────────────────────────────────────────
  const vessM = new THREE.MeshStandardMaterial({ color: 0x5a1820, roughness: 0.55, emissive: 0x4a0f14, emissiveIntensity: 0.4 }), vT = makeTube(80, 12, vessM, false), branchT = [-6, -3.5, 0, 4.5, 6.5].map(() => makeTube(14, 8, vessM, false)), dT = makeTube(80, 12, vessM, false);
  const vPts = []; for (let i = 0; i <= 80; i++) { const x = lerp(X0 - 1, X1 + 1, i / 80); vPts.push([x, VY(x), 0.05]); } const dPts = vPts.map(([x]) => [x, DVY(x), 0.05]);
  // ── muscle fibres: rounded bars in a window of the cut face, trembling and heating ─────────────────────────────────────────────
  const barG = rbox(1, 0.32, 5), barM = new THREE.MeshStandardMaterial({ color: 0x5a2523, roughness: 0.6, emissive: 0x000000 }), bars = []; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) bars.push({ x: -7.4 + k * 4.4 + (r % 2) * 1.2, y: -14.5 - r * 1.4, len: 3.7 + hash(r * 4 + k) * 0.3 });
  const barI = new THREE.InstancedMesh(barG, barM, bars.length); barI.frustumCulled = false; scene.add(barI);
  const heatS = mkGlow(40, 0xff8a3a); heatS.forEach((s, i) => { s.material.fog = false; s.userData = { x: -8 + hash(i * 3.7) * 16, ph: hash(i * 5.3), sp: 0.12 + hash(i * 9.1) * 0.1 }; scene.add(s); });
  const dust = mkGlow(40, 0xffc89a); dust.forEach((s, i) => { s.material.fog = false; s.userData = { x: -9 + hash(i * 3.3) * 18, y: -26 + hash(i * 5.9) * 28, z: -hash(i * 7.1) * 6 + 3, sp: 0.04 + hash(i * 9.7) * 0.06, ph: hash(i * 1.1) * 6.28 }; scene.add(s); });

  // ── per frame ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const t2 = { pS: S("vo02", 2.7), pE: E("vo02", 3.0), nar: S("vo04", 1.0), narE: S("vo04", 4.2), trem0: S("vo05", 2.2), trem1: S("vo05", 5.0), tremOff: S("vo07", -0.3), heat0: S("vo06", 1.6), heat1: S("vo06", 5.0), heatOff: S("vo07", 4.5), up0: S("vo07", 1.8), up1: S("vo07", 4.6), wave0: S("vo07", 2.4) };
  const MD = new THREE.Object3D(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
  return {
    renderer,
    seek(t) {
      const c = W3.camAt(t); W3.camPose(t, c);
      const tz = 1 - sm(seg(t, 1.0, S("vo01", 3.0)));   // v2 opening: the film starts on the payoff (hairs standing, the little muscle pulled) and settles back to the cool, flat surface
      // surface hairs: lying flat, then rising in a wave when the muscle pulls
      for (let i = 0; i < NH; i++) { const h = hairs[i], r = Math.max(tz, sm(seg(t, t2.wave0 + h.d, t2.wave0 + h.d + 1.1))), pitch = lerp(0.1, 1.4, r), sway = 0.02 * Math.sin(t * 1.3 + i);
        dir.set(Math.cos(h.yaw) * Math.cos(pitch + sway), Math.sin(pitch + sway), Math.sin(h.yaw) * Math.cos(pitch) + h.lean * r).normalize(); O.position.set(h.x, h.y, h.z); O.quaternion.setFromUnitVectors(up, dir); O.scale.set(1, h.L, 1); O.updateMatrix(); hairI.setMatrixAt(i, O.matrix);
        O.position.set(h.x, h.y - 0.03, h.z); O.quaternion.identity(); O.scale.set(0.05 + 0.1 * r, 0.02 + 0.06 * r, 0.05 + 0.1 * r); O.updateMatrix(); bumpI.setMatrixAt(i, O.matrix); }
      const pull = Math.max(tz, sm(seg(t, t2.up0, t2.up1)));                                                                                                        // the little muscle shortens: the hero hair stands up
      const hp = lerp(0.12, 1.45, pull); dir.set(Math.cos(hp), Math.sin(hp), 0); O.position.set(FOL, 0.45, 0); O.quaternion.setFromUnitVectors(up, dir); O.scale.set(2.2, 3.2, 2.2); O.updateMatrix(); hairI.setMatrixAt(NH, O.matrix);
      hairI.instanceMatrix.needsUpdate = bumpI.instanceMatrix.needsUpdate = true;
      const ax = lerp(ARA[0], ARA[0] + (ARB[0] - ARA[0]) * 0.22, pull), ay = lerp(ARA[1], ARA[1] + (ARB[1] - ARA[1]) * 0.22, pull), mp = [], mr = [], mth = 0.2 + 0.1 * pull;
      for (let i = 0; i <= 30; i++) { const u = i / 30; mp.push([lerp(ax, ARB[0], u), lerp(ay, ARB[1], u), 0.02]); mr.push(mth * (0.8 + 0.5 * Math.sin(Math.PI * u))); } araT.set(mp, mr); muscleM.emissiveIntensity = 0.4 + 0.9 * Math.sin(Math.PI * clamp(pull)) * 0.8 + 0.3 * pull;
      // the nerve and its pulse
      const u = eio(seg(t, t2.pS, t2.pE)), act = seg(t, t2.pS - 0.2, t2.pS + 0.3) * (1 - sm(seg(t, t2.pE - 0.3, t2.pE + 1.2)));
      for (let i = 0; i < np.count; i++) { const uu = nuv.getY(i), d = uu - u, g = Math.exp(-(d * d) / (2 * 0.04 * 0.04)) * act, tail = d < 0 && d > -0.3 ? Math.exp(d * 10) * 0.28 * act : 0; cc.copy(nBase).lerp(nPeak, clamp(g + tail)); ncol[i * 3] = cc.r; ncol[i * 3 + 1] = cc.g; ncol[i * 3 + 2] = cc.b; }
      ng.attributes.color.needsUpdate = true;
      pulse.forEach((s, i) => { s.position.copy(nerve.getPoint(clamp(u - i * 0.025))); s.position.z += 0.25; s.scale.setScalar([0.5, 0.95, 1.4][i]); s.material.opacity = act * [1, 0.55, 0.22][i]; });
      cool.forEach((s, i) => { const U = s.userData, x = U.x0 + ((t * U.sp * 2.2) % 26) - 5; s.position.set(x, U.y, U.z); s.scale.set(3.2, 0.16, 1); s.material.opacity = 0.11 * (1 - sm(seg(t, S("vo03", 0), S("vo03", 3)))) * sm(seg(t, 0.6, 2.4)); });
      // vessels
      const narrow = sm(seg(t, t2.nar, t2.narE)), vr = lerp(0.34, 0.15, narrow), rr = vPts.map(() => vr), ripple = 1 + 0.03 * Math.sin(t * 2.4);
      vT.set(vPts, rr.map((r, i) => r * ripple)); [-6, -3.5, 0, 4.5, 6.5].forEach((cx, k) => { const pts = [], rad = []; for (let i = 0; i <= 14; i++) { const v = i / 14; pts.push([cx + 0.3 * Math.sin(v * 3 + k), lerp(VY(cx), -1.9, v), 0.05]); rad.push(lerp(0.14, 0.07, v) * lerp(1, 0.45, narrow)); } branchT[k].set(pts, rad); });
      dT.set(dPts, dPts.map(() => 0.5)); vessM.emissiveIntensity = 0.4 + 0.35 * narrow;
      // muscle: tremble, then heat
      const trem = sm(seg(t, t2.trem0, t2.trem1)) * (1 - sm(seg(t, t2.tremOff, t2.tremOff + 1.4))), heat = sm(seg(t, t2.heat0, t2.heat1)) * (1 - sm(seg(t, t2.heatOff, t2.heatOff + 3.5)));
      bars.forEach((b, i) => { MD.position.set(b.x + trem * 0.05 * (Math.sin(t * 47 + i * 3.1) + Math.sin(t * 61 + i * 1.7)), b.y + trem * 0.05 * (Math.sin(t * 53 + i * 2.3) + Math.sin(t * 71 + i)), 0.1); MD.scale.set(b.len * (1 - 0.03 * trem * Math.sin(t * 30 + i)), 1.0, 1.0); MD.updateMatrix(); barI.setMatrixAt(i, MD.matrix); }); barI.instanceMatrix.needsUpdate = true;
      barM.emissive.setRGB(1.0, 0.3, 0.08).multiplyScalar(0.2 * heat); barM.color.setRGB(0.26 + 0.1 * heat, 0.085, 0.08);
      heatS.forEach((s, i) => { const U = s.userData, k = (t * U.sp + U.ph) % 1; s.position.set(U.x + 0.4 * Math.sin(t + i), -19 + k * 17, 0.8); s.scale.setScalar(1.4 + 1.2 * k); s.material.opacity = 0.2 * heat * Math.sin(Math.PI * k); });
      dust.forEach((s, i) => { const U = s.userData; s.position.set(U.x + 0.4 * Math.sin(t * U.sp * 4 + U.ph), U.y + ((t * U.sp * 2) % 1.5) * 0.3, U.z); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.22 + 0.18 * Math.sin(t * 0.8 + U.ph); });
      key.target.position.set(c.look[0], c.look[1], 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(c);
    },
    anchor() { return null; },
  };
}
