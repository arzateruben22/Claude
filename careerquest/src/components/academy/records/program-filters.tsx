import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { UNION_FILTERS, type ProgramFilters } from "@/lib/academy/programs/labels";

/** GET filter form (works without JavaScript; the URL is the state). */
export function ProgramFilterForm({ regions, filters }: { regions: string[]; filters: ProgramFilters }) {
  const active = Boolean(filters.region || filters.union);
  return (
    <form method="get" action="/academy/apprenticeships" className="glass grid gap-3 rounded-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filter programs">
      <div>
        <Label htmlFor="filter-region">Region</Label>
        <Select id="filter-region" name="region" defaultValue={filters.region ?? ""}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="filter-union">Union</Label>
        <Select id="filter-union" name="union" defaultValue={filters.union ?? ""}>
          <option value="">Union and non-union</option>
          {UNION_FILTERS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="md">
          Apply filters
        </Button>
        {active && (
          <Link href="/academy/apprenticeships" className="text-sm text-fg-muted hover:text-fg">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
