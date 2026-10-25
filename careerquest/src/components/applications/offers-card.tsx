import Link from "next/link";
import { Plus } from "lucide-react";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { OfferSummary } from "@/lib/applications/service";
import {
  OFFER_STATUS_LABELS,
  SALARY_PERIOD_LABELS,
} from "@/lib/applications/labels";
import { formatInTz } from "@/lib/applications/time";
import { formatCurrency } from "@/lib/format";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  buttonClasses,
} from "@/components/ui";

/** Stages at which recording the offer's terms is useful. */
export const OFFER_STAGES: ReadonlySet<ApplicationStatus> = new Set([
  "OFFER",
  "ACCEPTED",
  "HIRED",
]);

export function offerDetailsHref(applicationId: string): string {
  return `/salary/offers/new?applicationId=${encodeURIComponent(applicationId)}`;
}

/**
 * Offers recorded on an application, plus the entry point to record one when the application is
 * at an offer stage. Amounts are what the user entered; nothing here is an estimate.
 */
export function OffersCard({
  applicationId,
  status,
  offers,
  timezone,
}: {
  applicationId: string;
  status: ApplicationStatus;
  offers: OfferSummary[];
  timezone: string;
}) {
  const canAdd = OFFER_STAGES.has(status);
  if (!canAdd && offers.length === 0) return null;
  return (
    <Card data-testid="offers-card">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Offer{offers.length > 1 ? "s" : ""}</CardTitle>
          <CardDescription>
            {offers.length > 0
              ? "As you recorded them."
              : "No offer details recorded yet. Add the pay, hours and start date to compare it with your targets."}
          </CardDescription>
        </div>
        {canAdd && (
          <Link
            href={offerDetailsHref(applicationId)}
            className={buttonClasses("secondary", "sm", "shrink-0 gap-1.5")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add offer details
          </Link>
        )}
      </CardHeader>
      {offers.length > 0 && (
        <CardContent className="space-y-3">
          {offers.map((o) => (
            <div
              key={o.id}
              className="rounded-ctl border border-line bg-surface p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium tnum">
                  <Link href={`/salary/offers/${encodeURIComponent(o.id)}`} className="hover:underline" data-testid="offer-link">
                    {o.baseAmount === null ? "Amount not recorded" : formatCurrency(o.baseAmount, { cents: o.period === "HOURLY" })}{" "}
                    {SALARY_PERIOD_LABELS[o.period]}
                  </Link>
                </p>
                <Badge
                  tone={
                    o.status === "ACCEPTED"
                      ? "success"
                      : o.status === "DECLINED" ||
                          o.status === "RESCINDED" ||
                          o.status === "EXPIRED"
                        ? "danger"
                        : "gold"
                  }
                >
                  {OFFER_STATUS_LABELS[o.status]}
                </Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-fg-muted">
                <dt>Hours / week</dt>
                <dd className="tnum">{o.hoursPerWeek}</dd>
                {o.signingBonus !== null && (
                  <>
                    <dt>Signing bonus</dt>
                    <dd className="tnum">{formatCurrency(o.signingBonus)}</dd>
                  </>
                )}
                {o.annualBonus !== null && (
                  <>
                    <dt>Annual bonus</dt>
                    <dd className="tnum">{formatCurrency(o.annualBonus)}</dd>
                  </>
                )}
                {o.benefitsValue !== null && (
                  <>
                    <dt>Benefits (your estimate)</dt>
                    <dd className="tnum">{formatCurrency(o.benefitsValue)}</dd>
                  </>
                )}
                {o.startDate && (
                  <>
                    <dt>Start date</dt>
                    <dd className="tnum">{formatInTz(o.startDate, timezone)}</dd>
                  </>
                )}
                {o.decisionDue && (
                  <>
                    <dt>Decide by</dt>
                    <dd className="tnum">{formatInTz(o.decisionDue, timezone)}</dd>
                  </>
                )}
              </dl>
              {o.notes && (
                <p className="mt-2 text-xs text-fg-muted whitespace-pre-wrap break-words">
                  {o.notes}
                </p>
              )}
              <Link href={`/salary/offers/${encodeURIComponent(o.id)}`} className="mt-2 inline-block text-xs text-accent hover:underline">
                Compare / negotiate
              </Link>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
