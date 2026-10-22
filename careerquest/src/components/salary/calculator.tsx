"use client";

import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { PRIMARY, PRIMARY_BG } from "@/components/charts/palette";
import { cn } from "@/lib/utils";
import { DEFAULT_CALCULATOR_VALUES, parseCalculatorValues, type CalculatorValues } from "@/lib/salary/forms";
import { INCOME_TARGETS, computePay, firstYearReaching, overtimeScenarios, projectYears, targetGaps, type PayLine } from "@/lib/salary/pay";
import { PayDisclaimer } from "./disclaimer";
import { gapText, targetLabel, usd, usdRate } from "./format";
import { ScenarioBar, type ScenarioOption } from "./scenario-bar";

type Key = keyof CalculatorValues;

const BASIS_OPTIONS: { value: CalculatorValues["basis"]; label: string }[] = [
  { value: "HOURLY", label: "Hourly" },
  { value: "ANNUAL", label: "Annual salary" },
  { value: "APPRENTICE", label: "Apprenticeship" },
];

export function BasisToggle<T extends string>({ name, value, options, onChange, legend }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="block text-xs font-medium text-fg-muted mb-1.5">{legend}</legend>
      <div className="inline-flex flex-wrap rounded-ctl border border-line bg-bg-elevated p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "cursor-pointer rounded-[8px] px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
              value === o.value ? "bg-accent-soft text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Row({ label, line, strong, hint }: { label: ReactNode; line: PayLine; strong?: boolean; hint?: ReactNode }) {
  return (
    <tr className={cn(strong && "font-semibold")}>
      <th scope="row" className="py-2 pl-5 pr-2 text-left font-normal">
        <span className={cn(strong && "font-semibold")}>{label}</span>
        {hint && <span className="block text-[11px] text-fg-subtle font-normal">{hint}</span>}
      </th>
      <td className="px-2 py-2 text-right tnum">{usd(line.weekly)}</td>
      <td className="px-2 py-2 text-right tnum">{usd(line.monthly)}</td>
      <td className="py-2 pl-2 pr-5 text-right tnum">{usd(line.annual)}</td>
    </tr>
  );
}

export function SalaryCalculator({ scenarios, initialValues = DEFAULT_CALCULATOR_VALUES }: { scenarios: ScenarioOption<CalculatorValues>[]; initialValues?: CalculatorValues }) {
  const id = useId();
  const [values, setValues] = useState<CalculatorValues>(initialValues);
  const [showTotal, setShowTotal] = useState(false);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const { input, errors } = parseCalculatorValues(values);
  // Only show an error once the field has something in it, or for required fields after the main amount is filled.
  const err = (k: Key) => (errors[k] && (values[k] as string).trim() !== "" ? [errors[k]!] : undefined);

  const num = (k: Key, label: string, opts: { hint?: string; placeholder?: string; prefix?: string; className?: string } = {}) => (
    <Field label={label} htmlFor={`${id}-${k}`} errors={err(k)} hint={opts.hint} className={opts.className}>
      <Input id={`${id}-${k}`} name={k} inputMode="decimal" value={values[k] as string} onChange={set(k)} placeholder={opts.placeholder} autoComplete="off" />
    </Field>
  );

  const pay = input ? computePay(input) : null;
  const rows = input ? projectYears(input) : [];
  const gapsGross = pay && input ? targetGaps(pay.gross.annual, input.hoursPerWeek) : [];
  const gapsBase = pay && input ? targetGaps(pay.base.annual, input.hoursPerWeek) : [];
  const otScenarios = input ? overtimeScenarios(input) : [];
  const missing = !input
    ? Object.entries(errors)
        .filter(([k]) => (values[k as Key] as string).trim() === "")
        .map(([, m]) => m)
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-4 min-w-0">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your pay</CardTitle>
              <CardDescription>Everything you enter is your own assumption. Nothing is pre-filled.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="Salary calculator inputs" noValidate>
              <BasisToggle legend="Pay basis" name="basis" value={values.basis} options={BASIS_OPTIONS} onChange={(basis) => setValues((v) => ({ ...v, basis }))} />
              {values.basis === "HOURLY" && num("hourlyRate", "Hourly rate (USD)", { placeholder: "e.g. 32.50" })}
              {values.basis === "ANNUAL" && num("annualSalary", "Annual base salary (USD)", { placeholder: "e.g. 85000" })}
              {values.basis === "APPRENTICE" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {num("journeymanRate", "Journeyman hourly rate (USD)", { placeholder: "from your program's wage sheet", className: "sm:col-span-2" })}
                  <Field
                    label="% of journeyman pay for each period"
                    htmlFor={`${id}-schedule`}
                    errors={err("schedule")}
                    hint="Comma-separated, first period first, e.g. 40, 45, 50, 55… After the last period the journeyman rate (100%) applies."
                    className="sm:col-span-2"
                  >
                    <Input id={`${id}-schedule`} value={values.schedule} onChange={set("schedule")} placeholder="40, 45, 50, 55, 60" autoComplete="off" />
                  </Field>
                  {num("periodMonths", "Months per period")}
                  {num("apprenticeYear", "Apprenticeship year you are in", { hint: "1 = first year" })}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {num("hoursPerWeek", "Regular hours per week")}
                {num("raisePct", "Expected raise per year (%)", { hint: "Assumption; 0 = no raises" })}
              </div>
              <fieldset className="space-y-3">
                <legend className="text-xs font-medium text-fg-muted">Overtime (never guaranteed)</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {num("overtime15", "Hours/week at 1.5×")}
                  {num("overtime2", "Hours/week at 2×")}
                  {num("overtimeWeeks", "Weeks a year with OT")}
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                {num("annualBonus", "Annual bonus (USD)", { placeholder: "0" })}
                {num("benefitsValue", "Benefits value per year (USD)", { placeholder: "0", hint: "Employer-paid health, pension… shown separately" })}
                {num("trainingPerYear", "Training expenses per year (USD)", { placeholder: "0", hint: "Tuition, books, tools, dues you pay" })}
                {num("trainingYears", "Years with training expenses", { placeholder: "0" })}
              </div>
              {num("years", "Years to project", { hint: "1–40" })}
            </form>
          </CardContent>
        </Card>
        <ScenarioBar kind="calculator" scenarios={scenarios} values={values} onLoad={setValues} />
      </div>

      <div className="lg:col-span-3 space-y-4 min-w-0" aria-live="polite">
        {!input || !pay ? (
          <Card>
            <CardContent className="pt-5">
              <p className="font-medium">Enter your pay to see the breakdown.</p>
              {missing.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-fg-muted">
                  {missing.slice(0, 4).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {Object.keys(errors).length > missing.length && <p className="mt-2 text-sm text-danger">Some fields need attention.</p>}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card data-testid="calc-breakdown">
              <CardHeader>
                <div>
                  <CardTitle>Gross pay, first year</CardTitle>
                  <CardDescription>
                    {input.basis === "ANNUAL" ? "Hourly equivalent" : "Regular rate"} {usdRate(pay.hourlyRate)}/h at {input.hoursPerWeek} h/week
                    {input.basis === "APPRENTICE" && rows[0]?.apprenticePct !== null ? ` (${rows[0]!.apprenticePct}% of journeyman at the start of the year)` : ""}.
                  </CardDescription>
                </div>
                <Badge tone="accent">Estimate</Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="text-xs text-fg-muted border-b border-line">
                        <th scope="col" className="py-2 pl-5 pr-2 text-left font-medium">
                          Component
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Weekly (avg)
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Monthly (avg)
                        </th>
                        <th scope="col" className="py-2 pl-2 pr-5 text-right font-medium">
                          Annual
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      <Row label="Base pay" line={pay.base} />
                      <Row label="Overtime at 1.5×" line={pay.overtime15} hint="Not guaranteed" />
                      <Row label="Overtime at 2×" line={pay.overtime2} hint="Not guaranteed" />
                      <Row label="Bonus" line={pay.bonus} hint="Not guaranteed unless contractual" />
                      <Row label="Gross cash pay" line={pay.gross} strong hint="Base + overtime + bonus, before taxes" />
                      {pay.training.annual > 0 && (
                        <>
                          <Row label="Training expenses" line={{ weekly: -pay.training.weekly, monthly: -pay.training.monthly, annual: -pay.training.annual }} />
                          <Row label="Gross after training expenses" line={pay.grossAfterTraining} strong />
                        </>
                      )}
                      {showTotal && (
                        <>
                          <Row label="Benefits (your estimate)" line={pay.benefits} hint="Not cash; employer-paid value" />
                          <Row label="Total compensation" line={pay.totalComp} strong hint="Gross cash + benefits" />
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Checkbox label="Show total compensation (adds benefits)" checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} />
                  {pay.overtimeWeek.overtime > 0 && (
                    <p className="text-xs text-fg-muted">
                      A week with your overtime: {usd(pay.overtimeWeek.base)} base + {usd(pay.overtimeWeek.overtime)} overtime = {usd(pay.overtimeWeek.total)}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="calc-gaps">
              <CardHeader>
                <div>
                  <CardTitle>Distance to $100K and $150K</CardTitle>
                  <CardDescription>First-year gross cash and base pay alone, compared with each target.</CardDescription>
                </div>
                <Badge tone="accent">Estimate</Badge>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {INCOME_TARGETS.map((t, i) => {
                    const g = gapsGross[i]!;
                    const b = gapsBase[i]!;
                    const year = firstYearReaching(rows, t);
                    return (
                      <li key={t} className="rounded-ctl border border-line bg-surface p-3 text-sm">
                        <p className="text-xs text-fg-muted">{targetLabel(t)} target</p>
                        <p className={cn("mt-0.5 text-lg font-semibold", g.reached ? "text-success" : "text-fg")}>{gapText(g.gap)}</p>
                        <p className="text-xs text-fg-muted">with overtime and bonus as entered</p>
                        <p className="mt-1.5 text-xs">Base pay alone: {gapText(b.gap)}</p>
                        {b.hourlyNeeded !== null && (
                          <p className="text-xs text-fg-muted">
                            Base-only rate needed at {input.hoursPerWeek} h/week: {usdRate(b.hourlyNeeded)}/h
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-fg-muted">
                          {year === null
                            ? `Not reached within ${input.years} year${input.years === 1 ? "" : "s"} under your assumptions.`
                            : year === 1
                              ? "Reached in year 1 under your assumptions."
                              : `Reached in year ${year} if your raise and overtime assumptions hold.`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card data-testid="calc-overtime">
              <CardHeader>
                <div>
                  <CardTitle>Overtime scenarios</CardTitle>
                  <CardDescription>
                    First-year gross with different amounts of 1.5× overtime, over {Math.round(input.overtimeWeeks)} week{input.overtimeWeeks === 1 ? "" : "s"} a year.
                  </CardDescription>
                </div>
                <Badge tone="gold">Hypothetical</Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm min-w-[360px]">
                    <thead>
                      <tr className="text-xs text-fg-muted border-b border-line">
                        <th scope="col" className="py-2 pl-5 pr-2 text-left font-medium">
                          Overtime hours / week
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Overtime pay / year
                        </th>
                        <th scope="col" className="py-2 pl-2 pr-5 text-right font-medium">
                          Gross cash / year
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line tnum">
                      {otScenarios.map((s) => (
                        <tr key={s.hoursAt15}>
                          <th scope="row" className="py-2 pl-5 pr-2 text-left font-normal">
                            {s.hoursAt15 === 0 ? "None" : `${s.hoursAt15} h at 1.5×`}
                          </th>
                          <td className="px-2 py-2 text-right">{usd(s.overtime)}</td>
                          <td className="py-2 pl-2 pr-5 text-right">{usd(s.gross)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-fg-muted">Overtime depends on the work available and the employer; plan on base pay.</p>
              </CardContent>
            </Card>

            <Card data-testid="calc-progression">
              <CardHeader>
                <div>
                  <CardTitle>Career progression estimate</CardTitle>
                  <CardDescription>
                    Year by year with a {input.raisePct}% yearly raise
                    {input.basis === "APPRENTICE" ? " applied to the journeyman scale and your period percentages" : ""}. Bonus and overtime hours held constant.
                  </CardDescription>
                </div>
                <Badge tone="accent">Estimate</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <BarSeriesChart
                  data={rows.map((r) => ({ key: String(r.year), label: `Y${r.year}`, tooltipLabel: `Year ${r.year}`, gross: Math.round(r.gross) }))}
                  series={[{ key: "gross", label: "Gross cash pay", color: PRIMARY, swatchClass: PRIMARY_BG }]}
                  caption="Estimated gross cash pay by year"
                  summary={`Year 1 ${usd(rows[0]!.gross)}; year ${rows.length} ${usd(rows[rows.length - 1]!.gross)} (estimate, before taxes).`}
                  testId="calc-progression-chart"
                />
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-xs text-fg-muted border-b border-line">
                        <th scope="col" className="py-2 pl-5 pr-2 text-left font-medium">
                          Year
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Rate
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Base
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Overtime
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                          Gross
                        </th>
                        <th scope="col" className="py-2 pl-2 pr-5 text-right font-medium">
                          Cumulative after training
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line tnum">
                      {rows.map((r) => (
                        <tr key={r.year}>
                          <th scope="row" className="py-2 pl-5 pr-2 text-left font-normal">
                            {r.year}
                            {r.apprenticePct !== null && <span className="ml-1 text-[11px] text-fg-subtle">{r.apprenticePct}%</span>}
                          </th>
                          <td className="px-2 py-2 text-right">{usdRate(r.hourlyRate)}</td>
                          <td className="px-2 py-2 text-right">{usd(r.base)}</td>
                          <td className="px-2 py-2 text-right">{usd(r.overtime)}</td>
                          <td className="px-2 py-2 text-right">{usd(r.gross)}</td>
                          <td className="py-2 pl-2 pr-5 text-right">{usd(r.cumulativeAfterTraining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        <PayDisclaimer extra={showTotal ? "Benefits are your own estimate of employer-paid value and are not cash." : undefined} />
      </div>
    </div>
  );
}
