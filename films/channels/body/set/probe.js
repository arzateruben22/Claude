// probe.js — the set's own motion probe (films/channels/body/set): the cross-check's probe2, done in the scene.
//
// cinema3d.js decides how many sub-frames a frame needs (K) from how far things move on screen between the
// two ends of the shutter, but its probe (as shipped; probe2 is not in it yet and the file is frozen while
// other renders depend on it) has three blind spots this set would hit all the time:
//   1. its five camera points are unprojected and reprojected through the same camera, so they read 0 px:
//      a ride-along (the walls streaming past a locked-on cell) would get K 2 and strobe;
//   2. mesh origins near or behind the lens project to huge values and pin K at kMax;
//   3. instances scaled to 0 at a loop's wrap still count, so a cell wrapping from the end of its vessel to
//      the start reads as a jump across the frame.
// So in probe mode the scene hides its own meshes from the finish's probe (it walks only visible meshes)
// and writes its own samples into CINEMA.probe, the same Map the finish compares between the two shutter
// ends (the key of a sample must name the same thing at both ends; a key missing at one end is ignored):
//   - static world points (vessel walls, tissue): camera motion, measured correctly, because each is
//     projected through the camera at its own end of the shutter;
//   - the cells and particles, from the same functions that place them (positions computed in JS);
//   - skipped: anything behind the lens or nearer than `near` (2 cell widths: no mote or cell may sit
//     there anyway), anything far off screen (|ndc| > 1.25), and things at a wrap or at scale 0.
// The finish then takes K = clamp(ceil(px / 3.5), kMin, kMax) as usual; render.mjs's draft cap (K ≤ 6)
// still applies. kFloor is never used: the fold (a vertex-shader morph) is sampled through the hero's
// own folded rim points, which the scene passes as ordinary samples.
//
//   import { probe } from "../set/probe.js";
//   const PR = probe(THREE, { W, H, near: 15 });
//   window.seek = (t) => {
//     ...place everything for t...
//     if (PR.active()) { world.visible = false; PR.begin(camera); PR.add("hero", heroPos); ...; world.visible = true; return renderer.render(scene, camera); }
//   };
//   (the render call in probe mode is what the finish expects; with the world hidden it adds nothing.)

export const probe = (THREE, o = {}) => {
  const W = o.W, H = o.H, near = o.near ?? 15, lim = o.ndc ?? 1.25;
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  let cam = null, n = 0;
  const active = () => !!(window.CINEMA && window.CINEMA.mode === "probe");
  const begin = (camera) => { camera.updateMatrixWorld(); cam = camera; n = 0; };
  const add = (key, p) => {
    if (!cam || !window.CINEMA) return false;
    v.set(p[0], p[1], p[2]);
    w.copy(v).applyMatrix4(cam.matrixWorldInverse);
    if (-w.z < near) return false;                    // behind the lens, or too close to it
    v.project(cam);
    if (!(Math.abs(v.x) <= lim && Math.abs(v.y) <= lim)) return false;
    window.CINEMA.probe.set("mi:" + key, [(v.x + 1) * 0.5 * W, (1 - v.y) * 0.5 * H]);
    n++;
    return true;
  };
  return { active, begin, add, count: () => n };
};
