import { FileText, FolderOpen } from "lucide-react";
import type { DocumentSummary } from "@/lib/documents/service";
import { DOCUMENT_KIND_LABELS, documentHref, formatBytes } from "@/lib/documents/validation";
import { formatInTz } from "@/lib/applications/time";
import { Badge } from "@/components/ui/badge";
import { DeleteDocumentButton } from "./delete-buttons";

/** The user's uploaded documents with owner-only download links and delete. */
export function DocumentList({
  documents,
  timezone,
  empty,
  deleteWarning,
}: {
  documents: DocumentSummary[];
  timezone: string;
  empty: string;
  deleteWarning?: string;
}) {
  if (documents.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <FolderOpen className="h-4 w-4 text-fg-subtle" aria-hidden />
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line" aria-label="Your documents">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-2 py-2" data-testid="document-row">
          <div className="min-w-0">
            <a href={documentHref(d.id)} download className="inline-flex max-w-full items-center gap-1.5 text-sm text-accent hover:underline">
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{d.fileName}</span>
              <span className="sr-only"> (download)</span>
            </a>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
              <Badge tone="neutral">{DOCUMENT_KIND_LABELS[d.kind]}</Badge>
              <span className="tnum">{formatBytes(d.sizeBytes)}</span>
              <span>uploaded {formatInTz(d.createdAt, timezone)}</span>
            </p>
          </div>
          <DeleteDocumentButton id={d.id} fileName={d.fileName} warning={deleteWarning} />
        </li>
      ))}
    </ul>
  );
}
