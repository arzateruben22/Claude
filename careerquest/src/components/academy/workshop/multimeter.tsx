"use client";

import type { ReactNode } from "react";
import { Gauge } from "lucide-react";
import { quantityLabel, quantityValue, type CircuitSolution } from "@/lib/academy/solver";
import { formatMeasurement } from "@/lib/academy/workshop";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MeterMode = "V" | "I" | "R";

export const METER_MODES: { mode: MeterMode; label: string; unit: string; hint: string }[] = [
  { mode: "V", label: "DC volts", unit: "V", hint: "Voltmeter leads across the selected part (in parallel)." },
  { mode: "I", label: "DC amps", unit: "A", hint: "Ammeter in series with the selected part (the circuit is opened to insert it)." },
  { mode: "R", label: "Ohms", unit: "Ω", hint: "Resistance is read with the circuit de-energized and the part isolated." },
];

export function meterQuantity(mode: MeterMode, target: string): string {
  return `${mode}_${target === "source" ? "total" : target}`;
}

/**
 * Virtual multimeter. The display stays blank until the student measures (or commits a prediction
 * in exercise mode); once a quantity is held, the reading follows the circuit, so editing the
 * circuit in experiment mode updates it live.
 */
export function Multimeter({
  id,
  solution,
  targets,
  target,
  onTarget,
  mode,
  onMode,
  held,
  onMeasure,
  note,
}: {
  id: string;
  solution: CircuitSolution;
  targets: string[];
  target: string;
  onTarget: (t: string) => void;
  mode: MeterMode;
  onMode: (m: MeterMode) => void;
  /** The quantity currently shown, e.g. "I_total"; null = blank display. */
  held: string | null;
  onMeasure: (quantity: string) => void;
  note?: ReactNode;
}) {
  const q = meterQuantity(mode, target);
  const info = METER_MODES.find((m) => m.mode === mode)!;
  const value = held === q ? quantityValue(solution, q) : null;
  const targetLabel = target === "source" ? "the source" : target;

  return (
    <section aria-labelledby={`${id}-title`} className="glass space-y-3 rounded-card p-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-accent" aria-hidden />
        <h2 id={`${id}-title`} className="text-sm font-medium">
          Virtual multimeter
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-ctl bg-surface-strong p-1" role="group" aria-label="Meter function">
        {METER_MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => onMode(m.mode)}
            className={cn(
              "rounded-[8px] px-2 py-1.5 text-xs font-medium transition-colors",
              mode === m.mode ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-hover",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={`${id}-target`} className="mb-1 block text-xs font-medium text-fg-muted">
          Probe
        </label>
        <select id={`${id}-target`} value={target} onChange={(e) => onTarget(e.target.value)} className={inputClasses}>
          {targets.map((t) => (
            <option key={t} value={t}>
              {t === "source" ? "Source / whole circuit" : t}
            </option>
          ))}
        </select>
      </div>
      <div
        className="rounded-ctl border border-line-strong bg-bg px-4 py-3 text-right font-mono text-3xl font-semibold tracking-tight text-success tnum"
        aria-live="polite"
        data-testid="meter-display"
      >
        {value === null ? <span className="text-fg-subtle">– – – –</span> : formatMeasurement(value, info.unit)}
      </div>
      <p className="text-xs text-fg-subtle">
        {quantityLabel(q)} · {info.hint}
      </p>
      {note}
      <Button variant="secondary" size="sm" onClick={() => onMeasure(q)} className="w-full">
        Measure {mode === "R" ? "resistance of" : mode === "I" ? "current through" : "voltage across"} {targetLabel}
      </Button>
    </section>
  );
}
