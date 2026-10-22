import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { deleteScenario, listScenarios, saveScenario } from "@/lib/salary/scenarios";
import { DEFAULT_CALCULATOR_VALUES, DEFAULT_COMPARE_VALUES } from "@/lib/salary/forms";

let userId = "";
let otherId = "";

beforeAll(async () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  userId = (await prisma.user.create({ data: { email: `salary-test+${stamp}@careerquest.test`, passwordHash: "x", name: "Salary Test" } })).id;
  otherId = (await prisma.user.create({ data: { email: `salary-other+${stamp}@careerquest.test`, passwordHash: "x", name: "Other" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await prisma.$disconnect();
});

describe("salary scenarios", () => {
  it("saves, lists by kind, overwrites and deletes only the owner's scenarios", async () => {
    const calc = await saveScenario(userId, { name: "Current job", inputs: { kind: "calculator", version: 1, values: { ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "32" } } });
    const cmp = await saveScenario(userId, { name: "Union vs now", inputs: { kind: "compare", version: 1, values: { ...DEFAULT_COMPARE_VALUES, aAmount: "70000" } } });
    expect(calc).toMatchObject({ ok: true, created: true });
    expect(cmp).toMatchObject({ ok: true, created: true });
    if (!calc.ok || !cmp.ok) throw new Error("save failed");

    const calcs = await listScenarios(userId, "calculator");
    expect(calcs.map((s) => s.name)).toEqual(["Current job"]);
    expect(calcs[0]!.values.hourlyRate).toBe("32");
    expect((await listScenarios(userId, "compare")).map((s) => s.name)).toEqual(["Union vs now"]);
    expect(await listScenarios(otherId, "calculator")).toEqual([]);

    // Another user cannot overwrite or delete it.
    expect(await saveScenario(otherId, { id: calc.id, name: "Hijack", inputs: { kind: "calculator", version: 1, values: DEFAULT_CALCULATOR_VALUES } })).toEqual({ ok: false, reason: "not_found" });
    expect(await deleteScenario(otherId, calc.id)).toBe(false);
    expect((await listScenarios(userId, "calculator"))[0]!.name).toBe("Current job");

    const upd = await saveScenario(userId, { id: calc.id, name: "Current job (5 h OT)", inputs: { kind: "calculator", version: 1, values: { ...DEFAULT_CALCULATOR_VALUES, hourlyRate: "32", overtime15: "5" } } });
    expect(upd).toEqual({ ok: true, id: calc.id, created: false });
    const after = await listScenarios(userId, "calculator");
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ name: "Current job (5 h OT)" });
    expect(after[0]!.values.overtime15).toBe("5");

    expect(await deleteScenario(userId, calc.id)).toBe(true);
    expect(await listScenarios(userId, "calculator")).toEqual([]);
  });

  it("skips rows whose stored JSON no longer validates", async () => {
    await prisma.salaryScenario.create({ data: { userId, name: "Broken", inputs: { kind: "calculator", version: 99 } } });
    expect((await listScenarios(userId, "calculator")).map((s) => s.name)).not.toContain("Broken");
  });
});
