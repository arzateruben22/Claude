import type { Metadata } from "next";
import { Clock, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getHoursPageData } from "@/lib/academy/hours/service";
import { HOUR_PROOF_KINDS } from "@/lib/documents/validation";
import { XP } from "@/lib/game/xp-config";
import { HOUR_MILESTONES } from "@/lib/academy/hours/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { ClassroomCard, HoursTotals, MilestoneList, requirementCaption } from "@/components/academy/records/hours-summary";
import { CumulativeHoursChart, WeeklyHoursChart } from "@/components/academy/records/hours-charts";
import { CapsTable } from "@/components/academy/records/caps-table";
import { HourEntryForm } from "@/components/academy/records/hour-entry-form";
import { HourEntryList } from "@/components/academy/records/hour-entry-list";
import { DocumentList } from "@/components/academy/records/documents";
import { DocumentUploadForm } from "@/components/academy/records/document-upload-form";

export const metadata: Metadata = { title: "Training hours · Academy" };

export default async function HoursPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/academy/hours");
  const sp = await searchParams;
  const pageParam = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const data = await getHoursPageData(user.id, { page: Number.isFinite(pageParam) ? pageParam : 1 });
  const hasEntries = data.entryCount > 0;

  return (
    <>
      <PageHeader
        eyebrow="California Electrician Career Academy"
        title="Training hours"
        description="Log on-the-job hours with your employer, supervisor and type of work. Verified and self-reported hours are always kept apart."
        actions={
          hasEntries ? (
            <a href="/academy/hours/export" className={buttonClasses("outline", "sm")} download>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </a>
          ) : undefined
        }
      />
      <AcademyTabs />
      <div className="space-y-6">
        <Alert tone="info" title="Self-reported hours are not treated as accepted by California">
          Hours count as <strong>verified</strong> here only when you attach a pay stub, an employer letter or a union hour report. Even then
          CareerQuest does not check the document — the DIR Electrician Certification Unit decides what counts.
        </Alert>

        <HoursTotals totals={data.totals} requirement={data.requirement} projection={data.projection} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Weekly hours</CardTitle>
                <CardDescription>Last 12 weeks, Monday to Sunday.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <WeeklyHoursChart weekly={data.weekly} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cumulative progress</CardTitle>
                <CardDescription>{requirementCaption(data.requirement)}.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {data.cumulative.length > 0 ? (
                <CumulativeHoursChart points={data.cumulative} required={data.requirement.hoursRequired} requirementLabel={`${data.requirement.name} requirement`} />
              ) : (
                <p className="text-sm text-fg-muted">No hours logged yet. Your running totals appear here after the first entry.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Log hours</CardTitle>
                <CardDescription>
                  +{XP.WORK_HOURS_LOGGED} XP per entry. Verified totals earn +{XP.TRAINING_MILESTONE} XP at{" "}
                  {HOUR_MILESTONES.map((n) => n.toLocaleString("en-US")).join(", ")} hours.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <HourEntryForm todayKey={data.todayKey} programs={data.programs} documents={data.documents} />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Verified-hour milestones</CardTitle>
                  <CardDescription>Game milestones only — not a certification step.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <MilestoneList milestones={data.milestones} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Classroom milestones</CardTitle>
                  <CardDescription>Related instruction for the Electrician Trainee route.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ClassroomCard classroom={data.classroom} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Proof documents</CardTitle>
                  <CardDescription>Pay stubs, employer letters and union hour reports.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DocumentUploadForm kinds={HOUR_PROOF_KINDS} defaultKind="PAY_STUB" />
                <DocumentList
                  documents={data.documents}
                  timezone={data.timezone}
                  empty="No proof documents uploaded yet."
                  deleteWarning="Entries it verifies will become self-reported."
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {data.caps && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Estimated countable hours — General Electrician</CardTitle>
                <CardDescription>Per-area caps under 8 CCR 291.1; hours must span two or more work areas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <CapsTable verified={data.caps.verified} logged={data.caps.logged} capsFromSeed={data.caps.fromSeed} />
            </CardContent>
          </Card>
        )}

        <section id="entries" aria-labelledby="entries-title" className="glass scroll-mt-24 rounded-card p-5">
          <h2 id="entries-title" className="text-sm font-semibold tracking-tight">
            Your entries
          </h2>
          <div className="mt-3">
            {hasEntries ? (
              <HourEntryList entries={data.entries} page={data.page} pageCount={data.pageCount} />
            ) : (
              <EmptyState
                icon={<Clock className="h-6 w-6" aria-hidden />}
                title="No hours logged yet"
                description="Add your first entry above. Keep pay stubs or an employer letter so the hours can be verified later."
                className="shadow-none"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
