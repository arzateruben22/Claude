// sweat3d.js — Skin Sense S2 E3 ("How sweat cools you") as a 3-D scene in the owner's art (shared base: w3d.js).
// Four sets the camera hard-cuts between, every one always moving:
//   G  a section of skin: the sweat gland's coil, its duct rising to the pore, beads of sweat climbing and a droplet forming on the surface
//   D  one droplet on the skin drying: vapour wisps lift, carrying heat away, the skin under it cools, the droplet shrinks
//   W  a field of beading skin: more beads in the heat, a cloth covering the skin traps the vapour, then lifts away
//   K  a vessel carrying specks of waste past the gland to the kidneys and gut, while the sweat stays clear water
// Units: ≈ 1 mm of an illustrated section. Everything is a pure function of t. create() returns { seek, anchor } for ss3.mjs.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash, D2R } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, fibres, makeTube, NV, mkGlow, glowTex, key, T, AW, BH, BTOP } = W3;
  const SK = T.skin || [0.46, 0.27, 0.18];                                                // the episode's one tone (deep), from the painting
  const hex = (c) => "#" + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0")).join("");
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.5, ...o });
  const groups = { G: new THREE.Group(), D: new THREE.Group(), W: new THREE.Group(), K: new THREE.Group() }, CX = { G: 0, D: 40, W: 80, K: 120 };
  for (const k in groups) { groups[k].position.x = CX[k]; scene.add(groups[k]); }

  // ── textures ───────────────────────────────────────────────────────────────────────────────────────────────
  const skinC = mkCanvas(512, 512), sg = skinC.getContext("2d");
  { sg.fillStyle = hex(SK); sg.fillRect(0, 0, 512, 512); for (let i = 0; i < 90; i++) { sg.fillStyle = `rgba(${SK[0] * 255 + 20 | 0},${SK[1] * 255 + 12 | 0},${SK[2] * 255 + 8 | 0},.1)`; sg.beginPath(); sg.arc(rnd() * 512, rnd() * 512, 14 + rnd() * 40, 0, 7); sg.fill(); }
    sg.lineWidth = 1.2; for (let i = 0; i < 520; i++) { sg.strokeStyle = `rgba(40,18,10,${0.08 + rnd() * 0.12})`; const x = rnd() * 512, y = rnd() * 512, a = (rnd() < 0.5 ? 0.6 : -0.6) + (rnd() - 0.5) * 0.3, L = 14 + rnd() * 36; sg.beginPath(); sg.moveTo(x, y); sg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); sg.stroke(); }
    for (let i = 0; i < 520; i++) { sg.fillStyle = "rgba(30,12,6,.3)"; sg.beginPath(); sg.arc(rnd() * 512, rnd() * 512, 1 + rnd() * 1.3, 0, 7); sg.fill(); } }
  const skinTex = tex(skinC, [6, 6]);
  const skinMat = mat({ map: skinTex, bumpMap: skinTex, bumpScale: 1.6, roughness: 0.75, sheen: 0.1, sheenColor: new THREE.Color(0.6, 0.35, 0.25), clearcoat: 0, envMapIntensity: 0.3 });
  const faceC = mkCanvas(1024, 440), fg = faceC.getContext("2d");
  { const gr = fg.createLinearGradient(0, 0, 0, 440); gr.addColorStop(0, hex(SK.map((v) => v * 1.05))); gr.addColorStop(0.1, hex(SK.map((v) => v * 0.95))); gr.addColorStop(0.135, hex(SK.map((v) => v * 0.6))); gr.addColorStop(0.16, "#f1b9a6"); gr.addColorStop(0.5, "#ec9f90"); gr.addColorStop(0.8, "#e98f80"); gr.addColorStop(0.83, "#f1c47c"); gr.addColorStop(1, "#ecbf60"); fg.fillStyle = gr; fg.fillRect(0, 0, 1024, 440);
    fg.save(); fg.beginPath(); fg.rect(0, 64, 1024, 290); fg.clip(); fibres(fg, 1024, 440, 560, ["#fde4d8", "#f3b6a6", "#d9786b", "#fff0e8"], 200, 2.2); fg.restore();
    fg.save(); fg.beginPath(); fg.rect(0, 364, 1024, 80); fg.clip(); for (let i = 0; i < 170; i++) { const x = rnd() * 1024, y = 360 + rnd() * 80, r = 12 + rnd() * 16; fg.strokeStyle = "rgba(226,160,60,.5)"; fg.fillStyle = `rgba(250,${210 + rnd() * 30 | 0},${110 + rnd() * 50 | 0},.5)`; fg.lineWidth = 2; fg.beginPath(); fg.ellipse(x, y, r, r * 0.85, 0, 0, 7); fg.fill(); fg.stroke(); } fg.restore(); }
  const faceMat = mat({ map: tex(faceC, [1, 1]), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45 }); faceMat.map.wrapS = faceMat.map.wrapT = THREE.ClampToEdgeWrapping;
  const dropMat = mat({ color: 0xffffff, transmission: 1, thickness: 0.7, ior: 1.33, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, specularIntensity: 1, attenuationColor: new THREE.Color(0xe6f4fa), attenuationDistance: 4 });
  const vessM = mat({ color: 0xd9485a, roughness: 0.38, clearcoat: 0.5 }), vessL = new THREE.MeshBasicMaterial({ color: 0x8e2736, side: THREE.BackSide, toneMapped: false });
  const glandM = mat({ color: 0xf3b3a6, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new THREE.Color(1, 0.8, 0.75) });

  // ── set G: the section, the gland, the duct, beads, the surface droplet ────────────────────────────────────
  const GW = 17, GH = 7, face = new THREE.PlaneGeometry(GW, GH, 120, 6); face.translate(0, -GH / 2, 0); const faceMesh = new THREE.Mesh(face, faceMat); faceMesh.receiveShadow = true; groups.G.add(faceMesh);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(GW, 22), skinMat); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, -11); top.receiveShadow = true; groups.G.add(top);
  { const bk = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5ecdf).multiplyScalar(1.5) })); bk.position.set(0, -2, -9); groups.G.add(bk); }
  // the gland: a pink knot (rosette) in the lower dermis, its duct rising in a gentle spiral to the pore
  const tangle = (cx, cy, cz, R, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + R * (0.62 * Math.sin(3 * a + 0.4) + 0.3 * Math.sin(7 * a + 1.1)), cy + R * (0.55 * Math.cos(4 * a + 0.9) + 0.28 * Math.cos(6 * a)), cz + R * 0.55 * Math.sin(5 * a + 0.2)]); } return pts; };
  const CC = [-1.2, -4.9], coilPts = tangle(CC[0], CC[1], 0.15, 1.25, 200), coilR = coilPts.map(() => 0.15);
  const coilT = makeTube(200, 12, glandM, true); coilT.set(coilPts, coilR);
  const PORE = [0.6, 0], ductPts = [], ductR = []; const ductStart = coilPts[coilPts.length - 1]; for (let i = 0; i <= 80; i++) { const u = i / 80, y = lerp(ductStart[1], 0.0, u), x = lerp(ductStart[0], PORE[0], eo(u)) + 0.18 * Math.sin(u * 14) * (1 - u); ductPts.push([x, y, 0.2]); ductR.push(0.07); }
  const ductT = makeTube(80, 10, glandM, true); ductT.set(ductPts, ductR);
  const ductCurve = NV(ductPts.map((p) => p)); groups.G.add(coilT.mesh, ductT.mesh);
  const beadM = mat({ color: 0xe8f6ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, emissive: 0x9cd8ff, emissiveIntensity: 0.25 });
  const beads = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), beadM); groups.G.add(m); return m; });
  const surfDrop = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); surfDrop.position.set(PORE[0], 0.02, 0.2); groups.G.add(surfDrop);
  const smallDrops = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); m.position.set(-7 + hash(i * 3.1) * 14, 0.01, -hash(i * 5.3) * 6 - 0.2); m.userData = { s: 0.08 + hash(i * 7.1) * 0.2, t0: 17.6 + hash(i * 2.2) * 2.4 }; groups.G.add(m); return m; });
  // capillaries (a small branching tree) and a warm shimmer when you heat up
  const vy = (x) => -2.1 + 0.2 * Math.sin(x * 0.6), TREE = [];
  { TREE.push({ x0: -8, x1: 8, y: vy, r: 0.24 }); for (let i = 0; i < 6; i++) { const xb = -6.4 + i * 2.6 + (hash(i * 3.3) - 0.5) * 0.8, up = hash(i * 5.1) < 0.5 ? 1 : -1, len = 0.9 + hash(i * 7.7) * 0.7, dx = (hash(i * 9.1) - 0.5) * 2.2;
      TREE.push({ branch: true, xb, up, len, dx, r: 0.13, y0: vy }); for (let k = 0; k < 2; k++) TREE.push({ branch: true, sub: true, xb: xb + dx * 0.55, yb: len * 0.55, up, len: 0.5 + hash(i * 13 + k) * 0.3, dx: (k ? 1 : -1) * (0.7 + hash(i * 17 + k) * 0.8), r: 0.07, y0: vy }); } }
  const tv = TREE.map(() => ({ t: makeTube(24, 10, vessM, false), l: makeTube(24, 10, vessL, false) })); tv.forEach((v) => groups.G.add(v.t.mesh, v.l.mesh));
  const heatSp = mkGlow(18, 0xffa860); heatSp.forEach((s) => groups.G.add(s));
  const gSig = mkGlow(1, 0xffffff);

  // ── set D: one droplet drying on the skin ──────────────────────────────────────────────────────────────────
  const dSkin = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 60, 60), skinMat); dSkin.rotation.x = -Math.PI / 2; dSkin.receiveShadow = true; groups.D.add(dSkin);
  const dDrop = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); groups.D.add(dDrop);
  const dRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })); dRing.rotation.x = -Math.PI / 2; dRing.position.y = 0.01; groups.D.add(dRing);
  const cool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ color: 0xcfe9f6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending })); cool.rotation.x = -Math.PI / 2; cool.position.y = 0.02; groups.D.add(cool);
  const dSmall = Array.from({ length: 16 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); const a = hash(i * 2.9) * 6.28, r = 2.6 + hash(i * 4.1) * 5; m.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r * 0.8 - 1); m.scale.setScalar(0.12 + hash(i * 6.3) * 0.3); groups.D.add(m); return m; });
  const vap = Array.from({ length: 26 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); s.userData = { ph: hash(i * 1.9), dx: (hash(i * 3.3) - 0.5) * 1.4, sz: 0.9 + hash(i * 5.1) * 1.1 }; groups.D.add(s); return s; });
  const heatD = mkGlow(14, 0xffa050); heatD.forEach((s) => groups.D.add(s));

  // ── set W: a field of beading skin, hot air, a cloth that traps the vapour ─────────────────────────────────
  const wSkin = new THREE.Mesh(new THREE.PlaneGeometry(40, 30, 40, 40), skinMat); wSkin.rotation.x = -Math.PI / 2; wSkin.position.z = -6; wSkin.receiveShadow = true; groups.W.add(wSkin);
  const wDrops = Array.from({ length: 110 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); m.position.set((hash(i * 3.7) - 0.5) * 14, 0.01, -hash(i * 5.9) * 10 + 1.5); m.userData = { s: 0.07 + hash(i * 7.3) * 0.16, order: hash(i * 11.1) }; groups.W.add(m); return m; });
  const clothC = mkCanvas(256, 256), cg = clothC.getContext("2d"); { cg.fillStyle = "#e8ddc9"; cg.fillRect(0, 0, 256, 256); cg.strokeStyle = "rgba(120,100,80,.35)"; cg.lineWidth = 2; for (let i = 0; i < 256; i += 8) { cg.beginPath(); cg.moveTo(i, 0); cg.lineTo(i, 256); cg.stroke(); cg.beginPath(); cg.moveTo(0, i); cg.lineTo(256, i); cg.stroke(); } }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(14, 10, 60, 40), mat({ map: tex(clothC, [7, 5]), roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })); cloth.rotation.x = -Math.PI / 2; cloth.castShadow = true; groups.W.add(cloth);
  const cp = cloth.geometry.attributes.position, cx0 = new Float32Array(cp.count), cz0 = new Float32Array(cp.count); for (let i = 0; i < cp.count; i++) { cx0[i] = cp.getX(i); cz0[i] = cp.getY(i); }
  const wVap = Array.from({ length: 40 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); s.userData = { x: (hash(i * 2.1) - 0.5) * 11, z: -hash(i * 3.3) * 8 + 1, ph: hash(i * 4.4), sz: 0.8 + hash(i * 5.7) }; groups.W.add(s); return s; });
  const wHeat = mkGlow(20, 0xffa050); wHeat.forEach((s) => groups.W.add(s));

  // ── set K: waste rides the blood past the gland; the sweat stays clear ─────────────────────────────────────
  const kc = NV([[-9, -1.4, 0], [-5, -1.1, 0.1], [-1, -1.5, 0], [3, -1.1, 0.1], [7, -1.5, 0], [11, -1.2, 0.1]]), kPts = kc.getPoints(60).map((p) => [p.x, p.y, p.z]);
  const vessK = vessM.clone(); vessK.transparent = true; vessK.opacity = 0.5; vessK.depthWrite = false; const kT = makeTube(60, 16, vessK, false), kL = makeTube(60, 16, vessL, false); kT.set(kPts, kPts.map(() => 0.55)); kL.set(kPts, kPts.map(() => 0.6)); groups.K.add(kT.mesh, kL.mesh);
  const kSkin = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), skinMat); kSkin.rotation.x = -Math.PI / 2; kSkin.position.set(0, 3.2, -4); groups.K.add(kSkin);
  const specks = Array.from({ length: 40 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 + hash(i * 3.7) * 0.07, 12, 8), mat({ color: 0xc6842c, roughness: 0.4, emissive: 0x6e4012, emissiveIntensity: 0.3 })); m.userData = { u: hash(i * 5.1), sp: 0.04 + hash(i * 7.9) * 0.03, o: [(hash(i * 2.2) - 0.5) * 0.7, (hash(i * 8.8) - 0.5) * 0.7] }; groups.K.add(m); return m; });
  const kidneyG = (() => { const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const c = x < 0 ? 0.35 * Math.cos(y * 1.2) * (1 - Math.abs(y) * 0.2) : 0; p.setXYZ(i, (x + c * Math.abs(Math.sin(y * 1.2)) * 0.6) * 1.0, y * 1.35, z * 0.8); } g.computeVertexNormals(); return g; })();
  const kidney = new THREE.Mesh(kidneyG, mat({ color: 0x9f4a52, roughness: 0.35, clearcoat: 0.7 })); kidney.position.set(14.5, -0.9, 0); kidney.scale.setScalar(1.7); groups.K.add(kidney);
  const gutPts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; gutPts.push(new THREE.Vector3(12 + u * 9, -3.2 + Math.sin(u * 14) * 0.5 + u * 1.2, -0.4)); }
  const gut = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gutPts), 120, 0.4, 12, false), mat({ color: 0xe7b9a0, roughness: 0.4, clearcoat: 0.5 })); groups.K.add(gut);
  const kFaceG = new THREE.PlaneGeometry(21, 7.6, 60, 4); const kFace = new THREE.Mesh(kFaceG, faceMat); kFace.position.set(0.5, 3.2 - 3.8, -0.9); kFace.receiveShadow = true; groups.K.add(kFace);
  const kGland = makeTube(200, 12, glandM, true); kGland.set(tangle(0, 0, 0, 0.8, 200), Array(201).fill(0.1)); kGland.mesh.position.set(-4, 1.5, 0.3); groups.K.add(kGland.mesh);
  const kDuct = makeTube(20, 8, glandM, false); { const pts = []; for (let i = 0; i <= 20; i++) pts.push([-4 + 0.1 * Math.sin(i), lerp(2.0, 3.2, i / 20), 0.3]); kDuct.set(pts, pts.map(() => 0.06)); groups.K.add(kDuct.mesh); }
  const kDrop = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), dropMat); kDrop.position.set(-4.1, 3.2, 0.2); kDrop.scale.setScalar(0.5); groups.K.add(kDrop);

  // ── per-frame state ──────────────────────────────────────────────────────────────────────────────────────────
  const warm = (t) => sm(seg(t, 16.2, 18.5)) * (1 - sm(seg(t, 19.2, 20)));
  const setG = (t) => {
    // vessels
    tv.forEach((v, j) => { const T2 = TREE[j], pts = [], rad = [], heat = 1 + 0.1 * Math.sin(t * 3 + j) * warm(t);
      for (let i = 0; i <= 24; i++) { const u = i / 24; let x, y;
        if (!T2.branch) { x = lerp(T2.x0, T2.x1, u); y = T2.y(x); }
        else if (!T2.sub) { const y0 = T2.y0(T2.xb); x = T2.xb + T2.dx * u * u + Math.sin(u * 5 + j) * 0.12; y = y0 + T2.up * T2.len * u * 1.3 + Math.sin(u * 3 + j) * 0.06; }
        else { const y0 = T2.y0(T2.xb) + T2.up * T2.yb; x = T2.xb + T2.dx * u; y = y0 + T2.up * T2.len * u * 1.2; }
        pts.push([x, clamp(y, -3.4, -1.3), 0.15]); rad.push((T2.sub ? lerp(1, 0.45, u) : T2.branch ? lerp(1, 0.6, u) : 0.9 + 0.1 * Math.sin(x * 2)) * T2.r * heat); }
      v.t.set(pts, rad); v.l.set(pts, rad.map((r) => r + 0.035)); });
    // beads climb the duct when the body heats (16.6 →) and keep going; the droplet on the surface swells
    const rel = clamp((t - 16.6) / 1.6); let bi = 0; beads.forEach((b, i) => { const u = ((t - 16.6) * 0.32 - i / beads.length) ; const uu = ((u % 1) + 1) % 1; const on = t > 16.6 && t < 19.9 ? 1 : (t > 4.6 ? 0.25 : 0); const p = ductCurve.getPoint(uu); b.position.set(p.x, p.y, p.z + 0.06); b.visible = on > 0.1 && (t > 16.6 ? true : i < 3); });
    const drop = eo(seg(t, 17.6, 19.8)); surfDrop.scale.setScalar(0.01 + 0.5 * drop); surfDrop.visible = drop > 0.01; surfDrop.scale.y = 0.01 + 0.4 * drop;
    smallDrops.forEach((m) => { const k = eo(seg(t, m.userData.t0, m.userData.t0 + 1.2)); m.scale.set(m.userData.s * k + 0.001, m.userData.s * 0.7 * k + 0.001, m.userData.s * k + 0.001); });
    // warm shimmer rising from the dermis (heat up)
    heatSp.forEach((s, i) => { const U = { ph: hash(i * 3.3), x: -6 + hash(i * 5.9) * 12 }, a = warm(t), y = -3 + ((t * 0.6 + U.ph * 5) % 3); s.position.set(U.x + Math.sin(t + i) * 0.3, y, 0.3); s.scale.setScalar(0.9); s.material.opacity = a * 0.5 * Math.sin(Math.PI * clamp((y + 3) / 3)); });
    coilT.mesh.rotation.z = 0;
  };
  const dropPhase = (t) => (t >= 19.8 && t < 32 ? seg(t, 20.2, 31.0) : t >= 56.5 && t < 66 ? seg(t, 57.2, 62.6) : t < 20 ? 0 : 1);
  const setD = (t) => {
    const u = dropPhase(t), r = lerp(1.5, 0.35, eo(u)); dDrop.scale.set(r * 1.05, r * 0.8 * (1 - 0.15 * u), r); dDrop.position.set(0, 0.0, 0); dRing.scale.setScalar(r * 1.1); dRing.material.opacity = 0.25 * (1 - u);
    cool.material.opacity = 0.35 * Math.sin(Math.PI * clamp(u * 1.0)) * (u > 0 ? 1 : 0); cool.scale.setScalar(0.6 + u * 0.8);
    dSmall.forEach((m, i) => { m.scale.setScalar((0.12 + hash(i * 6.3) * 0.3) * (1 - 0.6 * eo(seg(u, 0.2 + hash(i) * 0.4, 1)))); });
    vap.forEach((s, i) => { const U = s.userData, k = ((t * 0.34 + U.ph) % 1), a = Math.sin(Math.PI * k) * (0.1 + 0.55 * Math.sin(Math.PI * clamp(u))) * (u > 0 && u < 1 ? 1 : 0.15); s.position.set(U.dx + Math.sin(t * 0.8 + i) * 0.4, 0.6 + k * 5.5, 0.2 + Math.cos(i) * 0.4); s.scale.setScalar(U.sz * (0.8 + k)); s.material.opacity = a * 0.4; });
    heatD.forEach((s, i) => { const k = ((t * 0.5 + i * 0.07) % 1); s.position.set(Math.sin(i * 2) * 0.9 + Math.sin(t + i) * 0.2, 0.2 + k * 5, 0.5); s.scale.setScalar(0.45); s.material.opacity = 0.7 * Math.sin(Math.PI * k) * clamp(u * 3) * (u < 1 ? 1 : 0.2); });
  };
  const setW = (t) => {
    const hot = sm(seg(t, 32.6, 35.6)) , exer = sm(seg(t, 34.4, 36.4));                              // more beads in the heat and with exercise
    wDrops.forEach((m, i) => { const U = m.userData, k = eo(seg(hot + exer * 0.5, U.order * 0.9, U.order * 0.9 + 0.3)) * (1 - 0.7 * sm(seg(t, 36.9, 41.2)) * 0); const sh = 1 - 0.6 * sm(seg(t, 41.8, 44.2)) * (0); m.scale.set(U.s * k + 0.001, U.s * 0.65 * k + 0.001, U.s * k + 0.001); });
    const cl = sm(seg(t, 36.4, 38.0)) * (1 - sm(seg(t, 41.4, 42.8))), lift = 0.55 + (1 - sm(seg(t, 36.4, 38.0))) * 4 + sm(seg(t, 41.4, 42.8)) * 4; cloth.position.set(0, lift, -1.5); cloth.visible = lift < 8.5;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, 0.0), cp.setY(i, cz0[i]), cp.setX(i, cx0[i]); cp.needsUpdate = true;
    for (let i = 0; i < cp.count; i++) { const x = cx0[i], z = cz0[i]; cp.setZ(i, 0.18 * Math.sin(x * 0.9 + t * 1.2) * Math.cos(z * 0.8) * cl); } cp.needsUpdate = true; cloth.geometry.computeVertexNormals();
    wVap.forEach((s, i) => { const U = s.userData, k = ((t * 0.35 + U.ph) % 1); let y = 0.3 + k * 6; const cap = cloth.visible ? lift - 0.25 : 9; const trapped = y > cap && cl > 0.2; if (trapped) y = cap - 0.1 - hash(i) * 0.3; s.position.set(U.x + Math.sin(t + i) * 0.4, y, U.z); s.scale.setScalar(U.sz * (trapped ? 1.1 : 0.8 + k)); s.material.opacity = (0.12 + 0.35 * hot) * Math.sin(Math.PI * k) * (trapped ? 0.9 : 1) * 0.5; });
    wHeat.forEach((s, i) => { const k = ((t * 0.45 + i * 0.05) % 1); const up = sm(seg(t, 41.4, 42.4)) + (1 - sm(seg(t, 36.4, 37.8))); s.position.set((hash(i * 3.3) - 0.5) * 9, 0.4 + k * 7 * (0.3 + 0.7 * clamp(up)), -hash(i * 9.1) * 6); s.scale.setScalar(0.5); s.material.opacity = 0.6 * Math.sin(Math.PI * k) * hot * (1 - 0.7 * cl * (1 - sm(seg(t, 41.4, 42.8)))); });
  };
  const setK = (t) => {
    const u0 = (t - 45.3);
    specks.forEach((m, i) => { const U = m.userData, u = (((u0 * U.sp + U.u) % 1) + 1) % 1, p = kc.getPoint(u); m.position.set(p.x + U.o[0] * 0.5, p.y + U.o[1] * 0.5, p.z + U.o[1] * 0.4); m.visible = true; });
    kDrop.scale.set(0.5 + 0.08 * Math.sin(t * 1.4), 0.38 + 0.06 * Math.sin(t * 1.4), 0.5 + 0.08 * Math.sin(t * 1.4)); kGland.mesh.rotation.y = Math.sin(t * 0.5) * 0.6; kGland.mesh.rotation.x = Math.sin(t * 0.4) * 0.3;
    kidney.rotation.y = Math.sin(t * 0.5) * 0.2;
  };

  const V = new THREE.Vector3();
  const ANC = {
    coil: () => [CC[0] + 0.5, CC[1] + 0.4, 0.4], duct: () => { const p = ductCurve.getPoint(0.5); return [p.x, p.y, p.z + 0.1]; }, pore: () => [PORE[0], 0.1, 0.3],
    drop: () => [CX.D, 1.3, 0.4], kidney: () => [CX.K + 14.5, 0.8, 0.5],
  };
  let curSc = "G";
  return {
    renderer,
    seek(t) {
      const c = T.coverCam ? { ...T.coverCam, roll: 0, sc: T.coverCam.sc || "G" } : W3.camAt(t); curSc = c.sc || "G"; for (const k in groups) groups[k].visible = k === curSc;
      W3.camPose(t, c);
      if (curSc === "G") setG(t); else if (curSc === "D") setD(t); else if (curSc === "W") setW(t); else setK(t);
      const cx = CX[curSc]; key.target.position.set(cx, -1, 0); key.position.set(cx - 9, 12, 11); key.target.updateMatrixWorld(); W3.paintSet(t);
      W3.render(c);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); const off = name === "drop" ? 0 : CX[curSc === "G" ? "G" : curSc]; V.set(p[0] + (name === "kidney" || name === "drop" ? 0 : off), p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
