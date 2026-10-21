/**
 * Chart color assignments. Only the theme's chart tokens are used (never raw colors).
 *
 * Categorical order was chosen so every adjacent pair stays distinguishable under protan /
 * deutan / tritan simulation in all three themes (validated with the dataviz palette checker):
 * chart-1, chart-5, chart-4, chart-2, chart-6, chart-3. Hues are assigned in this fixed order and
 * never cycled; anything beyond six slots folds into "Other".
 */
export const CATEGORICAL = ["var(--chart-1)", "var(--chart-5)", "var(--chart-4)", "var(--chart-2)", "var(--chart-6)", "var(--chart-3)"] as const;

/** Tailwind classes for legend swatches, in the same order as CATEGORICAL. */
export const CATEGORICAL_BG = ["bg-chart-1", "bg-chart-5", "bg-chart-4", "bg-chart-2", "bg-chart-6", "bg-chart-3"] as const;

export const MAX_CATEGORIES = CATEGORICAL.length;

/** Primary single-series color (magnitude charts, funnel). */
export const PRIMARY = "var(--chart-1)";
export const PRIMARY_BG = "bg-chart-1";

/** Second series in a grouped bar chart (clearly separated from PRIMARY in all themes). */
export const SECONDARY = "var(--chart-2)";
export const SECONDARY_BG = "bg-chart-2";

/** Fill for the "Other" bucket: a muted neutral so it never competes with real categories. */
export const OTHER_FILL = "var(--fg-subtle)";
export const OTHER_BG = "bg-fg-subtle";
