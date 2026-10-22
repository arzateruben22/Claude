import { Flame, Moon, Sparkles } from "lucide-react";
import type { TodayMissionsSummary } from "@/lib/game/views";
import { RestDayToggle } from "./rest-day-toggle";
import { formatDayKey } from "./format";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Streak, today's XP and the rest-day toggle for the Today tab. */
export function TodayStatusCard({ summary }: { summary: TodayMissionsSummary }) {
  const { streak } = summary;
  return (
    <section aria-labelledby="today-status-title" className="glass rounded-card p-5">
      <h2 id="today-status-title" className="text-sm font-medium tracking-tight">
        Today
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-ctl bg-surface-strong/60 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
            XP today
          </dt>
          <dd className="mt-1 text-xl font-semibold tnum text-gold" data-testid="today-xp">
            {summary.todayXp > 0 ? `+${fmt(summary.todayXp)}` : fmt(summary.todayXp)}
          </dd>
        </div>
        <div className="rounded-ctl bg-surface-strong/60 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
            <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
            Streak
          </dt>
          <dd className="mt-1 text-xl font-semibold tnum" data-testid="streak-value">
            {streak.current} {streak.current === 1 ? "day" : "days"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-fg-subtle tnum">
        Longest {streak.longest} {streak.longest === 1 ? "workday" : "workdays"}
        {streak.lastActiveKey ? ` · last active ${formatDayKey(streak.lastActiveKey)}` : " · no activity recorded yet"}
      </p>
      <p className="mt-1 text-xs text-fg-subtle">Streaks count workdays with real activity. Rest days, weekends and rejections never break them.</p>

      <div className="mt-4 border-t border-line pt-4">
        {summary.restDay ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Moon className="h-4 w-4 mt-0.5 shrink-0 text-info" aria-hidden />
            Rest day. Today&apos;s daily missions are paused and nothing counts against you.
          </p>
        ) : (
          <p className="text-sm text-fg-muted">Need a break? Taking a rest day pauses today&apos;s daily missions without touching your streak.</p>
        )}
        <div className="mt-3">
          <RestDayToggle restDay={summary.restDay} />
        </div>
      </div>
    </section>
  );
}
