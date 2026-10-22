import { AlertTriangle } from "lucide-react";
import type { CapEstimate } from "@/lib/academy/hours/caps";
import { WORK_TYPE_LABELS } from "@/lib/academy/hours/constants";
import { Badge } from "@/components/ui/badge";
import { formatHours, formatHoursNumber } from "./format";

export const CAPS_ESTIMATE_LABEL = "Estimate — DIR decides eligibility";

/**
 * Per-area caps for the General Electrician classification: what is logged in each area, the cap,
 * and how much of it an estimate would count. Verified and all-logged columns stay separate.
 */
export function CapsTable({ verified, logged, capsFromSeed }: { verified: CapEstimate; logged: CapEstimate; capsFromSeed: boolean }) {
  const allByArea = new Map(logged.rows.map((r) => [r.area, r]));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{CAPS_ESTIMATE_LABEL}</Badge>
        <span className="text-xs text-fg-muted">
          {capsFromSeed ? "Caps from the seeded DIR requirement notes (8 CCR 291.1)." : "Caps from 8 CCR 291.1 defaults; the seeded notes did not list them."}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-ctl border border-success/30 bg-success-soft p-3">
          <p className="text-xs text-fg-muted">Estimated countable — verified</p>
          <p className="mt-1 text-xl font-semibold tnum text-success" data-testid="countable-verified">
            {formatHours(verified.countable)}
          </p>
          <p className="text-[11px] text-fg-subtle tnum">of {formatHours(verified.logged)} verified</p>
        </div>
        <div className="rounded-ctl border border-line p-3">
          <p className="text-xs text-fg-muted">Estimated countable — all logged</p>
          <p className="mt-1 text-xl font-semibold tnum" data-testid="countable-all">
            {formatHours(logged.countable)}
          </p>
          <p className="text-[11px] text-fg-subtle tnum">includes self-reported</p>
        </div>
      </div>
      {logged.logged > 0 && !logged.meetsTwoAreaRule && (
        <p className="flex items-start gap-2 rounded-ctl border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          DIR requires General Electrician hours in two or more listed work areas. Your hours so far are in{" "}
          {logged.areasWithHours === 0 ? "no listed area" : "one area"}.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Hours by DIR work area with per-area caps (estimate)</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">
                Work area
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Cap
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Verified
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Countable (verified)
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                All logged
              </th>
            </tr>
          </thead>
          <tbody>
            {verified.rows.map((r) => {
              const all = allByArea.get(r.area);
              return (
                <tr key={r.area} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {r.label}
                  </th>
                  <td className="py-2 pr-3 text-right tnum text-fg-muted">{formatHoursNumber(r.cap)}</td>
                  <td className="py-2 pr-3 text-right tnum">{formatHoursNumber(r.logged)}</td>
                  <td className="py-2 pr-3 text-right tnum">
                    {formatHoursNumber(r.countable)}
                    {r.excess > 0 && <span className="ml-1 text-xs text-warning">(+{formatHoursNumber(r.excess)} over cap)</span>}
                  </td>
                  <td className="py-2 text-right tnum text-fg-muted">{formatHoursNumber(all?.logged ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {logged.unmapped.length > 0 && (
        <div className="text-xs text-fg-muted">
          <p className="font-medium text-fg">Not counted in this estimate</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {logged.unmapped.map((u) => (
              <li key={u.workType}>
                {WORK_TYPE_LABELS[u.workType]}: {formatHours(u.hours)} — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-fg-subtle">
        Lighting work is counted under &ldquo;finish work &amp; fixtures&rdquo; (the stricter cap). Underground conduit and stock-room hours have no
        work type in the log yet, so log them as &ldquo;Other&rdquo;; they are not estimated. Only DIR decides which hours count.
      </p>
    </div>
  );
}
