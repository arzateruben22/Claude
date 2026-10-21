import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ApplicationSource } from "@/generated/prisma/enums";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/applications/status";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { RANGE_LABELS, RANGE_PRESETS, analyticsHref, hasActiveFilters, type AnalyticsFilters, type RangePreset } from "@/lib/analytics/filters";
import { cn } from "@/lib/utils";

const PRESET_CHIPS: RangePreset[] = ["7d", "30d", "90d", "campaign", "all"];

type Props = {
  filters: AnalyticsFilters;
  options: { sources: ApplicationSource[]; categories: string[]; employers: string[] };
  /** Count of applications the current filters match (shown next to the controls). */
  matched: number;
  rangeLabel: string;
};

/**
 * GET form: the URL is the filter state, so the page works without JavaScript and every chart,
 * stat and the CSV export read the same slice. Presets are plain links; the form submits the rest.
 */
export function FilterBar({ filters, options, matched, rangeLabel }: Props) {
  const statusSet = new Set(filters.status ?? []);
  const sourceValue = filters.source?.[0] ?? "";
  const moreOpen = Boolean(filters.location || filters.salaryMin !== undefined || filters.salaryMax !== undefined || filters.includeArchived);
  const sources = Array.from(new Set<ApplicationSource>([...options.sources, ...(filters.source ?? [])]));
  const categories = filters.category && !options.categories.includes(filters.category) ? [filters.category, ...options.categories] : options.categories;
  const employers = filters.employer && !options.employers.includes(filters.employer) ? [filters.employer, ...options.employers] : options.employers;

  return (
    <form method="get" action="/analytics" className="glass rounded-card p-4 mb-5" aria-label="Analytics filters" data-testid="analytics-filters">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range presets">
        {PRESET_CHIPS.map((p) => {
          const active = filters.range === p;
          return (
            <Link
              key={p}
              href={analyticsHref(filters, { range: p, from: null, to: null })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                active ? "border-accent/40 bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg hover:bg-surface-hover",
              )}
            >
              {RANGE_LABELS[p]}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-fg-muted tnum" data-testid="filter-summary">
          {matched} application{matched === 1 ? "" : "s"} · {rangeLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="Date range" htmlFor="f-range">
          <Select id="f-range" name="range" defaultValue={filters.range}>
            {RANGE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {RANGE_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" htmlFor="f-from" hint="Used with Custom dates">
          <Input id="f-from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </Field>
        <Field label="To" htmlFor="f-to">
          <Input id="f-to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </Field>
        <Field label="Source" htmlFor="f-source">
          <Select id="f-source" name="source" defaultValue={sourceValue}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Job category" htmlFor="f-category">
          <Select id="f-category" name="category" defaultValue={filters.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employer" htmlFor="f-employer">
          <Select id="f-employer" name="employer" defaultValue={filters.employer ?? ""}>
            <option value="">All employers</option>
            {employers.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <details className="mt-3 group" open={statusSet.size > 0}>
        <summary className="cursor-pointer text-xs font-medium text-fg-muted hover:text-fg select-none">
          Status {statusSet.size > 0 ? `(${statusSet.size} selected)` : "(all)"}
        </summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5" role="group" aria-label="Status filter">
          {ALL_STATUSES.map((s) => (
            <Checkbox key={s} name="status" value={s} defaultChecked={statusSet.has(s)} label={STATUS_LABELS[s]} />
          ))}
        </div>
      </details>

      <details className="mt-2" open={moreOpen}>
        <summary className="cursor-pointer text-xs font-medium text-fg-muted hover:text-fg select-none inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          More filters
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Location contains" htmlFor="f-location">
            <Input id="f-location" name="location" defaultValue={filters.location ?? ""} placeholder="e.g. Irvine" maxLength={160} />
          </Field>
          <Field label="Salary at least" htmlFor="f-salary-min" hint="Raw amount; hourly and annual are not converted">
            <Input id="f-salary-min" name="salaryMin" type="number" inputMode="decimal" min={0} step="any" defaultValue={filters.salaryMin ?? ""} />
          </Field>
          <Field label="Salary at most" htmlFor="f-salary-max">
            <Input id="f-salary-max" name="salaryMax" type="number" inputMode="decimal" min={0} step="any" defaultValue={filters.salaryMax ?? ""} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox name="archived" value="1" defaultChecked={filters.includeArchived} label="Include archived" />
          </div>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {hasActiveFilters(filters) && (
          <Link href="/analytics" className={buttonClasses("ghost", "sm")}>
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}
