"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ExternalLink, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { BRANCH_LABELS } from "@/lib/career-map/graph";
import { KIND_LABELS } from "@/lib/career-map/labels";
import type { CareerMapNode, MapLink, NodeAction } from "@/lib/career-map/types";
import { cn } from "@/lib/utils";
import { FactList } from "./fact-list";
import { MarkForm } from "./mark-form";
import { EvidenceBadge, KIND_ICONS, NodeStatusBadge } from "./status-meta";

const APP_STATUS_LABELS: Record<string, string> = {
  SAVED: "Saved",
  PREPARING: "Preparing",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  NO_RESPONSE: "No response",
  CLOSED: "Closed",
};

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-4">
      <h3 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ActionLink({ action, primary }: { action: NodeAction | MapLink; primary?: boolean }) {
  const cls = primary ? buttonClasses("primary", "md", "w-full sm:w-auto") : "inline-flex items-center gap-1 text-sm text-accent hover:underline";
  const content = (
    <>
      {action.label}
      {action.external ? <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
    </>
  );
  if (action.external) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (action.href.startsWith("#")) {
    return (
      <a href={action.href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link href={action.href} className={cls}>
      {content}
    </Link>
  );
}

/** Every field of a stop: status with evidence, next action, requirements, duration, costs,
 * documents, relevant jobs, training progress, prerequisites, pay reference, resources and the
 * user's own mark. */
export function NodePanel({
  node,
  nodesByKey,
  isCurrent,
  onSelect,
  onBackToMap,
}: {
  node: CareerMapNode;
  nodesByKey: Map<string, CareerMapNode>;
  isCurrent: boolean;
  onSelect: (key: string) => void;
  onBackToMap?: () => void;
}) {
  const s = node.state;
  const KindIcon = KIND_ICONS[node.kind];
  const [next, ...more] = s.actions;
  const h = (suffix: string) => `cm-${node.key}-${suffix}`;
  const apps = s.applications;

  return (
    <article aria-labelledby={h("title")} className="glass rounded-card p-5 space-y-4">
      <header>
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-fg-subtle">
          <KindIcon className="h-3.5 w-3.5" aria-hidden />
          {BRANCH_LABELS[node.branch]} · {KIND_LABELS[node.kind]}
        </p>
        <h2 id={h("title")} tabIndex={-1} className="mt-1 text-lg font-semibold tracking-tight focus:outline-none">
          {node.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <NodeStatusBadge status={s.status} />
          {s.override && <Badge tone="accent">Marked by you</Badge>}
          {isCurrent && (
            <Badge tone="gold">
              <MapPin className="h-3 w-3" aria-hidden />
              You are here
            </Badge>
          )}
          {s.interest === "primary" && (
            <Badge tone="gold">
              <Star className="h-3 w-3" aria-hidden />
              Your primary trade
            </Badge>
          )}
          {s.interest === "interest" && (
            <Badge tone="neutral">
              <Star className="h-3 w-3" aria-hidden />
              On your interest list
            </Badge>
          )}
        </div>
        <p className="mt-3 text-sm text-fg-muted">{node.summary}</p>
      </header>

      <div className="rounded-ctl border border-line bg-surface px-3.5 py-3" data-testid="node-reason">
        <p className="text-sm font-medium text-fg">{s.reason}</p>
        {s.override && <p className="mt-1 text-xs text-fg-muted">From your data: {s.derivedReason}</p>}
        {s.progress && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-fg-muted">{s.progress.label}</span>
              <EvidenceBadge label={s.progress.basis} />
            </div>
            <ProgressBar value={s.progress.value} max={s.progress.max} tone="gold" className="mt-1.5" label={s.progress.label} />
          </div>
        )}
      </div>

      {next && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Next recommended action</p>
          <div className="mt-2">
            <ActionLink action={next} primary />
          </div>
          {more.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {more.map((a) => (
                <li key={a.href}>
                  <ActionLink action={a} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section title="Current status and evidence" id={h("evidence")}>
        {s.evidence.length > 0 ? (
          <ul className="space-y-2">
            {s.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <EvidenceBadge label={e.label} className="mt-0.5" />
                <span className="text-fg-muted">{e.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No activity recorded for this stop yet.</p>
        )}
        {s.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-fg-subtle">
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </Section>

      {node.credentialFacts.length > 0 && (
        <Section title="What this credential is (and is not)" id={h("credential")}>
          <FactList facts={node.credentialFacts} />
        </Section>
      )}

      <Section title="Requirements" id={h("requirements")}>
        <FactList facts={node.requirements} empty="No requirements recorded for this stop." />
      </Section>

      {node.entryRoutes.length > 0 && (
        <Section title="Entry routes" id={h("routes")}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
            {node.entryRoutes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Estimated duration" id={h("duration")}>
        {s.durationEstimate && (
          <p className="mb-3 flex items-start gap-2 text-sm">
            <EvidenceBadge label={s.durationEstimate.label} className="mt-0.5" />
            <span className="text-fg-muted">{s.durationEstimate.text}</span>
          </p>
        )}
        <FactList facts={node.duration ? [node.duration] : []} empty="No duration estimate is available for this stop." />
      </Section>

      <Section title="Costs" id={h("costs")}>
        <FactList facts={node.costs} empty="No cost figures recorded for this stop." />
      </Section>

      <Section title="Required documents" id={h("documents")}>
        {s.documentsOnFile.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {s.documentsOnFile.map((d) => (
              <li key={d.label} className="flex items-start justify-between gap-2">
                <span className="text-fg-muted">{d.label}</span>
                {d.onFile === true && (
                  <Badge tone="success">
                    <Check className="h-3 w-3" aria-hidden />
                    On file
                  </Badge>
                )}
                {d.onFile === false && <Badge tone="neutral">Not uploaded</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No documents listed for this stop.</p>
        )}
      </Section>

      <Section title="Relevant jobs" id={h("jobs")}>
        {node.relevantJobs.titles.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {node.relevantJobs.titles.map((t) => (
                <li key={t}>
                  <Badge tone="neutral">{t}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-fg-muted tnum">
              Your related applications: {apps.applied} applied · {apps.interviewing} interviewing · {apps.offers} with an offer · {apps.hired} hired
            </p>
            {apps.examples.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {apps.examples.map((a, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate text-fg-muted">
                      {a.title} · {a.company}
                    </span>
                    <span className="shrink-0 text-fg-subtle">{APP_STATUS_LABELS[a.status] ?? a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-fg-muted">This stop is a credential or milestone rather than a job posting.</p>
        )}
      </Section>

      <Section title="Training progress" id={h("training")}>
        {s.training.length > 0 ? (
          <ul className="space-y-3">
            {s.training.map((t) => (
              <li key={t.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <Link href={t.href} className="text-fg hover:text-accent hover:underline">
                    {t.label}
                  </Link>
                  <span className="text-xs text-fg-subtle tnum">
                    {t.completed} / {t.total} lessons
                  </span>
                </div>
                <ProgressBar value={t.completed} max={t.total} tone="accent" className="mt-1" label={`${t.label}: ${t.completed} of ${t.total} lessons`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No CareerQuest training track applies to this stop yet.</p>
        )}
        <p className="mt-2 text-xs text-fg-subtle">Academy lessons are study, not qualifying field experience.</p>
      </Section>

      <Section title="Prerequisites" id={h("prereqs")}>
        {node.prerequisites.length > 0 ? (
          <>
            {node.prereqMode === "any" && <p className="mb-2 text-xs text-fg-muted">Any one of the required routes below is enough.</p>}
            <ul className="space-y-1.5">
              {node.prerequisites.map((p) => {
                const pre = nodesByKey.get(p.from);
                if (!pre) return null;
                return (
                  <li key={p.from} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button type="button" onClick={() => onSelect(p.from)} className="text-left text-accent hover:underline">
                      {pre.title}
                    </button>
                    <span className="flex items-center gap-1.5">
                      <Badge tone="neutral">
                        {p.kind === "required" ? (p.satisfiedBy === "started" ? "Required (started is enough)" : "Required") : "Usual order"}
                      </Badge>
                      <NodeStatusBadge status={pre.state.status} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-fg-muted">None — this is where the map starts.</p>
        )}
        {s.blockedBy.length > 0 && (
          <p className="mt-2 text-xs text-warning">Blocked by: {s.blockedBy.map((b) => b.title).join(", ")}</p>
        )}
      </Section>

      {node.payReference.length > 0 && (
        <Section title="Pay reference — observed data, not a promise of pay" id={h("pay")}>
          <FactList facts={node.payReference} />
        </Section>
      )}

      <Section title="Official resources" id={h("resources")}>
        {node.resources.length > 0 ? (
          <ul className="space-y-1.5">
            {node.resources.map((r) => (
              <li key={r.href}>
                <ActionLink action={r} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No official resources recorded for this stop.</p>
        )}
      </Section>

      <MarkForm
        key={`${node.key}:${s.override?.markedAt ?? "none"}:${s.override?.status ?? ""}`}
        nodeKey={node.key}
        title={node.title}
        override={s.override}
        derivedStatus={s.derivedStatus}
      />

      {onBackToMap && (
        <button type="button" onClick={onBackToMap} className={cn(buttonClasses("ghost", "sm"), "lg:hidden")}>
          Back to the map
        </button>
      )}
    </article>
  );
}
