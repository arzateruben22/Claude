// You, on foot in the bar (the module map's player.ts row): Lot 57's Player, unchanged, with two members overridden.
//   indoors: inside the unit by the venue's own predicate (walking only inside, as at Lot 57's Shed);
//   camera:  Lot 57's camera, then, indoors in third person, pulled toward the head along the same line until it's at
//            most 3.3 m above the floor (0.3 m under the 3.6 m ceiling), keeping Lot 57's look target; and (2026-11-16,
//            the owner's "the bar exit goes to the parking lot accurately and seamlessly") the third-person camera's
//            distance from your head eased back out after a wall pulled it in (it pulls in at once, so it never shows
//            the inside of a wall, and lets out over about half a second), so the doorway's jambs don't pop it.
import type * as THREE from 'three';
import { Player } from '../../engine/player';
import { isTall, type ColliderSet, type Collider } from '../../engine/collide';
/** near a doorway: a tall collider that isn't glass, the doorway, a pole or a trunk (the camera may glide through those for a moment, never through a wall) */
const solidTall = (c: Collider) => c.tall && c.tag !== 'glass' && c.tag !== 'door' && c.tag !== 'pole' && c.tag !== 'tree';
/** a tall collider that isn't a pole or a trunk (away from the doorways, glass is a wall to the camera) */
const wallTall = (c: Collider) => c.tall && c.tag !== 'pole' && c.tag !== 'tree';
import type { WalkGrid } from '../../engine/walkgrid';
import type { Frame } from '../../engine/frame';
import type { VenueDef } from '../../engine/venue-def';
import { pointInPoly } from '../../engine/geom';

export class BarPlayer extends Player {
  private def: VenueDef; private frame: Frame;
  private cset: ColliderSet;
  constructor(set: ColliderSet, grid: WalkGrid, roadAt: (x: number, z: number) => boolean, def: VenueDef, frame: Frame) {
    super(set, grid, roadAt);
    this.cset = set;
    this.def = def; this.frame = frame;
  }
  /** roofs outside (frame rings) and the height the third-person camera stays under beneath them */
  canopies: { poly: [number, number][]; capY: number }[] = [];
  /** the frame's time step for the camera's easing (the page sets it before each camera() call) */
  camDt = 1 / 60;
  /** the eased distance from your head to the third-person camera (-1: not yet placed) */
  private camEase = -1;
  /** forget the eased distance (a jump, a seat, a view change) */
  resetCamEase() { this.camEase = -1; this.camSide = 1; }
  /** the third-person camera's shoulder: 1 right (Lot 57's), -1 left, eased between */
  private camSide = 1;
  /** the doorways (local x, z) near which the glass round them pulls the camera in eased */
  doorways: [number, number][] = [];
  override get indoors() { const [u, v] = this.frame.toFrame(this.x, this.z); return this.def.indoor(u, v); }
  override camera(cam: THREE.PerspectiveCamera) {
    if (this.view !== 'third' || this.seat) { this.camEase = -1; return this.capped(cam); }
    const out = super.camera(cam);
    // third person, standing: Lot 57's orbit, pulled in by the walls as Lot 57 does, with three changes so walking out
    // of the door and along the front doesn't pop the camera (the owner's seamless exit): the camera's shoulder swaps
    // sides (over about a third of a second) when the side it's on is walled in and the other isn't; within 2 m of a
    // doorway the glass round it (the door's own frames) pulls the camera in over about a fifth of a second instead of
    // at once; and it lets back out over a quarter of a second. Anything else solid pulls it in at once, so it never
    // shows the inside of a wall
    const hx = this.x, hy = this.y + this.eye, hz = this.z, dt = Math.min(0.1, this.camDt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const back = 2.4, up = 1.75 - this.eye, oy = up - back * sp;
    let nearDoor = false; for (const d of this.doorways) if (Math.hypot(d[0] - hx, d[1] - hz) < 2.0) { nearDoor = true; break; }
    const hard = nearDoor ? solidTall : wallTall;
    const keepAt = (side: number, only: (c: Collider) => boolean) => {
      const ox = -fx * back * cp + rx * 0.45 * side, oz = -fz * back * cp + rz * 0.45 * side, len = Math.hypot(ox, oz), t = this.cset.ray(hx, hz, hx + ox, hz + oz, only);
      return t < 1 ? Math.max(0.25, (t * len - 0.25) / len) : 1;
    };
    const kR = keepAt(1, isTall), kL = keepAt(-1, isTall);
    const wantSide = kL > kR + 0.15 ? -1 : kR > kL + 0.15 ? 1 : this.camSide >= 0 ? 1 : -1;
    this.camSide += (wantSide - this.camSide) * (1 - Math.exp(-dt * 3));
    const side = this.camSide;
    const ox = -fx * back * cp + rx * 0.45 * side, oz = -fz * back * cp + rz * 0.45 * side;
    const want = keepAt(side, isTall), solid = keepAt(side, hard);
    if (this.camEase < 0) this.camEase = want;
    else this.camEase += (want - this.camEase) * (1 - Math.exp(-dt * (want < this.camEase ? 5 : 4)));
    const keep = Math.min(this.camEase, solid);
    this.camEase = keep;
    cam.position.set(hx + ox * keep, Math.max(0.35, hy + oy * (0.4 + 0.6 * keep)), hz + oz * keep);
    cam.lookAt(hx + fx * 4 * cp, hy - 0.35 + sp * 4, hz + fz * 4 * cp);
    const dist = Math.hypot(cam.position.x - this.x, cam.position.z - this.z);
    out.dist = dist; out.hide = dist < 0.7;
    return this.applyCap(cam, out);
  }
  private capped(cam: THREE.PerspectiveCamera) { return this.applyCap(cam, super.camera(cam)); }
  /** under the ceiling inside, and under the patio's ceiling and the front's awning outside, the third-person camera
   *  slides toward the head until it's under the cap */
  private applyCap(cam: THREE.PerspectiveCamera, out: { dist: number; hide: boolean }) {
    if (this.view !== 'third') return out;
    const [u, v] = this.frame.toFrame(cam.position.x, cam.position.z);
    let cap = Infinity;
    if (this.def.indoor(u, v) || this.indoors) cap = (this.def.ceilingM ?? 3.6) - 0.3;
    // (Vega & Vinnie's) the roofs outside: the patio's ceiling and the front's awning, the same rule under each
    if (this.canopies.length) { const [pu, pv] = this.frame.toFrame(this.x, this.z); for (const c of this.canopies) if (pointInPoly(u, v, c.poly) || pointInPoly(pu, pv, c.poly)) cap = Math.min(cap, c.capY); }
    if (cam.position.y <= cap) return out;
    // the head (Lot 57's orbit centre) and the camera: slide the camera toward the head until it's under the cap
    const hy = this.y + (this.seat ? this.seat.y + 0.62 : this.eye);
    const k = cam.position.y - hy > 1e-6 ? Math.max(0, (cap - hy) / (cam.position.y - hy)) : 0;
    // the look target stays: three.js keeps the camera's orientation, so re-aim at Lot 57's target
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const tx = this.x + fx * 4 * cp, ty = hy - 0.35 + sp * 4, tz = this.z + fz * 4 * cp;
    cam.position.set(this.x + (cam.position.x - this.x) * k, hy + (cam.position.y - hy) * k, this.z + (cam.position.z - this.z) * k);
    cam.lookAt(tx, ty, tz);
    const dist = Math.hypot(cam.position.x - this.x, cam.position.z - this.z);
    out.dist = dist; out.hide = dist < 0.7;
    return out;
  }
}
