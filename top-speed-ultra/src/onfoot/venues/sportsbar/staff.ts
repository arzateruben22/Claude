// The bartenders' lane path (PROJECT_OC_SPORTS_BAR.md, "The bartenders' lane path"): staff don't walk the lane on the
// walk grid (a 1.15 m lane and a 0.8 m flap hold no connected run of free cells, 24.5 degrees off the grid); they walk
// this polyline in frame coordinates, moved along it directly with no collision test, from the lane's east end west
// to the flap, then south through it to the hand-off point H on the floor. S1 builds it and tests it with a stand-in
// body; S2a and S3a put bartenders on it.
import type { P2 } from '../../engine/venue-def';
import type { Frame } from '../../engine/frame';
import { ColliderSet, Collider, distTo } from '../../engine/collide';

export function pathLength(path: P2[]) { let s = 0; for (let i = 1; i < path.length; i++) s += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return s; }
/** the point s metres along the path (frame), and the direction there */
export function pathAt(path: P2[], s: number): { at: P2; dir: P2 } {
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= l || i === path.length - 1) { const t = l ? Math.max(0, Math.min(1, s / l)) : 0; return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / (l || 1), (b[1] - a[1]) / (l || 1)] }; }
    s -= l;
  }
  return { at: path[path.length - 1], dir: [0, -1] };
}
/** a body moved along the path from end to end (every 2 cm): its least clearance to every collider but the gate */
export function laneTest(path: P2[], frame: Frame, set: ColliderSet, skip: (c: Collider) => boolean, R = 0.3) {
  const L = pathLength(path), h = { d: 0, nx: 0, nz: 0 };
  let worst = Infinity, where: P2 = [0, 0], by = '';
  for (let s = 0; s <= L + 1e-6; s += 0.02) {
    const { at } = pathAt(path, s), [x, z] = frame.fromFrame(at[0], at[1]);
    for (const c of set.query(x - 1.5, z - 1.5, x + 1.5, z + 1.5)) {
      if (!c.on || skip(c)) continue;
      const d = distTo(c, x, z, h).d - R;
      if (d < worst) { worst = d; where = at; by = c.tag; }
    }
  }
  return { length: +L.toFixed(2), clearance: +worst.toFixed(3), at: where, by };
}
