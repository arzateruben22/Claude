import { CalendarDays, Mic, Send, Target } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { formatNumber, formatPercent } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard/types";

export function StatTiles({ data }: { data: DashboardData }) {
  const { today, week, totals, rates } = data;
  const todayDone = today.target > 0 && today.submitted >= today.target;
  const weekDone = week.target > 0 && week.submitted >= week.target;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-5" role="list" aria-label="Today's numbers">
      <div role="listitem">
        <StatTile
          label="Today"
          value={
            <>
              {formatNumber(today.submitted)}
              <span className="text-fg-subtle text-base font-normal"> / {formatNumber(today.target)}</span>
            </>
          }
          hint={today.target === 0 ? "No daily target set" : todayDone ? "Daily target met" : `${today.target - today.submitted} to go`}
          icon={<Target className="h-4 w-4" aria-hidden />}
          tone={todayDone ? "success" : undefined}
        />
      </div>
      <div role="listitem">
        <StatTile
          label="This week"
          value={
            <>
              {formatNumber(week.submitted)}
              <span className="text-fg-subtle text-base font-normal"> / {formatNumber(week.target)}</span>
            </>
          }
          hint={week.activeDays === 0 ? "No applications this week yet" : `${week.activeDays} active day${week.activeDays === 1 ? "" : "s"}`}
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          tone={weekDone ? "success" : undefined}
        />
      </div>
      <div role="listitem">
        <StatTile
          label="Total submitted"
          value={formatNumber(totals.submitted)}
          hint={totals.applications > totals.submitted ? `${totals.applications - totals.submitted} saved, not yet submitted` : "All-time, excluding archived"}
          icon={<Send className="h-4 w-4" aria-hidden />}
        />
      </div>
      <div role="listitem">
        <StatTile
          label="Interview rate"
          value={rates.interview === null ? "—" : formatPercent(rates.interview, 0)}
          hint={rates.n === 0 ? "No submitted applications yet" : `n = ${formatNumber(rates.n)} submitted`}
          icon={<Mic className="h-4 w-4" aria-hidden />}
          tone={rates.interview !== null && rates.interview > 0 ? "accent" : undefined}
        />
      </div>
    </div>
  );
}
