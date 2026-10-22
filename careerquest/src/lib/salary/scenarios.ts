import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_SCENARIOS, scenarioInputsSchema, type CalculatorValues, type CompareValues, type ScenarioInputs, type ScenarioKind } from "./forms";

/**
 * SalaryScenario persistence. Every query is scoped by userId; updates and deletes match
 * `{ id, userId }` so another user's id is simply "not found".
 */

export type SavedScenario<K extends ScenarioKind = ScenarioKind> = {
  id: string;
  name: string;
  updatedAt: Date;
  kind: K;
  values: K extends "calculator" ? CalculatorValues : CompareValues;
};

/** The user's scenarios of one kind, newest first. Rows whose JSON no longer validates are skipped. */
export async function listScenarios<K extends ScenarioKind>(userId: string, kind: K): Promise<SavedScenario<K>[]> {
  const rows = await prisma.salaryScenario.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_SCENARIOS,
    select: { id: true, name: true, inputs: true, updatedAt: true },
  });
  const out: SavedScenario<K>[] = [];
  for (const r of rows) {
    const parsed = scenarioInputsSchema.safeParse(r.inputs);
    if (!parsed.success || parsed.data.kind !== kind) continue;
    out.push({ id: r.id, name: r.name, updatedAt: r.updatedAt, kind, values: parsed.data.values as SavedScenario<K>["values"] });
  }
  return out;
}

export type SaveScenarioResult = { ok: true; id: string; created: boolean } | { ok: false; reason: "not_found" | "limit" };

export async function saveScenario(userId: string, data: { id?: string; name: string; inputs: ScenarioInputs }): Promise<SaveScenarioResult> {
  const inputs = data.inputs as unknown as Prisma.InputJsonValue;
  if (data.id) {
    const res = await prisma.salaryScenario.updateMany({ where: { id: data.id, userId }, data: { name: data.name, inputs } });
    return res.count === 1 ? { ok: true, id: data.id, created: false } : { ok: false, reason: "not_found" };
  }
  const count = await prisma.salaryScenario.count({ where: { userId } });
  if (count >= MAX_SCENARIOS) return { ok: false, reason: "limit" };
  const row = await prisma.salaryScenario.create({ data: { userId, name: data.name, inputs }, select: { id: true } });
  return { ok: true, id: row.id, created: true };
}

export async function deleteScenario(userId: string, id: string): Promise<boolean> {
  const res = await prisma.salaryScenario.deleteMany({ where: { id, userId } });
  return res.count === 1;
}
