import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getCareerMapData } from "@/lib/career-map/service";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { CareerMapExplorer } from "@/components/career-map/career-map-explorer";
import { MapLegend } from "@/components/career-map/legend";
import { CredentialCompare, ResearchNote } from "@/components/career-map/credential-compare";

export const metadata: Metadata = { title: "Career Map" };

export default async function CareerMapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/career-map");
  const sp = await searchParams;
  const view = await getCareerMapData(user.id);
  const requested = typeof sp.node === "string" ? sp.node : null;

  return (
    <>
      <PageHeader
        eyebrow="Plan your path"
        title="Career Map"
        description="Your electrician path from first steps to certification and beyond, with side branches into related trades. Every status is worked out from your own data, with the evidence shown."
      />
      <div className="space-y-5">
        <Alert tone="info" title="A planning tool, not a credential">
          Completing or marking a stop here records your plan and progress inside CareerQuest. It is not a license, a certification or proof of
          hours, and no employer or agency sees it.
        </Alert>
        {view.seed.errors.length > 0 && (
          <Alert tone="warning" title="Some research data could not be loaded">
            Figures from the missing files are left out rather than guessed: {view.seed.errors.join(" ")}
          </Alert>
        )}
        <MapLegend counts={view.counts} />
        <CareerMapExplorer view={view} initialKey={requested} />
        <CredentialCompare facts={view.distinction} />
        <ResearchNote seed={view.seed} />
      </div>
    </>
  );
}
