// bench.js — B3's motion for "the Bench" (films/channels/physics/set): closed-form falls, level throws and
// bounce series, in centimetres and seconds of scene time τ. No simulation, no air (every episode that
// uses it badges "air ignored" with the size of the error it leaves out). Plain ES module, no imports, so
// compile.py's numbers can be checked against it in Node.
//
//   ballAt(τ, { x0, z0, vx, drop, r, e })  centre of a ball released at τ = 0 with its bottom `drop` cm above
//                                         the floor, moving sideways at vx cm/s; before τ = 0 it rests at
//                                         the release point; it lands at τ = landTime(drop) and bounces with
//                                         restitution e (each bounce e times the speed), then rests.
//   landTime(drop)                       √(2·drop/g): 0.4515 s for the bench's 100 cm
//   bounces(drop, e, n)                  the τ of the first n floor contacts
//   velAt(τ, b)                          [vx, vy, 0] (cm/s) while in the air, [0, 0, 0] at rest
export const G = 981;                     // cm/s² (OpenStax 3.5: g = 9.81 m/s²)
export const R_BALL = 3.35;               // a tennis ball, 6.7 cm across
export const DROP = 100;                  // the rail: the ball's bottom starts 100 cm above the floor
export const E_REST = 0.75;               // a tennis ball's bounce (not claimed on screen)

export const landTime = (drop = DROP) => Math.sqrt((2 * drop) / G);

export const bounces = (drop = DROP, e = E_REST, n = 6) => {
  const out = [landTime(drop)];
  let v = G * out[0];
  for (let k = 1; k < n; k++) { v *= e; out.push(out[k - 1] + (2 * v) / G); }
  return out;
};

export const ballAt = (tau, b = {}) => {
  const drop = b.drop ?? DROP, r = b.r ?? R_BALL, e = b.e ?? E_REST, x0 = b.x0 ?? 0, z0 = b.z0 ?? 0, vx = b.vx ?? 0;
  const y0 = drop + r;
  if (tau <= 0) return [x0, y0, z0];
  const T = landTime(drop);
  const x = x0 + vx * tau;                // air ignored: the sideways speed never changes (it slides on after landing too)
  if (tau <= T) return [x, y0 - 0.5 * G * tau * tau, z0];
  let t0 = T, v = G * T * e;
  for (let k = 0; k < 12; k++) {
    const fl = (2 * v) / G;
    if (tau <= t0 + fl) { const s = tau - t0; return [x, r + v * s - 0.5 * G * s * s, z0]; }
    t0 += fl; v *= e;
  }
  return [x, r, z0];
};

export const velAt = (tau, b = {}) => {
  const drop = b.drop ?? DROP, e = b.e ?? E_REST, vx = b.vx ?? 0;
  if (tau <= 0) return [0, 0, 0];
  const T = landTime(drop);
  if (tau <= T) return [vx, -G * tau, 0];
  let t0 = T, v = G * T * e;
  for (let k = 0; k < 12; k++) {
    const fl = (2 * v) / G;
    if (tau <= t0 + fl) return [vx, v - G * (tau - t0), 0];
    t0 += fl; v *= e;
  }
  return [0, 0, 0];
};
