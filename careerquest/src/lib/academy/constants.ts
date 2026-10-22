/**
 * Zod-free constants and network types shared by server code and client components (the bench,
 * badges, progress views). `schema.ts` re-exports these alongside the zod schemas.
 */

export const TRACK_KEYS = ["FUNDAMENTALS", "SAFETY", "INSTALLATION", "SYSTEMS", "CODE", "EXAM_PREP"] as const;
export type TrackKey = (typeof TRACK_KEYS)[number];

export const MAX_SECTIONS = 16;

export const CALLOUT_TONES = ["safety", "warning", "tip", "simulation"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export const FAULT_KINDS = ["open", "short"] as const;
export type FaultKind = (typeof FAULT_KINDS)[number];

export type ResistorNode = { type: "resistor"; id: string; ohms: number };
export type GroupNode = { type: "series" | "parallel"; items: NetworkNode[] };
export type NetworkNode = ResistorNode | GroupNode;

/** Measurable quantities: R/I/V/P of the whole circuit (`_total`) or of one resistor (`_R2`). */
export const QUANTITY_PATTERN = /^(R|I|V|P)_([A-Za-z][A-Za-z0-9_]*)$/;

export function collectResistorIds(node: NetworkNode, out: string[] = []): string[] {
  if (node.type === "resistor") out.push(node.id);
  else for (const child of node.items) collectResistorIds(child, out);
  return out;
}
