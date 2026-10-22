"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { scenarioForecast, type ScenarioOutcome } from "@/lib/forecast/model";
import { formatCount, formatExpected, formatRate } from "@/lib/forecast/format";

function parsePct(raw: string, min: number, max: number): number | null {
  const v = Number(raw.replace(/[%\s]/g, ""));
  if (raw.trim() === "" || !Number.isFinite(v) || v < min || v > max) return null;
  return v / 100;
}

function Outcome({ title, o, apps }: { title: string; o: ScenarioOutcome; apps: number }) {
  return (
    <div className="rounded-ctl border border-line bg-surface p-3 text-sm">
      <p className="font-medium">
        {title} at {formatRate(o.rate)} per application
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        {o.thresholds.map((t) => (
          <div key={t.target}>
            <dt className="text-fg-muted">{Math.round(t.target * 100)}% chance after</dt>
            <dd className="mt-0.5 font-medium text-fg tnum">{t.applications === null ? "never (0%)" : `≈ ${formatCount(t.applications)} apps`}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-fg-muted">
        Within {formatCount(apps)} applications: chance of at least one {formatRate(o.probAtLeastOne)}, average {formatExpected(o.expected)}.
      </p>
    </div>
  );
}

/**
 * "What if my rates were…" — the user types hypothetical per-application rates; results are labeled
 * Hypothetical and assume a known rate and independent applications (the most optimistic reading).
 */
export function ScenarioPanel({ initialInterviewPct, initialOfferPct }: { initialInterviewPct: string; initialOfferPct: string }) {
  const id = useId();
  const [interview, setInterview] = useState(initialInterviewPct);
  const [offer, setOffer] = useState(initialOfferPct);
  const [apps, setApps] = useState("25");

  const pi = parsePct(interview, 0, 100);
  const po = parsePct(offer, 0, 100);
  const n = Number(apps);
  const nOk = apps.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 500;
  const result = pi !== null && po !== null && nOk ? scenarioForecast({ interviewRate: pi, offerRate: po, applications: n }) : null;

  return (
    <Card data-testid="fc-scenario">
      <CardHeader>
        <div>
          <CardTitle>Scenario mode</CardTitle>
          <CardDescription>Try rates you choose. These are not your data and not a prediction.</CardDescription>
        </div>
        <Badge tone="gold">Hypothetical</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Interview rate per application (%)" htmlFor={`${id}-i`} errors={interview.trim() !== "" && pi === null ? ["Enter 0–100."] : undefined}>
            <Input id={`${id}-i`} inputMode="decimal" value={interview} onChange={(e) => setInterview(e.target.value)} placeholder="e.g. 8" />
          </Field>
          <Field label="Offer rate per application (%)" htmlFor={`${id}-o`} errors={offer.trim() !== "" && po === null ? ["Enter 0–100."] : undefined}>
            <Input id={`${id}-o`} inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. 1" />
          </Field>
          <Field label="Additional applications" htmlFor={`${id}-n`} errors={apps.trim() !== "" && !nOk ? ["Enter a whole number from 1 to 500."] : undefined}>
            <Input id={`${id}-n`} inputMode="numeric" value={apps} onChange={(e) => setApps(e.target.value)} />
          </Field>
        </div>
        {result ? (
          <div className="grid gap-3 lg:grid-cols-2" aria-live="polite" data-testid="fc-scenario-result">
            <Outcome title="Interviews" o={result.interview} apps={result.applications} />
            <Outcome title="Offers" o={result.offer} apps={result.applications} />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Enter both rates and a number of applications to see a hypothetical result.</p>
        )}
        <p className="text-xs text-fg-muted">
          Hypothetical: treats your typed rates as exactly known and every application as independent. Real outcomes cluster by employer and season and
          your true rate is uncertain, so real-world results spread wider than this.
        </p>
      </CardContent>
    </Card>
  );
}
