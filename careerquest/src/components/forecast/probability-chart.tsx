"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID_STROKE, ChartTooltipBox, type RechartsTooltipProps, type TooltipRow } from "@/components/charts/chart-tooltip";
import { OTHER_FILL, PRIMARY } from "@/components/charts/palette";
import type { ChartPoint } from "@/lib/forecast/model";
import { formatCount, formatRate } from "@/lib/forecast/format";

type Datum = ChartPoint & { band: [number, number] };

function PointTooltip({ active, payload, showNaive }: RechartsTooltipProps<Datum> & { showNaive: boolean }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const rows: TooltipRow[] = [{ label: "Estimate", value: formatRate(p.center), color: PRIMARY }];
  if (showNaive) rows.push({ label: "If independent", value: formatRate(p.naive), color: OTHER_FILL });
  rows.push({ label: "95% band", value: `${formatRate(p.low)}–${formatRate(p.high)}` });
  return <ChartTooltipBox title={`After ${formatCount(p.m)} more applications`} rows={rows} />;
}

const pctTick = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Chance of at least one more interview vs. additional applications (posterior predictive), with
 * the 95% credible band and, when clustering changes it, the independent-outcome line in a muted
 * reference color. The SVG is aria-hidden; the summary and the sr-only table carry the values.
 */
export function ProbabilityChart({ points, showNaive, summary }: { points: ChartPoint[]; showNaive: boolean; summary: string }) {
  const data: Datum[] = points.map((p) => ({ ...p, band: [p.low, p.high] }));
  const maxM = data.length ? data[data.length - 1]!.m : 10;
  const tableRows = data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 12)) === 0 || i === data.length - 1);
  return (
    <div data-testid="forecast-chart">
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 36, left: -16, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="m"
              type="number"
              domain={[0, maxM]}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              allowDecimals={false}
              tickFormatter={(v: number) => formatCount(v)}
              minTickGap={24}
            />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={pctTick} tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} />
            {[0.5, 0.8, 0.9].map((t) => (
              <ReferenceLine
                key={t}
                y={t}
                stroke="var(--line-strong)"
                strokeWidth={1}
                label={{ value: pctTick(t), position: "right", fill: "var(--fg-subtle)", fontSize: 10 }}
              />
            ))}
            <Tooltip content={<PointTooltip showNaive={showNaive} />} cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} />
            <Area dataKey="band" stroke="none" fill={PRIMARY} fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
            {showNaive && <Line dataKey="naive" stroke={OTHER_FILL} strokeWidth={1.5} dot={false} isAnimationActive={false} activeDot={false} />}
            <Line dataKey="center" stroke={PRIMARY} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: "var(--bg-elevated)", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-chart-1" />
          Estimated chance (clustering-adjusted)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-[3px] bg-chart-1/20" />
          95% band (true rate at the low / high end of its interval)
        </li>
        {showNaive && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-fg-subtle" />
            If every application were independent
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-fg-muted" data-testid="forecast-chart-summary">
        {summary}
      </p>
      <table className="sr-only">
        <caption>Estimated chance of at least one more interview by number of additional applications</caption>
        <thead>
          <tr>
            <th scope="col">Additional applications</th>
            <th scope="col">Estimate</th>
            {showNaive && <th scope="col">If independent</th>}
            <th scope="col">95% band</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((p) => (
            <tr key={p.m}>
              <th scope="row">{formatCount(p.m)}</th>
              <td>{formatRate(p.center)}</td>
              {showNaive && <td>{formatRate(p.naive)}</td>}
              <td>
                {formatRate(p.low)}–{formatRate(p.high)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
