"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { BASIS_LABELS, type CitedMetric, type MetricBasis } from "@/lib/coach/types";

const BASIS_TONE: Record<MetricBasis, string> = {
  observed: "text-info",
  self_reported: "text-warning",
  verified: "text-success",
  estimate: "text-gold",
  target: "text-accent",
  reference: "text-fg-muted",
};

/**
 * A citation chip: shows the metric's label and reveals the underlying number, sample size,
 * interval and where it comes from. Keyboard accessible (button + Escape to close).
 */
export function MetricChip({ metric, className }: { metric: CitedMetric; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-block align-baseline", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-line bg-surface-strong px-1.5 py-px text-[11px] font-medium leading-4 text-fg-muted hover:text-fg hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 align-baseline"
        data-metric-id={metric.id}
      >
        <BarChart3 className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{metric.label}</span>
      </button>
      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label={`Metric: ${metric.label}`}
          className="absolute left-0 top-full z-30 mt-1 block w-64 max-w-[calc(100vw-2.5rem)] rounded-ctl border border-line bg-bg-elevated p-3 text-left text-xs shadow-glow"
        >
          <span className="block font-medium text-fg">{metric.label}</span>
          <span className="mt-1 block text-sm text-fg tnum">{metric.display}</span>
          <span className={cn("mt-1 block text-[11px] font-medium", BASIS_TONE[metric.basis])}>{BASIS_LABELS[metric.basis]}</span>
          {(metric.n !== undefined || metric.interval) && (
            <span className="mt-1 block text-fg-muted tnum">
              {metric.n !== undefined && <>n = {metric.n}</>}
              {metric.interval && (
                <>
                  {metric.n !== undefined && " · "}95% interval {formatPercent(metric.interval.low, 0)}–{formatPercent(metric.interval.high, 0)} (estimate)
                </>
              )}
              {metric.lowSample && <span className="block text-warning">Small sample: not reliable yet</span>}
            </span>
          )}
          {metric.detail && <span className="mt-1 block text-fg-subtle">{metric.detail}</span>}
          <span className="mt-1 block font-mono text-[10px] text-fg-subtle">{metric.id}</span>
          {metric.href && (
            <Link href={metric.href} className="mt-2 inline-block text-accent hover:underline">
              See the records
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
