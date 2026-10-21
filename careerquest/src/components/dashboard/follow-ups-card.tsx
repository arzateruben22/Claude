import Link from "next/link";
import { BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FollowUpItem } from "@/lib/dashboard/types";
import { fmtDay } from "./format";

const SHOW = 6;

function Row({ item }: { item: FollowUpItem }) {
  return (
    <li>
      <Link href={`/applications/${item.id}`} className="flex items-start justify-between gap-3 rounded-ctl px-2 py-2 -mx-2 hover:bg-surface-hover transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.companyName}</p>
          <p className="text-xs text-fg-muted truncate">{item.positionTitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge tone={item.overdue ? "danger" : "warning"}>{item.overdue ? `Overdue · ${fmtDay(item.dueKey)}` : "Due today"}</Badge>
          <StatusBadge status={item.status} />
        </div>
      </Link>
    </li>
  );
}

export function FollowUpsCard({ overdue, dueToday, capped }: { overdue: FollowUpItem[]; dueToday: FollowUpItem[]; capped: boolean }) {
  const all = [...overdue, ...dueToday];
  const shown = all.slice(0, SHOW);
  const hidden = all.length - shown.length;
  return (
    <section aria-labelledby="followups-title" className="glass rounded-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="followups-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
          <BellRing className="h-4 w-4 text-fg-subtle" aria-hidden />
          Follow-ups due
        </h2>
        <p className="text-xs text-fg-muted tnum" data-testid="followups-count">
          {overdue.length} overdue · {dueToday.length} today
        </p>
      </div>
      {all.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No follow-ups are due today. Set a follow-up date on an application to see it here.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line">
            {shown.map((f) => (
              <Row key={f.id} item={f} />
            ))}
          </ul>
          {(hidden > 0 || capped) && (
            <Link href="/applications" className="mt-2 inline-block text-xs text-accent hover:underline">
              {capped ? "View all in the tracker" : `${hidden} more in the tracker`}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
