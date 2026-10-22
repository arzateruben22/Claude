import { ProgressBar } from "@/components/ui/progress";
import { STAT_DEFINITIONS, type DerivedStats, type StatInputs } from "@/lib/game/levels";

/** Derived 0–100 stats with the exact formula and the observed inputs behind each number. */
export function StatsPanel({ stats, inputs }: { stats: DerivedStats; inputs: StatInputs }) {
  return (
    <section aria-labelledby="stats-title" className="glass rounded-card p-5">
      <h2 id="stats-title" className="text-sm font-medium tracking-tight">
        Player stats
      </h2>
      <p className="mt-0.5 text-xs text-fg-muted">Calculated from your own records. They describe your activity, not your ability or job prospects.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {STAT_DEFINITIONS.map((d) => (
          <li key={d.key} data-testid={`stat-${d.key}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{d.label}</p>
              <p className="text-sm font-semibold tnum">
                {stats[d.key]}
                <span className="text-xs font-normal text-fg-subtle"> / 100</span>
              </p>
            </div>
            <ProgressBar value={stats[d.key]} max={100} tone="info" className="mt-1.5 h-1.5" label={`${d.label}: ${stats[d.key]} of 100`} />
            <p className="mt-1 text-[11px] text-fg-subtle">
              <span className="text-fg-muted">Formula:</span> {d.formula}
            </p>
            <p className="text-[11px] text-fg-subtle">
              <span className="text-fg-muted">Observed:</span> {d.explain(inputs)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
