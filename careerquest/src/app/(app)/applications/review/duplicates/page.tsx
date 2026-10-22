import { Copy } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { loadDuplicateReview } from "@/lib/ingest/review";
import { EmptyState } from "@/components/ui";
import { DuplicateReviewCard } from "@/components/review/duplicate-review-card";
import { ScanDuplicatesButton } from "@/components/review/scan-duplicates-button";

export default async function ReviewDuplicatesPage() {
  const user = await requireUser();
  const { items, total } = await loadDuplicateReview(user.id);
  return (
    <section aria-labelledby="duplicates-heading" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="duplicates-heading" className="text-base font-semibold">
            Possible duplicates
          </h2>
          <p className="text-sm text-fg-muted">
            The same job saved twice — for example from Indeed and again from the employer&apos;s Workday site. A scan compares
            your applications; it never merges anything by itself.
          </p>
        </div>
        {items.length > 0 && <ScanDuplicatesButton />}
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<Copy className="h-8 w-8" aria-hidden />}
          title="No possible duplicates waiting"
          description="Run a scan to compare your applications by company, title, location, posting link, requisition number and email thread."
          action={<ScanDuplicatesButton variant="primary" />}
        />
      ) : (
        <>
          {total > items.length && (
            <p className="text-sm text-fg-muted">
              Showing the {items.length} strongest of {total} pairs. Resolve these to see the rest.
            </p>
          )}
          {items.map((item) => (
            <DuplicateReviewCard key={item.id} item={item} />
          ))}
        </>
      )}
    </section>
  );
}
