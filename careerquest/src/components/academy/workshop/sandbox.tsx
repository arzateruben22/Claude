"use client";

import { useState } from "react";
import { Eye, EyeOff, Minus, Plus, RotateCcw, Zap } from "lucide-react";
import { parseNumericInput } from "@/lib/academy/grading";
import { SANDBOX_LIMITS, addResistor, findResistor, removeResistor, setFault, setResistorOhms, setSourceVolts } from "@/lib/academy/sandbox";
import { layoutSchematic } from "@/lib/academy/schematic";
import { solveCircuit } from "@/lib/academy/solver";
import type { Circuit, FaultKind } from "@/lib/academy/schema";
import { formatMeasurement } from "@/lib/academy/workshop";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SchematicView } from "./schematic-view";
import { Multimeter, type MeterMode } from "./multimeter";

/**
 * Ungraded experiment mode: change the source voltage and resistor values, open or short parts,
 * add or remove resistors, and watch held meter readings follow the circuit. Nothing is saved.
 */
export function BenchSandbox({ circuit: initial }: { circuit: Circuit }) {
  const [circuit, setCircuit] = useState<Circuit>(initial);
  const [selected, setSelected] = useState<string>("source");
  const [mode, setMode] = useState<MeterMode>("I");
  const [held, setHeld] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [version, setVersion] = useState(0);

  const solution = solveCircuit(circuit);
  const schematic = layoutSchematic(circuit);
  const resistor = selected === "source" ? null : findResistor(circuit.network, selected);
  const fault = resistor ? ((circuit.faults ?? []).find((f) => f.id === resistor.id)?.fault ?? null) : null;
  const count = solution.order.length;

  const reset = () => {
    setCircuit(initial);
    setSelected("source");
    setHeld(null);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-5">
      <Alert tone="info" title="Experiment mode — ungraded">
        Change values and watch what happens. Measure a quantity once and the meter keeps reading it as you edit. Nothing here is saved or graded.
      </Alert>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="sandbox-schematic" className="glass space-y-3 rounded-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="sandbox-schematic" className="text-sm font-medium">
              Your circuit
            </h2>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset to the exercise circuit
            </Button>
          </div>
          <div className="overflow-x-auto rounded-ctl border border-line bg-bg-elevated p-2">
            <SchematicView schematic={schematic} selected={selected} onSelect={setSelected} title="Schematic of your experiment circuit" />
          </div>
          {solution.deadShort && (
            <Alert tone="danger" title="Dead short across the source">
              The network presents 0 Ω, so the ideal model draws unlimited current. On a real circuit the breaker or fuse opens — and an arc flash is
              possible. Open the short or add resistance.
            </Alert>
          )}
          {solution.allOpen && !solution.deadShort && (
            <p className="text-xs text-warning">Every path is open: no current flows, and the open part takes the full voltage.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <SourceEditor key={`src-${version}`} volts={circuit.sourceVolts} onChange={(v) => setCircuit((c) => setSourceVolts(c, v))} />
            {resistor ? (
              <ResistorEditor
                key={`${resistor.id}-${version}`}
                id={resistor.id}
                ohms={resistor.ohms}
                fault={fault}
                canAdd={count < SANDBOX_LIMITS.maxResistors}
                canRemove={count > 1}
                onOhms={(o) => setCircuit((c) => setResistorOhms(c, resistor.id, o))}
                onFault={(f) => setCircuit((c) => setFault(c, resistor.id, f))}
                onAdd={(m) => {
                  const res = addResistor(circuit, resistor.id, m, resistor.ohms || 100);
                  setCircuit(res.circuit);
                  if (res.id) setSelected(res.id);
                }}
                onRemove={() => {
                  setCircuit((c) => removeResistor(c, resistor.id));
                  setSelected("source");
                }}
              />
            ) : (
              <p className="rounded-ctl border border-dashed border-line p-3 text-xs text-fg-muted">
                Select a resistor in the schematic to change its value, open or short it, or add another resistor beside it.
              </p>
            )}
          </div>
        </section>

        <Multimeter
          id="sandbox-meter"
          solution={solution}
          targets={["source", ...solution.order]}
          target={selected === "source" || solution.order.includes(selected) ? selected : "source"}
          onTarget={setSelected}
          mode={mode}
          onMode={setMode}
          held={held}
          onMeasure={setHeld}
          note={<p className="text-xs text-fg-subtle">Predict the reading first, then measure. A held reading updates live as you edit the circuit.</p>}
        />
      </div>

      <section aria-labelledby="sandbox-values" className="rounded-card border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sandbox-values" className="text-sm font-medium">
            Solver values
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowValues((s) => !s)} aria-expanded={showValues}>
            {showValues ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {showValues ? "Hide" : "Show every value"}
          </Button>
        </div>
        {showValues ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Voltage, current, power and resistance of every part</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-fg-muted">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Part</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">R</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">V</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">I</th>
                  <th scope="col" className="py-1.5 font-medium">P</th>
                </tr>
              </thead>
              <tbody className="tnum">
                <tr className="border-b border-line font-medium">
                  <th scope="row" className="py-1.5 pr-3 text-left">Whole circuit</th>
                  <td className="py-1.5 pr-3">{formatMeasurement(solution.totalOhms, "Ω")}</td>
                  <td className="py-1.5 pr-3">{formatMeasurement(solution.sourceVolts, "V")}</td>
                  <td className="py-1.5 pr-3">{formatMeasurement(solution.totalAmps, "A")}</td>
                  <td className="py-1.5">{formatMeasurement(solution.totalWatts, "W")}</td>
                </tr>
                {solution.order.map((id) => {
                  const e = solution.elements[id]!;
                  return (
                    <tr key={id} className="border-b border-line last:border-0">
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                        {id}
                        {e.fault && <span className={cn("ml-1.5 text-[10px] font-semibold uppercase", e.fault === "open" ? "text-danger" : "text-warning")}>{e.fault}</span>}
                      </th>
                      <td className="py-1.5 pr-3 text-fg-muted">{formatMeasurement(e.ohms, "Ω")}</td>
                      <td className="py-1.5 pr-3 text-fg-muted">{formatMeasurement(e.volts, "V")}</td>
                      <td className="py-1.5 pr-3 text-fg-muted">{formatMeasurement(e.amps, "A")}</td>
                      <td className="py-1.5 text-fg-muted">{formatMeasurement(e.watts, "W")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-fg-subtle">Ideal DC model: wires have no resistance and the source holds its voltage at any current.</p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-fg-muted">Hidden so you can predict first. Check your KVL, KCL and power sums against it afterwards.</p>
        )}
      </section>
    </div>
  );
}

function SourceEditor({ volts, onChange }: { volts: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(volts));
  return (
    <div className="rounded-ctl border border-line p-3">
      <label htmlFor="sandbox-volts" className="mb-1 block text-xs font-medium text-fg-muted">
        Source voltage (V, max {SANDBOX_LIMITS.maxVolts})
      </label>
      <input
        id="sandbox-volts"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseNumericInput(e.target.value, "V");
          if (v !== null && v >= 0) onChange(v);
        }}
        className={cn(inputClasses, "tnum")}
      />
    </div>
  );
}

function ResistorEditor({
  id,
  ohms,
  fault,
  canAdd,
  canRemove,
  onOhms,
  onFault,
  onAdd,
  onRemove,
}: {
  id: string;
  ohms: number;
  fault: FaultKind | null;
  canAdd: boolean;
  canRemove: boolean;
  onOhms: (o: number) => void;
  onFault: (f: FaultKind | null) => void;
  onAdd: (mode: "series" | "parallel") => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(String(ohms));
  return (
    <div className="space-y-2 rounded-ctl border border-accent/40 p-3">
      <p className="text-xs font-medium text-accent">Selected: {id}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`sandbox-ohms-${id}`} className="mb-1 block text-xs font-medium text-fg-muted">
            Resistance (Ω)
          </label>
          <input
            id={`sandbox-ohms-${id}`}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const v = parseNumericInput(e.target.value, "Ω");
              if (v !== null && v >= 0) onOhms(v);
            }}
            className={cn(inputClasses, "tnum")}
          />
        </div>
        <div>
          <label htmlFor={`sandbox-fault-${id}`} className="mb-1 block text-xs font-medium text-fg-muted">
            Condition
          </label>
          <select
            id={`sandbox-fault-${id}`}
            value={fault ?? "ok"}
            onChange={(e) => onFault(e.target.value === "ok" ? null : (e.target.value as FaultKind))}
            className={inputClasses}
          >
            <option value="ok">Normal</option>
            <option value="open">Open (∞ Ω)</option>
            <option value="short">Shorted (0 Ω)</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="secondary" size="sm" disabled={!canAdd} onClick={() => onAdd("series")}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> In series
        </Button>
        <Button variant="secondary" size="sm" disabled={!canAdd} onClick={() => onAdd("parallel")}>
          <Zap className="h-3.5 w-3.5" aria-hidden /> In parallel
        </Button>
        <Button variant="ghost" size="sm" disabled={!canRemove} onClick={onRemove}>
          <Minus className="h-3.5 w-3.5" aria-hidden /> Remove
        </Button>
      </div>
      {!canAdd && <p className="text-xs text-fg-subtle">Up to {SANDBOX_LIMITS.maxResistors} resistors.</p>}
    </div>
  );
}
