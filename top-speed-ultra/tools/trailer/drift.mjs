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
    // the slip angle's sign, measured (drift-search, 2026-11-25): a flick to the left (steer +) gives a negative angle,
    // so a slide toward dir reads -dir x angle, and more steer toward dir makes the angle more negative. (The first
    // version assumed the opposite: its hold steered into the spin, and every bold drift spun past 55 deg.)
    const SGN = -1, err = SGN * P.dir * P.angle - a;           // + : the angle must rise (toward +)
    // throttle holds the slide (with traction control off it is what keeps a rear-drive car rotating): lifted as the
    // angle passes its target, so the slide settles instead of spinning (Handling at Simulation, 2026-11-25: at a
    // steady 0.7 the Corsa rotated on past 80 deg whatever the lock)
    const over = Math.abs(a) - P.angle;
    c.handbrake = false; c.brake = 0; c.throttle = cl(P.thr * (1 - over / (P.lift ?? 12)), 0, 1);
    c.steer = cl(-P.dir * P.counter + SGN * P.k * err / 30, -1, 1);
    return true;
  }
  c.handbrake = false;
  return false;
}`;
