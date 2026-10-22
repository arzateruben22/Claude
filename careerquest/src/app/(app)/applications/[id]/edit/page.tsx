import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { updateApplicationAction } from "@/lib/applications/actions";
import {
  getApplicationForEdit,
  listDocumentOptions,
  userTimezone,
} from "@/lib/applications/service";
import { dateInputValue } from "@/lib/applications/time";
import { impliesSubmission } from "@/lib/applications/status";
import { PageHeader } from "@/components/ui";
import {
  ApplicationForm,
  type ApplicationFormValues,
} from "@/components/applications/application-form";

export const metadata: Metadata = { title: "Edit application" };

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [app, documents, timezone] = await Promise.all([
    getApplicationForEdit(user.id, id),
    listDocumentOptions(user.id),
    userTimezone(user.id),
  ]);
  if (!app) notFound();

  const initialValues: ApplicationFormValues = {
    companyName: app.companyName,
    positionTitle: app.positionTitle,
    jobCategory: app.jobCategory ?? "",
    location: app.location ?? "",
    remote: app.remote,
    employmentType: app.employmentType,
    postingUrl: app.postingUrl ?? "",
    source: app.source,
    submissionDestination: app.submissionDestination ?? "",
    requisitionNumber: app.requisitionNumber ?? "",
    jobDescription: app.jobDescription ?? "",
    salaryMin: app.salaryMin === null ? "" : String(app.salaryMin),
    salaryMax: app.salaryMax === null ? "" : String(app.salaryMax),
    salaryPeriod: app.salaryPeriod ?? "",
    status: app.status,
    appliedAt: dateInputValue(app.appliedAt, timezone),
    followUpAt: dateInputValue(app.followUpAt, timezone),
    isQualified: app.isQualified,
    requiresCompanyVehicle: app.requiresCompanyVehicle,
    requiresDrivingRecord: app.requiresDrivingRecord,
    requiresCdl: app.requiresCdl,
    recruiterName: app.recruiterContact?.name ?? "",
    recruiterEmail: app.recruiterContact?.email ?? "",
    notes: app.notes ?? "",
    resumeVersionId: app.resumeVersionId ?? "",
    coverLetterVersionId: app.coverLetterVersionId ?? "",
  };

  return (
    <div className="max-w-3xl">
      <Link
        href={`/applications/${id}`}
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg mb-3"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to application
      </Link>
      <PageHeader
        eyebrow="Tracker"
        title={`Edit: ${app.positionTitle}`}
        description={app.companyName}
      />
      <ApplicationForm
        mode="edit"
        action={updateApplicationAction}
        applicationId={id}
        initialValues={initialValues}
        documents={documents}
        cancelHref={`/applications/${id}`}
        today={dateInputValue(new Date(), timezone)}
        appliedEditable={app.appliedAt !== null || impliesSubmission(app.status)}
      />
    </div>
  );
}
