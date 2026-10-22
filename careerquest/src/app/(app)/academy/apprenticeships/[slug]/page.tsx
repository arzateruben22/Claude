import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getProgramBySlug } from "@/lib/academy/programs/directory";
import { recruitmentBadge } from "@/lib/academy/programs/labels";
import { dateKey, todayInTz } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { FactList, RequirementList, SourceList, VerifiedOn, programFactRows } from "@/components/academy/records/program-facts";
import { InterestStatusBadge, RecruitmentBadge, UnionBadge } from "@/components/academy/records/program-badges";
import { OutboundLink } from "@/components/academy/records/external-link";
import { ProgramInterestForm } from "@/components/academy/records/program-interest-form";
import { ProgramChecklist } from "@/components/academy/records/program-checklist";
import { formatDayKey } from "@/components/academy/records/format";

export const metadata: Metadata = { title: "Apprenticeship program · Academy" };

function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`glass rounded-card p-5 ${className ?? ""}`}>
      <h2 id={id} className="text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/academy/apprenticeships/${encodeURIComponent(slug)}`);
  const found = await getProgramBySlug(user.id, slug);
  if (!found) notFound();
  const { program: p, timezone } = found;
  const todayKey = dateKey(todayInTz(timezone));
  const badge = recruitmentBadge(p.recruitmentStatus);
  const phones = p.contact.phone ? p.contact.phone.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? [] : [];

  return (
    <>
      <PageHeader eyebrow="Apprenticeship directory" title={p.name} description={p.sponsor} />
      <AcademyTabs />
      <Link href="/academy/apprenticeships" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All programs
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-6">
          <Section id="recruitment" title="Recruitment status">
            <div className="flex flex-wrap items-center gap-2">
              <RecruitmentBadge status={p.recruitmentStatus} />
              <UnionBadge isUnion={p.isUnion} />
              <Badge tone="neutral">
                <MapPin className="h-3 w-3" aria-hidden />
                {p.region}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-fg-muted">{badge.description}</p>
            {p.recruitmentNote && <p className="mt-3 text-sm leading-relaxed text-fg">{p.recruitmentNote}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <OutboundLink href={p.applyUrl}>Application information</OutboundLink>
              <OutboundLink href={p.website}>Program website</OutboundLink>
            </div>
            <VerifiedOn dateKey={p.verifiedOnKey} className="mt-3" />
          </Section>

          <Section id="facts" title="Training, pay and fees">
            <FactList rows={programFactRows(p)} />
          </Section>

          <Section id="eligibility" title="Eligibility">
            <RequirementList items={p.eligibility} empty="No eligibility requirements were retrieved from official sources. Ask the program." />
          </Section>

          <Section id="process" title="How to apply">
            <RequirementList items={p.processSteps} ordered empty="No application steps were retrieved from official sources. Ask the program." />
          </Section>

          <Section id="contact" title="Contact">
            <dl className="space-y-2 text-sm">
              {p.contact.phone && (
                <div>
                  <dt className="text-xs text-fg-subtle">Phone</dt>
                  <dd className="mt-0.5 space-y-1">
                    {!(phones.length === 1 && phones[0] === p.contact.phone.trim()) && <p className="text-fg">{p.contact.phone}</p>}
                    {phones.length > 0 && (
                      <p className="flex flex-wrap gap-x-3 gap-y-1">
                        {phones.map((ph) => (
                          <a key={ph} href={`tel:+1${ph.replace(/[^\d]/g, "")}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                            <Phone className="h-3.5 w-3.5" aria-hidden />
                            {ph}
                          </a>
                        ))}
                      </p>
                    )}
                  </dd>
                </div>
              )}
              {p.contact.email && (
                <div>
                  <dt className="text-xs text-fg-subtle">Email</dt>
                  <dd className="mt-0.5">
                    <a href={`mailto:${p.contact.email}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {p.contact.email}
                    </a>
                  </dd>
                </div>
              )}
              {p.contact.address && (
                <div>
                  <dt className="text-xs text-fg-subtle">Address</dt>
                  <dd className="mt-0.5 text-fg">{p.contact.address}</dd>
                </div>
              )}
              {!p.contact.phone && !p.contact.email && !p.contact.address && <p className="italic text-fg-muted">No contact details were retrieved.</p>}
            </dl>
          </Section>

          <Section id="sources" title="Sources">
            <SourceList urls={p.sourceUrls} title="Official and research sources" />
          </Section>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Your tracking">
          <Section id="tracker" title="Your application tracker">
            {p.interest && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                Current status <InterestStatusBadge status={p.interest.status} />
                {p.interest.appliedAtKey && <span className="text-xs">applied {formatDayKey(p.interest.appliedAtKey)}</span>}
              </p>
            )}
            <ProgramInterestForm
              programId={p.id}
              programName={p.name}
              todayKey={todayKey}
              interest={p.interest ? { status: p.interest.status, appliedAtKey: p.interest.appliedAtKey, notes: p.interest.notes } : null}
            />
            <p className="mt-3 text-xs text-fg-subtle">Self-reported. CareerQuest does not submit applications or contact programs for you.</p>
          </Section>

          <Section id="checklist" title="Application checklist">
            {p.interest ? (
              <ProgramChecklist programId={p.id} items={p.interest.checklist} />
            ) : (
              <p className="text-sm text-fg-muted">Save this program to your list to get a checklist built from its eligibility rules, application steps and the documents to have ready.</p>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
