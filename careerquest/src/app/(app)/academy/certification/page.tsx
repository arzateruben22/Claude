import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getCertificationPageData } from "@/lib/academy/certification/service";
import { CERTIFICATION_DOC_KINDS } from "@/lib/documents/validation";
import { formatInTz } from "@/lib/applications/time";
import { XP } from "@/lib/game/xp-config";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { CertificationTimeline, ClassificationTabs } from "@/components/academy/records/certification-timeline";
import { CertificationForm } from "@/components/academy/records/certification-form";
import { VerifyCertification } from "@/components/academy/records/verify-certification";
import { DirLinks, EligibilityCard } from "@/components/academy/records/certification-cards";
import { DocumentList } from "@/components/academy/records/documents";
import { DocumentUploadForm } from "@/components/academy/records/document-upload-form";
import { formatDayKey } from "@/components/academy/records/format";

export const metadata: Metadata = { title: "Certification tracker · Academy" };

export default async function CertificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/academy/certification");
  const sp = await searchParams;
  const code = typeof sp.c === "string" && /^[A-Z][A-Z0-9_]{0,59}$/.test(sp.c) ? sp.c : null;
  const data = await getCertificationPageData(user.id, code);
  if (!data) notFound();
  const r = data.requirement;
  const certificates = data.documents.filter((d) => d.kind === "CERTIFICATE").map((d) => ({ id: d.id, fileName: d.fileName }));

  return (
    <>
      <PageHeader
        eyebrow="California Electrician Career Academy"
        title="Certification tracker"
        description="Trainee registration, school, exam and certification dates on one timeline, with renewal reminders and an eligibility estimate from your verified hours."
      />
      <AcademyTabs />
      <div className="space-y-6">
        <ClassificationTabs requirements={data.requirements} current={r.code} tracked={data.trackedClassifications} />

        <Alert tone="info" title="Everything here is self-reported">
          CareerQuest does not check DIR records. Dates you enter are shown as self-reported; derived dates are labelled Estimate. A
          certification shows as verified only with an attached certificate, and is still self-attested.
        </Alert>

        {r.source === "seed-file" && (
          <Alert tone="warning" title="Reference data read from the seed file">
            The certification requirements have not been loaded into the database yet, so they are read directly from the researched seed
            file. Run <code>npm run db:seed</code> to load them.
          </Alert>
        )}

        {data.reminders.length > 0 && (
          <div className="space-y-2" aria-label="Reminders">
            {data.reminders.map((m) => (
              <Alert key={m.key} tone={m.tone} title={m.title}>
                {m.body}
              </Alert>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{r.name} timeline</CardTitle>
                <CardDescription>{data.hasRecord ? "From the dates you entered." : "No dates entered yet — add them below."}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <CertificationTimeline steps={data.timeline} />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Exam eligibility estimate</CardTitle>
                  <CardDescription>Verified hours vs the {r.name} requirement.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <EligibilityCard estimate={data.eligibility} requirement={r} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Verified certification</CardTitle>
                  <CardDescription>Requires a certificate document.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <VerifyCertification
                  classification={r.code}
                  classificationName={r.name}
                  certifiedAtLabel={data.dates.certifiedAt ? formatDayKey(data.dates.certifiedAt) : null}
                  verification={
                    data.verification
                      ? {
                          documentId: data.verification.documentId,
                          fileName: data.verification.fileName,
                          verifiedAtLabel: formatInTz(data.verification.verifiedAt, data.timezone),
                        }
                      : null
                  }
                  certificates={certificates}
                  xpReward={XP.CERTIFICATION_VERIFIED}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your dates</CardTitle>
              <CardDescription>Enter what has happened so far. Leave anything that has not happened empty.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CertificationForm key={r.code} classification={r.code} classificationName={r.name} dates={data.dates} notes={data.notes} todayKey={data.todayKey} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Certificates and trainee cards</CardTitle>
                <CardDescription>Stored privately; only you can download them.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentUploadForm kinds={CERTIFICATION_DOC_KINDS} defaultKind="CERTIFICATE" />
              <DocumentList
                documents={data.documents}
                timezone={data.timezone}
                empty="No certificates or trainee cards uploaded yet."
                deleteWarning="A certification it verifies will no longer be marked verified."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Official DIR resources</CardTitle>
                <CardDescription>Forms, rules and exam information.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DirLinks links={data.dirLinks} verifiedOn={data.factsVerifiedOn} />
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-fg-subtle">
          Certification, an apprenticeship completion and a CSLB C-10 contractor license are different credentials; none automatically
          grants the others. Game XP and milestones are not a certification or a license.
        </p>
      </div>
    </>
  );
}
