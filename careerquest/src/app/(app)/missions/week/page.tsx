import { requireUser } from "@/lib/auth/current-user";
import { getWeekPageData } from "@/lib/game/queries";
import { StatTile } from "@/components/ui/stat-tile";
import { MissionList } from "@/components/game/mission-card";
import { WeekStrip } from "@/components/game/week-strip";
import { formatDayKey } from "@/components/game/format";

export const metadata = { title: "This week's missions" };

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function MissionsWeekPage() {
  const user = await requireUser("/missions/week");
  const data = await getWeekPageData(user.id);
  const done = data.missions.filter((m) => m.status === "COMPLETED").length;
  const counted = data.missions.filter((m) => m.status !== "SKIPPED").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Applications this week" value={fmt(data.totals.applications)} hint="Logged Monday–Sunday" />
        <StatTile label="Follow-ups this week" value={fmt(data.totals.followUps)} />
        <StatTile label="Active days" value={`${data.totals.activeDays} / 7`} hint={data.totals.restDays ? `${data.totals.restDays} rest ${data.totals.restDays === 1 ? "day" : "days"}` : undefined} />
        <StatTile label="XP this week" value={fmt(data.totals.xp)} tone="gold" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section aria-labelledby="weekly-title" className="glass rounded-card p-5 lg:col-span-3 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="weekly-title" className="text-sm font-medium tracking-tight">
              Weekly missions · {formatDayKey(data.weekStartKey)} – {formatDayKey(data.weekEndKey, true)}
            </h2>
            {counted > 0 && (
              <p className="text-xs text-fg-muted tnum">
                {done} of {counted} done
              </p>
            )}
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">Weeks run Monday to Sunday. Rest days lower the weekly application target by your daily target.</p>
          <div className="mt-4">
            <MissionList missions={data.missions} timezone={data.timezone} empty="No weekly missions yet this week." />
          </div>
        </section>
        <div className="lg:col-span-2 min-w-0">
          <WeekStrip days={data.days} />
        </div>
      </div>
    </div>
  );
}
