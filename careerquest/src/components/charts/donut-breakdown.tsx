"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipBox, type RechartsTooltipProps } from "./chart-tooltip";
import { CATEGORICAL, CATEGORICAL_BG, MAX_CATEGORIES, OTHER_BG, OTHER_FILL } from "./palette";
import { formatNumber, formatPercent } from "@/lib/format";

export type DonutDatum = { key: string; label: string; value: number };

type Slice = DonutDatum & { fill: string; swatchClass: string; share: number };

function SliceTooltip({ active, payload }: RechartsTooltipProps<Slice>) {
  const s = payload?.[0]?.payload;
  if (!active || !s) return null;
  return (
    <ChartTooltipBox
      title={s.label}
      rows={[
        { label: "Applications", value: formatNumber(s.value), color: s.fill },
        { label: "Share", value: formatPercent(s.share, 0) },
      ]}
    />
  );
}

/** Fold anything past the fixed categorical slots into "Other" so hues are never cycled. */
export function foldSlices(data: DonutDatum[], total: number): Slice[] {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const keep = sorted.length > MAX_CATEGORIES ? sorted.slice(0, MAX_CATEGORIES - 1) : sorted;
  const rest = sorted.slice(keep.length);
  const slices: Slice[] = keep.map((d, i) => ({ ...d, fill: CATEGORICAL[i]!, swatchClass: CATEGORICAL_BG[i]!, share: total > 0 ? d.value / total : 0 }));
  if (rest.length) {
    const value = rest.reduce((a, d) => a + d.value, 0);
    slices.push({ key: "__other", label: `Other (${rest.length})`, value, fill: OTHER_FILL, swatchClass: OTHER_BG, share: total > 0 ? value / total : 0 });
  }
  return slices;
}

/**
 * Donut with an HTML legend that carries label, count and share (identity is never color-alone).
 * The SVG is aria-hidden; the legend list is the accessible representation.
 */
export function DonutBreakdown({ data, caption, centerLabel, testId }: { data: DonutDatum[]; caption: string; centerLabel: string; testId?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const slices = foldSlices(data, total);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4" data-testid={testId}>
      <div className="relative h-44 w-44 mx-auto sm:mx-0 shrink-0" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Tooltip content={<SliceTooltip />} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="var(--bg-elevated)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-semibold tracking-tight">{formatNumber(total)}</span>
          <span className="text-[11px] text-fg-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex-1 min-w-0 space-y-1.5 text-sm" aria-label={caption}>
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[3px] shrink-0 ${s.swatchClass}`} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="text-fg-muted tnum shrink-0">
              {formatNumber(s.value)} <span className="text-fg-subtle">· {formatPercent(s.share, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
