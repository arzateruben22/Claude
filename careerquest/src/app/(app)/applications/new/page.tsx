import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { createApplicationAction } from "@/lib/applications/actions";
import { listDocumentOptions, userTimezone } from "@/lib/applications/service";
import { dateInputValue } from "@/lib/applications/time";
import { PageHeader } from "@/components/ui";
import { ApplicationForm } from "@/components/applications/application-form";

export const metadata: Metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const user = await requireUser();
  const [documents, timezone] = await Promise.all([
    listDocumentOptions(user.id),
    userTimezone(user.id),
  ]);
  return (
    <div className="max-w-3xl">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg mb-3"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All applications
      </Link>
      <PageHeader
        eyebrow="Tracker"
        title="New application"
        description="Log a job you applied to, or save one you plan to apply to. Only the company and title are required."
      />
      <ApplicationForm
        mode="create"
        action={createApplicationAction}
        documents={documents}
        cancelHref="/applications"
        today={dateInputValue(new Date(), timezone)}
      />
    </div>
  );
}
