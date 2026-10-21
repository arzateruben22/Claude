import type { ApplicationSource } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS } from "@/lib/applications/labels";

export function SourceBadge({
  source,
  className,
}: {
  source: ApplicationSource;
  className?: string;
}) {
  return (
    <Badge tone="neutral" className={className}>
      {SOURCE_LABELS[source]}
    </Badge>
  );
}
