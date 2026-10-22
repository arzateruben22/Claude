import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { DirectoryEntry } from "@/lib/academy/programs/directory";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClasses } from "@/components/ui/button";
import { FactList, VerifiedOn, programFactRows } from "./program-facts";
import { InterestStatusBadge, RecruitmentBadge, UnionBadge } from "./program-badges";
import { OutboundLink } from "./external-link";
import { TrackProgramButton } from "./track-program-button";

/** One program in the directory list: headline facts, recruitment status and the user's status. */
export function ProgramCard({ program }: { program: DirectoryEntry }) {
  const p = program;
  const headingId = `program-${p.slug}`;
  return (
    <article aria-labelledby={headingId} className="glass flex min-w-0 flex-col rounded-card p-5" data-testid="program-card">
      <div className="flex flex-wrap items-center gap-2">
        <RecruitmentBadge status={p.recruitmentStatus} />
        <UnionBadge isUnion={p.isUnion} />
        <Badge tone="neutral">
          <MapPin className="h-3 w-3" aria-hidden />
          {p.region}
        </Badge>
      </div>
      <h2 id={headingId} className="mt-3 text-base font-semibold leading-snug tracking-tight">
        <Link href={`/academy/apprenticeships/${p.slug}`} className="hover:underline">
          {p.name}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{p.sponsor}</p>

      <div className="mt-4">
        <FactList rows={programFactRows(p)} compact />
      </div>

      {p.recruitmentNote && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-accent">Recruitment note</summary>
          <p className="mt-1.5 leading-relaxed text-fg-muted">{p.recruitmentNote}</p>
        </details>
      )}

      <div className="mt-4 rounded-ctl border border-line p-3">
        {p.interest ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-fg-muted">Your status</span>
              <InterestStatusBadge status={p.interest.status} />
            </div>
            {p.interest.progress.total > 0 && (
              <div>
                <p className="text-xs text-fg-subtle tnum">
                  Checklist {p.interest.progress.done}/{p.interest.progress.total}
                </p>
                <ProgressBar value={p.interest.progress.done} max={p.interest.progress.total} className="mt-1 h-1.5" label={`Checklist for ${p.name}`} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-muted">Not on your list yet.</p>
            <TrackProgramButton programId={p.id} programName={p.name} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/academy/apprenticeships/${p.slug}`} className={buttonClasses("primary", "sm")}>
          Details & checklist
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <OutboundLink href={p.applyUrl}>Application info</OutboundLink>
        <OutboundLink href={p.website}>Program website</OutboundLink>
      </div>
      <VerifiedOn dateKey={p.verifiedOnKey} className="mt-3" />
    </article>
  );
}
