// acne01.js — No. 001's below-the-surface set (films/channels/skincare/set): one hair follicle with its oil gland, cut
// open (simplified, badged). Units µm; the surface is y = 0; the camera looks from +z at the cut face (z = 0).
//   createAcneFollicle({ x, seed, tone }) → { group, set(p), at }
//   set({ tone, bact, ring, ringLit, flood, rupt, press, red, dim })
//     bact 0 … 1   the rod-shaped bacteria deep in the canal glow orange-red (as under UV: their porphyrins)
//     ring 0 … 1   immune cells ringing the follicle appear one by one; ringLit 0 … 1 lights them cyan (the subject)
//     flood 0 … 1  white cells pour in from the dermis into the canal
//     rupt 0 … 1   the canal's lower wall gives way; the contents spill into the dermis
//     press 0 … 1  a thumb's pressure from above: the surface dents, the spill is driven deeper, the red spreads
//     mark 0 … 1   a darker patch left deep in the dermis (where a mark is more likely)
//     thumb 0 … 1  the thumb present (1) or lifted away (0) while the press holds
//     red 0 … 1    inflammation: a red haze around the follicle (grows with rupt and press)
//   at.{canal, ring, bact, spill, surface, gland, cell}() → world points for labels and the gauge
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

export const createAcneFollicle = ({ x = 0, seed = 11, width = 1000, depth = 900, thick = 340, epi = 100, block = true } = {}) => {   // block: false = the follicle only (it sits in another block's skin)
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5)];
  const mat = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clip, ...o });
  const M = { dermis: mat({ roughness: 0.8 }), epi: mat(), sc: mat({ roughness: 0.5 }), wall: mat({ roughness: 0.5 }), plug: mat({ roughness: 0.35 }), gland: mat({ roughness: 0.4 }) };
  // the block: dermis below, epidermis (its top displaced by the thumb), a thin dead layer
  const dermis = new THREE.Mesh(new THREE.BoxGeometry(width, depth, thick), M.dermis); dermis.position.y = -epi - depth / 2;
  const epiGeo = new THREE.BoxGeometry(width, epi, thick, 120, 1, 30), ep = epiGeo.attributes.position, epY = Float32Array.from(ep.array);
  const epiM = new THREE.Mesh(epiGeo, M.epi); epiM.position.y = -epi / 2;
  g.add(dermis, epiM); dermis.visible = epiM.visible = block;
  // the canal: a flask opening at the surface, widest in the middle, closing at the bulb (a lathe, cut open by the clip)
  const prof = [[22, 2], [30, -40], [70, -160], [80, -260], [58, -380], [30, -470], [10, -520]].map(([r, y]) => new THREE.Vector2(r, y));
  const wall = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.wall); g.add(wall);
  // the wall's breach (rupt): a darker inner sleeve at the lower side that fades as the wall gives way
  const plug = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(Math.max(2, v.x - 12), v.y)), 48), M.plug); g.add(plug);
  // the oil glands: two lobes on the canal's flanks
  const glands = [[-110, -300], [115, -320]].map(([gx, gy]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(62, 24, 16), M.gland); m.position.set(gx, gy, 0); m.scale.set(1, 1.25, 1); g.add(m); return m; });
  // the bacteria: small rods deep in the canal, emissive orange-red when lit
  const bactMat = new THREE.MeshStandardMaterial({ color: 0x5a2014, emissive: 0x000000, roughness: 0.4 });   // inside the cut (z < 0): not clipped
  const bact = Array.from({ length: 34 }, () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(4, 13, 4, 8), bactMat); const yy = -200 - R() * 240, rr = (R() * 0.7) * (yy > -300 ? 60 : 45); const a = R() * Math.PI; m.position.set(Math.cos(a) * rr, yy, -6 - R() * 26); m.scale.setScalar(1.6); m.rotation.set(R() * 3, R() * 3, R() * 3); g.add(m); return m; });
  // immune cells ringing the follicle (outside its wall), and the white cells that flood in
  const cellGeo = new THREE.SphereGeometry(20, 18, 14);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd8cff5, emissive: 0x000000, roughness: 0.45 });
  const ringC = Array.from({ length: 46 }, (_, i) => { const m = new THREE.Mesh(cellGeo, ringMat); const yy = -60 - R() * 430, side = i % 2 ? 1 : -1, r0 = 95 + 40 * Math.sin(-yy / 140) + R() * 35; m.position.set(side * r0, yy, -4 - R() * 40); m.userData.k = R(); g.add(m); return m; });
  const floodMat = new THREE.MeshStandardMaterial({ color: 0xd8cff5, emissive: 0x000000, roughness: 0.45 });   // the same white cells as the ring (one family)
  const floodC = Array.from({ length: 60 }, () => { const m = new THREE.Mesh(cellGeo, floodMat); const yy = -140 - R() * 330; const from = [(R() < 0.5 ? -1 : 1) * (160 + R() * 220), yy - 60 - R() * 120], to = [(R() - 0.5) * 70, yy]; m.userData = { from, to, k: R() }; g.add(m); return m; });
  // the spill: the canal's contents (oil, keratin, bacteria, cells) pushed out through the breach into the dermis
  const spillMat = new THREE.MeshStandardMaterial({ color: 0xf2dc9a, emissive: 0x201808, roughness: 0.4 });
  const spill = Array.from({ length: 70 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(9 + R() * 8, 12, 9), spillMat); const a = -Math.PI / 2 + (R() - 0.5) * 2.2; m.userData = { a, d: 60 + R() * 200, k: R(), z: -6 - R() * 40 }; g.add(m); return m; });
  // inflammation: a soft red haze, and the thumb
  const redMat = new THREE.MeshBasicMaterial({ color: 0xc8302a, transparent: true, opacity: 0, depthWrite: false });
  const redHaze = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), redMat); redHaze.position.set(0, -360, -60); g.add(redHaze);
  const thumbMat = new THREE.MeshStandardMaterial({ roughness: 0.55, transparent: true, opacity: 0 });
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(330, 40, 28), thumbMat); thumb.scale.set(1, 0.5, 0.8); g.add(thumb);
  // its nail, on top toward the back: the pad reads as a fingertip
  const nailMat = new THREE.MeshStandardMaterial({ color: 0xf3d6cf, roughness: 0.18, transparent: true, opacity: 0 });
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), nailMat); nail.scale.set(150, 110, 30); g.add(nail);
  // the mark: a darker, flattened patch left in the dermis where the spill went deep (a scar is more likely there)
  const markMat = new THREE.MeshBasicMaterial({ color: 0x5a1e1a, transparent: true, opacity: 0, depthWrite: false });
  const markM = new THREE.Mesh(new THREE.CircleGeometry(1, 40), markMat); markM.scale.set(260, 120, 1); markM.position.set(0, -520, 1); g.add(markM);
  const breachY = -400;
  const nucMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color("#9F83FF").multiplyScalar(0.7), roughness: 0.5 });
  let looked = false;
  // look({ dermisMap }): the studio look (opt-in; No. 001's reboot): the cut face shows a real stained micrograph, the
  // cells are translucent with a glowing nucleus, the walls glossy
  const look = ({ dermisMap = null } = {}) => {
    looked = true;
    const phys = (old, o) => { const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, clippingPlanes: old.clippingPlanes, ...o }); return m; };
    M.dermis = phys(M.dermis, { roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.2, sheenColor: new THREE.Color(1, 0.86, 0.92), map: dermisMap });
    dermis.material = M.dermis;
    M.wall = phys(M.wall, { roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.3 }); wall.material = M.wall;
    M.plug = phys(M.plug, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }); plug.material = M.plug;
    glands.forEach((m) => { m.material = phys(m.material, { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color(1, 0.95, 0.8) }); });
    const cellPhys = (old) => { const m = new THREE.MeshPhysicalMaterial({ color: 0xe9e2ff, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1, sheen: 0.5, sheenColor: new THREE.Color(0.85, 0.95, 1), transparent: true, opacity: 0.82, emissive: old.emissive }); return m; };
    const rm = cellPhys(ringMat), fm = cellPhys(floodMat);
    ringC.forEach((c) => { c.material = rm; const n = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), nucMat); c.add(n); });
    floodC.forEach((c) => { c.material = fm; const n = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), nucMat); c.add(n); });
    ringMatL = rm; floodMatL = fm;
    spill.forEach((m) => { m.material = new THREE.MeshPhysicalMaterial({ color: 0xf0d79a, roughness: 0.25, clearcoat: 1, emissive: 0x1a1206 }); });
  };
  let ringMatL = null, floodMatL = null;
  // sculpt(): the production pass (opt-in; No. 001 v2): the canal's wall and plug lumpy, the glands lobed, the white cells
  // irregular (a few shapes, each its own size and turn), the surface layer stratified (horny layer, living layers)
  const sculpt = () => {
    const Rs = rng(seed * 31 + 7), nz = (x, y, z) => Math.sin(x * 0.07 + 1.3) * Math.cos(y * 0.05 + 0.4) + 0.6 * Math.sin(z * 0.09 + x * 0.03) + 0.4 * Math.sin(y * 0.13 + z * 0.05);
    const lump = (geo, k) => { const q = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i); const r = Math.hypot(v.x, v.z); if (r < 1e-3) continue; const s = 1 + k * nz(v.x, v.y, v.z) / Math.max(20, r); q.setX(i, v.x * s); q.setZ(i, v.z * s); } geo.computeVertexNormals(); };
    [wall, plug].forEach((m, i) => { const g2 = new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(i ? Math.max(2, v.x - 12) : v.x, v.y)), 96, 0, Math.PI * 2); const q = g2.attributes.position; void q; lump(g2, i ? 6 : 9); m.geometry.dispose(); m.geometry = g2; });
    glands.forEach((m) => { const g2 = new THREE.SphereGeometry(62, 48, 32), q = g2.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i); const n = v.clone().normalize(); const lobes = 0.16 * Math.max(0, Math.sin(n.x * 5 + 1) * Math.sin(n.y * 4) * Math.cos(n.z * 5)) + 0.05 * Math.sin(n.y * 13); v.multiplyScalar(1 + lobes); q.setXYZ(i, v.x, v.y, v.z); } g2.computeVertexNormals(); m.geometry.dispose(); m.geometry = g2; });
    const shapes = [0, 1, 2, 3].map((j) => { const g2 = new THREE.IcosahedronGeometry(20, 4), q = g2.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i); const n = v.clone().normalize(); v.multiplyScalar(1 + 0.12 * Math.sin(n.x * (3 + j) + j) * Math.cos(n.y * (2 + j)) + 0.05 * Math.sin(n.z * 9 + j * 2)); q.setXYZ(i, v.x, v.y, v.z); } g2.computeVertexNormals(); return g2; });
    [...ringC, ...floodC].forEach((m) => { m.geometry = shapes[Math.floor(Rs() * 4)]; m.scale.setScalar(0.8 + 0.45 * Rs()); m.rotation.set(Rs() * 6, Rs() * 6, Rs() * 6); });
    // the surface layer: horny-layer sheets over the living layers, drawn as bands on the cut face
    const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256; const x = cv.getContext("2d");
    for (let y = 0; y < 256; y++) { const horny = y < 70, v = horny ? 0.92 + 0.08 * Math.sin(y * 1.9) : 0.78 + 0.1 * Math.sin(y * 0.35) + 0.05 * Math.sin(y * 1.7); const r = Math.round(255 * Math.min(1, v * (horny ? 1.05 : 1))), gg = Math.round(255 * v * (horny ? 0.96 : 0.86)), b = Math.round(255 * v * (horny ? 0.88 : 0.84)); x.fillStyle = `rgb(${r},${gg},${b})`; x.fillRect(0, y, 8, 1); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; M.epi.map = tx; M.epi.needsUpdate = true;
  };
  return {
    group: g, dims: { width, depth, epi, breachY }, look, sculpt,
    set({ tone = 0.18, bact: bk = 0, ring = 0, ringLit = 0, flood = 0, rupt = 0, press = 0, red = 0, dim = 0, thumb: thumbK = 1, mark = 0 } = {}) {
      markMat.opacity = 0.55 * mark; markM.visible = mark > 0.01;
      const k = 1 - 0.45 * dim;
      if (looked && M.dermis.map) M.dermis.color.setRGB(1.05 * k, 0.95 * k, 1.0 * k); else M.dermis.color.setRGB(...toneColor("dermis", tone).map((v) => v * k * 0.9));
      M.epi.color.setRGB(...toneColor("living", tone).map((v) => v * k));
      M.wall.color.setRGB(...toneColor("basal", tone).map((v) => v * k * 0.85));
      M.plug.color.setRGB(0.93 * k, 0.86 * k, 0.6 * k);
      glands.forEach((m) => m.material.color.setRGB(0.95 * k, 0.88 * k, 0.62 * k));
      bactMat.emissive.setRGB(1.0 * bk, 0.32 * bk, 0.16 * bk);
      bact.forEach((m) => { m.visible = bk > 0.01; });
      ringMat.emissive.setRGB(0.15 * ringLit, 0.75 * ringLit, 0.72 * ringLit); floodMat.emissive.copy(ringMat.emissive);
      if (ringMatL) { ringMatL.emissive.setRGB(0.06 * ringLit, 0.36 * ringLit, 0.36 * ringLit); floodMatL.emissive.copy(ringMatL.emissive); }
      ringC.forEach((m) => { m.visible = m.userData.k < ring; });
      floodC.forEach((m) => { const u = Math.min(1, Math.max(0, flood * 1.4 - m.userData.k * 0.4)); const { from, to } = m.userData; m.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, -20); m.visible = flood > 0.01 && u > 0.001; });
      // the breach: the lower wall and plug open (scaled thin) as the wall gives way
      wall.scale.set(1, 1 - 0.0 * rupt, 1); plug.visible = rupt < 0.98; plug.material.opacity = 1;
      spill.forEach((m) => { const { a, d, k: kk, z } = m.userData; const u = Math.min(1, Math.max(0, rupt * 1.3 - kk * 0.3)); const dd = Math.min(250, d * u + 150 * press * u); m.position.set(Math.cos(a) * dd * 1.2, breachY + Math.sin(a) * dd - 60 * press * u, z); m.visible = u > 0.01; });
      redMat.opacity = 0.32 * red; redHaze.visible = red > 0.01; const rs = 160 + 160 * rupt + 240 * press; redHaze.scale.set(rs * 1.3, rs, rs * 0.5); redHaze.position.y = -340 - 160 * press; redHaze.position.z = -60;
      // the thumb from above, denting the surface
      thumbMat.color.setRGB(...toneColor("living", tone)); thumbMat.opacity = Math.min(1, press * 3) * 0.95 * thumbK; thumb.visible = press > 0.01 && thumbK > 0.01; thumb.position.y += 0;
      thumb.position.set(0, 165 - 90 * press + 260 * (1 - thumbK), 120);
      nail.position.set(0, thumb.position.y + 70, 250); nail.rotation.set(-0.7, 0, 0);   // on the pad's front-top, facing the camera nailMat.opacity = thumbMat.opacity; nail.visible = thumb.visible;
      for (let i = 0; i < ep.count; i++) { const by = epY[3 * i + 1], bx = epY[3 * i]; if (by > 0) ep.setY(i, by - 70 * press * Math.exp(-(bx * bx) / 60000)); }
      ep.needsUpdate = true; epiGeo.computeVertexNormals();
    },
    at: {
      canal: () => [x, -150, 40], bact: () => [x + 20, -330, 40], ring: () => [x + 140, -260, 30], gland: () => [x - 110, -300, 60],
      spill: () => [x - 150, breachY - 90, 40], surface: () => [x - width / 2 + 20, 0, 0], cell: () => [x - 150, -260, 40],
    },
  };
};
