import type { Circuit } from "./schema";
import type { FaultKind, NetworkNode } from "./constants";

/**
 * Pure layout of a series/parallel resistor network as a ladder schematic: the source on the left,
 * the network on the top wire, the return path along the bottom. Series items sit side by side,
 * parallel branches stack between two vertical rails. The bench component draws these primitives.
 */

export const RESISTOR_SPAN = 96; // horizontal space for one resistor including its leads
export const RESISTOR_BODY = 44; // zig-zag body width
const ROW_HEIGHT = 70;
const WIRE_OFFSET = 34; // wire y inside a resistor row (label above, value below)
const RAIL_LEAD = 22; // horizontal lead from a rail to a branch
const BRANCH_GAP = 6;
const MARGIN = 20;
const SOURCE_GAP = 76; // from the source line to the first element
const RETURN_GAP = 34; // bottom return wire below the network
const RIGHT_LEAD = 30;

export type SchematicWire = { x1: number; y1: number; x2: number; y2: number };
export type SchematicResistor = { id: string; ohms: number; fault: FaultKind | null; x: number; y: number };
export type Schematic = {
  width: number;
  height: number;
  wires: SchematicWire[];
  resistors: SchematicResistor[];
  junctions: { x: number; y: number }[];
  source: { x: number; top: number; bottom: number; volts: number };
};

type Out = { wires: SchematicWire[]; resistors: SchematicResistor[]; junctions: { x: number; y: number }[] };
type Box = { w: number; h: number; wy: number; place: (x: number, y: number, out: Out) => void };

function boxFor(node: NetworkNode, faults: ReadonlyMap<string, FaultKind>): Box {
  if (node.type === "resistor") {
    return {
      w: RESISTOR_SPAN,
      h: ROW_HEIGHT,
      wy: WIRE_OFFSET,
      place: (x, y, out) => out.resistors.push({ id: node.id, ohms: node.ohms, fault: faults.get(node.id) ?? null, x, y: y + WIRE_OFFSET }),
    };
  }
  const children = node.items.map((c) => boxFor(c, faults));

  if (node.type === "series") {
    const wy = Math.max(...children.map((c) => c.wy));
    const h = Math.max(...children.map((c) => wy - c.wy + c.h));
    const w = children.reduce((s, c) => s + c.w, 0);
    return {
      w,
      h,
      wy,
      place: (x, y, out) => {
        let cx = x;
        for (const c of children) {
          c.place(cx, y + wy - c.wy, out);
          cx += c.w;
        }
      },
    };
  }

  // parallel
  const inner = Math.max(...children.map((c) => c.w));
  const w = inner + RAIL_LEAD * 2;
  const offsets: number[] = [];
  let acc = 0;
  for (const c of children) {
    offsets.push(acc);
    acc += c.h + BRANCH_GAP;
  }
  const h = acc - BRANCH_GAP;
  const wy = children[0]!.wy;
  return {
    w,
    h,
    wy,
    place: (x, y, out) => {
      const ys = children.map((c, i) => y + offsets[i]! + c.wy);
      const right = x + w;
      children.forEach((c, i) => {
        const by = ys[i]!;
        out.wires.push({ x1: x, y1: by, x2: x + RAIL_LEAD, y2: by });
        c.place(x + RAIL_LEAD, y + offsets[i]!, out);
        out.wires.push({ x1: x + RAIL_LEAD + c.w, y1: by, x2: right, y2: by });
        // Dots where three conductors meet: every branch tap except the bottom corner.
        if (i < children.length - 1) out.junctions.push({ x, y: by }, { x: right, y: by });
      });
      const top = ys[0]!;
      const bottom = ys[ys.length - 1]!;
      if (bottom > top) {
        out.wires.push({ x1: x, y1: top, x2: x, y2: bottom }, { x1: right, y1: top, x2: right, y2: bottom });
      }
    },
  };
}

export function layoutSchematic(circuit: Circuit): Schematic {
  const faults = new Map<string, FaultKind>((circuit.faults ?? []).map((f) => [f.id, f.fault]));
  const box = boxFor(circuit.network, faults);
  const out: Out = { wires: [], resistors: [], junctions: [] };
  const sourceX = MARGIN + 28;
  const x0 = sourceX + SOURCE_GAP;
  const y0 = MARGIN;
  box.place(x0, y0, out);

  const topY = y0 + box.wy;
  const bottomY = y0 + box.h + RETURN_GAP;
  const rightX = x0 + box.w + RIGHT_LEAD;
  out.wires.push(
    { x1: sourceX, y1: topY, x2: x0, y2: topY },
    { x1: x0 + box.w, y1: topY, x2: rightX, y2: topY },
    { x1: rightX, y1: topY, x2: rightX, y2: bottomY },
    { x1: rightX, y1: bottomY, x2: sourceX, y2: bottomY },
  );

  // Nested groups can tap the same point twice; draw each dot once.
  const seen = new Set<string>();
  const junctions = out.junctions.filter((j) => {
    const k = `${j.x},${j.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    width: rightX + MARGIN,
    height: bottomY + MARGIN,
    wires: out.wires,
    resistors: out.resistors,
    junctions,
    source: { x: sourceX, top: topY, bottom: bottomY, volts: circuit.sourceVolts },
  };
}
