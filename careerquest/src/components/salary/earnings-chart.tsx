"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID_STROKE, ChartTooltipBox, type RechartsTooltipProps } from "@/components/charts/chart-tooltip";
import { PRIMARY, PRIMARY_BG, SECONDARY, SECONDARY_BG } from "@/components/charts/palette";
import type { CompareRow } from "@/lib/salary/compare";
import { usd } from "./format";

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
};

function YearTooltip({ active, payload, labels }: RechartsTooltipProps<CompareRow> & { labels: [string, string] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <ChartTooltipBox
      title={`After year ${p.year} (cumulative)`}
      rows={[
        { label: labels[0], value: usd(p.cumA), color: PRIMARY },
        { label: labels[1], value: usd(p.cumB), color: SECONDARY },
      ]}
    />
  );
}

/** Cumulative gross earnings of the two paths, one line each, with legend and an sr-only table. */
export function EarningsChart({ rows, labels, summary }: { rows: CompareRow[]; labels: [string, string]; summary: string }) {
  return (
    <div data-testid="compare-chart">
      <div className="h-60 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => `Y${v}`} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={compact} width={56} />
            <Tooltip content={<YearTooltip labels={labels} />} cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} />
            <Line dataKey="cumA" name={labels[0]} stroke={PRIMARY} strokeWidth={2} dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }} isAnimationActive={false} activeDot={{ r: 5, stroke: "var(--bg-elevated)", strokeWidth: 2 }} />
            <Line dataKey="cumB" name={labels[1]} stroke={SECONDARY} strokeWidth={2} dot={{ r: 3, fill: SECONDARY, strokeWidth: 0 }} isAnimationActive={false} activeDot={{ r: 5, stroke: "var(--bg-elevated)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-0.5 w-4 rounded-full ${PRIMARY_BG}`} />
          {labels[0]}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-0.5 w-4 rounded-full ${SECONDARY_BG}`} />
          {labels[1]}
        </li>
      </ul>
      <p className="mt-2 text-xs text-fg-muted" data-testid="compare-chart-summary">
        {summary}
      </p>
      <table className="sr-only">
        <caption>Cumulative gross earnings by year (estimate)</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">{labels[0]}</th>
            <th scope="col">{labels[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <th scope="row">{r.year}</th>
              <td>{usd(r.cumA)}</td>
              <td>{usd(r.cumB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
