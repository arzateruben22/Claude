import { formatNumber, formatPercent } from "@/lib/format";
import type { ConversionRow } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  /** Column header for the dimension, e.g. "Source". */
  dimensionLabel: string;
  rows: ConversionRow[];
  /** Human label for a dimension value; null means the application had no value. */
  labelFor: (key: string | null) => string;
  emptyText: string;
  testId?: string;
};

/** Plain HTML conversion table (interview rate per dimension value, with 95% intervals). */
export function ConversionTable({ title, description, dimensionLabel, rows, labelFor, emptyText, testId }: Props) {
  const titleId = `${testId ?? title.replace(/\s+/g, "-").toLowerCase()}-title`;
  return (
    <section aria-labelledby={titleId} className="glass rounded-card p-5" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-sm font-medium tracking-tight">
          {title}
        </h2>
        <p className="text-xs text-fg-subtle">Observed</p>
      </div>
      {description && <p className="mt-1 text-xs text-fg-muted">{description}</p>}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">{emptyText}</p>
      ) : (
        <div className="mt-3 -mx-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-fg-muted border-b border-line">
                <th scope="col" className="px-5 py-2 font-medium">
                  {dimensionLabel}
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-right tnum">
                  Applied
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-right tnum">
                  Responded
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-right tnum">
                  Interviews
                </th>
                <th scope="col" className="px-2 py-2 font-medium text-right tnum">
                  Interview rate
                </th>
                <th scope="col" className="px-5 py-2 font-medium text-right tnum whitespace-nowrap">
                  95% interval
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key ?? "__none"} className={cn(r.applied === 0 && "text-fg-subtle")}>
                  <th scope="row" className="px-5 py-2 font-medium text-left max-w-56 truncate">
                    {labelFor(r.key)}
                    {r.total > r.applied && <span className="ml-1.5 text-[11px] font-normal text-fg-subtle">+{r.total - r.applied} saved</span>}
                  </th>
                  <td className="px-2 py-2 text-right tnum">{formatNumber(r.applied)}</td>
                  <td className="px-2 py-2 text-right tnum">{formatNumber(r.responded)}</td>
                  <td className="px-2 py-2 text-right tnum">{formatNumber(r.interviews)}</td>
                  <td className="px-2 py-2 text-right tnum">
                    {r.interviewRate === null ? "—" : formatPercent(r.interviewRate, 0)}
                    {r.lowSample && r.applied > 0 && (
                      <span className="ml-1 text-[11px] text-warning" title="Fewer than 10 applied; not a reliable rate">
                        low n
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right tnum text-fg-muted whitespace-nowrap">
                    {r.interval ? `${formatPercent(r.interval.low, 0)}–${formatPercent(r.interval.high, 0)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
