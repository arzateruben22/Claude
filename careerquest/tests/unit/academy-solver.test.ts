import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadAcademyContent } from "@/lib/academy/content";
import { equivalentOhms, parseQuantity, quantityLabel, quantityValue, solveCircuit, type CircuitSolution } from "@/lib/academy/solver";
import type { Circuit, NetworkNode } from "@/lib/academy/schema";
import { layoutSchematic } from "@/lib/academy/schematic";

const r = (id: string, ohms: number): NetworkNode => ({ type: "resistor", id, ohms });
const series = (...items: NetworkNode[]): NetworkNode => ({ type: "series", items });
const parallel = (...items: NetworkNode[]): NetworkNode => ({ type: "parallel", items });

function noNaN(sol: CircuitSolution) {
  const values = [sol.totalOhms, sol.totalAmps, sol.totalWatts, ...Object.values(sol.elements).flatMap((e) => [e.ohms, e.volts, e.amps, e.watts])];
  for (const v of values) expect(Number.isNaN(v)).toBe(false);
}

const content = loadAcademyContent(path.join(process.cwd(), "data", "academy"), () => undefined);

describe("DC solver — every workshop exercise", () => {
  it("resolves every numeric task of every workshop JSON file to a finite value", () => {
    expect(content.workshops.length).toBeGreaterThan(0);
    let checked = 0;
    for (const w of content.workshops) {
      const sol = solveCircuit(w.circuit);
      noNaN(sol);
      for (const t of w.tasks) {
        if (t.type !== "numeric") continue;
        const v = quantityValue(sol, t.quantity);
        expect(v, `${w.key}/${t.id} ${t.quantity}`).not.toBeNull();
        expect(Number.isFinite(v!), `${w.key}/${t.id} ${t.quantity}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("series-basics: hand-checked (12 V across 100 + 200 + 300 Ω)", () => {
    const sol = solveCircuit(content.workshopsByKey.get("series-basics")!.circuit);
    expect(sol.totalOhms).toBe(600);
    expect(sol.totalAmps).toBeCloseTo(0.02, 12);
    expect(quantityValue(sol, "V_R1")).toBeCloseTo(2, 10);
    expect(quantityValue(sol, "V_R2")).toBeCloseTo(4, 10);
    expect(quantityValue(sol, "V_R3")).toBeCloseTo(6, 10);
    expect(quantityValue(sol, "P_total")).toBeCloseTo(0.24, 10);
    expect(quantityValue(sol, "P_R3")).toBeCloseTo(0.12, 10);
  });

  it("series-parallel-1: hand-checked (100 Ω + 200 ∥ 200 Ω on 12 V)", () => {
    const sol = solveCircuit(content.workshopsByKey.get("series-parallel-1")!.circuit);
    expect(sol.totalOhms).toBeCloseTo(200, 10);
    expect(sol.totalAmps).toBeCloseTo(0.06, 12);
    expect(quantityValue(sol, "V_R1")).toBeCloseTo(6, 10);
    expect(quantityValue(sol, "V_R2")).toBeCloseTo(6, 10);
    expect(quantityValue(sol, "I_R3")).toBeCloseTo(0.03, 12);
    expect(quantityValue(sol, "P_R1")).toBeCloseTo(0.36, 10);
  });

  it("series-parallel-2: hand-checked (4 Ω + (6 + 6) ∥ 12 Ω on 48 V)", () => {
    const sol = solveCircuit(content.workshopsByKey.get("series-parallel-2")!.circuit);
    expect(sol.totalOhms).toBeCloseTo(10, 10);
    expect(sol.totalAmps).toBeCloseTo(4.8, 10);
    expect(quantityValue(sol, "V_R1")).toBeCloseTo(19.2, 10);
    expect(quantityValue(sol, "V_R4")).toBeCloseTo(28.8, 10);
    expect(quantityValue(sol, "I_R4")).toBeCloseTo(2.4, 10);
    expect(quantityValue(sol, "V_R2")).toBeCloseTo(14.4, 10);
    expect(quantityValue(sol, "P_total")).toBeCloseTo(230.4, 8);
  });

  it("fault-finding-open: R3 open leaves R1 + R2 in series", () => {
    const sol = solveCircuit(content.workshopsByKey.get("fault-finding-open")!.circuit);
    expect(sol.totalOhms).toBeCloseTo(300, 10);
    expect(sol.totalAmps).toBeCloseTo(0.04, 12);
    expect(quantityValue(sol, "V_R2")).toBeCloseTo(8, 10);
    expect(quantityValue(sol, "V_R1")).toBeCloseTo(4, 10);
    expect(quantityValue(sol, "I_R3")).toBe(0);
    // the open branch still shows the group voltage, as a voltmeter across it would
    expect(quantityValue(sol, "V_R3")).toBeCloseTo(8, 10);
    expect(quantityValue(sol, "R_R3")).toBe(Infinity);
    expect(sol.elements.R3!.fault).toBe("open");
  });

  it("missing-ground-path: the earth path limits fault current below the breaker rating", () => {
    const sol = solveCircuit(content.workshopsByKey.get("missing-ground-path")!.circuit);
    expect(sol.totalOhms).toBeCloseTo(50.1, 10);
    expect(sol.totalAmps).toBeCloseTo(120 / 50.1, 10);
    expect(quantityValue(sol, "V_R3")).toBeCloseTo((120 * 50) / 50.1, 8);
  });
});

describe("DC solver — faults and edge cases", () => {
  it("an open in a pure series loop takes the whole source voltage", () => {
    const sol = solveCircuit({ sourceVolts: 120, network: series(r("R1", 10), r("R2", 20)), faults: [{ id: "R2", fault: "open" }] });
    noNaN(sol);
    expect(sol.totalAmps).toBe(0);
    expect(sol.allOpen).toBe(true);
    expect(sol.elements.R2!.volts).toBe(120);
    expect(sol.elements.R1!.volts).toBe(0);
    expect(sol.totalWatts).toBe(0);
  });

  it("an all-open circuit produces zeros and no NaN", () => {
    const sol = solveCircuit({
      sourceVolts: 24,
      network: parallel(r("R1", 10), series(r("R2", 5), r("R3", 5))),
      faults: [
        { id: "R1", fault: "open" },
        { id: "R2", fault: "open" },
      ],
    });
    noNaN(sol);
    expect(sol.totalOhms).toBe(Infinity);
    expect(sol.totalAmps).toBe(0);
    expect(sol.elements.R1!.volts).toBe(24);
    expect(sol.elements.R2!.volts).toBe(24);
    expect(sol.elements.R3!.volts).toBe(0);
    expect(Object.values(sol.elements).every((e) => e.amps === 0 && e.watts === 0)).toBe(true);
  });

  it("two opens in the same series string share the voltage", () => {
    const sol = solveCircuit({
      sourceVolts: 10,
      network: series(r("R1", 1), r("R2", 1), r("R3", 1)),
      faults: [
        { id: "R1", fault: "open" },
        { id: "R3", fault: "open" },
      ],
    });
    noNaN(sol);
    expect(sol.elements.R1!.volts).toBe(5);
    expect(sol.elements.R3!.volts).toBe(5);
    expect(sol.elements.R2!.volts).toBe(0);
  });

  it("a shorted branch collapses its parallel group to 0 V and carries the whole group current", () => {
    const sol = solveCircuit({
      sourceVolts: 12,
      network: series(r("R1", 100), parallel(r("R2", 200), r("R3", 200))),
      faults: [{ id: "R3", fault: "short" }],
    });
    noNaN(sol);
    expect(sol.totalOhms).toBe(100);
    expect(sol.totalAmps).toBeCloseTo(0.12, 12);
    expect(sol.elements.R1!.volts).toBeCloseTo(12, 10);
    expect(sol.elements.R2!.volts).toBe(0);
    expect(sol.elements.R2!.amps).toBe(0);
    expect(sol.elements.R3!.amps).toBeCloseTo(0.12, 12);
    expect(sol.elements.R3!.watts).toBe(0);
    expect(sol.deadShort).toBe(false);
  });

  it("two shorted branches split the group current", () => {
    const sol = solveCircuit({
      sourceVolts: 10,
      network: series(r("R1", 5), parallel(r("R2", 1), r("R3", 1), r("R4", 1))),
      faults: [
        { id: "R2", fault: "short" },
        { id: "R4", fault: "short" },
      ],
    });
    noNaN(sol);
    expect(sol.elements.R2!.amps).toBeCloseTo(1, 12);
    expect(sol.elements.R4!.amps).toBeCloseTo(1, 12);
    expect(sol.elements.R3!.amps).toBe(0);
  });

  it("a dead short across the source is flagged instead of returning NaN", () => {
    const sol = solveCircuit({ sourceVolts: 120, network: parallel(r("R1", 10), r("R2", 20)), faults: [{ id: "R2", fault: "short" }] });
    noNaN(sol);
    expect(sol.deadShort).toBe(true);
    expect(sol.totalAmps).toBe(Infinity);
    expect(sol.elements.R1!.amps).toBe(0);
    expect(sol.elements.R2!.volts).toBe(0);
    expect(sol.elements.R2!.watts).toBe(0);
  });

  it("a 0 V source and a zero-ohm network stay finite", () => {
    const sol = solveCircuit({ sourceVolts: 0, network: r("R1", 0), faults: [] });
    noNaN(sol);
    expect(sol.totalAmps).toBe(0);
    expect(sol.deadShort).toBe(false);
  });

  it("handles deeper nesting and conserves current and voltage (KCL/KVL)", () => {
    const network = series(r("R1", 10), parallel(series(r("R2", 20), parallel(r("R3", 30), r("R4", 60))), r("R5", 40)), r("R6", 5));
    const sol = solveCircuit({ sourceVolts: 100, network, faults: [] });
    noNaN(sol);
    // R3 ∥ R4 = 20; + R2 = 40; ∥ R5 (40) = 20; + R1 + R6 = 35
    expect(equivalentOhms(network)).toBeCloseTo(35, 10);
    const e = sol.elements;
    expect(e.R1!.amps).toBeCloseTo(e.R2!.amps + e.R5!.amps, 10);
    expect(e.R2!.amps).toBeCloseTo(e.R3!.amps + e.R4!.amps, 10);
    expect(e.R1!.volts + e.R5!.volts + e.R6!.volts).toBeCloseTo(100, 10);
    expect(e.R2!.volts + e.R3!.volts).toBeCloseTo(e.R5!.volts, 10);
    const sumWatts = Object.values(e).reduce((s, x) => s + x.watts, 0);
    expect(sumWatts).toBeCloseTo(sol.totalWatts, 8);
  });

  it("parses quantities and labels them", () => {
    expect(parseQuantity("I_total")).toEqual({ kind: "I", target: "total" });
    expect(parseQuantity("P_RL")).toEqual({ kind: "P", target: "RL" });
    expect(parseQuantity("X_total")).toBeNull();
    expect(quantityLabel("V_R2")).toBe("Voltage across R2");
    const sol = solveCircuit({ sourceVolts: 9, network: r("R1", 3), faults: [] });
    expect(quantityValue(sol, "V_total")).toBe(9);
    expect(quantityValue(sol, "I_R9")).toBeNull();
  });
});

describe("schematic layout", () => {
  it("places every resistor once inside the drawing for every workshop", () => {
    for (const w of content.workshops) {
      const s = layoutSchematic(w.circuit as Circuit);
      expect(s.resistors.map((x) => x.id).sort()).toEqual(solveCircuit(w.circuit).order.slice().sort());
      for (const res of s.resistors) {
        expect(res.x).toBeGreaterThanOrEqual(0);
        expect(res.x).toBeLessThan(s.width);
        expect(res.y).toBeLessThan(s.height);
      }
      for (const wire of s.wires) for (const v of [wire.x1, wire.x2, wire.y1, wire.y2]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("stacks parallel branches on separate rows and marks faults", () => {
    const s = layoutSchematic({ sourceVolts: 12, network: parallel(r("A", 1), r("B", 2), r("C", 3)), faults: [{ id: "B", fault: "open" }] });
    const ys = s.resistors.map((x) => x.y);
    expect(new Set(ys).size).toBe(3);
    expect(s.resistors.find((x) => x.id === "B")!.fault).toBe("open");
    expect(s.junctions.length).toBe(4);
  });
});
