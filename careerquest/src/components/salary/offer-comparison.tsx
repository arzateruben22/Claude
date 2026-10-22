import Link from "next/link";
import type { OfferStatus, SalaryPeriod } from "@/generated/prisma/enums";
import { Badge, type Tone } from "@/components/ui/badge";
import { OFFER_STATUS_LABELS } from "@/lib/applications/labels";
import { formatInTz } from "@/lib/applications/time";
import type { AnnualizedOffer, OfferGap } from "@/lib/offers/math";
import { bestIndex } from "@/lib/offers/math";
import { gapText, targetLabel, usd, usdRate } from "./format";

export type OfferRow = {
  id: string;
  company: string;
  title: string;
  status: OfferStatus;
  period: SalaryPeriod;
  baseAmount: number;
  hoursPerWeek: number;
  overtimeHours: number;
  startDate: Date | null;
  decisionDue: Date | null;
  annual: AnnualizedOffer;
  gaps: OfferGap[];
};

export const OFFER_STATUS_TONE: Record<OfferStatus, Tone> = {
  RECEIVED: "gold",
  NEGOTIATING: "accent",
  ACCEPTED: "success",
  DECLINED: "neutral",
  EXPIRED: "neutral",
  RESCINDED: "danger",
};

const OPEN: ReadonlySet<OfferStatus> = new Set(["RECEIVED", "NEGOTIATING"]);

function payBasis(r: OfferRow) {
  return r.period === "HOURLY" ? `${usdRate(r.baseAmount)}/h × ${r.hoursPerWeek} h × 52` : `salary, ${r.hoursPerWeek} h/week`;
}

function Gaps({ gaps }: { gaps: OfferGap[] }) {
  if (gaps.length === 0) return <span className="text-fg-subtle">No targets set</span>;
  return (
    <ul className="space-y-0.5">
      {gaps.map((g) => (
        <li key={g.label} className="whitespace-nowrap">
          <span className="text-fg-muted">{targetLabel(g.target)}:</span> <span className={g.baseGap <= 0 ? "text-success" : undefined}>{gapText(g.baseGap)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Side-by-side comparison of recorded offers. The base is the only guaranteed figure; overtime is the
 * user's expectation and labeled as not guaranteed; benefits are the user's estimate.
 */
export function OfferComparison({ rows, timezone }: { rows: OfferRow[]; timezone: string }) {
  const open = rows.map((r, i) => ({ r, i })).filter(({ r }) => OPEN.has(r.status));
  const highlight = open.length >= 2;
  const bestBase = highlight ? open[bestIndex(open.map(({ r }) => r.annual), "annualBase")]!.i : -1;
  const bestTotal = highlight ? open[bestIndex(open.map(({ r }) => r.annual), "totalComp")]!.i : -1;
  const marks = (i: number) => (
    <>
      {i === bestBase && <Badge tone="success">Highest base (open offers)</Badge>}
      {i === bestTotal && <Badge tone="info">Highest total (open offers)</Badge>}
    </>
  );

  return (
    <div data-testid="offer-comparison">
      {/* Phone: one card per offer */}
      <ul className="space-y-3 sm:hidden">
        {rows.map((r, i) => (
          <li key={r.id} className="glass rounded-card p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/salary/offers/${r.id}`} className="font-medium hover:underline break-words">
                  {r.company}
                </Link>
                <p className="text-xs text-fg-muted break-words">{r.title}</p>
              </div>
              <Badge tone={OFFER_STATUS_TONE[r.status]}>{OFFER_STATUS_LABELS[r.status]}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">{marks(i)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs tnum">
              <dt className="text-fg-muted">Base (guaranteed)</dt>
              <dd>{usd(r.annual.annualBase)}</dd>
              <dt className="text-fg-muted">Overtime (expected, not guaranteed)</dt>
              <dd>{usd(r.annual.overtimeExpected)}</dd>
              <dt className="text-fg-muted">Annual bonus</dt>
              <dd>{usd(r.annual.annualBonus)}</dd>
              <dt className="text-fg-muted">Signing bonus (one-time)</dt>
              <dd>{usd(r.annual.signingBonus)}</dd>
              <dt className="text-fg-muted">Benefits (your estimate)</dt>
              <dd>{usd(r.annual.benefits)}</dd>
              <dt className="text-fg-muted font-medium">Total compensation</dt>
              <dd className="font-medium">{usd(r.annual.totalComp)}</dd>
              <dt className="text-fg-muted">Start · decide by</dt>
              <dd>
                {formatInTz(r.startDate, timezone)} · {formatInTz(r.decisionDue, timezone)}
              </dd>
            </dl>
            <div className="mt-2 text-xs">
              <p className="text-fg-muted">Base vs your targets</p>
              <Gaps gaps={r.gaps} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: comparison table */}
      <div className="hidden sm:block overflow-x-auto glass rounded-card">
        <table className="w-full text-sm min-w-[900px]">
          <caption className="sr-only">Recorded offers compared, annualized, before taxes</caption>
          <thead>
            <tr className="text-left text-xs text-fg-muted border-b border-line">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Offer
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium text-right">
                Base / year
                <span className="block font-normal text-fg-subtle">guaranteed</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium text-right">
                Overtime / year
                <span className="block font-normal text-fg-subtle">expected, not guaranteed</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium text-right">
                Bonuses
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium text-right">
                Benefits
                <span className="block font-normal text-fg-subtle">your estimate</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium text-right">
                Total comp / year
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium">
                Base vs targets
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Dates
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tnum align-top">
            {rows.map((r, i) => (
              <tr key={r.id} data-testid={`offer-row-${r.id}`}>
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link href={`/salary/offers/${r.id}`} className="font-medium hover:underline">
                    {r.company}
                  </Link>
                  <span className="block text-xs text-fg-muted">{r.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={OFFER_STATUS_TONE[r.status]}>{OFFER_STATUS_LABELS[r.status]}</Badge>
                    {marks(i)}
                  </span>
                </th>
                <td className="px-2 py-3 text-right">
                  {usd(r.annual.annualBase)}
                  <span className="block text-[11px] text-fg-subtle">{payBasis(r)}</span>
                </td>
                <td className="px-2 py-3 text-right">
                  {usd(r.annual.overtimeExpected)}
                  {r.overtimeHours > 0 && <span className="block text-[11px] text-fg-subtle">{r.overtimeHours} h/week at 1.5×</span>}
                </td>
                <td className="px-2 py-3 text-right">
                  {usd(r.annual.annualBonus)}
                  <span className="block text-[11px] text-fg-subtle">annual</span>
                  {r.annual.signingBonus > 0 && (
                    <>
                      {usd(r.annual.signingBonus)}
                      <span className="block text-[11px] text-fg-subtle">signing, one-time</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-3 text-right">{usd(r.annual.benefits)}</td>
                <td className="px-2 py-3 text-right font-medium">
                  {usd(r.annual.totalComp)}
                  {r.annual.signingBonus > 0 && <span className="block text-[11px] font-normal text-fg-subtle">{usd(r.annual.totalCompYear1)} in year 1</span>}
                </td>
                <td className="px-2 py-3 text-xs">
                  <Gaps gaps={r.gaps} />
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  <span className="text-fg-muted">Start</span> {formatInTz(r.startDate, timezone)}
                  <span className="block">
                    <span className="text-fg-muted">Decide by</span> {formatInTz(r.decisionDue, timezone)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
