// You, on foot in the bar (the module map's player.ts row): Lot 57's Player, unchanged, with two members overridden.
//   indoors: inside the unit by the venue's own predicate (walking only inside, as at Lot 57's Shed);
//   camera:  Lot 57's camera, then, indoors in third person, pulled toward the head along the same line until it's at
//            most 3.3 m above the floor (0.3 m under the 3.6 m ceiling), keeping Lot 57's look target.
import type * as THREE from 'three';
import { Player } from '../../engine/player';
import type { ColliderSet } from '../../engine/collide';
import type { WalkGrid } from '../../engine/walkgrid';
import type { Frame } from '../../engine/frame';
import type { VenueDef } from '../../engine/venue-def';

export class BarPlayer extends Player {
  private def: VenueDef; private frame: Frame;
  constructor(set: ColliderSet, grid: WalkGrid, roadAt: (x: number, z: number) => boolean, def: VenueDef, frame: Frame) {
    super(set, grid, roadAt);
    this.def = def; this.frame = frame;
  }
  override get indoors() { const [u, v] = this.frame.toFrame(this.x, this.z); return this.def.indoor(u, v); }
  override camera(cam: THREE.PerspectiveCamera) {
    const out = super.camera(cam);
    if (this.view !== 'third') return out;
    const [u, v] = this.frame.toFrame(cam.position.x, cam.position.z);
    const cap = (this.def.ceilingM ?? 3.6) - 0.3;
    if (!this.def.indoor(u, v) && !this.indoors) return out;
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
