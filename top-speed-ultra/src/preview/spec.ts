// The realism preview's shared numbers: the car's frame, the driver's eye, the steering wheel, the stretch of real
// freeway the scene is built on, and what each part may spend. Every part builds against these so the parts fit.
// The preview is a separate page. It never changes the game; it imports game modules read-only.
import * as THREE from 'three';

// ------------------------------------------------------------------------------------------------ the car's frame
// The same frame as the game's car: metres, x to the driver's right, y up, the car faces -z. The car's origin is on
// the ground under the middle of the car. The driver sits on the left (US).
export const EYE = new THREE.Vector3(-0.37, 1.16, 0.1);          // the driver's eyes
export const WHEEL_AT = new THREE.Vector3(-0.37, 0.8, -0.42);    // the steering wheel's hub
export const WHEEL_TILT = -0.38;                                  // the wheel mount's rotation.x: its face leans back
export const RIM_R = 0.178;                                       // rim centreline radius (round, flattened at the bottom)

// The rim's centreline in the wheel's own plane (x right, y up, z toward the driver), angle a in radians from 3 o'clock
// counter-clockwise. Copied from the game's cockpit so a new rim and new hands meet the same wheel.
export function rimAt(a: number, out = new THREE.Vector3()) {
  let x = Math.cos(a) * RIM_R, y = Math.sin(a) * RIM_R;
  const fb = -RIM_R * 0.74, ft = RIM_R * 0.93;
  if (y < fb) { y = fb + (y - fb) * 0.16; x *= 1.04; }
  if (y > ft) y = ft + (y - ft) * 0.45;
  return out.set(x, y, 0);
}
const ang = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const gripBulge = (a: number) => Math.exp(-(ang(a, 0) ** 2) / 0.22) + Math.exp(-(ang(a, Math.PI) ** 2) / 0.22);
// the rim's half-thickness at angle a: radial (in the wheel's plane) and axial (toward the driver)
export const rimA = (a: number) => 0.0185 + 0.006 * gripBulge(a);
export const rimB = (a: number) => 0.0235 + 0.006 * gripBulge(a);
// where the hands hold the rim (degrees, same convention as rimAt), and the shoulders the arms come from (car frame)
export const GRIP = {
  left: { deg: 148, shoulder: new THREE.Vector3(-0.6, 0.88, 0.24) },
  right: { deg: 32, shoulder: new THREE.Vector3(-0.14, 0.88, 0.24) },
};

// ------------------------------------------------------------------------------------------------ the stretch
// I-405 North through Irvine and Costa Mesa: from before the Jamboree Road exit, past John Wayne Airport / MacArthur
// Boulevard, to the CA-55 interchange. Control-point indices into the network's I-405 North path; real exit signs at
// 217 (Jamboree Road), 241 (John Wayne Airport / MacArthur Boulevard), 256 (CA 55 North), 286 (Anton Boulevard).
export const STRETCH = { label: 'I-405 North', ctrl0: 200, ctrl1: 270 };
// roughly where it is, for fetching open data (degrees). A generous box around the stretch.
export const STRETCH_BBOX = { west: -117.885, east: -117.825, south: 33.665, north: 33.700 };

// ------------------------------------------------------------------------------------------------ budgets
// What each part may spend, so the whole scene still has a chance on a recent phone's GPU at reduced resolution.
// Draw calls and triangles are what renderer.info reports with the part in view. Textures are generated in code.
export const BUDGET = {
  hands: { calls: 12, tris: 220_000, textureSize: 2048 },
  cockpit: { calls: 90, tris: 350_000, textureSize: 2048 },
  car: { calls: 60, tris: 300_000, textureSize: 2048 },
  road: { calls: 120, tris: 500_000, textureSize: 2048 },
  buildings: { calls: 60, tris: 400_000, textureSize: 2048 },
  vegetation: { calls: 60, tris: 400_000, textureSize: 1024 },
  atmosphere: { calls: 20, tris: 50_000, textureSize: 2048 },
};
