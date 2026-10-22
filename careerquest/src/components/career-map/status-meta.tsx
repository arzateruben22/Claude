import { Award, Briefcase, CheckCircle2, Circle, CircleDot, DoorOpen, Flag, Lock, Milestone, type LucideIcon } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/career-map/labels";
import type { CareerNodeStatus, EvidenceLabel, FactFlag, NodeKind } from "@/lib/career-map/types";
import { cn } from "@/lib/utils";

export const STATUS_ICONS: Record<CareerNodeStatus, LucideIcon> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: CircleDot,
  AVAILABLE: Circle,
  LOCKED: Lock,
};

export const STATUS_TONES: Record<CareerNodeStatus, Tone> = {
  COMPLETED: "success",
  IN_PROGRESS: "accent",
  AVAILABLE: "info",
  LOCKED: "neutral",
};

/** Text colour for a status icon (the label is always visible text next to it). */
export const STATUS_TEXT: Record<CareerNodeStatus, string> = {
  COMPLETED: "text-success",
  IN_PROGRESS: "text-accent",
  AVAILABLE: "text-info",
  LOCKED: "text-fg-subtle",
};

/** Card surface per status on the map. */
export const STATUS_CARD: Record<CareerNodeStatus, string> = {
  COMPLETED: "border-success/40 bg-success-soft",
  IN_PROGRESS: "border-accent/50 bg-accent-soft",
  AVAILABLE: "border-line-strong bg-bg-elevated",
  LOCKED: "border-line bg-surface text-fg-muted",
};

export const KIND_ICONS: Record<NodeKind, LucideIcon> = {
  start: Flag,
  stage: Milestone,
  credential: Award,
  role: Briefcase,
  entry: DoorOpen,
};

export function NodeStatusBadge({ status, className }: { status: CareerNodeStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge tone={STATUS_TONES[status]} className={className}>
      <Icon className="h-3 w-3" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const EVIDENCE_TONES: Record<EvidenceLabel, Tone> = {
  Verified: "success",
  "Self-reported": "warning",
  Observed: "info",
  Estimate: "gold",
  "Marked by you": "accent",
};

export function EvidenceBadge({ label, className }: { label: EvidenceLabel; className?: string }) {
  return (
    <Badge tone={EVIDENCE_TONES[label]} className={cn("shrink-0", className)}>
      {label}
    </Badge>
  );
}

export function FactFlagBadge({ flag }: { flag: FactFlag | null }) {
  if (!flag) return null;
  const label = { conflict: "Conflicting sources", unverified: "Unverified", partial: "Partially verified" }[flag];
  return <Badge tone={flag === "partial" ? "info" : "warning"}>{label}</Badge>;
}
