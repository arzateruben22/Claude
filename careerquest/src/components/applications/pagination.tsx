import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui";
import { listHref, type ListFilters } from "@/lib/applications/query";
import { cn } from "@/lib/utils";

export function Pagination({
  filters,
  page,
  pageCount,
  total,
  pageSize,
}: {
  filters: ListFilters;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const prev = page > 1 ? listHref(filters, { page: page - 1 }) : null;
  const next = page < pageCount ? listHref(filters, { page: page + 1 }) : null;
  const disabled = cn(
    buttonClasses("outline", "sm"),
    "opacity-40 pointer-events-none",
  );
  return (
    <nav
      className="flex items-center justify-between gap-3 text-xs text-fg-muted"
      aria-label="Pagination"
    >
      <p className="tnum">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        {prev ? (
          <Link
            href={prev}
            className={buttonClasses("outline", "sm")}
            rel="prev"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
          </Link>
        ) : (
          <span className={disabled} aria-disabled="true">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
          </span>
        )}
        <span className="tnum px-1">
          Page {page} of {pageCount}
        </span>
        {next ? (
          <Link
            href={next}
            className={buttonClasses("outline", "sm")}
            rel="next"
          >
            Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span className={disabled} aria-disabled="true">
            Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
