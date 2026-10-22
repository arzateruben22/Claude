import type { ReactNode } from "react";
import { Clock, Handshake, Mic, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { DEFAULT_RHO, RHO_OPTIONS } from "@/lib/forecast/clustering";
import type { ForecastResult, OutcomeForecast, Posterior } from "@/lib/forecast/model";
import { CREDIBLE_MASS, PREDICTIVE_MASS } from "@/lib/forecast/model";
import { chancePhrase, expectationSentence, formatCount, formatDays, formatDaysRange, formatExpected, formatRange, formatRate, formatRateInterval } from "@/lib/forecast/format";
import { ProbabilityChart } from "./probability-chart";

const NOUN: Record<OutcomeForecast["key"], { one: string; label: string }> = {
  interview: { one: "interview", label: "Interview" },
  offer: { one: "offer", label: "Offer" },
};

/** Label chip used everywhere a number is shown, so observed and estimated values never blur. */
export function KindBadge({ kind }: { kind: "observed" | "estimate" | "hypothetical" | "assumption" }) {
  const map = {
    observed: { tone: "info" as const, text: "Observed" },
    estimate: { tone: "accent" as const, text: "Estimate" },
    hypothetical: { tone: "gold" as const, text: "Hypothetical" },
    assumption: { tone: "neutral" as const, text: "Assumption" },
  };
  const m = map[kind];
  return <Badge tone={m.tone}>{m.text}</Badge>;
}

export function ObservedTiles({ forecast }: { forecast: ForecastResult }) {
  const { interview, offer, timing } = forecast;
  const iqr = timing.q1 !== null && timing.q3 !== null ? `IQR ${formatDaysRange(timing.q1, timing.q3)}` : timing.n > 0 ? "IQR shown from 4 responses" : null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-5" role="list" aria-label="Observed counts">
      <div role="listitem" data-testid="fc-tile-applied">
        <StatTile label="Applied · Observed" value={formatCount(forecast.applied)} hint="Applications you sent (tracker)" icon={<Send className="h-4 w-4" aria-hidden />} />
      </div>
      <div role="listitem" data-testid="fc-tile-interviews">
        <StatTile
          label="Reached interview · Observed"
          value={formatCount(interview.observed.successes)}
          hint={`${formatCount(interview.observed.successes)} of ${formatCount(interview.observed.n)} = ${formatRate(interview.observed.rate)} observed`}
          icon={<Mic className="h-4 w-4" aria-hidden />}
        />
      </div>
      <div role="listitem" data-testid="fc-tile-offers">
        <StatTile
          label="Reached offer · Observed"
          value={formatCount(offer.observed.successes)}
          hint={`${formatCount(offer.observed.successes)} of ${formatCount(offer.observed.n)} = ${formatRate(offer.observed.rate)} observed`}
          icon={<Handshake className="h-4 w-4" aria-hidden />}
        />
      </div>
      <div role="listitem" data-testid="fc-tile-timing">
        <StatTile
          label="Median days to first response · Observed"
          value={timing.median === null ? "—" : formatDays(timing.median)}
          hint={timing.n === 0 ? "No dated responses yet" : `n = ${formatCount(timing.n)}${iqr ? ` · ${iqr}` : ""}`}
          icon={<Clock className="h-4 w-4" aria-hidden />}
        />
      </div>
    </div>
  );
}

function PosteriorCell({ p }: { p: Posterior }) {
  return (
    <>
      <span className="font-medium text-fg">{formatRate(p.mean)}</span>
      <span className="block text-xs text-fg-muted">{formatRateInterval(p.interval)}</span>
    </>
  );
}

export function RatesCard({ forecast }: { forecast: ForecastResult }) {
  const rows = [forecast.interview, forecast.offer];
  const clustered = forecast.design.deff > 1.0001;
  return (
    <Card data-testid="fc-rates">
      <CardHeader>
        <div>
          <CardTitle>Per-application probability</CardTitle>
          <CardDescription>
            Your observed share, the prior assumption, and the updated estimate with its {Math.round(CREDIBLE_MASS * 100)}% credible interval (where the
            true rate plausibly lies).
          </CardDescription>
        </div>
        <KindBadge kind="estimate" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-fg-muted border-b border-line">
                <th scope="col" className="px-5 py-2 font-medium">
                  Outcome
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Observed
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Prior (assumption)
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Estimate if independent
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Estimate with clustering
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tnum">
              {rows.map((o) => (
                <tr key={o.key} data-testid={`fc-rate-${o.key}`}>
                  <th scope="row" className="px-5 py-2.5 text-left font-medium align-top">
                    {NOUN[o.key].label}
                    {o.priorDominated && (
                      <span className="mt-1 block">
                        <Badge tone="warning">Mostly prior</Badge>
                      </span>
                    )}
                  </th>
                  <td className="px-2 py-2.5 align-top">
                    <span className="font-medium text-fg">{formatRate(o.observed.rate)}</span>
                    <span className="block text-xs text-fg-muted">
                      {formatCount(o.observed.successes)} of {formatCount(o.observed.n)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 align-top text-fg-muted">
                    Beta({o.prior.alpha}, {o.prior.beta})<span className="block text-xs">mean {formatRate(o.prior.mean)} · {formatRateInterval(o.prior.interval)}</span>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <PosteriorCell p={o.naive} />
                  </td>
                  <td className="px-5 py-2.5 align-top">
                    <PosteriorCell p={o.adjusted} />
                    <span className="block text-[11px] text-fg-subtle">prior weight {formatRate(o.adjusted.priorWeight)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-fg-muted">
          {clustered
            ? "The clustering estimate counts your applications as fewer independent pieces of evidence (see below), so its interval is wider."
            : "Every employer appears once, so the clustering adjustment does not change these numbers."}{" "}
          “Mostly prior” means the assumption still outweighs your own data; log more applications before relying on it.
        </p>
      </CardContent>
    </Card>
  );
}

export function ThresholdsCard({ forecast }: { forecast: ForecastResult }) {
  const { interview, offer } = forecast;
  const headline = interview.thresholds.find((t) => t.target === 0.5);
  const clustered = forecast.design.deff > 1.0001;
  const t90 = interview.thresholds.find((t) => t.target === 0.9);
  const summary = t90
    ? `The line rises with each extra application but never reaches certainty. Reaching ${chancePhrase(0.9)} of at least one more interview takes roughly ${formatRange(t90.range)} more applications (estimate).`
    : "The line rises with each extra application but never reaches certainty.";
  return (
    <Card data-testid="fc-thresholds">
      <CardHeader>
        <div>
          <CardTitle>How many more applications?</CardTitle>
          <CardDescription>Chance of at least one more interview (or offer) as you keep applying, if your current rates hold.</CardDescription>
        </div>
        <KindBadge kind="estimate" />
      </CardHeader>
      <CardContent className="space-y-4">
        {headline && (
          <p className="text-sm text-fg" data-testid="fc-headline">
            {expectationSentence("interview", headline.range)}
          </p>
        )}
        <ProbabilityChart points={forecast.chart} showNaive={clustered} summary={summary} />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[520px]">
            <caption className="sr-only">Additional applications needed for a given chance of at least one interview or offer</caption>
            <thead>
              <tr className="text-left text-xs text-fg-muted border-b border-line">
                <th scope="col" className="px-5 py-2 font-medium">
                  Chance of at least one…
                </th>
                {interview.thresholds.map((t) => (
                  <th key={t.target} scope="col" className="px-2 py-2 font-medium last:pr-5">
                    {Math.round(t.target * 100)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tnum">
              {[interview, offer].map((o) => (
                <tr key={o.key} data-testid={`fc-threshold-${o.key}`}>
                  <th scope="row" className="px-5 py-2.5 text-left font-medium align-top">
                    {NOUN[o.key].one}
                  </th>
                  {o.thresholds.map((t) => (
                    <td key={t.target} className="px-2 py-2.5 align-top last:pr-5">
                      <span className="font-medium text-fg whitespace-nowrap">{formatRange(t.range)}</span>
                      {clustered && t.naive !== null && t.adjusted !== null && (
                        <span className="block text-[11px] text-fg-subtle whitespace-nowrap">
                          {formatCount(t.naive)} if independent · {formatCount(t.adjusted)} with clustering
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-fg-muted">
          Ranges are additional applications from today, rounded outward so they do not look more precise than your data. They span the
          independent-outcome answer and the clustering-adjusted one. An offer is not a hire, and no number of applications guarantees either; these
          are probabilities under assumptions, not a schedule.
        </p>
      </CardContent>
    </Card>
  );
}

export function NextApplicationsCard({ forecast, horizonFromProfile = false }: { forecast: ForecastResult; horizonFromProfile?: boolean }) {
  const rows = [forecast.interview, forecast.offer];
  const n = forecast.interview.next.applications;
  return (
    <Card data-testid="fc-next">
      <CardHeader>
        <div>
          <CardTitle>Your next {formatCount(n)} applications</CardTitle>
          <CardDescription>
            {Math.round(PREDICTIVE_MASS * 100)}% predictive range (beta-binomial, clustering-adjusted).{" "}
            {horizonFromProfile ? `${formatCount(n)} is your weekly application target.` : `${formatCount(n)} is a default look-ahead; set a weekly target in Settings to use yours.`}
          </CardDescription>
        </div>
        <KindBadge kind="estimate" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {rows.map((o) => (
            <li key={o.key} className="rounded-ctl border border-line bg-surface px-3 py-2.5" data-testid={`fc-next-${o.key}`}>
              <p>
                If your current rates hold, these {formatCount(n)} applications would most likely produce{" "}
                <strong className="font-semibold tnum">
                  {o.next.low === o.next.high ? formatCount(o.next.low) : `${formatCount(o.next.low)}–${formatCount(o.next.high)}`}
                </strong>{" "}
                {NOUN[o.key].one}s (average {formatExpected(o.next.expected)}).
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">Chance of at least one: {formatRate(o.next.probAtLeastOne)} (estimate).</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ClusteringCard({ forecast, rho }: { forecast: ForecastResult; rho: number }) {
  const d = forecast.design;
  const stat = (label: string, value: ReactNode) => (
    <div className="rounded-ctl border border-line bg-surface px-3 py-2">
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tnum">{value}</dd>
    </div>
  );
  return (
    <Card data-testid="fc-clustering">
      <CardHeader>
        <div>
          <CardTitle>Outcomes are not independent</CardTitle>
          <CardDescription>
            Applications to the same employer share a recruiter, screening rules and hiring freezes, so their outcomes move together. We correct for
            that with a design effect.
          </CardDescription>
        </div>
        <KindBadge kind="assumption" />
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {stat("Employers (clusters)", formatCount(d.clusters))}
          {stat("Size-weighted cluster size", d.meanClusterSize.toFixed(2))}
          {stat("Largest cluster", formatCount(d.largestCluster))}
          {stat("Assumed correlation ρ", d.rho.toFixed(1))}
          {stat("Design effect", `×${d.deff.toFixed(2)}`)}
          {stat("Effective applications", `${formatCount(Math.round(d.nEff))} of ${formatCount(d.n)}`)}
        </dl>
        <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Change the assumed correlation">
          <div>
            <Label htmlFor="fc-rho">Correlation within an employer (ρ)</Label>
            <Select id="fc-rho" name="rho" defaultValue={String(rho)} className="w-56">
              {RHO_OPTIONS.map((r) => (
                <option key={r} value={String(r)}>
                  {r.toFixed(1)}
                  {r === 0 ? " (independent)" : r === DEFAULT_RHO ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Recalculate
          </Button>
        </form>
        <p className="text-xs text-fg-muted">
          n_eff = n / (1 + ρ(m̄ − 1)), with m̄ = Σm²/Σm the size-weighted number of applications per employer. ρ = {DEFAULT_RHO} is a stated assumption,
          not something your tracker can measure yet. Other shared factors (the same résumé, the season, the job board) are not modelled; they would
          lower the effective number further, so even the adjusted figures lean optimistic.
        </p>
      </CardContent>
    </Card>
  );
}

export function TimingCard({ forecast }: { forecast: ForecastResult }) {
  const t = forecast.timing;
  return (
    <Card data-testid="fc-timing">
      <CardHeader>
        <div>
          <CardTitle>Time to first response</CardTitle>
          <CardDescription>Days from applying to the first employer reaction (screening, interview, offer or rejection).</CardDescription>
        </div>
        <KindBadge kind="observed" />
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {t.n === 0 ? (
          <p className="text-fg-muted">No responses with dates yet. Log responses on your applications to see how long employers take.</p>
        ) : (
          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-ctl border border-line bg-surface px-3 py-2">
              <dt className="text-[11px] text-fg-muted">Median</dt>
              <dd className="font-medium tnum">{formatDays(t.median)}</dd>
            </div>
            <div className="rounded-ctl border border-line bg-surface px-3 py-2">
              <dt className="text-[11px] text-fg-muted">Middle half (IQR)</dt>
              <dd className="font-medium tnum">{t.q1 !== null && t.q3 !== null ? formatDaysRange(t.q1, t.q3) : "needs 4+"}</dd>
            </div>
            <div className="rounded-ctl border border-line bg-surface px-3 py-2">
              <dt className="text-[11px] text-fg-muted">Based on</dt>
              <dd className="font-medium tnum">{formatCount(t.n)} responses</dd>
            </div>
          </dl>
        )}
        <p className="text-xs text-fg-muted">
          {formatCount(t.awaiting)} applied application{t.awaiting === 1 ? " has" : "s have"} no recorded response yet. They cannot add a duration, so the
          observed median is biased short: slow employers are under-represented until they answer.
        </p>
      </CardContent>
    </Card>
  );
}

export function Methodology() {
  return (
    <section aria-labelledby="fc-method" className="glass rounded-card p-5 text-sm text-fg-muted space-y-3" data-testid="fc-methodology">
      <h2 id="fc-method" className="text-sm font-medium text-fg">
        Methodology
      </h2>
      <p>
        <strong className="text-fg font-medium">Observed</strong> numbers are counts from your tracker, using the same definitions as Analytics: an
        application counts once it has an application date or a submitted event, and it “reached an interview” or “reached an offer” when its status,
        history or logged events show that stage (later stages imply earlier ones). Archived and merged records are left out.
      </p>
      <p>
        <strong className="text-fg font-medium">Model.</strong> Each application is treated as a trial with an unknown per-application probability p of
        reaching an interview (and separately an offer). We start from a weakly informative prior and update it with your counts (Beta-Binomial). For
        interviews the prior is Beta(1, 9): a mean of 10% with a 95% prior interval of about 0.3%–34%, carrying the weight of 10 applications. For
        offers it is Beta(1, 49): a mean of 2% with a 95% prior interval of about 0.05%–7%, carrying the weight of 50 applications. These are modelling
        assumptions chosen to be vague, not statistics about the job market. They keep a handful of early results from producing extreme estimates, and
        after a few dozen applications your own data dominate. With k successes in n applications the posterior is Beta(α + k, β + n − k); intervals
        are equal-tailed 95% credible intervals.
      </p>
      <p>
        <strong className="text-fg font-medium">Applications needed.</strong> The chance of at least one success in the next m applications is the
        posterior predictive 1 − B(α, β + m) / B(α, β), which averages over the uncertainty in p instead of plugging in a single rate (that would be
        overconfident). We report the smallest m reaching 50%, 80% and 90%, as a range spanning the independent and clustering-adjusted answers, rounded
        outward (to 1, 5, 10, 50 or 100 depending on size). The shaded chart band shows the same curve if the true rate sat at either end of its 95%
        interval. The “next N applications” range is the central 80% of the beta-binomial predictive distribution.
      </p>
      <p>
        <strong className="text-fg font-medium">Non-independence.</strong> Outcomes cluster: the same employer, the same résumé and the same season
        affect many applications at once. We adjust for employer clustering with the Kish design effect DEFF = 1 + ρ(m̄ − 1), where m̄ = Σm²/Σm is the
        size-weighted number of applications per employer and ρ the assumed within-employer correlation (default {DEFAULT_RHO}). Your counts are scaled to
        the effective sample size n / DEFF, which keeps the observed rate but treats the evidence as weaker. Résumé and seasonal effects are not
        modelled.
      </p>
      <p>
        <strong className="text-fg font-medium">What this cannot tell you.</strong> It assumes your future applications resemble your past ones (same
        kinds of roles, employers, materials and season). Applications still waiting for an answer count as “no interview yet”, which biases recent rates
        low. Nothing here predicts a hire, a start date or a recruitment date, and no number of applications guarantees an interview or a job.
      </p>
      <p>
        <strong className="text-fg font-medium">Scenario mode</strong> uses rates you type in, takes them as exactly known and treats applications as
        independent: the most optimistic reading. Its results are labeled Hypothetical.
      </p>
    </section>
  );
}
