"use client";

import { Alert, Badge, Button, Card, CardContent, CardFooter, CardHeader } from "@/components/ui";
import { resolveEmailReviewAction } from "@/lib/ingest/review-actions";
import type { AttachOption, EmailReviewItemView } from "@/lib/ingest/review-view";
import { AttachOther, CandidateMatches, ConfidenceBadge, NoImplicitSubmit, ReviewFields } from "./review-parts";
import { useReviewForm } from "./use-review-form";

/** One email the classifier could not file with confidence. */
export function EmailReviewCard({ item, attachOptions }: { item: EmailReviewItemView; attachOptions: AttachOption[] }) {
  const { pending, submitted, errors, formProps } = useReviewForm(resolveEmailReviewAction);
  const idPrefix = `email-${item.id}`;
  return (
    <Card>
      <form {...formProps} aria-labelledby={`${idPrefix}-subject`}>
        <NoImplicitSubmit />
        <input type="hidden" name="emailId" value={item.id} />
        <CardHeader className="flex-col sm:flex-row">
          <div className="min-w-0">
            <h3 id={`${idPrefix}-subject`} className="font-medium break-words">
              {item.subject}
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted break-words">
              {item.from} · {item.receivedLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            <Badge tone="info">{item.classificationLabel}</Badge>
            <ConfidenceBadge value={item.confidence} />
            {item.verifiedSender ? <Badge tone="success">Verified sender</Badge> : <Badge tone="warning">Unverified sender</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.reason && <Alert tone="info">{item.reason}</Alert>}
          {item.snippet && (
            <blockquote className="border-l-2 border-line-strong pl-3 text-sm text-fg-muted break-words">
              <span className="sr-only">Evidence: </span>
              {item.snippet}
            </blockquote>
          )}
          {item.body && (
            <details className="text-sm">
              <summary className="cursor-pointer text-fg-muted hover:text-fg">Show the email text kept for review</summary>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-ctl bg-bg-elevated p-3 text-xs text-fg-muted">
                {item.body}
              </pre>
              <p className="mt-1 text-xs text-fg-subtle">This text is deleted once you confirm or dismiss the email.</p>
            </details>
          )}
          <ReviewFields idPrefix={idPrefix} fields={item.fields} errors={errors} showInterview={item.isInterview} />
          <section aria-labelledby={`${idPrefix}-matches`} className="space-y-2">
            <h4 id={`${idPrefix}-matches`} className="text-xs font-medium text-fg-muted">
              Tracked applications this could belong to
            </h4>
            <CandidateMatches candidates={item.candidates} pending={pending} submitted={submitted} />
          </section>
          <AttachOther idPrefix={idPrefix} options={attachOptions} pending={pending} submitted={submitted} errors={errors} />
        </CardContent>
        <CardFooter className="flex-wrap">
          <Button type="submit" name="decision" value="create" loading={pending && submitted === "create"} disabled={pending}>
            Create new application
          </Button>
          <Button type="submit" name="decision" value="dismiss" variant="ghost" loading={pending && submitted === "dismiss"} disabled={pending}>
            Not an application
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
