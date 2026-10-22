import { CalendarCheck2 } from "lucide-react";
import type { ProgramView } from "@/lib/academy/programs/directory";
import { formatDuration } from "@/lib/academy/programs/labels";
import { cn } from "@/lib/utils";
import { formatDayKey } from "./format";
import { OutboundLink, hostOf } from "./external-link";

export const WAGE_NOT_VERIFIED = "Not verified — contact the program";

export type FactRow = { key: string; label: string; value: string; muted: boolean };

/** The headline facts. A starting wage is shown only when the seed marks it verified. */
export function programFactRows(p: ProgramView): FactRow[] {
  const duration = formatDuration(p.durationYears);
  return [
    { key: "duration", label: "Training duration", value: duration ?? "Not stated in official sources", muted: !duration },
    { key: "classroom", label: "Classroom hours", value: p.classroomHours ?? "Not stated — ask the program", muted: !p.classroomHours },
    {
      key: "wage",
      label: "Starting wage",
      value: p.startingWageVerified && p.startingWage ? p.startingWage : WAGE_NOT_VERIFIED,
      muted: !(p.startingWageVerified && p.startingWage),
    },
    { key: "fees", label: "Fees", value: p.fees ?? "Not stated in official sources — ask the program", muted: !p.fees },
  ];
}

export function FactList({ rows, compact = false }: { rows: FactRow[]; compact?: boolean }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-2 text-sm", compact ? "sm:grid-cols-2" : "")}>
      {rows.map((r) => (
        <div key={r.key} className="min-w-0">
          <dt className="text-xs text-fg-subtle">{r.label}</dt>
          <dd className={cn("mt-0.5 break-words", r.muted ? "text-fg-muted italic" : "text-fg", compact && "line-clamp-3")} data-testid={`fact-${r.key}`}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function VerifiedOn({ dateKey, className }: { dateKey: string | null; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs text-fg-subtle", className)}>
      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
      {dateKey ? `Last verified ${formatDayKey(dateKey)}` : "Never verified — treat every fact as unverified"}
    </p>
  );
}

function pathOf(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path.length > 1 ? (path.length > 80 ? `${path.slice(0, 77)}…` : path) : "home page";
  } catch {
    return "";
  }
}

export function SourceList({ urls, title = "Sources" }: { urls: string[]; title?: string }) {
  if (urls.length === 0) return <p className="text-xs text-warning">No sources recorded.</p>;
  return (
    <div>
      <p className="text-xs font-medium text-fg-subtle">{title}</p>
      <ul className="mt-1 space-y-1 text-xs">
        {urls.map((u) => (
          <li key={u} className="min-w-0 break-all">
            <OutboundLink href={u}>{hostOf(u)}</OutboundLink>
            <span className="text-fg-subtle"> · {pathOf(u)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Eligibility / process lines; caveat lines ("not stated", "unverified") are visibly flagged. */
export function RequirementList({ items, ordered = false, empty }: { items: string[]; ordered?: boolean; empty: string }) {
  if (items.length === 0) return <p className="text-sm italic text-fg-muted">{empty}</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-1.5 pl-5 text-sm", ordered ? "list-decimal" : "list-disc")}>
      {items.map((t, i) => {
        const uncertain = /\b(unverified|not stated|not found|not explicitly|not retrieved|not confirmed)\b/i.test(t);
        return (
          <li key={i} className={uncertain ? "text-fg-muted" : "text-fg"}>
            {t}
            {uncertain && <span className="ml-1.5 rounded-full border border-warning/30 bg-warning-soft px-1.5 py-px text-[10px] font-medium text-warning">Unverified</span>}
          </li>
        );
      })}
    </Tag>
  );
}
