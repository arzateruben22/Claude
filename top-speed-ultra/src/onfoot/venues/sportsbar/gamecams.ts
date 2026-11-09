// The game cameras (PROJECT_OC_SPORTS_BAR.md, "Camera": "Game cameras"): on your turn in pool, darts or shuffleboard
// the camera moves to the game's own view (above the table, behind the oche, behind the puck) and returns to your own
// view afterwards. The move takes 0.5 s, or it's a cut with reduced motion. The page places its camera for your view
// as usual (Lot 57's player camera, or the overhead), then `apply` blends from that pose to the game's: so the way
// back always lands on your view as it is that frame. Nothing here is drawn.
import * as THREE from 'three';

export type CamMode = 'pool' | 'darts' | 'shuffleboard';
export interface CamPose { eye: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3; fov: number }
const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const MOVE_S = 0.5;

export class GameCams {
  /** the game whose view is wanted (your turn), or null to be back in your own view */
  mode: CamMode | null = null;
  /** the game whose pose is blended in (kept through the move back, so the page knows whose view is showing) */
  shown: CamMode | null = null;
  /** 0 your own view, 1 the game's */
  blend = 0;
  reduced = false;
  pose: CamPose = { eye: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 60 };
  /** counts for the check: moves into a game view, returns, and how many of them were cuts */
  stats = { enters: 0, returns: 0, cuts: 0, lastEnterFrames: 0, lastReturnFrames: 0 };
  private framesInMove = 0; private dir: 0 | 1 | -1 = 0;
  private qa = new THREE.Quaternion(); private qb = new THREE.Quaternion(); private m = new THREE.Matrix4(); private v = new THREE.Vector3();
  /** move to a game's view */
  enter(mode: CamMode, pose: CamPose) {
    this.pose.eye.copy(pose.eye); this.pose.target.copy(pose.target); this.pose.up.copy(pose.up); this.pose.fov = pose.fov;
    if (this.mode === mode && this.dir >= 0) return;
    this.mode = mode; this.shown = mode; this.stats.enters++; this.framesInMove = 0; this.dir = 1;
    if (this.reduced) { this.blend = 1; this.stats.cuts++; this.dir = 0; this.stats.lastEnterFrames = 0; }
  }
  /** update the game view's pose while it's on (the cue ball moved, the aim changed) */
  retarget(pose: CamPose) { this.pose.eye.copy(pose.eye); this.pose.target.copy(pose.target); this.pose.up.copy(pose.up); this.pose.fov = pose.fov; }
  /** back to your own view */
  exit() {
    if (this.mode === null) return;
    this.mode = null; this.stats.returns++; this.framesInMove = 0; this.dir = -1;
    if (this.reduced) { this.blend = 0; this.stats.cuts++; this.dir = 0; this.stats.lastReturnFrames = 0; }
  }
  get on() { return this.blend > 0; }
  /** after the page has placed the camera for your own view: blend toward the game's view; true while any of it shows */
  apply(cam: THREE.PerspectiveCamera, dt: number): boolean {
    if (this.dir !== 0) {
      this.framesInMove++;
      this.blend = Math.min(1, Math.max(0, this.blend + (this.dir * dt) / MOVE_S));
      if (this.dir > 0 && this.blend >= 1) { this.dir = 0; this.stats.lastEnterFrames = this.framesInMove; }
      if (this.dir < 0 && this.blend <= 0) { this.dir = 0; this.stats.lastReturnFrames = this.framesInMove; }
    }
    if (this.blend <= 0) return false;
    const k = smooth(this.blend), P = this.pose;
    // the game's orientation, from its eye, target and up (a camera looks down its -z)
    this.qb.setFromRotationMatrix(this.m.lookAt(P.eye, P.target, P.up));
    this.qa.copy(cam.quaternion);
    cam.position.lerp(P.eye, k);
    cam.quaternion.copy(this.qa).slerp(this.qb, k);
    const fov = cam.fov + (P.fov - cam.fov) * k;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // the world matrix follows now (Lot 57's camera left it at your eye), so anything projected this frame (the dart's
    // aim, the taps, the visibility rule) sees the game's view
    cam.updateMatrixWorld();
    void this.v;
    return true;
  }
  report() { return { mode: this.mode, shown: this.blend > 0 ? this.shown : null, blend: +this.blend.toFixed(3), moving: this.dir, reduced: this.reduced, ...this.stats }; }
}

/** the pool table's view: straight down over the bed, under the lamp, its long side across a landscape screen (along
 *  a portrait one); the height and the field of view fit the table and its rails */
export function poolPose(centre: THREE.Vector3, along: THREE.Vector3, across: THREE.Vector3, aspect: number, out: CamPose): CamPose {
  const Lh = 1.26, Sh = 0.74, landscape = aspect >= 1;
  // the half extents on screen: horizontal and vertical
  const hx = landscape ? Lh : Sh, hy = landscape ? Sh : Lh;
  let fov = 70, tv = Math.tan((fov * Math.PI) / 360);
  let d = Math.max(hy / tv, hx / (tv * aspect));
  const maxD = 1.08;                                           // the camera stays under the lamp's shade (2.06 m)
  if (d > maxD) { d = maxD; tv = Math.max(hy / d, hx / (d * aspect)); fov = Math.min(100, (Math.atan(tv) * 360) / Math.PI); }
  out.eye.copy(centre).setY(centre.y + d);
  out.target.copy(centre);
  out.up.copy(landscape ? across : along);
  out.fov = fov;
  return out;
}
