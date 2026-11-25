// S5's drift, as a controller the page runs once per recorded frame (1/30 s), shared by the search (drift-search.mjs)
// and the capture (capture.mjs). Inputs only: the game's own physics does the sliding.
//   t  seconds since recording began
//   g  window.__game, c its controls (steer + = left, throttle, brake 0..1, handbrake)
//   P  the drift: dir (+1 left, -1 right), at (s), flick (s) with steer and thrFlick, then hold (s) at a target body
//      slip angle (deg) with opposite lock `counter`, gain k and throttle thr; after that the autopilot takes it back
// Returns true when it set the controls (false: the autopilot drives this frame).
export const DRIFT_SRC = `(t, g, c, P) => {
  const p = g.phys, a = p.drift.angle, cl = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  if (t < P.at) return false;
  const u = t - P.at;
  if (u < P.flick) { c.steer = P.dir * P.steer; c.handbrake = true; c.throttle = P.thrFlick; c.brake = 0; return true; }
  if (u < P.flick + P.hold) {
    const err = P.dir * P.angle - a;                       // + : the slide wants more angle toward dir
    c.handbrake = false; c.brake = 0; c.throttle = P.thr;
    c.steer = cl(-P.dir * P.counter + P.k * err / 30, -1, 1);
    return true;
  }
  c.handbrake = false;
  return false;
}`;
