import Link from "next/link";
import { CheckCircle2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { enumLabel, formatRelative } from "@/lib/format";
import type { RecentEvent } from "@/lib/dashboard/types";

export function RecentActivity({ events }: { events: RecentEvent[] }) {
  return (
    <section aria-labelledby="recent-title" className="glass rounded-card p-5">
      <h2 id="recent-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
        <History className="h-4 w-4 text-fg-subtle" aria-hidden />
        Recent activity
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No activity recorded yet. Events appear here as you log applications and status changes.</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-fg-muted"> · </span>
                  <Link href={`/applications/${e.applicationId}`} className="text-fg-muted hover:text-fg hover:underline">
                    {e.companyName}
                  </Link>
                </p>
                <p className="text-xs text-fg-subtle flex items-center gap-1.5 flex-wrap">
                  <time dateTime={e.occurredAt.toISOString()}>{formatRelative(e.occurredAt)}</time>
                  {e.source !== "USER" && <Badge tone="neutral">{enumLabel(e.source)}</Badge>}
                  {e.verified && e.source !== "USER" && (
                    <span className="inline-flex items-center gap-0.5 text-success">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> verified
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
