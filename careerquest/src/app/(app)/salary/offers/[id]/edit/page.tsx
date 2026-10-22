import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getOffer, getSalaryTargets } from "@/lib/offers/service";
import { dateInputValue } from "@/lib/applications/time";
import { OfferForm } from "@/components/salary/offer-form";
import type { OfferFormValues } from "@/components/salary/offer-values";

export const metadata = { title: "Edit offer · Salary · CareerQuest" };

const str = (n: number | null) => (n === null ? "" : String(n));

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireUser("/salary/offers"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [offer, targets] = await Promise.all([getOffer(user.id, id), getSalaryTargets(user.id)]);
  if (!offer) notFound();
  const tz = targets.timezone;
  const initial: OfferFormValues = {
    baseAmount: String(offer.baseAmount),
    period: offer.period,
    hoursPerWeek: String(offer.hoursPerWeek),
    overtimeHours: String(offer.overtimeHours),
    signingBonus: str(offer.signingBonus),
    annualBonus: str(offer.annualBonus),
    benefitsValue: str(offer.benefitsValue),
    benefitHealth: offer.benefits.health ?? "",
    benefitRetirement: offer.benefits.retirement ?? "",
    benefitPto: offer.benefits.pto ?? "",
    benefitOther: offer.benefits.other ?? "",
    startDate: dateInputValue(offer.startDate, tz),
    decisionDue: dateInputValue(offer.decisionDue, tz),
    status: offer.status,
    notes: offer.notes ?? "",
  };
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Edit offer</h2>
        <p className="text-sm text-fg-muted">
          {offer.application.companyName} – {offer.application.positionTitle}
        </p>
      </div>
      <OfferForm
        mode="edit"
        offerId={offer.id}
        application={offer.application}
        candidates={[]}
        initial={initial}
        cancelHref={`/salary/offers/${offer.id}`}
      />
    </div>
  );
}
