import Link from "next/link";
import { BellRing } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { dayLabel } from "@/lib/analytics/time";
import { cn } from "@/lib/utils";

type Props = { overdue: number; dueToday: number; laterThisWeek: number; weekEndKey: string };

/** Follow-up workload for the current week (active applications in the filtered slice). */
export function FollowUpCard({ overdue, dueToday, laterThisWeek, weekEndKey }: Props) {
  const total = overdue + dueToday + laterThisWeek;
  const cells: { label: string; value: number; cls?: string }[] = [
    { label: "Overdue", value: overdue, cls: overdue > 0 ? "text-danger" : undefined },
    { label: "Due today", value: dueToday, cls: dueToday > 0 ? "text-warning" : undefined },
    { label: `Later this week`, value: laterThisWeek },
  ];
  return (
    <section aria-labelledby="followup-workload-title" className="glass rounded-card p-5" data-testid="followup-workload">
      <div className="flex items-center justify-between gap-3">
        <h2 id="followup-workload-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <BellRing className="h-4 w-4 text-fg-subtle" aria-hidden />
          Follow-up workload
        </h2>
        <p className="text-xs text-fg-subtle">Through {dayLabel(weekEndKey)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-ctl bg-surface-strong px-3 py-2.5 min-w-0">
            <dt className="text-[11px] text-fg-muted truncate">{c.label}</dt>
            <dd className={cn("text-xl font-semibold tnum", c.value === 0 ? "text-fg-subtle" : c.cls ?? "text-fg")}>{formatNumber(c.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-fg-muted" data-testid="followup-workload-summary">
        {total === 0
          ? "No follow-ups are due this week for active applications in this slice. Set a follow-up date on an application to plan one."
          : `${formatNumber(total)} follow-up${total === 1 ? "" : "s"} to work through this week.`}
      </p>
      {total > 0 && (
        <Link href="/applications" className="mt-2 inline-block text-xs text-accent hover:underline">
          Open the tracker
        </Link>
      )}
    </section>
  );
}
