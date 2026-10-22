/**
 * Beta-Binomial forecast of per-application interview and offer probability from the user's own
 * history. Pure: the server loads counts (see `data.ts` / `queries.ts`), this module does the math.
 *
 * Model. Each applied application either reached an interview or did not. With a Beta(α₀, β₀) prior
 * on the per-application probability p and k interviews observed in n applications, the posterior is
 * Beta(α₀ + k, β₀ + n − k). Predictions about future applications integrate over that posterior
 * (posterior predictive), so the uncertainty about p is carried into every number we show instead
 * of plugging in a single "8 %" as if it were known.
 *
 * Priors (weakly informative, stated, not market statistics):
 *   - interviews Beta(1, 9): mean 10 %, 95 % prior interval ≈ 0.3 %–34 %. It weighs as much as 10
 *     applications, so after a few dozen real applications the user's data dominate.
 *   - offers Beta(1, 49): mean 2 %, 95 % prior interval ≈ 0.05 %–7 %. It weighs as much as 50
 *     applications: offers are rarer, so the prior is centred lower and is a little firmer to stop
 *     one lucky early offer from reading as "a 30 % offer rate".
 *
 * Non-independence. Outcomes cluster by employer (and by résumé and season). We show the naive
 * result next to a design-effect-adjusted one where the observed counts are scaled to the effective
 * sample size n_eff = n / DEFF (same observed rate, weaker evidence → wider intervals). See
 * `clustering.ts`.
 *
 * Honesty constraints built in: no dates are ever produced; thresholds are returned as ranges
 * spanning the naive and adjusted answers and rounded outward (see `format.ts`); a prior-dominated
 * result is flagged so the UI can say "mostly assumption".
 */
import { betaBinomialQuantile, betaInterval, betaMean, betaQuantile, probAtLeastOne, probAtLeastOneFixed } from "./beta";
import { DEFAULT_RHO, designEffect, type DesignEffect } from "./clustering";
import { niceRange, type NiceRange } from "./format";
import { summarizeTiming, type TimingSummary } from "./timing";

export type BetaPrior = { alpha: number; beta: number };

export const INTERVIEW_PRIOR: BetaPrior = { alpha: 1, beta: 9 };
export const OFFER_PRIOR: BetaPrior = { alpha: 1, beta: 49 };

/** Probability targets for "applications needed for P(≥1) ≥ target". */
export const TARGETS = [0.5, 0.8, 0.9] as const;

/** Credible / predictive interval masses used throughout. */
export const CREDIBLE_MASS = 0.95;
export const PREDICTIVE_MASS = 0.8;

/** Searches for "applications needed" stop here; beyond it the UI says "more than …". */
export const MAX_APPLICATIONS_SEARCH = 100_000;

/** Default look-ahead for "your next N applications" when no weekly target is known. */
export const DEFAULT_HORIZON = 25;

/** Default window (days) within which an unanswered application may still get a first response. */
export const DEFAULT_PENDING_WINDOW_DAYS = 14;

const EPS = 1e-12;

export type Interval = { low: number; high: number };

export type Posterior = {
  alpha: number;
  beta: number;
  mean: number;
  interval: Interval;
  /** Successes and trials behind the posterior (effective values for the adjusted posterior). */
  successes: number;
  n: number;
  /** Share of the posterior's total weight that comes from the prior: (α₀+β₀)/(α₀+β₀+n). */
  priorWeight: number;
};

/** Posterior Beta for k successes in n trials, optionally scaled to an effective sample size. */
export function posterior(prior: BetaPrior, successes: number, n: number, scale = 1): Posterior {
  const safeN = Math.max(0, n);
  const k = Math.min(Math.max(0, successes), safeN);
  const f = Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
  const kEff = k * f;
  const nEff = safeN * f;
  const alpha = prior.alpha + kEff;
  const beta = prior.beta + (nEff - kEff);
  const priorTotal = prior.alpha + prior.beta;
  return {
    alpha,
    beta,
    mean: betaMean(alpha, beta),
    interval: betaInterval(alpha, beta, CREDIBLE_MASS),
    successes: kEff,
    n: nEff,
    priorWeight: priorTotal / (priorTotal + nEff),
  };
}

/**
 * Smallest number of additional applications m ≥ 1 for which the posterior predictive
 * P(at least one success in m) ≥ target, or null when it exceeds MAX_APPLICATIONS_SEARCH.
 * The predictive probability is increasing in m, so an exponential then binary search is exact.
 */
export function applicationsNeeded(alpha: number, beta: number, target: number, max = MAX_APPLICATIONS_SEARCH): number | null {
  if (!(target > 0)) return 0;
  if (target >= 1) return null;
  const reached = (m: number) => probAtLeastOne(alpha, beta, m) >= target - EPS;
  let hi = 1;
  while (!reached(hi)) {
    if (hi >= max) return null;
    hi = Math.min(max, hi * 2);
  }
  let lo = Math.floor(hi / 2); // reached(lo) is false (or lo = 0)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (reached(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Applications needed when the rate is a known fixed p (hypothetical scenarios only). */
export function applicationsNeededFixed(p: number, target: number, max = MAX_APPLICATIONS_SEARCH): number | null {
  if (!(target > 0)) return 0;
  if (target >= 1 || !(p > 0)) return null;
  if (p >= 1) return 1;
  const m = Math.ceil(Math.log1p(-target) / Math.log1p(-p) - EPS);
  const v = Math.max(1, m);
  return v > max ? null : v;
}

export type ThresholdRow = {
  target: number;
  /** Treating every application as independent. */
  naive: number | null;
  /** With the employer-clustering design effect. */
  adjusted: number | null;
  /** Rounded-outward range spanning both answers (null high = "more than low"). */
  range: NiceRange;
};

export function thresholdRows(naive: Posterior, adjusted: Posterior, targets: readonly number[] = TARGETS): ThresholdRow[] {
  return targets.map((target) => {
    const a = applicationsNeeded(naive.alpha, naive.beta, target);
    const b = applicationsNeeded(adjusted.alpha, adjusted.beta, target);
    return { target, naive: a, adjusted: b, range: niceRange(a, b) };
  });
}

export type PredictiveRange = {
  /** Number of future applications considered. */
  applications: number;
  /** Expected number of successes (posterior mean × applications). */
  expected: number;
  /** Central PREDICTIVE_MASS beta-binomial range of the success count. */
  low: number;
  high: number;
  /** Posterior predictive P(at least one success). */
  probAtLeastOne: number;
};

export function predictiveRange(post: Posterior, applications: number): PredictiveRange {
  const n = Math.max(0, Math.floor(applications));
  const tail = (1 - PREDICTIVE_MASS) / 2;
  return {
    applications: n,
    expected: n * post.mean,
    low: n === 0 ? 0 : betaBinomialQuantile(tail, n, post.alpha, post.beta),
    high: n === 0 ? 0 : betaBinomialQuantile(1 - tail, n, post.alpha, post.beta),
    probAtLeastOne: probAtLeastOne(post.alpha, post.beta, n),
  };
}

export type ChartPoint = {
  /** Additional applications. */
  m: number;
  /** Posterior predictive P(≥1) with the clustering adjustment. */
  center: number;
  /** Same quantity treating applications as independent. */
  naive: number;
  /** P(≥1) if the true rate were at the lower / upper end of the 95 % credible interval. */
  low: number;
  high: number;
};

function niceCeil(v: number): number {
  if (v <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * mag >= v) return k * mag;
  return 10 * mag;
}

/** Points for the probability-vs-additional-applications chart (≤ ~60 integer x values). */
export function chartSeries(naive: Posterior, adjusted: Posterior, maxM?: number, points = 60): ChartPoint[] {
  const m90 = applicationsNeeded(adjusted.alpha, adjusted.beta, 0.9, 20_000);
  const upper = maxM ?? niceCeil(Math.min(20_000, (m90 ?? 20_000) * 1.2));
  const step = Math.max(1, Math.ceil(upper / points));
  const out: ChartPoint[] = [];
  for (let m = 0; m <= upper; m += step) {
    out.push({
      m,
      center: probAtLeastOne(adjusted.alpha, adjusted.beta, m),
      naive: probAtLeastOne(naive.alpha, naive.beta, m),
      low: probAtLeastOneFixed(adjusted.interval.low, m),
      high: probAtLeastOneFixed(adjusted.interval.high, m),
    });
  }
  if (out[out.length - 1]!.m !== upper) {
    out.push({
      m: upper,
      center: probAtLeastOne(adjusted.alpha, adjusted.beta, upper),
      naive: probAtLeastOne(naive.alpha, naive.beta, upper),
      low: probAtLeastOneFixed(adjusted.interval.low, upper),
      high: probAtLeastOneFixed(adjusted.interval.high, upper),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Whole-forecast assembly
// ---------------------------------------------------------------------------

/** What the forecast needs from the database (built by `buildForecastInput`). */
export type ForecastInput = {
  /** Applied applications (the funnel's definition). */
  applied: number;
  /** Applied applications that reached an interview (or later). */
  interviews: number;
  /** Applied applications that reached an offer (or later). */
  offers: number;
  /** Applied applications per employer (cluster sizes; they sum to `applied`). */
  clusterSizes: number[];
  /** Days from applying to the first employer response, for applications that got one. */
  responseDays: number[];
  /** Age in days of each applied application with no recorded response yet. */
  awaitingAgesDays: number[];
};

export type ForecastOptions = {
  rho?: number;
  /** Look-ahead for the "next N applications" range. */
  horizon?: number;
  interviewPrior?: BetaPrior;
  offerPrior?: BetaPrior;
};

export type OutcomeKey = "interview" | "offer";

export type OutcomeForecast = {
  key: OutcomeKey;
  observed: { successes: number; n: number; rate: number | null };
  prior: BetaPrior & { mean: number; interval: Interval };
  naive: Posterior;
  adjusted: Posterior;
  thresholds: ThresholdRow[];
  next: PredictiveRange;
  /** True when the prior carries at least half of the adjusted posterior's weight. */
  priorDominated: boolean;
};

export type DataQuality = "none" | "prior-dominated" | "limited" | "usable";

export type ForecastResult = {
  applied: number;
  design: DesignEffect;
  interview: OutcomeForecast;
  offer: OutcomeForecast;
  timing: TimingSummary;
  /** Unanswered applications younger than `pendingWindowDays` (outcome may still change). */
  recentAwaiting: number;
  pendingWindowDays: number;
  quality: DataQuality;
  chart: ChartPoint[];
};

function outcome(key: OutcomeKey, prior: BetaPrior, successes: number, n: number, scale: number, horizon: number): OutcomeForecast {
  const naive = posterior(prior, successes, n, 1);
  const adjusted = posterior(prior, successes, n, scale);
  return {
    key,
    observed: { successes, n, rate: n > 0 ? successes / n : null },
    prior: {
      ...prior,
      mean: betaMean(prior.alpha, prior.beta),
      interval: { low: betaQuantile(0.025, prior.alpha, prior.beta), high: betaQuantile(0.975, prior.alpha, prior.beta) },
    },
    naive,
    adjusted,
    thresholds: thresholdRows(naive, adjusted),
    next: predictiveRange(adjusted, horizon),
    priorDominated: adjusted.priorWeight >= 0.5,
  };
}

/**
 * How long an unanswered application should be treated as "may still answer": the observed upper
 * quartile of response times when there are enough of them, else 14 days, clamped to 7–60 days.
 */
export function pendingWindow(timing: TimingSummary): number {
  const base = timing.q3 ?? DEFAULT_PENDING_WINDOW_DAYS;
  return Math.min(60, Math.max(7, Math.round(base)));
}

export function computeForecast(input: ForecastInput, options: ForecastOptions = {}): ForecastResult {
  const n = Math.max(0, Math.floor(input.applied));
  const rho = options.rho ?? DEFAULT_RHO;
  const horizon = Math.max(1, Math.min(500, Math.floor(options.horizon ?? DEFAULT_HORIZON)));
  const design = designEffect(input.clusterSizes, rho);
  // Scale observed counts to the effective sample size; if cluster data are missing, assume none.
  const scale = design.n > 0 ? design.nEff / design.n : 1;
  const interview = outcome("interview", options.interviewPrior ?? INTERVIEW_PRIOR, Math.min(input.interviews, n), n, scale, horizon);
  const offer = outcome("offer", options.offerPrior ?? OFFER_PRIOR, Math.min(input.offers, n), n, scale, horizon);
  const timing = summarizeTiming(input.responseDays, input.awaitingAgesDays.length);
  const windowDays = pendingWindow(timing);
  const recentAwaiting = input.awaitingAgesDays.filter((age) => age < windowDays).length;
  const quality: DataQuality = n === 0 ? "none" : interview.priorDominated ? "prior-dominated" : design.nEff < 30 ? "limited" : "usable";
  return {
    applied: n,
    design,
    interview,
    offer,
    timing,
    recentAwaiting,
    pendingWindowDays: windowDays,
    quality,
    chart: chartSeries(interview.naive, interview.adjusted),
  };
}

// ---------------------------------------------------------------------------
// Scenario mode (Hypothetical)
// ---------------------------------------------------------------------------

export type ScenarioInput = {
  /** Hypothetical per-application interview probability, 0–1. */
  interviewRate: number;
  /** Hypothetical per-application offer probability, 0–1. */
  offerRate: number;
  /** Number of additional applications to evaluate. */
  applications: number;
};

export type ScenarioOutcome = {
  rate: number;
  thresholds: { target: number; applications: number | null }[];
  /** P(≥1) within `applications`, assuming independence and a known fixed rate. */
  probAtLeastOne: number;
  expected: number;
};

export type ScenarioResult = { interview: ScenarioOutcome; offer: ScenarioOutcome; applications: number };

/**
 * Hypothetical "what if my rates were X" mode. The user's rates are taken as exactly known and
 * applications as independent — the most optimistic possible reading — which the UI labels.
 */
export function scenarioForecast(input: ScenarioInput): ScenarioResult {
  const apps = Math.max(0, Math.floor(input.applications));
  const one = (rate: number): ScenarioOutcome => {
    const p = Math.min(1, Math.max(0, rate));
    return {
      rate: p,
      thresholds: TARGETS.map((target) => ({ target, applications: applicationsNeededFixed(p, target) })),
      probAtLeastOne: probAtLeastOneFixed(p, apps),
      expected: p * apps,
    };
  };
  return { interview: one(input.interviewRate), offer: one(input.offerRate), applications: apps };
}
