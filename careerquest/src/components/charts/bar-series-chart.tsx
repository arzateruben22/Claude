"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CURSOR_FILL, GRID_STROKE, ChartTooltipBox, type RechartsTooltipProps } from "./chart-tooltip";
import { formatNumber } from "@/lib/format";

export type BarSeries = { key: string; label: string; color: string; swatchClass: string };

export type BarSeriesDatum = { key: string; label: string; tooltipLabel?: string } & Record<string, string | number | undefined>;

type Props = {
  data: BarSeriesDatum[];
  series: BarSeries[];
  /** Accessible caption for the data table. */
  caption: string;
  /** Plain-language summary shown under the chart (also read by screen readers). */
  summary: string;
  /** Pixel height of the plot area. */
  height?: number;
  /** Show every Nth x-axis tick (0 = auto). */
  tickEvery?: number;
  testId?: string;
};

function SeriesTooltip({ active, payload, series }: RechartsTooltipProps<BarSeriesDatum> & { series: BarSeries[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <ChartTooltipBox
      title={point.tooltipLabel ?? point.label}
      rows={series.map((s) => ({ label: s.label, value: formatNumber(Number(point[s.key] ?? 0)), color: s.color }))}
    />
  );
}

/**
 * Grouped column chart for daily/weekly activity. Marks use chart tokens, text uses text tokens.
 * The SVG is aria-hidden; the summary and the sr-only table carry the same values for screen readers.
 */
export function BarSeriesChart({ data, series, caption, summary, height = 208, tickEvery = 0, testId }: Props) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0))));
  const interval = tickEvery > 0 ? tickEvery - 1 : "preserveStartEnd";
  return (
    <div data-testid={testId}>
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="30%" barGap={2} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={interval} minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} domain={[0, max]} width={40} />
            <Tooltip cursor={CURSOR_FILL} content={<SeriesTooltip series={series} />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[3px] ${s.swatchClass}`} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-fg-muted" data-testid={testId ? `${testId}-summary` : undefined}>
        {summary}
      </p>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.tooltipLabel ?? d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatNumber(Number(d[s.key] ?? 0))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
