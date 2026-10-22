"use client";

import type { KeyboardEvent } from "react";
import { RESISTOR_BODY, RESISTOR_SPAN, type Schematic, type SchematicResistor } from "@/lib/academy/schematic";
import { formatMeasurement } from "@/lib/academy/workshop";
import { cn } from "@/lib/utils";

/**
 * Draws a schematic produced by `layoutSchematic`. Resistors and the source are selectable probe
 * targets (click, Enter or Space) when `onSelect` is given.
 */
export function SchematicView({
  schematic,
  selected,
  onSelect,
  title,
}: {
  schematic: Schematic;
  selected?: string | null;
  onSelect?: (target: string) => void;
  title: string;
}) {
  const interactive = Boolean(onSelect);
  const keySelect = (target: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(target);
    }
  };
  const { source } = schematic;
  const mid = (source.top + source.bottom) / 2;
  const sourceSelected = selected === "source";

  return (
    <svg
      viewBox={`0 0 ${schematic.width} ${schematic.height}`}
      role="img"
      aria-label={title}
      className="h-auto w-full min-w-[320px] text-fg-muted"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
    >
      <title>{title}</title>
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none">
        {schematic.wires.map((w, i) => (
          <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />
        ))}
      </g>
      {schematic.junctions.map((j, i) => (
        <circle key={i} cx={j.x} cy={j.y} r={3.5} className="fill-fg-muted" />
      ))}

      {/* Source (battery symbol) */}
      <g
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `Source, ${formatMeasurement(source.volts, "V")}${sourceSelected ? ", selected" : ""}` : undefined}
        aria-pressed={interactive ? sourceSelected : undefined}
        onClick={interactive ? () => onSelect?.("source") : undefined}
        onKeyDown={interactive ? keySelect("source") : undefined}
        className={cn(interactive && "cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-accent")}
      >
        <rect x={source.x - 30} y={mid - 26} width={60} height={52} rx={8} className={cn("fill-transparent", sourceSelected ? "stroke-accent" : "stroke-transparent")} strokeWidth={2} />
        <line x1={source.x} y1={source.top} x2={source.x} y2={mid - 8} stroke="currentColor" strokeWidth={2} />
        <line x1={source.x} y1={mid + 8} x2={source.x} y2={source.bottom} stroke="currentColor" strokeWidth={2} />
        <line x1={source.x - 14} y1={mid - 8} x2={source.x + 14} y2={mid - 8} className="stroke-gold" strokeWidth={3} />
        <line x1={source.x - 7} y1={mid + 8} x2={source.x + 7} y2={mid + 8} className="stroke-gold" strokeWidth={3} />
        <text x={source.x + 18} y={mid - 10} fontSize={12} className="fill-fg">
          +
        </text>
        <text x={source.x - 20} y={mid + 4} fontSize={12} textAnchor="end" className="fill-gold" fontWeight={600}>
          {formatMeasurement(source.volts, "V")}
        </text>
      </g>

      {schematic.resistors.map((r) => (
        <ResistorSymbol
          key={r.id}
          r={r}
          selected={selected === r.id}
          interactive={interactive}
          onSelect={() => onSelect?.(r.id)}
          onKeyDown={keySelect(r.id)}
        />
      ))}
    </svg>
  );
}

function ResistorSymbol({
  r,
  selected,
  interactive,
  onSelect,
  onKeyDown,
}: {
  r: SchematicResistor;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
}) {
  const bodyStart = r.x + (RESISTOR_SPAN - RESISTOR_BODY) / 2;
  const bodyEnd = bodyStart + RESISTOR_BODY;
  const peaks = 6;
  const step = RESISTOR_BODY / peaks;
  const points = [`${bodyStart},${r.y}`];
  for (let i = 0; i < peaks; i++) points.push(`${bodyStart + step * (i + 0.5)},${r.y + (i % 2 === 0 ? -7 : 7)}`);
  points.push(`${bodyEnd},${r.y}`);
  const value = formatMeasurement(r.ohms, "Ω");
  const faultLabel = r.fault === "open" ? "OPEN" : r.fault === "short" ? "SHORT" : null;
  const stroke = r.fault === "open" ? "stroke-danger" : selected ? "stroke-accent" : "stroke-fg";

  return (
    <g
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${r.id}, ${value}${faultLabel ? `, ${faultLabel.toLowerCase()}` : ""}${selected ? ", selected" : ""}` : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(interactive && "cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-accent")}
      data-resistor={r.id}
    >
      <rect
        x={r.x + 4}
        y={r.y - 30}
        width={RESISTOR_SPAN - 8}
        height={62}
        rx={8}
        strokeWidth={2}
        className={cn(selected ? "fill-accent-soft stroke-accent" : "fill-transparent stroke-transparent")}
      />
      <line x1={r.x} y1={r.y} x2={bodyStart} y2={r.y} stroke="currentColor" strokeWidth={2} />
      <line x1={bodyEnd} y1={r.y} x2={r.x + RESISTOR_SPAN} y2={r.y} stroke="currentColor" strokeWidth={2} />
      <polyline
        points={points.join(" ")}
        fill="none"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeDasharray={r.fault === "open" ? "4 3" : undefined}
        className={stroke}
      />
      {r.fault === "open" && (
        <g className="stroke-danger" strokeWidth={2.4} strokeLinecap="round">
          <line x1={(bodyStart + bodyEnd) / 2 - 5} y1={r.y - 6} x2={(bodyStart + bodyEnd) / 2 + 5} y2={r.y + 6} />
          <line x1={(bodyStart + bodyEnd) / 2 + 5} y1={r.y - 6} x2={(bodyStart + bodyEnd) / 2 - 5} y2={r.y + 6} />
        </g>
      )}
      {r.fault === "short" && (
        <path
          d={`M ${bodyStart - 6} ${r.y} C ${bodyStart} ${r.y - 22}, ${bodyEnd} ${r.y - 22}, ${bodyEnd + 6} ${r.y}`}
          fill="none"
          strokeWidth={2.4}
          className="stroke-warning"
        />
      )}
      <text x={r.x + RESISTOR_SPAN / 2} y={r.y - 15} fontSize={12} fontWeight={600} textAnchor="middle" className={selected ? "fill-accent" : "fill-fg"}>
        {r.id}
      </text>
      <text x={r.x + RESISTOR_SPAN / 2} y={r.y + 22} fontSize={11} textAnchor="middle" className="fill-fg-muted">
        {value}
      </text>
      {faultLabel && (
        <text x={r.x + RESISTOR_SPAN / 2} y={r.y + 34} fontSize={9} fontWeight={700} textAnchor="middle" className={r.fault === "open" ? "fill-danger" : "fill-warning"}>
          {faultLabel}
        </text>
      )}
    </g>
  );
}
