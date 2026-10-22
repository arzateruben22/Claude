import { Briefcase, Trophy, Zap } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import type { LevelTrack, LevelTrackKey } from "@/lib/game/levels";

const ICONS: Record<LevelTrackKey, typeof Trophy> = { CAREER: Trophy, JOB_HUNTER: Briefcase, ELECTRICIAN: Zap };
const fmt = (n: number) => n.toLocaleString("en-US");

/** Career / Job Hunter / Electrician levels from the XP ledger totals. */
export function LevelCards({ levels }: { levels: LevelTrack[] }) {
  return (
    <section aria-labelledby="levels-title" className="glass rounded-card p-5">
      <h2 id="levels-title" className="text-sm font-medium tracking-tight">
        Levels
      </h2>
      <ul className="mt-3 grid gap-4">
        {levels.map((l) => {
          const Icon = ICONS[l.key];
          const into = Math.max(0, l.xp - l.current);
          const span = Math.max(1, l.next - l.current);
          return (
            <li key={l.key} data-testid={`level-${l.key.toLowerCase()}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-gold" aria-hidden />
                  {l.label}
                </p>
                <p className="text-sm font-semibold text-gold tnum">Lv {l.level}</p>
              </div>
              <ProgressBar value={l.progress} max={1} tone="gold" className="mt-2 h-1.5" label={`${l.label} progress to level ${l.level + 1}`} />
              <p className="mt-1 text-[11px] text-fg-subtle tnum">
                {fmt(l.xp)} XP · {fmt(into)} / {fmt(span)} to level {l.level + 1}
              </p>
              <p className="text-[11px] text-fg-subtle">{l.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
