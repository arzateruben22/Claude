import { MapPin, Star } from "lucide-react";
import type { CareerNodeStatus } from "@/lib/career-map/types";
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from "@/lib/career-map/labels";
import { cn } from "@/lib/utils";
import { STATUS_ICONS, STATUS_TEXT } from "./status-meta";

const ORDER: CareerNodeStatus[] = ["COMPLETED", "IN_PROGRESS", "AVAILABLE", "LOCKED"];

/** Status key (with counts), connector styles and markers used on the map. */
export function MapLegend({ counts }: { counts: Record<CareerNodeStatus, number> }) {
  return (
    <section aria-label="Map legend" className="glass rounded-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">Legend</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {ORDER.map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <li key={s} className="flex items-start gap-2 text-sm">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", STATUS_TEXT[s])} aria-hidden />
              <span>
                <span className="font-medium text-fg">
                  {STATUS_LABELS[s]} <span className="tnum text-fg-subtle">({counts[s]})</span>
                </span>
                <span className="hidden text-xs text-fg-muted sm:block">{STATUS_DESCRIPTIONS[s]}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <details className="mt-3 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-fg-muted hover:text-fg">Lines and markers</summary>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted">
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden focusable="false">
              <line x1="0" y1="4" x2="28" y2="4" stroke="var(--line-strong)" strokeWidth="2" />
            </svg>
            Required step
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden focusable="false">
              <line x1="0" y1="4" x2="28" y2="4" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 5" />
            </svg>
            Usual order (never blocks)
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden focusable="false">
              <line x1="0" y1="4" x2="28" y2="4" stroke="var(--accent)" strokeWidth="2" />
            </svg>
            Open from your progress
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden focusable="false">
              <line x1="0" y1="4" x2="28" y2="4" stroke="var(--success)" strokeWidth="2" />
            </svg>
            Both ends completed
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gold" aria-hidden />
            You are here
          </li>
          <li className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-gold" aria-hidden />
            Your primary trade or interest
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-accent">Marked by you</span> = your own status, not a credential
          </li>
        </ul>
      </details>
    </section>
  );
}
