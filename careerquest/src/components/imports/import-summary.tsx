import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import type { SyncStatus } from "@/generated/prisma/enums";
import type { ImportTotals } from "@/lib/imports/outcome";
import type { ImportSummaryData, RowIssue, RowIssueType } from "@/lib/imports/types";

const STATUS: Record<SyncStatus, { label: string; tone: Tone }> = {
  RUNNING: { label: "Running", tone: "info" },
  SUCCEEDED: { label: "Completed", tone: "success" },
  PARTIAL: { label: "Completed with problems", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function ImportStatusBadge({ status }: { status: SyncStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

const TOTAL_TILES: Array<{ key: keyof ImportTotals; label: string }> = [
  { key: "total", label: "Read" },
  { key: "created", label: "New" },
  { key: "updated", label: "Updated" },
  { key: "duplicate", label: "Already tracked" },
  { key: "needsReview", label: "Needs review" },
  { key: "ignored", label: "Ignored" },
  { key: "errors", label: "Errors" },
];

const ISSUE_META: Record<RowIssueType, { label: string; Icon: typeof Info; cls: string }> = {
  error: { label: "Errors", Icon: XCircle, cls: "text-danger" },
  needs_review: { label: "Needs review", Icon: AlertTriangle, cls: "text-warning" },
  ignored: { label: "Ignored", Icon: Info, cls: "text-fg-muted" },
  warning: { label: "Warnings", Icon: Info, cls: "text-info" },
};

const UNIT_LABEL: Record<ImportSummaryData["unit"], string> = { row: "Row", line: "Line", message: "Message" };

function issuePrefix(issue: RowIssue, unit: ImportSummaryData["unit"]): string {
  return issue.row > 0 ? `${UNIT_LABEL[unit]} ${issue.row}: ` : "";
}

/** Result of an import: totals per outcome, what to do next, and every row-level problem. */
export function ImportSummary({ data, onReset }: { data: ImportSummaryData; onReset?: () => void }) {
  const groups = (["error", "needs_review", "ignored", "warning"] as const)
    .map((type) => ({ type, items: data.issues.filter((i) => i.type === type) }))
    .filter((g) => g.items.length > 0);
  const successful = data.totals.created + data.totals.updated + data.totals.duplicate;

  return (
    <section aria-labelledby={`import-result-${data.batchId}`} className="rounded-card border border-line bg-surface p-4 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`import-result-${data.batchId}`} className="font-semibold flex items-center gap-2">
          <CheckCircle2 className={successful > 0 ? "h-4 w-4 text-success" : "h-4 w-4 text-fg-subtle"} aria-hidden />
          Import result{data.fileName ? ` — ${data.fileName}` : ""}
        </h2>
        <ImportStatusBadge status={data.status} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {TOTAL_TILES.map((t) => (
          <div key={t.key} className="rounded-ctl bg-bg-elevated border border-line px-3 py-2">
            <dt className="text-[11px] text-fg-muted">{t.label}</dt>
            <dd className="text-lg font-semibold tnum">{data.totals[t.key]}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-fg-muted">
        Imported records are labeled with their source. Spreadsheet and link imports are self-reported, so their stages show as
        unverified until confirmed by evidence or by you.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link href="/applications" className={buttonClasses("secondary", "sm")}>
          View applications
        </Link>
        {data.reviewQueue && (
          <Link href="/applications/review" className={buttonClasses("primary", "sm")}>
            Open review queue ({data.totals.needsReview})
          </Link>
        )}
        {onReset && (
          <button type="button" onClick={onReset} className={buttonClasses("ghost", "sm")}>
            Import another
          </button>
        )}
      </div>

      {groups.map((g) => {
        const meta = ISSUE_META[g.type];
        return (
          <details key={g.type} open={g.type === "error" || g.type === "needs_review"}>
            <summary className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
              <meta.Icon className={`h-4 w-4 ${meta.cls}`} aria-hidden />
              {meta.label} ({g.items.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-fg-muted max-h-72 overflow-y-auto pr-1">
              {g.items.map((i, idx) => (
                <li key={`${i.row}-${idx}`} className="break-words">
                  {issuePrefix(i, data.unit)}
                  {i.message}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      {data.issuesTruncated && <p className="text-xs text-fg-subtle">Only the first 200 problems are listed.</p>}
    </section>
  );
}
