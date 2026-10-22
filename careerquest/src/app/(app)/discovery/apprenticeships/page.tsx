import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listPrograms } from "@/lib/academy/programs/directory";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ProgramPortalList } from "@/components/discovery/program-portal-list";

export const metadata: Metadata = { title: "Apprenticeship portals · Job Discovery" };

export default async function ApprenticeshipPortalsPage() {
  const user = await requireUser("/discovery/apprenticeships");
  const directory = await listPrograms(user.id);
  const programs = directory.programs.map(({ interest, ...p }) => ({ ...p, tracked: interest !== null }));
  return (
    <div className="space-y-6">
      <Alert tone="warning" title="Apply on each program's own site">
        Apprenticeships recruit on their own schedules, often with short application windows. A program shows <strong>Open</strong> only when
        an official page stated a window that included the date it was checked. CareerQuest never applies for you — track your progress in the{" "}
        <Link href="/academy/apprenticeships" className="text-accent hover:underline">
          apprenticeship directory
        </Link>
        .
      </Alert>
      {directory.totalPrograms === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" aria-hidden />}
          title="No apprenticeship programs are loaded yet"
          description="The program list comes from CareerQuest's seeded reference data, which has not been loaded into this database. Nothing is shown instead of made-up programs."
          action={
            <Link href="/academy/apprenticeships" className={buttonClasses("secondary")}>
              Open the apprenticeship directory
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            {directory.totalPrograms} program{directory.totalPrograms === 1 ? "" : "s"} · you are tracking {directory.tracked}.{" "}
            <Link href="/academy/apprenticeships" className="text-accent hover:underline">
              Filter and track programs in the directory
            </Link>
          </p>
          <ProgramPortalList programs={programs} />
        </>
      )}
    </div>
  );
}
