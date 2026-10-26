// swing.js — B6 Oscillators for "the Bench" (films/channels/physics/set): the exact simple pendulum, in closed
// form, in centimetres and seconds of scene time τ. No small-angle approximation: the angle comes from Jacobi's
// elliptic functions, so a 30° swing really runs 1.74% slower than 2π√(L/g) on screen. No air, no friction
// (every episode that uses it badges that). Plain ES module, no imports, so an episode's compile.py port can be
// checked against it in Node. Also a mass on a spring (exact SHM), for later episodes.
//
//   periodRatio(θ0)                       T(θ0) / (2π√(L/g)) = 2K(sin(θ0/2))/π: 1.00191 at 10°, 1.01741 at 30°
//   period(L, θ0, g)                      the exact period (s): 2.0000 s × ratio for the 99.4 cm seconds pendulum
//   pendulum({ L, theta0, g, pivot })     → { theta(τ), omega(τ), pos(τ), vel(τ), T, quarter }
//                                         released from rest at angle theta0 (radians, + is toward +x) at τ = 0;
//                                         before τ = 0 it is held there. pos is the bob's centre [x, y, z]
//   spring({ k, m, x0, rest })            → { x(τ), v(τ), T } released from rest at x0 from the rest point
//   ellipj(u, m)                          [sn, cn, dn] (parameter m = k²), the AGM method (Abramowitz & Stegun 16.4)
//   ellipK(m)                             the complete elliptic integral of the first kind, K(m) = π / (2·AGM(1, √(1−m)))
//
// The motion: with k = sin(θ0/2), ω0 = √(g/L) and K = K(k²), a pendulum released from rest at θ0 has
//   sin(θ/2) = k · sn(K − ω0 τ, k²)   and   θ' = −2kω0 · cn(K − ω0 τ, k²)
// (period 4K/ω0). For θ0 → 0 this is θ0·cos(ω0 τ).
export const G = 981;                      // cm/s² (OpenStax 3.5: g = 9.81 m/s²)
export const SECONDS_L = 99.4;             // the seconds pendulum, g/π² = 99.40 cm: one second each swing

const agm = (a, b) => { for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)]; return (a + b) / 2; };
export const ellipK = (m) => Math.PI / (2 * agm(1, Math.sqrt(1 - m)));

export const ellipj = (u, m) => {
  if (m < 1e-14) return [Math.sin(u), Math.cos(u), 1];
  const a = [1], c = [Math.sqrt(m)];
  let b = Math.sqrt(1 - m), n = 0;
  while (Math.abs(c[n]) > 1e-15 && n < 30) {
    const an = (a[n] + b) / 2, cn = (a[n] - b) / 2;
    b = Math.sqrt(a[n] * b); n++; a.push(an); c.push(cn);
  }
  let phi = 2 ** n * a[n] * u;
  for (let j = n; j > 0; j--) phi = (Math.asin((c[j] / a[j]) * Math.sin(phi)) + phi) / 2;
  const sn = Math.sin(phi), cn = Math.cos(phi);
  return [sn, cn, Math.sqrt(1 - m * sn * sn)];
};

export const periodRatio = (theta0) => { const k = Math.sin(Math.abs(theta0) / 2); return (2 * ellipK(k * k)) / Math.PI; };
export const period = (L = SECONDS_L, theta0 = 0, g = G) => 2 * Math.PI * Math.sqrt(L / g) * periodRatio(theta0);

export const pendulum = ({ L = SECONDS_L, theta0 = 0, g = G, pivot = [0, 0, 0] } = {}) => {
  const s = Math.sign(theta0) || 1, k = Math.sin(Math.abs(theta0) / 2), m = k * k, w0 = Math.sqrt(g / L), K = ellipK(m);
  const T = (4 * K) / w0;
  const theta = (tau) => {
    if (tau <= 0 || k === 0) return theta0;
    const [sn] = ellipj(K - w0 * tau, m);
    return s * 2 * Math.asin(Math.max(-1, Math.min(1, k * sn)));
  };
  const omega = (tau) => {
    if (tau <= 0 || k === 0) return 0;
    const [, cn] = ellipj(K - w0 * tau, m);
    return -s * 2 * k * w0 * cn;
  };
  const pos = (tau) => { const a = theta(tau); return [pivot[0] + L * Math.sin(a), pivot[1] - L * Math.cos(a), pivot[2]]; };
  const vel = (tau) => { const a = theta(tau), w = omega(tau); return [L * Math.cos(a) * w, L * Math.sin(a) * w, 0]; };
  return { theta, omega, pos, vel, T, quarter: T / 4, L, theta0, pivot };
};

export const spring = ({ k = 10, m = 1, x0 = 10, rest = 0 } = {}) => {
  const w = Math.sqrt(k / m);
  return { x: (tau) => rest + x0 * Math.cos(w * Math.max(0, tau)), v: (tau) => (tau <= 0 ? 0 : -x0 * w * Math.sin(w * tau)), T: (2 * Math.PI) / w };
};
