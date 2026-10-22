import { Check, Flag } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import type { MilestoneProjection } from "@/lib/goals/calculator";
import { cn } from "@/lib/utils";
import { fmtDay } from "./format";

export function MilestoneLadder({ projections, completed, nextMilestone }: { projections: MilestoneProjection[]; completed: number; nextMilestone: number | null }) {
  const prevMilestone = [...projections].reverse().find((m) => m.achieved)?.milestone ?? 0;
  const span = nextMilestone ? nextMilestone - prevMilestone : 1;
  const into = nextMilestone ? completed - prevMilestone : 1;
  return (
    <section aria-labelledby="ladder-title" className="glass rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ladder-title" className="text-sm font-medium tracking-tight">
            Milestone ladder
          </h2>
          <p className="text-xs text-fg-muted mt-0.5">
            {nextMilestone ? `${formatNumber(completed)} applied this campaign · ${formatNumber(nextMilestone - completed)} to the next rung` : "Every milestone reached this campaign"}
          </p>
        </div>
        <Flag className="h-4 w-4 text-fg-subtle shrink-0" aria-hidden />
      </div>
      {nextMilestone && <ProgressBar value={into} max={span} className="mt-3" label={`Progress from ${prevMilestone} to ${nextMilestone}`} />}
      <ol className="mt-4 space-y-1.5" aria-label="Application milestones">
        {projections.map((m) => {
          const isNext = m.milestone === nextMilestone;
          return (
            <li
              key={m.milestone}
              aria-current={isNext ? "step" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-ctl px-3 py-2 text-sm",
                m.achieved && "bg-success-soft text-fg",
                isNext && "bg-accent-soft border border-accent/30",
                !m.achieved && !isNext && "text-fg-muted",
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    m.achieved ? "bg-success text-bg" : isNext ? "bg-accent text-accent-fg" : "bg-surface-strong text-fg-subtle",
                  )}
                  aria-hidden
                >
                  {m.achieved ? <Check className="h-3 w-3" /> : ""}
                </span>
                <span className="font-medium tnum">{formatNumber(m.milestone)}</span>
                <span className="text-xs text-fg-subtle">{m.achieved ? "achieved" : isNext ? "next" : ""}</span>
              </span>
              <span className="text-xs tnum text-right shrink-0">
                {m.achieved ? (
                  <span className="text-success">done</span>
                ) : m.projectedDate ? (
                  <>
                    <span className={m.withinCampaign ? "text-fg" : "text-fg-muted"}>~{fmtDay(m.projectedDate, true)}</span>
                    {m.withinCampaign === false && <span className="text-fg-subtle"> · after campaign</span>}
                  </>
                ) : (
                  <span className="text-fg-subtle">no pace yet</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-fg-subtle">Dates are a projection at your current observed pace, not a guarantee. They move as your pace does.</p>
    </section>
  );
}
