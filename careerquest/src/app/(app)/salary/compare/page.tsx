import { requireUser } from "@/lib/auth/current-user";
import { userTimezone } from "@/lib/applications/service";
import { dateKeyInTz } from "@/lib/dates";
import { formatInTz } from "@/lib/applications/time";
import { listScenarios } from "@/lib/salary/scenarios";
import { loadWageReferences } from "@/lib/salary/reference-data";
import { DEFAULT_COMPARE_VALUES, type CompareValues } from "@/lib/salary/forms";
import { listOffers } from "@/lib/offers/service";
import { SALARY_PERIOD_LABELS } from "@/lib/applications/labels";
import { ComparePaths, type OfferPrefill } from "@/components/salary/compare-paths";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Compare paths · Salary · CareerQuest" };

export default async function ComparePathsPage() {
  const user = await requireUser("/salary/compare");
  const [scenarios, offers, timezone] = await Promise.all([listScenarios(user.id, "compare"), listOffers(user.id), userTimezone(user.id)]);
  const refs = loadWageReferences();
  const reference = refs.apprenticeship;
  // Pre-fill path B only with cited figures; everything else starts blank or neutral.
  const initialValues: CompareValues = {
    ...DEFAULT_COMPARE_VALUES,
    bJourneyman: reference?.journeymanRate ? reference.journeymanRate.value.toFixed(2) : "",
    bStartPct: reference?.firstPeriodPercent ? String(reference.firstPeriodPercent.value) : "",
  };
  const offerPrefills: OfferPrefill[] = offers.map((o) => ({
    id: o.id,
    label: `${o.application.companyName} – ${o.application.positionTitle} · ${formatCurrency(o.baseAmount, { cents: o.period === "HOURLY" })} ${SALARY_PERIOD_LABELS[o.period].toLowerCase()}`,
    basis: o.period,
    amount: o.baseAmount,
    hoursPerWeek: o.hoursPerWeek,
    overtimeHours: o.overtimeHours,
  }));
  return (
    <>
      <h2 className="sr-only">Compare a job now with an apprenticeship</h2>
      <ComparePaths
        initialValues={initialValues}
        scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, updatedLabel: formatInTz(s.updatedAt, timezone), values: s.values }))}
        reference={reference}
        todayKey={dateKeyInTz(new Date(), timezone)}
        offers={offerPrefills}
      />
    </>
  );
}
