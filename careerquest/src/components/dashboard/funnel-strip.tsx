import { formatNumber, formatPercent } from "@/lib/format";
import type { FunnelCounts } from "@/lib/dashboard/funnel";
import { cn } from "@/lib/utils";

const STAGES: { key: keyof FunnelCounts; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "responses", label: "Responses" },
  { key: "screenings", label: "Screenings" },
  { key: "interviews", label: "Interviews" },
  { key: "offers", label: "Offers" },
  { key: "hires", label: "Hired" },
];

export function FunnelStrip({ funnel }: { funnel: FunnelCounts }) {
  return (
    <section aria-labelledby="funnel-title" className="glass rounded-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="funnel-title" className="text-sm font-medium tracking-tight">
          Pipeline funnel
        </h2>
        <p className="text-xs text-fg-subtle">Derived from status history and logged events</p>
      </div>
      {funnel.submitted === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No submitted applications yet, so there is no funnel to show. Conversion rates appear once you submit.</p>
      ) : (
        <ol className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2" aria-label="Funnel stages">
          {STAGES.map((s, i) => {
            const count = funnel[s.key];
            const prev = i === 0 ? null : funnel[STAGES[i - 1]!.key];
            const conv = prev === null ? null : prev > 0 ? count / prev : null;
            const ofSubmitted = i === 0 ? null : funnel.submitted > 0 ? count / funnel.submitted : null;
            return (
              <li
                key={s.key}
                data-testid={`funnel-stage-${s.key}`}
                className={cn("rounded-ctl bg-surface-strong px-3 py-2.5 min-w-0", count > 0 && i > 0 && "border border-accent/20")}
              >
                <p className="text-[11px] text-fg-muted truncate">{s.label}</p>
                <p data-testid="funnel-stage-count" className={cn("text-xl font-semibold tnum", count > 0 ? "text-fg" : "text-fg-subtle")}>
                  {formatNumber(count)}
                </p>
                <p className="text-[11px] text-fg-subtle tnum">
                  {i === 0 ? "100%" : ofSubmitted === null ? "—" : `${formatPercent(ofSubmitted, 0)} of submitted`}
                  {conv !== null && i > 1 && prev! > 0 ? ` · ${formatPercent(conv, 0)} step` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
