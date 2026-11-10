// finger3d.js — Skin Sense S2 E2 ("Why fingers wrinkle in water") as a real three.js scene in the owner's art (shared base: w3d.js).
// Four sets, each a group the camera hard-cuts between, every one always moving:
//   F  two fingertips (one smooth, one wrinkling in water: rippling surface, bubbles)
//   S  a cut section of the fingertip: a gold nerve fires, capillaries narrow, the tissue shrinks, the surface folds into ridges
//   N  a macro of one nerve meeting a capillary: pulses run in, the vessel narrows; then the nerve is cut off (no signal, no narrowing)
//   P  wrinkled and smooth fingers pushing wet pebbles across a table: one study (faster), a later study (no difference)
// Units: 1 ≈ 1 mm of an illustrated section. Everything is a pure function of t. create() returns { seek, anchor } for ss3.mjs.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash, D2R } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, fibres, makeTube, NV, mkGlow, glowTex, key, rim, R, EP, T, AW, BH, BTOP } = W3;
  const MED = [0.73, 0.415, 0.282];                                                      // medium melanin, from the painting's fingertip (186, 106, 72)
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.5, ...o });
  const groups = { F: new THREE.Group(), S: new THREE.Group(), N: new THREE.Group(), P: new THREE.Group() };
  const CX = { F: 0, S: 40, N: 80, P: 120 }; for (const k in groups) { groups[k].position.x = CX[k]; scene.add(groups[k]); }

  // ── textures: skin with a fingerprint (whorl), bump from the same lines ──────────────────────────────────
  const skinC = mkCanvas(512, 1024), sg = skinC.getContext("2d"), bumpC = mkCanvas(512, 1024), bg = bumpC.getContext("2d");
  { sg.fillStyle = "#bd6a47"; sg.fillRect(0, 0, 512, 1024); for (let i = 0; i < 160; i++) { sg.fillStyle = `rgba(${200 + rnd() * 30 | 0},${105 + rnd() * 40 | 0},${70 + rnd() * 30 | 0},.08)`; sg.beginPath(); sg.arc(rnd() * 512, rnd() * 1024, 12 + rnd() * 40, 0, 7); sg.fill(); }
    bg.fillStyle = "#808080"; bg.fillRect(0, 0, 512, 1024);
    for (let i = 1; i < 110; i++) { const rx = i * 7.4, ry = i * 11.8, a = Math.min(0.5, 0.15 + i * 0.004); sg.strokeStyle = `rgba(120,52,30,${a * 0.55})`; sg.lineWidth = 1.5; sg.beginPath(); sg.ellipse(256, 940, rx, ry, 0, 0, Math.PI * 2); sg.stroke(); bg.strokeStyle = "#d8d8d8"; bg.lineWidth = 2.4; bg.beginPath(); bg.ellipse(256, 940, rx, ry, 0, 0, Math.PI * 2); bg.stroke(); } }
  const wrC = mkCanvas(1024, 1024), wg = wrC.getContext("2d"); { wg.fillStyle = "#6a6a6a"; wg.fillRect(0, 0, 1024, 1024);
    const ridge = (x0, y0, len, w, ph) => { wg.beginPath(); for (let k = 0; k <= 40; k++) { const v = k / 40, y = y0 + v * len, x = x0 + Math.sin(v * 7 + ph) * 26 + Math.sin(v * 17 + ph * 2) * 8; k ? wg.lineTo(x, y) : wg.moveTo(x, y); } for (const [lw, col] of [[w, "#9a9a9a"], [w * 0.62, "#c0c0c0"], [w * 0.28, "#e8e8e8"]]) { wg.lineWidth = lw; wg.strokeStyle = col; wg.lineCap = "round"; wg.stroke(); } };
    for (let i = 0; i < 20; i++) ridge(i * 52 + 20 + (rnd() - 0.5) * 14, 40 + rnd() * 160, 500 + rnd() * 400, 22 + rnd() * 10, rnd() * 6);
    for (let i = 0; i < 20; i++) ridge(i * 52 + 46 + (rnd() - 0.5) * 14, 300 + rnd() * 300, 300 + rnd() * 300, 16 + rnd() * 8, rnd() * 6);
    for (let i = 0; i < 26; i++) { const x = rnd() * 1024, y = rnd() * 900, a = (rnd() - 0.5) * 1.2; wg.beginPath(); wg.moveTo(x, y); wg.lineTo(x + Math.cos(a) * 120, y + 60 + Math.sin(a) * 60); wg.lineWidth = 12; wg.strokeStyle = "#b0b0b0"; wg.lineCap = "round"; wg.stroke(); } }
  const skinTex = tex(skinC, [1, 1]), bumpTex = tex(wrC, [1, 1]); skinTex.wrapS = bumpTex.wrapS = THREE.ClampToEdgeWrapping; skinTex.wrapT = bumpTex.wrapT = THREE.ClampToEdgeWrapping;
  skinTex.wrapS = bumpTex.wrapS = THREE.RepeatWrapping;

  // ── a fingertip: a capsule whose pad folds with `A` (0 smooth … 1 deeply wrinkled) ───────────────────────
  const RAD = 2.1, LC = 9.0, STOT = LC + RAD, NXR = 110, NT = 72;
  const makeFinger = (seed, parent) => {
    const g = new THREE.PlaneGeometry(1, 1, NT, NXR), P = g.attributes.position, UV = g.attributes.uv;
    const meta = []; for (let j = 0; j <= NXR; j++) for (let i = 0; i <= NT; i++) { const k = j * (NT + 1) + i; const th = (i / NT) * Math.PI * 2 - Math.PI, s = (j / NXR) * STOT; meta.push([th, s]); UV.setXY(k, i / NT, 1 - s / STOT * 0.9); }
    const m = mat({ map: skinTex, bumpMap: bumpTex, bumpScale: 0.05, color: new THREE.Color(0.95, 0.9, 0.88), roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(1, 0.75, 0.65), clearcoat: 0.08, clearcoatRoughness: 0.5 });
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; parent.add(mesh);
    const set = (A, wet = 0) => { m.bumpScale = 0.05 + 6.5 * A; m.color.setRGB(0.95 - 0.06 * A, 0.9 - 0.08 * A, 0.88 - 0.08 * A);
      m.clearcoat = 0.08 + 0.7 * wet; m.clearcoatRoughness = 0.5 - 0.35 * wet;
      for (let k = 0; k < meta.length; k++) { const [th, s] = meta[k]; let r, y, ny = 0, nr = 1;
        if (s <= LC) { r = RAD; y = s; } else { const ph = (s - LC) / RAD; const a = Math.min(Math.PI / 2, ph * (Math.PI / 2)); r = RAD * Math.cos(a); y = LC + RAD * Math.sin(a); nr = Math.cos(a); ny = Math.sin(a); }
        const pad = Math.pow(clamp(Math.cos(th) + 0.1, 0, 1), 1.2), tipw = sm(clamp((s - 1.5) / 4)), q = th * RAD;
        const f = Math.sin(q * 4.4 + 1.6 * Math.sin(s * 0.9 + seed) + 1.0 * Math.sin(s * 0.33 + q * 0.7 + seed * 2)), cr = 0.45 * Math.sin(s * 2.4 + q * 1.3 + 2 * Math.sin(q * 0.9 + seed)), d = A * 0.42 * (f * 0.75 + cr * 0.5) * pad * tipw * Math.min(1, nr * 1.6);
        const nx = nr * Math.sin(th), nz = nr * Math.cos(th);
        P.setXYZ(k, (r + d * nr) * Math.sin(th), y + d * ny * 0.3, (r + d * nr) * Math.cos(th)); }
      P.needsUpdate = true; g.computeVertexNormals(); };
    set(0); return { mesh, set };
  };

  // ── set F: two fingers (hook, water), ripples, bubbles ───────────────────────────────────────────────────
  const fL = makeFinger(1.3, groups.F), fR = makeFinger(4.1, groups.F); fL.mesh.position.set(-2.35, -9, 0); fR.mesh.position.set(2.35, -9, 0);
  const WY = 4.6;                                                                               // the water surface, over the fingertips
  const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 22, 90, 66), new THREE.MeshPhysicalMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.1, roughness: 0.15, clearcoat: 0.4, clearcoatRoughness: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.35 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WY; groups.F.add(water);
  const wp = water.geometry.attributes.position, wx = new Float32Array(wp.count), wz = new Float32Array(wp.count); for (let i = 0; i < wp.count; i++) { wx[i] = wp.getX(i); wz[i] = wp.getY(i); }
  const tint = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 22), new THREE.MeshBasicMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.BackSide })); tint.position.y = WY - 7; groups.F.add(tint);
  const bub = Array.from({ length: 46 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending })); s.userData = { x: (hash(i * 1.7) - 0.5) * 9, z: (hash(i * 2.3) - 0.3) * 4, sp: 0.5 + hash(i * 3.1) * 0.9, ph: hash(i * 4.9) * 9, sz: 0.08 + hash(i * 5.3) * 0.16 }; groups.F.add(s); return s; });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xf0e6d6, roughness: 0.9 })); table.rotation.x = -Math.PI / 2; table.position.y = -9.05; table.receiveShadow = true; groups.F.add(table);

  // ── set S: the section ────────────────────────────────────────────────────────────────────────────────────
  const SWd = 17, SHt = 6.4, NXs = 170, NYs = 16;
  const faceC = mkCanvas(1024, 400), fg = faceC.getContext("2d");
  { fg.fillStyle = "#e9b09b"; fg.fillRect(0, 0, 1024, 400); const gr = fg.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, "#c27749"); gr.addColorStop(0.12, "#b66a41"); gr.addColorStop(0.145, "#8f4a2c"); gr.addColorStop(0.17, "#f3cdb9"); gr.addColorStop(0.5, "#eeb7a3"); gr.addColorStop(0.8, "#eaa58f"); gr.addColorStop(0.83, "#f2cd82"); gr.addColorStop(1, "#ecc064"); fg.fillStyle = gr; fg.fillRect(0, 0, 1024, 400);
    for (let i = 0; i < 90; i++) { fg.strokeStyle = `rgba(120,58,30,${0.1 + rnd() * 0.12})`; fg.lineWidth = 1.2; const x = rnd() * 1024; fg.beginPath(); fg.moveTo(x, 4 + rnd() * 10); fg.bezierCurveTo(x + 8, 20, x - 8, 30, x + 3, 44); fg.stroke(); }
    fg.save(); fg.beginPath(); fg.rect(0, 68, 1024, 260); fg.clip(); fibres(fg, 1024, 400, 520, ["#fdf0e6", "#f6d3c4", "#e6a08e", "#fff7f0"], 200, 2.2); fg.restore();
    fg.save(); fg.beginPath(); fg.rect(0, 332, 1024, 70); fg.clip(); for (let i = 0; i < 160; i++) { const x = rnd() * 1024, y = 330 + rnd() * 70, r = 12 + rnd() * 16; fg.strokeStyle = "rgba(226,160,60,.5)"; fg.fillStyle = `rgba(250,${210 + rnd() * 30 | 0},${110 + rnd() * 50 | 0},.5)`; fg.lineWidth = 2; fg.beginPath(); fg.ellipse(x, y, r, r * 0.85, 0, 0, 7); fg.fill(); fg.stroke(); } fg.restore(); }
  const faceMat = mat({ map: tex(faceC, [1, 1]), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45 }); faceMat.map.wrapS = faceMat.map.wrapT = THREE.ClampToEdgeWrapping;
  const face = new THREE.PlaneGeometry(SWd, SHt, NXs, NYs); face.translate(0, -SHt / 2, 0); const fp = face.attributes.position, fx0 = new Float32Array(fp.count), fy0 = new Float32Array(fp.count); for (let i = 0; i < fp.count; i++) { fx0[i] = fp.getX(i); fy0[i] = fp.getY(i); }
  const faceMesh = new THREE.Mesh(face, faceMat); faceMesh.receiveShadow = true; groups.S.add(faceMesh);
  const topMat = mat({ map: skinTex, bumpMap: bumpTex, bumpScale: 1.6, color: new THREE.Color(0.95, 0.88, 0.84), roughness: 0.6 });
  const top = new THREE.PlaneGeometry(SWd, 4, NXs, 8); top.rotateX(-Math.PI / 2); top.translate(0, 0, -2); const tp = top.attributes.position, tx0 = new Float32Array(tp.count); for (let i = 0; i < tp.count; i++) tx0[i] = tp.getX(i);
  const topMesh = new THREE.Mesh(top, topMat); topMesh.receiveShadow = true; groups.S.add(topMesh);
  const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0xf5ecdf })); backMesh.position.set(0, -2, -6); groups.S.add(backMesh);
  const fold = (x) => Math.sin(x * 1.25 + 0.6) * 0.9 + Math.sin(x * 2.7 + 1.7) * 0.42 + Math.sin(x * 0.55 + 3.1) * 0.5;
  const MV = { vessel: mat({ color: 0xd9485a, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 }), vline: new THREE.MeshBasicMaterial({ color: 0x8e2736, side: THREE.BackSide, toneMapped: false }), nerve: mat({ color: 0xf0bb55, roughness: 0.3, emissive: 0xc88a1a, emissiveIntensity: 0.1, clearcoat: 0.6 }) };
  const sv = []; const vessel = (r0) => ({ t: makeTube(30, 12, MV.vessel, false), l: makeTube(30, 12, MV.vline, false) }); [0, 1, 2, 3].forEach(() => sv.push(vessel()));
  sv.forEach((v) => { groups.S.add(v.t.mesh, v.l.mesh); });
  const vPath = [ (x) => -1.75 + 0.18 * Math.sin(x * 0.7), (x) => -1.15 + 0.12 * Math.sin(x * 1.1 + 1), (x) => -2.6 + 0.2 * Math.sin(x * 0.9 + 2), (x) => -0.8 + 0.1 * Math.sin(x * 1.4) ];
  const vX = [[-7.5, 8], [-6, 7], [-7, 7.5], [-5, 6.5]], vR = [0.26, 0.15, 0.17, 0.11];
  const sNerve = NV([[7.8, -5.7, 0.3], [6.4, -4.6, 0.36], [5.0, -4.0, 0.3], [3.8, -3.1, 0.36], [2.9, -2.4, 0.3], [2.4, -1.9, 0.3]]); const nTube = new THREE.Mesh(new THREE.TubeGeometry(sNerve, 60, 0.07, 8, false), MV.nerve); groups.S.add(nTube);
  const nB1 = new THREE.Mesh(new THREE.TubeGeometry(NV([[5.0, -4.0, 0.3], [5.6, -3.0, 0.2], [6.6, -2.2, 0.2]]), 24, 0.045, 8, false), MV.nerve); groups.S.add(nB1);
  const nB2 = new THREE.Mesh(new THREE.TubeGeometry(NV([[3.8, -3.1, 0.36], [2.4, -3.5, 0.2], [1.2, -4.3, 0.2]]), 24, 0.045, 8, false), MV.nerve); groups.S.add(nB2);
  const sSig = mkGlow(10, 0xb8fff2); sSig.forEach((s) => groups.S.add(s));

  // ── set N: one nerve meeting one capillary, then the nerve is cut off ───────────────────────────────────
  const ncurve = NV([[-10, -0.6, 0], [-7.5, 0.5, 0.4], [-5, -0.4, -0.2], [-2.5, 0.35, 0.3], [0, 0, 0.1], [1.6, -0.1, 0.1]]);
  const BR = 0.55;                                                                                 // where along the nerve the cut happens (u)
  const ptsAll = ncurve.getPoints(60), cutIdx = Math.round(BR * 60), cA = new THREE.CatmullRomCurve3(ptsAll.slice(0, cutIdx + 1)), cB = new THREE.CatmullRomCurve3(ptsAll.slice(cutIdx));
  const fibA = [], fibB = []; const matA = mat({ color: 0xf0bb55, roughness: 0.3, emissive: 0xc88a1a, emissiveIntensity: 0.15, clearcoat: 0.6 }), matB = mat({ color: 0xf0bb55, roughness: 0.3, emissive: 0xc88a1a, emissiveIntensity: 0.15, clearcoat: 0.6 });
  const sheathM = mat({ color: 0xfbe7d2, roughness: 0.4, transparent: true, opacity: 0.2, depthWrite: false });
  const twist = (c, ph, rr) => { const n = 120, pts = []; for (let i = 0; i <= n; i++) { const u = i / n, p = c.getPoint(u), q = c.getPoint(Math.min(1, u + 0.01)), tg = q.clone().sub(p).normalize(); const nrm = new THREE.Vector3(0, 1, 0).cross(tg).normalize(), bn = tg.clone().cross(nrm); const a = ph + u * 14; pts.push(p.clone().addScaledVector(nrm, Math.cos(a) * rr).addScaledVector(bn, Math.sin(a) * rr)); } return new THREE.CatmullRomCurve3(pts); };
  for (let f = 0; f < 6; f++) { const ph = f * Math.PI / 3; const a = new THREE.Mesh(new THREE.TubeGeometry(twist(cA, ph, 0.2), 90, 0.075, 8, false), matA), b = new THREE.Mesh(new THREE.TubeGeometry(twist(cB, ph + 0.5, 0.2), 90, 0.075, 8, false), matB); a.castShadow = b.castShadow = true; groups.N.add(a, b); }
  groups.N.add(new THREE.Mesh(new THREE.TubeGeometry(cA, 60, 0.42, 16, false), sheathM), new THREE.Mesh(new THREE.TubeGeometry(cB, 60, 0.42, 16, false), sheathM));
  const capM = mat({ color: 0xd9485a, roughness: 0.36, clearcoat: 0.55 }), capL = new THREE.MeshBasicMaterial({ color: 0x8e2736, side: THREE.BackSide, toneMapped: false });
  const cap = makeTube(40, 18, capM, false), capO = makeTube(40, 18, capL, false); groups.N.add(cap.mesh, capO.mesh);
  const cap2 = makeTube(30, 12, capM, false), cap2O = makeTube(30, 12, capL, false); groups.N.add(cap2.mesh, cap2O.mesh);
  const nBack = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ color: 0xf2e5d6 })); nBack.position.z = -5; groups.N.add(nBack);
  const hazeC = mkCanvas(512, 256), hz = hazeC.getContext("2d"); fibres(hz, 512, 256, 300, ["#fdeee2", "#f2c2b0", "#fff6ee"], 180, 3); hz.globalAlpha = 1; const hazeTex = tex(hazeC, [1, 1]);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, opacity: 0.45, depthWrite: false })); p.position.set(0, 0.5, -1.6 - i * 1.3); p.rotation.z = i * 0.3; groups.N.add(p); }
  const nSig = mkGlow(16, 0xb8fff2); nSig.forEach((s) => groups.N.add(s));

  // ── set P: wet pebbles, wrinkled and smooth fingers, a table ──────────────────────────────────────────────
  const pt = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0xf1e7d8, roughness: 0.85 })); pt.rotation.x = -Math.PI / 2; pt.receiveShadow = true; groups.P.add(pt);
  const pebG = (() => { const g = new THREE.SphereGeometry(1, 64, 40), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.06 * Math.sin(x * 4.1 + z * 3.3) + 0.04 * Math.sin(y * 6 + x * 2); p.setXYZ(i, x * n * 2.2, y * n * 1.35, z * n * 1.7); } g.computeVertexNormals(); return g; })();
  const pebM = mat({ color: 0x7b7266, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, bumpScale: 1 });
  const dropM = mat({ color: 0xeaf6fb, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55 });
  const pairs = [-1, 1].map((sd, pi) => { const g = new THREE.Group(); g.position.set(sd * 4.6, 0, 0); groups.P.add(g); const peb = new THREE.Mesh(pebG, pebM); peb.castShadow = peb.receiveShadow = true; peb.position.y = 1.35; g.add(peb);
    for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.08 + hash(i + pi * 9) * 0.1, 16, 12), dropM); const a = hash(i * 3.3 + pi) * 6.28, r = hash(i * 1.9 + pi) * 1.2; d.position.set(Math.cos(a) * r, 1.35 + 1.1 * Math.sqrt(Math.max(0.1, 1 - (r / 2) ** 2)) * 0.95, Math.sin(a) * r * 0.7); g.add(d); }
    const fg2 = new THREE.Group(); g.add(fg2); const fin = makeFinger(pi ? 4.1 : 1.3, fg2); fin.mesh.position.set(0, 0, 0); fg2.rotation.z = 140 * D2R; fg2.position.set(2.9, 6.1, 0); fg2.scale.setScalar(0.4);   // the finger lies toward the pebble
    return { g, peb, fin, fg2, A: pi ? 1 : 0 }; });
  const pSig = null;

  // ── bubbles-and-droplets sprites in P are meshes; the F-scene ripple + state per frame ─────────────────────
  const AF = (t) => ({ L: eo(seg(t, 5.6, 12.4)) * (1 - eo(seg(t, 60, 61.4)) * 0) * (t > 35 ? 1 - eo(seg(t, 35, 35.4)) : 1) * 1, R: 1 });
  const WATER_ON = (t) => Math.max(sm(seg(t, 4.2, 5.0)) * (1 - sm(seg(t, 16.4, 17.2))), sm(seg(t, 35.2, 36.0)) * (1 - sm(seg(t, 42.6, 43.2))));
  const fire = [17.9, 19.6, 21.2, 22.9, 24.6, 26.2];
  const nFire = [28.3, 29.2, 30.1, 31.0, 31.9, 32.8, 37.8, 38.7, 39.6, 40.5, 41.4];
  const BREAK = [33.0, 37.7];                                                                  // the nerve stops working, then works again

  const setF = (t) => {
    const a = AF(t), wet = WATER_ON(t);
    const wr = t < 30 ? a.L : eo(seg(t, 38.0, 41.4)); fL.set(wr, wet); fR.set(1, wet);
    for (let i = 0; i < wp.count; i++) { const x = wx[i], z = wz[i], r1 = Math.hypot(x + 2.35, z), r2 = Math.hypot(x - 2.35, z); wp.setZ(i, wet * (0.06 * Math.sin(r1 * 3.2 - t * 2.4) * Math.exp(-r1 * 0.16) + 0.06 * Math.sin(r2 * 3.2 - t * 2.1) * Math.exp(-r2 * 0.16) + 0.02 * Math.sin(x * 1.3 + t * 0.9) * Math.cos(z * 1.1 - t * 0.7))); }
    wp.needsUpdate = true; water.geometry.computeVertexNormals(); water.visible = tint.visible = wet > 0.01; water.material.opacity = 0.1 * wet; tint.material.opacity = 0.04 * wet;
    bub.forEach((b) => { const U = b.userData, y = ((t * U.sp * 0.9 + U.ph) % 1); b.position.set(U.x + Math.sin(t * 1.3 + U.ph * 5) * 0.2, -4 + y * (WY + 4), U.z + 0.8); b.scale.setScalar(U.sz * 1.8); b.material.opacity = wet * 0.55 * Math.sin(Math.PI * y); });
  };
  let narrow = 0, shrink = 0, foldA = 0;
  const setS = (t) => {
    const fN = clamp(eo(seg(t, 19.6, 22.6))), F = clamp(eo(seg(t, 23.4, 26.8)));
    narrow = fN; shrink = fN; foldA = F;
    const S = 0.34 * shrink;
    for (let i = 0; i < fp.count; i++) { const x = fx0[i], y0 = fy0[i], k = clamp(1 + y0 / 1.8); fp.setY(i, y0 + (-S + 0.5 * foldA * fold(x)) * k); }
    fp.needsUpdate = true; face.computeVertexNormals();
    for (let i = 0; i < tp.count; i++) tp.setY(i, -S + 0.5 * foldA * fold(tx0[i])); tp.needsUpdate = true; top.computeVertexNormals();
    sv.forEach((v, j) => { const pts = [], rad = []; const [x0, x1] = vX[j]; for (let i = 0; i <= 30; i++) { const x = lerp(x0, x1, i / 30), s = 0.9 * foldA * fold(x) * 0.5 * 0.5; pts.push([x, vPath[j](x) - S * 0.8 + s * 0, 0.18]); rad.push(vR[j] * (1 - 0.55 * narrow) * (0.9 + 0.1 * Math.sin(x * 2 + j))); } v.t.set(pts, rad); v.l.set(pts, rad.map((r) => r + 0.04)); });
    sSig.forEach((s) => (s.material.opacity = 0)); let si = 0;
    for (const ft of fire) { const k = (t - ft) / 1.9; if (k < 0 || k > 1.1) continue; const br = Math.sin(clamp(k) * Math.PI) ** 0.6; for (let q = 0; q < 3; q++) { if (si >= sSig.length) break; const p = sNerve.getPoint(clamp(k - q * 0.07)), s = sSig[si++]; s.position.set(p.x, p.y, p.z + 0.12); s.scale.setScalar(0.62 - q * 0.14); s.material.opacity = br * (0.9 - q * 0.25); } }
  };
  const setN = (t) => {
    const inB = t >= BREAK[0] && t < BREAK[1], dim = inB ? 1 : 0, dimK = sm(seg(t, BREAK[0], BREAK[0] + 0.5)) * (1 - sm(seg(t, BREAK[1], BREAK[1] + 0.5)));
    matB.color.setRGB(...[0.94, 0.73, 0.33].map((v, i) => lerp(v, [0.7, 0.66, 0.62][i], dimK))); matB.emissiveIntensity = 0.15 * (1 - dimK);
    nSig.forEach((s) => (s.material.opacity = 0)); let si = 0, arrive = 0;
    for (const ft of nFire) { const k = (t - ft) / 1.6; if (k < 0 || k > 1.15) continue; const blocked = ft >= BREAK[0] - 0.6 && ft < BREAK[1]; const lim = blocked ? BR : 1; const br = Math.sin(clamp(k) * Math.PI) ** 0.6;
      for (let q = 0; q < 3; q++) { if (si >= nSig.length) break; const u = clamp(k - q * 0.06); if (u > lim) continue; const p = ncurve.getPoint(u), s = nSig[si++]; s.position.set(p.x, p.y, p.z + 0.15); s.scale.setScalar(0.7 - q * 0.16); s.material.opacity = br * (0.9 - q * 0.25) * (blocked && u > lim - 0.04 ? 0.4 : 1); }
      if (!blocked) { const ta = ft + 1.6 * 0.98; arrive += Math.exp(-Math.max(0, t - ta) / 0.7) * (t >= ta ? 1 : 0); } }
    const nr = clamp(arrive, 0, 1);
    const pts = [], rad = []; for (let i = 0; i <= 40; i++) { const x = lerp(1.2, 14, i / 40); pts.push([x, 0 - 0.04 * (x - 1.2) + 0.18 * Math.sin(x * 0.6), 0.1]); rad.push(0.85 * (1 - 0.5 * nr) * (0.92 + 0.08 * Math.sin(x * 2.4)) * (1 - 0.18 * seg(x, 1.2, 2.2) * 0) ); }
    cap.set(pts, rad); capO.set(pts, rad.map((r) => r + 0.05));
    const p2 = [], r2 = []; for (let i = 0; i <= 30; i++) { const x = lerp(4, 11, i / 30); p2.push([x, 1.4 + 0.5 * Math.sin(x * 0.5), -0.3 + 0.0 * x]); r2.push(0.3 * (1 - 0.45 * nr)); } cap2.set(p2, r2); cap2O.set(p2, r2.map((r) => r + 0.04));
  };
  let pebbleX = [0, 0];
  const setP = (t) => {
    const run = (t0, durL, durR) => [eio(seg(t, t0, t0 + durL)), eio(seg(t, t0, t0 + durR))];
    const a = run(46.4, 2.6, 1.5), b = run(48.9, 2.2, 2.2), cyc = [clamp(a[0] + b[0]), clamp(a[1] + b[1])];
    pairs.forEach((p, i) => { const k = i === 0 ? (t < 48.9 ? a[0] : b[0]) : (t < 48.9 ? a[1] : b[1]); const start = i === 0 ? 4.6 : -4.6, base = (i === 0 ? -4.6 : 4.6) + 0, tx = lerp(start * 0.0 + (i === 0 ? 3.6 : -3.6), 0, 0);   // pebble slides from the outer side toward the middle
      const x0 = i === 0 ? -4.8 : 4.8, x1 = i === 0 ? -1.3 : 1.3; const slide = (t < 50.5) ? k : 1 - (1 - k) * 0 - 0; const pos = t < 48.9 ? lerp(x0, x1, k) : lerp(x1, x0, k);
      p.g.position.x = pos; p.A = i ? 1 : (t < 30 ? 1 : 0); p.fin.set(i ? 1 : eo(seg(t, 38, 41)) , 1); p.peb.rotation.z = Math.sin(t * 1.2 + i) * 0.01; p.fg2.position.y = 6.1 + 0.12 * Math.sin(t * 3.0 + i) * (k > 0 && k < 1 ? 1 : 0); });
  };

  // ── camera, cuts, painting overlays ──────────────────────────────────────────────────────────────────────────────────────
  const V = new THREE.Vector3();
  const ANC = {
    epi: () => [CX.S - 0.8, 0.5 * foldA * fold(-0.8) - 0.34 * shrink + 0.15, 0.2],
    vessel: () => [CX.S + 1.0, vPath[0](1.0) - 0.34 * shrink * 0.8, 0.3],
    nerve: () => { const p = sNerve.getPoint(0.4); return [CX.S + p.x, p.y, p.z]; },
    tipL: () => [-2.35, -9 + STOT - 0.2, RAD], tipR: () => [2.35, -9 + STOT - 0.2, RAD],
  };
  let curSc = "F";
  return {
    renderer,
    seek(t) {
      const c = W3.camAt(t); curSc = c.sc || "F"; for (const k in groups) groups[k].visible = k === curSc;
      W3.camPose(t, c);
      if (curSc === "F") setF(t); else if (curSc === "S") setS(t); else if (curSc === "N") setN(t); else if (curSc === "P") setP(t);
      const cx = CX[curSc]; key.target.position.set(cx, -1, 0); key.position.set(cx - 9, 12, 11); key.target.updateMatrixWorld(); W3.paintSet(t);
      W3.render(c);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); V.set(p[0], p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
