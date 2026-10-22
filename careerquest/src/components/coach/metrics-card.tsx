import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BASIS_LABELS, type Metric } from "@/lib/coach/types";
import { formatPercent } from "@/lib/format";

/** Every metric the Advisor can cite, so nothing it says is a black box. */
export function MetricsCard({ metrics }: { metrics: Metric[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>The numbers the Advisor uses</CardTitle>
          <CardDescription>
            {metrics.length} metrics from your records. The Advisor (rules or Claude) may only cite these ids; anything else is dropped.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <details>
          <summary className="cursor-pointer text-sm text-accent hover:underline">Show all metrics</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <caption className="sr-only">Metrics available to the Advisor</caption>
              <thead className="text-fg-subtle">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Value</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Basis</th>
                  <th scope="col" className="py-2 font-medium">Id</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3 text-fg">
                      {m.href ? (
                        <Link href={m.href} className="hover:underline">
                          {m.label}
                        </Link>
                      ) : (
                        m.label
                      )}
                    </td>
                    <td className="py-2 pr-3 text-fg-muted tnum">
                      {m.display}
                      {m.interval && (
                        <span className="block text-fg-subtle">
                          95% interval {formatPercent(m.interval.low, 0)}–{formatPercent(m.interval.high, 0)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-fg-muted">{BASIS_LABELS[m.basis]}</td>
                    <td className="py-2 font-mono text-[10px] text-fg-subtle">{m.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
