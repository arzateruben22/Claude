"use client";

import { ExternalLink } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui";
import { resolveCaptureReviewAction } from "@/lib/ingest/review-actions";
import type {
  AttachOption,
  CaptureReviewItemView,
} from "@/lib/ingest/review-view";
import {
  AttachOther,
  CandidateMatches,
  ConfidenceBadge,
  NoImplicitSubmit,
  ReviewFields,
} from "./review-parts";
import { useReviewForm } from "./use-review-form";

/** One browser-extension capture waiting for the user's confirmation. */
export function CaptureReviewCard({
  item,
  attachOptions,
}: {
  item: CaptureReviewItemView;
  attachOptions: AttachOption[];
}) {
  const { pending, submitted, errors, formProps } = useReviewForm(
    resolveCaptureReviewAction,
  );
  const idPrefix = `capture-${item.id}`;
  const heading =
    item.fields.company || item.fields.title
      ? [item.fields.company, item.fields.title].filter(Boolean).join(" – ")
      : item.urlLabel;
  return (
    <Card>
      <form {...formProps} aria-labelledby={`${idPrefix}-title`}>
        <NoImplicitSubmit />
        <input type="hidden" name="captureId" value={item.id} />
        <CardHeader className="flex-col sm:flex-row">
          <div className="min-w-0">
            <h3 id={`${idPrefix}-title`} className="font-medium break-words">
              {heading}
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted break-words">
              {item.platformLabel} · captured {item.capturedLabel}
            </p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-accent hover:underline"
              >
                <span className="truncate">{item.urlLabel}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <p className="mt-1 text-xs text-fg-subtle">{item.urlLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            <Badge tone="info">{item.kindLabel}</Badge>
            <ConfidenceBadge value={item.confidence} label="Detection" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.applyStartedOnly && (
            <Alert tone="warning" title="Started, not confirmed as sent">
              The extension only saw you open the application form. Set the
              stage to Submitted only if you actually sent it.
            </Alert>
          )}
          {(item.pageTitle || item.confirmationText || item.salaryText) && (
            <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
              {item.pageTitle && (
                <>
                  <dt className="text-xs text-fg-muted">Page title</dt>
                  <dd className="break-words">{item.pageTitle}</dd>
                </>
              )}
              {item.confirmationText && (
                <>
                  <dt className="text-xs text-fg-muted">
                    Confirmation text seen
                  </dt>
                  <dd className="break-words">{item.confirmationText}</dd>
                </>
              )}
              {item.salaryText && (
                <>
                  <dt className="text-xs text-fg-muted">
                    Pay shown on the page
                  </dt>
                  <dd className="break-words">{item.salaryText}</dd>
                </>
              )}
            </dl>
          )}
          <ReviewFields
            idPrefix={idPrefix}
            fields={item.fields}
            errors={errors}
            showInterview={false}
          />
          <section
            aria-labelledby={`${idPrefix}-matches`}
            className="space-y-2"
          >
            <h4
              id={`${idPrefix}-matches`}
              className="text-xs font-medium text-fg-muted"
            >
              Tracked applications this could belong to
            </h4>
            <CandidateMatches
              candidates={item.candidates}
              pending={pending}
              submitted={submitted}
            />
          </section>
          <AttachOther
            idPrefix={idPrefix}
            options={attachOptions}
            pending={pending}
            submitted={submitted}
            errors={errors}
          />
        </CardContent>
        <CardFooter className="flex-wrap">
          <Button
            type="submit"
            name="decision"
            value="create"
            loading={pending && submitted === "create"}
            disabled={pending}
          >
            Create new application
          </Button>
          <Button
            type="submit"
            name="decision"
            value="dismiss"
            variant="ghost"
            loading={pending && submitted === "dismiss"}
            disabled={pending}
          >
            Not an application
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
