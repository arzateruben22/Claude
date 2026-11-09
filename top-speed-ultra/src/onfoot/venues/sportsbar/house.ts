// The house player (S2b, PROJECT_OC_SPORTS_BAR.md, "### S2b: the games"): the scripted house opponent you play pool,
// darts and shuffleboard against, one of our staff in the house uniform, built by the people builder at LOD 1 with the
// bartender and the server (so setting up a game adds no person and no draw call). Between games they wait by the
// darts; in a game they walk to their place for each turn on the walk grid and play the game clips on S2a's clip layer
// (engine/sim/clips.ts). Like the other staff inside the unit, they don't cast into the sun's map.
import { buildPerson, Person } from '../../people';
import type { Frame } from '../../engine/frame';
import type { WalkGrid } from '../../engine/walkgrid';
import type { P2 } from '../../engine/venue-def';
import { ClipLayer } from '../../engine/sim/clips';
import { staffOptions } from './crew';

const FLOOR = 0.15;
/** where the house player waits between games: by the darts, facing the room */
export const HOUSE_HOME: P2 = [12.35, 12.4];
export const HOUSE_NAME = 'Rocío';

export class HousePlayer {
  role = 'house' as const;
  p: Person; x: number; z: number; y = FLOOR; heading: number; moving = false; carry: string | null = null;
  private path: P2[] | null = null; private pi = 0; private speed = 1.3; private faceYaw: number | null = null;
  /** the walk's goal, and a callback when it's reached */
  goal: P2 | null = null; private onArrive: (() => void) | null = null;
  constructor(private F: Frame, private grid: WalkGrid, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4313) {
    this.p = buildPerson({ ...staffOptions(seed, true), quality, lod: 1 });
    this.p.group.name = 'staff-house'; this.p.group.userData.group = 'staff';
    [this.x, this.z] = F.fromFrame(HOUSE_HOME[0], HOUSE_HOME[1]);
    this.heading = F.yawFromFrame(0, -1);
  }
  /** walk to a local point on the grid (a straight step when it's close or there's no path), then face `yaw` */
  walkTo(t: P2, yaw: number | null, done?: () => void) {
    this.goal = t; this.faceYaw = yaw; this.onArrive = done ?? null;
    if (Math.hypot(t[0] - this.x, t[1] - this.z) < 0.6) { this.path = [t]; this.pi = 0; return; }
    const p = this.grid.path(this.x, this.z, t[0], t[1]);
    this.path = p && p.length ? [...p, t] : [t]; this.pi = 0;
  }
  /** stand at a point now (a scripted game's own placing, a test) */
  place(t: P2, yaw: number) { this.x = t[0]; this.z = t[1]; this.heading = yaw; this.path = null; this.goal = null; this.faceYaw = null; const cb = this.onArrive; this.onArrive = null; cb?.(); }
  get walking() { return !!this.path; }
  home() { this.walkTo(this.F.fromFrame(HOUSE_HOME[0], HOUSE_HOME[1]), this.F.yawFromFrame(0, -1)); }
  update(dt: number) {
    this.moving = false;
    if (this.path) {
      const tgt = this.path[this.pi], dx = tgt[0] - this.x, dz = tgt[1] - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) {
        this.x = tgt[0]; this.z = tgt[1]; this.pi++;
        if (this.pi >= this.path.length) { this.path = null; this.goal = null; if (this.faceYaw !== null) this.heading = this.faceYaw; const cb = this.onArrive; this.onArrive = null; cb?.(); }
      } else { this.x += (dx / d) * step; this.z += (dz / d) * step; this.heading = Math.atan2(dx, dz); this.moving = true; }
    }
    this.p.play(this.moving ? 'walk' : 'idle');
    if (this.moving && this.clips.playing(this.p)) this.clips.stop(this.p);
    this.y = FLOOR + Math.max(0, this.grid.height(this.x, this.z) - FLOOR);
    this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading;
    this.p.update(dt * (this.moving ? 1.05 : 1)); this.clips.apply(this.p, dt);
  }
}
