import Link from "next/link";
import { Handshake, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getSalaryTargets, listOffers, targetList } from "@/lib/offers/service";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OfferComparison } from "@/components/salary/offer-comparison";
import { toOfferRow } from "@/components/salary/offer-rows";
import { PayDisclaimer } from "@/components/salary/disclaimer";
import { targetLabel } from "@/components/salary/format";

export const metadata = { title: "Offers · Salary · CareerQuest" };

export default async function OffersPage() {
  const user = await requireUser("/salary/offers");
  const [offers, targets] = await Promise.all([listOffers(user.id), getSalaryTargets(user.id)]);
  const tl = targetList(targets);
  const rows = offers.map((o) => toOfferRow(o, tl));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Offers</h2>
          <p className="text-sm text-fg-muted">
            Offers you recorded, annualized and compared with your targets ({tl.map((t) => `${targetLabel(t.amount)} ${t.label.toLowerCase()}`).join(", ") || "none set"}).
          </p>
        </div>
        <Link href="/salary/offers/new" className={buttonClasses("primary", "md")}>
          <Plus className="h-4 w-4" aria-hidden />
          Record an offer
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8" aria-hidden />}
          title="No offers recorded yet"
          description="When an employer makes you an offer, record its pay, hours, bonuses and benefits here to compare it with other offers and your targets. Nothing is shown until you add one."
          action={
            <Link href="/salary/offers/new" className={buttonClasses("secondary", "md")}>
              Record an offer
            </Link>
          }
        />
      ) : (
        <OfferComparison rows={rows} timezone={targets.timezone} />
      )}
      <PayDisclaimer extra="Offer amounts are what you entered; benefits values are your own estimates." />
    </div>
  );
}
