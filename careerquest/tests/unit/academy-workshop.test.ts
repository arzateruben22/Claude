import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/db";
import { getWorkshop, listWorkshops } from "@/lib/academy/content";
import { quantityValue, solveCircuit } from "@/lib/academy/solver";
import { addResistor, removeResistor, setFault, setResistorOhms, setSourceVolts, SANDBOX_LIMITS } from "@/lib/academy/sandbox";
import { collectResistorIds, type Circuit, type Workshop } from "@/lib/academy/schema";
import { formatMeasurement, gradeWorkshop, toBaseUnits, toPublicWorkshop, type WorkshopAnswer } from "@/lib/academy/workshop";
import { getWorkshopProgress, submitWorkshop } from "@/lib/academy/service";
import { WorkshopBench, WorkshopResults } from "@/components/academy/workshop/bench";
import { SchematicView } from "@/components/academy/workshop/schematic-view";
import { layoutSchematic } from "@/lib/academy/schematic";

function correctAnswers(w: Workshop, opts: { measured?: string[]; wrongChoice?: boolean } = {}): Record<string, WorkshopAnswer> {
  const sol = solveCircuit(w.circuit);
  return Object.fromEntries(
    w.tasks.map((t) => {
      const value =
        t.type === "numeric"
          ? String(quantityValue(sol, t.quantity))
          : String(opts.wrongChoice ? (t.correctIndex + 1) % t.choices.length : t.correctIndex);
      return [t.id, { value, measuredFirst: opts.measured?.includes(t.id) ?? false }];
    }),
  );
}

describe("workshop grading", () => {
  it("never sends the multiple-choice key or explanations to the client", () => {
    for (const w of listWorkshops()) {
      const pub = toPublicWorkshop(getWorkshop(w.key)!);
      expect(JSON.stringify(pub)).not.toMatch(/correctIndex|explanation/);
      for (const t of pub.tasks) if (t.type === "numeric") expect(["Ω", "A", "V", "W"]).toContain(t.unit);
    }
  });

  it("grades every workshop's correct answers as a clean run", () => {
    for (const summary of listWorkshops()) {
      const w = getWorkshop(summary.key)!;
      const g = gradeWorkshop(w, correctAnswers(w));
      expect(g.allCorrect, w.key).toBe(true);
      expect(g.cleanRun, w.key).toBe(true);
      expect(g.score).toBe(w.tasks.length);
    }
  });

  it("applies relative and absolute tolerances and flags measured-first answers", () => {
    const w = getWorkshop("fault-finding-open")!;
    const answers = correctAnswers(w, { measured: ["fault-finding-open-t1"] });
    answers["fault-finding-open-t2"] = { value: String(8 * 1.019), measuredFirst: false }; // within 2 %
    answers["fault-finding-open-t3"] = { value: "0.0009", measuredFirst: false }; // within ±0.001 A of 0
    const g = gradeWorkshop(w, answers);
    expect(g.allCorrect).toBe(true);
    expect(g.cleanRun).toBe(false);
    answers["fault-finding-open-t2"] = { value: String(8 * 1.03), measuredFirst: false };
    answers["fault-finding-open-t3"] = { value: "0.002", measuredFirst: false };
    const g2 = gradeWorkshop(w, answers);
    expect(g2.results.filter((r) => !r.correct).map((r) => r.id)).toEqual(["fault-finding-open-t2", "fault-finding-open-t3"]);
  });

  it("treats blanks, junk and wrong choices as incorrect", () => {
    const w = getWorkshop("missing-ground-path")!;
    const answers = correctAnswers(w, { wrongChoice: true });
    answers["missing-ground-path-t1"] = { value: "abc", measuredFirst: false };
    delete answers["missing-ground-path-t2"];
    const g = gradeWorkshop(w, answers);
    const by = Object.fromEntries(g.results.map((r) => [r.id, r]));
    expect(by["missing-ground-path-t1"]).toMatchObject({ correct: false, answered: false });
    expect(by["missing-ground-path-t2"]).toMatchObject({ correct: false, answered: false });
    expect(by["missing-ground-path-t4"]!.correct).toBe(false);
    expect(g.allCorrect).toBe(false);
  });

  it("formats readings like a meter and converts answer prefixes", () => {
    expect(formatMeasurement(0.06, "A")).toBe("60 mA");
    expect(formatMeasurement(4700, "Ω")).toBe("4.7 kΩ");
    expect(formatMeasurement(Infinity, "Ω")).toBe("OL");
    expect(formatMeasurement(0, "V")).toBe("0 V");
    expect(formatMeasurement(119.7604, "V")).toBe("119.8 V");
    expect(toBaseUnits(60, "A", "mA")).toBeCloseTo(0.06, 12);
    expect(toBaseUnits(4.7, "Ω", "kΩ")).toBeCloseTo(4700, 9);
    expect(toBaseUnits(5, "V", "unknown")).toBe(5);
  });
});

describe("experiment-mode circuit editing", () => {
  const base: Circuit = { sourceVolts: 24, network: { type: "parallel", items: [{ type: "resistor", id: "R1", ohms: 12 }, { type: "resistor", id: "R2", ohms: 24 }] }, faults: [] };

  it("adds a branch to an existing parallel group (flattened) and in series", () => {
    const { circuit, id } = addResistor(base, "R2", "parallel", 8);
    expect(id).toBe("R3");
    expect(circuit.network.type === "parallel" && circuit.network.items.length).toBe(3);
    expect(solveCircuit(circuit).totalAmps).toBeCloseTo(24 / 12 + 24 / 24 + 24 / 8, 10);
    const s = addResistor(circuit, "R1", "series", 12);
    expect(collectResistorIds(s.circuit.network)).toEqual(["R1", "R4", "R2", "R3"]);
    expect(solveCircuit(s.circuit).elements.R1!.volts).toBeCloseTo(12, 10);
  });

  it("changes values, faults and source voltage; removes parts but never the last one", () => {
    let c = setSourceVolts(base, 48);
    c = setResistorOhms(c, "R1", 24);
    expect(solveCircuit(c).totalAmps).toBeCloseTo(4, 10);
    c = setFault(c, "R2", "open");
    expect(solveCircuit(c).totalAmps).toBeCloseTo(2, 10);
    c = setFault(c, "R2", null);
    expect(c.faults).toEqual([]);
    c = removeResistor(c, "R2");
    expect(c.network).toEqual({ type: "resistor", id: "R1", ohms: 24 });
    expect(removeResistor(c, "R1")).toBe(c);
    expect(setSourceVolts(base, 1e9).sourceVolts).toBe(SANDBOX_LIMITS.maxVolts);
    expect(setResistorOhms(base, "R1", -5).network).toMatchObject({ items: [{ ohms: 0 }, { ohms: 24 }] });
  });

  it("stops adding at the size limit", () => {
    let c = base;
    for (let i = 0; i < 20; i++) c = addResistor(c, "R1", "series", 1).circuit;
    expect(collectResistorIds(c.network)).toHaveLength(SANDBOX_LIMITS.maxResistors);
    expect(addResistor(c, "R1", "series", 1).id).toBeNull();
  });
});

describe("workshop components render", () => {
  it("renders the bench with the simulation notice, schematic, blank meter and no answer key", () => {
    const w = getWorkshop("meter-fault-finding")!;
    const html = renderToStaticMarkup(createElement(WorkshopBench, { workshop: toPublicWorkshop(w) }));
    expect(html).toContain("Simulation — not qualifying field experience");
    expect(html).toContain("Schematic: Find the Open with a Meter");
    expect(html).toContain("– – – –");
    expect(html).toContain("Exercise (graded)");
    expect(html).toContain("Experiment (ungraded)");
    expect(html).toContain('data-resistor="R2"');
    expect(html).toContain("OPEN");
    expect(html).toContain("Submit bench report");
    expect(html).not.toContain("correctIndex");
    // the bench must not print the solved answers before the student commits
    expect(html).not.toContain(formatMeasurement(solveCircuit(w.circuit).totalAmps, "A"));
  });

  it("renders a static schematic with shorts and results with measured-first badges", () => {
    const circuit: Circuit = { sourceVolts: 12, network: { type: "series", items: [{ type: "resistor", id: "R1", ohms: 100 }, { type: "resistor", id: "R2", ohms: 200 }] }, faults: [{ id: "R2", fault: "short" }] };
    const svg = renderToStaticMarkup(createElement(SchematicView, { schematic: layoutSchematic(circuit), title: "Test" }));
    expect(svg).toContain("SHORT");
    expect(svg).toContain("12 V");
    expect(svg).not.toContain('role="button"');
    const w = getWorkshop("series-basics")!;
    const html = renderToStaticMarkup(
      createElement(WorkshopResults, {
        workshop: toPublicWorkshop(w),
        outcome: {
          attemptId: "x",
          score: 5,
          maxScore: 6,
          allCorrect: false,
          cleanRun: false,
          firstClear: false,
          results: w.tasks.map((t, i) => ({ id: t.id, type: t.type, correct: i > 0, answered: true, measuredFirst: i === 1, given: "1 V", expected: "2 V", explanation: i === 2 ? "Because KVL." : null })),
        },
      }),
    );
    expect(html).toContain("5 of 6 correct");
    expect(html).toContain("Measured first");
    expect(html).toContain("Because KVL.");
    expect(html).toContain('href="/academy/workshop"');
  });
});

// ---------------------------------------------------------------------------
// DB-backed
// ---------------------------------------------------------------------------

let userId = "";

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: { email: `academy-workshop+${stamp}@careerquest.test`, passwordHash: "x", name: "Bench", profile: { create: { timezone: "America/Los_Angeles" } }, stats: { create: {} } },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("workshop attempts", () => {
  it("records attempts as QuizAttempt rows and never awards workshop XP", async () => {
    const w = getWorkshop("series-parallel-1")!;
    const messy = await submitWorkshop(userId, w.key, correctAnswers(w, { measured: [w.tasks[0]!.id] }));
    expect(messy.ok && messy.data).toMatchObject({ allCorrect: true, cleanRun: false, firstClear: false });
    const clean = await submitWorkshop(userId, w.key, correctAnswers(w));
    expect(clean.ok && clean.data).toMatchObject({ allCorrect: true, cleanRun: true, firstClear: true });
    const again = await submitWorkshop(userId, w.key, correctAnswers(w));
    expect(again.ok && again.data).toMatchObject({ cleanRun: true, firstClear: false });

    const attempts = await prisma.quizAttempt.findMany({ where: { userId, quizKey: `workshop:${w.key}` }, orderBy: { createdAt: "asc" } });
    expect(attempts.map((a) => a.passed)).toEqual([false, true, true]);
    expect(attempts[0]!.score).toBe(w.tasks.length);
    expect(await prisma.xpLedger.count({ where: { userId, sourceType: { in: ["Workshop", "Lesson", "PracticeExam"] } } })).toBe(0);
    expect(await prisma.xpLedger.count({ where: { userId, dedupeKey: { contains: "workshop" } } })).toBe(0);
    const stats = await prisma.playerStats.findUnique({ where: { userId } });
    expect(stats?.electricianXp).toBe(0);

    const progress = await getWorkshopProgress(userId);
    expect(progress[w.key]).toMatchObject({ attempts: 3, cleared: true, bestScore: w.tasks.length });
    expect(await submitWorkshop(userId, "missing-workshop", {})).toMatchObject({ ok: false, reason: "not_found" });
  });
});
