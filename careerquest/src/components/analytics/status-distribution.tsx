import { StatusBadge } from "@/components/ui/status-badge";
import { formatNumber, formatPercent } from "@/lib/format";
import type { StatusCount } from "@/lib/analytics/queries";

/** Current status of every application in the slice, as plain HTML bars (single hue: magnitude). */
export function StatusDistribution({ rows, total }: { rows: StatusCount[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section aria-labelledby="status-dist-title" className="glass rounded-card p-5" data-testid="status-distribution">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="status-dist-title" className="text-sm font-medium tracking-tight">
          Current status
        </h2>
        <p className="text-xs text-fg-subtle">Observed · {formatNumber(total)} total</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No applications in this slice.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.status} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-sm">
              <StatusBadge status={r.status} />
              <div className="h-2 rounded-full bg-surface-strong overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
              <span className="text-fg-muted tnum text-xs whitespace-nowrap">
                {formatNumber(r.count)} <span className="text-fg-subtle">· {formatPercent(total > 0 ? r.count / total : 0, 0)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
