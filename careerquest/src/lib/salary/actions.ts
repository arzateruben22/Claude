"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_SCENARIOS, scenarioInputsSchema, scenarioNameSchema } from "./forms";
import { deleteScenario, saveScenario } from "./scenarios";

export type ScenarioActionData = { message: string; id: string };

const saveSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  name: scenarioNameSchema,
  inputs: z.string().max(20_000),
});

function revalidateSalary() {
  revalidatePath("/salary");
  revalidatePath("/salary/compare");
}

/** Create a named scenario, or overwrite one the user owns when `id` is given. */
export async function saveScenarioAction(_prev: ActionResult<ScenarioActionData> | null, formData: FormData): Promise<ActionResult<ScenarioActionData>> {
  const user = await requireUser();
  if (!rateLimit(`salary-scenario:${user.id}`, 60, 60_000).ok) return fail("Too many saves in a short time. Wait a minute and try again.");
  const parsed = saveSchema.safeParse({
    id: formData.get("id") ?? undefined,
    name: formData.get("name") ?? "",
    inputs: formData.get("inputs") ?? "",
  });
  if (!parsed.success) return fromZodError(parsed.error);
  let json: unknown;
  try {
    json = JSON.parse(parsed.data.inputs);
  } catch {
    return fail("The scenario could not be read. Reload the page and try again.");
  }
  const inputs = scenarioInputsSchema.safeParse(json);
  if (!inputs.success) return fail("The scenario contains values that cannot be saved. Reload the page and try again.");
  try {
    const res = await saveScenario(user.id, { id: parsed.data.id || undefined, name: parsed.data.name, inputs: inputs.data });
    if (!res.ok) {
      return fail(res.reason === "limit" ? `You can keep up to ${MAX_SCENARIOS} scenarios. Delete one first.` : "That scenario no longer exists.");
    }
    revalidateSalary();
    return ok({ message: res.created ? `Saved “${parsed.data.name}”.` : `Updated “${parsed.data.name}”.`, id: res.id });
  } catch (err) {
    console.error("saveScenarioAction failed", err);
    return fail("Something went wrong saving the scenario. Please try again.");
  }
}

export async function deleteScenarioAction(_prev: ActionResult<ScenarioActionData> | null, formData: FormData): Promise<ActionResult<ScenarioActionData>> {
  const user = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("That scenario no longer exists.");
  try {
    const removed = await deleteScenario(user.id, id.data);
    if (!removed) return fail("That scenario no longer exists.");
    revalidateSalary();
    return ok({ message: "Scenario deleted.", id: id.data });
  } catch (err) {
    console.error("deleteScenarioAction failed", err);
    return fail("Something went wrong deleting the scenario. Please try again.");
  }
}
