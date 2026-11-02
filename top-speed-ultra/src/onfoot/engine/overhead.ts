// The overhead build view (PROJECT_OC_SPORTS_BAR.md, "Camera"): the classic life-sim camera, written by the bar so
// Lot 57's camera code isn't edited. It looks down at 55 degrees (35 to 75) from 8 to 35 m away, rotates freely or in
// 45 degree steps, pans and pinch-zooms, and is clamped to a box (the bar, the patio and the lot). The page calls
// update(camera) in place of the player's camera while this view is on; the wall cutaway is the page's (it knows the
// walls), from facing().
import * as THREE from 'three';

export class OverheadCamera {
  target = new THREE.Vector3();
  yaw = 0;                         // the direction the camera looks along, round y (Lot 57's convention: atan2(dx, dz))
  pitch = (55 * Math.PI) / 180;    // down from the horizontal
  dist = 22;
  minPitch = (35 * Math.PI) / 180; maxPitch = (75 * Math.PI) / 180;
  minDist = 8; maxDist = 35;
  /** the clamp box for the target (local x, z) */
  box = { x0: -Infinity, x1: Infinity, z0: -Infinity, z1: Infinity };
  /** a 0.5 s move toward a goal (a cut with reduced motion) */
  private goal: { yaw: number; pitch: number; dist: number; target: THREE.Vector3 } | null = null;
  reducedMotion = false;

  /** where the camera sits for the current target, yaw, pitch and distance */
  position(out = new THREE.Vector3()) {
    const c = Math.cos(this.pitch), s = Math.sin(this.pitch);
    return out.set(this.target.x - Math.sin(this.yaw) * c * this.dist, this.target.y + s * this.dist, this.target.z - Math.cos(this.yaw) * c * this.dist);
  }
  clamp() {
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist));
    this.target.x = Math.max(this.box.x0, Math.min(this.box.x1, this.target.x));
    this.target.z = Math.max(this.box.z0, Math.min(this.box.z1, this.target.z));
  }
  /** pan by a screen drag (pixels), relative to the view */
  pan(dx: number, dy: number, viewH: number) {
    // the world follows the finger: a drag right moves the target left (against the view's right, (-fz, fx)), a drag
    // down moves it forward
    const k = (this.dist * 1.1) / Math.max(1, viewH), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.target.x += (fz * dx + fx * dy) * k; this.target.z += (-fx * dx + fz * dy) * k;
    this.goal = null; this.clamp();
  }
  zoom(f: number) { this.dist *= f; this.goal = null; this.clamp(); }
  rotate(d: number) { this.yaw += d; this.goal = null; }
  /** rotate in 45 degree steps (Q and E, a two-finger twist), as a 0.5 s move */
  step(dir: 1 | -1) { const y = Math.round(this.yaw / (Math.PI / 4)) * (Math.PI / 4) + dir * (Math.PI / 4); this.moveTo({ yaw: y }); }
  moveTo(g: Partial<{ yaw: number; pitch: number; dist: number; target: THREE.Vector3 }>) {
    this.goal = { yaw: g.yaw ?? this.yaw, pitch: g.pitch ?? this.pitch, dist: g.dist ?? this.dist, target: (g.target ?? this.target).clone() };
    if (this.reducedMotion) { this.snap(); }
  }
  snap() { if (!this.goal) return; this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist; this.target.copy(this.goal.target); this.goal = null; this.clamp(); }
  update(cam: THREE.PerspectiveCamera, dt: number) {
    if (this.goal) {
      const k = Math.min(1, dt / 0.12);
      let dy = this.goal.yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * k; this.pitch += (this.goal.pitch - this.pitch) * k; this.dist += (this.goal.dist - this.dist) * k; this.target.lerp(this.goal.target, k);
      if (Math.abs(dy) < 1e-3 && Math.abs(this.goal.dist - this.dist) < 1e-2 && this.target.distanceTo(this.goal.target) < 1e-2) this.snap();
    }
    this.clamp();
    cam.position.copy(this.position(this._p));
    cam.lookAt(this.target);
  }
  private _p = new THREE.Vector3();
  /** does a wall whose outward face points along (nx, nz) from (x, z) face the camera? */
  facing(x: number, z: number, nx: number, nz: number) {
    const p = this.position(this._q);
    return (p.x - x) * nx + (p.z - z) * nz > 0;
  }
  private _q = new THREE.Vector3();
}
