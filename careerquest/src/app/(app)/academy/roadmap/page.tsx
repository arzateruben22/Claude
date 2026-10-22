import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { loadRoadmap } from "@/lib/academy/roadmap";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { FlagBadge } from "@/components/academy/badges";
import { CredentialComparison, FactCard, SourceLinks, checkedOn } from "@/components/academy/roadmap";

export const metadata: Metadata = { title: "Certification roadmap · Academy" };

export default async function RoadmapPage() {
  await requireUser("/academy/roadmap");
  const r = loadRoadmap();

  return (
    <>
      <PageHeader
        eyebrow="California Electrician Career Academy"
        title="Certification roadmap"
        description={`${r.programName ?? "California electrician certification"}: who needs it, the hours, the trainee route, fees, the exam, renewal and how it differs from an apprenticeship and a contractor license.`}
      />
      <AcademyTabs />
      <div className="space-y-6">
        <Alert tone="warning" title={`Verify on the official site before acting · facts last checked ${checkedOn(r.verifiedOn)}`}>
          <p>{r.verificationMethod ?? "The verification method for these facts was not recorded. Treat every figure as unverified."}</p>
          {r.mainUrl && (
            <a href={r.mainUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-accent hover:underline">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Official DIR electrician certification page
            </a>
          )}
          {r.administeredBy && <p className="mt-2 text-xs">{r.administeredBy}</p>}
        </Alert>

        {r.errors.length > 0 && (
          <Alert tone="danger" title="Some roadmap data could not be loaded">
            {r.errors.join(" ")}
          </Alert>
        )}

        {r.distinction && <CredentialComparison distinction={r.distinction} />}

        {r.classifications.length > 0 && (
          <section id="classifications" aria-labelledby="classifications-title" className="glass scroll-mt-24 rounded-card p-5">
            <h2 id="classifications-title" className="text-base font-semibold tracking-tight">
              Certification classifications and required hours
            </h2>
            <p className="mt-1 text-sm text-fg-muted">On-the-job hours working for a C-10 contractor that qualify you to sit for each exam.</p>
            <ul className="mt-4 space-y-3">
              {r.classifications.map((c) => (
                <li key={c.code} className="rounded-ctl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    <span className="text-lg font-semibold text-gold tnum">{c.hoursRequired !== null ? `${formatNumber(c.hoursRequired)} hours` : "Hours not recorded"}</span>
                    <FlagBadge flag={c.flag} />
                  </div>
                  {c.notes && (
                    <details className="mt-2 text-sm text-fg-muted">
                      <summary className="cursor-pointer text-xs text-accent">Work areas, caps and alternative routes</summary>
                      <p className="mt-2 leading-relaxed">{c.notes}</p>
                    </details>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                    {c.sourceUrl ? (
                      <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                        <ExternalLink className="h-3 w-3" aria-hidden /> Source
                      </a>
                    ) : (
                      <span className="text-warning">No source recorded</span>
                    )}
                    {c.verifiedOn && <span>Last checked {checkedOn(c.verifiedOn)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <FactCard id="trainee" title={r.trainee?.name ?? "Electrician Trainee route"} section={r.trainee}>
            {r.trainee && r.trainee.forms.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Official forms and pages</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {r.trainee.forms.map((f) => (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {f.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </FactCard>

          {r.fees && (
            <section id="fees" aria-labelledby="fees-title" className="glass scroll-mt-24 rounded-card p-5">
              <h2 id="fees-title" className="text-base font-semibold tracking-tight">
                State certification fees
              </h2>
              {r.fees.rows.length > 0 ? (
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Certification fees in {r.fees.currency}</caption>
                  <tbody>
                    {r.fees.rows.map((row) => (
                      <tr key={row.key} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-fg-muted">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {row.label}
                            <FlagBadge flag={row.flag} />
                          </span>
                        </th>
                        <td className="py-2 text-right font-medium tnum">{row.amount === 0 ? "No fee" : formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-sm text-fg-muted">No fee amounts were recorded.</p>
              )}
              {r.fees.notes && <p className="mt-3 text-xs leading-relaxed text-fg-muted">{r.fees.notes}</p>}
              <SourceLinks urls={r.fees.sources} verifiedOn={r.fees.verifiedOn} />
            </section>
          )}

          <FactCard id="exam" title="The certification exam" section={r.exam} />
          <FactCard id="renewal" title="Renewal" section={r.renewal} />

          <FactCard id="law" title="The law" section={r.law}>
            {r.law && r.law.exemptions.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Who is exempt</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-fg-muted">
                  {r.law.exemptions.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.law?.pending && (
              <div className="rounded-ctl border border-warning/30 bg-warning-soft p-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  Pending legislation: {r.law.pending.bill}
                  <FlagBadge flag={r.law.pending.flag ?? (r.law.pending.status ? null : "unverified")} />
                </p>
                {r.law.pending.title && <p className="mt-1 text-sm text-fg">{r.law.pending.title}</p>}
                {r.law.pending.summary && <p className="mt-1 text-sm text-fg-muted">{r.law.pending.summary}</p>}
                {r.law.pending.statusNote && <p className="mt-1 text-xs text-fg-muted">{r.law.pending.statusNote}</p>}
                {r.law.pending.sourceUrl && (
                  <a href={r.law.pending.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    <ExternalLink className="h-3 w-3" aria-hidden /> Bill text
                  </a>
                )}
              </div>
            )}
          </FactCard>

          <FactCard id="c10" title={r.contractor?.name ?? "CSLB C-10 Electrical Contractor license"} section={r.contractor}>
            {r.contractor && r.contractor.requirements.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Requirements</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-fg-muted">
                  {r.contractor.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.contractor && r.contractor.feeFacts.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">CSLB fees</p>
                <dl className="mt-1 space-y-1 text-sm">
                  {r.contractor.feeFacts.map((f) => (
                    <div key={f.label} className="flex flex-wrap gap-x-2">
                      <dt className="text-fg">{f.label}:</dt>
                      <dd className="text-fg-muted">
                        {f.value} <FlagBadge flag={f.flag} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {r.contractor?.bond && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Bond</p>
                <p className="mt-1 text-sm text-fg-muted">{r.contractor.bond}</p>
              </div>
            )}
          </FactCard>
        </div>

        {r.unverifiedItems.length > 0 && (
          <section id="unverified" aria-labelledby="unverified-title" className="rounded-card border border-warning/30 p-5">
            <h2 id="unverified-title" className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
              Open questions in the research
              <FlagBadge flag="unverified" />
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              These items could not be confirmed on an official page as of {checkedOn(r.verifiedOn)}. Do not rely on them without checking the
              official source.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
              {r.unverifiedItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-fg-subtle">
          CareerQuest is a study and planning tool. Nothing here is legal advice, and Academy progress is not a certification, a license or
          qualifying work experience. Verify on the official site before acting.
        </p>
      </div>
    </>
  );
}
