// The food trucks' wheels (venue.ts places them; the page instances them): a tyre turned in section (bead, sidewall
// bulge, rounded shoulders, a tread with two grooves) and a polished rim (a dished face, a raised hub, a ring of lug
// nuts on High and Ultra). Built along +x (the outboard face) at a 0.41 m radius; segments by preset.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** a lathe round x (outboard +x) from a profile of [radius, x] points */
function latheX(profile: [number, number][], seg: number) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), seg);
  g.rotateZ(-Math.PI / 2);          // the lathe's axis (y) onto x
  return g;
}

export function truckWheel(detail: 0 | 1 | 2) {
  const seg = detail === 0 ? 14 : detail === 1 ? 24 : 40;
  // the tyre in section, inboard bead to outboard bead (radius, axial)
  const tyre = latheX([
    [0.24, -0.1], [0.27, -0.118], [0.33, -0.128], [0.375, -0.124], [0.4, -0.108], [0.41, -0.085],
    ...(detail ? [[0.412, -0.05], [0.404, -0.045], [0.404, -0.03], [0.413, -0.025], [0.413, 0.025], [0.404, 0.03], [0.404, 0.045], [0.412, 0.05]] as [number, number][] : []),
    [0.41, 0.085], [0.4, 0.108], [0.375, 0.124], [0.33, 0.128], [0.27, 0.118], [0.24, 0.1],
  ], seg);
  // the rim's outboard face: lip, a dished ring, the face, the hub and its cap
  const rimParts: THREE.BufferGeometry[] = [latheX([
    [0.252, 0.098], [0.25, 0.108], [0.238, 0.104], [0.215, 0.08], [0.19, 0.066], [0.15, 0.062], [0.105, 0.066], [0.09, 0.08],
    [0.075, 0.084], [0.06, 0.1], [0.035, 0.112], [0.0, 0.114],
  ], seg)];
  if (detail) {
    // eight lug nuts on a 0.075 m bolt circle, and the face's hand holes (dark rings read as holes on a polished face)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, n = new THREE.CylinderGeometry(0.011, 0.011, 0.022, 6);
      n.rotateZ(-Math.PI / 2); n.translate(0.094, Math.sin(a) * 0.075, Math.cos(a) * 0.075);
      rimParts.push(n);
    }
  }
  const rim = mergeGeometries(rimParts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  // the dark inner barrel (seen past the dish) goes with the tyre
  const barrel = latheX([[0.236, -0.1], [0.236, 0.1]], seg);
  const tyreAll = mergeGeometries([tyre.toNonIndexed(), barrel.toNonIndexed()], false)!;
  return { tyre: tyreAll, rim };
}
