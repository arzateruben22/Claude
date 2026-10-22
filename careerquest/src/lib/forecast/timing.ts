/**
 * Time-to-response summaries from observed data only: median and interquartile range of the days
 * between applying and the employer's first response. Applications still waiting are counted but
 * cannot contribute a duration (they are right-censored), so the observed median is biased short;
 * the UI says so.
 */

/** Sample quantile with linear interpolation (Hyndman & Fan type 7, the R / NumPy default). */
export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0 || !Number.isFinite(q)) return null;
  const p = Math.min(1, Math.max(0, q));
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export type TimingSummary = {
  /** Applications with both an application date and a first-response date. */
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  /** Applied applications with no recorded response yet (censored observations). */
  awaiting: number;
};

/** Below this many durations the IQR is not shown (a quartile of 3 values is not meaningful). */
export const MIN_TIMING_N_FOR_IQR = 4;

export function summarizeTiming(days: number[], awaiting: number): TimingSummary {
  const xs = days.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  const showIqr = xs.length >= MIN_TIMING_N_FOR_IQR;
  return {
    n: xs.length,
    median: quantile(xs, 0.5),
    q1: showIqr ? quantile(xs, 0.25) : null,
    q3: showIqr ? quantile(xs, 0.75) : null,
    awaiting: Math.max(0, Math.floor(awaiting)),
  };
}
