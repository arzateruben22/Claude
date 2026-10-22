// orbit.js — B4, orbits (films/channels/space/set): a Kepler ellipse solved with a fixed 6-step Newton
// iteration (so every frame does the same work and the result is the same everywhere), and the "free"
// mode after gravity is cut: the body moves on p₀ + v₀·(τ − τ₀), a straight line (Newton's first law).
// Orbits lie in the xz plane and run counterclockwise seen from +y (north up, as the planets do).
// The drawing is front.js's ribbons (the orbit ring, the trail, the free path); this file is the motion.
//
//   const orb = orbit({ a: 15, e: 0, period: P, m0: θ0 });     // period in scene seconds; m0: mean anomaly at τ = 0
//   orb.at(tau)        → [x, 0, z]      position on the orbit
//   orb.vel(tau)       → [vx, 0, vz]    velocity (units per scene second)
//   orb.angle(tau)     → true anomaly (radians, measured from +x toward −z)
//   orb.free(tau, tauCut)   position, bound until tauCut and on its tangent line after it
//   kepler(M, e)       eccentric anomaly E for mean anomaly M (6 Newton steps)
export const kepler = (M, e) => {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
};

export const orbit = ({ a = 1, e = 0, period = 1, m0 = 0, center = [0, 0, 0] } = {}) => {
  const n = (2 * Math.PI) / period, b = a * Math.sqrt(1 - e * e);
  const ang = (tau) => {
    const E = kepler(m0 + n * tau, e);
    return Math.atan2(b * Math.sin(E), a * (Math.cos(E) - e));
  };
  const at = (tau) => {
    const E = kepler(m0 + n * tau, e);
    const x = a * (Math.cos(E) - e), y = b * Math.sin(E);   // in the orbit's plane, y toward −z (counterclockwise from +y)
    return [center[0] + x, center[1], center[2] - y];
  };
  const vel = (tau) => {
    const E = kepler(m0 + n * tau, e), dE = n / (1 - e * Math.cos(E));
    return [-a * Math.sin(E) * dE, 0, -b * Math.cos(E) * dE];
  };
  const free = (tau, tauCut) => {
    if (tau <= tauCut) return at(tau);
    const p = at(tauCut), v = vel(tauCut), dt = tau - tauCut;
    return [p[0] + v[0] * dt, p[1], p[2] + v[2] * dt];
  };
  return { at, vel, angle: ang, free, n, a, b, e };
};
