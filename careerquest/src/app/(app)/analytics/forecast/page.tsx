import Link from "next/link";
import { LineChart, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getForecastData, MAX_FORECAST_APPLICATIONS } from "@/lib/forecast/queries";
import { computeForecast } from "@/lib/forecast/model";
import { parseRho } from "@/lib/forecast/clustering";
import { formatCount, formatRate } from "@/lib/forecast/format";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ClusteringCard, Methodology, NextApplicationsCard, ObservedTiles, RatesCard, ThresholdsCard, TimingCard } from "@/components/forecast/sections";
import { ScenarioPanel } from "@/components/forecast/scenario-panel";
import { ANALYTICS_TABS } from "@/components/forecast/nav";

export const metadata = { title: "Forecast · CareerQuest" };

/** Observed rate as an editable starting point for scenario mode ("" when there is no data). */
function pctString(rate: number | null): string {
  if (rate === null) return "";
  return String(Math.round(rate * 1000) / 10);
}

export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/analytics/forecast"), searchParams]);
  const rho = parseRho(sp.rho);
  const data = await getForecastData(user.id);
  const forecast = computeForecast(data.input, { rho, horizon: data.horizon });

  const header = (
    <>
      <PageHeader
        eyebrow="Estimate · from your own history"
        title="Forecast"
        description="Cautious projections from the applications you logged. Every estimate shows its uncertainty; nothing here predicts whether or when you will be hired."
      />
      <LinkTabs tabs={ANALYTICS_TABS} />
    </>
  );

  if (forecast.applied === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<LineChart className="h-8 w-8" aria-hidden />}
          title="No applied applications yet"
          description="There is nothing to forecast until you log applications you have sent. Until then, you can explore hypothetical rates below; nothing is estimated from your data."
          action={
            <Link href="/applications/new" className={buttonClasses("primary", "md")}>
              <Plus className="h-4 w-4" aria-hidden />
              Log an application
            </Link>
          }
        />
        <div className="mt-4 space-y-4">
          <ScenarioPanel initialInterviewPct="" initialOfferPct="" />
          <Methodology />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-3 mb-5">
        {data.capped && (
          <Alert tone="warning" title="Large history">
            Only the first {formatCount(MAX_FORECAST_APPLICATIONS)} applications were analyzed.
          </Alert>
        )}
        {forecast.quality === "prior-dominated" && (
          <Alert tone="warning" title="Mostly assumption so far">
            With {formatCount(forecast.applied)} applied application{forecast.applied === 1 ? "" : "s"}, the prior still carries{" "}
            {formatRate(forecast.interview.adjusted.priorWeight)} of the interview estimate. Treat these numbers as a starting point, not a measurement of
            your rate.
          </Alert>
        )}
        {forecast.quality === "limited" && (
          <Alert tone="info" title="Limited data">
            Your history amounts to about {formatCount(Math.round(forecast.design.nEff))} independent applications after the clustering adjustment, so the
            intervals below are wide. They narrow as you log more.
          </Alert>
        )}
        {forecast.recentAwaiting > 0 && (
          <Alert tone="info" title="Recent applications are still open">
            {formatCount(forecast.recentAwaiting)} application{forecast.recentAwaiting === 1 ? " was" : "s were"} sent in the last {forecast.pendingWindowDays}{" "}
            days and {forecast.recentAwaiting === 1 ? "has" : "have"} no response yet. Some may still lead to interviews, so the observed rates may rise.
          </Alert>
        )}
      </div>

      <ObservedTiles forecast={forecast} />

      <div className="space-y-4">
        <RatesCard forecast={forecast} />
        <ThresholdsCard forecast={forecast} />
        <div className="grid gap-4 lg:grid-cols-2">
          <NextApplicationsCard forecast={forecast} horizonFromProfile={data.horizonSource === "profile"} />
          <TimingCard forecast={forecast} />
        </div>
        <ClusteringCard forecast={forecast} rho={rho} />
        <ScenarioPanel initialInterviewPct={pctString(forecast.interview.observed.rate)} initialOfferPct={pctString(forecast.offer.observed.rate)} />
        <Methodology />
      </div>
    </>
  );
}
