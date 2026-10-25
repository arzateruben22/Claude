// spin.js — a turning body whose moment of inertia changes (films/channels/physics/set): the swivel chair of episode 5,
// any spin that conserves angular momentum. SI units (kg, m, s, rad). Plain ES module, no imports; ported in
// bench_py.py (Spinner) and checked against it in Node.
//
//   const S = spinner({ I0: 2.0, m: 2, mArm: 3.5, rS: 0.19, rOut: 0.8, rIn: 0.2, w0: Math.PI, pull: [t0, t1] });
//   S.r(τ)      the weights' distance from the axis: rOut until t0, a smoothstep to rIn by t1, then rIn
//   S.I(τ)      I0 + 2 m r² + 2 · mArm (rS² + rS r + r²)/3 (each arm a rod from the shoulder to the hand)
//   S.omega(τ)  L / I(τ), with L = I(0)·w0 (no outside torque: friction ignored)
//   S.phi(τ)    the turned angle: closed form outside the pull, a fine Simpson table inside it (built once, pure)
//   S.ratio     ω after / ω before = I_out / I_in
export const spinner = ({ I0 = 2.0, m = 2, mArm = 0, rS = 0.19, rOut = 0.8, rIn = 0.2, w0 = Math.PI, pull = [1, 1.6], N = 600 } = {}) => {
  const [t0, t1] = pull, d = t1 - t0;
  const r = (tau) => { if (tau <= t0) return rOut; if (tau >= t1) return rIn; const u = (tau - t0) / d, s = u * u * (3 - 2 * u); return rOut + (rIn - rOut) * s; };
  // each arm: a uniform rod from the shoulder (rS from the axis) to the hand (r): m(rS² + rS·r + r²)/3
  const Ir = (x) => I0 + 2 * m * x * x + (2 * mArm * (rS * rS + rS * x + x * x)) / 3;
  const I = (tau) => Ir(r(tau));
  const L = Ir(rOut) * w0;
  const omega = (tau) => L / I(tau);
  // the angle turned during the pull, tabulated by Simpson's rule on a fine grid (N steps over the pull)
  const tab = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const a = t0 + (d * (i - 1)) / N, b = t0 + (d * i) / N;
    tab[i] = tab[i - 1] + ((b - a) / 6) * (omega(a) + 4 * omega((a + b) / 2) + omega(b));
  }
  const phiPull = (tau) => {
    const x = ((tau - t0) / d) * N, i = Math.min(N - 1, Math.floor(x)), f = x - i;
    const a = t0 + (d * i) / N, h = (tau - a);                     // exact Simpson from the grid point to τ
    return tab[i] + (h / 6) * (omega(a) + 4 * omega(a + h / 2) + omega(tau)) + 0 * f;
  };
  const phi = (tau) => {
    if (tau <= 0) return 0;
    if (tau <= t0) return w0 * tau;
    if (tau <= t1) return w0 * t0 + phiPull(tau);
    return w0 * t0 + tab[N] + omega(t1) * (tau - t1);
  };
  return { r, I, omega, phi, L, ratio: Ir(rOut) / Ir(rIn) };
};
