/**
 * Numerical building blocks for the Beta-Binomial forecast. Pure, dependency-free, deterministic.
 *
 * - `logGamma` uses the Lanczos approximation (g = 7, 9 terms), accurate to roughly 1e-15 relative
 *   for x > 0, which is far more than the forecast needs.
 * - `regIncBeta` is the regularized incomplete beta function I_x(a, b) (the Beta CDF), evaluated with
 *   the modified Lentz continued fraction, using the symmetry I_x(a, b) = 1 - I_{1-x}(b, a) where the
 *   fraction converges faster.
 * - `betaQuantile` inverts the CDF by bisection: slower than Newton but it cannot diverge, and 200
 *   halvings of [0, 1] reach machine precision.
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
] as const;

const HALF_LOG_2PI = 0.5 * Math.log(2 * Math.PI);

/** ln Γ(x) for x > 0 (reflection formula below 0.5). */
export function logGamma(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN;
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  let sum: number = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i]! / (z + i);
  const t = z + 7.5;
  return HALF_LOG_2PI + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** ln B(a, b) = ln Γ(a) + ln Γ(b) − ln Γ(a + b). */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** ln C(n, k) for real n ≥ k ≥ 0. */
export function logChoose(n: number, k: number): number {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

const CF_EPS = 1e-15;
const CF_TINY = 1e-300;
const CF_MAX_ITER = 20_000;

/** Continued fraction for the incomplete beta (Numerical Recipes `betacf`, modified Lentz). */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < CF_TINY) d = CF_TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= CF_MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < CF_TINY) d = CF_TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < CF_TINY) c = CF_TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < CF_TINY) d = CF_TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < CF_TINY) c = CF_TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < CF_EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b) = P(X ≤ x) for X ~ Beta(a, b). */
export function regIncBeta(x: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0) || Number.isNaN(x)) return Number.NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = a * Math.log(x) + b * Math.log1p(-x) - logBeta(a, b);
  if (x < (a + 1) / (a + b + 2)) return (Math.exp(lnFront) * betaContinuedFraction(x, a, b)) / a;
  return 1 - (Math.exp(lnFront) * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Beta CDF (alias with argument order matching the distribution). */
export function betaCdf(x: number, a: number, b: number): number {
  return regIncBeta(x, a, b);
}

/** The q-quantile of Beta(a, b) by bisection. q is clamped to [0, 1]. */
export function betaQuantile(q: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0) || Number.isNaN(q)) return Number.NaN;
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    if (regIncBeta(mid, a, b) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Mean of Beta(a, b). */
export function betaMean(a: number, b: number): number {
  return a / (a + b);
}

/** Equal-tailed credible interval of Beta(a, b) with the given central mass (e.g. 0.95). */
export function betaInterval(a: number, b: number, mass = 0.95): { low: number; high: number } {
  const tail = (1 - mass) / 2;
  return { low: betaQuantile(tail, a, b), high: betaQuantile(1 - tail, a, b) };
}

/**
 * Posterior predictive probability of at least one success in the next `m` trials when the
 * per-trial probability p ~ Beta(a, b) and the trials are exchangeable given p:
 * P(≥1) = 1 − E[(1 − p)^m] = 1 − B(a, b + m) / B(a, b).
 */
export function probAtLeastOne(a: number, b: number, m: number): number {
  if (!(m > 0)) return 0;
  const p = 1 - Math.exp(logBeta(a, b + m) - logBeta(a, b));
  return Math.min(1, Math.max(0, p));
}

/** P(≥1 success in m independent trials) for a known, fixed per-trial probability p. */
export function probAtLeastOneFixed(p: number, m: number): number {
  if (!(m > 0) || !(p > 0)) return 0;
  if (p >= 1) return 1;
  return 1 - Math.exp(m * Math.log1p(-p));
}

/** Beta-binomial pmf: P(K = k) for K | p ~ Binomial(n, p), p ~ Beta(a, b). */
export function betaBinomialPmf(k: number, n: number, a: number, b: number): number {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || k > n) return 0;
  return Math.exp(logChoose(n, k) + logBeta(k + a, n - k + b) - logBeta(a, b));
}

/** Smallest k with P(K ≤ k) ≥ q for the beta-binomial (n, a, b). */
export function betaBinomialQuantile(q: number, n: number, a: number, b: number): number {
  let cdf = 0;
  for (let k = 0; k <= n; k++) {
    cdf += betaBinomialPmf(k, n, a, b);
    if (cdf >= q - 1e-12) return k;
  }
  return n;
}
