import { requireUser } from "@/lib/auth/current-user";
import { getAchievementsPageData } from "@/lib/game/queries";
import { StatTile } from "@/components/ui/stat-tile";
import { AchievementGrid } from "@/components/game/achievement-grid";
import { LevelCards } from "@/components/game/level-cards";
import { StatsPanel } from "@/components/game/stats-panel";

export const metadata = { title: "Achievements" };

export default async function MissionsAchievementsPage() {
  const user = await requireUser("/missions/achievements");
  const data = await getAchievementsPageData(user.id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Achievements" value={`${data.unlockedCount} / ${data.total}`} tone="gold" />
        <StatTile label="Missions completed" value={data.missionsCompleted.toLocaleString("en-US")} />
        <StatTile label="Current streak" value={`${data.streak.current}`} hint="Workdays in a row" />
        <StatTile label="Longest streak" value={`${data.streak.longest}`} hint="Workdays" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <AchievementGrid cards={data.cards} timezone={data.timezone} />
        </div>
        <div className="space-y-4 min-w-0">
          <LevelCards levels={data.levels} />
          <StatsPanel stats={data.stats} inputs={data.statInputs} />
        </div>
      </div>
    </div>
  );
}
