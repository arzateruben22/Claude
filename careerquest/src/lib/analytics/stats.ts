/**
 * Dependency-free statistics helpers used by analytics. Pure functions only.
 *
 * Rates on this page are *observed* proportions (successes / n). The Wilson score interval is the
 * estimate of where the true rate plausibly lies given that sample; it is wide for small n, which
 * is exactly the honest signal the UI should show instead of a confident-looking percentage.
 */

export type Interval = { low: number; high: number };

/** Below this many trials a rate is flagged as low-sample: the interval is too wide to act on. */
export const LOW_SAMPLE_N = 10;

/** z for a two-sided 95% interval. */
export const Z_95 = 1.96;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Wilson score interval for a binomial proportion. Returns null when n <= 0 (no data, no interval).
 * Unlike the normal approximation it never produces bounds outside [0, 1] and behaves sensibly
 * at 0/n and n/n.
 */
export function wilsonInterval(successes: number, n: number, z = Z_95): Interval | null {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0) return null;
  const k = Math.min(Math.max(0, successes), n);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: clamp01(center - half), high: clamp01(center + half) };
}

export type RateEstimate = {
  /** Observed proportion, or null when n = 0. */
  value: number | null;
  successes: number;
  n: number;
  /** 95% Wilson interval, or null when n = 0. */
  interval: Interval | null;
  /** True when n < LOW_SAMPLE_N — the UI must say the rate is not reliable yet. */
  lowSample: boolean;
};

export function rateEstimate(successes: number, n: number, z = Z_95): RateEstimate {
  const safeN = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const k = Math.min(Math.max(0, Math.floor(successes) || 0), safeN);
  return {
    value: safeN > 0 ? k / safeN : null,
    successes: k,
    n: safeN,
    interval: wilsonInterval(k, safeN, z),
    lowSample: safeN < LOW_SAMPLE_N,
  };
}

export function mean(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}
