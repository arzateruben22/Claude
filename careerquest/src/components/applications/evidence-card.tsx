import type { EvidenceKind } from "@/generated/prisma/enums";
import {
  EVIDENCE_KIND_LABELS,
  evidenceSourceLabel,
} from "@/lib/applications/labels";
import { formatInTz } from "@/lib/applications/time";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export type EvidenceView = {
  id: string;
  kind: EvidenceKind;
  title: string | null;
  snippet: string | null;
  capturedAt: Date;
  data?: unknown;
};

/**
 * The emails, page captures and imported rows backing this record, newest first. Shown as captured
 * (titles and snippets are the producer's short excerpts); nothing here is re-interpreted.
 */
export function EvidenceCard({
  evidence,
  timezone,
}: {
  evidence: EvidenceView[];
  timezone: string;
}) {
  if (evidence.length === 0) return null;
  return (
    <Card data-testid="evidence-card">
      <CardHeader>
        <div>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>
            What this record was detected or updated from, with when it was
            captured.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-line">
          {evidence.map((e) => (
            <li key={e.id} className="py-2.5 first:pt-0 last:pb-0 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge tone="info">{EVIDENCE_KIND_LABELS[e.kind]}</Badge>
                <span className="text-fg-muted">
                  {evidenceSourceLabel(e.kind, e.data)}
                </span>
                <span className="text-fg-subtle tnum">
                  · captured {formatInTz(e.capturedAt, timezone, "datetime")}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium break-words">
                {e.title ?? "Untitled"}
              </p>
              {e.snippet && (
                <p className="mt-0.5 text-xs text-fg-muted whitespace-pre-wrap break-words line-clamp-3">
                  {e.snippet}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
