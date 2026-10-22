import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getWorkHourEntry, listProgramOptions, userTimezone } from "@/lib/academy/hours/service";
import { listDocuments } from "@/lib/documents/service";
import { HOUR_PROOF_KINDS } from "@/lib/documents/validation";
import { dateKey, todayInTz } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { HourEntryForm } from "@/components/academy/records/hour-entry-form";
import { VerificationBadge } from "@/components/academy/records/hour-entry-list";
import { formatDayKey, formatHours } from "@/components/academy/records/format";

export const metadata: Metadata = { title: "Edit hours · Academy" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditHoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("/academy/hours");
  if (!UUID.test(id)) notFound();
  const entry = await getWorkHourEntry(user.id, id);
  if (!entry) notFound();
  const [programs, documents, timezone] = await Promise.all([listProgramOptions(), listDocuments(user.id, HOUR_PROOF_KINDS), userTimezone(user.id)]);
  const todayKey = dateKey(todayInTz(timezone));

  return (
    <>
      <PageHeader
        eyebrow="Training hours"
        title="Edit entry"
        description={`${formatHours(entry.hours)} on ${formatDayKey(entry.dateKey)} at ${entry.employer}.`}
      />
      <AcademyTabs />
      <Link href="/academy/hours" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to training hours
      </Link>
      <Card>
        <CardContent className="pt-5">
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            Currently <VerificationBadge verification={entry.verification} />
            {entry.document && <span className="text-xs">with {entry.document.fileName}</span>}
          </p>
          <HourEntryForm
            todayKey={todayKey}
            programs={programs}
            documents={documents}
            entry={{
              id: entry.id,
              employer: entry.employer,
              supervisor: entry.supervisor,
              dateKey: entry.dateKey,
              hours: entry.hours,
              workType: entry.workType,
              programId: entry.program?.id ?? null,
              description: entry.description,
              verification: entry.verification,
              documentId: entry.document?.id ?? null,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
