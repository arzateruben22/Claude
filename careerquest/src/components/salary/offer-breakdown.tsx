import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnnualizedOffer, OfferGap } from "@/lib/offers/math";
import { BENEFIT_LABELS, type BenefitsNotes } from "@/lib/offers/schema";
import { gapText, targetLabel, usd, usdRate } from "./format";

function Line({ label, value, note, strong }: { label: string; value: string; note?: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={strong ? "font-medium" : "text-fg-muted"}>
        {label}
        {note && <span className="block text-[11px] text-fg-subtle">{note}</span>}
      </dt>
      <dd className={`tnum text-right ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

/** One offer, annualized: guaranteed base, expectations and estimates kept apart. */
export function OfferBreakdown({
  annual,
  hoursPerWeek,
  overtimeHours,
  gaps,
  benefits,
}: {
  annual: AnnualizedOffer;
  hoursPerWeek: number;
  overtimeHours: number;
  gaps: OfferGap[];
  benefits: BenefitsNotes;
}) {
  const notes = (Object.keys(BENEFIT_LABELS) as (keyof BenefitsNotes)[]).filter((k) => benefits[k]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card data-testid="offer-breakdown">
        <CardHeader>
          <div>
            <CardTitle>Per year, before taxes</CardTitle>
            <CardDescription>
              {usdRate(annual.hourlyRate)}/h at {hoursPerWeek} h/week × 52 weeks.
            </CardDescription>
          </div>
          <Badge tone="info">Your offer</Badge>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-line text-sm">
            <Line label="Base pay" value={usd(annual.annualBase)} note="Guaranteed in the offer" />
            <Line label="Overtime" value={usd(annual.overtimeExpected)} note={overtimeHours > 0 ? `Expected ${overtimeHours} h/week at 1.5× — not guaranteed` : "None expected"} />
            <Line label="Annual bonus" value={usd(annual.annualBonus)} note="Check whether it is contractual" />
            <Line label="Gross cash (recurring)" value={usd(annual.cashRecurring)} strong />
            <Line label="Benefits" value={usd(annual.benefits)} note="Your estimate of employer-paid value; not cash" />
            <Line label="Total compensation" value={usd(annual.totalComp)} strong />
            {annual.signingBonus > 0 && <Line label="Signing bonus" value={usd(annual.signingBonus)} note={`One-time; year 1 total ${usd(annual.totalCompYear1)}`} />}
          </dl>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card data-testid="offer-gaps">
          <CardHeader>
            <div>
              <CardTitle>Against your targets</CardTitle>
              <CardDescription>From your profile. Base pay is the guaranteed part; total compensation adds expectations and estimates.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {gaps.length === 0 ? (
              <p className="text-sm text-fg-muted">No salary targets set in your profile.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {gaps.map((g) => (
                  <li key={g.label} className="rounded-ctl border border-line bg-surface px-3 py-2">
                    <p className="text-xs text-fg-muted">
                      {g.label} · {targetLabel(g.target)}
                    </p>
                    <p>
                      Base: <span className={g.baseGap <= 0 ? "text-success font-medium" : "font-medium"}>{gapText(g.baseGap)}</span>
                      <span className="text-fg-muted"> · total comp: {gapText(g.totalGap)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Benefits notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-sm text-fg-muted">No benefit details recorded. Edit the offer to add health, retirement and time-off terms.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {notes.map((k) => (
                  <div key={k}>
                    <dt className="text-xs text-fg-muted">{BENEFIT_LABELS[k]}</dt>
                    <dd className="whitespace-pre-wrap break-words">{benefits[k]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
