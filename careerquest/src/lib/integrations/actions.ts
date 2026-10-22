"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/rate-limit";
import { disconnectConnection, setSyncEnabled } from "./connections";
import { productionSyncDeps } from "./defaults";
import { syncConnection } from "./sync";

/**
 * Server actions for /integrations. Each authenticates, validates, and acts only on the signed-in
 * user's own connection (every query is scoped by userId).
 */

export type IntegrationActionData = { message: string };

const connectionIdSchema = z.object({ connectionId: z.uuid("Unknown connection.") });

export async function syncNowAction(_prev: ActionResult<IntegrationActionData> | null, formData: FormData): Promise<ActionResult<IntegrationActionData>> {
  const user = await requireUser("/integrations");
  const parsed = connectionIdSchema.safeParse({ connectionId: formData.get("connectionId") });
  if (!parsed.success) return fromZodError(parsed.error);
  if (!rateLimit(`integrations-sync:${user.id}`, 10, 60 * 60_000).ok) return fail("Too many syncs in the last hour. Try again later.");

  const summary = await syncConnection(user.id, parsed.data.connectionId, productionSyncDeps());
  revalidatePath("/integrations");
  revalidatePath("/applications");
  if (summary.status === "SKIPPED") return fail(summary.message);
  if (summary.status === "FAILED") return fail(summary.message);
  return ok({ message: `Sync finished: ${summary.message}.` });
}

const disconnectSchema = connectionIdSchema.extend({ deleteEmails: z.boolean() });

export async function disconnectAction(
  _prev: ActionResult<IntegrationActionData> | null,
  formData: FormData,
): Promise<ActionResult<IntegrationActionData>> {
  const user = await requireUser("/integrations");
  const parsed = disconnectSchema.safeParse({
    connectionId: formData.get("connectionId"),
    deleteEmails: formData.get("deleteEmails") === "on" || formData.get("deleteEmails") === "true",
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const res = await disconnectConnection(user.id, parsed.data.connectionId, {
    deleteEmails: parsed.data.deleteEmails,
    fetch: (input, init) => fetch(input, init),
  });
  if (!res) return fail("Connection not found.");
  revalidatePath("/integrations");
  revalidatePath("/applications");

  const parts = ["Disconnected and the stored tokens were deleted."];
  if (res.revoke === "revoked" || res.revoke === "already_invalid") parts.push("Access was revoked with Google.");
  if (res.revoke === "failed") parts.push("Google could not be reached to revoke access — remove it at myaccount.google.com/permissions.");
  if (res.revoke === "not_supported") parts.push("Also remove the app's access in your Microsoft account settings.");
  if (parsed.data.deleteEmails) parts.push(`${res.deletedEmails} imported email record${res.deletedEmails === 1 ? "" : "s"} deleted.`);
  return ok({ message: parts.join(" ") });
}

const syncEnabledSchema = connectionIdSchema.extend({ enabled: z.boolean() });

export async function setSyncEnabledAction(
  _prev: ActionResult<IntegrationActionData> | null,
  formData: FormData,
): Promise<ActionResult<IntegrationActionData>> {
  const user = await requireUser("/integrations");
  const parsed = syncEnabledSchema.safeParse({
    connectionId: formData.get("connectionId"),
    enabled: formData.get("enabled") === "true",
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const changed = await setSyncEnabled(user.id, parsed.data.connectionId, parsed.data.enabled);
  if (!changed) return fail("Connection not found.");
  await audit("integration.sync_toggled", {
    userId: user.id,
    entityType: "IntegrationConnection",
    entityId: parsed.data.connectionId,
    metadata: { enabled: parsed.data.enabled },
  });
  revalidatePath("/integrations");
  return ok({ message: parsed.data.enabled ? "Scheduled sync turned on." : "Scheduled sync turned off. Sync now still works." });
}
