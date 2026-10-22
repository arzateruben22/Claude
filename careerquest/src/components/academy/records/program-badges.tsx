import { CircleCheck, CircleHelp, CircleSlash } from "lucide-react";
import type { ProgramInterestStatus, RecruitmentStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { INTEREST_STATUS_LABELS, INTEREST_STATUS_TONES, recruitmentBadge } from "@/lib/academy/programs/labels";

export function RecruitmentBadge({ status, className }: { status: RecruitmentStatus; className?: string }) {
  const b = recruitmentBadge(status);
  const Icon = status === "OPEN" ? CircleCheck : status === "CLOSED" ? CircleSlash : CircleHelp;
  return (
    <Badge tone={b.tone} className={className} title={b.description} data-testid="recruitment-badge">
      <Icon className="h-3 w-3" aria-hidden />
      <span>
        <span className="sr-only">Recruitment: </span>
        {b.label}
      </span>
    </Badge>
  );
}

export function InterestStatusBadge({ status, className }: { status: ProgramInterestStatus; className?: string }) {
  return (
    <Badge tone={INTEREST_STATUS_TONES[status]} className={className} data-testid="interest-status">
      <span className="sr-only">Your status: </span>
      {INTEREST_STATUS_LABELS[status]}
    </Badge>
  );
}

export function UnionBadge({ isUnion }: { isUnion: boolean }) {
  return <Badge tone={isUnion ? "info" : "neutral"}>{isUnion ? "Union (JATC)" : "Non-union / merit shop"}</Badge>;
}
