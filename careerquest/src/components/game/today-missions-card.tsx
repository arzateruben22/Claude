import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, Flame, ListChecks, Moon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/current-user";
import { getTodayMissionsSummary } from "@/lib/game/queries";
import type { MissionView, TodayMissionsSummary } from "@/lib/game/views";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");

function Row({ m }: { m: MissionView }) {
  const done = m.status === "COMPLETED";
  return (
    <li className="min-w-0" data-testid="today-mission" data-status={m.status}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium min-w-0", done && "text-fg-muted")}>
          {done ? <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden /> : <CircleDashed className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
          <span className="truncate">{m.title}</span>
          <span className="sr-only">{done ? " (completed)" : " (in progress)"}</span>
        </p>
        <Badge tone={done ? "success" : "gold"} className="tnum">
          +{fmt(m.xpReward)} XP
        </Badge>
      </div>
      <ProgressBar value={m.progress} max={Math.max(1, m.target)} tone={done ? "success" : "accent"} className="mt-1.5 h-1.5" label={`${m.title}: ${m.progress} of ${m.target}`} />
      <p className="mt-1 text-[11px] text-fg-subtle tnum">
        {fmt(m.progress)} / {fmt(m.target)} · {m.type === "DAILY" ? "Today" : "This week"}
      </p>
    </li>
  );
}

/** Pure render of the dashboard missions card (used by TodayMissionsCard and tests). */
export function TodayMissionsCardView({ summary }: { summary: TodayMissionsSummary }) {
  const daily = summary.daily.filter((m) => m.status === "ACTIVE" || m.status === "COMPLETED");
  const weekly = summary.weekly.filter((m) => m.status === "ACTIVE");
  const rows = [...daily, ...weekly].slice(0, 5);
  return (
    <section aria-labelledby="today-missions-title" className="glass rounded-card p-5" data-testid="today-missions-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-missions-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-fg-subtle" aria-hidden />
          Today&apos;s missions
        </h2>
        <Link href="/missions" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          All missions
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted tnum">
        {summary.dailyTotal > 0 && (
          <span>
            {summary.dailyDone} of {summary.dailyTotal} daily done
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
          {summary.streak.current}-day streak
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
          {summary.todayXp > 0 ? `+${fmt(summary.todayXp)}` : fmt(summary.todayXp)} XP today
        </span>
      </div>
      {summary.restDay && (
        <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
          <Moon className="h-4 w-4 text-info" aria-hidden />
          Rest day — daily missions are paused.
        </p>
      )}
      {rows.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {rows.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        !summary.restDay && (
          <p className="mt-3 text-sm text-fg-muted">
            {summary.isWorkday ? "No open missions right now. Check the Campaign tab for longer goals." : "No daily missions on your days off. Weekly and campaign missions keep counting."}
          </p>
        )
      )}
    </section>
  );
}

/**
 * Dashboard card: today's daily missions plus open weekly ones. Server component; brings missions
 * up to date (recomputed from persisted data) before rendering.
 */
export async function TodayMissionsCard({ userId }: { userId?: string } = {}) {
  const id = userId ?? (await requireUser("/dashboard")).id;
  const summary = await getTodayMissionsSummary(id);
  return <TodayMissionsCardView summary={summary} />;
}

/** Re-exported for the dashboard integration (same function as `@/lib/game/queries`). */
export { getTodayMissionsSummary };
