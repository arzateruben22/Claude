import { requireUser } from "@/lib/auth/current-user";
import { getOfferApplication, isBelowOffer, listOfferCandidates, offerPrefill } from "@/lib/offers/service";
import { Alert } from "@/components/ui/alert";
import { OfferForm } from "@/components/salary/offer-form";
import { EMPTY_OFFER_VALUES } from "@/components/salary/offer-values";
import { MoveToOfferButton } from "@/components/salary/move-to-offer";
import { formatCurrency } from "@/lib/format";
import { SALARY_PERIOD_LABELS } from "@/lib/applications/labels";

export const metadata = { title: "Record an offer · Salary · CareerQuest" };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, sp] = await Promise.all([requireUser("/salary/offers/new"), searchParams]);
  const raw = Array.isArray(sp.applicationId) ? sp.applicationId[0] : sp.applicationId;
  const requested = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const app = requested ? await getOfferApplication(user.id, requested) : null;
  const candidates = app ? [] : await listOfferCandidates(user.id);
  const prefill = app ? offerPrefill(app) : null;
  const postedRange =
    app && (app.salaryMin !== null || app.salaryMax !== null)
      ? `${[app.salaryMin, app.salaryMax]
          .filter((v): v is number => v !== null)
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((v) => formatCurrency(v, { cents: app.salaryPeriod === "HOURLY" }))
          .join("–")}${app.salaryPeriod ? ` ${SALARY_PERIOD_LABELS[app.salaryPeriod]}` : ""}`
      : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Record an offer</h2>
        <p className="text-sm text-fg-muted">Enter the terms exactly as the employer stated them. You can edit them later.</p>
      </div>
      {raw && !app && (
        <Alert tone="warning" title="Application not found">
          That application is not in your tracker. Choose one of your applications below.
        </Alert>
      )}
      {app && isBelowOffer(app.status) && <MoveToOfferButton applicationId={app.id} status={app.status} company={app.companyName} />}
      <OfferForm
        mode="create"
        application={app ? { id: app.id, companyName: app.companyName, positionTitle: app.positionTitle, status: app.status } : null}
        candidates={candidates}
        initial={prefill ? { ...EMPTY_OFFER_VALUES, period: prefill.period, baseAmount: prefill.baseAmount } : EMPTY_OFFER_VALUES}
        cancelHref={app ? `/applications/${app.id}` : "/salary/offers"}
        postedRange={postedRange}
      />
    </div>
  );
}
