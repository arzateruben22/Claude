import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReportWeekListItem } from "@/lib/reports/types";
import { generatedAtText } from "./report-view";

export function WeekList({ weeks, timeZone }: { weeks: ReportWeekListItem[]; timeZone: string }) {
  return (
    <ul className="divide-y divide-line" data-testid="report-weeks">
      {weeks.map((w) => (
        <li key={w.weekStart}>
          <Link
            href={`/analytics/reports/${w.weekStart}`}
            className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-surface-hover rounded-ctl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                {w.label}
                {w.isCurrent && <Badge tone="accent">This week</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle">
                {w.stored
                  ? `${w.stored.applied !== null ? `${w.stored.applied} application${w.stored.applied === 1 ? "" : "s"} · ` : ""}${
                      w.isCurrent ? "Updates when opened" : w.stored.complete ? "Saved (frozen)" : "Saved mid-week (incomplete)"
                    } · generated ${generatedAtText(w.stored.generatedAt, timeZone)}`
                  : w.isCurrent
                    ? "Not generated yet; opening it generates it"
                    : "Not generated yet; opening it saves a frozen snapshot"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
