import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getApplication, userTimezone } from "@/lib/applications/service";
import { buildTimeline } from "@/lib/applications/timeline";
import { dateInputValue, formatInTz } from "@/lib/applications/time";
import {
  EMPLOYMENT_TYPE_LABELS,
  EVENT_SOURCE_LABELS,
  OFFER_STATUS_LABELS,
  RECORD_ORIGIN_LABELS,
  SALARY_PERIOD_LABELS,
  SOURCE_LABELS,
} from "@/lib/applications/labels";
import { formatCurrency } from "@/lib/format";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  StatusBadge,
  buttonClasses,
} from "@/components/ui";
import { SourceBadge } from "@/components/applications/source-badge";
import { StatusChangePanel } from "@/components/applications/status-change-panel";
import { FollowUpForm } from "@/components/applications/follow-up-form";
import { NoteForm } from "@/components/applications/note-form";
import {
  InterviewsPanel,
  type InterviewView,
} from "@/components/applications/interviews-panel";
import { ApplicationTimeline } from "@/components/applications/timeline";
import { DangerZone } from "@/components/applications/danger-zone";

export const metadata: Metadata = { title: "Application" };

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [app, timezone] = await Promise.all([
    getApplication(user.id, id),
    userTimezone(user.id),
  ]);
  if (!app) notFound();

  const now = new Date();
  const today = dateInputValue(now, timezone);
  const xpParam = typeof sp.xp === "string" ? Number(sp.xp) : 0;
  const latestStatusSource = app.statusHistory[0]?.source ?? "USER";
  const timeline = buildTimeline(app.statusHistory, app.events);
  const interviews: InterviewView[] = app.interviews.map((i) => ({
    id: i.id,
    type: i.type,
    scheduledLabel: formatInTz(i.scheduledAt, timezone, "datetime"),
    isPast: i.scheduledAt.getTime() < now.getTime(),
    durationMinutes: i.durationMinutes,
    interviewer: i.interviewer,
    location: i.location,
    outcome: i.outcome,
    attended: i.attendedAt !== null,
    prepCompleted: i.prepCompletedAt !== null,
    notes: i.notes,
  }));
  const salary =
    app.salaryMin !== null || app.salaryMax !== null
      ? `${app.salaryMin !== null ? formatCurrency(app.salaryMin, { cents: app.salaryPeriod === "HOURLY" }) : "?"}${app.salaryMax !== null && app.salaryMax !== app.salaryMin ? ` – ${formatCurrency(app.salaryMax, { cents: app.salaryPeriod === "HOURLY" })}` : ""}${app.salaryPeriod ? ` ${SALARY_PERIOD_LABELS[app.salaryPeriod]}` : ""}`
      : null;
  const label = `${app.companyName} – ${app.positionTitle}`;

  return (
    <>
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg mb-3"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All applications
      </Link>
      <PageHeader
        eyebrow={app.companyName}
        title={app.positionTitle}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <span data-testid="application-status">
              <StatusBadge status={app.status} />
            </span>
            <Badge tone={app.statusVerified ? "success" : "warning"}>
              {app.statusVerified ? (
                <ShieldCheck className="h-3 w-3" aria-hidden />
              ) : null}
              {app.statusVerified ? "Verified" : "Unverified"} ·{" "}
              {EVENT_SOURCE_LABELS[latestStatusSource]}
            </Badge>
            <SourceBadge source={app.source} />
            {app.employmentType !== "UNKNOWN" && (
              <Badge tone="neutral">
                {EMPLOYMENT_TYPE_LABELS[app.employmentType]}
              </Badge>
            )}
            {app.remote && <Badge tone="neutral">Remote</Badge>}
            {app.archivedAt && <Badge tone="warning">Archived</Badge>}
            {app.location && (
              <span className="text-fg-muted">{app.location}</span>
            )}
          </span>
        }
        actions={
          <>
            {app.postingUrl && (
              <a
                href={app.postingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "sm")}
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Posting
              </a>
            )}
            <Link
              href={`/applications/${app.id}/edit`}
              className={buttonClasses("secondary", "sm")}
            >
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Link>
          </>
        }
      />

      {xpParam > 0 && (
        <Alert tone="success" className="mb-4" title={`+${xpParam} XP`}>
          Application saved and counted toward today&apos;s target.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StatusChangePanel
            applicationId={app.id}
            status={app.status}
            today={today}
          />
          <FollowUpForm
            applicationId={app.id}
            today={today}
            nextFollowUpLabel={
              app.followUpAt ? formatInTz(app.followUpAt, timezone) : null
            }
          />
          <InterviewsPanel applicationId={app.id} interviews={interviews} />

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Notes</CardTitle>
                <CardDescription>
                  Your private notes on this application.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {app.notes ? (
                <p className="text-sm whitespace-pre-wrap">{app.notes}</p>
              ) : (
                <p className="text-sm text-fg-muted">No notes yet.</p>
              )}
              <NoteForm applicationId={app.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>
                  Every stage change and event, with who recorded it.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ApplicationTimeline entries={timeline} timezone={timezone} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Detail label="Applied">
                  {formatInTz(app.appliedAt, timezone)}
                </Detail>
                <Detail label="Stage since">
                  {formatInTz(app.statusUpdatedAt, timezone)}
                </Detail>
                <Detail label="Next follow-up">
                  {formatInTz(app.followUpAt, timezone)}
                </Detail>
                <Detail label="Pay">{salary ?? "Not listed"}</Detail>
                <Detail label="Type">
                  {EMPLOYMENT_TYPE_LABELS[app.employmentType]}
                </Detail>
                <Detail label="Category">{app.jobCategory ?? "—"}</Detail>
                <Detail label="Req #">{app.requisitionNumber ?? "—"}</Detail>
                <Detail label="Found on">{SOURCE_LABELS[app.source]}</Detail>
                {app.submissionDestination && (
                  <Detail label="Submitted via">
                    {SOURCE_LABELS[app.submissionDestination]}
                  </Detail>
                )}
                <Detail label="Recruiter">
                  {app.recruiterContact ? (
                    <>
                      {app.recruiterContact.name}
                      {app.recruiterContact.email && (
                        <>
                          {" · "}
                          <a
                            href={`mailto:${app.recruiterContact.email}`}
                            className="text-accent hover:underline break-all"
                          >
                            {app.recruiterContact.email}
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </Detail>
                <Detail label="Resume">
                  {app.resumeVersion?.name ?? "Not recorded"}
                </Detail>
                <Detail label="Cover letter">
                  {app.coverLetter?.name ?? "Not recorded"}
                </Detail>
                <Detail label="Added">
                  {formatInTz(app.createdAt, timezone)} ·{" "}
                  {RECORD_ORIGIN_LABELS[app.createdVia]}
                </Detail>
              </dl>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge tone={app.isQualified ? "success" : "warning"}>
                  {app.isQualified ? "Meets requirements" : "Requirements gap"}
                </Badge>
                {app.requiresCompanyVehicle && (
                  <Badge tone="neutral">Company vehicle</Badge>
                )}
                {app.requiresDrivingRecord && (
                  <Badge tone="neutral">Driving record</Badge>
                )}
                {app.requiresCdl && <Badge tone="neutral">CDL</Badge>}
              </div>
            </CardContent>
          </Card>

          {app.offers.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Offer{app.offers.length > 1 ? "s" : ""}</CardTitle>
                  <CardDescription>
                    As recorded on this application.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.offers.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-ctl border border-line bg-surface p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium tnum">
                        {formatCurrency(o.baseAmount)}{" "}
                        {SALARY_PERIOD_LABELS[o.period]}
                      </p>
                      <Badge
                        tone={
                          o.status === "ACCEPTED"
                            ? "success"
                            : o.status === "DECLINED" ||
                                o.status === "RESCINDED" ||
                                o.status === "EXPIRED"
                              ? "danger"
                              : "gold"
                        }
                      >
                        {OFFER_STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-fg-muted">
                      <dt>Hours / week</dt>
                      <dd className="tnum">{o.hoursPerWeek}</dd>
                      {o.signingBonus !== null && (
                        <>
                          <dt>Signing bonus</dt>
                          <dd className="tnum">
                            {formatCurrency(o.signingBonus)}
                          </dd>
                        </>
                      )}
                      {o.annualBonus !== null && (
                        <>
                          <dt>Annual bonus</dt>
                          <dd className="tnum">
                            {formatCurrency(o.annualBonus)}
                          </dd>
                        </>
                      )}
                      {o.startDate && (
                        <>
                          <dt>Start date</dt>
                          <dd className="tnum">
                            {formatInTz(o.startDate, timezone)}
                          </dd>
                        </>
                      )}
                      {o.decisionDue && (
                        <>
                          <dt>Decide by</dt>
                          <dd className="tnum">
                            {formatInTz(o.decisionDue, timezone)}
                          </dd>
                        </>
                      )}
                    </dl>
                    {o.notes && (
                      <p className="mt-2 text-xs text-fg-muted whitespace-pre-wrap">
                        {o.notes}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {app.jobDescription && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Job description</CardTitle>
                  <CardDescription>
                    As pasted when you saved it.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="text-sm text-accent cursor-pointer">
                    Show description
                  </summary>
                  <p className="mt-2 text-sm text-fg-muted whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {app.jobDescription}
                  </p>
                </details>
              </CardContent>
            </Card>
          )}

          <DangerZone
            applicationId={app.id}
            archived={app.archivedAt !== null}
            label={label}
          />
        </div>
      </div>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}
