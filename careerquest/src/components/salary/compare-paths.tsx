"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { comparePaths, MAX_COMPARE_YEARS, MIN_COMPARE_YEARS } from "@/lib/salary/compare";
import { parseCompareValues, type CompareValues } from "@/lib/salary/forms";
import type { ApprenticeshipReference } from "@/lib/salary/reference";
import { BasisToggle } from "./calculator";
import { CitedValueNote } from "./cited-value";
import { PayDisclaimer } from "./disclaimer";
import { EarningsChart } from "./earnings-chart";
import { usd, usdRate } from "./format";
import { ScenarioBar, type ScenarioOption } from "./scenario-bar";

export type OfferPrefill = { id: string; label: string; basis: "HOURLY" | "ANNUAL"; amount: number; hoursPerWeek: number; overtimeHours: number };

type Key = keyof CompareValues;

const LABELS: [string, string] = ["A · Job now", "B · Apprenticeship"];

function citedDefaults(ref: ApprenticeshipReference | null): Pick<CompareValues, "bJourneyman" | "bStartPct"> {
  return {
    bJourneyman: ref?.journeymanRate ? ref.journeymanRate.value.toFixed(2) : "",
    bStartPct: ref?.firstPeriodPercent ? String(ref.firstPeriodPercent.value) : "",
  };
}

export function ComparePaths({
  initialValues,
  scenarios,
  reference,
  todayKey,
  offers,
}: {
  initialValues: CompareValues;
  scenarios: ScenarioOption<CompareValues>[];
  reference: ApprenticeshipReference | null;
  todayKey: string;
  offers: OfferPrefill[];
}) {
  const id = useId();
  const [values, setValues] = useState<CompareValues>(initialValues);
  const [offerId, setOfferId] = useState("");
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const parsed = parseCompareValues(values);
  const err = (k: Key) => (parsed.errors[k] && values[k].trim() !== "" ? [parsed.errors[k]!] : undefined);
  const result = parsed.a && parsed.b ? comparePaths(parsed.a, parsed.b, parsed.years) : null;
  const missing = Object.entries(parsed.errors)
    .filter(([k]) => values[k as Key].trim() === "")
    .map(([, m]) => m);

  const cited = citedDefaults(reference);
  const usesCited = cited.bJourneyman !== "" && values.bJourneyman === cited.bJourneyman && values.bStartPct === cited.bStartPct;
  const canRestore = (cited.bJourneyman !== "" || cited.bStartPct !== "") && !usesCited;

  const num = (k: Key, label: string, opts: { hint?: string; placeholder?: string; className?: string } = {}) => (
    <Field label={label} htmlFor={`${id}-${k}`} errors={err(k)} hint={opts.hint} className={opts.className}>
      <Input id={`${id}-${k}`} name={k} inputMode="decimal" value={values[k]} onChange={set(k)} placeholder={opts.placeholder} autoComplete="off" />
    </Field>
  );

  const fillFromOffer = (oid: string) => {
    setOfferId(oid);
    const o = offers.find((x) => x.id === oid);
    if (!o) return;
    setValues((v) => ({ ...v, aBasis: o.basis, aAmount: String(o.amount), aHours: String(o.hoursPerWeek), aOvertime: String(o.overtimeHours) }));
  };

  let summary = "";
  if (result) {
    const n = result.years;
    const lead = result.finalDiff >= 0 ? "B (apprenticeship)" : "A (job now)";
    const parts: string[] = [];
    if (result.bAheadFromStart) parts.push("Under these assumptions the apprenticeship is level or ahead on cumulative earnings from year 1.");
    else if (result.cumulativeCrossoverYear) parts.push(`Under these assumptions the apprenticeship catches up on cumulative earnings in year ${result.cumulativeCrossoverYear}.`);
    else parts.push(`Under these assumptions the apprenticeship does not catch up on cumulative earnings within ${n} years.`);
    if (!result.bAheadFromStart && result.annualCrossoverYear) parts.push(`Its yearly pay passes the job's in year ${result.annualCrossoverYear}.`);
    parts.push(`After ${n} years, ${lead} is ahead by about ${usd(Math.abs(result.finalDiff))} (estimate, before taxes).`);
    summary = parts.join(" ");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>A · Job available now</CardTitle>
              <CardDescription>A higher-paying job you could take today. All values are your own.</CardDescription>
            </div>
            <Badge tone="neutral">Your assumptions</Badge>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()} aria-label="Path A inputs" noValidate>
              {offers.length > 0 && (
                <Field label="Fill from a recorded offer (optional)" htmlFor={`${id}-offer`}>
                  <Select id={`${id}-offer`} value={offerId} onChange={(e) => fillFromOffer(e.target.value)}>
                    <option value="">Enter values yourself</option>
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <BasisToggle
                legend="Pay basis"
                name="aBasis"
                value={values.aBasis}
                options={[
                  { value: "ANNUAL", label: "Annual salary" },
                  { value: "HOURLY", label: "Hourly" },
                ]}
                onChange={(aBasis) => setValues((v) => ({ ...v, aBasis }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {num("aAmount", values.aBasis === "ANNUAL" ? "Annual salary (USD)" : "Hourly rate (USD)", { placeholder: values.aBasis === "ANNUAL" ? "e.g. 70000" : "e.g. 30" })}
                {num("aHours", "Hours per week")}
                {num("aRaise", "Expected raise per year (%)", { hint: "Assumption; 0 = none" })}
                {num("aOvertime", "Overtime hours/week at 1.5×", { hint: "Not guaranteed" })}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>B · Paid apprenticeship</CardTitle>
              <CardDescription>Starts at a % of the journeyman rate and steps up each period; the full rate applies after completion.</CardDescription>
            </div>
            {canRestore && (
              <Button variant="ghost" size="sm" onClick={() => setValues((v) => ({ ...v, ...cited }))}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Use cited values
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()} aria-label="Path B inputs" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  {num("bJourneyman", "Journeyman hourly rate (USD)")}
                  {reference?.journeymanRate && values.bJourneyman === cited.bJourneyman ? (
                    <CitedValueNote value={reference.journeymanRate} todayKey={todayKey} label={`${reference.classification} base rate, ${usdRate(reference.journeymanRate.value)}/h`} />
                  ) : (
                    <p className="mt-1 text-[11px] text-fg-subtle">Your figure.</p>
                  )}
                </div>
                <div>
                  {num("bStartPct", "Starting % of journeyman")}
                  {reference?.firstPeriodPercent && values.bStartPct === cited.bStartPct ? (
                    <CitedValueNote
                      value={reference.firstPeriodPercent}
                      todayKey={todayKey}
                      label={`First period at 0 hours${reference.firstPeriodRate ? ` (${usdRate(reference.firstPeriodRate)}/h)` : ""}`}
                    />
                  ) : (
                    <p className="mt-1 text-[11px] text-fg-subtle">Your figure.</p>
                  )}
                </div>
              </div>
              {reference?.successorNote && reference.journeymanRate && values.bJourneyman === cited.bJourneyman && (
                <Alert tone="warning" title="Newer rate unverified">
                  {reference.successorNote}
                </Alert>
              )}
              <p className="text-xs text-fg-muted">
                The fields below are your assumptions; check your program&apos;s wage schedule.
                {reference?.laterSteps ? ` The cited notice lists later steps by on-the-job hours: ${reference.laterSteps}.` : ""}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {num("bStep", "Increase per period (% points)", { placeholder: "e.g. 5" })}
                {num("bPeriodMonths", "Months per period", { placeholder: "e.g. 6" })}
                {num("bProgramMonths", "Program length (months)", { placeholder: "e.g. 60" })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {num("bHours", "Paid hours per week")}
                {num("bUnpaidWeeks", "Unpaid weeks per year", { hint: "e.g. class weeks, if unpaid" })}
                {num("bRaise", "Journeyman scale increase per year (%)", { hint: "Assumption; 0 = none" })}
                {num("bOvertime", "Overtime hours/week at 1.5×", { hint: "Not guaranteed" })}
                {num("bTraining", "Training costs per year in the program (USD)", { hint: "Books, tools, dues, tuition", className: "sm:col-span-2" })}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="compare-result">
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>Cumulative earnings</CardTitle>
            <CardDescription>Gross pay added up year by year; path B is net of its training costs.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-years`} className="text-xs text-fg-muted">
              Years
            </label>
            <Select id={`${id}-years`} value={values.years} onChange={set("years")} className="w-20 h-8">
              {Array.from({ length: MAX_COMPARE_YEARS - MIN_COMPARE_YEARS + 1 }, (_, i) => MIN_COMPARE_YEARS + i).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
            <Badge tone="accent">Estimate</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4" aria-live="polite">
          {!result ? (
            <div className="text-sm">
              <p className="font-medium">Fill in both paths to compare them.</p>
              {missing.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-fg-muted">
                  {missing.slice(0, 6).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {Object.keys(parsed.errors).length > missing.length && <p className="mt-2 text-danger">Some fields need attention.</p>}
            </div>
          ) : (
            <>
              <p className="text-sm" data-testid="compare-summary">
                {summary}
              </p>
              <EarningsChart rows={result.rows} labels={LABELS} summary={summary} />
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="text-xs text-fg-muted border-b border-line">
                      <th scope="col" className="py-2 pl-5 pr-2 text-left font-medium">
                        Year
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        A · that year
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        B · that year
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        A · cumulative
                      </th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">
                        B · cumulative
                      </th>
                      <th scope="col" className="py-2 pl-2 pr-5 text-right font-medium">
                        B − A
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tnum">
                    {result.rows.map((r) => (
                      <tr key={r.year} className={r.year === result.cumulativeCrossoverYear ? "bg-accent-soft" : undefined}>
                        <th scope="row" className="py-2 pl-5 pr-2 text-left font-normal">
                          {r.year}
                          <span className="ml-1 text-[11px] text-fg-subtle">B at {r.bPct}%</span>
                          {r.year === result.cumulativeCrossoverYear && <span className="sr-only"> (crossover year)</span>}
                        </th>
                        <td className="px-2 py-2 text-right">{usd(r.a)}</td>
                        <td className="px-2 py-2 text-right">
                          {usd(r.b)}
                          {r.bTraining > 0 && <span className="block text-[11px] text-fg-subtle">after {usd(r.bTraining)} training</span>}
                        </td>
                        <td className="px-2 py-2 text-right">{usd(r.cumA)}</td>
                        <td className="px-2 py-2 text-right">{usd(r.cumB)}</td>
                        <td className={r.diff >= 0 ? "py-2 pl-2 pr-5 text-right text-success" : "py-2 pl-2 pr-5 text-right"}>
                          {r.diff >= 0 ? "+" : "−"}
                          {usd(Math.abs(r.diff))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-fg-muted">
                B&apos;s % in each row is the rate at the start of that year. The journeyman rate (100%) applies from month {result.completionMonth} if you
                complete the program; completion, steps and raises are not guaranteed.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <ScenarioBar kind="compare" scenarios={scenarios} values={values} onLoad={setValues} />
      <PayDisclaimer extra="Cited wage figures are shown with their source and dates; everything else in this comparison is your assumption." />
    </div>
  );
}
