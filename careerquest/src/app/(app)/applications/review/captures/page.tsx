import { MousePointerClick } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { loadAttachOptions, loadCaptureReview } from "@/lib/ingest/review";
import { EmptyState } from "@/components/ui";
import { CaptureReviewCard } from "@/components/review/capture-review-card";

export default async function ReviewCapturesPage() {
  const user = await requireUser();
  const [{ items, total }, attachOptions] = await Promise.all([loadCaptureReview(user.id), loadAttachOptions(user.id)]);
  return (
    <section aria-labelledby="captures-heading" className="space-y-3">
      <h2 id="captures-heading" className="sr-only">
        Captures to review
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon={<MousePointerClick className="h-8 w-8" aria-hidden />}
          title="No captures waiting for confirmation"
          description="Job pages and application confirmations saved by the CareerQuest browser extension that need your confirmation appear here. Nothing is recorded from a capture until you confirm it."
        />
      ) : (
        <>
          {total > items.length && (
            <p className="text-sm text-fg-muted">
              Showing the {items.length} newest of {total} captures. Resolve these to see the rest.
            </p>
          )}
          {items.map((item) => (
            <CaptureReviewCard key={item.id} item={item} attachOptions={attachOptions} />
          ))}
        </>
      )}
    </section>
  );
}
