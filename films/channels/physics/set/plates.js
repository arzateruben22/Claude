// plates.js: photographic PLATES behind the code-animated physics subjects (the way One More Orbit uses its paintings).
//
//   const plates = createPlates({ scene, camera, W, H, FILM, canvas });     // FILM.plates = [ plate, ... ] (film.json)
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
//   cam3           { pos: [x, y, z], target: [x, y, z], fov }: a pinhole camera that matches the plate (the vertical field of view in degrees); the push is a zoom of that field, so the proxy room stays aligned
//   anchor         { pos: [x, y, z], scale, tint: "#rrggbb", shadow: 0..1, focus: [x, y, z], fstop }: where the code subject sits, its light tint, its contact shadow and the depth of field
// The plate is a DOM image BEHIND the 3-D canvas (the canvas is transparent where nothing is drawn), so the cinema finish (ACES, bloom, grade) never touches it:
// its pixels reach the screen exactly as the source file has them. Only the code subjects and the shell go through the finish.
// Missing or unreadable images switch that plate off, and the code kitchen is drawn instead (the fallback).

export const createPlates = ({ scene, camera, W, H, FILM, canvas }) => {
  const nine = H > W, list = (FILM.plates || []).filter(Boolean);
  const load = (file) => new Promise((res) => {
    if (!file) return res(null);
    const im = new Image(); im.decoding = "sync";
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => res(im)); }; im.onerror = () => res(null);
    im.src = new URL(file, import.meta.url).href;
  });
  const mk = (im, z) => {
    im.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover;display:none;transform-origin:50% 50%;will-change:transform;pointer-events:none;`;
    canvas.parentNode.insertBefore(im, canvas); im.dataset.z = z; return im;
  };
  const items = list.map((p) => ({ p, imgs: [], ok: false }));
  const ready = Promise.all(items.map(async (it) => {
    const layers = it.p.layers && it.p.layers.length ? it.p.layers : [{ file: it.p.file, file9: it.p.file9, depth: 0 }];
    const ims = await Promise.all(layers.map((l) => load(nine ? l.file9 || l.file : l.file)));
    if (ims.some((m) => !m)) { it.ok = false; return; }
    it.imgs = ims.map((im, i) => { mk(im, i); im.dataset.depth = layers[i].depth || 0; return im; });
    it.ok = true;
  })).catch(() => {});
  const active = (t) => { for (const it of items) if (it.ok && t >= it.p.t0 && t < it.p.t1) return it; return null; };
  const apply = (t) => {
    for (const it of items) for (const im of it.imgs) im.style.display = "none";
    const it = active(t); if (!it) return false;
    const p = it.p, d = Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))), f = p.fade ?? 0.35;
    const a = Math.min(1, (t - p.t0) / f, (p.t1 - t) / f), push = p.push ?? 0.05, par = p.parallax ?? 0.02;
    it.imgs.forEach((im) => {
      const dep = +im.dataset.depth, s = 1 + push * d * (p.cam3 ? 1 : 1 + 0.6 * dep), shift = par * (d - 0.5) * W * (1 + dep), over = p.over ?? (p.cam3 ? 1 : 1.04);
      im.style.display = "block"; im.style.opacity = String(Math.max(0, Math.min(1, a))); im.style.transform = `translate(${shift.toFixed(2)}px,0) scale(${(s * over).toFixed(5)})`;
    });
    return true;
  };
  const cam = (t) => { const it = active(t); return it && it.p.cam ? it.p.cam : null; };
  const zoom = (t) => { const it = active(t); if (!it) return 1; const p = it.p; return 1 + (p.push ?? 0.05) * Math.max(0, Math.min(1, (t - p.t0) / (p.t1 - p.t0))); };
  const cam3 = (t) => { const it = active(t); return it && it.p.cam3 ? it.p.cam3 : null; };
  const anchor = (t) => { const it = active(t); return it && it.p.anchor ? it.p.anchor : null; };
  return { ready, apply, cam, cam3, zoom, anchor, active, items };
};
