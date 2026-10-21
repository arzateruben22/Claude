import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  ApplicationSource,
  type ApplicationStatus,
} from "@/generated/prisma/enums";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  buttonClasses,
} from "@/components/ui";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import {
  LIST_SORTS,
  LIST_SORT_LABELS,
  hasActiveFilters,
  listHref,
  type ListFilters,
} from "@/lib/applications/query";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/applications/status";
import { cn } from "@/lib/utils";

const SOURCES = Object.keys(ApplicationSource) as ApplicationSource[];

export function ApplicationFilters({
  filters,
  counts,
  totalUnfiltered,
  categories,
}: {
  filters: ListFilters;
  counts: Record<ApplicationStatus, number>;
  totalUnfiltered: number;
  categories: string[];
}) {
  const selected = filters.status?.length === 1 ? filters.status[0] : undefined;
  const chipStatuses = ALL_STATUSES.filter(
    (s) => counts[s] > 0 || filters.status?.includes(s),
  );
  const active = hasActiveFilters(filters);

  return (
    <div className="space-y-3">
      <nav
        aria-label="Filter by stage"
        className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1"
      >
        <Chip
          href={listHref(filters, { status: null })}
          active={!filters.status?.length}
          label="All"
          count={totalUnfiltered}
        />
        {chipStatuses.map((s) => (
          <Chip
            key={s}
            href={listHref(filters, { status: selected === s ? null : [s] })}
            active={filters.status?.includes(s) ?? false}
            label={STATUS_LABELS[s]}
            count={counts[s]}
          />
        ))}
      </nav>

      <form
        action="/applications"
        method="get"
        className="glass rounded-card p-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
      >
        {filters.status?.length ? (
          <input type="hidden" name="status" value={filters.status.join(",")} />
        ) : null}
        <div>
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle"
              aria-hidden
            />
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Search company, title, location, req #"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="source" className="sr-only">
            Source
          </Label>
          <Select
            id="source"
            name="source"
            defaultValue={filters.source ?? ""}
            className="sm:w-40"
          >
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        {categories.length > 0 && (
          <div>
            <Label htmlFor="category" className="sr-only">
              Category
            </Label>
            <Select
              id="category"
              name="category"
              defaultValue={filters.category ?? ""}
              className="sm:w-44"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="sort" className="sr-only">
            Sort
          </Label>
          <Select
            id="sort"
            name="sort"
            defaultValue={filters.sort}
            className="sm:w-44"
          >
            {LIST_SORTS.map((s) => (
              <option key={s} value={s}>
                {LIST_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <Checkbox
            name="archived"
            value="1"
            label="Include archived"
            defaultChecked={filters.includeArchived}
            className="text-xs"
          />
          <div className="flex items-center gap-1.5">
            {active && (
              <Link
                href="/applications"
                className={buttonClasses("ghost", "sm")}
                aria-label="Clear filters"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear
              </Link>
            )}
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 h-8 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line text-fg-muted hover:text-fg hover:bg-surface-hover",
      )}
    >
      {label}
      <span
        className={cn(
          "tnum rounded-full px-1.5 py-px text-[10px]",
          active ? "bg-accent/20" : "bg-surface-strong",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
