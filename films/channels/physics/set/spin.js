// spin.js — a turning body whose moment of inertia changes (films/channels/physics/set): the swivel chair of episode 5,
// any spin that conserves angular momentum. SI units (kg, m, s, rad). Plain ES module, no imports; ported in
// bench_py.py (Spinner) and checked against it in Node.
//
//   const S = spinner({ I0: 2.0, m: 2, mArm: 3.5, rS: 0.19, r0: 0.8, w0: Math.PI, moves: [[t0, t1, rTo], ...] });
//   S.r(τ)      the weights' distance from the axis: r0, then each move a smoothstep to rTo over [t0, t1]
//   S.I(τ)      I0 + 2 m r² + 2 · mArm (rS² + rS r + r²)/3 (each arm a rod from the shoulder to the hand)
//   S.omega(τ)  L / I(τ), with L = I(r0)·w0 (no outside torque: friction ignored); 0 before τ = 0 (the push)
//   S.phi(τ)    the turned angle: closed form between moves, a fine Simpson table inside each move (built once, pure)
//   S.ratio(rA, rB)  ω at rB / ω at rA = I(rA) / I(rB)
export const spinner = ({ I0 = 2.0, m = 2, mArm = 0, rS = 0.19, r0 = 0.8, w0 = Math.PI, moves = [], N = 600 } = {}) => {
  const Ir = (x) => I0 + 2 * m * x * x + (2 * mArm * (rS * rS + rS * x + x * x)) / 3;
  const L = Ir(r0) * w0;
  const mv = moves.map(([t0, t1, to], i) => ({ t0, t1, to, from: i ? moves[i - 1][2] : r0 }));
  const r = (tau) => {
    let x = r0;
    for (const q of mv) {
      if (tau <= q.t0) return x;
      if (tau < q.t1) { const u = (tau - q.t0) / (q.t1 - q.t0); return q.from + (q.to - q.from) * u * u * (3 - 2 * u); }
      x = q.to;
    }
    return x;
  };
  const omega = (tau) => (tau < 0 ? 0 : L / Ir(r(tau)));
  // phi at each move's start, and a table inside each move
  const simpson = (a, b) => ((b - a) / 6) * (omega(a) + 4 * omega((a + b) / 2) + omega(b));
  let acc = 0, last = 0;
  for (const q of mv) {
    acc += (L / Ir(q.from)) * (q.t0 - last); q.phi0 = acc;
    q.tab = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) q.tab[i] = q.tab[i - 1] + simpson(q.t0 + ((q.t1 - q.t0) * (i - 1)) / N, q.t0 + ((q.t1 - q.t0) * i) / N);
    acc += q.tab[N]; last = q.t1;
  }
  const phi = (tau) => {
    if (tau <= 0) return 0;
    let base = 0, from = 0, rr = r0;
    for (const q of mv) {
      if (tau <= q.t0) return base + (L / Ir(rr)) * (tau - from);
      if (tau < q.t1) {
        const x = ((tau - q.t0) / (q.t1 - q.t0)) * N, i = Math.min(N - 1, Math.floor(x)), a = q.t0 + ((q.t1 - q.t0) * i) / N, h = tau - a;
        return q.phi0 + q.tab[i] + (h / 6) * (omega(a) + 4 * omega(a + h / 2) + omega(tau));
      }
      base = q.phi0 + q.tab[N]; from = q.t1; rr = q.to;
    }
    return base + (L / Ir(rr)) * (tau - from);
  };
  return { r, I: (tau) => Ir(r(tau)), Ir, omega, phi, L, ratio: (a, b) => Ir(a) / Ir(b) };
};
