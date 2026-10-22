/**
 * Render smoke tests for the salary simulator and offers UI (auth and data mocked where pages are
 * rendered). We cannot boot Next here; this checks that every view renders, keeps base / overtime /
 * bonus / benefits apart, shows cited data with source and dates, and labels estimates.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), usePathname: () => "/salary/offers" }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser: vi.fn(async () => ({ id: "u1", email: "u@example.com", name: "Ada", role: "USER" })) }));
vi.mock("@/lib/offers/service", async (orig) => ({
  ...(await orig<typeof import("@/lib/offers/service")>()),
  listOffers: vi.fn(),
  getSalaryTargets: vi.fn(async () => ({ immediate: 80_000, longTerm: 150_000, timezone: "America/Los_Angeles" })),
}));

import { SalaryCalculator } from "@/components/salary/calculator";
import { ComparePaths } from "@/components/salary/compare-paths";
import { OfferComparison } from "@/components/salary/offer-comparison";
import { OfferBreakdown } from "@/components/salary/offer-breakdown";
import { NegotiationHelper } from "@/components/salary/negotiation-helper";
import { OfferForm } from "@/components/salary/offer-form";
import { EMPTY_OFFER_VALUES } from "@/components/salary/offer-values";
import { toOfferRow } from "@/components/salary/offer-rows";
import OffersPage from "@/app/(app)/salary/offers/page";
import { listOffers, type OfferRecord } from "@/lib/offers/service";
import { annualizeOffer, offerGaps } from "@/lib/offers/math";
import { DEFAULT_CALCULATOR_VALUES, DEFAULT_COMPARE_VALUES } from "@/lib/salary/forms";
import { loadWageReferences } from "@/lib/salary/reference-data";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const refs = loadWageReferences();

const offer = (over: Partial<OfferRecord> = {}): OfferRecord => ({
  id: "0f2b8a64-1111-4222-8333-444455556666",
  applicationId: "8b6e0f1a-1111-4222-8333-444455556666",
  application: { id: "8b6e0f1a-1111-4222-8333-444455556666", companyName: "Volt Electric", positionTitle: "Electrician Trainee", status: "OFFER" },
  baseAmount: 34,
  period: "HOURLY",
  hoursPerWeek: 40,
  overtimeHours: 5,
  signingBonus: 2000,
  annualBonus: 1500,
  benefitsValue: 9000,
  benefits: { health: "Medical" },
  startDate: new Date("2026-11-02T20:00:00Z"),
  decisionDue: new Date("2026-10-30T19:00:00Z"),
  status: "RECEIVED",
  notes: null,
  createdAt: new Date("2026-10-20T19:00:00Z"),
  updatedAt: new Date("2026-10-20T19:00:00Z"),
  ...over,
});

describe("calculator", () => {
  it("starts blank (no invented pay) and asks for the amount", () => {
    const html = render(createElement(SalaryCalculator, { scenarios: [] }));
    expect(html).toContain("Enter your pay to see the breakdown.");
    expect(html).toContain("Nothing is pre-filled.");
    expect(html).toContain("Overtime (never guaranteed)");
    expect(html).toContain("No saved scenarios yet.");
    expect(html).toContain('data-testid="pay-disclaimer"');
    expect(html).toContain("gross before taxes");
  });

  it("renders the breakdown, gaps, overtime scenarios and progression for an hourly job", () => {
    const html = render(
      createElement(SalaryCalculator, {
        scenarios: [],
        initialValues: { ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "30", overtime15: "5", overtime2: "2", annualBonus: "1000", benefitsValue: "5000", raisePct: "3", years: "5" },
      }),
    );
    expect(html).toContain("Gross pay, first year");
    expect(html).toContain("$62,400"); // base
    expect(html).toContain("$81,340"); // gross cash = base + overtime + bonus
    expect(html).not.toContain("$86,340"); // benefits only appear in the explicit total-compensation view
    expect(html).toContain("Show total compensation (adds benefits)");
    expect(html).toContain("$18,660 short");
    expect(html).toContain("Base-only rate needed at 40 h/week: $48.08/h");
    expect(html).toContain("A week with your overtime: $1,200 base + $345 overtime = $1,545.");
    expect(html).toContain("Overtime scenarios");
    expect(html).toContain("Hypothetical");
    expect(html).toContain("Career progression estimate");
    expect(html).toContain('data-testid="calc-progression-chart"');
  });

  it("renders an apprenticeship schedule from the % list", () => {
    const html = render(
      createElement(SalaryCalculator, {
        scenarios: [],
        initialValues: { ...DEFAULT_CALCULATOR_VALUES, basis: "APPRENTICE", journeymanRate: "50", schedule: "40, 50", periodMonths: "6", years: "2" },
      }),
    );
    expect(html).toContain("(40% of journeyman at the start of the year)");
    expect(html).toContain("$46,800");
    expect(html).toContain("$104,000");
    expect(html).toContain("Reached in year 2 if your raise and overtime assumptions hold.");
  });

  it("lists saved scenarios", () => {
    const html = render(
      createElement(SalaryCalculator, {
        scenarios: [{ id: "a1", name: "Current job", updatedLabel: "Oct 20, 2026", values: { ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "30" } }],
      }),
    );
    expect(html).toContain("Current job · Oct 20, 2026");
    expect(html).toContain("Load");
  });
});

describe("compare paths", () => {
  it("pre-fills path B only from cited data and shows its source, dates and status", () => {
    const ref = refs.apprenticeship!;
    const html = render(
      createElement(ComparePaths, {
        initialValues: { ...DEFAULT_COMPARE_VALUES, bJourneyman: "65.00", bStartPct: "40" },
        scenarios: [],
        reference: ref,
        todayKey: "2026-10-22",
        offers: [],
      }),
    );
    expect(html).toContain('value="65.00"');
    expect(html).toContain('value="40"');
    expect(html).toContain("Effective Jan 26, 2026 – Jun 30, 2026");
    expect(html).toContain("this period has ended");
    expect(html).toContain("Last checked Oct 21, 2026");
    expect(html).toContain("Cited · partially verified");
    expect(html).toContain("Cited · verified");
    expect(html).toContain("Newer rate unverified");
    // The rest is the user's to fill in.
    expect(html).toContain("Fill in both paths to compare them.");
    expect(html).toContain("Enter the step increase per period.");
  });

  it("renders the comparison once both paths are complete", () => {
    const html = render(
      createElement(ComparePaths, {
        initialValues: { ...DEFAULT_COMPARE_VALUES, aAmount: "60000", bJourneyman: "50", bStartPct: "40", bStep: "10", bPeriodMonths: "12", bProgramMonths: "36", bTraining: "1000", years: "5" },
        scenarios: [],
        reference: null,
        todayKey: "2026-10-22",
        offers: [{ id: "o1", label: "Volt Electric – Trainee · $34.00 per hour", basis: "HOURLY", amount: 34, hoursPerWeek: 40, overtimeHours: 0 }],
      }),
    );
    expect(html).toContain("catches up on cumulative earnings in year 4");
    expect(html).toContain("passes the job&#x27;s in year 3");
    expect(html).toContain("Fill from a recorded offer");
    expect(html).toContain('data-testid="compare-chart"');
    expect(html).toContain("Your figure.");
  });
});

describe("offers", () => {
  const targets = [
    { label: "Immediate target", amount: 80_000 },
    { label: "Long-term target", amount: 150_000 },
  ];

  it("comparison keeps guaranteed base, expected overtime, bonuses and benefits apart", () => {
    const rows = [toOfferRow(offer(), targets), toOfferRow(offer({ id: "11111111-2222-4333-8444-555566667777", baseAmount: 95_000, period: "ANNUAL", overtimeHours: 0, signingBonus: null }), targets)];
    const html = render(createElement(OfferComparison, { rows, timezone: "America/Los_Angeles" }));
    expect(html).toContain("expected, not guaranteed");
    expect(html).toContain("signing, one-time");
    expect(html).toContain("$70,720");
    expect(html).toContain("Highest base (open offers)");
    expect(html).toContain("Nov 2, 2026");
    expect(html).toContain("$80K:");
  });

  it("breakdown and negotiation helper use the user's numbers and only cited references", () => {
    const o = offer();
    const annual = annualizeOffer(o);
    const b = render(createElement(OfferBreakdown, { annual, hoursPerWeek: 40, overtimeHours: 5, gaps: offerGaps(annual, targets), benefits: o.benefits }));
    expect(b).toContain("Guaranteed in the offer");
    expect(b).toContain("not guaranteed");
    expect(b).toContain("Medical");
    const n = render(
      createElement(NegotiationHelper, {
        offer: { company: "Volt Electric", title: "Electrician Trainee", period: "HOURLY", baseAmount: 34, hoursPerWeek: 40, overtimeHours: 5, annual, decisionDueLabel: "Oct 30, 2026" },
        market: refs.market,
        occupation: refs.occupation,
      }),
    );
    expect(n).toContain("Thank you for the offer for the Electrician Trainee position at Volt Electric");
    expect(n).toContain("The offer is $34.00/hour ($70,720 a year at 40 hours a week).");
    expect(n).toContain("I&#x27;ll get back to you by Oct 30, 2026.");
    expect(n).toContain("My own research (enter below)");
    expect(n).toContain("(unverified)");
  });

  it("offer form renders for a fixed application and for a picker", () => {
    const fixed = render(
      createElement(OfferForm, {
        mode: "create",
        application: { id: "8b6e0f1a-1111-4222-8333-444455556666", companyName: "Volt Electric", positionTitle: "Electrician Trainee", status: "SUBMITTED" },
        candidates: [],
        initial: { ...EMPTY_OFFER_VALUES, period: "HOURLY", baseAmount: "30" },
        cancelHref: "/applications/8b6e0f1a-1111-4222-8333-444455556666",
        postedRange: "$30.00 per hour",
      }),
    );
    expect(fixed).toContain('name="applicationId" value="8b6e0f1a-1111-4222-8333-444455556666"');
    expect(fixed).toContain("Posted pay on your application: $30.00 per hour");
    expect(fixed).toContain("Annualized base $62,400");
    const picker = render(createElement(OfferForm, { mode: "create", application: null, candidates: [], initial: EMPTY_OFFER_VALUES, cancelHref: "/salary/offers" }));
    expect(picker).toContain("You have no applications yet.");
  });

  it("offers page shows an empty state, then the comparison", async () => {
    vi.mocked(listOffers).mockResolvedValueOnce([]);
    const empty = render(await OffersPage());
    expect(empty).toContain("No offers recorded yet");
    vi.mocked(listOffers).mockResolvedValueOnce([offer()]);
    const full = render(await OffersPage());
    expect(full).toContain('data-testid="offer-comparison"');
    expect(full).toContain("Volt Electric");
  });
});
