// cells3d.js — Skin Sense Season 3, Episode 2 ("Where do your skin cells go?"): a soft voxel cut-away of the skin's outer layers as a slow conveyor of cells. A new round cell is born at the bottom
// (nucleus showing), rises, fills with keratin and flattens, lets go of its nucleus near the top, stacks with the others like bricks (water beads turn back below them), then drifts away as dust;
// underneath, new cells are already rising. The camera follows one hero cell, then pulls wide, then descends to the new cells. Look and finish as episode 1 (set/shiver3d.js): base set/w3d.js.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkGlow, glowTex, mkCanvas, key, rim, T, AW, BH, BTOP, R } = W3;
  scene.environmentIntensity = 0.06; scene.traverse((o) => { if (o.isHemisphereLight) { o.color.set(0xfff0e8); o.groundColor.set(0x2a1418); o.intensity = 0.55; } });
  key.color.set(0xffe2c4); key.intensity = 2.2; key.position.set(-9, 14, 18); key.castShadow = false; rim.color.set(0xffc9a0); rim.intensity = 1.5; rim.position.set(6, 10, -18);
  scene.fog = new THREE.FogExp2(0x0b1513, 0.02);
  const S = (id, off = 0) => R(`start:${id}${off >= 0 ? "+" : ""}${off}`), E = (id, off = 0) => R(`end:${id}${off >= 0 ? "+" : ""}${off}`);
  const rbox = (s, r, n) => { const g = new THREE.BoxGeometry(s, s, s, n, n, n), p = g.attributes.position, nm = g.attributes.normal, h = s / 2 - r, q = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { q.set(clamp(p.getX(i), -h, h), clamp(p.getY(i), -h, h), clamp(p.getZ(i), -h, h)); d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(q); if (d.lengthSq() > 1e-10) d.normalize(); else d.set(nm.getX(i), nm.getY(i), nm.getZ(i));
      p.setXYZ(i, q.x + d.x * r, q.y + d.y * r, q.z + d.z * r); nm.setXYZ(i, d.x, d.y, d.z); } return g; };

  // ── the conveyor: slots along the cells' life; every cell's shape, colour and nucleus are functions of its slot s ──────────────────────────────────────
  const hOf = (s) => lerp(1.05, 0.46, sm(seg(s, 5, 11))), wOf = (s) => lerp(0.95, 1.5, sm(seg(s, 4, 11)));
  const YT = [0]; for (let i = 1; i <= 640; i++) YT.push(YT[i - 1] + hOf(-1 + (i - 0.5) * 0.05) * 0.05);       // Y(s) = integral of the cell height, s from -1
  const Y = (s) => { const k = clamp((s + 1) / 0.05, 0, 639.999), i = Math.floor(k); return -13.4 + lerp(YT[i], YT[i + 1], k - i) - YT[20]; };
  const DX = 1.55, NC = 11, NM = 14;
  const cA = new THREE.Color(0xb0524c), cB = new THREE.Color(0xa76a50), cC = new THREE.Color(T.topHex ? T.topHex : 0x7a4a30), tmp = new THREE.Color();
  const cubeG = rbox(1, 0.16, 4), cubeM = new THREE.MeshStandardMaterial({ roughness: 0.5, envMapIntensity: 0.5 });
  cubeM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * 0.3;"); };
  const N = NC * (2 * NM + 1) * 2, cells = new THREE.InstancedMesh(cubeG, cubeM, N); cells.frustumCulled = false; scene.add(cells);
  const nucG = new THREE.SphereGeometry(0.5, 14, 10), nucM = new THREE.MeshStandardMaterial({ color: 0xd8c8e6, roughness: 0.45, emissive: 0x8a6aa8, emissiveIntensity: 0.3 }), nuc = new THREE.InstancedMesh(nucG, nucM, NC * (2 * NM + 1)); nuc.frustumCulled = false; scene.add(nuc);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2c1512) })); back.position.set(0, -6, -1.9); scene.add(back);
  const glowBack = mkGlow(1, 0xff8a4a)[0]; glowBack.scale.set(46, 52, 1); glowBack.position.set(0, -6, -8); glowBack.material.opacity = 0.07; glowBack.material.fog = false; scene.add(glowBack);
  const heroGlow = mkGlow(1, 0xffe0bd)[0]; heroGlow.material.fog = false; heroGlow.material.opacity = 0.28; scene.add(heroGlow);
  const D = new THREE.Object3D(), C = new THREE.Color();
  // ── water beads turn back under the bricks; dust leaves the top ──────────────────────────────────────────────────────────────────────────────
  const gcv = mkCanvas(128, 128), gx = gcv.getContext("2d"); { const g = gx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = g; gx.fillRect(0, 0, 128, 128); }
  const gtex = new THREE.CanvasTexture(gcv), spr = (col, n) => Array.from({ length: n }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color: col, transparent: true, opacity: 0, depthWrite: false, fog: false })); scene.add(sp); return sp; });
  const beads = spr(0x9fe6dc, 28), dust = spr(0xffe6c8, 70), motes = mkGlow(36, 0xffc89a); motes.forEach((s, i) => { s.material.fog = false; scene.add(s); });
  // ── the hero's journey: slot as a function of time (smooth between keys) ──────────────────────────────────────────────────────────────────────────
  const HK = [[S("vo01", 0.4), -0.9], [S("vo02", 0.6), 0.3], [E("vo02", 0.5), 1.8], [S("vo03", 3.0), 5.0], [E("vo03", 0.0), 9.6], [S("vo04", 2.0), 11.4], [E("vo04", 0.0), 13.4], [E("vo05", 0.0), 15.0], [E("vo06", 0.0), 16.3], [E("vo07", 0.0), 17.0], [E("vo08", 0.0), 17.6], [E("vo09", 0.0), 19.0], [E("vo09", 20), 19.5]];
  const sH = (t) => { let i = 0; while (i < HK.length - 2 && t >= HK[i + 1][0]) i++; const a = HK[i], b = HK[i + 1]; return lerp(a[1], b[1], sm(seg(t, a[0], b[0]))) * 0.5 + lerp(a[1], b[1], seg(t, a[0], b[0])) * 0.5; };
  const CD = [[0, 8.5], [S("vo02", 0), 9.5], [S("vo03", 0), 11], [S("vo04", 0), 8.5], [S("vo05", 0), 13], [S("vo06", 0), 11.5], [S("vo07", 0), 12], [S("vo07", 2.2), 27], [S("vo08", 0), 26], [S("vo08", 2.5), 15], [E("vo08", 0), 15], [S("vo09", 0.5), 18], [E("vo09", 0), 19]];
  const keyed = (K, t) => { let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++; const a = K[i], b = K[i + 1]; return lerp(a[1], b[1], sm(seg(t, a[0], b[0]))); };
  const G8 = (t) => sm(seg(t, S("vo08", 0.6), S("vo08", 3.6)));

  return {
    renderer,
    seek(t) {
      const sh = sH(t), fl = Math.floor(sh), fr = sh - fl, g8 = G8(t); let ci = 0, ni = 0, hx = 0, hy = Y(sh);
      for (let c = -(NC >> 1); c <= (NC >> 1); c++) { const off = (c % 2 ? 0.5 : 0) + 0.13 * Math.sin(c * 2.3), colX = c * DX + 0.07 * Math.sin(c * 3.1);
        for (let m = -NM; m <= NM; m++) { const s = fl + m + fr + off - (c === 0 ? 0 : 0), live = s > -1.0 && s < 20.5;
          for (let row = 0; row < 2; row++) { const idx = ci++; if (!live) { D.scale.set(0, 0, 0); D.position.set(0, -99, 0); D.updateMatrix(); cells.setMatrixAt(idx, D.matrix); if (row === 0) nuc.setMatrixAt(ni++, D.matrix); continue; }
            const born = sm(seg(s, -1.0, 0.0)), exitK = sm(seg(s, 18.0, 19.8)), w = wOf(s), h = hOf(s), vis = born * (1 - exitK * (0.3 + 0.7 * g8)) * (1 - sm(seg(s, 19.8, 20.5)));
            const y = Y(s) + exitK * (0.4 + 2.6 * g8) * 1, x = colX + exitK * 0.5 * Math.sin(s * 1.7 + c) * (0.4 + g8) + (row ? 0.35 : 0);
            D.position.set(x, y, row ? -1.12 : 0); D.scale.set(w * 0.96 * vis, h * 0.94 * vis, row ? 0.95 : 1.0); D.rotation.set(0, 0, exitK * g8 * 0.5 * Math.sin(s + c)); D.updateMatrix(); cells.setMatrixAt(idx, D.matrix); D.rotation.set(0, 0, 0);
            const k1 = sm(seg(s, 1, 6)), k2 = sm(seg(s, 5, 11)); tmp.copy(cA).lerp(cB, k1).lerp(cC, k2); const hero = c === 0 && Math.abs(s - sh) < 0.5 && row === 0 ? 1 : 0; tmp.multiplyScalar((row ? 0.55 : 1) * (hero ? 1.45 : 1) * (1 - 0.25 * sm(seg(s, 15, 19)))); cells.setColorAt(idx, tmp);
            if (row === 0) { const nn = ni++, nv = born * (1 - sm(seg(s, 10.4, 12.4))) * vis; D.position.set(x, y, 0.46); D.scale.set(0.3 * nv, 0.3 * nv * (h / 1.05 + 0.4), 0.12 * nv); D.updateMatrix(); nuc.setMatrixAt(nn, D.matrix); }
            if (hero) { hx = x; hy = y; } } } }
      cells.instanceMatrix.needsUpdate = true; if (cells.instanceColor) cells.instanceColor.needsUpdate = true; nuc.instanceMatrix.needsUpdate = true;
      heroGlow.position.set(hx, hy, 0.7); heroGlow.scale.setScalar(2.4 + 0.3 * Math.sin(t * 1.3)); heroGlow.material.opacity = 0.16 * sm(seg(t, S("vo01", 0), S("vo01", 1.2))) * (1 - sm(seg(t, S("vo08", 0), S("vo08", 2.5))));
      // water beads below the bricks (line 6), dust over the top (line 8)
      const gw = sm(seg(t, S("vo06", -0.2), S("vo06", 0.8))) * (1 - sm(seg(t, E("vo07", -0.5), E("vo07", 1.5)))), yStop = Y(11.6) - 0.4;
      beads.forEach((b, i) => { const k = ((t * (0.12 + 0.08 * hash(i)) + hash(i * 7)) % 1), up = k < 0.55 ? eo(k / 0.55) : 1 - eo((k - 0.55) / 0.45) * 0.9; b.position.set((hash(i * 3) - 0.5) * 7.6, lerp(yStop - 3.2, yStop, up) + 0.05 * Math.sin(t * 5 + i), 0.9); b.scale.setScalar(0.22 + 0.1 * hash(i + 4)); b.material.opacity = gw * (0.55 * Math.sin(Math.PI * clamp(k * 1.05))); });
      dust.forEach((b, i) => { const k = clamp((t - S("vo08", 0.4) - hash(i * 5) * 4.0) / 9.0); b.position.set((hash(i * 3) - 0.5) * 11 + 1.8 * k * Math.sin(i + t * 0.3), Y(18.5) + 0.2 + k * (4 + 4 * hash(i)), 0.4 + hash(i * 9) * 1.5 - 1); b.scale.setScalar(0.07 + 0.08 * hash(i + 2)); b.material.opacity = 0.5 * Math.sin(Math.PI * k) * (k > 0 ? 1 : 0) * (1 - sm(seg(t, E("vo09", 0), E("vo09", 3)))); });
      motes.forEach((s, i) => { s.position.set(-10 + hash(i * 3.3) * 20 + 0.4 * Math.sin(t * 0.2 + i), -14 + hash(i * 5.9) * 17 + ((t * 0.08 + hash(i * 1.7)) % 1) * 1.5, -2 + hash(i * 7.1) * 6); s.scale.setScalar(0.08 + 0.05 * hash(i)); s.material.opacity = 0.2 + 0.15 * Math.sin(t * 0.8 + i); });
      // camera: follow the hero, pull wide for the month, rise to the top for the drifting, then descend to the new cells at the bottom
      const dist = keyed(CD, t), top = sm(seg(t, S("vo07", 1.5), S("vo07", 3.5))), toBottom = sm(seg(t, S("vo09", 0.3), E("vo09", -0.8)));
      const ty = lerp(lerp(hy + 0.6, -2.4, top), -10.8, toBottom), tx = lerp(hx * 0.6, 0, top), sway = Math.sin(t * 0.21);
      const cam = { pos: [tx + 2.2 * sway - 1.6, ty + 0.7 + 0.2 * Math.sin(t * 0.17), dist], look: [tx, ty, 0], fov: 32, roll: 0, sc: "S" }; W3.camPose(t, cam);
      key.target.position.set(tx, ty, 0); key.target.updateMatrixWorld(); W3.compMat.uniforms.tm.value = t * 37.1; W3.compMat.uniforms.coc.value = 0.009; W3.render(cam);
    },
    anchor() { return null; },
  };
}
