import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MapFact } from "@/lib/career-map/types";
import { formatDate } from "@/lib/format";
import { FactFlagBadge } from "./status-meta";

/** "2026-10-21" → "Oct 21, 2026" without timezone drift. */
export function checkedOn(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? "an unknown date";
  return formatDate(new Date(`${date}T12:00:00Z`), { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function urlLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? decodeURIComponent(u.pathname).replace(/\/$/, "") : "";
    const short = path.length > 44 ? `${path.slice(0, 41)}…` : path;
    return `${u.hostname.replace(/^www\./, "")}${short}`;
  } catch {
    return url;
  }
}

function BasisBadge({ fact }: { fact: MapFact }) {
  if (fact.basis === "estimate") return <Badge tone="gold">Estimate</Badge>;
  if (fact.basis === "guidance") return <Badge tone="neutral">CareerQuest guidance</Badge>;
  return <Badge tone="info">Researched</Badge>;
}

export function FactSources({ fact }: { fact: MapFact }) {
  if (fact.basis === "guidance") return null;
  if (!fact.sources.length) {
    return <p className="mt-1 text-xs text-warning">No source recorded — treat this as unverified.</p>;
  }
  return (
    <details className="mt-1 group">
      <summary className="cursor-pointer text-xs text-fg-subtle hover:text-fg">
        {fact.sources.length === 1 ? "Source" : `Sources (${fact.sources.length})`}
        {fact.verifiedOn ? ` · last checked ${checkedOn(fact.verifiedOn)}` : " · check date unknown"}
      </summary>
      <ul className="mt-1 space-y-1 text-xs">
        {fact.sources.map((u) => (
          <li key={u}>
            <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 break-all text-accent hover:underline">
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {urlLabel(u)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A list of facts with their basis (researched / estimate / guidance), flags and sources. */
export function FactList({ facts, empty }: { facts: MapFact[]; empty?: string }) {
  if (!facts.length) return empty ? <p className="text-sm text-fg-muted">{empty}</p> : null;
  return (
    <dl className="space-y-3">
      {facts.map((f, i) => (
        <div key={`${f.label}-${i}`}>
          <dt className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-fg">
            {f.label}
            <BasisBadge fact={f} />
            <FactFlagBadge flag={f.flag} />
          </dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-fg-muted">
            {f.value}
            <FactSources fact={f} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
