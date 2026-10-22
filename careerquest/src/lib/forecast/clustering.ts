/**
 * Clustering caveat: application outcomes are not independent.
 *
 * Applications to the same employer are usually read by the same recruiter, judged against the same
 * screening rules and often closed by the same hiring freeze, so their outcomes move together. A
 * binomial model that treats every application as an independent coin flip therefore overstates how
 * much information 100 applications carry. The standard survey-statistics correction is the Kish
 * design effect for cluster samples:
 *
 *   DEFF = 1 + ρ (m̄ − 1),   n_eff = n / DEFF
 *
 * where ρ is the intra-cluster correlation of outcomes and m̄ is the cluster size. With unequal
 * cluster sizes the size-weighted mean m̄ = Σ mᵢ² / Σ mᵢ is used (it equals m when all clusters have
 * the same size, and it is what drives the variance inflation).
 *
 * Clusters are employers (the employer record, or the normalized company name when no employer is
 * linked). Other sources of dependence (the same résumé, the same season, the same job board) are
 * NOT modelled; they would shrink n_eff further, so the adjusted result is still on the optimistic
 * side.
 */

/**
 * Default intra-employer correlation. A judgement call, stated openly: 0 means applications to the
 * same employer are independent; 1 means they always share one outcome. A personal tracker is far
 * too small to estimate ρ, so we assume a moderate 0.3 and let the user change it.
 */
export const DEFAULT_RHO = 0.3;

/** The values offered in the UI (a GET select), so the page never accepts arbitrary input. */
export const RHO_OPTIONS = [0, 0.1, 0.3, 0.5, 0.8] as const;

export function parseRho(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || v.trim() === "") return DEFAULT_RHO;
  const n = Number(v);
  return (RHO_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_RHO;
}

export type DesignEffect = {
  /** Applications with a known outcome counted in the clusters. */
  n: number;
  /** Number of clusters (distinct employers). */
  clusters: number;
  /** Size-weighted mean cluster size Σm²/Σm (1 when every employer appears once). */
  meanClusterSize: number;
  largestCluster: number;
  rho: number;
  /** 1 + ρ(m̄ − 1); never below 1. */
  deff: number;
  /** n / DEFF. */
  nEff: number;
};

/** Kish design effect for the given cluster sizes (zero-size clusters are ignored). */
export function designEffect(clusterSizes: number[], rho: number): DesignEffect {
  const sizes = clusterSizes.filter((s) => Number.isFinite(s) && s > 0).map((s) => Math.floor(s));
  const n = sizes.reduce((a, b) => a + b, 0);
  const r = Number.isFinite(rho) ? Math.min(1, Math.max(0, rho)) : DEFAULT_RHO;
  if (n === 0) return { n: 0, clusters: 0, meanClusterSize: 0, largestCluster: 0, rho: r, deff: 1, nEff: 0 };
  const sumSq = sizes.reduce((a, s) => a + s * s, 0);
  const meanClusterSize = sumSq / n;
  const deff = Math.max(1, 1 + r * (meanClusterSize - 1));
  return {
    n,
    clusters: sizes.length,
    meanClusterSize,
    largestCluster: Math.max(...sizes),
    rho: r,
    deff,
    nEff: n / deff,
  };
}
