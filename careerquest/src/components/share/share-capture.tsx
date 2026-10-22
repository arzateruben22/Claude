"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, CheckCircle2, ListPlus } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shareDecisionAction } from "@/lib/discovery/actions";
import { choiceValue } from "@/lib/discovery/schemas";
import type { ShareContext } from "@/lib/discovery/share";
import { CandidateChooser } from "@/components/discovery/discovery-parts";
import { useDiscoveryForm } from "@/components/discovery/use-discovery-form";

export type ShareFields = { url: string; title: string; company: string; location: string; salaryText: string };

const BIG = "h-auto min-h-14 w-full justify-start px-4 py-3 text-left";

/**
 * The three one-tap decisions for a shared posting. Nothing is saved until a button is tapped;
 * "I applied" is the user's own statement and is recorded as such.
 */
export function ShareCapture({ fields, sharedText, context }: { fields: ShareFields; sharedText: string; context: ShareContext }) {
  const { data, errors, pending, submitter, formProps } = useDiscoveryForm(shareDecisionAction);
  const done = data?.tone === "success";
  return (
    <form {...formProps} className="space-y-5" noValidate>
      <input type="hidden" name="sharedText" value={sharedText} />

      {context.matches.length > 0 && (
        <section aria-labelledby="share-matches" className="space-y-2">
          <h2 id="share-matches" className="text-sm font-semibold">
            Already in your tracker
          </h2>
          <ul className="space-y-2">
            {context.matches.map((m) => {
              const value = choiceValue("applied", m.id);
              return (
                <li key={m.id} className="flex flex-col gap-2 rounded-ctl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-fg-muted">
                      {m.statusLabel} · {m.detail}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/applications/${m.id}`} className="inline-flex h-8 items-center rounded-ctl px-3 text-xs text-accent hover:bg-surface-hover">
                      Open
                    </Link>
                    <Button type="submit" name="choice" value={value} size="sm" variant="secondary" loading={pending && submitter === value} disabled={pending}>
                      I applied to this one
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {context.lead && (
        <p className="text-xs text-fg-muted">
          Also a Job Discovery lead: {context.lead.label}.{" "}
          <Link href="/discovery" className="text-accent hover:underline">
            Open leads
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company" htmlFor="share-company" errors={errors.company}>
          <Input id="share-company" name="company" defaultValue={fields.company} maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Job title" htmlFor="share-title" errors={errors.title}>
          <Input id="share-title" name="title" defaultValue={fields.title} maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Location (optional)" htmlFor="share-location" errors={errors.location}>
          <Input id="share-location" name="location" defaultValue={fields.location} maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Pay as posted (optional)" htmlFor="share-salary" errors={errors.salaryText}>
          <Input id="share-salary" name="salaryText" defaultValue={fields.salaryText} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="Posting link (optional)" htmlFor="share-url" errors={errors.url} className="sm:col-span-2">
          <Input id="share-url" name="url" type="url" inputMode="url" defaultValue={fields.url} maxLength={2048} autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="What do you want to do with this job?">
        <Button type="submit" name="decision" value="lead" variant="secondary" className={BIG} loading={pending && submitter === "lead"} disabled={pending}>
          <Bookmark className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Save as lead</span>
            <span className="text-xs font-normal text-fg-muted">Keep it in Job Discovery</span>
          </span>
        </Button>
        <Button type="submit" name="decision" value="track" variant="secondary" className={BIG} loading={pending && submitter === "track"} disabled={pending}>
          <ListPlus className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Save to tracker</span>
            <span className="text-xs font-normal text-fg-muted">Not applied yet</span>
          </span>
        </Button>
        <Button type="submit" name="decision" value="applied" className={cn(BIG, "text-accent-fg")} loading={pending && submitter === "applied"} disabled={pending}>
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">I applied — confirm</span>
            <span className="text-xs font-normal opacity-80">Records it as submitted by you</span>
          </span>
        </Button>
      </div>

      {data?.candidates && <CandidateChooser mode={data.mode ?? "track"} candidates={data.candidates} pending={pending} submitter={submitter} />}
      {data?.href && (
        <Alert tone={done ? "success" : "info"} title={data.message}>
          <Link href={data.href} className="inline-flex items-center gap-1 text-accent hover:underline">
            {data.hrefLabel ?? "Open"} <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </Alert>
      )}
    </form>
  );
}
