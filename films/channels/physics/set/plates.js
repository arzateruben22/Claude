// plates.js: photographic PLATES behind the code-animated physics subjects (the way One More Orbit uses its paintings).
//
//   const plates = createPlates({ scene, camera, W, H, FILM });     // FILM.plates = [ plate, ... ] (film.json)
//   window.SCENE_READY = plates.ready;                                // resolves when every plate image is loaded (or has failed: never rejects)
//   if (plates.apply(t)) { /* a plate is on screen: hide the code kitchen */ }
//   const c = plates.cam(t);                                          // the plate's own camera ({look, fitW, yaw, pitch}) or null
//   const a = plates.anchor(t);                                       // where the subject goes for this plate (world position, scale, tint, shadow, focus), or null
//
// plate: { id, t0, t1, file, file9, push, parallax, fade, cam, anchor, layers }
//   file / file9   the 16:9 and the 9:16 image (paths relative to this file's folder, e.g. "../lf01/art/plates/kitchen-wide_16x9.png")
//   push           the slow push across the shot: the picture scales 1 -> 1 + push (default 0.05)
//   parallax       a sideways drift of the picture across the shot, as a fraction of the frame width (default 0.02)
//   layers         [{ file, file9, depth }]: depth slices cut from the plate (PNG with alpha), nearest last; each drifts by its own amount (2.5D)
//   fade           seconds of cross-fade at the ends of the shot (default 0.35)
//   cam            { look, fitW, yaw, pitch }: pins the code camera for the shot so the subjects line up with the plate
//   anchor         { pos: [x, y, z], scale, tint: "#rrggbb", shadow: 0..1, focus: [x, y, z], fstop }: where the code subject sits, its light tint, its contact shadow and the depth of field
// Missing or unreadable images switch that plate off, and the code kitchen is drawn instead (the fallback).
import * as THREE from "three";

export const createPlates = ({ scene, camera, W, H, FILM }) => {
  const nine = H > W, list = (FILM.plates || []).filter(Boolean), D = 6, fov = (camera.fov * Math.PI) / 180, qh = 2 * D * Math.tan(fov / 2), qw = qh * (W / H);
  const loader = new THREE.TextureLoader();
  if (!scene.children.includes(camera)) scene.add(camera);
  const load = (file) => new Promise((res) => {
    if (!file) return res(null);
    loader.load(new URL(file, import.meta.url).href, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; res(tex); }, undefined, () => res(null));
  });
  const mkQuad = (tex, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    m.renderOrder = -100 + z; m.visible = false; m.frustumCulled = false; camera.add(m); return m;
  };
  const cover = (tex, m) => {   // fit the image to cover the frame (no stretch), centred
    const ia = tex.image.width / tex.image.height, fa = W / H, w = ia > fa ? qh * ia : qw, h = ia > fa ? qh : qw / ia;
    m.userData.base = [w, h];
  };
  const items = list.map((p) => ({ p, quads: [], ok: false }));
  const ready = Promise.all(items.map(async (it) => {
    const layers = it.p.layers && it.p.layers.length ? it.p.layers : [{ file: it.p.file, file9: it.p.file9, depth: 0 }];
    const texs = await Promise.all(layers.map((l) => load(nine ? l.file9 || l.file : l.file)));
    if (texs.some((t) => !t)) { it.ok = false; return; }
    it.quads = texs.map((tex, i) => { const m = mkQuad(tex, i); cover(tex, m); m.userData.depth = layers[i].depth || 0; return m; });
    it.ok = true;
  })).catch(() => {});
  const active = (t) => { for (const it of items) if (it.ok && t >= it.p.t0 && t < it.p.t1) return it; return null; };
  const apply = (t) => {
    for (const it of items) for (const m of it.quads) m.visible = false;
    const it = active(t); if (!it) return false;
    const p = it.p, d = Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))), f = p.fade ?? 0.35;
    const a = Math.min(1, (t - p.t0) / f, (p.t1 - t) / f), push = p.push ?? 0.05, par = p.parallax ?? 0.02;
    it.quads.forEach((m, i) => {
      const [bw, bh] = m.userData.base, s = 1 + push * d * (1 + 0.6 * (m.userData.depth || 0)), shift = par * (d - 0.5) * qw * (1 + (m.userData.depth || 0));
      m.visible = true; m.position.set(shift, 0, -D); m.scale.set(bw * s * 1.08, bh * s * 1.08, 1); m.material.opacity = Math.max(0, Math.min(1, a));
    });
    return true;
  };
  const cam = (t) => { const it = active(t); return it && it.p.cam ? it.p.cam : null; };
  const anchor = (t) => { const it = active(t); return it && it.p.anchor ? it.p.anchor : null; };
  return { ready, apply, cam, anchor, active, items };
};
