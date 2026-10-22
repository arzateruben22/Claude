import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportKind } from "@/generated/prisma/enums";
import { formatInTz } from "@/lib/applications/time";
import type { ImportBatchView } from "@/lib/imports/batches";
import { describeTotals } from "@/lib/imports/outcome";
import { ImportStatusBadge } from "./import-summary";

const KIND_LABELS: Record<ImportKind, string> = {
  CSV: "Spreadsheet",
  EML: "Email files",
  MBOX: "Mailbox archive",
  GMAIL_HISTORY: "Gmail history",
  OUTLOOK_HISTORY: "Outlook history",
  URL_LIST: "Job links",
  PLATFORM_EXPORT: "Platform export",
};

/** The user's latest import batches of the given kinds. */
export function RecentImports({ batches, timezone, title = "Recent imports" }: { batches: ImportBatchView[]; timezone: string; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{batches.length ? "Most recent first." : "Nothing imported here yet."}</CardDescription>
        </div>
      </CardHeader>
      {batches.length > 0 && (
        <CardContent>
          <ul className="divide-y divide-line">
            {batches.map((b) => (
              <li key={b.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-all">{b.fileName ?? KIND_LABELS[b.kind]}</p>
                  <p className="text-xs text-fg-muted">
                    {KIND_LABELS[b.kind]} · {formatInTz(b.createdAt, timezone, "datetime")} · {describeTotals(b.totals)}
                  </p>
                </div>
                <ImportStatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
