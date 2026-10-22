import type { OfferStatus, SalaryPeriod } from "@/generated/prisma/enums";

/** String form state of the offer form (plain module so server pages can build initial values). */
export type OfferFormValues = {
  baseAmount: string;
  period: SalaryPeriod;
  hoursPerWeek: string;
  overtimeHours: string;
  signingBonus: string;
  annualBonus: string;
  benefitsValue: string;
  benefitHealth: string;
  benefitRetirement: string;
  benefitPto: string;
  benefitOther: string;
  startDate: string;
  decisionDue: string;
  status: OfferStatus;
  notes: string;
};

export const EMPTY_OFFER_VALUES: OfferFormValues = {
  baseAmount: "",
  period: "ANNUAL",
  hoursPerWeek: "40",
  overtimeHours: "0",
  signingBonus: "",
  annualBonus: "",
  benefitsValue: "",
  benefitHealth: "",
  benefitRetirement: "",
  benefitPto: "",
  benefitOther: "",
  startDate: "",
  decisionDue: "",
  status: "RECEIVED",
  notes: "",
};
