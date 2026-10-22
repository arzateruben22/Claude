import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getOffer, getSalaryTargets, isBelowOffer, targetList } from "@/lib/offers/service";
import { annualizeOffer, offerGaps } from "@/lib/offers/math";
import { loadWageReferences } from "@/lib/salary/reference-data";
import { formatInTz } from "@/lib/applications/time";
import { OFFER_STATUS_LABELS } from "@/lib/applications/labels";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { OfferBreakdown } from "@/components/salary/offer-breakdown";
import { OFFER_STATUS_TONE } from "@/components/salary/offer-comparison";
import { MoveToOfferButton } from "@/components/salary/move-to-offer";
import { DeleteOfferButton } from "@/components/salary/delete-offer";
import { NegotiationHelper } from "@/components/salary/negotiation-helper";
import { PayDisclaimer } from "@/components/salary/disclaimer";

export const metadata = { title: "Offer · Salary · CareerQuest" };

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireUser("/salary/offers"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [offer, targets] = await Promise.all([getOffer(user.id, id), getSalaryTargets(user.id)]);
  if (!offer) notFound();
  const annual = annualizeOffer(offer);
  const gaps = offerGaps(annual, targetList(targets));
  const refs = loadWageReferences();
  const tz = targets.timezone;
  const label = `${offer.application.companyName} – ${offer.application.positionTitle}`;

  return (
    <div className="space-y-4">
      <Link href="/salary/offers" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All offers
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight break-words">{offer.application.companyName}</h2>
          <p className="text-sm text-fg-muted break-words">
            <Link href={`/applications/${offer.applicationId}`} className="hover:underline">
              {offer.application.positionTitle}
            </Link>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <Badge tone={OFFER_STATUS_TONE[offer.status]}>{OFFER_STATUS_LABELS[offer.status]}</Badge>
            <span>Start {formatInTz(offer.startDate, tz)}</span>
            <span>· Decide by {formatInTz(offer.decisionDue, tz)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/salary/offers/${offer.id}/edit`} className={buttonClasses("secondary", "sm")}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Link>
          <DeleteOfferButton offerId={offer.id} label={label} />
        </div>
      </div>

      {isBelowOffer(offer.application.status) && (
        <MoveToOfferButton applicationId={offer.applicationId} status={offer.application.status} company={offer.application.companyName} />
      )}

      <OfferBreakdown annual={annual} hoursPerWeek={offer.hoursPerWeek} overtimeHours={offer.overtimeHours} gaps={gaps} benefits={offer.benefits} />

      {offer.notes && (
        <section className="glass rounded-card p-5 text-sm">
          <h3 className="text-sm font-medium">Notes</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-fg-muted">{offer.notes}</p>
        </section>
      )}

      <NegotiationHelper
        offer={{
          company: offer.application.companyName,
          title: offer.application.positionTitle,
          period: offer.period,
          baseAmount: offer.baseAmount,
          hoursPerWeek: offer.hoursPerWeek,
          overtimeHours: offer.overtimeHours,
          annual,
          decisionDueLabel: offer.decisionDue ? formatInTz(offer.decisionDue, tz) : null,
        }}
        market={refs.market}
        occupation={refs.occupation}
      />
      <PayDisclaimer />
    </div>
  );
}
