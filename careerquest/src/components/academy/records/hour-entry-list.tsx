import Link from "next/link";
import { FileText, Pencil } from "lucide-react";
import type { HourEntryView } from "@/lib/academy/hours/service";
import { VERIFICATION_LABELS, WORK_TYPE_LABELS, isVerifiedSource } from "@/lib/academy/hours/constants";
import { documentHref } from "@/lib/documents/validation";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { DeleteEntryButton } from "./delete-buttons";
import { formatDayKey, formatHours } from "./format";

export function VerificationBadge({ verification }: { verification: HourEntryView["verification"] }) {
  return (
    <Badge tone={isVerifiedSource(verification) ? "success" : "neutral"} data-testid="verification-badge">
      {VERIFICATION_LABELS[verification]}
    </Badge>
  );
}

function DocLink({ doc }: { doc: HourEntryView["document"] }) {
  if (!doc) return <span className="text-fg-subtle">—</span>;
  return (
    <a href={documentHref(doc.id)} className="inline-flex max-w-[12rem] items-center gap-1 text-accent hover:underline" download>
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{doc.fileName}</span>
    </a>
  );
}

function Actions({ entry }: { entry: HourEntryView }) {
  const label = `${formatHours(entry.hours)} on ${formatDayKey(entry.dateKey)} at ${entry.employer}`;
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/academy/hours/${entry.id}`} className={buttonClasses("ghost", "icon")} aria-label={`Edit ${label}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <DeleteEntryButton id={entry.id} label={label} />
    </div>
  );
}

/** Entries as cards on phones and a table from `sm` up, with pagination. */
export function HourEntryList({ entries, page, pageCount }: { entries: HourEntryView[]; page: number; pageCount: number }) {
  return (
    <div>
      <ul className="space-y-2 sm:hidden" aria-label="Work-hour entries">
        {entries.map((e) => (
          <li key={e.id} className="rounded-ctl border border-line p-3" data-testid="hour-entry">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium tnum">
                  {formatHours(e.hours)} · {formatDayKey(e.dateKey)}
                </p>
                <p className="truncate text-sm text-fg-muted">
                  {e.employer}
                  {e.supervisor ? ` · ${e.supervisor}` : ""}
                </p>
              </div>
              <Actions entry={e} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <VerificationBadge verification={e.verification} />
              <Badge tone="neutral">{WORK_TYPE_LABELS[e.workType]}</Badge>
              {e.program && <span className="text-fg-subtle">{e.program.name}</span>}
            </div>
            {e.document && (
              <p className="mt-2 text-xs">
                <DocLink doc={e.document} />
              </p>
            )}
            {e.description && <p className="mt-2 text-xs text-fg-muted">{e.description}</p>}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Work-hour entries, newest first</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">
                Date
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Hours
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Employer / supervisor
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Work
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Documentation
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-0" data-testid="hour-entry-row">
                <td className="whitespace-nowrap py-2.5 pr-3 tnum">{formatDayKey(e.dateKey)}</td>
                <td className="py-2.5 pr-3 text-right font-medium tnum">{formatHours(e.hours)}</td>
                <td className="py-2.5 pr-3">
                  <p className="max-w-[16rem] truncate">{e.employer}</p>
                  {e.supervisor && <p className="max-w-[16rem] truncate text-xs text-fg-muted">{e.supervisor}</p>}
                  {e.description && <p className="max-w-[16rem] truncate text-xs text-fg-subtle" title={e.description}>{e.description}</p>}
                </td>
                <td className="py-2.5 pr-3">
                  <p>{WORK_TYPE_LABELS[e.workType]}</p>
                  {e.program && <p className="max-w-[14rem] truncate text-xs text-fg-subtle">{e.program.name}</p>}
                </td>
                <td className="py-2.5 pr-3">
                  <VerificationBadge verification={e.verification} />
                  <p className="mt-1 text-xs">
                    <DocLink doc={e.document} />
                  </p>
                </td>
                <td className="py-2 text-right">
                  <Actions entry={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Entry pages">
          {page > 1 ? (
            <Link href={`/academy/hours?page=${page - 1}#entries`} className={buttonClasses("outline", "sm")}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-fg-muted tnum">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={`/academy/hours?page=${page + 1}#entries`} className={buttonClasses("outline", "sm")}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
