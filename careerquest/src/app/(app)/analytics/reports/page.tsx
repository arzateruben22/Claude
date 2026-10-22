import { CalendarRange } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listReportWeeks, reportTimezone } from "@/lib/reports/weekly";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportsTabs } from "@/components/reports/reports-tabs";
import { WeekList } from "@/components/reports/week-list";
import { GenerateReportForm } from "@/components/reports/generate-form";

export const metadata = { title: "Weekly reports · Analytics · CareerQuest" };

export default async function WeeklyReportsPage() {
  const user = await requireUser("/analytics/reports");
  const [weeks, timeZone] = await Promise.all([listReportWeeks(user.id), reportTimezone(user.id)]);
  return (
    <>
      <PageHeader
        eyebrow="Observed from your tracker"
        title="Weekly reports"
        description="A Monday–Sunday summary of your applications, responses, follow-ups, XP, learning and work hours, compared with the week before. Past weeks are saved as frozen snapshots; the current week updates whenever you open it."
        actions={<GenerateReportForm label="Generate this week's report" />}
      />
      <ReportsTabs />
      {weeks.length === 0 ? (
        <EmptyState icon={<CalendarRange className="h-8 w-8" aria-hidden />} title="No weeks to report yet" description="Your first weekly report becomes available once your account has a week of history." />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Weeks</CardTitle>
              <CardDescription>Weeks run Monday to Sunday in {timeZone}. Showing up to the last 52 weeks since your first activity.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <WeekList weeks={weeks} timeZone={timeZone} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
