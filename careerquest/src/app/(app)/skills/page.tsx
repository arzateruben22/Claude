import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { refreshSkills } from "@/lib/skills/service";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { StatTile } from "@/components/ui/stat-tile";
import { SkillTreeExplorer } from "@/components/skills/skill-tree";

export const metadata: Metadata = { title: "Skill Tree" };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/skills");
  const sp = await searchParams;
  const { skills, metrics, unlockedAt } = await refreshSkills(user.id);
  const total = skills.reduce((a, s) => a + s.level, 0);
  const max = skills.reduce((a, s) => a + s.maxLevel, 0);
  const started = skills.filter((s) => s.level > 0).length;
  const mastered = skills.filter((s) => s.level >= s.maxLevel).length;
  const requested = typeof sp.skill === "string" ? sp.skill : null;
  const closest = skills
    .filter((s) => !s.unavailable && s.level < s.maxLevel && s.progressToNext > 0)
    .sort((a, b) => b.progressToNext - a.progressToNext)[0];

  return (
    <>
      <PageHeader
        eyebrow="Skill tree"
        title="Skill Tree"
        description="Twelve skills across electrical study, field hours and the job search. Each level has explicit thresholds worked out from your own activity."
      />
      <div className="space-y-5">
        <Alert tone="info" title="Levels reflect activity in CareerQuest, not a credential">
          Skill levels count what you have done here — lessons and quiz scores, verified hours, applications, interviews and offers. They are not a
          license, certification or proof of competence, and self-reported hours never count.
        </Alert>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Skill levels earned" value={`${total} / ${max}`} hint="Sum of all skill levels" />
          <StatTile label="Skills started" value={`${started} / ${skills.length}`} hint="Level 1 or higher" />
          <StatTile label="Skills at max level" value={String(mastered)} hint="Level 5" tone={mastered ? "gold" : undefined} />
          <StatTile
            label="Closest to next level"
            value={closest ? `${Math.round(closest.progressToNext * 100)}%` : "—"}
            hint={closest ? `${closest.title} → level ${closest.level + 1}` : "Start any skill to see this"}
          />
        </div>
        {started === 0 && (
          <Alert tone="info" title="No skill levels yet">
            Complete a lesson in the <Link href="/academy" className="text-accent hover:underline">Academy</Link>, log an application in the{" "}
            <Link href="/applications/new" className="text-accent hover:underline">tracker</Link> or get your work hours verified to reach level 1.
          </Alert>
        )}
        <SkillTreeExplorer skills={skills} unlockedAt={unlockedAt} fieldGoal={metrics.fieldHoursGoal} initialKey={requested} />
      </div>
    </>
  );
}
