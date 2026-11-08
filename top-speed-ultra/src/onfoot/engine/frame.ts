// A venue's frame (PROJECT_OC_SPORTS_BAR.md, "The building frame" and the module map's coords.ts row).
//   game:  the driving game's coordinates (x east, z south, metres); the test hooks take and report these.
//   local: world-aligned, moved so the frame's origin is 0 (small numbers on the GPU; the game's sun and sky stay right).
//   frame: (u, v) along the venue's own axes A and B (unit vectors in game x, z): game = origin + u A + v B.
export type P2 = [number, number];

export interface Frame {
  origin: P2; A: P2; B: P2;
  toLocal(gx: number, gz: number): P2;
  toGame(lx: number, lz: number): P2;
  /** local to (u, v) */
  toFrame(lx: number, lz: number): P2;
  /** (u, v) to local */
  fromFrame(u: number, v: number): P2;
  /** a frame direction (du, dv) as a local direction */
  dirToLocal(du: number, dv: number): P2;
  /** the yaw (Lot 57's heading, atan2(dx, dz)) that faces along the frame direction (du, dv) */
  yawFromFrame(du: number, dv: number): number;
  /** the rotation round y that turns an object's local x onto A and its local z onto B (Batch.box, box(), rotation.y) */
  rot: number;
}

export function makeFrame(originGame: P2, axisU: P2, axisV: P2): Frame {
  const [ox, oz] = originGame, [ax, az] = axisU, [bx, bz] = axisV;
  const f: Frame = {
    origin: [ox, oz], A: [ax, az], B: [bx, bz],
    toLocal: (gx, gz) => [gx - ox, gz - oz],
    toGame: (lx, lz) => [lx + ox, lz + oz],
    toFrame: (lx, lz) => [lx * ax + lz * az, lx * bx + lz * bz],
    fromFrame: (u, v) => [u * ax + v * bx, u * az + v * bz],
    dirToLocal: (du, dv) => [du * ax + dv * bx, du * az + dv * bz],
    yawFromFrame: (du, dv) => { const x = du * ax + dv * bx, z = du * az + dv * bz; return Math.atan2(x, z); },
    // box() and Batch.box map their local x to (cos r, -sin r) and local z to (sin r, cos r)
    rot: Math.atan2(-az, ax),
  };
  return f;
}

/**
 * The building frame from a footprint ring (game metres): the front is the short edge (under 25 m) nearest the
 * venue's open-data point (the arm's slanted tip, from its south-east corner to its north-east one; the north wing's
 * east end is as short, so length alone can't pick it), the origin is that edge's southern end, u runs along the mean
 * direction of the two long walls that meet it (the arm's south wall and its courtyard wall), and v is u turned toward
 * the courtyard. Computed at load from building 61, never copied (the plan's table checks it).
 */
export function frameFromRing(ring: P2[], anchor: P2): { origin: P2; A: P2; B: P2; front: [number, number] } {
  const n = ring.length;
  let k = 0, best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 25) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1]; let t = ((anchor[0] - a[0]) * dx + (anchor[1] - a[1]) * dz) / (l * l); t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(anchor[0] - a[0] - dx * t, anchor[1] - a[1] - dz * t);
    if (d < best) { best = d; k = i; }
  }
  const i0 = k, i1 = (k + 1) % n;
  // the southern end (larger z) is O; its other edge is the south wall, the other end's is the courtyard wall
  const [s, t] = ring[i0][1] > ring[i1][1] ? [i0, i1] : [i1, i0];
  const sNext = s === i1 ? (i1 + 1) % n : (i0 - 1 + n) % n, tNext = t === i1 ? (i1 + 1) % n : (i0 - 1 + n) % n;
  const unit = (a: P2, b: P2): P2 => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const d1 = unit(ring[s], ring[sNext]), d2 = unit(ring[t], ring[tNext]);
  let ax = d1[0] + d2[0], az = d1[1] + d2[1]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  let bx = -az, bz = ax;
  // v points from the south wall toward the courtyard wall
  const tv = (ring[t][0] - ring[s][0]) * bx + (ring[t][1] - ring[s][1]) * bz;
  if (tv < 0) { bx = -bx; bz = -bz; }
  return { origin: [ring[s][0], ring[s][1]], A: [ax, az], B: [bx, bz], front: [s, t] };
}
