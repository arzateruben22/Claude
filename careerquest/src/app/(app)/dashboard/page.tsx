import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getDashboardData } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { NextActionCard } from "@/components/dashboard/next-action-card";
import { CampaignTimelineCard } from "@/components/dashboard/campaign-timeline";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { FunnelStrip } from "@/components/dashboard/funnel-strip";
import { FollowUpsCard } from "@/components/dashboard/follow-ups-card";
import { InterviewsCard } from "@/components/dashboard/interviews-card";
import { XpStreakCard } from "@/components/dashboard/xp-streak-card";
import { MissionsCard } from "@/components/dashboard/missions-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { fmtLongDay } from "@/components/dashboard/format";

export const metadata = { title: "Command Center · CareerQuest" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/dashboard"), searchParams]);
  const data = await getDashboardData(user.id);
  const showWelcome = sp.welcome === "1" || !data.profile.onboardingComplete;

  return (
    <>
      <PageHeader
        eyebrow={data.campaign.eyebrow}
        title="Command Center"
        description={`${fmtLongDay(data.todayKey)} · ${data.timezone.replace(/_/g, " ")}`}
        actions={
          <Link href="/applications/new" className={buttonClasses("primary", "sm")}>
            <Plus className="h-4 w-4" aria-hidden />
            Log application
          </Link>
        }
      />
      <DashboardTabs />

      {showWelcome && <WelcomeCard name={data.userName} onboardingComplete={data.profile.onboardingComplete} />}

      <StatTiles data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 min-w-0">
          <NextActionCard action={data.nextAction} />
          <CampaignTimelineCard campaign={data.campaign} />
          <section aria-labelledby="activity-title" className="glass rounded-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="activity-title" className="text-sm font-medium tracking-tight">
                Applications · last 14 days
              </h2>
              <p className="text-xs text-fg-subtle">By the day each application was sent</p>
            </div>
            <div className="mt-3">
              <ActivityChart series={data.series} dailyTarget={data.today.target} />
            </div>
          </section>
          <FunnelStrip funnel={data.funnel} lowSample={data.rates.lowSample} />
        </div>
        <div className="space-y-4 min-w-0">
          <XpStreakCard xp={data.xp} streak={data.streak} />
          <FollowUpsCard overdue={data.followUps.overdue} dueToday={data.followUps.dueToday} capped={data.followUps.capped} />
          <InterviewsCard interviews={data.interviews} timezone={data.timezone} />
          <MissionsCard missions={data.missions} />
          <RecentActivity events={data.recent} />
        </div>
      </div>
    </>
  );
}
