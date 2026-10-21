import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { enumLabel } from "@/lib/format";
import type { MissionItem } from "@/lib/dashboard/types";

export function MissionsCard({ missions }: { missions: MissionItem[] }) {
  return (
    <section aria-labelledby="missions-title" className="glass rounded-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="missions-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-fg-subtle" aria-hidden />
          Today&apos;s missions
        </h2>
        {missions.length > 0 && (
          <Link href="/missions" className="text-xs text-accent hover:underline">
            All missions
          </Link>
        )}
      </div>
      {missions.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">Daily missions arrive in a later phase (game systems). Until then, your daily target above is the mission.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {missions.map((m) => (
            <li key={m.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{m.title}</p>
                <Badge tone="gold">+{m.xpReward} XP</Badge>
              </div>
              <p className="text-xs text-fg-muted">{m.description}</p>
              <ProgressBar value={m.progress} max={m.target} className="mt-1.5 h-1.5" label={`${m.title}: ${m.progress} of ${m.target}`} />
              <p className="mt-1 text-[11px] text-fg-subtle tnum">
                {m.progress} / {m.target} · {enumLabel(m.type)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
