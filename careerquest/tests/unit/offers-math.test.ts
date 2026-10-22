import { describe, expect, it } from "vitest";
import { annualizeOffer, bestIndex, offerGaps } from "@/lib/offers/math";
import { benefitsFromForm, benefitsNotesSchema, offerFormSchema, readOfferForm } from "@/lib/offers/schema";

const form = (over: Record<string, string> = {}) => ({
  baseAmount: "",
  period: "ANNUAL",
  hoursPerWeek: "",
  overtimeHours: "",
  signingBonus: "",
  annualBonus: "",
  benefitsValue: "",
  benefitHealth: "",
  benefitRetirement: "",
  benefitPto: "",
  benefitOther: "",
  startDate: "",
  decisionDue: "",
  status: "",
  notes: "",
  ...over,
});

describe("annualizeOffer", () => {
  it("annualizes hourly offers on 52 weeks and keeps overtime, bonuses and benefits apart", () => {
    const a = annualizeOffer({ baseAmount: 34, period: "HOURLY", hoursPerWeek: 40, overtimeHours: 5, signingBonus: 2000, annualBonus: 1500, benefitsValue: 9000 });
    expect(a.annualBase).toBe(34 * 40 * 52);
    expect(a.hourlyRate).toBe(34);
    expect(a.overtimeExpected).toBe(34 * 1.5 * 5 * 52);
    expect(a.cashRecurring).toBe(70_720 + 13_260 + 1500);
    expect(a.totalComp).toBe(70_720 + 13_260 + 1500 + 9000);
    expect(a.totalCompYear1).toBe(a.totalComp + 2000);
    expect(a.signingBonus).toBe(2000);
  });

  it("uses the salary's hourly equivalent for expected overtime and treats missing values as zero", () => {
    const a = annualizeOffer({ baseAmount: 104_000, period: "ANNUAL", hoursPerWeek: 40, overtimeHours: 2, signingBonus: null, annualBonus: null, benefitsValue: null });
    expect(a.annualBase).toBe(104_000);
    expect(a.hourlyRate).toBe(50);
    expect(a.overtimeExpected).toBe(50 * 1.5 * 2 * 52);
    expect(a.benefits).toBe(0);
    expect(a.totalComp).toBe(104_000 + 7800);
  });

  it("computes gaps from the guaranteed base and from total comp", () => {
    const a = annualizeOffer({ baseAmount: 80_000, period: "ANNUAL", hoursPerWeek: 40, overtimeHours: 0, signingBonus: null, annualBonus: 5000, benefitsValue: 10_000 });
    const gaps = offerGaps(a, [
      { label: "Immediate target", amount: 80_000 },
      { label: "Long-term target", amount: 150_000 },
      { label: "None", amount: 0 },
    ]);
    expect(gaps).toEqual([
      { target: 80_000, label: "Immediate target", baseGap: 0, totalGap: -15_000 },
      { target: 150_000, label: "Long-term target", baseGap: 70_000, totalGap: 55_000 },
    ]);
  });

  it("finds the best offer by a metric", () => {
    const xs = [100, 300, 200].map((b) => annualizeOffer({ baseAmount: b * 1000, period: "ANNUAL", hoursPerWeek: 40, overtimeHours: 0, signingBonus: null, annualBonus: null, benefitsValue: null }));
    expect(bestIndex(xs, "annualBase")).toBe(1);
    expect(bestIndex([], "annualBase")).toBe(-1);
  });
});

describe("offer form schema", () => {
  it("requires a base amount and applies defaults", () => {
    const r = offerFormSchema.safeParse(form());
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["baseAmount"]);
    const ok = offerFormSchema.parse(form({ baseAmount: "$82,500", startDate: "2026-11-02" }));
    expect(ok).toMatchObject({ baseAmount: 82_500, period: "ANNUAL", hoursPerWeek: 40, overtimeHours: 0, status: "RECEIVED", startDate: "2026-11-02" });
    expect(ok.signingBonus).toBeUndefined();
  });

  it("catches a period/amount mismatch, bad numbers and non-integer hours", () => {
    expect(offerFormSchema.safeParse(form({ baseAmount: "85000", period: "HOURLY" })).error!.issues[0]!.message).toMatch(/annual amount/);
    expect(offerFormSchema.safeParse(form({ baseAmount: "34", period: "ANNUAL" })).error!.issues[0]!.message).toMatch(/hourly rate/);
    expect(offerFormSchema.safeParse(form({ baseAmount: "34", period: "HOURLY", overtimeHours: "2.5" })).success).toBe(false);
    expect(offerFormSchema.safeParse(form({ baseAmount: "34", period: "HOURLY", signingBonus: "lots" })).success).toBe(false);
    expect(offerFormSchema.safeParse(form({ baseAmount: "34", period: "HOURLY", status: "MAYBE" })).success).toBe(false);
    expect(offerFormSchema.safeParse(form({ baseAmount: "34", period: "HOURLY", decisionDue: "next week" })).success).toBe(false);
  });

  it("stores benefits notes as a small JSON object and tolerates junk on read", () => {
    const v = offerFormSchema.parse(form({ baseAmount: "34", period: "HOURLY", benefitHealth: " Medical + dental ", benefitPto: "10 days" }));
    expect(benefitsFromForm(v)).toEqual({ health: "Medical + dental", pto: "10 days" });
    expect(benefitsNotesSchema.parse("not an object")).toEqual({});
    expect(benefitsNotesSchema.parse({ health: "x", other: "y" })).toEqual({ health: "x", other: "y" });
  });

  it("reads every offer field from FormData", () => {
    const fd = new FormData();
    fd.set("baseAmount", "34");
    fd.set("period", "HOURLY");
    const out = readOfferForm(fd);
    expect(out.baseAmount).toBe("34");
    expect(out.notes).toBe("");
    expect(Object.keys(out)).toHaveLength(15);
  });
});
