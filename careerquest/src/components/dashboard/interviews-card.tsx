import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/format";
import type { InterviewItem } from "@/lib/dashboard/types";
import { fmtDateTimeTz } from "./format";

export function InterviewsCard({ interviews, timezone }: { interviews: InterviewItem[]; timezone: string }) {
  return (
    <section aria-labelledby="interviews-title" className="glass rounded-card p-5">
      <h2 id="interviews-title" className="text-sm font-medium tracking-tight flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-fg-subtle" aria-hidden />
        Upcoming interviews
        <span className="text-xs font-normal text-fg-muted">next 7 days</span>
      </h2>
      {interviews.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">No interviews scheduled in the next 7 days.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {interviews.map((iv) => (
            <li key={iv.id}>
              <Link href={`/applications/${iv.applicationId}`} className="flex items-start justify-between gap-3 rounded-ctl px-2 py-2 -mx-2 hover:bg-surface-hover transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{iv.companyName}</p>
                  <p className="text-xs text-fg-muted truncate">{iv.positionTitle}</p>
                  <p className="text-xs text-fg tnum mt-0.5">
                    <time dateTime={iv.scheduledAt.toISOString()}>{fmtDateTimeTz(iv.scheduledAt, timezone)}</time>
                    {iv.location ? <span className="text-fg-subtle"> · {iv.location}</span> : null}
                  </p>
                </div>
                <Badge tone="accent">{enumLabel(iv.type)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
