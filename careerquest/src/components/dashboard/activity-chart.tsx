"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/dashboard/time";

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: SeriesPoint }> };

function ChartTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-ctl border border-line bg-bg-elevated px-2.5 py-1.5 text-xs shadow-card">
      <p className="text-fg-muted">{point.label}</p>
      <p className="font-medium tnum">
        {point.count} application{point.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/** 14-day bar chart of applications submitted. Accessible summary + sr-only table accompany the SVG. */
export function ActivityChart({ series, dailyTarget }: { series: SeriesPoint[]; dailyTarget: number }) {
  const total = series.reduce((a, p) => a + p.count, 0);
  const best = series.reduce<SeriesPoint | null>((b, p) => (p.count > 0 && (!b || p.count > b.count) ? p : b), null);
  const activeDays = series.filter((p) => p.count > 0).length;
  const lastKey = series[series.length - 1]?.key;
  const maxCount = Math.max(dailyTarget, ...series.map((p) => p.count), 1);
  const summary =
    total === 0
      ? "No applications were submitted in the last 14 days."
      : `${total} application${total === 1 ? "" : "s"} in the last 14 days across ${activeDays} active day${activeDays === 1 ? "" : "s"}` +
        (best ? `; best day ${best.label} with ${best.count}.` : ".");

  return (
    <div>
      <div className="h-44 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--fg-subtle)", fontSize: 11 }} interval={series.length > 7 ? 1 : 0} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--fg-subtle)", fontSize: 11 }} domain={[0, maxCount]} width={40} />
            <Tooltip cursor={{ fill: "var(--surface-hover)" }} content={<ChartTooltip />} />
            {dailyTarget > 0 && (
              <ReferenceLine y={dailyTarget} stroke="var(--chart-2)" strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: `target ${dailyTarget}`, position: "insideTopRight", fill: "var(--chart-2)", fontSize: 10 }} />
            )}
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28}>
              {series.map((p) => (
                <Cell key={p.key} fill={p.key === lastKey ? "var(--chart-2)" : "var(--chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-fg-muted" data-testid="activity-summary">
        {summary}
        {dailyTarget > 0 && <span className="text-fg-subtle"> Dashed line marks your daily target of {dailyTarget}.</span>}
      </p>
      <table className="sr-only">
        <caption>Applications submitted per day, last 14 days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Applications</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
