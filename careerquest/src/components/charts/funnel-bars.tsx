"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CURSOR_FILL, ChartTooltipBox, type RechartsTooltipProps } from "./chart-tooltip";
import { PRIMARY } from "./palette";
import { formatNumber, formatPercent } from "@/lib/format";

export type FunnelStageDatum = {
  key: string;
  label: string;
  count: number;
  /** Share of the first stage (0..1), null for the first stage itself or when it is empty. */
  share: number | null;
};

function StageTooltip({ active, payload }: RechartsTooltipProps<FunnelStageDatum>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const rows = [{ label: "Applications", value: formatNumber(point.count) }];
  if (point.share !== null) rows.push({ label: "Of applied", value: formatPercent(point.share, 0) });
  return <ChartTooltipBox title={point.label} rows={rows} />;
}

const ROW_HEIGHT = 34;

/**
 * Horizontal stage bars for the funnel. One hue (it is a magnitude chart), direct value labels at
 * the bar tips, and an sr-only table with the same numbers.
 */
export function FunnelBars({ stages, caption, testId }: { stages: FunnelStageDatum[]; caption: string; testId?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  const height = stages.length * ROW_HEIGHT + 8;
  const tip = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? formatNumber(n) : "";
  };
  return (
    <div data-testid={testId}>
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stages} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer={false}>
            <XAxis type="number" hide domain={[0, max]} />
            <YAxis type="category" dataKey="label" width={88} tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
            <Tooltip cursor={CURSOR_FILL} content={<StageTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} background={{ fill: "var(--surface-strong)", radius: 4 }}>
              {stages.map((s) => (
                <Cell key={s.key} fill={PRIMARY} />
              ))}
              <LabelList dataKey="count" position="right" formatter={tip} style={{ fill: "var(--fg)", fontSize: 11, fontVariantNumeric: "tabular-nums" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Applications</th>
            <th scope="col">Share of applied</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{formatNumber(s.count)}</td>
              <td>{s.share === null ? "—" : formatPercent(s.share, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
