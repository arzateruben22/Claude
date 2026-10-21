import { FunnelBars, type FunnelStageDatum } from "@/components/charts/funnel-bars";
import { wilsonInterval } from "@/lib/analytics/stats";
import { FUNNEL_STAGE_KEYS, FUNNEL_STAGE_LABELS, type FunnelResult } from "@/lib/analytics/types";
import { formatNumber, formatPercent } from "@/lib/format";

/** Funnel chart + the same numbers as a table with 95% intervals (the table is the source of truth). */
export function FunnelCard({ funnel }: { funnel: FunnelResult }) {
  const { counts } = funnel;
  const stages: FunnelStageDatum[] = FUNNEL_STAGE_KEYS.map((key) => ({
    key,
    label: FUNNEL_STAGE_LABELS[key],
    count: counts[key],
    share: key === "applied" ? null : counts.applied > 0 ? counts[key] / counts.applied : null,
  }));
  return (
    <section aria-labelledby="funnel-title" className="glass rounded-card p-5" data-testid="funnel-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="funnel-title" className="text-sm font-medium tracking-tight">
          Pipeline funnel
        </h2>
        <p className="text-xs text-fg-subtle">Observed · from status history and logged events</p>
      </div>
      {counts.applied === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No applied applications in this slice, so there is no funnel to show. Stages appear once you apply.</p>
      ) : (
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <FunnelBars stages={stages} caption="Applications reaching each funnel stage" testId="funnel-bars" />
          <div className="overflow-x-auto -mx-5 lg:mx-0">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="text-left text-xs text-fg-muted border-b border-line">
                  <th scope="col" className="px-5 lg:px-2 py-2 font-medium">
                    Stage
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium text-right">
                    Count
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium text-right">
                    Of applied
                  </th>
                  <th scope="col" className="px-5 lg:px-2 py-2 font-medium text-right whitespace-nowrap">
                    95% interval
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stages.map((s) => {
                  const iv = s.key === "applied" ? null : wilsonInterval(s.count, counts.applied);
                  return (
                    <tr key={s.key} data-testid={`funnel-row-${s.key}`}>
                      <th scope="row" className="px-5 lg:px-2 py-2 font-medium text-left">
                        {s.label}
                      </th>
                      <td className="px-2 py-2 text-right tnum">{formatNumber(s.count)}</td>
                      <td className="px-2 py-2 text-right tnum">{s.share === null ? (s.key === "applied" ? "100%" : "—") : formatPercent(s.share, 0)}</td>
                      <td className="px-5 lg:px-2 py-2 text-right tnum text-fg-muted whitespace-nowrap">
                        {iv ? `${formatPercent(iv.low, 0)}–${formatPercent(iv.high, 0)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {funnel.lowSample && (
              <p className="mt-2 px-5 lg:px-0 text-xs text-warning">
                Fewer than 10 applied applications: these shares are observed counts, not reliable rates yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
