import { ExternalLink as ExternalIcon } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ELIGIBILITY_FLAG_LABELS, type EligibilityFlag } from "@/lib/discovery/eligibility";
import { scoreTone, type LeadScore } from "@/lib/discovery/score";
import { choiceValue } from "@/lib/discovery/schemas";
import type { CandidateChoice } from "@/lib/discovery/leads";

/** Link to another site: new tab, no opener, no referrer, announced to screen readers. */
export function OutboundLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex max-w-full items-center gap-1 text-accent hover:underline", className)}>
      <span className="min-w-0 truncate">{children}</span>
      <ExternalIcon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 32 ? `${u.pathname.slice(0, 31)}…` : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path === "/" ? "" : path}`;
  } catch {
    return url.slice(0, 48);
  }
}

export function FlagBadges({ flags, hiddenBy = [] }: { flags: readonly EligibilityFlag[]; hiddenBy?: readonly EligibilityFlag[] }) {
  if (!flags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Eligibility flags">
      {flags.map((f) => (
        <li key={f}>
          <Badge tone={hiddenBy.includes(f) ? "danger" : "warning"}>
            Flag: {ELIGIBILITY_FLAG_LABELS[f]}
            {hiddenBy.includes(f) ? " (filtered)" : ""}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge tone={scoreTone(score)} className="tnum" title="Fit score: an estimate from your settings, not a hiring prediction">
      Fit {score}/100 · Estimate
    </Badge>
  );
}

/** Every factor of the fit score with its points and the reason. */
export function ScoreBreakdown({ score, idPrefix }: { score: LeadScore; idPrefix: string }) {
  return (
    <details className="group rounded-ctl border border-line bg-surface px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
        Why {score.score}/100? <span className="sr-only">Show how the fit score was calculated</span>
      </summary>
      <dl className="mt-2 space-y-1.5" aria-labelledby={`${idPrefix}-score`}>
        {score.factors.map((f) => (
          <div key={f.key} className="grid grid-cols-[6.5rem_3.5rem_1fr] gap-2 max-sm:grid-cols-[5.5rem_3rem_1fr]">
            <dt className="font-medium text-fg">{f.label}</dt>
            <dd className="tnum text-fg-muted">
              {f.points}/{f.max}
            </dd>
            <dd className="min-w-0 break-words text-fg-muted">{f.detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-fg-subtle">Estimate based on your Settings (trade, interests, regions, pay targets, filters). It does not predict hiring.</p>
    </details>
  );
}

/**
 * "Which one is it?" after an uncertain match. Buttons carry the whole decision
 * (`<mode>:attach:<id>` or `<mode>:new`) so they can sit in the same form as the primary buttons.
 */
export function CandidateChooser({
  mode,
  candidates,
  pending,
  submitter,
  newLabel = "Different job — create a new record",
}: {
  mode: string;
  candidates: CandidateChoice[];
  pending: boolean;
  submitter: string | null;
  newLabel?: string;
}) {
  return (
    <fieldset className="space-y-2 rounded-ctl border border-info/30 bg-info-soft p-3">
      <legend className="px-1 text-xs font-medium text-fg">Is it one of these tracked applications?</legend>
      {candidates.length === 0 && <p className="text-xs text-fg-muted">The possible matches were removed. Create a new record instead.</p>}
      <ul className="space-y-2">
        {candidates.map((c) => {
          const value = choiceValue(mode, c.id);
          return (
            <li key={c.id} className="flex flex-col gap-2 rounded-ctl bg-bg-elevated p-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="break-words font-medium">{c.label}</p>
                <p className="text-xs text-fg-muted">
                  {c.statusLabel}
                  {c.detail ? ` · ${c.detail}` : ""}
                  {c.score !== null ? ` · match ${Math.round(c.score * 100)}%` : ""}
                </p>
              </div>
              <Button type="submit" name="choice" value={value} size="sm" variant="secondary" loading={pending && submitter === value} disabled={pending}>
                Same job
              </Button>
            </li>
          );
        })}
      </ul>
      <Button type="submit" name="choice" value={choiceValue(mode)} size="sm" variant="outline" loading={pending && submitter === choiceValue(mode)} disabled={pending}>
        {newLabel}
      </Button>
    </fieldset>
  );
}
