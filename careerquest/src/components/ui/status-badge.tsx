import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
