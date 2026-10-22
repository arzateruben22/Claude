/**
 * Wording and rounding for forecast numbers. Everything here exists to stop the UI from looking
 * more precise than the data allow: rates are whole percentages ("<1%" rather than "0.4%"),
 * application counts are ranges rounded outward to a step that grows with the number, and the
 * sentences say "estimate" and "if your current rates hold". Nothing here ever produces a date.
 */

/** A rounded range; `high: null` means "more than `low`" (beyond the search limit). */
export type NiceRange = { low: number; high: number | null };

/** Rounding step for an application count: 1 below 10, then 5, 10, 50, 100, 500. */
export function niceStep(v: number): number {
  if (v < 10) return 1;
  if (v < 50) return 5;
  if (v < 200) return 10;
  if (v < 1000) return 50;
  if (v < 5000) return 100;
  return 500;
}

/**
 * Range spanning two answers (e.g. the independent and the clustering-adjusted one), rounded
 * outward: the low end down and the high end up to the step for its size. A single answer still
 * becomes a range at least one step wide, because a lone number would overstate precision.
 * Null inputs mean "beyond the search limit".
 */
export function niceRange(a: number | null, b: number | null): NiceRange {
  const known = [a, b].filter((v): v is number => v !== null && Number.isFinite(v));
  if (known.length === 0) return { low: 100_000, high: null };
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const low = Math.max(1, Math.floor(lo / niceStep(lo)) * niceStep(lo));
  if (known.length < 2) return { low, high: null };
  let high = Math.ceil(hi / niceStep(hi)) * niceStep(hi);
  if (high <= low) high = low + niceStep(low);
  return { low, high };
}

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return int.format(n);
}

/** "20–25", or "more than 10,000" when the high end is unknown. */
export function formatRange(r: NiceRange): string {
  if (r.high === null) return `more than ${formatCount(r.low)}`;
  return `${formatCount(r.low)}–${formatCount(r.high)}`;
}

/** Whole-percent display with honest ends: "0%", "<1%", "8%", ">99%", "100%". */
export function formatRate(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  if (p <= 0) return "0%";
  if (p >= 1) return "100%";
  if (p < 0.01) return "<1%";
  if (p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** "3%–14%" for a credible / predictive interval. */
export function formatRateInterval(iv: { low: number; high: number } | null | undefined): string {
  if (!iv) return "—";
  return `${formatRate(iv.low)}–${formatRate(iv.high)}`;
}

/** Days with sensible precision: one decimal below 10, whole days above. */
export function formatDays(d: number | null | undefined): string {
  if (d === null || d === undefined || !Number.isFinite(d)) return "—";
  const v = d < 10 ? Math.round(d * 10) / 10 : Math.round(d);
  return `${v} ${v === 1 ? "day" : "days"}`;
}

/** "4–11 days" for an interquartile range. */
export function formatDaysRange(a: number | null | undefined, b: number | null | undefined): string {
  if (a === null || a === undefined || b === null || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const r = (d: number) => (d < 10 ? Math.round(d * 10) / 10 : Math.round(d));
  return `${r(a)}–${r(b)} days`;
}

/** Expected count with one decimal (it is an average, never a promise). */
export function formatExpected(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v < 10 ? (Math.round(v * 10) / 10).toString() : int.format(v);
}

const NOUNS = { interview: "interview", offer: "offer" } as const;

/**
 * The headline sentence. Uses the 50 % threshold: the point where at least one success becomes as
 * likely as not. Never phrased as a promise and never converted into a date.
 */
export function expectationSentence(kind: keyof typeof NOUNS, range: NiceRange): string {
  const noun = NOUNS[kind];
  if (range.high === null) {
    return `With your current record, even ${formatCount(range.low)} more applications would not make one more ${noun} as likely as not (estimate). The data are too thin, or the observed rate too low, for a useful projection.`;
  }
  return `If your current rates hold, roughly ${formatRange(range)} more applications would be expected to produce one ${noun} (estimate: the point where the chance of at least one reaches 50%).`;
}

/** "an 80% chance" / "a 50% chance". */
export function chancePhrase(target: number): string {
  const pct = Math.round(target * 100);
  return `${pct === 8 || pct === 11 || pct === 18 || (pct >= 80 && pct < 90) ? "an" : "a"} ${pct}% chance`;
}
