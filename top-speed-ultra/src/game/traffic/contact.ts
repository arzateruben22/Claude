// You against one other car: two oriented boxes in the plane, swept over the step. At 120 m/s the player moves a metre
// a step, so a plain overlap test after the fact can find the boxes already a metre deep along the nose and only a
// hand's width deep sideways, pick the sideways axis as the normal (the smallest overlap) and turn a rear-end into a
// side rub with no closing speed. Here the player is swept from where the step began to where it ended in a few
// sub-positions; the first that overlaps is the contact, and its normal is the box axis the approach came along when
// the overlap there says it arrived this substep, the smallest-overlap axis otherwise (a slow rub). No three.js, so the
// headless harness can bundle it; no allocation.

export interface ContactBody { x: number; z: number; y: number; h: number; v: number }
export interface ContactPlayer { x: number; z: number; y: number; psi: number; wx: number; wz: number; px: number; pz: number; ppsi: number; altitude: number; len: number; wid: number }
export interface ContactOut { speed: number; nx: number; nz: number; depth: number }

let pfx = 0, pfz = 0, prx = 0, prz = 0, cfx = 0, cfz = 0, crx = 0, crz = 0;
// the overlap of the two boxes along axis (ax, az) for a player centre (dx, dz) from the car; <= 0 when separated
function overlap(ax: number, az: number, dx: number, dz: number, hl: number, hw: number, cl2: number, cw: number) {
  const pa = hl * Math.abs(pfx * ax + pfz * az) + hw * Math.abs(prx * ax + prz * az);
  const ca = cl2 * Math.abs(cfx * ax + cfz * az) + cw * Math.abs(crx * ax + crz * az);
  return pa + ca - Math.abs(dx * ax + dz * az);
}

// true when the player's box, swept over this step, meets the car's. `out` gets the normal (pointing from the car to
// the player), the closing speed along it and the depth at the player's final pose, for the push-out. The player's own
// motion is its pose change since the last step (px, pz, ppsi); `dtCar` is the time the traffic car moved by this step
// (the world's rate, shorter than the player's under Focus Time), so its start point is where it really was.
export function sweptContact(P: ContactPlayer, c: ContactBody, cLen: number, cWid: number, height: number, dtCar: number, out: ContactOut) {
  if (Math.abs(c.y - P.y) > 2.5 || P.altitude > height + 0.3) return false;
  const dtc = Math.max(dtCar, 1e-6);
  const dxr = P.x - P.px - Math.sin(c.h) * c.v * dtc, dzr = P.z - P.pz - Math.cos(c.h) * c.v * dtc;
  const dist = Math.sqrt(dxr * dxr + dzr * dzr);
  const dx0 = c.x - P.x, dz0 = c.z - P.z;
  if (Math.abs(dx0) > 25 + dist || Math.abs(dz0) > 25 + dist) return false;
  const hl = P.len / 2, hw = P.wid / 2, cl2 = 0.5 * cLen, cw = 0.5 * cWid;
  cfx = Math.sin(c.h); cfz = Math.cos(c.h); crx = -cfz; crz = cfx;
  let dpsi = P.psi - P.ppsi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
  const n = Math.min(4, Math.max(1, Math.ceil(dist / 0.4)));
  const ux = dist > 1e-9 ? -dxr / dist : 0, uz = dist > 1e-9 ? -dzr / dist : 0;   // the approach direction (toward the car)
  for (let k = 1; k <= n; k++) {
    const f = k / n;
    const psi = P.ppsi + dpsi * f;
    pfx = Math.sin(psi); pfz = Math.cos(psi); prx = -pfz; prz = pfx;
    const dx = c.x - (P.x - dxr * (1 - f)), dz = c.z - (P.z - dzr * (1 - f));
    const o0 = overlap(pfx, pfz, dx, dz, hl, hw, cl2, cw); if (o0 <= 0) continue;
    const o1 = overlap(prx, prz, dx, dz, hl, hw, cl2, cw); if (o1 <= 0) continue;
    const o2 = overlap(cfx, cfz, dx, dz, hl, hw, cl2, cw); if (o2 <= 0) continue;
    const o3 = overlap(crx, crz, dx, dz, hl, hw, cl2, cw); if (o3 <= 0) continue;
    // all four axes overlap: this sub-position is the contact. The normal: the axis the approach came along when it
    // arrived within this substep, otherwise the smallest overlap
    let ax = pfx, az = pfz, best = o0;
    if (o1 < best) { best = o1; ax = prx; az = prz; }
    if (o2 < best) { best = o2; ax = cfx; az = cfz; }
    if (o3 < best) { best = o3; ax = crx; az = crz; }
    if (dist > 1e-9) {
      const a0 = Math.abs(pfx * ux + pfz * uz), a1 = Math.abs(prx * ux + prz * uz), a2 = Math.abs(cfx * ux + cfz * uz), a3 = Math.abs(crx * ux + crz * uz);
      let aa = a0, ao = o0, aax = pfx, aaz = pfz;
      if (a1 > aa) { aa = a1; ao = o1; aax = prx; aaz = prz; }
      if (a2 > aa) { aa = a2; ao = o2; aax = cfx; aaz = cfz; }
      if (a3 > aa) { aa = a3; ao = o3; aax = crx; aaz = crz; }
      if (aa > 0.5 && ao <= dist / n + 0.05) { ax = aax; az = aaz; }
    }
    // sign so the normal points from the car to the player, at the final pose; depth there, for the push-out
    pfx = Math.sin(P.psi); pfz = Math.cos(P.psi); prx = -pfz; prz = pfx;
    const d = dx0 * ax + dz0 * az, sg = d > 0 ? -1 : 1;
    out.nx = ax * sg; out.nz = az * sg;
    out.depth = Math.max(0, overlap(ax, az, dx0, dz0, hl, hw, cl2, cw));
    const cvx = cfx * c.v, cvz = cfz * c.v;
    out.speed = Math.max(0, -((P.wx - cvx) * out.nx + (P.wz - cvz) * out.nz));
    return true;
  }
  return false;
}
