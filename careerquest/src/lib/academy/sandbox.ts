import type { Circuit } from "./schema";
import { collectResistorIds, type FaultKind, type NetworkNode } from "./constants";

/**
 * Pure editing operations for the bench's ungraded Experiment mode: change values, open or short a
 * part, add a resistor in series or in parallel with another, or remove one. Every operation
 * returns a new circuit and keeps the tree normalized (no single-item groups, no group nested in a
 * group of the same kind).
 */

export const SANDBOX_LIMITS = { maxResistors: 12, maxOhms: 10_000_000, maxVolts: 1000 } as const;

function normalize(node: NetworkNode): NetworkNode {
  if (node.type === "resistor") return node;
  const items: NetworkNode[] = [];
  for (const child of node.items.map(normalize)) {
    if (child.type === node.type) items.push(...child.items);
    else items.push(child);
  }
  return items.length === 1 ? items[0]! : { type: node.type, items };
}

function mapResistor(node: NetworkNode, id: string, fn: (r: Extract<NetworkNode, { type: "resistor" }>) => NetworkNode): NetworkNode {
  if (node.type === "resistor") return node.id === id ? fn(node) : node;
  return { type: node.type, items: node.items.map((c) => mapResistor(c, id, fn)) };
}

export function nextResistorId(network: NetworkNode): string {
  const used = new Set(collectResistorIds(network));
  let n = used.size + 1;
  while (used.has(`R${n}`)) n++;
  return `R${n}`;
}

const clampOhms = (ohms: number) => Math.min(SANDBOX_LIMITS.maxOhms, Math.max(0, Number.isFinite(ohms) ? ohms : 0));

export function setSourceVolts(circuit: Circuit, volts: number): Circuit {
  const v = Math.min(SANDBOX_LIMITS.maxVolts, Math.max(0, Number.isFinite(volts) ? volts : 0));
  return { ...circuit, sourceVolts: v };
}

export function setResistorOhms(circuit: Circuit, id: string, ohms: number): Circuit {
  return { ...circuit, network: mapResistor(circuit.network, id, (r) => ({ ...r, ohms: clampOhms(ohms) })) };
}

export function setFault(circuit: Circuit, id: string, fault: FaultKind | null): Circuit {
  const faults = (circuit.faults ?? []).filter((f) => f.id !== id);
  if (fault) faults.push({ id, fault });
  return { ...circuit, faults };
}

/** Add a new resistor in series or in parallel with `targetId`. Returns the circuit unchanged at the size limit. */
export function addResistor(circuit: Circuit, targetId: string, mode: "series" | "parallel", ohms: number): { circuit: Circuit; id: string | null } {
  const ids = collectResistorIds(circuit.network);
  if (ids.length >= SANDBOX_LIMITS.maxResistors || !ids.includes(targetId)) return { circuit, id: null };
  const id = nextResistorId(circuit.network);
  const added: NetworkNode = { type: "resistor", id, ohms: clampOhms(ohms) };
  const network = normalize(mapResistor(circuit.network, targetId, (r) => ({ type: mode, items: [r, added] })));
  return { circuit: { ...circuit, network }, id };
}

function without(node: NetworkNode, id: string): NetworkNode | null {
  if (node.type === "resistor") return node.id === id ? null : node;
  const items = node.items.map((c) => without(c, id)).filter((c): c is NetworkNode => c !== null);
  if (!items.length) return null;
  return { type: node.type, items };
}

/** Remove a resistor (never the last one). */
export function removeResistor(circuit: Circuit, id: string): Circuit {
  const next = without(circuit.network, id);
  if (!next || collectResistorIds(next).length === collectResistorIds(circuit.network).length) return circuit;
  return { ...circuit, network: normalize(next), faults: (circuit.faults ?? []).filter((f) => f.id !== id) };
}

export function findResistor(network: NetworkNode, id: string): Extract<NetworkNode, { type: "resistor" }> | null {
  if (network.type === "resistor") return network.id === id ? network : null;
  for (const c of network.items) {
    const hit = findResistor(c, id);
    if (hit) return hit;
  }
  return null;
}
