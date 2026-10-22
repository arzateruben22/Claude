import Link from "next/link";
import type { EligibilityEstimate } from "@/lib/academy/certification/timeline";
import type { RequirementView } from "@/lib/academy/certification/requirements";
import { DIR_LINK_GROUP_LABELS, type DirLink } from "@/lib/academy/certification/links";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatDayKey, formatHours } from "./format";
import { OutboundLink } from "./external-link";

/** Verified hours vs the classification's requirement. Labelled an estimate; DIR decides. */
export function EligibilityCard({ estimate, requirement }: { estimate: EligibilityEstimate; requirement: RequirementView }) {
  return (
    <div className="space-y-3" data-testid="eligibility-estimate">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Estimate — DIR decides eligibility</Badge>
        {estimate.met ? <Badge tone="success">Hours figure reached</Badge> : <Badge tone="neutral">{formatHours(estimate.remaining)} to go</Badge>}
      </div>
      <div>
        <p className="text-sm">
          <span className="text-2xl font-semibold tnum">{formatHours(estimate.verified)}</span>
          <span className="text-fg-muted"> verified of {formatHours(estimate.required)}</span>
        </p>
        <ProgressBar value={estimate.verified} max={Math.max(1, estimate.required)} tone="success" className="mt-2" label={`Verified hours toward ${requirement.name}`} />
      </div>
      {estimate.countableVerified !== null && (
        <p className="text-sm text-fg-muted">
          After per-area caps: <span className="font-medium text-fg tnum">{formatHours(estimate.countableVerified)}</span> estimated countable.{" "}
          <Link href="/academy/hours" className="text-accent hover:underline">
            See the breakdown
          </Link>
        </p>
      )}
      <p className="text-xs text-fg-muted">
        {estimate.selfReported > 0
          ? `${formatHours(estimate.selfReported)} self-reported hours are not included — they are not treated as accepted by California.`
          : "Only verified hours (with an attached pay stub, employer letter or union hour report) are counted here."}{" "}
        Completing a state-approved apprenticeship in this classification is the other route to the exam.
      </p>
      <p className="text-xs text-fg-subtle">
        {requirement.source === "fallback"
          ? `${formatHours(requirement.hoursRequired)} is the commonly cited figure; it could not be loaded from the verified reference data.`
          : `${requirement.name}: ${formatHours(requirement.hoursRequired)} per DIR, subject to official rules · last verified ${requirement.verifiedOnKey ? formatDayKey(requirement.verifiedOnKey) : "never"}.`}{" "}
        {requirement.sourceUrl && <OutboundLink href={requirement.sourceUrl}>DIR requirement</OutboundLink>}
      </p>
    </div>
  );
}

/** Official DIR pages from the seeded research, grouped. */
export function DirLinks({ links, verifiedOn }: { links: DirLink[]; verifiedOn: string | null }) {
  if (links.length === 0) return <p className="text-sm text-fg-muted">No official DIR links were found in the reference data.</p>;
  const groups = (Object.keys(DIR_LINK_GROUP_LABELS) as DirLink["group"][]).map((g) => ({ g, items: links.filter((l) => l.group === g) })).filter((x) => x.items.length);
  return (
    <div className="space-y-3">
      {groups.map(({ g, items }) => (
        <div key={g}>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">{DIR_LINK_GROUP_LABELS[g]}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {items.map((l) => (
              <li key={l.url}>
                <OutboundLink href={l.url}>{l.label}</OutboundLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-fg-subtle">Links from the researched DIR facts{verifiedOn ? `, last checked ${formatDayKey(verifiedOn)}` : ""}. Verify on the official site before acting.</p>
    </div>
  );
}
