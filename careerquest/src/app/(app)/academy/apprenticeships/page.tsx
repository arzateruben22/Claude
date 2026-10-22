import type { Metadata } from "next";
import { Building2, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listPrograms } from "@/lib/academy/programs/directory";
import { matchesProgramFilters, parseProgramFilters } from "@/lib/academy/programs/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { AcademyTabs } from "@/components/academy/academy-tabs";
import { ProgramCard } from "@/components/academy/records/program-card";
import { ProgramFilterForm } from "@/components/academy/records/program-filters";
import { formatDayKey } from "@/components/academy/records/format";

export const metadata: Metadata = { title: "Apprenticeships · Academy" };

export default async function ApprenticeshipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/academy/apprenticeships");
  const sp = await searchParams;
  const all = await listPrograms(user.id);
  const filters = parseProgramFilters(sp, all.regions);
  const programs = all.programs.filter((p) => matchesProgramFilters(p, filters));
  const latest = all.programs.reduce<string | null>((m, p) => (p.verifiedOnKey && (!m || p.verifiedOnKey > m) ? p.verifiedOnKey : m), null);

  return (
    <>
      <PageHeader
        eyebrow="California Electrician Career Academy"
        title="Apprenticeship directory"
        description="Paid, state-registered electrical apprenticeships in Los Angeles, Orange County and Southern California — eligibility, application steps, recruitment status and contacts, with sources."
      />
      <AcademyTabs />
      <div className="space-y-6">
        <Alert tone="warning" title={latest ? `Recruitment status last checked ${formatDayKey(latest)}` : "Recruitment status has not been verified"}>
          Application windows open and close on each program&apos;s own schedule. A program shows <strong>Open</strong> only when an
          official page stated a window that included the check date; anything else shows <strong>Closed</strong> or{" "}
          <strong>Unverified</strong>. Confirm on the program&apos;s site before you plan around a date. CareerQuest never applies for
          you.
        </Alert>

        {all.totalPrograms === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title="The apprenticeship directory has not been loaded yet"
            description={
              <>
                The program list comes from the seeded reference data. Run <code className="text-fg">npm run db:seed</code> once to load it;
                nothing on this page is made up in the meantime.
              </>
            }
          />
        ) : (
          <>
            <ProgramFilterForm regions={all.regions} filters={filters} />
            <p className="text-sm text-fg-muted" aria-live="polite">
              Showing {programs.length} of {all.totalPrograms} program{all.totalPrograms === 1 ? "" : "s"} · you are tracking {all.tracked}.
            </p>
            {programs.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-6 w-6" aria-hidden />}
                title="No programs match these filters"
                description="Try another region, or include both union and non-union programs."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {programs.map((p) => (
                  <ProgramCard key={p.id} program={p} />
                ))}
              </div>
            )}
          </>
        )}
        <p className="text-xs text-fg-subtle">
          Facts were researched from official program and DIR pages and are dated per program. Starting wages appear only where an
          official source stated them. Being accepted into an apprenticeship is not a certification or a license.
        </p>
      </div>
    </>
  );
}
