// acne01.js — No. 001's below-the-surface set (films/channels/skincare/set): one hair follicle with its oil gland, cut
// open (simplified, badged). Units µm; the surface is y = 0; the camera looks from +z at the cut face (z = 0).
//   createAcneFollicle({ x, seed, tone }) → { group, set(p), at }
//   set({ tone, bact, ring, ringLit, flood, rupt, press, red, dim })
//     bact 0 … 1   the rod-shaped bacteria deep in the canal glow orange-red (as under UV: their porphyrins)
//     ring 0 … 1   immune cells ringing the follicle appear one by one; ringLit 0 … 1 lights them cyan (the subject)
//     flood 0 … 1  white cells pour in from the dermis into the canal
//     rupt 0 … 1   the canal's lower wall gives way; the contents spill into the dermis
//     press 0 … 1  a thumb's pressure from above: the surface dents, the spill is driven deeper, the red spreads
//     thumb 0 … 1  the thumb present (1) or lifted away (0) while the press holds
//     red 0 … 1    inflammation: a red haze around the follicle (grows with rupt and press)
//   at.{canal, ring, bact, spill, surface, gland, cell}() → world points for labels and the gauge
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { toneColor } from "./section.js";

export const createAcneFollicle = ({ x = 0, seed = 11, width = 1000, depth = 900, thick = 340, epi = 100 } = {}) => {
  const R = rng(seed), g = new THREE.Group(); g.position.x = x;
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5)];
  const mat = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clip, ...o });
  const M = { dermis: mat({ roughness: 0.8 }), epi: mat(), sc: mat({ roughness: 0.5 }), wall: mat({ roughness: 0.5 }), plug: mat({ roughness: 0.35 }), gland: mat({ roughness: 0.4 }) };
  // the block: dermis below, epidermis (its top displaced by the thumb), a thin dead layer
  const dermis = new THREE.Mesh(new THREE.BoxGeometry(width, depth, thick), M.dermis); dermis.position.y = -epi - depth / 2;
  const epiGeo = new THREE.BoxGeometry(width, epi, thick, 120, 1, 30), ep = epiGeo.attributes.position, epY = Float32Array.from(ep.array);
  const epiM = new THREE.Mesh(epiGeo, M.epi); epiM.position.y = -epi / 2;
  g.add(dermis, epiM);
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
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), nailMat); nail.scale.set(190, 34, 150); g.add(nail);
  const breachY = -400;
  return {
    group: g, dims: { width, depth, epi, breachY },
    set({ tone = 0.18, bact: bk = 0, ring = 0, ringLit = 0, flood = 0, rupt = 0, press = 0, red = 0, dim = 0, thumb: thumbK = 1 } = {}) {
      const k = 1 - 0.45 * dim;
      M.dermis.color.setRGB(...toneColor("dermis", tone).map((v) => v * k * 0.9));
      M.epi.color.setRGB(...toneColor("living", tone).map((v) => v * k));
      M.wall.color.setRGB(...toneColor("basal", tone).map((v) => v * k * 0.85));
      M.plug.color.setRGB(0.93 * k, 0.86 * k, 0.6 * k);
      glands.forEach((m) => m.material.color.setRGB(0.95 * k, 0.88 * k, 0.62 * k));
      bactMat.emissive.setRGB(1.0 * bk, 0.32 * bk, 0.16 * bk);
      bact.forEach((m) => { m.visible = bk > 0.01; });
      ringMat.emissive.setRGB(0.15 * ringLit, 0.75 * ringLit, 0.72 * ringLit); floodMat.emissive.copy(ringMat.emissive);
      ringC.forEach((m) => { m.visible = m.userData.k < ring; });
      floodC.forEach((m) => { const u = Math.min(1, Math.max(0, flood * 1.4 - m.userData.k * 0.4)); const { from, to } = m.userData; m.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, -20); m.visible = flood > 0.01 && u > 0.001; });
      // the breach: the lower wall and plug open (scaled thin) as the wall gives way
      wall.scale.set(1, 1 - 0.0 * rupt, 1); plug.visible = rupt < 0.98; plug.material.opacity = 1;
      spill.forEach((m) => { const { a, d, k: kk, z } = m.userData; const u = Math.min(1, Math.max(0, rupt * 1.3 - kk * 0.3)); const dd = d * u + 150 * press * u; m.position.set(Math.cos(a) * dd * 1.2, breachY + Math.sin(a) * dd - 60 * press * u, z); m.visible = u > 0.01; });
      redMat.opacity = 0.32 * red; redHaze.visible = red > 0.01; const rs = 160 + 160 * rupt + 240 * press; redHaze.scale.set(rs * 1.3, rs, rs * 0.5); redHaze.position.y = -340 - 160 * press; redHaze.position.z = -60;
      // the thumb from above, denting the surface
      thumbMat.color.setRGB(...toneColor("living", tone)); thumbMat.opacity = Math.min(1, press * 3) * 0.95 * thumbK; thumb.visible = press > 0.01 && thumbK > 0.01; thumb.position.y += 0;
      thumb.position.set(0, 165 - 90 * press + 260 * (1 - thumbK), 120);
      nail.position.set(40, thumb.position.y + 150, 40); nail.rotation.z = -0.12; nailMat.opacity = thumbMat.opacity; nail.visible = thumb.visible;
      for (let i = 0; i < ep.count; i++) { const by = epY[3 * i + 1], bx = epY[3 * i]; if (by > 0) ep.setY(i, by - 70 * press * Math.exp(-(bx * bx) / 60000)); }
      ep.needsUpdate = true; epiGeo.computeVertexNormals();
    },
    at: {
      canal: () => [x, -150, 40], bact: () => [x + 20, -330, 40], ring: () => [x + 120, -250, 50], gland: () => [x - 110, -300, 60],
      spill: () => [x - 150, breachY - 90, 40], surface: () => [x - width / 2 + 20, 0, 0], cell: () => [x - 150, -260, 40],
    },
  };
};
