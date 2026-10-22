import Link from "next/link";
import { BarChart3, Download, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { parseAnalyticsFilters, exportHref, hasActiveFilters } from "@/lib/analytics/filters";
import { getAnalytics, MAX_ANALYTICS_APPLICATIONS } from "@/lib/analytics/queries";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { FilterBar } from "@/components/analytics/filter-bar";
import { AnalyticsStatTiles } from "@/components/analytics/stat-tiles";
import { ActivityCard } from "@/components/analytics/activity-card";
import { FunnelCard } from "@/components/analytics/funnel-card";
import { ConversionTable } from "@/components/analytics/conversion-table";
import { StatusDistribution } from "@/components/analytics/status-distribution";
import { SourcesCard } from "@/components/analytics/sources-card";
import { FollowUpCard } from "@/components/analytics/follow-up-card";
import type { ApplicationSource } from "@/generated/prisma/enums";

export const metadata = { title: "Analytics · CareerQuest" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/analytics"), searchParams]);
  const filters = parseAnalyticsFilters(sp);
  const data = await getAnalytics(user.id, filters);
  const active = hasActiveFilters(filters);

  if (!data.hasAnyApplications) {
    return (
      <>
        <PageHeader eyebrow="Observed from your tracker" title="Analytics" description="Response, interview and offer rates computed from the applications you log." />
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" aria-hidden />}
          title="No applications yet"
          description="There is no data to analyze until you log your first application. Nothing here is estimated or simulated."
          action={
            <Link href="/applications/new" className={buttonClasses("primary", "md")}>
              <Plus className="h-4 w-4" aria-hidden />
              Log your first application
            </Link>
          }
        />
      </>
    );
  }

  const sourceLabel = (key: string | null) => (key ? (SOURCE_LABELS[key as ApplicationSource] ?? key) : "Unknown");
  const categoryLabel = (key: string | null) => key ?? "No category";
  const resumeLabel = (key: string | null) => (key ? (data.resumeNames[key] ?? "Deleted résumé") : "No résumé version");

  return (
    <>
      <PageHeader
        eyebrow="Observed from your tracker"
        title="Analytics"
        description="Everything below is counted from your own records. Rates carry a 95% interval, which is an estimate of where the true rate plausibly lies; nothing predicts whether you will be hired."
        actions={
          <a href={exportHref(filters)} download className={buttonClasses("secondary", "sm")} data-testid="export-csv">
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </a>
        }
      />

      <FilterBar filters={filters} options={data.options} matched={data.totals.applications} rangeLabel={data.range.label} />

      {data.capped && (
        <Alert tone="warning" title="Large result set" className="mb-5">
          Only the first {formatNumber(MAX_ANALYTICS_APPLICATIONS)} matching applications were analyzed. Narrow the filters to see exact numbers.
        </Alert>
      )}

      {data.totals.applications === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" aria-hidden />}
          title="No applications match these filters"
          description="Widen the date range or clear a filter to see your numbers."
          action={
            active ? (
              <Link href="/analytics" className={buttonClasses("secondary", "md")}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <AnalyticsStatTiles funnel={data.funnel} timing={data.timing} />

          <div className="grid gap-4 lg:grid-cols-3 mb-4">
            <div className="lg:col-span-2 min-w-0">
              <ActivityCard daily={data.daily} dailyWindow={data.dailyWindow} weekly={data.weekly} weeklyWindow={data.weeklyWindow} />
            </div>
            <div className="space-y-4 min-w-0">
              <FollowUpCard {...data.followUps} />
              <StatusDistribution rows={data.statusDistribution} total={data.totals.applications} />
            </div>
          </div>

          <div className="mb-4">
            <FunnelCard funnel={data.funnel} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5 mb-4">
            <div className="lg:col-span-2 min-w-0">
              <SourcesCard rows={data.sourceDistribution} />
            </div>
            <div className="lg:col-span-3 min-w-0">
              <ConversionTable
                title="Conversion by source"
                dimensionLabel="Source"
                rows={data.bySource}
                labelFor={sourceLabel}
                emptyText="No applications in this slice."
                testId="conversion-source"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <ConversionTable
              title="Conversion by job category"
              description="Category is the free-text field on each application."
              dimensionLabel="Job category"
              rows={data.byCategory}
              labelFor={categoryLabel}
              emptyText="No applications in this slice."
              testId="conversion-category"
            />
            <ConversionTable
              title="Conversion by résumé version"
              description="Which résumé you attached to each application."
              dimensionLabel="Résumé version"
              rows={data.byResume}
              labelFor={resumeLabel}
              emptyText="No applications in this slice."
              testId="conversion-resume"
            />
          </div>

          <p className="text-[11px] text-fg-subtle max-w-3xl">
            Definitions: <strong className="font-medium text-fg-muted">Applied</strong> = the record has an application date or an application-submitted
            event; a saved lead you closed or withdrew without applying is not counted. Date ranges use the day you applied (or added a saved lead) in
            your timezone. The Command Center uses the same definitions.{" "}
            <strong className="font-medium text-fg-muted">Responded</strong> = the employer reacted (screening, interview, offer or rejection, or a logged
            response). Later stages imply earlier ones. &ldquo;Observed&rdquo; values are counts from your records; the only estimates on this page are the
            95% intervals around each rate.
          </p>
        </>
      )}
    </>
  );
}
