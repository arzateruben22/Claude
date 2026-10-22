// rig.js — the telescope mount (films/channels/space/set): a camera keyed as an orbit around a target,
// never handheld. The bible's moves are all here: a locked diagram view (elevation 60–75° above the
// orbital plane), a drift (distance eased in log space, ≤ 5% a second), an orbit arc (azimuth, which
// compile.py keeps at ≤ 1.5° a second: stars are points the motion-blur probe can't see), and the
// frame offset that puts the subject where the bible wants it (y 300–1100 of 1920, above the captions)
// without a view offset (the finish uses setViewOffset for its own jitter and clears it afterwards).
//
//   key: { t, target: [x,y,z], dist, el (deg above the plane), az (deg, 0 = camera on +z), fov (deg),
//          fx, fy (where the target lands, as fractions of the frame; default 0.5, 0.42), roll (deg), ease }
//   const rig = createRig(FILM.cam);         // { shot: [keys...] } (each shot is its own continuous move)
//   rig.place(camera, shot, t)  → { target, dist, el, az, fov }
//   rig.pose(shot, t)           the pose alone (no camera), e.g. at the frame's own moment for the sky probes
import * as THREE from "three";
import { ease } from "cinema/film/runtime.js";

const D2R = Math.PI / 180;
const lerp = (a, b, u) => a + (b - a) * u;

export const poseAt = (keys, t) => {
  let i = keys.findIndex((k) => k.t > t);
  if (i < 0) i = keys.length; if (i < 1) i = 1;
  const a = keys[Math.min(i - 1, keys.length - 1)], b = keys[Math.min(i, keys.length - 1)];
  const u = a === b ? 0 : ease(b.ease || "inout2")(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const L = (k, d) => lerp(a[k] ?? d, b[k] ?? d, u);
  return {
    target: [0, 1, 2].map((j) => lerp(a.target[j], b.target[j], u)),
    dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), u)),
    el: L("el", 65), az: L("az", 0), fov: L("fov", 24), fx: L("fx", 0.5), fy: L("fy", 0.42), roll: L("roll", 0),
  };
};

export const createRig = (cams) => {
  const tmp = new THREE.PerspectiveCamera();
  const apply = (camera, P) => {
    const el = P.el * D2R, az = P.az * D2R, [tx, ty, tz] = P.target;
    camera.position.set(tx + P.dist * Math.cos(el) * Math.sin(az), ty + P.dist * Math.sin(el), tz + P.dist * Math.cos(el) * Math.cos(az));
    camera.fov = P.fov;
    camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    // put the target at (fx, fy) of the frame: turn the camera by the angles that move it there
    const tv = Math.tan((P.fov * D2R) / 2), th = tv * camera.aspect;
    const pitch = Math.atan((P.fy - 0.5) * 2 * tv), yaw = Math.atan((P.fx - 0.5) * 2 * th);
    camera.rotateY(yaw); camera.rotateX(pitch);
    if (P.roll) camera.rotateZ(P.roll * D2R);
    camera.updateMatrixWorld();
    return P;
  };
  return {
    pose: (shot, t) => poseAt(cams[shot], t),
    place: (camera, shot, t) => apply(camera, poseAt(cams[shot], t)),
    frameCamera: (camera, shot, t) => { tmp.aspect = camera.aspect; tmp.near = camera.near; tmp.far = camera.far; apply(tmp, poseAt(cams[shot], t)); return tmp; },
  };
};
