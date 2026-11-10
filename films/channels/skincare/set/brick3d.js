// brick3d.js — Skin Sense S2 E5 ("The brick wall on your skin") as a 3-D scene in the owner's art (shared base: w3d.js).
// Two sets, hard-cut between, every one always moving:
//   W  the wall in section: staggered flat cells (bricks) in a golden lipid matrix (mortar); water rises from below and turns back at the wall,
//      outside specks turn back from above; a thin acid film on top; in the twist the bricks ghost and the mortar glows, water stalls in it
//   M  the mortar close up: stacked sheets of fat wrapped around one cell, a water bead trying to cross and being slowed
// Units ≈ µm-ish, illustrated and not to scale. Pure function of t. create() returns { seek, anchor } for ss3.mjs.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, fibres, mkGlow, glowTex, key, T, AW, BH, BTOP } = W3;
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.45, ...o });
  const groups = { W: new THREE.Group(), M: new THREE.Group() }, CX = { W: 0, M: 60 }; for (const k in groups) { groups[k].position.x = CX[k]; scene.add(groups[k]); }
  const SKH = T.skinHex || "#eec2a4";
  const brickM = mat({ color: new THREE.Color(SKH), roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.4, transparent: false, opacity: 1 });
  const mortarM = mat({ color: 0xe9b45a, roughness: 0.3, clearcoat: 0.7, emissive: 0xc88a1a, emissiveIntensity: 0.12, transparent: true, opacity: 0.95 });
  const waterM = mat({ color: 0xdff1fb, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9, emissive: 0x9fd6ff, emissiveIntensity: 0.3 });
  const outM = mat({ color: 0xb9a6e6, roughness: 0.5, transparent: true, opacity: 0.85 });
  const back = (g, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf6ede0).multiplyScalar(T.coverCam ? 1.55 : 1) })); m.position.z = z; g.add(m); };
  const sphere = (w = 24, h = 14) => new THREE.SphereGeometry(1, w, h);

  // ── set W: the wall ──────────────────────────────────────────────────────────────────────────────────────────
  back(groups.W, -12);
  const LAYERS = 7, COLS = 11, DEPTH = 2, BX = 3.4, BY = 0.62, BZ = 2.2, PITCH = 0.82;
  const bricks = []; for (let L = 0; L < LAYERS; L++) for (let c = 0; c < COLS; c++) for (let d = 0; d < DEPTH; d++) bricks.push({ x: (c - COLS / 2) * BX + (L % 2 ? BX / 2 : 0) + (d % 2 ? 0.7 : 0), y: -L * PITCH, z: -d * BZ * 1.05, k: hash(L * 31 + c * 7 + d), w: 1.45 + hash(c + L * 3) * 0.35 });
  const brickI = new THREE.InstancedMesh(sphere(16, 9), brickM, bricks.length); brickI.frustumCulled = false; brickI.castShadow = brickI.receiveShadow = false; groups.W.add(brickI);
  const matrix = new THREE.Object3D();
  bricks.forEach((b, i) => { matrix.position.set(b.x, b.y, b.z); matrix.scale.set(b.w * 1.12, 0.37, BZ * 0.5); matrix.rotation.set(0, (b.k - 0.5) * 0.15, 0); matrix.updateMatrix(); brickI.setMatrixAt(i, matrix.matrix); }); brickI.instanceMatrix.needsUpdate = true;
  const mortar = new THREE.Mesh(new THREE.BoxGeometry(COLS * BX + 2, LAYERS * PITCH + 0.2, 8), mortarM); mortar.position.set(0, -(LAYERS - 1) * PITCH / 2, -4.4); groups.W.add(mortar);
  const TOP = 0.5, BOT = -(LAYERS - 1) * PITCH - 0.5;                                                  // wall top and bottom faces
  const mist = mkGlow(1, 0xffe8b0)[0]; groups.W.add(mist);
  const acid = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(sphere(16, 10), mat({ color: 0xc8f1e6, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.55, emissive: 0x7fe0c8, emissiveIntensity: 0.25, depthWrite: false })); m.position.set(-16 + hash(i * 3.1) * 32, TOP + 0.12, -hash(i * 5.7) * 4 + 0.6); m.scale.set(0.34, 0.12, 0.34); groups.W.add(m); return m; });
  const NW = 70, NO = 40, wat = Array.from({ length: NW }, (_, i) => { const m = new THREE.Mesh(sphere(10, 8), waterM); m.userData = { x: (hash(i * 2.3) - 0.5) * 30, z: -hash(i * 4.1) * 5 + 0.8, ph: hash(i * 6.7), sp: 0.5 + hash(i * 8.9) * 0.6, gap: hash(i * 3.9) }; groups.W.add(m); return m; });
  const outer = Array.from({ length: NO }, (_, i) => { const m = new THREE.Mesh(sphere(8, 6), outM); m.userData = { x: (hash(i * 5.3) - 0.5) * 30, z: -hash(i * 7.1) * 5 + 0.8, ph: hash(i * 9.3), sp: 0.4 + hash(i * 1.7) * 0.5 }; groups.W.add(m); return m; });

  // ── set M: one cell wrapped in stacked fat sheets ────────────────────────────────────────────────────────────
  back(groups.M, -10);
  const mCell = new THREE.Mesh(sphere(36, 20), brickM); mCell.scale.set(3.2, 0.9, 2.1); groups.M.add(mCell);
  const sheets = Array.from({ length: 9 }, (_, i) => { const s = 1.08 + i * 0.16, m = new THREE.Mesh(sphere(40, 22), mat({ color: 0xeab55c, roughness: 0.25, clearcoat: 0.8, transparent: true, opacity: 0.1, depthWrite: false, emissive: 0xc88a1a, emissiveIntensity: 0.05, side: THREE.DoubleSide, clearcoat: 0.3, envMapIntensity: 0.4 })); m.scale.set(3.2 * s, 0.9 * s * 1.0, 2.1 * s); groups.M.add(m); return m; });
  const mWat = Array.from({ length: 24 }, (_, i) => { const m = new THREE.Mesh(sphere(10, 8), waterM); m.userData = { x: (hash(i * 2.9) - 0.5) * 7, ph: hash(i * 6.1), sp: 0.5 + hash(i * 8.3) * 0.5 }; groups.M.add(m); return m; });

  // ── per frame ────────────────────────────────────────────────────────────────────────────────────────────────
  const twist = (t) => sm(seg(t, 42.6, 44.2)) * (1 - sm(seg(t, 51.4, 52.6)));                            // bricks ghost, the mortar is the subject
  const setW = (t) => {
    const tw = twist(t), glow = sm(seg(t, 45.2, 47)) * (1 - sm(seg(t, 56, 58))) + 0.3 * sm(seg(t, 58, 60.5));
    brickM.opacity = 1 - 0.78 * tw; brickM.transparent = tw > 0.01; mortarM.emissiveIntensity = 0.12 + 0.55 * glow + 0.15 * Math.sin(t * 2);
    wat.forEach((m, i) => { const U = m.userData, k = ((t * 0.16 * U.sp + U.ph) % 1);                                                // up from below, turn back at the wall's underside
      const reach = (tw > 0.5 && t > 47.8 && t < 52 && U.gap < 0.5) ? lerp(BOT, BOT + 1.6 + 1.6 * U.gap, 1) : BOT - 0.1;                // in the twist some try to enter the mortar and are slowed
      const up = k < 0.5 ? k * 2 : 2 - k * 2, y = lerp(BOT - 6, reach, eo(up));
      const jitter = (reach > BOT ? 0.25 : 0.05) * Math.sin(t * 7 + i * 3) * (up > 0.7 ? 1 : 0);
      m.position.set(U.x + jitter, y, U.z); m.scale.setScalar(0.13 * (0.8 + 0.4 * hash(i))); });
    outer.forEach((m, i) => { const U = m.userData, k = ((t * 0.14 * U.sp + U.ph) % 1), up = k < 0.5 ? k * 2 : 2 - k * 2, y = lerp(TOP + 6, TOP + 0.1, eo(up)); m.position.set(U.x + 0.1 * Math.sin(t * 2 + i), y, U.z); m.scale.setScalar(0.11); m.visible = t > 26 && t < 60; });
    acid.forEach((m, i) => { m.material.emissiveIntensity = 0.2 + 0.5 * sm(seg(t, 36.8, 38.6)) * (1 - sm(seg(t, 40.2, 41.4))) * (0.6 + 0.4 * Math.sin(t * 3 + i)); m.visible = t > 5; });
    mist.position.set(0, BOT + 0.3, 1); mist.scale.setScalar(10); mist.material.opacity = 0.18 * glow;
    groups.W.rotation.y = 0.0;
  };
  const setM = (t) => {
    sheets.forEach((m, i) => { m.rotation.y = Math.sin(t * 0.5 + i * 0.4) * 0.03; m.material.emissiveIntensity = 0.05 + 0.18 * (sm(seg(t, 17.2, 20)) * (1 - sm(seg(t, 23, 24))) + sm(seg(t, 45.2, 47))) * (0.7 + 0.3 * Math.sin(t * 2 + i)); m.material.opacity = 0.08 + 0.06 * Math.sin(t * 1.3 + i); });
    mCell.rotation.y = Math.sin(t * 0.4) * 0.08;
    mWat.forEach((m, i) => { const U = m.userData, k = ((t * 0.2 * U.sp + U.ph) % 1), reach = 3.2 + 0.55 * 14 * 0.1 + 0.4 * hash(i), y = lerp(-8, -2.3 - (k > 0.45 ? 0.5 * Math.min(1, (k - 0.45) * 4) : 0), eo(Math.min(1, k * 1.7))); m.position.set(U.x + 0.35 * Math.sin(t * 5 + i * 2) * (k > 0.5 ? 1 : 0), y + (k > 0.7 ? -(k - 0.7) * 6 : 0), 0.4 + 0.5 * Math.sin(i)); m.scale.setScalar(0.17); });
  };

  const V = new THREE.Vector3();
  const ANC = { sheets: () => [CX.M + 0.5, 1.9, 1.2], acid: () => [-1, TOP + 0.2, 0.8] };
  let curSc = "W";
  return {
    renderer,
    seek(t) {
      const c = T.coverCam ? { ...T.coverCam, roll: 0, sc: T.coverCam.sc || "W" } : W3.camAt(t); curSc = c.sc || "W"; for (const k in groups) groups[k].visible = k === curSc;
      W3.camPose(t, c);
      if (curSc === "W") setW(t); else setM(t);
      const cx = CX[curSc]; key.target.position.set(cx, -2, 0); key.position.set(cx - 9, 10, 11); key.target.updateMatrixWorld(); W3.paintSet(t);
      W3.render(c);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); V.set(p[0], p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
