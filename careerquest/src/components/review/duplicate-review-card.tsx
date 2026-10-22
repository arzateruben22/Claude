"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  FieldError,
  StatusBadge,
} from "@/components/ui";
import { resolveDuplicateAction } from "@/lib/ingest/review-actions";
import {
  matchStrength,
  percent,
  type DuplicateReviewItemView,
  type DuplicateSideView,
} from "@/lib/ingest/review-view";
import { NoImplicitSubmit, SignalList } from "./review-parts";
import { useReviewForm } from "./use-review-form";

function Side({
  side,
  name,
  suggested,
  idPrefix,
}: {
  side: DuplicateSideView;
  name: string;
  suggested: boolean;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${side.id}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 rounded-ctl border border-line bg-bg-elevated p-3 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30"
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={side.id}
        defaultChecked={suggested}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block font-medium break-words">
          {side.companyName} – {side.positionTitle}
        </span>
        <span className="block text-xs text-fg-muted break-words">
          {[side.location, side.sourceLabel, side.createdViaLabel]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={side.status} />
          {!side.statusVerified && <Badge tone="warning">Unverified</Badge>}
          {side.archived && <Badge>Archived</Badge>}
          {suggested && <Badge tone="accent">Suggested to keep</Badge>}
        </span>
        <span className="block text-xs text-fg-muted">
          {side.appliedLabel ? `Applied ${side.appliedLabel}` : "Not applied"} ·
          added {side.createdLabel} · {side.evidenceCount} evidence ·{" "}
          {side.interviewCount} interview{side.interviewCount === 1 ? "" : "s"}
        </span>
      </span>
    </label>
  );
}

/** Two records that may be the same job: merge them (choosing which stays) or dismiss the pair. */
export function DuplicateReviewCard({
  item,
}: {
  item: DuplicateReviewItemView;
}) {
  const { pending, submitted, errors, formProps } = useReviewForm(
    resolveDuplicateAction,
  );
  const idPrefix = `dup-${item.id}`;
  const strength = matchStrength(item.score);
  return (
    <Card>
      <form {...formProps} aria-labelledby={`${idPrefix}-title`}>
        <NoImplicitSubmit />
        <input type="hidden" name="candidateId" value={item.id} />
        <CardHeader className="flex-col sm:flex-row">
          <h3
            id={`${idPrefix}-title`}
            className="min-w-0 font-medium break-words"
          >
            Possible duplicate: {item.a.companyName} – {item.a.positionTitle}
          </h3>
          <Badge tone={strength.tone}>
            {strength.label} · {percent(item.score)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <SignalList
            signals={item.signals}
            label="Why these may be the same job"
          />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-fg-muted">
              Which record should stay?
            </legend>
            <div className="grid gap-2 md:grid-cols-2">
              <Side
                side={item.a}
                name="keepId"
                suggested={item.suggestedKeepId === item.a.id}
                idPrefix={idPrefix}
              />
              <Side
                side={item.b}
                name="keepId"
                suggested={item.suggestedKeepId === item.b.id}
                idPrefix={idPrefix}
              />
            </div>
            <FieldError errors={errors.keepId} />
          </fieldset>
          <p className="text-xs text-fg-subtle">
            Merging moves the other record&apos;s history, evidence, interviews,
            offers and links to the one you keep and hides the other from lists.
            A further-along stage carries over unless it would override a stage
            you confirmed. XP is settled so the job counts once.{" "}
            <Link
              href={`/applications/${item.a.id}`}
              className="underline hover:text-fg"
            >
              Open first record
            </Link>{" "}
            ·{" "}
            <Link
              href={`/applications/${item.b.id}`}
              className="underline hover:text-fg"
            >
              Open second record
            </Link>
          </p>
        </CardContent>
        <CardFooter className="flex-wrap">
          <Button
            type="submit"
            name="decision"
            value="merge"
            loading={pending && submitted === "merge"}
            disabled={pending}
          >
            Merge into the selected record
          </Button>
          <Button
            type="submit"
            name="decision"
            value="dismiss"
            variant="ghost"
            loading={pending && submitted === "dismiss"}
            disabled={pending}
          >
            Not a duplicate
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
