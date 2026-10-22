import type { OfferRecord } from "@/lib/offers/service";
import { annualizeOffer, offerGaps } from "@/lib/offers/math";
import type { OfferRow } from "./offer-comparison";

export function toOfferRow(o: OfferRecord, targets: { label: string; amount: number }[]): OfferRow {
  const annual = annualizeOffer(o);
  return {
    id: o.id,
    company: o.application.companyName,
    title: o.application.positionTitle,
    status: o.status,
    period: o.period,
    baseAmount: o.baseAmount,
    hoursPerWeek: o.hoursPerWeek,
    overtimeHours: o.overtimeHours,
    startDate: o.startDate,
    decisionDue: o.decisionDue,
    annual,
    gaps: offerGaps(annual, targets),
  };
}
