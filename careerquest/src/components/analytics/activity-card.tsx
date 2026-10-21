import { BarSeriesChart, type BarSeries, type BarSeriesDatum } from "@/components/charts/bar-series-chart";
import { PRIMARY, PRIMARY_BG, SECONDARY, SECONDARY_BG } from "@/components/charts/palette";
import { dayLabel } from "@/lib/analytics/time";
import type { DailyPoint, WeeklyPoint } from "@/lib/analytics/types";
import { formatNumber } from "@/lib/format";

const SERIES: BarSeries[] = [
  { key: "applied", label: "Applications", color: PRIMARY, swatchClass: PRIMARY_BG },
  { key: "followUps", label: "Follow-ups", color: SECONDARY, swatchClass: SECONDARY_BG },
];

function summarize(points: { applied: number; followUps: number; label: string }[], unit: "day" | "week"): string {
  const applied = points.reduce((a, p) => a + p.applied, 0);
  const followUps = points.reduce((a, p) => a + p.followUps, 0);
  const active = points.filter((p) => p.applied > 0).length;
  const best = points.reduce<(typeof points)[number] | null>((b, p) => (p.applied > 0 && (!b || p.applied > b.applied) ? p : b), null);
  if (applied === 0 && followUps === 0) return `No applications or follow-ups were recorded in this window.`;
  const parts = [`${formatNumber(applied)} application${applied === 1 ? "" : "s"} across ${active} active ${unit}${active === 1 ? "" : "s"}`];
  if (best) parts.push(`best ${unit} ${best.label} with ${formatNumber(best.applied)}`);
  parts.push(`${formatNumber(followUps)} follow-up${followUps === 1 ? "" : "s"} logged`);
  return parts.join("; ") + ".";
}

type Props = {
  daily: DailyPoint[];
  dailyWindow: { fromKey: string; toKey: string };
  weekly: WeeklyPoint[];
  weeklyWindow: { fromKey: string; toKey: string };
};

/** Daily and weekly activity. Applications come from APPLIED events in the filtered slice; follow-ups from the activity log. */
export function ActivityCard({ daily, dailyWindow, weekly, weeklyWindow }: Props) {
  const dailyData: BarSeriesDatum[] = daily.map((p) => ({ key: p.key, label: p.label, applied: p.applied, followUps: p.followUps }));
  const weeklyData: BarSeriesDatum[] = weekly.map((w) => ({ key: w.key, label: w.label, tooltipLabel: w.rangeLabel, applied: w.applied, followUps: w.followUps }));
  const dailyTicks = daily.length > 45 ? 14 : daily.length > 21 ? 7 : daily.length > 10 ? 2 : 1;
  const weeklyTicks = weekly.length > 26 ? 8 : weekly.length > 12 ? 4 : 1;
  return (
    <section aria-labelledby="activity-title" className="glass rounded-card p-5" data-testid="activity-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activity-title" className="text-sm font-medium tracking-tight">
          Activity
        </h2>
        <p className="text-xs text-fg-subtle">Observed · follow-ups from your activity log</p>
      </div>

      <h3 className="mt-3 text-xs font-medium text-fg-muted">
        Daily · {dayLabel(dailyWindow.fromKey)} – {dayLabel(dailyWindow.toKey)}
      </h3>
      <div className="mt-1">
        <BarSeriesChart
          data={dailyData}
          series={SERIES}
          caption={`Applications and follow-ups per day, ${dayLabel(dailyWindow.fromKey)} to ${dayLabel(dailyWindow.toKey)}`}
          summary={summarize(daily, "day")}
          tickEvery={dailyTicks}
          testId="daily-chart"
        />
      </div>

      <h3 className="mt-5 text-xs font-medium text-fg-muted">
        Weekly · weeks starting {dayLabel(weeklyWindow.fromKey)} – {dayLabel(weeklyWindow.toKey)}
      </h3>
      <div className="mt-1">
        <BarSeriesChart
          data={weeklyData}
          series={SERIES}
          caption={`Applications and follow-ups per week (Monday start), ${dayLabel(weeklyWindow.fromKey)} to ${dayLabel(weeklyWindow.toKey)}`}
          summary={summarize(weekly.map((w) => ({ ...w, label: w.rangeLabel })), "week")}
          tickEvery={weeklyTicks}
          height={176}
          testId="weekly-chart"
        />
      </div>
      <p className="mt-3 text-[11px] text-fg-subtle">
        Daily view shows at most the last 90 days of the selected range; weekly view at most 52 weeks. Applications are dated by when you applied; follow-ups are
        from the daily activity log and are not filtered by application.
      </p>
    </section>
  );
}
