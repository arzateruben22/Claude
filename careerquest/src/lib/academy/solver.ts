import type { Circuit } from "./schema";
import { QUANTITY_PATTERN, collectResistorIds, type FaultKind, type NetworkNode } from "./constants";

/**
 * Pure DC solver for an ideal voltage source driving a nested series/parallel resistor network.
 *
 * Faults: an `open` resistor has infinite resistance, a `short` has zero. The solver never returns
 * NaN: open paths carry 0 A, the voltage across a series string that contains opens is shared
 * equally by the open elements (the ideal-model convention; with a single open — the usual
 * fault-finding case — the open element sees the whole string voltage, which is what a meter shows),
 * a shorted parallel group drops 0 V and its shorted branches share the group current, and a dead
 * short across the source reports `deadShort: true` with infinite current instead of NaN.
 */

export type ElementSolution = {
  id: string;
  /** Resistance printed on the part. */
  nominalOhms: number;
  /** Resistance after faults: Infinity when open, 0 when shorted. */
  ohms: number;
  fault: FaultKind | null;
  volts: number;
  amps: number;
  watts: number;
};

export type CircuitSolution = {
  sourceVolts: number;
  totalOhms: number;
  totalAmps: number;
  totalWatts: number;
  /** True when the network presents 0 Ω to the source (infinite current in the ideal model). */
  deadShort: boolean;
  /** True when no current can flow at all (every path open). */
  allOpen: boolean;
  elements: Record<string, ElementSolution>;
  /** Resistor ids in schematic (depth-first) order. */
  order: string[];
};

type FaultMap = ReadonlyMap<string, FaultKind>;

function faultMap(circuit: Circuit): FaultMap {
  const map = new Map<string, FaultKind>();
  for (const f of circuit.faults ?? []) map.set(f.id, f.fault);
  return map;
}

/** Equivalent resistance of a (sub)network, honoring faults. */
export function equivalentOhms(node: NetworkNode, faults: FaultMap = new Map()): number {
  if (node.type === "resistor") {
    const fault = faults.get(node.id);
    if (fault === "open") return Infinity;
    if (fault === "short") return 0;
    return node.ohms;
  }
  const parts = node.items.map((child) => equivalentOhms(child, faults));
  if (node.type === "series") {
    return parts.some((r) => r === Infinity) ? Infinity : parts.reduce((a, b) => a + b, 0);
  }
  // parallel
  if (parts.some((r) => r === 0)) return 0;
  const conductance = parts.reduce((g, r) => g + (r === Infinity ? 0 : 1 / r), 0);
  return conductance === 0 ? Infinity : 1 / conductance;
}

/** Power with the ideal-model conventions: 0 Ω (or 0 V) dissipates nothing, never NaN. */
function powerOf(volts: number, amps: number): number {
  if (volts === 0 || amps === 0) return 0;
  return volts * amps;
}

function distribute(
  node: NetworkNode,
  volts: number,
  amps: number,
  faults: FaultMap,
  out: Record<string, ElementSolution>,
): void {
  if (node.type === "resistor") {
    const fault = faults.get(node.id) ?? null;
    const ohms = fault === "open" ? Infinity : fault === "short" ? 0 : node.ohms;
    out[node.id] = { id: node.id, nominalOhms: node.ohms, ohms, fault, volts, amps, watts: powerOf(volts, amps) };
    return;
  }

  const parts = node.items.map((child) => equivalentOhms(child, faults));

  if (node.type === "series") {
    const total = parts.some((r) => r === Infinity) ? Infinity : parts.reduce((a, b) => a + b, 0);
    if (total === Infinity) {
      // No current flows; the open element(s) take the whole string voltage.
      const openCount = parts.filter((r) => r === Infinity).length;
      node.items.forEach((child, i) => {
        distribute(child, parts[i] === Infinity ? volts / openCount : 0, 0, faults, out);
      });
      return;
    }
    node.items.forEach((child, i) => {
      // With infinite current (dead short) every element here is 0 Ω, so V = 0 (no Inf × 0).
      const v = amps === Infinity || parts[i] === 0 ? 0 : amps * parts[i]!;
      distribute(child, v, amps, faults, out);
    });
    return;
  }

  // parallel
  const shorted = parts.filter((r) => r === 0).length;
  if (shorted > 0) {
    node.items.forEach((child, i) => {
      distribute(child, 0, parts[i] === 0 ? amps / shorted : 0, faults, out);
    });
    return;
  }
  node.items.forEach((child, i) => {
    const r = parts[i]!;
    distribute(child, volts, r === Infinity ? 0 : volts / r, faults, out);
  });
}

export function solveCircuit(circuit: Circuit): CircuitSolution {
  const faults = faultMap(circuit);
  const source = circuit.sourceVolts;
  const totalOhms = equivalentOhms(circuit.network, faults);
  const deadShort = totalOhms === 0 && source > 0;
  const allOpen = totalOhms === Infinity;
  let totalAmps: number;
  if (allOpen) totalAmps = 0;
  else if (totalOhms === 0) totalAmps = source > 0 ? Infinity : 0;
  else totalAmps = source / totalOhms;

  const elements: Record<string, ElementSolution> = {};
  distribute(circuit.network, deadShort ? 0 : source, totalAmps, faults, elements);
  const totalWatts = deadShort ? Infinity : powerOf(source, totalAmps);
  return {
    sourceVolts: source,
    totalOhms,
    totalAmps,
    totalWatts,
    deadShort,
    allOpen,
    elements,
    order: collectResistorIds(circuit.network),
  };
}

export type QuantityKind = "R" | "I" | "V" | "P";

export const QUANTITY_UNITS: Record<QuantityKind, string> = { R: "Ω", I: "A", V: "V", P: "W" };
export const QUANTITY_NAMES: Record<QuantityKind, string> = {
  R: "Resistance",
  I: "Current",
  V: "Voltage",
  P: "Power",
};

export function parseQuantity(quantity: string): { kind: QuantityKind; target: string } | null {
  const m = QUANTITY_PATTERN.exec(quantity);
  if (!m) return null;
  return { kind: m[1] as QuantityKind, target: m[2]! };
}

/** Value of a quantity such as `R_total`, `I_total`, `V_R2` or `P_RL`; null when unknown. */
export function quantityValue(solution: CircuitSolution, quantity: string): number | null {
  const q = parseQuantity(quantity);
  if (!q) return null;
  if (q.target === "total") {
    switch (q.kind) {
      case "R":
        return solution.totalOhms;
      case "I":
        return solution.totalAmps;
      case "V":
        return solution.sourceVolts;
      case "P":
        return solution.totalWatts;
    }
  }
  const el = solution.elements[q.target];
  if (!el) return null;
  switch (q.kind) {
    case "R":
      return el.ohms;
    case "I":
      return el.amps;
    case "V":
      return el.volts;
    case "P":
      return el.watts;
  }
}

/** Human label: "Total current", "Voltage across R2", … */
export function quantityLabel(quantity: string): string {
  const q = parseQuantity(quantity);
  if (!q) return quantity;
  if (q.target === "total") {
    return { R: "Total resistance", I: "Total current", V: "Source voltage", P: "Total power" }[q.kind];
  }
  return { R: `Resistance of ${q.target}`, I: `Current through ${q.target}`, V: `Voltage across ${q.target}`, P: `Power in ${q.target}` }[q.kind];
}
