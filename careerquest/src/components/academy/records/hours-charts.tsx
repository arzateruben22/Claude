"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CumulativePoint, WeeklyPoint } from "@/lib/academy/hours/stats";
import { BarSeriesChart, type BarSeries } from "@/components/charts/bar-series-chart";
import { AXIS_TICK, GRID_STROKE, ChartTooltipBox, type RechartsTooltipProps } from "@/components/charts/chart-tooltip";
import { formatHours, formatHoursNumber } from "./format";

export const HOURS_SERIES: BarSeries[] = [
  { key: "verified", label: "Verified", color: "var(--chart-1)", swatchClass: "bg-chart-1" },
  { key: "selfReported", label: "Self-reported", color: "var(--chart-2)", swatchClass: "bg-chart-2" },
];

/** Hours per week (last 12 weeks), verified and self-reported side by side. */
export function WeeklyHoursChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const verified = weekly.reduce((a, w) => a + w.verified, 0);
  const self = weekly.reduce((a, w) => a + w.selfReported, 0);
  const active = weekly.filter((w) => w.verified + w.selfReported > 0).length;
  const summary =
    verified + self === 0
      ? "No hours logged in the last 12 weeks."
      : `Last 12 weeks: ${formatHours(verified)} verified and ${formatHours(self)} self-reported across ${active} week${active === 1 ? "" : "s"} with hours.`;
  return (
    <BarSeriesChart
      data={weekly.map((w) => ({ key: w.key, label: w.label, tooltipLabel: w.tooltipLabel, verified: w.verified, selfReported: w.selfReported }))}
      series={HOURS_SERIES}
      caption="Hours per week, verified and self-reported, last 12 weeks"
      summary={summary}
      height={200}
      tickEvery={2}
      testId="weekly-hours"
    />
  );
}

function CumulativeTooltip({ active, payload }: RechartsTooltipProps<CumulativePoint>) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <ChartTooltipBox
      title={p.tooltipLabel}
      rows={[
        { label: "Verified", value: formatHours(p.verified), color: "var(--chart-1)" },
        { label: "Self-reported", value: formatHours(p.selfReported), color: "var(--chart-2)" },
      ]}
    />
  );
}

/** Running totals by week against the requirement line (e.g. 8,000 h). */
export function CumulativeHoursChart({ points, required, requirementLabel }: { points: CumulativePoint[]; required: number; requirementLabel: string }) {
  const last = points[points.length - 1];
  const summary = last
    ? `${last.tooltipLabel}: ${formatHours(last.verified)} verified and ${formatHours(last.selfReported)} self-reported, against ${formatHours(required)} (${requirementLabel}).`
    : "No hours logged yet.";
  const max = Math.max(required, ...points.map((p) => Math.max(p.verified, p.selfReported)), 1);
  return (
    <div data-testid="cumulative-hours">
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 8, left: -8, bottom: 0 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={24} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={52}
              domain={[0, Math.ceil(max / 1000) * 1000]}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
            />
            <Tooltip content={<CumulativeTooltip />} />
            {required > 0 && (
              <ReferenceLine
                y={required}
                stroke="var(--chart-5)"
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
                label={{ value: `${formatHoursNumber(required)} h`, position: "insideTopLeft", fill: "var(--chart-5)", fontSize: 10 }}
              />
            )}
            <Line type="monotone" dataKey="verified" name="Verified" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="selfReported" name="Self-reported" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-chart-1" />
          Verified (cumulative)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-chart-2" />
          Self-reported (cumulative, dashed)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-chart-5" />
          {requirementLabel}
        </li>
      </ul>
      <p className="mt-2 text-xs text-fg-muted">{summary}</p>
      <table className="sr-only">
        <caption>Cumulative hours by week, verified and self-reported</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Verified</th>
            <th scope="col">Self-reported</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.tooltipLabel}</th>
              <td>{formatHoursNumber(p.verified)}</td>
              <td>{formatHoursNumber(p.selfReported)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
