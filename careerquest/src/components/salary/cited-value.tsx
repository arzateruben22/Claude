import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CitedValue } from "@/lib/salary/reference";
import { dayKeyLabel } from "./format";

const STATUS = {
  verified: { tone: "success" as const, text: "Cited · verified" },
  partial: { tone: "warning" as const, text: "Cited · partially verified" },
  unverified: { tone: "warning" as const, text: "Unverified" },
};

/** Effective dates, source, verification status and last-checked date of a cited figure. */
export function CitedValueNote({ value, todayKey, label }: { value: CitedValue; todayKey: string; label: string }) {
  const s = STATUS[value.status];
  const expired = value.effectiveTo !== null && value.effectiveTo < todayKey;
  const effective =
    value.effectiveFrom && value.effectiveTo
      ? `Effective ${dayKeyLabel(value.effectiveFrom)} – ${dayKeyLabel(value.effectiveTo)}`
      : value.effectiveFrom
        ? `Effective ${dayKeyLabel(value.effectiveFrom)}`
        : "Effective date not stated";
  return (
    <div className="mt-1.5 space-y-1 text-[11px] text-fg-muted" data-testid="cited-note">
      <p className="flex flex-wrap items-center gap-1.5">
        <Badge tone={s.tone}>{s.text}</Badge>
        <span>{label}</span>
      </p>
      <p>
        {effective}
        {expired ? " (this period has ended; a newer rate may apply)" : ""} · Last checked {dayKeyLabel(value.checkedOn)}
      </p>
      <p className="break-words">Source: {value.source}</p>
      {value.sourceUrls.length > 0 && (
        <ul className="space-y-0.5">
          {value.sourceUrls.slice(0, 2).map((u) => (
            <li key={u} className="min-w-0">
              <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-accent hover:underline">
                <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {value.statusNote && <p className="break-words">Verification note: {value.statusNote}</p>}
    </div>
  );
}
