import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getWeeklyReport } from "@/lib/reports/weekly";
import { isWeekStartKey, weekLabel } from "@/lib/reports/week";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ReportsTabs } from "@/components/reports/reports-tabs";
import { ReportView, reportStatus } from "@/components/reports/report-view";
import { GenerateReportForm } from "@/components/reports/generate-form";
import { PrintButton } from "@/components/reports/print-button";

export async function generateMetadata({ params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;
  return { title: isWeekStartKey(weekStart) ? `Week of ${weekLabel(weekStart)} · Weekly reports · CareerQuest` : "Weekly report · CareerQuest" };
}

/** Print: hide the app chrome (sidebar, top bar, bottom nav) so the report prints on its own. */
const PRINT_CSS = `@media print {
  aside, header, nav[aria-label="Primary"] { display: none !important; }
  main { padding: 0 !important; max-width: none !important; }
  .glass, .glass-strong { backdrop-filter: none !important; box-shadow: none !important; }
}`;

export default async function WeeklyReportPage({ params }: { params: Promise<{ weekStart: string }> }) {
  const [user, { weekStart }] = await Promise.all([requireUser(), params]);
  if (!isWeekStartKey(weekStart)) notFound();
  const result = await getWeeklyReport(user.id, weekStart);
  if (!result.ok) notFound();
  const { report, isCurrentWeek } = result;
  const status = reportStatus(report, isCurrentWeek);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="Weekly report"
        title={`Week of ${weekLabel(weekStart)}`}
        description="Counts from your own records, compared with the previous week."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <a href={`/api/reports/${weekStart}?format=csv`} download className={buttonClasses("secondary", "sm")} data-testid="report-csv">
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </a>
            <a href={`/api/reports/${weekStart}?format=json`} download className={buttonClasses("secondary", "sm")} data-testid="report-json">
              <Download className="h-3.5 w-3.5" aria-hidden />
              JSON
            </a>
            <PrintButton />
          </div>
        }
      />
      <ReportsTabs />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <Link href="/analytics/reports" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All weeks
        </Link>
        {!isCurrentWeek && <GenerateReportForm weekStart={weekStart} label="Regenerate from today's data" variant="secondary" regenerate />}
      </div>
      <Alert tone={status.tone} className="mb-4">
        {status.text}
      </Alert>
      <ReportView data={report} isCurrentWeek={isCurrentWeek} />
    </>
  );
}
