import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getCampaignPageData } from "@/lib/game/queries";
import { formatCurrency } from "@/lib/format";
import { CampaignTimelineView } from "@/components/game/campaign-timeline";
import { MissionList } from "@/components/game/mission-card";
import { EmploymentCard } from "@/components/game/employment-card";
import { PaycheckCard } from "@/components/game/paycheck-card";
import { NextPhasePlanForm } from "@/components/game/next-phase-plan";
import { ElectricianPathCard } from "@/components/game/electrician-path-card";
import { formatDayKey } from "@/components/game/format";

export const metadata = { title: "Campaign" };

export default async function MissionsCampaignPage() {
  const user = await requireUser("/missions/campaign");
  const data = await getCampaignPageData(user.id);
  const hired = data.status === "COMPLETED";
  const current = data.phases.find((p) => p.state === "current") ?? null;
  const currentMissions = current?.missions ?? data.extension?.missions ?? [];
  const showPlan = !hired && (data.timeline.beyond || data.timeline.phase === 3 || data.nextPhasePlan !== null);
  const daysPast = Math.max(0, data.timeline.day - data.timeline.lengthDays);

  return (
    <div className="space-y-4">
      <CampaignTimelineView timeline={data.timeline} phases={data.phases} hired={hired} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 min-w-0">
          {!hired && (current || data.extension) && (
            <section aria-labelledby="phase-missions-title" className="glass rounded-card p-5">
              <h2 id="phase-missions-title" className="text-sm font-medium tracking-tight">
                {current
                  ? `Phase ${current.index} missions · ${formatDayKey(current.startKey)} – ${formatDayKey(current.endKey)}`
                  : `Next-phase missions · ${formatDayKey(data.extension!.startKey)} – ${formatDayKey(data.extension!.endKey)}`}
              </h2>
              <p className="mt-0.5 text-xs text-fg-subtle">
                Campaign missions complete from your records. Unfinished ones expire at the end of the phase with no penalty.
              </p>
              <div className="mt-4">
                <MissionList missions={currentMissions} timezone={data.timezone} empty="No missions for this phase yet." />
              </div>
            </section>
          )}

          {hired && (
            <section aria-labelledby="hired-title" className="glass rounded-card p-5">
              <h2 id="hired-title" className="text-sm font-medium tracking-tight">
                Operation Get Hired is complete
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                You reported accepting a job{data.employment ? ` at ${data.employment.employer}` : ""}. Job-search missions are paused. The $150K Electrician
                Path below keeps running: training hours, apprenticeship steps and certification milestones still count.
              </p>
            </section>
          )}

          {showPlan && (
            <NextPhasePlanForm plan={data.nextPhasePlan} timezone={data.timezone} beyond={data.timeline.beyond} daysPast={daysPast} />
          )}

          <ElectricianPathCard
            missions={data.electrician.missions}
            verifiedHours={data.electrician.verifiedHours}
            selfReportedHours={data.electrician.selfReportedHours}
            longTermSalaryTarget={data.electrician.longTermSalaryTarget}
            timezone={data.timezone}
          />
        </div>

        <div className="space-y-4 min-w-0">
          <EmploymentCard employment={hired ? data.employment : null} hired={hired} todayKey={data.todayKey} />
          <PaycheckCard paychecks={data.paychecks} paycheckCount={data.paycheckCount} careerEarnings={data.careerEarnings} todayKey={data.todayKey} />
          <section aria-labelledby="targets-title" className="glass rounded-card p-5">
            <h2 id="targets-title" className="text-sm font-medium tracking-tight">
              Your salary targets
            </h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-fg-muted">Immediate</dt>
                <dd className="tnum">{formatCurrency(data.immediateSalaryTarget)}/yr</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-fg-muted">Long term</dt>
                <dd className="tnum">{formatCurrency(data.electrician.longTermSalaryTarget)}/yr</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-fg-muted">Current (self-reported)</dt>
                <dd className="tnum">{data.currentSalary !== null ? `${formatCurrency(data.currentSalary)}/yr` : "Not reported"}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-fg-subtle">Targets are goals you set, not predictions. Change them in Settings.</p>
            <Link href="/settings/campaign" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Campaign settings
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
