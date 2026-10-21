import { Flame, Trophy } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard/types";
import { fmtDay } from "./format";

export function XpStreakCard({ xp, streak }: { xp: DashboardData["xp"]; streak: DashboardData["streak"] }) {
  const span = xp.next - xp.current;
  const into = xp.totalXp - xp.current;
  return (
    <section aria-labelledby="xp-title" className="glass rounded-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="xp-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" aria-hidden />
          Career level
        </h2>
        <p className="text-gold font-semibold tnum">Lv {xp.level}</p>
      </div>
      <ProgressBar value={xp.progress} max={1} tone="gold" className="mt-3" label={`Progress to level ${xp.level + 1}`} />
      <p className="mt-1.5 text-xs text-fg-muted tnum">
        {formatNumber(xp.totalXp)} XP total · {formatNumber(Math.max(0, into))} / {formatNumber(span)} to level {xp.level + 1}
      </p>

      <div className="mt-4 pt-4 border-t border-line flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Flame className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium tnum" data-testid="streak-current">
            {streak.current > 0 ? `${streak.current}-day streak` : "No active streak"}
          </p>
          <p className="text-xs text-fg-muted tnum">
            Longest {streak.longest} day{streak.longest === 1 ? "" : "s"}
            {streak.lastActiveKey ? ` · last active ${fmtDay(streak.lastActiveKey)}` : " · no activity recorded yet"}
          </p>
        </div>
      </div>
    </section>
  );
}
