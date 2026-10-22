import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getTodayPageData } from "@/lib/game/queries";
import { MissionList } from "@/components/game/mission-card";
import { TodayStatusCard } from "@/components/game/today-status-card";
import { LevelCards } from "@/components/game/level-cards";
import { formatLongDayKey } from "@/components/game/format";

export const metadata = { title: "Today's missions" };

export default async function MissionsTodayPage() {
  const user = await requireUser("/missions");
  const { summary, levels, campaign, missionsCompleted } = await getTodayPageData(user.id);
  const openWeekly = summary.weekly.filter((m) => m.status === "ACTIVE");

  let emptyDaily: string;
  if (summary.restDay) emptyDaily = "Rest day. No daily expectations today — enjoy it.";
  else if (!summary.isWorkday) emptyDaily = "Today isn't one of your planned workdays, so there are no daily missions. Anything you do still counts toward weekly and campaign missions.";
  else if (summary.hired) emptyDaily = "You reported accepting a job, so job-search dailies are paused. Academy and training missions appear here when they apply.";
  else emptyDaily = "No daily missions right now.";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2 min-w-0">
        <section aria-labelledby="daily-title" className="glass rounded-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="daily-title" className="text-sm font-medium tracking-tight">
              Daily missions · {formatLongDayKey(summary.todayKey)}
            </h2>
            {summary.dailyTotal > 0 && (
              <p className="text-xs text-fg-muted tnum" data-testid="daily-done">
                {summary.dailyDone} of {summary.dailyTotal} done
              </p>
            )}
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Progress is recalculated from your records each time you open this page. Missions never cost XP; unfinished ones simply expire.
          </p>
          <div className="mt-4">
            <MissionList missions={summary.daily} timezone={summary.timezone} empty={emptyDaily} />
          </div>
        </section>

        <section aria-labelledby="week-open-title" className="glass rounded-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="week-open-title" className="text-sm font-medium tracking-tight">
              Still open this week
            </h2>
            <Link href="/missions/week" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              This week
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="mt-4">
            <MissionList
              missions={openWeekly}
              timezone={summary.timezone}
              empty={summary.weekly.length > 0 ? "Every weekly mission is done. Nice week." : "No weekly missions yet."}
            />
          </div>
        </section>
      </div>

      <div className="space-y-4 min-w-0">
        <TodayStatusCard summary={summary} />
        <LevelCards levels={levels} />
        <section aria-labelledby="campaign-mini-title" className="glass rounded-card p-5">
          <h2 id="campaign-mini-title" className="text-sm font-medium tracking-tight">
            Operation Get Hired
          </h2>
          <p className="mt-1 text-sm text-fg-muted tnum">{campaign.eyebrow}</p>
          <p className="mt-1 text-xs text-fg-subtle tnum">
            {missionsCompleted} {missionsCompleted === 1 ? "mission" : "missions"} completed in total
          </p>
          <Link href="/missions/campaign" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Campaign timeline and the $150K Electrician Path
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
