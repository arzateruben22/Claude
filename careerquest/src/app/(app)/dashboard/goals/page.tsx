import { Gauge, Target, TrendingUp, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getGoalsData } from "@/lib/dashboard/queries";
import { formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { MilestoneLadder } from "@/components/dashboard/milestone-ladder";
import { SuggestionsCard } from "@/components/dashboard/suggestions-card";
import { GoalsCalculator } from "@/components/dashboard/goals-calculator";
import { fmtDay, perDay } from "@/components/dashboard/format";

export const metadata = { title: "Numbers game · CareerQuest" };

export default async function GoalsPage() {
  const user = await requireUser("/dashboard/goals");
  const g = await getGoalsData(user.id);
  const { pace, campaign, profile } = g;

  return (
    <>
      <PageHeader
        eyebrow={campaign.eyebrow}
        title="Numbers game"
        description="A job search is a numbers game: set a pace you can sustain, watch the observed rate, and adjust from real results rather than hope."
      />
      <DashboardTabs />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-4">
        <StatTile
          label="Applied this campaign"
          value={formatNumber(g.completed)}
          hint={`since ${fmtDay(g.campaignStartKey, true)} · ${formatNumber(g.completedAllTime)} all-time`}
          icon={<Trophy className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Campaign goal"
          value={formatNumber(pace.campaignGoalApplications)}
          hint={`${profile.dailyApplicationTarget}/day × ${profile.workdaysPerWeek} days × ${(profile.campaignLengthDays / 7).toFixed(1)} wks`}
          icon={<Target className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Required pace"
          value={pace.requiredDailyPace === null ? "—" : perDay(pace.requiredDailyPace)}
          hint={pace.requiredDailyPace === null ? "campaign window passed" : `${pace.daysRemaining} days left`}
          icon={<Gauge className="h-4 w-4" aria-hidden />}
          tone={pace.requiredDailyPace !== null && pace.requiredDailyPace > profile.dailyApplicationTarget ? "warning" : undefined}
        />
        <StatTile
          label="Observed pace"
          value={perDay(pace.observedDailyPace)}
          hint={pace.consistency === null ? "no activity yet" : `applied on ${formatPercent(pace.consistency, 0)} of workdays`}
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          tone={pace.onTrack ? "success" : "warning"}
        />
      </div>

      <section aria-label="Campaign goal progress" className="glass rounded-card p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium tnum">{formatNumber(g.completed)}</span>
            <span className="text-fg-muted"> of </span>
            <span className="font-medium tnum">{formatNumber(pace.campaignGoalApplications)}</span>
            <span className="text-fg-muted"> campaign goal · {formatPercent(pace.progressRatio, 0)}</span>
          </p>
          <Badge tone={pace.onTrack ? "success" : "warning"} data-testid="on-track">
            {pace.beyondCampaign ? (pace.onTrack ? "Goal reached" : "Campaign ended short of goal") : pace.onTrack ? "On track" : `Behind by ${formatNumber(Math.max(0, pace.expectedByToday - g.completed))}`}
          </Badge>
        </div>
        <ProgressBar value={pace.progressRatio} max={1} className="mt-3" tone={pace.onTrack ? "success" : "warning"} label="Campaign goal progress" />
        <p className="mt-2 text-xs text-fg-muted tnum">
          Expected by today at your target: {formatNumber(pace.expectedByToday)}.
          {pace.projectedGoalDate
            ? ` At your observed pace you would reach the goal around ${fmtDay(pace.projectedGoalDate, true)} (projection, not a guarantee).`
            : pace.remainingToGoal === 0
              ? " Goal reached."
              : " No observed pace yet, so no projection."}
          {g.responseRate !== null &&
            ` Observed response rate: ${formatPercent(g.responseRate, 1)} over ${formatNumber(g.completed)} application${g.completed === 1 ? "" : "s"} this campaign${g.completed < 10 ? " (low sample, not reliable yet)" : ""}.`}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div className="lg:col-span-1 min-w-0">
          <MilestoneLadder projections={pace.projectedMilestoneDates} completed={g.completed} nextMilestone={pace.nextMilestone} />
        </div>
        <div className="lg:col-span-2 min-w-0 space-y-4">
          <SuggestionsCard suggestions={g.suggestions} dataRequirements={g.dataRequirements} />
          <GoalsCalculator
            defaults={{
              dailyTarget: profile.dailyApplicationTarget,
              workdaysPerWeek: profile.workdaysPerWeek,
              campaignLengthDays: profile.campaignLengthDays,
              completed: g.completed,
              responseRatePct: g.responseRate === null ? null : g.responseRate * 100,
            }}
            todayKey={g.todayKey}
            campaignStartKey={g.campaignStartKey}
          />
        </div>
      </div>
    </>
  );
}
