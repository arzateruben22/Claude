import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import {
  listApplications,
  listCategories,
  userTimezone,
} from "@/lib/applications/service";
import { hasActiveFilters, parseListFilters } from "@/lib/applications/query";
import { Alert, EmptyState, PageHeader, buttonClasses } from "@/components/ui";
import { ApplicationFilters } from "@/components/applications/application-filters";
import { ApplicationList } from "@/components/applications/application-list";
import { Pagination } from "@/components/applications/pagination";

export const metadata: Metadata = { title: "Application Tracker" };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = parseListFilters(sp);
  const [result, categories, timezone] = await Promise.all([
    listApplications(user.id, filters),
    listCategories(user.id),
    userTimezone(user.id),
  ]);
  const filtered = hasActiveFilters(filters);

  const newButton = (
    <Link href="/applications/new" className={buttonClasses("primary", "md")}>
      <Plus className="h-4 w-4" aria-hidden />
      New application
    </Link>
  );

  return (
    <>
      <PageHeader
        eyebrow="Tracker"
        title="Applications"
        description={
          result.hasAny
            ? filtered
              ? `${result.total} match the current filters.`
              : `${result.total} application${result.total === 1 ? "" : "s"} tracked.`
            : "Every application you log lives here, with its stage, history and follow-ups."
        }
        actions={newButton}
      />

      {sp.deleted === "1" && (
        <Alert tone="success" className="mb-4">
          Application deleted.
        </Alert>
      )}

      {!result.hasAny ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" aria-hidden />}
          title="No applications yet"
          description="Add the first job you applied to (or plan to). Submitted applications earn XP and count toward your daily target."
          action={newButton}
        />
      ) : (
        <div className="space-y-4">
          <ApplicationFilters
            filters={filters}
            counts={result.counts}
            totalUnfiltered={result.totalUnfiltered}
            categories={categories}
          />
          {result.items.length === 0 ? (
            <EmptyState
              title="Nothing matches these filters"
              description="Try a different stage, clear the search, or include archived applications."
              action={
                <Link
                  href="/applications"
                  className={buttonClasses("secondary", "sm")}
                >
                  Clear filters
                </Link>
              }
            />
          ) : (
            <>
              <ApplicationList
                items={result.items}
                timezone={timezone}
                now={new Date()}
              />
              <Pagination
                filters={filters}
                page={result.page}
                pageCount={result.pageCount}
                total={result.total}
                pageSize={result.pageSize}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
