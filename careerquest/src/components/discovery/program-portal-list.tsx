import Link from "next/link";
import { Badge, Card, CardContent } from "@/components/ui";
import { recruitmentBadge } from "@/lib/academy/programs/labels";
import type { ProgramView } from "@/lib/academy/programs/directory";
import { OutboundLink, hostLabel } from "./discovery-parts";

function dayLabel(key: string | null): string | null {
  if (!key) return null;
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Apprenticeship programs (seeded reference facts) with links to their official portals. */
export function ProgramPortalList({ programs }: { programs: Array<ProgramView & { tracked: boolean }> }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {programs.map((p) => {
        const badge = recruitmentBadge(p.recruitmentStatus);
        const checked = dayLabel(p.verifiedOnKey);
        return (
          <li key={p.id}>
            <Card className="h-full">
              <CardContent className="space-y-2 pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{p.name}</h3>
                    <p className="break-words text-xs text-fg-muted">
                      {p.sponsor} · {p.region}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:justify-end">
                    <Badge tone={p.isUnion ? "accent" : "neutral"}>{p.isUnion ? "Union" : "Non-union"}</Badge>
                    <Badge tone={badge.tone} title={badge.description}>
                      {badge.label}
                    </Badge>
                    {p.tracked && <Badge tone="success">Tracking</Badge>}
                  </div>
                </div>
                <p className="text-xs text-fg-subtle">{checked ? `Recruitment status last checked ${checked}.` : "Recruitment status not verified yet."}</p>
                {p.startingWage && (
                  <p className="text-xs text-fg-muted">
                    Starting wage: {p.startingWage} {p.startingWageVerified ? "(from an official source)" : "(Unverified)"}
                  </p>
                )}
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
                  {p.applyUrl && <OutboundLink href={p.applyUrl}>How to apply: {hostLabel(p.applyUrl)}</OutboundLink>}
                  {p.website && p.website !== p.applyUrl && <OutboundLink href={p.website}>Official site: {hostLabel(p.website)}</OutboundLink>}
                  <Link href={`/academy/apprenticeships/${p.slug}`} className="text-accent hover:underline">
                    Details, eligibility and checklist
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
