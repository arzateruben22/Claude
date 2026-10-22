import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, Clock } from "lucide-react";
import type { StepState, TimelineStep } from "@/lib/academy/certification/timeline";
import type { RequirementView } from "@/lib/academy/certification/requirements";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDayKey } from "./format";

const STATE_META: Record<StepState, { label: string; tone: "success" | "info" | "neutral" | "warning" | "danger"; Icon: typeof Circle }> = {
  done: { label: "Done", tone: "success", Icon: CheckCircle2 },
  scheduled: { label: "Upcoming", tone: "info", Icon: CalendarClock },
  pending: { label: "Not yet", tone: "neutral", Icon: Circle },
  "due-soon": { label: "Due soon", tone: "warning", Icon: Clock },
  overdue: { label: "Overdue", tone: "danger", Icon: AlertTriangle },
};

/** The self-reported certification path as an ordered timeline. */
export function CertificationTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5" aria-label="Certification timeline">
      {steps.map((s) => {
        const meta = STATE_META[s.state];
        return (
          <li key={s.key} className="relative" data-testid={`step-${s.key}`}>
            <span
              className={cn(
                "absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg",
                s.state === "done" ? "text-success" : s.state === "overdue" ? "text-danger" : s.state === "due-soon" ? "text-warning" : s.state === "scheduled" ? "text-info" : "text-fg-subtle",
              )}
              aria-hidden
            >
              <meta.Icon className="h-4 w-4" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{s.title}</p>
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {s.estimated && <Badge tone="info">Estimate</Badge>}
            </div>
            {s.dateKey && <p className="mt-0.5 text-sm tnum text-fg">{formatDayKey(s.dateKey)}</p>}
            <p className="mt-0.5 text-xs text-fg-muted">{s.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Classification switcher (URL state). */
export function ClassificationTabs({ requirements, current, tracked }: { requirements: RequirementView[]; current: string; tracked: string[] }) {
  if (requirements.length <= 1) return null;
  return (
    <nav aria-label="Certification classification" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {requirements.map((r) => {
        const active = r.code === current;
        return (
          <Link
            key={r.code}
            href={r.code === "GENERAL" ? "/academy/certification" : `/academy/certification?c=${r.code}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
              active ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-muted hover:bg-surface-hover hover:text-fg",
            )}
          >
            {r.name}
            {tracked.includes(r.code) && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                <span className="sr-only"> (has your dates)</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
