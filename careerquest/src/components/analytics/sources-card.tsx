import { DonutBreakdown } from "@/components/charts/donut-breakdown";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { SourceCount } from "@/lib/analytics/queries";

/** Where applications in the slice came from (job boards, company sites, referrals...). */
export function SourcesCard({ rows }: { rows: SourceCount[] }) {
  const data = rows.map((r) => ({ key: r.source, label: SOURCE_LABELS[r.source], value: r.count }));
  return (
    <section aria-labelledby="sources-title" className="glass rounded-card p-5" data-testid="sources-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="sources-title" className="text-sm font-medium tracking-tight">
          Applications by source
        </h2>
        <p className="text-xs text-fg-subtle">Observed</p>
      </div>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No applications in this slice.</p>
      ) : (
        <div className="mt-3">
          <DonutBreakdown data={data} caption="Applications by source" centerLabel="applications" testId="sources-donut" />
        </div>
      )}
    </section>
  );
}
