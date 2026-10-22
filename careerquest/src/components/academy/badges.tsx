import { CheckCircle2, CircleDashed, FlaskConical, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LESSON_STATE_LABELS, type LessonState } from "@/lib/academy/progress";
import { SIMULATION_NOTICE } from "@/lib/academy/workshop";
import { cn } from "@/lib/utils";

export function LessonStateBadge({ state, className }: { state: LessonState; className?: string }) {
  const Icon = { LOCKED: Lock, NOT_STARTED: CircleDashed, IN_PROGRESS: PlayCircle, COMPLETED: CheckCircle2 }[state];
  const tone = ({ LOCKED: "neutral", NOT_STARTED: "neutral", IN_PROGRESS: "info", COMPLETED: "success" } as const)[state];
  return (
    <Badge tone={tone} className={className} data-testid="lesson-state">
      <Icon className="h-3 w-3" aria-hidden />
      {LESSON_STATE_LABELS[state]}
    </Badge>
  );
}

/** The mandatory label on every simulated-workshop screen. */
export function SimulationNotice({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <Badge tone="warning" className={className}>
        <FlaskConical className="h-3 w-3" aria-hidden />
        {SIMULATION_NOTICE}
      </Badge>
    );
  }
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-ctl border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm", className)}>
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="font-medium text-fg">{SIMULATION_NOTICE}</p>
        <p className="text-fg-muted">
          The virtual bench is an idealized DC model for practice. Time spent here does not count toward the hours required for
          DIR electrician certification or a CSLB license, and it is not logged as training hours.
        </p>
      </div>
    </div>
  );
}

export function FlagBadge({ flag, className }: { flag: "conflict" | "unverified" | "partial" | null; className?: string }) {
  if (!flag) return null;
  const label = { conflict: "Conflicting sources", unverified: "Unverified", partial: "Partially verified" }[flag];
  return (
    <Badge tone={flag === "partial" ? "info" : "warning"} className={className}>
      {label}
    </Badge>
  );
}
